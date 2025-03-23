import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('garage:fetchVehicles');
on('__cfx_nui:garage:fetchVehicles', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('garage:getGarageData', 1) as string[];
    cb(res);
});