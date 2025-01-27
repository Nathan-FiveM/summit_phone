import { MongoDB } from "@server/sv_main";
import { LOGGER } from "@shared/utils";

class Contact {
    /* public _id = new Map<string, string>();
    public background = new Map<string, { current: string; wallpapers: string[] }>();
    public ringtone = new Map<string, { current: string; ringtones: string[] }>();
    public showStartupScreen = new Map<string, boolean>();
    public showNotifications = new Map<string, boolean>();
    public isLock = new Map<string, boolean>();
    public lockPin = new Map<string, string>();
    public usePin = new Map<string, boolean>();
    public useFaceId = new Map<string, boolean>();
    public faceIdIdentifier = new Map<string, string>();
    public smrtId = new Map<string, string>();
    public smrtPassword = new Map<string, string>(); */

    public async load() {
        const res: any = await MongoDB.findMany('phone_settings', {});
        /* for (const data of res) {
            this._id.set(data._id, data._id);
            this.background.set(data._id, data.background);
            this.ringtone.set(data._id, data.ringtone);
            this.showStartupScreen.set(data._id, data.showStartupScreen);
            this.showNotifications.set(data._id, data.showNotifications);
            this.isLock.set(data._id, data.isLock);
            this.lockPin.set(data._id, data.lockPin);
            this.usePin.set(data._id, data.usePin);
            this.useFaceId.set(data._id, data.useFaceId);
            this.faceIdIdentifier.set(data._id, data.faceIdIdentifier);
            this.smrtId.set(data._id, data.smrtId);
            this.smrtPassword.set(data._id, data.smrtPassword);
        } */
        LOGGER(`[Settings] Loaded.`);
    }

    public async save() {
        /* for (const [key, value] of this._id) {
            MongoDB.updateMany('phone_settings', { _id: key }, {
                _id: key,
                background: this.background.get(key),
                ringtone: this.ringtone.get(key),
                showStartupScreen: this.showStartupScreen.get(key),
                showNotifications: this.showNotifications.get(key),
                isLock: this.isLock.get(key),
                lockPin: this.lockPin.get(key),
                usePin: this.usePin.get(key),
                useFaceId: this.useFaceId.get(key),
                faceIdIdentifier: this.faceIdIdentifier.get(key),
                smrtId: this.smrtId.get(key),
                smrtPassword: this.smrtPassword.get(key),
            });
        } */
    }
}

export const Contacts = new Contact();