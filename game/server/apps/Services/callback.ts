import { onClientCallback, triggerClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { MongoDB, Logger, Framework } from "@server/sv_main";
import { generateUUid, LOGGER } from "@shared/utils";

onClientCallback('RegisterNewBusiness', async (client, data: string) => {
    const {
        ownerCitizenId,
        businessName,
        businessDescription,
        businessType,
        businessLogo,
        businessPhoneNumber,
        businessAddress,
        generateBusinessEmail,
        coords,
        businessEmail,
        businessPassword,
        job
    } = JSON.parse(data);

    const business = await MongoDB.findOne('phone_business', { businessName });
    if (business) {
        Logger.AddLog({
            type: 'phone_business',
            title: 'Business Registration Failed',
            message: `Attempt to register business with existing name '${businessName}' by Player: ${exports['qb-core'].GetPlayerName(client)}`,
            showIdentifiers: false
        });
        return emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `Business with name ${businessName} already exists.`,
            app: "services",
            timeout: 5000,
        }));
    }

    if (generateBusinessEmail) {
        await MongoDB.insertOne('phone_mail', {
            _id: businessEmail,
            activeMaidId: businessEmail,
            username: businessEmail,
            activeMailPassword: businessPassword,
            avatar: businessLogo,
            messages: []
        })
    }

    await MongoDB.insertOne('phone_business', {
        ownerCitizenId,
        businessName,
        businessDescription,
        businessType,
        businessLogo,
        businessPhoneNumber,
        businessAddress,
        generateBusinessEmail,
        businessEmail,
        coords,
        job
    });
    Logger.AddLog({
        type: 'phone_business',
        title: 'Business Registered',
        message: `New business '${businessName}' registered by Player: ${exports['qb-core'].GetPlayerName(client)}`,
        showIdentifiers: false
    });
});

onClientCallback('getBusinessData', async (client, data: string) => {
    const business = await MongoDB.findOne('phone_business', { businessName: data });
    return JSON.stringify(business);
});
onClientCallback('getAllBusinessData', async (client, data: string) => {
    const businesses = await MongoDB.findMany('phone_business', {});
    /* console.log(GlobalState[('%s:count'):format(job)]) */
    let onlineBuss = []
    let offlineBuss = []
    for (const business of businesses) {
        const jobCount = GlobalState[`${business.job}:count`]
        if (jobCount) {
            onlineBuss.push(business);
        } else {
            offlineBuss.push(business);
        }
    }
    return JSON.stringify({ online: onlineBuss, offline: offlineBuss });
});

onClientCallback('getBusinessNames', async (client) => {
    const businesses = await MongoDB.findMany('phone_business', {});
    return JSON.stringify(businesses.map((business: any) => business.businessName));
})

onClientCallback('UpdateBusiness', async (client, data: string) => {
    const {
        selectedBusiness,
        ownerCitizenId,
        businessName,
        businessDescription,
        businessType,
        businessLogo,
        businessPhoneNumber,
        businessAddress,
        generateBusinessEmail,
        coords,
        job,
        businessEmail
    } = JSON.parse(data);
    const business = await MongoDB.findOne('phone_business', { businessName: selectedBusiness });
    if (!business) {
        Logger.AddLog({
            type: 'phone_business',
            title: 'Business Update Failed',
            message: `Attempt to update non-existent business '${selectedBusiness}' by Player: ${exports['qb-core'].GetPlayerName(client)}`,
            showIdentifiers: false
        });
        return emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `Business with name ${businessName} does not exist.`,
            app: "services",
            timeout: 5000,
        }));
    }

    await MongoDB.updateOne('phone_business', { businessName: selectedBusiness }, {
        ownerCitizenId,
        businessName,
        businessDescription,
        businessType,
        businessLogo,
        businessPhoneNumber,
        businessAddress,
        generateBusinessEmail,
        coords,
        job,
        businessEmail
    });
    Logger.AddLog({
        type: 'phone_business',
        title: 'Business Updated',
        message: `Business '${selectedBusiness}' updated by Player: ${exports['qb-core'].GetPlayerName(client)}`,
        showIdentifiers: false
    });
});

onClientCallback('deleteBusiness', async (client, data: string) => {
    const business = await MongoDB.findOne('phone_business', { businessName: data });
    if (!business) {
        Logger.AddLog({
            type: 'phone_business',
            title: 'Business Deletion Failed',
            message: `Attempt to delete non-existent business '${data}' by Player: ${exports['qb-core'].GetPlayerName(client)}`,
            showIdentifiers: false
        });
        return emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `Business with name ${data} does not exist.`,
            app: "services",
            timeout: 5000,
        }));
    }

    await MongoDB.deleteOne('phone_business', { businessName: data });
    Logger.AddLog({
        type: 'phone_business',
        title: 'Business Deleted',
        message: `Business '${data}' deleted by Player: ${exports['qb-core'].GetPlayerName(client)}`,
        showIdentifiers: false
    });
});

onClientCallback('summit_phone:server:toggleJobCalls', async (client) => {
    const player = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);;
    const PlayerData = await MongoDB.findOne('phone_business_users', { citizenid: player });
    if (!PlayerData) {
        await MongoDB.insertOne('phone_business_users', { citizenid: player, jobCalls: true });
        return true;
    };
    await MongoDB.updateOne('phone_business_users', { citizenid: player }, { jobCalls: !PlayerData.jobCalls });
    return !PlayerData.jobCalls;
});

onClientCallback('summit_phone:server:getJobCalls', async (client) => {
    const player = await global.exports['qb-core'].GetPlayerCitizenIdBySource(client);
    const PlayerData = await MongoDB.findOne('phone_business_users', { citizenid: player });
    if (!PlayerData) {
        await MongoDB.insertOne('phone_business_users', { citizenid: player, jobCalls: true });
        return true;
    };
    return PlayerData.jobCalls;
});

onClientCallback('summit_phone:server:businessCall', async (client: number, data: string) => {
    const { number } = JSON.parse(data);
    const citizenid = await Utils.GetCitizenIdByPhoneNumber(number);
    const personalNumber = await Utils.GetPhoneNumberBySource(client);
    if (String(personalNumber) === String(number)) {
        return emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `You Can't call yourself ${personalNumber}.`,
            app: "services",
            timeout: 5000,
        }));
    }
    if (!citizenid) {
        return emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `This number is not registered.`,
            app: "services",
            timeout: 5000,
        }));
    }
    const PlayerData = await MongoDB.findOne('phone_business_users', { citizenid: citizenid });
    if (PlayerData && !PlayerData.jobCalls) {
        return emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `This person has disabled job calls.`,
            app: "services",
            timeout: 5000,
        }));
    } else if (PlayerData && PlayerData.jobCalls) {
        await triggerClientCallback('summit_phone:client:businessCall', client, number);
    }
});

onClientCallback('summit_phone:server:getBankbalance', async (client, account) => {
    const balance = await exports.summit_bank.GetBusinessAccountBalance(account);
    return balance;
});

onClientCallback('summit_phone:server:depositMoney', async (client, amount: number) => {
    const account = await exports['qb-core'].GetPlayerJob(client);
    const bankbalance = await exports['qb-core'].GetMoney(client, 'bank');
    if (bankbalance < amount) {
        return false;
    }
    await exports['qb-core'].RemoveMoney(client, 'bank', amount, "Phone Business App Deposit.");
    await exports.summit_bank.AddMoneyToBusinessAccount(account, amount);
    Logger.AddLog({
        type: 'phone_business',
        title: 'Money Deposited',
        message: `Player ${exports['qb-core'].GetPlayerName(client)} deposited $${amount} to account ${account}.`,
        showIdentifiers: false
    });
    return true;
});

onClientCallback('summit_phone:server:withdrawMoney', async (client, amount: number) => {
    const account = await exports['qb-core'].GetPlayerJob(client);
    const balance = await exports.summit_bank.GetBusinessAccountBalance(account);
    if (balance < amount) {
        return false;
    }
    await exports.summit_bank.RemoveMoneyFromBusinessAccount(account, amount);
    await exports['qb-core'].AddMoney(client, 'bank', amount, "Phone Business App Withdraw.");
    Logger.AddLog({
        type: 'phone_business',
        title: 'Money Withdrawn',
        message: `Player ${exports['qb-core'].GetPlayerName(client)} withdrew $${amount} from account ${account}.`,
        showIdentifiers: false
    });
    return true;
});

onClientCallback('summit_phone:server:getEmployees', async (client, data: string) => {
    const src = client;
    const jobname = data;
    const Player = await exports['qb-core'].GetPlayer(src);
    if (!Player.PlayerData.job.isboss) {
        return exports.summit_lib.BanPlayer(src, 'GetEmployees Exploiting', 'summit_lib');
    }

    const players: any = await Utils.query('SELECT citizenid, charinfo, job FROM players WHERE job LIKE ?', [`%${jobname}%`]);
    const employees: any = [];

    for (const data of players) {
        let charData = { firstname: 'Unknown', lastname: 'Player' };
        let jobData = { name: 'Unknown', grade: 0, isboss: false };

        try {
            if (data.charinfo) charData = JSON.parse(data.charinfo);
            if (data.job) jobData = JSON.parse(data.job);
        } catch (e) {
            LOGGER(`Failed to parse Job ${jobname} / charinfo for $ ${data.citizenid}`);
            continue;
        }

        const isOnline = await exports['qb-core'].GetPlayerByCitizenId(data.citizenid);
        if (isOnline && isOnline.PlayerData.job.name === jobname) {
            employees.push({
                empSource: isOnline.PlayerData.citizenid,
                curJob: isOnline.PlayerData.job.name,
                grade: isOnline.PlayerData.job.grade,
                isboss: isOnline.PlayerData.job.isboss,
                name: `${isOnline.PlayerData.charinfo.firstname} ${isOnline.PlayerData.charinfo.lastname}`,
                status: 'online'
            });
        } else {
            employees.push({
                empSource: data.citizenid,
                curJob: jobData.name,
                grade: jobData.grade,
                isboss: jobData.isboss,
                name: `${charData.firstname} ${charData.lastname}`,
                status: 'offline'
            });
        }
    }
    employees.sort((a: any, b: any) => (b.grade.level || 0) - (a.grade.level || 0));

    const multijobEmployees: any[] = [];
    try {
        const multiJobPlayers: any[] = (await MongoDB.findMany('phone_multijobs', { jobName: jobname })) || [];

        for (const multiJob of multiJobPlayers) {
            if (!multiJob.citizenId) {
                console.warn('Skipping invalid multijob entry:', multiJob);
                continue;
            }

            const isOnline = await exports['qb-core'].GetPlayerByCitizenId(multiJob.citizenId);
            if (!isOnline) {
                const playerData: any = await Utils.query('SELECT charinfo, job FROM players WHERE citizenid = ?', [multiJob.citizenId]);
                if (!playerData || playerData.length === 0) {
                    console.warn(`No player data found for offline citizenId ${multiJob.citizenId}`);
                    continue;
                }

                for (const data of playerData) {
                    let jobData, charData;
                    try {
                        jobData = data.job ? JSON.parse(data.job) : { name: 'Unknown', grade: 0, isboss: false };
                        charData = data.charinfo ? JSON.parse(data.charinfo) : { firstname: 'Unknown', lastname: 'Player' };
                    } catch (e) {
                        console.error(`Failed to parse job/charinfo for ${multiJob.citizenId}:`, e);
                        continue;
                    }
                    if (jobData.name === jobname) continue;
                    multijobEmployees.push({
                        empSource: multiJob.citizenId,
                        curJob: jobData.name,
                        grade: jobData.grade,
                        isboss: jobData.isboss,
                        name: `${charData.firstname} ${charData.lastname}`,
                        status: 'offline'
                    });
                }
            } else {
                if (isOnline.PlayerData.job.name === jobname) continue;
                multijobEmployees.push({
                    empSource: isOnline.PlayerData.citizenid,
                    curJob: isOnline.PlayerData.job.name,
                    grade: isOnline.PlayerData.job.grade,
                    isboss: isOnline.PlayerData.job.isboss,
                    name: `${isOnline.PlayerData.charinfo.firstname} ${isOnline.PlayerData.charinfo.lastname}`,
                    status: 'online'
                });
            }
        }
        multijobEmployees.sort((a, b) => (b.grade || 0) - (a.grade || 0));
    } catch (err) {
        console.error('Error processing multijob employees:', err);
    }

    return JSON.stringify({
        employees: employees.length > 0 ? employees : [],
        multijobEmployees: multijobEmployees.length > 0 ? multijobEmployees : []
    });
});


onClientCallback('summit_phone:server:hireEmployee', async (client, targetSource: string, jobname: string) => {
    if (String(client) === String(targetSource)) {
        Logger.AddLog({
            type: 'phone_business',
            title: 'Hire Failed',
            message: `Attempt to hire self Name: ${exports['qb-core'].GetPlayerName(client)}, in Job: ${jobname}`,
            showIdentifiers: false
        });
        return emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `You can't hire yourself.`,
            app: "services",
            timeout: 5000,
        }));
    }
    if (await exports['qb-core'].DoesPlayerExist(targetSource)) {
        const player = await exports['qb-core'].GetPlayer(client);
        if (!player.PlayerData.job.isboss) {
            Logger.AddLog({
                type: 'phone_business',
                title: 'Hire Failed',
                message: `Attempt to hire without being a boss Name: ${exports['qb-core'].GetPlayerName(client)}, in Job: ${jobname}, CitizenId: ${player.PlayerData.citizenid}`,
                showIdentifiers: false
            });
            return emitNet('phone:addnotiFication', client, JSON.stringify({
                id: generateUUid(),
                title: "System",
                description: `You are not a boss.`,
                app: "services",
                timeout: 5000,
            }));
        }
        const targetPlayer = await exports['qb-core'].GetPlayer(targetSource);
        targetPlayer.Functions.SetJob(jobname, 0);
        Logger.AddLog({
            type: 'phone_business',
            title: 'Employee Hired',
            message: `Player ${targetPlayer.PlayerData.citizenid} Name: ${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname} hired by Player: ${exports['qb-core'].GetPlayerName(client)}, in Job: ${jobname}`,
            showIdentifiers: false
        });
        emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `You have hired ${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname} to ${jobname}.`,
            app: "services",
            timeout: 5000,
        }));
        emitNet('phone:addnotiFication', targetSource, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `You have been hired to ${jobname}.`,
            app: "services",
            timeout: 5000,
        }));
        emitNet('summit_phone:client:refreshEmpData', client, jobname);
    } else {
        Logger.AddLog({
            type: 'phone_business',
            title: 'Hire Failed',
            message: `Attempt to hire non-existent player Name: ${exports['qb-core'].GetPlayerName(client)}, in Job: ${jobname}`,
            showIdentifiers: false
        });
        emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `Player is not online.`,
            app: "services",
            timeout: 5000,
        }));
    }
});

onClientCallback('getIndexOfAllJobs', async (client) => {
    const jobs = await MongoDB.findMany('summit_jobs', {});
    return JSON.stringify(jobs.map((job: any) => job._id));
});

onClientCallback('registerJobs', async (client, data: string) => {
    const jobs = JSON.parse(data);
    await MongoDB.insertOne('summit_jobs', jobs);
    const { _id, ...rest } = jobs;
    exports['qb-core'].AddJob(_id, rest);
    Logger.AddLog({
        type: 'phone_jobs',
        title: 'Job Registered',
        message: `New job '${_id}' Name: ${jobs.jobName} registered by Player: ${exports['qb-core'].GetPlayerName(client)}`,
        showIdentifiers: false
    });
});

onClientCallback('getJobData', async (client, data: string) => {
    const job = await MongoDB.findOne('summit_jobs', { _id: data });
    return JSON.stringify(job);
});

onClientCallback('updateJobs', async (client, data: string) => {
    const jobs = JSON.parse(data);
    await MongoDB.updateOne('summit_jobs', { _id: jobs._id }, jobs);
    const { _id, ...rest } = jobs;
    exports['qb-core'].UpdateJob(_id, rest);
    Logger.AddLog({
        type: 'phone_jobs',
        title: 'Job Updated',
        message: `Job '${_id}' Name: ${jobs.jobName} updated by Player: ${exports['qb-core'].GetPlayerName(client)}`,
        showIdentifiers: false
    });
});

onClientCallback('deleteJobs', async (client, data: string) => {
    const job = await MongoDB.findOne('summit_jobs', { _id: data });
    if (!job) {
        Logger.AddLog({
            type: 'summit_jobs',
            title: 'Job Deletion Failed',
            message: `Attempt to delete non-existent job '${data}' by Player: ${exports['qb-core'].GetPlayerName(client)}`,
            showIdentifiers: false
        });
        return emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `Job does not exist.`,
            app: "services",
            timeout: 5000,
        }));
    }
    await MongoDB.deleteOne('summit_jobs', { _id: data });
    exports['qb-core'].RemoveJob(data);
    Logger.AddLog({
        type: 'phone_jobs',
        title: 'Job Deleted',
        message: `Job '${data}' Name: ${job.jobName} deleted by Player: ${exports['qb-core'].GetPlayerName(client)}`,
        showIdentifiers: false
    });
});

onClientCallback('summit_phone:server:getBusinessEmployeesNumbers', async (client: number, job: string) => {
    const [players] = await Framework.Functions.GetPlayersOnDuty(job);
    let numbers: number[] = [];
    for (const player of players) {
        const number = await Utils.GetPhoneNumberBySource(player);
        numbers.push(Number(number));
    }
    return JSON.stringify(numbers);
})