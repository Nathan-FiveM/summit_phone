import { generateUUid } from "@shared/utils";
import { PhoneMail, PhoneMailMessage } from "../../../../types/types";
import { MongoDB } from "@server/sv_main";
import { Utils } from "@server/classes/Utils";

class Mail {
    async getMailMessages(email: string, password: string) {
        if (!email && !password) return false;
        const mailData = await MongoDB.findOne('phone_mail', { activeMaidId: email, activeMailPassword: password });
        if (!mailData) return false;
        return JSON.stringify(mailData.messages);
    }

    async sendMail(email: string, to: string, subject: string, message: string, images: string[]) {
        const player = email;
        const target = to;

        const playerMail: PhoneMail = await MongoDB.findOne('phone_mail', { _id: player });
        const targetMail: PhoneMail = await MongoDB.findOne('phone_mail', { _id: target });
        if (!playerMail || !targetMail) return false;
        const newMailMessage: PhoneMailMessage = {
            _id: generateUUid(),
            from: player,
            to: target,
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
            subject: subject,
            message: message,
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
        if (targetCid) {
            emitNet('phone:addnotiFication', targetCid.PlayerData.source, JSON.stringify({
                id: generateUUid(),
                title: 'Mail',
                description: `You have a new mail from ${player}.`,
                app: 'mail',
                timeout: 5000
            }));
        }
        return true;
    }
}

export const MailClass = new Mail();