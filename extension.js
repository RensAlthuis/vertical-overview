const __DEBUG__ = true;

const { Gio, Meta, Shell, Clutter, GObject} = imports.gi;
const WindowManager = imports.ui.windowManager;
const WorkspacesView = imports.ui.workspacesView;
const OverviewControls = imports.ui.overviewControls;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const Dash = imports.ui.dash;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Util = Self.imports.util;
const OverviewControlsOverrides = Self.imports.overviewControls;
const WorkspacesViewOverrides = Self.imports.workspacesView;
const WorkspaceThumbnailOverrides = Self.imports.workspaceThumbnail;
const SwipeTracker = Self.imports.swipeTracker;
const DashOverride = Self.imports.dash;
const Gestures = Self.imports.gestures;

function init() {
    global.vertical_overview = {};
    global.vertical_overview.GSFunctions = {};
}

function enable() {

    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] Bind settings");
    bindSettings();

    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] starting overrides");
    global.vertical_overview.GSFunctions['ControlsManagerLayout'] = Util.overrideProto(OverviewControls.ControlsManagerLayout.prototype, OverviewControlsOverrides.ControlsManagerLayout);
    global.vertical_overview.GSFunctions['ControlsManager'] = Util.overrideProto(OverviewControls.ControlsManager.prototype, OverviewControlsOverrides.ControlsManager);
    global.vertical_overview.GSFunctions['WorkspacesView'] = Util.overrideProto(WorkspacesView.WorkspacesView.prototype, WorkspacesViewOverrides.WorkspacesView);
    global.vertical_overview.GSFunctions['ThumbnailsBox'] = Util.overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, WorkspaceThumbnailOverrides.ThumbnailsBox);
    global.vertical_overview.GSFunctions['Dash'] = Util.overrideProto(Dash.Dash.prototype, DashOverride.Dash);

    let controlsManager = Main.overview._overview._controls;
    controlsManager._workspacesDisplay.set_clip_to_allocation(true);
    global.vertical_overview._updateID = controlsManager._stateAdjustment.connect("notify::value", OverviewControlsOverrides._updateWorkspacesDisplay.bind(controlsManager));

    //this is the magic function that switches the internal layout to vertical
    global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, true, -1, 1);

    //rebinding keys is necessary because bound functions don't update if the prototype for that function is changed
    rebind_keys(Main.overview._overview._controls);

    DashOverride.override();
    Gestures.override();

    if (__DEBUG__) global.log("[VERTICAL_OVERVIEW] enabled");
}

function disable() {
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] resetting overrides");
    Util.overrideProto(OverviewControls.ControlsManagerLayout.prototype, global.vertical_overview.GSFunctions['ControlsManagerLayout']);
    Util.overrideProto(OverviewControls.ControlsManager.prototype, global.vertical_overview.GSFunctions['ControlsManager']);
    Util.overrideProto(WorkspacesView.WorkspacesView.prototype, global.vertical_overview.GSFunctions['WorkspacesView']);
    Util.overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, global.vertical_overview.GSFunctions['ThumbnailsBox']);

    let controlsManager = Main.overview._overview._controls;
    controlsManager._stateAdjustment.disconnect(global.vertical_overview._updateID);

    Main.overview._overview._controls._workspacesDisplay.set_clip_to_allocation(false);
    rebind_keys(Main.overview._overview._controls);

    DashOverride.reset();
    Gestures.reset();
    global.workspaceManager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);

    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] disabled");
}

function bindSettings() {
    let controlsManager = Main.overview._overview._controls;
    let settings = Util.getSettings('org.gnome.shell.extensions.vertical-overview');
    global.vertical_overview.settings = settings;

    controlsManager.layoutManager.leftOffset = settings.get_int('left-offset');
    settings.connect('changed::left-offset', (v, e) => {
        Main.overview._overview._controls.layoutManager.leftOffset = v.get_int(e);
    });

    controlsManager.layoutManager.rightOffset = settings.get_int('right-offset');
    settings.connect('changed::right-offset', (v, e) => {
        Main.overview._overview._controls.layoutManager.rightOffset = v.get_int(e);
    });

    controlsManager.layoutManager.dashMaxHeightScale = settings.get_int('dash-max-height') / 100.0;
    settings.connect('changed::dash-max-height', (v, e) => {
        controlsManager.layoutManager.dashMaxHeightScale = v.get_int(e) / 100.0;
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