
const { Clutter, St } = imports.gi;
const WORKSPACE_MIN_SPACING = 24;
const WORKSPACE_MAX_SPACING = 1000;
const WORKSPACE_INACTIVE_SCALE = 0.94;
const SECONDARY_WORKSPACE_SCALE = 0.70;


const OverviewControls = imports.ui.overviewControls;
const WorkspacesView = imports.ui.workspacesView;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Util = Self.imports.util;

function override() {
    global.vertical_overview.GSFunctions['WorkspacesView'] = Util.overrideProto(WorkspacesView.WorkspacesView.prototype, WorkspacesViewOverride);
    log('You may see an error below,\nSecondaryMonitorDisplay is defined as const for some reason\nSince I\'m overriding values in that const an error show might show up.\n Feel free to ignore it');
    SecondaryMonitorDisplay = WorkspacesView.SecondaryMonitorDisplay;

    global.vertical_overview.GSFunctions['SecondaryMonitorDisplay'] = Util.overrideProto(WorkspacesView.SecondaryMonitorDisplay.prototype, SecondaryMonitorDisplayOverride);
    log('Thank you, please carry on');

    if (global.vertical_overview.default_old_style_enabled) {
        Main.overview._overview._controls._workspacesDisplay.add_style_class_name("vertical-overview");
    }
}

function reset() {
    Util.overrideProto(WorkspacesView.WorkspacesView.prototype, global.vertical_overview.GSFunctions['WorkspacesView']);
    Util.overrideProto(WorkspacesView.SecondaryMonitorDisplay.prototype, global.vertical_overview.GSFunctions['SecondaryMonitorDisplay']);
    if (global.vertical_overview.default_old_style_enabled) {
        Main.overview._overview._controls._workspacesDisplay.remove_style_class_name("vertical-overview");
    }
}

var WorkspacesViewOverride = {
    _getWorkspaceModeForOverviewState: function(state) {
        const { ControlsState } = OverviewControls;

        switch (state) {
        case ControlsState.HIDDEN:
            return 0;
        case ControlsState.WINDOW_PICKER:
            return 1;
        case ControlsState.APP_GRID:
            return 1;
        }

        return 0;
    },

    _getSpacing(box, fitMode, vertical) {
        const [width, height] = box.get_size();
        const [workspace] = this._workspaces;
        var [, workspaceHeight] = workspace.get_preferred_height(width);
        if (workspaceHeight > height) {
            workspaceHeight = height;
        }
        let total_height = global.screen_height;
        let availableSpace = ((total_height - workspaceHeight) / 2) - (global.vertical_overview.workspacePeek || 0);
        const spacing = (availableSpace) * (1 - fitMode);
        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);

        return Math.max(spacing * scaleFactor, 0);
    },

    _getFirstFitSingleWorkspaceBox(box, spacing, vertical) {
        const [width, height] = box.get_size();
        const [workspace] = this._workspaces;

        const rtl = this.text_direction === Clutter.TextDirection.RTL;
        const adj = this._scrollAdjustment;
        const currentWorkspace = vertical || !rtl
            ? adj.value : adj.upper - adj.value - 1;

        // Single fit mode implies centered too
        let [x1, y1] = box.get_origin();
        var [, workspaceHeight] = workspace.get_preferred_height(width);
        if (workspaceHeight > height) {
            workspaceHeight = height;
        }

        y1 += (height - workspaceHeight) / 2;
        y1 -= currentWorkspace * (workspaceHeight + spacing);

        const fitSingleBox = new Clutter.ActorBox({ x1, y1 });

        fitSingleBox.set_size(width, workspaceHeight);

        return fitSingleBox;
    }
}

var SecondaryMonitorDisplayOverride = {
    _getWorkspacesBoxForState(state, box, padding, leftOffset, rightOffset, spacing) {
        const { ControlsState } = OverviewControls;
        const workspaceBox = box.copy();
        const [width, height] = workspaceBox.get_size();

        switch (state) {
            case ControlsState.HIDDEN:
                break;
            case ControlsState.WINDOW_PICKER:
            case ControlsState.APP_GRID:
                workspaceBox.set_origin(leftOffset, padding + spacing);
                workspaceBox.set_size(
                    width - rightOffset - leftOffset,
                    height - 2 * padding - spacing);
                break;
        }

        return workspaceBox;
    },

    vfunc_allocate(box) {
        this.set_allocation(box);

        const themeNode = this.get_theme_node();
        const contentBox = themeNode.get_content_box(box);
        const [width, height] = contentBox.get_size();
        const { expandFraction } = this._thumbnails;
        const spacing = themeNode.get_length('spacing') * expandFraction;
        const padding =
            Math.round((1 - SECONDARY_WORKSPACE_SCALE) * height / 2);

        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);
        const scale = Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex).width / Main.layoutManager.primaryMonitor.width;
        const leftOffset = Main.overview._overview._controls.layoutManager.leftOffset * scale * scaleFactor;
        const rightOffset = Main.overview._overview._controls.layoutManager.rightOffset * scale * scaleFactor;

        // Workspace Thumbnails
        if (this._thumbnails.visible) {
            const childBox = new Clutter.ActorBox();
            childBox.set_origin(width - rightOffset, 0);
            childBox.set_size(rightOffset, height);
            this._thumbnails.allocate(childBox);
        }

        const {
            currentState, initialState, finalState, transitioning, progress,
        } = this._overviewAdjustment.getStateTransitionParams();

        let workspacesBox;
        const workspaceParams = [contentBox, padding, leftOffset, rightOffset, spacing];
        if (!transitioning) {
            workspacesBox =
                this._getWorkspacesBoxForState(currentState, ...workspaceParams);
        } else {
            const initialBox =
                this._getWorkspacesBoxForState(initialState, ...workspaceParams);
            const finalBox =
                this._getWorkspacesBoxForState(finalState, ...workspaceParams);
            workspacesBox = initialBox.interpolate(finalBox, progress);
        }
        this._workspacesView.allocate(workspacesBox);
    }
}
