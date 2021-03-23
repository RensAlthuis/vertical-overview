const _DEBUG_ = true;

const Gi = imports._gi;
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
    global.log("[VERTICAL-OVERVIEW] starting overrides");
    GSFunctions['ControlsManagerLayout'] = overrideProto(OverviewControls.ControlsManagerLayout.prototype, OverviewControlsOverrides.ControlsManagerLayout);
    GSFunctions['ControlsManager'] = overrideProto(OverviewControls.ControlsManager.prototype, OverviewControlsOverrides.ControlsManager);
    GSFunctions['WorkspacesView'] = overrideProto(WorkspacesView.WorkspacesView.prototype, WorkspacesViewOverrides.WorkspacesView);
    GSFunctions['ThumbnailsBox'] = overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, WorkspaceThumbnailOverrides.ThumbnailsBox);

    Main.overview._overview._controls._workspacesDisplay.set_clip_to_allocation(true);
    Main.overview._overview._controls.dash.hide();

    global.log("[VERTICAL_OVERVIEW] enabled");
}

function disable() {
    global.log("[VERTICAL-OVERVIEW] resetting overrides");
    overrideProto(OverviewControls.ControlsManagerLayout.prototype, GSFunctions['ControlsManagerLayout']);
    overrideProto(OverviewControls.ControlsManager.prototype, GSFunctions['ControlsManager']);
    overrideProto(WorkspacesView.WorkspacesView.prototype, GSFunctions['WorkspacesView']);
    overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, GSFunctions['ThumbnailsBox']);

    Main.overview._overview._controls._workspacesDisplay.set_clip_to_allocation(false);
    Main.overview._overview._controls.dash.show();

    global.log("[VERTICAL-OVERVIEW] disabled");
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