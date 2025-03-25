import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('wallet:login');
on('__cfx_nui:wallet:login', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('wallet:login', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getDetailsXS');
on('__cfx_nui:getDetailsXS', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('getDetailsXS', 1, data);
    cb(res);
});

RegisterNuiCallbackType('transXAdqasddasdferMoney');
on('__cfx_nui:transXAdqasddasdferMoney', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('transXAdqasddasdferMoney', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getTransactions');
on('__cfx_nui:getTransactions', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('getTransactions', 1, data);
    cb(res);
});

RegisterNuiCallbackType('createInvoice');
on('__cfx_nui:createInvoice', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('wallet:createInvoice', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getInvoices');
on('__cfx_nui:getInvoices', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('wallet:getInvoices', 1, data);
    cb(res);
});

RegisterNuiCallbackType('acceptInvoicePayment');
on('__cfx_nui:acceptInvoicePayment', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('wallet:acceptInvoicePayment', 1, data);
    cb(res);
});

RegisterNuiCallbackType('declineInvoicePayment');
on('__cfx_nui:declineInvoicePayment', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('wallet:declineInvoicePayment', 1, data);
    cb(res);
});