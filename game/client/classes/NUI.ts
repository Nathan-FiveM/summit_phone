

export class NUI {
    static timetick: any;

    static async openUI() {
        const state = LocalPlayer.state;
        state.set('onPhone', true, true);
        SetCursorLocation(0.89, 0.6);
        this.startTimeLoop();
        NUI.sendReactMessage('setVisible', true);
        NUI.sendReactMessage("setCursor", true);
        SetNuiFocus(true, true);
    }

    static closeUI() {
        this.sendReactMessage('setVisible', false);
        this.sendReactMessage("setCursor", false);
        SetNuiFocus(false, false);
        this.stopTimeLoop();
        setTimeout(() => {
            const state = LocalPlayer.state;
            state.set('onPhone', false, true);
        }, 1000)
    }

    static sendReactMessage(action: string, data: object | boolean | string | number) {
        SendNuiMessage(
            JSON.stringify({
                action: action,
                data: data,
            })
        );
    }

    static startTimeLoop() {
        this.timetick = setTick(() => {
            const hours = GetClockHours();
            const minutes = GetClockMinutes();

            NUI.sendReactMessage('sendTime', `${hours}:${minutes}`);
        });
    }

    static stopTimeLoop() {
        clearTick(this.timetick);
    }
}