import { generateUUid } from "@shared/utils";

class PigeonService {
    private mongoDB: any;

    constructor(mongoDB: any) {
        this.mongoDB = mongoDB;
    }

    private async getCitizenId(client: number): Promise<string> {
        return await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
    }

    private async hasProfile(citizenId: string): Promise<boolean> {
        const user = await this.mongoDB.findOne("phone_pigeon_users", { _id: citizenId });
        return !!user;
    }

    private async getUsernameByCitizenId(citizenId: string): Promise<string | null> {
        const user = await this.mongoDB.findOne("phone_pigeon_users", { _id: citizenId });
        return user ? user.username : null;
    }

    private parseMentions(content: string): string[] {
        const mentionRegex = /@(\w+)/g;
        const matches = content.match(mentionRegex);
        return matches ? matches.map((m) => m.slice(1)) : [];
    }

    private async isLoggedIn(citizenId: string): Promise<boolean> {
        const user = await this.mongoDB.findOne("phone_pigeon_users", { _id: citizenId });
        return user && user.loggedIn;
    }

    signup() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                const existingProfile = await this.mongoDB.findOne("phone_pigeon_users", { _id: citizenId });
                if (existingProfile) {
                    return { error: "Profile already exists for this citizenId" };
                }
                const { username, password } = JSON.parse(data);
                const existingUsername = await this.mongoDB.findOne("phone_pigeon_users", { username });
                if (existingUsername) {
                    return { error: "Username already taken" };
                }
                await this.mongoDB.insertOne("phone_pigeon_users", {
                    _id: citizenId,
                    username,
                    password,
                    loggedIn: false,
                    displayName: username,
                    avatar: "",
                    notificationsEnabled: true,
                });
                return true;
            } catch (error) {
                console.error("Error in signup:", error);
                return { error: "An error occurred" };
            }
        };
    }

    login() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                const { username, password } = JSON.parse(data);
                const user = await this.mongoDB.findOne("phone_pigeon_users", { username, _id: citizenId });
                if (!user) {
                    return { error: "User not found" };
                }
                if (user.password !== password) {
                    return { error: "Invalid password" };
                }
                await this.mongoDB.updateOne(
                    "phone_pigeon_users",
                    { _id: citizenId },
                    { $set: { loggedIn: true } }
                );
                return true;
            } catch (error) {
                console.error("Error in login:", error);
                return { error: "An error occurred" };
            }
        };
    }

    logout() {
        return async (client: number) => {
            try {
                const citizenId = await this.getCitizenId(client);
                await this.mongoDB.updateOne(
                    "phone_pigeon_users",
                    { _id: citizenId },
                    { $set: { loggedIn: false } }
                );
                return true;
            } catch (error) {
                console.error("Error in logout:", error);
                return { error: "An error occurred" };
            }
        };
    }

    setProfile() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const { displayName } = JSON.parse(data);
                await this.mongoDB.updateOne(
                    "phone_pigeon_users",
                    { _id: citizenId },
                    { $set: { displayName } }
                );
                return true;
            } catch (error) {
                console.error("Error in setProfile:", error);
                return { error: "An error occurred" };
            }
        };
    }

    getMyProfile() {
        return async (client: number) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const profile = await this.mongoDB.findOne("phone_pigeon_users", { _id: citizenId });
                return profile || null;
            } catch (error) {
                console.error("Error in getMyProfile:", error);
                return { error: "An error occurred" };
            }
        };
    }

    getProfile() {
        return async (client: number, targetUsername: string) => {
            try {
                const targetUser = await this.mongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                return targetUser;
            } catch (error) {
                console.error("Error in getProfile:", error);
                return { error: "An error occurred" };
            }
        };
    }

    toggleNotifications() {
        return async (client: number) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const user = await this.mongoDB.findOne("phone_pigeon_users", { _id: citizenId });
                if (!user) {
                    return { error: "Profile not set" };
                }
                const newStatus = !user.notificationsEnabled;
                await this.mongoDB.updateOne(
                    "phone_pigeon_users",
                    { _id: citizenId },
                    { $set: { notificationsEnabled: newStatus } }
                );
                return { notificationsEnabled: newStatus };
            } catch (error) {
                console.error("Error in toggleNotifications:", error);
                return { error: "An error occurred" };
            }
        };
    }

    postTweet() {
        return async (client: number, content: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                if (!(await this.hasProfile(citizenId))) {
                    return { error: "Profile not set" };
                }

                const tweet = {
                    _id: generateUUid(),
                    userId: citizenId,
                    content,
                    createdAt: new Date().toISOString(),
                    likeCount: 0,
                    retweetCount: 0,
                    isRetweet: false,
                    originalTweetId: null,
                    hashtags: content.match(/#\w+/g) || [],
                    parentTweetId: null,
                };
                await this.mongoDB.insertOne("phone_pigeon_tweets", tweet);

                const mentions = this.parseMentions(content);
                for (const username of mentions) {
                    const mentionedUser = await this.mongoDB.findOne("phone_pigeon_users", { username });
                    if (mentionedUser && mentionedUser.notificationsEnabled) {
                        const mentionedSource = await global.exports["qb-core"].GetSourceByCitizenId(mentionedUser._id);
                        if (mentionedSource) {
                            emitNet("pigeon:notifyMention", mentionedSource, {
                                tweetId: tweet._id,
                                content: tweet.content,
                            });
                        }
                    }
                }
                return tweet;
            } catch (error) {
                console.error("Error in postTweet:", error);
                return { error: "An error occurred" };
            }
        };
    }

    postReply() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const { parentTweetId, content } = JSON.parse(data);
                if (!(await this.hasProfile(citizenId))) {
                    return { error: "Profile not set" };
                }
                const parentTweet = await this.mongoDB.findOne("phone_pigeon_tweets", { _id: parentTweetId });
                if (!parentTweet) {
                    return { error: "Parent tweet not found" };
                }
                const reply = {
                    _id: generateUUid(),
                    userId: citizenId,
                    content,
                    createdAt: new Date().toISOString(),
                    likeCount: 0,
                    retweetCount: 0,
                    isRetweet: false,
                    originalTweetId: null,
                    hashtags: content.match(/#\w+/g) || [],
                    parentTweetId,
                };
                await this.mongoDB.insertOne("phone_pigeon_tweets", reply);

                const parentUser = await this.mongoDB.findOne("phone_pigeon_users", { _id: parentTweet.userId });
                if (parentUser && parentUser.notificationsEnabled) {
                    const parentSource = await global.exports["qb-core"].GetSourceByCitizenId(parentTweet.userId);
                    if (parentSource) {
                        emitNet("pigeon:notifyReply", parentSource, {
                            replyId: reply._id,
                            content: reply.content,
                            parentTweetId,
                        });
                    }
                }
                return reply;
            } catch (error) {
                console.error("Error in postReply:", error);
                return { error: "An error occurred" };
            }
        };
    }

    retweet() {
        return async (client: number, originalTweetId: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                if (!(await this.hasProfile(citizenId))) {
                    return { error: "Profile not set" };
                }
                const originalTweet = await this.mongoDB.findOne("phone_pigeon_tweets", { _id: originalTweetId });
                if (!originalTweet) {
                    return { error: "Original tweet not found" };
                }
                const retweet = {
                    _id: generateUUid(),
                    userId: citizenId,
                    content: originalTweet.content,
                    createdAt: new Date().toISOString(),
                    likeCount: 0,
                    retweetCount: 0,
                    isRetweet: true,
                    originalTweetId: originalTweetId,
                    hashtags: originalTweet.hashtags || [],
                    parentTweetId: null,
                };
                await this.mongoDB.insertOne("phone_pigeon_tweets", retweet);
                await this.mongoDB.updateOne(
                    "phone_pigeon_tweets",
                    { _id: originalTweetId },
                    { $inc: { retweetCount: 1 } }
                );
                return retweet;
            } catch (error) {
                console.error("Error in retweet:", error);
                return { error: "An error occurred" };
            }
        };
    }

    deleteTweet() {
        return async (client: number, tweetId: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const tweet = await this.mongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
                if (!tweet) {
                    return { error: "Tweet not found" };
                }
                if (tweet.userId !== citizenId) {
                    return { error: "Not authorized to delete this tweet" };
                }
                await this.mongoDB.deleteOne("phone_pigeon_tweets", { _id: tweetId });
                await this.mongoDB.deleteMany("phone_pigeon_likes", { tweetId });
                return true;
            } catch (error) {
                console.error("Error in deleteTweet:", error);
                return { error: "An error occurred" };
            }
        };
    }

    getUserTweets() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const { targetUsername, page = 1, limit = 20 } = JSON.parse(data);
                const targetUser = await this.mongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                const skip = (page - 1) * limit;
                const tweets = await this.mongoDB.findMany(
                    "phone_pigeon_tweets",
                    { userId: targetUser._id },
                    { sort: { createdAt: -1 }, skip, limit }
                );
                const tweetIds = tweets.map((t: any) => t._id);
                const likes = await this.mongoDB.findMany("phone_pigeon_likes", {
                    tweetId: { $in: tweetIds },
                    userId: citizenId,
                });
                const likedTweetIds = new Set(likes.map((l: any) => l.tweetId));
                tweets.forEach((t: any) => {
                    t.likedByMe = likedTweetIds.has(t._id);
                    t.retweetCount = t.retweetCount || 0;
                });
                return tweets;
            } catch (error) {
                console.error("Error in getUserTweets:", error);
                return { error: "An error occurred" };
            }
        };
    }

    getFeed() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                if (!(await this.hasProfile(citizenId))) {
                    return { error: "Profile not set" };
                }
                const { since, page = 1, limit = 20 } = JSON.parse(data || "{}");
                const follows = await this.mongoDB.findMany("phone_pigeon_follows", { followerId: citizenId });
                const followedUserIds: string[] = follows.map((f: { followeeId: string }) => f.followeeId);
                const query: any = { userId: { $in: followedUserIds } };
                if (since) query.createdAt = { $gt: since };
                const skip = (page - 1) * limit;
                const tweets = await this.mongoDB.findMany("phone_pigeon_tweets", query, {
                    sort: { createdAt: -1 },
                    skip,
                    limit,
                });
                const tweetIds: string[] = tweets.map((t: { _id: string }) => t._id);
                const likes = await this.mongoDB.findMany("phone_pigeon_likes", {
                    tweetId: { $in: tweetIds },
                    userId: citizenId,
                });
                const likedTweetIds = new Set<string>(likes.map((l: { tweetId: string }) => l.tweetId));
                tweets.forEach((t: any) => {
                    t.likedByMe = likedTweetIds.has(t._id);
                    t.retweetCount = t.retweetCount || 0;
                });
                return tweets;
            } catch (error) {
                console.error("Error in getFeed:", error);
                return { error: "An error occurred" };
            }
        };
    }

    followUser() {
        return async (client: number, targetUsername: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const targetUser = await this.mongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                if (citizenId === targetUser._id) {
                    return { error: "Cannot follow yourself" };
                }
                const existingFollow = await this.mongoDB.findOne("phone_pigeon_follows", {
                    followerId: citizenId,
                    followeeId: targetUser._id,
                });
                if (existingFollow) {
                    return { error: "Already following" };
                }
                await this.mongoDB.insertOne("phone_pigeon_follows", {
                    _id: generateUUid(),
                    followerId: citizenId,
                    followeeId: targetUser._id,
                });
                if (targetUser.notificationsEnabled) {
                    const followerUsername = await this.getUsernameByCitizenId(citizenId);
                    const followeeSource = await global.exports["qb-core"].GetSourceByCitizenId(targetUser._id);
                    if (followeeSource) {
                        emitNet("pigeon:notifyFollow", followeeSource, {
                            followerUsername,
                        });
                    }
                }
                return true;
            } catch (error) {
                console.error("Error in followUser:", error);
                return { error: "An error occurred" };
            }
        };
    }

    unfollowUser() {
        return async (client: number, targetUsername: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const targetUser = await this.mongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                await this.mongoDB.deleteOne("phone_pigeon_follows", {
                    followerId: citizenId,
                    followeeId: targetUser._id,
                });
                return true;
            } catch (error) {
                console.error("Error in unfollowUser:", error);
                return { error: "An error occurred" };
            }
        };
    }

    likeTweet() {
        return async (client: number, tweetId: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const tweet = await this.mongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
                if (!tweet) {
                    return { error: "Tweet not found" };
                }
                const existingLike = await this.mongoDB.findOne("phone_pigeon_likes", {
                    tweetId,
                    userId: citizenId,
                });
                if (existingLike) {
                    return { error: "Already liked" };
                }
                const like = { _id: generateUUid(), tweetId, userId: citizenId };
                await this.mongoDB.insertOne("phone_pigeon_likes", like);
                await this.mongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, { $inc: { likeCount: 1 } });

                if (tweet.userId !== citizenId) {
                    const tweetOwner = await this.mongoDB.findOne("phone_pigeon_users", { _id: tweet.userId });
                    if (tweetOwner && tweetOwner.notificationsEnabled) {
                        const likerUsername = await this.getUsernameByCitizenId(citizenId);
                        const tweetOwnerSource = await global.exports["qb-core"].GetSourceByCitizenId(tweet.userId);
                        if (tweetOwnerSource) {
                            emitNet("pigeon:notifyLike", tweetOwnerSource, {
                                likerUsername,
                                tweetId,
                            });
                        }
                    }
                }
                return true;
            } catch (error) {
                console.error("Error in likeTweet:", error);
                return { error: "An error occurred" };
            }
        };
    }

    unlikeTweet() {
        return async (client: number, tweetId: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const like = await this.mongoDB.findOne("phone_pigeon_likes", { tweetId, userId: citizenId });
                if (!like) {
                    return { error: "Not liked" };
                }
                await this.mongoDB.deleteOne("phone_pigeon_likes", { _id: like._id });
                await this.mongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, { $inc: { likeCount: -1 } });
                return true;
            } catch (error) {
                console.error("Error in unlikeTweet:", error);
                return { error: "An error occurred" };
            }
        };
    }

    getFollowers() {
        return async (client: number, targetUsername: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const targetUser = await this.mongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                const followers = await this.mongoDB.findMany("phone_pigeon_follows", { followeeId: targetUser._id });
                const followerIds = followers.map((f: any) => f.followerId);
                const followerProfiles = await this.mongoDB.findMany("phone_pigeon_users", { _id: { $in: followerIds } });
                return followerProfiles;
            } catch (error) {
                console.error("Error in getFollowers:", error);
                return { error: "An error occurred" };
            }
        };
    }

    getFollowing() {
        return async (client: number, targetUsername: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const targetUser = await this.mongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                const following = await this.mongoDB.findMany("phone_pigeon_follows", { followerId: targetUser._id });
                const followingIds = following.map((f: any) => f.followeeId);
                const followingProfiles = await this.mongoDB.findMany("phone_pigeon_users", { _id: { $in: followingIds } });
                return followingProfiles;
            } catch (error) {
                console.error("Error in getFollowing:", error);
                return { error: "An error occurred" };
            }
        };
    }

    searchUsers() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const { searchTerm, page = 1, limit = 20 } = JSON.parse(data);
                const regex = new RegExp(searchTerm, "i");
                const skip = (page - 1) * limit;
                const users = await this.mongoDB.findMany(
                    "phone_pigeon_users",
                    { username: { $regex: regex } },
                    { skip, limit }
                );
                return users;
            } catch (error) {
                console.error("Error in searchUsers:", error);
                return { error: "An error occurred" };
            }
        };
    }

    getTweetsByHashtag() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const { hashtag, page = 1, limit = 20 } = JSON.parse(data);
                const skip = (page - 1) * limit;
                const tweets = await this.mongoDB.findMany(
                    "phone_pigeon_tweets",
                    { hashtags: hashtag },
                    { sort: { createdAt: -1 }, skip, limit }
                );
                const tweetIds = tweets.map((t: any) => t._id);
                const likes = await this.mongoDB.findMany("phone_pigeon_likes", {
                    tweetId: { $in: tweetIds },
                    userId: citizenId,
                });
                const likedTweetIds = new Set(likes.map((l: any) => l.tweetId));
                tweets.forEach((t: any) => {
                    t.likedByMe = likedTweetIds.has(t._id);
                    t.retweetCount = t.retweetCount || 0;
                });
                return tweets;
            } catch (error) {
                console.error("Error in getTweetsByHashtag:", error);
                return { error: "An error occurred" };
            }
        };
    }

    getTrendingHashtags() {
        return async (client: number) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const trending = await this.mongoDB.aggregate("phone_pigeon_tweets", [
                    { $unwind: "$hashtags" },
                    { $group: { _id: "$hashtags", count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 10 },
                ]);
                return trending.map((item: any) => item._id);
            } catch (error) {
                console.error("Error in getTrendingHashtags:", error);
                return { error: "An error occurred" };
            }
        };
    }
}

export default PigeonService;