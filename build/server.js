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
var INVENTORY_RESOURCE = "ox_inventory";

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

// node_modules/@overextended/ox_lib/shared/resource/cache/index.js
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

// node_modules/@overextended/ox_lib/server/resource/callback/index.js
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2FtZS9zaGFyZWQvdXRpbHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvY2xhc3Nlcy9VdGlscy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL01haWwvY2xhc3MudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvc3ZfZXhwb3J0cy50cyIsICIuLi9ub2RlX21vZHVsZXMvQG92ZXJleHRlbmRlZC9veF9saWIvc2hhcmVkL3Jlc291cmNlL2NhY2hlL2luZGV4LmpzIiwgIi4uL25vZGVfbW9kdWxlcy9Ab3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXIvcmVzb3VyY2UvY2FsbGJhY2svaW5kZXguanMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9Db250YWN0cy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0RhcmtDaGF0L2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvTWFpbC9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL01lc3NhZ2VzL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvY2FsbEhpc3RvcnlNYW5hZ2VyLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvQ2FsbE1hbmFnZXIudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXR0aW5ncy9jbGFzcy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1Bob25lL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvZXZlbnRzLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvdG9zL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvU2VydmljZXMvY2FsbGJhY2sudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXJ2aWNlcy9ldmVudHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXR0aW5ncy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1NldHRpbmdzL2V2ZW50cy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1BpZ2Vvbi9QaWdlb25TZXJ2aWNlLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGlnZW9uL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvSG9zdWluZy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0JsdWVQYWdlL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvR2FyYWdlL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvV2FsbGV0L2NhbGxiYWNrcy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0dyb3Vwcy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0hlYXJ0U3luYy9jYWxsYmFja3MudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9DcnlwdG8vY2FsbGJhY2tzLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvRGFpbHlTcGlucy9ldmVudHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvY2xhc3Nlcy9NeVNRTEFkYXB0ZXIudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvc3ZfbWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGZ1bmN0aW9uIERlbGF5KG1zOiBudW1iZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzID0+IHNldFRpbWVvdXQocmVzLCBtcykpO1xufTtcblxuZXhwb3J0IGNvbnN0IGRpc3RhbmNlQmV0d2VlbiA9IChwb3MxOiBudW1iZXJbXSwgcG9zMjogbnVtYmVyW10pID0+IHtcbiAgICByZXR1cm4gTWF0aC5oeXBvdChwb3MxWzBdIC0gcG9zMlswXSwgcG9zMVsxXSAtIHBvczJbMV0sIHBvczFbMl0gLSBwb3MyWzJdKVxufTtcblxuZXhwb3J0IGNvbnN0IGdlbmVyYXRlVVVpZCA9ICgpID0+IHtcbiAgICByZXR1cm4gXCJ4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHhcIi5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgIHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gXCJ4XCIgPyByIDogciAmIDB4MyB8IDB4ODtcbiAgICAgICAgcmV0dXJuIHYudG9TdHJpbmcoMTYpO1xuICAgIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IExPR0dFUiA9IChtZXNzYWdlOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gY29uc29sZS5sb2coYFxceDFiWzFtXFx4MWJbNDdtXFx4MWJbMzRtW1N1bW1pdF9QaG9uZV0gXFx4MWJbNG1cXHgxYlszMW0ke21lc3NhZ2V9XFx4MWJbMG1gKVxufVxuXG5leHBvcnQgdHlwZSBGcmFtZXdvcmtUeXBlID0gJ3FiLWNvcmUnIHwgJ3FieF9jb3JlJztcbmV4cG9ydCBjb25zdCBGUkFNRVdPUktfUkVTT1VSQ0U6IEZyYW1ld29ya1R5cGUgPSAncWItY29yZSc7IC8vIENoYW5nZSB0aGlzIHRvIHlvdXIgZnJhbWV3b3JrIGNvcmUgcWItY29yZS9xYnhfY29yZVxuZXhwb3J0IHR5cGUgSW52ZW50b3J5VHlwZSA9ICdsai1pbnZlbnRvcnknIHwgJ294X2ludmVudG9yeScgfCAncWItaW52ZW50b3J5JztcbmV4cG9ydCBjb25zdCBJTlZFTlRPUllfUkVTT1VSQ0U6IEludmVudG9yeVR5cGUgPSAnb3hfaW52ZW50b3J5JzsgLy8gQ2hhbmdlIHRoaXMgdG8geW91ciBpbnZlbnRvcnkgc3lzdGVtIG94X2ludmVudG9yeS9xYi1pbnZlbnRvcnkvbGotaW52ZW50b3J5IGV0Yy4uLlxuIiwgImltcG9ydCB7IEZyYW1ld29yaywgTW9uZ29EQiwgTXlTUUwgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UsIElOVkVOVE9SWV9SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmNsYXNzIFV0aWwge1xuICAgIHB1YmxpYyBjb250YWN0c0RhdGE6IGFueTtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5jb250YWN0c0RhdGEgPSBbXTtcbiAgICB9XG5cbiAgICBhc3luYyBsb2FkKCkge1xuICAgICAgICBSZWdpc3RlckNvbW1hbmQoJ3RyYW5zZmVyTnVtYmVycycsIGFzeW5jIChzb3VyY2U6IGFueSwgYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoc291cmNlID09PSAwKSByZXR1cm4gTE9HR0VSKCdUaGlzIGNvbW1hbmQgY2FuIG9ubHkgYmUgZXhlY3V0ZWQgaW4tZ2FtZS4nKTtcbiAgICAgICAgICAgIGF3YWl0IFV0aWxzLlRyYW5zZmVyTnVtYmVycygpO1xuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICBSZWdpc3RlckNvbW1hbmQoJ3RyYW5zZmVyQ29udGFjdHMnLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5UcmFuc2ZlckNvbnRhY3RzKCk7XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIFJlZ2lzdGVyQ29tbWFuZCgnbWlncmF0ZU11bHRpSm9iRGF0YScsIGFzeW5jIChzb3VyY2U6IGFueSwgYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoc291cmNlID09PSAwKSByZXR1cm4gTE9HR0VSKCdUaGlzIGNvbW1hbmQgY2FuIG9ubHkgYmUgZXhlY3V0ZWQgaW4tZ2FtZS4nKTtcbiAgICAgICAgICAgIGF3YWl0IFV0aWxzLk1pZ3JhdGVNdWx0aUpvYkRhdGEoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCdtaWdyYXRlU29jaWV0eScsIGFzeW5jIChzb3VyY2U6IGFueSwgYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoc291cmNlID09PSAwKSByZXR1cm4gTE9HR0VSKCdUaGlzIGNvbW1hbmQgY2FuIG9ubHkgYmUgZXhlY3V0ZWQgaW4tZ2FtZS4nKTtcbiAgICAgICAgICAgIGF3YWl0IFV0aWxzLk1pZ3JhdGVTb2NpZXR5RGF0YSgpO1xuICAgICAgICB9LCB0cnVlKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgVHJhbnNmZXJOdW1iZXJzKCkge1xuICAgICAgICBsZXQgbmV3TnVtYmVyczogYW55W10gPSBbXTtcbiAgICAgICAgbGV0IG5ld1NldHRpbmdzOiBhbnlbXSA9IFtdO1xuICAgICAgICBsZXQgbmV3Q2FyZHM6IGFueVtdID0gW107XG5cbiAgICAgICAgTXlTUUwucXVlcnkoJ1NFTEVDVCBjaXRpemVuaWQsIGNoYXJpbmZvIEZST00gcGxheWVycycsIFtdLCBhc3luYyAocmVzdWx0OiBhbnlbXSkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3duZXIgPSByb3cuY2l0aXplbmlkO1xuICAgICAgICAgICAgICAgICAgICBsZXQgY2hhcmluZm8gPSByb3cuY2hhcmluZm87XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcGFyc2UgaWYgc3RvcmVkIGFzIEpTT04gc3RyaW5nXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2hhcmluZm8gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJpbmZvID0gSlNPTi5wYXJzZShjaGFyaW5mbyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhcmluZm8gPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHByZWZlciBjaGFyaW5mby5waG9uZSwgZmFsbCBiYWNrIHRvIHBob25lX251bWJlclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBudW1iZXIgPSAoY2hhcmluZm8gJiYgKGNoYXJpbmZvLnBob25lID8/IGNoYXJpbmZvLnBob25lX251bWJlcikpIHx8IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGlmICghbnVtYmVyKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBza2lwIGlmIHBob25lIG51bWJlciBhbHJlYWR5IGV4aXN0cyBmb3IgdGhpcyBvd25lclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbnVtYmVycycsIHsgb3duZXIgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChleGlzdGluZykgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgbmV3TnVtYmVycy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBvd25lcixcbiAgICAgICAgICAgICAgICAgICAgICAgIG51bWJlclxuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBwcmVwYXJlIHBob25lX3NldHRpbmdzIGlmIG5vdCBwcmVzZW50XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nU2V0dGluZ3MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IG93bmVyIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWV4aXN0aW5nU2V0dGluZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld1NldHRpbmdzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2Nrc2NyZWVuOiB7IGN1cnJlbnQ6ICcnLCB3YWxscGFwZXJzOiBbXSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJpbmd0b25lOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQ6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmluZ3RvbmVzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2RlZmF1bHQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hvd05vdGlmaWNhdGlvbnM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNMb2NrOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2tQaW46ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZVBpbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZUZhY2VJZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwaWdlb25JZEF0dGFjaGVkOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbXJ0SWQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNtcnRQYXNzd29yZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNGbGlnaHRNb2RlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJlcGFyZSBwaG9uZV9wbGF5ZXJfY2FyZCBpZiBub3QgcHJlc2VudFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ0NhcmQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3BsYXllcl9jYXJkJywgeyBfaWQ6IG93bmVyIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWV4aXN0aW5nQ2FyZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3Q2FyZHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBvd25lcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaXJzdE5hbWU6ICdTZXR1cCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdE5hbWU6ICdDYXJkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtYWlsOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3RlczogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXZhdGFyOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG5ld051bWJlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE1hbnkoJ3Bob25lX251bWJlcnMnLCBuZXdOdW1iZXJzKTtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBJbnNlcnRlZCAke25ld051bWJlcnMubGVuZ3RofSBwaG9uZV9udW1iZXJzLmApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUignTm8gbmV3IHBob25lX251bWJlcnMgdG8gaW5zZXJ0LicpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChuZXdTZXR0aW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0TWFueSgncGhvbmVfc2V0dGluZ3MnLCBuZXdTZXR0aW5ncyk7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUihgSW5zZXJ0ZWQgJHtuZXdTZXR0aW5ncy5sZW5ndGh9IHBob25lX3NldHRpbmdzLmApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUignTm8gbmV3IHBob25lX3NldHRpbmdzIHRvIGluc2VydC4nKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3Q2FyZHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE1hbnkoJ3Bob25lX3BsYXllcl9jYXJkJywgbmV3Q2FyZHMpO1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3Q2FyZHMubGVuZ3RofSBwaG9uZV9wbGF5ZXJfY2FyZCBlbnRyaWVzLmApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUignTm8gbmV3IHBob25lX3BsYXllcl9jYXJkIGVudHJpZXMgdG8gaW5zZXJ0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIExPR0dFUihgVHJhbnNmZXJOdW1iZXJzIGVycm9yOiAke2Vycn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIGFzeW5jIFRyYW5zZmVyQ29udGFjdHMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IHRoaXMucXVlcnkoJ1NFTEVDVCAqIEZST00gcGhvbmVfcGhvbmVfY29udGFjdHMnLCBbXSk7XG5cbiAgICAgICAgICAgIGlmICghcmVzdWx0IHx8IHJlc3VsdC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIGNvbnRhY3RzIGZvdW5kIHRvIHRyYW5zZmVyLicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgW2luZGV4LCBjb250YWN0XSBvZiByZXN1bHQuZW50cmllcygpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID4gcmVzdWx0Lmxlbmd0aCkgYnJlYWs7XG4gICAgICAgICAgICAgICAgLyogY29uc29sZS5sb2coYFByb2Nlc3NpbmcgY29udGFjdCAke2luZGV4ICsgMX0gb2YgJHtyZXN1bHQubGVuZ3RofWApOyAqL1xuICAgICAgICAgICAgICAgIGNvbnN0IG93bmVySWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIoY29udGFjdC5waG9uZV9udW1iZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMuY29udGFjdHNEYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICBwZXJzb25hbE51bWJlcjogY29udGFjdC5waG9uZV9udW1iZXIsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRhY3ROdW1iZXI6IGNvbnRhY3QuY29udGFjdF9waG9uZV9udW1iZXIsXG4gICAgICAgICAgICAgICAgICAgIGZpcnN0TmFtZTogY29udGFjdC5maXJzdG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGxhc3ROYW1lOiBjb250YWN0Lmxhc3RuYW1lLFxuICAgICAgICAgICAgICAgICAgICBpbWFnZTogY29udGFjdC5wcm9maWxlX2ltYWdlLFxuICAgICAgICAgICAgICAgICAgICBvd25lcklkOiBvd25lcklkLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9jb250YWN0cycsIHRoaXMuY29udGFjdHNEYXRhKTtcbiAgICAgICAgICAgIExPR0dFUignUGhvbmUgY29udGFjdHMgaGF2ZSBiZWVuIHRyYW5zZmVycmVkIHRvIE1vbmdvREIuJyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIExPR0dFUihgRXJyb3Igd2hpbGUgdHJhbnNmZXJyaW5nIGNvbnRhY3RzOiAke0pTT04uc3RyaW5naWZ5KGUsIG51bGwsIDIpfWApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGFzeW5jIE1pZ3JhdGVNdWx0aUpvYkRhdGEoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IHRoaXMucXVlcnkoJ1NFTEVDVCBpZCwgam9ibmFtZSwgZW1wbG95ZWVzIEZST00gcGxheWVyX2pvYnMnLCBbXSk7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdCB8fCByZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgTE9HR0VSKCdObyBtdWx0aWpvYnMgZm91bmQgdG8gdHJhbnNmZXIuJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBuZXdEYXRhOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBqb2JJZCA9IHJvdy5pZDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgam9iTmFtZSA9IHJvdy5qb2JuYW1lO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWpvYk5hbWUpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBlbXBsb3llZXMgPSByb3cuZW1wbG95ZWVzO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWVtcGxveWVlcykgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBlbXBsb3llZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtcGxveWVlcyA9IEpTT04ucGFyc2UoZW1wbG95ZWVzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIExPR0dFUihgRmFpbGVkIHRvIHBhcnNlIGVtcGxveWVlcyBKU09OIGZvciBqb2IgJHtqb2JOYW1lfSAoaWQ6ICR7am9iSWR9KTogJHtlcnJ9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoIWVtcGxveWVlcyB8fCB0eXBlb2YgZW1wbG95ZWVzICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KGVtcGxveWVlcykpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW2tleSwgZW1wXSBvZiBPYmplY3QuZW50cmllcyhlbXBsb3llZXMpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjaWQgPSAoZW1wICYmIChlbXAuY2lkIHx8IGVtcC5DSUQgfHwgZW1wLmNpdGl6ZW5JZCkpIHx8IGtleTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGdyYWRlTGV2ZWwgPSAoZW1wICYmIChlbXAuZ3JhZGUgPz8gZW1wLmdyYWRlTGV2ZWwgPz8gZW1wLnJhbmspKSA/PyAwO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBqb2JMYWJlbCA9IEZyYW1ld29yaz8uU2hhcmVkPy5Kb2JzPy5bam9iTmFtZV0/LmxhYmVsID8/IGpvYk5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBncmFkZUxhYmVsID0gRnJhbWV3b3JrPy5TaGFyZWQ/LkpvYnM/Lltqb2JOYW1lXT8uZ3JhZGVzPy5bZ3JhZGVMZXZlbF0/Lm5hbWUgPz8gJyc7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0RhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IGNpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBqb2JOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyYWRlTGV2ZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgam9iTGFiZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JhZGVMYWJlbFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChpbm5lckVycikge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEVycm9yIHByb2Nlc3NpbmcgcGxheWVyX2pvYnMgcm93IGlkICR7cm93LmlkfTogJHtpbm5lckVycn1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChuZXdEYXRhLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE1hbnkoJ3Bob25lX211bHRpam9icycsIG5ld0RhdGEpO1xuICAgICAgICAgICAgICAgIExPR0dFUihgSW5zZXJ0ZWQgJHtuZXdEYXRhLmxlbmd0aH0gbXVsdGlqb2IgZW50cmllcyB0byBwaG9uZV9tdWx0aWpvYnMuYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIExPR0dFUignTm8gbXVsdGlqb2IgZW50cmllcyBmb3VuZCB0byBpbnNlcnQgYWZ0ZXIgcGFyc2luZy4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBMT0dHRVIoYE1pZ3JhdGVNdWx0aUpvYkRhdGEgZXJyb3I6ICR7ZXJyfWApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGFzeW5jIE1pZ3JhdGVTb2NpZXR5RGF0YSgpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCB0aGlzLnF1ZXJ5KCdTRUxFQ1QgKiBGUk9NIGF2X3NvY2lldHknLCBbXSk7XG5cbiAgICAgICAgcmVzdWx0LmZvckVhY2goYXN5bmMgKGpvYjogYW55KSA9PiB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnc3VtbWl0X2JhbmsnLCB7IF9pZDogam9iLmpvYiB9LCB7XG4gICAgICAgICAgICAgICAgYmFua0JhbGFuY2U6IE51bWJlcihqb2IubW9uZXkpXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKVxuICAgICAgICB9KVxuICAgIH1cblxuICAgIGFzeW5jIEdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9udW1iZXJzJywgeyBvd25lcjogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAoIW51bWJlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gbnVtYmVyLm51bWJlcjtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IF9pZDogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAoIW51bWJlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gbnVtYmVyLnNtcnRJZDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0RW1haWxJZEJ5U291cmNlKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBlbWFpbCA9IGF3YWl0IHRoaXMuR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgICAgIHJldHVybiBlbWFpbDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbnVtYmVycycsIHsgbnVtYmVyOiBwaG9uZU51bWJlciB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5vd25lcjtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0UGxheWVyRnJvbVBob25lTnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgfTtcblxuICAgIGFzeW5jIEJsb2NrTnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcsIHRhcmdldFBob25lTnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHRhcmdldFBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKCFjaXRpemVuSWQgfHwgIXRhcmdldENpdGl6ZW5JZCkgcmV0dXJuO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmxvY2tlZF9udW1iZXJzJywge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogY2l0aXplbklkLFxuICAgICAgICAgICAgdGFyZ2V0Q2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBVbmJsb2NrTnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcsIHRhcmdldFBob25lTnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHRhcmdldFBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKCFjaXRpemVuSWQgfHwgIXRhcmdldENpdGl6ZW5JZCkgcmV0dXJuO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfYmxvY2tlZF9udW1iZXJzJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCwgdGFyZ2V0Q2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQgfSk7XG4gICAgfTtcblxuICAgIGFzeW5jIElzTnVtYmVyQmxvY2tlZChwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmxvY2tlZF9udW1iZXJzJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCwgdGFyZ2V0Q2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQgfSk7XG4gICAgICAgIHJldHVybiBibG9ja2VkID8gdHJ1ZSA6IGZhbHNlO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDb250YWN0TmFtZUJ5TnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcsIGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNvbnRhY3QgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBjb250YWN0TnVtYmVyOiBwaG9uZU51bWJlciwgb3duZXJJZDogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAoIWNvbnRhY3QpIHJldHVybiBwaG9uZU51bWJlcjtcbiAgICAgICAgcmV0dXJuIGAke2NvbnRhY3QuZmlyc3ROYW1lfSAke2NvbnRhY3QubGFzdE5hbWV9YDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q29udGFjdEF2YXRhckJ5TnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcsIGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNvbnRhY3QgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBjb250YWN0TnVtYmVyOiBwaG9uZU51bWJlciwgb3duZXJJZDogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAoIWNvbnRhY3QpIHJldHVybiAnJztcbiAgICAgICAgcmV0dXJuIGNvbnRhY3QuaW1hZ2U7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFNvdXJjZUZyb21DaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3Qgc291cmNlID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgICAgIGlmICghc291cmNlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBzb3VyY2UuUGxheWVyRGF0YS5zb3VyY2U7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIEhhc1Bob25lKHBsYXllclNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIGNvbnN0IHBob25lTGlzdDogc3RyaW5nW10gPSBbXG4gICAgICAgICAgICAnYmx1ZV9waG9uZScsXG4gICAgICAgICAgICAnZ3JlZW5fcGhvbmUnLFxuICAgICAgICAgICAgJ3JlZF9waG9uZScsXG4gICAgICAgICAgICAnZ29sZF9waG9uZScsXG4gICAgICAgICAgICAncHVycGxlX3Bob25lJyxcbiAgICAgICAgXTtcblxuICAgICAgICBpZiAoSU5WRU5UT1JZX1JFU09VUkNFID09PSAnb3hfaW52ZW50b3J5Jykge1xuICAgICAgICAgICAgY29uc3QgaGFzSXRlbTogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IGV4cG9ydHNbJ294X2ludmVudG9yeSddLlNlYXJjaChcbiAgICAgICAgICAgICAgICBwbGF5ZXJTb3VyY2UsXG4gICAgICAgICAgICAgICAgJ2NvdW50JyxcbiAgICAgICAgICAgICAgICBwaG9uZUxpc3RcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcGhvbmUgb2YgcGhvbmVMaXN0KSB7XG4gICAgICAgICAgICAgICAgaWYgKGhhc0l0ZW1bcGhvbmVdID4gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwaG9uZUl0ZW0gb2YgcGhvbmVMaXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmUgLSBleHRlcm5hbCBpbnZlbnRvcnkgcmVzb3VyY2VcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzID0gYXdhaXQgZXhwb3J0c1tJTlZFTlRPUllfUkVTT1VSQ0VdLkhhc0l0ZW0ocGxheWVyU291cmNlLCBwaG9uZUl0ZW0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaGFzKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSGFzUGhvbmUgY2hlY2sgZmFpbGVkOicsIGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBJbkZsaWdodE1vZGUoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFzZXR0aW5ncykgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gc2V0dGluZ3MuaXNGbGlnaHRNb2RlIHx8IGZhbHNlO1xuICAgIH07XG5cbiAgICBhc3luYyBxdWVyeShxdWVyeTogc3RyaW5nLCB2YWx1ZXM6IGFueSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgTXlTUUwucXVlcnkocXVlcnksIHZhbHVlcywgKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBpc1NlbmRlcktub3duKHNlbmRlcklkOiBzdHJpbmcsIHJlY2VpdmVySWQ6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICAvLyBRdWVyeSB0byBjaGVjayBpZiB0aGUgc2VuZGVyIGlzIGluIHRoZSByZWNlaXZlcidzIGNvbnRhY3RzXG4gICAgICAgIGNvbnN0IGNvbnRhY3RRdWVyeSA9IHtcbiAgICAgICAgICAgIG93bmVySWQ6IHJlY2VpdmVySWQsXG4gICAgICAgICAgICBjb250YWN0TnVtYmVyOiBzZW5kZXJJZFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRyeSB0byBmaW5kIGEgY29udGFjdCBlbnRyeVxuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIGNvbnRhY3RRdWVyeSk7XG5cbiAgICAgICAgLy8gSWYgYSBjb250YWN0IGlzIGZvdW5kLCB0aGUgc2VuZGVyIGlzIGtub3duXG4gICAgICAgIHJldHVybiBjb250YWN0ICE9PSBudWxsO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRQaG9uZU51bWJlckJ5RW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBzbXJ0SWQ6IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIW51bWJlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gbnVtYmVyLnBob25lTnVtYmVyO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDaXRpemVuSWRCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgc21ydElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFBsYXllckJ5RW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5RW1haWwoZW1haWwpO1xuICAgICAgICByZXR1cm4gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEF2YXRhckZyb21FbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGF2YXRvciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFhdmF0b3IpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGF2YXRvci5hdmF0YXI7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFVzZXJOYW1lRnJvbUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiB1c2VyLnVzZXJuYW1lO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDaWRGcm9tVHdlZXRJZChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IHBpZ2VvbklkQXR0YWNoZWQ6IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIXJlcykgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gcmVzLl9pZDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2lkc0Zyb21QaWdlb25FbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX3NldHRpbmdzJywgeyBwaWdlb25JZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMgfHwgcmVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuICAgICAgICByZXR1cm4gcmVzLm1hcCgoc2V0dGluZzogYW55KSA9PiBzZXR0aW5nLl9pZCk7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENpZEZyb21EYXJrRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBkYXJrTWFpbElkQXR0YWNoZWQ6IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIXJlcykgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gcmVzLl9pZDtcbiAgICB9O1xuXG4gICAgYXN5bmMgSXNQbGF5ZXJJbkphaWwoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghcGxheWVyKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IG1ldGFkYXRhID0gcGxheWVyLlBsYXllckRhdGEubWV0YWRhdGE7XG4gICAgICAgICAgICByZXR1cm4gbWV0YWRhdGEgJiYgbWV0YWRhdGEuaW5qYWlsICYmIG1ldGFkYXRhLmluamFpbCA+IDA7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIGFzeW5jIGdldEpvYnMoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3Qgam9iczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICAgICAgICBjb25zdCBlbXBsb3llZXM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIGFueT4+ID0ge307XG5cbiAgICAgICAgLy8gZmluZCBhbGwgbXVsdGlqb2IgZW50cmllcyBmb3IgdGhpcyBjaXRpemVuXG4gICAgICAgIGNvbnN0IG15RW50cmllczogYW55W10gPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFteUVudHJpZXMgfHwgbXlFbnRyaWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHsgam9icywgZW1wbG95ZWVzIH07XG5cbiAgICAgICAgLy8gY29sbGVjdCB1bmlxdWUgam9iIG5hbWVzIHNvIHdlIGNhbiBmZXRjaCBhbGwgZW1wbG95ZWVzIGZvciB0aG9zZSBqb2JzIGluIG9uZSBxdWVyeVxuICAgICAgICBjb25zdCBqb2JOYW1lcyA9IEFycmF5LmZyb20obmV3IFNldChteUVudHJpZXMubWFwKGUgPT4gZS5qb2JOYW1lKSkpO1xuXG4gICAgICAgIC8vIGJ1aWxkIGpvYnMgbWFwIChvbmUgZW50cnkgcGVyIGpvYiB0aGlzIGNpZCBoYXMpXG4gICAgICAgIGZvciAoY29uc3QgZSBvZiBteUVudHJpZXMpIHtcbiAgICAgICAgICAgIGpvYnNbZS5qb2JOYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IGUuY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIGpvYk5hbWU6IGUuam9iTmFtZSxcbiAgICAgICAgICAgICAgICBncmFkZUxldmVsOiBlLmdyYWRlTGV2ZWwgPz8gMCxcbiAgICAgICAgICAgICAgICBqb2JMYWJlbDogZS5qb2JMYWJlbCA/PyBGcmFtZXdvcms/LlNoYXJlZD8uSm9icz8uW2Uuam9iTmFtZV0/LmxhYmVsID8/IGUuam9iTmFtZSxcbiAgICAgICAgICAgICAgICBncmFkZUxhYmVsOiBlLmdyYWRlTGFiZWwgPz8gRnJhbWV3b3JrPy5TaGFyZWQ/LkpvYnM/LltlLmpvYk5hbWVdPy5ncmFkZXM/LltlLmdyYWRlTGV2ZWxdPy5uYW1lID8/ICcnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmV0Y2ggYWxsIGVtcGxveWVlcyBmb3IgdGhlIGNvbGxlY3RlZCBqb2JzIGFuZCBidWlsZCBlbXBsb3llZXMgbWFwOiB7IGpvYk5hbWU6IHsgY2lkOiB7Li4ufSwgLi4uIH0sIC4uLiB9XG4gICAgICAgIGNvbnN0IGFsbEVtcGxveWVlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX211bHRpam9icycsIHsgam9iTmFtZTogeyAkaW46IGpvYk5hbWVzIH0gfSk7XG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgYWxsRW1wbG95ZWVzKSB7XG4gICAgICAgICAgICBlbXBsb3llZXNbZW50cnkuam9iTmFtZV0gPSBlbXBsb3llZXNbZW50cnkuam9iTmFtZV0gfHwge307XG4gICAgICAgICAgICBlbXBsb3llZXNbZW50cnkuam9iTmFtZV1bZW50cnkuY2l0aXplbklkXSA9IHtcbiAgICAgICAgICAgICAgICBjaWQ6IGVudHJ5LmNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBncmFkZTogZW50cnkuZ3JhZGVMZXZlbCA/PyAwLFxuICAgICAgICAgICAgICAgIGdyYWRlTGFiZWw6IGVudHJ5LmdyYWRlTGFiZWwgPz8gJycsXG4gICAgICAgICAgICAgICAgam9iTGFiZWw6IGVudHJ5LmpvYkxhYmVsID8/ICcnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgam9icywgZW1wbG95ZWVzIH07XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgVXRpbHMgPSBuZXcgVXRpbCgpOyIsICJpbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgUGhvbmVNYWlsLCBQaG9uZU1haWxNZXNzYWdlIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5cbmNsYXNzIE1haWwge1xuICAgIGFzeW5jIGdldE1haWxNZXNzYWdlcyhlbWFpbDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKSB7XG4gICAgICAgIGlmICghZW1haWwgJiYgIXBhc3N3b3JkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhIHx8IG1haWxEYXRhLm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbWFpbERhdGEubWVzc2FnZXMgPSBbXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1haWxEYXRhLm1lc3NhZ2VzID0gbWFpbERhdGEubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IG5ldyBEYXRlKGIuZGF0ZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5kYXRlKS5nZXRUaW1lKCkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG1haWxEYXRhLm1lc3NhZ2VzKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgc2VuZE1haWwoZW1haWw6IHN0cmluZywgdG86IHN0cmluZywgc3ViamVjdDogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIGltYWdlczogc3RyaW5nW10sIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHBsYXllciA9IGVtYWlsO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSB0bztcblxuICAgICAgICBjb25zdCBwbGF5ZXJNYWlsOiBQaG9uZU1haWwgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogcGxheWVyIH0pO1xuICAgICAgICBjb25zdCB0YXJnZXRNYWlsOiBQaG9uZU1haWwgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogdGFyZ2V0IH0pO1xuICAgICAgICBpZiAoIXBsYXllck1haWwgfHwgIXRhcmdldE1haWwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgbmV3TWFpbE1lc3NhZ2U6IFBob25lTWFpbE1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgZnJvbTogcGxheWVyLFxuICAgICAgICAgICAgdG86IHRhcmdldCxcbiAgICAgICAgICAgIGF2YXRhcjogYXdhaXQgVXRpbHMuR2V0QXZhdGFyRnJvbUVtYWlsKHRhcmdldCksXG4gICAgICAgICAgICB1c2VybmFtZTogYXdhaXQgVXRpbHMuR2V0VXNlck5hbWVGcm9tRW1haWwodGFyZ2V0KSxcbiAgICAgICAgICAgIHN1YmplY3Q6IHN1YmplY3QsXG4gICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLCBcbiAgICAgICAgICAgIGltYWdlczogaW1hZ2VzLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgcmVhZDogdHJ1ZSxcbiAgICAgICAgICAgIHRhZ3M6IFsnaW5ib3gnLCAnc2VudCddXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0TWFpbG1lc3NhZ2U6IFBob25lTWFpbE1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgZnJvbTogcGxheWVyLFxuICAgICAgICAgICAgdG86IHRhcmdldCxcbiAgICAgICAgICAgIGF2YXRhcjogYXdhaXQgVXRpbHMuR2V0QXZhdGFyRnJvbUVtYWlsKHBsYXllciksXG4gICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgIHVzZXJuYW1lOiBhd2FpdCBVdGlscy5HZXRVc2VyTmFtZUZyb21FbWFpbChwbGF5ZXIpLFxuICAgICAgICAgICAgaW1hZ2VzOiBpbWFnZXMsXG4gICAgICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICByZWFkOiBmYWxzZSxcbiAgICAgICAgICAgIHRhZ3M6IFsnaW5ib3gnXVxuICAgICAgICB9XG4gICAgICAgIHBsYXllck1haWwubWVzc2FnZXMucHVzaChuZXdNYWlsTWVzc2FnZSk7XG4gICAgICAgIHRhcmdldE1haWwubWVzc2FnZXMucHVzaCh0YXJnZXRNYWlsbWVzc2FnZSk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHBsYXllciB9LCBwbGF5ZXJNYWlsKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogdGFyZ2V0IH0sIHRhcmdldE1haWwpO1xuXG4gICAgICAgIGNvbnN0IHRhcmdldENpZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckJ5RW1haWwodGFyZ2V0KTtcbiAgICAgICAgcGxheWVyTWFpbC5tZXNzYWdlcy5zb3J0KChhOiBhbnksIGI6IGFueSkgPT4gbmV3IERhdGUoYi5kYXRlKS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLmRhdGUpLmdldFRpbWUoKSk7XG4gICAgICAgIHRhcmdldE1haWwubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IG5ldyBEYXRlKGIuZGF0ZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5kYXRlKS5nZXRUaW1lKCkpO1xuXG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaG1haWxNZXNzYWdlcycsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkocGxheWVyTWFpbC5tZXNzYWdlcykpO1xuICAgICAgICBpZiAodGFyZ2V0Q2lkKSB7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXRDaWQuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNYWlsJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGEgbmV3IG1haWwgZnJvbSAke3BsYXllcn0uYCxcbiAgICAgICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNobWFpbE1lc3NhZ2VzJywgdGFyZ2V0Q2lkLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh0YXJnZXRNYWlsLm1lc3NhZ2VzKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIGFzeW5jIHNlbmRFbWFpbFRvQWxsKHN1YmplY3Q6IHN0cmluZywgc2VuZGVyOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZywgaW1hZ2VzOiBzdHJpbmdbXSkge1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogeyAkbmU6IG51bGwgfSB9KTtcbiAgICAgICAgaWYgKCFtYWlsRGF0YSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBtYWlsRGF0YS5mb3JFYWNoKGFzeW5jIChtYWlsOiBQaG9uZU1haWwpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5ld01haWxNZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgZnJvbTogc2VuZGVyLFxuICAgICAgICAgICAgICAgIHRvOiBtYWlsLmFjdGl2ZU1haWRJZCxcbiAgICAgICAgICAgICAgICBhdmF0YXI6ICcnLFxuICAgICAgICAgICAgICAgIHN1YmplY3Q6IHN1YmplY3QsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgICAgICBpbWFnZXM6IGltYWdlcyB8fCBbXSxcbiAgICAgICAgICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgdGFnczogWydpbmJveCddLFxuICAgICAgICAgICAgICAgIHVzZXJuYW1lOiBzZW5kZXJcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBtYWlsLm1lc3NhZ2VzLnB1c2gobmV3TWFpbE1lc3NhZ2UpO1xuICAgICAgICAgICAgLy9AdHMtaWdub3JlXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBtYWlsLl9pZCB9LCBtYWlsKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIC0xLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogJ01haWwnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBhIG5ldyBtYWlsLCAke21lc3NhZ2V9LmAsXG4gICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgIH0pKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIGFzeW5jIHNlbGVjdGVNZXNzYWdlKGRhdGE6IHN0cmluZykge1xuICAgICAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgeyBtZXNzYWdlSWQsIG1haWxJZCB9ID0gcGFyc2VkRGF0YTtcbiAgICAgICAgY29uc3QgbWFpbERhdGE6IFBob25lTWFpbCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBtYWlsSWQgfSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IG1haWxEYXRhLm1lc3NhZ2VzLmZpbmQoKG0pID0+IG0uX2lkID09PSBtZXNzYWdlSWQpO1xuICAgICAgICBpZiAoIW1lc3NhZ2UpIHJldHVybiBmYWxzZTtcbiAgICAgICAgbWVzc2FnZS5yZWFkID0gdHJ1ZTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbElkIH0sIG1haWxEYXRhKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIGFzeW5jIGdldFByb2ZpbGVTZXR0aW5ncyhlbWFpbDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kQW5kUmV0dXJuU3BlY2lmaWNGaWVsZHMoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwsIGFjdGl2ZU1haWxQYXNzd29yZDogcGFzc3dvcmQgfSwgWydhY3RpdmVNYWlkSWQnLCAnYWN0aXZlTWFpbFBhc3N3b3JkJywgJ2F2YXRhcicsICd1c2VybmFtZSddKTtcbiAgICAgICAgaWYgKCFtYWlsRGF0YSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobWFpbERhdGEpO1xuICAgIH07XG5cbiAgICBhc3luYyB1cGRhdGVQcm9maWxlU2V0dGluZ3MoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZywgdXNlcm5hbWU6IHN0cmluZywgYXZhdGFyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbWFpbERhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwsIGFjdGl2ZU1haWxQYXNzd29yZDogcGFzc3dvcmQgfSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgbWFpbERhdGEudXNlcm5hbWUgPSB1c2VybmFtZTtcbiAgICAgICAgbWFpbERhdGEuYXZhdGFyID0gYXZhdGFyO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCwgYWN0aXZlTWFpbFBhc3N3b3JkOiBwYXNzd29yZCB9LCBtYWlsRGF0YSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG59XG5cbmV4cG9ydCBjb25zdCBNYWlsQ2xhc3MgPSBuZXcgTWFpbCgpOyIsICJpbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiLi9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBNYWlsQ2xhc3MgfSBmcm9tIFwiLi9hcHBzL01haWwvY2xhc3NcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmFzeW5jIGZ1bmN0aW9uIEdldEN1cnJlbnRQaG9uZU51bWJlcihzb3VyY2U6IG51bWJlciB8IHN0cmluZykge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICByZXR1cm4gbnVtYmVyO1xufVxuZXhwb3J0cygnR2V0Q3VycmVudFBob25lTnVtYmVyJywgR2V0Q3VycmVudFBob25lTnVtYmVyKTtcblxuYXN5bmMgZnVuY3Rpb24gR2V0Q3VycmVudFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn1cbmV4cG9ydHMoJ0dldEN1cnJlbnRQaG9uZU51bWJlckJ5Q2l0aXplbklkJywgR2V0Q3VycmVudFBob25lTnVtYmVyQnlDaXRpemVuSWQpO1xuXG5hc3luYyBmdW5jdGlvbiBHZXRFbWFpbElkQnlDaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBlbWFpbCA9IGF3YWl0IFV0aWxzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIHJldHVybiBlbWFpbDtcbn1cbmV4cG9ydHMoJ0dldEVtYWlsSWRCeUNpdGl6ZW5JZCcsIEdldEVtYWlsSWRCeUNpdGl6ZW5JZCk7XG5cbmFzeW5jIGZ1bmN0aW9uIEdldEVtYWlsSWRCeVNvdXJjZShzb3VyY2U6IG51bWJlciB8IHN0cmluZykge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGVtYWlsID0gYXdhaXQgVXRpbHMuR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIGVtYWlsO1xufVxuZXhwb3J0cygnR2V0RW1haWxJZEJ5U291cmNlJywgR2V0RW1haWxJZEJ5U291cmNlKTtcblxuYXN5bmMgZnVuY3Rpb24gU2VuZE5vdGlmaWNhdGlvbihzb3VyY2U6IG51bWJlciB8IHN0cmluZywgdGl0bGU6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZywgYXBwOiBzdHJpbmcsIHRpbWVvdXQ/OiBudW1iZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgYXBwLFxuICAgICAgICB0aW1lb3V0OiB0aW1lb3V0IHx8IDUwMDAsXG4gICAgfSkpO1xufVxuZXhwb3J0cygnU2VuZE5vdGlmaWNhdGlvbicsIFNlbmROb3RpZmljYXRpb24pO1xuXG5hc3luYyBmdW5jdGlvbiBTZW5kTWFpbChkYXRhOiB7XG4gICAgZW1haWw6IHN0cmluZztcbiAgICB0bzogc3RyaW5nO1xuICAgIHN1YmplY3Q6IHN0cmluZztcbiAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgaW1hZ2VzOiBzdHJpbmdbXTtcbiAgICBzb3VyY2U6IG51bWJlcjtcbn0pIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNYWlsQ2xhc3Muc2VuZE1haWwoZGF0YS5lbWFpbCwgZGF0YS50bywgZGF0YS5zdWJqZWN0LCBkYXRhLm1lc3NhZ2UsIGRhdGEuaW1hZ2VzLCBkYXRhLnNvdXJjZSk7XG4gICAgcmV0dXJuIHJlcztcbn1cbmV4cG9ydHMoJ1NlbmRNYWlsJywgU2VuZE1haWwpO1xuXG5hc3luYyBmdW5jdGlvbiBTZW5kTWFpbFRvQWxsKGRhdGE6IHtcbiAgICBzdWJqZWN0OiBzdHJpbmc7XG4gICAgc2VuZGVyOiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGltYWdlczogc3RyaW5nW107XG59KSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbmRFbWFpbFRvQWxsKGRhdGEuc3ViamVjdCwgZGF0YS5zZW5kZXIsZGF0YS5tZXNzYWdlLCBkYXRhLmltYWdlcyk7XG4gICAgcmV0dXJuIHJlcztcbn1cbmV4cG9ydHMoJ1NlbmRNYWlsVG9BbGwnLCBTZW5kTWFpbFRvQWxsKTtcblxuY29uc3QgR2V0Sm9icyA9IGFzeW5jIChjaXRpemVuSWQ6IHN0cmluZykgPT4ge1xuICAgIGlmICghY2l0aXplbklkKSByZXR1cm4ge307XG4gICAgY29uc3QgcmVzID0gYXdhaXQgVXRpbHMuZ2V0Sm9icyhjaXRpemVuSWQpO1xuICAgIHJldHVybiByZXMuam9icyB8fCB7fTtcbn07XG5leHBvcnRzKCdnZXRKb2JzJywgR2V0Sm9icyk7XG5cbi8vIE9wdGlvbmFsOiByZXR1cm4gZnVsbCByZXN1bHQgeyBqb2JzLCBlbXBsb3llZXMgfVxuY29uc3QgR2V0Sm9ic0Z1bGwgPSBhc3luYyAoY2l0aXplbklkOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgam9iczoge30sIGVtcGxveWVlczoge30gfTtcbiAgICByZXR1cm4gYXdhaXQgVXRpbHMuZ2V0Sm9icyhjaXRpemVuSWQpO1xufTtcbmV4cG9ydHMoJ2dldEpvYnNGdWxsJywgR2V0Sm9ic0Z1bGwpOyIsICJjb25zdCBjYWNoZUV2ZW50cyA9IHt9O1xuZXhwb3J0IGNvbnN0IGNhY2hlID0gbmV3IFByb3h5KHtcbiAgICByZXNvdXJjZTogR2V0Q3VycmVudFJlc291cmNlTmFtZSgpLFxuICAgIGdhbWU6IEdldEdhbWVOYW1lKCksXG59LCB7XG4gICAgZ2V0KHRhcmdldCwga2V5KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGtleSA/IHRhcmdldFtrZXldIDogdGFyZ2V0O1xuICAgICAgICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICBjYWNoZUV2ZW50c1trZXldID0gW107XG4gICAgICAgIEFkZEV2ZW50SGFuZGxlcihgb3hfbGliOmNhY2hlOiR7a2V5fWAsICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IGNhY2hlRXZlbnRzW2tleV07XG4gICAgICAgICAgICBldmVudHMuZm9yRWFjaCgoY2IpID0+IGNiKHZhbHVlLCBvbGRWYWx1ZSkpO1xuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRhcmdldFtrZXldID0gZXhwb3J0cy5veF9saWIuY2FjaGUoa2V5KSB8fCBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldFtrZXldO1xuICAgIH0sXG59KTtcbmV4cG9ydCBjb25zdCBvbkNhY2hlID0gKGtleSwgY2IpID0+IHtcbiAgICBpZiAoIWNhY2hlRXZlbnRzW2tleV0pXG4gICAgICAgIGNhY2hlW2tleV07XG4gICAgY2FjaGVFdmVudHNba2V5XS5wdXNoKGNiKTtcbn07XG4iLCAiaW1wb3J0IHsgY2FjaGUgfSBmcm9tICcuLi9jYWNoZSc7XG5jb25zdCBwZW5kaW5nQ2FsbGJhY2tzID0ge307XG5jb25zdCBjYWxsYmFja1RpbWVvdXQgPSBHZXRDb252YXJJbnQoJ294OmNhbGxiYWNrVGltZW91dCcsIDMwMDAwMCk7XG5vbk5ldChgX19veF9jYl8ke2NhY2hlLnJlc291cmNlfWAsIChrZXksIC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCByZXNvbHZlID0gcGVuZGluZ0NhbGxiYWNrc1trZXldO1xuICAgIGRlbGV0ZSBwZW5kaW5nQ2FsbGJhY2tzW2tleV07XG4gICAgcmV0dXJuIHJlc29sdmUgJiYgcmVzb2x2ZSguLi5hcmdzKTtcbn0pO1xuZXhwb3J0IGZ1bmN0aW9uIHRyaWdnZXJDbGllbnRDYWxsYmFjayhldmVudE5hbWUsIHBsYXllcklkLCAuLi5hcmdzKSB7XG4gICAgbGV0IGtleTtcbiAgICBkbyB7XG4gICAgICAgIGtleSA9IGAke2V2ZW50TmFtZX06JHtNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoMTAwMDAwICsgMSkpfToke3BsYXllcklkfWA7XG4gICAgfSB3aGlsZSAocGVuZGluZ0NhbGxiYWNrc1trZXldKTtcbiAgICBlbWl0TmV0KGBfX294X2NiXyR7ZXZlbnROYW1lfWAsIHBsYXllcklkLCBjYWNoZS5yZXNvdXJjZSwga2V5LCAuLi5hcmdzKTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBwZW5kaW5nQ2FsbGJhY2tzW2tleV0gPSByZXNvbHZlO1xuICAgICAgICBzZXRUaW1lb3V0KHJlamVjdCwgY2FsbGJhY2tUaW1lb3V0LCBgY2FsbGJhY2sgZXZlbnQgJyR7a2V5fScgdGltZWQgb3V0YCk7XG4gICAgfSk7XG59XG5leHBvcnQgZnVuY3Rpb24gb25DbGllbnRDYWxsYmFjayhldmVudE5hbWUsIGNiKSB7XG4gICAgb25OZXQoYF9fb3hfY2JfJHtldmVudE5hbWV9YCwgYXN5bmMgKHJlc291cmNlLCBrZXksIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgY29uc3Qgc3JjID0gc291cmNlO1xuICAgICAgICBsZXQgcmVzcG9uc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNwb25zZSA9IGF3YWl0IGNiKHNyYywgLi4uYXJncyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGhhbmRsaW5nIGNhbGxiYWNrIGV2ZW50ICR7ZXZlbnROYW1lfWApO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYF4zJHtlLnN0YWNrfV4wYCk7XG4gICAgICAgIH1cbiAgICAgICAgZW1pdE5ldChgX19veF9jYl8ke3Jlc291cmNlfWAsIHNyYywga2V5LCByZXNwb25zZSk7XG4gICAgfSk7XG59XG4iLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFBob25lQ29udGFjdHMgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6Z2V0Q29udGFjdHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IGNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfY29udGFjdHMnLCB7IG93bmVySWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoY29udGFjdHMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOnNhdmVDb250YWN0JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY29udGFjdERhdGE6IFBob25lQ29udGFjdHMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGlmIChjb250YWN0RGF0YS5faWQpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IGNvbnRhY3REYXRhLl9pZCB9LCB7IC4uLmNvbnRhY3REYXRhIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9jb250YWN0cycsXG4gICAgICAgICAgICB0aXRsZTogJ0NvbnRhY3QgVXBkYXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQ29udGFjdCAnJHtjb250YWN0RGF0YS5maXJzdE5hbWV9JyR7Y29udGFjdERhdGEubGFzdE5hbWV9JyAoTnVtYmVyOiAke2NvbnRhY3REYXRhLmNvbnRhY3ROdW1iZXJ9KSB1cGRhdGVkIGJ5ICR7Y29udGFjdERhdGEucGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czphZGRDb250YWN0JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IGNvbnRhY3REYXRhOiBQaG9uZUNvbnRhY3RzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBkYXRhWCA9IHsgLi4uY29udGFjdERhdGEsIG93bmVySWQ6IGNpdGl6ZW5JZCwgcGVyc29uYWxOdW1iZXI6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkKSB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2NvbnRhY3RzJywgZGF0YVgpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICB0aXRsZTogJ0NvbnRhY3QgQWRkZWQnLFxuICAgICAgICBtZXNzYWdlOiBgQ29udGFjdCAnJHtjb250YWN0RGF0YS5maXJzdE5hbWV9JyR7Y29udGFjdERhdGEubGFzdE5hbWV9JyAoTnVtYmVyOiAke2NvbnRhY3REYXRhLmNvbnRhY3ROdW1iZXJ9KSBhZGRlZCBieSAke2RhdGFYLnBlcnNvbmFsTnVtYmVyfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGFYKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czpkZWxldGVDb250YWN0JywgYXN5bmMgKGNsaWVudCwgX2lkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSk7XG4gICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgdGl0bGU6ICdDb250YWN0IERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgQ29udGFjdCAnJHtjb250YWN0LmZpcnN0TmFtZX0nICcke2NvbnRhY3QubGFzdE5hbWV9JyAoTnVtYmVyOiAke2NvbnRhY3QuY29udGFjdE51bWJlcn0pIGRlbGV0ZWQgYnkgJHtjb250YWN0LnBlcnNvbmFsTnVtYmVyfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6ZmF2Q29udGFjdCcsIGFzeW5jIChjbGllbnQsIF9pZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY29udGFjdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogX2lkIH0pO1xuICAgIGNvbnN0IGRhdGFYID0geyAuLi5jb250YWN0LCBpc0ZhdjogIWNvbnRhY3QuaXNGYXYgfVxuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSwgZGF0YVgpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICB0aXRsZTogJ0NvbnRhY3QgRmF2b3JpdGUgVG9nZ2xlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3QuZmlyc3ROYW1lfScgJyR7Y29udGFjdC5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdC5jb250YWN0TnVtYmVyfSkgZmF2b3JpdGUgc3RhdHVzIHNldCB0byAke2RhdGFYLmlzRmF2fSBieSAke2NvbnRhY3QucGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGFYKTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgTG9nZ2VyLCBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IERhcmtDaGF0Q2hhbm5lbCB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1NlYXJjaERhcmtDaGF0RW1haWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnUmVnaXN0ZXJOZXdEYXJrTWFpbEFjY291bnQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCwgZW1haWwsIHBhc3N3b3JkLCBhdmF0YXI6IFwiXCIgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9hY2NvdW50cycsXG4gICAgICAgIHRpdGxlOiAnQWNjb3VudCBSZWdpc3RlcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYE5ldyBEYXJrQ2hhdCBhY2NvdW50IHJlZ2lzdGVyZWQgd2l0aCBlbWFpbCAke2VtYWlsfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnTG9naW5EYXJrTWFpbEFjY291bnQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhOiB7XG4gICAgICAgIGVtYWlsOiBzdHJpbmc7XG4gICAgICAgIHBhc3N3b3JkOiBzdHJpbmc7XG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IHBhcnNlZERhdGEuZW1haWwgfSk7XG4gICAgaWYgKHJlcy5wYXNzd29yZCA9PT0gcGFyc2VkRGF0YS5wYXNzd29yZCkge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9hY2NvdW50cycsXG4gICAgICAgICAgICB0aXRsZTogJ0FjY291bnQgTG9naW4nLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgbG9nZ2VkIGludG8gRGFya0NoYXQgd2l0aCBlbWFpbCAke3BhcnNlZERhdGEuZW1haWx9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0NyZWF0ZU5ld0RhcmtDaGFubmVsJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBuYW1lLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMyOiBEYXJrQ2hhdENoYW5uZWxbXSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywge30pO1xuICAgIGlmIChyZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSkgJiYgIXJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKT8ubWVtYmVycy5pbmNsdWRlcyhlbWFpbCkpIHtcbiAgICAgICAgcmVzMi5maW5kKChjaGFubmVsKSA9PiBjaGFubmVsLm5hbWUgPT09IG5hbWUpPy5tZW1iZXJzLnB1c2goZW1haWwpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IG5hbWUgfSwgcmVzMi5maW5kKChjaGFubmVsKSA9PiBjaGFubmVsLm5hbWUgPT09IG5hbWUpKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdKb2luZWQgQ2hhbm5lbCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gam9pbmVkIGV4aXN0aW5nIERhcmtDaGF0IGNoYW5uZWwgJyR7bmFtZX0nLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzMi5maWx0ZXIoKGNoYW5uZWwpID0+IGNoYW5uZWwubWVtYmVycy5pbmNsdWRlcyhlbWFpbCkpKTtcbiAgICB9IGVsc2UgaWYgKCFyZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSkpIHtcbiAgICAgICAgY29uc3QgbmV3RGF0YSA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgbWVtYmVyczogW2VtYWlsXSxcbiAgICAgICAgICAgIGNyZWF0b3I6IGVtYWlsLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCBuZXdEYXRhKTtcbiAgICAgICAgcmVzMi5wdXNoKG5ld0RhdGEpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgICAgICB0aXRsZTogJ0NoYW5uZWwgQ3JlYXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gY3JlYXRlZCBuZXcgRGFya0NoYXQgY2hhbm5lbCAnJHtuYW1lfScuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMyLmZpbHRlcigoY2hhbm5lbCkgPT4gY2hhbm5lbC5tZW1iZXJzLmluY2x1ZGVzKGVtYWlsKSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnR2V0RGFya0NoYXRQcm9maWxlJywgYXN5bmMgKGNsaWVudCwgZW1haWw6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdHZXREYXJrQ2hhdENoYW5uZWxzJywgYXN5bmMgKGNsaWVudCwgZW1haWw6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBtZW1iZXJzOiBlbWFpbCB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdSZW1vdmVGcm9tRGFya0NoYW5uZWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IF9pZCwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgX2lkIH0pO1xuICAgIGlmIChyZXMuY3JlYXRvciA9PT0gZW1haWwpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBfaWQgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ2hhbm5lbCBEZWxldGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSBkZWxldGVkIERhcmtDaGF0IGNoYW5uZWwgJyR7cmVzLm5hbWV9JyAoSUQ6ICR7X2lkfSkuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVzLm1lbWJlcnMgPSByZXMubWVtYmVycy5maWx0ZXIoKG1lbWJlcjogc3RyaW5nKSA9PiBtZW1iZXIgIT09IGVtYWlsKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBfaWQgfSwgcmVzKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdMZWZ0IENoYW5uZWwnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IGxlZnQgRGFya0NoYXQgY2hhbm5lbCAnJHtyZXMubmFtZX0nIChJRDogJHtfaWR9KS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnVXBkYXRlRGFya0F2YXRhcicsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZW1haWwsIGF2YXRhciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZW1haWwgfSk7XG4gICAgcmVzLmF2YXRhciA9IGF2YXRhcjtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9LCByZXMpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfYWNjb3VudHMnLFxuICAgICAgICB0aXRsZTogJ0F2YXRhciBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IHVwZGF0ZWQgdGhlaXIgRGFya0NoYXQgYXZhdGFyLmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdVcGRhdGVEYXJrUGFzc3dvcmQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZW1haWwgfSk7XG4gICAgcmVzLnBhc3N3b3JkID0gcGFzc3dvcmQ7XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZW1haWwgfSwgcmVzKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2FjY291bnRzJyxcbiAgICAgICAgdGl0bGU6ICdQYXNzd29yZCBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IHVwZGF0ZWQgdGhlaXIgRGFya0NoYXQgcGFzc3dvcmQuYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1NldERhcmtDaGF0TWVzc2FnZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhWDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBjaGFubmVsLCBkYXRhIH0gPSBKU09OLnBhcnNlKGRhdGFYKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IF9pZDogY2hhbm5lbCB9LCBkYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJyxcbiAgICAgICAgdGl0bGU6ICdNZXNzYWdlIFNlbnQnLFxuICAgICAgICBtZXNzYWdlOiBgTWVzc2FnZSBzZW50IGluIERhcmtDaGF0IGNoYW5uZWwgJyR7ZGF0YS5uYW1lfScgKElEOiAke2NoYW5uZWx9KSwgQ29udGVudDogJHtkYXRhLmNvbnRlbnR9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICBkYXRhLm1lbWJlcnMuZm9yRWFjaChhc3luYyAobWVtYmVyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChhd2FpdCBVdGlscy5HZXRDaWRGcm9tRGFya0VtYWlsKG1lbWJlcikpO1xuICAgICAgICBpZiAoIXJlcykgcmV0dXJuO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlY2VpdmVEYXJrQ2hhdE1lc3NhZ2UnLCByZXMsIEpTT04uc3RyaW5naWZ5KGRhdGEpKTtcbiAgICAgICAgaWYgKHJlcyAhPT0gY2xpZW50KSB7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZXMsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdEYXJrQ2hhdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBhIG5ldyBtZXNzYWdlIGluICR7ZGF0YS5uYW1lfS5gLFxuICAgICAgICAgICAgICAgIGFwcDogJ3NldHRpbmdzJyxcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgTWFpbENsYXNzIH0gZnJvbSBcIi4vY2xhc3NcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpnZXRFbWFpbE1lc3NhZ2VzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBlbWFpbDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IE1haWxDbGFzcy5nZXRNYWlsTWVzc2FnZXMoZW1haWwsIHBhc3N3b3JkKVxuICAgIHJldHVybiBkYXRhO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZW5kRW1haWwnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGVtYWlsOiBzdHJpbmcsIHRvOiBzdHJpbmcsIHN1YmplY3Q6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nLCBpbWFnZXM6IHN0cmluZ1tdKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbmRNYWlsKGVtYWlsLCB0bywgc3ViamVjdCwgbWVzc2FnZSwgaW1hZ2VzLCBzb3VyY2UpO1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWFpbCcsXG4gICAgICAgIHRpdGxlOiAnRW1haWwgU2VudCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQbGF5ZXIgJHtjaXRpemVuSWR9IHNlbnQgYW4gZW1haWwgZnJvbSAke2VtYWlsfSB0byAke3RvfSB3aXRoIHN1YmplY3QgXCIke3N1YmplY3R9XCIsIGNvbnRlbnQ6IFwiJHttZXNzYWdlfVwiYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiByZXM7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNldFNlbGVjdGVkTWVzc2FnZScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbGVjdGVNZXNzYWdlKGRhdGEpO1xuICAgIHJldHVybiByZXM7XG59KVxuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6Z2V0UHJvZmlsZVNldHRpbmdzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gcGFyc2VkRGF0YTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNYWlsQ2xhc3MuZ2V0UHJvZmlsZVNldHRpbmdzKGVtYWlsLCBwYXNzd29yZCk7XG4gICAgcmV0dXJuIHJlcztcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6dXBkYXRlUHJvZmlsZVNldHRpbmdzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCwgdXNlcm5hbWUsIGF2YXRhciB9ID0gcGFyc2VkRGF0YTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNYWlsQ2xhc3MudXBkYXRlUHJvZmlsZVNldHRpbmdzKGVtYWlsLCBwYXNzd29yZCwgdXNlcm5hbWUsIGF2YXRhcik7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9tYWlsJyxcbiAgICAgICAgdGl0bGU6ICdQcm9maWxlIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7Y2l0aXplbklkfSB1cGRhdGVkIHByb2ZpbGUgZm9yIGVtYWlsICR7ZW1haWx9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IE1vbmdvREIsIExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpzZW5kTWVzc2FnZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgdHlwZSwgcGhvbmVOdW1iZXIsIGdyb3VwSWQsIG1lc3NhZ2VEYXRhIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgbGV0IGZpcnN0TWVzc2FnZSA9IGZhbHNlO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IHNlbmRlcklkLFxuICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9O1xuICAgICAgICBmaXJzdE1lc3NhZ2UgPSB0cnVlO1xuICAgIH1cblxuICAgIGxldCBjb252ZXJzYXRpb247XG4gICAgaWYgKHR5cGUgPT09ICdwcml2YXRlJykge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyID09PSBwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIocGhvbmVOdW1iZXIsIHNlbmRlcklkKSB8fCBgVW5rbm93biAoJHtwaG9uZU51bWJlcn0pYDtcbiAgICAgICAgICAgIGNvbnN0IGF2YXRhciA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3RBdmF0YXJCeU51bWJlcihwaG9uZU51bWJlciwgc2VuZGVySWQpIHx8IG51bGw7IC8vIEFzc3VtZSB0aGlzIHV0aWxpdHkgZXhpc3RzXG4gICAgICAgICAgICBjb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3ByaXZhdGUnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGNvbnRhY3ROYW1lLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogYXZhdGFyLCAvLyBTZXQgYXZhdGFyIGZvciBwcml2YXRlIGNvbnRhY3RcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogcGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2goY29udmVyc2F0aW9uKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2dyb3VwJykge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgZ3JvdXBJZD86IHN0cmluZyB9KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQgZm9yIHNlbmRlcicgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBsYXN0TWVzc2FnZSA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlc1tjb252ZXJzYXRpb24ubWVzc2FnZXMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgbmV4dFBhZ2UgPSBsYXN0TWVzc2FnZSA/IGxhc3RNZXNzYWdlLnBhZ2UgKyAxIDogMTtcblxuICAgIGNvbnN0IG5ld01lc3NhZ2UgPSB7XG4gICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VEYXRhLm1lc3NhZ2UsXG4gICAgICAgIHJlYWQ6IHRydWUsXG4gICAgICAgIHBhZ2U6IG5leHRQYWdlLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgc2VuZGVySWQ6IHNlbmRlclBob25lTnVtYmVyLFxuICAgICAgICBhdHRhY2htZW50czogbWVzc2FnZURhdGEuYXR0YWNobWVudHMgfHwgW11cbiAgICB9O1xuXG4gICAgY29udmVyc2F0aW9uLm1lc3NhZ2VzLnB1c2gobmV3TWVzc2FnZSk7XG5cbiAgICBpZiAoIWZpcnN0TWVzc2FnZSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tZXNzYWdlcycsIHVzZXJNZXNzYWdlcyk7XG4gICAgfVxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWVzc2FnZXMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgU2VudCcsXG4gICAgICAgIG1lc3NhZ2U6IGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gc2VudCBhIG1lc3NhZ2UgdG8gJHt0eXBlID09PSAncHJpdmF0ZScgPyBwaG9uZU51bWJlciA6ICdncm91cCAnICsgZ3JvdXBJZH0gd2l0aCBjb250ZW50OiAke21lc3NhZ2VEYXRhLm1lc3NhZ2V9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIC8vIEhhbmRsZSByZWNpcGllbnRzXG4gICAgaWYgKHR5cGUgPT09ICdwcml2YXRlJykge1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKHRhcmdldENpdGl6ZW5JZCkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGNvbnN0IGlzQmxvY2tlZCA9IHRhcmdldE1lc3NhZ2VzPy5ibG9ja2VkTnVtYmVycz8uaW5jbHVkZXMoc2VuZGVyUGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgaWYgKCFpc0Jsb2NrZWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBzZW5kVG9SZWNpcGllbnQodGFyZ2V0Q2l0aXplbklkLCBzZW5kZXJQaG9uZU51bWJlciwgbWVzc2FnZURhdGEsICdwcml2YXRlJywgcGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZCh0YXJnZXRDaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIENWWENTLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiWW91IGhhdmUgYSBuZXcgbWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmVfbWVzc2FnZXM6Y2xpZW50OnVwZGF0ZU1lc3NhZ2VzJywgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KG5ld01lc3NhZ2UpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gaXMgYmxvY2tlZCBieSAke3Bob25lTnVtYmVyfS4gTWVzc2FnZSBzYXZlZCBvbmx5IGZvciBzZW5kZXIuYCk7ICovXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhgUmVjaXBpZW50IHdpdGggcGhvbmUgbnVtYmVyICR7cGhvbmVOdW1iZXJ9IGRvZXMgbm90IGV4aXN0LiBNZXNzYWdlIHNhdmVkIG9ubHkgZm9yIHNlbmRlci5gKTsgKi9cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2dyb3VwJykge1xuICAgICAgICBjb25zdCBncm91cENvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXBDb252ZXJzYXRpb24/Lm1lbWJlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbWVtYmVycyBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXBDb252ZXJzYXRpb24ubWVtYmVycykge1xuICAgICAgICAgICAgaWYgKG1lbWJlcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQobWVtYmVySWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQmxvY2tlZCA9IG1lbWJlck1lc3NhZ2VzPy5ibG9ja2VkTnVtYmVycz8uaW5jbHVkZXMoc2VuZGVyUGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIGlmICghaXNCbG9ja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHNlbmRUb1JlY2lwaWVudChtZW1iZXJJZCwgc2VuZGVyUGhvbmVOdW1iZXIsIG1lc3NhZ2VEYXRhLCAnZ3JvdXAnLCB1bmRlZmluZWQsIGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gaXMgYmxvY2tlZCBieSBncm91cCBtZW1iZXIgJHttZW1iZXJQaG9uZU51bWJlcn0uYCk7ICovXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgICAgICAgICAgaWYgKENWWENTKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBhIG5ldyBtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZV9tZXNzYWdlczpjbGllbnQ6dXBkYXRlTWVzc2FnZXMnLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkoeyAuLi5uZXdNZXNzYWdlLCBncm91cElkIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xufSk7XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBzZW5kIG1lc3NhZ2VzIHRvIHJlY2lwaWVudHMgKHVuY2hhbmdlZClcbmFzeW5jIGZ1bmN0aW9uIHNlbmRUb1JlY2lwaWVudChcbiAgICB0YXJnZXRDaXRpemVuSWQ6IHN0cmluZyxcbiAgICBzZW5kZXJQaG9uZU51bWJlcjogc3RyaW5nLFxuICAgIG1lc3NhZ2VEYXRhOiBhbnksXG4gICAgdHlwZTogJ3ByaXZhdGUnIHwgJ2dyb3VwJyxcbiAgICBwaG9uZU51bWJlcj86IHN0cmluZyxcbiAgICBncm91cElkPzogc3RyaW5nXG4pIHtcbiAgICBsZXQgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICBsZXQgcmVjZWl2ZXJGaXJzdE1lc3NhZ2UgPSBmYWxzZTtcblxuICAgIGlmICghdGFyZ2V0TWVzc2FnZXMpIHtcbiAgICAgICAgdGFyZ2V0TWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH07XG4gICAgICAgIHJlY2VpdmVyRmlyc3RNZXNzYWdlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBsZXQgdGFyZ2V0Q29udmVyc2F0aW9uO1xuICAgIGlmICh0eXBlID09PSAncHJpdmF0ZScpIHtcbiAgICAgICAgdGFyZ2V0Q29udmVyc2F0aW9uID0gdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyID09PSBzZW5kZXJQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghdGFyZ2V0Q29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIsIHRhcmdldENpdGl6ZW5JZCk7XG4gICAgICAgICAgICBjb25zdCBhdmF0YXIgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0QXZhdGFyQnlOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIsIHRhcmdldENpdGl6ZW5JZCkgfHwgJyc7IC8vIEFzc3VtZSB0aGlzIHV0aWxpdHkgZXhpc3RzXG4gICAgICAgICAgICB0YXJnZXRDb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3ByaXZhdGUnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGNvbnRhY3ROYW1lIHx8IGBVbmtub3duICgke3NlbmRlclBob25lTnVtYmVyfSlgLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogYXZhdGFyLCAvLyBTZXQgYXZhdGFyIGZvciBwcml2YXRlIGNvbnRhY3RcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogc2VuZGVyUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMucHVzaCh0YXJnZXRDb252ZXJzYXRpb24pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnZ3JvdXAnKSB7XG4gICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyB0eXBlOiBzdHJpbmcsIGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKCF0YXJnZXRDb252ZXJzYXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHNlbmRlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHNlbmRlclBob25lTnVtYmVyKSB9KTtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gc2VuZGVyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgICAgIGlmICghZ3JvdXApIHJldHVybjtcbiAgICAgICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLm5hbWUsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiBncm91cC5hdmF0YXIgfHwgbnVsbCwgLy8gQ29weSBhdmF0YXIgZnJvbSBzZW5kZXIncyBncm91cFxuICAgICAgICAgICAgICAgIGdyb3VwSWQ6IGdyb3VwSWQsXG4gICAgICAgICAgICAgICAgbWVtYmVyczogZ3JvdXAubWVtYmVycyxcbiAgICAgICAgICAgICAgICBtZW1iZXJQaG9uZU51bWJlcnM6IGdyb3VwLm1lbWJlclBob25lTnVtYmVycyxcbiAgICAgICAgICAgICAgICBjcmVhdG9ySWQ6IGdyb3VwLmNyZWF0b3JJZCwgLy8gQ29weSBjcmVhdG9ySWRcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0YXJnZXRNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHRhcmdldENvbnZlcnNhdGlvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0YXJnZXRMYXN0TWVzc2FnZSA9IHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlc1t0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGFyZ2V0TmV4dFBhZ2UgPSB0YXJnZXRMYXN0TWVzc2FnZSA/IHRhcmdldExhc3RNZXNzYWdlLnBhZ2UgKyAxIDogMTtcblxuICAgIGNvbnN0IHRhcmdldE5ld01lc3NhZ2UgPSB7XG4gICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VEYXRhLm1lc3NhZ2UsXG4gICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICBwYWdlOiB0YXJnZXROZXh0UGFnZSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHNlbmRlcklkOiBzZW5kZXJQaG9uZU51bWJlcixcbiAgICAgICAgYXR0YWNobWVudHM6IG1lc3NhZ2VEYXRhLmF0dGFjaG1lbnRzIHx8IFtdXG4gICAgfTtcblxuICAgIHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcy5wdXNoKHRhcmdldE5ld01lc3NhZ2UpO1xuXG4gICAgaWYgKCFyZWNlaXZlckZpcnN0TWVzc2FnZSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdGFyZ2V0TWVzc2FnZXMuX2lkIH0sIHRhcmdldE1lc3NhZ2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCB0YXJnZXRNZXNzYWdlcyk7XG4gICAgfVxufVxuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmNyZWF0ZUdyb3VwJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBncm91cE5hbWUsIG1lbWJlclBob25lTnVtYmVycywgYXZhdGFyIH0gPSBKU09OLnBhcnNlKGRhdGEpOyAvLyBBZGRlZCBhdmF0YXIgZmllbGRcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG1lbWJlcklkcyA9IFtzZW5kZXJJZF07XG4gICAgY29uc3QgcGhvbmVOdW1iZXJzID0gW3NlbmRlclBob25lTnVtYmVyXTtcbiAgICBmb3IgKGNvbnN0IHBob25lIG9mIG1lbWJlclBob25lTnVtYmVycykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lKTtcbiAgICAgICAgaWYgKGNpdGl6ZW5JZCAmJiAhbWVtYmVySWRzLmluY2x1ZGVzKGNpdGl6ZW5JZCkpIHtcbiAgICAgICAgICAgIG1lbWJlcklkcy5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICBwaG9uZU51bWJlcnMucHVzaChwaG9uZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBncm91cElkID0gZ2VuZXJhdGVVVWlkKCk7XG4gICAgY29uc3QgZ3JvdXBDb252ZXJzYXRpb24gPSB7XG4gICAgICAgIHR5cGU6ICdncm91cCcsXG4gICAgICAgIG5hbWU6IGdyb3VwTmFtZSxcbiAgICAgICAgYXZhdGFyOiBhdmF0YXIgfHwgJycsXG4gICAgICAgIGdyb3VwSWQ6IGdyb3VwSWQsXG4gICAgICAgIG1lbWJlcnM6IG1lbWJlcklkcyxcbiAgICAgICAgbWVtYmVyUGhvbmVOdW1iZXJzOiBwaG9uZU51bWJlcnMsXG4gICAgICAgIGNyZWF0b3JJZDogc2VuZGVySWQsIC8vIFNldCB0aGUgY3JlYXRvciBhcyB0aGUgc2VuZGVyXG4gICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBjcmVhdGVkIG5ldyBHcm91cFwiLFxuICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICB1c2VyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiBzZW5kZXJJZCxcbiAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICBtZXNzYWdlczogW2dyb3VwQ29udmVyc2F0aW9uXVxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCB1c2VyTWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKGdyb3VwQ29udmVyc2F0aW9uKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIG1lbWJlcklkcykge1xuICAgICAgICBpZiAobWVtYmVySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgICAgICBsZXQgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICAgICAgY29uc3QgQ1ZYQ1MgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKG1lbWJlcklkKTtcbiAgICAgICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBiZWVuIGFkZGVkIHRvIGEgbmV3IGdyb3VwXCIsXG4gICAgICAgICAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IG1lbWJlcklkLFxuICAgICAgICAgICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbeyAuLi5ncm91cENvbnZlcnNhdGlvbiB9XVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHsgLi4uZ3JvdXBDb252ZXJzYXRpb24gfSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICB0aXRsZTogJ0dyb3VwIENyZWF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJyR7Z3JvdXBOYW1lfScgY3JlYXRlZCBieSAke3NlbmRlclBob25lTnVtYmVyfS4gR3JvdXAgSUQ6ICR7Z3JvdXBJZH0gd2l0aCBtZW1iZXJzOiAke21lbWJlclBob25lTnVtYmVycy5qb2luKCcsICcpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBncm91cElkIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6dG9nZ2xlQmxvY2snLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHBob25lTnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG5cbiAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogc2VuZGVySWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKCF1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMpIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzID0gW107XG4gICAgfVxuXG4gICAgY29uc3QgaXNCbG9ja2VkID0gdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLmluY2x1ZGVzKHBob25lTnVtYmVyKTtcbiAgICBpZiAoaXNCbG9ja2VkKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLmluZGV4T2YocGhvbmVOdW1iZXIpO1xuICAgICAgICB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgZW1pdE5ldChcInBob25lOmFkZE5vdGlGaWNhdGlvblwiLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIHVuYmxvY2tlZFwiLFxuICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYmxvY2tzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTnVtYmVyIFVuYmxvY2tlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gdW5ibG9ja2VkICR7cGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5wdXNoKHBob25lTnVtYmVyKTtcbiAgICAgICAgZW1pdE5ldChcInBob25lOmFkZE5vdGlGaWNhdGlvblwiLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIGJsb2NrZWRcIixcbiAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2Jsb2NrcycsXG4gICAgICAgICAgICB0aXRsZTogJ051bWJlciBCbG9ja2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NlbmRlclBob25lTnVtYmVyfSBibG9ja2VkICR7cGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh1c2VyTWVzc2FnZXMubWVzc2FnZXMubGVuZ3RoID09PSAwICYmIHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5sZW5ndGggPT09IDAgJiYgIXVzZXJNZXNzYWdlcy5kZWxldGVkTWVzc2FnZXM/Lmxlbmd0aCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTphZGRNZW1iZXInLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGdyb3VwSWQsIHBob25lTnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICAgICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFZhbGlkYXRlIHRoZSBuZXcgbWVtYmVyXG4gICAgICAgIGNvbnN0IG5ld01lbWJlcklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghbmV3TWVtYmVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCB0aGUgc2VuZGVyJ3MgbWVzc2FnZXMgdG8gZmluZCB0aGUgZ3JvdXBcbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBtZW1iZXJzPzogc3RyaW5nW10sIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXAgfHwgIWdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgbmV3IG1lbWJlciBpcyBhbHJlYWR5IGluIHRoZSBncm91cFxuICAgICAgICBpZiAoZ3JvdXAubWVtYmVycy5pbmNsdWRlcyhuZXdNZW1iZXJJZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIGFscmVhZHkgaW4gZ3JvdXAnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHRoZSBuZXcgbWVtYmVyIHRvIHRoZSBncm91cFxuICAgICAgICBncm91cC5tZW1iZXJzLnB1c2gobmV3TWVtYmVySWQpO1xuICAgICAgICBncm91cC5tZW1iZXJQaG9uZU51bWJlcnMucHVzaChwaG9uZU51bWJlcik7XG5cbiAgICAgICAgLy8gVXBkYXRlIGFsbCBleGlzdGluZyBtZW1iZXJzJyBncm91cCBkYXRhLCBpbmNsdWRpbmcgdGhlIHNlbmRlciBhbmQgbmV3IG1lbWJlclxuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgICAgIGxldCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG5cbiAgICAgICAgICAgIGlmICghbWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgbWVtYmVyIGlzIG5ldyAobm8gbWVzc2FnZXMgZG9jdW1lbnQpLCBjcmVhdGUgb25lXG4gICAgICAgICAgICAgICAgbWVtYmVyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogbWVtYmVySWQsXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbWVtYmVyR3JvdXAgPSBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICBpZiAobWVtYmVyR3JvdXApIHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgZXhpc3RpbmcgZ3JvdXAgZGF0YSBmb3IgdGhpcyBtZW1iZXJcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJzID0gZ3JvdXAubWVtYmVycztcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJQaG9uZU51bWJlcnMgPSBncm91cC5tZW1iZXJQaG9uZU51bWJlcnM7XG4gICAgICAgICAgICAgICAgbWVtYmVyR3JvdXAuYXZhdGFyID0gZ3JvdXAuYXZhdGFyOyAvLyBFbnN1cmUgYXZhdGFyIGlzIGNvcGllZFxuICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLmNyZWF0b3JJZCA9IGdyb3VwLmNyZWF0b3JJZDsgLy8gRW5zdXJlIGNyZWF0b3JJZCBpcyBjb3BpZWRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQWRkIHRoZSBncm91cCB0byB0aGlzIG1lbWJlcidzIG1lc3NhZ2VzIGlmIGl0IGRvZXNuXHUyMDE5dCBleGlzdFxuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2goeyAuLi5ncm91cCB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2F2ZSBvciB1cGRhdGUgdGhlIG1lbWJlcidzIG1lc3NhZ2VzXG4gICAgICAgICAgICBpZiAobWVtYmVyTWVzc2FnZXMuX2lkKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgLyogLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgZGF0YSBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCkpICovXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBncm91cCBkYXRhIGZvciBtZW1iZXIgJHttZW1iZXJJZH06YCwgZXJyb3IpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBDcmVhdGVkIG1lc3NhZ2VzIGZvciBuZXcgbWVtYmVyICR7bWVtYmVySWR9YCkpICovXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBtZXNzYWdlcyBmb3IgbmV3IG1lbWJlciAke21lbWJlcklkfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ01lbWJlciBBZGRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gYWRkZWQgJHtwaG9uZU51bWJlcn0gdG8gZ3JvdXAgJHtncm91cElkfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBhZGRpbmcgbWVtYmVyIHRvIGdyb3VwOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBhZGRpbmcgdGhlIG1lbWJlciB0byB0aGUgZ3JvdXAnIH0pO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnJlbW92ZU1lbWJlcicsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZ3JvdXBJZCwgcGhvbmVOdW1iZXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICBjb25zdCBtZW1iZXJJZFRvUmVtb3ZlID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgaWYgKCFtZW1iZXJJZFRvUmVtb3ZlKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICBpZiAoIWdyb3VwIHx8ICFncm91cC5tZW1iZXJzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgbWVtYmVySW5kZXggPSBncm91cC5tZW1iZXJzLmluZGV4T2YobWVtYmVySWRUb1JlbW92ZSk7XG4gICAgaWYgKG1lbWJlckluZGV4ID09PSAtMSkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lbWJlciBub3QgaW4gZ3JvdXAnIH0pO1xuICAgIH1cblxuICAgIGdyb3VwLm1lbWJlcnMuc3BsaWNlKG1lbWJlckluZGV4LCAxKTtcbiAgICBncm91cC5tZW1iZXJQaG9uZU51bWJlcnMuc3BsaWNlKG1lbWJlckluZGV4LCAxKTtcblxuICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycykge1xuICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKG1lbWJlckdyb3VwKSB7XG4gICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJzID0gZ3JvdXAubWVtYmVycztcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLm1lbWJlclBob25lTnVtYmVycyA9IGdyb3VwLm1lbWJlclBob25lTnVtYmVycztcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLmF2YXRhciA9IGdyb3VwLmF2YXRhcjsgLy8gRW5zdXJlIGF2YXRhciBpcyBjb3BpZWRcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLmNyZWF0b3JJZCA9IGdyb3VwLmNyZWF0b3JJZDsgLy8gRW5zdXJlIGNyZWF0b3JJZCBpcyBjb3BpZWRcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZFRvUmVtb3ZlIH0pO1xuICAgIGlmIChyZW1vdmVkTWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgY29uc3QgZ3JvdXBJbmRleCA9IHJlbW92ZWRNZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kSW5kZXgoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKGdyb3VwSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICByZW1vdmVkTWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuc3BsaWNlKGdyb3VwSW5kZXgsIDEpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHJlbW92ZWRNZW1iZXJNZXNzYWdlcy5faWQgfSwgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgIHRpdGxlOiAnTWVtYmVyIFJlbW92ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gcmVtb3ZlZCAke3Bob25lTnVtYmVyfSBmcm9tIGdyb3VwICR7Z3JvdXBJZH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmRlbGV0ZUdyb3VwJywgYXN5bmMgKGNsaWVudCwgZ3JvdXBJZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBjb25zdCBncm91cCA9IHVzZXJNZXNzYWdlcz8ubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgIGlmICghZ3JvdXAgfHwgIWdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQgb3IgdW5hdXRob3JpemVkJyB9KTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiB0aGUgc2VuZGVyIGlzIHRoZSBncm91cCBjcmVhdG9yIChhZG1pbilcbiAgICBpZiAoZ3JvdXAuY3JlYXRvcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ09ubHkgdGhlIGdyb3VwIGNyZWF0b3IgY2FuIGRlbGV0ZSB0aGUgZ3JvdXAnIH0pO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycykge1xuICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkdyb3VwIGhhcyBiZWVuIGRlbGV0ZWRcIixcbiAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBjb25zdCBncm91cEluZGV4ID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZEluZGV4KChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICBpZiAoZ3JvdXBJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5zcGxpY2UoZ3JvdXBJbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICB0aXRsZTogJ0dyb3VwIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJHtncm91cElkfSBkZWxldGVkIGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0R3JvdXBNZXNzYWdlcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZ3JvdXBJZCwgcGFnZSA9IDEsIGxpbWl0ID0gMjAgfSA9IEpTT04ucGFyc2UoZGF0YSk7IC8vIEFkZCBwYWdlIGFuZCBsaW1pdCBmb3IgcGFnaW5hdGlvblxuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnTm8gbWVzc2FnZXMgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBncm91cElkPzogc3RyaW5nIH0pID0+XG4gICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5ncm91cElkID09PSBncm91cElkKTtcblxuICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlczogW10sIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICAvLyBTb3J0IG1lc3NhZ2VzIGJ5IHRpbWVzdGFtcCAoZGVzY2VuZGluZykgYW5kIHBhZ2luYXRlXG4gICAgY29uc3Qgc29ydGVkTWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+XG4gICAgICAgIG5ldyBEYXRlKGIudGltZXN0YW1wKS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLnRpbWVzdGFtcCkuZ2V0VGltZSgpXG4gICAgKTtcblxuICAgIGNvbnN0IHN0YXJ0SW5kZXggPSAocGFnZSAtIDEpICogbGltaXQ7XG4gICAgY29uc3QgZW5kSW5kZXggPSBzdGFydEluZGV4ICsgbGltaXQ7XG4gICAgY29uc3QgcGFnaW5hdGVkTWVzc2FnZXMgPSBzb3J0ZWRNZXNzYWdlcy5zbGljZShzdGFydEluZGV4LCBlbmRJbmRleCk7XG5cbiAgICBjb25zdCBoYXNNb3JlID0gZW5kSW5kZXggPCBzb3J0ZWRNZXNzYWdlcy5sZW5ndGg7XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlczogcGFnaW5hdGVkTWVzc2FnZXMsXG4gICAgICAgIG1lbWJlclBob25lTnVtYmVyczogY29udmVyc2F0aW9uLm1lbWJlclBob25lTnVtYmVycyB8fCBbXSxcbiAgICAgICAgbmFtZTogY29udmVyc2F0aW9uLm5hbWUsXG4gICAgICAgIGF2YXRhcjogY29udmVyc2F0aW9uLmF2YXRhciB8fCBudWxsLFxuICAgICAgICBoYXNNb3JlOiBoYXNNb3JlLFxuICAgICAgICB0b3RhbE1lc3NhZ2VzOiBzb3J0ZWRNZXNzYWdlcy5sZW5ndGgsXG4gICAgICAgIGNyZWF0b3JJZDogY29udmVyc2F0aW9uLmNyZWF0b3JJZCAvLyBJbmNsdWRlIGNyZWF0b3JJZCBmb3IgVUkgb3IgdmVyaWZpY2F0aW9uIGlmIG5lZWRlZFxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0UHJpdmF0ZU1lc3NhZ2VzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBwaG9uZU51bWJlciwgcGFnZSA9IDEsIGxpbWl0ID0gMjAgfSA9IEpTT04ucGFyc2UoZGF0YSk7IC8vIEFkZCBwYWdlIGFuZCBsaW1pdCBmb3IgcGFnaW5hdGlvblxuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnTm8gbWVzc2FnZXMgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBwaG9uZU51bWJlcj86IHN0cmluZyB9KSA9PlxuICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIG1zZy5waG9uZU51bWJlciA9PT0gcGhvbmVOdW1iZXIpO1xuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ0NvbnZlcnNhdGlvbiBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIC8vIFNvcnQgbWVzc2FnZXMgYnkgdGltZXN0YW1wIChkZXNjZW5kaW5nKSBhbmQgcGFnaW5hdGVcbiAgICBjb25zdCBzb3J0ZWRNZXNzYWdlcyA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlcy5zb3J0KChhOiBhbnksIGI6IGFueSkgPT5cbiAgICAgICAgbmV3IERhdGUoYi50aW1lc3RhbXApLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEudGltZXN0YW1wKS5nZXRUaW1lKClcbiAgICApO1xuXG4gICAgY29uc3Qgc3RhcnRJbmRleCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcbiAgICBjb25zdCBlbmRJbmRleCA9IHN0YXJ0SW5kZXggKyBsaW1pdDtcbiAgICBjb25zdCBwYWdpbmF0ZWRNZXNzYWdlcyA9IHNvcnRlZE1lc3NhZ2VzLnNsaWNlKHN0YXJ0SW5kZXgsIGVuZEluZGV4KTtcbiAgICBjb25zdCBoYXNNb3JlID0gZW5kSW5kZXggPCBzb3J0ZWRNZXNzYWdlcy5sZW5ndGg7XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlczogcGFnaW5hdGVkTWVzc2FnZXMsXG4gICAgICAgIGF2YXRhcjogY29udmVyc2F0aW9uLmF2YXRhciB8fCBudWxsLFxuICAgICAgICBuYW1lOiBjb252ZXJzYXRpb24ubmFtZSxcbiAgICAgICAgaGFzTW9yZTogaGFzTW9yZSxcbiAgICAgICAgdG90YWxNZXNzYWdlczogc29ydGVkTWVzc2FnZXMubGVuZ3RoXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpnZXRNZXNzYWdlQ2hhbm5lbHNhbmRMYXN0TWVzc2FnZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG5cbiAgICAgICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ05vIG1lc3NhZ2VzIGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNoYW5uZWxzID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLm1hcChhc3luYyAobXNnOiB7IHR5cGU6IHN0cmluZywgbmFtZTogc3RyaW5nLCBwaG9uZU51bWJlcj86IHN0cmluZywgYXZhdGFyOiBzdHJpbmcsIGdyb3VwSWQ/OiBzdHJpbmcsIG1lbWJlcnM/OiBzdHJpbmdbXSwgbWVtYmVyUGhvbmVOdW1iZXJzPzogc3RyaW5nW10sIG1lc3NhZ2VzOiBhbnlbXSwgY3JlYXRvcklkPzogc3RyaW5nIH0pID0+IHtcbiAgICAgICAgICAgIGxldCB1cGRhdGVkTmFtZSA9IG1zZy5uYW1lO1xuICAgICAgICAgICAgbGV0IHVwZGF0ZWRNZW1iZXJQaG9uZU51bWJlcnMgPSBtc2cubWVtYmVyUGhvbmVOdW1iZXJzIHx8IFtdO1xuXG4gICAgICAgICAgICAvLyBIYW5kbGUgcHJpdmF0ZSBjb252ZXJzYXRpb25zXG4gICAgICAgICAgICBpZiAobXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtc2cucGhvbmVOdW1iZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIobXNnLnBob25lTnVtYmVyLCBzZW5kZXJJZCkgfHwgYFVua25vd24gKCR7bXNnLnBob25lTnVtYmVyfSlgO1xuICAgICAgICAgICAgICAgIGlmIChuZXdDb250YWN0TmFtZSAhPT0gbXNnLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBuYW1lIGluIHRoZSBkYXRhYmFzZSBpZiBpdCBoYXMgY2hhbmdlZFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobTogYW55KSA9PiBtLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtLnBob25lTnVtYmVyID09PSBtc2cucGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb252ZXJzYXRpb24ubmFtZSA9IG5ld0NvbnRhY3ROYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGNvbnRhY3QgbmFtZSBmb3IgJHttc2cucGhvbmVOdW1iZXJ9IHRvICR7bmV3Q29udGFjdE5hbWV9YCkpICovXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGNvbnRhY3QgbmFtZSBmb3IgJHttc2cucGhvbmVOdW1iZXJ9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlZE5hbWUgPSBuZXdDb250YWN0TmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBIYW5kbGUgZ3JvdXAgY29udmVyc2F0aW9uc1xuICAgICAgICAgICAgZWxzZSBpZiAobXNnLnR5cGUgPT09ICdncm91cCcgJiYgbXNnLm1lbWJlclBob25lTnVtYmVycyAmJiBtc2cubWVtYmVyUGhvbmVOdW1iZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1zZy5tZW1iZXJQaG9uZU51bWJlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGhvbmUgPSBtc2cubWVtYmVyUGhvbmVOdW1iZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdDb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIocGhvbmUsIHNlbmRlcklkKSB8fCBgVW5rbm93biAoJHtwaG9uZX0pYDtcbiAgICAgICAgICAgICAgICAgICAgLy8gWW91IGNvdWxkIHVwZGF0ZSBpbmRpdmlkdWFsIG1lbWJlciBuYW1lcyBoZXJlIGlmIG5lZWRlZCwgYnV0IGZvciBncm91cCBuYW1lLCB3ZSBrZWVwIGl0IGFzLWlzIHVubGVzcyBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gT3B0aW9uYWxseSwgeW91IGNvdWxkIGFnZ3JlZ2F0ZSBtZW1iZXIgbmFtZXMgaW50byB0aGUgZ3JvdXAgbmFtZSBpZiBkZXNpcmVkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IG1zZy50eXBlLFxuICAgICAgICAgICAgICAgIG5hbWU6IHVwZGF0ZWROYW1lLFxuICAgICAgICAgICAgICAgIHBob25lTnVtYmVyOiBtc2cucGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgZ3JvdXBJZDogbXNnLmdyb3VwSWQsXG4gICAgICAgICAgICAgICAgbWVtYmVyczogbXNnLm1lbWJlcnMsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiBtc2cuYXZhdGFyLFxuICAgICAgICAgICAgICAgIG1lbWJlclBob25lTnVtYmVyczogdXBkYXRlZE1lbWJlclBob25lTnVtYmVycyxcbiAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogbXNnLm1lc3NhZ2VzW21zZy5tZXNzYWdlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICBjcmVhdG9ySWQ6IG1zZy5jcmVhdG9ySWQgLy8gSW5jbHVkZSBjcmVhdG9ySWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdhaXQgZm9yIGFsbCBwcm9taXNlcyB0byByZXNvbHZlXG4gICAgICAgIGNvbnN0IHJlc29sdmVkQ2hhbm5lbHMgPSBhd2FpdCBQcm9taXNlLmFsbChjaGFubmVscyk7XG5cbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgY2hhbm5lbHM6IHJlc29sdmVkQ2hhbm5lbHMgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgbWVzc2FnZSBjaGFubmVscyBhbmQgbGFzdCBtZXNzYWdlczonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgbWVzc2FnZSBjaGFubmVscycgfSk7XG4gICAgfVxufSk7XG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmdldE1lc3NhZ2VTdGF0cycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgICAgICBhbGxNZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICBrbm93bk1lc3NhZ2VzOiAwLFxuICAgICAgICAgICAgICAgIHVua25vd25NZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICB1bnJlYWRNZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICByZWNlbnRseURlbGV0ZWQ6IDBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY3VycmVudERhdGUgPSBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IHRoaXJ0eURheXNBZ28gPSBuZXcgRGF0ZShjdXJyZW50RGF0ZS5nZXRUaW1lKCkgLSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDApOyAvLyAzMCBkYXlzIGFnb1xuXG4gICAgbGV0IGFsbE1lc3NhZ2VzID0gMDtcbiAgICBsZXQga25vd25NZXNzYWdlcyA9IDA7XG4gICAgbGV0IHVua25vd25NZXNzYWdlcyA9IDA7XG4gICAgbGV0IHVucmVhZE1lc3NhZ2VzID0gMDtcbiAgICBsZXQgcmVjZW50bHlEZWxldGVkID0gMDtcblxuICAgIGZvciAoY29uc3QgY29udmVyc2F0aW9uIG9mIHVzZXJNZXNzYWdlcy5tZXNzYWdlcykge1xuICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgY29udmVyc2F0aW9uLm1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBhbGxNZXNzYWdlcyArPSAxO1xuXG4gICAgICAgICAgICBjb25zdCBpc0tub3duID0gY29udmVyc2F0aW9uLm5hbWUgJiYgIWNvbnZlcnNhdGlvbi5uYW1lLm1hdGNoKC9eWzAtOSFAIyQlXiYqKClfK1xcLT1cXFtcXF17fTsnOlwiXFxcXHwsLjw+XFwvP10qJC8pO1xuICAgICAgICAgICAgaWYgKGlzS25vd24pIHtcbiAgICAgICAgICAgICAgICBrbm93bk1lc3NhZ2VzICs9IDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVua25vd25NZXNzYWdlcyArPSAxO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UucmVhZCkge1xuICAgICAgICAgICAgICAgIHVucmVhZE1lc3NhZ2VzICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodXNlck1lc3NhZ2VzLmRlbGV0ZWRNZXNzYWdlcykge1xuICAgICAgICByZWNlbnRseURlbGV0ZWQgPSB1c2VyTWVzc2FnZXMuZGVsZXRlZE1lc3NhZ2VzLmZpbHRlcigoZGVsZXRlZDogYW55KSA9PlxuICAgICAgICAgICAgZGVsZXRlZC50aW1lc3RhbXAgPiB0aGlydHlEYXlzQWdvXG4gICAgICAgICkubGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhbGxNZXNzYWdlcyxcbiAgICAgICAgICAgIGtub3duTWVzc2FnZXMsXG4gICAgICAgICAgICB1bmtub3duTWVzc2FnZXMsXG4gICAgICAgICAgICB1bnJlYWRNZXNzYWdlcyxcbiAgICAgICAgICAgIHJlY2VudGx5RGVsZXRlZFxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpkZWxldGVNZXNzYWdlJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBjb252ZXJzYXRpb25UeXBlLCBwaG9uZU51bWJlciwgZ3JvdXBJZCwgbWVzc2FnZUluZGV4IH0gPSBKU09OLnBhcnNlKGRhdGEgfHwgJ3t9Jyk7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVzc2FnZXMgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBsZXQgY29udmVyc2F0aW9uOiBhbnk7XG4gICAgaWYgKGNvbnZlcnNhdGlvblR5cGUgPT09ICdwcml2YXRlJyAmJiBwaG9uZU51bWJlcikge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiBhbnkpID0+XG4gICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIE51bWJlcihtc2cucGhvbmVOdW1iZXIpID09PSBOdW1iZXIocGhvbmVOdW1iZXIpXG4gICAgICAgICk7XG4gICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb25UeXBlID09PSAnZ3JvdXAnICYmIGdyb3VwSWQpIHtcbiAgICAgICAgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgU3RyaW5nKG1zZy5ncm91cElkKSA9PT0gU3RyaW5nKGdyb3VwSWQpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb252ZXJzYXRpb24ubWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuZmlsdGVyKChtc2c6IGFueSkgPT4gTnVtYmVyKG1zZy5wYWdlKSAhPT0gTnVtYmVyKG1lc3NhZ2VJbmRleCkpO1xuXG4gICAgLy8gUGVyc2lzdCBsb2NhbCBjaGFuZ2VcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuXG4gICAgLy8gQXR0ZW1wdCByZW1vdGUgZGVsZXRlIG9ubHkgZm9yIHByaXZhdGUgY29udmVyc2F0aW9ucyBhbmQgd2hlbiB0YXJnZXQgZXhpc3RzXG4gICAgaWYgKGNvbnZlcnNhdGlvblR5cGUgPT09ICdwcml2YXRlJyAmJiBwaG9uZU51bWJlcikge1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKHRhcmdldENpdGl6ZW5JZCkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U291cmNlID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZCh0YXJnZXRDaXRpemVuSWQpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldENvbnZlcnNhdGlvbiA9IHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIE51bWJlcihtc2cucGhvbmVOdW1iZXIpID09PSBOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Q29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcyA9IHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcy5maWx0ZXIoKG1zZzogYW55KSA9PiBOdW1iZXIobXNnLnBhZ2UpICE9PSBOdW1iZXIobWVzc2FnZUluZGV4KSk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB0YXJnZXRNZXNzYWdlcy5faWQgfSwgdGFyZ2V0TWVzc2FnZXMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXdhaXQgRG9lc1BsYXllckV4aXN0KHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lX21lc3NhZ2VzOmNsaWVudDp1cGRhdGVNZXNzYWdlcycsIE51bWJlcih0YXJnZXRTb3VyY2UpLCBKU09OLnN0cmluZ2lmeSh0YXJnZXRNZXNzYWdlcykpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZW1pdE5ldCgncGhvbmVfbWVzc2FnZXM6Y2xpZW50OnVwZGF0ZU1lc3NhZ2VzJywgTnVtYmVyKGNsaWVudCksIEpTT04uc3RyaW5naWZ5KHVzZXJNZXNzYWdlcykpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWVzc2FnZXMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBNZXNzYWdlIGRlbGV0ZWQgZnJvbSAke2NvbnZlcnNhdGlvblR5cGV9IGNvbnZlcnNhdGlvbiB3aXRoICR7cGhvbmVOdW1iZXIgfHwgZ3JvdXBJZH0gYnkgJHtzZW5kZXJQaG9uZU51bWJlcn1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnVwZGF0ZUdyb3VwTmFtZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgZ3JvdXBJZCwgbmV3TmFtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICAgICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVzc2FnZXMgbm90IGZvdW5kIGZvciBzZW5kZXInIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcsIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXApIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChncm91cC5jcmVhdG9ySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ09ubHkgdGhlIGdyb3VwIGNyZWF0b3IgY2FuIHVwZGF0ZSB0aGUgZ3JvdXAgbmFtZScgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2xkTmFtZSA9IGdyb3VwLm5hbWU7XG4gICAgICAgIGdyb3VwLm5hbWUgPSBuZXdOYW1lO1xuXG4gICAgICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycyB8fCBbXSkge1xuICAgICAgICAgICAgY29uc3QgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICAgICAgaWYgKG1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVtYmVyR3JvdXAgPSBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICAgICAgaWYgKG1lbWJlckdyb3VwKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLm5hbWUgPSBuZXdOYW1lO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogbWVtYmVyTWVzc2FnZXMuX2lkIH0sIG1lbWJlck1lc3NhZ2VzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLyogLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgbmFtZSBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCkpICovXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgZ3JvdXAgbmFtZSBmb3IgbWVtYmVyICR7bWVtYmVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBHcm91cCBub3QgZm91bmQgaW4gbWVtYmVyICR7bWVtYmVySWR9J3MgbWVzc2FnZXNgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gbWVzc2FnZXMgZm91bmQgZm9yIG1lbWJlciAke21lbWJlcklkfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKVxuICAgICAgICAgICAgLyogLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgbmFtZSBmb3Igc2VuZGVyICR7c2VuZGVySWR9YCkpICovXG4gICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgZ3JvdXAgbmFtZSBmb3Igc2VuZGVyICR7c2VuZGVySWR9OmAsIGVycm9yKSk7XG5cbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZ3JvdXBzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnR3JvdXAgTmFtZSBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBHcm91cCAke2dyb3VwSWR9IHwgJHtvbGROYW1lfSBuYW1lIHVwZGF0ZWQgdG8gJHtuZXdOYW1lfSBieSAke3NlbmRlclBob25lTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGRhdGluZyBncm91cCBuYW1lOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSB1cGRhdGluZyB0aGUgZ3JvdXAgbmFtZScgfSk7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6dXBkYXRlR3JvdXBBdmF0YXInLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGdyb3VwSWQsIG5ld0F2YXRhciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCB0aGUgc2VuZGVyJ3MgbWVzc2FnZXMgdG8gZmluZCB0aGUgZ3JvdXBcbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBjcmVhdG9ySWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWdyb3VwKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgc2VuZGVyIGlzIHRoZSBncm91cCBjcmVhdG9yIChhZG1pbilcbiAgICAgICAgaWYgKGdyb3VwLmNyZWF0b3JJZCAhPT0gc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnT25seSB0aGUgZ3JvdXAgY3JlYXRvciBjYW4gdXBkYXRlIHRoZSBncm91cCBhdmF0YXInIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBncm91cCBhdmF0YXIgZm9yIHRoZSBzZW5kZXJcbiAgICAgICAgZ3JvdXAuYXZhdGFyID0gbmV3QXZhdGFyO1xuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgZ3JvdXAgYXZhdGFyIGZvciBhbGwgbWVtYmVyc1xuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMgfHwgW10pIHtcbiAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgIGlmIChtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIGlmIChtZW1iZXJHcm91cCkge1xuICAgICAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5hdmF0YXIgPSBuZXdBdmF0YXI7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBhdmF0YXIgZm9yIG1lbWJlciAke21lbWJlcklkfWApKSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIGF2YXRhciBmb3IgbWVtYmVyICR7bWVtYmVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBHcm91cCBub3QgZm91bmQgaW4gbWVtYmVyICR7bWVtYmVySWR9J3MgbWVzc2FnZXNgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gbWVzc2FnZXMgZm91bmQgZm9yIG1lbWJlciAke21lbWJlcklkfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBzZW5kZXIncyBtZXNzYWdlc1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpXG4gICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBhdmF0YXIgZm9yIHNlbmRlciAke3NlbmRlcklkfWApKSAqL1xuICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIGF2YXRhciBmb3Igc2VuZGVyICR7c2VuZGVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ0dyb3VwIEF2YXRhciBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBHcm91cCAke2dyb3VwSWR9IGF2YXRhciB1cGRhdGVkIGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIGdyb3VwIGF2YXRhcjonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdXBkYXRpbmcgdGhlIGdyb3VwIGF2YXRhcicgfSk7XG4gICAgfVxufSk7IiwgImltcG9ydCB7IE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGxheWVyQ2FsbEhpc3Rvcnkge1xuICBjYWxsSWQ6IG51bWJlcjtcbiAgcm9sZTogXCJjYWxsZXJcIiB8IFwiY2FsbGVlXCI7XG4gIG15UGhvbmVOdW1iZXI6IHN0cmluZztcbiAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBzdHJpbmc7XG4gIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIgfCBcIm1pc3NlZFwiIHwgXCJkZWNsaW5lZFwiIHwgXCJjb21wbGV0ZWRcIjtcbiAgY2FsbFRpbWU6IG51bWJlcjtcbiAgY2FsbFRpbWVzdGFtcDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgQ2FsbEhpc3RvcnlNYW5hZ2VyIHtcbiAgYXN5bmMgcmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShcbiAgICBjYWxsOiB7XG4gICAgICBjYWxsSWQ6IG51bWJlcjtcbiAgICAgIGhvc3Q6IHsgY2l0aXplbklkOiBzdHJpbmc7IHBob25lTnVtYmVyOiBzdHJpbmcgfTtcbiAgICAgIHBhcnRpY2lwYW50czogTWFwPG51bWJlciwgeyBjaXRpemVuSWQ6IHN0cmluZzsgcGhvbmVOdW1iZXI6IHN0cmluZzsgb25Ib2xkOiBib29sZWFuIH0+O1xuICAgICAgc3RhcnRUaW1lOiBEYXRlO1xuICAgIH0sXG4gICAgY2FsbGVyU3RhdHVzOiBcInVuYW5zd2VyZWRcIiB8IFwiZGVjbGluZWRcIiB8IFwiY29tcGxldGVkXCIsXG4gICAgY2FsbGVlU3RhdHVzOiBcIm1pc3NlZFwiIHwgXCJkZWNsaW5lZFwiIHwgXCJjb21wbGV0ZWRcIixcbiAgICBlbmRUaW1lOiBEYXRlLFxuICAgIHRhcmdldFBob25lTnVtYmVyPzogc3RyaW5nXG4gICkge1xuICAgIGNvbnN0IGNhbGxUaW1lID0gKGVuZFRpbWUuZ2V0VGltZSgpIC0gY2FsbC5zdGFydFRpbWUuZ2V0VGltZSgpKSAvIDEwMDA7XG4gICAgY29uc3QgdGltZXN0YW1wID0gZW5kVGltZS50b0lTT1N0cmluZygpO1xuXG4gICAgLy8gRmlsdGVyIG91dCB0aGUgaG9zdCBmcm9tIHBhcnRpY2lwYW50cyB0byB0cnkgdG8gZ2V0IHRoZSBjYWxsZWUuXG4gICAgY29uc3QgY2FsbGVlQXJyYXkgPSBBcnJheS5mcm9tKGNhbGwucGFydGljaXBhbnRzLnZhbHVlcygpKS5maWx0ZXIoXG4gICAgICAocGFydGljaXBhbnQpID0+IHBhcnRpY2lwYW50LnBob25lTnVtYmVyICE9PSBjYWxsLmhvc3QucGhvbmVOdW1iZXJcbiAgICApO1xuXG4gICAgbGV0IGNhbGxlZVBob25lOiBzdHJpbmc7XG4gICAgaWYgKGNhbGxlZUFycmF5Lmxlbmd0aCA8IDEpIHtcbiAgICAgIC8vIElmIHRoZSBjYWxsZWUgbmV2ZXIgam9pbmVkLCB1c2UgdGhlIHBhc3NlZCB0YXJnZXRQaG9uZU51bWJlci5cbiAgICAgIGlmICh0YXJnZXRQaG9uZU51bWJlcikge1xuICAgICAgICBjYWxsZWVQaG9uZSA9IHRhcmdldFBob25lTnVtYmVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIk5vIGNhbGxlZSBmb3VuZCBmb3IgdHdvLXBhcnR5IGNhbGwgYWZ0ZXIgZmlsdGVyaW5nIG91dCBob3N0XCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxlZVBob25lID0gY2FsbGVlQXJyYXlbMF0ucGhvbmVOdW1iZXI7XG4gICAgfVxuXG4gICAgY29uc3QgY2FsbGVyUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogY2FsbC5jYWxsSWQsXG4gICAgICByb2xlOiBcImNhbGxlclwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogY2FsbC5ob3N0LnBob25lTnVtYmVyLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBjYWxsZWVQaG9uZSxcbiAgICAgIHN0YXR1czogY2FsbGVyU3RhdHVzLFxuICAgICAgY2FsbFRpbWUsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcblxuICAgIGNvbnN0IGNhbGxlZVJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IGNhbGwuY2FsbElkLFxuICAgICAgcm9sZTogXCJjYWxsZWVcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IGNhbGxlZVBob25lLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBjYWxsLmhvc3QucGhvbmVOdW1iZXIsXG4gICAgICBzdGF0dXM6IGNhbGxlZVN0YXR1cyxcbiAgICAgIGNhbGxUaW1lLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVyUmVjb3JkKTtcbiAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlZVJlY29yZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcmVjb3JkIHR3by1wYXJ0eSBjYWxsIGhpc3Rvcnk6XCIsIGVycm9yKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRQbGF5ZXJDYWxsSGlzdG9yeShwaG9uZU51bWJlcjogc3RyaW5nLCBtYXhSZWNvcmRzOiBudW1iZXIpOiBQcm9taXNlPFBsYXllckNhbGxIaXN0b3J5W10+IHtcbiAgICBjb25zdCBxdWVyeSA9IHsgbXlQaG9uZU51bWJlcjogcGhvbmVOdW1iZXIgfTtcbiAgICBjb25zdCBvcHRpb25zID0geyBzb3J0OiB7IF9pZDogLTEgfSwgbGltaXQ6IG1heFJlY29yZHMgfTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwiY2FsbF9oaXN0b3J5XCIsIHF1ZXJ5LCAoKSA9PiB7IH0sIGZhbHNlLCBvcHRpb25zKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciByZXRyaWV2aW5nIGNhbGwgaGlzdG9yeSBmb3IgcGhvbmUgbnVtYmVyOlwiLCBwaG9uZU51bWJlciwgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgY2FsbEhpc3RvcnlNYW5hZ2VyID0gbmV3IENhbGxIaXN0b3J5TWFuYWdlcigpO1xuIiwgImltcG9ydCB7IGNhbGxIaXN0b3J5TWFuYWdlciB9IGZyb20gXCIuL2NhbGxIaXN0b3J5TWFuYWdlclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhbGxQYXJ0aWNpcGFudCB7XG4gICAgc291cmNlOiBudW1iZXI7XG4gICAgY2l0aXplbklkOiBzdHJpbmc7XG4gICAgcGhvbmVOdW1iZXI6IHN0cmluZztcbiAgICBvbkhvbGQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT25nb2luZ0NhbGwge1xuICAgIGNhbGxJZDogbnVtYmVyO1xuICAgIGhvc3Q6IENhbGxQYXJ0aWNpcGFudDtcbiAgICBwYXJ0aWNpcGFudHM6IE1hcDxudW1iZXIsIENhbGxQYXJ0aWNpcGFudD47XG4gICAgcGVuZGluZzogTWFwPG51bWJlciwgTm9kZUpTLlRpbWVvdXQ+O1xuICAgIHN0YXJ0VGltZTogRGF0ZTtcbn1cblxuY2xhc3MgQ2FsbE1hbmFnZXIge1xuICAgIHByaXZhdGUgY2FsbHMgPSBuZXcgTWFwPG51bWJlciwgT25nb2luZ0NhbGw+KCk7XG4gICAgcHJpdmF0ZSBwbGF5ZXJDYWxsTWFwID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcbiAgICBwcml2YXRlIHJpbmdUb25lTWFuZ2VyID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcblxuICAgIHB1YmxpYyBjcmVhdGVDYWxsKGhvc3Q6IENhbGxQYXJ0aWNpcGFudCk6IG51bWJlciB7XG4gICAgICAgIGNvbnN0IGNhbGxJZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApO1xuICAgICAgICBjb25zdCBuZXdDYWxsOiBPbmdvaW5nQ2FsbCA9IHtcbiAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgIGhvc3QsXG4gICAgICAgICAgICBwYXJ0aWNpcGFudHM6IG5ldyBNYXA8bnVtYmVyLCBDYWxsUGFydGljaXBhbnQ+KCksXG4gICAgICAgICAgICBwZW5kaW5nOiBuZXcgTWFwPG51bWJlciwgTm9kZUpTLlRpbWVvdXQ+KCksXG4gICAgICAgICAgICBzdGFydFRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIH07XG4gICAgICAgIG5ld0NhbGwucGFydGljaXBhbnRzLnNldChob3N0LnNvdXJjZSwgaG9zdCk7XG4gICAgICAgIHRoaXMuY2FsbHMuc2V0KGNhbGxJZCwgbmV3Q2FsbCk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5zZXQoaG9zdC5zb3VyY2UsIGNhbGxJZCk7XG4gICAgICAgIHJldHVybiBjYWxsSWQ7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRDYWxsSG9zdChjYWxsSWQ6IG51bWJlcik6IENhbGxQYXJ0aWNpcGFudCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgcmV0dXJuIGNhbGwuaG9zdDtcbiAgICB9XG4gICAgcHVibGljIGlzUGxheWVySW5DYWxsKHNvdXJjZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXllckNhbGxNYXAuaGFzKHNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRDYWxsQnlQbGF5ZXIoc291cmNlOiBudW1iZXIpOiBPbmdvaW5nQ2FsbCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGNhbGxJZCA9IHRoaXMucGxheWVyQ2FsbE1hcC5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKGNhbGxJZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcHVibGljIGdldENhbGxJZEJ5UGxheWVyKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXllckNhbGxNYXAuZ2V0KHNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBhZGRQZW5kaW5nSW52aXRhdGlvbihcbiAgICAgICAgY2FsbElkOiBudW1iZXIsXG4gICAgICAgIHRhcmdldFNvdXJjZTogbnVtYmVyLFxuICAgICAgICB0aW1lb3V0Q2FsbGJhY2s6ICgpID0+IHZvaWQsXG4gICAgICAgIHRpbWVvdXRNczogbnVtYmVyID0gMzAwMDBcbiAgICApIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuO1xuICAgICAgICBpZiAoY2FsbC5wZW5kaW5nLmhhcyh0YXJnZXRTb3VyY2UpIHx8IGNhbGwucGFydGljaXBhbnRzLmhhcyh0YXJnZXRTb3VyY2UpKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRpbWVvdXRDYWxsYmFjaygpO1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSk7XG4gICAgICAgIH0sIHRpbWVvdXRNcyk7XG4gICAgICAgIGNhbGwucGVuZGluZy5zZXQodGFyZ2V0U291cmNlLCB0aW1lb3V0KTtcbiAgICB9XG4gICAgcHVibGljIHJlbW92ZVBlbmRpbmdJbnZpdGF0aW9uKGNhbGxJZDogbnVtYmVyLCB0YXJnZXRTb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm47XG4gICAgICAgIGlmIChjYWxsLnBlbmRpbmcuaGFzKHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjYWxsLnBlbmRpbmcuZ2V0KHRhcmdldFNvdXJjZSkpO1xuICAgICAgICAgICAgY2FsbC5wZW5kaW5nLmRlbGV0ZSh0YXJnZXRTb3VyY2UpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHB1YmxpYyBhY2NlcHRJbnZpdGF0aW9uKGNhbGxJZDogbnVtYmVyLCBwYXJ0aWNpcGFudDogQ2FsbFBhcnRpY2lwYW50KTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKGNhbGwucGFydGljaXBhbnRzLmhhcyhwYXJ0aWNpcGFudC5zb3VyY2UpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNhbGwucGFydGljaXBhbnRzLnNldChwYXJ0aWNpcGFudC5zb3VyY2UsIHBhcnRpY2lwYW50KTtcbiAgICAgICAgdGhpcy5wbGF5ZXJDYWxsTWFwLnNldChwYXJ0aWNpcGFudC5zb3VyY2UsIGNhbGxJZCk7XG4gICAgICAgIGlmIChjYWxsLnBlbmRpbmcuaGFzKHBhcnRpY2lwYW50LnNvdXJjZSkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjYWxsLnBlbmRpbmcuZ2V0KHBhcnRpY2lwYW50LnNvdXJjZSkpO1xuICAgICAgICAgICAgY2FsbC5wZW5kaW5nLmRlbGV0ZShwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBwdWJsaWMgZGVjbGluZUludml0YXRpb24oY2FsbElkOiBudW1iZXIsIHRhcmdldFNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICAgIH1cbiAgICBwdWJsaWMgYXN5bmMgcmVtb3ZlUGFydGljaXBhbnQoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcblxuICAgICAgICAvLyBORVc6IEVuZCBhbmltYXRpb24gZm9yIHRoZSBsZWF2aW5nIHBhcnRpY2lwYW50XG4gICAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBzb3VyY2UpO1xuXG4gICAgICAgIGNhbGwucGFydGljaXBhbnRzLmRlbGV0ZShzb3VyY2UpO1xuICAgICAgICB0aGlzLnBsYXllckNhbGxNYXAuZGVsZXRlKHNvdXJjZSk7XG4gICAgICAgIGlmIChzb3VyY2UgPT09IGNhbGwuaG9zdC5zb3VyY2UgfHwgY2FsbC5wYXJ0aWNpcGFudHMuc2l6ZSA8PSAxKSB7XG4gICAgICAgICAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpKTtcbiAgICAgICAgICAgIHRoaXMuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHB1YmxpYyBlbmRDYWxsKGNhbGxJZDogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcblxuICAgICAgICAvLyBORVc6IEVuZCBhbmltYXRpb25zIGZvciBhbGwgcGFydGljaXBhbnRzXG4gICAgICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCB0aW1lb3V0IG9mIGNhbGwucGVuZGluZy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5kZWxldGUocGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNhbGxzLmRlbGV0ZShjYWxsSWQpO1xuICAgIH1cbiAgICBwdWJsaWMgcmVtb3ZlRnJvbUNhbGwoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgY2FsbC5wYXJ0aWNpcGFudHMuZGVsZXRlKHNvdXJjZSk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5kZWxldGUoc291cmNlKTtcbiAgICB9XG4gICAgcHVibGljIHNldEhvbGRTdGF0dXMoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyLCBob2xkOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgcGFydGljaXBhbnQgPSBjYWxsLnBhcnRpY2lwYW50cy5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKCFwYXJ0aWNpcGFudCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBwYXJ0aWNpcGFudC5vbkhvbGQgPSBob2xkO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcHVibGljIGdldFBhcnRpY2lwYW50cyhjYWxsSWQ6IG51bWJlcik6IENhbGxQYXJ0aWNpcGFudFtdIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuIFtdO1xuICAgICAgICByZXR1cm4gQXJyYXkuZnJvbShjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSk7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRBbGxDYWxscygpOiBJdGVyYWJsZUl0ZXJhdG9yPE9uZ29pbmdDYWxsPiB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhbGxzLnZhbHVlcygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBjcmVhdGVSaW5nVG9uZShzb3VyY2U6IGFueSwgcmluZ3RvbmVMaW5rOiBzdHJpbmcsIHZvbHVtZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHBlZCA9IEdldFBsYXllclBlZChzb3VyY2UpO1xuICAgICAgICBjb25zdCBwZWRJZCA9IE5ldHdvcmtHZXROZXR3b3JrSWRGcm9tRW50aXR5KHBlZCk7XG4gICAgICAgIGNvbnN0IHNvdW5kSWQgPSBhd2FpdCBleHBvcnRzWydzb3VuZGhhbmRsZXInXS5TdGFydEF0dGFjaFNvdW5kKHJpbmd0b25lTGluaywgcGVkSWQsIDUsIEdldEdhbWVUaW1lcigpLCB0cnVlLCAwLjE1KTtcbiAgICAgICAgdGhpcy5yaW5nVG9uZU1hbmdlci5zZXQoc291cmNlLCBzb3VuZElkKTtcbiAgICB9XG4gICAgcHVibGljIGFzeW5jIHN0b3BSaW5nVG9uZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBzb3VuZElkID0gdGhpcy5yaW5nVG9uZU1hbmdlci5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKCFzb3VuZElkKSByZXR1cm47XG4gICAgICAgIGV4cG9ydHNbJ3NvdW5kaGFuZGxlciddLlN0b3BTb3VuZChzb3VuZElkKTtcbiAgICAgICAgdGhpcy5yaW5nVG9uZU1hbmdlci5kZWxldGUoc291cmNlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBjYWxsTWFuYWdlciA9IG5ldyBDYWxsTWFuYWdlcigpOyIsICJpbXBvcnQgeyBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbmNsYXNzIFNldHRpbmcge1xuICAgIHB1YmxpYyBfaWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyBiYWNrZ3JvdW5kID0gbmV3IE1hcDxzdHJpbmcsIHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9PigpO1xuICAgIHB1YmxpYyBsb2Nrc2NyZWVuID0gbmV3IE1hcDxzdHJpbmcsIHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9PigpO1xuICAgIHB1YmxpYyByaW5ndG9uZSA9IG5ldyBNYXA8c3RyaW5nLCB7IGN1cnJlbnQ6IHN0cmluZzsgcmluZ3RvbmVzOiB7IG5hbWU6IHN0cmluZywgdXJsOiBzdHJpbmcgfVtdIH0+KCk7XG4gICAgcHVibGljIHNob3dTdGFydHVwU2NyZWVuID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHNob3dOb3RpZmljYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIGlzTG9jayA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBsb2NrUGluID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgdXNlUGluID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHVzZUZhY2VJZCA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBmYWNlSWRJZGVudGlmaWVyID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgc21ydElkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgc21ydFBhc3N3b3JkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgaXNGbGlnaHRNb2RlID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHBob25lTnVtYmVyID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgZGFya01haWxJZEF0dGFjaGVkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgcGlnZW9uSWRBdHRhY2hlZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgLy8gTm8gYXV0b21hdGljIGNsZWFudXAgLSBvbmx5IHJlbW92ZSBvbiBwbGF5ZXIgZGlzY29ubmVjdFxuXG4gICAgcHJpdmF0ZSBzZWVkRnJvbURvYyhkb2M6IGFueSkge1xuICAgICAgICBpZiAoIWRvYz8uX2lkKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGlkID0gZG9jLl9pZDtcbiAgICAgICAgdGhpcy5faWQuc2V0KGlkLCBpZCk7XG4gICAgICAgIHRoaXMuYmFja2dyb3VuZC5zZXQoaWQsIGRvYy5iYWNrZ3JvdW5kID8/IHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0pO1xuICAgICAgICB0aGlzLmxvY2tzY3JlZW4uc2V0KGlkLCBkb2MubG9ja3NjcmVlbiA/PyB7IGN1cnJlbnQ6ICcnLCB3YWxscGFwZXJzOiBbXSB9KTtcbiAgICAgICAgdGhpcy5yaW5ndG9uZS5zZXQoaWQsIGRvYy5yaW5ndG9uZSA/PyB7IGN1cnJlbnQ6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJywgcmluZ3RvbmVzOiBbeyBuYW1lOiAnZGVmYXVsdCcsIHVybDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnIH1dIH0pO1xuICAgICAgICB0aGlzLnNob3dTdGFydHVwU2NyZWVuLnNldChpZCwgZG9jLnNob3dTdGFydHVwU2NyZWVuID8/IHRydWUpO1xuICAgICAgICB0aGlzLnNob3dOb3RpZmljYXRpb25zLnNldChpZCwgZG9jLnNob3dOb3RpZmljYXRpb25zID8/IHRydWUpO1xuICAgICAgICB0aGlzLmlzTG9jay5zZXQoaWQsIGRvYy5pc0xvY2sgPz8gdHJ1ZSk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5zZXQoaWQsIGRvYy5sb2NrUGluID8/ICcnKTtcbiAgICAgICAgdGhpcy51c2VQaW4uc2V0KGlkLCBkb2MudXNlUGluID8/IGZhbHNlKTtcbiAgICAgICAgdGhpcy51c2VGYWNlSWQuc2V0KGlkLCBkb2MudXNlRmFjZUlkID8/IGZhbHNlKTtcbiAgICAgICAgdGhpcy5mYWNlSWRJZGVudGlmaWVyLnNldChpZCwgZG9jLmZhY2VJZElkZW50aWZpZXIgPz8gaWQpO1xuICAgICAgICB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5zZXQoaWQsIGRvYy5kYXJrTWFpbElkQXR0YWNoZWQgPz8gJycpO1xuICAgICAgICB0aGlzLnNtcnRJZC5zZXQoaWQsIGRvYy5zbXJ0SWQgPz8gJycpO1xuICAgICAgICB0aGlzLnNtcnRQYXNzd29yZC5zZXQoaWQsIGRvYy5zbXJ0UGFzc3dvcmQgPz8gJycpO1xuICAgICAgICB0aGlzLmlzRmxpZ2h0TW9kZS5zZXQoaWQsIGRvYy5pc0ZsaWdodE1vZGUgPz8gZmFsc2UpO1xuICAgICAgICB0aGlzLnBob25lTnVtYmVyLnNldChpZCwgZG9jLnBob25lTnVtYmVyID8/ICcnKTtcbiAgICAgICAgdGhpcy5waWdlb25JZEF0dGFjaGVkLnNldChpZCwgZG9jLnBpZ2VvbklkQXR0YWNoZWQgPz8gJycpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBlbnN1cmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5faWQuaGFzKGNpdGl6ZW5JZCkpIHJldHVybjtcblxuICAgICAgICBjb25zdCBkb2MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmU/LigncGhvbmVfc2V0dGluZ3MnLCB7IF9pZDogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgICB0aGlzLnNlZWRGcm9tRG9jKGRvYyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLlJlZ2lzdGVyTmV3U2V0dGluZ3MoY2l0aXplbklkLCBcIlwiKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmU/LigncGhvbmVfc2V0dGluZ3MnLCB7XG4gICAgICAgICAgICBfaWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRoaXMuYmFja2dyb3VuZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGxvY2tzY3JlZW46IHRoaXMubG9ja3NjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHJpbmd0b25lOiB0aGlzLnJpbmd0b25lLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGlzTG9jazogdGhpcy5pc0xvY2suZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBsb2NrUGluOiB0aGlzLmxvY2tQaW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICB1c2VQaW46IHRoaXMudXNlUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgdXNlRmFjZUlkOiB0aGlzLnVzZUZhY2VJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IHRoaXMuZmFjZUlkSWRlbnRpZmllci5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBzbXJ0SWQ6IHRoaXMuc21ydElkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgc21ydFBhc3N3b3JkOiB0aGlzLnNtcnRQYXNzd29yZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogdGhpcy5pc0ZsaWdodE1vZGUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBwaG9uZU51bWJlcjogdGhpcy5waG9uZU51bWJlci5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IHRoaXMucGlnZW9uSWRBdHRhY2hlZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGxvYWQoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBNeVNRTCBBZGFwdGVyIGxvZ2ljXG4gICAgICAgICAgICBjb25zdCByZXM6IGFueSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX3NldHRpbmdzJywge30pO1xuICAgICAgICAgICAgZm9yIChjb25zdCBkYXRhIG9mIHJlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2VlZEZyb21Eb2MoZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gTG9hZGVkLmApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gRmFpbGVkIHRvIGxvYWQgc2V0dGluZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzYXZlKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdGhpcy5faWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IF9pZDoga2V5IH0sIHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBrZXksXG4gICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRoaXMuYmFja2dyb3VuZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgbG9ja3NjcmVlbjogdGhpcy5sb2Nrc2NyZWVuLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICByaW5ndG9uZTogdGhpcy5yaW5ndG9uZS5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0aGlzLnNob3dOb3RpZmljYXRpb25zLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBpc0xvY2s6IHRoaXMuaXNMb2NrLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBsb2NrUGluOiB0aGlzLmxvY2tQaW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHVzZVBpbjogdGhpcy51c2VQaW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHVzZUZhY2VJZDogdGhpcy51c2VGYWNlSWQuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IHRoaXMuZmFjZUlkSWRlbnRpZmllci5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc21ydElkOiB0aGlzLnNtcnRJZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc21ydFBhc3N3b3JkOiB0aGlzLnNtcnRQYXNzd29yZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgaXNGbGlnaHRNb2RlOiB0aGlzLmlzRmxpZ2h0TW9kZS5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHRoaXMucGhvbmVOdW1iZXIuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IHRoaXMucGlnZW9uSWRBdHRhY2hlZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBTYXZlZCBzdWNjZXNzZnVsbHkuYCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIEZhaWxlZCB0byBzYXZlIHNldHRpbmdzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgUmVnaXN0ZXJOZXdTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZywgbnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5faWQuc2V0KGNpdGl6ZW5JZCwgY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnNldChjaXRpemVuSWQsIHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0pO1xuICAgICAgICB0aGlzLmxvY2tzY3JlZW4uc2V0KGNpdGl6ZW5JZCwgeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSk7XG4gICAgICAgIHRoaXMucmluZ3RvbmUuc2V0KGNpdGl6ZW5JZCwgeyBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsIHJpbmd0b25lczogW3sgbmFtZTogJ2RlZmF1bHQnLCB1cmw6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyB9XSB9KTtcbiAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5zZXQoY2l0aXplbklkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5zZXQoY2l0aXplbklkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5pc0xvY2suc2V0KGNpdGl6ZW5JZCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMudXNlUGluLnNldChjaXRpemVuSWQsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5waG9uZU51bWJlci5zZXQoY2l0aXplbklkLCBudW1iZXIpO1xuICAgICAgICB0aGlzLnVzZUZhY2VJZC5zZXQoY2l0aXplbklkLCBmYWxzZSk7XG4gICAgICAgIHRoaXMuZmFjZUlkSWRlbnRpZmllci5zZXQoY2l0aXplbklkLCBjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMuc21ydElkLnNldChjaXRpemVuSWQsICcnKTtcbiAgICAgICAgdGhpcy5zbXJ0UGFzc3dvcmQuc2V0KGNpdGl6ZW5JZCwgJycpO1xuICAgICAgICB0aGlzLmlzRmxpZ2h0TW9kZS5zZXQoY2l0aXplbklkLCBmYWxzZSk7XG4gICAgICAgIHRoaXMucGlnZW9uSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIFNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5lbnN1cmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9LCB7XG4gICAgICAgICAgICAgICAgX2lkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdGhpcy5iYWNrZ3JvdW5kLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGxvY2tzY3JlZW46IHRoaXMubG9ja3NjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICByaW5ndG9uZTogdGhpcy5yaW5ndG9uZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBpc0xvY2s6IHRoaXMuaXNMb2NrLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGxvY2tQaW46IHRoaXMubG9ja1Bpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICB1c2VQaW46IHRoaXMudXNlUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHVzZUZhY2VJZDogdGhpcy51c2VGYWNlSWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogdGhpcy5mYWNlSWRJZGVudGlmaWVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgc21ydElkOiB0aGlzLnNtcnRJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6IHRoaXMuc21ydFBhc3N3b3JkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogdGhpcy5pc0ZsaWdodE1vZGUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHRoaXMucGhvbmVOdW1iZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogdGhpcy5waWdlb25JZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgcGxheWVyIHNldHRpbmdzIGZvciAke2NpdGl6ZW5JZH0gc3VjY2Vzc2Z1bGx5LmApO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBGYWlsZWQgdG8gc2F2ZSBwbGF5ZXIgc2V0dGluZ3MgZm9yICR7Y2l0aXplbklkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIHBsYXllciBkYXRhIG9ubHkgd2hlbiBwbGF5ZXIgZGlzY29ubmVjdHNcbiAgICBwdWJsaWMgb25QbGF5ZXJEaXNjb25uZWN0KGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGxheWVyRGF0YShjaXRpemVuSWQpO1xuICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gQ2xlYW5lZCB1cCBkYXRhIGZvciBkaXNjb25uZWN0ZWQgcGxheWVyICR7Y2l0aXplbklkfWApO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBwbGF5ZXIgZGF0YSBmcm9tIGFsbCBtYXBzXG4gICAgcHJpdmF0ZSByZW1vdmVQbGF5ZXJEYXRhKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuX2lkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmJhY2tncm91bmQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMubG9ja3NjcmVlbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5yaW5ndG9uZS5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5pc0xvY2suZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy51c2VQaW4uZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMudXNlRmFjZUlkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmZhY2VJZElkZW50aWZpZXIuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuc21ydElkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnNtcnRQYXNzd29yZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5pc0ZsaWdodE1vZGUuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMucGhvbmVOdW1iZXIuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuZGFya01haWxJZEF0dGFjaGVkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnBpZ2VvbklkQXR0YWNoZWQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgfVxuXG4gICAgLy8gUHVibGljIG1ldGhvZCB0byBtYW51YWxseSBjbGVhbiB1cCBhIHNwZWNpZmljIHBsYXllciAoZm9yIGFkbWluIGNvbW1hbmRzKVxuICAgIHB1YmxpYyBjbGVhbnVwUGxheWVyKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGxheWVyRGF0YShjaXRpemVuSWQpO1xuICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gTWFudWFsbHkgY2xlYW5lZCB1cCBkYXRhIGZvciBwbGF5ZXIgJHtjaXRpemVuSWR9YCk7XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgU2V0dGluZ3MgPSBuZXcgU2V0dGluZygpO1xuIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IGNhbGxNYW5hZ2VyIH0gZnJvbSBcIi4vQ2FsbE1hbmFnZXJcIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgUGhvbmVDb250YWN0cyB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgY2FsbEhpc3RvcnlNYW5hZ2VyLCBQbGF5ZXJDYWxsSGlzdG9yeSB9IGZyb20gXCIuL2NhbGxIaXN0b3J5TWFuYWdlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vU2V0dGluZ3MvY2xhc3NcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIlxuXG5vbkNsaWVudENhbGxiYWNrKFwic3VtbWl0X3Bob25lOnNlcnZlcjpjYWxsXCIsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHsgbnVtYmVyLCBfaWQsIHZvbHVtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyRnJvbVBob25lTnVtYmVyKG51bWJlcik7XG4gIGNvbnN0IHRhcmdldERhdGE6IFBob25lQ29udGFjdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBjb250YWN0TnVtYmVyOiBudW1iZXIsIHBlcnNvbmFsTnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSkgfSk7XG5cbiAgY29uc3Qgc291cmNlRGF0YTogUGhvbmVDb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7XG4gICAgY29udGFjdE51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpLFxuICAgIHBlcnNvbmFsTnVtYmVyOiBudW1iZXJcbiAgfSk7XG5cbiAgaWYgKCF0YXJnZXRQbGF5ZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgY29uc3QgY2FsbGVyUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCksXG4gICAgICByb2xlOiBcImNhbGxlclwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICBzdGF0dXM6IFwidW5hbnN3ZXJlZFwiLFxuICAgICAgY2FsbFRpbWU6IDAsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcblxuICAgIGNvbnN0IGNhbGxlZVJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApLFxuICAgICAgcm9sZTogXCJjYWxsZWVcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgIG90aGVyUGFydHlQaG9uZU51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpLFxuICAgICAgc3RhdHVzOiBcIm1pc3NlZFwiLFxuICAgICAgY2FsbFRpbWU6IDAsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZXJSZWNvcmQpO1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlZVJlY29yZCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgdGFyZ2V0U291cmNlID0gdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlO1xuXG4gIGlmIChjYWxsTWFuYWdlci5pc1BsYXllckluQ2FsbChzb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBhcmUgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGNhbGxNYW5hZ2VyLmlzUGxheWVySW5DYWxsKHRhcmdldFNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBCdXN5XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJUYXJnZXQgaXMgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3Qgc291cmNlUGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldFBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgSXNOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHRhcmdldFBob25lLCBzb3VyY2VQaG9uZSk7XG4gIGNvbnN0IHNvdXJjZUZsaWdodE1vZGUgPSBhd2FpdCBVdGlscy5JbkZsaWdodE1vZGUoc291cmNlQ2l0aXplbklkKTtcbiAgY29uc3QgdGFyZ2V0RmxpZ2h0TW9kZSA9IGF3YWl0IFV0aWxzLkluRmxpZ2h0TW9kZSh0YXJnZXRDaXRpemVuSWQpO1xuICBpZiAoc291cmNlRmxpZ2h0TW9kZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJGbGlnaHQgTW9kZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IGNhbm5vdCBtYWtlIGNhbGxzIHdoaWxlIGluIGZsaWdodCBtb2RlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSBlbHNlIGlmICh0YXJnZXRGbGlnaHRNb2RlKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIHVucmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoSXNOdW1iZXJCbG9ja2VkKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IFNob3VyY2VOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHNvdXJjZVBob25lLCB0YXJnZXRQaG9uZSk7XG4gIGlmIChTaG91cmNlTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJOdW1iZXIgQmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiVW5ibG9jayB0aGUgbnVtYmVyIHRvIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHRhcmdldEhhc1Bob25lID0gYXdhaXQgVXRpbHMuSGFzUGhvbmUodGFyZ2V0U291cmNlKTtcbiAgaWYgKCF0YXJnZXRIYXNQaG9uZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuXG4gICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgIGNvbnN0IGNhbGxlclJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApLFxuICAgICAgcm9sZTogXCJjYWxsZXJcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiB0YXJnZXRQaG9uZSxcbiAgICAgIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuXG4gICAgY29uc3QgY2FsbGVlUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCksXG4gICAgICByb2xlOiBcImNhbGxlZVwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogdGFyZ2V0UGhvbmUsXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgICAgc3RhdHVzOiBcIm1pc3NlZFwiLFxuICAgICAgY2FsbFRpbWU6IDAsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZXJSZWNvcmQpO1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlZVJlY29yZCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IGhvc3RQYXJ0aWNpcGFudCA9IHtcbiAgICBzb3VyY2UsXG4gICAgY2l0aXplbklkOiBzb3VyY2VDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgY2FsbElkID0gY2FsbE1hbmFnZXIuY3JlYXRlQ2FsbChob3N0UGFydGljaXBhbnQpO1xuXG4gIGNhbGxNYW5hZ2VyLmNyZWF0ZVJpbmdUb25lKHRhcmdldFNvdXJjZSwgU3RyaW5nKFNldHRpbmdzLnJpbmd0b25lLmdldCh0YXJnZXRDaXRpemVuSWQpPy5jdXJyZW50KSwgdm9sdW1lKTtcbiAgY2FsbE1hbmFnZXIuYWRkUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UsICgpID0+IHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBUaW1lb3V0XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDYWxsIHdhcyBub3QgYW5zd2VyZWQgYnkgdGFyZ2V0XCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJNaXNzZWQgQ2FsbFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IG1pc3NlZCBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgICAgIGlmIChjYWxsKSB7XG4gICAgICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwidW5hbnN3ZXJlZFwiLCBcIm1pc3NlZFwiLCBuZXcgRGF0ZSgpLCB0YXJnZXRQaG9uZSk7XG4gICAgICB9XG4gICAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgICB9KSgpO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbCh0YXJnZXRTb3VyY2UsIDApO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgX2lkKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgc291cmNlKTtcbiAgfSwgMjAwMDApO1xuXG4gIGNvbnN0IHNvdXJjZU5hbWUgPSBzb3VyY2VEYXRhID8gYCR7c291cmNlRGF0YS5maXJzdE5hbWV9ICR7c291cmNlRGF0YS5sYXN0TmFtZX1gIDogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXROYW1lID0gdGFyZ2V0RGF0YSA/IGAke3RhcmdldERhdGEuZmlyc3ROYW1lfSAke3RhcmdldERhdGEubGFzdE5hbWV9YCA6IG51bWJlcjtcblxuICBlbWl0TmV0KFwicGhvbmU6YWRkQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGlkOiBfaWQsXG4gICAgdGl0bGU6IFwiSW5jb21pbmcgQ2FsbFwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHtzb3VyY2VOYW1lfSBpcyBjYWxsaW5nIHlvdWAsXG4gICAgYXBwOiBcInBob25lXCIsXG4gICAgaWNvbnM6IHtcbiAgICAgIFwiMFwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvY3Jvc3MtY2lyY2xlLnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgICAgXCIxXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9hY2NlcHQuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lOiB0YXJnZXROYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWU6IHNvdXJjZU5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9LFxuICB9KSk7XG5cbiAgLyogY29uc29sZS5sb2coc291cmNlLCBcIkNhbGxpbmdcIiwgdGFyZ2V0U291cmNlLCB0YXJnZXROYW1lLCBfaWQpOyAqL1xuICBlbWl0TmV0KFwic3VtbWl0X3Bob25lOnNlcnZlcjphZGRDYWxsaW5naW50ZXJmYWNlXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgdGFyZ2V0TmFtZSxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgfSkpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgIHRpdGxlOiAnQ2FsbCBJbml0aWF0ZWQnLFxuICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBob25lfSBpbml0aWF0ZWQgYSBjYWxsIHRvICR7dGFyZ2V0UGhvbmV9IChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbiAgcmV0dXJuIHRydWU7XG59KTtcblxub25OZXQoXCJzdW1taXRfcGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsIGFzeW5jIChkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZSBhcyBudW1iZXI7XG4gIGNvbnN0IHsgY2FsbElkLCB0YXJnZXRTb3VyY2UsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAvKiBjb25zb2xlLmxvZyhzb3VyY2UsIFwiRGVjbGluaW5nIGNhbGxcIiwgY2FsbElkLCB0YXJnZXRTb3VyY2UsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkKTsgKi9cbiAgY2FsbE1hbmFnZXIuZGVjbGluZUludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmIChjYWxsKSB7XG4gICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJkZWNsaW5lZFwiLCBcImRlY2xpbmVkXCIsIG5ldyBEYXRlKCkpO1xuICB9XG4gIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIGlmICghdGFyZ2V0U291cmNlIHx8ICFjYWxsZXJTb3VyY2UpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBkYXRhYmFzZVRhYmxlSWQpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ0NhbGwgRGVjbGluZWQnLFxuICAgIG1lc3NhZ2U6IGAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKX0gZGVjbGluZWQgdGhlIGNhbGwgZnJvbSAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmVuZENhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKCFjYWxsIHx8IGNhbGwuY2FsbElkICE9PSBjYWxsSWQpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgY2FsbEhvc3QgPSBjYWxsTWFuYWdlci5nZXRDYWxsSG9zdChjYWxsSWQpO1xuICBpZiAoY2FsbEhvc3QgJiYgY2FsbEhvc3Quc291cmNlID09PSBzb3VyY2UgfHwgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkubGVuZ3RoIDw9IDEpIHtcbiAgICBmb3IgKGNvbnN0IHBhcnRpY2lwYW50IG9mIGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpKSB7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjY3BldGVkQ2FsbGluZ0ludGVyZmFjZVwiLCBwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHBhcnRpY2lwYW50LnNvdXJjZSwgMCk7XG4gICAgfVxuICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiY29tcGxldGVkXCIsIFwiY29tcGxldGVkXCIsIG5ldyBEYXRlKCkpO1xuICAgIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgICB0aXRsZTogJ0NhbGwgRW5kZWQnLFxuICAgICAgbWVzc2FnZTogYENhbGwgZW5kZWQgYnkgJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSl9IChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAoY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkubGVuZ3RoID4gMikge1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWNjcGV0ZWRDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHNvdXJjZSwgMCk7XG4gICAgY2FsbE1hbmFnZXIucmVtb3ZlRnJvbUNhbGwoY2FsbElkLCBzb3VyY2UpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICAgIHRpdGxlOiAnUGFydGljaXBhbnQgTGVmdCBDYWxsJyxcbiAgICAgIG1lc3NhZ2U6IGAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKX0gbGVmdCB0aGUgY29uZmVyZW5jZSBjYWxsIChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY2NwZXRlZENhbGxpbmdJbnRlcmZhY2VcIiwgcGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChwYXJ0aWNpcGFudC5zb3VyY2UsIDApO1xuICAgIH1cbiAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpKTtcbiAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgICAgdGl0bGU6ICdDYWxsIEVuZGVkJyxcbiAgICAgIG1lc3NhZ2U6IGBDYWxsIGVuZGVkIGJ5ICR7YXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpfSAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICB9XG4gIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmFkZFBsYXllclRvQ2FsbFwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCB7IGNvbnRhY3ROdW1iZXIsIF9pZCwgdm9sdW1lIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCB0YXJnZXREYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkIH0pO1xuICBjb25zdCBzb3VyY2VEYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHtcbiAgICBjb250YWN0TnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgcGVyc29uYWxOdW1iZXI6IGNvbnRhY3ROdW1iZXJcbiAgfSk7XG4gIGNvbnN0IGNhbGxJZCA9IGNhbGxNYW5hZ2VyLmdldENhbGxJZEJ5UGxheWVyKHNvdXJjZSk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKCFjYWxsKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIk5vIG9uZ29pbmcgY2FsbCBmb3VuZFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3Qgc291cmNlUGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IFV0aWxzLkdldFBsYXllckZyb21QaG9uZU51bWJlcihjb250YWN0TnVtYmVyKTtcbiAgaWYgKCF0YXJnZXRQbGF5ZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGFkZCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB0YXJnZXRTb3VyY2UgPSB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2U7XG4gIGNvbnN0IElzTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChjb250YWN0TnVtYmVyLCBzb3VyY2VQaG9uZSk7XG4gIGNvbnN0IHNvdXJjZUNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihjb250YWN0TnVtYmVyKTtcbiAgY29uc3Qgc291cmNlRmxpZ2h0TW9kZSA9IGF3YWl0IFV0aWxzLkluRmxpZ2h0TW9kZShzb3VyY2VDaXRpemVuSWQpO1xuICBjb25zdCB0YXJnZXRGbGlnaHRNb2RlID0gYXdhaXQgVXRpbHMuSW5GbGlnaHRNb2RlKHRhcmdldENpdGl6ZW5JZCk7XG4gIGlmIChzb3VyY2VGbGlnaHRNb2RlKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkZsaWdodCBNb2RlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgY2Fubm90IG1ha2UgY2FsbHMgd2hpbGUgaW4gZmxpZ2h0IG1vZGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9IGVsc2UgaWYgKHRhcmdldEZsaWdodE1vZGUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgdW5yZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChJc051bWJlckJsb2NrZWQpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgU2hvdXJjZU51bWJlckJsb2NrZWQgPSBhd2FpdCBVdGlscy5Jc051bWJlckJsb2NrZWQoc291cmNlUGhvbmUsIGNvbnRhY3ROdW1iZXIpO1xuICBpZiAoU2hvdXJjZU51bWJlckJsb2NrZWQpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTnVtYmVyIEJsb2NrZWRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlVuYmxvY2sgdGhlIG51bWJlciB0byBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB0YXJnZXRIYXNQaG9uZSA9IGF3YWl0IFV0aWxzLkhhc1Bob25lKHRhcmdldFNvdXJjZSk7XG4gIGlmICghdGFyZ2V0SGFzUGhvbmUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGNhbGwucGFydGljaXBhbnRzLmhhcyh0YXJnZXRTb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkFscmVhZHkgaW4gQ2FsbFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGxheWVyIGlzIGFscmVhZHkgaW4gdGhlIGNhbGxcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNhbGxNYW5hZ2VyLmNyZWF0ZVJpbmdUb25lKHRhcmdldFNvdXJjZSwgU3RyaW5nKFNldHRpbmdzLnJpbmd0b25lLmdldCh0YXJnZXRDaXRpemVuSWQpPy5jdXJyZW50KSwgdm9sdW1lKTtcbiAgY2FsbE1hbmFnZXIuYWRkUGVuZGluZ0ludml0YXRpb24oTnVtYmVyKGNhbGxJZCksIHRhcmdldFNvdXJjZSwgKCkgPT4ge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIFRpbWVvdXRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBsYXllciBkaWQgbm90IGFuc3dlciBjb25mZXJlbmNlIGNhbGwgaW52aXRhdGlvblwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgfSwgMzAwMDApO1xuXG4gIGNvbnN0IHNvdXJjZU5hbWUgPSBzb3VyY2VEYXRhXG4gICAgPyBgJHtzb3VyY2VEYXRhLmZpcnN0TmFtZX0gJHtzb3VyY2VEYXRhLmxhc3ROYW1lfWBcbiAgICA6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0TmFtZSA9IHRhcmdldERhdGEgPyBgJHt0YXJnZXREYXRhLmZpcnN0TmFtZX0gJHt0YXJnZXREYXRhLmxhc3ROYW1lfWAgOiBjb250YWN0TnVtYmVyO1xuXG4gIGVtaXROZXQoXCJwaG9uZTphZGRBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgaWQ6IF9pZCxcbiAgICB0aXRsZTogXCJJbmNvbWluZyBDb25mZXJlbmNlIENhbGxcIixcbiAgICBkZXNjcmlwdGlvbjogYCR7c291cmNlTmFtZX0gaXMgYWRkaW5nIHlvdSB0byBhIGNvbmZlcmVuY2UgY2FsbGAsXG4gICAgYXBwOiBcInBob25lXCIsXG4gICAgaWNvbnM6IHtcbiAgICAgIFwiMFwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvY3Jvc3MtY2lyY2xlLnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQ6IGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgdGFyZ2V0TmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgICAgXCIxXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9hY2NlcHQuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q29uZmVyZW5jZUNhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZDogY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lOiB0YXJnZXROYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWU6IHNvdXJjZU5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9LFxuICB9KSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgdGl0bGU6ICdQbGF5ZXIgQWRkZWQgdG8gQ2FsbCcsXG4gICAgbWVzc2FnZTogYCR7c291cmNlUGhvbmV9IGFkZGVkICR7Y29udGFjdE51bWJlcn0gdG8gY29uZmVyZW5jZSBjYWxsIChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbiAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjayhcInBob25lOnNlcnZlcjpnZXRDYWxsSGlzdG9yeVwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIG1heFJlY29yZHNYOiBudW1iZXIpID0+IHtcbiAgbGV0IG1heFJlY29yZHMgPSAxMDA7XG4gIHRyeSB7XG4gICAgaWYgKG1heFJlY29yZHNYKSB7XG4gICAgICBtYXhSZWNvcmRzID0gbWF4UmVjb3Jkc1g7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBwYXJzaW5nIGdldENhbGxIaXN0b3J5IGRhdGFcIiwgZXJyb3IpO1xuICB9XG5cbiAgY29uc3QgcGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBoaXN0b3J5ID0gYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLmdldFBsYXllckNhbGxIaXN0b3J5KHBob25lTnVtYmVyLCBtYXhSZWNvcmRzKTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoaGlzdG9yeSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yIHJldHJpZXZpbmcgY2FsbCBoaXN0b3J5IGZvciBwaG9uZSBudW1iZXI6XCIsIHBob25lTnVtYmVyLCBlcnJvcik7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KFtdKTtcbiAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lOnNlcnZlcjpnZXREYXRhRnJvbURCd2l0aE51bWJlcicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICBudW1iZXI6IHN0cmluZyxcbiAgICBjaXRpemVuSWQ6IHN0cmluZyxcbiAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IGNvbnRhY3ROdW1iZXI6IHBhcnNlZERhdGEubnVtYmVyLCBvd25lcklkOiBwYXJzZWREYXRhLmNpdGl6ZW5JZCB9KTtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6c2VydmVyOnRvZ2dsZUJsb2NrTnVtYmVyJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcGFyc2VkRGF0YTogUGhvbmVDb250YWN0cyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IHBlcnNvbmFsTnVtYmVyID0gcGFyc2VkRGF0YS5wZXJzb25hbE51bWJlcjtcbiAgY29uc3QgY29udGFjdE51bWJlciA9IHBhcnNlZERhdGEuY29udGFjdE51bWJlcjtcbiAgbGV0IElzTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChwZXJzb25hbE51bWJlciwgY29udGFjdE51bWJlcik7XG4gIGlmICghSXNOdW1iZXJCbG9ja2VkKSB7XG4gICAgYXdhaXQgVXRpbHMuQmxvY2tOdW1iZXIocGVyc29uYWxOdW1iZXIsIGNvbnRhY3ROdW1iZXIpO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJOdW1iZXIgQmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIGhhcyBiZWVuIGJsb2NrZWRcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgVXRpbHMuVW5ibG9ja051bWJlcihwZXJzb25hbE51bWJlciwgY29udGFjdE51bWJlcik7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk51bWJlciBVbmJsb2NrZWRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIk51bWJlciBoYXMgYmVlbiB1bmJsb2NrZWRcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjayhcInN1bW1pdF9waG9uZTpzZXJ2ZXI6amFpbENhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBudW1iZXIsIHZvbHVtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyRnJvbVBob25lTnVtYmVyKG51bWJlcik7XG5cbiAgLy8gRm9yIGphaWwgY2FsbHMsIHdlIGRvbid0IG5lZWQgdG8gY2hlY2sgaWYgdGhlIGNhbGxlciBoYXMgYSBwaG9uZVxuICAvLyBXZSBhbHNvIGRvbid0IG5lZWQgdG8gY2hlY2sgZmxpZ2h0IG1vZGUgc2luY2UgaXQncyBhIGphaWwgcGhvbmVcblxuICBpZiAoIXRhcmdldFBsYXllcikge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHRhcmdldFNvdXJjZSA9IHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZTtcblxuICBpZiAoY2FsbE1hbmFnZXIuaXNQbGF5ZXJJbkNhbGwoc291cmNlKSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgYXJlIGFscmVhZHkgaW4gYSBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChjYWxsTWFuYWdlci5pc1BsYXllckluQ2FsbCh0YXJnZXRTb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgQnVzeVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiVGFyZ2V0IGlzIGFscmVhZHkgaW4gYSBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHNvdXJjZVBob25lID0gXCJKQUlMX1BIT05FXCI7IC8vIFNwZWNpYWwgaWRlbnRpZmllciBmb3IgamFpbCBwaG9uZSBjYWxsc1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3Qgc291cmNlQ2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG5cbiAgLy8gRm9yIGphaWwgY2FsbHMsIHdlIGRvbid0IGNoZWNrIGJsb2NrZWQgbnVtYmVycyBvciBmbGlnaHQgbW9kZVxuICAvLyBUaGlzIGFsbG93cyBpbmNhcmNlcmF0ZWQgcGxheWVycyB0byBtYWtlIGNhbGxzIGV2ZW4gaWYgdGhleSdyZSBibG9ja2VkXG5cbiAgY29uc3QgdGFyZ2V0SGFzUGhvbmUgPSBhd2FpdCBVdGlscy5IYXNQaG9uZSh0YXJnZXRTb3VyY2UpO1xuICBpZiAoIXRhcmdldEhhc1Bob25lKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgaG9zdFBhcnRpY2lwYW50ID0ge1xuICAgIHNvdXJjZSxcbiAgICBjaXRpemVuSWQ6IHNvdXJjZUNpdGl6ZW5JZCxcbiAgICBwaG9uZU51bWJlcjogc291cmNlUGhvbmUsXG4gICAgb25Ib2xkOiBmYWxzZSxcbiAgfTtcblxuICBjb25zdCBjYWxsSWQgPSBjYWxsTWFuYWdlci5jcmVhdGVDYWxsKGhvc3RQYXJ0aWNpcGFudCk7XG5cbiAgY2FsbE1hbmFnZXIuY3JlYXRlUmluZ1RvbmUodGFyZ2V0U291cmNlLCBTdHJpbmcoU2V0dGluZ3MucmluZ3RvbmUuZ2V0KHRhcmdldENpdGl6ZW5JZCk/LmN1cnJlbnQpLCB2b2x1bWUpO1xuXG4gIC8vIEphaWwgY2FsbHMgaGF2ZSBhIHNob3J0ZXIgdGltZW91dCAoMTUgbWludXRlcyBpbnN0ZWFkIG9mIDIwKVxuICBjYWxsTWFuYWdlci5hZGRQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSwgKCkgPT4ge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIFRpbWVvdXRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNhbGwgd2FzIG5vdCBhbnN3ZXJlZCBieSB0YXJnZXRcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk1pc3NlZCBDYWxsXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgbWlzc2VkIGEgY2FsbCBmcm9tIEpBSUxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgICAgIGlmIChjYWxsKSB7XG4gICAgICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwidW5hbnN3ZXJlZFwiLCBcIm1pc3NlZFwiLCBuZXcgRGF0ZSgpLCB0YXJnZXRQaG9uZSk7XG4gICAgICB9XG4gICAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgICB9KSgpO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbCh0YXJnZXRTb3VyY2UsIDApO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgXCJqYWlsX2NhbGxcIik7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gIH0sIDE1MDAwKTsgLy8gMTUgbWludXRlcyBmb3IgamFpbCBjYWxsc1xuXG4gIGNvbnN0IHNvdXJjZU5hbWUgPSBcIkpBSUwgUEhPTkVcIjtcbiAgY29uc3QgdGFyZ2V0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIobnVtYmVyLCB0YXJnZXRDaXRpemVuSWQpO1xuXG4gIGVtaXROZXQoXCJwaG9uZTphZGRBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgaWQ6IFwiamFpbF9jYWxsXCIsXG4gICAgdGl0bGU6IFwiSW5jb21pbmcgQ2FsbCBmcm9tIEpBSUxcIixcbiAgICBkZXNjcmlwdGlvbjogYCR7c291cmNlTmFtZX0gaXMgY2FsbGluZyB5b3VgLFxuICAgIGFwcDogXCJwaG9uZVwiLFxuICAgIGljb25zOiB7XG4gICAgICBcIjBcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2Nyb3NzLWNpcmNsZS5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBcImphaWxfY2FsbFwiLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBcIjFcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2FjY2VwdC5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphY2NlcHRDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IFwiamFpbF9jYWxsXCIsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9LFxuICB9KSk7XG5cbiAgZW1pdE5ldChcInN1bW1pdF9waG9uZTpzZXJ2ZXI6YWRkQ2FsbGluZ2ludGVyZmFjZVwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHRhcmdldE5hbWUsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkOiBcImphaWxfY2FsbFwiLFxuICB9KSk7XG5cbiAgLy8gU3RhcnQgYSB0aW1lciB0byBhdXRvbWF0aWNhbGx5IGVuZCBqYWlsIGNhbGxzIGFmdGVyIDEwIG1pbnV0ZXNcbiAgLy8gVGhpcyBwcmV2ZW50cyBhYnVzZSBhbmQgc2ltdWxhdGVzIHJlYWwgamFpbCBwaG9uZSBsaW1pdGF0aW9uc1xuICBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKGNhbGwgJiYgY2FsbC5jYWxsSWQgPT09IGNhbGxJZCkge1xuICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJDYWxsIEVuZGVkXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkphaWwgcGhvbmUgY2FsbCB0aW1lIGxpbWl0IHJlYWNoZWRcIixcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICB9KSk7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIkNhbGwgRW5kZWRcIixcbiAgICAgICAgZGVzY3JpcHRpb246IFwiSmFpbCBwaG9uZSBjYWxsIHRpbWUgbGltaXQgcmVhY2hlZFwiLFxuICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgIH0pKTtcblxuICAgICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJjb21wbGV0ZWRcIiwgXCJjb21wbGV0ZWRcIiwgbmV3IERhdGUoKSwgdGFyZ2V0UGhvbmUpO1xuICAgICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHNvdXJjZSwgMCk7XG4gICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwodGFyZ2V0U291cmNlLCAwKTtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgXCJqYWlsX2NhbGxcIik7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgc291cmNlKTtcbiAgICB9XG4gIH0sIDYwMDAwMCk7IC8vIDEwIG1pbnV0ZXNcblxuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgIHRpdGxlOiAnSmFpbCBDYWxsIEluaXRpYXRlZCcsXG4gICAgbWVzc2FnZTogYEphaWwgY2FsbCBpbml0aWF0ZWQgZnJvbSAke3NvdXJjZX0gdG8gJHt0YXJnZXRTb3VyY2V9ICgke3RhcmdldFBob25lfSlgLFxuICAgIHNob3dJZGVudGlmaWVyczogdHJ1ZSxcbiAgfSk7XG5cbiAgcmV0dXJuIHRydWU7XG59KTsiLCAiaW1wb3J0IHsgY2FsbE1hbmFnZXIgfSBmcm9tIFwiLi9DYWxsTWFuYWdlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgY2FsbEhpc3RvcnlNYW5hZ2VyIH0gZnJvbSBcIi4vY2FsbEhpc3RvcnlNYW5hZ2VyXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbk5ldChcInBob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLCBhc3luYyAobm90aUlkOiBzdHJpbmcsIGFyZ3M6IGFueSkgPT4ge1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShhcmdzKTtcbiAgY2FsbE1hbmFnZXIuZGVjbGluZUludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmIChjYWxsKSB7XG4gICAgY29uc3QgdGFyZ2V0UGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJkZWNsaW5lZFwiLCBcImRlY2xpbmVkXCIsIG5ldyBEYXRlKCksIHRhcmdldFBob25lKTtcbiAgfVxuICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICBcbiAgLy8gTkVXOiBFbmQgYW5pbWF0aW9ucyBmb3IgYm90aCBwYXJ0aWVzXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCB0YXJnZXRTb3VyY2UpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OmVuZENhbGxBbmltYXRpb25cIiwgY2FsbGVyU291cmNlKTtcbiAgXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIGNhbGxlclNvdXJjZSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6IFwicGhvbmVcIixcbiAgICB0aXRsZTogXCJDYWxsIERlY2xpbmVkXCIsXG4gICAgbWVzc2FnZTogYCR7VXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShjYWxsZXJTb3VyY2UpfSBoYXMgZGVjbGluZWQgdGhlIGNhbGwgZnJvbSAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKX1gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2UsXG4gIH0pO1xufSk7XG5cbm9uTmV0KFwicGhvbmU6c2VydmVyOmFjY2VwdENhbGxcIiwgYXN5bmMgKG5vdGlJZDogc3RyaW5nLCBhcmdzOiBhbnkpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQsIHRhcmdldFNvdXJjZSwgdGFyZ2V0TmFtZSwgc291cmNlTmFtZSwgY2FsbGVyU291cmNlLCBkYXRhYmFzZVRhYmxlSWQgfSA9IEpTT04ucGFyc2UoYXJncyk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoY2FsbGVyU291cmNlKTtcbiAgaWYgKCFjYWxsIHx8IGNhbGwuY2FsbElkICE9PSBjYWxsSWQpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ2FsbCBubyBsb25nZXIgZXhpc3RzXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldFBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBwYXJ0aWNpcGFudCA9IHtcbiAgICBzb3VyY2U6IHRhcmdldFNvdXJjZSxcbiAgICBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCxcbiAgICBwaG9uZU51bWJlcjogdGFyZ2V0UGhvbmUsXG4gICAgb25Ib2xkOiBmYWxzZSxcbiAgfTtcbiAgaWYgKCFjYWxsTWFuYWdlci5hY2NlcHRJbnZpdGF0aW9uKGNhbGxJZCwgcGFydGljaXBhbnQpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvdWxkIG5vdCBqb2luIGNhbGxcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwodGFyZ2V0U291cmNlLCBjYWxsSWQpO1xuICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwoY2FsbGVyU291cmNlLCBjYWxsSWQpO1xuICBcbiAgLy8gTkVXOiBTdGFydCBhbmltYXRpb24gZm9yIGJvdGggcGFydGllcyB3aGVuIGNhbGwgaXMgYWNjZXB0ZWRcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDphY2NlcHRDYWxsXCIsIHRhcmdldFNvdXJjZSwgYXJncyk7XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6c3RhcnRDYWxsQW5pbWF0aW9uXCIsIGNhbGxlclNvdXJjZSk7IC8vIE5FVzogQW5pbWF0aW9uIGZvciBjYWxsZXJcbiAgXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6dXBkYXRlQ2FsbGVySW50ZXJmYWNlXCIsIGNhbGxlclNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgc291cmNlTmFtZTogdGFyZ2V0TmFtZSxcbiAgICB0YXJnZXROYW1lOiBzb3VyY2VOYW1lLFxuICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgIGRhdGFiYXNlVGFibGVJZCxcbiAgfSkpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIG5vdGlJZCk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6IFwicGhvbmVcIixcbiAgICB0aXRsZTogXCJDYWxsIEFjY2VwdGVkXCIsXG4gICAgbWVzc2FnZTogYCR7VXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShjYWxsZXJTb3VyY2UpfSBoYXMgYWNjZXB0ZWQgdGhlIGNhbGwgZnJvbSAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKX1gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2UsXG4gIH0pO1xufSk7XG5cbm9uTmV0KFwicGhvbmU6c2VydmVyOmFjY2VwdENvbmZlcmVuY2VDYWxsXCIsIGFzeW5jIChub3RpSWQ6IHN0cmluZywgYXJnczogYW55KSA9PiB7XG4gIGNvbnN0IHsgY2FsbElkLCB0YXJnZXRTb3VyY2UsIHRhcmdldE5hbWUsIHNvdXJjZU5hbWUsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkIH0gPSBKU09OLnBhcnNlKGFyZ3MpO1xuXG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoY2FsbGVyU291cmNlKTtcbiAgaWYgKCFjYWxsKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvbmZlcmVuY2UgY2FsbCBubyBsb25nZXIgZXhpc3RzXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybjtcbiAgfVxuICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgcGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlOiB0YXJnZXRTb3VyY2UsXG4gICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG4gIGlmICghY2FsbE1hbmFnZXIuYWNjZXB0SW52aXRhdGlvbihjYWxsLmNhbGxJZCwgcGFydGljaXBhbnQpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvdWxkIG5vdCBqb2luIGNvbmZlcmVuY2UgY2FsbFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgY2FsbC5jYWxsSWQpO1xuXG4gIGZvciAoY29uc3QgcCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpKSB7XG4gICAgaWYgKHAuc291cmNlICE9PSB0YXJnZXRTb3VyY2UpIHtcbiAgICAgIGNvbnN0IGNhbGxzcyA9IGNhbGwuY2FsbElkO1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxzcyxcbiAgICAgICAgcGFydGljaXBhbnRzOiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpLFxuICAgICAgfSkpO1xuICAgICAgZW1pdE5ldCgncGhvbmU6Y2xpZW50OnVwRGF0ZUludGVyRmFjZU5hbWUnLCBwLnNvdXJjZSk7XG4gICAgfVxuICB9XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgbm90aUlkKTtcbiAgXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6dXBkYXRlQ2FsbGVySW50ZXJmYWNlXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgc291cmNlTmFtZTogc291cmNlTmFtZSxcbiAgICB0YXJnZXROYW1lOiAnQ29uZmVyZW5jZSBDYWxsJyxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQsXG4gIH0pKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDYWxsZXJJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY2FsbElkLFxuICAgIHRhcmdldFNvdXJjZSxcbiAgICBzb3VyY2VOYW1lOiBzb3VyY2VOYW1lLFxuICAgIHRhcmdldE5hbWU6IFwiQ29uZmVyZW5jZSBDYWxsXCIsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkLFxuICB9KSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6IFwicGhvbmVcIixcbiAgICB0aXRsZTogXCJDb25mZXJlbmNlIENhbGwgQWNjZXB0ZWRcIixcbiAgICBtZXNzYWdlOiBgJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNhbGxlclNvdXJjZSl9IGhhcyBhY2NlcHRlZCB0aGUgY29uZmVyZW5jZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjplbmRDYWxsXCIsIGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQsIHNvdXJjZSB9ID0gSlNPTi5wYXJzZShhcmdzKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICBpZiAoY2FsbCAmJiBjYWxsLmNhbGxJZCA9PT0gY2FsbElkKSB7XG4gICAgYXdhaXQgY2FsbE1hbmFnZXIucmVtb3ZlUGFydGljaXBhbnQoY2FsbElkLCBzb3VyY2UpO1xuICAgIGZvciAoY29uc3QgcCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxJZDogY2FsbElkLFxuICAgICAgICBwYXJ0aWNpcGFudHM6IGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpLFxuICAgICAgfSkpO1xuICAgIH1cbiAgfVxufSk7XG5cbm9uKFwib25SZXNvdXJjZVN0b3BcIiwgYXN5bmMgKHJlc291cmNlOiBzdHJpbmcpID0+IHtcbiAgaWYgKHJlc291cmNlID09PSBHZXRDdXJyZW50UmVzb3VyY2VOYW1lKCkpIHtcbiAgICBmb3IgKGNvbnN0IGNhbGwgb2YgY2FsbE1hbmFnZXIuZ2V0QWxsQ2FsbHMoKSkge1xuICAgICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSkge1xuICAgICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwocGFydGljaXBhbnQuc291cmNlLCAwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG5vbk5ldChcInBsYXllckRyb3BwZWRcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKGNhbGwpIHtcbiAgICBhd2FpdCBjYWxsTWFuYWdlci5yZW1vdmVQYXJ0aWNpcGFudChjYWxsLmNhbGxJZCwgc291cmNlKTtcbiAgICBmb3IgKGNvbnN0IHAgb2YgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxJZDogY2FsbC5jYWxsSWQsXG4gICAgICAgIHBhcnRpY2lwYW50czogY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSxcbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cbn0pO1xuIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25DbGllbnRDYWxsYmFjaygnc2F2ZVBob3RvVG9QaG90b3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgZGF0YVggPSB7XG4gICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICBjaXRpemVuSWQsXG4gICAgbGluazogZGF0YSxcbiAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkucmVwbGFjZSgnVCcsICcgJykucmVwbGFjZSgnWicsICcnKVxuICB9O1xuICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfcGhvdG9zJywgZGF0YVgpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfcGhvdG9zJyxcbiAgICB0aXRsZTogJ1Bob3RvIFNhdmVkJyxcbiAgICBtZXNzYWdlOiBgUGhvdG8gc2F2ZWQgYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8ICR7Y2l0aXplbklkfSwgTGluazogJHtkYXRhfWAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGFYKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRQaG90b3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHBob3RvcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX3Bob3RvcycsIHsgY2l0aXplbklkIH0pO1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocGhvdG9zKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdkZWxldGVQaG90bycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3Bob3RvcycsIHsgX2lkOiBkYXRhIH0pO1xuICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfcGhvdG9zJywgeyBfaWQ6IGRhdGEsIGNpdGl6ZW5JZCB9KTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX3Bob3RvcycsXG4gICAgdGl0bGU6ICdQaG90byBEZWxldGVkJyxcbiAgICBtZXNzYWdlOiBgUGhvdG8gZGVsZXRlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgJHtjaXRpemVuSWR9LCBMaW5rOiAke3Jlcy5saW5rfWAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbiAgcmV0dXJuIHRydWU7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjaywgdHJpZ2dlckNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIsIEZyYW1ld29yayB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCwgTE9HR0VSIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1JlZ2lzdGVyTmV3QnVzaW5lc3MnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7XG4gICAgICAgIG93bmVyQ2l0aXplbklkLFxuICAgICAgICBidXNpbmVzc05hbWUsXG4gICAgICAgIGJ1c2luZXNzRGVzY3JpcHRpb24sXG4gICAgICAgIGJ1c2luZXNzVHlwZSxcbiAgICAgICAgYnVzaW5lc3NMb2dvLFxuICAgICAgICBidXNpbmVzc1Bob25lTnVtYmVyLFxuICAgICAgICBidXNpbmVzc0FkZHJlc3MsXG4gICAgICAgIGdlbmVyYXRlQnVzaW5lc3NFbWFpbCxcbiAgICAgICAgY29vcmRzLFxuICAgICAgICBidXNpbmVzc0VtYWlsLFxuICAgICAgICBidXNpbmVzc1Bhc3N3b3JkLFxuICAgICAgICBqb2JcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgIGNvbnN0IGJ1c2luZXNzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lIH0pO1xuICAgIGlmIChidXNpbmVzcykge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICB0aXRsZTogJ0J1c2luZXNzIFJlZ2lzdHJhdGlvbiBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gcmVnaXN0ZXIgYnVzaW5lc3Mgd2l0aCBleGlzdGluZyBuYW1lICcke2J1c2luZXNzTmFtZX0nIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7YnVzaW5lc3NOYW1lfSBhbHJlYWR5IGV4aXN0cy5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgaWYgKGdlbmVyYXRlQnVzaW5lc3NFbWFpbCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWFpbCcsIHtcbiAgICAgICAgICAgIF9pZDogYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgICAgIGFjdGl2ZU1haWRJZDogYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgICAgIHVzZXJuYW1lOiBidXNpbmVzc0VtYWlsLFxuICAgICAgICAgICAgYWN0aXZlTWFpbFBhc3N3b3JkOiBidXNpbmVzc1Bhc3N3b3JkLFxuICAgICAgICAgICAgYXZhdGFyOiBidXNpbmVzc0xvZ28sXG4gICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7XG4gICAgICAgIG93bmVyQ2l0aXplbklkLFxuICAgICAgICBidXNpbmVzc05hbWUsXG4gICAgICAgIGJ1c2luZXNzRGVzY3JpcHRpb24sXG4gICAgICAgIGJ1c2luZXNzVHlwZSxcbiAgICAgICAgYnVzaW5lc3NMb2dvLFxuICAgICAgICBidXNpbmVzc1Bob25lTnVtYmVyLFxuICAgICAgICBidXNpbmVzc0FkZHJlc3MsXG4gICAgICAgIGdlbmVyYXRlQnVzaW5lc3NFbWFpbCxcbiAgICAgICAgYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgY29vcmRzLFxuICAgICAgICBqb2JcbiAgICB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBSZWdpc3RlcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYE5ldyBidXNpbmVzcyAnJHtidXNpbmVzc05hbWV9JyByZWdpc3RlcmVkIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRCdXNpbmVzc0RhdGEnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZTogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYnVzaW5lc3MpO1xufSk7XG5vbkNsaWVudENhbGxiYWNrKCdnZXRBbGxCdXNpbmVzc0RhdGEnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBidXNpbmVzc2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYnVzaW5lc3MnLCB7fSk7XG4gICAgbGV0IG9ubGluZUJ1c3MgPSBbXVxuICAgIGxldCBvZmZsaW5lQnVzcyA9IFtdXG4gICAgZm9yIChjb25zdCBidXNpbmVzcyBvZiBidXNpbmVzc2VzKSB7XG4gICAgICAgIGNvbnN0IGpvYkNvdW50ID0gR2xvYmFsU3RhdGVbYCR7YnVzaW5lc3Muam9ifTpjb3VudGBdXG4gICAgICAgIGlmIChqb2JDb3VudCkge1xuICAgICAgICAgICAgb25saW5lQnVzcy5wdXNoKGJ1c2luZXNzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9mZmxpbmVCdXNzLnB1c2goYnVzaW5lc3MpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IG9ubGluZTogb25saW5lQnVzcywgb2ZmbGluZTogb2ZmbGluZUJ1c3MgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0QnVzaW5lc3NOYW1lcycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBidXNpbmVzc2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYnVzaW5lc3MnLCB7fSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGJ1c2luZXNzZXMubWFwKChidXNpbmVzczogYW55KSA9PiBidXNpbmVzcy5idXNpbmVzc05hbWUpKTtcbn0pXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1VwZGF0ZUJ1c2luZXNzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgICBzZWxlY3RlZEJ1c2luZXNzLFxuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iLFxuICAgICAgICBidXNpbmVzc0VtYWlsXG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgYnVzaW5lc3MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IHNlbGVjdGVkQnVzaW5lc3MgfSk7XG4gICAgaWYgKCFidXNpbmVzcykge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICB0aXRsZTogJ0J1c2luZXNzIFVwZGF0ZSBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gdXBkYXRlIG5vbi1leGlzdGVudCBidXNpbmVzcyAnJHtzZWxlY3RlZEJ1c2luZXNzfScgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBCdXNpbmVzcyB3aXRoIG5hbWUgJHtidXNpbmVzc05hbWV9IGRvZXMgbm90IGV4aXN0LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZTogc2VsZWN0ZWRCdXNpbmVzcyB9LCB7XG4gICAgICAgIG93bmVyQ2l0aXplbklkLFxuICAgICAgICBidXNpbmVzc05hbWUsXG4gICAgICAgIGJ1c2luZXNzRGVzY3JpcHRpb24sXG4gICAgICAgIGJ1c2luZXNzVHlwZSxcbiAgICAgICAgYnVzaW5lc3NMb2dvLFxuICAgICAgICBidXNpbmVzc1Bob25lTnVtYmVyLFxuICAgICAgICBidXNpbmVzc0FkZHJlc3MsXG4gICAgICAgIGdlbmVyYXRlQnVzaW5lc3NFbWFpbCxcbiAgICAgICAgY29vcmRzLFxuICAgICAgICBqb2IsXG4gICAgICAgIGJ1c2luZXNzRW1haWxcbiAgICB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEJ1c2luZXNzICcke3NlbGVjdGVkQnVzaW5lc3N9JyB1cGRhdGVkIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdkZWxldGVCdXNpbmVzcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGJ1c2luZXNzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBkYXRhIH0pO1xuICAgIGlmICghYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBEZWxldGlvbiBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gZGVsZXRlIG5vbi1leGlzdGVudCBidXNpbmVzcyAnJHtkYXRhfScgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBCdXNpbmVzcyB3aXRoIG5hbWUgJHtkYXRhfSBkb2VzIG5vdCBleGlzdC5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IGRhdGEgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBCdXNpbmVzcyAnJHtkYXRhfScgZGVsZXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjp0b2dnbGVKb2JDYWxscycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7O1xuICAgIGNvbnN0IFBsYXllckRhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciB9KTtcbiAgICBpZiAoIVBsYXllckRhdGEpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciwgam9iQ2FsbHM6IHRydWUgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciB9LCB7IGpvYkNhbGxzOiAhUGxheWVyRGF0YS5qb2JDYWxscyB9KTtcbiAgICByZXR1cm4gIVBsYXllckRhdGEuam9iQ2FsbHM7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpnZXRKb2JDYWxscycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgUGxheWVyRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogcGxheWVyIH0pO1xuICAgIGlmICghUGxheWVyRGF0YSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogcGxheWVyLCBqb2JDYWxsczogdHJ1ZSB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbiAgICByZXR1cm4gUGxheWVyRGF0YS5qb2JDYWxscztcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmJ1c2luZXNzQ2FsbCcsIGFzeW5jIChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBudW1iZXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgY2l0aXplbmlkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihudW1iZXIpO1xuICAgIGNvbnN0IHBlcnNvbmFsTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShjbGllbnQpO1xuICAgIGlmIChTdHJpbmcocGVyc29uYWxOdW1iZXIpID09PSBTdHJpbmcobnVtYmVyKSkge1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IENhbid0IGNhbGwgeW91cnNlbGYgJHtwZXJzb25hbE51bWJlcn0uYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBpZiAoIWNpdGl6ZW5pZCkge1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgVGhpcyBudW1iZXIgaXMgbm90IHJlZ2lzdGVyZWQuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBjb25zdCBQbGF5ZXJEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBjaXRpemVuaWQgfSk7XG4gICAgaWYgKFBsYXllckRhdGEgJiYgIVBsYXllckRhdGEuam9iQ2FsbHMpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFRoaXMgcGVyc29uIGhhcyBkaXNhYmxlZCBqb2IgY2FsbHMuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH0gZWxzZSBpZiAoUGxheWVyRGF0YSAmJiBQbGF5ZXJEYXRhLmpvYkNhbGxzKSB7XG4gICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOmNsaWVudDpidXNpbmVzc0NhbGwnLCBjbGllbnQsIG51bWJlcik7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0QmFua2JhbGFuY2UnLCBhc3luYyAoY2xpZW50LCBhY2NvdW50KSA9PiB7XG4gICAgY29uc3QgYmFsYW5jZSA9IGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmdldEFjY291bnRNb25leShhY2NvdW50KTtcbiAgICByZXR1cm4gYmFsYW5jZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmRlcG9zaXRNb25leScsIGFzeW5jIChjbGllbnQsIGFtb3VudDogbnVtYmVyKSA9PiB7XG4gICAgXG4gICAgY29uc3Qgc3JjID0gY2xpZW50O1xuICAgIGNvbnN0IFBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc3JjKTtcbiAgICBjb25zdCBmdWxsbmFtZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNyYyk7XG4gICAgY29uc3QgY2lkID0gUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkO1xuICAgIGNvbnN0IFBsYXllckpvYiA9IFBsYXllci5QbGF5ZXJEYXRhLmpvYjtcbiAgICBjb25zdCBhY2NvdW50ID0gUGxheWVySm9iLm5hbWU7XG4gICAgY29uc3QgYmFua2JhbGFuY2UgPSBhd2FpdCBQbGF5ZXIuUGxheWVyRGF0YS5tb25leS5iYW5rO1xuICAgIGlmIChiYW5rYmFsYW5jZSA8IGFtb3VudCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGF3YWl0IFBsYXllci5GdW5jdGlvbnMuUmVtb3ZlTW9uZXkoJ2JhbmsnLCBhbW91bnQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIERlcG9zaXQuXCIpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmFkZEFjY291bnRNb25leShhY2NvdW50LCBhbW91bnQpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGNpZCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgV2l0aGRyYXdcIiwgYW1vdW50LCBgU2VudCBmdW5kcyB0byAke1BsYXllckpvYi5sYWJlbH1gLCBhY2NvdW50LCBmdWxsbmFtZSwgXCJ3aXRoZHJhd1wiLCBnZW5lcmF0ZVVVaWQoKSlcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihhY2NvdW50LCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0XCIsIGFtb3VudCwgXCJEZXBvc2l0XCIsIGZ1bGxuYW1lLCBhY2NvdW50LCBcImRlcG9zaXRcIiwgZ2VuZXJhdGVVVWlkKCkpXG5cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgdGl0bGU6ICdNb25leSBEZXBvc2l0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7ZnVsbG5hbWV9IGRlcG9zaXRlZCAkJHthbW91bnR9IHRvIGFjY291bnQgJHthY2NvdW50fS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjp3aXRoZHJhd01vbmV5JywgYXN5bmMgKGNsaWVudCwgYW1vdW50OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBzcmMgPSBjbGllbnQ7XG4gICAgY29uc3QgUGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzcmMpO1xuICAgIGNvbnN0IGZ1bGxuYW1lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc3JjKTtcbiAgICBjb25zdCBjaWQgPSBQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQ7XG4gICAgY29uc3QgUGxheWVySm9iID0gUGxheWVyLlBsYXllckRhdGEuam9iO1xuICAgIGNvbnN0IGFjY291bnQgPSBQbGF5ZXJKb2IubmFtZTtcbiAgICBjb25zdCBiYWxhbmNlID0gYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uZ2V0QWNjb3VudE1vbmV5KGFjY291bnQpO1xuICAgIGlmIChiYWxhbmNlIDwgYW1vdW50KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYXdhaXQgUGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGFtb3VudCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgV2l0aGRyYXcuXCIpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLnJlbW92ZUFjY291bnRNb25leShhY2NvdW50LCBhbW91bnQpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGNpZCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgV2l0aGRyYXdcIiwgYW1vdW50LCBgUmVjaWV2ZWQgZnVuZHMgZnJvbSAke1BsYXllckpvYi5sYWJlbH1gLCBhY2NvdW50LCBmdWxsbmFtZSwgXCJkZXBvc2l0XCIsIGdlbmVyYXRlVVVpZCgpKVxuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGFjY291bnQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3XCIsIGFtb3VudCwgXCJXaXRoZHJhd1wiLCBhY2NvdW50LCBmdWxsbmFtZSwgXCJ3aXRoZHJhd1wiLCBnZW5lcmF0ZVVVaWQoKSlcblxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICB0aXRsZTogJ01vbmV5IFdpdGhkcmF3bicsXG4gICAgICAgIG1lc3NhZ2U6IGBQbGF5ZXIgJHtmdWxsbmFtZX0gd2l0aGRyZXcgJCR7YW1vdW50fSBmcm9tIGFjY291bnQgJHthY2NvdW50fS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpnZXRFbXBsb3llZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzcmMgPSBjbGllbnQ7XG4gICAgY29uc3Qgam9ibmFtZSA9IGRhdGE7XG4gICAgY29uc3QgUGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzcmMpO1xuICAgIGNvbnN0IGlzQm9zcyA9IFBsYXllci5QbGF5ZXJEYXRhLmpvYi5pc2Jvc3M7XG4gICAgLyogICAgIFxuICAgICAgICBpZiAoIWlzQm9zcykge1xuICAgICAgICAgICAgcmV0dXJuIGV4cG9ydHNbJ3BzLWFkbWlubWVudSddLkJhblBsYXllcihzcmMsICdHZXRFbXBsb3llZXMgRXhwbG9pdGluZyAnLCAnc3VtbWl0X3Bob25lJyk7XG4gICAgICAgIH1cbiAgICAqL1xuICAgIGNvbnN0IHBsYXllcnM6IGFueSA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgY2l0aXplbmlkLCBjaGFyaW5mbywgam9iIEZST00gcGxheWVycyBXSEVSRSBqb2IgTElLRSA/JywgW2AlJHtqb2JuYW1lfSVgXSk7XG4gICAgY29uc3QgZW1wbG95ZWVzOiBhbnkgPSBbXTtcblxuICAgIGZvciAoY29uc3QgZGF0YSBvZiBwbGF5ZXJzKSB7XG4gICAgICAgIGxldCBjaGFyRGF0YSA9IHsgZmlyc3RuYW1lOiAnVW5rbm93bicsIGxhc3RuYW1lOiAnUGxheWVyJyB9O1xuICAgICAgICBsZXQgam9iRGF0YSA9IHsgbmFtZTogJ1Vua25vd24nLCBncmFkZTogMCwgaXNib3NzOiBmYWxzZSB9O1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5jaGFyaW5mbykgY2hhckRhdGEgPSBKU09OLnBhcnNlKGRhdGEuY2hhcmluZm8pO1xuICAgICAgICAgICAgaWYgKGRhdGEuam9iKSBqb2JEYXRhID0gSlNPTi5wYXJzZShkYXRhLmpvYik7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIExPR0dFUihgRmFpbGVkIHRvIHBhcnNlIEpvYiAke2pvYm5hbWV9IC8gY2hhcmluZm8gZm9yICQgJHtkYXRhLmNpdGl6ZW5pZH1gKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNPbmxpbmUgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoZGF0YS5jaXRpemVuaWQpO1xuICAgICAgICBpZiAoaXNPbmxpbmUgJiYgaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSA9PT0gam9ibmFtZSkge1xuICAgICAgICAgICAgZW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogaXNPbmxpbmUuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICAgICAgY3VySm9iOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5uYW1lLFxuICAgICAgICAgICAgICAgIGdyYWRlOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5ncmFkZSxcbiAgICAgICAgICAgICAgICBpc2Jvc3M6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmlzYm9zcyxcbiAgICAgICAgICAgICAgICBuYW1lOiBgJHtpc09ubGluZS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtpc09ubGluZS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnb25saW5lJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbXBsb3llZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgZW1wU291cmNlOiBkYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgICAgICBjdXJKb2I6IGpvYkRhdGEubmFtZSxcbiAgICAgICAgICAgICAgICBncmFkZTogam9iRGF0YS5ncmFkZSxcbiAgICAgICAgICAgICAgICBpc2Jvc3M6IGpvYkRhdGEuaXNib3NzLFxuICAgICAgICAgICAgICAgIG5hbWU6IGAke2NoYXJEYXRhLmZpcnN0bmFtZX0gJHtjaGFyRGF0YS5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgIHN0YXR1czogJ29mZmxpbmUnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbXBsb3llZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IChiLmdyYWRlLmxldmVsIHx8IDApIC0gKGEuZ3JhZGUubGV2ZWwgfHwgMCkpO1xuXG4gICAgY29uc3QgbXVsdGlqb2JFbXBsb3llZXM6IGFueVtdID0gW107XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgbXVsdGlKb2JQbGF5ZXJzOiBhbnlbXSA9IChhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGpvYk5hbWU6IGpvYm5hbWUgfSkpIHx8IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3QgbXVsdGlKb2Igb2YgbXVsdGlKb2JQbGF5ZXJzKSB7XG4gICAgICAgICAgICBpZiAoIW11bHRpSm9iLmNpdGl6ZW5JZCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignU2tpcHBpbmcgaW52YWxpZCBtdWx0aWpvYiBlbnRyeTonLCBtdWx0aUpvYik7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlzT25saW5lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKG11bHRpSm9iLmNpdGl6ZW5JZCk7XG4gICAgICAgICAgICBpZiAoIWlzT25saW5lKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGxheWVyRGF0YTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCBjaGFyaW5mbywgam9iIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW211bHRpSm9iLmNpdGl6ZW5JZF0pO1xuICAgICAgICAgICAgICAgIGlmICghcGxheWVyRGF0YSB8fCBwbGF5ZXJEYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYE5vIHBsYXllciBkYXRhIGZvdW5kIGZvciBvZmZsaW5lIGNpdGl6ZW5JZCAke211bHRpSm9iLmNpdGl6ZW5JZH1gKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBkYXRhIG9mIHBsYXllckRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGpvYkRhdGEsIGNoYXJEYXRhO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgam9iRGF0YSA9IGRhdGEuam9iID8gSlNPTi5wYXJzZShkYXRhLmpvYikgOiB7IG5hbWU6ICdVbmtub3duJywgZ3JhZGU6IDAsIGlzYm9zczogZmFsc2UgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJEYXRhID0gZGF0YS5jaGFyaW5mbyA/IEpTT04ucGFyc2UoZGF0YS5jaGFyaW5mbykgOiB7IGZpcnN0bmFtZTogJ1Vua25vd24nLCBsYXN0bmFtZTogJ1BsYXllcicgfTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHBhcnNlIGpvYi9jaGFyaW5mbyBmb3IgJHttdWx0aUpvYi5jaXRpemVuSWR9OmAsIGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGpvYkRhdGEubmFtZSA9PT0gam9ibmFtZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIG11bHRpam9iRW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZW1wU291cmNlOiBtdWx0aUpvYi5jaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJKb2I6IGpvYkRhdGEubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyYWRlOiBqb2JEYXRhLmdyYWRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNib3NzOiBqb2JEYXRhLmlzYm9zcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGAke2NoYXJEYXRhLmZpcnN0bmFtZX0gJHtjaGFyRGF0YS5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnb2ZmbGluZSdcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSA9PT0gam9ibmFtZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgbXVsdGlqb2JFbXBsb3llZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogaXNPbmxpbmUuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICAgICAgICAgIGN1ckpvYjogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZ3JhZGU6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmdyYWRlLFxuICAgICAgICAgICAgICAgICAgICBpc2Jvc3M6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmlzYm9zcyxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYCR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICdvbmxpbmUnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbXVsdGlqb2JFbXBsb3llZXMuc29ydCgoYSwgYikgPT4gKGIuZ3JhZGUgfHwgMCkgLSAoYS5ncmFkZSB8fCAwKSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHByb2Nlc3NpbmcgbXVsdGlqb2IgZW1wbG95ZWVzOicsIGVycik7XG4gICAgfVxuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZW1wbG95ZWVzOiBlbXBsb3llZXMubGVuZ3RoID4gMCA/IGVtcGxveWVlcyA6IFtdLFxuICAgICAgICBtdWx0aWpvYkVtcGxveWVlczogbXVsdGlqb2JFbXBsb3llZXMubGVuZ3RoID4gMCA/IG11bHRpam9iRW1wbG95ZWVzIDogW11cbiAgICB9KTtcbn0pO1xuXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6aGlyZUVtcGxveWVlJywgYXN5bmMgKGNsaWVudCwgdGFyZ2V0U291cmNlOiBzdHJpbmcsIGpvYm5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChTdHJpbmcoY2xpZW50KSA9PT0gU3RyaW5nKHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdIaXJlIEZhaWxlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQXR0ZW1wdCB0byBoaXJlIHNlbGYgTmFtZTogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSwgaW4gSm9iOiAke2pvYm5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgY2FuJ3QgaGlyZSB5b3Vyc2VsZi5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGlmIChhd2FpdCBEb2VzUGxheWVyRXhpc3QodGFyZ2V0U291cmNlKSkge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKGNsaWVudCk7XG4gICAgICAgIGlmICghcGxheWVyLlBsYXllckRhdGEuam9iLmlzYm9zcykge1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ0hpcmUgRmFpbGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQXR0ZW1wdCB0byBoaXJlIHdpdGhvdXQgYmVpbmcgYSBib3NzIE5hbWU6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0sIGluIEpvYjogJHtqb2JuYW1lfSwgQ2l0aXplbklkOiAke3BsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBhcmUgbm90IGEgYm9zcy5gLFxuICAgICAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcih0YXJnZXRTb3VyY2UpO1xuICAgICAgICB0YXJnZXRQbGF5ZXIuRnVuY3Rpb25zLlNldEpvYihqb2JuYW1lLCAwKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdFbXBsb3llZSBIaXJlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkfSBOYW1lOiAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGlyZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9LCBpbiBKb2I6ICR7am9ibmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgaGlyZWQgJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IHRvICR7am9ibmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBiZWVuIGhpcmVkIHRvICR7am9ibmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0KCdzdW1taXRfcGhvbmU6c2VydmVyOmhpcmVpbk11bHRpSm9iJywgdGFyZ2V0U291cmNlLCBqb2JuYW1lLCAwLCBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbam9ibmFtZV0ubGFiZWwsIEZyYW1ld29yay5TaGFyZWQuSm9ic1tqb2JuYW1lXS5ncmFkZXNbJzAnXS5sYWJlbCk7XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBjbGllbnQsIGpvYm5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSGlyZSBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gaGlyZSBub24tZXhpc3RlbnQgcGxheWVyIE5hbWU6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0sIGluIEpvYjogJHtqb2JuYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBQbGF5ZXIgaXMgbm90IG9ubGluZS5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldEluZGV4T2ZBbGxKb2JzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGpvYnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdzdW1taXRfam9icycsIHt9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoam9icy5tYXAoKGpvYjogYW55KSA9PiBqb2IuX2lkKSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncmVnaXN0ZXJKb2JzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgam9icyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3N1bW1pdF9qb2JzJywgam9icyk7XG4gICAgY29uc3QgeyBfaWQsIC4uLnJlc3QgfSA9IGpvYnM7XG4gICAgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkFkZEpvYihfaWQsIHJlc3QpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfam9icycsXG4gICAgICAgIHRpdGxlOiAnSm9iIFJlZ2lzdGVyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTmV3IGpvYiAnJHtfaWR9JyBOYW1lOiAke2pvYnMuam9iTmFtZX0gcmVnaXN0ZXJlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0Sm9iRGF0YScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnc3VtbWl0X2pvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoam9iKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd1cGRhdGVKb2JzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgam9icyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGpvYnMuX2lkIH0sIGpvYnMpO1xuICAgIGNvbnN0IHsgX2lkLCAuLi5yZXN0IH0gPSBqb2JzO1xuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5VcGRhdGVKb2IoX2lkLCByZXN0KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2pvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEpvYiAnJHtfaWR9JyBOYW1lOiAke2pvYnMuam9iTmFtZX0gdXBkYXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZGVsZXRlSm9icycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnc3VtbWl0X2pvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBpZiAoIWpvYikge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdzdW1taXRfam9icycsXG4gICAgICAgICAgICB0aXRsZTogJ0pvYiBEZWxldGlvbiBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gZGVsZXRlIG5vbi1leGlzdGVudCBqb2IgJyR7ZGF0YX0nIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgSm9iIGRvZXMgbm90IGV4aXN0LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLlJlbW92ZUpvYihkYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2pvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEpvYiAnJHtkYXRhfScgTmFtZTogJHtqb2Iuam9iTmFtZX0gZGVsZXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpnZXRCdXNpbmVzc0VtcGxveWVlc051bWJlcnMnLCBhc3luYyAoY2xpZW50OiBudW1iZXIsIGpvYjogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgW3BsYXllcnNdID0gYXdhaXQgRnJhbWV3b3JrLkZ1bmN0aW9ucy5HZXRQbGF5ZXJzT25EdXR5KGpvYik7XG4gICAgbGV0IG51bWJlcnM6IG51bWJlcltdID0gW107XG4gICAgZm9yIChjb25zdCBwbGF5ZXIgb2YgcGxheWVycykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHBsYXllcik7XG4gICAgICAgIG51bWJlcnMucHVzaChOdW1iZXIobnVtYmVyKSk7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShudW1iZXJzKTtcbn0pIiwgImltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRnJhbWV3b3JrLCBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25OZXQoJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6ZmlyZUVtcGxveWVlJywgYXN5bmMgKGNpdGl6ZW5JZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBjb25zdCB0YXJnZXREYXRhID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgaWYgKHRhcmdldERhdGEpIHtcbiAgICAgICAgY29uc3Qgam9ibmFtZSA9IHRhcmdldERhdGEuUGxheWVyRGF0YS5qb2IubmFtZTtcbiAgICAgICAgYXdhaXQgdGFyZ2V0RGF0YS5GdW5jdGlvbnMuU2V0Sm9iKCd1bmVtcGxveWVkJywgMCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogY2l0aXplbklkLCBqb2JOYW1lOiBqb2JuYW1lIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBmaXJlZCAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGJlZW4gZmlyZWQgYnkgJHtnbG9iYWwuc291cmNlfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgam9ibmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2VtcGxveWVlX2FjdGlvbicsXG4gICAgICAgICAgICB0aXRsZTogJ0VtcGxveWVlIEZpcmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgYmVlbiBmaXJlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgQ2l0aXplbklkOiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaXRpemVuaWR9IHwgSm9iOiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5qb2IubmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBwbGF5ZXJEYXRhOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIGpvYiBGUk9NIHBsYXllcnMgV0hFUkUgY2l0aXplbmlkID0gPyBMSU1JVCAxJywgW2NpdGl6ZW5JZF0pO1xuICAgICAgICBjb25zdCBqb2JEYXRhID0gSlNPTi5wYXJzZShwbGF5ZXJEYXRhWzBdLmpvYik7XG5cbiAgICAgICAgbGV0IGpvYjogYW55ID0ge307XG4gICAgICAgIGpvYi5uYW1lID0gJ3VuZW1wbG95ZWQnXG4gICAgICAgIGpvYi5sYWJlbCA9IEZyYW1ld29yay5TaGFyZWQuSm9ic1sndW5lbXBsb3llZCddLmxhYmVsXG4gICAgICAgIGpvYi5wYXltZW50ID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10uZ3JhZGVzWycwJ10ucGF5bWVudFxuICAgICAgICBqb2Iub25kdXR5ID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10uZGVmYXVsdER1dHlcbiAgICAgICAgam9iLmlzYm9zcyA9IGZhbHNlXG4gICAgICAgIGpvYi5ncmFkZSA9IHt9XG4gICAgICAgIGpvYi5ncmFkZS5uYW1lID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10uZ3JhZGVzWycwJ10ubmFtZVxuICAgICAgICBqb2IuZ3JhZGUubGV2ZWwgPSAwXG4gICAgICAgIGF3YWl0IFV0aWxzLnF1ZXJ5KCdVUERBVEUgcGxheWVycyBTRVQgam9iID0gPyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW0pTT04uc3RyaW5naWZ5KGpvYiksIGNpdGl6ZW5JZF0pO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCwgam9iTmFtZTogam9iRGF0YS5uYW1lIH0pO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JEYXRhLm5hbWUpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9lbXBsb3llZV9hY3Rpb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdPZmZsaW5lIEVtcGxveWVlIEZpcmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBPZmZsaW5lIGVtcGxveWVlICR7Y2l0aXplbklkfSBoYXMgYmVlbiBmaXJlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgSm9iOiAke2pvYkRhdGEubmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG59KTtcblxub25OZXQoJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Y2hhbmdlUmFua09mUGxheWVyJywgYXN5bmMgKGRhdGE6IGFueSkgPT4ge1xuICAgIGNvbnN0IHNvdXJjZSA9IGdsb2JhbC5zb3VyY2U7XG4gICAgY29uc3QgdGFyZ2V0RGF0YSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChkYXRhLnRhcmdldENpdGl6ZW5pZCk7XG4gICAgY29uc3QgbXVsdGlKb2IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBkYXRhLnRhcmdldENpdGl6ZW5pZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lIH0pO1xuICAgIGlmICh0YXJnZXREYXRhKSB7XG4gICAgICAgIGNvbnN0IGpvYm5hbWUgPSBkYXRhLmpvYk5hbWU7XG4gICAgICAgIHRhcmdldERhdGEuRnVuY3Rpb25zLlNldEpvYihqb2JuYW1lLCBkYXRhLmtleSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGNoYW5nZWQgdGhlIHJhbmsgb2YgJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3VyIHJhbmsgaGFzIGJlZW4gY2hhbmdlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBpZiAobXVsdGlKb2IpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSB9LCB7IGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIFVwZGF0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiB1cGRhdGVkIHRvICR7ZGF0YS5qb2JOYW1lfSB8IE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGdlbmVyYXRlVVVpZCgpLCBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUsIGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIEFkZGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtkYXRhLnRhcmdldENpdGl6ZW5pZH0gaGFzIGJlZW4gYWRkZWQgdG8gJHtkYXRhLmpvYk5hbWV9IHwgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9IGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBjaXRpemVuSWQ6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JuYW1lKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZW1wbG95ZWVfYWN0aW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUmFuayBDaGFuZ2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgYmVlbiBnaXZlbiBhIG5ldyByYW5rIGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBDaXRpemVuSWQ6ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH0gfCBKb2I6ICR7am9ibmFtZX0gfCAgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcGxheWVyRGF0YTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCBqb2IgRlJPTSBwbGF5ZXJzIFdIRVJFIGNpdGl6ZW5pZCA9ID8gTElNSVQgMScsIFtkYXRhLnRhcmdldENpdGl6ZW5pZF0pO1xuICAgICAgICBjb25zdCBqb2JEYXRhID0gSlNPTi5wYXJzZShwbGF5ZXJEYXRhWzBdLmpvYik7XG4gICAgICAgIGpvYkRhdGEuZ3JhZGUubGV2ZWwgPSBkYXRhLmtleTtcbiAgICAgICAgam9iRGF0YS5ncmFkZS5uYW1lID0gZGF0YS5ncmFkZU5hbWU7XG4gICAgICAgIGF3YWl0IFV0aWxzLnF1ZXJ5KCdVUERBVEUgcGxheWVycyBTRVQgam9iID0gPyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW0pTT04uc3RyaW5naWZ5KGpvYkRhdGEpLCBkYXRhLnRhcmdldENpdGl6ZW5pZF0pO1xuICAgICAgICBpZiAobXVsdGlKb2IpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSB9LCB7IGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIFVwZGF0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiB1cGRhdGVkIHRvICR7ZGF0YS5qb2JOYW1lfSB8IE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGdlbmVyYXRlVVVpZCgpLCBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUsIGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIEFkZGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtkYXRhLnRhcmdldENpdGl6ZW5pZH0gaGFzIGJlZW4gYWRkZWQgdG8gJHtkYXRhLmpvYk5hbWV9IHwgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9IGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBjaXRpemVuSWQ6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JEYXRhLm5hbWUpO1xuICAgIH1cbn0pO1xuXG5vbk5ldCgnc3VtbWl0X3Bob25lOnNlcnZlcjpmaXJlSW5hY3RpdmVFbXBsb3llZScsIGFzeW5jIChkYXRhOiB7IGpvYk5hbWU6IHN0cmluZywgY2l0aXplbklkOiBzdHJpbmcgfSkgPT4ge1xuICAgIGNvbnN0IHNvdXJjZSA9IGdsb2JhbC5zb3VyY2U7XG4gICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBkYXRhLmNpdGl6ZW5JZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lIH0pO1xuICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGZpcmVkIGFuIGluYWN0aXZlIGVtcGxveWVlYCxcbiAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgfSkpO1xuICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBzb3VyY2UsIGRhdGEuam9iTmFtZSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9lbXBsb3llZV9hY3Rpb24nLFxuICAgICAgICB0aXRsZTogJ0luYWN0aXZlIEVtcGxveWVlIEZpcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYEluYWN0aXZlIGVtcGxveWVlICR7ZGF0YS5jaXRpemVuSWR9IGhhcyBiZWVuIGZpcmVkIGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBKb2I6ICR7ZGF0YS5qb2JOYW1lfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbignc3VtbWl0X3Bob25lOnNlcnZlcjpoaXJlaW5NdWx0aUpvYicsIGFzeW5jIChjbGllbnQ6IHN0cmluZywgam9ibmFtZTogc3RyaW5nLCBncmFkZUxldmVsOiBudW1iZXIsIGpvYkxhYmVsOiBzdHJpbmcsIGdyYWRlTGFiZWw6IHN0cmluZykgPT4ge1xuICAgIC8qIGNvbnNvbGUubG9nKCdIaXJpbmcgaW4gbXVsdGkgam9iOicsIGpvYm5hbWUsIGdyYWRlTGV2ZWwsIGpvYkxhYmVsLCBncmFkZUxhYmVsKTsgKi9cbiAgICBjb25zdCB0YXJnZXRDaWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBtdWx0aUpvYkNoZWNrID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogdGFyZ2V0Q2lkLCBqb2JOYW1lOiBqb2JuYW1lIH0pO1xuICAgIGlmIChtdWx0aUpvYkNoZWNrKSB7XG4gICAgICAgIGlmIChtdWx0aUpvYkNoZWNrLmdyYWRlTGV2ZWwgIT09IGdyYWRlTGV2ZWwpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogdGFyZ2V0Q2lkLCBqb2JOYW1lOiBqb2JuYW1lIH0sIHsgZ3JhZGVMZXZlbCwgZ3JhZGVMYWJlbCB9KTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGJlZW4gaGlyZWQgaW4gYSBuZXcgcmFuazogJHtncmFkZUxhYmVsfWAsXG4gICAgICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBjbGllbnQsIGpvYm5hbWUpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgVXBkYXRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7dGFyZ2V0Q2lkfSBoYXMgYmVlbiB1cGRhdGVkIHRvICR7am9ibmFtZX0gfCBOZXcgUmFuazogJHtncmFkZUxhYmVsfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZW1pdE5ldCgnUUJDb3JlOk5vdGlmeScsIGNsaWVudCwgJ1lvdSBhcmUgYWxyZWFkeSBpbiB0aGlzIGpvYiB3aXRoIHRoaXMgZ3JhZGUgbGV2ZWwnLCAnZXJyb3InKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZ2VuZXJhdGVVVWlkKCksIGNpdGl6ZW5JZDogdGFyZ2V0Q2lkLCBqb2JOYW1lOiBqb2JuYW1lLCAgZ3JhZGVMZXZlbDogZ3JhZGVMZXZlbCwgam9iTGFiZWw6IGpvYkxhYmVsLCBncmFkZUxhYmVsOiBncmFkZUxhYmVsIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBiZWVuIGhpcmVkIGluIGEgbmV3IGpvYjogJHtqb2JMYWJlbH0gYXMgJHtncmFkZUxhYmVsfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIGNsaWVudCwgam9ibmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBBZGRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHt0YXJnZXRDaWR9IGhhcyBiZWVuIGFkZGVkIHRvICR7am9ibmFtZX0gfCBOZXcgUmFuazogJHtncmFkZUxhYmVsfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbn0pXG5cbnNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgam9iQXJyYXk6IGFueSA9IHt9O1xuICAgIGNvbnN0IGpvYkRhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdzdW1taXRfam9icycsIHt9KTtcbiAgICBqb2JEYXRhLmZvckVhY2goYXN5bmMgKGpvYjogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IHsgX2lkLCAuLi5yZXN0IH0gPSBqb2I7XG4gICAgICAgIExPR0dFUihgW1NVTU1JVF9QSE9ORV0gQ3JlYXRlZCBqb2IgJHtfaWR9IFN1Y2Nlc3NmdWxseWApO1xuICAgICAgICBqb2JBcnJheVtfaWRdID0gcmVzdDtcbiAgICB9KTtcbiAgICAvKiBjb25zdCBbdXBkYXRlZCwgbWVzc2FnZV0gPSBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uQWRkSm9icyhqb2JBcnJheSk7ICovXG59KTsgIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBQaG9uZU1haWwsIFBob25lUGxheWVyQ2FyZCB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi9jbGFzc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25DbGllbnRDYWxsYmFjaygnR2V0Q2xpZW50U2V0dGluZ3MnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGF3YWl0IFNldHRpbmdzLmVuc3VyZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgX2lkOiBTZXR0aW5ncy5faWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGJhY2tncm91bmQ6IFNldHRpbmdzLmJhY2tncm91bmQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGxvY2tzY3JlZW46IFNldHRpbmdzLmxvY2tzY3JlZW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHJpbmd0b25lOiBTZXR0aW5ncy5yaW5ndG9uZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IFNldHRpbmdzLnNob3dTdGFydHVwU2NyZWVuLmdldChjaXRpemVuSWQpLFxuICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogU2V0dGluZ3Muc2hvd05vdGlmaWNhdGlvbnMuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGlzTG9jazogU2V0dGluZ3MuaXNMb2NrLmdldChjaXRpemVuSWQpLFxuICAgICAgICBsb2NrUGluOiBTZXR0aW5ncy5sb2NrUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICB1c2VQaW46IFNldHRpbmdzLnVzZVBpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgdXNlRmFjZUlkOiBTZXR0aW5ncy51c2VGYWNlSWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGZhY2VJZElkZW50aWZpZXI6IFNldHRpbmdzLmZhY2VJZElkZW50aWZpZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHNtcnRJZDogU2V0dGluZ3Muc21ydElkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBkYXJrTWFpbElkQXR0YWNoZWQ6IFNldHRpbmdzLmRhcmtNYWlsSWRBdHRhY2hlZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgc21ydFBhc3N3b3JkOiBTZXR0aW5ncy5zbXJ0UGFzc3dvcmQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGlzRmxpZ2h0TW9kZTogU2V0dGluZ3MuaXNGbGlnaHRNb2RlLmdldChjaXRpemVuSWQpLFxuICAgICAgICBwaG9uZU51bWJlcjogU2V0dGluZ3MucGhvbmVOdW1iZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IFNldHRpbmdzLnBpZ2VvbklkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnU2V0Q2xpZW50U2V0dGluZ3MnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgYXdhaXQgU2V0dGluZ3MuZW5zdXJlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBjb25zdCBwYXJzZWREYXRhOiB7XG4gICAgICAgIGJhY2tncm91bmQ6IHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9O1xuICAgICAgICBsb2Nrc2NyZWVuOiB7IGN1cnJlbnQ6IHN0cmluZzsgd2FsbHBhcGVyczogc3RyaW5nW10gfTtcbiAgICAgICAgcmluZ3RvbmU6IHsgY3VycmVudDogc3RyaW5nOyByaW5ndG9uZXM6IHsgbmFtZTogc3RyaW5nLCB1cmw6IHN0cmluZyB9W10gfTtcbiAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IGJvb2xlYW47XG4gICAgICAgIHNob3dOb3RpZmljYXRpb25zOiBib29sZWFuO1xuICAgICAgICBpc0xvY2s6IGJvb2xlYW47XG4gICAgICAgIGxvY2tQaW46IHN0cmluZztcbiAgICAgICAgdXNlUGluOiBib29sZWFuO1xuICAgICAgICB1c2VGYWNlSWQ6IGJvb2xlYW47XG4gICAgICAgIGZhY2VJZElkZW50aWZpZXI6IHN0cmluZztcbiAgICAgICAgc21ydElkOiBzdHJpbmc7XG4gICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogc3RyaW5nO1xuICAgICAgICBzbXJ0UGFzc3dvcmQ6IHN0cmluZztcbiAgICAgICAgaXNGbGlnaHRNb2RlOiBib29sZWFuO1xuICAgICAgICBwaG9uZU51bWJlcjogc3RyaW5nO1xuICAgICAgICBwaWdlb25JZEF0dGFjaGVkOiBzdHJpbmc7XG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgU2V0dGluZ3MuYmFja2dyb3VuZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmJhY2tncm91bmQpO1xuICAgIFNldHRpbmdzLmxvY2tzY3JlZW4uc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5sb2Nrc2NyZWVuKTtcbiAgICBTZXR0aW5ncy5yaW5ndG9uZS5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnJpbmd0b25lKTtcbiAgICBTZXR0aW5ncy5zaG93U3RhcnR1cFNjcmVlbi5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnNob3dTdGFydHVwU2NyZWVuKTtcbiAgICBTZXR0aW5ncy5zaG93Tm90aWZpY2F0aW9ucy5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnNob3dOb3RpZmljYXRpb25zKTtcbiAgICBTZXR0aW5ncy5pc0xvY2suc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5pc0xvY2spO1xuICAgIFNldHRpbmdzLmxvY2tQaW4uc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5sb2NrUGluKTtcbiAgICBTZXR0aW5ncy51c2VQaW4uc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS51c2VQaW4pO1xuICAgIFNldHRpbmdzLnVzZUZhY2VJZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnVzZUZhY2VJZCk7XG4gICAgU2V0dGluZ3MuZmFjZUlkSWRlbnRpZmllci5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmZhY2VJZElkZW50aWZpZXIpO1xuICAgIFNldHRpbmdzLnNtcnRJZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnNtcnRJZCk7XG4gICAgU2V0dGluZ3Muc21ydFBhc3N3b3JkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuc21ydFBhc3N3b3JkKTtcbiAgICBTZXR0aW5ncy5pc0ZsaWdodE1vZGUuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5pc0ZsaWdodE1vZGUpO1xuICAgIFNldHRpbmdzLmRhcmtNYWlsSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmRhcmtNYWlsSWRBdHRhY2hlZCk7XG4gICAgU2V0dGluZ3MucGhvbmVOdW1iZXIuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5waG9uZU51bWJlcik7XG4gICAgU2V0dGluZ3MucGlnZW9uSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnBpZ2VvbklkQXR0YWNoZWQpO1xuICAgIGF3YWl0IFNldHRpbmdzLlNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfc2V0dGluZ3MnLFxuICAgICAgICB0aXRsZTogJ1NldHRpbmdzIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtjaXRpemVuSWR9IHwgTmFtZTogJHtnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0gbmV3IHNldHRpbmdzLCAke0pTT04uc3RyaW5naWZ5KHBhcnNlZERhdGEpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdSZWdpc3Rlck5ld01haWxBY2NvdW50JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgICAgICBlbWFpbDogc3RyaW5nO1xuICAgICAgICBwYXNzd29yZDogc3RyaW5nO1xuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGRhdGFYOiBQaG9uZU1haWwgPSB7XG4gICAgICAgIGFjdGl2ZU1haWRJZDogcGFyc2VkRGF0YS5lbWFpbCxcbiAgICAgICAgdXNlcm5hbWU6IHBhcnNlZERhdGEuZW1haWwsXG4gICAgICAgIGFjdGl2ZU1haWxQYXNzd29yZDogcGFyc2VkRGF0YS5wYXNzd29yZCxcbiAgICAgICAgYXZhdG9yOiAnJyxcbiAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgIH1cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBwYXJzZWREYXRhLmVtYWlsLCAuLi5kYXRhWCB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2VtYWlsJyxcbiAgICAgICAgdGl0bGU6ICdFbWFpbCBBY2NvdW50IFJlZ2lzdGVyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTmV3IGVtYWlsIGFjY291bnQgcmVnaXN0ZXJlZCB3aXRoIGVtYWlsICR7cGFyc2VkRGF0YS5lbWFpbH0sIHBhc3N3b3JkIFwiJHtwYXJzZWREYXRhLnBhc3N3b3JkfVwiLCBDaXRpemVuSWQ6ICR7YXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpfSwgTmFtZTogJHtnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWVcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdTZWFyY2hFbWFpbCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX21haWwnLCB7IF9pZDogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdMb2dpbk1haWxBY2NvdW50JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgICAgICBlbWFpbDogc3RyaW5nO1xuICAgICAgICBwYXNzd29yZDogc3RyaW5nO1xuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBwYXJzZWREYXRhLmVtYWlsIH0pO1xuICAgIGlmIChyZXMuYWN0aXZlTWFpbFBhc3N3b3JkID09PSBwYXJzZWREYXRhLnBhc3N3b3JkKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2VtYWlsJyxcbiAgICAgICAgICAgIHRpdGxlOiAnRW1haWwgTG9naW4nLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7Z2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpfSBOYW1lOiAke2dsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSBsb2dnZWQgaW4gdG8gZW1haWwgYWNjb3VudCAke3BhcnNlZERhdGEuZW1haWx9LCBwYXNzd29yZCBcIiR7cGFyc2VkRGF0YS5wYXNzd29yZH1cImAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3VuTG9ja29yTG9ja1Bob25lJywgYXN5bmMgKGNsaWVudCwgZGF0YTogYm9vbGVhbikgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBTZXR0aW5ncy5pc0xvY2suc2V0KGNpdGl6ZW5JZCwgZGF0YSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0UGhvbmVQbGF5ZXJDYXJkJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3BsYXllcl9jYXJkJywgeyBfaWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZTp1cGRhdGVQZXJzb25hbENhcmQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhOiBQaG9uZVBsYXllckNhcmQgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9wbGF5ZXJfY2FyZCcsIHsgX2lkOiBwYXJzZWREYXRhLl9pZCB9LCBwYXJzZWREYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX3BlcnNvbmFsX2NhcmQnLFxuICAgICAgICB0aXRsZTogJ1BlcnNvbmFsIENhcmQgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke3BhcnNlZERhdGEuX2lkfSB8IE5hbWU6ICR7Z2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IHVwZGF0ZWQgcGVyc29uYWwgY2FyZCwgJHtKU09OLnN0cmluZ2lmeShwYXJzZWREYXRhKX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcbiIsICJpbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL2NsYXNzXCI7XG5pbXBvcnQgeyB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5cblJlZ2lzdGVyQ29tbWFuZCgnc2F2ZVNldHRpbmdzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBhcmdzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGF3YWl0IFNldHRpbmdzLnNhdmUoKTtcbn0sIHRydWUpO1xuXG5jb25zdCBnZW5lcmF0ZVBob25lTnVtYmVyID0gYXN5bmMgKCk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gICAgY29uc3QgbnVtYmVyID0gYDU1OSR7TWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTBfMDAwXzAwMCkudG9TdHJpbmcoKS5wYWRTdGFydCg3LCBcIjBcIil9YDtcbiAgICBjb25zdCBleGlzdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG51bWJlcjogbnVtYmVyIH0pO1xuICAgIGlmIChleGlzdHMpIHJldHVybiBnZW5lcmF0ZVBob25lTnVtYmVyKCk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIEdlbmVyYXRlUGxheWVyUGhvbmVOdW1iZXIoY2l0aXplbklkOiBzdHJpbmcsIHNvdXJjZTogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgbnVtYmVyID0gYXdhaXQgZ2VuZXJhdGVQaG9uZU51bWJlcigpO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9udW1iZXJzJywge1xuICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICBvd25lcjogY2l0aXplbklkLFxuICAgICAgICBudW1iZXI6IG51bWJlcixcbiAgICB9KTtcblxuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9zZXR0aW5ncycsIHtcbiAgICAgICAgX2lkOiBjaXRpemVuSWQsXG4gICAgICAgIGJhY2tncm91bmQ6IHtcbiAgICAgICAgICAgIGN1cnJlbnQ6ICcnLFxuICAgICAgICAgICAgd2FsbHBhcGVyczogW10sXG4gICAgICAgIH0sXG4gICAgICAgIGxvY2tzY3JlZW46IHtcbiAgICAgICAgICAgIGN1cnJlbnQ6ICcnLFxuICAgICAgICAgICAgd2FsbHBhcGVyczogW10sXG4gICAgICAgIH0sXG4gICAgICAgIHJpbmd0b25lOiB7XG4gICAgICAgICAgICBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICByaW5ndG9uZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0JyxcbiAgICAgICAgICAgICAgICAgICAgdXJsOiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRydWUsXG4gICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0cnVlLFxuICAgICAgICBpc0xvY2s6IHRydWUsXG4gICAgICAgIGxvY2tQaW46ICcnLFxuICAgICAgICB1c2VQaW46IHRydWUsXG4gICAgICAgIHBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICAgIHVzZUZhY2VJZDogZmFsc2UsXG4gICAgICAgIGZhY2VJZElkZW50aWZpZXI6IGNpdGl6ZW5JZCxcbiAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiAnJyxcbiAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogJycsXG4gICAgICAgIHNtcnRJZDogJycsXG4gICAgICAgIHNtcnRQYXNzd29yZDogJycsXG4gICAgICAgIGlzRmxpZ2h0TW9kZTogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfcGxheWVyX2NhcmQnLCB7XG4gICAgICAgIF9pZDogY2l0aXplbklkLFxuICAgICAgICBmaXJzdE5hbWU6ICdTZXR1cCcsXG4gICAgICAgIGxhc3ROYW1lOiAnQ2FyZCcsXG4gICAgICAgIHBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICAgIGVtYWlsOiAnJyxcbiAgICAgICAgbm90ZXM6ICcnLFxuICAgICAgICBhdmF0YXI6ICcnLFxuICAgIH0pO1xuICAgIFNldHRpbmdzLlJlZ2lzdGVyTmV3U2V0dGluZ3MoY2l0aXplbklkLCBudW1iZXIpO1xuXHRpZiAoc291cmNlKSB7XG5cdFx0ZW1pdE5ldCgncGhvbmU6Y2xpZW50OnNldHVwUGhvbmUnLCBzb3VyY2UsIGNpdGl6ZW5JZCk7XG5cdH1cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX3NldHRpbmdzJyxcbiAgICAgICAgdGl0bGU6ICdQaG9uZSBOdW1iZXIgR2VuZXJhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBob25lIG51bWJlciAke251bWJlcn0gZ2VuZXJhdGVkIGZvciAke2NpdGl6ZW5JZH1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWUsXG4gICAgfSk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn1cbmV4cG9ydHMoJ0dlbmVyYXRlUGxheWVyUGhvbmVOdW1iZXInLCBHZW5lcmF0ZVBsYXllclBob25lTnVtYmVyKTtcblxub24oJ3R4QWRtaW46ZXZlbnRzOnNjaGVkdWxlZFJlc3RhcnQnLCBhc3luYyAoZGF0YTogYW55KSA9PiB7XG4gICAgYXdhaXQgU2V0dGluZ3Muc2F2ZSgpO1xuICAgIExPR0dFUihgW1NldHRpbmdzXSBTYXZlZCBkdXJpbmcgcmVzb3VyY2Ugc3RvcC5gKTtcbn0pO1xuXG5vbigndHhBZG1pbjpldmVudHM6c2VydmVyU2h1dHRpbmdEb3duJywgYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IFNldHRpbmdzLnNhdmUoKTtcbiAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgZHVyaW5nIHJlc291cmNlIHN0b3AuYCk7XG59KTsiLCAiaW1wb3J0IHsgTG9nZ2VyLCBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBUd2VldERhdGEsIFR3ZWV0UHJvZmlsZURhdGEgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxuY2xhc3MgUGlnZW9uU2VydmljZSB7XG4gICAgcHVibGljIGFzeW5jIHNlYXJjaFVzZXJFeGlzdChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogZGF0YSB9KTtcbiAgICAgICAgcmV0dXJuICEhdXNlcjtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbG9naW4oX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwsIHBhc3N3b3JkIH0pO1xuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVXNlciBMb2dpbicsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyIHdpdGggZW1haWwgJHtlbWFpbH0gbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseS5gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBsb2dpbjpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNpZ251cChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBleGlzdGluZ1VzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKGV4aXN0aW5nVXNlcikge1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiRW1haWwgYWxyZWFkeSB0YWtlblwiIH07XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGVtYWlsLFxuICAgICAgICAgICAgcGFzc3dvcmQsXG4gICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICB1c2VybmFtZTogZW1haWwsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZTogZW1haWwsXG4gICAgICAgICAgICBhdmF0YXI6IFwiXCIsXG4gICAgICAgICAgICBiYW5uZXI6IFwiXCIsXG4gICAgICAgICAgICBub3RpZmljYXRpb25zRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgYmlvOiBcIlwiLFxuICAgICAgICAgICAgZm9sbG93ZXJzOiBbXSxcbiAgICAgICAgICAgIGZvbGxvd2luZzogW10sXG4gICAgICAgIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdVc2VyIFNpZ251cCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgTmV3IHVzZXIgYWNjb3VudCBjcmVhdGVkIHdpdGggZW1haWwgJHtlbWFpbH0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldFByb2ZpbGUoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHVzZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFwiVXNlciBub3QgZm91bmRcIjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyB0b2dnbGVOb3RpZmljYXRpb25zKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgcmVzLm5vdGlmaWNhdGlvbnNFbmFibGVkID0gIXJlcy5ub3RpZmljYXRpb25zRW5hYmxlZDtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSwgcmVzKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTm90aWZpY2F0aW9ucyBUb2dnbGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSB0b2dnbGVkIG5vdGlmaWNhdGlvbnMgdG8gJHtyZXMubm90aWZpY2F0aW9uc0VuYWJsZWQgPyAnZW5hYmxlZCcgOiAnZGlzYWJsZWQnfS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBwb3N0VHdlZXQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IGVtYWlsLCBjb250ZW50LCBhdHRhY2htZW50cyB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCFyZXMpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgY29uc3QgdHdlZXQ6IFR3ZWV0RGF0YSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHVzZXJuYW1lOiByZXMuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICAgICAgZW1haWw6IHJlcy5lbWFpbCxcbiAgICAgICAgICAgICAgICBhdmF0YXI6IHJlcy5hdmF0YXIsXG4gICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHJlcy52ZXJpZmllZCxcbiAgICAgICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICAgICAgcmVwbGllc0NvdW50OiBbXSxcbiAgICAgICAgICAgICAgICByZXR3ZWV0Q291bnQ6IFtdLFxuICAgICAgICAgICAgICAgIGlzUmV0d2VldDogZmFsc2UsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiBudWxsLFxuICAgICAgICAgICAgICAgIGhhc2h0YWdzOiBjb250ZW50Lm1hdGNoKC8jXFx3Ky9nKSB8fCBbXSxcbiAgICAgICAgICAgICAgICBwYXJlbnRUd2VldElkOiBudWxsLFxuXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHR3ZWV0KTtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZWZyZXNoVHdlZXRcIiwgLTEsIEpTT04uc3RyaW5naWZ5KHR3ZWV0KSk7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCAtMSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBUd2VldCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3Jlcy5kaXNwbGF5TmFtZX0gaGFzIHBvc3RlZCBhIG5ldyB0d2VldC5gLFxuICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBgJHtyZXMuZGlzcGxheU5hbWV9IGhhcyBwb3N0ZWQgYSBuZXcgdHdlZXQuYCxcbiAgICAgICAgICAgICAgICBlbWFpbDogcmVzLmVtYWlsLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwicG9zdFwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IFBvc3RlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gcG9zdGVkIGEgbmV3IHR3ZWV0IChJRDogJHt0d2VldC5faWR9KSwgY29udGVudDogJHtjb250ZW50fWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBwb3N0VHdlZXQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRBbGxGZWVkKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgc3RhcnQgPSAxLCBlbmQgPSAyMCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHt9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgICAgIHNraXA6IHN0YXJ0IC0gMSxcbiAgICAgICAgICAgICAgICBsaW1pdDogZW5kLFxuICAgICAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBkYXRhOiByZXMsXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiByZXMubGVuZ3RoLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0RmVlZDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHBvc3RSZXBseShjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCBjb250ZW50LCBlbWFpbCwgYXR0YWNobWVudHMgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGNvbnN0IHR3ZWV0OiBUd2VldERhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICBjb25zdCByZXBseSA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB1c2VybmFtZTogdXNlci5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgICAgICAgYXZhdGFyOiB1c2VyLmF2YXRhcixcbiAgICAgICAgICAgIHZlcmlmaWVkOiB1c2VyLnZlcmlmaWVkLFxuICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgIGF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBsaWtlQ291bnQ6IFtdLFxuICAgICAgICAgICAgcmVwbGllc0NvdW50OiBbXSxcbiAgICAgICAgICAgIHJldHdlZXRDb3VudDogW10sXG4gICAgICAgICAgICBpc1JldHdlZXQ6IGZhbHNlLFxuICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiB0d2VldElkLFxuICAgICAgICAgICAgaGFzaHRhZ3M6IGNvbnRlbnQubWF0Y2goLyNcXHcrL2cpIHx8IFtdLFxuICAgICAgICAgICAgcGFyZW50VHdlZXRJZDogbnVsbFxuICAgICAgICB9O1xuICAgICAgICB0d2VldC5yZXBsaWVzQ291bnQucHVzaChjaXRpemVuSWQpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCByZXBseSk7XG4gICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZWZyZXNoUmVwb3N0XCIsIC0xLCBKU09OLnN0cmluZ2lmeShyZXBseSkpO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoYXdhaXQgVXRpbHMuR2V0Q2lkRnJvbVR3ZWV0SWQodHdlZXQuZW1haWwpKTtcbiAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgcmVzLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTmV3IFJlcGx5JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7dXNlci5kaXNwbGF5TmFtZX0gaGFzIHJlcGxpZWQgdG8gdHdlZXQuYCxcbiAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgY29udGVudDogYCR7dXNlci5kaXNwbGF5TmFtZX0gaGFzIHJlcGxpZWQgdG8gdHdlZXQuYCxcbiAgICAgICAgICAgICAgICBlbWFpbDogdHdlZXQuZW1haWwsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgdHlwZTogXCJwb3N0XCIsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBQb3N0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gcmVwbGllZCB0byB0d2VldCAoSUQ6ICR7dHdlZXRJZH0pLCBjb250ZW50OiAke2NvbnRlbnR9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBsaWtlVHdlZXQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCBsaWtlLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICBpZiAobGlrZSkge1xuICAgICAgICAgICAgdHdlZXQubGlrZUNvdW50LnB1c2goZW1haWwpO1xuICAgICAgICAgICAgY29uc3QgY2lkID0gYXdhaXQgVXRpbHMuR2V0Q2lkRnJvbVR3ZWV0SWQodHdlZXQuZW1haWwpO1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpZCk7XG4gICAgICAgICAgICBpZiAocmVzKSB7XG4gICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgcmVzLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgTGlrZScsXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtlbWFpbH0gaGFzIGxpa2VkIHlvdXIgdHdlZXQuYCxcbiAgICAgICAgICAgICAgICAgICAgYXBwOiAncGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl9ub3RpZmljYXRpb25zXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogYCR7ZW1haWx9IGhhcyBsaWtlZCB5b3VyIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgICAgIGVtYWlsOiB0d2VldC5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFwibGlrZVwiLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBMaWtlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gbGlrZWQgdHdlZXQgKElEOiAke3R3ZWV0SWR9KS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHdlZXQubGlrZUNvdW50ID0gdHdlZXQubGlrZUNvdW50LmZpbHRlcigobDogYW55KSA9PiBsICE9PSBlbWFpbCk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IExpa2VkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBsaWtlZCB0d2VldCAoSUQ6ICR7dHdlZXRJZH0pLmAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGxpa2VSZXBsaWVzVHdlZXQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCBsaWtlLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHJldHVybiBjb25zb2xlLmxvZyhcIlR3ZWV0IG5vdCBmb3VuZFwiKTtcbiAgICAgICAgaWYgKGxpa2UpIHtcbiAgICAgICAgICAgIHR3ZWV0Lmxpa2VDb3VudC5wdXNoKGVtYWlsKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUmVwbHkgTGlrZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGxpa2VkIHJlcGx5IChJRDogJHt0d2VldElkfSkuYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHR3ZWV0Lmxpa2VDb3VudCA9IHR3ZWV0Lmxpa2VDb3VudC5maWx0ZXIoKGw6IGFueSkgPT4gbCAhPT0gZW1haWwpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBVbmxpa2VkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSB1bmxpa2VkIHJlcGx5IChJRDogJHt0d2VldElkfSkuYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZXR3ZWV0KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCByZXR3ZWV0LCBwaWdlb25JZCwgb2dUd2VldElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbFR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXRXZWV0dXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBwaWdlb25JZCB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIW9yaWdpbmFsVHdlZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiT3JpZ2luYWwgdHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQucHVzaChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9LCBvcmlnaW5hbFR3ZWV0KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHJldHdlZXREYXRhOiBUd2VldERhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIHVzZXJuYW1lOiByZXRXZWV0dXNlci5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZW1haWw6IHJldFdlZXR1c2VyLmVtYWlsLFxuICAgICAgICAgICAgICAgICAgICBhdmF0YXI6IHJldFdlZXR1c2VyLmF2YXRhcixcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHJldFdlZXR1c2VyLnZlcmlmaWVkLFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBvcmlnaW5hbFR3ZWV0LmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBvcmlnaW5hbFR3ZWV0LmF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgbGlrZUNvdW50OiBbXSxcbiAgICAgICAgICAgICAgICAgICAgcmVwbGllc0NvdW50OiBbXSxcbiAgICAgICAgICAgICAgICAgICAgcmV0d2VldENvdW50OiBbXSxcbiAgICAgICAgICAgICAgICAgICAgaXNSZXR3ZWV0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0SWQ6IHR3ZWV0SWQsXG4gICAgICAgICAgICAgICAgICAgIGhhc2h0YWdzOiBvcmlnaW5hbFR3ZWV0Lmhhc2h0YWdzLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRUd2VldElkOiBudWxsLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHJldHdlZXREYXRhKTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmVmcmVzaFR3ZWV0XCIsIC0xLCBKU09OLnN0cmluZ2lmeShyZXR3ZWV0RGF0YSkpO1xuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBSZXR3ZWV0ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke3BpZ2VvbklkfSByZXR3ZWV0ZWQgdHdlZXQgKElEOiAke3R3ZWV0SWR9KSwgb3JpZ2luYWwgdHdlZXQgSUQ6ICR7b2dUd2VldElkfSwgY29udGVudDogJHtvcmlnaW5hbFR3ZWV0LmNvbnRlbnR9YCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghcmV0d2VldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiBvZ1R3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcmlnaW5hbFR3ZWV0IHx8ICFyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIk9yaWdpbmFsIHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUmVtb3ZlIG9ubHkgZmlyc3Qgb2NjdXJyZW5jZSBvZiBjaXRpemVuSWRcbiAgICAgICAgICAgICAgICBsZXQgcmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50ID0gb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQuZmlsdGVyKChsOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGwgPT09IGNpdGl6ZW5JZCAmJiAhcmVtb3ZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiBvZ1R3ZWV0SWQgfSwgb3JpZ2luYWxUd2VldCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdSZXR3ZWV0IFJlbW92ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciByZW1vdmVkIHJldHdlZXQgKElEOiAke3R3ZWV0SWR9KSBvZiBvcmlnaW5hbCB0d2VldCAoSUQ6ICR7b2dUd2VldElkfSksIGNvbnRlbnQ6ICR7b3JpZ2luYWxUd2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIHJldHdlZXQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZXR3ZWV0UmVwbGllc1R3ZWV0KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCByZXR3ZWV0LCBwaWdlb25JZCwgb2dUd2VldElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbFR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9nVHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiBvcmlnaW5hbFR3ZWV0Lm9yaWdpbmFsVHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXRXZWV0dXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBwaWdlb25JZCB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIW9yaWdpbmFsVHdlZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiT3JpZ2luYWwgdHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQucHVzaChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgIG9nVHdlZXQucmVwbGllc0NvdW50LnB1c2goY2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IG9yaWdpbmFsVHdlZXQub3JpZ2luYWxUd2VldElkIH0sIG9nVHdlZXQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0sIG9yaWdpbmFsVHdlZXQpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcmV0d2VldERhdGE6IFR3ZWV0RGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgdXNlcm5hbWU6IHJldFdlZXR1c2VyLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgICAgICAgICBlbWFpbDogcmV0V2VldHVzZXIuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgIGF2YXRhcjogcmV0V2VldHVzZXIuYXZhdGFyLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZDogcmV0V2VldHVzZXIudmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG9yaWdpbmFsVHdlZXQuY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHM6IG9yaWdpbmFsVHdlZXQuYXR0YWNobWVudHMsXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICBsaWtlQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICByZXBsaWVzQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICByZXR3ZWV0Q291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICBpc1JldHdlZXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXRJZDogb3JpZ2luYWxUd2VldC5vcmlnaW5hbFR3ZWV0SWQsXG4gICAgICAgICAgICAgICAgICAgIGhhc2h0YWdzOiBvcmlnaW5hbFR3ZWV0Lmhhc2h0YWdzLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRUd2VldElkOiB0d2VldElkLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgcmV0d2VldERhdGEpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZWZyZXNoUmVwb3N0XCIsIC0xLCBKU09OLnN0cmluZ2lmeShyZXR3ZWV0RGF0YSkpO1xuICAgICAgICAgICAgICAgIGlmIChvZ1R3ZWV0LnJlcGxpZXNDb3VudCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1bmlxdWVDaWRzID0gWy4uLm5ldyBTZXQob2dUd2VldC5yZXBsaWVzQ291bnQpXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCByZXBseUNpZCBvZiB1bmlxdWVDaWRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQocmVwbHlDaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgcmVzLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnTmV3IFJlcGx5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7cmV0V2VldHVzZXIuZGlzcGxheU5hbWV9IGhhcyByZXBsaWVkIHRvIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiAncGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl9ub3RpZmljYXRpb25zXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGB7cmV0V2VldHVzZXIuZGlzcGxheU5hbWV9IGhhcyByZXBsaWVkIHRvIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1haWw6IHJldFdlZXR1c2VyLmVtYWlsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwicG9zdFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1JlcGx5IFJldHdlZXRlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7cGlnZW9uSWR9IHJldHdlZXRlZCByZXBseSAoSUQ6ICR7dHdlZXRJZH0pLCBvcmlnaW5hbCB0d2VldCBJRDogJHtvZ1R3ZWV0SWR9KSwgY29udGVudDogJHtvcmlnaW5hbFR3ZWV0LmNvbnRlbnR9YCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghcmV0d2VldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IG9nVHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWxUd2VldCB8fCAhcmV0d2VldCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJPcmlnaW5hbCB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBvbmx5IGZpcnN0IG9jY3VycmVuY2Ugb2YgY2l0aXplbklkXG4gICAgICAgICAgICAgICAgbGV0IHJlbW92ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudCA9IG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50LmZpbHRlcigobDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsID09PSBjaXRpemVuSWQgJiYgIXJlbW92ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50KTsgKi9cbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogb2dUd2VldElkIH0sIG9yaWdpbmFsVHdlZXQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdSZXR3ZWV0IG9mIFJlcGx5IFJlbW92ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciByZW1vdmVkIHJldHdlZXQgKElEOiAke3R3ZWV0SWR9KSBvZiByZXBseSAoSUQ6ICR7b2dUd2VldElkfSksIGNvbnRlbnQ6ICR7b3JpZ2luYWxUd2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIHJldHdlZXQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBkZWxldGVUd2VldChfY2xpZW50OiBudW1iZXIsIHR3ZWV0SWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFR3ZWV0IG5vdCBmb3VuZCBmb3IgZGVsZXRpb246ICR7dHdlZXRJZH1gKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIlR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IERlbGV0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFR3ZWV0IChJRDogJHt0d2VldElkfSkgZGVsZXRlZCBieSB1c2VyICR7dHdlZXQuZW1haWx9LCBjb250ZW50OiAke3R3ZWV0LmNvbnRlbnR9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBkZWxldGVSZXBsaWVzVHdlZXQoX2NsaWVudDogbnVtYmVyLCB0d2VldElkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFJlcGx5IHR3ZWV0IG5vdCBmb3VuZCBmb3IgZGVsZXRpb246ICR7dHdlZXRJZH1gKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIlJlcGx5IHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUmVwbHkgRGVsZXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgUmVwbHkgKElEOiAke3R3ZWV0SWR9KSBkZWxldGVkLCBjb250ZW50OiAke3R3ZWV0LmNvbnRlbnR9IGJ5IHVzZXIgJHt0d2VldC5lbWFpbH1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRQb3N0UmVwbGllcyhfY2xpZW50OiBudW1iZXIsIHR3ZWV0SWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXBsaWVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IG9yaWdpbmFsVHdlZXRJZDogdHdlZXRJZCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXBsaWVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgaW5jcmVhc2VSZXBsaWVzQ291bnQoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICB0d2VldC5yZXBsaWVzQ291bnQucHVzaChhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KSk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGRlY3JlYXNlUmVwbGllc0NvdW50KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyB0d2VldElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgY29uc3QgY2lkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgIGlmICghdHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBUd2VldCBub3QgZm91bmQgZm9yIHR3ZWV0SWQ6ICR7dHdlZXRJZH1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgcmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdHdlZXQucmVwbGllc0NvdW50ID0gdHdlZXQucmVwbGllc0NvdW50LmZpbHRlcigocjogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHIgPT09IGNpZCAmJiAhcmVtb3ZlZCkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVSZXN1bHQgPSBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuXG4gICAgICAgICAgICBpZiAoIXVwZGF0ZVJlc3VsdCB8fCB1cGRhdGVSZXN1bHQubW9kaWZpZWRDb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gY2hhbmdlcyBtYWRlIHRvIHR3ZWV0ICR7dHdlZXRJZH0gcmVwbGllc0NvdW50YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IFwiTm8gY2hhbmdlcyBtYWRlIHRvIHJlcGxpZXMgY291bnRcIiB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhgU3VjY2Vzc2Z1bGx5IGRlY3JlYXNlZCByZXBsaWVzQ291bnQgZm9yIHR3ZWV0ICR7dHdlZXRJZH1gKTsgKi9cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGRlY3JlYXNlUmVwbGllc0NvdW50OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiLCBkZXRhaWxzOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZm9sbG93VXNlcihfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHRhcmdldEVtYWlsLCBjdXJyZW50RW1haWwsIGZvbGxvdyB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFVzZXI6IFR3ZWV0UHJvZmlsZURhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogdGFyZ2V0RW1haWwgfSk7XG4gICAgICAgICAgICBpZiAoIXRhcmdldFVzZXIpIHJldHVybiB7IGVycm9yOiBcIlRhcmdldCB1c2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRVc2VyOiBUd2VldFByb2ZpbGVEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IGN1cnJlbnRFbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghY3VycmVudFVzZXIpIHJldHVybiB7IGVycm9yOiBcIkN1cnJlbnQgdXNlciBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICBpZiAoZm9sbG93KSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRVc2VyLmZvbGxvd2Vycy5pbmNsdWRlcyhjdXJyZW50RW1haWwpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFVzZXIuZm9sbG93ZXJzLnB1c2goY3VycmVudEVtYWlsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFjdXJyZW50VXNlci5mb2xsb3dpbmcuaW5jbHVkZXModGFyZ2V0RW1haWwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRVc2VyLmZvbGxvd2luZy5wdXNoKHRhcmdldEVtYWlsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1VzZXIgRm9sbG93ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2N1cnJlbnRFbWFpbH0gZm9sbG93ZWQgJHt0YXJnZXRFbWFpbH0uYCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRVc2VyLmZvbGxvd2VycyA9IHRhcmdldFVzZXIuZm9sbG93ZXJzLmZpbHRlcihlbWFpbCA9PiBlbWFpbCAhPT0gY3VycmVudEVtYWlsKTtcbiAgICAgICAgICAgICAgICBjdXJyZW50VXNlci5mb2xsb3dpbmcgPSBjdXJyZW50VXNlci5mb2xsb3dpbmcuZmlsdGVyKGVtYWlsID0+IGVtYWlsICE9PSB0YXJnZXRFbWFpbCk7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1VzZXIgVW5mb2xsb3dlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7Y3VycmVudEVtYWlsfSB1bmZvbGxvd2VkICR7dGFyZ2V0RW1haWx9LmAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogdGFyZ2V0RW1haWwgfSwgdGFyZ2V0VXNlcik7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBjdXJyZW50RW1haWwgfSwgY3VycmVudFVzZXIpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZm9sbG93VXNlcjpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdXBkYXRpbmcgZm9sbG93IHN0YXR1c1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0VXNlclR3ZWV0cyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IGVtYWlsIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldEFsbFBvc3RSZXBsaWVzKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBlbWFpbDogZW1haWwgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QWxsTGlrZWRUd2VldHMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBsaWtlQ291bnQ6IGVtYWlsIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNlYXJjaFVzZXJzKF9jbGllbnQ6IG51bWJlciwgdmFsdWU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogeyAkcmVnZXg6IHZhbHVlLCAkb3B0aW9uczogXCJpXCIgfSB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXROb3RpZmljYXRpb25zKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7IGVtYWlsIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGNoYW5nZVBhc3N3b3JkKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG4gICAgICAgIGNvbnN0IG9sZFBhc3N3b3JkID0gdXNlci5wYXNzd29yZDtcbiAgICAgICAgdXNlci5wYXNzd29yZCA9IHBhc3N3b3JkO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0sIHVzZXIpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdQYXNzd29yZCBDaGFuZ2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGNoYW5nZWQgdGhlaXIgcGFzc3dvcmQsIG9sZCBwYXNzd29yZDogJHtvbGRQYXNzd29yZH0sIG5ldyBwYXNzd29yZDogJHtwYXNzd29yZH1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIHB1YmxpYyBhc3luYyB1cGRhdGVQcm9maWxlKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcGFyc2VkRGF0YTogVHdlZXRQcm9maWxlRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IG9sZFVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcGFyc2VkRGF0YS5lbWFpbCB9KTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHBhcnNlZERhdGEuZW1haWwgfSwgcGFyc2VkRGF0YSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1Byb2ZpbGUgVXBkYXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke3BhcnNlZERhdGEuZW1haWx9IHVwZGF0ZWQgdGhlaXIgcHJvZmlsZSwgb2xkIGRhdGE6ICR7SlNPTi5zdHJpbmdpZnkob2xkVXNlcil9LCBuZXcgZGF0YTogJHtKU09OLnN0cmluZ2lmeShwYXJzZWREYXRhKX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIFwic3VjY2Vzc1wiO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyB2ZXJpZnlVc2VyKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG4gICAgICAgIHVzZXIudmVyaWZpZWQgPSB0cnVlO1xuICAgICAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9LCB1c2VyKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnVXNlciBWZXJpZmllZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBoYXMgYmVlbiB2ZXJpZmllZC5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gUHJpdmF0ZSBNZXNzYWdpbmcgRnVuY3Rpb25zXG4gICAgcHVibGljIGFzeW5jIHNlbmRQcml2YXRlTWVzc2FnZShfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHNlbmRlckVtYWlsLCByZWNpcGllbnRFbWFpbCwgY29udGVudCwgYXR0YWNobWVudHMgPSBbXSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgICAgICAgICAgLy8gVmVyaWZ5IGJvdGggdXNlcnMgZXhpc3RcbiAgICAgICAgICAgIGNvbnN0IHNlbmRlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBzZW5kZXJFbWFpbCB9KTtcbiAgICAgICAgICAgIGNvbnN0IHJlY2lwaWVudCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiByZWNpcGllbnRFbWFpbCB9KTtcblxuICAgICAgICAgICAgaWYgKCFzZW5kZXIgfHwgIXJlY2lwaWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHNlbmRlckVtYWlsLFxuICAgICAgICAgICAgICAgIHJlY2lwaWVudEVtYWlsLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgYXR0YWNobWVudHMsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZGVsZXRlZEJ5U2VuZGVyOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkZWxldGVkQnlSZWNpcGllbnQ6IGZhbHNlXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIG1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAvLyBHZXQgYWxsIENpdGl6ZW4gSURzIGZvciBib3RoIHNlbmRlciBhbmQgcmVjaXBpZW50IChtdWx0aXBsZSBkZXZpY2VzIHN1cHBvcnQpXG4gICAgICAgICAgICBjb25zdCBzZW5kZXJDaWRzID0gYXdhaXQgVXRpbHMuR2V0Q2lkc0Zyb21QaWdlb25FbWFpbChzZW5kZXJFbWFpbCk7XG4gICAgICAgICAgICBjb25zdCByZWNpcGllbnRDaWRzID0gYXdhaXQgVXRpbHMuR2V0Q2lkc0Zyb21QaWdlb25FbWFpbChyZWNpcGllbnRFbWFpbCk7XG5cbiAgICAgICAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9ucyBhbmQgcmVmcmVzaCBldmVudHMgdG8gYWxsIHJlY2lwaWVudCBkZXZpY2VzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlY2lwaWVudENpZCBvZiByZWNpcGllbnRDaWRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVjaXBpZW50UGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKHJlY2lwaWVudENpZCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlY2lwaWVudFBsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZWNpcGllbnRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnTmV3IE1lc3NhZ2UnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgcmVjZWl2ZWQgYSBtZXNzYWdlIGZyb20gJHtzZW5kZXIuZGlzcGxheU5hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBTZW5kIE5VSSBldmVudCB0byByZWZyZXNoIGNoYXQgaWYgcmVjaXBpZW50IGlzIGluIGNoYXRcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6cmVmcmVzaFByaXZhdGVNZXNzYWdlJywgcmVjaXBpZW50UGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyRW1haWw6IHNlbmRlckVtYWlsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVjaXBpZW50RW1haWw6IHJlY2lwaWVudEVtYWlsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNlbmQgcmVmcmVzaCBldmVudCB0byBhbGwgc2VuZGVyIGRldmljZXNcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc2VuZGVyQ2lkIG9mIHNlbmRlckNpZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZW5kZXJQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoc2VuZGVyQ2lkKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VuZGVyUGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOnJlZnJlc2hQcml2YXRlTWVzc2FnZScsIHNlbmRlclBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlckVtYWlsOiBzZW5kZXJFbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlY2lwaWVudEVtYWlsOiByZWNpcGllbnRFbWFpbFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1ByaXZhdGUgTWVzc2FnZSBTZW50JyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJFbWFpbH0gc2VudCBhIHByaXZhdGUgbWVzc2FnZSB0byAke3JlY2lwaWVudEVtYWlsfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2VJZDogbWVzc2FnZS5faWQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBzZW5kUHJpdmF0ZU1lc3NhZ2U6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHNlbmRpbmcgbWVzc2FnZVwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0UHJpdmF0ZU1lc3NhZ2VzKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgdXNlckVtYWlsLCBvdGhlclVzZXJFbWFpbCwgbGltaXQgPSA1MCwgb2Zmc2V0ID0gMCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwge1xuICAgICAgICAgICAgICAgICRvcjogW1xuICAgICAgICAgICAgICAgICAgICB7IHNlbmRlckVtYWlsOiB1c2VyRW1haWwsIHJlY2lwaWVudEVtYWlsOiBvdGhlclVzZXJFbWFpbCB9LFxuICAgICAgICAgICAgICAgICAgICB7IHNlbmRlckVtYWlsOiBvdGhlclVzZXJFbWFpbCwgcmVjaXBpZW50RW1haWw6IHVzZXJFbWFpbCB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAkYW5kOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgZGVsZXRlZEJ5U2VuZGVyOiB7ICRuZTogdHJ1ZSB9IH0sXG4gICAgICAgICAgICAgICAgICAgIHsgZGVsZXRlZEJ5UmVjaXBpZW50OiB7ICRuZTogdHJ1ZSB9IH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9LFxuICAgICAgICAgICAgICAgIHNraXA6IG9mZnNldCxcbiAgICAgICAgICAgICAgICBsaW1pdDogbGltaXRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobWVzc2FnZXMpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldFByaXZhdGVNZXNzYWdlczpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgbWVzc2FnZXNcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldENvbnZlcnNhdGlvbnMoX2NsaWVudDogbnVtYmVyLCB1c2VyRW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgYWxsIHVuaXF1ZSBjb252ZXJzYXRpb25zIGZvciB0aGUgdXNlclxuICAgICAgICAgICAgY29uc3QgY29udmVyc2F0aW9ucyA9IGF3YWl0IE1vbmdvREIuYWdncmVnYXRlKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJG1hdGNoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHNlbmRlckVtYWlsOiB1c2VyRW1haWwgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHJlY2lwaWVudEVtYWlsOiB1c2VyRW1haWwgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICRhbmQ6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGRlbGV0ZWRCeVNlbmRlcjogeyAkbmU6IHRydWUgfSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgZGVsZXRlZEJ5UmVjaXBpZW50OiB7ICRuZTogdHJ1ZSB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJGdyb3VwOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkY29uZDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ICRlcTogW1wiJHNlbmRlckVtYWlsXCIsIHVzZXJFbWFpbF0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIkcmVjaXBpZW50RW1haWxcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIkc2VuZGVyRW1haWxcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogeyAkZmlyc3Q6IFwiJCRST09UXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVucmVhZENvdW50OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHN1bToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkY29uZDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAkYW5kOiBbeyAkZXE6IFtcIiRyZWNpcGllbnRFbWFpbFwiLCB1c2VyRW1haWxdIH0sIHsgJGVxOiBbXCIkcmVhZFwiLCBmYWxzZV0gfV0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJGxvb2t1cDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJvbTogXCJwaG9uZV9waWdlb25fdXNlcnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsRmllbGQ6IFwiX2lkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JlaWduRmllbGQ6IFwiZW1haWxcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzOiBcInVzZXJJbmZvXCJcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkdW53aW5kOiBcIiR1c2VySW5mb1wiXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRwcm9qZWN0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdGhlclVzZXI6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWFpbDogXCIkdXNlckluZm8uZW1haWxcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNwbGF5TmFtZTogXCIkdXNlckluZm8uZGlzcGxheU5hbWVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdmF0YXI6IFwiJHVzZXJJbmZvLmF2YXRhclwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiBcIiR1c2VySW5mby52ZXJpZmllZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnJlYWRDb3VudDogMVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRzb3J0OiB7IFwibGFzdE1lc3NhZ2UuY3JlYXRlZEF0XCI6IC0xIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdKTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNvbnZlcnNhdGlvbnMpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldENvbnZlcnNhdGlvbnM6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIGNvbnZlcnNhdGlvbnNcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIG1hcmtNZXNzYWdlQXNSZWFkKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgbWVzc2FnZUlkLCB1c2VyRW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7IF9pZDogbWVzc2FnZUlkIH0pO1xuICAgICAgICAgICAgaWYgKCFtZXNzYWdlKSByZXR1cm4geyBlcnJvcjogXCJNZXNzYWdlIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIC8vIE9ubHkgbWFyayBhcyByZWFkIGlmIHRoZSB1c2VyIGlzIHRoZSByZWNpcGllbnRcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnJlY2lwaWVudEVtYWlsID09PSB1c2VyRW1haWwpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlLnJlYWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgeyBfaWQ6IG1lc3NhZ2VJZCB9LCBtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIG1hcmtNZXNzYWdlQXNSZWFkOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBtYXJraW5nIG1lc3NhZ2UgYXMgcmVhZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGVsZXRlTWVzc2FnZShfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IG1lc3NhZ2VJZCwgdXNlckVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgeyBfaWQ6IG1lc3NhZ2VJZCB9KTtcbiAgICAgICAgICAgIGlmICghbWVzc2FnZSkgcmV0dXJuIHsgZXJyb3I6IFwiTWVzc2FnZSBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICAvLyBNYXJrIGFzIGRlbGV0ZWQgYnkgdGhlIGFwcHJvcHJpYXRlIHVzZXJcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnNlbmRlckVtYWlsID09PSB1c2VyRW1haWwpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlLmRlbGV0ZWRCeVNlbmRlciA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG1lc3NhZ2UucmVjaXBpZW50RW1haWwgPT09IHVzZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UuZGVsZXRlZEJ5UmVjaXBpZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiVW5hdXRob3JpemVkXCIgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7IF9pZDogbWVzc2FnZUlkIH0sIG1lc3NhZ2UpO1xuXG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ01lc3NhZ2UgRGVsZXRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHt1c2VyRW1haWx9IGRlbGV0ZWQgYSBwcml2YXRlIG1lc3NhZ2VgLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZGVsZXRlTWVzc2FnZTpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZGVsZXRpbmcgbWVzc2FnZVwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBFbmhhbmNlZCBGb2xsb3dlcnMvRm9sbG93aW5nIEZ1bmN0aW9uc1xuICAgIHB1YmxpYyBhc3luYyBnZXRGb2xsb3dlcnMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghdXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICBjb25zdCBmb2xsb3dlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsXG4gICAgICAgICAgICAgICAgeyBlbWFpbDogeyAkaW46IHVzZXIuZm9sbG93ZXJzIH0gfSxcbiAgICAgICAgICAgICAgICBudWxsLCBmYWxzZSxcbiAgICAgICAgICAgICAgICB7IHNvcnQ6IHsgZGlzcGxheU5hbWU6IDEgfSB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZm9sbG93ZXJzKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBnZXRGb2xsb3dlcnM6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIGZvbGxvd2Vyc1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0Rm9sbG93aW5nKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgICAgICBpZiAoIXVzZXIpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgY29uc3QgZm9sbG93aW5nID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLFxuICAgICAgICAgICAgICAgIHsgZW1haWw6IHsgJGluOiB1c2VyLmZvbGxvd2luZyB9IH0sXG4gICAgICAgICAgICAgICAgbnVsbCwgZmFsc2UsXG4gICAgICAgICAgICAgICAgeyBzb3J0OiB7IGRpc3BsYXlOYW1lOiAxIH0gfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGZvbGxvd2luZyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0Rm9sbG93aW5nOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBmb2xsb3dpbmdcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG59XG5cbmV4cG9ydCBjb25zdCBwaWdlb25TZXJ2aWNlID0gbmV3IFBpZ2VvblNlcnZpY2UoKTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IHBpZ2VvblNlcnZpY2UgfSBmcm9tIFwiLi9QaWdlb25TZXJ2aWNlXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246c2VhcmNoVXNlcnNcIiwgcGlnZW9uU2VydmljZS5zZWFyY2hVc2VyRXhpc3QpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjpsb2dpblwiLCBwaWdlb25TZXJ2aWNlLmxvZ2luKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246c2lnbnVwXCIsIHBpZ2VvblNlcnZpY2Uuc2lnbnVwKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246dG9nZ2xlTm90aWZpY2F0aW9uc1wiLCBwaWdlb25TZXJ2aWNlLnRvZ2dsZU5vdGlmaWNhdGlvbnMpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjpwb3N0VHdlZXRcIiwgcGlnZW9uU2VydmljZS5wb3N0VHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpnZXRQcm9maWxlXCIsIHBpZ2VvblNlcnZpY2UuZ2V0UHJvZmlsZSk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmdldEFsbEZlZWRcIiwgcGlnZW9uU2VydmljZS5nZXRBbGxGZWVkKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246bGlrZVR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UubGlrZVR3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmV0d2VldFR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UucmV0d2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmRlbGV0ZVR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UuZGVsZXRlVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjpwb3N0UmVwbHlcIiwgcGlnZW9uU2VydmljZS5wb3N0UmVwbHkpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpnZXRSZXBsaWVzXCIsIHBpZ2VvblNlcnZpY2UuZ2V0UG9zdFJlcGxpZXMpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpsaWtlUmVwb3N0VHdlZXRcIiwgcGlnZW9uU2VydmljZS5saWtlUmVwbGllc1R3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmV0d2VldFJlcG9zdFR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UucmV0d2VldFJlcGxpZXNUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmluY3JlYXNlUmVwbGllc0NvdW50XCIsIHBpZ2VvblNlcnZpY2UuaW5jcmVhc2VSZXBsaWVzQ291bnQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpkZWNyZWFzZVJlcGxpZXNDb3VudFwiLCBwaWdlb25TZXJ2aWNlLmRlY3JlYXNlUmVwbGllc0NvdW50KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246ZGVsZXRlUmVwbGllc1R3ZWV0XCIsIHBpZ2VvblNlcnZpY2UuZGVsZXRlUmVwbGllc1R3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Zm9sbG93VXNlclwiLCBwaWdlb25TZXJ2aWNlLmZvbGxvd1VzZXIpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpnZXRVc2VyVHdlZXRzXCIsIHBpZ2VvblNlcnZpY2UuZ2V0VXNlclR3ZWV0cyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0QWxsUG9zdFJlcGxpZXMnLCBwaWdlb25TZXJ2aWNlLmdldEFsbFBvc3RSZXBsaWVzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRBbGxMaWtlZFR3ZWV0cycsIHBpZ2VvblNlcnZpY2UuZ2V0QWxsTGlrZWRUd2VldHMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOnNlYXJjaFVzZXJzWCcsIHBpZ2VvblNlcnZpY2Uuc2VhcmNoVXNlcnMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldE5vdGlmaWNhdGlvbnMnLCBwaWdlb25TZXJ2aWNlLmdldE5vdGlmaWNhdGlvbnMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmNoYW5nZVBhc3N3b3JkJywgcGlnZW9uU2VydmljZS5jaGFuZ2VQYXNzd29yZCk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246dXBkYXRlUHJvZmlsZScsIHBpZ2VvblNlcnZpY2UudXBkYXRlUHJvZmlsZSk7XG5cbi8vIFByaXZhdGUgTWVzc2FnaW5nIENhbGxiYWNrc1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOnNlbmRQcml2YXRlTWVzc2FnZScsIHBpZ2VvblNlcnZpY2Uuc2VuZFByaXZhdGVNZXNzYWdlKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRQcml2YXRlTWVzc2FnZXMnLCBwaWdlb25TZXJ2aWNlLmdldFByaXZhdGVNZXNzYWdlcyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0Q29udmVyc2F0aW9ucycsIChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIHBpZ2VvblNlcnZpY2UuZ2V0Q29udmVyc2F0aW9ucyhjbGllbnQsIGRhdGEpO1xufSk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246bWFya01lc3NhZ2VBc1JlYWQnLCBwaWdlb25TZXJ2aWNlLm1hcmtNZXNzYWdlQXNSZWFkKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpkZWxldGVNZXNzYWdlJywgcGlnZW9uU2VydmljZS5kZWxldGVNZXNzYWdlKTtcblxuLy8gRW5oYW5jZWQgRm9sbG93ZXJzL0ZvbGxvd2luZyBDYWxsYmFja3Ncbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRGb2xsb3dlcnMnLCBwaWdlb25TZXJ2aWNlLmdldEZvbGxvd2Vycyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0Rm9sbG93aW5nJywgcGlnZW9uU2VydmljZS5nZXRGb2xsb3dpbmcpOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRPd25lZEhvdXNlcycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgYXBhcnRtZW50cyA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgcHJvcGVydHlfaWQsIG93bmVyX2NpdGl6ZW5pZCwgc3RyZWV0LCBkZXNjcmlwdGlvbiwgaGFzX2FjY2VzcywgZG9vcl9kYXRhLCBhcGFydG1lbnQgIEZST00gcHJvcGVydGllcyBXSEVSRSBvd25lcl9jaXRpemVuaWQgPSA/IEFORCBhcGFydG1lbnQgSVMgTk9UIE5VTEwgQU5EIGFwYXJ0bWVudCA8PiBcIlwiJywgW3BsYXllcl0pO1xuICAgIGNvbnN0IGhvdXNlcyA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgcHJvcGVydHlfaWQsIG93bmVyX2NpdGl6ZW5pZCwgc3RyZWV0LCBkZXNjcmlwdGlvbiwgaGFzX2FjY2Vzcywgc2hlbGwsIGRvb3JfZGF0YSBGUk9NIHByb3BlcnRpZXMgV0hFUkUgb3duZXJfY2l0aXplbmlkID0gPyBBTkQgYXBhcnRtZW50IElTIE5VTEwnLCBbcGxheWVyXSk7XG4gICAgY29uc3QgcmVzID0ge1xuICAgICAgICBhcGFydG1lbnRzOiBhcGFydG1lbnRzLFxuICAgICAgICBob3VzZXM6IGhvdXNlc1xuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRLZXlIb2xkZXJOYW1lcycsIGFzeW5jIChjbGllbnQsIGRhdGEpID0+IHtcbiAgICBjb25zdCByZXMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGxldCBuYW1lTWFwOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG5cbiAgICBpZiAocmVzICYmIHJlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIFByb2Nlc3MgYWxsIGhvdXNlcyBpbiBwYXJhbGxlbFxuICAgICAgICBjb25zdCBhcGFydG1lbnRQcm9taXNlcyA9IHJlcy5tYXAoKGhvdXNlOiBzdHJpbmcpID0+XG4gICAgICAgICAgICBVdGlscy5xdWVyeSgnU0VMRUNUIGNpdGl6ZW5pZCwgY2hhcmluZm8gRlJPTSBwbGF5ZXJzIFdIRVJFIGNpdGl6ZW5pZCA9ID8nLCBbaG91c2VdKVxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGFsbEFwYXJ0bWVudHMgPSBhd2FpdCBQcm9taXNlLmFsbChhcGFydG1lbnRQcm9taXNlcyk7XG5cbiAgICAgICAgYWxsQXBhcnRtZW50cy5mb3JFYWNoKGFwYXJ0bWVudHMgPT4ge1xuICAgICAgICAgICAgLyogY29uc29sZS5sb2coYXBhcnRtZW50cyk7ICovXG4gICAgICAgICAgICBpZiAoYXBhcnRtZW50cyAmJiBhcGFydG1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBhcGFydG1lbnRzLmZvckVhY2goKGFwYXJ0bWVudDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoYXJpbmZvID0gSlNPTi5wYXJzZShhcGFydG1lbnQuY2hhcmluZm8pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdWxsTmFtZSA9IGAke2NoYXJpbmZvLmZpcnN0bmFtZX0gJHtjaGFyaW5mby5sYXN0bmFtZX1gO1xuICAgICAgICAgICAgICAgICAgICBuYW1lTWFwW2FwYXJ0bWVudC5jaXRpemVuaWRdID0gZnVsbE5hbWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShuYW1lTWFwKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdyZW1vdmVBY2Nlc3MnLCBhc3luYyAoY2xpZW50LCBkYXRhKSA9PiB7XG4gICAgY29uc3QgeyBpZCwgY2lkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGhvdXNlOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUICogRlJPTSBwcm9wZXJ0aWVzIFdIRVJFIHByb3BlcnR5X2lkID0gPycsIFtpZF0pO1xuICAgIGlmIChob3VzZSAmJiBob3VzZS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGhvdXNlRGF0YSA9IGhvdXNlWzBdO1xuICAgICAgICBjb25zdCBoYXNBY2Nlc3MgPSBKU09OLnBhcnNlKGhvdXNlRGF0YS5oYXNfYWNjZXNzKTtcbiAgICAgICAgY29uc3QgbmV3QWNjZXNzID0gaGFzQWNjZXNzLmZpbHRlcigoYWNjZXNzOiBzdHJpbmcpID0+IGFjY2VzcyAhPT0gY2lkKTtcbiAgICAgICAgLyogY29uc29sZS5sb2cobmV3QWNjZXNzKTsgKi9cbiAgICAgICAgYXdhaXQgVXRpbHMucXVlcnkoJ1VQREFURSBwcm9wZXJ0aWVzIFNFVCBoYXNfYWNjZXNzID0gPyBXSEVSRSBwcm9wZXJ0eV9pZCA9ID8nLCBbSlNPTi5zdHJpbmdpZnkobmV3QWNjZXNzKSwgaWRdKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcHJvcGVydGllcycsXG4gICAgICAgICAgICB0aXRsZTogJ0FjY2VzcyBSZW1vdmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBY2Nlc3MgcmVtb3ZlZCBmcm9tICR7Y2lkfSB0byAke2hvdXNlRGF0YS5zdHJlZXR9LCAke2hvdXNlRGF0YS5wcm9wZXJ0eV9pZH0gYnkgJHthd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2xpZW50KSl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2ssIHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOmNyZWF0ZVBvc3QnLCBhc3luYyAoc291cmNlLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHRpdGxlLCBjb250ZW50LCBpbWFnZUF0dGFjaG1lbnQsIHBob25lTnVtYmVyLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBkYXRhWCA9IHtcbiAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGUsXG4gICAgICAgIGNvbnRlbnQsXG4gICAgICAgIGltYWdlQXR0YWNobWVudCxcbiAgICAgICAgcGhvbmVOdW1iZXIsXG4gICAgICAgIGVtYWlsLFxuICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgIH07XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JsdWVwYWdlcycsIGRhdGFYKTtcbiAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOnJlZnJlc2hQb3N0cycsIC0xLCBKU09OLnN0cmluZ2lmeShkYXRhWCkpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYmx1ZXBhZ2VzJyxcbiAgICAgICAgdGl0bGU6ICdQb3N0IENyZWF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgUG9zdCAnJHt0aXRsZX0nIChJRDogJHtkYXRhWC5faWR9KSBjcmVhdGVkIGJ5ICR7cGhvbmVOdW1iZXIgfHwgZW1haWx9LCBjb250ZW50OiAke2NvbnRlbnR9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOmdldFBvc3RzJywgYXN5bmMgKHNvdXJjZSkgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2JsdWVwYWdlcycsIHt9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOmRlbGV0ZVBvc3QnLCBhc3luYyAoc291cmNlLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwb3N0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9ibHVlcGFnZXMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfYmx1ZXBhZ2VzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpyZWZyZXNoRGVsZXRlUG9zdCcsIC0xLCBkYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2JsdWVwYWdlcycsXG4gICAgICAgIHRpdGxlOiAnUG9zdCBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBvc3QgJyR7cG9zdC50aXRsZX0nIChJRDogJHtkYXRhfSkgZGVsZXRlZCBieSAke3Bvc3QucGhvbmVOdW1iZXIgfHwgcG9zdC5lbWFpbH0sIGNvbnRlbnQ6ICR7cG9zdC5jb250ZW50fWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrLCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZyYW1ld29yayB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IEdhcmFnZURhdGEgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmludGVyZmFjZSBWZWhpY2xlRGF0YSB7XG4gICAgdmVoaWNsZTogc3RyaW5nO1xuICAgIHBsYXRlOiBzdHJpbmc7XG4gICAgZ2FyYWdlOiBzdHJpbmc7XG4gICAgbW9kczogc3RyaW5nO1xuICAgIHN0YXRlOiBudW1iZXI7XG4gICAgZGVwb3RwcmljZTogc3RyaW5nO1xufVxuXG5vbkNsaWVudENhbGxiYWNrKCdnYXJhZ2U6Z2V0R2FyYWdlRGF0YScsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGxldCByZXNEYXRhOiBHYXJhZ2VEYXRhW10gPSBbXTtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgVXRpbHMucXVlcnkoYFNFTEVDVCB2ZWhpY2xlLHBsYXRlLGdhcmFnZSxtb2RzLHN0YXRlLGRlcG90cHJpY2UgRlJPTSBwbGF5ZXJfdmVoaWNsZXMgV0hFUkUgY2l0aXplbmlkID0gP2AsIFtjaXRpemVuSWRdKSBhcyBWZWhpY2xlRGF0YVtdO1xuICAgIGNvbnN0IHZlaGljbGVEYXRhID0gRnJhbWV3b3JrLlNoYXJlZC5WZWhpY2xlcztcbiAgICBcbiAgICBmb3IgKGNvbnN0IHZlaGljbGUgb2YgcmVzKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSB2ZWhpY2xlRGF0YVt2ZWhpY2xlLnZlaGljbGVdO1xuICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIHZlaGljbGUgc3RhdGUgd2l0aCBiZXR0ZXIgbG9naWNcbiAgICAgICAgICAgIGxldCBzdGF0ZTogc3RyaW5nO1xuICAgICAgICAgICAgaWYgKHZlaGljbGUuc3RhdGUgPT09IDIpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IFwiSW1wb3VuZGVkXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZlaGljbGUuc3RhdGUgPT09IDEpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IFwiUGFya2VkXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKE51bWJlcih2ZWhpY2xlLmRlcG90cHJpY2UpID4gMCkge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gXCJEZXBvdFwiOyAvLyBDaGFuZ2VkIGZyb20gXCJEZXBvdGVkXCIgdG8gXCJEZXBvdFwiIGFzIHJlcXVlc3RlZFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IFwiT3V0XCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlc0RhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAgcGxhdGU6IHZlaGljbGUucGxhdGUsXG4gICAgICAgICAgICAgICAgZ2FyYWdlOiB2ZWhpY2xlLmdhcmFnZSxcbiAgICAgICAgICAgICAgICBzdGF0ZTogc3RhdGUsXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnk6IGRhdGEuY2F0ZWdvcnksXG4gICAgICAgICAgICAgICAgYnJhbmQ6IGRhdGEuYnJhbmQsXG4gICAgICAgICAgICAgICAgbmFtZTogZGF0YS5uYW1lLFxuICAgICAgICAgICAgICAgIHR1cmJvSW5zdGFsbGVkOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kVHVyYm8sXG4gICAgICAgICAgICAgICAgYm9keUhlYWx0aDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLmJvZHlIZWFsdGgsXG4gICAgICAgICAgICAgICAgdGFua0hlYWx0aDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLnRhbmtIZWFsdGgsXG4gICAgICAgICAgICAgICAgZnVlbExldmVsOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykuZnVlbExldmVsLFxuICAgICAgICAgICAgICAgIGVuZ2luZUhlYWx0aDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLmVuZ2luZUhlYWx0aCxcbiAgICAgICAgICAgICAgICBtb2RTdXNwZW5zaW9uOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kU3VzcGVuc2lvbixcbiAgICAgICAgICAgICAgICBtb2RUcmFuc21pc3Npb246IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RUcmFuc21pc3Npb24sXG4gICAgICAgICAgICAgICAgbW9kRW5naW5lOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kRW5naW5lLFxuICAgICAgICAgICAgICAgIG1vZEJyYWtlczogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZEJyYWtlcyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlc0RhdGEpO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBXYWxsZXRBY2NvdW50IH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBEYXRlVGltZSB9IGZyb20gJ2x1eG9uJztcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmZ1bmN0aW9uIEdlbmVyYXRlQ2FyZE51bWJlcigpIHtcbiAgICBsZXQgY2FyZE51bWJlciA9ICcnO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTY7IGkrKykge1xuICAgICAgICBjYXJkTnVtYmVyICs9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwKTtcbiAgICB9XG4gICAgcmV0dXJuIGNhcmROdW1iZXI7XG59XG5cbmZ1bmN0aW9uIEdlbmVyYXRlQmFua0FjY291bnROdW1iZXIoKSB7XG4gICAgY29uc3QgaW5pdGlhbHMgPSBcIlNNUlRcIjtcbiAgICBsZXQgYWNjb3VudE51bWJlciA9ICcnO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTA7IGkrKykge1xuICAgICAgICBhY2NvdW50TnVtYmVyICs9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwKTtcbiAgICB9XG4gICAgcmV0dXJuIGAke2luaXRpYWxzfV8ke2FjY291bnROdW1iZXJ9YDtcbn1cblxub25DbGllbnRDYWxsYmFjaygnd2FsbGV0OmxvZ2luJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmFua191c2VyJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCB9KTtcbiAgICBpZiAocmVzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAuLi5yZXMsXG4gICAgICAgICAgICBiYWxhbmNlOiBhd2FpdCBjaXRpemVuSWQuUGxheWVyRGF0YS5tb25leS5iYW5rLFxuICAgICAgICAgICAgY2FzaW5vOiBhd2FpdCBjaXRpemVuSWQuUGxheWVyRGF0YS5tb25leS5jYXNpbm9cbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSk7XG4gICAgICAgIGNvbnN0IGNhcmROdW1iZXIgPSBHZW5lcmF0ZUNhcmROdW1iZXIoKTtcbiAgICAgICAgY29uc3QgY2FyZFBpbiA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwKTtcbiAgICAgICAgY29uc3QgYmFua0FjY291bnQgPSBHZW5lcmF0ZUJhbmtBY2NvdW50TnVtYmVyKCk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiBjaXRpemVuSWQuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgY2FyZE51bWJlcjogY2FyZE51bWJlcixcbiAgICAgICAgICAgIGNhcmRQaW46IGNhcmRQaW4sXG4gICAgICAgICAgICBiYW5rQWNjb3VudDogYmFua0FjY291bnQsXG4gICAgICAgICAgICBiYWxhbmNlOiAwXG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JhbmtfdXNlcicsIGRhdGEpO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgLi4uZGF0YSxcbiAgICAgICAgICAgIGJhbGFuY2U6IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLm1vbmV5LmJhbmssXG4gICAgICAgICAgICBjYXNpbm86IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLm1vbmV5LmNhc2lub1xuICAgICAgICB9KTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0RGV0YWlsc1hTJywgYXN5bmMgKGNsaWVudCwgbnVtYmVyKSA9PiB7XG4gICAgbGV0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIoU3RyaW5nKG51bWJlcikpO1xuICAgIGlmIChjaXRpemVuSWQpIHtcbiAgICAgICAgY29uc3QgcmVzOiBXYWxsZXRBY2NvdW50ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9iYW5rX3VzZXInLCB7IGNpdGl6ZW5JZDogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAocmVzKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzLmJhbmtBY2NvdW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3RyYW5zWEFkcWFzZGRhc2RmZXJNb25leScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgYW1vdW50LCB0byB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXM6IFdhbGxldEFjY291bnQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2JhbmtfdXNlcicsIHsgYmFua0FjY291bnQ6IHRvIH0pO1xuICAgIGlmICghcmVzKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKHJlcy5jaXRpemVuSWQpO1xuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoY2xpZW50KTtcbiAgICBpZiAoIWF3YWl0IERvZXNQbGF5ZXJFeGlzdCh0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UpKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLm1vbmV5LmJhbmsgPCBhbW91bnQpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoYXdhaXQgc291cmNlUGxheWVyLkZ1bmN0aW9ucy5SZW1vdmVNb25leSgnYmFuaycsIGFtb3VudCkpIHtcbiAgICAgICAgdGFyZ2V0UGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGFtb3VudCk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdXYWxsZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSB0cmFuc2ZlcnJlZCAkJHthbW91bnR9IHRvICR7cmVzLm5hbWV9LmAsXG4gICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogJ1dhbGxldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIHJlY2VpdmVkICQke2Ftb3VudH0gZnJvbSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogJ3NldHRpbmdzJyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgfSkpO1xuXG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9iYW5rX3RyYW5zYWN0aW9ucycsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBmcm9tOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICB0bzogcmVzLmNpdGl6ZW5JZCxcbiAgICAgICAgICAgIGFtb3VudDogYW1vdW50LFxuICAgICAgICAgICAgdHlwZTogJ2RlYml0JyxcbiAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JhbmtfdHJhbnNhY3Rpb25zJywge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHJlcy5jaXRpemVuSWQsXG4gICAgICAgICAgICB0bzogc291cmNlUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgYW1vdW50OiBhbW91bnQsXG4gICAgICAgICAgICB0eXBlOiAnY3JlZGl0JyxcbiAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYmFua190cmFuc2FjdGlvbnMnLFxuICAgICAgICAgICAgdGl0bGU6ICdNb25leSBUcmFuc2ZlcicsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhhcyB0cmFuc2ZlcnJlZCAkJHthbW91bnR9IHRvICR7cmVzLm5hbWV9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldFRyYW5zYWN0aW9ucycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCB0cmFuc2FjdGlvbnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9iYW5rX3RyYW5zYWN0aW9ucycsIHsgZnJvbTogY2l0aXplbklkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgIHNvcnQ6IHsgZGF0ZTogLTEgfVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0cmFuc2FjdGlvbnMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpjcmVhdGVJbnZvaWNlJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBkZXNjcmlwdGlvbiwgYW1vdW50LCBwYXltZW50VGltZSwgbnVtYmVyT2ZQYXltZW50cywgaXNCdXNpbmVzcywgcmVjZWl2ZXIsIH0gPSBKU09OLnBhcnNlKGRhdGEpIGFzIHtcbiAgICAgICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICAgICAgYW1vdW50OiBudW1iZXI7XG4gICAgICAgIHBheW1lbnRUaW1lOiBudW1iZXI7XG4gICAgICAgIG51bWJlck9mUGF5bWVudHM6IG51bWJlcjtcbiAgICAgICAgaXNCdXNpbmVzczogJ05vJyB8ICdZZXMnO1xuICAgICAgICByZWNlaXZlcjogc3RyaW5nO1xuICAgIH07IC8vIHBheW1lbnRUaW1lID0gMCBmb3IgZGFpbHksIDEgZm9yIHdlZWtseSwgMiBmb3IgbW9udGhseSBhbmQgMyBmb3IgcXVhcnRlcmx5IGFuZCA0IGZvciB5ZWFybHlcblxuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoY2xpZW50KTtcbiAgICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHJlY2VpdmVyKTtcbiAgICBpZiAoIXRhcmdldFBsYXllcikgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChhbW91bnQgPCAwKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JhbmtfaW52b2ljZXMnLCB7XG4gICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIGZyb206IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgdG86IHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgYW1vdW50OiBhbW91bnQsXG4gICAgICAgIHN0YXR1czogJ3BlbmRpbmcnLFxuICAgICAgICBpc0J1c2luZXNzLFxuICAgICAgICBzb3VyY2VOYW1lOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgdGFyZ2V0TmFtZTogYCR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbixcbiAgICAgICAgcGF5bWVudFRpbWU6IHBheW1lbnRUaW1lLFxuICAgICAgICBudW1iZXJPZlBheW1lbnRzOiBudW1iZXJPZlBheW1lbnRzLFxuICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9KTtcbiAgICBpZiAocmVzKSB7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdXYWxsZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIHNlbnQgeW91IGFuIGludm9pY2Ugb2YgJCR7YW1vdW50fS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2JhbmtfaW52b2ljZXMnLFxuICAgICAgICAgICAgdGl0bGU6ICdJbnZvaWNlIENyZWF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgc2VudCBhbiBpbnZvaWNlIG9mICQke2Ftb3VudH0gdG8gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpnZXRJbnZvaWNlcycsIGFzeW5jIChjbGllbnQsIHR5cGUpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBpZiAodHlwZSA9PT0gJ3NlbnQnKSB7XG4gICAgICAgIGNvbnN0IGludm9pY2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYmFua19pbnZvaWNlcycsIHsgZnJvbTogY2l0aXplbklkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGRhdGU6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShpbnZvaWNlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgaW52b2ljZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9iYW5rX2ludm9pY2VzJywgeyB0bzogY2l0aXplbklkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGRhdGU6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShpbnZvaWNlcyk7XG4gICAgfVxufSk7XG5cbnR5cGUgUmVjdXJyZW5jZSA9IDAgfCAxIHwgMiB8IDMgfCA0OyAvLyBkYWlseSwgd2Vla2x5LCBtb250aGx5LCBxdWFydGVybHksIHllYXJseVxuXG5pbnRlcmZhY2UgUGhvbmVCYW5rSW52b2ljZURvYyB7XG4gICAgX2lkOiBzdHJpbmc7XG4gICAgZnJvbTogc3RyaW5nOyAvLyBjaXRpemVuaWQgb2Ygc2VuZGVyICh0aGUgcGVyc29uL2J1c2luZXNzIHJlcXVlc3RpbmcgbW9uZXkpXG4gICAgdG86IHN0cmluZzsgICAvLyBjaXRpemVuaWQgb2YgdGFyZ2V0ICh0aGUgcGVyc29uIHdobyBwYXlzIHdoZW4gYWNjZXB0aW5nKVxuICAgIGFtb3VudDogbnVtYmVyO1xuICAgIHRhcmdldE5hbWU6IHN0cmluZztcbiAgICBzb3VyY2VOYW1lOiBzdHJpbmc7XG4gICAgc3RhdHVzOiAncGVuZGluZycgfCAnYWN0aXZlJyB8ICdwYWlkJyB8ICdjb21wbGV0ZWQnIHwgJ2RlY2xpbmVkJyB8ICdvdmVyZHVlJztcbiAgICBpc0J1c2luZXNzOiAnTm8nIHwgJ1llcyc7XG4gICAgcGF5bWVudFRpbWU6IFJlY3VycmVuY2UgfCAnJzsgLy8gJycgbWVhbnMgb25lLXRpbWUsIGVsc2UgcmVjdXJyZW5jZSBjb2RlXG4gICAgbnVtYmVyT2ZQYXltZW50czogbnVtYmVyIHwgJyc7Ly8gJycgbWVhbnMgb25lLXRpbWUsIGVsc2UgdG90YWwgcGF5bWVudHNcbiAgICByZW1haW5pbmdQYXltZW50cz86IG51bWJlcjsgICAvLyBtYWludGFpbmVkIGZvciByZWN1cnJpbmdcbiAgICBuZXh0UGF5bWVudERhdGU/OiBzdHJpbmcgfCBudWxsOyAvLyBJU09cbiAgICBsYXN0QXR0ZW1wdEF0Pzogc3RyaW5nIHwgbnVsbDsgICAvLyBJU09cbiAgICBmYWlsZWRBdHRlbXB0cz86IG51bWJlcjtcbiAgICBjcmVhdGVkQXQ/OiBzdHJpbmc7IC8vIElTT1xuICAgIGRhdGU/OiBzdHJpbmc7IC8vIHlvdXIgb3JpZ2luYWwgZmllbGRcbn1cblxuY29uc3QgQ09MTEVDVElPTiA9ICdwaG9uZV9iYW5rX2ludm9pY2VzJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBRQiBoZWxwZXJzIChhZGp1c3QgaWYgeW91ciBleHBvcnRzIGRpZmZlcilcbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0UGxheWVyQnlTb3VyY2UgPSBhc3luYyAoc3JjOiBudW1iZXIpID0+IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc3JjKTtcbmNvbnN0IGdldFBsYXllckJ5Q2l0aXplbklkID0gYXN5bmMgKGNpZDogc3RyaW5nKSA9PiBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQ/LihjaWQpO1xuXG4vLyBNb25leSBvcHM6IHJldHVybiBib29sZWFuIHN1Y2Nlc3NcbmNvbnN0IGRlYml0QmFuayA9IChwbGF5ZXI6IGFueSwgYW1vdW50OiBudW1iZXIpID0+IHBsYXllcj8uRnVuY3Rpb25zPy5SZW1vdmVNb25leT8uKCdiYW5rJywgYW1vdW50LCAnaW52b2ljZV9wYXltZW50JykgPz8gZmFsc2U7XG5jb25zdCBjcmVkaXRCYW5rID0gKHBsYXllcjogYW55LCBhbW91bnQ6IG51bWJlcikgPT4gcGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGFtb3VudCwgJ2ludm9pY2VfcmVjZWl2ZWQnKSA/PyBmYWxzZTtcblxuY29uc3Qgbm90aWZ5ID0gKHNyYzogbnVtYmVyLCB0aXRsZTogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nLCB0aW1lb3V0ID0gNTAwMCkgPT4ge1xuICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNyYywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLCBkZXNjcmlwdGlvbiwgYXBwOiAnc2V0dGluZ3MnLCB0aW1lb3V0XG4gICAgfSkpO1xufTtcblxuY29uc3Qgbm93SVNPID0gKCkgPT4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuXG5jb25zdCBhZGRJbnRlcnZhbCA9IChpc286IHN0cmluZywgcmVjOiBSZWN1cnJlbmNlKTogc3RyaW5nID0+IHtcbiAgICBjb25zdCBkID0gbmV3IERhdGUoaXNvKTtcbiAgICBzd2l0Y2ggKHJlYykge1xuICAgICAgICBjYXNlIDA6IGQuc2V0RGF0ZShkLmdldERhdGUoKSArIDEpOyBicmVhazsgICAgICAgLy8gZGFpbHlcbiAgICAgICAgY2FzZSAxOiBkLnNldERhdGUoZC5nZXREYXRlKCkgKyA3KTsgYnJlYWs7ICAgICAgIC8vIHdlZWtseVxuICAgICAgICBjYXNlIDI6IGQuc2V0TW9udGgoZC5nZXRNb250aCgpICsgMSk7IGJyZWFrOyAgICAgLy8gbW9udGhseVxuICAgICAgICBjYXNlIDM6IGQuc2V0TW9udGgoZC5nZXRNb250aCgpICsgMyk7IGJyZWFrOyAgICAgLy8gcXVhcnRlcmx5XG4gICAgICAgIGNhc2UgNDogZC5zZXRGdWxsWWVhcihkLmdldEZ1bGxZZWFyKCkgKyAxKTsgYnJlYWs7IC8vIHllYXJseVxuICAgIH1cbiAgICByZXR1cm4gZC50b0lTT1N0cmluZygpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBCdXNpbmVzcyBzYWZlIGRlcG9zaXQgKGN1c3RvbWl6ZSBmb3IgeW91ciBmcmFtZXdvcmspXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8qKlxuICogVHJ5IHRvIGRlcG9zaXQgaW50byBhIGJ1c2luZXNzIG1hbmFnZW1lbnQgc2FmZS5cbiAqIFN0cmF0ZWd5OlxuICogICAtIElmIHRoZSBwYXllciBpcyBwYXlpbmcgdG8gYSBidXNpbmVzcyAoaW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJyksXG4gKiAgICAgd2UgZGVwb3NpdCB0aGUgbW9uZXkgaW50byB0aGUgUkVDRUlWRVIncyBqb2Igc2FmZS5cbiAqICAgLSBZb3UgbWlnaHQgd2FudCB0byBjaGFuZ2UgdGhpcyB0byBhIHNwZWNpZmljIGJ1c2luZXNzIGlkIG9uIHRoZSBpbnZvaWNlLFxuICogICAgIG9yIGEgcHJvdmlkZWQgb3JnIGtleS4gRWRpdCBhcyBuZWVkZWQuXG4gKi9cbmNvbnN0IGRlcG9zaXRUb01hbmFnZW1lbnRTYWZlID0gYXN5bmMgKHJlY2VpdmVyQ2l0aXplbklkOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVjZWl2ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZWNlaXZlckNpdGl6ZW5JZCk7XG4gICAgICAgIGNvbnN0IGpvYk5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHJlY2VpdmVyPy5QbGF5ZXJEYXRhPy5qb2I/Lm5hbWU7XG4gICAgICAgIGNvbnN0IFBsYXllck5hbWUgPSByZWNlaXZlciA/IGAke3JlY2VpdmVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3JlY2VpdmVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCA6ICdVbmtub3duJztcbiAgICAgICAgLy8gVE9ETzogVXBkYXRlIHRoaXMgdG8geW91ciBhY3R1YWwgbWFuYWdlbWVudCByZXNvdXJjZSBBUEk6XG4gICAgICAgIC8vIENvbW1vbiBRQkNvcmUgZWNvc3lzdGVtIHVzZXMgcWItbWFuYWdlbWVudDogQWRkTW9uZXkoam9iTmFtZSwgYW1vdW50KVxuICAgICAgICBpZiAoam9iTmFtZSkge1xuICAgICAgICAgICAgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uYWRkQWNjb3VudE1vbmV5KGpvYk5hbWUsIGFtb3VudCk7XG4gICAgICAgICAgICAvKiBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihhY2NvdW50LCB0aXRsZSwgYW1vdW50LCBtZXNzYWdlLCBpc3N1ZXIsIHJlY2VpdmVyLCB0cmFuc1R5cGUsIHRyYW5zSUQpICovXG4gICAgICAgICAgICBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihqb2JOYW1lLCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0XCIsIGFtb3VudCwgXCJEZXBvc2l0IGZyb20gZW1wbG95ZWUgdG8gbWFuYWdlbWVudCBzYWZlLlwiLCBqb2JOYW1lLCBQbGF5ZXJOYW1lLCAnZGVwb3NpdCcsIGdlbmVyYXRlVVVpZCgpKVxuICAgICAgICAgICAgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oam9iTmFtZSwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgRGVwb3NpdFwiLCBhbW91bnQsIFwiRGVwb3NpdGVkIHRvIG1hbmFnZW1lbnQgc2FmZS5cIiwgUGxheWVyTmFtZSwgam9iTmFtZSwgJ3dpdGhkcmF3JywgZ2VuZXJhdGVVVWlkKCkpXG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlY2VpdmVyKSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlZGl0QmFuayhyZWNlaXZlciwgYW1vdW50KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdkZXBvc2l0VG9NYW5hZ2VtZW50U2FmZSBlcnJvcjonLCBlKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn07XG5cbi8vIEJhbmsgc3RhdGVtZW50IC8gbG9nZ2luZyAob3B0aW9uYWwgaG9vayBwb2ludClcbmNvbnN0IGxvZ0JhbmtFdmVudCA9ICh0eXBlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykgPT4gTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2JhbmtfaW52b2ljZXMnLFxuICAgIHRpdGxlOiB0eXBlLFxuICAgIG1lc3NhZ2UsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDphY2NlcHRJbnZvaWNlUGF5bWVudCcsIGFzeW5jIChjbGllbnQ6IG51bWJlciwgaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBheWVyUGxheWVyID0gYXdhaXQgZ2V0UGxheWVyQnlTb3VyY2UoY2xpZW50KTsgLy8gdGhlIG9uZSBjbGlja2luZyBcImFjY2VwdFwiIChtdXN0IGVxdWFsIGludm9pY2UudG8pXG4gICAgaWYgKCFwYXllclBsYXllcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgcGF5ZXJDaWQ6IHN0cmluZyA9IHBheWVyUGxheWVyLlBsYXllckRhdGE/LmNpdGl6ZW5pZDtcbiAgICBjb25zdCBpbnZvaWNlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9KSBhcyBQaG9uZUJhbmtJbnZvaWNlRG9jO1xuICAgIGlmICghaW52b2ljZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gU2FmZXR5IGNoZWNrc1xuICAgIGlmIChpbnZvaWNlLnRvICE9PSBwYXllckNpZCkgcmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm90IHlvdXIgaW52b2ljZVxuICAgIGlmIChpbnZvaWNlLnN0YXR1cyAhPT0gJ3BlbmRpbmcnICYmIGludm9pY2Uuc3RhdHVzICE9PSAnYWN0aXZlJyAmJiBpbnZvaWNlLnN0YXR1cyAhPT0gJ292ZXJkdWUnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGludm9pY2UuYW1vdW50IDw9IDApIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5mcm9tID09PSBpbnZvaWNlLnRvKSByZXR1cm4gZmFsc2U7ICAgICAgICAgICAgICAgICAgICAgIC8vIHNlbGYtaW52b2ljZSBzaWxsaW5lc3NcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKGludm9pY2UuZnJvbSk7XG5cbiAgICBjb25zdCBjaGFyZ2VkID0gZGViaXRCYW5rKHBheWVyUGxheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgaWYgKCFjaGFyZ2VkKSB7XG4gICAgICAgIC8vIENvdWxkblx1MjAxOXQgY2hhcmdlIC0+IG92ZXJkdWUgZm9yIHJlY3VycmluZyBvciBrZWVwIHBlbmRpbmcgZm9yIG9uZS10aW1lP1xuICAgICAgICBjb25zdCBpc1JlY3VycmluZyA9IGludm9pY2UucGF5bWVudFRpbWUgIT09ICcnICYmIGludm9pY2UubnVtYmVyT2ZQYXltZW50cyAhPT0gJyc7XG4gICAgICAgIGlmIChpc1JlY3VycmluZykge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdvdmVyZHVlJyxcbiAgICAgICAgICAgICAgICBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSxcbiAgICAgICAgICAgICAgICBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBub3RpZnkocGF5ZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgSW5zdWZmaWNpZW50IGZ1bmRzIHRvIHBheSAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBQYXlvdXRcbiAgICBsZXQgcGF5b3V0T2sgPSBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJykge1xuICAgICAgICBjb25zdCBjb21taXNzaW9uID0gMC4xO1xuICAgICAgICBjb25zdCBjb21taXNzaW9uQW1vdW50ID0gTWF0aC5yb3VuZChpbnZvaWNlLmFtb3VudCAqIGNvbW1pc3Npb24pO1xuICAgICAgICBjb25zdCBwYXlvdXRBbW91bnQgPSBNYXRoLnJvdW5kKGludm9pY2UuYW1vdW50IC0gY29tbWlzc2lvbkFtb3VudCk7XG4gICAgICAgIHBheW91dE9rID0gYXdhaXQgZGVwb3NpdFRvTWFuYWdlbWVudFNhZmUoaW52b2ljZS5mcm9tLCBwYXlvdXRBbW91bnQpO1xuICAgICAgICByZXF1ZXN0ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KCdiYW5rJywgY29tbWlzc2lvbkFtb3VudCwgJ2ludm9pY2VfcmVjZWl2ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwYXlvdXRPayA9IHJlcXVlc3RlciA/IGNyZWRpdEJhbmsocmVxdWVzdGVyLCBpbnZvaWNlLmFtb3VudCkgOiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIXBheW91dE9rKSB7XG4gICAgICAgIC8vIFJlZnVuZCBwYXllciBzaW5jZSBwYXlvdXQgZmFpbGVkXG4gICAgICAgIGNyZWRpdEJhbmsocGF5ZXJQbGF5ZXIsIGludm9pY2UuYW1vdW50KTtcbiAgICAgICAgbm90aWZ5KHBheWVyUGxheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFBheW1lbnQgZmFpbGVkIHRvIGRlbGl2ZXIuIFJlZnVuZGVkICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBpbnZvaWNlIHN0YXR1c1xuICAgIGNvbnN0IGlzUmVjdXJyaW5nID0gKGludm9pY2UucGF5bWVudFRpbWUgIT09ICcnICYmIGludm9pY2UubnVtYmVyT2ZQYXltZW50cyAhPT0gJycpO1xuICAgIGlmICghaXNSZWN1cnJpbmcpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHtcbiAgICAgICAgICAgIHN0YXR1czogJ3BhaWQnLFxuICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiBudWxsLFxuICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IDAsXG4gICAgICAgICAgICBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB0b3RhbCA9IE51bWJlcihpbnZvaWNlLm51bWJlck9mUGF5bWVudHMpO1xuICAgICAgICBjb25zdCBwcmV2UmVtYWluaW5nID0gKGludm9pY2UucmVtYWluaW5nUGF5bWVudHMgPT0gbnVsbClcbiAgICAgICAgICAgID8gdG90YWwgICAgICAgICAgICAgICAgLy8gZmlyc3QgdGltZSBhY3RpdmF0aW9uXG4gICAgICAgICAgICA6IGludm9pY2UucmVtYWluaW5nUGF5bWVudHM7XG5cbiAgICAgICAgY29uc3QgbmV3UmVtYWluaW5nID0gTWF0aC5tYXgoMCwgcHJldlJlbWFpbmluZyAtIDEpO1xuXG4gICAgICAgIGxldCBuZXdTdGF0dXM6IFBob25lQmFua0ludm9pY2VEb2NbJ3N0YXR1cyddID0gJ2FjdGl2ZSc7XG4gICAgICAgIGxldCBuZXh0RGF0ZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIGlmIChuZXdSZW1haW5pbmcgPD0gMCkge1xuICAgICAgICAgICAgbmV3U3RhdHVzID0gJ2NvbXBsZXRlZCc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBiYXNlRGF0ZSA9IGludm9pY2UubmV4dFBheW1lbnREYXRlID8/IG5vd0lTTygpO1xuICAgICAgICAgICAgbmV4dERhdGUgPSBhZGRJbnRlcnZhbChiYXNlRGF0ZSwgTnVtYmVyKGludm9pY2UucGF5bWVudFRpbWUpIGFzIFJlY3VycmVuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHtcbiAgICAgICAgICAgIHN0YXR1czogbmV3U3RhdHVzLFxuICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IG5ld1JlbWFpbmluZyxcbiAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLFxuICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiBuZXh0RGF0ZSxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogaW52b2ljZS5jcmVhdGVkQXQgPz8gbm93SVNPKClcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gTm90aWZ5IGJvdGggc2lkZXNcbiAgICBub3RpZnkocGF5ZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgUGFpZCAkJHtpbnZvaWNlLmFtb3VudH0gdG8gJHtpbnZvaWNlLnNvdXJjZU5hbWV9LmApO1xuICAgIGlmIChyZXF1ZXN0ZXI/LlBsYXllckRhdGE/LnNvdXJjZSkge1xuICAgICAgICBub3RpZnkocmVxdWVzdGVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBwYWlkIHlvdXIgaW52b2ljZSBvZiAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgfVxuXG4gICAgbG9nQmFua0V2ZW50KCdJbnZvaWNlIFBheW1lbnQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IHBhaWQgJCR7aW52b2ljZS5hbW91bnR9IHRvICR7aW52b2ljZS5zb3VyY2VOYW1lfSR7aW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJyA/ICcgKGJ1c2luZXNzKScgOiAnJ30uYCk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnd2FsbGV0OmRlY2xpbmVJbnZvaWNlUGF5bWVudCcsIGFzeW5jIChjbGllbnQ6IG51bWJlciwgaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBsYXllciA9IGF3YWl0IGdldFBsYXllckJ5U291cmNlKGNsaWVudCk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IGNpZCA9IHBsYXllci5QbGF5ZXJEYXRhPy5jaXRpemVuaWQ7XG4gICAgY29uc3QgaW52b2ljZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSkgYXMgUGhvbmVCYW5rSW52b2ljZURvYztcbiAgICBpZiAoIWludm9pY2UpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS50byAhPT0gY2lkKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGludm9pY2Uuc3RhdHVzICE9PSAncGVuZGluZycgJiYgaW52b2ljZS5zdGF0dXMgIT09ICdhY3RpdmUnICYmIGludm9pY2Uuc3RhdHVzICE9PSAnb3ZlcmR1ZScpIHJldHVybiBmYWxzZTtcblxuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9LCB7IHN0YXR1czogJ2RlY2xpbmVkJywgbmV4dFBheW1lbnREYXRlOiBudWxsIH0pO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS5mcm9tKTtcbiAgICBub3RpZnkocGxheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYERlY2xpbmVkIGludm9pY2Ugb2YgJCR7aW52b2ljZS5hbW91bnR9IGZyb20gJHtpbnZvaWNlLnNvdXJjZU5hbWV9LmApO1xuICAgIGlmIChyZXF1ZXN0ZXI/LlBsYXllckRhdGE/LnNvdXJjZSkge1xuICAgICAgICBub3RpZnkocmVxdWVzdGVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBkZWNsaW5lZCB5b3VyIGludm9pY2Ugb2YgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgIH1cblxuICAgIGxvZ0JhbmtFdmVudCgnSW52b2ljZSBEZWNsaW5lZCcsIGAke2ludm9pY2UudGFyZ2V0TmFtZX0gZGVjbGluZWQgaW52b2ljZSBmcm9tICR7aW52b2ljZS5zb3VyY2VOYW1lfSBmb3IgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cblxuZXhwb3J0IGNvbnN0IEludm9pY2VSZWN1cnJpbmdQYXltZW50cyA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbiAgICBjb25zdCBkdWVJbnZvaWNlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXG4gICAgICAgIENPTExFQ1RJT04sXG4gICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1czogeyAkaW46IFsnYWN0aXZlJywgJ292ZXJkdWUnXSB9LFxuICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiB7ICRsdGU6IG5vdyB9LFxuICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IHsgJGd0OiAwIH1cbiAgICAgICAgfSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgZmFsc2UsXG4gICAgICAgIHsgc29ydDogeyBuZXh0UGF5bWVudERhdGU6IDEgfSwgbGltaXQ6IDUwIH0gLy8gcHJvY2VzcyBpbiBiYXRjaGVzXG4gICAgKSBhcyBQaG9uZUJhbmtJbnZvaWNlRG9jW107XG5cbiAgICBmb3IgKGNvbnN0IGludm9pY2Ugb2YgZHVlSW52b2ljZXMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBheWVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS50byk7XG4gICAgICAgICAgICBpZiAoIXBheWVyKSB7XG4gICAgICAgICAgICAgICAgLy8gUGF5ZXIgb2ZmbGluZSBcdTIwMTQgY2hvb3NlIHlvdXIgcG9saWN5LiBXZSdsbCBqdXN0IG1hcmsgYXR0ZW1wdCBhbmQgcmV0cnkgbGF0ZXIuXG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgJHNldDogeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSwgc3RhdHVzOiAnb3ZlcmR1ZScgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUcnkgdG8gY2hhcmdlIHZpYSB0aGUgc2FtZSBhY2NlcHQgbG9naWMgY29yZSAoRFJZLWlzaCB3aXRoIGEgdGlueSBpbnRlcm5hbCBjYWxsKVxuICAgICAgICAgICAgLy8gV2UgaW5saW5lIG1pbmltYWwgbG9naWM6IGRlYml0IHBheWVyXG4gICAgICAgICAgICBjb25zdCBjaGFyZ2VkID0gZGViaXRCYW5rKHBheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgICAgICBpZiAoIWNoYXJnZWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwgeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSwgc3RhdHVzOiAnb3ZlcmR1ZScgfSk7XG4gICAgICAgICAgICAgICAgbm90aWZ5KHBheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFJlY3VycmluZyBpbnZvaWNlIG9mICQke2ludm9pY2UuYW1vdW50fSBmYWlsZWQgKGluc3VmZmljaWVudCBmdW5kcykuYCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBheW91dFxuICAgICAgICAgICAgbGV0IHBheW91dE9rID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoaW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJykge1xuICAgICAgICAgICAgICAgIHBheW91dE9rID0gYXdhaXQgZGVwb3NpdFRvTWFuYWdlbWVudFNhZmUoaW52b2ljZS5mcm9tLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RlciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKGludm9pY2UuZnJvbSk7XG4gICAgICAgICAgICAgICAgcGF5b3V0T2sgPSByZXF1ZXN0ZXIgPyBjcmVkaXRCYW5rKHJlcXVlc3RlciwgaW52b2ljZS5hbW91bnQpIDogZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcGF5b3V0T2spIHtcbiAgICAgICAgICAgICAgICAvLyBSZWZ1bmRcbiAgICAgICAgICAgICAgICBjcmVkaXRCYW5rKHBheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHsgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksIGZhaWxlZEF0dGVtcHRzOiAoaW52b2ljZS5mYWlsZWRBdHRlbXB0cyA/PyAwKSArIDEgfSk7XG4gICAgICAgICAgICAgICAgbm90aWZ5KHBheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFJlY3VycmluZyBpbnZvaWNlIHBheW91dCBmYWlsZWQ7IHJlZnVuZGVkICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUHJvZ3Jlc3MgcmVjdXJyZW5jZVxuICAgICAgICAgICAgY29uc3QgbmV3UmVtYWluaW5nID0gTWF0aC5tYXgoMCwgKGludm9pY2UucmVtYWluaW5nUGF5bWVudHMgPz8gTnVtYmVyKGludm9pY2UubnVtYmVyT2ZQYXltZW50cykpIC0gMSk7XG4gICAgICAgICAgICBsZXQgbmV3U3RhdHVzOiBQaG9uZUJhbmtJbnZvaWNlRG9jWydzdGF0dXMnXSA9ICdhY3RpdmUnO1xuICAgICAgICAgICAgbGV0IG5leHREYXRlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKG5ld1JlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhdHVzID0gJ2NvbXBsZXRlZCc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2UgPSBpbnZvaWNlLm5leHRQYXltZW50RGF0ZSA/PyBub3dJU08oKTtcbiAgICAgICAgICAgICAgICBuZXh0RGF0ZSA9IGFkZEludGVydmFsKGJhc2UsIE51bWJlcihpbnZvaWNlLnBheW1lbnRUaW1lKSBhcyBSZWN1cnJlbmNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHtcbiAgICAgICAgICAgICAgICByZW1haW5pbmdQYXltZW50czogbmV3UmVtYWluaW5nLFxuICAgICAgICAgICAgICAgIHN0YXR1czogbmV3U3RhdHVzLFxuICAgICAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLFxuICAgICAgICAgICAgICAgIG5leHRQYXltZW50RGF0ZTogbmV4dERhdGVcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBub3RpZnkocGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgQ2hhcmdlZCAkJHtpbnZvaWNlLmFtb3VudH0gZm9yIHJlY3VycmluZyBpbnZvaWNlICgke25ld1JlbWFpbmluZ30gbGVmdCkuYCk7XG4gICAgICAgICAgICBsb2dCYW5rRXZlbnQoJ1JlY3VycmluZyBJbnZvaWNlIFBheW1lbnQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IHBhaWQgJCR7aW52b2ljZS5hbW91bnR9IHRvICR7aW52b2ljZS5zb3VyY2VOYW1lfSR7aW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJyA/ICcgKGJ1c2luZXNzKScgOiAnJ30uYCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1JlY3VycmluZyBwYXltZW50IGVycm9yIGZvcicsIGludm9pY2UuX2lkLCBlKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpbnZvaWNlLl9pZCB9LCB7XG4gICAgICAgICAgICAgICAgJHNldDogeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn07IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2ssIHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IEZyYW1ld29yaywgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdncm91cHM6Z2V0bXVsdGlQbGVKb2JzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgY29uc3Qgc291cmNlUGxheWVyID0gZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGNvbnN0IGpvYnNEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCB9KTtcbiAgICBjb25zdCBjdXJyZW50Sm9iID0gc291cmNlUGxheWVyLlBsYXllckRhdGEuam9iLm5hbWU7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgY3VycmVudEpvYiwgam9ic0RhdGEgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ3JvdXBzOmRlbGV0ZU11bHRpSm9iJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBuYW1lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKTtcbiAgICBjb25zdCBqb2IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX211bHRpam9icycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX211bHRpam9icycsXG4gICAgICAgIHRpdGxlOiAnSm9iIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtuYW1lfSBkZWxldGVkIGpvYiAke2pvYi5qb2JOYW1lfSAoJHtqb2IuY2l0aXplbklkfSlgLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ3JvdXBzOmNoYW5nZUpvYk9mUGxheWVyJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGpvYk5hbWUsIGdyYWRlIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGlmICgham9iTmFtZSkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc291cmNlKTtcbiAgICBpZiAoIXNvdXJjZVBsYXllcikgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uQ2hlY2tKb2JHcmFkZShqb2JOYW1lLCBTdHJpbmcoZ3JhZGUpKSkge1xuICAgICAgICBzb3VyY2VQbGF5ZXIuRnVuY3Rpb25zLlNldEpvYihqb2JOYW1lLCBTdHJpbmcoZ3JhZGUpKTtcbiAgICAgICAgZW1pdE5ldCgnUUJDb3JlOk5vdGlmeScsIHNvdXJjZSwgYEpvYiBDaGFuZ2VkIHRvICR7am9iTmFtZX0gU3VjY2Vzc2Z1bGx5YCwgJ3N1Y2Nlc3MnKTtcbiAgICAgICAgZW1pdE5ldCgnZ3JvdXBzOnRvZ2dsZUR1dHknLCBOdW1iZXIoc291cmNlUGxheWVyLlBsYXllckRhdGEuc291cmNlKSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpam9icycsXG4gICAgICAgICAgICB0aXRsZTogJ0pvYiBDaGFuZ2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gY2hhbmdlZCBqb2IgdG8gJyR7am9iTmFtZX0nIChHcmFkZTogJHtncmFkZX0pLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogc291cmNlUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLCBqb2JOYW1lIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aWpvYnMnLFxuICAgICAgICAgICAgdGl0bGU6ICdJbnZhbGlkIEpvYiBSZW1vdmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gYXR0ZW1wdGVkIHRvIGNoYW5nZSB0byBpbnZhbGlkIGpvYiAnJHtqb2JOYW1lfScsIHJlbW92ZWQgZnJvbSBtdWx0aS1qb2JzLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufSk7XG5cbi8vIEludGVyZmFjZXNcbmludGVyZmFjZSBQbGF5ZXJEYXRhIHtcbiAgICBQbGF5ZXJEYXRhOiB7XG4gICAgICAgIGNoYXJpbmZvOiB7IGZpcnN0bmFtZTogc3RyaW5nOyBsYXN0bmFtZTogc3RyaW5nIH07XG4gICAgICAgIGNpdGl6ZW5pZDogc3RyaW5nO1xuICAgICAgICBzb3VyY2U6IG51bWJlcjtcbiAgICB9O1xufVxuXG5pbnRlcmZhY2UgR3JvdXBNZW1iZXIge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBDSUQ6IHN0cmluZztcbiAgICBQbGF5ZXI6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIEVtcGxveW1lbnRHcm91cCB7XG4gICAgaWQ6IG51bWJlcjtcbiAgICBzdGF0dXM6IHN0cmluZztcbiAgICBHTmFtZTogc3RyaW5nO1xuICAgIEdQYXNzOiBzdHJpbmc7XG4gICAgR0xvZ286IHN0cmluZztcbiAgICBVc2VyczogbnVtYmVyO1xuICAgIGxlYWRlcjogbnVtYmVyO1xuICAgIG1lbWJlcnM6IEdyb3VwTWVtYmVyW107XG4gICAgc3RhZ2U6IGFueVtdO1xuICAgIFNjcmlwdENyZWF0ZWQ/OiBib29sZWFuO1xufSIsICJpbXBvcnQgeyBGcmFtZXdvcmssIE1vbmdvREIgfSBmcm9tICdAc2VydmVyL3N2X21haW4nO1xuaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gJ0BvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlcic7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tICdAc2hhcmVkL3V0aWxzJztcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmludGVyZmFjZSBIZWFydFN5bmNQcm9maWxlIHtcbiAgICBfaWQ/OiBzdHJpbmc7XG4gICAgY2l0aXplbklkOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGFnZTogbnVtYmVyO1xuICAgIGdlbmRlcjogc3RyaW5nO1xuICAgIGJpbzogc3RyaW5nO1xuICAgIHBob3Rvczogc3RyaW5nW107XG4gICAgaW50ZXJlc3RzOiBzdHJpbmdbXTtcbiAgICBsb29raW5nRm9yOiBzdHJpbmc7XG4gICAgaW50ZXJlc3RlZEluR2VuZGVyczogc3RyaW5nW107XG4gICAgYWdlUmFuZ2VNaW46IG51bWJlcjtcbiAgICBhZ2VSYW5nZU1heDogbnVtYmVyO1xuICAgIG1heERpc3RhbmNlOiBudW1iZXI7XG4gICAgc2hvd09ubGluZTogYm9vbGVhbjtcbiAgICBsb2NhdGlvbj86IHtcbiAgICAgICAgbGF0OiBudW1iZXI7XG4gICAgICAgIGxuZzogbnVtYmVyO1xuICAgICAgICBjaXR5OiBzdHJpbmc7XG4gICAgfTtcbiAgICB3b3JrPzogc3RyaW5nO1xuICAgIHNjaG9vbD86IHN0cmluZztcbiAgICBoZWlnaHQ/OiBudW1iZXI7XG4gICAgem9kaWFjU2lnbj86IHN0cmluZztcbiAgICBsaWZlc3R5bGU/OiB7XG4gICAgICAgIHNtb2tpbmc6IHN0cmluZztcbiAgICAgICAgZHJpbmtpbmc6IHN0cmluZztcbiAgICAgICAgZXhlcmNpc2U6IHN0cmluZztcbiAgICAgICAgcGV0czogc3RyaW5nO1xuICAgIH07XG4gICAgcHJvbXB0cz86IHtcbiAgICAgICAgcXVlc3Rpb246IHN0cmluZztcbiAgICAgICAgYW5zd2VyOiBzdHJpbmc7XG4gICAgfVtdO1xuICAgIHZlcmlmaWVkOiBib29sZWFuO1xuICAgIHByZW1pdW06IGJvb2xlYW47XG4gICAgc3VwZXJMaWtlc1JlbWFpbmluZzogbnVtYmVyO1xuICAgIGxpa2VzUmVtYWluaW5nOiBudW1iZXI7XG4gICAgZGFpbHlTd2lwZXM6IG51bWJlcjtcbiAgICBsYXN0U3dpcGVSZXNldDogRGF0ZTtcbiAgICBjcmVhdGVkQXQ6IERhdGU7XG4gICAgbGFzdEFjdGl2ZTogRGF0ZTtcbiAgICBpc0FjdGl2ZTogYm9vbGVhbjtcbn1cbmludGVyZmFjZSBNZXNzYWdlIHtcbiAgICBfaWQ6IHN0cmluZztcbiAgICBzZW5kZXJJZDogc3RyaW5nO1xuICAgIHJlY2VpdmVySWQ6IHN0cmluZztcbiAgICBtYXRjaElkOiBzdHJpbmc7XG4gICAgY29udGVudDogc3RyaW5nO1xuICAgIHRpbWVzdGFtcDogc3RyaW5nO1xuICAgIHJlYWQ6IGJvb2xlYW47XG59XG5jbGFzcyBIZWFydFN5bmNTZXJ2ZXIge1xuICAgIGFzeW5jIGdldFByb2ZpbGUoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGUgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHByb2ZpbGUgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHByb2ZpbGU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIEhlYXJ0U3luYyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgY3JlYXRlUHJvZmlsZShzb3VyY2U6IG51bWJlciwgcHJvZmlsZURhdGE6IFBhcnRpYWw8SGVhcnRTeW5jUHJvZmlsZT4pOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGUgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgcHJvZmlsZSBhbHJlYWR5IGV4aXN0c1xuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdQcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ1Byb2ZpbGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb2ZpbGUgYWxyZWFkeSBleGlzdHMnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmV3UHJvZmlsZTogSGVhcnRTeW5jUHJvZmlsZSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBwcm9maWxlRGF0YS5uYW1lIHx8ICcnLFxuICAgICAgICAgICAgICAgIGFnZTogcHJvZmlsZURhdGEuYWdlIHx8IDE4LFxuICAgICAgICAgICAgICAgIGdlbmRlcjogcHJvZmlsZURhdGEuZ2VuZGVyIHx8ICcnLFxuICAgICAgICAgICAgICAgIGJpbzogcHJvZmlsZURhdGEuYmlvIHx8ICcnLFxuICAgICAgICAgICAgICAgIHBob3RvczogcHJvZmlsZURhdGEucGhvdG9zIHx8IFtdLFxuICAgICAgICAgICAgICAgIGludGVyZXN0czogcHJvZmlsZURhdGEuaW50ZXJlc3RzIHx8IFtdLFxuICAgICAgICAgICAgICAgIGxvb2tpbmdGb3I6IHByb2ZpbGVEYXRhLmxvb2tpbmdGb3IgfHwgJycsXG4gICAgICAgICAgICAgICAgaW50ZXJlc3RlZEluR2VuZGVyczogcHJvZmlsZURhdGEuaW50ZXJlc3RlZEluR2VuZGVycyB8fCBbXSxcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZU1pbjogcHJvZmlsZURhdGEuYWdlUmFuZ2VNaW4gfHwgMTgsXG4gICAgICAgICAgICAgICAgYWdlUmFuZ2VNYXg6IHByb2ZpbGVEYXRhLmFnZVJhbmdlTWF4IHx8IDM1LFxuICAgICAgICAgICAgICAgIG1heERpc3RhbmNlOiBwcm9maWxlRGF0YS5tYXhEaXN0YW5jZSB8fCAyNSxcbiAgICAgICAgICAgICAgICBzaG93T25saW5lOiBwcm9maWxlRGF0YS5zaG93T25saW5lICE9PSB1bmRlZmluZWQgPyBwcm9maWxlRGF0YS5zaG93T25saW5lIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3b3JrOiBwcm9maWxlRGF0YS53b3JrIHx8ICcnLFxuICAgICAgICAgICAgICAgIHNjaG9vbDogcHJvZmlsZURhdGEuc2Nob29sIHx8ICcnLFxuICAgICAgICAgICAgICAgIGhlaWdodDogcHJvZmlsZURhdGEuaGVpZ2h0LFxuICAgICAgICAgICAgICAgIHpvZGlhY1NpZ246IHByb2ZpbGVEYXRhLnpvZGlhY1NpZ24gfHwgJycsXG4gICAgICAgICAgICAgICAgbGlmZXN0eWxlOiBwcm9maWxlRGF0YS5saWZlc3R5bGUgfHwge1xuICAgICAgICAgICAgICAgICAgICBzbW9raW5nOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgZHJpbmtpbmc6ICcnLFxuICAgICAgICAgICAgICAgICAgICBleGVyY2lzZTogJycsXG4gICAgICAgICAgICAgICAgICAgIHBldHM6ICcnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcHJlbWl1bTogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3VwZXJMaWtlc1JlbWFpbmluZzogNSxcbiAgICAgICAgICAgICAgICBsaWtlc1JlbWFpbmluZzogNTAsXG4gICAgICAgICAgICAgICAgZGFpbHlTd2lwZXM6IDAsXG4gICAgICAgICAgICAgICAgbGFzdFN3aXBlUmVzZXQ6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgIGxhc3RBY3RpdmU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWVcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCBuZXdQcm9maWxlKTtcbiAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKHJlc3VsdCk7ICovXG4gICAgICAgICAgICByZXR1cm4geyAuLi5uZXdQcm9maWxlLCBfaWQ6IHJlc3VsdCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgY3JlYXRpbmcgSGVhcnRTeW5jIHByb2ZpbGU6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyB1cGRhdGVQcm9maWxlKHNvdXJjZTogbnVtYmVyLCBwcm9maWxlRGF0YTogUGFydGlhbDxIZWFydFN5bmNQcm9maWxlPik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZSB8IG51bGw+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBudWxsO1xuXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVEYXRhID0ge1xuICAgICAgICAgICAgICAgIC4uLnByb2ZpbGVEYXRhLFxuICAgICAgICAgICAgICAgIGxhc3RBY3RpdmU6IG5ldyBEYXRlKClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9LCB1cGRhdGVEYXRhLCB1bmRlZmluZWQsIGZhbHNlLCB7IHVwc2VydDogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC52YWx1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIEhlYXJ0U3luYyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IHVzZXJQcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmICghdXNlclByb2ZpbGUpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgLy8gR2V0IHVzZXJzIGFscmVhZHkgc3dpcGVkIG9uXG4gICAgICAgICAgICBjb25zdCBzd2lwZWRVc2VycyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19zd2lwZXMnLCB7XG4gICAgICAgICAgICAgICAgZnJvbVVzZXJJZDogY2l0aXplbklkXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIGNvbnN0IHN3aXBlZFVzZXJJZHMgPSBzd2lwZWRVc2Vycy5tYXAoKHN3aXBlOiBhbnkpID0+IHN3aXBlLnRvVXNlcklkKTtcblxuICAgICAgICAgICAgLy8gR2V0IG1hdGNoZWQgdXNlcnNcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMUlkOiBjaXRpemVuSWQgfSxcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMklkOiBjaXRpemVuSWQgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWVcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZFVzZXJJZHMgPSBtYXRjaGVzLm1hcCgobWF0Y2g6IGFueSkgPT5cbiAgICAgICAgICAgICAgICBtYXRjaC51c2VyMUlkID09PSBjaXRpemVuSWQgPyBtYXRjaC51c2VyMklkIDogbWF0Y2gudXNlcjFJZFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gQ29tYmluZSBleGNsdWRlZCB1c2Vyc1xuICAgICAgICAgICAgY29uc3QgZXhjbHVkZWRVc2VySWRzID0gWy4uLnN3aXBlZFVzZXJJZHMsIC4uLm1hdGNoZWRVc2VySWRzLCBjaXRpemVuSWRdO1xuXG4gICAgICAgICAgICAvLyBCdWlsZCBtYXRjaCBjcml0ZXJpYVxuICAgICAgICAgICAgY29uc3QgbWF0Y2hDcml0ZXJpYTogYW55ID0ge1xuICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogeyAkbmluOiBleGNsdWRlZFVzZXJJZHMgfSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhZ2U6IHsgJGd0ZTogdXNlclByb2ZpbGUuYWdlUmFuZ2VNaW4sICRsdGU6IHVzZXJQcm9maWxlLmFnZVJhbmdlTWF4IH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIEFkZCBnZW5kZXIgcHJlZmVyZW5jZXNcbiAgICAgICAgICAgIGlmICh1c2VyUHJvZmlsZS5sb29raW5nRm9yICE9PSAnRXZlcnlvbmUnKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hDcml0ZXJpYS5nZW5kZXIgPSB1c2VyUHJvZmlsZS5sb29raW5nRm9yID09PSAnTWVuJyA/ICdNYW4nIDogJ1dvbWFuJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHVzZXJQcm9maWxlLmludGVyZXN0ZWRJbkdlbmRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIG1hdGNoQ3JpdGVyaWEubG9va2luZ0ZvciA9IHtcbiAgICAgICAgICAgICAgICAgICAgJGluOiB1c2VyUHJvZmlsZS5pbnRlcmVzdGVkSW5HZW5kZXJzLmluY2x1ZGVzKHVzZXJQcm9maWxlLmdlbmRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgID8gdXNlclByb2ZpbGUuaW50ZXJlc3RlZEluR2VuZGVyc1xuICAgICAgICAgICAgICAgICAgICAgICAgOiBbLi4udXNlclByb2ZpbGUuaW50ZXJlc3RlZEluR2VuZGVycywgJ0V2ZXJ5b25lJ11cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwb3RlbnRpYWxNYXRjaGVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgbWF0Y2hDcml0ZXJpYSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBsaW1pdDogMjAgfSlcblxuICAgICAgICAgICAgcmV0dXJuIHBvdGVudGlhbE1hdGNoZXM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIHBvdGVudGlhbCBtYXRjaGVzOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHN3aXBlUHJvZmlsZShzb3VyY2U6IG51bWJlciwgc3dpcGVEYXRhOiB7IHRhcmdldFVzZXJJZDogc3RyaW5nOyBpc0xpa2U6IGJvb2xlYW47IGlzU3VwZXJMaWtlPzogYm9vbGVhbiB9KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgaXNNYXRjaDogZmFsc2UgfTtcblxuICAgICAgICAgICAgY29uc3QgeyB0YXJnZXRVc2VySWQsIGlzTGlrZSwgaXNTdXBlckxpa2UgPSBmYWxzZSB9ID0gc3dpcGVEYXRhO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBkYWlseSBsaW1pdHNcbiAgICAgICAgICAgIGNvbnN0IHVzZXJQcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmICghdXNlclByb2ZpbGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBpc01hdGNoOiBmYWxzZSB9O1xuXG4gICAgICAgICAgICBpZiAoaXNTdXBlckxpa2UgJiYgdXNlclByb2ZpbGUuc3VwZXJMaWtlc1JlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGlzTWF0Y2g6IGZhbHNlLCBlcnJvcjogJ05vIHN1cGVyIGxpa2VzIHJlbWFpbmluZycgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVjb3JkIHRoZSBzd2lwZVxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ2hlYXJ0c3luY19zd2lwZXMnLCB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBmcm9tVXNlcklkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgdG9Vc2VySWQ6IHRhcmdldFVzZXJJZCxcbiAgICAgICAgICAgICAgICBpc0xpa2UsXG4gICAgICAgICAgICAgICAgaXNTdXBlckxpa2UsXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbGV0IGlzTWF0Y2ggPSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIG1hdGNoIGlmIGl0J3MgYSBsaWtlXG4gICAgICAgICAgICBpZiAoaXNMaWtlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVjaXByb2NhbFN3aXBlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfc3dpcGVzJywge1xuICAgICAgICAgICAgICAgICAgICBmcm9tVXNlcklkOiB0YXJnZXRVc2VySWQsXG4gICAgICAgICAgICAgICAgICAgIHRvVXNlcklkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgICAgIGlzTGlrZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlY2lwcm9jYWxTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBDcmVhdGUgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZXIxSWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZXIySWQ6IHRhcmdldFVzZXJJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNTdXBlckxpa2U6IGlzU3VwZXJMaWtlIHx8IHJlY2lwcm9jYWxTd2lwZS5pc1N1cGVyTGlrZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgaXNNYXRjaCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBub3RpZmljYXRpb25zIHRvIGJvdGggdXNlcnMgYWJvdXQgdGhlIG1hdGNoXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBHZXQgcGxheWVyIGRhdGEgZm9yIGJvdGggdXNlcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXBlckRhdGEgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXREYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZCh0YXJnZXRVc2VySWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBHZXQgb2ZmbGluZSBkYXRhIGlmIHBsYXllcnMgYXJlIG5vdCBvbmxpbmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXBlclBsYXllckRhdGEgPSBzd2lwZXJEYXRhIHx8IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0T2ZmbGluZVBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRQbGF5ZXJEYXRhID0gdGFyZ2V0RGF0YSB8fCBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldE9mZmxpbmVQbGF5ZXJCeUNpdGl6ZW5JZCh0YXJnZXRVc2VySWQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTZW5kIG5vdGlmaWNhdGlvbiB0byB0aGUgc3dpcGVyIChjdXJyZW50IHVzZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3dpcGVyRGF0YSAmJiBzd2lwZXJEYXRhLlBsYXllckRhdGEuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzd2lwZXJEYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiSGVhcnRTeW5jIE1hdGNoISBcdUQ4M0RcdURDOTVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgbWF0Y2hlZCB3aXRoICR7dGFyZ2V0UGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXJEYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogXCJoZWFydHN5bmNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBub3RpZmljYXRpb24gdG8gdGhlIHRhcmdldCB1c2VyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0RGF0YSAmJiB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiSGVhcnRTeW5jIE1hdGNoISBcdUQ4M0RcdURDOTVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgbWF0Y2hlZCB3aXRoICR7c3dpcGVyUGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzd2lwZXJQbGF5ZXJEYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogXCJoZWFydHN5bmNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAobm90aWZpY2F0aW9uRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNlbmRpbmcgbWF0Y2ggbm90aWZpY2F0aW9uczonLCBub3RpZmljYXRpb25FcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgc3dpcGUgY291bnRzXG4gICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlRGF0YTogYW55ID0ge1xuICAgICAgICAgICAgICAgICAgICBkYWlseVN3aXBlczogdXNlclByb2ZpbGUuZGFpbHlTd2lwZXMgKyAxXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGlmIChpc1N1cGVyTGlrZSkge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVEYXRhLnN1cGVyTGlrZXNSZW1haW5pbmcgPSB1c2VyUHJvZmlsZS5zdXBlckxpa2VzUmVtYWluaW5nIC0gMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVEYXRhLmxpa2VzUmVtYWluaW5nID0gdXNlclByb2ZpbGUubGlrZXNSZW1haW5pbmcgLSAxO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9LCB1cGRhdGVEYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgaXNNYXRjaCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc3dpcGluZyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBpc01hdGNoOiBmYWxzZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0TWF0Y2hlcyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8YW55W10+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tYXRjaGVzJywge1xuICAgICAgICAgICAgICAgICRvcjogW1xuICAgICAgICAgICAgICAgICAgICB7IHVzZXIxSWQ6IGNpdGl6ZW5JZCB9LFxuICAgICAgICAgICAgICAgICAgICB7IHVzZXIySWQ6IGNpdGl6ZW5JZCB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBzb3J0OiB7IG1hdGNoZWRBdDogLTEgfSB9KTtcblxuICAgICAgICAgICAgY29uc3QgZW5yaWNoZWRNYXRjaGVzID0gYXdhaXQgUHJvbWlzZS5hbGwobWF0Y2hlcy5tYXAoYXN5bmMgKG1hdGNoOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlclVzZXJJZCA9IG1hdGNoLnVzZXIxSWQgPT09IGNpdGl6ZW5JZCA/IG1hdGNoLnVzZXIySWQgOiBtYXRjaC51c2VyMUlkO1xuICAgICAgICAgICAgICAgIGNvbnN0IG90aGVyVXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQ6IG90aGVyVXNlcklkIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGFzdE1lc3NhZ2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19tZXNzYWdlcycsIHsgbWF0Y2hJZDogbWF0Y2guX2lkIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgc29ydDogeyB0aW1lc3RhbXA6IC0xIH0gfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAuLi5tYXRjaCxcbiAgICAgICAgICAgICAgICAgICAgb3RoZXJVc2VyLFxuICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogbGFzdE1lc3NhZ2U/LmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlVGltZTogbGFzdE1lc3NhZ2U/LnRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICAgICAgaXNOZXdNYXRjaDogIWxhc3RNZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB1bnJlYWRDb3VudDogYXdhaXQgdGhpcy5nZXRVbnJlYWRNZXNzYWdlQ291bnQobWF0Y2guX2lkIS50b1N0cmluZygpLCBjaXRpemVuSWQpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgcmV0dXJuIGVucmljaGVkTWF0Y2hlcztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgbWF0Y2hlczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFVucmVhZE1lc3NhZ2VDb3VudChtYXRjaElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21lc3NhZ2VzJywge1xuICAgICAgICAgICAgICAgIG1hdGNoSWQsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZXJJZDogdXNlcklkLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIHJldHVybiBjb3VudC5sZW5ndGg7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIHVucmVhZCBjb3VudDonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1vY2sgaW1wbGVtZW50YXRpb25zIGZvciBvdGhlciBtZXRob2RzIC0gcmVwbGFjZSB3aXRoIGFjdHVhbCBsb2dpY1xuICAgIGFzeW5jIGdldFN3aXBlU3RhdHMoc291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCBwcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgcmV0dXJuIHByb2ZpbGUgPyB7XG4gICAgICAgICAgICBsaWtlc1JlbWFpbmluZzogcHJvZmlsZS5saWtlc1JlbWFpbmluZyxcbiAgICAgICAgICAgIHN1cGVyTGlrZXNSZW1haW5pbmc6IHByb2ZpbGUuc3VwZXJMaWtlc1JlbWFpbmluZyxcbiAgICAgICAgICAgIGRhaWx5U3dpcGVzOiBwcm9maWxlLmRhaWx5U3dpcGVzXG4gICAgICAgIH0gOiBudWxsO1xuICAgIH1cblxuICAgIGFzeW5jIGdldE5lYXJieVVzZXJzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvbiAtIHJlcGxhY2Ugd2l0aCBhY3R1YWwgZ2VvbG9jYXRpb24gbG9naWNcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2UpO1xuICAgIH1cblxuICAgIGFzeW5jIGdldE9ubGluZVVzZXJzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgY29uc3QgZml2ZU1pbnV0ZXNBZ28gPSBuZXcgRGF0ZShEYXRlLm5vdygpIC0gNSAqIDYwICogMTAwMCk7XG4gICAgICAgICAgICBjb25zdCBvbmxpbmVVc2VycyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19wcm9maWxlcycsIHtcbiAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IHsgJG5lOiBjaXRpemVuSWQgfSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBsYXN0QWN0aXZlOiB7ICRndGU6IGZpdmVNaW51dGVzQWdvIH1cbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgbGltaXQ6IDEwIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gb25saW5lVXNlcnM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIG9ubGluZSB1c2VyczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBnZXRSZWNlbnRseUFjdGl2ZVVzZXJzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgY29uc3Qgb25lRGF5QWdvID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICAgICAgICAgICAgY29uc3QgcmVjZW50VXNlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiB7ICRuZTogY2l0aXplbklkIH0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgbGFzdEFjdGl2ZTogeyAkZ3RlOiBvbmVEYXlBZ28gfVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBsaW1pdDogMTUsIHNvcnQ6IHsgbGFzdEFjdGl2ZTogLTEgfSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlY2VudFVzZXJzO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyByZWNlbnRseSBhY3RpdmUgdXNlcnM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0VG9wUGlja3Moc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGVbXT4ge1xuICAgICAgICAvLyBNb2NrIGltcGxlbWVudGF0aW9uIC0gcmVwbGFjZSB3aXRoIGFjdHVhbCBhbGdvcml0aG1cbiAgICAgICAgY29uc3QgcG90ZW50aWFsTWF0Y2hlcyA9IGF3YWl0IHRoaXMuZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2UpO1xuICAgICAgICByZXR1cm4gcG90ZW50aWFsTWF0Y2hlcy5zbGljZSgwLCA4KTtcbiAgICB9XG5cbiAgICBhc3luYyBnZXROb3RpZmljYXRpb25zKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4geyBuZXdNYXRjaGVzOiAwLCBuZXdNZXNzYWdlczogMCwgc3VwZXJMaWtlczogMCB9O1xuXG4gICAgICAgICAgICAvLyBHZXQgbmV3IG1hdGNoZXMgKG1hdGNoZXMgd2l0aG91dCBtZXNzYWdlcylcbiAgICAgICAgICAgIGNvbnN0IG5ld01hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFt7IHVzZXIxSWQ6IGNpdGl6ZW5JZCB9LCB7IHVzZXIySWQ6IGNpdGl6ZW5JZCB9XSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAvLyBBZGQgbG9naWMgdG8gY2hlY2sgaWYgbWF0Y2ggaXMgbmV3XG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcblxuICAgICAgICAgICAgLy8gR2V0IHVucmVhZCBtZXNzYWdlc1xuICAgICAgICAgICAgY29uc3QgbmV3TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWVzc2FnZXMnLCB7XG4gICAgICAgICAgICAgICAgcmVjZWl2ZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcblxuICAgICAgICAgICAgLy8gR2V0IHJlY2VpdmVkIHN1cGVyIGxpa2VzXG4gICAgICAgICAgICBjb25zdCBzdXBlckxpa2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3N3aXBlcycsIHtcbiAgICAgICAgICAgICAgICB0b1VzZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIGlzU3VwZXJMaWtlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGlzTGlrZTogdHJ1ZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7IG5ld01hdGNoZXM6IG5ld01hdGNoZXMubGVuZ3RoLCBuZXdNZXNzYWdlczogbmV3TWVzc2FnZXMubGVuZ3RoLCBzdXBlckxpa2VzOiBzdXBlckxpa2VzLmxlbmd0aCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBub3RpZmljYXRpb25zOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IG5ld01hdGNoZXM6IDAsIG5ld01lc3NhZ2VzOiAwLCBzdXBlckxpa2VzOiAwIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBnZXRNZXNzYWdlcyhzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWVzc2FnZXMnLCB7IG1hdGNoSWQ6IGRhdGEubWF0Y2hJZCB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBhc3luYyBzZW5kTWVzc2FnZShzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSB7XG4gICAgICAgIC8qIGNvbnNvbGUubG9nKGRhdGEpOyAqL1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywgeyBfaWQ6IFN0cmluZyhkYXRhLm1hdGNoSWQpIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgICAgICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgbGV0IHNvdXJjZURhdGEgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKHNvdXJjZUNpdGl6ZW5JZCk7XG4gICAgICAgIGxldCB0YXJnZXREYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZXMudXNlcjFJZCA9PT0gc291cmNlQ2l0aXplbklkID8gcmVzLnVzZXIySWQgOiByZXMudXNlcjFJZCk7XG5cbiAgICAgICAgaWYgKCFzb3VyY2VEYXRhKSB7XG4gICAgICAgICAgICBzb3VyY2VEYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRPZmZsaW5lUGxheWVyQnlDaXRpemVuSWQoc291cmNlQ2l0aXplbklkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGFyZ2V0RGF0YSkge1xuICAgICAgICAgICAgdGFyZ2V0RGF0YSA9IGF3YWl0IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0T2ZmbGluZVBsYXllckJ5Q2l0aXplbklkKHJlcy51c2VyMUlkID09PSBzb3VyY2VDaXRpemVuSWQgPyByZXMudXNlcjJJZCA6IHJlcy51c2VyMUlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGluc2VydERhdGE6IE1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgcmVhZDogcmVzLnVzZXIxSWQgPT09IHNvdXJjZUNpdGl6ZW5JZCB8fCByZXMudXNlcjJJZCA9PT0gc291cmNlQ2l0aXplbklkID8gdHJ1ZSA6IGZhbHNlLFxuICAgICAgICAgICAgbWF0Y2hJZDogcmVzLl9pZCxcbiAgICAgICAgICAgIHNlbmRlcklkOiBzb3VyY2VDaXRpemVuSWQsXG4gICAgICAgICAgICByZWNlaXZlcklkOiByZXMudXNlcjFJZCA9PT0gc291cmNlQ2l0aXplbklkID8gcmVzLnVzZXIySWQgOiByZXMudXNlcjFJZCxcbiAgICAgICAgICAgIGNvbnRlbnQ6IGRhdGEuY29udGVudCxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfbWVzc2FnZXMnLCBpbnNlcnREYXRhKTtcblxuICAgICAgICBpZiAocmVzLnVzZXIxSWQgIT09IHNvdXJjZUNpdGl6ZW5JZCB8fCByZXMudXNlcjJJZCAhPT0gc291cmNlQ2l0aXplbklkICYmIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UpIHtcbiAgICAgICAgICAgIGVtaXROZXQoJ2hlYXJ0c3luYzpjbGllbnQ6c2VuZE1lc3NhZ2UnLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeShpbnNlcnREYXRhKSk7XG4gICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiSGVhcnRTeW5jXCIsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiWW91IGhhdmUgYSBuZXcgbWVzc2FnZSBmcm9tIFwiICsgc291cmNlRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZSArIFwiIFwiICsgc291cmNlRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lLFxuICAgICAgICAgICAgICAgIGFwcDogXCJoZWFydHN5bmNcIixcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGluc2VydERhdGE7XG4gICAgfVxuXG4gICAgYXN5bmMgdW5tYXRjaChzb3VyY2U6IG51bWJlciwgZGF0YTogeyBtYXRjaElkOiBzdHJpbmcgfSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywgeyBfaWQ6IGRhdGEubWF0Y2hJZCB9KTtcbiAgICAgICAgICAgIGlmICghbWF0Y2ggfHwgIW1hdGNoLmlzQWN0aXZlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgdXNlciBpcyBwYXJ0IG9mIHRoaXMgbWF0Y2hcbiAgICAgICAgICAgIGlmIChtYXRjaC51c2VyMUlkICE9PSBjaXRpemVuSWQgJiYgbWF0Y2gudXNlcjJJZCAhPT0gY2l0aXplbklkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm90IGF1dGhvcml6ZWQgdG8gdW5tYXRjaCB0aGlzIHVzZXInIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIERlYWN0aXZhdGUgdGhlIG1hdGNoXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnaGVhcnRzeW5jX21hdGNoZXMnLCB7IF9pZDogZGF0YS5tYXRjaElkIH0sIHsgaXNBY3RpdmU6IGZhbHNlIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1bm1hdGNoaW5nOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0ZhaWxlZCB0byB1bm1hdGNoJyB9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBoZWFydFN5bmNTZXJ2ZXIgPSBuZXcgSGVhcnRTeW5jU2VydmVyKCk7XG5cbi8vIFJlZ2lzdGVyIHNlcnZlciBjYWxsYmFja3Ncbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXRQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRQcm9maWxlKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmNyZWF0ZVByb2ZpbGUnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuY3JlYXRlUHJvZmlsZShzb3VyY2UsIGRhdGEpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzp1cGRhdGVQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLnVwZGF0ZVByb2ZpbGUoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0UG90ZW50aWFsTWF0Y2hlcycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpzd2lwZVByb2ZpbGUnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuc3dpcGVQcm9maWxlKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE1hdGNoZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE1hdGNoZXMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0U3dpcGVTdGF0cycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0U3dpcGVTdGF0cyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXROZWFyYnlVc2VycycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0TmVhcmJ5VXNlcnMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0T25saW5lVXNlcnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE9ubGluZVVzZXJzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFJlY2VudGx5QWN0aXZlVXNlcnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFJlY2VudGx5QWN0aXZlVXNlcnMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0VG9wUGlja3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFRvcFBpY2tzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE5vdGlmaWNhdGlvbnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE5vdGlmaWNhdGlvbnMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0TWVzc2FnZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0TWVzc2FnZXMoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6c2VuZE1lc3NhZ2UnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuc2VuZE1lc3NhZ2Uoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6dW5tYXRjaCcsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci51bm1hdGNoKHNvdXJjZSwgZGF0YSk7XG59KTtcblxuLy8gQWRkIG1vcmUgY2FsbGJhY2tzIGZvciBtZXNzYWdlcywgc3VwZXIgbGlrZXMsIGV0Yy5cbi8vIC4uLiAoaW1wbGVtZW50IHJlbWFpbmluZyBjYWxsYmFja3MgYXMgbmVlZGVkKVxuXG5leHBvcnQgeyBoZWFydFN5bmNTZXJ2ZXIgfTtcbiIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBGcmFtZXdvcmssIExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBEYXRlVGltZSB9IGZyb20gJ2x1eG9uJztcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NyeXB0bzpnZXRCYWxhbmNlcycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBjcnlwdG8gPSBwbGF5ZXIuUGxheWVyRGF0YS5tZXRhZGF0YS5jcnlwdG8gfHwge307XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNyeXB0byk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY3J5cHRvOmJ1eScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0eXBlLCBhbW91bnQsIHByaWNlIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFwbGF5ZXIgfHwgIVtcInNodW5nXCIsIFwiZ25lXCIsIFwieGNvaW5cIiwgXCJsbWVcIl0uaW5jbHVkZXModHlwZSkpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBjb25zdCB0b3RhbENvc3QgPSBhbW91bnQgKiBwcmljZTsgIC8vIEFzc3VtZSBwcmljZSBpcyBwZXIgdW5pdFxuICAgIGlmIChwbGF5ZXIuUGxheWVyRGF0YS5tb25leS5iYW5rIDwgdG90YWxDb3N0KSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgaWYgKHBsYXllci5GdW5jdGlvbnMuUmVtb3ZlTW9uZXkoJ2JhbmsnLCB0b3RhbENvc3QpKSB7XG4gICAgICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5BZGRDcnlwdG8oc291cmNlLCB0eXBlLCBhbW91bnQpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdjcnlwdG9fYnV5JyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ3J5cHRvIEJ1eScsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtwbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7cGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGJvdWdodCAke2Ftb3VudH0gJHt0eXBlfSBmb3IgJCR7dG90YWxDb3N0fS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjcnlwdG86c2VsbCcsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0eXBlLCBhbW91bnQsIHByaWNlIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFwbGF5ZXIgfHwgIVtcInNodW5nXCIsIFwiZ25lXCIsIFwieGNvaW5cIiwgXCJsbWVcIl0uaW5jbHVkZXModHlwZSkpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBpZiAoIWV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5oYXNFbm91Z2goc291cmNlLCB0eXBlLCBhbW91bnQpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLlJlbW92ZUNyeXB0byhzb3VyY2UsIHR5cGUsIGFtb3VudCk7XG4gICAgcGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGFtb3VudCAqIHByaWNlKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ2NyeXB0b19zZWxsJyxcbiAgICAgICAgdGl0bGU6ICdDcnlwdG8gU2VsbCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke3BsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtwbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gc29sZCAke2Ftb3VudH0gJHt0eXBlfSBmb3IgJCR7YW1vdW50ICogcHJpY2V9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY3J5cHRvOnRyYW5zZmVyJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHR5cGUsIGFtb3VudCwgdGFyZ2V0IH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFzb3VyY2VQbGF5ZXIgfHwgIVtcInNodW5nXCIsIFwiZ25lXCIsIFwieGNvaW5cIiwgXCJsbWVcIl0uaW5jbHVkZXModHlwZSkpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBpZiAoIWV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5oYXNFbm91Z2goc291cmNlLCB0eXBlLCBhbW91bnQpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgLy8gQXNzdW1lIHRhcmdldCBpcyBwaG9uZSBudW1iZXIgdG8gZ2V0IGNpdGl6ZW5JZFxuICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIodGFyZ2V0KTtcbiAgICBpZiAoIXRhcmdldENpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGNvbnN0IHRhcmdldFBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyQnlDaXRpemVuSWQodGFyZ2V0Q2l0aXplbklkKTtcbiAgICBpZiAoIXRhcmdldFBsYXllcikgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5SZW1vdmVDcnlwdG8oc291cmNlLCB0eXBlLCBhbW91bnQpO1xuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5BZGRDcnlwdG8odGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlLCB0eXBlLCBhbW91bnQpO1xuICAgIFxuICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiAnQ3J5cHRvJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgdHJhbnNmZXJyZWQgJHthbW91bnR9ICR7dHlwZX0gdG8gJHt0YXJnZXR9LmAsXG4gICAgICAgIGFwcDogJ2NyeXB0bycsXG4gICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICB9KSk7XG4gICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6ICdDcnlwdG8nLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSByZWNlaXZlZCAke2Ftb3VudH0gJHt0eXBlfSBmcm9tICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfS5gLFxuICAgICAgICBhcHA6ICdjcnlwdG8nLFxuICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgfSkpO1xuICAgIFxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAnY3J5cHRvX3RyYW5zZmVyJyxcbiAgICAgICAgdGl0bGU6ICdDcnlwdG8gVHJhbnNmZXInLFxuICAgICAgICBtZXNzYWdlOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IHRyYW5zZmVycmVkICR7YW1vdW50fSAke3R5cGV9IHRvICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTsiLCAiaW1wb3J0IHsgRnJhbWV3b3JrLCBNeVNRTCB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSwgSU5WRU5UT1JZX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxuY29uc3QgaW52UGF0aCA9IGBudWk6Ly8ke0lOVkVOVE9SWV9SRVNPVVJDRX0vaHRtbC9pbWFnZXMvYDtcblxudHlwZSBSZXdhcmRUeXBlID0gXCJ2ZWhpY2xlXCIgfCBcIml0ZW1cIiB8IFwiY2FzaFwiIHwgXCJiYW5rXCIgfCBcIndlYXBvblwiO1xudHlwZSBSYXJpdHkgPSBcImxlZ2VuZGFyeVwiIHwgXCJlcGljXCIgfCBcInJhcmVcIiB8IFwiY29tbW9uXCI7XG5cbmludGVyZmFjZSBSb3VsZXR0ZVJld2FyZCB7XG4gICAgaWQ6IG51bWJlcjtcbiAgICB0eXBlOiBSZXdhcmRUeXBlO1xuICAgIG1vZGVsOiBzdHJpbmcgfCBudW1iZXI7XG4gICAgcmFyaXR5OiBSYXJpdHk7XG4gICAgaW1nOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHNlbGw6IG51bWJlcjtcbiAgICBxdWFudGl0eT86IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIERhaWx5U3BpbkNvbmZpZ1NoYXBlIHtcbiAgICBUaW1lVG9DbGFpbTogbnVtYmVyO1xuICAgIEFuaW1hdGlvbkR1cmF0aW9uOiBudW1iZXI7XG4gICAgUm91bGV0dGVEYXRhOiBSZWNvcmQ8bnVtYmVyLCBSb3VsZXR0ZVJld2FyZD47XG4gICAgUmFyaXR5UHJvYmFiaWxpdHk6IFJlY29yZDxSYXJpdHksIG51bWJlcj47XG4gICAgU2VsbFR5cGU6IFwiYmFua1wiIHwgXCJjYXNoXCI7XG4gICAgV2VhcG9uQW1vdW50OiBudW1iZXI7XG4gICAgQ2FyUGFya2luZ1NwYXduOiBzdHJpbmc7XG59XG5cbmNvbnN0IERhaWx5U3BpbkNvbmZpZzogRGFpbHlTcGluQ29uZmlnU2hhcGUgPSB7XG4gICAgVGltZVRvQ2xhaW06ICgyNCAqIDM2MDApLFxuXG4gICAgQW5pbWF0aW9uRHVyYXRpb246IDEyLFxuXG4gICAgUm91bGV0dGVEYXRhOiB7XG4gICAgICAgIDA6IHtcbiAgICAgICAgICAgIGlkOiAwLFxuICAgICAgICAgICAgdHlwZTogXCJ2ZWhpY2xlXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJwZW51bWJyYVwiLFxuICAgICAgICAgICAgcmFyaXR5OiBcImxlZ2VuZGFyeVwiLFxuICAgICAgICAgICAgaW1nOiBcImh0dHBzOi8vZG9jcy5maXZlbS5uZXQvdmVoaWNsZXMvcGVudW1icmEud2VicFwiLFxuICAgICAgICAgICAgbmFtZTogXCJQZW51bWJyYVwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMToge1xuICAgICAgICAgICAgaWQ6IDEsXG4gICAgICAgICAgICB0eXBlOiBcIndlYXBvblwiLFxuICAgICAgICAgICAgbW9kZWw6IFwid2VhcG9uX2RyYWNvXCIsXG4gICAgICAgICAgICByYXJpdHk6IFwiZXBpY1wiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXFiX2RyYWNvLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkRyYWNvXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwMFxuICAgICAgICB9LFxuICAgICAgICAyOiB7XG4gICAgICAgICAgICBpZDogMixcbiAgICAgICAgICAgIHJhcml0eTogXCJyYXJlXCIsXG4gICAgICAgICAgICB0eXBlOiBcIndlYXBvblwiLFxuICAgICAgICAgICAgbW9kZWw6IFwid2VhcG9uX2Jyb3duaW5nXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9cWJfYnJvd25pbmcucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiQnJvd25pbmdcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDBcbiAgICAgICAgfSxcbiAgICAgICAgMzoge1xuICAgICAgICAgICAgaWQ6IDMsXG4gICAgICAgICAgICByYXJpdHk6IFwicmFyZVwiLFxuICAgICAgICAgICAgdHlwZTogXCJpdGVtXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJhZHZhbmNlZHJlcGFpcmtpdFwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWFkdmFuY2Vka2l0LnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkFkdiBSZXBhaXIgS2l0IHg1XCIsXG4gICAgICAgICAgICBzZWxsOiA1MDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDVcbiAgICAgICAgfSxcbiAgICAgICAgNDoge1xuICAgICAgICAgICAgaWQ6IDQsXG4gICAgICAgICAgICByYXJpdHk6IFwicmFyZVwiLFxuICAgICAgICAgICAgdHlwZTogXCJjYXNoXCIsXG4gICAgICAgICAgICBtb2RlbDogMTAwMDAsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9Y2FzaC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCIkMTAwMDAgQ2FzaFwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMFxuICAgICAgICB9LFxuICAgICAgICA1OiB7XG4gICAgICAgICAgICBpZDogNSxcbiAgICAgICAgICAgIHJhcml0eTogXCJyYXJlXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImFkdmFuY2VkbG9ja3BpY2tcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1hZHZhbmNlZGxvY2twaWNrLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkFkdmFuY2VkIExvY2twaWNrIHg1XCIsXG4gICAgICAgICAgICBzZWxsOiAyNTAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDVcbiAgICAgICAgfSxcbiAgICAgICAgNjoge1xuICAgICAgICAgICAgaWQ6IDYsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImZha1wiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWZpcnN0YWlkLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkZBSyB4MTBcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDAsXG4gICAgICAgICAgICBxdWFudGl0eTogMTBcbiAgICAgICAgfSxcbiAgICAgICAgNzoge1xuICAgICAgICAgICAgaWQ6IDcsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcImNhc2hcIixcbiAgICAgICAgICAgIG1vZGVsOiA1MDAwLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWNhc2gucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiJDUwMDAgQ2FzaFwiLFxuICAgICAgICAgICAgc2VsbDogMTAwMFxuICAgICAgICB9LFxuICAgICAgICA4OiB7XG4gICAgICAgICAgICBpZDogOCxcbiAgICAgICAgICAgIHJhcml0eTogXCJjb21tb25cIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwibG9ja3BpY2tcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1sb2NrcGljay5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJMb2NrcGljayB4MTBcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDAsXG4gICAgICAgICAgICBxdWFudGl0eTogMTBcbiAgICAgICAgfSxcbiAgICAgICAgOToge1xuICAgICAgICAgICAgaWQ6IDksXG4gICAgICAgICAgICByYXJpdHk6IFwiZXBpY1wiLFxuICAgICAgICAgICAgdHlwZTogXCJjYXNoXCIsXG4gICAgICAgICAgICBtb2RlbDogMjUwMDAsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9Y2FzaC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCIkMjUwMDAgQ2FzaFwiLFxuICAgICAgICAgICAgc2VsbDogMTAwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTA6IHtcbiAgICAgICAgICAgIGlkOiAxMCxcbiAgICAgICAgICAgIHJhcml0eTogXCJsZWdlbmRhcnlcIixcbiAgICAgICAgICAgIHR5cGU6IFwid2VhcG9uXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJ3ZWFwb25fYWs0N1wiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXdlYXBvbl9hc3NhdWx0cmlmbGUucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiQUs0N1wiLFxuICAgICAgICAgICAgc2VsbDogMjUwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTE6IHtcbiAgICAgICAgICAgIGlkOiAxMSxcbiAgICAgICAgICAgIHJhcml0eTogXCJlcGljXCIsXG4gICAgICAgICAgICB0eXBlOiBcInZlaGljbGVcIixcbiAgICAgICAgICAgIG1vZGVsOiBcImZhZ2dpb1wiLFxuICAgICAgICAgICAgaW1nOiBcImh0dHBzOi8vZG9jcy5maXZlbS5uZXQvdmVoaWNsZXMvZmFnZ2lvLndlYnBcIixcbiAgICAgICAgICAgIG5hbWU6IFwiRmFnZ2lvXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwMFxuICAgICAgICB9LFxuICAgICAgICAxMjoge1xuICAgICAgICAgICAgaWQ6IDEyLFxuICAgICAgICAgICAgcmFyaXR5OiBcInJhcmVcIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwiaGVhdnlhcm1vclwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWFybW9yLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkhlYXZ5IEFybW9yIHgyXCIsXG4gICAgICAgICAgICBzZWxsOiAyNTAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDJcbiAgICAgICAgfSxcbiAgICAgICAgMTM6IHtcbiAgICAgICAgICAgIGlkOiAxMyxcbiAgICAgICAgICAgIHJhcml0eTogXCJjb21tb25cIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwiam9pbnRcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1qb2ludC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJKb2ludCB4MTVcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDAsXG4gICAgICAgICAgICBxdWFudGl0eTogMTVcbiAgICAgICAgfSxcbiAgICAgICAgMTQ6IHtcbiAgICAgICAgICAgIGlkOiAxNCxcbiAgICAgICAgICAgIHJhcml0eTogXCJjb21tb25cIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwiYmxvY2tvY2hlZXNlXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9cmF0X2NoZWVzZS5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJDaGVlc2UgeDIwXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDIwXG4gICAgICAgIH0sXG4gICAgICAgIDE1OiB7XG4gICAgICAgICAgICBpZDogMTUsXG4gICAgICAgICAgICB0eXBlOiBcImNhc2hcIixcbiAgICAgICAgICAgIG1vZGVsOiA3NTAwMCxcbiAgICAgICAgICAgIHJhcml0eTogXCJsZWdlbmRhcnlcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1jYXNoLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIiQ3NTAwMCBDYXNoXCIsXG4gICAgICAgICAgICBzZWxsOiAyNTAwMFxuICAgICAgICB9LFxuICAgICAgICAxNjoge1xuICAgICAgICAgICAgaWQ6IDE2LFxuICAgICAgICAgICAgcmFyaXR5OiBcImNvbW1vblwiLFxuICAgICAgICAgICAgdHlwZTogXCJpdGVtXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJyZWN5Y2xhYmxlX21hdGVyaWFsXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9cmVjeWNsYWJsZS1tYXRlcmlhbC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJSZWN5Y2xhYmxlcyB4MTAwXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDEwMFxuICAgICAgICB9LFxuICAgICAgICAxNzoge1xuICAgICAgICAgICAgaWQ6IDE3LFxuICAgICAgICAgICAgcmFyaXR5OiBcInJhcmVcIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwicmVjeWNsYWJsZV9tYXRlcmlhbFwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXJlY3ljbGFibGUtbWF0ZXJpYWwucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiUmVjeWNsYWJsZXMgeDI1MFwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiAyNTBcbiAgICAgICAgfSxcbiAgICB9LFxuXG4gICAgUmFyaXR5UHJvYmFiaWxpdHk6IHtcbiAgICAgICAgbGVnZW5kYXJ5OiAwLjAwMSxcbiAgICAgICAgZXBpYzogMC4wMixcbiAgICAgICAgcmFyZTogMC4yMCxcbiAgICAgICAgY29tbW9uOiAwLjc3OVxuICAgIH0sXG5cbiAgICBTZWxsVHlwZTogXCJiYW5rXCIsIC8vIGJhbmsgb3IgY2FzaFxuXG4gICAgV2VhcG9uQW1vdW50OiAyNTAsIC8vIGFtb3VudCBvZiBhbW1vIHRvIGdpdmUgd2hlbiBhIHdlYXBvbiBpcyB3b25cblxuICAgIENhclBhcmtpbmdTcGF3bjogXCJhbHRhXCIsIC8vIFFCOiBnYXJhZ2UsIEVTWDogcGFya2luZ1xufTtcblxuY29uc3Qgbm93SW5TZWNvbmRzID0gKCkgPT4gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG5cbmNvbnN0IGZvcm1hdFJlbWFpbmluZyA9IChyZW1haW5pbmc6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcihyZW1haW5pbmcgLyAzNjAwKTtcbiAgICBjb25zdCBtaW5zID0gTWF0aC5mbG9vcigocmVtYWluaW5nICUgMzYwMCkgLyA2MCk7XG4gICAgY29uc3Qgc2VjcyA9IHJlbWFpbmluZyAlIDYwO1xuXG4gICAgcmV0dXJuIGAke1N0cmluZyhob3VycykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhtaW5zKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKHNlY3MpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufTtcblxuY29uc3QgZ2V0Q29vbGRvd25TdGF0ZSA9IChwbGF5ZXI6IGFueSkgPT4ge1xuICAgIGNvbnN0IGxhc3QgPSBwbGF5ZXI/LlBsYXllckRhdGE/Lm1ldGFkYXRhPy5QaG9uZURhaWx5U3BpbiA/PyAwO1xuICAgIGNvbnN0IGRpZmYgPSBub3dJblNlY29uZHMoKSAtIGxhc3Q7XG5cbiAgICBpZiAoZGlmZiA+PSBEYWlseVNwaW5Db25maWcuVGltZVRvQ2xhaW0pIHtcbiAgICAgICAgcmV0dXJuIHsgY2FuQ2xhaW06IHRydWUsIGxhc3RDbGFpbWVkRGlzcGxheTogXCIwMDowMDowMFwiIH07XG4gICAgfVxuXG4gICAgY29uc3QgcmVtYWluaW5nID0gRGFpbHlTcGluQ29uZmlnLlRpbWVUb0NsYWltIC0gZGlmZjtcbiAgICByZXR1cm4geyBjYW5DbGFpbTogZmFsc2UsIGxhc3RDbGFpbWVkRGlzcGxheTogZm9ybWF0UmVtYWluaW5nKHJlbWFpbmluZykgfTtcbn07XG5cbmNvbnN0IHJlc29sdmVGcmFtZXdvcmsgPSAoKSA9PiB7XG4gICAgaWYgKEZyYW1ld29yaykgcmV0dXJuIEZyYW1ld29yaztcblxuICAgIGNvbnN0IGNvbmZpZ3VyZWQgPSBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV07XG4gICAgaWYgKHR5cGVvZiBjb25maWd1cmVkPy5HZXRDb3JlT2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBjb25maWd1cmVkLkdldENvcmVPYmplY3QoKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBmYWxsIHRocm91Z2ggdG8gcmV0dXJuIGNvbmZpZ3VyZWQgZGlyZWN0bHlcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29uZmlndXJlZCkgcmV0dXJuIGNvbmZpZ3VyZWQ7XG5cbiAgICBjb25zdCBxYiA9IGV4cG9ydHNbJ3FiLWNvcmUnXT8uR2V0Q29yZU9iamVjdD8uKCk7XG4gICAgaWYgKHFiKSByZXR1cm4gcWI7XG5cbiAgICBjb25zdCBxYnggPSBleHBvcnRzWydxYngtY29yZSddID8/IGV4cG9ydHNbJ3FieF9jb3JlJ107XG4gICAgaWYgKHR5cGVvZiBxYng/LkdldENvcmVPYmplY3QgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIHFieC5HZXRDb3JlT2JqZWN0KCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHJldHVybiBxYnggZGlyZWN0bHlcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcWJ4O1xufTtcblxuY29uc3QgZ2V0UGxheWVyID0gKHNyYzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgZncgPSByZXNvbHZlRnJhbWV3b3JrKCk7XG4gICAgcmV0dXJuIGZ3Py5GdW5jdGlvbnM/LkdldFBsYXllcj8uKHNyYykgPz8gZnc/LkdldFBsYXllcj8uKHNyYyk7XG59O1xuXG5vbk5ldChcImRhaWx5U3BpbjpnZXRTdGF0ZVNlcnZlclwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcihzcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBjb25zdCB7IGNhbkNsYWltLCBsYXN0Q2xhaW1lZERpc3BsYXkgfSA9IGdldENvb2xkb3duU3RhdGUocGxheWVyKTtcblxuICAgIGVtaXROZXQoXCJkYWlseVNwaW46cmV0dXJuU3RhdGVcIiwgc3JjLCB7XG4gICAgICAgIHVzZXJEYXRhOiB7XG4gICAgICAgICAgICBjYW5DbGFpbSxcbiAgICAgICAgICAgIGxhc3RDbGFpbWVkRGlzcGxheSxcbiAgICAgICAgfSxcbiAgICAgICAgcm91bGV0dGVEYXRhOiBEYWlseVNwaW5Db25maWcuUm91bGV0dGVEYXRhLFxuICAgICAgICBwcm9iYWJpbGl0eTogRGFpbHlTcGluQ29uZmlnLlJhcml0eVByb2JhYmlsaXR5LFxuICAgICAgICBhbmltYXRpb25EdXJhdGlvbjogRGFpbHlTcGluQ29uZmlnLkFuaW1hdGlvbkR1cmF0aW9uLFxuICAgIH0pO1xufSk7XG5cbm9uTmV0KFwiZGFpbHlTcGluOmNsYWltU2VydmVyXCIsICgpID0+IHtcbiAgICBjb25zdCBzcmMgPSBOdW1iZXIoZ2xvYmFsLnNvdXJjZSk7XG4gICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyKHNyYyk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybjtcblxuICAgIHBsYXllci5GdW5jdGlvbnMuU2V0TWV0YURhdGEoXCJQaG9uZURhaWx5U3BpblwiLCBub3dJblNlY29uZHMoKSk7XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46cmV3YXJkU2VydmVyXCIsIChpZDogbnVtYmVyKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcihzcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBjb25zdCByZXdhcmRJZCA9IE51bWJlcihpZCk7XG4gICAgaWYgKE51bWJlci5pc05hTihyZXdhcmRJZCkpIHJldHVybjtcblxuICAgIGNvbnN0IHJld2FyZCA9IERhaWx5U3BpbkNvbmZpZy5Sb3VsZXR0ZURhdGFbcmV3YXJkSWRdO1xuICAgIGlmICghcmV3YXJkKSByZXR1cm47XG5cbiAgICBzd2l0Y2ggKHJld2FyZC50eXBlKSB7XG4gICAgICAgIGNhc2UgXCJ2ZWhpY2xlXCI6XG4gICAgICAgICAgICBlbWl0KFwiZGFpbHlTcGluOmdpdmVWZWhpY2xlXCIsIHJld2FyZC5tb2RlbCwgc3JjKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiaXRlbVwiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlSXRlbVwiLCByZXdhcmQubW9kZWwsIHJld2FyZC5xdWFudGl0eSA/PyAxLCBzcmMpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJjYXNoXCI6XG4gICAgICAgICAgICBlbWl0KFwiZGFpbHlTcGluOmdpdmVDYXNoXCIsIHJld2FyZC5tb2RlbCwgc3JjKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiYmFua1wiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlQmFua1wiLCByZXdhcmQubW9kZWwsIHNyYyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIndlYXBvblwiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlV2VhcG9uXCIsIHJld2FyZC5tb2RlbCwgc3JjKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpzZWxsU2VydmVyXCIsIChpZDogbnVtYmVyKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIC8vIFNlbGxpbmcgZGlzYWJsZWQ7IHRyZWF0IHNlbGwgYXMgY29sbGVjdC9yZXdhcmRcbiAgICBlbWl0KFwiZGFpbHlTcGluOnJld2FyZFNlcnZlclwiLCBpZCwgc3JjKTtcbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpnaXZlSXRlbVwiLCAoaXRlbTogc3RyaW5nLCBxdHkgPSAxLCBzcmM/OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCB0YXJnZXRTcmMgPSBzcmMgPz8gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXRTcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLkFkZEl0ZW0oaXRlbSwgcXR5KTtcbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpnaXZlQ2FzaFwiLCAoYW1vdW50OiBudW1iZXIsIHNyYz86IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHRhcmdldFNyYyA9IHNyYyA/PyBOdW1iZXIoZ2xvYmFsLnNvdXJjZSk7XG4gICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyKHRhcmdldFNyYyk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybjtcblxuICAgIHBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoXCJjYXNoXCIsIGFtb3VudCwgXCJkYWlseS1zcGluLWNhc2hcIik7XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46Z2l2ZUJhbmtcIiwgKGFtb3VudDogbnVtYmVyLCBzcmM/OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCB0YXJnZXRTcmMgPSBzcmMgPz8gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXRTcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KFwiYmFua1wiLCBhbW91bnQsIFwiZGFpbHktc3Bpbi1iYW5rXCIpO1xufSk7XG5cbm9uTmV0KFwiZGFpbHlTcGluOmdpdmVXZWFwb25cIiwgKHdlYXBvbjogc3RyaW5nLCBzcmM/OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCB0YXJnZXRTcmMgPSBzcmMgPz8gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXRTcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLkFkZEl0ZW0od2VhcG9uLCBEYWlseVNwaW5Db25maWcuV2VhcG9uQW1vdW50KTtcbn0pO1xuXG5jb25zdCBnZW5lcmF0ZVBsYXRlID0gYXN5bmMgKCk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gICAgY29uc3QgZncgPSByZXNvbHZlRnJhbWV3b3JrKCk7XG4gICAgaWYgKCFmdz8uU2hhcmVkKSByZXR1cm4gXCJTUElOMTIzXCI7XG5cbiAgICBjb25zdCBwbGF0ZSA9IGAke2Z3LlNoYXJlZC5SYW5kb21JbnQoMSl9JHtmdy5TaGFyZWQuUmFuZG9tU3RyKDIpfSR7ZncuU2hhcmVkLlJhbmRvbUludCgzKX0ke2Z3LlNoYXJlZC5SYW5kb21TdHIoMil9YDtcblxuICAgIGNvbnN0IGV4aXN0cyA9IE15U1FMPy5zY2FsYXIgPyBhd2FpdCBNeVNRTC5zY2FsYXIoXCJTRUxFQ1QgcGxhdGUgRlJPTSBwbGF5ZXJfdmVoaWNsZXMgV0hFUkUgcGxhdGUgPSA/XCIsIFtwbGF0ZV0pIDogbnVsbDtcbiAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgIHJldHVybiBnZW5lcmF0ZVBsYXRlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBsYXRlLnRvVXBwZXJDYXNlKCk7XG59O1xuXG5vbk5ldChcImRhaWx5U3BpbjpnaXZlVmVoaWNsZVwiLCBhc3luYyAobW9kZWw6IHN0cmluZywgc3JjPzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0U3JjID0gc3JjID8/IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIodGFyZ2V0U3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgY29uc3QgcGxhdGUgPSBhd2FpdCBnZW5lcmF0ZVBsYXRlKCk7XG5cbiAgICBhd2FpdCBNeVNRTD8uaW5zZXJ0Py4oXG4gICAgICAgIFwiSU5TRVJUIElOVE8gcGxheWVyX3ZlaGljbGVzIChsaWNlbnNlLCBjaXRpemVuaWQsIHZlaGljbGUsIGhhc2gsIG1vZHMsIHBsYXRlLCBnYXJhZ2UsIHN0YXRlKSBWQUxVRVMgKD8sID8sID8sID8sID8sID8sID8sID8pXCIsXG4gICAgICAgIFtcbiAgICAgICAgICAgIHBsYXllci5QbGF5ZXJEYXRhLmxpY2Vuc2UsXG4gICAgICAgICAgICBwbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICBtb2RlbCxcbiAgICAgICAgICAgIEdldEhhc2hLZXkobW9kZWwpLFxuICAgICAgICAgICAgXCJ7fVwiLFxuICAgICAgICAgICAgcGxhdGUsXG4gICAgICAgICAgICBEYWlseVNwaW5Db25maWcuQ2FyUGFya2luZ1NwYXduLFxuICAgICAgICAgICAgMCwgLy8gc3RvcmVkXG4gICAgICAgIF1cbiAgICApO1xufSk7XG5cbmNvbnN0IGNvbW1hbmRDdHggPSByZXNvbHZlRnJhbWV3b3JrKCk/LkNvbW1hbmRzO1xuaWYgKGNvbW1hbmRDdHg/LkFkZCkge1xuICAgIGNvbW1hbmRDdHguQWRkKFxuICAgICAgICBcInJlc2V0ZGFpbHlzcGluXCIsXG4gICAgICAgIFwiUmVzZXQgYSBwbGF5ZXIncyBkYWlseSBzcGluIGNvb2xkb3duXCIsXG4gICAgICAgIFt7IG5hbWU6IFwiaWRcIiwgaGVscDogXCJQbGF5ZXIgSURcIiB9XSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICAgKHNvdXJjZTogbnVtYmVyLCBhcmdzOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gTnVtYmVyKGFyZ3NbMF0pO1xuICAgICAgICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICBlbWl0TmV0KFwiUUJDb3JlOk5vdGlmeVwiLCBzb3VyY2UsIFwiSW52YWxpZCBJRFwiLCBcImVycm9yXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyKHRhcmdldCk7XG4gICAgICAgICAgICBpZiAoIXBsYXllcikge1xuICAgICAgICAgICAgICAgIGVtaXROZXQoXCJRQkNvcmU6Tm90aWZ5XCIsIHNvdXJjZSwgXCJQbGF5ZXIgbm90IG9ubGluZVwiLCBcImVycm9yXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGxheWVyLkZ1bmN0aW9ucy5TZXRNZXRhRGF0YShcIlBob25lRGFpbHlTcGluXCIsIDApO1xuXG4gICAgICAgICAgICBlbWl0TmV0KFwiUUJDb3JlOk5vdGlmeVwiLCBzb3VyY2UsIGBEYWlseSBzcGluIHJlc2V0IGZvciBJRCAke3RhcmdldH1gLCBcInN1Y2Nlc3NcIik7XG4gICAgICAgICAgICBlbWl0TmV0KFwiUUJDb3JlOk5vdGlmeVwiLCB0YXJnZXQsIFwiWW91ciBEYWlseSBTcGluIGhhcyBiZWVuIHJlc2V0IVwiLCBcInN1Y2Nlc3NcIik7XG4gICAgICAgIH0sXG4gICAgICAgIFwiYWRtaW5cIlxuICAgICk7XG59IGVsc2Uge1xuICAgIGNvbnNvbGUud2FybihcIltzdW1taXRfcGhvbmVdIEZyYW1ld29yay5Db21tYW5kcy5BZGQgbm90IGF2YWlsYWJsZTsgcmVzZXRkYWlseXNwaW4gY29tbWFuZCBub3QgcmVnaXN0ZXJlZC5cIik7XG59XG4iLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcblxuY29uc3QgSlNPTl9DT0xVTU5TID0gbmV3IFNldChbXG4gICAgJ21lc3NhZ2VzJywgJ3Bob3RvcycsICdpbnRlcmVzdHMnLCAnaW50ZXJlc3RlZEluR2VuZGVycycsICdsaWZlc3R5bGUnLFxuICAgICdwcm9tcHRzJywgJ2ZvbGxvd2VycycsICdmb2xsb3dpbmcnLCAnbGlrZUNvdW50JywgJ3JlcGxpZXNDb3VudCcsXG4gICAgJ3JldHdlZXRDb3VudCcsICdoYXNodGFncycsICdhdHRhY2htZW50cycsICdiYWNrZ3JvdW5kJywgJ2xvY2tzY3JlZW4nLFxuICAgICdyaW5ndG9uZScsICdjb29yZHMnLCAnY2hhcmluZm8nLCAnam9iJywgJ21ldGFkYXRhJywgJ2l0ZW1zJywgJ2ludmVudG9yeScsXG4gICAgJ2dyYWRlJywgJ2RhdGEnLCAnYmxvY2tlZE51bWJlcnMnLCAnZGVsZXRlZE1lc3NhZ2VzJ1xuXSk7XG5cbmV4cG9ydCBjbGFzcyBNeVNRTEFkYXB0ZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge31cblxuICAgIGlzREJDb25uZWN0ZWQoKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBveG15c3FsIGlzIHVzdWFsbHkgcmVhZHlcbiAgICB9XG5cbiAgICAvLyBIZWxwZXIgdG8gcGFyc2UgcG90ZW50aWFsIEpTT04gZmllbGRzXG4gICAgcHJpdmF0ZSBwYXJzZVJvdyhyb3c6IGFueSkge1xuICAgICAgICBpZiAoIXJvdykgcmV0dXJuIHJvdztcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gcm93KSB7XG4gICAgICAgICAgICBpZiAoSlNPTl9DT0xVTU5TLmhhcyhrZXkpICYmIHR5cGVvZiByb3dba2V5XSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByb3dba2V5XSA9IEpTT04ucGFyc2Uocm93W2tleV0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS53YXJuKGBGYWlsZWQgdG8gcGFyc2UgSlNPTiBmb3Iga2V5ICR7a2V5fTpgLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gS2VlcCBvcmlnaW5hbCB2YWx1ZSBpZiBwYXJzZSBmYWlsc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcm93O1xuICAgIH1cblxuICAgIHByaXZhdGUgdHJhbnNsYXRlUXVlcnkocXVlcnk6IGFueSk6IHsgc3FsOiBzdHJpbmcsIHBhcmFtczogYW55W10gfSB7XG4gICAgICAgIGlmICghcXVlcnkgfHwgT2JqZWN0LmtleXMocXVlcnkpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3FsOiBcIjE9MVwiLCBwYXJhbXM6IFtdIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb25kaXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gcXVlcnkpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gcXVlcnlba2V5XTtcblxuICAgICAgICAgICAgaWYgKGtleSA9PT0gJyRvcicpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBvckNvbmRpdGlvbnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBzdWJRdWVyeSBvZiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHNxbCwgcGFyYW1zOiBzdWJQYXJhbXMgfSA9IHRoaXMudHJhbnNsYXRlUXVlcnkoc3ViUXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICBvckNvbmRpdGlvbnMucHVzaChgKCR7c3FsfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2goLi4uc3ViUGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGAoJHtvckNvbmRpdGlvbnMuam9pbignIE9SICcpfSlgKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGtleSA9PT0gJyRhbmQnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYW5kQ29uZGl0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHN1YlF1ZXJ5IG9mIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3FsLCBwYXJhbXM6IHN1YlBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShzdWJRdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgIGFuZENvbmRpdGlvbnMucHVzaChgKCR7c3FsfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2goLi4uc3ViUGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGAoJHthbmRDb25kaXRpb25zLmpvaW4oJyBBTkQgJyl9KWApO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBPcGVyYXRvcnNcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUuJG5lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPD4gP2ApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCh2YWx1ZS4kbmUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuJGd0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPiA/YCk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKHZhbHVlLiRndCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kZ3RlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPj0gP2ApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCh2YWx1ZS4kZ3RlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLiRsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgIDwgP2ApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCh2YWx1ZS4kbHQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuJGx0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgIDw9ID9gKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUuJGx0ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kaW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUuJGluLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgMT0wYCk7IC8vIEluIGVtcHR5IGFycmF5IGlzIGFsd2F5cyBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gdmFsdWUuJGluLm1hcCgoKSA9PiAnPycpLmpvaW4oJywnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgIElOICgke3BsYWNlaG9sZGVyc30pYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCguLi52YWx1ZS4kaW4pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kbmluICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZS4kbmluLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgMT0xYCk7IC8vIE5vdCBpbiBlbXB0eSBhcnJheSBpcyBhbHdheXMgdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gdmFsdWUuJG5pbi5tYXAoKCkgPT4gJz8nKS5qb2luKCcsJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCBOT1QgSU4gKCR7cGxhY2Vob2xkZXJzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKC4uLnZhbHVlLiRuaW4pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kcmVnZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCBMSUtFID9gKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2goYCUke3ZhbHVlLiRyZWdleH0lYCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgIC8vIEFzc3VtZSBkaXJlY3QgZXF1YWxpdHkgZm9yIG9iamVjdCBpZiBubyBrbm93biBvcGVyYXRvciAob3IgaGFuZGxlZCBhcyBKU09OPylcbiAgICAgICAgICAgICAgICAgICAgIC8vIE1vbmdvREIgZG9lcyBleGFjdCBtYXRjaCBvbiBvYmplY3QuIE15U1FMIGNhbid0IGVhc2lseS5cbiAgICAgICAgICAgICAgICAgICAgIC8vIEJ1dCBmb3Igbm93LCBsZXQncyB0cmVhdCBpdCBhcyBzdHJpbmcgb3IgaWdub3JlP1xuICAgICAgICAgICAgICAgICAgICAgLy8gSWYgaXQgaXMgYSBkYXRlIG9iamVjdD9cbiAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgID0gP2ApO1xuICAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPSA/YCk7XG4gICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgc3FsOiBjb25kaXRpb25zLmpvaW4oJyBBTkQgJyksIHBhcmFtcyB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgdHJhbnNsYXRlT3B0aW9ucyhvcHRpb25zOiBhbnkpOiBzdHJpbmcge1xuICAgICAgICBsZXQgc3FsID0gXCJcIjtcbiAgICAgICAgaWYgKCFvcHRpb25zKSByZXR1cm4gc3FsO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnNvcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IHNvcnRQYXJ0cyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gb3B0aW9ucy5zb3J0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlyID0gb3B0aW9ucy5zb3J0W2tleV0gPT09IDEgPyAnQVNDJyA6ICdERVNDJztcbiAgICAgICAgICAgICAgICBzb3J0UGFydHMucHVzaChgXFxgJHtrZXl9XFxgICR7ZGlyfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNvcnRQYXJ0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgc3FsICs9IGAgT1JERVIgQlkgJHtzb3J0UGFydHMuam9pbignLCAnKX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubGltaXQpIHtcbiAgICAgICAgICAgIHNxbCArPSBgIExJTUlUICR7TnVtYmVyKG9wdGlvbnMubGltaXQpfWA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5za2lwKSB7XG4gICAgICAgICAgICBzcWwgKz0gYCBPRkZTRVQgJHtOdW1iZXIob3B0aW9ucy5za2lwKX1gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNxbDtcbiAgICB9XG5cbiAgICBhc3luYyBmaW5kT25lKGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSwgcHJvamVjdGlvbj86IGFueSwgb3B0aW9ucz86IGFueSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIGNvbnN0IHNxbCA9IGBTRUxFQ1QgKiBGUk9NIFxcYCR7Y29sbGVjdGlvbn1cXGAgV0hFUkUgJHt3aGVyZUNsYXVzZX0gTElNSVQgMWA7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwuc2luZ2xlX2FzeW5jKHNxbCwgcGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlUm93KHJlc3VsdCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNeVNRTEFkYXB0ZXJdIGZpbmRPbmUgZXJyb3IgaW4gJHtjb2xsZWN0aW9ufTpgLCBlKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZmluZE1hbnkoY29sbGVjdGlvbjogc3RyaW5nLCBxdWVyeTogYW55LCBwcm9qZWN0aW9uPzogYW55LCB1bmtub3duPzogYW55LCBvcHRpb25zPzogYW55KSB7XG4gICAgICAgIGNvbnN0IHsgc3FsOiB3aGVyZUNsYXVzZSwgcGFyYW1zIH0gPSB0aGlzLnRyYW5zbGF0ZVF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgbGV0IHNxbCA9IGBTRUxFQ1QgKiBGUk9NIFxcYCR7Y29sbGVjdGlvbn1cXGAgV0hFUkUgJHt3aGVyZUNsYXVzZX1gO1xuICAgICAgICBzcWwgKz0gdGhpcy50cmFuc2xhdGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHMub3hteXNxbC5xdWVyeV9hc3luYyhzcWwsIHBhcmFtcyk7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXN1bHRzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzLm1hcChyb3cgPT4gdGhpcy5wYXJzZVJvdyhyb3cpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gZmluZE1hbnkgZXJyb3IgaW4gJHtjb2xsZWN0aW9ufTpgLCBlKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGluc2VydE9uZShjb2xsZWN0aW9uOiBzdHJpbmcsIGRvYzogYW55KSB7XG4gICAgICAgIGlmICghZG9jKSByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKCFkb2MuX2lkKSBkb2MuX2lkID0gZ2VuZXJhdGVVVWlkKCk7XG5cbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGRvYyk7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IE9iamVjdC52YWx1ZXMoZG9jKS5tYXAodiA9PiB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09ICdvYmplY3QnICYmIHYgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0ga2V5cy5tYXAoKCkgPT4gJz8nKS5qb2luKCcsJyk7XG4gICAgICAgIGNvbnN0IGNvbHVtbnMgPSBrZXlzLm1hcChrID0+IGBcXGAke2t9XFxgYCkuam9pbignLCcpO1xuICAgICAgICBjb25zdCBzcWwgPSBgSU5TRVJUIElOVE8gXFxgJHtjb2xsZWN0aW9ufVxcYCAoJHtjb2x1bW5zfSkgVkFMVUVTICgke3BsYWNlaG9sZGVyc30pYDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZ2xvYmFsLmV4cG9ydHMub3hteXNxbC5pbnNlcnRfYXN5bmMoc3FsLCB2YWx1ZXMpO1xuICAgICAgICAgICAgcmV0dXJuIGRvYzsgLy8gTW9uZ29EQiBpbnNlcnRPbmUgcmV0dXJucyByZXN1bHQsIGJ1dCBjb2RlIGV4cGVjdHMgdGhlIGRvYyBvZnRlbiBvciBjaGVja3MgdHJ1dGhpbmVzc1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gaW5zZXJ0T25lIGVycm9yIGluICR7Y29sbGVjdGlvbn06YCwgZSk7XG4gICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyB1cGRhdGVPbmUoY29sbGVjdGlvbjogc3RyaW5nLCBxdWVyeTogYW55LCB1cGRhdGU6IGFueSwgb3B0aW9ucz86IGFueSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtczogd2hlcmVQYXJhbXMgfSA9IHRoaXMudHJhbnNsYXRlUXVlcnkocXVlcnkpO1xuXG4gICAgICAgIC8vIEhhbmRsZSAkc2V0LCAkcHVzaCwgZXRjP1xuICAgICAgICAvLyBDb2RlIG1vc3RseSB1c2VzIHJlcGxhY2VtZW50IG9iamVjdCBvciBzaW1wbGUgdXBkYXRlLlxuICAgICAgICAvLyBJZiAndXBkYXRlJyBoYXMgdG9wIGxldmVsIGtleXMgdGhhdCBhcmUgbm90IG9wZXJhdG9ycywgaXQgbWlnaHQgYmUgYSByZXBsYWNlbWVudD9cbiAgICAgICAgLy8gTW9uZ29EQiB1cGRhdGVPbmUoZmlsdGVyLCB1cGRhdGUsIG9wdGlvbnMpXG4gICAgICAgIC8vIElmIHVwZGF0ZSBjb250YWlucyBhdG9taWMgb3BlcmF0b3JzICgkc2V0KSwgaXQgdXBkYXRlcyBmaWVsZHMuXG4gICAgICAgIC8vIElmIGl0IGRvZXNuJ3QsIGl0IFJFUExBQ0VTIHRoZSBkb2N1bWVudCAoaW4gc29tZSBkcml2ZXIgdmVyc2lvbnMpIGJ1dCB1c3VhbGx5IHVwZGF0ZU9uZSByZXF1aXJlcyAkc2V0IGluIG1vZGVybiBtb25nbz9cbiAgICAgICAgLy8gQ2hlY2tpbmcgdGhlIGNvZGU6IGBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogY29udGFjdERhdGEuX2lkIH0sIHsgLi4uY29udGFjdERhdGEgfSk7YFxuICAgICAgICAvLyBUaGlzIGxvb2tzIGxpa2UgYSByZXBsYWNlbWVudCBvciBtZXJnZS5cbiAgICAgICAgLy8gYGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSwgZGF0YVgpO2BcbiAgICAgICAgLy8gYGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSwgeyBqb2JDYWxsczogIVBsYXllckRhdGEuam9iQ2FsbHMgfSk7YCAtPiBUaGlzIGxvb2tzIGxpa2UgYSBwYXJ0aWFsIHVwZGF0ZSAobWVyZ2UpLlxuICAgICAgICAvLyBTaW5jZSBJJ20gdXNpbmcgU1FMLCBgVVBEQVRFIHRhYmxlIFNFVCAuLi5gIGlzIHBhcnRpYWwgdXBkYXRlIGJ5IGRlZmF1bHQuXG5cbiAgICAgICAgLy8gQnV0IHdoYXQgaWYgdGhleSB1c2UgYCRzZXRgP1xuICAgICAgICBsZXQgdXBkYXRlRGF0YSA9IHVwZGF0ZTtcbiAgICAgICAgaWYgKHVwZGF0ZS4kc2V0KSB7XG4gICAgICAgICAgICB1cGRhdGVEYXRhID0geyAuLi51cGRhdGVEYXRhLCAuLi51cGRhdGUuJHNldCB9O1xuICAgICAgICAgICAgZGVsZXRlIHVwZGF0ZURhdGEuJHNldDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdoYXQgaWYgdGhleSB1c2UgYCRwdXNoYD9cbiAgICAgICAgLy8gYHR3ZWV0Lmxpa2VDb3VudC5wdXNoKGVtYWlsKTsgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoLi4uLCB0d2VldCk7YFxuICAgICAgICAvLyBUaGUgY29kZSB1c3VhbGx5IG1vZGlmaWVzIHRoZSBvYmplY3QgaW4gbWVtb3J5IGFuZCB0aGVuIHNhdmVzIHRoZSB3aG9sZSBvYmplY3QgYmFjayFcbiAgICAgICAgLy8gRXhhbXBsZSBpbiBQaWdlb25TZXJ2aWNlOiBgdHdlZXQubGlrZUNvdW50LnB1c2goZW1haWwpOyBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO2BcbiAgICAgICAgLy8gU28gdGhleSBhcmUgc2VuZGluZyB0aGUgRlVMTCBPQkpFQ1QgYXMgYHVwZGF0ZWAuXG4gICAgICAgIC8vIFNvIEkgY2FuIGp1c3QgdXBkYXRlIGFsbCBmaWVsZHMgcHJlc2VudCBpbiBgdXBkYXRlYC5cblxuICAgICAgICBjb25zdCBzZXRDbGF1c2VzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBzZXRQYXJhbXM6IGFueVtdID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdXBkYXRlRGF0YSkge1xuICAgICAgICAgICAgaWYgKGtleSA9PT0gJ19pZCcpIGNvbnRpbnVlOyAvLyBEb24ndCB1cGRhdGUgUEsgdXN1YWxseVxuICAgICAgICAgICAgc2V0Q2xhdXNlcy5wdXNoKGBcXGAke2tleX1cXGAgPSA/YCk7XG4gICAgICAgICAgICBsZXQgdmFsID0gdXBkYXRlRGF0YVtrZXldO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdvYmplY3QnICYmIHZhbCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHZhbCA9IEpTT04uc3RyaW5naWZ5KHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXRQYXJhbXMucHVzaCh2YWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNldENsYXVzZXMubGVuZ3RoID09PSAwKSByZXR1cm4gdHJ1ZTtcblxuICAgICAgICBjb25zdCBzcWwgPSBgVVBEQVRFIFxcYCR7Y29sbGVjdGlvbn1cXGAgU0VUICR7c2V0Q2xhdXNlcy5qb2luKCcsICcpfSBXSEVSRSAke3doZXJlQ2xhdXNlfWA7XG4gICAgICAgIGNvbnN0IGZpbmFsUGFyYW1zID0gWy4uLnNldFBhcmFtcywgLi4ud2hlcmVQYXJhbXNdO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBnbG9iYWwuZXhwb3J0cy5veG15c3FsLnVwZGF0ZV9hc3luYyhzcWwsIGZpbmFsUGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiB7IG1vZGlmaWVkQ291bnQ6IDEgfTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gdXBkYXRlT25lIGVycm9yIGluICR7Y29sbGVjdGlvbn06YCwgZSk7XG4gICAgICAgICAgICByZXR1cm4geyBtb2RpZmllZENvdW50OiAwIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBkZWxldGVPbmUoY29sbGVjdGlvbjogc3RyaW5nLCBxdWVyeTogYW55KSB7XG4gICAgICAgIGNvbnN0IHsgc3FsOiB3aGVyZUNsYXVzZSwgcGFyYW1zIH0gPSB0aGlzLnRyYW5zbGF0ZVF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgY29uc3Qgc3FsID0gYERFTEVURSBGUk9NIFxcYCR7Y29sbGVjdGlvbn1cXGAgV0hFUkUgJHt3aGVyZUNsYXVzZX0gTElNSVQgMWA7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwudXBkYXRlX2FzeW5jKHNxbCwgcGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiB7IGRlbGV0ZWRDb3VudDogMSB9O1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBkZWxldGVPbmUgZXJyb3IgaW4gJHtjb2xsZWN0aW9ufTpgLCBlKTtcbiAgICAgICAgICAgIHJldHVybiB7IGRlbGV0ZWRDb3VudDogMCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZmluZEFuZFJldHVyblNwZWNpZmljRmllbGRzKGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSwgZmllbGRzOiBzdHJpbmdbXSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIGNvbnN0IGNvbHVtbnMgPSBmaWVsZHMubWFwKGYgPT4gYFxcYCR7Zn1cXGBgKS5qb2luKCcsICcpO1xuICAgICAgICBjb25zdCBzcWwgPSBgU0VMRUNUICR7Y29sdW1uc30gRlJPTSBcXGAke2NvbGxlY3Rpb259XFxgIFdIRVJFICR7d2hlcmVDbGF1c2V9IExJTUlUIDFgO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0cy5veG15c3FsLnNpbmdsZV9hc3luYyhzcWwsIHBhcmFtcyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZVJvdyhyZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gZmluZEFuZFJldHVyblNwZWNpZmljRmllbGRzIGVycm9yIGluICR7Y29sbGVjdGlvbn06YCwgZSk7XG4gICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDdXN0b20gaGFuZGxpbmcgZm9yIGFnZ3JlZ2F0aW9uIChzcGVjaWZpY2FsbHkgZm9yIFBpZ2VvbiBjb252ZXJzYXRpb25zKVxuICAgIGFzeW5jIGFnZ3JlZ2F0ZShjb2xsZWN0aW9uOiBzdHJpbmcsIHBpcGVsaW5lOiBhbnlbXSkge1xuICAgICAgICBpZiAoY29sbGVjdGlvbiA9PT0gJ3Bob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzJykge1xuICAgICAgICAgICAgLy8gVGhpcyBpcyBsaWtlbHkgdGhlIGdldENvbnZlcnNhdGlvbnMgY2FsbFxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBmZXRjaCBhbGwgbWVzc2FnZXMgZm9yIHRoZSB1c2VyLCBncm91cCBieSBjb252ZXJzYXRpb24gcGFydG5lciwgZmluZCBsYXRlc3QuXG5cbiAgICAgICAgICAgIC8vIEV4dHJhY3QgdXNlckVtYWlsIGZyb20gdGhlIGZpcnN0ICRtYXRjaCBzdGFnZVxuICAgICAgICAgICAgY29uc3QgbWF0Y2hTdGFnZSA9IHBpcGVsaW5lLmZpbmQocyA9PiBzLiRtYXRjaCk7XG4gICAgICAgICAgICBsZXQgdXNlckVtYWlsID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChtYXRjaFN0YWdlKSB7XG4gICAgICAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBlbWFpbC4gSXQncyB1c3VhbGx5IGluICRvcjogW3tzZW5kZXJFbWFpbDogWH0sIHtyZWNpcGllbnRFbWFpbDogWH1dXG4gICAgICAgICAgICAgICAgIGNvbnN0IG9yID0gbWF0Y2hTdGFnZS4kbWF0Y2guJG9yO1xuICAgICAgICAgICAgICAgICBpZiAob3IgJiYgb3JbMF0gJiYgb3JbMF0uc2VuZGVyRW1haWwpIHVzZXJFbWFpbCA9IG9yWzBdLnNlbmRlckVtYWlsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXVzZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbTXlTUUxBZGFwdGVyXSBBZ2dyZWdhdGU6IENvdWxkIG5vdCBpZGVudGlmeSB1c2VyRW1haWwgZnJvbSBwaXBlbGluZVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNRTCBTdHJhdGVneTpcbiAgICAgICAgICAgIC8vIDEuIEdldCBhbGwgbWVzc2FnZXMgd2hlcmUgc2VuZGVyIG9yIHJlY2lwaWVudCBpcyB1c2VyRW1haWxcbiAgICAgICAgICAgIC8vIDIuIFNvcnQgYnkgZGF0ZSBERVNDXG4gICAgICAgICAgICAvLyAzLiBQcm9jZXNzIGluIEpTIHRvIEdyb3VwXG5cbiAgICAgICAgICAgIGNvbnN0IHNxbCA9IGBTRUxFQ1QgKiBGUk9NIFxcYHBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXFxgIFdIRVJFIFxcYHNlbmRlckVtYWlsXFxgID0gPyBPUiBcXGByZWNpcGllbnRFbWFpbFxcYCA9ID8gT1JERVIgQlkgXFxgY3JlYXRlZEF0XFxgIERFU0NgO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlcyA9IGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwucXVlcnlfYXN5bmMoc3FsLCBbdXNlckVtYWlsLCB1c2VyRW1haWxdKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbnMgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG1zZyBvZiBtZXNzYWdlcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvdGhlckVtYWlsID0gbXNnLnNlbmRlckVtYWlsID09PSB1c2VyRW1haWwgPyBtc2cucmVjaXBpZW50RW1haWwgOiBtc2cuc2VuZGVyRW1haWw7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY29udmVyc2F0aW9ucy5oYXMob3RoZXJFbWFpbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnZlcnNhdGlvbnMuc2V0KG90aGVyRW1haWwsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogdGhpcy5wYXJzZVJvdyhtc2cpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVucmVhZENvdW50OiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG90aGVyRW1haWw6IG90aGVyRW1haWxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udiA9IGNvbnZlcnNhdGlvbnMuZ2V0KG90aGVyRW1haWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobXNnLnJlY2lwaWVudEVtYWlsID09PSB1c2VyRW1haWwgJiYgbXNnLnJlYWQgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnYudW5yZWFkQ291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE5vdyB3ZSBuZWVkIHRvIGZldGNoIHVzZXIgaW5mbyBmb3IgZWFjaCBjb252ZXJzYXRpb25cbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNvbnYgb2YgY29udmVyc2F0aW9ucy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgdGhpcy5maW5kT25lKCdwaG9uZV9waWdlb25fdXNlcnMnLCB7IGVtYWlsOiBjb252Lm90aGVyRW1haWwgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG90aGVyVXNlcjogdXNlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlOiBjb252Lmxhc3RNZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IGNvbnYudW5yZWFkQ291bnRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBBZ2dyZWdhdGUgZXJyb3I6YCwgZSk7XG4gICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUud2FybihgW015U1FMQWRhcHRlcl0gVW5oYW5kbGVkIGFnZ3JlZ2F0aW9uIGZvciBjb2xsZWN0aW9uICR7Y29sbGVjdGlvbn1gKTtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbn1cbiIsICJpbXBvcnQgXCIuL3N2X2V4cG9ydHNcIjtcbmltcG9ydCBcIi4vYXBwcy9pbmRleFwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiLi9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL2FwcHMvU2V0dGluZ3MvY2xhc3NcIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgSW52b2ljZVJlY3VycmluZ1BheW1lbnRzIH0gZnJvbSBcIi4vYXBwcy9XYWxsZXQvY2FsbGJhY2tzXCI7XG5pbXBvcnQgeyBwaWdlb25TZXJ2aWNlIH0gZnJvbSBcIi4vYXBwcy9QaWdlb24vUGlnZW9uU2VydmljZVwiO1xuaW1wb3J0IHsgTXlTUUxBZGFwdGVyIH0gZnJvbSBcIi4vY2xhc3Nlcy9NeVNRTEFkYXB0ZXJcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5jb25zdCByZXNvbHZlRnJhbWV3b3JrID0gKCkgPT4ge1xuICAgIGNvbnN0IGNvbmZpZ3VyZWQgPSBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV07XG4gICAgaWYgKHR5cGVvZiBjb25maWd1cmVkPy5HZXRDb3JlT2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBjb25maWd1cmVkLkdldENvcmVPYmplY3QoKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBmYWxsIHRocm91Z2ggdG8gcmV0dXJuIGNvbmZpZ3VyZWQgZGlyZWN0bHlcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29uZmlndXJlZCkgcmV0dXJuIGNvbmZpZ3VyZWQ7XG5cbiAgICBjb25zdCBxYiA9IGV4cG9ydHNbJ3FiLWNvcmUnXT8uR2V0Q29yZU9iamVjdD8uKCk7XG4gICAgaWYgKHFiKSByZXR1cm4gcWI7XG4gICAgaWYgKGV4cG9ydHNbJ3FiLWNvcmUnXSkgcmV0dXJuIGV4cG9ydHNbJ3FiLWNvcmUnXTtcblxuICAgIGNvbnN0IHFieCA9IGV4cG9ydHNbJ3FieC1jb3JlJ10gPz8gZXhwb3J0c1sncWJ4X2NvcmUnXTtcbiAgICBpZiAodHlwZW9mIHFieD8uR2V0Q29yZU9iamVjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gcWJ4LkdldENvcmVPYmplY3QoKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBmYWxsIHRocm91Z2ggdG8gcmV0dXJuIHFieCBkaXJlY3RseVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBxYng7XG59O1xuXG5leHBvcnQgbGV0IEZyYW1ld29yayA9IHJlc29sdmVGcmFtZXdvcmsoKTtcblxuZXhwb3J0IGNvbnN0IE1vbmdvREIgPSBuZXcgTXlTUUxBZGFwdGVyKCk7XG5cbmV4cG9ydCBjb25zdCBNeVNRTCA9IGV4cG9ydHMub3hteXNxbDtcbmV4cG9ydCBjb25zdCBMb2dnZXIgPSBleHBvcnRzWydxYi1zbWFsbHJlc291cmNlcyddO1xuXG50eXBlIEV4dGVybmFsTWFpbERhdGEgPSB7XG4gICAgZW1haWw/OiBzdHJpbmc7XG4gICAgc3ViamVjdD86IHN0cmluZztcbiAgICBtZXNzYWdlPzogc3RyaW5nO1xuICAgIGltYWdlcz86IHN0cmluZ1tdO1xufTtcblxub24oJ1FCQ29yZTpTZXJ2ZXI6VXBkYXRlT2JqZWN0JywgKCkgPT4ge1xuICAgIEZyYW1ld29yayA9IHJlc29sdmVGcmFtZXdvcmsoKTtcbn0pO1xuXG5zZXRJbW1lZGlhdGUoKCkgPT4ge1xuICAgIFV0aWxzLmxvYWQoKTtcbiAgICBTZXR0aW5ncy5sb2FkKCk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6c2VydmVyOnNoYXJlTnVtYmVyJywgYXN5bmMgKHNvdXJjZTogYW55LCBjb21pbmdTb3VyY2U6IGFueSkgPT4ge1xuICAgIGNvbnN0IHNvdXJjZVggPSBzb3VyY2U7XG4gICAgY29uc3Qgc291cmNlTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2VYKTtcbiAgICBjb25zdCBhY051bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY29taW5nU291cmNlKTtcbiAgICBjb25zdCBmdWxsbmFtZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZVgpO1xuICAgIGNvbnN0IGJyZWFrZWROYW1lID0gZnVsbG5hbWUuc3BsaXQoJyAnKTtcblxuICAgIGlmICghc291cmNlTnVtYmVyIHx8ICFhY051bWJlcikgcmV0dXJuO1xuICAgIGNvbnN0IGNvbnRhY3REYXRhID0ge1xuICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICBwZXJzb25hbE51bWJlcjogYWNOdW1iZXIsXG4gICAgICAgIGNvbnRhY3ROdW1iZXI6IHNvdXJjZU51bWJlcixcbiAgICAgICAgZmlyc3ROYW1lOiBicmVha2VkTmFtZVswXSxcbiAgICAgICAgbGFzdE5hbWU6IGJyZWFrZWROYW1lWzFdLFxuICAgICAgICBpbWFnZTogYXdhaXQgVXRpbHMuR2V0Q29udGFjdEF2YXRhckJ5TnVtYmVyKHNvdXJjZU51bWJlciwgYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihzb3VyY2VOdW1iZXIpKSxcbiAgICAgICAgb3duZXJJZDogYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihhY051bWJlciksXG4gICAgICAgIG5vdGVzOiBcIlwiLFxuICAgICAgICBlbWFpbDogXCJcIixcbiAgICAgICAgaXNGYXY6IGZhbHNlXG4gICAgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IHBlcnNvbmFsTnVtYmVyOiBhY051bWJlciwgY29udGFjdE51bWJlcjogc291cmNlTnVtYmVyIH0pO1xuICAgIGlmIChyZXMpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlWCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYE51bWJlciBBbHJlYWR5IFNoYXJlZC5gLFxuICAgICAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgTnVtYmVyKHNvdXJjZVgpLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiUGhvbmVcIixcbiAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBzaGFyZWQgeW91ciBQaG9uZSBOdW1iZXIuYCxcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgfSkpO1xuICAgIGNvbnN0IHNlbmRJZCA9IGdlbmVyYXRlVVVpZCgpO1xuICAgIGVtaXROZXQoJ3Bob25lOmFkZEFjdGlvbk5vdGlmaWNhdGlvbicsIE51bWJlcihjb21pbmdTb3VyY2UpLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBzZW5kSWQsXG4gICAgICAgIHRpdGxlOiBcIlBob25lXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgJHtmdWxsbmFtZX0gd2FudHMgdG8gc2hhcmUgdGhlaXIgbnVtYmVyIHdpdGggeW91LmAsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICBpY29uczoge1xuICAgICAgICAgICAgXCIwXCI6IHtcbiAgICAgICAgICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2Nyb3NzLWNpcmNsZS5zdmdcIixcbiAgICAgICAgICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWRkQ29udGFjdFwiLFxuICAgICAgICAgICAgICAgIGFyZ3M6IHt9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgXCIxXCI6IHtcbiAgICAgICAgICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2FjY2VwdC5zdmdcIixcbiAgICAgICAgICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWRkQ29udGFjdFwiLFxuICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgY29udGFjdERhdGEsXG4gICAgICAgICAgICAgICAgICAgIGNvbWluZ1NvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgZnVsbG5hbWUsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSkpO1xuXG59KTtcblxub25OZXQoJ3Bob25lOnNlcnZlcjphZGRDb250YWN0JywgYXN5bmMgKGlkOiBzdHJpbmcsIGRhdGE6IHtcbiAgICBjb21pbmdTb3VyY2U6IGFueSxcbiAgICBmdWxsbmFtZTogc3RyaW5nLFxuICAgIGNvbnRhY3REYXRhOiBhbnksXG4gICAgaWQ6IHN0cmluZ1xufSkgPT4ge1xuICAgIGNvbnN0IHNyYyA9IGdsb2JhbC5zb3VyY2U7XG4gICAgLyogY29uc29sZS5sb2coJ0FkZGluZyBjb250YWN0JywgaWQsIGRhdGEpOyAqL1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHNyYywgaWQpO1xuICAgIGlmICghZGF0YS5jb250YWN0RGF0YSB8fCAhZGF0YS5jb21pbmdTb3VyY2UgfHwgIWRhdGEuZnVsbG5hbWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhd2FpdCBEZWxheSg1MDApO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc3JjLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgTnVtYmVyIFNhdmVkLmAsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgIH0pKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfY29udGFjdHMnLCBkYXRhLmNvbnRhY3REYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgdGl0bGU6ICdDb250YWN0IFNoYXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke2RhdGEuZnVsbG5hbWV9ICwgJHtkYXRhLmNvbnRhY3REYXRhLmNvbnRhY3ROdW1iZXJ9IGhhcyBzaGFyZWQgdGhlaXIgbnVtYmVyIHdpdGggJHtkYXRhLmNvbnRhY3REYXRhLnBlcnNvbmFsTnVtYmVyfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbignc3VtbWl0X3Bob25lOnNlcnZlcjpDcm9uVHJpZ2dlcicsIGFzeW5jICgpID0+IHtcbiAgICAvKiBjb25zb2xlLmxvZygnQ3JvbiBUcmlnZ2VyZWQnKTsgKi9cbiAgICBJbnZvaWNlUmVjdXJyaW5nUGF5bWVudHMoKTtcbn0pO1xuXG5SZWdpc3RlckNvbW1hbmQoJ3Jlc2V0UGhvbmVQYXNzY29kZScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybjtcbiAgICBTZXR0aW5ncy5sb2NrUGluLnNldChjaXRpemVuSWQsICcwMDAwMDAnKTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBTZXR0aW5ncy5TYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBlbWl0TmV0KCdwaG9uZTpjbGllbnQ6c2V0dXBQaG9uZScsIHNvdXJjZSwgY2l0aXplbklkKTtcbn0sIGZhbHNlKTtcblxuUmVnaXN0ZXJDb21tYW5kKCd2ZXJpZnlQZWdpb24nLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGFyZ3M6IHN0cmluZ1tdKSA9PiB7XG4gICAgaWYgKCFhcmdzWzBdKSB7XG4gICAgICAgIHJldHVybiBMT0dHRVIoJ1BsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWwgYWRkcmVzcy4nKTtcbiAgICB9XG4gICAgY29uc3QgZW1haWwgPSBhcmdzWzBdO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHBpZ2VvblNlcnZpY2UudmVyaWZ5VXNlcihzb3VyY2UsIGVtYWlsKTtcbiAgICBpZiAocmVzID09PSBcInN1Y2Nlc3NcIikge1xuICAgICAgICByZXR1cm4gTE9HR0VSKGBVc2VyICR7ZW1haWx9IGhhcyBiZWVuIHZlcmlmaWVkIHN1Y2Nlc3NmdWxseS5gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gTE9HR0VSKGBGYWlsZWQgdG8gdmVyaWZ5IHVzZXIgJHtlbWFpbH0uIFJlYXNvbjogJHtyZXN9YCk7XG4gICAgfVxufSwgdHJ1ZSk7XG5cbm9uKCdRQkNvcmU6U2VydmVyOk9uUGxheWVyVW5sb2FkJywgYXN5bmMgKHNyYzogbnVtYmVyKSA9PiB7XG4gICAgaWYoIXNyYykgcmV0dXJuO1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzcmMpO1xuICAgIGlmICghY2l0aXplbklkKSByZXR1cm47XG4gICAgYXdhaXQgU2V0dGluZ3MuU2F2ZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZCk7XG4gICAgU2V0dGluZ3Mub25QbGF5ZXJEaXNjb25uZWN0KGNpdGl6ZW5JZCk7XG59KTtcblxub24oJ3BsYXllckRyb3BwZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBpZighc3JjKSByZXR1cm47XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNyYyk7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybjtcbiAgICBhd2FpdCBTZXR0aW5ncy5TYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBTZXR0aW5ncy5vblBsYXllckRpc2Nvbm5lY3QoY2l0aXplbklkKTtcbn0pXG5cbm9uTmV0KCdpZ25pc19waG9uZTpzZW5kTmV3TWFpbCcsIGFzeW5jICh0YXJnZXRTb3VyY2U6IG51bWJlciwgbWFpbERhdGE6IEV4dGVybmFsTWFpbERhdGEpID0+IHtcbiAgICBjb25zdCBzcmMgPSBOdW1iZXIodGFyZ2V0U291cmNlID8/IGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNyYyk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybjtcblxuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IHBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZDtcbiAgICBjb25zdCBlbWFpbEFkZHJlc3MgPSBhd2FpdCBVdGlscy5HZXRFbWFpbElkQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICBpZiAoIWVtYWlsQWRkcmVzcykgcmV0dXJuO1xuXG4gICAgYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3N1bW1pdF9waG9uZSddLlNlbmRNYWlsKHtcbiAgICAgICAgZW1haWw6IG1haWxEYXRhPy5lbWFpbCB8fCAnZ292ZXJubWVudEBzdW1taXQucnAnLFxuICAgICAgICB0bzogZW1haWxBZGRyZXNzLFxuICAgICAgICBzdWJqZWN0OiBtYWlsRGF0YT8uc3ViamVjdCB8fCAnRW1haWwgaXMgbm90IHNldHVwIGNvcnJlY3RseSEnLFxuICAgICAgICBtZXNzYWdlOiBtYWlsRGF0YT8ubWVzc2FnZSB8fCAnRW1haWwgaXMgbm90IHNldHVwIGNvcnJlY3RseSEnLFxuICAgICAgICBpbWFnZXM6IG1haWxEYXRhPy5pbWFnZXMgfHwgW10sXG4gICAgICAgIHNvdXJjZTogc3JjXG4gICAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7O0FBQU8sU0FBUyxNQUFNLElBQVk7QUFDOUIsU0FBTyxJQUFJLFFBQVEsU0FBTyxXQUFXLEtBQUssRUFBRSxDQUFDO0FBQ2pEO0FBRmdCO0FBUVQsSUFBTSxlQUFlLDZCQUFNO0FBQzlCLFNBQU8sdUNBQXVDLFFBQVEsU0FBUyxTQUFVLEdBQUc7QUFDeEUsUUFBSSxJQUFJLEtBQUssT0FBTyxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssTUFBTSxJQUFJLElBQUksSUFBTTtBQUM3RCxXQUFPLEVBQUUsU0FBUyxFQUFFO0FBQUEsRUFDeEIsQ0FBQztBQUNMLEdBTDRCO0FBT3JCLElBQU0sU0FBUyx3QkFBQyxZQUFvQjtBQUN2QyxTQUFPLFFBQVEsSUFBSSx3REFBd0QsT0FBTyxTQUFTO0FBQy9GLEdBRnNCO0FBS2YsSUFBTSxxQkFBb0M7QUFFMUMsSUFBTSxxQkFBb0M7OztBQ2xCakQsSUFBTSxRQUFOLE1BQU0sTUFBSztBQUFBLEVBQ0E7QUFBQSxFQUNQLGNBQWM7QUFDVixTQUFLLGVBQWUsQ0FBQztBQUFBLEVBQ3pCO0FBQUEsRUFFQSxNQUFNLE9BQU87QUFDVCxvQkFBZ0IsbUJBQW1CLE9BQU9BLFNBQWEsU0FBYztBQUNqRSxVQUFJQSxZQUFXLEVBQUcsUUFBTyxPQUFPLDRDQUE0QztBQUM1RSxZQUFNLE1BQU0sZ0JBQWdCO0FBQUEsSUFDaEMsR0FB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QUFTO0FBQUEsSUFDMUMsUUFBTyxxQ0FBVSxVQUFTO0FBQUEsSUFDMUIsSUFBSTtBQUFBLElBQ0osVUFBUyxxQ0FBVSxZQUFXO0FBQUEsSUFDOUIsVUFBUyxxQ0FBVSxZQUFXO0FBQUEsSUFDOUIsU0FBUSxxQ0FBVSxXQUFVLENBQUM7QUFBQSxJQUM3QixRQUFRO0FBQUEsRUFDWixDQUFDO0FBQ0wsQ0FBQzsiLAogICJuYW1lcyI6IFsic291cmNlIiwgIl9hIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiX2EiLCAicmVzIiwgInNvdXJjZSIsICJfYSIsICJzb3VyY2UiLCAiX2EiLCAic291cmNlIiwgIl9hIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiZGF0YSIsICJzb3VyY2UiLCAic291cmNlIiwgInJldHdlZXQiLCAic291cmNlIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiX2EiLCAiaXNSZWN1cnJpbmciLCAic291cmNlIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiX2EiLCAic291cmNlIiwgInJlc29sdmVGcmFtZXdvcmsiLCAiX2EiLCAic291cmNlIl0KfQo=
