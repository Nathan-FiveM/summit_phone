import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('searchPigeonEmail');
on('__cfx_nui:searchPigeonEmail', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:searchUsers', 1, data);
    cb(res);
});

RegisterNuiCallbackType('loginPegionEmail');
on('__cfx_nui:loginPegionEmail', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:login', 1, data);
    cb(res);
});

RegisterNuiCallbackType('signupPegionEmail');
on('__cfx_nui:signupPegionEmail', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:signup', 1, data);
    cb(res);
});