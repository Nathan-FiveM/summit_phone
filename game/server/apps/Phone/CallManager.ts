import { callHistoryManager } from "./callHistoryManager";

export interface CallParticipant {
    source: number;
    citizenId: string;
    phoneNumber: string;
    onHold: boolean;
}

export interface OngoingCall {
    callId: number;
    host: CallParticipant;
    participants: Map<number, CallParticipant>;
    pending: Map<number, NodeJS.Timeout>;
    startTime: Date;
}

class CallManager {
    private calls = new Map<number, OngoingCall>();
    private playerCallMap = new Map<number, number>();
    private ringToneManger = new Map<number, number>();

    public createCall(host: CallParticipant): number {
        const callId = Math.floor(Math.random() * 1000000);
        const newCall: OngoingCall = {
            callId,
            host,
            participants: new Map<number, CallParticipant>(),
            pending: new Map<number, NodeJS.Timeout>(),
            startTime: new Date(),
        };
        newCall.participants.set(host.source, host);
        this.calls.set(callId, newCall);
        this.playerCallMap.set(host.source, callId);
        return callId;
    }
    public getCallHost(callId: number): CallParticipant | undefined {
        const call = this.calls.get(callId);
        if (!call) return;
        return call.host;
    }
    public isPlayerInCall(source: number): boolean {
        return this.playerCallMap.has(source);
    }
    public getCallByPlayer(source: number): OngoingCall | undefined {
        const callId = this.playerCallMap.get(source);
        if (callId) {
            return this.calls.get(callId);
        }
        return undefined;
    }
    public getCallIdByPlayer(source: number) {
        return this.playerCallMap.get(source);
    }
    public addPendingInvitation(
        callId: number,
        targetSource: number,
        timeoutCallback: () => void,
        timeoutMs: number = 30000
    ) {
        const call = this.calls.get(callId);
        if (!call) return;
        if (call.pending.has(targetSource) || call.participants.has(targetSource)) return;
        const timeout = setTimeout(() => {
            timeoutCallback();
            this.removePendingInvitation(callId, targetSource);
        }, timeoutMs);
        call.pending.set(targetSource, timeout);
    }
    public removePendingInvitation(callId: number, targetSource: number) {
        const call = this.calls.get(callId);
        if (!call) return;
        if (call.pending.has(targetSource)) {
            clearTimeout(call.pending.get(targetSource));
            call.pending.delete(targetSource);
        }
    }
    public acceptInvitation(callId: number, participant: CallParticipant): boolean {
        const call = this.calls.get(callId);
        if (!call) return false;
        if (call.participants.has(participant.source)) return false;
        call.participants.set(participant.source, participant);
        this.playerCallMap.set(participant.source, callId);
        if (call.pending.has(participant.source)) {
            clearTimeout(call.pending.get(participant.source));
            call.pending.delete(participant.source);
        }
        return true;
    }
    public declineInvitation(callId: number, targetSource: number) {
        this.removePendingInvitation(callId, targetSource);
    }
    public async removeParticipant(callId: number, source: number) {
        const call = this.calls.get(callId);
        if (!call) return;

        // NEW: End animation for the leaving participant
        emitNet("phone:client:endCallAnimation", source);

        call.participants.delete(source);
        this.playerCallMap.delete(source);
        if (source === call.host.source || call.participants.size <= 1) {
            await callHistoryManager.recordTwoPartyCallHistory(call, "completed", "completed", new Date());
            this.endCall(callId);
        }
    }
    public endCall(callId: number) {
        const call = this.calls.get(callId);
        if (!call) return;

        // NEW: End animations for all participants
        for (const participant of call.participants.values()) {
            emitNet("phone:client:endCallAnimation", participant.source);
        }

        for (const timeout of call.pending.values()) {
            clearTimeout(timeout);
        }
        for (const participant of call.participants.values()) {
            this.playerCallMap.delete(participant.source);
        }
        this.calls.delete(callId);
    }
    public removeFromCall(callId: number, source: number) {
        const call = this.calls.get(callId);
        if (!call) return;
        call.participants.delete(source);
        this.playerCallMap.delete(source);
    }
    public setHoldStatus(callId: number, source: number, hold: boolean): boolean {
        const call = this.calls.get(callId);
        if (!call) return false;
        const participant = call.participants.get(source);
        if (!participant) return false;
        participant.onHold = hold;
        return true;
    }
    public getParticipants(callId: number): CallParticipant[] {
        const call = this.calls.get(callId);
        if (!call) return [];
        return Array.from(call.participants.values());
    }
    public getAllCalls(): IterableIterator<OngoingCall> {
        return this.calls.values();
    }

    public async createRingTone(source: any, ringtoneLink: string, volume: number) {
        const ped = GetPlayerPed(source);
        const pedId = NetworkGetNetworkIdFromEntity(ped);
        const soundId = await exports['summit_soundhandler'].StartAttachSound(ringtoneLink, pedId, 5, GetGameTimer(), true, 0.15);
        this.ringToneManger.set(source, soundId);
    }
    public async stopRingTone(source: number) {
        const soundId = this.ringToneManger.get(source);
        if (!soundId) return;
        exports['summit_soundhandler'].StopSound(soundId);
        this.ringToneManger.delete(source);
    }
}

export const callManager = new CallManager();