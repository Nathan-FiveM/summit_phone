import { NUI } from '@client/classes/NUI';

onNet('summit_phone:client:refreshmailMessages', async (data: any) => {
    NUI.sendReactMessage('updateEmailMessages', data);
});