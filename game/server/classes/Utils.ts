import { MongoDB, MySQL } from "@server/sv_main";
import { generateUUid, LOGGER } from "@shared/utils";

class Util {
    public contactsData: any;
    constructor() {
        this.contactsData = [];
    }

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
        try {
            const result: any = await this.query('SELECT * FROM phone_phone_contacts', []);

            if (!result || result.length === 0) {
                LOGGER('No contacts found to transfer.');
                return;
            }
            for (const [index, contact] of result.entries()) {
                if (index > result.length) break;
                console.log(`Processing contact ${index + 1} of ${result.length}`);
                const ownerId = await this.GetCitizenIdByPhoneNumber(contact.phone_number);
                this.contactsData.push({
                    _id: generateUUid(),
                    personalNumber: contact.phone_number,
                    contactNumber: contact.contact_phone_number,
                    firstName: contact.firstname,
                    lastName: contact.lastname,
                    image: contact.profile_image,
                    ownerId: ownerId,
                });
            }
            await MongoDB.insertMany('phone_contacts', this.contactsData);
            LOGGER('Phone contacts have been transferred to MongoDB.');
        } catch (e) {
            LOGGER(`Error while transferring contacts: ${JSON.stringify(e, null, 2)}`);
        }
    }

    async GetPhoneNumberByCitizenId(citizenId: string) {
        const number = await MongoDB.findOne('phone_numbers', { owner: citizenId });
        if (!number) return false;
        return number.number;
    };

    async GetCitizenIdByPhoneNumber(phoneNumber: string) {
        const number = await MongoDB.findOne('phone_numbers', { number: phoneNumber });
        if (!number) return false;
        return number.owner;
    };

    async query(query: string, values: any) {
        return new Promise((resolve, reject) => {
            MySQL.query(query, values, (result: any) => {
                resolve(result);
            });
        });
    }
}

export const Utils = new Util();