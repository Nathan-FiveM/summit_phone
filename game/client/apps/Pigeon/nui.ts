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
    const res = await triggerServerCallback('pigeon:postTweet', 1, data);
    cb(res);
});

RegisterNuiCallbackType('postReply');
on('__cfx_nui:postReply', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:postReply', 1, data);
    cb(res);
});

RegisterNuiCallbackType('followUser');
on('__cfx_nui:followUser', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:followUser', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getUserTweets');
on('__cfx_nui:getUserTweets', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getUserTweets', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getRepliesX');
on('__cfx_nui:getRepliesX', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getAllPostReplies', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getAllLikedTweets');
on('__cfx_nui:getAllLikedTweets', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getAllLikedTweets', 1, data);
    cb(res);
});

RegisterNuiCallbackType('searchUsers');
on('__cfx_nui:searchUsers', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:searchUsersX', 1, data);
    cb(res);
});

RegisterNuiCallbackType('getNotifications');
on('__cfx_nui:getNotifications', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getNotifications', 1, data);
    cb(res);
});

RegisterNuiCallbackType('pigeon:changePassword');
on('__cfx_nui:pigeon:changePassword', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:changePassword', 1, data);
    cb(res);
});

RegisterNuiCallbackType('pigeon:updateProfile');
on('__cfx_nui:pigeon:updateProfile', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:updateProfile', 1, data);
    cb(res);
});

// Private Messaging Callbacks
RegisterNuiCallbackType('pigeon:sendPrivateMessage');
on('__cfx_nui:pigeon:sendPrivateMessage', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:sendPrivateMessage', 1, data);
    cb(res);
});

RegisterNuiCallbackType('pigeon:getPrivateMessages');
on('__cfx_nui:pigeon:getPrivateMessages', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getPrivateMessages', 1, data);
    cb(res);
});

RegisterNuiCallbackType('pigeon:getConversations');
on('__cfx_nui:pigeon:getConversations', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getConversations', 1, data);
    cb(res);
});

RegisterNuiCallbackType('pigeon:markMessageAsRead');
on('__cfx_nui:pigeon:markMessageAsRead', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:markMessageAsRead', 1, data);
    cb(res);
});

RegisterNuiCallbackType('pigeon:deleteMessage');
on('__cfx_nui:pigeon:deleteMessage', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:deleteMessage', 1, data);
    cb(res);
});

// Enhanced Followers/Following Callbacks
RegisterNuiCallbackType('pigeon:getFollowers');
on('__cfx_nui:pigeon:getFollowers', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getFollowers', 1, data);
    cb(res);
});

RegisterNuiCallbackType('pigeon:getFollowing');
on('__cfx_nui:pigeon:getFollowing', async (data: string, cb: Function) => {
    const res = await triggerServerCallback('pigeon:getFollowing', 1, data);
    cb(res);
});

// RegisterCommand('testPost', async (source: any, args: any) => {
//     const res = await triggerServerCallback('pigeon:postTweet', 1, JSON.stringify({
//         email: 'test@smrt.com',
//         content: 'test post',
//         attachments: [],
//     }));
// }, false);