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
        console.log(`Processing contact ${index + 1} of ${result.length}`);
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
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
            const jobLabel = ((_d = (_c = (_b = (_a = Framework) == null ? void 0 : _a.Shared) == null ? void 0 : _b.Jobs) == null ? void 0 : _c[jobName]) == null ? void 0 : _d.label) ?? jobName;
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
    const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
    return await exports["qb-core"].GetPlayerByCitizenId(citizenId);
  }
  async GetPhoneNumberBySource(source2) {
    const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
    const source2 = await exports["qb-core"].GetPlayerByCitizenId(citizenId);
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
    try {
      for (const phoneItem of phoneList) {
        const has = await exports["lj-inventory"].HasItem(playerSource, phoneItem);
        if (has) return true;
      }
    } catch (e) {
      console.error("HasPhone check failed:", e);
    }
    return false;
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
    return await exports["qb-core"].GetPlayerByCitizenId(citizenId);
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
      const player = await exports["qb-core"].GetPlayer(source2);
      if (!player) return false;
      const metadata = player.PlayerData.metadata;
      return metadata && metadata.injail && metadata.injail > 0;
    } catch (error) {
      return false;
    }
  }
  async getJobs(citizenId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
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
        jobLabel: e.jobLabel ?? ((_d = (_c = (_b = (_a = Framework) == null ? void 0 : _a.Shared) == null ? void 0 : _b.Jobs) == null ? void 0 : _c[e.jobName]) == null ? void 0 : _d.label) ?? e.jobName,
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
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  var _a, _b;
  const { name, email } = JSON.parse(data);
  const res2 = await MongoDB.findMany("phone_darkchat_channels", {});
  if (res2.find((channel) => channel.name === name) && !((_a = res2.find((channel) => channel.name === name)) == null ? void 0 : _a.members.includes(email))) {
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
  const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
  const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
  var _a, _b;
  const { type, phoneNumber, groupId, messageData } = JSON.parse(data);
  const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
      const isBlocked = (_a = targetMessages == null ? void 0 : targetMessages.blockedNumbers) == null ? void 0 : _a.includes(senderPhoneNumber);
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
        console.log(`Sender ${senderPhoneNumber} is blocked by ${phoneNumber}. Message saved only for sender.`);
      }
    } else {
      console.log(`Recipient with phone number ${phoneNumber} does not exist. Message saved only for sender.`);
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
          console.log(`Sender ${senderPhoneNumber} is blocked by group member ${memberPhoneNumber}.`);
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
  const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  var _a;
  const { phoneNumber } = JSON.parse(data);
  const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
    emitNet("phone:addNotification", client, JSON.stringify({
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
    emitNet("phone:addNotification", client, JSON.stringify({
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
  if (userMessages.messages.length === 0 && userMessages.blockedNumbers.length === 0 && !((_a = userMessages.deletedMessages) == null ? void 0 : _a.length)) {
    await MongoDB.deleteOne("phone_messages", { _id: userMessages._id });
  } else {
    await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages);
  }
  return JSON.stringify({ success: true });
});
onClientCallback("phone_message:addMember", async (client, data) => {
  try {
    const { groupId, phoneNumber } = JSON.parse(data);
    const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
        await MongoDB.updateOne("phone_messages", { _id: memberMessages._id }, memberMessages).then(() => console.log(`Updated group data for member ${memberId}`)).catch((error) => console.error(`Failed to update group data for member ${memberId}:`, error));
      } else {
        await MongoDB.insertOne("phone_messages", memberMessages).then(() => console.log(`Created messages for new member ${memberId}`)).catch((error) => console.error(`Failed to create messages for new member ${memberId}:`, error));
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
  const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
    const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
            await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages).then(() => console.log(`Updated contact name for ${msg.phoneNumber} to ${newContactName}`)).catch((error) => console.error(`Failed to update contact name for ${msg.phoneNumber}:`, error));
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
  const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
    const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
          await MongoDB.updateOne("phone_messages", { _id: memberMessages._id }, memberMessages).then(() => console.log(`Updated group name for member ${memberId}`)).catch((error) => console.error(`Failed to update group name for member ${memberId}:`, error));
        } else {
          console.warn(`Group not found in member ${memberId}'s messages`);
        }
      } else {
        console.warn(`No messages found for member ${memberId}`);
      }
    }
    await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages).then(() => console.log(`Updated group name for sender ${senderId}`)).catch((error) => console.error(`Failed to update group name for sender ${senderId}:`, error));
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
    const senderId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
          await MongoDB.updateOne("phone_messages", { _id: memberMessages._id }, memberMessages).then(() => console.log(`Updated group avatar for member ${memberId}`)).catch((error) => console.error(`Failed to update group avatar for member ${memberId}:`, error));
        } else {
          console.warn(`Group not found in member ${memberId}'s messages`);
        }
      } else {
        console.warn(`No messages found for member ${memberId}`);
      }
    }
    await MongoDB.updateOne("phone_messages", { _id: userMessages._id }, userMessages).then(() => console.log(`Updated group avatar for sender ${senderId}`)).catch((error) => console.error(`Failed to update group avatar for sender ${senderId}:`, error));
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
    const soundId = await exports["ignis_soundhandler"].StartAttachSound(ringtoneLink, pedId, 5, GetGameTimer(), true, 0.15);
    this.ringToneManger.set(source2, soundId);
  }
  async stopRingTone(source2) {
    const soundId = this.ringToneManger.get(source2);
    if (!soundId) return;
    exports["ignis_soundhandler"].StopSound(soundId);
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
  async load() {
    try {
      let isDBConnected = exports["mongoDB"].isDBConnected();
      while (isDBConnected === false) {
        await Delay(1e3);
        isDBConnected = exports["mongoDB"].isDBConnected();
        if (isDBConnected) {
          LOGGER("[Settings] MongoDB connected.");
          break;
        }
        console.log("[Settings] Waiting for MongoDB connection...");
      }
      const res = await MongoDB.findMany("phone_settings", {});
      for (const data of res) {
        this._id.set(data._id, data._id);
        this.background.set(data._id, data.background);
        this.lockscreen.set(data._id, data.lockscreen);
        this.ringtone.set(data._id, data.ringtone);
        this.showStartupScreen.set(data._id, data.showStartupScreen);
        this.showNotifications.set(data._id, data.showNotifications);
        this.isLock.set(data._id, data.isLock);
        this.lockPin.set(data._id, data.lockPin);
        this.usePin.set(data._id, data.usePin);
        this.useFaceId.set(data._id, data.useFaceId);
        this.faceIdIdentifier.set(data._id, data.faceIdIdentifier);
        this.darkMailIdAttached.set(data._id, data.darkMailIdAttached);
        this.smrtId.set(data._id, data.smrtId);
        this.smrtPassword.set(data._id, data.smrtPassword);
        this.isFlightMode.set(data._id, data.isFlightMode);
        this.phoneNumber.set(data._id, data.phoneNumber);
        this.pigeonIdAttached.set(data._id, data.pigeonIdAttached);
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
  var _a;
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
  const sourceCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(source2);
  const targetCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(targetSource);
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
  callManager.createRingTone(targetSource, String((_a = Settings.ringtone.get(targetCitizenId)) == null ? void 0 : _a.current), volume);
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
        icon: "https://ignis-rp.com/uploads/red.svg",
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
        icon: "https://ignis-rp.com/uploads/green.svg",
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
  console.log(source2, "Calling", targetSource, targetName, _id);
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
  console.log(source2, "Declining call", callId, targetSource, callerSource, databaseTableId);
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
  var _a;
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
  const sourceCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
  callManager.createRingTone(targetSource, String((_a = Settings.ringtone.get(targetCitizenId)) == null ? void 0 : _a.current), volume);
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
        icon: "https://ignis-rp.com/uploads/red.svg",
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
        icon: "https://ignis-rp.com/uploads/green.svg",
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
  var _a;
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
  const sourceCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(source2);
  const targetCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(targetSource);
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
  callManager.createRingTone(targetSource, String((_a = Settings.ringtone.get(targetCitizenId)) == null ? void 0 : _a.current), volume);
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
        icon: "https://ignis-rp.com/uploads/red.svg",
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
        icon: "https://ignis-rp.com/uploads/green.svg",
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
  const targetCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(targetSource);
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
  const targetCitizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(targetSource);
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
  const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
    message: `Photo saved by ${await exports["qb-core"].GetPlayerName(source2)} | ${citizenId}, Link: ${data}`,
    showIdentifiers: false
  });
  return JSON.stringify(dataX);
});
onClientCallback("getPhotos", async (source2) => {
  const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
  const photos = await MongoDB.findMany("phone_photos", { citizenId });
  return JSON.stringify(photos);
});
onClientCallback("deletePhoto", async (source2, data) => {
  const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
  const res = await MongoDB.findOne("phone_photos", { _id: data });
  await MongoDB.deleteOne("phone_photos", { _id: data, citizenId });
  Logger.AddLog({
    type: "phone_photos",
    title: "Photo Deleted",
    message: `Photo deleted by ${await exports["qb-core"].GetPlayerName(source2)} | ${citizenId}, Link: ${res.link}`,
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
      message: `Attempt to register business with existing name '${businessName}' by Player: ${exports["qb-core"].GetPlayerName(client)}`,
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
    message: `New business '${businessName}' registered by Player: ${exports["qb-core"].GetPlayerName(client)}`,
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
      message: `Attempt to update non-existent business '${selectedBusiness}' by Player: ${exports["qb-core"].GetPlayerName(client)}`,
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
    message: `Business '${selectedBusiness}' updated by Player: ${exports["qb-core"].GetPlayerName(client)}`,
    showIdentifiers: false
  });
});
onClientCallback("deleteBusiness", async (client, data) => {
  const business = await MongoDB.findOne("phone_business", { businessName: data });
  if (!business) {
    Logger.AddLog({
      type: "phone_business",
      title: "Business Deletion Failed",
      message: `Attempt to delete non-existent business '${data}' by Player: ${exports["qb-core"].GetPlayerName(client)}`,
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
    message: `Business '${data}' deleted by Player: ${exports["qb-core"].GetPlayerName(client)}`,
    showIdentifiers: false
  });
});
onClientCallback("summit_phone:server:toggleJobCalls", async (client) => {
  const player = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  const player = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  const Player = await exports["qb-core"].GetPlayer(src);
  const fullname = await exports["qb-core"].GetPlayerName(src);
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
  const Player = await exports["qb-core"].GetPlayer(src);
  const fullname = await exports["qb-core"].GetPlayerName(src);
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
  const Player = await exports["qb-core"].GetPlayer(src);
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
    const isOnline = await exports["qb-core"].GetPlayerByCitizenId(data2.citizenid);
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
      const isOnline = await exports["qb-core"].GetPlayerByCitizenId(multiJob.citizenId);
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
      message: `Attempt to hire self Name: ${exports["qb-core"].GetPlayerName(client)}, in Job: ${jobname}`,
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
    const player = await exports["qb-core"].GetPlayer(client);
    if (!player.PlayerData.job.isboss) {
      Logger.AddLog({
        type: "phone_business",
        title: "Hire Failed",
        message: `Attempt to hire without being a boss Name: ${exports["qb-core"].GetPlayerName(client)}, in Job: ${jobname}, CitizenId: ${player.PlayerData.citizenid}`,
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
    const targetPlayer = await exports["qb-core"].GetPlayer(targetSource);
    targetPlayer.Functions.SetJob(jobname, 0);
    Logger.AddLog({
      type: "phone_business",
      title: "Employee Hired",
      message: `Player ${targetPlayer.PlayerData.citizenid} Name: ${targetPlayer.PlayerData.charinfo.firstname} ${targetPlayer.PlayerData.charinfo.lastname} hired by Player: ${exports["qb-core"].GetPlayerName(client)}, in Job: ${jobname}`,
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
      message: `Attempt to hire non-existent player Name: ${exports["qb-core"].GetPlayerName(client)}, in Job: ${jobname}`,
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
  exports["qb-core"].AddJob(_id, rest);
  Logger.AddLog({
    type: "phone_jobs",
    title: "Job Registered",
    message: `New job '${_id}' Name: ${jobs.jobName} registered by Player: ${exports["qb-core"].GetPlayerName(client)}`,
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
  exports["qb-core"].UpdateJob(_id, rest);
  Logger.AddLog({
    type: "phone_jobs",
    title: "Job Updated",
    message: `Job '${_id}' Name: ${jobs.jobName} updated by Player: ${exports["qb-core"].GetPlayerName(client)}`,
    showIdentifiers: false
  });
});
onClientCallback("deleteJobs", async (client, data) => {
  const job = await MongoDB.findOne("summit_jobs", { _id: data });
  if (!job) {
    Logger.AddLog({
      type: "summit_jobs",
      title: "Job Deletion Failed",
      message: `Attempt to delete non-existent job '${data}' by Player: ${exports["qb-core"].GetPlayerName(client)}`,
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
  exports["qb-core"].RemoveJob(data);
  Logger.AddLog({
    type: "phone_jobs",
    title: "Job Deleted",
    message: `Job '${data}' Name: ${job.jobName} deleted by Player: ${exports["qb-core"].GetPlayerName(client)}`,
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
  const targetData = await exports["qb-core"].GetPlayerByCitizenId(citizenId);
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
      message: `${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname} has been fired by ${await exports["qb-core"].GetPlayerName(source2)} | CitizenId: ${targetData.PlayerData.citizenid} | Job: ${targetData.PlayerData.job.name}`,
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
      message: `Offline employee ${citizenId} has been fired by ${await exports["qb-core"].GetPlayerName(source2)} | Job: ${jobData.name}`,
      showIdentifiers: false
    });
  }
});
onNet("summit_phone:server:changeRankOfPlayer", async (data) => {
  const source2 = global.source;
  const targetData = await exports["qb-core"].GetPlayerByCitizenId(data.targetCitizenid);
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
      description: `Your rank has been changed by ${await exports["qb-core"].GetPlayerName(source2)}`,
      app: "services",
      timeout: 5e3
    }));
    if (multiJob) {
      await MongoDB.updateOne("phone_multijobs", { citizenId: data.targetCitizenid, jobName: data.jobName }, { gradeLevel: data.key, gradeLabel: data.gradeName });
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Updated",
        message: `${data.targetCitizenid} has been updated to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports["qb-core"].GetPlayerName(source2)} | citizenId: ${exports["qb-core"].GetPlayerCitizenIdBySource(source2)}`,
        showIdentifiers: false
      });
    } else {
      await MongoDB.insertOne("phone_multijobs", { _id: generateUUid(), citizenId: data.targetCitizenid, jobName: data.jobName, gradeLevel: data.key, gradeLabel: data.gradeName });
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Added",
        message: `${data.targetCitizenid} has been added to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports["qb-core"].GetPlayerName(source2)} | citizenId: ${exports["qb-core"].GetPlayerCitizenIdBySource(source2)}`,
        showIdentifiers: false
      });
    }
    emitNet("summit_phone:client:refreshEmpData", source2, jobname);
    Logger.AddLog({
      type: "phone_employee_action",
      title: "Rank Changed",
      message: `${targetData.PlayerData.charinfo.firstname} ${targetData.PlayerData.charinfo.lastname} has been given a new rank by ${await exports["qb-core"].GetPlayerName(source2)} | CitizenId: ${targetData.PlayerData.citizenid} | Job: ${jobname} |  New Rank: ${data.gradeName}`,
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
        message: `${data.targetCitizenid} has been updated to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports["qb-core"].GetPlayerName(source2)} | citizenId: ${exports["qb-core"].GetPlayerCitizenIdBySource(source2)}`,
        showIdentifiers: false
      });
    } else {
      await MongoDB.insertOne("phone_multijobs", { _id: generateUUid(), citizenId: data.targetCitizenid, jobName: data.jobName, gradeLevel: data.key, gradeLabel: data.gradeName });
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Added",
        message: `${data.targetCitizenid} has been added to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports["qb-core"].GetPlayerName(source2)} | citizenId: ${exports["qb-core"].GetPlayerCitizenIdBySource(source2)}`,
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
    message: `Inactive employee ${data.citizenId} has been fired by ${await exports["qb-core"].GetPlayerName(source2)} | Job: ${data.jobName}`,
    showIdentifiers: false
  });
});
on("summit_phone:server:hireinMultiJob", async (client, jobname, gradeLevel, jobLabel, gradeLabel) => {
  console.log("Hiring in multi job:", jobname, gradeLevel, jobLabel, gradeLabel);
  const targetCid = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
        message: `${targetCid} has been updated to ${jobname} | New Rank: ${gradeLabel} by ${await exports["qb-core"].GetPlayerName(client)} | citizenId: ${exports["qb-core"].GetPlayerCitizenIdBySource(client)}`,
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
      message: `${targetCid} has been added to ${jobname} | New Rank: ${gradeLabel} by ${await exports["qb-core"].GetPlayerName(client)} | citizenId: ${exports["qb-core"].GetPlayerCitizenIdBySource(client)}`,
      showIdentifiers: false
    });
  }
});
setImmediate(async () => {
  let isDBConnected = exports["mongoDB"].isDBConnected();
  while (isDBConnected === false) {
    await Delay(1e3);
    isDBConnected = exports["mongoDB"].isDBConnected();
    if (isDBConnected) {
      LOGGER("[Settings] MongoDB connected.");
      break;
    }
  }
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
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
    message: `${citizenId} | Name: ${global.exports["qb-core"].GetPlayerName(client)} new settings, ${JSON.stringify(parsedData)}`,
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
    message: `New email account registered with email ${parsedData.email}, password "${parsedData.password}", CitizenId: ${await global.exports["qb-core"].GetPlayerCitizenIdBySource(client)}, Name: ${global.exports["qb-core"].GetPlayerName(client)}`,
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
      message: `${global.exports["qb-core"].GetPlayerCitizenIdBySource(client)} Name: ${global.exports["qb-core"].GetPlayerName(client)} logged in to email account ${parsedData.email}, password "${parsedData.password}"`,
      showIdentifiers: false
    });
    return true;
  } else {
    return false;
  }
});
onClientCallback("unLockorLockPhone", async (client, data) => {
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
  Settings.isLock.set(citizenId, data);
  return true;
});
onClientCallback("getPhonePlayerCard", async (client) => {
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
  const res = await MongoDB.findOne("phone_player_card", { _id: citizenId });
  return JSON.stringify(res);
});
onClientCallback("phone:updatePersonalCard", async (client, data) => {
  const parsedData = JSON.parse(data);
  await MongoDB.updateOne("phone_player_card", { _id: parsedData._id }, parsedData);
  Logger.AddLog({
    type: "phone_personal_card",
    title: "Personal Card Updated",
    message: `${parsedData._id} | Name: ${global.exports["qb-core"].GetPlayerName(client)} updated personal card, ${JSON.stringify(parsedData)}`,
    showIdentifiers: false
  });
  return true;
});

// game/server/apps/Settings/events.ts
RegisterCommand("saveSettings", async (source2, args) => {
  await Settings.save();
}, true);
var generatePhoneNumber = /* @__PURE__ */ __name(async () => {
  const number = Math.floor(1e9 + Math.random() * 9e9).toString();
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
    const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
    const res = await exports["qb-core"].GetPlayerByCitizenId(await Utils.GetCidFromTweetId(tweet.email));
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
      const res = await exports["qb-core"].GetPlayerByCitizenId(cid);
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
        const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
        const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
        const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
            const res = await exports["qb-core"].GetPlayerByCitizenId(replyCid);
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
        const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
        console.log(originalTweet.retweetCount);
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
    tweet.repliesCount.push(await exports["qb-core"].GetPlayerCitizenIdBySource(client));
    await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
  }
  async decreaseRepliesCount(client, data) {
    try {
      const { tweetId } = JSON.parse(data);
      const cid = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
      console.log(`Successfully decreased repliesCount for tweet ${tweetId}`);
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
        const recipientPlayer = await exports["qb-core"].GetPlayerByCitizenId(recipientCid);
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
        const senderPlayer = await exports["qb-core"].GetPlayerByCitizenId(senderCid);
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
  const player = await global.exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
      console.log(apartments);
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
    console.log(newAccess);
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
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
  const citizenId = await exports["qb-core"].GetPlayer(source2);
  const res = await MongoDB.findOne("phone_bank_user", { citizenId: citizenId.PlayerData.citizenid });
  if (res) {
    return JSON.stringify({
      ...res,
      balance: await citizenId.PlayerData.money.bank,
      casino: await citizenId.PlayerData.money.casino
    });
  } else {
    const name = await exports["qb-core"].GetPlayerName(source2);
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
  const targetPlayer = await exports["qb-core"].GetPlayerByCitizenId(res.citizenId);
  const sourcePlayer = await exports["qb-core"].GetPlayer(client);
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
  const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
  const transactions = await MongoDB.findMany("phone_bank_transactions", { from: citizenId }, null, false, {
    sort: { date: -1 }
  });
  return JSON.stringify(transactions);
});
onClientCallback("wallet:createInvoice", async (client, data) => {
  const { description, amount, paymentTime, numberOfPayments, isBusiness, receiver } = JSON.parse(data);
  const sourcePlayer = await exports["qb-core"].GetPlayer(client);
  const targetPlayer = await exports["qb-core"].GetPlayer(receiver);
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
  const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(client);
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
var getPlayerBySource = /* @__PURE__ */ __name(async (src) => exports["qb-core"].GetPlayer(src), "getPlayerBySource");
var getPlayerByCitizenId = /* @__PURE__ */ __name(async (cid) => {
  var _a, _b;
  return (_b = (_a = exports["qb-core"]).GetPlayerByCitizenId) == null ? void 0 : _b.call(_a, cid);
}, "getPlayerByCitizenId");
var debitBank = /* @__PURE__ */ __name((player, amount) => {
  var _a, _b;
  return ((_b = (_a = player == null ? void 0 : player.Functions) == null ? void 0 : _a.RemoveMoney) == null ? void 0 : _b.call(_a, "bank", amount, "invoice_payment")) ?? false;
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
  var _a, _b;
  try {
    const receiver = await getPlayerByCitizenId(receiverCitizenId);
    const jobName = (_b = (_a = receiver == null ? void 0 : receiver.PlayerData) == null ? void 0 : _a.job) == null ? void 0 : _b.name;
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
  var _a, _b;
  const payerPlayer = await getPlayerBySource(client);
  if (!payerPlayer) return false;
  const payerCid = (_a = payerPlayer.PlayerData) == null ? void 0 : _a.citizenid;
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
  var _a, _b;
  const player = await getPlayerBySource(client);
  if (!player) return false;
  const cid = (_a = player.PlayerData) == null ? void 0 : _a.citizenid;
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
  const sourcePlayer = exports["qb-core"].GetPlayer(source2);
  const jobsData = await MongoDB.findMany("phone_multijobs", { citizenId: sourcePlayer.PlayerData.citizenid });
  const currentJob = sourcePlayer.PlayerData.job.name;
  return JSON.stringify({ currentJob, jobsData });
});
onClientCallback("groups:deleteMultiJob", async (source2, data) => {
  const name = await exports["qb-core"].GetPlayerName(source2);
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
  const sourcePlayer = await exports["qb-core"].GetPlayer(source2);
  if (!sourcePlayer) return false;
  if (await exports["qb-core"].CheckJobGrade(jobName, String(grade))) {
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
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
      console.log(result);
      return { ...newProfile, _id: result };
    } catch (error) {
      console.error("Error creating HeartSync profile:", error);
      return null;
    }
  }
  async updateProfile(source2, profileData) {
    try {
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
            const swiperData = await global.exports["qb-core"].GetPlayerByCitizenId(citizenId);
            const targetData = await global.exports["qb-core"].GetPlayerByCitizenId(targetUserId);
            const swiperPlayerData = swiperData || await global.exports["qb-core"].GetOfflinePlayerByCitizenId(citizenId);
            const targetPlayerData = targetData || await global.exports["qb-core"].GetOfflinePlayerByCitizenId(targetUserId);
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
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
    const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
    console.log(data);
    const res = await MongoDB.findOne("heartsync_matches", { _id: String(data.matchId) }, void 0, false);
    const sourceCitizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
    let sourceData = await global.exports["qb-core"].GetPlayerByCitizenId(sourceCitizenId);
    let targetData = await global.exports["qb-core"].GetPlayerByCitizenId(res.user1Id === sourceCitizenId ? res.user2Id : res.user1Id);
    if (!sourceData) {
      sourceData = await global.exports["qb-core"].GetOfflinePlayerByCitizenId(sourceCitizenId);
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
      const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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

// game/server/sv_main.ts
var Framework = exports["qb-core"].GetCoreObject();
var MongoDB = exports["mongoDB"];
var MySQL = exports.oxmysql;
var Logger = exports["qb-smallresources"];
on("QBCore:Server:UpdateObject", () => {
  Framework = exports["qb-core"].GetCoreObject();
});
setImmediate(() => {
  Utils.load();
  Settings.load();
});
onClientCallback("phone:server:shareNumber", async (source2, comingSource) => {
  const sourceX = source2;
  const sourceNumber = await Utils.GetPhoneNumberBySource(sourceX);
  const acNumber = await Utils.GetPhoneNumberBySource(comingSource);
  const fullname = await exports["qb-core"].GetPlayerName(sourceX);
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
        icon: "https://ignis-rp.com/uploads/server/phone/tick.svg",
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
  console.log("Adding contact", id, data);
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
  console.log("Cron Triggered");
  InvoiceRecurringPayments();
});
RegisterCommand("resetPhonePasscode", async (source2, args) => {
  const citizenId = await global.exports["qb-core"].GetPlayerCitizenIdBySource(source2);
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
  const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(src);
  if (!citizenId) return;
  await Settings.SavePlayerSettings(citizenId);
  Settings.onPlayerDisconnect(citizenId);
});
on("playerDropped", async () => {
  const src = global.source;
  const citizenId = await exports["qb-core"].GetPlayerCitizenIdBySource(src);
  if (!citizenId) return;
  await Settings.SavePlayerSettings(citizenId);
  Settings.onPlayerDisconnect(citizenId);
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2hhcmVkL3V0aWxzLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9jbGFzc2VzL1V0aWxzLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL01haWwvY2xhc3MudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL3N2X2V4cG9ydHMudHMiLCAiLi4vc3VtbWl0X3Bob25lL25vZGVfbW9kdWxlcy8ucG5wbS9Ab3ZlcmV4dGVuZGVkK294X2xpYkAzLjI5LjAvbm9kZV9tb2R1bGVzL0BvdmVyZXh0ZW5kZWQvb3hfbGliL3NoYXJlZC9yZXNvdXJjZS9jYWNoZS9pbmRleC5qcyIsICIuLi9zdW1taXRfcGhvbmUvbm9kZV9tb2R1bGVzLy5wbnBtL0BvdmVyZXh0ZW5kZWQrb3hfbGliQDMuMjkuMC9ub2RlX21vZHVsZXMvQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyL3Jlc291cmNlL2NhbGxiYWNrL2luZGV4LmpzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL0NvbnRhY3RzL2NhbGxiYWNrLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL0RhcmtDaGF0L2NhbGxiYWNrLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL01haWwvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvTWVzc2FnZXMvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvY2FsbEhpc3RvcnlNYW5hZ2VyLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1Bob25lL0NhbGxNYW5hZ2VyLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1NldHRpbmdzL2NsYXNzLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1Bob25lL2NhbGxiYWNrLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1Bob25lL2V2ZW50cy50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9QaG90b3MvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvU2VydmljZXMvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvU2VydmljZXMvZXZlbnRzLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1NldHRpbmdzL2NhbGxiYWNrLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1NldHRpbmdzL2V2ZW50cy50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9QaWdlb24vUGlnZW9uU2VydmljZS50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9QaWdlb24vY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvSG9zdWluZy9jYWxsYmFjay50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9CbHVlUGFnZS9jYWxsYmFjay50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9HYXJhZ2UvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvV2FsbGV0L2NhbGxiYWNrcy50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9Hcm91cHMvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvSGVhcnRTeW5jL2NhbGxiYWNrcy50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvc3ZfbWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGZ1bmN0aW9uIERlbGF5KG1zOiBudW1iZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzID0+IHNldFRpbWVvdXQocmVzLCBtcykpO1xufTtcblxuZXhwb3J0IGNvbnN0IGRpc3RhbmNlQmV0d2VlbiA9IChwb3MxOiBudW1iZXJbXSwgcG9zMjogbnVtYmVyW10pID0+IHtcbiAgICByZXR1cm4gTWF0aC5oeXBvdChwb3MxWzBdIC0gcG9zMlswXSwgcG9zMVsxXSAtIHBvczJbMV0sIHBvczFbMl0gLSBwb3MyWzJdKVxufTtcblxuZXhwb3J0IGNvbnN0IGdlbmVyYXRlVVVpZCA9ICgpID0+IHtcbiAgICByZXR1cm4gXCJ4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHhcIi5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgIHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gXCJ4XCIgPyByIDogciAmIDB4MyB8IDB4ODtcbiAgICAgICAgcmV0dXJuIHYudG9TdHJpbmcoMTYpO1xuICAgIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IExPR0dFUiA9IChtZXNzYWdlOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gY29uc29sZS5sb2coYFxceDFiWzFtXFx4MWJbNDdtXFx4MWJbMzRtW1N1bW1pdF9QaG9uZV0gXFx4MWJbNG1cXHgxYlszMW0ke21lc3NhZ2V9XFx4MWJbMG1gKVxufSIsICJpbXBvcnQgeyBGcmFtZXdvcmssIE1vbmdvREIsIE15U1FMIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5jbGFzcyBVdGlsIHtcbiAgICBwdWJsaWMgY29udGFjdHNEYXRhOiBhbnk7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuY29udGFjdHNEYXRhID0gW107XG4gICAgfVxuXG4gICAgYXN5bmMgbG9hZCgpIHtcbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCd0cmFuc2Zlck51bWJlcnMnLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5UcmFuc2Zlck51bWJlcnMoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCd0cmFuc2ZlckNvbnRhY3RzJywgYXN5bmMgKHNvdXJjZTogYW55LCBhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UgPT09IDApIHJldHVybiBMT0dHRVIoJ1RoaXMgY29tbWFuZCBjYW4gb25seSBiZSBleGVjdXRlZCBpbi1nYW1lLicpO1xuICAgICAgICAgICAgYXdhaXQgVXRpbHMuVHJhbnNmZXJDb250YWN0cygpO1xuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICBSZWdpc3RlckNvbW1hbmQoJ21pZ3JhdGVNdWx0aUpvYkRhdGEnLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5NaWdyYXRlTXVsdGlKb2JEYXRhKCk7XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIFJlZ2lzdGVyQ29tbWFuZCgnbWlncmF0ZVNvY2lldHknLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5NaWdyYXRlU29jaWV0eURhdGEoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfTtcblxuICAgIGFzeW5jIFRyYW5zZmVyTnVtYmVycygpIHtcbiAgICAgICAgbGV0IG5ld051bWJlcnM6IGFueVtdID0gW107XG4gICAgICAgIGxldCBuZXdTZXR0aW5nczogYW55W10gPSBbXTtcbiAgICAgICAgbGV0IG5ld0NhcmRzOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgIE15U1FMLnF1ZXJ5KCdTRUxFQ1QgY2l0aXplbmlkLCBjaGFyaW5mbyBGUk9NIHBsYXllcnMnLCBbXSwgYXN5bmMgKHJlc3VsdDogYW55W10pID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCByb3cgb2YgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG93bmVyID0gcm93LmNpdGl6ZW5pZDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNoYXJpbmZvID0gcm93LmNoYXJpbmZvO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHBhcnNlIGlmIHN0b3JlZCBhcyBKU09OIHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNoYXJpbmZvID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFyaW5mbyA9IEpTT04ucGFyc2UoY2hhcmluZm8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJpbmZvID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBwcmVmZXIgY2hhcmluZm8ucGhvbmUsIGZhbGwgYmFjayB0byBwaG9uZV9udW1iZXJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbnVtYmVyID0gKGNoYXJpbmZvICYmIChjaGFyaW5mby5waG9uZSA/PyBjaGFyaW5mby5waG9uZV9udW1iZXIpKSB8fCBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW51bWJlcikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCBpZiBwaG9uZSBudW1iZXIgYWxyZWFkeSBleGlzdHMgZm9yIHRoaXMgb3duZXJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG93bmVyIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmcpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIG5ld051bWJlcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBudW1iZXJcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJlcGFyZSBwaG9uZV9zZXR0aW5ncyBpZiBub3QgcHJlc2VudFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ1NldHRpbmdzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBvd25lciB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFleGlzdGluZ1NldHRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdTZXR0aW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9ja3NjcmVlbjogeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByaW5ndG9uZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJpbmd0b25lczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmw6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzTG9jazogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NrUGluOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VQaW46IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VGYWNlSWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc21ydElkOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHByZXBhcmUgcGhvbmVfcGxheWVyX2NhcmQgaWYgbm90IHByZXNlbnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdDYXJkID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9wbGF5ZXJfY2FyZCcsIHsgX2lkOiBvd25lciB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFleGlzdGluZ0NhcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NhcmRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3ROYW1lOiAnU2V0dXAnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3ROYW1lOiAnQ2FyZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWFpbDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90ZXM6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF2YXRhcjogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChuZXdOdW1iZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9udW1iZXJzJywgbmV3TnVtYmVycyk7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUihgSW5zZXJ0ZWQgJHtuZXdOdW1iZXJzLmxlbmd0aH0gcGhvbmVfbnVtYmVycy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9udW1iZXJzIHRvIGluc2VydC4nKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3U2V0dGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE1hbnkoJ3Bob25lX3NldHRpbmdzJywgbmV3U2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3U2V0dGluZ3MubGVuZ3RofSBwaG9uZV9zZXR0aW5ncy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9zZXR0aW5ncyB0byBpbnNlcnQuJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG5ld0NhcmRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9wbGF5ZXJfY2FyZCcsIG5ld0NhcmRzKTtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBJbnNlcnRlZCAke25ld0NhcmRzLmxlbmd0aH0gcGhvbmVfcGxheWVyX2NhcmQgZW50cmllcy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9wbGF5ZXJfY2FyZCBlbnRyaWVzIHRvIGluc2VydC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoYFRyYW5zZmVyTnVtYmVycyBlcnJvcjogJHtlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBUcmFuc2ZlckNvbnRhY3RzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCB0aGlzLnF1ZXJ5KCdTRUxFQ1QgKiBGUk9NIHBob25lX3Bob25lX2NvbnRhY3RzJywgW10pO1xuXG4gICAgICAgICAgICBpZiAoIXJlc3VsdCB8fCByZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgTE9HR0VSKCdObyBjb250YWN0cyBmb3VuZCB0byB0cmFuc2Zlci4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtpbmRleCwgY29udGFjdF0gb2YgcmVzdWx0LmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgIGlmIChpbmRleCA+IHJlc3VsdC5sZW5ndGgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBQcm9jZXNzaW5nIGNvbnRhY3QgJHtpbmRleCArIDF9IG9mICR7cmVzdWx0Lmxlbmd0aH1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCBvd25lcklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGNvbnRhY3QucGhvbmVfbnVtYmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRhY3RzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgcGVyc29uYWxOdW1iZXI6IGNvbnRhY3QucGhvbmVfbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBjb250YWN0TnVtYmVyOiBjb250YWN0LmNvbnRhY3RfcGhvbmVfbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBmaXJzdE5hbWU6IGNvbnRhY3QuZmlyc3RuYW1lLFxuICAgICAgICAgICAgICAgICAgICBsYXN0TmFtZTogY29udGFjdC5sYXN0bmFtZSxcbiAgICAgICAgICAgICAgICAgICAgaW1hZ2U6IGNvbnRhY3QucHJvZmlsZV9pbWFnZSxcbiAgICAgICAgICAgICAgICAgICAgb3duZXJJZDogb3duZXJJZCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0TWFueSgncGhvbmVfY29udGFjdHMnLCB0aGlzLmNvbnRhY3RzRGF0YSk7XG4gICAgICAgICAgICBMT0dHRVIoJ1Bob25lIGNvbnRhY3RzIGhhdmUgYmVlbiB0cmFuc2ZlcnJlZCB0byBNb25nb0RCLicpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBMT0dHRVIoYEVycm9yIHdoaWxlIHRyYW5zZmVycmluZyBjb250YWN0czogJHtKU09OLnN0cmluZ2lmeShlLCBudWxsLCAyKX1gKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYyBNaWdyYXRlTXVsdGlKb2JEYXRhKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCB0aGlzLnF1ZXJ5KCdTRUxFQ1QgaWQsIGpvYm5hbWUsIGVtcGxveWVlcyBGUk9NIHBsYXllcl9qb2JzJywgW10pO1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQgfHwgcmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIExPR0dFUignTm8gbXVsdGlqb2JzIGZvdW5kIHRvIHRyYW5zZmVyLicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmV3RGF0YTogYW55W10gPSBbXTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCByb3cgb2YgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgam9iSWQgPSByb3cuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGpvYk5hbWUgPSByb3cuam9ibmFtZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFqb2JOYW1lKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBsZXQgZW1wbG95ZWVzID0gcm93LmVtcGxveWVlcztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlbXBsb3llZXMpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZW1wbG95ZWVzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbXBsb3llZXMgPSBKU09OLnBhcnNlKGVtcGxveWVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEZhaWxlZCB0byBwYXJzZSBlbXBsb3llZXMgSlNPTiBmb3Igam9iICR7am9iTmFtZX0gKGlkOiAke2pvYklkfSk6ICR7ZXJyfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlbXBsb3llZXMgfHwgdHlwZW9mIGVtcGxveWVlcyAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShlbXBsb3llZXMpKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIGVtcF0gb2YgT2JqZWN0LmVudHJpZXMoZW1wbG95ZWVzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2lkID0gKGVtcCAmJiAoZW1wLmNpZCB8fCBlbXAuQ0lEIHx8IGVtcC5jaXRpemVuSWQpKSB8fCBrZXk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBncmFkZUxldmVsID0gKGVtcCAmJiAoZW1wLmdyYWRlID8/IGVtcC5ncmFkZUxldmVsID8/IGVtcC5yYW5rKSkgPz8gMDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgam9iTGFiZWwgPSBGcmFtZXdvcms/LlNoYXJlZD8uSm9icz8uW2pvYk5hbWVdPy5sYWJlbCA/PyBqb2JOYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ3JhZGVMYWJlbCA9IEZyYW1ld29yaz8uU2hhcmVkPy5Kb2JzPy5bam9iTmFtZV0/LmdyYWRlcz8uW2dyYWRlTGV2ZWxdPy5uYW1lID8/ICcnO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdEYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2l0aXplbklkOiBjaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgam9iTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmFkZUxldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpvYkxhYmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyYWRlTGFiZWxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaW5uZXJFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBFcnJvciBwcm9jZXNzaW5nIHBsYXllcl9qb2JzIHJvdyBpZCAke3Jvdy5pZH06ICR7aW5uZXJFcnJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobmV3RGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCBuZXdEYXRhKTtcbiAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3RGF0YS5sZW5ndGh9IG11bHRpam9iIGVudHJpZXMgdG8gcGhvbmVfbXVsdGlqb2JzLmApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG11bHRpam9iIGVudHJpZXMgZm91bmQgdG8gaW5zZXJ0IGFmdGVyIHBhcnNpbmcuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgTE9HR0VSKGBNaWdyYXRlTXVsdGlKb2JEYXRhIGVycm9yOiAke2Vycn1gKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYyBNaWdyYXRlU29jaWV0eURhdGEoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgdGhpcy5xdWVyeSgnU0VMRUNUICogRlJPTSBhdl9zb2NpZXR5JywgW10pO1xuXG4gICAgICAgIHJlc3VsdC5mb3JFYWNoKGFzeW5jIChqb2I6IGFueSkgPT4ge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3N1bW1pdF9iYW5rJywgeyBfaWQ6IGpvYi5qb2IgfSwge1xuICAgICAgICAgICAgICAgIGJhbmtCYWxhbmNlOiBOdW1iZXIoam9iLm1vbmV5KVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSlcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBhc3luYyBHZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbnVtYmVycycsIHsgb3duZXI6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5udW1iZXI7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5zbXJ0SWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEVtYWlsSWRCeVNvdXJjZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgZW1haWwgPSBhd2FpdCB0aGlzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICByZXR1cm4gZW1haWw7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG51bWJlcjogcGhvbmVOdW1iZXIgfSk7XG4gICAgICAgIGlmICghbnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBudW1iZXIub3duZXI7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFBsYXllckZyb21QaG9uZU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIHJldHVybiBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBCbG9ja051bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkLFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMgVW5ibG9ja051bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBJc051bWJlckJsb2NrZWQocGhvbmVOdW1iZXI6IHN0cmluZywgdGFyZ2V0UGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXIpO1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIodGFyZ2V0UGhvbmVOdW1iZXIpO1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCB8fCAhdGFyZ2V0Q2l0aXplbklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgICAgICByZXR1cm4gYmxvY2tlZCA/IHRydWUgOiBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q29udGFjdE5hbWVCeU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGhvbmVOdW1iZXIsIG93bmVySWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFjb250YWN0KSByZXR1cm4gcGhvbmVOdW1iZXI7XG4gICAgICAgIHJldHVybiBgJHtjb250YWN0LmZpcnN0TmFtZX0gJHtjb250YWN0Lmxhc3ROYW1lfWA7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENvbnRhY3RBdmF0YXJCeU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGhvbmVOdW1iZXIsIG93bmVySWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFjb250YWN0KSByZXR1cm4gJyc7XG4gICAgICAgIHJldHVybiBjb250YWN0LmltYWdlO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRTb3VyY2VGcm9tQ2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICBpZiAoIXNvdXJjZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gc291cmNlLlBsYXllckRhdGEuc291cmNlO1xuICAgIH1cblxuICAgIGFzeW5jIEhhc1Bob25lKHBsYXllclNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHBob25lTGlzdDogc3RyaW5nW10gPSBbXG4gICAgICAgICAgICAnYmx1ZV9waG9uZScsXG4gICAgICAgICAgICAnZ3JlZW5fcGhvbmUnLFxuICAgICAgICAgICAgJ3JlZF9waG9uZScsXG4gICAgICAgICAgICAnZ29sZF9waG9uZScsXG4gICAgICAgICAgICAncHVycGxlX3Bob25lJyxcbiAgICAgICAgXTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBwaG9uZUl0ZW0gb2YgcGhvbmVMaXN0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGFzID0gYXdhaXQgZXhwb3J0c1snbGotaW52ZW50b3J5J10uSGFzSXRlbShwbGF5ZXJTb3VyY2UsIHBob25lSXRlbSk7XG4gICAgICAgICAgICAgICAgaWYgKGhhcykgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0hhc1Bob25lIGNoZWNrIGZhaWxlZDonLCBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgSW5GbGlnaHRNb2RlKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghc2V0dGluZ3MpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHNldHRpbmdzLmlzRmxpZ2h0TW9kZSB8fCBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgcXVlcnkocXVlcnk6IHN0cmluZywgdmFsdWVzOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIE15U1FMLnF1ZXJ5KHF1ZXJ5LCB2YWx1ZXMsIChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMgaXNTZW5kZXJLbm93bihzZW5kZXJJZDogc3RyaW5nLCByZWNlaXZlcklkOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgLy8gUXVlcnkgdG8gY2hlY2sgaWYgdGhlIHNlbmRlciBpcyBpbiB0aGUgcmVjZWl2ZXIncyBjb250YWN0c1xuICAgICAgICBjb25zdCBjb250YWN0UXVlcnkgPSB7XG4gICAgICAgICAgICBvd25lcklkOiByZWNlaXZlcklkLFxuICAgICAgICAgICAgY29udGFjdE51bWJlcjogc2VuZGVySWRcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUcnkgdG8gZmluZCBhIGNvbnRhY3QgZW50cnlcbiAgICAgICAgY29uc3QgY29udGFjdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCBjb250YWN0UXVlcnkpO1xuXG4gICAgICAgIC8vIElmIGEgY29udGFjdCBpcyBmb3VuZCwgdGhlIHNlbmRlciBpcyBrbm93blxuICAgICAgICByZXR1cm4gY29udGFjdCAhPT0gbnVsbDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0UGhvbmVOdW1iZXJCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgc21ydElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5waG9uZU51bWJlcjtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2l0aXplbklkQnlFbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IHNtcnRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghbnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBudW1iZXIuX2lkO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRQbGF5ZXJCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeUVtYWlsKGVtYWlsKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRBdmF0YXJGcm9tRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCBhdmF0b3IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghYXZhdG9yKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBhdmF0b3IuYXZhdGFyO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRVc2VyTmFtZUZyb21FbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghdXNlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gdXNlci51c2VybmFtZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2lkRnJvbVR3ZWV0SWQoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBwaWdlb25JZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlcy5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENpZHNGcm9tUGlnZW9uRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9zZXR0aW5ncycsIHsgcGlnZW9uSWRBdHRhY2hlZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghcmVzIHx8IHJlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcbiAgICAgICAgcmV0dXJuIHJlcy5tYXAoKHNldHRpbmc6IGFueSkgPT4gc2V0dGluZy5faWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDaWRGcm9tRGFya0VtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgZGFya01haWxJZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlcy5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIElzUGxheWVySW5KYWlsKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIXBsYXllcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXRhZGF0YSA9IHBsYXllci5QbGF5ZXJEYXRhLm1ldGFkYXRhO1xuICAgICAgICAgICAgcmV0dXJuIG1ldGFkYXRhICYmIG1ldGFkYXRhLmluamFpbCAmJiBtZXRhZGF0YS5pbmphaWwgPiAwO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBcbiAgICBhc3luYyBnZXRKb2JzKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGpvYnM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgY29uc3QgZW1wbG95ZWVzOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBhbnk+PiA9IHt9O1xuXG4gICAgICAgIC8vIGZpbmQgYWxsIG11bHRpam9iIGVudHJpZXMgZm9yIHRoaXMgY2l0aXplblxuICAgICAgICBjb25zdCBteUVudHJpZXM6IGFueVtdID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghbXlFbnRyaWVzIHx8IG15RW50cmllcy5sZW5ndGggPT09IDApIHJldHVybiB7IGpvYnMsIGVtcGxveWVlcyB9O1xuXG4gICAgICAgIC8vIGNvbGxlY3QgdW5pcXVlIGpvYiBuYW1lcyBzbyB3ZSBjYW4gZmV0Y2ggYWxsIGVtcGxveWVlcyBmb3IgdGhvc2Ugam9icyBpbiBvbmUgcXVlcnlcbiAgICAgICAgY29uc3Qgam9iTmFtZXMgPSBBcnJheS5mcm9tKG5ldyBTZXQobXlFbnRyaWVzLm1hcChlID0+IGUuam9iTmFtZSkpKTtcblxuICAgICAgICAvLyBidWlsZCBqb2JzIG1hcCAob25lIGVudHJ5IHBlciBqb2IgdGhpcyBjaWQgaGFzKVxuICAgICAgICBmb3IgKGNvbnN0IGUgb2YgbXlFbnRyaWVzKSB7XG4gICAgICAgICAgICBqb2JzW2Uuam9iTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiBlLmNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBqb2JOYW1lOiBlLmpvYk5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGVMZXZlbDogZS5ncmFkZUxldmVsID8/IDAsXG4gICAgICAgICAgICAgICAgam9iTGFiZWw6IGUuam9iTGFiZWwgPz8gRnJhbWV3b3JrPy5TaGFyZWQ/LkpvYnM/LltlLmpvYk5hbWVdPy5sYWJlbCA/PyBlLmpvYk5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGVMYWJlbDogZS5ncmFkZUxhYmVsID8/IEZyYW1ld29yaz8uU2hhcmVkPy5Kb2JzPy5bZS5qb2JOYW1lXT8uZ3JhZGVzPy5bZS5ncmFkZUxldmVsXT8ubmFtZSA/PyAnJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZldGNoIGFsbCBlbXBsb3llZXMgZm9yIHRoZSBjb2xsZWN0ZWQgam9icyBhbmQgYnVpbGQgZW1wbG95ZWVzIG1hcDogeyBqb2JOYW1lOiB7IGNpZDogey4uLn0sIC4uLiB9LCAuLi4gfVxuICAgICAgICBjb25zdCBhbGxFbXBsb3llZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGpvYk5hbWU6IHsgJGluOiBqb2JOYW1lcyB9IH0pO1xuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGFsbEVtcGxveWVlcykge1xuICAgICAgICAgICAgZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdID0gZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdW2VudHJ5LmNpdGl6ZW5JZF0gPSB7XG4gICAgICAgICAgICAgICAgY2lkOiBlbnRyeS5jaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgZ3JhZGU6IGVudHJ5LmdyYWRlTGV2ZWwgPz8gMCxcbiAgICAgICAgICAgICAgICBncmFkZUxhYmVsOiBlbnRyeS5ncmFkZUxhYmVsID8/ICcnLFxuICAgICAgICAgICAgICAgIGpvYkxhYmVsOiBlbnRyeS5qb2JMYWJlbCA/PyAnJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGpvYnMsIGVtcGxveWVlcyB9O1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IFV0aWxzID0gbmV3IFV0aWwoKTsiLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFBob25lTWFpbCwgUGhvbmVNYWlsTWVzc2FnZSB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuXG5jbGFzcyBNYWlsIHtcbiAgICBhc3luYyBnZXRNYWlsTWVzc2FnZXMoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykge1xuICAgICAgICBpZiAoIWVtYWlsICYmICFwYXNzd29yZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCwgYWN0aXZlTWFpbFBhc3N3b3JkOiBwYXNzd29yZCB9KTtcbiAgICAgICAgaWYgKCFtYWlsRGF0YSB8fCBtYWlsRGF0YS5tZXNzYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIG1haWxEYXRhLm1lc3NhZ2VzID0gW107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYWlsRGF0YS5tZXNzYWdlcyA9IG1haWxEYXRhLm1lc3NhZ2VzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBuZXcgRGF0ZShiLmRhdGUpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEuZGF0ZSkuZ2V0VGltZSgpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShtYWlsRGF0YS5tZXNzYWdlcyk7XG4gICAgfTtcblxuICAgIGFzeW5jIHNlbmRNYWlsKGVtYWlsOiBzdHJpbmcsIHRvOiBzdHJpbmcsIHN1YmplY3Q6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nLCBpbWFnZXM6IHN0cmluZ1tdLCBzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSBlbWFpbDtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdG87XG5cbiAgICAgICAgY29uc3QgcGxheWVyTWFpbDogUGhvbmVNYWlsID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHBsYXllciB9KTtcbiAgICAgICAgY29uc3QgdGFyZ2V0TWFpbDogUGhvbmVNYWlsID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHRhcmdldCB9KTtcbiAgICAgICAgaWYgKCFwbGF5ZXJNYWlsIHx8ICF0YXJnZXRNYWlsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG5ld01haWxNZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHBsYXllcixcbiAgICAgICAgICAgIHRvOiB0YXJnZXQsXG4gICAgICAgICAgICBhdmF0YXI6IGF3YWl0IFV0aWxzLkdldEF2YXRhckZyb21FbWFpbCh0YXJnZXQpLFxuICAgICAgICAgICAgdXNlcm5hbWU6IGF3YWl0IFV0aWxzLkdldFVzZXJOYW1lRnJvbUVtYWlsKHRhcmdldCksXG4gICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSwgXG4gICAgICAgICAgICBpbWFnZXM6IGltYWdlcyxcbiAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHJlYWQ6IHRydWUsXG4gICAgICAgICAgICB0YWdzOiBbJ2luYm94JywgJ3NlbnQnXVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHRhcmdldE1haWxtZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHBsYXllcixcbiAgICAgICAgICAgIHRvOiB0YXJnZXQsXG4gICAgICAgICAgICBhdmF0YXI6IGF3YWl0IFV0aWxzLkdldEF2YXRhckZyb21FbWFpbChwbGF5ZXIpLFxuICAgICAgICAgICAgc3ViamVjdDogc3ViamVjdCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICB1c2VybmFtZTogYXdhaXQgVXRpbHMuR2V0VXNlck5hbWVGcm9tRW1haWwocGxheWVyKSxcbiAgICAgICAgICAgIGltYWdlczogaW1hZ2VzLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgICAgICB0YWdzOiBbJ2luYm94J11cbiAgICAgICAgfVxuICAgICAgICBwbGF5ZXJNYWlsLm1lc3NhZ2VzLnB1c2gobmV3TWFpbE1lc3NhZ2UpO1xuICAgICAgICB0YXJnZXRNYWlsLm1lc3NhZ2VzLnB1c2godGFyZ2V0TWFpbG1lc3NhZ2UpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBwbGF5ZXIgfSwgcGxheWVyTWFpbCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHRhcmdldCB9LCB0YXJnZXRNYWlsKTtcblxuICAgICAgICBjb25zdCB0YXJnZXRDaWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJCeUVtYWlsKHRhcmdldCk7XG4gICAgICAgIHBsYXllck1haWwubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IG5ldyBEYXRlKGIuZGF0ZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5kYXRlKS5nZXRUaW1lKCkpO1xuICAgICAgICB0YXJnZXRNYWlsLm1lc3NhZ2VzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBuZXcgRGF0ZShiLmRhdGUpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEuZGF0ZSkuZ2V0VGltZSgpKTtcblxuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2htYWlsTWVzc2FnZXMnLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHBsYXllck1haWwubWVzc2FnZXMpKTtcbiAgICAgICAgaWYgKHRhcmdldENpZCkge1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0Q2lkLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWFpbCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBhIG5ldyBtYWlsIGZyb20gJHtwbGF5ZXJ9LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaG1haWxNZXNzYWdlcycsIHRhcmdldENpZC5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkodGFyZ2V0TWFpbC5tZXNzYWdlcykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBzZW5kRW1haWxUb0FsbChzdWJqZWN0OiBzdHJpbmcsIHNlbmRlcjogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIGltYWdlczogc3RyaW5nW10pIHtcbiAgICAgICAgY29uc3QgbWFpbERhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IHsgJG5lOiBudWxsIH0gfSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgbWFpbERhdGEuZm9yRWFjaChhc3luYyAobWFpbDogUGhvbmVNYWlsKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXdNYWlsTWVzc2FnZTogUGhvbmVNYWlsTWVzc2FnZSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGZyb206IHNlbmRlcixcbiAgICAgICAgICAgICAgICB0bzogbWFpbC5hY3RpdmVNYWlkSWQsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiAnJyxcbiAgICAgICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgaW1hZ2VzOiBpbWFnZXMgfHwgW10sXG4gICAgICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHRhZ3M6IFsnaW5ib3gnXSxcbiAgICAgICAgICAgICAgICB1c2VybmFtZTogc2VuZGVyXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbWFpbC5tZXNzYWdlcy5wdXNoKG5ld01haWxNZXNzYWdlKTtcbiAgICAgICAgICAgIC8vQHRzLWlnbm9yZVxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbC5faWQgfSwgbWFpbCk7XG4gICAgICAgIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCAtMSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdNYWlsJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYSBuZXcgbWFpbCwgJHttZXNzYWdlfS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBzZWxlY3RlTWVzc2FnZShkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHsgbWVzc2FnZUlkLCBtYWlsSWQgfSA9IHBhcnNlZERhdGE7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhOiBQaG9uZU1haWwgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbElkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBtYWlsRGF0YS5tZXNzYWdlcy5maW5kKChtKSA9PiBtLl9pZCA9PT0gbWVzc2FnZUlkKTtcbiAgICAgICAgaWYgKCFtZXNzYWdlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIG1lc3NhZ2UucmVhZCA9IHRydWU7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IG1haWxJZCB9LCBtYWlsRGF0YSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBnZXRQcm9maWxlU2V0dGluZ3MoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZEFuZFJldHVyblNwZWNpZmljRmllbGRzKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0sIFsnYWN0aXZlTWFpZElkJywgJ2FjdGl2ZU1haWxQYXNzd29yZCcsICdhdmF0YXInLCAndXNlcm5hbWUnXSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG1haWxEYXRhKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgdXBkYXRlUHJvZmlsZVNldHRpbmdzKGVtYWlsOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcsIHVzZXJuYW1lOiBzdHJpbmcsIGF2YXRhcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIG1haWxEYXRhLnVzZXJuYW1lID0gdXNlcm5hbWU7XG4gICAgICAgIG1haWxEYXRhLmF2YXRhciA9IGF2YXRhcjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwsIGFjdGl2ZU1haWxQYXNzd29yZDogcGFzc3dvcmQgfSwgbWFpbERhdGEpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xufVxuXG5leHBvcnQgY29uc3QgTWFpbENsYXNzID0gbmV3IE1haWwoKTsiLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIi4vY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTWFpbENsYXNzIH0gZnJvbSBcIi4vYXBwcy9NYWlsL2NsYXNzXCI7XG5cbmFzeW5jIGZ1bmN0aW9uIEdldEN1cnJlbnRQaG9uZU51bWJlcihzb3VyY2U6IG51bWJlciB8IHN0cmluZykge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICByZXR1cm4gbnVtYmVyO1xufVxuZXhwb3J0cygnR2V0Q3VycmVudFBob25lTnVtYmVyJywgR2V0Q3VycmVudFBob25lTnVtYmVyKTtcblxuYXN5bmMgZnVuY3Rpb24gR2V0Q3VycmVudFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn1cbmV4cG9ydHMoJ0dldEN1cnJlbnRQaG9uZU51bWJlckJ5Q2l0aXplbklkJywgR2V0Q3VycmVudFBob25lTnVtYmVyQnlDaXRpemVuSWQpO1xuXG5hc3luYyBmdW5jdGlvbiBHZXRFbWFpbElkQnlDaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBlbWFpbCA9IGF3YWl0IFV0aWxzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIHJldHVybiBlbWFpbDtcbn1cbmV4cG9ydHMoJ0dldEVtYWlsSWRCeUNpdGl6ZW5JZCcsIEdldEVtYWlsSWRCeUNpdGl6ZW5JZCk7XG5cbmFzeW5jIGZ1bmN0aW9uIEdldEVtYWlsSWRCeVNvdXJjZShzb3VyY2U6IG51bWJlciB8IHN0cmluZykge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGVtYWlsID0gYXdhaXQgVXRpbHMuR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIGVtYWlsO1xufVxuZXhwb3J0cygnR2V0RW1haWxJZEJ5U291cmNlJywgR2V0RW1haWxJZEJ5U291cmNlKTtcblxuYXN5bmMgZnVuY3Rpb24gU2VuZE5vdGlmaWNhdGlvbihzb3VyY2U6IG51bWJlciB8IHN0cmluZywgdGl0bGU6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZywgYXBwOiBzdHJpbmcsIHRpbWVvdXQ/OiBudW1iZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgYXBwLFxuICAgICAgICB0aW1lb3V0OiB0aW1lb3V0IHx8IDUwMDAsXG4gICAgfSkpO1xufVxuZXhwb3J0cygnU2VuZE5vdGlmaWNhdGlvbicsIFNlbmROb3RpZmljYXRpb24pO1xuXG5hc3luYyBmdW5jdGlvbiBTZW5kTWFpbChkYXRhOiB7XG4gICAgZW1haWw6IHN0cmluZztcbiAgICB0bzogc3RyaW5nO1xuICAgIHN1YmplY3Q6IHN0cmluZztcbiAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgaW1hZ2VzOiBzdHJpbmdbXTtcbiAgICBzb3VyY2U6IG51bWJlcjtcbn0pIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNYWlsQ2xhc3Muc2VuZE1haWwoZGF0YS5lbWFpbCwgZGF0YS50bywgZGF0YS5zdWJqZWN0LCBkYXRhLm1lc3NhZ2UsIGRhdGEuaW1hZ2VzLCBkYXRhLnNvdXJjZSk7XG4gICAgcmV0dXJuIHJlcztcbn1cbmV4cG9ydHMoJ1NlbmRNYWlsJywgU2VuZE1haWwpO1xuXG5hc3luYyBmdW5jdGlvbiBTZW5kTWFpbFRvQWxsKGRhdGE6IHtcbiAgICBzdWJqZWN0OiBzdHJpbmc7XG4gICAgc2VuZGVyOiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGltYWdlczogc3RyaW5nW107XG59KSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbmRFbWFpbFRvQWxsKGRhdGEuc3ViamVjdCwgZGF0YS5zZW5kZXIsZGF0YS5tZXNzYWdlLCBkYXRhLmltYWdlcyk7XG4gICAgcmV0dXJuIHJlcztcbn1cbmV4cG9ydHMoJ1NlbmRNYWlsVG9BbGwnLCBTZW5kTWFpbFRvQWxsKTtcblxuY29uc3QgR2V0Sm9icyA9IGFzeW5jIChjaXRpemVuSWQ6IHN0cmluZykgPT4ge1xuICAgIGlmICghY2l0aXplbklkKSByZXR1cm4ge307XG4gICAgY29uc3QgcmVzID0gYXdhaXQgVXRpbHMuZ2V0Sm9icyhjaXRpemVuSWQpO1xuICAgIHJldHVybiByZXMuam9icyB8fCB7fTtcbn07XG5leHBvcnRzKCdnZXRKb2JzJywgR2V0Sm9icyk7XG5cbi8vIE9wdGlvbmFsOiByZXR1cm4gZnVsbCByZXN1bHQgeyBqb2JzLCBlbXBsb3llZXMgfVxuY29uc3QgR2V0Sm9ic0Z1bGwgPSBhc3luYyAoY2l0aXplbklkOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgam9iczoge30sIGVtcGxveWVlczoge30gfTtcbiAgICByZXR1cm4gYXdhaXQgVXRpbHMuZ2V0Sm9icyhjaXRpemVuSWQpO1xufTtcbmV4cG9ydHMoJ2dldEpvYnNGdWxsJywgR2V0Sm9ic0Z1bGwpOyIsICJjb25zdCBjYWNoZUV2ZW50cyA9IHt9O1xuZXhwb3J0IGNvbnN0IGNhY2hlID0gbmV3IFByb3h5KHtcbiAgICByZXNvdXJjZTogR2V0Q3VycmVudFJlc291cmNlTmFtZSgpLFxuICAgIGdhbWU6IEdldEdhbWVOYW1lKCksXG59LCB7XG4gICAgZ2V0KHRhcmdldCwga2V5KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGtleSA/IHRhcmdldFtrZXldIDogdGFyZ2V0O1xuICAgICAgICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICBjYWNoZUV2ZW50c1trZXldID0gW107XG4gICAgICAgIEFkZEV2ZW50SGFuZGxlcihgb3hfbGliOmNhY2hlOiR7a2V5fWAsICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IGNhY2hlRXZlbnRzW2tleV07XG4gICAgICAgICAgICBldmVudHMuZm9yRWFjaCgoY2IpID0+IGNiKHZhbHVlLCBvbGRWYWx1ZSkpO1xuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRhcmdldFtrZXldID0gZXhwb3J0cy5veF9saWIuY2FjaGUoa2V5KSB8fCBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldFtrZXldO1xuICAgIH0sXG59KTtcbmV4cG9ydCBjb25zdCBvbkNhY2hlID0gKGtleSwgY2IpID0+IHtcbiAgICBpZiAoIWNhY2hlRXZlbnRzW2tleV0pXG4gICAgICAgIGNhY2hlW2tleV07XG4gICAgY2FjaGVFdmVudHNba2V5XS5wdXNoKGNiKTtcbn07XG4iLCAiaW1wb3J0IHsgY2FjaGUgfSBmcm9tICcuLi9jYWNoZSc7XG5jb25zdCBwZW5kaW5nQ2FsbGJhY2tzID0ge307XG5jb25zdCBjYWxsYmFja1RpbWVvdXQgPSBHZXRDb252YXJJbnQoJ294OmNhbGxiYWNrVGltZW91dCcsIDMwMDAwMCk7XG5vbk5ldChgX19veF9jYl8ke2NhY2hlLnJlc291cmNlfWAsIChrZXksIC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCByZXNvbHZlID0gcGVuZGluZ0NhbGxiYWNrc1trZXldO1xuICAgIGRlbGV0ZSBwZW5kaW5nQ2FsbGJhY2tzW2tleV07XG4gICAgcmV0dXJuIHJlc29sdmUgJiYgcmVzb2x2ZSguLi5hcmdzKTtcbn0pO1xuZXhwb3J0IGZ1bmN0aW9uIHRyaWdnZXJDbGllbnRDYWxsYmFjayhldmVudE5hbWUsIHBsYXllcklkLCAuLi5hcmdzKSB7XG4gICAgbGV0IGtleTtcbiAgICBkbyB7XG4gICAgICAgIGtleSA9IGAke2V2ZW50TmFtZX06JHtNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoMTAwMDAwICsgMSkpfToke3BsYXllcklkfWA7XG4gICAgfSB3aGlsZSAocGVuZGluZ0NhbGxiYWNrc1trZXldKTtcbiAgICBlbWl0TmV0KGBfX294X2NiXyR7ZXZlbnROYW1lfWAsIHBsYXllcklkLCBjYWNoZS5yZXNvdXJjZSwga2V5LCAuLi5hcmdzKTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBwZW5kaW5nQ2FsbGJhY2tzW2tleV0gPSByZXNvbHZlO1xuICAgICAgICBzZXRUaW1lb3V0KHJlamVjdCwgY2FsbGJhY2tUaW1lb3V0LCBgY2FsbGJhY2sgZXZlbnQgJyR7a2V5fScgdGltZWQgb3V0YCk7XG4gICAgfSk7XG59XG5leHBvcnQgZnVuY3Rpb24gb25DbGllbnRDYWxsYmFjayhldmVudE5hbWUsIGNiKSB7XG4gICAgb25OZXQoYF9fb3hfY2JfJHtldmVudE5hbWV9YCwgYXN5bmMgKHJlc291cmNlLCBrZXksIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgY29uc3Qgc3JjID0gc291cmNlO1xuICAgICAgICBsZXQgcmVzcG9uc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNwb25zZSA9IGF3YWl0IGNiKHNyYywgLi4uYXJncyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGhhbmRsaW5nIGNhbGxiYWNrIGV2ZW50ICR7ZXZlbnROYW1lfWApO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYF4zJHtlLnN0YWNrfV4wYCk7XG4gICAgICAgIH1cbiAgICAgICAgZW1pdE5ldChgX19veF9jYl8ke3Jlc291cmNlfWAsIHNyYywga2V5LCByZXNwb25zZSk7XG4gICAgfSk7XG59XG4iLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFBob25lQ29udGFjdHMgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czpnZXRDb250YWN0cycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgY29udGFjdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9jb250YWN0cycsIHsgb3duZXJJZDogY2l0aXplbklkIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShjb250YWN0cyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6c2F2ZUNvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjb250YWN0RGF0YTogUGhvbmVDb250YWN0cyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgaWYgKGNvbnRhY3REYXRhLl9pZCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogY29udGFjdERhdGEuX2lkIH0sIHsgLi4uY29udGFjdERhdGEgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ29udGFjdCBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3REYXRhLmZpcnN0TmFtZX0nJHtjb250YWN0RGF0YS5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdERhdGEuY29udGFjdE51bWJlcn0pIHVwZGF0ZWQgYnkgJHtjb250YWN0RGF0YS5wZXJzb25hbE51bWJlcn0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOmFkZENvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgY29udGFjdERhdGE6IFBob25lQ29udGFjdHMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGRhdGFYID0geyAuLi5jb250YWN0RGF0YSwgb3duZXJJZDogY2l0aXplbklkLCBwZXJzb25hbE51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfY29udGFjdHMnLCBkYXRhWCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9jb250YWN0cycsXG4gICAgICAgIHRpdGxlOiAnQ29udGFjdCBBZGRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3REYXRhLmZpcnN0TmFtZX0nJHtjb250YWN0RGF0YS5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdERhdGEuY29udGFjdE51bWJlcn0pIGFkZGVkIGJ5ICR7ZGF0YVgucGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YVgpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOmRlbGV0ZUNvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBfaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNvbnRhY3QgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9KTtcbiAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogX2lkIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICB0aXRsZTogJ0NvbnRhY3QgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3QuZmlyc3ROYW1lfScgJyR7Y29udGFjdC5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdC5jb250YWN0TnVtYmVyfSkgZGVsZXRlZCBieSAke2NvbnRhY3QucGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czpmYXZDb250YWN0JywgYXN5bmMgKGNsaWVudCwgX2lkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSk7XG4gICAgY29uc3QgZGF0YVggPSB7IC4uLmNvbnRhY3QsIGlzRmF2OiAhY29udGFjdC5pc0ZhdiB9XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9LCBkYXRhWCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9jb250YWN0cycsXG4gICAgICAgIHRpdGxlOiAnQ29udGFjdCBGYXZvcml0ZSBUb2dnbGVkJyxcbiAgICAgICAgbWVzc2FnZTogYENvbnRhY3QgJyR7Y29udGFjdC5maXJzdE5hbWV9JyAnJHtjb250YWN0Lmxhc3ROYW1lfScgKE51bWJlcjogJHtjb250YWN0LmNvbnRhY3ROdW1iZXJ9KSBmYXZvcml0ZSBzdGF0dXMgc2V0IHRvICR7ZGF0YVguaXNGYXZ9IGJ5ICR7Y29udGFjdC5wZXJzb25hbE51bWJlcn0uYCxcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YVgpO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRGFya0NoYXRDaGFubmVsIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcblxub25DbGllbnRDYWxsYmFjaygnU2VhcmNoRGFya0NoYXRFbWFpbCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdSZWdpc3Rlck5ld0RhcmtNYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsLCBlbWFpbCwgcGFzc3dvcmQsIGF2YXRhcjogXCJcIiB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2FjY291bnRzJyxcbiAgICAgICAgdGl0bGU6ICdBY2NvdW50IFJlZ2lzdGVyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTmV3IERhcmtDaGF0IGFjY291bnQgcmVnaXN0ZXJlZCB3aXRoIGVtYWlsICR7ZW1haWx9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdMb2dpbkRhcmtNYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgZW1haWw6IHN0cmluZztcbiAgICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogcGFyc2VkRGF0YS5lbWFpbCB9KTtcbiAgICBpZiAocmVzLnBhc3N3b3JkID09PSBwYXJzZWREYXRhLnBhc3N3b3JkKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2FjY291bnRzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQWNjb3VudCBMb2dpbicsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciBsb2dnZWQgaW50byBEYXJrQ2hhdCB3aXRoIGVtYWlsICR7cGFyc2VkRGF0YS5lbWFpbH0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnQ3JlYXRlTmV3RGFya0NoYW5uZWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IG5hbWUsIGVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlczI6IERhcmtDaGF0Q2hhbm5lbFtdID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7fSk7XG4gICAgaWYgKHJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKSAmJiAhcmVzMi5maW5kKChjaGFubmVsKSA9PiBjaGFubmVsLm5hbWUgPT09IG5hbWUpPy5tZW1iZXJzLmluY2x1ZGVzKGVtYWlsKSkge1xuICAgICAgICByZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSk/Lm1lbWJlcnMucHVzaChlbWFpbCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgbmFtZSB9LCByZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgICAgICB0aXRsZTogJ0pvaW5lZCBDaGFubmVsJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSBqb2luZWQgZXhpc3RpbmcgRGFya0NoYXQgY2hhbm5lbCAnJHtuYW1lfScuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMyLmZpbHRlcigoY2hhbm5lbCkgPT4gY2hhbm5lbC5tZW1iZXJzLmluY2x1ZGVzKGVtYWlsKSkpO1xuICAgIH0gZWxzZSBpZiAoIXJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKSkge1xuICAgICAgICBjb25zdCBuZXdEYXRhID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICBtZW1iZXJzOiBbZW1haWxdLFxuICAgICAgICAgICAgY3JlYXRvcjogZW1haWwsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIG5ld0RhdGEpO1xuICAgICAgICByZXMyLnB1c2gobmV3RGF0YSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ2hhbm5lbCBDcmVhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSBjcmVhdGVkIG5ldyBEYXJrQ2hhdCBjaGFubmVsICcke25hbWV9Jy5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlczIuZmlsdGVyKChjaGFubmVsKSA9PiBjaGFubmVsLm1lbWJlcnMuaW5jbHVkZXMoZW1haWwpKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdHZXREYXJrQ2hhdFByb2ZpbGUnLCBhc3luYyAoY2xpZW50LCBlbWFpbDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0dldERhcmtDaGF0Q2hhbm5lbHMnLCBhc3luYyAoY2xpZW50LCBlbWFpbDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IG1lbWJlcnM6IGVtYWlsIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1JlbW92ZUZyb21EYXJrQ2hhbm5lbCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgX2lkLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBfaWQgfSk7XG4gICAgaWYgKHJlcy5jcmVhdG9yID09PSBlbWFpbCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IF9pZCB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdDaGFubmVsIERlbGV0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IGRlbGV0ZWQgRGFya0NoYXQgY2hhbm5lbCAnJHtyZXMubmFtZX0nIChJRDogJHtfaWR9KS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXMubWVtYmVycyA9IHJlcy5tZW1iZXJzLmZpbHRlcigobWVtYmVyOiBzdHJpbmcpID0+IG1lbWJlciAhPT0gZW1haWwpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IF9pZCB9LCByZXMpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgICAgICB0aXRsZTogJ0xlZnQgQ2hhbm5lbCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gbGVmdCBEYXJrQ2hhdCBjaGFubmVsICcke3Jlcy5uYW1lfScgKElEOiAke19pZH0pLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdVcGRhdGVEYXJrQXZhdGFyJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBlbWFpbCwgYXZhdGFyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9KTtcbiAgICByZXMuYXZhdGFyID0gYXZhdGFyO1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsIH0sIHJlcyk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9hY2NvdW50cycsXG4gICAgICAgIHRpdGxlOiAnQXZhdGFyIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gdXBkYXRlZCB0aGVpciBEYXJrQ2hhdCBhdmF0YXIuYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1VwZGF0ZURhcmtQYXNzd29yZCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9KTtcbiAgICByZXMucGFzc3dvcmQgPSBwYXNzd29yZDtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9LCByZXMpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfYWNjb3VudHMnLFxuICAgICAgICB0aXRsZTogJ1Bhc3N3b3JkIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gdXBkYXRlZCB0aGVpciBEYXJrQ2hhdCBwYXNzd29yZC5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnU2V0RGFya0NoYXRNZXNzYWdlcycsIGFzeW5jIChjbGllbnQsIGRhdGFYOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGNoYW5uZWwsIGRhdGEgfSA9IEpTT04ucGFyc2UoZGF0YVgpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgX2lkOiBjaGFubmVsIH0sIGRhdGEpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgU2VudCcsXG4gICAgICAgIG1lc3NhZ2U6IGBNZXNzYWdlIHNlbnQgaW4gRGFya0NoYXQgY2hhbm5lbCAnJHtkYXRhLm5hbWV9JyAoSUQ6ICR7Y2hhbm5lbH0pLCBDb250ZW50OiAke2RhdGEuY29udGVudH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIGRhdGEubWVtYmVycy5mb3JFYWNoKGFzeW5jIChtZW1iZXI6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKGF3YWl0IFV0aWxzLkdldENpZEZyb21EYXJrRW1haWwobWVtYmVyKSk7XG4gICAgICAgIGlmICghcmVzKSByZXR1cm47XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVjZWl2ZURhcmtDaGF0TWVzc2FnZScsIHJlcywgSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuICAgICAgICBpZiAocmVzICE9PSBjbGllbnQpIHtcbiAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlcywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ0RhcmtDaGF0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGEgbmV3IG1lc3NhZ2UgaW4gJHtkYXRhLm5hbWV9LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBNYWlsQ2xhc3MgfSBmcm9tIFwiLi9jbGFzc1wiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6Z2V0RW1haWxNZXNzYWdlcycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBNYWlsQ2xhc3MuZ2V0TWFpbE1lc3NhZ2VzKGVtYWlsLCBwYXNzd29yZClcbiAgICByZXR1cm4gZGF0YTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VuZEVtYWlsJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBlbWFpbDogc3RyaW5nLCB0bzogc3RyaW5nLCBzdWJqZWN0OiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZywgaW1hZ2VzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5zZW5kTWFpbChlbWFpbCwgdG8sIHN1YmplY3QsIG1lc3NhZ2UsIGltYWdlcywgc291cmNlKTtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX21haWwnLFxuICAgICAgICB0aXRsZTogJ0VtYWlsIFNlbnQnLFxuICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7Y2l0aXplbklkfSBzZW50IGFuIGVtYWlsIGZyb20gJHtlbWFpbH0gdG8gJHt0b30gd2l0aCBzdWJqZWN0IFwiJHtzdWJqZWN0fVwiLCBjb250ZW50OiBcIiR7bWVzc2FnZX1cImAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXRTZWxlY3RlZE1lc3NhZ2UnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5zZWxlY3RlTWVzc2FnZShkYXRhKTtcbiAgICByZXR1cm4gcmVzO1xufSlcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOmdldFByb2ZpbGVTZXR0aW5ncycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IHBhcnNlZERhdGE7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLmdldFByb2ZpbGVTZXR0aW5ncyhlbWFpbCwgcGFzc3dvcmQpO1xuICAgIHJldHVybiByZXM7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnVwZGF0ZVByb2ZpbGVTZXR0aW5ncycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQsIHVzZXJuYW1lLCBhdmF0YXIgfSA9IHBhcnNlZERhdGE7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnVwZGF0ZVByb2ZpbGVTZXR0aW5ncyhlbWFpbCwgcGFzc3dvcmQsIHVzZXJuYW1lLCBhdmF0YXIpO1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWFpbCcsXG4gICAgICAgIHRpdGxlOiAnUHJvZmlsZSBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBsYXllciAke2NpdGl6ZW5JZH0gdXBkYXRlZCBwcm9maWxlIGZvciBlbWFpbCAke2VtYWlsfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcztcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpzZW5kTWVzc2FnZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgdHlwZSwgcGhvbmVOdW1iZXIsIGdyb3VwSWQsIG1lc3NhZ2VEYXRhIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgbGV0IGZpcnN0TWVzc2FnZSA9IGZhbHNlO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IHNlbmRlcklkLFxuICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9O1xuICAgICAgICBmaXJzdE1lc3NhZ2UgPSB0cnVlO1xuICAgIH1cblxuICAgIGxldCBjb252ZXJzYXRpb247XG4gICAgaWYgKHR5cGUgPT09ICdwcml2YXRlJykge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyID09PSBwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIocGhvbmVOdW1iZXIsIHNlbmRlcklkKSB8fCBgVW5rbm93biAoJHtwaG9uZU51bWJlcn0pYDtcbiAgICAgICAgICAgIGNvbnN0IGF2YXRhciA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3RBdmF0YXJCeU51bWJlcihwaG9uZU51bWJlciwgc2VuZGVySWQpIHx8IG51bGw7IC8vIEFzc3VtZSB0aGlzIHV0aWxpdHkgZXhpc3RzXG4gICAgICAgICAgICBjb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3ByaXZhdGUnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGNvbnRhY3ROYW1lLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogYXZhdGFyLCAvLyBTZXQgYXZhdGFyIGZvciBwcml2YXRlIGNvbnRhY3RcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogcGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2goY29udmVyc2F0aW9uKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2dyb3VwJykge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgZ3JvdXBJZD86IHN0cmluZyB9KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQgZm9yIHNlbmRlcicgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBsYXN0TWVzc2FnZSA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlc1tjb252ZXJzYXRpb24ubWVzc2FnZXMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgbmV4dFBhZ2UgPSBsYXN0TWVzc2FnZSA/IGxhc3RNZXNzYWdlLnBhZ2UgKyAxIDogMTtcblxuICAgIGNvbnN0IG5ld01lc3NhZ2UgPSB7XG4gICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VEYXRhLm1lc3NhZ2UsXG4gICAgICAgIHJlYWQ6IHRydWUsXG4gICAgICAgIHBhZ2U6IG5leHRQYWdlLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgc2VuZGVySWQ6IHNlbmRlclBob25lTnVtYmVyLFxuICAgICAgICBhdHRhY2htZW50czogbWVzc2FnZURhdGEuYXR0YWNobWVudHMgfHwgW11cbiAgICB9O1xuXG4gICAgY29udmVyc2F0aW9uLm1lc3NhZ2VzLnB1c2gobmV3TWVzc2FnZSk7XG5cbiAgICBpZiAoIWZpcnN0TWVzc2FnZSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tZXNzYWdlcycsIHVzZXJNZXNzYWdlcyk7XG4gICAgfVxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWVzc2FnZXMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgU2VudCcsXG4gICAgICAgIG1lc3NhZ2U6IGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gc2VudCBhIG1lc3NhZ2UgdG8gJHt0eXBlID09PSAncHJpdmF0ZScgPyBwaG9uZU51bWJlciA6ICdncm91cCAnICsgZ3JvdXBJZH0gd2l0aCBjb250ZW50OiAke21lc3NhZ2VEYXRhLm1lc3NhZ2V9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIC8vIEhhbmRsZSByZWNpcGllbnRzXG4gICAgaWYgKHR5cGUgPT09ICdwcml2YXRlJykge1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKHRhcmdldENpdGl6ZW5JZCkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGNvbnN0IGlzQmxvY2tlZCA9IHRhcmdldE1lc3NhZ2VzPy5ibG9ja2VkTnVtYmVycz8uaW5jbHVkZXMoc2VuZGVyUGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgaWYgKCFpc0Jsb2NrZWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBzZW5kVG9SZWNpcGllbnQodGFyZ2V0Q2l0aXplbklkLCBzZW5kZXJQaG9uZU51bWJlciwgbWVzc2FnZURhdGEsICdwcml2YXRlJywgcGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZCh0YXJnZXRDaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIENWWENTLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiWW91IGhhdmUgYSBuZXcgbWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmVfbWVzc2FnZXM6Y2xpZW50OnVwZGF0ZU1lc3NhZ2VzJywgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KG5ld01lc3NhZ2UpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gaXMgYmxvY2tlZCBieSAke3Bob25lTnVtYmVyfS4gTWVzc2FnZSBzYXZlZCBvbmx5IGZvciBzZW5kZXIuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgUmVjaXBpZW50IHdpdGggcGhvbmUgbnVtYmVyICR7cGhvbmVOdW1iZXJ9IGRvZXMgbm90IGV4aXN0LiBNZXNzYWdlIHNhdmVkIG9ubHkgZm9yIHNlbmRlci5gKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2dyb3VwJykge1xuICAgICAgICBjb25zdCBncm91cENvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXBDb252ZXJzYXRpb24/Lm1lbWJlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbWVtYmVycyBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXBDb252ZXJzYXRpb24ubWVtYmVycykge1xuICAgICAgICAgICAgaWYgKG1lbWJlcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQobWVtYmVySWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQmxvY2tlZCA9IG1lbWJlck1lc3NhZ2VzPy5ibG9ja2VkTnVtYmVycz8uaW5jbHVkZXMoc2VuZGVyUGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIGlmICghaXNCbG9ja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHNlbmRUb1JlY2lwaWVudChtZW1iZXJJZCwgc2VuZGVyUGhvbmVOdW1iZXIsIG1lc3NhZ2VEYXRhLCAnZ3JvdXAnLCB1bmRlZmluZWQsIGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gaXMgYmxvY2tlZCBieSBncm91cCBtZW1iZXIgJHttZW1iZXJQaG9uZU51bWJlcn0uYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgICAgICAgICAgaWYgKENWWENTKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBhIG5ldyBtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZV9tZXNzYWdlczpjbGllbnQ6dXBkYXRlTWVzc2FnZXMnLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkoeyAuLi5uZXdNZXNzYWdlLCBncm91cElkIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xufSk7XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBzZW5kIG1lc3NhZ2VzIHRvIHJlY2lwaWVudHMgKHVuY2hhbmdlZClcbmFzeW5jIGZ1bmN0aW9uIHNlbmRUb1JlY2lwaWVudChcbiAgICB0YXJnZXRDaXRpemVuSWQ6IHN0cmluZyxcbiAgICBzZW5kZXJQaG9uZU51bWJlcjogc3RyaW5nLFxuICAgIG1lc3NhZ2VEYXRhOiBhbnksXG4gICAgdHlwZTogJ3ByaXZhdGUnIHwgJ2dyb3VwJyxcbiAgICBwaG9uZU51bWJlcj86IHN0cmluZyxcbiAgICBncm91cElkPzogc3RyaW5nXG4pIHtcbiAgICBsZXQgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICBsZXQgcmVjZWl2ZXJGaXJzdE1lc3NhZ2UgPSBmYWxzZTtcblxuICAgIGlmICghdGFyZ2V0TWVzc2FnZXMpIHtcbiAgICAgICAgdGFyZ2V0TWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH07XG4gICAgICAgIHJlY2VpdmVyRmlyc3RNZXNzYWdlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBsZXQgdGFyZ2V0Q29udmVyc2F0aW9uO1xuICAgIGlmICh0eXBlID09PSAncHJpdmF0ZScpIHtcbiAgICAgICAgdGFyZ2V0Q29udmVyc2F0aW9uID0gdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyID09PSBzZW5kZXJQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghdGFyZ2V0Q29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIsIHRhcmdldENpdGl6ZW5JZCk7XG4gICAgICAgICAgICBjb25zdCBhdmF0YXIgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0QXZhdGFyQnlOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIsIHRhcmdldENpdGl6ZW5JZCkgfHwgJyc7IC8vIEFzc3VtZSB0aGlzIHV0aWxpdHkgZXhpc3RzXG4gICAgICAgICAgICB0YXJnZXRDb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3ByaXZhdGUnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGNvbnRhY3ROYW1lIHx8IGBVbmtub3duICgke3NlbmRlclBob25lTnVtYmVyfSlgLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogYXZhdGFyLCAvLyBTZXQgYXZhdGFyIGZvciBwcml2YXRlIGNvbnRhY3RcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogc2VuZGVyUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMucHVzaCh0YXJnZXRDb252ZXJzYXRpb24pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnZ3JvdXAnKSB7XG4gICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyB0eXBlOiBzdHJpbmcsIGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKCF0YXJnZXRDb252ZXJzYXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHNlbmRlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHNlbmRlclBob25lTnVtYmVyKSB9KTtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gc2VuZGVyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgICAgIGlmICghZ3JvdXApIHJldHVybjtcbiAgICAgICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLm5hbWUsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiBncm91cC5hdmF0YXIgfHwgbnVsbCwgLy8gQ29weSBhdmF0YXIgZnJvbSBzZW5kZXIncyBncm91cFxuICAgICAgICAgICAgICAgIGdyb3VwSWQ6IGdyb3VwSWQsXG4gICAgICAgICAgICAgICAgbWVtYmVyczogZ3JvdXAubWVtYmVycyxcbiAgICAgICAgICAgICAgICBtZW1iZXJQaG9uZU51bWJlcnM6IGdyb3VwLm1lbWJlclBob25lTnVtYmVycyxcbiAgICAgICAgICAgICAgICBjcmVhdG9ySWQ6IGdyb3VwLmNyZWF0b3JJZCwgLy8gQ29weSBjcmVhdG9ySWRcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0YXJnZXRNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHRhcmdldENvbnZlcnNhdGlvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0YXJnZXRMYXN0TWVzc2FnZSA9IHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlc1t0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGFyZ2V0TmV4dFBhZ2UgPSB0YXJnZXRMYXN0TWVzc2FnZSA/IHRhcmdldExhc3RNZXNzYWdlLnBhZ2UgKyAxIDogMTtcblxuICAgIGNvbnN0IHRhcmdldE5ld01lc3NhZ2UgPSB7XG4gICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VEYXRhLm1lc3NhZ2UsXG4gICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICBwYWdlOiB0YXJnZXROZXh0UGFnZSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHNlbmRlcklkOiBzZW5kZXJQaG9uZU51bWJlcixcbiAgICAgICAgYXR0YWNobWVudHM6IG1lc3NhZ2VEYXRhLmF0dGFjaG1lbnRzIHx8IFtdXG4gICAgfTtcblxuICAgIHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcy5wdXNoKHRhcmdldE5ld01lc3NhZ2UpO1xuXG4gICAgaWYgKCFyZWNlaXZlckZpcnN0TWVzc2FnZSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdGFyZ2V0TWVzc2FnZXMuX2lkIH0sIHRhcmdldE1lc3NhZ2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCB0YXJnZXRNZXNzYWdlcyk7XG4gICAgfVxufVxuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmNyZWF0ZUdyb3VwJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBncm91cE5hbWUsIG1lbWJlclBob25lTnVtYmVycywgYXZhdGFyIH0gPSBKU09OLnBhcnNlKGRhdGEpOyAvLyBBZGRlZCBhdmF0YXIgZmllbGRcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG1lbWJlcklkcyA9IFtzZW5kZXJJZF07XG4gICAgY29uc3QgcGhvbmVOdW1iZXJzID0gW3NlbmRlclBob25lTnVtYmVyXTtcbiAgICBmb3IgKGNvbnN0IHBob25lIG9mIG1lbWJlclBob25lTnVtYmVycykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lKTtcbiAgICAgICAgaWYgKGNpdGl6ZW5JZCAmJiAhbWVtYmVySWRzLmluY2x1ZGVzKGNpdGl6ZW5JZCkpIHtcbiAgICAgICAgICAgIG1lbWJlcklkcy5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICBwaG9uZU51bWJlcnMucHVzaChwaG9uZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBncm91cElkID0gZ2VuZXJhdGVVVWlkKCk7XG4gICAgY29uc3QgZ3JvdXBDb252ZXJzYXRpb24gPSB7XG4gICAgICAgIHR5cGU6ICdncm91cCcsXG4gICAgICAgIG5hbWU6IGdyb3VwTmFtZSxcbiAgICAgICAgYXZhdGFyOiBhdmF0YXIgfHwgJycsXG4gICAgICAgIGdyb3VwSWQ6IGdyb3VwSWQsXG4gICAgICAgIG1lbWJlcnM6IG1lbWJlcklkcyxcbiAgICAgICAgbWVtYmVyUGhvbmVOdW1iZXJzOiBwaG9uZU51bWJlcnMsXG4gICAgICAgIGNyZWF0b3JJZDogc2VuZGVySWQsIC8vIFNldCB0aGUgY3JlYXRvciBhcyB0aGUgc2VuZGVyXG4gICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBjcmVhdGVkIG5ldyBHcm91cFwiLFxuICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICB1c2VyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiBzZW5kZXJJZCxcbiAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICBtZXNzYWdlczogW2dyb3VwQ29udmVyc2F0aW9uXVxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCB1c2VyTWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKGdyb3VwQ29udmVyc2F0aW9uKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIG1lbWJlcklkcykge1xuICAgICAgICBpZiAobWVtYmVySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgICAgICBsZXQgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICAgICAgY29uc3QgQ1ZYQ1MgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKG1lbWJlcklkKTtcbiAgICAgICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBiZWVuIGFkZGVkIHRvIGEgbmV3IGdyb3VwXCIsXG4gICAgICAgICAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IG1lbWJlcklkLFxuICAgICAgICAgICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbeyAuLi5ncm91cENvbnZlcnNhdGlvbiB9XVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHsgLi4uZ3JvdXBDb252ZXJzYXRpb24gfSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICB0aXRsZTogJ0dyb3VwIENyZWF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJyR7Z3JvdXBOYW1lfScgY3JlYXRlZCBieSAke3NlbmRlclBob25lTnVtYmVyfS4gR3JvdXAgSUQ6ICR7Z3JvdXBJZH0gd2l0aCBtZW1iZXJzOiAke21lbWJlclBob25lTnVtYmVycy5qb2luKCcsICcpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBncm91cElkIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6dG9nZ2xlQmxvY2snLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHBob25lTnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG5cbiAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogc2VuZGVySWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKCF1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMpIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzID0gW107XG4gICAgfVxuXG4gICAgY29uc3QgaXNCbG9ja2VkID0gdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLmluY2x1ZGVzKHBob25lTnVtYmVyKTtcbiAgICBpZiAoaXNCbG9ja2VkKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLmluZGV4T2YocGhvbmVOdW1iZXIpO1xuICAgICAgICB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgZW1pdE5ldChcInBob25lOmFkZE5vdGlmaWNhdGlvblwiLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIHVuYmxvY2tlZFwiLFxuICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYmxvY2tzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTnVtYmVyIFVuYmxvY2tlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gdW5ibG9ja2VkICR7cGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5wdXNoKHBob25lTnVtYmVyKTtcbiAgICAgICAgZW1pdE5ldChcInBob25lOmFkZE5vdGlmaWNhdGlvblwiLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIGJsb2NrZWRcIixcbiAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2Jsb2NrcycsXG4gICAgICAgICAgICB0aXRsZTogJ051bWJlciBCbG9ja2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NlbmRlclBob25lTnVtYmVyfSBibG9ja2VkICR7cGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh1c2VyTWVzc2FnZXMubWVzc2FnZXMubGVuZ3RoID09PSAwICYmIHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5sZW5ndGggPT09IDAgJiYgIXVzZXJNZXNzYWdlcy5kZWxldGVkTWVzc2FnZXM/Lmxlbmd0aCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTphZGRNZW1iZXInLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGdyb3VwSWQsIHBob25lTnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICAgICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFZhbGlkYXRlIHRoZSBuZXcgbWVtYmVyXG4gICAgICAgIGNvbnN0IG5ld01lbWJlcklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghbmV3TWVtYmVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCB0aGUgc2VuZGVyJ3MgbWVzc2FnZXMgdG8gZmluZCB0aGUgZ3JvdXBcbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBtZW1iZXJzPzogc3RyaW5nW10sIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXAgfHwgIWdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgbmV3IG1lbWJlciBpcyBhbHJlYWR5IGluIHRoZSBncm91cFxuICAgICAgICBpZiAoZ3JvdXAubWVtYmVycy5pbmNsdWRlcyhuZXdNZW1iZXJJZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIGFscmVhZHkgaW4gZ3JvdXAnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHRoZSBuZXcgbWVtYmVyIHRvIHRoZSBncm91cFxuICAgICAgICBncm91cC5tZW1iZXJzLnB1c2gobmV3TWVtYmVySWQpO1xuICAgICAgICBncm91cC5tZW1iZXJQaG9uZU51bWJlcnMucHVzaChwaG9uZU51bWJlcik7XG5cbiAgICAgICAgLy8gVXBkYXRlIGFsbCBleGlzdGluZyBtZW1iZXJzJyBncm91cCBkYXRhLCBpbmNsdWRpbmcgdGhlIHNlbmRlciBhbmQgbmV3IG1lbWJlclxuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgICAgIGxldCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG5cbiAgICAgICAgICAgIGlmICghbWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgbWVtYmVyIGlzIG5ldyAobm8gbWVzc2FnZXMgZG9jdW1lbnQpLCBjcmVhdGUgb25lXG4gICAgICAgICAgICAgICAgbWVtYmVyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogbWVtYmVySWQsXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbWVtYmVyR3JvdXAgPSBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICBpZiAobWVtYmVyR3JvdXApIHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgZXhpc3RpbmcgZ3JvdXAgZGF0YSBmb3IgdGhpcyBtZW1iZXJcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJzID0gZ3JvdXAubWVtYmVycztcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJQaG9uZU51bWJlcnMgPSBncm91cC5tZW1iZXJQaG9uZU51bWJlcnM7XG4gICAgICAgICAgICAgICAgbWVtYmVyR3JvdXAuYXZhdGFyID0gZ3JvdXAuYXZhdGFyOyAvLyBFbnN1cmUgYXZhdGFyIGlzIGNvcGllZFxuICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLmNyZWF0b3JJZCA9IGdyb3VwLmNyZWF0b3JJZDsgLy8gRW5zdXJlIGNyZWF0b3JJZCBpcyBjb3BpZWRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQWRkIHRoZSBncm91cCB0byB0aGlzIG1lbWJlcidzIG1lc3NhZ2VzIGlmIGl0IGRvZXNuXHUyMDE5dCBleGlzdFxuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2goeyAuLi5ncm91cCB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2F2ZSBvciB1cGRhdGUgdGhlIG1lbWJlcidzIG1lc3NhZ2VzXG4gICAgICAgICAgICBpZiAobWVtYmVyTWVzc2FnZXMuX2lkKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgZGF0YSBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCkpXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBncm91cCBkYXRhIGZvciBtZW1iZXIgJHttZW1iZXJJZH06YCwgZXJyb3IpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBDcmVhdGVkIG1lc3NhZ2VzIGZvciBuZXcgbWVtYmVyICR7bWVtYmVySWR9YCkpXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBtZXNzYWdlcyBmb3IgbmV3IG1lbWJlciAke21lbWJlcklkfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ01lbWJlciBBZGRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gYWRkZWQgJHtwaG9uZU51bWJlcn0gdG8gZ3JvdXAgJHtncm91cElkfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBhZGRpbmcgbWVtYmVyIHRvIGdyb3VwOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBhZGRpbmcgdGhlIG1lbWJlciB0byB0aGUgZ3JvdXAnIH0pO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnJlbW92ZU1lbWJlcicsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZ3JvdXBJZCwgcGhvbmVOdW1iZXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICBjb25zdCBtZW1iZXJJZFRvUmVtb3ZlID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgaWYgKCFtZW1iZXJJZFRvUmVtb3ZlKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICBpZiAoIWdyb3VwIHx8ICFncm91cC5tZW1iZXJzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgbWVtYmVySW5kZXggPSBncm91cC5tZW1iZXJzLmluZGV4T2YobWVtYmVySWRUb1JlbW92ZSk7XG4gICAgaWYgKG1lbWJlckluZGV4ID09PSAtMSkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lbWJlciBub3QgaW4gZ3JvdXAnIH0pO1xuICAgIH1cblxuICAgIGdyb3VwLm1lbWJlcnMuc3BsaWNlKG1lbWJlckluZGV4LCAxKTtcbiAgICBncm91cC5tZW1iZXJQaG9uZU51bWJlcnMuc3BsaWNlKG1lbWJlckluZGV4LCAxKTtcblxuICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycykge1xuICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKG1lbWJlckdyb3VwKSB7XG4gICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJzID0gZ3JvdXAubWVtYmVycztcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLm1lbWJlclBob25lTnVtYmVycyA9IGdyb3VwLm1lbWJlclBob25lTnVtYmVycztcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLmF2YXRhciA9IGdyb3VwLmF2YXRhcjsgLy8gRW5zdXJlIGF2YXRhciBpcyBjb3BpZWRcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLmNyZWF0b3JJZCA9IGdyb3VwLmNyZWF0b3JJZDsgLy8gRW5zdXJlIGNyZWF0b3JJZCBpcyBjb3BpZWRcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZFRvUmVtb3ZlIH0pO1xuICAgIGlmIChyZW1vdmVkTWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgY29uc3QgZ3JvdXBJbmRleCA9IHJlbW92ZWRNZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kSW5kZXgoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKGdyb3VwSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICByZW1vdmVkTWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuc3BsaWNlKGdyb3VwSW5kZXgsIDEpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHJlbW92ZWRNZW1iZXJNZXNzYWdlcy5faWQgfSwgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgIHRpdGxlOiAnTWVtYmVyIFJlbW92ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gcmVtb3ZlZCAke3Bob25lTnVtYmVyfSBmcm9tIGdyb3VwICR7Z3JvdXBJZH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmRlbGV0ZUdyb3VwJywgYXN5bmMgKGNsaWVudCwgZ3JvdXBJZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBjb25zdCBncm91cCA9IHVzZXJNZXNzYWdlcz8ubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgIGlmICghZ3JvdXAgfHwgIWdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQgb3IgdW5hdXRob3JpemVkJyB9KTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiB0aGUgc2VuZGVyIGlzIHRoZSBncm91cCBjcmVhdG9yIChhZG1pbilcbiAgICBpZiAoZ3JvdXAuY3JlYXRvcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ09ubHkgdGhlIGdyb3VwIGNyZWF0b3IgY2FuIGRlbGV0ZSB0aGUgZ3JvdXAnIH0pO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycykge1xuICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkdyb3VwIGhhcyBiZWVuIGRlbGV0ZWRcIixcbiAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBjb25zdCBncm91cEluZGV4ID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZEluZGV4KChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICBpZiAoZ3JvdXBJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5zcGxpY2UoZ3JvdXBJbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICB0aXRsZTogJ0dyb3VwIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJHtncm91cElkfSBkZWxldGVkIGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0R3JvdXBNZXNzYWdlcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZ3JvdXBJZCwgcGFnZSA9IDEsIGxpbWl0ID0gMjAgfSA9IEpTT04ucGFyc2UoZGF0YSk7IC8vIEFkZCBwYWdlIGFuZCBsaW1pdCBmb3IgcGFnaW5hdGlvblxuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnTm8gbWVzc2FnZXMgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBncm91cElkPzogc3RyaW5nIH0pID0+XG4gICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5ncm91cElkID09PSBncm91cElkKTtcblxuICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlczogW10sIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICAvLyBTb3J0IG1lc3NhZ2VzIGJ5IHRpbWVzdGFtcCAoZGVzY2VuZGluZykgYW5kIHBhZ2luYXRlXG4gICAgY29uc3Qgc29ydGVkTWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+XG4gICAgICAgIG5ldyBEYXRlKGIudGltZXN0YW1wKS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLnRpbWVzdGFtcCkuZ2V0VGltZSgpXG4gICAgKTtcblxuICAgIGNvbnN0IHN0YXJ0SW5kZXggPSAocGFnZSAtIDEpICogbGltaXQ7XG4gICAgY29uc3QgZW5kSW5kZXggPSBzdGFydEluZGV4ICsgbGltaXQ7XG4gICAgY29uc3QgcGFnaW5hdGVkTWVzc2FnZXMgPSBzb3J0ZWRNZXNzYWdlcy5zbGljZShzdGFydEluZGV4LCBlbmRJbmRleCk7XG5cbiAgICBjb25zdCBoYXNNb3JlID0gZW5kSW5kZXggPCBzb3J0ZWRNZXNzYWdlcy5sZW5ndGg7XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlczogcGFnaW5hdGVkTWVzc2FnZXMsXG4gICAgICAgIG1lbWJlclBob25lTnVtYmVyczogY29udmVyc2F0aW9uLm1lbWJlclBob25lTnVtYmVycyB8fCBbXSxcbiAgICAgICAgbmFtZTogY29udmVyc2F0aW9uLm5hbWUsXG4gICAgICAgIGF2YXRhcjogY29udmVyc2F0aW9uLmF2YXRhciB8fCBudWxsLFxuICAgICAgICBoYXNNb3JlOiBoYXNNb3JlLFxuICAgICAgICB0b3RhbE1lc3NhZ2VzOiBzb3J0ZWRNZXNzYWdlcy5sZW5ndGgsXG4gICAgICAgIGNyZWF0b3JJZDogY29udmVyc2F0aW9uLmNyZWF0b3JJZCAvLyBJbmNsdWRlIGNyZWF0b3JJZCBmb3IgVUkgb3IgdmVyaWZpY2F0aW9uIGlmIG5lZWRlZFxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0UHJpdmF0ZU1lc3NhZ2VzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBwaG9uZU51bWJlciwgcGFnZSA9IDEsIGxpbWl0ID0gMjAgfSA9IEpTT04ucGFyc2UoZGF0YSk7IC8vIEFkZCBwYWdlIGFuZCBsaW1pdCBmb3IgcGFnaW5hdGlvblxuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnTm8gbWVzc2FnZXMgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBwaG9uZU51bWJlcj86IHN0cmluZyB9KSA9PlxuICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIG1zZy5waG9uZU51bWJlciA9PT0gcGhvbmVOdW1iZXIpO1xuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ0NvbnZlcnNhdGlvbiBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIC8vIFNvcnQgbWVzc2FnZXMgYnkgdGltZXN0YW1wIChkZXNjZW5kaW5nKSBhbmQgcGFnaW5hdGVcbiAgICBjb25zdCBzb3J0ZWRNZXNzYWdlcyA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlcy5zb3J0KChhOiBhbnksIGI6IGFueSkgPT5cbiAgICAgICAgbmV3IERhdGUoYi50aW1lc3RhbXApLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEudGltZXN0YW1wKS5nZXRUaW1lKClcbiAgICApO1xuXG4gICAgY29uc3Qgc3RhcnRJbmRleCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcbiAgICBjb25zdCBlbmRJbmRleCA9IHN0YXJ0SW5kZXggKyBsaW1pdDtcbiAgICBjb25zdCBwYWdpbmF0ZWRNZXNzYWdlcyA9IHNvcnRlZE1lc3NhZ2VzLnNsaWNlKHN0YXJ0SW5kZXgsIGVuZEluZGV4KTtcbiAgICBjb25zdCBoYXNNb3JlID0gZW5kSW5kZXggPCBzb3J0ZWRNZXNzYWdlcy5sZW5ndGg7XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlczogcGFnaW5hdGVkTWVzc2FnZXMsXG4gICAgICAgIGF2YXRhcjogY29udmVyc2F0aW9uLmF2YXRhciB8fCBudWxsLFxuICAgICAgICBuYW1lOiBjb252ZXJzYXRpb24ubmFtZSxcbiAgICAgICAgaGFzTW9yZTogaGFzTW9yZSxcbiAgICAgICAgdG90YWxNZXNzYWdlczogc29ydGVkTWVzc2FnZXMubGVuZ3RoXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpnZXRNZXNzYWdlQ2hhbm5lbHNhbmRMYXN0TWVzc2FnZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG5cbiAgICAgICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ05vIG1lc3NhZ2VzIGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNoYW5uZWxzID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLm1hcChhc3luYyAobXNnOiB7IHR5cGU6IHN0cmluZywgbmFtZTogc3RyaW5nLCBwaG9uZU51bWJlcj86IHN0cmluZywgYXZhdGFyOiBzdHJpbmcsIGdyb3VwSWQ/OiBzdHJpbmcsIG1lbWJlcnM/OiBzdHJpbmdbXSwgbWVtYmVyUGhvbmVOdW1iZXJzPzogc3RyaW5nW10sIG1lc3NhZ2VzOiBhbnlbXSwgY3JlYXRvcklkPzogc3RyaW5nIH0pID0+IHtcbiAgICAgICAgICAgIGxldCB1cGRhdGVkTmFtZSA9IG1zZy5uYW1lO1xuICAgICAgICAgICAgbGV0IHVwZGF0ZWRNZW1iZXJQaG9uZU51bWJlcnMgPSBtc2cubWVtYmVyUGhvbmVOdW1iZXJzIHx8IFtdO1xuXG4gICAgICAgICAgICAvLyBIYW5kbGUgcHJpdmF0ZSBjb252ZXJzYXRpb25zXG4gICAgICAgICAgICBpZiAobXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtc2cucGhvbmVOdW1iZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIobXNnLnBob25lTnVtYmVyLCBzZW5kZXJJZCkgfHwgYFVua25vd24gKCR7bXNnLnBob25lTnVtYmVyfSlgO1xuICAgICAgICAgICAgICAgIGlmIChuZXdDb250YWN0TmFtZSAhPT0gbXNnLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBuYW1lIGluIHRoZSBkYXRhYmFzZSBpZiBpdCBoYXMgY2hhbmdlZFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobTogYW55KSA9PiBtLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtLnBob25lTnVtYmVyID09PSBtc2cucGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb252ZXJzYXRpb24ubmFtZSA9IG5ld0NvbnRhY3ROYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGNvbnRhY3QgbmFtZSBmb3IgJHttc2cucGhvbmVOdW1iZXJ9IHRvICR7bmV3Q29udGFjdE5hbWV9YCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGNvbnRhY3QgbmFtZSBmb3IgJHttc2cucGhvbmVOdW1iZXJ9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlZE5hbWUgPSBuZXdDb250YWN0TmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBIYW5kbGUgZ3JvdXAgY29udmVyc2F0aW9uc1xuICAgICAgICAgICAgZWxzZSBpZiAobXNnLnR5cGUgPT09ICdncm91cCcgJiYgbXNnLm1lbWJlclBob25lTnVtYmVycyAmJiBtc2cubWVtYmVyUGhvbmVOdW1iZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1zZy5tZW1iZXJQaG9uZU51bWJlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGhvbmUgPSBtc2cubWVtYmVyUGhvbmVOdW1iZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdDb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIocGhvbmUsIHNlbmRlcklkKSB8fCBgVW5rbm93biAoJHtwaG9uZX0pYDtcbiAgICAgICAgICAgICAgICAgICAgLy8gWW91IGNvdWxkIHVwZGF0ZSBpbmRpdmlkdWFsIG1lbWJlciBuYW1lcyBoZXJlIGlmIG5lZWRlZCwgYnV0IGZvciBncm91cCBuYW1lLCB3ZSBrZWVwIGl0IGFzLWlzIHVubGVzcyBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gT3B0aW9uYWxseSwgeW91IGNvdWxkIGFnZ3JlZ2F0ZSBtZW1iZXIgbmFtZXMgaW50byB0aGUgZ3JvdXAgbmFtZSBpZiBkZXNpcmVkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IG1zZy50eXBlLFxuICAgICAgICAgICAgICAgIG5hbWU6IHVwZGF0ZWROYW1lLFxuICAgICAgICAgICAgICAgIHBob25lTnVtYmVyOiBtc2cucGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgZ3JvdXBJZDogbXNnLmdyb3VwSWQsXG4gICAgICAgICAgICAgICAgbWVtYmVyczogbXNnLm1lbWJlcnMsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiBtc2cuYXZhdGFyLFxuICAgICAgICAgICAgICAgIG1lbWJlclBob25lTnVtYmVyczogdXBkYXRlZE1lbWJlclBob25lTnVtYmVycyxcbiAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogbXNnLm1lc3NhZ2VzW21zZy5tZXNzYWdlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICBjcmVhdG9ySWQ6IG1zZy5jcmVhdG9ySWQgLy8gSW5jbHVkZSBjcmVhdG9ySWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdhaXQgZm9yIGFsbCBwcm9taXNlcyB0byByZXNvbHZlXG4gICAgICAgIGNvbnN0IHJlc29sdmVkQ2hhbm5lbHMgPSBhd2FpdCBQcm9taXNlLmFsbChjaGFubmVscyk7XG5cbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgY2hhbm5lbHM6IHJlc29sdmVkQ2hhbm5lbHMgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgbWVzc2FnZSBjaGFubmVscyBhbmQgbGFzdCBtZXNzYWdlczonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgbWVzc2FnZSBjaGFubmVscycgfSk7XG4gICAgfVxufSk7XG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmdldE1lc3NhZ2VTdGF0cycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgICAgICBhbGxNZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICBrbm93bk1lc3NhZ2VzOiAwLFxuICAgICAgICAgICAgICAgIHVua25vd25NZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICB1bnJlYWRNZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICByZWNlbnRseURlbGV0ZWQ6IDBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY3VycmVudERhdGUgPSBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IHRoaXJ0eURheXNBZ28gPSBuZXcgRGF0ZShjdXJyZW50RGF0ZS5nZXRUaW1lKCkgLSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDApOyAvLyAzMCBkYXlzIGFnb1xuXG4gICAgbGV0IGFsbE1lc3NhZ2VzID0gMDtcbiAgICBsZXQga25vd25NZXNzYWdlcyA9IDA7XG4gICAgbGV0IHVua25vd25NZXNzYWdlcyA9IDA7XG4gICAgbGV0IHVucmVhZE1lc3NhZ2VzID0gMDtcbiAgICBsZXQgcmVjZW50bHlEZWxldGVkID0gMDtcblxuICAgIGZvciAoY29uc3QgY29udmVyc2F0aW9uIG9mIHVzZXJNZXNzYWdlcy5tZXNzYWdlcykge1xuICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgY29udmVyc2F0aW9uLm1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBhbGxNZXNzYWdlcyArPSAxO1xuXG4gICAgICAgICAgICBjb25zdCBpc0tub3duID0gY29udmVyc2F0aW9uLm5hbWUgJiYgIWNvbnZlcnNhdGlvbi5uYW1lLm1hdGNoKC9eWzAtOSFAIyQlXiYqKClfK1xcLT1cXFtcXF17fTsnOlwiXFxcXHwsLjw+XFwvP10qJC8pO1xuICAgICAgICAgICAgaWYgKGlzS25vd24pIHtcbiAgICAgICAgICAgICAgICBrbm93bk1lc3NhZ2VzICs9IDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVua25vd25NZXNzYWdlcyArPSAxO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UucmVhZCkge1xuICAgICAgICAgICAgICAgIHVucmVhZE1lc3NhZ2VzICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodXNlck1lc3NhZ2VzLmRlbGV0ZWRNZXNzYWdlcykge1xuICAgICAgICByZWNlbnRseURlbGV0ZWQgPSB1c2VyTWVzc2FnZXMuZGVsZXRlZE1lc3NhZ2VzLmZpbHRlcigoZGVsZXRlZDogYW55KSA9PlxuICAgICAgICAgICAgZGVsZXRlZC50aW1lc3RhbXAgPiB0aGlydHlEYXlzQWdvXG4gICAgICAgICkubGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhbGxNZXNzYWdlcyxcbiAgICAgICAgICAgIGtub3duTWVzc2FnZXMsXG4gICAgICAgICAgICB1bmtub3duTWVzc2FnZXMsXG4gICAgICAgICAgICB1bnJlYWRNZXNzYWdlcyxcbiAgICAgICAgICAgIHJlY2VudGx5RGVsZXRlZFxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpkZWxldGVNZXNzYWdlJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBjb252ZXJzYXRpb25UeXBlLCBwaG9uZU51bWJlciwgZ3JvdXBJZCwgbWVzc2FnZUluZGV4IH0gPSBKU09OLnBhcnNlKGRhdGEgfHwgJ3t9Jyk7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVzc2FnZXMgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBsZXQgY29udmVyc2F0aW9uOiBhbnk7XG4gICAgaWYgKGNvbnZlcnNhdGlvblR5cGUgPT09ICdwcml2YXRlJyAmJiBwaG9uZU51bWJlcikge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiBhbnkpID0+XG4gICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIE51bWJlcihtc2cucGhvbmVOdW1iZXIpID09PSBOdW1iZXIocGhvbmVOdW1iZXIpXG4gICAgICAgICk7XG4gICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb25UeXBlID09PSAnZ3JvdXAnICYmIGdyb3VwSWQpIHtcbiAgICAgICAgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgU3RyaW5nKG1zZy5ncm91cElkKSA9PT0gU3RyaW5nKGdyb3VwSWQpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb252ZXJzYXRpb24ubWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuZmlsdGVyKChtc2c6IGFueSkgPT4gTnVtYmVyKG1zZy5wYWdlKSAhPT0gTnVtYmVyKG1lc3NhZ2VJbmRleCkpO1xuXG4gICAgLy8gUGVyc2lzdCBsb2NhbCBjaGFuZ2VcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuXG4gICAgLy8gQXR0ZW1wdCByZW1vdGUgZGVsZXRlIG9ubHkgZm9yIHByaXZhdGUgY29udmVyc2F0aW9ucyBhbmQgd2hlbiB0YXJnZXQgZXhpc3RzXG4gICAgaWYgKGNvbnZlcnNhdGlvblR5cGUgPT09ICdwcml2YXRlJyAmJiBwaG9uZU51bWJlcikge1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKHRhcmdldENpdGl6ZW5JZCkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U291cmNlID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZCh0YXJnZXRDaXRpemVuSWQpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldENvbnZlcnNhdGlvbiA9IHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIE51bWJlcihtc2cucGhvbmVOdW1iZXIpID09PSBOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Q29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcyA9IHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcy5maWx0ZXIoKG1zZzogYW55KSA9PiBOdW1iZXIobXNnLnBhZ2UpICE9PSBOdW1iZXIobWVzc2FnZUluZGV4KSk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB0YXJnZXRNZXNzYWdlcy5faWQgfSwgdGFyZ2V0TWVzc2FnZXMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXdhaXQgRG9lc1BsYXllckV4aXN0KHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lX21lc3NhZ2VzOmNsaWVudDp1cGRhdGVNZXNzYWdlcycsIE51bWJlcih0YXJnZXRTb3VyY2UpLCBKU09OLnN0cmluZ2lmeSh0YXJnZXRNZXNzYWdlcykpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZW1pdE5ldCgncGhvbmVfbWVzc2FnZXM6Y2xpZW50OnVwZGF0ZU1lc3NhZ2VzJywgTnVtYmVyKGNsaWVudCksIEpTT04uc3RyaW5naWZ5KHVzZXJNZXNzYWdlcykpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWVzc2FnZXMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBNZXNzYWdlIGRlbGV0ZWQgZnJvbSAke2NvbnZlcnNhdGlvblR5cGV9IGNvbnZlcnNhdGlvbiB3aXRoICR7cGhvbmVOdW1iZXIgfHwgZ3JvdXBJZH0gYnkgJHtzZW5kZXJQaG9uZU51bWJlcn1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnVwZGF0ZUdyb3VwTmFtZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgZ3JvdXBJZCwgbmV3TmFtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICAgICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVzc2FnZXMgbm90IGZvdW5kIGZvciBzZW5kZXInIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcsIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXApIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChncm91cC5jcmVhdG9ySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ09ubHkgdGhlIGdyb3VwIGNyZWF0b3IgY2FuIHVwZGF0ZSB0aGUgZ3JvdXAgbmFtZScgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2xkTmFtZSA9IGdyb3VwLm5hbWU7XG4gICAgICAgIGdyb3VwLm5hbWUgPSBuZXdOYW1lO1xuXG4gICAgICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycyB8fCBbXSkge1xuICAgICAgICAgICAgY29uc3QgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICAgICAgaWYgKG1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVtYmVyR3JvdXAgPSBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICAgICAgaWYgKG1lbWJlckdyb3VwKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLm5hbWUgPSBuZXdOYW1lO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogbWVtYmVyTWVzc2FnZXMuX2lkIH0sIG1lbWJlck1lc3NhZ2VzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgbmFtZSBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgZ3JvdXAgbmFtZSBmb3IgbWVtYmVyICR7bWVtYmVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBHcm91cCBub3QgZm91bmQgaW4gbWVtYmVyICR7bWVtYmVySWR9J3MgbWVzc2FnZXNgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gbWVzc2FnZXMgZm91bmQgZm9yIG1lbWJlciAke21lbWJlcklkfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgbmFtZSBmb3Igc2VuZGVyICR7c2VuZGVySWR9YCkpXG4gICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgZ3JvdXAgbmFtZSBmb3Igc2VuZGVyICR7c2VuZGVySWR9OmAsIGVycm9yKSk7XG5cbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZ3JvdXBzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnR3JvdXAgTmFtZSBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBHcm91cCAke2dyb3VwSWR9IHwgJHtvbGROYW1lfSBuYW1lIHVwZGF0ZWQgdG8gJHtuZXdOYW1lfSBieSAke3NlbmRlclBob25lTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGRhdGluZyBncm91cCBuYW1lOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSB1cGRhdGluZyB0aGUgZ3JvdXAgbmFtZScgfSk7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6dXBkYXRlR3JvdXBBdmF0YXInLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGdyb3VwSWQsIG5ld0F2YXRhciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCB0aGUgc2VuZGVyJ3MgbWVzc2FnZXMgdG8gZmluZCB0aGUgZ3JvdXBcbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBjcmVhdG9ySWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWdyb3VwKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgc2VuZGVyIGlzIHRoZSBncm91cCBjcmVhdG9yIChhZG1pbilcbiAgICAgICAgaWYgKGdyb3VwLmNyZWF0b3JJZCAhPT0gc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnT25seSB0aGUgZ3JvdXAgY3JlYXRvciBjYW4gdXBkYXRlIHRoZSBncm91cCBhdmF0YXInIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBncm91cCBhdmF0YXIgZm9yIHRoZSBzZW5kZXJcbiAgICAgICAgZ3JvdXAuYXZhdGFyID0gbmV3QXZhdGFyO1xuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgZ3JvdXAgYXZhdGFyIGZvciBhbGwgbWVtYmVyc1xuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMgfHwgW10pIHtcbiAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgIGlmIChtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIGlmIChtZW1iZXJHcm91cCkge1xuICAgICAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5hdmF0YXIgPSBuZXdBdmF0YXI7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBhdmF0YXIgZm9yIG1lbWJlciAke21lbWJlcklkfWApKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIGF2YXRhciBmb3IgbWVtYmVyICR7bWVtYmVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBHcm91cCBub3QgZm91bmQgaW4gbWVtYmVyICR7bWVtYmVySWR9J3MgbWVzc2FnZXNgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gbWVzc2FnZXMgZm91bmQgZm9yIG1lbWJlciAke21lbWJlcklkfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBzZW5kZXIncyBtZXNzYWdlc1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpXG4gICAgICAgICAgICAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBhdmF0YXIgZm9yIHNlbmRlciAke3NlbmRlcklkfWApKVxuICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIGF2YXRhciBmb3Igc2VuZGVyICR7c2VuZGVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ0dyb3VwIEF2YXRhciBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBHcm91cCAke2dyb3VwSWR9IGF2YXRhciB1cGRhdGVkIGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIGdyb3VwIGF2YXRhcjonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdXBkYXRpbmcgdGhlIGdyb3VwIGF2YXRhcicgfSk7XG4gICAgfVxufSk7IiwgImltcG9ydCB7IE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGxheWVyQ2FsbEhpc3Rvcnkge1xuICBjYWxsSWQ6IG51bWJlcjtcbiAgcm9sZTogXCJjYWxsZXJcIiB8IFwiY2FsbGVlXCI7XG4gIG15UGhvbmVOdW1iZXI6IHN0cmluZztcbiAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBzdHJpbmc7XG4gIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIgfCBcIm1pc3NlZFwiIHwgXCJkZWNsaW5lZFwiIHwgXCJjb21wbGV0ZWRcIjtcbiAgY2FsbFRpbWU6IG51bWJlcjtcbiAgY2FsbFRpbWVzdGFtcDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgQ2FsbEhpc3RvcnlNYW5hZ2VyIHtcbiAgYXN5bmMgcmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShcbiAgICBjYWxsOiB7XG4gICAgICBjYWxsSWQ6IG51bWJlcjtcbiAgICAgIGhvc3Q6IHsgY2l0aXplbklkOiBzdHJpbmc7IHBob25lTnVtYmVyOiBzdHJpbmcgfTtcbiAgICAgIHBhcnRpY2lwYW50czogTWFwPG51bWJlciwgeyBjaXRpemVuSWQ6IHN0cmluZzsgcGhvbmVOdW1iZXI6IHN0cmluZzsgb25Ib2xkOiBib29sZWFuIH0+O1xuICAgICAgc3RhcnRUaW1lOiBEYXRlO1xuICAgIH0sXG4gICAgY2FsbGVyU3RhdHVzOiBcInVuYW5zd2VyZWRcIiB8IFwiZGVjbGluZWRcIiB8IFwiY29tcGxldGVkXCIsXG4gICAgY2FsbGVlU3RhdHVzOiBcIm1pc3NlZFwiIHwgXCJkZWNsaW5lZFwiIHwgXCJjb21wbGV0ZWRcIixcbiAgICBlbmRUaW1lOiBEYXRlLFxuICAgIHRhcmdldFBob25lTnVtYmVyPzogc3RyaW5nXG4gICkge1xuICAgIGNvbnN0IGNhbGxUaW1lID0gKGVuZFRpbWUuZ2V0VGltZSgpIC0gY2FsbC5zdGFydFRpbWUuZ2V0VGltZSgpKSAvIDEwMDA7XG4gICAgY29uc3QgdGltZXN0YW1wID0gZW5kVGltZS50b0lTT1N0cmluZygpO1xuXG4gICAgLy8gRmlsdGVyIG91dCB0aGUgaG9zdCBmcm9tIHBhcnRpY2lwYW50cyB0byB0cnkgdG8gZ2V0IHRoZSBjYWxsZWUuXG4gICAgY29uc3QgY2FsbGVlQXJyYXkgPSBBcnJheS5mcm9tKGNhbGwucGFydGljaXBhbnRzLnZhbHVlcygpKS5maWx0ZXIoXG4gICAgICAocGFydGljaXBhbnQpID0+IHBhcnRpY2lwYW50LnBob25lTnVtYmVyICE9PSBjYWxsLmhvc3QucGhvbmVOdW1iZXJcbiAgICApO1xuXG4gICAgbGV0IGNhbGxlZVBob25lOiBzdHJpbmc7XG4gICAgaWYgKGNhbGxlZUFycmF5Lmxlbmd0aCA8IDEpIHtcbiAgICAgIC8vIElmIHRoZSBjYWxsZWUgbmV2ZXIgam9pbmVkLCB1c2UgdGhlIHBhc3NlZCB0YXJnZXRQaG9uZU51bWJlci5cbiAgICAgIGlmICh0YXJnZXRQaG9uZU51bWJlcikge1xuICAgICAgICBjYWxsZWVQaG9uZSA9IHRhcmdldFBob25lTnVtYmVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIk5vIGNhbGxlZSBmb3VuZCBmb3IgdHdvLXBhcnR5IGNhbGwgYWZ0ZXIgZmlsdGVyaW5nIG91dCBob3N0XCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxlZVBob25lID0gY2FsbGVlQXJyYXlbMF0ucGhvbmVOdW1iZXI7XG4gICAgfVxuXG4gICAgY29uc3QgY2FsbGVyUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogY2FsbC5jYWxsSWQsXG4gICAgICByb2xlOiBcImNhbGxlclwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogY2FsbC5ob3N0LnBob25lTnVtYmVyLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBjYWxsZWVQaG9uZSxcbiAgICAgIHN0YXR1czogY2FsbGVyU3RhdHVzLFxuICAgICAgY2FsbFRpbWUsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcblxuICAgIGNvbnN0IGNhbGxlZVJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IGNhbGwuY2FsbElkLFxuICAgICAgcm9sZTogXCJjYWxsZWVcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IGNhbGxlZVBob25lLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBjYWxsLmhvc3QucGhvbmVOdW1iZXIsXG4gICAgICBzdGF0dXM6IGNhbGxlZVN0YXR1cyxcbiAgICAgIGNhbGxUaW1lLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVyUmVjb3JkKTtcbiAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlZVJlY29yZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcmVjb3JkIHR3by1wYXJ0eSBjYWxsIGhpc3Rvcnk6XCIsIGVycm9yKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRQbGF5ZXJDYWxsSGlzdG9yeShwaG9uZU51bWJlcjogc3RyaW5nLCBtYXhSZWNvcmRzOiBudW1iZXIpOiBQcm9taXNlPFBsYXllckNhbGxIaXN0b3J5W10+IHtcbiAgICBjb25zdCBxdWVyeSA9IHsgbXlQaG9uZU51bWJlcjogcGhvbmVOdW1iZXIgfTtcbiAgICBjb25zdCBvcHRpb25zID0geyBzb3J0OiB7IF9pZDogLTEgfSwgbGltaXQ6IG1heFJlY29yZHMgfTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwiY2FsbF9oaXN0b3J5XCIsIHF1ZXJ5LCAoKSA9PiB7IH0sIGZhbHNlLCBvcHRpb25zKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciByZXRyaWV2aW5nIGNhbGwgaGlzdG9yeSBmb3IgcGhvbmUgbnVtYmVyOlwiLCBwaG9uZU51bWJlciwgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgY2FsbEhpc3RvcnlNYW5hZ2VyID0gbmV3IENhbGxIaXN0b3J5TWFuYWdlcigpO1xuIiwgImltcG9ydCB7IGNhbGxIaXN0b3J5TWFuYWdlciB9IGZyb20gXCIuL2NhbGxIaXN0b3J5TWFuYWdlclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhbGxQYXJ0aWNpcGFudCB7XG4gICAgc291cmNlOiBudW1iZXI7XG4gICAgY2l0aXplbklkOiBzdHJpbmc7XG4gICAgcGhvbmVOdW1iZXI6IHN0cmluZztcbiAgICBvbkhvbGQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT25nb2luZ0NhbGwge1xuICAgIGNhbGxJZDogbnVtYmVyO1xuICAgIGhvc3Q6IENhbGxQYXJ0aWNpcGFudDtcbiAgICBwYXJ0aWNpcGFudHM6IE1hcDxudW1iZXIsIENhbGxQYXJ0aWNpcGFudD47XG4gICAgcGVuZGluZzogTWFwPG51bWJlciwgTm9kZUpTLlRpbWVvdXQ+O1xuICAgIHN0YXJ0VGltZTogRGF0ZTtcbn1cblxuY2xhc3MgQ2FsbE1hbmFnZXIge1xuICAgIHByaXZhdGUgY2FsbHMgPSBuZXcgTWFwPG51bWJlciwgT25nb2luZ0NhbGw+KCk7XG4gICAgcHJpdmF0ZSBwbGF5ZXJDYWxsTWFwID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcbiAgICBwcml2YXRlIHJpbmdUb25lTWFuZ2VyID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcblxuICAgIHB1YmxpYyBjcmVhdGVDYWxsKGhvc3Q6IENhbGxQYXJ0aWNpcGFudCk6IG51bWJlciB7XG4gICAgICAgIGNvbnN0IGNhbGxJZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApO1xuICAgICAgICBjb25zdCBuZXdDYWxsOiBPbmdvaW5nQ2FsbCA9IHtcbiAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgIGhvc3QsXG4gICAgICAgICAgICBwYXJ0aWNpcGFudHM6IG5ldyBNYXA8bnVtYmVyLCBDYWxsUGFydGljaXBhbnQ+KCksXG4gICAgICAgICAgICBwZW5kaW5nOiBuZXcgTWFwPG51bWJlciwgTm9kZUpTLlRpbWVvdXQ+KCksXG4gICAgICAgICAgICBzdGFydFRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIH07XG4gICAgICAgIG5ld0NhbGwucGFydGljaXBhbnRzLnNldChob3N0LnNvdXJjZSwgaG9zdCk7XG4gICAgICAgIHRoaXMuY2FsbHMuc2V0KGNhbGxJZCwgbmV3Q2FsbCk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5zZXQoaG9zdC5zb3VyY2UsIGNhbGxJZCk7XG4gICAgICAgIHJldHVybiBjYWxsSWQ7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRDYWxsSG9zdChjYWxsSWQ6IG51bWJlcik6IENhbGxQYXJ0aWNpcGFudCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgcmV0dXJuIGNhbGwuaG9zdDtcbiAgICB9XG4gICAgcHVibGljIGlzUGxheWVySW5DYWxsKHNvdXJjZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXllckNhbGxNYXAuaGFzKHNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRDYWxsQnlQbGF5ZXIoc291cmNlOiBudW1iZXIpOiBPbmdvaW5nQ2FsbCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGNhbGxJZCA9IHRoaXMucGxheWVyQ2FsbE1hcC5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKGNhbGxJZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcHVibGljIGdldENhbGxJZEJ5UGxheWVyKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXllckNhbGxNYXAuZ2V0KHNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBhZGRQZW5kaW5nSW52aXRhdGlvbihcbiAgICAgICAgY2FsbElkOiBudW1iZXIsXG4gICAgICAgIHRhcmdldFNvdXJjZTogbnVtYmVyLFxuICAgICAgICB0aW1lb3V0Q2FsbGJhY2s6ICgpID0+IHZvaWQsXG4gICAgICAgIHRpbWVvdXRNczogbnVtYmVyID0gMzAwMDBcbiAgICApIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuO1xuICAgICAgICBpZiAoY2FsbC5wZW5kaW5nLmhhcyh0YXJnZXRTb3VyY2UpIHx8IGNhbGwucGFydGljaXBhbnRzLmhhcyh0YXJnZXRTb3VyY2UpKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRpbWVvdXRDYWxsYmFjaygpO1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSk7XG4gICAgICAgIH0sIHRpbWVvdXRNcyk7XG4gICAgICAgIGNhbGwucGVuZGluZy5zZXQodGFyZ2V0U291cmNlLCB0aW1lb3V0KTtcbiAgICB9XG4gICAgcHVibGljIHJlbW92ZVBlbmRpbmdJbnZpdGF0aW9uKGNhbGxJZDogbnVtYmVyLCB0YXJnZXRTb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm47XG4gICAgICAgIGlmIChjYWxsLnBlbmRpbmcuaGFzKHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjYWxsLnBlbmRpbmcuZ2V0KHRhcmdldFNvdXJjZSkpO1xuICAgICAgICAgICAgY2FsbC5wZW5kaW5nLmRlbGV0ZSh0YXJnZXRTb3VyY2UpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHB1YmxpYyBhY2NlcHRJbnZpdGF0aW9uKGNhbGxJZDogbnVtYmVyLCBwYXJ0aWNpcGFudDogQ2FsbFBhcnRpY2lwYW50KTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKGNhbGwucGFydGljaXBhbnRzLmhhcyhwYXJ0aWNpcGFudC5zb3VyY2UpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNhbGwucGFydGljaXBhbnRzLnNldChwYXJ0aWNpcGFudC5zb3VyY2UsIHBhcnRpY2lwYW50KTtcbiAgICAgICAgdGhpcy5wbGF5ZXJDYWxsTWFwLnNldChwYXJ0aWNpcGFudC5zb3VyY2UsIGNhbGxJZCk7XG4gICAgICAgIGlmIChjYWxsLnBlbmRpbmcuaGFzKHBhcnRpY2lwYW50LnNvdXJjZSkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjYWxsLnBlbmRpbmcuZ2V0KHBhcnRpY2lwYW50LnNvdXJjZSkpO1xuICAgICAgICAgICAgY2FsbC5wZW5kaW5nLmRlbGV0ZShwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBwdWJsaWMgZGVjbGluZUludml0YXRpb24oY2FsbElkOiBudW1iZXIsIHRhcmdldFNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICAgIH1cbiAgICBwdWJsaWMgYXN5bmMgcmVtb3ZlUGFydGljaXBhbnQoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcblxuICAgICAgICAvLyBORVc6IEVuZCBhbmltYXRpb24gZm9yIHRoZSBsZWF2aW5nIHBhcnRpY2lwYW50XG4gICAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBzb3VyY2UpO1xuXG4gICAgICAgIGNhbGwucGFydGljaXBhbnRzLmRlbGV0ZShzb3VyY2UpO1xuICAgICAgICB0aGlzLnBsYXllckNhbGxNYXAuZGVsZXRlKHNvdXJjZSk7XG4gICAgICAgIGlmIChzb3VyY2UgPT09IGNhbGwuaG9zdC5zb3VyY2UgfHwgY2FsbC5wYXJ0aWNpcGFudHMuc2l6ZSA8PSAxKSB7XG4gICAgICAgICAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpKTtcbiAgICAgICAgICAgIHRoaXMuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHB1YmxpYyBlbmRDYWxsKGNhbGxJZDogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcblxuICAgICAgICAvLyBORVc6IEVuZCBhbmltYXRpb25zIGZvciBhbGwgcGFydGljaXBhbnRzXG4gICAgICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCB0aW1lb3V0IG9mIGNhbGwucGVuZGluZy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5kZWxldGUocGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNhbGxzLmRlbGV0ZShjYWxsSWQpO1xuICAgIH1cbiAgICBwdWJsaWMgcmVtb3ZlRnJvbUNhbGwoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgY2FsbC5wYXJ0aWNpcGFudHMuZGVsZXRlKHNvdXJjZSk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5kZWxldGUoc291cmNlKTtcbiAgICB9XG4gICAgcHVibGljIHNldEhvbGRTdGF0dXMoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyLCBob2xkOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgcGFydGljaXBhbnQgPSBjYWxsLnBhcnRpY2lwYW50cy5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKCFwYXJ0aWNpcGFudCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBwYXJ0aWNpcGFudC5vbkhvbGQgPSBob2xkO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcHVibGljIGdldFBhcnRpY2lwYW50cyhjYWxsSWQ6IG51bWJlcik6IENhbGxQYXJ0aWNpcGFudFtdIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuIFtdO1xuICAgICAgICByZXR1cm4gQXJyYXkuZnJvbShjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSk7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRBbGxDYWxscygpOiBJdGVyYWJsZUl0ZXJhdG9yPE9uZ29pbmdDYWxsPiB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhbGxzLnZhbHVlcygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBjcmVhdGVSaW5nVG9uZShzb3VyY2U6IGFueSwgcmluZ3RvbmVMaW5rOiBzdHJpbmcsIHZvbHVtZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHBlZCA9IEdldFBsYXllclBlZChzb3VyY2UpO1xuICAgICAgICBjb25zdCBwZWRJZCA9IE5ldHdvcmtHZXROZXR3b3JrSWRGcm9tRW50aXR5KHBlZCk7XG4gICAgICAgIGNvbnN0IHNvdW5kSWQgPSBhd2FpdCBleHBvcnRzWydpZ25pc19zb3VuZGhhbmRsZXInXS5TdGFydEF0dGFjaFNvdW5kKHJpbmd0b25lTGluaywgcGVkSWQsIDUsIEdldEdhbWVUaW1lcigpLCB0cnVlLCAwLjE1KTtcbiAgICAgICAgdGhpcy5yaW5nVG9uZU1hbmdlci5zZXQoc291cmNlLCBzb3VuZElkKTtcbiAgICB9XG4gICAgcHVibGljIGFzeW5jIHN0b3BSaW5nVG9uZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBzb3VuZElkID0gdGhpcy5yaW5nVG9uZU1hbmdlci5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKCFzb3VuZElkKSByZXR1cm47XG4gICAgICAgIGV4cG9ydHNbJ2lnbmlzX3NvdW5kaGFuZGxlciddLlN0b3BTb3VuZChzb3VuZElkKTtcbiAgICAgICAgdGhpcy5yaW5nVG9uZU1hbmdlci5kZWxldGUoc291cmNlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBjYWxsTWFuYWdlciA9IG5ldyBDYWxsTWFuYWdlcigpOyIsICJpbXBvcnQgeyBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbmNsYXNzIFNldHRpbmcge1xuICAgIHB1YmxpYyBfaWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyBiYWNrZ3JvdW5kID0gbmV3IE1hcDxzdHJpbmcsIHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9PigpO1xuICAgIHB1YmxpYyBsb2Nrc2NyZWVuID0gbmV3IE1hcDxzdHJpbmcsIHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9PigpO1xuICAgIHB1YmxpYyByaW5ndG9uZSA9IG5ldyBNYXA8c3RyaW5nLCB7IGN1cnJlbnQ6IHN0cmluZzsgcmluZ3RvbmVzOiB7IG5hbWU6IHN0cmluZywgdXJsOiBzdHJpbmcgfVtdIH0+KCk7XG4gICAgcHVibGljIHNob3dTdGFydHVwU2NyZWVuID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHNob3dOb3RpZmljYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIGlzTG9jayA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBsb2NrUGluID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgdXNlUGluID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHVzZUZhY2VJZCA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBmYWNlSWRJZGVudGlmaWVyID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgc21ydElkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgc21ydFBhc3N3b3JkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgaXNGbGlnaHRNb2RlID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHBob25lTnVtYmVyID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgZGFya01haWxJZEF0dGFjaGVkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgcGlnZW9uSWRBdHRhY2hlZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgLy8gTm8gYXV0b21hdGljIGNsZWFudXAgLSBvbmx5IHJlbW92ZSBvbiBwbGF5ZXIgZGlzY29ubmVjdFxuXG4gICAgcHVibGljIGFzeW5jIGxvYWQoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgaXNEQkNvbm5lY3RlZCA9IGV4cG9ydHNbJ21vbmdvREInXS5pc0RCQ29ubmVjdGVkKCk7XG4gICAgICAgICAgICB3aGlsZSAoaXNEQkNvbm5lY3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICAgICAgICAgICAgICBpc0RCQ29ubmVjdGVkID0gZXhwb3J0c1snbW9uZ29EQiddLmlzREJDb25uZWN0ZWQoKTtcbiAgICAgICAgICAgICAgICBpZiAoaXNEQkNvbm5lY3RlZCkge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoXCJbU2V0dGluZ3NdIE1vbmdvREIgY29ubmVjdGVkLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW1NldHRpbmdzXSBXYWl0aW5nIGZvciBNb25nb0RCIGNvbm5lY3Rpb24uLi5cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXM6IGFueSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX3NldHRpbmdzJywge30pO1xuICAgICAgICAgICAgZm9yIChjb25zdCBkYXRhIG9mIHJlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2lkLnNldChkYXRhLl9pZCwgZGF0YS5faWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuYmFja2dyb3VuZC5zZXQoZGF0YS5faWQsIGRhdGEuYmFja2dyb3VuZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2Nrc2NyZWVuLnNldChkYXRhLl9pZCwgZGF0YS5sb2Nrc2NyZWVuKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJpbmd0b25lLnNldChkYXRhLl9pZCwgZGF0YS5yaW5ndG9uZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5zZXQoZGF0YS5faWQsIGRhdGEuc2hvd1N0YXJ0dXBTY3JlZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd05vdGlmaWNhdGlvbnMuc2V0KGRhdGEuX2lkLCBkYXRhLnNob3dOb3RpZmljYXRpb25zKTtcbiAgICAgICAgICAgICAgICB0aGlzLmlzTG9jay5zZXQoZGF0YS5faWQsIGRhdGEuaXNMb2NrKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvY2tQaW4uc2V0KGRhdGEuX2lkLCBkYXRhLmxvY2tQaW4pO1xuICAgICAgICAgICAgICAgIHRoaXMudXNlUGluLnNldChkYXRhLl9pZCwgZGF0YS51c2VQaW4pO1xuICAgICAgICAgICAgICAgIHRoaXMudXNlRmFjZUlkLnNldChkYXRhLl9pZCwgZGF0YS51c2VGYWNlSWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmFjZUlkSWRlbnRpZmllci5zZXQoZGF0YS5faWQsIGRhdGEuZmFjZUlkSWRlbnRpZmllcik7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuc2V0KGRhdGEuX2lkLCBkYXRhLmRhcmtNYWlsSWRBdHRhY2hlZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zbXJ0SWQuc2V0KGRhdGEuX2lkLCBkYXRhLnNtcnRJZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zbXJ0UGFzc3dvcmQuc2V0KGRhdGEuX2lkLCBkYXRhLnNtcnRQYXNzd29yZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5pc0ZsaWdodE1vZGUuc2V0KGRhdGEuX2lkLCBkYXRhLmlzRmxpZ2h0TW9kZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5waG9uZU51bWJlci5zZXQoZGF0YS5faWQsIGRhdGEucGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMucGlnZW9uSWRBdHRhY2hlZC5zZXQoZGF0YS5faWQsIGRhdGEucGlnZW9uSWRBdHRhY2hlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gTG9hZGVkLmApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gRmFpbGVkIHRvIGxvYWQgc2V0dGluZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzYXZlKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdGhpcy5faWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IF9pZDoga2V5IH0sIHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBrZXksXG4gICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRoaXMuYmFja2dyb3VuZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgbG9ja3NjcmVlbjogdGhpcy5sb2Nrc2NyZWVuLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICByaW5ndG9uZTogdGhpcy5yaW5ndG9uZS5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0aGlzLnNob3dOb3RpZmljYXRpb25zLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBpc0xvY2s6IHRoaXMuaXNMb2NrLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBsb2NrUGluOiB0aGlzLmxvY2tQaW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHVzZVBpbjogdGhpcy51c2VQaW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHVzZUZhY2VJZDogdGhpcy51c2VGYWNlSWQuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IHRoaXMuZmFjZUlkSWRlbnRpZmllci5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc21ydElkOiB0aGlzLnNtcnRJZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc21ydFBhc3N3b3JkOiB0aGlzLnNtcnRQYXNzd29yZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgaXNGbGlnaHRNb2RlOiB0aGlzLmlzRmxpZ2h0TW9kZS5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHRoaXMucGhvbmVOdW1iZXIuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IHRoaXMucGlnZW9uSWRBdHRhY2hlZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBTYXZlZCBzdWNjZXNzZnVsbHkuYCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIEZhaWxlZCB0byBzYXZlIHNldHRpbmdzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgUmVnaXN0ZXJOZXdTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZywgbnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5faWQuc2V0KGNpdGl6ZW5JZCwgY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnNldChjaXRpemVuSWQsIHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0pO1xuICAgICAgICB0aGlzLmxvY2tzY3JlZW4uc2V0KGNpdGl6ZW5JZCwgeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSk7XG4gICAgICAgIHRoaXMucmluZ3RvbmUuc2V0KGNpdGl6ZW5JZCwgeyBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsIHJpbmd0b25lczogW3sgbmFtZTogJ2RlZmF1bHQnLCB1cmw6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyB9XSB9KTtcbiAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5zZXQoY2l0aXplbklkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5zZXQoY2l0aXplbklkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5pc0xvY2suc2V0KGNpdGl6ZW5JZCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMudXNlUGluLnNldChjaXRpemVuSWQsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5waG9uZU51bWJlci5zZXQoY2l0aXplbklkLCBudW1iZXIpO1xuICAgICAgICB0aGlzLnVzZUZhY2VJZC5zZXQoY2l0aXplbklkLCBmYWxzZSk7XG4gICAgICAgIHRoaXMuZmFjZUlkSWRlbnRpZmllci5zZXQoY2l0aXplbklkLCBjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMuc21ydElkLnNldChjaXRpemVuSWQsICcnKTtcbiAgICAgICAgdGhpcy5zbXJ0UGFzc3dvcmQuc2V0KGNpdGl6ZW5JZCwgJycpO1xuICAgICAgICB0aGlzLmlzRmxpZ2h0TW9kZS5zZXQoY2l0aXplbklkLCBmYWxzZSk7XG4gICAgICAgIHRoaXMucGlnZW9uSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIFNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9LCB7XG4gICAgICAgICAgICAgICAgX2lkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdGhpcy5iYWNrZ3JvdW5kLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGxvY2tzY3JlZW46IHRoaXMubG9ja3NjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICByaW5ndG9uZTogdGhpcy5yaW5ndG9uZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBpc0xvY2s6IHRoaXMuaXNMb2NrLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGxvY2tQaW46IHRoaXMubG9ja1Bpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICB1c2VQaW46IHRoaXMudXNlUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHVzZUZhY2VJZDogdGhpcy51c2VGYWNlSWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogdGhpcy5mYWNlSWRJZGVudGlmaWVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgc21ydElkOiB0aGlzLnNtcnRJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6IHRoaXMuc21ydFBhc3N3b3JkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogdGhpcy5pc0ZsaWdodE1vZGUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHRoaXMucGhvbmVOdW1iZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogdGhpcy5waWdlb25JZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgcGxheWVyIHNldHRpbmdzIGZvciAke2NpdGl6ZW5JZH0gc3VjY2Vzc2Z1bGx5LmApO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBGYWlsZWQgdG8gc2F2ZSBwbGF5ZXIgc2V0dGluZ3MgZm9yICR7Y2l0aXplbklkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIHBsYXllciBkYXRhIG9ubHkgd2hlbiBwbGF5ZXIgZGlzY29ubmVjdHNcbiAgICBwdWJsaWMgb25QbGF5ZXJEaXNjb25uZWN0KGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGxheWVyRGF0YShjaXRpemVuSWQpO1xuICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gQ2xlYW5lZCB1cCBkYXRhIGZvciBkaXNjb25uZWN0ZWQgcGxheWVyICR7Y2l0aXplbklkfWApO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBwbGF5ZXIgZGF0YSBmcm9tIGFsbCBtYXBzXG4gICAgcHJpdmF0ZSByZW1vdmVQbGF5ZXJEYXRhKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuX2lkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmJhY2tncm91bmQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMubG9ja3NjcmVlbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5yaW5ndG9uZS5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5pc0xvY2suZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy51c2VQaW4uZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMudXNlRmFjZUlkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmZhY2VJZElkZW50aWZpZXIuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuc21ydElkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnNtcnRQYXNzd29yZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5pc0ZsaWdodE1vZGUuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMucGhvbmVOdW1iZXIuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuZGFya01haWxJZEF0dGFjaGVkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnBpZ2VvbklkQXR0YWNoZWQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgfVxuXG4gICAgLy8gUHVibGljIG1ldGhvZCB0byBtYW51YWxseSBjbGVhbiB1cCBhIHNwZWNpZmljIHBsYXllciAoZm9yIGFkbWluIGNvbW1hbmRzKVxuICAgIHB1YmxpYyBjbGVhbnVwUGxheWVyKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGxheWVyRGF0YShjaXRpemVuSWQpO1xuICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gTWFudWFsbHkgY2xlYW5lZCB1cCBkYXRhIGZvciBwbGF5ZXIgJHtjaXRpemVuSWR9YCk7XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgU2V0dGluZ3MgPSBuZXcgU2V0dGluZygpOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBjYWxsTWFuYWdlciB9IGZyb20gXCIuL0NhbGxNYW5hZ2VyXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IE1vbmdvREIsIExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFBob25lQ29udGFjdHMgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IGNhbGxIaXN0b3J5TWFuYWdlciwgUGxheWVyQ2FsbEhpc3RvcnkgfSBmcm9tIFwiLi9jYWxsSGlzdG9yeU1hbmFnZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL1NldHRpbmdzL2NsYXNzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmNhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBudW1iZXIsIF9pZCwgdm9sdW1lIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJGcm9tUGhvbmVOdW1iZXIobnVtYmVyKTtcbiAgY29uc3QgdGFyZ2V0RGF0YTogUGhvbmVDb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IGNvbnRhY3ROdW1iZXI6IG51bWJlciwgcGVyc29uYWxOdW1iZXI6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKSB9KTtcblxuICBjb25zdCBzb3VyY2VEYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHtcbiAgICBjb250YWN0TnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgcGVyc29uYWxOdW1iZXI6IG51bWJlclxuICB9KTtcblxuICBpZiAoIXRhcmdldFBsYXllcikge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICBjb25zdCBjYWxsZXJSZWNvcmQ6IFBsYXllckNhbGxIaXN0b3J5ID0ge1xuICAgICAgY2FsbElkOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKSxcbiAgICAgIHJvbGU6IFwiY2FsbGVyXCIsXG4gICAgICBteVBob25lTnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuXG4gICAgY29uc3QgY2FsbGVlUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCksXG4gICAgICByb2xlOiBcImNhbGxlZVwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgICBzdGF0dXM6IFwibWlzc2VkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlclJlY29yZCk7XG4gICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVlUmVjb3JkKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCB0YXJnZXRTb3VyY2UgPSB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2U7XG5cbiAgaWYgKGNhbGxNYW5hZ2VyLmlzUGxheWVySW5DYWxsKHNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IGFyZSBhbHJlYWR5IGluIGEgY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoY2FsbE1hbmFnZXIuaXNQbGF5ZXJJbkNhbGwodGFyZ2V0U291cmNlKSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEJ1c3lcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlRhcmdldCBpcyBhbHJlYWR5IGluIGEgY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBzb3VyY2VQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0UGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHNvdXJjZUNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW1wicWItY29yZVwiXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tcInFiLWNvcmVcIl0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgSXNOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHRhcmdldFBob25lLCBzb3VyY2VQaG9uZSk7XG4gIGNvbnN0IHNvdXJjZUZsaWdodE1vZGUgPSBhd2FpdCBVdGlscy5JbkZsaWdodE1vZGUoc291cmNlQ2l0aXplbklkKTtcbiAgY29uc3QgdGFyZ2V0RmxpZ2h0TW9kZSA9IGF3YWl0IFV0aWxzLkluRmxpZ2h0TW9kZSh0YXJnZXRDaXRpemVuSWQpO1xuICBpZiAoc291cmNlRmxpZ2h0TW9kZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJGbGlnaHQgTW9kZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IGNhbm5vdCBtYWtlIGNhbGxzIHdoaWxlIGluIGZsaWdodCBtb2RlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSBlbHNlIGlmICh0YXJnZXRGbGlnaHRNb2RlKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIHVucmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoSXNOdW1iZXJCbG9ja2VkKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IFNob3VyY2VOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHNvdXJjZVBob25lLCB0YXJnZXRQaG9uZSk7XG4gIGlmIChTaG91cmNlTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJOdW1iZXIgQmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiVW5ibG9jayB0aGUgbnVtYmVyIHRvIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHRhcmdldEhhc1Bob25lID0gYXdhaXQgVXRpbHMuSGFzUGhvbmUodGFyZ2V0U291cmNlKTtcbiAgaWYgKCF0YXJnZXRIYXNQaG9uZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuXG4gICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgIGNvbnN0IGNhbGxlclJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApLFxuICAgICAgcm9sZTogXCJjYWxsZXJcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiB0YXJnZXRQaG9uZSxcbiAgICAgIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuXG4gICAgY29uc3QgY2FsbGVlUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCksXG4gICAgICByb2xlOiBcImNhbGxlZVwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogdGFyZ2V0UGhvbmUsXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgICAgc3RhdHVzOiBcIm1pc3NlZFwiLFxuICAgICAgY2FsbFRpbWU6IDAsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZXJSZWNvcmQpO1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlZVJlY29yZCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IGhvc3RQYXJ0aWNpcGFudCA9IHtcbiAgICBzb3VyY2UsXG4gICAgY2l0aXplbklkOiBzb3VyY2VDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgY2FsbElkID0gY2FsbE1hbmFnZXIuY3JlYXRlQ2FsbChob3N0UGFydGljaXBhbnQpO1xuXG4gIGNhbGxNYW5hZ2VyLmNyZWF0ZVJpbmdUb25lKHRhcmdldFNvdXJjZSwgU3RyaW5nKFNldHRpbmdzLnJpbmd0b25lLmdldCh0YXJnZXRDaXRpemVuSWQpPy5jdXJyZW50KSwgdm9sdW1lKTtcbiAgY2FsbE1hbmFnZXIuYWRkUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UsICgpID0+IHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBUaW1lb3V0XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDYWxsIHdhcyBub3QgYW5zd2VyZWQgYnkgdGFyZ2V0XCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJNaXNzZWQgQ2FsbFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IG1pc3NlZCBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgICAgIGlmIChjYWxsKSB7XG4gICAgICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwidW5hbnN3ZXJlZFwiLCBcIm1pc3NlZFwiLCBuZXcgRGF0ZSgpLCB0YXJnZXRQaG9uZSk7XG4gICAgICB9XG4gICAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgICB9KSgpO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbCh0YXJnZXRTb3VyY2UsIDApO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgX2lkKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgc291cmNlKTtcbiAgfSwgMjAwMDApO1xuXG4gIGNvbnN0IHNvdXJjZU5hbWUgPSBzb3VyY2VEYXRhID8gYCR7c291cmNlRGF0YS5maXJzdE5hbWV9ICR7c291cmNlRGF0YS5sYXN0TmFtZX1gIDogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXROYW1lID0gdGFyZ2V0RGF0YSA/IGAke3RhcmdldERhdGEuZmlyc3ROYW1lfSAke3RhcmdldERhdGEubGFzdE5hbWV9YCA6IG51bWJlcjtcblxuICBlbWl0TmV0KFwicGhvbmU6YWRkQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGlkOiBfaWQsXG4gICAgdGl0bGU6IFwiSW5jb21pbmcgQ2FsbFwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHtzb3VyY2VOYW1lfSBpcyBjYWxsaW5nIHlvdWAsXG4gICAgYXBwOiBcInBob25lXCIsXG4gICAgaWNvbnM6IHtcbiAgICAgIFwiMFwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9yZWQuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6ZGVjbGluZUNhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgc291cmNlTmFtZSxcbiAgICAgICAgICB0YXJnZXROYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogX2lkLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBcIjFcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvZ3JlZW4uc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lOiB0YXJnZXROYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWU6IHNvdXJjZU5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9LFxuICB9KSk7XG5cbiAgY29uc29sZS5sb2coc291cmNlLCBcIkNhbGxpbmdcIiwgdGFyZ2V0U291cmNlLCB0YXJnZXROYW1lLCBfaWQpO1xuICBlbWl0TmV0KFwic3VtbWl0X3Bob25lOnNlcnZlcjphZGRDYWxsaW5naW50ZXJmYWNlXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgdGFyZ2V0TmFtZSxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgfSkpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgIHRpdGxlOiAnQ2FsbCBJbml0aWF0ZWQnLFxuICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBob25lfSBpbml0aWF0ZWQgYSBjYWxsIHRvICR7dGFyZ2V0UGhvbmV9IChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbiAgcmV0dXJuIHRydWU7XG59KTtcblxub25OZXQoXCJzdW1taXRfcGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsIGFzeW5jIChkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZSBhcyBudW1iZXI7XG4gIGNvbnN0IHsgY2FsbElkLCB0YXJnZXRTb3VyY2UsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zb2xlLmxvZyhzb3VyY2UsIFwiRGVjbGluaW5nIGNhbGxcIiwgY2FsbElkLCB0YXJnZXRTb3VyY2UsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkKTtcbiAgY2FsbE1hbmFnZXIuZGVjbGluZUludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmIChjYWxsKSB7XG4gICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJkZWNsaW5lZFwiLCBcImRlY2xpbmVkXCIsIG5ldyBEYXRlKCkpO1xuICB9XG4gIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIGlmICghdGFyZ2V0U291cmNlIHx8ICFjYWxsZXJTb3VyY2UpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBkYXRhYmFzZVRhYmxlSWQpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ0NhbGwgRGVjbGluZWQnLFxuICAgIG1lc3NhZ2U6IGAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKX0gZGVjbGluZWQgdGhlIGNhbGwgZnJvbSAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmVuZENhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKCFjYWxsIHx8IGNhbGwuY2FsbElkICE9PSBjYWxsSWQpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgY2FsbEhvc3QgPSBjYWxsTWFuYWdlci5nZXRDYWxsSG9zdChjYWxsSWQpO1xuICBpZiAoY2FsbEhvc3QgJiYgY2FsbEhvc3Quc291cmNlID09PSBzb3VyY2UgfHwgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkubGVuZ3RoIDw9IDEpIHtcbiAgICBmb3IgKGNvbnN0IHBhcnRpY2lwYW50IG9mIGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpKSB7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjY3BldGVkQ2FsbGluZ0ludGVyZmFjZVwiLCBwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHBhcnRpY2lwYW50LnNvdXJjZSwgMCk7XG4gICAgfVxuICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiY29tcGxldGVkXCIsIFwiY29tcGxldGVkXCIsIG5ldyBEYXRlKCkpO1xuICAgIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgICB0aXRsZTogJ0NhbGwgRW5kZWQnLFxuICAgICAgbWVzc2FnZTogYENhbGwgZW5kZWQgYnkgJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSl9IChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAoY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkubGVuZ3RoID4gMikge1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWNjcGV0ZWRDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHNvdXJjZSwgMCk7XG4gICAgY2FsbE1hbmFnZXIucmVtb3ZlRnJvbUNhbGwoY2FsbElkLCBzb3VyY2UpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICAgIHRpdGxlOiAnUGFydGljaXBhbnQgTGVmdCBDYWxsJyxcbiAgICAgIG1lc3NhZ2U6IGAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKX0gbGVmdCB0aGUgY29uZmVyZW5jZSBjYWxsIChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY2NwZXRlZENhbGxpbmdJbnRlcmZhY2VcIiwgcGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChwYXJ0aWNpcGFudC5zb3VyY2UsIDApO1xuICAgIH1cbiAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpKTtcbiAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgICAgdGl0bGU6ICdDYWxsIEVuZGVkJyxcbiAgICAgIG1lc3NhZ2U6IGBDYWxsIGVuZGVkIGJ5ICR7YXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpfSAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICB9XG4gIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmFkZFBsYXllclRvQ2FsbFwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCB7IGNvbnRhY3ROdW1iZXIsIF9pZCwgdm9sdW1lIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCB0YXJnZXREYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkIH0pO1xuICBjb25zdCBzb3VyY2VEYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHtcbiAgICBjb250YWN0TnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgcGVyc29uYWxOdW1iZXI6IGNvbnRhY3ROdW1iZXJcbiAgfSk7XG4gIGNvbnN0IGNhbGxJZCA9IGNhbGxNYW5hZ2VyLmdldENhbGxJZEJ5UGxheWVyKHNvdXJjZSk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKCFjYWxsKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIk5vIG9uZ29pbmcgY2FsbCBmb3VuZFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3Qgc291cmNlUGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IFV0aWxzLkdldFBsYXllckZyb21QaG9uZU51bWJlcihjb250YWN0TnVtYmVyKTtcbiAgaWYgKCF0YXJnZXRQbGF5ZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGFkZCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB0YXJnZXRTb3VyY2UgPSB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2U7XG4gIGNvbnN0IElzTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChjb250YWN0TnVtYmVyLCBzb3VyY2VQaG9uZSk7XG4gIGNvbnN0IHNvdXJjZUNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW1wicWItY29yZVwiXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGNvbnRhY3ROdW1iZXIpO1xuICBjb25zdCBzb3VyY2VGbGlnaHRNb2RlID0gYXdhaXQgVXRpbHMuSW5GbGlnaHRNb2RlKHNvdXJjZUNpdGl6ZW5JZCk7XG4gIGNvbnN0IHRhcmdldEZsaWdodE1vZGUgPSBhd2FpdCBVdGlscy5JbkZsaWdodE1vZGUodGFyZ2V0Q2l0aXplbklkKTtcbiAgaWYgKHNvdXJjZUZsaWdodE1vZGUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiRmxpZ2h0IE1vZGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBjYW5ub3QgbWFrZSBjYWxscyB3aGlsZSBpbiBmbGlnaHQgbW9kZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSBpZiAodGFyZ2V0RmxpZ2h0TW9kZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyB1bnJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKElzTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBTaG91cmNlTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChzb3VyY2VQaG9uZSwgY29udGFjdE51bWJlcik7XG4gIGlmIChTaG91cmNlTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJOdW1iZXIgQmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiVW5ibG9jayB0aGUgbnVtYmVyIHRvIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHRhcmdldEhhc1Bob25lID0gYXdhaXQgVXRpbHMuSGFzUGhvbmUodGFyZ2V0U291cmNlKTtcbiAgaWYgKCF0YXJnZXRIYXNQaG9uZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoY2FsbC5wYXJ0aWNpcGFudHMuaGFzKHRhcmdldFNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQWxyZWFkeSBpbiBDYWxsXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQbGF5ZXIgaXMgYWxyZWFkeSBpbiB0aGUgY2FsbFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY2FsbE1hbmFnZXIuY3JlYXRlUmluZ1RvbmUodGFyZ2V0U291cmNlLCBTdHJpbmcoU2V0dGluZ3MucmluZ3RvbmUuZ2V0KHRhcmdldENpdGl6ZW5JZCk/LmN1cnJlbnQpLCB2b2x1bWUpO1xuICBjYWxsTWFuYWdlci5hZGRQZW5kaW5nSW52aXRhdGlvbihOdW1iZXIoY2FsbElkKSwgdGFyZ2V0U291cmNlLCAoKSA9PiB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgVGltZW91dFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGxheWVyIGRpZCBub3QgYW5zd2VyIGNvbmZlcmVuY2UgY2FsbCBpbnZpdGF0aW9uXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICB9LCAzMDAwMCk7XG5cbiAgY29uc3Qgc291cmNlTmFtZSA9IHNvdXJjZURhdGFcbiAgICA/IGAke3NvdXJjZURhdGEuZmlyc3ROYW1lfSAke3NvdXJjZURhdGEubGFzdE5hbWV9YFxuICAgIDogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXROYW1lID0gdGFyZ2V0RGF0YSA/IGAke3RhcmdldERhdGEuZmlyc3ROYW1lfSAke3RhcmdldERhdGEubGFzdE5hbWV9YCA6IGNvbnRhY3ROdW1iZXI7XG5cbiAgZW1pdE5ldChcInBob25lOmFkZEFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBpZDogX2lkLFxuICAgIHRpdGxlOiBcIkluY29taW5nIENvbmZlcmVuY2UgQ2FsbFwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHtzb3VyY2VOYW1lfSBpcyBhZGRpbmcgeW91IHRvIGEgY29uZmVyZW5jZSBjYWxsYCxcbiAgICBhcHA6IFwicGhvbmVcIixcbiAgICBpY29uczoge1xuICAgICAgXCIwXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3JlZC5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkOiBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHRhcmdldE5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIFwiMVwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9ncmVlbi5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphY2NlcHRDb25mZXJlbmNlQ2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkOiBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0sXG4gIH0pKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ1BsYXllciBBZGRlZCB0byBDYWxsJyxcbiAgICBtZXNzYWdlOiBgJHtzb3VyY2VQaG9uZX0gYWRkZWQgJHtjb250YWN0TnVtYmVyfSB0byBjb25mZXJlbmNlIGNhbGwgKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xuICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwicGhvbmU6c2VydmVyOmdldENhbGxIaXN0b3J5XCIsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgbWF4UmVjb3Jkc1g6IG51bWJlcikgPT4ge1xuICBsZXQgbWF4UmVjb3JkcyA9IDEwMDtcbiAgdHJ5IHtcbiAgICBpZiAobWF4UmVjb3Jkc1gpIHtcbiAgICAgIG1heFJlY29yZHMgPSBtYXhSZWNvcmRzWDtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yIHBhcnNpbmcgZ2V0Q2FsbEhpc3RvcnkgZGF0YVwiLCBlcnJvcik7XG4gIH1cblxuICBjb25zdCBwaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGhpc3RvcnkgPSBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIuZ2V0UGxheWVyQ2FsbEhpc3RvcnkocGhvbmVOdW1iZXIsIG1heFJlY29yZHMpO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShoaXN0b3J5KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmV0cmlldmluZyBjYWxsIGhpc3RvcnkgZm9yIHBob25lIG51bWJlcjpcIiwgcGhvbmVOdW1iZXIsIGVycm9yKTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoW10pO1xuICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6c2VydmVyOmdldERhdGFGcm9tREJ3aXRoTnVtYmVyJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgIG51bWJlcjogc3RyaW5nLFxuICAgIGNpdGl6ZW5JZDogc3RyaW5nLFxuICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGFyc2VkRGF0YS5udW1iZXIsIG93bmVySWQ6IHBhcnNlZERhdGEuY2l0aXplbklkIH0pO1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZTpzZXJ2ZXI6dG9nZ2xlQmxvY2tOdW1iZXInLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCBwYXJzZWREYXRhOiBQaG9uZUNvbnRhY3RzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgcGVyc29uYWxOdW1iZXIgPSBwYXJzZWREYXRhLnBlcnNvbmFsTnVtYmVyO1xuICBjb25zdCBjb250YWN0TnVtYmVyID0gcGFyc2VkRGF0YS5jb250YWN0TnVtYmVyO1xuICBsZXQgSXNOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHBlcnNvbmFsTnVtYmVyLCBjb250YWN0TnVtYmVyKTtcbiAgaWYgKCFJc051bWJlckJsb2NrZWQpIHtcbiAgICBhd2FpdCBVdGlscy5CbG9ja051bWJlcihwZXJzb25hbE51bWJlciwgY29udGFjdE51bWJlcik7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk51bWJlciBCbG9ja2VkXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJOdW1iZXIgaGFzIGJlZW4gYmxvY2tlZFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBVdGlscy5VbmJsb2NrTnVtYmVyKHBlcnNvbmFsTnVtYmVyLCBjb250YWN0TnVtYmVyKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTnVtYmVyIFVuYmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIGhhcyBiZWVuIHVuYmxvY2tlZFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwic3VtbWl0X3Bob25lOnNlcnZlcjpqYWlsQ2FsbFwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCB7IG51bWJlciwgdm9sdW1lIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJGcm9tUGhvbmVOdW1iZXIobnVtYmVyKTtcblxuICAvLyBGb3IgamFpbCBjYWxscywgd2UgZG9uJ3QgbmVlZCB0byBjaGVjayBpZiB0aGUgY2FsbGVyIGhhcyBhIHBob25lXG4gIC8vIFdlIGFsc28gZG9uJ3QgbmVlZCB0byBjaGVjayBmbGlnaHQgbW9kZSBzaW5jZSBpdCdzIGEgamFpbCBwaG9uZVxuXG4gIGlmICghdGFyZ2V0UGxheWVyKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgdGFyZ2V0U291cmNlID0gdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlO1xuXG4gIGlmIChjYWxsTWFuYWdlci5pc1BsYXllckluQ2FsbChzb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBhcmUgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGNhbGxNYW5hZ2VyLmlzUGxheWVySW5DYWxsKHRhcmdldFNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBCdXN5XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJUYXJnZXQgaXMgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3Qgc291cmNlUGhvbmUgPSBcIkpBSUxfUEhPTkVcIjsgLy8gU3BlY2lhbCBpZGVudGlmaWVyIGZvciBqYWlsIHBob25lIGNhbGxzXG4gIGNvbnN0IHRhcmdldFBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tcInFiLWNvcmVcIl0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbXCJxYi1jb3JlXCJdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG5cbiAgLy8gRm9yIGphaWwgY2FsbHMsIHdlIGRvbid0IGNoZWNrIGJsb2NrZWQgbnVtYmVycyBvciBmbGlnaHQgbW9kZVxuICAvLyBUaGlzIGFsbG93cyBpbmNhcmNlcmF0ZWQgcGxheWVycyB0byBtYWtlIGNhbGxzIGV2ZW4gaWYgdGhleSdyZSBibG9ja2VkXG5cbiAgY29uc3QgdGFyZ2V0SGFzUGhvbmUgPSBhd2FpdCBVdGlscy5IYXNQaG9uZSh0YXJnZXRTb3VyY2UpO1xuICBpZiAoIXRhcmdldEhhc1Bob25lKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgaG9zdFBhcnRpY2lwYW50ID0ge1xuICAgIHNvdXJjZSxcbiAgICBjaXRpemVuSWQ6IHNvdXJjZUNpdGl6ZW5JZCxcbiAgICBwaG9uZU51bWJlcjogc291cmNlUGhvbmUsXG4gICAgb25Ib2xkOiBmYWxzZSxcbiAgfTtcblxuICBjb25zdCBjYWxsSWQgPSBjYWxsTWFuYWdlci5jcmVhdGVDYWxsKGhvc3RQYXJ0aWNpcGFudCk7XG5cbiAgY2FsbE1hbmFnZXIuY3JlYXRlUmluZ1RvbmUodGFyZ2V0U291cmNlLCBTdHJpbmcoU2V0dGluZ3MucmluZ3RvbmUuZ2V0KHRhcmdldENpdGl6ZW5JZCk/LmN1cnJlbnQpLCB2b2x1bWUpO1xuXG4gIC8vIEphaWwgY2FsbHMgaGF2ZSBhIHNob3J0ZXIgdGltZW91dCAoMTUgbWludXRlcyBpbnN0ZWFkIG9mIDIwKVxuICBjYWxsTWFuYWdlci5hZGRQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSwgKCkgPT4ge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIFRpbWVvdXRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNhbGwgd2FzIG5vdCBhbnN3ZXJlZCBieSB0YXJnZXRcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk1pc3NlZCBDYWxsXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgbWlzc2VkIGEgY2FsbCBmcm9tIEpBSUxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgICAgIGlmIChjYWxsKSB7XG4gICAgICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwidW5hbnN3ZXJlZFwiLCBcIm1pc3NlZFwiLCBuZXcgRGF0ZSgpLCB0YXJnZXRQaG9uZSk7XG4gICAgICB9XG4gICAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgICB9KSgpO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbCh0YXJnZXRTb3VyY2UsIDApO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgXCJqYWlsX2NhbGxcIik7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gIH0sIDE1MDAwKTsgLy8gMTUgbWludXRlcyBmb3IgamFpbCBjYWxsc1xuXG4gIGNvbnN0IHNvdXJjZU5hbWUgPSBcIkpBSUwgUEhPTkVcIjtcbiAgY29uc3QgdGFyZ2V0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIobnVtYmVyLCB0YXJnZXRDaXRpemVuSWQpO1xuXG4gIGVtaXROZXQoXCJwaG9uZTphZGRBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgaWQ6IFwiamFpbF9jYWxsXCIsXG4gICAgdGl0bGU6IFwiSW5jb21pbmcgQ2FsbCBmcm9tIEpBSUxcIixcbiAgICBkZXNjcmlwdGlvbjogYCR7c291cmNlTmFtZX0gaXMgY2FsbGluZyB5b3VgLFxuICAgIGFwcDogXCJwaG9uZVwiLFxuICAgIGljb25zOiB7XG4gICAgICBcIjBcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvcmVkLnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IFwiamFpbF9jYWxsXCIsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIFwiMVwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9ncmVlbi5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphY2NlcHRDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IFwiamFpbF9jYWxsXCIsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9LFxuICB9KSk7XG5cbiAgZW1pdE5ldChcInN1bW1pdF9waG9uZTpzZXJ2ZXI6YWRkQ2FsbGluZ2ludGVyZmFjZVwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHRhcmdldE5hbWUsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkOiBcImphaWxfY2FsbFwiLFxuICB9KSk7XG5cbiAgLy8gU3RhcnQgYSB0aW1lciB0byBhdXRvbWF0aWNhbGx5IGVuZCBqYWlsIGNhbGxzIGFmdGVyIDEwIG1pbnV0ZXNcbiAgLy8gVGhpcyBwcmV2ZW50cyBhYnVzZSBhbmQgc2ltdWxhdGVzIHJlYWwgamFpbCBwaG9uZSBsaW1pdGF0aW9uc1xuICBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKGNhbGwgJiYgY2FsbC5jYWxsSWQgPT09IGNhbGxJZCkge1xuICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJDYWxsIEVuZGVkXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkphaWwgcGhvbmUgY2FsbCB0aW1lIGxpbWl0IHJlYWNoZWRcIixcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICB9KSk7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIkNhbGwgRW5kZWRcIixcbiAgICAgICAgZGVzY3JpcHRpb246IFwiSmFpbCBwaG9uZSBjYWxsIHRpbWUgbGltaXQgcmVhY2hlZFwiLFxuICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgIH0pKTtcblxuICAgICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJjb21wbGV0ZWRcIiwgXCJjb21wbGV0ZWRcIiwgbmV3IERhdGUoKSwgdGFyZ2V0UGhvbmUpO1xuICAgICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHNvdXJjZSwgMCk7XG4gICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwodGFyZ2V0U291cmNlLCAwKTtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgXCJqYWlsX2NhbGxcIik7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgc291cmNlKTtcbiAgICB9XG4gIH0sIDYwMDAwMCk7IC8vIDEwIG1pbnV0ZXNcblxuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgIHRpdGxlOiAnSmFpbCBDYWxsIEluaXRpYXRlZCcsXG4gICAgbWVzc2FnZTogYEphaWwgY2FsbCBpbml0aWF0ZWQgZnJvbSAke3NvdXJjZX0gdG8gJHt0YXJnZXRTb3VyY2V9ICgke3RhcmdldFBob25lfSlgLFxuICAgIHNob3dJZGVudGlmaWVyczogdHJ1ZSxcbiAgfSk7XG5cbiAgcmV0dXJuIHRydWU7XG59KTsiLCAiaW1wb3J0IHsgY2FsbE1hbmFnZXIgfSBmcm9tIFwiLi9DYWxsTWFuYWdlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgY2FsbEhpc3RvcnlNYW5hZ2VyIH0gZnJvbSBcIi4vY2FsbEhpc3RvcnlNYW5hZ2VyXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5cbm9uTmV0KFwicGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsIGFzeW5jIChub3RpSWQ6IHN0cmluZywgYXJnczogYW55KSA9PiB7XG4gIGNvbnN0IHsgY2FsbElkLCB0YXJnZXRTb3VyY2UsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkIH0gPSBKU09OLnBhcnNlKGFyZ3MpO1xuICBjYWxsTWFuYWdlci5kZWNsaW5lSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoY2FsbGVyU291cmNlKTtcbiAgaWYgKGNhbGwpIHtcbiAgICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImRlY2xpbmVkXCIsIFwiZGVjbGluZWRcIiwgbmV3IERhdGUoKSwgdGFyZ2V0UGhvbmUpO1xuICB9XG4gIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIFxuICAvLyBORVc6IEVuZCBhbmltYXRpb25zIGZvciBib3RoIHBhcnRpZXNcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDplbmRDYWxsQW5pbWF0aW9uXCIsIHRhcmdldFNvdXJjZSk7XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBjYWxsZXJTb3VyY2UpO1xuICBcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBkYXRhYmFzZVRhYmxlSWQpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogXCJwaG9uZVwiLFxuICAgIHRpdGxlOiBcIkNhbGwgRGVjbGluZWRcIixcbiAgICBtZXNzYWdlOiBgJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNhbGxlclNvdXJjZSl9IGhhcyBkZWNsaW5lZCB0aGUgY2FsbCBmcm9tICR7VXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpfWAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZSxcbiAgfSk7XG59KTtcblxub25OZXQoXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q2FsbFwiLCBhc3luYyAobm90aUlkOiBzdHJpbmcsIGFyZ3M6IGFueSkgPT4ge1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCB0YXJnZXROYW1lLCBzb3VyY2VOYW1lLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShhcmdzKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihjYWxsZXJTb3VyY2UpO1xuICBpZiAoIWNhbGwgfHwgY2FsbC5jYWxsSWQgIT09IGNhbGxJZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDYWxsIG5vIGxvbmdlciBleGlzdHNcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW1wicWItY29yZVwiXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgcGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlOiB0YXJnZXRTb3VyY2UsXG4gICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG4gIGlmICghY2FsbE1hbmFnZXIuYWNjZXB0SW52aXRhdGlvbihjYWxsSWQsIHBhcnRpY2lwYW50KSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb3VsZCBub3Qgam9pbiBjYWxsXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybjtcbiAgfVxuICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgY2FsbElkKTtcbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKGNhbGxlclNvdXJjZSwgY2FsbElkKTtcbiAgXG4gIC8vIE5FVzogU3RhcnQgYW5pbWF0aW9uIGZvciBib3RoIHBhcnRpZXMgd2hlbiBjYWxsIGlzIGFjY2VwdGVkXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6YWNjZXB0Q2FsbFwiLCB0YXJnZXRTb3VyY2UsIGFyZ3MpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnN0YXJ0Q2FsbEFuaW1hdGlvblwiLCBjYWxsZXJTb3VyY2UpOyAvLyBORVc6IEFuaW1hdGlvbiBmb3IgY2FsbGVyXG4gIFxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnVwZGF0ZUNhbGxlckludGVyZmFjZVwiLCBjYWxsZXJTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQsXG4gIH0pKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBub3RpSWQpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiBcInBob25lXCIsXG4gICAgdGl0bGU6IFwiQ2FsbCBBY2NlcHRlZFwiLFxuICAgIG1lc3NhZ2U6IGAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gaGFzIGFjY2VwdGVkIHRoZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjphY2NlcHRDb25mZXJlbmNlQ2FsbFwiLCBhc3luYyAobm90aUlkOiBzdHJpbmcsIGFyZ3M6IGFueSkgPT4ge1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCB0YXJnZXROYW1lLCBzb3VyY2VOYW1lLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShhcmdzKTtcblxuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmICghY2FsbCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb25mZXJlbmNlIGNhbGwgbm8gbG9uZ2VyIGV4aXN0c1wiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW1wicWItY29yZVwiXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgcGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlOiB0YXJnZXRTb3VyY2UsXG4gICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG4gIGlmICghY2FsbE1hbmFnZXIuYWNjZXB0SW52aXRhdGlvbihjYWxsLmNhbGxJZCwgcGFydGljaXBhbnQpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvdWxkIG5vdCBqb2luIGNvbmZlcmVuY2UgY2FsbFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgY2FsbC5jYWxsSWQpO1xuXG4gIGZvciAoY29uc3QgcCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpKSB7XG4gICAgaWYgKHAuc291cmNlICE9PSB0YXJnZXRTb3VyY2UpIHtcbiAgICAgIGNvbnN0IGNhbGxzcyA9IGNhbGwuY2FsbElkO1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxzcyxcbiAgICAgICAgcGFydGljaXBhbnRzOiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpLFxuICAgICAgfSkpO1xuICAgICAgZW1pdE5ldCgncGhvbmU6Y2xpZW50OnVwRGF0ZUludGVyRmFjZU5hbWUnLCBwLnNvdXJjZSk7XG4gICAgfVxuICB9XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgbm90aUlkKTtcbiAgXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6dXBkYXRlQ2FsbGVySW50ZXJmYWNlXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgc291cmNlTmFtZTogc291cmNlTmFtZSxcbiAgICB0YXJnZXROYW1lOiAnQ29uZmVyZW5jZSBDYWxsJyxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQsXG4gIH0pKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDYWxsZXJJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY2FsbElkLFxuICAgIHRhcmdldFNvdXJjZSxcbiAgICBzb3VyY2VOYW1lOiBzb3VyY2VOYW1lLFxuICAgIHRhcmdldE5hbWU6IFwiQ29uZmVyZW5jZSBDYWxsXCIsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkLFxuICB9KSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6IFwicGhvbmVcIixcbiAgICB0aXRsZTogXCJDb25mZXJlbmNlIENhbGwgQWNjZXB0ZWRcIixcbiAgICBtZXNzYWdlOiBgJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNhbGxlclNvdXJjZSl9IGhhcyBhY2NlcHRlZCB0aGUgY29uZmVyZW5jZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjplbmRDYWxsXCIsIGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQsIHNvdXJjZSB9ID0gSlNPTi5wYXJzZShhcmdzKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICBpZiAoY2FsbCAmJiBjYWxsLmNhbGxJZCA9PT0gY2FsbElkKSB7XG4gICAgYXdhaXQgY2FsbE1hbmFnZXIucmVtb3ZlUGFydGljaXBhbnQoY2FsbElkLCBzb3VyY2UpO1xuICAgIGZvciAoY29uc3QgcCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxJZDogY2FsbElkLFxuICAgICAgICBwYXJ0aWNpcGFudHM6IGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpLFxuICAgICAgfSkpO1xuICAgIH1cbiAgfVxufSk7XG5cbm9uKFwib25SZXNvdXJjZVN0b3BcIiwgYXN5bmMgKHJlc291cmNlOiBzdHJpbmcpID0+IHtcbiAgaWYgKHJlc291cmNlID09PSBHZXRDdXJyZW50UmVzb3VyY2VOYW1lKCkpIHtcbiAgICBmb3IgKGNvbnN0IGNhbGwgb2YgY2FsbE1hbmFnZXIuZ2V0QWxsQ2FsbHMoKSkge1xuICAgICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSkge1xuICAgICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwocGFydGljaXBhbnQuc291cmNlLCAwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG5vbk5ldChcInBsYXllckRyb3BwZWRcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKGNhbGwpIHtcbiAgICBhd2FpdCBjYWxsTWFuYWdlci5yZW1vdmVQYXJ0aWNpcGFudChjYWxsLmNhbGxJZCwgc291cmNlKTtcbiAgICBmb3IgKGNvbnN0IHAgb2YgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxJZDogY2FsbC5jYWxsSWQsXG4gICAgICAgIHBhcnRpY2lwYW50czogY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSxcbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cbn0pO1xuIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzYXZlUGhvdG9Ub1Bob3RvcycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCBkYXRhWCA9IHtcbiAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgIGNpdGl6ZW5JZCxcbiAgICBsaW5rOiBkYXRhLFxuICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKCdUJywgJyAnKS5yZXBsYWNlKCdaJywgJycpXG4gIH07XG4gIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9waG90b3MnLCBkYXRhWCk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9waG90b3MnLFxuICAgIHRpdGxlOiAnUGhvdG8gU2F2ZWQnLFxuICAgIG1lc3NhZ2U6IGBQaG90byBzYXZlZCBieSAke2F3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgJHtjaXRpemVuSWR9LCBMaW5rOiAke2RhdGF9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YVgpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldFBob3RvcycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgcGhvdG9zID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfcGhvdG9zJywgeyBjaXRpemVuSWQgfSk7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShwaG90b3MpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2RlbGV0ZVBob3RvJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfcGhvdG9zJywgeyBfaWQ6IGRhdGEgfSk7XG4gIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9waG90b3MnLCB7IF9pZDogZGF0YSwgY2l0aXplbklkIH0pO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfcGhvdG9zJyxcbiAgICB0aXRsZTogJ1Bob3RvIERlbGV0ZWQnLFxuICAgIG1lc3NhZ2U6IGBQaG90byBkZWxldGVkIGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCAke2NpdGl6ZW5JZH0sIExpbms6ICR7cmVzLmxpbmt9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xuICByZXR1cm4gdHJ1ZTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrLCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IE1vbmdvREIsIExvZ2dlciwgRnJhbWV3b3JrIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdSZWdpc3Rlck5ld0J1c2luZXNzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgYnVzaW5lc3NQYXNzd29yZCxcbiAgICAgICAgam9iXG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZSB9KTtcbiAgICBpZiAoYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBSZWdpc3RyYXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIHJlZ2lzdGVyIGJ1c2luZXNzIHdpdGggZXhpc3RpbmcgbmFtZSAnJHtidXNpbmVzc05hbWV9JyBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYEJ1c2luZXNzIHdpdGggbmFtZSAke2J1c2luZXNzTmFtZX0gYWxyZWFkeSBleGlzdHMuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGlmIChnZW5lcmF0ZUJ1c2luZXNzRW1haWwpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21haWwnLCB7XG4gICAgICAgICAgICBfaWQ6IGJ1c2luZXNzRW1haWwsXG4gICAgICAgICAgICBhY3RpdmVNYWlkSWQ6IGJ1c2luZXNzRW1haWwsXG4gICAgICAgICAgICB1c2VybmFtZTogYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgICAgIGFjdGl2ZU1haWxQYXNzd29yZDogYnVzaW5lc3NQYXNzd29yZCxcbiAgICAgICAgICAgIGF2YXRhcjogYnVzaW5lc3NMb2dvLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2J1c2luZXNzJywge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iXG4gICAgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgUmVnaXN0ZXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBOZXcgYnVzaW5lc3MgJyR7YnVzaW5lc3NOYW1lfScgcmVnaXN0ZXJlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0QnVzaW5lc3NEYXRhJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGJ1c2luZXNzKTtcbn0pO1xub25DbGllbnRDYWxsYmFjaygnZ2V0QWxsQnVzaW5lc3NEYXRhJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3NlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2J1c2luZXNzJywge30pO1xuICAgIGxldCBvbmxpbmVCdXNzID0gW11cbiAgICBsZXQgb2ZmbGluZUJ1c3MgPSBbXVxuICAgIGZvciAoY29uc3QgYnVzaW5lc3Mgb2YgYnVzaW5lc3Nlcykge1xuICAgICAgICBjb25zdCBqb2JDb3VudCA9IEdsb2JhbFN0YXRlW2Ake2J1c2luZXNzLmpvYn06Y291bnRgXVxuICAgICAgICBpZiAoam9iQ291bnQpIHtcbiAgICAgICAgICAgIG9ubGluZUJ1c3MucHVzaChidXNpbmVzcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvZmZsaW5lQnVzcy5wdXNoKGJ1c2luZXNzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBvbmxpbmU6IG9ubGluZUJ1c3MsIG9mZmxpbmU6IG9mZmxpbmVCdXNzIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldEJ1c2luZXNzTmFtZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3NlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2J1c2luZXNzJywge30pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShidXNpbmVzc2VzLm1hcCgoYnVzaW5lc3M6IGFueSkgPT4gYnVzaW5lc3MuYnVzaW5lc3NOYW1lKSk7XG59KVxuXG5vbkNsaWVudENhbGxiYWNrKCdVcGRhdGVCdXNpbmVzcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgICAgc2VsZWN0ZWRCdXNpbmVzcyxcbiAgICAgICAgb3duZXJDaXRpemVuSWQsXG4gICAgICAgIGJ1c2luZXNzTmFtZSxcbiAgICAgICAgYnVzaW5lc3NEZXNjcmlwdGlvbixcbiAgICAgICAgYnVzaW5lc3NUeXBlLFxuICAgICAgICBidXNpbmVzc0xvZ28sXG4gICAgICAgIGJ1c2luZXNzUGhvbmVOdW1iZXIsXG4gICAgICAgIGJ1c2luZXNzQWRkcmVzcyxcbiAgICAgICAgZ2VuZXJhdGVCdXNpbmVzc0VtYWlsLFxuICAgICAgICBjb29yZHMsXG4gICAgICAgIGpvYixcbiAgICAgICAgYnVzaW5lc3NFbWFpbFxuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGJ1c2luZXNzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBzZWxlY3RlZEJ1c2luZXNzIH0pO1xuICAgIGlmICghYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBVcGRhdGUgRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIHVwZGF0ZSBub24tZXhpc3RlbnQgYnVzaW5lc3MgJyR7c2VsZWN0ZWRCdXNpbmVzc30nIGJ5IFBsYXllcjogJHtleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7YnVzaW5lc3NOYW1lfSBkb2VzIG5vdCBleGlzdC5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IHNlbGVjdGVkQnVzaW5lc3MgfSwge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iLFxuICAgICAgICBidXNpbmVzc0VtYWlsXG4gICAgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBCdXNpbmVzcyAnJHtzZWxlY3RlZEJ1c2luZXNzfScgdXBkYXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZGVsZXRlQnVzaW5lc3MnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZTogZGF0YSB9KTtcbiAgICBpZiAoIWJ1c2luZXNzKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgRGVsZXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGRlbGV0ZSBub24tZXhpc3RlbnQgYnVzaW5lc3MgJyR7ZGF0YX0nIGJ5IFBsYXllcjogJHtleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7ZGF0YX0gZG9lcyBub3QgZXhpc3QuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBkYXRhIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICB0aXRsZTogJ0J1c2luZXNzIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgQnVzaW5lc3MgJyR7ZGF0YX0nIGRlbGV0ZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6dG9nZ2xlSm9iQ2FsbHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpOztcbiAgICBjb25zdCBQbGF5ZXJEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSk7XG4gICAgaWYgKCFQbGF5ZXJEYXRhKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIsIGpvYkNhbGxzOiB0cnVlIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSwgeyBqb2JDYWxsczogIVBsYXllckRhdGEuam9iQ2FsbHMgfSk7XG4gICAgcmV0dXJuICFQbGF5ZXJEYXRhLmpvYkNhbGxzO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0Sm9iQ2FsbHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IFBsYXllckRhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciB9KTtcbiAgICBpZiAoIVBsYXllckRhdGEpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciwgam9iQ2FsbHM6IHRydWUgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG4gICAgcmV0dXJuIFBsYXllckRhdGEuam9iQ2FsbHM7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpidXNpbmVzc0NhbGwnLCBhc3luYyAoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgbnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGNpdGl6ZW5pZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIobnVtYmVyKTtcbiAgICBjb25zdCBwZXJzb25hbE51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2xpZW50KTtcbiAgICBpZiAoU3RyaW5nKHBlcnNvbmFsTnVtYmVyKSA9PT0gU3RyaW5nKG51bWJlcikpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBDYW4ndCBjYWxsIHlvdXJzZWxmICR7cGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgaWYgKCFjaXRpemVuaWQpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFRoaXMgbnVtYmVyIGlzIG5vdCByZWdpc3RlcmVkLmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgY29uc3QgUGxheWVyRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogY2l0aXplbmlkIH0pO1xuICAgIGlmIChQbGF5ZXJEYXRhICYmICFQbGF5ZXJEYXRhLmpvYkNhbGxzKSB7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBUaGlzIHBlcnNvbiBoYXMgZGlzYWJsZWQgam9iIGNhbGxzLmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9IGVsc2UgaWYgKFBsYXllckRhdGEgJiYgUGxheWVyRGF0YS5qb2JDYWxscykge1xuICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpjbGllbnQ6YnVzaW5lc3NDYWxsJywgY2xpZW50LCBudW1iZXIpO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmdldEJhbmtiYWxhbmNlJywgYXN5bmMgKGNsaWVudCwgYWNjb3VudCkgPT4ge1xuICAgIGNvbnN0IGJhbGFuY2UgPSBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5nZXRBY2NvdW50TW9uZXkoYWNjb3VudCk7XG4gICAgcmV0dXJuIGJhbGFuY2U7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpkZXBvc2l0TW9uZXknLCBhc3luYyAoY2xpZW50LCBhbW91bnQ6IG51bWJlcikgPT4ge1xuICAgIFxuICAgIGNvbnN0IHNyYyA9IGNsaWVudDtcbiAgICBjb25zdCBQbGF5ZXIgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyKHNyYyk7XG4gICAgY29uc3QgZnVsbG5hbWUgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShzcmMpO1xuICAgIGNvbnN0IGNpZCA9IFBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZDtcbiAgICBjb25zdCBQbGF5ZXJKb2IgPSBQbGF5ZXIuUGxheWVyRGF0YS5qb2I7XG4gICAgY29uc3QgYWNjb3VudCA9IFBsYXllckpvYi5uYW1lO1xuICAgIGNvbnN0IGJhbmtiYWxhbmNlID0gYXdhaXQgUGxheWVyLlBsYXllckRhdGEubW9uZXkuYmFuaztcbiAgICBpZiAoYmFua2JhbGFuY2UgPCBhbW91bnQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBhd2FpdCBQbGF5ZXIuRnVuY3Rpb25zLlJlbW92ZU1vbmV5KCdiYW5rJywgYW1vdW50LCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0LlwiKTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5hZGRBY2NvdW50TW9uZXkoYWNjb3VudCwgYW1vdW50KTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihjaWQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3XCIsIGFtb3VudCwgYFNlbnQgZnVuZHMgdG8gJHtQbGF5ZXJKb2IubGFiZWx9YCwgYWNjb3VudCwgZnVsbG5hbWUsIFwid2l0aGRyYXdcIiwgZ2VuZXJhdGVVVWlkKCkpXG4gICAgYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oYWNjb3VudCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgRGVwb3NpdFwiLCBhbW91bnQsIFwiRGVwb3NpdFwiLCBmdWxsbmFtZSwgYWNjb3VudCwgXCJkZXBvc2l0XCIsIGdlbmVyYXRlVVVpZCgpKVxuXG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnTW9uZXkgRGVwb3NpdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBsYXllciAke2Z1bGxuYW1lfSBkZXBvc2l0ZWQgJCR7YW1vdW50fSB0byBhY2NvdW50ICR7YWNjb3VudH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6d2l0aGRyYXdNb25leScsIGFzeW5jIChjbGllbnQsIGFtb3VudDogbnVtYmVyKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gY2xpZW50O1xuICAgIGNvbnN0IFBsYXllciA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIoc3JjKTtcbiAgICBjb25zdCBmdWxsbmFtZSA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNyYyk7XG4gICAgY29uc3QgY2lkID0gUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkO1xuICAgIGNvbnN0IFBsYXllckpvYiA9IFBsYXllci5QbGF5ZXJEYXRhLmpvYjtcbiAgICBjb25zdCBhY2NvdW50ID0gUGxheWVySm9iLm5hbWU7XG4gICAgY29uc3QgYmFsYW5jZSA9IGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmdldEFjY291bnRNb25leShhY2NvdW50KTtcbiAgICBpZiAoYmFsYW5jZSA8IGFtb3VudCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGF3YWl0IFBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoJ2JhbmsnLCBhbW91bnQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3LlwiKTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5yZW1vdmVBY2NvdW50TW9uZXkoYWNjb3VudCwgYW1vdW50KTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihjaWQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3XCIsIGFtb3VudCwgYFJlY2lldmVkIGZ1bmRzIGZyb20gJHtQbGF5ZXJKb2IubGFiZWx9YCwgYWNjb3VudCwgZnVsbG5hbWUsIFwiZGVwb3NpdFwiLCBnZW5lcmF0ZVVVaWQoKSlcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihhY2NvdW50LCBcIlBob25lIEJ1c2luZXNzIEFwcCBXaXRoZHJhd1wiLCBhbW91bnQsIFwiV2l0aGRyYXdcIiwgYWNjb3VudCwgZnVsbG5hbWUsIFwid2l0aGRyYXdcIiwgZ2VuZXJhdGVVVWlkKCkpXG5cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgdGl0bGU6ICdNb25leSBXaXRoZHJhd24nLFxuICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7ZnVsbG5hbWV9IHdpdGhkcmV3ICQke2Ftb3VudH0gZnJvbSBhY2NvdW50ICR7YWNjb3VudH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0RW1wbG95ZWVzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gY2xpZW50O1xuICAgIGNvbnN0IGpvYm5hbWUgPSBkYXRhO1xuICAgIGNvbnN0IFBsYXllciA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIoc3JjKTtcbiAgICBjb25zdCBpc0Jvc3MgPSBQbGF5ZXIuUGxheWVyRGF0YS5qb2IuaXNib3NzO1xuICAgIC8qICAgICBcbiAgICAgICAgaWYgKCFpc0Jvc3MpIHtcbiAgICAgICAgICAgIHJldHVybiBleHBvcnRzWydwcy1hZG1pbm1lbnUnXS5CYW5QbGF5ZXIoc3JjLCAnR2V0RW1wbG95ZWVzIEV4cGxvaXRpbmcgJywgJ3N1bW1pdF9waG9uZScpO1xuICAgICAgICB9XG4gICAgKi9cbiAgICBjb25zdCBwbGF5ZXJzOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIGNpdGl6ZW5pZCwgY2hhcmluZm8sIGpvYiBGUk9NIHBsYXllcnMgV0hFUkUgam9iIExJS0UgPycsIFtgJSR7am9ibmFtZX0lYF0pO1xuICAgIGNvbnN0IGVtcGxveWVlczogYW55ID0gW107XG5cbiAgICBmb3IgKGNvbnN0IGRhdGEgb2YgcGxheWVycykge1xuICAgICAgICBsZXQgY2hhckRhdGEgPSB7IGZpcnN0bmFtZTogJ1Vua25vd24nLCBsYXN0bmFtZTogJ1BsYXllcicgfTtcbiAgICAgICAgbGV0IGpvYkRhdGEgPSB7IG5hbWU6ICdVbmtub3duJywgZ3JhZGU6IDAsIGlzYm9zczogZmFsc2UgfTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKGRhdGEuY2hhcmluZm8pIGNoYXJEYXRhID0gSlNPTi5wYXJzZShkYXRhLmNoYXJpbmZvKTtcbiAgICAgICAgICAgIGlmIChkYXRhLmpvYikgam9iRGF0YSA9IEpTT04ucGFyc2UoZGF0YS5qb2IpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBMT0dHRVIoYEZhaWxlZCB0byBwYXJzZSBKb2IgJHtqb2JuYW1lfSAvIGNoYXJpbmZvIGZvciAkICR7ZGF0YS5jaXRpemVuaWR9YCk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzT25saW5lID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKGRhdGEuY2l0aXplbmlkKTtcbiAgICAgICAgaWYgKGlzT25saW5lICYmIGlzT25saW5lLlBsYXllckRhdGEuam9iLm5hbWUgPT09IGpvYm5hbWUpIHtcbiAgICAgICAgICAgIGVtcGxveWVlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlbXBTb3VyY2U6IGlzT25saW5lLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgICAgIGN1ckpvYjogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSxcbiAgICAgICAgICAgICAgICBncmFkZTogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IuZ3JhZGUsXG4gICAgICAgICAgICAgICAgaXNib3NzOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5pc2Jvc3MsXG4gICAgICAgICAgICAgICAgbmFtZTogYCR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgIHN0YXR1czogJ29ubGluZSdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogZGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICAgICAgY3VySm9iOiBqb2JEYXRhLm5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGU6IGpvYkRhdGEuZ3JhZGUsXG4gICAgICAgICAgICAgICAgaXNib3NzOiBqb2JEYXRhLmlzYm9zcyxcbiAgICAgICAgICAgICAgICBuYW1lOiBgJHtjaGFyRGF0YS5maXJzdG5hbWV9ICR7Y2hhckRhdGEubGFzdG5hbWV9YCxcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdvZmZsaW5lJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZW1wbG95ZWVzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiAoYi5ncmFkZS5sZXZlbCB8fCAwKSAtIChhLmdyYWRlLmxldmVsIHx8IDApKTtcblxuICAgIGNvbnN0IG11bHRpam9iRW1wbG95ZWVzOiBhbnlbXSA9IFtdO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IG11bHRpSm9iUGxheWVyczogYW55W10gPSAoYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfbXVsdGlqb2JzJywgeyBqb2JOYW1lOiBqb2JuYW1lIH0pKSB8fCBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IG11bHRpSm9iIG9mIG11bHRpSm9iUGxheWVycykge1xuICAgICAgICAgICAgaWYgKCFtdWx0aUpvYi5jaXRpemVuSWQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1NraXBwaW5nIGludmFsaWQgbXVsdGlqb2IgZW50cnk6JywgbXVsdGlKb2IpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBpc09ubGluZSA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChtdWx0aUpvYi5jaXRpemVuSWQpO1xuICAgICAgICAgICAgaWYgKCFpc09ubGluZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBsYXllckRhdGE6IGFueSA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgY2hhcmluZm8sIGpvYiBGUk9NIHBsYXllcnMgV0hFUkUgY2l0aXplbmlkID0gPycsIFttdWx0aUpvYi5jaXRpemVuSWRdKTtcbiAgICAgICAgICAgICAgICBpZiAoIXBsYXllckRhdGEgfHwgcGxheWVyRGF0YS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBObyBwbGF5ZXIgZGF0YSBmb3VuZCBmb3Igb2ZmbGluZSBjaXRpemVuSWQgJHttdWx0aUpvYi5jaXRpemVuSWR9YCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZGF0YSBvZiBwbGF5ZXJEYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBqb2JEYXRhLCBjaGFyRGF0YTtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGpvYkRhdGEgPSBkYXRhLmpvYiA/IEpTT04ucGFyc2UoZGF0YS5qb2IpIDogeyBuYW1lOiAnVW5rbm93bicsIGdyYWRlOiAwLCBpc2Jvc3M6IGZhbHNlIH07XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFyRGF0YSA9IGRhdGEuY2hhcmluZm8gPyBKU09OLnBhcnNlKGRhdGEuY2hhcmluZm8pIDogeyBmaXJzdG5hbWU6ICdVbmtub3duJywgbGFzdG5hbWU6ICdQbGF5ZXInIH07XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byBwYXJzZSBqb2IvY2hhcmluZm8gZm9yICR7bXVsdGlKb2IuY2l0aXplbklkfTpgLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChqb2JEYXRhLm5hbWUgPT09IGpvYm5hbWUpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICBtdWx0aWpvYkVtcGxveWVlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogbXVsdGlKb2IuY2l0aXplbklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3VySm9iOiBqb2JEYXRhLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBncmFkZTogam9iRGF0YS5ncmFkZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzYm9zczogam9iRGF0YS5pc2Jvc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBgJHtjaGFyRGF0YS5maXJzdG5hbWV9ICR7Y2hhckRhdGEubGFzdG5hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ29mZmxpbmUnXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzT25saW5lLlBsYXllckRhdGEuam9iLm5hbWUgPT09IGpvYm5hbWUpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIG11bHRpam9iRW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBlbXBTb3VyY2U6IGlzT25saW5lLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgICAgICAgICBjdXJKb2I6IGlzT25saW5lLlBsYXllckRhdGEuam9iLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGdyYWRlOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5ncmFkZSxcbiAgICAgICAgICAgICAgICAgICAgaXNib3NzOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5pc2Jvc3MsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGAke2lzT25saW5lLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke2lzT25saW5lLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnb25saW5lJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG11bHRpam9iRW1wbG95ZWVzLnNvcnQoKGEsIGIpID0+IChiLmdyYWRlIHx8IDApIC0gKGEuZ3JhZGUgfHwgMCkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBwcm9jZXNzaW5nIG11bHRpam9iIGVtcGxveWVlczonLCBlcnIpO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGVtcGxveWVlczogZW1wbG95ZWVzLmxlbmd0aCA+IDAgPyBlbXBsb3llZXMgOiBbXSxcbiAgICAgICAgbXVsdGlqb2JFbXBsb3llZXM6IG11bHRpam9iRW1wbG95ZWVzLmxlbmd0aCA+IDAgPyBtdWx0aWpvYkVtcGxveWVlcyA6IFtdXG4gICAgfSk7XG59KTtcblxuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmhpcmVFbXBsb3llZScsIGFzeW5jIChjbGllbnQsIHRhcmdldFNvdXJjZTogc3RyaW5nLCBqb2JuYW1lOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoU3RyaW5nKGNsaWVudCkgPT09IFN0cmluZyh0YXJnZXRTb3VyY2UpKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSGlyZSBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gaGlyZSBzZWxmIE5hbWU6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX0sIGluIEpvYjogJHtqb2JuYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGNhbid0IGhpcmUgeW91cnNlbGYuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBpZiAoYXdhaXQgRG9lc1BsYXllckV4aXN0KHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgY29uc3QgcGxheWVyID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllcihjbGllbnQpO1xuICAgICAgICBpZiAoIXBsYXllci5QbGF5ZXJEYXRhLmpvYi5pc2Jvc3MpIHtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdIaXJlIEZhaWxlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gaGlyZSB3aXRob3V0IGJlaW5nIGEgYm9zcyBOYW1lOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9LCBpbiBKb2I6ICR7am9ibmFtZX0sIENpdGl6ZW5JZDogJHtwbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWR9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgYXJlIG5vdCBhIGJvc3MuYCxcbiAgICAgICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIodGFyZ2V0U291cmNlKTtcbiAgICAgICAgdGFyZ2V0UGxheWVyLkZ1bmN0aW9ucy5TZXRKb2Ioam9ibmFtZSwgMCk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnRW1wbG95ZWUgSGlyZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFBsYXllciAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH0gTmFtZTogJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhpcmVkIGJ5IFBsYXllcjogJHtleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfSwgaW4gSm9iOiAke2pvYm5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGhpcmVkICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSB0byAke2pvYm5hbWV9LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYmVlbiBoaXJlZCB0byAke2pvYm5hbWV9LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdCgnc3VtbWl0X3Bob25lOnNlcnZlcjpoaXJlaW5NdWx0aUpvYicsIHRhcmdldFNvdXJjZSwgam9ibmFtZSwgMCwgRnJhbWV3b3JrLlNoYXJlZC5Kb2JzW2pvYm5hbWVdLmxhYmVsLCBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbam9ibmFtZV0uZ3JhZGVzWycwJ10ubGFiZWwpO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgY2xpZW50LCBqb2JuYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICB0aXRsZTogJ0hpcmUgRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGhpcmUgbm9uLWV4aXN0ZW50IHBsYXllciBOYW1lOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9LCBpbiBKb2I6ICR7am9ibmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgUGxheWVyIGlzIG5vdCBvbmxpbmUuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRJbmRleE9mQWxsSm9icycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBqb2JzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnc3VtbWl0X2pvYnMnLCB7fSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGpvYnMubWFwKChqb2I6IGFueSkgPT4gam9iLl9pZCkpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3JlZ2lzdGVySm9icycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYnMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdzdW1taXRfam9icycsIGpvYnMpO1xuICAgIGNvbnN0IHsgX2lkLCAuLi5yZXN0IH0gPSBqb2JzO1xuICAgIGV4cG9ydHNbJ3FiLWNvcmUnXS5BZGRKb2IoX2lkLCByZXN0KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2pvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBSZWdpc3RlcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYE5ldyBqb2IgJyR7X2lkfScgTmFtZTogJHtqb2JzLmpvYk5hbWV9IHJlZ2lzdGVyZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldEpvYkRhdGEnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBqb2IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGpvYik7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygndXBkYXRlSm9icycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYnMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdzdW1taXRfam9icycsIHsgX2lkOiBqb2JzLl9pZCB9LCBqb2JzKTtcbiAgICBjb25zdCB7IF9pZCwgLi4ucmVzdCB9ID0gam9icztcbiAgICBleHBvcnRzWydxYi1jb3JlJ10uVXBkYXRlSm9iKF9pZCwgcmVzdCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9qb2JzJyxcbiAgICAgICAgdGl0bGU6ICdKb2IgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBKb2IgJyR7X2lkfScgTmFtZTogJHtqb2JzLmpvYk5hbWV9IHVwZGF0ZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2RlbGV0ZUpvYnMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBqb2IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgaWYgKCFqb2IpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAnc3VtbWl0X2pvYnMnLFxuICAgICAgICAgICAgdGl0bGU6ICdKb2IgRGVsZXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGRlbGV0ZSBub24tZXhpc3RlbnQgam9iICcke2RhdGF9JyBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYEpvYiBkb2VzIG5vdCBleGlzdC5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdzdW1taXRfam9icycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIGV4cG9ydHNbJ3FiLWNvcmUnXS5SZW1vdmVKb2IoZGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9qb2JzJyxcbiAgICAgICAgdGl0bGU6ICdKb2IgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBKb2IgJyR7ZGF0YX0nIE5hbWU6ICR7am9iLmpvYk5hbWV9IGRlbGV0ZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0QnVzaW5lc3NFbXBsb3llZXNOdW1iZXJzJywgYXN5bmMgKGNsaWVudDogbnVtYmVyLCBqb2I6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IFtwbGF5ZXJzXSA9IGF3YWl0IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyc09uRHV0eShqb2IpO1xuICAgIGxldCBudW1iZXJzOiBudW1iZXJbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgcGxheWVyIG9mIHBsYXllcnMpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShwbGF5ZXIpO1xuICAgICAgICBudW1iZXJzLnB1c2goTnVtYmVyKG51bWJlcikpO1xuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobnVtYmVycyk7XG59KSIsICJpbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZyYW1ld29yaywgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCwgTE9HR0VSIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcblxub25OZXQoJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6ZmlyZUVtcGxveWVlJywgYXN5bmMgKGNpdGl6ZW5JZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBjb25zdCB0YXJnZXREYXRhID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgaWYgKHRhcmdldERhdGEpIHtcbiAgICAgICAgY29uc3Qgam9ibmFtZSA9IHRhcmdldERhdGEuUGxheWVyRGF0YS5qb2IubmFtZTtcbiAgICAgICAgYXdhaXQgdGFyZ2V0RGF0YS5GdW5jdGlvbnMuU2V0Sm9iKCd1bmVtcGxveWVkJywgMCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogY2l0aXplbklkLCBqb2JOYW1lOiBqb2JuYW1lIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBmaXJlZCAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGJlZW4gZmlyZWQgYnkgJHtnbG9iYWwuc291cmNlfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgam9ibmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2VtcGxveWVlX2FjdGlvbicsXG4gICAgICAgICAgICB0aXRsZTogJ0VtcGxveWVlIEZpcmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgYmVlbiBmaXJlZCBieSAke2F3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgQ2l0aXplbklkOiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaXRpemVuaWR9IHwgSm9iOiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5qb2IubmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBwbGF5ZXJEYXRhOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIGpvYiBGUk9NIHBsYXllcnMgV0hFUkUgY2l0aXplbmlkID0gPyBMSU1JVCAxJywgW2NpdGl6ZW5JZF0pO1xuICAgICAgICBjb25zdCBqb2JEYXRhID0gSlNPTi5wYXJzZShwbGF5ZXJEYXRhWzBdLmpvYik7XG5cbiAgICAgICAgbGV0IGpvYjogYW55ID0ge307XG4gICAgICAgIGpvYi5uYW1lID0gJ3VuZW1wbG95ZWQnXG4gICAgICAgIGpvYi5sYWJlbCA9IEZyYW1ld29yay5TaGFyZWQuSm9ic1sndW5lbXBsb3llZCddLmxhYmVsXG4gICAgICAgIGpvYi5wYXltZW50ID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10uZ3JhZGVzWycwJ10ucGF5bWVudFxuICAgICAgICBqb2Iub25kdXR5ID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10uZGVmYXVsdER1dHlcbiAgICAgICAgam9iLmlzYm9zcyA9IGZhbHNlXG4gICAgICAgIGpvYi5ncmFkZSA9IHt9XG4gICAgICAgIGpvYi5ncmFkZS5uYW1lID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10uZ3JhZGVzWycwJ10ubmFtZVxuICAgICAgICBqb2IuZ3JhZGUubGV2ZWwgPSAwXG4gICAgICAgIGF3YWl0IFV0aWxzLnF1ZXJ5KCdVUERBVEUgcGxheWVycyBTRVQgam9iID0gPyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW0pTT04uc3RyaW5naWZ5KGpvYiksIGNpdGl6ZW5JZF0pO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCwgam9iTmFtZTogam9iRGF0YS5uYW1lIH0pO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JEYXRhLm5hbWUpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9lbXBsb3llZV9hY3Rpb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdPZmZsaW5lIEVtcGxveWVlIEZpcmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBPZmZsaW5lIGVtcGxveWVlICR7Y2l0aXplbklkfSBoYXMgYmVlbiBmaXJlZCBieSAke2F3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgSm9iOiAke2pvYkRhdGEubmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG59KTtcblxub25OZXQoJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Y2hhbmdlUmFua09mUGxheWVyJywgYXN5bmMgKGRhdGE6IGFueSkgPT4ge1xuICAgIGNvbnN0IHNvdXJjZSA9IGdsb2JhbC5zb3VyY2U7XG4gICAgY29uc3QgdGFyZ2V0RGF0YSA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChkYXRhLnRhcmdldENpdGl6ZW5pZCk7XG4gICAgY29uc3QgbXVsdGlKb2IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBkYXRhLnRhcmdldENpdGl6ZW5pZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lIH0pO1xuICAgIGlmICh0YXJnZXREYXRhKSB7XG4gICAgICAgIGNvbnN0IGpvYm5hbWUgPSBkYXRhLmpvYk5hbWU7XG4gICAgICAgIHRhcmdldERhdGEuRnVuY3Rpb25zLlNldEpvYihqb2JuYW1lLCBkYXRhLmtleSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGNoYW5nZWQgdGhlIHJhbmsgb2YgJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3VyIHJhbmsgaGFzIGJlZW4gY2hhbmdlZCBieSAke2F3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBpZiAobXVsdGlKb2IpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSB9LCB7IGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIFVwZGF0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiB1cGRhdGVkIHRvICR7ZGF0YS5qb2JOYW1lfSB8IE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfSBieSAke2F3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGdlbmVyYXRlVVVpZCgpLCBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUsIGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIEFkZGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtkYXRhLnRhcmdldENpdGl6ZW5pZH0gaGFzIGJlZW4gYWRkZWQgdG8gJHtkYXRhLmpvYk5hbWV9IHwgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9IGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBjaXRpemVuSWQ6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JuYW1lKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZW1wbG95ZWVfYWN0aW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUmFuayBDaGFuZ2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgYmVlbiBnaXZlbiBhIG5ldyByYW5rIGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBDaXRpemVuSWQ6ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH0gfCBKb2I6ICR7am9ibmFtZX0gfCAgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcGxheWVyRGF0YTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCBqb2IgRlJPTSBwbGF5ZXJzIFdIRVJFIGNpdGl6ZW5pZCA9ID8gTElNSVQgMScsIFtkYXRhLnRhcmdldENpdGl6ZW5pZF0pO1xuICAgICAgICBjb25zdCBqb2JEYXRhID0gSlNPTi5wYXJzZShwbGF5ZXJEYXRhWzBdLmpvYik7XG4gICAgICAgIGpvYkRhdGEuZ3JhZGUubGV2ZWwgPSBkYXRhLmtleTtcbiAgICAgICAgam9iRGF0YS5ncmFkZS5uYW1lID0gZGF0YS5ncmFkZU5hbWU7XG4gICAgICAgIGF3YWl0IFV0aWxzLnF1ZXJ5KCdVUERBVEUgcGxheWVycyBTRVQgam9iID0gPyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW0pTT04uc3RyaW5naWZ5KGpvYkRhdGEpLCBkYXRhLnRhcmdldENpdGl6ZW5pZF0pO1xuICAgICAgICBpZiAobXVsdGlKb2IpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSB9LCB7IGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIFVwZGF0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiB1cGRhdGVkIHRvICR7ZGF0YS5qb2JOYW1lfSB8IE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfSBieSAke2F3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGdlbmVyYXRlVVVpZCgpLCBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUsIGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIEFkZGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtkYXRhLnRhcmdldENpdGl6ZW5pZH0gaGFzIGJlZW4gYWRkZWQgdG8gJHtkYXRhLmpvYk5hbWV9IHwgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9IGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBjaXRpemVuSWQ6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JEYXRhLm5hbWUpO1xuICAgIH1cbn0pO1xuXG5vbk5ldCgnc3VtbWl0X3Bob25lOnNlcnZlcjpmaXJlSW5hY3RpdmVFbXBsb3llZScsIGFzeW5jIChkYXRhOiB7IGpvYk5hbWU6IHN0cmluZywgY2l0aXplbklkOiBzdHJpbmcgfSkgPT4ge1xuICAgIGNvbnN0IHNvdXJjZSA9IGdsb2JhbC5zb3VyY2U7XG4gICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBkYXRhLmNpdGl6ZW5JZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lIH0pO1xuICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGZpcmVkIGFuIGluYWN0aXZlIGVtcGxveWVlYCxcbiAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgfSkpO1xuICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBzb3VyY2UsIGRhdGEuam9iTmFtZSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9lbXBsb3llZV9hY3Rpb24nLFxuICAgICAgICB0aXRsZTogJ0luYWN0aXZlIEVtcGxveWVlIEZpcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYEluYWN0aXZlIGVtcGxveWVlICR7ZGF0YS5jaXRpemVuSWR9IGhhcyBiZWVuIGZpcmVkIGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBKb2I6ICR7ZGF0YS5qb2JOYW1lfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbignc3VtbWl0X3Bob25lOnNlcnZlcjpoaXJlaW5NdWx0aUpvYicsIGFzeW5jIChjbGllbnQ6IHN0cmluZywgam9ibmFtZTogc3RyaW5nLCBncmFkZUxldmVsOiBudW1iZXIsIGpvYkxhYmVsOiBzdHJpbmcsIGdyYWRlTGFiZWw6IHN0cmluZykgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdIaXJpbmcgaW4gbXVsdGkgam9iOicsIGpvYm5hbWUsIGdyYWRlTGV2ZWwsIGpvYkxhYmVsLCBncmFkZUxhYmVsKTtcbiAgICBjb25zdCB0YXJnZXRDaWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBtdWx0aUpvYkNoZWNrID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogdGFyZ2V0Q2lkLCBqb2JOYW1lOiBqb2JuYW1lIH0pO1xuICAgIGlmIChtdWx0aUpvYkNoZWNrKSB7XG4gICAgICAgIGlmIChtdWx0aUpvYkNoZWNrLmdyYWRlTGV2ZWwgIT09IGdyYWRlTGV2ZWwpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogdGFyZ2V0Q2lkLCBqb2JOYW1lOiBqb2JuYW1lIH0sIHsgZ3JhZGVMZXZlbCwgZ3JhZGVMYWJlbCB9KTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGJlZW4gaGlyZWQgaW4gYSBuZXcgcmFuazogJHtncmFkZUxhYmVsfWAsXG4gICAgICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBjbGllbnQsIGpvYm5hbWUpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgVXBkYXRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7dGFyZ2V0Q2lkfSBoYXMgYmVlbiB1cGRhdGVkIHRvICR7am9ibmFtZX0gfCBOZXcgUmFuazogJHtncmFkZUxhYmVsfSBieSAke2F3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZW1pdE5ldCgnUUJDb3JlOk5vdGlmeScsIGNsaWVudCwgJ1lvdSBhcmUgYWxyZWFkeSBpbiB0aGlzIGpvYiB3aXRoIHRoaXMgZ3JhZGUgbGV2ZWwnLCAnZXJyb3InKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZ2VuZXJhdGVVVWlkKCksIGNpdGl6ZW5JZDogdGFyZ2V0Q2lkLCBqb2JOYW1lOiBqb2JuYW1lLCAgZ3JhZGVMZXZlbDogZ3JhZGVMZXZlbCwgam9iTGFiZWw6IGpvYkxhYmVsLCBncmFkZUxhYmVsOiBncmFkZUxhYmVsIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBiZWVuIGhpcmVkIGluIGEgbmV3IGpvYjogJHtqb2JMYWJlbH0gYXMgJHtncmFkZUxhYmVsfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIGNsaWVudCwgam9ibmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBBZGRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHt0YXJnZXRDaWR9IGhhcyBiZWVuIGFkZGVkIHRvICR7am9ibmFtZX0gfCBOZXcgUmFuazogJHtncmFkZUxhYmVsfSBieSAke2F3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IHwgY2l0aXplbklkOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbn0pXG5cbnNldEltbWVkaWF0ZShhc3luYyAoKSA9PiB7XG4gICAgbGV0IGlzREJDb25uZWN0ZWQgPSBleHBvcnRzWydtb25nb0RCJ10uaXNEQkNvbm5lY3RlZCgpO1xuICAgIHdoaWxlIChpc0RCQ29ubmVjdGVkID09PSBmYWxzZSkge1xuICAgICAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICAgICAgaXNEQkNvbm5lY3RlZCA9IGV4cG9ydHNbJ21vbmdvREInXS5pc0RCQ29ubmVjdGVkKCk7XG4gICAgICAgIGlmIChpc0RCQ29ubmVjdGVkKSB7XG4gICAgICAgICAgICBMT0dHRVIoXCJbU2V0dGluZ3NdIE1vbmdvREIgY29ubmVjdGVkLlwiKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGpvYkFycmF5OiBhbnkgPSB7fTtcbiAgICBjb25zdCBqb2JEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnc3VtbWl0X2pvYnMnLCB7fSk7XG4gICAgam9iRGF0YS5mb3JFYWNoKGFzeW5jIChqb2I6IGFueSkgPT4ge1xuICAgICAgICBjb25zdCB7IF9pZCwgLi4ucmVzdCB9ID0gam9iO1xuICAgICAgICBMT0dHRVIoYFtTVU1NSVRfUEhPTkVdIENyZWF0ZWQgam9iICR7X2lkfSBTdWNjZXNzZnVsbHlgKTtcbiAgICAgICAgam9iQXJyYXlbX2lkXSA9IHJlc3Q7XG4gICAgfSk7XG4gICAgLyogY29uc3QgW3VwZGF0ZWQsIG1lc3NhZ2VdID0gZXhwb3J0c1sncWItY29yZSddLkFkZEpvYnMoam9iQXJyYXkpOyAqL1xufSk7ICIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgUGhvbmVNYWlsLCBQaG9uZVBsYXllckNhcmQgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4vY2xhc3NcIjtcblxub25DbGllbnRDYWxsYmFjaygnR2V0Q2xpZW50U2V0dGluZ3MnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIF9pZDogU2V0dGluZ3MuX2lkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBiYWNrZ3JvdW5kOiBTZXR0aW5ncy5iYWNrZ3JvdW5kLmdldChjaXRpemVuSWQpLFxuICAgICAgICBsb2Nrc2NyZWVuOiBTZXR0aW5ncy5sb2Nrc2NyZWVuLmdldChjaXRpemVuSWQpLFxuICAgICAgICByaW5ndG9uZTogU2V0dGluZ3MucmluZ3RvbmUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiBTZXR0aW5ncy5zaG93U3RhcnR1cFNjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgc2hvd05vdGlmaWNhdGlvbnM6IFNldHRpbmdzLnNob3dOb3RpZmljYXRpb25zLmdldChjaXRpemVuSWQpLFxuICAgICAgICBpc0xvY2s6IFNldHRpbmdzLmlzTG9jay5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgbG9ja1BpbjogU2V0dGluZ3MubG9ja1Bpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgdXNlUGluOiBTZXR0aW5ncy51c2VQaW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHVzZUZhY2VJZDogU2V0dGluZ3MudXNlRmFjZUlkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiBTZXR0aW5ncy5mYWNlSWRJZGVudGlmaWVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICBzbXJ0SWQ6IFNldHRpbmdzLnNtcnRJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiBTZXR0aW5ncy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHNtcnRQYXNzd29yZDogU2V0dGluZ3Muc21ydFBhc3N3b3JkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBpc0ZsaWdodE1vZGU6IFNldHRpbmdzLmlzRmxpZ2h0TW9kZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgcGhvbmVOdW1iZXI6IFNldHRpbmdzLnBob25lTnVtYmVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICBwaWdlb25JZEF0dGFjaGVkOiBTZXR0aW5ncy5waWdlb25JZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1NldENsaWVudFNldHRpbmdzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgYmFja2dyb3VuZDogeyBjdXJyZW50OiBzdHJpbmc7IHdhbGxwYXBlcnM6IHN0cmluZ1tdIH07XG4gICAgICAgIGxvY2tzY3JlZW46IHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9O1xuICAgICAgICByaW5ndG9uZTogeyBjdXJyZW50OiBzdHJpbmc7IHJpbmd0b25lczogeyBuYW1lOiBzdHJpbmcsIHVybDogc3RyaW5nIH1bXSB9O1xuICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogYm9vbGVhbjtcbiAgICAgICAgc2hvd05vdGlmaWNhdGlvbnM6IGJvb2xlYW47XG4gICAgICAgIGlzTG9jazogYm9vbGVhbjtcbiAgICAgICAgbG9ja1Bpbjogc3RyaW5nO1xuICAgICAgICB1c2VQaW46IGJvb2xlYW47XG4gICAgICAgIHVzZUZhY2VJZDogYm9vbGVhbjtcbiAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogc3RyaW5nO1xuICAgICAgICBzbXJ0SWQ6IHN0cmluZztcbiAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiBzdHJpbmc7XG4gICAgICAgIHNtcnRQYXNzd29yZDogc3RyaW5nO1xuICAgICAgICBpc0ZsaWdodE1vZGU6IGJvb2xlYW47XG4gICAgICAgIHBob25lTnVtYmVyOiBzdHJpbmc7XG4gICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBTZXR0aW5ncy5iYWNrZ3JvdW5kLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuYmFja2dyb3VuZCk7XG4gICAgU2V0dGluZ3MubG9ja3NjcmVlbi5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmxvY2tzY3JlZW4pO1xuICAgIFNldHRpbmdzLnJpbmd0b25lLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEucmluZ3RvbmUpO1xuICAgIFNldHRpbmdzLnNob3dTdGFydHVwU2NyZWVuLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuc2hvd1N0YXJ0dXBTY3JlZW4pO1xuICAgIFNldHRpbmdzLnNob3dOb3RpZmljYXRpb25zLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuc2hvd05vdGlmaWNhdGlvbnMpO1xuICAgIFNldHRpbmdzLmlzTG9jay5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmlzTG9jayk7XG4gICAgU2V0dGluZ3MubG9ja1Bpbi5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmxvY2tQaW4pO1xuICAgIFNldHRpbmdzLnVzZVBpbi5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnVzZVBpbik7XG4gICAgU2V0dGluZ3MudXNlRmFjZUlkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEudXNlRmFjZUlkKTtcbiAgICBTZXR0aW5ncy5mYWNlSWRJZGVudGlmaWVyLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuZmFjZUlkSWRlbnRpZmllcik7XG4gICAgU2V0dGluZ3Muc21ydElkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuc21ydElkKTtcbiAgICBTZXR0aW5ncy5zbXJ0UGFzc3dvcmQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5zbXJ0UGFzc3dvcmQpO1xuICAgIFNldHRpbmdzLmlzRmxpZ2h0TW9kZS5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmlzRmxpZ2h0TW9kZSk7XG4gICAgU2V0dGluZ3MuZGFya01haWxJZEF0dGFjaGVkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuZGFya01haWxJZEF0dGFjaGVkKTtcbiAgICBTZXR0aW5ncy5waG9uZU51bWJlci5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnBob25lTnVtYmVyKTtcbiAgICBTZXR0aW5ncy5waWdlb25JZEF0dGFjaGVkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEucGlnZW9uSWRBdHRhY2hlZCk7XG4gICAgYXdhaXQgU2V0dGluZ3MuU2F2ZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9zZXR0aW5ncycsXG4gICAgICAgIHRpdGxlOiAnU2V0dGluZ3MgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke2NpdGl6ZW5JZH0gfCBOYW1lOiAke2dsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfSBuZXcgc2V0dGluZ3MsICR7SlNPTi5zdHJpbmdpZnkocGFyc2VkRGF0YSl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1JlZ2lzdGVyTmV3TWFpbEFjY291bnQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhOiB7XG4gICAgICAgIGVtYWlsOiBzdHJpbmc7XG4gICAgICAgIHBhc3N3b3JkOiBzdHJpbmc7XG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgZGF0YVg6IFBob25lTWFpbCA9IHtcbiAgICAgICAgYWN0aXZlTWFpZElkOiBwYXJzZWREYXRhLmVtYWlsLFxuICAgICAgICB1c2VybmFtZTogcGFyc2VkRGF0YS5lbWFpbCxcbiAgICAgICAgYWN0aXZlTWFpbFBhc3N3b3JkOiBwYXJzZWREYXRhLnBhc3N3b3JkLFxuICAgICAgICBhdmF0b3I6ICcnLFxuICAgICAgICBtZXNzYWdlczogW10sXG4gICAgfVxuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHBhcnNlZERhdGEuZW1haWwsIC4uLmRhdGFYIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZW1haWwnLFxuICAgICAgICB0aXRsZTogJ0VtYWlsIEFjY291bnQgUmVnaXN0ZXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBOZXcgZW1haWwgYWNjb3VudCByZWdpc3RlcmVkIHdpdGggZW1haWwgJHtwYXJzZWREYXRhLmVtYWlsfSwgcGFzc3dvcmQgXCIke3BhcnNlZERhdGEucGFzc3dvcmR9XCIsIENpdGl6ZW5JZDogJHthd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCl9LCBOYW1lOiAke2dsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1NlYXJjaEVtYWlsJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfbWFpbCcsIHsgX2lkOiBkYXRhIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0xvZ2luTWFpbEFjY291bnQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhOiB7XG4gICAgICAgIGVtYWlsOiBzdHJpbmc7XG4gICAgICAgIHBhc3N3b3JkOiBzdHJpbmc7XG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHBhcnNlZERhdGEuZW1haWwgfSk7XG4gICAgaWYgKHJlcy5hY3RpdmVNYWlsUGFzc3dvcmQgPT09IHBhcnNlZERhdGEucGFzc3dvcmQpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZW1haWwnLFxuICAgICAgICAgICAgdGl0bGU6ICdFbWFpbCBMb2dpbicsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCl9IE5hbWU6ICR7Z2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IGxvZ2dlZCBpbiB0byBlbWFpbCBhY2NvdW50ICR7cGFyc2VkRGF0YS5lbWFpbH0sIHBhc3N3b3JkIFwiJHtwYXJzZWREYXRhLnBhc3N3b3JkfVwiYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygndW5Mb2Nrb3JMb2NrUGhvbmUnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBib29sZWFuKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIFNldHRpbmdzLmlzTG9jay5zZXQoY2l0aXplbklkLCBkYXRhKTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRQaG9uZVBsYXllckNhcmQnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfcGxheWVyX2NhcmQnLCB7IF9pZDogY2l0aXplbklkIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lOnVwZGF0ZVBlcnNvbmFsQ2FyZCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IFBob25lUGxheWVyQ2FyZCA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX3BsYXllcl9jYXJkJywgeyBfaWQ6IHBhcnNlZERhdGEuX2lkIH0sIHBhcnNlZERhdGEpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfcGVyc29uYWxfY2FyZCcsXG4gICAgICAgIHRpdGxlOiAnUGVyc29uYWwgQ2FyZCBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7cGFyc2VkRGF0YS5faWR9IHwgTmFtZTogJHtnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX0gdXBkYXRlZCBwZXJzb25hbCBjYXJkLCAke0pTT04uc3RyaW5naWZ5KHBhcnNlZERhdGEpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pOyIsICJpbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL2NsYXNzXCI7XG5pbXBvcnQgeyB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5cblJlZ2lzdGVyQ29tbWFuZCgnc2F2ZVNldHRpbmdzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBhcmdzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGF3YWl0IFNldHRpbmdzLnNhdmUoKTtcbn0sIHRydWUpO1xuXG5jb25zdCBnZW5lcmF0ZVBob25lTnVtYmVyID0gYXN5bmMgKCk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gICAgY29uc3QgbnVtYmVyID0gTWF0aC5mbG9vcigxMDAwMDAwMDAwICsgTWF0aC5yYW5kb20oKSAqIDkwMDAwMDAwMDApLnRvU3RyaW5nKCk7XG4gICAgY29uc3QgZXhpc3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9udW1iZXJzJywgeyBudW1iZXI6IG51bWJlciB9KTtcbiAgICBpZiAoZXhpc3RzKSByZXR1cm4gZ2VuZXJhdGVQaG9uZU51bWJlcigpO1xuICAgIHJldHVybiBudW1iZXI7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBHZW5lcmF0ZVBsYXllclBob25lTnVtYmVyKGNpdGl6ZW5JZDogc3RyaW5nLCBzb3VyY2U6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IGdlbmVyYXRlUGhvbmVOdW1iZXIoKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbnVtYmVycycsIHtcbiAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgb3duZXI6IGNpdGl6ZW5JZCxcbiAgICAgICAgbnVtYmVyOiBudW1iZXIsXG4gICAgfSk7XG5cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7XG4gICAgICAgIF9pZDogY2l0aXplbklkLFxuICAgICAgICBiYWNrZ3JvdW5kOiB7XG4gICAgICAgICAgICBjdXJyZW50OiAnJyxcbiAgICAgICAgICAgIHdhbGxwYXBlcnM6IFtdLFxuICAgICAgICB9LFxuICAgICAgICBsb2Nrc2NyZWVuOiB7XG4gICAgICAgICAgICBjdXJyZW50OiAnJyxcbiAgICAgICAgICAgIHdhbGxwYXBlcnM6IFtdLFxuICAgICAgICB9LFxuICAgICAgICByaW5ndG9uZToge1xuICAgICAgICAgICAgY3VycmVudDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLFxuICAgICAgICAgICAgcmluZ3RvbmVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGVmYXVsdCcsXG4gICAgICAgICAgICAgICAgICAgIHVybDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0cnVlLFxuICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdHJ1ZSxcbiAgICAgICAgaXNMb2NrOiB0cnVlLFxuICAgICAgICBsb2NrUGluOiAnJyxcbiAgICAgICAgdXNlUGluOiB0cnVlLFxuICAgICAgICBwaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgICB1c2VGYWNlSWQ6IGZhbHNlLFxuICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiBjaXRpemVuSWQsXG4gICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogJycsXG4gICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6ICcnLFxuICAgICAgICBzbXJ0SWQ6ICcnLFxuICAgICAgICBzbXJ0UGFzc3dvcmQ6ICcnLFxuICAgICAgICBpc0ZsaWdodE1vZGU6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX3BsYXllcl9jYXJkJywge1xuICAgICAgICBfaWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgZmlyc3ROYW1lOiAnU2V0dXAnLFxuICAgICAgICBsYXN0TmFtZTogJ0NhcmQnLFxuICAgICAgICBwaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgICBlbWFpbDogJycsXG4gICAgICAgIG5vdGVzOiAnJyxcbiAgICAgICAgYXZhdGFyOiAnJyxcbiAgICB9KTtcbiAgICBTZXR0aW5ncy5SZWdpc3Rlck5ld1NldHRpbmdzKGNpdGl6ZW5JZCwgbnVtYmVyKTtcblx0aWYgKHNvdXJjZSkge1xuXHRcdGVtaXROZXQoJ3Bob25lOmNsaWVudDpzZXR1cFBob25lJywgc291cmNlLCBjaXRpemVuSWQpO1xuXHR9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9zZXR0aW5ncycsXG4gICAgICAgIHRpdGxlOiAnUGhvbmUgTnVtYmVyIEdlbmVyYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQaG9uZSBudW1iZXIgJHtudW1iZXJ9IGdlbmVyYXRlZCBmb3IgJHtjaXRpemVuSWR9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlLFxuICAgIH0pO1xuICAgIHJldHVybiBudW1iZXI7XG59XG5leHBvcnRzKCdHZW5lcmF0ZVBsYXllclBob25lTnVtYmVyJywgR2VuZXJhdGVQbGF5ZXJQaG9uZU51bWJlcik7XG5cbm9uKCd0eEFkbWluOmV2ZW50czpzY2hlZHVsZWRSZXN0YXJ0JywgYXN5bmMgKGRhdGE6IGFueSkgPT4ge1xuICAgIGF3YWl0IFNldHRpbmdzLnNhdmUoKTtcbiAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgZHVyaW5nIHJlc291cmNlIHN0b3AuYCk7XG59KTtcblxub24oJ3R4QWRtaW46ZXZlbnRzOnNlcnZlclNodXR0aW5nRG93bicsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBTZXR0aW5ncy5zYXZlKCk7XG4gICAgTE9HR0VSKGBbU2V0dGluZ3NdIFNhdmVkIGR1cmluZyByZXNvdXJjZSBzdG9wLmApO1xufSk7IiwgImltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgVHdlZXREYXRhLCBUd2VldFByb2ZpbGVEYXRhIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcblxuY2xhc3MgUGlnZW9uU2VydmljZSB7XG4gICAgcHVibGljIGFzeW5jIHNlYXJjaFVzZXJFeGlzdChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogZGF0YSB9KTtcbiAgICAgICAgcmV0dXJuICEhdXNlcjtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbG9naW4oX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwsIHBhc3N3b3JkIH0pO1xuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVXNlciBMb2dpbicsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyIHdpdGggZW1haWwgJHtlbWFpbH0gbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseS5gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBsb2dpbjpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNpZ251cChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBleGlzdGluZ1VzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKGV4aXN0aW5nVXNlcikge1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiRW1haWwgYWxyZWFkeSB0YWtlblwiIH07XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGVtYWlsLFxuICAgICAgICAgICAgcGFzc3dvcmQsXG4gICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICB1c2VybmFtZTogZW1haWwsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZTogZW1haWwsXG4gICAgICAgICAgICBhdmF0YXI6IFwiXCIsXG4gICAgICAgICAgICBiYW5uZXI6IFwiXCIsXG4gICAgICAgICAgICBub3RpZmljYXRpb25zRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgYmlvOiBcIlwiLFxuICAgICAgICAgICAgZm9sbG93ZXJzOiBbXSxcbiAgICAgICAgICAgIGZvbGxvd2luZzogW10sXG4gICAgICAgIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdVc2VyIFNpZ251cCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgTmV3IHVzZXIgYWNjb3VudCBjcmVhdGVkIHdpdGggZW1haWwgJHtlbWFpbH0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldFByb2ZpbGUoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHVzZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFwiVXNlciBub3QgZm91bmRcIjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyB0b2dnbGVOb3RpZmljYXRpb25zKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgcmVzLm5vdGlmaWNhdGlvbnNFbmFibGVkID0gIXJlcy5ub3RpZmljYXRpb25zRW5hYmxlZDtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSwgcmVzKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTm90aWZpY2F0aW9ucyBUb2dnbGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSB0b2dnbGVkIG5vdGlmaWNhdGlvbnMgdG8gJHtyZXMubm90aWZpY2F0aW9uc0VuYWJsZWQgPyAnZW5hYmxlZCcgOiAnZGlzYWJsZWQnfS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBwb3N0VHdlZXQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IGVtYWlsLCBjb250ZW50LCBhdHRhY2htZW50cyB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCFyZXMpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgY29uc3QgdHdlZXQ6IFR3ZWV0RGF0YSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHVzZXJuYW1lOiByZXMuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICAgICAgZW1haWw6IHJlcy5lbWFpbCxcbiAgICAgICAgICAgICAgICBhdmF0YXI6IHJlcy5hdmF0YXIsXG4gICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHJlcy52ZXJpZmllZCxcbiAgICAgICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICAgICAgcmVwbGllc0NvdW50OiBbXSxcbiAgICAgICAgICAgICAgICByZXR3ZWV0Q291bnQ6IFtdLFxuICAgICAgICAgICAgICAgIGlzUmV0d2VldDogZmFsc2UsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiBudWxsLFxuICAgICAgICAgICAgICAgIGhhc2h0YWdzOiBjb250ZW50Lm1hdGNoKC8jXFx3Ky9nKSB8fCBbXSxcbiAgICAgICAgICAgICAgICBwYXJlbnRUd2VldElkOiBudWxsLFxuXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHR3ZWV0KTtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZWZyZXNoVHdlZXRcIiwgLTEsIEpTT04uc3RyaW5naWZ5KHR3ZWV0KSk7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCAtMSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBUd2VldCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3Jlcy5kaXNwbGF5TmFtZX0gaGFzIHBvc3RlZCBhIG5ldyB0d2VldC5gLFxuICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBgJHtyZXMuZGlzcGxheU5hbWV9IGhhcyBwb3N0ZWQgYSBuZXcgdHdlZXQuYCxcbiAgICAgICAgICAgICAgICBlbWFpbDogcmVzLmVtYWlsLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwicG9zdFwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IFBvc3RlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gcG9zdGVkIGEgbmV3IHR3ZWV0IChJRDogJHt0d2VldC5faWR9KSwgY29udGVudDogJHtjb250ZW50fWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBwb3N0VHdlZXQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRBbGxGZWVkKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgc3RhcnQgPSAxLCBlbmQgPSAyMCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHt9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgICAgIHNraXA6IHN0YXJ0IC0gMSxcbiAgICAgICAgICAgICAgICBsaW1pdDogZW5kLFxuICAgICAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBkYXRhOiByZXMsXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiByZXMubGVuZ3RoLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0RmVlZDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHBvc3RSZXBseShjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCBjb250ZW50LCBlbWFpbCwgYXR0YWNobWVudHMgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbXCJxYi1jb3JlXCJdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgY29uc3QgdHdlZXQ6IFR3ZWV0RGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHJldHVybiB7IGVycm9yOiBcIlR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgIGNvbnN0IHJlcGx5ID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHVzZXJuYW1lOiB1c2VyLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgICAgICBhdmF0YXI6IHVzZXIuYXZhdGFyLFxuICAgICAgICAgICAgdmVyaWZpZWQ6IHVzZXIudmVyaWZpZWQsXG4gICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgYXR0YWNobWVudHMsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICByZXBsaWVzQ291bnQ6IFtdLFxuICAgICAgICAgICAgcmV0d2VldENvdW50OiBbXSxcbiAgICAgICAgICAgIGlzUmV0d2VldDogZmFsc2UsXG4gICAgICAgICAgICBvcmlnaW5hbFR3ZWV0SWQ6IHR3ZWV0SWQsXG4gICAgICAgICAgICBoYXNodGFnczogY29udGVudC5tYXRjaCgvI1xcdysvZykgfHwgW10sXG4gICAgICAgICAgICBwYXJlbnRUd2VldElkOiBudWxsXG4gICAgICAgIH07XG4gICAgICAgIHR3ZWV0LnJlcGxpZXNDb3VudC5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHJlcGx5KTtcbiAgICAgICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJlZnJlc2hSZXBvc3RcIiwgLTEsIEpTT04uc3RyaW5naWZ5KHJlcGx5KSk7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChhd2FpdCBVdGlscy5HZXRDaWRGcm9tVHdlZXRJZCh0d2VldC5lbWFpbCkpO1xuICAgICAgICBpZiAocmVzKSB7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZXMuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgUmVwbHknLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHt1c2VyLmRpc3BsYXlOYW1lfSBoYXMgcmVwbGllZCB0byB0d2VldC5gLFxuICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBgJHt1c2VyLmRpc3BsYXlOYW1lfSBoYXMgcmVwbGllZCB0byB0d2VldC5gLFxuICAgICAgICAgICAgICAgIGVtYWlsOiB0d2VldC5lbWFpbCxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcInBvc3RcIixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1JlcGx5IFBvc3RlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSByZXBsaWVkIHRvIHR3ZWV0IChJRDogJHt0d2VldElkfSksIGNvbnRlbnQ6ICR7Y29udGVudH1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGxpa2VUd2VldChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQsIGxpa2UsIGVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHJldHVybiB7IGVycm9yOiBcIlR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgIGlmIChsaWtlKSB7XG4gICAgICAgICAgICB0d2VldC5saWtlQ291bnQucHVzaChlbWFpbCk7XG4gICAgICAgICAgICBjb25zdCBjaWQgPSBhd2FpdCBVdGlscy5HZXRDaWRGcm9tVHdlZXRJZCh0d2VldC5lbWFpbCk7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQoY2lkKTtcbiAgICAgICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZXMuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBMaWtlJyxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke2VtYWlsfSBoYXMgbGlrZWQgeW91ciB0d2VldC5gLFxuICAgICAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBgJHtlbWFpbH0gaGFzIGxpa2VkIHlvdXIgdHdlZXQuYCxcbiAgICAgICAgICAgICAgICAgICAgZW1haWw6IHR3ZWV0LmVtYWlsLFxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJsaWtlXCIsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IExpa2VkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBsaWtlZCB0d2VldCAoSUQ6ICR7dHdlZXRJZH0pLmAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0d2VldC5saWtlQ291bnQgPSB0d2VldC5saWtlQ291bnQuZmlsdGVyKChsOiBhbnkpID0+IGwgIT09IGVtYWlsKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgTGlrZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGxpa2VkIHR3ZWV0IChJRDogJHt0d2VldElkfSkuYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbGlrZVJlcGxpZXNUd2VldChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQsIGxpa2UsIGVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkgcmV0dXJuIGNvbnNvbGUubG9nKFwiVHdlZXQgbm90IGZvdW5kXCIpO1xuICAgICAgICBpZiAobGlrZSkge1xuICAgICAgICAgICAgdHdlZXQubGlrZUNvdW50LnB1c2goZW1haWwpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBMaWtlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gbGlrZWQgcmVwbHkgKElEOiAke3R3ZWV0SWR9KS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHdlZXQubGlrZUNvdW50ID0gdHdlZXQubGlrZUNvdW50LmZpbHRlcigobDogYW55KSA9PiBsICE9PSBlbWFpbCk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1JlcGx5IFVubGlrZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IHVubGlrZWQgcmVwbHkgKElEOiAke3R3ZWV0SWR9KS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHJldHdlZXQoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQsIHJldHdlZXQsIHBpZ2VvbklkLCBvZ1R3ZWV0SWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAocmV0d2VldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldFdlZXR1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHBpZ2VvbklkIH0pO1xuICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWxUd2VldCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJPcmlnaW5hbCB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudC5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIG9yaWdpbmFsVHdlZXQpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcmV0d2VldERhdGE6IFR3ZWV0RGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgdXNlcm5hbWU6IHJldFdlZXR1c2VyLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgICAgICAgICBlbWFpbDogcmV0V2VldHVzZXIuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgIGF2YXRhcjogcmV0V2VldHVzZXIuYXZhdGFyLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZDogcmV0V2VldHVzZXIudmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG9yaWdpbmFsVHdlZXQuY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHM6IG9yaWdpbmFsVHdlZXQuYXR0YWNobWVudHMsXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICBsaWtlQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICByZXBsaWVzQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICByZXR3ZWV0Q291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICBpc1JldHdlZXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXRJZDogdHdlZXRJZCxcbiAgICAgICAgICAgICAgICAgICAgaGFzaHRhZ3M6IG9yaWdpbmFsVHdlZXQuaGFzaHRhZ3MsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFR3ZWV0SWQ6IG51bGwsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgcmV0d2VldERhdGEpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZWZyZXNoVHdlZXRcIiwgLTEsIEpTT04uc3RyaW5naWZ5KHJldHdlZXREYXRhKSk7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IFJldHdlZXRlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7cGlnZW9uSWR9IHJldHdlZXRlZCB0d2VldCAoSUQ6ICR7dHdlZXRJZH0pLCBvcmlnaW5hbCB0d2VldCBJRDogJHtvZ1R3ZWV0SWR9LCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IG9nVHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIW9yaWdpbmFsVHdlZXQgfHwgIXJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiT3JpZ2luYWwgdHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgb25seSBmaXJzdCBvY2N1cnJlbmNlIG9mIGNpdGl6ZW5JZFxuICAgICAgICAgICAgICAgIGxldCByZW1vdmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQgPSBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudC5maWx0ZXIoKGw6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobCA9PT0gY2l0aXplbklkICYmICFyZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IG9nVHdlZXRJZCB9LCBvcmlnaW5hbFR3ZWV0KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1JldHdlZXQgUmVtb3ZlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyIHJlbW92ZWQgcmV0d2VldCAoSUQ6ICR7dHdlZXRJZH0pIG9mIG9yaWdpbmFsIHR3ZWV0IChJRDogJHtvZ1R3ZWV0SWR9KSwgY29udGVudDogJHtvcmlnaW5hbFR3ZWV0LmNvbnRlbnR9YCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gcmV0d2VldDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHJldHdlZXRSZXBsaWVzVHdlZXQoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQsIHJldHdlZXQsIHBpZ2VvbklkLCBvZ1R3ZWV0SWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAocmV0d2VldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2dUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IG9yaWdpbmFsVHdlZXQub3JpZ2luYWxUd2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldFdlZXR1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHBpZ2VvbklkIH0pO1xuICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWxUd2VldCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJPcmlnaW5hbCB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudC5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgb2dUd2VldC5yZXBsaWVzQ291bnQucHVzaChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb3JpZ2luYWxUd2VldC5vcmlnaW5hbFR3ZWV0SWQgfSwgb2dUd2VldCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgb3JpZ2luYWxUd2VldCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCByZXR3ZWV0RGF0YTogVHdlZXREYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB1c2VybmFtZTogcmV0V2VldHVzZXIuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGVtYWlsOiByZXRXZWV0dXNlci5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgYXZhdGFyOiByZXRXZWV0dXNlci5hdmF0YXIsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiByZXRXZWV0dXNlci52ZXJpZmllZCxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogb3JpZ2luYWxUd2VldC5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50czogb3JpZ2luYWxUd2VldC5hdHRhY2htZW50cyxcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJlcGxpZXNDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJldHdlZXRDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIGlzUmV0d2VldDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiBvcmlnaW5hbFR3ZWV0Lm9yaWdpbmFsVHdlZXRJZCxcbiAgICAgICAgICAgICAgICAgICAgaGFzaHRhZ3M6IG9yaWdpbmFsVHdlZXQuaGFzaHRhZ3MsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFR3ZWV0SWQ6IHR3ZWV0SWQsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCByZXR3ZWV0RGF0YSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJlZnJlc2hSZXBvc3RcIiwgLTEsIEpTT04uc3RyaW5naWZ5KHJldHdlZXREYXRhKSk7XG4gICAgICAgICAgICAgICAgaWYgKG9nVHdlZXQucmVwbGllc0NvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVuaXF1ZUNpZHMgPSBbLi4ubmV3IFNldChvZ1R3ZWV0LnJlcGxpZXNDb3VudCldO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJlcGx5Q2lkIG9mIHVuaXF1ZUNpZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZXBseUNpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZXMuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgUmVwbHknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtyZXRXZWV0dXNlci5kaXNwbGF5TmFtZX0gaGFzIHJlcGxpZWQgdG8gdHdlZXQuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDogYHtyZXRXZWV0dXNlci5kaXNwbGF5TmFtZX0gaGFzIHJlcGxpZWQgdG8gdHdlZXQuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWFpbDogcmV0V2VldHVzZXIuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJwb3N0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUmVwbHkgUmV0d2VldGVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtwaWdlb25JZH0gcmV0d2VldGVkIHJlcGx5IChJRDogJHt0d2VldElkfSksIG9yaWdpbmFsIHR3ZWV0IElEOiAke29nVHdlZXRJZH0pLCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogb2dUd2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcmlnaW5hbFR3ZWV0IHx8ICFyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIk9yaWdpbmFsIHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUmVtb3ZlIG9ubHkgZmlyc3Qgb2NjdXJyZW5jZSBvZiBjaXRpemVuSWRcbiAgICAgICAgICAgICAgICBsZXQgcmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50ID0gb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQuZmlsdGVyKChsOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGwgPT09IGNpdGl6ZW5JZCAmJiAhcmVtb3ZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cob3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiBvZ1R3ZWV0SWQgfSwgb3JpZ2luYWxUd2VldCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1JldHdlZXQgb2YgUmVwbHkgUmVtb3ZlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyIHJlbW92ZWQgcmV0d2VldCAoSUQ6ICR7dHdlZXRJZH0pIG9mIHJlcGx5IChJRDogJHtvZ1R3ZWV0SWR9KSwgY29udGVudDogJHtvcmlnaW5hbFR3ZWV0LmNvbnRlbnR9YCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gcmV0d2VldDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGRlbGV0ZVR3ZWV0KF9jbGllbnQ6IG51bWJlciwgdHdlZXRJZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgVHdlZXQgbm90IGZvdW5kIGZvciBkZWxldGlvbjogJHt0d2VldElkfWApO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgRGVsZXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVHdlZXQgKElEOiAke3R3ZWV0SWR9KSBkZWxldGVkIGJ5IHVzZXIgJHt0d2VldC5lbWFpbH0sIGNvbnRlbnQ6ICR7dHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGRlbGV0ZVJlcGxpZXNUd2VldChfY2xpZW50OiBudW1iZXIsIHR3ZWV0SWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgUmVwbHkgdHdlZXQgbm90IGZvdW5kIGZvciBkZWxldGlvbjogJHt0d2VldElkfWApO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiUmVwbHkgdHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBEZWxldGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBSZXBseSAoSUQ6ICR7dHdlZXRJZH0pIGRlbGV0ZWQsIGNvbnRlbnQ6ICR7dHdlZXQuY29udGVudH0gYnkgdXNlciAke3R3ZWV0LmVtYWlsfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldFBvc3RSZXBsaWVzKF9jbGllbnQ6IG51bWJlciwgdHdlZXRJZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHJlcGxpZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgb3JpZ2luYWxUd2VldElkOiB0d2VldElkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcGxpZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBpbmNyZWFzZVJlcGxpZXNDb3VudChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHJldHVybiB7IGVycm9yOiBcIlR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgIHR3ZWV0LnJlcGxpZXNDb3VudC5wdXNoKGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGVjcmVhc2VSZXBsaWVzQ291bnQoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHR3ZWV0SWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICBjb25zdCBjaWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcblxuICAgICAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgaWYgKCF0d2VldCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFR3ZWV0IG5vdCBmb3VuZCBmb3IgdHdlZXRJZDogJHt0d2VldElkfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIlR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCByZW1vdmVkID0gZmFsc2U7XG4gICAgICAgICAgICB0d2VldC5yZXBsaWVzQ291bnQgPSB0d2VldC5yZXBsaWVzQ291bnQuZmlsdGVyKChyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAociA9PT0gY2lkICYmICFyZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZVJlc3VsdCA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG5cbiAgICAgICAgICAgIGlmICghdXBkYXRlUmVzdWx0IHx8IHVwZGF0ZVJlc3VsdC5tb2RpZmllZENvdW50ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBObyBjaGFuZ2VzIG1hZGUgdG8gdHdlZXQgJHt0d2VldElkfSByZXBsaWVzQ291bnRgKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogXCJObyBjaGFuZ2VzIG1hZGUgdG8gcmVwbGllcyBjb3VudFwiIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBTdWNjZXNzZnVsbHkgZGVjcmVhc2VkIHJlcGxpZXNDb3VudCBmb3IgdHdlZXQgJHt0d2VldElkfWApO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZGVjcmVhc2VSZXBsaWVzQ291bnQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIsIGRldGFpbHM6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBmb2xsb3dVc2VyKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgdGFyZ2V0RW1haWwsIGN1cnJlbnRFbWFpbCwgZm9sbG93IH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0VXNlcjogVHdlZXRQcm9maWxlRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiB0YXJnZXRFbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghdGFyZ2V0VXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVGFyZ2V0IHVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgY29uc3QgY3VycmVudFVzZXI6IFR3ZWV0UHJvZmlsZURhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogY3VycmVudEVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCFjdXJyZW50VXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiQ3VycmVudCB1c2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGlmIChmb2xsb3cpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldFVzZXIuZm9sbG93ZXJzLmluY2x1ZGVzKGN1cnJlbnRFbWFpbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0VXNlci5mb2xsb3dlcnMucHVzaChjdXJyZW50RW1haWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIWN1cnJlbnRVc2VyLmZvbGxvd2luZy5pbmNsdWRlcyh0YXJnZXRFbWFpbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFVzZXIuZm9sbG93aW5nLnB1c2godGFyZ2V0RW1haWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVXNlciBGb2xsb3dlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7Y3VycmVudEVtYWlsfSBmb2xsb3dlZCAke3RhcmdldEVtYWlsfS5gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRhcmdldFVzZXIuZm9sbG93ZXJzID0gdGFyZ2V0VXNlci5mb2xsb3dlcnMuZmlsdGVyKGVtYWlsID0+IGVtYWlsICE9PSBjdXJyZW50RW1haWwpO1xuICAgICAgICAgICAgICAgIGN1cnJlbnRVc2VyLmZvbGxvd2luZyA9IGN1cnJlbnRVc2VyLmZvbGxvd2luZy5maWx0ZXIoZW1haWwgPT4gZW1haWwgIT09IHRhcmdldEVtYWlsKTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVXNlciBVbmZvbGxvd2VkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtjdXJyZW50RW1haWx9IHVuZm9sbG93ZWQgJHt0YXJnZXRFbWFpbH0uYCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiB0YXJnZXRFbWFpbCB9LCB0YXJnZXRVc2VyKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IGN1cnJlbnRFbWFpbCB9LCBjdXJyZW50VXNlcik7XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBmb2xsb3dVc2VyOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSB1cGRhdGluZyBmb2xsb3cgc3RhdHVzXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRVc2VyVHdlZXRzKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgZW1haWwgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QWxsUG9zdFJlcGxpZXMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IGVtYWlsOiBlbWFpbCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRBbGxMaWtlZFR3ZWV0cyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IGxpa2VDb3VudDogZW1haWwgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2VhcmNoVXNlcnMoX2NsaWVudDogbnVtYmVyLCB2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiB7ICRyZWdleDogdmFsdWUsICRvcHRpb25zOiBcImlcIiB9IH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldE5vdGlmaWNhdGlvbnMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl9ub3RpZmljYXRpb25zXCIsIHsgZW1haWwgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgY2hhbmdlUGFzc3dvcmQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIXVzZXIpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgY29uc3Qgb2xkUGFzc3dvcmQgPSB1c2VyLnBhc3N3b3JkO1xuICAgICAgICB1c2VyLnBhc3N3b3JkID0gcGFzc3dvcmQ7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSwgdXNlcik7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1Bhc3N3b3JkIENoYW5nZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gY2hhbmdlZCB0aGVpciBwYXNzd29yZCwgb2xkIHBhc3N3b3JkOiAke29sZFBhc3N3b3JkfSwgbmV3IHBhc3N3b3JkOiAke3Bhc3N3b3JkfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4gICAgcHVibGljIGFzeW5jIHVwZGF0ZVByb2ZpbGUoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCBwYXJzZWREYXRhOiBUd2VldFByb2ZpbGVEYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgb2xkVXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBwYXJzZWREYXRhLmVtYWlsIH0pO1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcGFyc2VkRGF0YS5lbWFpbCB9LCBwYXJzZWREYXRhKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUHJvZmlsZSBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7cGFyc2VkRGF0YS5lbWFpbH0gdXBkYXRlZCB0aGVpciBwcm9maWxlLCBvbGQgZGF0YTogJHtKU09OLnN0cmluZ2lmeShvbGRVc2VyKX0sIG5ldyBkYXRhOiAke0pTT04uc3RyaW5naWZ5KHBhcnNlZERhdGEpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gXCJzdWNjZXNzXCI7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHZlcmlmeVVzZXIoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIXVzZXIpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgdXNlci52ZXJpZmllZCA9IHRydWU7XG4gICAgICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0sIHVzZXIpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdVc2VyIFZlcmlmaWVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGhhcyBiZWVuIHZlcmlmaWVkLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlIE1lc3NhZ2luZyBGdW5jdGlvbnNcbiAgICBwdWJsaWMgYXN5bmMgc2VuZFByaXZhdGVNZXNzYWdlKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgc2VuZGVyRW1haWwsIHJlY2lwaWVudEVtYWlsLCBjb250ZW50LCBhdHRhY2htZW50cyA9IFtdIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgICAgICAvLyBWZXJpZnkgYm90aCB1c2VycyBleGlzdFxuICAgICAgICAgICAgY29uc3Qgc2VuZGVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHNlbmRlckVtYWlsIH0pO1xuICAgICAgICAgICAgY29uc3QgcmVjaXBpZW50ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHJlY2lwaWVudEVtYWlsIH0pO1xuXG4gICAgICAgICAgICBpZiAoIXNlbmRlciB8fCAhcmVjaXBpZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0ge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgc2VuZGVyRW1haWwsXG4gICAgICAgICAgICAgICAgcmVjaXBpZW50RW1haWwsXG4gICAgICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgICAgICBhdHRhY2htZW50cyxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICByZWFkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkZWxldGVkQnlTZW5kZXI6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRlbGV0ZWRCeVJlY2lwaWVudDogZmFsc2VcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgbWVzc2FnZSk7XG5cbiAgICAgICAgICAgIC8vIEdldCBhbGwgQ2l0aXplbiBJRHMgZm9yIGJvdGggc2VuZGVyIGFuZCByZWNpcGllbnQgKG11bHRpcGxlIGRldmljZXMgc3VwcG9ydClcbiAgICAgICAgICAgIGNvbnN0IHNlbmRlckNpZHMgPSBhd2FpdCBVdGlscy5HZXRDaWRzRnJvbVBpZ2VvbkVtYWlsKHNlbmRlckVtYWlsKTtcbiAgICAgICAgICAgIGNvbnN0IHJlY2lwaWVudENpZHMgPSBhd2FpdCBVdGlscy5HZXRDaWRzRnJvbVBpZ2VvbkVtYWlsKHJlY2lwaWVudEVtYWlsKTtcblxuICAgICAgICAgICAgLy8gU2VuZCBub3RpZmljYXRpb25zIGFuZCByZWZyZXNoIGV2ZW50cyB0byBhbGwgcmVjaXBpZW50IGRldmljZXNcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVjaXBpZW50Q2lkIG9mIHJlY2lwaWVudENpZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWNpcGllbnRQbGF5ZXIgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQocmVjaXBpZW50Q2lkKTtcbiAgICAgICAgICAgICAgICBpZiAocmVjaXBpZW50UGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlY2lwaWVudFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgTWVzc2FnZScsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSByZWNlaXZlZCBhIG1lc3NhZ2UgZnJvbSAke3NlbmRlci5kaXNwbGF5TmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiAncGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgTlVJIGV2ZW50IHRvIHJlZnJlc2ggY2hhdCBpZiByZWNpcGllbnQgaXMgaW4gY2hhdFxuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTpyZWZyZXNoUHJpdmF0ZU1lc3NhZ2UnLCByZWNpcGllbnRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXJFbWFpbDogc2VuZGVyRW1haWwsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWNpcGllbnRFbWFpbDogcmVjaXBpZW50RW1haWxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2VuZCByZWZyZXNoIGV2ZW50IHRvIGFsbCBzZW5kZXIgZGV2aWNlc1xuICAgICAgICAgICAgZm9yIChjb25zdCBzZW5kZXJDaWQgb2Ygc2VuZGVyQ2lkcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlbmRlclBsYXllciA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChzZW5kZXJDaWQpO1xuICAgICAgICAgICAgICAgIGlmIChzZW5kZXJQbGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6cmVmcmVzaFByaXZhdGVNZXNzYWdlJywgc2VuZGVyUGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyRW1haWw6IHNlbmRlckVtYWlsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVjaXBpZW50RW1haWw6IHJlY2lwaWVudEVtYWlsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJpdmF0ZSBNZXNzYWdlIFNlbnQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NlbmRlckVtYWlsfSBzZW50IGEgcHJpdmF0ZSBtZXNzYWdlIHRvICR7cmVjaXBpZW50RW1haWx9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZUlkOiBtZXNzYWdlLl9pZCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIHNlbmRQcml2YXRlTWVzc2FnZTpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgc2VuZGluZyBtZXNzYWdlXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRQcml2YXRlTWVzc2FnZXMoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyB1c2VyRW1haWwsIG90aGVyVXNlckVtYWlsLCBsaW1pdCA9IDUwLCBvZmZzZXQgPSAwIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7XG4gICAgICAgICAgICAgICAgJG9yOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgc2VuZGVyRW1haWw6IHVzZXJFbWFpbCwgcmVjaXBpZW50RW1haWw6IG90aGVyVXNlckVtYWlsIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgc2VuZGVyRW1haWw6IG90aGVyVXNlckVtYWlsLCByZWNpcGllbnRFbWFpbDogdXNlckVtYWlsIH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICRhbmQ6IFtcbiAgICAgICAgICAgICAgICAgICAgeyBkZWxldGVkQnlTZW5kZXI6IHsgJG5lOiB0cnVlIH0gfSxcbiAgICAgICAgICAgICAgICAgICAgeyBkZWxldGVkQnlSZWNpcGllbnQ6IHsgJG5lOiB0cnVlIH0gfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH0sXG4gICAgICAgICAgICAgICAgc2tpcDogb2Zmc2V0LFxuICAgICAgICAgICAgICAgIGxpbWl0OiBsaW1pdFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShtZXNzYWdlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0UHJpdmF0ZU1lc3NhZ2VzOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBtZXNzYWdlc1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0Q29udmVyc2F0aW9ucyhfY2xpZW50OiBudW1iZXIsIHVzZXJFbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCBhbGwgdW5pcXVlIGNvbnZlcnNhdGlvbnMgZm9yIHRoZSB1c2VyXG4gICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25zID0gYXdhaXQgTW9uZ29EQi5hZ2dyZWdhdGUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkbWF0Y2g6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICRvcjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgc2VuZGVyRW1haWw6IHVzZXJFbWFpbCB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgcmVjaXBpZW50RW1haWw6IHVzZXJFbWFpbCB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgJGFuZDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgZGVsZXRlZEJ5U2VuZGVyOiB7ICRuZTogdHJ1ZSB9IH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBkZWxldGVkQnlSZWNpcGllbnQ6IHsgJG5lOiB0cnVlIH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkZ3JvdXA6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICRjb25kOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgJGVxOiBbXCIkc2VuZGVyRW1haWxcIiwgdXNlckVtYWlsXSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiRyZWNpcGllbnRFbWFpbFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiRzZW5kZXJFbWFpbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlOiB7ICRmaXJzdDogXCIkJFJPT1RcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkc3VtOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRjb25kOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ICRhbmQ6IFt7ICRlcTogW1wiJHJlY2lwaWVudEVtYWlsXCIsIHVzZXJFbWFpbF0gfSwgeyAkZXE6IFtcIiRyZWFkXCIsIGZhbHNlXSB9XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkbG9va3VwOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcm9tOiBcInBob25lX3BpZ2Vvbl91c2Vyc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxGaWVsZDogXCJfaWRcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvcmVpZ25GaWVsZDogXCJlbWFpbFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXM6IFwidXNlckluZm9cIlxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICR1bndpbmQ6IFwiJHVzZXJJbmZvXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJHByb2plY3Q6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG90aGVyVXNlcjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtYWlsOiBcIiR1c2VySW5mby5lbWFpbFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc3BsYXlOYW1lOiBcIiR1c2VySW5mby5kaXNwbGF5TmFtZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF2YXRhcjogXCIkdXNlckluZm8uYXZhdGFyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IFwiJHVzZXJJbmZvLnZlcmlmaWVkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVucmVhZENvdW50OiAxXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJHNvcnQ6IHsgXCJsYXN0TWVzc2FnZS5jcmVhdGVkQXRcIjogLTEgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoY29udmVyc2F0aW9ucyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0Q29udmVyc2F0aW9uczpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgY29udmVyc2F0aW9uc1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbWFya01lc3NhZ2VBc1JlYWQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBtZXNzYWdlSWQsIHVzZXJFbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHsgX2lkOiBtZXNzYWdlSWQgfSk7XG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UpIHJldHVybiB7IGVycm9yOiBcIk1lc3NhZ2Ugbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgLy8gT25seSBtYXJrIGFzIHJlYWQgaWYgdGhlIHVzZXIgaXMgdGhlIHJlY2lwaWVudFxuICAgICAgICAgICAgaWYgKG1lc3NhZ2UucmVjaXBpZW50RW1haWwgPT09IHVzZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UucmVhZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7IF9pZDogbWVzc2FnZUlkIH0sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gbWFya01lc3NhZ2VBc1JlYWQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIG1hcmtpbmcgbWVzc2FnZSBhcyByZWFkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBkZWxldGVNZXNzYWdlKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgbWVzc2FnZUlkLCB1c2VyRW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7IF9pZDogbWVzc2FnZUlkIH0pO1xuICAgICAgICAgICAgaWYgKCFtZXNzYWdlKSByZXR1cm4geyBlcnJvcjogXCJNZXNzYWdlIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIC8vIE1hcmsgYXMgZGVsZXRlZCBieSB0aGUgYXBwcm9wcmlhdGUgdXNlclxuICAgICAgICAgICAgaWYgKG1lc3NhZ2Uuc2VuZGVyRW1haWwgPT09IHVzZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UuZGVsZXRlZEJ5U2VuZGVyID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobWVzc2FnZS5yZWNpcGllbnRFbWFpbCA9PT0gdXNlckVtYWlsKSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZS5kZWxldGVkQnlSZWNpcGllbnQgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJVbmF1dGhvcml6ZWRcIiB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHsgX2lkOiBtZXNzYWdlSWQgfSwgbWVzc2FnZSk7XG5cbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWVzc2FnZSBEZWxldGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke3VzZXJFbWFpbH0gZGVsZXRlZCBhIHByaXZhdGUgbWVzc2FnZWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBkZWxldGVNZXNzYWdlOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBkZWxldGluZyBtZXNzYWdlXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEVuaGFuY2VkIEZvbGxvd2Vycy9Gb2xsb3dpbmcgRnVuY3Rpb25zXG4gICAgcHVibGljIGFzeW5jIGdldEZvbGxvd2VycyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGNvbnN0IGZvbGxvd2VycyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdXNlcnNcIixcbiAgICAgICAgICAgICAgICB7IGVtYWlsOiB7ICRpbjogdXNlci5mb2xsb3dlcnMgfSB9LFxuICAgICAgICAgICAgICAgIG51bGwsIGZhbHNlLFxuICAgICAgICAgICAgICAgIHsgc29ydDogeyBkaXNwbGF5TmFtZTogMSB9IH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShmb2xsb3dlcnMpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldEZvbGxvd2VyczpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgZm9sbG93ZXJzXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRGb2xsb3dpbmcoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghdXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICBjb25zdCBmb2xsb3dpbmcgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsXG4gICAgICAgICAgICAgICAgeyBlbWFpbDogeyAkaW46IHVzZXIuZm9sbG93aW5nIH0gfSxcbiAgICAgICAgICAgICAgICBudWxsLCBmYWxzZSxcbiAgICAgICAgICAgICAgICB7IHNvcnQ6IHsgZGlzcGxheU5hbWU6IDEgfSB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZm9sbG93aW5nKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBnZXRGb2xsb3dpbmc6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIGZvbGxvd2luZ1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbn1cblxuZXhwb3J0IGNvbnN0IHBpZ2VvblNlcnZpY2UgPSBuZXcgUGlnZW9uU2VydmljZSgpOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgcGlnZW9uU2VydmljZSB9IGZyb20gXCIuL1BpZ2VvblNlcnZpY2VcIjtcblxub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpzZWFyY2hVc2Vyc1wiLCBwaWdlb25TZXJ2aWNlLnNlYXJjaFVzZXJFeGlzdCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmxvZ2luXCIsIHBpZ2VvblNlcnZpY2UubG9naW4pO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpzaWdudXBcIiwgcGlnZW9uU2VydmljZS5zaWdudXApO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjp0b2dnbGVOb3RpZmljYXRpb25zXCIsIHBpZ2VvblNlcnZpY2UudG9nZ2xlTm90aWZpY2F0aW9ucyk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnBvc3RUd2VldFwiLCBwaWdlb25TZXJ2aWNlLnBvc3RUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmdldFByb2ZpbGVcIiwgcGlnZW9uU2VydmljZS5nZXRQcm9maWxlKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Z2V0QWxsRmVlZFwiLCBwaWdlb25TZXJ2aWNlLmdldEFsbEZlZWQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpsaWtlVHdlZXRcIiwgcGlnZW9uU2VydmljZS5saWtlVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZXR3ZWV0VHdlZXRcIiwgcGlnZW9uU2VydmljZS5yZXR3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246ZGVsZXRlVHdlZXRcIiwgcGlnZW9uU2VydmljZS5kZWxldGVUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnBvc3RSZXBseVwiLCBwaWdlb25TZXJ2aWNlLnBvc3RSZXBseSk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmdldFJlcGxpZXNcIiwgcGlnZW9uU2VydmljZS5nZXRQb3N0UmVwbGllcyk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmxpa2VSZXBvc3RUd2VldFwiLCBwaWdlb25TZXJ2aWNlLmxpa2VSZXBsaWVzVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZXR3ZWV0UmVwb3N0VHdlZXRcIiwgcGlnZW9uU2VydmljZS5yZXR3ZWV0UmVwbGllc1R3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246aW5jcmVhc2VSZXBsaWVzQ291bnRcIiwgcGlnZW9uU2VydmljZS5pbmNyZWFzZVJlcGxpZXNDb3VudCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmRlY3JlYXNlUmVwbGllc0NvdW50XCIsIHBpZ2VvblNlcnZpY2UuZGVjcmVhc2VSZXBsaWVzQ291bnQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpkZWxldGVSZXBsaWVzVHdlZXRcIiwgcGlnZW9uU2VydmljZS5kZWxldGVSZXBsaWVzVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjpmb2xsb3dVc2VyXCIsIHBpZ2VvblNlcnZpY2UuZm9sbG93VXNlcik7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmdldFVzZXJUd2VldHNcIiwgcGlnZW9uU2VydmljZS5nZXRVc2VyVHdlZXRzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRBbGxQb3N0UmVwbGllcycsIHBpZ2VvblNlcnZpY2UuZ2V0QWxsUG9zdFJlcGxpZXMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldEFsbExpa2VkVHdlZXRzJywgcGlnZW9uU2VydmljZS5nZXRBbGxMaWtlZFR3ZWV0cyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246c2VhcmNoVXNlcnNYJywgcGlnZW9uU2VydmljZS5zZWFyY2hVc2Vycyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0Tm90aWZpY2F0aW9ucycsIHBpZ2VvblNlcnZpY2UuZ2V0Tm90aWZpY2F0aW9ucyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Y2hhbmdlUGFzc3dvcmQnLCBwaWdlb25TZXJ2aWNlLmNoYW5nZVBhc3N3b3JkKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2Vvbjp1cGRhdGVQcm9maWxlJywgcGlnZW9uU2VydmljZS51cGRhdGVQcm9maWxlKTtcblxuLy8gUHJpdmF0ZSBNZXNzYWdpbmcgQ2FsbGJhY2tzXG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246c2VuZFByaXZhdGVNZXNzYWdlJywgcGlnZW9uU2VydmljZS5zZW5kUHJpdmF0ZU1lc3NhZ2UpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldFByaXZhdGVNZXNzYWdlcycsIHBpZ2VvblNlcnZpY2UuZ2V0UHJpdmF0ZU1lc3NhZ2VzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRDb252ZXJzYXRpb25zJywgKGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gcGlnZW9uU2VydmljZS5nZXRDb252ZXJzYXRpb25zKGNsaWVudCwgZGF0YSk7XG59KTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjptYXJrTWVzc2FnZUFzUmVhZCcsIHBpZ2VvblNlcnZpY2UubWFya01lc3NhZ2VBc1JlYWQpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmRlbGV0ZU1lc3NhZ2UnLCBwaWdlb25TZXJ2aWNlLmRlbGV0ZU1lc3NhZ2UpO1xuXG4vLyBFbmhhbmNlZCBGb2xsb3dlcnMvRm9sbG93aW5nIENhbGxiYWNrc1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldEZvbGxvd2VycycsIHBpZ2VvblNlcnZpY2UuZ2V0Rm9sbG93ZXJzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRGb2xsb3dpbmcnLCBwaWdlb25TZXJ2aWNlLmdldEZvbGxvd2luZyk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0T3duZWRIb3VzZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IGFwYXJ0bWVudHMgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIHByb3BlcnR5X2lkLCBvd25lcl9jaXRpemVuaWQsIHN0cmVldCwgZGVzY3JpcHRpb24sIGhhc19hY2Nlc3MsIGRvb3JfZGF0YSwgYXBhcnRtZW50ICBGUk9NIHByb3BlcnRpZXMgV0hFUkUgb3duZXJfY2l0aXplbmlkID0gPyBBTkQgYXBhcnRtZW50IElTIE5PVCBOVUxMIEFORCBhcGFydG1lbnQgPD4gXCJcIicsIFtwbGF5ZXJdKTtcbiAgICBjb25zdCBob3VzZXMgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIHByb3BlcnR5X2lkLCBvd25lcl9jaXRpemVuaWQsIHN0cmVldCwgZGVzY3JpcHRpb24sIGhhc19hY2Nlc3MsIHNoZWxsLCBkb29yX2RhdGEgRlJPTSBwcm9wZXJ0aWVzIFdIRVJFIG93bmVyX2NpdGl6ZW5pZCA9ID8gQU5EIGFwYXJ0bWVudCBJUyBOVUxMJywgW3BsYXllcl0pO1xuICAgIGNvbnN0IHJlcyA9IHtcbiAgICAgICAgYXBhcnRtZW50czogYXBhcnRtZW50cyxcbiAgICAgICAgaG91c2VzOiBob3VzZXNcbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0S2V5SG9sZGVyTmFtZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhKSA9PiB7XG4gICAgY29uc3QgcmVzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBsZXQgbmFtZU1hcDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuXG4gICAgaWYgKHJlcyAmJiByZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBQcm9jZXNzIGFsbCBob3VzZXMgaW4gcGFyYWxsZWxcbiAgICAgICAgY29uc3QgYXBhcnRtZW50UHJvbWlzZXMgPSByZXMubWFwKChob3VzZTogc3RyaW5nKSA9PlxuICAgICAgICAgICAgVXRpbHMucXVlcnkoJ1NFTEVDVCBjaXRpemVuaWQsIGNoYXJpbmZvIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW2hvdXNlXSlcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBhbGxBcGFydG1lbnRzID0gYXdhaXQgUHJvbWlzZS5hbGwoYXBhcnRtZW50UHJvbWlzZXMpO1xuXG4gICAgICAgIGFsbEFwYXJ0bWVudHMuZm9yRWFjaChhcGFydG1lbnRzID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGFwYXJ0bWVudHMpO1xuICAgICAgICAgICAgaWYgKGFwYXJ0bWVudHMgJiYgYXBhcnRtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgYXBhcnRtZW50cy5mb3JFYWNoKChhcGFydG1lbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGFyaW5mbyA9IEpTT04ucGFyc2UoYXBhcnRtZW50LmNoYXJpbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnVsbE5hbWUgPSBgJHtjaGFyaW5mby5maXJzdG5hbWV9ICR7Y2hhcmluZm8ubGFzdG5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgbmFtZU1hcFthcGFydG1lbnQuY2l0aXplbmlkXSA9IGZ1bGxOYW1lO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobmFtZU1hcCk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncmVtb3ZlQWNjZXNzJywgYXN5bmMgKGNsaWVudCwgZGF0YSkgPT4ge1xuICAgIGNvbnN0IHsgaWQsIGNpZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBob3VzZTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCAqIEZST00gcHJvcGVydGllcyBXSEVSRSBwcm9wZXJ0eV9pZCA9ID8nLCBbaWRdKTtcbiAgICBpZiAoaG91c2UgJiYgaG91c2UubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBob3VzZURhdGEgPSBob3VzZVswXTtcbiAgICAgICAgY29uc3QgaGFzQWNjZXNzID0gSlNPTi5wYXJzZShob3VzZURhdGEuaGFzX2FjY2Vzcyk7XG4gICAgICAgIGNvbnN0IG5ld0FjY2VzcyA9IGhhc0FjY2Vzcy5maWx0ZXIoKGFjY2Vzczogc3RyaW5nKSA9PiBhY2Nlc3MgIT09IGNpZCk7XG4gICAgICAgIGNvbnNvbGUubG9nKG5ld0FjY2Vzcyk7XG4gICAgICAgIGF3YWl0IFV0aWxzLnF1ZXJ5KCdVUERBVEUgcHJvcGVydGllcyBTRVQgaGFzX2FjY2VzcyA9ID8gV0hFUkUgcHJvcGVydHlfaWQgPSA/JywgW0pTT04uc3RyaW5naWZ5KG5ld0FjY2VzcyksIGlkXSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3Byb3BlcnRpZXMnLFxuICAgICAgICAgICAgdGl0bGU6ICdBY2Nlc3MgUmVtb3ZlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQWNjZXNzIHJlbW92ZWQgZnJvbSAke2NpZH0gdG8gJHtob3VzZURhdGEuc3RyZWV0fSwgJHtob3VzZURhdGEucHJvcGVydHlfaWR9IGJ5ICR7YXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNsaWVudCkpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrLCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpjcmVhdGVQb3N0JywgYXN5bmMgKHNvdXJjZSwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0aXRsZSwgY29udGVudCwgaW1hZ2VBdHRhY2htZW50LCBwaG9uZU51bWJlciwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgZGF0YVggPSB7XG4gICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBjb250ZW50LFxuICAgICAgICBpbWFnZUF0dGFjaG1lbnQsXG4gICAgICAgIHBob25lTnVtYmVyLFxuICAgICAgICBlbWFpbCxcbiAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9ibHVlcGFnZXMnLCBkYXRhWCk7XG4gICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpyZWZyZXNoUG9zdHMnLCAtMSwgSlNPTi5zdHJpbmdpZnkoZGF0YVgpKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2JsdWVwYWdlcycsXG4gICAgICAgIHRpdGxlOiAnUG9zdCBDcmVhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBvc3QgJyR7dGl0bGV9JyAoSUQ6ICR7ZGF0YVguX2lkfSkgY3JlYXRlZCBieSAke3Bob25lTnVtYmVyIHx8IGVtYWlsfSwgY29udGVudDogJHtjb250ZW50fWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpnZXRQb3N0cycsIGFzeW5jIChzb3VyY2UpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9ibHVlcGFnZXMnLCB7fSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpkZWxldGVQb3N0JywgYXN5bmMgKHNvdXJjZSwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcG9zdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmx1ZXBhZ2VzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2JsdWVwYWdlcycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjaygnYmx1ZXBhZ2U6cmVmcmVzaERlbGV0ZVBvc3QnLCAtMSwgZGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ibHVlcGFnZXMnLFxuICAgICAgICB0aXRsZTogJ1Bvc3QgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQb3N0ICcke3Bvc3QudGl0bGV9JyAoSUQ6ICR7ZGF0YX0pIGRlbGV0ZWQgYnkgJHtwb3N0LnBob25lTnVtYmVyIHx8IHBvc3QuZW1haWx9LCBjb250ZW50OiAke3Bvc3QuY29udGVudH1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjaywgdHJpZ2dlckNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBGcmFtZXdvcmsgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBHYXJhZ2VEYXRhIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5cbmludGVyZmFjZSBWZWhpY2xlRGF0YSB7XG4gICAgdmVoaWNsZTogc3RyaW5nO1xuICAgIHBsYXRlOiBzdHJpbmc7XG4gICAgZ2FyYWdlOiBzdHJpbmc7XG4gICAgbW9kczogc3RyaW5nO1xuICAgIHN0YXRlOiBudW1iZXI7XG4gICAgZGVwb3RwcmljZTogc3RyaW5nO1xufVxuXG5vbkNsaWVudENhbGxiYWNrKCdnYXJhZ2U6Z2V0R2FyYWdlRGF0YScsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGxldCByZXNEYXRhOiBHYXJhZ2VEYXRhW10gPSBbXTtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgVXRpbHMucXVlcnkoYFNFTEVDVCB2ZWhpY2xlLHBsYXRlLGdhcmFnZSxtb2RzLHN0YXRlLGRlcG90cHJpY2UgRlJPTSBwbGF5ZXJfdmVoaWNsZXMgV0hFUkUgY2l0aXplbmlkID0gP2AsIFtjaXRpemVuSWRdKSBhcyBWZWhpY2xlRGF0YVtdO1xuICAgIGNvbnN0IHZlaGljbGVEYXRhID0gRnJhbWV3b3JrLlNoYXJlZC5WZWhpY2xlcztcbiAgICBcbiAgICBmb3IgKGNvbnN0IHZlaGljbGUgb2YgcmVzKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSB2ZWhpY2xlRGF0YVt2ZWhpY2xlLnZlaGljbGVdO1xuICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIHZlaGljbGUgc3RhdGUgd2l0aCBiZXR0ZXIgbG9naWNcbiAgICAgICAgICAgIGxldCBzdGF0ZTogc3RyaW5nO1xuICAgICAgICAgICAgaWYgKHZlaGljbGUuc3RhdGUgPT09IDIpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IFwiSW1wb3VuZGVkXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHZlaGljbGUuc3RhdGUgPT09IDEpIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IFwiUGFya2VkXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKE51bWJlcih2ZWhpY2xlLmRlcG90cHJpY2UpID4gMCkge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gXCJEZXBvdFwiOyAvLyBDaGFuZ2VkIGZyb20gXCJEZXBvdGVkXCIgdG8gXCJEZXBvdFwiIGFzIHJlcXVlc3RlZFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IFwiT3V0XCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJlc0RhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAgcGxhdGU6IHZlaGljbGUucGxhdGUsXG4gICAgICAgICAgICAgICAgZ2FyYWdlOiB2ZWhpY2xlLmdhcmFnZSxcbiAgICAgICAgICAgICAgICBzdGF0ZTogc3RhdGUsXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnk6IGRhdGEuY2F0ZWdvcnksXG4gICAgICAgICAgICAgICAgYnJhbmQ6IGRhdGEuYnJhbmQsXG4gICAgICAgICAgICAgICAgbmFtZTogZGF0YS5uYW1lLFxuICAgICAgICAgICAgICAgIHR1cmJvSW5zdGFsbGVkOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kVHVyYm8sXG4gICAgICAgICAgICAgICAgYm9keUhlYWx0aDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLmJvZHlIZWFsdGgsXG4gICAgICAgICAgICAgICAgdGFua0hlYWx0aDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLnRhbmtIZWFsdGgsXG4gICAgICAgICAgICAgICAgZnVlbExldmVsOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykuZnVlbExldmVsLFxuICAgICAgICAgICAgICAgIGVuZ2luZUhlYWx0aDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLmVuZ2luZUhlYWx0aCxcbiAgICAgICAgICAgICAgICBtb2RTdXNwZW5zaW9uOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kU3VzcGVuc2lvbixcbiAgICAgICAgICAgICAgICBtb2RUcmFuc21pc3Npb246IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RUcmFuc21pc3Npb24sXG4gICAgICAgICAgICAgICAgbW9kRW5naW5lOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kRW5naW5lLFxuICAgICAgICAgICAgICAgIG1vZEJyYWtlczogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZEJyYWtlcyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlc0RhdGEpO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBXYWxsZXRBY2NvdW50IH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBEYXRlVGltZSB9IGZyb20gJ2x1eG9uJztcblxuZnVuY3Rpb24gR2VuZXJhdGVDYXJkTnVtYmVyKCkge1xuICAgIGxldCBjYXJkTnVtYmVyID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAxNjsgaSsrKSB7XG4gICAgICAgIGNhcmROdW1iZXIgKz0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTApO1xuICAgIH1cbiAgICByZXR1cm4gY2FyZE51bWJlcjtcbn1cblxuZnVuY3Rpb24gR2VuZXJhdGVCYW5rQWNjb3VudE51bWJlcigpIHtcbiAgICBjb25zdCBpbml0aWFscyA9IFwiU01SVFwiO1xuICAgIGxldCBhY2NvdW50TnVtYmVyID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAxMDsgaSsrKSB7XG4gICAgICAgIGFjY291bnROdW1iZXIgKz0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTApO1xuICAgIH1cbiAgICByZXR1cm4gYCR7aW5pdGlhbHN9XyR7YWNjb3VudE51bWJlcn1gO1xufVxuXG5vbkNsaWVudENhbGxiYWNrKCd3YWxsZXQ6bG9naW4nLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9iYW5rX3VzZXInLCB7IGNpdGl6ZW5JZDogY2l0aXplbklkLlBsYXllckRhdGEuY2l0aXplbmlkIH0pO1xuICAgIGlmIChyZXMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIC4uLnJlcyxcbiAgICAgICAgICAgIGJhbGFuY2U6IGF3YWl0IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLm1vbmV5LmJhbmssXG4gICAgICAgICAgICBjYXNpbm86IGF3YWl0IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLm1vbmV5LmNhc2lub1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuYW1lID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKTtcbiAgICAgICAgY29uc3QgY2FyZE51bWJlciA9IEdlbmVyYXRlQ2FyZE51bWJlcigpO1xuICAgICAgICBjb25zdCBjYXJkUGluID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDApO1xuICAgICAgICBjb25zdCBiYW5rQWNjb3VudCA9IEdlbmVyYXRlQmFua0FjY291bnROdW1iZXIoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICBjYXJkTnVtYmVyOiBjYXJkTnVtYmVyLFxuICAgICAgICAgICAgY2FyZFBpbjogY2FyZFBpbixcbiAgICAgICAgICAgIGJhbmtBY2NvdW50OiBiYW5rQWNjb3VudCxcbiAgICAgICAgICAgIGJhbGFuY2U6IDBcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmFua191c2VyJywgZGF0YSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgICAgYmFsYW5jZTogY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuYmFuayxcbiAgICAgICAgICAgIGNhc2lubzogY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuY2FzaW5vXG4gICAgICAgIH0pO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXREZXRhaWxzWFMnLCBhc3luYyAoY2xpZW50LCBudW1iZXIpID0+IHtcbiAgICBsZXQgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihTdHJpbmcobnVtYmVyKSk7XG4gICAgaWYgKGNpdGl6ZW5JZCkge1xuICAgICAgICBjb25zdCByZXM6IFdhbGxldEFjY291bnQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2JhbmtfdXNlcicsIHsgY2l0aXplbklkOiBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgIHJldHVybiByZXMuYmFua0FjY291bnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygndHJhbnNYQWRxYXNkZGFzZGZlck1vbmV5JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBhbW91bnQsIHRvIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlczogV2FsbGV0QWNjb3VudCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmFua191c2VyJywgeyBiYW5rQWNjb3VudDogdG8gfSk7XG4gICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQocmVzLmNpdGl6ZW5JZCk7XG4gICAgY29uc3Qgc291cmNlUGxheWVyID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllcihjbGllbnQpO1xuICAgIGlmICghYXdhaXQgRG9lc1BsYXllckV4aXN0KHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoc291cmNlUGxheWVyLlBsYXllckRhdGEubW9uZXkuYmFuayA8IGFtb3VudCkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChhd2FpdCBzb3VyY2VQbGF5ZXIuRnVuY3Rpb25zLlJlbW92ZU1vbmV5KCdiYW5rJywgYW1vdW50KSkge1xuICAgICAgICB0YXJnZXRQbGF5ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KCdiYW5rJywgYW1vdW50KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogJ1dhbGxldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIHRyYW5zZmVycmVkICQke2Ftb3VudH0gdG8gJHtyZXMubmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogJ3NldHRpbmdzJyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiAnV2FsbGV0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgcmVjZWl2ZWQgJCR7YW1vdW50fSBmcm9tICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JhbmtfdHJhbnNhY3Rpb25zJywge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgIHRvOiByZXMuY2l0aXplbklkLFxuICAgICAgICAgICAgYW1vdW50OiBhbW91bnQsXG4gICAgICAgICAgICB0eXBlOiAnZGViaXQnLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmFua190cmFuc2FjdGlvbnMnLCB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgZnJvbTogcmVzLmNpdGl6ZW5JZCxcbiAgICAgICAgICAgIHRvOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICBhbW91bnQ6IGFtb3VudCxcbiAgICAgICAgICAgIHR5cGU6ICdjcmVkaXQnLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9iYW5rX3RyYW5zYWN0aW9ucycsXG4gICAgICAgICAgICB0aXRsZTogJ01vbmV5IFRyYW5zZmVyJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIHRyYW5zZmVycmVkICQke2Ftb3VudH0gdG8gJHtyZXMubmFtZX0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0VHJhbnNhY3Rpb25zJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHRyYW5zYWN0aW9ucyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2JhbmtfdHJhbnNhY3Rpb25zJywgeyBmcm9tOiBjaXRpemVuSWQgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgc29ydDogeyBkYXRlOiAtMSB9XG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHRyYW5zYWN0aW9ucyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnd2FsbGV0OmNyZWF0ZUludm9pY2UnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGRlc2NyaXB0aW9uLCBhbW91bnQsIHBheW1lbnRUaW1lLCBudW1iZXJPZlBheW1lbnRzLCBpc0J1c2luZXNzLCByZWNlaXZlciwgfSA9IEpTT04ucGFyc2UoZGF0YSkgYXMge1xuICAgICAgICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgICAgICBhbW91bnQ6IG51bWJlcjtcbiAgICAgICAgcGF5bWVudFRpbWU6IG51bWJlcjtcbiAgICAgICAgbnVtYmVyT2ZQYXltZW50czogbnVtYmVyO1xuICAgICAgICBpc0J1c2luZXNzOiAnTm8nIHwgJ1llcyc7XG4gICAgICAgIHJlY2VpdmVyOiBzdHJpbmc7XG4gICAgfTsgLy8gcGF5bWVudFRpbWUgPSAwIGZvciBkYWlseSwgMSBmb3Igd2Vla2x5LCAyIGZvciBtb250aGx5IGFuZCAzIGZvciBxdWFydGVybHkgYW5kIDQgZm9yIHllYXJseVxuXG4gICAgY29uc3Qgc291cmNlUGxheWVyID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllcihjbGllbnQpO1xuICAgIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIocmVjZWl2ZXIpO1xuICAgIGlmICghdGFyZ2V0UGxheWVyKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGFtb3VudCA8IDApIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmFua19pbnZvaWNlcycsIHtcbiAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgZnJvbTogc291cmNlUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICB0bzogdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICBhbW91bnQ6IGFtb3VudCxcbiAgICAgICAgc3RhdHVzOiAncGVuZGluZycsXG4gICAgICAgIGlzQnVzaW5lc3MsXG4gICAgICAgIHNvdXJjZU5hbWU6IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICB0YXJnZXROYW1lOiBgJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uLFxuICAgICAgICBwYXltZW50VGltZTogcGF5bWVudFRpbWUsXG4gICAgICAgIG51bWJlck9mUGF5bWVudHM6IG51bWJlck9mUGF5bWVudHMsXG4gICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgIH0pO1xuICAgIGlmIChyZXMpIHtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogJ1dhbGxldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgc2VudCB5b3UgYW4gaW52b2ljZSBvZiAkJHthbW91bnR9LmAsXG4gICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgIH0pKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYmFua19pbnZvaWNlcycsXG4gICAgICAgICAgICB0aXRsZTogJ0ludm9pY2UgQ3JlYXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhhcyBzZW50IGFuIGludm9pY2Ugb2YgJCR7YW1vdW50fSB0byAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnd2FsbGV0OmdldEludm9pY2VzJywgYXN5bmMgKGNsaWVudCwgdHlwZSkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGlmICh0eXBlID09PSAnc2VudCcpIHtcbiAgICAgICAgY29uc3QgaW52b2ljZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9iYW5rX2ludm9pY2VzJywgeyBmcm9tOiBjaXRpemVuSWQgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgZGF0ZTogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGludm9pY2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBpbnZvaWNlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2JhbmtfaW52b2ljZXMnLCB7IHRvOiBjaXRpemVuSWQgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgZGF0ZTogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGludm9pY2VzKTtcbiAgICB9XG59KTtcblxudHlwZSBSZWN1cnJlbmNlID0gMCB8IDEgfCAyIHwgMyB8IDQ7IC8vIGRhaWx5LCB3ZWVrbHksIG1vbnRobHksIHF1YXJ0ZXJseSwgeWVhcmx5XG5cbmludGVyZmFjZSBQaG9uZUJhbmtJbnZvaWNlRG9jIHtcbiAgICBfaWQ6IHN0cmluZztcbiAgICBmcm9tOiBzdHJpbmc7IC8vIGNpdGl6ZW5pZCBvZiBzZW5kZXIgKHRoZSBwZXJzb24vYnVzaW5lc3MgcmVxdWVzdGluZyBtb25leSlcbiAgICB0bzogc3RyaW5nOyAgIC8vIGNpdGl6ZW5pZCBvZiB0YXJnZXQgKHRoZSBwZXJzb24gd2hvIHBheXMgd2hlbiBhY2NlcHRpbmcpXG4gICAgYW1vdW50OiBudW1iZXI7XG4gICAgdGFyZ2V0TmFtZTogc3RyaW5nO1xuICAgIHNvdXJjZU5hbWU6IHN0cmluZztcbiAgICBzdGF0dXM6ICdwZW5kaW5nJyB8ICdhY3RpdmUnIHwgJ3BhaWQnIHwgJ2NvbXBsZXRlZCcgfCAnZGVjbGluZWQnIHwgJ292ZXJkdWUnO1xuICAgIGlzQnVzaW5lc3M6ICdObycgfCAnWWVzJztcbiAgICBwYXltZW50VGltZTogUmVjdXJyZW5jZSB8ICcnOyAvLyAnJyBtZWFucyBvbmUtdGltZSwgZWxzZSByZWN1cnJlbmNlIGNvZGVcbiAgICBudW1iZXJPZlBheW1lbnRzOiBudW1iZXIgfCAnJzsvLyAnJyBtZWFucyBvbmUtdGltZSwgZWxzZSB0b3RhbCBwYXltZW50c1xuICAgIHJlbWFpbmluZ1BheW1lbnRzPzogbnVtYmVyOyAgIC8vIG1haW50YWluZWQgZm9yIHJlY3VycmluZ1xuICAgIG5leHRQYXltZW50RGF0ZT86IHN0cmluZyB8IG51bGw7IC8vIElTT1xuICAgIGxhc3RBdHRlbXB0QXQ/OiBzdHJpbmcgfCBudWxsOyAgIC8vIElTT1xuICAgIGZhaWxlZEF0dGVtcHRzPzogbnVtYmVyO1xuICAgIGNyZWF0ZWRBdD86IHN0cmluZzsgLy8gSVNPXG4gICAgZGF0ZT86IHN0cmluZzsgLy8geW91ciBvcmlnaW5hbCBmaWVsZFxufVxuXG5jb25zdCBDT0xMRUNUSU9OID0gJ3Bob25lX2JhbmtfaW52b2ljZXMnO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFFCIGhlbHBlcnMgKGFkanVzdCBpZiB5b3VyIGV4cG9ydHMgZGlmZmVyKVxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRQbGF5ZXJCeVNvdXJjZSA9IGFzeW5jIChzcmM6IG51bWJlcikgPT4gZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllcihzcmMpO1xuY29uc3QgZ2V0UGxheWVyQnlDaXRpemVuSWQgPSBhc3luYyAoY2lkOiBzdHJpbmcpID0+IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZD8uKGNpZCk7XG5cbi8vIE1vbmV5IG9wczogcmV0dXJuIGJvb2xlYW4gc3VjY2Vzc1xuY29uc3QgZGViaXRCYW5rID0gKHBsYXllcjogYW55LCBhbW91bnQ6IG51bWJlcikgPT4gcGxheWVyPy5GdW5jdGlvbnM/LlJlbW92ZU1vbmV5Py4oJ2JhbmsnLCBhbW91bnQsICdpbnZvaWNlX3BheW1lbnQnKSA/PyBmYWxzZTtcbmNvbnN0IGNyZWRpdEJhbmsgPSAocGxheWVyOiBhbnksIGFtb3VudDogbnVtYmVyKSA9PiBwbGF5ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KCdiYW5rJywgYW1vdW50LCAnaW52b2ljZV9yZWNlaXZlZCcpID8/IGZhbHNlO1xuXG5jb25zdCBub3RpZnkgPSAoc3JjOiBudW1iZXIsIHRpdGxlOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIHRpbWVvdXQgPSA1MDAwKSA9PiB7XG4gICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgc3JjLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGUsIGRlc2NyaXB0aW9uLCBhcHA6ICdzZXR0aW5ncycsIHRpbWVvdXRcbiAgICB9KSk7XG59O1xuXG5jb25zdCBub3dJU08gPSAoKSA9PiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbmNvbnN0IGFkZEludGVydmFsID0gKGlzbzogc3RyaW5nLCByZWM6IFJlY3VycmVuY2UpOiBzdHJpbmcgPT4ge1xuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShpc28pO1xuICAgIHN3aXRjaCAocmVjKSB7XG4gICAgICAgIGNhc2UgMDogZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSk7IGJyZWFrOyAgICAgICAvLyBkYWlseVxuICAgICAgICBjYXNlIDE6IGQuc2V0RGF0ZShkLmdldERhdGUoKSArIDcpOyBicmVhazsgICAgICAgLy8gd2Vla2x5XG4gICAgICAgIGNhc2UgMjogZC5zZXRNb250aChkLmdldE1vbnRoKCkgKyAxKTsgYnJlYWs7ICAgICAvLyBtb250aGx5XG4gICAgICAgIGNhc2UgMzogZC5zZXRNb250aChkLmdldE1vbnRoKCkgKyAzKTsgYnJlYWs7ICAgICAvLyBxdWFydGVybHlcbiAgICAgICAgY2FzZSA0OiBkLnNldEZ1bGxZZWFyKGQuZ2V0RnVsbFllYXIoKSArIDEpOyBicmVhazsgLy8geWVhcmx5XG4gICAgfVxuICAgIHJldHVybiBkLnRvSVNPU3RyaW5nKCk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIEJ1c2luZXNzIHNhZmUgZGVwb3NpdCAoY3VzdG9taXplIGZvciB5b3VyIGZyYW1ld29yaylcbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLyoqXG4gKiBUcnkgdG8gZGVwb3NpdCBpbnRvIGEgYnVzaW5lc3MgbWFuYWdlbWVudCBzYWZlLlxuICogU3RyYXRlZ3k6XG4gKiAgIC0gSWYgdGhlIHBheWVyIGlzIHBheWluZyB0byBhIGJ1c2luZXNzIChpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnKSxcbiAqICAgICB3ZSBkZXBvc2l0IHRoZSBtb25leSBpbnRvIHRoZSBSRUNFSVZFUidzIGpvYiBzYWZlLlxuICogICAtIFlvdSBtaWdodCB3YW50IHRvIGNoYW5nZSB0aGlzIHRvIGEgc3BlY2lmaWMgYnVzaW5lc3MgaWQgb24gdGhlIGludm9pY2UsXG4gKiAgICAgb3IgYSBwcm92aWRlZCBvcmcga2V5LiBFZGl0IGFzIG5lZWRlZC5cbiAqL1xuY29uc3QgZGVwb3NpdFRvTWFuYWdlbWVudFNhZmUgPSBhc3luYyAocmVjZWl2ZXJDaXRpemVuSWQ6IHN0cmluZywgYW1vdW50OiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZWNlaXZlciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKHJlY2VpdmVyQ2l0aXplbklkKTtcbiAgICAgICAgY29uc3Qgam9iTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gcmVjZWl2ZXI/LlBsYXllckRhdGE/LmpvYj8ubmFtZTtcbiAgICAgICAgY29uc3QgUGxheWVyTmFtZSA9IHJlY2VpdmVyID8gYCR7cmVjZWl2ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7cmVjZWl2ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gIDogJ1Vua25vd24nO1xuICAgICAgICAvLyBUT0RPOiBVcGRhdGUgdGhpcyB0byB5b3VyIGFjdHVhbCBtYW5hZ2VtZW50IHJlc291cmNlIEFQSTpcbiAgICAgICAgLy8gQ29tbW9uIFFCQ29yZSBlY29zeXN0ZW0gdXNlcyBxYi1tYW5hZ2VtZW50OiBBZGRNb25leShqb2JOYW1lLCBhbW91bnQpXG4gICAgICAgIGlmIChqb2JOYW1lKSB7XG4gICAgICAgICAgICBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5hZGRBY2NvdW50TW9uZXkoam9iTmFtZSwgYW1vdW50KTtcbiAgICAgICAgICAgIC8qIGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGFjY291bnQsIHRpdGxlLCBhbW91bnQsIG1lc3NhZ2UsIGlzc3VlciwgcmVjZWl2ZXIsIHRyYW5zVHlwZSwgdHJhbnNJRCkgKi9cbiAgICAgICAgICAgIGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGpvYk5hbWUsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIERlcG9zaXRcIiwgYW1vdW50LCBcIkRlcG9zaXQgZnJvbSBlbXBsb3llZSB0byBtYW5hZ2VtZW50IHNhZmUuXCIsIGpvYk5hbWUsIFBsYXllck5hbWUsICdkZXBvc2l0JywgZ2VuZXJhdGVVVWlkKCkpXG4gICAgICAgICAgICBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihqb2JOYW1lLCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0XCIsIGFtb3VudCwgXCJEZXBvc2l0ZWQgdG8gbWFuYWdlbWVudCBzYWZlLlwiLCBQbGF5ZXJOYW1lLCBqb2JOYW1lLCAnd2l0aGRyYXcnLCBnZW5lcmF0ZVVVaWQoKSlcblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVjZWl2ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVkaXRCYW5rKHJlY2VpdmVyLCBhbW91bnQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ2RlcG9zaXRUb01hbmFnZW1lbnRTYWZlIGVycm9yOicsIGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufTtcblxuLy8gQmFuayBzdGF0ZW1lbnQgLyBsb2dnaW5nIChvcHRpb25hbCBob29rIHBvaW50KVxuY29uc3QgbG9nQmFua0V2ZW50ID0gKHR5cGU6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSA9PiBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfYmFua19pbnZvaWNlcycsXG4gICAgdGl0bGU6IHR5cGUsXG4gICAgbWVzc2FnZSxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG59KTtcblxub25DbGllbnRDYWxsYmFjaygnd2FsbGV0OmFjY2VwdEludm9pY2VQYXltZW50JywgYXN5bmMgKGNsaWVudDogbnVtYmVyLCBpZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGF5ZXJQbGF5ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeVNvdXJjZShjbGllbnQpOyAvLyB0aGUgb25lIGNsaWNraW5nIFwiYWNjZXB0XCIgKG11c3QgZXF1YWwgaW52b2ljZS50bylcbiAgICBpZiAoIXBheWVyUGxheWVyKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBwYXllckNpZDogc3RyaW5nID0gcGF5ZXJQbGF5ZXIuUGxheWVyRGF0YT8uY2l0aXplbmlkO1xuICAgIGNvbnN0IGludm9pY2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0pIGFzIFBob25lQmFua0ludm9pY2VEb2M7XG4gICAgaWYgKCFpbnZvaWNlKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBTYWZldHkgY2hlY2tzXG4gICAgaWYgKGludm9pY2UudG8gIT09IHBheWVyQ2lkKSByZXR1cm4gZmFsc2U7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBub3QgeW91ciBpbnZvaWNlXG4gICAgaWYgKGludm9pY2Uuc3RhdHVzICE9PSAncGVuZGluZycgJiYgaW52b2ljZS5zdGF0dXMgIT09ICdhY3RpdmUnICYmIGludm9pY2Uuc3RhdHVzICE9PSAnb3ZlcmR1ZScpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5hbW91bnQgPD0gMCkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChpbnZvaWNlLmZyb20gPT09IGludm9pY2UudG8pIHJldHVybiBmYWxzZTsgICAgICAgICAgICAgICAgICAgICAgLy8gc2VsZi1pbnZvaWNlIHNpbGxpbmVzc1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS5mcm9tKTtcblxuICAgIGNvbnN0IGNoYXJnZWQgPSBkZWJpdEJhbmsocGF5ZXJQbGF5ZXIsIGludm9pY2UuYW1vdW50KTtcbiAgICBpZiAoIWNoYXJnZWQpIHtcbiAgICAgICAgLy8gQ291bGRuXHUyMDE5dCBjaGFyZ2UgLT4gb3ZlcmR1ZSBmb3IgcmVjdXJyaW5nIG9yIGtlZXAgcGVuZGluZyBmb3Igb25lLXRpbWU/XG4gICAgICAgIGNvbnN0IGlzUmVjdXJyaW5nID0gaW52b2ljZS5wYXltZW50VGltZSAhPT0gJycgJiYgaW52b2ljZS5udW1iZXJPZlBheW1lbnRzICE9PSAnJztcbiAgICAgICAgaWYgKGlzUmVjdXJyaW5nKSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSwge1xuICAgICAgICAgICAgICAgIHN0YXR1czogJ292ZXJkdWUnLFxuICAgICAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLFxuICAgICAgICAgICAgICAgIGZhaWxlZEF0dGVtcHRzOiAoaW52b2ljZS5mYWlsZWRBdHRlbXB0cyA/PyAwKSArIDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIG5vdGlmeShwYXllclBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBJbnN1ZmZpY2llbnQgZnVuZHMgdG8gcGF5ICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFBheW91dFxuICAgIGxldCBwYXlvdXRPayA9IGZhbHNlO1xuICAgIGlmIChpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnKSB7XG4gICAgICAgIGNvbnN0IGNvbW1pc3Npb24gPSAwLjE7XG4gICAgICAgIGNvbnN0IGNvbW1pc3Npb25BbW91bnQgPSBNYXRoLnJvdW5kKGludm9pY2UuYW1vdW50ICogY29tbWlzc2lvbik7XG4gICAgICAgIGNvbnN0IHBheW91dEFtb3VudCA9IE1hdGgucm91bmQoaW52b2ljZS5hbW91bnQgLSBjb21taXNzaW9uQW1vdW50KTtcbiAgICAgICAgcGF5b3V0T2sgPSBhd2FpdCBkZXBvc2l0VG9NYW5hZ2VtZW50U2FmZShpbnZvaWNlLmZyb20sIHBheW91dEFtb3VudCk7XG4gICAgICAgIHJlcXVlc3Rlci5GdW5jdGlvbnMuQWRkTW9uZXkoJ2JhbmsnLCBjb21taXNzaW9uQW1vdW50LCAnaW52b2ljZV9yZWNlaXZlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBheW91dE9rID0gcmVxdWVzdGVyID8gY3JlZGl0QmFuayhyZXF1ZXN0ZXIsIGludm9pY2UuYW1vdW50KSA6IGZhbHNlO1xuICAgIH1cblxuICAgIGlmICghcGF5b3V0T2spIHtcbiAgICAgICAgLy8gUmVmdW5kIHBheWVyIHNpbmNlIHBheW91dCBmYWlsZWRcbiAgICAgICAgY3JlZGl0QmFuayhwYXllclBsYXllciwgaW52b2ljZS5hbW91bnQpO1xuICAgICAgICBub3RpZnkocGF5ZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgUGF5bWVudCBmYWlsZWQgdG8gZGVsaXZlci4gUmVmdW5kZWQgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGludm9pY2Ugc3RhdHVzXG4gICAgY29uc3QgaXNSZWN1cnJpbmcgPSAoaW52b2ljZS5wYXltZW50VGltZSAhPT0gJycgJiYgaW52b2ljZS5udW1iZXJPZlBheW1lbnRzICE9PSAnJyk7XG4gICAgaWYgKCFpc1JlY3VycmluZykge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSwge1xuICAgICAgICAgICAgc3RhdHVzOiAncGFpZCcsXG4gICAgICAgICAgICBuZXh0UGF5bWVudERhdGU6IG51bGwsXG4gICAgICAgICAgICByZW1haW5pbmdQYXltZW50czogMCxcbiAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHRvdGFsID0gTnVtYmVyKGludm9pY2UubnVtYmVyT2ZQYXltZW50cyk7XG4gICAgICAgIGNvbnN0IHByZXZSZW1haW5pbmcgPSAoaW52b2ljZS5yZW1haW5pbmdQYXltZW50cyA9PSBudWxsKVxuICAgICAgICAgICAgPyB0b3RhbCAgICAgICAgICAgICAgICAvLyBmaXJzdCB0aW1lIGFjdGl2YXRpb25cbiAgICAgICAgICAgIDogaW52b2ljZS5yZW1haW5pbmdQYXltZW50cztcblxuICAgICAgICBjb25zdCBuZXdSZW1haW5pbmcgPSBNYXRoLm1heCgwLCBwcmV2UmVtYWluaW5nIC0gMSk7XG5cbiAgICAgICAgbGV0IG5ld1N0YXR1czogUGhvbmVCYW5rSW52b2ljZURvY1snc3RhdHVzJ10gPSAnYWN0aXZlJztcbiAgICAgICAgbGV0IG5leHREYXRlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICAgICAgaWYgKG5ld1JlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgICAgICBuZXdTdGF0dXMgPSAnY29tcGxldGVkJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2VEYXRlID0gaW52b2ljZS5uZXh0UGF5bWVudERhdGUgPz8gbm93SVNPKCk7XG4gICAgICAgICAgICBuZXh0RGF0ZSA9IGFkZEludGVydmFsKGJhc2VEYXRlLCBOdW1iZXIoaW52b2ljZS5wYXltZW50VGltZSkgYXMgUmVjdXJyZW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSwge1xuICAgICAgICAgICAgc3RhdHVzOiBuZXdTdGF0dXMsXG4gICAgICAgICAgICByZW1haW5pbmdQYXltZW50czogbmV3UmVtYWluaW5nLFxuICAgICAgICAgICAgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksXG4gICAgICAgICAgICBuZXh0UGF5bWVudERhdGU6IG5leHREYXRlLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBpbnZvaWNlLmNyZWF0ZWRBdCA/PyBub3dJU08oKVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBOb3RpZnkgYm90aCBzaWRlc1xuICAgIG5vdGlmeShwYXllclBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBQYWlkICQke2ludm9pY2UuYW1vdW50fSB0byAke2ludm9pY2Uuc291cmNlTmFtZX0uYCk7XG4gICAgaWYgKHJlcXVlc3Rlcj8uUGxheWVyRGF0YT8uc291cmNlKSB7XG4gICAgICAgIG5vdGlmeShyZXF1ZXN0ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IHBhaWQgeW91ciBpbnZvaWNlIG9mICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICB9XG5cbiAgICBsb2dCYW5rRXZlbnQoJ0ludm9pY2UgUGF5bWVudCcsIGAke2ludm9pY2UudGFyZ2V0TmFtZX0gcGFpZCAkJHtpbnZvaWNlLmFtb3VudH0gdG8gJHtpbnZvaWNlLnNvdXJjZU5hbWV9JHtpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnID8gJyAoYnVzaW5lc3MpJyA6ICcnfS5gKTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd3YWxsZXQ6ZGVjbGluZUludm9pY2VQYXltZW50JywgYXN5bmMgKGNsaWVudDogbnVtYmVyLCBpZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2V0UGxheWVyQnlTb3VyY2UoY2xpZW50KTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgY2lkID0gcGxheWVyLlBsYXllckRhdGE/LmNpdGl6ZW5pZDtcbiAgICBjb25zdCBpbnZvaWNlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9KSBhcyBQaG9uZUJhbmtJbnZvaWNlRG9jO1xuICAgIGlmICghaW52b2ljZSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChpbnZvaWNlLnRvICE9PSBjaWQpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5zdGF0dXMgIT09ICdwZW5kaW5nJyAmJiBpbnZvaWNlLnN0YXR1cyAhPT0gJ2FjdGl2ZScgJiYgaW52b2ljZS5zdGF0dXMgIT09ICdvdmVyZHVlJykgcmV0dXJuIGZhbHNlO1xuXG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHsgc3RhdHVzOiAnZGVjbGluZWQnLCBuZXh0UGF5bWVudERhdGU6IG51bGwgfSk7XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZChpbnZvaWNlLmZyb20pO1xuICAgIG5vdGlmeShwbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgRGVjbGluZWQgaW52b2ljZSBvZiAkJHtpbnZvaWNlLmFtb3VudH0gZnJvbSAke2ludm9pY2Uuc291cmNlTmFtZX0uYCk7XG4gICAgaWYgKHJlcXVlc3Rlcj8uUGxheWVyRGF0YT8uc291cmNlKSB7XG4gICAgICAgIG5vdGlmeShyZXF1ZXN0ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IGRlY2xpbmVkIHlvdXIgaW52b2ljZSBvZiAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgfVxuXG4gICAgbG9nQmFua0V2ZW50KCdJbnZvaWNlIERlY2xpbmVkJywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBkZWNsaW5lZCBpbnZvaWNlIGZyb20gJHtpbnZvaWNlLnNvdXJjZU5hbWV9IGZvciAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxuXG5leHBvcnQgY29uc3QgSW52b2ljZVJlY3VycmluZ1BheW1lbnRzID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcblxuICAgIGNvbnN0IGR1ZUludm9pY2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcbiAgICAgICAgQ09MTEVDVElPTixcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzOiB7ICRpbjogWydhY3RpdmUnLCAnb3ZlcmR1ZSddIH0sXG4gICAgICAgICAgICBuZXh0UGF5bWVudERhdGU6IHsgJGx0ZTogbm93IH0sXG4gICAgICAgICAgICByZW1haW5pbmdQYXltZW50czogeyAkZ3Q6IDAgfVxuICAgICAgICB9LFxuICAgICAgICBudWxsLFxuICAgICAgICBmYWxzZSxcbiAgICAgICAgeyBzb3J0OiB7IG5leHRQYXltZW50RGF0ZTogMSB9LCBsaW1pdDogNTAgfSAvLyBwcm9jZXNzIGluIGJhdGNoZXNcbiAgICApIGFzIFBob25lQmFua0ludm9pY2VEb2NbXTtcblxuICAgIGZvciAoY29uc3QgaW52b2ljZSBvZiBkdWVJbnZvaWNlcykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGF5ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZChpbnZvaWNlLnRvKTtcbiAgICAgICAgICAgIGlmICghcGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAvLyBQYXllciBvZmZsaW5lIFx1MjAxNCBjaG9vc2UgeW91ciBwb2xpY3kuIFdlJ2xsIGp1c3QgbWFyayBhdHRlbXB0IGFuZCByZXRyeSBsYXRlci5cbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwge1xuICAgICAgICAgICAgICAgICAgICAkc2V0OiB7IGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLCBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxLCBzdGF0dXM6ICdvdmVyZHVlJyB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRyeSB0byBjaGFyZ2UgdmlhIHRoZSBzYW1lIGFjY2VwdCBsb2dpYyBjb3JlIChEUlktaXNoIHdpdGggYSB0aW55IGludGVybmFsIGNhbGwpXG4gICAgICAgICAgICAvLyBXZSBpbmxpbmUgbWluaW1hbCBsb2dpYzogZGViaXQgcGF5ZXJcbiAgICAgICAgICAgIGNvbnN0IGNoYXJnZWQgPSBkZWJpdEJhbmsocGF5ZXIsIGludm9pY2UuYW1vdW50KTtcbiAgICAgICAgICAgIGlmICghY2hhcmdlZCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpbnZvaWNlLl9pZCB9LCB7IGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLCBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxLCBzdGF0dXM6ICdvdmVyZHVlJyB9KTtcbiAgICAgICAgICAgICAgICBub3RpZnkocGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgUmVjdXJyaW5nIGludm9pY2Ugb2YgJCR7aW52b2ljZS5hbW91bnR9IGZhaWxlZCAoaW5zdWZmaWNpZW50IGZ1bmRzKS5gKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUGF5b3V0XG4gICAgICAgICAgICBsZXQgcGF5b3V0T2sgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnKSB7XG4gICAgICAgICAgICAgICAgcGF5b3V0T2sgPSBhd2FpdCBkZXBvc2l0VG9NYW5hZ2VtZW50U2FmZShpbnZvaWNlLmZyb20sIGludm9pY2UuYW1vdW50KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdGVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS5mcm9tKTtcbiAgICAgICAgICAgICAgICBwYXlvdXRPayA9IHJlcXVlc3RlciA/IGNyZWRpdEJhbmsocmVxdWVzdGVyLCBpbnZvaWNlLmFtb3VudCkgOiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFwYXlvdXRPaykge1xuICAgICAgICAgICAgICAgIC8vIFJlZnVuZFxuICAgICAgICAgICAgICAgIGNyZWRpdEJhbmsocGF5ZXIsIGludm9pY2UuYW1vdW50KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwgeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSB9KTtcbiAgICAgICAgICAgICAgICBub3RpZnkocGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgUmVjdXJyaW5nIGludm9pY2UgcGF5b3V0IGZhaWxlZDsgcmVmdW5kZWQgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQcm9ncmVzcyByZWN1cnJlbmNlXG4gICAgICAgICAgICBjb25zdCBuZXdSZW1haW5pbmcgPSBNYXRoLm1heCgwLCAoaW52b2ljZS5yZW1haW5pbmdQYXltZW50cyA/PyBOdW1iZXIoaW52b2ljZS5udW1iZXJPZlBheW1lbnRzKSkgLSAxKTtcbiAgICAgICAgICAgIGxldCBuZXdTdGF0dXM6IFBob25lQmFua0ludm9pY2VEb2NbJ3N0YXR1cyddID0gJ2FjdGl2ZSc7XG4gICAgICAgICAgICBsZXQgbmV4dERhdGU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAobmV3UmVtYWluaW5nIDw9IDApIHtcbiAgICAgICAgICAgICAgICBuZXdTdGF0dXMgPSAnY29tcGxldGVkJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZSA9IGludm9pY2UubmV4dFBheW1lbnREYXRlID8/IG5vd0lTTygpO1xuICAgICAgICAgICAgICAgIG5leHREYXRlID0gYWRkSW50ZXJ2YWwoYmFzZSwgTnVtYmVyKGludm9pY2UucGF5bWVudFRpbWUpIGFzIFJlY3VycmVuY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwge1xuICAgICAgICAgICAgICAgIHJlbWFpbmluZ1BheW1lbnRzOiBuZXdSZW1haW5pbmcsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiBuZXdTdGF0dXMsXG4gICAgICAgICAgICAgICAgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksXG4gICAgICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiBuZXh0RGF0ZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIG5vdGlmeShwYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBDaGFyZ2VkICQke2ludm9pY2UuYW1vdW50fSBmb3IgcmVjdXJyaW5nIGludm9pY2UgKCR7bmV3UmVtYWluaW5nfSBsZWZ0KS5gKTtcbiAgICAgICAgICAgIGxvZ0JhbmtFdmVudCgnUmVjdXJyaW5nIEludm9pY2UgUGF5bWVudCcsIGAke2ludm9pY2UudGFyZ2V0TmFtZX0gcGFpZCAkJHtpbnZvaWNlLmFtb3VudH0gdG8gJHtpbnZvaWNlLnNvdXJjZU5hbWV9JHtpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnID8gJyAoYnVzaW5lc3MpJyA6ICcnfS5gKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignUmVjdXJyaW5nIHBheW1lbnQgZXJyb3IgZm9yJywgaW52b2ljZS5faWQsIGUpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHtcbiAgICAgICAgICAgICAgICAkc2V0OiB7IGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLCBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxufTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjaywgdHJpZ2dlckNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgRnJhbWV3b3JrLCBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcblxub25DbGllbnRDYWxsYmFjaygnZ3JvdXBzOmdldG11bHRpUGxlSm9icycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIoc291cmNlKTtcbiAgICBjb25zdCBqb2JzRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQgfSk7XG4gICAgY29uc3QgY3VycmVudEpvYiA9IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmpvYi5uYW1lO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IGN1cnJlbnRKb2IsIGpvYnNEYXRhIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dyb3VwczpkZWxldGVNdWx0aUpvYicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSk7XG4gICAgY29uc3Qgam9iID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aWpvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7bmFtZX0gZGVsZXRlZCBqb2IgJHtqb2Iuam9iTmFtZX0gKCR7am9iLmNpdGl6ZW5JZH0pYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dyb3VwczpjaGFuZ2VKb2JPZlBsYXllcicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBqb2JOYW1lLCBncmFkZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBpZiAoIWpvYk5hbWUpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFzb3VyY2VQbGF5ZXIpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkNoZWNrSm9iR3JhZGUoam9iTmFtZSwgU3RyaW5nKGdyYWRlKSkpIHtcbiAgICAgICAgc291cmNlUGxheWVyLkZ1bmN0aW9ucy5TZXRKb2Ioam9iTmFtZSwgU3RyaW5nKGdyYWRlKSk7XG4gICAgICAgIGVtaXROZXQoJ1FCQ29yZTpOb3RpZnknLCBzb3VyY2UsIGBKb2IgQ2hhbmdlZCB0byAke2pvYk5hbWV9IFN1Y2Nlc3NmdWxseWAsICdzdWNjZXNzJyk7XG4gICAgICAgIGVtaXROZXQoJ2dyb3Vwczp0b2dnbGVEdXR5JywgTnVtYmVyKHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aWpvYnMnLFxuICAgICAgICAgICAgdGl0bGU6ICdKb2IgQ2hhbmdlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGNoYW5nZWQgam9iIHRvICcke2pvYk5hbWV9JyAoR3JhZGU6ICR7Z3JhZGV9KS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCwgam9iTmFtZSB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlqb2JzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSW52YWxpZCBKb2IgUmVtb3ZlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGF0dGVtcHRlZCB0byBjaGFuZ2UgdG8gaW52YWxpZCBqb2IgJyR7am9iTmFtZX0nLCByZW1vdmVkIGZyb20gbXVsdGktam9icy5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG4vLyBJbnRlcmZhY2VzXG5pbnRlcmZhY2UgUGxheWVyRGF0YSB7XG4gICAgUGxheWVyRGF0YToge1xuICAgICAgICBjaGFyaW5mbzogeyBmaXJzdG5hbWU6IHN0cmluZzsgbGFzdG5hbWU6IHN0cmluZyB9O1xuICAgICAgICBjaXRpemVuaWQ6IHN0cmluZztcbiAgICAgICAgc291cmNlOiBudW1iZXI7XG4gICAgfTtcbn1cblxuaW50ZXJmYWNlIEdyb3VwTWVtYmVyIHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgQ0lEOiBzdHJpbmc7XG4gICAgUGxheWVyOiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBFbXBsb3ltZW50R3JvdXAge1xuICAgIGlkOiBudW1iZXI7XG4gICAgc3RhdHVzOiBzdHJpbmc7XG4gICAgR05hbWU6IHN0cmluZztcbiAgICBHUGFzczogc3RyaW5nO1xuICAgIEdMb2dvOiBzdHJpbmc7XG4gICAgVXNlcnM6IG51bWJlcjtcbiAgICBsZWFkZXI6IG51bWJlcjtcbiAgICBtZW1iZXJzOiBHcm91cE1lbWJlcltdO1xuICAgIHN0YWdlOiBhbnlbXTtcbiAgICBTY3JpcHRDcmVhdGVkPzogYm9vbGVhbjtcbn0iLCAiaW1wb3J0IHsgRnJhbWV3b3JrLCBNb25nb0RCIH0gZnJvbSAnQHNlcnZlci9zdl9tYWluJztcbmltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tICdAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXInO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSAnQHNoYXJlZC91dGlscyc7XG5cbmludGVyZmFjZSBIZWFydFN5bmNQcm9maWxlIHtcbiAgICBfaWQ/OiBzdHJpbmc7XG4gICAgY2l0aXplbklkOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGFnZTogbnVtYmVyO1xuICAgIGdlbmRlcjogc3RyaW5nO1xuICAgIGJpbzogc3RyaW5nO1xuICAgIHBob3Rvczogc3RyaW5nW107XG4gICAgaW50ZXJlc3RzOiBzdHJpbmdbXTtcbiAgICBsb29raW5nRm9yOiBzdHJpbmc7XG4gICAgaW50ZXJlc3RlZEluR2VuZGVyczogc3RyaW5nW107XG4gICAgYWdlUmFuZ2VNaW46IG51bWJlcjtcbiAgICBhZ2VSYW5nZU1heDogbnVtYmVyO1xuICAgIG1heERpc3RhbmNlOiBudW1iZXI7XG4gICAgc2hvd09ubGluZTogYm9vbGVhbjtcbiAgICBsb2NhdGlvbj86IHtcbiAgICAgICAgbGF0OiBudW1iZXI7XG4gICAgICAgIGxuZzogbnVtYmVyO1xuICAgICAgICBjaXR5OiBzdHJpbmc7XG4gICAgfTtcbiAgICB3b3JrPzogc3RyaW5nO1xuICAgIHNjaG9vbD86IHN0cmluZztcbiAgICBoZWlnaHQ/OiBudW1iZXI7XG4gICAgem9kaWFjU2lnbj86IHN0cmluZztcbiAgICBsaWZlc3R5bGU/OiB7XG4gICAgICAgIHNtb2tpbmc6IHN0cmluZztcbiAgICAgICAgZHJpbmtpbmc6IHN0cmluZztcbiAgICAgICAgZXhlcmNpc2U6IHN0cmluZztcbiAgICAgICAgcGV0czogc3RyaW5nO1xuICAgIH07XG4gICAgcHJvbXB0cz86IHtcbiAgICAgICAgcXVlc3Rpb246IHN0cmluZztcbiAgICAgICAgYW5zd2VyOiBzdHJpbmc7XG4gICAgfVtdO1xuICAgIHZlcmlmaWVkOiBib29sZWFuO1xuICAgIHByZW1pdW06IGJvb2xlYW47XG4gICAgc3VwZXJMaWtlc1JlbWFpbmluZzogbnVtYmVyO1xuICAgIGxpa2VzUmVtYWluaW5nOiBudW1iZXI7XG4gICAgZGFpbHlTd2lwZXM6IG51bWJlcjtcbiAgICBsYXN0U3dpcGVSZXNldDogRGF0ZTtcbiAgICBjcmVhdGVkQXQ6IERhdGU7XG4gICAgbGFzdEFjdGl2ZTogRGF0ZTtcbiAgICBpc0FjdGl2ZTogYm9vbGVhbjtcbn1cbmludGVyZmFjZSBNZXNzYWdlIHtcbiAgICBfaWQ6IHN0cmluZztcbiAgICBzZW5kZXJJZDogc3RyaW5nO1xuICAgIHJlY2VpdmVySWQ6IHN0cmluZztcbiAgICBtYXRjaElkOiBzdHJpbmc7XG4gICAgY29udGVudDogc3RyaW5nO1xuICAgIHRpbWVzdGFtcDogc3RyaW5nO1xuICAgIHJlYWQ6IGJvb2xlYW47XG59XG5jbGFzcyBIZWFydFN5bmNTZXJ2ZXIge1xuICAgIGFzeW5jIGdldFByb2ZpbGUoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGUgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHByb2ZpbGUgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHByb2ZpbGU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIEhlYXJ0U3luYyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgY3JlYXRlUHJvZmlsZShzb3VyY2U6IG51bWJlciwgcHJvZmlsZURhdGE6IFBhcnRpYWw8SGVhcnRTeW5jUHJvZmlsZT4pOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGUgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgcHJvZmlsZSBhbHJlYWR5IGV4aXN0c1xuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdQcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ1Byb2ZpbGUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb2ZpbGUgYWxyZWFkeSBleGlzdHMnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmV3UHJvZmlsZTogSGVhcnRTeW5jUHJvZmlsZSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBwcm9maWxlRGF0YS5uYW1lIHx8ICcnLFxuICAgICAgICAgICAgICAgIGFnZTogcHJvZmlsZURhdGEuYWdlIHx8IDE4LFxuICAgICAgICAgICAgICAgIGdlbmRlcjogcHJvZmlsZURhdGEuZ2VuZGVyIHx8ICcnLFxuICAgICAgICAgICAgICAgIGJpbzogcHJvZmlsZURhdGEuYmlvIHx8ICcnLFxuICAgICAgICAgICAgICAgIHBob3RvczogcHJvZmlsZURhdGEucGhvdG9zIHx8IFtdLFxuICAgICAgICAgICAgICAgIGludGVyZXN0czogcHJvZmlsZURhdGEuaW50ZXJlc3RzIHx8IFtdLFxuICAgICAgICAgICAgICAgIGxvb2tpbmdGb3I6IHByb2ZpbGVEYXRhLmxvb2tpbmdGb3IgfHwgJycsXG4gICAgICAgICAgICAgICAgaW50ZXJlc3RlZEluR2VuZGVyczogcHJvZmlsZURhdGEuaW50ZXJlc3RlZEluR2VuZGVycyB8fCBbXSxcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZU1pbjogcHJvZmlsZURhdGEuYWdlUmFuZ2VNaW4gfHwgMTgsXG4gICAgICAgICAgICAgICAgYWdlUmFuZ2VNYXg6IHByb2ZpbGVEYXRhLmFnZVJhbmdlTWF4IHx8IDM1LFxuICAgICAgICAgICAgICAgIG1heERpc3RhbmNlOiBwcm9maWxlRGF0YS5tYXhEaXN0YW5jZSB8fCAyNSxcbiAgICAgICAgICAgICAgICBzaG93T25saW5lOiBwcm9maWxlRGF0YS5zaG93T25saW5lICE9PSB1bmRlZmluZWQgPyBwcm9maWxlRGF0YS5zaG93T25saW5lIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICB3b3JrOiBwcm9maWxlRGF0YS53b3JrIHx8ICcnLFxuICAgICAgICAgICAgICAgIHNjaG9vbDogcHJvZmlsZURhdGEuc2Nob29sIHx8ICcnLFxuICAgICAgICAgICAgICAgIGhlaWdodDogcHJvZmlsZURhdGEuaGVpZ2h0LFxuICAgICAgICAgICAgICAgIHpvZGlhY1NpZ246IHByb2ZpbGVEYXRhLnpvZGlhY1NpZ24gfHwgJycsXG4gICAgICAgICAgICAgICAgbGlmZXN0eWxlOiBwcm9maWxlRGF0YS5saWZlc3R5bGUgfHwge1xuICAgICAgICAgICAgICAgICAgICBzbW9raW5nOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgZHJpbmtpbmc6ICcnLFxuICAgICAgICAgICAgICAgICAgICBleGVyY2lzZTogJycsXG4gICAgICAgICAgICAgICAgICAgIHBldHM6ICcnXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcHJlbWl1bTogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3VwZXJMaWtlc1JlbWFpbmluZzogNSxcbiAgICAgICAgICAgICAgICBsaWtlc1JlbWFpbmluZzogNTAsXG4gICAgICAgICAgICAgICAgZGFpbHlTd2lwZXM6IDAsXG4gICAgICAgICAgICAgICAgbGFzdFN3aXBlUmVzZXQ6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgIGxhc3RBY3RpdmU6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWVcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCBuZXdQcm9maWxlKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3VsdCk7XG4gICAgICAgICAgICByZXR1cm4geyAuLi5uZXdQcm9maWxlLCBfaWQ6IHJlc3VsdCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgY3JlYXRpbmcgSGVhcnRTeW5jIHByb2ZpbGU6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyB1cGRhdGVQcm9maWxlKHNvdXJjZTogbnVtYmVyLCBwcm9maWxlRGF0YTogUGFydGlhbDxIZWFydFN5bmNQcm9maWxlPik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZSB8IG51bGw+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBudWxsO1xuXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVEYXRhID0ge1xuICAgICAgICAgICAgICAgIC4uLnByb2ZpbGVEYXRhLFxuICAgICAgICAgICAgICAgIGxhc3RBY3RpdmU6IG5ldyBEYXRlKClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9LCB1cGRhdGVEYXRhLCB1bmRlZmluZWQsIGZhbHNlLCB7IHVwc2VydDogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC52YWx1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIEhlYXJ0U3luYyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IHVzZXJQcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmICghdXNlclByb2ZpbGUpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgLy8gR2V0IHVzZXJzIGFscmVhZHkgc3dpcGVkIG9uXG4gICAgICAgICAgICBjb25zdCBzd2lwZWRVc2VycyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19zd2lwZXMnLCB7XG4gICAgICAgICAgICAgICAgZnJvbVVzZXJJZDogY2l0aXplbklkXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIGNvbnN0IHN3aXBlZFVzZXJJZHMgPSBzd2lwZWRVc2Vycy5tYXAoKHN3aXBlOiBhbnkpID0+IHN3aXBlLnRvVXNlcklkKTtcblxuICAgICAgICAgICAgLy8gR2V0IG1hdGNoZWQgdXNlcnNcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMUlkOiBjaXRpemVuSWQgfSxcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMklkOiBjaXRpemVuSWQgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWVcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZFVzZXJJZHMgPSBtYXRjaGVzLm1hcCgobWF0Y2g6IGFueSkgPT5cbiAgICAgICAgICAgICAgICBtYXRjaC51c2VyMUlkID09PSBjaXRpemVuSWQgPyBtYXRjaC51c2VyMklkIDogbWF0Y2gudXNlcjFJZFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gQ29tYmluZSBleGNsdWRlZCB1c2Vyc1xuICAgICAgICAgICAgY29uc3QgZXhjbHVkZWRVc2VySWRzID0gWy4uLnN3aXBlZFVzZXJJZHMsIC4uLm1hdGNoZWRVc2VySWRzLCBjaXRpemVuSWRdO1xuXG4gICAgICAgICAgICAvLyBCdWlsZCBtYXRjaCBjcml0ZXJpYVxuICAgICAgICAgICAgY29uc3QgbWF0Y2hDcml0ZXJpYTogYW55ID0ge1xuICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogeyAkbmluOiBleGNsdWRlZFVzZXJJZHMgfSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhZ2U6IHsgJGd0ZTogdXNlclByb2ZpbGUuYWdlUmFuZ2VNaW4sICRsdGU6IHVzZXJQcm9maWxlLmFnZVJhbmdlTWF4IH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIEFkZCBnZW5kZXIgcHJlZmVyZW5jZXNcbiAgICAgICAgICAgIGlmICh1c2VyUHJvZmlsZS5sb29raW5nRm9yICE9PSAnRXZlcnlvbmUnKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hDcml0ZXJpYS5nZW5kZXIgPSB1c2VyUHJvZmlsZS5sb29raW5nRm9yID09PSAnTWVuJyA/ICdNYW4nIDogJ1dvbWFuJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHVzZXJQcm9maWxlLmludGVyZXN0ZWRJbkdlbmRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIG1hdGNoQ3JpdGVyaWEubG9va2luZ0ZvciA9IHtcbiAgICAgICAgICAgICAgICAgICAgJGluOiB1c2VyUHJvZmlsZS5pbnRlcmVzdGVkSW5HZW5kZXJzLmluY2x1ZGVzKHVzZXJQcm9maWxlLmdlbmRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgID8gdXNlclByb2ZpbGUuaW50ZXJlc3RlZEluR2VuZGVyc1xuICAgICAgICAgICAgICAgICAgICAgICAgOiBbLi4udXNlclByb2ZpbGUuaW50ZXJlc3RlZEluR2VuZGVycywgJ0V2ZXJ5b25lJ11cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwb3RlbnRpYWxNYXRjaGVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgbWF0Y2hDcml0ZXJpYSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBsaW1pdDogMjAgfSlcblxuICAgICAgICAgICAgcmV0dXJuIHBvdGVudGlhbE1hdGNoZXM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIHBvdGVudGlhbCBtYXRjaGVzOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHN3aXBlUHJvZmlsZShzb3VyY2U6IG51bWJlciwgc3dpcGVEYXRhOiB7IHRhcmdldFVzZXJJZDogc3RyaW5nOyBpc0xpa2U6IGJvb2xlYW47IGlzU3VwZXJMaWtlPzogYm9vbGVhbiB9KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgaXNNYXRjaDogZmFsc2UgfTtcblxuICAgICAgICAgICAgY29uc3QgeyB0YXJnZXRVc2VySWQsIGlzTGlrZSwgaXNTdXBlckxpa2UgPSBmYWxzZSB9ID0gc3dpcGVEYXRhO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBkYWlseSBsaW1pdHNcbiAgICAgICAgICAgIGNvbnN0IHVzZXJQcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmICghdXNlclByb2ZpbGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBpc01hdGNoOiBmYWxzZSB9O1xuXG4gICAgICAgICAgICBpZiAoaXNTdXBlckxpa2UgJiYgdXNlclByb2ZpbGUuc3VwZXJMaWtlc1JlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGlzTWF0Y2g6IGZhbHNlLCBlcnJvcjogJ05vIHN1cGVyIGxpa2VzIHJlbWFpbmluZycgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVjb3JkIHRoZSBzd2lwZVxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ2hlYXJ0c3luY19zd2lwZXMnLCB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBmcm9tVXNlcklkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgdG9Vc2VySWQ6IHRhcmdldFVzZXJJZCxcbiAgICAgICAgICAgICAgICBpc0xpa2UsXG4gICAgICAgICAgICAgICAgaXNTdXBlckxpa2UsXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbGV0IGlzTWF0Y2ggPSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIG1hdGNoIGlmIGl0J3MgYSBsaWtlXG4gICAgICAgICAgICBpZiAoaXNMaWtlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVjaXByb2NhbFN3aXBlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfc3dpcGVzJywge1xuICAgICAgICAgICAgICAgICAgICBmcm9tVXNlcklkOiB0YXJnZXRVc2VySWQsXG4gICAgICAgICAgICAgICAgICAgIHRvVXNlcklkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgICAgIGlzTGlrZTogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlY2lwcm9jYWxTd2lwZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBDcmVhdGUgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZXIxSWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZXIySWQ6IHRhcmdldFVzZXJJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNTdXBlckxpa2U6IGlzU3VwZXJMaWtlIHx8IHJlY2lwcm9jYWxTd2lwZS5pc1N1cGVyTGlrZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgaXNNYXRjaCA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBub3RpZmljYXRpb25zIHRvIGJvdGggdXNlcnMgYWJvdXQgdGhlIG1hdGNoXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBHZXQgcGxheWVyIGRhdGEgZm9yIGJvdGggdXNlcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXBlckRhdGEgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXREYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZCh0YXJnZXRVc2VySWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBHZXQgb2ZmbGluZSBkYXRhIGlmIHBsYXllcnMgYXJlIG5vdCBvbmxpbmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN3aXBlclBsYXllckRhdGEgPSBzd2lwZXJEYXRhIHx8IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0T2ZmbGluZVBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRQbGF5ZXJEYXRhID0gdGFyZ2V0RGF0YSB8fCBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldE9mZmxpbmVQbGF5ZXJCeUNpdGl6ZW5JZCh0YXJnZXRVc2VySWQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTZW5kIG5vdGlmaWNhdGlvbiB0byB0aGUgc3dpcGVyIChjdXJyZW50IHVzZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3dpcGVyRGF0YSAmJiBzd2lwZXJEYXRhLlBsYXllckRhdGEuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzd2lwZXJEYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiSGVhcnRTeW5jIE1hdGNoISBcdUQ4M0RcdURDOTVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgbWF0Y2hlZCB3aXRoICR7dGFyZ2V0UGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXJEYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogXCJoZWFydHN5bmNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBub3RpZmljYXRpb24gdG8gdGhlIHRhcmdldCB1c2VyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0RGF0YSAmJiB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiSGVhcnRTeW5jIE1hdGNoISBcdUQ4M0RcdURDOTVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgbWF0Y2hlZCB3aXRoICR7c3dpcGVyUGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzd2lwZXJQbGF5ZXJEYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogXCJoZWFydHN5bmNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAobm90aWZpY2F0aW9uRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNlbmRpbmcgbWF0Y2ggbm90aWZpY2F0aW9uczonLCBub3RpZmljYXRpb25FcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgc3dpcGUgY291bnRzXG4gICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlRGF0YTogYW55ID0ge1xuICAgICAgICAgICAgICAgICAgICBkYWlseVN3aXBlczogdXNlclByb2ZpbGUuZGFpbHlTd2lwZXMgKyAxXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGlmIChpc1N1cGVyTGlrZSkge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVEYXRhLnN1cGVyTGlrZXNSZW1haW5pbmcgPSB1c2VyUHJvZmlsZS5zdXBlckxpa2VzUmVtYWluaW5nIC0gMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVEYXRhLmxpa2VzUmVtYWluaW5nID0gdXNlclByb2ZpbGUubGlrZXNSZW1haW5pbmcgLSAxO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9LCB1cGRhdGVEYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgaXNNYXRjaCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc3dpcGluZyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBpc01hdGNoOiBmYWxzZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0TWF0Y2hlcyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8YW55W10+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tYXRjaGVzJywge1xuICAgICAgICAgICAgICAgICRvcjogW1xuICAgICAgICAgICAgICAgICAgICB7IHVzZXIxSWQ6IGNpdGl6ZW5JZCB9LFxuICAgICAgICAgICAgICAgICAgICB7IHVzZXIySWQ6IGNpdGl6ZW5JZCB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBzb3J0OiB7IG1hdGNoZWRBdDogLTEgfSB9KTtcblxuICAgICAgICAgICAgY29uc3QgZW5yaWNoZWRNYXRjaGVzID0gYXdhaXQgUHJvbWlzZS5hbGwobWF0Y2hlcy5tYXAoYXN5bmMgKG1hdGNoOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlclVzZXJJZCA9IG1hdGNoLnVzZXIxSWQgPT09IGNpdGl6ZW5JZCA/IG1hdGNoLnVzZXIySWQgOiBtYXRjaC51c2VyMUlkO1xuICAgICAgICAgICAgICAgIGNvbnN0IG90aGVyVXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQ6IG90aGVyVXNlcklkIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGFzdE1lc3NhZ2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19tZXNzYWdlcycsIHsgbWF0Y2hJZDogbWF0Y2guX2lkIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgc29ydDogeyB0aW1lc3RhbXA6IC0xIH0gfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAuLi5tYXRjaCxcbiAgICAgICAgICAgICAgICAgICAgb3RoZXJVc2VyLFxuICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogbGFzdE1lc3NhZ2U/LmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlVGltZTogbGFzdE1lc3NhZ2U/LnRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICAgICAgaXNOZXdNYXRjaDogIWxhc3RNZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB1bnJlYWRDb3VudDogYXdhaXQgdGhpcy5nZXRVbnJlYWRNZXNzYWdlQ291bnQobWF0Y2guX2lkIS50b1N0cmluZygpLCBjaXRpemVuSWQpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgcmV0dXJuIGVucmljaGVkTWF0Y2hlcztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgbWF0Y2hlczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFVucmVhZE1lc3NhZ2VDb3VudChtYXRjaElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21lc3NhZ2VzJywge1xuICAgICAgICAgICAgICAgIG1hdGNoSWQsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZXJJZDogdXNlcklkLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIHJldHVybiBjb3VudC5sZW5ndGg7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIHVucmVhZCBjb3VudDonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1vY2sgaW1wbGVtZW50YXRpb25zIGZvciBvdGhlciBtZXRob2RzIC0gcmVwbGFjZSB3aXRoIGFjdHVhbCBsb2dpY1xuICAgIGFzeW5jIGdldFN3aXBlU3RhdHMoc291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCBwcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgcmV0dXJuIHByb2ZpbGUgPyB7XG4gICAgICAgICAgICBsaWtlc1JlbWFpbmluZzogcHJvZmlsZS5saWtlc1JlbWFpbmluZyxcbiAgICAgICAgICAgIHN1cGVyTGlrZXNSZW1haW5pbmc6IHByb2ZpbGUuc3VwZXJMaWtlc1JlbWFpbmluZyxcbiAgICAgICAgICAgIGRhaWx5U3dpcGVzOiBwcm9maWxlLmRhaWx5U3dpcGVzXG4gICAgICAgIH0gOiBudWxsO1xuICAgIH1cblxuICAgIGFzeW5jIGdldE5lYXJieVVzZXJzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvbiAtIHJlcGxhY2Ugd2l0aCBhY3R1YWwgZ2VvbG9jYXRpb24gbG9naWNcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2UpO1xuICAgIH1cblxuICAgIGFzeW5jIGdldE9ubGluZVVzZXJzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgY29uc3QgZml2ZU1pbnV0ZXNBZ28gPSBuZXcgRGF0ZShEYXRlLm5vdygpIC0gNSAqIDYwICogMTAwMCk7XG4gICAgICAgICAgICBjb25zdCBvbmxpbmVVc2VycyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19wcm9maWxlcycsIHtcbiAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IHsgJG5lOiBjaXRpemVuSWQgfSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBsYXN0QWN0aXZlOiB7ICRndGU6IGZpdmVNaW51dGVzQWdvIH1cbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgbGltaXQ6IDEwIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gb25saW5lVXNlcnM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIG9ubGluZSB1c2VyczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBnZXRSZWNlbnRseUFjdGl2ZVVzZXJzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgY29uc3Qgb25lRGF5QWdvID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICAgICAgICAgICAgY29uc3QgcmVjZW50VXNlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiB7ICRuZTogY2l0aXplbklkIH0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgbGFzdEFjdGl2ZTogeyAkZ3RlOiBvbmVEYXlBZ28gfVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBsaW1pdDogMTUsIHNvcnQ6IHsgbGFzdEFjdGl2ZTogLTEgfSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlY2VudFVzZXJzO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyByZWNlbnRseSBhY3RpdmUgdXNlcnM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0VG9wUGlja3Moc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGVbXT4ge1xuICAgICAgICAvLyBNb2NrIGltcGxlbWVudGF0aW9uIC0gcmVwbGFjZSB3aXRoIGFjdHVhbCBhbGdvcml0aG1cbiAgICAgICAgY29uc3QgcG90ZW50aWFsTWF0Y2hlcyA9IGF3YWl0IHRoaXMuZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2UpO1xuICAgICAgICByZXR1cm4gcG90ZW50aWFsTWF0Y2hlcy5zbGljZSgwLCA4KTtcbiAgICB9XG5cbiAgICBhc3luYyBnZXROb3RpZmljYXRpb25zKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4geyBuZXdNYXRjaGVzOiAwLCBuZXdNZXNzYWdlczogMCwgc3VwZXJMaWtlczogMCB9O1xuXG4gICAgICAgICAgICAvLyBHZXQgbmV3IG1hdGNoZXMgKG1hdGNoZXMgd2l0aG91dCBtZXNzYWdlcylcbiAgICAgICAgICAgIGNvbnN0IG5ld01hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFt7IHVzZXIxSWQ6IGNpdGl6ZW5JZCB9LCB7IHVzZXIySWQ6IGNpdGl6ZW5JZCB9XSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAvLyBBZGQgbG9naWMgdG8gY2hlY2sgaWYgbWF0Y2ggaXMgbmV3XG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcblxuICAgICAgICAgICAgLy8gR2V0IHVucmVhZCBtZXNzYWdlc1xuICAgICAgICAgICAgY29uc3QgbmV3TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWVzc2FnZXMnLCB7XG4gICAgICAgICAgICAgICAgcmVjZWl2ZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcblxuICAgICAgICAgICAgLy8gR2V0IHJlY2VpdmVkIHN1cGVyIGxpa2VzXG4gICAgICAgICAgICBjb25zdCBzdXBlckxpa2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3N3aXBlcycsIHtcbiAgICAgICAgICAgICAgICB0b1VzZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIGlzU3VwZXJMaWtlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGlzTGlrZTogdHJ1ZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7IG5ld01hdGNoZXM6IG5ld01hdGNoZXMubGVuZ3RoLCBuZXdNZXNzYWdlczogbmV3TWVzc2FnZXMubGVuZ3RoLCBzdXBlckxpa2VzOiBzdXBlckxpa2VzLmxlbmd0aCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBub3RpZmljYXRpb25zOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IG5ld01hdGNoZXM6IDAsIG5ld01lc3NhZ2VzOiAwLCBzdXBlckxpa2VzOiAwIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBnZXRNZXNzYWdlcyhzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWVzc2FnZXMnLCB7IG1hdGNoSWQ6IGRhdGEubWF0Y2hJZCB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBhc3luYyBzZW5kTWVzc2FnZShzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywgeyBfaWQ6IFN0cmluZyhkYXRhLm1hdGNoSWQpIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgICAgICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgbGV0IHNvdXJjZURhdGEgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKHNvdXJjZUNpdGl6ZW5JZCk7XG4gICAgICAgIGxldCB0YXJnZXREYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZXMudXNlcjFJZCA9PT0gc291cmNlQ2l0aXplbklkID8gcmVzLnVzZXIySWQgOiByZXMudXNlcjFJZCk7XG5cbiAgICAgICAgaWYgKCFzb3VyY2VEYXRhKSB7XG4gICAgICAgICAgICBzb3VyY2VEYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRPZmZsaW5lUGxheWVyQnlDaXRpemVuSWQoc291cmNlQ2l0aXplbklkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGFyZ2V0RGF0YSkge1xuICAgICAgICAgICAgdGFyZ2V0RGF0YSA9IGF3YWl0IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0T2ZmbGluZVBsYXllckJ5Q2l0aXplbklkKHJlcy51c2VyMUlkID09PSBzb3VyY2VDaXRpemVuSWQgPyByZXMudXNlcjJJZCA6IHJlcy51c2VyMUlkKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGluc2VydERhdGE6IE1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgcmVhZDogcmVzLnVzZXIxSWQgPT09IHNvdXJjZUNpdGl6ZW5JZCB8fCByZXMudXNlcjJJZCA9PT0gc291cmNlQ2l0aXplbklkID8gdHJ1ZSA6IGZhbHNlLFxuICAgICAgICAgICAgbWF0Y2hJZDogcmVzLl9pZCxcbiAgICAgICAgICAgIHNlbmRlcklkOiBzb3VyY2VDaXRpemVuSWQsXG4gICAgICAgICAgICByZWNlaXZlcklkOiByZXMudXNlcjFJZCA9PT0gc291cmNlQ2l0aXplbklkID8gcmVzLnVzZXIySWQgOiByZXMudXNlcjFJZCxcbiAgICAgICAgICAgIGNvbnRlbnQ6IGRhdGEuY29udGVudCxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfbWVzc2FnZXMnLCBpbnNlcnREYXRhKTtcblxuICAgICAgICBpZiAocmVzLnVzZXIxSWQgIT09IHNvdXJjZUNpdGl6ZW5JZCB8fCByZXMudXNlcjJJZCAhPT0gc291cmNlQ2l0aXplbklkICYmIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UpIHtcbiAgICAgICAgICAgIGVtaXROZXQoJ2hlYXJ0c3luYzpjbGllbnQ6c2VuZE1lc3NhZ2UnLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeShpbnNlcnREYXRhKSk7XG4gICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiSGVhcnRTeW5jXCIsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiWW91IGhhdmUgYSBuZXcgbWVzc2FnZSBmcm9tIFwiICsgc291cmNlRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZSArIFwiIFwiICsgc291cmNlRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lLFxuICAgICAgICAgICAgICAgIGFwcDogXCJoZWFydHN5bmNcIixcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGluc2VydERhdGE7XG4gICAgfVxuXG4gICAgYXN5bmMgdW5tYXRjaChzb3VyY2U6IG51bWJlciwgZGF0YTogeyBtYXRjaElkOiBzdHJpbmcgfSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywgeyBfaWQ6IGRhdGEubWF0Y2hJZCB9KTtcbiAgICAgICAgICAgIGlmICghbWF0Y2ggfHwgIW1hdGNoLmlzQWN0aXZlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgdXNlciBpcyBwYXJ0IG9mIHRoaXMgbWF0Y2hcbiAgICAgICAgICAgIGlmIChtYXRjaC51c2VyMUlkICE9PSBjaXRpemVuSWQgJiYgbWF0Y2gudXNlcjJJZCAhPT0gY2l0aXplbklkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm90IGF1dGhvcml6ZWQgdG8gdW5tYXRjaCB0aGlzIHVzZXInIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIERlYWN0aXZhdGUgdGhlIG1hdGNoXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnaGVhcnRzeW5jX21hdGNoZXMnLCB7IF9pZDogZGF0YS5tYXRjaElkIH0sIHsgaXNBY3RpdmU6IGZhbHNlIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1bm1hdGNoaW5nOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0ZhaWxlZCB0byB1bm1hdGNoJyB9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBoZWFydFN5bmNTZXJ2ZXIgPSBuZXcgSGVhcnRTeW5jU2VydmVyKCk7XG5cbi8vIFJlZ2lzdGVyIHNlcnZlciBjYWxsYmFja3Ncbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXRQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRQcm9maWxlKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmNyZWF0ZVByb2ZpbGUnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuY3JlYXRlUHJvZmlsZShzb3VyY2UsIGRhdGEpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzp1cGRhdGVQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLnVwZGF0ZVByb2ZpbGUoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0UG90ZW50aWFsTWF0Y2hlcycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpzd2lwZVByb2ZpbGUnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuc3dpcGVQcm9maWxlKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE1hdGNoZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE1hdGNoZXMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0U3dpcGVTdGF0cycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0U3dpcGVTdGF0cyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXROZWFyYnlVc2VycycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0TmVhcmJ5VXNlcnMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0T25saW5lVXNlcnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE9ubGluZVVzZXJzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFJlY2VudGx5QWN0aXZlVXNlcnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFJlY2VudGx5QWN0aXZlVXNlcnMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0VG9wUGlja3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFRvcFBpY2tzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE5vdGlmaWNhdGlvbnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE5vdGlmaWNhdGlvbnMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0TWVzc2FnZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0TWVzc2FnZXMoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6c2VuZE1lc3NhZ2UnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuc2VuZE1lc3NhZ2Uoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6dW5tYXRjaCcsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci51bm1hdGNoKHNvdXJjZSwgZGF0YSk7XG59KTtcblxuLy8gQWRkIG1vcmUgY2FsbGJhY2tzIGZvciBtZXNzYWdlcywgc3VwZXIgbGlrZXMsIGV0Yy5cbi8vIC4uLiAoaW1wbGVtZW50IHJlbWFpbmluZyBjYWxsYmFja3MgYXMgbmVlZGVkKVxuXG5leHBvcnQgeyBoZWFydFN5bmNTZXJ2ZXIgfTtcbiIsICJpbXBvcnQgXCIuL3N2X2V4cG9ydHNcIjtcbmltcG9ydCBcIi4vYXBwcy9pbmRleFwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiLi9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL2FwcHMvU2V0dGluZ3MvY2xhc3NcIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgSW52b2ljZVJlY3VycmluZ1BheW1lbnRzIH0gZnJvbSBcIi4vYXBwcy9XYWxsZXQvY2FsbGJhY2tzXCI7XG5pbXBvcnQgeyBwaWdlb25TZXJ2aWNlIH0gZnJvbSBcIi4vYXBwcy9QaWdlb24vUGlnZW9uU2VydmljZVwiO1xuZXhwb3J0IGxldCBGcmFtZXdvcmsgPSBleHBvcnRzWydxYi1jb3JlJ10uR2V0Q29yZU9iamVjdCgpO1xuZXhwb3J0IGNvbnN0IE1vbmdvREIgPSBleHBvcnRzWydtb25nb0RCJ107XG5leHBvcnQgY29uc3QgTXlTUUwgPSBleHBvcnRzLm94bXlzcWw7XG5leHBvcnQgY29uc3QgTG9nZ2VyID0gZXhwb3J0c1sncWItc21hbGxyZXNvdXJjZXMnXTtcblxub24oJ1FCQ29yZTpTZXJ2ZXI6VXBkYXRlT2JqZWN0JywgKCkgPT4ge1xuICAgIEZyYW1ld29yayA9IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRDb3JlT2JqZWN0KCk7XG59KTtcblxuc2V0SW1tZWRpYXRlKCgpID0+IHtcbiAgICBVdGlscy5sb2FkKCk7XG4gICAgU2V0dGluZ3MubG9hZCgpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lOnNlcnZlcjpzaGFyZU51bWJlcicsIGFzeW5jIChzb3VyY2U6IGFueSwgY29taW5nU291cmNlOiBhbnkpID0+IHtcbiAgICBjb25zdCBzb3VyY2VYID0gc291cmNlO1xuICAgIGNvbnN0IHNvdXJjZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlWCk7XG4gICAgY29uc3QgYWNOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNvbWluZ1NvdXJjZSk7XG4gICAgY29uc3QgZnVsbG5hbWUgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShzb3VyY2VYKTtcbiAgICBjb25zdCBicmVha2VkTmFtZSA9IGZ1bGxuYW1lLnNwbGl0KCcgJyk7XG5cbiAgICBpZiAoIXNvdXJjZU51bWJlciB8fCAhYWNOdW1iZXIpIHJldHVybjtcbiAgICBjb25zdCBjb250YWN0RGF0YSA9IHtcbiAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgcGVyc29uYWxOdW1iZXI6IGFjTnVtYmVyLFxuICAgICAgICBjb250YWN0TnVtYmVyOiBzb3VyY2VOdW1iZXIsXG4gICAgICAgIGZpcnN0TmFtZTogYnJlYWtlZE5hbWVbMF0sXG4gICAgICAgIGxhc3ROYW1lOiBicmVha2VkTmFtZVsxXSxcbiAgICAgICAgaW1hZ2U6IGF3YWl0IFV0aWxzLkdldENvbnRhY3RBdmF0YXJCeU51bWJlcihzb3VyY2VOdW1iZXIsIGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIoc291cmNlTnVtYmVyKSksXG4gICAgICAgIG93bmVySWQ6IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIoYWNOdW1iZXIpLFxuICAgICAgICBub3RlczogXCJcIixcbiAgICAgICAgZW1haWw6IFwiXCIsXG4gICAgICAgIGlzRmF2OiBmYWxzZVxuICAgIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBwZXJzb25hbE51bWJlcjogYWNOdW1iZXIsIGNvbnRhY3ROdW1iZXI6IHNvdXJjZU51bWJlciB9KTtcbiAgICBpZiAocmVzKSB7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZVgsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBOdW1iZXIgQWxyZWFkeSBTaGFyZWQuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIE51bWJlcihzb3VyY2VYKSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIlBob25lXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgc2hhcmVkIHlvdXIgUGhvbmUgTnVtYmVyLmAsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgIH0pKTtcbiAgICBjb25zdCBzZW5kSWQgPSBnZW5lcmF0ZVVVaWQoKTtcbiAgICBlbWl0TmV0KCdwaG9uZTphZGRBY3Rpb25Ob3RpZmljYXRpb24nLCBOdW1iZXIoY29taW5nU291cmNlKSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogc2VuZElkLFxuICAgICAgICB0aXRsZTogXCJQaG9uZVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogYCR7ZnVsbG5hbWV9IHdhbnRzIHRvIHNoYXJlIHRoZWlyIG51bWJlciB3aXRoIHlvdS5gLFxuICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgaWNvbnM6IHtcbiAgICAgICAgICAgIFwiMFwiOiB7XG4gICAgICAgICAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9jcm9zcy1jaXJjbGUuc3ZnXCIsXG4gICAgICAgICAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgICAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmFkZENvbnRhY3RcIixcbiAgICAgICAgICAgICAgICBhcmdzOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFwiMVwiOiB7XG4gICAgICAgICAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS90aWNrLnN2Z1wiLFxuICAgICAgICAgICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphZGRDb250YWN0XCIsXG4gICAgICAgICAgICAgICAgYXJnczoge1xuICAgICAgICAgICAgICAgICAgICBjb250YWN0RGF0YSxcbiAgICAgICAgICAgICAgICAgICAgY29taW5nU291cmNlLFxuICAgICAgICAgICAgICAgICAgICBmdWxsbmFtZSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KSk7XG5cbn0pO1xuXG5vbk5ldCgncGhvbmU6c2VydmVyOmFkZENvbnRhY3QnLCBhc3luYyAoaWQ6IHN0cmluZywgZGF0YToge1xuICAgIGNvbWluZ1NvdXJjZTogYW55LFxuICAgIGZ1bGxuYW1lOiBzdHJpbmcsXG4gICAgY29udGFjdERhdGE6IGFueSxcbiAgICBpZDogc3RyaW5nXG59KSA9PiB7XG4gICAgY29uc3Qgc3JjID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBjb25zb2xlLmxvZygnQWRkaW5nIGNvbnRhY3QnLCBpZCwgZGF0YSk7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgc3JjLCBpZCk7XG4gICAgaWYgKCFkYXRhLmNvbnRhY3REYXRhIHx8ICFkYXRhLmNvbWluZ1NvdXJjZSB8fCAhZGF0YS5mdWxsbmFtZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGF3YWl0IERlbGF5KDUwMCk7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzcmMsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgZGVzY3JpcHRpb246IGBOdW1iZXIgU2F2ZWQuYCxcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgfSkpO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9jb250YWN0cycsIGRhdGEuY29udGFjdERhdGEpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICB0aXRsZTogJ0NvbnRhY3QgU2hhcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7ZGF0YS5mdWxsbmFtZX0gLCAke2RhdGEuY29udGFjdERhdGEuY29udGFjdE51bWJlcn0gaGFzIHNoYXJlZCB0aGVpciBudW1iZXIgd2l0aCAke2RhdGEuY29udGFjdERhdGEucGVyc29uYWxOdW1iZXJ9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uKCdzdW1taXRfcGhvbmU6c2VydmVyOkNyb25UcmlnZ2VyJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdDcm9uIFRyaWdnZXJlZCcpO1xuICAgIEludm9pY2VSZWN1cnJpbmdQYXltZW50cygpO1xufSk7XG5cblJlZ2lzdGVyQ29tbWFuZCgncmVzZXRQaG9uZVBhc3Njb2RlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBhcmdzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuO1xuICAgIFNldHRpbmdzLmxvY2tQaW4uc2V0KGNpdGl6ZW5JZCwgJzAwMDAwMCcpO1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIFNldHRpbmdzLlNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIGVtaXROZXQoJ3Bob25lOmNsaWVudDpzZXR1cFBob25lJywgc291cmNlLCBjaXRpemVuSWQpO1xufSwgZmFsc2UpO1xuXG5SZWdpc3RlckNvbW1hbmQoJ3ZlcmlmeVBlZ2lvbicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICBpZiAoIWFyZ3NbMF0pIHtcbiAgICAgICAgcmV0dXJuIExPR0dFUignUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbCBhZGRyZXNzLicpO1xuICAgIH1cbiAgICBjb25zdCBlbWFpbCA9IGFyZ3NbMF07XG4gICAgY29uc3QgcmVzID0gYXdhaXQgcGlnZW9uU2VydmljZS52ZXJpZnlVc2VyKHNvdXJjZSwgZW1haWwpO1xuICAgIGlmIChyZXMgPT09IFwic3VjY2Vzc1wiKSB7XG4gICAgICAgIHJldHVybiBMT0dHRVIoYFVzZXIgJHtlbWFpbH0gaGFzIGJlZW4gdmVyaWZpZWQgc3VjY2Vzc2Z1bGx5LmApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBMT0dHRVIoYEZhaWxlZCB0byB2ZXJpZnkgdXNlciAke2VtYWlsfS4gUmVhc29uOiAke3Jlc31gKTtcbiAgICB9XG59LCB0cnVlKTtcblxub24oJ1FCQ29yZTpTZXJ2ZXI6T25QbGF5ZXJVbmxvYWQnLCBhc3luYyAoc3JjOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc3JjKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuO1xuICAgIGF3YWl0IFNldHRpbmdzLlNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIFNldHRpbmdzLm9uUGxheWVyRGlzY29ubmVjdChjaXRpemVuSWQpO1xufSk7XG5cbm9uKCdwbGF5ZXJEcm9wcGVkJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHNyYyA9IGdsb2JhbC5zb3VyY2U7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNyYyk7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybjtcbiAgICBhd2FpdCBTZXR0aW5ncy5TYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBTZXR0aW5ncy5vblBsYXllckRpc2Nvbm5lY3QoY2l0aXplbklkKTtcbn0pIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7QUFBTyxTQUFTLE1BQU0sSUFBWTtBQUM5QixTQUFPLElBQUksUUFBUSxTQUFPLFdBQVcsS0FBSyxFQUFFLENBQUM7QUFDakQ7QUFGZ0I7QUFRVCxJQUFNLGVBQWUsNkJBQU07QUFDOUIsU0FBTyx1Q0FBdUMsUUFBUSxTQUFTLFNBQVUsR0FBRztBQUN4RSxRQUFJLElBQUksS0FBSyxPQUFPLElBQUksS0FBSyxHQUFHLElBQUksS0FBSyxNQUFNLElBQUksSUFBSSxJQUFNO0FBQzdELFdBQU8sRUFBRSxTQUFTLEVBQUU7QUFBQSxFQUN4QixDQUFDO0FBQ0wsR0FMNEI7QUFPckIsSUFBTSxTQUFTLHdCQUFDLFlBQW9CO0FBQ3ZDLFNBQU8sUUFBUSxJQUFJLHdEQUF3RCxPQUFPLFNBQVM7QUFDL0YsR0FGc0I7OztBQ1p0QixJQUFNLFFBQU4sTUFBTSxNQUFLO0FBQUEsRUFDQTtBQUFBLEVBQ1AsY0FBYztBQUNWLFNBQUssZUFBZSxDQUFDO0FBQUEsRUFDekI7QUFBQSxFQUVBLE1BQU0sT0FBTztBQUNULG9CQUFnQixtQkFBbUIsT0FBT0EsU0FBYSxTQUFjO0FBQ2pFLFVBQUlBLFlBQVcsRUFBRyxRQUFPLE9BQU8sNENBQTRDO0FBQzVFLFlBQU0sTUFBTSxnQkFBZ0I7QUFBQSxJQUNoQyxHQUFHLElBQUk7QUFFUCxvQkFBZ0Isb0JBQW9CLE9BQU9BLFNBQWEsU0FBYztBQUNsRSxVQUFJQSxZQUFXLEVBQUcsUUFBTyxPQUFPLDRDQUE0QztBQUM1RSxZQUFNLE1BQU0saUJBQWlCO0FBQUEsSUFDakMsR0FBRyxJQUFJO0FBRVAsb0JBQWdCLHVCQUF1QixPQUFPQSxTQUFhLFNBQWM7QUFDckUsVUFBSUEsWUFBVyxFQUFHLFFBQU8sT0FBTyw0Q0FBNEM7QUFDNUUsWUFBTSxNQUFNLG9CQUFvQjtBQUFBLElBQ3BDLEdBQUcsSUFBSTtBQUVQLG9CQUFnQixrQkFBa0IsT0FBT0EsU0FBYSxTQUFjO0FBQ2hFLFVBQUlBLFlBQVcsRUFBRyxRQUFPLE9BQU8sNENBQTRDO0FBQzVFLFlBQU0sTUFBTSxtQkFBbUI7QUFBQSxJQUNuQyxHQUFHLElBQUk7QUFBQSxFQUNYO0FBQUEsRUFFQSxNQUFNLGtCQUFrQjtBQUNwQixRQUFJLGFBQW9CLENBQUM7QUFDekIsUUFBSSxjQUFxQixDQUFDO0FBQzFCLFFBQUksV0FBa0IsQ0FBQztBQUV2QixVQUFNLE1BQU0sMkNBQTJDLENBQUMsR0FBRyxPQUFPLFdBQWtCO0FBQ2hGLFVBQUk7QUFDQSxtQkFBVyxPQUFPLFFBQVE7QUFDdEIsZ0JBQU0sUUFBUSxJQUFJO0FBQ2xCLGNBQUksV0FBVyxJQUFJO0FBR25CLGNBQUksT0FBTyxhQUFhLFVBQVU7QUFDOUIsZ0JBQUk7QUFDQSx5QkFBVyxLQUFLLE1BQU0sUUFBUTtBQUFBLFlBQ2xDLFNBQVMsR0FBRztBQUNSLHlCQUFXLENBQUM7QUFBQSxZQUNoQjtBQUFBLFVBQ0o7QUFHQSxnQkFBTSxTQUFVLGFBQWEsU0FBUyxTQUFTLFNBQVMsaUJBQWtCO0FBQzFFLGNBQUksQ0FBQyxPQUFRO0FBR2IsZ0JBQU0sV0FBVyxNQUFNLFFBQVEsUUFBUSxpQkFBaUIsRUFBRSxNQUFNLENBQUM7QUFDakUsY0FBSSxTQUFVO0FBRWQscUJBQVcsS0FBSztBQUFBLFlBQ1osS0FBSyxhQUFhO0FBQUEsWUFDbEI7QUFBQSxZQUNBO0FBQUEsVUFDSixDQUFDO0FBR0QsZ0JBQU0sbUJBQW1CLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLEtBQUssTUFBTSxDQUFDO0FBQy9FLGNBQUksQ0FBQyxrQkFBa0I7QUFDbkIsd0JBQVksS0FBSztBQUFBLGNBQ2IsS0FBSztBQUFBLGNBQ0wsWUFBWSxFQUFFLFNBQVMsSUFBSSxZQUFZLENBQUMsRUFBRTtBQUFBLGNBQzFDLFlBQVksRUFBRSxTQUFTLElBQUksWUFBWSxDQUFDLEVBQUU7QUFBQSxjQUMxQyxVQUFVO0FBQUEsZ0JBQ04sU0FBUztBQUFBLGdCQUNULFdBQVc7QUFBQSxrQkFDUDtBQUFBLG9CQUNJLE1BQU07QUFBQSxvQkFDTixLQUFLO0FBQUEsa0JBQ1Q7QUFBQSxnQkFDSjtBQUFBLGNBQ0o7QUFBQSxjQUNBLG1CQUFtQjtBQUFBLGNBQ25CLG1CQUFtQjtBQUFBLGNBQ25CLFFBQVE7QUFBQSxjQUNSLFNBQVM7QUFBQSxjQUNULFFBQVE7QUFBQSxjQUNSLGFBQWE7QUFBQSxjQUNiLFdBQVc7QUFBQSxjQUNYLGtCQUFrQjtBQUFBLGNBQ2xCLG9CQUFvQjtBQUFBLGNBQ3BCLGtCQUFrQjtBQUFBLGNBQ2xCLFFBQVE7QUFBQSxjQUNSLGNBQWM7QUFBQSxjQUNkLGNBQWM7QUFBQSxZQUNsQixDQUFDO0FBQUEsVUFDTDtBQUdBLGdCQUFNLGVBQWUsTUFBTSxRQUFRLFFBQVEscUJBQXFCLEVBQUUsS0FBSyxNQUFNLENBQUM7QUFDOUUsY0FBSSxDQUFDLGNBQWM7QUFDZixxQkFBUyxLQUFLO0FBQUEsY0FDVixLQUFLO0FBQUEsY0FDTCxXQUFXO0FBQUEsY0FDWCxVQUFVO0FBQUEsY0FDVixhQUFhO0FBQUEsY0FDYixPQUFPO0FBQUEsY0FDUCxPQUFPO0FBQUEsY0FDUCxRQUFRO0FBQUEsWUFDWixDQUFDO0FBQUEsVUFDTDtBQUFBLFFBQ0o7QUFFQSxZQUFJLFdBQVcsU0FBUyxHQUFHO0FBQ3ZCLGdCQUFNLFFBQVEsV0FBVyxpQkFBaUIsVUFBVTtBQUNwRCxpQkFBTyxZQUFZLFdBQVcsTUFBTSxpQkFBaUI7QUFBQSxRQUN6RCxPQUFPO0FBQ0gsaUJBQU8saUNBQWlDO0FBQUEsUUFDNUM7QUFFQSxZQUFJLFlBQVksU0FBUyxHQUFHO0FBQ3hCLGdCQUFNLFFBQVEsV0FBVyxrQkFBa0IsV0FBVztBQUN0RCxpQkFBTyxZQUFZLFlBQVksTUFBTSxrQkFBa0I7QUFBQSxRQUMzRCxPQUFPO0FBQ0gsaUJBQU8sa0NBQWtDO0FBQUEsUUFDN0M7QUFFQSxZQUFJLFNBQVMsU0FBUyxHQUFHO0FBQ3JCLGdCQUFNLFFBQVEsV0FBVyxxQkFBcUIsUUFBUTtBQUN0RCxpQkFBTyxZQUFZLFNBQVMsTUFBTSw2QkFBNkI7QUFBQSxRQUNuRSxPQUFPO0FBQ0gsaUJBQU8sNkNBQTZDO0FBQUEsUUFDeEQ7QUFBQSxNQUNKLFNBQVMsS0FBSztBQUNWLGVBQU8sMEJBQTBCLEdBQUcsRUFBRTtBQUFBLE1BQzFDO0FBQUEsSUFDSixDQUFDO0FBQUEsRUFDTDtBQUFBLEVBRUEsTUFBTSxtQkFBbUI7QUFDckIsUUFBSTtBQUNBLFlBQU0sU0FBYyxNQUFNLEtBQUssTUFBTSxzQ0FBc0MsQ0FBQyxDQUFDO0FBRTdFLFVBQUksQ0FBQyxVQUFVLE9BQU8sV0FBVyxHQUFHO0FBQ2hDLGVBQU8sZ0NBQWdDO0FBQ3ZDO0FBQUEsTUFDSjtBQUNBLGlCQUFXLENBQUMsT0FBTyxPQUFPLEtBQUssT0FBTyxRQUFRLEdBQUc7QUFDN0MsWUFBSSxRQUFRLE9BQU8sT0FBUTtBQUMzQixnQkFBUSxJQUFJLHNCQUFzQixRQUFRLENBQUMsT0FBTyxPQUFPLE1BQU0sRUFBRTtBQUNqRSxjQUFNLFVBQVUsTUFBTSxLQUFLLDBCQUEwQixRQUFRLFlBQVk7QUFDekUsYUFBSyxhQUFhLEtBQUs7QUFBQSxVQUNuQixLQUFLLGFBQWE7QUFBQSxVQUNsQixnQkFBZ0IsUUFBUTtBQUFBLFVBQ3hCLGVBQWUsUUFBUTtBQUFBLFVBQ3ZCLFdBQVcsUUFBUTtBQUFBLFVBQ25CLFVBQVUsUUFBUTtBQUFBLFVBQ2xCLE9BQU8sUUFBUTtBQUFBLFVBQ2Y7QUFBQSxRQUNKLENBQUM7QUFBQSxNQUNMO0FBQ0EsWUFBTSxRQUFRLFdBQVcsa0JBQWtCLEtBQUssWUFBWTtBQUM1RCxhQUFPLGtEQUFrRDtBQUFBLElBQzdELFNBQVMsR0FBRztBQUNSLGFBQU8sc0NBQXNDLEtBQUssVUFBVSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEVBQUU7QUFBQSxJQUM3RTtBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQU0sc0JBQXNCO0FBdktoQztBQXdLUSxRQUFJO0FBQ0EsWUFBTSxTQUFjLE1BQU0sS0FBSyxNQUFNLGtEQUFrRCxDQUFDLENBQUM7QUFDekYsVUFBSSxDQUFDLFVBQVUsT0FBTyxXQUFXLEdBQUc7QUFDaEMsZUFBTyxpQ0FBaUM7QUFDeEM7QUFBQSxNQUNKO0FBRUEsWUFBTSxVQUFpQixDQUFDO0FBRXhCLGlCQUFXLE9BQU8sUUFBUTtBQUN0QixZQUFJO0FBQ0EsZ0JBQU0sUUFBUSxJQUFJO0FBQ2xCLGdCQUFNLFVBQVUsSUFBSTtBQUNwQixjQUFJLENBQUMsUUFBUztBQUVkLGNBQUksWUFBWSxJQUFJO0FBQ3BCLGNBQUksQ0FBQyxVQUFXO0FBRWhCLGNBQUksT0FBTyxjQUFjLFVBQVU7QUFDL0IsZ0JBQUk7QUFDQSwwQkFBWSxLQUFLLE1BQU0sU0FBUztBQUFBLFlBQ3BDLFNBQVMsS0FBSztBQUNWLHFCQUFPLDBDQUEwQyxPQUFPLFNBQVMsS0FBSyxNQUFNLEdBQUcsRUFBRTtBQUNqRjtBQUFBLFlBQ0o7QUFBQSxVQUNKO0FBRUEsY0FBSSxDQUFDLGFBQWEsT0FBTyxjQUFjLFlBQVksTUFBTSxRQUFRLFNBQVMsRUFBRztBQUU3RSxxQkFBVyxDQUFDLEtBQUssR0FBRyxLQUFLLE9BQU8sUUFBUSxTQUFTLEdBQUc7QUFDaEQsa0JBQU0sTUFBTyxRQUFRLElBQUksT0FBTyxJQUFJLE9BQU8sSUFBSSxjQUFlO0FBQzlELGtCQUFNLGNBQWMsUUFBUSxJQUFJLFNBQVMsSUFBSSxjQUFjLElBQUksVUFBVTtBQUV6RSxrQkFBTSxhQUFXLHdEQUFXLFdBQVgsbUJBQW1CLFNBQW5CLG1CQUEwQixhQUExQixtQkFBb0MsVUFBUztBQUM5RCxrQkFBTSxlQUFhLG9FQUFXLFdBQVgsbUJBQW1CLFNBQW5CLG1CQUEwQixhQUExQixtQkFBb0MsV0FBcEMsbUJBQTZDLGdCQUE3QyxtQkFBMEQsU0FBUTtBQUVyRixvQkFBUSxLQUFLO0FBQUEsY0FDVCxLQUFLLGFBQWE7QUFBQSxjQUNsQixXQUFXO0FBQUEsY0FDWDtBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0osQ0FBQztBQUFBLFVBQ0w7QUFBQSxRQUNKLFNBQVMsVUFBVTtBQUNmLGlCQUFPLHVDQUF1QyxJQUFJLEVBQUUsS0FBSyxRQUFRLEVBQUU7QUFBQSxRQUN2RTtBQUFBLE1BQ0o7QUFFQSxVQUFJLFFBQVEsU0FBUyxHQUFHO0FBQ3BCLGNBQU0sUUFBUSxXQUFXLG1CQUFtQixPQUFPO0FBQ25ELGVBQU8sWUFBWSxRQUFRLE1BQU0sdUNBQXVDO0FBQUEsTUFDNUUsT0FBTztBQUNILGVBQU8sb0RBQW9EO0FBQUEsTUFDL0Q7QUFBQSxJQUNKLFNBQVMsS0FBSztBQUNWLGFBQU8sOEJBQThCLEdBQUcsRUFBRTtBQUFBLElBQzlDO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBTSxxQkFBcUI7QUFDdkIsVUFBTSxTQUFjLE1BQU0sS0FBSyxNQUFNLDRCQUE0QixDQUFDLENBQUM7QUFFbkUsV0FBTyxRQUFRLE9BQU8sUUFBYTtBQUMvQixZQUFNLFFBQVEsVUFBVSxlQUFlLEVBQUUsS0FBSyxJQUFJLElBQUksR0FBRztBQUFBLFFBQ3JELGFBQWEsT0FBTyxJQUFJLEtBQUs7QUFBQSxNQUNqQyxHQUFHLFFBQVcsS0FBSztBQUFBLElBQ3ZCLENBQUM7QUFBQSxFQUNMO0FBQUEsRUFFQSxNQUFNLDBCQUEwQixXQUFtQjtBQUMvQyxVQUFNLFNBQVMsTUFBTSxRQUFRLFFBQVEsaUJBQWlCLEVBQUUsT0FBTyxVQUFVLENBQUM7QUFDMUUsUUFBSSxDQUFDLE9BQVEsUUFBTztBQUNwQixXQUFPLE9BQU87QUFBQSxFQUNsQjtBQUFBLEVBRUEsTUFBTSxzQkFBc0IsV0FBbUI7QUFDM0MsVUFBTSxTQUFTLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLEtBQUssVUFBVSxDQUFDO0FBQ3pFLFFBQUksQ0FBQyxPQUFRLFFBQU87QUFDcEIsV0FBTyxPQUFPO0FBQUEsRUFDbEI7QUFBQSxFQUVBLE1BQU0sbUJBQW1CQSxTQUFnQjtBQUNyQyxVQUFNLFlBQVksTUFBTSxRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU07QUFDNUUsUUFBSSxDQUFDLFVBQVcsUUFBTztBQUN2QixVQUFNLFFBQVEsTUFBTSxLQUFLLHNCQUFzQixTQUFTO0FBQ3hELFdBQU87QUFBQSxFQUNYO0FBQUEsRUFFQSxNQUFNLDBCQUEwQixhQUFxQjtBQUNqRCxVQUFNLFNBQVMsTUFBTSxRQUFRLFFBQVEsaUJBQWlCLEVBQUUsUUFBUSxZQUFZLENBQUM7QUFDN0UsUUFBSSxDQUFDLE9BQVEsUUFBTztBQUNwQixXQUFPLE9BQU87QUFBQSxFQUNsQjtBQUFBLEVBRUEsTUFBTSx5QkFBeUIsYUFBcUI7QUFDaEQsVUFBTSxZQUFZLE1BQU0sS0FBSywwQkFBMEIsV0FBVztBQUNsRSxXQUFPLE1BQU0sUUFBUSxTQUFTLEVBQUUscUJBQXFCLFNBQVM7QUFBQSxFQUNsRTtBQUFBLEVBRUEsTUFBTSx1QkFBdUJBLFNBQWdCO0FBQ3pDLFVBQU0sWUFBWSxNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQkEsT0FBTTtBQUM1RSxXQUFPLE1BQU0sS0FBSywwQkFBMEIsU0FBUztBQUFBLEVBQ3pEO0FBQUEsRUFFQSxNQUFNLFlBQVksYUFBcUIsbUJBQTJCO0FBQzlELFVBQU0sWUFBWSxNQUFNLEtBQUssMEJBQTBCLFdBQVc7QUFDbEUsVUFBTSxrQkFBa0IsTUFBTSxLQUFLLDBCQUEwQixpQkFBaUI7QUFDOUUsUUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBaUI7QUFDcEMsVUFBTSxRQUFRLFVBQVUseUJBQXlCO0FBQUEsTUFDN0MsS0FBSyxhQUFhO0FBQUEsTUFDbEI7QUFBQSxNQUNBO0FBQUEsSUFDSixDQUFDO0FBQUEsRUFDTDtBQUFBLEVBRUEsTUFBTSxjQUFjLGFBQXFCLG1CQUEyQjtBQUNoRSxVQUFNLFlBQVksTUFBTSxLQUFLLDBCQUEwQixXQUFXO0FBQ2xFLFVBQU0sa0JBQWtCLE1BQU0sS0FBSywwQkFBMEIsaUJBQWlCO0FBQzlFLFFBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWlCO0FBQ3BDLFVBQU0sUUFBUSxVQUFVLHlCQUF5QixFQUFFLFdBQXNCLGdCQUFpQyxDQUFDO0FBQUEsRUFDL0c7QUFBQSxFQUVBLE1BQU0sZ0JBQWdCLGFBQXFCLG1CQUEyQjtBQUNsRSxVQUFNLFlBQVksTUFBTSxLQUFLLDBCQUEwQixXQUFXO0FBQ2xFLFVBQU0sa0JBQWtCLE1BQU0sS0FBSywwQkFBMEIsaUJBQWlCO0FBQzlFLFFBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWlCLFFBQU87QUFDM0MsVUFBTSxVQUFVLE1BQU0sUUFBUSxRQUFRLHlCQUF5QixFQUFFLFdBQXNCLGdCQUFpQyxDQUFDO0FBQ3pILFdBQU8sVUFBVSxPQUFPO0FBQUEsRUFDNUI7QUFBQSxFQUVBLE1BQU0sdUJBQXVCLGFBQXFCLFdBQW1CO0FBQ2pFLFVBQU0sVUFBVSxNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxlQUFlLGFBQWEsU0FBUyxVQUFVLENBQUM7QUFDMUcsUUFBSSxDQUFDLFFBQVMsUUFBTztBQUNyQixXQUFPLEdBQUcsUUFBUSxTQUFTLElBQUksUUFBUSxRQUFRO0FBQUEsRUFDbkQ7QUFBQSxFQUVBLE1BQU0seUJBQXlCLGFBQXFCLFdBQW1CO0FBQ25FLFVBQU0sVUFBVSxNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxlQUFlLGFBQWEsU0FBUyxVQUFVLENBQUM7QUFDMUcsUUFBSSxDQUFDLFFBQVMsUUFBTztBQUNyQixXQUFPLFFBQVE7QUFBQSxFQUNuQjtBQUFBLEVBRUEsTUFBTSx1QkFBdUIsV0FBbUI7QUFDNUMsVUFBTUEsVUFBUyxNQUFNLFFBQVEsU0FBUyxFQUFFLHFCQUFxQixTQUFTO0FBQ3RFLFFBQUksQ0FBQ0EsUUFBUSxRQUFPO0FBQ3BCLFdBQU9BLFFBQU8sV0FBVztBQUFBLEVBQzdCO0FBQUEsRUFFQSxNQUFNLFNBQVMsY0FBc0I7QUFDakMsVUFBTSxZQUFzQjtBQUFBLE1BQ3hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0o7QUFFQSxRQUFJO0FBQ0EsaUJBQVcsYUFBYSxXQUFXO0FBQy9CLGNBQU0sTUFBTSxNQUFNLFFBQVEsY0FBYyxFQUFFLFFBQVEsY0FBYyxTQUFTO0FBQ3pFLFlBQUksSUFBSyxRQUFPO0FBQUEsTUFDcEI7QUFBQSxJQUNKLFNBQVMsR0FBRztBQUNSLGNBQVEsTUFBTSwwQkFBMEIsQ0FBQztBQUFBLElBQzdDO0FBRUEsV0FBTztBQUFBLEVBQ1g7QUFBQSxFQUVBLE1BQU0sYUFBYSxXQUFtQjtBQUNsQyxVQUFNLFdBQVcsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsS0FBSyxVQUFVLENBQUM7QUFDM0UsUUFBSSxDQUFDLFNBQVUsUUFBTztBQUN0QixXQUFPLFNBQVMsZ0JBQWdCO0FBQUEsRUFDcEM7QUFBQSxFQUVBLE1BQU0sTUFBTSxPQUFlLFFBQWE7QUFDcEMsV0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDcEMsWUFBTSxNQUFNLE9BQU8sUUFBUSxDQUFDLFdBQWdCO0FBQ3hDLGdCQUFRLE1BQU07QUFBQSxNQUNsQixDQUFDO0FBQUEsSUFDTCxDQUFDO0FBQUEsRUFDTDtBQUFBLEVBRUEsTUFBTSxjQUFjLFVBQWtCLFlBQXNDO0FBRXhFLFVBQU0sZUFBZTtBQUFBLE1BQ2pCLFNBQVM7QUFBQSxNQUNULGVBQWU7QUFBQSxJQUNuQjtBQUdBLFVBQU0sVUFBVSxNQUFNLFFBQVEsUUFBUSxrQkFBa0IsWUFBWTtBQUdwRSxXQUFPLFlBQVk7QUFBQSxFQUN2QjtBQUFBLEVBRUEsTUFBTSxzQkFBc0IsT0FBZTtBQUN2QyxVQUFNLFNBQVMsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsUUFBUSxNQUFNLENBQUM7QUFDeEUsUUFBSSxDQUFDLE9BQVEsUUFBTztBQUNwQixXQUFPLE9BQU87QUFBQSxFQUNsQjtBQUFBLEVBRUEsTUFBTSxvQkFBb0IsT0FBZTtBQUNyQyxVQUFNLFNBQVMsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsUUFBUSxNQUFNLENBQUM7QUFDeEUsUUFBSSxDQUFDLE9BQVEsUUFBTztBQUNwQixXQUFPLE9BQU87QUFBQSxFQUNsQjtBQUFBLEVBRUEsTUFBTSxpQkFBaUIsT0FBZTtBQUNsQyxVQUFNLFlBQVksTUFBTSxLQUFLLG9CQUFvQixLQUFLO0FBQ3RELFdBQU8sTUFBTSxRQUFRLFNBQVMsRUFBRSxxQkFBcUIsU0FBUztBQUFBLEVBQ2xFO0FBQUEsRUFFQSxNQUFNLG1CQUFtQixPQUFlO0FBQ3BDLFVBQU0sU0FBUyxNQUFNLFFBQVEsUUFBUSxjQUFjLEVBQUUsY0FBYyxNQUFNLENBQUM7QUFDMUUsUUFBSSxDQUFDLE9BQVEsUUFBTztBQUNwQixXQUFPLE9BQU87QUFBQSxFQUNsQjtBQUFBLEVBRUEsTUFBTSxxQkFBcUIsT0FBZTtBQUN0QyxVQUFNLE9BQU8sTUFBTSxRQUFRLFFBQVEsY0FBYyxFQUFFLGNBQWMsTUFBTSxDQUFDO0FBQ3hFLFFBQUksQ0FBQyxLQUFNLFFBQU87QUFDbEIsV0FBTyxLQUFLO0FBQUEsRUFDaEI7QUFBQSxFQUVBLE1BQU0sa0JBQWtCLE9BQWU7QUFDbkMsVUFBTSxNQUFNLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLGtCQUFrQixNQUFNLENBQUM7QUFDL0UsUUFBSSxDQUFDLElBQUssUUFBTztBQUNqQixXQUFPLElBQUk7QUFBQSxFQUNmO0FBQUEsRUFFQSxNQUFNLHVCQUF1QixPQUFlO0FBQ3hDLFVBQU0sTUFBTSxNQUFNLFFBQVEsU0FBUyxrQkFBa0IsRUFBRSxrQkFBa0IsTUFBTSxDQUFDO0FBQ2hGLFFBQUksQ0FBQyxPQUFPLElBQUksV0FBVyxFQUFHLFFBQU8sQ0FBQztBQUN0QyxXQUFPLElBQUksSUFBSSxDQUFDLFlBQWlCLFFBQVEsR0FBRztBQUFBLEVBQ2hEO0FBQUEsRUFFQSxNQUFNLG9CQUFvQixPQUFlO0FBQ3JDLFVBQU0sTUFBTSxNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxvQkFBb0IsTUFBTSxDQUFDO0FBQ2pGLFFBQUksQ0FBQyxJQUFLLFFBQU87QUFDakIsV0FBTyxJQUFJO0FBQUEsRUFDZjtBQUFBLEVBRUEsTUFBTSxlQUFlQSxTQUFrQztBQUNuRCxRQUFJO0FBQ0EsWUFBTSxTQUFTLE1BQU0sUUFBUSxTQUFTLEVBQUUsVUFBVUEsT0FBTTtBQUN4RCxVQUFJLENBQUMsT0FBUSxRQUFPO0FBRXBCLFlBQU0sV0FBVyxPQUFPLFdBQVc7QUFDbkMsYUFBTyxZQUFZLFNBQVMsVUFBVSxTQUFTLFNBQVM7QUFBQSxJQUM1RCxTQUFTLE9BQU87QUFDWixhQUFPO0FBQUEsSUFDWDtBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQU0sUUFBUSxXQUFtQjtBQTFhckM7QUEyYVEsVUFBTSxPQUE0QixDQUFDO0FBQ25DLFVBQU0sWUFBaUQsQ0FBQztBQUd4RCxVQUFNLFlBQW1CLE1BQU0sUUFBUSxTQUFTLG1CQUFtQixFQUFFLFVBQVUsQ0FBQztBQUNoRixRQUFJLENBQUMsYUFBYSxVQUFVLFdBQVcsRUFBRyxRQUFPLEVBQUUsTUFBTSxVQUFVO0FBR25FLFVBQU0sV0FBVyxNQUFNLEtBQUssSUFBSSxJQUFJLFVBQVUsSUFBSSxPQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFHbEUsZUFBVyxLQUFLLFdBQVc7QUFDdkIsV0FBSyxFQUFFLE9BQU8sSUFBSTtBQUFBLFFBQ2QsV0FBVyxFQUFFO0FBQUEsUUFDYixTQUFTLEVBQUU7QUFBQSxRQUNYLFlBQVksRUFBRSxjQUFjO0FBQUEsUUFDNUIsVUFBVSxFQUFFLGNBQVksd0RBQVcsV0FBWCxtQkFBbUIsU0FBbkIsbUJBQTBCLEVBQUUsYUFBNUIsbUJBQXNDLFVBQVMsRUFBRTtBQUFBLFFBQ3pFLFlBQVksRUFBRSxnQkFBYyxvRUFBVyxXQUFYLG1CQUFtQixTQUFuQixtQkFBMEIsRUFBRSxhQUE1QixtQkFBc0MsV0FBdEMsbUJBQStDLEVBQUUsZ0JBQWpELG1CQUE4RCxTQUFRO0FBQUEsTUFDdEc7QUFBQSxJQUNKO0FBR0EsVUFBTSxlQUFlLE1BQU0sUUFBUSxTQUFTLG1CQUFtQixFQUFFLFNBQVMsRUFBRSxLQUFLLFNBQVMsRUFBRSxDQUFDO0FBQzdGLGVBQVcsU0FBUyxjQUFjO0FBQzlCLGdCQUFVLE1BQU0sT0FBTyxJQUFJLFVBQVUsTUFBTSxPQUFPLEtBQUssQ0FBQztBQUN4RCxnQkFBVSxNQUFNLE9BQU8sRUFBRSxNQUFNLFNBQVMsSUFBSTtBQUFBLFFBQ3hDLEtBQUssTUFBTTtBQUFBLFFBQ1gsT0FBTyxNQUFNLGNBQWM7QUFBQSxRQUMzQixZQUFZLE1BQU0sY0FBYztBQUFBLFFBQ2hDLFVBQVUsTUFBTSxZQUFZO0FBQUEsTUFDaEM7QUFBQSxJQUNKO0FBRUEsV0FBTyxFQUFFLE1BQU0sVUFBVTtBQUFBLEVBQzdCO0FBQ0o7QUEzY1c7QUFBWCxJQUFNLE9BQU47QUE2Y08sSUFBTSxRQUFRLElBQUksS0FBSzs7O0FDM2M5QixJQUFNLFFBQU4sTUFBTSxNQUFLO0FBQUEsRUFDUCxNQUFNLGdCQUFnQixPQUFlLFVBQWtCO0FBQ25ELFFBQUksQ0FBQyxTQUFTLENBQUMsU0FBVSxRQUFPO0FBQ2hDLFVBQU0sV0FBVyxNQUFNLFFBQVEsUUFBUSxjQUFjLEVBQUUsY0FBYyxPQUFPLG9CQUFvQixTQUFTLENBQUM7QUFDMUcsUUFBSSxDQUFDLFlBQVksU0FBUyxTQUFTLFdBQVcsR0FBRztBQUM3QyxlQUFTLFdBQVcsQ0FBQztBQUFBLElBQ3pCLE9BQU87QUFDSCxlQUFTLFdBQVcsU0FBUyxTQUFTLEtBQUssQ0FBQyxHQUFRLE1BQVcsSUFBSSxLQUFLLEVBQUUsSUFBSSxFQUFFLFFBQVEsSUFBSSxJQUFJLEtBQUssRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDO0FBQUEsSUFDMUg7QUFDQSxRQUFJLENBQUMsU0FBVSxRQUFPO0FBQ3RCLFdBQU8sS0FBSyxVQUFVLFNBQVMsUUFBUTtBQUFBLEVBQzNDO0FBQUEsRUFFQSxNQUFNLFNBQVMsT0FBZSxJQUFZLFNBQWlCLFNBQWlCLFFBQWtCQyxTQUFnQjtBQUMxRyxVQUFNLFNBQVM7QUFDZixVQUFNLFNBQVM7QUFFZixVQUFNLGFBQXdCLE1BQU0sUUFBUSxRQUFRLGNBQWMsRUFBRSxLQUFLLE9BQU8sQ0FBQztBQUNqRixVQUFNLGFBQXdCLE1BQU0sUUFBUSxRQUFRLGNBQWMsRUFBRSxLQUFLLE9BQU8sQ0FBQztBQUNqRixRQUFJLENBQUMsY0FBYyxDQUFDLFdBQVksUUFBTztBQUN2QyxVQUFNLGlCQUFtQztBQUFBLE1BQ3JDLEtBQUssYUFBYTtBQUFBLE1BQ2xCLE1BQU07QUFBQSxNQUNOLElBQUk7QUFBQSxNQUNKLFFBQVEsTUFBTSxNQUFNLG1CQUFtQixNQUFNO0FBQUEsTUFDN0MsVUFBVSxNQUFNLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNqRDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxPQUFNLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsTUFDN0IsTUFBTTtBQUFBLE1BQ04sTUFBTSxDQUFDLFNBQVMsTUFBTTtBQUFBLElBQzFCO0FBRUEsVUFBTSxvQkFBc0M7QUFBQSxNQUN4QyxLQUFLLGFBQWE7QUFBQSxNQUNsQixNQUFNO0FBQUEsTUFDTixJQUFJO0FBQUEsTUFDSixRQUFRLE1BQU0sTUFBTSxtQkFBbUIsTUFBTTtBQUFBLE1BQzdDO0FBQUEsTUFDQTtBQUFBLE1BQ0EsVUFBVSxNQUFNLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNqRDtBQUFBLE1BQ0EsT0FBTSxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLE1BQzdCLE1BQU07QUFBQSxNQUNOLE1BQU0sQ0FBQyxPQUFPO0FBQUEsSUFDbEI7QUFDQSxlQUFXLFNBQVMsS0FBSyxjQUFjO0FBQ3ZDLGVBQVcsU0FBUyxLQUFLLGlCQUFpQjtBQUMxQyxVQUFNLFFBQVEsVUFBVSxjQUFjLEVBQUUsS0FBSyxPQUFPLEdBQUcsVUFBVTtBQUNqRSxVQUFNLFFBQVEsVUFBVSxjQUFjLEVBQUUsS0FBSyxPQUFPLEdBQUcsVUFBVTtBQUVqRSxVQUFNLFlBQVksTUFBTSxNQUFNLGlCQUFpQixNQUFNO0FBQ3JELGVBQVcsU0FBUyxLQUFLLENBQUMsR0FBUSxNQUFXLElBQUksS0FBSyxFQUFFLElBQUksRUFBRSxRQUFRLElBQUksSUFBSSxLQUFLLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQztBQUNwRyxlQUFXLFNBQVMsS0FBSyxDQUFDLEdBQVEsTUFBVyxJQUFJLEtBQUssRUFBRSxJQUFJLEVBQUUsUUFBUSxJQUFJLElBQUksS0FBSyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUM7QUFFcEcsWUFBUSwyQ0FBMkNBLFNBQVEsS0FBSyxVQUFVLFdBQVcsUUFBUSxDQUFDO0FBQzlGLFFBQUksV0FBVztBQUNYLGNBQVEseUJBQXlCLFVBQVUsV0FBVyxRQUFRLEtBQUssVUFBVTtBQUFBLFFBQ3pFLElBQUksYUFBYTtBQUFBLFFBQ2pCLE9BQU87QUFBQSxRQUNQLGFBQWEsNEJBQTRCLE1BQU07QUFBQSxRQUMvQyxLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsTUFDYixDQUFDLENBQUM7QUFDRixjQUFRLDJDQUEyQyxVQUFVLFdBQVcsUUFBUSxLQUFLLFVBQVUsV0FBVyxRQUFRLENBQUM7QUFBQSxJQUN2SDtBQUNBLFdBQU87QUFBQSxFQUNYO0FBQUEsRUFFQSxNQUFNLGVBQWUsU0FBaUIsUUFBZ0IsU0FBaUIsUUFBa0I7QUFDckYsVUFBTSxXQUFXLE1BQU0sUUFBUSxTQUFTLGNBQWMsRUFBRSxjQUFjLEVBQUUsS0FBSyxLQUFLLEVBQUUsQ0FBQztBQUNyRixRQUFJLENBQUMsU0FBVSxRQUFPO0FBQ3RCLGFBQVMsUUFBUSxPQUFPLFNBQW9CO0FBQ3hDLFlBQU0saUJBQW1DO0FBQUEsUUFDckMsS0FBSyxhQUFhO0FBQUEsUUFDbEIsTUFBTTtBQUFBLFFBQ04sSUFBSSxLQUFLO0FBQUEsUUFDVCxRQUFRO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxRQUNBLFFBQVEsVUFBVSxDQUFDO0FBQUEsUUFDbkIsT0FBTSxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLFFBQzdCLE1BQU07QUFBQSxRQUNOLE1BQU0sQ0FBQyxPQUFPO0FBQUEsUUFDZCxVQUFVO0FBQUEsTUFDZDtBQUNBLFdBQUssU0FBUyxLQUFLLGNBQWM7QUFFakMsWUFBTSxRQUFRLFVBQVUsY0FBYyxFQUFFLEtBQUssS0FBSyxJQUFJLEdBQUcsSUFBSTtBQUFBLElBQ2pFLENBQUM7QUFDRCxZQUFRLHlCQUF5QixJQUFJLEtBQUssVUFBVTtBQUFBLE1BQ2hELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWEsd0JBQXdCLE9BQU87QUFBQSxNQUM1QyxLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRixXQUFPO0FBQUEsRUFDWDtBQUFBLEVBRUEsTUFBTSxlQUFlLE1BQWM7QUFDL0IsVUFBTSxhQUFhLEtBQUssTUFBTSxJQUFJO0FBQ2xDLFVBQU0sRUFBRSxXQUFXLE9BQU8sSUFBSTtBQUM5QixVQUFNLFdBQXNCLE1BQU0sUUFBUSxRQUFRLGNBQWMsRUFBRSxLQUFLLE9BQU8sQ0FBQztBQUMvRSxRQUFJLENBQUMsU0FBVSxRQUFPO0FBQ3RCLFVBQU0sVUFBVSxTQUFTLFNBQVMsS0FBSyxDQUFDLE1BQU0sRUFBRSxRQUFRLFNBQVM7QUFDakUsUUFBSSxDQUFDLFFBQVMsUUFBTztBQUNyQixZQUFRLE9BQU87QUFDZixVQUFNLFFBQVEsVUFBVSxjQUFjLEVBQUUsS0FBSyxPQUFPLEdBQUcsUUFBUTtBQUMvRCxXQUFPO0FBQUEsRUFDWDtBQUFBLEVBRUEsTUFBTSxtQkFBbUIsT0FBZSxVQUFrQjtBQUN0RCxVQUFNLFdBQVcsTUFBTSxRQUFRLDRCQUE0QixjQUFjLEVBQUUsY0FBYyxPQUFPLG9CQUFvQixTQUFTLEdBQUcsQ0FBQyxnQkFBZ0Isc0JBQXNCLFVBQVUsVUFBVSxDQUFDO0FBQzVMLFFBQUksQ0FBQyxTQUFVLFFBQU87QUFDdEIsV0FBTyxLQUFLLFVBQVUsUUFBUTtBQUFBLEVBQ2xDO0FBQUEsRUFFQSxNQUFNLHNCQUFzQixPQUFlLFVBQWtCLFVBQWtCLFFBQWdCO0FBQzNGLFVBQU0sV0FBVyxNQUFNLFFBQVEsUUFBUSxjQUFjLEVBQUUsY0FBYyxPQUFPLG9CQUFvQixTQUFTLENBQUM7QUFDMUcsUUFBSSxDQUFDLFNBQVUsUUFBTztBQUN0QixhQUFTLFdBQVc7QUFDcEIsYUFBUyxTQUFTO0FBQ2xCLFVBQU0sUUFBUSxVQUFVLGNBQWMsRUFBRSxjQUFjLE9BQU8sb0JBQW9CLFNBQVMsR0FBRyxRQUFRO0FBQ3JHLFdBQU87QUFBQSxFQUNYO0FBQ0o7QUEvSFc7QUFBWCxJQUFNLE9BQU47QUFpSU8sSUFBTSxZQUFZLElBQUksS0FBSzs7O0FDbElsQyxlQUFlLHNCQUFzQkMsU0FBeUI7QUFDMUQsUUFBTSxZQUFZLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU07QUFDbkYsTUFBSSxDQUFDLFVBQVcsUUFBTztBQUN2QixRQUFNLFNBQVMsTUFBTSxNQUFNLDBCQUEwQixTQUFTO0FBQzlELFNBQU87QUFDWDtBQUxlO0FBTWYsUUFBUSx5QkFBeUIscUJBQXFCO0FBRXRELGVBQWUsaUNBQWlDLFdBQW1CO0FBQy9ELFFBQU0sU0FBUyxNQUFNLE1BQU0sMEJBQTBCLFNBQVM7QUFDOUQsU0FBTztBQUNYO0FBSGU7QUFJZixRQUFRLG9DQUFvQyxnQ0FBZ0M7QUFFNUUsZUFBZSxzQkFBc0IsV0FBbUI7QUFDcEQsUUFBTSxRQUFRLE1BQU0sTUFBTSxzQkFBc0IsU0FBUztBQUN6RCxTQUFPO0FBQ1g7QUFIZTtBQUlmLFFBQVEseUJBQXlCLHFCQUFxQjtBQUV0RCxlQUFlLG1CQUFtQkEsU0FBeUI7QUFDdkQsUUFBTSxZQUFZLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU07QUFDbkYsTUFBSSxDQUFDLFVBQVcsUUFBTztBQUN2QixRQUFNLFFBQVEsTUFBTSxNQUFNLHNCQUFzQixTQUFTO0FBQ3pELFNBQU87QUFDWDtBQUxlO0FBTWYsUUFBUSxzQkFBc0Isa0JBQWtCO0FBRWhELGVBQWUsaUJBQWlCQSxTQUF5QixPQUFlLGFBQXFCLEtBQWEsU0FBa0I7QUFDeEgsVUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsSUFDcEQsSUFBSSxhQUFhO0FBQUEsSUFDakI7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0EsU0FBUyxXQUFXO0FBQUEsRUFDeEIsQ0FBQyxDQUFDO0FBQ047QUFSZTtBQVNmLFFBQVEsb0JBQW9CLGdCQUFnQjtBQUU1QyxlQUFlLFNBQVMsTUFPckI7QUFDQyxRQUFNLE1BQU0sTUFBTSxVQUFVLFNBQVMsS0FBSyxPQUFPLEtBQUssSUFBSSxLQUFLLFNBQVMsS0FBSyxTQUFTLEtBQUssUUFBUSxLQUFLLE1BQU07QUFDOUcsU0FBTztBQUNYO0FBVmU7QUFXZixRQUFRLFlBQVksUUFBUTtBQUU1QixlQUFlLGNBQWMsTUFLMUI7QUFDQyxRQUFNLE1BQU0sTUFBTSxVQUFVLGVBQWUsS0FBSyxTQUFTLEtBQUssUUFBTyxLQUFLLFNBQVMsS0FBSyxNQUFNO0FBQzlGLFNBQU87QUFDWDtBQVJlO0FBU2YsUUFBUSxpQkFBaUIsYUFBYTtBQUV0QyxJQUFNLFVBQVUsOEJBQU8sY0FBc0I7QUFDekMsTUFBSSxDQUFDLFVBQVcsUUFBTyxDQUFDO0FBQ3hCLFFBQU0sTUFBTSxNQUFNLE1BQU0sUUFBUSxTQUFTO0FBQ3pDLFNBQU8sSUFBSSxRQUFRLENBQUM7QUFDeEIsR0FKZ0I7QUFLaEIsUUFBUSxXQUFXLE9BQU87QUFHMUIsSUFBTSxjQUFjLDhCQUFPLGNBQXNCO0FBQzdDLE1BQUksQ0FBQyxVQUFXLFFBQU8sRUFBRSxNQUFNLENBQUMsR0FBRyxXQUFXLENBQUMsRUFBRTtBQUNqRCxTQUFPLE1BQU0sTUFBTSxRQUFRLFNBQVM7QUFDeEMsR0FIb0I7QUFJcEIsUUFBUSxlQUFlLFdBQVc7OztBQy9FbEMsSUFBTSxjQUFjLENBQUM7QUFDZCxJQUFNLFFBQVEsSUFBSSxNQUFNO0FBQUEsRUFDM0IsVUFBVSx1QkFBdUI7QUFBQSxFQUNqQyxNQUFNLFlBQVk7QUFDdEIsR0FBRztBQUFBLEVBQ0MsSUFBSSxRQUFRLEtBQUs7QUFDYixVQUFNLFNBQVMsTUFBTSxPQUFPLEdBQUcsSUFBSTtBQUNuQyxRQUFJLFdBQVc7QUFDWCxhQUFPO0FBQ1gsZ0JBQVksR0FBRyxJQUFJLENBQUM7QUFDcEIsb0JBQWdCLGdCQUFnQixHQUFHLElBQUksQ0FBQyxVQUFVO0FBQzlDLFlBQU0sV0FBVyxPQUFPLEdBQUc7QUFDM0IsWUFBTSxTQUFTLFlBQVksR0FBRztBQUM5QixhQUFPLFFBQVEsQ0FBQyxPQUFPLEdBQUcsT0FBTyxRQUFRLENBQUM7QUFDMUMsYUFBTyxHQUFHLElBQUk7QUFBQSxJQUNsQixDQUFDO0FBQ0QsV0FBTyxHQUFHLElBQUksUUFBUSxPQUFPLE1BQU0sR0FBRyxLQUFLO0FBQzNDLFdBQU8sT0FBTyxHQUFHO0FBQUEsRUFDckI7QUFDSixDQUFDOzs7QUNsQkQsSUFBTSxtQkFBbUIsQ0FBQztBQUMxQixJQUFNLGtCQUFrQixhQUFhLHNCQUFzQixHQUFNO0FBQ2pFLE1BQU0sV0FBVyxNQUFNLFFBQVEsSUFBSSxDQUFDLFFBQVEsU0FBUztBQUNqRCxRQUFNLFVBQVUsaUJBQWlCLEdBQUc7QUFDcEMsU0FBTyxpQkFBaUIsR0FBRztBQUMzQixTQUFPLFdBQVcsUUFBUSxHQUFHLElBQUk7QUFDckMsQ0FBQztBQUNNLFNBQVMsc0JBQXNCLFdBQVcsYUFBYSxNQUFNO0FBQ2hFLE1BQUk7QUFDSixLQUFHO0FBQ0MsVUFBTSxHQUFHLFNBQVMsSUFBSSxLQUFLLE1BQU0sS0FBSyxPQUFPLEtBQUssTUFBUyxFQUFFLENBQUMsSUFBSSxRQUFRO0FBQUEsRUFDOUUsU0FBUyxpQkFBaUIsR0FBRztBQUM3QixVQUFRLFdBQVcsU0FBUyxJQUFJLFVBQVUsTUFBTSxVQUFVLEtBQUssR0FBRyxJQUFJO0FBQ3RFLFNBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3BDLHFCQUFpQixHQUFHLElBQUk7QUFDeEIsZUFBVyxRQUFRLGlCQUFpQixtQkFBbUIsR0FBRyxhQUFhO0FBQUEsRUFDM0UsQ0FBQztBQUNMO0FBVmdCO0FBV1QsU0FBUyxpQkFBaUIsV0FBVyxJQUFJO0FBQzVDLFFBQU0sV0FBVyxTQUFTLElBQUksT0FBTyxVQUFVLFFBQVEsU0FBUztBQUM1RCxVQUFNLE1BQU07QUFDWixRQUFJO0FBQ0osUUFBSTtBQUNBLGlCQUFXLE1BQU0sR0FBRyxLQUFLLEdBQUcsSUFBSTtBQUFBLElBQ3BDLFNBQ08sR0FBRztBQUNOLGNBQVEsTUFBTSxtREFBbUQsU0FBUyxFQUFFO0FBQzVFLGNBQVEsSUFBSSxLQUFLLEVBQUUsS0FBSyxJQUFJO0FBQUEsSUFDaEM7QUFDQSxZQUFRLFdBQVcsUUFBUSxJQUFJLEtBQUssS0FBSyxRQUFRO0FBQUEsRUFDckQsQ0FBQztBQUNMO0FBYmdCOzs7QUNkaEIsaUJBQWlCLHdCQUF3QixPQUFPLFdBQVc7QUFDdkQsUUFBTSxZQUFZLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUNuRixRQUFNLFdBQVcsTUFBTSxRQUFRLFNBQVMsa0JBQWtCLEVBQUUsU0FBUyxVQUFVLENBQUM7QUFDaEYsU0FBTyxLQUFLLFVBQVUsUUFBUTtBQUNsQyxDQUFDO0FBRUQsaUJBQWlCLHdCQUF3QixPQUFPLFFBQVEsU0FBaUI7QUFDckUsUUFBTSxjQUE2QixLQUFLLE1BQU0sSUFBSTtBQUNsRCxNQUFJLFlBQVksS0FBSztBQUNqQixVQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxLQUFLLFlBQVksSUFBSSxHQUFHLEVBQUUsR0FBRyxZQUFZLENBQUM7QUFDdEYsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLFlBQVksWUFBWSxTQUFTLElBQUksWUFBWSxRQUFRLGNBQWMsWUFBWSxhQUFhLGdCQUFnQixZQUFZLGNBQWM7QUFBQSxNQUNuSixpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQUEsRUFDTDtBQUNBLFNBQU87QUFDWCxDQUFDO0FBRUQsaUJBQWlCLHVCQUF1QixPQUFPLFFBQVEsU0FBaUI7QUFDcEUsUUFBTSxZQUFZLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUNuRixRQUFNLGNBQTZCLEtBQUssTUFBTSxJQUFJO0FBQ2xELFFBQU0sUUFBUSxFQUFFLEdBQUcsYUFBYSxTQUFTLFdBQVcsZ0JBQWdCLE1BQU0sTUFBTSwwQkFBMEIsU0FBUyxFQUFFO0FBQ3JILFFBQU0sTUFBTSxNQUFNLFFBQVEsVUFBVSxrQkFBa0IsS0FBSztBQUMzRCxTQUFPLE9BQU87QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsWUFBWSxZQUFZLFNBQVMsSUFBSSxZQUFZLFFBQVEsY0FBYyxZQUFZLGFBQWEsY0FBYyxNQUFNLGNBQWM7QUFBQSxJQUMzSSxpQkFBaUI7QUFBQSxFQUNyQixDQUFDO0FBQ0QsU0FBTyxLQUFLLFVBQVUsS0FBSztBQUMvQixDQUFDO0FBRUQsaUJBQWlCLDBCQUEwQixPQUFPLFFBQVEsUUFBZ0I7QUFDdEUsUUFBTSxVQUFVLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLElBQVMsQ0FBQztBQUNwRSxRQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxJQUFTLENBQUM7QUFDdEQsU0FBTyxPQUFPO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLFlBQVksUUFBUSxTQUFTLE1BQU0sUUFBUSxRQUFRLGNBQWMsUUFBUSxhQUFhLGdCQUFnQixRQUFRLGNBQWM7QUFBQSxJQUNySSxpQkFBaUI7QUFBQSxFQUNyQixDQUFDO0FBQ0QsU0FBTztBQUNYLENBQUM7QUFFRCxpQkFBaUIsdUJBQXVCLE9BQU8sUUFBUSxRQUFnQjtBQUNuRSxRQUFNLFVBQVUsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsSUFBUyxDQUFDO0FBQ3BFLFFBQU0sUUFBUSxFQUFFLEdBQUcsU0FBUyxPQUFPLENBQUMsUUFBUSxNQUFNO0FBQ2xELFFBQU0sUUFBUSxVQUFVLGtCQUFrQixFQUFFLElBQVMsR0FBRyxLQUFLO0FBQzdELFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxZQUFZLFFBQVEsU0FBUyxNQUFNLFFBQVEsUUFBUSxjQUFjLFFBQVEsYUFBYSw0QkFBNEIsTUFBTSxLQUFLLE9BQU8sUUFBUSxjQUFjO0FBQUEsRUFDdkssQ0FBQztBQUNELFNBQU8sS0FBSyxVQUFVLEtBQUs7QUFDL0IsQ0FBQzs7O0FDdkRELGlCQUFpQix1QkFBdUIsT0FBTyxRQUFRLFNBQWlCO0FBQ3BFLFFBQU0sTUFBTSxNQUFNLFFBQVEsU0FBUyx1QkFBdUIsRUFBRSxLQUFLLEtBQUssQ0FBQztBQUN2RSxTQUFPLEtBQUssVUFBVSxHQUFHO0FBQzdCLENBQUM7QUFFRCxpQkFBaUIsOEJBQThCLE9BQU8sUUFBUSxTQUFpQjtBQUMzRSxRQUFNLEVBQUUsT0FBTyxTQUFTLElBQUksS0FBSyxNQUFNLElBQUk7QUFDM0MsUUFBTSxNQUFNLE1BQU0sUUFBUSxVQUFVLHVCQUF1QixFQUFFLEtBQUssT0FBTyxPQUFPLFVBQVUsUUFBUSxHQUFHLENBQUM7QUFDdEcsU0FBTyxPQUFPO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLDhDQUE4QyxLQUFLO0FBQUEsSUFDNUQsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNELFNBQU87QUFDWCxDQUFDO0FBRUQsaUJBQWlCLHdCQUF3QixPQUFPLFFBQVEsU0FBaUI7QUFDckUsUUFBTSxhQUdGLEtBQUssTUFBTSxJQUFJO0FBQ25CLFFBQU0sTUFBTSxNQUFNLFFBQVEsUUFBUSx1QkFBdUIsRUFBRSxLQUFLLFdBQVcsTUFBTSxDQUFDO0FBQ2xGLE1BQUksSUFBSSxhQUFhLFdBQVcsVUFBVTtBQUN0QyxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsd0NBQXdDLFdBQVcsS0FBSztBQUFBLE1BQ2pFLGlCQUFpQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDWCxPQUFPO0FBQ0gsV0FBTztBQUFBLEVBQ1g7QUFDSixDQUFDO0FBRUQsaUJBQWlCLHdCQUF3QixPQUFPLFFBQVEsU0FBaUI7QUExQ3pFO0FBMkNJLFFBQU0sRUFBRSxNQUFNLE1BQU0sSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUN2QyxRQUFNLE9BQTBCLE1BQU0sUUFBUSxTQUFTLDJCQUEyQixDQUFDLENBQUM7QUFDcEYsTUFBSSxLQUFLLEtBQUssQ0FBQyxZQUFZLFFBQVEsU0FBUyxJQUFJLEtBQUssR0FBQyxVQUFLLEtBQUssQ0FBQyxZQUFZLFFBQVEsU0FBUyxJQUFJLE1BQTVDLG1CQUErQyxRQUFRLFNBQVMsU0FBUTtBQUMxSCxlQUFLLEtBQUssQ0FBQyxZQUFZLFFBQVEsU0FBUyxJQUFJLE1BQTVDLG1CQUErQyxRQUFRLEtBQUs7QUFDNUQsVUFBTSxRQUFRLFVBQVUsMkJBQTJCLEVBQUUsS0FBSyxHQUFHLEtBQUssS0FBSyxDQUFDLFlBQVksUUFBUSxTQUFTLElBQUksQ0FBQztBQUMxRyxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsR0FBRyxLQUFLLHNDQUFzQyxJQUFJO0FBQUEsTUFDM0QsaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU8sS0FBSyxVQUFVLEtBQUssT0FBTyxDQUFDLFlBQVksUUFBUSxRQUFRLFNBQVMsS0FBSyxDQUFDLENBQUM7QUFBQSxFQUNuRixXQUFXLENBQUMsS0FBSyxLQUFLLENBQUMsWUFBWSxRQUFRLFNBQVMsSUFBSSxHQUFHO0FBQ3ZELFVBQU0sVUFBVTtBQUFBLE1BQ1osS0FBSyxhQUFhO0FBQUEsTUFDbEI7QUFBQSxNQUNBLFNBQVMsQ0FBQyxLQUFLO0FBQUEsTUFDZixTQUFTO0FBQUEsTUFDVCxZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsTUFDbEMsVUFBVSxDQUFDO0FBQUEsSUFDZjtBQUNBLFVBQU0sUUFBUSxVQUFVLDJCQUEyQixPQUFPO0FBQzFELFNBQUssS0FBSyxPQUFPO0FBQ2pCLFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyxHQUFHLEtBQUssa0NBQWtDLElBQUk7QUFBQSxNQUN2RCxpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQ0QsV0FBTyxLQUFLLFVBQVUsS0FBSyxPQUFPLENBQUMsWUFBWSxRQUFRLFFBQVEsU0FBUyxLQUFLLENBQUMsQ0FBQztBQUFBLEVBQ25GLE9BQU87QUFDSCxXQUFPO0FBQUEsRUFDWDtBQUNKLENBQUM7QUFFRCxpQkFBaUIsc0JBQXNCLE9BQU8sUUFBUSxVQUFrQjtBQUNwRSxRQUFNLE1BQU0sTUFBTSxRQUFRLFFBQVEsdUJBQXVCLEVBQUUsS0FBSyxNQUFNLENBQUM7QUFDdkUsU0FBTyxLQUFLLFVBQVUsR0FBRztBQUM3QixDQUFDO0FBRUQsaUJBQWlCLHVCQUF1QixPQUFPLFFBQVEsVUFBa0I7QUFDckUsUUFBTSxNQUFNLE1BQU0sUUFBUSxTQUFTLDJCQUEyQixFQUFFLFNBQVMsTUFBTSxDQUFDO0FBQ2hGLFNBQU8sS0FBSyxVQUFVLEdBQUc7QUFDN0IsQ0FBQztBQUVELGlCQUFpQix5QkFBeUIsT0FBTyxRQUFRLFNBQWlCO0FBQ3RFLFFBQU0sRUFBRSxLQUFLLE1BQU0sSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUN0QyxRQUFNLE1BQU0sTUFBTSxRQUFRLFFBQVEsMkJBQTJCLEVBQUUsSUFBSSxDQUFDO0FBQ3BFLE1BQUksSUFBSSxZQUFZLE9BQU87QUFDdkIsVUFBTSxRQUFRLFVBQVUsMkJBQTJCLEVBQUUsSUFBSSxDQUFDO0FBQzFELFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyxHQUFHLEtBQUssOEJBQThCLElBQUksSUFBSSxVQUFVLEdBQUc7QUFBQSxNQUNwRSxpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQUEsRUFDTCxPQUFPO0FBQ0gsUUFBSSxVQUFVLElBQUksUUFBUSxPQUFPLENBQUMsV0FBbUIsV0FBVyxLQUFLO0FBQ3JFLFVBQU0sUUFBUSxVQUFVLDJCQUEyQixFQUFFLElBQUksR0FBRyxHQUFHO0FBQy9ELFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyxHQUFHLEtBQUssMkJBQTJCLElBQUksSUFBSSxVQUFVLEdBQUc7QUFBQSxNQUNqRSxpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQUEsRUFDTDtBQUNBLFNBQU87QUFDWCxDQUFDO0FBRUQsaUJBQWlCLG9CQUFvQixPQUFPLFFBQVEsU0FBaUI7QUFDakUsUUFBTSxFQUFFLE9BQU8sT0FBTyxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQ3pDLFFBQU0sTUFBTSxNQUFNLFFBQVEsUUFBUSx1QkFBdUIsRUFBRSxLQUFLLE1BQU0sQ0FBQztBQUN2RSxNQUFJLFNBQVM7QUFDYixRQUFNLFFBQVEsVUFBVSx1QkFBdUIsRUFBRSxLQUFLLE1BQU0sR0FBRyxHQUFHO0FBQ2xFLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxHQUFHLEtBQUs7QUFBQSxJQUNqQixpQkFBaUI7QUFBQSxFQUNyQixDQUFDO0FBQ0QsU0FBTztBQUNYLENBQUM7QUFFRCxpQkFBaUIsc0JBQXNCLE9BQU8sUUFBUSxTQUFpQjtBQUNuRSxRQUFNLEVBQUUsT0FBTyxTQUFTLElBQUksS0FBSyxNQUFNLElBQUk7QUFDM0MsUUFBTSxNQUFNLE1BQU0sUUFBUSxRQUFRLHVCQUF1QixFQUFFLEtBQUssTUFBTSxDQUFDO0FBQ3ZFLE1BQUksV0FBVztBQUNmLFFBQU0sUUFBUSxVQUFVLHVCQUF1QixFQUFFLEtBQUssTUFBTSxHQUFHLEdBQUc7QUFDbEUsU0FBTyxPQUFPO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLEdBQUcsS0FBSztBQUFBLElBQ2pCLGlCQUFpQjtBQUFBLEVBQ3JCLENBQUM7QUFDRCxTQUFPO0FBQ1gsQ0FBQztBQUVELGlCQUFpQix1QkFBdUIsT0FBTyxRQUFRLFVBQWtCO0FBQ3JFLFFBQU0sRUFBRSxTQUFTLEtBQUssSUFBSSxLQUFLLE1BQU0sS0FBSztBQUMxQyxRQUFNLE1BQU0sTUFBTSxRQUFRLFVBQVUsMkJBQTJCLEVBQUUsS0FBSyxRQUFRLEdBQUcsSUFBSTtBQUNyRixTQUFPLE9BQU87QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMscUNBQXFDLEtBQUssSUFBSSxVQUFVLE9BQU8sZUFBZSxLQUFLLE9BQU87QUFBQSxJQUNuRyxpQkFBaUI7QUFBQSxFQUNyQixDQUFDO0FBQ0QsT0FBSyxRQUFRLFFBQVEsT0FBTyxXQUFtQjtBQUMzQyxVQUFNQyxPQUFNLE1BQU0sTUFBTSx1QkFBdUIsTUFBTSxNQUFNLG9CQUFvQixNQUFNLENBQUM7QUFDdEYsUUFBSSxDQUFDQSxLQUFLO0FBQ1YsWUFBUSw4Q0FBOENBLE1BQUssS0FBSyxVQUFVLElBQUksQ0FBQztBQUMvRSxRQUFJQSxTQUFRLFFBQVE7QUFDaEIsY0FBUSx5QkFBeUJBLE1BQUssS0FBSyxVQUFVO0FBQUEsUUFDakQsSUFBSSxhQUFhO0FBQUEsUUFDakIsT0FBTztBQUFBLFFBQ1AsYUFBYSw2QkFBNkIsS0FBSyxJQUFJO0FBQUEsUUFDbkQsS0FBSztBQUFBLFFBQ0wsU0FBUztBQUFBLE1BQ2IsQ0FBQyxDQUFDO0FBQUEsSUFDTjtBQUFBLEVBQ0osQ0FBQztBQUNELFNBQU87QUFDWCxDQUFDOzs7QUNoS0QsaUJBQWlCLGlDQUFpQyxPQUFPQyxTQUFnQixPQUFlLGFBQXFCO0FBQ3pHLFFBQU0sT0FBTyxNQUFNLFVBQVUsZ0JBQWdCLE9BQU8sUUFBUTtBQUM1RCxTQUFPO0FBQ1gsQ0FBQztBQUVELGlCQUFpQiwwQkFBMEIsT0FBT0EsU0FBZ0IsT0FBZSxJQUFZLFNBQWlCLFNBQWlCLFdBQXFCO0FBQ2hKLFFBQU0sTUFBTSxNQUFNLFVBQVUsU0FBUyxPQUFPLElBQUksU0FBUyxTQUFTLFFBQVFBLE9BQU07QUFDaEYsUUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxVQUFVLFNBQVMsdUJBQXVCLEtBQUssT0FBTyxFQUFFLGtCQUFrQixPQUFPLGdCQUFnQixPQUFPO0FBQUEsSUFDakgsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNELFNBQU87QUFDWCxDQUFDO0FBRUQsaUJBQWlCLG1DQUFtQyxPQUFPQSxTQUFnQixTQUFpQjtBQUN4RixRQUFNLE1BQU0sTUFBTSxVQUFVLGVBQWUsSUFBSTtBQUMvQyxTQUFPO0FBQ1gsQ0FBQztBQUVELGlCQUFpQixtQ0FBbUMsT0FBT0EsU0FBZ0IsU0FBaUI7QUFDeEYsUUFBTSxhQUFhLEtBQUssTUFBTSxJQUFJO0FBQ2xDLFFBQU0sRUFBRSxPQUFPLFNBQVMsSUFBSTtBQUM1QixRQUFNLE1BQU0sTUFBTSxVQUFVLG1CQUFtQixPQUFPLFFBQVE7QUFDOUQsU0FBTztBQUNYLENBQUM7QUFFRCxpQkFBaUIsc0NBQXNDLE9BQU9BLFNBQWdCLFNBQWlCO0FBQzNGLFFBQU0sYUFBYSxLQUFLLE1BQU0sSUFBSTtBQUNsQyxRQUFNLEVBQUUsT0FBTyxVQUFVLFVBQVUsT0FBTyxJQUFJO0FBQzlDLFFBQU0sTUFBTSxNQUFNLFVBQVUsc0JBQXNCLE9BQU8sVUFBVSxVQUFVLE1BQU07QUFDbkYsUUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxVQUFVLFNBQVMsOEJBQThCLEtBQUs7QUFBQSxJQUMvRCxpQkFBaUI7QUFBQSxFQUNyQixDQUFDO0FBQ0QsU0FBTztBQUNYLENBQUM7OztBQ3hDRCxpQkFBaUIsNkJBQTZCLE9BQU8sUUFBUSxTQUFpQjtBQUw5RTtBQU1JLFFBQU0sRUFBRSxNQUFNLGFBQWEsU0FBUyxZQUFZLElBQUksS0FBSyxNQUFNLElBQUk7QUFDbkUsUUFBTSxXQUFXLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUNsRixRQUFNLG9CQUFvQixNQUFNLE1BQU0sMEJBQTBCLFFBQVE7QUFDeEUsTUFBSSxlQUFlO0FBRW5CLE1BQUksQ0FBQyxVQUFVO0FBQ1gsV0FBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyxtQkFBbUIsQ0FBQztBQUFBLEVBQ3pFO0FBRUEsTUFBSSxlQUFlLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLFdBQVcsU0FBUyxDQUFDO0FBQ2xGLE1BQUksQ0FBQyxjQUFjO0FBQ2YsbUJBQWU7QUFBQSxNQUNYLEtBQUssYUFBYTtBQUFBLE1BQ2xCLFdBQVc7QUFBQSxNQUNYLGdCQUFnQixDQUFDO0FBQUEsTUFDakIsaUJBQWlCLENBQUM7QUFBQSxNQUNsQixVQUFVLENBQUM7QUFBQSxJQUNmO0FBQ0EsbUJBQWU7QUFBQSxFQUNuQjtBQUVBLE1BQUk7QUFDSixNQUFJLFNBQVMsV0FBVztBQUNwQixtQkFBZSxhQUFhLFNBQVMsS0FBSyxDQUFDLFFBQ3ZDLElBQUksU0FBUyxhQUFhLElBQUksZ0JBQWdCLFdBQVc7QUFDN0QsUUFBSSxDQUFDLGNBQWM7QUFDZixZQUFNLGNBQWMsTUFBTSxNQUFNLHVCQUF1QixhQUFhLFFBQVEsS0FBSyxZQUFZLFdBQVc7QUFDeEcsWUFBTSxTQUFTLE1BQU0sTUFBTSx5QkFBeUIsYUFBYSxRQUFRLEtBQUs7QUFDOUUscUJBQWU7QUFBQSxRQUNYLE1BQU07QUFBQSxRQUNOLE1BQU07QUFBQSxRQUNOO0FBQUE7QUFBQSxRQUNBO0FBQUEsUUFDQSxVQUFVLENBQUM7QUFBQSxNQUNmO0FBQ0EsbUJBQWEsU0FBUyxLQUFLLFlBQVk7QUFBQSxJQUMzQztBQUFBLEVBQ0osV0FBVyxTQUFTLFNBQVM7QUFDekIsbUJBQWUsYUFBYSxTQUFTLEtBQUssQ0FBQyxRQUN2QyxJQUFJLFNBQVMsV0FBVyxJQUFJLFlBQVksT0FBTztBQUNuRCxRQUFJLENBQUMsY0FBYztBQUNmLGFBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsNkJBQTZCLENBQUM7QUFBQSxJQUNuRjtBQUFBLEVBQ0o7QUFFQSxRQUFNLGNBQWMsYUFBYSxTQUFTLGFBQWEsU0FBUyxTQUFTLENBQUM7QUFDMUUsUUFBTSxXQUFXLGNBQWMsWUFBWSxPQUFPLElBQUk7QUFFdEQsUUFBTSxhQUFhO0FBQUEsSUFDZixTQUFTLFlBQVk7QUFBQSxJQUNyQixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsSUFDbEMsVUFBVTtBQUFBLElBQ1YsYUFBYSxZQUFZLGVBQWUsQ0FBQztBQUFBLEVBQzdDO0FBRUEsZUFBYSxTQUFTLEtBQUssVUFBVTtBQUVyQyxNQUFJLENBQUMsY0FBYztBQUNmLFVBQU0sUUFBUSxVQUFVLGtCQUFrQixFQUFFLEtBQUssYUFBYSxJQUFJLEdBQUcsWUFBWTtBQUFBLEVBQ3JGLE9BQU87QUFDSCxVQUFNLFFBQVEsVUFBVSxrQkFBa0IsWUFBWTtBQUFBLEVBQzFEO0FBQ0EsU0FBTyxPQUFPO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLFVBQVUsaUJBQWlCLHNCQUFzQixTQUFTLFlBQVksY0FBYyxXQUFXLE9BQU8sa0JBQWtCLFlBQVksT0FBTztBQUFBLElBQ3BKLGlCQUFpQjtBQUFBLEVBQ3JCLENBQUM7QUFFRCxNQUFJLFNBQVMsV0FBVztBQUNwQixVQUFNLGtCQUFrQixNQUFNLE1BQU0sMEJBQTBCLFdBQVc7QUFDekUsUUFBSSxpQkFBaUI7QUFDakIsWUFBTSxpQkFBaUIsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsV0FBVyxnQkFBZ0IsQ0FBQztBQUM3RixZQUFNLGFBQVksc0RBQWdCLG1CQUFoQixtQkFBZ0MsU0FBUztBQUMzRCxVQUFJLENBQUMsV0FBVztBQUNaLGNBQU0sZ0JBQWdCLGlCQUFpQixtQkFBbUIsYUFBYSxXQUFXLFdBQVc7QUFDN0YsY0FBTSxRQUFRLE1BQU0sTUFBTSx1QkFBdUIsZUFBZTtBQUNoRSxZQUFJLE9BQU87QUFDUCxrQkFBUSx5QkFBeUIsT0FBTyxLQUFLLFVBQVU7QUFBQSxZQUNuRCxJQUFJLGFBQWE7QUFBQSxZQUNqQixPQUFPO0FBQUEsWUFDUCxhQUFhO0FBQUEsWUFDYixLQUFLO0FBQUEsWUFDTCxTQUFTO0FBQUEsVUFDYixDQUFDLENBQUM7QUFDRixrQkFBUSx3Q0FBd0MsT0FBTyxLQUFLLFVBQVUsVUFBVSxDQUFDO0FBQUEsUUFDckY7QUFBQSxNQUNKLE9BQU87QUFDSCxnQkFBUSxJQUFJLFVBQVUsaUJBQWlCLGtCQUFrQixXQUFXLGtDQUFrQztBQUFBLE1BQzFHO0FBQUEsSUFDSixPQUFPO0FBQ0gsY0FBUSxJQUFJLCtCQUErQixXQUFXLGlEQUFpRDtBQUFBLElBQzNHO0FBQUEsRUFDSixXQUFXLFNBQVMsU0FBUztBQUN6QixVQUFNLG9CQUFvQixhQUFhLFNBQVMsS0FBSyxDQUFDLFFBQThCLElBQUksWUFBWSxPQUFPO0FBQzNHLFFBQUksRUFBQyx1REFBbUIsVUFBUztBQUM3QixhQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLDBCQUEwQixDQUFDO0FBQUEsSUFDaEY7QUFDQSxlQUFXLFlBQVksa0JBQWtCLFNBQVM7QUFDOUMsVUFBSSxhQUFhLFVBQVU7QUFDdkIsY0FBTSxpQkFBaUIsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsV0FBVyxTQUFTLENBQUM7QUFDdEYsY0FBTSxvQkFBb0IsTUFBTSxNQUFNLDBCQUEwQixRQUFRO0FBQ3hFLGNBQU0sYUFBWSxzREFBZ0IsbUJBQWhCLG1CQUFnQyxTQUFTO0FBQzNELFlBQUksQ0FBQyxXQUFXO0FBQ1osZ0JBQU0sZ0JBQWdCLFVBQVUsbUJBQW1CLGFBQWEsU0FBUyxRQUFXLE9BQU87QUFBQSxRQUMvRixPQUFPO0FBQ0gsa0JBQVEsSUFBSSxVQUFVLGlCQUFpQiwrQkFBK0IsaUJBQWlCLEdBQUc7QUFBQSxRQUM5RjtBQUNBLGNBQU0sUUFBUSxNQUFNLE1BQU0sdUJBQXVCLFFBQVE7QUFDekQsWUFBSSxPQUFPO0FBQ1Asa0JBQVEseUJBQXlCLE9BQU8sS0FBSyxVQUFVO0FBQUEsWUFDbkQsSUFBSSxhQUFhO0FBQUEsWUFDakIsT0FBTztBQUFBLFlBQ1AsYUFBYTtBQUFBLFlBQ2IsS0FBSztBQUFBLFlBQ0wsU0FBUztBQUFBLFVBQ2IsQ0FBQyxDQUFDO0FBQ0Ysa0JBQVEsd0NBQXdDLE9BQU8sS0FBSyxVQUFVLEVBQUUsR0FBRyxZQUFZLFFBQVEsQ0FBQyxDQUFDO0FBQUEsUUFDckc7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFFQSxTQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsS0FBSyxDQUFDO0FBQzNDLENBQUM7QUFHRCxlQUFlLGdCQUNYLGlCQUNBLG1CQUNBLGFBQ0EsTUFDQSxhQUNBLFNBQ0Y7QUFDRSxNQUFJLGlCQUFpQixNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLGdCQUFnQixDQUFDO0FBQzNGLE1BQUksdUJBQXVCO0FBRTNCLE1BQUksQ0FBQyxnQkFBZ0I7QUFDakIscUJBQWlCO0FBQUEsTUFDYixLQUFLLGFBQWE7QUFBQSxNQUNsQixXQUFXO0FBQUEsTUFDWCxnQkFBZ0IsQ0FBQztBQUFBLE1BQ2pCLGlCQUFpQixDQUFDO0FBQUEsTUFDbEIsVUFBVSxDQUFDO0FBQUEsSUFDZjtBQUNBLDJCQUF1QjtBQUFBLEVBQzNCO0FBRUEsTUFBSTtBQUNKLE1BQUksU0FBUyxXQUFXO0FBQ3BCLHlCQUFxQixlQUFlLFNBQVMsS0FBSyxDQUFDLFFBQy9DLElBQUksU0FBUyxhQUFhLElBQUksZ0JBQWdCLGlCQUFpQjtBQUNuRSxRQUFJLENBQUMsb0JBQW9CO0FBQ3JCLFlBQU0sY0FBYyxNQUFNLE1BQU0sdUJBQXVCLG1CQUFtQixlQUFlO0FBQ3pGLFlBQU0sU0FBUyxNQUFNLE1BQU0seUJBQXlCLG1CQUFtQixlQUFlLEtBQUs7QUFDM0YsMkJBQXFCO0FBQUEsUUFDakIsTUFBTTtBQUFBLFFBQ04sTUFBTSxlQUFlLFlBQVksaUJBQWlCO0FBQUEsUUFDbEQ7QUFBQTtBQUFBLFFBQ0EsYUFBYTtBQUFBLFFBQ2IsVUFBVSxDQUFDO0FBQUEsTUFDZjtBQUNBLHFCQUFlLFNBQVMsS0FBSyxrQkFBa0I7QUFBQSxJQUNuRDtBQUFBLEVBQ0osV0FBVyxTQUFTLFNBQVM7QUFDekIseUJBQXFCLGVBQWUsU0FBUyxLQUFLLENBQUMsUUFDL0MsSUFBSSxTQUFTLFdBQVcsSUFBSSxZQUFZLE9BQU87QUFDbkQsUUFBSSxDQUFDLG9CQUFvQjtBQUNyQixZQUFNLGlCQUFpQixNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLE1BQU0sTUFBTSwwQkFBMEIsaUJBQWlCLEVBQUUsQ0FBQztBQUN0SSxZQUFNLFFBQVEsaURBQWdCLFNBQVMsS0FBSyxDQUFDLFFBQThCLElBQUksWUFBWTtBQUMzRixVQUFJLENBQUMsTUFBTztBQUNaLDJCQUFxQjtBQUFBLFFBQ2pCLE1BQU07QUFBQSxRQUNOLE1BQU0sTUFBTTtBQUFBLFFBQ1osUUFBUSxNQUFNLFVBQVU7QUFBQTtBQUFBLFFBQ3hCO0FBQUEsUUFDQSxTQUFTLE1BQU07QUFBQSxRQUNmLG9CQUFvQixNQUFNO0FBQUEsUUFDMUIsV0FBVyxNQUFNO0FBQUE7QUFBQSxRQUNqQixVQUFVLENBQUM7QUFBQSxNQUNmO0FBQ0EscUJBQWUsU0FBUyxLQUFLLGtCQUFrQjtBQUFBLElBQ25EO0FBQUEsRUFDSjtBQUVBLFFBQU0sb0JBQW9CLG1CQUFtQixTQUFTLG1CQUFtQixTQUFTLFNBQVMsQ0FBQztBQUM1RixRQUFNLGlCQUFpQixvQkFBb0Isa0JBQWtCLE9BQU8sSUFBSTtBQUV4RSxRQUFNLG1CQUFtQjtBQUFBLElBQ3JCLFNBQVMsWUFBWTtBQUFBLElBQ3JCLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxJQUNsQyxVQUFVO0FBQUEsSUFDVixhQUFhLFlBQVksZUFBZSxDQUFDO0FBQUEsRUFDN0M7QUFFQSxxQkFBbUIsU0FBUyxLQUFLLGdCQUFnQjtBQUVqRCxNQUFJLENBQUMsc0JBQXNCO0FBQ3ZCLFVBQU0sUUFBUSxVQUFVLGtCQUFrQixFQUFFLEtBQUssZUFBZSxJQUFJLEdBQUcsY0FBYztBQUFBLEVBQ3pGLE9BQU87QUFDSCxVQUFNLFFBQVEsVUFBVSxrQkFBa0IsY0FBYztBQUFBLEVBQzVEO0FBQ0o7QUE5RWU7QUFnRmYsaUJBQWlCLDZCQUE2QixPQUFPLFFBQVEsU0FBaUI7QUFDMUUsUUFBTSxFQUFFLFdBQVcsb0JBQW9CLE9BQU8sSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUNqRSxRQUFNLFdBQVcsTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNO0FBQ2xGLFFBQU0sb0JBQW9CLE1BQU0sTUFBTSwwQkFBMEIsUUFBUTtBQUV4RSxNQUFJLENBQUMsVUFBVTtBQUNYLFdBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsbUJBQW1CLENBQUM7QUFBQSxFQUN6RTtBQUVBLFFBQU0sWUFBWSxDQUFDLFFBQVE7QUFDM0IsUUFBTSxlQUFlLENBQUMsaUJBQWlCO0FBQ3ZDLGFBQVcsU0FBUyxvQkFBb0I7QUFDcEMsVUFBTSxZQUFZLE1BQU0sTUFBTSwwQkFBMEIsS0FBSztBQUM3RCxRQUFJLGFBQWEsQ0FBQyxVQUFVLFNBQVMsU0FBUyxHQUFHO0FBQzdDLGdCQUFVLEtBQUssU0FBUztBQUN4QixtQkFBYSxLQUFLLEtBQUs7QUFBQSxJQUMzQjtBQUFBLEVBQ0o7QUFFQSxRQUFNLFVBQVUsYUFBYTtBQUM3QixRQUFNLG9CQUFvQjtBQUFBLElBQ3RCLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFFBQVEsVUFBVTtBQUFBLElBQ2xCO0FBQUEsSUFDQSxTQUFTO0FBQUEsSUFDVCxvQkFBb0I7QUFBQSxJQUNwQixXQUFXO0FBQUE7QUFBQSxJQUNYLFVBQVUsQ0FBQztBQUFBLEVBQ2Y7QUFFQSxNQUFJLGVBQWUsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsV0FBVyxTQUFTLENBQUM7QUFDbEYsVUFBUSx5QkFBeUIsUUFBUSxLQUFLLFVBQVU7QUFBQSxJQUNwRCxJQUFJLGFBQWE7QUFBQSxJQUNqQixPQUFPO0FBQUEsSUFDUCxhQUFhO0FBQUEsSUFDYixLQUFLO0FBQUEsSUFDTCxTQUFTO0FBQUEsRUFDYixDQUFDLENBQUM7QUFDRixNQUFJLENBQUMsY0FBYztBQUNmLG1CQUFlO0FBQUEsTUFDWCxLQUFLLGFBQWE7QUFBQSxNQUNsQixXQUFXO0FBQUEsTUFDWCxnQkFBZ0IsQ0FBQztBQUFBLE1BQ2pCLGlCQUFpQixDQUFDO0FBQUEsTUFDbEIsVUFBVSxDQUFDLGlCQUFpQjtBQUFBLElBQ2hDO0FBQ0EsVUFBTSxRQUFRLFVBQVUsa0JBQWtCLFlBQVk7QUFBQSxFQUMxRCxPQUFPO0FBQ0gsaUJBQWEsU0FBUyxLQUFLLGlCQUFpQjtBQUM1QyxVQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxLQUFLLGFBQWEsSUFBSSxHQUFHLFlBQVk7QUFBQSxFQUNyRjtBQUVBLGFBQVcsWUFBWSxXQUFXO0FBQzlCLFFBQUksYUFBYSxVQUFVO0FBQ3ZCLFVBQUksaUJBQWlCLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLFdBQVcsU0FBUyxDQUFDO0FBQ3BGLFlBQU0sUUFBUSxNQUFNLE1BQU0sdUJBQXVCLFFBQVE7QUFDekQsVUFBSSxPQUFPO0FBQ1AsZ0JBQVEseUJBQXlCLE9BQU8sS0FBSyxVQUFVO0FBQUEsVUFDbkQsSUFBSSxhQUFhO0FBQUEsVUFDakIsT0FBTztBQUFBLFVBQ1AsYUFBYTtBQUFBLFVBQ2IsS0FBSztBQUFBLFVBQ0wsU0FBUztBQUFBLFFBQ2IsQ0FBQyxDQUFDO0FBQUEsTUFDTjtBQUNBLFVBQUksQ0FBQyxnQkFBZ0I7QUFDakIseUJBQWlCO0FBQUEsVUFDYixLQUFLLGFBQWE7QUFBQSxVQUNsQixXQUFXO0FBQUEsVUFDWCxnQkFBZ0IsQ0FBQztBQUFBLFVBQ2pCLGlCQUFpQixDQUFDO0FBQUEsVUFDbEIsVUFBVSxDQUFDLEVBQUUsR0FBRyxrQkFBa0IsQ0FBQztBQUFBLFFBQ3ZDO0FBQ0EsY0FBTSxRQUFRLFVBQVUsa0JBQWtCLGNBQWM7QUFBQSxNQUM1RCxPQUFPO0FBQ0gsdUJBQWUsU0FBUyxLQUFLLEVBQUUsR0FBRyxrQkFBa0IsQ0FBQztBQUNyRCxjQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxLQUFLLGVBQWUsSUFBSSxHQUFHLGNBQWM7QUFBQSxNQUN6RjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQ0EsU0FBTyxPQUFPO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLFVBQVUsU0FBUyxnQkFBZ0IsaUJBQWlCLGVBQWUsT0FBTyxrQkFBa0IsbUJBQW1CLEtBQUssSUFBSSxDQUFDO0FBQUEsSUFDbEksaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNELFNBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxNQUFNLFFBQVEsQ0FBQztBQUNwRCxDQUFDO0FBRUQsaUJBQWlCLDZCQUE2QixPQUFPLFFBQVEsU0FBaUI7QUFqVDlFO0FBa1RJLFFBQU0sRUFBRSxZQUFZLElBQUksS0FBSyxNQUFNLElBQUk7QUFDdkMsUUFBTSxXQUFXLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUNsRixRQUFNLG9CQUFvQixNQUFNLE1BQU0sMEJBQTBCLFFBQVE7QUFFeEUsTUFBSSxDQUFDLFVBQVU7QUFDWCxXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLG1CQUFtQixDQUFDO0FBQUEsRUFDekU7QUFFQSxNQUFJLGVBQWUsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsV0FBVyxTQUFTLENBQUM7QUFDbEYsTUFBSSxDQUFDLGNBQWM7QUFDZixtQkFBZTtBQUFBLE1BQ1gsS0FBSyxhQUFhO0FBQUEsTUFDbEIsV0FBVztBQUFBLE1BQ1gsZ0JBQWdCLENBQUM7QUFBQSxNQUNqQixpQkFBaUIsQ0FBQztBQUFBLE1BQ2xCLFVBQVUsQ0FBQztBQUFBLElBQ2Y7QUFBQSxFQUNKO0FBRUEsTUFBSSxDQUFDLGFBQWEsZ0JBQWdCO0FBQzlCLGlCQUFhLGlCQUFpQixDQUFDO0FBQUEsRUFDbkM7QUFFQSxRQUFNLFlBQVksYUFBYSxlQUFlLFNBQVMsV0FBVztBQUNsRSxNQUFJLFdBQVc7QUFDWCxVQUFNLFFBQVEsYUFBYSxlQUFlLFFBQVEsV0FBVztBQUM3RCxpQkFBYSxlQUFlLE9BQU8sT0FBTyxDQUFDO0FBQzNDLFlBQVEseUJBQXlCLFFBQVEsS0FBSyxVQUFVO0FBQUEsTUFDcEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQ0YsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLEdBQUcsaUJBQWlCLGNBQWMsV0FBVztBQUFBLE1BQ3RELGlCQUFpQjtBQUFBLElBQ3JCLENBQUM7QUFBQSxFQUNMLE9BQU87QUFDSCxpQkFBYSxlQUFlLEtBQUssV0FBVztBQUM1QyxZQUFRLHlCQUF5QixRQUFRLEtBQUssVUFBVTtBQUFBLE1BQ3BELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUNGLFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyxHQUFHLGlCQUFpQixZQUFZLFdBQVc7QUFBQSxNQUNwRCxpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQUEsRUFDTDtBQUVBLE1BQUksYUFBYSxTQUFTLFdBQVcsS0FBSyxhQUFhLGVBQWUsV0FBVyxLQUFLLEdBQUMsa0JBQWEsb0JBQWIsbUJBQThCLFNBQVE7QUFDekgsVUFBTSxRQUFRLFVBQVUsa0JBQWtCLEVBQUUsS0FBSyxhQUFhLElBQUksQ0FBQztBQUFBLEVBQ3ZFLE9BQU87QUFDSCxVQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxLQUFLLGFBQWEsSUFBSSxHQUFHLFlBQVk7QUFBQSxFQUNyRjtBQUVBLFNBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxLQUFLLENBQUM7QUFDM0MsQ0FBQztBQUVELGlCQUFpQiwyQkFBMkIsT0FBTyxRQUFRLFNBQWlCO0FBQ3hFLE1BQUk7QUFDQSxVQUFNLEVBQUUsU0FBUyxZQUFZLElBQUksS0FBSyxNQUFNLElBQUk7QUFDaEQsVUFBTSxXQUFXLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUNsRixVQUFNLG9CQUFvQixNQUFNLE1BQU0sMEJBQTBCLFFBQVE7QUFDeEUsUUFBSSxDQUFDLFVBQVU7QUFDWCxhQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLG1CQUFtQixDQUFDO0FBQUEsSUFDekU7QUFHQSxVQUFNLGNBQWMsTUFBTSxNQUFNLDBCQUEwQixXQUFXO0FBQ3JFLFFBQUksQ0FBQyxhQUFhO0FBQ2QsYUFBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyxtQkFBbUIsQ0FBQztBQUFBLElBQ3pFO0FBR0EsUUFBSSxlQUFlLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLFdBQVcsU0FBUyxDQUFDO0FBQ2xGLFFBQUksQ0FBQyxjQUFjO0FBQ2YsYUFBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyxnQ0FBZ0MsQ0FBQztBQUFBLElBQ3RGO0FBRUEsVUFBTSxRQUFRLGFBQWEsU0FBUyxLQUFLLENBQUMsUUFBc0UsSUFBSSxZQUFZLE9BQU87QUFDdkksUUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLFNBQVM7QUFDMUIsYUFBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyxrQ0FBa0MsQ0FBQztBQUFBLElBQ3hGO0FBR0EsUUFBSSxNQUFNLFFBQVEsU0FBUyxXQUFXLEdBQUc7QUFDckMsYUFBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUywwQkFBMEIsQ0FBQztBQUFBLElBQ2hGO0FBR0EsVUFBTSxRQUFRLEtBQUssV0FBVztBQUM5QixVQUFNLG1CQUFtQixLQUFLLFdBQVc7QUFHekMsZUFBVyxZQUFZLE1BQU0sU0FBUztBQUNsQyxVQUFJLGlCQUFpQixNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUVwRixVQUFJLENBQUMsZ0JBQWdCO0FBRWpCLHlCQUFpQjtBQUFBLFVBQ2IsS0FBSyxhQUFhO0FBQUEsVUFDbEIsV0FBVztBQUFBLFVBQ1gsZ0JBQWdCLENBQUM7QUFBQSxVQUNqQixpQkFBaUIsQ0FBQztBQUFBLFVBQ2xCLFVBQVUsQ0FBQztBQUFBLFFBQ2Y7QUFBQSxNQUNKO0FBRUEsWUFBTSxjQUFjLGVBQWUsU0FBUyxLQUFLLENBQUMsUUFBOEIsSUFBSSxZQUFZLE9BQU87QUFDdkcsVUFBSSxhQUFhO0FBRWIsb0JBQVksVUFBVSxNQUFNO0FBQzVCLG9CQUFZLHFCQUFxQixNQUFNO0FBQ3ZDLG9CQUFZLFNBQVMsTUFBTTtBQUMzQixvQkFBWSxZQUFZLE1BQU07QUFBQSxNQUNsQyxPQUFPO0FBRUgsdUJBQWUsU0FBUyxLQUFLLEVBQUUsR0FBRyxNQUFNLENBQUM7QUFBQSxNQUM3QztBQUdBLFVBQUksZUFBZSxLQUFLO0FBQ3BCLGNBQU0sUUFBUSxVQUFVLGtCQUFrQixFQUFFLEtBQUssZUFBZSxJQUFJLEdBQUcsY0FBYyxFQUNoRixLQUFLLE1BQU0sUUFBUSxJQUFJLGlDQUFpQyxRQUFRLEVBQUUsQ0FBQyxFQUNuRSxNQUFNLENBQUMsVUFBZSxRQUFRLE1BQU0sMENBQTBDLFFBQVEsS0FBSyxLQUFLLENBQUM7QUFBQSxNQUMxRyxPQUFPO0FBQ0gsY0FBTSxRQUFRLFVBQVUsa0JBQWtCLGNBQWMsRUFDbkQsS0FBSyxNQUFNLFFBQVEsSUFBSSxtQ0FBbUMsUUFBUSxFQUFFLENBQUMsRUFDckUsTUFBTSxDQUFDLFVBQWUsUUFBUSxNQUFNLDRDQUE0QyxRQUFRLEtBQUssS0FBSyxDQUFDO0FBQUEsTUFDNUc7QUFBQSxJQUNKO0FBQ0EsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLEdBQUcsaUJBQWlCLFVBQVUsV0FBVyxhQUFhLE9BQU87QUFBQSxNQUN0RSxpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQ0QsV0FBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLEtBQUssQ0FBQztBQUFBLEVBQzNDLFNBQVMsT0FBTztBQUNaLFlBQVEsTUFBTSxpQ0FBaUMsS0FBSztBQUNwRCxXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLHlEQUF5RCxDQUFDO0FBQUEsRUFDL0c7QUFDSixDQUFDO0FBRUQsaUJBQWlCLDhCQUE4QixPQUFPLFFBQVEsU0FBaUI7QUFDM0UsUUFBTSxFQUFFLFNBQVMsWUFBWSxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQ2hELFFBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFDbEYsUUFBTSxvQkFBb0IsTUFBTSxNQUFNLDBCQUEwQixRQUFRO0FBQ3hFLFFBQU0sbUJBQW1CLE1BQU0sTUFBTSwwQkFBMEIsV0FBVztBQUMxRSxNQUFJLENBQUMsa0JBQWtCO0FBQ25CLFdBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsbUJBQW1CLENBQUM7QUFBQSxFQUN6RTtBQUVBLE1BQUksZUFBZSxNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUNsRixRQUFNLFFBQVEsNkNBQWMsU0FBUyxLQUFLLENBQUMsUUFBOEIsSUFBSSxZQUFZO0FBQ3pGLE1BQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxTQUFTO0FBQzFCLFdBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsa0NBQWtDLENBQUM7QUFBQSxFQUN4RjtBQUVBLFFBQU0sY0FBYyxNQUFNLFFBQVEsUUFBUSxnQkFBZ0I7QUFDMUQsTUFBSSxnQkFBZ0IsSUFBSTtBQUNwQixXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLHNCQUFzQixDQUFDO0FBQUEsRUFDNUU7QUFFQSxRQUFNLFFBQVEsT0FBTyxhQUFhLENBQUM7QUFDbkMsUUFBTSxtQkFBbUIsT0FBTyxhQUFhLENBQUM7QUFFOUMsYUFBVyxZQUFZLE1BQU0sU0FBUztBQUNsQyxVQUFNLGlCQUFpQixNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUN0RixVQUFNLGNBQWMsaURBQWdCLFNBQVMsS0FBSyxDQUFDLFFBQThCLElBQUksWUFBWTtBQUNqRyxRQUFJLGFBQWE7QUFDYixrQkFBWSxVQUFVLE1BQU07QUFDNUIsa0JBQVkscUJBQXFCLE1BQU07QUFDdkMsa0JBQVksU0FBUyxNQUFNO0FBQzNCLGtCQUFZLFlBQVksTUFBTTtBQUM5QixZQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxLQUFLLGVBQWUsSUFBSSxHQUFHLGNBQWM7QUFBQSxJQUN6RjtBQUFBLEVBQ0o7QUFFQSxRQUFNLHdCQUF3QixNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLGlCQUFpQixDQUFDO0FBQ3JHLE1BQUksdUJBQXVCO0FBQ3ZCLFVBQU0sYUFBYSxzQkFBc0IsU0FBUyxVQUFVLENBQUMsUUFBOEIsSUFBSSxZQUFZLE9BQU87QUFDbEgsUUFBSSxlQUFlLElBQUk7QUFDbkIsNEJBQXNCLFNBQVMsT0FBTyxZQUFZLENBQUM7QUFDbkQsWUFBTSxRQUFRLFVBQVUsa0JBQWtCLEVBQUUsS0FBSyxzQkFBc0IsSUFBSSxHQUFHLHFCQUFxQjtBQUFBLElBQ3ZHO0FBQUEsRUFDSjtBQUNBLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxHQUFHLGlCQUFpQixZQUFZLFdBQVcsZUFBZSxPQUFPO0FBQUEsSUFDMUUsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNELFNBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxLQUFLLENBQUM7QUFDM0MsQ0FBQztBQUVELGlCQUFpQiw2QkFBNkIsT0FBTyxRQUFRLFlBQW9CO0FBQzdFLFFBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFDbEYsUUFBTSxvQkFBb0IsTUFBTSxNQUFNLDBCQUEwQixRQUFRO0FBQ3hFLE1BQUksZUFBZSxNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUNsRixRQUFNLFFBQVEsNkNBQWMsU0FBUyxLQUFLLENBQUMsUUFBOEIsSUFBSSxZQUFZO0FBQ3pGLE1BQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxTQUFTO0FBQzFCLFdBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsa0NBQWtDLENBQUM7QUFBQSxFQUN4RjtBQUdBLE1BQUksTUFBTSxjQUFjLFVBQVU7QUFDOUIsV0FBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyw4Q0FBOEMsQ0FBQztBQUFBLEVBQ3BHO0FBRUEsYUFBVyxZQUFZLE1BQU0sU0FBUztBQUNsQyxVQUFNLGlCQUFpQixNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUN0RixVQUFNLFFBQVEsTUFBTSxNQUFNLHVCQUF1QixRQUFRO0FBQ3pELFFBQUksT0FBTztBQUNQLGNBQVEseUJBQXlCLE9BQU8sS0FBSyxVQUFVO0FBQUEsUUFDbkQsSUFBSSxhQUFhO0FBQUEsUUFDakIsT0FBTztBQUFBLFFBQ1AsYUFBYTtBQUFBLFFBQ2IsS0FBSztBQUFBLFFBQ0wsU0FBUztBQUFBLE1BQ2IsQ0FBQyxDQUFDO0FBQUEsSUFDTjtBQUNBLFFBQUksZ0JBQWdCO0FBQ2hCLFlBQU0sYUFBYSxlQUFlLFNBQVMsVUFBVSxDQUFDLFFBQThCLElBQUksWUFBWSxPQUFPO0FBQzNHLFVBQUksZUFBZSxJQUFJO0FBQ25CLHVCQUFlLFNBQVMsT0FBTyxZQUFZLENBQUM7QUFDNUMsY0FBTSxRQUFRLFVBQVUsa0JBQWtCLEVBQUUsS0FBSyxlQUFlLElBQUksR0FBRyxjQUFjO0FBQUEsTUFDekY7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNBLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxTQUFTLE9BQU8sZUFBZSxpQkFBaUI7QUFBQSxJQUN6RCxpQkFBaUI7QUFBQSxFQUNyQixDQUFDO0FBQ0QsU0FBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLEtBQUssQ0FBQztBQUMzQyxDQUFDO0FBRUQsaUJBQWlCLGtDQUFrQyxPQUFPLFFBQVEsU0FBaUI7QUFDL0UsUUFBTSxFQUFFLFNBQVMsT0FBTyxHQUFHLFFBQVEsR0FBRyxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQ3pELFFBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFFbEYsTUFBSSxDQUFDLFVBQVU7QUFDWCxXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxVQUFVLENBQUMsR0FBRyxTQUFTLG1CQUFtQixDQUFDO0FBQUEsRUFDdkY7QUFFQSxRQUFNLGVBQWUsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsV0FBVyxTQUFTLENBQUM7QUFDcEYsTUFBSSxDQUFDLGNBQWM7QUFDZixXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxVQUFVLENBQUMsR0FBRyxTQUFTLG9CQUFvQixDQUFDO0FBQUEsRUFDeEY7QUFFQSxRQUFNLGVBQWUsYUFBYSxTQUFTLEtBQUssQ0FBQyxRQUM3QyxJQUFJLFNBQVMsV0FBVyxJQUFJLFlBQVksT0FBTztBQUVuRCxNQUFJLENBQUMsY0FBYztBQUNmLFdBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFVBQVUsQ0FBQyxHQUFHLFNBQVMseUJBQXlCLENBQUM7QUFBQSxFQUM3RjtBQUdBLFFBQU0saUJBQWlCLGFBQWEsU0FBUztBQUFBLElBQUssQ0FBQyxHQUFRLE1BQ3ZELElBQUksS0FBSyxFQUFFLFNBQVMsRUFBRSxRQUFRLElBQUksSUFBSSxLQUFLLEVBQUUsU0FBUyxFQUFFLFFBQVE7QUFBQSxFQUNwRTtBQUVBLFFBQU0sY0FBYyxPQUFPLEtBQUs7QUFDaEMsUUFBTSxXQUFXLGFBQWE7QUFDOUIsUUFBTSxvQkFBb0IsZUFBZSxNQUFNLFlBQVksUUFBUTtBQUVuRSxRQUFNLFVBQVUsV0FBVyxlQUFlO0FBRTFDLFNBQU8sS0FBSyxVQUFVO0FBQUEsSUFDbEIsU0FBUztBQUFBLElBQ1QsVUFBVTtBQUFBLElBQ1Ysb0JBQW9CLGFBQWEsc0JBQXNCLENBQUM7QUFBQSxJQUN4RCxNQUFNLGFBQWE7QUFBQSxJQUNuQixRQUFRLGFBQWEsVUFBVTtBQUFBLElBQy9CO0FBQUEsSUFDQSxlQUFlLGVBQWU7QUFBQSxJQUM5QixXQUFXLGFBQWE7QUFBQTtBQUFBLEVBQzVCLENBQUM7QUFDTCxDQUFDO0FBRUQsaUJBQWlCLG9DQUFvQyxPQUFPLFFBQVEsU0FBaUI7QUFDakYsUUFBTSxFQUFFLGFBQWEsT0FBTyxHQUFHLFFBQVEsR0FBRyxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQzdELFFBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFFbEYsTUFBSSxDQUFDLFVBQVU7QUFDWCxXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxVQUFVLENBQUMsR0FBRyxTQUFTLG1CQUFtQixDQUFDO0FBQUEsRUFDdkY7QUFFQSxRQUFNLGVBQWUsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsV0FBVyxTQUFTLENBQUM7QUFDcEYsTUFBSSxDQUFDLGNBQWM7QUFDZixXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxVQUFVLENBQUMsR0FBRyxTQUFTLG9CQUFvQixDQUFDO0FBQUEsRUFDeEY7QUFFQSxRQUFNLGVBQWUsYUFBYSxTQUFTLEtBQUssQ0FBQyxRQUM3QyxJQUFJLFNBQVMsYUFBYSxJQUFJLGdCQUFnQixXQUFXO0FBRTdELE1BQUksQ0FBQyxjQUFjO0FBQ2YsV0FBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sVUFBVSxDQUFDLEdBQUcsU0FBUyx5QkFBeUIsQ0FBQztBQUFBLEVBQzdGO0FBR0EsUUFBTSxpQkFBaUIsYUFBYSxTQUFTO0FBQUEsSUFBSyxDQUFDLEdBQVEsTUFDdkQsSUFBSSxLQUFLLEVBQUUsU0FBUyxFQUFFLFFBQVEsSUFBSSxJQUFJLEtBQUssRUFBRSxTQUFTLEVBQUUsUUFBUTtBQUFBLEVBQ3BFO0FBRUEsUUFBTSxjQUFjLE9BQU8sS0FBSztBQUNoQyxRQUFNLFdBQVcsYUFBYTtBQUM5QixRQUFNLG9CQUFvQixlQUFlLE1BQU0sWUFBWSxRQUFRO0FBQ25FLFFBQU0sVUFBVSxXQUFXLGVBQWU7QUFFMUMsU0FBTyxLQUFLLFVBQVU7QUFBQSxJQUNsQixTQUFTO0FBQUEsSUFDVCxVQUFVO0FBQUEsSUFDVixRQUFRLGFBQWEsVUFBVTtBQUFBLElBQy9CLE1BQU0sYUFBYTtBQUFBLElBQ25CO0FBQUEsSUFDQSxlQUFlLGVBQWU7QUFBQSxFQUNsQyxDQUFDO0FBQ0wsQ0FBQztBQUVELGlCQUFpQixtREFBbUQsT0FBTyxXQUFXO0FBQ2xGLE1BQUk7QUFDQSxVQUFNLFdBQVcsTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNO0FBRWxGLFFBQUksQ0FBQyxVQUFVO0FBQ1gsYUFBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyxtQkFBbUIsQ0FBQztBQUFBLElBQ3pFO0FBRUEsVUFBTSxlQUFlLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLFdBQVcsU0FBUyxDQUFDO0FBQ3BGLFFBQUksQ0FBQyxjQUFjO0FBQ2YsYUFBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyxvQkFBb0IsQ0FBQztBQUFBLElBQzFFO0FBRUEsVUFBTSxXQUFXLGFBQWEsU0FBUyxJQUFJLE9BQU8sUUFBd0w7QUFDdE8sVUFBSSxjQUFjLElBQUk7QUFDdEIsVUFBSSw0QkFBNEIsSUFBSSxzQkFBc0IsQ0FBQztBQUczRCxVQUFJLElBQUksU0FBUyxhQUFhLElBQUksYUFBYTtBQUMzQyxjQUFNLGlCQUFpQixNQUFNLE1BQU0sdUJBQXVCLElBQUksYUFBYSxRQUFRLEtBQUssWUFBWSxJQUFJLFdBQVc7QUFDbkgsWUFBSSxtQkFBbUIsSUFBSSxNQUFNO0FBRTdCLGdCQUFNLGVBQWUsYUFBYSxTQUFTLEtBQUssQ0FBQyxNQUFXLEVBQUUsU0FBUyxhQUFhLEVBQUUsZ0JBQWdCLElBQUksV0FBVztBQUNySCxjQUFJLGNBQWM7QUFDZCx5QkFBYSxPQUFPO0FBQ3BCLGtCQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxLQUFLLGFBQWEsSUFBSSxHQUFHLFlBQVksRUFDNUUsS0FBSyxNQUFNLFFBQVEsSUFBSSw0QkFBNEIsSUFBSSxXQUFXLE9BQU8sY0FBYyxFQUFFLENBQUMsRUFDMUYsTUFBTSxDQUFDLFVBQWUsUUFBUSxNQUFNLHFDQUFxQyxJQUFJLFdBQVcsS0FBSyxLQUFLLENBQUM7QUFBQSxVQUM1RztBQUNBLHdCQUFjO0FBQUEsUUFDbEI7QUFBQSxNQUNKLFdBRVMsSUFBSSxTQUFTLFdBQVcsSUFBSSxzQkFBc0IsSUFBSSxtQkFBbUIsU0FBUyxHQUFHO0FBQzFGLGlCQUFTLElBQUksR0FBRyxJQUFJLElBQUksbUJBQW1CLFFBQVEsS0FBSztBQUNwRCxnQkFBTSxRQUFRLElBQUksbUJBQW1CLENBQUM7QUFDdEMsZ0JBQU0saUJBQWlCLE1BQU0sTUFBTSx1QkFBdUIsT0FBTyxRQUFRLEtBQUssWUFBWSxLQUFLO0FBQUEsUUFHbkc7QUFBQSxNQUNKO0FBRUEsYUFBTztBQUFBLFFBQ0gsTUFBTSxJQUFJO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixhQUFhLElBQUk7QUFBQSxRQUNqQixTQUFTLElBQUk7QUFBQSxRQUNiLFNBQVMsSUFBSTtBQUFBLFFBQ2IsUUFBUSxJQUFJO0FBQUEsUUFDWixvQkFBb0I7QUFBQSxRQUNwQixhQUFhLElBQUksU0FBUyxJQUFJLFNBQVMsU0FBUyxDQUFDO0FBQUEsUUFDakQsV0FBVyxJQUFJO0FBQUE7QUFBQSxNQUNuQjtBQUFBLElBQ0osQ0FBQztBQUdELFVBQU0sbUJBQW1CLE1BQU0sUUFBUSxJQUFJLFFBQVE7QUFFbkQsV0FBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE1BQU0sVUFBVSxpQkFBaUIsQ0FBQztBQUFBLEVBQ3ZFLFNBQVMsT0FBTztBQUNaLFlBQVEsTUFBTSxzREFBc0QsS0FBSztBQUN6RSxXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLG9EQUFvRCxDQUFDO0FBQUEsRUFDMUc7QUFDSixDQUFDO0FBQ0QsaUJBQWlCLGlDQUFpQyxPQUFPLFFBQVEsU0FBaUI7QUFDOUUsUUFBTSxXQUFXLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUVsRixNQUFJLENBQUMsVUFBVTtBQUNYLFdBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsbUJBQW1CLENBQUM7QUFBQSxFQUN6RTtBQUVBLE1BQUksZUFBZSxNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUNsRixNQUFJLENBQUMsY0FBYztBQUNmLFdBQU8sS0FBSyxVQUFVO0FBQUEsTUFDbEIsU0FBUztBQUFBLE1BQ1QsT0FBTztBQUFBLFFBQ0gsYUFBYTtBQUFBLFFBQ2IsZUFBZTtBQUFBLFFBQ2YsaUJBQWlCO0FBQUEsUUFDakIsZ0JBQWdCO0FBQUEsUUFDaEIsaUJBQWlCO0FBQUEsTUFDckI7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMO0FBRUEsUUFBTSxjQUFjLG9CQUFJLEtBQUs7QUFDN0IsUUFBTSxnQkFBZ0IsSUFBSSxLQUFLLFlBQVksUUFBUSxJQUFJLEtBQUssS0FBSyxLQUFLLEtBQUssR0FBSTtBQUUvRSxNQUFJLGNBQWM7QUFDbEIsTUFBSSxnQkFBZ0I7QUFDcEIsTUFBSSxrQkFBa0I7QUFDdEIsTUFBSSxpQkFBaUI7QUFDckIsTUFBSSxrQkFBa0I7QUFFdEIsYUFBVyxnQkFBZ0IsYUFBYSxVQUFVO0FBQzlDLGVBQVcsV0FBVyxhQUFhLFVBQVU7QUFDekMscUJBQWU7QUFFZixZQUFNLFVBQVUsYUFBYSxRQUFRLENBQUMsYUFBYSxLQUFLLE1BQU0sNkNBQTZDO0FBQzNHLFVBQUksU0FBUztBQUNULHlCQUFpQjtBQUFBLE1BQ3JCLE9BQU87QUFDSCwyQkFBbUI7QUFBQSxNQUN2QjtBQUVBLFVBQUksQ0FBQyxRQUFRLE1BQU07QUFDZiwwQkFBa0I7QUFBQSxNQUN0QjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBRUEsTUFBSSxhQUFhLGlCQUFpQjtBQUM5QixzQkFBa0IsYUFBYSxnQkFBZ0I7QUFBQSxNQUFPLENBQUMsWUFDbkQsUUFBUSxZQUFZO0FBQUEsSUFDeEIsRUFBRTtBQUFBLEVBQ047QUFFQSxTQUFPLEtBQUssVUFBVTtBQUFBLElBQ2xCLFNBQVM7QUFBQSxJQUNULE9BQU87QUFBQSxNQUNIO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0o7QUFBQSxFQUNKLENBQUM7QUFDTCxDQUFDO0FBRUQsaUJBQWlCLCtCQUErQixPQUFPLFFBQVEsU0FBaUI7QUFDNUUsUUFBTSxFQUFFLGtCQUFrQixhQUFhLFNBQVMsYUFBYSxJQUFJLEtBQUssTUFBTSxRQUFRLElBQUk7QUFDeEYsUUFBTSxXQUFXLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUNsRixRQUFNLG9CQUFvQixNQUFNLE1BQU0sMEJBQTBCLFFBQVE7QUFFeEUsTUFBSSxDQUFDLFVBQVU7QUFDWCxXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLG1CQUFtQixDQUFDO0FBQUEsRUFDekU7QUFFQSxRQUFNLGVBQWUsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsV0FBVyxTQUFTLENBQUM7QUFDcEYsTUFBSSxDQUFDLGNBQWM7QUFDZixXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLHFCQUFxQixDQUFDO0FBQUEsRUFDM0U7QUFFQSxNQUFJO0FBQ0osTUFBSSxxQkFBcUIsYUFBYSxhQUFhO0FBQy9DLG1CQUFlLGFBQWEsU0FBUztBQUFBLE1BQUssQ0FBQyxRQUN2QyxJQUFJLFNBQVMsYUFBYSxPQUFPLElBQUksV0FBVyxNQUFNLE9BQU8sV0FBVztBQUFBLElBQzVFO0FBQUEsRUFDSixXQUFXLHFCQUFxQixXQUFXLFNBQVM7QUFDaEQsbUJBQWUsYUFBYSxTQUFTO0FBQUEsTUFBSyxDQUFDLFFBQ3ZDLElBQUksU0FBUyxXQUFXLE9BQU8sSUFBSSxPQUFPLE1BQU0sT0FBTyxPQUFPO0FBQUEsSUFDbEU7QUFBQSxFQUNKO0FBRUEsTUFBSSxDQUFDLGNBQWM7QUFDZixXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLHlCQUF5QixDQUFDO0FBQUEsRUFDL0U7QUFFQSxlQUFhLFdBQVcsYUFBYSxTQUFTLE9BQU8sQ0FBQyxRQUFhLE9BQU8sSUFBSSxJQUFJLE1BQU0sT0FBTyxZQUFZLENBQUM7QUFHNUcsUUFBTSxRQUFRLFVBQVUsa0JBQWtCLEVBQUUsS0FBSyxhQUFhLElBQUksR0FBRyxZQUFZO0FBR2pGLE1BQUkscUJBQXFCLGFBQWEsYUFBYTtBQUMvQyxVQUFNLGtCQUFrQixNQUFNLE1BQU0sMEJBQTBCLFdBQVc7QUFDekUsUUFBSSxpQkFBaUI7QUFDakIsWUFBTSxlQUFlLE1BQU0sTUFBTSx1QkFBdUIsZUFBZTtBQUN2RSxZQUFNLGlCQUFpQixNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLGdCQUFnQixDQUFDO0FBQzdGLFVBQUksZ0JBQWdCO0FBQ2hCLGNBQU0scUJBQXFCLGVBQWUsU0FBUztBQUFBLFVBQUssQ0FBQyxRQUNyRCxJQUFJLFNBQVMsYUFBYSxPQUFPLElBQUksV0FBVyxNQUFNLE9BQU8saUJBQWlCO0FBQUEsUUFDbEY7QUFDQSxZQUFJLG9CQUFvQjtBQUNwQiw2QkFBbUIsV0FBVyxtQkFBbUIsU0FBUyxPQUFPLENBQUMsUUFBYSxPQUFPLElBQUksSUFBSSxNQUFNLE9BQU8sWUFBWSxDQUFDO0FBQ3hILGdCQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxLQUFLLGVBQWUsSUFBSSxHQUFHLGNBQWM7QUFDckYsY0FBSSxNQUFNLGdCQUFnQixZQUFZLEdBQUc7QUFDckMsb0JBQVEsd0NBQXdDLE9BQU8sWUFBWSxHQUFHLEtBQUssVUFBVSxjQUFjLENBQUM7QUFBQSxVQUN4RztBQUFBLFFBQ0o7QUFBQSxNQUNKO0FBQUEsSUFDSjtBQUFBLEVBQ0o7QUFFQSxVQUFRLHdDQUF3QyxPQUFPLE1BQU0sR0FBRyxLQUFLLFVBQVUsWUFBWSxDQUFDO0FBQzVGLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyx3QkFBd0IsZ0JBQWdCLHNCQUFzQixlQUFlLE9BQU8sT0FBTyxpQkFBaUI7QUFBQSxJQUNySCxpQkFBaUI7QUFBQSxFQUNyQixDQUFDO0FBQ0QsU0FBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLEtBQUssQ0FBQztBQUMzQyxDQUFDO0FBRUQsaUJBQWlCLGlDQUFpQyxPQUFPLFFBQVEsU0FBaUI7QUFDOUUsTUFBSTtBQUNBLFVBQU0sRUFBRSxTQUFTLFFBQVEsSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUM1QyxVQUFNLFdBQVcsTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNO0FBQ2xGLFVBQU0sb0JBQW9CLE1BQU0sTUFBTSwwQkFBMEIsUUFBUTtBQUN4RSxRQUFJLENBQUMsVUFBVTtBQUNYLGFBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsbUJBQW1CLENBQUM7QUFBQSxJQUN6RTtBQUVBLFFBQUksZUFBZSxNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUNsRixRQUFJLENBQUMsY0FBYztBQUNmLGFBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsZ0NBQWdDLENBQUM7QUFBQSxJQUN0RjtBQUVBLFVBQU0sUUFBUSxhQUFhLFNBQVMsS0FBSyxDQUFDLFFBQWtELElBQUksWUFBWSxPQUFPO0FBQ25ILFFBQUksQ0FBQyxPQUFPO0FBQ1IsYUFBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyxrQkFBa0IsQ0FBQztBQUFBLElBQ3hFO0FBRUEsUUFBSSxNQUFNLGNBQWMsVUFBVTtBQUM5QixhQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLG1EQUFtRCxDQUFDO0FBQUEsSUFDekc7QUFDQSxVQUFNLFVBQVUsTUFBTTtBQUN0QixVQUFNLE9BQU87QUFFYixlQUFXLFlBQVksTUFBTSxXQUFXLENBQUMsR0FBRztBQUN4QyxZQUFNLGlCQUFpQixNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxXQUFXLFNBQVMsQ0FBQztBQUN0RixVQUFJLGdCQUFnQjtBQUNoQixjQUFNLGNBQWMsZUFBZSxTQUFTLEtBQUssQ0FBQyxRQUE4QixJQUFJLFlBQVksT0FBTztBQUN2RyxZQUFJLGFBQWE7QUFDYixzQkFBWSxPQUFPO0FBQ25CLGdCQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxLQUFLLGVBQWUsSUFBSSxHQUFHLGNBQWMsRUFDaEYsS0FBSyxNQUFNLFFBQVEsSUFBSSxpQ0FBaUMsUUFBUSxFQUFFLENBQUMsRUFDbkUsTUFBTSxDQUFDLFVBQWUsUUFBUSxNQUFNLDBDQUEwQyxRQUFRLEtBQUssS0FBSyxDQUFDO0FBQUEsUUFDMUcsT0FBTztBQUNILGtCQUFRLEtBQUssNkJBQTZCLFFBQVEsYUFBYTtBQUFBLFFBQ25FO0FBQUEsTUFDSixPQUFPO0FBQ0gsZ0JBQVEsS0FBSyxnQ0FBZ0MsUUFBUSxFQUFFO0FBQUEsTUFDM0Q7QUFBQSxJQUNKO0FBRUEsVUFBTSxRQUFRLFVBQVUsa0JBQWtCLEVBQUUsS0FBSyxhQUFhLElBQUksR0FBRyxZQUFZLEVBQzVFLEtBQUssTUFBTSxRQUFRLElBQUksaUNBQWlDLFFBQVEsRUFBRSxDQUFDLEVBQ25FLE1BQU0sQ0FBQyxVQUFlLFFBQVEsTUFBTSwwQ0FBMEMsUUFBUSxLQUFLLEtBQUssQ0FBQztBQUV0RyxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsU0FBUyxPQUFPLE1BQU0sT0FBTyxvQkFBb0IsT0FBTyxPQUFPLGlCQUFpQjtBQUFBLE1BQ3pGLGlCQUFpQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsS0FBSyxDQUFDO0FBQUEsRUFDM0MsU0FBUyxPQUFPO0FBQ1osWUFBUSxNQUFNLDhCQUE4QixLQUFLO0FBQ2pELFdBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsa0RBQWtELENBQUM7QUFBQSxFQUN4RztBQUNKLENBQUM7QUFFRCxpQkFBaUIsbUNBQW1DLE9BQU8sUUFBUSxTQUFpQjtBQUNoRixNQUFJO0FBQ0EsVUFBTSxFQUFFLFNBQVMsVUFBVSxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQzlDLFVBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFDbEYsVUFBTSxvQkFBb0IsTUFBTSxNQUFNLDBCQUEwQixRQUFRO0FBQ3hFLFFBQUksQ0FBQyxVQUFVO0FBQ1gsYUFBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyxtQkFBbUIsQ0FBQztBQUFBLElBQ3pFO0FBR0EsUUFBSSxlQUFlLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLFdBQVcsU0FBUyxDQUFDO0FBQ2xGLFFBQUksQ0FBQyxjQUFjO0FBQ2YsYUFBTyxLQUFLLFVBQVUsRUFBRSxTQUFTLE9BQU8sU0FBUyxnQ0FBZ0MsQ0FBQztBQUFBLElBQ3RGO0FBRUEsVUFBTSxRQUFRLGFBQWEsU0FBUyxLQUFLLENBQUMsUUFBa0QsSUFBSSxZQUFZLE9BQU87QUFDbkgsUUFBSSxDQUFDLE9BQU87QUFDUixhQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsT0FBTyxTQUFTLGtCQUFrQixDQUFDO0FBQUEsSUFDeEU7QUFHQSxRQUFJLE1BQU0sY0FBYyxVQUFVO0FBQzlCLGFBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMscURBQXFELENBQUM7QUFBQSxJQUMzRztBQUdBLFVBQU0sU0FBUztBQUdmLGVBQVcsWUFBWSxNQUFNLFdBQVcsQ0FBQyxHQUFHO0FBQ3hDLFlBQU0saUJBQWlCLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLFdBQVcsU0FBUyxDQUFDO0FBQ3RGLFVBQUksZ0JBQWdCO0FBQ2hCLGNBQU0sY0FBYyxlQUFlLFNBQVMsS0FBSyxDQUFDLFFBQThCLElBQUksWUFBWSxPQUFPO0FBQ3ZHLFlBQUksYUFBYTtBQUNiLHNCQUFZLFNBQVM7QUFDckIsZ0JBQU0sUUFBUSxVQUFVLGtCQUFrQixFQUFFLEtBQUssZUFBZSxJQUFJLEdBQUcsY0FBYyxFQUNoRixLQUFLLE1BQU0sUUFBUSxJQUFJLG1DQUFtQyxRQUFRLEVBQUUsQ0FBQyxFQUNyRSxNQUFNLENBQUMsVUFBZSxRQUFRLE1BQU0sNENBQTRDLFFBQVEsS0FBSyxLQUFLLENBQUM7QUFBQSxRQUM1RyxPQUFPO0FBQ0gsa0JBQVEsS0FBSyw2QkFBNkIsUUFBUSxhQUFhO0FBQUEsUUFDbkU7QUFBQSxNQUNKLE9BQU87QUFDSCxnQkFBUSxLQUFLLGdDQUFnQyxRQUFRLEVBQUU7QUFBQSxNQUMzRDtBQUFBLElBQ0o7QUFHQSxVQUFNLFFBQVEsVUFBVSxrQkFBa0IsRUFBRSxLQUFLLGFBQWEsSUFBSSxHQUFHLFlBQVksRUFDNUUsS0FBSyxNQUFNLFFBQVEsSUFBSSxtQ0FBbUMsUUFBUSxFQUFFLENBQUMsRUFDckUsTUFBTSxDQUFDLFVBQWUsUUFBUSxNQUFNLDRDQUE0QyxRQUFRLEtBQUssS0FBSyxDQUFDO0FBQ3hHLFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyxTQUFTLE9BQU8sc0JBQXNCLGlCQUFpQjtBQUFBLE1BQ2hFLGlCQUFpQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxXQUFPLEtBQUssVUFBVSxFQUFFLFNBQVMsS0FBSyxDQUFDO0FBQUEsRUFDM0MsU0FBUyxPQUFPO0FBQ1osWUFBUSxNQUFNLGdDQUFnQyxLQUFLO0FBQ25ELFdBQU8sS0FBSyxVQUFVLEVBQUUsU0FBUyxPQUFPLFNBQVMsb0RBQW9ELENBQUM7QUFBQSxFQUMxRztBQUNKLENBQUM7OztBQzE2Qk0sSUFBTSxzQkFBTixNQUFNLG9CQUFtQjtBQUFBLEVBQzlCLE1BQU0sMEJBQ0osTUFNQSxjQUNBLGNBQ0EsU0FDQSxtQkFDQTtBQUNBLFVBQU0sWUFBWSxRQUFRLFFBQVEsSUFBSSxLQUFLLFVBQVUsUUFBUSxLQUFLO0FBQ2xFLFVBQU0sWUFBWSxRQUFRLFlBQVk7QUFHdEMsVUFBTSxjQUFjLE1BQU0sS0FBSyxLQUFLLGFBQWEsT0FBTyxDQUFDLEVBQUU7QUFBQSxNQUN6RCxDQUFDLGdCQUFnQixZQUFZLGdCQUFnQixLQUFLLEtBQUs7QUFBQSxJQUN6RDtBQUVBLFFBQUk7QUFDSixRQUFJLFlBQVksU0FBUyxHQUFHO0FBRTFCLFVBQUksbUJBQW1CO0FBQ3JCLHNCQUFjO0FBQUEsTUFDaEIsT0FBTztBQUNMLGdCQUFRLE1BQU0sNkRBQTZEO0FBQzNFO0FBQUEsTUFDRjtBQUFBLElBQ0YsT0FBTztBQUNMLG9CQUFjLFlBQVksQ0FBQyxFQUFFO0FBQUEsSUFDL0I7QUFFQSxVQUFNLGVBQWtDO0FBQUEsTUFDdEMsUUFBUSxLQUFLO0FBQUEsTUFDYixNQUFNO0FBQUEsTUFDTixlQUFlLEtBQUssS0FBSztBQUFBLE1BQ3pCLHVCQUF1QjtBQUFBLE1BQ3ZCLFFBQVE7QUFBQSxNQUNSO0FBQUEsTUFDQSxlQUFlO0FBQUEsSUFDakI7QUFFQSxVQUFNLGVBQWtDO0FBQUEsTUFDdEMsUUFBUSxLQUFLO0FBQUEsTUFDYixNQUFNO0FBQUEsTUFDTixlQUFlO0FBQUEsTUFDZix1QkFBdUIsS0FBSyxLQUFLO0FBQUEsTUFDakMsUUFBUTtBQUFBLE1BQ1I7QUFBQSxNQUNBLGVBQWU7QUFBQSxJQUNqQjtBQUVBLFFBQUk7QUFDRixZQUFNLFFBQVEsVUFBVSxnQkFBZ0IsWUFBWTtBQUNwRCxZQUFNLFFBQVEsVUFBVSxnQkFBZ0IsWUFBWTtBQUFBLElBQ3RELFNBQVMsT0FBTztBQUNkLGNBQVEsTUFBTSw0Q0FBNEMsS0FBSztBQUFBLElBQ2pFO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBTSxxQkFBcUIsYUFBcUIsWUFBa0Q7QUFDaEcsVUFBTSxRQUFRLEVBQUUsZUFBZSxZQUFZO0FBQzNDLFVBQU0sVUFBVSxFQUFFLE1BQU0sRUFBRSxLQUFLLEdBQUcsR0FBRyxPQUFPLFdBQVc7QUFFdkQsUUFBSTtBQUNGLFlBQU0sU0FBUyxNQUFNLFFBQVEsU0FBUyxnQkFBZ0IsT0FBTyxNQUFNO0FBQUEsTUFBRSxHQUFHLE9BQU8sT0FBTztBQUN0RixhQUFPO0FBQUEsSUFDVCxTQUFTLE9BQU87QUFDZCxjQUFRLE1BQU0sbURBQW1ELGFBQWEsS0FBSztBQUNuRixhQUFPLENBQUM7QUFBQSxJQUNWO0FBQUEsRUFDRjtBQUNGO0FBMUVnQztBQUF6QixJQUFNLHFCQUFOO0FBNEVBLElBQU0scUJBQXFCLElBQUksbUJBQW1COzs7QUN2RXpELElBQU0sZUFBTixNQUFNLGFBQVk7QUFBQSxFQUNOLFFBQVEsb0JBQUksSUFBeUI7QUFBQSxFQUNyQyxnQkFBZ0Isb0JBQUksSUFBb0I7QUFBQSxFQUN4QyxpQkFBaUIsb0JBQUksSUFBb0I7QUFBQSxFQUUxQyxXQUFXLE1BQStCO0FBQzdDLFVBQU0sU0FBUyxLQUFLLE1BQU0sS0FBSyxPQUFPLElBQUksR0FBTztBQUNqRCxVQUFNLFVBQXVCO0FBQUEsTUFDekI7QUFBQSxNQUNBO0FBQUEsTUFDQSxjQUFjLG9CQUFJLElBQTZCO0FBQUEsTUFDL0MsU0FBUyxvQkFBSSxJQUE0QjtBQUFBLE1BQ3pDLFdBQVcsb0JBQUksS0FBSztBQUFBLElBQ3hCO0FBQ0EsWUFBUSxhQUFhLElBQUksS0FBSyxRQUFRLElBQUk7QUFDMUMsU0FBSyxNQUFNLElBQUksUUFBUSxPQUFPO0FBQzlCLFNBQUssY0FBYyxJQUFJLEtBQUssUUFBUSxNQUFNO0FBQzFDLFdBQU87QUFBQSxFQUNYO0FBQUEsRUFDTyxZQUFZLFFBQTZDO0FBQzVELFVBQU0sT0FBTyxLQUFLLE1BQU0sSUFBSSxNQUFNO0FBQ2xDLFFBQUksQ0FBQyxLQUFNO0FBQ1gsV0FBTyxLQUFLO0FBQUEsRUFDaEI7QUFBQSxFQUNPLGVBQWVDLFNBQXlCO0FBQzNDLFdBQU8sS0FBSyxjQUFjLElBQUlBLE9BQU07QUFBQSxFQUN4QztBQUFBLEVBQ08sZ0JBQWdCQSxTQUF5QztBQUM1RCxVQUFNLFNBQVMsS0FBSyxjQUFjLElBQUlBLE9BQU07QUFDNUMsUUFBSSxRQUFRO0FBQ1IsYUFBTyxLQUFLLE1BQU0sSUFBSSxNQUFNO0FBQUEsSUFDaEM7QUFDQSxXQUFPO0FBQUEsRUFDWDtBQUFBLEVBQ08sa0JBQWtCQSxTQUFnQjtBQUNyQyxXQUFPLEtBQUssY0FBYyxJQUFJQSxPQUFNO0FBQUEsRUFDeEM7QUFBQSxFQUNPLHFCQUNILFFBQ0EsY0FDQSxpQkFDQSxZQUFvQixLQUN0QjtBQUNFLFVBQU0sT0FBTyxLQUFLLE1BQU0sSUFBSSxNQUFNO0FBQ2xDLFFBQUksQ0FBQyxLQUFNO0FBQ1gsUUFBSSxLQUFLLFFBQVEsSUFBSSxZQUFZLEtBQUssS0FBSyxhQUFhLElBQUksWUFBWSxFQUFHO0FBQzNFLFVBQU0sVUFBVSxXQUFXLE1BQU07QUFDN0Isc0JBQWdCO0FBQ2hCLFdBQUssd0JBQXdCLFFBQVEsWUFBWTtBQUFBLElBQ3JELEdBQUcsU0FBUztBQUNaLFNBQUssUUFBUSxJQUFJLGNBQWMsT0FBTztBQUFBLEVBQzFDO0FBQUEsRUFDTyx3QkFBd0IsUUFBZ0IsY0FBc0I7QUFDakUsVUFBTSxPQUFPLEtBQUssTUFBTSxJQUFJLE1BQU07QUFDbEMsUUFBSSxDQUFDLEtBQU07QUFDWCxRQUFJLEtBQUssUUFBUSxJQUFJLFlBQVksR0FBRztBQUNoQyxtQkFBYSxLQUFLLFFBQVEsSUFBSSxZQUFZLENBQUM7QUFDM0MsV0FBSyxRQUFRLE9BQU8sWUFBWTtBQUFBLElBQ3BDO0FBQUEsRUFDSjtBQUFBLEVBQ08saUJBQWlCLFFBQWdCLGFBQXVDO0FBQzNFLFVBQU0sT0FBTyxLQUFLLE1BQU0sSUFBSSxNQUFNO0FBQ2xDLFFBQUksQ0FBQyxLQUFNLFFBQU87QUFDbEIsUUFBSSxLQUFLLGFBQWEsSUFBSSxZQUFZLE1BQU0sRUFBRyxRQUFPO0FBQ3RELFNBQUssYUFBYSxJQUFJLFlBQVksUUFBUSxXQUFXO0FBQ3JELFNBQUssY0FBYyxJQUFJLFlBQVksUUFBUSxNQUFNO0FBQ2pELFFBQUksS0FBSyxRQUFRLElBQUksWUFBWSxNQUFNLEdBQUc7QUFDdEMsbUJBQWEsS0FBSyxRQUFRLElBQUksWUFBWSxNQUFNLENBQUM7QUFDakQsV0FBSyxRQUFRLE9BQU8sWUFBWSxNQUFNO0FBQUEsSUFDMUM7QUFDQSxXQUFPO0FBQUEsRUFDWDtBQUFBLEVBQ08sa0JBQWtCLFFBQWdCLGNBQXNCO0FBQzNELFNBQUssd0JBQXdCLFFBQVEsWUFBWTtBQUFBLEVBQ3JEO0FBQUEsRUFDQSxNQUFhLGtCQUFrQixRQUFnQkEsU0FBZ0I7QUFDM0QsVUFBTSxPQUFPLEtBQUssTUFBTSxJQUFJLE1BQU07QUFDbEMsUUFBSSxDQUFDLEtBQU07QUFHWCxZQUFRLGlDQUFpQ0EsT0FBTTtBQUUvQyxTQUFLLGFBQWEsT0FBT0EsT0FBTTtBQUMvQixTQUFLLGNBQWMsT0FBT0EsT0FBTTtBQUNoQyxRQUFJQSxZQUFXLEtBQUssS0FBSyxVQUFVLEtBQUssYUFBYSxRQUFRLEdBQUc7QUFDNUQsWUFBTSxtQkFBbUIsMEJBQTBCLE1BQU0sYUFBYSxhQUFhLG9CQUFJLEtBQUssQ0FBQztBQUM3RixXQUFLLFFBQVEsTUFBTTtBQUFBLElBQ3ZCO0FBQUEsRUFDSjtBQUFBLEVBQ08sUUFBUSxRQUFnQjtBQUMzQixVQUFNLE9BQU8sS0FBSyxNQUFNLElBQUksTUFBTTtBQUNsQyxRQUFJLENBQUMsS0FBTTtBQUdYLGVBQVcsZUFBZSxLQUFLLGFBQWEsT0FBTyxHQUFHO0FBQ2xELGNBQVEsaUNBQWlDLFlBQVksTUFBTTtBQUFBLElBQy9EO0FBRUEsZUFBVyxXQUFXLEtBQUssUUFBUSxPQUFPLEdBQUc7QUFDekMsbUJBQWEsT0FBTztBQUFBLElBQ3hCO0FBQ0EsZUFBVyxlQUFlLEtBQUssYUFBYSxPQUFPLEdBQUc7QUFDbEQsV0FBSyxjQUFjLE9BQU8sWUFBWSxNQUFNO0FBQUEsSUFDaEQ7QUFDQSxTQUFLLE1BQU0sT0FBTyxNQUFNO0FBQUEsRUFDNUI7QUFBQSxFQUNPLGVBQWUsUUFBZ0JBLFNBQWdCO0FBQ2xELFVBQU0sT0FBTyxLQUFLLE1BQU0sSUFBSSxNQUFNO0FBQ2xDLFFBQUksQ0FBQyxLQUFNO0FBQ1gsU0FBSyxhQUFhLE9BQU9BLE9BQU07QUFDL0IsU0FBSyxjQUFjLE9BQU9BLE9BQU07QUFBQSxFQUNwQztBQUFBLEVBQ08sY0FBYyxRQUFnQkEsU0FBZ0IsTUFBd0I7QUFDekUsVUFBTSxPQUFPLEtBQUssTUFBTSxJQUFJLE1BQU07QUFDbEMsUUFBSSxDQUFDLEtBQU0sUUFBTztBQUNsQixVQUFNLGNBQWMsS0FBSyxhQUFhLElBQUlBLE9BQU07QUFDaEQsUUFBSSxDQUFDLFlBQWEsUUFBTztBQUN6QixnQkFBWSxTQUFTO0FBQ3JCLFdBQU87QUFBQSxFQUNYO0FBQUEsRUFDTyxnQkFBZ0IsUUFBbUM7QUFDdEQsVUFBTSxPQUFPLEtBQUssTUFBTSxJQUFJLE1BQU07QUFDbEMsUUFBSSxDQUFDLEtBQU0sUUFBTyxDQUFDO0FBQ25CLFdBQU8sTUFBTSxLQUFLLEtBQUssYUFBYSxPQUFPLENBQUM7QUFBQSxFQUNoRDtBQUFBLEVBQ08sY0FBNkM7QUFDaEQsV0FBTyxLQUFLLE1BQU0sT0FBTztBQUFBLEVBQzdCO0FBQUEsRUFFQSxNQUFhLGVBQWVBLFNBQWEsY0FBc0IsUUFBZ0I7QUFDM0UsVUFBTSxNQUFNLGFBQWFBLE9BQU07QUFDL0IsVUFBTSxRQUFRLDhCQUE4QixHQUFHO0FBQy9DLFVBQU0sVUFBVSxNQUFNLFFBQVEsb0JBQW9CLEVBQUUsaUJBQWlCLGNBQWMsT0FBTyxHQUFHLGFBQWEsR0FBRyxNQUFNLElBQUk7QUFDdkgsU0FBSyxlQUFlLElBQUlBLFNBQVEsT0FBTztBQUFBLEVBQzNDO0FBQUEsRUFDQSxNQUFhLGFBQWFBLFNBQWdCO0FBQ3RDLFVBQU0sVUFBVSxLQUFLLGVBQWUsSUFBSUEsT0FBTTtBQUM5QyxRQUFJLENBQUMsUUFBUztBQUNkLFlBQVEsb0JBQW9CLEVBQUUsVUFBVSxPQUFPO0FBQy9DLFNBQUssZUFBZSxPQUFPQSxPQUFNO0FBQUEsRUFDckM7QUFDSjtBQTdJa0I7QUFBbEIsSUFBTSxjQUFOO0FBK0lPLElBQU0sY0FBYyxJQUFJLFlBQVk7OztBQzdKM0MsSUFBTSxXQUFOLE1BQU0sU0FBUTtBQUFBLEVBQ0gsTUFBTSxvQkFBSSxJQUFvQjtBQUFBLEVBQzlCLGFBQWEsb0JBQUksSUFBdUQ7QUFBQSxFQUN4RSxhQUFhLG9CQUFJLElBQXVEO0FBQUEsRUFDeEUsV0FBVyxvQkFBSSxJQUE2RTtBQUFBLEVBQzVGLG9CQUFvQixvQkFBSSxJQUFxQjtBQUFBLEVBQzdDLG9CQUFvQixvQkFBSSxJQUFxQjtBQUFBLEVBQzdDLFNBQVMsb0JBQUksSUFBcUI7QUFBQSxFQUNsQyxVQUFVLG9CQUFJLElBQW9CO0FBQUEsRUFDbEMsU0FBUyxvQkFBSSxJQUFxQjtBQUFBLEVBQ2xDLFlBQVksb0JBQUksSUFBcUI7QUFBQSxFQUNyQyxtQkFBbUIsb0JBQUksSUFBb0I7QUFBQSxFQUMzQyxTQUFTLG9CQUFJLElBQW9CO0FBQUEsRUFDakMsZUFBZSxvQkFBSSxJQUFvQjtBQUFBLEVBQ3ZDLGVBQWUsb0JBQUksSUFBcUI7QUFBQSxFQUN4QyxjQUFjLG9CQUFJLElBQW9CO0FBQUEsRUFDdEMscUJBQXFCLG9CQUFJLElBQW9CO0FBQUEsRUFDN0MsbUJBQW1CLG9CQUFJLElBQW9CO0FBQUE7QUFBQSxFQUdsRCxNQUFhLE9BQU87QUFDaEIsUUFBSTtBQUNBLFVBQUksZ0JBQWdCLFFBQVEsU0FBUyxFQUFFLGNBQWM7QUFDckQsYUFBTyxrQkFBa0IsT0FBTztBQUM1QixjQUFNLE1BQU0sR0FBSTtBQUNoQix3QkFBZ0IsUUFBUSxTQUFTLEVBQUUsY0FBYztBQUNqRCxZQUFJLGVBQWU7QUFDZixpQkFBTywrQkFBK0I7QUFDdEM7QUFBQSxRQUNKO0FBQ0EsZ0JBQVEsSUFBSSw4Q0FBOEM7QUFBQSxNQUM5RDtBQUNBLFlBQU0sTUFBVyxNQUFNLFFBQVEsU0FBUyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzVELGlCQUFXLFFBQVEsS0FBSztBQUNwQixhQUFLLElBQUksSUFBSSxLQUFLLEtBQUssS0FBSyxHQUFHO0FBQy9CLGFBQUssV0FBVyxJQUFJLEtBQUssS0FBSyxLQUFLLFVBQVU7QUFDN0MsYUFBSyxXQUFXLElBQUksS0FBSyxLQUFLLEtBQUssVUFBVTtBQUM3QyxhQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUssS0FBSyxRQUFRO0FBQ3pDLGFBQUssa0JBQWtCLElBQUksS0FBSyxLQUFLLEtBQUssaUJBQWlCO0FBQzNELGFBQUssa0JBQWtCLElBQUksS0FBSyxLQUFLLEtBQUssaUJBQWlCO0FBQzNELGFBQUssT0FBTyxJQUFJLEtBQUssS0FBSyxLQUFLLE1BQU07QUFDckMsYUFBSyxRQUFRLElBQUksS0FBSyxLQUFLLEtBQUssT0FBTztBQUN2QyxhQUFLLE9BQU8sSUFBSSxLQUFLLEtBQUssS0FBSyxNQUFNO0FBQ3JDLGFBQUssVUFBVSxJQUFJLEtBQUssS0FBSyxLQUFLLFNBQVM7QUFDM0MsYUFBSyxpQkFBaUIsSUFBSSxLQUFLLEtBQUssS0FBSyxnQkFBZ0I7QUFDekQsYUFBSyxtQkFBbUIsSUFBSSxLQUFLLEtBQUssS0FBSyxrQkFBa0I7QUFDN0QsYUFBSyxPQUFPLElBQUksS0FBSyxLQUFLLEtBQUssTUFBTTtBQUNyQyxhQUFLLGFBQWEsSUFBSSxLQUFLLEtBQUssS0FBSyxZQUFZO0FBQ2pELGFBQUssYUFBYSxJQUFJLEtBQUssS0FBSyxLQUFLLFlBQVk7QUFDakQsYUFBSyxZQUFZLElBQUksS0FBSyxLQUFLLEtBQUssV0FBVztBQUMvQyxhQUFLLGlCQUFpQixJQUFJLEtBQUssS0FBSyxLQUFLLGdCQUFnQjtBQUFBLE1BQzdEO0FBQ0EsYUFBTyxvQkFBb0I7QUFBQSxJQUMvQixTQUFTLE9BQVk7QUFDakIsYUFBTyx1Q0FBdUMsTUFBTSxPQUFPLEVBQUU7QUFBQSxJQUNqRTtBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQWEsT0FBTztBQUNoQixRQUFJO0FBQ0EsaUJBQVcsQ0FBQyxLQUFLLEtBQUssS0FBSyxLQUFLLEtBQUs7QUFDakMsY0FBTSxRQUFRLFVBQVUsa0JBQWtCLEVBQUUsS0FBSyxJQUFJLEdBQUc7QUFBQSxVQUNwRCxLQUFLO0FBQUEsVUFDTCxZQUFZLEtBQUssV0FBVyxJQUFJLEdBQUc7QUFBQSxVQUNuQyxZQUFZLEtBQUssV0FBVyxJQUFJLEdBQUc7QUFBQSxVQUNuQyxVQUFVLEtBQUssU0FBUyxJQUFJLEdBQUc7QUFBQSxVQUMvQixtQkFBbUIsS0FBSyxrQkFBa0IsSUFBSSxHQUFHO0FBQUEsVUFDakQsbUJBQW1CLEtBQUssa0JBQWtCLElBQUksR0FBRztBQUFBLFVBQ2pELFFBQVEsS0FBSyxPQUFPLElBQUksR0FBRztBQUFBLFVBQzNCLFNBQVMsS0FBSyxRQUFRLElBQUksR0FBRztBQUFBLFVBQzdCLFFBQVEsS0FBSyxPQUFPLElBQUksR0FBRztBQUFBLFVBQzNCLFdBQVcsS0FBSyxVQUFVLElBQUksR0FBRztBQUFBLFVBQ2pDLGtCQUFrQixLQUFLLGlCQUFpQixJQUFJLEdBQUc7QUFBQSxVQUMvQyxvQkFBb0IsS0FBSyxtQkFBbUIsSUFBSSxHQUFHO0FBQUEsVUFDbkQsUUFBUSxLQUFLLE9BQU8sSUFBSSxHQUFHO0FBQUEsVUFDM0IsY0FBYyxLQUFLLGFBQWEsSUFBSSxHQUFHO0FBQUEsVUFDdkMsY0FBYyxLQUFLLGFBQWEsSUFBSSxHQUFHO0FBQUEsVUFDdkMsYUFBYSxLQUFLLFlBQVksSUFBSSxHQUFHO0FBQUEsVUFDckMsa0JBQWtCLEtBQUssaUJBQWlCLElBQUksR0FBRztBQUFBLFFBQ25ELENBQUM7QUFBQSxNQUNMO0FBQ0EsYUFBTyxnQ0FBZ0M7QUFDdkMsYUFBTztBQUFBLElBQ1gsU0FBUyxPQUFZO0FBQ2pCLGFBQU8sdUNBQXVDLE1BQU0sT0FBTyxFQUFFO0FBQzdELGFBQU87QUFBQSxJQUNYO0FBQUEsRUFDSjtBQUFBLEVBRU8sb0JBQW9CLFdBQW1CLFFBQWdCO0FBQzFELFNBQUssSUFBSSxJQUFJLFdBQVcsU0FBUztBQUNqQyxTQUFLLFdBQVcsSUFBSSxXQUFXLEVBQUUsU0FBUyxJQUFJLFlBQVksQ0FBQyxFQUFFLENBQUM7QUFDOUQsU0FBSyxXQUFXLElBQUksV0FBVyxFQUFFLFNBQVMsSUFBSSxZQUFZLENBQUMsRUFBRSxDQUFDO0FBQzlELFNBQUssU0FBUyxJQUFJLFdBQVcsRUFBRSxTQUFTLG9FQUFvRSxXQUFXLENBQUMsRUFBRSxNQUFNLFdBQVcsS0FBSyxtRUFBbUUsQ0FBQyxFQUFFLENBQUM7QUFDdk4sU0FBSyxrQkFBa0IsSUFBSSxXQUFXLElBQUk7QUFDMUMsU0FBSyxrQkFBa0IsSUFBSSxXQUFXLElBQUk7QUFDMUMsU0FBSyxPQUFPLElBQUksV0FBVyxJQUFJO0FBQy9CLFNBQUssUUFBUSxJQUFJLFdBQVcsRUFBRTtBQUM5QixTQUFLLE9BQU8sSUFBSSxXQUFXLEtBQUs7QUFDaEMsU0FBSyxZQUFZLElBQUksV0FBVyxNQUFNO0FBQ3RDLFNBQUssVUFBVSxJQUFJLFdBQVcsS0FBSztBQUNuQyxTQUFLLGlCQUFpQixJQUFJLFdBQVcsU0FBUztBQUM5QyxTQUFLLG1CQUFtQixJQUFJLFdBQVcsRUFBRTtBQUN6QyxTQUFLLE9BQU8sSUFBSSxXQUFXLEVBQUU7QUFDN0IsU0FBSyxhQUFhLElBQUksV0FBVyxFQUFFO0FBQ25DLFNBQUssYUFBYSxJQUFJLFdBQVcsS0FBSztBQUN0QyxTQUFLLGlCQUFpQixJQUFJLFdBQVcsRUFBRTtBQUFBLEVBQzNDO0FBQUEsRUFFQSxNQUFhLG1CQUFtQixXQUFtQjtBQUMvQyxRQUFJO0FBQ0EsWUFBTSxRQUFRLFVBQVUsa0JBQWtCLEVBQUUsS0FBSyxVQUFVLEdBQUc7QUFBQSxRQUMxRCxLQUFLO0FBQUEsUUFDTCxZQUFZLEtBQUssV0FBVyxJQUFJLFNBQVM7QUFBQSxRQUN6QyxZQUFZLEtBQUssV0FBVyxJQUFJLFNBQVM7QUFBQSxRQUN6QyxVQUFVLEtBQUssU0FBUyxJQUFJLFNBQVM7QUFBQSxRQUNyQyxtQkFBbUIsS0FBSyxrQkFBa0IsSUFBSSxTQUFTO0FBQUEsUUFDdkQsbUJBQW1CLEtBQUssa0JBQWtCLElBQUksU0FBUztBQUFBLFFBQ3ZELFFBQVEsS0FBSyxPQUFPLElBQUksU0FBUztBQUFBLFFBQ2pDLFNBQVMsS0FBSyxRQUFRLElBQUksU0FBUztBQUFBLFFBQ25DLFFBQVEsS0FBSyxPQUFPLElBQUksU0FBUztBQUFBLFFBQ2pDLFdBQVcsS0FBSyxVQUFVLElBQUksU0FBUztBQUFBLFFBQ3ZDLGtCQUFrQixLQUFLLGlCQUFpQixJQUFJLFNBQVM7QUFBQSxRQUNyRCxvQkFBb0IsS0FBSyxtQkFBbUIsSUFBSSxTQUFTO0FBQUEsUUFDekQsUUFBUSxLQUFLLE9BQU8sSUFBSSxTQUFTO0FBQUEsUUFDakMsY0FBYyxLQUFLLGFBQWEsSUFBSSxTQUFTO0FBQUEsUUFDN0MsY0FBYyxLQUFLLGFBQWEsSUFBSSxTQUFTO0FBQUEsUUFDN0MsYUFBYSxLQUFLLFlBQVksSUFBSSxTQUFTO0FBQUEsUUFDM0Msa0JBQWtCLEtBQUssaUJBQWlCLElBQUksU0FBUztBQUFBLE1BQ3pELENBQUM7QUFDRCxhQUFPLHdDQUF3QyxTQUFTLGdCQUFnQjtBQUN4RSxhQUFPO0FBQUEsSUFDWCxTQUFTLE9BQVk7QUFDakIsYUFBTyxpREFBaUQsU0FBUyxLQUFLLE1BQU0sT0FBTyxFQUFFO0FBQ3JGLGFBQU87QUFBQSxJQUNYO0FBQUEsRUFDSjtBQUFBO0FBQUEsRUFHTyxtQkFBbUIsV0FBbUI7QUFDekMsU0FBSyxpQkFBaUIsU0FBUztBQUMvQixXQUFPLHNEQUFzRCxTQUFTLEVBQUU7QUFBQSxFQUM1RTtBQUFBO0FBQUEsRUFHUSxpQkFBaUIsV0FBbUI7QUFDeEMsU0FBSyxJQUFJLE9BQU8sU0FBUztBQUN6QixTQUFLLFdBQVcsT0FBTyxTQUFTO0FBQ2hDLFNBQUssV0FBVyxPQUFPLFNBQVM7QUFDaEMsU0FBSyxTQUFTLE9BQU8sU0FBUztBQUM5QixTQUFLLGtCQUFrQixPQUFPLFNBQVM7QUFDdkMsU0FBSyxrQkFBa0IsT0FBTyxTQUFTO0FBQ3ZDLFNBQUssT0FBTyxPQUFPLFNBQVM7QUFDNUIsU0FBSyxRQUFRLE9BQU8sU0FBUztBQUM3QixTQUFLLE9BQU8sT0FBTyxTQUFTO0FBQzVCLFNBQUssVUFBVSxPQUFPLFNBQVM7QUFDL0IsU0FBSyxpQkFBaUIsT0FBTyxTQUFTO0FBQ3RDLFNBQUssT0FBTyxPQUFPLFNBQVM7QUFDNUIsU0FBSyxhQUFhLE9BQU8sU0FBUztBQUNsQyxTQUFLLGFBQWEsT0FBTyxTQUFTO0FBQ2xDLFNBQUssWUFBWSxPQUFPLFNBQVM7QUFDakMsU0FBSyxtQkFBbUIsT0FBTyxTQUFTO0FBQ3hDLFNBQUssaUJBQWlCLE9BQU8sU0FBUztBQUFBLEVBQzFDO0FBQUE7QUFBQSxFQUdPLGNBQWMsV0FBbUI7QUFDcEMsU0FBSyxpQkFBaUIsU0FBUztBQUMvQixXQUFPLGtEQUFrRCxTQUFTLEVBQUU7QUFBQSxFQUN4RTtBQUNKO0FBMUtjO0FBQWQsSUFBTSxVQUFOO0FBNEtPLElBQU0sV0FBVyxJQUFJLFFBQVE7OztBQ3RLcEMsaUJBQWlCLDRCQUE0QixPQUFPQyxTQUFnQixTQUFpQjtBQVRyRjtBQVVFLFFBQU0sRUFBRSxRQUFRLEtBQUssT0FBTyxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQy9DLFFBQU0sZUFBZSxNQUFNLE1BQU0seUJBQXlCLE1BQU07QUFDaEUsUUFBTSxhQUE0QixNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxlQUFlLFFBQVEsZ0JBQWdCLE1BQU0sTUFBTSx1QkFBdUJBLE9BQU0sRUFBRSxDQUFDO0FBRS9KLFFBQU0sYUFBNEIsTUFBTSxRQUFRLFFBQVEsa0JBQWtCO0FBQUEsSUFDeEUsZUFBZSxNQUFNLE1BQU0sdUJBQXVCQSxPQUFNO0FBQUEsSUFDeEQsZ0JBQWdCO0FBQUEsRUFDbEIsQ0FBQztBQUVELE1BQUksQ0FBQyxjQUFjO0FBQ2pCLFlBQVEseUJBQXlCQSxTQUFRLEtBQUssVUFBVTtBQUFBLE1BQ3RELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNYLENBQUMsQ0FBQztBQUNGLFVBQU0sYUFBWSxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUN6QyxVQUFNLGVBQWtDO0FBQUEsTUFDdEMsUUFBUSxLQUFLLE1BQU0sS0FBSyxPQUFPLElBQUksR0FBTztBQUFBLE1BQzFDLE1BQU07QUFBQSxNQUNOLGVBQWUsTUFBTSxNQUFNLHVCQUF1QkEsT0FBTTtBQUFBLE1BQ3hELHVCQUF1QjtBQUFBLE1BQ3ZCLFFBQVE7QUFBQSxNQUNSLFVBQVU7QUFBQSxNQUNWLGVBQWU7QUFBQSxJQUNqQjtBQUVBLFVBQU0sZUFBa0M7QUFBQSxNQUN0QyxRQUFRLEtBQUssTUFBTSxLQUFLLE9BQU8sSUFBSSxHQUFPO0FBQUEsTUFDMUMsTUFBTTtBQUFBLE1BQ04sZUFBZTtBQUFBLE1BQ2YsdUJBQXVCLE1BQU0sTUFBTSx1QkFBdUJBLE9BQU07QUFBQSxNQUNoRSxRQUFRO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixlQUFlO0FBQUEsSUFDakI7QUFDQSxVQUFNLE1BQU0sR0FBSTtBQUNoQixVQUFNLFFBQVEsVUFBVSxnQkFBZ0IsWUFBWTtBQUNwRCxVQUFNLE1BQU0sR0FBSTtBQUNoQixVQUFNLFFBQVEsVUFBVSxnQkFBZ0IsWUFBWTtBQUNwRCxXQUFPO0FBQUEsRUFDVDtBQUVBLFFBQU0sZUFBZSxhQUFhLFdBQVc7QUFFN0MsTUFBSSxZQUFZLGVBQWVBLE9BQU0sR0FBRztBQUN0QyxZQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxNQUN0RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFDRixXQUFPO0FBQUEsRUFDVDtBQUVBLE1BQUksWUFBWSxlQUFlLFlBQVksR0FBRztBQUM1QyxZQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxNQUN0RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFDRixXQUFPO0FBQUEsRUFDVDtBQUVBLFFBQU0sY0FBYyxNQUFNLE1BQU0sdUJBQXVCQSxPQUFNO0FBQzdELFFBQU0sY0FBYyxNQUFNLE1BQU0sdUJBQXVCLFlBQVk7QUFDbkUsUUFBTSxrQkFBa0IsTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLDJCQUEyQkEsT0FBTTtBQUN6RixRQUFNLGtCQUFrQixNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLFlBQVk7QUFDL0YsUUFBTSxrQkFBa0IsTUFBTSxNQUFNLGdCQUFnQixhQUFhLFdBQVc7QUFDNUUsUUFBTSxtQkFBbUIsTUFBTSxNQUFNLGFBQWEsZUFBZTtBQUNqRSxRQUFNLG1CQUFtQixNQUFNLE1BQU0sYUFBYSxlQUFlO0FBQ2pFLE1BQUksa0JBQWtCO0FBQ3BCLFlBQVEseUJBQXlCQSxTQUFRLEtBQUssVUFBVTtBQUFBLE1BQ3RELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNYLENBQUMsQ0FBQztBQUNGLFdBQU87QUFBQSxFQUNULFdBQVcsa0JBQWtCO0FBQzNCLFlBQVEseUJBQXlCQSxTQUFRLEtBQUssVUFBVTtBQUFBLE1BQ3RELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNYLENBQUMsQ0FBQztBQUNGLFdBQU87QUFBQSxFQUNUO0FBQ0EsTUFBSSxpQkFBaUI7QUFDbkIsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDdEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1Q7QUFDQSxRQUFNLHVCQUF1QixNQUFNLE1BQU0sZ0JBQWdCLGFBQWEsV0FBVztBQUNqRixNQUFJLHNCQUFzQjtBQUN4QixZQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxNQUN0RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFDRixXQUFPO0FBQUEsRUFDVDtBQUNBLFFBQU0saUJBQWlCLE1BQU0sTUFBTSxTQUFTLFlBQVk7QUFDeEQsTUFBSSxDQUFDLGdCQUFnQjtBQUNuQixZQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxNQUN0RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFFRixVQUFNLGFBQVksb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFDekMsVUFBTSxlQUFrQztBQUFBLE1BQ3RDLFFBQVEsS0FBSyxNQUFNLEtBQUssT0FBTyxJQUFJLEdBQU87QUFBQSxNQUMxQyxNQUFNO0FBQUEsTUFDTixlQUFlO0FBQUEsTUFDZix1QkFBdUI7QUFBQSxNQUN2QixRQUFRO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixlQUFlO0FBQUEsSUFDakI7QUFFQSxVQUFNLGVBQWtDO0FBQUEsTUFDdEMsUUFBUSxLQUFLLE1BQU0sS0FBSyxPQUFPLElBQUksR0FBTztBQUFBLE1BQzFDLE1BQU07QUFBQSxNQUNOLGVBQWU7QUFBQSxNQUNmLHVCQUF1QjtBQUFBLE1BQ3ZCLFFBQVE7QUFBQSxNQUNSLFVBQVU7QUFBQSxNQUNWLGVBQWU7QUFBQSxJQUNqQjtBQUNBLFVBQU0sTUFBTSxHQUFJO0FBQ2hCLFVBQU0sUUFBUSxVQUFVLGdCQUFnQixZQUFZO0FBQ3BELFVBQU0sTUFBTSxHQUFJO0FBQ2hCLFVBQU0sUUFBUSxVQUFVLGdCQUFnQixZQUFZO0FBQ3BELFdBQU87QUFBQSxFQUNUO0FBQ0EsUUFBTSxrQkFBa0I7QUFBQSxJQUN0QixRQUFBQTtBQUFBLElBQ0EsV0FBVztBQUFBLElBQ1gsYUFBYTtBQUFBLElBQ2IsUUFBUTtBQUFBLEVBQ1Y7QUFFQSxRQUFNLFNBQVMsWUFBWSxXQUFXLGVBQWU7QUFFckQsY0FBWSxlQUFlLGNBQWMsUUFBTyxjQUFTLFNBQVMsSUFBSSxlQUFlLE1BQXJDLG1CQUF3QyxPQUFPLEdBQUcsTUFBTTtBQUN4RyxjQUFZLHFCQUFxQixRQUFRLGNBQWMsTUFBTTtBQUMzRCxZQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxNQUN0RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFDRixZQUFRLHlCQUF5QixjQUFjLEtBQUssVUFBVTtBQUFBLE1BQzVELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNYLENBQUMsQ0FBQztBQUNGLEtBQUMsWUFBWTtBQUNYLFlBQU0sT0FBTyxZQUFZLGdCQUFnQkEsT0FBTTtBQUMvQyxVQUFJLE1BQU07QUFDUixjQUFNLG1CQUFtQiwwQkFBMEIsTUFBTSxjQUFjLFVBQVUsb0JBQUksS0FBSyxHQUFHLFdBQVc7QUFBQSxNQUMxRztBQUNBLGtCQUFZLFFBQVEsTUFBTTtBQUMxQixrQkFBWSxhQUFhLFlBQVk7QUFBQSxJQUN2QyxHQUFHO0FBQ0gsWUFBUSxXQUFXLEVBQUUsY0FBY0EsU0FBUSxDQUFDO0FBQzVDLFlBQVEsV0FBVyxFQUFFLGNBQWMsY0FBYyxDQUFDO0FBQ2xELFlBQVEseUNBQXlDLGNBQWMsR0FBRztBQUNsRSxZQUFRLHVDQUF1Q0EsT0FBTTtBQUFBLEVBQ3ZELEdBQUcsR0FBSztBQUVSLFFBQU0sYUFBYSxhQUFhLEdBQUcsV0FBVyxTQUFTLElBQUksV0FBVyxRQUFRLEtBQUssTUFBTSxNQUFNLHVCQUF1QkEsT0FBTTtBQUM1SCxRQUFNLGFBQWEsYUFBYSxHQUFHLFdBQVcsU0FBUyxJQUFJLFdBQVcsUUFBUSxLQUFLO0FBRW5GLFVBQVEsK0JBQStCLGNBQWMsS0FBSyxVQUFVO0FBQUEsSUFDbEUsSUFBSTtBQUFBLElBQ0osT0FBTztBQUFBLElBQ1AsYUFBYSxHQUFHLFVBQVU7QUFBQSxJQUMxQixLQUFLO0FBQUEsSUFDTCxPQUFPO0FBQUEsTUFDTCxLQUFLO0FBQUEsUUFDSCxNQUFNO0FBQUEsUUFDTixVQUFVO0FBQUEsUUFDVixPQUFPO0FBQUEsUUFDUCxNQUFNLEtBQUssVUFBVTtBQUFBLFVBQ25CO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQSxjQUFjQTtBQUFBLFVBQ2QsaUJBQWlCO0FBQUEsUUFDbkIsQ0FBQztBQUFBLE1BQ0g7QUFBQSxNQUNBLEtBQUs7QUFBQSxRQUNILE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLE1BQU0sS0FBSyxVQUFVO0FBQUEsVUFDbkI7QUFBQSxVQUNBO0FBQUEsVUFDQSxZQUFZO0FBQUEsVUFDWixZQUFZO0FBQUEsVUFDWixjQUFjQTtBQUFBLFVBQ2QsaUJBQWlCO0FBQUEsUUFDbkIsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsRUFDRixDQUFDLENBQUM7QUFFRixVQUFRLElBQUlBLFNBQVEsV0FBVyxjQUFjLFlBQVksR0FBRztBQUM1RCxVQUFRLDJDQUEyQ0EsU0FBUSxLQUFLLFVBQVU7QUFBQSxJQUN4RTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQSxjQUFjQTtBQUFBLElBQ2QsaUJBQWlCO0FBQUEsRUFDbkIsQ0FBQyxDQUFDO0FBQ0YsU0FBTyxPQUFPO0FBQUEsSUFDWixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLEdBQUcsV0FBVyx3QkFBd0IsV0FBVyxjQUFjLE1BQU07QUFBQSxJQUM5RSxpQkFBaUI7QUFBQSxFQUNuQixDQUFDO0FBQ0QsU0FBTztBQUNULENBQUM7QUFFRCxNQUFNLG1DQUFtQyxPQUFPLFNBQWlCO0FBQy9ELFFBQU1BLFVBQVMsT0FBTztBQUN0QixRQUFNLEVBQUUsUUFBUSxjQUFjLGNBQWMsZ0JBQWdCLElBQUksS0FBSyxNQUFNLElBQUk7QUFDL0UsVUFBUSxJQUFJQSxTQUFRLGtCQUFrQixRQUFRLGNBQWMsY0FBYyxlQUFlO0FBQ3pGLGNBQVksa0JBQWtCLFFBQVEsWUFBWTtBQUNsRCxRQUFNLE9BQU8sWUFBWSxnQkFBZ0IsWUFBWTtBQUNyRCxNQUFJLE1BQU07QUFDUixVQUFNLG1CQUFtQiwwQkFBMEIsTUFBTSxZQUFZLFlBQVksb0JBQUksS0FBSyxDQUFDO0FBQUEsRUFDN0Y7QUFDQSxjQUFZLFFBQVEsTUFBTTtBQUMxQixjQUFZLGFBQWEsWUFBWTtBQUNyQyxNQUFJLENBQUMsZ0JBQWdCLENBQUMsY0FBYztBQUNsQztBQUFBLEVBQ0Y7QUFDQSxVQUFRLHlDQUF5QyxjQUFjLGVBQWU7QUFDOUUsVUFBUSx1Q0FBdUMsWUFBWTtBQUMzRCxTQUFPLE9BQU87QUFBQSxJQUNaLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsR0FBRyxNQUFNLE1BQU0sdUJBQXVCLFlBQVksQ0FBQywyQkFBMkIsTUFBTSxNQUFNLHVCQUF1QixZQUFZLENBQUMsY0FBYyxNQUFNO0FBQUEsSUFDM0osaUJBQWlCO0FBQUEsRUFDbkIsQ0FBQztBQUNILENBQUM7QUFFRCxpQkFBaUIsK0JBQStCLE9BQU9BLFNBQWdCLFNBQWlCO0FBQ3RGLFFBQU0sRUFBRSxPQUFPLElBQUksS0FBSyxNQUFNLElBQUk7QUFDbEMsUUFBTSxPQUFPLFlBQVksZ0JBQWdCQSxPQUFNO0FBQy9DLE1BQUksQ0FBQyxRQUFRLEtBQUssV0FBVyxPQUFRLFFBQU87QUFDNUMsUUFBTSxXQUFXLFlBQVksWUFBWSxNQUFNO0FBQy9DLE1BQUksWUFBWSxTQUFTLFdBQVdBLFdBQVUsWUFBWSxnQkFBZ0IsTUFBTSxFQUFFLFVBQVUsR0FBRztBQUM3RixlQUFXLGVBQWUsWUFBWSxnQkFBZ0IsTUFBTSxHQUFHO0FBQzdELGNBQVEsK0NBQStDLFlBQVksTUFBTTtBQUN6RSxjQUFRLFdBQVcsRUFBRSxjQUFjLFlBQVksUUFBUSxDQUFDO0FBQUEsSUFDMUQ7QUFDQSxVQUFNLG1CQUFtQiwwQkFBMEIsTUFBTSxhQUFhLGFBQWEsb0JBQUksS0FBSyxDQUFDO0FBQzdGLGdCQUFZLFFBQVEsTUFBTTtBQUMxQixXQUFPLE9BQU87QUFBQSxNQUNaLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsaUJBQWlCLE1BQU0sTUFBTSx1QkFBdUJBLE9BQU0sQ0FBQyxjQUFjLE1BQU07QUFBQSxNQUN4RixpQkFBaUI7QUFBQSxJQUNuQixDQUFDO0FBQUEsRUFDSCxXQUFXLFlBQVksZ0JBQWdCLE1BQU0sRUFBRSxTQUFTLEdBQUc7QUFDekQsWUFBUSwrQ0FBK0NBLE9BQU07QUFDN0QsWUFBUSx1Q0FBdUNBLE9BQU07QUFDckQsWUFBUSxXQUFXLEVBQUUsY0FBY0EsU0FBUSxDQUFDO0FBQzVDLGdCQUFZLGVBQWUsUUFBUUEsT0FBTTtBQUN6QyxXQUFPLE9BQU87QUFBQSxNQUNaLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsR0FBRyxNQUFNLE1BQU0sdUJBQXVCQSxPQUFNLENBQUMsdUNBQXVDLE1BQU07QUFBQSxNQUNuRyxpQkFBaUI7QUFBQSxJQUNuQixDQUFDO0FBQUEsRUFDSCxPQUFPO0FBQ0wsZUFBVyxlQUFlLFlBQVksZ0JBQWdCLE1BQU0sR0FBRztBQUM3RCxjQUFRLCtDQUErQyxZQUFZLE1BQU07QUFDekUsY0FBUSxXQUFXLEVBQUUsY0FBYyxZQUFZLFFBQVEsQ0FBQztBQUFBLElBQzFEO0FBQ0EsVUFBTSxtQkFBbUIsMEJBQTBCLE1BQU0sYUFBYSxhQUFhLG9CQUFJLEtBQUssQ0FBQztBQUM3RixnQkFBWSxRQUFRLE1BQU07QUFDMUIsV0FBTyxPQUFPO0FBQUEsTUFDWixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLGlCQUFpQixNQUFNLE1BQU0sdUJBQXVCQSxPQUFNLENBQUMsY0FBYyxNQUFNO0FBQUEsTUFDeEYsaUJBQWlCO0FBQUEsSUFDbkIsQ0FBQztBQUFBLEVBQ0g7QUFDQSxTQUFPO0FBQ1QsQ0FBQztBQUVELGlCQUFpQix1Q0FBdUMsT0FBT0EsU0FBZ0IsU0FBaUI7QUFyVWhHO0FBc1VFLFFBQU0sRUFBRSxlQUFlLEtBQUssT0FBTyxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQ3RELFFBQU0sYUFBNEIsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsSUFBSSxDQUFDO0FBQ2pGLFFBQU0sYUFBNEIsTUFBTSxRQUFRLFFBQVEsa0JBQWtCO0FBQUEsSUFDeEUsZUFBZSxNQUFNLE1BQU0sdUJBQXVCQSxPQUFNO0FBQUEsSUFDeEQsZ0JBQWdCO0FBQUEsRUFDbEIsQ0FBQztBQUNELFFBQU0sU0FBUyxZQUFZLGtCQUFrQkEsT0FBTTtBQUNuRCxRQUFNLE9BQU8sWUFBWSxnQkFBZ0JBLE9BQU07QUFDL0MsTUFBSSxDQUFDLE1BQU07QUFDVCxZQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxNQUN0RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFDRixXQUFPO0FBQUEsRUFDVDtBQUNBLFFBQU0sY0FBYyxNQUFNLE1BQU0sdUJBQXVCQSxPQUFNO0FBQzdELFFBQU0sZUFBZSxNQUFNLE1BQU0seUJBQXlCLGFBQWE7QUFDdkUsTUFBSSxDQUFDLGNBQWM7QUFDakIsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDdEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1Q7QUFDQSxRQUFNLGVBQWUsYUFBYSxXQUFXO0FBQzdDLFFBQU0sa0JBQWtCLE1BQU0sTUFBTSxnQkFBZ0IsZUFBZSxXQUFXO0FBQzlFLFFBQU0sa0JBQWtCLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU07QUFDekYsUUFBTSxrQkFBa0IsTUFBTSxNQUFNLDBCQUEwQixhQUFhO0FBQzNFLFFBQU0sbUJBQW1CLE1BQU0sTUFBTSxhQUFhLGVBQWU7QUFDakUsUUFBTSxtQkFBbUIsTUFBTSxNQUFNLGFBQWEsZUFBZTtBQUNqRSxNQUFJLGtCQUFrQjtBQUNwQixZQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxNQUN0RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFDRixXQUFPO0FBQUEsRUFDVCxXQUFXLGtCQUFrQjtBQUMzQixZQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxNQUN0RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFDRixXQUFPO0FBQUEsRUFDVDtBQUNBLE1BQUksaUJBQWlCO0FBQ25CLFlBQVEseUJBQXlCQSxTQUFRLEtBQUssVUFBVTtBQUFBLE1BQ3RELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNYLENBQUMsQ0FBQztBQUNGLFdBQU87QUFBQSxFQUNUO0FBQ0EsUUFBTSx1QkFBdUIsTUFBTSxNQUFNLGdCQUFnQixhQUFhLGFBQWE7QUFDbkYsTUFBSSxzQkFBc0I7QUFDeEIsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDdEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1Q7QUFDQSxRQUFNLGlCQUFpQixNQUFNLE1BQU0sU0FBUyxZQUFZO0FBQ3hELE1BQUksQ0FBQyxnQkFBZ0I7QUFDbkIsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDdEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1Q7QUFDQSxNQUFJLEtBQUssYUFBYSxJQUFJLFlBQVksR0FBRztBQUN2QyxZQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxNQUN0RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFDRixXQUFPO0FBQUEsRUFDVDtBQUNBLGNBQVksZUFBZSxjQUFjLFFBQU8sY0FBUyxTQUFTLElBQUksZUFBZSxNQUFyQyxtQkFBd0MsT0FBTyxHQUFHLE1BQU07QUFDeEcsY0FBWSxxQkFBcUIsT0FBTyxNQUFNLEdBQUcsY0FBYyxNQUFNO0FBQ25FLFlBQVEseUJBQXlCQSxTQUFRLEtBQUssVUFBVTtBQUFBLE1BQ3RELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNYLENBQUMsQ0FBQztBQUNGLGdCQUFZLGFBQWEsWUFBWTtBQUFBLEVBQ3ZDLEdBQUcsR0FBSztBQUVSLFFBQU0sYUFBYSxhQUNmLEdBQUcsV0FBVyxTQUFTLElBQUksV0FBVyxRQUFRLEtBQzlDLE1BQU0sTUFBTSx1QkFBdUJBLE9BQU07QUFDN0MsUUFBTSxhQUFhLGFBQWEsR0FBRyxXQUFXLFNBQVMsSUFBSSxXQUFXLFFBQVEsS0FBSztBQUVuRixVQUFRLCtCQUErQixjQUFjLEtBQUssVUFBVTtBQUFBLElBQ2xFLElBQUk7QUFBQSxJQUNKLE9BQU87QUFBQSxJQUNQLGFBQWEsR0FBRyxVQUFVO0FBQUEsSUFDMUIsS0FBSztBQUFBLElBQ0wsT0FBTztBQUFBLE1BQ0wsS0FBSztBQUFBLFFBQ0gsTUFBTTtBQUFBLFFBQ04sVUFBVTtBQUFBLFFBQ1YsT0FBTztBQUFBLFFBQ1AsTUFBTSxLQUFLLFVBQVU7QUFBQSxVQUNuQjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQSxjQUFjQTtBQUFBLFVBQ2QsaUJBQWlCO0FBQUEsUUFDbkIsQ0FBQztBQUFBLE1BQ0g7QUFBQSxNQUNBLEtBQUs7QUFBQSxRQUNILE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLE1BQU0sS0FBSyxVQUFVO0FBQUEsVUFDbkI7QUFBQSxVQUNBO0FBQUEsVUFDQSxZQUFZO0FBQUEsVUFDWixZQUFZO0FBQUEsVUFDWixjQUFjQTtBQUFBLFVBQ2QsaUJBQWlCO0FBQUEsUUFDbkIsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsRUFDRixDQUFDLENBQUM7QUFDRixTQUFPLE9BQU87QUFBQSxJQUNaLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsR0FBRyxXQUFXLFVBQVUsYUFBYSxpQ0FBaUMsTUFBTTtBQUFBLElBQ3JGLGlCQUFpQjtBQUFBLEVBQ25CLENBQUM7QUFDRCxTQUFPO0FBQ1QsQ0FBQztBQUVELGlCQUFpQiwrQkFBK0IsT0FBT0EsU0FBZ0IsZ0JBQXdCO0FBQzdGLE1BQUksYUFBYTtBQUNqQixNQUFJO0FBQ0YsUUFBSSxhQUFhO0FBQ2YsbUJBQWE7QUFBQSxJQUNmO0FBQUEsRUFDRixTQUFTLE9BQU87QUFDZCxZQUFRLE1BQU0scUNBQXFDLEtBQUs7QUFBQSxFQUMxRDtBQUVBLFFBQU0sY0FBYyxNQUFNLE1BQU0sdUJBQXVCQSxPQUFNO0FBRTdELE1BQUk7QUFDRixVQUFNLFVBQVUsTUFBTSxtQkFBbUIscUJBQXFCLGFBQWEsVUFBVTtBQUNyRixXQUFPLEtBQUssVUFBVSxPQUFPO0FBQUEsRUFDL0IsU0FBUyxPQUFPO0FBQ2QsWUFBUSxNQUFNLG1EQUFtRCxhQUFhLEtBQUs7QUFDbkYsV0FBTyxLQUFLLFVBQVUsQ0FBQyxDQUFDO0FBQUEsRUFDMUI7QUFDRixDQUFDO0FBRUQsaUJBQWlCLHdDQUF3QyxPQUFPQSxTQUFnQixTQUFpQjtBQUMvRixRQUFNLGFBR0YsS0FBSyxNQUFNLElBQUk7QUFDbkIsUUFBTSxNQUFNLE1BQU0sUUFBUSxRQUFRLGtCQUFrQixFQUFFLGVBQWUsV0FBVyxRQUFRLFNBQVMsV0FBVyxVQUFVLENBQUM7QUFDdkgsU0FBTyxLQUFLLFVBQVUsR0FBRztBQUMzQixDQUFDO0FBRUQsaUJBQWlCLGtDQUFrQyxPQUFPQSxTQUFnQixTQUFpQjtBQUN6RixRQUFNLGFBQTRCLEtBQUssTUFBTSxJQUFJO0FBQ2pELFFBQU0saUJBQWlCLFdBQVc7QUFDbEMsUUFBTSxnQkFBZ0IsV0FBVztBQUNqQyxNQUFJLGtCQUFrQixNQUFNLE1BQU0sZ0JBQWdCLGdCQUFnQixhQUFhO0FBQy9FLE1BQUksQ0FBQyxpQkFBaUI7QUFDcEIsVUFBTSxNQUFNLFlBQVksZ0JBQWdCLGFBQWE7QUFDckQsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDdEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1QsT0FBTztBQUNMLFVBQU0sTUFBTSxjQUFjLGdCQUFnQixhQUFhO0FBQ3ZELFlBQVEseUJBQXlCQSxTQUFRLEtBQUssVUFBVTtBQUFBLE1BQ3RELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNYLENBQUMsQ0FBQztBQUNGLFdBQU87QUFBQSxFQUNUO0FBQ0YsQ0FBQztBQUVELGlCQUFpQixnQ0FBZ0MsT0FBT0EsU0FBZ0IsU0FBaUI7QUE1aEJ6RjtBQTZoQkUsUUFBTSxFQUFFLFFBQVEsT0FBTyxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQzFDLFFBQU0sZUFBZSxNQUFNLE1BQU0seUJBQXlCLE1BQU07QUFLaEUsTUFBSSxDQUFDLGNBQWM7QUFDakIsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDdEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1Q7QUFFQSxRQUFNLGVBQWUsYUFBYSxXQUFXO0FBRTdDLE1BQUksWUFBWSxlQUFlQSxPQUFNLEdBQUc7QUFDdEMsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDdEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1Q7QUFFQSxNQUFJLFlBQVksZUFBZSxZQUFZLEdBQUc7QUFDNUMsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDdEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1Q7QUFFQSxRQUFNLGNBQWM7QUFDcEIsUUFBTSxjQUFjLE1BQU0sTUFBTSx1QkFBdUIsWUFBWTtBQUNuRSxRQUFNLGtCQUFrQixNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQ3pGLFFBQU0sa0JBQWtCLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsWUFBWTtBQUsvRixRQUFNLGlCQUFpQixNQUFNLE1BQU0sU0FBUyxZQUFZO0FBQ3hELE1BQUksQ0FBQyxnQkFBZ0I7QUFDbkIsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDdEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1Q7QUFFQSxRQUFNLGtCQUFrQjtBQUFBLElBQ3RCLFFBQUFBO0FBQUEsSUFDQSxXQUFXO0FBQUEsSUFDWCxhQUFhO0FBQUEsSUFDYixRQUFRO0FBQUEsRUFDVjtBQUVBLFFBQU0sU0FBUyxZQUFZLFdBQVcsZUFBZTtBQUVyRCxjQUFZLGVBQWUsY0FBYyxRQUFPLGNBQVMsU0FBUyxJQUFJLGVBQWUsTUFBckMsbUJBQXdDLE9BQU8sR0FBRyxNQUFNO0FBR3hHLGNBQVkscUJBQXFCLFFBQVEsY0FBYyxNQUFNO0FBQzNELFlBQVEseUJBQXlCQSxTQUFRLEtBQUssVUFBVTtBQUFBLE1BQ3RELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNYLENBQUMsQ0FBQztBQUNGLFlBQVEseUJBQXlCLGNBQWMsS0FBSyxVQUFVO0FBQUEsTUFDNUQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0YsS0FBQyxZQUFZO0FBQ1gsWUFBTSxPQUFPLFlBQVksZ0JBQWdCQSxPQUFNO0FBQy9DLFVBQUksTUFBTTtBQUNSLGNBQU0sbUJBQW1CLDBCQUEwQixNQUFNLGNBQWMsVUFBVSxvQkFBSSxLQUFLLEdBQUcsV0FBVztBQUFBLE1BQzFHO0FBQ0Esa0JBQVksUUFBUSxNQUFNO0FBQzFCLGtCQUFZLGFBQWEsWUFBWTtBQUFBLElBQ3ZDLEdBQUc7QUFDSCxZQUFRLFdBQVcsRUFBRSxjQUFjQSxTQUFRLENBQUM7QUFDNUMsWUFBUSxXQUFXLEVBQUUsY0FBYyxjQUFjLENBQUM7QUFDbEQsWUFBUSx5Q0FBeUMsY0FBYyxXQUFXO0FBQzFFLFlBQVEsdUNBQXVDQSxPQUFNO0FBQUEsRUFDdkQsR0FBRyxJQUFLO0FBRVIsUUFBTSxhQUFhO0FBQ25CLFFBQU0sYUFBYSxNQUFNLE1BQU0sdUJBQXVCLFFBQVEsZUFBZTtBQUU3RSxVQUFRLCtCQUErQixjQUFjLEtBQUssVUFBVTtBQUFBLElBQ2xFLElBQUk7QUFBQSxJQUNKLE9BQU87QUFBQSxJQUNQLGFBQWEsR0FBRyxVQUFVO0FBQUEsSUFDMUIsS0FBSztBQUFBLElBQ0wsT0FBTztBQUFBLE1BQ0wsS0FBSztBQUFBLFFBQ0gsTUFBTTtBQUFBLFFBQ04sVUFBVTtBQUFBLFFBQ1YsT0FBTztBQUFBLFFBQ1AsTUFBTSxLQUFLLFVBQVU7QUFBQSxVQUNuQjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0EsY0FBY0E7QUFBQSxVQUNkLGlCQUFpQjtBQUFBLFFBQ25CLENBQUM7QUFBQSxNQUNIO0FBQUEsTUFDQSxLQUFLO0FBQUEsUUFDSCxNQUFNO0FBQUEsUUFDTixVQUFVO0FBQUEsUUFDVixPQUFPO0FBQUEsUUFDUCxNQUFNLEtBQUssVUFBVTtBQUFBLFVBQ25CO0FBQUEsVUFDQTtBQUFBLFVBQ0EsWUFBWTtBQUFBLFVBQ1osWUFBWTtBQUFBLFVBQ1osY0FBY0E7QUFBQSxVQUNkLGlCQUFpQjtBQUFBLFFBQ25CLENBQUM7QUFBQSxNQUNIO0FBQUEsSUFDRjtBQUFBLEVBQ0YsQ0FBQyxDQUFDO0FBRUYsVUFBUSwyQ0FBMkNBLFNBQVEsS0FBSyxVQUFVO0FBQUEsSUFDeEU7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0EsY0FBY0E7QUFBQSxJQUNkLGlCQUFpQjtBQUFBLEVBQ25CLENBQUMsQ0FBQztBQUlGLGFBQVcsWUFBWTtBQUNyQixVQUFNLE9BQU8sWUFBWSxnQkFBZ0JBLE9BQU07QUFDL0MsUUFBSSxRQUFRLEtBQUssV0FBVyxRQUFRO0FBQ2xDLGNBQVEseUJBQXlCQSxTQUFRLEtBQUssVUFBVTtBQUFBLFFBQ3RELElBQUksYUFBYTtBQUFBLFFBQ2pCLE9BQU87QUFBQSxRQUNQLGFBQWE7QUFBQSxRQUNiLEtBQUs7QUFBQSxRQUNMLFNBQVM7QUFBQSxNQUNYLENBQUMsQ0FBQztBQUNGLGNBQVEseUJBQXlCLGNBQWMsS0FBSyxVQUFVO0FBQUEsUUFDNUQsSUFBSSxhQUFhO0FBQUEsUUFDakIsT0FBTztBQUFBLFFBQ1AsYUFBYTtBQUFBLFFBQ2IsS0FBSztBQUFBLFFBQ0wsU0FBUztBQUFBLE1BQ1gsQ0FBQyxDQUFDO0FBRUYsWUFBTSxtQkFBbUIsMEJBQTBCLE1BQU0sYUFBYSxhQUFhLG9CQUFJLEtBQUssR0FBRyxXQUFXO0FBQzFHLGtCQUFZLFFBQVEsTUFBTTtBQUMxQixjQUFRLFdBQVcsRUFBRSxjQUFjQSxTQUFRLENBQUM7QUFDNUMsY0FBUSxXQUFXLEVBQUUsY0FBYyxjQUFjLENBQUM7QUFDbEQsY0FBUSx5Q0FBeUMsY0FBYyxXQUFXO0FBQzFFLGNBQVEsdUNBQXVDQSxPQUFNO0FBQUEsSUFDdkQ7QUFBQSxFQUNGLEdBQUcsR0FBTTtBQUVULFNBQU8sT0FBTztBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyw0QkFBNEJBLE9BQU0sT0FBTyxZQUFZLEtBQUssV0FBVztBQUFBLElBQzlFLGlCQUFpQjtBQUFBLEVBQ25CLENBQUM7QUFFRCxTQUFPO0FBQ1QsQ0FBQzs7O0FDaHRCRCxNQUFNLDRCQUE0QixPQUFPLFFBQWdCLFNBQWM7QUFDckUsUUFBTSxFQUFFLFFBQVEsY0FBYyxjQUFjLGdCQUFnQixJQUFJLEtBQUssTUFBTSxJQUFJO0FBQy9FLGNBQVksa0JBQWtCLFFBQVEsWUFBWTtBQUNsRCxRQUFNLE9BQU8sWUFBWSxnQkFBZ0IsWUFBWTtBQUNyRCxNQUFJLE1BQU07QUFDUixVQUFNLGNBQWMsTUFBTSxNQUFNLHVCQUF1QixZQUFZO0FBQ25FLFVBQU0sbUJBQW1CLDBCQUEwQixNQUFNLFlBQVksWUFBWSxvQkFBSSxLQUFLLEdBQUcsV0FBVztBQUFBLEVBQzFHO0FBQ0EsY0FBWSxRQUFRLE1BQU07QUFDMUIsY0FBWSxhQUFhLFlBQVk7QUFHckMsVUFBUSxpQ0FBaUMsWUFBWTtBQUNyRCxVQUFRLGlDQUFpQyxZQUFZO0FBRXJELFVBQVEseUNBQXlDLGNBQWMsZUFBZTtBQUM5RSxVQUFRLHVDQUF1QyxZQUFZO0FBQzNELFNBQU8sT0FBTztBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxHQUFHLE1BQU0sdUJBQXVCLFlBQVksQ0FBQywrQkFBK0IsTUFBTSx1QkFBdUIsWUFBWSxDQUFDO0FBQUEsSUFDL0gsaUJBQWlCO0FBQUEsRUFDbkIsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLDJCQUEyQixPQUFPLFFBQWdCLFNBQWM7QUFDcEUsUUFBTSxFQUFFLFFBQVEsY0FBYyxZQUFZLFlBQVksY0FBYyxnQkFBZ0IsSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUN2RyxRQUFNLE9BQU8sWUFBWSxnQkFBZ0IsWUFBWTtBQUNyRCxNQUFJLENBQUMsUUFBUSxLQUFLLFdBQVcsUUFBUTtBQUNuQyxZQUFRLHlCQUF5QixjQUFjLEtBQUssVUFBVTtBQUFBLE1BQzVELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNYLENBQUMsQ0FBQztBQUNGO0FBQUEsRUFDRjtBQUNBLFFBQU0sa0JBQWtCLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsWUFBWTtBQUMvRixRQUFNLGNBQWMsTUFBTSxNQUFNLHVCQUF1QixZQUFZO0FBQ25FLFFBQU0sY0FBYztBQUFBLElBQ2xCLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLGFBQWE7QUFBQSxJQUNiLFFBQVE7QUFBQSxFQUNWO0FBQ0EsTUFBSSxDQUFDLFlBQVksaUJBQWlCLFFBQVEsV0FBVyxHQUFHO0FBQ3RELFlBQVEseUJBQXlCLGNBQWMsS0FBSyxVQUFVO0FBQUEsTUFDNUQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0Y7QUFBQSxFQUNGO0FBQ0EsY0FBWSxhQUFhLFlBQVk7QUFDckMsVUFBUSxXQUFXLEVBQUUsY0FBYyxjQUFjLE1BQU07QUFDdkQsVUFBUSxXQUFXLEVBQUUsY0FBYyxjQUFjLE1BQU07QUFHdkQsVUFBUSwyQkFBMkIsY0FBYyxJQUFJO0FBQ3JELFVBQVEsbUNBQW1DLFlBQVk7QUFFdkQsVUFBUSxzQ0FBc0MsY0FBYyxLQUFLLFVBQVU7QUFBQSxJQUN6RTtBQUFBLElBQ0E7QUFBQSxJQUNBLFlBQVk7QUFBQSxJQUNaLFlBQVk7QUFBQSxJQUNaLGNBQWM7QUFBQSxJQUNkO0FBQUEsRUFDRixDQUFDLENBQUM7QUFDRixVQUFRLHlDQUF5QyxjQUFjLE1BQU07QUFDckUsU0FBTyxPQUFPO0FBQUEsSUFDWixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLEdBQUcsTUFBTSx1QkFBdUIsWUFBWSxDQUFDLCtCQUErQixNQUFNLHVCQUF1QixZQUFZLENBQUM7QUFBQSxJQUMvSCxpQkFBaUI7QUFBQSxFQUNuQixDQUFDO0FBQ0gsQ0FBQztBQUVELE1BQU0scUNBQXFDLE9BQU8sUUFBZ0IsU0FBYztBQUM5RSxRQUFNLEVBQUUsUUFBUSxjQUFjLFlBQVksWUFBWSxjQUFjLGdCQUFnQixJQUFJLEtBQUssTUFBTSxJQUFJO0FBRXZHLFFBQU0sT0FBTyxZQUFZLGdCQUFnQixZQUFZO0FBQ3JELE1BQUksQ0FBQyxNQUFNO0FBQ1QsWUFBUSx5QkFBeUIsY0FBYyxLQUFLLFVBQVU7QUFBQSxNQUM1RCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDWCxDQUFDLENBQUM7QUFDRjtBQUFBLEVBQ0Y7QUFDQSxjQUFZLGFBQWEsWUFBWTtBQUNyQyxRQUFNLGtCQUFrQixNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLFlBQVk7QUFDL0YsUUFBTSxjQUFjLE1BQU0sTUFBTSx1QkFBdUIsWUFBWTtBQUNuRSxRQUFNLGNBQWM7QUFBQSxJQUNsQixRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxhQUFhO0FBQUEsSUFDYixRQUFRO0FBQUEsRUFDVjtBQUNBLE1BQUksQ0FBQyxZQUFZLGlCQUFpQixLQUFLLFFBQVEsV0FBVyxHQUFHO0FBQzNELFlBQVEseUJBQXlCLGNBQWMsS0FBSyxVQUFVO0FBQUEsTUFDNUQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ1gsQ0FBQyxDQUFDO0FBQ0Y7QUFBQSxFQUNGO0FBQ0EsVUFBUSxXQUFXLEVBQUUsY0FBYyxjQUFjLEtBQUssTUFBTTtBQUU1RCxhQUFXLEtBQUssWUFBWSxnQkFBZ0IsS0FBSyxNQUFNLEdBQUc7QUFDeEQsUUFBSSxFQUFFLFdBQVcsY0FBYztBQUM3QixZQUFNLFNBQVMsS0FBSztBQUNwQixjQUFRLGlDQUFpQyxFQUFFLFFBQVEsS0FBSyxVQUFVO0FBQUEsUUFDaEU7QUFBQSxRQUNBLGNBQWMsWUFBWSxnQkFBZ0IsS0FBSyxNQUFNO0FBQUEsTUFDdkQsQ0FBQyxDQUFDO0FBQ0YsY0FBUSxvQ0FBb0MsRUFBRSxNQUFNO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQ0EsVUFBUSx5Q0FBeUMsY0FBYyxNQUFNO0FBRXJFLFVBQVEsc0NBQXNDLGNBQWMsS0FBSyxVQUFVO0FBQUEsSUFDekU7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0EsWUFBWTtBQUFBLElBQ1osY0FBYztBQUFBLElBQ2Q7QUFBQSxFQUNGLENBQUMsQ0FBQztBQUNGLFVBQVEsc0NBQXNDLGNBQWMsS0FBSyxVQUFVO0FBQUEsSUFDekU7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0EsWUFBWTtBQUFBLElBQ1osY0FBYztBQUFBLElBQ2Q7QUFBQSxFQUNGLENBQUMsQ0FBQztBQUNGLFNBQU8sT0FBTztBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxHQUFHLE1BQU0sdUJBQXVCLFlBQVksQ0FBQywwQ0FBMEMsTUFBTSx1QkFBdUIsWUFBWSxDQUFDO0FBQUEsSUFDMUksaUJBQWlCO0FBQUEsRUFDbkIsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLHdCQUF3QixPQUFPLFNBQWM7QUFDakQsUUFBTSxFQUFFLFFBQVEsUUFBQUMsUUFBTyxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQzFDLFFBQU0sT0FBTyxZQUFZLGdCQUFnQkEsT0FBTTtBQUMvQyxNQUFJLFFBQVEsS0FBSyxXQUFXLFFBQVE7QUFDbEMsVUFBTSxZQUFZLGtCQUFrQixRQUFRQSxPQUFNO0FBQ2xELGVBQVcsS0FBSyxZQUFZLGdCQUFnQixNQUFNLEdBQUc7QUFDbkQsY0FBUSxpQ0FBaUMsRUFBRSxRQUFRLEtBQUssVUFBVTtBQUFBLFFBQ2hFO0FBQUEsUUFDQSxjQUFjLFlBQVksZ0JBQWdCLE1BQU07QUFBQSxNQUNsRCxDQUFDLENBQUM7QUFBQSxJQUNKO0FBQUEsRUFDRjtBQUNGLENBQUM7QUFFRCxHQUFHLGtCQUFrQixPQUFPLGFBQXFCO0FBQy9DLE1BQUksYUFBYSx1QkFBdUIsR0FBRztBQUN6QyxlQUFXLFFBQVEsWUFBWSxZQUFZLEdBQUc7QUFDNUMsaUJBQVcsZUFBZSxLQUFLLGFBQWEsT0FBTyxHQUFHO0FBQ3BELGdCQUFRLFdBQVcsRUFBRSxjQUFjLFlBQVksUUFBUSxDQUFDO0FBQUEsTUFDMUQ7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7QUFFRCxNQUFNLGlCQUFpQixPQUFPQSxZQUFtQjtBQUMvQyxRQUFNLE9BQU8sWUFBWSxnQkFBZ0JBLE9BQU07QUFDL0MsTUFBSSxNQUFNO0FBQ1IsVUFBTSxZQUFZLGtCQUFrQixLQUFLLFFBQVFBLE9BQU07QUFDdkQsZUFBVyxLQUFLLFlBQVksZ0JBQWdCLEtBQUssTUFBTSxHQUFHO0FBQ3hELGNBQVEsaUNBQWlDLEVBQUUsUUFBUSxLQUFLLFVBQVU7QUFBQSxRQUNoRSxRQUFRLEtBQUs7QUFBQSxRQUNiLGNBQWMsWUFBWSxnQkFBZ0IsS0FBSyxNQUFNO0FBQUEsTUFDdkQsQ0FBQyxDQUFDO0FBQUEsSUFDSjtBQUFBLEVBQ0Y7QUFDRixDQUFDOzs7QUM3TEQsaUJBQWlCLHFCQUFxQixPQUFPQyxTQUFnQixTQUFpQjtBQUM1RSxRQUFNLFlBQVksTUFBTSxRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU07QUFDNUUsUUFBTSxRQUFRO0FBQUEsSUFDWixLQUFLLGFBQWE7QUFBQSxJQUNsQjtBQUFBLElBQ0EsTUFBTTtBQUFBLElBQ04sT0FBTSxvQkFBSSxLQUFLLEdBQUUsWUFBWSxFQUFFLFFBQVEsS0FBSyxHQUFHLEVBQUUsUUFBUSxLQUFLLEVBQUU7QUFBQSxFQUNsRTtBQUNBLFFBQU0sTUFBTSxNQUFNLFFBQVEsVUFBVSxnQkFBZ0IsS0FBSztBQUN6RCxTQUFPLE9BQU87QUFBQSxJQUNaLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsa0JBQWtCLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBY0EsT0FBTSxDQUFDLE1BQU0sU0FBUyxXQUFXLElBQUk7QUFBQSxJQUN2RyxpQkFBaUI7QUFBQSxFQUNuQixDQUFDO0FBQ0QsU0FBTyxLQUFLLFVBQVUsS0FBSztBQUM3QixDQUFDO0FBRUQsaUJBQWlCLGFBQWEsT0FBT0EsWUFBbUI7QUFDdEQsUUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFFBQU0sU0FBUyxNQUFNLFFBQVEsU0FBUyxnQkFBZ0IsRUFBRSxVQUFVLENBQUM7QUFDbkUsU0FBTyxLQUFLLFVBQVUsTUFBTTtBQUM5QixDQUFDO0FBRUQsaUJBQWlCLGVBQWUsT0FBT0EsU0FBZ0IsU0FBaUI7QUFDdEUsUUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFFBQU0sTUFBTSxNQUFNLFFBQVEsUUFBUSxnQkFBZ0IsRUFBRSxLQUFLLEtBQUssQ0FBQztBQUMvRCxRQUFNLFFBQVEsVUFBVSxnQkFBZ0IsRUFBRSxLQUFLLE1BQU0sVUFBVSxDQUFDO0FBQ2hFLFNBQU8sT0FBTztBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxvQkFBb0IsTUFBTSxRQUFRLFNBQVMsRUFBRSxjQUFjQSxPQUFNLENBQUMsTUFBTSxTQUFTLFdBQVcsSUFBSSxJQUFJO0FBQUEsSUFDN0csaUJBQWlCO0FBQUEsRUFDbkIsQ0FBQztBQUNELFNBQU87QUFDVCxDQUFDOzs7QUNsQ0QsaUJBQWlCLHVCQUF1QixPQUFPLFFBQVEsU0FBaUI7QUFDcEUsUUFBTTtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0osSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUVuQixRQUFNLFdBQVcsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsYUFBYSxDQUFDO0FBQ3pFLE1BQUksVUFBVTtBQUNWLFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyxvREFBb0QsWUFBWSxnQkFBZ0IsUUFBUSxTQUFTLEVBQUUsY0FBYyxNQUFNLENBQUM7QUFBQSxNQUNqSSxpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQ0QsV0FBTyxRQUFRLHlCQUF5QixRQUFRLEtBQUssVUFBVTtBQUFBLE1BQzNELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWEsc0JBQXNCLFlBQVk7QUFBQSxNQUMvQyxLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDYixDQUFDLENBQUM7QUFBQSxFQUNOO0FBRUEsTUFBSSx1QkFBdUI7QUFDdkIsVUFBTSxRQUFRLFVBQVUsY0FBYztBQUFBLE1BQ2xDLEtBQUs7QUFBQSxNQUNMLGNBQWM7QUFBQSxNQUNkLFVBQVU7QUFBQSxNQUNWLG9CQUFvQjtBQUFBLE1BQ3BCLFFBQVE7QUFBQSxNQUNSLFVBQVUsQ0FBQztBQUFBLElBQ2YsQ0FBQztBQUFBLEVBQ0w7QUFFQSxRQUFNLFFBQVEsVUFBVSxrQkFBa0I7QUFBQSxJQUN0QztBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNKLENBQUM7QUFDRCxTQUFPLE9BQU87QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsaUJBQWlCLFlBQVksMkJBQTJCLFFBQVEsU0FBUyxFQUFFLGNBQWMsTUFBTSxDQUFDO0FBQUEsSUFDekcsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNMLENBQUM7QUFFRCxpQkFBaUIsbUJBQW1CLE9BQU8sUUFBUSxTQUFpQjtBQUNoRSxRQUFNLFdBQVcsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsY0FBYyxLQUFLLENBQUM7QUFDL0UsU0FBTyxLQUFLLFVBQVUsUUFBUTtBQUNsQyxDQUFDO0FBQ0QsaUJBQWlCLHNCQUFzQixPQUFPLFFBQVEsU0FBaUI7QUFDbkUsUUFBTSxhQUFhLE1BQU0sUUFBUSxTQUFTLGtCQUFrQixDQUFDLENBQUM7QUFDOUQsTUFBSSxhQUFhLENBQUM7QUFDbEIsTUFBSSxjQUFjLENBQUM7QUFDbkIsYUFBVyxZQUFZLFlBQVk7QUFDL0IsVUFBTSxXQUFXLFlBQVksR0FBRyxTQUFTLEdBQUcsUUFBUTtBQUNwRCxRQUFJLFVBQVU7QUFDVixpQkFBVyxLQUFLLFFBQVE7QUFBQSxJQUM1QixPQUFPO0FBQ0gsa0JBQVksS0FBSyxRQUFRO0FBQUEsSUFDN0I7QUFBQSxFQUNKO0FBQ0EsU0FBTyxLQUFLLFVBQVUsRUFBRSxRQUFRLFlBQVksU0FBUyxZQUFZLENBQUM7QUFDdEUsQ0FBQztBQUVELGlCQUFpQixvQkFBb0IsT0FBTyxXQUFXO0FBQ25ELFFBQU0sYUFBYSxNQUFNLFFBQVEsU0FBUyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzlELFNBQU8sS0FBSyxVQUFVLFdBQVcsSUFBSSxDQUFDLGFBQWtCLFNBQVMsWUFBWSxDQUFDO0FBQ2xGLENBQUM7QUFFRCxpQkFBaUIsa0JBQWtCLE9BQU8sUUFBUSxTQUFpQjtBQUMvRCxRQUFNO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDSixJQUFJLEtBQUssTUFBTSxJQUFJO0FBQ25CLFFBQU0sV0FBVyxNQUFNLFFBQVEsUUFBUSxrQkFBa0IsRUFBRSxjQUFjLGlCQUFpQixDQUFDO0FBQzNGLE1BQUksQ0FBQyxVQUFVO0FBQ1gsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLDRDQUE0QyxnQkFBZ0IsZ0JBQWdCLFFBQVEsU0FBUyxFQUFFLGNBQWMsTUFBTSxDQUFDO0FBQUEsTUFDN0gsaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU8sUUFBUSx5QkFBeUIsUUFBUSxLQUFLLFVBQVU7QUFBQSxNQUMzRCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhLHNCQUFzQixZQUFZO0FBQUEsTUFDL0MsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQUEsRUFDTjtBQUVBLFFBQU0sUUFBUSxVQUFVLGtCQUFrQixFQUFFLGNBQWMsaUJBQWlCLEdBQUc7QUFBQSxJQUMxRTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUNKLENBQUM7QUFDRCxTQUFPLE9BQU87QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsYUFBYSxnQkFBZ0Isd0JBQXdCLFFBQVEsU0FBUyxFQUFFLGNBQWMsTUFBTSxDQUFDO0FBQUEsSUFDdEcsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNMLENBQUM7QUFFRCxpQkFBaUIsa0JBQWtCLE9BQU8sUUFBUSxTQUFpQjtBQUMvRCxRQUFNLFdBQVcsTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsY0FBYyxLQUFLLENBQUM7QUFDL0UsTUFBSSxDQUFDLFVBQVU7QUFDWCxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsNENBQTRDLElBQUksZ0JBQWdCLFFBQVEsU0FBUyxFQUFFLGNBQWMsTUFBTSxDQUFDO0FBQUEsTUFDakgsaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU8sUUFBUSx5QkFBeUIsUUFBUSxLQUFLLFVBQVU7QUFBQSxNQUMzRCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhLHNCQUFzQixJQUFJO0FBQUEsTUFDdkMsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQUEsRUFDTjtBQUVBLFFBQU0sUUFBUSxVQUFVLGtCQUFrQixFQUFFLGNBQWMsS0FBSyxDQUFDO0FBQ2hFLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxhQUFhLElBQUksd0JBQXdCLFFBQVEsU0FBUyxFQUFFLGNBQWMsTUFBTSxDQUFDO0FBQUEsSUFDMUYsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNMLENBQUM7QUFFRCxpQkFBaUIsc0NBQXNDLE9BQU8sV0FBVztBQUNyRSxRQUFNLFNBQVMsTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNO0FBQUU7QUFDbEYsUUFBTSxhQUFhLE1BQU0sUUFBUSxRQUFRLHdCQUF3QixFQUFFLFdBQVcsT0FBTyxDQUFDO0FBQ3RGLE1BQUksQ0FBQyxZQUFZO0FBQ2IsVUFBTSxRQUFRLFVBQVUsd0JBQXdCLEVBQUUsV0FBVyxRQUFRLFVBQVUsS0FBSyxDQUFDO0FBQ3JGLFdBQU87QUFBQSxFQUNYO0FBQUM7QUFDRCxRQUFNLFFBQVEsVUFBVSx3QkFBd0IsRUFBRSxXQUFXLE9BQU8sR0FBRyxFQUFFLFVBQVUsQ0FBQyxXQUFXLFNBQVMsQ0FBQztBQUN6RyxTQUFPLENBQUMsV0FBVztBQUN2QixDQUFDO0FBRUQsaUJBQWlCLG1DQUFtQyxPQUFPLFdBQVc7QUFDbEUsUUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUNoRixRQUFNLGFBQWEsTUFBTSxRQUFRLFFBQVEsd0JBQXdCLEVBQUUsV0FBVyxPQUFPLENBQUM7QUFDdEYsTUFBSSxDQUFDLFlBQVk7QUFDYixVQUFNLFFBQVEsVUFBVSx3QkFBd0IsRUFBRSxXQUFXLFFBQVEsVUFBVSxLQUFLLENBQUM7QUFDckYsV0FBTztBQUFBLEVBQ1g7QUFBQztBQUNELFNBQU8sV0FBVztBQUN0QixDQUFDO0FBRUQsaUJBQWlCLG9DQUFvQyxPQUFPLFFBQWdCLFNBQWlCO0FBQ3pGLFFBQU0sRUFBRSxPQUFPLElBQUksS0FBSyxNQUFNLElBQUk7QUFDbEMsUUFBTSxZQUFZLE1BQU0sTUFBTSwwQkFBMEIsTUFBTTtBQUM5RCxRQUFNLGlCQUFpQixNQUFNLE1BQU0sdUJBQXVCLE1BQU07QUFDaEUsTUFBSSxPQUFPLGNBQWMsTUFBTSxPQUFPLE1BQU0sR0FBRztBQUMzQyxXQUFPLFFBQVEseUJBQXlCLFFBQVEsS0FBSyxVQUFVO0FBQUEsTUFDM0QsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYSwyQkFBMkIsY0FBYztBQUFBLE1BQ3RELEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUFBLEVBQ047QUFDQSxNQUFJLENBQUMsV0FBVztBQUNaLFdBQU8sUUFBUSx5QkFBeUIsUUFBUSxLQUFLLFVBQVU7QUFBQSxNQUMzRCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDYixDQUFDLENBQUM7QUFBQSxFQUNOO0FBQ0EsUUFBTSxhQUFhLE1BQU0sUUFBUSxRQUFRLHdCQUF3QixFQUFFLFVBQXFCLENBQUM7QUFDekYsTUFBSSxjQUFjLENBQUMsV0FBVyxVQUFVO0FBQ3BDLFdBQU8sUUFBUSx5QkFBeUIsUUFBUSxLQUFLLFVBQVU7QUFBQSxNQUMzRCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhO0FBQUEsTUFDYixLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDYixDQUFDLENBQUM7QUFBQSxFQUNOLFdBQVcsY0FBYyxXQUFXLFVBQVU7QUFDMUMsVUFBTSxzQkFBc0Isb0NBQW9DLFFBQVEsTUFBTTtBQUFBLEVBQ2xGO0FBQ0osQ0FBQztBQUVELGlCQUFpQixzQ0FBc0MsT0FBTyxRQUFRLFlBQVk7QUFDOUUsUUFBTSxVQUFVLE1BQU0sUUFBUSxpQkFBaUIsRUFBRSxnQkFBZ0IsT0FBTztBQUN4RSxTQUFPO0FBQ1gsQ0FBQztBQUVELGlCQUFpQixvQ0FBb0MsT0FBTyxRQUFRLFdBQW1CO0FBRW5GLFFBQU0sTUFBTTtBQUNaLFFBQU0sU0FBUyxNQUFNLFFBQVEsU0FBUyxFQUFFLFVBQVUsR0FBRztBQUNyRCxRQUFNLFdBQVcsTUFBTSxRQUFRLFNBQVMsRUFBRSxjQUFjLEdBQUc7QUFDM0QsUUFBTSxNQUFNLE9BQU8sV0FBVztBQUM5QixRQUFNLFlBQVksT0FBTyxXQUFXO0FBQ3BDLFFBQU0sVUFBVSxVQUFVO0FBQzFCLFFBQU0sY0FBYyxNQUFNLE9BQU8sV0FBVyxNQUFNO0FBQ2xELE1BQUksY0FBYyxRQUFRO0FBQ3RCLFdBQU87QUFBQSxFQUNYO0FBQ0EsUUFBTSxPQUFPLFVBQVUsWUFBWSxRQUFRLFFBQVEsNkJBQTZCO0FBQ2hGLFFBQU0sUUFBUSxpQkFBaUIsRUFBRSxnQkFBZ0IsU0FBUyxNQUFNO0FBQ2hFLFFBQU0sUUFBUSxpQkFBaUIsRUFBRSxrQkFBa0IsS0FBSywrQkFBK0IsUUFBUSxpQkFBaUIsVUFBVSxLQUFLLElBQUksU0FBUyxVQUFVLFlBQVksYUFBYSxDQUFDO0FBQ2hMLFFBQU0sUUFBUSxpQkFBaUIsRUFBRSxrQkFBa0IsU0FBUyw4QkFBOEIsUUFBUSxXQUFXLFVBQVUsU0FBUyxXQUFXLGFBQWEsQ0FBQztBQUV6SixTQUFPLE9BQU87QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsVUFBVSxRQUFRLGVBQWUsTUFBTSxlQUFlLE9BQU87QUFBQSxJQUN0RSxpQkFBaUI7QUFBQSxFQUNyQixDQUFDO0FBQ0QsU0FBTztBQUNYLENBQUM7QUFFRCxpQkFBaUIscUNBQXFDLE9BQU8sUUFBUSxXQUFtQjtBQUNwRixRQUFNLE1BQU07QUFDWixRQUFNLFNBQVMsTUFBTSxRQUFRLFNBQVMsRUFBRSxVQUFVLEdBQUc7QUFDckQsUUFBTSxXQUFXLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBYyxHQUFHO0FBQzNELFFBQU0sTUFBTSxPQUFPLFdBQVc7QUFDOUIsUUFBTSxZQUFZLE9BQU8sV0FBVztBQUNwQyxRQUFNLFVBQVUsVUFBVTtBQUMxQixRQUFNLFVBQVUsTUFBTSxRQUFRLGlCQUFpQixFQUFFLGdCQUFnQixPQUFPO0FBQ3hFLE1BQUksVUFBVSxRQUFRO0FBQ2xCLFdBQU87QUFBQSxFQUNYO0FBQ0EsUUFBTSxPQUFPLFVBQVUsU0FBUyxRQUFRLFFBQVEsOEJBQThCO0FBQzlFLFFBQU0sUUFBUSxpQkFBaUIsRUFBRSxtQkFBbUIsU0FBUyxNQUFNO0FBQ25FLFFBQU0sUUFBUSxpQkFBaUIsRUFBRSxrQkFBa0IsS0FBSywrQkFBK0IsUUFBUSx1QkFBdUIsVUFBVSxLQUFLLElBQUksU0FBUyxVQUFVLFdBQVcsYUFBYSxDQUFDO0FBQ3JMLFFBQU0sUUFBUSxpQkFBaUIsRUFBRSxrQkFBa0IsU0FBUywrQkFBK0IsUUFBUSxZQUFZLFNBQVMsVUFBVSxZQUFZLGFBQWEsQ0FBQztBQUU1SixTQUFPLE9BQU87QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsVUFBVSxRQUFRLGNBQWMsTUFBTSxpQkFBaUIsT0FBTztBQUFBLElBQ3ZFLGlCQUFpQjtBQUFBLEVBQ3JCLENBQUM7QUFDRCxTQUFPO0FBQ1gsQ0FBQztBQUVELGlCQUFpQixvQ0FBb0MsT0FBTyxRQUFRLFNBQWlCO0FBQ2pGLFFBQU0sTUFBTTtBQUNaLFFBQU0sVUFBVTtBQUNoQixRQUFNLFNBQVMsTUFBTSxRQUFRLFNBQVMsRUFBRSxVQUFVLEdBQUc7QUFDckQsUUFBTSxTQUFTLE9BQU8sV0FBVyxJQUFJO0FBTXJDLFFBQU0sVUFBZSxNQUFNLE1BQU0sTUFBTSxpRUFBaUUsQ0FBQyxJQUFJLE9BQU8sR0FBRyxDQUFDO0FBQ3hILFFBQU0sWUFBaUIsQ0FBQztBQUV4QixhQUFXQyxTQUFRLFNBQVM7QUFDeEIsUUFBSSxXQUFXLEVBQUUsV0FBVyxXQUFXLFVBQVUsU0FBUztBQUMxRCxRQUFJLFVBQVUsRUFBRSxNQUFNLFdBQVcsT0FBTyxHQUFHLFFBQVEsTUFBTTtBQUV6RCxRQUFJO0FBQ0EsVUFBSUEsTUFBSyxTQUFVLFlBQVcsS0FBSyxNQUFNQSxNQUFLLFFBQVE7QUFDdEQsVUFBSUEsTUFBSyxJQUFLLFdBQVUsS0FBSyxNQUFNQSxNQUFLLEdBQUc7QUFBQSxJQUMvQyxTQUFTLEdBQUc7QUFDUixhQUFPLHVCQUF1QixPQUFPLHFCQUFxQkEsTUFBSyxTQUFTLEVBQUU7QUFDMUU7QUFBQSxJQUNKO0FBRUEsVUFBTSxXQUFXLE1BQU0sUUFBUSxTQUFTLEVBQUUscUJBQXFCQSxNQUFLLFNBQVM7QUFDN0UsUUFBSSxZQUFZLFNBQVMsV0FBVyxJQUFJLFNBQVMsU0FBUztBQUN0RCxnQkFBVSxLQUFLO0FBQUEsUUFDWCxXQUFXLFNBQVMsV0FBVztBQUFBLFFBQy9CLFFBQVEsU0FBUyxXQUFXLElBQUk7QUFBQSxRQUNoQyxPQUFPLFNBQVMsV0FBVyxJQUFJO0FBQUEsUUFDL0IsUUFBUSxTQUFTLFdBQVcsSUFBSTtBQUFBLFFBQ2hDLE1BQU0sR0FBRyxTQUFTLFdBQVcsU0FBUyxTQUFTLElBQUksU0FBUyxXQUFXLFNBQVMsUUFBUTtBQUFBLFFBQ3hGLFFBQVE7QUFBQSxNQUNaLENBQUM7QUFBQSxJQUNMLE9BQU87QUFDSCxnQkFBVSxLQUFLO0FBQUEsUUFDWCxXQUFXQSxNQUFLO0FBQUEsUUFDaEIsUUFBUSxRQUFRO0FBQUEsUUFDaEIsT0FBTyxRQUFRO0FBQUEsUUFDZixRQUFRLFFBQVE7QUFBQSxRQUNoQixNQUFNLEdBQUcsU0FBUyxTQUFTLElBQUksU0FBUyxRQUFRO0FBQUEsUUFDaEQsUUFBUTtBQUFBLE1BQ1osQ0FBQztBQUFBLElBQ0w7QUFBQSxFQUNKO0FBQ0EsWUFBVSxLQUFLLENBQUMsR0FBUSxPQUFZLEVBQUUsTUFBTSxTQUFTLE1BQU0sRUFBRSxNQUFNLFNBQVMsRUFBRTtBQUU5RSxRQUFNLG9CQUEyQixDQUFDO0FBQ2xDLE1BQUk7QUFDQSxVQUFNLGtCQUEwQixNQUFNLFFBQVEsU0FBUyxtQkFBbUIsRUFBRSxTQUFTLFFBQVEsQ0FBQyxLQUFNLENBQUM7QUFFckcsZUFBVyxZQUFZLGlCQUFpQjtBQUNwQyxVQUFJLENBQUMsU0FBUyxXQUFXO0FBQ3JCLGdCQUFRLEtBQUssb0NBQW9DLFFBQVE7QUFDekQ7QUFBQSxNQUNKO0FBRUEsWUFBTSxXQUFXLE1BQU0sUUFBUSxTQUFTLEVBQUUscUJBQXFCLFNBQVMsU0FBUztBQUNqRixVQUFJLENBQUMsVUFBVTtBQUNYLGNBQU0sYUFBa0IsTUFBTSxNQUFNLE1BQU0seURBQXlELENBQUMsU0FBUyxTQUFTLENBQUM7QUFDdkgsWUFBSSxDQUFDLGNBQWMsV0FBVyxXQUFXLEdBQUc7QUFDeEMsa0JBQVEsS0FBSyw4Q0FBOEMsU0FBUyxTQUFTLEVBQUU7QUFDL0U7QUFBQSxRQUNKO0FBRUEsbUJBQVdBLFNBQVEsWUFBWTtBQUMzQixjQUFJLFNBQVM7QUFDYixjQUFJO0FBQ0Esc0JBQVVBLE1BQUssTUFBTSxLQUFLLE1BQU1BLE1BQUssR0FBRyxJQUFJLEVBQUUsTUFBTSxXQUFXLE9BQU8sR0FBRyxRQUFRLE1BQU07QUFDdkYsdUJBQVdBLE1BQUssV0FBVyxLQUFLLE1BQU1BLE1BQUssUUFBUSxJQUFJLEVBQUUsV0FBVyxXQUFXLFVBQVUsU0FBUztBQUFBLFVBQ3RHLFNBQVMsR0FBRztBQUNSLG9CQUFRLE1BQU0sb0NBQW9DLFNBQVMsU0FBUyxLQUFLLENBQUM7QUFDMUU7QUFBQSxVQUNKO0FBQ0EsY0FBSSxRQUFRLFNBQVMsUUFBUztBQUM5Qiw0QkFBa0IsS0FBSztBQUFBLFlBQ25CLFdBQVcsU0FBUztBQUFBLFlBQ3BCLFFBQVEsUUFBUTtBQUFBLFlBQ2hCLE9BQU8sUUFBUTtBQUFBLFlBQ2YsUUFBUSxRQUFRO0FBQUEsWUFDaEIsTUFBTSxHQUFHLFNBQVMsU0FBUyxJQUFJLFNBQVMsUUFBUTtBQUFBLFlBQ2hELFFBQVE7QUFBQSxVQUNaLENBQUM7QUFBQSxRQUNMO0FBQUEsTUFDSixPQUFPO0FBQ0gsWUFBSSxTQUFTLFdBQVcsSUFBSSxTQUFTLFFBQVM7QUFDOUMsMEJBQWtCLEtBQUs7QUFBQSxVQUNuQixXQUFXLFNBQVMsV0FBVztBQUFBLFVBQy9CLFFBQVEsU0FBUyxXQUFXLElBQUk7QUFBQSxVQUNoQyxPQUFPLFNBQVMsV0FBVyxJQUFJO0FBQUEsVUFDL0IsUUFBUSxTQUFTLFdBQVcsSUFBSTtBQUFBLFVBQ2hDLE1BQU0sR0FBRyxTQUFTLFdBQVcsU0FBUyxTQUFTLElBQUksU0FBUyxXQUFXLFNBQVMsUUFBUTtBQUFBLFVBQ3hGLFFBQVE7QUFBQSxRQUNaLENBQUM7QUFBQSxNQUNMO0FBQUEsSUFDSjtBQUNBLHNCQUFrQixLQUFLLENBQUMsR0FBRyxPQUFPLEVBQUUsU0FBUyxNQUFNLEVBQUUsU0FBUyxFQUFFO0FBQUEsRUFDcEUsU0FBUyxLQUFLO0FBQ1YsWUFBUSxNQUFNLHdDQUF3QyxHQUFHO0FBQUEsRUFDN0Q7QUFFQSxTQUFPLEtBQUssVUFBVTtBQUFBLElBQ2xCLFdBQVcsVUFBVSxTQUFTLElBQUksWUFBWSxDQUFDO0FBQUEsSUFDL0MsbUJBQW1CLGtCQUFrQixTQUFTLElBQUksb0JBQW9CLENBQUM7QUFBQSxFQUMzRSxDQUFDO0FBQ0wsQ0FBQztBQUdELGlCQUFpQixvQ0FBb0MsT0FBTyxRQUFRLGNBQXNCLFlBQW9CO0FBQzFHLE1BQUksT0FBTyxNQUFNLE1BQU0sT0FBTyxZQUFZLEdBQUc7QUFDekMsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLDhCQUE4QixRQUFRLFNBQVMsRUFBRSxjQUFjLE1BQU0sQ0FBQyxhQUFhLE9BQU87QUFBQSxNQUNuRyxpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQ0QsV0FBTyxRQUFRLHlCQUF5QixRQUFRLEtBQUssVUFBVTtBQUFBLE1BQzNELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUFBLEVBQ047QUFDQSxNQUFJLE1BQU0sZ0JBQWdCLFlBQVksR0FBRztBQUNyQyxVQUFNLFNBQVMsTUFBTSxRQUFRLFNBQVMsRUFBRSxVQUFVLE1BQU07QUFDeEQsUUFBSSxDQUFDLE9BQU8sV0FBVyxJQUFJLFFBQVE7QUFDL0IsYUFBTyxPQUFPO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxTQUFTLDhDQUE4QyxRQUFRLFNBQVMsRUFBRSxjQUFjLE1BQU0sQ0FBQyxhQUFhLE9BQU8sZ0JBQWdCLE9BQU8sV0FBVyxTQUFTO0FBQUEsUUFDOUosaUJBQWlCO0FBQUEsTUFDckIsQ0FBQztBQUNELGFBQU8sUUFBUSx5QkFBeUIsUUFBUSxLQUFLLFVBQVU7QUFBQSxRQUMzRCxJQUFJLGFBQWE7QUFBQSxRQUNqQixPQUFPO0FBQUEsUUFDUCxhQUFhO0FBQUEsUUFDYixLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsTUFDYixDQUFDLENBQUM7QUFBQSxJQUNOO0FBQ0EsVUFBTSxlQUFlLE1BQU0sUUFBUSxTQUFTLEVBQUUsVUFBVSxZQUFZO0FBQ3BFLGlCQUFhLFVBQVUsT0FBTyxTQUFTLENBQUM7QUFDeEMsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLFVBQVUsYUFBYSxXQUFXLFNBQVMsVUFBVSxhQUFhLFdBQVcsU0FBUyxTQUFTLElBQUksYUFBYSxXQUFXLFNBQVMsUUFBUSxxQkFBcUIsUUFBUSxTQUFTLEVBQUUsY0FBYyxNQUFNLENBQUMsYUFBYSxPQUFPO0FBQUEsTUFDdE8saUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFlBQVEseUJBQXlCLFFBQVEsS0FBSyxVQUFVO0FBQUEsTUFDcEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYSxrQkFBa0IsYUFBYSxXQUFXLFNBQVMsU0FBUyxJQUFJLGFBQWEsV0FBVyxTQUFTLFFBQVEsT0FBTyxPQUFPO0FBQUEsTUFDcEksS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQ0YsWUFBUSx5QkFBeUIsY0FBYyxLQUFLLFVBQVU7QUFBQSxNQUMxRCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhLDBCQUEwQixPQUFPO0FBQUEsTUFDOUMsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQ0YsU0FBSyxzQ0FBc0MsY0FBYyxTQUFTLEdBQUcsVUFBVSxPQUFPLEtBQUssT0FBTyxFQUFFLE9BQU8sVUFBVSxPQUFPLEtBQUssT0FBTyxFQUFFLE9BQU8sR0FBRyxFQUFFLEtBQUs7QUFDM0osWUFBUSxzQ0FBc0MsUUFBUSxPQUFPO0FBQUEsRUFDakUsT0FBTztBQUNILFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyw2Q0FBNkMsUUFBUSxTQUFTLEVBQUUsY0FBYyxNQUFNLENBQUMsYUFBYSxPQUFPO0FBQUEsTUFDbEgsaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFlBQVEseUJBQXlCLFFBQVEsS0FBSyxVQUFVO0FBQUEsTUFDcEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQUEsRUFDTjtBQUNKLENBQUM7QUFFRCxpQkFBaUIscUJBQXFCLE9BQU8sV0FBVztBQUNwRCxRQUFNLE9BQU8sTUFBTSxRQUFRLFNBQVMsZUFBZSxDQUFDLENBQUM7QUFDckQsU0FBTyxLQUFLLFVBQVUsS0FBSyxJQUFJLENBQUMsUUFBYSxJQUFJLEdBQUcsQ0FBQztBQUN6RCxDQUFDO0FBRUQsaUJBQWlCLGdCQUFnQixPQUFPLFFBQVEsU0FBaUI7QUFDN0QsUUFBTSxPQUFPLEtBQUssTUFBTSxJQUFJO0FBQzVCLFFBQU0sUUFBUSxVQUFVLGVBQWUsSUFBSTtBQUMzQyxRQUFNLEVBQUUsS0FBSyxHQUFHLEtBQUssSUFBSTtBQUN6QixVQUFRLFNBQVMsRUFBRSxPQUFPLEtBQUssSUFBSTtBQUNuQyxTQUFPLE9BQU87QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsWUFBWSxHQUFHLFdBQVcsS0FBSyxPQUFPLDBCQUEwQixRQUFRLFNBQVMsRUFBRSxjQUFjLE1BQU0sQ0FBQztBQUFBLElBQ2pILGlCQUFpQjtBQUFBLEVBQ3JCLENBQUM7QUFDTCxDQUFDO0FBRUQsaUJBQWlCLGNBQWMsT0FBTyxRQUFRLFNBQWlCO0FBQzNELFFBQU0sTUFBTSxNQUFNLFFBQVEsUUFBUSxlQUFlLEVBQUUsS0FBSyxLQUFLLENBQUM7QUFDOUQsU0FBTyxLQUFLLFVBQVUsR0FBRztBQUM3QixDQUFDO0FBRUQsaUJBQWlCLGNBQWMsT0FBTyxRQUFRLFNBQWlCO0FBQzNELFFBQU0sT0FBTyxLQUFLLE1BQU0sSUFBSTtBQUM1QixRQUFNLFFBQVEsVUFBVSxlQUFlLEVBQUUsS0FBSyxLQUFLLElBQUksR0FBRyxJQUFJO0FBQzlELFFBQU0sRUFBRSxLQUFLLEdBQUcsS0FBSyxJQUFJO0FBQ3pCLFVBQVEsU0FBUyxFQUFFLFVBQVUsS0FBSyxJQUFJO0FBQ3RDLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxRQUFRLEdBQUcsV0FBVyxLQUFLLE9BQU8sdUJBQXVCLFFBQVEsU0FBUyxFQUFFLGNBQWMsTUFBTSxDQUFDO0FBQUEsSUFDMUcsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNMLENBQUM7QUFFRCxpQkFBaUIsY0FBYyxPQUFPLFFBQVEsU0FBaUI7QUFDM0QsUUFBTSxNQUFNLE1BQU0sUUFBUSxRQUFRLGVBQWUsRUFBRSxLQUFLLEtBQUssQ0FBQztBQUM5RCxNQUFJLENBQUMsS0FBSztBQUNOLFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyx1Q0FBdUMsSUFBSSxnQkFBZ0IsUUFBUSxTQUFTLEVBQUUsY0FBYyxNQUFNLENBQUM7QUFBQSxNQUM1RyxpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQ0QsV0FBTyxRQUFRLHlCQUF5QixRQUFRLEtBQUssVUFBVTtBQUFBLE1BQzNELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUFBLEVBQ047QUFDQSxRQUFNLFFBQVEsVUFBVSxlQUFlLEVBQUUsS0FBSyxLQUFLLENBQUM7QUFDcEQsVUFBUSxTQUFTLEVBQUUsVUFBVSxJQUFJO0FBQ2pDLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxRQUFRLElBQUksV0FBVyxJQUFJLE9BQU8sdUJBQXVCLFFBQVEsU0FBUyxFQUFFLGNBQWMsTUFBTSxDQUFDO0FBQUEsSUFDMUcsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNMLENBQUM7QUFFRCxpQkFBaUIsbURBQW1ELE9BQU8sUUFBZ0IsUUFBZ0I7QUFDdkcsUUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLFVBQVUsVUFBVSxpQkFBaUIsR0FBRztBQUNoRSxNQUFJLFVBQW9CLENBQUM7QUFDekIsYUFBVyxVQUFVLFNBQVM7QUFDMUIsVUFBTSxTQUFTLE1BQU0sTUFBTSx1QkFBdUIsTUFBTTtBQUN4RCxZQUFRLEtBQUssT0FBTyxNQUFNLENBQUM7QUFBQSxFQUMvQjtBQUNBLFNBQU8sS0FBSyxVQUFVLE9BQU87QUFDakMsQ0FBQzs7O0FDemhCRCxNQUFNLG9DQUFvQyxPQUFPLGNBQXNCO0FBQ25FLFFBQU1DLFVBQVMsT0FBTztBQUN0QixRQUFNLGFBQWEsTUFBTSxRQUFRLFNBQVMsRUFBRSxxQkFBcUIsU0FBUztBQUMxRSxNQUFJLFlBQVk7QUFDWixVQUFNLFVBQVUsV0FBVyxXQUFXLElBQUk7QUFDMUMsVUFBTSxXQUFXLFVBQVUsT0FBTyxjQUFjLENBQUM7QUFDakQsVUFBTSxRQUFRLFVBQVUsbUJBQW1CLEVBQUUsV0FBc0IsU0FBUyxRQUFRLENBQUM7QUFDckYsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDcEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYSxrQkFBa0IsV0FBVyxXQUFXLFNBQVMsU0FBUyxJQUFJLFdBQVcsV0FBVyxTQUFTLFFBQVE7QUFBQSxNQUNsSCxLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRixZQUFRLHlCQUF5QixXQUFXLFdBQVcsUUFBUSxLQUFLLFVBQVU7QUFBQSxNQUMxRSxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhLDBCQUEwQixPQUFPLE1BQU07QUFBQSxNQUNwRCxLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRixZQUFRLHNDQUFzQ0EsU0FBUSxPQUFPO0FBQzdELFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyxHQUFHLFdBQVcsV0FBVyxTQUFTLFNBQVMsSUFBSSxXQUFXLFdBQVcsU0FBUyxRQUFRLHNCQUFzQixNQUFNLFFBQVEsU0FBUyxFQUFFLGNBQWNBLE9BQU0sQ0FBQyxpQkFBaUIsV0FBVyxXQUFXLFNBQVMsV0FBVyxXQUFXLFdBQVcsSUFBSSxJQUFJO0FBQUEsTUFDNVAsaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUFBLEVBQ0wsT0FBTztBQUNILFVBQU0sYUFBa0IsTUFBTSxNQUFNLE1BQU0sdURBQXVELENBQUMsU0FBUyxDQUFDO0FBQzVHLFVBQU0sVUFBVSxLQUFLLE1BQU0sV0FBVyxDQUFDLEVBQUUsR0FBRztBQUU1QyxRQUFJLE1BQVcsQ0FBQztBQUNoQixRQUFJLE9BQU87QUFDWCxRQUFJLFFBQVEsVUFBVSxPQUFPLEtBQUssWUFBWSxFQUFFO0FBQ2hELFFBQUksVUFBVSxVQUFVLE9BQU8sS0FBSyxZQUFZLEVBQUUsT0FBTyxHQUFHLEVBQUU7QUFDOUQsUUFBSSxTQUFTLFVBQVUsT0FBTyxLQUFLLFlBQVksRUFBRTtBQUNqRCxRQUFJLFNBQVM7QUFDYixRQUFJLFFBQVEsQ0FBQztBQUNiLFFBQUksTUFBTSxPQUFPLFVBQVUsT0FBTyxLQUFLLFlBQVksRUFBRSxPQUFPLEdBQUcsRUFBRTtBQUNqRSxRQUFJLE1BQU0sUUFBUTtBQUNsQixVQUFNLE1BQU0sTUFBTSxrREFBa0QsQ0FBQyxLQUFLLFVBQVUsR0FBRyxHQUFHLFNBQVMsQ0FBQztBQUNwRyxVQUFNLFFBQVEsVUFBVSxtQkFBbUIsRUFBRSxXQUFzQixTQUFTLFFBQVEsS0FBSyxDQUFDO0FBQzFGLFlBQVEsc0NBQXNDQSxTQUFRLFFBQVEsSUFBSTtBQUNsRSxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsb0JBQW9CLFNBQVMsc0JBQXNCLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBY0EsT0FBTSxDQUFDLFdBQVcsUUFBUSxJQUFJO0FBQUEsTUFDakksaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUFBLEVBQ0w7QUFDSixDQUFDO0FBRUQsTUFBTSwwQ0FBMEMsT0FBTyxTQUFjO0FBQ2pFLFFBQU1BLFVBQVMsT0FBTztBQUN0QixRQUFNLGFBQWEsTUFBTSxRQUFRLFNBQVMsRUFBRSxxQkFBcUIsS0FBSyxlQUFlO0FBQ3JGLFFBQU0sV0FBVyxNQUFNLFFBQVEsUUFBUSxtQkFBbUIsRUFBRSxXQUFXLEtBQUssaUJBQWlCLFNBQVMsS0FBSyxRQUFRLENBQUM7QUFDcEgsTUFBSSxZQUFZO0FBQ1osVUFBTSxVQUFVLEtBQUs7QUFDckIsZUFBVyxVQUFVLE9BQU8sU0FBUyxLQUFLLEdBQUc7QUFDN0MsWUFBUSx5QkFBeUJBLFNBQVEsS0FBSyxVQUFVO0FBQUEsTUFDcEQsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYSxnQ0FBZ0MsV0FBVyxXQUFXLFNBQVMsU0FBUyxJQUFJLFdBQVcsV0FBVyxTQUFTLFFBQVE7QUFBQSxNQUNoSSxLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRixZQUFRLHlCQUF5QixXQUFXLFdBQVcsUUFBUSxLQUFLLFVBQVU7QUFBQSxNQUMxRSxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhLGlDQUFpQyxNQUFNLFFBQVEsU0FBUyxFQUFFLGNBQWNBLE9BQU0sQ0FBQztBQUFBLE1BQzVGLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUNGLFFBQUksVUFBVTtBQUNWLFlBQU0sUUFBUSxVQUFVLG1CQUFtQixFQUFFLFdBQVcsS0FBSyxpQkFBaUIsU0FBUyxLQUFLLFFBQVEsR0FBRyxFQUFFLFlBQVksS0FBSyxLQUFLLFlBQVksS0FBSyxVQUFVLENBQUM7QUFDM0osYUFBTyxPQUFPO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxTQUFTLEdBQUcsS0FBSyxlQUFlLHdCQUF3QixLQUFLLE9BQU8sZ0JBQWdCLEtBQUssU0FBUyxPQUFPLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBY0EsT0FBTSxDQUFDLGlCQUFpQixRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU0sQ0FBQztBQUFBLFFBQzdOLGlCQUFpQjtBQUFBLE1BQ3JCLENBQUM7QUFBQSxJQUNMLE9BQU87QUFDSCxZQUFNLFFBQVEsVUFBVSxtQkFBbUIsRUFBRSxLQUFLLGFBQWEsR0FBRyxXQUFXLEtBQUssaUJBQWlCLFNBQVMsS0FBSyxTQUFTLFlBQVksS0FBSyxLQUFLLFlBQVksS0FBSyxVQUFVLENBQUM7QUFDNUssYUFBTyxPQUFPO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxTQUFTLEdBQUcsS0FBSyxlQUFlLHNCQUFzQixLQUFLLE9BQU8sZ0JBQWdCLEtBQUssU0FBUyxPQUFPLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBY0EsT0FBTSxDQUFDLGlCQUFpQixRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU0sQ0FBQztBQUFBLFFBQzNOLGlCQUFpQjtBQUFBLE1BQ3JCLENBQUM7QUFBQSxJQUNMO0FBQ0EsWUFBUSxzQ0FBc0NBLFNBQVEsT0FBTztBQUM3RCxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsR0FBRyxXQUFXLFdBQVcsU0FBUyxTQUFTLElBQUksV0FBVyxXQUFXLFNBQVMsUUFBUSxpQ0FBaUMsTUFBTSxRQUFRLFNBQVMsRUFBRSxjQUFjQSxPQUFNLENBQUMsaUJBQWlCLFdBQVcsV0FBVyxTQUFTLFdBQVcsT0FBTyxpQkFBaUIsS0FBSyxTQUFTO0FBQUEsTUFDL1EsaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUFBLEVBQ0wsT0FBTztBQUNILFVBQU0sYUFBa0IsTUFBTSxNQUFNLE1BQU0sdURBQXVELENBQUMsS0FBSyxlQUFlLENBQUM7QUFDdkgsVUFBTSxVQUFVLEtBQUssTUFBTSxXQUFXLENBQUMsRUFBRSxHQUFHO0FBQzVDLFlBQVEsTUFBTSxRQUFRLEtBQUs7QUFDM0IsWUFBUSxNQUFNLE9BQU8sS0FBSztBQUMxQixVQUFNLE1BQU0sTUFBTSxrREFBa0QsQ0FBQyxLQUFLLFVBQVUsT0FBTyxHQUFHLEtBQUssZUFBZSxDQUFDO0FBQ25ILFFBQUksVUFBVTtBQUNWLFlBQU0sUUFBUSxVQUFVLG1CQUFtQixFQUFFLFdBQVcsS0FBSyxpQkFBaUIsU0FBUyxLQUFLLFFBQVEsR0FBRyxFQUFFLFlBQVksS0FBSyxLQUFLLFlBQVksS0FBSyxVQUFVLENBQUM7QUFDM0osYUFBTyxPQUFPO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxTQUFTLEdBQUcsS0FBSyxlQUFlLHdCQUF3QixLQUFLLE9BQU8sZ0JBQWdCLEtBQUssU0FBUyxPQUFPLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBY0EsT0FBTSxDQUFDLGlCQUFpQixRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU0sQ0FBQztBQUFBLFFBQzdOLGlCQUFpQjtBQUFBLE1BQ3JCLENBQUM7QUFBQSxJQUNMLE9BQU87QUFDSCxZQUFNLFFBQVEsVUFBVSxtQkFBbUIsRUFBRSxLQUFLLGFBQWEsR0FBRyxXQUFXLEtBQUssaUJBQWlCLFNBQVMsS0FBSyxTQUFTLFlBQVksS0FBSyxLQUFLLFlBQVksS0FBSyxVQUFVLENBQUM7QUFDNUssYUFBTyxPQUFPO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxTQUFTLEdBQUcsS0FBSyxlQUFlLHNCQUFzQixLQUFLLE9BQU8sZ0JBQWdCLEtBQUssU0FBUyxPQUFPLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBY0EsT0FBTSxDQUFDLGlCQUFpQixRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU0sQ0FBQztBQUFBLFFBQzNOLGlCQUFpQjtBQUFBLE1BQ3JCLENBQUM7QUFBQSxJQUNMO0FBQ0EsWUFBUSxzQ0FBc0NBLFNBQVEsUUFBUSxJQUFJO0FBQUEsRUFDdEU7QUFDSixDQUFDO0FBRUQsTUFBTSw0Q0FBNEMsT0FBTyxTQUFpRDtBQUN0RyxRQUFNQSxVQUFTLE9BQU87QUFDdEIsUUFBTSxRQUFRLFVBQVUsbUJBQW1CLEVBQUUsV0FBVyxLQUFLLFdBQVcsU0FBUyxLQUFLLFFBQVEsQ0FBQztBQUMvRixVQUFRLHlCQUF5QkEsU0FBUSxLQUFLLFVBQVU7QUFBQSxJQUNwRCxJQUFJLGFBQWE7QUFBQSxJQUNqQixPQUFPO0FBQUEsSUFDUCxhQUFhO0FBQUEsSUFDYixLQUFLO0FBQUEsSUFDTCxTQUFTO0FBQUEsRUFDYixDQUFDLENBQUM7QUFDRixVQUFRLHNDQUFzQ0EsU0FBUSxLQUFLLE9BQU87QUFDbEUsU0FBTyxPQUFPO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLHFCQUFxQixLQUFLLFNBQVMsc0JBQXNCLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBY0EsT0FBTSxDQUFDLFdBQVcsS0FBSyxPQUFPO0FBQUEsSUFDdkksaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNMLENBQUM7QUFFRCxHQUFHLHNDQUFzQyxPQUFPLFFBQWdCLFNBQWlCLFlBQW9CLFVBQWtCLGVBQXVCO0FBQzFJLFVBQVEsSUFBSSx3QkFBd0IsU0FBUyxZQUFZLFVBQVUsVUFBVTtBQUM3RSxRQUFNLFlBQVksTUFBTSxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUM1RSxRQUFNLGdCQUFnQixNQUFNLFFBQVEsUUFBUSxtQkFBbUIsRUFBRSxXQUFXLFdBQVcsU0FBUyxRQUFRLENBQUM7QUFDekcsTUFBSSxlQUFlO0FBQ2YsUUFBSSxjQUFjLGVBQWUsWUFBWTtBQUN6QyxZQUFNLFFBQVEsVUFBVSxtQkFBbUIsRUFBRSxXQUFXLFdBQVcsU0FBUyxRQUFRLEdBQUcsRUFBRSxZQUFZLFdBQVcsQ0FBQztBQUNqSCxjQUFRLHlCQUF5QixRQUFRLEtBQUssVUFBVTtBQUFBLFFBQ3BELElBQUksYUFBYTtBQUFBLFFBQ2pCLE9BQU87QUFBQSxRQUNQLGFBQWEsc0NBQXNDLFVBQVU7QUFBQSxRQUM3RCxLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsTUFDYixDQUFDLENBQUM7QUFDRixjQUFRLHNDQUFzQyxRQUFRLE9BQU87QUFDN0QsYUFBTyxPQUFPO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxTQUFTLEdBQUcsU0FBUyx3QkFBd0IsT0FBTyxnQkFBZ0IsVUFBVSxPQUFPLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBYyxNQUFNLENBQUMsaUJBQWlCLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNLENBQUM7QUFBQSxRQUN6TSxpQkFBaUI7QUFBQSxNQUNyQixDQUFDO0FBQUEsSUFDTCxPQUFPO0FBQ0gsYUFBTyxRQUFRLGlCQUFpQixRQUFRLHFEQUFxRCxPQUFPO0FBQUEsSUFDeEc7QUFBQSxFQUNKLE9BQU87QUFDSCxVQUFNLFFBQVEsVUFBVSxtQkFBbUIsRUFBRSxLQUFLLGFBQWEsR0FBRyxXQUFXLFdBQVcsU0FBUyxTQUFVLFlBQXdCLFVBQW9CLFdBQXVCLENBQUM7QUFDL0ssWUFBUSx5QkFBeUIsUUFBUSxLQUFLLFVBQVU7QUFBQSxNQUNwRCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhLHFDQUFxQyxRQUFRLE9BQU8sVUFBVTtBQUFBLE1BQzNFLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUNGLFlBQVEsc0NBQXNDLFFBQVEsT0FBTztBQUM3RCxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsR0FBRyxTQUFTLHNCQUFzQixPQUFPLGdCQUFnQixVQUFVLE9BQU8sTUFBTSxRQUFRLFNBQVMsRUFBRSxjQUFjLE1BQU0sQ0FBQyxpQkFBaUIsUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU0sQ0FBQztBQUFBLE1BQ3ZNLGlCQUFpQjtBQUFBLElBQ3JCLENBQUM7QUFBQSxFQUNMO0FBQ0osQ0FBQztBQUVELGFBQWEsWUFBWTtBQUNyQixNQUFJLGdCQUFnQixRQUFRLFNBQVMsRUFBRSxjQUFjO0FBQ3JELFNBQU8sa0JBQWtCLE9BQU87QUFDNUIsVUFBTSxNQUFNLEdBQUk7QUFDaEIsb0JBQWdCLFFBQVEsU0FBUyxFQUFFLGNBQWM7QUFDakQsUUFBSSxlQUFlO0FBQ2YsYUFBTywrQkFBK0I7QUFDdEM7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNBLFFBQU0sV0FBZ0IsQ0FBQztBQUN2QixRQUFNLFVBQVUsTUFBTSxRQUFRLFNBQVMsZUFBZSxDQUFDLENBQUM7QUFDeEQsVUFBUSxRQUFRLE9BQU8sUUFBYTtBQUNoQyxVQUFNLEVBQUUsS0FBSyxHQUFHLEtBQUssSUFBSTtBQUN6QixXQUFPLDhCQUE4QixHQUFHLGVBQWU7QUFDdkQsYUFBUyxHQUFHLElBQUk7QUFBQSxFQUNwQixDQUFDO0FBRUwsQ0FBQzs7O0FDNU1ELGlCQUFpQixxQkFBcUIsT0FBTyxXQUFXO0FBQ3BELFFBQU0sWUFBWSxNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFDbkYsU0FBTyxLQUFLLFVBQVU7QUFBQSxJQUNsQixLQUFLLFNBQVMsSUFBSSxJQUFJLFNBQVM7QUFBQSxJQUMvQixZQUFZLFNBQVMsV0FBVyxJQUFJLFNBQVM7QUFBQSxJQUM3QyxZQUFZLFNBQVMsV0FBVyxJQUFJLFNBQVM7QUFBQSxJQUM3QyxVQUFVLFNBQVMsU0FBUyxJQUFJLFNBQVM7QUFBQSxJQUN6QyxtQkFBbUIsU0FBUyxrQkFBa0IsSUFBSSxTQUFTO0FBQUEsSUFDM0QsbUJBQW1CLFNBQVMsa0JBQWtCLElBQUksU0FBUztBQUFBLElBQzNELFFBQVEsU0FBUyxPQUFPLElBQUksU0FBUztBQUFBLElBQ3JDLFNBQVMsU0FBUyxRQUFRLElBQUksU0FBUztBQUFBLElBQ3ZDLFFBQVEsU0FBUyxPQUFPLElBQUksU0FBUztBQUFBLElBQ3JDLFdBQVcsU0FBUyxVQUFVLElBQUksU0FBUztBQUFBLElBQzNDLGtCQUFrQixTQUFTLGlCQUFpQixJQUFJLFNBQVM7QUFBQSxJQUN6RCxRQUFRLFNBQVMsT0FBTyxJQUFJLFNBQVM7QUFBQSxJQUNyQyxvQkFBb0IsU0FBUyxtQkFBbUIsSUFBSSxTQUFTO0FBQUEsSUFDN0QsY0FBYyxTQUFTLGFBQWEsSUFBSSxTQUFTO0FBQUEsSUFDakQsY0FBYyxTQUFTLGFBQWEsSUFBSSxTQUFTO0FBQUEsSUFDakQsYUFBYSxTQUFTLFlBQVksSUFBSSxTQUFTO0FBQUEsSUFDL0Msa0JBQWtCLFNBQVMsaUJBQWlCLElBQUksU0FBUztBQUFBLEVBQzdELENBQUM7QUFDTCxDQUFDO0FBRUQsaUJBQWlCLHFCQUFxQixPQUFPLFFBQVEsU0FBaUI7QUFDbEUsUUFBTSxZQUFZLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUNuRixRQUFNLGFBaUJGLEtBQUssTUFBTSxJQUFJO0FBQ25CLFdBQVMsV0FBVyxJQUFJLFdBQVcsV0FBVyxVQUFVO0FBQ3hELFdBQVMsV0FBVyxJQUFJLFdBQVcsV0FBVyxVQUFVO0FBQ3hELFdBQVMsU0FBUyxJQUFJLFdBQVcsV0FBVyxRQUFRO0FBQ3BELFdBQVMsa0JBQWtCLElBQUksV0FBVyxXQUFXLGlCQUFpQjtBQUN0RSxXQUFTLGtCQUFrQixJQUFJLFdBQVcsV0FBVyxpQkFBaUI7QUFDdEUsV0FBUyxPQUFPLElBQUksV0FBVyxXQUFXLE1BQU07QUFDaEQsV0FBUyxRQUFRLElBQUksV0FBVyxXQUFXLE9BQU87QUFDbEQsV0FBUyxPQUFPLElBQUksV0FBVyxXQUFXLE1BQU07QUFDaEQsV0FBUyxVQUFVLElBQUksV0FBVyxXQUFXLFNBQVM7QUFDdEQsV0FBUyxpQkFBaUIsSUFBSSxXQUFXLFdBQVcsZ0JBQWdCO0FBQ3BFLFdBQVMsT0FBTyxJQUFJLFdBQVcsV0FBVyxNQUFNO0FBQ2hELFdBQVMsYUFBYSxJQUFJLFdBQVcsV0FBVyxZQUFZO0FBQzVELFdBQVMsYUFBYSxJQUFJLFdBQVcsV0FBVyxZQUFZO0FBQzVELFdBQVMsbUJBQW1CLElBQUksV0FBVyxXQUFXLGtCQUFrQjtBQUN4RSxXQUFTLFlBQVksSUFBSSxXQUFXLFdBQVcsV0FBVztBQUMxRCxXQUFTLGlCQUFpQixJQUFJLFdBQVcsV0FBVyxnQkFBZ0I7QUFDcEUsUUFBTSxTQUFTLG1CQUFtQixTQUFTO0FBQzNDLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxHQUFHLFNBQVMsWUFBWSxPQUFPLFFBQVEsU0FBUyxFQUFFLGNBQWMsTUFBTSxDQUFDLGtCQUFrQixLQUFLLFVBQVUsVUFBVSxDQUFDO0FBQUEsSUFDNUgsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNELFNBQU87QUFDWCxDQUFDO0FBRUQsaUJBQWlCLDBCQUEwQixPQUFPLFFBQVEsU0FBaUI7QUFDdkUsUUFBTSxhQUdGLEtBQUssTUFBTSxJQUFJO0FBQ25CLFFBQU0sUUFBbUI7QUFBQSxJQUNyQixjQUFjLFdBQVc7QUFBQSxJQUN6QixVQUFVLFdBQVc7QUFBQSxJQUNyQixvQkFBb0IsV0FBVztBQUFBLElBQy9CLFFBQVE7QUFBQSxJQUNSLFVBQVUsQ0FBQztBQUFBLEVBQ2Y7QUFDQSxRQUFNLFFBQVEsVUFBVSxjQUFjLEVBQUUsS0FBSyxXQUFXLE9BQU8sR0FBRyxNQUFNLENBQUM7QUFDekUsU0FBTyxPQUFPO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLDJDQUEyQyxXQUFXLEtBQUssZUFBZSxXQUFXLFFBQVEsaUJBQWlCLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTSxDQUFDLFdBQVcsT0FBTyxRQUFRLFNBQVMsRUFBRSxjQUFjLE1BQU0sQ0FBQztBQUFBLElBQ25QLGlCQUFpQjtBQUFBLEVBQ3JCLENBQUM7QUFDRCxTQUFPO0FBQ1gsQ0FBQztBQUVELGlCQUFpQixlQUFlLE9BQU8sUUFBUSxTQUFpQjtBQUM1RCxRQUFNLE1BQU0sTUFBTSxRQUFRLFNBQVMsY0FBYyxFQUFFLEtBQUssS0FBSyxDQUFDO0FBQzlELFNBQU8sS0FBSyxVQUFVLEdBQUc7QUFDN0IsQ0FBQztBQUVELGlCQUFpQixvQkFBb0IsT0FBTyxRQUFRLFNBQWlCO0FBQ2pFLFFBQU0sYUFHRixLQUFLLE1BQU0sSUFBSTtBQUNuQixRQUFNLE1BQU0sTUFBTSxRQUFRLFFBQVEsY0FBYyxFQUFFLEtBQUssV0FBVyxNQUFNLENBQUM7QUFDekUsTUFBSSxJQUFJLHVCQUF1QixXQUFXLFVBQVU7QUFDaEQsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLEdBQUcsT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTSxDQUFDLFVBQVUsT0FBTyxRQUFRLFNBQVMsRUFBRSxjQUFjLE1BQU0sQ0FBQywrQkFBK0IsV0FBVyxLQUFLLGVBQWUsV0FBVyxRQUFRO0FBQUEsTUFDbE4saUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU87QUFBQSxFQUNYLE9BQU87QUFDSCxXQUFPO0FBQUEsRUFDWDtBQUNKLENBQUM7QUFFRCxpQkFBaUIscUJBQXFCLE9BQU8sUUFBUSxTQUFrQjtBQUNuRSxRQUFNLFlBQVksTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNO0FBQ25GLFdBQVMsT0FBTyxJQUFJLFdBQVcsSUFBSTtBQUNuQyxTQUFPO0FBQ1gsQ0FBQztBQUVELGlCQUFpQixzQkFBc0IsT0FBTyxXQUFXO0FBQ3JELFFBQU0sWUFBWSxNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFDbkYsUUFBTSxNQUFNLE1BQU0sUUFBUSxRQUFRLHFCQUFxQixFQUFFLEtBQUssVUFBVSxDQUFDO0FBQ3pFLFNBQU8sS0FBSyxVQUFVLEdBQUc7QUFDN0IsQ0FBQztBQUVELGlCQUFpQiw0QkFBNEIsT0FBTyxRQUFRLFNBQWlCO0FBQ3pFLFFBQU0sYUFBOEIsS0FBSyxNQUFNLElBQUk7QUFDbkQsUUFBTSxRQUFRLFVBQVUscUJBQXFCLEVBQUUsS0FBSyxXQUFXLElBQUksR0FBRyxVQUFVO0FBQ2hGLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxHQUFHLFdBQVcsR0FBRyxZQUFZLE9BQU8sUUFBUSxTQUFTLEVBQUUsY0FBYyxNQUFNLENBQUMsMkJBQTJCLEtBQUssVUFBVSxVQUFVLENBQUM7QUFBQSxJQUMxSSxpQkFBaUI7QUFBQSxFQUNyQixDQUFDO0FBQ0QsU0FBTztBQUNYLENBQUM7OztBQ3pJRCxnQkFBZ0IsZ0JBQWdCLE9BQU9DLFNBQWdCLFNBQW1CO0FBQ3RFLFFBQU0sU0FBUyxLQUFLO0FBQ3hCLEdBQUcsSUFBSTtBQUVQLElBQU0sc0JBQXNCLG1DQUE2QjtBQUNyRCxRQUFNLFNBQVMsS0FBSyxNQUFNLE1BQWEsS0FBSyxPQUFPLElBQUksR0FBVSxFQUFFLFNBQVM7QUFDNUUsUUFBTSxTQUFTLE1BQU0sUUFBUSxRQUFRLGlCQUFpQixFQUFFLE9BQWUsQ0FBQztBQUN4RSxNQUFJLE9BQVEsUUFBTyxvQkFBb0I7QUFDdkMsU0FBTztBQUNYLEdBTDRCO0FBTzVCLGVBQWUsMEJBQTBCLFdBQW1CQSxTQUE0QjtBQUNwRixRQUFNLFNBQVMsTUFBTSxvQkFBb0I7QUFDekMsUUFBTSxRQUFRLFVBQVUsaUJBQWlCO0FBQUEsSUFDckMsS0FBSyxhQUFhO0FBQUEsSUFDbEIsT0FBTztBQUFBLElBQ1A7QUFBQSxFQUNKLENBQUM7QUFFRCxRQUFNLFFBQVEsVUFBVSxrQkFBa0I7QUFBQSxJQUN0QyxLQUFLO0FBQUEsSUFDTCxZQUFZO0FBQUEsTUFDUixTQUFTO0FBQUEsTUFDVCxZQUFZLENBQUM7QUFBQSxJQUNqQjtBQUFBLElBQ0EsWUFBWTtBQUFBLE1BQ1IsU0FBUztBQUFBLE1BQ1QsWUFBWSxDQUFDO0FBQUEsSUFDakI7QUFBQSxJQUNBLFVBQVU7QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULFdBQVc7QUFBQSxRQUNQO0FBQUEsVUFDSSxNQUFNO0FBQUEsVUFDTixLQUFLO0FBQUEsUUFDVDtBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBQUEsSUFDQSxtQkFBbUI7QUFBQSxJQUNuQixtQkFBbUI7QUFBQSxJQUNuQixRQUFRO0FBQUEsSUFDUixTQUFTO0FBQUEsSUFDVCxRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsSUFDYixXQUFXO0FBQUEsSUFDWCxrQkFBa0I7QUFBQSxJQUNsQixvQkFBb0I7QUFBQSxJQUNwQixrQkFBa0I7QUFBQSxJQUNsQixRQUFRO0FBQUEsSUFDUixjQUFjO0FBQUEsSUFDZCxjQUFjO0FBQUEsRUFDbEIsQ0FBQztBQUVELFFBQU0sUUFBUSxVQUFVLHFCQUFxQjtBQUFBLElBQ3pDLEtBQUs7QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYLFVBQVU7QUFBQSxJQUNWLGFBQWE7QUFBQSxJQUNiLE9BQU87QUFBQSxJQUNQLE9BQU87QUFBQSxJQUNQLFFBQVE7QUFBQSxFQUNaLENBQUM7QUFDRCxXQUFTLG9CQUFvQixXQUFXLE1BQU07QUFDakQsTUFBSUEsU0FBUTtBQUNYLFlBQVEsMkJBQTJCQSxTQUFRLFNBQVM7QUFBQSxFQUNyRDtBQUNHLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxnQkFBZ0IsTUFBTSxrQkFBa0IsU0FBUztBQUFBLElBQzFELGlCQUFpQjtBQUFBLEVBQ3JCLENBQUM7QUFDRCxTQUFPO0FBQ1g7QUE5RGU7QUErRGYsUUFBUSw2QkFBNkIseUJBQXlCO0FBRTlELEdBQUcsbUNBQW1DLE9BQU8sU0FBYztBQUN2RCxRQUFNLFNBQVMsS0FBSztBQUNwQixTQUFPLHdDQUF3QztBQUNuRCxDQUFDO0FBRUQsR0FBRyxxQ0FBcUMsWUFBWTtBQUNoRCxRQUFNLFNBQVMsS0FBSztBQUNwQixTQUFPLHdDQUF3QztBQUNuRCxDQUFDOzs7QUNuRkQsSUFBTSxpQkFBTixNQUFNLGVBQWM7QUFBQSxFQUNoQixNQUFhLGdCQUFnQixTQUFpQixNQUE0QjtBQUN0RSxVQUFNLE9BQU8sTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDeEUsV0FBTyxDQUFDLENBQUM7QUFBQSxFQUNiO0FBQUEsRUFFQSxNQUFhLE1BQU0sU0FBaUIsTUFBNEI7QUFDNUQsUUFBSTtBQUNBLFlBQU0sRUFBRSxPQUFPLFNBQVMsSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUMzQyxZQUFNLE9BQU8sTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsT0FBTyxTQUFTLENBQUM7QUFDNUUsVUFBSSxNQUFNO0FBQ04sZUFBTyxPQUFPO0FBQUEsVUFDVixNQUFNO0FBQUEsVUFDTixPQUFPO0FBQUEsVUFDUCxTQUFTLG1CQUFtQixLQUFLO0FBQUEsVUFDakMsaUJBQWlCO0FBQUEsUUFDckIsQ0FBQztBQUNELGVBQU87QUFBQSxNQUNYO0FBQ0EsYUFBTztBQUFBLElBQ1gsU0FBUyxPQUFPO0FBQ1osY0FBUSxNQUFNLG1CQUFtQixLQUFLO0FBQ3RDLGFBQU8sRUFBRSxPQUFPLG9CQUFvQjtBQUFBLElBQ3hDO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBYSxPQUFPLFNBQWlCLE1BQTRCO0FBQzdELFVBQU0sRUFBRSxPQUFPLFNBQVMsSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUMzQyxVQUFNLGVBQWUsTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsTUFBTSxDQUFDO0FBQzFFLFFBQUksY0FBYztBQUNkLGFBQU8sRUFBRSxPQUFPLHNCQUFzQjtBQUFBLElBQzFDO0FBQ0EsVUFBTSxRQUFRLFVBQVUsc0JBQXNCO0FBQUEsTUFDMUMsS0FBSyxhQUFhO0FBQUEsTUFDbEI7QUFBQSxNQUNBO0FBQUEsTUFDQSxVQUFVO0FBQUEsTUFDVixVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYixRQUFRO0FBQUEsTUFDUixRQUFRO0FBQUEsTUFDUixzQkFBc0I7QUFBQSxNQUN0QixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsTUFDbEMsS0FBSztBQUFBLE1BQ0wsV0FBVyxDQUFDO0FBQUEsTUFDWixXQUFXLENBQUM7QUFBQSxJQUNoQixDQUFDO0FBQ0QsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLHVDQUF1QyxLQUFLO0FBQUEsTUFDckQsaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU87QUFBQSxFQUNYO0FBQUEsRUFFQSxNQUFhLFdBQVcsU0FBaUIsT0FBNkI7QUFDbEUsVUFBTSxPQUFPLE1BQU0sUUFBUSxRQUFRLHNCQUFzQixFQUFFLE1BQU0sQ0FBQztBQUNsRSxRQUFJLE1BQU07QUFDTixhQUFPLEtBQUssVUFBVSxJQUFJO0FBQUEsSUFDOUIsT0FBTztBQUNILGFBQU87QUFBQSxJQUNYO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBYSxvQkFBb0IsU0FBaUIsT0FBZTtBQUM3RCxVQUFNLE1BQU0sTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsTUFBTSxDQUFDO0FBQ2pFLFFBQUksS0FBSztBQUNMLFVBQUksdUJBQXVCLENBQUMsSUFBSTtBQUNoQyxZQUFNLFFBQVEsVUFBVSxzQkFBc0IsRUFBRSxNQUFNLEdBQUcsR0FBRztBQUM1RCxhQUFPLE9BQU87QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLE9BQU87QUFBQSxRQUNQLFNBQVMsUUFBUSxLQUFLLDZCQUE2QixJQUFJLHVCQUF1QixZQUFZLFVBQVU7QUFBQSxRQUNwRyxpQkFBaUI7QUFBQSxNQUNyQixDQUFDO0FBQ0QsYUFBTztBQUFBLElBQ1g7QUFDQSxXQUFPO0FBQUEsRUFDWDtBQUFBLEVBRUEsTUFBYSxVQUFVLFNBQWlCLE1BQTRCO0FBQ2hFLFVBQU0sRUFBRSxPQUFPLFNBQVMsWUFBWSxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQ3ZELFFBQUk7QUFDQSxZQUFNLE1BQU0sTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsTUFBTSxDQUFDO0FBQ2pFLFVBQUksQ0FBQyxJQUFLLFFBQU8sRUFBRSxPQUFPLGlCQUFpQjtBQUUzQyxZQUFNLFFBQW1CO0FBQUEsUUFDckIsS0FBSyxhQUFhO0FBQUEsUUFDbEIsVUFBVSxJQUFJO0FBQUEsUUFDZCxPQUFPLElBQUk7QUFBQSxRQUNYLFFBQVEsSUFBSTtBQUFBLFFBQ1osVUFBVSxJQUFJO0FBQUEsUUFDZDtBQUFBLFFBQ0E7QUFBQSxRQUNBLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxRQUNsQyxXQUFXLENBQUM7QUFBQSxRQUNaLGNBQWMsQ0FBQztBQUFBLFFBQ2YsY0FBYyxDQUFDO0FBQUEsUUFDZixXQUFXO0FBQUEsUUFDWCxpQkFBaUI7QUFBQSxRQUNqQixVQUFVLFFBQVEsTUFBTSxPQUFPLEtBQUssQ0FBQztBQUFBLFFBQ3JDLGVBQWU7QUFBQSxNQUVuQjtBQUNBLFlBQU0sUUFBUSxVQUFVLHVCQUF1QixLQUFLO0FBQ3BELFlBQU0sc0JBQXNCLHVCQUF1QixJQUFJLEtBQUssVUFBVSxLQUFLLENBQUM7QUFDNUUsY0FBUSx5QkFBeUIsSUFBSSxLQUFLLFVBQVU7QUFBQSxRQUNoRCxJQUFJLGFBQWE7QUFBQSxRQUNqQixPQUFPO0FBQUEsUUFDUCxhQUFhLEdBQUcsSUFBSSxXQUFXO0FBQUEsUUFDL0IsS0FBSztBQUFBLFFBQ0wsU0FBUztBQUFBLE1BQ2IsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxRQUFRLFVBQVUsOEJBQThCO0FBQUEsUUFDbEQsS0FBSyxhQUFhO0FBQUEsUUFDbEIsU0FBUyxHQUFHLElBQUksV0FBVztBQUFBLFFBQzNCLE9BQU8sSUFBSTtBQUFBLFFBQ1gsWUFBVyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLFFBQ2xDLE1BQU07QUFBQSxNQUNWLENBQUM7QUFDRCxhQUFPLE9BQU87QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLE9BQU87QUFBQSxRQUNQLFNBQVMsUUFBUSxLQUFLLDRCQUE0QixNQUFNLEdBQUcsZUFBZSxPQUFPO0FBQUEsUUFDakYsaUJBQWlCO0FBQUEsTUFDckIsQ0FBQztBQUNELGFBQU87QUFBQSxJQUNYLFNBQVMsT0FBTztBQUNaLGNBQVEsTUFBTSx1QkFBdUIsS0FBSztBQUMxQyxhQUFPLEVBQUUsT0FBTyxvQkFBb0I7QUFBQSxJQUN4QztBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQWEsV0FBVyxTQUFpQixNQUE0QjtBQUNqRSxRQUFJO0FBQ0EsWUFBTSxFQUFFLFFBQVEsR0FBRyxNQUFNLEdBQUcsSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUMvQyxZQUFNLE1BQU0sTUFBTSxRQUFRLFNBQVMsdUJBQXVCLENBQUMsR0FBRyxNQUFNLE9BQU87QUFBQSxRQUN2RSxNQUFNLFFBQVE7QUFBQSxRQUNkLE9BQU87QUFBQSxRQUNQLE1BQU0sRUFBRSxXQUFXLEdBQUc7QUFBQSxNQUMxQixDQUFDO0FBRUQsYUFBTyxLQUFLLFVBQVU7QUFBQSxRQUNsQixNQUFNO0FBQUEsUUFDTixRQUFRLElBQUk7QUFBQSxNQUNoQixDQUFDO0FBQUEsSUFDTCxTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0scUJBQXFCLEtBQUs7QUFDeEMsYUFBTyxFQUFFLE9BQU8sb0JBQW9CO0FBQUEsSUFDeEM7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFhLFVBQVUsUUFBZ0IsTUFBNEI7QUFDL0QsVUFBTSxFQUFFLFNBQVMsU0FBUyxPQUFPLFlBQVksSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUNoRSxVQUFNLFlBQVksTUFBTSxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUM1RSxVQUFNLE9BQU8sTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsTUFBTSxDQUFDO0FBQ2xFLFVBQU0sUUFBbUIsTUFBTSxRQUFRLFFBQVEsdUJBQXVCLEVBQUUsS0FBSyxRQUFRLENBQUM7QUFDdEYsUUFBSSxDQUFDLE1BQU8sUUFBTyxFQUFFLE9BQU8sa0JBQWtCO0FBQzlDLFVBQU0sUUFBUTtBQUFBLE1BQ1YsS0FBSyxhQUFhO0FBQUEsTUFDbEIsVUFBVSxLQUFLO0FBQUEsTUFDZixPQUFPLEtBQUs7QUFBQSxNQUNaLFFBQVEsS0FBSztBQUFBLE1BQ2IsVUFBVSxLQUFLO0FBQUEsTUFDZjtBQUFBLE1BQ0E7QUFBQSxNQUNBLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxNQUNsQyxXQUFXLENBQUM7QUFBQSxNQUNaLGNBQWMsQ0FBQztBQUFBLE1BQ2YsY0FBYyxDQUFDO0FBQUEsTUFDZixXQUFXO0FBQUEsTUFDWCxpQkFBaUI7QUFBQSxNQUNqQixVQUFVLFFBQVEsTUFBTSxPQUFPLEtBQUssQ0FBQztBQUFBLE1BQ3JDLGVBQWU7QUFBQSxJQUNuQjtBQUNBLFVBQU0sYUFBYSxLQUFLLFNBQVM7QUFDakMsVUFBTSxRQUFRLFVBQVUsdUJBQXVCLEVBQUUsS0FBSyxRQUFRLEdBQUcsS0FBSztBQUN0RSxVQUFNLFFBQVEsVUFBVSwrQkFBK0IsS0FBSztBQUM1RCxVQUFNLHNCQUFzQix3QkFBd0IsSUFBSSxLQUFLLFVBQVUsS0FBSyxDQUFDO0FBQzdFLFVBQU0sTUFBTSxNQUFNLFFBQVEsU0FBUyxFQUFFLHFCQUFxQixNQUFNLE1BQU0sa0JBQWtCLE1BQU0sS0FBSyxDQUFDO0FBQ3BHLFFBQUksS0FBSztBQUNMLGNBQVEseUJBQXlCLElBQUksV0FBVyxRQUFRLEtBQUssVUFBVTtBQUFBLFFBQ25FLElBQUksYUFBYTtBQUFBLFFBQ2pCLE9BQU87QUFBQSxRQUNQLGFBQWEsR0FBRyxLQUFLLFdBQVc7QUFBQSxRQUNoQyxLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsTUFDYixDQUFDLENBQUM7QUFDRixZQUFNLFFBQVEsVUFBVSw4QkFBOEI7QUFBQSxRQUNsRCxLQUFLLGFBQWE7QUFBQSxRQUNsQixTQUFTLEdBQUcsS0FBSyxXQUFXO0FBQUEsUUFDNUIsT0FBTyxNQUFNO0FBQUEsUUFDYixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsUUFDbEMsTUFBTTtBQUFBLE1BQ1YsQ0FBQztBQUFBLElBQ0w7QUFDQSxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsUUFBUSxLQUFLLDBCQUEwQixPQUFPLGVBQWUsT0FBTztBQUFBLE1BQzdFLGlCQUFpQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDWDtBQUFBLEVBRUEsTUFBYSxVQUFVLFNBQWlCLE1BQWM7QUFDbEQsVUFBTSxFQUFFLFNBQVMsTUFBTSxNQUFNLElBQUksS0FBSyxNQUFNLElBQUk7QUFDaEQsVUFBTSxRQUFRLE1BQU0sUUFBUSxRQUFRLHVCQUF1QixFQUFFLEtBQUssUUFBUSxDQUFDO0FBQzNFLFFBQUksQ0FBQyxNQUFPLFFBQU8sRUFBRSxPQUFPLGtCQUFrQjtBQUM5QyxRQUFJLE1BQU07QUFDTixZQUFNLFVBQVUsS0FBSyxLQUFLO0FBQzFCLFlBQU0sTUFBTSxNQUFNLE1BQU0sa0JBQWtCLE1BQU0sS0FBSztBQUNyRCxZQUFNLE1BQU0sTUFBTSxRQUFRLFNBQVMsRUFBRSxxQkFBcUIsR0FBRztBQUM3RCxVQUFJLEtBQUs7QUFDTCxnQkFBUSx5QkFBeUIsSUFBSSxXQUFXLFFBQVEsS0FBSyxVQUFVO0FBQUEsVUFDbkUsSUFBSSxhQUFhO0FBQUEsVUFDakIsT0FBTztBQUFBLFVBQ1AsYUFBYSxHQUFHLEtBQUs7QUFBQSxVQUNyQixLQUFLO0FBQUEsVUFDTCxTQUFTO0FBQUEsUUFDYixDQUFDLENBQUM7QUFDRixjQUFNLFFBQVEsVUFBVSw4QkFBOEI7QUFBQSxVQUNsRCxLQUFLLGFBQWE7QUFBQSxVQUNsQixTQUFTLEdBQUcsS0FBSztBQUFBLFVBQ2pCLE9BQU8sTUFBTTtBQUFBLFVBQ2IsWUFBVyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLFVBQ2xDLE1BQU07QUFBQSxRQUNWLENBQUM7QUFBQSxNQUNMO0FBQ0EsYUFBTyxPQUFPO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxTQUFTLFFBQVEsS0FBSyxxQkFBcUIsT0FBTztBQUFBLFFBQ2xELGlCQUFpQjtBQUFBLE1BQ3JCLENBQUM7QUFBQSxJQUNMLE9BQU87QUFDSCxZQUFNLFlBQVksTUFBTSxVQUFVLE9BQU8sQ0FBQyxNQUFXLE1BQU0sS0FBSztBQUNoRSxhQUFPLE9BQU87QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLE9BQU87QUFBQSxRQUNQLFNBQVMsUUFBUSxLQUFLLHFCQUFxQixPQUFPO0FBQUEsUUFDbEQsaUJBQWlCO0FBQUEsTUFDckIsQ0FBQztBQUFBLElBQ0w7QUFDQSxVQUFNLFFBQVEsVUFBVSx1QkFBdUIsRUFBRSxLQUFLLFFBQVEsR0FBRyxLQUFLO0FBQ3RFLFdBQU87QUFBQSxFQUNYO0FBQUEsRUFFQSxNQUFhLGlCQUFpQixTQUFpQixNQUFjO0FBQ3pELFVBQU0sRUFBRSxTQUFTLE1BQU0sTUFBTSxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQ2hELFVBQU0sUUFBUSxNQUFNLFFBQVEsUUFBUSwrQkFBK0IsRUFBRSxLQUFLLFFBQVEsQ0FBQztBQUNuRixRQUFJLENBQUMsTUFBTyxRQUFPLFFBQVEsSUFBSSxpQkFBaUI7QUFDaEQsUUFBSSxNQUFNO0FBQ04sWUFBTSxVQUFVLEtBQUssS0FBSztBQUMxQixhQUFPLE9BQU87QUFBQSxRQUNWLE1BQU07QUFBQSxRQUNOLE9BQU87QUFBQSxRQUNQLFNBQVMsUUFBUSxLQUFLLHFCQUFxQixPQUFPO0FBQUEsUUFDbEQsaUJBQWlCO0FBQUEsTUFDckIsQ0FBQztBQUFBLElBQ0wsT0FBTztBQUNILFlBQU0sWUFBWSxNQUFNLFVBQVUsT0FBTyxDQUFDLE1BQVcsTUFBTSxLQUFLO0FBQ2hFLGFBQU8sT0FBTztBQUFBLFFBQ1YsTUFBTTtBQUFBLFFBQ04sT0FBTztBQUFBLFFBQ1AsU0FBUyxRQUFRLEtBQUssdUJBQXVCLE9BQU87QUFBQSxRQUNwRCxpQkFBaUI7QUFBQSxNQUNyQixDQUFDO0FBQUEsSUFDTDtBQUNBLFVBQU0sUUFBUSxVQUFVLCtCQUErQixFQUFFLEtBQUssUUFBUSxHQUFHLEtBQUs7QUFDOUUsV0FBTztBQUFBLEVBQ1g7QUFBQSxFQUVBLE1BQWEsUUFBUSxRQUFnQixNQUFjO0FBQy9DLFVBQU0sRUFBRSxTQUFTLFNBQVMsVUFBVSxVQUFVLElBQUksS0FBSyxNQUFNLElBQUk7QUFDakUsUUFBSTtBQUNBLFVBQUksU0FBUztBQUNULGNBQU0sWUFBWSxNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNO0FBQzVFLGNBQU0sZ0JBQWdCLE1BQU0sUUFBUSxRQUFRLHVCQUF1QixFQUFFLEtBQUssUUFBUSxDQUFDO0FBQ25GLGNBQU0sY0FBYyxNQUFNLFFBQVEsUUFBUSxzQkFBc0IsRUFBRSxPQUFPLFNBQVMsQ0FBQztBQUNuRixZQUFJLENBQUMsZUFBZTtBQUNoQixpQkFBTyxFQUFFLE9BQU8sMkJBQTJCO0FBQUEsUUFDL0M7QUFDQSxzQkFBYyxhQUFhLEtBQUssU0FBUztBQUN6QyxjQUFNLFFBQVEsVUFBVSx1QkFBdUIsRUFBRSxLQUFLLFFBQVEsR0FBRyxhQUFhO0FBRTlFLGNBQU0sY0FBeUI7QUFBQSxVQUMzQixLQUFLLGFBQWE7QUFBQSxVQUNsQixVQUFVLFlBQVk7QUFBQSxVQUN0QixPQUFPLFlBQVk7QUFBQSxVQUNuQixRQUFRLFlBQVk7QUFBQSxVQUNwQixVQUFVLFlBQVk7QUFBQSxVQUN0QixTQUFTLGNBQWM7QUFBQSxVQUN2QixhQUFhLGNBQWM7QUFBQSxVQUMzQixZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsVUFDbEMsV0FBVyxDQUFDO0FBQUEsVUFDWixjQUFjLENBQUM7QUFBQSxVQUNmLGNBQWMsQ0FBQztBQUFBLFVBQ2YsV0FBVztBQUFBLFVBQ1gsaUJBQWlCO0FBQUEsVUFDakIsVUFBVSxjQUFjO0FBQUEsVUFDeEIsZUFBZTtBQUFBLFFBQ25CO0FBQ0EsY0FBTSxRQUFRLFVBQVUsdUJBQXVCLFdBQVc7QUFDMUQsY0FBTSxzQkFBc0IsdUJBQXVCLElBQUksS0FBSyxVQUFVLFdBQVcsQ0FBQztBQUNsRixlQUFPLE9BQU87QUFBQSxVQUNWLE1BQU07QUFBQSxVQUNOLE9BQU87QUFBQSxVQUNQLFNBQVMsUUFBUSxRQUFRLHlCQUF5QixPQUFPLHlCQUF5QixTQUFTLGNBQWMsY0FBYyxPQUFPO0FBQUEsVUFDOUgsaUJBQWlCO0FBQUEsUUFDckIsQ0FBQztBQUNELGVBQU87QUFBQSxNQUNYLFdBQVcsQ0FBQyxTQUFTO0FBQ2pCLGNBQU0sWUFBWSxNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNO0FBQzVFLGNBQU0sZ0JBQWdCLE1BQU0sUUFBUSxRQUFRLHVCQUF1QixFQUFFLEtBQUssVUFBVSxDQUFDO0FBQ3JGLGNBQU1DLFdBQVUsTUFBTSxRQUFRLFFBQVEsdUJBQXVCLEVBQUUsS0FBSyxRQUFRLENBQUM7QUFDN0UsWUFBSSxDQUFDLGlCQUFpQixDQUFDQSxVQUFTO0FBQzVCLGlCQUFPLEVBQUUsT0FBTywyQkFBMkI7QUFBQSxRQUMvQztBQUdBLFlBQUksVUFBVTtBQUNkLHNCQUFjLGVBQWUsY0FBYyxhQUFhLE9BQU8sQ0FBQyxNQUFXO0FBQ3ZFLGNBQUksTUFBTSxhQUFhLENBQUMsU0FBUztBQUM3QixzQkFBVTtBQUNWLG1CQUFPO0FBQUEsVUFDWDtBQUNBLGlCQUFPO0FBQUEsUUFDWCxDQUFDO0FBQ0QsY0FBTSxRQUFRLFVBQVUsdUJBQXVCLEVBQUUsS0FBSyxVQUFVLEdBQUcsYUFBYTtBQUNoRixjQUFNLFFBQVEsVUFBVSx1QkFBdUIsRUFBRSxLQUFLLFFBQVEsQ0FBQztBQUMvRCxlQUFPLE9BQU87QUFBQSxVQUNWLE1BQU07QUFBQSxVQUNOLE9BQU87QUFBQSxVQUNQLFNBQVMsNkJBQTZCLE9BQU8sNEJBQTRCLFNBQVMsZUFBZSxjQUFjLE9BQU87QUFBQSxVQUN0SCxpQkFBaUI7QUFBQSxRQUNyQixDQUFDO0FBQ0QsZUFBTztBQUFBLE1BQ1g7QUFDQSxhQUFPO0FBQUEsSUFDWCxTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0scUJBQXFCLEtBQUs7QUFDeEMsYUFBTyxFQUFFLE9BQU8sb0JBQW9CO0FBQUEsSUFDeEM7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFhLG9CQUFvQixRQUFnQixNQUFjO0FBQzNELFVBQU0sRUFBRSxTQUFTLFNBQVMsVUFBVSxVQUFVLElBQUksS0FBSyxNQUFNLElBQUk7QUFDakUsUUFBSTtBQUNBLFVBQUksU0FBUztBQUNULGNBQU0sWUFBWSxNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNO0FBQzVFLGNBQU0sZ0JBQWdCLE1BQU0sUUFBUSxRQUFRLCtCQUErQixFQUFFLEtBQUssUUFBUSxDQUFDO0FBQzNGLGNBQU0sVUFBVSxNQUFNLFFBQVEsUUFBUSx1QkFBdUIsRUFBRSxLQUFLLGNBQWMsZ0JBQWdCLENBQUM7QUFDbkcsY0FBTSxjQUFjLE1BQU0sUUFBUSxRQUFRLHNCQUFzQixFQUFFLE9BQU8sU0FBUyxDQUFDO0FBQ25GLFlBQUksQ0FBQyxlQUFlO0FBQ2hCLGlCQUFPLEVBQUUsT0FBTywyQkFBMkI7QUFBQSxRQUMvQztBQUNBLHNCQUFjLGFBQWEsS0FBSyxTQUFTO0FBQ3pDLGdCQUFRLGFBQWEsS0FBSyxTQUFTO0FBQ25DLGNBQU0sUUFBUSxVQUFVLHVCQUF1QixFQUFFLEtBQUssY0FBYyxnQkFBZ0IsR0FBRyxPQUFPO0FBQzlGLGNBQU0sUUFBUSxVQUFVLCtCQUErQixFQUFFLEtBQUssUUFBUSxHQUFHLGFBQWE7QUFFdEYsY0FBTSxjQUF5QjtBQUFBLFVBQzNCLEtBQUssYUFBYTtBQUFBLFVBQ2xCLFVBQVUsWUFBWTtBQUFBLFVBQ3RCLE9BQU8sWUFBWTtBQUFBLFVBQ25CLFFBQVEsWUFBWTtBQUFBLFVBQ3BCLFVBQVUsWUFBWTtBQUFBLFVBQ3RCLFNBQVMsY0FBYztBQUFBLFVBQ3ZCLGFBQWEsY0FBYztBQUFBLFVBQzNCLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxVQUNsQyxXQUFXLENBQUM7QUFBQSxVQUNaLGNBQWMsQ0FBQztBQUFBLFVBQ2YsY0FBYyxDQUFDO0FBQUEsVUFDZixXQUFXO0FBQUEsVUFDWCxpQkFBaUIsY0FBYztBQUFBLFVBQy9CLFVBQVUsY0FBYztBQUFBLFVBQ3hCLGVBQWU7QUFBQSxRQUNuQjtBQUNBLGNBQU0sUUFBUSxVQUFVLCtCQUErQixXQUFXO0FBQ2xFLGNBQU0sc0JBQXNCLHdCQUF3QixJQUFJLEtBQUssVUFBVSxXQUFXLENBQUM7QUFDbkYsWUFBSSxRQUFRLGNBQWM7QUFDdEIsZ0JBQU0sYUFBYSxDQUFDLEdBQUcsSUFBSSxJQUFJLFFBQVEsWUFBWSxDQUFDO0FBQ3BELHFCQUFXLFlBQVksWUFBWTtBQUMvQixrQkFBTSxNQUFNLE1BQU0sUUFBUSxTQUFTLEVBQUUscUJBQXFCLFFBQVE7QUFDbEUsb0JBQVEseUJBQXlCLElBQUksV0FBVyxRQUFRLEtBQUssVUFBVTtBQUFBLGNBQ25FLElBQUksYUFBYTtBQUFBLGNBQ2pCLE9BQU87QUFBQSxjQUNQLGFBQWEsR0FBRyxZQUFZLFdBQVc7QUFBQSxjQUN2QyxLQUFLO0FBQUEsY0FDTCxTQUFTO0FBQUEsWUFDYixDQUFDLENBQUM7QUFDRixrQkFBTSxRQUFRLFVBQVUsOEJBQThCO0FBQUEsY0FDbEQsS0FBSyxhQUFhO0FBQUEsY0FDbEIsU0FBUztBQUFBLGNBQ1QsT0FBTyxZQUFZO0FBQUEsY0FDbkIsWUFBVyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLGNBQ2xDLE1BQU07QUFBQSxZQUNWLENBQUM7QUFBQSxVQUNMO0FBQUEsUUFDSjtBQUNBLGVBQU8sT0FBTztBQUFBLFVBQ1YsTUFBTTtBQUFBLFVBQ04sT0FBTztBQUFBLFVBQ1AsU0FBUyxRQUFRLFFBQVEseUJBQXlCLE9BQU8seUJBQXlCLFNBQVMsZUFBZSxjQUFjLE9BQU87QUFBQSxVQUMvSCxpQkFBaUI7QUFBQSxRQUNyQixDQUFDO0FBQ0QsZUFBTztBQUFBLE1BQ1gsV0FBVyxDQUFDLFNBQVM7QUFDakIsY0FBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFDNUUsY0FBTSxnQkFBZ0IsTUFBTSxRQUFRLFFBQVEsK0JBQStCLEVBQUUsS0FBSyxVQUFVLENBQUM7QUFDN0YsY0FBTUEsV0FBVSxNQUFNLFFBQVEsUUFBUSwrQkFBK0IsRUFBRSxLQUFLLFFBQVEsQ0FBQztBQUNyRixZQUFJLENBQUMsaUJBQWlCLENBQUNBLFVBQVM7QUFDNUIsaUJBQU8sRUFBRSxPQUFPLDJCQUEyQjtBQUFBLFFBQy9DO0FBR0EsWUFBSSxVQUFVO0FBQ2Qsc0JBQWMsZUFBZSxjQUFjLGFBQWEsT0FBTyxDQUFDLE1BQVc7QUFDdkUsY0FBSSxNQUFNLGFBQWEsQ0FBQyxTQUFTO0FBQzdCLHNCQUFVO0FBQ1YsbUJBQU87QUFBQSxVQUNYO0FBQ0EsaUJBQU87QUFBQSxRQUNYLENBQUM7QUFDRCxnQkFBUSxJQUFJLGNBQWMsWUFBWTtBQUN0QyxjQUFNLFFBQVEsVUFBVSwrQkFBK0IsRUFBRSxLQUFLLFVBQVUsR0FBRyxhQUFhO0FBQ3hGLGNBQU0sUUFBUSxVQUFVLCtCQUErQixFQUFFLEtBQUssUUFBUSxDQUFDO0FBQ3ZFLGVBQU8sT0FBTztBQUFBLFVBQ1YsTUFBTTtBQUFBLFVBQ04sT0FBTztBQUFBLFVBQ1AsU0FBUyw2QkFBNkIsT0FBTyxtQkFBbUIsU0FBUyxlQUFlLGNBQWMsT0FBTztBQUFBLFVBQzdHLGlCQUFpQjtBQUFBLFFBQ3JCLENBQUM7QUFDRCxlQUFPO0FBQUEsTUFDWDtBQUNBLGFBQU87QUFBQSxJQUNYLFNBQVMsT0FBTztBQUNaLGNBQVEsTUFBTSxxQkFBcUIsS0FBSztBQUN4QyxhQUFPLEVBQUUsT0FBTyxvQkFBb0I7QUFBQSxJQUN4QztBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQWEsWUFBWSxTQUFpQixTQUFpQjtBQUN2RCxVQUFNLFFBQVEsTUFBTSxRQUFRLFFBQVEsdUJBQXVCLEVBQUUsS0FBSyxRQUFRLENBQUM7QUFDM0UsUUFBSSxDQUFDLE9BQU87QUFDUixjQUFRLE1BQU0saUNBQWlDLE9BQU8sRUFBRTtBQUN4RCxhQUFPLEVBQUUsT0FBTyxrQkFBa0I7QUFBQSxJQUN0QztBQUVBLFVBQU0sUUFBUSxVQUFVLHVCQUF1QixFQUFFLEtBQUssUUFBUSxDQUFDO0FBQy9ELFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyxjQUFjLE9BQU8scUJBQXFCLE1BQU0sS0FBSyxjQUFjLE1BQU0sT0FBTztBQUFBLE1BQ3pGLGlCQUFpQjtBQUFBLElBQ3JCLENBQUM7QUFFRCxXQUFPLEVBQUUsU0FBUyxLQUFLO0FBQUEsRUFDM0I7QUFBQSxFQUVBLE1BQWEsbUJBQW1CLFNBQWlCLFNBQWlCO0FBQzlELFVBQU0sUUFBUSxNQUFNLFFBQVEsUUFBUSwrQkFBK0IsRUFBRSxLQUFLLFFBQVEsQ0FBQztBQUNuRixRQUFJLENBQUMsT0FBTztBQUNSLGNBQVEsTUFBTSx1Q0FBdUMsT0FBTyxFQUFFO0FBQzlELGFBQU8sRUFBRSxPQUFPLHdCQUF3QjtBQUFBLElBQzVDO0FBRUEsVUFBTSxRQUFRLFVBQVUsK0JBQStCLEVBQUUsS0FBSyxRQUFRLENBQUM7QUFDdkUsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLGNBQWMsT0FBTyx1QkFBdUIsTUFBTSxPQUFPLFlBQVksTUFBTSxLQUFLO0FBQUEsTUFDekYsaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU8sRUFBRSxTQUFTLEtBQUs7QUFBQSxFQUMzQjtBQUFBLEVBRUEsTUFBYSxlQUFlLFNBQWlCLFNBQWlCO0FBQzFELFVBQU0sVUFBVSxNQUFNLFFBQVEsU0FBUywrQkFBK0IsRUFBRSxpQkFBaUIsUUFBUSxHQUFHLE1BQU0sT0FBTztBQUFBLE1BQzdHLE1BQU0sRUFBRSxXQUFXLEdBQUc7QUFBQSxJQUMxQixDQUFDO0FBQ0QsV0FBTyxLQUFLLFVBQVUsT0FBTztBQUFBLEVBQ2pDO0FBQUEsRUFFQSxNQUFhLHFCQUFxQixRQUFnQixNQUE0QjtBQUMxRSxVQUFNLEVBQUUsUUFBUSxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQ25DLFVBQU0sUUFBUSxNQUFNLFFBQVEsUUFBUSx1QkFBdUIsRUFBRSxLQUFLLFFBQVEsQ0FBQztBQUMzRSxRQUFJLENBQUMsTUFBTyxRQUFPLEVBQUUsT0FBTyxrQkFBa0I7QUFDOUMsVUFBTSxhQUFhLEtBQUssTUFBTSxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTSxDQUFDO0FBQ25GLFVBQU0sUUFBUSxVQUFVLHVCQUF1QixFQUFFLEtBQUssUUFBUSxHQUFHLEtBQUs7QUFBQSxFQUMxRTtBQUFBLEVBRUEsTUFBYSxxQkFBcUIsUUFBZ0IsTUFBNEI7QUFDMUUsUUFBSTtBQUNBLFlBQU0sRUFBRSxRQUFRLElBQUksS0FBSyxNQUFNLElBQUk7QUFDbkMsWUFBTSxNQUFNLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFFdEUsWUFBTSxRQUFRLE1BQU0sUUFBUSxRQUFRLHVCQUF1QixFQUFFLEtBQUssUUFBUSxDQUFDO0FBQzNFLFVBQUksQ0FBQyxPQUFPO0FBQ1IsZ0JBQVEsTUFBTSxnQ0FBZ0MsT0FBTyxFQUFFO0FBQ3ZELGVBQU8sRUFBRSxPQUFPLGtCQUFrQjtBQUFBLE1BQ3RDO0FBRUEsVUFBSSxVQUFVO0FBQ2QsWUFBTSxlQUFlLE1BQU0sYUFBYSxPQUFPLENBQUMsTUFBYztBQUMxRCxZQUFJLE1BQU0sT0FBTyxDQUFDLFNBQVM7QUFDdkIsb0JBQVU7QUFDVixpQkFBTztBQUFBLFFBQ1g7QUFDQSxlQUFPO0FBQUEsTUFDWCxDQUFDO0FBRUQsWUFBTSxlQUFlLE1BQU0sUUFBUSxVQUFVLHVCQUF1QixFQUFFLEtBQUssUUFBUSxHQUFHLEtBQUs7QUFFM0YsVUFBSSxDQUFDLGdCQUFnQixhQUFhLGtCQUFrQixHQUFHO0FBQ25ELGdCQUFRLEtBQUssNEJBQTRCLE9BQU8sZUFBZTtBQUMvRCxlQUFPLEVBQUUsU0FBUyxPQUFPLFNBQVMsbUNBQW1DO0FBQUEsTUFDekU7QUFFQSxjQUFRLElBQUksaURBQWlELE9BQU8sRUFBRTtBQUN0RSxhQUFPLEVBQUUsU0FBUyxLQUFLO0FBQUEsSUFDM0IsU0FBUyxPQUFZO0FBQ2pCLGNBQVEsTUFBTSxrQ0FBa0MsS0FBSztBQUNyRCxhQUFPLEVBQUUsT0FBTyxxQkFBcUIsU0FBUyxNQUFNLFFBQVE7QUFBQSxJQUNoRTtBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQWEsV0FBVyxTQUFpQixNQUE0QjtBQUNqRSxRQUFJO0FBQ0EsWUFBTSxFQUFFLGFBQWEsY0FBYyxPQUFPLElBQUksS0FBSyxNQUFNLElBQUk7QUFDN0QsWUFBTSxhQUErQixNQUFNLFFBQVEsUUFBUSxzQkFBc0IsRUFBRSxPQUFPLFlBQVksQ0FBQztBQUN2RyxVQUFJLENBQUMsV0FBWSxRQUFPLEVBQUUsT0FBTyx3QkFBd0I7QUFFekQsWUFBTSxjQUFnQyxNQUFNLFFBQVEsUUFBUSxzQkFBc0IsRUFBRSxPQUFPLGFBQWEsQ0FBQztBQUN6RyxVQUFJLENBQUMsWUFBYSxRQUFPLEVBQUUsT0FBTyx5QkFBeUI7QUFFM0QsVUFBSSxRQUFRO0FBQ1IsWUFBSSxDQUFDLFdBQVcsVUFBVSxTQUFTLFlBQVksR0FBRztBQUM5QyxxQkFBVyxVQUFVLEtBQUssWUFBWTtBQUFBLFFBQzFDO0FBQ0EsWUFBSSxDQUFDLFlBQVksVUFBVSxTQUFTLFdBQVcsR0FBRztBQUM5QyxzQkFBWSxVQUFVLEtBQUssV0FBVztBQUFBLFFBQzFDO0FBQ0EsZUFBTyxPQUFPO0FBQUEsVUFDVixNQUFNO0FBQUEsVUFDTixPQUFPO0FBQUEsVUFDUCxTQUFTLFFBQVEsWUFBWSxhQUFhLFdBQVc7QUFBQSxVQUNyRCxpQkFBaUI7QUFBQSxRQUNyQixDQUFDO0FBQUEsTUFDTCxPQUFPO0FBQ0gsbUJBQVcsWUFBWSxXQUFXLFVBQVUsT0FBTyxXQUFTLFVBQVUsWUFBWTtBQUNsRixvQkFBWSxZQUFZLFlBQVksVUFBVSxPQUFPLFdBQVMsVUFBVSxXQUFXO0FBQ25GLGVBQU8sT0FBTztBQUFBLFVBQ1YsTUFBTTtBQUFBLFVBQ04sT0FBTztBQUFBLFVBQ1AsU0FBUyxRQUFRLFlBQVksZUFBZSxXQUFXO0FBQUEsVUFDdkQsaUJBQWlCO0FBQUEsUUFDckIsQ0FBQztBQUFBLE1BQ0w7QUFFQSxZQUFNLFFBQVEsVUFBVSxzQkFBc0IsRUFBRSxPQUFPLFlBQVksR0FBRyxVQUFVO0FBQ2hGLFlBQU0sUUFBUSxVQUFVLHNCQUFzQixFQUFFLE9BQU8sYUFBYSxHQUFHLFdBQVc7QUFFbEYsYUFBTyxFQUFFLFNBQVMsS0FBSztBQUFBLElBQzNCLFNBQVMsT0FBTztBQUNaLGNBQVEsTUFBTSx3QkFBd0IsS0FBSztBQUMzQyxhQUFPLEVBQUUsT0FBTyxpREFBaUQ7QUFBQSxJQUNyRTtBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQWEsY0FBYyxTQUFpQixPQUE2QjtBQUNyRSxVQUFNLE1BQU0sTUFBTSxRQUFRLFNBQVMsdUJBQXVCLEVBQUUsTUFBTSxHQUFHLE1BQU0sT0FBTztBQUFBLE1BQzlFLE1BQU0sRUFBRSxXQUFXLEdBQUc7QUFBQSxJQUMxQixDQUFDO0FBQ0QsV0FBTyxLQUFLLFVBQVUsR0FBRztBQUFBLEVBQzdCO0FBQUEsRUFFQSxNQUFhLGtCQUFrQixTQUFpQixPQUE2QjtBQUN6RSxVQUFNLE1BQU0sTUFBTSxRQUFRLFNBQVMsK0JBQStCLEVBQUUsTUFBYSxHQUFHLE1BQU0sT0FBTztBQUFBLE1BQzdGLE1BQU0sRUFBRSxXQUFXLEdBQUc7QUFBQSxJQUMxQixDQUFDO0FBQ0QsV0FBTyxLQUFLLFVBQVUsR0FBRztBQUFBLEVBQzdCO0FBQUEsRUFFQSxNQUFhLGtCQUFrQixTQUFpQixPQUE2QjtBQUN6RSxVQUFNLE1BQU0sTUFBTSxRQUFRLFNBQVMsdUJBQXVCLEVBQUUsV0FBVyxNQUFNLEdBQUcsTUFBTSxPQUFPO0FBQUEsTUFDekYsTUFBTSxFQUFFLFdBQVcsR0FBRztBQUFBLElBQzFCLENBQUM7QUFDRCxXQUFPLEtBQUssVUFBVSxHQUFHO0FBQUEsRUFDN0I7QUFBQSxFQUVBLE1BQWEsWUFBWSxTQUFpQixPQUE2QjtBQUNuRSxVQUFNLE1BQU0sTUFBTSxRQUFRLFNBQVMsc0JBQXNCLEVBQUUsT0FBTyxFQUFFLFFBQVEsT0FBTyxVQUFVLElBQUksRUFBRSxHQUFHLE1BQU0sT0FBTztBQUFBLE1BQy9HLE1BQU0sRUFBRSxXQUFXLEdBQUc7QUFBQSxJQUMxQixDQUFDO0FBQ0QsV0FBTyxLQUFLLFVBQVUsR0FBRztBQUFBLEVBQzdCO0FBQUEsRUFFQSxNQUFhLGlCQUFpQixTQUFpQixPQUE2QjtBQUN4RSxVQUFNLE1BQU0sTUFBTSxRQUFRLFNBQVMsOEJBQThCLEVBQUUsTUFBTSxHQUFHLE1BQU0sT0FBTztBQUFBLE1BQ3JGLE1BQU0sRUFBRSxXQUFXLEdBQUc7QUFBQSxJQUMxQixDQUFDO0FBQ0QsV0FBTyxLQUFLLFVBQVUsR0FBRztBQUFBLEVBQzdCO0FBQUEsRUFFQSxNQUFhLGVBQWUsU0FBaUIsTUFBNEI7QUFDckUsVUFBTSxFQUFFLE9BQU8sU0FBUyxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQzNDLFVBQU0sT0FBTyxNQUFNLFFBQVEsUUFBUSxzQkFBc0IsRUFBRSxNQUFNLENBQUM7QUFDbEUsUUFBSSxDQUFDLEtBQU0sUUFBTyxFQUFFLE9BQU8saUJBQWlCO0FBQzVDLFVBQU0sY0FBYyxLQUFLO0FBQ3pCLFNBQUssV0FBVztBQUNoQixVQUFNLFFBQVEsVUFBVSxzQkFBc0IsRUFBRSxNQUFNLEdBQUcsSUFBSTtBQUM3RCxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsUUFBUSxLQUFLLDBDQUEwQyxXQUFXLG1CQUFtQixRQUFRO0FBQUEsTUFDdEcsaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU87QUFBQSxFQUNYO0FBQUEsRUFFQSxNQUFhLGNBQWMsU0FBaUIsTUFBNEI7QUFDcEUsVUFBTSxhQUErQixLQUFLLE1BQU0sSUFBSTtBQUNwRCxVQUFNLFVBQVUsTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsT0FBTyxXQUFXLE1BQU0sQ0FBQztBQUN2RixVQUFNLE9BQU8sTUFBTSxRQUFRLFVBQVUsc0JBQXNCLEVBQUUsT0FBTyxXQUFXLE1BQU0sR0FBRyxVQUFVO0FBQ2xHLFdBQU8sT0FBTztBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsU0FBUyxRQUFRLFdBQVcsS0FBSyxxQ0FBcUMsS0FBSyxVQUFVLE9BQU8sQ0FBQyxlQUFlLEtBQUssVUFBVSxVQUFVLENBQUM7QUFBQSxNQUN0SSxpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQ0QsV0FBTztBQUFBLEVBQ1g7QUFBQSxFQUVBLE1BQWEsV0FBVyxTQUFpQixPQUE2QjtBQUNsRSxVQUFNLE9BQU8sTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsTUFBTSxDQUFDO0FBQ2xFLFFBQUksQ0FBQyxLQUFNLFFBQU8sRUFBRSxPQUFPLGlCQUFpQjtBQUM1QyxTQUFLLFdBQVc7QUFDaEIsVUFBTSxNQUFNLEdBQUk7QUFDaEIsVUFBTSxRQUFRLFVBQVUsc0JBQXNCLEVBQUUsTUFBTSxHQUFHLElBQUk7QUFDN0QsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLFFBQVEsS0FBSztBQUFBLE1BQ3RCLGlCQUFpQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDWDtBQUFBO0FBQUEsRUFHQSxNQUFhLG1CQUFtQixTQUFpQixNQUE0QjtBQUN6RSxRQUFJO0FBQ0EsWUFBTSxFQUFFLGFBQWEsZ0JBQWdCLFNBQVMsY0FBYyxDQUFDLEVBQUUsSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUdsRixZQUFNLFNBQVMsTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsT0FBTyxZQUFZLENBQUM7QUFDakYsWUFBTSxZQUFZLE1BQU0sUUFBUSxRQUFRLHNCQUFzQixFQUFFLE9BQU8sZUFBZSxDQUFDO0FBRXZGLFVBQUksQ0FBQyxVQUFVLENBQUMsV0FBVztBQUN2QixlQUFPLEVBQUUsT0FBTyxpQkFBaUI7QUFBQSxNQUNyQztBQUVBLFlBQU0sVUFBVTtBQUFBLFFBQ1osS0FBSyxhQUFhO0FBQUEsUUFDbEI7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBLFlBQVcsb0JBQUksS0FBSyxHQUFFLFlBQVk7QUFBQSxRQUNsQyxNQUFNO0FBQUEsUUFDTixpQkFBaUI7QUFBQSxRQUNqQixvQkFBb0I7QUFBQSxNQUN4QjtBQUVBLFlBQU0sUUFBUSxVQUFVLGlDQUFpQyxPQUFPO0FBR2hFLFlBQU0sYUFBYSxNQUFNLE1BQU0sdUJBQXVCLFdBQVc7QUFDakUsWUFBTSxnQkFBZ0IsTUFBTSxNQUFNLHVCQUF1QixjQUFjO0FBR3ZFLGlCQUFXLGdCQUFnQixlQUFlO0FBQ3RDLGNBQU0sa0JBQWtCLE1BQU0sUUFBUSxTQUFTLEVBQUUscUJBQXFCLFlBQVk7QUFDbEYsWUFBSSxpQkFBaUI7QUFDakIsa0JBQVEseUJBQXlCLGdCQUFnQixXQUFXLFFBQVEsS0FBSyxVQUFVO0FBQUEsWUFDL0UsSUFBSSxhQUFhO0FBQUEsWUFDakIsT0FBTztBQUFBLFlBQ1AsYUFBYSwrQkFBK0IsT0FBTyxXQUFXO0FBQUEsWUFDOUQsS0FBSztBQUFBLFlBQ0wsU0FBUztBQUFBLFVBQ2IsQ0FBQyxDQUFDO0FBR0Ysa0JBQVEsK0JBQStCLGdCQUFnQixXQUFXLFFBQVEsS0FBSyxVQUFVO0FBQUEsWUFDckY7QUFBQSxZQUNBO0FBQUEsWUFDQTtBQUFBLFVBQ0osQ0FBQyxDQUFDO0FBQUEsUUFDTjtBQUFBLE1BQ0o7QUFHQSxpQkFBVyxhQUFhLFlBQVk7QUFDaEMsY0FBTSxlQUFlLE1BQU0sUUFBUSxTQUFTLEVBQUUscUJBQXFCLFNBQVM7QUFDNUUsWUFBSSxjQUFjO0FBQ2Qsa0JBQVEsK0JBQStCLGFBQWEsV0FBVyxRQUFRLEtBQUssVUFBVTtBQUFBLFlBQ2xGO0FBQUEsWUFDQTtBQUFBLFlBQ0E7QUFBQSxVQUNKLENBQUMsQ0FBQztBQUFBLFFBQ047QUFBQSxNQUNKO0FBRUEsYUFBTyxPQUFPO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxTQUFTLEdBQUcsV0FBVyw4QkFBOEIsY0FBYztBQUFBLFFBQ25FLGlCQUFpQjtBQUFBLE1BQ3JCLENBQUM7QUFFRCxhQUFPLEVBQUUsU0FBUyxNQUFNLFdBQVcsUUFBUSxJQUFJO0FBQUEsSUFDbkQsU0FBUyxPQUFPO0FBQ1osY0FBUSxNQUFNLGdDQUFnQyxLQUFLO0FBQ25ELGFBQU8sRUFBRSxPQUFPLDBDQUEwQztBQUFBLElBQzlEO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBYSxtQkFBbUIsU0FBaUIsTUFBNEI7QUFDekUsUUFBSTtBQUNBLFlBQU0sRUFBRSxXQUFXLGdCQUFnQixRQUFRLElBQUksU0FBUyxFQUFFLElBQUksS0FBSyxNQUFNLElBQUk7QUFFN0UsWUFBTSxXQUFXLE1BQU0sUUFBUSxTQUFTLGlDQUFpQztBQUFBLFFBQ3JFLEtBQUs7QUFBQSxVQUNELEVBQUUsYUFBYSxXQUFXLGdCQUFnQixlQUFlO0FBQUEsVUFDekQsRUFBRSxhQUFhLGdCQUFnQixnQkFBZ0IsVUFBVTtBQUFBLFFBQzdEO0FBQUEsUUFDQSxNQUFNO0FBQUEsVUFDRixFQUFFLGlCQUFpQixFQUFFLEtBQUssS0FBSyxFQUFFO0FBQUEsVUFDakMsRUFBRSxvQkFBb0IsRUFBRSxLQUFLLEtBQUssRUFBRTtBQUFBLFFBQ3hDO0FBQUEsTUFDSixHQUFHLE1BQU0sT0FBTztBQUFBLFFBQ1osTUFBTSxFQUFFLFdBQVcsR0FBRztBQUFBLFFBQ3RCLE1BQU07QUFBQSxRQUNOO0FBQUEsTUFDSixDQUFDO0FBRUQsYUFBTyxLQUFLLFVBQVUsUUFBUTtBQUFBLElBQ2xDLFNBQVMsT0FBTztBQUNaLGNBQVEsTUFBTSxnQ0FBZ0MsS0FBSztBQUNuRCxhQUFPLEVBQUUsT0FBTyw0Q0FBNEM7QUFBQSxJQUNoRTtBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQWEsaUJBQWlCLFNBQWlCLFdBQWlDO0FBQzVFLFFBQUk7QUFFQSxZQUFNLGdCQUFnQixNQUFNLFFBQVEsVUFBVSxpQ0FBaUM7QUFBQSxRQUMzRTtBQUFBLFVBQ0ksUUFBUTtBQUFBLFlBQ0osS0FBSztBQUFBLGNBQ0QsRUFBRSxhQUFhLFVBQVU7QUFBQSxjQUN6QixFQUFFLGdCQUFnQixVQUFVO0FBQUEsWUFDaEM7QUFBQSxZQUNBLE1BQU07QUFBQSxjQUNGLEVBQUUsaUJBQWlCLEVBQUUsS0FBSyxLQUFLLEVBQUU7QUFBQSxjQUNqQyxFQUFFLG9CQUFvQixFQUFFLEtBQUssS0FBSyxFQUFFO0FBQUEsWUFDeEM7QUFBQSxVQUNKO0FBQUEsUUFDSjtBQUFBLFFBQ0E7QUFBQSxVQUNJLE9BQU8sRUFBRSxXQUFXLEdBQUc7QUFBQSxRQUMzQjtBQUFBLFFBQ0E7QUFBQSxVQUNJLFFBQVE7QUFBQSxZQUNKLEtBQUs7QUFBQSxjQUNELE9BQU87QUFBQSxnQkFDSCxFQUFFLEtBQUssQ0FBQyxnQkFBZ0IsU0FBUyxFQUFFO0FBQUEsZ0JBQ25DO0FBQUEsZ0JBQ0E7QUFBQSxjQUNKO0FBQUEsWUFDSjtBQUFBLFlBQ0EsYUFBYSxFQUFFLFFBQVEsU0FBUztBQUFBLFlBQ2hDLGFBQWE7QUFBQSxjQUNULE1BQU07QUFBQSxnQkFDRixPQUFPO0FBQUEsa0JBQ0gsRUFBRSxNQUFNLENBQUMsRUFBRSxLQUFLLENBQUMsbUJBQW1CLFNBQVMsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLFNBQVMsS0FBSyxFQUFFLENBQUMsRUFBRTtBQUFBLGtCQUM3RTtBQUFBLGtCQUNBO0FBQUEsZ0JBQ0o7QUFBQSxjQUNKO0FBQUEsWUFDSjtBQUFBLFVBQ0o7QUFBQSxRQUNKO0FBQUEsUUFDQTtBQUFBLFVBQ0ksU0FBUztBQUFBLFlBQ0wsTUFBTTtBQUFBLFlBQ04sWUFBWTtBQUFBLFlBQ1osY0FBYztBQUFBLFlBQ2QsSUFBSTtBQUFBLFVBQ1I7QUFBQSxRQUNKO0FBQUEsUUFDQTtBQUFBLFVBQ0ksU0FBUztBQUFBLFFBQ2I7QUFBQSxRQUNBO0FBQUEsVUFDSSxVQUFVO0FBQUEsWUFDTixXQUFXO0FBQUEsY0FDUCxPQUFPO0FBQUEsY0FDUCxhQUFhO0FBQUEsY0FDYixRQUFRO0FBQUEsY0FDUixVQUFVO0FBQUEsWUFDZDtBQUFBLFlBQ0EsYUFBYTtBQUFBLFlBQ2IsYUFBYTtBQUFBLFVBQ2pCO0FBQUEsUUFDSjtBQUFBLFFBQ0E7QUFBQSxVQUNJLE9BQU8sRUFBRSx5QkFBeUIsR0FBRztBQUFBLFFBQ3pDO0FBQUEsTUFDSixDQUFDO0FBRUQsYUFBTyxLQUFLLFVBQVUsYUFBYTtBQUFBLElBQ3ZDLFNBQVMsT0FBTztBQUNaLGNBQVEsTUFBTSw4QkFBOEIsS0FBSztBQUNqRCxhQUFPLEVBQUUsT0FBTyxpREFBaUQ7QUFBQSxJQUNyRTtBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQWEsa0JBQWtCLFNBQWlCLE1BQTRCO0FBQ3hFLFFBQUk7QUFDQSxZQUFNLEVBQUUsV0FBVyxVQUFVLElBQUksS0FBSyxNQUFNLElBQUk7QUFFaEQsWUFBTSxVQUFVLE1BQU0sUUFBUSxRQUFRLGlDQUFpQyxFQUFFLEtBQUssVUFBVSxDQUFDO0FBQ3pGLFVBQUksQ0FBQyxRQUFTLFFBQU8sRUFBRSxPQUFPLG9CQUFvQjtBQUdsRCxVQUFJLFFBQVEsbUJBQW1CLFdBQVc7QUFDdEMsZ0JBQVEsT0FBTztBQUNmLGNBQU0sUUFBUSxVQUFVLGlDQUFpQyxFQUFFLEtBQUssVUFBVSxHQUFHLE9BQU87QUFBQSxNQUN4RjtBQUVBLGFBQU8sRUFBRSxTQUFTLEtBQUs7QUFBQSxJQUMzQixTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0sK0JBQStCLEtBQUs7QUFDbEQsYUFBTyxFQUFFLE9BQU8sa0RBQWtEO0FBQUEsSUFDdEU7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFhLGNBQWMsU0FBaUIsTUFBNEI7QUFDcEUsUUFBSTtBQUNBLFlBQU0sRUFBRSxXQUFXLFVBQVUsSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUVoRCxZQUFNLFVBQVUsTUFBTSxRQUFRLFFBQVEsaUNBQWlDLEVBQUUsS0FBSyxVQUFVLENBQUM7QUFDekYsVUFBSSxDQUFDLFFBQVMsUUFBTyxFQUFFLE9BQU8sb0JBQW9CO0FBR2xELFVBQUksUUFBUSxnQkFBZ0IsV0FBVztBQUNuQyxnQkFBUSxrQkFBa0I7QUFBQSxNQUM5QixXQUFXLFFBQVEsbUJBQW1CLFdBQVc7QUFDN0MsZ0JBQVEscUJBQXFCO0FBQUEsTUFDakMsT0FBTztBQUNILGVBQU8sRUFBRSxPQUFPLGVBQWU7QUFBQSxNQUNuQztBQUVBLFlBQU0sUUFBUSxVQUFVLGlDQUFpQyxFQUFFLEtBQUssVUFBVSxHQUFHLE9BQU87QUFFcEYsYUFBTyxPQUFPO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxTQUFTLFFBQVEsU0FBUztBQUFBLFFBQzFCLGlCQUFpQjtBQUFBLE1BQ3JCLENBQUM7QUFFRCxhQUFPLEVBQUUsU0FBUyxLQUFLO0FBQUEsSUFDM0IsU0FBUyxPQUFPO0FBQ1osY0FBUSxNQUFNLDJCQUEyQixLQUFLO0FBQzlDLGFBQU8sRUFBRSxPQUFPLDJDQUEyQztBQUFBLElBQy9EO0FBQUEsRUFDSjtBQUFBO0FBQUEsRUFHQSxNQUFhLGFBQWEsU0FBaUIsT0FBNkI7QUFDcEUsUUFBSTtBQUNBLFlBQU0sT0FBTyxNQUFNLFFBQVEsUUFBUSxzQkFBc0IsRUFBRSxNQUFNLENBQUM7QUFDbEUsVUFBSSxDQUFDLEtBQU0sUUFBTyxFQUFFLE9BQU8saUJBQWlCO0FBRTVDLFlBQU0sWUFBWSxNQUFNLFFBQVE7QUFBQSxRQUFTO0FBQUEsUUFDckMsRUFBRSxPQUFPLEVBQUUsS0FBSyxLQUFLLFVBQVUsRUFBRTtBQUFBLFFBQ2pDO0FBQUEsUUFBTTtBQUFBLFFBQ04sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLEVBQUU7QUFBQSxNQUMvQjtBQUVBLGFBQU8sS0FBSyxVQUFVLFNBQVM7QUFBQSxJQUNuQyxTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0sMEJBQTBCLEtBQUs7QUFDN0MsYUFBTyxFQUFFLE9BQU8sNkNBQTZDO0FBQUEsSUFDakU7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFhLGFBQWEsU0FBaUIsT0FBNkI7QUFDcEUsUUFBSTtBQUNBLFlBQU0sT0FBTyxNQUFNLFFBQVEsUUFBUSxzQkFBc0IsRUFBRSxNQUFNLENBQUM7QUFDbEUsVUFBSSxDQUFDLEtBQU0sUUFBTyxFQUFFLE9BQU8saUJBQWlCO0FBRTVDLFlBQU0sWUFBWSxNQUFNLFFBQVE7QUFBQSxRQUFTO0FBQUEsUUFDckMsRUFBRSxPQUFPLEVBQUUsS0FBSyxLQUFLLFVBQVUsRUFBRTtBQUFBLFFBQ2pDO0FBQUEsUUFBTTtBQUFBLFFBQ04sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLEVBQUU7QUFBQSxNQUMvQjtBQUVBLGFBQU8sS0FBSyxVQUFVLFNBQVM7QUFBQSxJQUNuQyxTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0sMEJBQTBCLEtBQUs7QUFDN0MsYUFBTyxFQUFFLE9BQU8sNkNBQTZDO0FBQUEsSUFDakU7QUFBQSxFQUNKO0FBRUo7QUF2NUJvQjtBQUFwQixJQUFNLGdCQUFOO0FBeTVCTyxJQUFNLGdCQUFnQixJQUFJLGNBQWM7OztBQzU1Qi9DLGlCQUFpQixzQkFBc0IsY0FBYyxlQUFlO0FBQ3BFLGlCQUFpQixnQkFBZ0IsY0FBYyxLQUFLO0FBQ3BELGlCQUFpQixpQkFBaUIsY0FBYyxNQUFNO0FBQ3RELGlCQUFpQiw4QkFBOEIsY0FBYyxtQkFBbUI7QUFDaEYsaUJBQWlCLG9CQUFvQixjQUFjLFNBQVM7QUFDNUQsaUJBQWlCLHFCQUFxQixjQUFjLFVBQVU7QUFDOUQsaUJBQWlCLHFCQUFxQixjQUFjLFVBQVU7QUFDOUQsaUJBQWlCLG9CQUFvQixjQUFjLFNBQVM7QUFDNUQsaUJBQWlCLHVCQUF1QixjQUFjLE9BQU87QUFDN0QsaUJBQWlCLHNCQUFzQixjQUFjLFdBQVc7QUFDaEUsaUJBQWlCLG9CQUFvQixjQUFjLFNBQVM7QUFDNUQsaUJBQWlCLHFCQUFxQixjQUFjLGNBQWM7QUFDbEUsaUJBQWlCLDBCQUEwQixjQUFjLGdCQUFnQjtBQUN6RSxpQkFBaUIsNkJBQTZCLGNBQWMsbUJBQW1CO0FBQy9FLGlCQUFpQiwrQkFBK0IsY0FBYyxvQkFBb0I7QUFDbEYsaUJBQWlCLCtCQUErQixjQUFjLG9CQUFvQjtBQUNsRixpQkFBaUIsNkJBQTZCLGNBQWMsa0JBQWtCO0FBQzlFLGlCQUFpQixxQkFBcUIsY0FBYyxVQUFVO0FBQzlELGlCQUFpQix3QkFBd0IsY0FBYyxhQUFhO0FBQ3BFLGlCQUFpQiw0QkFBNEIsY0FBYyxpQkFBaUI7QUFDNUUsaUJBQWlCLDRCQUE0QixjQUFjLGlCQUFpQjtBQUM1RSxpQkFBaUIsdUJBQXVCLGNBQWMsV0FBVztBQUNqRSxpQkFBaUIsMkJBQTJCLGNBQWMsZ0JBQWdCO0FBQzFFLGlCQUFpQix5QkFBeUIsY0FBYyxjQUFjO0FBQ3RFLGlCQUFpQix3QkFBd0IsY0FBYyxhQUFhO0FBR3BFLGlCQUFpQiw2QkFBNkIsY0FBYyxrQkFBa0I7QUFDOUUsaUJBQWlCLDZCQUE2QixjQUFjLGtCQUFrQjtBQUM5RSxpQkFBaUIsMkJBQTJCLENBQUMsUUFBZ0IsU0FBaUI7QUFDMUUsU0FBTyxjQUFjLGlCQUFpQixRQUFRLElBQUk7QUFDdEQsQ0FBQztBQUNELGlCQUFpQiw0QkFBNEIsY0FBYyxpQkFBaUI7QUFDNUUsaUJBQWlCLHdCQUF3QixjQUFjLGFBQWE7QUFHcEUsaUJBQWlCLHVCQUF1QixjQUFjLFlBQVk7QUFDbEUsaUJBQWlCLHVCQUF1QixjQUFjLFlBQVk7OztBQ3BDbEUsaUJBQWlCLGtCQUFrQixPQUFPLFdBQVc7QUFDakQsUUFBTSxTQUFTLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsTUFBTTtBQUNoRixRQUFNLGFBQWEsTUFBTSxNQUFNLE1BQU0sdUxBQXVMLENBQUMsTUFBTSxDQUFDO0FBQ3BPLFFBQU0sU0FBUyxNQUFNLE1BQU0sTUFBTSwwSkFBMEosQ0FBQyxNQUFNLENBQUM7QUFDbk0sUUFBTSxNQUFNO0FBQUEsSUFDUjtBQUFBLElBQ0E7QUFBQSxFQUNKO0FBQ0EsU0FBTyxLQUFLLFVBQVUsR0FBRztBQUM3QixDQUFDO0FBRUQsaUJBQWlCLHFCQUFxQixPQUFPLFFBQVEsU0FBUztBQUMxRCxRQUFNLE1BQU0sS0FBSyxNQUFNLElBQUk7QUFDM0IsTUFBSSxVQUFxQyxDQUFDO0FBRTFDLE1BQUksT0FBTyxJQUFJLFNBQVMsR0FBRztBQUV2QixVQUFNLG9CQUFvQixJQUFJO0FBQUEsTUFBSSxDQUFDLFVBQy9CLE1BQU0sTUFBTSwrREFBK0QsQ0FBQyxLQUFLLENBQUM7QUFBQSxJQUN0RjtBQUVBLFVBQU0sZ0JBQWdCLE1BQU0sUUFBUSxJQUFJLGlCQUFpQjtBQUV6RCxrQkFBYyxRQUFRLGdCQUFjO0FBQ2hDLGNBQVEsSUFBSSxVQUFVO0FBQ3RCLFVBQUksY0FBYyxXQUFXLFNBQVMsR0FBRztBQUNyQyxtQkFBVyxRQUFRLENBQUMsY0FBbUI7QUFDbkMsZ0JBQU0sV0FBVyxLQUFLLE1BQU0sVUFBVSxRQUFRO0FBQzlDLGdCQUFNLFdBQVcsR0FBRyxTQUFTLFNBQVMsSUFBSSxTQUFTLFFBQVE7QUFDM0Qsa0JBQVEsVUFBVSxTQUFTLElBQUk7QUFBQSxRQUNuQyxDQUFDO0FBQUEsTUFDTDtBQUFBLElBQ0osQ0FBQztBQUFBLEVBQ0w7QUFFQSxTQUFPLEtBQUssVUFBVSxPQUFPO0FBQ2pDLENBQUM7QUFFRCxpQkFBaUIsZ0JBQWdCLE9BQU8sUUFBUSxTQUFTO0FBQ3JELFFBQU0sRUFBRSxJQUFJLElBQUksSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUNuQyxRQUFNLFFBQWEsTUFBTSxNQUFNLE1BQU0sa0RBQWtELENBQUMsRUFBRSxDQUFDO0FBQzNGLE1BQUksU0FBUyxNQUFNLFNBQVMsR0FBRztBQUMzQixVQUFNLFlBQVksTUFBTSxDQUFDO0FBQ3pCLFVBQU0sWUFBWSxLQUFLLE1BQU0sVUFBVSxVQUFVO0FBQ2pELFVBQU0sWUFBWSxVQUFVLE9BQU8sQ0FBQyxXQUFtQixXQUFXLEdBQUc7QUFDckUsWUFBUSxJQUFJLFNBQVM7QUFDckIsVUFBTSxNQUFNLE1BQU0sOERBQThELENBQUMsS0FBSyxVQUFVLFNBQVMsR0FBRyxFQUFFLENBQUM7QUFDL0csV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLHVCQUF1QixHQUFHLE9BQU8sVUFBVSxNQUFNLEtBQUssVUFBVSxXQUFXLE9BQU8sTUFBTSxNQUFNLDBCQUEwQixNQUFNLE1BQU0sdUJBQXVCLE1BQU0sQ0FBQyxDQUFDO0FBQUEsTUFDNUssaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUFBLEVBQ0w7QUFDQSxTQUFPO0FBQ1gsQ0FBQzs7O0FDdkRELGlCQUFpQix1QkFBdUIsT0FBT0MsU0FBUSxTQUFpQjtBQUNwRSxRQUFNLEVBQUUsT0FBTyxTQUFTLGlCQUFpQixhQUFhLE1BQU0sSUFBSSxLQUFLLE1BQU0sSUFBSTtBQUMvRSxRQUFNLFFBQVE7QUFBQSxJQUNWLEtBQUssYUFBYTtBQUFBLElBQ2xCO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0EsWUFBVyxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLEVBQ3RDO0FBQ0EsUUFBTSxNQUFNLE1BQU0sUUFBUSxVQUFVLG1CQUFtQixLQUFLO0FBQzVELFFBQU0sc0JBQXNCLHlCQUF5QixJQUFJLEtBQUssVUFBVSxLQUFLLENBQUM7QUFDOUUsU0FBTyxPQUFPO0FBQUEsSUFDVixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsSUFDUCxTQUFTLFNBQVMsS0FBSyxVQUFVLE1BQU0sR0FBRyxnQkFBZ0IsZUFBZSxLQUFLLGNBQWMsT0FBTztBQUFBLElBQ25HLGlCQUFpQjtBQUFBLEVBQ3JCLENBQUM7QUFDTCxDQUFDO0FBRUQsaUJBQWlCLHFCQUFxQixPQUFPQSxZQUFXO0FBQ3BELFFBQU0sTUFBTSxNQUFNLFFBQVEsU0FBUyxtQkFBbUIsQ0FBQyxHQUFHLE1BQU0sT0FBTztBQUFBLElBQ25FLE1BQU0sRUFBRSxXQUFXLEdBQUc7QUFBQSxFQUMxQixDQUFDO0FBQ0QsU0FBTyxLQUFLLFVBQVUsR0FBRztBQUM3QixDQUFDO0FBRUQsaUJBQWlCLHVCQUF1QixPQUFPQSxTQUFRLFNBQWlCO0FBQ3BFLFFBQU0sT0FBTyxNQUFNLFFBQVEsUUFBUSxtQkFBbUIsRUFBRSxLQUFLLEtBQUssQ0FBQztBQUNuRSxRQUFNLE1BQU0sTUFBTSxRQUFRLFVBQVUsbUJBQW1CLEVBQUUsS0FBSyxLQUFLLENBQUM7QUFDcEUsUUFBTSxzQkFBc0IsOEJBQThCLElBQUksSUFBSTtBQUNsRSxTQUFPLE9BQU87QUFBQSxJQUNWLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxJQUNQLFNBQVMsU0FBUyxLQUFLLEtBQUssVUFBVSxJQUFJLGdCQUFnQixLQUFLLGVBQWUsS0FBSyxLQUFLLGNBQWMsS0FBSyxPQUFPO0FBQUEsSUFDbEgsaUJBQWlCO0FBQUEsRUFDckIsQ0FBQztBQUNMLENBQUM7OztBQzVCRCxpQkFBaUIsd0JBQXdCLE9BQU9DLFlBQW1CO0FBQy9ELE1BQUksVUFBd0IsQ0FBQztBQUM3QixRQUFNLFlBQVksTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLDJCQUEyQkEsT0FBTTtBQUNuRixRQUFNLE1BQU0sTUFBTSxNQUFNLE1BQU0sOEZBQThGLENBQUMsU0FBUyxDQUFDO0FBQ3ZJLFFBQU0sY0FBYyxVQUFVLE9BQU87QUFFckMsYUFBVyxXQUFXLEtBQUs7QUFDdkIsVUFBTSxPQUFPLFlBQVksUUFBUSxPQUFPO0FBQ3hDLFFBQUksTUFBTTtBQUVOLFVBQUk7QUFDSixVQUFJLFFBQVEsVUFBVSxHQUFHO0FBQ3JCLGdCQUFRO0FBQUEsTUFDWixXQUFXLFFBQVEsVUFBVSxHQUFHO0FBQzVCLGdCQUFRO0FBQUEsTUFDWixXQUFXLE9BQU8sUUFBUSxVQUFVLElBQUksR0FBRztBQUN2QyxnQkFBUTtBQUFBLE1BQ1osT0FBTztBQUNILGdCQUFRO0FBQUEsTUFDWjtBQUVBLGNBQVEsS0FBSztBQUFBLFFBQ1QsT0FBTyxRQUFRO0FBQUEsUUFDZixRQUFRLFFBQVE7QUFBQSxRQUNoQjtBQUFBLFFBQ0EsVUFBVSxLQUFLO0FBQUEsUUFDZixPQUFPLEtBQUs7QUFBQSxRQUNaLE1BQU0sS0FBSztBQUFBLFFBQ1gsZ0JBQWdCLEtBQUssTUFBTSxRQUFRLElBQUksRUFBRTtBQUFBLFFBQ3pDLFlBQVksS0FBSyxNQUFNLFFBQVEsSUFBSSxFQUFFO0FBQUEsUUFDckMsWUFBWSxLQUFLLE1BQU0sUUFBUSxJQUFJLEVBQUU7QUFBQSxRQUNyQyxXQUFXLEtBQUssTUFBTSxRQUFRLElBQUksRUFBRTtBQUFBLFFBQ3BDLGNBQWMsS0FBSyxNQUFNLFFBQVEsSUFBSSxFQUFFO0FBQUEsUUFDdkMsZUFBZSxLQUFLLE1BQU0sUUFBUSxJQUFJLEVBQUU7QUFBQSxRQUN4QyxpQkFBaUIsS0FBSyxNQUFNLFFBQVEsSUFBSSxFQUFFO0FBQUEsUUFDMUMsV0FBVyxLQUFLLE1BQU0sUUFBUSxJQUFJLEVBQUU7QUFBQSxRQUNwQyxXQUFXLEtBQUssTUFBTSxRQUFRLElBQUksRUFBRTtBQUFBLE1BQ3hDLENBQUM7QUFBQSxJQUNMO0FBQUEsRUFDSjtBQUNBLFNBQU8sS0FBSyxVQUFVLE9BQU87QUFDakMsQ0FBQzs7O0FDaERELFNBQVMscUJBQXFCO0FBQzFCLE1BQUksYUFBYTtBQUNqQixXQUFTLElBQUksR0FBRyxJQUFJLElBQUksS0FBSztBQUN6QixrQkFBYyxLQUFLLE1BQU0sS0FBSyxPQUFPLElBQUksRUFBRTtBQUFBLEVBQy9DO0FBQ0EsU0FBTztBQUNYO0FBTlM7QUFRVCxTQUFTLDRCQUE0QjtBQUNqQyxRQUFNLFdBQVc7QUFDakIsTUFBSSxnQkFBZ0I7QUFDcEIsV0FBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLEtBQUs7QUFDekIscUJBQWlCLEtBQUssTUFBTSxLQUFLLE9BQU8sSUFBSSxFQUFFO0FBQUEsRUFDbEQ7QUFDQSxTQUFPLEdBQUcsUUFBUSxJQUFJLGFBQWE7QUFDdkM7QUFQUztBQVNULGlCQUFpQixnQkFBZ0IsT0FBT0MsWUFBbUI7QUFDdkQsUUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsVUFBVUEsT0FBTTtBQUMzRCxRQUFNLE1BQU0sTUFBTSxRQUFRLFFBQVEsbUJBQW1CLEVBQUUsV0FBVyxVQUFVLFdBQVcsVUFBVSxDQUFDO0FBQ2xHLE1BQUksS0FBSztBQUNMLFdBQU8sS0FBSyxVQUFVO0FBQUEsTUFDbEIsR0FBRztBQUFBLE1BQ0gsU0FBUyxNQUFNLFVBQVUsV0FBVyxNQUFNO0FBQUEsTUFDMUMsUUFBUSxNQUFNLFVBQVUsV0FBVyxNQUFNO0FBQUEsSUFDN0MsQ0FBQztBQUFBLEVBQ0wsT0FBTztBQUNILFVBQU0sT0FBTyxNQUFNLFFBQVEsU0FBUyxFQUFFLGNBQWNBLE9BQU07QUFDMUQsVUFBTSxhQUFhLG1CQUFtQjtBQUN0QyxVQUFNLFVBQVUsS0FBSyxNQUFNLEtBQUssT0FBTyxJQUFJLEdBQUs7QUFDaEQsVUFBTSxjQUFjLDBCQUEwQjtBQUM5QyxVQUFNLE9BQU87QUFBQSxNQUNULEtBQUssYUFBYTtBQUFBLE1BQ2xCLFdBQVcsVUFBVSxXQUFXO0FBQUEsTUFDaEM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLFNBQVM7QUFBQSxJQUNiO0FBQ0EsVUFBTSxRQUFRLFVBQVUsbUJBQW1CLElBQUk7QUFDL0MsV0FBTyxLQUFLLFVBQVU7QUFBQSxNQUNsQixHQUFHO0FBQUEsTUFDSCxTQUFTLFVBQVUsV0FBVyxNQUFNO0FBQUEsTUFDcEMsUUFBUSxVQUFVLFdBQVcsTUFBTTtBQUFBLElBQ3ZDLENBQUM7QUFBQSxFQUNMO0FBQ0osQ0FBQztBQUVELGlCQUFpQixnQkFBZ0IsT0FBTyxRQUFRLFdBQVc7QUFDdkQsTUFBSSxZQUFZLE1BQU0sTUFBTSwwQkFBMEIsT0FBTyxNQUFNLENBQUM7QUFDcEUsTUFBSSxXQUFXO0FBQ1gsVUFBTSxNQUFxQixNQUFNLFFBQVEsUUFBUSxtQkFBbUIsRUFBRSxVQUFxQixDQUFDO0FBQzVGLFFBQUksS0FBSztBQUNMLGFBQU8sSUFBSTtBQUFBLElBQ2YsT0FBTztBQUNILGFBQU87QUFBQSxJQUNYO0FBQUEsRUFDSixPQUFPO0FBQ0gsV0FBTztBQUFBLEVBQ1g7QUFDSixDQUFDO0FBRUQsaUJBQWlCLDRCQUE0QixPQUFPLFFBQVEsU0FBaUI7QUFDekUsUUFBTSxFQUFFLFFBQVEsR0FBRyxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQ3RDLFFBQU0sTUFBcUIsTUFBTSxRQUFRLFFBQVEsbUJBQW1CLEVBQUUsYUFBYSxHQUFHLENBQUM7QUFDdkYsTUFBSSxDQUFDLElBQUssUUFBTztBQUNqQixRQUFNLGVBQWUsTUFBTSxRQUFRLFNBQVMsRUFBRSxxQkFBcUIsSUFBSSxTQUFTO0FBQ2hGLFFBQU0sZUFBZSxNQUFNLFFBQVEsU0FBUyxFQUFFLFVBQVUsTUFBTTtBQUM5RCxNQUFJLENBQUMsTUFBTSxnQkFBZ0IsYUFBYSxXQUFXLE1BQU0sRUFBRyxRQUFPO0FBQ25FLE1BQUksYUFBYSxXQUFXLE1BQU0sT0FBTyxPQUFRLFFBQU87QUFDeEQsTUFBSSxNQUFNLGFBQWEsVUFBVSxZQUFZLFFBQVEsTUFBTSxHQUFHO0FBQzFELGlCQUFhLFVBQVUsU0FBUyxRQUFRLE1BQU07QUFDOUMsWUFBUSx5QkFBeUIsUUFBUSxLQUFLLFVBQVU7QUFBQSxNQUNwRCxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhLHlCQUF5QixNQUFNLE9BQU8sSUFBSSxJQUFJO0FBQUEsTUFDM0QsS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBQ0YsWUFBUSx5QkFBeUIsYUFBYSxXQUFXLFFBQVEsS0FBSyxVQUFVO0FBQUEsTUFDNUUsSUFBSSxhQUFhO0FBQUEsTUFDakIsT0FBTztBQUFBLE1BQ1AsYUFBYSxzQkFBc0IsTUFBTSxTQUFTLGFBQWEsV0FBVyxTQUFTLFNBQVMsSUFBSSxhQUFhLFdBQVcsU0FBUyxRQUFRO0FBQUEsTUFDekksS0FBSztBQUFBLE1BQ0wsU0FBUztBQUFBLElBQ2IsQ0FBQyxDQUFDO0FBRUYsVUFBTSxRQUFRLFVBQVUsMkJBQTJCO0FBQUEsTUFDL0MsS0FBSyxhQUFhO0FBQUEsTUFDbEIsTUFBTSxhQUFhLFdBQVc7QUFBQSxNQUM5QixJQUFJLElBQUk7QUFBQSxNQUNSO0FBQUEsTUFDQSxNQUFNO0FBQUEsTUFDTixPQUFNLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsSUFDakMsQ0FBQztBQUNELFVBQU0sUUFBUSxVQUFVLDJCQUEyQjtBQUFBLE1BQy9DLEtBQUssYUFBYTtBQUFBLE1BQ2xCLE1BQU0sSUFBSTtBQUFBLE1BQ1YsSUFBSSxhQUFhLFdBQVc7QUFBQSxNQUM1QjtBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ04sT0FBTSxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLElBQ2pDLENBQUM7QUFDRCxXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsR0FBRyxhQUFhLFdBQVcsU0FBUyxTQUFTLElBQUksYUFBYSxXQUFXLFNBQVMsUUFBUSxxQkFBcUIsTUFBTSxPQUFPLElBQUksSUFBSTtBQUFBLE1BQzdJLGlCQUFpQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDWCxPQUFPO0FBQ0gsV0FBTztBQUFBLEVBQ1g7QUFDSixDQUFDO0FBRUQsaUJBQWlCLG1CQUFtQixPQUFPLFdBQVc7QUFDbEQsUUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLE1BQU07QUFDNUUsUUFBTSxlQUFlLE1BQU0sUUFBUSxTQUFTLDJCQUEyQixFQUFFLE1BQU0sVUFBVSxHQUFHLE1BQU0sT0FBTztBQUFBLElBQ3JHLE1BQU0sRUFBRSxNQUFNLEdBQUc7QUFBQSxFQUNyQixDQUFDO0FBQ0QsU0FBTyxLQUFLLFVBQVUsWUFBWTtBQUN0QyxDQUFDO0FBRUQsaUJBQWlCLHdCQUF3QixPQUFPLFFBQVEsU0FBaUI7QUFDckUsUUFBTSxFQUFFLGFBQWEsUUFBUSxhQUFhLGtCQUFrQixZQUFZLFNBQVUsSUFBSSxLQUFLLE1BQU0sSUFBSTtBQVNyRyxRQUFNLGVBQWUsTUFBTSxRQUFRLFNBQVMsRUFBRSxVQUFVLE1BQU07QUFDOUQsUUFBTSxlQUFlLE1BQU0sUUFBUSxTQUFTLEVBQUUsVUFBVSxRQUFRO0FBQ2hFLE1BQUksQ0FBQyxhQUFjLFFBQU87QUFDMUIsTUFBSSxTQUFTLEVBQUcsUUFBTztBQUN2QixRQUFNLE1BQU0sTUFBTSxRQUFRLFVBQVUsdUJBQXVCO0FBQUEsSUFDdkQsS0FBSyxhQUFhO0FBQUEsSUFDbEIsTUFBTSxhQUFhLFdBQVc7QUFBQSxJQUM5QixJQUFJLGFBQWEsV0FBVztBQUFBLElBQzVCO0FBQUEsSUFDQSxRQUFRO0FBQUEsSUFDUjtBQUFBLElBQ0EsWUFBWSxHQUFHLGFBQWEsV0FBVyxTQUFTLFNBQVMsSUFBSSxhQUFhLFdBQVcsU0FBUyxRQUFRO0FBQUEsSUFDdEcsWUFBWSxHQUFHLGFBQWEsV0FBVyxTQUFTLFNBQVMsSUFBSSxhQUFhLFdBQVcsU0FBUyxRQUFRO0FBQUEsSUFDdEc7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0EsT0FBTSxvQkFBSSxLQUFLLEdBQUUsWUFBWTtBQUFBLEVBQ2pDLENBQUM7QUFDRCxNQUFJLEtBQUs7QUFDTCxZQUFRLHlCQUF5QixhQUFhLFdBQVcsUUFBUSxLQUFLLFVBQVU7QUFBQSxNQUM1RSxJQUFJLGFBQWE7QUFBQSxNQUNqQixPQUFPO0FBQUEsTUFDUCxhQUFhLEdBQUcsYUFBYSxXQUFXLFNBQVMsU0FBUyxJQUFJLGFBQWEsV0FBVyxTQUFTLFFBQVEsZ0NBQWdDLE1BQU07QUFBQSxNQUM3SSxLQUFLO0FBQUEsTUFDTCxTQUFTO0FBQUEsSUFDYixDQUFDLENBQUM7QUFDRixXQUFPLE9BQU87QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxNQUNQLFNBQVMsR0FBRyxhQUFhLFdBQVcsU0FBUyxTQUFTLElBQUksYUFBYSxXQUFXLFNBQVMsUUFBUSw0QkFBNEIsTUFBTSxPQUFPLGFBQWEsV0FBVyxTQUFTLFNBQVMsSUFBSSxhQUFhLFdBQVcsU0FBUyxRQUFRO0FBQUEsTUFDbk8saUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU87QUFBQSxFQUNYO0FBQ0EsU0FBTztBQUNYLENBQUM7QUFFRCxpQkFBaUIsc0JBQXNCLE9BQU8sUUFBUSxTQUFTO0FBQzNELFFBQU0sWUFBWSxNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQixNQUFNO0FBQzVFLE1BQUksU0FBUyxRQUFRO0FBQ2pCLFVBQU0sV0FBVyxNQUFNLFFBQVEsU0FBUyx1QkFBdUIsRUFBRSxNQUFNLFVBQVUsR0FBRyxNQUFNLE9BQU87QUFBQSxNQUM3RixNQUFNLEVBQUUsTUFBTSxHQUFHO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU8sS0FBSyxVQUFVLFFBQVE7QUFBQSxFQUNsQyxPQUFPO0FBQ0gsVUFBTSxXQUFXLE1BQU0sUUFBUSxTQUFTLHVCQUF1QixFQUFFLElBQUksVUFBVSxHQUFHLE1BQU0sT0FBTztBQUFBLE1BQzNGLE1BQU0sRUFBRSxNQUFNLEdBQUc7QUFBQSxJQUNyQixDQUFDO0FBQ0QsV0FBTyxLQUFLLFVBQVUsUUFBUTtBQUFBLEVBQ2xDO0FBQ0osQ0FBQztBQXVCRCxJQUFNLGFBQWE7QUFLbkIsSUFBTSxvQkFBb0IsOEJBQU8sUUFBZ0IsUUFBUSxTQUFTLEVBQUUsVUFBVSxHQUFHLEdBQXZEO0FBQzFCLElBQU0sdUJBQXVCLDhCQUFPLFFBQWE7QUE1TmpEO0FBNE5vRCw2QkFBUSxTQUFTLEdBQUUseUJBQW5CLDRCQUEwQztBQUFBLEdBQWpFO0FBRzdCLElBQU0sWUFBWSx3QkFBQyxRQUFhLFdBQWdCO0FBL05oRDtBQStObUQsdURBQVEsY0FBUixtQkFBbUIsZ0JBQW5CLDRCQUFpQyxRQUFRLFFBQVEsdUJBQXNCO0FBQUEsR0FBeEc7QUFDbEIsSUFBTSxhQUFhLHdCQUFDLFFBQWEsV0FBbUIsT0FBTyxVQUFVLFNBQVMsUUFBUSxRQUFRLGtCQUFrQixLQUFLLE9BQWxHO0FBRW5CLElBQU0sU0FBUyx3QkFBQyxLQUFhLE9BQWUsYUFBcUIsVUFBVSxRQUFTO0FBQ2hGLFVBQVEseUJBQXlCLEtBQUssS0FBSyxVQUFVO0FBQUEsSUFDakQsSUFBSSxhQUFhO0FBQUEsSUFDakI7QUFBQSxJQUFPO0FBQUEsSUFBYSxLQUFLO0FBQUEsSUFBWTtBQUFBLEVBQ3pDLENBQUMsQ0FBQztBQUNOLEdBTGU7QUFPZixJQUFNLFNBQVMsOEJBQU0sb0JBQUksS0FBSyxHQUFFLFlBQVksR0FBN0I7QUFFZixJQUFNLGNBQWMsd0JBQUMsS0FBYSxRQUE0QjtBQUMxRCxRQUFNLElBQUksSUFBSSxLQUFLLEdBQUc7QUFDdEIsVUFBUSxLQUFLO0FBQUEsSUFDVCxLQUFLO0FBQUcsUUFBRSxRQUFRLEVBQUUsUUFBUSxJQUFJLENBQUM7QUFBRztBQUFBO0FBQUEsSUFDcEMsS0FBSztBQUFHLFFBQUUsUUFBUSxFQUFFLFFBQVEsSUFBSSxDQUFDO0FBQUc7QUFBQTtBQUFBLElBQ3BDLEtBQUs7QUFBRyxRQUFFLFNBQVMsRUFBRSxTQUFTLElBQUksQ0FBQztBQUFHO0FBQUE7QUFBQSxJQUN0QyxLQUFLO0FBQUcsUUFBRSxTQUFTLEVBQUUsU0FBUyxJQUFJLENBQUM7QUFBRztBQUFBO0FBQUEsSUFDdEMsS0FBSztBQUFHLFFBQUUsWUFBWSxFQUFFLFlBQVksSUFBSSxDQUFDO0FBQUc7QUFBQSxFQUNoRDtBQUNBLFNBQU8sRUFBRSxZQUFZO0FBQ3pCLEdBVm9CO0FBdUJwQixJQUFNLDBCQUEwQiw4QkFBTyxtQkFBMkIsV0FBcUM7QUFsUXZHO0FBbVFJLE1BQUk7QUFDQSxVQUFNLFdBQVcsTUFBTSxxQkFBcUIsaUJBQWlCO0FBQzdELFVBQU0sV0FBOEIsZ0RBQVUsZUFBVixtQkFBc0IsUUFBdEIsbUJBQTJCO0FBQy9ELFVBQU0sYUFBYSxXQUFXLEdBQUcsU0FBUyxXQUFXLFNBQVMsU0FBUyxJQUFJLFNBQVMsV0FBVyxTQUFTLFFBQVEsS0FBSztBQUdySCxRQUFJLFNBQVM7QUFDVCxjQUFRLGlCQUFpQixFQUFFLGdCQUFnQixTQUFTLE1BQU07QUFFMUQsY0FBUSxpQkFBaUIsRUFBRSxrQkFBa0IsU0FBUyw4QkFBOEIsUUFBUSw2Q0FBNkMsU0FBUyxZQUFZLFdBQVcsYUFBYSxDQUFDO0FBQ3ZMLGNBQVEsaUJBQWlCLEVBQUUsa0JBQWtCLFNBQVMsOEJBQThCLFFBQVEsaUNBQWlDLFlBQVksU0FBUyxZQUFZLGFBQWEsQ0FBQztBQUU1SyxhQUFPO0FBQUEsSUFDWDtBQUVBLFFBQUksVUFBVTtBQUNWLGFBQU8sV0FBVyxVQUFVLE1BQU07QUFBQSxJQUN0QztBQUNBLFdBQU87QUFBQSxFQUNYLFNBQVMsR0FBRztBQUNSLFlBQVEsTUFBTSxrQ0FBa0MsQ0FBQztBQUNqRCxXQUFPO0FBQUEsRUFDWDtBQUNKLEdBeEJnQztBQTJCaEMsSUFBTSxlQUFlLHdCQUFDLE1BQWMsWUFBb0IsT0FBTyxPQUFPO0FBQUEsRUFDbEUsTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLEVBQ1A7QUFBQSxFQUNBLGlCQUFpQjtBQUNyQixDQUFDLEdBTG9CO0FBT3JCLGlCQUFpQiwrQkFBK0IsT0FBTyxRQUFnQixPQUFlO0FBcFN0RjtBQXFTSSxRQUFNLGNBQWMsTUFBTSxrQkFBa0IsTUFBTTtBQUNsRCxNQUFJLENBQUMsWUFBYSxRQUFPO0FBRXpCLFFBQU0sWUFBbUIsaUJBQVksZUFBWixtQkFBd0I7QUFDakQsUUFBTSxVQUFVLE1BQU0sUUFBUSxRQUFRLFlBQVksRUFBRSxLQUFLLEdBQUcsQ0FBQztBQUM3RCxNQUFJLENBQUMsUUFBUyxRQUFPO0FBR3JCLE1BQUksUUFBUSxPQUFPLFNBQVUsUUFBTztBQUNwQyxNQUFJLFFBQVEsV0FBVyxhQUFhLFFBQVEsV0FBVyxZQUFZLFFBQVEsV0FBVyxVQUFXLFFBQU87QUFDeEcsTUFBSSxRQUFRLFVBQVUsRUFBRyxRQUFPO0FBQ2hDLE1BQUksUUFBUSxTQUFTLFFBQVEsR0FBSSxRQUFPO0FBRXhDLFFBQU0sWUFBWSxNQUFNLHFCQUFxQixRQUFRLElBQUk7QUFFekQsUUFBTSxVQUFVLFVBQVUsYUFBYSxRQUFRLE1BQU07QUFDckQsTUFBSSxDQUFDLFNBQVM7QUFFVixVQUFNQyxlQUFjLFFBQVEsZ0JBQWdCLE1BQU0sUUFBUSxxQkFBcUI7QUFDL0UsUUFBSUEsY0FBYTtBQUNiLFlBQU0sUUFBUSxVQUFVLFlBQVksRUFBRSxLQUFLLEdBQUcsR0FBRztBQUFBLFFBQzdDLFFBQVE7QUFBQSxRQUNSLGVBQWUsT0FBTztBQUFBLFFBQ3RCLGlCQUFpQixRQUFRLGtCQUFrQixLQUFLO0FBQUEsTUFDcEQsQ0FBQztBQUFBLElBQ0w7QUFDQSxXQUFPLFlBQVksV0FBVyxRQUFRLFVBQVUsOEJBQThCLFFBQVEsTUFBTSxHQUFHO0FBQy9GLFdBQU87QUFBQSxFQUNYO0FBR0EsTUFBSSxXQUFXO0FBQ2YsTUFBSSxRQUFRLGVBQWUsT0FBTztBQUM5QixVQUFNLGFBQWE7QUFDbkIsVUFBTSxtQkFBbUIsS0FBSyxNQUFNLFFBQVEsU0FBUyxVQUFVO0FBQy9ELFVBQU0sZUFBZSxLQUFLLE1BQU0sUUFBUSxTQUFTLGdCQUFnQjtBQUNqRSxlQUFXLE1BQU0sd0JBQXdCLFFBQVEsTUFBTSxZQUFZO0FBQ25FLGNBQVUsVUFBVSxTQUFTLFFBQVEsa0JBQWtCLGtCQUFrQjtBQUFBLEVBQzdFLE9BQU87QUFDSCxlQUFXLFlBQVksV0FBVyxXQUFXLFFBQVEsTUFBTSxJQUFJO0FBQUEsRUFDbkU7QUFFQSxNQUFJLENBQUMsVUFBVTtBQUVYLGVBQVcsYUFBYSxRQUFRLE1BQU07QUFDdEMsV0FBTyxZQUFZLFdBQVcsUUFBUSxVQUFVLHdDQUF3QyxRQUFRLE1BQU0sR0FBRztBQUN6RyxXQUFPO0FBQUEsRUFDWDtBQUdBLFFBQU0sY0FBZSxRQUFRLGdCQUFnQixNQUFNLFFBQVEscUJBQXFCO0FBQ2hGLE1BQUksQ0FBQyxhQUFhO0FBQ2QsVUFBTSxRQUFRLFVBQVUsWUFBWSxFQUFFLEtBQUssR0FBRyxHQUFHO0FBQUEsTUFDN0MsUUFBUTtBQUFBLE1BQ1IsaUJBQWlCO0FBQUEsTUFDakIsbUJBQW1CO0FBQUEsTUFDbkIsZUFBZSxPQUFPO0FBQUEsSUFDMUIsQ0FBQztBQUFBLEVBQ0wsT0FBTztBQUNILFVBQU0sUUFBUSxPQUFPLFFBQVEsZ0JBQWdCO0FBQzdDLFVBQU0sZ0JBQWlCLFFBQVEscUJBQXFCLE9BQzlDLFFBQ0EsUUFBUTtBQUVkLFVBQU0sZUFBZSxLQUFLLElBQUksR0FBRyxnQkFBZ0IsQ0FBQztBQUVsRCxRQUFJLFlBQTJDO0FBQy9DLFFBQUksV0FBMEI7QUFDOUIsUUFBSSxnQkFBZ0IsR0FBRztBQUNuQixrQkFBWTtBQUFBLElBQ2hCLE9BQU87QUFDSCxZQUFNLFdBQVcsUUFBUSxtQkFBbUIsT0FBTztBQUNuRCxpQkFBVyxZQUFZLFVBQVUsT0FBTyxRQUFRLFdBQVcsQ0FBZTtBQUFBLElBQzlFO0FBRUEsVUFBTSxRQUFRLFVBQVUsWUFBWSxFQUFFLEtBQUssR0FBRyxHQUFHO0FBQUEsTUFDN0MsUUFBUTtBQUFBLE1BQ1IsbUJBQW1CO0FBQUEsTUFDbkIsZUFBZSxPQUFPO0FBQUEsTUFDdEIsaUJBQWlCO0FBQUEsTUFDakIsV0FBVyxRQUFRLGFBQWEsT0FBTztBQUFBLElBQzNDLENBQUM7QUFBQSxFQUNMO0FBR0EsU0FBTyxZQUFZLFdBQVcsUUFBUSxVQUFVLFNBQVMsUUFBUSxNQUFNLE9BQU8sUUFBUSxVQUFVLEdBQUc7QUFDbkcsT0FBSSw0Q0FBVyxlQUFYLG1CQUF1QixRQUFRO0FBQy9CLFdBQU8sVUFBVSxXQUFXLFFBQVEsVUFBVSxHQUFHLFFBQVEsVUFBVSwwQkFBMEIsUUFBUSxNQUFNLEdBQUc7QUFBQSxFQUNsSDtBQUVBLGVBQWEsbUJBQW1CLEdBQUcsUUFBUSxVQUFVLFVBQVUsUUFBUSxNQUFNLE9BQU8sUUFBUSxVQUFVLEdBQUcsUUFBUSxlQUFlLFFBQVEsZ0JBQWdCLEVBQUUsR0FBRztBQUM3SixTQUFPO0FBQ1gsQ0FBQztBQUVELGlCQUFpQixnQ0FBZ0MsT0FBTyxRQUFnQixPQUFlO0FBbll2RjtBQW9ZSSxRQUFNLFNBQVMsTUFBTSxrQkFBa0IsTUFBTTtBQUM3QyxNQUFJLENBQUMsT0FBUSxRQUFPO0FBRXBCLFFBQU0sT0FBTSxZQUFPLGVBQVAsbUJBQW1CO0FBQy9CLFFBQU0sVUFBVSxNQUFNLFFBQVEsUUFBUSxZQUFZLEVBQUUsS0FBSyxHQUFHLENBQUM7QUFDN0QsTUFBSSxDQUFDLFFBQVMsUUFBTztBQUNyQixNQUFJLFFBQVEsT0FBTyxJQUFLLFFBQU87QUFDL0IsTUFBSSxRQUFRLFdBQVcsYUFBYSxRQUFRLFdBQVcsWUFBWSxRQUFRLFdBQVcsVUFBVyxRQUFPO0FBRXhHLFFBQU0sUUFBUSxVQUFVLFlBQVksRUFBRSxLQUFLLEdBQUcsR0FBRyxFQUFFLFFBQVEsWUFBWSxpQkFBaUIsS0FBSyxDQUFDO0FBRTlGLFFBQU0sWUFBWSxNQUFNLHFCQUFxQixRQUFRLElBQUk7QUFDekQsU0FBTyxPQUFPLFdBQVcsUUFBUSxVQUFVLHdCQUF3QixRQUFRLE1BQU0sU0FBUyxRQUFRLFVBQVUsR0FBRztBQUMvRyxPQUFJLDRDQUFXLGVBQVgsbUJBQXVCLFFBQVE7QUFDL0IsV0FBTyxVQUFVLFdBQVcsUUFBUSxVQUFVLEdBQUcsUUFBUSxVQUFVLDhCQUE4QixRQUFRLE1BQU0sR0FBRztBQUFBLEVBQ3RIO0FBRUEsZUFBYSxvQkFBb0IsR0FBRyxRQUFRLFVBQVUsMEJBQTBCLFFBQVEsVUFBVSxTQUFTLFFBQVEsTUFBTSxHQUFHO0FBQzVILFNBQU87QUFDWCxDQUFDO0FBR00sSUFBTSwyQkFBMkIsbUNBQVk7QUFDaEQsUUFBTSxPQUFNLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBRW5DLFFBQU0sY0FBYyxNQUFNLFFBQVE7QUFBQSxJQUM5QjtBQUFBLElBQ0E7QUFBQSxNQUNJLFFBQVEsRUFBRSxLQUFLLENBQUMsVUFBVSxTQUFTLEVBQUU7QUFBQSxNQUNyQyxpQkFBaUIsRUFBRSxNQUFNLElBQUk7QUFBQSxNQUM3QixtQkFBbUIsRUFBRSxLQUFLLEVBQUU7QUFBQSxJQUNoQztBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQSxFQUFFLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxHQUFHLE9BQU8sR0FBRztBQUFBO0FBQUEsRUFDOUM7QUFFQSxhQUFXLFdBQVcsYUFBYTtBQUMvQixRQUFJO0FBQ0EsWUFBTSxRQUFRLE1BQU0scUJBQXFCLFFBQVEsRUFBRTtBQUNuRCxVQUFJLENBQUMsT0FBTztBQUVSLGNBQU0sUUFBUSxVQUFVLFlBQVksRUFBRSxLQUFLLFFBQVEsSUFBSSxHQUFHO0FBQUEsVUFDdEQsTUFBTSxFQUFFLGVBQWUsT0FBTyxHQUFHLGlCQUFpQixRQUFRLGtCQUFrQixLQUFLLEdBQUcsUUFBUSxVQUFVO0FBQUEsUUFDMUcsQ0FBQztBQUNEO0FBQUEsTUFDSjtBQUlBLFlBQU0sVUFBVSxVQUFVLE9BQU8sUUFBUSxNQUFNO0FBQy9DLFVBQUksQ0FBQyxTQUFTO0FBQ1YsY0FBTSxRQUFRLFVBQVUsWUFBWSxFQUFFLEtBQUssUUFBUSxJQUFJLEdBQUcsRUFBRSxlQUFlLE9BQU8sR0FBRyxpQkFBaUIsUUFBUSxrQkFBa0IsS0FBSyxHQUFHLFFBQVEsVUFBVSxDQUFDO0FBQzNKLGVBQU8sTUFBTSxXQUFXLFFBQVEsVUFBVSx5QkFBeUIsUUFBUSxNQUFNLCtCQUErQjtBQUNoSDtBQUFBLE1BQ0o7QUFHQSxVQUFJLFdBQVc7QUFDZixVQUFJLFFBQVEsZUFBZSxPQUFPO0FBQzlCLG1CQUFXLE1BQU0sd0JBQXdCLFFBQVEsTUFBTSxRQUFRLE1BQU07QUFBQSxNQUN6RSxPQUFPO0FBQ0gsY0FBTSxZQUFZLE1BQU0scUJBQXFCLFFBQVEsSUFBSTtBQUN6RCxtQkFBVyxZQUFZLFdBQVcsV0FBVyxRQUFRLE1BQU0sSUFBSTtBQUFBLE1BQ25FO0FBRUEsVUFBSSxDQUFDLFVBQVU7QUFFWCxtQkFBVyxPQUFPLFFBQVEsTUFBTTtBQUNoQyxjQUFNLFFBQVEsVUFBVSxZQUFZLEVBQUUsS0FBSyxRQUFRLElBQUksR0FBRyxFQUFFLGVBQWUsT0FBTyxHQUFHLGlCQUFpQixRQUFRLGtCQUFrQixLQUFLLEVBQUUsQ0FBQztBQUN4SSxlQUFPLE1BQU0sV0FBVyxRQUFRLFVBQVUsOENBQThDLFFBQVEsTUFBTSxHQUFHO0FBQ3pHO0FBQUEsTUFDSjtBQUdBLFlBQU0sZUFBZSxLQUFLLElBQUksSUFBSSxRQUFRLHFCQUFxQixPQUFPLFFBQVEsZ0JBQWdCLEtBQUssQ0FBQztBQUNwRyxVQUFJLFlBQTJDO0FBQy9DLFVBQUksV0FBMEI7QUFFOUIsVUFBSSxnQkFBZ0IsR0FBRztBQUNuQixvQkFBWTtBQUFBLE1BQ2hCLE9BQU87QUFDSCxjQUFNLE9BQU8sUUFBUSxtQkFBbUIsT0FBTztBQUMvQyxtQkFBVyxZQUFZLE1BQU0sT0FBTyxRQUFRLFdBQVcsQ0FBZTtBQUFBLE1BQzFFO0FBRUEsWUFBTSxRQUFRLFVBQVUsWUFBWSxFQUFFLEtBQUssUUFBUSxJQUFJLEdBQUc7QUFBQSxRQUN0RCxtQkFBbUI7QUFBQSxRQUNuQixRQUFRO0FBQUEsUUFDUixlQUFlLE9BQU87QUFBQSxRQUN0QixpQkFBaUI7QUFBQSxNQUNyQixDQUFDO0FBRUQsYUFBTyxNQUFNLFdBQVcsUUFBUSxVQUFVLFlBQVksUUFBUSxNQUFNLDJCQUEyQixZQUFZLFNBQVM7QUFDcEgsbUJBQWEsNkJBQTZCLEdBQUcsUUFBUSxVQUFVLFVBQVUsUUFBUSxNQUFNLE9BQU8sUUFBUSxVQUFVLEdBQUcsUUFBUSxlQUFlLFFBQVEsZ0JBQWdCLEVBQUUsR0FBRztBQUFBLElBQzNLLFNBQVMsR0FBRztBQUNSLGNBQVEsTUFBTSwrQkFBK0IsUUFBUSxLQUFLLENBQUM7QUFDM0QsWUFBTSxRQUFRLFVBQVUsWUFBWSxFQUFFLEtBQUssUUFBUSxJQUFJLEdBQUc7QUFBQSxRQUN0RCxNQUFNLEVBQUUsZUFBZSxPQUFPLEdBQUcsaUJBQWlCLFFBQVEsa0JBQWtCLEtBQUssRUFBRTtBQUFBLE1BQ3ZGLENBQUM7QUFBQSxJQUNMO0FBQUEsRUFDSjtBQUNKLEdBaEZ3Qzs7O0FDdFp4QyxpQkFBaUIsMEJBQTBCLE9BQU9DLFlBQW1CO0FBQ2pFLFFBQU0sZUFBZSxRQUFRLFNBQVMsRUFBRSxVQUFVQSxPQUFNO0FBQ3hELFFBQU0sV0FBVyxNQUFNLFFBQVEsU0FBUyxtQkFBbUIsRUFBRSxXQUFXLGFBQWEsV0FBVyxVQUFVLENBQUM7QUFDM0csUUFBTSxhQUFhLGFBQWEsV0FBVyxJQUFJO0FBQy9DLFNBQU8sS0FBSyxVQUFVLEVBQUUsWUFBWSxTQUFTLENBQUM7QUFDbEQsQ0FBQztBQUVELGlCQUFpQix5QkFBeUIsT0FBT0EsU0FBZ0IsU0FBaUI7QUFDOUUsUUFBTSxPQUFPLE1BQU0sUUFBUSxTQUFTLEVBQUUsY0FBY0EsT0FBTTtBQUMxRCxRQUFNLE1BQU0sTUFBTSxRQUFRLFFBQVEsbUJBQW1CLEVBQUUsS0FBSyxLQUFLLENBQUM7QUFDbEUsUUFBTSxNQUFNLE1BQU0sUUFBUSxVQUFVLG1CQUFtQixFQUFFLEtBQUssS0FBSyxDQUFDO0FBQ3BFLFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxHQUFHLElBQUksZ0JBQWdCLElBQUksT0FBTyxLQUFLLElBQUksU0FBUztBQUFBLElBQzdELGlCQUFpQjtBQUFBLEVBQ3JCLENBQUM7QUFDRCxTQUFPO0FBQ1gsQ0FBQztBQUVELGlCQUFpQiw0QkFBNEIsT0FBT0EsU0FBZ0IsU0FBaUI7QUFDakYsUUFBTSxFQUFFLFNBQVMsTUFBTSxJQUFJLEtBQUssTUFBTSxJQUFJO0FBQzFDLE1BQUksQ0FBQyxRQUFTLFFBQU87QUFDckIsUUFBTSxlQUFlLE1BQU0sUUFBUSxTQUFTLEVBQUUsVUFBVUEsT0FBTTtBQUM5RCxNQUFJLENBQUMsYUFBYyxRQUFPO0FBQzFCLE1BQUksTUFBTSxRQUFRLFNBQVMsRUFBRSxjQUFjLFNBQVMsT0FBTyxLQUFLLENBQUMsR0FBRztBQUNoRSxpQkFBYSxVQUFVLE9BQU8sU0FBUyxPQUFPLEtBQUssQ0FBQztBQUNwRCxZQUFRLGlCQUFpQkEsU0FBUSxrQkFBa0IsT0FBTyxpQkFBaUIsU0FBUztBQUNwRixZQUFRLHFCQUFxQixPQUFPLGFBQWEsV0FBVyxNQUFNLENBQUM7QUFDbkUsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLEdBQUcsYUFBYSxXQUFXLFNBQVMsU0FBUyxJQUFJLGFBQWEsV0FBVyxTQUFTLFFBQVEsb0JBQW9CLE9BQU8sYUFBYSxLQUFLO0FBQUEsTUFDaEosaUJBQWlCO0FBQUEsSUFDckIsQ0FBQztBQUNELFdBQU87QUFBQSxFQUNYLE9BQU87QUFDSCxVQUFNLE1BQU0sTUFBTSxRQUFRLFVBQVUsbUJBQW1CLEVBQUUsV0FBVyxhQUFhLFdBQVcsV0FBVyxRQUFRLENBQUM7QUFDaEgsV0FBTyxPQUFPO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxTQUFTLEdBQUcsYUFBYSxXQUFXLFNBQVMsU0FBUyxJQUFJLGFBQWEsV0FBVyxTQUFTLFFBQVEsd0NBQXdDLE9BQU87QUFBQSxNQUNsSixpQkFBaUI7QUFBQSxJQUNyQixDQUFDO0FBQ0QsV0FBTztBQUFBLEVBQ1g7QUFDSixDQUFDOzs7QUNPRCxJQUFNLG1CQUFOLE1BQU0saUJBQWdCO0FBQUEsRUFDbEIsTUFBTSxXQUFXQyxTQUFrRDtBQUMvRCxRQUFJO0FBQ0EsWUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFVBQUksQ0FBQyxVQUFXLFFBQU87QUFDdkIsWUFBTSxVQUFVLE1BQU0sUUFBUSxRQUFRLHNCQUFzQixFQUFFLFVBQVUsQ0FBQztBQUN6RSxhQUFPO0FBQUEsSUFDWCxTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0sb0NBQW9DLEtBQUs7QUFDdkQsYUFBTztBQUFBLElBQ1g7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFNLGNBQWNBLFNBQWdCLGFBQTBFO0FBQzFHLFFBQUk7QUFDQSxZQUFNLFlBQVksTUFBTSxRQUFRLFNBQVMsRUFBRSwyQkFBMkJBLE9BQU07QUFDNUUsVUFBSSxDQUFDLFVBQVcsUUFBTztBQUd2QixZQUFNLGtCQUFrQixNQUFNLFFBQVEsUUFBUSxzQkFBc0IsRUFBRSxVQUFVLENBQUM7QUFDakYsVUFBSSxpQkFBaUI7QUFDakIsY0FBTSxJQUFJLE1BQU0sd0JBQXdCO0FBQUEsTUFDNUM7QUFFQSxZQUFNLGFBQStCO0FBQUEsUUFDakMsS0FBSyxhQUFhO0FBQUEsUUFDbEI7QUFBQSxRQUNBLE1BQU0sWUFBWSxRQUFRO0FBQUEsUUFDMUIsS0FBSyxZQUFZLE9BQU87QUFBQSxRQUN4QixRQUFRLFlBQVksVUFBVTtBQUFBLFFBQzlCLEtBQUssWUFBWSxPQUFPO0FBQUEsUUFDeEIsUUFBUSxZQUFZLFVBQVUsQ0FBQztBQUFBLFFBQy9CLFdBQVcsWUFBWSxhQUFhLENBQUM7QUFBQSxRQUNyQyxZQUFZLFlBQVksY0FBYztBQUFBLFFBQ3RDLHFCQUFxQixZQUFZLHVCQUF1QixDQUFDO0FBQUEsUUFDekQsYUFBYSxZQUFZLGVBQWU7QUFBQSxRQUN4QyxhQUFhLFlBQVksZUFBZTtBQUFBLFFBQ3hDLGFBQWEsWUFBWSxlQUFlO0FBQUEsUUFDeEMsWUFBWSxZQUFZLGVBQWUsU0FBWSxZQUFZLGFBQWE7QUFBQSxRQUM1RSxNQUFNLFlBQVksUUFBUTtBQUFBLFFBQzFCLFFBQVEsWUFBWSxVQUFVO0FBQUEsUUFDOUIsUUFBUSxZQUFZO0FBQUEsUUFDcEIsWUFBWSxZQUFZLGNBQWM7QUFBQSxRQUN0QyxXQUFXLFlBQVksYUFBYTtBQUFBLFVBQ2hDLFNBQVM7QUFBQSxVQUNULFVBQVU7QUFBQSxVQUNWLFVBQVU7QUFBQSxVQUNWLE1BQU07QUFBQSxRQUNWO0FBQUEsUUFDQSxVQUFVO0FBQUEsUUFDVixTQUFTO0FBQUEsUUFDVCxxQkFBcUI7QUFBQSxRQUNyQixnQkFBZ0I7QUFBQSxRQUNoQixhQUFhO0FBQUEsUUFDYixnQkFBZ0Isb0JBQUksS0FBSztBQUFBLFFBQ3pCLFdBQVcsb0JBQUksS0FBSztBQUFBLFFBQ3BCLFlBQVksb0JBQUksS0FBSztBQUFBLFFBQ3JCLFVBQVU7QUFBQSxNQUNkO0FBRUEsWUFBTSxTQUFTLE1BQU0sUUFBUSxVQUFVLHNCQUFzQixVQUFVO0FBQ3ZFLGNBQVEsSUFBSSxNQUFNO0FBQ2xCLGFBQU8sRUFBRSxHQUFHLFlBQVksS0FBSyxPQUFPO0FBQUEsSUFDeEMsU0FBUyxPQUFPO0FBQ1osY0FBUSxNQUFNLHFDQUFxQyxLQUFLO0FBQ3hELGFBQU87QUFBQSxJQUNYO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBTSxjQUFjQSxTQUFnQixhQUEwRTtBQUMxRyxRQUFJO0FBQ0EsWUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFVBQUksQ0FBQyxVQUFXLFFBQU87QUFFdkIsWUFBTSxhQUFhO0FBQUEsUUFDZixHQUFHO0FBQUEsUUFDSCxZQUFZLG9CQUFJLEtBQUs7QUFBQSxNQUN6QjtBQUVBLFlBQU0sU0FBUyxNQUFNLFFBQVEsVUFBVSxzQkFBc0IsRUFBRSxVQUFVLEdBQUcsWUFBWSxRQUFXLE9BQU8sRUFBRSxRQUFRLEtBQUssQ0FBQztBQUUxSCxhQUFPLE9BQU87QUFBQSxJQUNsQixTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0scUNBQXFDLEtBQUs7QUFDeEQsYUFBTztBQUFBLElBQ1g7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFNLG9CQUFvQkEsU0FBNkM7QUFDbkUsUUFBSTtBQUNBLFlBQU0sWUFBWSxNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQkEsT0FBTTtBQUM1RSxVQUFJLENBQUMsVUFBVyxRQUFPLENBQUM7QUFFeEIsWUFBTSxjQUFjLE1BQU0sUUFBUSxRQUFRLHNCQUFzQixFQUFFLFVBQVUsQ0FBQztBQUM3RSxVQUFJLENBQUMsWUFBYSxRQUFPLENBQUM7QUFHMUIsWUFBTSxjQUFjLE1BQU0sUUFBUSxTQUFTLG9CQUFvQjtBQUFBLFFBQzNELFlBQVk7QUFBQSxNQUNoQixHQUFHLFFBQVcsS0FBSztBQUNuQixZQUFNLGdCQUFnQixZQUFZLElBQUksQ0FBQyxVQUFlLE1BQU0sUUFBUTtBQUdwRSxZQUFNLFVBQVUsTUFBTSxRQUFRLFNBQVMscUJBQXFCO0FBQUEsUUFDeEQsS0FBSztBQUFBLFVBQ0QsRUFBRSxTQUFTLFVBQVU7QUFBQSxVQUNyQixFQUFFLFNBQVMsVUFBVTtBQUFBLFFBQ3pCO0FBQUEsUUFDQSxVQUFVO0FBQUEsTUFDZCxHQUFHLFFBQVcsS0FBSztBQUNuQixZQUFNLGlCQUFpQixRQUFRO0FBQUEsUUFBSSxDQUFDLFVBQ2hDLE1BQU0sWUFBWSxZQUFZLE1BQU0sVUFBVSxNQUFNO0FBQUEsTUFDeEQ7QUFHQSxZQUFNLGtCQUFrQixDQUFDLEdBQUcsZUFBZSxHQUFHLGdCQUFnQixTQUFTO0FBR3ZFLFlBQU0sZ0JBQXFCO0FBQUEsUUFDdkIsV0FBVyxFQUFFLE1BQU0sZ0JBQWdCO0FBQUEsUUFDbkMsVUFBVTtBQUFBLFFBQ1YsS0FBSyxFQUFFLE1BQU0sWUFBWSxhQUFhLE1BQU0sWUFBWSxZQUFZO0FBQUEsTUFDeEU7QUFHQSxVQUFJLFlBQVksZUFBZSxZQUFZO0FBQ3ZDLHNCQUFjLFNBQVMsWUFBWSxlQUFlLFFBQVEsUUFBUTtBQUFBLE1BQ3RFO0FBRUEsVUFBSSxZQUFZLG9CQUFvQixTQUFTLEdBQUc7QUFDNUMsc0JBQWMsYUFBYTtBQUFBLFVBQ3ZCLEtBQUssWUFBWSxvQkFBb0IsU0FBUyxZQUFZLE1BQU0sSUFDMUQsWUFBWSxzQkFDWixDQUFDLEdBQUcsWUFBWSxxQkFBcUIsVUFBVTtBQUFBLFFBQ3pEO0FBQUEsTUFDSjtBQUVBLFlBQU0sbUJBQW1CLE1BQU0sUUFBUSxTQUFTLHNCQUFzQixlQUFlLFFBQVcsT0FBTyxFQUFFLE9BQU8sR0FBRyxDQUFDO0FBRXBILGFBQU87QUFBQSxJQUNYLFNBQVMsT0FBTztBQUNaLGNBQVEsTUFBTSxvQ0FBb0MsS0FBSztBQUN2RCxhQUFPLENBQUM7QUFBQSxJQUNaO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBTSxhQUFhQSxTQUFnQixXQUE2RTtBQUM1RyxRQUFJO0FBQ0EsWUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFVBQUksQ0FBQyxVQUFXLFFBQU8sRUFBRSxTQUFTLE9BQU8sU0FBUyxNQUFNO0FBRXhELFlBQU0sRUFBRSxjQUFjLFFBQVEsY0FBYyxNQUFNLElBQUk7QUFHdEQsWUFBTSxjQUFjLE1BQU0sUUFBUSxRQUFRLHNCQUFzQixFQUFFLFVBQVUsQ0FBQztBQUM3RSxVQUFJLENBQUMsWUFBYSxRQUFPLEVBQUUsU0FBUyxPQUFPLFNBQVMsTUFBTTtBQUUxRCxVQUFJLGVBQWUsWUFBWSx1QkFBdUIsR0FBRztBQUNyRCxlQUFPLEVBQUUsU0FBUyxPQUFPLFNBQVMsT0FBTyxPQUFPLDJCQUEyQjtBQUFBLE1BQy9FO0FBR0EsWUFBTSxRQUFRLFVBQVUsb0JBQW9CO0FBQUEsUUFDeEMsS0FBSyxhQUFhO0FBQUEsUUFDbEIsWUFBWTtBQUFBLFFBQ1osVUFBVTtBQUFBLFFBQ1Y7QUFBQSxRQUNBO0FBQUEsUUFDQSxXQUFXLG9CQUFJLEtBQUs7QUFBQSxNQUN4QixDQUFDO0FBRUQsVUFBSSxVQUFVO0FBR2QsVUFBSSxRQUFRO0FBQ1IsY0FBTSxrQkFBa0IsTUFBTSxRQUFRLFFBQVEsb0JBQW9CO0FBQUEsVUFDOUQsWUFBWTtBQUFBLFVBQ1osVUFBVTtBQUFBLFVBQ1YsUUFBUTtBQUFBLFFBQ1osQ0FBQztBQUVELFlBQUksaUJBQWlCO0FBRWpCLGdCQUFNLFFBQVEsVUFBVSxxQkFBcUI7QUFBQSxZQUN6QyxLQUFLLGFBQWE7QUFBQSxZQUNsQixTQUFTO0FBQUEsWUFDVCxTQUFTO0FBQUEsWUFDVCxXQUFXLG9CQUFJLEtBQUs7QUFBQSxZQUNwQixVQUFVO0FBQUEsWUFDVixhQUFhLGVBQWUsZ0JBQWdCO0FBQUEsVUFDaEQsQ0FBQztBQUNELG9CQUFVO0FBR1YsY0FBSTtBQUVBLGtCQUFNLGFBQWEsTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLHFCQUFxQixTQUFTO0FBQ2pGLGtCQUFNLGFBQWEsTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLHFCQUFxQixZQUFZO0FBR3BGLGtCQUFNLG1CQUFtQixjQUFjLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSw0QkFBNEIsU0FBUztBQUM1RyxrQkFBTSxtQkFBbUIsY0FBYyxNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUsNEJBQTRCLFlBQVk7QUFHL0csZ0JBQUksY0FBYyxXQUFXLFdBQVcsUUFBUTtBQUM1QyxzQkFBUSx5QkFBeUIsV0FBVyxXQUFXLFFBQVEsS0FBSyxVQUFVO0FBQUEsZ0JBQzFFLElBQUksYUFBYTtBQUFBLGdCQUNqQixPQUFPO0FBQUEsZ0JBQ1AsYUFBYSxvQkFBb0IsaUJBQWlCLFdBQVcsU0FBUyxTQUFTLElBQUksaUJBQWlCLFdBQVcsU0FBUyxRQUFRO0FBQUEsZ0JBQ2hJLEtBQUs7QUFBQSxnQkFDTCxTQUFTO0FBQUEsY0FDYixDQUFDLENBQUM7QUFBQSxZQUNOO0FBR0EsZ0JBQUksY0FBYyxXQUFXLFdBQVcsUUFBUTtBQUM1QyxzQkFBUSx5QkFBeUIsV0FBVyxXQUFXLFFBQVEsS0FBSyxVQUFVO0FBQUEsZ0JBQzFFLElBQUksYUFBYTtBQUFBLGdCQUNqQixPQUFPO0FBQUEsZ0JBQ1AsYUFBYSxvQkFBb0IsaUJBQWlCLFdBQVcsU0FBUyxTQUFTLElBQUksaUJBQWlCLFdBQVcsU0FBUyxRQUFRO0FBQUEsZ0JBQ2hJLEtBQUs7QUFBQSxnQkFDTCxTQUFTO0FBQUEsY0FDYixDQUFDLENBQUM7QUFBQSxZQUNOO0FBQUEsVUFDSixTQUFTLG1CQUFtQjtBQUN4QixvQkFBUSxNQUFNLHNDQUFzQyxpQkFBaUI7QUFBQSxVQUN6RTtBQUFBLFFBQ0o7QUFHQSxjQUFNLGFBQWtCO0FBQUEsVUFDcEIsYUFBYSxZQUFZLGNBQWM7QUFBQSxRQUMzQztBQUVBLFlBQUksYUFBYTtBQUNiLHFCQUFXLHNCQUFzQixZQUFZLHNCQUFzQjtBQUFBLFFBQ3ZFLE9BQU87QUFDSCxxQkFBVyxpQkFBaUIsWUFBWSxpQkFBaUI7QUFBQSxRQUM3RDtBQUVBLGNBQU0sUUFBUSxVQUFVLHNCQUFzQixFQUFFLFVBQVUsR0FBRyxVQUFVO0FBQUEsTUFDM0U7QUFFQSxhQUFPLEVBQUUsU0FBUyxNQUFNLFFBQVE7QUFBQSxJQUNwQyxTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0sMEJBQTBCLEtBQUs7QUFDN0MsYUFBTyxFQUFFLFNBQVMsT0FBTyxTQUFTLE1BQU07QUFBQSxJQUM1QztBQUFBLEVBQ0o7QUFBQSxFQUVBLE1BQU0sV0FBV0EsU0FBZ0M7QUFDN0MsUUFBSTtBQUNBLFlBQU0sWUFBWSxNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQkEsT0FBTTtBQUM1RSxVQUFJLENBQUMsVUFBVyxRQUFPLENBQUM7QUFFeEIsWUFBTSxVQUFVLE1BQU0sUUFBUSxTQUFTLHFCQUFxQjtBQUFBLFFBQ3hELEtBQUs7QUFBQSxVQUNELEVBQUUsU0FBUyxVQUFVO0FBQUEsVUFDckIsRUFBRSxTQUFTLFVBQVU7QUFBQSxRQUN6QjtBQUFBLFFBQ0EsVUFBVTtBQUFBLE1BQ2QsR0FBRyxRQUFXLE9BQU8sRUFBRSxNQUFNLEVBQUUsV0FBVyxHQUFHLEVBQUUsQ0FBQztBQUVoRCxZQUFNLGtCQUFrQixNQUFNLFFBQVEsSUFBSSxRQUFRLElBQUksT0FBTyxVQUFlO0FBQ3hFLGNBQU0sY0FBYyxNQUFNLFlBQVksWUFBWSxNQUFNLFVBQVUsTUFBTTtBQUN4RSxjQUFNLFlBQVksTUFBTSxRQUFRLFFBQVEsc0JBQXNCLEVBQUUsV0FBVyxZQUFZLENBQUM7QUFFeEYsY0FBTSxjQUFjLE1BQU0sUUFBUSxRQUFRLHNCQUFzQixFQUFFLFNBQVMsTUFBTSxJQUFJLEdBQUcsUUFBVyxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsR0FBRyxFQUFFLENBQUM7QUFFckksZUFBTztBQUFBLFVBQ0gsR0FBRztBQUFBLFVBQ0g7QUFBQSxVQUNBLGFBQWEsMkNBQWE7QUFBQSxVQUMxQixpQkFBaUIsMkNBQWE7QUFBQSxVQUM5QixZQUFZLENBQUM7QUFBQSxVQUNiLGFBQWEsTUFBTSxLQUFLLHNCQUFzQixNQUFNLElBQUssU0FBUyxHQUFHLFNBQVM7QUFBQSxRQUNsRjtBQUFBLE1BQ0osQ0FBQyxDQUFDO0FBRUYsYUFBTztBQUFBLElBQ1gsU0FBUyxPQUFPO0FBQ1osY0FBUSxNQUFNLDBCQUEwQixLQUFLO0FBQzdDLGFBQU8sQ0FBQztBQUFBLElBQ1o7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFjLHNCQUFzQixTQUFpQixRQUFpQztBQUNsRixRQUFJO0FBQ0EsWUFBTSxRQUFRLE1BQU0sUUFBUSxTQUFTLHNCQUFzQjtBQUFBLFFBQ3ZEO0FBQUEsUUFDQSxZQUFZO0FBQUEsUUFDWixNQUFNO0FBQUEsTUFDVixHQUFHLFFBQVcsS0FBSztBQUNuQixhQUFPLE1BQU07QUFBQSxJQUNqQixTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0sK0JBQStCLEtBQUs7QUFDbEQsYUFBTztBQUFBLElBQ1g7QUFBQSxFQUNKO0FBQUE7QUFBQSxFQUdBLE1BQU0sY0FBY0EsU0FBZ0I7QUFDaEMsVUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFFBQUksQ0FBQyxVQUFXLFFBQU87QUFFdkIsVUFBTSxVQUFVLE1BQU0sUUFBUSxRQUFRLHNCQUFzQixFQUFFLFVBQVUsQ0FBQztBQUN6RSxXQUFPLFVBQVU7QUFBQSxNQUNiLGdCQUFnQixRQUFRO0FBQUEsTUFDeEIscUJBQXFCLFFBQVE7QUFBQSxNQUM3QixhQUFhLFFBQVE7QUFBQSxJQUN6QixJQUFJO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBTSxlQUFlQSxTQUE2QztBQUU5RCxXQUFPLEtBQUssb0JBQW9CQSxPQUFNO0FBQUEsRUFDMUM7QUFBQSxFQUVBLE1BQU0sZUFBZUEsU0FBNkM7QUFDOUQsUUFBSTtBQUNBLFlBQU0sWUFBWSxNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQkEsT0FBTTtBQUM1RSxVQUFJLENBQUMsVUFBVyxRQUFPLENBQUM7QUFFeEIsWUFBTSxpQkFBaUIsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxHQUFJO0FBQzFELFlBQU0sY0FBYyxNQUFNLFFBQVEsU0FBUyxzQkFBc0I7QUFBQSxRQUM3RCxXQUFXLEVBQUUsS0FBSyxVQUFVO0FBQUEsUUFDNUIsVUFBVTtBQUFBLFFBQ1YsWUFBWSxFQUFFLE1BQU0sZUFBZTtBQUFBLE1BQ3ZDLEdBQUcsUUFBVyxPQUFPLEVBQUUsT0FBTyxHQUFHLENBQUM7QUFFbEMsYUFBTztBQUFBLElBQ1gsU0FBUyxPQUFPO0FBQ1osY0FBUSxNQUFNLCtCQUErQixLQUFLO0FBQ2xELGFBQU8sQ0FBQztBQUFBLElBQ1o7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFNLHVCQUF1QkEsU0FBNkM7QUFDdEUsUUFBSTtBQUNBLFlBQU0sWUFBWSxNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQkEsT0FBTTtBQUM1RSxVQUFJLENBQUMsVUFBVyxRQUFPLENBQUM7QUFFeEIsWUFBTSxZQUFZLElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxLQUFLLEtBQUssS0FBSyxHQUFJO0FBQzNELFlBQU0sY0FBYyxNQUFNLFFBQVEsU0FBUyxzQkFBc0I7QUFBQSxRQUM3RCxXQUFXLEVBQUUsS0FBSyxVQUFVO0FBQUEsUUFDNUIsVUFBVTtBQUFBLFFBQ1YsWUFBWSxFQUFFLE1BQU0sVUFBVTtBQUFBLE1BQ2xDLEdBQUcsUUFBVyxPQUFPLEVBQUUsT0FBTyxJQUFJLE1BQU0sRUFBRSxZQUFZLEdBQUcsRUFBRSxDQUFDO0FBRTVELGFBQU87QUFBQSxJQUNYLFNBQVMsT0FBTztBQUNaLGNBQVEsTUFBTSx3Q0FBd0MsS0FBSztBQUMzRCxhQUFPLENBQUM7QUFBQSxJQUNaO0FBQUEsRUFDSjtBQUFBLEVBRUEsTUFBTSxZQUFZQSxTQUE2QztBQUUzRCxVQUFNLG1CQUFtQixNQUFNLEtBQUssb0JBQW9CQSxPQUFNO0FBQzlELFdBQU8saUJBQWlCLE1BQU0sR0FBRyxDQUFDO0FBQUEsRUFDdEM7QUFBQSxFQUVBLE1BQU0saUJBQWlCQSxTQUFnQjtBQUNuQyxRQUFJO0FBQ0EsWUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFVBQUksQ0FBQyxVQUFXLFFBQU8sRUFBRSxZQUFZLEdBQUcsYUFBYSxHQUFHLFlBQVksRUFBRTtBQUd0RSxZQUFNLGFBQWEsTUFBTSxRQUFRLFNBQVMscUJBQXFCO0FBQUEsUUFDM0QsS0FBSyxDQUFDLEVBQUUsU0FBUyxVQUFVLEdBQUcsRUFBRSxTQUFTLFVBQVUsQ0FBQztBQUFBLFFBQ3BELFVBQVU7QUFBQTtBQUFBLE1BRWQsR0FBRyxRQUFXLEtBQUs7QUFHbkIsWUFBTSxjQUFjLE1BQU0sUUFBUSxTQUFTLHNCQUFzQjtBQUFBLFFBQzdELFlBQVk7QUFBQSxRQUNaLE1BQU07QUFBQSxNQUNWLEdBQUcsUUFBVyxLQUFLO0FBR25CLFlBQU0sYUFBYSxNQUFNLFFBQVEsU0FBUyxvQkFBb0I7QUFBQSxRQUMxRCxVQUFVO0FBQUEsUUFDVixhQUFhO0FBQUEsUUFDYixRQUFRO0FBQUEsTUFDWixHQUFHLFFBQVcsS0FBSztBQUVuQixhQUFPLEVBQUUsWUFBWSxXQUFXLFFBQVEsYUFBYSxZQUFZLFFBQVEsWUFBWSxXQUFXLE9BQU87QUFBQSxJQUMzRyxTQUFTLE9BQU87QUFDWixjQUFRLE1BQU0sZ0NBQWdDLEtBQUs7QUFDbkQsYUFBTyxFQUFFLFlBQVksR0FBRyxhQUFhLEdBQUcsWUFBWSxFQUFFO0FBQUEsSUFDMUQ7QUFBQSxFQUNKO0FBQUEsRUFFQSxNQUFNLFlBQVlBLFNBQWdCLE1BQVc7QUFDekMsV0FBTyxNQUFNLFFBQVEsU0FBUyxzQkFBc0IsRUFBRSxTQUFTLEtBQUssUUFBUSxHQUFHLFFBQVcsS0FBSztBQUFBLEVBQ25HO0FBQUEsRUFFQSxNQUFNLFlBQVlBLFNBQWdCLE1BQVc7QUFDekMsWUFBUSxJQUFJLElBQUk7QUFDaEIsVUFBTSxNQUFNLE1BQU0sUUFBUSxRQUFRLHFCQUFxQixFQUFFLEtBQUssT0FBTyxLQUFLLE9BQU8sRUFBRSxHQUFHLFFBQVcsS0FBSztBQUN0RyxVQUFNLGtCQUFrQixNQUFNLFFBQVEsU0FBUyxFQUFFLDJCQUEyQkEsT0FBTTtBQUNsRixRQUFJLGFBQWEsTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLHFCQUFxQixlQUFlO0FBQ3JGLFFBQUksYUFBYSxNQUFNLE9BQU8sUUFBUSxTQUFTLEVBQUUscUJBQXFCLElBQUksWUFBWSxrQkFBa0IsSUFBSSxVQUFVLElBQUksT0FBTztBQUVqSSxRQUFJLENBQUMsWUFBWTtBQUNiLG1CQUFhLE1BQU0sT0FBTyxRQUFRLFNBQVMsRUFBRSw0QkFBNEIsZUFBZTtBQUFBLElBQzVGO0FBRUEsUUFBSSxDQUFDLFlBQVk7QUFDYixtQkFBYSxNQUFNLFVBQVUsVUFBVSw0QkFBNEIsSUFBSSxZQUFZLGtCQUFrQixJQUFJLFVBQVUsSUFBSSxPQUFPO0FBQUEsSUFDbEk7QUFFQSxVQUFNLGFBQXNCO0FBQUEsTUFDeEIsS0FBSyxhQUFhO0FBQUEsTUFDbEIsTUFBTSxJQUFJLFlBQVksbUJBQW1CLElBQUksWUFBWSxrQkFBa0IsT0FBTztBQUFBLE1BQ2xGLFNBQVMsSUFBSTtBQUFBLE1BQ2IsVUFBVTtBQUFBLE1BQ1YsWUFBWSxJQUFJLFlBQVksa0JBQWtCLElBQUksVUFBVSxJQUFJO0FBQUEsTUFDaEUsU0FBUyxLQUFLO0FBQUEsTUFDZCxZQUFXLG9CQUFJLEtBQUssR0FBRSxZQUFZO0FBQUEsSUFDdEM7QUFDQSxVQUFNLFFBQVEsVUFBVSxzQkFBc0IsVUFBVTtBQUV4RCxRQUFJLElBQUksWUFBWSxtQkFBbUIsSUFBSSxZQUFZLG1CQUFtQixXQUFXLFdBQVcsUUFBUTtBQUNwRyxjQUFRLGdDQUFnQyxXQUFXLFdBQVcsUUFBUSxLQUFLLFVBQVUsVUFBVSxDQUFDO0FBQ2hHLGNBQVEseUJBQXlCLFdBQVcsV0FBVyxRQUFRLEtBQUssVUFBVTtBQUFBLFFBQzFFLElBQUksYUFBYTtBQUFBLFFBQ2pCLE9BQU87QUFBQSxRQUNQLGFBQWEsaUNBQWlDLFdBQVcsV0FBVyxTQUFTLFlBQVksTUFBTSxXQUFXLFdBQVcsU0FBUztBQUFBLFFBQzlILEtBQUs7QUFBQSxRQUNMLFNBQVM7QUFBQSxNQUNiLENBQUMsQ0FBQztBQUFBLElBQ047QUFFQSxXQUFPO0FBQUEsRUFDWDtBQUFBLEVBRUEsTUFBTSxRQUFRQSxTQUFnQixNQUEyQjtBQUNyRCxRQUFJO0FBQ0EsWUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCQSxPQUFNO0FBQzVFLFVBQUksQ0FBQyxVQUFXLFFBQU8sRUFBRSxTQUFTLE1BQU07QUFFeEMsWUFBTSxRQUFRLE1BQU0sUUFBUSxRQUFRLHFCQUFxQixFQUFFLEtBQUssS0FBSyxRQUFRLENBQUM7QUFDOUUsVUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLFNBQVUsUUFBTyxFQUFFLFNBQVMsTUFBTTtBQUd2RCxVQUFJLE1BQU0sWUFBWSxhQUFhLE1BQU0sWUFBWSxXQUFXO0FBQzVELGVBQU8sRUFBRSxTQUFTLE9BQU8sT0FBTyxzQ0FBc0M7QUFBQSxNQUMxRTtBQUdBLFlBQU0sUUFBUSxVQUFVLHFCQUFxQixFQUFFLEtBQUssS0FBSyxRQUFRLEdBQUcsRUFBRSxVQUFVLE1BQU0sQ0FBQztBQUV2RixhQUFPLEVBQUUsU0FBUyxLQUFLO0FBQUEsSUFDM0IsU0FBUyxPQUFPO0FBQ1osY0FBUSxNQUFNLHFCQUFxQixLQUFLO0FBQ3hDLGFBQU8sRUFBRSxTQUFTLE9BQU8sT0FBTyxvQkFBb0I7QUFBQSxJQUN4RDtBQUFBLEVBQ0o7QUFDSjtBQTVjc0I7QUFBdEIsSUFBTSxrQkFBTjtBQThjQSxJQUFNLGtCQUFrQixJQUFJLGdCQUFnQjtBQUc1QyxpQkFBaUIsd0JBQXdCLE9BQU9BLFlBQW1CO0FBQy9ELFNBQU8sTUFBTSxnQkFBZ0IsV0FBV0EsT0FBTTtBQUNsRCxDQUFDO0FBRUQsaUJBQWlCLDJCQUEyQixPQUFPQSxTQUFnQixTQUFjO0FBQzdFLFNBQU8sTUFBTSxnQkFBZ0IsY0FBY0EsU0FBUSxJQUFJO0FBQzNELENBQUM7QUFFRCxpQkFBaUIsMkJBQTJCLE9BQU9BLFNBQWdCLFNBQWM7QUFDN0UsU0FBTyxNQUFNLGdCQUFnQixjQUFjQSxTQUFRLElBQUk7QUFDM0QsQ0FBQztBQUVELGlCQUFpQixpQ0FBaUMsT0FBT0EsWUFBbUI7QUFDeEUsU0FBTyxNQUFNLGdCQUFnQixvQkFBb0JBLE9BQU07QUFDM0QsQ0FBQztBQUVELGlCQUFpQiwwQkFBMEIsT0FBT0EsU0FBZ0IsU0FBYztBQUM1RSxTQUFPLE1BQU0sZ0JBQWdCLGFBQWFBLFNBQVEsSUFBSTtBQUMxRCxDQUFDO0FBRUQsaUJBQWlCLHdCQUF3QixPQUFPQSxZQUFtQjtBQUMvRCxTQUFPLE1BQU0sZ0JBQWdCLFdBQVdBLE9BQU07QUFDbEQsQ0FBQztBQUVELGlCQUFpQiwyQkFBMkIsT0FBT0EsWUFBbUI7QUFDbEUsU0FBTyxNQUFNLGdCQUFnQixjQUFjQSxPQUFNO0FBQ3JELENBQUM7QUFFRCxpQkFBaUIsNEJBQTRCLE9BQU9BLFlBQW1CO0FBQ25FLFNBQU8sTUFBTSxnQkFBZ0IsZUFBZUEsT0FBTTtBQUN0RCxDQUFDO0FBRUQsaUJBQWlCLDRCQUE0QixPQUFPQSxZQUFtQjtBQUNuRSxTQUFPLE1BQU0sZ0JBQWdCLGVBQWVBLE9BQU07QUFDdEQsQ0FBQztBQUVELGlCQUFpQixvQ0FBb0MsT0FBT0EsWUFBbUI7QUFDM0UsU0FBTyxNQUFNLGdCQUFnQix1QkFBdUJBLE9BQU07QUFDOUQsQ0FBQztBQUVELGlCQUFpQix5QkFBeUIsT0FBT0EsWUFBbUI7QUFDaEUsU0FBTyxNQUFNLGdCQUFnQixZQUFZQSxPQUFNO0FBQ25ELENBQUM7QUFFRCxpQkFBaUIsOEJBQThCLE9BQU9BLFlBQW1CO0FBQ3JFLFNBQU8sTUFBTSxnQkFBZ0IsaUJBQWlCQSxPQUFNO0FBQ3hELENBQUM7QUFFRCxpQkFBaUIseUJBQXlCLE9BQU9BLFNBQWdCLFNBQWM7QUFDM0UsU0FBTyxNQUFNLGdCQUFnQixZQUFZQSxTQUFRLElBQUk7QUFDekQsQ0FBQztBQUVELGlCQUFpQix5QkFBeUIsT0FBT0EsU0FBZ0IsU0FBYztBQUMzRSxTQUFPLE1BQU0sZ0JBQWdCLFlBQVlBLFNBQVEsSUFBSTtBQUN6RCxDQUFDO0FBRUQsaUJBQWlCLHFCQUFxQixPQUFPQSxTQUFnQixTQUFjO0FBQ3ZFLFNBQU8sTUFBTSxnQkFBZ0IsUUFBUUEsU0FBUSxJQUFJO0FBQ3JELENBQUM7OztBQzVqQk0sSUFBSSxZQUFZLFFBQVEsU0FBUyxFQUFFLGNBQWM7QUFDakQsSUFBTSxVQUFVLFFBQVEsU0FBUztBQUNqQyxJQUFNLFFBQVEsUUFBUTtBQUN0QixJQUFNLFNBQVMsUUFBUSxtQkFBbUI7QUFFakQsR0FBRyw4QkFBOEIsTUFBTTtBQUNuQyxjQUFZLFFBQVEsU0FBUyxFQUFFLGNBQWM7QUFDakQsQ0FBQztBQUVELGFBQWEsTUFBTTtBQUNmLFFBQU0sS0FBSztBQUNYLFdBQVMsS0FBSztBQUNsQixDQUFDO0FBRUQsaUJBQWlCLDRCQUE0QixPQUFPQyxTQUFhLGlCQUFzQjtBQUNuRixRQUFNLFVBQVVBO0FBQ2hCLFFBQU0sZUFBZSxNQUFNLE1BQU0sdUJBQXVCLE9BQU87QUFDL0QsUUFBTSxXQUFXLE1BQU0sTUFBTSx1QkFBdUIsWUFBWTtBQUNoRSxRQUFNLFdBQVcsTUFBTSxRQUFRLFNBQVMsRUFBRSxjQUFjLE9BQU87QUFDL0QsUUFBTSxjQUFjLFNBQVMsTUFBTSxHQUFHO0FBRXRDLE1BQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFVO0FBQ2hDLFFBQU0sY0FBYztBQUFBLElBQ2hCLEtBQUssYUFBYTtBQUFBLElBQ2xCLGdCQUFnQjtBQUFBLElBQ2hCLGVBQWU7QUFBQSxJQUNmLFdBQVcsWUFBWSxDQUFDO0FBQUEsSUFDeEIsVUFBVSxZQUFZLENBQUM7QUFBQSxJQUN2QixPQUFPLE1BQU0sTUFBTSx5QkFBeUIsY0FBYyxNQUFNLE1BQU0sMEJBQTBCLFlBQVksQ0FBQztBQUFBLElBQzdHLFNBQVMsTUFBTSxNQUFNLDBCQUEwQixRQUFRO0FBQUEsSUFDdkQsT0FBTztBQUFBLElBQ1AsT0FBTztBQUFBLElBQ1AsT0FBTztBQUFBLEVBQ1g7QUFDQSxRQUFNLE1BQU0sTUFBTSxRQUFRLFFBQVEsa0JBQWtCLEVBQUUsZ0JBQWdCLFVBQVUsZUFBZSxhQUFhLENBQUM7QUFDN0csTUFBSSxLQUFLO0FBQ0wsV0FBTyxRQUFRLHlCQUF5QixTQUFTLEtBQUssVUFBVTtBQUFBLE1BQzVELElBQUksYUFBYTtBQUFBLE1BQ2pCLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxJQUNiLENBQUMsQ0FBQztBQUFBLEVBQ047QUFDQSxVQUFRLHlCQUF5QixPQUFPLE9BQU8sR0FBRyxLQUFLLFVBQVU7QUFBQSxJQUM3RCxJQUFJLGFBQWE7QUFBQSxJQUNqQixPQUFPO0FBQUEsSUFDUCxhQUFhO0FBQUEsSUFDYixLQUFLO0FBQUEsSUFDTCxTQUFTO0FBQUEsRUFDYixDQUFDLENBQUM7QUFDRixRQUFNLFNBQVMsYUFBYTtBQUM1QixVQUFRLCtCQUErQixPQUFPLFlBQVksR0FBRyxLQUFLLFVBQVU7QUFBQSxJQUN4RSxJQUFJO0FBQUEsSUFDSixPQUFPO0FBQUEsSUFDUCxhQUFhLEdBQUcsUUFBUTtBQUFBLElBQ3hCLEtBQUs7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUs7QUFBQSxRQUNELE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLE1BQU0sQ0FBQztBQUFBLE1BQ1g7QUFBQSxNQUNBLEtBQUs7QUFBQSxRQUNELE1BQU07QUFBQSxRQUNOLFVBQVU7QUFBQSxRQUNWLE9BQU87QUFBQSxRQUNQLE1BQU07QUFBQSxVQUNGO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNKO0FBQUEsTUFDSjtBQUFBLElBQ0o7QUFBQSxFQUNKLENBQUMsQ0FBQztBQUVOLENBQUM7QUFFRCxNQUFNLDJCQUEyQixPQUFPLElBQVksU0FLOUM7QUFDRixRQUFNLE1BQU0sT0FBTztBQUNuQixVQUFRLElBQUksa0JBQWtCLElBQUksSUFBSTtBQUN0QyxVQUFRLHlDQUF5QyxLQUFLLEVBQUU7QUFDeEQsTUFBSSxDQUFDLEtBQUssZUFBZSxDQUFDLEtBQUssZ0JBQWdCLENBQUMsS0FBSyxVQUFVO0FBQzNEO0FBQUEsRUFDSjtBQUNBLFFBQU0sTUFBTSxHQUFHO0FBQ2YsVUFBUSx5QkFBeUIsS0FBSyxLQUFLLFVBQVU7QUFBQSxJQUNqRCxJQUFJLGFBQWE7QUFBQSxJQUNqQixPQUFPO0FBQUEsSUFDUCxhQUFhO0FBQUEsSUFDYixLQUFLO0FBQUEsSUFDTCxTQUFTO0FBQUEsRUFDYixDQUFDLENBQUM7QUFDRixRQUFNLFFBQVEsVUFBVSxrQkFBa0IsS0FBSyxXQUFXO0FBQzFELFNBQU8sT0FBTztBQUFBLElBQ1YsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1AsU0FBUyxHQUFHLEtBQUssUUFBUSxNQUFNLEtBQUssWUFBWSxhQUFhLGlDQUFpQyxLQUFLLFlBQVksY0FBYztBQUFBLElBQzdILGlCQUFpQjtBQUFBLEVBQ3JCLENBQUM7QUFDTCxDQUFDO0FBRUQsR0FBRyxtQ0FBbUMsWUFBWTtBQUM5QyxVQUFRLElBQUksZ0JBQWdCO0FBQzVCLDJCQUF5QjtBQUM3QixDQUFDO0FBRUQsZ0JBQWdCLHNCQUFzQixPQUFPQSxTQUFnQixTQUFtQjtBQUM1RSxRQUFNLFlBQVksTUFBTSxPQUFPLFFBQVEsU0FBUyxFQUFFLDJCQUEyQkEsT0FBTTtBQUNuRixNQUFJLENBQUMsVUFBVztBQUNoQixXQUFTLFFBQVEsSUFBSSxXQUFXLFFBQVE7QUFDeEMsUUFBTSxNQUFNLEdBQUk7QUFDaEIsV0FBUyxtQkFBbUIsU0FBUztBQUNyQyxVQUFRLDJCQUEyQkEsU0FBUSxTQUFTO0FBQ3hELEdBQUcsS0FBSztBQUVSLGdCQUFnQixnQkFBZ0IsT0FBT0EsU0FBZ0IsU0FBbUI7QUFDdEUsTUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHO0FBQ1YsV0FBTyxPQUFPLHVDQUF1QztBQUFBLEVBQ3pEO0FBQ0EsUUFBTSxRQUFRLEtBQUssQ0FBQztBQUNwQixRQUFNLE1BQU0sTUFBTSxjQUFjLFdBQVdBLFNBQVEsS0FBSztBQUN4RCxNQUFJLFFBQVEsV0FBVztBQUNuQixXQUFPLE9BQU8sUUFBUSxLQUFLLGtDQUFrQztBQUFBLEVBQ2pFLE9BQU87QUFDSCxXQUFPLE9BQU8seUJBQXlCLEtBQUssYUFBYSxHQUFHLEVBQUU7QUFBQSxFQUNsRTtBQUNKLEdBQUcsSUFBSTtBQUVQLEdBQUcsZ0NBQWdDLE9BQU8sUUFBZ0I7QUFDdEQsUUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLEdBQUc7QUFDekUsTUFBSSxDQUFDLFVBQVc7QUFDaEIsUUFBTSxTQUFTLG1CQUFtQixTQUFTO0FBQzNDLFdBQVMsbUJBQW1CLFNBQVM7QUFDekMsQ0FBQztBQUVELEdBQUcsaUJBQWlCLFlBQVk7QUFDNUIsUUFBTSxNQUFNLE9BQU87QUFDbkIsUUFBTSxZQUFZLE1BQU0sUUFBUSxTQUFTLEVBQUUsMkJBQTJCLEdBQUc7QUFDekUsTUFBSSxDQUFDLFVBQVc7QUFDaEIsUUFBTSxTQUFTLG1CQUFtQixTQUFTO0FBQzNDLFdBQVMsbUJBQW1CLFNBQVM7QUFDekMsQ0FBQzsiLAogICJuYW1lcyI6IFsic291cmNlIiwgInNvdXJjZSIsICJzb3VyY2UiLCAicmVzIiwgInNvdXJjZSIsICJzb3VyY2UiLCAic291cmNlIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiZGF0YSIsICJzb3VyY2UiLCAic291cmNlIiwgInJldHdlZXQiLCAic291cmNlIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiaXNSZWN1cnJpbmciLCAic291cmNlIiwgInNvdXJjZSIsICJzb3VyY2UiXQp9Cg==
