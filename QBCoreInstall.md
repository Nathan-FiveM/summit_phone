**Addition for QBCore**
``game/shared/utils.ts/ in the phone resource update the code to match your inventory/framework``
```ts
export type FrameworkType = 'qb-core' | 'qbx_core';
export const FRAMEWORK_RESOURCE: FrameworkType = 'qb-core'; // Change this to your framework core qb-core/qbx_core
export type InventoryType = 'lj-inventory' | 'ox_inventory' | 'qb-inventory';
export const INVENTORY_RESOURCE: InventoryType = 'lj-inventory'; // Change this to your inventory system ox_inventory/qb-inventory/lj-inventory etc...
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

Add this function to;
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
Find the function
``QBCore.Functions.CreatePhoneNumber()``
Remove QBCore.Functions.CreatePhoneNumber() and add this instead
```lua
    exports['summit_phone']:GeneratePlayerPhoneNumber(PlayerData.citizenid)
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
    function QBCore.Functions.GetPlayer(source)
        if type(source) == 'number' then
            return QBCore.Players[source]
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
        Citizen.Wait(100)
        if tag then
            PerformHttpRequest(webHook, function(err, text, headers) end, 'POST', json.encode({ username = "QB Logs", content = "@everyone"}), { ['Content-Type'] = 'application/json' })
        end
        if Config.OxLogs then
            lib.logger(-1, name, json.encode(title..' '..message))
        end
    end
    exports('AddLog', AddLog)
```

``On a playerloaded event in client put the following code if the player is not new, if the player is new do not setup as it is already done for you within the GeneratePlayerPhoneNumber();``
```lua
    TriggerEvent('phone:client:setupPhone', PlayerData.citizenid)
    Wait(500)
    exports['summit_phone']:ToggleDisablePhone(false)
```