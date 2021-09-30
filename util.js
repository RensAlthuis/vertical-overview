const Gi = imports._gi;
const Gio = imports.gi.Gio;
const GioSSS = Gio.SettingsSchemaSource;
const ExtensionUtils = imports.misc.extensionUtils;

const Self = ExtensionUtils.getCurrentExtension();

function hookVfunc(proto, symbol, func) {
    proto[Gi.hook_up_vfunc_symbol](symbol, func);
}

function overrideProto(proto, overrides) {
    const backup = {};

    for (var symbol in overrides) {
        if (symbol.startsWith('after_')) {
            const actualSymbol = symbol.substr('after_'.length);
            const fn = proto[actualSymbol];
            const afterFn = overrides[symbol]
            proto[actualSymbol] = function() {
                const args = Array.prototype.slice.call(arguments);
                const res = fn.apply(this, args);
                afterFn.apply(this, args);
                return res;
            };
            backup[actualSymbol] = fn;
        }
        else {
            backup[symbol] = proto[symbol];
            if (symbol.startsWith('vfunc')) {
                hookVfunc(proto, symbol.substr(6), overrides[symbol]);
            }
            else {
                proto[symbol] = overrides[symbol];
            }
        }
    }
    return backup;
}

function bindSetting(label, callback, executeOnBind = true) {
    let settings = global.vertical_overview.settings;
    if (!settings) {
        settings = global.vertical_overview.settings = {
            object: ExtensionUtils.getSettings('org.gnome.shell.extensions.vertical-overview'),
            signals: {},
            callbacks: {}
        };
    }


    if (settings.signals[label])
        settings.object.disconnect(settings.signals[label]);

    const signal = global.vertical_overview.settings.object.connect('changed::' + label, callback);
    global.vertical_overview.settings.signals[label] = signal;
    settings.callbacks[label] = callback;

    if (executeOnBind) callback(settings.object, label);
    return signal;
}

function unbindSetting(label, callback) {
    let settings = global.vertical_overview.settings;
    if (!settings || !settings.signals[label])
        return;

    if (callback)
        callback(settings.object, label);

    settings.object.disconnect(settings.signals[label]);
    delete settings.signals[label];

    if (settings.callbacks[label]) {
        delete settings.callbacks[label];
    }
}