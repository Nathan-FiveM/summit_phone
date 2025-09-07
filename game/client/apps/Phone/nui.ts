import { triggerServerCallback } from "@overextended/ox_lib/client";
import { generateUUid } from "@shared/utils";

RegisterNuiCallbackType('phoneCall');
on('__cfx_nui:phoneCall', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:call', 1, data);
    cb(res);
});

RegisterNuiCallbackType('declineCall');
on('__cfx_nui:declineCall', async (data: string, cb: Function) => {
    emitNet('summit_phone:server:declineCall', data);
    cb(true);
});

RegisterNuiCallbackType('endCall');
on('__cfx_nui:endCall', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:endCall', 1, data);
    cb(res);
});

RegisterNuiCallbackType('addPlayerToCall');
on('__cfx_nui:addPlayerToCall', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:addPlayerToCall', 1, data);
    cb(true);
});

RegisterNuiCallbackType('getCallRecentData');
on('__cfx_nui:getCallRecentData', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('phone:server:getCallHistory', 1);
    cb(res);
});

RegisterNuiCallbackType('callFromDialPad');
on('__cfx_nui:callFromDialPad', async (data: string, cb: Function) => {
    const { _id, number, volume } = JSON.parse(data);
    const res = await triggerServerCallback('summit_phone:server:call', 1, JSON.stringify({ number, _id: generateUUid(), volume }));
    cb(res);
});

RegisterNuiCallbackType('blockNumber');
on('__cfx_nui:blockNumber', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('phone:server:toggleBlockNumber', 1, data);
    cb(res);
});

RegisterNuiCallbackType('jailPhoneCall');
on('__cfx_nui:jailPhoneCall', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:jailCall', 1, data);
    cb(res);
});