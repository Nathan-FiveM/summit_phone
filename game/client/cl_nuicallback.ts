import { NUI } from "./classes/NUI";

RegisterNuiCallbackType('hideFrame');
on('__cfx_nui:hideFrame', () => {
  NUI.closeUI();
});

RegisterNuiCallbackType('disableControls');
on('__cfx_nui:disableControls', (data: boolean) => {
  NUI.disableControls = data;
  SetNuiFocusKeepInput(!data);
});