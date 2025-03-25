import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";
import { WalletAccount } from "../../../../types/types";

function GenerateCardNumber() {
    let cardNumber = '';
    for (let i = 0; i < 16; i++) {
        cardNumber += Math.floor(Math.random() * 10);
    }
    return cardNumber;
}

function GenerateBankAccountNumber() {
    const initials = "SMRT";
    let accountNumber = '';
    for (let i = 0; i < 10; i++) {
        accountNumber += Math.floor(Math.random() * 10);
    }
    return `${initials}_${accountNumber}`;
}

onClientCallback('wallet:login', async (source: number) => {
    const citizenId = await exports['qb-core'].GetPlayer(source);
    const res = await MongoDB.findOne('phone_bank_user', { citizenId: citizenId.PlayerData.citizenid });
    if (res) {
        return JSON.stringify({
            ...res,
            balance: await citizenId.PlayerData.money.bank
        });
    } else {
        const name = await exports['qb-core'].GetPlayerName(source);
        const cardNumber = GenerateCardNumber();
        const cardPin = Math.floor(Math.random() * 10000);
        const bankAccount = GenerateBankAccountNumber();
        const data = {
            _id: generateUUid(),
            citizenId: citizenId.PlayerData.citizenid,
            name: name,
            cardNumber: cardNumber,
            cardPin: cardPin,
            bankAccount: bankAccount,
            balance: 0
        }
        await MongoDB.insertOne('phone_bank_user', data);
        return JSON.stringify({
            ...data,
            balance: citizenId.PlayerData.money.bank
        });
    }
});

onClientCallback('getDetailsXS', async (client, number) => {
    let citizenId = await Utils.GetCitizenIdByPhoneNumber(String(number));
    if (citizenId) {
        const res: WalletAccount = await MongoDB.findOne('phone_bank_user', { citizenId: citizenId });
        if (res) {
            return res.bankAccount;
        } else {
            return false;
        }
    } else {
        return false
    }
});

onClientCallback('transXAdqasddasdferMoney', async (client, data: string) => {
    const { amount, to } = JSON.parse(data);
    const res: WalletAccount = await MongoDB.findOne('phone_bank_user', { bankAccount: to });
    if (!res) return false;
    const targetPlayer = await exports['qb-core'].GetPlayerByCitizenId(res.citizenId);
    const sourcePlayer = await exports['qb-core'].GetPlayer(client);
    if (!await exports['qb-core'].DoesPlayerExist(targetPlayer.PlayerData.source)) return false;
    if (sourcePlayer.PlayerData.money.bank < amount) return false;
    if (await sourcePlayer.Functions.RemoveMoney('bank', amount)) {
        targetPlayer.Functions.AddMoney('bank', amount);
        emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: 'Wallet',
            description: `You have transferred $${amount} to ${res.name}.`,
            app: 'settings',
            timeout: 5000
        }));
        emitNet('phone:addnotiFication', targetPlayer.PlayerData.source, JSON.stringify({
            id: generateUUid(),
            title: 'Wallet',
            description: `You have received $${amount} from ${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname}.`,
            app: 'settings',
            timeout: 5000
        }));

        await MongoDB.insertOne('phone_bank_transactions', {
            _id: generateUUid(),
            from: sourcePlayer.PlayerData.citizenid,
            to: res.citizenId,
            amount: amount,
            type: 'debit',
            date: new Date().toISOString()
        });
        await MongoDB.insertOne('phone_bank_transactions', {
            _id: generateUUid(),
            from: res.citizenId,
            to: sourcePlayer.PlayerData.citizenid,
            amount: amount,
            type: 'credit',
            date: new Date().toISOString()
        });
        return true;
    } else {
        return false;
    }
});

onClientCallback('getTransactions', async (client) => {
    const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const transactions = await MongoDB.findMany('phone_bank_transactions', { from: citizenId }, null, false, {
        sort: { date: -1 }
    });
    return JSON.stringify(transactions);
});

onClientCallback('wallet:createInvoice', async (client, data: string) => {
    const { description, amount, paymentTime, numberOfPayments, receiver, } = JSON.parse(data);
    const sourcePlayer = await exports['qb-core'].GetPlayer(client);
    const targetPlayer = await exports['qb-core'].GetPlayerByCitizenId(await Utils.GetCitizenIdByPhoneNumber(receiver));
    if (!targetPlayer) return false;
    if (amount < 0) return false;
    const res = await MongoDB.insertOne('phone_bank_invoices', {
        _id: generateUUid(),
        from: sourcePlayer.PlayerData.citizenid,
        to: targetPlayer.PlayerData.citizenid,
        amount: amount,
        status: 'pending',
        sourceName: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname}`,
        targetName: `${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname}`,
        description: description,
        paymentTime: paymentTime,
        numberOfPayments: numberOfPayments,
        date: new Date().toISOString()
    });
    if (res) {
        emitNet('phone:addnotiFication', targetPlayer.PlayerData.source, JSON.stringify({
            id: generateUUid(),
            title: 'Wallet',
            description: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} has sent you an invoice of $${amount}.`,
            app: 'settings',
            timeout: 5000
        }));
        return true;
    }
    return false;
});

onClientCallback('wallet:getInvoices', async (client, type) => {
    const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(client);
    if (type === 'sent') {
        const invoices = await MongoDB.findMany('phone_bank_invoices', { from: citizenId }, null, false, {
            sort: { date: -1 }
        });
        return JSON.stringify(invoices);
    } else {
        const invoices = await MongoDB.findMany('phone_bank_invoices', { to: citizenId }, null, false, {
            sort: { date: -1 }
        });
        return JSON.stringify(invoices);
    }
});

onClientCallback('wallet:acceptInvoicePayment', async (client, id: string) => {

});

onClientCallback('wallet:declineInvoicePayment', async (client, id: string) => {
    const res = await MongoDB.findOne('phone_bank_invoices', { _id: id });
    if (!res) return false;
    if (res.status === 'pending') {
        await MongoDB.updateOne('phone_bank_invoices', { _id: id }, { status: 'declined' });
        const sourcePlayer = await exports['qb-core'].GetPlayerByCitizenId(res.to);
        emitNet('phone:addnotiFication', sourcePlayer.PlayerData.source, JSON.stringify({
            id: generateUUid(),
            title: 'Wallet',
            description: `${res.targetName} has declined your invoice of $${res.amount}.`,
            app: 'settings',
            timeout: 5000
        }));
        return true;
    } else {
        return false;
    }
});