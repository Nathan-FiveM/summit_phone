import { onClientCallback } from "@overextended/ox_lib/server";
import { MailClass } from "./class";

onClientCallback('summit_phone:getEmailMessages', async (source: number, email: string, password: string) => {
    return await MailClass.getMailMessages(email, password);
});

onClientCallback('summit_phone:sendEmail', async (source: number, email: string, to: string, subject: string, message: string, images: string[]) => {
    const res = await MailClass.sendMail(email, to, subject, message, images);
    return res;
});