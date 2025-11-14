local invPath = "nui://lj-inventory/html/images/"
DailySpinConfig = {
    TimeToClaim = (24 * 3600),

    AnimationDuration = 12,

    RouletteData = {
        [0] = {
            id = 0,
            type = "vehicle",
            model = "penumbra",
            rarity = "legendary",
            img = 'https://docs.fivem.net/vehicles/penumbra.webp',
            name = "Penumbra",
            sell = 25000
        },
        [1] = {
            id = 1,
            type = "weapon",
            model = "weapon_draco",
            rarity = "epic",
            img = invPath.."qb_draco.png",
            name = "Draco",
            sell = 10000
        },
        [2] = {
            id = 2,
            rarity = "rare",
            type = "weapon",
            model = "weapon_browning",
            img = invPath.."qb_browning.png",
            name = "Browning",
            sell = 2500
        },
        [3] = {
            id = 3,
            rarity = "rare",
            type = "item",
            model = "advancedrepairkit",
            img = invPath.."advancedkit.png",
            name = "Adv Repair Kit x5",
            sell = 5000,
            quantity = 5
        },
        [4] = {
            id = 4,
            rarity = "rare",
            type = "cash",
            model = 10000,
            img = invPath..'cash.png',
            name = "$10000 Cash",
            sell = 2500
        },
        [5] = {
            id = 5,
            rarity = "rare",
            type = "item",
            model = "advancedlockpick",
            img = invPath.."advancedlockpick.png",
            name = "Advanced Lockpick x5",
            sell = 2500,
            quantity = 5
        },
        [6] = {
            id = 6,
            rarity = "common",
            type = "item",
            model = "fak",
            img = invPath.."firstaid.png",
            name = "FAK x10",
            sell = 1000,
            quantity = 10
        },
        [7] = {
            id = 7,
            rarity = "common",
            type = "cash",
            model = 5000,
            img = invPath..'cash.png',
            name = "$5000 Cash",
            sell = 1000
        },
        [8] = {
            id = 8,
            rarity = "common",
            type = "item",
            model = "lockpick",
            img = invPath.."lockpick.png",
            name = "Lockpick x10",
            sell = 1000,
            quantity = 10
        },
        [9] = {
            id = 9,
            rarity = "epic",
            type = "cash",
            model = "cash",
            img = invPath..'cash.png',
            name = "$25000 Cash",
            sell = 10000
        },
        [10] = {
            id = 10,
            rarity = "legendary",
            type = "weapon",
            model = "weapon_ak47",
            img = invPath.."weapon_assaultrifle.png",
            name = "AK47",
            sell = 25000
        },
        [11] = {
            id = 11,
            rarity = "epic",
            type = "vehicle",
            model = "faggio",
            img = 'https://docs.fivem.net/vehicles/faggio.webp',
            name = "Faggio",
            sell = 10000
        },
        [12] = {
            id = 12,
            rarity = "rare",
            type = "item",
            model = "heavyarmor",
            img = invPath.."armor.png",
            name = "Heavy Armor x2",
            sell = 2500,
            quantity = 2
        },
        [13] = {
            id = 13,
            rarity = "common",
            type = "item",
            model = "joint",
            img = invPath.."joint.png",
            name = "Joint x15",
            sell = 1000,
            quantity = 15
        },
        [14] = {
            id = 14,
            rarity = "common",
            type = "item",
            model = "blockocheese",
            img = invPath.."rat_cheese.png",
            name = "Cheese x20",
            sell = 1000,
            quantity = 20
        },
        [15] = {
            id = 15,
            type = "cash",
            model = 75000,
            rarity = "legendary",
            img = invPath..'cash.png',
            name = "$75000 Cash",
            sell = 25000
        },
        [16] = {
            id = 16,
            rarity = "common",
            type = "item",
            model = "recyclable_material",
            img = invPath.."recyclable-material.png",
            name = "Recyclables x100",
            sell = 1000,
            quantity = 100
        },
        [17] = {
            id = 17,
            rarity = "rare",
            type = "item",
            model = "recyclable_material",
            img = invPath.."recyclable-material.png",
            name = "Recyclables x250",
            sell = 2500,
            quantity = 250
        },
    },

    RarityProbability = {
        legendary = 0.001,
        epic = 0.02,
        rare = 0.20,
        common = 0.779
    },

    SellType = 'bank', -- bank or cash

    WeaponAmount = 250, -- amount of ammo to give when a weapon is won

    CarParkingSpawn = 'alta', -- QB: garage, ESX: parking
}

-- DAILY SPIN SERVER (PURE QBCORE)

local QBCore = exports['qb-core']:GetCoreObject()

local function getCooldownState(Player)
    local last = Player.PlayerData.metadata["PhoneDailySpin"] or 0
    local now = os.time()
    local diff = now - last

    if diff >= DailySpinConfig.TimeToClaim then
        return true, "00:00:00" -- can claim
    end

    local remain = DailySpinConfig.TimeToClaim - diff
    
    local hours = math.floor(remain / 3600)
    local mins  = math.floor((remain % 3600) / 60)
    local secs  = remain % 60

    return false, string.format(
        "%02d:%02d:%02d",
        hours, mins, secs
    )
end

RegisterNetEvent("dailySpin:getStateServer", function()
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    local canClaim, remaining = getCooldownState(Player)

    TriggerClientEvent("dailySpin:returnState", src, {
        userData = {
            canClaim = canClaim,
            lastClaimedDisplay = remaining,
        },
        rouletteData = DailySpinConfig.RouletteData,
        probability = DailySpinConfig.RarityProbability,
        animationDuration = DailySpinConfig.AnimationDuration,
    })
end)

RegisterNetEvent("dailySpin:claimServer", function()
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    Player.Functions.SetMetaData("PhoneDailySpin", os.time())
end)

RegisterNetEvent("dailySpin:rewardServer", function(id)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    local reward = DailySpinConfig.RouletteData[id]
    if not reward then return end

    if reward.type == "vehicle" then
        TriggerEvent("dailySpin:giveVehicle", reward.model, src)
    elseif reward.type == "item" then
        TriggerEvent("dailySpin:giveItem", reward.model, reward.quantity or 1, src)
    elseif reward.type == "cash" then
        TriggerEvent("dailySpin:giveCash", reward.model, src)
    elseif reward.type == "bank" then
        TriggerEvent("dailySpin:giveBank", reward.model, src)
    elseif reward.type == "weapon" then
        TriggerEvent("dailySpin:giveWeapon", reward.model, src)
    end
end)

RegisterNetEvent("dailySpin:sellServer", function(id, src)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    local reward = DailySpinConfig.RouletteData[id]
    if not reward or not reward.sell then return end

    Player.Functions.AddMoney(DailySpinConfig.SellType, reward.sell, "daily-spin-sell")
end)

-- GIVE ITEM
RegisterNetEvent("dailySpin:giveItem", function(item, qty, src)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    Player.Functions.AddItem(item, qty)
end)

-- GIVE CASH
RegisterNetEvent("dailySpin:giveCash", function(amount, src)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    Player.Functions.AddMoney("cash", amount, "daily-spin-cash")
end)

-- GIVE BANK
RegisterNetEvent("dailySpin:giveBank", function(amount, src)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    Player.Functions.AddMoney("bank", amount, "daily-spin-bank")
end)

-- GIVE WEAPON
RegisterNetEvent("dailySpin:giveWeapon", function(weapon, src)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    Player.Functions.AddItem(weapon, DailySpinConfig.WeaponAmount)
end)

-- QBCORE PLATE GENERATOR
local function GeneratePlate()
    local plate = QBCore.Shared.RandomInt(1)
        .. QBCore.Shared.RandomStr(2)
        .. QBCore.Shared.RandomInt(3)
        .. QBCore.Shared.RandomStr(2)

    local exists = MySQL.scalar.await(
        "SELECT plate FROM player_vehicles WHERE plate = ?",
        { plate }
    )

    if exists then
        return GeneratePlate()
    end

    return plate:upper()
end

-- GIVE VEHICLE
RegisterNetEvent("dailySpin:giveVehicle", function(model, src)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    local plate = GeneratePlate()

    MySQL.insert(
        'INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, garage, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        {
            Player.PlayerData.license,
            Player.PlayerData.citizenid,
            model,
            GetHashKey(model),
            '{}',
            plate,
            DailySpinConfig.CarParkingSpawn,
            0 -- stored
        }
    )
end)

QBCore.Commands.Add("resetdailyspin", "Reset a player's daily spin cooldown", {{name="id", help="Player ID"}}, true, function(source, args)
    local target = tonumber(args[1])
    if not target then
        TriggerClientEvent('QBCore:Notify', source, "Invalid ID", "error")
        return
    end

    local Player = QBCore.Functions.GetPlayer(target)
    if not Player then
        TriggerClientEvent('QBCore:Notify', source, "Player not online", "error")
        return
    end

    Player.Functions.SetMetaData("PhoneDailySpin", 0)

    TriggerClientEvent('QBCore:Notify', source, "Daily spin reset for ID "..target, "success")
    TriggerClientEvent('QBCore:Notify', target, "Your Daily Spin has been reset!", "success")
end, 'admin')