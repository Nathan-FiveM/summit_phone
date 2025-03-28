import "./sv_exports";
import "./apps/index";
import { Utils } from "./classes/Utils";
import { Settings } from "./apps/Settings/class";
import { generateUUid, LOGGER } from "@shared/utils";
import { onClientCallback } from "@overextended/ox_lib/server";
import { InvoiceRecurringPayments } from "./apps/Wallet/callbacks";
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
    emitNet("phone:addnotiFication", Number(comingSource), JSON.stringify({
        id: generateUUid(),
        title: "System",
        description: `${fullname} has shared their number with you.`,
        app: "settings",
        timeout: 5000,
    }));
    await MongoDB.insertOne('phone_contacts', contactData);
    Logger.AddLog({
        type: 'phone_contacts',
        title: 'Contact Shared',
        message: `${fullname} , ${sourceNumber} has shared their number with ${acNumber}`,
        showIdentifiers: false
    });
});

on('summit_phone:server:CronTrigger', async () => {
    console.log('Cron Triggered');
    InvoiceRecurringPayments();
});

RegisterCommand('testrecurring', async (source: any, args: any) => {
    InvoiceRecurringPayments();
}, true);