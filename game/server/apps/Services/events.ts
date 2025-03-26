import { Utils } from "@server/classes/Utils";
import { Framework, MongoDB } from "@server/sv_main";
import { generateUUid, LOGGER } from "@shared/utils";

onNet('summit_phone:server:fireEmployee', async (citizenId: string) => {
    const source = global.source;
    const targetData = await exports['qb-core'].GetPlayerByCitizenId(citizenId);
    if (targetData) {
        const jobname = targetData.PlayerData.job.name;
        await targetData.Functions.SetJob('unemployed', 1);
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
    }
});

onNet('summit_phone:server:changeRankOfPlayer', async (data: any) => {
    const source = global.source;
    const targetData = await exports['qb-core'].GetPlayerByCitizenId(data.targetCitizenid);
    const multiJob = await MongoDB.findOne('phone_multijobs', { citizenId: data.targetCitizenid, jobName: data.jobName });
    if (targetData) {
        const jobname = data.jobName;
        targetData.Functions.SetJob(jobname, data.key);
        if (multiJob) {
            await MongoDB.updateOne('phone_multijobs', { citizenId: data.targetCitizenid, jobName: data.jobName }, { gradeLevel: data.key });
        } else {
            await MongoDB.insertOne('phone_multijobs', { _id: generateUUid(), citizenId: data.targetCitizenid, jobName: data.jobName, gradeLevel: data.key });
        }
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
    } else {
        const playerData: any = await Utils.query('SELECT job FROM players WHERE citizenid = ? LIMIT 1', [data.targetCitizenid]);
        const jobData = JSON.parse(playerData[0].job);
        jobData.grade.level = data.key;
        jobData.grade.name = data.gradeName;
        await Utils.query('UPDATE players SET job = ? WHERE citizenid = ?', [JSON.stringify(jobData), data.targetCitizenid]);
        if (multiJob) {
            await MongoDB.updateOne('phone_multijobs', { citizenId: data.targetCitizenid, jobName: data.jobName }, { gradeLevel: data.key });
        } else {
            await MongoDB.insertOne('phone_multijobs', { _id: generateUUid(), citizenId: data.targetCitizenid, jobName: data.jobName, gradeLevel: data.key });
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
});

on('summit_phone:server:hireinMultiJob', async (client: string, jobname: string, gradeLevel: number, jobLabel: string, gradeLabel: string) => {
    const targetCid = await exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const multiJobCheck = await MongoDB.findOne('phone_multijobs', { citizenId: targetCid, jobName: jobname });
    if (multiJobCheck) {
        if (multiJobCheck.gradeLevel !== gradeLevel) {
            await MongoDB.updateOne('phone_multijobs', { citizenId: targetCid, jobName: jobname }, { gradeLevel, gradeLabel });
        } else {
            return emitNet('QBCore:Notify', client, 'You are already in this job with this grade level', 'error');
        }
    } else {
        await MongoDB.insertOne('phone_multijobs', { _id: generateUUid(), citizenId: targetCid, jobName: jobname, gradeLevel, jobLabel, gradeLabel });
    }
})

setImmediate(async () => {
    const jobArray: any = {};
    const jobData = await MongoDB.findMany('summit_jobs', {});
    jobData.forEach(async (job: any) => {
        const { _id, ...rest } = job;
        LOGGER(`[SUMMIT_PHONE] Created job ${_id} Successfully`);
        jobArray[_id] = rest;
    });
    const [updated, message] = exports['qb-core'].AddJobs(jobArray);
});