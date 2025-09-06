import { Logger, MongoDB } from "@server/sv_main";
import { Delay, generateUUid } from "@shared/utils";
import { TweetData, TweetProfileData } from "../../../../types/types";
import { triggerClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";

class PigeonService {
    public async searchUserExist(_client: number, data: string): Promise<any> {
        const user = await MongoDB.findOne("phone_pigeon_users", { email: data });
        return !!user;
    }

    public async login(_client: number, data: string): Promise<any> {
        try {
            const { email, password } = JSON.parse(data);
            const user = await MongoDB.findOne("phone_pigeon_users", { email, password });
            if (user) {
                Logger.AddLog({
                    type: 'phone_pigeon',
                    title: 'User Login',
                    message: `User with email ${email} logged in successfully.`,
                    showIdentifiers: true
                });
                return true;
            }
            return false;
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
        Logger.AddLog({
            type: 'phone_pigeon',
            title: 'User Signup',
            message: `New user account created with email ${email}.`,
            showIdentifiers: true
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
            Logger.AddLog({
                type: 'phone_pigeon',
                title: 'Notifications Toggled',
                message: `User ${email} toggled notifications to ${res.notificationsEnabled ? 'enabled' : 'disabled'}.`,
                showIdentifiers: false
            });
            return true;
        }
        return false;
    }

    public async postTweet(_client: number, data: string): Promise<any> {
        const { email, content, attachments } = JSON.parse(data);
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
            Logger.AddLog({
                type: 'phone_pigeon',
                title: 'Tweet Posted',
                message: `User ${email} posted a new tweet (ID: ${tweet._id}), content: ${content}`,
                showIdentifiers: false
            });
            return true;
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
        Logger.AddLog({
            type: 'phone_pigeon',
            title: 'Reply Posted',
            message: `User ${email} replied to tweet (ID: ${tweetId}), content: ${content}`,
            showIdentifiers: false
        });
        return true;
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
            Logger.AddLog({
                type: 'phone_pigeon',
                title: 'Tweet Liked',
                message: `User ${email} liked tweet (ID: ${tweetId}).`,
                showIdentifiers: false
            });
        } else {
            tweet.likeCount = tweet.likeCount.filter((l: any) => l !== email);
            Logger.AddLog({
                type: 'phone_pigeon',
                title: 'Tweet Liked',
                message: `User ${email} liked tweet (ID: ${tweetId}).`,
                showIdentifiers: false
            });
        }
        await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
        return true;
    }

    public async likeRepliesTweet(_client: number, data: string) {
        const { tweetId, like, email } = JSON.parse(data);
        const tweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: tweetId });
        if (!tweet) return console.log("Tweet not found");
        if (like) {
            tweet.likeCount.push(email);
            Logger.AddLog({
                type: 'phone_pigeon',
                title: 'Reply Liked',
                message: `User ${email} liked reply (ID: ${tweetId}).`,
                showIdentifiers: false
            });
        } else {
            tweet.likeCount = tweet.likeCount.filter((l: any) => l !== email);
            Logger.AddLog({
                type: 'phone_pigeon',
                title: 'Reply Unliked',
                message: `User ${email} unliked reply (ID: ${tweetId}).`,
                showIdentifiers: false
            });
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
                Logger.AddLog({
                    type: 'phone_pigeon',
                    title: 'Tweet Retweeted',
                    message: `User ${pigeonId} retweeted tweet (ID: ${tweetId}), original tweet ID: ${ogTweetId}, content: ${originalTweet.content}`,
                    showIdentifiers: false
                });
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
                Logger.AddLog({
                    type: 'phone_pigeon',
                    title: 'Retweet Removed',
                    message: `User removed retweet (ID: ${tweetId}) of original tweet (ID: ${ogTweetId}), content: ${originalTweet.content}`,
                    showIdentifiers: false
                });
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
                Logger.AddLog({
                    type: 'phone_pigeon',
                    title: 'Reply Retweeted',
                    message: `User ${pigeonId} retweeted reply (ID: ${tweetId}), original tweet ID: ${ogTweetId}), content: ${originalTweet.content}`,
                    showIdentifiers: false
                });
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
                Logger.AddLog({
                    type: 'phone_pigeon',
                    title: 'Retweet of Reply Removed',
                    message: `User removed retweet (ID: ${tweetId}) of reply (ID: ${ogTweetId}), content: ${originalTweet.content}`,
                    showIdentifiers: false
                });
                return true;
            }
            return true;
        } catch (error) {
            console.error("Error in retweet:", error);
            return { error: "An error occurred" };
        }
    }

    public async deleteTweet(_client: number, tweetId: string) {
        const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
        if (!tweet) {
            console.error(`Tweet not found for deletion: ${tweetId}`);
            return { error: "Tweet not found" };
        }

        await MongoDB.deleteOne("phone_pigeon_tweets", { _id: tweetId });
        Logger.AddLog({
            type: 'phone_pigeon',
            title: 'Tweet Deleted',
            message: `Tweet (ID: ${tweetId}) deleted by user ${tweet.email}, content: ${tweet.content}`,
            showIdentifiers: false
        });

        return { success: true };
    }

    public async deleteRepliesTweet(_client: number, tweetId: string) {
        const tweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: tweetId });
        if (!tweet) {
            console.error(`Reply tweet not found for deletion: ${tweetId}`);
            return { error: "Reply tweet not found" };
        }

        await MongoDB.deleteOne("phone_pigeon_tweets_replies", { _id: tweetId });
        Logger.AddLog({
            type: 'phone_pigeon',
            title: 'Reply Deleted',
            message: `Reply (ID: ${tweetId}) deleted, content: ${tweet.content} by user ${tweet.email}`,
            showIdentifiers: false
        });
        return { success: true };
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
                Logger.AddLog({
                    type: 'phone_pigeon',
                    title: 'User Followed',
                    message: `User ${currentEmail} followed ${targetEmail}.`,
                    showIdentifiers: false
                });
            } else {
                targetUser.followers = targetUser.followers.filter(email => email !== currentEmail);
                currentUser.following = currentUser.following.filter(email => email !== targetEmail);
                Logger.AddLog({
                    type: 'phone_pigeon',
                    title: 'User Unfollowed',
                    message: `User ${currentEmail} unfollowed ${targetEmail}.`,
                    showIdentifiers: false
                });
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
        const oldPassword = user.password;
        user.password = password;
        await MongoDB.updateOne("phone_pigeon_users", { email }, user);
        Logger.AddLog({
            type: 'phone_pigeon',
            title: 'Password Changed',
            message: `User ${email} changed their password, old password: ${oldPassword}, new password: ${password}`,
            showIdentifiers: false
        });
        return true;
    };

    public async updateProfile(_client: number, data: string): Promise<any> {
        const parsedData: TweetProfileData = JSON.parse(data);
        const oldUser = await MongoDB.findOne("phone_pigeon_users", { email: parsedData.email });
        const user = await MongoDB.updateOne("phone_pigeon_users", { email: parsedData.email }, parsedData);
        Logger.AddLog({
            type: 'phone_pigeon',
            title: 'Profile Updated',
            message: `User ${parsedData.email} updated their profile, old data: ${JSON.stringify(oldUser)}, new data: ${JSON.stringify(parsedData)}`,
            showIdentifiers: false
        });
        return "success";
    }

    public async verifyUser(_client: number, email: string): Promise<any> {
        const user = await MongoDB.findOne("phone_pigeon_users", { email });
        if (!user) return { error: "User not found" };
        user.verified = true;
        await Delay(1000);
        await MongoDB.updateOne("phone_pigeon_users", { email }, user);
        Logger.AddLog({
            type: 'phone_pigeon',
            title: 'User Verified',
            message: `User ${email} has been verified.`,
            showIdentifiers: false
        });
        return true;
    }

    // Private Messaging Functions
    public async sendPrivateMessage(_client: number, data: string): Promise<any> {
        try {
            const { senderEmail, recipientEmail, content, attachments = [] } = JSON.parse(data);

            // Verify both users exist
            const sender = await MongoDB.findOne("phone_pigeon_users", { email: senderEmail });
            const recipient = await MongoDB.findOne("phone_pigeon_users", { email: recipientEmail });

            if (!sender || !recipient) {
                return { error: "User not found" };
            }

            const message = {
                _id: generateUUid(),
                senderEmail,
                recipientEmail,
                content,
                attachments,
                createdAt: new Date().toISOString(),
                read: false,
                deletedBySender: false,
                deletedByRecipient: false
            };

            await MongoDB.insertOne("phone_pigeon_private_messages", message);

            // Get all Citizen IDs for both sender and recipient (multiple devices support)
            const senderCids = await Utils.GetCidsFromPigeonEmail(senderEmail);
            const recipientCids = await Utils.GetCidsFromPigeonEmail(recipientEmail);

            // Send notifications and refresh events to all recipient devices
            for (const recipientCid of recipientCids) {
                const recipientPlayer = await exports['qb-core'].GetPlayerByCitizenId(recipientCid);
                if (recipientPlayer) {
                    emitNet('phone:addnotiFication', recipientPlayer.PlayerData.source, JSON.stringify({
                        id: generateUUid(),
                        title: 'New Message',
                        description: `You received a message from ${sender.displayName}`,
                        app: 'pigeon',
                        timeout: 5000
                    }));

                    // Send NUI event to refresh chat if recipient is in chat
                    emitNet('phone:refreshPrivateMessage', recipientPlayer.PlayerData.source, JSON.stringify({
                        message: message,
                        senderEmail: senderEmail,
                        recipientEmail: recipientEmail
                    }));
                }
            }

            // Send refresh event to all sender devices
            for (const senderCid of senderCids) {
                const senderPlayer = await exports['qb-core'].GetPlayerByCitizenId(senderCid);
                if (senderPlayer) {
                    emitNet('phone:refreshPrivateMessage', senderPlayer.PlayerData.source, JSON.stringify({
                        message: message,
                        senderEmail: senderEmail,
                        recipientEmail: recipientEmail
                    }));
                }
            }

            Logger.AddLog({
                type: 'phone_pigeon',
                title: 'Private Message Sent',
                message: `${senderEmail} sent a private message to ${recipientEmail}`,
                showIdentifiers: false
            });

            return { success: true, messageId: message._id };
        } catch (error) {
            console.error("Error in sendPrivateMessage:", error);
            return { error: "An error occurred while sending message" };
        }
    }

    public async getPrivateMessages(_client: number, data: string): Promise<any> {
        try {
            const { userEmail, otherUserEmail, limit = 50, offset = 0 } = JSON.parse(data);

            const messages = await MongoDB.findMany("phone_pigeon_private_messages", {
                $or: [
                    { senderEmail: userEmail, recipientEmail: otherUserEmail },
                    { senderEmail: otherUserEmail, recipientEmail: userEmail }
                ],
                $and: [
                    { deletedBySender: { $ne: true } },
                    { deletedByRecipient: { $ne: true } }
                ]
            }, null, false, {
                sort: { createdAt: -1 },
                skip: offset,
                limit: limit
            });

            return JSON.stringify(messages);
        } catch (error) {
            console.error("Error in getPrivateMessages:", error);
            return { error: "An error occurred while fetching messages" };
        }
    }

    public async getConversations(_client: number, userEmail: string): Promise<any> {
        try {
            // Get all unique conversations for the user
            const conversations = await MongoDB.aggregate("phone_pigeon_private_messages", [
                {
                    $match: {
                        $or: [
                            { senderEmail: userEmail },
                            { recipientEmail: userEmail }
                        ],
                        $and: [
                            { deletedBySender: { $ne: true } },
                            { deletedByRecipient: { $ne: true } }
                        ]
                    }
                },
                {
                    $sort: { createdAt: -1 }
                },
                {
                    $group: {
                        _id: {
                            $cond: [
                                { $eq: ["$senderEmail", userEmail] },
                                "$recipientEmail",
                                "$senderEmail"
                            ]
                        },
                        lastMessage: { $first: "$$ROOT" },
                        unreadCount: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $eq: ["$recipientEmail", userEmail] }, { $eq: ["$read", false] }] },
                                    1,
                                    0
                                ]
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: "phone_pigeon_users",
                        localField: "_id",
                        foreignField: "email",
                        as: "userInfo"
                    }
                },
                {
                    $unwind: "$userInfo"
                },
                {
                    $project: {
                        otherUser: {
                            email: "$userInfo.email",
                            displayName: "$userInfo.displayName",
                            avatar: "$userInfo.avatar",
                            verified: "$userInfo.verified"
                        },
                        lastMessage: 1,
                        unreadCount: 1
                    }
                },
                {
                    $sort: { "lastMessage.createdAt": -1 }
                }
            ]);

            return JSON.stringify(conversations);
        } catch (error) {
            console.error("Error in getConversations:", error);
            return { error: "An error occurred while fetching conversations" };
        }
    }

    public async markMessageAsRead(_client: number, data: string): Promise<any> {
        try {
            const { messageId, userEmail } = JSON.parse(data);

            const message = await MongoDB.findOne("phone_pigeon_private_messages", { _id: messageId });
            if (!message) return { error: "Message not found" };

            // Only mark as read if the user is the recipient
            if (message.recipientEmail === userEmail) {
                message.read = true;
                await MongoDB.updateOne("phone_pigeon_private_messages", { _id: messageId }, message);
            }

            return { success: true };
        } catch (error) {
            console.error("Error in markMessageAsRead:", error);
            return { error: "An error occurred while marking message as read" };
        }
    }

    public async deleteMessage(_client: number, data: string): Promise<any> {
        try {
            const { messageId, userEmail } = JSON.parse(data);

            const message = await MongoDB.findOne("phone_pigeon_private_messages", { _id: messageId });
            if (!message) return { error: "Message not found" };

            // Mark as deleted by the appropriate user
            if (message.senderEmail === userEmail) {
                message.deletedBySender = true;
            } else if (message.recipientEmail === userEmail) {
                message.deletedByRecipient = true;
            } else {
                return { error: "Unauthorized" };
            }

            await MongoDB.updateOne("phone_pigeon_private_messages", { _id: messageId }, message);

            Logger.AddLog({
                type: 'phone_pigeon',
                title: 'Message Deleted',
                message: `User ${userEmail} deleted a private message`,
                showIdentifiers: false
            });

            return { success: true };
        } catch (error) {
            console.error("Error in deleteMessage:", error);
            return { error: "An error occurred while deleting message" };
        }
    }

    // Enhanced Followers/Following Functions
    public async getFollowers(_client: number, email: string): Promise<any> {
        try {
            const user = await MongoDB.findOne("phone_pigeon_users", { email });
            if (!user) return { error: "User not found" };

            const followers = await MongoDB.findMany("phone_pigeon_users",
                { email: { $in: user.followers } },
                null, false,
                { sort: { displayName: 1 } }
            );

            return JSON.stringify(followers);
        } catch (error) {
            console.error("Error in getFollowers:", error);
            return { error: "An error occurred while fetching followers" };
        }
    }

    public async getFollowing(_client: number, email: string): Promise<any> {
        try {
            const user = await MongoDB.findOne("phone_pigeon_users", { email });
            if (!user) return { error: "User not found" };

            const following = await MongoDB.findMany("phone_pigeon_users",
                { email: { $in: user.following } },
                null, false,
                { sort: { displayName: 1 } }
            );

            return JSON.stringify(following);
        } catch (error) {
            console.error("Error in getFollowing:", error);
            return { error: "An error occurred while fetching following" };
        }
    }

}

export const pigeonService = new PigeonService();