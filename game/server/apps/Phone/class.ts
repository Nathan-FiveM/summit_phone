import { MongoDB } from "@server/sv_main";
import { LOGGER } from "@shared/utils";

interface OnGoingCall {
    citizenId: string;
    number: string;
    source: number;
}

class Phone {
    public ongoincall = new Map<string, OnGoingCall[]>();
    public calling = new Map<number, {
        number: string,
        source: number,
        targetSource: number,
    }>();
    public gettingCalled = new Map<number, boolean>();
    public async call(source: number, number: string) {

    }

    public async isPlayerCalling(id: number, data: {
        number: string,
        source: number,
        targetSource: number,
    }) {
        this.calling.set(id, data);
    }

    public async isPlayerGettingCalled(id: number, data: boolean) {
        this.gettingCalled.set(id, data);
    }
}
export const Phones = new Phone();