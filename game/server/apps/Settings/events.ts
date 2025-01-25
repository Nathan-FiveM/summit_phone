import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";
import { Settings } from "./class";

/* RegisterCommand('addSettings', async (source: number, args: string[]) => {
    
}, false); */

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
            current: '/images/lockscreenBG.png',
            wallpapers: [],
        },
        ringtone: {
            current: 'default',
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

    return number;
}
exports('GeneratePlayerPhoneNumber', GeneratePlayerPhoneNumber);

on('onResourceStop', async (resource: string) => {
    if (resource === GetCurrentResourceName()) {
        await Settings.save();
    }
});