import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { MongoDB } from "@server/sv_main";
import { Phones } from "./class";
import { generateUUid } from "@shared/utils";

onClientCallback('summit_phone:server:call', async (source: number, data: string) => {
    const res: {
        number: string,
        _id: string,
    } = JSON.parse(data);
    const targetPlayer = await Utils.GetPlayerFromPhoneNumber(res.number);
    if (!targetPlayer) {
        emitNet('phone:addnotiFication', source, JSON.stringify({
            id: generateUUid(),
            title: 'Service Unavailable',
            description: "Person you are trying to call is not reachable",
            app: 'settings',
            timeout: 2000
        }));
        return false;
    };

    if (Phones.calling.has(targetPlayer.PlayerData.source)) {
        console.log('Player is already calling');
        return false;
    }
    if (Phones.calling.has(source)) {
        console.log('You are already calling');
        return false;
    }

    Phones.isPlayerCalling(source, {
        number: res.number,
        source: source,
        targetSource: targetPlayer.PlayerData.source,
    });

    const targetSource = targetPlayer.PlayerData.source;
    const targetName = targetPlayer.PlayerData.charinfo.firstname + ' ' + targetPlayer.PlayerData.charinfo.lastname;
    const sourceName = await exports['qb-core'].GetPlayerName(source);
    emitNet('phone:addActionNotification', targetSource, JSON.stringify({
        id: res._id,
        title: 'Incoming Call',
        description: `${sourceName} is calling you`,
        app: 'phone',
        icons: {
            "0": {
                icon: "https://cdn.summitrp.gg/uploads/red.svg",
                isServer: true,
                event: 'phone:server:declineCall',
                args: JSON.stringify({
                    targetSource: targetSource,
                    targetName: targetName,
                    sourceName: sourceName,
                    callerSource: source,
                    databaseTableId: res._id,
                })
            },
            "1": {
                icon: "https://cdn.summitrp.gg/uploads/green.svg",
                isServer: true,
                event: 'phone:server:acceptCall',
                args: JSON.stringify({
                    targetSource: targetSource,
                    targetName: targetName,
                    sourceName: sourceName,
                    callerSource: source,
                    databaseTableId: res._id,
                })
            }
        }
    }));

    emitNet('summit_phone:server:addCallinginterface', source, JSON.stringify({
        targetSource: targetSource,
        targetName: targetName,
        sourceName: sourceName,
        callerSource: source,
        databaseTableId: res._id,
    }));
    return true;
});

onClientCallback('summit_phone:server:declineCall', async (source: number, data: string) => {
    const dataX: {
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    } = JSON.parse(data);

    emitNet('phone:client:removeActionNotification', dataX.targetSource, dataX.databaseTableId);
    emitNet('phone:client:removeCallingInterface', dataX.callerSource);
    Phones.calling.delete(dataX.callerSource);
    return true;
});

onClientCallback('summit_phone:server:endCall', async (source: number, data: string) => {
    const dataX: {
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    } = JSON.parse(data);
    const targetCitizenid = await global.exports['qb-core'].GetPlayerCitizenIdBySource(dataX.targetSource);
    const sourceCitizenid = await global.exports['qb-core'].GetPlayerCitizenIdBySource(dataX.callerSource);
    Phones.ongoincall.delete(targetCitizenid);
    Phones.ongoincall.delete(sourceCitizenid);
    emitNet('phone:client:removeAccpetedCallingInterface', dataX.targetSource);
    emitNet('phone:client:removeAccpetedCallingInterface', dataX.callerSource);
    exports['pma-voice'].setPlayerCall(dataX.targetSource, 0)
    exports['pma-voice'].setPlayerCall(dataX.callerSource, 0)
    return true;
});