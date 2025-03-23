import { NUI } from "@client/classes/NUI";
import { onServerCallback } from "@overextended/ox_lib/client";

onServerCallback('bluepage:refreshPosts', async (data: string) => {
    const { _id } = JSON.parse(data);

    NUI.sendReactMessage('addNotification', {
        id: _id,
        title: 'New Post',
        description: `Someone has posted a new post on the bluepage`,
        app: 'bluepages',
        timeout: 5000
    });

    if (LocalPlayer.state.onPhone) {
        NUI.sendReactMessage('refreshBluePosts', data);
    }
});