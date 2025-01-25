import "./sv_exports";
import "./apps/index";
import { Utils } from "./classes/Utils";
import { Settings } from "./apps/Settings/class";

export const Framework = global.exports['qb-core'].GetCoreObject();
export const MongoDB = global.exports['mongoDB'];
export const MySQL = global.exports.oxmysql;

setImmediate(() => {
    Utils.load();
    Settings.load();
});