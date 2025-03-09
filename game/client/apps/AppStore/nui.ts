import { triggerServerCallback } from "@overextended/ox_lib/client";
import { generateUUid } from "@shared/utils";

RegisterNuiCallbackType('getEmailMessages');
on('__cfx_nui:getEmailMessages', async (data: string, cb: Function) => {
    const parsedData: { email: string, password: string } = JSON.parse(data);
    const { email, password } = parsedData;
    const messages = await triggerServerCallback('summit_phone:getEmailMessages', 1, email, password);
    cb(messages);
});

RegisterNuiCallbackType('setSelectedMessage');
on('__cfx_nui:setSelectedMessage', async (data: string) => {
    const res = await triggerServerCallback('summit_phone:setSelectedMessage', 1, data);
    return res;
});

RegisterNuiCallbackType('sendEmail');
on('__cfx_nui:sendEmail', async (data: string) => {
    const parsedData: { email: string, to: string, subject: string, message: string, images: string[] } = JSON.parse(data);
    const { email, to, subject, message, images } = parsedData;
    const res = await triggerServerCallback('summit_phone:sendEmail', 1, email, to, subject, message, images);
    return res;
});