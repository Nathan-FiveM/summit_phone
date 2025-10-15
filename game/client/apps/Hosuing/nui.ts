import { NUI } from "@client/classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('getOwnedHouses');
on('__cfx_nui:getOwnedHouses', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('getOwnedHouses', 1);
    cb(JSON.stringify(res));
});

RegisterNuiCallbackType('getKeyHolderNames');
on('__cfx_nui:getKeyHolderNames', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('ps-housing:cb:getPlayersWithAccess', 1, data);
    cb(res);
});

RegisterNuiCallbackType('removeAccess');
on('__cfx_nui:removeAccess', async (data: string, cb: Function) => {
    const { id, cid } = JSON.parse(data);
    emitNet('ps-housing:server:removeAccess', id, cid);
    cb('Ok');
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

RegisterNuiCallbackType('giveAccess');
on('__cfx_nui:giveAccess', async (data: string, cb: Function) => {
    const { id, psrc } = JSON.parse(data);
    emitNet('ps-housing:server:addAccess', id, psrc);
    cb('Ok');
});