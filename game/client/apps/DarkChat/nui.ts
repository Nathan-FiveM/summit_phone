import { NUI } from "@client/classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('searchDarkChatEmail');
on('__cfx_nui:searchDarkChatEmail', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('SearchDarkChatEmail', 1, data)
    cb(response);
});

RegisterNuiCallbackType('registerNewDarkMailAccount');
on('__cfx_nui:registerNewDarkMailAccount', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('RegisterNewDarkMailAccount', 1, data)
    cb(response);
});

RegisterNuiCallbackType('loginDarkMailAccount');
on('__cfx_nui:loginDarkMailAccount', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('LoginDarkMailAccount', 1, data)
    cb(response);
});

RegisterNuiCallbackType('createNewDarkChannel');
on('__cfx_nui:createNewDarkChannel', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('CreateNewDarkChannel', 1, data)
    cb(response);
});

RegisterNuiCallbackType('getDarkChatChannels');
on('__cfx_nui:getDarkChatChannels', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('GetDarkChatChannels', 1, data)
    cb(response);
});

RegisterNuiCallbackType('getDarkChatProfile');
on('__cfx_nui:getDarkChatProfile', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('GetDarkChatProfile', 1, data)
    cb(response);
});

RegisterNuiCallbackType('removeFromDarkChannel');
on('__cfx_nui:removeFromDarkChannel', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('RemoveFromDarkChannel', 1, data)
    cb(response);
});

RegisterNuiCallbackType('updateProfileoptions');
on('__cfx_nui:updateProfileoptions', async (data: { email: string }, cb: Function) => {
    const dataX = [
        {
            name: 'Change Avatar',
            event: 'summit_phone:client:changeAvatarDark',
            isServer: false,
            args: data.email
        },
        {
            name: 'Change Password',
            event: 'summit_phone:server:changePasswordDark',
            isServer: false,
            args: data.email
        },
        {
            name: "Logout",
            event: "summit_phone:server:logoutDark",
            isServer: false,
            args: data.email
        }
    ]
    NUI.sendReactMessage('phone:contextMenu', dataX);
});

RegisterNuiCallbackType('updateDarkAvatar');
on('__cfx_nui:updateDarkAvatar', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('UpdateDarkAvatar', 1, data)
    cb(response);
});

RegisterNuiCallbackType('updateDarkPassword');
on('__cfx_nui:updateDarkPassword', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('UpdateDarkPassword', 1, data)
    cb(response);
});

RegisterNuiCallbackType('setDarkChatMessages');
on('__cfx_nui:setDarkChatMessages', async (data: string, cb: Function) => {
    const response = await triggerServerCallback('SetDarkChatMessages', 1, data)
    cb(response);
});