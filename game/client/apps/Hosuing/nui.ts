import { NUI } from "@client/classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('getOwnedHouses');
on('__cfx_nui:getOwnedHouses', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('getOwnedHouses', 1);
    cb(res);
});

RegisterNuiCallbackType('getKeyHolderNames');
on('__cfx_nui:getKeyHolderNames', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('getKeyHolderNames', 1, data);
    cb(res);
});

RegisterNuiCallbackType('removeAccess');
on('__cfx_nui:removeAccess', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('removeAccess', 1, data);
    cb(res);
});

RegisterNuiCallbackType('setLocationOfHouse');
on('__cfx_nui:setLocationOfHouse', async (data: { x: number, y: number, z: number }, cb: Function) => {
    SetNewWaypoint(data.x, data.y);
    cb('ok');
});

RegisterNuiCallbackType('lockUnLockDoor');
on('__cfx_nui:lockUnLockDoor', async (data: string, cb: Function) => {
    emitNet('ps-housing:server:ToggleMainDoorLock', data);
    cb('ok');
});