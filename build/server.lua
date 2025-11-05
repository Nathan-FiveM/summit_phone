local QBCore = exports['qb-core']:GetCoreObject()

RegisterNetEvent('ignis_phone:sendNewMail', function(source, mailData)
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return end
    local citizenId = Player.PlayerData.citizenid
    local emailAddress = exports['summit_phone']:GetEmailIdByCitizenId(citizenId)

    if emailAddress then
        exports['summit_phone']:SendMail({
            email = mailData.email or 'government@summit.rp',
            to = emailAddress,
            subject = mailData.subject or 'Email is not setup correctly!',
            message = mailData.message or 'Email is not setup correctly!',
            images = mailData.images or {},
            source = source
        })
    end
end)

function setnewjob(source, target, job, grade)
    local Player = QBCore.Functions.GetPlayer(tonumber(target))
    if Player then
        local jobInfo = QBCore.Shared.Jobs[job]
        if jobInfo then
            Player.Functions.SetJob(job, grade)
            local gradeString = jobInfo["grades"][tostring(grade)]
            TriggerEvent('summit_phone:server:hireinMultiJob', target, job, grade, jobInfo.label, gradeString.name)
        else
            TriggerClientEvent('QBCore:Notify', source, "Not a valid job", 'error')
        end
    else
        TriggerClientEvent('QBCore:Notify', source, 'Player not online', 'error')
    end
end
lib.addCommand('setphonejob', {
    help = 'Set Player Job (Admin Only)',
    restricted = 'qbcore.mod',
    params = {
        {
            name = 'target',
            type = 'playerId',
            help = 'Player ID',
            optional = false
        },
        {
            name = 'job',
            type = 'text',
            help = 'Job name',
            optional = false
        },
        {
            name = 'grade',
            type = 'number',
            help = 'Job grade',
            optional = false
        }
    },
}, function(source, args, raw)
    print('[DEBUG] Set New Job Command Used by ' .. source .. ' with args: ' .. json.encode(args))
    setnewjob(source, args.target, args.job, args.grade)
end)
