import { onClientCallback } from "@overextended/ox_lib/server";
import { MongoDB } from "@server/sv_main";
import { PhoneContacts } from "../../../../types/types";
import { Utils } from "@server/classes/Utils";

onClientCallback('contacts:getContacts', async (client) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const contacts = await MongoDB.findMany('phone_contacts', { ownerId: citizenId });
    return JSON.stringify(contacts);
});

onClientCallback('contacts:saveContact', async (client, data: string) => {
    const contactData: PhoneContacts = JSON.parse(data);
    if (contactData._id) {
        await MongoDB.updateOne('phone_contacts', { _id: contactData._id }, { ...contactData });
    }
    return true;
});

onClientCallback('contacts:addContact', async (client, data: string) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const contactData: PhoneContacts = JSON.parse(data);
    const dataX = { ...contactData, ownerId: citizenId, personalNumber: await Utils.GetPhoneNumberByCitizenId(citizenId) }
    const res = await MongoDB.insertOne('phone_contacts', dataX);
    return JSON.stringify(dataX);
});

onClientCallback('contacts:deleteContact', async (client, _id: string) => {
    await MongoDB.deleteOne('phone_contacts', { _id: _id });
    return true;
});

onClientCallback('contacts:favContact', async (client, _id: string) => {
    const contact = await MongoDB.findOne('phone_contacts', { _id: _id });
    await MongoDB.updateOne('phone_contacts', { _id: _id }, { ...contact, isFav: !contact.isFav });
    return true;
});