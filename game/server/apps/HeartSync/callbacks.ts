import { Framework, MongoDB } from '@server/sv_main';
import { onClientCallback } from '@overextended/ox_lib/server';
import { generateUUid } from '@shared/utils';

interface HeartSyncProfile {
    _id?: string;
    citizenId: string;
    name: string;
    age: number;
    gender: string;
    bio: string;
    photos: string[];
    interests: string[];
    lookingFor: string;
    interestedInGenders: string[];
    ageRangeMin: number;
    ageRangeMax: number;
    maxDistance: number;
    showOnline: boolean;
    location?: {
        lat: number;
        lng: number;
        city: string;
    };
    work?: string;
    school?: string;
    height?: number;
    zodiacSign?: string;
    lifestyle?: {
        smoking: string;
        drinking: string;
        exercise: string;
        pets: string;
    };
    prompts?: {
        question: string;
        answer: string;
    }[];
    verified: boolean;
    premium: boolean;
    superLikesRemaining: number;
    likesRemaining: number;
    dailySwipes: number;
    lastSwipeReset: Date;
    createdAt: Date;
    lastActive: Date;
    isActive: boolean;
}
interface Message {
    _id: string;
    senderId: string;
    receiverId: string;
    matchId: string;
    content: string;
    timestamp: string;
    read: boolean;
}
class HeartSyncServer {
    async getProfile(source: number): Promise<HeartSyncProfile | null> {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return null;
            const profile = await MongoDB.findOne('heartsync_profiles', { citizenId });
            return profile;
        } catch (error) {
            console.error('Error getting HeartSync profile:', error);
            return null;
        }
    }

    async createProfile(source: number, profileData: Partial<HeartSyncProfile>): Promise<HeartSyncProfile | null> {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return null;

            // Check if profile already exists
            const existingProfile = await MongoDB.findOne('heartsync_profiles', { citizenId });
            if (existingProfile) {
                throw new Error('Profile already exists');
            }

            const newProfile: HeartSyncProfile = {
                _id: generateUUid(),
                citizenId,
                name: profileData.name || '',
                age: profileData.age || 18,
                gender: profileData.gender || '',
                bio: profileData.bio || '',
                photos: profileData.photos || [],
                interests: profileData.interests || [],
                lookingFor: profileData.lookingFor || '',
                interestedInGenders: profileData.interestedInGenders || [],
                ageRangeMin: profileData.ageRangeMin || 18,
                ageRangeMax: profileData.ageRangeMax || 35,
                maxDistance: profileData.maxDistance || 25,
                showOnline: profileData.showOnline !== undefined ? profileData.showOnline : true,
                work: profileData.work || '',
                school: profileData.school || '',
                height: profileData.height,
                zodiacSign: profileData.zodiacSign || '',
                lifestyle: profileData.lifestyle || {
                    smoking: '',
                    drinking: '',
                    exercise: '',
                    pets: ''
                },
                verified: false,
                premium: false,
                superLikesRemaining: 5,
                likesRemaining: 50,
                dailySwipes: 0,
                lastSwipeReset: new Date(),
                createdAt: new Date(),
                lastActive: new Date(),
                isActive: true
            };

            const result = await MongoDB.insertOne('heartsync_profiles', newProfile);
            console.log(result);
            return { ...newProfile, _id: result };
        } catch (error) {
            console.error('Error creating HeartSync profile:', error);
            return null;
        }
    }

    async updateProfile(source: number, profileData: Partial<HeartSyncProfile>): Promise<HeartSyncProfile | null> {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return null;

            const updateData = {
                ...profileData,
                lastActive: new Date()
            };

            const result = await MongoDB.updateOne('heartsync_profiles', { citizenId }, updateData, undefined, false, { upsert: true });

            return result.value;
        } catch (error) {
            console.error('Error updating HeartSync profile:', error);
            return null;
        }
    }

    async getPotentialMatches(source: number): Promise<HeartSyncProfile[]> {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return [];

            const userProfile = await MongoDB.findOne('heartsync_profiles', { citizenId });
            if (!userProfile) return [];

            // Get users already swiped on
            const swipedUsers = await MongoDB.findMany('heartsync_swipes', {
                fromUserId: citizenId
            }, undefined, false);
            const swipedUserIds = swipedUsers.map((swipe: any) => swipe.toUserId);

            // Get matched users
            const matches = await MongoDB.findMany('heartsync_matches', {
                $or: [
                    { user1Id: citizenId },
                    { user2Id: citizenId }
                ],
                isActive: true
            }, undefined, false);
            const matchedUserIds = matches.map((match: any) =>
                match.user1Id === citizenId ? match.user2Id : match.user1Id
            );

            // Combine excluded users
            const excludedUserIds = [...swipedUserIds, ...matchedUserIds, citizenId];

            // Build match criteria
            const matchCriteria: any = {
                citizenId: { $nin: excludedUserIds },
                isActive: true,
                age: { $gte: userProfile.ageRangeMin, $lte: userProfile.ageRangeMax }
            };

            // Add gender preferences
            if (userProfile.lookingFor !== 'Everyone') {
                matchCriteria.gender = userProfile.lookingFor === 'Men' ? 'Man' : 'Woman';
            }

            if (userProfile.interestedInGenders.length > 0) {
                matchCriteria.lookingFor = {
                    $in: userProfile.interestedInGenders.includes(userProfile.gender)
                        ? userProfile.interestedInGenders
                        : [...userProfile.interestedInGenders, 'Everyone']
                };
            }

            const potentialMatches = await MongoDB.findMany('heartsync_profiles', matchCriteria, undefined, false, { limit: 20 })

            return potentialMatches;
        } catch (error) {
            console.error('Error getting potential matches:', error);
            return [];
        }
    }

    async swipeProfile(source: number, swipeData: { targetUserId: string; isLike: boolean; isSuperLike?: boolean }) {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return { success: false, isMatch: false };

            const { targetUserId, isLike, isSuperLike = false } = swipeData;

            // Check daily limits
            const userProfile = await MongoDB.findOne('heartsync_profiles', { citizenId });
            if (!userProfile) return { success: false, isMatch: false };

            if (isSuperLike && userProfile.superLikesRemaining <= 0) {
                return { success: false, isMatch: false, error: 'No super likes remaining' };
            }

            // Record the swipe
            await MongoDB.insertOne('heartsync_swipes', {
                _id: generateUUid(),
                fromUserId: citizenId,
                toUserId: targetUserId,
                isLike,
                isSuperLike,
                timestamp: new Date()
            });

            let isMatch = false;

            // Check for match if it's a like
            if (isLike) {
                const reciprocalSwipe = await MongoDB.findOne('heartsync_swipes', {
                    fromUserId: targetUserId,
                    toUserId: citizenId,
                    isLike: true
                });

                if (reciprocalSwipe) {
                    // Create match
                    await MongoDB.insertOne('heartsync_matches', {
                        _id: generateUUid(),
                        user1Id: citizenId,
                        user2Id: targetUserId,
                        matchedAt: new Date(),
                        isActive: true,
                        isSuperLike: isSuperLike || reciprocalSwipe.isSuperLike
                    });
                    isMatch = true;

                    // Send notifications to both users about the match
                    try {
                        // Get player data for both users
                        const swiperData = await global.exports['qb-core'].GetPlayerByCitizenId(citizenId);
                        const targetData = await global.exports['qb-core'].GetPlayerByCitizenId(targetUserId);
                        
                        // Get offline data if players are not online
                        const swiperPlayerData = swiperData || await global.exports['qb-core'].GetOfflinePlayerByCitizenId(citizenId);
                        const targetPlayerData = targetData || await global.exports['qb-core'].GetOfflinePlayerByCitizenId(targetUserId);

                        // Send notification to the swiper (current user)
                        if (swiperData && swiperData.PlayerData.source) {
                            emitNet("phone:addnotiFication", swiperData.PlayerData.source, JSON.stringify({
                                id: generateUUid(),
                                title: "HeartSync Match! 💕",
                                description: `You matched with ${targetPlayerData.PlayerData.charinfo.firstname} ${targetPlayerData.PlayerData.charinfo.lastname}!`,
                                app: "heartsync",
                                timeout: 5000
                            }));
                        }

                        // Send notification to the target user
                        if (targetData && targetData.PlayerData.source) {
                            emitNet("phone:addnotiFication", targetData.PlayerData.source, JSON.stringify({
                                id: generateUUid(),
                                title: "HeartSync Match! 💕",
                                description: `You matched with ${swiperPlayerData.PlayerData.charinfo.firstname} ${swiperPlayerData.PlayerData.charinfo.lastname}!`,
                                app: "heartsync",
                                timeout: 5000
                            }));
                        }
                    } catch (notificationError) {
                        console.error('Error sending match notifications:', notificationError);
                    }
                }

                // Update swipe counts
                const updateData: any = {
                    dailySwipes: userProfile.dailySwipes + 1
                };

                if (isSuperLike) {
                    updateData.superLikesRemaining = userProfile.superLikesRemaining - 1;
                } else {
                    updateData.likesRemaining = userProfile.likesRemaining - 1;
                }

                await MongoDB.updateOne('heartsync_profiles', { citizenId }, updateData);
            }

            return { success: true, isMatch };
        } catch (error) {
            console.error('Error swiping profile:', error);
            return { success: false, isMatch: false };
        }
    }

    async getMatches(source: number): Promise<any[]> {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return [];

            const matches = await MongoDB.findMany('heartsync_matches', {
                $or: [
                    { user1Id: citizenId },
                    { user2Id: citizenId }
                ],
                isActive: true
            }, undefined, false, { sort: { matchedAt: -1 } });

            const enrichedMatches = await Promise.all(matches.map(async (match: any) => {
                const otherUserId = match.user1Id === citizenId ? match.user2Id : match.user1Id;
                const otherUser = await MongoDB.findOne('heartsync_profiles', { citizenId: otherUserId });

                const lastMessage = await MongoDB.findOne('heartsync_messages', { matchId: match._id }, undefined, false, { sort: { timestamp: -1 } });

                return {
                    ...match,
                    otherUser,
                    lastMessage: lastMessage?.content,
                    lastMessageTime: lastMessage?.timestamp,
                    isNewMatch: !lastMessage,
                    unreadCount: await this.getUnreadMessageCount(match._id!.toString(), citizenId)
                };
            }));

            return enrichedMatches;
        } catch (error) {
            console.error('Error getting matches:', error);
            return [];
        }
    }

    private async getUnreadMessageCount(matchId: string, userId: string): Promise<number> {
        try {
            const count = await MongoDB.findMany('heartsync_messages', {
                matchId,
                receiverId: userId,
                read: false
            }, undefined, false);
            return count.length;
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    // Mock implementations for other methods - replace with actual logic
    async getSwipeStats(source: number) {
        const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
        if (!citizenId) return null;

        const profile = await MongoDB.findOne('heartsync_profiles', { citizenId });
        return profile ? {
            likesRemaining: profile.likesRemaining,
            superLikesRemaining: profile.superLikesRemaining,
            dailySwipes: profile.dailySwipes
        } : null;
    }

    async getNearbyUsers(source: number): Promise<HeartSyncProfile[]> {
        // Mock implementation - replace with actual geolocation logic
        return this.getPotentialMatches(source);
    }

    async getOnlineUsers(source: number): Promise<HeartSyncProfile[]> {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return [];

            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const onlineUsers = await MongoDB.findMany('heartsync_profiles', {
                citizenId: { $ne: citizenId },
                isActive: true,
                lastActive: { $gte: fiveMinutesAgo }
            }, undefined, false, { limit: 10 });

            return onlineUsers;
        } catch (error) {
            console.error('Error getting online users:', error);
            return [];
        }
    }

    async getRecentlyActiveUsers(source: number): Promise<HeartSyncProfile[]> {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return [];

            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentUsers = await MongoDB.findMany('heartsync_profiles', {
                citizenId: { $ne: citizenId },
                isActive: true,
                lastActive: { $gte: oneDayAgo }
            }, undefined, false, { limit: 15, sort: { lastActive: -1 } });

            return recentUsers;
        } catch (error) {
            console.error('Error getting recently active users:', error);
            return [];
        }
    }

    async getTopPicks(source: number): Promise<HeartSyncProfile[]> {
        // Mock implementation - replace with actual algorithm
        const potentialMatches = await this.getPotentialMatches(source);
        return potentialMatches.slice(0, 8);
    }

    async getNotifications(source: number) {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return { newMatches: 0, newMessages: 0, superLikes: 0 };

            // Get new matches (matches without messages)
            const newMatches = await MongoDB.findMany('heartsync_matches', {
                $or: [{ user1Id: citizenId }, { user2Id: citizenId }],
                isActive: true,
                // Add logic to check if match is new
            }, undefined, false);

            // Get unread messages
            const newMessages = await MongoDB.findMany('heartsync_messages', {
                receiverId: citizenId,
                read: false
            }, undefined, false);

            // Get received super likes
            const superLikes = await MongoDB.findMany('heartsync_swipes', {
                toUserId: citizenId,
                isSuperLike: true,
                isLike: true
            }, undefined, false);

            return { newMatches: newMatches.length, newMessages: newMessages.length, superLikes: superLikes.length };
        } catch (error) {
            console.error('Error getting notifications:', error);
            return { newMatches: 0, newMessages: 0, superLikes: 0 };
        }
    }

    async getMessages(source: number, data: any) {
        return await MongoDB.findMany('heartsync_messages', { matchId: data.matchId }, undefined, false);
    }

    async sendMessage(source: number, data: any) {
        console.log(data);
        const res = await MongoDB.findOne('heartsync_matches', { _id: String(data.matchId) }, undefined, false);
        const sourceCitizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
        let sourceData = await global.exports['qb-core'].GetPlayerByCitizenId(sourceCitizenId);
        let targetData = await global.exports['qb-core'].GetPlayerByCitizenId(res.user1Id === sourceCitizenId ? res.user2Id : res.user1Id);

        if (!sourceData) {
            sourceData = await global.exports['qb-core'].GetOfflinePlayerByCitizenId(sourceCitizenId);
        }

        if (!targetData) {
            targetData = await Framework.Functions.GetOfflinePlayerByCitizenId(res.user1Id === sourceCitizenId ? res.user2Id : res.user1Id);
        }

        const insertData: Message = {
            _id: generateUUid(),
            read: res.user1Id === sourceCitizenId || res.user2Id === sourceCitizenId ? true : false,
            matchId: res._id,
            senderId: sourceCitizenId,
            receiverId: res.user1Id === sourceCitizenId ? res.user2Id : res.user1Id,
            content: data.content,
            timestamp: new Date().toISOString(),
        }
        await MongoDB.insertOne('heartsync_messages', insertData);

        if (res.user1Id !== sourceCitizenId || res.user2Id !== sourceCitizenId && targetData.PlayerData.source) {
            emitNet('heartsync:client:sendMessage', targetData.PlayerData.source, JSON.stringify(insertData));
            emitNet("phone:addnotiFication", targetData.PlayerData.source, JSON.stringify({
                id: generateUUid(),
                title: "HeartSync",
                description: "You have a new message from " + sourceData.PlayerData.charinfo.firstname + " " + sourceData.PlayerData.charinfo.lastname,
                app: "heartsync",
                timeout: 2000,
            }));
        }

        return insertData;
    }

    async unmatch(source: number, data: { matchId: string }) {
        try {
            const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
            if (!citizenId) return { success: false };

            const match = await MongoDB.findOne('heartsync_matches', { _id: data.matchId });
            if (!match || !match.isActive) return { success: false };

            // Check if the user is part of this match
            if (match.user1Id !== citizenId && match.user2Id !== citizenId) {
                return { success: false, error: 'Not authorized to unmatch this user' };
            }

            // Deactivate the match
            await MongoDB.updateOne('heartsync_matches', { _id: data.matchId }, { isActive: false });

            return { success: true };
        } catch (error) {
            console.error('Error unmatching:', error);
            return { success: false, error: 'Failed to unmatch' };
        }
    }
}

const heartSyncServer = new HeartSyncServer();

// Register server callbacks
onClientCallback('heartsync:getProfile', async (source: number) => {
    return await heartSyncServer.getProfile(source);
});

onClientCallback('heartsync:createProfile', async (source: number, data: any) => {
    return await heartSyncServer.createProfile(source, data);
});

onClientCallback('heartsync:updateProfile', async (source: number, data: any) => {
    return await heartSyncServer.updateProfile(source, data);
});

onClientCallback('heartsync:getPotentialMatches', async (source: number) => {
    return await heartSyncServer.getPotentialMatches(source);
});

onClientCallback('heartsync:swipeProfile', async (source: number, data: any) => {
    return await heartSyncServer.swipeProfile(source, data);
});

onClientCallback('heartsync:getMatches', async (source: number) => {
    return await heartSyncServer.getMatches(source);
});

onClientCallback('heartsync:getSwipeStats', async (source: number) => {
    return await heartSyncServer.getSwipeStats(source);
});

onClientCallback('heartsync:getNearbyUsers', async (source: number) => {
    return await heartSyncServer.getNearbyUsers(source);
});

onClientCallback('heartsync:getOnlineUsers', async (source: number) => {
    return await heartSyncServer.getOnlineUsers(source);
});

onClientCallback('heartsync:getRecentlyActiveUsers', async (source: number) => {
    return await heartSyncServer.getRecentlyActiveUsers(source);
});

onClientCallback('heartsync:getTopPicks', async (source: number) => {
    return await heartSyncServer.getTopPicks(source);
});

onClientCallback('heartsync:getNotifications', async (source: number) => {
    return await heartSyncServer.getNotifications(source);
});

onClientCallback('heartsync:getMessages', async (source: number, data: any) => {
    return await heartSyncServer.getMessages(source, data);
});

onClientCallback('heartsync:sendMessage', async (source: number, data: any) => {
    return await heartSyncServer.sendMessage(source, data);
});

onClientCallback('heartsync:unmatch', async (source: number, data: any) => {
    return await heartSyncServer.unmatch(source, data);
});

// Add more callbacks for messages, super likes, etc.
// ... (implement remaining callbacks as needed)

export { heartSyncServer };
