import { NUI } from "@client/classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('getOwnedHouses');
on('__cfx_nui:getOwnedHouses', async (data: string, cb: Function) => {
    const res = await exports['nolag_properties'].GetAllProperties('user');
    cb(JSON.stringify(res));
});

RegisterNuiCallbackType('getKeyHolderNames');
on('__cfx_nui:getKeyHolderNames', async (data: string, cb: Function) => {
    const res = await exports['nolag_properties'].GetKeyHolders(data);
    cb(res);
});

RegisterNuiCallbackType('removeAccess');
on('__cfx_nui:removeAccess', async (data: string, cb: Function) => {
    const { id, cid } = JSON.parse(data);
    await exports['nolag_properties'].RemoveKey(id, cid);
    cb('Ok');
});

RegisterNuiCallbackType('setLocationOfHouse');
on('__cfx_nui:setLocationOfHouse', async (data: { propertyId: string }, cb: Function) => {
    await exports['nolag_properties'].SetWaypointToProperty(data.propertyId);
    cb('ok');
});

RegisterNuiCallbackType('lockUnLockDoor');
on('__cfx_nui:lockUnLockDoor', async (data: { propertyId: number, doorLocked: boolean }, cb: Function) => {
    emitNet('summit_phone:server:toggleDoorlock', data);
    cb('ok');
});

RegisterNuiCallbackType('giveAccess');
on('__cfx_nui:giveAccess', async (data: string, cb: Function) => {
    const { id, psrc } = JSON.parse(data);
    emitNet('ps-housing:server:addAccess', id, psrc);
    cb('Ok');
});