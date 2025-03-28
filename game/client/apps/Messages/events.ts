import { NUI } from "@client/classes/NUI";

onNet('phone_messages:client:updateMessages', (messages: any) => {
    NUI.sendReactMessage('upDatemessages', messages);
});

// RegisterCommand('testGroup', async (source: number, args: string[]) => {

//     /* const res = await triggerServerCallback('phone_message:getMessageChannelsandLastMessages', 1);
//     console.log(res); */

//     // Create Group
//     /* const createRes = await triggerServerCallback('phone_message:createGroup', 1, JSON.stringify({
//         groupName: 'Test Group',
//         memberPhoneNumbers: ['5655101368', '4879704115']
//     }));
//     console.log('Create Group:', await createRes); */

//     /* const groupId = "962c7263-fa9c-4abd-99a1-9118b475de7b"; */

//     // Send Group Message
//     /* const sendRes = await triggerServerCallback('phone_message:sendMessage', 1, JSON.stringify({
//         type: 'group',
//         groupId: groupId,
//         messageData: {
//             message: 'Hello Group!',
//             attachments: []
//         }
//     }));
//     console.log('Send Group Message:', await sendRes); */

//     // Send Private Message
//     /* const res = triggerServerCallback('phone_message:sendMessage', 1, JSON.stringify({
//         type: 'private',
//         phoneNumber: '5655101368',
//         messageData: {
//             message: 'Test message',
//             attachments: []
//         }
//     }));
//     console.log(await res); */

//     // Add Member
//     /* const addRes = await triggerServerCallback('phone_message:addMember', 1, JSON.stringify({
//         groupId: groupId,
//         phoneNumber: '4879704115'
//     }));
//     console.log('Add Member:', await addRes); */

//     // Remove Member
//     /* const removeRes = await triggerServerCallback('phone_message:removeMember', 1, JSON.stringify({
//         groupId: groupId,
//         phoneNumber: '4879704115'
//     }));
//     console.log('Remove Member:', await removeRes); */

//     // Get Group Messages
//     /* const groupMessages = await triggerServerCallback('phone_message:getGroupMessages', 1, JSON.stringify({
//         groupId: groupId
//     }));
//     console.log('Group Messages:', await groupMessages); */

//     // Get Private Messages
//     /* const privateMessages = await triggerServerCallback('phone_message:getPrivateMessages', 1, JSON.stringify({
//         phoneNumber: '5655101368'
//     }));
//     console.log('Private Messages:', await privateMessages); */

//     // Delete Group
//     /* const deleteRes = await triggerServerCallback('phone_message:deleteGroup', 1, JSON.stringify({
//         groupId: groupId
//     }));
//     console.log('Delete Group:', await deleteRes); */
// }, false);

/* RegisterCommand('getMessageStats', async (source: number, args: string[]) => {
    
}, false); */

// RegisterCommand('deleteMessage', async (source: number, args: string[]) => {
//     const conversationType = args[0] || 'private'; // 'private' or 'group'
//     const phoneNumber = args[1] || '5655101368';   // For private, optional for group
//     const groupId = args[2] || 'groupUuid';        // For group, optional for private
//     const messageIndex = parseInt(args[3]) || 0;   // Index of message to delete

//     const res = await triggerServerCallback('phone_message:deleteMessage', 1, JSON.stringify({
//         conversationType: conversationType,
//         phoneNumber: conversationType === 'private' ? phoneNumber : undefined,
//         groupId: conversationType === 'group' ? groupId : undefined,
//         messageIndex: messageIndex
//     }));

//     console.log('Delete Message Response:', await res);
// }, false);