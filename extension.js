const __DEBUG__ = true;

const Gi = imports._gi;
const { Gio, Meta, Shell } = imports.gi;
const WindowManager = imports.ui.windowManager;
const WorkspacesView = imports.ui.workspacesView;
const OverviewControls = imports.ui.overviewControls;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const OverviewControlsOverrides = Self.imports.overviewControls;
const WorkspacesViewOverrides = Self.imports.workspacesView;
const WorkspaceThumbnailOverrides = Self.imports.workspaceThumbnail;

let GSFunctions = {};

function init() {

}

function enable() {
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] starting overrides");
    GSFunctions['ControlsManagerLayout'] = overrideProto(OverviewControls.ControlsManagerLayout.prototype, OverviewControlsOverrides.ControlsManagerLayout);
    GSFunctions['ControlsManager'] = overrideProto(OverviewControls.ControlsManager.prototype, OverviewControlsOverrides.ControlsManager);
    GSFunctions['WorkspacesView'] = overrideProto(WorkspacesView.WorkspacesView.prototype, WorkspacesViewOverrides.WorkspacesView);
    GSFunctions['ThumbnailsBox'] = overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, WorkspaceThumbnailOverrides.ThumbnailsBox);

    Main.overview._overview._controls._workspacesDisplay.set_clip_to_allocation(true);
    Main.overview._overview._controls.dash.hide();
    rebind_keys(Main.overview._overview._controls);

    if (__DEBUG__) global.log("[VERTICAL_OVERVIEW] enabled");
}

function disable() {
    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] resetting overrides");
    overrideProto(OverviewControls.ControlsManagerLayout.prototype, GSFunctions['ControlsManagerLayout']);
    overrideProto(OverviewControls.ControlsManager.prototype, GSFunctions['ControlsManager']);
    overrideProto(WorkspacesView.WorkspacesView.prototype, GSFunctions['WorkspacesView']);
    overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, GSFunctions['ThumbnailsBox']);

    Main.overview._overview._controls._workspacesDisplay.set_clip_to_allocation(false);
    Main.overview._overview._controls.dash.show();
    rebind_keys(Main.overview._overview._controls);

    if (__DEBUG__) global.log("[VERTICAL-OVERVIEW] disabled");
}

function hookVfunc(proto, symbol, func) {
    proto[Gi.hook_up_vfunc_symbol](symbol, func);
}

function overrideProto(proto, overrides)  {
    backup = {}
    for (var symbol in overrides) {
        backup[symbol] = proto[symbol];
        if(symbol.startsWith('vfunc')){
            hookVfunc(proto, symbol.substr(6), overrides[symbol]);
        } else {
            proto[symbol] = overrides[symbol];
        }
    }
    return backup;
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