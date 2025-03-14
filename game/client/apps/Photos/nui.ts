import { NUI } from "@client/classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('saveimageToPhotos');
on('__cfx_nui:saveimageToPhotos', async (data: string, cb: Function) => {
    const response: any = await triggerServerCallback('savePhotoToPhotos', 1, data);
    cb(response);
});

RegisterNuiCallbackType('getPhotos');
on('__cfx_nui:getPhotos', async (data: string, cb: Function) => {
    const response: any = await triggerServerCallback('getPhotos', 1, data);
    cb(response);
});

RegisterNuiCallbackType('selectPhoto');
on('__cfx_nui:selectPhoto', async (data: string, cb: Function) => {
    const dataX = [
        {
            name: 'View Photo',
            event: 'summit_phone:client:ViewPhoto',
            isServer: false,
            args: data
        },
        {
            name: 'Copy Link',
            event: 'summit_phone:client:copyLink',
            isServer: false,
            args: data
        },
        {
            name: 'Delete Photo',
            event: 'summit_phone:client:deletePhoto',
            isServer: false,
            args: data
        }
    ]
    NUI.sendReactMessage('phone:contextMenu', dataX);
    cb('ok');
});