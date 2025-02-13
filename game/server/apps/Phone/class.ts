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

    public async isPlayerCalling(id: number, data: {
        number: string,
        source: number,
        targetSource: number,
    }) {
        this.calling.set(id, data);
    }

   
}
export const Phones = new Phone();