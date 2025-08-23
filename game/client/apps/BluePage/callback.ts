import { NUI } from "@client/classes/NUI";
import { Utils } from "@client/classes/Utils";
import { onServerCallback } from "@overextended/ox_lib/client";

onServerCallback('bluepage:refreshPosts', async (data: string) => {
    const { _id } = JSON.parse(data);
    if (LocalPlayer.state.onPhone) {
        NUI.sendReactMessage('refreshBluePosts', data);
    }
    const phoneItem = Utils.GetPhoneItem();
    if (!phoneItem) {
        emit("QBCore:Notify", "No phone item found", "error");
        return false;
    };
    NUI.sendReactMessage('addNotification', {
        id: _id,
        title: 'New Post',
        description: `Someone has posted a new post on the bluepage`,
        app: 'bluepages',
        timeout: 5000
    });
    return true;
});