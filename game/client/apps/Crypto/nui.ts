import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('crypto:getBalances');
on('__cfx_nui:crypto:getBalances', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('crypto:getBalances', 1, data);
    cb(res);
});

RegisterNuiCallbackType('crypto:buy');
on('__cfx_nui:crypto:buy', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('crypto:buy', 1, data);
    cb(res);
});

RegisterNuiCallbackType('crypto:sell');
on('__cfx_nui:crypto:sell', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('crypto:sell', 1, data);
    cb(res);
});

RegisterNuiCallbackType('crypto:transfer');
on('__cfx_nui:crypto:transfer', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('crypto:transfer', 1, data);
    cb(res);
});