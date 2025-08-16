import { FrameWork } from "@client/cl_main";
import { NUI } from "@client/classes/NUI";
import { triggerServerCallback } from "@overextended/ox_lib/client";
import { generateUUid } from "@shared/utils";

RegisterNuiCallbackType('getAllBusinessData');
on('__cfx_nui:getAllBusinessData', async (s: any, cb: Function) => {
    const data = await triggerServerCallback('getAllBusinessData', 1);
    cb(data);
});

RegisterNuiCallbackType('setWayPoint');
on('__cfx_nui:setWayPoint', async (data: any, cb: Function) => {
    SetNewWaypoint(Number(data.x), Number(data.y));
    emit("phone:addnotiFication", JSON.stringify({
        id: generateUUid(),
        title: "System",
        description: `Waypoint set`,
        app: "settings",
        timeout: 2000,
    }));
});

RegisterNuiCallbackType('callBusiness');
on('__cfx_nui:callBusiness', async (data: any, cb: Function) => {
    cb('Ok');
    const res = await triggerServerCallback('summit_phone:server:getBusinessEmployeesNumbers', null, data) as string;
    const parsedData = JSON.parse(res);
    const servicesContext = parsedData.map((number: number) => (
        {
            name: number,
            event: 'summit_phone:server:businessCall',
            isServer: false,
            args: Number(number)
        }
    ));

    if (servicesContext.length > 0) {
        NUI.sendReactMessage('phone:contextMenu', servicesContext);
    } else {
        const notiData: {
            id: string,
            title: string,
            description: string,
            app: string,
            timeout: number
        } = {
            id: generateUUid(),
            title: "System",
            description: `No employees found`,
            app: "settings",
            timeout: 2000
        };
        NUI.sendReactMessage('addNotification', notiData);        
    }
});

RegisterNuiCallbackType('getJobData');
on('__cfx_nui:getJobData', async (data: any, cb: Function) => {
    const PlayerData = FrameWork.Functions.GetPlayerData();
    cb(JSON.stringify(PlayerData.job));
});

RegisterNuiCallbackType('toggleDuty');
on('__cfx_nui:toggleDuty', async (data: any, cb: Function) => {
    emitNet('QBCore:ToggleDuty');
    cb('ok');
});

RegisterNuiCallbackType('toggleJobCalls');
on('__cfx_nui:toggleJobCalls', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:toggleJobCalls', 1);
    cb(res);
});

RegisterNuiCallbackType('getJobCalls');
on('__cfx_nui:getJobCalls', async (data: any, cb: Function) => {
    const calls = await triggerServerCallback('summit_phone:server:getJobCalls', 1);
    cb(calls);
});

RegisterNuiCallbackType('getBankbalance');
on('__cfx_nui:getBankbalance', async (data: any, cb: Function) => {
    const balance = await triggerServerCallback('summit_phone:server:getBankbalance', 1, data);
    cb(balance);
});

RegisterNuiCallbackType('withdrawMoney');
on('__cfx_nui:withdrawMoney', async (amount: number, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:withdrawMoney', 1, amount);
    cb(res);
});

RegisterNuiCallbackType('depositMoney');
on('__cfx_nui:depositMoney', async (amount: number, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:depositMoney', 1, amount);
    cb(res);
});

RegisterNuiCallbackType('getEmployeesData');
on('__cfx_nui:getEmployeesData', async (data: any, cb: Function) => {
    const employees = await triggerServerCallback('summit_phone:server:getEmployees', 1, data);
    cb(employees);
});

RegisterNuiCallbackType('hireEmployee');
on('__cfx_nui:hireEmployee', async (data: any, cb: Function) => {
    const res = await triggerServerCallback('summit_phone:server:hireEmployee', 1, data.source, data.jobname);
    cb(res);
});

RegisterNuiCallbackType('MangeEmployee');
on('__cfx_nui:MangeEmployee', async (citizenId: string, cb: Function) => {
    const data = [
        {
            name: 'Fire',
            event: 'summit_phone:server:fireEmployee',
            isServer: true,
            args: citizenId
        },
        {
            name: 'Change Rank',
            event: 'summit_phone:server:promoteEmployee',
            isServer: false,
            args: citizenId
        }
    ]
    NUI.sendReactMessage('phone:contextMenu', data);
    cb('ok');
});

RegisterNuiCallbackType('MangeInactiveEmployee');
on('__cfx_nui:MangeInactiveEmployee', async (citizenId: string, cb: Function) => {
    const PlayerData = FrameWork.Functions.GetPlayerData();
    const jobName = PlayerData.job.name;
    const data = [
        {
            name: 'Fire',
            event: 'summit_phone:server:fireInactiveEmployee',
            isServer: true,
            args: { citizenId, jobName }
        }
    ]
    NUI.sendReactMessage('phone:contextMenu', data);
    cb('ok');
});