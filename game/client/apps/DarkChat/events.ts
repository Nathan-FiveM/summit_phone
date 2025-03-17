import { NUI } from '@client/classes/NUI';

on('summit_phone:client:changeAvatarDark', async (email: string) => {
    NUI.sendReactMessage('phone:changeAvatar', email);
});

on('summit_phone:server:changePasswordDark', async (email: string) => {
    NUI.sendReactMessage('phone:changePassword', email);
});

on('summit_phone:server:logoutDark', ()=>{
    NUI.sendReactMessage('phone:logoutDark', "");
})

onNet('summit_phone:client:receiveDarkChatMessage', async (data: string) => {
    NUI.sendReactMessage('phone:receiveDarkChatMessage', data);
});