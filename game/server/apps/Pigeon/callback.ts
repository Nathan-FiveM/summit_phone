import { onClientCallback } from "@overextended/ox_lib/server";
import { pigeonService } from "./PigeonService";

onClientCallback("pigeon:searchUsers", pigeonService.searchUserExist);
onClientCallback("pigeon:login", pigeonService.login);
onClientCallback("pigeon:signup", pigeonService.signup);
onClientCallback("pigeon:toggleNotifications", pigeonService.toggleNotifications);
onClientCallback("pigeon:postTweet", pigeonService.postTweet);
onClientCallback("pigeon:getProfile", pigeonService.getProfile);
onClientCallback("pigeon:getAllFeed", pigeonService.getAllFeed);
onClientCallback("pigeon:likeTweet", pigeonService.likeTweet);
onClientCallback("pigeon:retweetTweet", pigeonService.retweet);
onClientCallback("pigeon:deleteTweet", pigeonService.deleteTweet);
onClientCallback("pigeon:postReply", pigeonService.postReply);
onClientCallback("pigeon:getReplies", pigeonService.getPostReplies);
onClientCallback("pigeon:likeRepostTweet", pigeonService.likeRepliesTweet);
onClientCallback("pigeon:retweetRepostTweet", pigeonService.retweetRepliesTweet);
onClientCallback("pigeon:increaseRepliesCount", pigeonService.increaseRepliesCount);
onClientCallback("pigeon:decreaseRepliesCount", pigeonService.decreaseRepliesCount);
onClientCallback("pigeon:deleteRepliesTweet", pigeonService.deleteRepliesTweet);
onClientCallback("pigeon:followUser", pigeonService.followUser);
onClientCallback("pigeon:getUserTweets", pigeonService.getUserTweets);
onClientCallback('pigeon:getAllPostReplies', pigeonService.getAllPostReplies);
onClientCallback('pigeon:getAllLikedTweets', pigeonService.getAllLikedTweets);
onClientCallback('pigeon:searchUsersX', pigeonService.searchUsers);
onClientCallback('pigeon:getNotifications', pigeonService.getNotifications);
onClientCallback('pigeon:changePassword', pigeonService.changePassword);
onClientCallback('pigeon:updateProfile', pigeonService.updateProfile);

// Private Messaging Callbacks
onClientCallback('pigeon:sendPrivateMessage', pigeonService.sendPrivateMessage);
onClientCallback('pigeon:getPrivateMessages', pigeonService.getPrivateMessages);
onClientCallback('pigeon:getConversations', (client: number, data: string) => {
    return pigeonService.getConversations(client, data);
});
onClientCallback('pigeon:markMessageAsRead', pigeonService.markMessageAsRead);
onClientCallback('pigeon:deleteMessage', pigeonService.deleteMessage);

// Enhanced Followers/Following Callbacks
onClientCallback('pigeon:getFollowers', pigeonService.getFollowers);
onClientCallback('pigeon:getFollowing', pigeonService.getFollowing);