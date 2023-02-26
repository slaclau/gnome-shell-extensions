const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension()

const DDC = Me.imports.services.ddc;
const Timer = Me.imports.services.timer;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const QuickSettings = imports.ui.quickSettings;
const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;



const {Gio, GObject, St} = imports.gi;
const {BoxLayout, Label} = imports.gi.St

var BrightnessSlidersFeature = class {
    load() {
    	log("Loading BrightnessSlidersFeature");
        try {
            this.displays =  DDC.getDisplays();

            if (this.displays) {
                this.addDisplaySliders(this.displays);
            } else {
            
            };
        } catch(error) {
            this.displays = null;
        }
        
    }
    
    unload() {
    	log("Unloading BrightnessSlidersFeature");
        this.feature.destroy();
    }
    
    addDisplaySliders(displays) {
        this.feature = new Feature(displays, this);
    }
}

const BrightnessSlider = GObject.registerClass(
class BrightnessSlider extends QuickSettings.QuickSlider {
    _init(bus, name, current, max) {
        super._init({
            iconName: 'display-brightness-symbolic',
        });
        
        this.bus = bus;
        this.name = name;
        this.current = current;
        this.max = max;
        this.timeout = null;

        this.setValue(current / max);
        
        this.slider.connect('notify::value', (item) => {
            this._setBrightness(item._value);
        });
    }
    
    setValue(value) {
        this.slider.value = value;
    }
    
    _ratioToBrightness(ratio) {
        return parseInt(ratio * this.max);
    }

    _setBrightness(sliderValue) {
        if (this.timeout) {
            Timer.clearTimeout(this.timeout);
        }
        this.timeout = Timer.setTimeout(() => {
            var brightness = this._ratioToBrightness(sliderValue);
            DDC.setDisplayBrightness(this.bus, brightness);
        }, 500);
    }
});

const Feature = GObject.registerClass(
class Feature extends QuickSettings.SystemIndicator {
    _init(displays, parent) {
        super._init();
        
        this.quickSettingsItems.push(new FeatureMenuToggle(displays, parent));
        for(var display of displays) {
        	log("Found " + display.name);
        	// Create the slider and associate it with the indicator, being sure to
        	// destroy it along with the indicator
    	    this.slider = new BrightnessSlider(display.bus, display.name, display.current, display.max);
      		this.display_label = new St.Label({ text: display.name });
        
        	this.quickSettingsItems.push(this.display_label);
        	this.quickSettingsItems.push(this.slider);
        }
        
        this.connect('destroy', () => {
            this.quickSettingsItems.forEach(item => item.destroy());
        });
        
        // Add the slider to the menu, this time passing `2` as the second
        // argument to ensure the slider spans both columns of the menu
        QuickSettingsMenu._addItems(this.quickSettingsItems, 2);
        this.defaultBrightness = QuickSettingsMenu._brightness;
        this.defaultBrightness.visible = false;
    }
});

const FeatureMenuToggle = GObject.registerClass(
class FeatureMenuToggle extends QuickSettings.QuickMenuToggle {
    _init(displays, parent) {
        super._init({
            label: 'Monitor brightness',
            iconName: 'display-brightness-symbolic',
            toggleMode: true,
        });
        
        // This function is unique to this class. It adds a nice header with an
        // icon, title and optional subtitle. It's recommended you do so for
        // consistency with other menus.
        this.menu.setHeader('display-brightness-symbolic', 'Monitor brightness',);
        
        this.reloadButton = new PopupMenu.PopupMenuItem('Reload displays');
        this.reloadButton.connect('activate', (item) => {
        	parent.unload();
            parent.load();
        });

        this.menu.addMenuItem(this.reloadButton);

        // Add an entry-point for more settings
        // this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        // const settingsItem = this.menu.addAction('More Settings',
        //     () => ExtensionUtils.openPrefs());
            
        // Ensure the settings are unavailable when the screen is locked
        // settingsItem.visible = Main.sessionMode.allowSettings;
        // this.menu._settingsActions[Me.uuid] = settingsItem;
    }
});