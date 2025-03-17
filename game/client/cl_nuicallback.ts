import { generateUUid } from "@shared/utils";
import { NUI } from "./classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";
import { Animation } from "./classes/Animation";
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

let normalCam: number | null = null;    // Handle for the normal camera
let selfieCam: number | null = null;    // Handle for the selfie camera
let camOpen: boolean = false;           // Tracks if the camera app is active
let isSelfieMode: boolean = false;      // Tracks if selfie mode is active
let currentMode: string = "portrait";   // Default mode (portrait or landscape)
const speed_ud: number = 0.2;           // Rotation speed for up/down
const speed_lr: number = 0.2;           // Rotation speed for left/right

// Function to toggle the front-facing cell phone camera effect
function cellCamActivate(p0: boolean, p1: boolean): void {
    Citizen.invokeNative('0xFDE8F069C542D126', p0, p1); // _CELL_CAM_ACTIVATE
    if (p0 && p1) {
        CreateMobilePhone(0); // Create phone model
        Citizen.invokeNative('0x2491A93618B7D838', true); // _DISPLAY_RADAR
    } else {
        DestroyMobilePhone(); // Destroy phone model
        Citizen.invokeNative('0x2491A93618B7D838', false); // _DISPLAY_RADAR
    }
}

// Callback to open or close the camera app
RegisterNuiCallbackType('cameraAppOpen');
on('__cfx_nui:cameraAppOpen', (data: boolean) => {
    if (data) {
        const lPed: number = PlayerPedId();
        normalCam = CreateCam("DEFAULT_SCRIPTED_FLY_CAMERA", true);
        AttachCamToEntity(normalCam, lPed, 0.0, 0.7, 0.7, true); // Position in front of player
        const heading = GetEntityHeading(lPed);
        SetCamRot(normalCam, 0.0, 0.0, heading, 2); // Align with player's heading
        SetCamFov(normalCam, 70.0);                  // Default FOV for portrait
        RenderScriptCams(true, false, 0, true, false);
        SetCamActive(normalCam, true);
        camOpen = true;
        currentMode = "portrait";
        isSelfieMode = false;
    } else {
        if (selfieCam) {
            SetCamActive(selfieCam, false);
            DestroyCam(selfieCam, false);
            selfieCam = null;
        }
        if (normalCam) {
            SetCamActive(normalCam, false);
            DestroyCam(normalCam, false);
            normalCam = null;
        }
        RenderScriptCams(false, false, 0, true, false);
        cellCamActivate(false, false);
        camOpen = false;
        isSelfieMode = false;
    }
});

// Callback to switch camera mode (portrait/landscape) for normal camera
RegisterNuiCallbackType('cameraMode');
on('__cfx_nui:cameraMode', (data: string) => {
    if (normalCam && camOpen && !isSelfieMode) {
        if (data === "portrait") {
            SetCamFov(normalCam, 70.0);
            currentMode = "portrait";
        } else if (data === "landscape") {
            SetCamFov(normalCam, 110.0);
            currentMode = "landscape";
        }
    }
});

// Callback to toggle selfie mode with a separate camera
RegisterNuiCallbackType('selfiMode');
on('__cfx_nui:selfiMode', (data: boolean) => {
    if (!camOpen) return;

    const lPed = PlayerPedId();
    if (data && !isSelfieMode) {
        if (normalCam) {
            SetCamActive(normalCam, false);
        }
        selfieCam = CreateCam("DEFAULT_SCRIPTED_FLY_CAMERA", true);
        const playerPos = GetEntityCoords(lPed, true);
        const heading = GetEntityHeading(lPed);

        // Define and calculate camera offset
        const offset_x = 0.25;
        const offset_y = 0.8;
        const offset_z = 0.75;

        AttachCamToEntity(selfieCam, lPed, offset_x, offset_y, offset_z, true);
        SetCamRot(selfieCam, -10.0, 0.0, (heading + 150.0) % 360.0, 2);
        SetCamFov(selfieCam, 70.0);
        SetCamActive(selfieCam, true);
        RenderScriptCams(true, false, 0, true, false);
        cellCamActivate(true, true);
        isSelfieMode = true;
    } else if (!data && isSelfieMode) {
        if (selfieCam) {
            SetCamActive(selfieCam, false);
            DestroyCam(selfieCam, false);
            selfieCam = null;
        }
        if (normalCam) {
            SetCamActive(normalCam, true);
            RenderScriptCams(true, false, 0, true, false);
        }
        cellCamActivate(false, false);
        isSelfieMode = false;
    }
});

// Frame-by-frame camera control
setTick(() => {
    if (!camOpen) return;

    const lPed = PlayerPedId(); // Cache player ped ID
    const activeCam = isSelfieMode ? selfieCam : normalCam;
    if (!activeCam) return;

    const rightAxisX = GetControlNormal(0, 220); // Right stick X-axis
    const rightAxisY = GetControlNormal(0, 221); // Right stick Y-axis
    const rotation = GetCamRot(activeCam, 2);
    const faceCheck = CellCamIsCharVisibleNoFaceCheck(lPed);

    if (!isSelfieMode) {
        if (!faceCheck) {
            SetCamRot(activeCam, 0.0, 0.0, GetEntityHeading(lPed), 2);
        } else if (rightAxisX !== 0.0 || rightAxisY !== 0.0) {
            const newZ = rotation[2] + rightAxisX * -1.0 * speed_ud;
            const newX = Math.max(Math.min(50.0, rotation[0] + rightAxisY * -1.0 * speed_lr), -89.5);
            SetCamRot(activeCam, newX, 0.0, newZ, 2);
            SetEntityHeading(lPed, newZ);
        }
    }
});