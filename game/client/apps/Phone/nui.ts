import { NUI } from "@client/classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('phoneCall');
on('__cfx_nui:phoneCall', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:call', 1, data);
    cb(res);
});

RegisterNuiCallbackType('declineCall');
on('__cfx_nui:declineCall', async (data: string, cb: Function) => {
    /* const dataX : {
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    } = JSON.parse(data); */
    const res = await triggerServerCallback('summit_phone:server:declineCall', 1, data);
    cb(res);
});

RegisterNuiCallbackType('endCall');
on('__cfx_nui:endCall', async (data: string, cb: Function) => {
    /* const dataX : {
        targetSource: number,
        targetName: string,
        sourceName: string,
        callerSource: number,
        databaseTableId: string
    } = JSON.parse(data); */
    const res = await triggerServerCallback('summit_phone:server:endCall', 1, data);
    cb(res);
});

RegisterNuiCallbackType('addPlayerToCall');
on('__cfx_nui:addPlayerToCall', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:addPlayerToCall', 1, data);
    cb(true);
});