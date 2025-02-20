// messagesManager.ts
import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

export type MessageType = "text" | "location" | "image" | "video";
export interface ChatGroup {
    groupId: string;
    name: string;
    members: string[]; // permanent phone numbers
    createdAt: string;
}

export interface ChatMessage {
    messageId: string;
    groupId: string;
    sender: string;
    type: MessageType;
    content: string | { x: number; y: number; z: number };
    timestamp: string;
}

export class MessagesManager {
    async sendMessage(message: ChatMessage): Promise<ChatMessage> {
        await MongoDB.insertOne("chat_messages", message);
        return message;
    }

    async getGroupMessages(groupId: string, limit = 50): Promise<ChatMessage[]> {
        const options = { sort: { timestamp: -1 }, limit };
        return await MongoDB.find("chat_messages", { groupId }, options);
    };

    
}

export const messagesManager = new MessagesManager();