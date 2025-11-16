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

RegisterNuiCallbackType('getMessageGroupMessages');
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

RegisterNuiCallbackType('createMessageGroup');
on(`__cfx_nui:createGroup`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:createGroup', 1, data);
    cb(res);
});

RegisterNuiCallbackType('updateMessageGroupName');
on(`__cfx_nui:updateGroupName`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:updateGroupName', 1, data);
    cb(res);
});

RegisterNuiCallbackType('updateMessageGroupAvatar');
on(`__cfx_nui:updateGroupAvatar`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:updateGroupAvatar', 1, data);
    cb(res);
});

RegisterNuiCallbackType('deleteMessageGroup');
on(`__cfx_nui:deleteMessageGroup`, async (groupId: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:deleteGroup', 1, groupId);
    cb(res);
});

RegisterNuiCallbackType('leaveMessageGroup');
on(`__cfx_nui:leaveMessageGroup`, async (groupId: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:removeMember', 1, groupId);
    cb(res);
});

RegisterNuiCallbackType('addMessageMember');
on(`__cfx_nui:addMessageMember`, async (data: any, cb: Function) => {
    const res = await triggerServerCallback('phone_message:addMember', 1, data);
    cb(res);
});

RegisterNuiCallbackType('deleteMessage');
on(`__cfx_nui:deleteMessage`, async (message: string, cb: Function) => {
    const res = await triggerServerCallback('phone_message:deleteMessage', 1, message);
    cb(res);
});