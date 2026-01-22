**Addition for QBCore**

## 📦 Inventory Items Setup

**IMPORTANT: Players must have a phone item in their inventory to open the phone using the `M` key.**

Add the following items to your `qb-core/shared/items.lua`:

```lua
['blue_phone'] = {['name'] = 'blue_phone', ['label'] = 'Blue Phone', ['weight'] = 200, ['type'] = 'item', ['image'] = 'blue_phone.png', ['unique'] = true, ['useable'] = true, ['shouldClose'] = true, ['description'] = 'A stylish blue smartphone.'},
['green_phone'] = {['name'] = 'green_phone', ['label'] = 'Green Phone', ['weight'] = 200, ['type'] = 'item', ['image'] = 'green_phone.png', ['unique'] = true, ['useable'] = true, ['shouldClose'] = true, ['description'] = 'A stylish green smartphone.'},
['red_phone'] = {['name'] = 'red_phone', ['label'] = 'Red Phone', ['weight'] = 200, ['type'] = 'item', ['image'] = 'red_phone.png', ['unique'] = true, ['useable'] = true, ['shouldClose'] = true, ['description'] = 'A stylish red smartphone.'},
['gold_phone'] = {['name'] = 'gold_phone', ['label'] = 'Gold Phone', ['weight'] = 200, ['type'] = 'item', ['image'] = 'gold_phone.png', ['unique'] = true, ['useable'] = true, ['shouldClose'] = true, ['description'] = 'A stylish gold smartphone.'},
['purple_phone'] = {['name'] = 'purple_phone', ['label'] = 'Purple Phone', ['weight'] = 200, ['type'] = 'item', ['image'] = 'purple_phone.png', ['unique'] = true, ['useable'] = true, ['shouldClose'] = true, ['description'] = 'A stylish purple smartphone.'},
```

You can also find these items in the `QB_INVENTORY_ITEMS.lua` file in the summit_phone resource folder.

---

## Framework Configuration

``game/shared/utils.ts/ in the phone resource update the code to match your inventory/framework``
```ts
export type FrameworkType = 'qb-core' | 'qbx_core';
export const FRAMEWORK_RESOURCE: FrameworkType = 'qb-core'; // Change this to your framework core qb-core/qbx_core
export type InventoryType = 'lj-inventory' | 'ox_inventory' | 'qb-inventory';
export const INVENTORY_RESOURCE: InventoryType = 'lj-inventory'; // Change this to your inventory system ox_inventory/qb-inventory/lj-inventory etc...
```

Update the PlayerDefaults in the config to the following;
```lua
QBConfig.Player.PlayerDefaults = {
    citizenid = function() return QBCore.Player.CreateCitizenId() end,
    cid = 1,
    money = function()
        local moneyDefaults = {}
        for moneytype, startamount in pairs(QBConfig.Money.MoneyTypes) do
            moneyDefaults[moneytype] = startamount
        end
        return moneyDefaults
    end,
    optin = true,
    charinfo = {
        firstname = 'Firstname',
        lastname = 'Lastname',
        birthdate = '00-00-0000',
        gender = 0,
        nationality = 'USA',
        phone = nil, -- Phone number moved
        account = function() return QBCore.Functions.CreateAccountNumber() end
    },
    job = {
        name = 'unemployed',
        label = 'Civilian',
        payment = 10,
        type = 'none',
        onduty = false,
        isboss = false,
        grade = {
            name = 'Freelancer',
            level = 0
        }
    },
    gang = {
        name = 'none',
        label = 'No Gang Affiliation',
        isboss = false,
        grade = {
            name = 'none',
            level = 0
        }
    },
    metadata = {
        hunger = 100,
        thirst = 100,
        stress = 0,
        isdead = false,
        inlaststand = false,
        armor = 0,
        ishandcuffed = false,
        tracker = false,
        injail = 0,
        jailitems = {},
        status = {},
        phone = {},
        rep = {},
        currentapartment = nil,
        callsign = 'NO CALLSIGN',
        bloodtype = function() return QBConfig.Player.Bloodtypes[math.random(1, #QBConfig.Player.Bloodtypes)] end,
        fingerprint = function() return QBCore.Player.CreateFingerId() end,
        walletid = function() return QBCore.Player.CreateWalletId() end,
        criminalrecord = {
            hasRecord = false,
            date = nil
        },
        licences = {
            driver = true,
            business = false,
            weapon = false
        },
        inside = {
            house = nil,
            apartment = {
                apartmentType = nil,
                apartmentId = nil,
            }
        },
        phonedata = {
            SerialNumber = function() return QBCore.Player.CreateSerialNumber() end,
            InstalledApps = {}
        }
    },
    position = QBConfig.DefaultSpawn,
    items = {},
}
```

Add this function to;
``qb-core/server/functions.lua``
```lua
    ---Get players citizen id
    ---@param citizenid string
    ---@return table?
    function QBCore.Functions.getPlayerCitizenIdBySource(thePlayersSource)
        if not thePlayersSource then
            thePlayersSource = source
        end
        if QBCore.Players[thePlayersSource].PlayerData.citizenid then
            return QBCore.Players[thePlayersSource].PlayerData.citizenid
        end
        return nil
    end
    exports('GetPlayerCitizenIdBySource', QBCore.Functions.getPlayerCitizenIdBySource)
```

Update this function to;
``qb-core/server/functions.lua``
```lua
    ---Get offline player by citizen id
    ---@param citizenid string
    ---@return table?
    function QBCore.Functions.GetOfflinePlayerByCitizenId(citizenid)
        return QBCore.Player.GetOfflinePlayer(citizenid)
    end
    exports('GetOfflinePlayerByCitizenId', QBCore.Functions.GetOfflinePlayerByCitizenId)
```

Add these functions to 
``qb-core/server/player.lua``
```lua
    function QBCore.Player.GetPlayerCharName(source)
        local player = QBCore.Players[source]
        if not player or not player.PlayerData then return nil end

        local charinfo = player.PlayerData.charinfo or {}
        if charinfo.firstname or charinfo.lastname then
            return (charinfo.firstname or '') .. ' ' .. (charinfo.lastname or '')
        else
            return player.PlayerData.name
        end

    end
    exports('GetPlayerName', QBCore.Player.GetPlayerCharName)

    function QBCore.Functions.CheckJobGrade(job, grade)
        local jobInfo = QBCore.Shared.Jobs[job]
        if jobInfo then
            local sgrade = tostring(grade)
            if jobInfo["grades"][sgrade] then
                return true
            end
        end
        return false
    end
    exports('CheckJobGrade', QBCore.Functions.CheckJobGrade)
```
``Update the following QBCore.Player.CheckPlayerData(source, PlayerData) to the code below``
```lua
    function QBCore.Player.CheckPlayerData(source, PlayerData)
        PlayerData = PlayerData or {}
        local Offline = not source

        if source then
            PlayerData.source = source
            PlayerData.license = PlayerData.license or QBCore.Functions.GetIdentifier(source, 'license')
            PlayerData.name = GetPlayerName(source)
        end

        local validatedJob = false
        if PlayerData.job and PlayerData.job.name ~= nil and PlayerData.job.grade and PlayerData.job.grade.level ~= nil then
            local jobInfo = QBCore.Shared.Jobs[PlayerData.job.name]

            if jobInfo then
                local jobGradeInfo = jobInfo.grades[tostring(PlayerData.job.grade.level)]
                if jobGradeInfo then
                    PlayerData.job.label = jobInfo.label
                    PlayerData.job.grade.name = jobGradeInfo.name
                    PlayerData.job.payment = jobGradeInfo.payment
                    PlayerData.job.grade.isboss = jobGradeInfo.isboss or false
                    PlayerData.job.isboss = jobGradeInfo.isboss or false
                    validatedJob = true
                end
            end
        end

        if validatedJob == false then
            -- set to nil, as the default job (unemployed) will be added by `applyDefaults`
            PlayerData.job = nil
        end

        local validatedGang = false
        if PlayerData.gang and PlayerData.gang.name ~= nil and PlayerData.gang.grade and PlayerData.gang.grade.level ~= nil then
            local gangInfo = QBCore.Shared.Gangs[PlayerData.gang.name]

            if gangInfo then
                local gangGradeInfo = gangInfo.grades[tostring(PlayerData.gang.grade.level)]
                if gangGradeInfo then
                    PlayerData.gang.label = gangInfo.label
                    PlayerData.gang.grade.name = gangGradeInfo.name
                    PlayerData.gang.payment = gangGradeInfo.payment
                    PlayerData.gang.grade.isboss = gangGradeInfo.isboss or false
                    PlayerData.gang.isboss = gangGradeInfo.isboss or false
                    validatedGang = true
                end
            end
        end

        if validatedGang == false then
            -- set to nil, as the default gang (unemployed) will be added by `applyDefaults`
            PlayerData.gang = nil
        end

        applyDefaults(PlayerData, QBCore.Config.Player.PlayerDefaults)
        
        -- Fix phone number generation with citizenid BETTER WORKY
        if PlayerData.charinfo and not PlayerData.charinfo.phone then
            PlayerData.charinfo.phone = QBCore.Functions.CreatePhoneNumber(PlayerData.citizenid)
        end
        
        if PlayerData.job and QBCore.Shared.ForceJobDefaultDutyAtLogin then
            local jobInfo = QBCore.Shared.Jobs[PlayerData.job.name]
            if jobInfo then
                PlayerData.job.onduty = jobInfo.defaultDuty
            end
        end

        if GetResourceState('qb-inventory') ~= 'missing' then
            PlayerData.items = exports['qb-inventory']:LoadInventory(PlayerData.source, PlayerData.citizenid)
        end

        return QBCore.Player.CreatePlayer(PlayerData, Offline)
    end
```

Find the function
``qb-core/server/player.lua``
Update this function
```lua
function QBCore.Functions.CreatePhoneNumber()
    local PhoneNumber = math.random(100, 999) .. math.random(1000000, 9999999)
    local result = MySQL.prepare.await('SELECT EXISTS(SELECT 1 FROM players WHERE JSON_UNQUOTE(JSON_EXTRACT(charinfo, "$.phone")) = ?) AS uniqueCheck', { PhoneNumber })
    if result == 0 then return PhoneNumber end
    return QBCore.Functions.CreatePhoneNumber()
end
```
With the following;
NEW QB
```lua
function QBCore.Functions.CreatePhoneNumber(citizenid)
    if not citizenid then 
        print("CreatePhoneNumber called without citizenid FUCKING HELL")
        return nil 
    end
    
    local PhoneNumber = exports['summit_phone']:GeneratePlayerPhoneNumber(citizenid)
    return PhoneNumber
end
```
OLD QB
```lua
function QBCore.Functions.CreatePhoneNumber()
    local PlayerData = QBCore.Players[source].PlayerData
    local PhoneNumber = exports['summit_phone']:GeneratePlayerPhoneNumber(PlayerData.citizenid)
    return PhoneNumber
end
```

``qb-core/server/events.lua -- Update the duty function with the following code``
```lua
    RegisterNetEvent('QBCore:ToggleDuty', function()
        local src = source
        local Player = QBCore.Functions.GetPlayer(src)
        if not Player then return end
        if Player.PlayerData.job.onduty then
            Player.Functions.SetJobDuty(false)
            TriggerClientEvent('QBCore:Notify', src, Lang:t('info.off_duty'))
        else
            Player.Functions.SetJobDuty(true)
            TriggerClientEvent('QBCore:Notify', src, Lang:t('info.on_duty'))
        end
        TriggerClientEvent('QBCore:Client:SetDuty', src, Player.PlayerData.job.onduty)
        -- Update GlobalState job count
        local jobName = Player.PlayerData.job.name
        local onDutyCount = 0

        -- Get all online players and count those on duty for this job
        local Players = QBCore.Functions.GetQBPlayers()
        for _, player in pairs(Players) do
            if player.PlayerData.job.name == jobName and player.PlayerData.job.onduty then
                onDutyCount = onDutyCount + 1
            end
        end

        -- Set GlobalState for the job count
        GlobalState[jobName .. ':count'] = onDutyCount
    end)
```

``Find the Function QBCore.Functions.GetPlayer() - Replace with the following;``
```lua
    ---Get player with given server id (source)
    ---@param source any
    ---@return table
    function QBCore.Functions.GetPlayer(source)
        if tonumber(source) ~= nil then -- If a number is a string ("1"), this will still correctly identify the index to use.
            return QBCore.Players[tonumber(source)]
        else
            return QBCore.Players[QBCore.Functions.GetSource(source)]
        end
    end
    exports('GetPlayer', QBCore.Functions.GetPlayer)
```
In qb-smallresources/server add the following function;
```lua
    function AddLog(data)
        local name = 'phone'
        local title = data.title
        local message = data.message ~= nil and data.message or 'BLANK MESSAGE from log: '..data.type
        local tag = tagEveryone ~= nil and tagEveryone or false
        local webHook = 'webhooklinkhere'
        local embedData = {
            {
                ["title"] = title,
                ["color"] = 16711680,
                ["footer"] = {
                    ["text"] = os.date("%c"),
                },
                ["description"] = message,
            }
        }
        PerformHttpRequest(webHook, function(err, text, headers) end, 'POST', json.encode({ username = "QB Logs",embeds = embedData}), { ['Content-Type'] = 'application/json' })
        Wait(100)
        if tag then
            PerformHttpRequest(webHook, function(err, text, headers) end, 'POST', json.encode({ username = "QB Logs", content = "@everyone"}), { ['Content-Type'] = 'application/json' })
        end
    end
    exports('AddLog', AddLog)
```

``On a playerloaded event in client put the following code if the player is not new, if the player is new do not setup as it is already done for you within the GeneratePlayerPhoneNumber();``
```lua
    TriggerEvent('phone:client:setupPhone', PlayerData.citizenid)
```
