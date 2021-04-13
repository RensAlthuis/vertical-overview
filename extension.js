const __DEBUG__ = true;

const { Gio, Meta, Shell, Clutter, GObject} = imports.gi;
const WindowManager = imports.ui.windowManager;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Util = Self.imports.util;
const OverviewControlsOverride = Self.imports.overviewControls;
const WorkspacesViewOverrides = Self.imports.workspacesView;
const WorkspaceThumbnailOverrides = Self.imports.workspaceThumbnail;
const DashOverride = Self.imports.dash;
const Gestures = Self.imports.gestures;
const overrideProto = Util.overrideProto;

function init() {
}

function enable() {
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] Bind settings");
    global.vertical_overview = {};
    global.vertical_overview.GSFunctions = {};
    bindSettings();

    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] starting overrides");
    OverviewControlsOverride.override();
    WorkspacesViewOverrides.override();
    WorkspaceThumbnailOverrides.override();
    Gestures.override();

    if (global.vertical_overview.settings.get_boolean('override-dash'))
        DashOverride.override();
    if (global.vertical_overview.settings.get_boolean('hide-dash'))
        DashOverride.show();

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
    WorkspaceThumbnailOverrides.reset();
    Gestures.reset();
    if (global.vertical_overview.settings.get_boolean('override-dash'))
        DashOverride.reset();
    if (global.vertical_overview.settings.get_boolean('hide-dash'))
        DashOverride.show();

    rebind_keys(Main.overview._overview._controls);

    global.workspaceManager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);

    global.vertical_overview.settings.run_dispose();
    delete global.vertical_overview;
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] disabled");
}

function bindSettings() {
    let controlsManager = Main.overview._overview._controls;
    let settings = Util.getSettings('org.gnome.shell.extensions.vertical-overview');
    global.vertical_overview.settings = settings;

    controlsManager.layoutManager.leftOffset = settings.get_int('left-offset');
    settings.connect('changed::left-offset', (v, e) => {
        log('hi');
        Main.overview._overview._controls.layoutManager.leftOffset = v.get_int(e);
    });

    controlsManager.layoutManager.rightOffset = settings.get_int('right-offset');
    settings.connect('changed::right-offset', (v, e) => {
        Main.overview._overview._controls.layoutManager.rightOffset = v.get_int(e);
    });

    let dash_max_height_id = null;
    let dash_max_height_scale = controlsManager.layoutManager.dashMaxHeightScale;
    let bind_dash_max_height = function () {
        controlsManager.layoutManager.dashMaxHeightScale = settings.get_int('dash-max-height') / 100.0;
        dash_max_height_id = settings.connect('changed::dash-max-height', (v, e) => {
            controlsManager.layoutManager.dashMaxHeightScale = v.get_int(e) / 100.0;
        });
    }

    if (settings.get_boolean('override-dash')) {
        bind_dash_max_height();
    }

    settings.connect('changed::override-dash', (v, e) => {
        if (v.get_boolean(e)) {
            DashOverride.override();
            if (dash_max_height_id == null)
                bind_dash_max_height();
        } else {
            DashOverride.reset();
            if (dash_max_height_id != null) {
                settings.disconnect(dash_max_height_id);
                dash_max_height_id = null;
                controlsManager.layoutManager.dashMaxHeightScale = dash_max_height_scale;
            }
        }
    });

    settings.connect('changed::hide-dash', (v, e) => {
        if (v.get_boolean(e)) {
            DashOverride.hide();
        } else {
            DashOverride.show();
        }
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
