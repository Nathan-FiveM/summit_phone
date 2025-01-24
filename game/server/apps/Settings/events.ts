import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

const generatePhoneNumber = async (): Promise<string> => {
    const number = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const exists = await MongoDB.findOne('phone_numbers', { number: number });
    if (exists) return generatePhoneNumber();
    return number;
};

emit('phoneSetting:server:registerClientSettings', async (source: number) => {
    const citizenId = global.exports['qb-core'].GetPlayerCitizenIdBySource(source);
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
    });
    await MongoDB.insertOne('phone_number', {
        _id: generateUUid(),
        owner: citizenId,
        number: await generatePhoneNumber(),
    });
});