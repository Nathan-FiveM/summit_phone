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

RegisterNuiCallbackType('likeRepostTweet');
on('__cfx_nui:likeRepostTweet', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:likeRepostTweet', 1, data);
    cb(res);
});

RegisterNuiCallbackType('retweetTweet');
on('__cfx_nui:retweetTweet', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:retweetTweet', 1, data);
    cb(res);
});

RegisterNuiCallbackType('retweetRepostTweet');
on('__cfx_nui:retweetRepostTweet', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:retweetRepostTweet', 1, data);
    cb(res);
});

RegisterNuiCallbackType('increaseRepliesCount');
on('__cfx_nui:increaseRepliesCount', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:increaseRepliesCount', 1, data);
    cb(res);
});
RegisterNuiCallbackType('decreaseRepliesCount');
on('__cfx_nui:decreaseRepliesCount', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:decreaseRepliesCount', 1, data);
    cb(res);
});

RegisterNuiCallbackType('deleteRepliesTweet');
on('__cfx_nui:deleteRepliesTweet', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:deleteRepliesTweet', 1, data);
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

RegisterNuiCallbackType('getProfile');
on('__cfx_nui:getProfile', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getProfile', 1, data);
    cb(res);
});

RegisterNuiCallbackType('postTweet');
on('__cfx_nui:postTweet', async (data: string, cb: Function) => {
    const { email } = JSON.parse(data);
    const res = await triggerServerCallback('pigeon:postTweet', 1, email, data);
    cb(res);
});

RegisterNuiCallbackType('postReply');
on('__cfx_nui:postReply', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:postReply', 1, data);
    cb(res);
});

/* RegisterCommand('postTweet', async (source: number, args: string[], raw: string) => {
    for (let i = 0; i < 40; i++) {
        const res = await triggerServerCallback('pigeon:postTweet', 1, "test@smrt.com", JSON.stringify({
            content: "Test Tweet " + i,
            attachments: ["https://cdn.summitrp.gg/uploads/ruxDWWQ7.png"]
        }));
    }
}, false);

RegisterCommand('postReply', async (source: number, args: string[], raw: string) => {
    const res = await triggerServerCallback('pigeon:postReply', 1, JSON.stringify({
        tweetId: args[0],
        content: "Test Reply",
        email: "test@smrt.com",
        attachments: []
    }));
}, false); */