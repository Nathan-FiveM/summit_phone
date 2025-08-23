import { onClientCallback, triggerClientCallback } from "@overextended/ox_lib/server";
import { Utils } from "@server/classes/Utils";
import { Framework } from "@server/sv_main";
import { GarageData } from "../../../../types/types";

interface VehicleData {
    vehicle: string;
    plate: string;
    garage: string;
    mods: string;
    state: number;
    depotprice: string;
}

onClientCallback('garage:getGarageData', async (source: number) => {
    let resData: GarageData[] = [];
    const citizenId = await global.exports['qb-core'].GetPlayerCitizenIdBySource(source);
    const res = await Utils.query(`SELECT vehicle,plate,garage,mods,state,depotprice FROM player_vehicles WHERE citizenid = ?`, [citizenId]) as VehicleData[];
    const vehicleData = Framework.Shared.Vehicles;
    
    for (const vehicle of res) {
        const data = vehicleData[vehicle.vehicle];
        if (data) {
            // Determine vehicle state with better logic
            let state: string;
            if (vehicle.state === 2) {
                state = "Impounded";
            } else if (vehicle.state === 1) {
                state = "Parked";
            } else if (Number(vehicle.depotprice) > 0) {
                state = "Depot"; // Changed from "Depoted" to "Depot" as requested
            } else {
                state = "Out";
            }

            resData.push({
                plate: vehicle.plate,
                garage: vehicle.garage,
                state: state,
                category: data.category,
                brand: data.brand,
                name: data.name,
                turboInstalled: JSON.parse(vehicle.mods).modTurbo,
                bodyHealth: JSON.parse(vehicle.mods).bodyHealth,
                tankHealth: JSON.parse(vehicle.mods).tankHealth,
                fuelLevel: JSON.parse(vehicle.mods).fuelLevel,
                engineHealth: JSON.parse(vehicle.mods).engineHealth,
                modSuspension: JSON.parse(vehicle.mods).modSuspension,
                modTransmission: JSON.parse(vehicle.mods).modTransmission,
                modEngine: JSON.parse(vehicle.mods).modEngine,
                modBrakes: JSON.parse(vehicle.mods).modBrakes,
            })
        }
    }
    return JSON.stringify(resData);
});