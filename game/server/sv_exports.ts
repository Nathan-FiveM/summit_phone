import { generateUUid } from "@shared/utils";
import { Utils } from "./classes/Utils";
import { MailClass } from "./apps/Mail/class";

async function GetCurrentPhoneNumber(source: number | string) {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(source);
    if (!citizenId) return false;
    const number = await Utils.GetPhoneNumberByCitizenId(citizenId);
    return number;
}
exports('GetCurrentPhoneNumber', GetCurrentPhoneNumber);

async function GetCurrentPhoneNumberByCitizenId(citizenId: string) {
    const number = await Utils.GetPhoneNumberByCitizenId(citizenId);
    return number;
}
exports('GetCurrentPhoneNumberByCitizenId', GetCurrentPhoneNumberByCitizenId);

async function GetEmailIdByCitizenId(citizenId: string) {
    const email = await Utils.GetEmailIdByCitizenId(citizenId);
    return email;
}
exports('GetEmailIdByCitizenId', GetEmailIdByCitizenId);

async function GetEmailIdBySource(source: number | string) {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(source);
    if (!citizenId) return false;
    const email = await Utils.GetEmailIdByCitizenId(citizenId);
    return email;
}
exports('GetEmailIdBySource', GetEmailIdBySource);

async function SendNotification(source: number | string, title: string, description: string, app: string, timeout?: number) {
    emitNet("phone:addnotiFication", source, JSON.stringify({
        id: generateUUid(),
        title,
        description,
        app,
        timeout: timeout || 5000,
    }));
}
exports('SendNotification', SendNotification);

async function SendMail(data: {
    email: string;
    to: string;
    subject: string;
    message: string;
    images: string[];
    source: number;
}) {
    const res = await MailClass.sendMail(data.email, data.to, data.subject, data.message, data.images, data.source);
    return res;
}
exports('SendMail', SendMail);

async function SendMailToAll(data: {
    subject: string;
    sender: string;
    message: string;
    images: string[];
}) {
    const res = await MailClass.sendEmailToAll(data.subject, data.sender,data.message, data.images);
    return res;
}
exports('SendMailToAll', SendMailToAll);