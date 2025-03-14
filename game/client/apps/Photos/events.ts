import { NUI } from '@client/classes/NUI';
import { triggerServerCallback } from '@overextended/ox_lib/client';

on('summit_phone:client:ViewPhoto', (data: string) => {
    NUI.sendReactMessage('photos:viewPhoto', data);
});

on('summit_phone:client:copyLink', (data: string) => {
    NUI.sendReactMessage('photos:copyLink', data);
});

on('summit_phone:client:deletePhoto', async (data: string) => {
    const res = await triggerServerCallback('deletePhoto', 1, data);
    if (res) {
        NUI.sendReactMessage('phone:deletePhoto', data);
    }
});