import "./sv_exports";
import "./apps/index";
import { Utils } from "./classes/Utils";
import { Settings } from "./apps/Settings/class";
import { Delay, generateUUid, LOGGER } from "@shared/utils";
import { onClientCallback } from "@overextended/ox_lib/server";
import { InvoiceRecurringPayments } from "./apps/Wallet/callbacks";
import { pigeonService } from "./apps/Pigeon/PigeonService";
export let Framework = exports['qb-core'].GetCoreObject();
export const MongoDB = exports['mongoDB'];
export const MySQL = exports.oxmysql;
export const Logger = exports['summit_logs'];

on('QBCore:Server:UpdateObject', () => {
    Framework = exports['qb-core'].GetCoreObject();
});

setImmediate(() => {
    Utils.load();
    Settings.load();
});

onClientCallback('phone:server:shareNumber', async (source: any, comingSource: any) => {
    const sourceX = source;
    const sourceNumber = await Utils.GetPhoneNumberBySource(sourceX);
    const acNumber = await Utils.GetPhoneNumberBySource(comingSource);
    const fullname = await exports['qb-core'].GetPlayerName(sourceX);
    const breakedName = fullname.split(' ');

    if (!sourceNumber || !acNumber) return;
    const contactData = {
        _id: generateUUid(),
        personalNumber: acNumber,
        contactNumber: sourceNumber,
        firstName: breakedName[0],
        lastName: breakedName[1],
        image: await Utils.GetContactAvatarByNumber(sourceNumber, await Utils.GetCitizenIdByPhoneNumber(sourceNumber)),
        ownerId: await Utils.GetCitizenIdByPhoneNumber(acNumber),
        notes: "",
        email: "",
        isFav: false
    }
    const res = await MongoDB.findOne('phone_contacts', { personalNumber: acNumber, contactNumber: sourceNumber });
    if (res) {
        return emitNet("phone:addnotiFication", sourceX, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `Number Already Shared.`,
            app: "settings",
            timeout: 5000,
        }));
    }
    emitNet("phone:addnotiFication", Number(sourceX), JSON.stringify({
        id: generateUUid(),
        title: "Phone",
        description: `You have shared your Phone Number.`,
        app: "settings",
        timeout: 5000,
    }));
    const sendId = generateUUid();
    emitNet('phone:addActionNotification', Number(comingSource), JSON.stringify({
        id: sendId,
        title: "Phone",
        description: `${fullname} wants to share their number with you.`,
        app: "settings",
        icons: {
            "0": {
                icon: "https://cdn.summitrp.gg/uploads/server/phone/cross-circle.svg",
                isServer: true,
                event: "phone:server:addContact",
                args: {}
            },
            "1": {
                icon: "https://cdn.summitrp.gg/uploads/server/phone/tick.svg",
                isServer: true,
                event: "phone:server:addContact",
                args: {
                    contactData,
                    comingSource,
                    fullname,
                }
            }
        }
    }));

});

onNet('phone:server:addContact', async (id: string, data: {
    comingSource: any,
    fullname: string,
    contactData: any,
    id: string
}) => {
    const src = global.source;
    console.log('Adding contact', id, data);
    emitNet("phone:client:removeActionNotification", src, id);
    if (!data.contactData || !data.comingSource || !data.fullname) {
        return;
    }
    await Delay(500);
    emitNet("phone:addnotiFication", src, JSON.stringify({
        id: generateUUid(),
        title: "System",
        description: `Number Saved.`,
        app: "settings",
        timeout: 5000,
    }));
    await MongoDB.insertOne('phone_contacts', data.contactData);
    Logger.AddLog({
        type: 'phone_contacts',
        title: 'Contact Shared',
        message: `${data.fullname} , ${data.contactData.contactNumber} has shared their number with ${data.contactData.personalNumber}`,
        showIdentifiers: false
    });
});

on('summit_phone:server:CronTrigger', async () => {
    console.log('Cron Triggered');
    InvoiceRecurringPayments();
});

RegisterCommand('resetPhonePasscode', async (source: number, args: string[]) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(source);
    if (!citizenId) return;
    Settings.lockPin.set(citizenId, '000000');
    await Delay(1000);
    Settings.SavePlayerSettings(citizenId);
    emitNet('phone:client:setupPhone', source, citizenId);
}, false);

RegisterCommand('verifyPegion', async (source: number, args: string[]) => {
    if (!args[0]) {
        return LOGGER('Please provide a valid email address.');
    }
    const email = args[0];
    const res = await pigeonService.verifyUser(source, email);
    if (res === "success") {
        return LOGGER(`User ${email} has been verified successfully.`);
    } else {
        return LOGGER(`Failed to verify user ${email}. Reason: ${res}`);
    }
}, true);

on('QBCore:Server:OnPlayerUnload', async (src: number) => {
    const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(src);
    if (!citizenId) return;
    await Settings.SavePlayerSettings(citizenId);
    Settings.onPlayerDisconnect(citizenId);
});

on('playerDropped', async () => {
    const src = global.source;
    const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(src);
    if (!citizenId) return;
    await Settings.SavePlayerSettings(citizenId);
    Settings.onPlayerDisconnect(citizenId);
})