const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const ScreenBrightnessPanelMenu = Me.imports.ui.ScreenBrightnessPanelMenu;
const BrightnessSliders = Me.imports.quicksettings.BrightnessSliders

var screenBrightnessPanelMenu;

const { QuickSettingsGrid } = Me.imports.libs.gnome;

function init() {
    log("Initialize extension")
}

function enable() {
	log("Enable extension")

    feature = new BrightnessSliders.BrightnessSlidersFeature();
    feature.load();
    // test();
}

function disable() {
	log("Disable extension")
	
    if (feature) {
        feature.unload();
    }
}

function test() {
    let listButtons = []
    for (const item of QuickSettingsGrid.get_children()){
    	listButtons.push({
        	name: item.constructor?.name,
           	label: item.label || null,
            visible: item.visible
        })
        log(item.constructor?.name);
    }
    this.settings.set_string("list-buttons",JSON.stringify(listButtons))
}
