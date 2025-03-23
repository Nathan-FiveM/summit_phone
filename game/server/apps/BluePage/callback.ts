import { onClientCallback, triggerClientCallback } from "@overextended/ox_lib/server";
import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

onClientCallback('bluepage:createPost', async (source, data: string) => {
    const { title, content, imageAttachment, phoneNumber, email } = JSON.parse(data);
    console.log('bluepage:createPost', title, content, imageAttachment, phoneNumber, email);
    const dataX = {
        _id: generateUUid(),
        title,
        content,
        imageAttachment,
        phoneNumber,
        email,
        createdAt: new Date().toISOString()
    };
    const res = await MongoDB.insertOne('phone_bluepages', dataX);
    await triggerClientCallback('bluepage:refreshPosts', -1, JSON.stringify(dataX));
});

onClientCallback('bluepage:getPosts', async (source) => {
    const res = await MongoDB.findMany('phone_bluepages', {}, null, false, {
        sort: { createdAt: -1 }
    });
    return JSON.stringify(res);
});

onClientCallback('bluepage:deletePost', async (source, data: string) => {
    const res = await MongoDB.deleteOne('phone_bluepages', { _id: data });
    await triggerClientCallback('bluepage:refreshDeletePost', -1, data);
});