RegisterNuiCallbackType('phone:call');
on('__cfx_nui:phone:call', async (data: string, cb: Function) => {
    console.log('call', data);
    cb(true);
});