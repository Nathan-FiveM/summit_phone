import { onClientCallback } from "@overextended/ox_lib/server";
import { pigeonService } from "./PigeonService";

/* setImmediate(() => {
    pigeonService.registerFeeds();
}); */

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


/* onClientCallback("pigeon:getUserTweets", pigeonService.getUserTweets);
onClientCallback("pigeon:getFeed", pigeonService.getFeed);
onClientCallback("pigeon:followUser", pigeonService.followUser);
onClientCallback("pigeon:unfollowUser", pigeonService.unfollowUser);

onClientCallback("pigeon:getFollowers", pigeonService.getFollowers);
onClientCallback("pigeon:getFollowing", pigeonService.getFollowing);
onClientCallback("pigeon:getTweetsByHashtag", pigeonService.getTweetsByHashtag);
onClientCallback("pigeon:getTrendingHashtags", pigeonService.getTrendingHashtags);
onClientCallback("pigeon:searchUserExist", pigeonService.searchUserExist); */