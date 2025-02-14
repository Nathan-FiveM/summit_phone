import { Utils } from "@server/classes/Utils";
import { CallsManger } from "./class";

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
    /* Phones.calling.delete(parseData.callerSource); */
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
    /* const targetOngoingCall = Phones.ongoincall.get(targetCitizenid);
    const sourceOngoingCall = Phones.ongoincall.get(sourceCitizenid);
    Phones.ongoincall.set(targetCitizenid, [
        ...targetOngoingCall || [],
        {
            citizenId: sourceCitizenid,
            source: parseData.callerSource,
            number: await Utils.GetPhoneNumberByCitizenId(sourceCitizenid),
            onHold: false,
        }
    ]);

    Phones.ongoincall.set(sourceCitizenid, [
        ...sourceOngoingCall || [],
        {
            citizenId: targetCitizenid,
            source: parseData.targetSource,
            number: await Utils.GetPhoneNumberByCitizenId(targetCitizenid),
            onHold: false,
        }
    ]);
    Phones.calling.delete(parseData.callerSource); */
    emitNet('phone:client:acceptCall', source, args);
    emitNet('phone:client:updateCallerInterface', parseData.callerSource, args);
    emitNet('phone:client:removeActionNotification', source, notiId);
    exports['pma-voice'].setPlayerCall(source, randomCallid)
    exports['pma-voice'].setPlayerCall(parseData.callerSource, randomCallid)
});
// add event to join group call ( get call id and set it to pma)
on('onResourceStop', async (resource: string) => {
    if (resource === GetCurrentResourceName()) {

    }
});

// onplayer drop  remove player from calls and group calls
onNet('phone:server:acceptConferenceCall', async (notiId: string, args: any) => {
    const parseData: {
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    } = JSON.parse(args);
    console.log(parseData);
    const targetCitizenid = await global.exports['qb-core'].GetPlayerCitizenIdBySource(parseData.targetSource);
    const sourceCitizenid = await global.exports['qb-core'].GetPlayerCitizenIdBySource(parseData.callerSource);
    const targetPhone = await Utils.GetPhoneNumberByCitizenId(targetCitizenid);
    const sourcePhone = await Utils.GetPhoneNumberByCitizenId(sourceCitizenid);
    console.log(targetPhone, sourcePhone);
    // Add the new participant to the conference
    /* await Phones.addToConference(sourcePhone, targetPhone); */

    // Notify all participants about the new member
    /* emitNet('phone:client:updateConference', parseData.callerSource, {
        conferenceParticipants: Phones.calling.get(parseData.callerSource)?.conferenceParticipants || [],
    });
    emitNet('phone:client:updateConference', parseData.targetSource, {
        conferenceParticipants: Phones.calling.get(parseData.callerSource)?.conferenceParticipants || [],
    }); */

    // Update the voice chat system to include the new participant
    const randomCallid = Math.floor(Math.random() * 1000000);
    exports['pma-voice'].setPlayerCall(parseData.targetSource, randomCallid);
    exports['pma-voice'].setPlayerCall(parseData.callerSource, randomCallid);

    // Remove the notification
    emitNet('phone:client:removeActionNotification', parseData.targetSource, notiId);
    emitNet('phone:client:updateCallerInterface', parseData.targetSource, JSON.stringify({
        targetSource: parseData.targetSource,
        targetName: "Conference Call",
        sourceName: parseData.sourceName,
        callerSource: parseData.callerSource,
        databaseTableId: parseData.databaseTableId,
    }));
});