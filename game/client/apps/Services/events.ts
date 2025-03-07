import { FrameWork } from '@client/cl_main';
import { NUI } from '@client/classes/NUI';
import { inputDialog, triggerServerCallback, registerContext, showContext, hideContext, onServerCallback } from '@overextended/ox_lib/client';
import { generateUUid } from '@shared/utils';

RegisterCommand('registerBusiness', async (source: any, args: any[]) => {
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

RegisterCommand('updateBusiness', async (source: any, args: any[]) => {
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

RegisterCommand('deleteBusiness', async (source: any, args: any[]) => {
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
})

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
})