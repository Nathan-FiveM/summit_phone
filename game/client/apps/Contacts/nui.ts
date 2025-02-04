import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('getContacts');
on('__cfx_nui:getContacts', async (data: any, cb: Function) => {
    const response: any = await triggerServerCallback('contacts:getContacts', 1)
    cb(response);
});

RegisterNuiCallbackType('saveContact');
on('__cfx_nui:saveContact', async (data: string, cb: Function) => {
    const response: any = await triggerServerCallback('contacts:saveContact', 1, data)
    cb(response);
});

RegisterNuiCallbackType('addContact');
on('__cfx_nui:addContact', async (data: string, cb: Function) => {
    const response: any = await triggerServerCallback('contacts:addContact', 1, data)
    cb(response);
});

RegisterNuiCallbackType('deleteContact');
on('__cfx_nui:deleteContact', async (_id: string, cb: Function) => {
    const response: any = await triggerServerCallback('contacts:deleteContact', 1, _id)
    cb(response);
});

RegisterNuiCallbackType('favContact');
on('__cfx_nui:favContact', async (_id: string, cb: Function) => {
    const response: any = await triggerServerCallback('contacts:favContact', 1, _id)
    cb(response);
});