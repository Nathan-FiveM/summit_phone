import { MongoDB } from "@server/sv_main";
import { generateUUid } from "@shared/utils";

/* RegisterCommand('addContact', async (source: number, args: string[]) => {
    const data = [
        {
            _id: generateUUid(),
            personalNumber: '7123485245',
            contactNumber: "4589687231",
            firstName: "Vector",
            lastName: "Shaw",
            image: "https://i.imgur.com/0byX5s9.png",
            ownerId: "BKT75289",
            notes: "This is a test note",
            email: "vector.shaw@smrt.com"
        },
        {
            _id: generateUUid(),
            personalNumber: '7123485245',
            contactNumber: "4526668793",
            firstName: "Anish",
            lastName: "Test",
            image: "https://i.imgur.com/0byX5s9.png",
            ownerId: "BKT75289",
            notes: "This is a test note",
            email: "anish.test@smrt.com"
        },
        {
            _id: generateUUid(),
            personalNumber: '7123485245',
            contactNumber: "1123654789",
            firstName: "Arsanto",
            lastName: "TestX",
            image: "https://i.imgur.com/0byX5s9.png",
            ownerId: "BKT75289",
            notes: "This is a test note",
            email: "arsanto.test@smrt.com"
        },
        {
            _id: generateUUid(),
            personalNumber: '7123485245',
            contactNumber: "1",
            firstName: "Ben",
            lastName: "Baker",
            image: "https://i.imgur.com/0byX5s9.png",
            ownerId: "BKT75289",
            notes: "This is a test note",
            email: "ben.baker@smrt.com"
        },
        {
            _id: generateUUid(),
            personalNumber: '7123485245',
            contactNumber: "123",
            firstName: "Grant",
            lastName: "Carter",
            image: "https://i.imgur.com/0byX5s9.png",
            ownerId: "BKT75289",
            notes: "This is a test note",
            email: "grantdecker@smrt.com"
        },
        {
            _id: generateUUid(),
            personalNumber: '7123485245',
            contactNumber: "12",
            firstName: "Deep",
            lastName: "Glimpse",
            image: "https://i.imgur.com/0byX5s9.png",
            ownerId: "BKT75289",
            notes: "This is a test note",
            email: "deep.glipmse@smrt.com"
        },
        {
            _id: generateUUid(),
            personalNumber: '7123485245',
            contactNumber: "1234",
            firstName: "Dolly",
            lastName: "TestX",
            image: "https://i.imgur.com/0byX5s9.png",
            ownerId: "BKT75289",
            notes: "This is a test note",
            email: "Dolly.testx@smrt.com"
        },
        {
            _id: generateUUid(),
            personalNumber: '7123485245',
            contactNumber: "889511",
            firstName: "Minty",
            lastName: "Test",
            image: "https://i.imgur.com/0byX5s9.png",
            ownerId: "BKT75289",
            notes: "This is a test note",
            email: "minty.test@smrt.com"
        }

    ]
    MongoDB.insertMany('phone_contacts', data);
}, false); */


on('onResourceStop', async (resource: string) => {
    if (resource === GetCurrentResourceName()) {

    }
});