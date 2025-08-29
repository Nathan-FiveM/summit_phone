import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { Logger, MongoDB } from "@server/sv_main";
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
        Logger.AddLog({
            type: 'phone_bank_transactions',
            title: 'Money Transfer',
            message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} has transferred $${amount} to ${res.name}.`,
            showIdentifiers: false
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
    const { description, amount, paymentTime, numberOfPayments, isBusiness, receiver, } = JSON.parse(data) as {
        description: string;
        amount: number;
        paymentTime: number;
        numberOfPayments: number;
        isBusiness: 'No' | 'Yes';
        receiver: string;
    }; // paymentTime = 0 for daily, 1 for weekly, 2 for monthly and 3 for quarterly and 4 for yearly

    const sourcePlayer = await exports['qb-core'].GetPlayer(client);
    const targetPlayer = await exports['qb-core'].GetPlayer(receiver);
    if (!targetPlayer) return false;
    if (amount < 0) return false;
    const res = await MongoDB.insertOne('phone_bank_invoices', {
        _id: generateUUid(),
        from: sourcePlayer.PlayerData.citizenid,
        to: targetPlayer.PlayerData.citizenid,
        amount: amount,
        status: 'pending',
        isBusiness,
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
        Logger.AddLog({
            type: 'phone_bank_invoices',
            title: 'Invoice Created',
            message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} has sent an invoice of $${amount} to ${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname}.`,
            showIdentifiers: false
        });
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

type Recurrence = 0 | 1 | 2 | 3 | 4; // daily, weekly, monthly, quarterly, yearly

interface PhoneBankInvoiceDoc {
    _id: string;
    from: string; // citizenid of sender (the person/business requesting money)
    to: string;   // citizenid of target (the person who pays when accepting)
    amount: number;
    targetName: string;
    sourceName: string;
    status: 'pending' | 'active' | 'paid' | 'completed' | 'declined' | 'overdue';
    isBusiness: 'No' | 'Yes';
    paymentTime: Recurrence | ''; // '' means one-time, else recurrence code
    numberOfPayments: number | '';// '' means one-time, else total payments
    remainingPayments?: number;   // maintained for recurring
    nextPaymentDate?: string | null; // ISO
    lastAttemptAt?: string | null;   // ISO
    failedAttempts?: number;
    createdAt?: string; // ISO
    date?: string; // your original field
}

const COLLECTION = 'phone_bank_invoices';

// ───────────────────────────────────────────────────────────────────────────────
// QB helpers (adjust if your exports differ)
// ───────────────────────────────────────────────────────────────────────────────
const getPlayerBySource = async (src: number) => exports['qb-core'].GetPlayer(src);
const getPlayerByCitizenId = async (cid: string) => exports['qb-core'].GetPlayerByCitizenId?.(cid);

// Money ops: return boolean success
const debitBank = (player: any, amount: number) => player?.Functions?.RemoveMoney?.('bank', amount, 'invoice_payment') ?? false;
const creditBank = (player: any, amount: number) => player.Functions.AddMoney('bank', amount, 'invoice_received') ?? false;

const notify = (src: number, title: string, description: string, timeout = 5000) => {
    emitNet('phone:addnotiFication', src, JSON.stringify({
        id: generateUUid(),
        title, description, app: 'settings', timeout
    }));
};

const nowISO = () => new Date().toISOString();

const addInterval = (iso: string, rec: Recurrence): string => {
    const d = new Date(iso);
    switch (rec) {
        case 0: d.setDate(d.getDate() + 1); break;       // daily
        case 1: d.setDate(d.getDate() + 7); break;       // weekly
        case 2: d.setMonth(d.getMonth() + 1); break;     // monthly
        case 3: d.setMonth(d.getMonth() + 3); break;     // quarterly
        case 4: d.setFullYear(d.getFullYear() + 1); break; // yearly
    }
    return d.toISOString();
};

// ───────────────────────────────────────────────────────────────────────────────
// Business safe deposit (customize for your framework)
// ───────────────────────────────────────────────────────────────────────────────
/**
 * Try to deposit into a business management safe.
 * Strategy:
 *   - If the payer is paying to a business (invoice.isBusiness === 'Yes'),
 *     we deposit the money into the RECEIVER's job safe.
 *   - You might want to change this to a specific business id on the invoice,
 *     or a provided org key. Edit as needed.
 */
const depositToManagementSafe = async (receiverCitizenId: string, amount: number): Promise<boolean> => {
    try {
        const receiver = await getPlayerByCitizenId(receiverCitizenId);
        const jobName: string | undefined = receiver?.PlayerData?.job?.name;

        // TODO: Update this to your actual management resource API:
        // Common QBCore ecosystem uses qb-management: AddMoney(jobName, amount)
        if (jobName) {
            exports['summit_bank'].AddMoneyToBusinessAccount(jobName, amount);
            return true;
        }

        if (receiver) {
            return creditBank(receiver, amount);
        }
        return false;
    } catch (e) {
        console.error('depositToManagementSafe error:', e);
        return false;
    }
};

// Bank statement / logging (optional hook point)
const logBankEvent = (type: string, message: string) => Logger.AddLog({
    type: 'phone_bank_invoices',
    title: type,
    message,
    showIdentifiers: false
});

onClientCallback('wallet:acceptInvoicePayment', async (client: number, id: string) => {
    const payerPlayer = await getPlayerBySource(client); // the one clicking "accept" (must equal invoice.to)
    if (!payerPlayer) return false;

    const payerCid: string = payerPlayer.PlayerData?.citizenid;
    const invoice = await MongoDB.findOne(COLLECTION, { _id: id }) as PhoneBankInvoiceDoc;
    if (!invoice) return false;

    // Safety checks
    if (invoice.to !== payerCid) return false;                          // not your invoice
    if (invoice.status !== 'pending' && invoice.status !== 'active' && invoice.status !== 'overdue') return false;
    if (invoice.amount <= 0) return false;
    if (invoice.from === invoice.to) return false;                      // self-invoice silliness

    const requester = await getPlayerByCitizenId(invoice.from);

    const charged = debitBank(payerPlayer, invoice.amount);
    if (!charged) {
        // Couldn’t charge -> overdue for recurring or keep pending for one-time?
        const isRecurring = invoice.paymentTime !== '' && invoice.numberOfPayments !== '';
        if (isRecurring) {
            await MongoDB.updateOne(COLLECTION, { _id: id }, {
                status: 'overdue',
                lastAttemptAt: nowISO(),
                failedAttempts: (invoice.failedAttempts ?? 0) + 1
            });
        }
        notify(payerPlayer.PlayerData.source, 'Wallet', `Insufficient funds to pay $${invoice.amount}.`);
        return false;
    }

    // Payout
    let payoutOk = false;
    if (invoice.isBusiness === 'Yes') {
        const commission = 0.1;
        const commissionAmount = Math.round(invoice.amount * commission);
        const payoutAmount = Math.round(invoice.amount - commissionAmount);
        payoutOk = await depositToManagementSafe(invoice.from, payoutAmount);
        requester.Functions.AddMoney('bank', commissionAmount, 'invoice_received');
    } else {
        payoutOk = requester ? creditBank(requester, invoice.amount) : false;
    }

    if (!payoutOk) {
        // Refund payer since payout failed
        creditBank(payerPlayer, invoice.amount);
        notify(payerPlayer.PlayerData.source, 'Wallet', `Payment failed to deliver. Refunded $${invoice.amount}.`);
        return false;
    }

    // Update invoice status
    const isRecurring = (invoice.paymentTime !== '' && invoice.numberOfPayments !== '');
    if (!isRecurring) {
        await MongoDB.updateOne(COLLECTION, { _id: id }, {
            status: 'paid',
            nextPaymentDate: null,
            remainingPayments: 0,
            lastAttemptAt: nowISO()
        });
    } else {
        const total = Number(invoice.numberOfPayments);
        const prevRemaining = (invoice.remainingPayments == null)
            ? total                // first time activation
            : invoice.remainingPayments;

        const newRemaining = Math.max(0, prevRemaining - 1);

        let newStatus: PhoneBankInvoiceDoc['status'] = 'active';
        let nextDate: string | null = null;
        if (newRemaining <= 0) {
            newStatus = 'completed';
        } else {
            const baseDate = invoice.nextPaymentDate ?? nowISO();
            nextDate = addInterval(baseDate, Number(invoice.paymentTime) as Recurrence);
        }

        await MongoDB.updateOne(COLLECTION, { _id: id }, {
            status: newStatus,
            remainingPayments: newRemaining,
            lastAttemptAt: nowISO(),
            nextPaymentDate: nextDate,
            createdAt: invoice.createdAt ?? nowISO()
        });
    }

    // Notify both sides
    notify(payerPlayer.PlayerData.source, 'Wallet', `Paid $${invoice.amount} to ${invoice.sourceName}.`);
    if (requester?.PlayerData?.source) {
        notify(requester.PlayerData.source, 'Wallet', `${invoice.targetName} paid your invoice of $${invoice.amount}.`);
    }

    logBankEvent('Invoice Payment', `${invoice.targetName} paid $${invoice.amount} to ${invoice.sourceName}${invoice.isBusiness === 'Yes' ? ' (business)' : ''}.`);
    return true;
});

onClientCallback('wallet:declineInvoicePayment', async (client: number, id: string) => {
    const player = await getPlayerBySource(client);
    if (!player) return false;

    const cid = player.PlayerData?.citizenid;
    const invoice = await MongoDB.findOne(COLLECTION, { _id: id }) as PhoneBankInvoiceDoc;
    if (!invoice) return false;
    if (invoice.to !== cid) return false;
    if (invoice.status !== 'pending' && invoice.status !== 'active' && invoice.status !== 'overdue') return false;

    await MongoDB.updateOne(COLLECTION, { _id: id }, { status: 'declined', nextPaymentDate: null });

    const requester = await getPlayerByCitizenId(invoice.from);
    notify(player.PlayerData.source, 'Wallet', `Declined invoice of $${invoice.amount} from ${invoice.sourceName}.`);
    if (requester?.PlayerData?.source) {
        notify(requester.PlayerData.source, 'Wallet', `${invoice.targetName} declined your invoice of $${invoice.amount}.`);
    }

    logBankEvent('Invoice Declined', `${invoice.targetName} declined invoice from ${invoice.sourceName} for $${invoice.amount}.`);
    return true;
});


export const InvoiceRecurringPayments = async () => {
    const now = new Date().toISOString();

    const dueInvoices = await MongoDB.findMany(
        COLLECTION,
        {
            status: { $in: ['active', 'overdue'] },
            nextPaymentDate: { $lte: now },
            remainingPayments: { $gt: 0 }
        },
        null,
        false,
        { sort: { nextPaymentDate: 1 }, limit: 50 } // process in batches
    ) as PhoneBankInvoiceDoc[];

    for (const invoice of dueInvoices) {
        try {
            const payer = await getPlayerByCitizenId(invoice.to);
            if (!payer) {
                // Payer offline — choose your policy. We'll just mark attempt and retry later.
                await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, {
                    $set: { lastAttemptAt: nowISO(), failedAttempts: (invoice.failedAttempts ?? 0) + 1, status: 'overdue' }
                });
                continue;
            }

            // Try to charge via the same accept logic core (DRY-ish with a tiny internal call)
            // We inline minimal logic: debit payer
            const charged = debitBank(payer, invoice.amount);
            if (!charged) {
                await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, { lastAttemptAt: nowISO(), failedAttempts: (invoice.failedAttempts ?? 0) + 1, status: 'overdue' });
                notify(payer.PlayerData.source, 'Wallet', `Recurring invoice of $${invoice.amount} failed (insufficient funds).`);
                continue;
            }

            // Payout
            let payoutOk = false;
            if (invoice.isBusiness === 'Yes') {
                payoutOk = await depositToManagementSafe(invoice.from, invoice.amount);
            } else {
                const requester = await getPlayerByCitizenId(invoice.from);
                payoutOk = requester ? creditBank(requester, invoice.amount) : false;
            }

            if (!payoutOk) {
                // Refund
                creditBank(payer, invoice.amount);
                await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, { lastAttemptAt: nowISO(), failedAttempts: (invoice.failedAttempts ?? 0) + 1 });
                notify(payer.PlayerData.source, 'Wallet', `Recurring invoice payout failed; refunded $${invoice.amount}.`);
                continue;
            }

            // Progress recurrence
            const newRemaining = Math.max(0, (invoice.remainingPayments ?? Number(invoice.numberOfPayments)) - 1);
            let newStatus: PhoneBankInvoiceDoc['status'] = 'active';
            let nextDate: string | null = null;

            if (newRemaining <= 0) {
                newStatus = 'completed';
            } else {
                const base = invoice.nextPaymentDate ?? nowISO();
                nextDate = addInterval(base, Number(invoice.paymentTime) as Recurrence);
            }

            await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, {
                remainingPayments: newRemaining,
                status: newStatus,
                lastAttemptAt: nowISO(),
                nextPaymentDate: nextDate
            });

            notify(payer.PlayerData.source, 'Wallet', `Charged $${invoice.amount} for recurring invoice (${newRemaining} left).`);
            logBankEvent('Recurring Invoice Payment', `${invoice.targetName} paid $${invoice.amount} to ${invoice.sourceName}${invoice.isBusiness === 'Yes' ? ' (business)' : ''}.`);
        } catch (e) {
            console.error('Recurring payment error for', invoice._id, e);
            await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, {
                $set: { lastAttemptAt: nowISO(), failedAttempts: (invoice.failedAttempts ?? 0) + 1 }
            });
        }
    }
};