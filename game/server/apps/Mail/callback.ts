import { onClientCallback } from "@overextended/ox_lib/server";
import { MailClass } from "./class";
import { Logger } from "@server/sv_main";

onClientCallback('summit_phone:getEmailMessages', async (source: number, email: string, password: string) => {
    const data = await MailClass.getMailMessages(email, password)
    return data;
});

onClientCallback('summit_phone:sendEmail', async (source: number, email: string, to: string, subject: string, message: string, images: string[]) => {
    const res = await MailClass.sendMail(email, to, subject, message, images, source);
    const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
    Logger.AddLog({
        type: 'phone_mail',
        title: 'Email Sent',
        message: `Player ${citizenId} sent an email from ${email} to ${to} with subject "${subject}", content: "${message}"`,
        showIdentifiers: false
    });
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
    const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
    Logger.AddLog({
        type: 'phone_mail',
        title: 'Profile Updated',
        message: `Player ${citizenId} updated profile for email ${email}.`,
        showIdentifiers: false
    });
    return res;
});