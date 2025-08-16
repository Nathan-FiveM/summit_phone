import { FrameWork } from '@client/cl_main';
import { NUI } from '@client/classes/NUI';
import { JobData } from '../../../../types/types';
import { inputDialog, triggerServerCallback, registerContext, showContext, hideContext, onServerCallback } from '@overextended/ox_lib/client';
import { generateUUid } from '@shared/utils';

RegisterCommand('registerBusiness', async (source: any, args: any[]) => {
    if (!await exports['snipe-menu'].isAdmin()) return;
    const input = await inputDialog('Register New Business', [
        {
            label: 'Owner Citizen ID',
            type: 'input',
            placeholder: 'Enter Owner Citizen ID',
            required: true,
        },
        {
            label: 'Business Name',
            type: 'input',
            placeholder: 'Enter Business Name',
            required: true,
        },
        {
            label: 'Business Description',
            //@ts-ignore
            type: 'textarea',
            placeholder: 'Enter Business Description',
            required: true,
        },
        {
            label: 'Business Type',
            type: 'multi-select',
            default: 'other',
            options: [
                { value: 'restaurant', label: 'Restaurant' },
                { value: 'bar', label: 'Bar' },
                { value: 'club', label: 'Club' },
                { value: 'hotel', label: 'Hotel' },
                { value: 'grocery', label: 'Grocery' },
                { value: 'pharmacy', label: 'Pharmacy' },
                { value: 'hardware', label: 'Hardware' },
                { value: 'jewelry', label: 'Jewelry' },
                { value: 'furniture', label: 'Furniture' },
                { value: 'auto', label: 'Auto' },
                { value: 'real_estate', label: 'Real Estate' },
                { value: 'construction', label: 'Construction' },
                { value: 'medical', label: 'Medical' },
                { value: 'salon', label: 'Salon' },
                { value: 'tattoo', label: 'Tattoo' },
                { value: 'taxi', label: 'Taxi' },
                { value: 'clothing', label: 'Clothing' },
                { value: 'electronics', label: 'Electronics' },
                { value: 'services', label: 'Services' },
                { value: 'other', label: 'Other' },
            ],
            required: true,
        },
        {
            label: 'If Other, Please Specify',
            type: 'input',
            placeholder: 'Enter Business Type',
            required: false,
        },
        {
            label: "Business Logo",
            type: 'input',
            placeholder: 'Enter Business Logo URL',
            required: false,
        },
        {
            label: 'Business/Owner Phone Number',
            type: 'number',
            placeholder: 'Enter Business/Owner Phone Number',
            required: true,
        },
        {
            label: 'Business Address',
            //@ts-ignore
            type: 'textarea',
            placeholder: 'Enter Business Address',
            required: true,
        },
        {
            label: 'Generate Business Email',
            type: 'select',
            default: 'true',
            options: [
                { value: 'true', label: 'True' },
                { value: 'false', label: 'False' },
            ],
            required: true,
        },
        {
            label: 'Coords',
            type: 'input',
            placeholder: 'Enter Coords',
            required: true,
        },
        {
            label: 'Business Email',
            type: 'input',
            placeholder: 'Enter Business Email',
            required: false,
        },
        {
            label: 'Business Password',
            type: 'input',
            placeholder: 'Enter Business Password',
            required: false,
        },
        {
            label: 'Job variable',
            type: 'input',
            placeholder: 'Enter job variable',
            required: true,
        },
    ], {}).then(async (res: any) => {
        const ownerCitizenId = res[0];
        const businessName = res[1];
        const businessDescription = res[2];
        const businessType = res[3] ? res[3] : res[4].split(' ');
        const businessLogo = res[5];
        const businessPhoneNumber = res[6];
        const businessAddress = res[7];
        const generateBusinessEmail = res[8] === 'true' ? true : false;
        const coords = res[9];
        const businessEmail = res[10];
        const businessPassword = res[11];
        const job = res[12];

        await triggerServerCallback('RegisterNewBusiness', 1, JSON.stringify({
            ownerCitizenId,
            businessName,
            businessDescription,
            businessType,
            businessLogo,
            businessPhoneNumber,
            businessAddress,
            generateBusinessEmail,
            coords: {
                x: coords.split(',')[0],
                y: coords.split(',')[1],
                z: coords.split(',')[2],
            },
            businessEmail,
            businessPassword,
            job
        }));
    });
}, true);
emit('chat:addSuggestion', '/registerBusiness', 'Register a New Business.', []);

RegisterCommand('updateBusiness', async (source: any, args: any[]) => {
    if (!await exports['snipe-menu'].isAdmin()) return;
    const businessNames = await triggerServerCallback('getBusinessNames', 1);
    const parsedBusinessNames = JSON.parse(businessNames as string);
    registerContext({
        id: 'updateBusinessMenu',
        title: 'Select Business to Update',
        options: [
            ...parsedBusinessNames.map((businessName: string) => {
                return {
                    title: businessName,
                    onSelect: async () => {
                        emit('phone:client:updateBusiness', businessName);
                        hideContext(true);
                    }
                }
            })
        ]
    })
    showContext('updateBusinessMenu');
}, true);
emit('chat:addSuggestion', '/updateBusiness', 'Update Business Details which is already registerd.', []);

RegisterCommand('deleteBusiness', async (source: any, args: any[]) => {
    if (!await exports['snipe-menu'].isAdmin()) return;
    const businessNames = await triggerServerCallback('getBusinessNames', 1);
    const parsedBusinessNames = JSON.parse(businessNames as string);
    registerContext({
        id: 'deleteBusinessMenu',
        title: 'Select Business to Delete',
        options: [
            ...parsedBusinessNames.map((businessName: string) => {
                return {
                    title: businessName,
                    onSelect: async () => {
                        await triggerServerCallback('deleteBusiness', 1, businessName);
                        hideContext(true);
                    }
                }
            })
        ]
    })
    showContext('deleteBusinessMenu');
}, true);
emit('chat:addSuggestion', '/deleteBusiness', 'Delete Business which is Registerd.', []);

on('phone:client:updateBusiness', async (name: string) => {
    const selectedBusiness = name;
    const data = await triggerServerCallback('getBusinessData', 1, name);
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
        job,
        businessEmail
    } = JSON.parse(data as string);

    const input = await inputDialog('Update Business', [
        {
            label: 'Owner Citizen ID',
            type: 'input',
            placeholder: 'Enter Owner Citizen ID',
            default: ownerCitizenId,
            required: true,
        },
        {
            label: 'Business Name',
            type: 'input',
            placeholder: 'Enter Business Name',
            default: businessName,
            required: true,
        },
        {
            label: 'Business Description',
            //@ts-ignore
            type: 'textarea',
            placeholder: 'Enter Business Description',
            default: businessDescription,
            required: true,
        },
        {
            label: 'Business Type',
            type: 'multi-select',
            default: businessType,
            options: [
                { value: 'restaurant', label: 'Restaurant' },
                { value: 'bar', label: 'Bar' },
                { value: 'club', label: 'Club' },
                { value: 'hotel', label: 'Hotel' },
                { value: 'grocery', label: 'Grocery' },
                { value: 'pharmacy', label: 'Pharmacy' },
                { value: 'hardware', label: 'Hardware' },
                { value: 'jewelry', label: 'Jewelry' },
                { value: 'furniture', label: 'Furniture' },
                { value: 'auto', label: 'Auto' },
                { value: 'real_estate', label: 'Real Estate' },
                { value: 'construction', label: 'Construction' },
                { value: 'medical', label: 'Medical' },
                { value: 'salon', label: 'Salon' },
                { value: 'tattoo', label: 'Tattoo' },
                { value: 'taxi', label: 'Taxi' },
                { value: 'clothing', label: 'Clothing' },
                { value: 'electronics', label: 'Electronics' },
                { value: 'services', label: 'Services' },
                { value: 'other', label: 'Other' },
            ],
            required: true,
        },
        {
            label: 'If Other, Please Specify',
            type: 'input',
            placeholder: 'Enter Business Type',
            default: '',
            required: false,
        },
        {
            label: "Business Logo",
            type: 'input',
            placeholder: 'Enter Business Logo URL',
            default: businessLogo,
            required: false,
        },
        {
            label: 'Business/Owner Phone Number',
            type: 'number',
            placeholder: 'Enter Business/Owner Phone Number',
            default: businessPhoneNumber,
            required: true,
        },
        {
            label: 'Business Address',
            //@ts-ignore
            type: 'textarea',
            placeholder: 'Enter Business Address',
            default: businessAddress,
            required: true,
        },
        {
            label: 'Generate Business Email',
            type: 'select',
            default: generateBusinessEmail ? 'true' : 'false',
            options: [
                { value: 'true', label: 'True' },
                { value: 'false', label: 'False' },
            ],
            required: true,
        },
        {
            label: 'Coords',
            type: 'input',
            placeholder: 'Enter Coords',
            default: `${coords.x},${coords.y},${coords.z}`,
            required: true,
        },
        {
            label: 'job variable',
            type: 'input',
            placeholder: 'Enter job variable',
            required: true,
            default: job,
        },
        {
            label: 'Business Email',
            type: 'input',
            placeholder: 'Enter Business Email',
            required: false,
            default: businessEmail
        },
    ], {}).then(async (res: any) => {
        const ownerCitizenId = res[0];
        const businessName = res[1];
        const businessDescription = res[2];
        const businessType = res[3] ? res[3] : res[4];
        const businessLogo = res[5];
        const businessPhoneNumber = res[6];
        const businessAddress = res[7];
        const generateBusinessEmail = res[8] === 'true' ? true : false;
        const coords = res[9];
        const job = res[10];
        const businessEmail = res[11];

        await triggerServerCallback('UpdateBusiness', 1, JSON.stringify({
            selectedBusiness,
            ownerCitizenId,
            businessName,
            businessDescription,
            businessType,
            businessLogo,
            businessPhoneNumber,
            businessAddress,
            generateBusinessEmail,
            coords: {
                x: coords.split(',')[0],
                y: coords.split(',')[1],
                z: coords.split(',')[2],
            },
            job,
            businessEmail
        }));
    });
});

onServerCallback('summit_phone:client:businessCall', async (number: string) => {
    const res = await triggerServerCallback('summit_phone:server:call', 1, JSON.stringify({ number: number, _id: generateUUid() }));
});

onNet('summit_phone:client:refreshEmpData', async (data: string) => {
    const employees: any = await triggerServerCallback('summit_phone:server:getEmployees', 1, data);
    NUI.sendReactMessage('updateEmployees', employees);
    NUI.sendReactMessage('phone:contextMenu:close', {});
});

on('summit_phone:server:promoteEmployee', (targetCitizenid: string) => {
    const PlayerData = FrameWork.Functions.GetPlayerData();
    const jobName = PlayerData.job.name;
    const grades = FrameWork.Shared.Jobs[jobName].grades;
    let sendingData: any = [];
    Object.values(grades).forEach((grade: any, key: any) => {
        if (key === 0) return;
        sendingData.push({
            name: grade.name,
            event: 'summit_phone:server:changeRankOfPlayer',
            isServer: true,
            args: { targetCitizenid, key, jobName, gradeName: grade.name }
        })
    });
    NUI.sendReactMessage('phone:contextMenu', sendingData);
});

let businessData: { [key: string]: any } = {};
const grades: any[] = [];

interface InputField {
    label: string;
    type: string;
    placeholder?: string;
    required: boolean;
    default?: string;
    options?: { value: string; label: string }[];
}

RegisterCommand('registerJobs', async (source: any, args: any[]) => {
    if (!await exports['snipe-menu'].isAdmin()) return;
    const numberOfRanks = Number(args[0]);

    const inputData: InputField[] = [
        {
            label: 'Job Name',
            type: 'input',
            placeholder: "It's a Variable to set the Jobs",
            required: true,
        },
        {
            label: "Job Label",
            type: 'input',
            placeholder: 'Enter Job Label',
            required: true
        },
        {
            label: "Default Duty",
            type: 'select',
            default: 'false',
            options: [
                { value: 'true', label: 'On Duty' },
                { value: 'false', label: 'Off Duty' },
            ],
            required: true
        },
        {
            label: "Should Players Get OffDuty PayChecks?",
            type: 'select',
            default: 'false',
            options: [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
            ],
            required: true
        },
        {
            label: "What is the type of Job?",
            type: 'input',
            placeholder: 'Enter Job Type (leo, civ, ...)',
            required: true
        }
    ];

    const gradesData: InputField[] = Array.from({ length: numberOfRanks }, (_, i) => {
        const gradeNum = i + 1;
        return [
            {
                label: `Grade ${gradeNum} Label`,
                type: 'input',
                placeholder: `Enter Grade ${gradeNum} Label`,
                required: true
            },
            {
                label: `Grade ${gradeNum} Payment`,
                type: 'number',
                placeholder: `Enter Grade ${gradeNum} Payment`,
                required: true
            },
            {
                label: `Grade ${gradeNum} isBoss`,
                type: 'select',
                default: 'false',
                options: [
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                ],
                required: true
            },
            {
                label: `Grade ${gradeNum} isBankAuth`,
                type: 'select',
                default: 'false',
                options: [
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                ],
                required: true
            }
        ];
    }).flat();

    try {
        //@ts-ignore
        const jobInput: any = await inputDialog('Register New Jobs', inputData, {});
        const jobName = jobInput[0];
        const jobLabel = jobInput[1];
        const defaultDuty = jobInput[2] === 'true';
        const offDutyPaychecks = jobInput[3] === 'true';
        const jobType = jobInput[4];

        businessData[jobName] = {
            _id: jobName,
            label: jobLabel,
            defaultDuty: defaultDuty,
            offDutyPay: offDutyPaychecks,
            type: jobType,
            grades: {}
        };

        //@ts-ignore
        const gradesInput: any = await inputDialog('Register Grades', gradesData, {});

        // Process grades data - each grade has 4 fields
        for (let i = 0; i < numberOfRanks; i++) {
            const baseIndex = i * 4;
            const gradeLabel = gradesInput[baseIndex];
            const gradePayment = Number(gradesInput[baseIndex + 1]);
            const isBoss = gradesInput[baseIndex + 2] === 'true';
            const isBankAuth = gradesInput[baseIndex + 3] === 'true';

            businessData[jobName].grades[i] = {
                name: gradeLabel,
                payment: gradePayment,
                isBoss: isBoss,
                isBankAuth: isBankAuth
            };
        }

        await triggerServerCallback('registerJobs', 1, JSON.stringify(businessData[jobName]));
    } catch (error) {
        console.error('Error registering job:', error);
    }
}, true);

emit('chat:addSuggestion', '/registerJobs', 'First Register the Job, Before Registering Business.', [{
    name: "Number of Ranks",
    help: "Enter Number of Ranks"
}]);

RegisterCommand('updateJobs', async (source: any, args: any[]) => {
    if (!await exports['snipe-menu'].isAdmin()) return;
    const jobName = String(args[0]);
    const jobData = await triggerServerCallback('getJobData', 1, jobName);
    const parsedData: JobData = JSON.parse(jobData as string);

    const inputData: InputField[] = [
        {
            label: 'Job Name',
            type: 'input',
            placeholder: "It's a Variable to set the Jobs",
            required: true,
            default: parsedData._id,
        },
        {
            label: "Job Label",
            type: 'input',
            placeholder: 'Enter Job Label',
            required: true,
            default: parsedData.label
        },
        {
            label: "Default Duty",
            type: 'select',
            default: parsedData.defaultDuty ? 'true' : 'false',
            options: [
                { value: 'true', label: 'On Duty' },
                { value: 'false', label: 'Off Duty' },
            ],
            required: true
        },
        {
            label: "Should Players Get OffDuty PayChecks?",
            type: 'select',
            default: parsedData.offDutyPay ? 'true' : 'false',
            options: [
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
            ],
            required: true
        },
        {
            label: "What is the type of Job?",
            type: 'input',
            placeholder: 'Enter Job Type (leo, civ, ...)',
            required: true,
            default: parsedData.type
        }
    ];
    const gradesData: any = Object.values(parsedData.grades).map((grade, i) => {
        return [
            {
                label: `Grade ${i + 1} Label`,
                type: 'input',
                placeholder: `Enter Grade ${i + 1} Label`,
                required: true,
                default: grade.name
            },
            {
                label: `Grade ${i + 1} Payment`,
                type: 'number',
                placeholder: `Enter Grade ${i + 1} Payment`,
                required: true,
                default: grade.payment
            },
            {
                label: `Grade ${i + 1} isBoss`,
                type: 'select',
                default: grade.isBoss ? 'true' : 'false',
                options: [
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                ],
                required: true
            },
            {
                label: `Grade ${i + 1} isBankAuth`,
                type: 'select',
                default: grade.isBankAuth ? 'true' : 'false',
                options: [
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                ],
                required: true
            }
        ];
    }).flat();

    try {
        //@ts-ignore
        const jobInput: any = await inputDialog('Update Jobs', inputData, {});
        const jobName = jobInput[0];
        const jobLabel = jobInput[1];
        const defaultDuty = jobInput[2] === 'true';
        const offDutyPaychecks = jobInput[3] === 'true';
        const jobType = jobInput[4];

        businessData[jobName] = {
            _id: jobName,
            label: jobLabel,
            defaultDuty: defaultDuty,
            offDutyPay: offDutyPaychecks,
            type: jobType,
            grades: {}
        };

        //@ts-ignore
        const gradesInput: any = await inputDialog('Update Grades', gradesData, {});

        // Process grades data - each grade has 4 fields
        for (let i = 0; i < gradesInput.length; i += 4) {
            const gradeLabel = gradesInput[i];
            const gradePayment = Number(gradesInput[i + 1]);
            const isBoss = gradesInput[i + 2] === 'true';
            const isBankAuth = gradesInput[i + 3] === 'true';

            businessData[jobName].grades[i / 4] = {
                name: gradeLabel,
                payment: gradePayment,
                isBoss: isBoss,
                isBankAuth: isBankAuth
            };
        }

        await triggerServerCallback('updateJobs', 1, JSON.stringify(businessData[jobName]));
    } catch (error) {
        console.error('Error updating job:', error);
    }
}, true);

emit('chat:addSuggestion', '/updateJobs', 'Update the Job Details.', [{
    name: "Job Name",
    help: "Enter Job Name"
}]);

RegisterCommand('deleteJobs', async (source: any, args: any[]) => {
    if (!await exports['snipe-menu'].isAdmin()) return;
    const res = await triggerServerCallback('getIndexOfAllJobs', 1);
    const parsedData = JSON.parse(res as string);
    registerContext({
        id: 'deleteJobsMenu',
        title: 'Select Job to Delete',
        options: [
            ...parsedData.map((jobName: string) => {
                return {
                    title: jobName,
                    onSelect: async () => {
                        await triggerServerCallback('deleteJobs', 1, jobName);
                        hideContext(true);
                    }
                }
            })
        ]
    })
    showContext('deleteJobsMenu');
}, true);

emit('chat:addSuggestion', '/deleteJobs', 'Delete the Job.', []);


on('summit_phone:server:businessCall', async (number: number) => {
    NUI.sendReactMessage('phone:contextMenu:close', {});
    emit("phone:addnotiFication", JSON.stringify({
        id: generateUUid(),
        title: "System",
        description: `Calling business`,
        app: "settings",
        timeout: 2000,
    }));
    const res = await triggerServerCallback('summit_phone:server:businessCall', 1, JSON.stringify({ number: String(number), _id: generateUUid() }));
});