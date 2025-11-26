import { Framework, MySQL } from "@server/sv_main";
import { INVENTORY_RESOURCE } from "../../../shared/utils"; // adjust path as needed

const invPath = `nui://${INVENTORY_RESOURCE}/html/images/`;

type RewardType = "vehicle" | "item" | "cash" | "bank" | "weapon";
type Rarity = "legendary" | "epic" | "rare" | "common";

interface RouletteReward {
    id: number;
    type: RewardType;
    model: string | number;
    rarity: Rarity;
    img: string;
    name: string;
    sell: number;
    quantity?: number;
}

interface DailySpinConfigShape {
    TimeToClaim: number;
    AnimationDuration: number;
    RouletteData: Record<number, RouletteReward>;
    RarityProbability: Record<Rarity, number>;
    SellType: "bank" | "cash";
    WeaponAmount: number;
    CarParkingSpawn: string;
}

const DailySpinConfig: DailySpinConfigShape = {
    TimeToClaim: (24 * 3600),

    AnimationDuration: 12,

    RouletteData: {
        0: {
            id: 0,
            type: "vehicle",
            model: "penumbra",
            rarity: "legendary",
            img: "https://docs.fivem.net/vehicles/penumbra.webp",
            name: "Penumbra",
            sell: 25000
        },
        1: {
            id: 1,
            type: "weapon",
            model: "weapon_draco",
            rarity: "epic",
            img: `${invPath}qb_draco.png`,
            name: "Draco",
            sell: 10000
        },
        2: {
            id: 2,
            rarity: "rare",
            type: "weapon",
            model: "weapon_browning",
            img: `${invPath}qb_browning.png`,
            name: "Browning",
            sell: 2500
        },
        3: {
            id: 3,
            rarity: "rare",
            type: "item",
            model: "advancedrepairkit",
            img: `${invPath}advancedkit.png`,
            name: "Adv Repair Kit x5",
            sell: 5000,
            quantity: 5
        },
        4: {
            id: 4,
            rarity: "rare",
            type: "cash",
            model: 10000,
            img: `${invPath}cash.png`,
            name: "$10000 Cash",
            sell: 2500
        },
        5: {
            id: 5,
            rarity: "rare",
            type: "item",
            model: "advancedlockpick",
            img: `${invPath}advancedlockpick.png`,
            name: "Advanced Lockpick x5",
            sell: 2500,
            quantity: 5
        },
        6: {
            id: 6,
            rarity: "common",
            type: "item",
            model: "fak",
            img: `${invPath}firstaid.png`,
            name: "FAK x10",
            sell: 1000,
            quantity: 10
        },
        7: {
            id: 7,
            rarity: "common",
            type: "cash",
            model: 5000,
            img: `${invPath}cash.png`,
            name: "$5000 Cash",
            sell: 1000
        },
        8: {
            id: 8,
            rarity: "common",
            type: "item",
            model: "lockpick",
            img: `${invPath}lockpick.png`,
            name: "Lockpick x10",
            sell: 1000,
            quantity: 10
        },
        9: {
            id: 9,
            rarity: "epic",
            type: "cash",
            model: 25000,
            img: `${invPath}cash.png`,
            name: "$25000 Cash",
            sell: 10000
        },
        10: {
            id: 10,
            rarity: "legendary",
            type: "weapon",
            model: "weapon_ak47",
            img: `${invPath}weapon_assaultrifle.png`,
            name: "AK47",
            sell: 25000
        },
        11: {
            id: 11,
            rarity: "epic",
            type: "vehicle",
            model: "faggio",
            img: "https://docs.fivem.net/vehicles/faggio.webp",
            name: "Faggio",
            sell: 10000
        },
        12: {
            id: 12,
            rarity: "rare",
            type: "item",
            model: "heavyarmor",
            img: `${invPath}armor.png`,
            name: "Heavy Armor x2",
            sell: 2500,
            quantity: 2
        },
        13: {
            id: 13,
            rarity: "common",
            type: "item",
            model: "joint",
            img: `${invPath}joint.png`,
            name: "Joint x15",
            sell: 1000,
            quantity: 15
        },
        14: {
            id: 14,
            rarity: "common",
            type: "item",
            model: "blockocheese",
            img: `${invPath}rat_cheese.png`,
            name: "Cheese x20",
            sell: 1000,
            quantity: 20
        },
        15: {
            id: 15,
            type: "cash",
            model: 75000,
            rarity: "legendary",
            img: `${invPath}cash.png`,
            name: "$75000 Cash",
            sell: 25000
        },
        16: {
            id: 16,
            rarity: "common",
            type: "item",
            model: "recyclable_material",
            img: `${invPath}recyclable-material.png`,
            name: "Recyclables x100",
            sell: 1000,
            quantity: 100
        },
        17: {
            id: 17,
            rarity: "rare",
            type: "item",
            model: "recyclable_material",
            img: `${invPath}recyclable-material.png`,
            name: "Recyclables x250",
            sell: 2500,
            quantity: 250
        },
    },

    RarityProbability: {
        legendary: 0.001,
        epic: 0.02,
        rare: 0.20,
        common: 0.779
    },

    SellType: "bank", // bank or cash

    WeaponAmount: 250, // amount of ammo to give when a weapon is won

    CarParkingSpawn: "alta", // QB: garage, ESX: parking
};

const nowInSeconds = () => Math.floor(Date.now() / 1000);

const formatRemaining = (remaining: number) => {
    const hours = Math.floor(remaining / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;

    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const getCooldownState = (player: any) => {
    const last = player?.PlayerData?.metadata?.PhoneDailySpin ?? 0;
    const diff = nowInSeconds() - last;

    if (diff >= DailySpinConfig.TimeToClaim) {
        return { canClaim: true, lastClaimedDisplay: "00:00:00" };
    }

    const remaining = DailySpinConfig.TimeToClaim - diff;
    return { canClaim: false, lastClaimedDisplay: formatRemaining(remaining) };
};

const resolveFramework = () =>
    Framework ??
    (exports['qb-core']?.GetCoreObject?.() ?? exports['qbx-core']?.GetCoreObject?.());

const getPlayer = (src: number) => resolveFramework()?.Functions?.GetPlayer?.(src);

onNet("dailySpin:getStateServer", () => {
    const src = Number(global.source);
    const player = getPlayer(src);
    if (!player) return;

    const { canClaim, lastClaimedDisplay } = getCooldownState(player);

    emitNet("dailySpin:returnState", src, {
        userData: {
            canClaim,
            lastClaimedDisplay,
        },
        rouletteData: DailySpinConfig.RouletteData,
        probability: DailySpinConfig.RarityProbability,
        animationDuration: DailySpinConfig.AnimationDuration,
    });
});

onNet("dailySpin:claimServer", () => {
    const src = Number(global.source);
    const player = getPlayer(src);
    if (!player) return;

    player.Functions.SetMetaData("PhoneDailySpin", nowInSeconds());
});

onNet("dailySpin:rewardServer", (id: number) => {
    const src = Number(global.source);
    const player = getPlayer(src);
    if (!player) return;

    const rewardId = Number(id);
    if (Number.isNaN(rewardId)) return;

    const reward = DailySpinConfig.RouletteData[rewardId];
    if (!reward) return;

    switch (reward.type) {
        case "vehicle":
            emit("dailySpin:giveVehicle", reward.model, src);
            break;
        case "item":
            emit("dailySpin:giveItem", reward.model, reward.quantity ?? 1, src);
            break;
        case "cash":
            emit("dailySpin:giveCash", reward.model, src);
            break;
        case "bank":
            emit("dailySpin:giveBank", reward.model, src);
            break;
        case "weapon":
            emit("dailySpin:giveWeapon", reward.model, src);
            break;
    }
});

onNet("dailySpin:sellServer", (id: number) => {
    const src = Number(global.source);
    // Selling disabled; treat sell as collect/reward
    emit("dailySpin:rewardServer", id, src);
});

onNet("dailySpin:giveItem", (item: string, qty = 1, src?: number) => {
    const targetSrc = src ?? Number(global.source);
    const player = getPlayer(targetSrc);
    if (!player) return;

    player.Functions.AddItem(item, qty);
});

onNet("dailySpin:giveCash", (amount: number, src?: number) => {
    const targetSrc = src ?? Number(global.source);
    const player = getPlayer(targetSrc);
    if (!player) return;

    player.Functions.AddMoney("cash", amount, "daily-spin-cash");
});

onNet("dailySpin:giveBank", (amount: number, src?: number) => {
    const targetSrc = src ?? Number(global.source);
    const player = getPlayer(targetSrc);
    if (!player) return;

    player.Functions.AddMoney("bank", amount, "daily-spin-bank");
});

onNet("dailySpin:giveWeapon", (weapon: string, src?: number) => {
    const targetSrc = src ?? Number(global.source);
    const player = getPlayer(targetSrc);
    if (!player) return;

    player.Functions.AddItem(weapon, DailySpinConfig.WeaponAmount);
});

const generatePlate = async (): Promise<string> => {
    const fw = resolveFramework();
    if (!fw?.Shared) return "SPIN123";

    const plate = `${fw.Shared.RandomInt(1)}${fw.Shared.RandomStr(2)}${fw.Shared.RandomInt(3)}${fw.Shared.RandomStr(2)}`;

    const exists = MySQL?.scalar ? await MySQL.scalar("SELECT plate FROM player_vehicles WHERE plate = ?", [plate]) : null;
    if (exists) {
        return generatePlate();
    }

    return plate.toUpperCase();
};

onNet("dailySpin:giveVehicle", async (model: string, src?: number) => {
    const targetSrc = src ?? Number(global.source);
    const player = getPlayer(targetSrc);
    if (!player) return;

    const plate = await generatePlate();

    await MySQL?.insert?.(
        "INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, garage, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
            player.PlayerData.license,
            player.PlayerData.citizenid,
            model,
            GetHashKey(model),
            "{}",
            plate,
            DailySpinConfig.CarParkingSpawn,
            0, // stored
        ]
    );
});

const commandCtx = resolveFramework()?.Commands;
if (commandCtx?.Add) {
    commandCtx.Add(
        "resetdailyspin",
        "Reset a player's daily spin cooldown",
        [{ name: "id", help: "Player ID" }],
        true,
        (source: number, args: string[]) => {
            const target = Number(args[0]);
            if (!target) {
                emitNet("QBCore:Notify", source, "Invalid ID", "error");
                return;
            }

            const player = getPlayer(target);
            if (!player) {
                emitNet("QBCore:Notify", source, "Player not online", "error");
                return;
            }

            player.Functions.SetMetaData("PhoneDailySpin", 0);

            emitNet("QBCore:Notify", source, `Daily spin reset for ID ${target}`, "success");
            emitNet("QBCore:Notify", target, "Your Daily Spin has been reset!", "success");
        },
        "admin"
    );
} else {
    console.warn("[summit_phone] Framework.Commands.Add not available; resetdailyspin command not registered.");
}
