import { Animation } from "./Animation";


export class NU {
    private timetick: any;
    private controlsLoop: any;

    public async init() {
        RegisterCommand('phoneopen', () => {
            this.openUI();
        }, false);
        RegisterCommand('phoneclose', () => {
            this.closeUI();
        }, false);
        RegisterKeyMapping('phoneopen', 'Open Phone', 'keyboard', 'M');
    };

    public async openUI() {
        const state = LocalPlayer.state;
        state.set('onPhone', true, true);
        SetCursorLocation(0.89, 0.6);
        this.startTimeLoop();
        this.sendReactMessage('setVisible', true);
        this.sendReactMessage("setCursor", true);
        SetNuiFocus(true, true);
        SetNuiFocusKeepInput(true)
        Animation.StatAnimation();
    };

    public closeUI() {
        this.sendReactMessage('setVisible', false);
        this.sendReactMessage("setCursor", false);
        SetNuiFocus(false, false);
        this.stopTimeLoop();
        Animation.EndAnimation();
        setTimeout(() => {
            const state = LocalPlayer.state;
            state.set('onPhone', false, true);
        }, 1000)
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

    private DisableControls() {
        DisableControlAction(0, 1, true)
        DisableControlAction(0, 2, true)
        DisableControlAction(0, 3, true)
        DisableControlAction(0, 4, true)
        DisableControlAction(0, 5, true)
        DisableControlAction(0, 6, true)
        DisableControlAction(0, 263, true)
        DisableControlAction(0, 264, true)
        DisableControlAction(0, 257, true)
        DisableControlAction(0, 140, true)
        DisableControlAction(0, 141, true)
        DisableControlAction(0, 142, true)
        DisableControlAction(0, 143, true)
        DisableControlAction(0, 177, true)
        DisableControlAction(0, 200, true)
        DisableControlAction(0, 202, true)
        DisableControlAction(0, 322, true)
        DisableControlAction(0, 245, true)
        DisableControlAction(0, 261, true)
        DisableControlAction(0, 262, true)
        DisablePlayerFiring(PlayerPedId(), true)
    };

    public startDisableControlsLoop() {
        this.controlsLoop = setTick(() => {
            this.DisableControls();
        });
    };

    public stopDisableControlsLoop() {
        clearTick(this.controlsLoop);
    };
}

export const NUI = new NU();