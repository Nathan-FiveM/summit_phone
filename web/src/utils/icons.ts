import mailIcon from "../../images/icons/Mail.svg?url";
import walletIcon from "../../images/icons/Wallet.svg?url";
import calculatorIcon from "../../images/icons/Calculator.svg?url";
import appStoreIcon from "../../images/icons/AppStore.svg?url";
import cameraIcon from "../../images/icons/Camera.svg?url";
import photosIcon from "../../images/icons/Gallery.svg?url";
import pigeonIcon from "../../images/icons/Pigeon.svg?url";
import darkChatIcon from "../../images/icons/Darkchat.svg?url";
import garageIcon from "../../images/icons/Garages.svg?url";
import notesIcon from '../../images/icons/Calender.svg?url';
import housingIcon from "../../images/icons/House.svg?url";
import bluePageicon from "../../images/icons/BluePages.svg?url";
import pixieIcon from "../../images/icons/Pixie.svg?url";
import groupsIcon from "../../images/icons/Groups.svg?url";
import phoneIcon from '../../images/icons/Phone.svg?url';
import messageIcon from "../../images/icons/Message.svg?url";
import settingsIcon from "../../images/icons/Settings.svg?url";
import servicesIcon from "../../images/icons/Services.svg?url";
import { link } from "fs";

export const icons = [
    {
        icon: mailIcon,
        name: 'Mail',
        link: 'mail',
        id: 1,
    },
    {
        icon: walletIcon,
        name: 'Wallet',
        link: 'wallet',
        id: 2,
    },
    {
        icon: calculatorIcon,
        name: 'Calculator',
        link: 'calculator',
        id: 3,
    },
    {
        icon: appStoreIcon,
        name: 'App Store',
        link: 'appstore',
        id: 4,
    },
    {
        icon: cameraIcon,
        name: 'Camera',
        link: 'camera',
        id: 5,
    },
    {
        icon: photosIcon,
        name: 'Photos',
        link: 'photos',
        id: 6,
    },
    {
        icon: pigeonIcon,
        name: 'Pigeon',
        link: 'pigeon',
        id: 7,
    },
    {
        icon: darkChatIcon,
        name: 'Dark Chat',
        link: 'darkchat',
        id: 8,
    },
    {
        icon: garageIcon,
        name: 'Garage',
        link: 'garage',
        id: 9,
    },
    {
        icon: notesIcon,
        name: 'Notes',
        link: 'notes',
        id: 10,
    },
    {
        icon: housingIcon,
        name: 'Housing',
        link: 'housing',
        id: 11,
    },
    {
        icon: bluePageicon,
        name: 'Blue page',
        link: 'bluepage',
        id: 12,
    },
    {
        icon: pixieIcon,
        name: 'Pixie',
        link: 'pixie',
        id: 13,
    },
    {
        icon: groupsIcon,
        name: 'Groups',
        link: 'groups',
        id: 14,
    },
    {
        icon: null,
        name: '',
        link: '',
        id: 15,
    },
    {
        icon: null,
        name: '',
        link: '',
        id: 16,
    },
    {
        icon: phoneIcon,
        name: 'Phone',
        link: 'phone',
        id: 17,
    },
    {
        icon: messageIcon,
        name: 'Message',
        link: 'message',
        id: 18,
    },
    {
        icon: settingsIcon,
        name: 'Settings',
        link: 'settings',
        id: 19,
    },
    {
        icon: servicesIcon,
        name: 'Services',
        link: 'services',
        id: 20,
    }
]

export const deleleteIgnoreiconList = [
    'Mail',
    'Calculator',
    'App Store',
    'Camera',
    'Photos',
    'Phone',
    'Message',
    'Settings',
    'Services'
]

export function getIconIdByName(name: string, iconsTable: any[]) {
    return iconsTable.find(icon => icon.name === name)?.id;
}

export function getIconNameById(id: number, iconsTable: any[]) {
    return iconsTable.find(icon => icon.id === id)?.name;
}

export function getIconById(id: number, iconsTable: any[]) {
    return iconsTable.find(icon => icon.id === id)?.icon;
}

export function deleteIconById(id: number, iconsTable: any[]) {
    const updatedIcons = [...iconsTable];
    const index = updatedIcons.findIndex(icon => icon.id === id);
    updatedIcons[index].icon = null;
    updatedIcons[index].name = '';
    return updatedIcons;
}

export function addIconById(id: number, icon: string, name: string, iconsTable: any[]) {
    const updatedIcons = [...iconsTable];
    const index = updatedIcons.findIndex(icon => icon.id === id);
    updatedIcons[index].icon = icon;
    updatedIcons[index].name = name;
    return updatedIcons;
}