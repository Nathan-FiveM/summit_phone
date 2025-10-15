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
    public async GetPhoneItem(): Promise<string> {
        this.phonesArray = "";

        try {
            for (let i = 0; i < this.phoneList.length; i++) {
                const phoneItem = this.phoneList[i];
                // lj-inventory client exposes HasItem(items, amount?)
                // @ts-ignore
                const has = await exports['lj-inventory'].HasItem(phoneItem);
                if (has) {
                    this.phonesArray = phoneItem;
                    return this.phonesArray;
                }
            }
        } catch (err) {
            console.error('GetPhoneItem lj-inventory check failed:', err);
        }

        return this.phonesArray;
    }
}

export const Utils = new Util();