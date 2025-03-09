import { onClientCallback } from "@overextended/ox_lib/server";
import { MailClass } from "./class";

onClientCallback('summit_phone:getEmailMessages', async (source: number, email: string, password: string) => {
    return await MailClass.getMailMessages(email, password);
});

onClientCallback('summit_phone:sendEmail', async (source: number, email: string, to: string, subject: string, message: string, images: string[]) => {
    const res = await MailClass.sendMail(email, to, subject, message, images, source);
    return res;
});

onClientCallback('summit_phone:setSelectedMessage', async (source: number, data: string) => {
    const res = await MailClass.selecteMessage(data);
    return res;
})

onClientCallback('summit_phone:getProfileSettings', async (source: number, data: string) => {
    const parsedData = JSON.parse(data);
    const { email, password } = parsedData;
    const res = await MailClass.getProfileSettings(email, password);
    return res;
});

onClientCallback('summit_phone:updateProfileSettings', async (source: number, data: string) => {
    const parsedData = JSON.parse(data);
    const { email, password, username, avatar } = parsedData;
    const res = await MailClass.updateProfileSettings(email, password, username, avatar);
    return res;
});