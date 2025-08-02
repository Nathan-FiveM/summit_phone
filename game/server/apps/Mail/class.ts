import { generateUUid } from "@shared/utils";
import { PhoneMail, PhoneMailMessage } from "../../../../types/types";
import { MongoDB } from "@server/sv_main";
import { Utils } from "@server/classes/Utils";

class Mail {
    async getMailMessages(email: string, password: string) {
        if (!email && !password) return false;
        const mailData = await MongoDB.findOne('phone_mail', { activeMaidId: email, activeMailPassword: password });
        if (!mailData || mailData.messages.length === 0) {
            mailData.messages = [];
        } else {
            mailData.messages = mailData.messages.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        if (!mailData) return false;
        return JSON.stringify(mailData.messages);
    };

    async sendMail(email: string, to: string, subject: string, message: string, images: string[], source: number) {
        const player = email;
        const target = to;

        const playerMail: PhoneMail = await MongoDB.findOne('phone_mail', { _id: player });
        const targetMail: PhoneMail = await MongoDB.findOne('phone_mail', { _id: target });
        if (!playerMail || !targetMail) return false;
        const newMailMessage: PhoneMailMessage = {
            _id: generateUUid(),
            from: player,
            to: target,
            avatar: await Utils.GetAvatarFromEmail(target),
            username: await Utils.GetUserNameFromEmail(target),
            subject: subject,
            message: message, 
            images: images,
            date: new Date().toISOString(),
            read: true,
            tags: ['inbox', 'sent']
        };

        const targetMailmessage: PhoneMailMessage = {
            _id: generateUUid(),
            from: player,
            to: target,
            avatar: await Utils.GetAvatarFromEmail(player),
            subject: subject,
            message: message,
            username: await Utils.GetUserNameFromEmail(player),
            images: images,
            date: new Date().toISOString(),
            read: false,
            tags: ['inbox']
        }
        playerMail.messages.push(newMailMessage);
        targetMail.messages.push(targetMailmessage);
        await MongoDB.updateOne('phone_mail', { _id: player }, playerMail);
        await MongoDB.updateOne('phone_mail', { _id: target }, targetMail);

        const targetCid = await Utils.GetPlayerByEmail(target);
        playerMail.messages.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        targetMail.messages.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        emitNet('summit_phone:client:refreshmailMessages', source, JSON.stringify(playerMail.messages));
        if (targetCid) {
            emitNet('phone:addnotiFication', targetCid.PlayerData.source, JSON.stringify({
                id: generateUUid(),
                title: 'Mail',
                description: `You have a new mail from ${player}.`,
                app: 'settings',
                timeout: 5000
            }));
            emitNet('summit_phone:client:refreshmailMessages', targetCid.PlayerData.source, JSON.stringify(targetMail.messages));
        }
        return true;
    };

    async sendEmailToAll(subject: string, sender: string, message: string, images: string[]) {
        const mailData = await MongoDB.findMany('phone_mail', { activeMaidId: { $ne: null } });
        if (!mailData) return false;
        mailData.forEach(async (mail: PhoneMail) => {
            const newMailMessage: PhoneMailMessage = {
                _id: generateUUid(),
                from: sender,
                to: mail.activeMaidId,
                avatar: '',
                subject: subject,
                message: message,
                images: images || [],
                date: new Date().toISOString(),
                read: false,
                tags: ['inbox'],
                username: sender
            };
            mail.messages.push(newMailMessage);
            //@ts-ignore
            await MongoDB.updateOne('phone_mail', { _id: mail._id }, mail);
        });
        emitNet('phone:addnotiFication', -1, JSON.stringify({
            id: generateUUid(),
            title: 'Mail',
            description: `You have a new mail, ${message}.`,
            app: 'settings',
            timeout: 5000
        }));
        return true;
    };

    async selecteMessage(data: string) {
        const parsedData = JSON.parse(data);
        const { messageId, mailId } = parsedData;
        const mailData: PhoneMail = await MongoDB.findOne('phone_mail', { _id: mailId });
        if (!mailData) return false;
        const message = mailData.messages.find((m) => m._id === messageId);
        if (!message) return false;
        message.read = true;
        await MongoDB.updateOne('phone_mail', { _id: mailId }, mailData);
        return true;
    };

    async getProfileSettings(email: string, password: string) {
        const mailData = await MongoDB.findAndReturnSpecificFields('phone_mail', { activeMaidId: email, activeMailPassword: password }, ['activeMaidId', 'activeMailPassword', 'avatar', 'username']);
        if (!mailData) return false;
        return JSON.stringify(mailData);
    };

    async updateProfileSettings(email: string, password: string, username: string, avatar: string) {
        const mailData = await MongoDB.findOne('phone_mail', { activeMaidId: email, activeMailPassword: password });
        if (!mailData) return false;
        mailData.username = username;
        mailData.avatar = avatar;
        await MongoDB.updateOne('phone_mail', { activeMaidId: email, activeMailPassword: password }, mailData);
        return true;
    };
}

export const MailClass = new Mail();