const __DEBUG__ = true;

const { Gio, Meta, Shell, Clutter, GObject, Graphene, St } = imports.gi;
const WindowManager = imports.ui.windowManager;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Util = Self.imports.util;
const OverviewControlsOverride = Self.imports.overviewControls;
const WorkspacesViewOverrides = Self.imports.workspacesView;
const WorkspaceThumbnailOverrides = Self.imports.workspaceThumbnail;
const DashOverride = Self.imports.dash;
const Gestures = Self.imports.gestures;
const Background = imports.ui.background;
const WorkspaceOverride = Self.imports.workspace;

function init() {
}

function enable() {
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] starting overrides");
    global.vertical_overview = {};
    global.vertical_overview.GSFunctions = {};
    bindSettings();

    OverviewControlsOverride.override();
    WorkspacesViewOverrides.override();
    WorkspaceThumbnailOverrides.override();
    Gestures.override();

    //this is the magic function that switches the internal layout to vertical
    global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, true, -1, 1);

    //rebinding keys is necessary because bound functions don't update if the prototype for that function is changed
    rebind_keys(Main.overview._overview._controls);


    if (__DEBUG__) global.log("[VERTICAL_OVERVIEW] enabled");
}

function disable() {
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] resetting overrides");

    OverviewControlsOverride.reset();
    WorkspacesViewOverrides.reset();
    WorkspaceOverride.staticBackgroundReset();
    WorkspaceOverride.scalingWorkspaceBackgroundReset();
    WorkspaceThumbnailOverrides.reset();
    Gestures.reset();

    if (global.vertical_overview.settings.get_boolean('override-dash'))
        DashOverride.reset();
    if (global.vertical_overview.settings.get_boolean('hide-dash'))
        DashOverride.show();

    rebind_keys(Main.overview._overview._controls);

    global.workspaceManager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);

    global.vertical_overview.signals.forEach(id => {
        global.vertical_overview.settings.disconnect(id);
    });
    delete global.vertical_overview;
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] disabled");
}

function bindSettings() {
    let controlsManager = Main.overview._overview._controls;

    Util.bindSetting('left-offset', (settings, label) => {
        controlsManager.layoutManager.leftOffset = settings.get_int(label);
    });

    Util.bindSetting('right-offset', (settings, label) => {
        controlsManager.layoutManager.rightOffset = settings.get_int(label);
    })

    let dash_max_height_id = null;
    let dash_max_height_scale = controlsManager.layoutManager.dashMaxHeightScale;
    let bind_dash_max_height = function () {
        dash_max_height_id = Util.bindSetting('dash-max-height', (settings, label) => {
            controlsManager.layoutManager.dashMaxHeightScale = settings.get_int(label) / 100.0;
        });
    }

    Util.bindSetting('override-dash', (settings, label) => {
        if (settings.get_boolean(label)) {
            DashOverride.override();
            if (dash_max_height_id == null)
                bind_dash_max_height();
        } else if (dash_max_height_id != null) {
            DashOverride.reset();
            settings.disconnect(dash_max_height_id);
            global.vertical_overview.signals.splice(global.vertical_overview.signals.indexOf(dash_max_height_id), 1);
            dash_max_height_id = null;
            controlsManager.layoutManager.dashMaxHeightScale = dash_max_height_scale;
        }
    });

    Util.bindSetting('hide-dash', (settings, label) => {
        if (settings.get_boolean(label)) {
            DashOverride.hide();
        } else {
            DashOverride.show();
        }
    });

    Util.bindSetting('scaling-workspace-background', (settings, label) => {
        if (settings.get_boolean(label)) {
            WorkspaceOverride.scalingWorkspaceBackgroundOverride();
        } else {
            WorkspaceOverride.scalingWorkspaceBackgroundReset();
        }
    });

    Util.bindSetting('static-background', (settings, label) => {
        if (settings.get_boolean(label)) {
            WorkspaceOverride.staticBackgroundOverride();
        } else {
            WorkspaceOverride.staticBackgroundReset();
        }
    });

    Util.bindSetting('workspace-peek-distance', (settings, label) => {
        global.vertical_overview.workspacePeek = settings.get_int(label);
    });
}

function rebind_keys(self) {
    Main.wm.removeKeybinding('toggle-application-view');
    Main.wm.removeKeybinding('shift-overview-up');
    Main.wm.removeKeybinding('shift-overview-down')
    Main.wm.addKeybinding(
        'toggle-application-view',
        new Gio.Settings({ schema_id: WindowManager.SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        self._toggleAppsPage.bind(self));

    Main.wm.addKeybinding('shift-overview-up',
        new Gio.Settings({ schema_id: WindowManager.SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => self._shiftState(Meta.MotionDirection.UP));

    Main.wm.addKeybinding('shift-overview-down',
        new Gio.Settings({ schema_id: WindowManager.SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => self._shiftState(Meta.MotionDirection.DOWN))
}
