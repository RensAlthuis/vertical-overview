const { Gio, Meta, Shell, Clutter, GObject } = imports.gi;
const Main = imports.ui.main;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const SwipeTracker = Self.imports.swipeTracker;
const GestureType = Self.imports.swipeTracker.GestureType;

const USE_3_FINGER_SWIPES = false;

const trackers = [
    Main.overview._swipeTracker,
    Main.overview._overview._controls._workspacesDisplay._swipeTracker,
    Main.wm._workspaceAnimation._swipeTracker,
]

const Functionality = {
    openCloseWorkspaceOverview: (function () {
        let swipeTracker = new SwipeTracker.SwipeTracker();
        swipeTracker.connect('begin', Main.overview._gestureBegin.bind(Main.overview));
        swipeTracker.connect('update', Main.overview._gestureUpdate.bind(Main.overview));
        swipeTracker.connect('end', Main.overview._gestureEnd.bind(Main.overview));
        return swipeTracker;
    })(),

    switchWorkspaceOverview: (function () {
        let workspacesDisplay = Main.overview._overview._controls._workspacesDisplay;

        let swipeTracker = new SwipeTracker.SwipeTracker();
        swipeTracker.allowLongSwipes = true;
        swipeTracker.connect('begin', workspacesDisplay._switchWorkspaceBegin.bind(workspacesDisplay));
        swipeTracker.connect('update', workspacesDisplay._switchWorkspaceUpdate.bind(workspacesDisplay));
        swipeTracker.connect('end', workspacesDisplay._switchWorkspaceEnd.bind(workspacesDisplay));
        return swipeTracker;
    })(),

    switchWorkspace:  (function() {
        let workspaceAnimation = Main.wm._workspaceAnimation;

        let swipeTracker = new SwipeTracker.SwipeTracker();
        swipeTracker.connect('begin', workspaceAnimation._switchWorkspaceBegin.bind(workspaceAnimation));
        swipeTracker.connect('update', workspaceAnimation._switchWorkspaceUpdate.bind(workspaceAnimation));
        swipeTracker.connect('end', workspaceAnimation._switchWorkspaceEnd.bind(workspaceAnimation));
        global.display.bind_property('compositor-modifiers',
            swipeTracker, 'scroll-modifiers',
            GObject.BindingFlags.SYNC_CREATE);

        return swipeTracker;
    })()
}

function override() {
    for(let tracker of trackers) {
        tracker.enabled = false;
    }

    Main.overview._swipeTracker = Functionality.openCloseWorkspaceOverview;
    Main.overview._overview._controls._workspacesDisplay._swipeTracker = Functionality.switchWorkspaceOverview;
    Main.wm._workspaceAnimation._swipeTracker = Functionality.switchWorkspace;

    Functionality.openCloseWorkspaceOverview.connectGesture(
        global.stage,
        GestureType.TOUCHPAD | GestureType.TOUCH,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        Clutter.Orientation.VERTICAL,
        3
    );

    Functionality.switchWorkspaceOverview.connectGesture(
        Main.layoutManager.overviewGroup,
        GestureType.TOUCHPAD,
        Shell.ActionMode.OVERVIEW,
        Clutter.Orientation.VERTICAL,
        4
    );

    Functionality.switchWorkspace.connectGesture(
        global.stage,
        GestureType.TOUCHPAD | GestureType.TOUCH,
        Shell.ActionMode.NORMAL,
        Clutter.Orientation.VERTICAL,
        4
    );
}

function reset() {

    // if (USE_3_FINGER_SWIPES) {
    //     var swipeTracker = Main.overview._swipeTracker;
    //     Main.overview._swipeTracker = global.vertical_overview.swipeTracker;
    //     swipeTracker.destroy();
    //     delete swipeTracker;
    //     Main.overview._swipeTracker.enabled = true;
    // } else {
    //     let workspacesDisplay = Main.overview._overview._controls._workspacesDisplay;
    //     var swipeTracker = workspacesDisplay._swipeTracker;
    //     workspacesDisplay._swipeTracker = global.vertical_overview.swipeTracker;
    //     swipeTracker.destroy();
    //     delete swipeTracker;

    //     let workspaceAnimation = Main.wm._workspaceAnimation;
    //     let animationSwipeTracker = workspaceAnimation._swipeTracker;
    //     animationSwipeTracker.destroy();
    //     delete animationSwipeTracker;

    //     workspaceAnimation._swipeTracker = global.vertical_overview.animationSwipeTracker;
    //     workspaceAnimation._swipeTracker.enabled = true;
    // }

}