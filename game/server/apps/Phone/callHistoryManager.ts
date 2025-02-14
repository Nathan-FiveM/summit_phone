import { MongoDB } from "@server/sv_main";

export interface PlayerCallHistory {
    callId: number;
    role: "caller" | "callee";
    myPhoneNumber: string;
    otherPartyPhoneNumber: string;

    status: "unanswered" | "missed" | "declined" | "completed";
    callTime: number;
    callTimestamp: string;
}

export class CallHistoryManager {
    async recordTwoPartyCallHistory(
        call: {
            callId: number;
            host: { citizenId: string; phoneNumber: string };
            participants: Map<number, { citizenId: string; phoneNumber: string; onHold: boolean }>;
            startTime: Date;
        },
        callerStatus: "unanswered" | "declined" | "completed",
        calleeStatus: "missed" | "declined" | "completed",
        endTime: Date
    ) {
        const callTime = (endTime.getTime() - call.startTime.getTime()) / 1000;
        const timestamp = endTime.toISOString();

        const calleeArray = Array.from(call.participants.values());
        if (calleeArray.length < 1) {
            console.error("No callee found for two-party call");
            return;
        }
        const callee = calleeArray[0];

        const callerRecord: PlayerCallHistory = {
            callId: call.callId,
            role: "caller",
            myPhoneNumber: call.host.phoneNumber,
            otherPartyPhoneNumber: callee.phoneNumber,
            status: callerStatus,
            callTime,
            callTimestamp: timestamp,
        };

        const calleeRecord: PlayerCallHistory = {
            callId: call.callId,
            role: "callee",
            myPhoneNumber: callee.phoneNumber,
            otherPartyPhoneNumber: call.host.phoneNumber,
            status: calleeStatus,
            callTime,
            callTimestamp: timestamp,
        };

        try {
            await MongoDB.insertOne("call_history", callerRecord);
            await MongoDB.insertOne("call_history", calleeRecord);
            console.log(`Two-party call history recorded for callId ${call.callId}`);
        } catch (error) {
            console.error("Failed to record two-party call history:", error);
        }
    }


    async getPlayerCallHistory(phoneNumber: string, maxRecords: number): Promise<PlayerCallHistory[]> {
        const query = { myPhoneNumber: phoneNumber };
        const options = { sort: { _id: -1 }, limit: maxRecords };

        try {
            const result = await MongoDB.findMany("call_history", query, ()=>{}, false, options);
            return result;
        } catch (error) {
            console.error("Error retrieving call history for phone number:", phoneNumber, error);
            return [];
        }
    }
}

export const callHistoryManager = new CallHistoryManager();
