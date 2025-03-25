import { NUI } from "@client/classes/NUI";

onNet('QBCore:Client:OnMoneyChange', async (moneytype: string, amount: number, type: string) => {
    if (moneytype === 'bank') {
        NUI.sendReactMessage('updateWalletamount', { type, amount });
    }
});