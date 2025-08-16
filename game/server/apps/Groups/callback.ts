import { onClientCallback, triggerClientCallback } from "@overextended/ox_lib/server";
import { Framework, MongoDB, Logger } from "@server/sv_main";
import { Delay, generateUUid } from "@shared/utils";

onClientCallback('groups:getmultiPleJobs', async (source: number) => {
    const sourcePlayer = exports['qb-core'].GetPlayer(source);
    const jobsData = await MongoDB.findMany('phone_multijobs', { citizenId: sourcePlayer.PlayerData.citizenid });
    const currentJob = sourcePlayer.PlayerData.job.name;
    return JSON.stringify({ currentJob, jobsData });
});

onClientCallback('groups:deleteMultiJob', async (source: number, data: string) => {
    const name = await exports['qb-core'].GetPlayerName(source);
    const job = await MongoDB.findOne('phone_multijobs', { _id: data });
    const res = await MongoDB.deleteOne('phone_multijobs', { _id: data });
    Logger.AddLog({
        type: 'phone_multijobs',
        title: 'Job Deleted',
        message: `${name} deleted job ${job.jobName} (${job.citizenId})`,
        showIdentifiers: false
    });
    return true;
});

onClientCallback('groups:changeJobOfPlayer', async (source: number, data: string) => {
    const { jobName, grade } = JSON.parse(data);
    if (!jobName) return false;
    const sourcePlayer = await exports['qb-core'].GetPlayer(source);
    if (!sourcePlayer) return false;
    if (await exports.summit_lib.CheckJobGrade(jobName, String(grade))) {
        sourcePlayer.Functions.SetJob(jobName, String(grade));
        emitNet('QBCore:Notify', source, `Job Changed to ${jobName} Successfully`, 'success');
        emitNet('groups:toggleDuty', Number(sourcePlayer.PlayerData.source));
        Logger.AddLog({
            type: 'phone_multijobs',
            title: 'Job Changed',
            message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} changed job to '${jobName}' (Grade: ${grade}).`,
            showIdentifiers: false
        });
        return true
    } else {
        const res = await MongoDB.deleteOne('phone_multijobs', { citizenId: sourcePlayer.PlayerData.citizenid, jobName });
        Logger.AddLog({
            type: 'phone_multijobs',
            title: 'Invalid Job Removed',
            message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} attempted to change to invalid job '${jobName}', removed from multi-jobs.`,
            showIdentifiers: false
        });
        return false;
    }
});

// Interfaces
interface PlayerData {
    PlayerData: {
        charinfo: { firstname: string; lastname: string };
        citizenid: string;
        source: number;
    };
}

interface GroupMember {
    name: string;
    CID: string;
    Player: number;
}

interface EmploymentGroup {
    id: number;
    status: string;
    GName: string;
    GPass: string;
    GLogo: string;
    Users: number;
    leader: number;
    members: GroupMember[];
    stage: any[];
    ScriptCreated?: boolean;
}