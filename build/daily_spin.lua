---------------------------------------------------------------------
-- 🔵 NUI CALLBACKS
---------------------------------------------------------------------

-- Get full state when React app opens
RegisterNUICallback("dailySpin:getState", function(_, cb)
    RegisterNetEvent("dailySpin:returnState", function(data)
        cb(json.encode(data))
    end)

    TriggerServerEvent("dailySpin:getStateServer")
end)

-- Start cooldown
RegisterNUICallback("dailySpin:claim", function(_, cb)
    TriggerServerEvent("dailySpin:claimServer")
    cb("ok")
end)

-- Give reward → trigger QBCORE server event
RegisterNUICallback("dailySpin:reward", function(data, cb)
    if not data or not data.id then
        cb("error")
        return
    end
    TriggerServerEvent("dailySpin:rewardServer", data.id)
    cb("ok")
end)

-- Sell reward → QBCore money add
RegisterNUICallback("dailySpin:sell", function(data, cb)
    if not data or not data.id then
        cb("error")
        return
    end
    TriggerServerEvent("dailySpin:sellServer", data.id)
    cb("ok")
end)