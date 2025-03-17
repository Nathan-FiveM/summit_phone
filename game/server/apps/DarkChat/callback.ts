import { onClientCallback } from "@overextended/ox_lib/server";
import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";
import { DarkChatChannel } from "../../../../types/types";
import { Utils } from "@server/classes/Utils";

onClientCallback('SearchDarkChatEmail', async (client, data: string) => {
    const res = await MongoDB.findMany('phone_darkchat_mail', { _id: data });
    return JSON.stringify(res);
});

onClientCallback('RegisterNewDarkMailAccount', async (client, data: string) => {
    const { email, password } = JSON.parse(data);
    const res = await MongoDB.insertOne('phone_darkchat_mail', { _id: email, email, password, avatar: "" });
    return true;
});

onClientCallback('LoginDarkMailAccount', async (client, data: string) => {
    const parsedData: {
        email: string;
        password: string;
    } = JSON.parse(data);
    const res = await MongoDB.findOne('phone_darkchat_mail', { _id: parsedData.email });
    if (res.password === parsedData.password) {
        return true;
    } else {
        return false;
    }
});

onClientCallback('CreateNewDarkChannel', async (client, name: string) => {
    // Check If Channel Exists Then Add Player To that Channel or Else Create New Channel
    const player = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const res2: DarkChatChannel[] = await MongoDB.findMany('phone_darkchat_channels', {});
    if (res2.find((channel) => channel.name === name) && !res2.find((channel) => channel.name === name)?.members.includes(player)) {
        res2.find((channel) => channel.name === name)?.members.push(player);
        await MongoDB.updateOne('phone_darkchat_channels', { name }, res2.find((channel) => channel.name === name));
        return JSON.stringify(res2.filter((channel) => channel.members.includes(player)));
    } else if (!res2.find((channel) => channel.name === name)) {
        const newData = {
            _id: generateUUid(),
            name,
            members: [player],
            creator: player,
            createdAt: new Date().toISOString(),
            messages: []
        }
        await MongoDB.insertOne('phone_darkchat_channels', newData);
        res2.push(newData);
        return JSON.stringify(res2.filter((channel) => channel.members.includes(player)));
    } else {
        return false;
    }
});

onClientCallback('GetDarkChatProfile', async (client, email: string) => {
    const res = await MongoDB.findOne('phone_darkchat_mail', { _id: email });
    return JSON.stringify(res);
});

onClientCallback('GetDarkChatChannels', async (client) => {
    const player = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const res = await MongoDB.findMany('phone_darkchat_channels', { members: player });
    return JSON.stringify(res);
});

onClientCallback('RemoveFromDarkChannel', async (client, _id: string) => {
    const player = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const res = await MongoDB.findOne('phone_darkchat_channels', { _id });
    if (res.creator === player) {
        await MongoDB.deleteOne('phone_darkchat_channels', { _id });
    } else {
        res.members = res.members.filter((member: string) => member !== player);
        await MongoDB.updateOne('phone_darkchat_channels', { _id }, res);
    }
    return true;
});

onClientCallback('UpdateDarkAvatar', async (client, data: string) => {
    const { email, avatar } = JSON.parse(data);
    const res = await MongoDB.findOne('phone_darkchat_mail', { _id: email });
    res.avatar = avatar;
    await MongoDB.updateOne('phone_darkchat_mail', { _id: email }, res);
    return true;
});

onClientCallback('UpdateDarkPassword', async (client, data: string) => {
    const { email, password } = JSON.parse(data);
    const res = await MongoDB.findOne('phone_darkchat_mail', { _id: email });
    res.password = password;
    await MongoDB.updateOne('phone_darkchat_mail', { _id: email }, res);
    return true;
});

onClientCallback('SetDarkChatMessages', async (client, dataX: string) => {
    const { channel, data } = JSON.parse(dataX);
    const res = await MongoDB.updateOne('phone_darkchat_channels', { _id: channel }, data);
    data.members.forEach(async (member: string) => {
        const res = await Utils.GetSourceFromCitizenId(member);
        emitNet('summit_phone:client:receiveDarkChatMessage', res, JSON.stringify(data));
        if (res !== client) {
            emitNet('phone:addnotiFication', res, JSON.stringify({
                id: generateUUid(),
                title: 'DarkChat',
                description: `You have a new message in ${data.name}.`,
                app: 'settings',
                timeout: 5000
            }));
        }
    });
    return true;
});