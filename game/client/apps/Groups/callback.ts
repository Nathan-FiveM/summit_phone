import { NUI } from "@client/classes/NUI";
import { onServerCallback, triggerServerCallback } from "@overextended/ox_lib/client";
import { generateUUid } from "@shared/utils";

onNet('groups:toggleDuty', async () => {
    emitNet('QBCore:ToggleDuty');
});

onNet('ignis_groups:client:setWaypoint', (coords: any) => {
    if (!coords) return;
    SetNewWaypoint(coords.x, coords.y);
});

// === GROUPS APP CALLBACKS ===

// Get available jobs
RegisterNuiCallback("groups:getAvailableJobs", async (_: any, cb: Function) => {
  const jobs = await triggerServerCallback("ignis_groups:server:getAvailableJobs", 1);
  cb(jobs || []);
});

// Set GPS waypoint to job location
RegisterNuiCallback("groups:setJobWaypoint", (data: any, cb: Function) => {
  emitNet("ignis_groups:server:setJobWaypoint", data);
  cb(true);
});

// Request job info (sends email)
RegisterNuiCallback("groups:requestJobInfo", (data: any, cb: Function) => {
  emitNet("ignis_groups:server:sendJobInfoEmail", data.jobId);
  cb(true);
});

// Create new group
RegisterNuiCallback("groups:createGroup", (data: { name?: string; pass?: string }, cb: Function) => {
  emitNet("ignis_groups:server:createGroup", data.name ?? "generic", data.pass ?? null);
  cb(true);
});

// Join existing group
RegisterNuiCallback("joinGroup", (data: { id: string; pass?: string }, cb: Function) => {
  emitNet("ignis_groups:server:joinGroup", data.id, data.pass ?? null);
  cb(true);
});

// Leave group
RegisterNuiCallback("leaveGroup", (_: any, cb: Function) => {
  emitNet("ignis_groups:server:leaveGroup");
  cb(true);
});

// Delete group
RegisterNuiCallback("deleteGroup", (_: any, cb: Function) => {
  emitNet("ignis_groups:server:deleteGroup");
  cb(true);
});

// === DISBAND GROUP ===
RegisterNuiCallback("disbandGroup", (_: any, cb: Function) => {
  emitNet("ignis_groups:server:disbandGroup");
  cb(true);
});

// Ready up for job
RegisterNuiCallback("readyForJob", (_: any, cb: Function) => {
  emitNet("ignis_groups:server:readyForJob");
  cb(true);
});

// Get player data for phone
RegisterNuiCallback("getPlayerData", async (_: any, cb: Function) => {
  const player = await triggerServerCallback("ignis_groups:server:getPlayerData", 1);
  cb(player || {});
});

// Initial app data for Groups
RegisterNuiCallback("getSetupAppData", async (_: any, cb: Function) => {
  const groups = await triggerServerCallback("ignis_groups:getSetupAppData", 1);
  cb(groups || {
    groups: {},
    groupData: {},
    inGroup: false,
    groupStages: {},
  });
});

onNet("summit_phone:client:updateGroupsApp", (action: string, data: any) => {
  console.log("[SUMMIT_PHONE] updateGroupsApp:", action, data);

  switch (action) {
    case "setInGroup":
      // ✅ tell React whether to show the group or job list
      NUI.sendReactMessage("updateGroupsApp", { action, data });
      break;

    case "setCurrentGroup":
      // ✅ update React with new current group data
      NUI.sendReactMessage("updateGroupsApp", { action, data });
      break;

    case "setGroups":
      // ✅ full group list update
      NUI.sendReactMessage("updateGroupsApp", { action, data });
      break;

    case "setGroupJobSteps":
      // ✅ progress / stage updates
      NUI.sendReactMessage("updateGroupsApp", { action, data });
      break;

    case "setPlayerJobState":
      // ✅ progress / stage updates
      NUI.sendReactMessage("setPlayerJobState", { action, data });
      break;

    case "updateStatus":
      // ✅ status changes (queued, active, idle)
      NUI.sendReactMessage("updateGroupsApp", {
        action: "setCurrentGroup",
        data,
      });
      break;

    default:
      console.warn(`[summit_phone] Unknown GroupsApp action: ${action}`);
      break;
  }
});

RegisterNuiCallback("leaveQueue", (_: any, cb: Function) => {
  emitNet("ignis_groups:server:leaveQueue");
  cb(true);
});

// When the Groups app opens, fetch latest group data
RegisterNuiCallback("getGroupsAppData", async (_: any, cb: Function) => {
  emitNet("ignis_groups:server:getSetupAppData");
  cb(true);
});

RegisterNuiCallback('sendPhoneNotification', (data: { app: string; title: string; description: string; timeout?: number }, cb: Function) => {
  NUI.sendReactMessage('addNotiFication', {
    id: generateUUid(),
    title: data.title,
    description: data.description,
    app: data.app || 'settings',
    timeout: data.timeout || 5000,
  });
  cb('ok');
});