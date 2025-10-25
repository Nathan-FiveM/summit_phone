import "./cl_nuicallback";
import "./cl_exports";
import "./apps/index";
import { NUI } from "./classes/NUI";
import { Delay, generateUUid } from "@shared/utils";
import { triggerServerCallback } from "@overextended/ox_lib/client";
import { PhoneSettings } from "../../types/types";
import { Utils } from "./classes/Utils";
import { CloseAndToggleDisablePhone, ToggleDisablePhone } from "./cl_exports";
import { Animation } from "./classes/Animation";
import { FRAMEWORK_RESOURCE } from "../shared/utils"; // adjust path as needed

export let FrameWork = exports[FRAMEWORK_RESOURCE].GetCoreObject();
on('QBCore:Client:UpdateObject', () => {
    FrameWork = exports[FRAMEWORK_RESOURCE].GetCoreObject();
})

setImmediate(() => {
    NUI.init();

    exports.ox_target.addGlobalPlayer([
        {
            icon: 'fas fa-hands',
            label: 'Share Number',
            distance: 1.5,
            onSelect: async (a: any) => {
                const source = GetPlayerServerId(NetworkGetPlayerIndexFromPed(a.entity));
                await triggerServerCallback('phone:server:shareNumber', 1, source);
            }
        }
    ]);
});

// Notification throttling to prevent spam
let lastNotificationTime = 0;
const NOTIFICATION_THROTTLE_MS = 100; // Minimum 100ms between notifications

RegisterCommand('testNoti', () => {
    NUI.sendReactMessage('addNotification', {
        id: '1',
        title: 'Test Notification',
        description: 'This is a test notification',
        app: 'phone',
        timeout: 5000,
    });
}, false);

onNet('phone:addnotiFication', (data: string) => {
    const phoneItem = Utils.GetPhoneItem();
    if (!phoneItem) {
        emit("QBCore:Notify", "No phone item found", "error");
        return;
    };

    const currentTime = GetGameTimer();
    if (currentTime - lastNotificationTime < NOTIFICATION_THROTTLE_MS) {
        return; // Throttle notifications
    }
    lastNotificationTime = currentTime;

    const notiData: {
        id: string,
        title: string,
        description: string,
        app: string,
        timeout: number
    } = JSON.parse(data);
    NUI.sendReactMessage('addNotification', notiData);
});

onNet('phone:addActionNotification', (data: string) => {
    const currentTime = GetGameTimer();
    if (currentTime - lastNotificationTime < NOTIFICATION_THROTTLE_MS) {
        return; // Throttle action notifications too
    }
    lastNotificationTime = currentTime;

    const notiData: {
        id: string,
        title: string,
        description: string,
        app: string,
        icons: {
            "0": {
                icon: string,
                isServer: boolean,
                event: string,
                args: any
            },
            "1": {
                icon: string,
                isServer: boolean,
                event: string,
                args: any
            }
        }
    } = JSON.parse(data);
    NUI.sendReactMessage('addActionNotification', notiData);
});

on('onResourceStop', (resource: string) => {
    if (resource === GetCurrentResourceName()) {
        const state = LocalPlayer.state;
        state.set('onPhone', false, true);
        // Cleanup NUI loops and timeouts
        NUI.cleanup();
        // Cleanup animation resources
        Animation.cleanup();
    }
});

onNet('phone:client:setupPhone', async (citizenId: string) => {
    const response = await triggerServerCallback('GetClientSettings', 1) as string;
    const res = JSON.parse(response) as PhoneSettings;
    if (!res) return;
    await Delay(1000);
    /* console.log(response); */
    NUI.sendReactMessage('setSettings', response);
});

let lastUpdate = 0;
const debounceDelay = 1000; // 1 second

onNet('QBCore:Player:SetPlayerData', (data: any) => {
    const currentTime = Date.now();
    if (currentTime - lastUpdate < debounceDelay) {
        /* console.log('Debouncing QBCore:Player:SetPlayerData'); */
        return;
    }
    lastUpdate = currentTime;

    const metadata = data.metadata || {};
    const isRestricted = (metadata.isko === true || metadata.isdead === true || metadata.ishandcuffed === true);
    const notRestricted = (metadata.isko === false || metadata.isdead === false || metadata.ishandcuffed === false);
    
    if (isRestricted) {
        if (LocalPlayer.state.onPhone) {
            /* console.log('Closing phone UI due to restricted state'); */
            setTimeout(() => {
                if (LocalPlayer.state.onPhone) {
                    NUI.closeUI();
                    NUI.sendReactMessage('toggleCloseClear', "ok");
                    CloseAndToggleDisablePhone(true);
                }
            }, 1000);
        } else {
            /* console.log('Disabling phone due to restricted state'); */
            ToggleDisablePhone(true);
        }
    } if (notRestricted)  {
        if (!LocalPlayer.state.onPhone) {
            /* console.log('Enabling phone as player is not restricted'); */
            ToggleDisablePhone(false);
        }
    }
});