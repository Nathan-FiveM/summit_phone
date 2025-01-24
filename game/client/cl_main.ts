import "./cl_nuicallback";
import "./cl_exports";
import "./apps/index";
import { NUI } from "./classes/NUI";
export const FrameWork = exports['qb-core'].GetCoreObject();
setImmediate(() => {
    NUI.init();
});

/*
RegisterCommand('testCall', async () => {
}, false);

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