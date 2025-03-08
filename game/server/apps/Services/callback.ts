import { onClientCallback, triggerClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

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
});

onClientCallback('getBusinessData', async (client, data: string) => {
    const business = await MongoDB.findOne('phone_business', { businessName: data });
    return JSON.stringify(business);
});
onClientCallback('getAllBusinessData', async (client, data: string) => {
    const businesses = await MongoDB.findMany('phone_business', {});
    return JSON.stringify(businesses);
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
});

onClientCallback('deleteBusiness', async (client, data: string) => {
    const business = await MongoDB.findOne('phone_business', { businessName: data });
    if (!business) {
        return emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `Business with name ${data} does not exist.`,
            app: "services",
            timeout: 5000,
        }));
    }

    await MongoDB.deleteOne('phone_business', { businessName: data });
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

onClientCallback('summit_phone:server:businessCall', async (client, data: string) => {
    const { number } = JSON.parse(data);
    const citizenid = await Utils.GetCitizenIdByPhoneNumber(number);
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
    const balance = await exports.summit_banking.getAccountMoney(account);
    return balance;
});

onClientCallback('summit_phone:server:depositMoney', async (client, amount: number) => {
    const account = await exports['qb-core'].GetPlayerJob(client);
    const bankbalance = await exports['qb-core'].GetMoney(client, 'bank');
    if (bankbalance < amount) {
        return false;
    }
    await exports['qb-core'].RemoveMoney(client, 'bank', amount, "Phone Business App Deposit.");
    await exports.summit_banking.addAccountMoney(account, amount);
    return true;
});

onClientCallback('summit_phone:server:withdrawMoney', async (client, amount: number) => {
    const account = await exports['qb-core'].GetPlayerJob(client);
    const balance = await exports.summit_banking.getAccountMoney(account);
    if (balance < amount) {
        return false;
    }
    await exports.summit_banking.removeAccountMoney(account, amount);
    await exports['qb-core'].AddMoney(client, 'bank', amount, "Phone Business App Withdraw.");
    return true;
});

onClientCallback('summit_phone:server:getEmployees', async (client, data: string) => {
    const src = source;
    const jobname = data;
    const Player = await exports['qb-core'].GetPlayer(src);
    if (!Player.PlayerData.job.isboss) {
        return exports.summit_lib.BanPlayer(src, 'GetEmployees Exploiting', 'summit_lib');
    }
    const players: any = await Utils.query('SELECT citizenid, charinfo, job FROM players WHERE job LIKE ?', [`%${jobname}%`]);
    const employees: any = [];
    for (const data of players) {
        const isOline = await exports['qb-core'].GetPlayerByCitizenId(data.citizenid);
        if (isOline && isOline.PlayerData.job.name == jobname) {
            employees.push({
                empSource: isOline.PlayerData.citizenid,
                curJob: isOline.PlayerData.job.name,
                grade: isOline.PlayerData.job.grade,
                isboss: isOline.PlayerData.job.isboss,
                name: `${isOline.PlayerData.charinfo.firstname} ${isOline.PlayerData.charinfo.lastname}`,
                status: 'online'
            });
        } else {
            employees.push({
                empSource: data.citizenid,
                curJob: JSON.parse(data.job).name,
                grade: JSON.parse(data.job).grade,
                isboss: JSON.parse(data.job).isboss,
                name: `${JSON.parse(data.charinfo).firstname} ${JSON.parse(data.charinfo).lastname}`,
                status: 'offline'
            });
        }
        employees.sort((a: any, b: any) => a.grade.level > b.grade.level);
    }


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
                const playerData: any = await Utils.query(
                    'SELECT charinfo, job FROM players WHERE citizenid = ?',
                    [multiJob.citizenId]
                );
                if (!playerData || playerData.length === 0) {
                    console.warn(`No player data found for offline citizenId ${multiJob.citizenId}`);
                    continue;
                }

                for (const data of playerData) {
                    let jobData, charData;
                    try {
                        jobData = JSON.parse(data.job);
                        charData = JSON.parse(data.charinfo);
                    } catch (e) {
                        console.error(`Failed to parse job/charinfo for ${multiJob.citizenId}:`, e);
                        continue;
                    }
                    if (jobData.name === jobname) continue; // Skip if this is their current job
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
                if (isOnline.PlayerData.job.name === jobname) continue; // Skip if already counted
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
        multijobEmployees.sort((a, b) => (b.grade?.level || 0) - (a.grade?.level || 0));
    } catch (err) {
        console.error('Error processing multijob employees:', err);
    }

    // Combine and return data
    const result = {
        employees: employees.length > 0 ? employees : [],
        multijobEmployees: multijobEmployees.length > 0 ? multijobEmployees : []
    };

    return JSON.stringify(result);
});

onClientCallback('summit_phone:server:hireEmployee', async (client, targetSource: string, jobname: string) => {
    if (String(client) === String(targetSource)) {
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
            return emitNet('phone:addnotiFication', client, JSON.stringify({
                id: generateUUid(),
                title: "System",
                description: `You are not a boss.`,
                app: "services",
                timeout: 5000,
            }));
        }
        const targetPlayer = await exports['qb-core'].GetPlayer(targetSource);
        const multiJobCheck = await MongoDB.findOne('phone_multijobs', { citizenId: targetPlayer.PlayerData.citizenid, jobName: jobname });
        if (!multiJobCheck) {
            await MongoDB.insertOne('phone_multijobs', { _id: generateUUid(), citizenId: targetPlayer.PlayerData.citizenid, jobName: jobname, gradeLevel: 1 });
        }
        targetPlayer.Functions.SetJob(jobname, 1);
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
        emitNet('phone:addnotiFication', client, JSON.stringify({
            id: generateUUid(),
            title: "System",
            description: `Player is not online.`,
            app: "services",
            timeout: 5000,
        }));
    }
});