const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const DDC = Me.imports.services.ddc;
const Timer = Me.imports.services.timer;

const extension = Me.imports.extension;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const QuickSettings = imports.ui.quickSettings;
const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;
const {QuickSettingsGrid} = Me.imports.libs.gnome;

const {Gio, GLib, GObject, St} = imports.gi;
const {BoxLayout, Label} = imports.gi.St;

const {loadInterfaceXML} = imports.misc.fileUtils;

const P_BUS_NAME = 'org.gnome.SettingsDaemon.Power';
const P_OBJECT_PATH = '/org/gnome/SettingsDaemon/Power';

const BrightnessInterface = loadInterfaceXML(
    'org.gnome.SettingsDaemon.Power.Screen'
);
const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(BrightnessInterface);

const C_BUS_NAME = 'org.gnome.SettingsDaemon.Color';
const C_OBJECT_PATH = '/org/gnome/SettingsDaemon/Color';

const ColorInterface = loadInterfaceXML('org.gnome.SettingsDaemon.Color');
const colorInfo = Gio.DBusInterfaceInfo.new_for_xml(ColorInterface);

const COLOR_SCHEMA = 'org.gnome.settings-daemon.plugins.color';

const NightLightInterface = `<node>
  <interface name="org.gnome.SettingsDaemon.Color">
    <property name="NightLightActive" type="b" access="read"/>
    <property name="Temperature" type="d" access="read"/>
  </interface>
</node>`;
const NightLightProxy = Gio.DBusProxy.makeProxyWrapper(NightLightInterface);
const ColorProxy = Gio.DBusProxy.makeProxyWrapper(ColorInterface);

let BrightnessSlidersFeature = class BrightnessSlidersFeature {
    load() {
        log('Loading BrightnessSlidersFeature');
        try {
            this.displays = DDC.getDisplays();
            this.addDisplaySliders(this.displays);
        } catch (error) {
            this.displays = null;
        }
    }

    unload() {
        log('Unloading BrightnessSlidersFeature');
        this.feature.destroy();
    }

    addDisplaySliders(displays) {
        this.feature = new Feature(displays);
    }
};

const BrightnessSlider = GObject.registerClass(
    class BrightnessSlider extends PopupMenu.PopupImageMenuItem {
        _init(bus, name, current, max, master) {
            super._init(name, 'display-brightness-symbolic', {});

            this.bus = bus;
            this.name = name;
            this.current = current;
            this.max = max;
            this.timeout = null;
            this.master = master;
            this.slider = new Slider.Slider(current / max);
            this.slider.connect('notify::value', item => {
                this._setBrightness(item._value);
            });

            this.add(this.slider);
        }

        setValue(value) {
            this.slider.value = value;
        }

        _ratioToBrightness(ratio) {
            return parseInt(ratio * this.max);
        }

        _setBrightness(sliderValue) {
            let brightness = this._ratioToBrightness(sliderValue);
            log(`Setting ${this.name} to ${brightness}`);
            if (this.timeout) {
                Timer.clearTimeout(this.timeout);
            }
            this.timeout = Timer.setTimeout(() => {
                DDC.setDisplayBrightness(this.bus, brightness);
            }, 500);
            this.master.sync();
        }
    }
);

const MasterSlider = GObject.registerClass(
    class MasterSlider extends QuickSettings.QuickSlider {
        _init(displays) {
            super._init({
                iconName: 'display-brightness-symbolic',
            });

            this.setMode = 'init';
            this.pauseSync = false;
            this.syncing = false;
            this.slider.connect('notify::value', item => {
                this._setBrightness(item._value);
            });

            this.menuEnabled = true;
            this.menu.setHeader('display-brightness-symbolic', 'Brightness');
            this.subSliders = [];

            const builtinSlider = new BuiltinSlider(this);
            this.menu.addMenuItem(builtinSlider);
            this.subSliders.push(builtinSlider);
            log('Added built in slider');
            if (displays) {
                for (let display of displays) {
                    log('Found ' + display.name);
                    // Create the slider and associate it with the indicator, being sure to
                    // destroy it along with the indicator
                    this.subSlider = new BrightnessSlider(
                        display.bus,
                        display.name,
                        display.current,
                        display.max,
                        this
                    );
                    this.subSliders.push(this.subSlider);
                    this.menu.addMenuItem(this.subSlider);
                }
            }

            this.menu.addMenuItem(
                new PopupMenu.PopupSeparatorMenuItem('Night light')
            );
            this.nightLightToggle = new NightLightToggle();
            this.menu.addMenuItem(this.nightLightToggle);
            this._proxy = new ColorProxy(
                Gio.DBus.session,
                C_BUS_NAME,
                C_OBJECT_PATH,
                (proxy, error) => {
                    if (error) {
                        log(error.message);
                        return;
                    }
                    this._proxy.connect(
                        'g-properties-changed',
                        this.sync.bind(this)
                    );
                    this.sync();
                }
            );

            this._disableItem = this.menu.addAction('', () => {
                this._proxy.DisabledUntilTomorrow =
                    !this._proxy.DisabledUntilTomorrow;
                this.nightLightToggle._sync();
            });

            const nightLightSlider = new NightLightSlider({
                minimum: 1000,
                maximum: 10000,
                swapAxis: false,
                showAlways: true,
            });
            this.menu.addMenuItem(nightLightSlider);

            this.menu.addMenuItem(
                new PopupMenu.PopupSeparatorMenuItem('Settings')
            );
            this.reloadButton = new PopupMenu.PopupMenuItem('Reload displays');
            this.reloadButton.connect('activate', item => {
                log('Reload');
                extension.disable();
                extension.enable();
            });
            this.menu.addMenuItem(this.reloadButton);
            this.setMode = 'same';
            log('Master slider init');
        }

        setValue(value) {
            this.slider.value = value;
        }

        _setBrightness(sliderValue) {
            if (!this.syncing) {
                this.pauseSync = true;
                if (this.setMode == 'same') {
                    let subSliders = this.subSliders;
                    for (let subSlider of subSliders) {
                        subSlider.setValue(sliderValue);
                    }
                }
                this.pauseSync = false;
            }
        }

        sync() {
            this.syncing = true;
            if (!this.pauseSync) {
                let subSliders = this.subSliders;
                let total = 0;
                for (let subSlider of subSliders) {
                    total += subSlider.slider.value;
                }
                let mean = total / subSliders.length;
                this.setValue(mean);
            } else {
            }
            let disabled = this._proxy.DisabledUntilTomorrow;
            this._disableItem.label.text = disabled
                ? _('Resume')
                : _('Disable Until Tomorrow');
            this.syncing = false;
        }
    }
);

const NightLightToggle = GObject.registerClass(
    class NightLightToggle extends PopupMenu.PopupSwitchMenuItem {
        _init() {
            super._init('Enabled', false, {});

            this._nlsettings = new Gio.Settings({
                schema_id: 'org.gnome.settings-daemon.plugins.color',
            });

            this._nlsettings.bind(
                'night-light-enabled',
                this._switch,
                'state',
                Gio.SettingsBindFlags.DEFAULT
            );
            this._nlsettings.connect('changed::night-light-enabled', () =>
                this._sync()
            );
        }

        _sync() {
            this.setToggleState(
                this._nlsettings.get_boolean('night-light-enabled')
            );
        }
    }
);

const BuiltinSlider = GObject.registerClass(
    class BuiltinSlider extends PopupMenu.PopupImageMenuItem {
        _init(master) {
            super._init('Built in', 'display-brightness-symbolic', {});
            this.master = master;
            this.slider = new Slider.Slider(0);
            this.add(this.slider);
            this._proxy = new BrightnessProxy(
                Gio.DBus.session,
                P_BUS_NAME,
                P_OBJECT_PATH,
                (proxy, error) => {
                    if (error) console.error(error.message);
                    else
                        this._proxy.connect('g-properties-changed', () =>
                            this._sync()
                        );
                    this._sync();
                }
            );

            this._sliderChangedId = this.slider.connect(
                'notify::value',
                this._sliderChanged.bind(this)
            );
            this.slider.accessible_name = _('Brightness');
        }

        _sliderChanged() {
            const percent = this.slider.value * 100;
            this._proxy.Brightness = percent;
        }

        _setBrightness(value) {
            this.slider.block_signal_handler(this._sliderChangedId);
            this.slider.value = value;
            this.slider.unblock_signal_handler(this._sliderChangedId);
        }

        setValue(value) {
            this.slider.value = value;
        }

        _sync() {
            const brightness = this._proxy.Brightness;
            const visible = Number.isInteger(brightness) && brightness >= 0;
            this.visible = visible;
            if (visible) this._setBrightness(this._proxy.Brightness / 100.0);
            this.master.sync();
        }
    }
);

const NightLightSlider = GObject.registerClass(
    class NightLightSlider extends PopupMenu.PopupImageMenuItem {
        _init(options) {
            super._init('', 'night-light-symbolic', {});
            this._options = options;
            this._settings = new Gio.Settings({schema_id: COLOR_SCHEMA});
            this._slider = new Slider.Slider(0);
            this._sync = debounce(this.__sync.bind(this), 500);
            this.add(this._slider);

            this._sliderChangedId = this._slider.connect(
                'notify::value',
                this._sliderChanged.bind(this)
            );
            this._slider.accessible_name = _('Brightness');
            this.connect('destroy', this._onDestroy.bind(this));
            this._settings.connect('changed::night-light-temperature', () =>
                this._sync()
            );
            this._sync();
        }

        _sliderChanged() {
            const {swapAxis, minimum, maximum} = this._options;
            const percent = swapAxis
                ? 1 - this._slider.value
                : this._slider.value;
            const temperature = percent * (maximum - minimum) + minimum;
            log('Setting colour temperature to ' + temperature);

            // Update GSettings
            this._settings.set_uint('night-light-temperature', temperature);
        }

        _changeSlider(value) {
            this._slider.block_signal_handler(this._sliderChangedId);
            this._slider.value = value;
            this._slider.unblock_signal_handler(this._sliderChangedId);
        }

        __sync() {
            const {showAlways, swapAxis, minimum, maximum} = this._options;
            const active = true;

            if (active) {
                const temperature = this._settings.get_uint(
                    'night-light-temperature'
                );
                const percent = (temperature - minimum) / (maximum - minimum);
                log(`temp ${temperature}, min ${minimum}, max ${maximum}`);
                if (swapAxis) this._changeSlider(1 - percent);
                else this._changeSlider(percent);
            }
        }

        _onDestroy() {
            this._slider = null;
        }
    }
);

const Feature = GObject.registerClass(
    class Feature extends QuickSettings.SystemIndicator {
        _init(displays) {
            super._init();
            let children = QuickSettingsGrid.get_children();
            let master = new MasterSlider(displays);
            this.quickSettingsItems.push(master);
            this.connect('destroy', () => {
                this.quickSettingsItems.forEach(item => item.destroy());
            });

            QuickSettingsMenu._addItems(this.quickSettingsItems, 2);
        }
    }
);
function debounce(func, wait, options = {priority: GLib.PRIORITY_DEFAULT}) {
    let sourceId;
    return function (...args) {
        const debouncedFunc = () => {
            sourceId = null;
            func.apply(this, args);
        };

        // It is a programmer error to attempt to remove a non-existent source
        if (sourceId) GLib.Source.remove(sourceId);
        sourceId = GLib.timeout_add(options.priority, wait, debouncedFunc);
    };
}
