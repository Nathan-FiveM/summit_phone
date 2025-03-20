import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";
import { TweetData } from "../../../../types/types";

interface Tweet {
    _id: string;
    userId: string;
    content: string;
    createdAt: string;
    likeCount: number;
    retweetCount: number;
    isRetweet: boolean;
    originalTweetId: string | null;
    hashtags: string[];
    parentTweetId: string | null;
    likedByMe?: boolean;
}

class PigeonService {
    //@ts-ignore
    public static tweetData: TweetData[];

    /*  public async registerFeeds() {
         const res = await MongoDB.findMany("phone_pigeon_tweets", {}, null, false, { sort: { createdAt: -1 } })
         PigeonService.tweetData = res;
     } */

    private async getCitizenId(client: number): Promise<string> {
        return await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
    }

    public async searchUserExist(client: number, data: string): Promise<any> {
        const user = await MongoDB.findOne("phone_pigeon_users", { email: data });
        return !!user;
    }

    public async login(client: number, data: string): Promise<any> {
        try {
            const { email, password } = JSON.parse(data);
            const user = await MongoDB.findOne("phone_pigeon_users", { email, password });
            return !!user;
        } catch (error) {
            console.error("Error in login:", error);
            return { error: "An error occurred" };
        }
    }

    public async signup(client: number, data: string): Promise<any> {
        const { email, password } = JSON.parse(data);
        const existingUser = await MongoDB.findOne("phone_pigeon_users", { email });
        if (existingUser) {
            return { error: "Email already taken" };
        }
        await MongoDB.insertOne("phone_pigeon_users", {
            _id: generateUUid(),
            email,
            password,
            verified: false,
            username: email, // Assuming username is set to email for consistency
            displayName: email,
            avatar: "",
            notificationsEnabled: true,
        });
        return true;
    }

    private async hasProfile(citizenId: string): Promise<boolean> {
        const user = await MongoDB.findOne("phone_pigeon_users", { _id: citizenId });
        return !!user;
    }

    private async getUsernameByCitizenId(citizenId: string): Promise<string | null> {
        const user = await MongoDB.findOne("phone_pigeon_users", { _id: citizenId });
        return user ? user.username : null;
    }

    private parseMentions(content: string): string[] {
        const mentionRegex = /@(\w+)/g;
        const matches = content.match(mentionRegex);
        return matches ? matches.map((m) => m.slice(1)) : [];
    }

    private async isLoggedIn(citizenId: string): Promise<boolean> {
        const user = await MongoDB.findOne("phone_pigeon_users", { _id: citizenId });
        return user && user.loggedIn;
    }

    public async setProfile() {

    }

    public async getMyProfile() {

    }

    public async getProfile(client: number, email: string): Promise<any> {
        const user = await MongoDB.findOne("phone_pigeon_users", { email });
        if (user) {
            return JSON.stringify(user);
        } else {
            return "User not found";
        }
    }

    public async toggleNotifications(client: number, email: string) {
        const res = await MongoDB.findOne("phone_pigeon_users", { email });
        if (res) {
            res.notificationsEnabled = !res.notificationsEnabled;
            await MongoDB.updateOne("phone_pigeon_users", { email }, res);
            return true;
        }
        return false;
    }

    public async postTweet(client: number, email: string, data: string): Promise<any> {
        const { content, attachments } = JSON.parse(data);
        try {
            const res = await MongoDB.findOne("phone_pigeon_users", { email });
            if (!res) return { error: "User not found" };

            const tweet = {
                _id: generateUUid(),
                username: res.displayName,
                avatar: res.avatar,
                verified: res.verified,
                content,
                attachments,
                createdAt: new Date().toISOString(),
                likeCount: 0,
                retweetCount: 0,
                isRetweet: false,
                originalTweetId: null,
                hashtags: content.match(/#\w+/g) || [],
                parentTweetId: null,
            };
            await MongoDB.insertOne("phone_pigeon_tweets", tweet);


        } catch (error) {
            console.error("Error in postTweet:", error);
            return { error: "An error occurred" };
        }
    }

    public async getAllFeed(client: number, data: string): Promise<any> {
        try {
            const { start = 1, end = 20 } = JSON.parse(data);
            const res = await MongoDB.findMany("phone_pigeon_tweets", {}, null, false, {
                skip: start - 1,
                limit: end,
                sort: { createdAt: -1 }
            });

            return JSON.stringify({
                data: res,
                length: res.length,
            });
        } catch (error) {
            console.error("Error in getFeed:", error);
            return { error: "An error occurred" };
        }
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
                const parentTweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: parentTweetId });
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
                await MongoDB.insertOne("phone_pigeon_tweets", reply);

                const parentUser = await MongoDB.findOne("phone_pigeon_users", { _id: parentTweet.userId });
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
                const originalTweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: originalTweetId });
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
                await MongoDB.insertOne("phone_pigeon_tweets", retweet);
                await MongoDB.updateOne(
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
                const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
                if (!tweet) {
                    return { error: "Tweet not found" };
                }
                if (tweet.userId !== citizenId) {
                    return { error: "Not authorized to delete this tweet" };
                }
                await MongoDB.deleteOne("phone_pigeon_tweets", { _id: tweetId });
                await MongoDB.deleteMany("phone_pigeon_likes", { tweetId });
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
                const targetUser = await MongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                const allTweets = await MongoDB.findMany("phone_pigeon_tweets", { userId: targetUser._id });
                const sortedTweets: Tweet[] = allTweets.sort((a: Tweet, b: Tweet) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const skip = (page - 1) * limit;
                const tweets = sortedTweets.slice(skip, skip + limit);
                const tweetIds = tweets.map(t => t._id);
                const likes = await MongoDB.findMany("phone_pigeon_likes", {
                    tweetId: { $in: tweetIds },
                    userId: citizenId,
                });
                const likedTweetIds: Set<string> = new Set(likes.map((l: { tweetId: string }) => l.tweetId));
                tweets.forEach(t => {
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



    followUser() {
        return async (client: number, targetUsername: string) => {
            try {
                const citizenId = await this.getCitizenId(client);
                if (!(await this.isLoggedIn(citizenId))) {
                    return { error: "Not logged in" };
                }
                const targetUser = await MongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                if (citizenId === targetUser._id) {
                    return { error: "Cannot follow yourself" };
                }
                const existingFollow = await MongoDB.findOne("phone_pigeon_follows", {
                    followerId: citizenId,
                    followeeId: targetUser._id,
                });
                if (existingFollow) {
                    return { error: "Already following" };
                }
                await MongoDB.insertOne("phone_pigeon_follows", {
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
                const targetUser = await MongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                await MongoDB.deleteOne("phone_pigeon_follows", {
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
                const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
                if (!tweet) {
                    return { error: "Tweet not found" };
                }
                const existingLike = await MongoDB.findOne("phone_pigeon_likes", {
                    tweetId,
                    userId: citizenId,
                });
                if (existingLike) {
                    return { error: "Already liked" };
                }
                const like = { _id: generateUUid(), tweetId, userId: citizenId };
                await MongoDB.insertOne("phone_pigeon_likes", like);
                await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, { $inc: { likeCount: 1 } });

                if (tweet.userId !== citizenId) {
                    const tweetOwner = await MongoDB.findOne("phone_pigeon_users", { _id: tweet.userId });
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
                const like = await MongoDB.findOne("phone_pigeon_likes", { tweetId, userId: citizenId });
                if (!like) {
                    return { error: "Not liked" };
                }
                await MongoDB.deleteOne("phone_pigeon_likes", { _id: like._id });
                await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, { $inc: { likeCount: -1 } });
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
                const targetUser = await MongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                const followers = await MongoDB.findMany("phone_pigeon_follows", { followeeId: targetUser._id });
                interface Follow {
                    followerId: string;
                    followeeId: string;
                }

                const followerIds: string[] = followers.map((f: Follow) => f.followerId);
                const followerProfiles = await MongoDB.findMany("phone_pigeon_users", { _id: { $in: followerIds } });
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
                const targetUser = await MongoDB.findOne("phone_pigeon_users", { username: targetUsername });
                if (!targetUser) {
                    return { error: "User not found" };
                }
                const following = await MongoDB.findMany("phone_pigeon_follows", { followerId: targetUser._id });
                const followingIds: string[] = following.map((f: { followeeId: string }) => f.followeeId);
                const followingProfiles = await MongoDB.findMany("phone_pigeon_users", { _id: { $in: followingIds } });
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
                const allUsers = await MongoDB.findMany("phone_pigeon_users", { username: { $regex: regex } });
                const sortedUsers = allUsers; // No specific sorting required
                const skip = (page - 1) * limit;
                const users = sortedUsers.slice(skip, skip + limit);
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
                const allTweets = await MongoDB.findMany("phone_pigeon_tweets", { hashtags: hashtag });
                const sortedTweets: Tweet[] = allTweets.sort((a: Tweet, b: Tweet) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const skip = (page - 1) * limit;
                const tweets = sortedTweets.slice(skip, skip + limit);
                const tweetIds = tweets.map(t => t._id);
                const likes = await MongoDB.findMany("phone_pigeon_likes", {
                    tweetId: { $in: tweetIds },
                    userId: citizenId,
                });
                const likedTweetIds = new Set(likes.map((l: { tweetId: string }) => l.tweetId));
                tweets.forEach(t => {
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
                const allTweets = await MongoDB.findMany("phone_pigeon_tweets", {});
                const hashtagCounts: { [key: string]: number } = {};
                allTweets.forEach((tweet: Tweet) => {
                    if (tweet.hashtags) {
                        tweet.hashtags.forEach((hashtag: string) => {
                            hashtagCounts[hashtag] = (hashtagCounts[hashtag] || 0) + 1;
                        });
                    }
                });
                const trending = Object.entries(hashtagCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(entry => entry[0]);
                return trending;
            } catch (error) {
                console.error("Error in getTrendingHashtags:", error);
                return { error: "An error occurred" };
            }
        };
    }
}

export const pigeonService = new PigeonService();