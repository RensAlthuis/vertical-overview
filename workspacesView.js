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
}