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