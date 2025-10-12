import { generateUUid } from "@shared/utils";
import { NUI } from "./classes/NUI";
import { Utils } from "./classes/Utils";

function ForceFullyClosePhone() {
    if (LocalPlayer.state.onPhone) {
        NUI.closeUI();
    }
}
exports("ForceClosePhone", ForceFullyClosePhone);

export function ToggleDisablePhone(should: boolean) {
    NUI.shouldNotOpen = should;
    LocalPlayer.state.set('phoneDisabled', should, true);
}
exports("ToggleDisablePhone", ToggleDisablePhone);

export function CloseAndToggleDisablePhone(should: boolean) {
    ToggleDisablePhone(should);
    ForceFullyClosePhone();
}
exports("CloseAndToggleDisablePhone", CloseAndToggleDisablePhone);

exports('sendNotification', (data: {
    id: string | number,
    title: string,
    description: string,
    app: string,
    timeout: number
}) => {
    const phoneItem = Utils.GetPhoneItem();
    if (!phoneItem) {
        emit("QBCore:Notify", "No phone item found", "error");
        return;
    };
    NUI.sendReactMessage('addNotification', data);
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
                args: any
            },
            "1": {
                icon: string,
                isServer: boolean,
                event: string,
                args: any
            }
        }
    } = JSON.parse(data);
    NUI.sendReactMessage('addActionNotification', notiData);
});