class Camera {
    private normalCam: number | null = null;    // Handle for the normal camera
    private selfieCam: number | null = null;    // Handle for the selfie camera
    private camOpen: boolean = false;           // Tracks if the camera app is active
    private isSelfieMode: boolean = false;      // Tracks if selfie mode is active
    private currentMode: string = "portrait";   // Current mode (portrait or landscape)
    private readonly speed_ud: number = 3.5;    // Rotation speed for up/down
    private readonly speed_lr: number = 3.5;    // Rotation speed for left/right
    private tickHandle: number | null = null;   // Handle for the tick function

    /**
     * Toggles the front-facing cell phone camera effect, managing phone model and radar display.
     * @param p0 First parameter for the native call
     * @param p1 Second parameter for the native call
     */
    private cellCamActivate(p0: boolean, p1: boolean): void {
        Citizen.invokeNative('0xFDE8F069C542D126', p0, p1); // _CELL_CAM_ACTIVATE
        if (p0 && p1) {
            CreateMobilePhone(0); // Create phone model
            Citizen.invokeNative('0x2491A93618B7D838', true); // _DISPLAY_RADAR
        } else {
            DestroyMobilePhone(); // Destroy phone model
            Citizen.invokeNative('0x2491A93618B7D838', false); // _DISPLAY_RADAR
        }
    }

    /**
     * Opens the camera app, initializing the normal camera and starting the control tick.
     */
    public openCameraApp(): void {
        if (this.camOpen) return;
        const lPed: number = PlayerPedId();
        this.normalCam = CreateCam("DEFAULT_SCRIPTED_FLY_CAMERA", true);
        AttachCamToEntity(this.normalCam, lPed, 0.0, 0.7, 0.7, true); // Position in front of player
        const heading = GetEntityHeading(lPed);
        SetCamRot(this.normalCam, 0.0, 0.0, heading, 2); // Align with player's heading
        SetCamFov(this.normalCam, 70.0);                  // Default FOV for portrait
        RenderScriptCams(true, false, 0, true, false);
        SetCamActive(this.normalCam, true);
        this.currentMode = "portrait";
        this.isSelfieMode = false;
        this.tickHandle = setTick(() => this.handleCameraControls());
        this.camOpen = true;
    }

    /**
     * Closes the camera app, destroying cameras and stopping the control tick.
     */
    public closeCameraApp(): void {
        if (!this.camOpen) return;
        if (this.tickHandle !== null) {
            clearTick(this.tickHandle);
            this.tickHandle = null;
        }
        if (this.selfieCam) {
            SetCamActive(this.selfieCam, false);
            DestroyCam(this.selfieCam, false);
            this.selfieCam = null;
        }
        if (this.normalCam) {
            SetCamActive(this.normalCam, false);
            DestroyCam(this.normalCam, false);
            this.normalCam = null;
        }
        RenderScriptCams(false, false, 0, true, false);
        this.cellCamActivate(false, false);
        this.camOpen = false;
        this.isSelfieMode = false;
    }

    /**
     * Sets the camera mode (portrait or landscape) by adjusting the field of view.
     * @param mode The desired mode ("portrait" or "landscape")
     */
    public setCameraMode(mode: string): void {
        if (this.normalCam && this.camOpen && !this.isSelfieMode) {
            if (mode === "portrait") {
                SetCamFov(this.normalCam, 70.0);
                this.currentMode = "portrait";
            } else if (mode === "landscape") {
                SetCamFov(this.normalCam, 110.0);
                this.currentMode = "landscape";
            }
        }
    }

    /**
     * Toggles between normal and selfie camera modes.
     * @param enable True to switch to selfie mode, false to switch back to normal
     */
    public toggleSelfieMode(enable: boolean): void {
        if (!this.camOpen) return;
        const lPed = PlayerPedId();
        if (enable && !this.isSelfieMode) {
            if (this.normalCam) {
                SetCamActive(this.normalCam, false);
            }
            this.selfieCam = CreateCam("DEFAULT_SCRIPTED_FLY_CAMERA", true);
            const heading = GetEntityHeading(lPed);
            const offset_x = 0.25;
            const offset_y = 0.8;
            const offset_z = 0.75;
            AttachCamToEntity(this.selfieCam, lPed, offset_x, offset_y, offset_z, true);
            SetCamRot(this.selfieCam, -10.0, 0.0, (heading + 150.0) % 360.0, 2);
            SetCamFov(this.selfieCam, 70.0);
            SetCamActive(this.selfieCam, true);
            RenderScriptCams(true, false, 0, true, false);
            this.cellCamActivate(true, true);
            this.isSelfieMode = true;
        } else if (!enable && this.isSelfieMode) {
            if (this.selfieCam) {
                SetCamActive(this.selfieCam, false);
                DestroyCam(this.selfieCam, false);
                this.selfieCam = null;
            }
            if (this.normalCam) {
                SetCamActive(this.normalCam, true);
                RenderScriptCams(true, false, 0, true, false);
            }
            this.cellCamActivate(false, false);
            this.isSelfieMode = false;
        }
    }

    /**
     * Handles frame-by-frame camera controls, adjusting rotation based on input.
     * Called every frame while the camera is open.
     */
    public handleCameraControls(): void {
        if (!this.camOpen) return;
        const lPed = PlayerPedId();
        const activeCam = this.isSelfieMode ? this.selfieCam : this.normalCam;
        if (!activeCam) return;
        const rightAxisX = GetControlNormal(0, 220); // Right stick X-axis
        const rightAxisY = GetControlNormal(0, 221); // Right stick Y-axis
        const rotation = GetCamRot(activeCam, 2);
        if (!this.isSelfieMode) {
            const newZ = rotation[2] + rightAxisX * -1.0 * this.speed_ud;
            const newX = Math.max(Math.min(50.0, rotation[0] + rightAxisY * -1.0 * this.speed_lr), -89.5);
            if (!IsPedInAnyVehicle(lPed, false)) {
                SetEntityHeading(lPed, newZ);
            }
            if (IsNuiFocused()) return;
            SetCamRot(activeCam, newX, 0.0, GetEntityHeading(lPed), 2);
        } 
    }
}

export const CameraApp = new Camera();