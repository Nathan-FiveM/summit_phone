import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('searchPigeonEmail');
on('__cfx_nui:searchPigeonEmail', (data: string, cb: Function) => {
    const res = triggerServerCallback('pigeon:searchUsers', 1, data);
});
