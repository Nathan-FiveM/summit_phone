import { Utils } from "@server/classes/Utils";
import { Phones } from "./class";

onNet('phone:server:declineCall', async (notiId: string, args: any) => {
    const parseData: {
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    } = JSON.parse(args);
    emitNet('phone:client:removeActionNotification', parseData.targetSource, notiId);
    emitNet('phone:client:removeCallingInterface', parseData.callerSource);
    Phones.calling.delete(parseData.callerSource);
});

onNet('phone:server:acceptCall', async (notiId: string, args: any) => {
    const randomCallid = Math.floor(Math.random() * 1000000);
    const source = global.source;
    const parseData: {
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    } = JSON.parse(args);

    const targetCitizenid = await global.exports['qb-core'].GetPlayerCitizenIdBySource(parseData.targetSource);
    const sourceCitizenid = await global.exports['qb-core'].GetPlayerCitizenIdBySource(parseData.callerSource);
    const targetOngoingCall = Phones.ongoincall.get(targetCitizenid);
    const sourceOngoingCall = Phones.ongoincall.get(sourceCitizenid);
    Phones.ongoincall.set(targetCitizenid, [
        ...targetOngoingCall || [],
        {
            citizenId: sourceCitizenid,
            source: parseData.callerSource,
            number: await Utils.GetPhoneNumberByCitizenId(sourceCitizenid),
        }
    ]);

    Phones.ongoincall.set(sourceCitizenid, [
        ...sourceOngoingCall || [],
        {
            citizenId: targetCitizenid,
            source: parseData.targetSource,
            number: await Utils.GetPhoneNumberByCitizenId(targetCitizenid),
        }
    ]);
    Phones.calling.delete(parseData.callerSource);
    emitNet('phone:client:acceptCall', source, args);
    emitNet('phone:client:updateCallerInterface', parseData.callerSource, args);
    emitNet('phone:client:removeActionNotification', source, notiId);
    exports['pma-voice'].setPlayerCall(source, randomCallid)
    exports['pma-voice'].setPlayerCall(parseData.callerSource, randomCallid)
});

on('onResourceStop', async (resource: string) => {
    if (resource === GetCurrentResourceName()) {

    }
});
