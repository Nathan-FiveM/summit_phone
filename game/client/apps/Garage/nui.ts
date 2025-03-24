import { triggerServerCallback } from "@overextended/ox_lib/client";
import { GarageData } from "../../../../types/types";

RegisterNuiCallbackType('garage:fetchVehicles');
on('__cfx_nui:garage:fetchVehicles', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('garage:getGarageData', 1) as string[];
    cb(res);
});

RegisterNuiCallbackType('garage:valet');
on('__cfx_nui:garage:valet', async (data: string, cb: Function) => {
    const dataX: GarageData = JSON.parse(data);
    console.log(dataX);
    /* const res = await triggerServerCallback('garage:valet', 1, data) as string; */
    cb("res");
});