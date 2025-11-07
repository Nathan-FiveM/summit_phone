import { Delay } from "@shared/utils";

class AnimClass {
    private prop: string;
    private createdProp: any;
    public isAnimating: boolean;
    private attachedProp: boolean;
    private isCalling: boolean;
    private phoneWasOpen: boolean; // NEW: Track if phone was open during call
    private loadedModels: Set<string> = new Set(); // Track loaded models for cleanup
    private loadedAnimDicts: Set<string> = new Set(); // Track loaded animation dictionaries

    constructor() {
        this.isAnimating = false;
        this.isCalling = false;
        this.phoneWasOpen = false;
        this.prop = `prop_aphone_blue`;
        this.attachedProp = false;
    };

    private async AttachProp() {
        // Check if model is already loaded to avoid unnecessary requests
        if (!HasModelLoaded(this.prop)) {
            RequestModel(this.prop);
            while (!HasModelLoaded(this.prop)) {
                await Delay(0);
            }
            this.loadedModels.add(this.prop); // Track loaded model
        }
        this.createdProp = CreateObject(this.prop, 0.0, 0.0, 0.0, true, true, false);
        AttachEntityToEntity(this.createdProp, PlayerPedId(), GetPedBoneIndex(PlayerPedId(), 28422), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, false, 2, true);
        this.attachedProp = true;
    };

    // Existing texting/browsing animation
    public async StatAnimation(phoneItem: string) {
        this.prop = phoneItem;
        this.isAnimating = true;
        this.isCalling = false;
        this.phoneWasOpen = true; // NEW: Mark that phone is open
        this.AttachProp();
        this.DoAnimation('cellphone_text_in');
    };

    // NEW: Calling animation methods
    public async StartCallAnimation(phoneItem: string) {
        this.prop = phoneItem;
        this.isAnimating = true;
        this.isCalling = true;
        this.phoneWasOpen = true; // NEW: Mark that phone is open during call
        
        // Use calling-specific animations
        if (IsPedInAnyVehicle(PlayerPedId(), false)) {
            this.DoAnimation('cellphone_call_listen_base', 'cellphone@in_car@ds');
        } else {
            this.DoAnimation('cellphone_call_listen_base', 'cellphone@');
        }
    };

    public async EndCallAnimation() {
        if (this.isAnimating && this.isCalling) {
            this.isAnimating = false;
            this.isCalling = false;
            
            if (IsPedInAnyVehicle(PlayerPedId(), false)) {
                this.DoAnimation('cellphone_call_out', 'cellphone@in_car@ds');
            } else {
                this.DoAnimation('cellphone_call_out', 'cellphone@');
            }
            
            await Delay(1000);
            ClearPedTasks(PlayerPedId());
            
            // NEW: Check if phone UI is still open and switch to texting animation
            const state = LocalPlayer.state;
            if (state.onPhone) {
                await Delay(500); // Small delay before switching
                this.isAnimating = true;
                this.isCalling = false;
                this.DoAnimation('cellphone_text_in');
            }
        }
    };

    // NEW: Method to switch back to texting animation
    private async SwitchToTextingAnimation() {
        if (this.phoneWasOpen && !this.isCalling) {
            this.isAnimating = true;
            this.isCalling = false;
            this.AttachProp();
            this.DoAnimation('cellphone_text_in');
        }
    };

    // Existing end animation for texting/browsing
    public async EndAnimation() {
        if (this.isAnimating && !this.isCalling) {
            this.isAnimating = false;
            this.phoneWasOpen = false; // NEW: Mark that phone is closed
            await this.DeAttachProp();
            this.DoAnimation('cellphone_text_out');
            await Delay(1000);
            ClearPedTasks(PlayerPedId());
        }
    };

    private async DeAttachProp() {
        if (this.attachedProp) {
            DetachEntity(this.createdProp, true, true);
            DeleteObject(this.createdProp);
            this.attachedProp = false;
        }
    };

    public async DoAnimation(anim: string, animLib?: string) {
        let animationLibrary: string = animLib || 'cellphone@';
        
        if (!animLib && IsPedInAnyVehicle(PlayerPedId(), false)) {
            animationLibrary = 'anim@cellphone@in_car@ps';
        }
        
        // Check if animation dictionary is already loaded
        if (!HasAnimDictLoaded(animationLibrary)) {
            RequestAnimDict(animationLibrary);
            while (!HasAnimDictLoaded(animationLibrary)) {
                await Delay(0);
            }
            this.loadedAnimDicts.add(animationLibrary); // Track loaded animation dictionary
        }
        TaskPlayAnim(PlayerPedId(), animationLibrary, anim, 8.0, 8.0, -1, 50, 0, false, false, false);
    };

    // Add cleanup method for resource stop
    public cleanup() {
        // Clean up loaded models
        for (const model of this.loadedModels) {
            if (HasModelLoaded(model)) {
                SetModelAsNoLongerNeeded(model);
            }
        }
        this.loadedModels.clear();

        // Clean up loaded animation dictionaries
        for (const animDict of this.loadedAnimDicts) {
            if (HasAnimDictLoaded(animDict)) {
                RemoveAnimDict(animDict);
            }
        }
        this.loadedAnimDicts.clear();

        // Clean up any attached props
        if (this.attachedProp && this.createdProp) {
            DetachEntity(this.createdProp, true, true);
            DeleteObject(this.createdProp);
            this.attachedProp = false;
            this.createdProp = null;
        }

        // Clear any active animations
        if (this.isAnimating) {
            ClearPedTasks(PlayerPedId());
            this.isAnimating = false;
            this.isCalling = false;
            this.phoneWasOpen = false;
        }
    };
}

export const Animation = new AnimClass();