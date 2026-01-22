"use strict";
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// game/shared/utils.ts
function Delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
__name(Delay, "Delay");
var generateUUid = /* @__PURE__ */ __name(() => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}, "generateUUid");
var LOGGER = /* @__PURE__ */ __name((message) => {
  return console.log(`\x1B[1m\x1B[47m\x1B[34m[Summit_Phone] \x1B[4m\x1B[31m${message}\x1B[0m`);
}, "LOGGER");
var FRAMEWORK_RESOURCE = "qb-core";
var INVENTORY_RESOURCE = "lj-inventory";

// game/server/classes/Utils.ts
var _Util = class _Util {
  contactsData;
  constructor() {
    this.contactsData = [];
  }
  async load() {
    RegisterCommand("transferNumbers", async (source2, args) => {
      if (source2 === 0) return LOGGER("This command can only be executed in-game.");
      await Utils.TransferNumbers();
    }, true);
    RegisterCommand("transferContacts", async (source2, args) => {
      if (source2 === 0) return LOGGER("This command can only be executed in-game.");
      await Utils.TransferContacts();
    }, true);
    RegisterCommand("migrateMultiJobData", async (source2, args) => {
      if (source2 === 0) return LOGGER("This command can only be executed in-game.");
      await Utils.MigrateMultiJobData();
    }, true);
    RegisterCommand("migrateSociety", async (source2, args) => {
      if (source2 === 0) return LOGGER("This command can only be executed in-game.");
      await Utils.MigrateSocietyData();
    }, true);
  }
  async TransferNumbers() {
    let newNumbers = [];
    let newSettings = [];
    let newCards = [];
    MySQL.query("SELECT citizenid, charinfo FROM players", [], async (result) => {
      try {
        for (const row of result) {
          const owner = row.citizenid;
          let charinfo = row.charinfo;
          if (typeof charinfo === "string") {
            try {
              charinfo = JSON.parse(charinfo);
            } catch (e) {
              charinfo = {};
            }
          }
          const number = charinfo && (charinfo.phone ?? charinfo.phone_number) || null;
          if (!number) continue;
          const existing = await MongoDB.findOne("phone_numbers", { owner });
          if (existing) continue;
          newNumbers.push({
            _id: generateUUid(),
            owner,
            number
          });
          const existingSettings = await MongoDB.findOne("phone_settings", { _id: owner });
          if (!existingSettings) {
            newSettings.push({
              _id: owner,
              background: { current: "", wallpapers: [] },
              lockscreen: { current: "", wallpapers: [] },
              ringtone: {
                current: "https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3",
                ringtones: [
                  {
                    name: "default",
                    url: "https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3"
                  }
                ]
              },
              showStartupScreen: true,
              showNotifications: true,
              isLock: true,
              lockPin: "",
              usePin: true,
              phoneNumber: number,
              useFaceId: false,
              faceIdIdentifier: owner,
              darkMailIdAttached: "",
              pigeonIdAttached: "",
              smrtId: "",
              smrtPassword: "",
              isFlightMode: false
            });
          }
          const existingCard = await MongoDB.findOne("phone_player_card", { _id: owner });
          if (!existingCard) {
            newCards.push({
              _id: owner,
              firstName: "Setup",
              lastName: "Card",
              phoneNumber: number,
              email: "",
              notes: "",
              avatar: ""
            });
          }
        }
        if (newNumbers.length > 0) {
          await MongoDB.insertMany("phone_numbers", newNumbers);
          LOGGER(`Inserted ${newNumbers.length} phone_numbers.`);
        } else {
          LOGGER("No new phone_numbers to insert.");
        }
        if (newSettings.length > 0) {
          await MongoDB.insertMany("phone_settings", newSettings);
          LOGGER(`Inserted ${newSettings.length} phone_settings.`);
        } else {
          LOGGER("No new phone_settings to insert.");
        }
        if (newCards.length > 0) {
          await MongoDB.insertMany("phone_player_card", newCards);
          LOGGER(`Inserted ${newCards.length} phone_player_card entries.`);
        } else {
          LOGGER("No new phone_player_card entries to insert.");
        }
      } catch (err) {
        LOGGER(`TransferNumbers error: ${err}`);
      }
    });
  }
  async TransferContacts() {
    try {
      const result = await this.query("SELECT * FROM phone_phone_contacts", []);
      if (!result || result.length === 0) {
        LOGGER("No contacts found to transfer.");
        return;
      }
      for (const [index, contact] of result.entries()) {
        if (index > result.length) break;
        const ownerId = await this.GetCitizenIdByPhoneNumber(contact.phone_number);
        this.contactsData.push({
          _id: generateUUid(),
          personalNumber: contact.phone_number,
          contactNumber: contact.contact_phone_number,
          firstName: contact.firstname,
          lastName: contact.lastname,
          image: contact.profile_image,
          ownerId
        });
      }
      await MongoDB.insertMany("phone_contacts", this.contactsData);
      LOGGER("Phone contacts have been transferred to MongoDB.");
    } catch (e) {
      LOGGER(`Error while transferring contacts: ${JSON.stringify(e, null, 2)}`);
    }
  }
  async MigrateMultiJobData() {
    var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    try {
      const result = await this.query("SELECT id, jobname, employees FROM player_jobs", []);
      if (!result || result.length === 0) {
        LOGGER("No multijobs found to transfer.");
        return;
      }
      const newData = [];
      for (const row of result) {
        try {
          const jobId = row.id;
          const jobName = row.jobname;
          if (!jobName) continue;
          let employees = row.employees;
          if (!employees) continue;
          if (typeof employees === "string") {
            try {
              employees = JSON.parse(employees);
            } catch (err) {
              LOGGER(`Failed to parse employees JSON for job ${jobName} (id: ${jobId}): ${err}`);
              continue;
            }
          }
          if (!employees || typeof employees !== "object" || Array.isArray(employees)) continue;
          for (const [key, emp] of Object.entries(employees)) {
            const cid = emp && (emp.cid || emp.CID || emp.citizenId) || key;
            const gradeLevel = (emp && (emp.grade ?? emp.gradeLevel ?? emp.rank)) ?? 0;
            const jobLabel = ((_d = (_c = (_b = (_a2 = Framework) == null ? void 0 : _a2.Shared) == null ? void 0 : _b.Jobs) == null ? void 0 : _c[jobName]) == null ? void 0 : _d.label) ?? jobName;
            const gradeLabel = ((_j = (_i = (_h = (_g = (_f = (_e = Framework) == null ? void 0 : _e.Shared) == null ? void 0 : _f.Jobs) == null ? void 0 : _g[jobName]) == null ? void 0 : _h.grades) == null ? void 0 : _i[gradeLevel]) == null ? void 0 : _j.name) ?? "";
            newData.push({
              _id: generateUUid(),
              citizenId: cid,
              jobName,
              gradeLevel,
              jobLabel,
              gradeLabel
            });
          }
        } catch (innerErr) {
          LOGGER(`Error processing player_jobs row id ${row.id}: ${innerErr}`);
        }
      }
      if (newData.length > 0) {
        await MongoDB.insertMany("phone_multijobs", newData);
        LOGGER(`Inserted ${newData.length} multijob entries to phone_multijobs.`);
      } else {
        LOGGER("No multijob entries found to insert after parsing.");
      }
    } catch (err) {
      LOGGER(`MigrateMultiJobData error: ${err}`);
    }
  }
  async MigrateSocietyData() {
    const result = await this.query("SELECT * FROM av_society", []);
    result.forEach(async (job) => {
      await MongoDB.updateOne("summit_bank", { _id: job.job }, {
        bankBalance: Number(job.money)
      }, void 0, false);
    });
  }
  async GetPhoneNumberByCitizenId(citizenId) {
    const number = await MongoDB.findOne("phone_numbers", { owner: citizenId });
    if (!number) return false;
    return number.number;
  }
  async GetEmailIdByCitizenId(citizenId) {
    const number = await MongoDB.findOne("phone_settings", { _id: citizenId });
    if (!number) return false;
    return number.smrtId;
  }
  async GetEmailIdBySource(source2) {
    const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
    if (!citizenId) return false;
    const email = await this.GetEmailIdByCitizenId(citizenId);
    return email;
  }
  async GetCitizenIdByPhoneNumber(phoneNumber) {
    const number = await MongoDB.findOne("phone_numbers", { number: phoneNumber });
    if (!number) return false;
    return number.owner;
  }
  async GetPlayerFromPhoneNumber(phoneNumber) {
    const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
    return await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(citizenId);
  }
  async GetPhoneNumberBySource(source2) {
    const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
    return await this.GetPhoneNumberByCitizenId(citizenId);
  }
  async BlockNumber(phoneNumber, targetPhoneNumber) {
    const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
    const targetCitizenId = await this.GetCitizenIdByPhoneNumber(targetPhoneNumber);
    if (!citizenId || !targetCitizenId) return;
    await MongoDB.insertOne("phone_blocked_numbers", {
      _id: generateUUid(),
      citizenId,
      targetCitizenId
    });
  }
  async UnblockNumber(phoneNumber, targetPhoneNumber) {
    const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
    const targetCitizenId = await this.GetCitizenIdByPhoneNumber(targetPhoneNumber);
    if (!citizenId || !targetCitizenId) return;
    await MongoDB.deleteOne("phone_blocked_numbers", { citizenId, targetCitizenId });
  }
  async IsNumberBlocked(phoneNumber, targetPhoneNumber) {
    const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
    const targetCitizenId = await this.GetCitizenIdByPhoneNumber(targetPhoneNumber);
    if (!citizenId || !targetCitizenId) return false;
    const blocked = await MongoDB.findOne("phone_blocked_numbers", { citizenId, targetCitizenId });
    return blocked ? true : false;
  }
  async GetContactNameByNumber(phoneNumber, citizenId) {
    const contact = await MongoDB.findOne("phone_contacts", { contactNumber: phoneNumber, ownerId: citizenId });
    if (!contact) return phoneNumber;
    return `${contact.firstName} ${contact.lastName}`;
  }
  async GetContactAvatarByNumber(phoneNumber, citizenId) {
    const contact = await MongoDB.findOne("phone_contacts", { contactNumber: phoneNumber, ownerId: citizenId });
    if (!contact) return "";
    return contact.image;
  }
  async GetSourceFromCitizenId(citizenId) {
    const source2 = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(citizenId);
    if (!source2) return false;
    return source2.PlayerData.source;
  }
  async HasPhone(playerSource) {
    const phoneList = [
      "blue_phone",
      "green_phone",
      "red_phone",
      "gold_phone",
      "purple_phone"
    ];
    if (INVENTORY_RESOURCE === "ox_inventory") {
      const hasItem = exports["ox_inventory"].Search(
        playerSource,
        "count",
        phoneList
      );
      for (const phone of phoneList) {
        if (hasItem[phone] > 0) {
          return true;
        }
      }
      return false;
    } else {
      try {
        for (const phoneItem of phoneList) {
          const has = await exports[INVENTORY_RESOURCE].HasItem(playerSource, phoneItem);
          if (has) return true;
        }
      } catch (e) {
        console.error("HasPhone check failed:", e);
      }
      return false;
    }
  }
  async InFlightMode(citizenId) {
    const settings = await MongoDB.findOne("phone_settings", { _id: citizenId });
    if (!settings) return false;
    return settings.isFlightMode || false;
  }
  async query(query, values) {
    return new Promise((resolve, reject) => {
      MySQL.query(query, values, (result) => {
        resolve(result);
      });
    });
  }
  async isSenderKnown(senderId, receiverId) {
    const contactQuery = {
      ownerId: receiverId,
      contactNumber: senderId
    };
    const contact = await MongoDB.findOne("phone_contacts", contactQuery);
    return contact !== null;
  }
  async GetPhoneNumberByEmail(email) {
    const number = await MongoDB.findOne("phone_settings", { smrtId: email });
    if (!number) return false;
    return number.phoneNumber;
  }
  async GetCitizenIdByEmail(email) {
    const number = await MongoDB.findOne("phone_settings", { smrtId: email });
    if (!number) return false;
    return number._id;
  }
  async GetPlayerByEmail(email) {
    const citizenId = await this.GetCitizenIdByEmail(email);
    return await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(citizenId);
  }
  async GetAvatarFromEmail(email) {
    const avator = await MongoDB.findOne("phone_mail", { activeMaidId: email });
    if (!avator) return false;
    return avator.avatar;
  }
  async GetUserNameFromEmail(email) {
    const user = await MongoDB.findOne("phone_mail", { activeMaidId: email });
    if (!user) return false;
    return user.username;
  }
  async GetCidFromTweetId(email) {
    const res = await MongoDB.findOne("phone_settings", { pigeonIdAttached: email });
    if (!res) return false;
    return res._id;
  }
  async GetCidsFromPigeonEmail(email) {
    const res = await MongoDB.findMany("phone_settings", { pigeonIdAttached: email });
    if (!res || res.length === 0) return [];
    return res.map((setting) => setting._id);
  }
  async GetCidFromDarkEmail(email) {
    const res = await MongoDB.findOne("phone_settings", { darkMailIdAttached: email });
    if (!res) return false;
    return res._id;
  }
  async IsPlayerInJail(source2) {
    try {
      const player = await exports[FRAMEWORK_RESOURCE].GetPlayer(source2);
      if (!player) return false;
      const metadata = player.PlayerData.metadata;
      return metadata && metadata.injail && metadata.injail > 0;
    } catch (error) {
      return false;
    }
  }
  async getJobs(citizenId) {
    var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const jobs = {};
    const employees = {};
    const myEntries = await MongoDB.findMany("phone_multijobs", { citizenId });
    if (!myEntries || myEntries.length === 0) return { jobs, employees };
    const jobNames = Array.from(new Set(myEntries.map((e) => e.jobName)));
    for (const e of myEntries) {
      jobs[e.jobName] = {
        citizenId: e.citizenId,
        jobName: e.jobName,
        gradeLevel: e.gradeLevel ?? 0,
        jobLabel: e.jobLabel ?? ((_d = (_c = (_b = (_a2 = Framework) == null ? void 0 : _a2.Shared) == null ? void 0 : _b.Jobs) == null ? void 0 : _c[e.jobName]) == null ? void 0 : _d.label) ?? e.jobName,
        gradeLabel: e.gradeLabel ?? ((_j = (_i = (_h = (_g = (_f = (_e = Framework) == null ? void 0 : _e.Shared) == null ? void 0 : _f.Jobs) == null ? void 0 : _g[e.jobName]) == null ? void 0 : _h.grades) == null ? void 0 : _i[e.gradeLevel]) == null ? void 0 : _j.name) ?? ""
      };
    }
    const allEmployees = await MongoDB.findMany("phone_multijobs", { jobName: { $in: jobNames } });
    for (const entry of allEmployees) {
      employees[entry.jobName] = employees[entry.jobName] || {};
      employees[entry.jobName][entry.citizenId] = {
        cid: entry.citizenId,
        grade: entry.gradeLevel ?? 0,
        gradeLabel: entry.gradeLabel ?? "",
        jobLabel: entry.jobLabel ?? ""
      };
    }
    return { jobs, employees };
  }
};
__name(_Util, "Util");
var Util = _Util;
var Utils = new Util();

// game/server/apps/Mail/class.ts
var _Mail = class _Mail {
  async getMailMessages(email, password) {
    if (!email && !password) return false;
    const mailData = await MongoDB.findOne("phone_mail", { activeMaidId: email, activeMailPassword: password });
    if (!mailData || mailData.messages.length === 0) {
      mailData.messages = [];
    } else {
      mailData.messages = mailData.messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    if (!mailData) return false;
    return JSON.stringify(mailData.messages);
  }
  async sendMail(email, to, subject, message, images, source2) {
    const player = email;
    const target = to;
    const playerMail = await MongoDB.findOne("phone_mail", { _id: player });
    const targetMail = await MongoDB.findOne("phone_mail", { _id: target });
    if (!playerMail || !targetMail) return false;
    const newMailMessage = {
      _id: generateUUid(),
      from: player,
      to: target,
      avatar: await Utils.GetAvatarFromEmail(target),
      username: await Utils.GetUserNameFromEmail(target),
      subject,
      message,
      images,
      date: (/* @__PURE__ */ new Date()).toISOString(),
      read: true,
      tags: ["inbox", "sent"]
    };
    const targetMailmessage = {
      _id: generateUUid(),
      from: player,
      to: target,
      avatar: await Utils.GetAvatarFromEmail(player),
      subject,
      message,
      username: await Utils.GetUserNameFromEmail(player),
      images,
      date: (/* @__PURE__ */ new Date()).toISOString(),
      read: false,
      tags: ["inbox"]
    };
    playerMail.messages.push(newMailMessage);
    targetMail.messages.push(targetMailmessage);
    await MongoDB.updateOne("phone_mail", { _id: player }, playerMail);
    await MongoDB.updateOne("phone_mail", { _id: target }, targetMail);
    const targetCid = await Utils.GetPlayerByEmail(target);
    playerMail.messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    targetMail.messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    emitNet("summit_phone:client:refreshmailMessages", source2, JSON.stringify(playerMail.messages));
    if (targetCid) {
      emitNet("phone:addnotiFication", targetCid.PlayerData.source, JSON.stringify({
        id: generateUUid(),
        title: "Mail",
        description: `You have a new mail from ${player}.`,
        app: "settings",
        timeout: 5e3
      }));
      emitNet("summit_phone:client:refreshmailMessages", targetCid.PlayerData.source, JSON.stringify(targetMail.messages));
    }
    return true;
  }
  async sendEmailToAll(subject, sender, message, images) {
    const mailData = await MongoDB.findMany("phone_mail", { activeMaidId: { $ne: null } });
    if (!mailData) return false;
    mailData.forEach(async (mail) => {
      const newMailMessage = {
        _id: generateUUid(),
        from: sender,
        to: mail.activeMaidId,
        avatar: "",
        subject,
        message,
        images: images || [],
        date: (/* @__PURE__ */ new Date()).toISOString(),
        read: false,
        tags: ["inbox"],
        username: sender
      };
      mail.messages.push(newMailMessage);
      await MongoDB.updateOne("phone_mail", { _id: mail._id }, mail);
    });
    emitNet("phone:addnotiFication", -1, JSON.stringify({
      id: generateUUid(),
      title: "Mail",
      description: `You have a new mail, ${message}.`,
      app: "settings",
      timeout: 5e3
    }));
    return true;
  }
  async selecteMessage(data) {
    const parsedData = JSON.parse(data);
    const { messageId, mailId } = parsedData;
    const mailData = await MongoDB.findOne("phone_mail", { _id: mailId });
    if (!mailData) return false;
    const message = mailData.messages.find((m) => m._id === messageId);
    if (!message) return false;
    message.read = true;
    await MongoDB.updateOne("phone_mail", { _id: mailId }, mailData);
    return true;
  }
  async getProfileSettings(email, password) {
    const mailData = await MongoDB.findAndReturnSpecificFields("phone_mail", { activeMaidId: email, activeMailPassword: password }, ["activeMaidId", "activeMailPassword", "avatar", "username"]);
    if (!mailData) return false;
    return JSON.stringify(mailData);
  }
  async updateProfileSettings(email, password, username, avatar) {
    const mailData = await MongoDB.findOne("phone_mail", { activeMaidId: email, activeMailPassword: password });
    if (!mailData) return false;
    mailData.username = username;
    mailData.avatar = avatar;
    await MongoDB.updateOne("phone_mail", { activeMaidId: email, activeMailPassword: password }, mailData);
    return true;
  }
};
__name(_Mail, "Mail");
var Mail = _Mail;
var MailClass = new Mail();

// game/server/sv_exports.ts
async function GetCurrentPhoneNumber(source2) {
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  if (!citizenId) return false;
  const number = await Utils.GetPhoneNumberByCitizenId(citizenId);
  return number;
}
__name(GetCurrentPhoneNumber, "GetCurrentPhoneNumber");
exports("GetCurrentPhoneNumber", GetCurrentPhoneNumber);
async function GetCurrentPhoneNumberByCitizenId(citizenId) {
  const number = await Utils.GetPhoneNumberByCitizenId(citizenId);
  return number;
}
__name(GetCurrentPhoneNumberByCitizenId, "GetCurrentPhoneNumberByCitizenId");
exports("GetCurrentPhoneNumberByCitizenId", GetCurrentPhoneNumberByCitizenId);
async function GetEmailIdByCitizenId(citizenId) {
  const email = await Utils.GetEmailIdByCitizenId(citizenId);
  return email;
}
__name(GetEmailIdByCitizenId, "GetEmailIdByCitizenId");
exports("GetEmailIdByCitizenId", GetEmailIdByCitizenId);
async function GetEmailIdBySource(source2) {
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  if (!citizenId) return false;
  const email = await Utils.GetEmailIdByCitizenId(citizenId);
  return email;
}
__name(GetEmailIdBySource, "GetEmailIdBySource");
exports("GetEmailIdBySource", GetEmailIdBySource);
async function SendNotification(source2, title, description, app, timeout) {
  emitNet("phone:addnotiFication", source2, JSON.stringify({
    id: generateUUid(),
    title,
    description,
    app,
    timeout: timeout || 5e3
  }));
}
__name(SendNotification, "SendNotification");
exports("SendNotification", SendNotification);
async function SendMail(data) {
  const res = await MailClass.sendMail(data.email, data.to, data.subject, data.message, data.images, data.source);
  return res;
}
__name(SendMail, "SendMail");
exports("SendMail", SendMail);
async function SendMailToAll(data) {
  const res = await MailClass.sendEmailToAll(data.subject, data.sender, data.message, data.images);
  return res;
}
__name(SendMailToAll, "SendMailToAll");
exports("SendMailToAll", SendMailToAll);
var GetJobs = /* @__PURE__ */ __name(async (citizenId) => {
  if (!citizenId) return {};
  const res = await Utils.getJobs(citizenId);
  return res.jobs || {};
}, "GetJobs");
exports("getJobs", GetJobs);
var GetJobsFull = /* @__PURE__ */ __name(async (citizenId) => {
  if (!citizenId) return { jobs: {}, employees: {} };
  return await Utils.getJobs(citizenId);
}, "GetJobsFull");
exports("getJobsFull", GetJobsFull);

// node_modules/.pnpm/@overextended+ox_lib@3.29.0/node_modules/@overextended/ox_lib/shared/resource/cache/index.js
var cacheEvents = {};
var cache = new Proxy({
  resource: GetCurrentResourceName(),
  game: GetGameName()
}, {
  get(target, key) {
    const result = key ? target[key] : target;
    if (result !== void 0)
      return result;
    cacheEvents[key] = [];
    AddEventHandler(`ox_lib:cache:${key}`, (value) => {
      const oldValue = target[key];
      const events = cacheEvents[key];
      events.forEach((cb) => cb(value, oldValue));
      target[key] = value;
    });
    target[key] = exports.ox_lib.cache(key) || false;
    return target[key];
  }
});

// node_modules/.pnpm/@overextended+ox_lib@3.29.0/node_modules/@overextended/ox_lib/server/resource/callback/index.js
var pendingCallbacks = {};
var callbackTimeout = GetConvarInt("ox:callbackTimeout", 3e5);
onNet(`__ox_cb_${cache.resource}`, (key, ...args) => {
  const resolve = pendingCallbacks[key];
  delete pendingCallbacks[key];
  return resolve && resolve(...args);
});
function triggerClientCallback(eventName, playerId, ...args) {
  let key;
  do {
    key = `${eventName}:${Math.floor(Math.random() * (1e5 + 1))}:${playerId}`;
  } while (pendingCallbacks[key]);
  emitNet(`__ox_cb_${eventName}`, playerId, cache.resource, key, ...args);
  return new Promise((resolve, reject) => {
    pendingCallbacks[key] = resolve;
    setTimeout(reject, callbackTimeout, `callback event '${key}' timed out`);
  });
}
__name(triggerClientCallback, "triggerClientCallback");
function onClientCallback(eventName, cb) {
  onNet(`__ox_cb_${eventName}`, async (resource, key, ...args) => {
    const src = source;
    let response;
    try {
      response = await cb(src, ...args);
    } catch (e) {
      console.error(`an error occurred while handling callback event ${eventName}`);
      console.log(`^3${e.stack}^0`);
    }
    emitNet(`__ox_cb_${resource}`, src, key, response);
  });
}
__name(onClientCallback, "onClientCallback");

// game/server/apps/Contacts/callback.ts
onClientCallback("contacts:getContacts", async (client) => {
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const contacts = await MongoDB.findMany("phone_contacts", { ownerId: citizenId });
  return JSON.stringify(contacts);
});
onClientCallback("contacts:saveContact", async (client, data) => {
  const contactData = JSON.parse(data);
  if (contactData._id) {
    await MongoDB.updateOne("phone_contacts", { _id: contactData._id }, { ...contactData });
    Logger.AddLog({
      type: "phone_contacts",
      title: "Contact Updated",
      message: `Contact '${contactData.firstName}'${contactData.lastName}' (Number: ${contactData.contactNumber}) updated by ${contactData.personalNumber}.`,
      showIdentifiers: false
    });
  }
  return true;
});
onClientCallback("contacts:addContact", async (client, data) => {
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const contactData = JSON.parse(data);
  const dataX = { ...contactData, ownerId: citizenId, personalNumber: await Utils.GetPhoneNumberByCitizenId(citizenId) };
  const res = await MongoDB.insertOne("phone_contacts", dataX);
  Logger.AddLog({
    type: "phone_contacts",
    title: "Contact Added",
    message: `Contact '${contactData.firstName}'${contactData.lastName}' (Number: ${contactData.contactNumber}) added by ${dataX.personalNumber}.`,
    showIdentifiers: false
  });
  return JSON.stringify(dataX);
});
onClientCallback("contacts:deleteContact", async (client, _id) => {
  const contact = await MongoDB.findOne("phone_contacts", { _id });
  await MongoDB.deleteOne("phone_contacts", { _id });
  Logger.AddLog({
    type: "phone_contacts",
    title: "Contact Deleted",
    message: `Contact '${contact.firstName}' '${contact.lastName}' (Number: ${contact.contactNumber}) deleted by ${contact.personalNumber}.`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("contacts:favContact", async (client, _id) => {
  const contact = await MongoDB.findOne("phone_contacts", { _id });
  const dataX = { ...contact, isFav: !contact.isFav };
  await MongoDB.updateOne("phone_contacts", { _id }, dataX);
  Logger.AddLog({
    type: "phone_contacts",
    title: "Contact Favorite Toggled",
    message: `Contact '${contact.firstName}' '${contact.lastName}' (Number: ${contact.contactNumber}) favorite status set to ${dataX.isFav} by ${contact.personalNumber}.`
  });
  return JSON.stringify(dataX);
});

// game/server/apps/DarkChat/callback.ts
onClientCallback("SearchDarkChatEmail", async (client, data) => {
  const res = await MongoDB.findMany("phone_darkchat_mail", { _id: data });
  return JSON.stringify(res);
});
onClientCallback("RegisterNewDarkMailAccount", async (client, data) => {
  const { email, password } = JSON.parse(data);
  const res = await MongoDB.insertOne("phone_darkchat_mail", { _id: email, email, password, avatar: "" });
  Logger.AddLog({
    type: "phone_darkchat_accounts",
    title: "Account Registered",
    message: `New DarkChat account registered with email ${email}.`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("LoginDarkMailAccount", async (client, data) => {
  const parsedData = JSON.parse(data);
  const res = await MongoDB.findOne("phone_darkchat_mail", { _id: parsedData.email });
  if (res.password === parsedData.password) {
    Logger.AddLog({
      type: "phone_darkchat_accounts",
      title: "Account Login",
      message: `User logged into DarkChat with email ${parsedData.email}.`,
      showIdentifiers: false
    });
    return true;
  } else {
    return false;
  }
});
onClientCallback("CreateNewDarkChannel", async (client, data) => {
  var _a2, _b;
  const { name, email } = JSON.parse(data);
  const res2 = await MongoDB.findMany("phone_darkchat_channels", {});
  if (res2.find((channel) => channel.name === name) && !((_a2 = res2.find((channel) => channel.name === name)) == null ? void 0 : _a2.members.includes(email))) {
    (_b = res2.find((channel) => channel.name === name)) == null ? void 0 : _b.members.push(email);
    await MongoDB.updateOne("phone_darkchat_channels", { name }, res2.find((channel) => channel.name === name));
    Logger.AddLog({
      type: "phone_darkchat_channels",
      title: "Joined Channel",
      message: `${email} joined existing DarkChat channel '${name}'.`,
      showIdentifiers: false
    });
    return JSON.stringify(res2.filter((channel) => channel.members.includes(email)));
  } else if (!res2.find((channel) => channel.name === name)) {
    const newData = {
      _id: generateUUid(),
      name,
      members: [email],
      creator: email,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      messages: []
    };
    await MongoDB.insertOne("phone_darkchat_channels", newData);
    res2.push(newData);
    Logger.AddLog({
      type: "phone_darkchat_channels",
      title: "Channel Created",
      message: `${email} created new DarkChat channel '${name}'.`,
      showIdentifiers: false
    });
    return JSON.stringify(res2.filter((channel) => channel.members.includes(email)));
  } else {
    return false;
  }
});
onClientCallback("GetDarkChatProfile", async (client, email) => {
  const res = await MongoDB.findOne("phone_darkchat_mail", { _id: email });
  return JSON.stringify(res);
});
onClientCallback("GetDarkChatChannels", async (client, email) => {
  const res = await MongoDB.findMany("phone_darkchat_channels", { members: email });
  return JSON.stringify(res);
});
onClientCallback("RemoveFromDarkChannel", async (client, data) => {
  const { _id, email } = JSON.parse(data);
  const res = await MongoDB.findOne("phone_darkchat_channels", { _id });
  if (res.creator === email) {
    await MongoDB.deleteOne("phone_darkchat_channels", { _id });
    Logger.AddLog({
      type: "phone_darkchat_channels",
      title: "Channel Deleted",
      message: `${email} deleted DarkChat channel '${res.name}' (ID: ${_id}).`,
      showIdentifiers: false
    });
  } else {
    res.members = res.members.filter((member) => member !== email);
    await MongoDB.updateOne("phone_darkchat_channels", { _id }, res);
    Logger.AddLog({
      type: "phone_darkchat_channels",
      title: "Left Channel",
      message: `${email} left DarkChat channel '${res.name}' (ID: ${_id}).`,
      showIdentifiers: false
    });
  }
  return true;
});
onClientCallback("UpdateDarkAvatar", async (client, data) => {
  const { email, avatar } = JSON.parse(data);
  const res = await MongoDB.findOne("phone_darkchat_mail", { _id: email });
  res.avatar = avatar;
  await MongoDB.updateOne("phone_darkchat_mail", { _id: email }, res);
  Logger.AddLog({
    type: "phone_darkchat_accounts",
    title: "Avatar Updated",
    message: `${email} updated their DarkChat avatar.`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("UpdateDarkPassword", async (client, data) => {
  const { email, password } = JSON.parse(data);
  const res = await MongoDB.findOne("phone_darkchat_mail", { _id: email });
  res.password = password;
  await MongoDB.updateOne("phone_darkchat_mail", { _id: email }, res);
  Logger.AddLog({
    type: "phone_darkchat_accounts",
    title: "Password Updated",
    message: `${email} updated their DarkChat password.`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("SetDarkChatMessages", async (client, dataX) => {
  const { channel, data } = JSON.parse(dataX);
  const res = await MongoDB.updateOne("phone_darkchat_channels", { _id: channel }, data);
  Logger.AddLog({
    type: "phone_darkchat_channels",
    title: "Message Sent",
    message: `Message sent in DarkChat channel '${data.name}' (ID: ${channel}), Content: ${data.content}.`,
    showIdentifiers: false
  });
  data.members.forEach(async (member) => {
    const res2 = await Utils.GetSourceFromCitizenId(await Utils.GetCidFromDarkEmail(member));
    if (!res2) return;
    emitNet("summit_phone:client:receiveDarkChatMessage", res2, JSON.stringify(data));
    if (res2 !== client) {
      emitNet("phone:addnotiFication", res2, JSON.stringify({
        id: generateUUid(),
        title: "DarkChat",
        description: `You have a new message in ${data.name}.`,
        app: "settings",
        timeout: 5e3
      }));
    }
  });
  return true;
});

// game/server/apps/Mail/callback.ts
onClientCallback("summit_phone:getEmailMessages", async (source2, email, password) => {
  const data = await MailClass.getMailMessages(email, password);
  return data;
});
onClientCallback("summit_phone:sendEmail", async (source2, email, to, subject, message, images) => {
  const res = await MailClass.sendMail(email, to, subject, message, images, source2);
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  Logger.AddLog({
    type: "phone_mail",
    title: "Email Sent",
    message: `Player ${citizenId} sent an email from ${email} to ${to} with subject "${subject}", content: "${message}"`,
    showIdentifiers: false
  });
  return res;
});
onClientCallback("summit_phone:setSelectedMessage", async (source2, data) => {
  const res = await MailClass.selecteMessage(data);
  return res;
});
onClientCallback("summit_phone:getProfileSettings", async (source2, data) => {
  const parsedData = JSON.parse(data);
  const { email, password } = parsedData;
  const res = await MailClass.getProfileSettings(email, password);
  return res;
});
onClientCallback("summit_phone:updateProfileSettings", async (source2, data) => {
  const parsedData = JSON.parse(data);
  const { email, password, username, avatar } = parsedData;
  const res = await MailClass.updateProfileSettings(email, password, username, avatar);
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  Logger.AddLog({
    type: "phone_mail",
    title: "Profile Updated",
    message: `Player ${citizenId} updated profile for email ${email}.`,
    showIdentifiers: false
  });
  return res;
});

// game/server/apps/Messages/callback.ts
onClientCallback("phone_message:sendMessage", async (client, data) => {
  var _a2, _b;
  const { type, phoneNumber, groupId, messageData } = JSON.parse(data);
  const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
  let firstMessage = false;
  if (!senderId) {
    return JSON.stringify({ success: false, message: "Sender not found" });
  }
  let userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
  if (!userMessages) {
    userMessages = {
      _id: generateUUid(),
      citizenId: senderId,
      blockedNumbers: [],
      deletedMessages: [],
      messages: []
    };
    firstMessage = true;
  }
  let conversation;
  if (type === "private") {
    conversation = userMessages.messages.find((msg) => msg.type === "private" && msg.phoneNumber === phoneNumber);
    if (!conversation) {
      const contactName = await Utils.GetContactNameByNumber(phoneNumber, senderId) || `Unknown (${phoneNumber})`;
      const avatar = await Utils.GetContactAvatarByNumber(phoneNumber, senderId) || null;
      conversation = {
        type: "private",
        name: contactName,
        avatar,
        // Set avatar for private contact
        phoneNumber,
        messages: []
      };
      userMessages.messages.push(conversation);
    }
  } else if (type === "group") {
    conversation = userMessages.messages.find((msg) => msg.type === "group" && msg.groupId === groupId);
    if (!conversation) {
      return JSON.stringify({ success: false, message: "Group not found for sender" });
    }
  }
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const nextPage = lastMessage ? lastMessage.page + 1 : 1;
  const newMessage = {
    message: messageData.message,
    read: true,
    page: nextPage,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    senderId: senderPhoneNumber,
    attachments: messageData.attachments || []
  };
  conversation.messages.push(newMessage);
  if (!firstMessage) {
    await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages);
  } else {
    await MongoDB.insertOne("phone_messages", userMessages);
  }
  Logger.AddLog({
    type: "phone_messages",
    title: "Message Sent",
    message: `Sender ${senderPhoneNumber} sent a message to ${type === "private" ? phoneNumber : "group " + groupId} with content: ${messageData.message}`,
    showIdentifiers: false
  });
  if (type === "private") {
    const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
    if (targetCitizenId) {
      const targetMessages = await MongoDB.findOne("phone_messages", { citizenId: targetCitizenId });
      const isBlocked = (_a2 = targetMessages == null ? void 0 : targetMessages.blockedNumbers) == null ? void 0 : _a2.includes(senderPhoneNumber);
      if (!isBlocked) {
        await sendToRecipient(targetCitizenId, senderPhoneNumber, messageData, "private", phoneNumber);
        const CVXCS = await Utils.GetSourceFromCitizenId(targetCitizenId);
        if (CVXCS) {
          emitNet("phone:addnotiFication", CVXCS, JSON.stringify({
            id: generateUUid(),
            title: "Messages",
            description: "You have a new message",
            app: "message",
            timeout: 2e3
          }));
          emitNet("phone_messages:client:updateMessages", CVXCS, JSON.stringify(newMessage));
        }
      } else {
      }
    } else {
    }
  } else if (type === "group") {
    const groupConversation = userMessages.messages.find((msg) => msg.groupId === groupId);
    if (!(groupConversation == null ? void 0 : groupConversation.members)) {
      return JSON.stringify({ success: false, message: "Group members not found" });
    }
    for (const memberId of groupConversation.members) {
      if (memberId !== senderId) {
        const memberMessages = await MongoDB.findOne("phone_messages", { citizenId: memberId });
        const memberPhoneNumber = await Utils.GetPhoneNumberByCitizenId(memberId);
        const isBlocked = (_b = memberMessages == null ? void 0 : memberMessages.blockedNumbers) == null ? void 0 : _b.includes(senderPhoneNumber);
        if (!isBlocked) {
          await sendToRecipient(memberId, senderPhoneNumber, messageData, "group", void 0, groupId);
        } else {
        }
        const CVXCS = await Utils.GetSourceFromCitizenId(memberId);
        if (CVXCS) {
          emitNet("phone:addnotiFication", CVXCS, JSON.stringify({
            id: generateUUid(),
            title: "Messages",
            description: "You have a new message",
            app: "message",
            timeout: 2e3
          }));
          emitNet("phone_messages:client:updateMessages", CVXCS, JSON.stringify({ ...newMessage, groupId }));
        }
      }
    }
  }
  return JSON.stringify({ success: true });
});
async function sendToRecipient(targetCitizenId, senderPhoneNumber, messageData, type, phoneNumber, groupId) {
  let targetMessages = await MongoDB.findOne("phone_messages", { citizenId: targetCitizenId });
  let receiverFirstMessage = false;
  if (!targetMessages) {
    targetMessages = {
      _id: generateUUid(),
      citizenId: targetCitizenId,
      blockedNumbers: [],
      deletedMessages: [],
      messages: []
    };
    receiverFirstMessage = true;
  }
  let targetConversation;
  if (type === "private") {
    targetConversation = targetMessages.messages.find((msg) => msg.type === "private" && msg.phoneNumber === senderPhoneNumber);
    if (!targetConversation) {
      const contactName = await Utils.GetContactNameByNumber(senderPhoneNumber, targetCitizenId);
      const avatar = await Utils.GetContactAvatarByNumber(senderPhoneNumber, targetCitizenId) || "";
      targetConversation = {
        type: "private",
        name: contactName || `Unknown (${senderPhoneNumber})`,
        avatar,
        // Set avatar for private contact
        phoneNumber: senderPhoneNumber,
        messages: []
      };
      targetMessages.messages.push(targetConversation);
    }
  } else if (type === "group") {
    targetConversation = targetMessages.messages.find((msg) => msg.type === "group" && msg.groupId === groupId);
    if (!targetConversation) {
      const senderMessages = await MongoDB.findOne("phone_messages", { citizenId: await Utils.GetCitizenIdByPhoneNumber(senderPhoneNumber) });
      const group = senderMessages == null ? void 0 : senderMessages.messages.find((msg) => msg.groupId === groupId);
      if (!group) return;
      targetConversation = {
        type: "group",
        name: group.name,
        avatar: group.avatar || null,
        // Copy avatar from sender's group
        groupId,
        members: group.members,
        memberPhoneNumbers: group.memberPhoneNumbers,
        creatorId: group.creatorId,
        // Copy creatorId
        messages: []
      };
      targetMessages.messages.push(targetConversation);
    }
  }
  const targetLastMessage = targetConversation.messages[targetConversation.messages.length - 1];
  const targetNextPage = targetLastMessage ? targetLastMessage.page + 1 : 1;
  const targetNewMessage = {
    message: messageData.message,
    read: false,
    page: targetNextPage,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    senderId: senderPhoneNumber,
    attachments: messageData.attachments || []
  };
  targetConversation.messages.push(targetNewMessage);
  if (!receiverFirstMessage) {
    await MongoDB.updateOne("phone_messages", { _id: targetMessages._id }, targetMessages);
  } else {
    await MongoDB.insertOne("phone_messages", targetMessages);
  }
}
__name(sendToRecipient, "sendToRecipient");
onClientCallback("phone_message:createGroup", async (client, data) => {
  const { groupName, memberPhoneNumbers, avatar } = JSON.parse(data);
  const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
  if (!senderId) {
    return JSON.stringify({ success: false, message: "Sender not found" });
  }
  const memberIds = [senderId];
  const phoneNumbers = [senderPhoneNumber];
  for (const phone of memberPhoneNumbers) {
    const citizenId = await Utils.GetCitizenIdByPhoneNumber(phone);
    if (citizenId && !memberIds.includes(citizenId)) {
      memberIds.push(citizenId);
      phoneNumbers.push(phone);
    }
  }
  const groupId = generateUUid();
  const groupConversation = {
    type: "group",
    name: groupName,
    avatar: avatar || "",
    groupId,
    members: memberIds,
    memberPhoneNumbers: phoneNumbers,
    creatorId: senderId,
    // Set the creator as the sender
    messages: []
  };
  let userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
  emitNet("phone:addnotiFication", client, JSON.stringify({
    id: generateUUid(),
    title: "Messages",
    description: "You created new Group",
    app: "message",
    timeout: 2e3
  }));
  if (!userMessages) {
    userMessages = {
      _id: generateUUid(),
      citizenId: senderId,
      blockedNumbers: [],
      deletedMessages: [],
      messages: [groupConversation]
    };
    await MongoDB.insertOne("phone_messages", userMessages);
  } else {
    userMessages.messages.push(groupConversation);
    await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages);
  }
  for (const memberId of memberIds) {
    if (memberId !== senderId) {
      let memberMessages = await MongoDB.findOne("phone_messages", { citizenId: memberId });
      const CVXCS = await Utils.GetSourceFromCitizenId(memberId);
      if (CVXCS) {
        emitNet("phone:addnotiFication", CVXCS, JSON.stringify({
          id: generateUUid(),
          title: "Messages",
          description: "You have been added to a new group",
          app: "message",
          timeout: 2e3
        }));
      }
      if (!memberMessages) {
        memberMessages = {
          _id: generateUUid(),
          citizenId: memberId,
          blockedNumbers: [],
          deletedMessages: [],
          messages: [{ ...groupConversation }]
        };
        await MongoDB.insertOne("phone_messages", memberMessages);
      } else {
        memberMessages.messages.push({ ...groupConversation });
        await MongoDB.updateOne("phone_messages", { _id: memberMessages._id }, memberMessages);
      }
    }
  }
  Logger.AddLog({
    type: "phone_groups",
    title: "Group Created",
    message: `Group '${groupName}' created by ${senderPhoneNumber}. Group ID: ${groupId} with members: ${memberPhoneNumbers.join(", ")}`,
    showIdentifiers: false
  });
  return JSON.stringify({ success: true, groupId });
});
onClientCallback("phone_message:toggleBlock", async (client, data) => {
  var _a2;
  const { phoneNumber } = JSON.parse(data);
  const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
  if (!senderId) {
    return JSON.stringify({ success: false, message: "Sender not found" });
  }
  let userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
  if (!userMessages) {
    userMessages = {
      _id: generateUUid(),
      citizenId: senderId,
      blockedNumbers: [],
      deletedMessages: [],
      messages: []
    };
  }
  if (!userMessages.blockedNumbers) {
    userMessages.blockedNumbers = [];
  }
  const isBlocked = userMessages.blockedNumbers.includes(phoneNumber);
  if (isBlocked) {
    const index = userMessages.blockedNumbers.indexOf(phoneNumber);
    userMessages.blockedNumbers.splice(index, 1);
    emitNet("phone:addNotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: "Number unblocked",
      app: "message",
      timeout: 2e3
    }));
    Logger.AddLog({
      type: "phone_blocks",
      title: "Number Unblocked",
      message: `${senderPhoneNumber} unblocked ${phoneNumber}.`,
      showIdentifiers: false
    });
  } else {
    userMessages.blockedNumbers.push(phoneNumber);
    emitNet("phone:addNotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: "Number blocked",
      app: "message",
      timeout: 2e3
    }));
    Logger.AddLog({
      type: "phone_blocks",
      title: "Number Blocked",
      message: `${senderPhoneNumber} blocked ${phoneNumber}.`,
      showIdentifiers: false
    });
  }
  if (userMessages.messages.length === 0 && userMessages.blockedNumbers.length === 0 && !((_a2 = userMessages.deletedMessages) == null ? void 0 : _a2.length)) {
    await MongoDB.deleteOne("phone_messages", { _id: userMessages._id });
  } else {
    await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages);
  }
  return JSON.stringify({ success: true });
});
onClientCallback("phone_message:addMember", async (client, data) => {
  try {
    const { groupId, phoneNumber } = JSON.parse(data);
    const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
    if (!senderId) {
      return JSON.stringify({ success: false, message: "Sender not found" });
    }
    const newMemberId = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
    if (!newMemberId) {
      return JSON.stringify({ success: false, message: "Member not found" });
    }
    let userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
    if (!userMessages) {
      return JSON.stringify({ success: false, message: "Messages not found for sender" });
    }
    const group = userMessages.messages.find((msg) => msg.groupId === groupId);
    if (!group || !group.members) {
      return JSON.stringify({ success: false, message: "Group not found or unauthorized" });
    }
    if (group.members.includes(newMemberId)) {
      return JSON.stringify({ success: false, message: "Member already in group" });
    }
    group.members.push(newMemberId);
    group.memberPhoneNumbers.push(phoneNumber);
    for (const memberId of group.members) {
      let memberMessages = await MongoDB.findOne("phone_messages", { citizenId: memberId });
      if (!memberMessages) {
        memberMessages = {
          _id: generateUUid(),
          citizenId: memberId,
          blockedNumbers: [],
          deletedMessages: [],
          messages: []
        };
      }
      const memberGroup = memberMessages.messages.find((msg) => msg.groupId === groupId);
      if (memberGroup) {
        memberGroup.members = group.members;
        memberGroup.memberPhoneNumbers = group.memberPhoneNumbers;
        memberGroup.avatar = group.avatar;
        memberGroup.creatorId = group.creatorId;
      } else {
        memberMessages.messages.push({ ...group });
      }
      if (memberMessages._id) {
        await MongoDB.updateOne("phone_messages", { _id: memberMessages._id }, memberMessages).catch((error) => console.error(`Failed to update group data for member ${memberId}:`, error));
      } else {
        await MongoDB.insertOne("phone_messages", memberMessages).catch((error) => console.error(`Failed to create messages for new member ${memberId}:`, error));
      }
    }
    Logger.AddLog({
      type: "phone_groups",
      title: "Member Added",
      message: `${senderPhoneNumber} added ${phoneNumber} to group ${groupId}.`,
      showIdentifiers: false
    });
    return JSON.stringify({ success: true });
  } catch (error) {
    console.error("Error adding member to group:", error);
    return JSON.stringify({ success: false, message: "An error occurred while adding the member to the group" });
  }
});
onClientCallback("phone_message:removeMember", async (client, data) => {
  const { groupId, phoneNumber } = JSON.parse(data);
  const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
  const memberIdToRemove = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
  if (!memberIdToRemove) {
    return JSON.stringify({ success: false, message: "Member not found" });
  }
  let userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
  const group = userMessages == null ? void 0 : userMessages.messages.find((msg) => msg.groupId === groupId);
  if (!group || !group.members) {
    return JSON.stringify({ success: false, message: "Group not found or unauthorized" });
  }
  const memberIndex = group.members.indexOf(memberIdToRemove);
  if (memberIndex === -1) {
    return JSON.stringify({ success: false, message: "Member not in group" });
  }
  group.members.splice(memberIndex, 1);
  group.memberPhoneNumbers.splice(memberIndex, 1);
  for (const memberId of group.members) {
    const memberMessages = await MongoDB.findOne("phone_messages", { citizenId: memberId });
    const memberGroup = memberMessages == null ? void 0 : memberMessages.messages.find((msg) => msg.groupId === groupId);
    if (memberGroup) {
      memberGroup.members = group.members;
      memberGroup.memberPhoneNumbers = group.memberPhoneNumbers;
      memberGroup.avatar = group.avatar;
      memberGroup.creatorId = group.creatorId;
      await MongoDB.updateOne("phone_messages", { _id: memberMessages._id }, memberMessages);
    }
  }
  const removedMemberMessages = await MongoDB.findOne("phone_messages", { citizenId: memberIdToRemove });
  if (removedMemberMessages) {
    const groupIndex = removedMemberMessages.messages.findIndex((msg) => msg.groupId === groupId);
    if (groupIndex !== -1) {
      removedMemberMessages.messages.splice(groupIndex, 1);
      await MongoDB.updateOne("phone_messages", { _id: removedMemberMessages._id }, removedMemberMessages);
    }
  }
  Logger.AddLog({
    type: "phone_groups",
    title: "Member Removed",
    message: `${senderPhoneNumber} removed ${phoneNumber} from group ${groupId}.`,
    showIdentifiers: false
  });
  return JSON.stringify({ success: true });
});
onClientCallback("phone_message:deleteGroup", async (client, groupId) => {
  const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
  let userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
  const group = userMessages == null ? void 0 : userMessages.messages.find((msg) => msg.groupId === groupId);
  if (!group || !group.members) {
    return JSON.stringify({ success: false, message: "Group not found or unauthorized" });
  }
  if (group.creatorId !== senderId) {
    return JSON.stringify({ success: false, message: "Only the group creator can delete the group" });
  }
  for (const memberId of group.members) {
    const memberMessages = await MongoDB.findOne("phone_messages", { citizenId: memberId });
    const CVXCS = await Utils.GetSourceFromCitizenId(memberId);
    if (CVXCS) {
      emitNet("phone:addnotiFication", CVXCS, JSON.stringify({
        id: generateUUid(),
        title: "Messages",
        description: "Group has been deleted",
        app: "message",
        timeout: 2e3
      }));
    }
    if (memberMessages) {
      const groupIndex = memberMessages.messages.findIndex((msg) => msg.groupId === groupId);
      if (groupIndex !== -1) {
        memberMessages.messages.splice(groupIndex, 1);
        await MongoDB.updateOne("phone_messages", { _id: memberMessages._id }, memberMessages);
      }
    }
  }
  Logger.AddLog({
    type: "phone_groups",
    title: "Group Deleted",
    message: `Group ${groupId} deleted by ${senderPhoneNumber}.`,
    showIdentifiers: false
  });
  return JSON.stringify({ success: true });
});
onClientCallback("phone_message:getGroupMessages", async (client, data) => {
  const { groupId, page = 1, limit = 20 } = JSON.parse(data);
  const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  if (!senderId) {
    return JSON.stringify({ success: false, messages: [], message: "Sender not found" });
  }
  const userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
  if (!userMessages) {
    return JSON.stringify({ success: false, messages: [], message: "No messages found" });
  }
  const conversation = userMessages.messages.find((msg) => msg.type === "group" && msg.groupId === groupId);
  if (!conversation) {
    return JSON.stringify({ success: false, messages: [], message: "Conversation not found" });
  }
  const sortedMessages = conversation.messages.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedMessages = sortedMessages.slice(startIndex, endIndex);
  const hasMore = endIndex < sortedMessages.length;
  return JSON.stringify({
    success: true,
    messages: paginatedMessages,
    memberPhoneNumbers: conversation.memberPhoneNumbers || [],
    name: conversation.name,
    avatar: conversation.avatar || null,
    hasMore,
    totalMessages: sortedMessages.length,
    creatorId: conversation.creatorId
    // Include creatorId for UI or verification if needed
  });
});
onClientCallback("phone_message:getPrivateMessages", async (client, data) => {
  const { phoneNumber, page = 1, limit = 20 } = JSON.parse(data);
  const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  if (!senderId) {
    return JSON.stringify({ success: false, messages: [], message: "Sender not found" });
  }
  const userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
  if (!userMessages) {
    return JSON.stringify({ success: false, messages: [], message: "No messages found" });
  }
  const conversation = userMessages.messages.find((msg) => msg.type === "private" && msg.phoneNumber === phoneNumber);
  if (!conversation) {
    return JSON.stringify({ success: false, messages: [], message: "Conversation not found" });
  }
  const sortedMessages = conversation.messages.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedMessages = sortedMessages.slice(startIndex, endIndex);
  const hasMore = endIndex < sortedMessages.length;
  return JSON.stringify({
    success: true,
    messages: paginatedMessages,
    avatar: conversation.avatar || null,
    name: conversation.name,
    hasMore,
    totalMessages: sortedMessages.length
  });
});
onClientCallback("phone_message:getMessageChannelsandLastMessages", async (client) => {
  try {
    const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
    if (!senderId) {
      return JSON.stringify({ success: false, message: "Sender not found" });
    }
    const userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
    if (!userMessages) {
      return JSON.stringify({ success: false, message: "No messages found" });
    }
    const channels = userMessages.messages.map(async (msg) => {
      let updatedName = msg.name;
      let updatedMemberPhoneNumbers = msg.memberPhoneNumbers || [];
      if (msg.type === "private" && msg.phoneNumber) {
        const newContactName = await Utils.GetContactNameByNumber(msg.phoneNumber, senderId) || `Unknown (${msg.phoneNumber})`;
        if (newContactName !== msg.name) {
          const conversation = userMessages.messages.find((m) => m.type === "private" && m.phoneNumber === msg.phoneNumber);
          if (conversation) {
            conversation.name = newContactName;
            await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages).catch((error) => console.error(`Failed to update contact name for ${msg.phoneNumber}:`, error));
          }
          updatedName = newContactName;
        }
      } else if (msg.type === "group" && msg.memberPhoneNumbers && msg.memberPhoneNumbers.length > 0) {
        for (let i = 0; i < msg.memberPhoneNumbers.length; i++) {
          const phone = msg.memberPhoneNumbers[i];
          const newContactName = await Utils.GetContactNameByNumber(phone, senderId) || `Unknown (${phone})`;
        }
      }
      return {
        type: msg.type,
        name: updatedName,
        phoneNumber: msg.phoneNumber,
        groupId: msg.groupId,
        members: msg.members,
        avatar: msg.avatar,
        memberPhoneNumbers: updatedMemberPhoneNumbers,
        lastMessage: msg.messages[msg.messages.length - 1],
        creatorId: msg.creatorId
        // Include creatorId
      };
    });
    const resolvedChannels = await Promise.all(channels);
    return JSON.stringify({ success: true, channels: resolvedChannels });
  } catch (error) {
    console.error("Error fetching message channels and last messages:", error);
    return JSON.stringify({ success: false, message: "An error occurred while fetching message channels" });
  }
});
onClientCallback("phone_message:getMessageStats", async (client, data) => {
  const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  if (!senderId) {
    return JSON.stringify({ success: false, message: "Sender not found" });
  }
  let userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
  if (!userMessages) {
    return JSON.stringify({
      success: true,
      stats: {
        allMessages: 0,
        knownMessages: 0,
        unknownMessages: 0,
        unreadMessages: 0,
        recentlyDeleted: 0
      }
    });
  }
  const currentDate = /* @__PURE__ */ new Date();
  const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1e3);
  let allMessages = 0;
  let knownMessages = 0;
  let unknownMessages = 0;
  let unreadMessages = 0;
  let recentlyDeleted = 0;
  for (const conversation of userMessages.messages) {
    for (const message of conversation.messages) {
      allMessages += 1;
      const isKnown = conversation.name && !conversation.name.match(/^[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/);
      if (isKnown) {
        knownMessages += 1;
      } else {
        unknownMessages += 1;
      }
      if (!message.read) {
        unreadMessages += 1;
      }
    }
  }
  if (userMessages.deletedMessages) {
    recentlyDeleted = userMessages.deletedMessages.filter(
      (deleted) => deleted.timestamp > thirtyDaysAgo
    ).length;
  }
  return JSON.stringify({
    success: true,
    stats: {
      allMessages,
      knownMessages,
      unknownMessages,
      unreadMessages,
      recentlyDeleted
    }
  });
});
onClientCallback("phone_message:deleteMessage", async (client, data) => {
  const { conversationType, phoneNumber, groupId, messageIndex } = JSON.parse(data || "{}");
  const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
  if (!senderId) {
    return JSON.stringify({ success: false, message: "Sender not found" });
  }
  const userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
  if (!userMessages) {
    return JSON.stringify({ success: false, message: "Messages not found" });
  }
  let conversation;
  if (conversationType === "private" && phoneNumber) {
    conversation = userMessages.messages.find(
      (msg) => msg.type === "private" && Number(msg.phoneNumber) === Number(phoneNumber)
    );
  } else if (conversationType === "group" && groupId) {
    conversation = userMessages.messages.find(
      (msg) => msg.type === "group" && String(msg.groupId) === String(groupId)
    );
  }
  if (!conversation) {
    return JSON.stringify({ success: false, message: "Conversation not found" });
  }
  conversation.messages = conversation.messages.filter((msg) => Number(msg.page) !== Number(messageIndex));
  await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages);
  if (conversationType === "private" && phoneNumber) {
    const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(phoneNumber);
    if (targetCitizenId) {
      const targetSource = await Utils.GetSourceFromCitizenId(targetCitizenId);
      const targetMessages = await MongoDB.findOne("phone_messages", { citizenId: targetCitizenId });
      if (targetMessages) {
        const targetConversation = targetMessages.messages.find(
          (msg) => msg.type === "private" && Number(msg.phoneNumber) === Number(senderPhoneNumber)
        );
        if (targetConversation) {
          targetConversation.messages = targetConversation.messages.filter((msg) => Number(msg.page) !== Number(messageIndex));
          await MongoDB.updateOne("phone_messages", { _id: targetMessages._id }, targetMessages);
          if (await DoesPlayerExist(targetSource)) {
            emitNet("phone_messages:client:updateMessages", Number(targetSource), JSON.stringify(targetMessages));
          }
        }
      }
    }
  }
  emitNet("phone_messages:client:updateMessages", Number(client), JSON.stringify(userMessages));
  Logger.AddLog({
    type: "phone_messages",
    title: "Message Deleted",
    message: `Message deleted from ${conversationType} conversation with ${phoneNumber || groupId} by ${senderPhoneNumber}`,
    showIdentifiers: false
  });
  return JSON.stringify({ success: true });
});
onClientCallback("phone_message:updateGroupName", async (client, data) => {
  try {
    const { groupId, newName } = JSON.parse(data);
    const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
    if (!senderId) {
      return JSON.stringify({ success: false, message: "Sender not found" });
    }
    let userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
    if (!userMessages) {
      return JSON.stringify({ success: false, message: "Messages not found for sender" });
    }
    const group = userMessages.messages.find((msg) => msg.groupId === groupId);
    if (!group) {
      return JSON.stringify({ success: false, message: "Group not found" });
    }
    if (group.creatorId !== senderId) {
      return JSON.stringify({ success: false, message: "Only the group creator can update the group name" });
    }
    const oldName = group.name;
    group.name = newName;
    for (const memberId of group.members || []) {
      const memberMessages = await MongoDB.findOne("phone_messages", { citizenId: memberId });
      if (memberMessages) {
        const memberGroup = memberMessages.messages.find((msg) => msg.groupId === groupId);
        if (memberGroup) {
          memberGroup.name = newName;
          await MongoDB.updateOne("phone_messages", { _id: memberMessages._id }, memberMessages).catch((error) => console.error(`Failed to update group name for member ${memberId}:`, error));
        } else {
          console.warn(`Group not found in member ${memberId}'s messages`);
        }
      } else {
        console.warn(`No messages found for member ${memberId}`);
      }
    }
    await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages).catch((error) => console.error(`Failed to update group name for sender ${senderId}:`, error));
    Logger.AddLog({
      type: "phone_groups",
      title: "Group Name Updated",
      message: `Group ${groupId} | ${oldName} name updated to ${newName} by ${senderPhoneNumber}.`,
      showIdentifiers: false
    });
    return JSON.stringify({ success: true });
  } catch (error) {
    console.error("Error updating group name:", error);
    return JSON.stringify({ success: false, message: "An error occurred while updating the group name" });
  }
});
onClientCallback("phone_message:updateGroupAvatar", async (client, data) => {
  try {
    const { groupId, newAvatar } = JSON.parse(data);
    const senderId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
    const senderPhoneNumber = await Utils.GetPhoneNumberByCitizenId(senderId);
    if (!senderId) {
      return JSON.stringify({ success: false, message: "Sender not found" });
    }
    let userMessages = await MongoDB.findOne("phone_messages", { citizenId: senderId });
    if (!userMessages) {
      return JSON.stringify({ success: false, message: "Messages not found for sender" });
    }
    const group = userMessages.messages.find((msg) => msg.groupId === groupId);
    if (!group) {
      return JSON.stringify({ success: false, message: "Group not found" });
    }
    if (group.creatorId !== senderId) {
      return JSON.stringify({ success: false, message: "Only the group creator can update the group avatar" });
    }
    group.avatar = newAvatar;
    for (const memberId of group.members || []) {
      const memberMessages = await MongoDB.findOne("phone_messages", { citizenId: memberId });
      if (memberMessages) {
        const memberGroup = memberMessages.messages.find((msg) => msg.groupId === groupId);
        if (memberGroup) {
          memberGroup.avatar = newAvatar;
          await MongoDB.updateOne("phone_messages", { _id: memberMessages._id }, memberMessages).catch((error) => console.error(`Failed to update group avatar for member ${memberId}:`, error));
        } else {
          console.warn(`Group not found in member ${memberId}'s messages`);
        }
      } else {
        console.warn(`No messages found for member ${memberId}`);
      }
    }
    await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages).catch((error) => console.error(`Failed to update group avatar for sender ${senderId}:`, error));
    Logger.AddLog({
      type: "phone_groups",
      title: "Group Avatar Updated",
      message: `Group ${groupId} avatar updated by ${senderPhoneNumber}.`,
      showIdentifiers: false
    });
    return JSON.stringify({ success: true });
  } catch (error) {
    console.error("Error updating group avatar:", error);
    return JSON.stringify({ success: false, message: "An error occurred while updating the group avatar" });
  }
});

// game/server/apps/Phone/callHistoryManager.ts
var _CallHistoryManager = class _CallHistoryManager {
  async recordTwoPartyCallHistory(call, callerStatus, calleeStatus, endTime, targetPhoneNumber) {
    const callTime = (endTime.getTime() - call.startTime.getTime()) / 1e3;
    const timestamp = endTime.toISOString();
    const calleeArray = Array.from(call.participants.values()).filter(
      (participant) => participant.phoneNumber !== call.host.phoneNumber
    );
    let calleePhone;
    if (calleeArray.length < 1) {
      if (targetPhoneNumber) {
        calleePhone = targetPhoneNumber;
      } else {
        console.error("No callee found for two-party call after filtering out host");
        return;
      }
    } else {
      calleePhone = calleeArray[0].phoneNumber;
    }
    const callerRecord = {
      callId: call.callId,
      role: "caller",
      myPhoneNumber: call.host.phoneNumber,
      otherPartyPhoneNumber: calleePhone,
      status: callerStatus,
      callTime,
      callTimestamp: timestamp
    };
    const calleeRecord = {
      callId: call.callId,
      role: "callee",
      myPhoneNumber: calleePhone,
      otherPartyPhoneNumber: call.host.phoneNumber,
      status: calleeStatus,
      callTime,
      callTimestamp: timestamp
    };
    try {
      await MongoDB.insertOne("call_history", callerRecord);
      await MongoDB.insertOne("call_history", calleeRecord);
    } catch (error) {
      console.error("Failed to record two-party call history:", error);
    }
  }
  async getPlayerCallHistory(phoneNumber, maxRecords) {
    const query = { myPhoneNumber: phoneNumber };
    const options = { sort: { _id: -1 }, limit: maxRecords };
    try {
      const result = await MongoDB.findMany("call_history", query, () => {
      }, false, options);
      return result;
    } catch (error) {
      console.error("Error retrieving call history for phone number:", phoneNumber, error);
      return [];
    }
  }
};
__name(_CallHistoryManager, "CallHistoryManager");
var CallHistoryManager = _CallHistoryManager;
var callHistoryManager = new CallHistoryManager();

// game/server/apps/Phone/CallManager.ts
var _CallManager = class _CallManager {
  calls = /* @__PURE__ */ new Map();
  playerCallMap = /* @__PURE__ */ new Map();
  ringToneManger = /* @__PURE__ */ new Map();
  createCall(host) {
    const callId = Math.floor(Math.random() * 1e6);
    const newCall = {
      callId,
      host,
      participants: /* @__PURE__ */ new Map(),
      pending: /* @__PURE__ */ new Map(),
      startTime: /* @__PURE__ */ new Date()
    };
    newCall.participants.set(host.source, host);
    this.calls.set(callId, newCall);
    this.playerCallMap.set(host.source, callId);
    return callId;
  }
  getCallHost(callId) {
    const call = this.calls.get(callId);
    if (!call) return;
    return call.host;
  }
  isPlayerInCall(source2) {
    return this.playerCallMap.has(source2);
  }
  getCallByPlayer(source2) {
    const callId = this.playerCallMap.get(source2);
    if (callId) {
      return this.calls.get(callId);
    }
    return void 0;
  }
  getCallIdByPlayer(source2) {
    return this.playerCallMap.get(source2);
  }
  addPendingInvitation(callId, targetSource, timeoutCallback, timeoutMs = 3e4) {
    const call = this.calls.get(callId);
    if (!call) return;
    if (call.pending.has(targetSource) || call.participants.has(targetSource)) return;
    const timeout = setTimeout(() => {
      timeoutCallback();
      this.removePendingInvitation(callId, targetSource);
    }, timeoutMs);
    call.pending.set(targetSource, timeout);
  }
  removePendingInvitation(callId, targetSource) {
    const call = this.calls.get(callId);
    if (!call) return;
    if (call.pending.has(targetSource)) {
      clearTimeout(call.pending.get(targetSource));
      call.pending.delete(targetSource);
    }
  }
  acceptInvitation(callId, participant) {
    const call = this.calls.get(callId);
    if (!call) return false;
    if (call.participants.has(participant.source)) return false;
    call.participants.set(participant.source, participant);
    this.playerCallMap.set(participant.source, callId);
    if (call.pending.has(participant.source)) {
      clearTimeout(call.pending.get(participant.source));
      call.pending.delete(participant.source);
    }
    return true;
  }
  declineInvitation(callId, targetSource) {
    this.removePendingInvitation(callId, targetSource);
  }
  async removeParticipant(callId, source2) {
    const call = this.calls.get(callId);
    if (!call) return;
    emitNet("phone:client:endCallAnimation", source2);
    call.participants.delete(source2);
    this.playerCallMap.delete(source2);
    if (source2 === call.host.source || call.participants.size <= 1) {
      await callHistoryManager.recordTwoPartyCallHistory(call, "completed", "completed", /* @__PURE__ */ new Date());
      this.endCall(callId);
    }
  }
  endCall(callId) {
    const call = this.calls.get(callId);
    if (!call) return;
    for (const participant of call.participants.values()) {
      emitNet("phone:client:endCallAnimation", participant.source);
    }
    for (const timeout of call.pending.values()) {
      clearTimeout(timeout);
    }
    for (const participant of call.participants.values()) {
      this.playerCallMap.delete(participant.source);
    }
    this.calls.delete(callId);
  }
  removeFromCall(callId, source2) {
    const call = this.calls.get(callId);
    if (!call) return;
    call.participants.delete(source2);
    this.playerCallMap.delete(source2);
  }
  setHoldStatus(callId, source2, hold) {
    const call = this.calls.get(callId);
    if (!call) return false;
    const participant = call.participants.get(source2);
    if (!participant) return false;
    participant.onHold = hold;
    return true;
  }
  getParticipants(callId) {
    const call = this.calls.get(callId);
    if (!call) return [];
    return Array.from(call.participants.values());
  }
  getAllCalls() {
    return this.calls.values();
  }
  async createRingTone(source2, ringtoneLink, volume) {
    const ped = GetPlayerPed(source2);
    const pedId = NetworkGetNetworkIdFromEntity(ped);
    const soundId = await exports["soundhandler"].StartAttachSound(ringtoneLink, pedId, 5, GetGameTimer(), true, 0.15);
    this.ringToneManger.set(source2, soundId);
  }
  async stopRingTone(source2) {
    const soundId = this.ringToneManger.get(source2);
    if (!soundId) return;
    exports["soundhandler"].StopSound(soundId);
    this.ringToneManger.delete(source2);
  }
};
__name(_CallManager, "CallManager");
var CallManager = _CallManager;
var callManager = new CallManager();

// game/server/apps/Settings/class.ts
var _Setting = class _Setting {
  _id = /* @__PURE__ */ new Map();
  background = /* @__PURE__ */ new Map();
  lockscreen = /* @__PURE__ */ new Map();
  ringtone = /* @__PURE__ */ new Map();
  showStartupScreen = /* @__PURE__ */ new Map();
  showNotifications = /* @__PURE__ */ new Map();
  isLock = /* @__PURE__ */ new Map();
  lockPin = /* @__PURE__ */ new Map();
  usePin = /* @__PURE__ */ new Map();
  useFaceId = /* @__PURE__ */ new Map();
  faceIdIdentifier = /* @__PURE__ */ new Map();
  smrtId = /* @__PURE__ */ new Map();
  smrtPassword = /* @__PURE__ */ new Map();
  isFlightMode = /* @__PURE__ */ new Map();
  phoneNumber = /* @__PURE__ */ new Map();
  darkMailIdAttached = /* @__PURE__ */ new Map();
  pigeonIdAttached = /* @__PURE__ */ new Map();
  // No automatic cleanup - only remove on player disconnect
  seedFromDoc(doc) {
    if (!(doc == null ? void 0 : doc._id)) return;
    const id = doc._id;
    this._id.set(id, id);
    this.background.set(id, doc.background ?? { current: "", wallpapers: [] });
    this.lockscreen.set(id, doc.lockscreen ?? { current: "", wallpapers: [] });
    this.ringtone.set(id, doc.ringtone ?? { current: "https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3", ringtones: [{ name: "default", url: "https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3" }] });
    this.showStartupScreen.set(id, doc.showStartupScreen ?? true);
    this.showNotifications.set(id, doc.showNotifications ?? true);
    this.isLock.set(id, doc.isLock ?? true);
    this.lockPin.set(id, doc.lockPin ?? "");
    this.usePin.set(id, doc.usePin ?? false);
    this.useFaceId.set(id, doc.useFaceId ?? false);
    this.faceIdIdentifier.set(id, doc.faceIdIdentifier ?? id);
    this.darkMailIdAttached.set(id, doc.darkMailIdAttached ?? "");
    this.smrtId.set(id, doc.smrtId ?? "");
    this.smrtPassword.set(id, doc.smrtPassword ?? "");
    this.isFlightMode.set(id, doc.isFlightMode ?? false);
    this.phoneNumber.set(id, doc.phoneNumber ?? "");
    this.pigeonIdAttached.set(id, doc.pigeonIdAttached ?? "");
  }
  async ensurePlayerSettings(citizenId) {
    var _a2, _b, _c, _d;
    if (!citizenId) return;
    if (this._id.has(citizenId)) return;
    const doc = await ((_b = (_a2 = MongoDB).findOne) == null ? void 0 : _b.call(_a2, "phone_settings", { _id: citizenId }));
    if (doc) {
      this.seedFromDoc(doc);
      return;
    }
    this.RegisterNewSettings(citizenId, "");
    await ((_d = (_c = MongoDB).insertOne) == null ? void 0 : _d.call(_c, "phone_settings", {
      _id: citizenId,
      background: this.background.get(citizenId),
      lockscreen: this.lockscreen.get(citizenId),
      ringtone: this.ringtone.get(citizenId),
      showStartupScreen: this.showStartupScreen.get(citizenId),
      showNotifications: this.showNotifications.get(citizenId),
      isLock: this.isLock.get(citizenId),
      lockPin: this.lockPin.get(citizenId),
      usePin: this.usePin.get(citizenId),
      useFaceId: this.useFaceId.get(citizenId),
      faceIdIdentifier: this.faceIdIdentifier.get(citizenId),
      darkMailIdAttached: this.darkMailIdAttached.get(citizenId),
      smrtId: this.smrtId.get(citizenId),
      smrtPassword: this.smrtPassword.get(citizenId),
      isFlightMode: this.isFlightMode.get(citizenId),
      phoneNumber: this.phoneNumber.get(citizenId),
      pigeonIdAttached: this.pigeonIdAttached.get(citizenId)
    }));
  }
  async load() {
    try {
      const res = await MongoDB.findMany("phone_settings", {});
      for (const data of res) {
        this.seedFromDoc(data);
      }
      LOGGER(`[Settings] Loaded.`);
    } catch (error) {
      LOGGER(`[Settings] Failed to load settings: ${error.message}`);
    }
  }
  async save() {
    try {
      for (const [key, value] of this._id) {
        await MongoDB.updateOne("phone_settings", { _id: key }, {
          _id: key,
          background: this.background.get(key),
          lockscreen: this.lockscreen.get(key),
          ringtone: this.ringtone.get(key),
          showStartupScreen: this.showStartupScreen.get(key),
          showNotifications: this.showNotifications.get(key),
          isLock: this.isLock.get(key),
          lockPin: this.lockPin.get(key),
          usePin: this.usePin.get(key),
          useFaceId: this.useFaceId.get(key),
          faceIdIdentifier: this.faceIdIdentifier.get(key),
          darkMailIdAttached: this.darkMailIdAttached.get(key),
          smrtId: this.smrtId.get(key),
          smrtPassword: this.smrtPassword.get(key),
          isFlightMode: this.isFlightMode.get(key),
          phoneNumber: this.phoneNumber.get(key),
          pigeonIdAttached: this.pigeonIdAttached.get(key)
        });
      }
      LOGGER(`[Settings] Saved successfully.`);
      return true;
    } catch (error) {
      LOGGER(`[Settings] Failed to save settings: ${error.message}`);
      return false;
    }
  }
  RegisterNewSettings(citizenId, number) {
    this._id.set(citizenId, citizenId);
    this.background.set(citizenId, { current: "", wallpapers: [] });
    this.lockscreen.set(citizenId, { current: "", wallpapers: [] });
    this.ringtone.set(citizenId, { current: "https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3", ringtones: [{ name: "default", url: "https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3" }] });
    this.showStartupScreen.set(citizenId, true);
    this.showNotifications.set(citizenId, true);
    this.isLock.set(citizenId, true);
    this.lockPin.set(citizenId, "");
    this.usePin.set(citizenId, false);
    this.phoneNumber.set(citizenId, number);
    this.useFaceId.set(citizenId, false);
    this.faceIdIdentifier.set(citizenId, citizenId);
    this.darkMailIdAttached.set(citizenId, "");
    this.smrtId.set(citizenId, "");
    this.smrtPassword.set(citizenId, "");
    this.isFlightMode.set(citizenId, false);
    this.pigeonIdAttached.set(citizenId, "");
  }
  async SavePlayerSettings(citizenId) {
    try {
      await this.ensurePlayerSettings(citizenId);
      await MongoDB.updateOne("phone_settings", { _id: citizenId }, {
        _id: citizenId,
        background: this.background.get(citizenId),
        lockscreen: this.lockscreen.get(citizenId),
        ringtone: this.ringtone.get(citizenId),
        showStartupScreen: this.showStartupScreen.get(citizenId),
        showNotifications: this.showNotifications.get(citizenId),
        isLock: this.isLock.get(citizenId),
        lockPin: this.lockPin.get(citizenId),
        usePin: this.usePin.get(citizenId),
        useFaceId: this.useFaceId.get(citizenId),
        faceIdIdentifier: this.faceIdIdentifier.get(citizenId),
        darkMailIdAttached: this.darkMailIdAttached.get(citizenId),
        smrtId: this.smrtId.get(citizenId),
        smrtPassword: this.smrtPassword.get(citizenId),
        isFlightMode: this.isFlightMode.get(citizenId),
        phoneNumber: this.phoneNumber.get(citizenId),
        pigeonIdAttached: this.pigeonIdAttached.get(citizenId)
      });
      LOGGER(`[Settings] Saved player settings for ${citizenId} successfully.`);
      return true;
    } catch (error) {
      LOGGER(`[Settings] Failed to save player settings for ${citizenId}: ${error.message}`);
      return false;
    }
  }
  // Remove player data only when player disconnects
  onPlayerDisconnect(citizenId) {
    this.removePlayerData(citizenId);
    LOGGER(`[Settings] Cleaned up data for disconnected player ${citizenId}`);
  }
  // Remove player data from all maps
  removePlayerData(citizenId) {
    this._id.delete(citizenId);
    this.background.delete(citizenId);
    this.lockscreen.delete(citizenId);
    this.ringtone.delete(citizenId);
    this.showStartupScreen.delete(citizenId);
    this.showNotifications.delete(citizenId);
    this.isLock.delete(citizenId);
    this.lockPin.delete(citizenId);
    this.usePin.delete(citizenId);
    this.useFaceId.delete(citizenId);
    this.faceIdIdentifier.delete(citizenId);
    this.smrtId.delete(citizenId);
    this.smrtPassword.delete(citizenId);
    this.isFlightMode.delete(citizenId);
    this.phoneNumber.delete(citizenId);
    this.darkMailIdAttached.delete(citizenId);
    this.pigeonIdAttached.delete(citizenId);
  }
  // Public method to manually clean up a specific player (for admin commands)
  cleanupPlayer(citizenId) {
    this.removePlayerData(citizenId);
    LOGGER(`[Settings] Manually cleaned up data for player ${citizenId}`);
  }
};
__name(_Setting, "Setting");
var Setting = _Setting;
var Settings = new Setting();

// game/server/apps/Phone/callback.ts
onClientCallback("summit_phone:server:call", async (source2, data) => {
  var _a2;
  const { number, _id, volume } = JSON.parse(data);
  const targetPlayer = await Utils.GetPlayerFromPhoneNumber(number);
  const targetData = await MongoDB.findOne("phone_contacts", { contactNumber: number, personalNumber: await Utils.GetPhoneNumberBySource(source2) });
  const sourceData = await MongoDB.findOne("phone_contacts", {
    contactNumber: await Utils.GetPhoneNumberBySource(source2),
    personalNumber: number
  });
  if (!targetPlayer) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2e3
    }));
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const callerRecord = {
      callId: Math.floor(Math.random() * 1e6),
      role: "caller",
      myPhoneNumber: await Utils.GetPhoneNumberBySource(source2),
      otherPartyPhoneNumber: number,
      status: "unanswered",
      callTime: 0,
      callTimestamp: timestamp
    };
    const calleeRecord = {
      callId: Math.floor(Math.random() * 1e6),
      role: "callee",
      myPhoneNumber: number,
      otherPartyPhoneNumber: await Utils.GetPhoneNumberBySource(source2),
      status: "missed",
      callTime: 0,
      callTimestamp: timestamp
    };
    await Delay(1e3);
    await MongoDB.insertOne("call_history", callerRecord);
    await Delay(1e3);
    await MongoDB.insertOne("call_history", calleeRecord);
    return false;
  }
  const targetSource = targetPlayer.PlayerData.source;
  if (callManager.isPlayerInCall(source2)) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Call Error",
      description: "You are already in a call",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  if (callManager.isPlayerInCall(targetSource)) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Call Busy",
      description: "Target is already in a call",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  const sourcePhone = await Utils.GetPhoneNumberBySource(source2);
  const targetPhone = await Utils.GetPhoneNumberBySource(targetSource);
  const sourceCitizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  const targetCitizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(targetSource);
  const IsNumberBlocked = await Utils.IsNumberBlocked(targetPhone, sourcePhone);
  const sourceFlightMode = await Utils.InFlightMode(sourceCitizenId);
  const targetFlightMode = await Utils.InFlightMode(targetCitizenId);
  if (sourceFlightMode) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Flight Mode",
      description: "You cannot make calls while in flight mode",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  } else if (targetFlightMode) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is unreachable",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  if (IsNumberBlocked) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  const ShourceNumberBlocked = await Utils.IsNumberBlocked(sourcePhone, targetPhone);
  if (ShourceNumberBlocked) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Number Blocked",
      description: "Unblock the number to call",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  const targetHasPhone = await Utils.HasPhone(targetSource);
  if (!targetHasPhone) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2e3
    }));
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const callerRecord = {
      callId: Math.floor(Math.random() * 1e6),
      role: "caller",
      myPhoneNumber: sourcePhone,
      otherPartyPhoneNumber: targetPhone,
      status: "unanswered",
      callTime: 0,
      callTimestamp: timestamp
    };
    const calleeRecord = {
      callId: Math.floor(Math.random() * 1e6),
      role: "callee",
      myPhoneNumber: targetPhone,
      otherPartyPhoneNumber: sourcePhone,
      status: "missed",
      callTime: 0,
      callTimestamp: timestamp
    };
    await Delay(1e3);
    await MongoDB.insertOne("call_history", callerRecord);
    await Delay(1e3);
    await MongoDB.insertOne("call_history", calleeRecord);
    return false;
  }
  const hostParticipant = {
    source: source2,
    citizenId: sourceCitizenId,
    phoneNumber: sourcePhone,
    onHold: false
  };
  const callId = callManager.createCall(hostParticipant);
  callManager.createRingTone(targetSource, String((_a2 = Settings.ringtone.get(targetCitizenId)) == null ? void 0 : _a2.current), volume);
  callManager.addPendingInvitation(callId, targetSource, () => {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Call Timeout",
      description: "Call was not answered by target",
      app: "settings",
      timeout: 2e3
    }));
    emitNet("phone:addnotiFication", targetSource, JSON.stringify({
      id: generateUUid(),
      title: "Missed Call",
      description: "You missed a call",
      app: "settings",
      timeout: 2e3
    }));
    (async () => {
      const call = callManager.getCallByPlayer(source2);
      if (call) {
        await callHistoryManager.recordTwoPartyCallHistory(call, "unanswered", "missed", /* @__PURE__ */ new Date(), targetPhone);
      }
      callManager.endCall(callId);
      callManager.stopRingTone(targetSource);
    })();
    exports["pma-voice"].setPlayerCall(source2, 0);
    exports["pma-voice"].setPlayerCall(targetSource, 0);
    emitNet("phone:client:removeActionNotification", targetSource, _id);
    emitNet("phone:client:removeCallingInterface", source2);
  }, 2e4);
  const sourceName = sourceData ? `${sourceData.firstName} ${sourceData.lastName}` : await Utils.GetPhoneNumberBySource(source2);
  const targetName = targetData ? `${targetData.firstName} ${targetData.lastName}` : number;
  emitNet("phone:addActionNotification", targetSource, JSON.stringify({
    id: _id,
    title: "Incoming Call",
    description: `${sourceName} is calling you`,
    app: "phone",
    icons: {
      "0": {
        icon: "https://ignis-rp.com/uploads/server/phone/cross-circle.svg",
        isServer: true,
        event: "phone:server:declineCall",
        args: JSON.stringify({
          callId,
          targetSource,
          sourceName,
          targetName,
          callerSource: source2,
          databaseTableId: _id
        })
      },
      "1": {
        icon: "https://ignis-rp.com/uploads/server/phone/accept.svg",
        isServer: true,
        event: "phone:server:acceptCall",
        args: JSON.stringify({
          callId,
          targetSource,
          sourceName: targetName,
          targetName: sourceName,
          callerSource: source2,
          databaseTableId: _id
        })
      }
    }
  }));
  emitNet("summit_phone:server:addCallinginterface", source2, JSON.stringify({
    callId,
    targetSource,
    targetName,
    callerSource: source2,
    databaseTableId: _id
  }));
  Logger.AddLog({
    type: "phone_calls",
    title: "Call Initiated",
    message: `${sourcePhone} initiated a call to ${targetPhone} (Call ID: ${callId}).`,
    showIdentifiers: false
  });
  return true;
});
onNet("summit_phone:server:declineCall", async (data) => {
  const source2 = global.source;
  const { callId, targetSource, callerSource, databaseTableId } = JSON.parse(data);
  callManager.declineInvitation(callId, targetSource);
  const call = callManager.getCallByPlayer(callerSource);
  if (call) {
    await callHistoryManager.recordTwoPartyCallHistory(call, "declined", "declined", /* @__PURE__ */ new Date());
  }
  callManager.endCall(callId);
  callManager.stopRingTone(targetSource);
  if (!targetSource || !callerSource) {
    return;
  }
  emitNet("phone:client:removeActionNotification", targetSource, databaseTableId);
  emitNet("phone:client:removeCallingInterface", callerSource);
  Logger.AddLog({
    type: "phone_calls",
    title: "Call Declined",
    message: `${await Utils.GetPhoneNumberBySource(targetSource)} declined the call from ${await Utils.GetPhoneNumberBySource(callerSource)} (Call ID: ${callId}).`,
    showIdentifiers: false
  });
});
onClientCallback("summit_phone:server:endCall", async (source2, data) => {
  const { callId } = JSON.parse(data);
  const call = callManager.getCallByPlayer(source2);
  if (!call || call.callId !== callId) return false;
  const callHost = callManager.getCallHost(callId);
  if (callHost && callHost.source === source2 || callManager.getParticipants(callId).length <= 1) {
    for (const participant of callManager.getParticipants(callId)) {
      emitNet("phone:client:removeAccpetedCallingInterface", participant.source);
      exports["pma-voice"].setPlayerCall(participant.source, 0);
    }
    await callHistoryManager.recordTwoPartyCallHistory(call, "completed", "completed", /* @__PURE__ */ new Date());
    callManager.endCall(callId);
    Logger.AddLog({
      type: "phone_calls",
      title: "Call Ended",
      message: `Call ended by ${await Utils.GetPhoneNumberBySource(source2)} (Call ID: ${callId}).`,
      showIdentifiers: false
    });
  } else if (callManager.getParticipants(callId).length > 2) {
    emitNet("phone:client:removeAccpetedCallingInterface", source2);
    emitNet("phone:client:removeCallingInterface", source2);
    exports["pma-voice"].setPlayerCall(source2, 0);
    callManager.removeFromCall(callId, source2);
    Logger.AddLog({
      type: "phone_calls",
      title: "Participant Left Call",
      message: `${await Utils.GetPhoneNumberBySource(source2)} left the conference call (Call ID: ${callId}).`,
      showIdentifiers: false
    });
  } else {
    for (const participant of callManager.getParticipants(callId)) {
      emitNet("phone:client:removeAccpetedCallingInterface", participant.source);
      exports["pma-voice"].setPlayerCall(participant.source, 0);
    }
    await callHistoryManager.recordTwoPartyCallHistory(call, "completed", "completed", /* @__PURE__ */ new Date());
    callManager.endCall(callId);
    Logger.AddLog({
      type: "phone_calls",
      title: "Call Ended",
      message: `Call ended by ${await Utils.GetPhoneNumberBySource(source2)} (Call ID: ${callId}).`,
      showIdentifiers: false
    });
  }
  return true;
});
onClientCallback("summit_phone:server:addPlayerToCall", async (source2, data) => {
  var _a2;
  const { contactNumber, _id, volume } = JSON.parse(data);
  const targetData = await MongoDB.findOne("phone_contacts", { _id });
  const sourceData = await MongoDB.findOne("phone_contacts", {
    contactNumber: await Utils.GetPhoneNumberBySource(source2),
    personalNumber: contactNumber
  });
  const callId = callManager.getCallIdByPlayer(source2);
  const call = callManager.getCallByPlayer(source2);
  if (!call) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Call Error",
      description: "No ongoing call found",
      app: "phone",
      timeout: 2e3
    }));
    return false;
  }
  const sourcePhone = await Utils.GetPhoneNumberBySource(source2);
  const targetPlayer = await Utils.GetPlayerFromPhoneNumber(contactNumber);
  if (!targetPlayer) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to add is not reachable",
      app: "phone",
      timeout: 2e3
    }));
    return false;
  }
  const targetSource = targetPlayer.PlayerData.source;
  const IsNumberBlocked = await Utils.IsNumberBlocked(contactNumber, sourcePhone);
  const sourceCitizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(contactNumber);
  const sourceFlightMode = await Utils.InFlightMode(sourceCitizenId);
  const targetFlightMode = await Utils.InFlightMode(targetCitizenId);
  if (sourceFlightMode) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Flight Mode",
      description: "You cannot make calls while in flight mode",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  } else if (targetFlightMode) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is unreachable",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  if (IsNumberBlocked) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  const ShourceNumberBlocked = await Utils.IsNumberBlocked(sourcePhone, contactNumber);
  if (ShourceNumberBlocked) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Number Blocked",
      description: "Unblock the number to call",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  const targetHasPhone = await Utils.HasPhone(targetSource);
  if (!targetHasPhone) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  if (call.participants.has(targetSource)) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Already in Call",
      description: "Player is already in the call",
      app: "phone",
      timeout: 2e3
    }));
    return false;
  }
  callManager.createRingTone(targetSource, String((_a2 = Settings.ringtone.get(targetCitizenId)) == null ? void 0 : _a2.current), volume);
  callManager.addPendingInvitation(Number(callId), targetSource, () => {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Call Timeout",
      description: "Player did not answer conference call invitation",
      app: "phone",
      timeout: 2e3
    }));
    callManager.stopRingTone(targetSource);
  }, 3e4);
  const sourceName = sourceData ? `${sourceData.firstName} ${sourceData.lastName}` : await Utils.GetPhoneNumberBySource(source2);
  const targetName = targetData ? `${targetData.firstName} ${targetData.lastName}` : contactNumber;
  emitNet("phone:addActionNotification", targetSource, JSON.stringify({
    id: _id,
    title: "Incoming Conference Call",
    description: `${sourceName} is adding you to a conference call`,
    app: "phone",
    icons: {
      "0": {
        icon: "https://ignis-rp.com/uploads/server/phone/cross-circle.svg",
        isServer: true,
        event: "phone:server:declineCall",
        args: JSON.stringify({
          callId,
          targetSource,
          targetName,
          callerSource: source2,
          databaseTableId: _id
        })
      },
      "1": {
        icon: "https://ignis-rp.com/uploads/server/phone/accept.svg",
        isServer: true,
        event: "phone:server:acceptConferenceCall",
        args: JSON.stringify({
          callId,
          targetSource,
          sourceName: targetName,
          targetName: sourceName,
          callerSource: source2,
          databaseTableId: _id
        })
      }
    }
  }));
  Logger.AddLog({
    type: "phone_calls",
    title: "Player Added to Call",
    message: `${sourcePhone} added ${contactNumber} to conference call (Call ID: ${callId}).`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("phone:server:getCallHistory", async (source2, maxRecordsX) => {
  let maxRecords = 100;
  try {
    if (maxRecordsX) {
      maxRecords = maxRecordsX;
    }
  } catch (error) {
    console.error("Error parsing getCallHistory data", error);
  }
  const phoneNumber = await Utils.GetPhoneNumberBySource(source2);
  try {
    const history = await callHistoryManager.getPlayerCallHistory(phoneNumber, maxRecords);
    return JSON.stringify(history);
  } catch (error) {
    console.error("Error retrieving call history for phone number:", phoneNumber, error);
    return JSON.stringify([]);
  }
});
onClientCallback("phone:server:getDataFromDBwithNumber", async (source2, data) => {
  const parsedData = JSON.parse(data);
  const res = await MongoDB.findOne("phone_contacts", { contactNumber: parsedData.number, ownerId: parsedData.citizenId });
  return JSON.stringify(res);
});
onClientCallback("phone:server:toggleBlockNumber", async (source2, data) => {
  const parsedData = JSON.parse(data);
  const personalNumber = parsedData.personalNumber;
  const contactNumber = parsedData.contactNumber;
  let IsNumberBlocked = await Utils.IsNumberBlocked(personalNumber, contactNumber);
  if (!IsNumberBlocked) {
    await Utils.BlockNumber(personalNumber, contactNumber);
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Number Blocked",
      description: "Number has been blocked",
      app: "phone",
      timeout: 2e3
    }));
    return true;
  } else {
    await Utils.UnblockNumber(personalNumber, contactNumber);
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Number Unblocked",
      description: "Number has been unblocked",
      app: "phone",
      timeout: 2e3
    }));
    return false;
  }
});
onClientCallback("summit_phone:server:jailCall", async (source2, data) => {
  var _a2;
  const { number, volume } = JSON.parse(data);
  const targetPlayer = await Utils.GetPlayerFromPhoneNumber(number);
  if (!targetPlayer) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  const targetSource = targetPlayer.PlayerData.source;
  if (callManager.isPlayerInCall(source2)) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Call Error",
      description: "You are already in a call",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  if (callManager.isPlayerInCall(targetSource)) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Call Busy",
      description: "Target is already in a call",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  const sourcePhone = "JAIL_PHONE";
  const targetPhone = await Utils.GetPhoneNumberBySource(targetSource);
  const sourceCitizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  const targetCitizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(targetSource);
  const targetHasPhone = await Utils.HasPhone(targetSource);
  if (!targetHasPhone) {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Service Unavailable",
      description: "Person you are trying to call is not reachable",
      app: "settings",
      timeout: 2e3
    }));
    return false;
  }
  const hostParticipant = {
    source: source2,
    citizenId: sourceCitizenId,
    phoneNumber: sourcePhone,
    onHold: false
  };
  const callId = callManager.createCall(hostParticipant);
  callManager.createRingTone(targetSource, String((_a2 = Settings.ringtone.get(targetCitizenId)) == null ? void 0 : _a2.current), volume);
  callManager.addPendingInvitation(callId, targetSource, () => {
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "Call Timeout",
      description: "Call was not answered by target",
      app: "settings",
      timeout: 2e3
    }));
    emitNet("phone:addnotiFication", targetSource, JSON.stringify({
      id: generateUUid(),
      title: "Missed Call",
      description: "You missed a call from JAIL",
      app: "settings",
      timeout: 2e3
    }));
    (async () => {
      const call = callManager.getCallByPlayer(source2);
      if (call) {
        await callHistoryManager.recordTwoPartyCallHistory(call, "unanswered", "missed", /* @__PURE__ */ new Date(), targetPhone);
      }
      callManager.endCall(callId);
      callManager.stopRingTone(targetSource);
    })();
    exports["pma-voice"].setPlayerCall(source2, 0);
    exports["pma-voice"].setPlayerCall(targetSource, 0);
    emitNet("phone:client:removeActionNotification", targetSource, "jail_call");
    emitNet("phone:client:removeCallingInterface", source2);
  }, 15e3);
  const sourceName = "JAIL PHONE";
  const targetName = await Utils.GetContactNameByNumber(number, targetCitizenId);
  emitNet("phone:addActionNotification", targetSource, JSON.stringify({
    id: "jail_call",
    title: "Incoming Call from JAIL",
    description: `${sourceName} is calling you`,
    app: "phone",
    icons: {
      "0": {
        icon: "https://ignis-rp.com/uploads/server/phone/cross-circle.svg",
        isServer: true,
        event: "phone:server:declineCall",
        args: JSON.stringify({
          callId,
          targetSource,
          sourceName,
          targetName,
          callerSource: source2,
          databaseTableId: "jail_call"
        })
      },
      "1": {
        icon: "https://ignis-rp.com/uploads/server/phone/accept.svg",
        isServer: true,
        event: "phone:server:acceptCall",
        args: JSON.stringify({
          callId,
          targetSource,
          sourceName: targetName,
          targetName: sourceName,
          callerSource: source2,
          databaseTableId: "jail_call"
        })
      }
    }
  }));
  emitNet("summit_phone:server:addCallinginterface", source2, JSON.stringify({
    callId,
    targetSource,
    targetName,
    callerSource: source2,
    databaseTableId: "jail_call"
  }));
  setTimeout(async () => {
    const call = callManager.getCallByPlayer(source2);
    if (call && call.callId === callId) {
      emitNet("phone:addnotiFication", source2, JSON.stringify({
        id: generateUUid(),
        title: "Call Ended",
        description: "Jail phone call time limit reached",
        app: "settings",
        timeout: 3e3
      }));
      emitNet("phone:addnotiFication", targetSource, JSON.stringify({
        id: generateUUid(),
        title: "Call Ended",
        description: "Jail phone call time limit reached",
        app: "settings",
        timeout: 3e3
      }));
      await callHistoryManager.recordTwoPartyCallHistory(call, "completed", "completed", /* @__PURE__ */ new Date(), targetPhone);
      callManager.endCall(callId);
      exports["pma-voice"].setPlayerCall(source2, 0);
      exports["pma-voice"].setPlayerCall(targetSource, 0);
      emitNet("phone:client:removeActionNotification", targetSource, "jail_call");
      emitNet("phone:client:removeCallingInterface", source2);
    }
  }, 6e5);
  Logger.AddLog({
    type: "phone_calls",
    title: "Jail Call Initiated",
    message: `Jail call initiated from ${source2} to ${targetSource} (${targetPhone})`,
    showIdentifiers: true
  });
  return true;
});

// game/server/apps/Phone/events.ts
onNet("phone:server:declineCall", async (notiId, args) => {
  const { callId, targetSource, callerSource, databaseTableId } = JSON.parse(args);
  callManager.declineInvitation(callId, targetSource);
  const call = callManager.getCallByPlayer(callerSource);
  if (call) {
    const targetPhone = await Utils.GetPhoneNumberBySource(targetSource);
    await callHistoryManager.recordTwoPartyCallHistory(call, "declined", "declined", /* @__PURE__ */ new Date(), targetPhone);
  }
  callManager.endCall(callId);
  callManager.stopRingTone(targetSource);
  emitNet("phone:client:endCallAnimation", targetSource);
  emitNet("phone:client:endCallAnimation", callerSource);
  emitNet("phone:client:removeActionNotification", targetSource, databaseTableId);
  emitNet("phone:client:removeCallingInterface", callerSource);
  Logger.AddLog({
    type: "phone",
    title: "Call Declined",
    message: `${Utils.GetPhoneNumberBySource(callerSource)} has declined the call from ${Utils.GetPhoneNumberBySource(targetSource)}`,
    showIdentifiers: false
  });
});
onNet("phone:server:acceptCall", async (notiId, args) => {
  const { callId, targetSource, targetName, sourceName, callerSource, databaseTableId } = JSON.parse(args);
  const call = callManager.getCallByPlayer(callerSource);
  if (!call || call.callId !== callId) {
    emitNet("phone:addnotiFication", targetSource, JSON.stringify({
      id: generateUUid(),
      title: "Call Error",
      description: "Call no longer exists",
      app: "phone",
      timeout: 2e3
    }));
    return;
  }
  const targetCitizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(targetSource);
  const targetPhone = await Utils.GetPhoneNumberBySource(targetSource);
  const participant = {
    source: targetSource,
    citizenId: targetCitizenId,
    phoneNumber: targetPhone,
    onHold: false
  };
  if (!callManager.acceptInvitation(callId, participant)) {
    emitNet("phone:addnotiFication", targetSource, JSON.stringify({
      id: generateUUid(),
      title: "Call Error",
      description: "Could not join call",
      app: "phone",
      timeout: 2e3
    }));
    return;
  }
  callManager.stopRingTone(targetSource);
  exports["pma-voice"].setPlayerCall(targetSource, callId);
  exports["pma-voice"].setPlayerCall(callerSource, callId);
  emitNet("phone:client:acceptCall", targetSource, args);
  emitNet("phone:client:startCallAnimation", callerSource);
  emitNet("phone:client:updateCallerInterface", callerSource, JSON.stringify({
    callId,
    targetSource,
    sourceName: targetName,
    targetName: sourceName,
    callerSource: source,
    databaseTableId
  }));
  emitNet("phone:client:removeActionNotification", targetSource, notiId);
  Logger.AddLog({
    type: "phone",
    title: "Call Accepted",
    message: `${Utils.GetPhoneNumberBySource(callerSource)} has accepted the call from ${Utils.GetPhoneNumberBySource(targetSource)}`,
    showIdentifiers: false
  });
});
onNet("phone:server:acceptConferenceCall", async (notiId, args) => {
  const { callId, targetSource, targetName, sourceName, callerSource, databaseTableId } = JSON.parse(args);
  const call = callManager.getCallByPlayer(callerSource);
  if (!call) {
    emitNet("phone:addnotiFication", targetSource, JSON.stringify({
      id: generateUUid(),
      title: "Call Error",
      description: "Conference call no longer exists",
      app: "phone",
      timeout: 2e3
    }));
    return;
  }
  callManager.stopRingTone(targetSource);
  const targetCitizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(targetSource);
  const targetPhone = await Utils.GetPhoneNumberBySource(targetSource);
  const participant = {
    source: targetSource,
    citizenId: targetCitizenId,
    phoneNumber: targetPhone,
    onHold: false
  };
  if (!callManager.acceptInvitation(call.callId, participant)) {
    emitNet("phone:addnotiFication", targetSource, JSON.stringify({
      id: generateUUid(),
      title: "Call Error",
      description: "Could not join conference call",
      app: "phone",
      timeout: 2e3
    }));
    return;
  }
  exports["pma-voice"].setPlayerCall(targetSource, call.callId);
  for (const p of callManager.getParticipants(call.callId)) {
    if (p.source !== targetSource) {
      const callss = call.callId;
      emitNet("phone:client:updateConference", p.source, JSON.stringify({
        callss,
        participants: callManager.getParticipants(call.callId)
      }));
      emitNet("phone:client:upDateInterFaceName", p.source);
    }
  }
  emitNet("phone:client:removeActionNotification", targetSource, notiId);
  emitNet("phone:client:updateCallerInterface", targetSource, JSON.stringify({
    callId,
    targetSource,
    sourceName,
    targetName: "Conference Call",
    callerSource: source,
    databaseTableId
  }));
  emitNet("phone:client:updateCallerInterface", callerSource, JSON.stringify({
    callId,
    targetSource,
    sourceName,
    targetName: "Conference Call",
    callerSource: source,
    databaseTableId
  }));
  Logger.AddLog({
    type: "phone",
    title: "Conference Call Accepted",
    message: `${Utils.GetPhoneNumberBySource(callerSource)} has accepted the conference call from ${Utils.GetPhoneNumberBySource(targetSource)}`,
    showIdentifiers: false
  });
});
onNet("phone:server:endCall", async (args) => {
  const { callId, source: source2 } = JSON.parse(args);
  const call = callManager.getCallByPlayer(source2);
  if (call && call.callId === callId) {
    await callManager.removeParticipant(callId, source2);
    for (const p of callManager.getParticipants(callId)) {
      emitNet("phone:client:updateConference", p.source, JSON.stringify({
        callId,
        participants: callManager.getParticipants(callId)
      }));
    }
  }
});
on("onResourceStop", async (resource) => {
  if (resource === GetCurrentResourceName()) {
    for (const call of callManager.getAllCalls()) {
      for (const participant of call.participants.values()) {
        exports["pma-voice"].setPlayerCall(participant.source, 0);
      }
    }
  }
});
onNet("playerDropped", async (source2) => {
  const call = callManager.getCallByPlayer(source2);
  if (call) {
    await callManager.removeParticipant(call.callId, source2);
    for (const p of callManager.getParticipants(call.callId)) {
      emitNet("phone:client:updateConference", p.source, JSON.stringify({
        callId: call.callId,
        participants: callManager.getParticipants(call.callId)
      }));
    }
  }
});

// game/server/apps/Photos/callback.ts
onClientCallback("savePhotoToPhotos", async (source2, data) => {
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  const dataX = {
    _id: generateUUid(),
    citizenId,
    link: data,
    date: (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").replace("Z", "")
  };
  const res = await MongoDB.insertOne("phone_photos", dataX);
  Logger.AddLog({
    type: "phone_photos",
    title: "Photo Saved",
    message: `Photo saved by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | ${citizenId}, Link: ${data}`,
    showIdentifiers: false
  });
  return JSON.stringify(dataX);
});
onClientCallback("getPhotos", async (source2) => {
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  const photos = await MongoDB.findMany("phone_photos", { citizenId });
  return JSON.stringify(photos);
});
onClientCallback("deletePhoto", async (source2, data) => {
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  const res = await MongoDB.findOne("phone_photos", { _id: data });
  await MongoDB.deleteOne("phone_photos", { _id: data, citizenId });
  Logger.AddLog({
    type: "phone_photos",
    title: "Photo Deleted",
    message: `Photo deleted by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | ${citizenId}, Link: ${res.link}`,
    showIdentifiers: false
  });
  return true;
});

// game/server/apps/Services/callback.ts
onClientCallback("RegisterNewBusiness", async (client, data) => {
  const {
    ownerCitizenId,
    businessName,
    businessDescription,
    businessType,
    businessLogo,
    businessPhoneNumber,
    businessAddress,
    generateBusinessEmail,
    coords,
    businessEmail,
    businessPassword,
    job
  } = JSON.parse(data);
  const business = await MongoDB.findOne("phone_business", { businessName });
  if (business) {
    Logger.AddLog({
      type: "phone_business",
      title: "Business Registration Failed",
      message: `Attempt to register business with existing name '${businessName}' by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
      showIdentifiers: false
    });
    return emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `Business with name ${businessName} already exists.`,
      app: "services",
      timeout: 5e3
    }));
  }
  if (generateBusinessEmail) {
    await MongoDB.insertOne("phone_mail", {
      _id: businessEmail,
      activeMaidId: businessEmail,
      username: businessEmail,
      activeMailPassword: businessPassword,
      avatar: businessLogo,
      messages: []
    });
  }
  await MongoDB.insertOne("phone_business", {
    ownerCitizenId,
    businessName,
    businessDescription,
    businessType,
    businessLogo,
    businessPhoneNumber,
    businessAddress,
    generateBusinessEmail,
    businessEmail,
    coords,
    job
  });
  Logger.AddLog({
    type: "phone_business",
    title: "Business Registered",
    message: `New business '${businessName}' registered by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
    showIdentifiers: false
  });
});
onClientCallback("getBusinessData", async (client, data) => {
  const business = await MongoDB.findOne("phone_business", { businessName: data });
  return JSON.stringify(business);
});
onClientCallback("getAllBusinessData", async (client, data) => {
  const businesses = await MongoDB.findMany("phone_business", {});
  let onlineBuss = [];
  let offlineBuss = [];
  for (const business of businesses) {
    const jobCount = GlobalState[`${business.job}:count`];
    if (jobCount) {
      onlineBuss.push(business);
    } else {
      offlineBuss.push(business);
    }
  }
  return JSON.stringify({ online: onlineBuss, offline: offlineBuss });
});
onClientCallback("getBusinessNames", async (client) => {
  const businesses = await MongoDB.findMany("phone_business", {});
  return JSON.stringify(businesses.map((business) => business.businessName));
});
onClientCallback("UpdateBusiness", async (client, data) => {
  const {
    selectedBusiness,
    ownerCitizenId,
    businessName,
    businessDescription,
    businessType,
    businessLogo,
    businessPhoneNumber,
    businessAddress,
    generateBusinessEmail,
    coords,
    job,
    businessEmail
  } = JSON.parse(data);
  const business = await MongoDB.findOne("phone_business", { businessName: selectedBusiness });
  if (!business) {
    Logger.AddLog({
      type: "phone_business",
      title: "Business Update Failed",
      message: `Attempt to update non-existent business '${selectedBusiness}' by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
      showIdentifiers: false
    });
    return emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `Business with name ${businessName} does not exist.`,
      app: "services",
      timeout: 5e3
    }));
  }
  await MongoDB.updateOne("phone_business", { businessName: selectedBusiness }, {
    ownerCitizenId,
    businessName,
    businessDescription,
    businessType,
    businessLogo,
    businessPhoneNumber,
    businessAddress,
    generateBusinessEmail,
    coords,
    job,
    businessEmail
  });
  Logger.AddLog({
    type: "phone_business",
    title: "Business Updated",
    message: `Business '${selectedBusiness}' updated by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
    showIdentifiers: false
  });
});
onClientCallback("deleteBusiness", async (client, data) => {
  const business = await MongoDB.findOne("phone_business", { businessName: data });
  if (!business) {
    Logger.AddLog({
      type: "phone_business",
      title: "Business Deletion Failed",
      message: `Attempt to delete non-existent business '${data}' by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
      showIdentifiers: false
    });
    return emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `Business with name ${data} does not exist.`,
      app: "services",
      timeout: 5e3
    }));
  }
  await MongoDB.deleteOne("phone_business", { businessName: data });
  Logger.AddLog({
    type: "phone_business",
    title: "Business Deleted",
    message: `Business '${data}' deleted by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
    showIdentifiers: false
  });
});
onClientCallback("summit_phone:server:toggleJobCalls", async (client) => {
  const player = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  ;
  const PlayerData = await MongoDB.findOne("phone_business_users", { citizenid: player });
  if (!PlayerData) {
    await MongoDB.insertOne("phone_business_users", { citizenid: player, jobCalls: true });
    return true;
  }
  ;
  await MongoDB.updateOne("phone_business_users", { citizenid: player }, { jobCalls: !PlayerData.jobCalls });
  return !PlayerData.jobCalls;
});
onClientCallback("summit_phone:server:getJobCalls", async (client) => {
  const player = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const PlayerData = await MongoDB.findOne("phone_business_users", { citizenid: player });
  if (!PlayerData) {
    await MongoDB.insertOne("phone_business_users", { citizenid: player, jobCalls: true });
    return true;
  }
  ;
  return PlayerData.jobCalls;
});
onClientCallback("summit_phone:server:businessCall", async (client, data) => {
  const { number } = JSON.parse(data);
  const citizenid = await Utils.GetCitizenIdByPhoneNumber(number);
  const personalNumber = await Utils.GetPhoneNumberBySource(client);
  if (String(personalNumber) === String(number)) {
    return emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `You Can't call yourself ${personalNumber}.`,
      app: "services",
      timeout: 5e3
    }));
  }
  if (!citizenid) {
    return emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `This number is not registered.`,
      app: "services",
      timeout: 5e3
    }));
  }
  const PlayerData = await MongoDB.findOne("phone_business_users", { citizenid });
  if (PlayerData && !PlayerData.jobCalls) {
    return emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `This person has disabled job calls.`,
      app: "services",
      timeout: 5e3
    }));
  } else if (PlayerData && PlayerData.jobCalls) {
    await triggerClientCallback("summit_phone:client:businessCall", client, number);
  }
});
onClientCallback("summit_phone:server:getBankbalance", async (client, account) => {
  const balance = await exports["Renewed-Banking"].getAccountMoney(account);
  return balance;
});
onClientCallback("summit_phone:server:depositMoney", async (client, amount) => {
  const src = client;
  const Player = await exports[FRAMEWORK_RESOURCE].GetPlayer(src);
  const fullname = await exports[FRAMEWORK_RESOURCE].GetPlayerName(src);
  const cid = Player.PlayerData.citizenid;
  const PlayerJob = Player.PlayerData.job;
  const account = PlayerJob.name;
  const bankbalance = await Player.PlayerData.money.bank;
  if (bankbalance < amount) {
    return false;
  }
  await Player.Functions.RemoveMoney("bank", amount, "Phone Business App Deposit.");
  await exports["Renewed-Banking"].addAccountMoney(account, amount);
  await exports["Renewed-Banking"].handleTransaction(cid, "Phone Business App Withdraw", amount, `Sent funds to ${PlayerJob.label}`, account, fullname, "withdraw", generateUUid());
  await exports["Renewed-Banking"].handleTransaction(account, "Phone Business App Deposit", amount, "Deposit", fullname, account, "deposit", generateUUid());
  Logger.AddLog({
    type: "phone_business",
    title: "Money Deposited",
    message: `Player ${fullname} deposited $${amount} to account ${account}.`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("summit_phone:server:withdrawMoney", async (client, amount) => {
  const src = client;
  const Player = await exports[FRAMEWORK_RESOURCE].GetPlayer(src);
  const fullname = await exports[FRAMEWORK_RESOURCE].GetPlayerName(src);
  const cid = Player.PlayerData.citizenid;
  const PlayerJob = Player.PlayerData.job;
  const account = PlayerJob.name;
  const balance = await exports["Renewed-Banking"].getAccountMoney(account);
  if (balance < amount) {
    return false;
  }
  await Player.Functions.AddMoney("bank", amount, "Phone Business App Withdraw.");
  await exports["Renewed-Banking"].removeAccountMoney(account, amount);
  await exports["Renewed-Banking"].handleTransaction(cid, "Phone Business App Withdraw", amount, `Recieved funds from ${PlayerJob.label}`, account, fullname, "deposit", generateUUid());
  await exports["Renewed-Banking"].handleTransaction(account, "Phone Business App Withdraw", amount, "Withdraw", account, fullname, "withdraw", generateUUid());
  Logger.AddLog({
    type: "phone_business",
    title: "Money Withdrawn",
    message: `Player ${fullname} withdrew $${amount} from account ${account}.`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("summit_phone:server:getEmployees", async (client, data) => {
  const src = client;
  const jobname = data;
  const Player = await exports[FRAMEWORK_RESOURCE].GetPlayer(src);
  const isBoss = Player.PlayerData.job.isboss;
  const players = await Utils.query("SELECT citizenid, charinfo, job FROM players WHERE job LIKE ?", [`%${jobname}%`]);
  const employees = [];
  for (const data2 of players) {
    let charData = { firstname: "Unknown", lastname: "Player" };
    let jobData = { name: "Unknown", grade: 0, isboss: false };
    try {
      if (data2.charinfo) charData = JSON.parse(data2.charinfo);
      if (data2.job) jobData = JSON.parse(data2.job);
    } catch (e) {
      LOGGER(`Failed to parse Job ${jobname} / charinfo for $ ${data2.citizenid}`);
      continue;
    }
    const isOnline = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(data2.citizenid);
    if (isOnline && isOnline.PlayerData.job.name === jobname) {
      employees.push({
        empSource: isOnline.PlayerData.citizenid,
        curJob: isOnline.PlayerData.job.name,
        grade: isOnline.PlayerData.job.grade,
        isboss: isOnline.PlayerData.job.isboss,
        name: `${isOnline.PlayerData.charinfo.firstname} ${isOnline.PlayerData.charinfo.lastname}`,
        status: "online"
      });
    } else {
      employees.push({
        empSource: data2.citizenid,
        curJob: jobData.name,
        grade: jobData.grade,
        isboss: jobData.isboss,
        name: `${charData.firstname} ${charData.lastname}`,
        status: "offline"
      });
    }
  }
  employees.sort((a, b) => (b.grade.level || 0) - (a.grade.level || 0));
  const multijobEmployees = [];
  try {
    const multiJobPlayers = await MongoDB.findMany("phone_multijobs", { jobName: jobname }) || [];
    for (const multiJob of multiJobPlayers) {
      if (!multiJob.citizenId) {
        console.warn("Skipping invalid multijob entry:", multiJob);
        continue;
      }
      const isOnline = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(multiJob.citizenId);
      if (!isOnline) {
        const playerData = await Utils.query("SELECT charinfo, job FROM players WHERE citizenid = ?", [multiJob.citizenId]);
        if (!playerData || playerData.length === 0) {
          console.warn(`No player data found for offline citizenId ${multiJob.citizenId}`);
          continue;
        }
        for (const data2 of playerData) {
          let jobData, charData;
          try {
            jobData = data2.job ? JSON.parse(data2.job) : { name: "Unknown", grade: 0, isboss: false };
            charData = data2.charinfo ? JSON.parse(data2.charinfo) : { firstname: "Unknown", lastname: "Player" };
          } catch (e) {
            console.error(`Failed to parse job/charinfo for ${multiJob.citizenId}:`, e);
            continue;
          }
          if (jobData.name === jobname) continue;
          multijobEmployees.push({
            empSource: multiJob.citizenId,
            curJob: jobData.name,
            grade: jobData.grade,
            isboss: jobData.isboss,
            name: `${charData.firstname} ${charData.lastname}`,
            status: "offline"
          });
        }
      } else {
        if (isOnline.PlayerData.job.name === jobname) continue;
        multijobEmployees.push({
          empSource: isOnline.PlayerData.citizenid,
          curJob: isOnline.PlayerData.job.name,
          grade: isOnline.PlayerData.job.grade,
          isboss: isOnline.PlayerData.job.isboss,
          name: `${isOnline.PlayerData.charinfo.firstname} ${isOnline.PlayerData.charinfo.lastname}`,
          status: "online"
        });
      }
    }
    multijobEmployees.sort((a, b) => (b.grade || 0) - (a.grade || 0));
  } catch (err) {
    console.error("Error processing multijob employees:", err);
  }
  return JSON.stringify({
    employees: employees.length > 0 ? employees : [],
    multijobEmployees: multijobEmployees.length > 0 ? multijobEmployees : []
  });
});
onClientCallback("summit_phone:server:hireEmployee", async (client, targetSource, jobname) => {
  if (String(client) === String(targetSource)) {
    Logger.AddLog({
      type: "phone_business",
      title: "Hire Failed",
      message: `Attempt to hire self Name: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}, in Job: ${jobname}`,
      showIdentifiers: false
    });
    return emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `You can't hire yourself.`,
      app: "services",
      timeout: 5e3
    }));
  }
  if (await DoesPlayerExist(targetSource)) {
    const player = await exports[FRAMEWORK_RESOURCE].GetPlayer(client);
    if (!player.PlayerData.job.isboss) {
      Logger.AddLog({
        type: "phone_business",
        title: "Hire Failed",
        message: `Attempt to hire without being a boss Name: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}, in Job: ${jobname}, CitizenId: ${player.PlayerData.citizenid}`,
        showIdentifiers: false
      });
      return emitNet("phone:addnotiFication", client, JSON.stringify({
        id: generateUUid(),
        title: "System",
        description: `You are not a boss.`,
        app: "services",
        timeout: 5e3
      }));
    }
    const targetPlayer = await exports[FRAMEWORK_RESOURCE].GetPlayer(targetSource);
    targetPlayer.Functions.SetJob(jobname, 0);
    Logger.AddLog({
      type: "phone_business",
      title: "Employee Hired",
      message: `Player ${targetPlayer.PlayerData.citizenid} Name: ${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname} hired by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}, in Job: ${jobname}`,
      showIdentifiers: false
    });
    emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `You have hired ${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname} to ${jobname}.`,
      app: "services",
      timeout: 5e3
    }));
    emitNet("phone:addnotiFication", targetSource, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `You have been hired to ${jobname}.`,
      app: "services",
      timeout: 5e3
    }));
    emit("summit_phone:server:hireinMultiJob", targetSource, jobname, 0, Framework.Shared.Jobs[jobname].label, Framework.Shared.Jobs[jobname].grades["0"].label);
    emitNet("summit_phone:client:refreshEmpData", client, jobname);
  } else {
    Logger.AddLog({
      type: "phone_business",
      title: "Hire Failed",
      message: `Attempt to hire non-existent player Name: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}, in Job: ${jobname}`,
      showIdentifiers: false
    });
    emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `Player is not online.`,
      app: "services",
      timeout: 5e3
    }));
  }
});
onClientCallback("getIndexOfAllJobs", async (client) => {
  const jobs = await MongoDB.findMany("summit_jobs", {});
  return JSON.stringify(jobs.map((job) => job._id));
});
onClientCallback("registerJobs", async (client, data) => {
  const jobs = JSON.parse(data);
  await MongoDB.insertOne("summit_jobs", jobs);
  const { _id, ...rest } = jobs;
  exports[FRAMEWORK_RESOURCE].AddJob(_id, rest);
  Logger.AddLog({
    type: "phone_jobs",
    title: "Job Registered",
    message: `New job '${_id}' Name: ${jobs.jobName} registered by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
    showIdentifiers: false
  });
});
onClientCallback("getJobData", async (client, data) => {
  const job = await MongoDB.findOne("summit_jobs", { _id: data });
  return JSON.stringify(job);
});
onClientCallback("updateJobs", async (client, data) => {
  const jobs = JSON.parse(data);
  await MongoDB.updateOne("summit_jobs", { _id: jobs._id }, jobs);
  const { _id, ...rest } = jobs;
  exports[FRAMEWORK_RESOURCE].UpdateJob(_id, rest);
  Logger.AddLog({
    type: "phone_jobs",
    title: "Job Updated",
    message: `Job '${_id}' Name: ${jobs.jobName} updated by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
    showIdentifiers: false
  });
});
onClientCallback("deleteJobs", async (client, data) => {
  const job = await MongoDB.findOne("summit_jobs", { _id: data });
  if (!job) {
    Logger.AddLog({
      type: "summit_jobs",
      title: "Job Deletion Failed",
      message: `Attempt to delete non-existent job '${data}' by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
      showIdentifiers: false
    });
    return emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `Job does not exist.`,
      app: "services",
      timeout: 5e3
    }));
  }
  await MongoDB.deleteOne("summit_jobs", { _id: data });
  exports[FRAMEWORK_RESOURCE].RemoveJob(data);
  Logger.AddLog({
    type: "phone_jobs",
    title: "Job Deleted",
    message: `Job '${data}' Name: ${job.jobName} deleted by Player: ${exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
    showIdentifiers: false
  });
});
onClientCallback("summit_phone:server:getBusinessEmployeesNumbers", async (client, job) => {
  const [players] = await Framework.Functions.GetPlayersOnDuty(job);
  let numbers = [];
  for (const player of players) {
    const number = await Utils.GetPhoneNumberBySource(player);
    numbers.push(Number(number));
  }
  return JSON.stringify(numbers);
});

// game/server/apps/Services/events.ts
onNet("summit_phone:server:fireEmployee", async (citizenId) => {
  const source2 = global.source;
  const targetData = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(citizenId);
  if (targetData) {
    const jobname = targetData.PlayerData.job.name;
    await targetData.Functions.SetJob("unemployed", 0);
    await MongoDB.deleteOne("phone_multijobs", { citizenId, jobName: jobname });
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `You have fired ${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname}`,
      app: "services",
      timeout: 5e3
    }));
    emitNet("phone:addnotiFication", targetData.PlayerData.source, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `You have been fired by ${global.source}`,
      app: "services",
      timeout: 5e3
    }));
    emitNet("summit_phone:client:refreshEmpData", source2, jobname);
    Logger.AddLog({
      type: "phone_employee_action",
      title: "Employee Fired",
      message: `${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname} has been fired by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | CitizenId: ${targetData.PlayerData.citizenid} | Job: ${targetData.PlayerData.job.name}`,
      showIdentifiers: false
    });
  } else {
    const playerData = await Utils.query("SELECT job FROM players WHERE citizenid = ? LIMIT 1", [citizenId]);
    const jobData = JSON.parse(playerData[0].job);
    let job = {};
    job.name = "unemployed";
    job.label = Framework.Shared.Jobs["unemployed"].label;
    job.payment = Framework.Shared.Jobs["unemployed"].grades["0"].payment;
    job.onduty = Framework.Shared.Jobs["unemployed"].defaultDuty;
    job.isboss = false;
    job.grade = {};
    job.grade.name = Framework.Shared.Jobs["unemployed"].grades["0"].name;
    job.grade.level = 0;
    await Utils.query("UPDATE players SET job = ? WHERE citizenid = ?", [JSON.stringify(job), citizenId]);
    await MongoDB.deleteOne("phone_multijobs", { citizenId, jobName: jobData.name });
    emitNet("summit_phone:client:refreshEmpData", source2, jobData.name);
    Logger.AddLog({
      type: "phone_employee_action",
      title: "Offline Employee Fired",
      message: `Offline employee ${citizenId} has been fired by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | Job: ${jobData.name}`,
      showIdentifiers: false
    });
  }
});
onNet("summit_phone:server:changeRankOfPlayer", async (data) => {
  const source2 = global.source;
  const targetData = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(data.targetCitizenid);
  const multiJob = await MongoDB.findOne("phone_multijobs", { citizenId: data.targetCitizenid, jobName: data.jobName });
  if (targetData) {
    const jobname = data.jobName;
    targetData.Functions.SetJob(jobname, data.key);
    emitNet("phone:addnotiFication", source2, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `You have changed the rank of ${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname}`,
      app: "services",
      timeout: 5e3
    }));
    emitNet("phone:addnotiFication", targetData.PlayerData.source, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `Your rank has been changed by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)}`,
      app: "services",
      timeout: 5e3
    }));
    if (multiJob) {
      await MongoDB.updateOne("phone_multijobs", { citizenId: data.targetCitizenid, jobName: data.jobName }, { gradeLevel: data.key, gradeLabel: data.gradeName });
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Updated",
        message: `${data.targetCitizenid} has been updated to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | citizenId: ${exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2)}`,
        showIdentifiers: false
      });
    } else {
      await MongoDB.insertOne("phone_multijobs", { _id: generateUUid(), citizenId: data.targetCitizenid, jobName: data.jobName, gradeLevel: data.key, gradeLabel: data.gradeName });
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Added",
        message: `${data.targetCitizenid} has been added to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | citizenId: ${exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2)}`,
        showIdentifiers: false
      });
    }
    emitNet("summit_phone:client:refreshEmpData", source2, jobname);
    Logger.AddLog({
      type: "phone_employee_action",
      title: "Rank Changed",
      message: `${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname} has been given a new rank by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | CitizenId: ${targetData.PlayerData.citizenid} | Job: ${jobname} |  New Rank: ${data.gradeName}`,
      showIdentifiers: false
    });
  } else {
    const playerData = await Utils.query("SELECT job FROM players WHERE citizenid = ? LIMIT 1", [data.targetCitizenid]);
    const jobData = JSON.parse(playerData[0].job);
    jobData.grade.level = data.key;
    jobData.grade.name = data.gradeName;
    await Utils.query("UPDATE players SET job = ? WHERE citizenid = ?", [JSON.stringify(jobData), data.targetCitizenid]);
    if (multiJob) {
      await MongoDB.updateOne("phone_multijobs", { citizenId: data.targetCitizenid, jobName: data.jobName }, { gradeLevel: data.key, gradeLabel: data.gradeName });
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Updated",
        message: `${data.targetCitizenid} has been updated to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | citizenId: ${exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2)}`,
        showIdentifiers: false
      });
    } else {
      await MongoDB.insertOne("phone_multijobs", { _id: generateUUid(), citizenId: data.targetCitizenid, jobName: data.jobName, gradeLevel: data.key, gradeLabel: data.gradeName });
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Added",
        message: `${data.targetCitizenid} has been added to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | citizenId: ${exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2)}`,
        showIdentifiers: false
      });
    }
    emitNet("summit_phone:client:refreshEmpData", source2, jobData.name);
  }
});
onNet("summit_phone:server:fireInactiveEmployee", async (data) => {
  const source2 = global.source;
  await MongoDB.deleteOne("phone_multijobs", { citizenId: data.citizenId, jobName: data.jobName });
  emitNet("phone:addnotiFication", source2, JSON.stringify({
    id: generateUUid(),
    title: "System",
    description: `You have fired an inactive employee`,
    app: "services",
    timeout: 5e3
  }));
  emitNet("summit_phone:client:refreshEmpData", source2, data.jobName);
  Logger.AddLog({
    type: "phone_employee_action",
    title: "Inactive Employee Fired",
    message: `Inactive employee ${data.citizenId} has been fired by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | Job: ${data.jobName}`,
    showIdentifiers: false
  });
});
on("summit_phone:server:hireinMultiJob", async (client, jobname, gradeLevel, jobLabel, gradeLabel) => {
  const targetCid = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const multiJobCheck = await MongoDB.findOne("phone_multijobs", { citizenId: targetCid, jobName: jobname });
  if (multiJobCheck) {
    if (multiJobCheck.gradeLevel !== gradeLevel) {
      await MongoDB.updateOne("phone_multijobs", { citizenId: targetCid, jobName: jobname }, { gradeLevel, gradeLabel });
      emitNet("phone:addnotiFication", client, JSON.stringify({
        id: generateUUid(),
        title: "System",
        description: `You have been hired in a new rank: ${gradeLabel}`,
        app: "services",
        timeout: 5e3
      }));
      emitNet("summit_phone:client:refreshEmpData", client, jobname);
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Updated",
        message: `${targetCid} has been updated to ${jobname} | New Rank: ${gradeLabel} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(client)} | citizenId: ${exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client)}`,
        showIdentifiers: false
      });
    } else {
      return emitNet("QBCore:Notify", client, "You are already in this job with this grade level", "error");
    }
  } else {
    await MongoDB.insertOne("phone_multijobs", { _id: generateUUid(), citizenId: targetCid, jobName: jobname, gradeLevel, jobLabel, gradeLabel });
    emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `You have been hired in a new job: ${jobLabel} as ${gradeLabel}`,
      app: "services",
      timeout: 5e3
    }));
    emitNet("summit_phone:client:refreshEmpData", client, jobname);
    Logger.AddLog({
      type: "phone_multi_job",
      title: "Multi-Job Added",
      message: `${targetCid} has been added to ${jobname} | New Rank: ${gradeLabel} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(client)} | citizenId: ${exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client)}`,
      showIdentifiers: false
    });
  }
});
setImmediate(async () => {
  const jobArray = {};
  const jobData = await MongoDB.findMany("summit_jobs", {});
  jobData.forEach(async (job) => {
    const { _id, ...rest } = job;
    LOGGER(`[SUMMIT_PHONE] Created job ${_id} Successfully`);
    jobArray[_id] = rest;
  });
});

// game/server/apps/Settings/callback.ts
onClientCallback("GetClientSettings", async (client) => {
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  await Settings.ensurePlayerSettings(citizenId);
  return JSON.stringify({
    _id: Settings._id.get(citizenId),
    background: Settings.background.get(citizenId),
    lockscreen: Settings.lockscreen.get(citizenId),
    ringtone: Settings.ringtone.get(citizenId),
    showStartupScreen: Settings.showStartupScreen.get(citizenId),
    showNotifications: Settings.showNotifications.get(citizenId),
    isLock: Settings.isLock.get(citizenId),
    lockPin: Settings.lockPin.get(citizenId),
    usePin: Settings.usePin.get(citizenId),
    useFaceId: Settings.useFaceId.get(citizenId),
    faceIdIdentifier: Settings.faceIdIdentifier.get(citizenId),
    smrtId: Settings.smrtId.get(citizenId),
    darkMailIdAttached: Settings.darkMailIdAttached.get(citizenId),
    smrtPassword: Settings.smrtPassword.get(citizenId),
    isFlightMode: Settings.isFlightMode.get(citizenId),
    phoneNumber: Settings.phoneNumber.get(citizenId),
    pigeonIdAttached: Settings.pigeonIdAttached.get(citizenId)
  });
});
onClientCallback("SetClientSettings", async (client, data) => {
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  await Settings.ensurePlayerSettings(citizenId);
  const parsedData = JSON.parse(data);
  Settings.background.set(citizenId, parsedData.background);
  Settings.lockscreen.set(citizenId, parsedData.lockscreen);
  Settings.ringtone.set(citizenId, parsedData.ringtone);
  Settings.showStartupScreen.set(citizenId, parsedData.showStartupScreen);
  Settings.showNotifications.set(citizenId, parsedData.showNotifications);
  Settings.isLock.set(citizenId, parsedData.isLock);
  Settings.lockPin.set(citizenId, parsedData.lockPin);
  Settings.usePin.set(citizenId, parsedData.usePin);
  Settings.useFaceId.set(citizenId, parsedData.useFaceId);
  Settings.faceIdIdentifier.set(citizenId, parsedData.faceIdIdentifier);
  Settings.smrtId.set(citizenId, parsedData.smrtId);
  Settings.smrtPassword.set(citizenId, parsedData.smrtPassword);
  Settings.isFlightMode.set(citizenId, parsedData.isFlightMode);
  Settings.darkMailIdAttached.set(citizenId, parsedData.darkMailIdAttached);
  Settings.phoneNumber.set(citizenId, parsedData.phoneNumber);
  Settings.pigeonIdAttached.set(citizenId, parsedData.pigeonIdAttached);
  await Settings.SavePlayerSettings(citizenId);
  Logger.AddLog({
    type: "phone_settings",
    title: "Settings Updated",
    message: `${citizenId} | Name: ${global.exports[FRAMEWORK_RESOURCE].GetPlayerName(client)} new settings, ${JSON.stringify(parsedData)}`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("RegisterNewMailAccount", async (client, data) => {
  const parsedData = JSON.parse(data);
  const dataX = {
    activeMaidId: parsedData.email,
    username: parsedData.email,
    activeMailPassword: parsedData.password,
    avator: "",
    messages: []
  };
  await MongoDB.insertOne("phone_mail", { _id: parsedData.email, ...dataX });
  Logger.AddLog({
    type: "phone_email",
    title: "Email Account Registered",
    message: `New email account registered with email ${parsedData.email}, password "${parsedData.password}", CitizenId: ${await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client)}, Name: ${global.exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
    showIdentifiers: true
  });
  return true;
});
onClientCallback("SearchEmail", async (client, data) => {
  const res = await MongoDB.findMany("phone_mail", { _id: data });
  return JSON.stringify(res);
});
onClientCallback("LoginMailAccount", async (client, data) => {
  const parsedData = JSON.parse(data);
  const res = await MongoDB.findOne("phone_mail", { _id: parsedData.email });
  if (res.activeMailPassword === parsedData.password) {
    Logger.AddLog({
      type: "phone_email",
      title: "Email Login",
      message: `${global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client)} Name: ${global.exports[FRAMEWORK_RESOURCE].GetPlayerName(client)} logged in to email account ${parsedData.email}, password "${parsedData.password}"`,
      showIdentifiers: false
    });
    return true;
  } else {
    return false;
  }
});
onClientCallback("unLockorLockPhone", async (client, data) => {
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  Settings.isLock.set(citizenId, data);
  return true;
});
onClientCallback("getPhonePlayerCard", async (client) => {
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const res = await MongoDB.findOne("phone_player_card", { _id: citizenId });
  return JSON.stringify(res);
});
onClientCallback("phone:updatePersonalCard", async (client, data) => {
  const parsedData = JSON.parse(data);
  await MongoDB.updateOne("phone_player_card", { _id: parsedData._id }, parsedData);
  Logger.AddLog({
    type: "phone_personal_card",
    title: "Personal Card Updated",
    message: `${parsedData._id} | Name: ${global.exports[FRAMEWORK_RESOURCE].GetPlayerName(client)} updated personal card, ${JSON.stringify(parsedData)}`,
    showIdentifiers: false
  });
  return true;
});

// game/server/apps/Settings/events.ts
RegisterCommand("saveSettings", async (source2, args) => {
  await Settings.save();
}, true);
var generatePhoneNumber = /* @__PURE__ */ __name(async () => {
  const number = `559${Math.floor(Math.random() * 1e7).toString().padStart(7, "0")}`;
  const exists = await MongoDB.findOne("phone_numbers", { number });
  if (exists) return generatePhoneNumber();
  return number;
}, "generatePhoneNumber");
async function GeneratePlayerPhoneNumber(citizenId, source2) {
  const number = await generatePhoneNumber();
  await MongoDB.insertOne("phone_numbers", {
    _id: generateUUid(),
    owner: citizenId,
    number
  });
  await MongoDB.insertOne("phone_settings", {
    _id: citizenId,
    background: {
      current: "",
      wallpapers: []
    },
    lockscreen: {
      current: "",
      wallpapers: []
    },
    ringtone: {
      current: "https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3",
      ringtones: [
        {
          name: "default",
          url: "https://ignis-rp.com/uploads/server/phone/sounds/iPhoneXTrap.mp3"
        }
      ]
    },
    showStartupScreen: true,
    showNotifications: true,
    isLock: true,
    lockPin: "",
    usePin: true,
    phoneNumber: number,
    useFaceId: false,
    faceIdIdentifier: citizenId,
    darkMailIdAttached: "",
    pigeonIdAttached: "",
    smrtId: "",
    smrtPassword: "",
    isFlightMode: false
  });
  await MongoDB.insertOne("phone_player_card", {
    _id: citizenId,
    firstName: "Setup",
    lastName: "Card",
    phoneNumber: number,
    email: "",
    notes: "",
    avatar: ""
  });
  Settings.RegisterNewSettings(citizenId, number);
  if (source2) {
    emitNet("phone:client:setupPhone", source2, citizenId);
  }
  Logger.AddLog({
    type: "phone_settings",
    title: "Phone Number Generated",
    message: `Phone number ${number} generated for ${citizenId}`,
    showIdentifiers: true
  });
  return number;
}
__name(GeneratePlayerPhoneNumber, "GeneratePlayerPhoneNumber");
exports("GeneratePlayerPhoneNumber", GeneratePlayerPhoneNumber);
on("txAdmin:events:scheduledRestart", async (data) => {
  await Settings.save();
  LOGGER(`[Settings] Saved during resource stop.`);
});
on("txAdmin:events:serverShuttingDown", async () => {
  await Settings.save();
  LOGGER(`[Settings] Saved during resource stop.`);
});

// game/server/apps/Pigeon/PigeonService.ts
var _PigeonService = class _PigeonService {
  async searchUserExist(_client, data) {
    const user = await MongoDB.findOne("phone_pigeon_users", { email: data });
    return !!user;
  }
  async login(_client, data) {
    try {
      const { email, password } = JSON.parse(data);
      const user = await MongoDB.findOne("phone_pigeon_users", { email, password });
      if (user) {
        Logger.AddLog({
          type: "phone_pigeon",
          title: "User Login",
          message: `User with email ${email} logged in successfully.`,
          showIdentifiers: true
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error in login:", error);
      return { error: "An error occurred" };
    }
  }
  async signup(_client, data) {
    const { email, password } = JSON.parse(data);
    const existingUser = await MongoDB.findOne("phone_pigeon_users", { email });
    if (existingUser) {
      return { error: "Email already taken" };
    }
    await MongoDB.insertOne("phone_pigeon_users", {
      _id: generateUUid(),
      email,
      password,
      verified: false,
      username: email,
      displayName: email,
      avatar: "",
      banner: "",
      notificationsEnabled: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      bio: "",
      followers: [],
      following: []
    });
    Logger.AddLog({
      type: "phone_pigeon",
      title: "User Signup",
      message: `New user account created with email ${email}.`,
      showIdentifiers: true
    });
    return true;
  }
  async getProfile(_client, email) {
    const user = await MongoDB.findOne("phone_pigeon_users", { email });
    if (user) {
      return JSON.stringify(user);
    } else {
      return "User not found";
    }
  }
  async toggleNotifications(_client, email) {
    const res = await MongoDB.findOne("phone_pigeon_users", { email });
    if (res) {
      res.notificationsEnabled = !res.notificationsEnabled;
      await MongoDB.updateOne("phone_pigeon_users", { email }, res);
      Logger.AddLog({
        type: "phone_pigeon",
        title: "Notifications Toggled",
        message: `User ${email} toggled notifications to ${res.notificationsEnabled ? "enabled" : "disabled"}.`,
        showIdentifiers: false
      });
      return true;
    }
    return false;
  }
  async postTweet(_client, data) {
    const { email, content, attachments } = JSON.parse(data);
    try {
      const res = await MongoDB.findOne("phone_pigeon_users", { email });
      if (!res) return { error: "User not found" };
      const tweet = {
        _id: generateUUid(),
        username: res.displayName,
        email: res.email,
        avatar: res.avatar,
        verified: res.verified,
        content,
        attachments,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        likeCount: [],
        repliesCount: [],
        retweetCount: [],
        isRetweet: false,
        originalTweetId: null,
        hashtags: content.match(/#\w+/g) || [],
        parentTweetId: null
      };
      await MongoDB.insertOne("phone_pigeon_tweets", tweet);
      await triggerClientCallback("pigeon:refreshTweet", -1, JSON.stringify(tweet));
      emitNet("phone:addnotiFication", -1, JSON.stringify({
        id: generateUUid(),
        title: "New Tweet",
        description: `${res.displayName} has posted a new tweet.`,
        app: "pigeon",
        timeout: 5e3
      }));
      await MongoDB.insertOne("phone_pigeon_notifications", {
        _id: generateUUid(),
        content: `${res.displayName} has posted a new tweet.`,
        email: res.email,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        type: "post"
      });
      Logger.AddLog({
        type: "phone_pigeon",
        title: "Tweet Posted",
        message: `User ${email} posted a new tweet (ID: ${tweet._id}), content: ${content}`,
        showIdentifiers: false
      });
      return true;
    } catch (error) {
      console.error("Error in postTweet:", error);
      return { error: "An error occurred" };
    }
  }
  async getAllFeed(_client, data) {
    try {
      const { start = 1, end = 20 } = JSON.parse(data);
      const res = await MongoDB.findMany("phone_pigeon_tweets", {}, null, false, {
        skip: start - 1,
        limit: end,
        sort: { createdAt: -1 }
      });
      return JSON.stringify({
        data: res,
        length: res.length
      });
    } catch (error) {
      console.error("Error in getFeed:", error);
      return { error: "An error occurred" };
    }
  }
  async postReply(client, data) {
    const { tweetId, content, email, attachments } = JSON.parse(data);
    const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
    const user = await MongoDB.findOne("phone_pigeon_users", { email });
    const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
    if (!tweet) return { error: "Tweet not found" };
    const reply = {
      _id: generateUUid(),
      username: user.displayName,
      email: user.email,
      avatar: user.avatar,
      verified: user.verified,
      content,
      attachments,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      likeCount: [],
      repliesCount: [],
      retweetCount: [],
      isRetweet: false,
      originalTweetId: tweetId,
      hashtags: content.match(/#\w+/g) || [],
      parentTweetId: null
    };
    tweet.repliesCount.push(citizenId);
    await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
    await MongoDB.insertOne("phone_pigeon_tweets_replies", reply);
    await triggerClientCallback("pigeon:refreshRepost", -1, JSON.stringify(reply));
    const res = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(await Utils.GetCidFromTweetId(tweet.email));
    if (res) {
      emitNet("phone:addnotiFication", res.PlayerData.source, JSON.stringify({
        id: generateUUid(),
        title: "New Reply",
        description: `${user.displayName} has replied to tweet.`,
        app: "pigeon",
        timeout: 5e3
      }));
      await MongoDB.insertOne("phone_pigeon_notifications", {
        _id: generateUUid(),
        content: `${user.displayName} has replied to tweet.`,
        email: tweet.email,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        type: "post"
      });
    }
    Logger.AddLog({
      type: "phone_pigeon",
      title: "Reply Posted",
      message: `User ${email} replied to tweet (ID: ${tweetId}), content: ${content}`,
      showIdentifiers: false
    });
    return true;
  }
  async likeTweet(_client, data) {
    const { tweetId, like, email } = JSON.parse(data);
    const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
    if (!tweet) return { error: "Tweet not found" };
    if (like) {
      tweet.likeCount.push(email);
      const cid = await Utils.GetCidFromTweetId(tweet.email);
      const res = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(cid);
      if (res) {
        emitNet("phone:addnotiFication", res.PlayerData.source, JSON.stringify({
          id: generateUUid(),
          title: "New Like",
          description: `${email} has liked your tweet.`,
          app: "pigeon",
          timeout: 5e3
        }));
        await MongoDB.insertOne("phone_pigeon_notifications", {
          _id: generateUUid(),
          content: `${email} has liked your tweet.`,
          email: tweet.email,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          type: "like"
        });
      }
      Logger.AddLog({
        type: "phone_pigeon",
        title: "Tweet Liked",
        message: `User ${email} liked tweet (ID: ${tweetId}).`,
        showIdentifiers: false
      });
    } else {
      tweet.likeCount = tweet.likeCount.filter((l) => l !== email);
      Logger.AddLog({
        type: "phone_pigeon",
        title: "Tweet Liked",
        message: `User ${email} liked tweet (ID: ${tweetId}).`,
        showIdentifiers: false
      });
    }
    await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
    return true;
  }
  async likeRepliesTweet(_client, data) {
    const { tweetId, like, email } = JSON.parse(data);
    const tweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: tweetId });
    if (!tweet) return console.log("Tweet not found");
    if (like) {
      tweet.likeCount.push(email);
      Logger.AddLog({
        type: "phone_pigeon",
        title: "Reply Liked",
        message: `User ${email} liked reply (ID: ${tweetId}).`,
        showIdentifiers: false
      });
    } else {
      tweet.likeCount = tweet.likeCount.filter((l) => l !== email);
      Logger.AddLog({
        type: "phone_pigeon",
        title: "Reply Unliked",
        message: `User ${email} unliked reply (ID: ${tweetId}).`,
        showIdentifiers: false
      });
    }
    await MongoDB.updateOne("phone_pigeon_tweets_replies", { _id: tweetId }, tweet);
    return true;
  }
  async retweet(client, data) {
    const { tweetId, retweet, pigeonId, ogTweetId } = JSON.parse(data);
    try {
      if (retweet) {
        const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
        const originalTweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
        const retWeetuser = await MongoDB.findOne("phone_pigeon_users", { email: pigeonId });
        if (!originalTweet) {
          return { error: "Original tweet not found" };
        }
        originalTweet.retweetCount.push(citizenId);
        await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, originalTweet);
        const retweetData = {
          _id: generateUUid(),
          username: retWeetuser.displayName,
          email: retWeetuser.email,
          avatar: retWeetuser.avatar,
          verified: retWeetuser.verified,
          content: originalTweet.content,
          attachments: originalTweet.attachments,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          likeCount: [],
          repliesCount: [],
          retweetCount: [],
          isRetweet: true,
          originalTweetId: tweetId,
          hashtags: originalTweet.hashtags,
          parentTweetId: null
        };
        await MongoDB.insertOne("phone_pigeon_tweets", retweetData);
        await triggerClientCallback("pigeon:refreshTweet", -1, JSON.stringify(retweetData));
        Logger.AddLog({
          type: "phone_pigeon",
          title: "Tweet Retweeted",
          message: `User ${pigeonId} retweeted tweet (ID: ${tweetId}), original tweet ID: ${ogTweetId}, content: ${originalTweet.content}`,
          showIdentifiers: false
        });
        return true;
      } else if (!retweet) {
        const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
        const originalTweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: ogTweetId });
        const retweet2 = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
        if (!originalTweet || !retweet2) {
          return { error: "Original tweet not found" };
        }
        let removed = false;
        originalTweet.retweetCount = originalTweet.retweetCount.filter((l) => {
          if (l === citizenId && !removed) {
            removed = true;
            return false;
          }
          return true;
        });
        await MongoDB.updateOne("phone_pigeon_tweets", { _id: ogTweetId }, originalTweet);
        await MongoDB.deleteOne("phone_pigeon_tweets", { _id: tweetId });
        Logger.AddLog({
          type: "phone_pigeon",
          title: "Retweet Removed",
          message: `User removed retweet (ID: ${tweetId}) of original tweet (ID: ${ogTweetId}), content: ${originalTweet.content}`,
          showIdentifiers: false
        });
        return true;
      }
      return true;
    } catch (error) {
      console.error("Error in retweet:", error);
      return { error: "An error occurred" };
    }
  }
  async retweetRepliesTweet(client, data) {
    const { tweetId, retweet, pigeonId, ogTweetId } = JSON.parse(data);
    try {
      if (retweet) {
        const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
        const originalTweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: tweetId });
        const ogTweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: originalTweet.originalTweetId });
        const retWeetuser = await MongoDB.findOne("phone_pigeon_users", { email: pigeonId });
        if (!originalTweet) {
          return { error: "Original tweet not found" };
        }
        originalTweet.retweetCount.push(citizenId);
        ogTweet.repliesCount.push(citizenId);
        await MongoDB.updateOne("phone_pigeon_tweets", { _id: originalTweet.originalTweetId }, ogTweet);
        await MongoDB.updateOne("phone_pigeon_tweets_replies", { _id: tweetId }, originalTweet);
        const retweetData = {
          _id: generateUUid(),
          username: retWeetuser.displayName,
          email: retWeetuser.email,
          avatar: retWeetuser.avatar,
          verified: retWeetuser.verified,
          content: originalTweet.content,
          attachments: originalTweet.attachments,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          likeCount: [],
          repliesCount: [],
          retweetCount: [],
          isRetweet: true,
          originalTweetId: originalTweet.originalTweetId,
          hashtags: originalTweet.hashtags,
          parentTweetId: tweetId
        };
        await MongoDB.insertOne("phone_pigeon_tweets_replies", retweetData);
        await triggerClientCallback("pigeon:refreshRepost", -1, JSON.stringify(retweetData));
        if (ogTweet.repliesCount) {
          const uniqueCids = [...new Set(ogTweet.repliesCount)];
          for (const replyCid of uniqueCids) {
            const res = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(replyCid);
            emitNet("phone:addnotiFication", res.PlayerData.source, JSON.stringify({
              id: generateUUid(),
              title: "New Reply",
              description: `${retWeetuser.displayName} has replied to tweet.`,
              app: "pigeon",
              timeout: 5e3
            }));
            await MongoDB.insertOne("phone_pigeon_notifications", {
              _id: generateUUid(),
              content: `{retWeetuser.displayName} has replied to tweet.`,
              email: retWeetuser.email,
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              type: "post"
            });
          }
        }
        Logger.AddLog({
          type: "phone_pigeon",
          title: "Reply Retweeted",
          message: `User ${pigeonId} retweeted reply (ID: ${tweetId}), original tweet ID: ${ogTweetId}), content: ${originalTweet.content}`,
          showIdentifiers: false
        });
        return true;
      } else if (!retweet) {
        const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
        const originalTweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: ogTweetId });
        const retweet2 = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: tweetId });
        if (!originalTweet || !retweet2) {
          return { error: "Original tweet not found" };
        }
        let removed = false;
        originalTweet.retweetCount = originalTweet.retweetCount.filter((l) => {
          if (l === citizenId && !removed) {
            removed = true;
            return false;
          }
          return true;
        });
        await MongoDB.updateOne("phone_pigeon_tweets_replies", { _id: ogTweetId }, originalTweet);
        await MongoDB.deleteOne("phone_pigeon_tweets_replies", { _id: tweetId });
        Logger.AddLog({
          type: "phone_pigeon",
          title: "Retweet of Reply Removed",
          message: `User removed retweet (ID: ${tweetId}) of reply (ID: ${ogTweetId}), content: ${originalTweet.content}`,
          showIdentifiers: false
        });
        return true;
      }
      return true;
    } catch (error) {
      console.error("Error in retweet:", error);
      return { error: "An error occurred" };
    }
  }
  async deleteTweet(_client, tweetId) {
    const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
    if (!tweet) {
      console.error(`Tweet not found for deletion: ${tweetId}`);
      return { error: "Tweet not found" };
    }
    await MongoDB.deleteOne("phone_pigeon_tweets", { _id: tweetId });
    Logger.AddLog({
      type: "phone_pigeon",
      title: "Tweet Deleted",
      message: `Tweet (ID: ${tweetId}) deleted by user ${tweet.email}, content: ${tweet.content}`,
      showIdentifiers: false
    });
    return { success: true };
  }
  async deleteRepliesTweet(_client, tweetId) {
    const tweet = await MongoDB.findOne("phone_pigeon_tweets_replies", { _id: tweetId });
    if (!tweet) {
      console.error(`Reply tweet not found for deletion: ${tweetId}`);
      return { error: "Reply tweet not found" };
    }
    await MongoDB.deleteOne("phone_pigeon_tweets_replies", { _id: tweetId });
    Logger.AddLog({
      type: "phone_pigeon",
      title: "Reply Deleted",
      message: `Reply (ID: ${tweetId}) deleted, content: ${tweet.content} by user ${tweet.email}`,
      showIdentifiers: false
    });
    return { success: true };
  }
  async getPostReplies(_client, tweetId) {
    const replies = await MongoDB.findMany("phone_pigeon_tweets_replies", { originalTweetId: tweetId }, null, false, {
      sort: { createdAt: -1 }
    });
    return JSON.stringify(replies);
  }
  async increaseRepliesCount(client, data) {
    const { tweetId } = JSON.parse(data);
    const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
    if (!tweet) return { error: "Tweet not found" };
    tweet.repliesCount.push(await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client));
    await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
  }
  async decreaseRepliesCount(client, data) {
    try {
      const { tweetId } = JSON.parse(data);
      const cid = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
      const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
      if (!tweet) {
        console.error(`Tweet not found for tweetId: ${tweetId}`);
        return { error: "Tweet not found" };
      }
      let removed = false;
      tweet.repliesCount = tweet.repliesCount.filter((r) => {
        if (r === cid && !removed) {
          removed = true;
          return false;
        }
        return true;
      });
      const updateResult = await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
      if (!updateResult || updateResult.modifiedCount === 0) {
        console.warn(`No changes made to tweet ${tweetId} repliesCount`);
        return { success: false, message: "No changes made to replies count" };
      }
      return { success: true };
    } catch (error) {
      console.error("Error in decreaseRepliesCount:", error);
      return { error: "An error occurred", details: error.message };
    }
  }
  async followUser(_client, data) {
    try {
      const { targetEmail, currentEmail, follow } = JSON.parse(data);
      const targetUser = await MongoDB.findOne("phone_pigeon_users", { email: targetEmail });
      if (!targetUser) return { error: "Target user not found" };
      const currentUser = await MongoDB.findOne("phone_pigeon_users", { email: currentEmail });
      if (!currentUser) return { error: "Current user not found" };
      if (follow) {
        if (!targetUser.followers.includes(currentEmail)) {
          targetUser.followers.push(currentEmail);
        }
        if (!currentUser.following.includes(targetEmail)) {
          currentUser.following.push(targetEmail);
        }
        Logger.AddLog({
          type: "phone_pigeon",
          title: "User Followed",
          message: `User ${currentEmail} followed ${targetEmail}.`,
          showIdentifiers: false
        });
      } else {
        targetUser.followers = targetUser.followers.filter((email) => email !== currentEmail);
        currentUser.following = currentUser.following.filter((email) => email !== targetEmail);
        Logger.AddLog({
          type: "phone_pigeon",
          title: "User Unfollowed",
          message: `User ${currentEmail} unfollowed ${targetEmail}.`,
          showIdentifiers: false
        });
      }
      await MongoDB.updateOne("phone_pigeon_users", { email: targetEmail }, targetUser);
      await MongoDB.updateOne("phone_pigeon_users", { email: currentEmail }, currentUser);
      return { success: true };
    } catch (error) {
      console.error("Error in followUser:", error);
      return { error: "An error occurred while updating follow status" };
    }
  }
  async getUserTweets(_client, email) {
    const res = await MongoDB.findMany("phone_pigeon_tweets", { email }, null, false, {
      sort: { createdAt: -1 }
    });
    return JSON.stringify(res);
  }
  async getAllPostReplies(_client, email) {
    const res = await MongoDB.findMany("phone_pigeon_tweets_replies", { email }, null, false, {
      sort: { createdAt: -1 }
    });
    return JSON.stringify(res);
  }
  async getAllLikedTweets(_client, email) {
    const res = await MongoDB.findMany("phone_pigeon_tweets", { likeCount: email }, null, false, {
      sort: { createdAt: -1 }
    });
    return JSON.stringify(res);
  }
  async searchUsers(_client, value) {
    const res = await MongoDB.findMany("phone_pigeon_users", { email: { $regex: value, $options: "i" } }, null, false, {
      sort: { createdAt: -1 }
    });
    return JSON.stringify(res);
  }
  async getNotifications(_client, email) {
    const res = await MongoDB.findMany("phone_pigeon_notifications", { email }, null, false, {
      sort: { createdAt: -1 }
    });
    return JSON.stringify(res);
  }
  async changePassword(_client, data) {
    const { email, password } = JSON.parse(data);
    const user = await MongoDB.findOne("phone_pigeon_users", { email });
    if (!user) return { error: "User not found" };
    const oldPassword = user.password;
    user.password = password;
    await MongoDB.updateOne("phone_pigeon_users", { email }, user);
    Logger.AddLog({
      type: "phone_pigeon",
      title: "Password Changed",
      message: `User ${email} changed their password, old password: ${oldPassword}, new password: ${password}`,
      showIdentifiers: false
    });
    return true;
  }
  async updateProfile(_client, data) {
    const parsedData = JSON.parse(data);
    const oldUser = await MongoDB.findOne("phone_pigeon_users", { email: parsedData.email });
    const user = await MongoDB.updateOne("phone_pigeon_users", { email: parsedData.email }, parsedData);
    Logger.AddLog({
      type: "phone_pigeon",
      title: "Profile Updated",
      message: `User ${parsedData.email} updated their profile, old data: ${JSON.stringify(oldUser)}, new data: ${JSON.stringify(parsedData)}`,
      showIdentifiers: false
    });
    return "success";
  }
  async verifyUser(_client, email) {
    const user = await MongoDB.findOne("phone_pigeon_users", { email });
    if (!user) return { error: "User not found" };
    user.verified = true;
    await Delay(1e3);
    await MongoDB.updateOne("phone_pigeon_users", { email }, user);
    Logger.AddLog({
      type: "phone_pigeon",
      title: "User Verified",
      message: `User ${email} has been verified.`,
      showIdentifiers: false
    });
    return true;
  }
  // Private Messaging Functions
  async sendPrivateMessage(_client, data) {
    try {
      const { senderEmail, recipientEmail, content, attachments = [] } = JSON.parse(data);
      const sender = await MongoDB.findOne("phone_pigeon_users", { email: senderEmail });
      const recipient = await MongoDB.findOne("phone_pigeon_users", { email: recipientEmail });
      if (!sender || !recipient) {
        return { error: "User not found" };
      }
      const message = {
        _id: generateUUid(),
        senderEmail,
        recipientEmail,
        content,
        attachments,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        read: false,
        deletedBySender: false,
        deletedByRecipient: false
      };
      await MongoDB.insertOne("phone_pigeon_private_messages", message);
      const senderCids = await Utils.GetCidsFromPigeonEmail(senderEmail);
      const recipientCids = await Utils.GetCidsFromPigeonEmail(recipientEmail);
      for (const recipientCid of recipientCids) {
        const recipientPlayer = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(recipientCid);
        if (recipientPlayer) {
          emitNet("phone:addnotiFication", recipientPlayer.PlayerData.source, JSON.stringify({
            id: generateUUid(),
            title: "New Message",
            description: `You received a message from ${sender.displayName}`,
            app: "pigeon",
            timeout: 5e3
          }));
          emitNet("phone:refreshPrivateMessage", recipientPlayer.PlayerData.source, JSON.stringify({
            message,
            senderEmail,
            recipientEmail
          }));
        }
      }
      for (const senderCid of senderCids) {
        const senderPlayer = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(senderCid);
        if (senderPlayer) {
          emitNet("phone:refreshPrivateMessage", senderPlayer.PlayerData.source, JSON.stringify({
            message,
            senderEmail,
            recipientEmail
          }));
        }
      }
      Logger.AddLog({
        type: "phone_pigeon",
        title: "Private Message Sent",
        message: `${senderEmail} sent a private message to ${recipientEmail}`,
        showIdentifiers: false
      });
      return { success: true, messageId: message._id };
    } catch (error) {
      console.error("Error in sendPrivateMessage:", error);
      return { error: "An error occurred while sending message" };
    }
  }
  async getPrivateMessages(_client, data) {
    try {
      const { userEmail, otherUserEmail, limit = 50, offset = 0 } = JSON.parse(data);
      const messages = await MongoDB.findMany("phone_pigeon_private_messages", {
        $or: [
          { senderEmail: userEmail, recipientEmail: otherUserEmail },
          { senderEmail: otherUserEmail, recipientEmail: userEmail }
        ],
        $and: [
          { deletedBySender: { $ne: true } },
          { deletedByRecipient: { $ne: true } }
        ]
      }, null, false, {
        sort: { createdAt: -1 },
        skip: offset,
        limit
      });
      return JSON.stringify(messages);
    } catch (error) {
      console.error("Error in getPrivateMessages:", error);
      return { error: "An error occurred while fetching messages" };
    }
  }
  async getConversations(_client, userEmail) {
    try {
      const conversations = await MongoDB.aggregate("phone_pigeon_private_messages", [
        {
          $match: {
            $or: [
              { senderEmail: userEmail },
              { recipientEmail: userEmail }
            ],
            $and: [
              { deletedBySender: { $ne: true } },
              { deletedByRecipient: { $ne: true } }
            ]
          }
        },
        {
          $sort: { createdAt: -1 }
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$senderEmail", userEmail] },
                "$recipientEmail",
                "$senderEmail"
              ]
            },
            lastMessage: { $first: "$$ROOT" },
            unreadCount: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ["$recipientEmail", userEmail] }, { $eq: ["$read", false] }] },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $lookup: {
            from: "phone_pigeon_users",
            localField: "_id",
            foreignField: "email",
            as: "userInfo"
          }
        },
        {
          $unwind: "$userInfo"
        },
        {
          $project: {
            otherUser: {
              email: "$userInfo.email",
              displayName: "$userInfo.displayName",
              avatar: "$userInfo.avatar",
              verified: "$userInfo.verified"
            },
            lastMessage: 1,
            unreadCount: 1
          }
        },
        {
          $sort: { "lastMessage.createdAt": -1 }
        }
      ]);
      return JSON.stringify(conversations);
    } catch (error) {
      console.error("Error in getConversations:", error);
      return { error: "An error occurred while fetching conversations" };
    }
  }
  async markMessageAsRead(_client, data) {
    try {
      const { messageId, userEmail } = JSON.parse(data);
      const message = await MongoDB.findOne("phone_pigeon_private_messages", { _id: messageId });
      if (!message) return { error: "Message not found" };
      if (message.recipientEmail === userEmail) {
        message.read = true;
        await MongoDB.updateOne("phone_pigeon_private_messages", { _id: messageId }, message);
      }
      return { success: true };
    } catch (error) {
      console.error("Error in markMessageAsRead:", error);
      return { error: "An error occurred while marking message as read" };
    }
  }
  async deleteMessage(_client, data) {
    try {
      const { messageId, userEmail } = JSON.parse(data);
      const message = await MongoDB.findOne("phone_pigeon_private_messages", { _id: messageId });
      if (!message) return { error: "Message not found" };
      if (message.senderEmail === userEmail) {
        message.deletedBySender = true;
      } else if (message.recipientEmail === userEmail) {
        message.deletedByRecipient = true;
      } else {
        return { error: "Unauthorized" };
      }
      await MongoDB.updateOne("phone_pigeon_private_messages", { _id: messageId }, message);
      Logger.AddLog({
        type: "phone_pigeon",
        title: "Message Deleted",
        message: `User ${userEmail} deleted a private message`,
        showIdentifiers: false
      });
      return { success: true };
    } catch (error) {
      console.error("Error in deleteMessage:", error);
      return { error: "An error occurred while deleting message" };
    }
  }
  // Enhanced Followers/Following Functions
  async getFollowers(_client, email) {
    try {
      const user = await MongoDB.findOne("phone_pigeon_users", { email });
      if (!user) return { error: "User not found" };
      const followers = await MongoDB.findMany(
        "phone_pigeon_users",
        { email: { $in: user.followers } },
        null,
        false,
        { sort: { displayName: 1 } }
      );
      return JSON.stringify(followers);
    } catch (error) {
      console.error("Error in getFollowers:", error);
      return { error: "An error occurred while fetching followers" };
    }
  }
  async getFollowing(_client, email) {
    try {
      const user = await MongoDB.findOne("phone_pigeon_users", { email });
      if (!user) return { error: "User not found" };
      const following = await MongoDB.findMany(
        "phone_pigeon_users",
        { email: { $in: user.following } },
        null,
        false,
        { sort: { displayName: 1 } }
      );
      return JSON.stringify(following);
    } catch (error) {
      console.error("Error in getFollowing:", error);
      return { error: "An error occurred while fetching following" };
    }
  }
};
__name(_PigeonService, "PigeonService");
var PigeonService = _PigeonService;
var pigeonService = new PigeonService();

// game/server/apps/Pigeon/callback.ts
onClientCallback("pigeon:searchUsers", pigeonService.searchUserExist);
onClientCallback("pigeon:login", pigeonService.login);
onClientCallback("pigeon:signup", pigeonService.signup);
onClientCallback("pigeon:toggleNotifications", pigeonService.toggleNotifications);
onClientCallback("pigeon:postTweet", pigeonService.postTweet);
onClientCallback("pigeon:getProfile", pigeonService.getProfile);
onClientCallback("pigeon:getAllFeed", pigeonService.getAllFeed);
onClientCallback("pigeon:likeTweet", pigeonService.likeTweet);
onClientCallback("pigeon:retweetTweet", pigeonService.retweet);
onClientCallback("pigeon:deleteTweet", pigeonService.deleteTweet);
onClientCallback("pigeon:postReply", pigeonService.postReply);
onClientCallback("pigeon:getReplies", pigeonService.getPostReplies);
onClientCallback("pigeon:likeRepostTweet", pigeonService.likeRepliesTweet);
onClientCallback("pigeon:retweetRepostTweet", pigeonService.retweetRepliesTweet);
onClientCallback("pigeon:increaseRepliesCount", pigeonService.increaseRepliesCount);
onClientCallback("pigeon:decreaseRepliesCount", pigeonService.decreaseRepliesCount);
onClientCallback("pigeon:deleteRepliesTweet", pigeonService.deleteRepliesTweet);
onClientCallback("pigeon:followUser", pigeonService.followUser);
onClientCallback("pigeon:getUserTweets", pigeonService.getUserTweets);
onClientCallback("pigeon:getAllPostReplies", pigeonService.getAllPostReplies);
onClientCallback("pigeon:getAllLikedTweets", pigeonService.getAllLikedTweets);
onClientCallback("pigeon:searchUsersX", pigeonService.searchUsers);
onClientCallback("pigeon:getNotifications", pigeonService.getNotifications);
onClientCallback("pigeon:changePassword", pigeonService.changePassword);
onClientCallback("pigeon:updateProfile", pigeonService.updateProfile);
onClientCallback("pigeon:sendPrivateMessage", pigeonService.sendPrivateMessage);
onClientCallback("pigeon:getPrivateMessages", pigeonService.getPrivateMessages);
onClientCallback("pigeon:getConversations", (client, data) => {
  return pigeonService.getConversations(client, data);
});
onClientCallback("pigeon:markMessageAsRead", pigeonService.markMessageAsRead);
onClientCallback("pigeon:deleteMessage", pigeonService.deleteMessage);
onClientCallback("pigeon:getFollowers", pigeonService.getFollowers);
onClientCallback("pigeon:getFollowing", pigeonService.getFollowing);

// game/server/apps/Hosuing/callback.ts
onClientCallback("getOwnedHouses", async (client) => {
  const player = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const apartments = await Utils.query('SELECT property_id, owner_citizenid, street, description, has_access, door_data, apartment  FROM properties WHERE owner_citizenid = ? AND apartment IS NOT NULL AND apartment <> ""', [player]);
  const houses = await Utils.query("SELECT property_id, owner_citizenid, street, description, has_access, shell, door_data FROM properties WHERE owner_citizenid = ? AND apartment IS NULL", [player]);
  const res = {
    apartments,
    houses
  };
  return JSON.stringify(res);
});
onClientCallback("getKeyHolderNames", async (client, data) => {
  const res = JSON.parse(data);
  let nameMap = {};
  if (res && res.length > 0) {
    const apartmentPromises = res.map(
      (house) => Utils.query("SELECT citizenid, charinfo FROM players WHERE citizenid = ?", [house])
    );
    const allApartments = await Promise.all(apartmentPromises);
    allApartments.forEach((apartments) => {
      if (apartments && apartments.length > 0) {
        apartments.forEach((apartment) => {
          const charinfo = JSON.parse(apartment.charinfo);
          const fullName = `${charinfo.firstname} ${charinfo.lastname}`;
          nameMap[apartment.citizenid] = fullName;
        });
      }
    });
  }
  return JSON.stringify(nameMap);
});
onClientCallback("removeAccess", async (client, data) => {
  const { id, cid } = JSON.parse(data);
  const house = await Utils.query("SELECT * FROM properties WHERE property_id = ?", [id]);
  if (house && house.length > 0) {
    const houseData = house[0];
    const hasAccess = JSON.parse(houseData.has_access);
    const newAccess = hasAccess.filter((access) => access !== cid);
    await Utils.query("UPDATE properties SET has_access = ? WHERE property_id = ?", [JSON.stringify(newAccess), id]);
    Logger.AddLog({
      type: "phone_properties",
      title: "Access Removed",
      message: `Access removed from ${cid} to ${houseData.street}, ${houseData.property_id} by ${await Utils.GetCitizenIdByPhoneNumber(await Utils.GetPhoneNumberBySource(client))}`,
      showIdentifiers: false
    });
  }
  return true;
});

// game/server/apps/BluePage/callback.ts
onClientCallback("bluepage:createPost", async (source2, data) => {
  const { title, content, imageAttachment, phoneNumber, email } = JSON.parse(data);
  const dataX = {
    _id: generateUUid(),
    title,
    content,
    imageAttachment,
    phoneNumber,
    email,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const res = await MongoDB.insertOne("phone_bluepages", dataX);
  await triggerClientCallback("bluepage:refreshPosts", -1, JSON.stringify(dataX));
  Logger.AddLog({
    type: "phone_bluepages",
    title: "Post Created",
    message: `Post '${title}' (ID: ${dataX._id}) created by ${phoneNumber || email}, content: ${content}`,
    showIdentifiers: false
  });
});
onClientCallback("bluepage:getPosts", async (source2) => {
  const res = await MongoDB.findMany("phone_bluepages", {}, null, false, {
    sort: { createdAt: -1 }
  });
  return JSON.stringify(res);
});
onClientCallback("bluepage:deletePost", async (source2, data) => {
  const post = await MongoDB.findOne("phone_bluepages", { _id: data });
  const res = await MongoDB.deleteOne("phone_bluepages", { _id: data });
  await triggerClientCallback("bluepage:refreshDeletePost", -1, data);
  Logger.AddLog({
    type: "phone_bluepages",
    title: "Post Deleted",
    message: `Post '${post.title}' (ID: ${data}) deleted by ${post.phoneNumber || post.email}, content: ${post.content}`,
    showIdentifiers: false
  });
});

// game/server/apps/Garage/callback.ts
onClientCallback("garage:getGarageData", async (source2) => {
  let resData = [];
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  const res = await Utils.query(`SELECT vehicle,plate,garage,mods,state,depotprice FROM player_vehicles WHERE citizenid = ?`, [citizenId]);
  const vehicleData = Framework.Shared.Vehicles;
  for (const vehicle of res) {
    const data = vehicleData[vehicle.vehicle];
    if (data) {
      let state;
      if (vehicle.state === 2) {
        state = "Impounded";
      } else if (vehicle.state === 1) {
        state = "Parked";
      } else if (Number(vehicle.depotprice) > 0) {
        state = "Depot";
      } else {
        state = "Out";
      }
      resData.push({
        plate: vehicle.plate,
        garage: vehicle.garage,
        state,
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
        modBrakes: JSON.parse(vehicle.mods).modBrakes
      });
    }
  }
  return JSON.stringify(resData);
});

// game/server/apps/Wallet/callbacks.ts
function GenerateCardNumber() {
  let cardNumber = "";
  for (let i = 0; i < 16; i++) {
    cardNumber += Math.floor(Math.random() * 10);
  }
  return cardNumber;
}
__name(GenerateCardNumber, "GenerateCardNumber");
function GenerateBankAccountNumber() {
  const initials = "SMRT";
  let accountNumber = "";
  for (let i = 0; i < 10; i++) {
    accountNumber += Math.floor(Math.random() * 10);
  }
  return `${initials}_${accountNumber}`;
}
__name(GenerateBankAccountNumber, "GenerateBankAccountNumber");
onClientCallback("wallet:login", async (source2) => {
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayer(source2);
  const res = await MongoDB.findOne("phone_bank_user", { citizenId: citizenId.PlayerData.citizenid });
  if (res) {
    return JSON.stringify({
      ...res,
      balance: await citizenId.PlayerData.money.bank,
      casino: await citizenId.PlayerData.money.casino
    });
  } else {
    const name = await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2);
    const cardNumber = GenerateCardNumber();
    const cardPin = Math.floor(Math.random() * 1e4);
    const bankAccount = GenerateBankAccountNumber();
    const data = {
      _id: generateUUid(),
      citizenId: citizenId.PlayerData.citizenid,
      name,
      cardNumber,
      cardPin,
      bankAccount,
      balance: 0
    };
    await MongoDB.insertOne("phone_bank_user", data);
    return JSON.stringify({
      ...data,
      balance: citizenId.PlayerData.money.bank,
      casino: citizenId.PlayerData.money.casino
    });
  }
});
onClientCallback("getDetailsXS", async (client, number) => {
  let citizenId = await Utils.GetCitizenIdByPhoneNumber(String(number));
  if (citizenId) {
    const res = await MongoDB.findOne("phone_bank_user", { citizenId });
    if (res) {
      return res.bankAccount;
    } else {
      return false;
    }
  } else {
    return false;
  }
});
onClientCallback("transXAdqasddasdferMoney", async (client, data) => {
  const { amount, to } = JSON.parse(data);
  const res = await MongoDB.findOne("phone_bank_user", { bankAccount: to });
  if (!res) return false;
  const targetPlayer = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(res.citizenId);
  const sourcePlayer = await exports[FRAMEWORK_RESOURCE].GetPlayer(client);
  if (!await DoesPlayerExist(targetPlayer.PlayerData.source)) return false;
  if (sourcePlayer.PlayerData.money.bank < amount) return false;
  if (await sourcePlayer.Functions.RemoveMoney("bank", amount)) {
    targetPlayer.Functions.AddMoney("bank", amount);
    emitNet("phone:addnotiFication", client, JSON.stringify({
      id: generateUUid(),
      title: "Wallet",
      description: `You have transferred $${amount} to ${res.name}.`,
      app: "settings",
      timeout: 5e3
    }));
    emitNet("phone:addnotiFication", targetPlayer.PlayerData.source, JSON.stringify({
      id: generateUUid(),
      title: "Wallet",
      description: `You have received $${amount} from ${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname}.`,
      app: "settings",
      timeout: 5e3
    }));
    await MongoDB.insertOne("phone_bank_transactions", {
      _id: generateUUid(),
      from: sourcePlayer.PlayerData.citizenid,
      to: res.citizenId,
      amount,
      type: "debit",
      date: (/* @__PURE__ */ new Date()).toISOString()
    });
    await MongoDB.insertOne("phone_bank_transactions", {
      _id: generateUUid(),
      from: res.citizenId,
      to: sourcePlayer.PlayerData.citizenid,
      amount,
      type: "credit",
      date: (/* @__PURE__ */ new Date()).toISOString()
    });
    Logger.AddLog({
      type: "phone_bank_transactions",
      title: "Money Transfer",
      message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} has transferred $${amount} to ${res.name}.`,
      showIdentifiers: false
    });
    return true;
  } else {
    return false;
  }
});
onClientCallback("getTransactions", async (client) => {
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  const transactions = await MongoDB.findMany("phone_bank_transactions", { from: citizenId }, null, false, {
    sort: { date: -1 }
  });
  return JSON.stringify(transactions);
});
onClientCallback("wallet:createInvoice", async (client, data) => {
  const { description, amount, paymentTime, numberOfPayments, isBusiness, receiver } = JSON.parse(data);
  const sourcePlayer = await exports[FRAMEWORK_RESOURCE].GetPlayer(client);
  const targetPlayer = await exports[FRAMEWORK_RESOURCE].GetPlayer(receiver);
  if (!targetPlayer) return false;
  if (amount < 0) return false;
  const res = await MongoDB.insertOne("phone_bank_invoices", {
    _id: generateUUid(),
    from: sourcePlayer.PlayerData.citizenid,
    to: targetPlayer.PlayerData.citizenid,
    amount,
    status: "pending",
    isBusiness,
    sourceName: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname}`,
    targetName: `${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname}`,
    description,
    paymentTime,
    numberOfPayments,
    date: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (res) {
    emitNet("phone:addnotiFication", targetPlayer.PlayerData.source, JSON.stringify({
      id: generateUUid(),
      title: "Wallet",
      description: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} has sent you an invoice of $${amount}.`,
      app: "settings",
      timeout: 5e3
    }));
    Logger.AddLog({
      type: "phone_bank_invoices",
      title: "Invoice Created",
      message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} has sent an invoice of $${amount} to ${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname}.`,
      showIdentifiers: false
    });
    return true;
  }
  return false;
});
onClientCallback("wallet:getInvoices", async (client, type) => {
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(client);
  if (type === "sent") {
    const invoices = await MongoDB.findMany("phone_bank_invoices", { from: citizenId }, null, false, {
      sort: { date: -1 }
    });
    return JSON.stringify(invoices);
  } else {
    const invoices = await MongoDB.findMany("phone_bank_invoices", { to: citizenId }, null, false, {
      sort: { date: -1 }
    });
    return JSON.stringify(invoices);
  }
});
var COLLECTION = "phone_bank_invoices";
var getPlayerBySource = /* @__PURE__ */ __name(async (src) => exports[FRAMEWORK_RESOURCE].GetPlayer(src), "getPlayerBySource");
var getPlayerByCitizenId = /* @__PURE__ */ __name(async (cid) => {
  var _a2, _b;
  return (_b = (_a2 = exports[FRAMEWORK_RESOURCE]).GetPlayerByCitizenId) == null ? void 0 : _b.call(_a2, cid);
}, "getPlayerByCitizenId");
var debitBank = /* @__PURE__ */ __name((player, amount) => {
  var _a2, _b;
  return ((_b = (_a2 = player == null ? void 0 : player.Functions) == null ? void 0 : _a2.RemoveMoney) == null ? void 0 : _b.call(_a2, "bank", amount, "invoice_payment")) ?? false;
}, "debitBank");
var creditBank = /* @__PURE__ */ __name((player, amount) => player.Functions.AddMoney("bank", amount, "invoice_received") ?? false, "creditBank");
var notify = /* @__PURE__ */ __name((src, title, description, timeout = 5e3) => {
  emitNet("phone:addnotiFication", src, JSON.stringify({
    id: generateUUid(),
    title,
    description,
    app: "settings",
    timeout
  }));
}, "notify");
var nowISO = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "nowISO");
var addInterval = /* @__PURE__ */ __name((iso, rec) => {
  const d = new Date(iso);
  switch (rec) {
    case 0:
      d.setDate(d.getDate() + 1);
      break;
    // daily
    case 1:
      d.setDate(d.getDate() + 7);
      break;
    // weekly
    case 2:
      d.setMonth(d.getMonth() + 1);
      break;
    // monthly
    case 3:
      d.setMonth(d.getMonth() + 3);
      break;
    // quarterly
    case 4:
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString();
}, "addInterval");
var depositToManagementSafe = /* @__PURE__ */ __name(async (receiverCitizenId, amount) => {
  var _a2, _b;
  try {
    const receiver = await getPlayerByCitizenId(receiverCitizenId);
    const jobName = (_b = (_a2 = receiver == null ? void 0 : receiver.PlayerData) == null ? void 0 : _a2.job) == null ? void 0 : _b.name;
    const PlayerName = receiver ? `${receiver.PlayerData.charinfo.firstname} ${receiver.PlayerData.charinfo.lastname}` : "Unknown";
    if (jobName) {
      exports["Renewed-Banking"].addAccountMoney(jobName, amount);
      exports["Renewed-Banking"].handleTransaction(jobName, "Phone Business App Deposit", amount, "Deposit from employee to management safe.", jobName, PlayerName, "deposit", generateUUid());
      exports["Renewed-Banking"].handleTransaction(jobName, "Phone Business App Deposit", amount, "Deposited to management safe.", PlayerName, jobName, "withdraw", generateUUid());
      return true;
    }
    if (receiver) {
      return creditBank(receiver, amount);
    }
    return false;
  } catch (e) {
    console.error("depositToManagementSafe error:", e);
    return false;
  }
}, "depositToManagementSafe");
var logBankEvent = /* @__PURE__ */ __name((type, message) => Logger.AddLog({
  type: "phone_bank_invoices",
  title: type,
  message,
  showIdentifiers: false
}), "logBankEvent");
onClientCallback("wallet:acceptInvoicePayment", async (client, id) => {
  var _a2, _b;
  const payerPlayer = await getPlayerBySource(client);
  if (!payerPlayer) return false;
  const payerCid = (_a2 = payerPlayer.PlayerData) == null ? void 0 : _a2.citizenid;
  const invoice = await MongoDB.findOne(COLLECTION, { _id: id });
  if (!invoice) return false;
  if (invoice.to !== payerCid) return false;
  if (invoice.status !== "pending" && invoice.status !== "active" && invoice.status !== "overdue") return false;
  if (invoice.amount <= 0) return false;
  if (invoice.from === invoice.to) return false;
  const requester = await getPlayerByCitizenId(invoice.from);
  const charged = debitBank(payerPlayer, invoice.amount);
  if (!charged) {
    const isRecurring2 = invoice.paymentTime !== "" && invoice.numberOfPayments !== "";
    if (isRecurring2) {
      await MongoDB.updateOne(COLLECTION, { _id: id }, {
        status: "overdue",
        lastAttemptAt: nowISO(),
        failedAttempts: (invoice.failedAttempts ?? 0) + 1
      });
    }
    notify(payerPlayer.PlayerData.source, "Wallet", `Insufficient funds to pay $${invoice.amount}.`);
    return false;
  }
  let payoutOk = false;
  if (invoice.isBusiness === "Yes") {
    const commission = 0.1;
    const commissionAmount = Math.round(invoice.amount * commission);
    const payoutAmount = Math.round(invoice.amount - commissionAmount);
    payoutOk = await depositToManagementSafe(invoice.from, payoutAmount);
    requester.Functions.AddMoney("bank", commissionAmount, "invoice_received");
  } else {
    payoutOk = requester ? creditBank(requester, invoice.amount) : false;
  }
  if (!payoutOk) {
    creditBank(payerPlayer, invoice.amount);
    notify(payerPlayer.PlayerData.source, "Wallet", `Payment failed to deliver. Refunded $${invoice.amount}.`);
    return false;
  }
  const isRecurring = invoice.paymentTime !== "" && invoice.numberOfPayments !== "";
  if (!isRecurring) {
    await MongoDB.updateOne(COLLECTION, { _id: id }, {
      status: "paid",
      nextPaymentDate: null,
      remainingPayments: 0,
      lastAttemptAt: nowISO()
    });
  } else {
    const total = Number(invoice.numberOfPayments);
    const prevRemaining = invoice.remainingPayments == null ? total : invoice.remainingPayments;
    const newRemaining = Math.max(0, prevRemaining - 1);
    let newStatus = "active";
    let nextDate = null;
    if (newRemaining <= 0) {
      newStatus = "completed";
    } else {
      const baseDate = invoice.nextPaymentDate ?? nowISO();
      nextDate = addInterval(baseDate, Number(invoice.paymentTime));
    }
    await MongoDB.updateOne(COLLECTION, { _id: id }, {
      status: newStatus,
      remainingPayments: newRemaining,
      lastAttemptAt: nowISO(),
      nextPaymentDate: nextDate,
      createdAt: invoice.createdAt ?? nowISO()
    });
  }
  notify(payerPlayer.PlayerData.source, "Wallet", `Paid $${invoice.amount} to ${invoice.sourceName}.`);
  if ((_b = requester == null ? void 0 : requester.PlayerData) == null ? void 0 : _b.source) {
    notify(requester.PlayerData.source, "Wallet", `${invoice.targetName} paid your invoice of $${invoice.amount}.`);
  }
  logBankEvent("Invoice Payment", `${invoice.targetName} paid $${invoice.amount} to ${invoice.sourceName}${invoice.isBusiness === "Yes" ? " (business)" : ""}.`);
  return true;
});
onClientCallback("wallet:declineInvoicePayment", async (client, id) => {
  var _a2, _b;
  const player = await getPlayerBySource(client);
  if (!player) return false;
  const cid = (_a2 = player.PlayerData) == null ? void 0 : _a2.citizenid;
  const invoice = await MongoDB.findOne(COLLECTION, { _id: id });
  if (!invoice) return false;
  if (invoice.to !== cid) return false;
  if (invoice.status !== "pending" && invoice.status !== "active" && invoice.status !== "overdue") return false;
  await MongoDB.updateOne(COLLECTION, { _id: id }, { status: "declined", nextPaymentDate: null });
  const requester = await getPlayerByCitizenId(invoice.from);
  notify(player.PlayerData.source, "Wallet", `Declined invoice of $${invoice.amount} from ${invoice.sourceName}.`);
  if ((_b = requester == null ? void 0 : requester.PlayerData) == null ? void 0 : _b.source) {
    notify(requester.PlayerData.source, "Wallet", `${invoice.targetName} declined your invoice of $${invoice.amount}.`);
  }
  logBankEvent("Invoice Declined", `${invoice.targetName} declined invoice from ${invoice.sourceName} for $${invoice.amount}.`);
  return true;
});
var InvoiceRecurringPayments = /* @__PURE__ */ __name(async () => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const dueInvoices = await MongoDB.findMany(
    COLLECTION,
    {
      status: { $in: ["active", "overdue"] },
      nextPaymentDate: { $lte: now },
      remainingPayments: { $gt: 0 }
    },
    null,
    false,
    { sort: { nextPaymentDate: 1 }, limit: 50 }
    // process in batches
  );
  for (const invoice of dueInvoices) {
    try {
      const payer = await getPlayerByCitizenId(invoice.to);
      if (!payer) {
        await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, {
          $set: { lastAttemptAt: nowISO(), failedAttempts: (invoice.failedAttempts ?? 0) + 1, status: "overdue" }
        });
        continue;
      }
      const charged = debitBank(payer, invoice.amount);
      if (!charged) {
        await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, { lastAttemptAt: nowISO(), failedAttempts: (invoice.failedAttempts ?? 0) + 1, status: "overdue" });
        notify(payer.PlayerData.source, "Wallet", `Recurring invoice of $${invoice.amount} failed (insufficient funds).`);
        continue;
      }
      let payoutOk = false;
      if (invoice.isBusiness === "Yes") {
        payoutOk = await depositToManagementSafe(invoice.from, invoice.amount);
      } else {
        const requester = await getPlayerByCitizenId(invoice.from);
        payoutOk = requester ? creditBank(requester, invoice.amount) : false;
      }
      if (!payoutOk) {
        creditBank(payer, invoice.amount);
        await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, { lastAttemptAt: nowISO(), failedAttempts: (invoice.failedAttempts ?? 0) + 1 });
        notify(payer.PlayerData.source, "Wallet", `Recurring invoice payout failed; refunded $${invoice.amount}.`);
        continue;
      }
      const newRemaining = Math.max(0, (invoice.remainingPayments ?? Number(invoice.numberOfPayments)) - 1);
      let newStatus = "active";
      let nextDate = null;
      if (newRemaining <= 0) {
        newStatus = "completed";
      } else {
        const base = invoice.nextPaymentDate ?? nowISO();
        nextDate = addInterval(base, Number(invoice.paymentTime));
      }
      await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, {
        remainingPayments: newRemaining,
        status: newStatus,
        lastAttemptAt: nowISO(),
        nextPaymentDate: nextDate
      });
      notify(payer.PlayerData.source, "Wallet", `Charged $${invoice.amount} for recurring invoice (${newRemaining} left).`);
      logBankEvent("Recurring Invoice Payment", `${invoice.targetName} paid $${invoice.amount} to ${invoice.sourceName}${invoice.isBusiness === "Yes" ? " (business)" : ""}.`);
    } catch (e) {
      console.error("Recurring payment error for", invoice._id, e);
      await MongoDB.updateOne(COLLECTION, { _id: invoice._id }, {
        $set: { lastAttemptAt: nowISO(), failedAttempts: (invoice.failedAttempts ?? 0) + 1 }
      });
    }
  }
}, "InvoiceRecurringPayments");

// game/server/apps/Groups/callback.ts
onClientCallback("groups:getmultiPleJobs", async (source2) => {
  const sourcePlayer = exports[FRAMEWORK_RESOURCE].GetPlayer(source2);
  const jobsData = await MongoDB.findMany("phone_multijobs", { citizenId: sourcePlayer.PlayerData.citizenid });
  const currentJob = sourcePlayer.PlayerData.job.name;
  return JSON.stringify({ currentJob, jobsData });
});
onClientCallback("groups:deleteMultiJob", async (source2, data) => {
  const name = await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2);
  const job = await MongoDB.findOne("phone_multijobs", { _id: data });
  const res = await MongoDB.deleteOne("phone_multijobs", { _id: data });
  Logger.AddLog({
    type: "phone_multijobs",
    title: "Job Deleted",
    message: `${name} deleted job ${job.jobName} (${job.citizenId})`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("groups:changeJobOfPlayer", async (source2, data) => {
  const { jobName, grade } = JSON.parse(data);
  if (!jobName) return false;
  const sourcePlayer = await exports[FRAMEWORK_RESOURCE].GetPlayer(source2);
  if (!sourcePlayer) return false;
  if (await exports[FRAMEWORK_RESOURCE].CheckJobGrade(jobName, String(grade))) {
    sourcePlayer.Functions.SetJob(jobName, String(grade));
    emitNet("QBCore:Notify", source2, `Job Changed to ${jobName} Successfully`, "success");
    emitNet("groups:toggleDuty", Number(sourcePlayer.PlayerData.source));
    Logger.AddLog({
      type: "phone_multijobs",
      title: "Job Changed",
      message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} changed job to '${jobName}' (Grade: ${grade}).`,
      showIdentifiers: false
    });
    return true;
  } else {
    const res = await MongoDB.deleteOne("phone_multijobs", { citizenId: sourcePlayer.PlayerData.citizenid, jobName });
    Logger.AddLog({
      type: "phone_multijobs",
      title: "Invalid Job Removed",
      message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} attempted to change to invalid job '${jobName}', removed from multi-jobs.`,
      showIdentifiers: false
    });
    return false;
  }
});

// game/server/apps/HeartSync/callbacks.ts
var _HeartSyncServer = class _HeartSyncServer {
  async getProfile(source2) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return null;
      const profile = await MongoDB.findOne("heartsync_profiles", { citizenId });
      return profile;
    } catch (error) {
      console.error("Error getting HeartSync profile:", error);
      return null;
    }
  }
  async createProfile(source2, profileData) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return null;
      const existingProfile = await MongoDB.findOne("heartsync_profiles", { citizenId });
      if (existingProfile) {
        throw new Error("Profile already exists");
      }
      const newProfile = {
        _id: generateUUid(),
        citizenId,
        name: profileData.name || "",
        age: profileData.age || 18,
        gender: profileData.gender || "",
        bio: profileData.bio || "",
        photos: profileData.photos || [],
        interests: profileData.interests || [],
        lookingFor: profileData.lookingFor || "",
        interestedInGenders: profileData.interestedInGenders || [],
        ageRangeMin: profileData.ageRangeMin || 18,
        ageRangeMax: profileData.ageRangeMax || 35,
        maxDistance: profileData.maxDistance || 25,
        showOnline: profileData.showOnline !== void 0 ? profileData.showOnline : true,
        work: profileData.work || "",
        school: profileData.school || "",
        height: profileData.height,
        zodiacSign: profileData.zodiacSign || "",
        lifestyle: profileData.lifestyle || {
          smoking: "",
          drinking: "",
          exercise: "",
          pets: ""
        },
        verified: false,
        premium: false,
        superLikesRemaining: 5,
        likesRemaining: 50,
        dailySwipes: 0,
        lastSwipeReset: /* @__PURE__ */ new Date(),
        createdAt: /* @__PURE__ */ new Date(),
        lastActive: /* @__PURE__ */ new Date(),
        isActive: true
      };
      const result = await MongoDB.insertOne("heartsync_profiles", newProfile);
      return { ...newProfile, _id: result };
    } catch (error) {
      console.error("Error creating HeartSync profile:", error);
      return null;
    }
  }
  async updateProfile(source2, profileData) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return null;
      const updateData = {
        ...profileData,
        lastActive: /* @__PURE__ */ new Date()
      };
      const result = await MongoDB.updateOne("heartsync_profiles", { citizenId }, updateData, void 0, false, { upsert: true });
      return result.value;
    } catch (error) {
      console.error("Error updating HeartSync profile:", error);
      return null;
    }
  }
  async getPotentialMatches(source2) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return [];
      const userProfile = await MongoDB.findOne("heartsync_profiles", { citizenId });
      if (!userProfile) return [];
      const swipedUsers = await MongoDB.findMany("heartsync_swipes", {
        fromUserId: citizenId
      }, void 0, false);
      const swipedUserIds = swipedUsers.map((swipe) => swipe.toUserId);
      const matches = await MongoDB.findMany("heartsync_matches", {
        $or: [
          { user1Id: citizenId },
          { user2Id: citizenId }
        ],
        isActive: true
      }, void 0, false);
      const matchedUserIds = matches.map(
        (match) => match.user1Id === citizenId ? match.user2Id : match.user1Id
      );
      const excludedUserIds = [...swipedUserIds, ...matchedUserIds, citizenId];
      const matchCriteria = {
        citizenId: { $nin: excludedUserIds },
        isActive: true,
        age: { $gte: userProfile.ageRangeMin, $lte: userProfile.ageRangeMax }
      };
      if (userProfile.lookingFor !== "Everyone") {
        matchCriteria.gender = userProfile.lookingFor === "Men" ? "Man" : "Woman";
      }
      if (userProfile.interestedInGenders.length > 0) {
        matchCriteria.lookingFor = {
          $in: userProfile.interestedInGenders.includes(userProfile.gender) ? userProfile.interestedInGenders : [...userProfile.interestedInGenders, "Everyone"]
        };
      }
      const potentialMatches = await MongoDB.findMany("heartsync_profiles", matchCriteria, void 0, false, { limit: 20 });
      return potentialMatches;
    } catch (error) {
      console.error("Error getting potential matches:", error);
      return [];
    }
  }
  async swipeProfile(source2, swipeData) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return { success: false, isMatch: false };
      const { targetUserId, isLike, isSuperLike = false } = swipeData;
      const userProfile = await MongoDB.findOne("heartsync_profiles", { citizenId });
      if (!userProfile) return { success: false, isMatch: false };
      if (isSuperLike && userProfile.superLikesRemaining <= 0) {
        return { success: false, isMatch: false, error: "No super likes remaining" };
      }
      await MongoDB.insertOne("heartsync_swipes", {
        _id: generateUUid(),
        fromUserId: citizenId,
        toUserId: targetUserId,
        isLike,
        isSuperLike,
        timestamp: /* @__PURE__ */ new Date()
      });
      let isMatch = false;
      if (isLike) {
        const reciprocalSwipe = await MongoDB.findOne("heartsync_swipes", {
          fromUserId: targetUserId,
          toUserId: citizenId,
          isLike: true
        });
        if (reciprocalSwipe) {
          await MongoDB.insertOne("heartsync_matches", {
            _id: generateUUid(),
            user1Id: citizenId,
            user2Id: targetUserId,
            matchedAt: /* @__PURE__ */ new Date(),
            isActive: true,
            isSuperLike: isSuperLike || reciprocalSwipe.isSuperLike
          });
          isMatch = true;
          try {
            const swiperData = await global.exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(citizenId);
            const targetData = await global.exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(targetUserId);
            const swiperPlayerData = swiperData || await global.exports[FRAMEWORK_RESOURCE].GetOfflinePlayerByCitizenId(citizenId);
            const targetPlayerData = targetData || await global.exports[FRAMEWORK_RESOURCE].GetOfflinePlayerByCitizenId(targetUserId);
            if (swiperData && swiperData.PlayerData.source) {
              emitNet("phone:addnotiFication", swiperData.PlayerData.source, JSON.stringify({
                id: generateUUid(),
                title: "HeartSync Match! \u{1F495}",
                description: `You matched with ${targetPlayerData.PlayerData.charinfo.firstname} ${targetPlayerData.PlayerData.charinfo.lastname}!`,
                app: "heartsync",
                timeout: 5e3
              }));
            }
            if (targetData && targetData.PlayerData.source) {
              emitNet("phone:addnotiFication", targetData.PlayerData.source, JSON.stringify({
                id: generateUUid(),
                title: "HeartSync Match! \u{1F495}",
                description: `You matched with ${swiperPlayerData.PlayerData.charinfo.firstname} ${swiperPlayerData.PlayerData.charinfo.lastname}!`,
                app: "heartsync",
                timeout: 5e3
              }));
            }
          } catch (notificationError) {
            console.error("Error sending match notifications:", notificationError);
          }
        }
        const updateData = {
          dailySwipes: userProfile.dailySwipes + 1
        };
        if (isSuperLike) {
          updateData.superLikesRemaining = userProfile.superLikesRemaining - 1;
        } else {
          updateData.likesRemaining = userProfile.likesRemaining - 1;
        }
        await MongoDB.updateOne("heartsync_profiles", { citizenId }, updateData);
      }
      return { success: true, isMatch };
    } catch (error) {
      console.error("Error swiping profile:", error);
      return { success: false, isMatch: false };
    }
  }
  async getMatches(source2) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return [];
      const matches = await MongoDB.findMany("heartsync_matches", {
        $or: [
          { user1Id: citizenId },
          { user2Id: citizenId }
        ],
        isActive: true
      }, void 0, false, { sort: { matchedAt: -1 } });
      const enrichedMatches = await Promise.all(matches.map(async (match) => {
        const otherUserId = match.user1Id === citizenId ? match.user2Id : match.user1Id;
        const otherUser = await MongoDB.findOne("heartsync_profiles", { citizenId: otherUserId });
        const lastMessage = await MongoDB.findOne("heartsync_messages", { matchId: match._id }, void 0, false, { sort: { timestamp: -1 } });
        return {
          ...match,
          otherUser,
          lastMessage: lastMessage == null ? void 0 : lastMessage.content,
          lastMessageTime: lastMessage == null ? void 0 : lastMessage.timestamp,
          isNewMatch: !lastMessage,
          unreadCount: await this.getUnreadMessageCount(match._id.toString(), citizenId)
        };
      }));
      return enrichedMatches;
    } catch (error) {
      console.error("Error getting matches:", error);
      return [];
    }
  }
  async getUnreadMessageCount(matchId, userId) {
    try {
      const count = await MongoDB.findMany("heartsync_messages", {
        matchId,
        receiverId: userId,
        read: false
      }, void 0, false);
      return count.length;
    } catch (error) {
      console.error("Error getting unread count:", error);
      return 0;
    }
  }
  // Mock implementations for other methods - replace with actual logic
  async getSwipeStats(source2) {
    const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
    if (!citizenId) return null;
    const profile = await MongoDB.findOne("heartsync_profiles", { citizenId });
    return profile ? {
      likesRemaining: profile.likesRemaining,
      superLikesRemaining: profile.superLikesRemaining,
      dailySwipes: profile.dailySwipes
    } : null;
  }
  async getNearbyUsers(source2) {
    return this.getPotentialMatches(source2);
  }
  async getOnlineUsers(source2) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return [];
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1e3);
      const onlineUsers = await MongoDB.findMany("heartsync_profiles", {
        citizenId: { $ne: citizenId },
        isActive: true,
        lastActive: { $gte: fiveMinutesAgo }
      }, void 0, false, { limit: 10 });
      return onlineUsers;
    } catch (error) {
      console.error("Error getting online users:", error);
      return [];
    }
  }
  async getRecentlyActiveUsers(source2) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return [];
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1e3);
      const recentUsers = await MongoDB.findMany("heartsync_profiles", {
        citizenId: { $ne: citizenId },
        isActive: true,
        lastActive: { $gte: oneDayAgo }
      }, void 0, false, { limit: 15, sort: { lastActive: -1 } });
      return recentUsers;
    } catch (error) {
      console.error("Error getting recently active users:", error);
      return [];
    }
  }
  async getTopPicks(source2) {
    const potentialMatches = await this.getPotentialMatches(source2);
    return potentialMatches.slice(0, 8);
  }
  async getNotifications(source2) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return { newMatches: 0, newMessages: 0, superLikes: 0 };
      const newMatches = await MongoDB.findMany("heartsync_matches", {
        $or: [{ user1Id: citizenId }, { user2Id: citizenId }],
        isActive: true
        // Add logic to check if match is new
      }, void 0, false);
      const newMessages = await MongoDB.findMany("heartsync_messages", {
        receiverId: citizenId,
        read: false
      }, void 0, false);
      const superLikes = await MongoDB.findMany("heartsync_swipes", {
        toUserId: citizenId,
        isSuperLike: true,
        isLike: true
      }, void 0, false);
      return { newMatches: newMatches.length, newMessages: newMessages.length, superLikes: superLikes.length };
    } catch (error) {
      console.error("Error getting notifications:", error);
      return { newMatches: 0, newMessages: 0, superLikes: 0 };
    }
  }
  async getMessages(source2, data) {
    return await MongoDB.findMany("heartsync_messages", { matchId: data.matchId }, void 0, false);
  }
  async sendMessage(source2, data) {
    const res = await MongoDB.findOne("heartsync_matches", { _id: String(data.matchId) }, void 0, false);
    const sourceCitizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
    let sourceData = await global.exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(sourceCitizenId);
    let targetData = await global.exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(res.user1Id === sourceCitizenId ? res.user2Id : res.user1Id);
    if (!sourceData) {
      sourceData = await global.exports[FRAMEWORK_RESOURCE].GetOfflinePlayerByCitizenId(sourceCitizenId);
    }
    if (!targetData) {
      targetData = await Framework.Functions.GetOfflinePlayerByCitizenId(res.user1Id === sourceCitizenId ? res.user2Id : res.user1Id);
    }
    const insertData = {
      _id: generateUUid(),
      read: res.user1Id === sourceCitizenId || res.user2Id === sourceCitizenId ? true : false,
      matchId: res._id,
      senderId: sourceCitizenId,
      receiverId: res.user1Id === sourceCitizenId ? res.user2Id : res.user1Id,
      content: data.content,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    await MongoDB.insertOne("heartsync_messages", insertData);
    if (res.user1Id !== sourceCitizenId || res.user2Id !== sourceCitizenId && targetData.PlayerData.source) {
      emitNet("heartsync:client:sendMessage", targetData.PlayerData.source, JSON.stringify(insertData));
      emitNet("phone:addnotiFication", targetData.PlayerData.source, JSON.stringify({
        id: generateUUid(),
        title: "HeartSync",
        description: "You have a new message from " + sourceData.PlayerData.charinfo.firstname + " " + sourceData.PlayerData.charinfo.lastname,
        app: "heartsync",
        timeout: 2e3
      }));
    }
    return insertData;
  }
  async unmatch(source2, data) {
    try {
      const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
      if (!citizenId) return { success: false };
      const match = await MongoDB.findOne("heartsync_matches", { _id: data.matchId });
      if (!match || !match.isActive) return { success: false };
      if (match.user1Id !== citizenId && match.user2Id !== citizenId) {
        return { success: false, error: "Not authorized to unmatch this user" };
      }
      await MongoDB.updateOne("heartsync_matches", { _id: data.matchId }, { isActive: false });
      return { success: true };
    } catch (error) {
      console.error("Error unmatching:", error);
      return { success: false, error: "Failed to unmatch" };
    }
  }
};
__name(_HeartSyncServer, "HeartSyncServer");
var HeartSyncServer = _HeartSyncServer;
var heartSyncServer = new HeartSyncServer();
onClientCallback("heartsync:getProfile", async (source2) => {
  return await heartSyncServer.getProfile(source2);
});
onClientCallback("heartsync:createProfile", async (source2, data) => {
  return await heartSyncServer.createProfile(source2, data);
});
onClientCallback("heartsync:updateProfile", async (source2, data) => {
  return await heartSyncServer.updateProfile(source2, data);
});
onClientCallback("heartsync:getPotentialMatches", async (source2) => {
  return await heartSyncServer.getPotentialMatches(source2);
});
onClientCallback("heartsync:swipeProfile", async (source2, data) => {
  return await heartSyncServer.swipeProfile(source2, data);
});
onClientCallback("heartsync:getMatches", async (source2) => {
  return await heartSyncServer.getMatches(source2);
});
onClientCallback("heartsync:getSwipeStats", async (source2) => {
  return await heartSyncServer.getSwipeStats(source2);
});
onClientCallback("heartsync:getNearbyUsers", async (source2) => {
  return await heartSyncServer.getNearbyUsers(source2);
});
onClientCallback("heartsync:getOnlineUsers", async (source2) => {
  return await heartSyncServer.getOnlineUsers(source2);
});
onClientCallback("heartsync:getRecentlyActiveUsers", async (source2) => {
  return await heartSyncServer.getRecentlyActiveUsers(source2);
});
onClientCallback("heartsync:getTopPicks", async (source2) => {
  return await heartSyncServer.getTopPicks(source2);
});
onClientCallback("heartsync:getNotifications", async (source2) => {
  return await heartSyncServer.getNotifications(source2);
});
onClientCallback("heartsync:getMessages", async (source2, data) => {
  return await heartSyncServer.getMessages(source2, data);
});
onClientCallback("heartsync:sendMessage", async (source2, data) => {
  return await heartSyncServer.sendMessage(source2, data);
});
onClientCallback("heartsync:unmatch", async (source2, data) => {
  return await heartSyncServer.unmatch(source2, data);
});

// game/server/apps/Crypto/callbacks.ts
onClientCallback("crypto:getBalances", async (source2) => {
  const player = Framework.Functions.GetPlayer(source2);
  if (!player) return false;
  const crypto = player.PlayerData.metadata.crypto || {};
  return JSON.stringify(crypto);
});
onClientCallback("crypto:buy", async (source2, data) => {
  const { type, amount, price } = JSON.parse(data);
  const player = Framework.Functions.GetPlayer(source2);
  if (!player || !["shung", "gne", "xcoin", "lme"].includes(type)) return false;
  const totalCost = amount * price;
  if (player.PlayerData.money.bank < totalCost) return false;
  if (player.Functions.RemoveMoney("bank", totalCost)) {
    exports[FRAMEWORK_RESOURCE].AddCrypto(source2, type, amount);
    Logger.AddLog({
      type: "crypto_buy",
      title: "Crypto Buy",
      message: `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname} bought ${amount} ${type} for $${totalCost}.`,
      showIdentifiers: false
    });
    return true;
  }
  return false;
});
onClientCallback("crypto:sell", async (source2, data) => {
  const { type, amount, price } = JSON.parse(data);
  const player = Framework.Functions.GetPlayer(source2);
  if (!player || !["shung", "gne", "xcoin", "lme"].includes(type)) return false;
  if (!exports[FRAMEWORK_RESOURCE].hasEnough(source2, type, amount)) return false;
  exports[FRAMEWORK_RESOURCE].RemoveCrypto(source2, type, amount);
  player.Functions.AddMoney("bank", amount * price);
  Logger.AddLog({
    type: "crypto_sell",
    title: "Crypto Sell",
    message: `${player.PlayerData.charinfo.firstname} ${player.PlayerData.charinfo.lastname} sold ${amount} ${type} for $${amount * price}.`,
    showIdentifiers: false
  });
  return true;
});
onClientCallback("crypto:transfer", async (source2, data) => {
  const { type, amount, target } = JSON.parse(data);
  const sourcePlayer = Framework.Functions.GetPlayer(source2);
  if (!sourcePlayer || !["shung", "gne", "xcoin", "lme"].includes(type)) return false;
  if (!exports[FRAMEWORK_RESOURCE].hasEnough(source2, type, amount)) return false;
  const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(target);
  if (!targetCitizenId) return false;
  const targetPlayer = Framework.Functions.GetPlayerByCitizenId(targetCitizenId);
  if (!targetPlayer) return false;
  exports[FRAMEWORK_RESOURCE].RemoveCrypto(source2, type, amount);
  exports[FRAMEWORK_RESOURCE].AddCrypto(targetPlayer.PlayerData.source, type, amount);
  emitNet("phone:addnotiFication", source2, JSON.stringify({
    id: generateUUid(),
    title: "Crypto",
    description: `You transferred ${amount} ${type} to ${target}.`,
    app: "crypto",
    timeout: 5e3
  }));
  emitNet("phone:addnotiFication", targetPlayer.PlayerData.source, JSON.stringify({
    id: generateUUid(),
    title: "Crypto",
    description: `You received ${amount} ${type} from ${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname}.`,
    app: "crypto",
    timeout: 5e3
  }));
  Logger.AddLog({
    type: "crypto_transfer",
    title: "Crypto Transfer",
    message: `${sourcePlayer.PlayerData.charinfo.firstname} ${sourcePlayer.PlayerData.charinfo.lastname} transferred ${amount} ${type} to ${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname}.`,
    showIdentifiers: false
  });
  return true;
});

// game/server/apps/DailySpins/events.ts
var invPath = `nui://${INVENTORY_RESOURCE}/html/images/`;
var DailySpinConfig = {
  TimeToClaim: 24 * 3600,
  AnimationDuration: 12,
  RouletteData: {
    0: {
      id: 0,
      type: "vehicle",
      model: "penumbra",
      rarity: "legendary",
      img: "https://docs.fivem.net/vehicles/penumbra.webp",
      name: "Penumbra",
      sell: 25e3
    },
    1: {
      id: 1,
      type: "weapon",
      model: "weapon_draco",
      rarity: "epic",
      img: `${invPath}qb_draco.png`,
      name: "Draco",
      sell: 1e4
    },
    2: {
      id: 2,
      rarity: "rare",
      type: "weapon",
      model: "weapon_browning",
      img: `${invPath}qb_browning.png`,
      name: "Browning",
      sell: 2500
    },
    3: {
      id: 3,
      rarity: "rare",
      type: "item",
      model: "advancedrepairkit",
      img: `${invPath}advancedkit.png`,
      name: "Adv Repair Kit x5",
      sell: 5e3,
      quantity: 5
    },
    4: {
      id: 4,
      rarity: "rare",
      type: "cash",
      model: 1e4,
      img: `${invPath}cash.png`,
      name: "$10000 Cash",
      sell: 2500
    },
    5: {
      id: 5,
      rarity: "rare",
      type: "item",
      model: "advancedlockpick",
      img: `${invPath}advancedlockpick.png`,
      name: "Advanced Lockpick x5",
      sell: 2500,
      quantity: 5
    },
    6: {
      id: 6,
      rarity: "common",
      type: "item",
      model: "fak",
      img: `${invPath}firstaid.png`,
      name: "FAK x10",
      sell: 1e3,
      quantity: 10
    },
    7: {
      id: 7,
      rarity: "common",
      type: "cash",
      model: 5e3,
      img: `${invPath}cash.png`,
      name: "$5000 Cash",
      sell: 1e3
    },
    8: {
      id: 8,
      rarity: "common",
      type: "item",
      model: "lockpick",
      img: `${invPath}lockpick.png`,
      name: "Lockpick x10",
      sell: 1e3,
      quantity: 10
    },
    9: {
      id: 9,
      rarity: "epic",
      type: "cash",
      model: 25e3,
      img: `${invPath}cash.png`,
      name: "$25000 Cash",
      sell: 1e4
    },
    10: {
      id: 10,
      rarity: "legendary",
      type: "weapon",
      model: "weapon_ak47",
      img: `${invPath}weapon_assaultrifle.png`,
      name: "AK47",
      sell: 25e3
    },
    11: {
      id: 11,
      rarity: "epic",
      type: "vehicle",
      model: "faggio",
      img: "https://docs.fivem.net/vehicles/faggio.webp",
      name: "Faggio",
      sell: 1e4
    },
    12: {
      id: 12,
      rarity: "rare",
      type: "item",
      model: "heavyarmor",
      img: `${invPath}armor.png`,
      name: "Heavy Armor x2",
      sell: 2500,
      quantity: 2
    },
    13: {
      id: 13,
      rarity: "common",
      type: "item",
      model: "joint",
      img: `${invPath}joint.png`,
      name: "Joint x15",
      sell: 1e3,
      quantity: 15
    },
    14: {
      id: 14,
      rarity: "common",
      type: "item",
      model: "blockocheese",
      img: `${invPath}rat_cheese.png`,
      name: "Cheese x20",
      sell: 1e3,
      quantity: 20
    },
    15: {
      id: 15,
      type: "cash",
      model: 75e3,
      rarity: "legendary",
      img: `${invPath}cash.png`,
      name: "$75000 Cash",
      sell: 25e3
    },
    16: {
      id: 16,
      rarity: "common",
      type: "item",
      model: "recyclable_material",
      img: `${invPath}recyclable-material.png`,
      name: "Recyclables x100",
      sell: 1e3,
      quantity: 100
    },
    17: {
      id: 17,
      rarity: "rare",
      type: "item",
      model: "recyclable_material",
      img: `${invPath}recyclable-material.png`,
      name: "Recyclables x250",
      sell: 2500,
      quantity: 250
    }
  },
  RarityProbability: {
    legendary: 1e-3,
    epic: 0.02,
    rare: 0.2,
    common: 0.779
  },
  SellType: "bank",
  // bank or cash
  WeaponAmount: 250,
  // amount of ammo to give when a weapon is won
  CarParkingSpawn: "alta"
  // QB: garage, ESX: parking
};
var nowInSeconds = /* @__PURE__ */ __name(() => Math.floor(Date.now() / 1e3), "nowInSeconds");
var formatRemaining = /* @__PURE__ */ __name((remaining) => {
  const hours = Math.floor(remaining / 3600);
  const mins = Math.floor(remaining % 3600 / 60);
  const secs = remaining % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}, "formatRemaining");
var getCooldownState = /* @__PURE__ */ __name((player) => {
  var _a2, _b;
  const last = ((_b = (_a2 = player == null ? void 0 : player.PlayerData) == null ? void 0 : _a2.metadata) == null ? void 0 : _b.PhoneDailySpin) ?? 0;
  const diff = nowInSeconds() - last;
  if (diff >= DailySpinConfig.TimeToClaim) {
    return { canClaim: true, lastClaimedDisplay: "00:00:00" };
  }
  const remaining = DailySpinConfig.TimeToClaim - diff;
  return { canClaim: false, lastClaimedDisplay: formatRemaining(remaining) };
}, "getCooldownState");
var resolveFramework = /* @__PURE__ */ __name(() => {
  var _a2, _b;
  if (Framework) return Framework;
  const configured = exports[FRAMEWORK_RESOURCE];
  if (typeof (configured == null ? void 0 : configured.GetCoreObject) === "function") {
    try {
      return configured.GetCoreObject();
    } catch {
    }
  }
  if (configured) return configured;
  const qb = (_b = (_a2 = exports["qb-core"]) == null ? void 0 : _a2.GetCoreObject) == null ? void 0 : _b.call(_a2);
  if (qb) return qb;
  const qbx = exports["qbx-core"] ?? exports["qbx_core"];
  if (typeof (qbx == null ? void 0 : qbx.GetCoreObject) === "function") {
    try {
      return qbx.GetCoreObject();
    } catch {
    }
  }
  return qbx;
}, "resolveFramework");
var getPlayer = /* @__PURE__ */ __name((src) => {
  var _a2, _b, _c;
  const fw = resolveFramework();
  return ((_b = (_a2 = fw == null ? void 0 : fw.Functions) == null ? void 0 : _a2.GetPlayer) == null ? void 0 : _b.call(_a2, src)) ?? ((_c = fw == null ? void 0 : fw.GetPlayer) == null ? void 0 : _c.call(fw, src));
}, "getPlayer");
onNet("dailySpin:getStateServer", () => {
  const src = Number(global.source);
  const player = getPlayer(src);
  if (!player) return;
  const { canClaim, lastClaimedDisplay } = getCooldownState(player);
  emitNet("dailySpin:returnState", src, {
    userData: {
      canClaim,
      lastClaimedDisplay
    },
    rouletteData: DailySpinConfig.RouletteData,
    probability: DailySpinConfig.RarityProbability,
    animationDuration: DailySpinConfig.AnimationDuration
  });
});
onNet("dailySpin:claimServer", () => {
  const src = Number(global.source);
  const player = getPlayer(src);
  if (!player) return;
  player.Functions.SetMetaData("PhoneDailySpin", nowInSeconds());
});
onNet("dailySpin:rewardServer", (id) => {
  const src = Number(global.source);
  const player = getPlayer(src);
  if (!player) return;
  const rewardId = Number(id);
  if (Number.isNaN(rewardId)) return;
  const reward = DailySpinConfig.RouletteData[rewardId];
  if (!reward) return;
  switch (reward.type) {
    case "vehicle":
      emit("dailySpin:giveVehicle", reward.model, src);
      break;
    case "item":
      emit("dailySpin:giveItem", reward.model, reward.quantity ?? 1, src);
      break;
    case "cash":
      emit("dailySpin:giveCash", reward.model, src);
      break;
    case "bank":
      emit("dailySpin:giveBank", reward.model, src);
      break;
    case "weapon":
      emit("dailySpin:giveWeapon", reward.model, src);
      break;
  }
});
onNet("dailySpin:sellServer", (id) => {
  const src = Number(global.source);
  emit("dailySpin:rewardServer", id, src);
});
onNet("dailySpin:giveItem", (item, qty = 1, src) => {
  const targetSrc = src ?? Number(global.source);
  const player = getPlayer(targetSrc);
  if (!player) return;
  player.Functions.AddItem(item, qty);
});
onNet("dailySpin:giveCash", (amount, src) => {
  const targetSrc = src ?? Number(global.source);
  const player = getPlayer(targetSrc);
  if (!player) return;
  player.Functions.AddMoney("cash", amount, "daily-spin-cash");
});
onNet("dailySpin:giveBank", (amount, src) => {
  const targetSrc = src ?? Number(global.source);
  const player = getPlayer(targetSrc);
  if (!player) return;
  player.Functions.AddMoney("bank", amount, "daily-spin-bank");
});
onNet("dailySpin:giveWeapon", (weapon, src) => {
  const targetSrc = src ?? Number(global.source);
  const player = getPlayer(targetSrc);
  if (!player) return;
  player.Functions.AddItem(weapon, DailySpinConfig.WeaponAmount);
});
var generatePlate = /* @__PURE__ */ __name(async () => {
  var _a2;
  const fw = resolveFramework();
  if (!(fw == null ? void 0 : fw.Shared)) return "SPIN123";
  const plate = `${fw.Shared.RandomInt(1)}${fw.Shared.RandomStr(2)}${fw.Shared.RandomInt(3)}${fw.Shared.RandomStr(2)}`;
  const exists = ((_a2 = MySQL) == null ? void 0 : _a2.scalar) ? await MySQL.scalar("SELECT plate FROM player_vehicles WHERE plate = ?", [plate]) : null;
  if (exists) {
    return generatePlate();
  }
  return plate.toUpperCase();
}, "generatePlate");
onNet("dailySpin:giveVehicle", async (model, src) => {
  var _a2, _b;
  const targetSrc = src ?? Number(global.source);
  const player = getPlayer(targetSrc);
  if (!player) return;
  const plate = await generatePlate();
  await ((_b = (_a2 = MySQL) == null ? void 0 : _a2.insert) == null ? void 0 : _b.call(
    _a2,
    "INSERT INTO player_vehicles (license, citizenid, vehicle, hash, mods, plate, garage, state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      player.PlayerData.license,
      player.PlayerData.citizenid,
      model,
      GetHashKey(model),
      "{}",
      plate,
      DailySpinConfig.CarParkingSpawn,
      0
      // stored
    ]
  ));
});
var _a;
var commandCtx = (_a = resolveFramework()) == null ? void 0 : _a.Commands;
if (commandCtx == null ? void 0 : commandCtx.Add) {
  commandCtx.Add(
    "resetdailyspin",
    "Reset a player's daily spin cooldown",
    [{ name: "id", help: "Player ID" }],
    true,
    (source2, args) => {
      const target = Number(args[0]);
      if (!target) {
        emitNet("QBCore:Notify", source2, "Invalid ID", "error");
        return;
      }
      const player = getPlayer(target);
      if (!player) {
        emitNet("QBCore:Notify", source2, "Player not online", "error");
        return;
      }
      player.Functions.SetMetaData("PhoneDailySpin", 0);
      emitNet("QBCore:Notify", source2, `Daily spin reset for ID ${target}`, "success");
      emitNet("QBCore:Notify", target, "Your Daily Spin has been reset!", "success");
    },
    "admin"
  );
} else {
  console.warn("[summit_phone] Framework.Commands.Add not available; resetdailyspin command not registered.");
}

// game/server/classes/MySQLAdapter.ts
var JSON_COLUMNS = /* @__PURE__ */ new Set([
  "messages",
  "photos",
  "interests",
  "interestedInGenders",
  "lifestyle",
  "prompts",
  "followers",
  "following",
  "likeCount",
  "repliesCount",
  "retweetCount",
  "hashtags",
  "attachments",
  "background",
  "lockscreen",
  "ringtone",
  "coords",
  "charinfo",
  "job",
  "metadata",
  "items",
  "inventory",
  "grade",
  "data",
  "blockedNumbers",
  "deletedMessages"
]);
var _MySQLAdapter = class _MySQLAdapter {
  constructor() {
  }
  isDBConnected() {
    return true;
  }
  // Helper to parse potential JSON fields
  parseRow(row) {
    if (!row) return row;
    for (const key in row) {
      if (JSON_COLUMNS.has(key) && typeof row[key] === "string") {
        try {
          row[key] = JSON.parse(row[key]);
        } catch (e) {
        }
      }
    }
    return row;
  }
  translateQuery(query) {
    if (!query || Object.keys(query).length === 0) {
      return { sql: "1=1", params: [] };
    }
    const conditions = [];
    const params = [];
    for (const key in query) {
      const value = query[key];
      if (key === "$or") {
        const orConditions = [];
        for (const subQuery of value) {
          const { sql, params: subParams } = this.translateQuery(subQuery);
          orConditions.push(`(${sql})`);
          params.push(...subParams);
        }
        conditions.push(`(${orConditions.join(" OR ")})`);
        continue;
      }
      if (key === "$and") {
        const andConditions = [];
        for (const subQuery of value) {
          const { sql, params: subParams } = this.translateQuery(subQuery);
          andConditions.push(`(${sql})`);
          params.push(...subParams);
        }
        conditions.push(`(${andConditions.join(" AND ")})`);
        continue;
      }
      if (typeof value === "object" && value !== null) {
        if (value.$ne !== void 0) {
          conditions.push(`\`${key}\` <> ?`);
          params.push(value.$ne);
        } else if (value.$gt !== void 0) {
          conditions.push(`\`${key}\` > ?`);
          params.push(value.$gt);
        } else if (value.$gte !== void 0) {
          conditions.push(`\`${key}\` >= ?`);
          params.push(value.$gte);
        } else if (value.$lt !== void 0) {
          conditions.push(`\`${key}\` < ?`);
          params.push(value.$lt);
        } else if (value.$lte !== void 0) {
          conditions.push(`\`${key}\` <= ?`);
          params.push(value.$lte);
        } else if (value.$in !== void 0) {
          if (value.$in.length === 0) {
            conditions.push(`1=0`);
          } else {
            const placeholders = value.$in.map(() => "?").join(",");
            conditions.push(`\`${key}\` IN (${placeholders})`);
            params.push(...value.$in);
          }
        } else if (value.$nin !== void 0) {
          if (value.$nin.length === 0) {
            conditions.push(`1=1`);
          } else {
            const placeholders = value.$nin.map(() => "?").join(",");
            conditions.push(`\`${key}\` NOT IN (${placeholders})`);
            params.push(...value.$nin);
          }
        } else if (value.$regex !== void 0) {
          conditions.push(`\`${key}\` LIKE ?`);
          params.push(`%${value.$regex}%`);
        } else {
          conditions.push(`\`${key}\` = ?`);
          params.push(value);
        }
      } else {
        conditions.push(`\`${key}\` = ?`);
        params.push(value);
      }
    }
    return { sql: conditions.join(" AND "), params };
  }
  translateOptions(options) {
    let sql = "";
    if (!options) return sql;
    if (options.sort) {
      const sortParts = [];
      for (const key in options.sort) {
        const dir = options.sort[key] === 1 ? "ASC" : "DESC";
        sortParts.push(`\`${key}\` ${dir}`);
      }
      if (sortParts.length > 0) {
        sql += ` ORDER BY ${sortParts.join(", ")}`;
      }
    }
    if (options.limit) {
      sql += ` LIMIT ${Number(options.limit)}`;
    }
    if (options.skip) {
      sql += ` OFFSET ${Number(options.skip)}`;
    }
    return sql;
  }
  async findOne(collection, query, projection, options) {
    const { sql: whereClause, params } = this.translateQuery(query);
    const sql = `SELECT * FROM \`${collection}\` WHERE ${whereClause} LIMIT 1`;
    try {
      const result = await global.exports.oxmysql.single_async(sql, params);
      return this.parseRow(result);
    } catch (e) {
      console.error(`[MySQLAdapter] findOne error in ${collection}:`, e);
      return null;
    }
  }
  async findMany(collection, query, projection, unknown, options) {
    const { sql: whereClause, params } = this.translateQuery(query);
    let sql = `SELECT * FROM \`${collection}\` WHERE ${whereClause}`;
    sql += this.translateOptions(options);
    try {
      const results = await global.exports.oxmysql.query_async(sql, params);
      if (Array.isArray(results)) {
        return results.map((row) => this.parseRow(row));
      }
      return [];
    } catch (e) {
      console.error(`[MySQLAdapter] findMany error in ${collection}:`, e);
      return [];
    }
  }
  async insertOne(collection, doc) {
    if (!doc) return null;
    if (!doc._id) doc._id = generateUUid();
    const keys = Object.keys(doc);
    const values = Object.values(doc).map((v) => {
      if (typeof v === "object" && v !== null) {
        return JSON.stringify(v);
      }
      return v;
    });
    const placeholders = keys.map(() => "?").join(",");
    const columns = keys.map((k) => `\`${k}\``).join(",");
    const sql = `INSERT INTO \`${collection}\` (${columns}) VALUES (${placeholders})`;
    try {
      await global.exports.oxmysql.insert_async(sql, values);
      return doc;
    } catch (e) {
      console.error(`[MySQLAdapter] insertOne error in ${collection}:`, e);
      return null;
    }
  }
  async updateOne(collection, query, update, options) {
    const { sql: whereClause, params: whereParams } = this.translateQuery(query);
    let updateData = update;
    if (update.$set) {
      updateData = { ...updateData, ...update.$set };
      delete updateData.$set;
    }
    const setClauses = [];
    const setParams = [];
    for (const key in updateData) {
      if (key === "_id") continue;
      setClauses.push(`\`${key}\` = ?`);
      let val = updateData[key];
      if (typeof val === "object" && val !== null) {
        val = JSON.stringify(val);
      }
      setParams.push(val);
    }
    if (setClauses.length === 0) return true;
    const sql = `UPDATE \`${collection}\` SET ${setClauses.join(", ")} WHERE ${whereClause}`;
    const finalParams = [...setParams, ...whereParams];
    try {
      await global.exports.oxmysql.update_async(sql, finalParams);
      return { modifiedCount: 1 };
    } catch (e) {
      console.error(`[MySQLAdapter] updateOne error in ${collection}:`, e);
      return { modifiedCount: 0 };
    }
  }
  async deleteOne(collection, query) {
    const { sql: whereClause, params } = this.translateQuery(query);
    const sql = `DELETE FROM \`${collection}\` WHERE ${whereClause} LIMIT 1`;
    try {
      await global.exports.oxmysql.update_async(sql, params);
      return { deletedCount: 1 };
    } catch (e) {
      console.error(`[MySQLAdapter] deleteOne error in ${collection}:`, e);
      return { deletedCount: 0 };
    }
  }
  async findAndReturnSpecificFields(collection, query, fields) {
    const { sql: whereClause, params } = this.translateQuery(query);
    const columns = fields.map((f) => `\`${f}\``).join(", ");
    const sql = `SELECT ${columns} FROM \`${collection}\` WHERE ${whereClause} LIMIT 1`;
    try {
      const result = await global.exports.oxmysql.single_async(sql, params);
      return this.parseRow(result);
    } catch (e) {
      console.error(`[MySQLAdapter] findAndReturnSpecificFields error in ${collection}:`, e);
      return null;
    }
  }
  // Custom handling for aggregation (specifically for Pigeon conversations)
  async aggregate(collection, pipeline) {
    if (collection === "phone_pigeon_private_messages") {
      const matchStage = pipeline.find((s) => s.$match);
      let userEmail = null;
      if (matchStage) {
        const or = matchStage.$match.$or;
        if (or && or[0] && or[0].senderEmail) userEmail = or[0].senderEmail;
      }
      if (!userEmail) {
        console.error("[MySQLAdapter] Aggregate: Could not identify userEmail from pipeline");
        return [];
      }
      const sql = `SELECT * FROM \`phone_pigeon_private_messages\` WHERE \`senderEmail\` = ? OR \`recipientEmail\` = ? ORDER BY \`createdAt\` DESC`;
      try {
        const messages = await global.exports.oxmysql.query_async(sql, [userEmail, userEmail]);
        const conversations = /* @__PURE__ */ new Map();
        for (const msg of messages) {
          const otherEmail = msg.senderEmail === userEmail ? msg.recipientEmail : msg.senderEmail;
          if (!conversations.has(otherEmail)) {
            conversations.set(otherEmail, {
              lastMessage: this.parseRow(msg),
              unreadCount: 0,
              otherEmail
            });
          }
          const conv = conversations.get(otherEmail);
          if (msg.recipientEmail === userEmail && msg.read === 0) {
            conv.unreadCount++;
          }
        }
        const result = [];
        for (const conv of conversations.values()) {
          const user = await this.findOne("phone_pigeon_users", { email: conv.otherEmail });
          result.push({
            otherUser: user,
            lastMessage: conv.lastMessage,
            unreadCount: conv.unreadCount
          });
        }
        return result;
      } catch (e) {
        console.error(`[MySQLAdapter] Aggregate error:`, e);
        return [];
      }
    }
    console.warn(`[MySQLAdapter] Unhandled aggregation for collection ${collection}`);
    return [];
  }
};
__name(_MySQLAdapter, "MySQLAdapter");
var MySQLAdapter = _MySQLAdapter;

// game/server/sv_main.ts
var resolveFramework2 = /* @__PURE__ */ __name(() => {
  var _a2, _b;
  const configured = exports[FRAMEWORK_RESOURCE];
  if (typeof (configured == null ? void 0 : configured.GetCoreObject) === "function") {
    try {
      return configured.GetCoreObject();
    } catch {
    }
  }
  if (configured) return configured;
  const qb = (_b = (_a2 = exports["qb-core"]) == null ? void 0 : _a2.GetCoreObject) == null ? void 0 : _b.call(_a2);
  if (qb) return qb;
  if (exports["qb-core"]) return exports["qb-core"];
  const qbx = exports["qbx-core"] ?? exports["qbx_core"];
  if (typeof (qbx == null ? void 0 : qbx.GetCoreObject) === "function") {
    try {
      return qbx.GetCoreObject();
    } catch {
    }
  }
  return qbx;
}, "resolveFramework");
var Framework = resolveFramework2();
var MongoDB = new MySQLAdapter();
var MySQL = exports.oxmysql;
var Logger = exports["qb-smallresources"];
on("QBCore:Server:UpdateObject", () => {
  Framework = resolveFramework2();
});
setImmediate(() => {
  Utils.load();
  Settings.load();
});
onClientCallback("phone:server:shareNumber", async (source2, comingSource) => {
  const sourceX = source2;
  const sourceNumber = await Utils.GetPhoneNumberBySource(sourceX);
  const acNumber = await Utils.GetPhoneNumberBySource(comingSource);
  const fullname = await exports[FRAMEWORK_RESOURCE].GetPlayerName(sourceX);
  const breakedName = fullname.split(" ");
  if (!sourceNumber || !acNumber) return;
  const contactData = {
    _id: generateUUid(),
    personalNumber: acNumber,
    contactNumber: sourceNumber,
    firstName: breakedName[0],
    lastName: breakedName[1],
    image: await Utils.GetContactAvatarByNumber(sourceNumber, await Utils.GetCitizenIdByPhoneNumber(sourceNumber)),
    ownerId: await Utils.GetCitizenIdByPhoneNumber(acNumber),
    notes: "",
    email: "",
    isFav: false
  };
  const res = await MongoDB.findOne("phone_contacts", { personalNumber: acNumber, contactNumber: sourceNumber });
  if (res) {
    return emitNet("phone:addnotiFication", sourceX, JSON.stringify({
      id: generateUUid(),
      title: "System",
      description: `Number Already Shared.`,
      app: "settings",
      timeout: 5e3
    }));
  }
  emitNet("phone:addnotiFication", Number(sourceX), JSON.stringify({
    id: generateUUid(),
    title: "Phone",
    description: `You have shared your Phone Number.`,
    app: "settings",
    timeout: 5e3
  }));
  const sendId = generateUUid();
  emitNet("phone:addActionNotification", Number(comingSource), JSON.stringify({
    id: sendId,
    title: "Phone",
    description: `${fullname} wants to share their number with you.`,
    app: "settings",
    icons: {
      "0": {
        icon: "https://ignis-rp.com/uploads/server/phone/cross-circle.svg",
        isServer: true,
        event: "phone:server:addContact",
        args: {}
      },
      "1": {
        icon: "https://ignis-rp.com/uploads/server/phone/accept.svg",
        isServer: true,
        event: "phone:server:addContact",
        args: {
          contactData,
          comingSource,
          fullname
        }
      }
    }
  }));
});
onNet("phone:server:addContact", async (id, data) => {
  const src = global.source;
  emitNet("phone:client:removeActionNotification", src, id);
  if (!data.contactData || !data.comingSource || !data.fullname) {
    return;
  }
  await Delay(500);
  emitNet("phone:addnotiFication", src, JSON.stringify({
    id: generateUUid(),
    title: "System",
    description: `Number Saved.`,
    app: "settings",
    timeout: 5e3
  }));
  await MongoDB.insertOne("phone_contacts", data.contactData);
  Logger.AddLog({
    type: "phone_contacts",
    title: "Contact Shared",
    message: `${data.fullname} , ${data.contactData.contactNumber} has shared their number with ${data.contactData.personalNumber}`,
    showIdentifiers: false
  });
});
on("summit_phone:server:CronTrigger", async () => {
  InvoiceRecurringPayments();
});
RegisterCommand("resetPhonePasscode", async (source2, args) => {
  const citizenId = await global.exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(source2);
  if (!citizenId) return;
  Settings.lockPin.set(citizenId, "000000");
  await Delay(1e3);
  Settings.SavePlayerSettings(citizenId);
  emitNet("phone:client:setupPhone", source2, citizenId);
}, false);
RegisterCommand("verifyPegion", async (source2, args) => {
  if (!args[0]) {
    return LOGGER("Please provide a valid email address.");
  }
  const email = args[0];
  const res = await pigeonService.verifyUser(source2, email);
  if (res === "success") {
    return LOGGER(`User ${email} has been verified successfully.`);
  } else {
    return LOGGER(`Failed to verify user ${email}. Reason: ${res}`);
  }
}, true);
on("QBCore:Server:OnPlayerUnload", async (src) => {
  if (!src) return;
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(src);
  if (!citizenId) return;
  await Settings.SavePlayerSettings(citizenId);
  Settings.onPlayerDisconnect(citizenId);
});
on("playerDropped", async () => {
  const src = global.source;
  if (!src) return;
  const citizenId = await exports[FRAMEWORK_RESOURCE].GetPlayerCitizenIdBySource(src);
  if (!citizenId) return;
  await Settings.SavePlayerSettings(citizenId);
  Settings.onPlayerDisconnect(citizenId);
});
onNet("ignis_phone:sendNewMail", async (targetSource, mailData) => {
  const src = Number(targetSource ?? global.source);
  const player = Framework.Functions.GetPlayer(src);
  if (!player) return;
  const citizenId = player.PlayerData.citizenid;
  const emailAddress = await Utils.GetEmailIdByCitizenId(citizenId);
  if (!emailAddress) return;
  await global.exports["summit_phone"].SendMail({
    email: (mailData == null ? void 0 : mailData.email) || "government@summit.rp",
    to: emailAddress,
    subject: (mailData == null ? void 0 : mailData.subject) || "Email is not setup correctly!",
    message: (mailData == null ? void 0 : mailData.message) || "Email is not setup correctly!",
    images: (mailData == null ? void 0 : mailData.images) || [],
    source: src
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2FtZS9zaGFyZWQvdXRpbHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvY2xhc3Nlcy9VdGlscy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL01haWwvY2xhc3MudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvc3ZfZXhwb3J0cy50cyIsICIuLi9ub2RlX21vZHVsZXMvLnBucG0vQG92ZXJleHRlbmRlZCtveF9saWJAMy4yOS4wL25vZGVfbW9kdWxlcy9Ab3ZlcmV4dGVuZGVkL294X2xpYi9zaGFyZWQvcmVzb3VyY2UvY2FjaGUvaW5kZXguanMiLCAiLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0BvdmVyZXh0ZW5kZWQrb3hfbGliQDMuMjkuMC9ub2RlX21vZHVsZXMvQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyL3Jlc291cmNlL2NhbGxiYWNrL2luZGV4LmpzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvQ29udGFjdHMvY2FsbGJhY2sudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9EYXJrQ2hhdC9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL01haWwvY2FsbGJhY2sudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9NZXNzYWdlcy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1Bob25lL2NhbGxIaXN0b3J5TWFuYWdlci50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1Bob25lL0NhbGxNYW5hZ2VyLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvU2V0dGluZ3MvY2xhc3MudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9QaG9uZS9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1Bob25lL2V2ZW50cy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1Bob3Rvcy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1NlcnZpY2VzL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvU2VydmljZXMvZXZlbnRzLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvU2V0dGluZ3MvY2FsbGJhY2sudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXR0aW5ncy9ldmVudHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9QaWdlb24vUGlnZW9uU2VydmljZS50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1BpZ2Vvbi9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0hvc3VpbmcvY2FsbGJhY2sudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9CbHVlUGFnZS9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0dhcmFnZS9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1dhbGxldC9jYWxsYmFja3MudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9Hcm91cHMvY2FsbGJhY2sudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9IZWFydFN5bmMvY2FsbGJhY2tzLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvQ3J5cHRvL2NhbGxiYWNrcy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0RhaWx5U3BpbnMvZXZlbnRzLnRzIiwgIi4uL2dhbWUvc2VydmVyL2NsYXNzZXMvTXlTUUxBZGFwdGVyLnRzIiwgIi4uL2dhbWUvc2VydmVyL3N2X21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImV4cG9ydCBmdW5jdGlvbiBEZWxheShtczogbnVtYmVyKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKHJlcyA9PiBzZXRUaW1lb3V0KHJlcywgbXMpKTtcbn07XG5cbmV4cG9ydCBjb25zdCBkaXN0YW5jZUJldHdlZW4gPSAocG9zMTogbnVtYmVyW10sIHBvczI6IG51bWJlcltdKSA9PiB7XG4gICAgcmV0dXJuIE1hdGguaHlwb3QocG9zMVswXSAtIHBvczJbMF0sIHBvczFbMV0gLSBwb3MyWzFdLCBwb3MxWzJdIC0gcG9zMlsyXSlcbn07XG5cbmV4cG9ydCBjb25zdCBnZW5lcmF0ZVVVaWQgPSAoKSA9PiB7XG4gICAgcmV0dXJuIFwieHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4XCIucmVwbGFjZSgvW3h5XS9nLCBmdW5jdGlvbiAoYykge1xuICAgICAgICB2YXIgciA9IE1hdGgucmFuZG9tKCkgKiAxNiB8IDAsIHYgPSBjID09IFwieFwiID8gciA6IHIgJiAweDMgfCAweDg7XG4gICAgICAgIHJldHVybiB2LnRvU3RyaW5nKDE2KTtcbiAgICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBMT0dHRVIgPSAobWVzc2FnZTogc3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIGNvbnNvbGUubG9nKGBcXHgxYlsxbVxceDFiWzQ3bVxceDFiWzM0bVtTdW1taXRfUGhvbmVdIFxceDFiWzRtXFx4MWJbMzFtJHttZXNzYWdlfVxceDFiWzBtYClcbn1cblxuZXhwb3J0IHR5cGUgRnJhbWV3b3JrVHlwZSA9ICdxYi1jb3JlJyB8ICdxYnhfY29yZSc7XG5leHBvcnQgY29uc3QgRlJBTUVXT1JLX1JFU09VUkNFOiBGcmFtZXdvcmtUeXBlID0gJ3FiLWNvcmUnOyAvLyBDaGFuZ2UgdGhpcyB0byB5b3VyIGZyYW1ld29yayBjb3JlIHFiLWNvcmUvcWJ4X2NvcmVcbmV4cG9ydCB0eXBlIEludmVudG9yeVR5cGUgPSAnbGotaW52ZW50b3J5JyB8ICdveF9pbnZlbnRvcnknIHwgJ3FiLWludmVudG9yeSc7XG5leHBvcnQgY29uc3QgSU5WRU5UT1JZX1JFU09VUkNFOiBJbnZlbnRvcnlUeXBlID0gJ2xqLWludmVudG9yeSc7IC8vIENoYW5nZSB0aGlzIHRvIHlvdXIgaW52ZW50b3J5IHN5c3RlbSBveF9pbnZlbnRvcnkvcWItaW52ZW50b3J5L2xqLWludmVudG9yeSBldGMuLi5cbiIsICJpbXBvcnQgeyBGcmFtZXdvcmssIE1vbmdvREIsIE15U1FMIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFLCBJTlZFTlRPUllfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5jbGFzcyBVdGlsIHtcbiAgICBwdWJsaWMgY29udGFjdHNEYXRhOiBhbnk7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuY29udGFjdHNEYXRhID0gW107XG4gICAgfVxuXG4gICAgYXN5bmMgbG9hZCgpIHtcbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCd0cmFuc2Zlck51bWJlcnMnLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5UcmFuc2Zlck51bWJlcnMoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCd0cmFuc2ZlckNvbnRhY3RzJywgYXN5bmMgKHNvdXJjZTogYW55LCBhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UgPT09IDApIHJldHVybiBMT0dHRVIoJ1RoaXMgY29tbWFuZCBjYW4gb25seSBiZSBleGVjdXRlZCBpbi1nYW1lLicpO1xuICAgICAgICAgICAgYXdhaXQgVXRpbHMuVHJhbnNmZXJDb250YWN0cygpO1xuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICBSZWdpc3RlckNvbW1hbmQoJ21pZ3JhdGVNdWx0aUpvYkRhdGEnLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5NaWdyYXRlTXVsdGlKb2JEYXRhKCk7XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIFJlZ2lzdGVyQ29tbWFuZCgnbWlncmF0ZVNvY2lldHknLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5NaWdyYXRlU29jaWV0eURhdGEoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfTtcblxuICAgIGFzeW5jIFRyYW5zZmVyTnVtYmVycygpIHtcbiAgICAgICAgbGV0IG5ld051bWJlcnM6IGFueVtdID0gW107XG4gICAgICAgIGxldCBuZXdTZXR0aW5nczogYW55W10gPSBbXTtcbiAgICAgICAgbGV0IG5ld0NhcmRzOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgIE15U1FMLnF1ZXJ5KCdTRUxFQ1QgY2l0aXplbmlkLCBjaGFyaW5mbyBGUk9NIHBsYXllcnMnLCBbXSwgYXN5bmMgKHJlc3VsdDogYW55W10pID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCByb3cgb2YgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG93bmVyID0gcm93LmNpdGl6ZW5pZDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNoYXJpbmZvID0gcm93LmNoYXJpbmZvO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHBhcnNlIGlmIHN0b3JlZCBhcyBKU09OIHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNoYXJpbmZvID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFyaW5mbyA9IEpTT04ucGFyc2UoY2hhcmluZm8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJpbmZvID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBwcmVmZXIgY2hhcmluZm8ucGhvbmUsIGZhbGwgYmFjayB0byBwaG9uZV9udW1iZXJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbnVtYmVyID0gKGNoYXJpbmZvICYmIChjaGFyaW5mby5waG9uZSA/PyBjaGFyaW5mby5waG9uZV9udW1iZXIpKSB8fCBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW51bWJlcikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCBpZiBwaG9uZSBudW1iZXIgYWxyZWFkeSBleGlzdHMgZm9yIHRoaXMgb3duZXJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG93bmVyIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmcpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIG5ld051bWJlcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBudW1iZXJcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJlcGFyZSBwaG9uZV9zZXR0aW5ncyBpZiBub3QgcHJlc2VudFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ1NldHRpbmdzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBvd25lciB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFleGlzdGluZ1NldHRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdTZXR0aW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9ja3NjcmVlbjogeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByaW5ndG9uZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJpbmd0b25lczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmw6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzTG9jazogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NrUGluOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VQaW46IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VGYWNlSWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc21ydElkOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHByZXBhcmUgcGhvbmVfcGxheWVyX2NhcmQgaWYgbm90IHByZXNlbnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdDYXJkID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9wbGF5ZXJfY2FyZCcsIHsgX2lkOiBvd25lciB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFleGlzdGluZ0NhcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NhcmRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3ROYW1lOiAnU2V0dXAnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3ROYW1lOiAnQ2FyZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWFpbDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90ZXM6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF2YXRhcjogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChuZXdOdW1iZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9udW1iZXJzJywgbmV3TnVtYmVycyk7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUihgSW5zZXJ0ZWQgJHtuZXdOdW1iZXJzLmxlbmd0aH0gcGhvbmVfbnVtYmVycy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9udW1iZXJzIHRvIGluc2VydC4nKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3U2V0dGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE1hbnkoJ3Bob25lX3NldHRpbmdzJywgbmV3U2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3U2V0dGluZ3MubGVuZ3RofSBwaG9uZV9zZXR0aW5ncy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9zZXR0aW5ncyB0byBpbnNlcnQuJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG5ld0NhcmRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9wbGF5ZXJfY2FyZCcsIG5ld0NhcmRzKTtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBJbnNlcnRlZCAke25ld0NhcmRzLmxlbmd0aH0gcGhvbmVfcGxheWVyX2NhcmQgZW50cmllcy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9wbGF5ZXJfY2FyZCBlbnRyaWVzIHRvIGluc2VydC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoYFRyYW5zZmVyTnVtYmVycyBlcnJvcjogJHtlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBUcmFuc2ZlckNvbnRhY3RzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCB0aGlzLnF1ZXJ5KCdTRUxFQ1QgKiBGUk9NIHBob25lX3Bob25lX2NvbnRhY3RzJywgW10pO1xuXG4gICAgICAgICAgICBpZiAoIXJlc3VsdCB8fCByZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgTE9HR0VSKCdObyBjb250YWN0cyBmb3VuZCB0byB0cmFuc2Zlci4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtpbmRleCwgY29udGFjdF0gb2YgcmVzdWx0LmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgIGlmIChpbmRleCA+IHJlc3VsdC5sZW5ndGgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGBQcm9jZXNzaW5nIGNvbnRhY3QgJHtpbmRleCArIDF9IG9mICR7cmVzdWx0Lmxlbmd0aH1gKTsgKi9cbiAgICAgICAgICAgICAgICBjb25zdCBvd25lcklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGNvbnRhY3QucGhvbmVfbnVtYmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRhY3RzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgcGVyc29uYWxOdW1iZXI6IGNvbnRhY3QucGhvbmVfbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBjb250YWN0TnVtYmVyOiBjb250YWN0LmNvbnRhY3RfcGhvbmVfbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBmaXJzdE5hbWU6IGNvbnRhY3QuZmlyc3RuYW1lLFxuICAgICAgICAgICAgICAgICAgICBsYXN0TmFtZTogY29udGFjdC5sYXN0bmFtZSxcbiAgICAgICAgICAgICAgICAgICAgaW1hZ2U6IGNvbnRhY3QucHJvZmlsZV9pbWFnZSxcbiAgICAgICAgICAgICAgICAgICAgb3duZXJJZDogb3duZXJJZCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0TWFueSgncGhvbmVfY29udGFjdHMnLCB0aGlzLmNvbnRhY3RzRGF0YSk7XG4gICAgICAgICAgICBMT0dHRVIoJ1Bob25lIGNvbnRhY3RzIGhhdmUgYmVlbiB0cmFuc2ZlcnJlZCB0byBNb25nb0RCLicpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBMT0dHRVIoYEVycm9yIHdoaWxlIHRyYW5zZmVycmluZyBjb250YWN0czogJHtKU09OLnN0cmluZ2lmeShlLCBudWxsLCAyKX1gKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYyBNaWdyYXRlTXVsdGlKb2JEYXRhKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCB0aGlzLnF1ZXJ5KCdTRUxFQ1QgaWQsIGpvYm5hbWUsIGVtcGxveWVlcyBGUk9NIHBsYXllcl9qb2JzJywgW10pO1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQgfHwgcmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIExPR0dFUignTm8gbXVsdGlqb2JzIGZvdW5kIHRvIHRyYW5zZmVyLicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmV3RGF0YTogYW55W10gPSBbXTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCByb3cgb2YgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgam9iSWQgPSByb3cuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGpvYk5hbWUgPSByb3cuam9ibmFtZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFqb2JOYW1lKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBsZXQgZW1wbG95ZWVzID0gcm93LmVtcGxveWVlcztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlbXBsb3llZXMpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZW1wbG95ZWVzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbXBsb3llZXMgPSBKU09OLnBhcnNlKGVtcGxveWVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEZhaWxlZCB0byBwYXJzZSBlbXBsb3llZXMgSlNPTiBmb3Igam9iICR7am9iTmFtZX0gKGlkOiAke2pvYklkfSk6ICR7ZXJyfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlbXBsb3llZXMgfHwgdHlwZW9mIGVtcGxveWVlcyAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShlbXBsb3llZXMpKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIGVtcF0gb2YgT2JqZWN0LmVudHJpZXMoZW1wbG95ZWVzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2lkID0gKGVtcCAmJiAoZW1wLmNpZCB8fCBlbXAuQ0lEIHx8IGVtcC5jaXRpemVuSWQpKSB8fCBrZXk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBncmFkZUxldmVsID0gKGVtcCAmJiAoZW1wLmdyYWRlID8/IGVtcC5ncmFkZUxldmVsID8/IGVtcC5yYW5rKSkgPz8gMDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgam9iTGFiZWwgPSBGcmFtZXdvcms/LlNoYXJlZD8uSm9icz8uW2pvYk5hbWVdPy5sYWJlbCA/PyBqb2JOYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ3JhZGVMYWJlbCA9IEZyYW1ld29yaz8uU2hhcmVkPy5Kb2JzPy5bam9iTmFtZV0/LmdyYWRlcz8uW2dyYWRlTGV2ZWxdPy5uYW1lID8/ICcnO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdEYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2l0aXplbklkOiBjaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgam9iTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmFkZUxldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpvYkxhYmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyYWRlTGFiZWxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaW5uZXJFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBFcnJvciBwcm9jZXNzaW5nIHBsYXllcl9qb2JzIHJvdyBpZCAke3Jvdy5pZH06ICR7aW5uZXJFcnJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobmV3RGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCBuZXdEYXRhKTtcbiAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3RGF0YS5sZW5ndGh9IG11bHRpam9iIGVudHJpZXMgdG8gcGhvbmVfbXVsdGlqb2JzLmApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG11bHRpam9iIGVudHJpZXMgZm91bmQgdG8gaW5zZXJ0IGFmdGVyIHBhcnNpbmcuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgTE9HR0VSKGBNaWdyYXRlTXVsdGlKb2JEYXRhIGVycm9yOiAke2Vycn1gKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYyBNaWdyYXRlU29jaWV0eURhdGEoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgdGhpcy5xdWVyeSgnU0VMRUNUICogRlJPTSBhdl9zb2NpZXR5JywgW10pO1xuXG4gICAgICAgIHJlc3VsdC5mb3JFYWNoKGFzeW5jIChqb2I6IGFueSkgPT4ge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3N1bW1pdF9iYW5rJywgeyBfaWQ6IGpvYi5qb2IgfSwge1xuICAgICAgICAgICAgICAgIGJhbmtCYWxhbmNlOiBOdW1iZXIoam9iLm1vbmV5KVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSlcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBhc3luYyBHZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbnVtYmVycycsIHsgb3duZXI6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5udW1iZXI7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5zbXJ0SWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEVtYWlsSWRCeVNvdXJjZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgZW1haWwgPSBhd2FpdCB0aGlzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICByZXR1cm4gZW1haWw7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG51bWJlcjogcGhvbmVOdW1iZXIgfSk7XG4gICAgICAgIGlmICghbnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBudW1iZXIub3duZXI7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFBsYXllckZyb21QaG9uZU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIHJldHVybiBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBCbG9ja051bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkLFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMgVW5ibG9ja051bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBJc051bWJlckJsb2NrZWQocGhvbmVOdW1iZXI6IHN0cmluZywgdGFyZ2V0UGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXIpO1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIodGFyZ2V0UGhvbmVOdW1iZXIpO1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCB8fCAhdGFyZ2V0Q2l0aXplbklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgICAgICByZXR1cm4gYmxvY2tlZCA/IHRydWUgOiBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q29udGFjdE5hbWVCeU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGhvbmVOdW1iZXIsIG93bmVySWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFjb250YWN0KSByZXR1cm4gcGhvbmVOdW1iZXI7XG4gICAgICAgIHJldHVybiBgJHtjb250YWN0LmZpcnN0TmFtZX0gJHtjb250YWN0Lmxhc3ROYW1lfWA7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENvbnRhY3RBdmF0YXJCeU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGhvbmVOdW1iZXIsIG93bmVySWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFjb250YWN0KSByZXR1cm4gJyc7XG4gICAgICAgIHJldHVybiBjb250YWN0LmltYWdlO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRTb3VyY2VGcm9tQ2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICBpZiAoIXNvdXJjZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gc291cmNlLlBsYXllckRhdGEuc291cmNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBIYXNQaG9uZShwbGF5ZXJTb3VyY2U6IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICBjb25zdCBwaG9uZUxpc3Q6IHN0cmluZ1tdID0gW1xuICAgICAgICAgICAgJ2JsdWVfcGhvbmUnLFxuICAgICAgICAgICAgJ2dyZWVuX3Bob25lJyxcbiAgICAgICAgICAgICdyZWRfcGhvbmUnLFxuICAgICAgICAgICAgJ2dvbGRfcGhvbmUnLFxuICAgICAgICAgICAgJ3B1cnBsZV9waG9uZScsXG4gICAgICAgIF07XG5cbiAgICAgICAgaWYgKElOVkVOVE9SWV9SRVNPVVJDRSA9PT0gJ294X2ludmVudG9yeScpIHtcbiAgICAgICAgICAgIGNvbnN0IGhhc0l0ZW06IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSBleHBvcnRzWydveF9pbnZlbnRvcnknXS5TZWFyY2goXG4gICAgICAgICAgICAgICAgcGxheWVyU291cmNlLFxuICAgICAgICAgICAgICAgICdjb3VudCcsXG4gICAgICAgICAgICAgICAgcGhvbmVMaXN0XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHBob25lIG9mIHBob25lTGlzdCkge1xuICAgICAgICAgICAgICAgIGlmIChoYXNJdGVtW3Bob25lXSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcGhvbmVJdGVtIG9mIHBob25lTGlzdCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlIC0gZXh0ZXJuYWwgaW52ZW50b3J5IHJlc291cmNlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhcyA9IGF3YWl0IGV4cG9ydHNbSU5WRU5UT1JZX1JFU09VUkNFXS5IYXNJdGVtKHBsYXllclNvdXJjZSwgcGhvbmVJdGVtKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhhcykgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0hhc1Bob25lIGNoZWNrIGZhaWxlZDonLCBlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgSW5GbGlnaHRNb2RlKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghc2V0dGluZ3MpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHNldHRpbmdzLmlzRmxpZ2h0TW9kZSB8fCBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgcXVlcnkocXVlcnk6IHN0cmluZywgdmFsdWVzOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIE15U1FMLnF1ZXJ5KHF1ZXJ5LCB2YWx1ZXMsIChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMgaXNTZW5kZXJLbm93bihzZW5kZXJJZDogc3RyaW5nLCByZWNlaXZlcklkOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgLy8gUXVlcnkgdG8gY2hlY2sgaWYgdGhlIHNlbmRlciBpcyBpbiB0aGUgcmVjZWl2ZXIncyBjb250YWN0c1xuICAgICAgICBjb25zdCBjb250YWN0UXVlcnkgPSB7XG4gICAgICAgICAgICBvd25lcklkOiByZWNlaXZlcklkLFxuICAgICAgICAgICAgY29udGFjdE51bWJlcjogc2VuZGVySWRcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUcnkgdG8gZmluZCBhIGNvbnRhY3QgZW50cnlcbiAgICAgICAgY29uc3QgY29udGFjdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCBjb250YWN0UXVlcnkpO1xuXG4gICAgICAgIC8vIElmIGEgY29udGFjdCBpcyBmb3VuZCwgdGhlIHNlbmRlciBpcyBrbm93blxuICAgICAgICByZXR1cm4gY29udGFjdCAhPT0gbnVsbDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0UGhvbmVOdW1iZXJCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgc21ydElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5waG9uZU51bWJlcjtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2l0aXplbklkQnlFbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IHNtcnRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghbnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBudW1iZXIuX2lkO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRQbGF5ZXJCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeUVtYWlsKGVtYWlsKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRBdmF0YXJGcm9tRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCBhdmF0b3IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghYXZhdG9yKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBhdmF0b3IuYXZhdGFyO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRVc2VyTmFtZUZyb21FbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghdXNlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gdXNlci51c2VybmFtZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2lkRnJvbVR3ZWV0SWQoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBwaWdlb25JZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlcy5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENpZHNGcm9tUGlnZW9uRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9zZXR0aW5ncycsIHsgcGlnZW9uSWRBdHRhY2hlZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghcmVzIHx8IHJlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcbiAgICAgICAgcmV0dXJuIHJlcy5tYXAoKHNldHRpbmc6IGFueSkgPT4gc2V0dGluZy5faWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDaWRGcm9tRGFya0VtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgZGFya01haWxJZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlcy5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIElzUGxheWVySW5KYWlsKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIXBsYXllcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXRhZGF0YSA9IHBsYXllci5QbGF5ZXJEYXRhLm1ldGFkYXRhO1xuICAgICAgICAgICAgcmV0dXJuIG1ldGFkYXRhICYmIG1ldGFkYXRhLmluamFpbCAmJiBtZXRhZGF0YS5pbmphaWwgPiAwO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBcbiAgICBhc3luYyBnZXRKb2JzKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGpvYnM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgY29uc3QgZW1wbG95ZWVzOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBhbnk+PiA9IHt9O1xuXG4gICAgICAgIC8vIGZpbmQgYWxsIG11bHRpam9iIGVudHJpZXMgZm9yIHRoaXMgY2l0aXplblxuICAgICAgICBjb25zdCBteUVudHJpZXM6IGFueVtdID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghbXlFbnRyaWVzIHx8IG15RW50cmllcy5sZW5ndGggPT09IDApIHJldHVybiB7IGpvYnMsIGVtcGxveWVlcyB9O1xuXG4gICAgICAgIC8vIGNvbGxlY3QgdW5pcXVlIGpvYiBuYW1lcyBzbyB3ZSBjYW4gZmV0Y2ggYWxsIGVtcGxveWVlcyBmb3IgdGhvc2Ugam9icyBpbiBvbmUgcXVlcnlcbiAgICAgICAgY29uc3Qgam9iTmFtZXMgPSBBcnJheS5mcm9tKG5ldyBTZXQobXlFbnRyaWVzLm1hcChlID0+IGUuam9iTmFtZSkpKTtcblxuICAgICAgICAvLyBidWlsZCBqb2JzIG1hcCAob25lIGVudHJ5IHBlciBqb2IgdGhpcyBjaWQgaGFzKVxuICAgICAgICBmb3IgKGNvbnN0IGUgb2YgbXlFbnRyaWVzKSB7XG4gICAgICAgICAgICBqb2JzW2Uuam9iTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiBlLmNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBqb2JOYW1lOiBlLmpvYk5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGVMZXZlbDogZS5ncmFkZUxldmVsID8/IDAsXG4gICAgICAgICAgICAgICAgam9iTGFiZWw6IGUuam9iTGFiZWwgPz8gRnJhbWV3b3JrPy5TaGFyZWQ/LkpvYnM/LltlLmpvYk5hbWVdPy5sYWJlbCA/PyBlLmpvYk5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGVMYWJlbDogZS5ncmFkZUxhYmVsID8/IEZyYW1ld29yaz8uU2hhcmVkPy5Kb2JzPy5bZS5qb2JOYW1lXT8uZ3JhZGVzPy5bZS5ncmFkZUxldmVsXT8ubmFtZSA/PyAnJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZldGNoIGFsbCBlbXBsb3llZXMgZm9yIHRoZSBjb2xsZWN0ZWQgam9icyBhbmQgYnVpbGQgZW1wbG95ZWVzIG1hcDogeyBqb2JOYW1lOiB7IGNpZDogey4uLn0sIC4uLiB9LCAuLi4gfVxuICAgICAgICBjb25zdCBhbGxFbXBsb3llZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGpvYk5hbWU6IHsgJGluOiBqb2JOYW1lcyB9IH0pO1xuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGFsbEVtcGxveWVlcykge1xuICAgICAgICAgICAgZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdID0gZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdW2VudHJ5LmNpdGl6ZW5JZF0gPSB7XG4gICAgICAgICAgICAgICAgY2lkOiBlbnRyeS5jaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgZ3JhZGU6IGVudHJ5LmdyYWRlTGV2ZWwgPz8gMCxcbiAgICAgICAgICAgICAgICBncmFkZUxhYmVsOiBlbnRyeS5ncmFkZUxhYmVsID8/ICcnLFxuICAgICAgICAgICAgICAgIGpvYkxhYmVsOiBlbnRyeS5qb2JMYWJlbCA/PyAnJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGpvYnMsIGVtcGxveWVlcyB9O1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IFV0aWxzID0gbmV3IFV0aWwoKTsiLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFBob25lTWFpbCwgUGhvbmVNYWlsTWVzc2FnZSB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuXG5jbGFzcyBNYWlsIHtcbiAgICBhc3luYyBnZXRNYWlsTWVzc2FnZXMoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykge1xuICAgICAgICBpZiAoIWVtYWlsICYmICFwYXNzd29yZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCwgYWN0aXZlTWFpbFBhc3N3b3JkOiBwYXNzd29yZCB9KTtcbiAgICAgICAgaWYgKCFtYWlsRGF0YSB8fCBtYWlsRGF0YS5tZXNzYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIG1haWxEYXRhLm1lc3NhZ2VzID0gW107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYWlsRGF0YS5tZXNzYWdlcyA9IG1haWxEYXRhLm1lc3NhZ2VzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBuZXcgRGF0ZShiLmRhdGUpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEuZGF0ZSkuZ2V0VGltZSgpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShtYWlsRGF0YS5tZXNzYWdlcyk7XG4gICAgfTtcblxuICAgIGFzeW5jIHNlbmRNYWlsKGVtYWlsOiBzdHJpbmcsIHRvOiBzdHJpbmcsIHN1YmplY3Q6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nLCBpbWFnZXM6IHN0cmluZ1tdLCBzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSBlbWFpbDtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdG87XG5cbiAgICAgICAgY29uc3QgcGxheWVyTWFpbDogUGhvbmVNYWlsID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHBsYXllciB9KTtcbiAgICAgICAgY29uc3QgdGFyZ2V0TWFpbDogUGhvbmVNYWlsID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHRhcmdldCB9KTtcbiAgICAgICAgaWYgKCFwbGF5ZXJNYWlsIHx8ICF0YXJnZXRNYWlsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG5ld01haWxNZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHBsYXllcixcbiAgICAgICAgICAgIHRvOiB0YXJnZXQsXG4gICAgICAgICAgICBhdmF0YXI6IGF3YWl0IFV0aWxzLkdldEF2YXRhckZyb21FbWFpbCh0YXJnZXQpLFxuICAgICAgICAgICAgdXNlcm5hbWU6IGF3YWl0IFV0aWxzLkdldFVzZXJOYW1lRnJvbUVtYWlsKHRhcmdldCksXG4gICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSwgXG4gICAgICAgICAgICBpbWFnZXM6IGltYWdlcyxcbiAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHJlYWQ6IHRydWUsXG4gICAgICAgICAgICB0YWdzOiBbJ2luYm94JywgJ3NlbnQnXVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHRhcmdldE1haWxtZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHBsYXllcixcbiAgICAgICAgICAgIHRvOiB0YXJnZXQsXG4gICAgICAgICAgICBhdmF0YXI6IGF3YWl0IFV0aWxzLkdldEF2YXRhckZyb21FbWFpbChwbGF5ZXIpLFxuICAgICAgICAgICAgc3ViamVjdDogc3ViamVjdCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICB1c2VybmFtZTogYXdhaXQgVXRpbHMuR2V0VXNlck5hbWVGcm9tRW1haWwocGxheWVyKSxcbiAgICAgICAgICAgIGltYWdlczogaW1hZ2VzLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgICAgICB0YWdzOiBbJ2luYm94J11cbiAgICAgICAgfVxuICAgICAgICBwbGF5ZXJNYWlsLm1lc3NhZ2VzLnB1c2gobmV3TWFpbE1lc3NhZ2UpO1xuICAgICAgICB0YXJnZXRNYWlsLm1lc3NhZ2VzLnB1c2godGFyZ2V0TWFpbG1lc3NhZ2UpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBwbGF5ZXIgfSwgcGxheWVyTWFpbCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHRhcmdldCB9LCB0YXJnZXRNYWlsKTtcblxuICAgICAgICBjb25zdCB0YXJnZXRDaWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJCeUVtYWlsKHRhcmdldCk7XG4gICAgICAgIHBsYXllck1haWwubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IG5ldyBEYXRlKGIuZGF0ZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5kYXRlKS5nZXRUaW1lKCkpO1xuICAgICAgICB0YXJnZXRNYWlsLm1lc3NhZ2VzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBuZXcgRGF0ZShiLmRhdGUpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEuZGF0ZSkuZ2V0VGltZSgpKTtcblxuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2htYWlsTWVzc2FnZXMnLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHBsYXllck1haWwubWVzc2FnZXMpKTtcbiAgICAgICAgaWYgKHRhcmdldENpZCkge1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0Q2lkLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWFpbCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBhIG5ldyBtYWlsIGZyb20gJHtwbGF5ZXJ9LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaG1haWxNZXNzYWdlcycsIHRhcmdldENpZC5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkodGFyZ2V0TWFpbC5tZXNzYWdlcykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBzZW5kRW1haWxUb0FsbChzdWJqZWN0OiBzdHJpbmcsIHNlbmRlcjogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIGltYWdlczogc3RyaW5nW10pIHtcbiAgICAgICAgY29uc3QgbWFpbERhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IHsgJG5lOiBudWxsIH0gfSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgbWFpbERhdGEuZm9yRWFjaChhc3luYyAobWFpbDogUGhvbmVNYWlsKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXdNYWlsTWVzc2FnZTogUGhvbmVNYWlsTWVzc2FnZSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGZyb206IHNlbmRlcixcbiAgICAgICAgICAgICAgICB0bzogbWFpbC5hY3RpdmVNYWlkSWQsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiAnJyxcbiAgICAgICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgaW1hZ2VzOiBpbWFnZXMgfHwgW10sXG4gICAgICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHRhZ3M6IFsnaW5ib3gnXSxcbiAgICAgICAgICAgICAgICB1c2VybmFtZTogc2VuZGVyXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbWFpbC5tZXNzYWdlcy5wdXNoKG5ld01haWxNZXNzYWdlKTtcbiAgICAgICAgICAgIC8vQHRzLWlnbm9yZVxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbC5faWQgfSwgbWFpbCk7XG4gICAgICAgIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCAtMSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdNYWlsJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYSBuZXcgbWFpbCwgJHttZXNzYWdlfS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBzZWxlY3RlTWVzc2FnZShkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHsgbWVzc2FnZUlkLCBtYWlsSWQgfSA9IHBhcnNlZERhdGE7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhOiBQaG9uZU1haWwgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbElkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBtYWlsRGF0YS5tZXNzYWdlcy5maW5kKChtKSA9PiBtLl9pZCA9PT0gbWVzc2FnZUlkKTtcbiAgICAgICAgaWYgKCFtZXNzYWdlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIG1lc3NhZ2UucmVhZCA9IHRydWU7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IG1haWxJZCB9LCBtYWlsRGF0YSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBnZXRQcm9maWxlU2V0dGluZ3MoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZEFuZFJldHVyblNwZWNpZmljRmllbGRzKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0sIFsnYWN0aXZlTWFpZElkJywgJ2FjdGl2ZU1haWxQYXNzd29yZCcsICdhdmF0YXInLCAndXNlcm5hbWUnXSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG1haWxEYXRhKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgdXBkYXRlUHJvZmlsZVNldHRpbmdzKGVtYWlsOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcsIHVzZXJuYW1lOiBzdHJpbmcsIGF2YXRhcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIG1haWxEYXRhLnVzZXJuYW1lID0gdXNlcm5hbWU7XG4gICAgICAgIG1haWxEYXRhLmF2YXRhciA9IGF2YXRhcjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwsIGFjdGl2ZU1haWxQYXNzd29yZDogcGFzc3dvcmQgfSwgbWFpbERhdGEpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xufVxuXG5leHBvcnQgY29uc3QgTWFpbENsYXNzID0gbmV3IE1haWwoKTsiLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIi4vY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTWFpbENsYXNzIH0gZnJvbSBcIi4vYXBwcy9NYWlsL2NsYXNzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5hc3luYyBmdW5jdGlvbiBHZXRDdXJyZW50UGhvbmVOdW1iZXIoc291cmNlOiBudW1iZXIgfCBzdHJpbmcpIHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn1cbmV4cG9ydHMoJ0dldEN1cnJlbnRQaG9uZU51bWJlcicsIEdldEN1cnJlbnRQaG9uZU51bWJlcik7XG5cbmFzeW5jIGZ1bmN0aW9uIEdldEN1cnJlbnRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgY29uc3QgbnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIHJldHVybiBudW1iZXI7XG59XG5leHBvcnRzKCdHZXRDdXJyZW50UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZCcsIEdldEN1cnJlbnRQaG9uZU51bWJlckJ5Q2l0aXplbklkKTtcblxuYXN5bmMgZnVuY3Rpb24gR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgY29uc3QgZW1haWwgPSBhd2FpdCBVdGlscy5HZXRFbWFpbElkQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICByZXR1cm4gZW1haWw7XG59XG5leHBvcnRzKCdHZXRFbWFpbElkQnlDaXRpemVuSWQnLCBHZXRFbWFpbElkQnlDaXRpemVuSWQpO1xuXG5hc3luYyBmdW5jdGlvbiBHZXRFbWFpbElkQnlTb3VyY2Uoc291cmNlOiBudW1iZXIgfCBzdHJpbmcpIHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBlbWFpbCA9IGF3YWl0IFV0aWxzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIHJldHVybiBlbWFpbDtcbn1cbmV4cG9ydHMoJ0dldEVtYWlsSWRCeVNvdXJjZScsIEdldEVtYWlsSWRCeVNvdXJjZSk7XG5cbmFzeW5jIGZ1bmN0aW9uIFNlbmROb3RpZmljYXRpb24oc291cmNlOiBudW1iZXIgfCBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIGFwcDogc3RyaW5nLCB0aW1lb3V0PzogbnVtYmVyKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZSxcbiAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgIGFwcCxcbiAgICAgICAgdGltZW91dDogdGltZW91dCB8fCA1MDAwLFxuICAgIH0pKTtcbn1cbmV4cG9ydHMoJ1NlbmROb3RpZmljYXRpb24nLCBTZW5kTm90aWZpY2F0aW9uKTtcblxuYXN5bmMgZnVuY3Rpb24gU2VuZE1haWwoZGF0YToge1xuICAgIGVtYWlsOiBzdHJpbmc7XG4gICAgdG86IHN0cmluZztcbiAgICBzdWJqZWN0OiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGltYWdlczogc3RyaW5nW107XG4gICAgc291cmNlOiBudW1iZXI7XG59KSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbmRNYWlsKGRhdGEuZW1haWwsIGRhdGEudG8sIGRhdGEuc3ViamVjdCwgZGF0YS5tZXNzYWdlLCBkYXRhLmltYWdlcywgZGF0YS5zb3VyY2UpO1xuICAgIHJldHVybiByZXM7XG59XG5leHBvcnRzKCdTZW5kTWFpbCcsIFNlbmRNYWlsKTtcblxuYXN5bmMgZnVuY3Rpb24gU2VuZE1haWxUb0FsbChkYXRhOiB7XG4gICAgc3ViamVjdDogc3RyaW5nO1xuICAgIHNlbmRlcjogc3RyaW5nO1xuICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICBpbWFnZXM6IHN0cmluZ1tdO1xufSkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5zZW5kRW1haWxUb0FsbChkYXRhLnN1YmplY3QsIGRhdGEuc2VuZGVyLGRhdGEubWVzc2FnZSwgZGF0YS5pbWFnZXMpO1xuICAgIHJldHVybiByZXM7XG59XG5leHBvcnRzKCdTZW5kTWFpbFRvQWxsJywgU2VuZE1haWxUb0FsbCk7XG5cbmNvbnN0IEdldEpvYnMgPSBhc3luYyAoY2l0aXplbklkOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHt9O1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IFV0aWxzLmdldEpvYnMoY2l0aXplbklkKTtcbiAgICByZXR1cm4gcmVzLmpvYnMgfHwge307XG59O1xuZXhwb3J0cygnZ2V0Sm9icycsIEdldEpvYnMpO1xuXG4vLyBPcHRpb25hbDogcmV0dXJuIGZ1bGwgcmVzdWx0IHsgam9icywgZW1wbG95ZWVzIH1cbmNvbnN0IEdldEpvYnNGdWxsID0gYXN5bmMgKGNpdGl6ZW5JZDogc3RyaW5nKSA9PiB7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiB7IGpvYnM6IHt9LCBlbXBsb3llZXM6IHt9IH07XG4gICAgcmV0dXJuIGF3YWl0IFV0aWxzLmdldEpvYnMoY2l0aXplbklkKTtcbn07XG5leHBvcnRzKCdnZXRKb2JzRnVsbCcsIEdldEpvYnNGdWxsKTsiLCAiY29uc3QgY2FjaGVFdmVudHMgPSB7fTtcbmV4cG9ydCBjb25zdCBjYWNoZSA9IG5ldyBQcm94eSh7XG4gICAgcmVzb3VyY2U6IEdldEN1cnJlbnRSZXNvdXJjZU5hbWUoKSxcbiAgICBnYW1lOiBHZXRHYW1lTmFtZSgpLFxufSwge1xuICAgIGdldCh0YXJnZXQsIGtleSkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBrZXkgPyB0YXJnZXRba2V5XSA6IHRhcmdldDtcbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgY2FjaGVFdmVudHNba2V5XSA9IFtdO1xuICAgICAgICBBZGRFdmVudEhhbmRsZXIoYG94X2xpYjpjYWNoZToke2tleX1gLCAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICBjb25zdCBldmVudHMgPSBjYWNoZUV2ZW50c1trZXldO1xuICAgICAgICAgICAgZXZlbnRzLmZvckVhY2goKGNiKSA9PiBjYih2YWx1ZSwgb2xkVmFsdWUpKTtcbiAgICAgICAgICAgIHRhcmdldFtrZXldID0gdmFsdWU7XG4gICAgICAgIH0pO1xuICAgICAgICB0YXJnZXRba2V5XSA9IGV4cG9ydHMub3hfbGliLmNhY2hlKGtleSkgfHwgZmFsc2U7XG4gICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICB9LFxufSk7XG5leHBvcnQgY29uc3Qgb25DYWNoZSA9IChrZXksIGNiKSA9PiB7XG4gICAgaWYgKCFjYWNoZUV2ZW50c1trZXldKVxuICAgICAgICBjYWNoZVtrZXldO1xuICAgIGNhY2hlRXZlbnRzW2tleV0ucHVzaChjYik7XG59O1xuIiwgImltcG9ydCB7IGNhY2hlIH0gZnJvbSAnLi4vY2FjaGUnO1xuY29uc3QgcGVuZGluZ0NhbGxiYWNrcyA9IHt9O1xuY29uc3QgY2FsbGJhY2tUaW1lb3V0ID0gR2V0Q29udmFySW50KCdveDpjYWxsYmFja1RpbWVvdXQnLCAzMDAwMDApO1xub25OZXQoYF9fb3hfY2JfJHtjYWNoZS5yZXNvdXJjZX1gLCAoa2V5LCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgcmVzb2x2ZSA9IHBlbmRpbmdDYWxsYmFja3Nba2V5XTtcbiAgICBkZWxldGUgcGVuZGluZ0NhbGxiYWNrc1trZXldO1xuICAgIHJldHVybiByZXNvbHZlICYmIHJlc29sdmUoLi4uYXJncyk7XG59KTtcbmV4cG9ydCBmdW5jdGlvbiB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soZXZlbnROYW1lLCBwbGF5ZXJJZCwgLi4uYXJncykge1xuICAgIGxldCBrZXk7XG4gICAgZG8ge1xuICAgICAgICBrZXkgPSBgJHtldmVudE5hbWV9OiR7TWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKDEwMDAwMCArIDEpKX06JHtwbGF5ZXJJZH1gO1xuICAgIH0gd2hpbGUgKHBlbmRpbmdDYWxsYmFja3Nba2V5XSk7XG4gICAgZW1pdE5ldChgX19veF9jYl8ke2V2ZW50TmFtZX1gLCBwbGF5ZXJJZCwgY2FjaGUucmVzb3VyY2UsIGtleSwgLi4uYXJncyk7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcGVuZGluZ0NhbGxiYWNrc1trZXldID0gcmVzb2x2ZTtcbiAgICAgICAgc2V0VGltZW91dChyZWplY3QsIGNhbGxiYWNrVGltZW91dCwgYGNhbGxiYWNrIGV2ZW50ICcke2tleX0nIHRpbWVkIG91dGApO1xuICAgIH0pO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG9uQ2xpZW50Q2FsbGJhY2soZXZlbnROYW1lLCBjYikge1xuICAgIG9uTmV0KGBfX294X2NiXyR7ZXZlbnROYW1lfWAsIGFzeW5jIChyZXNvdXJjZSwga2V5LCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IHNyYyA9IHNvdXJjZTtcbiAgICAgICAgbGV0IHJlc3BvbnNlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcG9uc2UgPSBhd2FpdCBjYihzcmMsIC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBhbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBoYW5kbGluZyBjYWxsYmFjayBldmVudCAke2V2ZW50TmFtZX1gKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBeMyR7ZS5zdGFja31eMGApO1xuICAgICAgICB9XG4gICAgICAgIGVtaXROZXQoYF9fb3hfY2JfJHtyZXNvdXJjZX1gLCBzcmMsIGtleSwgcmVzcG9uc2UpO1xuICAgIH0pO1xufVxuIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBQaG9uZUNvbnRhY3RzIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOmdldENvbnRhY3RzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBjb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2NvbnRhY3RzJywgeyBvd25lcklkOiBjaXRpemVuSWQgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNvbnRhY3RzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czpzYXZlQ29udGFjdCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNvbnRhY3REYXRhOiBQaG9uZUNvbnRhY3RzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBpZiAoY29udGFjdERhdGEuX2lkKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBjb250YWN0RGF0YS5faWQgfSwgeyAuLi5jb250YWN0RGF0YSB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdDb250YWN0IFVwZGF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYENvbnRhY3QgJyR7Y29udGFjdERhdGEuZmlyc3ROYW1lfScke2NvbnRhY3REYXRhLmxhc3ROYW1lfScgKE51bWJlcjogJHtjb250YWN0RGF0YS5jb250YWN0TnVtYmVyfSkgdXBkYXRlZCBieSAke2NvbnRhY3REYXRhLnBlcnNvbmFsTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6YWRkQ29udGFjdCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBjb250YWN0RGF0YTogUGhvbmVDb250YWN0cyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgZGF0YVggPSB7IC4uLmNvbnRhY3REYXRhLCBvd25lcklkOiBjaXRpemVuSWQsIHBlcnNvbmFsTnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCkgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9jb250YWN0cycsIGRhdGFYKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgdGl0bGU6ICdDb250YWN0IEFkZGVkJyxcbiAgICAgICAgbWVzc2FnZTogYENvbnRhY3QgJyR7Y29udGFjdERhdGEuZmlyc3ROYW1lfScke2NvbnRhY3REYXRhLmxhc3ROYW1lfScgKE51bWJlcjogJHtjb250YWN0RGF0YS5jb250YWN0TnVtYmVyfSkgYWRkZWQgYnkgJHtkYXRhWC5wZXJzb25hbE51bWJlcn0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhWCk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6ZGVsZXRlQ29udGFjdCcsIGFzeW5jIChjbGllbnQsIF9pZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY29udGFjdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogX2lkIH0pO1xuICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9jb250YWN0cycsXG4gICAgICAgIHRpdGxlOiAnQ29udGFjdCBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYENvbnRhY3QgJyR7Y29udGFjdC5maXJzdE5hbWV9JyAnJHtjb250YWN0Lmxhc3ROYW1lfScgKE51bWJlcjogJHtjb250YWN0LmNvbnRhY3ROdW1iZXJ9KSBkZWxldGVkIGJ5ICR7Y29udGFjdC5wZXJzb25hbE51bWJlcn0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOmZhdkNvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBfaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNvbnRhY3QgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9KTtcbiAgICBjb25zdCBkYXRhWCA9IHsgLi4uY29udGFjdCwgaXNGYXY6ICFjb250YWN0LmlzRmF2IH1cbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogX2lkIH0sIGRhdGFYKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgdGl0bGU6ICdDb250YWN0IEZhdm9yaXRlIFRvZ2dsZWQnLFxuICAgICAgICBtZXNzYWdlOiBgQ29udGFjdCAnJHtjb250YWN0LmZpcnN0TmFtZX0nICcke2NvbnRhY3QubGFzdE5hbWV9JyAoTnVtYmVyOiAke2NvbnRhY3QuY29udGFjdE51bWJlcn0pIGZhdm9yaXRlIHN0YXR1cyBzZXQgdG8gJHtkYXRhWC5pc0Zhdn0gYnkgJHtjb250YWN0LnBlcnNvbmFsTnVtYmVyfS5gLFxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhWCk7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBEYXJrQ2hhdENoYW5uZWwgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdTZWFyY2hEYXJrQ2hhdEVtYWlsJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBkYXRhIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1JlZ2lzdGVyTmV3RGFya01haWxBY2NvdW50JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZW1haWwsIGVtYWlsLCBwYXNzd29yZCwgYXZhdGFyOiBcIlwiIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfYWNjb3VudHMnLFxuICAgICAgICB0aXRsZTogJ0FjY291bnQgUmVnaXN0ZXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBOZXcgRGFya0NoYXQgYWNjb3VudCByZWdpc3RlcmVkIHdpdGggZW1haWwgJHtlbWFpbH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0xvZ2luRGFya01haWxBY2NvdW50JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgICAgICBlbWFpbDogc3RyaW5nO1xuICAgICAgICBwYXNzd29yZDogc3RyaW5nO1xuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBwYXJzZWREYXRhLmVtYWlsIH0pO1xuICAgIGlmIChyZXMucGFzc3dvcmQgPT09IHBhcnNlZERhdGEucGFzc3dvcmQpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfYWNjb3VudHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdBY2NvdW50IExvZ2luJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyIGxvZ2dlZCBpbnRvIERhcmtDaGF0IHdpdGggZW1haWwgJHtwYXJzZWREYXRhLmVtYWlsfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdDcmVhdGVOZXdEYXJrQ2hhbm5lbCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgbmFtZSwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzMjogRGFya0NoYXRDaGFubmVsW10gPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHt9KTtcbiAgICBpZiAocmVzMi5maW5kKChjaGFubmVsKSA9PiBjaGFubmVsLm5hbWUgPT09IG5hbWUpICYmICFyZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSk/Lm1lbWJlcnMuaW5jbHVkZXMoZW1haWwpKSB7XG4gICAgICAgIHJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKT8ubWVtYmVycy5wdXNoKGVtYWlsKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBuYW1lIH0sIHJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSm9pbmVkIENoYW5uZWwnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IGpvaW5lZCBleGlzdGluZyBEYXJrQ2hhdCBjaGFubmVsICcke25hbWV9Jy5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlczIuZmlsdGVyKChjaGFubmVsKSA9PiBjaGFubmVsLm1lbWJlcnMuaW5jbHVkZXMoZW1haWwpKSk7XG4gICAgfSBlbHNlIGlmICghcmVzMi5maW5kKChjaGFubmVsKSA9PiBjaGFubmVsLm5hbWUgPT09IG5hbWUpKSB7XG4gICAgICAgIGNvbnN0IG5ld0RhdGEgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgIG1lbWJlcnM6IFtlbWFpbF0sXG4gICAgICAgICAgICBjcmVhdG9yOiBlbWFpbCxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgbmV3RGF0YSk7XG4gICAgICAgIHJlczIucHVzaChuZXdEYXRhKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdDaGFubmVsIENyZWF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IGNyZWF0ZWQgbmV3IERhcmtDaGF0IGNoYW5uZWwgJyR7bmFtZX0nLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzMi5maWx0ZXIoKGNoYW5uZWwpID0+IGNoYW5uZWwubWVtYmVycy5pbmNsdWRlcyhlbWFpbCkpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0dldERhcmtDaGF0UHJvZmlsZScsIGFzeW5jIChjbGllbnQsIGVtYWlsOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZW1haWwgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnR2V0RGFya0NoYXRDaGFubmVscycsIGFzeW5jIChjbGllbnQsIGVtYWlsOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgbWVtYmVyczogZW1haWwgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnUmVtb3ZlRnJvbURhcmtDaGFubmVsJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBfaWQsIGVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IF9pZCB9KTtcbiAgICBpZiAocmVzLmNyZWF0b3IgPT09IGVtYWlsKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgX2lkIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgICAgICB0aXRsZTogJ0NoYW5uZWwgRGVsZXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gZGVsZXRlZCBEYXJrQ2hhdCBjaGFubmVsICcke3Jlcy5uYW1lfScgKElEOiAke19pZH0pLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcy5tZW1iZXJzID0gcmVzLm1lbWJlcnMuZmlsdGVyKChtZW1iZXI6IHN0cmluZykgPT4gbWVtYmVyICE9PSBlbWFpbCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgX2lkIH0sIHJlcyk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTGVmdCBDaGFubmVsJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSBsZWZ0IERhcmtDaGF0IGNoYW5uZWwgJyR7cmVzLm5hbWV9JyAoSUQ6ICR7X2lkfSkuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1VwZGF0ZURhcmtBdmF0YXInLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGVtYWlsLCBhdmF0YXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsIH0pO1xuICAgIHJlcy5hdmF0YXIgPSBhdmF0YXI7XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZW1haWwgfSwgcmVzKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2FjY291bnRzJyxcbiAgICAgICAgdGl0bGU6ICdBdmF0YXIgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSB1cGRhdGVkIHRoZWlyIERhcmtDaGF0IGF2YXRhci5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnVXBkYXRlRGFya1Bhc3N3b3JkJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsIH0pO1xuICAgIHJlcy5wYXNzd29yZCA9IHBhc3N3b3JkO1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsIH0sIHJlcyk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9hY2NvdW50cycsXG4gICAgICAgIHRpdGxlOiAnUGFzc3dvcmQgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSB1cGRhdGVkIHRoZWlyIERhcmtDaGF0IHBhc3N3b3JkLmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdTZXREYXJrQ2hhdE1lc3NhZ2VzJywgYXN5bmMgKGNsaWVudCwgZGF0YVg6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgY2hhbm5lbCwgZGF0YSB9ID0gSlNPTi5wYXJzZShkYXRhWCk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBfaWQ6IGNoYW5uZWwgfSwgZGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgIHRpdGxlOiAnTWVzc2FnZSBTZW50JyxcbiAgICAgICAgbWVzc2FnZTogYE1lc3NhZ2Ugc2VudCBpbiBEYXJrQ2hhdCBjaGFubmVsICcke2RhdGEubmFtZX0nIChJRDogJHtjaGFubmVsfSksIENvbnRlbnQ6ICR7ZGF0YS5jb250ZW50fS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgZGF0YS5tZW1iZXJzLmZvckVhY2goYXN5bmMgKG1lbWJlcjogc3RyaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IFV0aWxzLkdldFNvdXJjZUZyb21DaXRpemVuSWQoYXdhaXQgVXRpbHMuR2V0Q2lkRnJvbURhcmtFbWFpbChtZW1iZXIpKTtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybjtcbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWNlaXZlRGFya0NoYXRNZXNzYWdlJywgcmVzLCBKU09OLnN0cmluZ2lmeShkYXRhKSk7XG4gICAgICAgIGlmIChyZXMgIT09IGNsaWVudCkge1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgcmVzLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnRGFya0NoYXQnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYSBuZXcgbWVzc2FnZSBpbiAke2RhdGEubmFtZX0uYCxcbiAgICAgICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IE1haWxDbGFzcyB9IGZyb20gXCIuL2NsYXNzXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6Z2V0RW1haWxNZXNzYWdlcycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBNYWlsQ2xhc3MuZ2V0TWFpbE1lc3NhZ2VzKGVtYWlsLCBwYXNzd29yZClcbiAgICByZXR1cm4gZGF0YTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VuZEVtYWlsJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBlbWFpbDogc3RyaW5nLCB0bzogc3RyaW5nLCBzdWJqZWN0OiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZywgaW1hZ2VzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5zZW5kTWFpbChlbWFpbCwgdG8sIHN1YmplY3QsIG1lc3NhZ2UsIGltYWdlcywgc291cmNlKTtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX21haWwnLFxuICAgICAgICB0aXRsZTogJ0VtYWlsIFNlbnQnLFxuICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7Y2l0aXplbklkfSBzZW50IGFuIGVtYWlsIGZyb20gJHtlbWFpbH0gdG8gJHt0b30gd2l0aCBzdWJqZWN0IFwiJHtzdWJqZWN0fVwiLCBjb250ZW50OiBcIiR7bWVzc2FnZX1cImAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXRTZWxlY3RlZE1lc3NhZ2UnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5zZWxlY3RlTWVzc2FnZShkYXRhKTtcbiAgICByZXR1cm4gcmVzO1xufSlcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOmdldFByb2ZpbGVTZXR0aW5ncycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IHBhcnNlZERhdGE7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLmdldFByb2ZpbGVTZXR0aW5ncyhlbWFpbCwgcGFzc3dvcmQpO1xuICAgIHJldHVybiByZXM7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnVwZGF0ZVByb2ZpbGVTZXR0aW5ncycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQsIHVzZXJuYW1lLCBhdmF0YXIgfSA9IHBhcnNlZERhdGE7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnVwZGF0ZVByb2ZpbGVTZXR0aW5ncyhlbWFpbCwgcGFzc3dvcmQsIHVzZXJuYW1lLCBhdmF0YXIpO1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWFpbCcsXG4gICAgICAgIHRpdGxlOiAnUHJvZmlsZSBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBsYXllciAke2NpdGl6ZW5JZH0gdXBkYXRlZCBwcm9maWxlIGZvciBlbWFpbCAke2VtYWlsfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcztcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6c2VuZE1lc3NhZ2UnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHR5cGUsIHBob25lTnVtYmVyLCBncm91cElkLCBtZXNzYWdlRGF0YSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuICAgIGxldCBmaXJzdE1lc3NhZ2UgPSBmYWxzZTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICB1c2VyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiBzZW5kZXJJZCxcbiAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgfTtcbiAgICAgICAgZmlyc3RNZXNzYWdlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBsZXQgY29udmVyc2F0aW9uO1xuICAgIGlmICh0eXBlID09PSAncHJpdmF0ZScpIHtcbiAgICAgICAgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyB0eXBlOiBzdHJpbmcsIHBob25lTnVtYmVyPzogc3RyaW5nIH0pID0+XG4gICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIG1zZy5waG9uZU51bWJlciA9PT0gcGhvbmVOdW1iZXIpO1xuICAgICAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgY29uc3QgY29udGFjdE5hbWUgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0TmFtZUJ5TnVtYmVyKHBob25lTnVtYmVyLCBzZW5kZXJJZCkgfHwgYFVua25vd24gKCR7cGhvbmVOdW1iZXJ9KWA7XG4gICAgICAgICAgICBjb25zdCBhdmF0YXIgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0QXZhdGFyQnlOdW1iZXIocGhvbmVOdW1iZXIsIHNlbmRlcklkKSB8fCBudWxsOyAvLyBBc3N1bWUgdGhpcyB1dGlsaXR5IGV4aXN0c1xuICAgICAgICAgICAgY29udmVyc2F0aW9uID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwcml2YXRlJyxcbiAgICAgICAgICAgICAgICBuYW1lOiBjb250YWN0TmFtZSxcbiAgICAgICAgICAgICAgICBhdmF0YXI6IGF2YXRhciwgLy8gU2V0IGF2YXRhciBmb3IgcHJpdmF0ZSBjb250YWN0XG4gICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHBob25lTnVtYmVyLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKGNvbnZlcnNhdGlvbik7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdncm91cCcpIHtcbiAgICAgICAgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyB0eXBlOiBzdHJpbmcsIGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIGZvciBzZW5kZXInIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbGFzdE1lc3NhZ2UgPSBjb252ZXJzYXRpb24ubWVzc2FnZXNbY29udmVyc2F0aW9uLm1lc3NhZ2VzLmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IG5leHRQYWdlID0gbGFzdE1lc3NhZ2UgPyBsYXN0TWVzc2FnZS5wYWdlICsgMSA6IDE7XG5cbiAgICBjb25zdCBuZXdNZXNzYWdlID0ge1xuICAgICAgICBtZXNzYWdlOiBtZXNzYWdlRGF0YS5tZXNzYWdlLFxuICAgICAgICByZWFkOiB0cnVlLFxuICAgICAgICBwYWdlOiBuZXh0UGFnZSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHNlbmRlcklkOiBzZW5kZXJQaG9uZU51bWJlcixcbiAgICAgICAgYXR0YWNobWVudHM6IG1lc3NhZ2VEYXRhLmF0dGFjaG1lbnRzIHx8IFtdXG4gICAgfTtcblxuICAgIGNvbnZlcnNhdGlvbi5tZXNzYWdlcy5wdXNoKG5ld01lc3NhZ2UpO1xuXG4gICAgaWYgKCFmaXJzdE1lc3NhZ2UpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCB1c2VyTWVzc2FnZXMpO1xuICAgIH1cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX21lc3NhZ2VzJyxcbiAgICAgICAgdGl0bGU6ICdNZXNzYWdlIFNlbnQnLFxuICAgICAgICBtZXNzYWdlOiBgU2VuZGVyICR7c2VuZGVyUGhvbmVOdW1iZXJ9IHNlbnQgYSBtZXNzYWdlIHRvICR7dHlwZSA9PT0gJ3ByaXZhdGUnID8gcGhvbmVOdW1iZXIgOiAnZ3JvdXAgJyArIGdyb3VwSWR9IHdpdGggY29udGVudDogJHttZXNzYWdlRGF0YS5tZXNzYWdlfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICAvLyBIYW5kbGUgcmVjaXBpZW50c1xuICAgIGlmICh0eXBlID09PSAncHJpdmF0ZScpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICh0YXJnZXRDaXRpemVuSWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldE1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBjb25zdCBpc0Jsb2NrZWQgPSB0YXJnZXRNZXNzYWdlcz8uYmxvY2tlZE51bWJlcnM/LmluY2x1ZGVzKHNlbmRlclBob25lTnVtYmVyKTtcbiAgICAgICAgICAgIGlmICghaXNCbG9ja2VkKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgc2VuZFRvUmVjaXBpZW50KHRhcmdldENpdGl6ZW5JZCwgc2VuZGVyUGhvbmVOdW1iZXIsIG1lc3NhZ2VEYXRhLCAncHJpdmF0ZScsIHBob25lTnVtYmVyKTtcbiAgICAgICAgICAgICAgICBjb25zdCBDVlhDUyA9IGF3YWl0IFV0aWxzLkdldFNvdXJjZUZyb21DaXRpemVuSWQodGFyZ2V0Q2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICBpZiAoQ1ZYQ1MpIHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiTWVzc2FnZXNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBoYXZlIGEgbmV3IG1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lX21lc3NhZ2VzOmNsaWVudDp1cGRhdGVNZXNzYWdlcycsIENWWENTLCBKU09OLnN0cmluZ2lmeShuZXdNZXNzYWdlKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhgU2VuZGVyICR7c2VuZGVyUGhvbmVOdW1iZXJ9IGlzIGJsb2NrZWQgYnkgJHtwaG9uZU51bWJlcn0uIE1lc3NhZ2Ugc2F2ZWQgb25seSBmb3Igc2VuZGVyLmApOyAqL1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLyogY29uc29sZS5sb2coYFJlY2lwaWVudCB3aXRoIHBob25lIG51bWJlciAke3Bob25lTnVtYmVyfSBkb2VzIG5vdCBleGlzdC4gTWVzc2FnZSBzYXZlZCBvbmx5IGZvciBzZW5kZXIuYCk7ICovXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdncm91cCcpIHtcbiAgICAgICAgY29uc3QgZ3JvdXBDb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWdyb3VwQ29udmVyc2F0aW9uPy5tZW1iZXJzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG1lbWJlcnMgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwQ29udmVyc2F0aW9uLm1lbWJlcnMpIHtcbiAgICAgICAgICAgIGlmIChtZW1iZXJJZCAhPT0gc2VuZGVySWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVtYmVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKG1lbWJlcklkKTtcbiAgICAgICAgICAgICAgICBjb25zdCBpc0Jsb2NrZWQgPSBtZW1iZXJNZXNzYWdlcz8uYmxvY2tlZE51bWJlcnM/LmluY2x1ZGVzKHNlbmRlclBob25lTnVtYmVyKTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzQmxvY2tlZCkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBzZW5kVG9SZWNpcGllbnQobWVtYmVySWQsIHNlbmRlclBob25lTnVtYmVyLCBtZXNzYWdlRGF0YSwgJ2dyb3VwJywgdW5kZWZpbmVkLCBncm91cElkKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhgU2VuZGVyICR7c2VuZGVyUGhvbmVOdW1iZXJ9IGlzIGJsb2NrZWQgYnkgZ3JvdXAgbWVtYmVyICR7bWVtYmVyUGhvbmVOdW1iZXJ9LmApOyAqL1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBDVlhDUyA9IGF3YWl0IFV0aWxzLkdldFNvdXJjZUZyb21DaXRpemVuSWQobWVtYmVySWQpO1xuICAgICAgICAgICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIENWWENTLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiWW91IGhhdmUgYSBuZXcgbWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmVfbWVzc2FnZXM6Y2xpZW50OnVwZGF0ZU1lc3NhZ2VzJywgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHsgLi4ubmV3TWVzc2FnZSwgZ3JvdXBJZCB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG4vLyBIZWxwZXIgZnVuY3Rpb24gdG8gc2VuZCBtZXNzYWdlcyB0byByZWNpcGllbnRzICh1bmNoYW5nZWQpXG5hc3luYyBmdW5jdGlvbiBzZW5kVG9SZWNpcGllbnQoXG4gICAgdGFyZ2V0Q2l0aXplbklkOiBzdHJpbmcsXG4gICAgc2VuZGVyUGhvbmVOdW1iZXI6IHN0cmluZyxcbiAgICBtZXNzYWdlRGF0YTogYW55LFxuICAgIHR5cGU6ICdwcml2YXRlJyB8ICdncm91cCcsXG4gICAgcGhvbmVOdW1iZXI/OiBzdHJpbmcsXG4gICAgZ3JvdXBJZD86IHN0cmluZ1xuKSB7XG4gICAgbGV0IHRhcmdldE1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQgfSk7XG4gICAgbGV0IHJlY2VpdmVyRmlyc3RNZXNzYWdlID0gZmFsc2U7XG5cbiAgICBpZiAoIXRhcmdldE1lc3NhZ2VzKSB7XG4gICAgICAgIHRhcmdldE1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkLFxuICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9O1xuICAgICAgICByZWNlaXZlckZpcnN0TWVzc2FnZSA9IHRydWU7XG4gICAgfVxuXG4gICAgbGV0IHRhcmdldENvbnZlcnNhdGlvbjtcbiAgICBpZiAodHlwZSA9PT0gJ3ByaXZhdGUnKSB7XG4gICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyB0eXBlOiBzdHJpbmcsIHBob25lTnVtYmVyPzogc3RyaW5nIH0pID0+XG4gICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIG1zZy5waG9uZU51bWJlciA9PT0gc2VuZGVyUGhvbmVOdW1iZXIpO1xuICAgICAgICBpZiAoIXRhcmdldENvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgY29uc3QgY29udGFjdE5hbWUgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0TmFtZUJ5TnVtYmVyKHNlbmRlclBob25lTnVtYmVyLCB0YXJnZXRDaXRpemVuSWQpO1xuICAgICAgICAgICAgY29uc3QgYXZhdGFyID0gYXdhaXQgVXRpbHMuR2V0Q29udGFjdEF2YXRhckJ5TnVtYmVyKHNlbmRlclBob25lTnVtYmVyLCB0YXJnZXRDaXRpemVuSWQpIHx8ICcnOyAvLyBBc3N1bWUgdGhpcyB1dGlsaXR5IGV4aXN0c1xuICAgICAgICAgICAgdGFyZ2V0Q29udmVyc2F0aW9uID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwcml2YXRlJyxcbiAgICAgICAgICAgICAgICBuYW1lOiBjb250YWN0TmFtZSB8fCBgVW5rbm93biAoJHtzZW5kZXJQaG9uZU51bWJlcn0pYCxcbiAgICAgICAgICAgICAgICBhdmF0YXI6IGF2YXRhciwgLy8gU2V0IGF2YXRhciBmb3IgcHJpdmF0ZSBjb250YWN0XG4gICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHNlbmRlclBob25lTnVtYmVyLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2godGFyZ2V0Q29udmVyc2F0aW9uKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2dyb3VwJykge1xuICAgICAgICB0YXJnZXRDb252ZXJzYXRpb24gPSB0YXJnZXRNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBncm91cElkPzogc3RyaW5nIH0pID0+XG4gICAgICAgICAgICBtc2cudHlwZSA9PT0gJ2dyb3VwJyAmJiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghdGFyZ2V0Q29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBzZW5kZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihzZW5kZXJQaG9uZU51bWJlcikgfSk7XG4gICAgICAgICAgICBjb25zdCBncm91cCA9IHNlbmRlck1lc3NhZ2VzPy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICBpZiAoIWdyb3VwKSByZXR1cm47XG4gICAgICAgICAgICB0YXJnZXRDb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2dyb3VwJyxcbiAgICAgICAgICAgICAgICBuYW1lOiBncm91cC5uYW1lLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogZ3JvdXAuYXZhdGFyIHx8IG51bGwsIC8vIENvcHkgYXZhdGFyIGZyb20gc2VuZGVyJ3MgZ3JvdXBcbiAgICAgICAgICAgICAgICBncm91cElkOiBncm91cElkLFxuICAgICAgICAgICAgICAgIG1lbWJlcnM6IGdyb3VwLm1lbWJlcnMsXG4gICAgICAgICAgICAgICAgbWVtYmVyUGhvbmVOdW1iZXJzOiBncm91cC5tZW1iZXJQaG9uZU51bWJlcnMsXG4gICAgICAgICAgICAgICAgY3JlYXRvcklkOiBncm91cC5jcmVhdG9ySWQsIC8vIENvcHkgY3JlYXRvcklkXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMucHVzaCh0YXJnZXRDb252ZXJzYXRpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgdGFyZ2V0TGFzdE1lc3NhZ2UgPSB0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXNbdGFyZ2V0Q29udmVyc2F0aW9uLm1lc3NhZ2VzLmxlbmd0aCAtIDFdO1xuICAgIGNvbnN0IHRhcmdldE5leHRQYWdlID0gdGFyZ2V0TGFzdE1lc3NhZ2UgPyB0YXJnZXRMYXN0TWVzc2FnZS5wYWdlICsgMSA6IDE7XG5cbiAgICBjb25zdCB0YXJnZXROZXdNZXNzYWdlID0ge1xuICAgICAgICBtZXNzYWdlOiBtZXNzYWdlRGF0YS5tZXNzYWdlLFxuICAgICAgICByZWFkOiBmYWxzZSxcbiAgICAgICAgcGFnZTogdGFyZ2V0TmV4dFBhZ2UsXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBzZW5kZXJJZDogc2VuZGVyUGhvbmVOdW1iZXIsXG4gICAgICAgIGF0dGFjaG1lbnRzOiBtZXNzYWdlRGF0YS5hdHRhY2htZW50cyB8fCBbXVxuICAgIH07XG5cbiAgICB0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXMucHVzaCh0YXJnZXROZXdNZXNzYWdlKTtcblxuICAgIGlmICghcmVjZWl2ZXJGaXJzdE1lc3NhZ2UpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHRhcmdldE1lc3NhZ2VzLl9pZCB9LCB0YXJnZXRNZXNzYWdlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgdGFyZ2V0TWVzc2FnZXMpO1xuICAgIH1cbn1cblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpjcmVhdGVHcm91cCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZ3JvdXBOYW1lLCBtZW1iZXJQaG9uZU51bWJlcnMsIGF2YXRhciB9ID0gSlNPTi5wYXJzZShkYXRhKTsgLy8gQWRkZWQgYXZhdGFyIGZpZWxkXG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBtZW1iZXJJZHMgPSBbc2VuZGVySWRdO1xuICAgIGNvbnN0IHBob25lTnVtYmVycyA9IFtzZW5kZXJQaG9uZU51bWJlcl07XG4gICAgZm9yIChjb25zdCBwaG9uZSBvZiBtZW1iZXJQaG9uZU51bWJlcnMpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZSk7XG4gICAgICAgIGlmIChjaXRpemVuSWQgJiYgIW1lbWJlcklkcy5pbmNsdWRlcyhjaXRpemVuSWQpKSB7XG4gICAgICAgICAgICBtZW1iZXJJZHMucHVzaChjaXRpemVuSWQpO1xuICAgICAgICAgICAgcGhvbmVOdW1iZXJzLnB1c2gocGhvbmUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZ3JvdXBJZCA9IGdlbmVyYXRlVVVpZCgpO1xuICAgIGNvbnN0IGdyb3VwQ29udmVyc2F0aW9uID0ge1xuICAgICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgICBuYW1lOiBncm91cE5hbWUsXG4gICAgICAgIGF2YXRhcjogYXZhdGFyIHx8ICcnLFxuICAgICAgICBncm91cElkOiBncm91cElkLFxuICAgICAgICBtZW1iZXJzOiBtZW1iZXJJZHMsXG4gICAgICAgIG1lbWJlclBob25lTnVtYmVyczogcGhvbmVOdW1iZXJzLFxuICAgICAgICBjcmVhdG9ySWQ6IHNlbmRlcklkLCAvLyBTZXQgdGhlIGNyZWF0b3IgYXMgdGhlIHNlbmRlclxuICAgICAgICBtZXNzYWdlczogW11cbiAgICB9O1xuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgY3JlYXRlZCBuZXcgR3JvdXBcIixcbiAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogc2VuZGVySWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtncm91cENvbnZlcnNhdGlvbl1cbiAgICAgICAgfTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgdXNlck1lc3NhZ2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB1c2VyTWVzc2FnZXMubWVzc2FnZXMucHVzaChncm91cENvbnZlcnNhdGlvbik7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0sIHVzZXJNZXNzYWdlcyk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBtZW1iZXJJZCBvZiBtZW1iZXJJZHMpIHtcbiAgICAgICAgaWYgKG1lbWJlcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICAgICAgbGV0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgICAgICBpZiAoQ1ZYQ1MpIHtcbiAgICAgICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIENWWENTLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiTWVzc2FnZXNcIixcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiWW91IGhhdmUgYmVlbiBhZGRlZCB0byBhIG5ldyBncm91cFwiLFxuICAgICAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgY2l0aXplbklkOiBtZW1iZXJJZCxcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlczogW3sgLi4uZ3JvdXBDb252ZXJzYXRpb24gfV1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tZXNzYWdlcycsIG1lbWJlck1lc3NhZ2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMucHVzaCh7IC4uLmdyb3VwQ29udmVyc2F0aW9uIH0pO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZ3JvdXBzJyxcbiAgICAgICAgdGl0bGU6ICdHcm91cCBDcmVhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEdyb3VwICcke2dyb3VwTmFtZX0nIGNyZWF0ZWQgYnkgJHtzZW5kZXJQaG9uZU51bWJlcn0uIEdyb3VwIElEOiAke2dyb3VwSWR9IHdpdGggbWVtYmVyczogJHttZW1iZXJQaG9uZU51bWJlcnMuam9pbignLCAnKX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgZ3JvdXBJZCB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnRvZ2dsZUJsb2NrJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBwaG9uZU51bWJlciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IHNlbmRlcklkLFxuICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmICghdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzKSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycyA9IFtdO1xuICAgIH1cblxuICAgIGNvbnN0IGlzQmxvY2tlZCA9IHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5pbmNsdWRlcyhwaG9uZU51bWJlcik7XG4gICAgaWYgKGlzQmxvY2tlZCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5pbmRleE9mKHBob25lTnVtYmVyKTtcbiAgICAgICAgdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGROb3RpRmljYXRpb25cIiwgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIk51bWJlciB1bmJsb2NrZWRcIixcbiAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2Jsb2NrcycsXG4gICAgICAgICAgICB0aXRsZTogJ051bWJlciBVbmJsb2NrZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c2VuZGVyUGhvbmVOdW1iZXJ9IHVuYmxvY2tlZCAke3Bob25lTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMucHVzaChwaG9uZU51bWJlcik7XG4gICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGROb3RpRmljYXRpb25cIiwgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIk51bWJlciBibG9ja2VkXCIsXG4gICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9ibG9ja3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdOdW1iZXIgQmxvY2tlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gYmxvY2tlZCAke3Bob25lTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCAmJiB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMubGVuZ3RoID09PSAwICYmICF1c2VyTWVzc2FnZXMuZGVsZXRlZE1lc3NhZ2VzPy5sZW5ndGgpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6YWRkTWVtYmVyJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBncm91cElkLCBwaG9uZU51bWJlciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBWYWxpZGF0ZSB0aGUgbmV3IG1lbWJlclxuICAgICAgICBjb25zdCBuZXdNZW1iZXJJZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXIpO1xuICAgICAgICBpZiAoIW5ld01lbWJlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lbWJlciBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmV0Y2ggdGhlIHNlbmRlcidzIG1lc3NhZ2VzIHRvIGZpbmQgdGhlIGdyb3VwXG4gICAgICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgICAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdNZXNzYWdlcyBub3QgZm91bmQgZm9yIHNlbmRlcicgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBncm91cCA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZywgbWVtYmVycz86IHN0cmluZ1tdLCBjcmVhdG9ySWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWdyb3VwIHx8ICFncm91cC5tZW1iZXJzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCBvciB1bmF1dGhvcml6ZWQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIG5ldyBtZW1iZXIgaXMgYWxyZWFkeSBpbiB0aGUgZ3JvdXBcbiAgICAgICAgaWYgKGdyb3VwLm1lbWJlcnMuaW5jbHVkZXMobmV3TWVtYmVySWQpKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lbWJlciBhbHJlYWR5IGluIGdyb3VwJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFkZCB0aGUgbmV3IG1lbWJlciB0byB0aGUgZ3JvdXBcbiAgICAgICAgZ3JvdXAubWVtYmVycy5wdXNoKG5ld01lbWJlcklkKTtcbiAgICAgICAgZ3JvdXAubWVtYmVyUGhvbmVOdW1iZXJzLnB1c2gocGhvbmVOdW1iZXIpO1xuXG4gICAgICAgIC8vIFVwZGF0ZSBhbGwgZXhpc3RpbmcgbWVtYmVycycgZ3JvdXAgZGF0YSwgaW5jbHVkaW5nIHRoZSBzZW5kZXIgYW5kIG5ldyBtZW1iZXJcbiAgICAgICAgZm9yIChjb25zdCBtZW1iZXJJZCBvZiBncm91cC5tZW1iZXJzKSB7XG4gICAgICAgICAgICBsZXQgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuXG4gICAgICAgICAgICBpZiAoIW1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICAgICAgLy8gSWYgdGhlIG1lbWJlciBpcyBuZXcgKG5vIG1lc3NhZ2VzIGRvY3VtZW50KSwgY3JlYXRlIG9uZVxuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IG1lbWJlcklkLFxuICAgICAgICAgICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgaWYgKG1lbWJlckdyb3VwKSB7XG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIGV4aXN0aW5nIGdyb3VwIGRhdGEgZm9yIHRoaXMgbWVtYmVyXG4gICAgICAgICAgICAgICAgbWVtYmVyR3JvdXAubWVtYmVycyA9IGdyb3VwLm1lbWJlcnM7XG4gICAgICAgICAgICAgICAgbWVtYmVyR3JvdXAubWVtYmVyUGhvbmVOdW1iZXJzID0gZ3JvdXAubWVtYmVyUGhvbmVOdW1iZXJzO1xuICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLmF2YXRhciA9IGdyb3VwLmF2YXRhcjsgLy8gRW5zdXJlIGF2YXRhciBpcyBjb3BpZWRcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5jcmVhdG9ySWQgPSBncm91cC5jcmVhdG9ySWQ7IC8vIEVuc3VyZSBjcmVhdG9ySWQgaXMgY29waWVkXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEFkZCB0aGUgZ3JvdXAgdG8gdGhpcyBtZW1iZXIncyBtZXNzYWdlcyBpZiBpdCBkb2Vzblx1MjAxOXQgZXhpc3RcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHsgLi4uZ3JvdXAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNhdmUgb3IgdXBkYXRlIHRoZSBtZW1iZXIncyBtZXNzYWdlc1xuICAgICAgICAgICAgaWYgKG1lbWJlck1lc3NhZ2VzLl9pZCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGdyb3VwIGRhdGEgZm9yIG1lbWJlciAke21lbWJlcklkfWApKSAqL1xuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgZ3JvdXAgZGF0YSBmb3IgbWVtYmVyICR7bWVtYmVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tZXNzYWdlcycsIG1lbWJlck1lc3NhZ2VzKVxuICAgICAgICAgICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgQ3JlYXRlZCBtZXNzYWdlcyBmb3IgbmV3IG1lbWJlciAke21lbWJlcklkfWApKSAqL1xuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgbWVzc2FnZXMgZm9yIG5ldyBtZW1iZXIgJHttZW1iZXJJZH06YCwgZXJyb3IpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdNZW1iZXIgQWRkZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c2VuZGVyUGhvbmVOdW1iZXJ9IGFkZGVkICR7cGhvbmVOdW1iZXJ9IHRvIGdyb3VwICR7Z3JvdXBJZH0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgYWRkaW5nIG1lbWJlciB0byBncm91cDonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgYWRkaW5nIHRoZSBtZW1iZXIgdG8gdGhlIGdyb3VwJyB9KTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpyZW1vdmVNZW1iZXInLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGdyb3VwSWQsIHBob25lTnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgY29uc3QgbWVtYmVySWRUb1JlbW92ZSA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXIpO1xuICAgIGlmICghbWVtYmVySWRUb1JlbW92ZSkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lbWJlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzPy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgaWYgKCFncm91cCB8fCAhZ3JvdXAubWVtYmVycykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCBvciB1bmF1dGhvcml6ZWQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG1lbWJlckluZGV4ID0gZ3JvdXAubWVtYmVycy5pbmRleE9mKG1lbWJlcklkVG9SZW1vdmUpO1xuICAgIGlmIChtZW1iZXJJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdNZW1iZXIgbm90IGluIGdyb3VwJyB9KTtcbiAgICB9XG5cbiAgICBncm91cC5tZW1iZXJzLnNwbGljZShtZW1iZXJJbmRleCwgMSk7XG4gICAgZ3JvdXAubWVtYmVyUGhvbmVOdW1iZXJzLnNwbGljZShtZW1iZXJJbmRleCwgMSk7XG5cbiAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgY29uc3QgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICBjb25zdCBtZW1iZXJHcm91cCA9IG1lbWJlck1lc3NhZ2VzPy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmIChtZW1iZXJHcm91cCkge1xuICAgICAgICAgICAgbWVtYmVyR3JvdXAubWVtYmVycyA9IGdyb3VwLm1lbWJlcnM7XG4gICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJQaG9uZU51bWJlcnMgPSBncm91cC5tZW1iZXJQaG9uZU51bWJlcnM7XG4gICAgICAgICAgICBtZW1iZXJHcm91cC5hdmF0YXIgPSBncm91cC5hdmF0YXI7IC8vIEVuc3VyZSBhdmF0YXIgaXMgY29waWVkXG4gICAgICAgICAgICBtZW1iZXJHcm91cC5jcmVhdG9ySWQgPSBncm91cC5jcmVhdG9ySWQ7IC8vIEVuc3VyZSBjcmVhdG9ySWQgaXMgY29waWVkXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogbWVtYmVyTWVzc2FnZXMuX2lkIH0sIG1lbWJlck1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlbW92ZWRNZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWRUb1JlbW92ZSB9KTtcbiAgICBpZiAocmVtb3ZlZE1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwSW5kZXggPSByZW1vdmVkTWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZEluZGV4KChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmIChncm91cEluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLnNwbGljZShncm91cEluZGV4LCAxKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiByZW1vdmVkTWVtYmVyTWVzc2FnZXMuX2lkIH0sIHJlbW92ZWRNZW1iZXJNZXNzYWdlcyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICB0aXRsZTogJ01lbWJlciBSZW1vdmVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7c2VuZGVyUGhvbmVOdW1iZXJ9IHJlbW92ZWQgJHtwaG9uZU51bWJlcn0gZnJvbSBncm91cCAke2dyb3VwSWR9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpkZWxldGVHcm91cCcsIGFzeW5jIChjbGllbnQsIGdyb3VwSWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICBpZiAoIWdyb3VwIHx8ICFncm91cC5tZW1iZXJzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgdGhlIHNlbmRlciBpcyB0aGUgZ3JvdXAgY3JlYXRvciAoYWRtaW4pXG4gICAgaWYgKGdyb3VwLmNyZWF0b3JJZCAhPT0gc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdPbmx5IHRoZSBncm91cCBjcmVhdG9yIGNhbiBkZWxldGUgdGhlIGdyb3VwJyB9KTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgY29uc3QgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICBjb25zdCBDVlhDUyA9IGF3YWl0IFV0aWxzLkdldFNvdXJjZUZyb21DaXRpemVuSWQobWVtYmVySWQpO1xuICAgICAgICBpZiAoQ1ZYQ1MpIHtcbiAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiTWVzc2FnZXNcIixcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJHcm91cCBoYXMgYmVlbiBkZWxldGVkXCIsXG4gICAgICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgY29uc3QgZ3JvdXBJbmRleCA9IG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmRJbmRleCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgaWYgKGdyb3VwSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuc3BsaWNlKGdyb3VwSW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZ3JvdXBzJyxcbiAgICAgICAgdGl0bGU6ICdHcm91cCBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEdyb3VwICR7Z3JvdXBJZH0gZGVsZXRlZCBieSAke3NlbmRlclBob25lTnVtYmVyfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmdldEdyb3VwTWVzc2FnZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGdyb3VwSWQsIHBhZ2UgPSAxLCBsaW1pdCA9IDIwIH0gPSBKU09OLnBhcnNlKGRhdGEpOyAvLyBBZGQgcGFnZSBhbmQgbGltaXQgZm9yIHBhZ2luYXRpb25cbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ05vIG1lc3NhZ2VzIGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgZ3JvdXBJZD86IHN0cmluZyB9KSA9PlxuICAgICAgICBtc2cudHlwZSA9PT0gJ2dyb3VwJyAmJiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG5cbiAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnQ29udmVyc2F0aW9uIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgLy8gU29ydCBtZXNzYWdlcyBieSB0aW1lc3RhbXAgKGRlc2NlbmRpbmcpIGFuZCBwYWdpbmF0ZVxuICAgIGNvbnN0IHNvcnRlZE1lc3NhZ2VzID0gY29udmVyc2F0aW9uLm1lc3NhZ2VzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PlxuICAgICAgICBuZXcgRGF0ZShiLnRpbWVzdGFtcCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS50aW1lc3RhbXApLmdldFRpbWUoKVxuICAgICk7XG5cbiAgICBjb25zdCBzdGFydEluZGV4ID0gKHBhZ2UgLSAxKSAqIGxpbWl0O1xuICAgIGNvbnN0IGVuZEluZGV4ID0gc3RhcnRJbmRleCArIGxpbWl0O1xuICAgIGNvbnN0IHBhZ2luYXRlZE1lc3NhZ2VzID0gc29ydGVkTWVzc2FnZXMuc2xpY2Uoc3RhcnRJbmRleCwgZW5kSW5kZXgpO1xuXG4gICAgY29uc3QgaGFzTW9yZSA9IGVuZEluZGV4IDwgc29ydGVkTWVzc2FnZXMubGVuZ3RoO1xuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbWVzc2FnZXM6IHBhZ2luYXRlZE1lc3NhZ2VzLFxuICAgICAgICBtZW1iZXJQaG9uZU51bWJlcnM6IGNvbnZlcnNhdGlvbi5tZW1iZXJQaG9uZU51bWJlcnMgfHwgW10sXG4gICAgICAgIG5hbWU6IGNvbnZlcnNhdGlvbi5uYW1lLFxuICAgICAgICBhdmF0YXI6IGNvbnZlcnNhdGlvbi5hdmF0YXIgfHwgbnVsbCxcbiAgICAgICAgaGFzTW9yZTogaGFzTW9yZSxcbiAgICAgICAgdG90YWxNZXNzYWdlczogc29ydGVkTWVzc2FnZXMubGVuZ3RoLFxuICAgICAgICBjcmVhdG9ySWQ6IGNvbnZlcnNhdGlvbi5jcmVhdG9ySWQgLy8gSW5jbHVkZSBjcmVhdG9ySWQgZm9yIFVJIG9yIHZlcmlmaWNhdGlvbiBpZiBuZWVkZWRcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmdldFByaXZhdGVNZXNzYWdlcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgcGhvbmVOdW1iZXIsIHBhZ2UgPSAxLCBsaW1pdCA9IDIwIH0gPSBKU09OLnBhcnNlKGRhdGEpOyAvLyBBZGQgcGFnZSBhbmQgbGltaXQgZm9yIHBhZ2luYXRpb25cbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ05vIG1lc3NhZ2VzIGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgbXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtc2cucGhvbmVOdW1iZXIgPT09IHBob25lTnVtYmVyKTtcblxuICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlczogW10sIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICAvLyBTb3J0IG1lc3NhZ2VzIGJ5IHRpbWVzdGFtcCAoZGVzY2VuZGluZykgYW5kIHBhZ2luYXRlXG4gICAgY29uc3Qgc29ydGVkTWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+XG4gICAgICAgIG5ldyBEYXRlKGIudGltZXN0YW1wKS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLnRpbWVzdGFtcCkuZ2V0VGltZSgpXG4gICAgKTtcblxuICAgIGNvbnN0IHN0YXJ0SW5kZXggPSAocGFnZSAtIDEpICogbGltaXQ7XG4gICAgY29uc3QgZW5kSW5kZXggPSBzdGFydEluZGV4ICsgbGltaXQ7XG4gICAgY29uc3QgcGFnaW5hdGVkTWVzc2FnZXMgPSBzb3J0ZWRNZXNzYWdlcy5zbGljZShzdGFydEluZGV4LCBlbmRJbmRleCk7XG4gICAgY29uc3QgaGFzTW9yZSA9IGVuZEluZGV4IDwgc29ydGVkTWVzc2FnZXMubGVuZ3RoO1xuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbWVzc2FnZXM6IHBhZ2luYXRlZE1lc3NhZ2VzLFxuICAgICAgICBhdmF0YXI6IGNvbnZlcnNhdGlvbi5hdmF0YXIgfHwgbnVsbCxcbiAgICAgICAgbmFtZTogY29udmVyc2F0aW9uLm5hbWUsXG4gICAgICAgIGhhc01vcmU6IGhhc01vcmUsXG4gICAgICAgIHRvdGFsTWVzc2FnZXM6IHNvcnRlZE1lc3NhZ2VzLmxlbmd0aFxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0TWVzc2FnZUNoYW5uZWxzYW5kTGFzdE1lc3NhZ2VzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgICAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdObyBtZXNzYWdlcyBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGFubmVscyA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5tYXAoYXN5bmMgKG1zZzogeyB0eXBlOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcsIGF2YXRhcjogc3RyaW5nLCBncm91cElkPzogc3RyaW5nLCBtZW1iZXJzPzogc3RyaW5nW10sIG1lbWJlclBob25lTnVtYmVycz86IHN0cmluZ1tdLCBtZXNzYWdlczogYW55W10sIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiB7XG4gICAgICAgICAgICBsZXQgdXBkYXRlZE5hbWUgPSBtc2cubmFtZTtcbiAgICAgICAgICAgIGxldCB1cGRhdGVkTWVtYmVyUGhvbmVOdW1iZXJzID0gbXNnLm1lbWJlclBob25lTnVtYmVycyB8fCBbXTtcblxuICAgICAgICAgICAgLy8gSGFuZGxlIHByaXZhdGUgY29udmVyc2F0aW9uc1xuICAgICAgICAgICAgaWYgKG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q29udGFjdE5hbWUgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0TmFtZUJ5TnVtYmVyKG1zZy5waG9uZU51bWJlciwgc2VuZGVySWQpIHx8IGBVbmtub3duICgke21zZy5waG9uZU51bWJlcn0pYDtcbiAgICAgICAgICAgICAgICBpZiAobmV3Q29udGFjdE5hbWUgIT09IG1zZy5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbmFtZSBpbiB0aGUgZGF0YWJhc2UgaWYgaXQgaGFzIGNoYW5nZWRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG06IGFueSkgPT4gbS50eXBlID09PSAncHJpdmF0ZScgJiYgbS5waG9uZU51bWJlciA9PT0gbXNnLnBob25lTnVtYmVyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udmVyc2F0aW9uLm5hbWUgPSBuZXdDb250YWN0TmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0sIHVzZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBjb250YWN0IG5hbWUgZm9yICR7bXNnLnBob25lTnVtYmVyfSB0byAke25ld0NvbnRhY3ROYW1lfWApKSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBjb250YWN0IG5hbWUgZm9yICR7bXNnLnBob25lTnVtYmVyfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZWROYW1lID0gbmV3Q29udGFjdE5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gSGFuZGxlIGdyb3VwIGNvbnZlcnNhdGlvbnNcbiAgICAgICAgICAgIGVsc2UgaWYgKG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5tZW1iZXJQaG9uZU51bWJlcnMgJiYgbXNnLm1lbWJlclBob25lTnVtYmVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtc2cubWVtYmVyUGhvbmVOdW1iZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBob25lID0gbXNnLm1lbWJlclBob25lTnVtYmVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3Q29udGFjdE5hbWUgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0TmFtZUJ5TnVtYmVyKHBob25lLCBzZW5kZXJJZCkgfHwgYFVua25vd24gKCR7cGhvbmV9KWA7XG4gICAgICAgICAgICAgICAgICAgIC8vIFlvdSBjb3VsZCB1cGRhdGUgaW5kaXZpZHVhbCBtZW1iZXIgbmFtZXMgaGVyZSBpZiBuZWVkZWQsIGJ1dCBmb3IgZ3JvdXAgbmFtZSwgd2Uga2VlcCBpdCBhcy1pcyB1bmxlc3Mgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIHlvdSBjb3VsZCBhZ2dyZWdhdGUgbWVtYmVyIG5hbWVzIGludG8gdGhlIGdyb3VwIG5hbWUgaWYgZGVzaXJlZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBtc2cudHlwZSxcbiAgICAgICAgICAgICAgICBuYW1lOiB1cGRhdGVkTmFtZSxcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogbXNnLnBob25lTnVtYmVyLFxuICAgICAgICAgICAgICAgIGdyb3VwSWQ6IG1zZy5ncm91cElkLFxuICAgICAgICAgICAgICAgIG1lbWJlcnM6IG1zZy5tZW1iZXJzLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogbXNnLmF2YXRhcixcbiAgICAgICAgICAgICAgICBtZW1iZXJQaG9uZU51bWJlcnM6IHVwZGF0ZWRNZW1iZXJQaG9uZU51bWJlcnMsXG4gICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IG1zZy5tZXNzYWdlc1ttc2cubWVzc2FnZXMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgY3JlYXRvcklkOiBtc2cuY3JlYXRvcklkIC8vIEluY2x1ZGUgY3JlYXRvcklkXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXYWl0IGZvciBhbGwgcHJvbWlzZXMgdG8gcmVzb2x2ZVxuICAgICAgICBjb25zdCByZXNvbHZlZENoYW5uZWxzID0gYXdhaXQgUHJvbWlzZS5hbGwoY2hhbm5lbHMpO1xuXG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIGNoYW5uZWxzOiByZXNvbHZlZENoYW5uZWxzIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGZldGNoaW5nIG1lc3NhZ2UgY2hhbm5lbHMgYW5kIGxhc3QgbWVzc2FnZXM6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0FuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIG1lc3NhZ2UgY2hhbm5lbHMnIH0pO1xuICAgIH1cbn0pO1xub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpnZXRNZXNzYWdlU3RhdHMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICAgICAgYWxsTWVzc2FnZXM6IDAsXG4gICAgICAgICAgICAgICAga25vd25NZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICB1bmtub3duTWVzc2FnZXM6IDAsXG4gICAgICAgICAgICAgICAgdW5yZWFkTWVzc2FnZXM6IDAsXG4gICAgICAgICAgICAgICAgcmVjZW50bHlEZWxldGVkOiAwXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGN1cnJlbnREYXRlID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCB0aGlydHlEYXlzQWdvID0gbmV3IERhdGUoY3VycmVudERhdGUuZ2V0VGltZSgpIC0gMzAgKiAyNCAqIDYwICogNjAgKiAxMDAwKTsgLy8gMzAgZGF5cyBhZ29cblxuICAgIGxldCBhbGxNZXNzYWdlcyA9IDA7XG4gICAgbGV0IGtub3duTWVzc2FnZXMgPSAwO1xuICAgIGxldCB1bmtub3duTWVzc2FnZXMgPSAwO1xuICAgIGxldCB1bnJlYWRNZXNzYWdlcyA9IDA7XG4gICAgbGV0IHJlY2VudGx5RGVsZXRlZCA9IDA7XG5cbiAgICBmb3IgKGNvbnN0IGNvbnZlcnNhdGlvbiBvZiB1c2VyTWVzc2FnZXMubWVzc2FnZXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBtZXNzYWdlIG9mIGNvbnZlcnNhdGlvbi5tZXNzYWdlcykge1xuICAgICAgICAgICAgYWxsTWVzc2FnZXMgKz0gMTtcblxuICAgICAgICAgICAgY29uc3QgaXNLbm93biA9IGNvbnZlcnNhdGlvbi5uYW1lICYmICFjb252ZXJzYXRpb24ubmFtZS5tYXRjaCgvXlswLTkhQCMkJV4mKigpXytcXC09XFxbXFxde307JzpcIlxcXFx8LC48PlxcLz9dKiQvKTtcbiAgICAgICAgICAgIGlmIChpc0tub3duKSB7XG4gICAgICAgICAgICAgICAga25vd25NZXNzYWdlcyArPSAxO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB1bmtub3duTWVzc2FnZXMgKz0gMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFtZXNzYWdlLnJlYWQpIHtcbiAgICAgICAgICAgICAgICB1bnJlYWRNZXNzYWdlcyArPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHVzZXJNZXNzYWdlcy5kZWxldGVkTWVzc2FnZXMpIHtcbiAgICAgICAgcmVjZW50bHlEZWxldGVkID0gdXNlck1lc3NhZ2VzLmRlbGV0ZWRNZXNzYWdlcy5maWx0ZXIoKGRlbGV0ZWQ6IGFueSkgPT5cbiAgICAgICAgICAgIGRlbGV0ZWQudGltZXN0YW1wID4gdGhpcnR5RGF5c0Fnb1xuICAgICAgICApLmxlbmd0aDtcbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgYWxsTWVzc2FnZXMsXG4gICAgICAgICAgICBrbm93bk1lc3NhZ2VzLFxuICAgICAgICAgICAgdW5rbm93bk1lc3NhZ2VzLFxuICAgICAgICAgICAgdW5yZWFkTWVzc2FnZXMsXG4gICAgICAgICAgICByZWNlbnRseURlbGV0ZWRcbiAgICAgICAgfVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6ZGVsZXRlTWVzc2FnZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgY29udmVyc2F0aW9uVHlwZSwgcGhvbmVOdW1iZXIsIGdyb3VwSWQsIG1lc3NhZ2VJbmRleCB9ID0gSlNPTi5wYXJzZShkYXRhIHx8ICd7fScpO1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG5cbiAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IGNvbnZlcnNhdGlvbjogYW55O1xuICAgIGlmIChjb252ZXJzYXRpb25UeXBlID09PSAncHJpdmF0ZScgJiYgcGhvbmVOdW1iZXIpIHtcbiAgICAgICAgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBOdW1iZXIobXNnLnBob25lTnVtYmVyKSA9PT0gTnVtYmVyKHBob25lTnVtYmVyKVxuICAgICAgICApO1xuICAgIH0gZWxzZSBpZiAoY29udmVyc2F0aW9uVHlwZSA9PT0gJ2dyb3VwJyAmJiBncm91cElkKSB7XG4gICAgICAgIGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IGFueSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIFN0cmluZyhtc2cuZ3JvdXBJZCkgPT09IFN0cmluZyhncm91cElkKVxuICAgICAgICApO1xuICAgIH1cblxuICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQ29udmVyc2F0aW9uIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29udmVyc2F0aW9uLm1lc3NhZ2VzID0gY29udmVyc2F0aW9uLm1lc3NhZ2VzLmZpbHRlcigobXNnOiBhbnkpID0+IE51bWJlcihtc2cucGFnZSkgIT09IE51bWJlcihtZXNzYWdlSW5kZXgpKTtcblxuICAgIC8vIFBlcnNpc3QgbG9jYWwgY2hhbmdlXG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKTtcblxuICAgIC8vIEF0dGVtcHQgcmVtb3RlIGRlbGV0ZSBvbmx5IGZvciBwcml2YXRlIGNvbnZlcnNhdGlvbnMgYW5kIHdoZW4gdGFyZ2V0IGV4aXN0c1xuICAgIGlmIChjb252ZXJzYXRpb25UeXBlID09PSAncHJpdmF0ZScgJiYgcGhvbmVOdW1iZXIpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICh0YXJnZXRDaXRpemVuSWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFNvdXJjZSA9IGF3YWl0IFV0aWxzLkdldFNvdXJjZUZyb21DaXRpemVuSWQodGFyZ2V0Q2l0aXplbklkKTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldE1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0TWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRDb252ZXJzYXRpb24gPSB0YXJnZXRNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IGFueSkgPT5cbiAgICAgICAgICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBOdW1iZXIobXNnLnBob25lTnVtYmVyKSA9PT0gTnVtYmVyKHNlbmRlclBob25lTnVtYmVyKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldENvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXMgPSB0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXMuZmlsdGVyKChtc2c6IGFueSkgPT4gTnVtYmVyKG1zZy5wYWdlKSAhPT0gTnVtYmVyKG1lc3NhZ2VJbmRleCkpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdGFyZ2V0TWVzc2FnZXMuX2lkIH0sIHRhcmdldE1lc3NhZ2VzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF3YWl0IERvZXNQbGF5ZXJFeGlzdCh0YXJnZXRTb3VyY2UpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZV9tZXNzYWdlczpjbGllbnQ6dXBkYXRlTWVzc2FnZXMnLCBOdW1iZXIodGFyZ2V0U291cmNlKSwgSlNPTi5zdHJpbmdpZnkodGFyZ2V0TWVzc2FnZXMpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGVtaXROZXQoJ3Bob25lX21lc3NhZ2VzOmNsaWVudDp1cGRhdGVNZXNzYWdlcycsIE51bWJlcihjbGllbnQpLCBKU09OLnN0cmluZ2lmeSh1c2VyTWVzc2FnZXMpKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX21lc3NhZ2VzJyxcbiAgICAgICAgdGl0bGU6ICdNZXNzYWdlIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTWVzc2FnZSBkZWxldGVkIGZyb20gJHtjb252ZXJzYXRpb25UeXBlfSBjb252ZXJzYXRpb24gd2l0aCAke3Bob25lTnVtYmVyIHx8IGdyb3VwSWR9IGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTp1cGRhdGVHcm91cE5hbWUnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGdyb3VwSWQsIG5ld05hbWUgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuICAgICAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBjcmVhdG9ySWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWdyb3VwKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZ3JvdXAuY3JlYXRvcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdPbmx5IHRoZSBncm91cCBjcmVhdG9yIGNhbiB1cGRhdGUgdGhlIGdyb3VwIG5hbWUnIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9sZE5hbWUgPSBncm91cC5uYW1lO1xuICAgICAgICBncm91cC5uYW1lID0gbmV3TmFtZTtcblxuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMgfHwgW10pIHtcbiAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgIGlmIChtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIGlmIChtZW1iZXJHcm91cCkge1xuICAgICAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5uYW1lID0gbmV3TmFtZTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGdyb3VwIG5hbWUgZm9yIG1lbWJlciAke21lbWJlcklkfWApKSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIG5hbWUgZm9yIG1lbWJlciAke21lbWJlcklkfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgR3JvdXAgbm90IGZvdW5kIGluIG1lbWJlciAke21lbWJlcklkfSdzIG1lc3NhZ2VzYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYE5vIG1lc3NhZ2VzIGZvdW5kIGZvciBtZW1iZXIgJHttZW1iZXJJZH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0sIHVzZXJNZXNzYWdlcylcbiAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGdyb3VwIG5hbWUgZm9yIHNlbmRlciAke3NlbmRlcklkfWApKSAqL1xuICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIG5hbWUgZm9yIHNlbmRlciAke3NlbmRlcklkfTpgLCBlcnJvcikpO1xuXG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ0dyb3VwIE5hbWUgVXBkYXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJHtncm91cElkfSB8ICR7b2xkTmFtZX0gbmFtZSB1cGRhdGVkIHRvICR7bmV3TmFtZX0gYnkgJHtzZW5kZXJQaG9uZU51bWJlcn0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgdXBkYXRpbmcgZ3JvdXAgbmFtZTonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdXBkYXRpbmcgdGhlIGdyb3VwIG5hbWUnIH0pO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnVwZGF0ZUdyb3VwQXZhdGFyJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBncm91cElkLCBuZXdBdmF0YXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuICAgICAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmV0Y2ggdGhlIHNlbmRlcidzIG1lc3NhZ2VzIHRvIGZpbmQgdGhlIGdyb3VwXG4gICAgICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgICAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdNZXNzYWdlcyBub3QgZm91bmQgZm9yIHNlbmRlcicgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBncm91cCA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZywgY3JlYXRvcklkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKCFncm91cCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIHNlbmRlciBpcyB0aGUgZ3JvdXAgY3JlYXRvciAoYWRtaW4pXG4gICAgICAgIGlmIChncm91cC5jcmVhdG9ySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ09ubHkgdGhlIGdyb3VwIGNyZWF0b3IgY2FuIHVwZGF0ZSB0aGUgZ3JvdXAgYXZhdGFyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgZ3JvdXAgYXZhdGFyIGZvciB0aGUgc2VuZGVyXG4gICAgICAgIGdyb3VwLmF2YXRhciA9IG5ld0F2YXRhcjtcblxuICAgICAgICAvLyBVcGRhdGUgdGhlIGdyb3VwIGF2YXRhciBmb3IgYWxsIG1lbWJlcnNcbiAgICAgICAgZm9yIChjb25zdCBtZW1iZXJJZCBvZiBncm91cC5tZW1iZXJzIHx8IFtdKSB7XG4gICAgICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgICAgICBpZiAobWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXJHcm91cCA9IG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgICAgICAgICBpZiAobWVtYmVyR3JvdXApIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtYmVyR3JvdXAuYXZhdGFyID0gbmV3QXZhdGFyO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogbWVtYmVyTWVzc2FnZXMuX2lkIH0sIG1lbWJlck1lc3NhZ2VzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLyogLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgYXZhdGFyIGZvciBtZW1iZXIgJHttZW1iZXJJZH1gKSkgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBncm91cCBhdmF0YXIgZm9yIG1lbWJlciAke21lbWJlcklkfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgR3JvdXAgbm90IGZvdW5kIGluIG1lbWJlciAke21lbWJlcklkfSdzIG1lc3NhZ2VzYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYE5vIG1lc3NhZ2VzIGZvdW5kIGZvciBtZW1iZXIgJHttZW1iZXJJZH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgc2VuZGVyJ3MgbWVzc2FnZXNcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKVxuICAgICAgICAgICAgLyogLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgYXZhdGFyIGZvciBzZW5kZXIgJHtzZW5kZXJJZH1gKSkgKi9cbiAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBncm91cCBhdmF0YXIgZm9yIHNlbmRlciAke3NlbmRlcklkfTpgLCBlcnJvcikpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdHcm91cCBBdmF0YXIgVXBkYXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJHtncm91cElkfSBhdmF0YXIgdXBkYXRlZCBieSAke3NlbmRlclBob25lTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGRhdGluZyBncm91cCBhdmF0YXI6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0FuIGVycm9yIG9jY3VycmVkIHdoaWxlIHVwZGF0aW5nIHRoZSBncm91cCBhdmF0YXInIH0pO1xuICAgIH1cbn0pOyIsICJpbXBvcnQgeyBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFBsYXllckNhbGxIaXN0b3J5IHtcbiAgY2FsbElkOiBudW1iZXI7XG4gIHJvbGU6IFwiY2FsbGVyXCIgfCBcImNhbGxlZVwiO1xuICBteVBob25lTnVtYmVyOiBzdHJpbmc7XG4gIG90aGVyUGFydHlQaG9uZU51bWJlcjogc3RyaW5nO1xuICBzdGF0dXM6IFwidW5hbnN3ZXJlZFwiIHwgXCJtaXNzZWRcIiB8IFwiZGVjbGluZWRcIiB8IFwiY29tcGxldGVkXCI7XG4gIGNhbGxUaW1lOiBudW1iZXI7XG4gIGNhbGxUaW1lc3RhbXA6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIENhbGxIaXN0b3J5TWFuYWdlciB7XG4gIGFzeW5jIHJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoXG4gICAgY2FsbDoge1xuICAgICAgY2FsbElkOiBudW1iZXI7XG4gICAgICBob3N0OiB7IGNpdGl6ZW5JZDogc3RyaW5nOyBwaG9uZU51bWJlcjogc3RyaW5nIH07XG4gICAgICBwYXJ0aWNpcGFudHM6IE1hcDxudW1iZXIsIHsgY2l0aXplbklkOiBzdHJpbmc7IHBob25lTnVtYmVyOiBzdHJpbmc7IG9uSG9sZDogYm9vbGVhbiB9PjtcbiAgICAgIHN0YXJ0VGltZTogRGF0ZTtcbiAgICB9LFxuICAgIGNhbGxlclN0YXR1czogXCJ1bmFuc3dlcmVkXCIgfCBcImRlY2xpbmVkXCIgfCBcImNvbXBsZXRlZFwiLFxuICAgIGNhbGxlZVN0YXR1czogXCJtaXNzZWRcIiB8IFwiZGVjbGluZWRcIiB8IFwiY29tcGxldGVkXCIsXG4gICAgZW5kVGltZTogRGF0ZSxcbiAgICB0YXJnZXRQaG9uZU51bWJlcj86IHN0cmluZ1xuICApIHtcbiAgICBjb25zdCBjYWxsVGltZSA9IChlbmRUaW1lLmdldFRpbWUoKSAtIGNhbGwuc3RhcnRUaW1lLmdldFRpbWUoKSkgLyAxMDAwO1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IGVuZFRpbWUudG9JU09TdHJpbmcoKTtcblxuICAgIC8vIEZpbHRlciBvdXQgdGhlIGhvc3QgZnJvbSBwYXJ0aWNpcGFudHMgdG8gdHJ5IHRvIGdldCB0aGUgY2FsbGVlLlxuICAgIGNvbnN0IGNhbGxlZUFycmF5ID0gQXJyYXkuZnJvbShjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSkuZmlsdGVyKFxuICAgICAgKHBhcnRpY2lwYW50KSA9PiBwYXJ0aWNpcGFudC5waG9uZU51bWJlciAhPT0gY2FsbC5ob3N0LnBob25lTnVtYmVyXG4gICAgKTtcblxuICAgIGxldCBjYWxsZWVQaG9uZTogc3RyaW5nO1xuICAgIGlmIChjYWxsZWVBcnJheS5sZW5ndGggPCAxKSB7XG4gICAgICAvLyBJZiB0aGUgY2FsbGVlIG5ldmVyIGpvaW5lZCwgdXNlIHRoZSBwYXNzZWQgdGFyZ2V0UGhvbmVOdW1iZXIuXG4gICAgICBpZiAodGFyZ2V0UGhvbmVOdW1iZXIpIHtcbiAgICAgICAgY2FsbGVlUGhvbmUgPSB0YXJnZXRQaG9uZU51bWJlcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJObyBjYWxsZWUgZm91bmQgZm9yIHR3by1wYXJ0eSBjYWxsIGFmdGVyIGZpbHRlcmluZyBvdXQgaG9zdFwiKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsZWVQaG9uZSA9IGNhbGxlZUFycmF5WzBdLnBob25lTnVtYmVyO1xuICAgIH1cblxuICAgIGNvbnN0IGNhbGxlclJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IGNhbGwuY2FsbElkLFxuICAgICAgcm9sZTogXCJjYWxsZXJcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IGNhbGwuaG9zdC5waG9uZU51bWJlcixcbiAgICAgIG90aGVyUGFydHlQaG9uZU51bWJlcjogY2FsbGVlUGhvbmUsXG4gICAgICBzdGF0dXM6IGNhbGxlclN0YXR1cyxcbiAgICAgIGNhbGxUaW1lLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG5cbiAgICBjb25zdCBjYWxsZWVSZWNvcmQ6IFBsYXllckNhbGxIaXN0b3J5ID0ge1xuICAgICAgY2FsbElkOiBjYWxsLmNhbGxJZCxcbiAgICAgIHJvbGU6IFwiY2FsbGVlXCIsXG4gICAgICBteVBob25lTnVtYmVyOiBjYWxsZWVQaG9uZSxcbiAgICAgIG90aGVyUGFydHlQaG9uZU51bWJlcjogY2FsbC5ob3N0LnBob25lTnVtYmVyLFxuICAgICAgc3RhdHVzOiBjYWxsZWVTdGF0dXMsXG4gICAgICBjYWxsVGltZSxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlclJlY29yZCk7XG4gICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZWVSZWNvcmQpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiRmFpbGVkIHRvIHJlY29yZCB0d28tcGFydHkgY2FsbCBoaXN0b3J5OlwiLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgZ2V0UGxheWVyQ2FsbEhpc3RvcnkocGhvbmVOdW1iZXI6IHN0cmluZywgbWF4UmVjb3JkczogbnVtYmVyKTogUHJvbWlzZTxQbGF5ZXJDYWxsSGlzdG9yeVtdPiB7XG4gICAgY29uc3QgcXVlcnkgPSB7IG15UGhvbmVOdW1iZXI6IHBob25lTnVtYmVyIH07XG4gICAgY29uc3Qgb3B0aW9ucyA9IHsgc29ydDogeyBfaWQ6IC0xIH0sIGxpbWl0OiBtYXhSZWNvcmRzIH07XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcImNhbGxfaGlzdG9yeVwiLCBxdWVyeSwgKCkgPT4geyB9LCBmYWxzZSwgb3B0aW9ucyk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmV0cmlldmluZyBjYWxsIGhpc3RvcnkgZm9yIHBob25lIG51bWJlcjpcIiwgcGhvbmVOdW1iZXIsIGVycm9yKTtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGNhbGxIaXN0b3J5TWFuYWdlciA9IG5ldyBDYWxsSGlzdG9yeU1hbmFnZXIoKTtcbiIsICJpbXBvcnQgeyBjYWxsSGlzdG9yeU1hbmFnZXIgfSBmcm9tIFwiLi9jYWxsSGlzdG9yeU1hbmFnZXJcIjtcblxuZXhwb3J0IGludGVyZmFjZSBDYWxsUGFydGljaXBhbnQge1xuICAgIHNvdXJjZTogbnVtYmVyO1xuICAgIGNpdGl6ZW5JZDogc3RyaW5nO1xuICAgIHBob25lTnVtYmVyOiBzdHJpbmc7XG4gICAgb25Ib2xkOiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE9uZ29pbmdDYWxsIHtcbiAgICBjYWxsSWQ6IG51bWJlcjtcbiAgICBob3N0OiBDYWxsUGFydGljaXBhbnQ7XG4gICAgcGFydGljaXBhbnRzOiBNYXA8bnVtYmVyLCBDYWxsUGFydGljaXBhbnQ+O1xuICAgIHBlbmRpbmc6IE1hcDxudW1iZXIsIE5vZGVKUy5UaW1lb3V0PjtcbiAgICBzdGFydFRpbWU6IERhdGU7XG59XG5cbmNsYXNzIENhbGxNYW5hZ2VyIHtcbiAgICBwcml2YXRlIGNhbGxzID0gbmV3IE1hcDxudW1iZXIsIE9uZ29pbmdDYWxsPigpO1xuICAgIHByaXZhdGUgcGxheWVyQ2FsbE1hcCA9IG5ldyBNYXA8bnVtYmVyLCBudW1iZXI+KCk7XG4gICAgcHJpdmF0ZSByaW5nVG9uZU1hbmdlciA9IG5ldyBNYXA8bnVtYmVyLCBudW1iZXI+KCk7XG5cbiAgICBwdWJsaWMgY3JlYXRlQ2FsbChob3N0OiBDYWxsUGFydGljaXBhbnQpOiBudW1iZXIge1xuICAgICAgICBjb25zdCBjYWxsSWQgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKTtcbiAgICAgICAgY29uc3QgbmV3Q2FsbDogT25nb2luZ0NhbGwgPSB7XG4gICAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgICBob3N0LFxuICAgICAgICAgICAgcGFydGljaXBhbnRzOiBuZXcgTWFwPG51bWJlciwgQ2FsbFBhcnRpY2lwYW50PigpLFxuICAgICAgICAgICAgcGVuZGluZzogbmV3IE1hcDxudW1iZXIsIE5vZGVKUy5UaW1lb3V0PigpLFxuICAgICAgICAgICAgc3RhcnRUaW1lOiBuZXcgRGF0ZSgpLFxuICAgICAgICB9O1xuICAgICAgICBuZXdDYWxsLnBhcnRpY2lwYW50cy5zZXQoaG9zdC5zb3VyY2UsIGhvc3QpO1xuICAgICAgICB0aGlzLmNhbGxzLnNldChjYWxsSWQsIG5ld0NhbGwpO1xuICAgICAgICB0aGlzLnBsYXllckNhbGxNYXAuc2V0KGhvc3Quc291cmNlLCBjYWxsSWQpO1xuICAgICAgICByZXR1cm4gY2FsbElkO1xuICAgIH1cbiAgICBwdWJsaWMgZ2V0Q2FsbEhvc3QoY2FsbElkOiBudW1iZXIpOiBDYWxsUGFydGljaXBhbnQgfCB1bmRlZmluZWQge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm47XG4gICAgICAgIHJldHVybiBjYWxsLmhvc3Q7XG4gICAgfVxuICAgIHB1YmxpYyBpc1BsYXllckluQ2FsbChzb3VyY2U6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgICAgICByZXR1cm4gdGhpcy5wbGF5ZXJDYWxsTWFwLmhhcyhzb3VyY2UpO1xuICAgIH1cbiAgICBwdWJsaWMgZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZTogbnVtYmVyKTogT25nb2luZ0NhbGwgfCB1bmRlZmluZWQge1xuICAgICAgICBjb25zdCBjYWxsSWQgPSB0aGlzLnBsYXllckNhbGxNYXAuZ2V0KHNvdXJjZSk7XG4gICAgICAgIGlmIChjYWxsSWQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRDYWxsSWRCeVBsYXllcihzb3VyY2U6IG51bWJlcikge1xuICAgICAgICByZXR1cm4gdGhpcy5wbGF5ZXJDYWxsTWFwLmdldChzb3VyY2UpO1xuICAgIH1cbiAgICBwdWJsaWMgYWRkUGVuZGluZ0ludml0YXRpb24oXG4gICAgICAgIGNhbGxJZDogbnVtYmVyLFxuICAgICAgICB0YXJnZXRTb3VyY2U6IG51bWJlcixcbiAgICAgICAgdGltZW91dENhbGxiYWNrOiAoKSA9PiB2b2lkLFxuICAgICAgICB0aW1lb3V0TXM6IG51bWJlciA9IDMwMDAwXG4gICAgKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgaWYgKGNhbGwucGVuZGluZy5oYXModGFyZ2V0U291cmNlKSB8fCBjYWxsLnBhcnRpY2lwYW50cy5oYXModGFyZ2V0U291cmNlKSkgcmV0dXJuO1xuICAgICAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICB0aW1lb3V0Q2FsbGJhY2soKTtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICAgICAgICB9LCB0aW1lb3V0TXMpO1xuICAgICAgICBjYWxsLnBlbmRpbmcuc2V0KHRhcmdldFNvdXJjZSwgdGltZW91dCk7XG4gICAgfVxuICAgIHB1YmxpYyByZW1vdmVQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQ6IG51bWJlciwgdGFyZ2V0U291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuO1xuICAgICAgICBpZiAoY2FsbC5wZW5kaW5nLmhhcyh0YXJnZXRTb3VyY2UpKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoY2FsbC5wZW5kaW5nLmdldCh0YXJnZXRTb3VyY2UpKTtcbiAgICAgICAgICAgIGNhbGwucGVuZGluZy5kZWxldGUodGFyZ2V0U291cmNlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBwdWJsaWMgYWNjZXB0SW52aXRhdGlvbihjYWxsSWQ6IG51bWJlciwgcGFydGljaXBhbnQ6IENhbGxQYXJ0aWNpcGFudCk6IGJvb2xlYW4ge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmIChjYWxsLnBhcnRpY2lwYW50cy5oYXMocGFydGljaXBhbnQuc291cmNlKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjYWxsLnBhcnRpY2lwYW50cy5zZXQocGFydGljaXBhbnQuc291cmNlLCBwYXJ0aWNpcGFudCk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5zZXQocGFydGljaXBhbnQuc291cmNlLCBjYWxsSWQpO1xuICAgICAgICBpZiAoY2FsbC5wZW5kaW5nLmhhcyhwYXJ0aWNpcGFudC5zb3VyY2UpKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQoY2FsbC5wZW5kaW5nLmdldChwYXJ0aWNpcGFudC5zb3VyY2UpKTtcbiAgICAgICAgICAgIGNhbGwucGVuZGluZy5kZWxldGUocGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcHVibGljIGRlY2xpbmVJbnZpdGF0aW9uKGNhbGxJZDogbnVtYmVyLCB0YXJnZXRTb3VyY2U6IG51bWJlcikge1xuICAgICAgICB0aGlzLnJlbW92ZVBlbmRpbmdJbnZpdGF0aW9uKGNhbGxJZCwgdGFyZ2V0U291cmNlKTtcbiAgICB9XG4gICAgcHVibGljIGFzeW5jIHJlbW92ZVBhcnRpY2lwYW50KGNhbGxJZDogbnVtYmVyLCBzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm47XG5cbiAgICAgICAgLy8gTkVXOiBFbmQgYW5pbWF0aW9uIGZvciB0aGUgbGVhdmluZyBwYXJ0aWNpcGFudFxuICAgICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OmVuZENhbGxBbmltYXRpb25cIiwgc291cmNlKTtcblxuICAgICAgICBjYWxsLnBhcnRpY2lwYW50cy5kZWxldGUoc291cmNlKTtcbiAgICAgICAgdGhpcy5wbGF5ZXJDYWxsTWFwLmRlbGV0ZShzb3VyY2UpO1xuICAgICAgICBpZiAoc291cmNlID09PSBjYWxsLmhvc3Quc291cmNlIHx8IGNhbGwucGFydGljaXBhbnRzLnNpemUgPD0gMSkge1xuICAgICAgICAgICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJjb21wbGV0ZWRcIiwgXCJjb21wbGV0ZWRcIiwgbmV3IERhdGUoKSk7XG4gICAgICAgICAgICB0aGlzLmVuZENhbGwoY2FsbElkKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBwdWJsaWMgZW5kQ2FsbChjYWxsSWQ6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm47XG5cbiAgICAgICAgLy8gTkVXOiBFbmQgYW5pbWF0aW9ucyBmb3IgYWxsIHBhcnRpY2lwYW50c1xuICAgICAgICBmb3IgKGNvbnN0IHBhcnRpY2lwYW50IG9mIGNhbGwucGFydGljaXBhbnRzLnZhbHVlcygpKSB7XG4gICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OmVuZENhbGxBbmltYXRpb25cIiwgcGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgdGltZW91dCBvZiBjYWxsLnBlbmRpbmcudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IHBhcnRpY2lwYW50IG9mIGNhbGwucGFydGljaXBhbnRzLnZhbHVlcygpKSB7XG4gICAgICAgICAgICB0aGlzLnBsYXllckNhbGxNYXAuZGVsZXRlKHBhcnRpY2lwYW50LnNvdXJjZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jYWxscy5kZWxldGUoY2FsbElkKTtcbiAgICB9XG4gICAgcHVibGljIHJlbW92ZUZyb21DYWxsKGNhbGxJZDogbnVtYmVyLCBzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm47XG4gICAgICAgIGNhbGwucGFydGljaXBhbnRzLmRlbGV0ZShzb3VyY2UpO1xuICAgICAgICB0aGlzLnBsYXllckNhbGxNYXAuZGVsZXRlKHNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBzZXRIb2xkU3RhdHVzKGNhbGxJZDogbnVtYmVyLCBzb3VyY2U6IG51bWJlciwgaG9sZDogYm9vbGVhbik6IGJvb2xlYW4ge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IHBhcnRpY2lwYW50ID0gY2FsbC5wYXJ0aWNpcGFudHMuZ2V0KHNvdXJjZSk7XG4gICAgICAgIGlmICghcGFydGljaXBhbnQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcGFydGljaXBhbnQub25Ib2xkID0gaG9sZDtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRQYXJ0aWNpcGFudHMoY2FsbElkOiBudW1iZXIpOiBDYWxsUGFydGljaXBhbnRbXSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybiBbXTtcbiAgICAgICAgcmV0dXJuIEFycmF5LmZyb20oY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpO1xuICAgIH1cbiAgICBwdWJsaWMgZ2V0QWxsQ2FsbHMoKTogSXRlcmFibGVJdGVyYXRvcjxPbmdvaW5nQ2FsbD4ge1xuICAgICAgICByZXR1cm4gdGhpcy5jYWxscy52YWx1ZXMoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgY3JlYXRlUmluZ1RvbmUoc291cmNlOiBhbnksIHJpbmd0b25lTGluazogc3RyaW5nLCB2b2x1bWU6IG51bWJlcikge1xuICAgICAgICBjb25zdCBwZWQgPSBHZXRQbGF5ZXJQZWQoc291cmNlKTtcbiAgICAgICAgY29uc3QgcGVkSWQgPSBOZXR3b3JrR2V0TmV0d29ya0lkRnJvbUVudGl0eShwZWQpO1xuICAgICAgICBjb25zdCBzb3VuZElkID0gYXdhaXQgZXhwb3J0c1snc291bmRoYW5kbGVyJ10uU3RhcnRBdHRhY2hTb3VuZChyaW5ndG9uZUxpbmssIHBlZElkLCA1LCBHZXRHYW1lVGltZXIoKSwgdHJ1ZSwgMC4xNSk7XG4gICAgICAgIHRoaXMucmluZ1RvbmVNYW5nZXIuc2V0KHNvdXJjZSwgc291bmRJZCk7XG4gICAgfVxuICAgIHB1YmxpYyBhc3luYyBzdG9wUmluZ1RvbmUoc291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3Qgc291bmRJZCA9IHRoaXMucmluZ1RvbmVNYW5nZXIuZ2V0KHNvdXJjZSk7XG4gICAgICAgIGlmICghc291bmRJZCkgcmV0dXJuO1xuICAgICAgICBleHBvcnRzWydzb3VuZGhhbmRsZXInXS5TdG9wU291bmQoc291bmRJZCk7XG4gICAgICAgIHRoaXMucmluZ1RvbmVNYW5nZXIuZGVsZXRlKHNvdXJjZSk7XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgY2FsbE1hbmFnZXIgPSBuZXcgQ2FsbE1hbmFnZXIoKTsiLCAiaW1wb3J0IHsgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IERlbGF5LCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5jbGFzcyBTZXR0aW5nIHtcbiAgICBwdWJsaWMgX2lkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgYmFja2dyb3VuZCA9IG5ldyBNYXA8c3RyaW5nLCB7IGN1cnJlbnQ6IHN0cmluZzsgd2FsbHBhcGVyczogc3RyaW5nW10gfT4oKTtcbiAgICBwdWJsaWMgbG9ja3NjcmVlbiA9IG5ldyBNYXA8c3RyaW5nLCB7IGN1cnJlbnQ6IHN0cmluZzsgd2FsbHBhcGVyczogc3RyaW5nW10gfT4oKTtcbiAgICBwdWJsaWMgcmluZ3RvbmUgPSBuZXcgTWFwPHN0cmluZywgeyBjdXJyZW50OiBzdHJpbmc7IHJpbmd0b25lczogeyBuYW1lOiBzdHJpbmcsIHVybDogc3RyaW5nIH1bXSB9PigpO1xuICAgIHB1YmxpYyBzaG93U3RhcnR1cFNjcmVlbiA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBzaG93Tm90aWZpY2F0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBpc0xvY2sgPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcbiAgICBwdWJsaWMgbG9ja1BpbiA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgcHVibGljIHVzZVBpbiA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyB1c2VGYWNlSWQgPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcbiAgICBwdWJsaWMgZmFjZUlkSWRlbnRpZmllciA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgcHVibGljIHNtcnRJZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgcHVibGljIHNtcnRQYXNzd29yZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgcHVibGljIGlzRmxpZ2h0TW9kZSA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBwaG9uZU51bWJlciA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgcHVibGljIGRhcmtNYWlsSWRBdHRhY2hlZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgcHVibGljIHBpZ2VvbklkQXR0YWNoZWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIC8vIE5vIGF1dG9tYXRpYyBjbGVhbnVwIC0gb25seSByZW1vdmUgb24gcGxheWVyIGRpc2Nvbm5lY3RcblxuICAgIHByaXZhdGUgc2VlZEZyb21Eb2MoZG9jOiBhbnkpIHtcbiAgICAgICAgaWYgKCFkb2M/Ll9pZCkgcmV0dXJuO1xuICAgICAgICBjb25zdCBpZCA9IGRvYy5faWQ7XG4gICAgICAgIHRoaXMuX2lkLnNldChpZCwgaWQpO1xuICAgICAgICB0aGlzLmJhY2tncm91bmQuc2V0KGlkLCBkb2MuYmFja2dyb3VuZCA/PyB7IGN1cnJlbnQ6ICcnLCB3YWxscGFwZXJzOiBbXSB9KTtcbiAgICAgICAgdGhpcy5sb2Nrc2NyZWVuLnNldChpZCwgZG9jLmxvY2tzY3JlZW4gPz8geyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSk7XG4gICAgICAgIHRoaXMucmluZ3RvbmUuc2V0KGlkLCBkb2MucmluZ3RvbmUgPz8geyBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsIHJpbmd0b25lczogW3sgbmFtZTogJ2RlZmF1bHQnLCB1cmw6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyB9XSB9KTtcbiAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5zZXQoaWQsIGRvYy5zaG93U3RhcnR1cFNjcmVlbiA/PyB0cnVlKTtcbiAgICAgICAgdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5zZXQoaWQsIGRvYy5zaG93Tm90aWZpY2F0aW9ucyA/PyB0cnVlKTtcbiAgICAgICAgdGhpcy5pc0xvY2suc2V0KGlkLCBkb2MuaXNMb2NrID8/IHRydWUpO1xuICAgICAgICB0aGlzLmxvY2tQaW4uc2V0KGlkLCBkb2MubG9ja1BpbiA/PyAnJyk7XG4gICAgICAgIHRoaXMudXNlUGluLnNldChpZCwgZG9jLnVzZVBpbiA/PyBmYWxzZSk7XG4gICAgICAgIHRoaXMudXNlRmFjZUlkLnNldChpZCwgZG9jLnVzZUZhY2VJZCA/PyBmYWxzZSk7XG4gICAgICAgIHRoaXMuZmFjZUlkSWRlbnRpZmllci5zZXQoaWQsIGRvYy5mYWNlSWRJZGVudGlmaWVyID8/IGlkKTtcbiAgICAgICAgdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuc2V0KGlkLCBkb2MuZGFya01haWxJZEF0dGFjaGVkID8/ICcnKTtcbiAgICAgICAgdGhpcy5zbXJ0SWQuc2V0KGlkLCBkb2Muc21ydElkID8/ICcnKTtcbiAgICAgICAgdGhpcy5zbXJ0UGFzc3dvcmQuc2V0KGlkLCBkb2Muc21ydFBhc3N3b3JkID8/ICcnKTtcbiAgICAgICAgdGhpcy5pc0ZsaWdodE1vZGUuc2V0KGlkLCBkb2MuaXNGbGlnaHRNb2RlID8/IGZhbHNlKTtcbiAgICAgICAgdGhpcy5waG9uZU51bWJlci5zZXQoaWQsIGRvYy5waG9uZU51bWJlciA/PyAnJyk7XG4gICAgICAgIHRoaXMucGlnZW9uSWRBdHRhY2hlZC5zZXQoaWQsIGRvYy5waWdlb25JZEF0dGFjaGVkID8/ICcnKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZW5zdXJlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybjtcbiAgICAgICAgaWYgKHRoaXMuX2lkLmhhcyhjaXRpemVuSWQpKSByZXR1cm47XG5cbiAgICAgICAgY29uc3QgZG9jID0gYXdhaXQgTW9uZ29EQi5maW5kT25lPy4oJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKGRvYykge1xuICAgICAgICAgICAgdGhpcy5zZWVkRnJvbURvYyhkb2MpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5SZWdpc3Rlck5ld1NldHRpbmdzKGNpdGl6ZW5JZCwgXCJcIik7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lPy4oJ3Bob25lX3NldHRpbmdzJywge1xuICAgICAgICAgICAgX2lkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0aGlzLmJhY2tncm91bmQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBsb2Nrc2NyZWVuOiB0aGlzLmxvY2tzY3JlZW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICByaW5ndG9uZTogdGhpcy5yaW5ndG9uZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0aGlzLnNob3dTdGFydHVwU2NyZWVuLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgc2hvd05vdGlmaWNhdGlvbnM6IHRoaXMuc2hvd05vdGlmaWNhdGlvbnMuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBpc0xvY2s6IHRoaXMuaXNMb2NrLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgbG9ja1BpbjogdGhpcy5sb2NrUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgdXNlUGluOiB0aGlzLnVzZVBpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHVzZUZhY2VJZDogdGhpcy51c2VGYWNlSWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiB0aGlzLmZhY2VJZElkZW50aWZpZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBkYXJrTWFpbElkQXR0YWNoZWQ6IHRoaXMuZGFya01haWxJZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgc21ydElkOiB0aGlzLnNtcnRJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHNtcnRQYXNzd29yZDogdGhpcy5zbXJ0UGFzc3dvcmQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBpc0ZsaWdodE1vZGU6IHRoaXMuaXNGbGlnaHRNb2RlLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHRoaXMucGhvbmVOdW1iZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBwaWdlb25JZEF0dGFjaGVkOiB0aGlzLnBpZ2VvbklkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBsb2FkKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gTXlTUUwgQWRhcHRlciBsb2dpY1xuICAgICAgICAgICAgY29uc3QgcmVzOiBhbnkgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9zZXR0aW5ncycsIHt9KTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZGF0YSBvZiByZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNlZWRGcm9tRG9jKGRhdGEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIExvYWRlZC5gKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIEZhaWxlZCB0byBsb2FkIHNldHRpbmdzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2F2ZSgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIHRoaXMuX2lkKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGtleSB9LCB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDoga2V5LFxuICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiB0aGlzLmJhY2tncm91bmQuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIGxvY2tzY3JlZW46IHRoaXMubG9ja3NjcmVlbi5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgcmluZ3RvbmU6IHRoaXMucmluZ3RvbmUuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0aGlzLnNob3dTdGFydHVwU2NyZWVuLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgaXNMb2NrOiB0aGlzLmlzTG9jay5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgbG9ja1BpbjogdGhpcy5sb2NrUGluLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICB1c2VQaW46IHRoaXMudXNlUGluLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICB1c2VGYWNlSWQ6IHRoaXMudXNlRmFjZUlkLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiB0aGlzLmZhY2VJZElkZW50aWZpZXIuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHNtcnRJZDogdGhpcy5zbXJ0SWQuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHNtcnRQYXNzd29yZDogdGhpcy5zbXJ0UGFzc3dvcmQuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogdGhpcy5pc0ZsaWdodE1vZGUuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHBob25lTnVtYmVyOiB0aGlzLnBob25lTnVtYmVyLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBwaWdlb25JZEF0dGFjaGVkOiB0aGlzLnBpZ2VvbklkQXR0YWNoZWQuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgc3VjY2Vzc2Z1bGx5LmApO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBGYWlsZWQgdG8gc2F2ZSBzZXR0aW5nczogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIFJlZ2lzdGVyTmV3U2V0dGluZ3MoY2l0aXplbklkOiBzdHJpbmcsIG51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuX2lkLnNldChjaXRpemVuSWQsIGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuYmFja2dyb3VuZC5zZXQoY2l0aXplbklkLCB7IGN1cnJlbnQ6ICcnLCB3YWxscGFwZXJzOiBbXSB9KTtcbiAgICAgICAgdGhpcy5sb2Nrc2NyZWVuLnNldChjaXRpemVuSWQsIHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0pO1xuICAgICAgICB0aGlzLnJpbmd0b25lLnNldChjaXRpemVuSWQsIHsgY3VycmVudDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLCByaW5ndG9uZXM6IFt7IG5hbWU6ICdkZWZhdWx0JywgdXJsOiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycgfV0gfSk7XG4gICAgICAgIHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uc2V0KGNpdGl6ZW5JZCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuc2hvd05vdGlmaWNhdGlvbnMuc2V0KGNpdGl6ZW5JZCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMuaXNMb2NrLnNldChjaXRpemVuSWQsIHRydWUpO1xuICAgICAgICB0aGlzLmxvY2tQaW4uc2V0KGNpdGl6ZW5JZCwgJycpO1xuICAgICAgICB0aGlzLnVzZVBpbi5zZXQoY2l0aXplbklkLCBmYWxzZSk7XG4gICAgICAgIHRoaXMucGhvbmVOdW1iZXIuc2V0KGNpdGl6ZW5JZCwgbnVtYmVyKTtcbiAgICAgICAgdGhpcy51c2VGYWNlSWQuc2V0KGNpdGl6ZW5JZCwgZmFsc2UpO1xuICAgICAgICB0aGlzLmZhY2VJZElkZW50aWZpZXIuc2V0KGNpdGl6ZW5JZCwgY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuc2V0KGNpdGl6ZW5JZCwgJycpO1xuICAgICAgICB0aGlzLnNtcnRJZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMuc21ydFBhc3N3b3JkLnNldChjaXRpemVuSWQsICcnKTtcbiAgICAgICAgdGhpcy5pc0ZsaWdodE1vZGUuc2V0KGNpdGl6ZW5JZCwgZmFsc2UpO1xuICAgICAgICB0aGlzLnBpZ2VvbklkQXR0YWNoZWQuc2V0KGNpdGl6ZW5JZCwgJycpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBTYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuZW5zdXJlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBjaXRpemVuSWQgfSwge1xuICAgICAgICAgICAgICAgIF9pZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRoaXMuYmFja2dyb3VuZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBsb2Nrc2NyZWVuOiB0aGlzLmxvY2tzY3JlZW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgcmluZ3RvbmU6IHRoaXMucmluZ3RvbmUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgc2hvd05vdGlmaWNhdGlvbnM6IHRoaXMuc2hvd05vdGlmaWNhdGlvbnMuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgaXNMb2NrOiB0aGlzLmlzTG9jay5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBsb2NrUGluOiB0aGlzLmxvY2tQaW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgdXNlUGluOiB0aGlzLnVzZVBpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICB1c2VGYWNlSWQ6IHRoaXMudXNlRmFjZUlkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IHRoaXMuZmFjZUlkSWRlbnRpZmllci5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBkYXJrTWFpbElkQXR0YWNoZWQ6IHRoaXMuZGFya01haWxJZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHNtcnRJZDogdGhpcy5zbXJ0SWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgc21ydFBhc3N3b3JkOiB0aGlzLnNtcnRQYXNzd29yZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBpc0ZsaWdodE1vZGU6IHRoaXMuaXNGbGlnaHRNb2RlLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHBob25lTnVtYmVyOiB0aGlzLnBob25lTnVtYmVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IHRoaXMucGlnZW9uSWRBdHRhY2hlZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIFNhdmVkIHBsYXllciBzZXR0aW5ncyBmb3IgJHtjaXRpemVuSWR9IHN1Y2Nlc3NmdWxseS5gKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gRmFpbGVkIHRvIHNhdmUgcGxheWVyIHNldHRpbmdzIGZvciAke2NpdGl6ZW5JZH06ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlbW92ZSBwbGF5ZXIgZGF0YSBvbmx5IHdoZW4gcGxheWVyIGRpc2Nvbm5lY3RzXG4gICAgcHVibGljIG9uUGxheWVyRGlzY29ubmVjdChjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICB0aGlzLnJlbW92ZVBsYXllckRhdGEoY2l0aXplbklkKTtcbiAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIENsZWFuZWQgdXAgZGF0YSBmb3IgZGlzY29ubmVjdGVkIHBsYXllciAke2NpdGl6ZW5JZH1gKTtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgcGxheWVyIGRhdGEgZnJvbSBhbGwgbWFwc1xuICAgIHByaXZhdGUgcmVtb3ZlUGxheWVyRGF0YShjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICB0aGlzLl9pZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmxvY2tzY3JlZW4uZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMucmluZ3RvbmUuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuc2hvd05vdGlmaWNhdGlvbnMuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuaXNMb2NrLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmxvY2tQaW4uZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMudXNlUGluLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnVzZUZhY2VJZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5mYWNlSWRJZGVudGlmaWVyLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnNtcnRJZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zbXJ0UGFzc3dvcmQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuaXNGbGlnaHRNb2RlLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnBob25lTnVtYmVyLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5waWdlb25JZEF0dGFjaGVkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgIH1cblxuICAgIC8vIFB1YmxpYyBtZXRob2QgdG8gbWFudWFsbHkgY2xlYW4gdXAgYSBzcGVjaWZpYyBwbGF5ZXIgKGZvciBhZG1pbiBjb21tYW5kcylcbiAgICBwdWJsaWMgY2xlYW51cFBsYXllcihjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICB0aGlzLnJlbW92ZVBsYXllckRhdGEoY2l0aXplbklkKTtcbiAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIE1hbnVhbGx5IGNsZWFuZWQgdXAgZGF0YSBmb3IgcGxheWVyICR7Y2l0aXplbklkfWApO1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IFNldHRpbmdzID0gbmV3IFNldHRpbmcoKTtcbiIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBjYWxsTWFuYWdlciB9IGZyb20gXCIuL0NhbGxNYW5hZ2VyXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IE1vbmdvREIsIExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFBob25lQ29udGFjdHMgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IGNhbGxIaXN0b3J5TWFuYWdlciwgUGxheWVyQ2FsbEhpc3RvcnkgfSBmcm9tIFwiLi9jYWxsSGlzdG9yeU1hbmFnZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL1NldHRpbmdzL2NsYXNzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCJcblxub25DbGllbnRDYWxsYmFjayhcInN1bW1pdF9waG9uZTpzZXJ2ZXI6Y2FsbFwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCB7IG51bWJlciwgX2lkLCB2b2x1bWUgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IFV0aWxzLkdldFBsYXllckZyb21QaG9uZU51bWJlcihudW1iZXIpO1xuICBjb25zdCB0YXJnZXREYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogbnVtYmVyLCBwZXJzb25hbE51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpIH0pO1xuXG4gIGNvbnN0IHNvdXJjZURhdGE6IFBob25lQ29udGFjdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywge1xuICAgIGNvbnRhY3ROdW1iZXI6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKSxcbiAgICBwZXJzb25hbE51bWJlcjogbnVtYmVyXG4gIH0pO1xuXG4gIGlmICghdGFyZ2V0UGxheWVyKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgIGNvbnN0IGNhbGxlclJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApLFxuICAgICAgcm9sZTogXCJjYWxsZXJcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKSxcbiAgICAgIG90aGVyUGFydHlQaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgc3RhdHVzOiBcInVuYW5zd2VyZWRcIixcbiAgICAgIGNhbGxUaW1lOiAwLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG5cbiAgICBjb25zdCBjYWxsZWVSZWNvcmQ6IFBsYXllckNhbGxIaXN0b3J5ID0ge1xuICAgICAgY2FsbElkOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKSxcbiAgICAgIHJvbGU6IFwiY2FsbGVlXCIsXG4gICAgICBteVBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKSxcbiAgICAgIHN0YXR1czogXCJtaXNzZWRcIixcbiAgICAgIGNhbGxUaW1lOiAwLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG4gICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVyUmVjb3JkKTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZWVSZWNvcmQpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHRhcmdldFNvdXJjZSA9IHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZTtcblxuICBpZiAoY2FsbE1hbmFnZXIuaXNQbGF5ZXJJbkNhbGwoc291cmNlKSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgYXJlIGFscmVhZHkgaW4gYSBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChjYWxsTWFuYWdlci5pc1BsYXllckluQ2FsbCh0YXJnZXRTb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgQnVzeVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiVGFyZ2V0IGlzIGFscmVhZHkgaW4gYSBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHNvdXJjZVBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3Qgc291cmNlQ2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IElzTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZCh0YXJnZXRQaG9uZSwgc291cmNlUGhvbmUpO1xuICBjb25zdCBzb3VyY2VGbGlnaHRNb2RlID0gYXdhaXQgVXRpbHMuSW5GbGlnaHRNb2RlKHNvdXJjZUNpdGl6ZW5JZCk7XG4gIGNvbnN0IHRhcmdldEZsaWdodE1vZGUgPSBhd2FpdCBVdGlscy5JbkZsaWdodE1vZGUodGFyZ2V0Q2l0aXplbklkKTtcbiAgaWYgKHNvdXJjZUZsaWdodE1vZGUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiRmxpZ2h0IE1vZGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBjYW5ub3QgbWFrZSBjYWxscyB3aGlsZSBpbiBmbGlnaHQgbW9kZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSBpZiAodGFyZ2V0RmxpZ2h0TW9kZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyB1bnJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKElzTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBTaG91cmNlTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChzb3VyY2VQaG9uZSwgdGFyZ2V0UGhvbmUpO1xuICBpZiAoU2hvdXJjZU51bWJlckJsb2NrZWQpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTnVtYmVyIEJsb2NrZWRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlVuYmxvY2sgdGhlIG51bWJlciB0byBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB0YXJnZXRIYXNQaG9uZSA9IGF3YWl0IFV0aWxzLkhhc1Bob25lKHRhcmdldFNvdXJjZSk7XG4gIGlmICghdGFyZ2V0SGFzUGhvbmUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICBjb25zdCBjYWxsZXJSZWNvcmQ6IFBsYXllckNhbGxIaXN0b3J5ID0ge1xuICAgICAgY2FsbElkOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKSxcbiAgICAgIHJvbGU6IFwiY2FsbGVyXCIsXG4gICAgICBteVBob25lTnVtYmVyOiBzb3VyY2VQaG9uZSxcbiAgICAgIG90aGVyUGFydHlQaG9uZU51bWJlcjogdGFyZ2V0UGhvbmUsXG4gICAgICBzdGF0dXM6IFwidW5hbnN3ZXJlZFwiLFxuICAgICAgY2FsbFRpbWU6IDAsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcblxuICAgIGNvbnN0IGNhbGxlZVJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApLFxuICAgICAgcm9sZTogXCJjYWxsZWVcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBzb3VyY2VQaG9uZSxcbiAgICAgIHN0YXR1czogXCJtaXNzZWRcIixcbiAgICAgIGNhbGxUaW1lOiAwLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG4gICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVyUmVjb3JkKTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZWVSZWNvcmQpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBob3N0UGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlLFxuICAgIGNpdGl6ZW5JZDogc291cmNlQ2l0aXplbklkLFxuICAgIHBob25lTnVtYmVyOiBzb3VyY2VQaG9uZSxcbiAgICBvbkhvbGQ6IGZhbHNlLFxuICB9O1xuXG4gIGNvbnN0IGNhbGxJZCA9IGNhbGxNYW5hZ2VyLmNyZWF0ZUNhbGwoaG9zdFBhcnRpY2lwYW50KTtcblxuICBjYWxsTWFuYWdlci5jcmVhdGVSaW5nVG9uZSh0YXJnZXRTb3VyY2UsIFN0cmluZyhTZXR0aW5ncy5yaW5ndG9uZS5nZXQodGFyZ2V0Q2l0aXplbklkKT8uY3VycmVudCksIHZvbHVtZSk7XG4gIGNhbGxNYW5hZ2VyLmFkZFBlbmRpbmdJbnZpdGF0aW9uKGNhbGxJZCwgdGFyZ2V0U291cmNlLCAoKSA9PiB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgVGltZW91dFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ2FsbCB3YXMgbm90IGFuc3dlcmVkIGJ5IHRhcmdldFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTWlzc2VkIENhbGxcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBtaXNzZWQgYSBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gICAgICBpZiAoY2FsbCkge1xuICAgICAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcInVuYW5zd2VyZWRcIiwgXCJtaXNzZWRcIiwgbmV3IERhdGUoKSwgdGFyZ2V0UGhvbmUpO1xuICAgICAgfVxuICAgICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gICAgfSkoKTtcbiAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwoc291cmNlLCAwKTtcbiAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwodGFyZ2V0U291cmNlLCAwKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIF9pZCk7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gIH0sIDIwMDAwKTtcblxuICBjb25zdCBzb3VyY2VOYW1lID0gc291cmNlRGF0YSA/IGAke3NvdXJjZURhdGEuZmlyc3ROYW1lfSAke3NvdXJjZURhdGEubGFzdE5hbWV9YCA6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0TmFtZSA9IHRhcmdldERhdGEgPyBgJHt0YXJnZXREYXRhLmZpcnN0TmFtZX0gJHt0YXJnZXREYXRhLmxhc3ROYW1lfWAgOiBudW1iZXI7XG5cbiAgZW1pdE5ldChcInBob25lOmFkZEFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBpZDogX2lkLFxuICAgIHRpdGxlOiBcIkluY29taW5nIENhbGxcIixcbiAgICBkZXNjcmlwdGlvbjogYCR7c291cmNlTmFtZX0gaXMgY2FsbGluZyB5b3VgLFxuICAgIGFwcDogXCJwaG9uZVwiLFxuICAgIGljb25zOiB7XG4gICAgICBcIjBcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2Nyb3NzLWNpcmNsZS5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIFwiMVwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvYWNjZXB0LnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmFjY2VwdENhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgc291cmNlTmFtZTogdGFyZ2V0TmFtZSxcbiAgICAgICAgICB0YXJnZXROYW1lOiBzb3VyY2VOYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogX2lkLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSkpO1xuXG4gIC8qIGNvbnNvbGUubG9nKHNvdXJjZSwgXCJDYWxsaW5nXCIsIHRhcmdldFNvdXJjZSwgdGFyZ2V0TmFtZSwgX2lkKTsgKi9cbiAgZW1pdE5ldChcInN1bW1pdF9waG9uZTpzZXJ2ZXI6YWRkQ2FsbGluZ2ludGVyZmFjZVwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHRhcmdldE5hbWUsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gIH0pKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ0NhbGwgSW5pdGlhdGVkJyxcbiAgICBtZXNzYWdlOiBgJHtzb3VyY2VQaG9uZX0gaW5pdGlhdGVkIGEgY2FsbCB0byAke3RhcmdldFBob25lfSAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgfSk7XG4gIHJldHVybiB0cnVlO1xufSk7XG5cbm9uTmV0KFwic3VtbWl0X3Bob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLCBhc3luYyAoZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHNvdXJjZSA9IGdsb2JhbC5zb3VyY2UgYXMgbnVtYmVyO1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgLyogY29uc29sZS5sb2coc291cmNlLCBcIkRlY2xpbmluZyBjYWxsXCIsIGNhbGxJZCwgdGFyZ2V0U291cmNlLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCk7ICovXG4gIGNhbGxNYW5hZ2VyLmRlY2xpbmVJbnZpdGF0aW9uKGNhbGxJZCwgdGFyZ2V0U291cmNlKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihjYWxsZXJTb3VyY2UpO1xuICBpZiAoY2FsbCkge1xuICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiZGVjbGluZWRcIiwgXCJkZWNsaW5lZFwiLCBuZXcgRGF0ZSgpKTtcbiAgfVxuICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICBpZiAoIXRhcmdldFNvdXJjZSB8fCAhY2FsbGVyU291cmNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIGNhbGxlclNvdXJjZSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgdGl0bGU6ICdDYWxsIERlY2xpbmVkJyxcbiAgICBtZXNzYWdlOiBgJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9IGRlY2xpbmVkIHRoZSBjYWxsIGZyb20gJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNhbGxlclNvdXJjZSl9IChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwic3VtbWl0X3Bob25lOnNlcnZlcjplbmRDYWxsXCIsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHsgY2FsbElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gIGlmICghY2FsbCB8fCBjYWxsLmNhbGxJZCAhPT0gY2FsbElkKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGNhbGxIb3N0ID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEhvc3QoY2FsbElkKTtcbiAgaWYgKGNhbGxIb3N0ICYmIGNhbGxIb3N0LnNvdXJjZSA9PT0gc291cmNlIHx8IGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpLmxlbmd0aCA8PSAxKSB7XG4gICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY2NwZXRlZENhbGxpbmdJbnRlcmZhY2VcIiwgcGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChwYXJ0aWNpcGFudC5zb3VyY2UsIDApO1xuICAgIH1cbiAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpKTtcbiAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgICAgdGl0bGU6ICdDYWxsIEVuZGVkJyxcbiAgICAgIG1lc3NhZ2U6IGBDYWxsIGVuZGVkIGJ5ICR7YXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpfSAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICB9IGVsc2UgaWYgKGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpLmxlbmd0aCA+IDIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjY3BldGVkQ2FsbGluZ0ludGVyZmFjZVwiLCBzb3VyY2UpO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQ2FsbGluZ0ludGVyZmFjZVwiLCBzb3VyY2UpO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgIGNhbGxNYW5hZ2VyLnJlbW92ZUZyb21DYWxsKGNhbGxJZCwgc291cmNlKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgICB0aXRsZTogJ1BhcnRpY2lwYW50IExlZnQgQ2FsbCcsXG4gICAgICBtZXNzYWdlOiBgJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSl9IGxlZnQgdGhlIGNvbmZlcmVuY2UgY2FsbCAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkpIHtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWNjcGV0ZWRDYWxsaW5nSW50ZXJmYWNlXCIsIHBhcnRpY2lwYW50LnNvdXJjZSk7XG4gICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwocGFydGljaXBhbnQuc291cmNlLCAwKTtcbiAgICB9XG4gICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJjb21wbGV0ZWRcIiwgXCJjb21wbGV0ZWRcIiwgbmV3IERhdGUoKSk7XG4gICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICAgIHRpdGxlOiAnQ2FsbCBFbmRlZCcsXG4gICAgICBtZXNzYWdlOiBgQ2FsbCBlbmRlZCBieSAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKX0gKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwic3VtbWl0X3Bob25lOnNlcnZlcjphZGRQbGF5ZXJUb0NhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBjb250YWN0TnVtYmVyLCBfaWQsIHZvbHVtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgdGFyZ2V0RGF0YTogUGhvbmVDb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZCB9KTtcbiAgY29uc3Qgc291cmNlRGF0YTogUGhvbmVDb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7XG4gICAgY29udGFjdE51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpLFxuICAgIHBlcnNvbmFsTnVtYmVyOiBjb250YWN0TnVtYmVyXG4gIH0pO1xuICBjb25zdCBjYWxsSWQgPSBjYWxsTWFuYWdlci5nZXRDYWxsSWRCeVBsYXllcihzb3VyY2UpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gIGlmICghY2FsbCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJObyBvbmdvaW5nIGNhbGwgZm91bmRcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHNvdXJjZVBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJGcm9tUGhvbmVOdW1iZXIoY29udGFjdE51bWJlcik7XG4gIGlmICghdGFyZ2V0UGxheWVyKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBhZGQgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgdGFyZ2V0U291cmNlID0gdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlO1xuICBjb25zdCBJc051bWJlckJsb2NrZWQgPSBhd2FpdCBVdGlscy5Jc051bWJlckJsb2NrZWQoY29udGFjdE51bWJlciwgc291cmNlUGhvbmUpO1xuICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIoY29udGFjdE51bWJlcik7XG4gIGNvbnN0IHNvdXJjZUZsaWdodE1vZGUgPSBhd2FpdCBVdGlscy5JbkZsaWdodE1vZGUoc291cmNlQ2l0aXplbklkKTtcbiAgY29uc3QgdGFyZ2V0RmxpZ2h0TW9kZSA9IGF3YWl0IFV0aWxzLkluRmxpZ2h0TW9kZSh0YXJnZXRDaXRpemVuSWQpO1xuICBpZiAoc291cmNlRmxpZ2h0TW9kZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJGbGlnaHQgTW9kZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IGNhbm5vdCBtYWtlIGNhbGxzIHdoaWxlIGluIGZsaWdodCBtb2RlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSBlbHNlIGlmICh0YXJnZXRGbGlnaHRNb2RlKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIHVucmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoSXNOdW1iZXJCbG9ja2VkKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IFNob3VyY2VOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHNvdXJjZVBob25lLCBjb250YWN0TnVtYmVyKTtcbiAgaWYgKFNob3VyY2VOdW1iZXJCbG9ja2VkKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk51bWJlciBCbG9ja2VkXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJVbmJsb2NrIHRoZSBudW1iZXIgdG8gY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgdGFyZ2V0SGFzUGhvbmUgPSBhd2FpdCBVdGlscy5IYXNQaG9uZSh0YXJnZXRTb3VyY2UpO1xuICBpZiAoIXRhcmdldEhhc1Bob25lKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChjYWxsLnBhcnRpY2lwYW50cy5oYXModGFyZ2V0U291cmNlKSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJBbHJlYWR5IGluIENhbGxcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBsYXllciBpcyBhbHJlYWR5IGluIHRoZSBjYWxsXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjYWxsTWFuYWdlci5jcmVhdGVSaW5nVG9uZSh0YXJnZXRTb3VyY2UsIFN0cmluZyhTZXR0aW5ncy5yaW5ndG9uZS5nZXQodGFyZ2V0Q2l0aXplbklkKT8uY3VycmVudCksIHZvbHVtZSk7XG4gIGNhbGxNYW5hZ2VyLmFkZFBlbmRpbmdJbnZpdGF0aW9uKE51bWJlcihjYWxsSWQpLCB0YXJnZXRTb3VyY2UsICgpID0+IHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBUaW1lb3V0XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQbGF5ZXIgZGlkIG5vdCBhbnN3ZXIgY29uZmVyZW5jZSBjYWxsIGludml0YXRpb25cIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIH0sIDMwMDAwKTtcblxuICBjb25zdCBzb3VyY2VOYW1lID0gc291cmNlRGF0YVxuICAgID8gYCR7c291cmNlRGF0YS5maXJzdE5hbWV9ICR7c291cmNlRGF0YS5sYXN0TmFtZX1gXG4gICAgOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldE5hbWUgPSB0YXJnZXREYXRhID8gYCR7dGFyZ2V0RGF0YS5maXJzdE5hbWV9ICR7dGFyZ2V0RGF0YS5sYXN0TmFtZX1gIDogY29udGFjdE51bWJlcjtcblxuICBlbWl0TmV0KFwicGhvbmU6YWRkQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGlkOiBfaWQsXG4gICAgdGl0bGU6IFwiSW5jb21pbmcgQ29uZmVyZW5jZSBDYWxsXCIsXG4gICAgZGVzY3JpcHRpb246IGAke3NvdXJjZU5hbWV9IGlzIGFkZGluZyB5b3UgdG8gYSBjb25mZXJlbmNlIGNhbGxgLFxuICAgIGFwcDogXCJwaG9uZVwiLFxuICAgIGljb25zOiB7XG4gICAgICBcIjBcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2Nyb3NzLWNpcmNsZS5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkOiBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHRhcmdldE5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIFwiMVwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvYWNjZXB0LnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmFjY2VwdENvbmZlcmVuY2VDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQ6IGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgc291cmNlTmFtZTogdGFyZ2V0TmFtZSxcbiAgICAgICAgICB0YXJnZXROYW1lOiBzb3VyY2VOYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogX2lkLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSkpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgIHRpdGxlOiAnUGxheWVyIEFkZGVkIHRvIENhbGwnLFxuICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBob25lfSBhZGRlZCAke2NvbnRhY3ROdW1iZXJ9IHRvIGNvbmZlcmVuY2UgY2FsbCAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgfSk7XG4gIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJwaG9uZTpzZXJ2ZXI6Z2V0Q2FsbEhpc3RvcnlcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBtYXhSZWNvcmRzWDogbnVtYmVyKSA9PiB7XG4gIGxldCBtYXhSZWNvcmRzID0gMTAwO1xuICB0cnkge1xuICAgIGlmIChtYXhSZWNvcmRzWCkge1xuICAgICAgbWF4UmVjb3JkcyA9IG1heFJlY29yZHNYO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcGFyc2luZyBnZXRDYWxsSGlzdG9yeSBkYXRhXCIsIGVycm9yKTtcbiAgfVxuXG4gIGNvbnN0IHBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgaGlzdG9yeSA9IGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5nZXRQbGF5ZXJDYWxsSGlzdG9yeShwaG9uZU51bWJlciwgbWF4UmVjb3Jkcyk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGhpc3RvcnkpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciByZXRyaWV2aW5nIGNhbGwgaGlzdG9yeSBmb3IgcGhvbmUgbnVtYmVyOlwiLCBwaG9uZU51bWJlciwgZXJyb3IpO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShbXSk7XG4gIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZTpzZXJ2ZXI6Z2V0RGF0YUZyb21EQndpdGhOdW1iZXInLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCBwYXJzZWREYXRhOiB7XG4gICAgbnVtYmVyOiBzdHJpbmcsXG4gICAgY2l0aXplbklkOiBzdHJpbmcsXG4gIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBjb250YWN0TnVtYmVyOiBwYXJzZWREYXRhLm51bWJlciwgb3duZXJJZDogcGFyc2VkRGF0YS5jaXRpemVuSWQgfSk7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lOnNlcnZlcjp0b2dnbGVCbG9ja051bWJlcicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBhcnNlZERhdGE6IFBob25lQ29udGFjdHMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCBwZXJzb25hbE51bWJlciA9IHBhcnNlZERhdGEucGVyc29uYWxOdW1iZXI7XG4gIGNvbnN0IGNvbnRhY3ROdW1iZXIgPSBwYXJzZWREYXRhLmNvbnRhY3ROdW1iZXI7XG4gIGxldCBJc051bWJlckJsb2NrZWQgPSBhd2FpdCBVdGlscy5Jc051bWJlckJsb2NrZWQocGVyc29uYWxOdW1iZXIsIGNvbnRhY3ROdW1iZXIpO1xuICBpZiAoIUlzTnVtYmVyQmxvY2tlZCkge1xuICAgIGF3YWl0IFV0aWxzLkJsb2NrTnVtYmVyKHBlcnNvbmFsTnVtYmVyLCBjb250YWN0TnVtYmVyKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTnVtYmVyIEJsb2NrZWRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIk51bWJlciBoYXMgYmVlbiBibG9ja2VkXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiB0cnVlO1xuICB9IGVsc2Uge1xuICAgIGF3YWl0IFV0aWxzLlVuYmxvY2tOdW1iZXIocGVyc29uYWxOdW1iZXIsIGNvbnRhY3ROdW1iZXIpO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJOdW1iZXIgVW5ibG9ja2VkXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJOdW1iZXIgaGFzIGJlZW4gdW5ibG9ja2VkXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmphaWxDYWxsXCIsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHsgbnVtYmVyLCB2b2x1bWUgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IFV0aWxzLkdldFBsYXllckZyb21QaG9uZU51bWJlcihudW1iZXIpO1xuXG4gIC8vIEZvciBqYWlsIGNhbGxzLCB3ZSBkb24ndCBuZWVkIHRvIGNoZWNrIGlmIHRoZSBjYWxsZXIgaGFzIGEgcGhvbmVcbiAgLy8gV2UgYWxzbyBkb24ndCBuZWVkIHRvIGNoZWNrIGZsaWdodCBtb2RlIHNpbmNlIGl0J3MgYSBqYWlsIHBob25lXG5cbiAgaWYgKCF0YXJnZXRQbGF5ZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCB0YXJnZXRTb3VyY2UgPSB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2U7XG5cbiAgaWYgKGNhbGxNYW5hZ2VyLmlzUGxheWVySW5DYWxsKHNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IGFyZSBhbHJlYWR5IGluIGEgY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoY2FsbE1hbmFnZXIuaXNQbGF5ZXJJbkNhbGwodGFyZ2V0U291cmNlKSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEJ1c3lcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlRhcmdldCBpcyBhbHJlYWR5IGluIGEgY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBzb3VyY2VQaG9uZSA9IFwiSkFJTF9QSE9ORVwiOyAvLyBTcGVjaWFsIGlkZW50aWZpZXIgZm9yIGphaWwgcGhvbmUgY2FsbHNcbiAgY29uc3QgdGFyZ2V0UGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHNvdXJjZUNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuXG4gIC8vIEZvciBqYWlsIGNhbGxzLCB3ZSBkb24ndCBjaGVjayBibG9ja2VkIG51bWJlcnMgb3IgZmxpZ2h0IG1vZGVcbiAgLy8gVGhpcyBhbGxvd3MgaW5jYXJjZXJhdGVkIHBsYXllcnMgdG8gbWFrZSBjYWxscyBldmVuIGlmIHRoZXkncmUgYmxvY2tlZFxuXG4gIGNvbnN0IHRhcmdldEhhc1Bob25lID0gYXdhaXQgVXRpbHMuSGFzUGhvbmUodGFyZ2V0U291cmNlKTtcbiAgaWYgKCF0YXJnZXRIYXNQaG9uZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IGhvc3RQYXJ0aWNpcGFudCA9IHtcbiAgICBzb3VyY2UsXG4gICAgY2l0aXplbklkOiBzb3VyY2VDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgY2FsbElkID0gY2FsbE1hbmFnZXIuY3JlYXRlQ2FsbChob3N0UGFydGljaXBhbnQpO1xuXG4gIGNhbGxNYW5hZ2VyLmNyZWF0ZVJpbmdUb25lKHRhcmdldFNvdXJjZSwgU3RyaW5nKFNldHRpbmdzLnJpbmd0b25lLmdldCh0YXJnZXRDaXRpemVuSWQpPy5jdXJyZW50KSwgdm9sdW1lKTtcblxuICAvLyBKYWlsIGNhbGxzIGhhdmUgYSBzaG9ydGVyIHRpbWVvdXQgKDE1IG1pbnV0ZXMgaW5zdGVhZCBvZiAyMClcbiAgY2FsbE1hbmFnZXIuYWRkUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UsICgpID0+IHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBUaW1lb3V0XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDYWxsIHdhcyBub3QgYW5zd2VyZWQgYnkgdGFyZ2V0XCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJNaXNzZWQgQ2FsbFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IG1pc3NlZCBhIGNhbGwgZnJvbSBKQUlMXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gICAgICBpZiAoY2FsbCkge1xuICAgICAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcInVuYW5zd2VyZWRcIiwgXCJtaXNzZWRcIiwgbmV3IERhdGUoKSwgdGFyZ2V0UGhvbmUpO1xuICAgICAgfVxuICAgICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gICAgfSkoKTtcbiAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwoc291cmNlLCAwKTtcbiAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwodGFyZ2V0U291cmNlLCAwKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIFwiamFpbF9jYWxsXCIpO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQ2FsbGluZ0ludGVyZmFjZVwiLCBzb3VyY2UpO1xuICB9LCAxNTAwMCk7IC8vIDE1IG1pbnV0ZXMgZm9yIGphaWwgY2FsbHNcblxuICBjb25zdCBzb3VyY2VOYW1lID0gXCJKQUlMIFBIT05FXCI7XG4gIGNvbnN0IHRhcmdldE5hbWUgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0TmFtZUJ5TnVtYmVyKG51bWJlciwgdGFyZ2V0Q2l0aXplbklkKTtcblxuICBlbWl0TmV0KFwicGhvbmU6YWRkQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGlkOiBcImphaWxfY2FsbFwiLFxuICAgIHRpdGxlOiBcIkluY29taW5nIENhbGwgZnJvbSBKQUlMXCIsXG4gICAgZGVzY3JpcHRpb246IGAke3NvdXJjZU5hbWV9IGlzIGNhbGxpbmcgeW91YCxcbiAgICBhcHA6IFwicGhvbmVcIixcbiAgICBpY29uczoge1xuICAgICAgXCIwXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9jcm9zcy1jaXJjbGUuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6ZGVjbGluZUNhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgc291cmNlTmFtZSxcbiAgICAgICAgICB0YXJnZXROYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogXCJqYWlsX2NhbGxcIixcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgICAgXCIxXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9hY2NlcHQuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lOiB0YXJnZXROYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWU6IHNvdXJjZU5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBcImphaWxfY2FsbFwiLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSkpO1xuXG4gIGVtaXROZXQoXCJzdW1taXRfcGhvbmU6c2VydmVyOmFkZENhbGxpbmdpbnRlcmZhY2VcIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY2FsbElkLFxuICAgIHRhcmdldFNvdXJjZSxcbiAgICB0YXJnZXROYW1lLFxuICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgIGRhdGFiYXNlVGFibGVJZDogXCJqYWlsX2NhbGxcIixcbiAgfSkpO1xuXG4gIC8vIFN0YXJ0IGEgdGltZXIgdG8gYXV0b21hdGljYWxseSBlbmQgamFpbCBjYWxscyBhZnRlciAxMCBtaW51dGVzXG4gIC8vIFRoaXMgcHJldmVudHMgYWJ1c2UgYW5kIHNpbXVsYXRlcyByZWFsIGphaWwgcGhvbmUgbGltaXRhdGlvbnNcbiAgc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICAgIGlmIChjYWxsICYmIGNhbGwuY2FsbElkID09PSBjYWxsSWQpIHtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiQ2FsbCBFbmRlZFwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJKYWlsIHBob25lIGNhbGwgdGltZSBsaW1pdCByZWFjaGVkXCIsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgfSkpO1xuICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJDYWxsIEVuZGVkXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkphaWwgcGhvbmUgY2FsbCB0aW1lIGxpbWl0IHJlYWNoZWRcIixcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICB9KSk7XG5cbiAgICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiY29tcGxldGVkXCIsIFwiY29tcGxldGVkXCIsIG5ldyBEYXRlKCksIHRhcmdldFBob25lKTtcbiAgICAgIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgMCk7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIFwiamFpbF9jYWxsXCIpO1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gICAgfVxuICB9LCA2MDAwMDApOyAvLyAxMCBtaW51dGVzXG5cbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ0phaWwgQ2FsbCBJbml0aWF0ZWQnLFxuICAgIG1lc3NhZ2U6IGBKYWlsIGNhbGwgaW5pdGlhdGVkIGZyb20gJHtzb3VyY2V9IHRvICR7dGFyZ2V0U291cmNlfSAoJHt0YXJnZXRQaG9uZX0pYCxcbiAgICBzaG93SWRlbnRpZmllcnM6IHRydWUsXG4gIH0pO1xuXG4gIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IGNhbGxNYW5hZ2VyIH0gZnJvbSBcIi4vQ2FsbE1hbmFnZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IGNhbGxIaXN0b3J5TWFuYWdlciB9IGZyb20gXCIuL2NhbGxIaXN0b3J5TWFuYWdlclwiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25OZXQoXCJwaG9uZTpzZXJ2ZXI6ZGVjbGluZUNhbGxcIiwgYXN5bmMgKG5vdGlJZDogc3RyaW5nLCBhcmdzOiBhbnkpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQsIHRhcmdldFNvdXJjZSwgY2FsbGVyU291cmNlLCBkYXRhYmFzZVRhYmxlSWQgfSA9IEpTT04ucGFyc2UoYXJncyk7XG4gIGNhbGxNYW5hZ2VyLmRlY2xpbmVJbnZpdGF0aW9uKGNhbGxJZCwgdGFyZ2V0U291cmNlKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihjYWxsZXJTb3VyY2UpO1xuICBpZiAoY2FsbCkge1xuICAgIGNvbnN0IHRhcmdldFBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiZGVjbGluZWRcIiwgXCJkZWNsaW5lZFwiLCBuZXcgRGF0ZSgpLCB0YXJnZXRQaG9uZSk7XG4gIH1cbiAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgXG4gIC8vIE5FVzogRW5kIGFuaW1hdGlvbnMgZm9yIGJvdGggcGFydGllc1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OmVuZENhbGxBbmltYXRpb25cIiwgdGFyZ2V0U291cmNlKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDplbmRDYWxsQW5pbWF0aW9uXCIsIGNhbGxlclNvdXJjZSk7XG4gIFxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCk7XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQ2FsbGluZ0ludGVyZmFjZVwiLCBjYWxsZXJTb3VyY2UpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiBcInBob25lXCIsXG4gICAgdGl0bGU6IFwiQ2FsbCBEZWNsaW5lZFwiLFxuICAgIG1lc3NhZ2U6IGAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gaGFzIGRlY2xpbmVkIHRoZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjphY2NlcHRDYWxsXCIsIGFzeW5jIChub3RpSWQ6IHN0cmluZywgYXJnczogYW55KSA9PiB7XG4gIGNvbnN0IHsgY2FsbElkLCB0YXJnZXRTb3VyY2UsIHRhcmdldE5hbWUsIHNvdXJjZU5hbWUsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkIH0gPSBKU09OLnBhcnNlKGFyZ3MpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmICghY2FsbCB8fCBjYWxsLmNhbGxJZCAhPT0gY2FsbElkKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNhbGwgbm8gbG9uZ2VyIGV4aXN0c1wiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgcGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlOiB0YXJnZXRTb3VyY2UsXG4gICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG4gIGlmICghY2FsbE1hbmFnZXIuYWNjZXB0SW52aXRhdGlvbihjYWxsSWQsIHBhcnRpY2lwYW50KSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb3VsZCBub3Qgam9pbiBjYWxsXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybjtcbiAgfVxuICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgY2FsbElkKTtcbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKGNhbGxlclNvdXJjZSwgY2FsbElkKTtcbiAgXG4gIC8vIE5FVzogU3RhcnQgYW5pbWF0aW9uIGZvciBib3RoIHBhcnRpZXMgd2hlbiBjYWxsIGlzIGFjY2VwdGVkXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6YWNjZXB0Q2FsbFwiLCB0YXJnZXRTb3VyY2UsIGFyZ3MpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnN0YXJ0Q2FsbEFuaW1hdGlvblwiLCBjYWxsZXJTb3VyY2UpOyAvLyBORVc6IEFuaW1hdGlvbiBmb3IgY2FsbGVyXG4gIFxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnVwZGF0ZUNhbGxlckludGVyZmFjZVwiLCBjYWxsZXJTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQsXG4gIH0pKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBub3RpSWQpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiBcInBob25lXCIsXG4gICAgdGl0bGU6IFwiQ2FsbCBBY2NlcHRlZFwiLFxuICAgIG1lc3NhZ2U6IGAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gaGFzIGFjY2VwdGVkIHRoZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjphY2NlcHRDb25mZXJlbmNlQ2FsbFwiLCBhc3luYyAobm90aUlkOiBzdHJpbmcsIGFyZ3M6IGFueSkgPT4ge1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCB0YXJnZXROYW1lLCBzb3VyY2VOYW1lLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShhcmdzKTtcblxuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmICghY2FsbCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb25mZXJlbmNlIGNhbGwgbm8gbG9uZ2VyIGV4aXN0c1wiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgdGFyZ2V0UGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHBhcnRpY2lwYW50ID0ge1xuICAgIHNvdXJjZTogdGFyZ2V0U291cmNlLFxuICAgIGNpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkLFxuICAgIHBob25lTnVtYmVyOiB0YXJnZXRQaG9uZSxcbiAgICBvbkhvbGQ6IGZhbHNlLFxuICB9O1xuICBpZiAoIWNhbGxNYW5hZ2VyLmFjY2VwdEludml0YXRpb24oY2FsbC5jYWxsSWQsIHBhcnRpY2lwYW50KSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb3VsZCBub3Qgam9pbiBjb25mZXJlbmNlIGNhbGxcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbCh0YXJnZXRTb3VyY2UsIGNhbGwuY2FsbElkKTtcblxuICBmb3IgKGNvbnN0IHAgb2YgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSkge1xuICAgIGlmIChwLnNvdXJjZSAhPT0gdGFyZ2V0U291cmNlKSB7XG4gICAgICBjb25zdCBjYWxsc3MgPSBjYWxsLmNhbGxJZDtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6dXBkYXRlQ29uZmVyZW5jZVwiLCBwLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBjYWxsc3MsXG4gICAgICAgIHBhcnRpY2lwYW50czogY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSxcbiAgICAgIH0pKTtcbiAgICAgIGVtaXROZXQoJ3Bob25lOmNsaWVudDp1cERhdGVJbnRlckZhY2VOYW1lJywgcC5zb3VyY2UpO1xuICAgIH1cbiAgfVxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIG5vdGlJZCk7XG4gIFxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnVwZGF0ZUNhbGxlckludGVyZmFjZVwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHNvdXJjZU5hbWU6IHNvdXJjZU5hbWUsXG4gICAgdGFyZ2V0TmFtZTogJ0NvbmZlcmVuY2UgQ2FsbCcsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkLFxuICB9KSk7XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6dXBkYXRlQ2FsbGVySW50ZXJmYWNlXCIsIGNhbGxlclNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgc291cmNlTmFtZTogc291cmNlTmFtZSxcbiAgICB0YXJnZXROYW1lOiBcIkNvbmZlcmVuY2UgQ2FsbFwiLFxuICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgIGRhdGFiYXNlVGFibGVJZCxcbiAgfSkpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiBcInBob25lXCIsXG4gICAgdGl0bGU6IFwiQ29uZmVyZW5jZSBDYWxsIEFjY2VwdGVkXCIsXG4gICAgbWVzc2FnZTogYCR7VXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShjYWxsZXJTb3VyY2UpfSBoYXMgYWNjZXB0ZWQgdGhlIGNvbmZlcmVuY2UgY2FsbCBmcm9tICR7VXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpfWAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZSxcbiAgfSk7XG59KTtcblxub25OZXQoXCJwaG9uZTpzZXJ2ZXI6ZW5kQ2FsbFwiLCBhc3luYyAoYXJnczogYW55KSA9PiB7XG4gIGNvbnN0IHsgY2FsbElkLCBzb3VyY2UgfSA9IEpTT04ucGFyc2UoYXJncyk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKGNhbGwgJiYgY2FsbC5jYWxsSWQgPT09IGNhbGxJZCkge1xuICAgIGF3YWl0IGNhbGxNYW5hZ2VyLnJlbW92ZVBhcnRpY2lwYW50KGNhbGxJZCwgc291cmNlKTtcbiAgICBmb3IgKGNvbnN0IHAgb2YgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkpIHtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6dXBkYXRlQ29uZmVyZW5jZVwiLCBwLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBjYWxsSWQ6IGNhbGxJZCxcbiAgICAgICAgcGFydGljaXBhbnRzOiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSxcbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cbn0pO1xuXG5vbihcIm9uUmVzb3VyY2VTdG9wXCIsIGFzeW5jIChyZXNvdXJjZTogc3RyaW5nKSA9PiB7XG4gIGlmIChyZXNvdXJjZSA9PT0gR2V0Q3VycmVudFJlc291cmNlTmFtZSgpKSB7XG4gICAgZm9yIChjb25zdCBjYWxsIG9mIGNhbGxNYW5hZ2VyLmdldEFsbENhbGxzKCkpIHtcbiAgICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpIHtcbiAgICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHBhcnRpY2lwYW50LnNvdXJjZSwgMCk7XG4gICAgICB9XG4gICAgfVxuICB9XG59KTtcblxub25OZXQoXCJwbGF5ZXJEcm9wcGVkXCIsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gIGlmIChjYWxsKSB7XG4gICAgYXdhaXQgY2FsbE1hbmFnZXIucmVtb3ZlUGFydGljaXBhbnQoY2FsbC5jYWxsSWQsIHNvdXJjZSk7XG4gICAgZm9yIChjb25zdCBwIG9mIGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsLmNhbGxJZCkpIHtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6dXBkYXRlQ29uZmVyZW5jZVwiLCBwLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBjYWxsSWQ6IGNhbGwuY2FsbElkLFxuICAgICAgICBwYXJ0aWNpcGFudHM6IGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsLmNhbGxJZCksXG4gICAgICB9KSk7XG4gICAgfVxuICB9XG59KTtcbiIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgTG9nZ2VyLCBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3NhdmVQaG90b1RvUGhvdG9zJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IGRhdGFYID0ge1xuICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgY2l0aXplbklkLFxuICAgIGxpbms6IGRhdGEsXG4gICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLnJlcGxhY2UoJ1QnLCAnICcpLnJlcGxhY2UoJ1onLCAnJylcbiAgfTtcbiAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX3Bob3RvcycsIGRhdGFYKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX3Bob3RvcycsXG4gICAgdGl0bGU6ICdQaG90byBTYXZlZCcsXG4gICAgbWVzc2FnZTogYFBob3RvIHNhdmVkIGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCAke2NpdGl6ZW5JZH0sIExpbms6ICR7ZGF0YX1gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgfSk7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhWCk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0UGhvdG9zJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCBwaG90b3MgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9waG90b3MnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHBob3Rvcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZGVsZXRlUGhvdG8nLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9waG90b3MnLCB7IF9pZDogZGF0YSB9KTtcbiAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX3Bob3RvcycsIHsgX2lkOiBkYXRhLCBjaXRpemVuSWQgfSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9waG90b3MnLFxuICAgIHRpdGxlOiAnUGhvdG8gRGVsZXRlZCcsXG4gICAgbWVzc2FnZTogYFBob3RvIGRlbGV0ZWQgYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8ICR7Y2l0aXplbklkfSwgTGluazogJHtyZXMubGlua31gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgfSk7XG4gIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2ssIHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyLCBGcmFtZXdvcmsgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdSZWdpc3Rlck5ld0J1c2luZXNzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgYnVzaW5lc3NQYXNzd29yZCxcbiAgICAgICAgam9iXG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZSB9KTtcbiAgICBpZiAoYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBSZWdpc3RyYXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIHJlZ2lzdGVyIGJ1c2luZXNzIHdpdGggZXhpc3RpbmcgbmFtZSAnJHtidXNpbmVzc05hbWV9JyBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYEJ1c2luZXNzIHdpdGggbmFtZSAke2J1c2luZXNzTmFtZX0gYWxyZWFkeSBleGlzdHMuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGlmIChnZW5lcmF0ZUJ1c2luZXNzRW1haWwpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21haWwnLCB7XG4gICAgICAgICAgICBfaWQ6IGJ1c2luZXNzRW1haWwsXG4gICAgICAgICAgICBhY3RpdmVNYWlkSWQ6IGJ1c2luZXNzRW1haWwsXG4gICAgICAgICAgICB1c2VybmFtZTogYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgICAgIGFjdGl2ZU1haWxQYXNzd29yZDogYnVzaW5lc3NQYXNzd29yZCxcbiAgICAgICAgICAgIGF2YXRhcjogYnVzaW5lc3NMb2dvLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2J1c2luZXNzJywge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iXG4gICAgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgUmVnaXN0ZXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBOZXcgYnVzaW5lc3MgJyR7YnVzaW5lc3NOYW1lfScgcmVnaXN0ZXJlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0QnVzaW5lc3NEYXRhJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGJ1c2luZXNzKTtcbn0pO1xub25DbGllbnRDYWxsYmFjaygnZ2V0QWxsQnVzaW5lc3NEYXRhJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3NlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2J1c2luZXNzJywge30pO1xuICAgIGxldCBvbmxpbmVCdXNzID0gW11cbiAgICBsZXQgb2ZmbGluZUJ1c3MgPSBbXVxuICAgIGZvciAoY29uc3QgYnVzaW5lc3Mgb2YgYnVzaW5lc3Nlcykge1xuICAgICAgICBjb25zdCBqb2JDb3VudCA9IEdsb2JhbFN0YXRlW2Ake2J1c2luZXNzLmpvYn06Y291bnRgXVxuICAgICAgICBpZiAoam9iQ291bnQpIHtcbiAgICAgICAgICAgIG9ubGluZUJ1c3MucHVzaChidXNpbmVzcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvZmZsaW5lQnVzcy5wdXNoKGJ1c2luZXNzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBvbmxpbmU6IG9ubGluZUJ1c3MsIG9mZmxpbmU6IG9mZmxpbmVCdXNzIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldEJ1c2luZXNzTmFtZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3NlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2J1c2luZXNzJywge30pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShidXNpbmVzc2VzLm1hcCgoYnVzaW5lc3M6IGFueSkgPT4gYnVzaW5lc3MuYnVzaW5lc3NOYW1lKSk7XG59KVxuXG5vbkNsaWVudENhbGxiYWNrKCdVcGRhdGVCdXNpbmVzcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgICAgc2VsZWN0ZWRCdXNpbmVzcyxcbiAgICAgICAgb3duZXJDaXRpemVuSWQsXG4gICAgICAgIGJ1c2luZXNzTmFtZSxcbiAgICAgICAgYnVzaW5lc3NEZXNjcmlwdGlvbixcbiAgICAgICAgYnVzaW5lc3NUeXBlLFxuICAgICAgICBidXNpbmVzc0xvZ28sXG4gICAgICAgIGJ1c2luZXNzUGhvbmVOdW1iZXIsXG4gICAgICAgIGJ1c2luZXNzQWRkcmVzcyxcbiAgICAgICAgZ2VuZXJhdGVCdXNpbmVzc0VtYWlsLFxuICAgICAgICBjb29yZHMsXG4gICAgICAgIGpvYixcbiAgICAgICAgYnVzaW5lc3NFbWFpbFxuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGJ1c2luZXNzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBzZWxlY3RlZEJ1c2luZXNzIH0pO1xuICAgIGlmICghYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBVcGRhdGUgRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIHVwZGF0ZSBub24tZXhpc3RlbnQgYnVzaW5lc3MgJyR7c2VsZWN0ZWRCdXNpbmVzc30nIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7YnVzaW5lc3NOYW1lfSBkb2VzIG5vdCBleGlzdC5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IHNlbGVjdGVkQnVzaW5lc3MgfSwge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iLFxuICAgICAgICBidXNpbmVzc0VtYWlsXG4gICAgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBCdXNpbmVzcyAnJHtzZWxlY3RlZEJ1c2luZXNzfScgdXBkYXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZGVsZXRlQnVzaW5lc3MnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZTogZGF0YSB9KTtcbiAgICBpZiAoIWJ1c2luZXNzKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgRGVsZXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGRlbGV0ZSBub24tZXhpc3RlbnQgYnVzaW5lc3MgJyR7ZGF0YX0nIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7ZGF0YX0gZG9lcyBub3QgZXhpc3QuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBkYXRhIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICB0aXRsZTogJ0J1c2luZXNzIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgQnVzaW5lc3MgJyR7ZGF0YX0nIGRlbGV0ZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6dG9nZ2xlSm9iQ2FsbHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpOztcbiAgICBjb25zdCBQbGF5ZXJEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSk7XG4gICAgaWYgKCFQbGF5ZXJEYXRhKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIsIGpvYkNhbGxzOiB0cnVlIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSwgeyBqb2JDYWxsczogIVBsYXllckRhdGEuam9iQ2FsbHMgfSk7XG4gICAgcmV0dXJuICFQbGF5ZXJEYXRhLmpvYkNhbGxzO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0Sm9iQ2FsbHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IFBsYXllckRhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciB9KTtcbiAgICBpZiAoIVBsYXllckRhdGEpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciwgam9iQ2FsbHM6IHRydWUgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG4gICAgcmV0dXJuIFBsYXllckRhdGEuam9iQ2FsbHM7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpidXNpbmVzc0NhbGwnLCBhc3luYyAoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgbnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGNpdGl6ZW5pZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIobnVtYmVyKTtcbiAgICBjb25zdCBwZXJzb25hbE51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2xpZW50KTtcbiAgICBpZiAoU3RyaW5nKHBlcnNvbmFsTnVtYmVyKSA9PT0gU3RyaW5nKG51bWJlcikpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBDYW4ndCBjYWxsIHlvdXJzZWxmICR7cGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgaWYgKCFjaXRpemVuaWQpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFRoaXMgbnVtYmVyIGlzIG5vdCByZWdpc3RlcmVkLmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgY29uc3QgUGxheWVyRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogY2l0aXplbmlkIH0pO1xuICAgIGlmIChQbGF5ZXJEYXRhICYmICFQbGF5ZXJEYXRhLmpvYkNhbGxzKSB7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBUaGlzIHBlcnNvbiBoYXMgZGlzYWJsZWQgam9iIGNhbGxzLmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9IGVsc2UgaWYgKFBsYXllckRhdGEgJiYgUGxheWVyRGF0YS5qb2JDYWxscykge1xuICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpjbGllbnQ6YnVzaW5lc3NDYWxsJywgY2xpZW50LCBudW1iZXIpO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmdldEJhbmtiYWxhbmNlJywgYXN5bmMgKGNsaWVudCwgYWNjb3VudCkgPT4ge1xuICAgIGNvbnN0IGJhbGFuY2UgPSBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5nZXRBY2NvdW50TW9uZXkoYWNjb3VudCk7XG4gICAgcmV0dXJuIGJhbGFuY2U7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpkZXBvc2l0TW9uZXknLCBhc3luYyAoY2xpZW50LCBhbW91bnQ6IG51bWJlcikgPT4ge1xuICAgIFxuICAgIGNvbnN0IHNyYyA9IGNsaWVudDtcbiAgICBjb25zdCBQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHNyYyk7XG4gICAgY29uc3QgZnVsbG5hbWUgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzcmMpO1xuICAgIGNvbnN0IGNpZCA9IFBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZDtcbiAgICBjb25zdCBQbGF5ZXJKb2IgPSBQbGF5ZXIuUGxheWVyRGF0YS5qb2I7XG4gICAgY29uc3QgYWNjb3VudCA9IFBsYXllckpvYi5uYW1lO1xuICAgIGNvbnN0IGJhbmtiYWxhbmNlID0gYXdhaXQgUGxheWVyLlBsYXllckRhdGEubW9uZXkuYmFuaztcbiAgICBpZiAoYmFua2JhbGFuY2UgPCBhbW91bnQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBhd2FpdCBQbGF5ZXIuRnVuY3Rpb25zLlJlbW92ZU1vbmV5KCdiYW5rJywgYW1vdW50LCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0LlwiKTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5hZGRBY2NvdW50TW9uZXkoYWNjb3VudCwgYW1vdW50KTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihjaWQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3XCIsIGFtb3VudCwgYFNlbnQgZnVuZHMgdG8gJHtQbGF5ZXJKb2IubGFiZWx9YCwgYWNjb3VudCwgZnVsbG5hbWUsIFwid2l0aGRyYXdcIiwgZ2VuZXJhdGVVVWlkKCkpXG4gICAgYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oYWNjb3VudCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgRGVwb3NpdFwiLCBhbW91bnQsIFwiRGVwb3NpdFwiLCBmdWxsbmFtZSwgYWNjb3VudCwgXCJkZXBvc2l0XCIsIGdlbmVyYXRlVVVpZCgpKVxuXG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnTW9uZXkgRGVwb3NpdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBsYXllciAke2Z1bGxuYW1lfSBkZXBvc2l0ZWQgJCR7YW1vdW50fSB0byBhY2NvdW50ICR7YWNjb3VudH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6d2l0aGRyYXdNb25leScsIGFzeW5jIChjbGllbnQsIGFtb3VudDogbnVtYmVyKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gY2xpZW50O1xuICAgIGNvbnN0IFBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc3JjKTtcbiAgICBjb25zdCBmdWxsbmFtZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNyYyk7XG4gICAgY29uc3QgY2lkID0gUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkO1xuICAgIGNvbnN0IFBsYXllckpvYiA9IFBsYXllci5QbGF5ZXJEYXRhLmpvYjtcbiAgICBjb25zdCBhY2NvdW50ID0gUGxheWVySm9iLm5hbWU7XG4gICAgY29uc3QgYmFsYW5jZSA9IGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmdldEFjY291bnRNb25leShhY2NvdW50KTtcbiAgICBpZiAoYmFsYW5jZSA8IGFtb3VudCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGF3YWl0IFBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoJ2JhbmsnLCBhbW91bnQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3LlwiKTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5yZW1vdmVBY2NvdW50TW9uZXkoYWNjb3VudCwgYW1vdW50KTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihjaWQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3XCIsIGFtb3VudCwgYFJlY2lldmVkIGZ1bmRzIGZyb20gJHtQbGF5ZXJKb2IubGFiZWx9YCwgYWNjb3VudCwgZnVsbG5hbWUsIFwiZGVwb3NpdFwiLCBnZW5lcmF0ZVVVaWQoKSlcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihhY2NvdW50LCBcIlBob25lIEJ1c2luZXNzIEFwcCBXaXRoZHJhd1wiLCBhbW91bnQsIFwiV2l0aGRyYXdcIiwgYWNjb3VudCwgZnVsbG5hbWUsIFwid2l0aGRyYXdcIiwgZ2VuZXJhdGVVVWlkKCkpXG5cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgdGl0bGU6ICdNb25leSBXaXRoZHJhd24nLFxuICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7ZnVsbG5hbWV9IHdpdGhkcmV3ICQke2Ftb3VudH0gZnJvbSBhY2NvdW50ICR7YWNjb3VudH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0RW1wbG95ZWVzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gY2xpZW50O1xuICAgIGNvbnN0IGpvYm5hbWUgPSBkYXRhO1xuICAgIGNvbnN0IFBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc3JjKTtcbiAgICBjb25zdCBpc0Jvc3MgPSBQbGF5ZXIuUGxheWVyRGF0YS5qb2IuaXNib3NzO1xuICAgIC8qICAgICBcbiAgICAgICAgaWYgKCFpc0Jvc3MpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBvcnRzWydwcy1hZG1pbm1lbnUnXS5CYW5QbGF5ZXIoc3JjLCAnR2V0RW1wbG95ZWVzIEV4cGxvaXRpbmcgJywgJ3N1bW1pdF9waG9uZScpO1xuICAgICAgICB9XG4gICAgKi9cbiAgICBjb25zdCBwbGF5ZXJzOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIGNpdGl6ZW5pZCwgY2hhcmluZm8sIGpvYiBGUk9NIHBsYXllcnMgV0hFUkUgam9iIExJS0UgPycsIFtgJSR7am9ibmFtZX0lYF0pO1xuICAgIGNvbnN0IGVtcGxveWVlczogYW55ID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGRhdGEgb2YgcGxheWVycykge1xuICAgICAgICBsZXQgY2hhckRhdGEgPSB7IGZpcnN0bmFtZTogJ1Vua25vd24nLCBsYXN0bmFtZTogJ1BsYXllcicgfTtcbiAgICAgICAgbGV0IGpvYkRhdGEgPSB7IG5hbWU6ICdVbmtub3duJywgZ3JhZGU6IDAsIGlzYm9zczogZmFsc2UgfTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKGRhdGEuY2hhcmluZm8pIGNoYXJEYXRhID0gSlNPTi5wYXJzZShkYXRhLmNoYXJpbmZvKTtcbiAgICAgICAgICAgIGlmIChkYXRhLmpvYikgam9iRGF0YSA9IEpTT04ucGFyc2UoZGF0YS5qb2IpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBMT0dHRVIoYEZhaWxlZCB0byBwYXJzZSBKb2IgJHtqb2JuYW1lfSAvIGNoYXJpbmZvIGZvciAkICR7ZGF0YS5jaXRpemVuaWR9YCk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzT25saW5lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGRhdGEuY2l0aXplbmlkKTtcbiAgICAgICAgaWYgKGlzT25saW5lICYmIGlzT25saW5lLlBsYXllckRhdGEuam9iLm5hbWUgPT09IGpvYm5hbWUpIHtcbiAgICAgICAgICAgIGVtcGxveWVlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlbXBTb3VyY2U6IGlzT25saW5lLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgICAgIGN1ckpvYjogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSxcbiAgICAgICAgICAgICAgICBncmFkZTogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IuZ3JhZGUsXG4gICAgICAgICAgICAgICAgaXNib3NzOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5pc2Jvc3MsXG4gICAgICAgICAgICAgICAgbmFtZTogYCR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgIHN0YXR1czogJ29ubGluZSdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogZGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICAgICAgY3VySm9iOiBqb2JEYXRhLm5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGU6IGpvYkRhdGEuZ3JhZGUsXG4gICAgICAgICAgICAgICAgaXNib3NzOiBqb2JEYXRhLmlzYm9zcyxcbiAgICAgICAgICAgICAgICBuYW1lOiBgJHtjaGFyRGF0YS5maXJzdG5hbWV9ICR7Y2hhckRhdGEubGFzdG5hbWV9YCxcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdvZmZsaW5lJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZW1wbG95ZWVzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiAoYi5ncmFkZS5sZXZlbCB8fCAwKSAtIChhLmdyYWRlLmxldmVsIHx8IDApKTtcblxuICAgIGNvbnN0IG11bHRpam9iRW1wbG95ZWVzOiBhbnlbXSA9IFtdO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG11bHRpSm9iUGxheWVyczogYW55W10gPSAoYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfbXVsdGlqb2JzJywgeyBqb2JOYW1lOiBqb2JuYW1lIH0pKSB8fCBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IG11bHRpSm9iIG9mIG11bHRpSm9iUGxheWVycykge1xuICAgICAgICAgICAgaWYgKCFtdWx0aUpvYi5jaXRpemVuSWQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1NraXBwaW5nIGludmFsaWQgbXVsdGlqb2IgZW50cnk6JywgbXVsdGlKb2IpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpc09ubGluZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChtdWx0aUpvYi5jaXRpemVuSWQpO1xuICAgICAgICAgICAgaWYgKCFpc09ubGluZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBsYXllckRhdGE6IGFueSA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgY2hhcmluZm8sIGpvYiBGUk9NIHBsYXllcnMgV0hFUkUgY2l0aXplbmlkID0gPycsIFttdWx0aUpvYi5jaXRpemVuSWRdKTtcbiAgICAgICAgICAgICAgICBpZiAoIXBsYXllckRhdGEgfHwgcGxheWVyRGF0YS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBObyBwbGF5ZXIgZGF0YSBmb3VuZCBmb3Igb2ZmbGluZSBjaXRpemVuSWQgJHttdWx0aUpvYi5jaXRpemVuSWR9YCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZGF0YSBvZiBwbGF5ZXJEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBqb2JEYXRhLCBjaGFyRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGpvYkRhdGEgPSBkYXRhLmpvYiA/IEpTT04ucGFyc2UoZGF0YS5qb2IpIDogeyBuYW1lOiAnVW5rbm93bicsIGdyYWRlOiAwLCBpc2Jvc3M6IGZhbHNlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFyRGF0YSA9IGRhdGEuY2hhcmluZm8gPyBKU09OLnBhcnNlKGRhdGEuY2hhcmluZm8pIDogeyBmaXJzdG5hbWU6ICdVbmtub3duJywgbGFzdG5hbWU6ICdQbGF5ZXInIH07XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBwYXJzZSBqb2IvY2hhcmluZm8gZm9yICR7bXVsdGlKb2IuY2l0aXplbklkfTpgLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChqb2JEYXRhLm5hbWUgPT09IGpvYm5hbWUpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBtdWx0aWpvYkVtcGxveWVlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogbXVsdGlKb2IuY2l0aXplbklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3VySm9iOiBqb2JEYXRhLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBncmFkZTogam9iRGF0YS5ncmFkZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzYm9zczogam9iRGF0YS5pc2Jvc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBgJHtjaGFyRGF0YS5maXJzdG5hbWV9ICR7Y2hhckRhdGEubGFzdG5hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ29mZmxpbmUnXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzT25saW5lLlBsYXllckRhdGEuam9iLm5hbWUgPT09IGpvYm5hbWUpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIG11bHRpam9iRW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBlbXBTb3VyY2U6IGlzT25saW5lLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgICAgICAgICBjdXJKb2I6IGlzT25saW5lLlBsYXllckRhdGEuam9iLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGdyYWRlOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5ncmFkZSxcbiAgICAgICAgICAgICAgICAgICAgaXNib3NzOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5pc2Jvc3MsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGAke2lzT25saW5lLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke2lzT25saW5lLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnb25saW5lJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG11bHRpam9iRW1wbG95ZWVzLnNvcnQoKGEsIGIpID0+IChiLmdyYWRlIHx8IDApIC0gKGEuZ3JhZGUgfHwgMCkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBwcm9jZXNzaW5nIG11bHRpam9iIGVtcGxveWVlczonLCBlcnIpO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGVtcGxveWVlczogZW1wbG95ZWVzLmxlbmd0aCA+IDAgPyBlbXBsb3llZXMgOiBbXSxcbiAgICAgICAgbXVsdGlqb2JFbXBsb3llZXM6IG11bHRpam9iRW1wbG95ZWVzLmxlbmd0aCA+IDAgPyBtdWx0aWpvYkVtcGxveWVlcyA6IFtdXG4gICAgfSk7XG59KTtcblxuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmhpcmVFbXBsb3llZScsIGFzeW5jIChjbGllbnQsIHRhcmdldFNvdXJjZTogc3RyaW5nLCBqb2JuYW1lOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoU3RyaW5nKGNsaWVudCkgPT09IFN0cmluZyh0YXJnZXRTb3VyY2UpKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSGlyZSBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gaGlyZSBzZWxmIE5hbWU6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0sIGluIEpvYjogJHtqb2JuYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGNhbid0IGhpcmUgeW91cnNlbGYuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBpZiAoYXdhaXQgRG9lc1BsYXllckV4aXN0KHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgY29uc3QgcGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihjbGllbnQpO1xuICAgICAgICBpZiAoIXBsYXllci5QbGF5ZXJEYXRhLmpvYi5pc2Jvc3MpIHtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdIaXJlIEZhaWxlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gaGlyZSB3aXRob3V0IGJlaW5nIGEgYm9zcyBOYW1lOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9LCBpbiBKb2I6ICR7am9ibmFtZX0sIENpdGl6ZW5JZDogJHtwbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWR9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgYXJlIG5vdCBhIGJvc3MuYCxcbiAgICAgICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIodGFyZ2V0U291cmNlKTtcbiAgICAgICAgdGFyZ2V0UGxheWVyLkZ1bmN0aW9ucy5TZXRKb2Ioam9ibmFtZSwgMCk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnRW1wbG95ZWUgSGlyZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFBsYXllciAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH0gTmFtZTogJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhpcmVkIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSwgaW4gSm9iOiAke2pvYm5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGhpcmVkICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSB0byAke2pvYm5hbWV9LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYmVlbiBoaXJlZCB0byAke2pvYm5hbWV9LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdCgnc3VtbWl0X3Bob25lOnNlcnZlcjpoaXJlaW5NdWx0aUpvYicsIHRhcmdldFNvdXJjZSwgam9ibmFtZSwgMCwgRnJhbWV3b3JrLlNoYXJlZC5Kb2JzW2pvYm5hbWVdLmxhYmVsLCBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbam9ibmFtZV0uZ3JhZGVzWycwJ10ubGFiZWwpO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgY2xpZW50LCBqb2JuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICB0aXRsZTogJ0hpcmUgRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGhpcmUgbm9uLWV4aXN0ZW50IHBsYXllciBOYW1lOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9LCBpbiBKb2I6ICR7am9ibmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgUGxheWVyIGlzIG5vdCBvbmxpbmUuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRJbmRleE9mQWxsSm9icycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBqb2JzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnc3VtbWl0X2pvYnMnLCB7fSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGpvYnMubWFwKChqb2I6IGFueSkgPT4gam9iLl9pZCkpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3JlZ2lzdGVySm9icycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYnMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdzdW1taXRfam9icycsIGpvYnMpO1xuICAgIGNvbnN0IHsgX2lkLCAuLi5yZXN0IH0gPSBqb2JzO1xuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5BZGRKb2IoX2lkLCByZXN0KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2pvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBSZWdpc3RlcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYE5ldyBqb2IgJyR7X2lkfScgTmFtZTogJHtqb2JzLmpvYk5hbWV9IHJlZ2lzdGVyZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldEpvYkRhdGEnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBqb2IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGpvYik7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygndXBkYXRlSm9icycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYnMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdzdW1taXRfam9icycsIHsgX2lkOiBqb2JzLl9pZCB9LCBqb2JzKTtcbiAgICBjb25zdCB7IF9pZCwgLi4ucmVzdCB9ID0gam9icztcbiAgICBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uVXBkYXRlSm9iKF9pZCwgcmVzdCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9qb2JzJyxcbiAgICAgICAgdGl0bGU6ICdKb2IgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBKb2IgJyR7X2lkfScgTmFtZTogJHtqb2JzLmpvYk5hbWV9IHVwZGF0ZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2RlbGV0ZUpvYnMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBqb2IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgaWYgKCFqb2IpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAnc3VtbWl0X2pvYnMnLFxuICAgICAgICAgICAgdGl0bGU6ICdKb2IgRGVsZXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGRlbGV0ZSBub24tZXhpc3RlbnQgam9iICcke2RhdGF9JyBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYEpvYiBkb2VzIG5vdCBleGlzdC5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdzdW1taXRfam9icycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5SZW1vdmVKb2IoZGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9qb2JzJyxcbiAgICAgICAgdGl0bGU6ICdKb2IgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBKb2IgJyR7ZGF0YX0nIE5hbWU6ICR7am9iLmpvYk5hbWV9IGRlbGV0ZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0QnVzaW5lc3NFbXBsb3llZXNOdW1iZXJzJywgYXN5bmMgKGNsaWVudDogbnVtYmVyLCBqb2I6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IFtwbGF5ZXJzXSA9IGF3YWl0IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyc09uRHV0eShqb2IpO1xuICAgIGxldCBudW1iZXJzOiBudW1iZXJbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgcGxheWVyIG9mIHBsYXllcnMpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShwbGF5ZXIpO1xuICAgICAgICBudW1iZXJzLnB1c2goTnVtYmVyKG51bWJlcikpO1xuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobnVtYmVycyk7XG59KSIsICJpbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZyYW1ld29yaywgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCwgTE9HR0VSIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uTmV0KCdzdW1taXRfcGhvbmU6c2VydmVyOmZpcmVFbXBsb3llZScsIGFzeW5jIChjaXRpemVuSWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNvdXJjZSA9IGdsb2JhbC5zb3VyY2U7XG4gICAgY29uc3QgdGFyZ2V0RGF0YSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIGlmICh0YXJnZXREYXRhKSB7XG4gICAgICAgIGNvbnN0IGpvYm5hbWUgPSB0YXJnZXREYXRhLlBsYXllckRhdGEuam9iLm5hbWU7XG4gICAgICAgIGF3YWl0IHRhcmdldERhdGEuRnVuY3Rpb25zLlNldEpvYigndW5lbXBsb3llZCcsIDApO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCwgam9iTmFtZTogam9ibmFtZSB9KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgZmlyZWQgJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBiZWVuIGZpcmVkIGJ5ICR7Z2xvYmFsLnNvdXJjZX1gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBzb3VyY2UsIGpvYm5hbWUpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9lbXBsb3llZV9hY3Rpb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdFbXBsb3llZSBGaXJlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIGJlZW4gZmlyZWQgYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IENpdGl6ZW5JZDogJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2l0aXplbmlkfSB8IEpvYjogJHt0YXJnZXREYXRhLlBsYXllckRhdGEuam9iLm5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcGxheWVyRGF0YTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCBqb2IgRlJPTSBwbGF5ZXJzIFdIRVJFIGNpdGl6ZW5pZCA9ID8gTElNSVQgMScsIFtjaXRpemVuSWRdKTtcbiAgICAgICAgY29uc3Qgam9iRGF0YSA9IEpTT04ucGFyc2UocGxheWVyRGF0YVswXS5qb2IpO1xuXG4gICAgICAgIGxldCBqb2I6IGFueSA9IHt9O1xuICAgICAgICBqb2IubmFtZSA9ICd1bmVtcGxveWVkJ1xuICAgICAgICBqb2IubGFiZWwgPSBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbJ3VuZW1wbG95ZWQnXS5sYWJlbFxuICAgICAgICBqb2IucGF5bWVudCA9IEZyYW1ld29yay5TaGFyZWQuSm9ic1sndW5lbXBsb3llZCddLmdyYWRlc1snMCddLnBheW1lbnRcbiAgICAgICAgam9iLm9uZHV0eSA9IEZyYW1ld29yay5TaGFyZWQuSm9ic1sndW5lbXBsb3llZCddLmRlZmF1bHREdXR5XG4gICAgICAgIGpvYi5pc2Jvc3MgPSBmYWxzZVxuICAgICAgICBqb2IuZ3JhZGUgPSB7fVxuICAgICAgICBqb2IuZ3JhZGUubmFtZSA9IEZyYW1ld29yay5TaGFyZWQuSm9ic1sndW5lbXBsb3llZCddLmdyYWRlc1snMCddLm5hbWVcbiAgICAgICAgam9iLmdyYWRlLmxldmVsID0gMFxuICAgICAgICBhd2FpdCBVdGlscy5xdWVyeSgnVVBEQVRFIHBsYXllcnMgU0VUIGpvYiA9ID8gV0hFUkUgY2l0aXplbmlkID0gPycsIFtKU09OLnN0cmluZ2lmeShqb2IpLCBjaXRpemVuSWRdKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIGpvYk5hbWU6IGpvYkRhdGEubmFtZSB9KTtcbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgam9iRGF0YS5uYW1lKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZW1wbG95ZWVfYWN0aW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnT2ZmbGluZSBFbXBsb3llZSBGaXJlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgT2ZmbGluZSBlbXBsb3llZSAke2NpdGl6ZW5JZH0gaGFzIGJlZW4gZmlyZWQgYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IEpvYjogJHtqb2JEYXRhLm5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxufSk7XG5cbm9uTmV0KCdzdW1taXRfcGhvbmU6c2VydmVyOmNoYW5nZVJhbmtPZlBsYXllcicsIGFzeW5jIChkYXRhOiBhbnkpID0+IHtcbiAgICBjb25zdCBzb3VyY2UgPSBnbG9iYWwuc291cmNlO1xuICAgIGNvbnN0IHRhcmdldERhdGEgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoZGF0YS50YXJnZXRDaXRpemVuaWQpO1xuICAgIGNvbnN0IG11bHRpSm9iID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSB9KTtcbiAgICBpZiAodGFyZ2V0RGF0YSkge1xuICAgICAgICBjb25zdCBqb2JuYW1lID0gZGF0YS5qb2JOYW1lO1xuICAgICAgICB0YXJnZXREYXRhLkZ1bmN0aW9ucy5TZXRKb2Ioam9ibmFtZSwgZGF0YS5rZXkpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBjaGFuZ2VkIHRoZSByYW5rIG9mICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91ciByYW5rIGhhcyBiZWVuIGNoYW5nZWQgYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgaWYgKG11bHRpSm9iKSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUgfSwgeyBncmFkZUxldmVsOiBkYXRhLmtleSwgZ3JhZGVMYWJlbDogZGF0YS5ncmFkZU5hbWUgfSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlfam9iJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBVcGRhdGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtkYXRhLnRhcmdldENpdGl6ZW5pZH0gaGFzIGJlZW4gdXBkYXRlZCB0byAke2RhdGEuam9iTmFtZX0gfCBOZXcgUmFuazogJHtkYXRhLmdyYWRlTmFtZX0gYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IGNpdGl6ZW5JZDogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKX1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX211bHRpam9icycsIHsgX2lkOiBnZW5lcmF0ZVVVaWQoKSwgY2l0aXplbklkOiBkYXRhLnRhcmdldENpdGl6ZW5pZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lLCBncmFkZUxldmVsOiBkYXRhLmtleSwgZ3JhZGVMYWJlbDogZGF0YS5ncmFkZU5hbWUgfSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlfam9iJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBBZGRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7ZGF0YS50YXJnZXRDaXRpemVuaWR9IGhhcyBiZWVuIGFkZGVkIHRvICR7ZGF0YS5qb2JOYW1lfSB8IE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgam9ibmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2VtcGxveWVlX2FjdGlvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1JhbmsgQ2hhbmdlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIGJlZW4gZ2l2ZW4gYSBuZXcgcmFuayBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgQ2l0aXplbklkOiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaXRpemVuaWR9IHwgSm9iOiAke2pvYm5hbWV9IHwgIE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHBsYXllckRhdGE6IGFueSA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1Qgam9iIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/IExJTUlUIDEnLCBbZGF0YS50YXJnZXRDaXRpemVuaWRdKTtcbiAgICAgICAgY29uc3Qgam9iRGF0YSA9IEpTT04ucGFyc2UocGxheWVyRGF0YVswXS5qb2IpO1xuICAgICAgICBqb2JEYXRhLmdyYWRlLmxldmVsID0gZGF0YS5rZXk7XG4gICAgICAgIGpvYkRhdGEuZ3JhZGUubmFtZSA9IGRhdGEuZ3JhZGVOYW1lO1xuICAgICAgICBhd2FpdCBVdGlscy5xdWVyeSgnVVBEQVRFIHBsYXllcnMgU0VUIGpvYiA9ID8gV0hFUkUgY2l0aXplbmlkID0gPycsIFtKU09OLnN0cmluZ2lmeShqb2JEYXRhKSwgZGF0YS50YXJnZXRDaXRpemVuaWRdKTtcbiAgICAgICAgaWYgKG11bHRpSm9iKSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUgfSwgeyBncmFkZUxldmVsOiBkYXRhLmtleSwgZ3JhZGVMYWJlbDogZGF0YS5ncmFkZU5hbWUgfSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlfam9iJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBVcGRhdGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtkYXRhLnRhcmdldENpdGl6ZW5pZH0gaGFzIGJlZW4gdXBkYXRlZCB0byAke2RhdGEuam9iTmFtZX0gfCBOZXcgUmFuazogJHtkYXRhLmdyYWRlTmFtZX0gYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IGNpdGl6ZW5JZDogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKX1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX211bHRpam9icycsIHsgX2lkOiBnZW5lcmF0ZVVVaWQoKSwgY2l0aXplbklkOiBkYXRhLnRhcmdldENpdGl6ZW5pZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lLCBncmFkZUxldmVsOiBkYXRhLmtleSwgZ3JhZGVMYWJlbDogZGF0YS5ncmFkZU5hbWUgfSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlfam9iJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBBZGRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7ZGF0YS50YXJnZXRDaXRpemVuaWR9IGhhcyBiZWVuIGFkZGVkIHRvICR7ZGF0YS5qb2JOYW1lfSB8IE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgam9iRGF0YS5uYW1lKTtcbiAgICB9XG59KTtcblxub25OZXQoJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6ZmlyZUluYWN0aXZlRW1wbG95ZWUnLCBhc3luYyAoZGF0YTogeyBqb2JOYW1lOiBzdHJpbmcsIGNpdGl6ZW5JZDogc3RyaW5nIH0pID0+IHtcbiAgICBjb25zdCBzb3VyY2UgPSBnbG9iYWwuc291cmNlO1xuICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogZGF0YS5jaXRpemVuSWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSB9KTtcbiAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBmaXJlZCBhbiBpbmFjdGl2ZSBlbXBsb3llZWAsXG4gICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgIH0pKTtcbiAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBkYXRhLmpvYk5hbWUpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZW1wbG95ZWVfYWN0aW9uJyxcbiAgICAgICAgdGl0bGU6ICdJbmFjdGl2ZSBFbXBsb3llZSBGaXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBJbmFjdGl2ZSBlbXBsb3llZSAke2RhdGEuY2l0aXplbklkfSBoYXMgYmVlbiBmaXJlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgSm9iOiAke2RhdGEuam9iTmFtZX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub24oJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6aGlyZWluTXVsdGlKb2InLCBhc3luYyAoY2xpZW50OiBzdHJpbmcsIGpvYm5hbWU6IHN0cmluZywgZ3JhZGVMZXZlbDogbnVtYmVyLCBqb2JMYWJlbDogc3RyaW5nLCBncmFkZUxhYmVsOiBzdHJpbmcpID0+IHtcbiAgICAvKiBjb25zb2xlLmxvZygnSGlyaW5nIGluIG11bHRpIGpvYjonLCBqb2JuYW1lLCBncmFkZUxldmVsLCBqb2JMYWJlbCwgZ3JhZGVMYWJlbCk7ICovXG4gICAgY29uc3QgdGFyZ2V0Q2lkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgbXVsdGlKb2JDaGVjayA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpZCwgam9iTmFtZTogam9ibmFtZSB9KTtcbiAgICBpZiAobXVsdGlKb2JDaGVjaykge1xuICAgICAgICBpZiAobXVsdGlKb2JDaGVjay5ncmFkZUxldmVsICE9PSBncmFkZUxldmVsKSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpZCwgam9iTmFtZTogam9ibmFtZSB9LCB7IGdyYWRlTGV2ZWwsIGdyYWRlTGFiZWwgfSk7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBiZWVuIGhpcmVkIGluIGEgbmV3IHJhbms6ICR7Z3JhZGVMYWJlbH1gLFxuICAgICAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgY2xpZW50LCBqb2JuYW1lKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIFVwZGF0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldENpZH0gaGFzIGJlZW4gdXBkYXRlZCB0byAke2pvYm5hbWV9IHwgTmV3IFJhbms6ICR7Z3JhZGVMYWJlbH0gYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSB8IGNpdGl6ZW5JZDogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KX1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGVtaXROZXQoJ1FCQ29yZTpOb3RpZnknLCBjbGllbnQsICdZb3UgYXJlIGFscmVhZHkgaW4gdGhpcyBqb2Igd2l0aCB0aGlzIGdyYWRlIGxldmVsJywgJ2Vycm9yJyk7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGdlbmVyYXRlVVVpZCgpLCBjaXRpemVuSWQ6IHRhcmdldENpZCwgam9iTmFtZTogam9ibmFtZSwgIGdyYWRlTGV2ZWw6IGdyYWRlTGV2ZWwsIGpvYkxhYmVsOiBqb2JMYWJlbCwgZ3JhZGVMYWJlbDogZ3JhZGVMYWJlbCB9KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYmVlbiBoaXJlZCBpbiBhIG5ldyBqb2I6ICR7am9iTGFiZWx9IGFzICR7Z3JhZGVMYWJlbH1gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBjbGllbnQsIGpvYm5hbWUpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgQWRkZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7dGFyZ2V0Q2lkfSBoYXMgYmVlbiBhZGRlZCB0byAke2pvYm5hbWV9IHwgTmV3IFJhbms6ICR7Z3JhZGVMYWJlbH0gYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSB8IGNpdGl6ZW5JZDogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG59KVxuXG5zZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGpvYkFycmF5OiBhbnkgPSB7fTtcbiAgICBjb25zdCBqb2JEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnc3VtbWl0X2pvYnMnLCB7fSk7XG4gICAgam9iRGF0YS5mb3JFYWNoKGFzeW5jIChqb2I6IGFueSkgPT4ge1xuICAgICAgICBjb25zdCB7IF9pZCwgLi4ucmVzdCB9ID0gam9iO1xuICAgICAgICBMT0dHRVIoYFtTVU1NSVRfUEhPTkVdIENyZWF0ZWQgam9iICR7X2lkfSBTdWNjZXNzZnVsbHlgKTtcbiAgICAgICAgam9iQXJyYXlbX2lkXSA9IHJlc3Q7XG4gICAgfSk7XG4gICAgLyogY29uc3QgW3VwZGF0ZWQsIG1lc3NhZ2VdID0gZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkFkZEpvYnMoam9iQXJyYXkpOyAqL1xufSk7ICIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgUGhvbmVNYWlsLCBQaG9uZVBsYXllckNhcmQgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4vY2xhc3NcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0dldENsaWVudFNldHRpbmdzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBhd2FpdCBTZXR0aW5ncy5lbnN1cmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIF9pZDogU2V0dGluZ3MuX2lkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBiYWNrZ3JvdW5kOiBTZXR0aW5ncy5iYWNrZ3JvdW5kLmdldChjaXRpemVuSWQpLFxuICAgICAgICBsb2Nrc2NyZWVuOiBTZXR0aW5ncy5sb2Nrc2NyZWVuLmdldChjaXRpemVuSWQpLFxuICAgICAgICByaW5ndG9uZTogU2V0dGluZ3MucmluZ3RvbmUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiBTZXR0aW5ncy5zaG93U3RhcnR1cFNjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgc2hvd05vdGlmaWNhdGlvbnM6IFNldHRpbmdzLnNob3dOb3RpZmljYXRpb25zLmdldChjaXRpemVuSWQpLFxuICAgICAgICBpc0xvY2s6IFNldHRpbmdzLmlzTG9jay5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgbG9ja1BpbjogU2V0dGluZ3MubG9ja1Bpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgdXNlUGluOiBTZXR0aW5ncy51c2VQaW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHVzZUZhY2VJZDogU2V0dGluZ3MudXNlRmFjZUlkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiBTZXR0aW5ncy5mYWNlSWRJZGVudGlmaWVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICBzbXJ0SWQ6IFNldHRpbmdzLnNtcnRJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiBTZXR0aW5ncy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHNtcnRQYXNzd29yZDogU2V0dGluZ3Muc21ydFBhc3N3b3JkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBpc0ZsaWdodE1vZGU6IFNldHRpbmdzLmlzRmxpZ2h0TW9kZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgcGhvbmVOdW1iZXI6IFNldHRpbmdzLnBob25lTnVtYmVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICBwaWdlb25JZEF0dGFjaGVkOiBTZXR0aW5ncy5waWdlb25JZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1NldENsaWVudFNldHRpbmdzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGF3YWl0IFNldHRpbmdzLmVuc3VyZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZCk7XG4gICAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgICAgICBiYWNrZ3JvdW5kOiB7IGN1cnJlbnQ6IHN0cmluZzsgd2FsbHBhcGVyczogc3RyaW5nW10gfTtcbiAgICAgICAgbG9ja3NjcmVlbjogeyBjdXJyZW50OiBzdHJpbmc7IHdhbGxwYXBlcnM6IHN0cmluZ1tdIH07XG4gICAgICAgIHJpbmd0b25lOiB7IGN1cnJlbnQ6IHN0cmluZzsgcmluZ3RvbmVzOiB7IG5hbWU6IHN0cmluZywgdXJsOiBzdHJpbmcgfVtdIH07XG4gICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiBib29sZWFuO1xuICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogYm9vbGVhbjtcbiAgICAgICAgaXNMb2NrOiBib29sZWFuO1xuICAgICAgICBsb2NrUGluOiBzdHJpbmc7XG4gICAgICAgIHVzZVBpbjogYm9vbGVhbjtcbiAgICAgICAgdXNlRmFjZUlkOiBib29sZWFuO1xuICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiBzdHJpbmc7XG4gICAgICAgIHNtcnRJZDogc3RyaW5nO1xuICAgICAgICBkYXJrTWFpbElkQXR0YWNoZWQ6IHN0cmluZztcbiAgICAgICAgc21ydFBhc3N3b3JkOiBzdHJpbmc7XG4gICAgICAgIGlzRmxpZ2h0TW9kZTogYm9vbGVhbjtcbiAgICAgICAgcGhvbmVOdW1iZXI6IHN0cmluZztcbiAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogc3RyaW5nO1xuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIFNldHRpbmdzLmJhY2tncm91bmQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5iYWNrZ3JvdW5kKTtcbiAgICBTZXR0aW5ncy5sb2Nrc2NyZWVuLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEubG9ja3NjcmVlbik7XG4gICAgU2V0dGluZ3MucmluZ3RvbmUuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5yaW5ndG9uZSk7XG4gICAgU2V0dGluZ3Muc2hvd1N0YXJ0dXBTY3JlZW4uc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5zaG93U3RhcnR1cFNjcmVlbik7XG4gICAgU2V0dGluZ3Muc2hvd05vdGlmaWNhdGlvbnMuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5zaG93Tm90aWZpY2F0aW9ucyk7XG4gICAgU2V0dGluZ3MuaXNMb2NrLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuaXNMb2NrKTtcbiAgICBTZXR0aW5ncy5sb2NrUGluLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEubG9ja1Bpbik7XG4gICAgU2V0dGluZ3MudXNlUGluLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEudXNlUGluKTtcbiAgICBTZXR0aW5ncy51c2VGYWNlSWQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS51c2VGYWNlSWQpO1xuICAgIFNldHRpbmdzLmZhY2VJZElkZW50aWZpZXIuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5mYWNlSWRJZGVudGlmaWVyKTtcbiAgICBTZXR0aW5ncy5zbXJ0SWQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5zbXJ0SWQpO1xuICAgIFNldHRpbmdzLnNtcnRQYXNzd29yZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnNtcnRQYXNzd29yZCk7XG4gICAgU2V0dGluZ3MuaXNGbGlnaHRNb2RlLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuaXNGbGlnaHRNb2RlKTtcbiAgICBTZXR0aW5ncy5kYXJrTWFpbElkQXR0YWNoZWQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5kYXJrTWFpbElkQXR0YWNoZWQpO1xuICAgIFNldHRpbmdzLnBob25lTnVtYmVyLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEucGhvbmVOdW1iZXIpO1xuICAgIFNldHRpbmdzLnBpZ2VvbklkQXR0YWNoZWQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5waWdlb25JZEF0dGFjaGVkKTtcbiAgICBhd2FpdCBTZXR0aW5ncy5TYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX3NldHRpbmdzJyxcbiAgICAgICAgdGl0bGU6ICdTZXR0aW5ncyBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7Y2l0aXplbklkfSB8IE5hbWU6ICR7Z2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IG5ldyBzZXR0aW5ncywgJHtKU09OLnN0cmluZ2lmeShwYXJzZWREYXRhKX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnUmVnaXN0ZXJOZXdNYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgZW1haWw6IHN0cmluZztcbiAgICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBkYXRhWDogUGhvbmVNYWlsID0ge1xuICAgICAgICBhY3RpdmVNYWlkSWQ6IHBhcnNlZERhdGEuZW1haWwsXG4gICAgICAgIHVzZXJuYW1lOiBwYXJzZWREYXRhLmVtYWlsLFxuICAgICAgICBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhcnNlZERhdGEucGFzc3dvcmQsXG4gICAgICAgIGF2YXRvcjogJycsXG4gICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICB9XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogcGFyc2VkRGF0YS5lbWFpbCwgLi4uZGF0YVggfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9lbWFpbCcsXG4gICAgICAgIHRpdGxlOiAnRW1haWwgQWNjb3VudCBSZWdpc3RlcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYE5ldyBlbWFpbCBhY2NvdW50IHJlZ2lzdGVyZWQgd2l0aCBlbWFpbCAke3BhcnNlZERhdGEuZW1haWx9LCBwYXNzd29yZCBcIiR7cGFyc2VkRGF0YS5wYXNzd29yZH1cIiwgQ2l0aXplbklkOiAke2F3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KX0sIE5hbWU6ICR7Z2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnU2VhcmNoRW1haWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tYWlsJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnTG9naW5NYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgZW1haWw6IHN0cmluZztcbiAgICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogcGFyc2VkRGF0YS5lbWFpbCB9KTtcbiAgICBpZiAocmVzLmFjdGl2ZU1haWxQYXNzd29yZCA9PT0gcGFyc2VkRGF0YS5wYXNzd29yZCkge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9lbWFpbCcsXG4gICAgICAgICAgICB0aXRsZTogJ0VtYWlsIExvZ2luJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2dsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KX0gTmFtZTogJHtnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0gbG9nZ2VkIGluIHRvIGVtYWlsIGFjY291bnQgJHtwYXJzZWREYXRhLmVtYWlsfSwgcGFzc3dvcmQgXCIke3BhcnNlZERhdGEucGFzc3dvcmR9XCJgLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd1bkxvY2tvckxvY2tQaG9uZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IGJvb2xlYW4pID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgU2V0dGluZ3MuaXNMb2NrLnNldChjaXRpemVuSWQsIGRhdGEpO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldFBob25lUGxheWVyQ2FyZCcsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9wbGF5ZXJfY2FyZCcsIHsgX2lkOiBjaXRpemVuSWQgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6dXBkYXRlUGVyc29uYWxDYXJkJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YTogUGhvbmVQbGF5ZXJDYXJkID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfcGxheWVyX2NhcmQnLCB7IF9pZDogcGFyc2VkRGF0YS5faWQgfSwgcGFyc2VkRGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9wZXJzb25hbF9jYXJkJyxcbiAgICAgICAgdGl0bGU6ICdQZXJzb25hbCBDYXJkIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtwYXJzZWREYXRhLl9pZH0gfCBOYW1lOiAke2dsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSB1cGRhdGVkIHBlcnNvbmFsIGNhcmQsICR7SlNPTi5zdHJpbmdpZnkocGFyc2VkRGF0YSl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG4iLCAiaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi9jbGFzc1wiO1xuaW1wb3J0IHsgdHJpZ2dlckNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuXG5SZWdpc3RlckNvbW1hbmQoJ3NhdmVTZXR0aW5ncycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICBhd2FpdCBTZXR0aW5ncy5zYXZlKCk7XG59LCB0cnVlKTtcblxuY29uc3QgZ2VuZXJhdGVQaG9uZU51bWJlciA9IGFzeW5jICgpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICAgIGNvbnN0IG51bWJlciA9IGA1NTkke01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwXzAwMF8wMDApLnRvU3RyaW5nKCkucGFkU3RhcnQoNywgXCIwXCIpfWA7XG4gICAgY29uc3QgZXhpc3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9udW1iZXJzJywgeyBudW1iZXI6IG51bWJlciB9KTtcbiAgICBpZiAoZXhpc3RzKSByZXR1cm4gZ2VuZXJhdGVQaG9uZU51bWJlcigpO1xuICAgIHJldHVybiBudW1iZXI7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBHZW5lcmF0ZVBsYXllclBob25lTnVtYmVyKGNpdGl6ZW5JZDogc3RyaW5nLCBzb3VyY2U6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IGdlbmVyYXRlUGhvbmVOdW1iZXIoKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbnVtYmVycycsIHtcbiAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgb3duZXI6IGNpdGl6ZW5JZCxcbiAgICAgICAgbnVtYmVyOiBudW1iZXIsXG4gICAgfSk7XG5cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7XG4gICAgICAgIF9pZDogY2l0aXplbklkLFxuICAgICAgICBiYWNrZ3JvdW5kOiB7XG4gICAgICAgICAgICBjdXJyZW50OiAnJyxcbiAgICAgICAgICAgIHdhbGxwYXBlcnM6IFtdLFxuICAgICAgICB9LFxuICAgICAgICBsb2Nrc2NyZWVuOiB7XG4gICAgICAgICAgICBjdXJyZW50OiAnJyxcbiAgICAgICAgICAgIHdhbGxwYXBlcnM6IFtdLFxuICAgICAgICB9LFxuICAgICAgICByaW5ndG9uZToge1xuICAgICAgICAgICAgY3VycmVudDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLFxuICAgICAgICAgICAgcmluZ3RvbmVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGVmYXVsdCcsXG4gICAgICAgICAgICAgICAgICAgIHVybDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0cnVlLFxuICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdHJ1ZSxcbiAgICAgICAgaXNMb2NrOiB0cnVlLFxuICAgICAgICBsb2NrUGluOiAnJyxcbiAgICAgICAgdXNlUGluOiB0cnVlLFxuICAgICAgICBwaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgICB1c2VGYWNlSWQ6IGZhbHNlLFxuICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiBjaXRpemVuSWQsXG4gICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogJycsXG4gICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6ICcnLFxuICAgICAgICBzbXJ0SWQ6ICcnLFxuICAgICAgICBzbXJ0UGFzc3dvcmQ6ICcnLFxuICAgICAgICBpc0ZsaWdodE1vZGU6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX3BsYXllcl9jYXJkJywge1xuICAgICAgICBfaWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgZmlyc3ROYW1lOiAnU2V0dXAnLFxuICAgICAgICBsYXN0TmFtZTogJ0NhcmQnLFxuICAgICAgICBwaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgICBlbWFpbDogJycsXG4gICAgICAgIG5vdGVzOiAnJyxcbiAgICAgICAgYXZhdGFyOiAnJyxcbiAgICB9KTtcbiAgICBTZXR0aW5ncy5SZWdpc3Rlck5ld1NldHRpbmdzKGNpdGl6ZW5JZCwgbnVtYmVyKTtcblx0aWYgKHNvdXJjZSkge1xuXHRcdGVtaXROZXQoJ3Bob25lOmNsaWVudDpzZXR1cFBob25lJywgc291cmNlLCBjaXRpemVuSWQpO1xuXHR9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9zZXR0aW5ncycsXG4gICAgICAgIHRpdGxlOiAnUGhvbmUgTnVtYmVyIEdlbmVyYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQaG9uZSBudW1iZXIgJHtudW1iZXJ9IGdlbmVyYXRlZCBmb3IgJHtjaXRpemVuSWR9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlLFxuICAgIH0pO1xuICAgIHJldHVybiBudW1iZXI7XG59XG5leHBvcnRzKCdHZW5lcmF0ZVBsYXllclBob25lTnVtYmVyJywgR2VuZXJhdGVQbGF5ZXJQaG9uZU51bWJlcik7XG5cbm9uKCd0eEFkbWluOmV2ZW50czpzY2hlZHVsZWRSZXN0YXJ0JywgYXN5bmMgKGRhdGE6IGFueSkgPT4ge1xuICAgIGF3YWl0IFNldHRpbmdzLnNhdmUoKTtcbiAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgZHVyaW5nIHJlc291cmNlIHN0b3AuYCk7XG59KTtcblxub24oJ3R4QWRtaW46ZXZlbnRzOnNlcnZlclNodXR0aW5nRG93bicsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBTZXR0aW5ncy5zYXZlKCk7XG4gICAgTE9HR0VSKGBbU2V0dGluZ3NdIFNhdmVkIGR1cmluZyByZXNvdXJjZSBzdG9wLmApO1xufSk7IiwgImltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgVHdlZXREYXRhLCBUd2VldFByb2ZpbGVEYXRhIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmNsYXNzIFBpZ2VvblNlcnZpY2Uge1xuICAgIHB1YmxpYyBhc3luYyBzZWFyY2hVc2VyRXhpc3QoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IGRhdGEgfSk7XG4gICAgICAgIHJldHVybiAhIXVzZXI7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGxvZ2luKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsLCBwYXNzd29yZCB9KTtcbiAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1VzZXIgTG9naW4nLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciB3aXRoIGVtYWlsICR7ZW1haWx9IGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHkuYCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gbG9naW46XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzaWdudXAoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdVc2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGlmIChleGlzdGluZ1VzZXIpIHtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkVtYWlsIGFscmVhZHkgdGFrZW5cIiB9O1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBlbWFpbCxcbiAgICAgICAgICAgIHBhc3N3b3JkLFxuICAgICAgICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgICAgICAgdXNlcm5hbWU6IGVtYWlsLFxuICAgICAgICAgICAgZGlzcGxheU5hbWU6IGVtYWlsLFxuICAgICAgICAgICAgYXZhdGFyOiBcIlwiLFxuICAgICAgICAgICAgYmFubmVyOiBcIlwiLFxuICAgICAgICAgICAgbm90aWZpY2F0aW9uc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGJpbzogXCJcIixcbiAgICAgICAgICAgIGZvbGxvd2VyczogW10sXG4gICAgICAgICAgICBmb2xsb3dpbmc6IFtdLFxuICAgICAgICB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnVXNlciBTaWdudXAnLFxuICAgICAgICAgICAgbWVzc2FnZTogYE5ldyB1c2VyIGFjY291bnQgY3JlYXRlZCB3aXRoIGVtYWlsICR7ZW1haWx9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRQcm9maWxlKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh1c2VyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBcIlVzZXIgbm90IGZvdW5kXCI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgdG9nZ2xlTm90aWZpY2F0aW9ucyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgIHJlcy5ub3RpZmljYXRpb25zRW5hYmxlZCA9ICFyZXMubm90aWZpY2F0aW9uc0VuYWJsZWQ7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0sIHJlcyk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ05vdGlmaWNhdGlvbnMgVG9nZ2xlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gdG9nZ2xlZCBub3RpZmljYXRpb25zIHRvICR7cmVzLm5vdGlmaWNhdGlvbnNFbmFibGVkID8gJ2VuYWJsZWQnIDogJ2Rpc2FibGVkJ30uYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcG9zdFR3ZWV0KF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyBlbWFpbCwgY29udGVudCwgYXR0YWNobWVudHMgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghcmVzKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHR3ZWV0OiBUd2VldERhdGEgPSB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB1c2VybmFtZTogcmVzLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgICAgIGVtYWlsOiByZXMuZW1haWwsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiByZXMuYXZhdGFyLFxuICAgICAgICAgICAgICAgIHZlcmlmaWVkOiByZXMudmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgICAgICBhdHRhY2htZW50cyxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBsaWtlQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgIHJlcGxpZXNDb3VudDogW10sXG4gICAgICAgICAgICAgICAgcmV0d2VldENvdW50OiBbXSxcbiAgICAgICAgICAgICAgICBpc1JldHdlZXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXRJZDogbnVsbCxcbiAgICAgICAgICAgICAgICBoYXNodGFnczogY29udGVudC5tYXRjaCgvI1xcdysvZykgfHwgW10sXG4gICAgICAgICAgICAgICAgcGFyZW50VHdlZXRJZDogbnVsbCxcblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB0d2VldCk7XG4gICAgICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmVmcmVzaFR3ZWV0XCIsIC0xLCBKU09OLnN0cmluZ2lmeSh0d2VldCkpO1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgLTEsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgVHdlZXQnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtyZXMuZGlzcGxheU5hbWV9IGhhcyBwb3N0ZWQgYSBuZXcgdHdlZXQuYCxcbiAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgY29udGVudDogYCR7cmVzLmRpc3BsYXlOYW1lfSBoYXMgcG9zdGVkIGEgbmV3IHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgZW1haWw6IHJlcy5lbWFpbCxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcInBvc3RcIixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBQb3N0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IHBvc3RlZCBhIG5ldyB0d2VldCAoSUQ6ICR7dHdlZXQuX2lkfSksIGNvbnRlbnQ6ICR7Y29udGVudH1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gcG9zdFR3ZWV0OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QWxsRmVlZChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHN0YXJ0ID0gMSwgZW5kID0gMjAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7fSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgICAgICBza2lwOiBzdGFydCAtIDEsXG4gICAgICAgICAgICAgICAgbGltaXQ6IGVuZCxcbiAgICAgICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgZGF0YTogcmVzLFxuICAgICAgICAgICAgICAgIGxlbmd0aDogcmVzLmxlbmd0aCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldEZlZWQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBwb3N0UmVwbHkoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgY29udGVudCwgZW1haWwsIGF0dGFjaG1lbnRzIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBjb25zdCB0d2VldDogVHdlZXREYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgY29uc3QgcmVwbHkgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdXNlcm5hbWU6IHVzZXIuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgICAgICAgIGF2YXRhcjogdXNlci5hdmF0YXIsXG4gICAgICAgICAgICB2ZXJpZmllZDogdXNlci52ZXJpZmllZCxcbiAgICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgICBhdHRhY2htZW50cyxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgbGlrZUNvdW50OiBbXSxcbiAgICAgICAgICAgIHJlcGxpZXNDb3VudDogW10sXG4gICAgICAgICAgICByZXR3ZWV0Q291bnQ6IFtdLFxuICAgICAgICAgICAgaXNSZXR3ZWV0OiBmYWxzZSxcbiAgICAgICAgICAgIG9yaWdpbmFsVHdlZXRJZDogdHdlZXRJZCxcbiAgICAgICAgICAgIGhhc2h0YWdzOiBjb250ZW50Lm1hdGNoKC8jXFx3Ky9nKSB8fCBbXSxcbiAgICAgICAgICAgIHBhcmVudFR3ZWV0SWQ6IG51bGxcbiAgICAgICAgfTtcbiAgICAgICAgdHdlZXQucmVwbGllc0NvdW50LnB1c2goY2l0aXplbklkKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgcmVwbHkpO1xuICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmVmcmVzaFJlcG9zdFwiLCAtMSwgSlNPTi5zdHJpbmdpZnkocmVwbHkpKTtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGF3YWl0IFV0aWxzLkdldENpZEZyb21Ud2VldElkKHR3ZWV0LmVtYWlsKSk7XG4gICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlcy5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBSZXBseScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3VzZXIuZGlzcGxheU5hbWV9IGhhcyByZXBsaWVkIHRvIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAncGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl9ub3RpZmljYXRpb25zXCIsIHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGAke3VzZXIuZGlzcGxheU5hbWV9IGhhcyByZXBsaWVkIHRvIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgZW1haWw6IHR3ZWV0LmVtYWlsLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwicG9zdFwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUmVwbHkgUG9zdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IHJlcGxpZWQgdG8gdHdlZXQgKElEOiAke3R3ZWV0SWR9KSwgY29udGVudDogJHtjb250ZW50fWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbGlrZVR3ZWV0KF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgbGlrZSwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgaWYgKGxpa2UpIHtcbiAgICAgICAgICAgIHR3ZWV0Lmxpa2VDb3VudC5wdXNoKGVtYWlsKTtcbiAgICAgICAgICAgIGNvbnN0IGNpZCA9IGF3YWl0IFV0aWxzLkdldENpZEZyb21Ud2VldElkKHR3ZWV0LmVtYWlsKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaWQpO1xuICAgICAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlcy5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnTmV3IExpa2UnLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7ZW1haWx9IGhhcyBsaWtlZCB5b3VyIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGAke2VtYWlsfSBoYXMgbGlrZWQgeW91ciB0d2VldC5gLFxuICAgICAgICAgICAgICAgICAgICBlbWFpbDogdHdlZXQuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImxpa2VcIixcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgTGlrZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGxpa2VkIHR3ZWV0IChJRDogJHt0d2VldElkfSkuYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHR3ZWV0Lmxpa2VDb3VudCA9IHR3ZWV0Lmxpa2VDb3VudC5maWx0ZXIoKGw6IGFueSkgPT4gbCAhPT0gZW1haWwpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBMaWtlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gbGlrZWQgdHdlZXQgKElEOiAke3R3ZWV0SWR9KS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBsaWtlUmVwbGllc1R3ZWV0KF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgbGlrZSwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSByZXR1cm4gY29uc29sZS5sb2coXCJUd2VldCBub3QgZm91bmRcIik7XG4gICAgICAgIGlmIChsaWtlKSB7XG4gICAgICAgICAgICB0d2VldC5saWtlQ291bnQucHVzaChlbWFpbCk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1JlcGx5IExpa2VkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBsaWtlZCByZXBseSAoSUQ6ICR7dHdlZXRJZH0pLmAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0d2VldC5saWtlQ291bnQgPSB0d2VldC5saWtlQ291bnQuZmlsdGVyKChsOiBhbnkpID0+IGwgIT09IGVtYWlsKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUmVwbHkgVW5saWtlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gdW5saWtlZCByZXBseSAoSUQ6ICR7dHdlZXRJZH0pLmAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcmV0d2VldChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgcmV0d2VldCwgcGlnZW9uSWQsIG9nVHdlZXRJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0V2VldHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcGlnZW9uSWQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcmlnaW5hbFR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIk9yaWdpbmFsIHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50LnB1c2goY2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgb3JpZ2luYWxUd2VldCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCByZXR3ZWV0RGF0YTogVHdlZXREYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB1c2VybmFtZTogcmV0V2VldHVzZXIuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGVtYWlsOiByZXRXZWV0dXNlci5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgYXZhdGFyOiByZXRXZWV0dXNlci5hdmF0YXIsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiByZXRXZWV0dXNlci52ZXJpZmllZCxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogb3JpZ2luYWxUd2VldC5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50czogb3JpZ2luYWxUd2VldC5hdHRhY2htZW50cyxcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJlcGxpZXNDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJldHdlZXRDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIGlzUmV0d2VldDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiB0d2VldElkLFxuICAgICAgICAgICAgICAgICAgICBoYXNodGFnczogb3JpZ2luYWxUd2VldC5oYXNodGFncyxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VHdlZXRJZDogbnVsbCxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCByZXR3ZWV0RGF0YSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJlZnJlc2hUd2VldFwiLCAtMSwgSlNPTi5zdHJpbmdpZnkocmV0d2VldERhdGEpKTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgUmV0d2VldGVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtwaWdlb25JZH0gcmV0d2VldGVkIHR3ZWV0IChJRDogJHt0d2VldElkfSksIG9yaWdpbmFsIHR3ZWV0IElEOiAke29nVHdlZXRJZH0sIGNvbnRlbnQ6ICR7b3JpZ2luYWxUd2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbFR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb2dUd2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWxUd2VldCB8fCAhcmV0d2VldCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJPcmlnaW5hbCB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBvbmx5IGZpcnN0IG9jY3VycmVuY2Ugb2YgY2l0aXplbklkXG4gICAgICAgICAgICAgICAgbGV0IHJlbW92ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudCA9IG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50LmZpbHRlcigobDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsID09PSBjaXRpemVuSWQgJiYgIXJlbW92ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb2dUd2VldElkIH0sIG9yaWdpbmFsVHdlZXQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUmV0d2VldCBSZW1vdmVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgcmVtb3ZlZCByZXR3ZWV0IChJRDogJHt0d2VldElkfSkgb2Ygb3JpZ2luYWwgdHdlZXQgKElEOiAke29nVHdlZXRJZH0pLCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiByZXR3ZWV0OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcmV0d2VldFJlcGxpZXNUd2VldChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgcmV0d2VldCwgcGlnZW9uSWQsIG9nVHdlZXRJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvZ1R3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb3JpZ2luYWxUd2VldC5vcmlnaW5hbFR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0V2VldHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcGlnZW9uSWQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcmlnaW5hbFR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIk9yaWdpbmFsIHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50LnB1c2goY2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICBvZ1R3ZWV0LnJlcGxpZXNDb3VudC5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiBvcmlnaW5hbFR3ZWV0Lm9yaWdpbmFsVHdlZXRJZCB9LCBvZ1R3ZWV0KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9LCBvcmlnaW5hbFR3ZWV0KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHJldHdlZXREYXRhOiBUd2VldERhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIHVzZXJuYW1lOiByZXRXZWV0dXNlci5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZW1haWw6IHJldFdlZXR1c2VyLmVtYWlsLFxuICAgICAgICAgICAgICAgICAgICBhdmF0YXI6IHJldFdlZXR1c2VyLmF2YXRhcixcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHJldFdlZXR1c2VyLnZlcmlmaWVkLFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBvcmlnaW5hbFR3ZWV0LmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBvcmlnaW5hbFR3ZWV0LmF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgbGlrZUNvdW50OiBbXSxcbiAgICAgICAgICAgICAgICAgICAgcmVwbGllc0NvdW50OiBbXSxcbiAgICAgICAgICAgICAgICAgICAgcmV0d2VldENvdW50OiBbXSxcbiAgICAgICAgICAgICAgICAgICAgaXNSZXR3ZWV0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0SWQ6IG9yaWdpbmFsVHdlZXQub3JpZ2luYWxUd2VldElkLFxuICAgICAgICAgICAgICAgICAgICBoYXNodGFnczogb3JpZ2luYWxUd2VldC5oYXNodGFncyxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VHdlZXRJZDogdHdlZXRJZCxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHJldHdlZXREYXRhKTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmVmcmVzaFJlcG9zdFwiLCAtMSwgSlNPTi5zdHJpbmdpZnkocmV0d2VldERhdGEpKTtcbiAgICAgICAgICAgICAgICBpZiAob2dUd2VldC5yZXBsaWVzQ291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdW5pcXVlQ2lkcyA9IFsuLi5uZXcgU2V0KG9nVHdlZXQucmVwbGllc0NvdW50KV07XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcmVwbHlDaWQgb2YgdW5pcXVlQ2lkcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKHJlcGx5Q2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlcy5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBSZXBseScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3JldFdlZXR1c2VyLmRpc3BsYXlOYW1lfSBoYXMgcmVwbGllZCB0byB0d2VldC5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBge3JldFdlZXR1c2VyLmRpc3BsYXlOYW1lfSBoYXMgcmVwbGllZCB0byB0d2VldC5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtYWlsOiByZXRXZWV0dXNlci5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInBvc3RcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBSZXR3ZWV0ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke3BpZ2VvbklkfSByZXR3ZWV0ZWQgcmVwbHkgKElEOiAke3R3ZWV0SWR9KSwgb3JpZ2luYWwgdHdlZXQgSUQ6ICR7b2dUd2VldElkfSksIGNvbnRlbnQ6ICR7b3JpZ2luYWxUd2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbFR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiBvZ1R3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIW9yaWdpbmFsVHdlZXQgfHwgIXJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiT3JpZ2luYWwgdHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgb25seSBmaXJzdCBvY2N1cnJlbmNlIG9mIGNpdGl6ZW5JZFxuICAgICAgICAgICAgICAgIGxldCByZW1vdmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQgPSBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudC5maWx0ZXIoKGw6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobCA9PT0gY2l0aXplbklkICYmICFyZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudCk7ICovXG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IG9nVHdlZXRJZCB9LCBvcmlnaW5hbFR3ZWV0KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUmV0d2VldCBvZiBSZXBseSBSZW1vdmVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgcmVtb3ZlZCByZXR3ZWV0IChJRDogJHt0d2VldElkfSkgb2YgcmVwbHkgKElEOiAke29nVHdlZXRJZH0pLCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiByZXR3ZWV0OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGVsZXRlVHdlZXQoX2NsaWVudDogbnVtYmVyLCB0d2VldElkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBUd2VldCBub3QgZm91bmQgZm9yIGRlbGV0aW9uOiAke3R3ZWV0SWR9YCk7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBEZWxldGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBUd2VldCAoSUQ6ICR7dHdlZXRJZH0pIGRlbGV0ZWQgYnkgdXNlciAke3R3ZWV0LmVtYWlsfSwgY29udGVudDogJHt0d2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGVsZXRlUmVwbGllc1R3ZWV0KF9jbGllbnQ6IG51bWJlciwgdHdlZXRJZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBSZXBseSB0d2VldCBub3QgZm91bmQgZm9yIGRlbGV0aW9uOiAke3R3ZWV0SWR9YCk7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJSZXBseSB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1JlcGx5IERlbGV0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFJlcGx5IChJRDogJHt0d2VldElkfSkgZGVsZXRlZCwgY29udGVudDogJHt0d2VldC5jb250ZW50fSBieSB1c2VyICR7dHdlZXQuZW1haWx9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0UG9zdFJlcGxpZXMoX2NsaWVudDogbnVtYmVyLCB0d2VldElkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVwbGllcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBvcmlnaW5hbFR3ZWV0SWQ6IHR3ZWV0SWQgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVwbGllcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGluY3JlYXNlUmVwbGllc0NvdW50KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgdHdlZXQucmVwbGllc0NvdW50LnB1c2goYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCkpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBkZWNyZWFzZVJlcGxpZXNDb3VudChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgdHdlZXRJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IGNpZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICBpZiAoIXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgVHdlZXQgbm90IGZvdW5kIGZvciB0d2VldElkOiAke3R3ZWV0SWR9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IHJlbW92ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHR3ZWV0LnJlcGxpZXNDb3VudCA9IHR3ZWV0LnJlcGxpZXNDb3VudC5maWx0ZXIoKHI6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyID09PSBjaWQgJiYgIXJlbW92ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc3QgdXBkYXRlUmVzdWx0ID0gYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtcblxuICAgICAgICAgICAgaWYgKCF1cGRhdGVSZXN1bHQgfHwgdXBkYXRlUmVzdWx0Lm1vZGlmaWVkQ291bnQgPT09IDApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYE5vIGNoYW5nZXMgbWFkZSB0byB0d2VldCAke3R3ZWV0SWR9IHJlcGxpZXNDb3VudGApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBcIk5vIGNoYW5nZXMgbWFkZSB0byByZXBsaWVzIGNvdW50XCIgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLyogY29uc29sZS5sb2coYFN1Y2Nlc3NmdWxseSBkZWNyZWFzZWQgcmVwbGllc0NvdW50IGZvciB0d2VldCAke3R3ZWV0SWR9YCk7ICovXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBkZWNyZWFzZVJlcGxpZXNDb3VudDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiwgZGV0YWlsczogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGZvbGxvd1VzZXIoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyB0YXJnZXRFbWFpbCwgY3VycmVudEVtYWlsLCBmb2xsb3cgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRVc2VyOiBUd2VldFByb2ZpbGVEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHRhcmdldEVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCF0YXJnZXRVc2VyKSByZXR1cm4geyBlcnJvcjogXCJUYXJnZXQgdXNlciBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50VXNlcjogVHdlZXRQcm9maWxlRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBjdXJyZW50RW1haWwgfSk7XG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRVc2VyKSByZXR1cm4geyBlcnJvcjogXCJDdXJyZW50IHVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgaWYgKGZvbGxvdykge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXNlci5mb2xsb3dlcnMuaW5jbHVkZXMoY3VycmVudEVtYWlsKSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRVc2VyLmZvbGxvd2Vycy5wdXNoKGN1cnJlbnRFbWFpbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghY3VycmVudFVzZXIuZm9sbG93aW5nLmluY2x1ZGVzKHRhcmdldEVtYWlsKSkge1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50VXNlci5mb2xsb3dpbmcucHVzaCh0YXJnZXRFbWFpbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdVc2VyIEZvbGxvd2VkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtjdXJyZW50RW1haWx9IGZvbGxvd2VkICR7dGFyZ2V0RW1haWx9LmAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0VXNlci5mb2xsb3dlcnMgPSB0YXJnZXRVc2VyLmZvbGxvd2Vycy5maWx0ZXIoZW1haWwgPT4gZW1haWwgIT09IGN1cnJlbnRFbWFpbCk7XG4gICAgICAgICAgICAgICAgY3VycmVudFVzZXIuZm9sbG93aW5nID0gY3VycmVudFVzZXIuZm9sbG93aW5nLmZpbHRlcihlbWFpbCA9PiBlbWFpbCAhPT0gdGFyZ2V0RW1haWwpO1xuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdVc2VyIFVuZm9sbG93ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2N1cnJlbnRFbWFpbH0gdW5mb2xsb3dlZCAke3RhcmdldEVtYWlsfS5gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHRhcmdldEVtYWlsIH0sIHRhcmdldFVzZXIpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogY3VycmVudEVtYWlsIH0sIGN1cnJlbnRVc2VyKTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGZvbGxvd1VzZXI6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHVwZGF0aW5nIGZvbGxvdyBzdGF0dXNcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldFVzZXJUd2VldHMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBlbWFpbCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRBbGxQb3N0UmVwbGllcyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgZW1haWw6IGVtYWlsIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldEFsbExpa2VkVHdlZXRzKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgbGlrZUNvdW50OiBlbWFpbCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzZWFyY2hVc2VycyhfY2xpZW50OiBudW1iZXIsIHZhbHVlOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHsgJHJlZ2V4OiB2YWx1ZSwgJG9wdGlvbnM6IFwiaVwiIH0gfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0Tm90aWZpY2F0aW9ucyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwgeyBlbWFpbCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBjaGFuZ2VQYXNzd29yZChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGlmICghdXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuICAgICAgICBjb25zdCBvbGRQYXNzd29yZCA9IHVzZXIucGFzc3dvcmQ7XG4gICAgICAgIHVzZXIucGFzc3dvcmQgPSBwYXNzd29yZDtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9LCB1c2VyKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUGFzc3dvcmQgQ2hhbmdlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBjaGFuZ2VkIHRoZWlyIHBhc3N3b3JkLCBvbGQgcGFzc3dvcmQ6ICR7b2xkUGFzc3dvcmR9LCBuZXcgcGFzc3dvcmQ6ICR7cGFzc3dvcmR9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBwdWJsaWMgYXN5bmMgdXBkYXRlUHJvZmlsZShfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHBhcnNlZERhdGE6IFR3ZWV0UHJvZmlsZURhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBvbGRVc2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHBhcnNlZERhdGEuZW1haWwgfSk7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBwYXJzZWREYXRhLmVtYWlsIH0sIHBhcnNlZERhdGEpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdQcm9maWxlIFVwZGF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtwYXJzZWREYXRhLmVtYWlsfSB1cGRhdGVkIHRoZWlyIHByb2ZpbGUsIG9sZCBkYXRhOiAke0pTT04uc3RyaW5naWZ5KG9sZFVzZXIpfSwgbmV3IGRhdGE6ICR7SlNPTi5zdHJpbmdpZnkocGFyc2VkRGF0YSl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBcInN1Y2Nlc3NcIjtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgdmVyaWZ5VXNlcihfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGlmICghdXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuICAgICAgICB1c2VyLnZlcmlmaWVkID0gdHJ1ZTtcbiAgICAgICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSwgdXNlcik7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1VzZXIgVmVyaWZpZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gaGFzIGJlZW4gdmVyaWZpZWQuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGUgTWVzc2FnaW5nIEZ1bmN0aW9uc1xuICAgIHB1YmxpYyBhc3luYyBzZW5kUHJpdmF0ZU1lc3NhZ2UoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBzZW5kZXJFbWFpbCwgcmVjaXBpZW50RW1haWwsIGNvbnRlbnQsIGF0dGFjaG1lbnRzID0gW10gfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZlcmlmeSBib3RoIHVzZXJzIGV4aXN0XG4gICAgICAgICAgICBjb25zdCBzZW5kZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogc2VuZGVyRW1haWwgfSk7XG4gICAgICAgICAgICBjb25zdCByZWNpcGllbnQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcmVjaXBpZW50RW1haWwgfSk7XG5cbiAgICAgICAgICAgIGlmICghc2VuZGVyIHx8ICFyZWNpcGllbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBzZW5kZXJFbWFpbCxcbiAgICAgICAgICAgICAgICByZWNpcGllbnRFbWFpbCxcbiAgICAgICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRlbGV0ZWRCeVNlbmRlcjogZmFsc2UsXG4gICAgICAgICAgICAgICAgZGVsZXRlZEJ5UmVjaXBpZW50OiBmYWxzZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCBtZXNzYWdlKTtcblxuICAgICAgICAgICAgLy8gR2V0IGFsbCBDaXRpemVuIElEcyBmb3IgYm90aCBzZW5kZXIgYW5kIHJlY2lwaWVudCAobXVsdGlwbGUgZGV2aWNlcyBzdXBwb3J0KVxuICAgICAgICAgICAgY29uc3Qgc2VuZGVyQ2lkcyA9IGF3YWl0IFV0aWxzLkdldENpZHNGcm9tUGlnZW9uRW1haWwoc2VuZGVyRW1haWwpO1xuICAgICAgICAgICAgY29uc3QgcmVjaXBpZW50Q2lkcyA9IGF3YWl0IFV0aWxzLkdldENpZHNGcm9tUGlnZW9uRW1haWwocmVjaXBpZW50RW1haWwpO1xuXG4gICAgICAgICAgICAvLyBTZW5kIG5vdGlmaWNhdGlvbnMgYW5kIHJlZnJlc2ggZXZlbnRzIHRvIGFsbCByZWNpcGllbnQgZGV2aWNlc1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWNpcGllbnRDaWQgb2YgcmVjaXBpZW50Q2lkcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlY2lwaWVudFBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZWNpcGllbnRDaWQpO1xuICAgICAgICAgICAgICAgIGlmIChyZWNpcGllbnRQbGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgcmVjaXBpZW50UGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IHJlY2VpdmVkIGEgbWVzc2FnZSBmcm9tICR7c2VuZGVyLmRpc3BsYXlOYW1lfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBOVUkgZXZlbnQgdG8gcmVmcmVzaCBjaGF0IGlmIHJlY2lwaWVudCBpcyBpbiBjaGF0XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOnJlZnJlc2hQcml2YXRlTWVzc2FnZScsIHJlY2lwaWVudFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlckVtYWlsOiBzZW5kZXJFbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlY2lwaWVudEVtYWlsOiByZWNpcGllbnRFbWFpbFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTZW5kIHJlZnJlc2ggZXZlbnQgdG8gYWxsIHNlbmRlciBkZXZpY2VzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHNlbmRlckNpZCBvZiBzZW5kZXJDaWRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VuZGVyUGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKHNlbmRlckNpZCk7XG4gICAgICAgICAgICAgICAgaWYgKHNlbmRlclBsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTpyZWZyZXNoUHJpdmF0ZU1lc3NhZ2UnLCBzZW5kZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXJFbWFpbDogc2VuZGVyRW1haWwsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWNpcGllbnRFbWFpbDogcmVjaXBpZW50RW1haWxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcml2YXRlIE1lc3NhZ2UgU2VudCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7c2VuZGVyRW1haWx9IHNlbnQgYSBwcml2YXRlIG1lc3NhZ2UgdG8gJHtyZWNpcGllbnRFbWFpbH1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlSWQ6IG1lc3NhZ2UuX2lkIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gc2VuZFByaXZhdGVNZXNzYWdlOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBzZW5kaW5nIG1lc3NhZ2VcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldFByaXZhdGVNZXNzYWdlcyhfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHVzZXJFbWFpbCwgb3RoZXJVc2VyRW1haWwsIGxpbWl0ID0gNTAsIG9mZnNldCA9IDAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgeyBzZW5kZXJFbWFpbDogdXNlckVtYWlsLCByZWNpcGllbnRFbWFpbDogb3RoZXJVc2VyRW1haWwgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBzZW5kZXJFbWFpbDogb3RoZXJVc2VyRW1haWwsIHJlY2lwaWVudEVtYWlsOiB1c2VyRW1haWwgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgJGFuZDogW1xuICAgICAgICAgICAgICAgICAgICB7IGRlbGV0ZWRCeVNlbmRlcjogeyAkbmU6IHRydWUgfSB9LFxuICAgICAgICAgICAgICAgICAgICB7IGRlbGV0ZWRCeVJlY2lwaWVudDogeyAkbmU6IHRydWUgfSB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfSxcbiAgICAgICAgICAgICAgICBza2lwOiBvZmZzZXQsXG4gICAgICAgICAgICAgICAgbGltaXQ6IGxpbWl0XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG1lc3NhZ2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBnZXRQcml2YXRlTWVzc2FnZXM6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIG1lc3NhZ2VzXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRDb252ZXJzYXRpb25zKF9jbGllbnQ6IG51bWJlciwgdXNlckVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IGFsbCB1bmlxdWUgY29udmVyc2F0aW9ucyBmb3IgdGhlIHVzZXJcbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbnMgPSBhd2FpdCBNb25nb0RCLmFnZ3JlZ2F0ZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRtYXRjaDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJG9yOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBzZW5kZXJFbWFpbDogdXNlckVtYWlsIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyByZWNpcGllbnRFbWFpbDogdXNlckVtYWlsIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAkYW5kOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBkZWxldGVkQnlTZW5kZXI6IHsgJG5lOiB0cnVlIH0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGRlbGV0ZWRCeVJlY2lwaWVudDogeyAkbmU6IHRydWUgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRncm91cDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJGNvbmQ6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAkZXE6IFtcIiRzZW5kZXJFbWFpbFwiLCB1c2VyRW1haWxdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiJHJlY2lwaWVudEVtYWlsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiJHNlbmRlckVtYWlsXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IHsgJGZpcnN0OiBcIiQkUk9PVFwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnJlYWRDb3VudDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICRzdW06IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJGNvbmQ6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgJGFuZDogW3sgJGVxOiBbXCIkcmVjaXBpZW50RW1haWxcIiwgdXNlckVtYWlsXSB9LCB7ICRlcTogW1wiJHJlYWRcIiwgZmFsc2VdIH1dIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRsb29rdXA6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyb206IFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEZpZWxkOiBcIl9pZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yZWlnbkZpZWxkOiBcImVtYWlsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhczogXCJ1c2VySW5mb1wiXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJHVud2luZDogXCIkdXNlckluZm9cIlxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkcHJvamVjdDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXJVc2VyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1haWw6IFwiJHVzZXJJbmZvLmVtYWlsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheU5hbWU6IFwiJHVzZXJJbmZvLmRpc3BsYXlOYW1lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXZhdGFyOiBcIiR1c2VySW5mby5hdmF0YXJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZDogXCIkdXNlckluZm8udmVyaWZpZWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IDFcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkc29ydDogeyBcImxhc3RNZXNzYWdlLmNyZWF0ZWRBdFwiOiAtMSB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXSk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShjb252ZXJzYXRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBnZXRDb252ZXJzYXRpb25zOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBjb252ZXJzYXRpb25zXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBtYXJrTWVzc2FnZUFzUmVhZChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IG1lc3NhZ2VJZCwgdXNlckVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgeyBfaWQ6IG1lc3NhZ2VJZCB9KTtcbiAgICAgICAgICAgIGlmICghbWVzc2FnZSkgcmV0dXJuIHsgZXJyb3I6IFwiTWVzc2FnZSBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICAvLyBPbmx5IG1hcmsgYXMgcmVhZCBpZiB0aGUgdXNlciBpcyB0aGUgcmVjaXBpZW50XG4gICAgICAgICAgICBpZiAobWVzc2FnZS5yZWNpcGllbnRFbWFpbCA9PT0gdXNlckVtYWlsKSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZS5yZWFkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHsgX2lkOiBtZXNzYWdlSWQgfSwgbWVzc2FnZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBtYXJrTWVzc2FnZUFzUmVhZDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgbWFya2luZyBtZXNzYWdlIGFzIHJlYWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGRlbGV0ZU1lc3NhZ2UoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBtZXNzYWdlSWQsIHVzZXJFbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHsgX2lkOiBtZXNzYWdlSWQgfSk7XG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UpIHJldHVybiB7IGVycm9yOiBcIk1lc3NhZ2Ugbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgLy8gTWFyayBhcyBkZWxldGVkIGJ5IHRoZSBhcHByb3ByaWF0ZSB1c2VyXG4gICAgICAgICAgICBpZiAobWVzc2FnZS5zZW5kZXJFbWFpbCA9PT0gdXNlckVtYWlsKSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZS5kZWxldGVkQnlTZW5kZXIgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChtZXNzYWdlLnJlY2lwaWVudEVtYWlsID09PSB1c2VyRW1haWwpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlLmRlbGV0ZWRCeVJlY2lwaWVudCA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIlVuYXV0aG9yaXplZFwiIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgeyBfaWQ6IG1lc3NhZ2VJZCB9LCBtZXNzYWdlKTtcblxuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNZXNzYWdlIERlbGV0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7dXNlckVtYWlsfSBkZWxldGVkIGEgcHJpdmF0ZSBtZXNzYWdlYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGRlbGV0ZU1lc3NhZ2U6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGRlbGV0aW5nIG1lc3NhZ2VcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gRW5oYW5jZWQgRm9sbG93ZXJzL0ZvbGxvd2luZyBGdW5jdGlvbnNcbiAgICBwdWJsaWMgYXN5bmMgZ2V0Rm9sbG93ZXJzKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgICAgICBpZiAoIXVzZXIpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgY29uc3QgZm9sbG93ZXJzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLFxuICAgICAgICAgICAgICAgIHsgZW1haWw6IHsgJGluOiB1c2VyLmZvbGxvd2VycyB9IH0sXG4gICAgICAgICAgICAgICAgbnVsbCwgZmFsc2UsXG4gICAgICAgICAgICAgICAgeyBzb3J0OiB7IGRpc3BsYXlOYW1lOiAxIH0gfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGZvbGxvd2Vycyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0Rm9sbG93ZXJzOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBmb2xsb3dlcnNcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldEZvbGxvd2luZyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGNvbnN0IGZvbGxvd2luZyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdXNlcnNcIixcbiAgICAgICAgICAgICAgICB7IGVtYWlsOiB7ICRpbjogdXNlci5mb2xsb3dpbmcgfSB9LFxuICAgICAgICAgICAgICAgIG51bGwsIGZhbHNlLFxuICAgICAgICAgICAgICAgIHsgc29ydDogeyBkaXNwbGF5TmFtZTogMSB9IH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShmb2xsb3dpbmcpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldEZvbGxvd2luZzpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgZm9sbG93aW5nXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuXG5leHBvcnQgY29uc3QgcGlnZW9uU2VydmljZSA9IG5ldyBQaWdlb25TZXJ2aWNlKCk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBwaWdlb25TZXJ2aWNlIH0gZnJvbSBcIi4vUGlnZW9uU2VydmljZVwiO1xuXG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnNlYXJjaFVzZXJzXCIsIHBpZ2VvblNlcnZpY2Uuc2VhcmNoVXNlckV4aXN0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246bG9naW5cIiwgcGlnZW9uU2VydmljZS5sb2dpbik7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnNpZ251cFwiLCBwaWdlb25TZXJ2aWNlLnNpZ251cCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnRvZ2dsZU5vdGlmaWNhdGlvbnNcIiwgcGlnZW9uU2VydmljZS50b2dnbGVOb3RpZmljYXRpb25zKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cG9zdFR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UucG9zdFR3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Z2V0UHJvZmlsZVwiLCBwaWdlb25TZXJ2aWNlLmdldFByb2ZpbGUpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpnZXRBbGxGZWVkXCIsIHBpZ2VvblNlcnZpY2UuZ2V0QWxsRmVlZCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmxpa2VUd2VldFwiLCBwaWdlb25TZXJ2aWNlLmxpa2VUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJldHdlZXRUd2VldFwiLCBwaWdlb25TZXJ2aWNlLnJldHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpkZWxldGVUd2VldFwiLCBwaWdlb25TZXJ2aWNlLmRlbGV0ZVR3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cG9zdFJlcGx5XCIsIHBpZ2VvblNlcnZpY2UucG9zdFJlcGx5KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Z2V0UmVwbGllc1wiLCBwaWdlb25TZXJ2aWNlLmdldFBvc3RSZXBsaWVzKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246bGlrZVJlcG9zdFR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UubGlrZVJlcGxpZXNUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJldHdlZXRSZXBvc3RUd2VldFwiLCBwaWdlb25TZXJ2aWNlLnJldHdlZXRSZXBsaWVzVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjppbmNyZWFzZVJlcGxpZXNDb3VudFwiLCBwaWdlb25TZXJ2aWNlLmluY3JlYXNlUmVwbGllc0NvdW50KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246ZGVjcmVhc2VSZXBsaWVzQ291bnRcIiwgcGlnZW9uU2VydmljZS5kZWNyZWFzZVJlcGxpZXNDb3VudCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmRlbGV0ZVJlcGxpZXNUd2VldFwiLCBwaWdlb25TZXJ2aWNlLmRlbGV0ZVJlcGxpZXNUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmZvbGxvd1VzZXJcIiwgcGlnZW9uU2VydmljZS5mb2xsb3dVc2VyKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Z2V0VXNlclR3ZWV0c1wiLCBwaWdlb25TZXJ2aWNlLmdldFVzZXJUd2VldHMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldEFsbFBvc3RSZXBsaWVzJywgcGlnZW9uU2VydmljZS5nZXRBbGxQb3N0UmVwbGllcyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0QWxsTGlrZWRUd2VldHMnLCBwaWdlb25TZXJ2aWNlLmdldEFsbExpa2VkVHdlZXRzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpzZWFyY2hVc2Vyc1gnLCBwaWdlb25TZXJ2aWNlLnNlYXJjaFVzZXJzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXROb3RpZmljYXRpb25zJywgcGlnZW9uU2VydmljZS5nZXROb3RpZmljYXRpb25zKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpjaGFuZ2VQYXNzd29yZCcsIHBpZ2VvblNlcnZpY2UuY2hhbmdlUGFzc3dvcmQpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOnVwZGF0ZVByb2ZpbGUnLCBwaWdlb25TZXJ2aWNlLnVwZGF0ZVByb2ZpbGUpO1xuXG4vLyBQcml2YXRlIE1lc3NhZ2luZyBDYWxsYmFja3Ncbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpzZW5kUHJpdmF0ZU1lc3NhZ2UnLCBwaWdlb25TZXJ2aWNlLnNlbmRQcml2YXRlTWVzc2FnZSk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0UHJpdmF0ZU1lc3NhZ2VzJywgcGlnZW9uU2VydmljZS5nZXRQcml2YXRlTWVzc2FnZXMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldENvbnZlcnNhdGlvbnMnLCAoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIHJldHVybiBwaWdlb25TZXJ2aWNlLmdldENvbnZlcnNhdGlvbnMoY2xpZW50LCBkYXRhKTtcbn0pO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOm1hcmtNZXNzYWdlQXNSZWFkJywgcGlnZW9uU2VydmljZS5tYXJrTWVzc2FnZUFzUmVhZCk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246ZGVsZXRlTWVzc2FnZScsIHBpZ2VvblNlcnZpY2UuZGVsZXRlTWVzc2FnZSk7XG5cbi8vIEVuaGFuY2VkIEZvbGxvd2Vycy9Gb2xsb3dpbmcgQ2FsbGJhY2tzXG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0Rm9sbG93ZXJzJywgcGlnZW9uU2VydmljZS5nZXRGb2xsb3dlcnMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldEZvbGxvd2luZycsIHBpZ2VvblNlcnZpY2UuZ2V0Rm9sbG93aW5nKTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25DbGllbnRDYWxsYmFjaygnZ2V0T3duZWRIb3VzZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IGFwYXJ0bWVudHMgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIHByb3BlcnR5X2lkLCBvd25lcl9jaXRpemVuaWQsIHN0cmVldCwgZGVzY3JpcHRpb24sIGhhc19hY2Nlc3MsIGRvb3JfZGF0YSwgYXBhcnRtZW50ICBGUk9NIHByb3BlcnRpZXMgV0hFUkUgb3duZXJfY2l0aXplbmlkID0gPyBBTkQgYXBhcnRtZW50IElTIE5PVCBOVUxMIEFORCBhcGFydG1lbnQgPD4gXCJcIicsIFtwbGF5ZXJdKTtcbiAgICBjb25zdCBob3VzZXMgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIHByb3BlcnR5X2lkLCBvd25lcl9jaXRpemVuaWQsIHN0cmVldCwgZGVzY3JpcHRpb24sIGhhc19hY2Nlc3MsIHNoZWxsLCBkb29yX2RhdGEgRlJPTSBwcm9wZXJ0aWVzIFdIRVJFIG93bmVyX2NpdGl6ZW5pZCA9ID8gQU5EIGFwYXJ0bWVudCBJUyBOVUxMJywgW3BsYXllcl0pO1xuICAgIGNvbnN0IHJlcyA9IHtcbiAgICAgICAgYXBhcnRtZW50czogYXBhcnRtZW50cyxcbiAgICAgICAgaG91c2VzOiBob3VzZXNcbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0S2V5SG9sZGVyTmFtZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhKSA9PiB7XG4gICAgY29uc3QgcmVzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBsZXQgbmFtZU1hcDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuXG4gICAgaWYgKHJlcyAmJiByZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBQcm9jZXNzIGFsbCBob3VzZXMgaW4gcGFyYWxsZWxcbiAgICAgICAgY29uc3QgYXBhcnRtZW50UHJvbWlzZXMgPSByZXMubWFwKChob3VzZTogc3RyaW5nKSA9PlxuICAgICAgICAgICAgVXRpbHMucXVlcnkoJ1NFTEVDVCBjaXRpemVuaWQsIGNoYXJpbmZvIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW2hvdXNlXSlcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBhbGxBcGFydG1lbnRzID0gYXdhaXQgUHJvbWlzZS5hbGwoYXBhcnRtZW50UHJvbWlzZXMpO1xuXG4gICAgICAgIGFsbEFwYXJ0bWVudHMuZm9yRWFjaChhcGFydG1lbnRzID0+IHtcbiAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGFwYXJ0bWVudHMpOyAqL1xuICAgICAgICAgICAgaWYgKGFwYXJ0bWVudHMgJiYgYXBhcnRtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgYXBhcnRtZW50cy5mb3JFYWNoKChhcGFydG1lbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGFyaW5mbyA9IEpTT04ucGFyc2UoYXBhcnRtZW50LmNoYXJpbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnVsbE5hbWUgPSBgJHtjaGFyaW5mby5maXJzdG5hbWV9ICR7Y2hhcmluZm8ubGFzdG5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgbmFtZU1hcFthcGFydG1lbnQuY2l0aXplbmlkXSA9IGZ1bGxOYW1lO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobmFtZU1hcCk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncmVtb3ZlQWNjZXNzJywgYXN5bmMgKGNsaWVudCwgZGF0YSkgPT4ge1xuICAgIGNvbnN0IHsgaWQsIGNpZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBob3VzZTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCAqIEZST00gcHJvcGVydGllcyBXSEVSRSBwcm9wZXJ0eV9pZCA9ID8nLCBbaWRdKTtcbiAgICBpZiAoaG91c2UgJiYgaG91c2UubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBob3VzZURhdGEgPSBob3VzZVswXTtcbiAgICAgICAgY29uc3QgaGFzQWNjZXNzID0gSlNPTi5wYXJzZShob3VzZURhdGEuaGFzX2FjY2Vzcyk7XG4gICAgICAgIGNvbnN0IG5ld0FjY2VzcyA9IGhhc0FjY2Vzcy5maWx0ZXIoKGFjY2Vzczogc3RyaW5nKSA9PiBhY2Nlc3MgIT09IGNpZCk7XG4gICAgICAgIC8qIGNvbnNvbGUubG9nKG5ld0FjY2Vzcyk7ICovXG4gICAgICAgIGF3YWl0IFV0aWxzLnF1ZXJ5KCdVUERBVEUgcHJvcGVydGllcyBTRVQgaGFzX2FjY2VzcyA9ID8gV0hFUkUgcHJvcGVydHlfaWQgPSA/JywgW0pTT04uc3RyaW5naWZ5KG5ld0FjY2VzcyksIGlkXSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3Byb3BlcnRpZXMnLFxuICAgICAgICAgICAgdGl0bGU6ICdBY2Nlc3MgUmVtb3ZlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQWNjZXNzIHJlbW92ZWQgZnJvbSAke2NpZH0gdG8gJHtob3VzZURhdGEuc3RyZWV0fSwgJHtob3VzZURhdGEucHJvcGVydHlfaWR9IGJ5ICR7YXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNsaWVudCkpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrLCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpjcmVhdGVQb3N0JywgYXN5bmMgKHNvdXJjZSwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0aXRsZSwgY29udGVudCwgaW1hZ2VBdHRhY2htZW50LCBwaG9uZU51bWJlciwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgZGF0YVggPSB7XG4gICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBjb250ZW50LFxuICAgICAgICBpbWFnZUF0dGFjaG1lbnQsXG4gICAgICAgIHBob25lTnVtYmVyLFxuICAgICAgICBlbWFpbCxcbiAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9ibHVlcGFnZXMnLCBkYXRhWCk7XG4gICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpyZWZyZXNoUG9zdHMnLCAtMSwgSlNPTi5zdHJpbmdpZnkoZGF0YVgpKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2JsdWVwYWdlcycsXG4gICAgICAgIHRpdGxlOiAnUG9zdCBDcmVhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBvc3QgJyR7dGl0bGV9JyAoSUQ6ICR7ZGF0YVguX2lkfSkgY3JlYXRlZCBieSAke3Bob25lTnVtYmVyIHx8IGVtYWlsfSwgY29udGVudDogJHtjb250ZW50fWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpnZXRQb3N0cycsIGFzeW5jIChzb3VyY2UpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9ibHVlcGFnZXMnLCB7fSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpkZWxldGVQb3N0JywgYXN5bmMgKHNvdXJjZSwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcG9zdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmx1ZXBhZ2VzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2JsdWVwYWdlcycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjaygnYmx1ZXBhZ2U6cmVmcmVzaERlbGV0ZVBvc3QnLCAtMSwgZGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ibHVlcGFnZXMnLFxuICAgICAgICB0aXRsZTogJ1Bvc3QgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQb3N0ICcke3Bvc3QudGl0bGV9JyAoSUQ6ICR7ZGF0YX0pIGRlbGV0ZWQgYnkgJHtwb3N0LnBob25lTnVtYmVyIHx8IHBvc3QuZW1haWx9LCBjb250ZW50OiAke3Bvc3QuY29udGVudH1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjaywgdHJpZ2dlckNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBGcmFtZXdvcmsgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBHYXJhZ2VEYXRhIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5pbnRlcmZhY2UgVmVoaWNsZURhdGEge1xuICAgIHZlaGljbGU6IHN0cmluZztcbiAgICBwbGF0ZTogc3RyaW5nO1xuICAgIGdhcmFnZTogc3RyaW5nO1xuICAgIG1vZHM6IHN0cmluZztcbiAgICBzdGF0ZTogbnVtYmVyO1xuICAgIGRlcG90cHJpY2U6IHN0cmluZztcbn1cblxub25DbGllbnRDYWxsYmFjaygnZ2FyYWdlOmdldEdhcmFnZURhdGEnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICBsZXQgcmVzRGF0YTogR2FyYWdlRGF0YVtdID0gW107XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IFV0aWxzLnF1ZXJ5KGBTRUxFQ1QgdmVoaWNsZSxwbGF0ZSxnYXJhZ2UsbW9kcyxzdGF0ZSxkZXBvdHByaWNlIEZST00gcGxheWVyX3ZlaGljbGVzIFdIRVJFIGNpdGl6ZW5pZCA9ID9gLCBbY2l0aXplbklkXSkgYXMgVmVoaWNsZURhdGFbXTtcbiAgICBjb25zdCB2ZWhpY2xlRGF0YSA9IEZyYW1ld29yay5TaGFyZWQuVmVoaWNsZXM7XG4gICAgXG4gICAgZm9yIChjb25zdCB2ZWhpY2xlIG9mIHJlcykge1xuICAgICAgICBjb25zdCBkYXRhID0gdmVoaWNsZURhdGFbdmVoaWNsZS52ZWhpY2xlXTtcbiAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgIC8vIERldGVybWluZSB2ZWhpY2xlIHN0YXRlIHdpdGggYmV0dGVyIGxvZ2ljXG4gICAgICAgICAgICBsZXQgc3RhdGU6IHN0cmluZztcbiAgICAgICAgICAgIGlmICh2ZWhpY2xlLnN0YXRlID09PSAyKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBcIkltcG91bmRlZFwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2ZWhpY2xlLnN0YXRlID09PSAxKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBcIlBhcmtlZFwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChOdW1iZXIodmVoaWNsZS5kZXBvdHByaWNlKSA+IDApIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IFwiRGVwb3RcIjsgLy8gQ2hhbmdlZCBmcm9tIFwiRGVwb3RlZFwiIHRvIFwiRGVwb3RcIiBhcyByZXF1ZXN0ZWRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBcIk91dFwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXNEYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgIHBsYXRlOiB2ZWhpY2xlLnBsYXRlLFxuICAgICAgICAgICAgICAgIGdhcmFnZTogdmVoaWNsZS5nYXJhZ2UsXG4gICAgICAgICAgICAgICAgc3RhdGU6IHN0YXRlLFxuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiBkYXRhLmNhdGVnb3J5LFxuICAgICAgICAgICAgICAgIGJyYW5kOiBkYXRhLmJyYW5kLFxuICAgICAgICAgICAgICAgIG5hbWU6IGRhdGEubmFtZSxcbiAgICAgICAgICAgICAgICB0dXJib0luc3RhbGxlZDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZFR1cmJvLFxuICAgICAgICAgICAgICAgIGJvZHlIZWFsdGg6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5ib2R5SGVhbHRoLFxuICAgICAgICAgICAgICAgIHRhbmtIZWFsdGg6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS50YW5rSGVhbHRoLFxuICAgICAgICAgICAgICAgIGZ1ZWxMZXZlbDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLmZ1ZWxMZXZlbCxcbiAgICAgICAgICAgICAgICBlbmdpbmVIZWFsdGg6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5lbmdpbmVIZWFsdGgsXG4gICAgICAgICAgICAgICAgbW9kU3VzcGVuc2lvbjogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZFN1c3BlbnNpb24sXG4gICAgICAgICAgICAgICAgbW9kVHJhbnNtaXNzaW9uOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kVHJhbnNtaXNzaW9uLFxuICAgICAgICAgICAgICAgIG1vZEVuZ2luZTogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZEVuZ2luZSxcbiAgICAgICAgICAgICAgICBtb2RCcmFrZXM6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RCcmFrZXMsXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXNEYXRhKTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgV2FsbGV0QWNjb3VudCB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgRGF0ZVRpbWUgfSBmcm9tICdsdXhvbic7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5mdW5jdGlvbiBHZW5lcmF0ZUNhcmROdW1iZXIoKSB7XG4gICAgbGV0IGNhcmROdW1iZXIgPSAnJztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcbiAgICAgICAgY2FyZE51bWJlciArPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMCk7XG4gICAgfVxuICAgIHJldHVybiBjYXJkTnVtYmVyO1xufVxuXG5mdW5jdGlvbiBHZW5lcmF0ZUJhbmtBY2NvdW50TnVtYmVyKCkge1xuICAgIGNvbnN0IGluaXRpYWxzID0gXCJTTVJUXCI7XG4gICAgbGV0IGFjY291bnROdW1iZXIgPSAnJztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgYWNjb3VudE51bWJlciArPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMCk7XG4gICAgfVxuICAgIHJldHVybiBgJHtpbml0aWFsc31fJHthY2NvdW50TnVtYmVyfWA7XG59XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpsb2dpbicsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc291cmNlKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2JhbmtfdXNlcicsIHsgY2l0aXplbklkOiBjaXRpemVuSWQuUGxheWVyRGF0YS5jaXRpemVuaWQgfSk7XG4gICAgaWYgKHJlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgLi4ucmVzLFxuICAgICAgICAgICAgYmFsYW5jZTogYXdhaXQgY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuYmFuayxcbiAgICAgICAgICAgIGNhc2lubzogYXdhaXQgY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuY2FzaW5vXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpO1xuICAgICAgICBjb25zdCBjYXJkTnVtYmVyID0gR2VuZXJhdGVDYXJkTnVtYmVyKCk7XG4gICAgICAgIGNvbnN0IGNhcmRQaW4gPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMCk7XG4gICAgICAgIGNvbnN0IGJhbmtBY2NvdW50ID0gR2VuZXJhdGVCYW5rQWNjb3VudE51bWJlcigpO1xuICAgICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogY2l0aXplbklkLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIGNhcmROdW1iZXI6IGNhcmROdW1iZXIsXG4gICAgICAgICAgICBjYXJkUGluOiBjYXJkUGluLFxuICAgICAgICAgICAgYmFua0FjY291bnQ6IGJhbmtBY2NvdW50LFxuICAgICAgICAgICAgYmFsYW5jZTogMFxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9iYW5rX3VzZXInLCBkYXRhKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIC4uLmRhdGEsXG4gICAgICAgICAgICBiYWxhbmNlOiBjaXRpemVuSWQuUGxheWVyRGF0YS5tb25leS5iYW5rLFxuICAgICAgICAgICAgY2FzaW5vOiBjaXRpemVuSWQuUGxheWVyRGF0YS5tb25leS5jYXNpbm9cbiAgICAgICAgfSk7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldERldGFpbHNYUycsIGFzeW5jIChjbGllbnQsIG51bWJlcikgPT4ge1xuICAgIGxldCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKFN0cmluZyhudW1iZXIpKTtcbiAgICBpZiAoY2l0aXplbklkKSB7XG4gICAgICAgIGNvbnN0IHJlczogV2FsbGV0QWNjb3VudCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmFua191c2VyJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgcmV0dXJuIHJlcy5iYW5rQWNjb3VudDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd0cmFuc1hBZHFhc2RkYXNkZmVyTW9uZXknLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGFtb3VudCwgdG8gfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzOiBXYWxsZXRBY2NvdW50ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9iYW5rX3VzZXInLCB7IGJhbmtBY2NvdW50OiB0byB9KTtcbiAgICBpZiAoIXJlcykgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZXMuY2l0aXplbklkKTtcbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKGNsaWVudCk7XG4gICAgaWYgKCFhd2FpdCBEb2VzUGxheWVyRXhpc3QodGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5tb25leS5iYW5rIDwgYW1vdW50KSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGF3YWl0IHNvdXJjZVBsYXllci5GdW5jdGlvbnMuUmVtb3ZlTW9uZXkoJ2JhbmsnLCBhbW91bnQpKSB7XG4gICAgICAgIHRhcmdldFBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoJ2JhbmsnLCBhbW91bnQpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiAnV2FsbGV0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgdHJhbnNmZXJyZWQgJCR7YW1vdW50fSB0byAke3Jlcy5uYW1lfS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdXYWxsZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSByZWNlaXZlZCAkJHthbW91bnR9IGZyb20gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9LmAsXG4gICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgIH0pKTtcblxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmFua190cmFuc2FjdGlvbnMnLCB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgZnJvbTogc291cmNlUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgdG86IHJlcy5jaXRpemVuSWQsXG4gICAgICAgICAgICBhbW91bnQ6IGFtb3VudCxcbiAgICAgICAgICAgIHR5cGU6ICdkZWJpdCcsXG4gICAgICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9iYW5rX3RyYW5zYWN0aW9ucycsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBmcm9tOiByZXMuY2l0aXplbklkLFxuICAgICAgICAgICAgdG86IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgIGFtb3VudDogYW1vdW50LFxuICAgICAgICAgICAgdHlwZTogJ2NyZWRpdCcsXG4gICAgICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2JhbmtfdHJhbnNhY3Rpb25zJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTW9uZXkgVHJhbnNmZXInLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgdHJhbnNmZXJyZWQgJCR7YW1vdW50fSB0byAke3Jlcy5uYW1lfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRUcmFuc2FjdGlvbnMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgdHJhbnNhY3Rpb25zID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYmFua190cmFuc2FjdGlvbnMnLCB7IGZyb206IGNpdGl6ZW5JZCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICBzb3J0OiB7IGRhdGU6IC0xIH1cbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodHJhbnNhY3Rpb25zKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd3YWxsZXQ6Y3JlYXRlSW52b2ljZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZGVzY3JpcHRpb24sIGFtb3VudCwgcGF5bWVudFRpbWUsIG51bWJlck9mUGF5bWVudHMsIGlzQnVzaW5lc3MsIHJlY2VpdmVyLCB9ID0gSlNPTi5wYXJzZShkYXRhKSBhcyB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gICAgICAgIGFtb3VudDogbnVtYmVyO1xuICAgICAgICBwYXltZW50VGltZTogbnVtYmVyO1xuICAgICAgICBudW1iZXJPZlBheW1lbnRzOiBudW1iZXI7XG4gICAgICAgIGlzQnVzaW5lc3M6ICdObycgfCAnWWVzJztcbiAgICAgICAgcmVjZWl2ZXI6IHN0cmluZztcbiAgICB9OyAvLyBwYXltZW50VGltZSA9IDAgZm9yIGRhaWx5LCAxIGZvciB3ZWVrbHksIDIgZm9yIG1vbnRobHkgYW5kIDMgZm9yIHF1YXJ0ZXJseSBhbmQgNCBmb3IgeWVhcmx5XG5cbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKGNsaWVudCk7XG4gICAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihyZWNlaXZlcik7XG4gICAgaWYgKCF0YXJnZXRQbGF5ZXIpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoYW1vdW50IDwgMCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9iYW5rX2ludm9pY2VzJywge1xuICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICBmcm9tOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgIHRvOiB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgIGFtb3VudDogYW1vdW50LFxuICAgICAgICBzdGF0dXM6ICdwZW5kaW5nJyxcbiAgICAgICAgaXNCdXNpbmVzcyxcbiAgICAgICAgc291cmNlTmFtZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgIHRhcmdldE5hbWU6IGAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24sXG4gICAgICAgIHBheW1lbnRUaW1lOiBwYXltZW50VGltZSxcbiAgICAgICAgbnVtYmVyT2ZQYXltZW50czogbnVtYmVyT2ZQYXltZW50cyxcbiAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgfSk7XG4gICAgaWYgKHJlcykge1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiAnV2FsbGV0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhhcyBzZW50IHlvdSBhbiBpbnZvaWNlIG9mICQke2Ftb3VudH0uYCxcbiAgICAgICAgICAgIGFwcDogJ3NldHRpbmdzJyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgfSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9iYW5rX2ludm9pY2VzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSW52b2ljZSBDcmVhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIHNlbnQgYW4gaW52b2ljZSBvZiAkJHthbW91bnR9IHRvICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd3YWxsZXQ6Z2V0SW52b2ljZXMnLCBhc3luYyAoY2xpZW50LCB0eXBlKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgaWYgKHR5cGUgPT09ICdzZW50Jykge1xuICAgICAgICBjb25zdCBpbnZvaWNlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2JhbmtfaW52b2ljZXMnLCB7IGZyb206IGNpdGl6ZW5JZCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBkYXRlOiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoaW52b2ljZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGludm9pY2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYmFua19pbnZvaWNlcycsIHsgdG86IGNpdGl6ZW5JZCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBkYXRlOiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoaW52b2ljZXMpO1xuICAgIH1cbn0pO1xuXG50eXBlIFJlY3VycmVuY2UgPSAwIHwgMSB8IDIgfCAzIHwgNDsgLy8gZGFpbHksIHdlZWtseSwgbW9udGhseSwgcXVhcnRlcmx5LCB5ZWFybHlcblxuaW50ZXJmYWNlIFBob25lQmFua0ludm9pY2VEb2Mge1xuICAgIF9pZDogc3RyaW5nO1xuICAgIGZyb206IHN0cmluZzsgLy8gY2l0aXplbmlkIG9mIHNlbmRlciAodGhlIHBlcnNvbi9idXNpbmVzcyByZXF1ZXN0aW5nIG1vbmV5KVxuICAgIHRvOiBzdHJpbmc7ICAgLy8gY2l0aXplbmlkIG9mIHRhcmdldCAodGhlIHBlcnNvbiB3aG8gcGF5cyB3aGVuIGFjY2VwdGluZylcbiAgICBhbW91bnQ6IG51bWJlcjtcbiAgICB0YXJnZXROYW1lOiBzdHJpbmc7XG4gICAgc291cmNlTmFtZTogc3RyaW5nO1xuICAgIHN0YXR1czogJ3BlbmRpbmcnIHwgJ2FjdGl2ZScgfCAncGFpZCcgfCAnY29tcGxldGVkJyB8ICdkZWNsaW5lZCcgfCAnb3ZlcmR1ZSc7XG4gICAgaXNCdXNpbmVzczogJ05vJyB8ICdZZXMnO1xuICAgIHBheW1lbnRUaW1lOiBSZWN1cnJlbmNlIHwgJyc7IC8vICcnIG1lYW5zIG9uZS10aW1lLCBlbHNlIHJlY3VycmVuY2UgY29kZVxuICAgIG51bWJlck9mUGF5bWVudHM6IG51bWJlciB8ICcnOy8vICcnIG1lYW5zIG9uZS10aW1lLCBlbHNlIHRvdGFsIHBheW1lbnRzXG4gICAgcmVtYWluaW5nUGF5bWVudHM/OiBudW1iZXI7ICAgLy8gbWFpbnRhaW5lZCBmb3IgcmVjdXJyaW5nXG4gICAgbmV4dFBheW1lbnREYXRlPzogc3RyaW5nIHwgbnVsbDsgLy8gSVNPXG4gICAgbGFzdEF0dGVtcHRBdD86IHN0cmluZyB8IG51bGw7ICAgLy8gSVNPXG4gICAgZmFpbGVkQXR0ZW1wdHM/OiBudW1iZXI7XG4gICAgY3JlYXRlZEF0Pzogc3RyaW5nOyAvLyBJU09cbiAgICBkYXRlPzogc3RyaW5nOyAvLyB5b3VyIG9yaWdpbmFsIGZpZWxkXG59XG5cbmNvbnN0IENPTExFQ1RJT04gPSAncGhvbmVfYmFua19pbnZvaWNlcyc7XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gUUIgaGVscGVycyAoYWRqdXN0IGlmIHlvdXIgZXhwb3J0cyBkaWZmZXIpXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbmNvbnN0IGdldFBsYXllckJ5U291cmNlID0gYXN5bmMgKHNyYzogbnVtYmVyKSA9PiBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHNyYyk7XG5jb25zdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZCA9IGFzeW5jIChjaWQ6IHN0cmluZykgPT4gZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkPy4oY2lkKTtcblxuLy8gTW9uZXkgb3BzOiByZXR1cm4gYm9vbGVhbiBzdWNjZXNzXG5jb25zdCBkZWJpdEJhbmsgPSAocGxheWVyOiBhbnksIGFtb3VudDogbnVtYmVyKSA9PiBwbGF5ZXI/LkZ1bmN0aW9ucz8uUmVtb3ZlTW9uZXk/LignYmFuaycsIGFtb3VudCwgJ2ludm9pY2VfcGF5bWVudCcpID8/IGZhbHNlO1xuY29uc3QgY3JlZGl0QmFuayA9IChwbGF5ZXI6IGFueSwgYW1vdW50OiBudW1iZXIpID0+IHBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoJ2JhbmsnLCBhbW91bnQsICdpbnZvaWNlX3JlY2VpdmVkJykgPz8gZmFsc2U7XG5cbmNvbnN0IG5vdGlmeSA9IChzcmM6IG51bWJlciwgdGl0bGU6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZywgdGltZW91dCA9IDUwMDApID0+IHtcbiAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBzcmMsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZSwgZGVzY3JpcHRpb24sIGFwcDogJ3NldHRpbmdzJywgdGltZW91dFxuICAgIH0pKTtcbn07XG5cbmNvbnN0IG5vd0lTTyA9ICgpID0+IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcblxuY29uc3QgYWRkSW50ZXJ2YWwgPSAoaXNvOiBzdHJpbmcsIHJlYzogUmVjdXJyZW5jZSk6IHN0cmluZyA9PiB7XG4gICAgY29uc3QgZCA9IG5ldyBEYXRlKGlzbyk7XG4gICAgc3dpdGNoIChyZWMpIHtcbiAgICAgICAgY2FzZSAwOiBkLnNldERhdGUoZC5nZXREYXRlKCkgKyAxKTsgYnJlYWs7ICAgICAgIC8vIGRhaWx5XG4gICAgICAgIGNhc2UgMTogZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgNyk7IGJyZWFrOyAgICAgICAvLyB3ZWVrbHlcbiAgICAgICAgY2FzZSAyOiBkLnNldE1vbnRoKGQuZ2V0TW9udGgoKSArIDEpOyBicmVhazsgICAgIC8vIG1vbnRobHlcbiAgICAgICAgY2FzZSAzOiBkLnNldE1vbnRoKGQuZ2V0TW9udGgoKSArIDMpOyBicmVhazsgICAgIC8vIHF1YXJ0ZXJseVxuICAgICAgICBjYXNlIDQ6IGQuc2V0RnVsbFllYXIoZC5nZXRGdWxsWWVhcigpICsgMSk7IGJyZWFrOyAvLyB5ZWFybHlcbiAgICB9XG4gICAgcmV0dXJuIGQudG9JU09TdHJpbmcoKTtcbn07XG5cbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLy8gQnVzaW5lc3Mgc2FmZSBkZXBvc2l0IChjdXN0b21pemUgZm9yIHlvdXIgZnJhbWV3b3JrKVxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vKipcbiAqIFRyeSB0byBkZXBvc2l0IGludG8gYSBidXNpbmVzcyBtYW5hZ2VtZW50IHNhZmUuXG4gKiBTdHJhdGVneTpcbiAqICAgLSBJZiB0aGUgcGF5ZXIgaXMgcGF5aW5nIHRvIGEgYnVzaW5lc3MgKGludm9pY2UuaXNCdXNpbmVzcyA9PT0gJ1llcycpLFxuICogICAgIHdlIGRlcG9zaXQgdGhlIG1vbmV5IGludG8gdGhlIFJFQ0VJVkVSJ3Mgam9iIHNhZmUuXG4gKiAgIC0gWW91IG1pZ2h0IHdhbnQgdG8gY2hhbmdlIHRoaXMgdG8gYSBzcGVjaWZpYyBidXNpbmVzcyBpZCBvbiB0aGUgaW52b2ljZSxcbiAqICAgICBvciBhIHByb3ZpZGVkIG9yZyBrZXkuIEVkaXQgYXMgbmVlZGVkLlxuICovXG5jb25zdCBkZXBvc2l0VG9NYW5hZ2VtZW50U2FmZSA9IGFzeW5jIChyZWNlaXZlckNpdGl6ZW5JZDogc3RyaW5nLCBhbW91bnQ6IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4gPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlY2VpdmVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQocmVjZWl2ZXJDaXRpemVuSWQpO1xuICAgICAgICBjb25zdCBqb2JOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQgPSByZWNlaXZlcj8uUGxheWVyRGF0YT8uam9iPy5uYW1lO1xuICAgICAgICBjb25zdCBQbGF5ZXJOYW1lID0gcmVjZWl2ZXIgPyBgJHtyZWNlaXZlci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtyZWNlaXZlci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAgOiAnVW5rbm93bic7XG4gICAgICAgIC8vIFRPRE86IFVwZGF0ZSB0aGlzIHRvIHlvdXIgYWN0dWFsIG1hbmFnZW1lbnQgcmVzb3VyY2UgQVBJOlxuICAgICAgICAvLyBDb21tb24gUUJDb3JlIGVjb3N5c3RlbSB1c2VzIHFiLW1hbmFnZW1lbnQ6IEFkZE1vbmV5KGpvYk5hbWUsIGFtb3VudClcbiAgICAgICAgaWYgKGpvYk5hbWUpIHtcbiAgICAgICAgICAgIGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmFkZEFjY291bnRNb25leShqb2JOYW1lLCBhbW91bnQpO1xuICAgICAgICAgICAgLyogZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oYWNjb3VudCwgdGl0bGUsIGFtb3VudCwgbWVzc2FnZSwgaXNzdWVyLCByZWNlaXZlciwgdHJhbnNUeXBlLCB0cmFuc0lEKSAqL1xuICAgICAgICAgICAgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oam9iTmFtZSwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgRGVwb3NpdFwiLCBhbW91bnQsIFwiRGVwb3NpdCBmcm9tIGVtcGxveWVlIHRvIG1hbmFnZW1lbnQgc2FmZS5cIiwgam9iTmFtZSwgUGxheWVyTmFtZSwgJ2RlcG9zaXQnLCBnZW5lcmF0ZVVVaWQoKSlcbiAgICAgICAgICAgIGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGpvYk5hbWUsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIERlcG9zaXRcIiwgYW1vdW50LCBcIkRlcG9zaXRlZCB0byBtYW5hZ2VtZW50IHNhZmUuXCIsIFBsYXllck5hbWUsIGpvYk5hbWUsICd3aXRoZHJhdycsIGdlbmVyYXRlVVVpZCgpKVxuXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyZWNlaXZlcikge1xuICAgICAgICAgICAgcmV0dXJuIGNyZWRpdEJhbmsocmVjZWl2ZXIsIGFtb3VudCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignZGVwb3NpdFRvTWFuYWdlbWVudFNhZmUgZXJyb3I6JywgZSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59O1xuXG4vLyBCYW5rIHN0YXRlbWVudCAvIGxvZ2dpbmcgKG9wdGlvbmFsIGhvb2sgcG9pbnQpXG5jb25zdCBsb2dCYW5rRXZlbnQgPSAodHlwZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpID0+IExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9iYW5rX2ludm9pY2VzJyxcbiAgICB0aXRsZTogdHlwZSxcbiAgICBtZXNzYWdlLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2Vcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd3YWxsZXQ6YWNjZXB0SW52b2ljZVBheW1lbnQnLCBhc3luYyAoY2xpZW50OiBudW1iZXIsIGlkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXllclBsYXllciA9IGF3YWl0IGdldFBsYXllckJ5U291cmNlKGNsaWVudCk7IC8vIHRoZSBvbmUgY2xpY2tpbmcgXCJhY2NlcHRcIiAobXVzdCBlcXVhbCBpbnZvaWNlLnRvKVxuICAgIGlmICghcGF5ZXJQbGF5ZXIpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IHBheWVyQ2lkOiBzdHJpbmcgPSBwYXllclBsYXllci5QbGF5ZXJEYXRhPy5jaXRpemVuaWQ7XG4gICAgY29uc3QgaW52b2ljZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSkgYXMgUGhvbmVCYW5rSW52b2ljZURvYztcbiAgICBpZiAoIWludm9pY2UpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIFNhZmV0eSBjaGVja3NcbiAgICBpZiAoaW52b2ljZS50byAhPT0gcGF5ZXJDaWQpIHJldHVybiBmYWxzZTsgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5vdCB5b3VyIGludm9pY2VcbiAgICBpZiAoaW52b2ljZS5zdGF0dXMgIT09ICdwZW5kaW5nJyAmJiBpbnZvaWNlLnN0YXR1cyAhPT0gJ2FjdGl2ZScgJiYgaW52b2ljZS5zdGF0dXMgIT09ICdvdmVyZHVlJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChpbnZvaWNlLmFtb3VudCA8PSAwKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGludm9pY2UuZnJvbSA9PT0gaW52b2ljZS50bykgcmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAgICAgICAgICAvLyBzZWxmLWludm9pY2Ugc2lsbGluZXNzXG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZChpbnZvaWNlLmZyb20pO1xuXG4gICAgY29uc3QgY2hhcmdlZCA9IGRlYml0QmFuayhwYXllclBsYXllciwgaW52b2ljZS5hbW91bnQpO1xuICAgIGlmICghY2hhcmdlZCkge1xuICAgICAgICAvLyBDb3VsZG5cdTIwMTl0IGNoYXJnZSAtPiBvdmVyZHVlIGZvciByZWN1cnJpbmcgb3Iga2VlcCBwZW5kaW5nIGZvciBvbmUtdGltZT9cbiAgICAgICAgY29uc3QgaXNSZWN1cnJpbmcgPSBpbnZvaWNlLnBheW1lbnRUaW1lICE9PSAnJyAmJiBpbnZvaWNlLm51bWJlck9mUGF5bWVudHMgIT09ICcnO1xuICAgICAgICBpZiAoaXNSZWN1cnJpbmcpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9LCB7XG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnb3ZlcmR1ZScsXG4gICAgICAgICAgICAgICAgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksXG4gICAgICAgICAgICAgICAgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgbm90aWZ5KHBheWVyUGxheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYEluc3VmZmljaWVudCBmdW5kcyB0byBwYXkgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gUGF5b3V0XG4gICAgbGV0IHBheW91dE9rID0gZmFsc2U7XG4gICAgaWYgKGludm9pY2UuaXNCdXNpbmVzcyA9PT0gJ1llcycpIHtcbiAgICAgICAgY29uc3QgY29tbWlzc2lvbiA9IDAuMTtcbiAgICAgICAgY29uc3QgY29tbWlzc2lvbkFtb3VudCA9IE1hdGgucm91bmQoaW52b2ljZS5hbW91bnQgKiBjb21taXNzaW9uKTtcbiAgICAgICAgY29uc3QgcGF5b3V0QW1vdW50ID0gTWF0aC5yb3VuZChpbnZvaWNlLmFtb3VudCAtIGNvbW1pc3Npb25BbW91bnQpO1xuICAgICAgICBwYXlvdXRPayA9IGF3YWl0IGRlcG9zaXRUb01hbmFnZW1lbnRTYWZlKGludm9pY2UuZnJvbSwgcGF5b3V0QW1vdW50KTtcbiAgICAgICAgcmVxdWVzdGVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGNvbW1pc3Npb25BbW91bnQsICdpbnZvaWNlX3JlY2VpdmVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcGF5b3V0T2sgPSByZXF1ZXN0ZXIgPyBjcmVkaXRCYW5rKHJlcXVlc3RlciwgaW52b2ljZS5hbW91bnQpIDogZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKCFwYXlvdXRPaykge1xuICAgICAgICAvLyBSZWZ1bmQgcGF5ZXIgc2luY2UgcGF5b3V0IGZhaWxlZFxuICAgICAgICBjcmVkaXRCYW5rKHBheWVyUGxheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgIG5vdGlmeShwYXllclBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBQYXltZW50IGZhaWxlZCB0byBkZWxpdmVyLiBSZWZ1bmRlZCAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBVcGRhdGUgaW52b2ljZSBzdGF0dXNcbiAgICBjb25zdCBpc1JlY3VycmluZyA9IChpbnZvaWNlLnBheW1lbnRUaW1lICE9PSAnJyAmJiBpbnZvaWNlLm51bWJlck9mUGF5bWVudHMgIT09ICcnKTtcbiAgICBpZiAoIWlzUmVjdXJyaW5nKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9LCB7XG4gICAgICAgICAgICBzdGF0dXM6ICdwYWlkJyxcbiAgICAgICAgICAgIG5leHRQYXltZW50RGF0ZTogbnVsbCxcbiAgICAgICAgICAgIHJlbWFpbmluZ1BheW1lbnRzOiAwLFxuICAgICAgICAgICAgbGFzdEF0dGVtcHRBdDogbm93SVNPKClcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgdG90YWwgPSBOdW1iZXIoaW52b2ljZS5udW1iZXJPZlBheW1lbnRzKTtcbiAgICAgICAgY29uc3QgcHJldlJlbWFpbmluZyA9IChpbnZvaWNlLnJlbWFpbmluZ1BheW1lbnRzID09IG51bGwpXG4gICAgICAgICAgICA/IHRvdGFsICAgICAgICAgICAgICAgIC8vIGZpcnN0IHRpbWUgYWN0aXZhdGlvblxuICAgICAgICAgICAgOiBpbnZvaWNlLnJlbWFpbmluZ1BheW1lbnRzO1xuXG4gICAgICAgIGNvbnN0IG5ld1JlbWFpbmluZyA9IE1hdGgubWF4KDAsIHByZXZSZW1haW5pbmcgLSAxKTtcblxuICAgICAgICBsZXQgbmV3U3RhdHVzOiBQaG9uZUJhbmtJbnZvaWNlRG9jWydzdGF0dXMnXSA9ICdhY3RpdmUnO1xuICAgICAgICBsZXQgbmV4dERhdGU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgICAgICBpZiAobmV3UmVtYWluaW5nIDw9IDApIHtcbiAgICAgICAgICAgIG5ld1N0YXR1cyA9ICdjb21wbGV0ZWQnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgYmFzZURhdGUgPSBpbnZvaWNlLm5leHRQYXltZW50RGF0ZSA/PyBub3dJU08oKTtcbiAgICAgICAgICAgIG5leHREYXRlID0gYWRkSW50ZXJ2YWwoYmFzZURhdGUsIE51bWJlcihpbnZvaWNlLnBheW1lbnRUaW1lKSBhcyBSZWN1cnJlbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9LCB7XG4gICAgICAgICAgICBzdGF0dXM6IG5ld1N0YXR1cyxcbiAgICAgICAgICAgIHJlbWFpbmluZ1BheW1lbnRzOiBuZXdSZW1haW5pbmcsXG4gICAgICAgICAgICBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSxcbiAgICAgICAgICAgIG5leHRQYXltZW50RGF0ZTogbmV4dERhdGUsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IGludm9pY2UuY3JlYXRlZEF0ID8/IG5vd0lTTygpXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIE5vdGlmeSBib3RoIHNpZGVzXG4gICAgbm90aWZ5KHBheWVyUGxheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFBhaWQgJCR7aW52b2ljZS5hbW91bnR9IHRvICR7aW52b2ljZS5zb3VyY2VOYW1lfS5gKTtcbiAgICBpZiAocmVxdWVzdGVyPy5QbGF5ZXJEYXRhPy5zb3VyY2UpIHtcbiAgICAgICAgbm90aWZ5KHJlcXVlc3Rlci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGAke2ludm9pY2UudGFyZ2V0TmFtZX0gcGFpZCB5b3VyIGludm9pY2Ugb2YgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgIH1cblxuICAgIGxvZ0JhbmtFdmVudCgnSW52b2ljZSBQYXltZW50JywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBwYWlkICQke2ludm9pY2UuYW1vdW50fSB0byAke2ludm9pY2Uuc291cmNlTmFtZX0ke2ludm9pY2UuaXNCdXNpbmVzcyA9PT0gJ1llcycgPyAnIChidXNpbmVzcyknIDogJyd9LmApO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpkZWNsaW5lSW52b2ljZVBheW1lbnQnLCBhc3luYyAoY2xpZW50OiBudW1iZXIsIGlkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeVNvdXJjZShjbGllbnQpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBjaWQgPSBwbGF5ZXIuUGxheWVyRGF0YT8uY2l0aXplbmlkO1xuICAgIGNvbnN0IGludm9pY2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0pIGFzIFBob25lQmFua0ludm9pY2VEb2M7XG4gICAgaWYgKCFpbnZvaWNlKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGludm9pY2UudG8gIT09IGNpZCkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChpbnZvaWNlLnN0YXR1cyAhPT0gJ3BlbmRpbmcnICYmIGludm9pY2Uuc3RhdHVzICE9PSAnYWN0aXZlJyAmJiBpbnZvaWNlLnN0YXR1cyAhPT0gJ292ZXJkdWUnKSByZXR1cm4gZmFsc2U7XG5cbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSwgeyBzdGF0dXM6ICdkZWNsaW5lZCcsIG5leHRQYXltZW50RGF0ZTogbnVsbCB9KTtcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKGludm9pY2UuZnJvbSk7XG4gICAgbm90aWZ5KHBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBEZWNsaW5lZCBpbnZvaWNlIG9mICQke2ludm9pY2UuYW1vdW50fSBmcm9tICR7aW52b2ljZS5zb3VyY2VOYW1lfS5gKTtcbiAgICBpZiAocmVxdWVzdGVyPy5QbGF5ZXJEYXRhPy5zb3VyY2UpIHtcbiAgICAgICAgbm90aWZ5KHJlcXVlc3Rlci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGAke2ludm9pY2UudGFyZ2V0TmFtZX0gZGVjbGluZWQgeW91ciBpbnZvaWNlIG9mICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICB9XG5cbiAgICBsb2dCYW5rRXZlbnQoJ0ludm9pY2UgRGVjbGluZWQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IGRlY2xpbmVkIGludm9pY2UgZnJvbSAke2ludm9pY2Uuc291cmNlTmFtZX0gZm9yICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5cbmV4cG9ydCBjb25zdCBJbnZvaWNlUmVjdXJyaW5nUGF5bWVudHMgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgbm93ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuXG4gICAgY29uc3QgZHVlSW52b2ljZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFxuICAgICAgICBDT0xMRUNUSU9OLFxuICAgICAgICB7XG4gICAgICAgICAgICBzdGF0dXM6IHsgJGluOiBbJ2FjdGl2ZScsICdvdmVyZHVlJ10gfSxcbiAgICAgICAgICAgIG5leHRQYXltZW50RGF0ZTogeyAkbHRlOiBub3cgfSxcbiAgICAgICAgICAgIHJlbWFpbmluZ1BheW1lbnRzOiB7ICRndDogMCB9XG4gICAgICAgIH0sXG4gICAgICAgIG51bGwsXG4gICAgICAgIGZhbHNlLFxuICAgICAgICB7IHNvcnQ6IHsgbmV4dFBheW1lbnREYXRlOiAxIH0sIGxpbWl0OiA1MCB9IC8vIHByb2Nlc3MgaW4gYmF0Y2hlc1xuICAgICkgYXMgUGhvbmVCYW5rSW52b2ljZURvY1tdO1xuXG4gICAgZm9yIChjb25zdCBpbnZvaWNlIG9mIGR1ZUludm9pY2VzKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwYXllciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKGludm9pY2UudG8pO1xuICAgICAgICAgICAgaWYgKCFwYXllcikge1xuICAgICAgICAgICAgICAgIC8vIFBheWVyIG9mZmxpbmUgXHUyMDE0IGNob29zZSB5b3VyIHBvbGljeS4gV2UnbGwganVzdCBtYXJrIGF0dGVtcHQgYW5kIHJldHJ5IGxhdGVyLlxuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpbnZvaWNlLl9pZCB9LCB7XG4gICAgICAgICAgICAgICAgICAgICRzZXQ6IHsgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksIGZhaWxlZEF0dGVtcHRzOiAoaW52b2ljZS5mYWlsZWRBdHRlbXB0cyA/PyAwKSArIDEsIHN0YXR1czogJ292ZXJkdWUnIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVHJ5IHRvIGNoYXJnZSB2aWEgdGhlIHNhbWUgYWNjZXB0IGxvZ2ljIGNvcmUgKERSWS1pc2ggd2l0aCBhIHRpbnkgaW50ZXJuYWwgY2FsbClcbiAgICAgICAgICAgIC8vIFdlIGlubGluZSBtaW5pbWFsIGxvZ2ljOiBkZWJpdCBwYXllclxuICAgICAgICAgICAgY29uc3QgY2hhcmdlZCA9IGRlYml0QmFuayhwYXllciwgaW52b2ljZS5hbW91bnQpO1xuICAgICAgICAgICAgaWYgKCFjaGFyZ2VkKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHsgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksIGZhaWxlZEF0dGVtcHRzOiAoaW52b2ljZS5mYWlsZWRBdHRlbXB0cyA/PyAwKSArIDEsIHN0YXR1czogJ292ZXJkdWUnIH0pO1xuICAgICAgICAgICAgICAgIG5vdGlmeShwYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBSZWN1cnJpbmcgaW52b2ljZSBvZiAkJHtpbnZvaWNlLmFtb3VudH0gZmFpbGVkIChpbnN1ZmZpY2llbnQgZnVuZHMpLmApO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQYXlvdXRcbiAgICAgICAgICAgIGxldCBwYXlvdXRPayA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKGludm9pY2UuaXNCdXNpbmVzcyA9PT0gJ1llcycpIHtcbiAgICAgICAgICAgICAgICBwYXlvdXRPayA9IGF3YWl0IGRlcG9zaXRUb01hbmFnZW1lbnRTYWZlKGludm9pY2UuZnJvbSwgaW52b2ljZS5hbW91bnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXF1ZXN0ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZChpbnZvaWNlLmZyb20pO1xuICAgICAgICAgICAgICAgIHBheW91dE9rID0gcmVxdWVzdGVyID8gY3JlZGl0QmFuayhyZXF1ZXN0ZXIsIGludm9pY2UuYW1vdW50KSA6IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXBheW91dE9rKSB7XG4gICAgICAgICAgICAgICAgLy8gUmVmdW5kXG4gICAgICAgICAgICAgICAgY3JlZGl0QmFuayhwYXllciwgaW52b2ljZS5hbW91bnQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpbnZvaWNlLl9pZCB9LCB7IGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLCBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxIH0pO1xuICAgICAgICAgICAgICAgIG5vdGlmeShwYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBSZWN1cnJpbmcgaW52b2ljZSBwYXlvdXQgZmFpbGVkOyByZWZ1bmRlZCAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFByb2dyZXNzIHJlY3VycmVuY2VcbiAgICAgICAgICAgIGNvbnN0IG5ld1JlbWFpbmluZyA9IE1hdGgubWF4KDAsIChpbnZvaWNlLnJlbWFpbmluZ1BheW1lbnRzID8/IE51bWJlcihpbnZvaWNlLm51bWJlck9mUGF5bWVudHMpKSAtIDEpO1xuICAgICAgICAgICAgbGV0IG5ld1N0YXR1czogUGhvbmVCYW5rSW52b2ljZURvY1snc3RhdHVzJ10gPSAnYWN0aXZlJztcbiAgICAgICAgICAgIGxldCBuZXh0RGF0ZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbiAgICAgICAgICAgIGlmIChuZXdSZW1haW5pbmcgPD0gMCkge1xuICAgICAgICAgICAgICAgIG5ld1N0YXR1cyA9ICdjb21wbGV0ZWQnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlID0gaW52b2ljZS5uZXh0UGF5bWVudERhdGUgPz8gbm93SVNPKCk7XG4gICAgICAgICAgICAgICAgbmV4dERhdGUgPSBhZGRJbnRlcnZhbChiYXNlLCBOdW1iZXIoaW52b2ljZS5wYXltZW50VGltZSkgYXMgUmVjdXJyZW5jZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpbnZvaWNlLl9pZCB9LCB7XG4gICAgICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IG5ld1JlbWFpbmluZyxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IG5ld1N0YXR1cyxcbiAgICAgICAgICAgICAgICBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSxcbiAgICAgICAgICAgICAgICBuZXh0UGF5bWVudERhdGU6IG5leHREYXRlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbm90aWZ5KHBheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYENoYXJnZWQgJCR7aW52b2ljZS5hbW91bnR9IGZvciByZWN1cnJpbmcgaW52b2ljZSAoJHtuZXdSZW1haW5pbmd9IGxlZnQpLmApO1xuICAgICAgICAgICAgbG9nQmFua0V2ZW50KCdSZWN1cnJpbmcgSW52b2ljZSBQYXltZW50JywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBwYWlkICQke2ludm9pY2UuYW1vdW50fSB0byAke2ludm9pY2Uuc291cmNlTmFtZX0ke2ludm9pY2UuaXNCdXNpbmVzcyA9PT0gJ1llcycgPyAnIChidXNpbmVzcyknIDogJyd9LmApO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdSZWN1cnJpbmcgcGF5bWVudCBlcnJvciBmb3InLCBpbnZvaWNlLl9pZCwgZSk7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwge1xuICAgICAgICAgICAgICAgICRzZXQ6IHsgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksIGZhaWxlZEF0dGVtcHRzOiAoaW52b2ljZS5mYWlsZWRBdHRlbXB0cyA/PyAwKSArIDEgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG59OyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrLCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBGcmFtZXdvcmssIE1vbmdvREIsIExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25DbGllbnRDYWxsYmFjaygnZ3JvdXBzOmdldG11bHRpUGxlSm9icycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc291cmNlKTtcbiAgICBjb25zdCBqb2JzRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQgfSk7XG4gICAgY29uc3QgY3VycmVudEpvYiA9IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmpvYi5uYW1lO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IGN1cnJlbnRKb2IsIGpvYnNEYXRhIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dyb3VwczpkZWxldGVNdWx0aUpvYicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSk7XG4gICAgY29uc3Qgam9iID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aWpvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7bmFtZX0gZGVsZXRlZCBqb2IgJHtqb2Iuam9iTmFtZX0gKCR7am9iLmNpdGl6ZW5JZH0pYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dyb3VwczpjaGFuZ2VKb2JPZlBsYXllcicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBqb2JOYW1lLCBncmFkZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBpZiAoIWpvYk5hbWUpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFzb3VyY2VQbGF5ZXIpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkNoZWNrSm9iR3JhZGUoam9iTmFtZSwgU3RyaW5nKGdyYWRlKSkpIHtcbiAgICAgICAgc291cmNlUGxheWVyLkZ1bmN0aW9ucy5TZXRKb2Ioam9iTmFtZSwgU3RyaW5nKGdyYWRlKSk7XG4gICAgICAgIGVtaXROZXQoJ1FCQ29yZTpOb3RpZnknLCBzb3VyY2UsIGBKb2IgQ2hhbmdlZCB0byAke2pvYk5hbWV9IFN1Y2Nlc3NmdWxseWAsICdzdWNjZXNzJyk7XG4gICAgICAgIGVtaXROZXQoJ2dyb3Vwczp0b2dnbGVEdXR5JywgTnVtYmVyKHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aWpvYnMnLFxuICAgICAgICAgICAgdGl0bGU6ICdKb2IgQ2hhbmdlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGNoYW5nZWQgam9iIHRvICcke2pvYk5hbWV9JyAoR3JhZGU6ICR7Z3JhZGV9KS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCwgam9iTmFtZSB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlqb2JzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSW52YWxpZCBKb2IgUmVtb3ZlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGF0dGVtcHRlZCB0byBjaGFuZ2UgdG8gaW52YWxpZCBqb2IgJyR7am9iTmFtZX0nLCByZW1vdmVkIGZyb20gbXVsdGktam9icy5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG4vLyBJbnRlcmZhY2VzXG5pbnRlcmZhY2UgUGxheWVyRGF0YSB7XG4gICAgUGxheWVyRGF0YToge1xuICAgICAgICBjaGFyaW5mbzogeyBmaXJzdG5hbWU6IHN0cmluZzsgbGFzdG5hbWU6IHN0cmluZyB9O1xuICAgICAgICBjaXRpemVuaWQ6IHN0cmluZztcbiAgICAgICAgc291cmNlOiBudW1iZXI7XG4gICAgfTtcbn1cblxuaW50ZXJmYWNlIEdyb3VwTWVtYmVyIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgQ0lEOiBzdHJpbmc7XG4gICAgUGxheWVyOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBFbXBsb3ltZW50R3JvdXAge1xuICAgIGlkOiBudW1iZXI7XG4gICAgc3RhdHVzOiBzdHJpbmc7XG4gICAgR05hbWU6IHN0cmluZztcbiAgICBHUGFzczogc3RyaW5nO1xuICAgIEdMb2dvOiBzdHJpbmc7XG4gICAgVXNlcnM6IG51bWJlcjtcbiAgICBsZWFkZXI6IG51bWJlcjtcbiAgICBtZW1iZXJzOiBHcm91cE1lbWJlcltdO1xuICAgIHN0YWdlOiBhbnlbXTtcbiAgICBTY3JpcHRDcmVhdGVkPzogYm9vbGVhbjtcbn0iLCAiaW1wb3J0IHsgRnJhbWV3b3JrLCBNb25nb0RCIH0gZnJvbSAnQHNlcnZlci9zdl9tYWluJztcbmltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tICdAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXInO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSAnQHNoYXJlZC91dGlscyc7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5pbnRlcmZhY2UgSGVhcnRTeW5jUHJvZmlsZSB7XG4gICAgX2lkPzogc3RyaW5nO1xuICAgIGNpdGl6ZW5JZDogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBhZ2U6IG51bWJlcjtcbiAgICBnZW5kZXI6IHN0cmluZztcbiAgICBiaW86IHN0cmluZztcbiAgICBwaG90b3M6IHN0cmluZ1tdO1xuICAgIGludGVyZXN0czogc3RyaW5nW107XG4gICAgbG9va2luZ0Zvcjogc3RyaW5nO1xuICAgIGludGVyZXN0ZWRJbkdlbmRlcnM6IHN0cmluZ1tdO1xuICAgIGFnZVJhbmdlTWluOiBudW1iZXI7XG4gICAgYWdlUmFuZ2VNYXg6IG51bWJlcjtcbiAgICBtYXhEaXN0YW5jZTogbnVtYmVyO1xuICAgIHNob3dPbmxpbmU6IGJvb2xlYW47XG4gICAgbG9jYXRpb24/OiB7XG4gICAgICAgIGxhdDogbnVtYmVyO1xuICAgICAgICBsbmc6IG51bWJlcjtcbiAgICAgICAgY2l0eTogc3RyaW5nO1xuICAgIH07XG4gICAgd29yaz86IHN0cmluZztcbiAgICBzY2hvb2w/OiBzdHJpbmc7XG4gICAgaGVpZ2h0PzogbnVtYmVyO1xuICAgIHpvZGlhY1NpZ24/OiBzdHJpbmc7XG4gICAgbGlmZXN0eWxlPzoge1xuICAgICAgICBzbW9raW5nOiBzdHJpbmc7XG4gICAgICAgIGRyaW5raW5nOiBzdHJpbmc7XG4gICAgICAgIGV4ZXJjaXNlOiBzdHJpbmc7XG4gICAgICAgIHBldHM6IHN0cmluZztcbiAgICB9O1xuICAgIHByb21wdHM/OiB7XG4gICAgICAgIHF1ZXN0aW9uOiBzdHJpbmc7XG4gICAgICAgIGFuc3dlcjogc3RyaW5nO1xuICAgIH1bXTtcbiAgICB2ZXJpZmllZDogYm9vbGVhbjtcbiAgICBwcmVtaXVtOiBib29sZWFuO1xuICAgIHN1cGVyTGlrZXNSZW1haW5pbmc6IG51bWJlcjtcbiAgICBsaWtlc1JlbWFpbmluZzogbnVtYmVyO1xuICAgIGRhaWx5U3dpcGVzOiBudW1iZXI7XG4gICAgbGFzdFN3aXBlUmVzZXQ6IERhdGU7XG4gICAgY3JlYXRlZEF0OiBEYXRlO1xuICAgIGxhc3RBY3RpdmU6IERhdGU7XG4gICAgaXNBY3RpdmU6IGJvb2xlYW47XG59XG5pbnRlcmZhY2UgTWVzc2FnZSB7XG4gICAgX2lkOiBzdHJpbmc7XG4gICAgc2VuZGVySWQ6IHN0cmluZztcbiAgICByZWNlaXZlcklkOiBzdHJpbmc7XG4gICAgbWF0Y2hJZDogc3RyaW5nO1xuICAgIGNvbnRlbnQ6IHN0cmluZztcbiAgICB0aW1lc3RhbXA6IHN0cmluZztcbiAgICByZWFkOiBib29sZWFuO1xufVxuY2xhc3MgSGVhcnRTeW5jU2VydmVyIHtcbiAgICBhc3luYyBnZXRQcm9maWxlKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlIHwgbnVsbD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb25zdCBwcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIHJldHVybiBwcm9maWxlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBIZWFydFN5bmMgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGNyZWF0ZVByb2ZpbGUoc291cmNlOiBudW1iZXIsIHByb2ZpbGVEYXRhOiBQYXJ0aWFsPEhlYXJ0U3luY1Byb2ZpbGU+KTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlIHwgbnVsbD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHByb2ZpbGUgYWxyZWFkeSBleGlzdHNcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nUHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdQcm9maWxlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQcm9maWxlIGFscmVhZHkgZXhpc3RzJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5ld1Byb2ZpbGU6IEhlYXJ0U3luY1Byb2ZpbGUgPSB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgbmFtZTogcHJvZmlsZURhdGEubmFtZSB8fCAnJyxcbiAgICAgICAgICAgICAgICBhZ2U6IHByb2ZpbGVEYXRhLmFnZSB8fCAxOCxcbiAgICAgICAgICAgICAgICBnZW5kZXI6IHByb2ZpbGVEYXRhLmdlbmRlciB8fCAnJyxcbiAgICAgICAgICAgICAgICBiaW86IHByb2ZpbGVEYXRhLmJpbyB8fCAnJyxcbiAgICAgICAgICAgICAgICBwaG90b3M6IHByb2ZpbGVEYXRhLnBob3RvcyB8fCBbXSxcbiAgICAgICAgICAgICAgICBpbnRlcmVzdHM6IHByb2ZpbGVEYXRhLmludGVyZXN0cyB8fCBbXSxcbiAgICAgICAgICAgICAgICBsb29raW5nRm9yOiBwcm9maWxlRGF0YS5sb29raW5nRm9yIHx8ICcnLFxuICAgICAgICAgICAgICAgIGludGVyZXN0ZWRJbkdlbmRlcnM6IHByb2ZpbGVEYXRhLmludGVyZXN0ZWRJbkdlbmRlcnMgfHwgW10sXG4gICAgICAgICAgICAgICAgYWdlUmFuZ2VNaW46IHByb2ZpbGVEYXRhLmFnZVJhbmdlTWluIHx8IDE4LFxuICAgICAgICAgICAgICAgIGFnZVJhbmdlTWF4OiBwcm9maWxlRGF0YS5hZ2VSYW5nZU1heCB8fCAzNSxcbiAgICAgICAgICAgICAgICBtYXhEaXN0YW5jZTogcHJvZmlsZURhdGEubWF4RGlzdGFuY2UgfHwgMjUsXG4gICAgICAgICAgICAgICAgc2hvd09ubGluZTogcHJvZmlsZURhdGEuc2hvd09ubGluZSAhPT0gdW5kZWZpbmVkID8gcHJvZmlsZURhdGEuc2hvd09ubGluZSA6IHRydWUsXG4gICAgICAgICAgICAgICAgd29yazogcHJvZmlsZURhdGEud29yayB8fCAnJyxcbiAgICAgICAgICAgICAgICBzY2hvb2w6IHByb2ZpbGVEYXRhLnNjaG9vbCB8fCAnJyxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHByb2ZpbGVEYXRhLmhlaWdodCxcbiAgICAgICAgICAgICAgICB6b2RpYWNTaWduOiBwcm9maWxlRGF0YS56b2RpYWNTaWduIHx8ICcnLFxuICAgICAgICAgICAgICAgIGxpZmVzdHlsZTogcHJvZmlsZURhdGEubGlmZXN0eWxlIHx8IHtcbiAgICAgICAgICAgICAgICAgICAgc21va2luZzogJycsXG4gICAgICAgICAgICAgICAgICAgIGRyaW5raW5nOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgZXhlcmNpc2U6ICcnLFxuICAgICAgICAgICAgICAgICAgICBwZXRzOiAnJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHByZW1pdW06IGZhbHNlLFxuICAgICAgICAgICAgICAgIHN1cGVyTGlrZXNSZW1haW5pbmc6IDUsXG4gICAgICAgICAgICAgICAgbGlrZXNSZW1haW5pbmc6IDUwLFxuICAgICAgICAgICAgICAgIGRhaWx5U3dpcGVzOiAwLFxuICAgICAgICAgICAgICAgIGxhc3RTd2lwZVJlc2V0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgICAgICAgICBsYXN0QWN0aXZlOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgbmV3UHJvZmlsZSk7XG4gICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhyZXN1bHQpOyAqL1xuICAgICAgICAgICAgcmV0dXJuIHsgLi4ubmV3UHJvZmlsZSwgX2lkOiByZXN1bHQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIEhlYXJ0U3luYyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgdXBkYXRlUHJvZmlsZShzb3VyY2U6IG51bWJlciwgcHJvZmlsZURhdGE6IFBhcnRpYWw8SGVhcnRTeW5jUHJvZmlsZT4pOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGUgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgY29uc3QgdXBkYXRlRGF0YSA9IHtcbiAgICAgICAgICAgICAgICAuLi5wcm9maWxlRGF0YSxcbiAgICAgICAgICAgICAgICBsYXN0QWN0aXZlOiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSwgdXBkYXRlRGF0YSwgdW5kZWZpbmVkLCBmYWxzZSwgeyB1cHNlcnQ6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQudmFsdWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGRhdGluZyBIZWFydFN5bmMgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGVbXT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIFtdO1xuXG4gICAgICAgICAgICBjb25zdCB1c2VyUHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAoIXVzZXJQcm9maWxlKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIC8vIEdldCB1c2VycyBhbHJlYWR5IHN3aXBlZCBvblxuICAgICAgICAgICAgY29uc3Qgc3dpcGVkVXNlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfc3dpcGVzJywge1xuICAgICAgICAgICAgICAgIGZyb21Vc2VySWQ6IGNpdGl6ZW5JZFxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG4gICAgICAgICAgICBjb25zdCBzd2lwZWRVc2VySWRzID0gc3dpcGVkVXNlcnMubWFwKChzd2lwZTogYW55KSA9PiBzd2lwZS50b1VzZXJJZCk7XG5cbiAgICAgICAgICAgIC8vIEdldCBtYXRjaGVkIHVzZXJzXG4gICAgICAgICAgICBjb25zdCBtYXRjaGVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21hdGNoZXMnLCB7XG4gICAgICAgICAgICAgICAgJG9yOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgdXNlcjFJZDogY2l0aXplbklkIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgdXNlcjJJZDogY2l0aXplbklkIH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZWRVc2VySWRzID0gbWF0Y2hlcy5tYXAoKG1hdGNoOiBhbnkpID0+XG4gICAgICAgICAgICAgICAgbWF0Y2gudXNlcjFJZCA9PT0gY2l0aXplbklkID8gbWF0Y2gudXNlcjJJZCA6IG1hdGNoLnVzZXIxSWRcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIC8vIENvbWJpbmUgZXhjbHVkZWQgdXNlcnNcbiAgICAgICAgICAgIGNvbnN0IGV4Y2x1ZGVkVXNlcklkcyA9IFsuLi5zd2lwZWRVc2VySWRzLCAuLi5tYXRjaGVkVXNlcklkcywgY2l0aXplbklkXTtcblxuICAgICAgICAgICAgLy8gQnVpbGQgbWF0Y2ggY3JpdGVyaWFcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoQ3JpdGVyaWE6IGFueSA9IHtcbiAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IHsgJG5pbjogZXhjbHVkZWRVc2VySWRzIH0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgYWdlOiB7ICRndGU6IHVzZXJQcm9maWxlLmFnZVJhbmdlTWluLCAkbHRlOiB1c2VyUHJvZmlsZS5hZ2VSYW5nZU1heCB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBBZGQgZ2VuZGVyIHByZWZlcmVuY2VzXG4gICAgICAgICAgICBpZiAodXNlclByb2ZpbGUubG9va2luZ0ZvciAhPT0gJ0V2ZXJ5b25lJykge1xuICAgICAgICAgICAgICAgIG1hdGNoQ3JpdGVyaWEuZ2VuZGVyID0gdXNlclByb2ZpbGUubG9va2luZ0ZvciA9PT0gJ01lbicgPyAnTWFuJyA6ICdXb21hbic7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh1c2VyUHJvZmlsZS5pbnRlcmVzdGVkSW5HZW5kZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBtYXRjaENyaXRlcmlhLmxvb2tpbmdGb3IgPSB7XG4gICAgICAgICAgICAgICAgICAgICRpbjogdXNlclByb2ZpbGUuaW50ZXJlc3RlZEluR2VuZGVycy5pbmNsdWRlcyh1c2VyUHJvZmlsZS5nZW5kZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICA/IHVzZXJQcm9maWxlLmludGVyZXN0ZWRJbkdlbmRlcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIDogWy4uLnVzZXJQcm9maWxlLmludGVyZXN0ZWRJbkdlbmRlcnMsICdFdmVyeW9uZSddXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcG90ZW50aWFsTWF0Y2hlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19wcm9maWxlcycsIG1hdGNoQ3JpdGVyaWEsIHVuZGVmaW5lZCwgZmFsc2UsIHsgbGltaXQ6IDIwIH0pXG5cbiAgICAgICAgICAgIHJldHVybiBwb3RlbnRpYWxNYXRjaGVzO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBwb3RlbnRpYWwgbWF0Y2hlczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzd2lwZVByb2ZpbGUoc291cmNlOiBudW1iZXIsIHN3aXBlRGF0YTogeyB0YXJnZXRVc2VySWQ6IHN0cmluZzsgaXNMaWtlOiBib29sZWFuOyBpc1N1cGVyTGlrZT86IGJvb2xlYW4gfSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGlzTWF0Y2g6IGZhbHNlIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHsgdGFyZ2V0VXNlcklkLCBpc0xpa2UsIGlzU3VwZXJMaWtlID0gZmFsc2UgfSA9IHN3aXBlRGF0YTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgZGFpbHkgbGltaXRzXG4gICAgICAgICAgICBjb25zdCB1c2VyUHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAoIXVzZXJQcm9maWxlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgaXNNYXRjaDogZmFsc2UgfTtcblxuICAgICAgICAgICAgaWYgKGlzU3VwZXJMaWtlICYmIHVzZXJQcm9maWxlLnN1cGVyTGlrZXNSZW1haW5pbmcgPD0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBpc01hdGNoOiBmYWxzZSwgZXJyb3I6ICdObyBzdXBlciBsaWtlcyByZW1haW5pbmcnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlY29yZCB0aGUgc3dpcGVcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfc3dpcGVzJywge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgZnJvbVVzZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIHRvVXNlcklkOiB0YXJnZXRVc2VySWQsXG4gICAgICAgICAgICAgICAgaXNMaWtlLFxuICAgICAgICAgICAgICAgIGlzU3VwZXJMaWtlLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxldCBpc01hdGNoID0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBtYXRjaCBpZiBpdCdzIGEgbGlrZVxuICAgICAgICAgICAgaWYgKGlzTGlrZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlY2lwcm9jYWxTd2lwZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3N3aXBlcycsIHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbVVzZXJJZDogdGFyZ2V0VXNlcklkLFxuICAgICAgICAgICAgICAgICAgICB0b1VzZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgICAgICBpc0xpa2U6IHRydWVcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmIChyZWNpcHJvY2FsU3dpcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIG1hdGNoXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VyMUlkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VyMklkOiB0YXJnZXRVc2VySWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkQXQ6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzU3VwZXJMaWtlOiBpc1N1cGVyTGlrZSB8fCByZWNpcHJvY2FsU3dpcGUuaXNTdXBlckxpa2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlzTWF0Y2ggPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9ucyB0byBib3RoIHVzZXJzIGFib3V0IHRoZSBtYXRjaFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gR2V0IHBsYXllciBkYXRhIGZvciBib3RoIHVzZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzd2lwZXJEYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0RGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQodGFyZ2V0VXNlcklkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gR2V0IG9mZmxpbmUgZGF0YSBpZiBwbGF5ZXJzIGFyZSBub3Qgb25saW5lXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzd2lwZXJQbGF5ZXJEYXRhID0gc3dpcGVyRGF0YSB8fCBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldE9mZmxpbmVQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGxheWVyRGF0YSA9IHRhcmdldERhdGEgfHwgYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRPZmZsaW5lUGxheWVyQnlDaXRpemVuSWQodGFyZ2V0VXNlcklkKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBub3RpZmljYXRpb24gdG8gdGhlIHN3aXBlciAoY3VycmVudCB1c2VyKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN3aXBlckRhdGEgJiYgc3dpcGVyRGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc3dpcGVyRGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIkhlYXJ0U3luYyBNYXRjaCEgXHVEODNEXHVEQzk1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IG1hdGNoZWQgd2l0aCAke3RhcmdldFBsYXllckRhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSFgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwiaGVhcnRzeW5jXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9uIHRvIHRoZSB0YXJnZXQgdXNlclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldERhdGEgJiYgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIkhlYXJ0U3luYyBNYXRjaCEgXHVEODNEXHVEQzk1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IG1hdGNoZWQgd2l0aCAke3N3aXBlclBsYXllckRhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c3dpcGVyUGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSFgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwiaGVhcnRzeW5jXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKG5vdGlmaWNhdGlvbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzZW5kaW5nIG1hdGNoIG5vdGlmaWNhdGlvbnM6Jywgbm90aWZpY2F0aW9uRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHN3aXBlIGNvdW50c1xuICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZURhdGE6IGFueSA9IHtcbiAgICAgICAgICAgICAgICAgICAgZGFpbHlTd2lwZXM6IHVzZXJQcm9maWxlLmRhaWx5U3dpcGVzICsgMVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNTdXBlckxpa2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlRGF0YS5zdXBlckxpa2VzUmVtYWluaW5nID0gdXNlclByb2ZpbGUuc3VwZXJMaWtlc1JlbWFpbmluZyAtIDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlRGF0YS5saWtlc1JlbWFpbmluZyA9IHVzZXJQcm9maWxlLmxpa2VzUmVtYWluaW5nIC0gMTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSwgdXBkYXRlRGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGlzTWF0Y2ggfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHN3aXBpbmcgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgaXNNYXRjaDogZmFsc2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldE1hdGNoZXMoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPGFueVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMUlkOiBjaXRpemVuSWQgfSxcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMklkOiBjaXRpemVuSWQgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWVcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgc29ydDogeyBtYXRjaGVkQXQ6IC0xIH0gfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGVucmljaGVkTWF0Y2hlcyA9IGF3YWl0IFByb21pc2UuYWxsKG1hdGNoZXMubWFwKGFzeW5jIChtYXRjaDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3RoZXJVc2VySWQgPSBtYXRjaC51c2VyMUlkID09PSBjaXRpemVuSWQgPyBtYXRjaC51c2VyMklkIDogbWF0Y2gudXNlcjFJZDtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlclVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkOiBvdGhlclVzZXJJZCB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RNZXNzYWdlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfbWVzc2FnZXMnLCB7IG1hdGNoSWQ6IG1hdGNoLl9pZCB9LCB1bmRlZmluZWQsIGZhbHNlLCB7IHNvcnQ6IHsgdGltZXN0YW1wOiAtMSB9IH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgLi4ubWF0Y2gsXG4gICAgICAgICAgICAgICAgICAgIG90aGVyVXNlcixcbiAgICAgICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IGxhc3RNZXNzYWdlPy5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZVRpbWU6IGxhc3RNZXNzYWdlPy50aW1lc3RhbXAsXG4gICAgICAgICAgICAgICAgICAgIGlzTmV3TWF0Y2g6ICFsYXN0TWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IGF3YWl0IHRoaXMuZ2V0VW5yZWFkTWVzc2FnZUNvdW50KG1hdGNoLl9pZCEudG9TdHJpbmcoKSwgY2l0aXplbklkKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHJldHVybiBlbnJpY2hlZE1hdGNoZXM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIG1hdGNoZXM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRVbnJlYWRNZXNzYWdlQ291bnQobWF0Y2hJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb3VudCA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tZXNzYWdlcycsIHtcbiAgICAgICAgICAgICAgICBtYXRjaElkLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVySWQ6IHVzZXJJZCxcbiAgICAgICAgICAgICAgICByZWFkOiBmYWxzZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG4gICAgICAgICAgICByZXR1cm4gY291bnQubGVuZ3RoO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyB1bnJlYWQgY291bnQ6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNb2NrIGltcGxlbWVudGF0aW9ucyBmb3Igb3RoZXIgbWV0aG9kcyAtIHJlcGxhY2Ugd2l0aCBhY3R1YWwgbG9naWNcbiAgICBhc3luYyBnZXRTd2lwZVN0YXRzKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgcHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgIHJldHVybiBwcm9maWxlID8ge1xuICAgICAgICAgICAgbGlrZXNSZW1haW5pbmc6IHByb2ZpbGUubGlrZXNSZW1haW5pbmcsXG4gICAgICAgICAgICBzdXBlckxpa2VzUmVtYWluaW5nOiBwcm9maWxlLnN1cGVyTGlrZXNSZW1haW5pbmcsXG4gICAgICAgICAgICBkYWlseVN3aXBlczogcHJvZmlsZS5kYWlseVN3aXBlc1xuICAgICAgICB9IDogbnVsbDtcbiAgICB9XG5cbiAgICBhc3luYyBnZXROZWFyYnlVc2Vycyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIC8vIE1vY2sgaW1wbGVtZW50YXRpb24gLSByZXBsYWNlIHdpdGggYWN0dWFsIGdlb2xvY2F0aW9uIGxvZ2ljXG4gICAgICAgIHJldHVybiB0aGlzLmdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlKTtcbiAgICB9XG5cbiAgICBhc3luYyBnZXRPbmxpbmVVc2Vycyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IGZpdmVNaW51dGVzQWdvID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIDUgKiA2MCAqIDEwMDApO1xuICAgICAgICAgICAgY29uc3Qgb25saW5lVXNlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiB7ICRuZTogY2l0aXplbklkIH0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgbGFzdEFjdGl2ZTogeyAkZ3RlOiBmaXZlTWludXRlc0FnbyB9XG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlLCB7IGxpbWl0OiAxMCB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG9ubGluZVVzZXJzO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBvbmxpbmUgdXNlcnM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0UmVjZW50bHlBY3RpdmVVc2Vycyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IG9uZURheUFnbyA9IG5ldyBEYXRlKERhdGUubm93KCkgLSAyNCAqIDYwICogNjAgKiAxMDAwKTtcbiAgICAgICAgICAgIGNvbnN0IHJlY2VudFVzZXJzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywge1xuICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogeyAkbmU6IGNpdGl6ZW5JZCB9LFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGxhc3RBY3RpdmU6IHsgJGd0ZTogb25lRGF5QWdvIH1cbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgbGltaXQ6IDE1LCBzb3J0OiB7IGxhc3RBY3RpdmU6IC0xIH0gfSk7XG5cbiAgICAgICAgICAgIHJldHVybiByZWNlbnRVc2VycztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgcmVjZW50bHkgYWN0aXZlIHVzZXJzOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldFRvcFBpY2tzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvbiAtIHJlcGxhY2Ugd2l0aCBhY3R1YWwgYWxnb3JpdGhtXG4gICAgICAgIGNvbnN0IHBvdGVudGlhbE1hdGNoZXMgPSBhd2FpdCB0aGlzLmdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlKTtcbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbE1hdGNoZXMuc2xpY2UoMCwgOCk7XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0Tm90aWZpY2F0aW9ucyhzb3VyY2U6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgbmV3TWF0Y2hlczogMCwgbmV3TWVzc2FnZXM6IDAsIHN1cGVyTGlrZXM6IDAgfTtcblxuICAgICAgICAgICAgLy8gR2V0IG5ldyBtYXRjaGVzIChtYXRjaGVzIHdpdGhvdXQgbWVzc2FnZXMpXG4gICAgICAgICAgICBjb25zdCBuZXdNYXRjaGVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21hdGNoZXMnLCB7XG4gICAgICAgICAgICAgICAgJG9yOiBbeyB1c2VyMUlkOiBjaXRpemVuSWQgfSwgeyB1c2VyMklkOiBjaXRpemVuSWQgfV0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgLy8gQWRkIGxvZ2ljIHRvIGNoZWNrIGlmIG1hdGNoIGlzIG5ld1xuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIC8vIEdldCB1bnJlYWQgbWVzc2FnZXNcbiAgICAgICAgICAgIGNvbnN0IG5ld01lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21lc3NhZ2VzJywge1xuICAgICAgICAgICAgICAgIHJlY2VpdmVySWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICByZWFkOiBmYWxzZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIC8vIEdldCByZWNlaXZlZCBzdXBlciBsaWtlc1xuICAgICAgICAgICAgY29uc3Qgc3VwZXJMaWtlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19zd2lwZXMnLCB7XG4gICAgICAgICAgICAgICAgdG9Vc2VySWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBpc1N1cGVyTGlrZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBpc0xpa2U6IHRydWVcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBuZXdNYXRjaGVzOiBuZXdNYXRjaGVzLmxlbmd0aCwgbmV3TWVzc2FnZXM6IG5ld01lc3NhZ2VzLmxlbmd0aCwgc3VwZXJMaWtlczogc3VwZXJMaWtlcy5sZW5ndGggfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgbm90aWZpY2F0aW9uczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBuZXdNYXRjaGVzOiAwLCBuZXdNZXNzYWdlczogMCwgc3VwZXJMaWtlczogMCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0TWVzc2FnZXMoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkge1xuICAgICAgICByZXR1cm4gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21lc3NhZ2VzJywgeyBtYXRjaElkOiBkYXRhLm1hdGNoSWQgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgYXN5bmMgc2VuZE1lc3NhZ2Uoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkge1xuICAgICAgICAvKiBjb25zb2xlLmxvZyhkYXRhKTsgKi9cbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfbWF0Y2hlcycsIHsgX2lkOiBTdHJpbmcoZGF0YS5tYXRjaElkKSB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgY29uc3Qgc291cmNlQ2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgIGxldCBzb3VyY2VEYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChzb3VyY2VDaXRpemVuSWQpO1xuICAgICAgICBsZXQgdGFyZ2V0RGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQocmVzLnVzZXIxSWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHJlcy51c2VyMklkIDogcmVzLnVzZXIxSWQpO1xuXG4gICAgICAgIGlmICghc291cmNlRGF0YSkge1xuICAgICAgICAgICAgc291cmNlRGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0T2ZmbGluZVBsYXllckJ5Q2l0aXplbklkKHNvdXJjZUNpdGl6ZW5JZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRhcmdldERhdGEpIHtcbiAgICAgICAgICAgIHRhcmdldERhdGEgPSBhd2FpdCBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldE9mZmxpbmVQbGF5ZXJCeUNpdGl6ZW5JZChyZXMudXNlcjFJZCA9PT0gc291cmNlQ2l0aXplbklkID8gcmVzLnVzZXIySWQgOiByZXMudXNlcjFJZCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnNlcnREYXRhOiBNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHJlYWQ6IHJlcy51c2VyMUlkID09PSBzb3VyY2VDaXRpemVuSWQgfHwgcmVzLnVzZXIySWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHRydWUgOiBmYWxzZSxcbiAgICAgICAgICAgIG1hdGNoSWQ6IHJlcy5faWQsXG4gICAgICAgICAgICBzZW5kZXJJZDogc291cmNlQ2l0aXplbklkLFxuICAgICAgICAgICAgcmVjZWl2ZXJJZDogcmVzLnVzZXIxSWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHJlcy51c2VyMklkIDogcmVzLnVzZXIxSWQsXG4gICAgICAgICAgICBjb250ZW50OiBkYXRhLmNvbnRlbnQsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgnaGVhcnRzeW5jX21lc3NhZ2VzJywgaW5zZXJ0RGF0YSk7XG5cbiAgICAgICAgaWYgKHJlcy51c2VyMUlkICE9PSBzb3VyY2VDaXRpemVuSWQgfHwgcmVzLnVzZXIySWQgIT09IHNvdXJjZUNpdGl6ZW5JZCAmJiB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlKSB7XG4gICAgICAgICAgICBlbWl0TmV0KCdoZWFydHN5bmM6Y2xpZW50OnNlbmRNZXNzYWdlJywgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoaW5zZXJ0RGF0YSkpO1xuICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIkhlYXJ0U3luY1wiLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBoYXZlIGEgbmV3IG1lc3NhZ2UgZnJvbSBcIiArIHNvdXJjZURhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWUgKyBcIiBcIiArIHNvdXJjZURhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZSxcbiAgICAgICAgICAgICAgICBhcHA6IFwiaGVhcnRzeW5jXCIsXG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbnNlcnREYXRhO1xuICAgIH1cblxuICAgIGFzeW5jIHVubWF0Y2goc291cmNlOiBudW1iZXIsIGRhdGE6IHsgbWF0Y2hJZDogc3RyaW5nIH0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfbWF0Y2hlcycsIHsgX2lkOiBkYXRhLm1hdGNoSWQgfSk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoIHx8ICFtYXRjaC5pc0FjdGl2ZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIHVzZXIgaXMgcGFydCBvZiB0aGlzIG1hdGNoXG4gICAgICAgICAgICBpZiAobWF0Y2gudXNlcjFJZCAhPT0gY2l0aXplbklkICYmIG1hdGNoLnVzZXIySWQgIT09IGNpdGl6ZW5JZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vdCBhdXRob3JpemVkIHRvIHVubWF0Y2ggdGhpcyB1c2VyJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBEZWFjdGl2YXRlIHRoZSBtYXRjaFxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywgeyBfaWQ6IGRhdGEubWF0Y2hJZCB9LCB7IGlzQWN0aXZlOiBmYWxzZSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgdW5tYXRjaGluZzonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdGYWlsZWQgdG8gdW5tYXRjaCcgfTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgaGVhcnRTeW5jU2VydmVyID0gbmV3IEhlYXJ0U3luY1NlcnZlcigpO1xuXG4vLyBSZWdpc3RlciBzZXJ2ZXIgY2FsbGJhY2tzXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0UHJvZmlsZScsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0UHJvZmlsZShzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpjcmVhdGVQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmNyZWF0ZVByb2ZpbGUoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6dXBkYXRlUHJvZmlsZScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci51cGRhdGVQcm9maWxlKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFBvdGVudGlhbE1hdGNoZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6c3dpcGVQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLnN3aXBlUHJvZmlsZShzb3VyY2UsIGRhdGEpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXRNYXRjaGVzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRNYXRjaGVzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFN3aXBlU3RhdHMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFN3aXBlU3RhdHMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0TmVhcmJ5VXNlcnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE5lYXJieVVzZXJzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE9ubGluZVVzZXJzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRPbmxpbmVVc2Vycyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXRSZWNlbnRseUFjdGl2ZVVzZXJzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRSZWNlbnRseUFjdGl2ZVVzZXJzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFRvcFBpY2tzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRUb3BQaWNrcyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXROb3RpZmljYXRpb25zJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXROb3RpZmljYXRpb25zKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE1lc3NhZ2VzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE1lc3NhZ2VzKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOnNlbmRNZXNzYWdlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLnNlbmRNZXNzYWdlKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOnVubWF0Y2gnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIudW5tYXRjaChzb3VyY2UsIGRhdGEpO1xufSk7XG5cbi8vIEFkZCBtb3JlIGNhbGxiYWNrcyBmb3IgbWVzc2FnZXMsIHN1cGVyIGxpa2VzLCBldGMuXG4vLyAuLi4gKGltcGxlbWVudCByZW1haW5pbmcgY2FsbGJhY2tzIGFzIG5lZWRlZClcblxuZXhwb3J0IHsgaGVhcnRTeW5jU2VydmVyIH07XG4iLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRnJhbWV3b3JrLCBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRGF0ZVRpbWUgfSBmcm9tICdsdXhvbic7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdjcnlwdG86Z2V0QmFsYW5jZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgY3J5cHRvID0gcGxheWVyLlBsYXllckRhdGEubWV0YWRhdGEuY3J5cHRvIHx8IHt9O1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShjcnlwdG8pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NyeXB0bzpidXknLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgdHlwZSwgYW1vdW50LCBwcmljZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghcGxheWVyIHx8ICFbXCJzaHVuZ1wiLCBcImduZVwiLCBcInhjb2luXCIsIFwibG1lXCJdLmluY2x1ZGVzKHR5cGUpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgY29uc3QgdG90YWxDb3N0ID0gYW1vdW50ICogcHJpY2U7ICAvLyBBc3N1bWUgcHJpY2UgaXMgcGVyIHVuaXRcbiAgICBpZiAocGxheWVyLlBsYXllckRhdGEubW9uZXkuYmFuayA8IHRvdGFsQ29zdCkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGlmIChwbGF5ZXIuRnVuY3Rpb25zLlJlbW92ZU1vbmV5KCdiYW5rJywgdG90YWxDb3N0KSkge1xuICAgICAgICBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uQWRkQ3J5cHRvKHNvdXJjZSwgdHlwZSwgYW1vdW50KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAnY3J5cHRvX2J1eScsXG4gICAgICAgICAgICB0aXRsZTogJ0NyeXB0byBCdXknLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7cGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3BsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBib3VnaHQgJHthbW91bnR9ICR7dHlwZX0gZm9yICQke3RvdGFsQ29zdH0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY3J5cHRvOnNlbGwnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgdHlwZSwgYW1vdW50LCBwcmljZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghcGxheWVyIHx8ICFbXCJzaHVuZ1wiLCBcImduZVwiLCBcInhjb2luXCIsIFwibG1lXCJdLmluY2x1ZGVzKHR5cGUpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgaWYgKCFleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uaGFzRW5vdWdoKHNvdXJjZSwgdHlwZSwgYW1vdW50KSkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5SZW1vdmVDcnlwdG8oc291cmNlLCB0eXBlLCBhbW91bnQpO1xuICAgIHBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoJ2JhbmsnLCBhbW91bnQgKiBwcmljZSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdjcnlwdG9fc2VsbCcsXG4gICAgICAgIHRpdGxlOiAnQ3J5cHRvIFNlbGwnLFxuICAgICAgICBtZXNzYWdlOiBgJHtwbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7cGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IHNvbGQgJHthbW91bnR9ICR7dHlwZX0gZm9yICQke2Ftb3VudCAqIHByaWNlfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NyeXB0bzp0cmFuc2ZlcicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0eXBlLCBhbW91bnQsIHRhcmdldCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghc291cmNlUGxheWVyIHx8ICFbXCJzaHVuZ1wiLCBcImduZVwiLCBcInhjb2luXCIsIFwibG1lXCJdLmluY2x1ZGVzKHR5cGUpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgaWYgKCFleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uaGFzRW5vdWdoKHNvdXJjZSwgdHlwZSwgYW1vdW50KSkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIC8vIEFzc3VtZSB0YXJnZXQgaXMgcGhvbmUgbnVtYmVyIHRvIGdldCBjaXRpemVuSWRcbiAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHRhcmdldCk7XG4gICAgaWYgKCF0YXJnZXRDaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllckJ5Q2l0aXplbklkKHRhcmdldENpdGl6ZW5JZCk7XG4gICAgaWYgKCF0YXJnZXRQbGF5ZXIpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uUmVtb3ZlQ3J5cHRvKHNvdXJjZSwgdHlwZSwgYW1vdW50KTtcbiAgICBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uQWRkQ3J5cHRvKHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgdHlwZSwgYW1vdW50KTtcbiAgICBcbiAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogJ0NyeXB0bycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IHRyYW5zZmVycmVkICR7YW1vdW50fSAke3R5cGV9IHRvICR7dGFyZ2V0fS5gLFxuICAgICAgICBhcHA6ICdjcnlwdG8nLFxuICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgfSkpO1xuICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiAnQ3J5cHRvJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgcmVjZWl2ZWQgJHthbW91bnR9ICR7dHlwZX0gZnJvbSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0uYCxcbiAgICAgICAgYXBwOiAnY3J5cHRvJyxcbiAgICAgICAgdGltZW91dDogNTAwMFxuICAgIH0pKTtcbiAgICBcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ2NyeXB0b190cmFuc2ZlcicsXG4gICAgICAgIHRpdGxlOiAnQ3J5cHRvIFRyYW5zZmVyJyxcbiAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSB0cmFuc2ZlcnJlZCAke2Ftb3VudH0gJHt0eXBlfSB0byAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IEZyYW1ld29yaywgTXlTUUwgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UsIElOVkVOVE9SWV9SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmNvbnN0IGludlBhdGggPSBgbnVpOi8vJHtJTlZFTlRPUllfUkVTT1VSQ0V9L2h0bWwvaW1hZ2VzL2A7XG5cbnR5cGUgUmV3YXJkVHlwZSA9IFwidmVoaWNsZVwiIHwgXCJpdGVtXCIgfCBcImNhc2hcIiB8IFwiYmFua1wiIHwgXCJ3ZWFwb25cIjtcbnR5cGUgUmFyaXR5ID0gXCJsZWdlbmRhcnlcIiB8IFwiZXBpY1wiIHwgXCJyYXJlXCIgfCBcImNvbW1vblwiO1xuXG5pbnRlcmZhY2UgUm91bGV0dGVSZXdhcmQge1xuICAgIGlkOiBudW1iZXI7XG4gICAgdHlwZTogUmV3YXJkVHlwZTtcbiAgICBtb2RlbDogc3RyaW5nIHwgbnVtYmVyO1xuICAgIHJhcml0eTogUmFyaXR5O1xuICAgIGltZzogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBzZWxsOiBudW1iZXI7XG4gICAgcXVhbnRpdHk/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBEYWlseVNwaW5Db25maWdTaGFwZSB7XG4gICAgVGltZVRvQ2xhaW06IG51bWJlcjtcbiAgICBBbmltYXRpb25EdXJhdGlvbjogbnVtYmVyO1xuICAgIFJvdWxldHRlRGF0YTogUmVjb3JkPG51bWJlciwgUm91bGV0dGVSZXdhcmQ+O1xuICAgIFJhcml0eVByb2JhYmlsaXR5OiBSZWNvcmQ8UmFyaXR5LCBudW1iZXI+O1xuICAgIFNlbGxUeXBlOiBcImJhbmtcIiB8IFwiY2FzaFwiO1xuICAgIFdlYXBvbkFtb3VudDogbnVtYmVyO1xuICAgIENhclBhcmtpbmdTcGF3bjogc3RyaW5nO1xufVxuXG5jb25zdCBEYWlseVNwaW5Db25maWc6IERhaWx5U3BpbkNvbmZpZ1NoYXBlID0ge1xuICAgIFRpbWVUb0NsYWltOiAoMjQgKiAzNjAwKSxcblxuICAgIEFuaW1hdGlvbkR1cmF0aW9uOiAxMixcblxuICAgIFJvdWxldHRlRGF0YToge1xuICAgICAgICAwOiB7XG4gICAgICAgICAgICBpZDogMCxcbiAgICAgICAgICAgIHR5cGU6IFwidmVoaWNsZVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwicGVudW1icmFcIixcbiAgICAgICAgICAgIHJhcml0eTogXCJsZWdlbmRhcnlcIixcbiAgICAgICAgICAgIGltZzogXCJodHRwczovL2RvY3MuZml2ZW0ubmV0L3ZlaGljbGVzL3BlbnVtYnJhLndlYnBcIixcbiAgICAgICAgICAgIG5hbWU6IFwiUGVudW1icmFcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDAwXG4gICAgICAgIH0sXG4gICAgICAgIDE6IHtcbiAgICAgICAgICAgIGlkOiAxLFxuICAgICAgICAgICAgdHlwZTogXCJ3ZWFwb25cIixcbiAgICAgICAgICAgIG1vZGVsOiBcIndlYXBvbl9kcmFjb1wiLFxuICAgICAgICAgICAgcmFyaXR5OiBcImVwaWNcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1xYl9kcmFjby5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJEcmFjb1wiLFxuICAgICAgICAgICAgc2VsbDogMTAwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMjoge1xuICAgICAgICAgICAgaWQ6IDIsXG4gICAgICAgICAgICByYXJpdHk6IFwicmFyZVwiLFxuICAgICAgICAgICAgdHlwZTogXCJ3ZWFwb25cIixcbiAgICAgICAgICAgIG1vZGVsOiBcIndlYXBvbl9icm93bmluZ1wiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXFiX2Jyb3duaW5nLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkJyb3duaW5nXCIsXG4gICAgICAgICAgICBzZWxsOiAyNTAwXG4gICAgICAgIH0sXG4gICAgICAgIDM6IHtcbiAgICAgICAgICAgIGlkOiAzLFxuICAgICAgICAgICAgcmFyaXR5OiBcInJhcmVcIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwiYWR2YW5jZWRyZXBhaXJraXRcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1hZHZhbmNlZGtpdC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJBZHYgUmVwYWlyIEtpdCB4NVwiLFxuICAgICAgICAgICAgc2VsbDogNTAwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiA1XG4gICAgICAgIH0sXG4gICAgICAgIDQ6IHtcbiAgICAgICAgICAgIGlkOiA0LFxuICAgICAgICAgICAgcmFyaXR5OiBcInJhcmVcIixcbiAgICAgICAgICAgIHR5cGU6IFwiY2FzaFwiLFxuICAgICAgICAgICAgbW9kZWw6IDEwMDAwLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWNhc2gucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiJDEwMDAwIENhc2hcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDBcbiAgICAgICAgfSxcbiAgICAgICAgNToge1xuICAgICAgICAgICAgaWQ6IDUsXG4gICAgICAgICAgICByYXJpdHk6IFwicmFyZVwiLFxuICAgICAgICAgICAgdHlwZTogXCJpdGVtXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJhZHZhbmNlZGxvY2twaWNrXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9YWR2YW5jZWRsb2NrcGljay5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJBZHZhbmNlZCBMb2NrcGljayB4NVwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiA1XG4gICAgICAgIH0sXG4gICAgICAgIDY6IHtcbiAgICAgICAgICAgIGlkOiA2LFxuICAgICAgICAgICAgcmFyaXR5OiBcImNvbW1vblwiLFxuICAgICAgICAgICAgdHlwZTogXCJpdGVtXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJmYWtcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1maXJzdGFpZC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJGQUsgeDEwXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDEwXG4gICAgICAgIH0sXG4gICAgICAgIDc6IHtcbiAgICAgICAgICAgIGlkOiA3LFxuICAgICAgICAgICAgcmFyaXR5OiBcImNvbW1vblwiLFxuICAgICAgICAgICAgdHlwZTogXCJjYXNoXCIsXG4gICAgICAgICAgICBtb2RlbDogNTAwMCxcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1jYXNoLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIiQ1MDAwIENhc2hcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDBcbiAgICAgICAgfSxcbiAgICAgICAgODoge1xuICAgICAgICAgICAgaWQ6IDgsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImxvY2twaWNrXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9bG9ja3BpY2sucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiTG9ja3BpY2sgeDEwXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDEwXG4gICAgICAgIH0sXG4gICAgICAgIDk6IHtcbiAgICAgICAgICAgIGlkOiA5LFxuICAgICAgICAgICAgcmFyaXR5OiBcImVwaWNcIixcbiAgICAgICAgICAgIHR5cGU6IFwiY2FzaFwiLFxuICAgICAgICAgICAgbW9kZWw6IDI1MDAwLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWNhc2gucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiJDI1MDAwIENhc2hcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDAwXG4gICAgICAgIH0sXG4gICAgICAgIDEwOiB7XG4gICAgICAgICAgICBpZDogMTAsXG4gICAgICAgICAgICByYXJpdHk6IFwibGVnZW5kYXJ5XCIsXG4gICAgICAgICAgICB0eXBlOiBcIndlYXBvblwiLFxuICAgICAgICAgICAgbW9kZWw6IFwid2VhcG9uX2FrNDdcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH13ZWFwb25fYXNzYXVsdHJpZmxlLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkFLNDdcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDAwXG4gICAgICAgIH0sXG4gICAgICAgIDExOiB7XG4gICAgICAgICAgICBpZDogMTEsXG4gICAgICAgICAgICByYXJpdHk6IFwiZXBpY1wiLFxuICAgICAgICAgICAgdHlwZTogXCJ2ZWhpY2xlXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJmYWdnaW9cIixcbiAgICAgICAgICAgIGltZzogXCJodHRwczovL2RvY3MuZml2ZW0ubmV0L3ZlaGljbGVzL2ZhZ2dpby53ZWJwXCIsXG4gICAgICAgICAgICBuYW1lOiBcIkZhZ2dpb1wiLFxuICAgICAgICAgICAgc2VsbDogMTAwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTI6IHtcbiAgICAgICAgICAgIGlkOiAxMixcbiAgICAgICAgICAgIHJhcml0eTogXCJyYXJlXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImhlYXZ5YXJtb3JcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1hcm1vci5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJIZWF2eSBBcm1vciB4MlwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiAyXG4gICAgICAgIH0sXG4gICAgICAgIDEzOiB7XG4gICAgICAgICAgICBpZDogMTMsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImpvaW50XCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9am9pbnQucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiSm9pbnQgeDE1XCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDE1XG4gICAgICAgIH0sXG4gICAgICAgIDE0OiB7XG4gICAgICAgICAgICBpZDogMTQsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImJsb2Nrb2NoZWVzZVwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXJhdF9jaGVlc2UucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiQ2hlZXNlIHgyMFwiLFxuICAgICAgICAgICAgc2VsbDogMTAwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiAyMFxuICAgICAgICB9LFxuICAgICAgICAxNToge1xuICAgICAgICAgICAgaWQ6IDE1LFxuICAgICAgICAgICAgdHlwZTogXCJjYXNoXCIsXG4gICAgICAgICAgICBtb2RlbDogNzUwMDAsXG4gICAgICAgICAgICByYXJpdHk6IFwibGVnZW5kYXJ5XCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9Y2FzaC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCIkNzUwMDAgQ2FzaFwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTY6IHtcbiAgICAgICAgICAgIGlkOiAxNixcbiAgICAgICAgICAgIHJhcml0eTogXCJjb21tb25cIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwicmVjeWNsYWJsZV9tYXRlcmlhbFwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXJlY3ljbGFibGUtbWF0ZXJpYWwucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiUmVjeWNsYWJsZXMgeDEwMFwiLFxuICAgICAgICAgICAgc2VsbDogMTAwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiAxMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTc6IHtcbiAgICAgICAgICAgIGlkOiAxNyxcbiAgICAgICAgICAgIHJhcml0eTogXCJyYXJlXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcInJlY3ljbGFibGVfbWF0ZXJpYWxcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1yZWN5Y2xhYmxlLW1hdGVyaWFsLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIlJlY3ljbGFibGVzIHgyNTBcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDAsXG4gICAgICAgICAgICBxdWFudGl0eTogMjUwXG4gICAgICAgIH0sXG4gICAgfSxcblxuICAgIFJhcml0eVByb2JhYmlsaXR5OiB7XG4gICAgICAgIGxlZ2VuZGFyeTogMC4wMDEsXG4gICAgICAgIGVwaWM6IDAuMDIsXG4gICAgICAgIHJhcmU6IDAuMjAsXG4gICAgICAgIGNvbW1vbjogMC43NzlcbiAgICB9LFxuXG4gICAgU2VsbFR5cGU6IFwiYmFua1wiLCAvLyBiYW5rIG9yIGNhc2hcblxuICAgIFdlYXBvbkFtb3VudDogMjUwLCAvLyBhbW91bnQgb2YgYW1tbyB0byBnaXZlIHdoZW4gYSB3ZWFwb24gaXMgd29uXG5cbiAgICBDYXJQYXJraW5nU3Bhd246IFwiYWx0YVwiLCAvLyBRQjogZ2FyYWdlLCBFU1g6IHBhcmtpbmdcbn07XG5cbmNvbnN0IG5vd0luU2Vjb25kcyA9ICgpID0+IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuXG5jb25zdCBmb3JtYXRSZW1haW5pbmcgPSAocmVtYWluaW5nOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBob3VycyA9IE1hdGguZmxvb3IocmVtYWluaW5nIC8gMzYwMCk7XG4gICAgY29uc3QgbWlucyA9IE1hdGguZmxvb3IoKHJlbWFpbmluZyAlIDM2MDApIC8gNjApO1xuICAgIGNvbnN0IHNlY3MgPSByZW1haW5pbmcgJSA2MDtcblxuICAgIHJldHVybiBgJHtTdHJpbmcoaG91cnMpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcobWlucykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhzZWNzKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn07XG5cbmNvbnN0IGdldENvb2xkb3duU3RhdGUgPSAocGxheWVyOiBhbnkpID0+IHtcbiAgICBjb25zdCBsYXN0ID0gcGxheWVyPy5QbGF5ZXJEYXRhPy5tZXRhZGF0YT8uUGhvbmVEYWlseVNwaW4gPz8gMDtcbiAgICBjb25zdCBkaWZmID0gbm93SW5TZWNvbmRzKCkgLSBsYXN0O1xuXG4gICAgaWYgKGRpZmYgPj0gRGFpbHlTcGluQ29uZmlnLlRpbWVUb0NsYWltKSB7XG4gICAgICAgIHJldHVybiB7IGNhbkNsYWltOiB0cnVlLCBsYXN0Q2xhaW1lZERpc3BsYXk6IFwiMDA6MDA6MDBcIiB9O1xuICAgIH1cblxuICAgIGNvbnN0IHJlbWFpbmluZyA9IERhaWx5U3BpbkNvbmZpZy5UaW1lVG9DbGFpbSAtIGRpZmY7XG4gICAgcmV0dXJuIHsgY2FuQ2xhaW06IGZhbHNlLCBsYXN0Q2xhaW1lZERpc3BsYXk6IGZvcm1hdFJlbWFpbmluZyhyZW1haW5pbmcpIH07XG59O1xuXG5jb25zdCByZXNvbHZlRnJhbWV3b3JrID0gKCkgPT4ge1xuICAgIGlmIChGcmFtZXdvcmspIHJldHVybiBGcmFtZXdvcms7XG5cbiAgICBjb25zdCBjb25maWd1cmVkID0gZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdO1xuICAgIGlmICh0eXBlb2YgY29uZmlndXJlZD8uR2V0Q29yZU9iamVjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gY29uZmlndXJlZC5HZXRDb3JlT2JqZWN0KCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHJldHVybiBjb25maWd1cmVkIGRpcmVjdGx5XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbmZpZ3VyZWQpIHJldHVybiBjb25maWd1cmVkO1xuXG4gICAgY29uc3QgcWIgPSBleHBvcnRzWydxYi1jb3JlJ10/LkdldENvcmVPYmplY3Q/LigpO1xuICAgIGlmIChxYikgcmV0dXJuIHFiO1xuXG4gICAgY29uc3QgcWJ4ID0gZXhwb3J0c1sncWJ4LWNvcmUnXSA/PyBleHBvcnRzWydxYnhfY29yZSddO1xuICAgIGlmICh0eXBlb2YgcWJ4Py5HZXRDb3JlT2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBxYnguR2V0Q29yZU9iamVjdCgpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaCB0byByZXR1cm4gcWJ4IGRpcmVjdGx5XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHFieDtcbn07XG5cbmNvbnN0IGdldFBsYXllciA9IChzcmM6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGZ3ID0gcmVzb2x2ZUZyYW1ld29yaygpO1xuICAgIHJldHVybiBmdz8uRnVuY3Rpb25zPy5HZXRQbGF5ZXI/LihzcmMpID8/IGZ3Py5HZXRQbGF5ZXI/LihzcmMpO1xufTtcblxub25OZXQoXCJkYWlseVNwaW46Z2V0U3RhdGVTZXJ2ZXJcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHNyYyA9IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIoc3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgY29uc3QgeyBjYW5DbGFpbSwgbGFzdENsYWltZWREaXNwbGF5IH0gPSBnZXRDb29sZG93blN0YXRlKHBsYXllcik7XG5cbiAgICBlbWl0TmV0KFwiZGFpbHlTcGluOnJldHVyblN0YXRlXCIsIHNyYywge1xuICAgICAgICB1c2VyRGF0YToge1xuICAgICAgICAgICAgY2FuQ2xhaW0sXG4gICAgICAgICAgICBsYXN0Q2xhaW1lZERpc3BsYXksXG4gICAgICAgIH0sXG4gICAgICAgIHJvdWxldHRlRGF0YTogRGFpbHlTcGluQ29uZmlnLlJvdWxldHRlRGF0YSxcbiAgICAgICAgcHJvYmFiaWxpdHk6IERhaWx5U3BpbkNvbmZpZy5SYXJpdHlQcm9iYWJpbGl0eSxcbiAgICAgICAgYW5pbWF0aW9uRHVyYXRpb246IERhaWx5U3BpbkNvbmZpZy5BbmltYXRpb25EdXJhdGlvbixcbiAgICB9KTtcbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpjbGFpbVNlcnZlclwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcihzcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLlNldE1ldGFEYXRhKFwiUGhvbmVEYWlseVNwaW5cIiwgbm93SW5TZWNvbmRzKCkpO1xufSk7XG5cbm9uTmV0KFwiZGFpbHlTcGluOnJld2FyZFNlcnZlclwiLCAoaWQ6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHNyYyA9IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIoc3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgY29uc3QgcmV3YXJkSWQgPSBOdW1iZXIoaWQpO1xuICAgIGlmIChOdW1iZXIuaXNOYU4ocmV3YXJkSWQpKSByZXR1cm47XG5cbiAgICBjb25zdCByZXdhcmQgPSBEYWlseVNwaW5Db25maWcuUm91bGV0dGVEYXRhW3Jld2FyZElkXTtcbiAgICBpZiAoIXJld2FyZCkgcmV0dXJuO1xuXG4gICAgc3dpdGNoIChyZXdhcmQudHlwZSkge1xuICAgICAgICBjYXNlIFwidmVoaWNsZVwiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlVmVoaWNsZVwiLCByZXdhcmQubW9kZWwsIHNyYyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIml0ZW1cIjpcbiAgICAgICAgICAgIGVtaXQoXCJkYWlseVNwaW46Z2l2ZUl0ZW1cIiwgcmV3YXJkLm1vZGVsLCByZXdhcmQucXVhbnRpdHkgPz8gMSwgc3JjKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiY2FzaFwiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlQ2FzaFwiLCByZXdhcmQubW9kZWwsIHNyYyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcImJhbmtcIjpcbiAgICAgICAgICAgIGVtaXQoXCJkYWlseVNwaW46Z2l2ZUJhbmtcIiwgcmV3YXJkLm1vZGVsLCBzcmMpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJ3ZWFwb25cIjpcbiAgICAgICAgICAgIGVtaXQoXCJkYWlseVNwaW46Z2l2ZVdlYXBvblwiLCByZXdhcmQubW9kZWwsIHNyYyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46c2VsbFNlcnZlclwiLCAoaWQ6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHNyYyA9IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICAvLyBTZWxsaW5nIGRpc2FibGVkOyB0cmVhdCBzZWxsIGFzIGNvbGxlY3QvcmV3YXJkXG4gICAgZW1pdChcImRhaWx5U3BpbjpyZXdhcmRTZXJ2ZXJcIiwgaWQsIHNyYyk7XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46Z2l2ZUl0ZW1cIiwgKGl0ZW06IHN0cmluZywgcXR5ID0gMSwgc3JjPzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0U3JjID0gc3JjID8/IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIodGFyZ2V0U3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgcGxheWVyLkZ1bmN0aW9ucy5BZGRJdGVtKGl0ZW0sIHF0eSk7XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46Z2l2ZUNhc2hcIiwgKGFtb3VudDogbnVtYmVyLCBzcmM/OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCB0YXJnZXRTcmMgPSBzcmMgPz8gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXRTcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KFwiY2FzaFwiLCBhbW91bnQsIFwiZGFpbHktc3Bpbi1jYXNoXCIpO1xufSk7XG5cbm9uTmV0KFwiZGFpbHlTcGluOmdpdmVCYW5rXCIsIChhbW91bnQ6IG51bWJlciwgc3JjPzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0U3JjID0gc3JjID8/IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIodGFyZ2V0U3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgcGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leShcImJhbmtcIiwgYW1vdW50LCBcImRhaWx5LXNwaW4tYmFua1wiKTtcbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpnaXZlV2VhcG9uXCIsICh3ZWFwb246IHN0cmluZywgc3JjPzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0U3JjID0gc3JjID8/IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIodGFyZ2V0U3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgcGxheWVyLkZ1bmN0aW9ucy5BZGRJdGVtKHdlYXBvbiwgRGFpbHlTcGluQ29uZmlnLldlYXBvbkFtb3VudCk7XG59KTtcblxuY29uc3QgZ2VuZXJhdGVQbGF0ZSA9IGFzeW5jICgpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICAgIGNvbnN0IGZ3ID0gcmVzb2x2ZUZyYW1ld29yaygpO1xuICAgIGlmICghZnc/LlNoYXJlZCkgcmV0dXJuIFwiU1BJTjEyM1wiO1xuXG4gICAgY29uc3QgcGxhdGUgPSBgJHtmdy5TaGFyZWQuUmFuZG9tSW50KDEpfSR7ZncuU2hhcmVkLlJhbmRvbVN0cigyKX0ke2Z3LlNoYXJlZC5SYW5kb21JbnQoMyl9JHtmdy5TaGFyZWQuUmFuZG9tU3RyKDIpfWA7XG5cbiAgICBjb25zdCBleGlzdHMgPSBNeVNRTD8uc2NhbGFyID8gYXdhaXQgTXlTUUwuc2NhbGFyKFwiU0VMRUNUIHBsYXRlIEZST00gcGxheWVyX3ZlaGljbGVzIFdIRVJFIHBsYXRlID0gP1wiLCBbcGxhdGVdKSA6IG51bGw7XG4gICAgaWYgKGV4aXN0cykge1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGVQbGF0ZSgpO1xuICAgIH1cblxuICAgIHJldHVybiBwbGF0ZS50b1VwcGVyQ2FzZSgpO1xufTtcblxub25OZXQoXCJkYWlseVNwaW46Z2l2ZVZlaGljbGVcIiwgYXN5bmMgKG1vZGVsOiBzdHJpbmcsIHNyYz86IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHRhcmdldFNyYyA9IHNyYyA/PyBOdW1iZXIoZ2xvYmFsLnNvdXJjZSk7XG4gICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyKHRhcmdldFNyYyk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybjtcblxuICAgIGNvbnN0IHBsYXRlID0gYXdhaXQgZ2VuZXJhdGVQbGF0ZSgpO1xuXG4gICAgYXdhaXQgTXlTUUw/Lmluc2VydD8uKFxuICAgICAgICBcIklOU0VSVCBJTlRPIHBsYXllcl92ZWhpY2xlcyAobGljZW5zZSwgY2l0aXplbmlkLCB2ZWhpY2xlLCBoYXNoLCBtb2RzLCBwbGF0ZSwgZ2FyYWdlLCBzdGF0ZSkgVkFMVUVTICg/LCA/LCA/LCA/LCA/LCA/LCA/LCA/KVwiLFxuICAgICAgICBbXG4gICAgICAgICAgICBwbGF5ZXIuUGxheWVyRGF0YS5saWNlbnNlLFxuICAgICAgICAgICAgcGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgbW9kZWwsXG4gICAgICAgICAgICBHZXRIYXNoS2V5KG1vZGVsKSxcbiAgICAgICAgICAgIFwie31cIixcbiAgICAgICAgICAgIHBsYXRlLFxuICAgICAgICAgICAgRGFpbHlTcGluQ29uZmlnLkNhclBhcmtpbmdTcGF3bixcbiAgICAgICAgICAgIDAsIC8vIHN0b3JlZFxuICAgICAgICBdXG4gICAgKTtcbn0pO1xuXG5jb25zdCBjb21tYW5kQ3R4ID0gcmVzb2x2ZUZyYW1ld29yaygpPy5Db21tYW5kcztcbmlmIChjb21tYW5kQ3R4Py5BZGQpIHtcbiAgICBjb21tYW5kQ3R4LkFkZChcbiAgICAgICAgXCJyZXNldGRhaWx5c3BpblwiLFxuICAgICAgICBcIlJlc2V0IGEgcGxheWVyJ3MgZGFpbHkgc3BpbiBjb29sZG93blwiLFxuICAgICAgICBbeyBuYW1lOiBcImlkXCIsIGhlbHA6IFwiUGxheWVyIElEXCIgfV0sXG4gICAgICAgIHRydWUsXG4gICAgICAgIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IE51bWJlcihhcmdzWzBdKTtcbiAgICAgICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgZW1pdE5ldChcIlFCQ29yZTpOb3RpZnlcIiwgc291cmNlLCBcIkludmFsaWQgSURcIiwgXCJlcnJvclwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXQpO1xuICAgICAgICAgICAgaWYgKCFwbGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBlbWl0TmV0KFwiUUJDb3JlOk5vdGlmeVwiLCBzb3VyY2UsIFwiUGxheWVyIG5vdCBvbmxpbmVcIiwgXCJlcnJvclwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBsYXllci5GdW5jdGlvbnMuU2V0TWV0YURhdGEoXCJQaG9uZURhaWx5U3BpblwiLCAwKTtcblxuICAgICAgICAgICAgZW1pdE5ldChcIlFCQ29yZTpOb3RpZnlcIiwgc291cmNlLCBgRGFpbHkgc3BpbiByZXNldCBmb3IgSUQgJHt0YXJnZXR9YCwgXCJzdWNjZXNzXCIpO1xuICAgICAgICAgICAgZW1pdE5ldChcIlFCQ29yZTpOb3RpZnlcIiwgdGFyZ2V0LCBcIllvdXIgRGFpbHkgU3BpbiBoYXMgYmVlbiByZXNldCFcIiwgXCJzdWNjZXNzXCIpO1xuICAgICAgICB9LFxuICAgICAgICBcImFkbWluXCJcbiAgICApO1xufSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oXCJbc3VtbWl0X3Bob25lXSBGcmFtZXdvcmsuQ29tbWFuZHMuQWRkIG5vdCBhdmFpbGFibGU7IHJlc2V0ZGFpbHlzcGluIGNvbW1hbmQgbm90IHJlZ2lzdGVyZWQuXCIpO1xufVxuIiwgImltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbmNvbnN0IEpTT05fQ09MVU1OUyA9IG5ldyBTZXQoW1xuICAgICdtZXNzYWdlcycsICdwaG90b3MnLCAnaW50ZXJlc3RzJywgJ2ludGVyZXN0ZWRJbkdlbmRlcnMnLCAnbGlmZXN0eWxlJywgXG4gICAgJ3Byb21wdHMnLCAnZm9sbG93ZXJzJywgJ2ZvbGxvd2luZycsICdsaWtlQ291bnQnLCAncmVwbGllc0NvdW50JywgXG4gICAgJ3JldHdlZXRDb3VudCcsICdoYXNodGFncycsICdhdHRhY2htZW50cycsICdiYWNrZ3JvdW5kJywgJ2xvY2tzY3JlZW4nLCBcbiAgICAncmluZ3RvbmUnLCAnY29vcmRzJywgJ2NoYXJpbmZvJywgJ2pvYicsICdtZXRhZGF0YScsICdpdGVtcycsICdpbnZlbnRvcnknLCBcbiAgICAnZ3JhZGUnLCAnZGF0YScsICdibG9ja2VkTnVtYmVycycsICdkZWxldGVkTWVzc2FnZXMnXG5dKTtcblxuZXhwb3J0IGNsYXNzIE15U1FMQWRhcHRlciB7XG4gICAgY29uc3RydWN0b3IoKSB7fVxuXG4gICAgaXNEQkNvbm5lY3RlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7IC8vIG94bXlzcWwgaXMgdXN1YWxseSByZWFkeVxuICAgIH1cblxuICAgIC8vIEhlbHBlciB0byBwYXJzZSBwb3RlbnRpYWwgSlNPTiBmaWVsZHNcbiAgICBwcml2YXRlIHBhcnNlUm93KHJvdzogYW55KSB7XG4gICAgICAgIGlmICghcm93KSByZXR1cm4gcm93O1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiByb3cpIHtcbiAgICAgICAgICAgIGlmIChKU09OX0NPTFVNTlMuaGFzKGtleSkgJiYgdHlwZW9mIHJvd1trZXldID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHJvd1trZXldID0gSlNPTi5wYXJzZShyb3dba2V5XSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciBrZXkgJHtrZXl9OmAsIGUpO1xuICAgICAgICAgICAgICAgICAgICAvLyBLZWVwIG9yaWdpbmFsIHZhbHVlIGlmIHBhcnNlIGZhaWxzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByb3c7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0cmFuc2xhdGVRdWVyeShxdWVyeTogYW55KTogeyBzcWw6IHN0cmluZywgcGFyYW1zOiBhbnlbXSB9IHtcbiAgICAgICAgaWYgKCFxdWVyeSB8fCBPYmplY3Qua2V5cyhxdWVyeSkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzcWw6IFwiMT0xXCIsIHBhcmFtczogW10gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNvbmRpdGlvbnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IHBhcmFtczogYW55W10gPSBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBxdWVyeSkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBxdWVyeVtrZXldO1xuXG4gICAgICAgICAgICBpZiAoa2V5ID09PSAnJG9yJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9yQ29uZGl0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHN1YlF1ZXJ5IG9mIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3FsLCBwYXJhbXM6IHN1YlBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShzdWJRdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgIG9yQ29uZGl0aW9ucy5wdXNoKGAoJHtzcWx9KWApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCguLi5zdWJQYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYCgke29yQ29uZGl0aW9ucy5qb2luKCcgT1IgJyl9KWApO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoa2V5ID09PSAnJGFuZCcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhbmRDb25kaXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc3ViUXVlcnkgb2YgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzcWwsIHBhcmFtczogc3ViUGFyYW1zIH0gPSB0aGlzLnRyYW5zbGF0ZVF1ZXJ5KHN1YlF1ZXJ5KTtcbiAgICAgICAgICAgICAgICAgICAgYW5kQ29uZGl0aW9ucy5wdXNoKGAoJHtzcWx9KWApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCguLi5zdWJQYXJhbXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYCgke2FuZENvbmRpdGlvbnMuam9pbignIEFORCAnKX0pYCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gSGFuZGxlIE9wZXJhdG9yc1xuICAgICAgICAgICAgICAgIGlmICh2YWx1ZS4kbmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCA8PiA/YCk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKHZhbHVlLiRuZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kZ3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCA+ID9gKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUuJGd0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLiRndGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCA+PSA/YCk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKHZhbHVlLiRndGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuJGx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPCA/YCk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKHZhbHVlLiRsdCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kbHRlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPD0gP2ApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCh2YWx1ZS4kbHRlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLiRpbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZS4kaW4ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGAxPTBgKTsgLy8gSW4gZW1wdHkgYXJyYXkgaXMgYWx3YXlzIGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSB2YWx1ZS4kaW4ubWFwKCgpID0+ICc/Jykuam9pbignLCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgSU4gKCR7cGxhY2Vob2xkZXJzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKC4uLnZhbHVlLiRpbik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLiRuaW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlLiRuaW4ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGAxPTFgKTsgLy8gTm90IGluIGVtcHR5IGFycmF5IGlzIGFsd2F5cyB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSB2YWx1ZS4kbmluLm1hcCgoKSA9PiAnPycpLmpvaW4oJywnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgIE5PVCBJTiAoJHtwbGFjZWhvbGRlcnN9KWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2goLi4udmFsdWUuJG5pbik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLiRyZWdleCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgIExJS0UgP2ApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaChgJSR7dmFsdWUuJHJlZ2V4fSVgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgLy8gQXNzdW1lIGRpcmVjdCBlcXVhbGl0eSBmb3Igb2JqZWN0IGlmIG5vIGtub3duIG9wZXJhdG9yIChvciBoYW5kbGVkIGFzIEpTT04/KVxuICAgICAgICAgICAgICAgICAgICAgLy8gTW9uZ29EQiBkb2VzIGV4YWN0IG1hdGNoIG9uIG9iamVjdC4gTXlTUUwgY2FuJ3QgZWFzaWx5LiBcbiAgICAgICAgICAgICAgICAgICAgIC8vIEJ1dCBmb3Igbm93LCBsZXQncyB0cmVhdCBpdCBhcyBzdHJpbmcgb3IgaWdub3JlP1xuICAgICAgICAgICAgICAgICAgICAgLy8gSWYgaXQgaXMgYSBkYXRlIG9iamVjdD9cbiAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgID0gP2ApO1xuICAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPSA/YCk7XG4gICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgc3FsOiBjb25kaXRpb25zLmpvaW4oJyBBTkQgJyksIHBhcmFtcyB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgdHJhbnNsYXRlT3B0aW9ucyhvcHRpb25zOiBhbnkpOiBzdHJpbmcge1xuICAgICAgICBsZXQgc3FsID0gXCJcIjtcbiAgICAgICAgaWYgKCFvcHRpb25zKSByZXR1cm4gc3FsO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnNvcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IHNvcnRQYXJ0cyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gb3B0aW9ucy5zb3J0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlyID0gb3B0aW9ucy5zb3J0W2tleV0gPT09IDEgPyAnQVNDJyA6ICdERVNDJztcbiAgICAgICAgICAgICAgICBzb3J0UGFydHMucHVzaChgXFxgJHtrZXl9XFxgICR7ZGlyfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNvcnRQYXJ0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgc3FsICs9IGAgT1JERVIgQlkgJHtzb3J0UGFydHMuam9pbignLCAnKX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubGltaXQpIHtcbiAgICAgICAgICAgIHNxbCArPSBgIExJTUlUICR7TnVtYmVyKG9wdGlvbnMubGltaXQpfWA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5za2lwKSB7XG4gICAgICAgICAgICBzcWwgKz0gYCBPRkZTRVQgJHtOdW1iZXIob3B0aW9ucy5za2lwKX1gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNxbDtcbiAgICB9XG5cbiAgICBhc3luYyBmaW5kT25lKGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSwgcHJvamVjdGlvbj86IGFueSwgb3B0aW9ucz86IGFueSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIGNvbnN0IHNxbCA9IGBTRUxFQ1QgKiBGUk9NIFxcYCR7Y29sbGVjdGlvbn1cXGAgV0hFUkUgJHt3aGVyZUNsYXVzZX0gTElNSVQgMWA7XG4gICAgICAgIFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHMub3hteXNxbC5zaW5nbGVfYXN5bmMoc3FsLCBwYXJhbXMpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VSb3cocmVzdWx0KTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gZmluZE9uZSBlcnJvciBpbiAke2NvbGxlY3Rpb259OmAsIGUpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBmaW5kTWFueShjb2xsZWN0aW9uOiBzdHJpbmcsIHF1ZXJ5OiBhbnksIHByb2plY3Rpb24/OiBhbnksIHVua25vd24/OiBhbnksIG9wdGlvbnM/OiBhbnkpIHtcbiAgICAgICAgY29uc3QgeyBzcWw6IHdoZXJlQ2xhdXNlLCBwYXJhbXMgfSA9IHRoaXMudHJhbnNsYXRlUXVlcnkocXVlcnkpO1xuICAgICAgICBsZXQgc3FsID0gYFNFTEVDVCAqIEZST00gXFxgJHtjb2xsZWN0aW9ufVxcYCBXSEVSRSAke3doZXJlQ2xhdXNlfWA7XG4gICAgICAgIHNxbCArPSB0aGlzLnRyYW5zbGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBnbG9iYWwuZXhwb3J0cy5veG15c3FsLnF1ZXJ5X2FzeW5jKHNxbCwgcGFyYW1zKTtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHJlc3VsdHMpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHMubWFwKHJvdyA9PiB0aGlzLnBhcnNlUm93KHJvdykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBmaW5kTWFueSBlcnJvciBpbiAke2NvbGxlY3Rpb259OmAsIGUpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgaW5zZXJ0T25lKGNvbGxlY3Rpb246IHN0cmluZywgZG9jOiBhbnkpIHtcbiAgICAgICAgaWYgKCFkb2MpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAoIWRvYy5faWQpIGRvYy5faWQgPSBnZW5lcmF0ZVVVaWQoKTtcblxuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMoZG9jKTtcbiAgICAgICAgY29uc3QgdmFsdWVzID0gT2JqZWN0LnZhbHVlcyhkb2MpLm1hcCh2ID0+IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdiA9PT0gJ29iamVjdCcgJiYgdiAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB2O1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBwbGFjZWhvbGRlcnMgPSBrZXlzLm1hcCgoKSA9PiAnPycpLmpvaW4oJywnKTtcbiAgICAgICAgY29uc3QgY29sdW1ucyA9IGtleXMubWFwKGsgPT4gYFxcYCR7a31cXGBgKS5qb2luKCcsJyk7XG4gICAgICAgIGNvbnN0IHNxbCA9IGBJTlNFUlQgSU5UTyBcXGAke2NvbGxlY3Rpb259XFxgICgke2NvbHVtbnN9KSBWQUxVRVMgKCR7cGxhY2Vob2xkZXJzfSlgO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBnbG9iYWwuZXhwb3J0cy5veG15c3FsLmluc2VydF9hc3luYyhzcWwsIHZhbHVlcyk7XG4gICAgICAgICAgICByZXR1cm4gZG9jOyAvLyBNb25nb0RCIGluc2VydE9uZSByZXR1cm5zIHJlc3VsdCwgYnV0IGNvZGUgZXhwZWN0cyB0aGUgZG9jIG9mdGVuIG9yIGNoZWNrcyB0cnV0aGluZXNzXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBpbnNlcnRPbmUgZXJyb3IgaW4gJHtjb2xsZWN0aW9ufTpgLCBlKTtcbiAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHVwZGF0ZU9uZShjb2xsZWN0aW9uOiBzdHJpbmcsIHF1ZXJ5OiBhbnksIHVwZGF0ZTogYW55LCBvcHRpb25zPzogYW55KSB7XG4gICAgICAgIGNvbnN0IHsgc3FsOiB3aGVyZUNsYXVzZSwgcGFyYW1zOiB3aGVyZVBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIFxuICAgICAgICAvLyBIYW5kbGUgJHNldCwgJHB1c2gsIGV0Yz9cbiAgICAgICAgLy8gQ29kZSBtb3N0bHkgdXNlcyByZXBsYWNlbWVudCBvYmplY3Qgb3Igc2ltcGxlIHVwZGF0ZS5cbiAgICAgICAgLy8gSWYgJ3VwZGF0ZScgaGFzIHRvcCBsZXZlbCBrZXlzIHRoYXQgYXJlIG5vdCBvcGVyYXRvcnMsIGl0IG1pZ2h0IGJlIGEgcmVwbGFjZW1lbnQ/XG4gICAgICAgIC8vIE1vbmdvREIgdXBkYXRlT25lKGZpbHRlciwgdXBkYXRlLCBvcHRpb25zKVxuICAgICAgICAvLyBJZiB1cGRhdGUgY29udGFpbnMgYXRvbWljIG9wZXJhdG9ycyAoJHNldCksIGl0IHVwZGF0ZXMgZmllbGRzLlxuICAgICAgICAvLyBJZiBpdCBkb2Vzbid0LCBpdCBSRVBMQUNFUyB0aGUgZG9jdW1lbnQgKGluIHNvbWUgZHJpdmVyIHZlcnNpb25zKSBidXQgdXN1YWxseSB1cGRhdGVPbmUgcmVxdWlyZXMgJHNldCBpbiBtb2Rlcm4gbW9uZ28/IFxuICAgICAgICAvLyBDaGVja2luZyB0aGUgY29kZTogYGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBjb250YWN0RGF0YS5faWQgfSwgeyAuLi5jb250YWN0RGF0YSB9KTtgXG4gICAgICAgIC8vIFRoaXMgbG9va3MgbGlrZSBhIHJlcGxhY2VtZW50IG9yIG1lcmdlLlxuICAgICAgICAvLyBgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9LCBkYXRhWCk7YFxuICAgICAgICAvLyBgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciB9LCB7IGpvYkNhbGxzOiAhUGxheWVyRGF0YS5qb2JDYWxscyB9KTtgIC0+IFRoaXMgbG9va3MgbGlrZSBhIHBhcnRpYWwgdXBkYXRlIChtZXJnZSkuXG4gICAgICAgIC8vIFNpbmNlIEknbSB1c2luZyBTUUwsIGBVUERBVEUgdGFibGUgU0VUIC4uLmAgaXMgcGFydGlhbCB1cGRhdGUgYnkgZGVmYXVsdC5cbiAgICAgICAgXG4gICAgICAgIC8vIEJ1dCB3aGF0IGlmIHRoZXkgdXNlIGAkc2V0YD9cbiAgICAgICAgbGV0IHVwZGF0ZURhdGEgPSB1cGRhdGU7XG4gICAgICAgIGlmICh1cGRhdGUuJHNldCkge1xuICAgICAgICAgICAgdXBkYXRlRGF0YSA9IHsgLi4udXBkYXRlRGF0YSwgLi4udXBkYXRlLiRzZXQgfTtcbiAgICAgICAgICAgIGRlbGV0ZSB1cGRhdGVEYXRhLiRzZXQ7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFdoYXQgaWYgdGhleSB1c2UgYCRwdXNoYD9cbiAgICAgICAgLy8gYHR3ZWV0Lmxpa2VDb3VudC5wdXNoKGVtYWlsKTsgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoLi4uLCB0d2VldCk7YFxuICAgICAgICAvLyBUaGUgY29kZSB1c3VhbGx5IG1vZGlmaWVzIHRoZSBvYmplY3QgaW4gbWVtb3J5IGFuZCB0aGVuIHNhdmVzIHRoZSB3aG9sZSBvYmplY3QgYmFjayFcbiAgICAgICAgLy8gRXhhbXBsZSBpbiBQaWdlb25TZXJ2aWNlOiBgdHdlZXQubGlrZUNvdW50LnB1c2goZW1haWwpOyBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO2BcbiAgICAgICAgLy8gU28gdGhleSBhcmUgc2VuZGluZyB0aGUgRlVMTCBPQkpFQ1QgYXMgYHVwZGF0ZWAuXG4gICAgICAgIC8vIFNvIEkgY2FuIGp1c3QgdXBkYXRlIGFsbCBmaWVsZHMgcHJlc2VudCBpbiBgdXBkYXRlYC5cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IHNldENsYXVzZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IHNldFBhcmFtczogYW55W10gPSBbXTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHVwZGF0ZURhdGEpIHtcbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdfaWQnKSBjb250aW51ZTsgLy8gRG9uJ3QgdXBkYXRlIFBLIHVzdWFsbHlcbiAgICAgICAgICAgIHNldENsYXVzZXMucHVzaChgXFxgJHtrZXl9XFxgID0gP2ApO1xuICAgICAgICAgICAgbGV0IHZhbCA9IHVwZGF0ZURhdGFba2V5XTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnb2JqZWN0JyAmJiB2YWwgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB2YWwgPSBKU09OLnN0cmluZ2lmeSh2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2V0UGFyYW1zLnB1c2godmFsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzZXRDbGF1c2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgY29uc3Qgc3FsID0gYFVQREFURSBcXGAke2NvbGxlY3Rpb259XFxgIFNFVCAke3NldENsYXVzZXMuam9pbignLCAnKX0gV0hFUkUgJHt3aGVyZUNsYXVzZX1gO1xuICAgICAgICBjb25zdCBmaW5hbFBhcmFtcyA9IFsuLi5zZXRQYXJhbXMsIC4uLndoZXJlUGFyYW1zXTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZ2xvYmFsLmV4cG9ydHMub3hteXNxbC51cGRhdGVfYXN5bmMoc3FsLCBmaW5hbFBhcmFtcyk7XG4gICAgICAgICAgICByZXR1cm4geyBtb2RpZmllZENvdW50OiAxIH07XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNeVNRTEFkYXB0ZXJdIHVwZGF0ZU9uZSBlcnJvciBpbiAke2NvbGxlY3Rpb259OmAsIGUpO1xuICAgICAgICAgICAgcmV0dXJuIHsgbW9kaWZpZWRDb3VudDogMCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZGVsZXRlT25lKGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIGNvbnN0IHNxbCA9IGBERUxFVEUgRlJPTSBcXGAke2NvbGxlY3Rpb259XFxgIFdIRVJFICR7d2hlcmVDbGF1c2V9IExJTUlUIDFgO1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwudXBkYXRlX2FzeW5jKHNxbCwgcGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiB7IGRlbGV0ZWRDb3VudDogMSB9O1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBkZWxldGVPbmUgZXJyb3IgaW4gJHtjb2xsZWN0aW9ufTpgLCBlKTtcbiAgICAgICAgICAgIHJldHVybiB7IGRlbGV0ZWRDb3VudDogMCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZmluZEFuZFJldHVyblNwZWNpZmljRmllbGRzKGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSwgZmllbGRzOiBzdHJpbmdbXSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIGNvbnN0IGNvbHVtbnMgPSBmaWVsZHMubWFwKGYgPT4gYFxcYCR7Zn1cXGBgKS5qb2luKCcsICcpO1xuICAgICAgICBjb25zdCBzcWwgPSBgU0VMRUNUICR7Y29sdW1uc30gRlJPTSBcXGAke2NvbGxlY3Rpb259XFxgIFdIRVJFICR7d2hlcmVDbGF1c2V9IExJTUlUIDFgO1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwuc2luZ2xlX2FzeW5jKHNxbCwgcGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlUm93KHJlc3VsdCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBmaW5kQW5kUmV0dXJuU3BlY2lmaWNGaWVsZHMgZXJyb3IgaW4gJHtjb2xsZWN0aW9ufTpgLCBlKTtcbiAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICAvLyBDdXN0b20gaGFuZGxpbmcgZm9yIGFnZ3JlZ2F0aW9uIChzcGVjaWZpY2FsbHkgZm9yIFBpZ2VvbiBjb252ZXJzYXRpb25zKVxuICAgIGFzeW5jIGFnZ3JlZ2F0ZShjb2xsZWN0aW9uOiBzdHJpbmcsIHBpcGVsaW5lOiBhbnlbXSkge1xuICAgICAgICBpZiAoY29sbGVjdGlvbiA9PT0gJ3Bob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzJykge1xuICAgICAgICAgICAgLy8gVGhpcyBpcyBsaWtlbHkgdGhlIGdldENvbnZlcnNhdGlvbnMgY2FsbFxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBmZXRjaCBhbGwgbWVzc2FnZXMgZm9yIHRoZSB1c2VyLCBncm91cCBieSBjb252ZXJzYXRpb24gcGFydG5lciwgZmluZCBsYXRlc3QuXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEV4dHJhY3QgdXNlckVtYWlsIGZyb20gdGhlIGZpcnN0ICRtYXRjaCBzdGFnZVxuICAgICAgICAgICAgY29uc3QgbWF0Y2hTdGFnZSA9IHBpcGVsaW5lLmZpbmQocyA9PiBzLiRtYXRjaCk7XG4gICAgICAgICAgICBsZXQgdXNlckVtYWlsID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChtYXRjaFN0YWdlKSB7XG4gICAgICAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBlbWFpbC4gSXQncyB1c3VhbGx5IGluICRvcjogW3tzZW5kZXJFbWFpbDogWH0sIHtyZWNpcGllbnRFbWFpbDogWH1dXG4gICAgICAgICAgICAgICAgIGNvbnN0IG9yID0gbWF0Y2hTdGFnZS4kbWF0Y2guJG9yO1xuICAgICAgICAgICAgICAgICBpZiAob3IgJiYgb3JbMF0gJiYgb3JbMF0uc2VuZGVyRW1haWwpIHVzZXJFbWFpbCA9IG9yWzBdLnNlbmRlckVtYWlsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXVzZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbTXlTUUxBZGFwdGVyXSBBZ2dyZWdhdGU6IENvdWxkIG5vdCBpZGVudGlmeSB1c2VyRW1haWwgZnJvbSBwaXBlbGluZVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNRTCBTdHJhdGVneTpcbiAgICAgICAgICAgIC8vIDEuIEdldCBhbGwgbWVzc2FnZXMgd2hlcmUgc2VuZGVyIG9yIHJlY2lwaWVudCBpcyB1c2VyRW1haWxcbiAgICAgICAgICAgIC8vIDIuIFNvcnQgYnkgZGF0ZSBERVNDXG4gICAgICAgICAgICAvLyAzLiBQcm9jZXNzIGluIEpTIHRvIEdyb3VwXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHNxbCA9IGBTRUxFQ1QgKiBGUk9NIFxcYHBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXFxgIFdIRVJFIFxcYHNlbmRlckVtYWlsXFxgID0gPyBPUiBcXGByZWNpcGllbnRFbWFpbFxcYCA9ID8gT1JERVIgQlkgXFxgY3JlYXRlZEF0XFxgIERFU0NgO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlcyA9IGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwucXVlcnlfYXN5bmMoc3FsLCBbdXNlckVtYWlsLCB1c2VyRW1haWxdKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25zID0gbmV3IE1hcCgpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbXNnIG9mIG1lc3NhZ2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG90aGVyRW1haWwgPSBtc2cuc2VuZGVyRW1haWwgPT09IHVzZXJFbWFpbCA/IG1zZy5yZWNpcGllbnRFbWFpbCA6IG1zZy5zZW5kZXJFbWFpbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjb252ZXJzYXRpb25zLmhhcyhvdGhlckVtYWlsKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udmVyc2F0aW9ucy5zZXQob3RoZXJFbWFpbCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlOiB0aGlzLnBhcnNlUm93KG1zZyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXJFbWFpbDogb3RoZXJFbWFpbFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnYgPSBjb252ZXJzYXRpb25zLmdldChvdGhlckVtYWlsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1zZy5yZWNpcGllbnRFbWFpbCA9PT0gdXNlckVtYWlsICYmIG1zZy5yZWFkID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb252LnVucmVhZENvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gTm93IHdlIG5lZWQgdG8gZmV0Y2ggdXNlciBpbmZvIGZvciBlYWNoIGNvbnZlcnNhdGlvblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY29udiBvZiBjb252ZXJzYXRpb25zLnZhbHVlcygpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCB0aGlzLmZpbmRPbmUoJ3Bob25lX3BpZ2Vvbl91c2VycycsIHsgZW1haWw6IGNvbnYub3RoZXJFbWFpbCB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXJVc2VyOiB1c2VyLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IGNvbnYubGFzdE1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnJlYWRDb3VudDogY29udi51bnJlYWRDb3VudFxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBBZ2dyZWdhdGUgZXJyb3I6YCwgZSk7XG4gICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgY29uc29sZS53YXJuKGBbTXlTUUxBZGFwdGVyXSBVbmhhbmRsZWQgYWdncmVnYXRpb24gZm9yIGNvbGxlY3Rpb24gJHtjb2xsZWN0aW9ufWApO1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxufVxuIiwgImltcG9ydCBcIi4vc3ZfZXhwb3J0c1wiO1xuaW1wb3J0IFwiLi9hcHBzL2luZGV4XCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCIuL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4vYXBwcy9TZXR0aW5ncy9jbGFzc1wiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCwgTE9HR0VSIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBJbnZvaWNlUmVjdXJyaW5nUGF5bWVudHMgfSBmcm9tIFwiLi9hcHBzL1dhbGxldC9jYWxsYmFja3NcIjtcbmltcG9ydCB7IHBpZ2VvblNlcnZpY2UgfSBmcm9tIFwiLi9hcHBzL1BpZ2Vvbi9QaWdlb25TZXJ2aWNlXCI7XG5pbXBvcnQgeyBNeVNRTEFkYXB0ZXIgfSBmcm9tIFwiLi9jbGFzc2VzL015U1FMQWRhcHRlclwiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcbmNvbnN0IHJlc29sdmVGcmFtZXdvcmsgPSAoKSA9PiB7XG4gICAgY29uc3QgY29uZmlndXJlZCA9IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXTtcbiAgICBpZiAodHlwZW9mIGNvbmZpZ3VyZWQ/LkdldENvcmVPYmplY3QgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGNvbmZpZ3VyZWQuR2V0Q29yZU9iamVjdCgpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaCB0byByZXR1cm4gY29uZmlndXJlZCBkaXJlY3RseVxuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChjb25maWd1cmVkKSByZXR1cm4gY29uZmlndXJlZDtcblxuICAgIGNvbnN0IHFiID0gZXhwb3J0c1sncWItY29yZSddPy5HZXRDb3JlT2JqZWN0Py4oKTtcbiAgICBpZiAocWIpIHJldHVybiBxYjtcbiAgICBpZiAoZXhwb3J0c1sncWItY29yZSddKSByZXR1cm4gZXhwb3J0c1sncWItY29yZSddO1xuXG4gICAgY29uc3QgcWJ4ID0gZXhwb3J0c1sncWJ4LWNvcmUnXSA/PyBleHBvcnRzWydxYnhfY29yZSddO1xuICAgIGlmICh0eXBlb2YgcWJ4Py5HZXRDb3JlT2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBxYnguR2V0Q29yZU9iamVjdCgpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaCB0byByZXR1cm4gcWJ4IGRpcmVjdGx5XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHFieDtcbn07XG5cbmV4cG9ydCBsZXQgRnJhbWV3b3JrID0gcmVzb2x2ZUZyYW1ld29yaygpO1xuXG5leHBvcnQgY29uc3QgTW9uZ29EQiA9IG5ldyBNeVNRTEFkYXB0ZXIoKTtcblxuZXhwb3J0IGNvbnN0IE15U1FMID0gZXhwb3J0cy5veG15c3FsO1xuZXhwb3J0IGNvbnN0IExvZ2dlciA9IGV4cG9ydHNbJ3FiLXNtYWxscmVzb3VyY2VzJ107XG5cbnR5cGUgRXh0ZXJuYWxNYWlsRGF0YSA9IHtcbiAgICBlbWFpbD86IHN0cmluZztcbiAgICBzdWJqZWN0Pzogc3RyaW5nO1xuICAgIG1lc3NhZ2U/OiBzdHJpbmc7XG4gICAgaW1hZ2VzPzogc3RyaW5nW107XG59O1xuXG5vbignUUJDb3JlOlNlcnZlcjpVcGRhdGVPYmplY3QnLCAoKSA9PiB7XG4gICAgRnJhbWV3b3JrID0gcmVzb2x2ZUZyYW1ld29yaygpO1xufSk7XG5cbnNldEltbWVkaWF0ZSgoKSA9PiB7XG4gICAgVXRpbHMubG9hZCgpO1xuICAgIFNldHRpbmdzLmxvYWQoKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZTpzZXJ2ZXI6c2hhcmVOdW1iZXInLCBhc3luYyAoc291cmNlOiBhbnksIGNvbWluZ1NvdXJjZTogYW55KSA9PiB7XG4gICAgY29uc3Qgc291cmNlWCA9IHNvdXJjZTtcbiAgICBjb25zdCBzb3VyY2VOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZVgpO1xuICAgIGNvbnN0IGFjTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShjb21pbmdTb3VyY2UpO1xuICAgIGNvbnN0IGZ1bGxuYW1lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlWCk7XG4gICAgY29uc3QgYnJlYWtlZE5hbWUgPSBmdWxsbmFtZS5zcGxpdCgnICcpO1xuXG4gICAgaWYgKCFzb3VyY2VOdW1iZXIgfHwgIWFjTnVtYmVyKSByZXR1cm47XG4gICAgY29uc3QgY29udGFjdERhdGEgPSB7XG4gICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHBlcnNvbmFsTnVtYmVyOiBhY051bWJlcixcbiAgICAgICAgY29udGFjdE51bWJlcjogc291cmNlTnVtYmVyLFxuICAgICAgICBmaXJzdE5hbWU6IGJyZWFrZWROYW1lWzBdLFxuICAgICAgICBsYXN0TmFtZTogYnJlYWtlZE5hbWVbMV0sXG4gICAgICAgIGltYWdlOiBhd2FpdCBVdGlscy5HZXRDb250YWN0QXZhdGFyQnlOdW1iZXIoc291cmNlTnVtYmVyLCBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHNvdXJjZU51bWJlcikpLFxuICAgICAgICBvd25lcklkOiBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGFjTnVtYmVyKSxcbiAgICAgICAgbm90ZXM6IFwiXCIsXG4gICAgICAgIGVtYWlsOiBcIlwiLFxuICAgICAgICBpc0ZhdjogZmFsc2VcbiAgICB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgcGVyc29uYWxOdW1iZXI6IGFjTnVtYmVyLCBjb250YWN0TnVtYmVyOiBzb3VyY2VOdW1iZXIgfSk7XG4gICAgaWYgKHJlcykge1xuICAgICAgICByZXR1cm4gZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2VYLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgTnVtYmVyIEFscmVhZHkgU2hhcmVkLmAsXG4gICAgICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBOdW1iZXIoc291cmNlWCksIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJQaG9uZVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIHNoYXJlZCB5b3VyIFBob25lIE51bWJlci5gLFxuICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICB9KSk7XG4gICAgY29uc3Qgc2VuZElkID0gZ2VuZXJhdGVVVWlkKCk7XG4gICAgZW1pdE5ldCgncGhvbmU6YWRkQWN0aW9uTm90aWZpY2F0aW9uJywgTnVtYmVyKGNvbWluZ1NvdXJjZSksIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IHNlbmRJZCxcbiAgICAgICAgdGl0bGU6IFwiUGhvbmVcIixcbiAgICAgICAgZGVzY3JpcHRpb246IGAke2Z1bGxuYW1lfSB3YW50cyB0byBzaGFyZSB0aGVpciBudW1iZXIgd2l0aCB5b3UuYCxcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIGljb25zOiB7XG4gICAgICAgICAgICBcIjBcIjoge1xuICAgICAgICAgICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvY3Jvc3MtY2lyY2xlLnN2Z1wiLFxuICAgICAgICAgICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphZGRDb250YWN0XCIsXG4gICAgICAgICAgICAgICAgYXJnczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcIjFcIjoge1xuICAgICAgICAgICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvYWNjZXB0LnN2Z1wiLFxuICAgICAgICAgICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphZGRDb250YWN0XCIsXG4gICAgICAgICAgICAgICAgYXJnczoge1xuICAgICAgICAgICAgICAgICAgICBjb250YWN0RGF0YSxcbiAgICAgICAgICAgICAgICAgICAgY29taW5nU291cmNlLFxuICAgICAgICAgICAgICAgICAgICBmdWxsbmFtZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KSk7XG5cbn0pO1xuXG5vbk5ldCgncGhvbmU6c2VydmVyOmFkZENvbnRhY3QnLCBhc3luYyAoaWQ6IHN0cmluZywgZGF0YToge1xuICAgIGNvbWluZ1NvdXJjZTogYW55LFxuICAgIGZ1bGxuYW1lOiBzdHJpbmcsXG4gICAgY29udGFjdERhdGE6IGFueSxcbiAgICBpZDogc3RyaW5nXG59KSA9PiB7XG4gICAgY29uc3Qgc3JjID0gZ2xvYmFsLnNvdXJjZTtcbiAgICAvKiBjb25zb2xlLmxvZygnQWRkaW5nIGNvbnRhY3QnLCBpZCwgZGF0YSk7ICovXG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgc3JjLCBpZCk7XG4gICAgaWYgKCFkYXRhLmNvbnRhY3REYXRhIHx8ICFkYXRhLmNvbWluZ1NvdXJjZSB8fCAhZGF0YS5mdWxsbmFtZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGF3YWl0IERlbGF5KDUwMCk7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzcmMsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgZGVzY3JpcHRpb246IGBOdW1iZXIgU2F2ZWQuYCxcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgfSkpO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9jb250YWN0cycsIGRhdGEuY29udGFjdERhdGEpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICB0aXRsZTogJ0NvbnRhY3QgU2hhcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7ZGF0YS5mdWxsbmFtZX0gLCAke2RhdGEuY29udGFjdERhdGEuY29udGFjdE51bWJlcn0gaGFzIHNoYXJlZCB0aGVpciBudW1iZXIgd2l0aCAke2RhdGEuY29udGFjdERhdGEucGVyc29uYWxOdW1iZXJ9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uKCdzdW1taXRfcGhvbmU6c2VydmVyOkNyb25UcmlnZ2VyJywgYXN5bmMgKCkgPT4ge1xuICAgIC8qIGNvbnNvbGUubG9nKCdDcm9uIFRyaWdnZXJlZCcpOyAqL1xuICAgIEludm9pY2VSZWN1cnJpbmdQYXltZW50cygpO1xufSk7XG5cblJlZ2lzdGVyQ29tbWFuZCgncmVzZXRQaG9uZVBhc3Njb2RlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBhcmdzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuO1xuICAgIFNldHRpbmdzLmxvY2tQaW4uc2V0KGNpdGl6ZW5JZCwgJzAwMDAwMCcpO1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIFNldHRpbmdzLlNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIGVtaXROZXQoJ3Bob25lOmNsaWVudDpzZXR1cFBob25lJywgc291cmNlLCBjaXRpemVuSWQpO1xufSwgZmFsc2UpO1xuXG5SZWdpc3RlckNvbW1hbmQoJ3ZlcmlmeVBlZ2lvbicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICBpZiAoIWFyZ3NbMF0pIHtcbiAgICAgICAgcmV0dXJuIExPR0dFUignUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbCBhZGRyZXNzLicpO1xuICAgIH1cbiAgICBjb25zdCBlbWFpbCA9IGFyZ3NbMF07XG4gICAgY29uc3QgcmVzID0gYXdhaXQgcGlnZW9uU2VydmljZS52ZXJpZnlVc2VyKHNvdXJjZSwgZW1haWwpO1xuICAgIGlmIChyZXMgPT09IFwic3VjY2Vzc1wiKSB7XG4gICAgICAgIHJldHVybiBMT0dHRVIoYFVzZXIgJHtlbWFpbH0gaGFzIGJlZW4gdmVyaWZpZWQgc3VjY2Vzc2Z1bGx5LmApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBMT0dHRVIoYEZhaWxlZCB0byB2ZXJpZnkgdXNlciAke2VtYWlsfS4gUmVhc29uOiAke3Jlc31gKTtcbiAgICB9XG59LCB0cnVlKTtcblxub24oJ1FCQ29yZTpTZXJ2ZXI6T25QbGF5ZXJVbmxvYWQnLCBhc3luYyAoc3JjOiBudW1iZXIpID0+IHtcbiAgICBpZighc3JjKSByZXR1cm47XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNyYyk7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybjtcbiAgICBhd2FpdCBTZXR0aW5ncy5TYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBTZXR0aW5ncy5vblBsYXllckRpc2Nvbm5lY3QoY2l0aXplbklkKTtcbn0pO1xuXG5vbigncGxheWVyRHJvcHBlZCcsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzcmMgPSBnbG9iYWwuc291cmNlO1xuICAgIGlmKCFzcmMpIHJldHVybjtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc3JjKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuO1xuICAgIGF3YWl0IFNldHRpbmdzLlNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIFNldHRpbmdzLm9uUGxheWVyRGlzY29ubmVjdChjaXRpemVuSWQpO1xufSlcblxub25OZXQoJ2lnbmlzX3Bob25lOnNlbmROZXdNYWlsJywgYXN5bmMgKHRhcmdldFNvdXJjZTogbnVtYmVyLCBtYWlsRGF0YTogRXh0ZXJuYWxNYWlsRGF0YSkgPT4ge1xuICAgIGNvbnN0IHNyYyA9IE51bWJlcih0YXJnZXRTb3VyY2UgPz8gZ2xvYmFsLnNvdXJjZSk7XG4gICAgY29uc3QgcGxheWVyID0gRnJhbWV3b3JrLkZ1bmN0aW9ucy5HZXRQbGF5ZXIoc3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgY29uc3QgY2l0aXplbklkID0gcGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkO1xuICAgIGNvbnN0IGVtYWlsQWRkcmVzcyA9IGF3YWl0IFV0aWxzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIGlmICghZW1haWxBZGRyZXNzKSByZXR1cm47XG5cbiAgICBhd2FpdCBnbG9iYWwuZXhwb3J0c1snc3VtbWl0X3Bob25lJ10uU2VuZE1haWwoe1xuICAgICAgICBlbWFpbDogbWFpbERhdGE/LmVtYWlsIHx8ICdnb3Zlcm5tZW50QHN1bW1pdC5ycCcsXG4gICAgICAgIHRvOiBlbWFpbEFkZHJlc3MsXG4gICAgICAgIHN1YmplY3Q6IG1haWxEYXRhPy5zdWJqZWN0IHx8ICdFbWFpbCBpcyBub3Qgc2V0dXAgY29ycmVjdGx5IScsXG4gICAgICAgIG1lc3NhZ2U6IG1haWxEYXRhPy5tZXNzYWdlIHx8ICdFbWFpbCBpcyBub3Qgc2V0dXAgY29ycmVjdGx5IScsXG4gICAgICAgIGltYWdlczogbWFpbERhdGE/LmltYWdlcyB8fCBbXSxcbiAgICAgICAgc291cmNlOiBzcmNcbiAgICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7QUFBTyxTQUFTLE1BQU0sSUFBWTtBQUM5QixTQUFPLElBQUksUUFBUSxTQUFPLFdBQVcsS0FBSyxFQUFFLENBQUM7QUFDakQ7QUFGZ0I7QUFRVCxJQUFNLGVBQWUsNkJBQU07QUFDOUIsU0FBTyx1Q0FBdUMsUUFBUSxTQUFTLFNBQVUsR0FBRztBQUN4RSxRQUFJLElBQUksS0FBSyxPQUFPLElBQUksS0FBSyxHQUFHLElBQUksS0FBSyxNQUFNLElBQUksSUFBSSxJQUFNO0FBQzdELFdBQU8sRUFBRSxTQUFTLEVBQUU7QUFBQSxFQUN4QixDQUFDO0FBQ0wsR0FMNEI7QUFPckIsSUFBTSxTQUFTLHdCQUFD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O0FBQ2hCLFFBQU0sU0FBUyxtQkFBbUIsU0FBUztBQUMzQyxXQUFTLG1CQUFtQixTQUFTO0FBQ3pDLENBQUM7QUFFRCxNQUFNLDJCQUEyQixPQUFPLGNBQXNCLGFBQStCO0FBQ3pGLFFBQU0sTUFBTSxPQUFPLGdCQUFnQixPQUFPLE1BQU07QUFDaEQsUUFBTSxTQUFTLFVBQVUsVUFBVSxVQUFVLEdBQUc7QUFDaEQsTUFBSSxDQUFDLE9BQVE7QUFFYixRQUFNLFlBQVksT0FBTyxXQUFXO0FBQ3BDLFFBQU0sZUFBZSxNQUFNLE1BQU0sc0JBQXNCLFNBQVM7QUFDaEUsTUFBSSxDQUFDLGFBQWM7QUFFbkIsUUFBTSxPQUFPLFFBQVEsY0FBYyxFQUFFLFNBQVM7QUFBQSxJQUMxQyxRQUFPLHFDQUFVLFVBQVM7QUFBQSxJQUMxQixJQUFJO0FBQUEsSUFDSixVQUFTLHFDQUFVLFlBQVc7QUFBQSxJQUM5QixVQUFTLHFDQUFVLFlBQVc7QUFBQSxJQUM5QixTQUFRLHFDQUFVLFdBQVUsQ0FBQztBQUFBLElBQzdCLFFBQVE7QUFBQSxFQUNaLENBQUM7QUFDTCxDQUFDOyIsCiAgIm5hbWVzIjogWyJzb3VyY2UiLCAiX2EiLCAic291cmNlIiwgInNvdXJjZSIsICJfYSIsICJyZXMiLCAic291cmNlIiwgIl9hIiwgInNvdXJjZSIsICJfYSIsICJzb3VyY2UiLCAiX2EiLCAic291cmNlIiwgInNvdXJjZSIsICJkYXRhIiwgInNvdXJjZSIsICJzb3VyY2UiLCAicmV0d2VldCIsICJzb3VyY2UiLCAic291cmNlIiwgInNvdXJjZSIsICJfYSIsICJpc1JlY3VycmluZyIsICJzb3VyY2UiLCAic291cmNlIiwgInNvdXJjZSIsICJfYSIsICJzb3VyY2UiLCAicmVzb2x2ZUZyYW1ld29yayIsICJfYSIsICJzb3VyY2UiXQp9Cg==
