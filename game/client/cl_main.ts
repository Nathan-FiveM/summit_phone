import "./cl_nuicallback";
import "./cl_exports";
import "./apps/index";
import { NUI } from "./classes/NUI";
import { Delay, generateUUid } from "@shared/utils";
import { triggerServerCallback } from "@overextended/ox_lib/client";
import { PhoneSettings } from "../../types/types";
import { Utils } from "./classes/Utils";

export let FrameWork = exports['qb-core'].GetCoreObject();
on('QBCore:Client:UpdateObject', () => {
    FrameWork = exports['qb-core'].GetCoreObject();
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

onNet('phone:addnotiFication', (data: string) => {
    const phoneItem = Utils.GetPhoneItem();
    if (!phoneItem) {
        emit("QBCore:Notify", "No phone item found", "error");
        return;
    };
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
    }
});

onNet('phone:client:setupPhone', async (citizenId: string) => {
    const response = await triggerServerCallback('GetClientSettings', 1) as string;
    const res = JSON.parse(response) as PhoneSettings;
    if (!res) return;
    await Delay(1000);
    console.log(response);
    NUI.sendReactMessage('setSettings', response);
});

onNet('QBCore:Player:SetPlayerData', (data: any) => {
    if (data.metadata.inlaststand || data.metadata.isdead) {
        if (LocalPlayer.state.onPhone) {
            NUI.closeUI();
            NUI.shouldNotOpen = true;
            LocalPlayer.state.set('phoneDisabled', true, true);
        } else {
            NUI.shouldNotOpen = true;
            LocalPlayer.state.set('phoneDisabled', true, true);
        }
    }
});