import { NUI } from '@client/classes/NUI';
import { triggerServerCallback } from '@overextended/ox_lib/client';

on('summit_phone:client:changeAvatarDark', async (email: string) => {
    NUI.sendReactMessage('phone:changeAvatar', email);
});

on('summit_phone:server:changePasswordDark', async (email: string) => {
    NUI.sendReactMessage('phone:changePassword', email);
});