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

RegisterNuiCallbackType('actionNotiButtonOne');
on('__cfx_nui:actionNotiButtonOne', (data: {
  id: number;
  isServer: boolean;
  event: string;
  args: any;
}) => {
  data.isServer ? emitNet(data.event, data.id, data.args) : emit(data.event, data.id, data.args);
});
RegisterNuiCallbackType('actionNotiButtonTwo');
on('__cfx_nui:actionNotiButtonTwo', (data: {
  id: number;
  isServer: boolean;
  event: string;
  args: any;
}) => {
  data.isServer ? emitNet(data.event, data.id, data.args) : emit(data.event, data.id, data.args);
});