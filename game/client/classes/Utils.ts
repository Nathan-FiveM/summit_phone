import { FrameWork } from "@client/cl_main";

class Util {
    public phoneList: string[] = [
        'blue_phone',
        'green_phone',
        'red_phone',
        'gold_phone',
        'purple_phone',
    ];
    public phonesArray : string = "";
    public GetPhoneItem() {
        const hasItem : {
            'blue_phone': number,
            'green_phone': number,
            'red_phone': number,
            'gold_phone': number,
            'purple_phone': number,
        } = exports.ox_inventory.Search('count', this.phoneList);
        for (let i = 0; i < this.phoneList.length; i++) {
            // @ts-ignore
            if (hasItem[this.phoneList[i]] > 0) {
                this.phonesArray = this.phoneList[i];
            }
        }
        return this.phonesArray;
    }
}

export const Utils = new Util();