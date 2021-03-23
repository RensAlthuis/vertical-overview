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
const SearchController = Self.imports.searchController;
const WorkspacesView = Self.imports.workspacesView;
const WorkspaceThumbnail = Self.imports.workspaceThumbnail

var ControlsState = {
    HIDDEN: 0,
    WINDOW_PICKER: 1,
    APP_GRID: 2,
};

// ControlsManagerLayout

var ControlsManagerLayout = {
    _computeWorkspacesBoxForState: function (state, box, startY, searchHeight, leftOffset, rightOffset) {
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
                leftOffset + spacing,
                startY + searchHeight + spacing * expandFraction);
            workspaceBox.set_size(
                width - leftOffset - rightOffset,
                height - searchHeight - spacing * expandFraction);
            break;
        }

        return workspaceBox;
    },

    _getAppDisplayBoxForState: function(state, box, startY, searchHeight) {
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
                startY + searchHeight + spacing);
            break;
        }

        appDisplayBox.set_size(width,
            height -
            searchHeight - spacing
        );

        return appDisplayBox;
    },

    vfunc_allocate: function(container, box) {
        const childBox = new Clutter.ActorBox();

        let leftOffset = 200; //TODO: fixme;
        let rightOffset = 200; //TODO: fixme;

        const { spacing } = this;

        let startY = 0;
        if (Main.layoutManager.panelBox.y === Main.layoutManager.primaryMonitor.y) {
            startY = Main.layoutManager.panelBox.height;
            box.y1 += startY;
        }
        const [width, height] = box.get_size();
        let availableHeight = height;

        // Search entry
        let [searchHeight] = this._searchEntry.get_preferred_height(width);
        childBox.set_origin(leftOffset, startY);
        childBox.set_size(width - leftOffset - rightOffset, searchHeight);
        this._searchEntry.allocate(childBox);

        availableHeight -= searchHeight + spacing;

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
        childBox.set_origin(0, startY + searchHeight + spacing);
        childBox.set_size(width, availableHeight);
        this._searchController.allocate(childBox);
        this._runPostAllocation();
    }
}

//ControlsManager
var ControlsManager = {
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
            let opacity, scale;
            switch (s) {
            case ControlsState.HIDDEN:
            case ControlsState.WINDOW_PICKER:
            case ControlsState.APP_GRID:
                opacity = 255;
                scale = 1;
                break;
            default:
                opacity = 255;
                scale = 1;
                break;
            }

            return { opacity, scale } ;
        };

        const initialParams = paramsForState(initialState);
        const finalParams = paramsForState(finalState);

        return [
            Util.lerp(initialParams.opacity, finalParams.opacity, progress),
            Util.lerp(initialParams.scale, finalParams.scale, progress),
        ];
    },

    _updateThumbnailsBox: function(animate = false) {
        const { shouldShow } = this._thumbnailsBox;
        const { searchActive } = this._searchController;
        const [opacity, scale] = this._getThumbnailsBoxParams();

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
        }

        this._thumbnailsBox.ease(params);
    },

    _toggleAppsPage: function() {
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
}