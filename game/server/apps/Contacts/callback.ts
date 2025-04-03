import { onClientCallback } from "@overextended/ox_lib/server";
import { Logger, MongoDB } from "@server/sv_main";
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
        Logger.AddLog({
            type: 'phone_contacts',
            title: 'Contact Updated',
            message: `Contact '${contactData.firstName}'${contactData.lastName}' (Number: ${contactData.contactNumber}) updated by ${contactData.personalNumber}.`,
            showIdentifiers: false
        });
    }
    return true;
});

onClientCallback('contacts:addContact', async (client, data: string) => {
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const contactData: PhoneContacts = JSON.parse(data);
    const dataX = { ...contactData, ownerId: citizenId, personalNumber: await Utils.GetPhoneNumberByCitizenId(citizenId) }
    const res = await MongoDB.insertOne('phone_contacts', dataX);
    Logger.AddLog({
        type: 'phone_contacts',
        title: 'Contact Added',
        message: `Contact '${contactData.firstName}'${contactData.lastName}' (Number: ${contactData.contactNumber}) added by ${dataX.personalNumber}.`,
        showIdentifiers: false
    });
    return JSON.stringify(dataX);
});

onClientCallback('contacts:deleteContact', async (client, _id: string) => {
    const contact = await MongoDB.findOne('phone_contacts', { _id: _id });
    await MongoDB.deleteOne('phone_contacts', { _id: _id });
    Logger.AddLog({
        type: 'phone_contacts',
        title: 'Contact Deleted',
        message: `Contact '${contact.firstName}' '${contact.lastName}' (Number: ${contact.contactNumber}) deleted by ${contact.personalNumber}.`,
        showIdentifiers: false
    });
    return true;
});

onClientCallback('contacts:favContact', async (client, _id: string) => {
    const contact = await MongoDB.findOne('phone_contacts', { _id: _id });
    const dataX = { ...contact, isFav: !contact.isFav }
    await MongoDB.updateOne('phone_contacts', { _id: _id }, dataX);
    Logger.AddLog({
        type: 'phone_contacts',
        title: 'Contact Favorite Toggled',
        message: `Contact '${contact.firstName}' '${contact.lastName}' (Number: ${contact.contactNumber}) favorite status set to ${dataX.isFav} by ${contact.personalNumber}.`,
    });
    return JSON.stringify(dataX);
});