// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported WorkspacesView, WorkspacesDisplay */

const { Clutter, Gio, GObject, Meta, Shell, St } = imports.gi;

const Layout = imports.ui.layout;
const Main = imports.ui.main;
const OverviewControls = imports.ui.overviewControls;
const SwipeTracker = imports.ui.swipeTracker;
const Util = imports.misc.util;
const Workspace = imports.ui.workspace;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const { ThumbnailsBox, MAX_THUMBNAIL_SCALE } = Self.imports.workspaceThumbnail;

var WORKSPACE_SWITCH_TIME = 250;

const MUTTER_SCHEMA = 'org.gnome.mutter';

const WORKSPACE_MIN_SPACING = 24;
const WORKSPACE_MAX_SPACING = 80;

const WORKSPACE_INACTIVE_SCALE = 0.94;

const SECONDARY_WORKSPACE_SCALE = 0.70;

var FitMode = {
    SINGLE: 0,
    ALL: 1,
};

var WorkspacesView = {
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

    vfunc_allocate: function(box) {
        this.set_allocation(box);

        if (this.get_n_children() === 0)
            return;

        const vertical = 1; //TODO: turn into setting
        const rtl = this.text_direction === Clutter.TextDirection.RTL;

        const fitMode = this._fitModeAdjustment.value;

        let [fitSingleBox, fitAllBox] = this._getInitialBoxes(box);
        const fitSingleSpacing =
            this._getSpacing(fitSingleBox, FitMode.SINGLE, vertical);
        fitSingleBox =
            this._getFirstFitSingleWorkspaceBox(fitSingleBox, fitSingleSpacing, vertical);

        const fitAllSpacing =
            this._getSpacing(fitAllBox, FitMode.ALL, vertical);
        fitAllBox =
            this._getFirstFitAllWorkspaceBox(fitAllBox, fitAllSpacing, vertical);

        // Account for RTL locales by reversing the list
        const workspaces = this._workspaces.slice();
        if (rtl)
            workspaces.reverse();

        const [fitSingleX1, fitSingleY1] = fitSingleBox.get_origin();
        const [fitSingleWidth, fitSingleHeight] = fitSingleBox.get_size();
        const [fitAllX1, fitAllY1] = fitAllBox.get_origin();
        const [fitAllWidth, fitAllHeight] = fitAllBox.get_size();

        workspaces.forEach(child => {
            if (fitMode === FitMode.SINGLE)
                box = fitSingleBox;
            else if (fitMode === FitMode.ALL)
                box = fitAllBox;
            else
                box = fitSingleBox.interpolate(fitAllBox, fitMode);

            child.allocate_align_fill(box, 0.5, 0.5, false, false);

            if (vertical) {
                fitSingleBox.set_origin(
                    fitSingleX1,
                    fitSingleBox.y1 + fitSingleHeight + fitSingleSpacing);
                fitAllBox.set_origin(
                    fitAllX1,
                    fitAllBox.y1 + fitAllHeight + fitAllSpacing);
            } else {
                fitSingleBox.set_origin(
                    fitSingleBox.x1 + fitSingleWidth + fitSingleSpacing,
                    fitSingleY1);
                fitAllBox.set_origin(
                    fitAllBox.x1 + fitAllWidth + fitAllSpacing,
                    fitAllY1);
            }
        });
    }
}