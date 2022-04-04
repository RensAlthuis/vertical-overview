const __DEBUG__ = true;
const { GObject, Gtk, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const Util = Self.imports.util;

const BuilderScope = GObject.registerClass(
	{
		GTypeName: "VerticalOverviewBuilderScope",
		Implements: [Gtk.BuilderScope],
	},
	class BuilderScope extends GObject.Object {
		_init(builder) {
			super._init();
			this.settings = ExtensionUtils.getSettings(
				"org.gnome.shell.extensions.vertical-overview"
			);
			this.gesture_settings = this.settings
				.get_value("gestures")
				.deep_unpack();
			this._builder = builder;
		}

		create_entry(name, widget) {
			let box = new Gtk.Box();
			box.set_property("orientation", Gtk.Orientation.VERTICAL);
			box.set_valign(Gtk.Align.START);

			let label = new Gtk.Label();
			label.set_label(name);
			label.set_halign(Gtk.Align.START);
			box.append(label);

			box.append(widget);

			return box;
		}

		create_combobox(id, name, options, active) {
			let combobox = new Gtk.ComboBoxText();
            combobox.set_name(id + name);
			for (let option of options) {
				combobox.append_text(option);
			}
			combobox.connect("changed", this._updateGesture.bind(this, id));
			if (active !== null) {
				combobox.set_active(active);
			}

			return this.create_entry(name, combobox);
		}

		create_gesture(id, func, dir, mode, type) {
			let gesture = new Gtk.Box();
			gesture.set_spacing(8);

			let separator_0 = new Gtk.Separator({
				orientation: Gtk.Orientation.VERTICAL,
			});
			gesture.append(separator_0);

			//Functionality
			let functionality = this.create_combobox(
                id,
				"Function",
				[
					"Open/close overview",
					"Switch Workspace",
					"Switch Workspace in overview",
				],
				func
			);
			gesture.append(functionality);

			let separator_1 = new Gtk.Separator({
				orientation: Gtk.Orientation.VERTICAL,
			});
			gesture.append(separator_1);

			//Direction
			let direction = this.create_combobox(
                id,
				"Direction",
				["Vertical", "Horizontal"],
				dir
			);

			gesture.append(direction);

			let separator_2 = new Gtk.Separator({
				orientation: Gtk.Orientation.VERTICAL,
			});
			gesture.append(separator_2);

			//Action Mode
			let mode_box = new Gtk.Box();
			mode_box.set_property("orientation", Gtk.Orientation.VERTICAL);

			let mode_normal = new Gtk.CheckButton();
			mode_normal.set_property("label", "Normal");
			mode_box.append(mode_normal);

			let mode_overview = new Gtk.CheckButton();
			mode_overview.set_property("label", "Overview");
			mode_box.append(mode_overview);

			gesture.append(this.create_entry("Mode", mode_box));

			let separator_3 = new Gtk.Separator({
				orientation: Gtk.Orientation.VERTICAL,
			});
			gesture.append(separator_3);

			//Type
			let type_box = new Gtk.Grid();

			let type_touch = new Gtk.CheckButton();
			type_touch.set_property("label", "touch");
			type_box.attach(type_touch, 0, 0, 1, 1);

			let type_touchpad = new Gtk.CheckButton();
			type_touchpad.set_property("label", "touchpad");
			type_box.attach(type_touchpad, 0, 1, 1, 1);

			let type_scroll = new Gtk.CheckButton();
			type_scroll.set_property("label", "scroll");
			type_box.attach(type_scroll, 1, 0, 1, 1);

			let type_drag = new Gtk.CheckButton();
			type_drag.set_property("label", "drag");
			type_box.attach(type_drag, 1, 1, 1, 1);

			gesture.append(this.create_entry("Type", type_box));

			let separator_4 = new Gtk.Separator({
				orientation: Gtk.Orientation.VERTICAL,
			});
			gesture.append(separator_4);

			// Remove Button
			let remove_button = new Gtk.Button();
			remove_button.set_property("label", "x");
			remove_button.set_valign(Gtk.Align.CENTER);
			remove_button.set_halign(Gtk.Align.CENTER);
			gesture.append(this.create_entry("", remove_button));

			let separator_5 = new Gtk.Separator({
				orientation: Gtk.Orientation.VERTICAL,
			});
			gesture.append(separator_5);

			return gesture;
		}

		vfunc_create_closure(builder, handlerName, flags, connectObject) {
			if (flags & Gtk.BuilderClosureFlags.SWAPPED)
				throw new Error('Unsupported template signal flag "swapped"');

			if (typeof this[handlerName] === "undefined")
				throw new Error(`${handlerName} is undefined`);

			return this[handlerName].bind(connectObject || this);
		}

		_onIntValueChanged(value) {
			let current = this.settings.get_int(value.name);
			if (value.value != current) {
				if (__DEBUG__)
					log("value-changed: " + value.name + " -> " + value.value);
				this.settings.set_int(value.name, value.value);
			}
		}

		_onBoolValueChanged(value) {
			let current = this.settings.get_boolean(value.name);
			if (value.active != current) {
				if (__DEBUG__)
					log("value-changed: " + value.name + " -> " + value.active);
				this.settings.set_boolean(value.name, value.active);
			}
		}

		_onNewGesture() {
			let gesture_list = this._builder.get_object("gesture-list");
            let id = this.gesture_settings.length;
			let gesture = this.create_gesture(id);
			gesture_list.append(gesture);

			this.gesture_settings.push([id, 0, 0, "test3", "test4"]);
			let packed = GLib.Variant.new("a(iiiss)", this.gesture_settings);
			this.settings.set_value("gestures", packed);
		}

		_updateGesture(id, gesture) {
			if (__DEBUG__)
                log("gesture_changed");
            log(id);
            log(`${id}Function`);

            this.settings[id] = [
                id,
                this._builder.get_object(`${id}Function`).get_value(),
                0,
                0,
                ''
            ]
		}
	}
);

function init() {}

function buildPrefsWidget() {
	let builder = new Gtk.Builder();

	let scope = new BuilderScope(builder);
	builder.set_scope(scope);
	builder.set_translation_domain("gettext-domain");
	builder.add_from_file(Self.dir.get_path() + "/settings.ui");

	let settings = ExtensionUtils.getSettings(
		"org.gnome.shell.extensions.vertical-overview"
	);

    //set basic values
	for (var key of settings.list_keys()) {
		let obj = builder.get_object(key);
		let value = settings.get_value(key);
		switch (value.get_type_string()) {
			case "i":
				obj.set_property("value", value.get_int32());
				break;
			case "b":
				obj.set_property("active", value.get_boolean());
				break;
		}
	}

    //create gestures
	let gesture_settings = settings.get_value("gestures").deep_unpack();
	let gesture_list = builder.get_object("gesture-list");
	for (let gesture of gesture_settings) {
		gesture_list.append(scope.create_gesture(...gesture));
	}

	return builder.get_object("main_widget");
}
