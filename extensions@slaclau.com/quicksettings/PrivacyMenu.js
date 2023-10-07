const {Gio, GObject} = imports.gi;

const QuickSettings = imports.ui.quickSettings;
const PopupMenu = imports.ui.popupMenu;

// This is the live instance of the Quick Settings menu
const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {ExtensionHelper} = Me.imports.libs;

const FeatureIndicator = GObject.registerClass(
    class FeatureIndicator extends QuickSettings.SystemIndicator {
        _init() {
            super._init();

            this.quickSettingsItems.push(new PrivacyMenuToggle());
            this.connect('destroy', () => {
                this.quickSettingsItems.forEach(item => item.destroy());
            });

            // Add the indicator to the panel
            QuickSettingsMenu._indicators.add_child(this);

            QuickSettingsMenu._addItems(this.quickSettingsItems, 1);
        }
    }
);

const PrivacyMenuToggle = GObject.registerClass(
    class PrivacyMenuToggle extends QuickSettings.QuickMenuToggle {
        _init() {
            super._init({
                title: 'Privacy',
                iconName: 'view-private-symbolic',
                toggleMode: true,
            });
            // This function is unique to this class. It adds a nice header with an
            // icon, title and optional subtitle. It's recommended you do so for
            // consistency with other menus.
            this.menu.setHeader('view-private-symbolic', 'Privacy');
            let privacyMenuSection = new PrivacyMenuSection();
            privacyMenuSection.addEntries();
            this.menu.addMenuItem(privacyMenuSection);
        }
    }
);
class PrivacyMenuSection extends PopupMenu.PopupMenuSection {
    createSettingToggle(popupLabel, iconName) {
        //Create sub menu with an icon
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(popupLabel, true);
        subMenu.icon.icon_name = iconName;

        //Add a toggle to the submenu, then return it
        subMenu.menu.addMenuItem(
            new PopupMenu.PopupSwitchMenuItem(_('Enabled'), true, null)
        );
        return subMenu;
    }

    addEntries() {
        this._privacySettings = new Gio.Settings({
            schema: 'org.gnome.desktop.privacy',
        });
        this._locationSettings = new Gio.Settings({
            schema: 'org.gnome.system.location',
        });

        let subMenus = [
            this.createSettingToggle(
                _('Location'),
                'location-services-active-symbolic'
            ),
            this.createSettingToggle(_('Camera'), 'camera-photo-symbolic'),
            this.createSettingToggle(
                _('Microphone'),
                'audio-input-microphone-symbolic'
            ),
        ];

        let gsettingsSchemas = [
            //Schema, key, bind flags
            [this._locationSettings, 'enabled', Gio.SettingsBindFlags.DEFAULT],
            [
                this._privacySettings,
                'disable-camera',
                Gio.SettingsBindFlags.INVERT_BOOLEAN,
            ],
            [
                this._privacySettings,
                'disable-microphone',
                Gio.SettingsBindFlags.INVERT_BOOLEAN,
            ],
        ];
        //Create menu entries for each setting toggle
        subMenus.forEach((subMenu, i) => {
            gsettingsSchemas[i][0].bind(
                gsettingsSchemas[i][1], //GSettings key to bind to
                subMenu.menu.firstMenuItem._switch, //Toggle switch to bind to
                'state', //Property to share
                gsettingsSchemas[i][2] //Binding flags
            );
            //Add each submenu to the main menu
            this.addMenuItem(subMenu);
        });

        //Separator to separate reset option
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        //Create a submenu for the reset option, to prevent a misclick
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(
            _('Reset settings'),
            true
        );
        subMenu.icon.icon_name = 'edit-delete-symbolic';
        subMenu.menu.addAction(
            _('Reset to defaults'),
            ExtensionHelper.resetSettings,
            null
        );

        this.addMenuItem(subMenu);
    }
}

let PrivacyToggleFeature = class {
    constructor() {
        this._indicator = null;
    }

    load() {
        log('Loading PrivacyToggleFeature');
        this._indicator = new FeatureIndicator();
    }

    unload() {
        log('Unloading PrivacyToggleFeature');
        this._indicator.destroy();
        this._indicator = null;
    }
};
