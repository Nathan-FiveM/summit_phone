import { onClientCallback, triggerClientCallback } from "@overextended/ox_lib/server";
import { MongoDB } from "@server/sv_main";

onClientCallback('groups:getmultiPleJobs', async (source: number) => {
    const sourcePlayer = exports['qb-core'].GetPlayer(source);
    const jobsData = await MongoDB.findMany('phone_multijobs', { citizenId: sourcePlayer.PlayerData.citizenid });
    const currentJob = sourcePlayer.PlayerData.job.name;
    return JSON.stringify({ currentJob, jobsData });
});

onClientCallback('groups:deleteMultiJob', async (source: number, data: string) => {
    const res = await MongoDB.deleteOne('phone_multijobs', { _id: data });
    return true;
});

onClientCallback('groups:changeJobOfPlayer', async (source: number, data: string) => {
    const { jobName, grade } = JSON.parse(data);
    const sourcePlayer = exports['qb-core'].GetPlayer(source);
    if (!sourcePlayer) return false;
    if (await exports.summit_lib.CheckJobGrade(String(jobName), String(grade))) {
        sourcePlayer.Functions.SetJob(String(jobName), String(grade));
        emitNet('QBCore:Notify', source, `Job Changed to ${jobName} Successfully`, 'success');
        const res = await triggerClientCallback('groups:toggleDuty', source);
        return true
    } else {
        console.log('Failed to change job of player');
        const res = await MongoDB.deleteOne('phone_multijobs', { citizenId: sourcePlayer.PlayerData.citizenid, jobName });
        return false;
    }
});