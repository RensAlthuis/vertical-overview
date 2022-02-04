const { Clutter, Gio, GLib, GObject, Graphene, Meta, Shell, St } = imports.gi;

const DND = imports.ui.dnd;
const Main = imports.ui.main;
const Background = imports.ui.background;
const Workspace = imports.ui.workspace;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;

const Self = imports.misc.extensionUtils.getCurrentExtension();
const Util = Self.imports.util;

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

function override() {
    global.vertical_overview.GSFunctions['ThumbnailsBox'] = Util.overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, ThumbnailsBoxOverride);
    global.vertical_overview.GSFunctions['WorkspaceThumbnail'] = Util.overrideProto(WorkspaceThumbnail.WorkspaceThumbnail.prototype, WorkspaceThumbnailOverride);
    Main.overview._overview._controls._thumbnailsBox.x_align = Clutter.ActorAlign.FILL;
}

function reset() {
    Util.overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, global.vertical_overview.GSFunctions['ThumbnailsBox']);
    Util.overrideProto(WorkspaceThumbnail.WorkspaceThumbnail.prototype, global.vertical_overview.GSFunctions['WorkspaceThumbnail']);
    Main.overview._overview._controls._thumbnailsBox.x_align = Clutter.ActorAlign.CENTER;
}

function thumbnails_old_style() {
    let thumbnailsBox = Main.overview._overview._controls._thumbnailsBox;
    if (global.vertical_overview.old_style_enabled && global.vertical_overview.default_old_style_enabled) {
        thumbnailsBox.add_style_class_name("vertical-overview");
    } else {
        thumbnailsBox.remove_style_class_name("vertical-overview");
    }
}

var ThumbnailsBoxOverride = {
    after__init: function () {
        // A new ThumbnailsBox is created on secondary monitors every time overview is opened, so apply theme after a new one is created
        if (global.vertical_overview.old_style_enabled && global.vertical_overview.default_old_style_enabled) {
            this.add_style_class_name("vertical-overview");
        }
    },
    
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
        //set top and bottom margin
        box.y1 += 16;
        box.y2 -= 32;
        this.set_allocation(box);

        if (this._thumbnails.length == 0) // not visible
            return;

        let themeNode = this.get_theme_node();
        box = themeNode.get_content_box(box);


        const portholeWidth = this._porthole.width;
        const portholeHeight = this._porthole.height;
        const ratio = portholeHeight / portholeWidth;

        var width = box.get_width();
        var height = Math.round(width * ratio);

        let vScale = width / portholeWidth;
        let hScale = height / portholeHeight;

        var spacing = themeNode.get_length('spacing');

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

        let thumbnails_position = (global.vertical_overview.settings.object.get_int('thumbnails-position') || 1);
        let totalHeight = (height + spacing) * this._thumbnails.length;
        box.y1 = Math.max(0, (box.get_height() - totalHeight) / (100 / thumbnails_position));

        let additionalScale = (box.get_height() < totalHeight) ?  box.get_height() / totalHeight : 1;
        height *= additionalScale;
        width *= additionalScale;
        spacing *= additionalScale;

        let childBox = new Clutter.ActorBox();
        for (let i = 0; i < this._thumbnails.length; i++) {
            let thumbnail = this._thumbnails[i];

            let y1 = box.y1 + (height + spacing) * i;

            const [placeholderWidth, placeholderHeight] = this._dropPlaceholder.get_preferred_height(-1);
            if (i === this._dropPlaceholderPos) {
                childBox.set_origin(box.x1, y1)
                childBox.set_size(placeholderWidth, placeholderHeight);
                this._dropPlaceholder.allocate(childBox);

                Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                    this._dropPlaceholder.show();
                });
            }

            if (this._dropPlaceholderPos !== -1 && this._dropPlaceholderPos <= i) {
                y1 += placeholderHeight + spacing;
            }

            childBox.set_origin(box.x1 + (box.get_width() - width), y1);
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

        childBox.x1 = box.x1 + (box.get_width() - width);
        childBox.x2 = box.x1 + box.get_width();

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

var WorkspaceThumbnailOverride = {
    after__init: function () {
        this._bgManager = new Background.BackgroundManager({
            monitorIndex: this.monitorIndex,
            container: this._viewport,
            vignette: false,
            controlPosition: false,
        });
        this._viewport.set_child_below_sibling(this._bgManager.backgroundActor, null);

        this.connect('destroy', (function () {
            this._bgManager.destroy();
            this._bgManager = null;
        }).bind(this));
    }
}
