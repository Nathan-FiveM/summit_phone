import { onClientCallback } from "@overextended/ox_lib/server";
import { MongoDB } from "@server/sv_main";
import PigeonService from "./PigeonService";

const pigeonService = new PigeonService(MongoDB);

onClientCallback("pigeon:signup", pigeonService.signup());
onClientCallback("pigeon:login", pigeonService.login());
onClientCallback("pigeon:logout", pigeonService.logout());
onClientCallback("pigeon:setProfile", pigeonService.setProfile());
onClientCallback("pigeon:toggleNotifications", pigeonService.toggleNotifications());
onClientCallback("pigeon:postTweet", pigeonService.postTweet());
onClientCallback("pigeon:retweet", pigeonService.retweet());
onClientCallback("pigeon:deleteTweet", pigeonService.deleteTweet());
onClientCallback("pigeon:getUserTweets", pigeonService.getUserTweets());
onClientCallback("pigeon:getFeed", pigeonService.getFeed());
onClientCallback("pigeon:followUser", pigeonService.followUser());
onClientCallback("pigeon:unfollowUser", pigeonService.unfollowUser());
onClientCallback("pigeon:likeTweet", pigeonService.likeTweet());
onClientCallback("pigeon:unlikeTweet", pigeonService.unlikeTweet());
onClientCallback("pigeon:getFollowers", pigeonService.getFollowers());
onClientCallback("pigeon:getFollowing", pigeonService.getFollowing());
onClientCallback("pigeon:searchUsers", pigeonService.searchUsers());
onClientCallback("pigeon:getTweetsByHashtag", pigeonService.getTweetsByHashtag());
onClientCallback("pigeon:getTrendingHashtags", pigeonService.getTrendingHashtags());
onClientCallback("pigeon:postReply", pigeonService.postReply());