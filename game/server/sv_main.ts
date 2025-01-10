import "./sv_exports";
import { Utils } from "./classes/Utils";

export const QBCore = global.exports['qb-core'].GetCoreObject();
export const MongoDB = global.exports.mongoDB;
export const MySQL = global.exports.oxmysql;

setImmediate(() => {
    Utils.load();
});