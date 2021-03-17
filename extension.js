const _DEBUG_ = true;

const { St, Clutter, Shell, Gio, Meta } = imports.gi;
const Main = imports.ui.main;
const Signals = imports.signals;
const WindowManager = imports.ui.windowManager;
const WorkspacesView = imports.ui.workspacesView;
const OverviewControls = imports.ui.overviewControls;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const VerticalOverview = Self.imports.overview;
const VerticalOverviewControls = Self.imports.overviewControls;

let overviewControls;
let GSFunctions = {};

function init() {

}

function clear(proto) {
    for (var f in proto) {
        try {
            GSFunctions[f] = proto[f];
            proto[f] = (x) => {global.log(f)};
        } catch (e) {
            GSFunctions[f] = null;
        }
    }
}

function enable() {
    global._log = global.log;
    global.log = function (content) { if (_DEBUG_) global._log(content); };

    overviewControls = Main.overview._overview._controls;
    global.window_manager.disconnect(overviewControls._workspacesDisplay._switchWorkspaceId);

    clear_keys();

    Main.overview._overview.remove_child(Main.overview._overview._controls);
    Main.overview._overview._controls = new VerticalOverviewControls.ControlsManager();
    Main.overview._overview.add_child(Main.overview._overview._controls);

    global.log("enabled");
}

function disable() {

    clear_keys();
    Main.overview._overview.remove_child(Main.overview._overview._controls);
    Main.overview._overview._controls.run_dispose();
    Main.overview._overview._controls = overviewControls;
    Main.overview._overview.add_child(overviewControls);
    overviewControls._workspacesDisplay._switchWorkspaceId = 
            global.window_manager.connect('switch-workspace',
                overviewControls._workspacesDisplay._activeWorkspaceChanged.bind(overviewControls._workspacesDisplays));
    bind_keys(overviewControls);

    global.log = global._log;
    global._log = null;
    if (_DEBUG_) global.log("disabled");
}

function clear_keys() {
    Main.wm.removeKeybinding('toggle-application-view');
    Main.wm.removeKeybinding('shift-overview-up');
    Main.wm.removeKeybinding('shift-overview-down');
}

function bind_keys(self) {
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