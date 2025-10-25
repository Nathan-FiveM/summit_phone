import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { Framework, Logger, MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";
import { DateTime } from 'luxon';
import { FRAMEWORK_RESOURCE } from "../../../shared/utils"; // adjust path as needed

onClientCallback('crypto:getBalances', async (source: number) => {
    const player = Framework.Functions.GetPlayer(source);
    if (!player) return false;
    const crypto = player.PlayerData.metadata.crypto || {};
    return JSON.stringify(crypto);
});

onClientCallback('crypto:buy', async (source: number, data: string) => {
    const { type, amount, price } = JSON.parse(data);
    const player = Framework.Functions.GetPlayer(source);
    if (!player || !["shung", "gne", "xcoin", "lme"].includes(type)) return false;
    
    const totalCost = amount * price;  // Assume price is per unit
    if (player.PlayerData.money.bank < totalCost) return false;
    
    if (player.Functions.RemoveMoney('bank', totalCost)) {
        exports[FRAMEWORK_RESOURCE].AddCrypto(source, type, amount);
        Logger.AddLog({
            type: 'crypto_buy',
            title: 'Crypto Buy',
            message: `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname} bought ${amount} ${type} for $${totalCost}.`,
            showIdentifiers: false
        });
        return true;
    }
    return false;
});

onClientCallback('crypto:sell', async (source: number, data: string) => {
    const { type, amount, price } = JSON.parse(data);
    const player = Framework.Functions.GetPlayer(source);
    if (!player || !["shung", "gne", "xcoin", "lme"].includes(type)) return false;
    
    if (!exports[FRAMEWORK_RESOURCE].hasEnough(source, type, amount)) return false;
    
    exports[FRAMEWORK_RESOURCE].RemoveCrypto(source, type, amount);
    player.Functions.AddMoney('bank', amount * price);
    Logger.AddLog({
        type: 'crypto_sell',
        title: 'Crypto Sell',
        message: `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname} sold ${amount} ${type} for $${amount * price}.`,
            showIdentifiers: false
    });
    return true;
});

onClientCallback('crypto:transfer', async (source: number, data: string) => {
    const { type, amount, target } = JSON.parse(data);
    const sourcePlayer = Framework.Functions.GetPlayer(source);
    if (!sourcePlayer || !["shung", "gne", "xcoin", "lme"].includes(type)) return false;
    
    if (!exports[FRAMEWORK_RESOURCE].hasEnough(source, type, amount)) return false;
    
    // Assume target is phone number to get citizenId
    const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(target);
    if (!targetCitizenId) return false;
    
    const targetPlayer = Framework.Functions.GetPlayerByCitizenId(targetCitizenId);
    if (!targetPlayer) return false;
    
    exports[FRAMEWORK_RESOURCE].RemoveCrypto(source, type, amount);
    exports[FRAMEWORK_RESOURCE].AddCrypto(targetPlayer.PlayerData.source, type, amount);
    
    emitNet('phone:addnotiFication', source, JSON.stringify({
        id: generateUUid(),
        title: 'Crypto',
        description: `You transferred ${amount} ${type} to ${target}.`,
        app: 'crypto',
        timeout: 5000
    }));
    emitNet('phone:addnotiFication', targetPlayer.PlayerData.source, JSON.stringify({
        id: generateUUid(),
        title: 'Crypto',
        description: `You received ${amount} ${type} from ${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname}.`,
        app: 'crypto',
        timeout: 5000
    }));
    
    Logger.AddLog({
        type: 'crypto_transfer',
        title: 'Crypto Transfer',
        message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} transferred ${amount} ${type} to ${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname}.`,
        showIdentifiers: false
    });
    return true;
});