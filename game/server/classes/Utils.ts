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
        let newNumbers: any[] = [];
        let newSettings: any[] = [];
        let newCards: any[] = [];

        MySQL.query('SELECT citizenid, charinfo FROM players', [], async (result: any[]) => {
            try {
                for (const row of result) {
                    const owner = row.citizenid;
                    let charinfo = row.charinfo;

                    // parse if stored as JSON string
                    if (typeof charinfo === 'string') {
                        try {
                            charinfo = JSON.parse(charinfo);
                        } catch (e) {
                            charinfo = {};
                        }
                    }

                    // prefer charinfo.phone, fall back to phone_number
                    const number = (charinfo && (charinfo.phone ?? charinfo.phone_number)) || null;
                    if (!number) continue;

                    // skip if phone number already exists for this owner
                    const existing = await MongoDB.findOne('phone_numbers', { owner });
                    if (existing) continue;

                    newNumbers.push({
                        _id: generateUUid(),
                        owner,
                        number
                    });

                    // prepare phone_settings if not present
                    const existingSettings = await MongoDB.findOne('phone_settings', { _id: owner });
                    if (!existingSettings) {
                        newSettings.push({
                            _id: owner,
                            background: { current: '', wallpapers: [] },
                            lockscreen: { current: '', wallpapers: [] },
                            ringtone: {
                                current: 'https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3',
                                ringtones: [
                                    {
                                        name: 'default',
                                        url: 'https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3',
                                    }
                                ],
                            },
                            showStartupScreen: true,
                            showNotifications: true,
                            isLock: true,
                            lockPin: '',
                            usePin: true,
                            phoneNumber: number,
                            useFaceId: false,
                            faceIdIdentifier: owner,
                            darkMailIdAttached: '',
                            pigeonIdAttached: '',
                            smrtId: '',
                            smrtPassword: '',
                            isFlightMode: false,
                        });
                    }

                    // prepare phone_player_card if not present
                    const existingCard = await MongoDB.findOne('phone_player_card', { _id: owner });
                    if (!existingCard) {
                        newCards.push({
                            _id: owner,
                            firstName: 'Setup',
                            lastName: 'Card',
                            phoneNumber: number,
                            email: '',
                            notes: '',
                            avatar: '',
                        });
                    }
                }

                if (newNumbers.length > 0) {
                    await MongoDB.insertMany('phone_numbers', newNumbers);
                    LOGGER(`Inserted ${newNumbers.length} phone_numbers.`);
                } else {
                    LOGGER('No new phone_numbers to insert.');
                }

                if (newSettings.length > 0) {
                    await MongoDB.insertMany('phone_settings', newSettings);
                    LOGGER(`Inserted ${newSettings.length} phone_settings.`);
                } else {
                    LOGGER('No new phone_settings to insert.');
                }

                if (newCards.length > 0) {
                    await MongoDB.insertMany('phone_player_card', newCards);
                    LOGGER(`Inserted ${newCards.length} phone_player_card entries.`);
                } else {
                    LOGGER('No new phone_player_card entries to insert.');
                }
            } catch (err) {
                LOGGER(`TransferNumbers error: ${err}`);
            }
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
        try {
            const result: any = await this.query('SELECT id, jobname, employees FROM player_jobs', []);
            if (!result || result.length === 0) {
                LOGGER('No multijobs found to transfer.');
                return;
            }

            const newData: any[] = [];

            for (const row of result) {
                try {
                    const jobId = row.id;
                    const jobName = row.jobname;
                    if (!jobName) continue;

                    let employees = row.employees;
                    if (!employees) continue;

                    if (typeof employees === 'string') {
                        try {
                            employees = JSON.parse(employees);
                        } catch (err) {
                            LOGGER(`Failed to parse employees JSON for job ${jobName} (id: ${jobId}): ${err}`);
                            continue;
                        }
                    }

                    if (!employees || typeof employees !== 'object' || Array.isArray(employees)) continue;

                    for (const [key, emp] of Object.entries(employees)) {
                        const cid = (emp && (emp.cid || emp.CID || emp.citizenId)) || key;
                        const gradeLevel = (emp && (emp.grade ?? emp.gradeLevel ?? emp.rank)) ?? 0;

                        const jobLabel = Framework?.Shared?.Jobs?.[jobName]?.label ?? jobName;
                        const gradeLabel = Framework?.Shared?.Jobs?.[jobName]?.grades?.[gradeLevel]?.name ?? '';

                        newData.push({
                            _id: generateUUid(),
                            citizenId: cid,
                            jobName,
                            gradeLevel,
                            jobLabel,
                            gradeLabel
                        });
                    }
                } catch (innerErr) {
                    LOGGER(`Error processing player_jobs row id ${row.id}: ${innerErr}`);
                }
            }

            if (newData.length > 0) {
                await MongoDB.insertMany('phone_multijobs', newData);
                LOGGER(`Inserted ${newData.length} multijob entries to phone_multijobs.`);
            } else {
                LOGGER('No multijob entries found to insert after parsing.');
            }
        } catch (err) {
            LOGGER(`MigrateMultiJobData error: ${err}`);
        }
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

        try {
            for (const phoneItem of phoneList) {
                const has = await exports['lj-inventory'].HasItem(playerSource, phoneItem);
                if (has) return true;
            }
        } catch (e) {
            console.error('HasPhone check failed:', e);
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
    
    async getJobs(citizenId: string) {
        const jobs: Record<string, any> = {};
        const employees: Record<string, Record<string, any>> = {};

        // find all multijob entries for this citizen
        const myEntries: any[] = await MongoDB.findMany('phone_multijobs', { citizenId });
        if (!myEntries || myEntries.length === 0) return { jobs, employees };

        // collect unique job names so we can fetch all employees for those jobs in one query
        const jobNames = Array.from(new Set(myEntries.map(e => e.jobName)));

        // build jobs map (one entry per job this cid has)
        for (const e of myEntries) {
            jobs[e.jobName] = {
                citizenId: e.citizenId,
                jobName: e.jobName,
                gradeLevel: e.gradeLevel ?? 0,
                jobLabel: e.jobLabel ?? Framework?.Shared?.Jobs?.[e.jobName]?.label ?? e.jobName,
                gradeLabel: e.gradeLabel ?? Framework?.Shared?.Jobs?.[e.jobName]?.grades?.[e.gradeLevel]?.name ?? ''
            };
        }

        // fetch all employees for the collected jobs and build employees map: { jobName: { cid: {...}, ... }, ... }
        const allEmployees = await MongoDB.findMany('phone_multijobs', { jobName: { $in: jobNames } });
        for (const entry of allEmployees) {
            employees[entry.jobName] = employees[entry.jobName] || {};
            employees[entry.jobName][entry.citizenId] = {
                cid: entry.citizenId,
                grade: entry.gradeLevel ?? 0,
                gradeLabel: entry.gradeLabel ?? '',
                jobLabel: entry.jobLabel ?? ''
            };
        }

        return { jobs, employees };
    }
}

export const Utils = new Util();