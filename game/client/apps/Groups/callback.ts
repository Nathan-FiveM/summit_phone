import { onServerCallback } from "@overextended/ox_lib/client";

onServerCallback('groups:toggleDuty', async () => {
    emitNet('QBCore:ToggleDuty');
    return true;
});