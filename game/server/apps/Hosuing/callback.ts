import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { Framework, Logger } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

async function isPropertyOwner(propertyId: number, citizenId: string): Promise<boolean> {
    const properties = await exports['nolag_properties'].GetAllProperties(citizenId, 'user', true);
    if (!properties || !Array.isArray(properties)) {
        return false;
    }
    return properties.some((property: any) => property.id === propertyId) || false;
}

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
    const citizenId = await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(client));
    const isOwner = await isPropertyOwner(id, citizenId);
    if (!isOwner) {
        emitNet("phone:addnotiFication", client, JSON.stringify({
            id: generateUUid(),
            title: "Access Denied",
            description: "You don't have permission to remove access from this property",
            app: "housing",
            timeout: 2000,
        }));
        return false;
    }
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
    const citizenId = await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(client));
    const isOwner = await isPropertyOwner(id, citizenId);
    if (!isOwner) {
        emitNet("phone:addnotiFication", client, JSON.stringify({
            id: generateUUid(),
            title: "Access Denied",
            description: "You don't have permission to give access to this property",
            app: "housing",
            timeout: 2000,
        }));
        return false;
    }
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
    const citizenId = await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(src));
    const isOwner = await isPropertyOwner(data.propertyId, citizenId);
    if (!isOwner) {
        emitNet("phone:addnotiFication", src, JSON.stringify({
            id: generateUUid(),
            title: "Access Denied",
            description: "You don't have permission to toggle this door",
            app: "housing",
            timeout: 2000,
        }));
        return;
    }
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
    const citizenId = await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(src));
    const isOwner = await isPropertyOwner(id, citizenId);
    if (!isOwner) {
        emitNet("phone:addnotiFication", src, JSON.stringify({
            id: generateUUid(),
            title: "Access Denied",
            description: "You don't have permission to add access to this property",
            app: "housing",
            timeout: 2000,
        }));
        return;
    }
    const cid = await exports['qb-core'].GetPlayerCitizenIdBySource(Number(psrc));
    exports['nolag_properties'].AddKey(src, id, cid);
    Logger.AddLog({
        type: 'phone_properties',
        title: 'Access Added',
        message: `Access added for ${cid} to property ${id} by ${await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(src))}`,
        showIdentifiers: false
    });
});