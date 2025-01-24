import { onClientCallback } from "@overextended/ox_lib/server";
import { MongoDB } from "@server/sv_main";
import { PhoneMail } from "../../../../types/types";

onClientCallback('GetClientSettings', async (client) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const data = await MongoDB.findOne('phone_settings', { _id: citizenId });
    return JSON.stringify(data);
});

onClientCallback('SetClientSettings', async (client, data: string) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const parsedData = JSON.parse(data);
    await MongoDB.updateOne('phone_settings', { _id: citizenId }, { ...parsedData });
    return true;
});

onClientCallback('RegisterNewMailAccount', async (client, data: string) => {
    const parsedData: {
        email: string;
        password: string;
    } = JSON.parse(data);
    const dataX: PhoneMail = {
        activeMaidId: parsedData.email,
        activeMailPassword: parsedData.password,
        messages: [],
    }
    await MongoDB.insertOne('phone_mail', { _id: parsedData.email, ...dataX });
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
        return true;
    } else {
        return false;
    }
});

onClientCallback('unLockorLockPhone', async (client, data: boolean) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    await MongoDB.updateOne('phone_settings', { _id: citizenId }, { isLock: data });
    return true;
});