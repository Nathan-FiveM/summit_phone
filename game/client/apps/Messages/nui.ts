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

RegisterNuiCallbackType('getPrivateMessages');
on(`__cfx_nui:getPrivateMessages`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:getPrivateMessages', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getGroupMessages');
on(`__cfx_nui:getGroupMessages`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:getGroupMessages', 1, data);
    cb(res);
});

RegisterNuiCallbackType('sendMessage');
on(`__cfx_nui:sendMessage`, async (data: any, cb: Function) => {
    /* const res = await triggerServerCallback('phone_message:sendMessage', 1, JSON.stringify({
        type: 'private',
        phoneNumber: '5655101368',
        messageData: {
            message: 'Test message',
            attachments: []
        }
    })); */
    const res = await triggerServerCallback('phone_message:sendMessage', 1, data);
    cb(res);
});