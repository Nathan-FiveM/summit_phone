import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { Framework, Logger } from "@server/sv_main";

onClientCallback('getOwnedHouses', async (client) => {
    const res = await exports['nolag_properties'].GetAllProperties(client, 'both');
    return JSON.stringify(res);
});

onClientCallback('getKeyHolderNames', async (client, data) => {
    const res = await exports['nolag_properties'].GetKeyHolders(data);
    return JSON.stringify(res);
});

onClientCallback('removeAccess', async (client, data) => {
    const { id, cid } = JSON.parse(data);
    await exports['nolag_properties'].RemoveKey(id, cid);
    Logger.AddLog({
        type: 'phone_properties',
        title: 'Access Removed',
        message: `Access removed from ${cid} to property ${id} by ${await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(client))}`,
        showIdentifiers: false
    });
    return true;
});

onClientCallback('giveAccess', async (client, data) => {
    const { id, cid } = JSON.parse(data);
    await exports['nolag_properties'].AddKey(id, cid);
    Logger.AddLog({
        type: 'phone_properties',
        title: 'Access Given',
        message: `Access given to ${cid} for property ${id} by ${await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(client))}`,
        showIdentifiers: false
    });
    return true;
});

onNet('summit_phone:server:toggleDoorlock', async (data: { propertyId: number, doorLocked: boolean }) => {
    const src = source;
    exports['nolag_properties'].ToggleDoorlock(src, data.propertyId, data.doorLocked);
    Logger.AddLog({
        type: 'phone_properties',
        title: 'Doorlock Toggled',
        message: `Doorlock ${data.doorLocked ? 'locked' : 'unlocked'} for property ${data.propertyId} by ${await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(src))}`,
        showIdentifiers: false
    });
});

onNet('ps-housing:server:addAccess', async (id: number, psrc: number) => {
    const src = source;
    const cid = await exports['qb-core'].GetPlayerCitizenIdBySource(Number(psrc));
    exports['nolag_properties'].AddKey(src, id, cid);
    Logger.AddLog({
        type: 'phone_properties',
        title: 'Access Added',
        message: `Access added for ${cid} to property ${id} by ${await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(src))}`,
        showIdentifiers: false
    });
});