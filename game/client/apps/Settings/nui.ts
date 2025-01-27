import { FrameWork } from "@client/cl_main";
import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('getSettings');
on('__cfx_nui:getSettings', async (data: any, cb: Function) => {
    const response: any = await triggerServerCallback('GetClientSettings', 1)
    cb(response);
});

RegisterNuiCallbackType('setSettings');
on('__cfx_nui:setSettings', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('SetClientSettings', 1, data)
    cb(response);
});

RegisterNuiCallbackType('registerNewMailAccount');
on('__cfx_nui:registerNewMailAccount', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('RegisterNewMailAccount', 1, data)
    cb(response);
});

RegisterNuiCallbackType('searchEmail');
on('__cfx_nui:searchEmail', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('SearchEmail', 1, data)
    cb(response);
});

RegisterNuiCallbackType('loginMailAccount');
on('__cfx_nui:loginMailAccount', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('LoginMailAccount', 1, data)
    cb(response);
});

RegisterNuiCallbackType('unLockorLockPhone');
on('__cfx_nui:unLockorLockPhone', async (data: boolean, cb: Function) => {
    const response = await triggerServerCallback('unLockorLockPhone', 1, data)
    cb(response);
});

RegisterNuiCallbackType('getCitizenId');
on('__cfx_nui:getCitizenId', async (data: any, cb: Function) => {
    const citizenId = await FrameWork.Functions.GetPlayerData().citizenid;
    cb(citizenId);
});