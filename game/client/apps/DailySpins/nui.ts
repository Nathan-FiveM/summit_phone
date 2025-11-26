const DAILY_SPIN_RETURN_EVENT = "dailySpin:returnState";

let pendingStateCallback: ((payload: string) => void) | null = null;

onNet(DAILY_SPIN_RETURN_EVENT, (data: unknown) => {
    if (!pendingStateCallback) return;

    pendingStateCallback(JSON.stringify(data));
    pendingStateCallback = null;
});

RegisterNuiCallbackType("dailySpin:getState");
on("__cfx_nui:dailySpin:getState", (_data: unknown, cb: (response: string) => void) => {
    pendingStateCallback = cb;
    emitNet("dailySpin:getStateServer");
});

RegisterNuiCallbackType("dailySpin:claim");
on("__cfx_nui:dailySpin:claim", (_data: unknown, cb: (response: string) => void) => {
    emitNet("dailySpin:claimServer");
    cb("ok");
});

RegisterNuiCallbackType("dailySpin:reward");
on("__cfx_nui:dailySpin:reward", (data: { id?: number }, cb: (response: string) => void) => {
    if (data?.id === undefined) {
        cb("error");
        return;
    }

    emitNet("dailySpin:rewardServer", data.id);
    cb("ok");
});

RegisterNuiCallbackType("dailySpin:sell");
on("__cfx_nui:dailySpin:sell", (data: { id?: number }, cb: (response: string) => void) => {
    if (data?.id === undefined) {
        cb("error");
        return;
    }

    // Selling is disabled; treat sell as collect
    emitNet("dailySpin:rewardServer", data.id);
    cb("ok");
});
