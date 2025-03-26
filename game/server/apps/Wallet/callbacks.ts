import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";
import { WalletAccount } from "../../../../types/types";
import { DateTime } from 'luxon';

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
    const { description, amount, paymentTime, numberOfPayments, receiver, } = JSON.parse(data); // paymentTime = 0 for daily, 1 for weekly, 2 for monthly and 3 for quarterly and 4 for yearly
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
interface PhoneBankInvoices {
    _id: string;
    from: string;
    to: string;
    amount: number;
    targetName: string;
    sourceName: string;
    status: string;
    paymentTime: string;
    numberOfPayments: string;
    date: Date;
    nextPaymentDate: Date | null;
}

onClientCallback('wallet:acceptInvoicePayment', async (client, id: string) => {
    const invoice = await MongoDB.findOne('phone_bank_invoices', { _id: id }) as PhoneBankInvoices;
    if (!invoice || invoice.status !== 'pending') return false;

    const isRecurring = invoice.paymentTime !== "" && invoice.numberOfPayments !== "";

    const targetPlayer = exports['qb-core'].GetPlayer(client);
    if (!targetPlayer || targetPlayer.PlayerData.citizenid !== invoice.to) return false;
    const sourcePlayer = await exports['qb-core'].GetPlayerByCitizenId(invoice.from);
    if (!sourcePlayer) return false;

    let updateFields: Partial<PhoneBankInvoices> = {};
    if (isRecurring) {
        const numberOfPayments = parseInt(invoice.numberOfPayments, 10);
        if (numberOfPayments <= 0) return false;
        const newNumberOfPayments = numberOfPayments - 1;
        updateFields = {
            numberOfPayments: newNumberOfPayments.toString(),
            status: 'paid',
        };

        if (newNumberOfPayments > 0) {
            const paymentTime = parseInt(invoice.paymentTime, 10);
            const todayMidnightEST = DateTime.now().setZone('America/New_York').startOf('day');
            let nextPaymentDate: DateTime;

            switch (paymentTime) {
                case 0: // Daily
                    nextPaymentDate = todayMidnightEST.plus({ days: 1 });
                    break;
                case 1: // Weekly
                    nextPaymentDate = todayMidnightEST.plus({ weeks: 1 });
                    break;
                case 2: // Monthly
                    nextPaymentDate = todayMidnightEST.plus({ months: 1 });
                    break;
                case 3: // Quarterly
                    nextPaymentDate = todayMidnightEST.plus({ months: 3 });
                    break;
                case 4: // Yearly
                    nextPaymentDate = todayMidnightEST.plus({ years: 1 });
                    break;
                default:
                    console.error(`Invalid paymentTime: ${paymentTime}`);
                    return false; // Invalid paymentTime
            }
            updateFields.nextPaymentDate = nextPaymentDate.toUTC().toJSDate();
        } else {
            updateFields.paymentTime = "";
            updateFields.numberOfPayments = "";
            updateFields.nextPaymentDate = null;
        }
    } else {
        updateFields = { status: 'paid' };
    }

    if (!(await targetPlayer.Functions.RemoveMoney('bank', invoice.amount))) return false;
    await sourcePlayer.Functions.AddMoney('bank', invoice.amount);

    const notificationId1 = generateUUid();
    const notificationId2 = generateUUid();
    const transactionId1 = generateUUid();
    const transactionId2 = generateUUid();

    const notificationSource = {
        id: notificationId1,
        title: 'Wallet',
        description: isRecurring
            ? `${invoice.targetName} has accepted your invoice of $${invoice.amount}, ${updateFields.numberOfPayments} payments left.`
            : `${invoice.targetName} has paid your invoice of $${invoice.amount}.`,
        app: 'settings',
        timeout: 5000
    };

    const notificationTarget = {
        id: notificationId2,
        title: 'Wallet',
        description: isRecurring
            ? `You have paid ${invoice.sourceName} an invoice of $${invoice.amount}, ${updateFields.numberOfPayments} payments left.`
            : `You have paid ${invoice.sourceName} an invoice of $${invoice.amount}.`,
        app: 'settings',
        timeout: 5000
    };

    const transactionCredit = {
        _id: transactionId1,
        from: invoice.to,
        to: invoice.from,
        amount: invoice.amount,
        type: 'credit',
        date: new Date().toISOString()
    };

    const transactionDebit = {
        _id: transactionId2,
        from: invoice.from,
        to: invoice.to,
        amount: invoice.amount,
        type: 'debit',
        date: new Date().toISOString()
    };

    await Promise.all([
        MongoDB.updateOne('phone_bank_invoices', { _id: id }, updateFields),
        MongoDB.insertOne('phone_bank_transactions', transactionCredit),
        MongoDB.insertOne('phone_bank_transactions', transactionDebit),
        emitNet('phone:addnotiFication', sourcePlayer.PlayerData.source, JSON.stringify(notificationSource)),
        emitNet('phone:addnotiFication', targetPlayer.PlayerData.source, JSON.stringify(notificationTarget))
    ]);

    return true;
});
onClientCallback('wallet:declineInvoicePayment', async (client, id: string) => {
    const res = await MongoDB.findOne('phone_bank_invoices', { _id: id });
    if (!res) return false;
    if (res.status === 'pending') {
        await MongoDB.updateOne('phone_bank_invoices', { _id: id }, { status: 'declined' });
        const sourcePlayer = await exports['qb-core'].GetPlayerByCitizenId(res.from);
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


export const InvoiceRecurringPayments = async () => {
    const todayMidnightEST = DateTime.now().setZone('America/New_York').startOf('day');
    const todayMidnightESTinUTC = todayMidnightEST.toUTC().toJSDate();

    const invoices = await MongoDB.findMany('phone_bank_invoices', {
        nextPaymentDate: { $lte: todayMidnightESTinUTC },
        numberOfPayments: { $gt: "0" }
    }) as PhoneBankInvoices[];

    for (const invoice of invoices) {
        if (invoice.nextPaymentDate === null) continue;

        if (!invoice.paymentTime || !invoice.numberOfPayments) continue;
        const paymentTime = parseInt(invoice.paymentTime, 10);
        const numberOfPayments = parseInt(invoice.numberOfPayments, 10);
        if (isNaN(paymentTime) || paymentTime < 0 || paymentTime > 4 || isNaN(numberOfPayments)) continue;

        const nextPaymentDateUTC = new Date(invoice.nextPaymentDate);
        const nextPaymentDateEST = DateTime.fromJSDate(nextPaymentDateUTC, { zone: 'utc' }).setZone('America/New_York');

        if (nextPaymentDateEST <= todayMidnightEST) {
            const targetPlayer = await exports['qb-core'].GetPlayerByCitizenId(invoice.to);
            if (!targetPlayer) continue;
            if (!(await targetPlayer.Functions.RemoveMoney('bank', invoice.amount))) {
                continue;
            }
            const sourcePlayer = await exports['qb-core'].GetPlayerByCitizenId(invoice.from);
            if (!sourcePlayer) continue;
            await sourcePlayer.Functions.AddMoney('bank', invoice.amount);

            const newNumberOfPayments = numberOfPayments - 1;
            let updateFields: Partial<PhoneBankInvoices> = {
                numberOfPayments: newNumberOfPayments.toString(),
                status: 'paid'
            };

            if (newNumberOfPayments > 0) {
                let nextPaymentDate: DateTime;
                switch (paymentTime) {
                    case 0: // Daily
                        nextPaymentDate = todayMidnightEST.plus({ days: 1 });
                        break;
                    case 1: // Weekly
                        nextPaymentDate = todayMidnightEST.plus({ weeks: 1 });
                        break;
                    case 2: // Monthly
                        nextPaymentDate = todayMidnightEST.plus({ months: 1 });
                        break;
                    case 3: // Quarterly
                        nextPaymentDate = todayMidnightEST.plus({ months: 3 });
                        break;
                    case 4: // Yearly
                        nextPaymentDate = todayMidnightEST.plus({ years: 1 });
                        break;
                    default:
                        console.error(`Invalid paymentTime: ${paymentTime}`);
                        continue; // Skip if invalid
                }
                updateFields.nextPaymentDate = nextPaymentDate.toUTC().toJSDate();
            } else {
                updateFields.paymentTime = "";
                updateFields.numberOfPayments = "";
                updateFields.nextPaymentDate = null;
            }

            const transactionId1 = generateUUid();
            const transactionId2 = generateUUid();
            const transactionCredit = {
                _id: transactionId1,
                from: invoice.to,
                to: invoice.from,
                amount: invoice.amount,
                type: 'credit',
                date: new Date().toISOString()
            };
            const transactionDebit = {
                _id: transactionId2,
                from: invoice.from,
                to: invoice.to,
                amount: invoice.amount,
                type: 'debit',
                date: new Date().toISOString()
            };

            await Promise.all([
                MongoDB.updateOne('phone_bank_invoices', { _id: invoice._id }, updateFields),
                MongoDB.insertOne('phone_bank_transactions', transactionCredit),
                MongoDB.insertOne('phone_bank_transactions', transactionDebit),
                console.log('Recurring Payment Processed', invoice._id, targetPlayer.Offline, sourcePlayer.Offline),
            ]);
            if (!targetPlayer.Offline) {
                emitNet('phone:addnotiFication', targetPlayer.PlayerData.source, JSON.stringify({
                    id: generateUUid(),
                    title: 'Wallet',
                    description: `You have paid ${invoice.sourceName} an invoice of $${invoice.amount}, ${updateFields.numberOfPayments} payments left.`,
                    app: 'settings',
                    timeout: 5000
                }));
            }
            if (!sourcePlayer.Offline) {
                emitNet('phone:addnotiFication', sourcePlayer.PlayerData.source, JSON.stringify({
                    id: generateUUid(),
                    title: 'Wallet',
                    description: `${invoice.targetName} has accepted your invoice of $${invoice.amount}, ${updateFields.numberOfPayments} payments left.`,
                    app: 'settings',
                    timeout: 5000
                }));
            }
        }
    }
};