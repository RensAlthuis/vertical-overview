const { Gio, Meta, Shell, Clutter, GObject } = imports.gi;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const SwipeTracker = Self.imports.swipeTracker;

const USE_3_FINGER_SWIPES = false;

function override() {
    if (USE_3_FINGER_SWIPES) {
        global.vertical_overview.swipeTracker = Main.overview._swipeTracker;
        global.vertical_overview.swipeTracker.enabled = false;

        const swipeTracker = new SwipeTracker.SwipeTracker(global.stage,
            Clutter.Orientation.VERTICAL,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            { allowDrag: false, allowScroll: false });
        swipeTracker.connect('begin', Main.overview._gestureBegin.bind(Main.overview));
        swipeTracker.connect('update', Main.overview._gestureUpdate.bind(Main.overview));
        swipeTracker.connect('end', Main.overview._gestureEnd.bind(Main.overview));
        Main.overview._swipeTracker = swipeTracker;
    } else {
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

    }
}

function reset() {

    if (USE_3_FINGER_SWIPES) {
        var swipeTracker = Main.overview._swipeTracker;
        Main.overview._swipeTracker = global.vertical_overview.swipeTracker;
        swipeTracker.destroy();
        delete swipeTracker;
        Main.overview._swipeTracker.enabled = true;
    } else {
        let workspacesDisplay = Main.overview._overview._controls._workspacesDisplay;
        var swipeTracker = workspacesDisplay._swipeTracker;
        workspacesDisplay._swipeTracker = global.vertical_overview.swipeTracker;
        swipeTracker.destroy();
        delete swipeTracker;

        let workspaceAnimation = Main.wm._workspaceAnimation;
        let animationSwipeTracker = workspaceAnimation._swipeTracker;
        animationSwipeTracker.destroy();
        delete animationSwipeTracker;

        workspaceAnimation._swipeTracker = global.vertical_overview.animationSwipeTracker;
        workspaceAnimation._swipeTracker.enabled = true;
    }

}