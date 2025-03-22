import { onServerCallback } from "@overextended/ox_lib/client";
import { TweetData } from "../../../../types/types";
import { NUI } from "@client/classes/NUI";

onServerCallback('pigeon:refreshTweet', (data: string) => {
    NUI.sendReactMessage('pigeonRefreshTweet', data);
    return true;
});

onServerCallback('pigeon:refreshRepost', (data: string) => {
    NUI.sendReactMessage('pigeonRefreshRepost', data);
    return true;
});