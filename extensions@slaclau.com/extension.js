const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {BrightnessSliders, KeyboardSlider, PrivacyMenu} =
    Me.imports.quicksettings;

let screenBrightnessPanelMenu;

const {QuickSettingsGrid} = Me.imports.libs.gnome;

function init() {
    log('Initialize extension');
}

function enable() {
    log('Enable extension');

    features = [];

    features.push(new BrightnessSliders.BrightnessSlidersFeature());
    features.push(new KeyboardSlider.KeyboardSliderFeature());
    features.push(new PrivacyMenu.PrivacyToggleFeature());

    let gridChildren = QuickSettingsGrid.get_children();
    let addIndex;
    for (let index = 0; index < gridChildren.length; index++) {
        if (gridChildren[index]?.constructor?.name == 'NMWiredToggle') {
            addIndex = index - 1;
        }
    }
    loadFeatureAtIndex(1, addIndex);
    loadFeatureAtIndex(0, addIndex);
    for (let index = 0; index < gridChildren.length; index++) {
        if (gridChildren[index]?.constructor?.name == 'RfkillToggle') {
            addIndex = index;
        }
    }
    loadFeatureAtIndex(2, addIndex);
    log('Removing unneeded items');
    removeUnneeded();
    //listItems();
}

function disable() {
    log('Disable extension');

    for (let feature of features) {
        feature.unload();
    }
}
function loadFeatureAtIndex(featureIndex, addIndex) {
    let children = QuickSettingsGrid.get_children();
    let tmp = [];
    let tmp_visible = [];
    for (let index = addIndex + 1; index < children.length; index++) {
        let item = children[index];
        tmp.push(item);
        tmp_visible.push(item.visible);
        QuickSettingsGrid.remove_child(item);
    }
    features[featureIndex].load();
    for (let index = 0; index < tmp.length; index++) {
        let item = tmp[index];
        QuickSettingsGrid.add_child(item);
        item.visible = tmp_visible[index];
    }
}

function listItems() {
    let gridChildren = QuickSettingsGrid.get_children();
    for (let index = 0; index < gridChildren.length; index++) {
        log(gridChildren[index]?.constructor?.name);
    }
}

function removeUnneeded() {
    let children = QuickSettingsGrid.get_children();
    for (let index = 0; index < children.length; index++) {
        let item = children[index];
        if (
            item.constructor?.name == 'BrightnessItem' ||
            item.constructor?.name == 'NightLightToggle'
            //|| item.constructor?.name == "DarkModeToggle"
        ) {
            QuickSettingsGrid.remove_child(item);
        }
    }
}
