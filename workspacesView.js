
const { Clutter, St } = imports.gi;
const WORKSPACE_MIN_SPACING = 24;
const WORKSPACE_MAX_SPACING = 1000;

const OverviewControls = imports.ui.overviewControls;
const WorkspacesView = imports.ui.workspacesView;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Util = Self.imports.util;

function override() {
    global.vertical_overview.GSFunctions['WorkspacesView'] = Util.overrideProto(WorkspacesView.WorkspacesView.prototype, WorkspacesViewOverride);
}

function reset() {
    Util.overrideProto(WorkspacesView.WorkspacesView.prototype, global.vertical_overview.GSFunctions['WorkspacesView']);
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

        overviewHeight = Main.overview._overview.height;
        let availableSpace;
        let [, workspaceSize] = workspace.get_preferred_height(width);
        availableSpace = (overviewHeight - workspaceSize) / 2;


        const spacing = (availableSpace) * (1 - fitMode);
        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);

        return Math.max(spacing * scaleFactor, 0);
    },

}