import { triggerServerCallback } from "@overextended/ox_lib/client";

RegisterNuiCallbackType('searchPigeonEmail');
on('__cfx_nui:searchPigeonEmail', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:searchUsers', 1, data);
    cb(res);
});

RegisterNuiCallbackType('loginPegionEmail');
on('__cfx_nui:loginPegionEmail', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:login', 1, data);
    cb(res);
});

RegisterNuiCallbackType('signupPegionEmail');
on('__cfx_nui:signupPegionEmail', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:signup', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getPlayerspigeonProfile');
on('__cfx_nui:getPlayerspigeonProfile', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getProfile', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getAllTweets');
on('__cfx_nui:getAllTweets', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getAllFeed', 1, data);
    cb(res);
});


RegisterCommand('postTweet', async (source: number, args: string[], raw: string) => {
    for (let i = 0; i < 40; i++) {
        const res = await triggerServerCallback('pigeon:postTweet', 1, "test@smrt.com", JSON.stringify({
            content: "Test Tweet " + i,
            attachments: ["a", "b"]
        }));
    }
}, false);