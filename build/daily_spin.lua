-- summit_phone/client/daily_spin.lua
local invPath = "nui://lj-inventory/html/images/"
DailySpinConfig = {
    TimeToClaim = {
        hours = 23,
        minutes = 59,
        seconds = 0,
    },

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
}

local framework = GetResourceState('es_extended') == 'started' and 'esx'
    or GetResourceState('qb-core') == 'started' and 'qbcore'
    or 'other'

if framework == "qbcore" then
    QBCore = exports['qb-core']:GetCoreObject()
elseif framework == "esx" then
    ESX = exports['es_extended']:getSharedObject()
end

-- We’ll store per-player state in KVP like original script did
local userData = {
    lastClaimed = 0,
    canClaim = true,  -- default: can spin immediately on first use
}

local function TimeToDate(time)
    local day = math.floor(time / 86400)
    local hour = math.floor(time / 3600) % 24
    local minute = math.floor(time / 60) % 60
    local second = time % 60
    return day, hour, minute, second
end

local function DateToTime(day, hour, minute, second)
    return day * 86400 + hour * 3600 + minute * 60 + second
end

local timeToClaim = DateToTime(
    0,
    DailySpinConfig.TimeToClaim['hours'],
    DailySpinConfig.TimeToClaim['minutes'],
    DailySpinConfig.TimeToClaim['seconds']
)

local function loadData()
    local data = GetResourceKvpString('daily_spin_phone')
    if data then
        local ok, decoded = pcall(json.decode, data)
        if ok and decoded then
            for k, v in pairs(decoded) do
                userData[k] = v
            end
        end
    end
end

local function saveData()
    SetResourceKvp('daily_spin_phone', json.encode(userData))
end

-- call this each time UI opens
local function recalcCanClaim()
    local year, month, day, hour, minute, second = GetLocalTime()
    local now = DateToTime(day, hour, minute, second)
    local diff = userData.lastClaimed - now + timeToClaim

    if diff <= 0 then
        userData.canClaim = true
        userData.lastClaimed = 0
        saveData()
        return true, "00:00:00"
    else
        local _, h, m, s = TimeToDate(diff)
        if h < 10 then h = "0" .. h end
        if m < 10 then m = "0" .. m end
        if s < 10 then s = "0" .. s end
        userData.canClaim = false
        return false, string.format("%s:%s:%s", h, m, s)
    end
end

CreateThread(function()
    loadData()
end)

-- 🟢 NUI: get full state (called from React onEnter)
RegisterNUICallback("dailySpin:getState", function(_, cb)
    local canClaim, remaining = recalcCanClaim()

    cb(json.encode({
        userData = {
            canClaim = canClaim,
            lastClaimedDisplay = remaining
        },
        rouletteData = DailySpinConfig.RouletteData,
        probability = DailySpinConfig.RarityProbability,
        animationDuration = DailySpinConfig.AnimationDuration,
    }))
end)

-- 🟢 NUI: claim spin (start cooldown)
RegisterNUICallback("dailySpin:claim", function(_, cb)
    local year, month, day, hour, minute, second = GetLocalTime()
    userData.canClaim = false
    userData.lastClaimed = DateToTime(day, hour, minute, second)
    saveData()
    cb("ok")
end)

-- 🟢 NUI: give reward
RegisterNUICallback("dailySpin:reward", function(data, cb)
    local id = data and data.id
    if not id then cb("error"); return end

    local reward = DailySpinConfig.RouletteData[id]
    if not reward then cb("error"); return end

    if reward.type == 'vehicle' then
        TriggerServerEvent('complete_daily_bonus:giveVehicle', reward.model)
    elseif reward.type == 'item' then
        TriggerServerEvent('complete_daily_bonus:giveItem', reward.model, reward.quantity or 1)
    elseif reward.type == 'cash' then
        TriggerServerEvent('complete_daily_bonus:giveCash', reward.model)
    elseif reward.type == 'bank' then
        TriggerServerEvent('complete_daily_bonus:giveBank', reward.model)
    elseif reward.type == 'weapon' then
        TriggerServerEvent('complete_daily_bonus:giveWeapon', reward.model)
    end

    cb("ok")
end)

-- 🟢 NUI: sell reward
RegisterNUICallback("dailySpin:sell", function(data, cb)
    local id = data and data.id
    if not id then cb("error"); return end

    local reward = DailySpinConfig.RouletteData[id]
    if not reward or not reward.sell then cb("error"); return end

    TriggerServerEvent("complete_daily_bonus:sellReward", reward.sell)
    cb("ok")
end)

-- optional: reset timer command still works from your other script
