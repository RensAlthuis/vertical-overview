// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported ControlsManager */

const { Clutter, Gio, GObject, Meta, Shell, St } = imports.gi;

const AppDisplay = imports.ui.appDisplay;
const Dash = imports.ui.dash;
const Layout = imports.ui.layout;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const SearchController = imports.ui.searchController;
const Util = imports.misc.util;
const WindowManager = imports.ui.windowManager;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const WorkspacesView = imports.ui.workspacesView;
const OverviewControls = imports.ui.overviewControls;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const _Util = Self.imports.util;

const SMALL_WORKSPACE_RATIO = 0.15;
const DASH_MAX_HEIGHT_RATIO = 0.15;

const A11Y_SCHEMA = 'org.gnome.desktop.a11y.keyboard';

var SIDE_CONTROLS_ANIMATION_TIME = Overview.ANIMATION_TIME;

var ControlsState = {
    HIDDEN: 0,
    WINDOW_PICKER: 1,
    APP_GRID: 2,
};

function override() {
    global.vertical_overview.GSFunctions['ControlsManagerLayout'] = _Util.overrideProto(OverviewControls.ControlsManagerLayout.prototype, ControlsManagerLayoutOverride);
    global.vertical_overview.GSFunctions['ControlsManager'] = _Util.overrideProto(OverviewControls.ControlsManager.prototype, ControlsManagerOverride);

    let controlsManager = Main.overview._overview._controls;
    global.vertical_overview._updateID = controlsManager._stateAdjustment.connect("notify::value", _updateWorkspacesDisplay.bind(controlsManager));
    global.vertical_overview._workspaceDisplayVisibleID = controlsManager._workspacesDisplay.connect("notify::visible", controlsManager._workspacesDisplay._updateWorkspacesViews.bind(controlsManager._workspacesDisplay));
}

function reset() {
    _Util.overrideProto(OverviewControls.ControlsManagerLayout.prototype, global.vertical_overview.GSFunctions['ControlsManagerLayout']);
    _Util.overrideProto(OverviewControls.ControlsManager.prototype, global.vertical_overview.GSFunctions['ControlsManager']);

    let controlsManager = Main.overview._overview._controls;
    controlsManager._stateAdjustment.disconnect(global.vertical_overview._updateID);
    controlsManager._workspacesDisplay.disconnect(global.vertical_overview._workspaceDisplayVisibleID);
    controlsManager._workspacesDisplay.reactive = true;
    controlsManager._workspacesDisplay.setPrimaryWorkspaceVisible(true);
}

function enterOverviewAnimation() {
    let controlsManager = Main.overview._overview._controls;

    if (global.vertical_overview.dash_override) {
        controlsManager.dash.translation_x = -controlsManager.dash.width;
        controlsManager.dash.ease({
            translation_x: 0,
            duration: Overview.ANIMATION_TIME,
        });
    }

    controlsManager._searchEntry.opacity = 0;
    controlsManager._searchEntry.ease({
        opacity: 255,
        duration: Overview.ANIMATION_TIME,
    });

    const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);
    const rightOffset = controlsManager.layoutManager.rightOffset * scaleFactor;

    controlsManager._thumbnailsBox.translation_x = rightOffset;
    controlsManager._thumbnailsBox.ease({
        translation_x: 0,
        duration: Overview.ANIMATION_TIME,
    });

    controlsManager._workspacesDisplay._workspacesViews.forEach((workspace, i) => {
        if (i != Main.layoutManager.primaryIndex) {
            let scale = Main.layoutManager.getWorkAreaForMonitor(workspace._monitorIndex).width / Main.layoutManager.primaryMonitor.width;
            workspace._thumbnails.translation_x = rightOffset * scale;
            workspace._thumbnails.ease({
                translation_x: 0,
                duration: Overview.ANIMATION_TIME,
            });
        }
    });
}

function exitOverviewAnimation() {
    let controlsManager = Main.overview._overview._controls;

    if (global.vertical_overview.dash_override) {
        controlsManager.dash.ease({
            translation_x: -controlsManager.dash.width,
            duration: Overview.ANIMATION_TIME,
        });
    }

    controlsManager._searchEntry.ease({
        opacity: 0,
        duration: Overview.ANIMATION_TIME,
    });

    controlsManager._thumbnailsBox.ease({
        translation_x: controlsManager._thumbnailsBox.width,
        duration: Overview.ANIMATION_TIME,
    });

    controlsManager._workspacesDisplay._workspacesViews.forEach((workspace, i) => {
        if (i != Main.layoutManager.primaryIndex) {
            workspace._thumbnails.ease({
                translation_x: workspace._thumbnails.width,
                duration: Overview.ANIMATION_TIME,
            });
        }
    });
}

var ControlsManagerLayoutOverride = {
    _computeWorkspacesBoxForState(state, workAreaBox, searchHeight, dashHeight, thumbnailsHeight) {
        const workspaceBox = workAreaBox.copy();
        const [startX, startY] = workAreaBox.get_origin();
        const [width, height] = workspaceBox.get_size();
        const { spacing } = this;
        const { expandFraction } = this._workspacesThumbnails;

        switch (state) {
        case ControlsState.HIDDEN:
                if (global.vertical_overview.misc_dTPLeftRightFix) {
                    let [w, h] = Main.layoutManager.panelBox.get_size();
                    let [x, y] = Main.layoutManager.panelBox.get_transformed_position();
                    if (x > 0) { // if x > 0 assume panel is on the right side
                        workspaceBox.set_size(width - w, box.y2);
                    } else {
                        workspaceBox.set_origin(w / 2, box.y1);
                    }
                }
            break;
        case ControlsState.WINDOW_PICKER:
        case ControlsState.APP_GRID:
            workspaceBox.set_origin(
                this.leftOffset + spacing,
                startY + searchHeight + spacing * expandFraction);
            workspaceBox.set_size(
                width - this.leftOffset - this.rightOffset - (spacing * 2),
                height - startY - (searchHeight + spacing * expandFraction) * 2);
            break;
        }

        return workspaceBox;
    },

    _getAppDisplayBoxForState(state, workAreaBox, searchHeight, dashHeight, appGridBox) {
        const [startX, startY] = workAreaBox.get_origin();
        const [width, height] = workAreaBox.get_size();
        const appDisplayBox = new Clutter.ActorBox();
        const { spacing } = this;

        switch (state) {
        case ControlsState.HIDDEN:
        case ControlsState.WINDOW_PICKER:
            appDisplayBox.set_origin(startX, workAreaBox.y2);
            break;
        case ControlsState.APP_GRID:
            appDisplayBox.set_origin(startX,
                startY + searchHeight + spacing);
            break;
        }

        appDisplayBox.set_size(width,
            height - startY - searchHeight - spacing
        );

        return appDisplayBox;
    },

    vfunc_allocate: function(container, box) {
        const childBox = new Clutter.ActorBox();

        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);
        var leftOffset = this.leftOffset * scaleFactor;
        let rightOffset = this.rightOffset * scaleFactor;

        const { spacing } = this;

        let startY = 0;

        if (global.vertical_overview.misc_dTPLeftRightFix) {
            let [w, h] = Main.layoutManager.panelBox.get_size();
            leftOffset -= w;
        } else {
            if (Main.layoutManager.panelBox.y === Main.layoutManager.primaryMonitor.y) {
                startY = Main.layoutManager.panelBox.height;
                box.y1 += startY;
            }
        }

        const [width, height] = box.get_size();
        let availableHeight = height;

        // Search entry
        let [searchHeight] = this._searchEntry.get_preferred_height(width);
        childBox.set_origin(leftOffset, startY);
        childBox.set_size(width - leftOffset - rightOffset, searchHeight);
        this._searchEntry.allocate(childBox);

        availableHeight -= searchHeight + spacing;

        // Dash
        if (global.vertical_overview.dash_override) {
            if (!global.vertical_overview.settings.object.get_boolean('hide-dash')) {
                let dashHeight = height * this.dashMaxHeightScale;
                this._dash.setMaxSize(leftOffset, dashHeight);
                let [, maxDashWidth] = this._dash.get_preferred_width(height);
                childBox.set_origin(0, startY);
                childBox.set_size(leftOffset, height);
                this._dash.allocate(childBox);
            }
        } else {
            const maxDashHeight = Math.round(box.get_height() * DASH_MAX_HEIGHT_RATIO);
            this._dash.setMaxSize(width, maxDashHeight);

            let [, dashHeight] = this._dash.get_preferred_height(width);
            dashHeight = Math.min(dashHeight, maxDashHeight);
            childBox.set_origin(0, startY + height - dashHeight);
            childBox.set_size(width, dashHeight);
            this._dash.allocate(childBox);

            availableHeight -= dashHeight + spacing;

        }


        // Workspace Thumbnails
        if (this._workspacesThumbnails.visible) {
            childBox.set_origin(width - rightOffset, startY);
            childBox.set_size(rightOffset, height);
            this._workspacesThumbnails.allocate(childBox);
        }

        // Workspaces
        let params = [box, startY, searchHeight, leftOffset, rightOffset];
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
        if (this._appDisplay.visible) {
            params = [box, startY, searchHeight];
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
        }

        // Search
        childBox.set_origin(leftOffset, startY + searchHeight + spacing);
        childBox.set_size(width - leftOffset - rightOffset, availableHeight);
        this._searchController.allocate(childBox);
        this._runPostAllocation();
    }
}

var ControlsManagerOverride = {
    _getFitModeForState: function(state) {
        switch (state) {
            case ControlsState.HIDDEN:
            case ControlsState.WINDOW_PICKER:
                return WorkspacesView.FitMode.SINGLE;
            case ControlsState.APP_GRID:
                return WorkspacesView.FitMode.SINGLE;
            default:
                return WorkspacesView.FitMode.SINGLE;
        }
    },

    _getThumbnailsBoxParams: function() {
        const { initialState, finalState, progress } =
            this._stateAdjustment.getStateTransitionParams();

        const paramsForState = s => {
            opacity = 255;
            scale = 1;
            return { opacity, scale } ;
        };

        const initialParams = paramsForState(initialState);
        const finalParams = paramsForState(finalState);

        return [
            Util.lerp(initialParams.opacity, finalParams.opacity, progress),
            Util.lerp(initialParams.scale, finalParams.scale, progress),
        ];
    },

    _updateThumbnailsBox: function() {
        const { shouldShow } = this._thumbnailsBox;

        const thumbnailsBoxVisible = shouldShow;
        if (thumbnailsBoxVisible) {
            this._thumbnailsBox.opacity = 255;
            this._thumbnailsBox.visible = thumbnailsBoxVisible;
        }
    },

    animateToOverview: function(state, callback) {
        this._ignoreShowAppsButtonToggle = true;

        this._searchController.prepareToEnterOverview();
        this._workspacesDisplay.prepareToEnterOverview();
        this._stateAdjustment.value = ControlsState.HIDDEN;

        this._workspacesDisplay.opacity = 255;
        this._workspacesDisplay.setPrimaryWorkspaceVisible(!this.dash.showAppsButton.checked);
        this._workspacesDisplay.reactive = !this.dash.showAppsButton.checked;

        this._stateAdjustment.ease(state, {
            duration: Overview.ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                if (callback)
                    callback();
            },
        });

        this.dash.showAppsButton.checked =
            state === ControlsState.APP_GRID;

        this._ignoreShowAppsButtonToggle = false;

        if (global.vertical_overview.scaling_workspaces_hidden) {
            enterOverviewAnimation();
        }
    },

    animateFromOverview: function(callback) {
        this._ignoreShowAppsButtonToggle = true;

        this._workspacesDisplay.prepareToLeaveOverview();
        this._stateAdjustment.ease(ControlsState.HIDDEN, {
            duration: Overview.ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                this.dash.showAppsButton.checked = false;
                this._ignoreShowAppsButtonToggle = false;

                if (callback)
                    callback();
            },
        });

        if (global.vertical_overview.scaling_workspaces_hidden) {
            exitOverviewAnimation();
        }
    }
}

function _updateWorkspacesDisplay() {
    const { initialState, finalState, progress } = this._stateAdjustment.getStateTransitionParams();
    const { searchActive } = this._searchController;

    //TODO: fix scaling (or just remove it)
    const paramsForState = s => {
        let opacity, scale;
        switch (s) {
            case ControlsState.HIDDEN:
            case ControlsState.WINDOW_PICKER:
                opacity = 255;
                scale = 1;
                break;
            case ControlsState.APP_GRID:
                opacity = 0;
                scale = 0.5;
                break;
            default:
                opacity = 255;
                scale = 1;
                break;
        }
        return { opacity, scale };
    };

    let initialParams = paramsForState(initialState);
    let finalParams = paramsForState(finalState);

    let opacity = Math.round(Util.lerp(initialParams.opacity, finalParams.opacity, progress));
    let scale = Util.lerp(initialParams.scale, finalParams.scale, progress);

    let workspacesDisplayVisible = (opacity != 0) && !(searchActive);
    let params = {
        opacity: opacity,
        scale: scale,
        duration: 0,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: () => {
            this._workspacesDisplay.visible = !(progress == 1 && finalState == ControlsState.APP_GRID);
            this._workspacesDisplay.reactive = workspacesDisplayVisible;
            this._workspacesDisplay.setPrimaryWorkspaceVisible(workspacesDisplayVisible);
        }
    }

    this._workspacesDisplay.ease(params);
}
