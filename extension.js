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
const WorkspaceOverrides = Self.imports.workspace;

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
    WorkspaceOverrides.override();
    Gestures.override();
    DashOverride.override();

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
    WorkspaceOverrides.reset();
    WorkspaceThumbnailOverrides.reset();
    Gestures.reset();
    DashOverride.reset(true);

    rebind_keys(Main.overview._overview._controls);

    global.workspaceManager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);

    for (var key in global.vertical_overview.settings.signals) {
        Util.unbindSetting(key);
    };

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
    });

    Util.bindSetting('scaling-workspace-background', (settings, label) => {
        if (settings.get_boolean(label)) {
            WorkspaceOverrides.scalingWorkspaceBackgroundOverride();
        } else {
            WorkspaceOverrides.scalingWorkspaceBackgroundReset();
        }
    });

    Util.bindSetting('static-background', (settings, label) => {
        if (settings.get_boolean(label)) {
            WorkspaceOverrides.staticBackgroundOverride();
        } else {
            WorkspaceOverrides.staticBackgroundReset();
        }
    });

    Util.bindSetting('workspace-peek-distance', (settings, label) => {
        global.vertical_overview.workspacePeek = settings.get_int(label);
    });
}

function rebind_keys(self) {
    Main.wm.removeKeybinding('toggle-application-view');
    Main.wm.removeKeybinding('shift-overview-up');
    Main.wm.removeKeybinding('shift-overview-down');
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
