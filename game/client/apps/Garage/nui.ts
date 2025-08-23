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
    emitNet('garage:valet', dataX);
    cb("res");
});

// New callback for locating vehicles - Direct client-side approach
RegisterNuiCallbackType('garage:locateVehicle');
on('__cfx_nui:garage:locateVehicle', async (data: string, cb: Function) => {
    try {
        const plate = JSON.parse(data).plate;
        
        // Check if the export exists
        if (!exports['summit_garages'] || typeof exports['summit_garages'].findVehFromPlateAndLocate !== 'function') {
            cb({ success: false, message: "Garage system not available" });
            return;
        }
        
        // Call garage function directly - await the promise
        const result = await exports['summit_garages'].findVehFromPlateAndLocate(plate, true);
        
        // Ensure result is a boolean
        const success = Boolean(result);
        cb(success);
    } catch (error) {
        cb(false);
    }
});