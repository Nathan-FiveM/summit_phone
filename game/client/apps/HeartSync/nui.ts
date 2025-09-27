import { NUI } from '@client/classes/NUI';
import { triggerServerCallback } from '@overextended/ox_lib/client';

class HeartSyncClient {
    async getProfile() {
        return await triggerServerCallback('heartsync:getProfile', null);
    }

    async createProfile(profileData: any) {
        return await triggerServerCallback('heartsync:createProfile', null, profileData);
    }

    async updateProfile(profileData: any) {
        return await triggerServerCallback('heartsync:updateProfile', null, profileData);
    }

    async getPotentialMatches() {
        return await triggerServerCallback('heartsync:getPotentialMatches', null);
    }

    async swipeProfile(swipeData: { targetUserId: string; isLike: boolean; isSuperLike?: boolean }) {
        return await triggerServerCallback('heartsync:swipeProfile', null, swipeData);
    }

    async getMatches() {
        return await triggerServerCallback('heartsync:getMatches', null);
    }

    async getMessages(matchData: { matchId: string }) {
        return await triggerServerCallback('heartsync:getMessages', null, matchData);
    }

    async sendMessage(messageData: { matchId: string; content: string }) {
        return await triggerServerCallback('heartsync:sendMessage', null, messageData);
    }

    async unmatch(unmatchData: { matchId: string }) {
        return await triggerServerCallback('heartsync:unmatch', null, unmatchData);
    }

    async updateSettings(settingsData: any) {
        return await triggerServerCallback('heartsync:updateSettings', null, settingsData);
    }

    async getSwipeStats() {
        return await triggerServerCallback('heartsync:getSwipeStats', null);
    }

    async getNearbyUsers() {
        return await triggerServerCallback('heartsync:getNearbyUsers', null);
    }

    async getOnlineUsers() {
        return await triggerServerCallback('heartsync:getOnlineUsers', null);
    }

    async getRecentlyActiveUsers() {
        return await triggerServerCallback('heartsync:getRecentlyActiveUsers', null);
    }

    async getTopPicks() {
        return await triggerServerCallback('heartsync:getTopPicks', null);
    }

    async getReceivedSuperLikes() {
        return await triggerServerCallback('heartsync:getReceivedSuperLikes', null);
    }

    async getSentSuperLikes() {
        return await triggerServerCallback('heartsync:getSentSuperLikes', null);
    }

    async likeBack(likeData: { targetUserId: string }) {
        return await triggerServerCallback('heartsync:likeBack', null, likeData);
    }

    async passSuperLike(passData: { superLikeId: string }) {
        return await triggerServerCallback('heartsync:passSuperLike', null, passData);
    }

    async viewProfile(profileData: { profileId: string }) {
        return await triggerServerCallback('heartsync:viewProfile', null, profileData);
    }

    async quickLike(likeData: { targetUserId: string }) {
        return await triggerServerCallback('heartsync:quickLike', null, likeData);
    }

    async getNotifications() {
        return await triggerServerCallback('heartsync:getNotifications', null);
    }
}

const heartSyncClient = new HeartSyncClient();

// Register NUI callbacks
RegisterNuiCallback('heartsync_getProfile', async (data: any, cb: any) => {
    const res = await heartSyncClient.getProfile();
    cb(res);
});

RegisterNuiCallback('heartsync_createProfile', async (data: any, cb: any) => {
    const res = await heartSyncClient.createProfile(data);
    cb(res);
});

RegisterNuiCallback('heartsync_updateProfile', async (data: any, cb: any) => {
    const res = await heartSyncClient.updateProfile(data);
    cb(res);
});

RegisterNuiCallback('heartsync_getPotentialMatches', async (data: any, cb: any) => {
    const res = await heartSyncClient.getPotentialMatches();
    cb(res);
});

RegisterNuiCallback('heartsync_swipeProfile', async (data: any, cb: any) => {
    const res = await heartSyncClient.swipeProfile(data);
    cb(res);
});

RegisterNuiCallback('heartsync_getMatches', async (data: any, cb: any) => {
    const res = await heartSyncClient.getMatches();
    cb(res);
});

RegisterNuiCallback('heartsync_getMessages', async (data: any, cb: any) => {
    const res = await heartSyncClient.getMessages(data);
    cb(res);
});

RegisterNuiCallback('heartsync_sendMessage', async (data: any, cb: any) => {
    const res = await heartSyncClient.sendMessage(data);
    cb(res);
});

RegisterNuiCallback('heartsync_unmatch', async (data: any, cb: any) => {
    const res = await heartSyncClient.unmatch(data);
    cb(res);
});

RegisterNuiCallback('heartsync_updateSettings', async (data: any, cb: any) => {
    const res = await heartSyncClient.updateSettings(data);
    cb(res);
});

RegisterNuiCallback('heartsync_getSwipeStats', async (data: any, cb: any) => {
    const res = await heartSyncClient.getSwipeStats();
    cb(res);
});

RegisterNuiCallback('heartsync_getNearbyUsers', async (data: any, cb: any) => {
    const res = await heartSyncClient.getNearbyUsers();
    cb(res);
});

RegisterNuiCallback('heartsync_getOnlineUsers', async (data: any, cb: any) => {
    const res = await heartSyncClient.getOnlineUsers();
    cb(res);
});

RegisterNuiCallback('heartsync_getRecentlyActiveUsers', async (data: any, cb: any) => {
    const res = await heartSyncClient.getRecentlyActiveUsers();
    cb(res);
});

RegisterNuiCallback('heartsync_getTopPicks', async (data: any, cb: any) => {
    const res = await heartSyncClient.getTopPicks();
    cb(res);
});

RegisterNuiCallback('heartsync_getReceivedSuperLikes', async (data: any, cb: any) => {
    const res = await heartSyncClient.getReceivedSuperLikes();
    cb(res);
});

RegisterNuiCallback('heartsync_getSentSuperLikes', async (data: any, cb: any) => {
    const res = await heartSyncClient.getSentSuperLikes();
    cb(res);
});

RegisterNuiCallback('heartsync_likeBack', async (data: any, cb: any) => {
    const res = await heartSyncClient.likeBack(data);
    cb(res);
});

RegisterNuiCallback('heartsync_passSuperLike', async (data: any, cb: any) => {
    const res = await heartSyncClient.passSuperLike(data);
    cb(res);
});

RegisterNuiCallback('heartsync_viewProfile', async (data: any, cb: any) => {
    const res = await heartSyncClient.viewProfile(data);
    cb(res);
});

RegisterNuiCallback('heartsync_quickLike', async (data: any, cb: any) => {
    const res = await heartSyncClient.quickLike(data);
    cb(res);
});

RegisterNuiCallback('heartsync_getNotifications', async (data: any, cb: any) => {
    const res = await heartSyncClient.getNotifications();
    cb(res);
});

onNet('heartsync:client:sendMessage', async (data: any) => {
    NUI.sendReactMessage('updateHeartSyncMessages', data);
});