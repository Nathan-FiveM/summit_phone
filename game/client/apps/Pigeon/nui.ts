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

RegisterNuiCallbackType('likeTweet');
on('__cfx_nui:likeTweet', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:likeTweet', 1, data);
    cb(res);
});

RegisterNuiCallbackType('retweetTweet');
on('__cfx_nui:retweetTweet', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:retweetTweet', 1, data);
    cb(res);
});

RegisterNuiCallbackType('deleteTweet');
on('__cfx_nui:deleteTweet', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:deleteTweet', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getReplies');
on('__cfx_nui:getReplies', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getReplies', 1, data);
    cb(res);
});

RegisterCommand('postTweet', async (source: number, args: string[], raw: string) => {
    for (let i = 0; i < 40; i++) {
        const res = await triggerServerCallback('pigeon:postTweet', 1, "test@smrt.com", JSON.stringify({
            content: "Test Tweet " + i,
            attachments: ["https://cdn.summitrp.gg/uploads/ruxDWWQ7.png"]
        }));
    }
}, false);

RegisterCommand('postReply', async (source: number, args: string[], raw: string) => {
    const res = await triggerServerCallback('pigeon:postReply', 1, JSON.stringify({
        tweetId: "f98d97ba-f02a-47e7-9d71-0412621f631c",
        content: "Test Reply",
        email: "test@smrt.com",
        attachments: []
    }));
}, false);