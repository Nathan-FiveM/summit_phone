import { onServerCallback } from "@overextended/ox_lib/client";
import { NUI } from "@client/classes/NUI";

onServerCallback('pigeon:refreshTweet', (data: string) => {
    if (LocalPlayer.state.onPhone) {
        NUI.sendReactMessage('pigeonRefreshTweet', data);
    }
    return true;
});

onServerCallback('pigeon:refreshRepost', (data: string) => {
    if (LocalPlayer.state.onPhone) {
        NUI.sendReactMessage('pigeonRefreshRepost', data);
    }
    return true;
});

onServerCallback('bluepage:refreshDeletePost', (data: string) => {
    if (LocalPlayer.state.onPhone) {
        NUI.sendReactMessage('refreshDeletePost', data);
    }
    return true;
});

onNet('phone:refreshPrivateMessage', (data: string) => {
    if (LocalPlayer.state.onPhone) {
        NUI.sendReactMessage('pigeonRefreshPrivateMessage', data);
    }
});