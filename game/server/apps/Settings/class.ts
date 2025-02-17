import { MongoDB } from "@server/sv_main";
import { LOGGER } from "@shared/utils";

class Setting {
    public _id = new Map<string, string>();
    public background = new Map<string, { current: string; wallpapers: string[] }>();
    public lockscreen = new Map<string, { current: string; wallpapers: string[] }>();
    public ringtone = new Map<string, { current: string; ringtones: string[] }>();
    public showStartupScreen = new Map<string, boolean>();
    public showNotifications = new Map<string, boolean>();
    public isLock = new Map<string, boolean>();
    public lockPin = new Map<string, string>();
    public usePin = new Map<string, boolean>();
    public useFaceId = new Map<string, boolean>();
    public faceIdIdentifier = new Map<string, string>();
    public smrtId = new Map<string, string>();
    public smrtPassword = new Map<string, string>();
    public isFlightMode = new Map<string, boolean>();

    public async load() {
        try {
            const res: any = await MongoDB.findMany('phone_settings', {});
            for (const data of res) {
                this._id.set(data._id, data._id);
                this.background.set(data._id, data.background);
                this.lockscreen.set(data._id, data.lockscreen);
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
                this.isFlightMode.set(data._id, data.isFlightMode);
            }
            LOGGER(`[Settings] Loaded.`);
        } catch (error: any) {
            LOGGER(`[Settings] Failed to load settings: ${error.message}`);
        }
    }

    public async save() {
        try {
            for (const [key, value] of this._id) {
                await MongoDB.updateOne('phone_settings', { _id: key }, {
                    _id: key,
                    background: this.background.get(key),
                    lockscreen: this.lockscreen.get(key),
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
                    isFlightMode: this.isFlightMode.get(key),
                });
            }
            LOGGER(`[Settings] Saved successfully.`);
            return true;
        } catch (error: any) {
            LOGGER(`[Settings] Failed to save settings: ${error.message}`);
            return false;
        }
    }
}

export const Settings = new Setting();