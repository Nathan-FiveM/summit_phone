import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

type databaseSchema = {
    _id: string,
    citizenId: string,
    messages: {
        type: "private" | "group",
        name: string,
        phoneNumber?: string,
        groupId?: string,
        members?: string[],
        memberPhoneNumbers?: string[],
        messages: {
            message: string,
            read: boolean,
            page: number,
            timestamp: Date,
            senderId: string,
            attachments: {
                type: string,
                url: string
            }[]
        }[]
    }[]
};

onClientCallback('phone_message:sendMessage', async (client, data: string) => {
    const { type, phoneNumber, groupId, messageData } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
    let firstMessage = false;

    if (!senderId) {
        return { success: false, message: 'Sender not found' };
    }

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        userMessages = {
            _id: generateUUid(),
            citizenId: senderId,
            blockedNumbers: [],
            deletedMessages: [],
            messages: []
        };
        firstMessage = true;
    }

    let conversation;
    if (type === 'private') {
        conversation = userMessages.messages.find((msg: { type: string, phoneNumber?: string }) => 
            msg.type === 'private' && msg.phoneNumber === phoneNumber);
        if (!conversation) {
            const contactName = await Utils.GetContactNameByNumber(phoneNumber, senderId) || `Unknown (${phoneNumber})`;
            const avatar = await Utils.GetContactAvatarByNumber(phoneNumber, senderId) || null; // Assume this utility exists
            conversation = {
                type: 'private',
                name: contactName,
                avatar: avatar, // Set avatar for private contact
                phoneNumber: phoneNumber,
                messages: []
            };
            userMessages.messages.push(conversation);
        }
    } else if (type === 'group') {
        conversation = userMessages.messages.find((msg: { type: string, groupId?: string }) => 
            msg.type === 'group' && msg.groupId === groupId);
        if (!conversation) {
            return { success: false, message: 'Group not found for sender' };
        }
    }

    const lastMessage = conversation.messages[conversation.messages.length - 1];
    const nextPage = lastMessage ? lastMessage.page + 1 : 1;

    const newMessage = {
        message: messageData.message,
        read: true,
        page: nextPage,
        timestamp: new Date().toISOString(),
        senderId: senderPhoneNumber,
        attachments: messageData.attachments || []
    };

    conversation.messages.push(newMessage);

    if (!firstMessage) {
        await MongoDB.updateOne('phone_messages', { _id: userMessages._id }, userMessages);
    } else {
        await MongoDB.insertOne('phone_messages', userMessages);
    }

    // Handle recipients
    if (type === 'private') {
        const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
        if (targetCitizenId) {
            const targetMessages = await MongoDB.findOne('phone_messages', { citizenId: targetCitizenId });
            const isBlocked = targetMessages?.blockedNumbers?.includes(senderPhoneNumber);
            if (!isBlocked) {
                await sendToRecipient(targetCitizenId, senderPhoneNumber, messageData, 'private', phoneNumber);
            } else {
                console.log(`Sender ${senderPhoneNumber} is blocked by ${phoneNumber}. Message saved only for sender.`);
            }
        } else {
            console.log(`Recipient with phone number ${phoneNumber} does not exist. Message saved only for sender.`);
        }
    } else if (type === 'group') {
        const groupConversation = userMessages.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
        if (!groupConversation?.members) {
            return { success: false, message: 'Group members not found' };
        }
        for (const memberId of groupConversation.members) {
            if (memberId !== senderId) {
                const memberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberId });
                const memberPhoneNumber = await Utils.GetPhoneNumberByCitizenId(memberId);
                const isBlocked = memberMessages?.blockedNumbers?.includes(senderPhoneNumber);
                if (!isBlocked) {
                    await sendToRecipient(memberId, senderPhoneNumber, messageData, 'group', undefined, groupId);
                } else {
                    console.log(`Sender ${senderPhoneNumber} is blocked by group member ${memberPhoneNumber}.`);
                }
            }
        }
    }

    return { success: true };
});

// Helper function to send messages to recipients (unchanged)
async function sendToRecipient(
    targetCitizenId: string,
    senderPhoneNumber: string,
    messageData: any,
    type: 'private' | 'group',
    phoneNumber?: string,
    groupId?: string
) {
    let targetMessages = await MongoDB.findOne('phone_messages', { citizenId: targetCitizenId });
    let receiverFirstMessage = false;

    if (!targetMessages) {
        targetMessages = {
            _id: generateUUid(),
            citizenId: targetCitizenId,
            blockedNumbers: [],
            deletedMessages: [],
            messages: []
        };
        receiverFirstMessage = true;
    }

    let targetConversation;
    if (type === 'private') {
        targetConversation = targetMessages.messages.find((msg: { type: string, phoneNumber?: string }) => 
            msg.type === 'private' && msg.phoneNumber === senderPhoneNumber);
        if (!targetConversation) {
            const contactName = await Utils.GetContactNameByNumber(senderPhoneNumber, targetCitizenId);
            const avatar = await Utils.GetContactAvatarByNumber(senderPhoneNumber, targetCitizenId) || ''; // Assume this utility exists
            targetConversation = {
                type: 'private',
                name: contactName || `Unknown (${senderPhoneNumber})`,
                avatar: avatar, // Set avatar for private contact
                phoneNumber: senderPhoneNumber,
                messages: []
            };
            targetMessages.messages.push(targetConversation);
        }
    } else if (type === 'group') {
        targetConversation = targetMessages.messages.find((msg: { type: string, groupId?: string }) => 
            msg.type === 'group' && msg.groupId === groupId);
        if (!targetConversation) {
            const senderMessages = await MongoDB.findOne('phone_messages', { citizenId: await Utils.GetCitizenIdByPhoneNumber(senderPhoneNumber) });
            const group = senderMessages?.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
            if (!group) return;
            targetConversation = {
                type: 'group',
                name: group.name,
                avatar: group.avatar || null, // Copy avatar from sender's group
                groupId: groupId,
                members: group.members,
                memberPhoneNumbers: group.memberPhoneNumbers,
                messages: []
            };
            targetMessages.messages.push(targetConversation);
        }
    }

    const targetLastMessage = targetConversation.messages[targetConversation.messages.length - 1];
    const targetNextPage = targetLastMessage ? targetLastMessage.page + 1 : 1;

    const targetNewMessage = {
        message: messageData.message,
        read: false,
        page: targetNextPage,
        timestamp: new Date().toISOString(),
        senderId: senderPhoneNumber,
        attachments: messageData.attachments || []
    };

    targetConversation.messages.push(targetNewMessage);

    if (!receiverFirstMessage) {
        await MongoDB.updateOne('phone_messages', { _id: targetMessages._id }, targetMessages);
    } else {
        await MongoDB.insertOne('phone_messages', targetMessages);
    }
}

onClientCallback('phone_message:createGroup', async (client, data: string) => {
    const { groupName, memberPhoneNumbers, avatar } = JSON.parse(data); // Added avatar field
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);

    if (!senderId) {
        return { success: false, message: 'Sender not found' };
    }

    const memberIds = [senderId];
    const phoneNumbers = [senderPhoneNumber];
    for (const phone of memberPhoneNumbers) {
        const citizenId = await Utils.GetCitizenIdByPhoneNumber(phone);
        if (citizenId && !memberIds.includes(citizenId)) {
            memberIds.push(citizenId);
            phoneNumbers.push(phone);
        }
    }

    const groupId = generateUUid();
    const groupConversation = {
        type: 'group',
        name: groupName,
        avatar: avatar || null, // Use provided avatar or default to null
        groupId: groupId,
        members: memberIds,
        memberPhoneNumbers: phoneNumbers,
        messages: []
    };

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        userMessages = {
            _id: generateUUid(),
            citizenId: senderId,
            blockedNumbers: [],
            deletedMessages: [],
            messages: [groupConversation]
        };
        await MongoDB.insertOne('phone_messages', userMessages);
    } else {
        userMessages.messages.push(groupConversation);
        await MongoDB.updateOne('phone_messages', { _id: userMessages._id }, userMessages);
    }

    for (const memberId of memberIds) {
        if (memberId !== senderId) {
            let memberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberId });
            if (!memberMessages) {
                memberMessages = {
                    _id: generateUUid(),
                    citizenId: memberId,
                    blockedNumbers: [],
                    deletedMessages: [],
                    messages: [{ ...groupConversation }]
                };
                await MongoDB.insertOne('phone_messages', memberMessages);
            } else {
                memberMessages.messages.push({ ...groupConversation });
                await MongoDB.updateOne('phone_messages', { _id: memberMessages._id }, memberMessages);
            }
        }
    }

    return { success: true, groupId };
});

onClientCallback('phone_message:toggleBlock', async (client, data: string) => {
    const { phoneNumber, action } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    if (!senderId) {
        return { success: false, message: 'Sender not found' };
    }

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        userMessages = {
            _id: generateUUid(),
            citizenId: senderId,
            blockedNumbers: [],
            deletedMessages: [],
            messages: []
        };
    }

    if (!userMessages.blockedNumbers) {
        userMessages.blockedNumbers = [];
    }

    if (action === 'block') {
        if (!userMessages.blockedNumbers.includes(phoneNumber)) {
            userMessages.blockedNumbers.push(phoneNumber);
        } else {
            return { success: false, message: 'Number already blocked' };
        }
    } else if (action === 'unblock') {
        const index = userMessages.blockedNumbers.indexOf(phoneNumber);
        if (index !== -1) {
            userMessages.blockedNumbers.splice(index, 1);
        } else {
            return { success: false, message: 'Number not blocked' };
        }
    } else {
        return { success: false, message: 'Invalid action' };
    }

    if (userMessages.messages.length === 0 && userMessages.blockedNumbers.length === 0 && !userMessages.deletedMessages?.length) {
        await MongoDB.deleteOne('phone_messages', { _id: userMessages._id });
    } else {
        await MongoDB.updateOne('phone_messages', { _id: userMessages._id }, userMessages);
    }

    return { success: true };
});

onClientCallback('phone_message:addMember', async (client, data: string) => {
    const { groupId, phoneNumber } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    const newMemberId = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
    if (!newMemberId) {
        return { success: false, message: 'Member not found' };
    }

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    const group = userMessages?.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
    if (!group || !group.members) {
        return { success: false, message: 'Group not found or unauthorized' };
    }

    if (group.members.includes(newMemberId)) {
        return { success: false, message: 'Member already in group' };
    }

    group.members.push(newMemberId);
    group.memberPhoneNumbers.push(phoneNumber);

    for (const memberId of group.members) {
        let memberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberId });
        const memberGroup = memberMessages?.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
        if (memberGroup) {
            memberGroup.members = group.members;
            memberGroup.memberPhoneNumbers = group.memberPhoneNumbers;
            memberGroup.avatar = group.avatar; // Ensure avatar is copied
            await MongoDB.updateOne('phone_messages', { _id: memberMessages._id }, memberMessages);
        } else if (memberId === newMemberId) {
            memberMessages = memberMessages || {
                _id: generateUUid(),
                citizenId: memberId,
                blockedNumbers: [],
                deletedMessages: [],
                messages: []
            };
            memberMessages.messages.push({ ...group });
            await MongoDB.insertOne('phone_messages', memberMessages);
        }
    }

    return { success: true };
});

onClientCallback('phone_message:removeMember', async (client, data: string) => {
    const { groupId, phoneNumber } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    const memberIdToRemove = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
    if (!memberIdToRemove) {
        return { success: false, message: 'Member not found' };
    }

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    const group = userMessages?.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
    if (!group || !group.members) {
        return { success: false, message: 'Group not found or unauthorized' };
    }

    const memberIndex = group.members.indexOf(memberIdToRemove);
    if (memberIndex === -1) {
        return { success: false, message: 'Member not in group' };
    }

    group.members.splice(memberIndex, 1);
    group.memberPhoneNumbers.splice(memberIndex, 1);

    for (const memberId of group.members) {
        const memberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberId });
        const memberGroup = memberMessages?.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
        if (memberGroup) {
            memberGroup.members = group.members;
            memberGroup.memberPhoneNumbers = group.memberPhoneNumbers;
            memberGroup.avatar = group.avatar; // Ensure avatar is copied
            await MongoDB.updateOne('phone_messages', { _id: memberMessages._id }, memberMessages);
        }
    }

    const removedMemberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberIdToRemove });
    if (removedMemberMessages) {
        const groupIndex = removedMemberMessages.messages.findIndex((msg: { groupId?: string }) => msg.groupId === groupId);
        if (groupIndex !== -1) {
            removedMemberMessages.messages.splice(groupIndex, 1);
            await MongoDB.updateOne('phone_messages', { _id: removedMemberMessages._id }, removedMemberMessages);
        }
    }

    return { success: true };
});

onClientCallback('phone_message:deleteGroup', async (client, data: string) => {
    const { groupId } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    const group = userMessages?.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
    if (!group || !group.members) {
        return { success: false, message: 'Group not found or unauthorized' };
    }

    for (const memberId of group.members) {
        const memberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberId });
        if (memberMessages) {
            const groupIndex = memberMessages.messages.findIndex((msg: { groupId?: string }) => msg.groupId === groupId);
            if (groupIndex !== -1) {
                memberMessages.messages.splice(groupIndex, 1);
                await MongoDB.updateOne('phone_messages', { _id: memberMessages._id }, memberMessages);
            }
        }
    }

    return { success: true };
});

onClientCallback('phone_message:getGroupMessages', async (client, data: string) => {
    const { groupId } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    const userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        return { success: false, messages: [], message: 'No messages found' };
    }

    const conversation = userMessages.messages.find((msg: { type: string, groupId?: string }) =>
        msg.type === 'group' && msg.groupId === groupId);
    return {
        success: true,
        messages: conversation?.messages || [],
        memberPhoneNumbers: conversation?.memberPhoneNumbers || [],
        avatar: conversation?.avatar || null // Include avatar
    };
});

onClientCallback('phone_message:getPrivateMessages', async (client, data: string) => {
    const { phoneNumber } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    const userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        return { success: false, messages: [], message: 'No messages found' };
    }

    const conversation = userMessages.messages.find((msg: { type: string, phoneNumber?: string }) => 
        msg.type === 'private' && msg.phoneNumber === phoneNumber);
    return { 
        success: true, 
        messages: conversation?.messages || [], 
        avatar: conversation?.avatar || null // Include avatar
    };
});

onClientCallback('phone_message:getMessageChannelsandLastMessages', async (client) => {
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    const userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        return { success: false, message: 'No messages found' };
    }

    const channels = userMessages.messages.map((msg: { type: string, name: string, phoneNumber?: string, avatar:string, groupId?: string, members?: string[], memberPhoneNumbers?: string[], messages: any[] }) => {
        return {
            type: msg.type,
            name: msg.name,
            phoneNumber: msg.phoneNumber,
            groupId: msg.groupId,
            members: msg.members,
            avatar: msg.avatar,
            memberPhoneNumbers: msg.memberPhoneNumbers,
            lastMessage: msg.messages[msg.messages.length - 1]
        };
    });

    return JSON.stringify({ success: true, channels });
});

onClientCallback('phone_message:getMessageStats', async (client, data: string) => {
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    if (!senderId) {
        return { success: false, message: 'Sender not found' };
    }

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        return {
            success: true,
            stats: {
                allMessages: 0,
                knownMessages: 0,
                unknownMessages: 0,
                unreadMessages: 0,
                recentlyDeleted: 0
            },
            conversations: [] // Return list of conversations with avatars
        };
    }

    const currentDate = new Date();
    const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    let allMessages = 0;
    let knownMessages = 0;
    let unknownMessages = 0;
    let unreadMessages = 0;
    let recentlyDeleted = 0;

    for (const conversation of userMessages.messages) {
        for (const message of conversation.messages) {
            allMessages += 1;

            const isKnown = conversation.name && !conversation.name.match(/^[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/);
            if (isKnown) {
                knownMessages += 1;
            } else {
                unknownMessages += 1;
            }

            if (!message.read) {
                unreadMessages += 1;
            }
        }
    }

    if (userMessages.deletedMessages) {
        recentlyDeleted = userMessages.deletedMessages.filter((deleted:any) => 
            deleted.timestamp > thirtyDaysAgo
        ).length;
    }

    return JSON.stringify({
        success: true,
        stats: {
            allMessages,
            knownMessages,
            unknownMessages,
            unreadMessages,
            recentlyDeleted
        }
    });
});

onClientCallback('phone_message:deleteMessage', async (client, data: string) => {
    const { conversationType, phoneNumber, groupId, messageIndex } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    if (!senderId) {
        return { success: false, message: 'Sender not found' };
    }

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        return { success: false, message: 'Messages not found' };
    }

    let conversation;
    if (conversationType === 'private') {
        conversation = userMessages.messages.find((msg: { type: string, phoneNumber?: string }) => 
            msg.type === 'private' && msg.phoneNumber === phoneNumber);
    } else if (conversationType === 'group') {
        conversation = userMessages.messages.find((msg: { type: string, groupId?: string }) => 
            msg.type === 'group' && msg.groupId === groupId);
    }

    if (!conversation || messageIndex < 0 || messageIndex >= conversation.messages.length) {
        return { success: false, message: 'Message not found' };
    }

    const deletedMessage = conversation.messages.splice(messageIndex, 1)[0];
    const messageId = generateUUid();

    if (!userMessages.deletedMessages) {
        userMessages.deletedMessages = [];
    }

    userMessages.deletedMessages.push({
        messageId: messageId,
        timestamp: new Date().toISOString(),
        conversationType: conversation.type,
        phoneNumber: conversation.phoneNumber,
        groupId: conversation.groupId
    });

    const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
    userMessages.deletedMessages = userMessages.deletedMessages.filter((deleted:any) => 
        deleted.timestamp > thirtyDaysAgo
    );

    await MongoDB.updateOne('phone_messages', { _id: userMessages._id }, userMessages);

    return { success: true };
});