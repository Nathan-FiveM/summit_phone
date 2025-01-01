import { MongoDB, MySQL } from "@server/sv_main";
import { generateUUid, LOGGER } from "@shared/utils";

class Util {

    async load() {
        RegisterCommand('transferNumbers', async (source: any, args: any) => {
            if (source === 0) return LOGGER('This command can only be executed in-game.');
            await Utils.TransferNumbers();
        }, true);

        RegisterCommand('transferContacts', async (source: any, args: any) => {
            if (source === 0) return LOGGER('This command can only be executed in-game.');
            await Utils.TransferContacts();
        }, true);
    }

    async TransferNumbers() {
        let newData: any[] = [];
        MySQL.query('SELECT owner_id, phone_number FROM phone_phones', [], async (result: any[]) => {
            result.forEach(async (phone: any) => {
                const owner = phone.owner_id;
                const number = phone.phone_number;

                newData.push({
                    _id: generateUUid(),
                    owner: owner,
                    number: number
                });
            });

            await MongoDB.insertMany('phone_numbers', newData);
            LOGGER('Phone numbers have been transferred to MongoDB.');
        });
    };

    async TransferContacts() {
        let newData: any[] = [];
        MySQL.query('SELECT * FROM phone_phone_contacts', [], async (result: any[]) => {
            result.forEach(async (contact: any) => {
                const personalNumber = contact.phone_number;
                const contactNumber = contact.contact_phone_number;
                const firstName = contact.firstname;
                const lastName = contact.lastname;
                const image = contact.profile_image;
                const personalCitizenID = await this.GetCitizenIdByPhoneNumber(personalNumber);

                newData.push({
                    _id: generateUUid(),
                    personalNumber: personalNumber,
                    contactNumber: contactNumber,
                    firstName: firstName,
                    lastName: lastName,
                    image: image,
                    ownerId: personalCitizenID
                });
            });

            await MongoDB.insertMany('phone_contacts', newData);
            LOGGER('Phone contacts have been transferred to MongoDB.');
        })
    }

    async GetPhoneNumberByCitizenId(citizenId: string) {
        try {
            const number = await MongoDB.findOne('phone_numbers', { owner: citizenId }).number;
            return number;
        } catch (e) {
            LOGGER(`Error while getting phone number by citizen id: ${e}`);
        }
    };

    async GetCitizenIdByPhoneNumber(phoneNumber: string) {
        try {
            const number = await MongoDB.findOne('phone_numbers', { number: phoneNumber }).owner;
            return number;
        } catch (e) {
            LOGGER(`Error while getting citizen id by phone number: ${e}`);
        }
    };
}

export const Utils = new Util();