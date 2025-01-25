import { Utils } from "./classes/Utils";

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