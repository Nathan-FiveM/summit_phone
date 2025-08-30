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
    const res = await triggerServerCallback('phone_message:sendMessage', 1, data);
    cb(res);
});

RegisterNuiCallbackType('toggleMessageBlock');
on(`__cfx_nui:toggleMessageBlock`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:toggleBlock', 1, data);
    cb(res);
});

RegisterNuiCallbackType('createGroup');
on(`__cfx_nui:createGroup`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:createGroup', 1, data);
    cb(res);
});

RegisterNuiCallbackType('updateGroupName');
on(`__cfx_nui:updateGroupName`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:updateGroupName', 1, data);
    cb(res);
});

RegisterNuiCallbackType('updateGroupAvatar');
on(`__cfx_nui:updateGroupAvatar`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:updateGroupAvatar', 1, data);
    cb(res);
});

RegisterNuiCallbackType('deleteGroup');
on(`__cfx_nui:deleteGroup`, async (groupId: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:deleteGroup', 1, groupId);
    cb(res);
});

RegisterNuiCallbackType('leaveGroup');
on(`__cfx_nui:leaveGroup`, async (groupId: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:removeMember', 1, groupId);
    cb(res);
});

RegisterNuiCallbackType('addMember');
on(`__cfx_nui:addMember`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:addMember', 1, data);
    cb(res);
});

RegisterNuiCallbackType('deleteMessage');
on(`__cfx_nui:deleteMessage`, async (message: string, cb: Function) => {
    const res = await triggerServerCallback('phone_message:deleteMessage', 1, message);
    cb(res);
});