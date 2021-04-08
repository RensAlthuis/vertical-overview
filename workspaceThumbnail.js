// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported WorkspaceThumbnail, ThumbnailsBox */

const { Clutter, Gio, GLib, GObject, Graphene, Meta, Shell, St } = imports.gi;

const DND = imports.ui.dnd;
const Main = imports.ui.main;
const Background = imports.ui.background;
const Util = imports.misc.util;
const Workspace = imports.ui.workspace;

const NUM_WORKSPACES_THRESHOLD = 2;

// The maximum size of a thumbnail is 5% the width and height of the screen
var MAX_THUMBNAIL_SCALE = 0.05;

var RESCALE_ANIMATION_TIME = 200;
var SLIDE_ANIMATION_TIME = 200;

// When we create workspaces by dragging, we add a "cut" into the top and
// bottom of each workspace so that the user doesn't have to hit the
// placeholder exactly.
var WORKSPACE_CUT_SIZE = 10;

var WORKSPACE_KEEP_ALIVE_TIME = 100;

var MUTTER_SCHEMA = 'org.gnome.mutter';


/*
 * Our overrides are here
 *  - Wallpapers restored from https://github.com/GNOME/gnome-shell/commit/451ba5b03ad714366cb0ce6105cb775f84b051ba
 */

var ThumbnailsBox = {
    _updateShouldShow: function() {
        const shouldShow = true;

        if (this._shouldShow === shouldShow)
            return;

        this._shouldShow = shouldShow;
        this.notify('should-show');
    },

    _activateThumbnailAtPoint: function (stageX, stageY, time) {
        const [_r, _x, y] = this.transform_stage_point(stageX, stageY);

        const thumbnail = this._thumbnails.find(t => y >= t.y && y <= t.y + t.height);
        if (thumbnail)
            thumbnail.activate(time);
    },

    _getPlaceholderTarget: function (index, spacing, rtl) {
        const workspace = this._thumbnails[index];

        let targetY1 = workspace.y - spacing - WORKSPACE_CUT_SIZE;
        let targetY2 = workspace.y + WORKSPACE_CUT_SIZE;

        if (index === 0) {
            targetY1 += spacing + WORKSPACE_CUT_SIZE;
        }

        if (index === this._dropPlaceholderPos) {
            const placeholderHeight = this._dropPlaceholder.get_height() + spacing;
            targetY1 -= placeholderHeight;
        }

        return [targetY1, targetY2];
    },

    _withinWorkspace: function (y, index, rtl) {
        const length = this._thumbnails.length;
        const workspace = this._thumbnails[index];

        let workspaceY1 = workspace.y + WORKSPACE_CUT_SIZE;
        let workspaceY2 = workspace.y + workspace.height - WORKSPACE_CUT_SIZE;

        if (index === length - 1) {
            workspaceY2 += WORKSPACE_CUT_SIZE;
        }

        return y > workspaceY1 && y <= workspaceY2;
    },

     // Draggable target interface
     handleDragOver: function(source, actor, x, y, time) {
        if (!source.metaWindow &&
            (!source.app || !source.app.can_open_new_window()) &&
            (source.app || !source.shellWorkspaceLaunch) &&
            source != Main.xdndHandler)
            return DND.DragMotionResult.CONTINUE;

        const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
        let canCreateWorkspaces = Meta.prefs_get_dynamic_workspaces();
        let spacing = this.get_theme_node().get_length('spacing');

        this._dropWorkspace = -1;
        let placeholderPos = -1;
        let length = this._thumbnails.length;
        for (let i = 0; i < length; i++) {
            const index = rtl ? length - i - 1 : i;

            if (canCreateWorkspaces && source !== Main.xdndHandler) {
                const [targetStart, targetEnd] =
                    this._getPlaceholderTarget(index, spacing, rtl);

                if (y > targetStart && y <= targetEnd) {
                    placeholderPos = index;
                    break;
                }
            }

            if (this._withinWorkspace(y, index, rtl)) {
                this._dropWorkspace = index;
                break;
            }
        }

        if (this._dropPlaceholderPos != placeholderPos) {
            this._dropPlaceholderPos = placeholderPos;
            this.queue_relayout();
        }

        if (this._dropWorkspace != -1)
            return this._thumbnails[this._dropWorkspace].handleDragOverInternal(source, actor, time);
        else if (this._dropPlaceholderPos != -1)
            return source.metaWindow ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.COPY_DROP;
        else
            return DND.DragMotionResult.CONTINUE;
    },

    vfunc_allocate: function(box) {
        this.set_allocation(box);

        if (this._thumbnails.length == 0) // not visible
            return;

        let themeNode = this.get_theme_node();
        box = themeNode.get_content_box(box);


        const portholeWidth = this._porthole.width;
        const portholeHeight = this._porthole.height;
        const ratio = portholeHeight / portholeWidth;

        const width = box.get_width();
        const height = Math.round(width * ratio);

        let vScale = width / portholeWidth;
        let hScale = height / portholeHeight;

        const spacing = themeNode.get_length('spacing');

        let indicatorValue = this._scrollAdjustment.value;
        let indicatorUpperWs = Math.ceil(indicatorValue);
        let indicatorLowerWs = Math.floor(indicatorValue);

        let indicatorLowerY1 = 0;
        let indicatorLowerY2 = 0;
        let indicatorUpperY1 = 0;
        let indicatorUpperY2 = 0;

        if (this._dropPlaceholderPos == -1) {
            this._dropPlaceholder.allocate_preferred_size(
                ...this._dropPlaceholder.get_position());

            Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                this._dropPlaceholder.hide();
            });
        }

        let childBox = new Clutter.ActorBox();
        for (let i = 0; i < this._thumbnails.length; i++) {
            let thumbnail = this._thumbnails[i];

            let y1 = box.x1 + (height + spacing) * i;

            const [placeholderWidth, placeholderHeight] = this._dropPlaceholder.get_preferred_height(-1);
            if (i === this._dropPlaceholderPos) {
                childBox.set_origin(box.x1, y1)
                childBox.set_size(placeholderWidth, placeholderHeight);
                this._dropPlaceholder.allocate(childBox);

                Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                    this._dropPlaceholder.show();
                });
            }

            if(this._dropPlaceholderPos !== -1 && this._dropPlaceholderPos <= i) {
                y1 += placeholderHeight + spacing;
            }

            childBox.set_origin(box.x1, y1);
            childBox.set_size(width, height);
            thumbnail.setScale(vScale, hScale);
            thumbnail.allocate(childBox);

            if (i === indicatorUpperWs) {
                indicatorUpperY1 = childBox.y1;
                indicatorUpperY2 = childBox.y2;
            }
            if (i === indicatorLowerWs) {
                indicatorLowerY1 = childBox.y1;
                indicatorLowerY2 = childBox.y2;
            }
        }

        let indicatorThemeNode = this._indicator.get_theme_node();
        let indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
        let indicatorBottomFullBorder = indicatorThemeNode.get_padding(St.Side.BOTTOM) + indicatorThemeNode.get_border_width(St.Side.BOTTOM);
        let indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT);
        let indicatorRightFullBorder = indicatorThemeNode.get_padding(St.Side.RIGHT) + indicatorThemeNode.get_border_width(St.Side.RIGHT);

        childBox.x1 = box.x1;
        childBox.x2 = box.x1 + width;

        const indicatorY1 = indicatorLowerY1 +
            (indicatorUpperY1 - indicatorLowerY1) * (indicatorValue % 1);
        const indicatorY2 = indicatorLowerY2 +
            (indicatorUpperY2 - indicatorLowerY2) * (indicatorValue % 1);

        childBox.y1 = indicatorY1 - indicatorTopFullBorder;
        childBox.y2 = indicatorY2 + indicatorBottomFullBorder;
        childBox.x1 -= indicatorLeftFullBorder;
        childBox.x2 += indicatorRightFullBorder;
        this._indicator.allocate(childBox);
    }
}

var WorkspaceThumbnail = {
    after__init: function() {
        this._contents.add_actor(this._getBackground().backgroundActor);
    },

    _getBackground: function() {
        if (!this._bgManager)
            this._bgManager = new Background.BackgroundManager({ monitorIndex: Main.layoutManager.primaryIndex,
                                                             container: this._contents,
                                                             vignette: false });
        return this._bgManager;
    },

    syncStacking: function(stackIndices) {
        this._windows.sort((a, b) => {
            let indexA = stackIndices[a.metaWindow.get_stable_sequence()];
            let indexB = stackIndices[b.metaWindow.get_stable_sequence()];
            return indexA - indexB;
        });

        for (let i = 0; i < this._windows.length; i++) {
            let clone = this._windows[i];
            if (i == 0) {
                clone.setStackAbove(this._getBackground().backgroundActor);
            } else {
                let previousClone = this._windows[i - 1];
                clone.setStackAbove(previousClone);
            }
        }
    },

    // Create a clone of a (non-desktop) window and add it to the window list
    _addWindowClone(win) {
        let clone = new WindowClone(win);

        clone.connect('selected', (o, time) => {
            this.activate(time);
        });
        clone.connect('drag-begin', () => {
            Main.overview.beginWindowDrag(clone.metaWindow);
        });
        clone.connect('drag-cancelled', () => {
            Main.overview.cancelledWindowDrag(clone.metaWindow);
        });
        clone.connect('drag-end', () => {
            Main.overview.endWindowDrag(clone.metaWindow);
        });
        clone.connect('destroy', () => {
            this._removeWindowClone(clone.metaWindow);
        });
        this._contents.add_actor(clone);

        if (this._windows.length == 0)
            clone.setStackAbove(this._getBackground().backgroundActor);
        else
            clone.setStackAbove(this._windows[this._windows.length - 1]);

        this._windows.push(clone);

        return clone;
    },

    _onDestroy: function() {
        this.workspaceRemoved();

        if (this._bgManager) {
            this._bgManager.destroy();
            this._bgManager = null;
        }

        this._windows = [];
    },
}



/*
 * The classes below are internals of the original workspaceThumbnails.js,
 * therefore we need to duplicated them.
 */

/* A layout manager that requests size only for primary_actor, but then allocates
   all using a fixed layout */
var PrimaryActorLayout = GObject.registerClass(
class PrimaryActorLayout_ extends Clutter.FixedLayout {
    _init(primaryActor) {
        super._init();
        this.primaryActor = primaryActor;
    }

    vfunc_get_preferred_width(container, forHeight) {
        return this.primaryActor.get_preferred_width(forHeight);
    }

    vfunc_get_preferred_height(container, forWidth) {
        return this.primaryActor.get_preferred_height(forWidth);
    }
});

var WindowClone = GObject.registerClass({
    Signals: {
        'drag-begin': {},
        'drag-cancelled': {},
        'drag-end': {},
        'selected': { param_types: [GObject.TYPE_UINT] },
    },
}, class WindowClone_ extends Clutter.Actor {
    _init(realWindow) {
        let clone = new Clutter.Clone({ source: realWindow });
        super._init({
            layout_manager: new PrimaryActorLayout(clone),
            reactive: true,
        });
        this._delegate = this;

        this.add_child(clone);
        this.realWindow = realWindow;
        this.metaWindow = realWindow.meta_window;

        clone._updateId = this.realWindow.connect('notify::position',
                                                  this._onPositionChanged.bind(this));
        clone._destroyId = this.realWindow.connect('destroy', () => {
            // First destroy the clone and then destroy everything
            // This will ensure that we never see it in the _disconnectSignals loop
            clone.destroy();
            this.destroy();
        });
        this._onPositionChanged();

        this.connect('destroy', this._onDestroy.bind(this));

        this._draggable = DND.makeDraggable(this,
                                            { restoreOnSuccess: true,
                                              dragActorMaxSize: Workspace.WINDOW_DND_SIZE,
                                              dragActorOpacity: Workspace.DRAGGING_WINDOW_OPACITY });
        this._draggable.connect('drag-begin', this._onDragBegin.bind(this));
        this._draggable.connect('drag-cancelled', this._onDragCancelled.bind(this));
        this._draggable.connect('drag-end', this._onDragEnd.bind(this));
        this.inDrag = false;

        let iter = win => {
            let actor = win.get_compositor_private();

            if (!actor)
                return false;
            if (!win.is_attached_dialog())
                return false;

            this._doAddAttachedDialog(win, actor);
            win.foreach_transient(iter);

            return true;
        };
        this.metaWindow.foreach_transient(iter);
    }

    // Find the actor just below us, respecting reparenting done
    // by DND code
    getActualStackAbove() {
        if (this._stackAbove == null)
            return null;

        if (this.inDrag) {
            if (this._stackAbove._delegate)
                return this._stackAbove._delegate.getActualStackAbove();
            else
                return null;
        } else {
            return this._stackAbove;
        }
    }

    setStackAbove(actor) {
        this._stackAbove = actor;

        // Don't apply the new stacking now, it will be applied
        // when dragging ends and window are stacked again
        if (actor.inDrag)
            return;

        let parent = this.get_parent();
        let actualAbove = this.getActualStackAbove();
        if (actualAbove == null)
            parent.set_child_below_sibling(this, null);
        else
            parent.set_child_above_sibling(this, actualAbove);
    }

    addAttachedDialog(win) {
        this._doAddAttachedDialog(win, win.get_compositor_private());
    }

    _doAddAttachedDialog(metaDialog, realDialog) {
        let clone = new Clutter.Clone({ source: realDialog });
        this._updateDialogPosition(realDialog, clone);

        clone._updateId = realDialog.connect('notify::position', dialog => {
            this._updateDialogPosition(dialog, clone);
        });
        clone._destroyId = realDialog.connect('destroy', () => {
            clone.destroy();
        });
        this.add_child(clone);
    }

    _updateDialogPosition(realDialog, cloneDialog) {
        let metaDialog = realDialog.meta_window;
        let dialogRect = metaDialog.get_frame_rect();
        let rect = this.metaWindow.get_frame_rect();

        cloneDialog.set_position(dialogRect.x - rect.x, dialogRect.y - rect.y);
    }

    _onPositionChanged() {
        this.set_position(this.realWindow.x, this.realWindow.y);
    }

    _disconnectSignals() {
        this.get_children().forEach(child => {
            let realWindow = child.source;

            realWindow.disconnect(child._updateId);
            realWindow.disconnect(child._destroyId);
        });
    }

    _onDestroy() {
        this._disconnectSignals();

        this._delegate = null;

        if (this.inDrag) {
            this.emit('drag-end');
            this.inDrag = false;
        }
    }

    vfunc_button_press_event() {
        return Clutter.EVENT_STOP;
    }

    vfunc_button_release_event(buttonEvent) {
        this.emit('selected', buttonEvent.time);

        return Clutter.EVENT_STOP;
    }

    vfunc_touch_event(touchEvent) {
        if (touchEvent.type != Clutter.EventType.TOUCH_END ||
            !global.display.is_pointer_emulating_sequence(touchEvent.sequence))
            return Clutter.EVENT_PROPAGATE;

        this.emit('selected', touchEvent.time);
        return Clutter.EVENT_STOP;
    }

    _onDragBegin(_draggable, _time) {
        this.inDrag = true;
        this.emit('drag-begin');
    }

    _onDragCancelled(_draggable, _time) {
        this.emit('drag-cancelled');
    }

    _onDragEnd(_draggable, _time, _snapback) {
        this.inDrag = false;

        // We may not have a parent if DnD completed successfully, in
        // which case our clone will shortly be destroyed and replaced
        // with a new one on the target workspace.
        let parent = this.get_parent();
        if (parent !== null) {
            if (this._stackAbove == null)
                parent.set_child_below_sibling(this, null);
            else
                parent.set_child_above_sibling(this, this._stackAbove);
        }


        this.emit('drag-end');
    }
});
