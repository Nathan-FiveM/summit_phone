import { Animation } from "./Animation";
import { Utils } from "./Utils";


export class NU {
    private timetick: any;
    private controlsLoop: any;
    public shouldNotOpen: boolean = false;
    public disableControls = false;
    private isLooprunnig = false;
    public disableSelectedControls = false;

    public async init() {
        RegisterCommand('phoneopen', () => {
            if (this.shouldNotOpen) return;
            const phoneItem = Utils.GetPhoneItem();
            if (Utils.phoneList.includes(phoneItem)) {
                this.openUI(`prop_aphone_${phoneItem.split('_')[0]}`);
            }
        }, false);
        RegisterCommand('phoneclose', () => {
            this.closeUI();
        }, false);
        RegisterCommand('+toggleNuiFocus', () => {
            const state = LocalPlayer.state;
            if (!state.onPhone) return;

            if (IsNuiFocused()) {
                SetNuiFocus(false, false);
            } else {
                SetNuiFocus(true, true);
            }

            setTimeout(() => {
                if (!state.onPhone && IsNuiFocused()) {
                    SetNuiFocus(false, false);
                }
            }, 1000);
        }, false);
        RegisterKeyMapping('phoneopen', 'Open Phone', 'keyboard', 'M');
        RegisterKeyMapping('+toggleNuiFocus', 'Toggle NUI Focus', 'keyboard', 'LMENU');
    };

    public async openUI(phoneItem: string) {
        const state = LocalPlayer.state;
        if (state.onPhone) return;
        state.set('onPhone', true, true);
        SetCursorLocation(0.89, 0.6);
        this.startTimeLoop();
        this.startDisableControlsLoop();
        this.sendReactMessage('setVisible', { show: true, color: Utils.GetPhoneItem().split('_')[0] });
        this.sendReactMessage("setCursor", { show: true, color: Utils.GetPhoneItem().split('_')[0] });
        SetNuiFocus(true, true);
        SetNuiFocusKeepInput(true);
        Animation.StatAnimation(phoneItem);
    };

    public closeUI() {
        SetNuiFocus(false, false);
        Animation.EndAnimation();
        this.sendReactMessage('setVisible', { show: false, color: Utils.GetPhoneItem().split('_')[0] });
        this.sendReactMessage("setCursor", { show: false, color: Utils.GetPhoneItem().split('_')[0] });
        this.stopTimeLoop();
        this.stopDisableControlsLoop();
        Utils.phonesArray = "";
        setTimeout(() => {
            const state = LocalPlayer.state;
            state.set('onPhone', false, true);
        }, 500)
    };

    public sendReactMessage(action: string, data: object | boolean | string | number) {
        SendNuiMessage(
            JSON.stringify({
                action: action,
                data: data,
            })
        );
    }

    public startTimeLoop() {
        this.timetick = setTick(() => {
            const hours = GetClockHours();
            const minutes = GetClockMinutes();
            this.sendReactMessage('sendTime', `${hours}:${minutes}`);
        });
    };

    public stopTimeLoop() {
        clearTick(this.timetick);
    };

    public startDisableControlsLoop() {

        SetPauseMenuActive(false);

        this.controlsLoop = setTick(() => {
            if (IsNuiFocused()) {
                DisableControlAction(0, 1, true);
                DisableControlAction(0, 2, true);
            }
            DisableControlAction(0, 24, true);
            DisableControlAction(0, 257, true);
            DisableControlAction(0, 25, true);
            DisableControlAction(0, 263, true);
            DisableControlAction(0, 140, true);
            DisableControlAction(0, 141, true);
            DisableControlAction(0, 142, true);
            DisableControlAction(0, 143, true);

            DisableControlAction(2, 199, true);
            DisableControlAction(2, 200, true);

            DisableControlAction(0, 44, true);
            DisableControlAction(0, 45, true);

            DisableControlAction(0, 75, true);

            DisableControlAction(0, 81, true);
            DisableControlAction(0, 82, true);
            DisableControlAction(0, 83, true);
            DisableControlAction(0, 84, true);
            DisableControlAction(0, 85, true);
            DisableControlAction(0, 332, true);
            DisableControlAction(0, 333, true);

            DisablePlayerFiring(PlayerId(), true);

            if (this.disableControls) {
                DisableAllControlActions(2);
                EnableControlAction(0, 249, true);
            }

            if (this.disableSelectedControls) {
                SetUserRadioControlEnabled(!this.disableSelectedControls)
            }
        })
    };

    public stopDisableControlsLoop() {
        setTimeout(() => {
            clearTick(this.controlsLoop);
        }, 250)
    };
}

export const NUI = new NU();