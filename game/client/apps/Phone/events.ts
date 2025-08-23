/* RegisterCommand('addPlayerToCall', (source: number, args: string[]) => {
    exports['pma-voice'].addPlayerToCall(args[0]);
}, false); */

import { NUI } from "@client/classes/NUI";
import { generateUUid } from "@shared/utils";
import { Animation } from "@client/classes/Animation";
import { Utils } from "@client/classes/Utils";
import { triggerServerCallback } from "@overextended/ox_lib/client";

onNet('summit_phone:server:addCallingNotification', (dataX: string) => {
    const data: {
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    } = JSON.parse(dataX);
    const callerSource: number = GetPlayerServerId(PlayerId());

    // Start calling animation for the CALLER (not receiver)
    if (data.callerSource === callerSource) {
        Animation.StartCallAnimation(Utils.GetPhoneItem());
    }

    NUI.sendReactMessage('addActionNotification', {
        id: generateUUid(),
        title: data.callerSource === callerSource ? 'Outgoing Call' : 'Incoming Call',
        description: data.callerSource === callerSource ? `You are calling ${data.targetName}` : `${data.sourceName} is calling you`,
        app: 'phone',
        icons: {
            "0": {
                icon: "https://cdn.summitrp.gg/uploads/red.svg",
                isServer: true,
                event: 'phone:server:declineCall'
            },
            "1": {
                icon: "https://cdn.summitrp.gg/uploads/green.svg",
                isServer: true,
                event: 'phone:server:acceptCall'
            }
        }
    });
});

onNet('summit_phone:server:addCallinginterface', (dataX: string) => {
    NUI.sendReactMessage('addCallingInterFace', {
        data: dataX,
        show: true
    });
});

onNet('phone:client:removeActionNotification', (notiId: string) => {
    NUI.sendReactMessage('removeActionNotification', notiId);
});

onNet('phone:client:removeCallingInterface', (notiId: string) => {
    NUI.sendReactMessage('removeCallingInterface', {
        data: {},
        show: false
    });
});

onNet('phone:client:removeAccpetedCallingInterface', (notiId: string) => {
    NUI.sendReactMessage('removeAccpetedCallingInterface', {
        data: {},
        show: false
    });
});

onNet('phone:client:acceptCall', (data: string) => {
    // Start calling animation for the RECEIVER when they accept
    Animation.StartCallAnimation(Utils.GetPhoneItem());
    NUI.sendReactMessage('startCallAccepted', data);
});

// NEW: Event for caller to start animation when call is accepted
onNet('phone:client:startCallAnimation', () => {
    // Start calling animation for the CALLER when call is accepted
    Animation.StartCallAnimation(Utils.GetPhoneItem());
});

onNet('phone:client:updateCallerInterface', (data: string) => {
    NUI.sendReactMessage('startCallAccepted', data);
});

onNet('phone:client:updateConference', (conferenceData: { conferenceParticipants: number[] }) => {

});

onNet('phone:client:upDateInterFaceName', (data: string) => {
    NUI.sendReactMessage('upDateInterFaceName', "Conference Call");
});

// Call ending events
onNet('phone:client:endCallAnimation', () => {
    Animation.EndCallAnimation();
});

onNet('phone:client:callEnded', () => {
    Animation.EndCallAnimation();
});

// NEW: Event to handle when phone UI is opened during a call
onNet('phone:client:phoneOpenedDuringCall', () => {
    // This ensures the phone state is properly tracked
    const state = LocalPlayer.state;
    state.set('onPhone', true, true);
});

// Jail phone call events
onNet('summit_phone:client:jailPhoneCall', async (phoneNumber: string) => {
    // Trigger the jail call callback
    const result = await triggerServerCallback("summit_phone:server:jailCall", 1, JSON.stringify({
        number: phoneNumber,
        volume: 1.0
    }));
    
    if (!result) {
        // Call failed, show notification
        
        NUI.sendReactMessage('addNotification', {
            id: generateUUid(),
            title: 'Call Failed',
            description: 'Unable to make call from jail phone',
            app: 'phone',
            timeout: 3000,
        });
    }
});

onNet('summit_phone:client:endJailCall', () => {
    // End any active jail call
    NUI.sendReactMessage('endCall', {});
});