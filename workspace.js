const { Clutter, GLib, GObject, Graphene, Meta, St } = imports.gi;

const Background = imports.ui.background;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const OverviewControls = imports.ui.overviewControls;
const Params = imports.misc.params;
const Util = imports.misc.util;
const { WindowPreview } = imports.ui.windowPreview;
var WINDOW_PREVIEW_MAXIMUM_SCALE = 0.95;
var WINDOW_REPOSITIONING_DELAY = 750;
var LAYOUT_SCALE_WEIGHT = 1;
var LAYOUT_SPACE_WEIGHT = 0.1;
const BACKGROUND_CORNER_RADIUS_PIXELS = 30;
const BACKGROUND_MARGIN = 12;

const Workspace = imports.ui.workspace;
const Self = imports.misc.extensionUtils.getCurrentExtension();
const _Util = Self.imports.util;
const animateAllocation = imports.ui.workspace.animateAllocation;

function override() {

    global.vertical_overview.bgManagers = []
    for (var monitor of Main.layoutManager.monitors) {
        global.vertical_overview.bgManagers.push(new Background.BackgroundManager({
            monitorIndex: monitor.index,
            container: Main.layoutManager.overviewGroup,
        }));
    }

    global.vertical_overview.GSFunctions['Workspace'] = _Util.overrideProto(Workspace.Workspace.prototype, WorkspaceOverride);
    global.vertical_overview.GSFunctions['WorkspaceLayout'] = _Util.overrideProto(Workspace.WorkspaceLayout.prototype, WorkspaceLayoutOverride);
}

function reset() {
    for (var bg of global.vertical_overview.bgManagers) {
        bg.destroy();
    }
    delete global.vertical_overview.bgManagers;

    _Util.overrideProto(Workspace.Workspace.prototype, global.vertical_overview.GSFunctions['Workspace']);
    _Util.overrideProto(Workspace.WorkspaceLayout.prototype, global.vertical_overview.GSFunctions['WorkspaceLayout']);
}

WorkspaceOverride = {
    _init: function (metaWorkspace, monitorIndex, overviewAdjustment) {
        St.Widget.prototype._init.call(this, {
            style_class: 'window-picker',
            pivot_point: new Graphene.Point({ x: 0.5, y: 0.5 }),
            layout_manager: new Clutter.BinLayout(),
        });

        const layoutManager = new Workspace.WorkspaceLayout(metaWorkspace, monitorIndex,
            overviewAdjustment);

        // Window previews
        this._container = new Clutter.Actor({
            reactive: true,
            x_expand: true,
            y_expand: true,
        });
        this._container.layout_manager = layoutManager;
        this.add_child(this._container);

        this.metaWorkspace = metaWorkspace;
        this._activeWorkspaceChangedId =
            this.metaWorkspace?.connect('notify::active', () => {
                layoutManager.syncOverlays();
            });

        this._overviewAdjustment = overviewAdjustment;
        this._overviewStateId = overviewAdjustment.connect('notify::value', () => {
            const overviewState = overviewAdjustment.value;

            // We want windows not to spill out when the overview is in
            // APP_GRID state, but HIDDEN and WINDOW_PICKER should allow
            // them to eventually draw outside the workspace.
            this._container.clip_to_allocation =
                overviewState > OverviewControls.ControlsState.WINDOW_PICKER;
        });

        this.monitorIndex = monitorIndex;
        this._monitor = Main.layoutManager.monitors[this.monitorIndex];

        if (monitorIndex != Main.layoutManager.primaryIndex)
            this.add_style_class_name('external-monitor');

        const clickAction = new Clutter.ClickAction();
        clickAction.connect('clicked', action => {
            // Switch to the workspace when not the active one, leave the
            // overview otherwise.
            if (action.get_button() === 1 || action.get_button() === 0) {
                const leaveOverview = this._shouldLeaveOverview();

                this.metaWorkspace?.activate(global.get_current_time());
                if (leaveOverview)
                    Main.overview.hide();
            }
        });
        this.bind_property('mapped', clickAction, 'enabled', GObject.BindingFlags.SYNC_CREATE);
        this._container.add_action(clickAction);

        this.connect('style-changed', this._onStyleChanged.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));

        const windows = global.get_window_actors().map(a => a.meta_window)
            .filter(this._isMyWindow, this);

        // Create clones for windows that should be
        // visible in the Overview
        this._windows = [];
        for (let i = 0; i < windows.length; i++) {
            if (this._isOverviewWindow(windows[i]))
                this._addWindowClone(windows[i]);
        }

        // Track window changes, but let the window tracker process them first
        if (this.metaWorkspace) {
            this._windowAddedId = this.metaWorkspace.connect_after(
                'window-added', this._windowAdded.bind(this));
            this._windowRemovedId = this.metaWorkspace.connect_after(
                'window-removed', this._windowRemoved.bind(this));
        }
        this._windowEnteredMonitorId = global.display.connect_after(
            'window-entered-monitor', this._windowEnteredMonitor.bind(this));
        this._windowLeftMonitorId = global.display.connect_after(
            'window-left-monitor', this._windowLeftMonitor.bind(this));
        this._layoutFrozenId = 0;

        // DND requires this to be set
        this._delegate = this;
    },

}

WorkspaceLayoutOverride = {
    _adjustSpacingAndPadding: function (rowSpacing, colSpacing, containerBox) {
        if (this._sortedWindows.length === 0)
            return [rowSpacing, colSpacing, containerBox];

        // All of the overlays have the same chrome sizes,
        // so just pick the first one.
        const window = this._sortedWindows[0];

        const [topOversize, bottomOversize] = window.chromeHeights();
        const [leftOversize, rightOversize] = window.chromeWidths();

        const oversize =
            Math.max(topOversize, bottomOversize, leftOversize, rightOversize);

        if (rowSpacing !== null)
            rowSpacing += oversize;
        if (colSpacing !== null)
            colSpacing += oversize;

        if (containerBox) {
            const [topOverlap, bottomOverlap] = window.overlapHeights();
            const overlap = Math.max(topOverlap, bottomOverlap);

            containerBox.x1 += oversize;
            containerBox.x2 -= oversize;
            containerBox.y1 += oversize;
            containerBox.y2 -= oversize + overlap;
        }

        return [rowSpacing, colSpacing, containerBox];
    },

    vfunc_allocate: function (container, box) {
        const containerBox = container.allocation;
        const containerAllocationChanged =
            this._lastBox === null || !this._lastBox.equal(containerBox);
        this._lastBox = containerBox.copy();

        // If the containers size changed, we can no longer keep around
        // the old windowSlots, so we must unfreeze the layout.
        //
        // However, if the overview animation is in progress, don't unfreeze
        // the layout. This is needed to prevent windows "snapping" to their
        // new positions during the overview closing animation when the
        // allocation subtly expands every frame.
        if (this._layoutFrozen && containerAllocationChanged && !Main.overview.animationInProgress) {
            this._layoutFrozen = false;
            this.notify('layout-frozen');
        }

        let layoutChanged = false;
        if (!this._layoutFrozen) {
            if (this._layout === null) {
                this._layout = this._createBestLayout(this._workarea);
                layoutChanged = true;
            }

            if (layoutChanged || containerAllocationChanged)
                this._windowSlots = this._getWindowSlots(box.copy());
        }

        const workareaX = this._workarea.x;
        const workareaY = this._workarea.y;
        const workareaWidth = this._workarea.width;
        const stateAdjustementValue = this._stateAdjustment.value;

        const allocationScale = containerBox.get_width() / workareaWidth;

        const childBox = new Clutter.ActorBox();

        const { ControlsState } = OverviewControls;
        const inSessionTransition =
            this._overviewAdjustment.value <= ControlsState.WINDOW_PICKER;

        const nSlots = this._windowSlots.length;
        for (let i = 0; i < nSlots; i++) {
            let [x, y, width, height, child] = this._windowSlots[i];
            if (!child.visible)
                continue;

            const windowInfo = this._windows.get(child);

            let workspaceBoxX, workspaceBoxY;
            let workspaceBoxWidth, workspaceBoxHeight;

            if (windowInfo.metaWindow.showing_on_its_workspace()) {
                workspaceBoxX = (child.boundingBox.x - workareaX) * allocationScale;
                workspaceBoxY = (child.boundingBox.y - workareaY) * allocationScale + Main.panel.height;
                workspaceBoxWidth = child.boundingBox.width * allocationScale;
                workspaceBoxHeight = child.boundingBox.height * allocationScale;
            } else {
                workspaceBoxX = workareaX * allocationScale;
                workspaceBoxY = workareaY * allocationScale;
                workspaceBoxWidth = 0;
                workspaceBoxHeight = 0;

                child.opacity = stateAdjustementValue * 255;
            }

            // Don't allow the scaled floating size to drop below
            // the target layout size.
            // We only want to apply this when the scaled floating size is
            // actually larger than the target layout size, that is while
            // animating between the session and the window picker.
            if (inSessionTransition) {
                workspaceBoxWidth = Math.max(workspaceBoxWidth, width);
                workspaceBoxHeight = Math.max(workspaceBoxHeight, height);
            }

            x = Util.lerp(workspaceBoxX, x, stateAdjustementValue);
            y = Util.lerp(workspaceBoxY, y, stateAdjustementValue);
            width = Util.lerp(workspaceBoxWidth, width, stateAdjustementValue);
            height = Util.lerp(workspaceBoxHeight, height, stateAdjustementValue);

            childBox.set_origin(x, y - 32);
            childBox.set_size(width, height);

            if (windowInfo.currentTransition) {
                windowInfo.currentTransition.get_interval().set_final(childBox);

                // The timeline of the transition might not have been updated
                // before this allocation cycle, so make sure the child
                // still updates needs_allocation to FALSE.
                // Unfortunately, this relies on the fast paths in
                // clutter_actor_allocate(), otherwise we'd start a new
                // transition on the child, replacing the current one.
                child.allocate(child.allocation);
                continue;
            }

            // We want layout changes (ie. larger changes to the layout like
            // reshuffling the window order) to be animated, but small changes
            // like changes to the container size to happen immediately (for
            // example if the container height is being animated, we want to
            // avoid animating the children allocations to make sure they
            // don't "lag behind" the other animation).
            if (layoutChanged && !Main.overview.animationInProgress) {
                const transition = animateAllocation(child, childBox);
                if (transition) {
                    windowInfo.currentTransition = transition;
                    windowInfo.currentTransition.connect('stopped', () => {
                        windowInfo.currentTransition = null;
                    });
                }
            } else {
                child.allocate(childBox);
            }
        }
    }

}