import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('phoneCall');
on('__cfx_nui:phoneCall', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:call', 1, data);
    cb(res);
});