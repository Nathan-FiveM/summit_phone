import { MongoDB } from "@server/sv_main";
import { LOGGER } from "@shared/utils";

interface OnGoingCall {
    citizenId: string;
    number: string;
    source: number;
    onHold: boolean;
}

interface AddCallingPlayer {
    targetNumber: string;
    targetSource: number;
}

type OngoinCallStorage = {
    source: number;
    callHostsource: number;
    callHostCitizenId: string;
    callingData: AddCallingPlayer[];
    members: OnGoingCall[];
}

class CallManger {
    public callsstorageWithCallid = new Map<number, OngoinCallStorage>();

    public async isPlayerCalling(source:number){
        return this.callsstorageWithCallid.has(source);
    }

    public async isPlayerGettingCall(source:number){
        return this.callsstorageWithCallid.values().find(c => c.callingData.find(d => d.targetSource === source));
    }

    public async createHostCall(source: number, callHostsource:number, callHostCitizenId: string) {
        this.callsstorageWithCallid.set(source, { source, callHostsource, callHostCitizenId, callingData : [], members: [] });
    }

    public async removeHostCall(source: number) {
        this.callsstorageWithCallid.delete(source);
    }

    public async addCallingPlayer(source: number, targetNumber: string, targetSource: number) {
        const call = this.callsstorageWithCallid.get(source);
        if (call) {
            call.callingData.push({ targetNumber, targetSource });
            this.callsstorageWithCallid.set(source, call);
        }
    }

    public async removeCallingPlayer(source: number, targetNumber: string, targetSource: number) {
        const call = this.callsstorageWithCallid.get(source);
        if (call) {
            call.callingData = call.callingData.filter(c => c.targetNumber !== targetNumber);
            this.callsstorageWithCallid.set(source, call);
        }
    }

    public async addMemberToCall(source: number, callHostsource: number, callHostCitizenId: string, member: OnGoingCall) {
        const call = this.callsstorageWithCallid.get(source);
        if (call) {
            call.members.push(member);
            this.callsstorageWithCallid.set(source, call);
        }
    }

    public async removeMemberFromCall(source: number, callHostsource: number, callHostCitizenId: string, member: OnGoingCall) {
        const call = this.callsstorageWithCallid.get(source);
        if (call) {
            call.members = call.members.filter(m => m.citizenId !== member.citizenId);
            this.callsstorageWithCallid.set(source, call);
        }
    }
}

export const CallsManger = new CallManger();