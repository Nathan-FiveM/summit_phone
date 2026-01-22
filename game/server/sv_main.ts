import "./sv_exports";
import "./apps/index";
import { Utils } from "./classes/Utils";
import { Settings } from "./apps/Settings/class";
import { Delay, generateUUid, LOGGER } from "@shared/utils";
import { onClientCallback } from "@overextended/ox_lib/server";
import { InvoiceRecurringPayments } from "./apps/Wallet/callbacks";
import { pigeonService } from "./apps/Pigeon/PigeonService";
import { MySQLAdapter } from "./classes/MySQLAdapter";
import { FRAMEWORK_RESOURCE } from "../shared/utils"; // adjust path as needed
const resolveFramework = () => {
    const configured = exports[FRAMEWORK_RESOURCE];
    if (typeof configured?.GetCoreObject === "function") {
        try {
            return configured.GetCoreObject();
        } catch {
            // fall through to return configured directly
        }
    }
    if (configured) return configured;

    const qb = exports['qb-core']?.GetCoreObject?.();
    if (qb) return qb;
    if (exports['qb-core']) return exports['qb-core'];

    const qbx = exports['qbx-core'] ?? exports['qbx_core'];
    if (typeof qbx?.GetCoreObject === "function") {
        try {
            return qbx.GetCoreObject();
        } catch {
            // fall through to return qbx directly
        }
    }
    return qbx;
};

export let Framework = resolveFramework();

export const MongoDB = new MySQLAdapter();

export const MySQL = exports.oxmysql;
export const Logger = {
    AddLog: (data: any) => {
        try {
            if (global.exports['qb-smallresources']?.AddLog) {
                global.exports['qb-smallresources'].AddLog(data);
                return;
            }
        } catch (e) { }

        const logMsg = `[${data.type}] ${data.title}: ${data.message}`;
        LOGGER(logMsg);
    }
};

type ExternalMailData = {
    email?: string;
    subject?: string;
    message?: string;
    images?: string[];
};

on('QBCore:Server:UpdateObject', () => {
    Framework = resolveFramework();
});

setImmediate(() => {
    Utils.load();
    Settings.load();
});

onClientCallback('phone:server:shareNumber', async (source: any, comingSource: any) => {
    const sourceX = source;
    const sourceNumber = await Utils.GetPhoneNumberBySource(sourceX);
    const acNumber = await Utils.GetPhoneNumberBySource(comingSource);
    const fullname = await exports[FRAMEWORK_RESOURCE].GetPlayerName(sourceX);
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
                icon: "https://ignis-rp.com/uploads/server/phone/cross-circle.svg",
                isServer: true,
                event: "phone:server:addContact",
                args: {}
            },
            "1": {
                icon: "https://ignis-rp.com/uploads/server/phone/accept.svg",
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
    /* console.log('Adding contact', id, data); */
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
    /* console.log('Cron Triggered'); */
    InvoiceRecurringPayments();
});

RegisterCommand('resetPhonePasscode', async (source: number, args: string[]) => {
    const citizenId = await Utils.GetPlayerCitizenIdBySource(source);
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
    if(!src) return;
    const citizenId = await Utils.GetPlayerCitizenIdBySource(src);
    if (!citizenId) return;
    await Settings.SavePlayerSettings(citizenId);
    Settings.onPlayerDisconnect(citizenId);
});

on('playerDropped', async () => {
    const src = global.source;
    if(!src) return;
    const citizenId = await Utils.GetPlayerCitizenIdBySource(src);
    if (!citizenId) return;
    await Settings.SavePlayerSettings(citizenId);
    Settings.onPlayerDisconnect(citizenId);
})

onNet('ignis_phone:sendNewMail', async (targetSource: number, mailData: ExternalMailData) => {
    const src = Number(targetSource ?? global.source);
    const player = Framework.Functions.GetPlayer(src);
    if (!player) return;

    const citizenId = player.PlayerData.citizenid;
    const emailAddress = await Utils.GetEmailIdByCitizenId(citizenId);
    if (!emailAddress) return;

    await global.exports['summit_phone'].SendMail({
        email: mailData?.email || 'government@summit.rp',
        to: emailAddress,
        subject: mailData?.subject || 'Email is not setup correctly!',
        message: mailData?.message || 'Email is not setup correctly!',
        images: mailData?.images || [],
        source: src
    });
});
