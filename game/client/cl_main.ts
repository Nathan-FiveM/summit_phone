import "./cl_nuicallback";
import "./cl_exports";
import "./apps/index";
import { NUI } from "./classes/NUI";

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
                args:any
            },
            "1": {
                icon: string,
                isServer: boolean,
                event: string,
                args:any
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