import { MongoDB } from "@server/sv_main";
import { generateUUid, LOGGER } from "@shared/utils";
import { Settings } from "./class";

RegisterCommand('saveSettings', async (source: number, args: string[]) => {
    await Settings.save();
}, false);

const generatePhoneNumber = async (): Promise<string> => {
    const number = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const exists = await MongoDB.findOne('phone_numbers', { number: number });
    if (exists) return generatePhoneNumber();
    return number;
};

async function GeneratePlayerPhoneNumber(citizenId: string) {
    const number = await generatePhoneNumber();
    await MongoDB.insertOne('phone_numbers', {
        _id: generateUUid(),
        owner: citizenId,
        number: number,
    });

    await MongoDB.insertOne('phone_settings', {
        _id: citizenId,
        background: {
            current: '',
            wallpapers: [],
        },
        lockscreen: {
            current: '',
            wallpapers: [],
        },
        ringtone: {
            current: '',
            ringtones: [],
        },
        showStartupScreen: true,
        showNotifications: true,
        isLock: true,
        lockPin: '',
        usePin: false,
        useFaceId: false,
        faceIdIdentifier: '',
        smrtId: '',
        smrtPassword: '',
    });

    await MongoDB.insertOne('phone_player_card', {
        _id: citizenId,
        firstName: 'Setup',
        lastName: 'Card',
        phoneNumber: number,
        email: '',
        notes: '',
        avatar: '',
    });

    return number;
}
exports('GeneratePlayerPhoneNumber', GeneratePlayerPhoneNumber);

on('onResourceStop', async (resource: string) => {
    if (resource === GetCurrentResourceName()) {
        try {
            await Settings.save();
            LOGGER(`[Settings] Saved during resource stop.`);
        } catch (error: any) {
            LOGGER(`[Settings] Failed to save during resource stop: ${error.message}`);
        }
    }
});