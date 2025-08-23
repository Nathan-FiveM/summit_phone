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
  NUI.sendReactMessage('addNotification', {
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
RegisterNuiCallbackType('leaveGroupx');
RegisterNuiCallbackType('deleteGroup');
RegisterNuiCallbackType('getMemberList');
RegisterNuiCallbackType('removeGroupMember');
RegisterNuiCallbackType('getSetupAppData');
on('__cfx_nui:getPlayerData', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].getPlayerData()
  cb(res)
});
on('__cfx_nui:groups:createGroup', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].createGroup(data)
  cb(res)
});
on('__cfx_nui:getGroupData', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].getGroupData()
  cb(res)
});
on('__cfx_nui:getGroupJobSteps', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].getGroupJobSteps()
  cb(res)
});
on('__cfx_nui:getSetupAppData', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].getSetupAppData()
  cb(res)
});
on('__cfx_nui:joinGroup', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].joinGroup(data)
  cb(res)
});
on('__cfx_nui:leaveGroupx', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].leaveGroup(data)
  cb(res)
});
on('__cfx_nui:deleteGroup', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].deleteGroup()
  cb(res)
});
on('__cfx_nui:getMemberList', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].getMemberList()
  cb(res)
});
on('__cfx_nui:removeGroupMember', async (data: any, cb: Function) => {
  const res = await exports['summit_groups'].removeGroupMember(data)
  cb(res)
});

exports('SendCustomAppMessage', (event: string, data: any) => {
  NUI.sendReactMessage(event, data);
});