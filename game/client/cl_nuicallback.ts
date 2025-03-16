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

// RegisterNuiCallbackType('selfiMode');
// on('__cfx_nui:selfiMode', (data: boolean) => {
//     console.log('selfiMode', data);
//     toggleFrontCamera(data);
// });

// RegisterNuiCallbackType('cameraAppOpen');
// on('__cfx_nui:cameraAppOpen', (data: boolean) => {
//   console.log('cameraAppOpen', data);
// });

// RegisterNuiCallbackType('cameraMode');
// on('__cfx_nui:cameraMode', (data: string) => {
//   console.log('cameraMode', data);

// });
// Global variables
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
  console.log(`Cell camera effect activated: ${p0}, ${p1}`);
  if (p0 && p1) {
    Animation.EndAnimation();
  } else {
    // Animation.StatAnimation('prop_aphone_blue');
  }
}

// Callback to open or close the camera app
RegisterNuiCallbackType('cameraAppOpen');
on('__cfx_nui:cameraAppOpen', (data: boolean) => {
  if (data) {
    // Open the camera in normal mode
    const lPed: number = PlayerPedId();
    normalCam = CreateCam("DEFAULT_SCRIPTED_FLY_CAMERA", true);
    AttachCamToEntity(normalCam, lPed, 0.0, 0.7, 0.7, true); // Position in front of player
    const heading = GetEntityHeading(lPed);
    SetCamRot(normalCam, 0.0, 0.0, heading, 2); // Align with player's heading
    SetCamFov(normalCam, 70.0);                              // Default FOV for portrait
    RenderScriptCams(true, false, 0, true, false);           // Start rendering
    SetCamActive(normalCam, true);                           // Activate normal camera
    camOpen = true;
    currentMode = "portrait";
    isSelfieMode = false;
  } else {
    // Close the camera app
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
    cellCamActivate(false, false); // Turn off phone effect
    camOpen = false;
    isSelfieMode = false;
  }
});

// Callback to switch camera mode (portrait/landscape) for normal camera
RegisterNuiCallbackType('cameraMode');
on('__cfx_nui:cameraMode', (data: string) => {
  if (normalCam && camOpen && !isSelfieMode) { // Only in normal mode
    if (data === "portrait") {
      SetCamFov(normalCam, 70.0);  // Narrower FOV
      currentMode = "portrait";
    } else if (data === "landscape") {
      SetCamFov(normalCam, 110.0); // Wider FOV
      currentMode = "landscape";
    }
    console.log(`Switched normal camera to ${currentMode}`);
  }
});

// Callback to toggle selfie mode with a separate camera
RegisterNuiCallbackType('selfiMode');
on('__cfx_nui:selfiMode', (data: boolean) => {
  if (camOpen) {
    const lPed = PlayerPedId(); // Get the local player ped
    if (data && !isSelfieMode) {
      // Enter selfie mode: Create a new selfie camera with adjusted position
      if (normalCam) {
        SetCamActive(normalCam, false); // Deactivate normal camera
      }
      selfieCam = CreateCam("DEFAULT_SCRIPTED_FLY_CAMERA", true);

      // Get hand bone and positions
      const playerPos = GetEntityCoords(lPed, true);

      // Calculate forward vector based on player's heading
      const heading = GetEntityHeading(lPed);

      // Define desired camera position: 1.5 meters in front, at hand height + 0.2m
      const desiredPos_x = playerPos[0] + 0.25; // Adjusted for better alignment
      const desiredPos_y = playerPos[1] + 0.8; // Adjusted for better alignment
      const desiredPos_z = playerPos[2] + 0.75; // Small upward adjustment

      // Calculate offset from hand position
      const offset_x = desiredPos_x - playerPos[0];
      const offset_y = desiredPos_y - playerPos[1];
      const offset_z = desiredPos_z - playerPos[2];

      // Attach camera to hand bone with offset
      // AttachCamToPedBone(selfieCam, lPed, handBone, offset_x- 0.80, offset_y, offset_z, false);
      AttachCamToEntity(selfieCam, lPed, offset_x, offset_y, offset_z, true);
      // Set rotation to face the player
      SetCamRot(selfieCam, -10.0, 0.0, (heading + 150.0) % 360.0, 2); // Slight upward tilt

      // Configure and activate the camera
      SetCamFov(selfieCam, 70.0); // Focused FOV for selfie
      SetCamActive(selfieCam, true);
      RenderScriptCams(true, false, 0, true, false);
      cellCamActivate(true, true); // Activate phone camera effect
      isSelfieMode = true;
      console.log("Entered selfie mode with adjusted position");
    } else if (!data && isSelfieMode) {
      // Exit selfie mode: Destroy selfie camera and reactivate normal camera
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
      console.log("Exited selfie mode");
    }
  }
});

// Tick function for camera rotation using the right analog stick
// setTick(() => {
//     if (camOpen) {
//         const activeCam = isSelfieMode ? selfieCam : normalCam;
//         if (activeCam) {
//             const rightAxisX: number = GetControlNormal(0, 1); // Right stick X-axis
//             const rightAxisY: number = GetControlNormal(0, 2); // Right stick Y-axis
//             const rotation: number[] = GetCamRot(activeCam, 2); // Current rotation

//             // Update rotation based on stick input
//             if (rightAxisX !== 0.0 || rightAxisY !== 0.0) {
//                 const newZ: number = rotation[2] + rightAxisX * -1.0 * speed_ud;
//                 const newX: number = Math.max(
//                     Math.min(50.0, rotation[0] + rightAxisY * -1.0 * speed_lr),
//                     -89.5
//                 ); // Clamp pitch
//                 SetCamRot(activeCam, newX, 0.0, newZ, 2);
//                 if (!isSelfieMode) {
//                     SetEntityHeading(PlayerPedId(), newZ); // Sync player heading in normal mode
//                 } else {
//                     const lPed = PlayerPedId();
//                     const heading = GetEntityHeading(lPed);
//                     SetCamRot(activeCam, newX, 0.0, (heading + 180.0) % 360.0, 2); // Keep selfie cam facing player
//                 }
//             }
//         }
//     }
// });
let sl = false;
RegisterCommand('selfie', () => {
  sl = !sl;
  cellCamActivate(!sl, sl);
}, false);

RegisterCommand('desPhone', () => {
  DestroyMobilePhone();
}, false);