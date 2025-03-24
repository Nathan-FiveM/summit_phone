import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('wallet:login');
on('__cfx_nui:wallet:login', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('wallet:login', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getDetailsXS');
on('__cfx_nui:getDetailsXS', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('getDetailsXS', 1, data);
    cb(res);
});

RegisterNuiCallbackType('transXAdqasddasdferMoney');
on('__cfx_nui:transXAdqasddasdferMoney', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('transXAdqasddasdferMoney', 1, data);
    cb(res);
});