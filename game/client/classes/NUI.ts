import { Animation } from "./Animation";
import { Utils } from "./Utils";


export class NU {
    private timetick: any;
    private controlsLoop: any;
    private closeTimeout: any; // Add timeout reference for cleanup
    public shouldNotOpen: boolean = false;
    public disableControls = false;
    private isLooprunnig = false;
    public disableSelectedControls = false;

    public async init() {
        RegisterCommand('phoneopen', () => {
            const state = LocalPlayer.state;
            if (state.onPhone) {
                this.closeUI();
                this.sendReactMessage('toggleCloseClear', "ok")
                return;
            };
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
        RegisterKeyMapping('phoneopen', 'Toggle Phone', 'keyboard', 'M');
        RegisterKeyMapping('+toggleNuiFocus', 'Toggle NUI Focus', 'keyboard', 'LMENU');
    };

    public async openUI(phoneItem: string) {
        const state = LocalPlayer.state;
        if (state.onPhone) return;
        
        // Batch NUI messages to reduce overhead
        const phoneColor = Utils.GetPhoneItem().split('_')[0];
        const uiData = {
            setVisible: { show: true, color: phoneColor },
            setCursor: { show: true, color: phoneColor }
        };
        
        state.set('onPhone', true, true);
        SetCursorLocation(0.89, 0.6);
        
        // Send batched messages
        this.sendReactMessage('setVisible', uiData.setVisible);
        this.sendReactMessage("setCursor", uiData.setCursor);
        
        SetNuiFocus(true, true);
        SetNuiFocusKeepInput(true);
        
        // Start loops after UI is set up
        this.startTimeLoop();
        this.startDisableControlsLoop();
        
        // Start animation last to avoid conflicts
        Animation.StatAnimation(phoneItem);
    };

    public closeUI() {
        // Stop loops first to reduce overhead
        this.stopTimeLoop();
        this.stopDisableControlsLoop();
        
        SetNuiFocus(false, false);
        Animation.EndAnimation();
        
        // Batch close messages
        const phoneColor = Utils.GetPhoneItem().split('_')[0];
        this.sendReactMessage('setVisible', { show: false, color: phoneColor });
        this.sendReactMessage("setCursor", { show: false, color: phoneColor });
        
        Utils.phonesArray = "";
        // Clear any existing timeout
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
        }
        this.closeTimeout = setTimeout(() => {
            const state = LocalPlayer.state;
            state.set('onPhone', false, true);
            this.closeTimeout = null;
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
        let lastTimeUpdate = 0;
        this.timetick = setTick(() => {
            const currentTime = GetGameTimer();
            // Only update time every 30 seconds to reduce NUI calls
            if (currentTime - lastTimeUpdate > 30000) {
                const hours = GetClockHours();
                const minutes = GetClockMinutes();
                this.sendReactMessage('sendTime', `${hours}:${minutes}`);
                lastTimeUpdate = currentTime;
            }
        });
    };

    public stopTimeLoop() {
        clearTick(this.timetick);
    };

    public startDisableControlsLoop() {
        SetPauseMenuActive(false);

        // Cache control actions to reduce function calls
        const controlsToDisable = [
            [0, 24], [0, 257], [0, 25], [0, 263], [0, 140], [0, 141], [0, 142], [0, 143],
            [2, 199], [2, 200], [0, 44], [0, 45], [0, 75], [0, 81], [0, 82], [0, 83], 
            [0, 84], [0, 85], [0, 332], [0, 333]
        ];

        this.controlsLoop = setTick(() => {
            // Only disable controls when NUI is focused to reduce overhead
            if (IsNuiFocused()) {
                DisableControlAction(0, 1, true);
                DisableControlAction(0, 2, true);
            }

            // Batch disable controls
            for (const [group, control] of controlsToDisable) {
                DisableControlAction(group, control, true);
            }

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

    // Add cleanup method for resource stop
    public cleanup() {
        this.stopTimeLoop();
        this.stopDisableControlsLoop();
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = null;
        }
    };
}

export const NUI = new NU();