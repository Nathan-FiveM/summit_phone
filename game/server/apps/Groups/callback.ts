import { onClientCallback, triggerClientCallback } from "@overextended/ox_lib/server";
import { Framework, MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

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
    if (!jobName || !grade) return false;
    const sourcePlayer = await exports['qb-core'].GetPlayer(source);
    if (!sourcePlayer) return false;
    if (await exports.summit_lib.CheckJobGrade(String(jobName), String(grade))) {
        sourcePlayer.Functions.SetJob(String(jobName), String(grade));
        await triggerClientCallback('QBCore:Notify', source, `Job Changed to ${jobName} Successfully`, 'success');
        const res = await triggerClientCallback('groups:toggleDuty', source);
        return true
    } else {
        const res = await MongoDB.deleteOne('phone_multijobs', { citizenId: sourcePlayer.PlayerData.citizenid, jobName });
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

// State
const Players: { [key: number]: boolean } = {};
const EmploymentGroup: { [key: number]: EmploymentGroup } = {};

// Export handler
function exportHandler(exportName: string, func: (...args: any[]) => any): void {
    on(`__cfx_export_qb-phone_${exportName}`, (setCB: (cb: (...args: any[]) => any) => void) => setCB(func));
    on(`__cfx_export_summit_groups_${exportName}`, (setCB: (cb: (...args: any[]) => any) => void) => setCB(func));
}

// Utility functions
function getPlayerCharName(src: number): string {
    const player = Framework.Functions.GetPlayer(src) as PlayerData;
    return `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname}`;
}

async function notifyGroup(group: number, msg: string, type: string) {
    if (!group || !EmploymentGroup[group]) return;
    for (const member of EmploymentGroup[group].members) {
        await triggerClientCallback('QBCore:Notify', member.Player, msg, type);
    }
}
exports('NotifyGroup', notifyGroup);
exportHandler('NotifyGroup', notifyGroup);

function pNotifyGroup(group: number, header: string, msg: string, icon?: string, colour?: string, length?: number): void {
    if (!group || !EmploymentGroup[group]) return;
    for (const member of EmploymentGroup[group].members) {
        emitNet('phone:addnotiFication', member.Player, JSON.stringify({
            id: generateUUid(),
            title: header || 'Missing Title',
            description: msg || 'Empty msg',
            app: 'settings',
            timeout: 5000
        }));
    }
}
exports('pNotifyGroup', pNotifyGroup);
exportHandler('pNotifyGroup', pNotifyGroup);

async function createBlipForGroup(groupID: number, name: string, data: any) {
    if (!groupID) return;
    for (const member of EmploymentGroup[groupID].members) {
        await triggerClientCallback('groups:createBlip', member.Player, name, data);
    }
}
exports('CreateBlipForGroup', createBlipForGroup);
exportHandler('CreateBlipForGroup', createBlipForGroup);

async function removeBlipForGroup(groupID: number, name: string) {
    if (!groupID) return;
    for (const member of EmploymentGroup[groupID].members) {
        await triggerClientCallback('groups:removeBlip', member.Player, name);
    }
}
exports('RemoveBlipForGroup', removeBlipForGroup);
exportHandler('RemoveBlipForGroup', removeBlipForGroup);

// Group functions
function getGroupByMembers(src: number): number | undefined {
    if (!Players[src]) return undefined;
    for (const [group, _] of Object.entries(EmploymentGroup)) {
        for (const member of EmploymentGroup[+group].members) {
            if (member.Player === src) return +group;
        }
    }
    return undefined;
}
exports('GetGroupByMembers', getGroupByMembers);
exportHandler('GetGroupByMembers', getGroupByMembers);

function getGroupMembers(groupID: number): number[] | undefined {
    if (!groupID) return;
    return EmploymentGroup[groupID].members.map((m) => m.Player);
}
exports('getGroupMembers', getGroupMembers);
exportHandler('getGroupMembers', getGroupMembers);

function getGroupSize(groupID: number): number | undefined {
    if (!groupID || !EmploymentGroup[groupID]) return;
    return EmploymentGroup[groupID].members.length;
}
exports('getGroupSize', getGroupSize);
exportHandler('getGroupSize', getGroupSize);

function getGroupLeader(groupID: number): number | undefined {
    if (!groupID) return;
    return EmploymentGroup[groupID].leader;
}
exports('GetGroupLeader', getGroupLeader);
exportHandler('GetGroupLeader', getGroupLeader);

async function groupEvent(groupID: number, event: string, args?: any[]) {
    if (!groupID || !event) return;
    const members = getGroupMembers(groupID);
    if (members && members.length > 0) {
        for (const member of members) {
            if (args) await triggerClientCallback(event, member, ...args);
            else await triggerClientCallback(event, member);
        }
    }
}
exports('GroupEvent', groupEvent);
exportHandler('GroupEvent', groupEvent);

async function destroyGroup(groupID: number) {
    if (!EmploymentGroup[groupID]) return;
    const members = getGroupMembers(groupID);
    if (members && members.length > 0) {
        for (const member of members) {
            await triggerClientCallback('summit_groups:client:UpdateGroupId', member, 0);
            Players[member] = false;
        }
    }
    resetJobStatus(groupID);
    emit('summit_groups:server:GroupDeleted', groupID, members);
    emit('qb-phone:server:GroupDeleted', groupID, members);
    delete EmploymentGroup[groupID];
    await triggerClientCallback('summit_groups:client:RefreshGroupsApp', -1, EmploymentGroup);
}
exports('DestroyGroup', destroyGroup);
exportHandler('DestroyGroup', destroyGroup);

async function removePlayerFromGroup(src: number, groupID: number) {
    if (!Players[src] || !EmploymentGroup[groupID]) return;
    const group = EmploymentGroup[groupID];
    for (let i = 0; i < group.members.length; i++) {
        if (group.members[i].Player === src) {
            const member = group.members.splice(i, 1)[0];
            group.Users -= 1;
            Players[src] = false;
            await triggerClientCallback('summit_groups:client:UpdateGroupId', src, 0);
            pNotifyGroup(groupID, 'Job Center', `${member.name} Has left the group`, 'fas fa-users', '#FFBF00', 7500);
            await triggerClientCallback('summit_groups:client:RefreshGroupsApp', -1, EmploymentGroup);
            await triggerClientCallback('QBCore:Notify', src, 'You have left the group', 'primary');
            if (group.Users <= 0) destroyGroup(groupID);
            return;
        }
    }
}

async function changeGroupLeader(groupID: number) {
    const group = EmploymentGroup[groupID];
    const leader = getGroupLeader(groupID);
    if (group.members.length > 1) {
        for (const member of group.members) {
            if (member.Player !== leader) {
                group.leader = member.Player;
                return true;
            }
        }
    }
    return false;
}

async function isGroupLeader(src: number, groupID: number) {
    if (!groupID) return false;
    return getGroupLeader(groupID) === src;
}
exports('isGroupLeader', isGroupLeader);
exportHandler('isGroupLeader', isGroupLeader);

// Job functions
async function setJobStatus(groupID: number, status: string, stages: any[]) {
    if (!groupID) return;
    const group = EmploymentGroup[groupID];
    group.status = status;
    group.stage = stages;
    const members = getGroupMembers(groupID);
    if (!members) return;
    for (const member of members) {
        await triggerClientCallback('summit_groups:client:AddGroupStage', member, status, stages);
    }
}
exports('setJobStatus', setJobStatus);
exportHandler('setJobStatus', setJobStatus);

async function getJobStatus(groupID: number) {
    if (!groupID) return;
    return EmploymentGroup[groupID].status;
}
exports('getJobStatus', getJobStatus);
exportHandler('getJobStatus', getJobStatus);

async function resetJobStatus(groupID: number) {
    if (!groupID) return;
    const group = EmploymentGroup[groupID];
    group.status = 'WAITING';
    group.stage = [];
    const members = getGroupMembers(groupID);
    if (!members) return;
    for (const member of members) {
        await triggerClientCallback('summit_groups:client:AddGroupStage', member, group.status, group.stage);
        await triggerClientCallback('summit_groups:client:RefreshGroupsApp', member, EmploymentGroup, true);
    }
}
exports('resetJobStatus', resetJobStatus);
exportHandler('resetJobStatus', resetJobStatus);

// Event handlers
on('playerDropped', async () => {
    const src = source as number;
    const groupID = getGroupByMembers(src);
    if (groupID) {
        if (await isGroupLeader(src, groupID)) {
            if (await changeGroupLeader(groupID)) await triggerClientCallback('summit_groups:client:RefreshGroupsApp', -1, EmploymentGroup);
            else destroyGroup(groupID);
        } else removePlayerFromGroup(src, groupID);
    }
});

onClientCallback('summit_groups:server:employment_checkJobStauts', async () => {
    const src = source as number;
    const checkStatus = getGroupByMembers(src);
    if (checkStatus) await triggerClientCallback('summit_groups:client:showEmploymentPage', src);
    else await triggerClientCallback('summit_groups:client:showEmploymentGroupPage', src);
});

onClientCallback('summit_groups:server:jobcenter_CreateJobGroup', async (source, data: { name: string; pass: string; logo?: string }) => {
    const src = source as number;

    const player = await exports['qb-core'].GetPlayer(src);
    if (Players[src]) {
        emitNet('phone:addnotiFication', src, JSON.stringify({
            id: generateUUid(),
            title: 'Already Created',
            description: `You have already created a group.`,
            app: 'settings',
            timeout: 5000
        }));
        return false;
    }
    if (!data || !data.pass || !data.name) return false;
    Players[src] = true;
    const ID = Object.keys(EmploymentGroup).length + 1;
    EmploymentGroup[ID] = {
        id: ID,
        status: 'WAITING',
        GName: data.name,
        GPass: data.pass,
        GLogo: data.logo || '',
        Users: 1,
        leader: src,
        members: [{ name: getPlayerCharName(src), CID: player.PlayerData.citizenid, Player: src }],
        stage: [],
    };
    await triggerClientCallback('summit_groups:client:RefreshGroupsApp', -1, EmploymentGroup);
    await triggerClientCallback('summit_groups:client:UpdateGroupId', src, ID);
    return true;
});

onClientCallback('summit_groups:server:jobcenter_DeleteGroup', (source, data) => {
    const src = source as number;
    if (!Players[src]) return;
    if (getGroupLeader(Number(data)) === src) destroyGroup(Number(data));
    else removePlayerFromGroup(src, Number(data));
});

onClientCallback('summit_groups:server:jobcenter_JoinTheGroup', async (source, data: { id: number }) => {
    const src = source as number;
    const player = await Framework.Functions.GetPlayer(src) as PlayerData;
    if (Players[src]) {
        emitNet('phone:addnotiFication', src, JSON.stringify({
            id: generateUUid(),
            title: 'Already Joined',
            description: `You have already joined a group.`,
            app: 'settings',
            timeout: 5000
        }));
        return;
    }
    const name = getPlayerCharName(src);
    pNotifyGroup(data.id, 'Job Center', `${name} Has join the group`, 'fas fa-users', '#FFBF00', 7500);
    EmploymentGroup[data.id].members.push({ name, CID: player.PlayerData.citizenid, Player: src });
    EmploymentGroup[data.id].Users += 1;
    Players[src] = true;
    await triggerClientCallback('summit_groups:client:UpdateGroupId', src, data.id);
    emitNet('phone:addnotiFication', src, JSON.stringify({
        id: generateUUid(),
        title: 'Joined Group',
        description: `You have joined the group.`,
        app: 'settings',
        timeout: 5000
    }));
    await triggerClientCallback('summit_groups:client:RefreshGroupsApp', -1, EmploymentGroup);
});

function getGroupStages(groupID: number): any[] | undefined {
    if (!groupID) return;
    return EmploymentGroup[groupID].stage;
}
exports('GetGroupStages', getGroupStages);
exportHandler('GetGroupStages', getGroupStages);

onClientCallback('summit_groups:server:getAllGroups', async (src) => {
    const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(src);
    if (Players[src]) {
        return JSON.stringify({
            data: EmploymentGroup,
            citizenId,
            src
        });
    }
    return JSON.stringify({
        data: EmploymentGroup,
        citizenId,
        src
    });
});

onClientCallback('summit_groups:server:jobcenter_CheckPlayerNames', (_src, csn: number) => {
    const names: string[] = EmploymentGroup[csn].members.map((m) => m.name);
    return names;
});

onClientCallback('summit_groups:server:jobcenter_leave_grouped', async (source, data: { id: number }) => {
    const src = source as number;
    if (!Players[src]) return;
    removePlayerFromGroup(src, data.id);
    await triggerClientCallback('summit_groups:client:RefreshGroupsApp', -1, EmploymentGroup);
});

async function isGroupTemp(groupID: number) {
    if (!groupID || !EmploymentGroup[groupID]) return;
    return EmploymentGroup[groupID].ScriptCreated || false;
}
exports('isGroupTemp', isGroupTemp);
exportHandler('isGroupTemp', isGroupTemp);

async function createGroup(src: number, name: string, password?: string) {
    if (!src || !name) return;
    const player = await Framework.Functions.GetPlayer(src) as PlayerData;
    Players[src] = true;
    const id = Object.keys(EmploymentGroup).length + 1;
    EmploymentGroup[id] = {
        id,
        status: 'WAITING',
        GName: name,
        GPass: password || Framework.Shared.RandomInt(7),
        GLogo: '',
        Users: 1,
        leader: src,
        members: [{ name: getPlayerCharName(src), CID: player.PlayerData.citizenid, Player: src }],
        stage: [],
        ScriptCreated: true,
    };
    await triggerClientCallback('summit_groups:client:UpdateGroupId', src, id);
    await triggerClientCallback('summit_groups:client:RefreshGroupsApp', -1, EmploymentGroup);
    return id;
}
exports('CreateGroup', createGroup);
exportHandler('CreateGroup', createGroup);

onClientCallback('summit_groups:server:getStageFromApp', async () => {
    const src = source as number;
    const player = await Framework.Functions.GetPlayer(src);
    if (!player) return;
    const group = getGroupByMembers(src);
    if (!group) return;
    const stages = getGroupStages(group);
    await triggerClientCallback('summit_groups:client:GetGroupsStatus', src, stages);
});