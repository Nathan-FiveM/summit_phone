import "./cl_nuicallback";
import "./cl_exports";
import "./apps/index";
import { NUI } from "./classes/NUI";
import { generateUUid } from "@shared/utils";
import { triggerServerCallback } from "@overextended/ox_lib/client";

export const FrameWork = exports['qb-core'].GetCoreObject();

setImmediate(() => {
    NUI.init();
});

onNet('phone:addnotiFication', (data: string) => {
    const notiData: {
        id: string,
        title: string,
        description: string,
        app: string,
        timeout: number
    } = JSON.parse(data);
    NUI.sendReactMessage('addNotification', notiData);
});

onNet('phone:addActionNotification', (data: string) => {
    const notiData: {
        id: string,
        title: string,
        description: string,
        app: string,
        icons: {
            "0": {
                icon: string,
                isServer: boolean,
                event: string,
                args: any
            },
            "1": {
                icon: string,
                isServer: boolean,
                event: string,
                args: any
            }
        }
    } = JSON.parse(data);
    NUI.sendReactMessage('addActionNotification', notiData);
});

on('onResourceStop', (resource: string) => {
    if (resource === GetCurrentResourceName()) {
        const state = LocalPlayer.state;
        state.set('onPhone', false, true);
    }
});

RegisterCommand('testNoti', () => {
    NUI.sendReactMessage('addNotification', {
        id: generateUUid(),
        title: 'test',
        description: "Test",
        app: 'settings',
        timeout: 5000
    });
}, false);

exports.ox_target.addGlobalPlayer([
    {

        icon: 'fas fa-hands',
        label: 'Share Number',
        distance: 1.5,
        onSelect: async (a: any) => {
            const source = GetPlayerServerId(NetworkGetPlayerIndexFromPed(a.entity));
            await triggerServerCallback('phone:server:shareNumber', 1, source);
        }
    }
]);

/* on('phone:client:buttonClicked', (id: string) => {
    
});
on('phone:client:buttonClicked1', (id: string) => {
    NUI.sendReactMessage('removeActionNotification', id);
}); */

/*

RegisterCommand('phoneclose', () => {
    NUI.closeUI();
}, false);
 */
/* let tick: any;

RegisterCommand('gfetTime', () => {

    tick = setTick(() => {
        let hours = GetClockHours();
        const minutes = GetClockMinutes();

        NUI.sendReactMessage('sendTime', `${hours}:${minutes}`);
    });

}, false);

RegisterCommand('stopTime', () => {
    clearTick(tick);
}, false); */