// This module exports gnome's UI objects
// For make codes simple, All the gnome objects should be getting in here
// You can import gnome object like this
// * gnome object means UI that made by gnome
//
// const {
//    QuickSettingsGrid,
//    QuickSettingsBox
// } = Me.imports.gnome
//

const Main = imports.ui.main;

// Quick Settings
let QuickSettings = Main.panel.statusArea.quickSettings;
let QuickSettingsGrid = QuickSettings.menu._grid;
let QuickSettingsBox = QuickSettings.menu.box;
let QuickSettingsActor = QuickSettings.menu.actor;
let QuickSettingsShutdownMenuBox = QuickSettingsBox.first_child
    ?.get_children()
    ?.find(i => i.constructor?.name == 'SystemItem')
    ?.first_child?.get_children()
    ?.find(i => i.constructor?.name == 'ShutdownItem')?.menu?.box;

// Date Menu
let DateMenu = Main.panel.statusArea.dateMenu;
let DateMenuBox = DateMenu.menu.box;
let DateMenuHolder = DateMenu.menu.box.first_child.first_child;
let DateMenuNotifications = DateMenuHolder.get_children().find(
    item => item.constructor.name == 'CalendarMessageList'
);
let DateMenuMediaControl =
    DateMenuNotifications.last_child.first_child.last_child.first_child;
