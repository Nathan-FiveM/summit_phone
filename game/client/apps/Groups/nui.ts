import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('getmultiPleJobs');
on('__cfx_nui:getmultiPleJobs', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('groups:getmultiPleJobs', 1);
    cb(res);
});

RegisterNuiCallbackType('deleteMultiJob');
on('__cfx_nui:deleteMultiJob', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('groups:deleteMultiJob', 1, data);
    cb(res);
});

RegisterNuiCallbackType('changeJobOfPlayer');
on('__cfx_nui:changeJobOfPlayer', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('groups:changeJobOfPlayer', 1, data);
    cb(res);
});