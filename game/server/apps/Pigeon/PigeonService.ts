import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";
import { TweetData, TweetProfileData } from "../../../../types/types";
import { triggerClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";

class PigeonService {
    //@ts-ignore
    public static tweetData: TweetData[];

    public async searchUserExist(_client: number, data: string): Promise<any> {
        const user = await MongoDB.findOne("phone_pigeon_users", { email: data });
        return !!user;
    }

    public async login(_client: number, data: string): Promise<any> {
        try {
            const { email, password } = JSON.parse(data);
            const user = await MongoDB.findOne("phone_pigeon_users", { email, password });
            return !!user;
        } catch (error) {
            console.error("Error in login:", error);
            return { error: "An error occurred" };
        }
    }

    public async signup(_client: number, data: string): Promise<any> {
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
            username: email,
            displayName: email,
            avatar: "",
            banner: "",
            notificationsEnabled: true,
            createdAt: new Date().toISOString(),
            bio: "",
            followers: [],
            following: [],
        });
        return true;
    }

    public async getProfile(_client: number, email: string): Promise<any> {
        const user = await MongoDB.findOne("phone_pigeon_users", { email });
        if (user) {
            return JSON.stringify(user);
        } else {
            return "User not found";
        }
    }

    public async toggleNotifications(_client: number, email: string) {
        const res = await MongoDB.findOne("phone_pigeon_users", { email });
        if (res) {
            res.notificationsEnabled = !res.notificationsEnabled;
            await MongoDB.updateOne("phone_pigeon_users", { email }, res);
            return true;
        }
        return false;
    }

    public async postTweet(_client: number, email: string, data: string): Promise<any> {
        const { content, attachments } = JSON.parse(data);
        try {
            const res = await MongoDB.findOne("phone_pigeon_users", { email });
            if (!res) return { error: "User not found" };

            const tweet: TweetData = {
                _id: generateUUid(),
                username: res.displayName,
                email: res.email,
                avatar: res.avatar,
                verified: res.verified,
                content,
                attachments,
                createdAt: new Date().toISOString(),
                likeCount: [],
                repliesCount: [],
                retweetCount: [],
                isRetweet: false,
                originalTweetId: null,
                hashtags: content.match(/#\w+/g) || [],
                parentTweetId: null,

            };
            await MongoDB.insertOne("phone_pigeon_tweets", tweet);
            await triggerClientCallback("pigeon:refreshTweet", -1, JSON.stringify(tweet));
            emitNet('phone:addnotiFication', -1, JSON.stringify({
                id: generateUUid(),
                title: 'New Tweet',
                description: `${res.displayName} has posted a new tweet.`,
                app: 'pigeon',
                timeout: 5000
            }));
            await MongoDB.insertOne("phone_pigeon_notifications", {
                _id: generateUUid(),
                content: `${res.displayName} has posted a new tweet.`,
                email: res.email,
                createdAt: new Date().toISOString(),
                type: "post",
            });
        } catch (error) {
            console.error("Error in postTweet:", error);
            return { error: "An error occurred" };
        }
    }

    public async getAllFeed(_client: number, data: string): Promise<any> {
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

    public async postReply(client: number, data: string): Promise<any> {
        const { tweetId, content, email, attachments } = JSON.parse(data);
        const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
        const user = await MongoDB.findOne("phone_pigeon_users", { email });
        const tweet: TweetData = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
        if (!tweet) return { error: "Tweet not found" };
        const reply = {
            _id: generateUUid(),
            username: user.displayName,
            email: user.email,
            avatar: user.avatar,
            verified: user.verified,
            content,
            attachments,
            createdAt: new Date().toISOString(),
            likeCount: [],
            repliesCount: [],
            retweetCount: [],
            isRetweet: false,
            originalTweetId: tweetId,
            hashtags: content.match(/#\w+/g) || [],
            parentTweetId: null
        };
        tweet.repliesCount.push(citizenId);
        await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
        await MongoDB.insertOne("phone_pigeon_tweets_replies", reply);
        await triggerClientCallback("pigeon:refreshRepost", -1, JSON.stringify(reply));
        const res = await exports['qb-core'].GetPlayerByCitizenId(await Utils.GetCidFromTweetId(tweet.email));
        if (res) {
            emitNet('phone:addnotiFication', res.PlayerData.source, JSON.stringify({
                id: generateUUid(),
                title: 'New Reply',
                description: `${user.displayName} has replied to tweet.`,
                app: 'pigeon',
                timeout: 5000
            }));
            await MongoDB.insertOne("phone_pigeon_notifications", {
                _id: generateUUid(),
                content: `${user.displayName} has replied to tweet.`,
                email: tweet.email,
                createdAt: new Date().toISOString(),
                type: "post",
            });
        }
    }

    public async likeTweet(_client: number, data: string) {
        const { tweetId, like, email } = JSON.parse(data);
        const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
        if (!tweet) return { error: "Tweet not found" };
        if (like) {
            tweet.likeCount.push(email);
            const cid = await Utils.GetCidFromTweetId(tweet.email);
            const res = await exports['qb-core'].GetPlayerByCitizenId(cid);
            if (res) {
                emitNet('phone:addnotiFication', res.PlayerData.source, JSON.stringify({
                    id: generateUUid(),
                    title: 'New Like',
                    description: `${email} has liked your tweet.`,
                    app: 'pigeon',
                    timeout: 5000
                }));
                await MongoDB.insertOne("phone_pigeon_notifications", {
                    _id: generateUUid(),
                    content: `${email} has liked your tweet.`,
                    email: tweet.email,
                    createdAt: new Date().toISOString(),
                    type: "like",
                });
            }
        } else {
            tweet.likeCount = tweet.likeCount.filter((l: any) => l !== email);
        }
        await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
        return true;
    }

    public async likeRepliesTweet(_client: number, data: string) {
        const { tweetId, like, email } = JSON.parse(data);
        const tweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: tweetId });
        console.log(tweet, like);
        if (!tweet) return console.log("Tweet not found");
        if (like) {
            tweet.likeCount.push(email);
        } else {
            tweet.likeCount = tweet.likeCount.filter((l: any) => l !== email);
        }
        await MongoDB.updateOne("phone_pigeon_tweets_replies", { _id: tweetId }, tweet);
        return true;
    }

    public async retweet(client: number, data: string) {
        const { tweetId, retweet, pigeonId, ogTweetId } = JSON.parse(data);
        try {
            if (retweet) {
                const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(client);
                const originalTweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
                const retWeetuser = await MongoDB.findOne("phone_pigeon_users", { email: pigeonId });
                if (!originalTweet) {
                    return { error: "Original tweet not found" };
                }
                originalTweet.retweetCount.push(citizenId);
                await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, originalTweet);

                const retweetData: TweetData = {
                    _id: generateUUid(),
                    username: retWeetuser.displayName,
                    email: retWeetuser.email,
                    avatar: retWeetuser.avatar,
                    verified: retWeetuser.verified,
                    content: originalTweet.content,
                    attachments: originalTweet.attachments,
                    createdAt: new Date().toISOString(),
                    likeCount: [],
                    repliesCount: [],
                    retweetCount: [],
                    isRetweet: true,
                    originalTweetId: tweetId,
                    hashtags: originalTweet.hashtags,
                    parentTweetId: null,
                };
                await MongoDB.insertOne("phone_pigeon_tweets", retweetData);
                await triggerClientCallback("pigeon:refreshTweet", -1, JSON.stringify(retweetData));
                return true;
            } else if (!retweet) {
                const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(client);
                const originalTweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: ogTweetId });
                const retweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
                if (!originalTweet || !retweet) {
                    return { error: "Original tweet not found" };
                }

                // Remove only first occurrence of citizenId
                let removed = false;
                originalTweet.retweetCount = originalTweet.retweetCount.filter((l: any) => {
                    if (l === citizenId && !removed) {
                        removed = true;
                        return false;
                    }
                    return true;
                });
                await MongoDB.updateOne("phone_pigeon_tweets", { _id: ogTweetId }, originalTweet);
                await MongoDB.deleteOne("phone_pigeon_tweets", { _id: tweetId });
                return true;
            }
            return true;
        } catch (error) {
            console.error("Error in retweet:", error);
            return { error: "An error occurred" };
        }
    }

    public async retweetRepliesTweet(client: number, data: string) {
        const { tweetId, retweet, pigeonId, ogTweetId } = JSON.parse(data);
        try {
            if (retweet) {
                const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(client);
                const originalTweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: tweetId });
                const ogTweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: originalTweet.originalTweetId });
                const retWeetuser = await MongoDB.findOne("phone_pigeon_users", { email: pigeonId });
                if (!originalTweet) {
                    return { error: "Original tweet not found" };
                }
                originalTweet.retweetCount.push(citizenId);
                ogTweet.repliesCount.push(citizenId);
                await MongoDB.updateOne("phone_pigeon_tweets", { _id: originalTweet.originalTweetId }, ogTweet);
                await MongoDB.updateOne("phone_pigeon_tweets_replies", { _id: tweetId }, originalTweet);

                const retweetData: TweetData = {
                    _id: generateUUid(),
                    username: retWeetuser.displayName,
                    email: retWeetuser.email,
                    avatar: retWeetuser.avatar,
                    verified: retWeetuser.verified,
                    content: originalTweet.content,
                    attachments: originalTweet.attachments,
                    createdAt: new Date().toISOString(),
                    likeCount: [],
                    repliesCount: [],
                    retweetCount: [],
                    isRetweet: true,
                    originalTweetId: originalTweet.originalTweetId,
                    hashtags: originalTweet.hashtags,
                    parentTweetId: tweetId,
                };
                await MongoDB.insertOne("phone_pigeon_tweets_replies", retweetData);
                await triggerClientCallback("pigeon:refreshRepost", -1, JSON.stringify(retweetData));
                if (ogTweet.repliesCount) {
                    const uniqueCids = [...new Set(ogTweet.repliesCount)];
                    for (const replyCid of uniqueCids) {
                        const res = await exports['qb-core'].GetPlayerByCitizenId(replyCid);
                        emitNet('phone:addnotiFication', res.PlayerData.source, JSON.stringify({
                            id: generateUUid(),
                            title: 'New Reply',
                            description: `${retWeetuser.displayName} has replied to tweet.`,
                            app: 'pigeon',
                            timeout: 5000
                        }));
                        await MongoDB.insertOne("phone_pigeon_notifications", {
                            _id: generateUUid(),
                            content: `{retWeetuser.displayName} has replied to tweet.`,
                            email: retWeetuser.email,
                            createdAt: new Date().toISOString(),
                            type: "post",
                        });
                    }
                }
                return true;
            } else if (!retweet) {
                const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(client);
                const originalTweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: ogTweetId });
                const retweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: tweetId });
                if (!originalTweet || !retweet) {
                    return { error: "Original tweet not found" };
                }

                // Remove only first occurrence of citizenId
                let removed = false;
                originalTweet.retweetCount = originalTweet.retweetCount.filter((l: any) => {
                    if (l === citizenId && !removed) {
                        removed = true;
                        return false;
                    }
                    return true;
                });
                console.log(originalTweet.retweetCount);
                await MongoDB.updateOne("phone_pigeon_tweets_replies", { _id: ogTweetId }, originalTweet);
                await MongoDB.deleteOne("phone_pigeon_tweets_replies", { _id: tweetId });
                return true;
            }
            return true;
        } catch (error) {
            console.error("Error in retweet:", error);
            return { error: "An error occurred" };
        }
    }

    public async deleteTweet(_client: number, tweetId: string) {
        await MongoDB.deleteOne("phone_pigeon_tweets", { _id: tweetId });
    }

    public async deleteRepliesTweet(_client: number, tweetId: string) {
        await MongoDB.deleteOne("phone_pigeon_tweets_replies", { _id: tweetId });
    }

    public async getPostReplies(_client: number, tweetId: string) {
        const replies = await MongoDB.findMany("phone_pigeon_tweets_replies", { originalTweetId: tweetId }, null, false, {
            sort: { createdAt: -1 }
        });
        return JSON.stringify(replies);
    }

    public async increaseRepliesCount(client: number, data: string): Promise<any> {
        const { tweetId } = JSON.parse(data);
        const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
        if (!tweet) return { error: "Tweet not found" };
        tweet.repliesCount.push(await exports['qb-core'].GetPlayerCitizenIdBySource(client));
        await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
    }

    public async decreaseRepliesCount(client: number, data: string): Promise<any> {
        try {
            const { tweetId } = JSON.parse(data);
            const cid = await exports['qb-core'].GetPlayerCitizenIdBySource(client);

            const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
            if (!tweet) {
                console.error(`Tweet not found for tweetId: ${tweetId}`);
                return { error: "Tweet not found" };
            }

            let removed = false;
            tweet.repliesCount = tweet.repliesCount.filter((r: string) => {
                if (r === cid && !removed) {
                    removed = true;
                    return false;
                }
                return true;
            });

            const updateResult = await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);

            if (!updateResult || updateResult.modifiedCount === 0) {
                console.warn(`No changes made to tweet ${tweetId} repliesCount`);
                return { success: false, message: "No changes made to replies count" };
            }

            console.log(`Successfully decreased repliesCount for tweet ${tweetId}`);
            return { success: true };
        } catch (error: any) {
            console.error("Error in decreaseRepliesCount:", error);
            return { error: "An error occurred", details: error.message };
        }
    }

    public async followUser(_client: number, data: string): Promise<any> {
        try {
            const { targetEmail, currentEmail, follow } = JSON.parse(data);
            const targetUser: TweetProfileData = await MongoDB.findOne("phone_pigeon_users", { email: targetEmail });
            if (!targetUser) return { error: "Target user not found" };

            const currentUser: TweetProfileData = await MongoDB.findOne("phone_pigeon_users", { email: currentEmail });
            if (!currentUser) return { error: "Current user not found" };

            if (follow) {
                if (!targetUser.followers.includes(currentEmail)) {
                    targetUser.followers.push(currentEmail);
                }
                if (!currentUser.following.includes(targetEmail)) {
                    currentUser.following.push(targetEmail);
                }
            } else {
                targetUser.followers = targetUser.followers.filter(email => email !== currentEmail);
                currentUser.following = currentUser.following.filter(email => email !== targetEmail);
            }

            await MongoDB.updateOne("phone_pigeon_users", { email: targetEmail }, targetUser);
            await MongoDB.updateOne("phone_pigeon_users", { email: currentEmail }, currentUser);

            return { success: true };
        } catch (error) {
            console.error("Error in followUser:", error);
            return { error: "An error occurred while updating follow status" };
        }
    }

    public async getUserTweets(_client: number, email: string): Promise<any> {
        const res = await MongoDB.findMany("phone_pigeon_tweets", { email }, null, false, {
            sort: { createdAt: -1 }
        });
        return JSON.stringify(res);
    }

    public async getAllPostReplies(_client: number, email: string): Promise<any> {
        const res = await MongoDB.findMany("phone_pigeon_tweets_replies", { email: email }, null, false, {
            sort: { createdAt: -1 }
        });
        return JSON.stringify(res);
    }

    public async getAllLikedTweets(_client: number, email: string): Promise<any> {
        const res = await MongoDB.findMany("phone_pigeon_tweets", { likeCount: email }, null, false, {
            sort: { createdAt: -1 }
        });
        return JSON.stringify(res);
    }

    public async searchUsers(_client: number, value: string): Promise<any> {
        const res = await MongoDB.findMany("phone_pigeon_users", { email: { $regex: value, $options: "i" } }, null, false, {
            sort: { createdAt: -1 }
        });
        return JSON.stringify(res);
    }

    public async getNotifications(_client: number, email: string): Promise<any> {
        const res = await MongoDB.findMany("phone_pigeon_notifications", { email }, null, false, {
            sort: { createdAt: -1 }
        });
        return JSON.stringify(res);
    }

    public async changePassword(_client: number, data: string): Promise<any> {
        const { email, password } = JSON.parse(data);
        const user = await MongoDB.findOne("phone_pigeon_users", { email });
        if (!user) return { error: "User not found" };
        user.password = password;
        await MongoDB.updateOne("phone_pigeon_users", { email }, user);
        return true;
    };

    public async updateProfile(_client: number, data: string): Promise<any> {
        const parsedData: TweetProfileData = JSON.parse(data);
        const user = await MongoDB.updateOne("phone_pigeon_users", { email: parsedData.email }, parsedData);
        return "success";
    }
}

export const pigeonService = new PigeonService();