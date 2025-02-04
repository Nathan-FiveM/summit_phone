import { onClientCallback } from "@overextended/ox_lib/server";

onClientCallback('summit_phone:server:call', async (source: number, data: string) => {
    const res : {
        number:string,
        _id:string,
    } = JSON.parse(data);

    console.log(res);
    return true;
});