import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('getMessagesChannels');
on(`__cfx_nui:getMessagesChannels`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:getMessageChannelsandLastMessages', 1);
    cb(res);
});

RegisterNuiCallbackType('getMessagesStats');
on(`__cfx_nui:getMessagesStats`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:getMessageStats', 1);
    cb(res);
});