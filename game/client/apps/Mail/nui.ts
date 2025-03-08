import { FrameWork } from "@client/cl_main";
import { NUI } from "@client/classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";
import { generateUUid } from "@shared/utils";

RegisterNuiCallbackType('getEmailMessages');
on('__cfx_nui:getEmailMessages', async (data: string, cb: Function) => {
    const parsedData: { email: string, password: string } = JSON.parse(data);
    const { email, password } = parsedData;
    const messages = await triggerServerCallback('summit_phone:getEmailMessages', 1, email, password);
    cb(messages);
});