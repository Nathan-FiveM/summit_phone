import { FrameWork } from '@client/cl_main';
import { generateUUid } from "@shared/utils";
import { NUI } from "./classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";
import { CameraApp } from "./classes/Camera";
import { Utils } from "./classes/Utils";
RegisterNuiCallbackType('hideFrame');
on('__cfx_nui:hideFrame', () => {
  NUI.closeUI();
});

RegisterNuiCallbackType('disableControls');
on('__cfx_nui:disableControls', (data: boolean) => {
  NUI.disableControls = data;
  SetNuiFocusKeepInput(!data);
});

RegisterNuiCallbackType('actionNotiButtonOne');
on('__cfx_nui:actionNotiButtonOne', (data: {
  id: number;
  isServer: boolean;
  event: string;
  args: any;
}) => {
  data.isServer ? emitNet(data.event, data.id, data.args) : emit(data.event, data.id, data.args);
});
RegisterNuiCallbackType('actionNotiButtonTwo');
on('__cfx_nui:actionNotiButtonTwo', (data: {
  id: number;
  isServer: boolean;
  event: string;
  args: any;
}) => {
  data.isServer ? emitNet(data.event, data.id, data.args) : emit(data.event, data.id, data.args);
});

RegisterNuiCallbackType('showNoti');
on('__cfx_nui:showNoti', (data: {
  title: string,
  description: string,
  app: string,
}) => {
  const phoneItem = Utils.GetPhoneItem();
  if (!phoneItem) {
    emit("QBCore:Notify", "No phone item found", "error");
    return;
  };
  NUI.sendReactMessage('addNotiFication', {
    id: generateUUid(),
    title: data.title,
    description: data.description,
    app: data.app,
    timeout: 5000
  });
});

RegisterNuiCallbackType('updatePersonalCard');
on('__cfx_nui:updatePersonalCard', async (data: string, cb: Function) => {
  const res = await triggerServerCallback('phone:updatePersonalCard', 1, data);
  cb(res);
});

RegisterNuiCallbackType('phone:contextMenu:click');
on('__cfx_nui:phone:contextMenu:click', async (data: {
  name: string,
  event: string,
  isServer: boolean,
  args: string
}, cb: Function) => {
  data.isServer ? emitNet(data.event, data.args) : emit(data.event, data.args);
  cb('ok');
});

RegisterNuiCallbackType('phone:contextMenu:close');
on('__cfx_nui:phone:contextMenu:close', () => {
  NUI.sendReactMessage('phone:contextMenu:close', {});
});

RegisterNuiCallbackType('cameraAppOpen');
on('__cfx_nui:cameraAppOpen', (data: boolean) => {
  if (data) {
    CameraApp.openCameraApp();
  } else {
    CameraApp.closeCameraApp();
  }
});

// Register NUI callback to switch camera mode
RegisterNuiCallbackType('cameraMode');
on('__cfx_nui:cameraMode', (data: string) => {
  CameraApp.setCameraMode(data);
});

// Register NUI callback to toggle selfie mode
RegisterNuiCallbackType('selfiMode');
on('__cfx_nui:selfiMode', (data: boolean) => {
  CameraApp.toggleSelfieMode(data);
});

RegisterNuiCallbackType('getPlayerData');
RegisterNuiCallbackType('getGroupData');
RegisterNuiCallbackType('getGroupJobSteps');
RegisterNuiCallbackType('groups:createGroup');
RegisterNuiCallbackType('joinGroup');
RegisterNuiCallbackType('leaveGroup');
RegisterNuiCallbackType('deleteGroup');
RegisterNuiCallbackType('getMemberList');
RegisterNuiCallbackType('removeGroupMember');
RegisterNuiCallbackType('getSetupAppData');

on('__cfx_nui:getPlayerData', async (data: any, cb: Function) => {
  const res = await FrameWork.Functions.GetPlayerData()
  cb(res)
});
// === GROUP CREATION ===
on('__cfx_nui:groups:createGroup', async (data: { jobType?: string; pass?: string }, cb: Function) => {
  console.log("[PHONE DEBUG] groups:createGroup triggered", data);
  emitNet('ignis_groups:server:createGroup', data.jobType || 'generic', data.pass || null);
  cb(true);
});

// === JOIN GROUP ===
on('__cfx_nui:joinGroup', async (data: { groupId: string; pass?: string }, cb: Function) => {
  emitNet('ignis_groups:server:joinGroup', data.groupId, data.pass || null);
  cb(true);
});

// === LEAVE GROUP ===
on('__cfx_nui:leaveGroup', async (_data: any, cb: Function) => {
  emitNet('ignis_groups:server:leaveGroup');
  cb(true);
});

// === DELETE GROUP ===
on('__cfx_nui:deleteGroup', async (_data: any, cb: Function) => {
  emitNet('ignis_groups:server:deleteGroup');
  cb(true);
});
interface GroupSetupData {
  inGroup: boolean;
  groups: Record<string, any>;
  groupData: any;
  groupStages: any[];
}

// === GET SETUP DATA (initial load) ===
on('__cfx_nui:getSetupAppData', async (_data: any, cb: Function) => {
  console.log("[PHONE DEBUG] getSetupAppData requested from NUI");
  const groups = (await triggerServerCallback<GroupSetupData>(
    "ignis_groups:getSetupAppData",
    1
  )) as GroupSetupData;

  console.log("[PHONE DEBUG] getSetupAppData returned", groups);

  // ✅ Tell the React app that we are in a group
  if (groups.inGroup) {
    NUI.sendReactMessage("setInGroup", true);
    NUI.sendReactMessage("setCurrentGroup", groups.groupData);
    NUI.sendReactMessage("setGroups", groups.groups);
    NUI.sendReactMessage("setGroupJobSteps", groups.groupStages);
  } else {
    NUI.sendReactMessage("setInGroup", false);
  }

  cb(groups);
});

// === GET CURRENT GROUP DATA (client view refresh) ===
on('__cfx_nui:getGroupData', async (_data: any, cb: Function) => {
  const res = await triggerServerCallback('ignis_groups:getGroupData', 1);
  cb(res || {});
});

// === GET CURRENT JOB STEPS ===
on('__cfx_nui:getGroupJobSteps', async (_data: any, cb: Function) => {
  const res = await triggerServerCallback('ignis_groups:getGroupJobSteps', 1);
  cb(res || {});
});

// === GET MEMBER LIST ===
on('__cfx_nui:getMemberList', async (_data: any, cb: Function) => {
  const res = await triggerServerCallback('ignis_groups:getMemberList', 1);
  cb(res || []);
});

// === REMOVE MEMBER ===
on('__cfx_nui:removeGroupMember', async (data: { targetId: number }, cb: Function) => {
  emitNet('ignis_groups:server:removeGroupMember', data.targetId);
  cb(true);
});

exports('SendCustomAppMessage', (event: string, data: any) => {
  NUI.sendReactMessage(event, data);
});