import { Utils } from "@server/classes/Utils";
import { Framework, MongoDB, Logger } from "@server/sv_main";
import { Delay, generateUUid, LOGGER } from "@shared/utils";

onNet('summit_phone:server:fireEmployee', async (citizenId: string) => {
    const source = global.source;
    const targetData = await exports['qb-core'].GetPlayerByCitizenId(citizenId);
    if (targetData) {
        const jobname = targetData.PlayerData.job.name;
        await targetData.Functions.SetJob('unemployed', 0);
        await MongoDB.deleteOne('phone_multijobs', { citizenId: citizenId, jobName: jobname });
        emitNet('phone:addnotiFication', source, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `You have fired ${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname}`,
            app: "services",
            timeout: 5000,
        }));
        emitNet('phone:addnotiFication', targetData.PlayerData.source, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `You have been fired by ${global.source}`,
            app: "services",
            timeout: 5000,
        }));
        emitNet('summit_phone:client:refreshEmpData', source, jobname);
        Logger.AddLog({
            type: 'phone_employee_action',
            title: 'Employee Fired',
            message: `${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname} has been fired by ${await exports['qb-core'].GetPlayerName(source)} | CitizenId: ${targetData.PlayerData.citizenid} | Job: ${targetData.PlayerData.job.name}`,
            showIdentifiers: false
        });
    } else {
        const playerData: any = await Utils.query('SELECT job FROM players WHERE citizenid = ? LIMIT 1', [citizenId]);
        const jobData = JSON.parse(playerData[0].job);

        let job: any = {};
        job.name = 'unemployed'
        job.label = Framework.Shared.Jobs['unemployed'].label
        job.payment = Framework.Shared.Jobs['unemployed'].grades['0'].payment
        job.onduty = Framework.Shared.Jobs['unemployed'].defaultDuty
        job.isboss = false
        job.grade = {}
        job.grade.name = Framework.Shared.Jobs['unemployed'].grades['0'].name
        job.grade.level = 0
        await Utils.query('UPDATE players SET job = ? WHERE citizenid = ?', [JSON.stringify(job), citizenId]);
        await MongoDB.deleteOne('phone_multijobs', { citizenId: citizenId, jobName: jobData.name });
        emitNet('summit_phone:client:refreshEmpData', source, jobData.name);
        Logger.AddLog({
            type: 'phone_employee_action',
            title: 'Offline Employee Fired',
            message: `Offline employee ${citizenId} has been fired by ${await exports['qb-core'].GetPlayerName(source)} | Job: ${jobData.name}`,
            showIdentifiers: false
        });
    }
});

onNet('summit_phone:server:changeRankOfPlayer', async (data: any) => {
    const source = global.source;
    const targetData = await exports['qb-core'].GetPlayerByCitizenId(data.targetCitizenid);
    const multiJob = await MongoDB.findOne('phone_multijobs', { citizenId: data.targetCitizenid, jobName: data.jobName });
    if (targetData) {
        const jobname = data.jobName;
        targetData.Functions.SetJob(jobname, data.key);
        emitNet('phone:addnotiFication', source, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `You have changed the rank of ${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname}`,
            app: "services",
            timeout: 5000,
        }));
        emitNet('phone:addnotiFication', targetData.PlayerData.source, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `Your rank has been changed by ${await exports['qb-core'].GetPlayerName(source)}`,
            app: "services",
            timeout: 5000,
        }));
        emitNet('summit_phone:client:refreshEmpData', source, jobname);
        Logger.AddLog({
            type: 'phone_employee_action',
            title: 'Rank Changed',
            message: `${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname} has been given a new rank by ${await exports['qb-core'].GetPlayerName(source)} | CitizenId: ${targetData.PlayerData.citizenid} | Job: ${jobname} |  New Rank: ${data.gradeName}`,
            showIdentifiers: false
        });
    } else {
        const playerData: any = await Utils.query('SELECT job FROM players WHERE citizenid = ? LIMIT 1', [data.targetCitizenid]);
        const jobData = JSON.parse(playerData[0].job);
        jobData.grade.level = data.key;
        jobData.grade.name = data.gradeName;
        await Utils.query('UPDATE players SET job = ? WHERE citizenid = ?', [JSON.stringify(jobData), data.targetCitizenid]);
        if (multiJob) {
            await MongoDB.updateOne('phone_multijobs', { citizenId: data.targetCitizenid, jobName: data.jobName }, { gradeLevel: data.key, gradeLabel: data.gradeName });
            Logger.AddLog({
                type: 'phone_multi_job',
                title: 'Multi-Job Updated',
                message: `${data.targetCitizenid} has been updated to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports['qb-core'].GetPlayerName(source)} | citizenId: ${exports['qb-core'].GetPlayerCitizenIdBySource(source)}`,
                showIdentifiers: false
            });
        } else {
            await MongoDB.insertOne('phone_multijobs', { _id: generateUUid(), citizenId: data.targetCitizenid, jobName: data.jobName, gradeLevel: data.key, gradeLabel: data.gradeName });
            Logger.AddLog({
                type: 'phone_multi_job',
                title: 'Multi-Job Added',
                message: `${data.targetCitizenid} has been added to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports['qb-core'].GetPlayerName(source)} | citizenId: ${exports['qb-core'].GetPlayerCitizenIdBySource(source)}`,
                showIdentifiers: false
            });
        }
        emitNet('summit_phone:client:refreshEmpData', source, jobData.name);
    }
});

onNet('summit_phone:server:fireInactiveEmployee', async (data: { jobName: string, citizenId: string }) => {
    const source = global.source;
    await MongoDB.deleteOne('phone_multijobs', { citizenId: data.citizenId, jobName: data.jobName });
    emitNet('phone:addnotiFication', source, JSON.stringify({
        id: generateUUid(),
        title: "System",
        description: `You have fired an inactive employee`,
        app: "services",
        timeout: 5000,
    }));
    emitNet('summit_phone:client:refreshEmpData', source, data.jobName);
    Logger.AddLog({
        type: 'phone_employee_action',
        title: 'Inactive Employee Fired',
        message: `Inactive employee ${data.citizenId} has been fired by ${await exports['qb-core'].GetPlayerName(source)} | Job: ${data.jobName}`,
        showIdentifiers: false
    });
});

on('summit_phone:server:hireinMultiJob', async (client: string, jobname: string, gradeLevel: number, jobLabel: string, gradeLabel: string) => {
    const targetCid = await exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const multiJobCheck = await MongoDB.findOne('phone_multijobs', { citizenId: targetCid, jobName: jobname });
    if (multiJobCheck) {
        if (multiJobCheck.gradeLevel !== gradeLevel) {
            await MongoDB.updateOne('phone_multijobs', { citizenId: targetCid, jobName: jobname }, { gradeLevel, gradeLabel });
            Logger.AddLog({
                type: 'phone_multi_job',
                title: 'Multi-Job Updated',
                message: `${targetCid} has been updated to ${jobname} | New Rank: ${gradeLabel} by ${await exports['qb-core'].GetPlayerName(client)} | citizenId: ${exports['qb-core'].GetPlayerCitizenIdBySource(client)}`,
                showIdentifiers: false
            });
        } else {
            return emitNet('QBCore:Notify', client, 'You are already in this job with this grade level', 'error');
        }
    } else {
        await MongoDB.insertOne('phone_multijobs', { _id: generateUUid(), citizenId: targetCid, jobName: jobname, gradeLevel, jobLabel, gradeLabel });
        Logger.AddLog({
            type: 'phone_multi_job',
            title: 'Multi-Job Added',
            message: `${targetCid} has been added to ${jobname} | New Rank: ${gradeLabel} by ${await exports['qb-core'].GetPlayerName(client)} | citizenId: ${exports['qb-core'].GetPlayerCitizenIdBySource(client)}`,
            showIdentifiers: false
        });
    }
})

setImmediate(async () => {
    let isDBConnected = exports['mongoDB'].isDBConnected();
    while (isDBConnected === false) {
        await Delay(1000);
        isDBConnected = exports['mongoDB'].isDBConnected();
        if (isDBConnected) {
            LOGGER("[Settings] MongoDB connected.");
            break;
        }
    }
    const jobArray: any = {};
    const jobData = await MongoDB.findMany('summit_jobs', {});
    jobData.forEach(async (job: any) => {
        const { _id, ...rest } = job;
        LOGGER(`[SUMMIT_PHONE] Created job ${_id} Successfully`);
        jobArray[_id] = rest;
    });
    const [updated, message] = exports['qb-core'].AddJobs(jobArray);
}); 