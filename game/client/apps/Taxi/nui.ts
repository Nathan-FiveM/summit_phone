import { NUI } from "@client/classes/NUI";

RegisterNuiCallbackType("taxi:requestRide");
on("__cfx_nui:taxi:requestRide", (data: any, cb: Function) => {
  emitNet("ignis_taxijob:server:requestRide", data?.note || "");
  cb(true);
});

RegisterNuiCallbackType("taxi:completeRide");
on("__cfx_nui:taxi:completeRide", (data: any, cb: Function) => {
  emitNet("ignis_taxijob:server:completeRide", data?.rideId, data?.amount || 0);
  cb(true);
});

RegisterNuiCallbackType("taxi:signIn");
on("__cfx_nui:taxi:signIn", (_: any, cb: Function) => {
  emit("ignis_groups:client:signIn", "taxi");
  cb(true);
});

RegisterNuiCallbackType("taxi:readyForJob");
on("__cfx_nui:taxi:readyForJob", (_: any, cb: Function) => {
  emitNet("ignis_groups:server:readyForJob");
  cb(true);
});

RegisterNuiCallbackType("taxi:toggleDuty");
on("__cfx_nui:taxi:toggleDuty", (_: any, cb: Function) => {
  emitNet("QBCore:ToggleDuty");
  cb(true);
});

RegisterNuiCallbackType("taxi:leaveQueue");
on("__cfx_nui:taxi:leaveQueue", (_: any, cb: Function) => {
  emitNet("ignis_groups:server:leaveQueue");
  cb(true);
});

RegisterNuiCallbackType("taxi:cancelRide");
on("__cfx_nui:taxi:cancelRide", (data: any, cb: Function) => {
  emitNet("ignis_taxijob:server:cancelRide", data?.rideId);
  cb(true);
});

RegisterNuiCallbackType("taxi:getStatus");
on("__cfx_nui:taxi:getStatus", (_: any, cb: Function) => {
  emitNet("ignis_taxijob:server:syncStatus");
  cb(true);
});

RegisterNuiCallbackType("taxi:driverArrived");
on("__cfx_nui:taxi:driverArrived", (data: any, cb: Function) => {
  emitNet("ignis_taxijob:server:driverArrived", data?.rideId);
  cb(true);
});

// Push updates into React taxi app
onNet("summit_phone:client:updateTaxiApp", (action: string, data: any) => {
  NUI.sendReactMessage("updateTaxiApp", { action, data });
});

RegisterNetEvent("summit_phone:client:updateTaxiApp");
AddEventHandler("summit_phone:client:updateTaxiApp", (action: string, data: any) => {
  NUI.sendReactMessage("updateTaxiApp", { action, data });
});
