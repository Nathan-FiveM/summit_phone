import { MongoDB } from "@server/sv_main";
import { Delay, LOGGER } from "@shared/utils";

class Setting {
    public _id = new Map<string, string>();
    public background = new Map<string, { current: string; wallpapers: string[] }>();
    public lockscreen = new Map<string, { current: string; wallpapers: string[] }>();
    public ringtone = new Map<string, { current: string; ringtones: { name: string, url: string }[] }>();
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
    public phoneNumber = new Map<string, string>();
    public darkMailIdAttached = new Map<string, string>();
    public pigeonIdAttached = new Map<string, string>();
    // No automatic cleanup - only remove on player disconnect

    public async load() {
        try {
            let isDBConnected = exports['mongoDB'].isDBConnected();
            while (isDBConnected === false) {
                await Delay(1000);
                isDBConnected = exports['mongoDB'].isDBConnected();
                if (isDBConnected) {
                    LOGGER("[Settings] MongoDB connected.");
                    break;
                }
                console.log("[Settings] Waiting for MongoDB connection...");
            }
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
                this.darkMailIdAttached.set(data._id, data.darkMailIdAttached);
                this.smrtId.set(data._id, data.smrtId);
                this.smrtPassword.set(data._id, data.smrtPassword);
                this.isFlightMode.set(data._id, data.isFlightMode);
                this.phoneNumber.set(data._id, data.phoneNumber);
                this.pigeonIdAttached.set(data._id, data.pigeonIdAttached);
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
                    darkMailIdAttached: this.darkMailIdAttached.get(key),
                    smrtId: this.smrtId.get(key),
                    smrtPassword: this.smrtPassword.get(key),
                    isFlightMode: this.isFlightMode.get(key),
                    phoneNumber: this.phoneNumber.get(key),
                    pigeonIdAttached: this.pigeonIdAttached.get(key),
                });
            }
            LOGGER(`[Settings] Saved successfully.`);
            return true;
        } catch (error: any) {
            LOGGER(`[Settings] Failed to save settings: ${error.message}`);
            return false;
        }
    }

    public RegisterNewSettings(citizenId: string, number: string) {
        this._id.set(citizenId, citizenId);
        this.background.set(citizenId, { current: '', wallpapers: [] });
        this.lockscreen.set(citizenId, { current: '', wallpapers: [] });
        this.ringtone.set(citizenId, { current: 'https://cdn.summitrp.gg/uploads/server/phone/sounds/iPhoneXTrap.mp3', ringtones: [{ name: 'default', url: 'https://cdn.summitrp.gg/uploads/server/phone/sounds/iPhoneXTrap.mp3' }] });
        this.showStartupScreen.set(citizenId, true);
        this.showNotifications.set(citizenId, true);
        this.isLock.set(citizenId, true);
        this.lockPin.set(citizenId, '');
        this.usePin.set(citizenId, false);
        this.phoneNumber.set(citizenId, number);
        this.useFaceId.set(citizenId, false);
        this.faceIdIdentifier.set(citizenId, citizenId);
        this.darkMailIdAttached.set(citizenId, '');
        this.smrtId.set(citizenId, '');
        this.smrtPassword.set(citizenId, '');
        this.isFlightMode.set(citizenId, false);
        this.pigeonIdAttached.set(citizenId, '');
    }

    public async SavePlayerSettings(citizenId: string) {
        try {
            await MongoDB.updateOne('phone_settings', { _id: citizenId }, {
                _id: citizenId,
                background: this.background.get(citizenId),
                lockscreen: this.lockscreen.get(citizenId),
                ringtone: this.ringtone.get(citizenId),
                showStartupScreen: this.showStartupScreen.get(citizenId),
                showNotifications: this.showNotifications.get(citizenId),
                isLock: this.isLock.get(citizenId),
                lockPin: this.lockPin.get(citizenId),
                usePin: this.usePin.get(citizenId),
                useFaceId: this.useFaceId.get(citizenId),
                faceIdIdentifier: this.faceIdIdentifier.get(citizenId),
                darkMailIdAttached: this.darkMailIdAttached.get(citizenId),
                smrtId: this.smrtId.get(citizenId),
                smrtPassword: this.smrtPassword.get(citizenId),
                isFlightMode: this.isFlightMode.get(citizenId),
                phoneNumber: this.phoneNumber.get(citizenId),
                pigeonIdAttached: this.pigeonIdAttached.get(citizenId),
            });
            LOGGER(`[Settings] Saved player settings for ${citizenId} successfully.`);
            return true;
        } catch (error: any) {
            LOGGER(`[Settings] Failed to save player settings for ${citizenId}: ${error.message}`);
            return false;
        }
    }

    // Remove player data only when player disconnects
    public onPlayerDisconnect(citizenId: string) {
        this.removePlayerData(citizenId);
        LOGGER(`[Settings] Cleaned up data for disconnected player ${citizenId}`);
    }

    // Remove player data from all maps
    private removePlayerData(citizenId: string) {
        this._id.delete(citizenId);
        this.background.delete(citizenId);
        this.lockscreen.delete(citizenId);
        this.ringtone.delete(citizenId);
        this.showStartupScreen.delete(citizenId);
        this.showNotifications.delete(citizenId);
        this.isLock.delete(citizenId);
        this.lockPin.delete(citizenId);
        this.usePin.delete(citizenId);
        this.useFaceId.delete(citizenId);
        this.faceIdIdentifier.delete(citizenId);
        this.smrtId.delete(citizenId);
        this.smrtPassword.delete(citizenId);
        this.isFlightMode.delete(citizenId);
        this.phoneNumber.delete(citizenId);
        this.darkMailIdAttached.delete(citizenId);
        this.pigeonIdAttached.delete(citizenId);
    }

    // Public method to manually clean up a specific player (for admin commands)
    public cleanupPlayer(citizenId: string) {
        this.removePlayerData(citizenId);
        LOGGER(`[Settings] Manually cleaned up data for player ${citizenId}`);
    }
}

export const Settings = new Setting();