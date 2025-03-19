import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

class PigeonService {
    private mongoDB: any;

    constructor(mongoDB: any) {
        this.mongoDB = mongoDB;
    }

    /** Retrieves the citizen ID for a given client source. */
    private async getCitizenId(client: number): Promise<string> {
        return await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
    }

    /** Checks if a user has a Pigeon profile. */
    private async hasProfile(citizenId: string): Promise<boolean> {
        const user = await this.mongoDB.findOne("pigeon_users", { _id: citizenId });
        return !!user;
    }

    /** Retrieves the username for a given citizen ID. */
    private async getUsernameByCitizenId(citizenId: string): Promise<string | null> {
        const user = await this.mongoDB.findOne("pigeon_users", { _id: citizenId });
        return user ? user.username : null;
    }

    /** Parses mentions from tweet content. */
    private parseMentions(content: string): string[] {
        const mentionRegex = /@(\w+)/g;
        const matches = content.match(mentionRegex);
        return matches ? matches.map((m) => m.slice(1)) : [];
    }

    /** Checks if the user is logged in. */
    private async isLoggedIn(citizenId: string): Promise<boolean> {
        const user = await this.mongoDB.findOne("pigeon_users", { _id: citizenId });
        return user && user.loggedIn;
    }

    /** Signs up a new user with username and password. */
    signup() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                const existingProfile = await this.mongoDB.findOne("pigeon_users", { _id: citizenId });
                if (existingProfile) {
                    return { error: "Profile already exists for this citizenId" };
                }
                const { username, password } = JSON.parse(data);
                const existingUsername = await this.mongoDB.findOne("pigeon_users", { username });
                if (existingUsername) {
                    return { error: "Username already taken" };
                }
                await this.mongoDB.insertOne("pigeon_users", {
                    _id: citizenId,
                    username,
                    password, // Stored in plain text as per requirement (Note: Use hashing in production)
                    loggedIn: false,
                    displayName: username, // Default display name to username
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

    /** Logs in the user if credentials are correct. */
    login() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                const { username, password } = JSON.parse(data);
                const user = await this.mongoDB.findOne("pigeon_users", { username, _id: citizenId });
                if (!user) {
                    return { error: "User not found" };
                }
                if (user.password !== password) {
                    return { error: "Invalid password" };
                }
                await this.mongoDB.updateOne(
                    "pigeon_users",
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

    /** Logs out the user. */
    logout() {
        return async (client: number) => {
            try {
                const citizenId = await this.getCitizenId(client);
                await this.mongoDB.updateOne(
                    "pigeon_users",
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

    /** Sets or updates a user's Pigeon profile. Requires login. */
    setProfile() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const { displayName } = JSON.parse(data);
                await this.mongoDB.updateOne(
                    "pigeon_users",
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

    /** Retrieves the current user's Pigeon profile. Requires login. */
    getMyProfile() {
        return async (client: number) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const profile = await this.mongoDB.findOne("pigeon_users", { _id: citizenId });
                return profile || null;
            } catch (error) {
                console.error("Error in getMyProfile:", error);
                return { error: "An error occurred" };
            }
        };
    }

    /** Retrieves a user's profile by username. */
    getProfile() {
        return async (client: number, targetUsername: string) => {
            try {
                const targetUser = await this.mongoDB.findOne("pigeon_users", { username: targetUsername });
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

    /** Toggles notifications for the user. Requires login. */
    toggleNotifications() {
        return async (client: number) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const user = await this.mongoDB.findOne("pigeon_users", { _id: citizenId });
                if (!user) {
                    return { error: "Profile not set" };
                }
                const newStatus = !user.notificationsEnabled;
                await this.mongoDB.updateOne(
                    "pigeon_users",
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

    /** Posts a new tweet for the user. Requires login. */
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
                    parentTweetId: null, // Original tweets have no parent
                };
                await this.mongoDB.insertOne("pigeon_tweets", tweet);

                const mentions = this.parseMentions(content);
                for (const username of mentions) {
                    const mentionedUser = await this.mongoDB.findOne("pigeon_users", { username });
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

    /** Posts a reply to an existing tweet. Requires login. */
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
                const parentTweet = await this.mongoDB.findOne("pigeon_tweets", { _id: parentTweetId });
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
                    parentTweetId, // Link to the parent tweet
                };
                await this.mongoDB.insertOne("pigeon_tweets", reply);

                const parentUser = await this.mongoDB.findOne("pigeon_users", { _id: parentTweet.userId });
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

    /** Retweets an existing tweet. Requires login. */
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
                const originalTweet = await this.mongoDB.findOne("pigeon_tweets", { _id: originalTweetId });
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
                await this.mongoDB.insertOne("pigeon_tweets", retweet);
                await this.mongoDB.updateOne(
                    "pigeon_tweets",
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

    /** Deletes a tweet. Requires login. */
    deleteTweet() {
        return async (client: number, tweetId: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const tweet = await this.mongoDB.findOne("pigeon_tweets", { _id: tweetId });
                if (!tweet) {
                    return { error: "Tweet not found" };
                }
                if (tweet.userId !== citizenId) {
                    return { error: "Not authorized to delete this tweet" };
                }
                await this.mongoDB.deleteOne("pigeon_tweets", { _id: tweetId });
                await this.mongoDB.deleteMany("pigeon_likes", { tweetId });
                return true;
            } catch (error) {
                console.error("Error in deleteTweet:", error);
                return { error: "An error occurred" };
            }
        };
    }

    /** Retrieves tweets from a specific user with pagination. Requires login. */
    getUserTweets() {
        return async (client: number, data: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const { targetUsername, page = 1, limit = 20 } = JSON.parse(data);
                const targetUser = await this.mongoDB.findOne("pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                const skip = (page - 1) * limit;
                const tweets = await this.mongoDB.findMany(
                    "pigeon_tweets",
                    { userId: targetUser._id },
                    { sort: { createdAt: -1 }, skip, limit }
                );
                const tweetIds = tweets.map((t: any) => t._id);
                const likes = await this.mongoDB.findMany("pigeon_likes", {
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

    /** Retrieves the user's feed with pagination. Requires login. */
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
                const follows = await this.mongoDB.findMany("pigeon_follows", { followerId: citizenId });
                const followedUserIds: string[] = follows.map((f: { followeeId: string }) => f.followeeId);
                const query: any = { userId: { $in: followedUserIds } };
                if (since) query.createdAt = { $gt: since };
                const skip = (page - 1) * limit;
                const tweets = await this.mongoDB.findMany("pigeon_tweets", query, {
                    sort: { createdAt: -1 },
                    skip,
                    limit,
                });
                const tweetIds: string[] = tweets.map((t: { _id: string }) => t._id);
                const likes = await this.mongoDB.findMany("pigeon_likes", {
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

    /** Follows another user. Requires login. */
    followUser() {
        return async (client: number, targetUsername: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const targetUser = await this.mongoDB.findOne("pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                if (citizenId === targetUser._id) {
                    return { error: "Cannot follow yourself" };
                }
                const existingFollow = await this.mongoDB.findOne("pigeon_follows", {
                    followerId: citizenId,
                    followeeId: targetUser._id,
                });
                if (existingFollow) {
                    return { error: "Already following" };
                }
                await this.mongoDB.insertOne("pigeon_follows", {
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

    /** Unfollows a user. Requires login. */
    unfollowUser() {
        return async (client: number, targetUsername: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const targetUser = await this.mongoDB.findOne("pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                await this.mongoDB.deleteOne("pigeon_follows", {
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

    /** Likes a tweet. Requires login. */
    likeTweet() {
        return async (client: number, tweetId: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const tweet = await this.mongoDB.findOne("pigeon_tweets", { _id: tweetId });
                if (!tweet) {
                    return { error: "Tweet not found" };
                }
                const existingLike = await this.mongoDB.findOne("pigeon_likes", {
                    tweetId,
                    userId: citizenId,
                });
                if (existingLike) {
                    return { error: "Already liked" };
                }
                const like = { _id: generateUUid(), tweetId, userId: citizenId };
                await this.mongoDB.insertOne("pigeon_likes", like);
                await this.mongoDB.updateOne("pigeon_tweets", { _id: tweetId }, { $inc: { likeCount: 1 } });

                if (tweet.userId !== citizenId) {
                    const tweetOwner = await this.mongoDB.findOne("pigeon_users", { _id: tweet.userId });
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

    /** Unlikes a tweet. Requires login. */
    unlikeTweet() {
        return async (client: number, tweetId: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const like = await this.mongoDB.findOne("pigeon_likes", { tweetId, userId: citizenId });
                if (!like) {
                    return { error: "Not liked" };
                }
                await this.mongoDB.deleteOne("pigeon_likes", { _id: like._id });
                await this.mongoDB.updateOne("pigeon_tweets", { _id: tweetId }, { $inc: { likeCount: -1 } });
                return true;
            } catch (error) {
                console.error("Error in unlikeTweet:", error);
                return { error: "An error occurred" };
            }
        };
    }

    /** Retrieves the list of followers for a user. Requires login. */
    getFollowers() {
        return async (client: number, targetUsername: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const targetUser = await this.mongoDB.findOne("pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                const followers = await this.mongoDB.findMany("pigeon_follows", { followeeId: targetUser._id });
                const followerIds = followers.map((f: any) => f.followerId);
                const followerProfiles = await this.mongoDB.findMany("pigeon_users", { _id: { $in: followerIds } });
                return followerProfiles;
            } catch (error) {
                console.error("Error in getFollowers:", error);
                return { error: "An error occurred" };
            }
        };
    }

    /** Retrieves the list of users a target user is following. Requires login. */
    getFollowing() {
        return async (client: number, targetUsername: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const targetUser = await this.mongoDB.findOne("pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                const following = await this.mongoDB.findMany("pigeon_follows", { followerId: targetUser._id });
                const followingIds = following.map((f: any) => f.followeeId);
                const followingProfiles = await this.mongoDB.findMany("pigeon_users", { _id: { $in: followingIds } });
                return followingProfiles;
            } catch (error) {
                console.error("Error in getFollowing:", error);
                return { error: "An error occurred" };
            }
        };
    }

    /** Searches for users by partial username match with pagination. Requires login. */
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
                    "pigeon_users",
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

    /** Retrieves tweets by hashtag with pagination. Requires login. */
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
                    "pigeon_tweets",
                    { hashtags: hashtag },
                    { sort: { createdAt: -1 }, skip, limit }
                );
                const tweetIds = tweets.map((t: any) => t._id);
                const likes = await this.mongoDB.findMany("pigeon_likes", {
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

    /** Retrieves trending hashtags. Requires login. */
    getTrendingHashtags() {
        return async (client: number) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const trending = await this.mongoDB.aggregate("pigeon_tweets", [
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