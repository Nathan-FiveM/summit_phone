
onNet('phone:server:declineCall', async (notiId: string) => {
    const source = global.source;
    emitNet('phone:client:declineCall', source, notiId);
});

onNet('phone:server:acceptCall', async (notiId: string) => {
    const source = global.source;
    emitNet('phone:client:acceptCall', source, notiId);
});

on('onResourceStop', async (resource: string) => {
    if (resource === GetCurrentResourceName()) {

    }
});