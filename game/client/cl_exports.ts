import { generateUUid } from "@shared/utils";
import { NUI } from "./classes/NUI";

function ForceFullyClosePhone() {
    if (LocalPlayer.state.onPhone) {
        NUI.closeUI();
    }
}
exports("ForceClosePhone", ForceFullyClosePhone);

function ToggleDisablePhone(should: boolean) {
    NUI.shouldNotOpen = should;
    LocalPlayer.state.set('phoneDisabled', should, true);
}
exports("ToggleDisablePhone", ToggleDisablePhone);

function CloseAndToggleDisablePhone(should: boolean) {
    ToggleDisablePhone(should);
    ForceFullyClosePhone();
}
exports("CloseAndToggleDisablePhone", CloseAndToggleDisablePhone);

exports('sendNotification', (data: string) => {
    const notiData: {
        id: string,
        title: string,
        description: string,
        app: string,
        timeout: number
    } = JSON.parse(data);
    NUI.sendReactMessage('addNotification', notiData);
});

exports('sendActionNotification', (data: string) => {
    const notiData: {
        id: string,
        title: string,
        description: string,
        app: string,
        icons: {
            "0": {
                icon: string,
                isServer: boolean,
                event: string,
                args:any
            },
            "1": {
                icon: string,
                isServer: boolean,
                event: string,
                args:any
            }
        }
    } = JSON.parse(data);
    NUI.sendReactMessage('addActionNotification', notiData);
});