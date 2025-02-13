/* RegisterCommand('addPlayerToCall', (source: number, args: string[]) => {
    exports['pma-voice'].addPlayerToCall(args[0]);
}, false); */

import { NUI } from "@client/classes/NUI";
import { generateUUid } from "@shared/utils";

onNet('summit_phone:server:addCallingNotification', (dataX: string) => {
    const data: {
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    } = JSON.parse(dataX);
    const callerSource: number = GetPlayerServerId(PlayerId());

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
    NUI.sendReactMessage('startCallAccepted', data);
})
onNet('phone:client:updateCallerInterface', (data: string) => {
    NUI.sendReactMessage('startCallAccepted', data);
})