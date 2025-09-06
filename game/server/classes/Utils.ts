import { Framework, MongoDB, MySQL } from "@server/sv_main";
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

        RegisterCommand('migrateMultiJobData', async (source: any, args: any) => {
            if (source === 0) return LOGGER('This command can only be executed in-game.');
            await Utils.MigrateMultiJobData();
        }, true);

        RegisterCommand('migrateSociety', async (source: any, args: any) => {
            if (source === 0) return LOGGER('This command can only be executed in-game.');
            await Utils.MigrateSocietyData();
        }, true);
    };

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
    };

    async MigrateMultiJobData() {
        const result: any = await this.query('SELECT * FROM summit_multijobs', []);
        if (!result || result.length === 0) {
            LOGGER('No multijobs found to transfer.');
            return;
        }
        let newData: any[] = [];
        result.forEach(async (job: any) => {
            console.log(`Processing multijob ${job.cid} of ${result.length}`);
            const citizenId = job.cid;
            const jobName = job.job;
            const gradeLevel = job.grade;
            newData.push({
                _id: generateUUid(),
                citizenId: citizenId,
                jobName: jobName,
                gradeLevel: gradeLevel,
                jobLabel: Framework.Shared.Jobs[jobName].label,
                gradeLabel: Framework.Shared.Jobs[jobName].grades[gradeLevel].name,
            });
        });
        await MongoDB.insertMany('phone_multijobs', newData);
        LOGGER('Multijobs have been transferred to MongoDB.');
    };

    async MigrateSocietyData() {
        const result: any = await this.query('SELECT * FROM av_society', []);

        result.forEach(async (job: any) => {
            await MongoDB.updateOne('summit_bank', { _id: job.job }, {
                bankBalance: Number(job.money)
            }, undefined, false)
        })
    }

    async GetPhoneNumberByCitizenId(citizenId: string) {
        const number = await MongoDB.findOne('phone_numbers', { owner: citizenId });
        if (!number) return false;
        return number.number;
    };

    async GetEmailIdByCitizenId(citizenId: string) {
        const number = await MongoDB.findOne('phone_settings', { _id: citizenId });
        if (!number) return false;
        return number.smrtId;
    };

    async GetEmailIdBySource(source: number) {
        const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
        if (!citizenId) return false;
        const email = await this.GetEmailIdByCitizenId(citizenId);
        return email;
    };

    async GetCitizenIdByPhoneNumber(phoneNumber: string) {
        const number = await MongoDB.findOne('phone_numbers', { number: phoneNumber });
        if (!number) return false;
        return number.owner;
    };

    async GetPlayerFromPhoneNumber(phoneNumber: string) {
        const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
        return await exports['qb-core'].GetPlayerByCitizenId(citizenId);
    };

    async GetPhoneNumberBySource(source: number) {
        const citizenId = await exports['qb-core'].GetPlayerCitizenIdBySource(source);
        return await this.GetPhoneNumberByCitizenId(citizenId);
    };

    async BlockNumber(phoneNumber: string, targetPhoneNumber: string) {
        const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
        const targetCitizenId = await this.GetCitizenIdByPhoneNumber(targetPhoneNumber);
        if (!citizenId || !targetCitizenId) return;
        await MongoDB.insertOne('phone_blocked_numbers', {
            _id: generateUUid(),
            citizenId: citizenId,
            targetCitizenId: targetCitizenId,
        });
    };

    async UnblockNumber(phoneNumber: string, targetPhoneNumber: string) {
        const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
        const targetCitizenId = await this.GetCitizenIdByPhoneNumber(targetPhoneNumber);
        if (!citizenId || !targetCitizenId) return;
        await MongoDB.deleteOne('phone_blocked_numbers', { citizenId: citizenId, targetCitizenId: targetCitizenId });
    };

    async IsNumberBlocked(phoneNumber: string, targetPhoneNumber: string) {
        const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
        const targetCitizenId = await this.GetCitizenIdByPhoneNumber(targetPhoneNumber);
        if (!citizenId || !targetCitizenId) return false;
        const blocked = await MongoDB.findOne('phone_blocked_numbers', { citizenId: citizenId, targetCitizenId: targetCitizenId });
        return blocked ? true : false;
    };

    async GetContactNameByNumber(phoneNumber: string, citizenId: string) {
        const contact = await MongoDB.findOne('phone_contacts', { contactNumber: phoneNumber, ownerId: citizenId });
        if (!contact) return phoneNumber;
        return `${contact.firstName} ${contact.lastName}`;
    };

    async GetContactAvatarByNumber(phoneNumber: string, citizenId: string) {
        const contact = await MongoDB.findOne('phone_contacts', { contactNumber: phoneNumber, ownerId: citizenId });
        if (!contact) return '';
        return contact.image;
    };

    async GetSourceFromCitizenId(citizenId: string) {
        const source = await exports['qb-core'].GetPlayerByCitizenId(citizenId);
        if (!source) return false;
        return source.PlayerData.source;
    }

    async HasPhone(playerSource: number) {
        const phoneList: string[] = [
            'blue_phone',
            'green_phone',
            'red_phone',
            'gold_phone',
            'purple_phone',
        ];
        const hasItem: {
            'blue_phone': number,
            'green_phone': number,
            'red_phone': number,
            'gold_phone': number,
            'purple_phone': number,
        } = exports['ox_inventory'].Search(playerSource, 'count', phoneList);
        for (let i = 0; i < phoneList.length; i++) {
            // @ts-ignore
            if (hasItem[phoneList[i]] > 0) {
                return true;
            }
        }
        return false;
    };

    async InFlightMode(citizenId: string) {
        const settings = await MongoDB.findOne('phone_settings', { _id: citizenId });
        if (!settings) return false;
        return settings.isFlightMode || false;
    };

    async query(query: string, values: any) {
        return new Promise((resolve, reject) => {
            MySQL.query(query, values, (result: any) => {
                resolve(result);
            });
        });
    };

    async isSenderKnown(senderId: string, receiverId: string): Promise<boolean> {
        // Query to check if the sender is in the receiver's contacts
        const contactQuery = {
            ownerId: receiverId,
            contactNumber: senderId
        };

        // Try to find a contact entry
        const contact = await MongoDB.findOne('phone_contacts', contactQuery);

        // If a contact is found, the sender is known
        return contact !== null;
    };

    async GetPhoneNumberByEmail(email: string) {
        const number = await MongoDB.findOne('phone_settings', { smrtId: email });
        if (!number) return false;
        return number.phoneNumber;
    };

    async GetCitizenIdByEmail(email: string) {
        const number = await MongoDB.findOne('phone_settings', { smrtId: email });
        if (!number) return false;
        return number._id;
    };

    async GetPlayerByEmail(email: string) {
        const citizenId = await this.GetCitizenIdByEmail(email);
        return await exports['qb-core'].GetPlayerByCitizenId(citizenId);
    };

    async GetAvatarFromEmail(email: string) {
        const avator = await MongoDB.findOne('phone_mail', { activeMaidId: email });
        if (!avator) return false;
        return avator.avatar;
    };

    async GetUserNameFromEmail(email: string) {
        const user = await MongoDB.findOne('phone_mail', { activeMaidId: email });
        if (!user) return false;
        return user.username;
    };

    async GetCidFromTweetId(email: string) {
        const res = await MongoDB.findOne('phone_settings', { pigeonIdAttached: email });
        if (!res) return false;
        return res._id;
    };

    async GetCidsFromPigeonEmail(email: string) {
        const res = await MongoDB.findMany('phone_settings', { pigeonIdAttached: email });
        if (!res || res.length === 0) return [];
        return res.map((setting: any) => setting._id);
    };

    async GetCidFromDarkEmail(email: string) {
        const res = await MongoDB.findOne('phone_settings', { darkMailIdAttached: email });
        if (!res) return false;
        return res._id;
    };

    async IsPlayerInJail(source: number): Promise<boolean> {
        try {
            const player = await exports['qb-core'].GetPlayer(source);
            if (!player) return false;

            const metadata = player.PlayerData.metadata;
            return metadata && metadata.injail && metadata.injail > 0;
        } catch (error) {
            return false;
        }
    };
}

export const Utils = new Util();