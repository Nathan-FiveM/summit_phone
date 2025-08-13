import { NUI } from "@client/classes/NUI";
import { onServerCallback, triggerServerCallback } from "@overextended/ox_lib/client";
import { generateUUid } from "@shared/utils";

onNet('groups:toggleDuty', async () => {
    emitNet('QBCore:ToggleDuty');
});

/* // Interfaces
interface BlipData {
    name: string;
    blip: number;
}

interface CreateBlipData {
    entity?: number;
    netId?: number;
    radius?: number;
    coords?: { x: number; y: number; z: number };
    color?: number;
    alpha?: number;
    sprite?: number;
    scale?: number;
    label?: string;
    route?: boolean;
    routeColor?: number;
}
// State variables
let isGroupLeader: boolean = false;
let inJob: boolean = false;
let GroupID: number = 0;
let GroupBlips: BlipData[] = [];
const appIdentifier: string = 'summit_groups';

// Utility function to simulate Lua's export handler
function exportHandler(exportName: string, func: (...args: any[]) => any): void {
    on(`__cfx_export_qb-phone_${exportName}`, (setCB: (cb: (...args: any[]) => any) => void) => setCB(func));
}

// Blip management
function findBlipByName(name: string): number | undefined {
    return GroupBlips.findIndex((blip) => blip?.name === name);
}

onNet('groups:removeBlip', (name: string) => {
    const index = findBlipByName(name);
    if (index !== undefined && GroupBlips[index]) {
        const blip = GroupBlips[index].blip;
        SetBlipRoute(blip, false);
        RemoveBlip(blip);
        GroupBlips[index] = undefined as any; // TypeScript workaround
    }
    return true;
});

onServerCallback('groups:phoneNotification', (data: { title: string; text: string }) => {
    exports['lb-phone'].SendNotification({
        app: appIdentifier,
        title: data.title,
        content: data.text,
    });
    return true;
});

onNet('groups:createBlip', (name: string, data: CreateBlipData) => {
    if (!data) {
        console.log('Invalid Data was passed to the create blip event');
        return;
    }
    const existingIndex = findBlipByName(name);
    if (existingIndex !== undefined) emit('groups:removeBlip', name);

    let blip: number;
    if (data.entity) blip = AddBlipForEntity(data.entity);
    else if (data.netId) blip = AddBlipForEntity(NetworkGetEntityFromNetworkId(data.netId));
    else if (data.radius) blip = AddBlipForRadius(data.coords!.x, data.coords!.y, data.coords!.z, data.radius);
    else blip = AddBlipForCoord(data.coords!.x, data.coords!.y, data.coords!.z);

    const color = data.color ?? 1;
    const alpha = data.alpha ?? 255;
    if (!data.radius) {
        const sprite = data.sprite ?? 1;
        const scale = data.scale ?? 0.7;
        const label = data.label ?? 'NO LABEL FOUND';
        SetBlipSprite(blip, sprite);
        SetBlipScale(blip, scale);
        BeginTextCommandSetBlipName('STRING');
        AddTextComponentSubstringPlayerName(label);
        EndTextCommandSetBlipName(blip);
    }
    SetBlipColour(blip, color);
    SetBlipAlpha(blip, alpha);
    if (data.route) {
        SetBlipRoute(blip, true);
        SetBlipRouteColour(blip, data.routeColor!);
    }
    GroupBlips.push({ name, blip });
    return true;
});

RegisterNuiCallback('GetGroupsApp', async (_data: any, cb: Function) => {
    if (LocalPlayer.state.isLoggedIn) {
        const getGroups = await triggerServerCallback('summit_groups:server:getAllGroups', 1);
        cb(getGroups);
    }
});

onNet('summit_groups:client:RefreshGroupsApp', (groups: any, finish: boolean) => {
    if (finish) inJob = false;
    if (inJob) return true;
    NUI.sendReactMessage('groups:refreshApp', groups);
});

onNet('summit_groups:client:AddGroupStage', (_: any, stage: string) => {
    inJob = true;
    NUI.sendReactMessage('groups:addGroupStage', stage);
});

onNet('summit_groups:client:GetGroupsStatus', (stage: string) => {
    NUI.sendReactMessage('groups:addStatusPage', stage);
});

RegisterNuiCallback('getStatusPage', async (_data: any, cb: Function) => {
    await triggerServerCallback('summit_groups:server:getStageFromApp', null);
    cb('ok');
});

onNet('summit_groups:client:UpdateGroupId', (id: number) => {
    GroupID = id;
    if (id === 0) {
        isGroupLeader = false;
    }
});

RegisterNuiCallback('groups:CreateJobGroup', async (data: any, cb: Function) => {
    await triggerServerCallback('summit_groups:server:jobcenter_CreateJobGroup', 1, data);
    isGroupLeader = true;
    cb('ok');
});

RegisterNuiCallback('jobcenter_JoinTheGroup', async (data: any, cb: Function) => {
    await triggerServerCallback('summit_groups:server:jobcenter_JoinTheGroup', 1, data);
    cb('ok');
});

RegisterNuiCallback('jobcenter_leave_grouped', async (data: any, cb: Function) => {
    if (!data) return;
    await triggerServerCallback('summit_groups:server:jobcenter_leave_grouped', 1, data);
    cb('ok');
});

RegisterNuiCallback('jobcenter_DeleteGroup', async (data: any, cb: Function) => {
    await triggerServerCallback('summit_groups:server:jobcenter_DeleteGroup', 1, data);
    cb('ok');
});

on('onResourceStart', (resource: string) => {
    if (resource !== GetCurrentResourceName()) return;
});

RegisterNuiCallback('jobcenter_CheckPlayerNames', async (data: { id: number }, cb: Function) => {
    const hasName = await triggerServerCallback('summit_groups:server:jobcenter_CheckPlayerNames', 1, data.id);
    cb(hasName);
});

RegisterNuiCallback('jobcenter_GroupBusy', (_data: any, cb: Function) => {
    NUI.sendReactMessage('addNotification', {
        id: generateUUid(),
        title: 'Busy Groups',
        description: 'The Group is busy!',
        app: 'settings',
        timeout: 5000
    });
    cb('ok');
});

// Exports
function IsGroupLeader(): boolean {
    return isGroupLeader;
}
exports('IsGroupLeader', IsGroupLeader);
exportHandler('IsGroupLeader', IsGroupLeader);

function GetGroupID(): number {
    return GroupID;
}
exports('GetGroupID', GetGroupID);
exportHandler('GetGroupID', GetGroupID); */