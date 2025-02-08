import "./cl_nuicallback";
import "./cl_exports";
import "./apps/index";
import { NUI } from "./classes/NUI";
import { generateUUid } from "@shared/utils";

export const FrameWork = exports['qb-core'].GetCoreObject();
setImmediate(() => {
    NUI.init();
});
RegisterCommand('testNoti', async () => {
    NUI.sendReactMessage('addNotification', {
        id: generateUUid(),
        title: 'Test',
        description: 'This is a test notification',
        app: 'settings',
        timeout: 5000
    });
}, false);

RegisterCommand('testActionNoti', async () => {
    NUI.sendReactMessage('addActionNotification', {
        id: generateUUid(),
        title: 'Test',
        description: 'This is a test notification',
        app: 'settings',
        icons: {
            "0": {
                icon: "https://cdn.summitrp.gg/uploads/red.svg",
                isServer: false,
                event: 'phone:client:buttonClicked'
            },
            /*  "1": {
                icon: "https://cdn.summitrp.gg/uploads/green.svg",
                isServer: false,
                event: 'phone:client:buttonClicked1'
            } */
        }
    });
}, false);

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