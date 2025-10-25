import { FrameWork } from "@client/cl_main";
import { FRAMEWORK_RESOURCE, INVENTORY_RESOURCE } from "../../shared/utils"; // adjust path as needed

class Util {
    public phoneList: string[] = [
        "blue_phone",
        "green_phone",
        "red_phone",
        "gold_phone",
        "purple_phone",
    ];
    public phonesArray: string = "";

    constructor() {
        // You can run setup logic here if needed
    }

    public GetPhoneItem(): string | Promise<string> {
        if (INVENTORY_RESOURCE === "ox_inventory") {
            const hasItem: Record<string, number> = exports.ox_inventory.Search("count", this.phoneList);

            for (let i = 0; i < this.phoneList.length; i++) {
                const phone = this.phoneList[i];
                if (hasItem[phone] > 0) {
                    this.phonesArray = phone;
                    break;
                }
            }

            return this.phonesArray;
        } else {
            return this.GetPhoneItemLj();
        }
    }

    private async GetPhoneItemLj(): Promise<string> {
        this.phonesArray = "";

        try {
            for (let i = 0; i < this.phoneList.length; i++) {
                const phoneItem = this.phoneList[i];
                // @ts-ignore - lj-inventory specific
                const has = await exports[INVENTORY_RESOURCE].HasItem(phoneItem);
                if (has) {
                    this.phonesArray = phoneItem;
                    return this.phonesArray;
                }
            }
        } catch (err) {
            console.error("GetPhoneItem lj-inventory check failed:", err);
        }

        return this.phonesArray;
    }
}

export const Utils = new Util();