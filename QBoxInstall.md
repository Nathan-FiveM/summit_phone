**Addition for QBox**
``game/shared/utils.ts/ in the phone resource update the code to match your inventory/framework``
```ts
export type FrameworkType = 'qb-core' | 'qbx_core';
export const FRAMEWORK_RESOURCE: FrameworkType = 'qb-core'; // Change this to your framework core qb-core/qbx_core
export type InventoryType = 'lj-inventory' | 'ox_inventory' | 'qb-inventory';
export const INVENTORY_RESOURCE: InventoryType = 'lj-inventory'; // Change this to your inventory system ox_inventory/qb-inventory/lj-inventory etc...
```

``qbx_core/server/functions.lua``
```lua
    ---@param citizenid string
    ---@return Player?
    function GetPlayerCitizenIdBySource(thePlayersSource)
        if not thePlayersSource then
            thePlayersSource = source
        end
        if QBX.Players[thePlayersSource].PlayerData.citizenid then
            return QBX.Players[thePlayersSource].PlayerData.citizenid
        end
    end
    exports('GetPlayerCitizenIdBySource', GetPlayerCitizenIdBySource)
```
```lua
    function GetPlayerCharName(source)
        local player = QBX.Players[source]
        if not player or not player.PlayerData then return nil end

        local charinfo = player.PlayerData.charinfo or {}
        if charinfo.firstname or charinfo.lastname then
            return (charinfo.firstname or '') .. ' ' .. (charinfo.lastname or '')
        else
            return player.PlayerData.name
        end

    end
    exports('GetPlayerName', GetPlayerCharName)
```
```lua
    function CheckJobGrade(job, grade)
        local jobInfo = QBX.Shared.Jobs[job]
        if jobInfo then
            local sgrade = tostring(grade)
            if jobInfo["grades"][sgrade] then
                return true
            end
        end
        return false
    end
    exports('CheckJobGrade', CheckJobGrade)
```

``qbx_core/server/player.lua -- Replace the SetJobDuty with the following``

```lua
    ---@param identifier Source | string
    ---@param onDuty boolean
    function SetJobDuty(identifier, onDuty)
        local player = type(identifier) == 'string' and (GetPlayerByCitizenId(identifier) or GetOfflinePlayer(identifier)) or GetPlayer(identifier)

        if not player then return end

        player.PlayerData.job.onduty = not not onDuty

        if player.Offline then return end

        TriggerEvent('QBCore:Server:SetDuty', player.PlayerData.source, player.PlayerData.job.onduty)
        TriggerClientEvent('QBCore:Client:SetDuty', player.PlayerData.source, player.PlayerData.job.onduty)

        UpdatePlayerData(identifier)

            -- Update GlobalState job count
        local jobName = player.PlayerData.job.name
        local onDutyCount = 0

        -- Get all online players and count those on duty for this job
        local Players = GetQBPlayers()
        for _, player in pairs(Players) do
            if player.PlayerData.job.name == jobName and player.PlayerData.job.onduty then
                onDutyCount = onDutyCount + 1
            end
        end

        -- Set GlobalState for the job count
        GlobalState[jobName .. ':count'] = onDutyCount
    end
```
```lua
    function SetJob(identifier, jobName, grade)
        jobName = jobName:lower()
        grade = tonumber(grade) or 0

        local job = GetJob(jobName)

        if not job then
            lib.print.error(('cannot set job. Job %s does not exist'):format(jobName))

            return false
        end

        if not job.grades[grade] then
            lib.print.error(('cannot set job. Job %s does not have grade %s'):format(jobName, grade))

            return false
        end

        local player = type(identifier) == 'string' and (GetPlayerByCitizenId(identifier) or GetOfflinePlayer(identifier)) or GetPlayer(identifier)

        if setJobReplaces and player.PlayerData.job.name ~= 'unemployed' then
            local success, errorResult = RemovePlayerFromJob(player.PlayerData.citizenid, player.PlayerData.job.name)

            if not success then
                return false, errorResult
            end
        end

        if jobName ~= 'unemployed' then
            local success, errorResult = AddPlayerToJob(player.PlayerData.citizenid, jobName, grade)

            if not success then
                return false, errorResult
            end
        end
        local gradeString = job["grades"][tostring(grade)]
        TriggerEvent('summit_phone:server:hireinMultiJob', target, job, grade, job.label, gradeString.name)
        return SetPlayerPrimaryJob(player.PlayerData.citizenid, jobName)
    end
    exports('SetJob', SetJob)
```

``qbx_core/client/character.lua``
Around line 448 add a new line and add the following
```lua
TriggerEvent('phone:client:setupPhone', character.citizenid)
```

Find the function
``qbx_core/server/player.lua  -  GenerateUniqueIdentifier('PhoneNumber')``
Remove the line of code and add this line
```lua
playerData.charinfo.phone = playerData.charinfo.phone or exports['summit_phone']:GeneratePlayerPhoneNumber(playerData.citizenid)
```

In qbx_smallresources create a folder called qbx_logs then create a server.lua and add the following code;
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