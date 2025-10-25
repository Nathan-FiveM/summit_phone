export function Delay(ms: number) {
    return new Promise(res => setTimeout(res, ms));
};

export const distanceBetween = (pos1: number[], pos2: number[]) => {
    return Math.hypot(pos1[0] - pos2[0], pos1[1] - pos2[1], pos1[2] - pos2[2])
};

export const generateUUid = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == "x" ? r : r & 0x3 | 0x8;
        return v.toString(16);
    });
};

export const LOGGER = (message: string) => {
    return console.log(`\x1b[1m\x1b[47m\x1b[34m[Summit_Phone] \x1b[4m\x1b[31m${message}\x1b[0m`)
}

export const FRAMEWORK_RESOURCE = 'qb-core'; // Change this to your framework core qb-core/qbx-core
export type InventoryType = 'lj-inventory' | 'ox_inventory' | 'qb-inventory';
export const INVENTORY_RESOURCE: InventoryType = 'lj-inventory'; // Change this to your inventory system ox_inventory/qb-inventory/lj-inventory etc...