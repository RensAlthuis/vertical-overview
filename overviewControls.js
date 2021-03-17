// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported ControlsManager */

const { Clutter, Gio, GObject, Meta, Shell, St } = imports.gi;

const AppDisplay = imports.ui.appDisplay;
const Layout = imports.ui.layout;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const Util = imports.misc.util;
const WindowManager = imports.ui.windowManager;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const WorkspacesView = Self.imports.workspacesView;
const SearchController = Self.imports.searchController;
const WorkspaceThumbnail = Self.imports.workspaceThumbnail;


const SMALL_WORKSPACE_RATIO = 0.15;

const A11Y_SCHEMA = 'org.gnome.desktop.a11y.keyboard';

var SIDE_CONTROLS_ANIMATION_TIME = Overview.ANIMATION_TIME;

var ControlsState = {
    HIDDEN: 0,
    WINDOW_PICKER: 1,
    APP_GRID: 2,
};

var ControlsManagerLayout = GObject.registerClass(
class ControlsManagerLayout extends Clutter.BoxLayout {
    _init(searchEntry, appDisplay, workspacesDisplay, workspacesThumbnails,
        searchController, stateAdjustment) {
        super._init({ orientation: Clutter.Orientation.VERTICAL });

        this._appDisplay = appDisplay;
        this._workspacesDisplay = workspacesDisplay;
        this._workspacesThumbnails = workspacesThumbnails;
        this._stateAdjustment = stateAdjustment;
        this._searchEntry = searchEntry;
        this._searchController = searchController;
        this.showAppsGrid = false;

        this._cachedWorkspaceBoxes = new Map();
        this._postAllocationCallbacks = [];

        stateAdjustment.connect('notify::value', () => this.layout_changed());
    }

    _computeWorkspacesBoxForState(state, box, searchHeight, leftOffset, rightOffset, thumbnailsHeight) {
        const workspaceBox = box.copy();
        const [width, height] = workspaceBox.get_size();
        const { spacing } = this;
        const { expandFraction } = this._workspacesThumbnails;

        switch (state) {
        case ControlsState.HIDDEN:
            break;
        case ControlsState.WINDOW_PICKER:
        case ControlsState.APP_GRID:
            workspaceBox.set_origin(
                leftOffset,
                searchHeight + spacing * expandFraction);
            workspaceBox.set_size(
                width - leftOffset - rightOffset,
                height - searchHeight - spacing - thumbnailsHeight - spacing);
            break;
        }

        return workspaceBox;
    }

    _getAppDisplayBoxForState(state, box, searchHeight) {
        const [width, height] = box.get_size();
        const appDisplayBox = new Clutter.ActorBox();
        const { spacing } = this;

        switch (state) {
        case ControlsState.HIDDEN:
        case ControlsState.WINDOW_PICKER:
            appDisplayBox.set_origin(0, box.y2);
            break;
        case ControlsState.APP_GRID:
            appDisplayBox.set_origin(0,
                searchHeight + spacing);
            break;
        }

        appDisplayBox.set_size(width,
            height -
            searchHeight - spacing
        );

        return appDisplayBox;
    }

    _runPostAllocation() {
        if (this._postAllocationCallbacks.length === 0)
            return;

        this._postAllocationCallbacks.forEach(cb => cb());
        this._postAllocationCallbacks = [];
    }

    vfunc_set_container(container) {
        this._container = container;
        this.hookup_style(container);
    }

    vfunc_allocate(container, box) {
        const childBox = new Clutter.ActorBox();

        const { spacing } = this;

        const [width, height] = box.get_size();
        let availableHeight = height;

        // Search entry
        const [searchHeight] = this._searchEntry.get_preferred_height(width);
        childBox.set_origin(0, 0);
        childBox.set_size(width, searchHeight);
        this._searchEntry.allocate(childBox);

        availableHeight -= searchHeight + spacing;

        // Workspace Thumbnails
        let thumbnailsHeight = 0;
        if (this._workspacesThumbnails.visible) {
            const { expandFraction } = this._workspacesThumbnails;
            [thumbnailsHeight] =
                this._workspacesThumbnails.get_preferred_height(width);
            thumbnailsHeight = Math.min(
                thumbnailsHeight * expandFraction,
                height * WorkspaceThumbnail.MAX_THUMBNAIL_SCALE);
            childBox.set_origin(box.x2, searchHeight + spacing);
            childBox.set_size(width, thumbnailsHeight);
            this._workspacesThumbnails.allocate(childBox);
        }

        let leftOffset = 200; //TODO: fixme;
        let rightOffset = 200; //TODO: fixme;

        // Workspaces
        let params = [box, searchHeight, leftOffset, rightOffset, thumbnailsHeight];
        const transitionParams = this._stateAdjustment.getStateTransitionParams();

        // Update cached boxes
        for (const state of Object.values(ControlsState)) {
            this._cachedWorkspaceBoxes.set(
                state, this._computeWorkspacesBoxForState(state, ...params));
        }

        let workspacesBox;
        if (!transitionParams.transitioning) {
            workspacesBox = this._cachedWorkspaceBoxes.get(transitionParams.currentState);
        } else {
            const initialBox = this._cachedWorkspaceBoxes.get(transitionParams.initialState);
            const finalBox = this._cachedWorkspaceBoxes.get(transitionParams.finalState);
            workspacesBox = initialBox.interpolate(finalBox, transitionParams.progress);
        }

        this._workspacesDisplay.allocate(workspacesBox);

        // App grid
        params = [box, searchHeight];
        let appDisplayBox;
        if (!transitionParams.transitioning) {
            appDisplayBox =
                this._getAppDisplayBoxForState(transitionParams.currentState, ...params);
        } else {
            const initialBox =
                this._getAppDisplayBoxForState(transitionParams.initialState, ...params);
            const finalBox =
                this._getAppDisplayBoxForState(transitionParams.finalState, ...params);

            appDisplayBox = initialBox.interpolate(finalBox, transitionParams.progress);
        }
        this._appDisplay.allocate(appDisplayBox);

        // Search
        childBox.set_origin(0, searchHeight + spacing);
        childBox.set_size(width, availableHeight);

        this._searchController.allocate(childBox);

        this._runPostAllocation();
    }

    ensureAllocation() {
        this.layout_changed();
        return new Promise(
            resolve => this._postAllocationCallbacks.push(resolve));
    }

    getWorkspacesBoxForState(state) {
        return this._cachedWorkspaceBoxes.get(state);
    }
});

var OverviewAdjustment = GObject.registerClass({
    Properties: {
        'gesture-in-progress': GObject.ParamSpec.boolean(
            'gesture-in-progress', 'Gesture in progress', 'Gesture in progress',
            GObject.ParamFlags.READWRITE,
            false),
    },
}, class OverviewAdjustment extends St.Adjustment {
    _init(actor) {
        super._init({
            actor,
            value: ControlsState.WINDOW_PICKER,
            lower: ControlsState.HIDDEN,
            upper: ControlsState.APP_GRID,
        });
    }

    getStateTransitionParams() {
        const currentState = this.value;

        const transition = this.get_transition('value');
        let initialState = transition
            ? transition.get_interval().peek_initial_value()
            : currentState;
        let finalState = transition
            ? transition.get_interval().peek_final_value()
            : currentState;

        if (initialState > finalState) {
            initialState = Math.ceil(initialState);
            finalState = Math.floor(finalState);
        } else {
            initialState = Math.floor(initialState);
            finalState = Math.ceil(finalState);
        }

        const length = Math.abs(finalState - initialState);
        const progress = length > 0
            ? Math.abs((currentState - initialState) / length)
            : 1;

        return {
            transitioning: transition !== null || this.gestureInProgress,
            currentState,
            initialState,
            finalState,
            progress,
        };
    }
});

var ControlsManager = GObject.registerClass(
class ControlsManager extends St.Widget {
    _init() {
        super._init({
            style_class: 'controls-manager',
            x_expand: true,
            y_expand: true,
            clip_to_allocation: true,
        });

        this._searchEntry = new St.Entry({
            style_class: 'search-entry',
            /* Translators: this is the text displayed
               in the search entry when no search is
               active; it should not exceed ~30
               characters. */
            hint_text: _('Type to search'),
            track_hover: true,
            can_focus: true,
        });
        this._searchEntry.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);
        this._searchEntryBin = new St.Bin({
            child: this._searchEntry,
            x_align: Clutter.ActorAlign.CENTER,
        });

        let workspaceManager = global.workspace_manager;
        let activeWorkspaceIndex = workspaceManager.get_active_workspace_index();

        this._workspaceAdjustment = new St.Adjustment({
            actor: this,
            value: activeWorkspaceIndex,
            lower: 0,
            page_increment: 1,
            page_size: 1,
            step_increment: 0,
            upper: workspaceManager.n_workspaces,
        });

        this._stateAdjustment = new OverviewAdjustment(this);
        this._stateAdjustment.connect('notify::value', this._update.bind(this));

        this._nWorkspacesNotifyId =
            workspaceManager.connect('notify::n-workspaces',
                this._updateAdjustment.bind(this));

        this._searchController = new SearchController.SearchController(
            this._searchEntry);
        this._searchController.connect('notify::search-active', this._onSearchChanged.bind(this));

        this._thumbnailsBox = new WorkspaceThumbnail.ThumbnailsBox(
            this._workspaceAdjustment, Main.layoutManager.primaryIndex);
        this._thumbnailsBox.connect('notify::should-show', () => {
            this._thumbnailsBox.show();
            this._thumbnailsBox.ease_property('expand-fraction',
                this._thumbnailsBox.should_show ? 1 : 0, {
                    duration: SIDE_CONTROLS_ANIMATION_TIME,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => this._updateThumbnailsBox(),
                });
        });

        this._workspacesDisplay = new WorkspacesView.WorkspacesDisplay(
            this,
            this._workspaceAdjustment,
            this._stateAdjustment);
        this._appDisplay = new AppDisplay.AppDisplay();

        this.add_child(this._searchEntryBin);
        this.add_child(this._appDisplay);
        this.add_child(this._searchController);
        this.add_child(this._thumbnailsBox);
        this.add_child(this._workspacesDisplay);

        this.layout_manager = new ControlsManagerLayout(
            this._searchEntryBin,
            this._appDisplay,
            this._workspacesDisplay,
            this._thumbnailsBox,
            this._searchController,
            this._stateAdjustment);

        Main.ctrlAltTabManager.addGroup(
            this.appDisplay,
            _('Applications'),
            'view-app-grid-symbolic', {
                proxy: this,
                focusCallback: () => {
                    this.showAppsGrid = true;
                    this.appDisplay.navigate_focus(
                        null, St.DirectionType.TAB_FORWARD, false);
                },
            });

        Main.ctrlAltTabManager.addGroup(
            this._workspacesDisplay,
            _('Windows'),
            'focus-windows-symbolic', {
                proxy: this,
                focusCallback: () => {
                    this.showAppsGrid = false;
                    this._workspacesDisplay.navigate_focus(
                        null, St.DirectionType.TAB_FORWARD, false);
                },
            });

        this._a11ySettings = new Gio.Settings({ schema_id: A11Y_SCHEMA });

        // global.display.connect('overlay-key', () => {
        //     if (this._a11ySettings.get_boolean('stickykeys-enable'))
        //         return;

        //     const { initialState, finalState, transitioning } =
        //         this._stateAdjustment.getStateTransitionParams();

        //     if (transitioning && finalState > initialState)
        //         this._shiftState(Meta.MotionDirection.UP);
        //     else
        //         Main.overview.toggle();
        // });

        Main.wm.addKeybinding(
            'toggle-application-view',
            new Gio.Settings({ schema_id: WindowManager.SHELL_KEYBINDINGS_SCHEMA }),
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            this._toggleAppsPage.bind(this));

        Main.wm.addKeybinding('shift-overview-up',
            new Gio.Settings({ schema_id: WindowManager.SHELL_KEYBINDINGS_SCHEMA }),
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
             Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
             () => this._shiftState(Meta.MotionDirection.UP));

          Main.wm.addKeybinding('shift-overview-down',
              new Gio.Settings({ schema_id: WindowManager.SHELL_KEYBINDINGS_SCHEMA }),
              Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
              Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
              () => this._shiftState(Meta.MotionDirection.DOWN));

        this.connect('destroy', this._onDestroy.bind(this));

        this._update();
    }

    _getFitModeForState(state) {
        switch (state) {
        case ControlsState.HIDDEN:
        case ControlsState.WINDOW_PICKER:
            return WorkspacesView.FitMode.SINGLE;
        case ControlsState.APP_GRID:
            return WorkspacesView.FitMode.SINGLE;
        default:
            return WorkspacesView.FitMode.SINGLE;
        }
    }

    _getThumbnailsBoxParams() {
        const { initialState, finalState, progress } =
            this._stateAdjustment.getStateTransitionParams();

        const paramsForState = s => {
            let opacity, scale, translationY;
            switch (s) {
            case ControlsState.HIDDEN:
            case ControlsState.WINDOW_PICKER:
                opacity = 255;
                scale = 1;
                translationY = 0;
                break;
            case ControlsState.APP_GRID:
                opacity = 0;
                scale = 0.5;
                translationY = this._thumbnailsBox.height / 2;
                break;
            default:
                opacity = 255;
                scale = 1;
                translationY = 0;
                break;
            }

            return { opacity, scale, translationY };
        };

        const initialParams = paramsForState(initialState);
        const finalParams = paramsForState(finalState);

        return [
            Util.lerp(initialParams.opacity, finalParams.opacity, progress),
            Util.lerp(initialParams.scale, finalParams.scale, progress),
            Util.lerp(initialParams.translationY, finalParams.translationY, progress),
        ];
    }

    _updateThumbnailsBox(animate = false) {
        const { shouldShow } = this._thumbnailsBox;
        const { searchActive } = this._searchController;
        const [opacity, scale, translationY] = this._getThumbnailsBoxParams();

        const thumbnailsBoxVisible = shouldShow && !searchActive && opacity !== 0;
        if (thumbnailsBoxVisible) {
            this._thumbnailsBox.opacity = 0;
            this._thumbnailsBox.visible = thumbnailsBoxVisible;
        }

        const params = {
            opacity: searchActive ? 0 : opacity,
            duration: animate ? SIDE_CONTROLS_ANIMATION_TIME : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => (this._thumbnailsBox.visible = thumbnailsBoxVisible),
        };

        if (!searchActive) {
            params.scale_x = scale;
            params.scale_y = scale;
            params.translation_y = translationY;
        }

        this._thumbnailsBox.ease(params);
    }

    _update() {
        const params = this._stateAdjustment.getStateTransitionParams();

        const fitMode = Util.lerp(
            this._getFitModeForState(params.initialState),
            this._getFitModeForState(params.finalState),
            params.progress);

        const { fitModeAdjustment } = this._workspacesDisplay;
        fitModeAdjustment.value = fitMode;

        this._updateThumbnailsBox();
    }

    _onSearchChanged() {
        const { searchActive } = this._searchController;

        if (!searchActive) {
            this._appDisplay.show();
            this._workspacesDisplay.reactive = true;
            this._workspacesDisplay.setPrimaryWorkspaceVisible(true);
        } else {
            this._searchController.show();
        }

        this._updateThumbnailsBox(true);

        this._appDisplay.ease({
            opacity: searchActive ? 0 : 255,
            duration: SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => (this._appDisplay.visible = !searchActive),
        });
        this._workspacesDisplay.ease({
            opacity: searchActive ? 0 : 255,
            duration: SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._workspacesDisplay.reactive = !searchActive;
                this._workspacesDisplay.setPrimaryWorkspaceVisible(!searchActive);
            },
        });
        this._searchController.ease({
            opacity: searchActive ? 255 : 0,
            duration: SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => (this._searchController.visible = searchActive),
        });
    }

    _toggleAppsPage() {
        if (Main.overview.visible) {
            const checked = this.showAppsGrid;
            this.showAppsGrid = !checked;
            const value = checked ? ControlsState.WINDOW_PICKER : ControlsState.APP_GRID;
            this._stateAdjustment.remove_transition('value');
            this._stateAdjustment.ease(value, {
                duration: SIDE_CONTROLS_ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });

            if(!this.showAppsGrid) {
                this._workspacesDisplay.setPrimaryWorkspaceVisible(true);
            }
         } else {
            Main.overview.show(ControlsState.APP_GRID);
            this.showAppsGrid = true;
        }

        this._workspacesDisplay.ease({
            opacity: this.showAppsGrid ? 0 : 255,
            duration: SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._workspacesDisplay.reactive = !this.showAppsGrid;
                this._workspacesDisplay.setPrimaryWorkspaceVisible(!this.showAppsGrid);
            },
        });
    }

    _shiftState(direction) {
        let { currentState, finalState } = this._stateAdjustment.getStateTransitionParams();

        if (direction === Meta.MotionDirection.DOWN)
            finalState = Math.max(finalState - 1, ControlsState.HIDDEN);
        else if (direction === Meta.MotionDirection.UP)
            finalState = Math.min(finalState + 1, ControlsState.APP_GRID);

        if (finalState === currentState)
            return;

        if (currentState === ControlsState.HIDDEN &&
            finalState === ControlsState.WINDOW_PICKER) {
            Main.overview.show();
        } else if (finalState === ControlsState.HIDDEN) {
            Main.overview.hide();
        } else {
            this._stateAdjustment.ease(finalState, {
                duration: SIDE_CONTROLS_ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this.showAppsGrid = finalState === ControlsState.APP_GRID;
                },
            });
        }
    }

    _onDestroy() {
        global.workspace_manager.disconnect(this._nWorkspacesNotifyId);
    }

    _updateAdjustment() {
        let workspaceManager = global.workspace_manager;
        let newNumWorkspaces = workspaceManager.n_workspaces;
        let activeIndex = workspaceManager.get_active_workspace_index();

        this._workspaceAdjustment.upper = newNumWorkspaces;

        // A workspace might have been inserted or removed before the active
        // one, causing the adjustment to go out of sync, so update the value
        this._workspaceAdjustment.remove_transition('value');
        this._workspaceAdjustment.value = activeIndex;
    }

    vfunc_unmap() {
        this._workspacesDisplay.vfunc_hide();
        super.vfunc_unmap();
    }

    animateToOverview(state, callback) {

        this._searchController.prepareToEnterOverview();
        this._workspacesDisplay.prepareToEnterOverview();
        if (!this._workspacesDisplay.activeWorkspaceHasMaximizedWindows())
            Main.overview.fadeOutDesktop();

        this._stateAdjustment.value = ControlsState.HIDDEN;
        this._stateAdjustment.ease(state, {
            duration: Overview.ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                if (callback)
                    callback();
            },
        });

        this.showAppsGrid =
            state === ControlsState.APP_GRID;

    }

    animateFromOverview(callback) {

        this._workspacesDisplay.prepareToLeaveOverview();
        if (!this._workspacesDisplay.activeWorkspaceHasMaximizedWindows())
            Main.overview.fadeInDesktop();

        this._stateAdjustment.ease(ControlsState.HIDDEN, {
            duration: Overview.ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                this.showAppsGrid = false;

                if (callback)
                    callback();
            },
        });
    }

    getWorkspacesBoxForState(state) {
        return this.layoutManager.getWorkspacesBoxForState(state);
    }

    gestureBegin(tracker) {
        const baseDistance = global.screen_height;
        const progress = this._stateAdjustment.value;
        const points = [
            ControlsState.HIDDEN,
            ControlsState.WINDOW_PICKER,
            ControlsState.APP_GRID,
        ];

        const transition = this._stateAdjustment.get_transition('value');
        const cancelProgress = transition
            ? transition.get_interval().peek_final_value()
            : Math.round(progress);

        tracker.confirmSwipe(baseDistance, points, progress, cancelProgress);
        this._workspacesDisplay.prepareToEnterOverview();
        this._searchController.prepareToEnterOverview();
        this._stateAdjustment.gestureInProgress = true;
    }

    gestureProgress(progress) {
        this._stateAdjustment.value = progress;
    }

    gestureEnd(target, duration, onComplete) {
        if (target === ControlsState.HIDDEN)
            this._workspacesDisplay.prepareToLeaveOverview();

        this.showAppsGrid =
            target === ControlsState.APP_GRID;

        this._stateAdjustment.remove_transition('value');
        this._stateAdjustment.ease(target, {
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onComplete,
        });

        this._stateAdjustment.gestureInProgress = false;
    }

    async runStartupAnimation(callback) {
        this._searchController.prepareToEnterOverview();
        this._workspacesDisplay.prepareToEnterOverview();

        this._stateAdjustment.value = ControlsState.HIDDEN;
        this._stateAdjustment.ease(ControlsState.WINDOW_PICKER, {
            duration: Overview.ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        this.showAppsGrid = false;

        // Set the opacity here to avoid a 1-frame flicker
        this.opacity = 0;

        // We can't run the animation before the first allocation happens
        await this.layout_manager.ensureAllocation();

        const { STARTUP_ANIMATION_TIME } = Layout;

        // Opacity
        this.ease({
            opacity: 255,
            duration: STARTUP_ANIMATION_TIME,
            mode: Clutter.AnimationMode.LINEAR,
        });

        // Search bar falls from the ceiling
        const { primaryMonitor } = Main.layoutManager;
        const [, y] = this._searchEntryBin.get_transformed_position();
        const yOffset = y - primaryMonitor.y;

        this._searchEntryBin.translation_y = -(yOffset + this._searchEntryBin.height);
        this._searchEntryBin.ease({
            translation_y: 0,
            duration: STARTUP_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    get searchEntry() {
        return this._searchEntry;
    }

    get appDisplay() {
        return this._appDisplay;
    }
});
