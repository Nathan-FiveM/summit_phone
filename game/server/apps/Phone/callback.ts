import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { callManager } from "./CallManager";
import { generateUUid } from "@shared/utils";
import { MongoDB } from "@server/sv_main";
import { PhoneContacts } from "../../../../types/types";
import { callHistoryManager } from "./callHistoryManager";
import { Settings } from "../Settings/class";

onClientCallback("summit_phone:server:call", async (source: number, data: string) => {
  const { number, _id } = JSON.parse(data);
  const targetPlayer = await Utils.GetPlayerFromPhoneNumber(number);
  const targetData: PhoneContacts = await MongoDB.findOne('phone_contacts', { _id });
  const sourceData: PhoneContacts = await MongoDB.findOne('phone_contacts', {
    contactNumber: await Utils.GetPhoneNumberBySource(source),
    personalNumber: number
  });

  if (!targetPlayer) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }

  const targetSource = targetPlayer.PlayerData.source;

  if (callManager.isPlayerInCall(source)) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Call Error",
      description: "You are already in a call",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }
  
  if (callManager.isPlayerInCall(targetSource)) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Call Busy",
      description: "Target is already in a call",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }

  const sourcePhone = await Utils.GetPhoneNumberBySource(source);
  const targetPhone = await Utils.GetPhoneNumberBySource(targetSource);
  const sourceCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(source);
  const targetCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(targetSource);
  const IsNumberBlocked = await Utils.IsNumberBlocked(targetPhone, sourcePhone);
  const sourceFlightMode = await Utils.InFlightMode(sourceCitizenId);
  const targetFlightMode = await Utils.InFlightMode(targetCitizenId);
  if (sourceFlightMode) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Flight Mode",
      description: "You cannot make calls while in flight mode",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  } else if (targetFlightMode) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is unreachable",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }
  if (IsNumberBlocked) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }
  const ShourceNumberBlocked = await Utils.IsNumberBlocked(sourcePhone, targetPhone);
  if (ShourceNumberBlocked) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Number Blocked",
      description: "Unblock the number to call",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }
  const targetHasPhone = await Utils.HasPhone(targetSource);
  if (!targetHasPhone) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }
  const hostParticipant = {
    source,
    citizenId: sourceCitizenId,
    phoneNumber: sourcePhone,
    onHold: false,
  };

  const callId = callManager.createCall(hostParticipant);

  callManager.createRingTone(targetSource, String(Settings.ringtone.get(targetCitizenId)?.current));
  callManager.addPendingInvitation(callId, targetSource, () => {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Call Timeout",
      description: "Call was not answered by target",
      app: "settings",
      timeout: 2000,
    }));
    emitNet("phone:addnotiFication", targetSource, JSON.stringify({
      id: generateUUid(),
      title: "Missed Call",
      description: "You missed a call",
      app: "settings",
      timeout: 2000,
    }));
    (async () => {
      const call = callManager.getCallByPlayer(source);
      if (call) {
        await callHistoryManager.recordTwoPartyCallHistory(call, "unanswered", "missed", new Date(), targetPhone);
      }
      callManager.endCall(callId);
      callManager.stopRingTone(targetSource);
    })();
    exports["pma-voice"].setPlayerCall(source, 0);
    exports["pma-voice"].setPlayerCall(targetSource, 0);
    emitNet("phone:client:removeActionNotification", targetSource, _id);
    emitNet("phone:client:removeCallingInterface", source);
  }, 20000);

  const sourceName = sourceData
    ? `${sourceData.firstName} ${sourceData.lastName}`
    : await Utils.GetPhoneNumberBySource(source);
  const targetName = targetData ? `${targetData.firstName} ${targetData.lastName}` : number;

  emitNet("phone:addActionNotification", targetSource, JSON.stringify({
    id: _id,
    title: "Incoming Call",
    description: `${sourceName} is calling you`,
    app: "phone",
    icons: {
      "0": {
        icon: "https://cdn.summitrp.gg/uploads/red.svg",
        isServer: true,
        event: "phone:server:declineCall",
        args: JSON.stringify({
          callId,
          targetSource,
          sourceName,
          targetName,
          callerSource: source,
          databaseTableId: _id,
        }),
      },
      "1": {
        icon: "https://cdn.summitrp.gg/uploads/green.svg",
        isServer: true,
        event: "phone:server:acceptCall",
        args: JSON.stringify({
          callId,
          targetSource,
          sourceName: targetName,
          targetName: sourceName,
          callerSource: source,
          databaseTableId: _id,
        }),
      },
    },
  }));

  emitNet("summit_phone:server:addCallinginterface", source, JSON.stringify({
    callId,
    targetSource,
    targetName,
    callerSource: source,
    databaseTableId: _id,
  }));

  return true;
});

onClientCallback("summit_phone:server:declineCall", async (source: number, data: string) => {
  const { callId, targetSource, callerSource, databaseTableId } = JSON.parse(data);
  callManager.declineInvitation(callId, targetSource);
  const call = callManager.getCallByPlayer(callerSource);
  if (call) {
    await callHistoryManager.recordTwoPartyCallHistory(call, "declined", "declined", new Date());
  }
  callManager.endCall(callId);
  callManager.stopRingTone(targetSource);
  emitNet("phone:client:removeActionNotification", targetSource, databaseTableId);
  emitNet("phone:client:removeCallingInterface", callerSource);
  return true;
});

onClientCallback("summit_phone:server:endCall", async (source: number, data: string) => {
  const { callId } = JSON.parse(data);
  const call = callManager.getCallByPlayer(source);
  if (!call || call.callId !== callId) return false;
  const callHost = callManager.getCallHost(callId);
  if (callHost && callHost.source === source || callManager.getParticipants(callId).length <= 1) {
    for (const participant of callManager.getParticipants(callId)) {
      emitNet("phone:client:removeAccpetedCallingInterface", participant.source);
      exports["pma-voice"].setPlayerCall(participant.source, 0);
    }
    await callHistoryManager.recordTwoPartyCallHistory(call, "completed", "completed", new Date());
    callManager.endCall(callId);
  } else if (callManager.getParticipants(callId).length > 2) {
    emitNet("phone:client:removeAccpetedCallingInterface", source);
    emitNet("phone:client:removeCallingInterface", source);
    exports["pma-voice"].setPlayerCall(source, 0);
    callManager.removeFromCall(callId, source);
  } else {
    for (const participant of callManager.getParticipants(callId)) {
      emitNet("phone:client:removeAccpetedCallingInterface", participant.source);
      exports["pma-voice"].setPlayerCall(participant.source, 0);
    }
    await callHistoryManager.recordTwoPartyCallHistory(call, "completed", "completed", new Date());
    callManager.endCall(callId);
  }
  return true;
});

onClientCallback("summit_phone:server:addPlayerToCall", async (source: number, data: string) => {
  const { contactNumber, _id } = JSON.parse(data);
  const targetData: PhoneContacts = await MongoDB.findOne('phone_contacts', { _id });
  const sourceData: PhoneContacts = await MongoDB.findOne('phone_contacts', {
    contactNumber: await Utils.GetPhoneNumberBySource(source),
    personalNumber: contactNumber
  });
  const callId = callManager.getCallIdByPlayer(source);
  const call = callManager.getCallByPlayer(source);
  if (!call) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Call Error",
      description: "No ongoing call found",
      app: "phone",
      timeout: 2000,
    }));
    return false;
  }
  const sourcePhone = await Utils.GetPhoneNumberBySource(source);
  const targetPlayer = await Utils.GetPlayerFromPhoneNumber(contactNumber);
  if (!targetPlayer) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to add is not reachable",
      app: "phone",
      timeout: 2000,
    }));
    return false;
  }
  const targetSource = targetPlayer.PlayerData.source;
  const IsNumberBlocked = await Utils.IsNumberBlocked(contactNumber, sourcePhone);
  const sourceCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(source);
  const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(contactNumber);
  const sourceFlightMode = await Utils.InFlightMode(sourceCitizenId);
  const targetFlightMode = await Utils.InFlightMode(targetCitizenId);
  if (sourceFlightMode) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Flight Mode",
      description: "You cannot make calls while in flight mode",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  } else if (targetFlightMode) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is unreachable",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }
  if (IsNumberBlocked) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }
  const ShourceNumberBlocked = await Utils.IsNumberBlocked(sourcePhone, contactNumber);
  if (ShourceNumberBlocked) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Number Blocked",
      description: "Unblock the number to call",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }
  const targetHasPhone = await Utils.HasPhone(targetSource);
  if (!targetHasPhone) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2000,
    }));
    return false;
  }
  if (call.participants.has(targetSource)) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Already in Call",
      description: "Player is already in the call",
      app: "phone",
      timeout: 2000,
    }));
    return false;
  }
  callManager.createRingTone(targetSource, String(Settings.ringtone.get(targetCitizenId)?.current));
  callManager.addPendingInvitation(Number(callId), targetSource, () => {
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Call Timeout",
      description: "Player did not answer conference call invitation",
      app: "phone",
      timeout: 2000,
    }));
    callManager.stopRingTone(targetSource);
  }, 30000);

  const sourceName = sourceData
    ? `${sourceData.firstName} ${sourceData.lastName}`
    : await Utils.GetPhoneNumberBySource(source);
  const targetName = targetData ? `${targetData.firstName} ${targetData.lastName}` : contactNumber;

  emitNet("phone:addActionNotification", targetSource, JSON.stringify({
    id: _id,
    title: "Incoming Conference Call",
    description: `${sourceName} is adding you to a conference call`,
    app: "phone",
    icons: {
      "0": {
        icon: "https://cdn.summitrp.gg/uploads/red.svg",
        isServer: true,
        event: "phone:server:declineCall",
        args: JSON.stringify({
          callId: callId,
          targetSource,
          targetName,
          callerSource: source,
          databaseTableId: _id,
        }),
      },
      "1": {
        icon: "https://cdn.summitrp.gg/uploads/green.svg",
        isServer: true,
        event: "phone:server:acceptConferenceCall",
        args: JSON.stringify({
          callId: callId,
          targetSource,
          sourceName: targetName,
          targetName: sourceName,
          callerSource: source,
          databaseTableId: _id,
        }),
      },
    },
  }));

  return true;
});

onClientCallback("phone:server:getCallHistory", async (source: number, maxRecordsX: number) => {
  let maxRecords = 100;
  try {
    if (maxRecordsX) {
      maxRecords = maxRecordsX;
    }
  } catch (error) {
    console.error("Error parsing getCallHistory data", error);
  }

  const phoneNumber = await Utils.GetPhoneNumberBySource(source);

  try {
    const history = await callHistoryManager.getPlayerCallHistory(phoneNumber, maxRecords);
    return JSON.stringify(history);
  } catch (error) {
    console.error("Error retrieving call history for phone number:", phoneNumber, error);
    return JSON.stringify([]);
  }
});

onClientCallback('phone:server:getDataFromDBwithNumber', async (source: number, data: string) => {
  const parsedData: {
    number: string,
    citizenId: string,
  } = JSON.parse(data);
  const res = await MongoDB.findOne('phone_contacts', { contactNumber: parsedData.number, ownerId: parsedData.citizenId });
  return JSON.stringify(res);
});

onClientCallback('phone:server:toggleBlockNumber', async (source: number, data: string) => {
  const parsedData : PhoneContacts = JSON.parse(data);
  const personalNumber = parsedData.personalNumber;
  const contactNumber = parsedData.contactNumber;
  let IsNumberBlocked = await Utils.IsNumberBlocked(personalNumber, contactNumber);
  if (!IsNumberBlocked) {
    await Utils.BlockNumber(personalNumber, contactNumber);
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Number Blocked",
      description: "Number has been blocked",
      app: "phone",
      timeout: 2000,
    }));
    return true;
  } else {
    await Utils.UnblockNumber(personalNumber, contactNumber);
    emitNet("phone:addnotiFication", source, JSON.stringify({
      id: generateUUid(),
      title: "Number Unblocked",
      description: "Number has been unblocked",
      app: "phone",
      timeout: 2000,
    }));
    return false;
  }
});