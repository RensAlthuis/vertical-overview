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
    openCloseWorkspaceOverview: function () {
        if(global.vertical_overview.activeTrackers['openCloseWorkspaceOverview']) {
            return global.vertical_overview.activeTrackers['openCloseWorkspaceOverview'];
        }

        let swipeTracker = new SwipeTracker.SwipeTracker();
        swipeTracker.connect('begin', Main.overview._gestureBegin.bind(Main.overview));
        swipeTracker.connect('update', Main.overview._gestureUpdate.bind(Main.overview));
        swipeTracker.connect('end', Main.overview._gestureEnd.bind(Main.overview));
        global.vertical_overview.activeTrackers['openCloseWOrkspaceOverview'] = swipeTracker;
        return swipeTracker;
    },

    switchWorkspaceOverview: function () {
        if(global.vertical_overview.activeTrackers['switchWorkspaceOverview']) {
            return global.vertical_overview.activeTrackers['switchWorkspaceOverview'];
        }

        let workspacesDisplay = Main.overview._overview._controls._workspacesDisplay;

        let swipeTracker = new SwipeTracker.SwipeTracker();
        swipeTracker.allowLongSwipes = true;
        swipeTracker.connect('begin', workspacesDisplay._switchWorkspaceBegin.bind(workspacesDisplay));
        swipeTracker.connect('update', workspacesDisplay._switchWorkspaceUpdate.bind(workspacesDisplay));
        swipeTracker.connect('end', workspacesDisplay._switchWorkspaceEnd.bind(workspacesDisplay));

        global.vertical_overview.activeTrackers['switchWorkspaceOverview'] = swipeTracker;
        return swipeTracker;
    },

    switchWorkspace:  function() {
        if(global.vertical_overview.activeTrackers['switchWorkspace']) {
            return global.vertical_overview.activeTrackers['switchWorkspace'];
        }

        let workspaceAnimation = Main.wm._workspaceAnimation;
        let swipeTracker = new SwipeTracker.SwipeTracker();
        swipeTracker.connect('begin', workspaceAnimation._switchWorkspaceBegin.bind(workspaceAnimation));
        swipeTracker.connect('update', workspaceAnimation._switchWorkspaceUpdate.bind(workspaceAnimation));
        swipeTracker.connect('end', workspaceAnimation._switchWorkspaceEnd.bind(workspaceAnimation));
        global.display.bind_property('compositor-modifiers',
            swipeTracker, 'scroll-modifiers',
            GObject.BindingFlags.SYNC_CREATE);

        global.vertical_overview.activeTrackers['switchWorkspace'] = swipeTracker;
        return swipeTracker;
    }
}

function override() {
    global.vertical_overview.activeTrackers = {};
    for(let tracker of trackers) {
        tracker.enabled = false;
    }

    Main.overview._swipeTracker = Functionality.openCloseWorkspaceOverview();
    Main.overview._overview._controls._workspacesDisplay._swipeTracker = Functionality.switchWorkspaceOverview();
    Main.wm._workspaceAnimation._swipeTracker = Functionality.switchWorkspace();

    Functionality.openCloseWorkspaceOverview().connectGesture(
        global.stage,
        GestureType.TOUCHPAD | GestureType.TOUCH,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        Clutter.Orientation.VERTICAL,
        3
    );

    Functionality.switchWorkspaceOverview().connectGesture(
        Main.layoutManager.overviewGroup,
        GestureType.TOUCHPAD | GestureType.SCROLL,
        Shell.ActionMode.OVERVIEW,
        Clutter.Orientation.VERTICAL,
        4
    );

    Functionality.switchWorkspace().connectGesture(
        global.stage,
        GestureType.TOUCHPAD | GestureType.TOUCH,
        Shell.ActionMode.NORMAL,
        Clutter.Orientation.VERTICAL,
        4
    );
}

function reset() {
    for(var key in global.vertical_overview.activeTrackers) {
        global.vertical_overview.activeTrackers[key].destroy();
        delete global.vertical_overview.activeTrackers[key];
    }
    delete global.vertical_overview.activeTrackers;

    for(let tracker of trackers) {
        tracker.enabled = true;
    }

    Main.overview._swipeTracker = trackers[0];
    Main.overview._overview._controls._workspacesDisplay._swipeTracker = trackers[1];
    Main.wm._workspaceAnimation._swipeTracker = trackers[2];
}