import { Delay } from "@shared/utils";

class AnimClass {
    private prop: string;
    private createdProp: any;
    public isAnimating: boolean;
    private attachedProp: boolean;

    constructor() {
        this.isAnimating = false;
        this.prop = `prop_aphone`;
        this.attachedProp = false;
    };

    private async AttachProp() {
        RequestModel(this.prop);
        while (!HasModelLoaded(this.prop)) {
            await Delay(0);
        }
        this.createdProp = CreateObject(this.prop, 0.0, 0.0, 0.0, true, true, false);
        AttachEntityToEntity(this.createdProp, PlayerPedId(), GetPedBoneIndex(PlayerPedId(), 28422), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, false, 2, true);
        this.attachedProp = true;
    };

    public async StatAnimation() {
        this.isAnimating = true;
        this.AttachProp();
        this.DoAnimation('cellphone_text_in');
    };

    private async DeAttachProp() {
        if (this.attachedProp) {
            DetachEntity(this.createdProp, true, true);
            DeleteObject(this.createdProp);
            this.attachedProp = false;
        }
    };

    public async EndAnimation() {
        if (this.isAnimating) {
            this.isAnimating = false;
            await this.DeAttachProp();
            this.DoAnimation('cellphone_text_out');
            await Delay(1000);
            ClearPedTasks(PlayerPedId());
        }
    };

    public async DoAnimation(anim: string) {
        let animLib: string = 'cellphone@';
        if (IsPedInAnyVehicle(PlayerPedId(), false)) {
            animLib = 'anim@cellphone@in_car@ps';
        }
        RequestAnimDict(animLib);
        while (!HasAnimDictLoaded(animLib)) {
            await Delay(0);
        }
        TaskPlayAnim(PlayerPedId(), animLib, anim, 8.0, 8.0, -1, 50, 0, false, false, false);
    };
}

export const Animation = new AnimClass();