const { Gio, Meta, Shell, Clutter, GObject } = imports.gi;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const SwipeTracker = Self.imports.swipeTracker;

function override() {
    if (global.vertical_overview.gestures_bound !== false) return;

    global.vertical_overview.gestures_bound = true;

    let overview = Main.overview;
    global.vertical_overview.overviewSwipeTracker = overview._swipeTracker;
    global.vertical_overview.overviewSwipeTracker.enabled = false;

    const overviewSwipeTracker = new SwipeTracker.SwipeTracker(
        global.stage,
        Clutter.Orientation.HORIZONTAL,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        { allowDrag: false, allowScroll: false });
    overviewSwipeTracker.connect('begin', overview._gestureBegin.bind(overview));
    overviewSwipeTracker.connect('update', overview._gestureUpdate.bind(overview));
    overviewSwipeTracker.connect('end', overview._gestureEnd.bind(overview));
    Main.overview._swipeTracker = overviewSwipeTracker;

    let workspacesDisplay = Main.overview._overview._controls._workspacesDisplay;
    global.vertical_overview.swipeTracker = workspacesDisplay._swipeTracker;
    global.vertical_overview.swipeTracker.enabled = false;

    const swipeTracker = new SwipeTracker.SwipeTracker(
        Main.layoutManager.overviewGroup,
        Clutter.Orientation.VERTICAL,
        Shell.ActionMode.OVERVIEW,
        { allowDrag: false });
    swipeTracker.allowLongSwipes = true;
    swipeTracker.connect('begin', workspacesDisplay._switchWorkspaceBegin.bind(workspacesDisplay));
    swipeTracker.connect('update', workspacesDisplay._switchWorkspaceUpdate.bind(workspacesDisplay));
    swipeTracker.connect('end', workspacesDisplay._switchWorkspaceEnd.bind(workspacesDisplay));
    workspacesDisplay._swipeTracker = swipeTracker;

    let workspaceAnimation = Main.wm._workspaceAnimation;
    global.vertical_overview.animationSwipeTracker = workspaceAnimation._swipeTracker;
    global.vertical_overview.animationSwipeTracker.enabled = false;

    const swipeTrackerAnimation = new SwipeTracker.SwipeTracker(global.stage,
        Clutter.Orientation.VERTICAL,
        Shell.ActionMode.NORMAL,
        { allowDrag: false });
    swipeTrackerAnimation.connect('begin', workspaceAnimation._switchWorkspaceBegin.bind(workspaceAnimation));
    swipeTrackerAnimation.connect('update', workspaceAnimation._switchWorkspaceUpdate.bind(workspaceAnimation));
    swipeTrackerAnimation.connect('end', workspaceAnimation._switchWorkspaceEnd.bind(workspaceAnimation));
    workspaceAnimation._swipeTracker = swipeTrackerAnimation;

    global.display.bind_property('compositor-modifiers',
        workspaceAnimation._swipeTracker, 'scroll-modifiers',
        GObject.BindingFlags.SYNC_CREATE);

    let appDisplay = Main.overview._overview._controls._appDisplay;
    global.vertical_overview.appDisplaySwipeTracker = appDisplay._swipeTracker;
    global.vertical_overview.appDisplaySwipeTracker.enabled = false;

    const appDisplaySwipeTracker = new SwipeTracker.SwipeTracker(
        appDisplay._scrollView,
        Clutter.Orientation.VERTICAL,
        Shell.ActionMode.OVERVIEW,
        { allowDrag: false });

    appDisplaySwipeTracker.connect('begin', appDisplay._swipeBegin.bind(appDisplay));
    appDisplaySwipeTracker.connect('update', appDisplay._swipeUpdate.bind(appDisplay));
    appDisplaySwipeTracker.connect('end', appDisplay._swipeEnd.bind(appDisplay));

    appDisplay._swipeTracker = appDisplaySwipeTracker;
    appDisplay._swipeTracker.enabled = false;

}

function reset() {
    if (global.vertical_overview.gestures_bound !== true) return;

    global.vertical_overview.gestures_bound = false;

    let workspacesDisplay = Main.overview._overview._controls._workspacesDisplay;
    var swipeTracker = workspacesDisplay._swipeTracker;
    swipeTracker.destroy();
    delete swipeTracker;

    workspacesDisplay._swipeTracker = global.vertical_overview.swipeTracker;
    workspacesDisplay._swipeTracker.enabled = true;

    let appDisplay = Main.overview._overview._controls._appDisplay;
    var appDisplaySwipeTracker = appDisplay._swipeTracker;
    appDisplaySwipeTracker.destroy();
    delete appDisplaySwipeTracker;

    appDisplay._swipeTracker = global.vertical_overview.appDisplaySwipeTracker;
    appDisplay._swipeTracker.enabled = true;

    let workspaceAnimation = Main.wm._workspaceAnimation;
    let animationSwipeTracker = workspaceAnimation._swipeTracker;
    animationSwipeTracker.destroy();
    delete animationSwipeTracker;

    workspaceAnimation._swipeTracker = global.vertical_overview.animationSwipeTracker;
    workspaceAnimation._swipeTracker.enabled = true;

    let overview = Main.overview;
    var overviewSwipeTracker = overview._swipeTracker;

    overviewSwipeTracker.destroy();
    delete overviewSwipeTracker;

    overview._swipeTracker = global.vertical_overview.overviewSwipeTracker;
    overview._swipeTracker.enabled = true;
}
