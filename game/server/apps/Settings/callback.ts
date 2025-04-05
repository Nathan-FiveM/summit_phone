import { onClientCallback } from "@overextended/ox_lib/server";
import { MongoDB, Logger } from "@server/sv_main";
import { PhoneMail, PhonePlayerCard } from "../../../../types/types";
import { Settings } from "./class";

onClientCallback('GetClientSettings', async (client) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    return JSON.stringify({
        _id: Settings._id.get(citizenId),
        background: Settings.background.get(citizenId),
        lockscreen: Settings.lockscreen.get(citizenId),
        ringtone: Settings.ringtone.get(citizenId),
        showStartupScreen: Settings.showStartupScreen.get(citizenId),
        showNotifications: Settings.showNotifications.get(citizenId),
        isLock: Settings.isLock.get(citizenId),
        lockPin: Settings.lockPin.get(citizenId),
        usePin: Settings.usePin.get(citizenId),
        useFaceId: Settings.useFaceId.get(citizenId),
        faceIdIdentifier: Settings.faceIdIdentifier.get(citizenId),
        smrtId: Settings.smrtId.get(citizenId),
        darkMailIdAttached: Settings.darkMailIdAttached.get(citizenId),
        smrtPassword: Settings.smrtPassword.get(citizenId),
        isFlightMode: Settings.isFlightMode.get(citizenId),
        phoneNumber: Settings.phoneNumber.get(citizenId),
        pigeonIdAttached: Settings.pigeonIdAttached.get(citizenId),
    });
});

onClientCallback('SetClientSettings', async (client, data: string) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const parsedData: {
        background: { current: string; wallpapers: string[] };
        lockscreen: { current: string; wallpapers: string[] };
        ringtone: { current: string; ringtones: { name: string, url: string }[] };
        showStartupScreen: boolean;
        showNotifications: boolean;
        isLock: boolean;
        lockPin: string;
        usePin: boolean;
        useFaceId: boolean;
        faceIdIdentifier: string;
        smrtId: string;
        darkMailIdAttached: string;
        smrtPassword: string;
        isFlightMode: boolean;
        phoneNumber: string;
        pigeonIdAttached: string;
    } = JSON.parse(data);
    Settings.background.set(citizenId, parsedData.background);
    Settings.lockscreen.set(citizenId, parsedData.lockscreen);
    Settings.ringtone.set(citizenId, parsedData.ringtone);
    Settings.showStartupScreen.set(citizenId, parsedData.showStartupScreen);
    Settings.showNotifications.set(citizenId, parsedData.showNotifications);
    Settings.isLock.set(citizenId, parsedData.isLock);
    Settings.lockPin.set(citizenId, parsedData.lockPin);
    Settings.usePin.set(citizenId, parsedData.usePin);
    Settings.useFaceId.set(citizenId, parsedData.useFaceId);
    Settings.faceIdIdentifier.set(citizenId, parsedData.faceIdIdentifier);
    Settings.smrtId.set(citizenId, parsedData.smrtId);
    Settings.smrtPassword.set(citizenId, parsedData.smrtPassword);
    Settings.isFlightMode.set(citizenId, parsedData.isFlightMode);
    Settings.darkMailIdAttached.set(citizenId, parsedData.darkMailIdAttached);
    Settings.phoneNumber.set(citizenId, parsedData.phoneNumber);
    Settings.pigeonIdAttached.set(citizenId, parsedData.pigeonIdAttached);
    await Settings.SavePlayerSettings(citizenId);
    Logger.AddLog({
        type: 'phone_settings',
        title: 'Settings Updated',
        message: `${citizenId} | Name: ${global.exports['qb-core'].GetPlayerName(client)} new settings, ${JSON.stringify(parsedData)}`,
        showIdentifiers: false
    });
    return true;
});

onClientCallback('RegisterNewMailAccount', async (client, data: string) => {
    const parsedData: {
        email: string;
        password: string;
    } = JSON.parse(data);
    const dataX: PhoneMail = {
        activeMaidId: parsedData.email,
        username: parsedData.email,
        activeMailPassword: parsedData.password,
        avator: '',
        messages: [],
    }
    await MongoDB.insertOne('phone_mail', { _id: parsedData.email, ...dataX });
    Logger.AddLog({
        type: 'phone_email',
        title: 'Email Account Registered',
        message: `New email account registered with email ${parsedData.email}, password "${parsedData.password}", CitizenId: ${await global.exports['qb-core'].GetPlayerCitizenIdBySource(client)}, Name: ${global.exports['qb-core'].GetPlayerName(client)}`,
        showIdentifiers: true
    });
    return true;
});

onClientCallback('SearchEmail', async (client, data: string) => {
    const res = await MongoDB.findMany('phone_mail', { _id: data });
    return JSON.stringify(res);
});

onClientCallback('LoginMailAccount', async (client, data: string) => {
    const parsedData: {
        email: string;
        password: string;
    } = JSON.parse(data);
    const res = await MongoDB.findOne('phone_mail', { _id: parsedData.email });
    if (res.activeMailPassword === parsedData.password) {
        Logger.AddLog({
            type: 'phone_email',
            title: 'Email Login',
            message: `${global.exports['qb-core'].GetPlayerCitizenIdBySource(client)} Name: ${global.exports['qb-core'].GetPlayerName(client)} logged in to email account ${parsedData.email}, password "${parsedData.password}"`,
            showIdentifiers: false
        });
        return true;
    } else {
        return false;
    }
});

onClientCallback('unLockorLockPhone', async (client, data: boolean) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    Settings.isLock.set(citizenId, data);
    return true;
});

onClientCallback('getPhonePlayerCard', async (client) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const res = await MongoDB.findOne('phone_player_card', { _id: citizenId });
    return JSON.stringify(res);
});

onClientCallback('phone:updatePersonalCard', async (client, data: string) => {
    const parsedData: PhonePlayerCard = JSON.parse(data);
    await MongoDB.updateOne('phone_player_card', { _id: parsedData._id }, parsedData);
    Logger.AddLog({
        type: 'phone_personal_card',
        title: 'Personal Card Updated',
        message: `${parsedData._id} | Name: ${global.exports['qb-core'].GetPlayerName(client)} updated personal card, ${JSON.stringify(parsedData)}`,
        showIdentifiers: false
    });
    return true;
});