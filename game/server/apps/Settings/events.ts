import { MongoDB, Logger } from "@server/sv_main";
import { generateUUid, LOGGER } from "@shared/utils";
import { Settings } from "./class";
import { triggerClientCallback } from "@overextended/ox_lib/server";

RegisterCommand('saveSettings', async (source: number, args: string[]) => {
    await Settings.save();
}, true);

const generatePhoneNumber = async (): Promise<string> => {
    const number = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const exists = await MongoDB.findOne('phone_numbers', { number: number });
    if (exists) return generatePhoneNumber();
    return number;
};

async function GeneratePlayerPhoneNumber(citizenId: string, source: number | undefined) {
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
            current: 'https://cdn.summitrp.gg/uploads/server/phone/sounds/iPhoneXTrap.mp3',
            ringtones: [
                {
                    name: 'default',
                    url: 'https://cdn.summitrp.gg/uploads/server/phone/sounds/iPhoneXTrap.mp3',
                }
            ],
        },
        showStartupScreen: true,
        showNotifications: true,
        isLock: true,
        lockPin: '',
        usePin: true,
        phoneNumber: number,
        useFaceId: false,
        faceIdIdentifier: citizenId,
        darkMailIdAttached: '',
        pigeonIdAttached: '',
        smrtId: '',
        smrtPassword: '',
        isFlightMode: false,
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
    Settings.RegisterNewSettings(citizenId, number);
	if (source) {
		emitNet('phone:client:setupPhone', source, citizenId);
	}
    Logger.AddLog({
        type: 'phone_settings',
        title: 'Phone Number Generated',
        message: `Phone number ${number} generated for ${citizenId}`,
        showIdentifiers: true,
    });
    return number;
}
exports('GeneratePlayerPhoneNumber', GeneratePlayerPhoneNumber);

on('txAdmin:events:scheduledRestart', async (data: any) => {
    await Settings.save();
    LOGGER(`[Settings] Saved during resource stop.`);
});

on('txAdmin:events:serverShuttingDown', async () => {
    await Settings.save();
    LOGGER(`[Settings] Saved during resource stop.`);
});