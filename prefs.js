const __DEBUG__ = true;
const { GObject, Gtk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Self = ExtensionUtils.getCurrentExtension();
const Util = Self.imports.util;

const BuilderScope = GObject.registerClass({
    Implements: [Gtk.BuilderScope],
}, class BuilderScope extends GObject.Object {
    _init() {
        super._init()
        this.settings = Util.getSettings('org.gnome.shell.extensions.vertical-overview');
    }

    vfunc_create_closure(builder, handlerName, flags, connectObject) {
        if (flags & Gtk.BuilderClosureFlags.SWAPPED)
            throw new Error('Unsupported template signal flag "swapped"');

        if (typeof this[handlerName] === 'undefined')
            throw new Error(`${handlerName} is undefined`);

        return this[handlerName].bind(connectObject || this);
    }

    _onIntValueChanged(value) {
        let current = this.settings.get_int(value.name);
        if (value.value != current) {
            if (__DEBUG__) log('value-changed: ' + value.name + " -> " + value.value);
            this.settings.set_int(value.name, value.value);
        }
    }
});

function init() { }

function buildPrefsWidget() {

    let builder = new Gtk.Builder();

    builder.set_scope(new BuilderScope());
    builder.set_translation_domain('gettext-domain');
    builder.add_from_file(Self.dir.get_path() + '/settings.ui');

    let settings = Util.getSettings('org.gnome.shell.extensions.vertical-overview');
    for (var key of settings.list_keys()) {
        let obj = builder.get_object(key);
        let value = settings.get_value(key);
        switch (value.get_type_string()) {
            case "i": obj.set_property('value', value.get_int32()); break;
        }
    }

    return builder.get_object('main_widget');
}