import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { MongoDB, Logger } from "@server/sv_main";
import { Delay, generateUUid } from "@shared/utils";

onClientCallback('phone_message:sendMessage', async (client, data: string) => {
    const { type, phoneNumber, groupId, messageData } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
    let firstMessage = false;

    if (!senderId) {
        return JSON.stringify({ success: false, message: 'Sender not found' });
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
            return JSON.stringify({ success: false, message: 'Group not found for sender' });
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
    Logger.AddLog({
        type: 'phone_messages',
        title: 'Message Sent',
        message: `Sender ${senderPhoneNumber} sent a message to ${type === 'private' ? phoneNumber : 'group ' + groupId} with content: ${messageData.message}`,
        showIdentifiers: false
    });
    // Handle recipients
    if (type === 'private') {
        const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
        if (targetCitizenId) {
            const targetMessages = await MongoDB.findOne('phone_messages', { citizenId: targetCitizenId });
            const isBlocked = targetMessages?.blockedNumbers?.includes(senderPhoneNumber);
            if (!isBlocked) {
                await sendToRecipient(targetCitizenId, senderPhoneNumber, messageData, 'private', phoneNumber);
                const CVXCS = await Utils.GetSourceFromCitizenId(targetCitizenId);
                if (CVXCS) {
                    emitNet("phone:addnotiFication", CVXCS, JSON.stringify({
                        id: generateUUid(),
                        title: "Messages",
                        description: "You have a new message",
                        app: "message",
                        timeout: 2000,
                    }));
                    emitNet('phone_messages:client:updateMessages', CVXCS, JSON.stringify(newMessage));
                }
            } else {
                console.log(`Sender ${senderPhoneNumber} is blocked by ${phoneNumber}. Message saved only for sender.`);
            }
        } else {
            console.log(`Recipient with phone number ${phoneNumber} does not exist. Message saved only for sender.`);
        }
    } else if (type === 'group') {
        const groupConversation = userMessages.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
        if (!groupConversation?.members) {
            return JSON.stringify({ success: false, message: 'Group members not found' });
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
                const CVXCS = await Utils.GetSourceFromCitizenId(memberId);
                if (CVXCS) {
                    emitNet("phone:addnotiFication", CVXCS, JSON.stringify({
                        id: generateUUid(),
                        title: "Messages",
                        description: "You have a new message",
                        app: "message",
                        timeout: 2000,
                    }));
                    emitNet('phone_messages:client:updateMessages', CVXCS, JSON.stringify({ ...newMessage, groupId }));
                }
            }
        }
    }

    return JSON.stringify({ success: true });
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
                creatorId: group.creatorId, // Copy creatorId
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
        return JSON.stringify({ success: false, message: 'Sender not found' });
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
        avatar: avatar || '',
        groupId: groupId,
        members: memberIds,
        memberPhoneNumbers: phoneNumbers,
        creatorId: senderId, // Set the creator as the sender
        messages: []
    };

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    emitNet("phone:addnotiFication", client, JSON.stringify({
        id: generateUUid(),
        title: "Messages",
        description: "You created new Group",
        app: "message",
        timeout: 2000,
    }));
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
            const CVXCS = await Utils.GetSourceFromCitizenId(memberId);
            if (CVXCS) {
                emitNet("phone:addnotiFication", CVXCS, JSON.stringify({
                    id: generateUUid(),
                    title: "Messages",
                    description: "You have been added to a new group",
                    app: "message",
                    timeout: 2000,
                }));
            }
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
    Logger.AddLog({
        type: 'phone_groups',
        title: 'Group Created',
        message: `Group '${groupName}' created by ${senderPhoneNumber}. Group ID: ${groupId} with members: ${memberPhoneNumbers.join(', ')}`,
        showIdentifiers: false
    });
    return JSON.stringify({ success: true, groupId });
});

onClientCallback('phone_message:toggleBlock', async (client, data: string) => {
    const { phoneNumber } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);

    if (!senderId) {
        return JSON.stringify({ success: false, message: 'Sender not found' });
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

    const isBlocked = userMessages.blockedNumbers.includes(phoneNumber);
    if (isBlocked) {
        const index = userMessages.blockedNumbers.indexOf(phoneNumber);
        userMessages.blockedNumbers.splice(index, 1);
        emitNet("phone:addNotification", client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: "Number unblocked",
            app: "message",
            timeout: 2000,
        }));
        Logger.AddLog({
            type: 'phone_blocks',
            title: 'Number Unblocked',
            message: `${senderPhoneNumber} unblocked ${phoneNumber}.`,
            showIdentifiers: false
        });
    } else {
        userMessages.blockedNumbers.push(phoneNumber);
        emitNet("phone:addNotification", client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: "Number blocked",
            app: "message",
            timeout: 2000,
        }));
        Logger.AddLog({
            type: 'phone_blocks',
            title: 'Number Blocked',
            message: `${senderPhoneNumber} blocked ${phoneNumber}.`,
            showIdentifiers: false
        });
    }

    if (userMessages.messages.length === 0 && userMessages.blockedNumbers.length === 0 && !userMessages.deletedMessages?.length) {
        await MongoDB.deleteOne('phone_messages', { _id: userMessages._id });
    } else {
        await MongoDB.updateOne('phone_messages', { _id: userMessages._id }, userMessages);
    }

    return JSON.stringify({ success: true });
});

onClientCallback('phone_message:addMember', async (client, data: string) => {
    try {
        const { groupId, phoneNumber } = JSON.parse(data);
        const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
        const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
        if (!senderId) {
            return JSON.stringify({ success: false, message: 'Sender not found' });
        }

        // Validate the new member
        const newMemberId = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
        if (!newMemberId) {
            return JSON.stringify({ success: false, message: 'Member not found' });
        }

        // Fetch the sender's messages to find the group
        let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
        if (!userMessages) {
            return JSON.stringify({ success: false, message: 'Messages not found for sender' });
        }

        const group = userMessages.messages.find((msg: { groupId?: string, members?: string[], creatorId?: string }) => msg.groupId === groupId);
        if (!group || !group.members) {
            return JSON.stringify({ success: false, message: 'Group not found or unauthorized' });
        }

        // Check if the new member is already in the group
        if (group.members.includes(newMemberId)) {
            return JSON.stringify({ success: false, message: 'Member already in group' });
        }

        // Add the new member to the group
        group.members.push(newMemberId);
        group.memberPhoneNumbers.push(phoneNumber);

        // Update all existing members' group data, including the sender and new member
        for (const memberId of group.members) {
            let memberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberId });

            if (!memberMessages) {
                // If the member is new (no messages document), create one
                memberMessages = {
                    _id: generateUUid(),
                    citizenId: memberId,
                    blockedNumbers: [],
                    deletedMessages: [],
                    messages: []
                };
            }

            const memberGroup = memberMessages.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
            if (memberGroup) {
                // Update existing group data for this member
                memberGroup.members = group.members;
                memberGroup.memberPhoneNumbers = group.memberPhoneNumbers;
                memberGroup.avatar = group.avatar; // Ensure avatar is copied
                memberGroup.creatorId = group.creatorId; // Ensure creatorId is copied
            } else {
                // Add the group to this member's messages if it doesn’t exist
                memberMessages.messages.push({ ...group });
            }

            // Save or update the member's messages
            if (memberMessages._id) {
                await MongoDB.updateOne('phone_messages', { _id: memberMessages._id }, memberMessages)
                    .then(() => console.log(`Updated group data for member ${memberId}`))
                    .catch((error: any) => console.error(`Failed to update group data for member ${memberId}:`, error));
            } else {
                await MongoDB.insertOne('phone_messages', memberMessages)
                    .then(() => console.log(`Created messages for new member ${memberId}`))
                    .catch((error: any) => console.error(`Failed to create messages for new member ${memberId}:`, error));
            }
        }
        Logger.AddLog({
            type: 'phone_groups',
            title: 'Member Added',
            message: `${senderPhoneNumber} added ${phoneNumber} to group ${groupId}.`,
            showIdentifiers: false
        });
        return JSON.stringify({ success: true });
    } catch (error) {
        console.error('Error adding member to group:', error);
        return JSON.stringify({ success: false, message: 'An error occurred while adding the member to the group' });
    }
});

onClientCallback('phone_message:removeMember', async (client, data: string) => {
    const { groupId, phoneNumber } = JSON.parse(data);
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
    const memberIdToRemove = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
    if (!memberIdToRemove) {
        return JSON.stringify({ success: false, message: 'Member not found' });
    }

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    const group = userMessages?.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
    if (!group || !group.members) {
        return JSON.stringify({ success: false, message: 'Group not found or unauthorized' });
    }

    const memberIndex = group.members.indexOf(memberIdToRemove);
    if (memberIndex === -1) {
        return JSON.stringify({ success: false, message: 'Member not in group' });
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
            memberGroup.creatorId = group.creatorId; // Ensure creatorId is copied
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
    Logger.AddLog({
        type: 'phone_groups',
        title: 'Member Removed',
        message: `${senderPhoneNumber} removed ${phoneNumber} from group ${groupId}.`,
        showIdentifiers: false
    })
    return JSON.stringify({ success: true });
});

onClientCallback('phone_message:deleteGroup', async (client, groupId: string) => {
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    const group = userMessages?.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
    if (!group || !group.members) {
        return JSON.stringify({ success: false, message: 'Group not found or unauthorized' });
    }

    // Check if the sender is the group creator (admin)
    if (group.creatorId !== senderId) {
        return JSON.stringify({ success: false, message: 'Only the group creator can delete the group' });
    }

    for (const memberId of group.members) {
        const memberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberId });
        const CVXCS = await Utils.GetSourceFromCitizenId(memberId);
        if (CVXCS) {
            emitNet("phone:addnotiFication", CVXCS, JSON.stringify({
                id: generateUUid(),
                title: "Messages",
                description: "Group has been deleted",
                app: "message",
                timeout: 2000,
            }));
        }
        if (memberMessages) {
            const groupIndex = memberMessages.messages.findIndex((msg: { groupId?: string }) => msg.groupId === groupId);
            if (groupIndex !== -1) {
                memberMessages.messages.splice(groupIndex, 1);
                await MongoDB.updateOne('phone_messages', { _id: memberMessages._id }, memberMessages);
            }
        }
    }
    Logger.AddLog({
        type: 'phone_groups',
        title: 'Group Deleted',
        message: `Group ${groupId} deleted by ${senderPhoneNumber}.`,
        showIdentifiers: false
    });
    return JSON.stringify({ success: true });
});

onClientCallback('phone_message:getGroupMessages', async (client, data: string) => {
    const { groupId, page = 1, limit = 20 } = JSON.parse(data); // Add page and limit for pagination
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    if (!senderId) {
        return JSON.stringify({ success: false, messages: [], message: 'Sender not found' });
    }

    const userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        return JSON.stringify({ success: false, messages: [], message: 'No messages found' });
    }

    const conversation = userMessages.messages.find((msg: { type: string, groupId?: string }) =>
        msg.type === 'group' && msg.groupId === groupId);

    if (!conversation) {
        return JSON.stringify({ success: false, messages: [], message: 'Conversation not found' });
    }

    // Sort messages by timestamp (descending) and paginate
    const sortedMessages = conversation.messages.sort((a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMessages = sortedMessages.slice(startIndex, endIndex);

    const hasMore = endIndex < sortedMessages.length;

    return JSON.stringify({
        success: true,
        messages: paginatedMessages,
        memberPhoneNumbers: conversation.memberPhoneNumbers || [],
        name: conversation.name,
        avatar: conversation.avatar || null,
        hasMore: hasMore,
        totalMessages: sortedMessages.length,
        creatorId: conversation.creatorId // Include creatorId for UI or verification if needed
    });
});

onClientCallback('phone_message:getPrivateMessages', async (client, data: string) => {
    const { phoneNumber, page = 1, limit = 20 } = JSON.parse(data); // Add page and limit for pagination
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    if (!senderId) {
        return JSON.stringify({ success: false, messages: [], message: 'Sender not found' });
    }

    const userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        return JSON.stringify({ success: false, messages: [], message: 'No messages found' });
    }

    const conversation = userMessages.messages.find((msg: { type: string, phoneNumber?: string }) =>
        msg.type === 'private' && msg.phoneNumber === phoneNumber);

    if (!conversation) {
        return JSON.stringify({ success: false, messages: [], message: 'Conversation not found' });
    }

    // Sort messages by timestamp (descending) and paginate
    const sortedMessages = conversation.messages.sort((a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedMessages = sortedMessages.slice(startIndex, endIndex);
    const hasMore = endIndex < sortedMessages.length;

    return JSON.stringify({
        success: true,
        messages: paginatedMessages,
        avatar: conversation.avatar || null,
        name: conversation.name,
        hasMore: hasMore,
        totalMessages: sortedMessages.length
    });
});

onClientCallback('phone_message:getMessageChannelsandLastMessages', async (client) => {
    try {
        const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

        if (!senderId) {
            return JSON.stringify({ success: false, message: 'Sender not found' });
        }

        const userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
        if (!userMessages) {
            return JSON.stringify({ success: false, message: 'No messages found' });
        }

        const channels = userMessages.messages.map(async (msg: { type: string, name: string, phoneNumber?: string, avatar: string, groupId?: string, members?: string[], memberPhoneNumbers?: string[], messages: any[], creatorId?: string }) => {
            let updatedName = msg.name;
            let updatedMemberPhoneNumbers = msg.memberPhoneNumbers || [];

            // Handle private conversations
            if (msg.type === 'private' && msg.phoneNumber) {
                const newContactName = await Utils.GetContactNameByNumber(msg.phoneNumber, senderId) || `Unknown (${msg.phoneNumber})`;
                if (newContactName !== msg.name) {
                    // Update the name in the database if it has changed
                    const conversation = userMessages.messages.find((m: any) => m.type === 'private' && m.phoneNumber === msg.phoneNumber);
                    if (conversation) {
                        conversation.name = newContactName;
                        await MongoDB.updateOne('phone_messages', { _id: userMessages._id }, userMessages)
                            .then(() => console.log(`Updated contact name for ${msg.phoneNumber} to ${newContactName}`))
                            .catch((error: any) => console.error(`Failed to update contact name for ${msg.phoneNumber}:`, error));
                    }
                    updatedName = newContactName;
                }
            }
            // Handle group conversations
            else if (msg.type === 'group' && msg.memberPhoneNumbers && msg.memberPhoneNumbers.length > 0) {
                for (let i = 0; i < msg.memberPhoneNumbers.length; i++) {
                    const phone = msg.memberPhoneNumbers[i];
                    const newContactName = await Utils.GetContactNameByNumber(phone, senderId) || `Unknown (${phone})`;
                    // You could update individual member names here if needed, but for group name, we keep it as-is unless specified
                    // Optionally, you could aggregate member names into the group name if desired
                }
            }

            return {
                type: msg.type,
                name: updatedName,
                phoneNumber: msg.phoneNumber,
                groupId: msg.groupId,
                members: msg.members,
                avatar: msg.avatar,
                memberPhoneNumbers: updatedMemberPhoneNumbers,
                lastMessage: msg.messages[msg.messages.length - 1],
                creatorId: msg.creatorId // Include creatorId
            };
        });

        // Wait for all promises to resolve
        const resolvedChannels = await Promise.all(channels);

        return JSON.stringify({ success: true, channels: resolvedChannels });
    } catch (error) {
        console.error('Error fetching message channels and last messages:', error);
        return JSON.stringify({ success: false, message: 'An error occurred while fetching message channels' });
    }
});
onClientCallback('phone_message:getMessageStats', async (client, data: string) => {
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);

    if (!senderId) {
        return JSON.stringify({ success: false, message: 'Sender not found' });
    }

    let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        return JSON.stringify({
            success: true,
            stats: {
                allMessages: 0,
                knownMessages: 0,
                unknownMessages: 0,
                unreadMessages: 0,
                recentlyDeleted: 0
            }
        });
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
        recentlyDeleted = userMessages.deletedMessages.filter((deleted: any) =>
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
    const { conversationType, phoneNumber, groupId, messageIndex } = JSON.parse(data || '{}');
    const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);

    if (!senderId) {
        return JSON.stringify({ success: false, message: 'Sender not found' });
    }

    const userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
    if (!userMessages) {
        return JSON.stringify({ success: false, message: 'Messages not found' });
    }

    let conversation: any;
    if (conversationType === 'private' && phoneNumber) {
        conversation = userMessages.messages.find((msg: any) =>
            msg.type === 'private' && Number(msg.phoneNumber) === Number(phoneNumber)
        );
    } else if (conversationType === 'group' && groupId) {
        conversation = userMessages.messages.find((msg: any) =>
            msg.type === 'group' && String(msg.groupId) === String(groupId)
        );
    }

    if (!conversation) {
        return JSON.stringify({ success: false, message: 'Conversation not found' });
    }

    conversation.messages = conversation.messages.filter((msg: any) => Number(msg.page) !== Number(messageIndex));

    // Persist local change
    await MongoDB.updateOne('phone_messages', { _id: userMessages._id }, userMessages);

    // Attempt remote delete only for private conversations and when target exists
    if (conversationType === 'private' && phoneNumber) {
        const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
        if (targetCitizenId) {
            const targetSource = await Utils.GetSourceFromCitizenId(targetCitizenId);
            const targetMessages = await MongoDB.findOne('phone_messages', { citizenId: targetCitizenId });
            if (targetMessages) {
                const targetConversation = targetMessages.messages.find((msg: any) =>
                    msg.type === 'private' && Number(msg.phoneNumber) === Number(senderPhoneNumber)
                );
                if (targetConversation) {
                    targetConversation.messages = targetConversation.messages.filter((msg: any) => Number(msg.page) !== Number(messageIndex));
                    await MongoDB.updateOne('phone_messages', { _id: targetMessages._id }, targetMessages);
                    if (await exports['qb-core'].DoesPlayerExist(targetSource)) {
                        emitNet('phone_messages:client:updateMessages', Number(targetSource), JSON.stringify(targetMessages));
                    }
                }
            }
        }
    }

    emitNet('phone_messages:client:updateMessages', Number(client), JSON.stringify(userMessages));
    Logger.AddLog({
        type: 'phone_messages',
        title: 'Message Deleted',
        message: `Message deleted from ${conversationType} conversation with ${phoneNumber || groupId} by ${senderPhoneNumber}`,
        showIdentifiers: false
    });
    return JSON.stringify({ success: true });
});

onClientCallback('phone_message:updateGroupName', async (client, data: string) => {
    try {
        const { groupId, newName } = JSON.parse(data);
        const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
        const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
        if (!senderId) {
            return JSON.stringify({ success: false, message: 'Sender not found' });
        }

        let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
        if (!userMessages) {
            return JSON.stringify({ success: false, message: 'Messages not found for sender' });
        }

        const group = userMessages.messages.find((msg: { groupId?: string, creatorId?: string }) => msg.groupId === groupId);
        if (!group) {
            return JSON.stringify({ success: false, message: 'Group not found' });
        }

        if (group.creatorId !== senderId) {
            return JSON.stringify({ success: false, message: 'Only the group creator can update the group name' });
        }
        const oldName = group.name;
        group.name = newName;

        for (const memberId of group.members || []) {
            const memberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberId });
            if (memberMessages) {
                const memberGroup = memberMessages.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
                if (memberGroup) {
                    memberGroup.name = newName;
                    await MongoDB.updateOne('phone_messages', { _id: memberMessages._id }, memberMessages)
                        .then(() => console.log(`Updated group name for member ${memberId}`))
                        .catch((error: any) => console.error(`Failed to update group name for member ${memberId}:`, error));
                } else {
                    console.warn(`Group not found in member ${memberId}'s messages`);
                }
            } else {
                console.warn(`No messages found for member ${memberId}`);
            }
        }

        await MongoDB.updateOne('phone_messages', { _id: userMessages._id }, userMessages)
            .then(() => console.log(`Updated group name for sender ${senderId}`))
            .catch((error: any) => console.error(`Failed to update group name for sender ${senderId}:`, error));

        Logger.AddLog({
            type: 'phone_groups',
            title: 'Group Name Updated',
            message: `Group ${groupId} | ${oldName} name updated to ${newName} by ${senderPhoneNumber}.`,
            showIdentifiers: false
        });
        return JSON.stringify({ success: true });
    } catch (error) {
        console.error('Error updating group name:', error);
        return JSON.stringify({ success: false, message: 'An error occurred while updating the group name' });
    }
});

onClientCallback('phone_message:updateGroupAvatar', async (client, data: string) => {
    try {
        const { groupId, newAvatar } = JSON.parse(data);
        const senderId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
        const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
        if (!senderId) {
            return JSON.stringify({ success: false, message: 'Sender not found' });
        }

        // Fetch the sender's messages to find the group
        let userMessages = await MongoDB.findOne('phone_messages', { citizenId: senderId });
        if (!userMessages) {
            return JSON.stringify({ success: false, message: 'Messages not found for sender' });
        }

        const group = userMessages.messages.find((msg: { groupId?: string, creatorId?: string }) => msg.groupId === groupId);
        if (!group) {
            return JSON.stringify({ success: false, message: 'Group not found' });
        }

        // Check if the sender is the group creator (admin)
        if (group.creatorId !== senderId) {
            return JSON.stringify({ success: false, message: 'Only the group creator can update the group avatar' });
        }

        // Update the group avatar for the sender
        group.avatar = newAvatar;

        // Update the group avatar for all members
        for (const memberId of group.members || []) {
            const memberMessages = await MongoDB.findOne('phone_messages', { citizenId: memberId });
            if (memberMessages) {
                const memberGroup = memberMessages.messages.find((msg: { groupId?: string }) => msg.groupId === groupId);
                if (memberGroup) {
                    memberGroup.avatar = newAvatar;
                    await MongoDB.updateOne('phone_messages', { _id: memberMessages._id }, memberMessages)
                        .then(() => console.log(`Updated group avatar for member ${memberId}`))
                        .catch((error: any) => console.error(`Failed to update group avatar for member ${memberId}:`, error));
                } else {
                    console.warn(`Group not found in member ${memberId}'s messages`);
                }
            } else {
                console.warn(`No messages found for member ${memberId}`);
            }
        }

        // Update the sender's messages
        await MongoDB.updateOne('phone_messages', { _id: userMessages._id }, userMessages)
            .then(() => console.log(`Updated group avatar for sender ${senderId}`))
            .catch((error: any) => console.error(`Failed to update group avatar for sender ${senderId}:`, error));
        Logger.AddLog({
            type: 'phone_groups',
            title: 'Group Avatar Updated',
            message: `Group ${groupId} avatar updated by ${senderPhoneNumber}.`,
            showIdentifiers: false
        });
        return JSON.stringify({ success: true });
    } catch (error) {
        console.error('Error updating group avatar:', error);
        return JSON.stringify({ success: false, message: 'An error occurred while updating the group avatar' });
    }
});