import "./cl_nuicallback";
import { NUI } from "./classes/NUI";

setImmediate(() => {
    NUI.init();
});

/* RegisterCommand('phoneopen', () => {
    NUI.openUI();
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