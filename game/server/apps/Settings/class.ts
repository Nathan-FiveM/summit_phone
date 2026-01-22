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

    private seedFromDoc(doc: any) {
        if (!doc?._id) return;
        const id = doc._id;
        this._id.set(id, id);
        this.background.set(id, doc.background ?? { current: '', wallpapers: [] });
        this.lockscreen.set(id, doc.lockscreen ?? { current: '', wallpapers: [] });
        this.ringtone.set(id, doc.ringtone ?? { current: 'https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3', ringtones: [{ name: 'default', url: 'https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3' }] });
        this.showStartupScreen.set(id, doc.showStartupScreen ?? true);
        this.showNotifications.set(id, doc.showNotifications ?? true);
        this.isLock.set(id, doc.isLock ?? true);
        this.lockPin.set(id, doc.lockPin ?? '');
        this.usePin.set(id, doc.usePin ?? false);
        this.useFaceId.set(id, doc.useFaceId ?? false);
        this.faceIdIdentifier.set(id, doc.faceIdIdentifier ?? id);
        this.darkMailIdAttached.set(id, doc.darkMailIdAttached ?? '');
        this.smrtId.set(id, doc.smrtId ?? '');
        this.smrtPassword.set(id, doc.smrtPassword ?? '');
        this.isFlightMode.set(id, doc.isFlightMode ?? false);
        this.phoneNumber.set(id, doc.phoneNumber ?? '');
        this.pigeonIdAttached.set(id, doc.pigeonIdAttached ?? '');
    }

    public async ensurePlayerSettings(citizenId: string) {
        if (!citizenId) return;
        if (this._id.has(citizenId)) return;

        const doc = await MongoDB.findOne?.('phone_settings', { _id: citizenId });
        if (doc) {
            this.seedFromDoc(doc);
            return;
        }

        this.RegisterNewSettings(citizenId, "");
        await MongoDB.insertOne?.('phone_settings', {
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
    }

    public async load() {
        try {
            // MySQL Adapter logic
            const res: any = await MongoDB.findMany('phone_settings', {});
            for (const data of res) {
                this.seedFromDoc(data);
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
        this.ringtone.set(citizenId, { current: 'https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3', ringtones: [{ name: 'default', url: 'https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3' }] });
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
            await this.ensurePlayerSettings(citizenId);
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
