import { onClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { Logger } from "@server/sv_main";

onClientCallback('getOwnedHouses', async (client) => {
    const player = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const apartments = await Utils.query('SELECT property_id, owner_citizenid, street, description, has_access, door_data, apartment  FROM properties WHERE owner_citizenid = ? AND apartment IS NOT NULL AND apartment <> ""', [player]);
    const houses = await Utils.query('SELECT property_id, owner_citizenid, street, description, has_access, shell, door_data FROM properties WHERE owner_citizenid = ? AND apartment IS NULL', [player]);
    const res = {
        apartments: apartments,
        houses: houses
    }
    return JSON.stringify(res);
});

onClientCallback('getKeyHolderNames', async (client, data) => {
    const res = JSON.parse(data);
    let nameMap: { [key: string]: string } = {};

    if (res && res.length > 0) {
        // Process all houses in parallel
        const apartmentPromises = res.map((house: string) =>
            Utils.query('SELECT citizenid, charinfo FROM players WHERE citizenid = ?', [house])
        );

        const allApartments = await Promise.all(apartmentPromises);

        allApartments.forEach(apartments => {
            console.log(apartments);
            if (apartments && apartments.length > 0) {
                apartments.forEach((apartment: any) => {
                    const charinfo = JSON.parse(apartment.charinfo);
                    const fullName = `${charinfo.firstname} ${charinfo.lastname}`;
                    nameMap[apartment.citizenid] = fullName;
                });
            }
        });
    }

    return JSON.stringify(nameMap);
});

onClientCallback('removeAccess', async (client, data) => {
    const { id, cid } = JSON.parse(data);
    const house: any = await Utils.query('SELECT * FROM properties WHERE property_id = ?', [id]);
    if (house && house.length > 0) {
        const houseData = house[0];
        const hasAccess = JSON.parse(houseData.has_access);
        const newAccess = hasAccess.filter((access: string) => access !== cid);
        console.log(newAccess);
        await Utils.query('UPDATE properties SET has_access = ? WHERE property_id = ?', [JSON.stringify(newAccess), id]);
        Logger.AddLog({
            type: 'phone_properties',
            title: 'Access Removed',
            message: `Access removed from ${cid} to ${houseData.street}, ${houseData.property_id} by ${await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(client))}`,
            showIdentifiers: false
        });
    }
    return true;
});