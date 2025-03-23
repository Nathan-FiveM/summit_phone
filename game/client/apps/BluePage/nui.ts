import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType("bluepage:createPost");
on("__cfx_nui:bluepage:createPost", async (data: any) => {
    const res = await triggerServerCallback('bluepage:createPost', 1, data);
});

RegisterNuiCallbackType('bluepage:getPosts');
on('__cfx_nui:bluepage:getPosts', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('bluepage:getPosts', 1, data);
    cb(res);
});

RegisterNuiCallbackType('bluepage:deletePost');
on('__cfx_nui:bluepage:deletePost', async (data: string) => {
    const res = await triggerServerCallback('bluepage:deletePost', 1, data);
});