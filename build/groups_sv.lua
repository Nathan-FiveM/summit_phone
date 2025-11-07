local QBCore = exports['qb-core']:GetCoreObject()

local JobCenter = {
    -- Non-VPN Jobs
    ['towing'] = {
        vpn = false,
        label = "Towing",
        description = "Help tow broken down vehicles for the city.",
        coords = vector3(-238.94, -1183.74, 0.0),
        JobInformation = "Locate broken down or illegally parked vehicles marked on your GPS, use your tow truck to attach and transport them back to the city impound. Make sure to follow traffic laws and return to base for your payment.",
    },
    ['taxi'] = {
        vpn = false,
        label = "Taxi",
        description = "Drive passengers to their destinations.",
        coords = vector3(909.51, -177.36, 0.0),
        JobInformation = "Pick up passengers waiting at taxi stands or who call for rides. Drive them safely to their destination following the GPS route. You’ll earn cash for each successful drop-off.",
    },
    ['storedelivery'] = {
        vpn = false,
        label = "Store Deliveries",
        description = "Deliver goods to local stores.",
        coords = vector3(153.2579, -3210.59, 0.0),
        JobInformation = "Pick up delivery boxes from the depot. Follow your GPS to each store and drop off the items at their loading zones. Ensure timely delivery for a bonus.",
    },
    ['sani'] = {
        vpn = false,
        label = "Sanitation Worker",
        description = "Clean up the city as part of the Sanitation Department.",
        coords = vector3(-351.44, -1566.37, 0.0),
        JobInformation = "Work with the city sanitation crew. Collect trash bags from assigned streets, throw them into the garbage truck, and empty at the landfill for your pay.",
    },
    ['mining'] = {
        vpn = false,
        label = "Mining Crew",
        description = "Mine valuable ores deep in the quarry.",
        coords = vector3(-598.545, 2096.533, 0.0),
        JobInformation = "Head to the quarry and collect rocks from the mining area. Use a pickaxe to extract ore, process it, and deliver it to the smelter for cash rewards.",
    },
    ['chickens'] = {
        vpn = false,
        label = "Chicken Farmer",
        description = "Process chickens and collect meat for local restaurants.",
        coords = vector3(2390.438, 5044.779, 0.0),
        JobInformation = "Collect live chickens, process them at the farm, and package the meat. Deliver finished goods to designated buyers to earn money.",
    },
    ['fishing'] = {
        vpn = false,
        label = "Fishing",
        description = "Catch fish to sell at the docks or markets.",
        coords = vector3(-335.15, 6105.79, 0.0),
        JobInformation = "Grab a fishing rod, find a good spot near the water, and start fishing. Sell your catch to the fishmonger for profit — rare fish pay extra.",
    },
    ['hunting'] = {
        vpn = false,
        label = "Hunting",
        description = "Hunt animals in the wilderness and sell pelts for cash.",
        coords = vector3(-1616.03, 3727.290, 0.0),
        JobInformation = "Travel to the hunting grounds and track animals using your rifle. Skin the animals to collect meat and pelts, then sell them at the butcher for income.",
    },
    ['lumber'] = {
        vpn = false,
        label = "Lumberjack",
        description = "Chop down trees and sell lumber.",
        coords = vector3(1168.487, -1347.83, 0.0),
        JobInformation = "Use your axe to chop down marked trees, process them into logs, and deliver them to the lumber mill for payment.",
    },
    ['panning'] = {
        vpn = false,
        label = "Gold Panning",
        description = "Pan for gold in rivers and streams.",
        coords = vector3(-1509.00, 1508.842, 0.0),
        JobInformation = "Use your gold pan at shallow water spots to find small nuggets. Collect enough to sell to gold traders for a tidy profit.",
    },
    ['postop'] = {
        vpn = false,
        label = "PostOp Worker",
        description = "Deliver mail and packages across the city.",
        coords = vector3(-432.51, -2787.98, 0.0),
        JobInformation = "Pick up packages from the PostOp depot. Follow GPS markers to each delivery address, drop the items, and return to the depot to get paid.",
    },

    -- VPN-Required Jobs
    ['theftcar'] = {
        vpn = true,
        label = "Chop Shop",
        description = "Steal cars and strip them for valuable parts.",
        coords = vector3(-214.485, -1366.22, 0.0),
        JobInformation = "Locate high-value vehicles on the map, steal them without attracting police attention, and bring them to the chop shop for dismantling and payment.",
    },
    ['oxyrun'] = {
        vpn = true,
        label = "Oxy Run",
        description = "Deliver 'packages' around the city for extra cash.",
        coords = vector3(-1159.56, -1521.9, 10.62),
        JobInformation = "Meet the supplier to pick up Oxy packages. Deliver them discreetly around the city. Avoid police attention or you’ll lose your payout.",
    },
    ['taco'] = {
        vpn = true,
        label = "Taco Shop",
        description = "Run an underground taco stand.",
        coords = vector3(12.43, -1599.23, 29.37),
        JobInformation = "Collect taco ingredients, cook them at your stand, and serve customers quickly to maximize earnings.",
    },
    ['houserobbery'] = {
        vpn = true,
        label = "House Robbery",
        description = "Break into homes and grab valuables.",
        coords = vector3(706.8385, -965.994, 0.0),
        JobInformation = "Scope out houses with little activity, break in quietly, and search for valuables. Watch for alarms or nearby residents. Fence stolen goods for cash.",
    },
}

local function PlayerHasVPN(Player)
    local items = Player.Functions.GetItemsByName('vpn')
    return items and #items > 0
end

-- Return job list to phone
lib.callback.register('summit_groups:server:getAvailableJobs', function(source)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return {} end

    local hasVPN = PlayerHasVPN(Player)
    local available = {}

    for id, data in pairs(JobCenter) do
        if not data.vpn or (data.vpn and hasVPN) then
            table.insert(available, {
                id = id,                                     -- ✅ used by phone UI
                label = data.label,                           -- ✅ job label
                description = data.description,               -- ✅ job description
                coords = { x = data.coords.x, y = data.coords.y, z = data.coords.z }, -- ✅ plain table (not vector)
            })
        end
    end

    return available
end)

-- Handle GPS button
RegisterNetEvent('summit_groups:server:setJobWaypoint', function(data)
    local src = source
    local jobId = data and data.jobId or data
    local jobData = JobCenter[jobId]

    if jobData then
        local c = jobData.coords
        TriggerClientEvent('summit_groups:client:setWaypoint', src, { x = c.x, y = c.y, z = c.z }, jobData.label)
    else
        print(('[SUMMIT_PHONE] Unknown jobId %s'):format(jobId))
    end
end)

-- Send Job Info Email to Player
RegisterNetEvent('summit_groups:server:sendJobInfoEmail', function(jobId)
    local src = source
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    local jobData = JobCenter[jobId]
    if not jobData then
        print(('[SUMMIT_PHONE] Unknown jobId for email: %s'):format(jobId))
        return
    end

    -- Use JobInformation if available, otherwise fallback to description
    local jobInfo = jobData.JobInformation or jobData.description or "No information available."

    local emailSubject = ('Job Info - %s'):format(jobData.label)
    local emailMessage = string.format([[
        Hello %s,

        ──────────────────────────────

        Here’s your job breakdown for %s

        ──────────────────────────────

        📋 Summary:
        %s

        ──────────────────────────────

        Remember to complete your duties carefully and return to base for payment.

        City Job Center
    ]],
        Player.PlayerData.charinfo.firstname,
        jobData.label,
        jobInfo
    )
    local citizenId = Player.PlayerData.citizenid
    local emailAddress = exports['summit_phone']:GetEmailIdByCitizenId(citizenId)

    if emailAddress then
        emailData = {
            email = emailAddress,
            subject = emailSubject,
            message = emailMessage,
        }
        TriggerEvent('ignis_phone:sendNewMail', src, emailData)
    end
end)