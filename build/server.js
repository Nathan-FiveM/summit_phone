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
  await Player.Functions.AddMoney(client, "bank", amount, "Phone Business App Withdraw.");
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
      balance: await citizenId.PlayerData.money.bank
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
      balance: citizenId.PlayerData.money.bank
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2hhcmVkL3V0aWxzLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9jbGFzc2VzL1V0aWxzLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL01haWwvY2xhc3MudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL3N2X2V4cG9ydHMudHMiLCAiLi4vc3VtbWl0X3Bob25lL25vZGVfbW9kdWxlcy8ucG5wbS9Ab3ZlcmV4dGVuZGVkK294X2xpYkAzLjI5LjAvbm9kZV9tb2R1bGVzL0BvdmVyZXh0ZW5kZWQvb3hfbGliL3NoYXJlZC9yZXNvdXJjZS9jYWNoZS9pbmRleC5qcyIsICIuLi9zdW1taXRfcGhvbmUvbm9kZV9tb2R1bGVzLy5wbnBtL0BvdmVyZXh0ZW5kZWQrb3hfbGliQDMuMjkuMC9ub2RlX21vZHVsZXMvQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyL3Jlc291cmNlL2NhbGxiYWNrL2luZGV4LmpzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL0NvbnRhY3RzL2NhbGxiYWNrLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL0RhcmtDaGF0L2NhbGxiYWNrLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL01haWwvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvTWVzc2FnZXMvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvY2FsbEhpc3RvcnlNYW5hZ2VyLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1Bob25lL0NhbGxNYW5hZ2VyLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1NldHRpbmdzL2NsYXNzLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1Bob25lL2NhbGxiYWNrLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1Bob25lL2V2ZW50cy50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9QaG90b3MvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvU2VydmljZXMvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvU2VydmljZXMvZXZlbnRzLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1NldHRpbmdzL2NhbGxiYWNrLnRzIiwgIi4uL3N1bW1pdF9waG9uZS9nYW1lL3NlcnZlci9hcHBzL1NldHRpbmdzL2V2ZW50cy50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9QaWdlb24vUGlnZW9uU2VydmljZS50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9QaWdlb24vY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvSG9zdWluZy9jYWxsYmFjay50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9CbHVlUGFnZS9jYWxsYmFjay50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9HYXJhZ2UvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvV2FsbGV0L2NhbGxiYWNrcy50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvYXBwcy9Hcm91cHMvY2FsbGJhY2sudHMiLCAiLi4vc3VtbWl0X3Bob25lL2dhbWUvc2VydmVyL2FwcHMvSGVhcnRTeW5jL2NhbGxiYWNrcy50cyIsICIuLi9zdW1taXRfcGhvbmUvZ2FtZS9zZXJ2ZXIvc3ZfbWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGZ1bmN0aW9uIERlbGF5KG1zOiBudW1iZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzID0+IHNldFRpbWVvdXQocmVzLCBtcykpO1xufTtcblxuZXhwb3J0IGNvbnN0IGRpc3RhbmNlQmV0d2VlbiA9IChwb3MxOiBudW1iZXJbXSwgcG9zMjogbnVtYmVyW10pID0+IHtcbiAgICByZXR1cm4gTWF0aC5oeXBvdChwb3MxWzBdIC0gcG9zMlswXSwgcG9zMVsxXSAtIHBvczJbMV0sIHBvczFbMl0gLSBwb3MyWzJdKVxufTtcblxuZXhwb3J0IGNvbnN0IGdlbmVyYXRlVVVpZCA9ICgpID0+IHtcbiAgICByZXR1cm4gXCJ4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHhcIi5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgIHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gXCJ4XCIgPyByIDogciAmIDB4MyB8IDB4ODtcbiAgICAgICAgcmV0dXJuIHYudG9TdHJpbmcoMTYpO1xuICAgIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IExPR0dFUiA9IChtZXNzYWdlOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gY29uc29sZS5sb2coYFxceDFiWzFtXFx4MWJbNDdtXFx4MWJbMzRtW1N1bW1pdF9QaG9uZV0gXFx4MWJbNG1cXHgxYlszMW0ke21lc3NhZ2V9XFx4MWJbMG1gKVxufSIsICJpbXBvcnQgeyBGcmFtZXdvcmssIE1vbmdvREIsIE15U1FMIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5jbGFzcyBVdGlsIHtcbiAgICBwdWJsaWMgY29udGFjdHNEYXRhOiBhbnk7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuY29udGFjdHNEYXRhID0gW107XG4gICAgfVxuXG4gICAgYXN5bmMgbG9hZCgpIHtcbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCd0cmFuc2Zlck51bWJlcnMnLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5UcmFuc2Zlck51bWJlcnMoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCd0cmFuc2ZlckNvbnRhY3RzJywgYXN5bmMgKHNvdXJjZTogYW55LCBhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UgPT09IDApIHJldHVybiBMT0dHRVIoJ1RoaXMgY29tbWFuZCBjYW4gb25seSBiZSBleGVjdXRlZCBpbi1nYW1lLicpO1xuICAgICAgICAgICAgYXdhaXQgVXRpbHMuVHJhbnNmZXJDb250YWN0cygpO1xuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICBSZWdpc3RlckNvbW1hbmQoJ21pZ3JhdGVNdWx0aUpvYkRhdGEnLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5NaWdyYXRlTXVsdGlKb2JEYXRhKCk7XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIFJlZ2lzdGVyQ29tbWFuZCgnbWlncmF0ZVNvY2lldHknLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5NaWdyYXRlU29jaWV0eURhdGEoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfTtcblxuICAgIGFzeW5jIFRyYW5zZmVyTnVtYmVycygpIHtcbiAgICAgICAgbGV0IG5ld051bWJlcnM6IGFueVtdID0gW107XG4gICAgICAgIGxldCBuZXdTZXR0aW5nczogYW55W10gPSBbXTtcbiAgICAgICAgbGV0IG5ld0NhcmRzOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgIE15U1FMLnF1ZXJ5KCdTRUxFQ1QgY2l0aXplbmlkLCBjaGFyaW5mbyBGUk9NIHBsYXllcnMnLCBbXSwgYXN5bmMgKHJlc3VsdDogYW55W10pID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCByb3cgb2YgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG93bmVyID0gcm93LmNpdGl6ZW5pZDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNoYXJpbmZvID0gcm93LmNoYXJpbmZvO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHBhcnNlIGlmIHN0b3JlZCBhcyBKU09OIHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNoYXJpbmZvID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFyaW5mbyA9IEpTT04ucGFyc2UoY2hhcmluZm8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJpbmZvID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBwcmVmZXIgY2hhcmluZm8ucGhvbmUsIGZhbGwgYmFjayB0byBwaG9uZV9udW1iZXJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbnVtYmVyID0gKGNoYXJpbmZvICYmIChjaGFyaW5mby5waG9uZSA/PyBjaGFyaW5mby5waG9uZV9udW1iZXIpKSB8fCBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW51bWJlcikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCBpZiBwaG9uZSBudW1iZXIgYWxyZWFkeSBleGlzdHMgZm9yIHRoaXMgb3duZXJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG93bmVyIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmcpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIG5ld051bWJlcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBudW1iZXJcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJlcGFyZSBwaG9uZV9zZXR0aW5ncyBpZiBub3QgcHJlc2VudFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ1NldHRpbmdzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBvd25lciB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFleGlzdGluZ1NldHRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdTZXR0aW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9ja3NjcmVlbjogeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByaW5ndG9uZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJpbmd0b25lczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmw6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzTG9jazogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NrUGluOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VQaW46IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VGYWNlSWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc21ydElkOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHByZXBhcmUgcGhvbmVfcGxheWVyX2NhcmQgaWYgbm90IHByZXNlbnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdDYXJkID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9wbGF5ZXJfY2FyZCcsIHsgX2lkOiBvd25lciB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFleGlzdGluZ0NhcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NhcmRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3ROYW1lOiAnU2V0dXAnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3ROYW1lOiAnQ2FyZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWFpbDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90ZXM6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF2YXRhcjogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChuZXdOdW1iZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9udW1iZXJzJywgbmV3TnVtYmVycyk7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUihgSW5zZXJ0ZWQgJHtuZXdOdW1iZXJzLmxlbmd0aH0gcGhvbmVfbnVtYmVycy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9udW1iZXJzIHRvIGluc2VydC4nKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3U2V0dGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE1hbnkoJ3Bob25lX3NldHRpbmdzJywgbmV3U2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3U2V0dGluZ3MubGVuZ3RofSBwaG9uZV9zZXR0aW5ncy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9zZXR0aW5ncyB0byBpbnNlcnQuJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG5ld0NhcmRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9wbGF5ZXJfY2FyZCcsIG5ld0NhcmRzKTtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBJbnNlcnRlZCAke25ld0NhcmRzLmxlbmd0aH0gcGhvbmVfcGxheWVyX2NhcmQgZW50cmllcy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9wbGF5ZXJfY2FyZCBlbnRyaWVzIHRvIGluc2VydC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoYFRyYW5zZmVyTnVtYmVycyBlcnJvcjogJHtlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBUcmFuc2ZlckNvbnRhY3RzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCB0aGlzLnF1ZXJ5KCdTRUxFQ1QgKiBGUk9NIHBob25lX3Bob25lX2NvbnRhY3RzJywgW10pO1xuXG4gICAgICAgICAgICBpZiAoIXJlc3VsdCB8fCByZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgTE9HR0VSKCdObyBjb250YWN0cyBmb3VuZCB0byB0cmFuc2Zlci4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtpbmRleCwgY29udGFjdF0gb2YgcmVzdWx0LmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgIGlmIChpbmRleCA+IHJlc3VsdC5sZW5ndGgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBQcm9jZXNzaW5nIGNvbnRhY3QgJHtpbmRleCArIDF9IG9mICR7cmVzdWx0Lmxlbmd0aH1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCBvd25lcklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGNvbnRhY3QucGhvbmVfbnVtYmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRhY3RzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgcGVyc29uYWxOdW1iZXI6IGNvbnRhY3QucGhvbmVfbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBjb250YWN0TnVtYmVyOiBjb250YWN0LmNvbnRhY3RfcGhvbmVfbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBmaXJzdE5hbWU6IGNvbnRhY3QuZmlyc3RuYW1lLFxuICAgICAgICAgICAgICAgICAgICBsYXN0TmFtZTogY29udGFjdC5sYXN0bmFtZSxcbiAgICAgICAgICAgICAgICAgICAgaW1hZ2U6IGNvbnRhY3QucHJvZmlsZV9pbWFnZSxcbiAgICAgICAgICAgICAgICAgICAgb3duZXJJZDogb3duZXJJZCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0TWFueSgncGhvbmVfY29udGFjdHMnLCB0aGlzLmNvbnRhY3RzRGF0YSk7XG4gICAgICAgICAgICBMT0dHRVIoJ1Bob25lIGNvbnRhY3RzIGhhdmUgYmVlbiB0cmFuc2ZlcnJlZCB0byBNb25nb0RCLicpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBMT0dHRVIoYEVycm9yIHdoaWxlIHRyYW5zZmVycmluZyBjb250YWN0czogJHtKU09OLnN0cmluZ2lmeShlLCBudWxsLCAyKX1gKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYyBNaWdyYXRlTXVsdGlKb2JEYXRhKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCB0aGlzLnF1ZXJ5KCdTRUxFQ1QgaWQsIGpvYm5hbWUsIGVtcGxveWVlcyBGUk9NIHBsYXllcl9qb2JzJywgW10pO1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQgfHwgcmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIExPR0dFUignTm8gbXVsdGlqb2JzIGZvdW5kIHRvIHRyYW5zZmVyLicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmV3RGF0YTogYW55W10gPSBbXTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCByb3cgb2YgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgam9iSWQgPSByb3cuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGpvYk5hbWUgPSByb3cuam9ibmFtZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFqb2JOYW1lKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBsZXQgZW1wbG95ZWVzID0gcm93LmVtcGxveWVlcztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlbXBsb3llZXMpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZW1wbG95ZWVzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbXBsb3llZXMgPSBKU09OLnBhcnNlKGVtcGxveWVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEZhaWxlZCB0byBwYXJzZSBlbXBsb3llZXMgSlNPTiBmb3Igam9iICR7am9iTmFtZX0gKGlkOiAke2pvYklkfSk6ICR7ZXJyfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlbXBsb3llZXMgfHwgdHlwZW9mIGVtcGxveWVlcyAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShlbXBsb3llZXMpKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIGVtcF0gb2YgT2JqZWN0LmVudHJpZXMoZW1wbG95ZWVzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2lkID0gKGVtcCAmJiAoZW1wLmNpZCB8fCBlbXAuQ0lEIHx8IGVtcC5jaXRpemVuSWQpKSB8fCBrZXk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBncmFkZUxldmVsID0gKGVtcCAmJiAoZW1wLmdyYWRlID8/IGVtcC5ncmFkZUxldmVsID8/IGVtcC5yYW5rKSkgPz8gMDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgam9iTGFiZWwgPSBGcmFtZXdvcms/LlNoYXJlZD8uSm9icz8uW2pvYk5hbWVdPy5sYWJlbCA/PyBqb2JOYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ3JhZGVMYWJlbCA9IEZyYW1ld29yaz8uU2hhcmVkPy5Kb2JzPy5bam9iTmFtZV0/LmdyYWRlcz8uW2dyYWRlTGV2ZWxdPy5uYW1lID8/ICcnO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdEYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2l0aXplbklkOiBjaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgam9iTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmFkZUxldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpvYkxhYmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyYWRlTGFiZWxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaW5uZXJFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBFcnJvciBwcm9jZXNzaW5nIHBsYXllcl9qb2JzIHJvdyBpZCAke3Jvdy5pZH06ICR7aW5uZXJFcnJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobmV3RGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCBuZXdEYXRhKTtcbiAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3RGF0YS5sZW5ndGh9IG11bHRpam9iIGVudHJpZXMgdG8gcGhvbmVfbXVsdGlqb2JzLmApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG11bHRpam9iIGVudHJpZXMgZm91bmQgdG8gaW5zZXJ0IGFmdGVyIHBhcnNpbmcuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgTE9HR0VSKGBNaWdyYXRlTXVsdGlKb2JEYXRhIGVycm9yOiAke2Vycn1gKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYyBNaWdyYXRlU29jaWV0eURhdGEoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgdGhpcy5xdWVyeSgnU0VMRUNUICogRlJPTSBhdl9zb2NpZXR5JywgW10pO1xuXG4gICAgICAgIHJlc3VsdC5mb3JFYWNoKGFzeW5jIChqb2I6IGFueSkgPT4ge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3N1bW1pdF9iYW5rJywgeyBfaWQ6IGpvYi5qb2IgfSwge1xuICAgICAgICAgICAgICAgIGJhbmtCYWxhbmNlOiBOdW1iZXIoam9iLm1vbmV5KVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSlcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBhc3luYyBHZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbnVtYmVycycsIHsgb3duZXI6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5udW1iZXI7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5zbXJ0SWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEVtYWlsSWRCeVNvdXJjZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgZW1haWwgPSBhd2FpdCB0aGlzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICByZXR1cm4gZW1haWw7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG51bWJlcjogcGhvbmVOdW1iZXIgfSk7XG4gICAgICAgIGlmICghbnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBudW1iZXIub3duZXI7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFBsYXllckZyb21QaG9uZU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIHJldHVybiBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBCbG9ja051bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkLFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMgVW5ibG9ja051bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBJc051bWJlckJsb2NrZWQocGhvbmVOdW1iZXI6IHN0cmluZywgdGFyZ2V0UGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXIpO1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIodGFyZ2V0UGhvbmVOdW1iZXIpO1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCB8fCAhdGFyZ2V0Q2l0aXplbklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgICAgICByZXR1cm4gYmxvY2tlZCA/IHRydWUgOiBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q29udGFjdE5hbWVCeU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGhvbmVOdW1iZXIsIG93bmVySWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFjb250YWN0KSByZXR1cm4gcGhvbmVOdW1iZXI7XG4gICAgICAgIHJldHVybiBgJHtjb250YWN0LmZpcnN0TmFtZX0gJHtjb250YWN0Lmxhc3ROYW1lfWA7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENvbnRhY3RBdmF0YXJCeU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGhvbmVOdW1iZXIsIG93bmVySWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFjb250YWN0KSByZXR1cm4gJyc7XG4gICAgICAgIHJldHVybiBjb250YWN0LmltYWdlO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRTb3VyY2VGcm9tQ2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICBpZiAoIXNvdXJjZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gc291cmNlLlBsYXllckRhdGEuc291cmNlO1xuICAgIH1cblxuICAgIGFzeW5jIEhhc1Bob25lKHBsYXllclNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHBob25lTGlzdDogc3RyaW5nW10gPSBbXG4gICAgICAgICAgICAnYmx1ZV9waG9uZScsXG4gICAgICAgICAgICAnZ3JlZW5fcGhvbmUnLFxuICAgICAgICAgICAgJ3JlZF9waG9uZScsXG4gICAgICAgICAgICAnZ29sZF9waG9uZScsXG4gICAgICAgICAgICAncHVycGxlX3Bob25lJyxcbiAgICAgICAgXTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBwaG9uZUl0ZW0gb2YgcGhvbmVMaXN0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGFzID0gYXdhaXQgZXhwb3J0c1snbGotaW52ZW50b3J5J10uSGFzSXRlbShwbGF5ZXJTb3VyY2UsIHBob25lSXRlbSk7XG4gICAgICAgICAgICAgICAgaWYgKGhhcykgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0hhc1Bob25lIGNoZWNrIGZhaWxlZDonLCBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgSW5GbGlnaHRNb2RlKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghc2V0dGluZ3MpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHNldHRpbmdzLmlzRmxpZ2h0TW9kZSB8fCBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgcXVlcnkocXVlcnk6IHN0cmluZywgdmFsdWVzOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIE15U1FMLnF1ZXJ5KHF1ZXJ5LCB2YWx1ZXMsIChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMgaXNTZW5kZXJLbm93bihzZW5kZXJJZDogc3RyaW5nLCByZWNlaXZlcklkOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgLy8gUXVlcnkgdG8gY2hlY2sgaWYgdGhlIHNlbmRlciBpcyBpbiB0aGUgcmVjZWl2ZXIncyBjb250YWN0c1xuICAgICAgICBjb25zdCBjb250YWN0UXVlcnkgPSB7XG4gICAgICAgICAgICBvd25lcklkOiByZWNlaXZlcklkLFxuICAgICAgICAgICAgY29udGFjdE51bWJlcjogc2VuZGVySWRcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUcnkgdG8gZmluZCBhIGNvbnRhY3QgZW50cnlcbiAgICAgICAgY29uc3QgY29udGFjdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCBjb250YWN0UXVlcnkpO1xuXG4gICAgICAgIC8vIElmIGEgY29udGFjdCBpcyBmb3VuZCwgdGhlIHNlbmRlciBpcyBrbm93blxuICAgICAgICByZXR1cm4gY29udGFjdCAhPT0gbnVsbDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0UGhvbmVOdW1iZXJCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgc21ydElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5waG9uZU51bWJlcjtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2l0aXplbklkQnlFbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IHNtcnRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghbnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBudW1iZXIuX2lkO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRQbGF5ZXJCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeUVtYWlsKGVtYWlsKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRBdmF0YXJGcm9tRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCBhdmF0b3IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghYXZhdG9yKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBhdmF0b3IuYXZhdGFyO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRVc2VyTmFtZUZyb21FbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghdXNlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gdXNlci51c2VybmFtZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2lkRnJvbVR3ZWV0SWQoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBwaWdlb25JZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlcy5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENpZHNGcm9tUGlnZW9uRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9zZXR0aW5ncycsIHsgcGlnZW9uSWRBdHRhY2hlZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghcmVzIHx8IHJlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcbiAgICAgICAgcmV0dXJuIHJlcy5tYXAoKHNldHRpbmc6IGFueSkgPT4gc2V0dGluZy5faWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDaWRGcm9tRGFya0VtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgZGFya01haWxJZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlcy5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIElzUGxheWVySW5KYWlsKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIXBsYXllcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXRhZGF0YSA9IHBsYXllci5QbGF5ZXJEYXRhLm1ldGFkYXRhO1xuICAgICAgICAgICAgcmV0dXJuIG1ldGFkYXRhICYmIG1ldGFkYXRhLmluamFpbCAmJiBtZXRhZGF0YS5pbmphaWwgPiAwO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBcbiAgICBhc3luYyBnZXRKb2JzKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGpvYnM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgY29uc3QgZW1wbG95ZWVzOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBhbnk+PiA9IHt9O1xuXG4gICAgICAgIC8vIGZpbmQgYWxsIG11bHRpam9iIGVudHJpZXMgZm9yIHRoaXMgY2l0aXplblxuICAgICAgICBjb25zdCBteUVudHJpZXM6IGFueVtdID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghbXlFbnRyaWVzIHx8IG15RW50cmllcy5sZW5ndGggPT09IDApIHJldHVybiB7IGpvYnMsIGVtcGxveWVlcyB9O1xuXG4gICAgICAgIC8vIGNvbGxlY3QgdW5pcXVlIGpvYiBuYW1lcyBzbyB3ZSBjYW4gZmV0Y2ggYWxsIGVtcGxveWVlcyBmb3IgdGhvc2Ugam9icyBpbiBvbmUgcXVlcnlcbiAgICAgICAgY29uc3Qgam9iTmFtZXMgPSBBcnJheS5mcm9tKG5ldyBTZXQobXlFbnRyaWVzLm1hcChlID0+IGUuam9iTmFtZSkpKTtcblxuICAgICAgICAvLyBidWlsZCBqb2JzIG1hcCAob25lIGVudHJ5IHBlciBqb2IgdGhpcyBjaWQgaGFzKVxuICAgICAgICBmb3IgKGNvbnN0IGUgb2YgbXlFbnRyaWVzKSB7XG4gICAgICAgICAgICBqb2JzW2Uuam9iTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiBlLmNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBqb2JOYW1lOiBlLmpvYk5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGVMZXZlbDogZS5ncmFkZUxldmVsID8/IDAsXG4gICAgICAgICAgICAgICAgam9iTGFiZWw6IGUuam9iTGFiZWwgPz8gRnJhbWV3b3JrPy5TaGFyZWQ/LkpvYnM/LltlLmpvYk5hbWVdPy5sYWJlbCA/PyBlLmpvYk5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGVMYWJlbDogZS5ncmFkZUxhYmVsID8/IEZyYW1ld29yaz8uU2hhcmVkPy5Kb2JzPy5bZS5qb2JOYW1lXT8uZ3JhZGVzPy5bZS5ncmFkZUxldmVsXT8ubmFtZSA/PyAnJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZldGNoIGFsbCBlbXBsb3llZXMgZm9yIHRoZSBjb2xsZWN0ZWQgam9icyBhbmQgYnVpbGQgZW1wbG95ZWVzIG1hcDogeyBqb2JOYW1lOiB7IGNpZDogey4uLn0sIC4uLiB9LCAuLi4gfVxuICAgICAgICBjb25zdCBhbGxFbXBsb3llZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGpvYk5hbWU6IHsgJGluOiBqb2JOYW1lcyB9IH0pO1xuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGFsbEVtcGxveWVlcykge1xuICAgICAgICAgICAgZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdID0gZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdW2VudHJ5LmNpdGl6ZW5JZF0gPSB7XG4gICAgICAgICAgICAgICAgY2lkOiBlbnRyeS5jaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgZ3JhZGU6IGVudHJ5LmdyYWRlTGV2ZWwgPz8gMCxcbiAgICAgICAgICAgICAgICBncmFkZUxhYmVsOiBlbnRyeS5ncmFkZUxhYmVsID8/ICcnLFxuICAgICAgICAgICAgICAgIGpvYkxhYmVsOiBlbnRyeS5qb2JMYWJlbCA/PyAnJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGpvYnMsIGVtcGxveWVlcyB9O1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IFV0aWxzID0gbmV3IFV0aWwoKTsiLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFBob25lTWFpbCwgUGhvbmVNYWlsTWVzc2FnZSB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuXG5jbGFzcyBNYWlsIHtcbiAgICBhc3luYyBnZXRNYWlsTWVzc2FnZXMoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykge1xuICAgICAgICBpZiAoIWVtYWlsICYmICFwYXNzd29yZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCwgYWN0aXZlTWFpbFBhc3N3b3JkOiBwYXNzd29yZCB9KTtcbiAgICAgICAgaWYgKCFtYWlsRGF0YSB8fCBtYWlsRGF0YS5tZXNzYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIG1haWxEYXRhLm1lc3NhZ2VzID0gW107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYWlsRGF0YS5tZXNzYWdlcyA9IG1haWxEYXRhLm1lc3NhZ2VzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBuZXcgRGF0ZShiLmRhdGUpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEuZGF0ZSkuZ2V0VGltZSgpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShtYWlsRGF0YS5tZXNzYWdlcyk7XG4gICAgfTtcblxuICAgIGFzeW5jIHNlbmRNYWlsKGVtYWlsOiBzdHJpbmcsIHRvOiBzdHJpbmcsIHN1YmplY3Q6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nLCBpbWFnZXM6IHN0cmluZ1tdLCBzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSBlbWFpbDtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdG87XG5cbiAgICAgICAgY29uc3QgcGxheWVyTWFpbDogUGhvbmVNYWlsID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHBsYXllciB9KTtcbiAgICAgICAgY29uc3QgdGFyZ2V0TWFpbDogUGhvbmVNYWlsID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHRhcmdldCB9KTtcbiAgICAgICAgaWYgKCFwbGF5ZXJNYWlsIHx8ICF0YXJnZXRNYWlsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG5ld01haWxNZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHBsYXllcixcbiAgICAgICAgICAgIHRvOiB0YXJnZXQsXG4gICAgICAgICAgICBhdmF0YXI6IGF3YWl0IFV0aWxzLkdldEF2YXRhckZyb21FbWFpbCh0YXJnZXQpLFxuICAgICAgICAgICAgdXNlcm5hbWU6IGF3YWl0IFV0aWxzLkdldFVzZXJOYW1lRnJvbUVtYWlsKHRhcmdldCksXG4gICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSwgXG4gICAgICAgICAgICBpbWFnZXM6IGltYWdlcyxcbiAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHJlYWQ6IHRydWUsXG4gICAgICAgICAgICB0YWdzOiBbJ2luYm94JywgJ3NlbnQnXVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHRhcmdldE1haWxtZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHBsYXllcixcbiAgICAgICAgICAgIHRvOiB0YXJnZXQsXG4gICAgICAgICAgICBhdmF0YXI6IGF3YWl0IFV0aWxzLkdldEF2YXRhckZyb21FbWFpbChwbGF5ZXIpLFxuICAgICAgICAgICAgc3ViamVjdDogc3ViamVjdCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICB1c2VybmFtZTogYXdhaXQgVXRpbHMuR2V0VXNlck5hbWVGcm9tRW1haWwocGxheWVyKSxcbiAgICAgICAgICAgIGltYWdlczogaW1hZ2VzLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgICAgICB0YWdzOiBbJ2luYm94J11cbiAgICAgICAgfVxuICAgICAgICBwbGF5ZXJNYWlsLm1lc3NhZ2VzLnB1c2gobmV3TWFpbE1lc3NhZ2UpO1xuICAgICAgICB0YXJnZXRNYWlsLm1lc3NhZ2VzLnB1c2godGFyZ2V0TWFpbG1lc3NhZ2UpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBwbGF5ZXIgfSwgcGxheWVyTWFpbCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHRhcmdldCB9LCB0YXJnZXRNYWlsKTtcblxuICAgICAgICBjb25zdCB0YXJnZXRDaWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJCeUVtYWlsKHRhcmdldCk7XG4gICAgICAgIHBsYXllck1haWwubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IG5ldyBEYXRlKGIuZGF0ZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5kYXRlKS5nZXRUaW1lKCkpO1xuICAgICAgICB0YXJnZXRNYWlsLm1lc3NhZ2VzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBuZXcgRGF0ZShiLmRhdGUpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEuZGF0ZSkuZ2V0VGltZSgpKTtcblxuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2htYWlsTWVzc2FnZXMnLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHBsYXllck1haWwubWVzc2FnZXMpKTtcbiAgICAgICAgaWYgKHRhcmdldENpZCkge1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0Q2lkLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWFpbCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBhIG5ldyBtYWlsIGZyb20gJHtwbGF5ZXJ9LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaG1haWxNZXNzYWdlcycsIHRhcmdldENpZC5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkodGFyZ2V0TWFpbC5tZXNzYWdlcykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBzZW5kRW1haWxUb0FsbChzdWJqZWN0OiBzdHJpbmcsIHNlbmRlcjogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIGltYWdlczogc3RyaW5nW10pIHtcbiAgICAgICAgY29uc3QgbWFpbERhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IHsgJG5lOiBudWxsIH0gfSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgbWFpbERhdGEuZm9yRWFjaChhc3luYyAobWFpbDogUGhvbmVNYWlsKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXdNYWlsTWVzc2FnZTogUGhvbmVNYWlsTWVzc2FnZSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGZyb206IHNlbmRlcixcbiAgICAgICAgICAgICAgICB0bzogbWFpbC5hY3RpdmVNYWlkSWQsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiAnJyxcbiAgICAgICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgaW1hZ2VzOiBpbWFnZXMgfHwgW10sXG4gICAgICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHRhZ3M6IFsnaW5ib3gnXSxcbiAgICAgICAgICAgICAgICB1c2VybmFtZTogc2VuZGVyXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbWFpbC5tZXNzYWdlcy5wdXNoKG5ld01haWxNZXNzYWdlKTtcbiAgICAgICAgICAgIC8vQHRzLWlnbm9yZVxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbC5faWQgfSwgbWFpbCk7XG4gICAgICAgIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCAtMSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdNYWlsJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYSBuZXcgbWFpbCwgJHttZXNzYWdlfS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBzZWxlY3RlTWVzc2FnZShkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHsgbWVzc2FnZUlkLCBtYWlsSWQgfSA9IHBhcnNlZERhdGE7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhOiBQaG9uZU1haWwgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbElkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBtYWlsRGF0YS5tZXNzYWdlcy5maW5kKChtKSA9PiBtLl9pZCA9PT0gbWVzc2FnZUlkKTtcbiAgICAgICAgaWYgKCFtZXNzYWdlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIG1lc3NhZ2UucmVhZCA9IHRydWU7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IG1haWxJZCB9LCBtYWlsRGF0YSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBnZXRQcm9maWxlU2V0dGluZ3MoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZEFuZFJldHVyblNwZWNpZmljRmllbGRzKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0sIFsnYWN0aXZlTWFpZElkJywgJ2FjdGl2ZU1haWxQYXNzd29yZCcsICdhdmF0YXInLCAndXNlcm5hbWUnXSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG1haWxEYXRhKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgdXBkYXRlUHJvZmlsZVNldHRpbmdzKGVtYWlsOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcsIHVzZXJuYW1lOiBzdHJpbmcsIGF2YXRhcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIG1haWxEYXRhLnVzZXJuYW1lID0gdXNlcm5hbWU7XG4gICAgICAgIG1haWxEYXRhLmF2YXRhciA9IGF2YXRhcjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwsIGFjdGl2ZU1haWxQYXNzd29yZDogcGFzc3dvcmQgfSwgbWFpbERhdGEpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xufVxuXG5leHBvcnQgY29uc3QgTWFpbENsYXNzID0gbmV3IE1haWwoKTsiLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIi4vY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTWFpbENsYXNzIH0gZnJvbSBcIi4vYXBwcy9NYWlsL2NsYXNzXCI7XG5cbmFzeW5jIGZ1bmN0aW9uIEdldEN1cnJlbnRQaG9uZU51bWJlcihzb3VyY2U6IG51bWJlciB8IHN0cmluZykge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICByZXR1cm4gbnVtYmVyO1xufVxuZXhwb3J0cygnR2V0Q3VycmVudFBob25lTnVtYmVyJywgR2V0Q3VycmVudFBob25lTnVtYmVyKTtcblxuYXN5bmMgZnVuY3Rpb24gR2V0Q3VycmVudFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn1cbmV4cG9ydHMoJ0dldEN1cnJlbnRQaG9uZU51bWJlckJ5Q2l0aXplbklkJywgR2V0Q3VycmVudFBob25lTnVtYmVyQnlDaXRpemVuSWQpO1xuXG5hc3luYyBmdW5jdGlvbiBHZXRFbWFpbElkQnlDaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICBjb25zdCBlbWFpbCA9IGF3YWl0IFV0aWxzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIHJldHVybiBlbWFpbDtcbn1cbmV4cG9ydHMoJ0dldEVtYWlsSWRCeUNpdGl6ZW5JZCcsIEdldEVtYWlsSWRCeUNpdGl6ZW5JZCk7XG5cbmFzeW5jIGZ1bmN0aW9uIEdldEVtYWlsSWRCeVNvdXJjZShzb3VyY2U6IG51bWJlciB8IHN0cmluZykge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGVtYWlsID0gYXdhaXQgVXRpbHMuR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIGVtYWlsO1xufVxuZXhwb3J0cygnR2V0RW1haWxJZEJ5U291cmNlJywgR2V0RW1haWxJZEJ5U291cmNlKTtcblxuYXN5bmMgZnVuY3Rpb24gU2VuZE5vdGlmaWNhdGlvbihzb3VyY2U6IG51bWJlciB8IHN0cmluZywgdGl0bGU6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZywgYXBwOiBzdHJpbmcsIHRpbWVvdXQ/OiBudW1iZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgYXBwLFxuICAgICAgICB0aW1lb3V0OiB0aW1lb3V0IHx8IDUwMDAsXG4gICAgfSkpO1xufVxuZXhwb3J0cygnU2VuZE5vdGlmaWNhdGlvbicsIFNlbmROb3RpZmljYXRpb24pO1xuXG5hc3luYyBmdW5jdGlvbiBTZW5kTWFpbChkYXRhOiB7XG4gICAgZW1haWw6IHN0cmluZztcbiAgICB0bzogc3RyaW5nO1xuICAgIHN1YmplY3Q6IHN0cmluZztcbiAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgaW1hZ2VzOiBzdHJpbmdbXTtcbiAgICBzb3VyY2U6IG51bWJlcjtcbn0pIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNYWlsQ2xhc3Muc2VuZE1haWwoZGF0YS5lbWFpbCwgZGF0YS50bywgZGF0YS5zdWJqZWN0LCBkYXRhLm1lc3NhZ2UsIGRhdGEuaW1hZ2VzLCBkYXRhLnNvdXJjZSk7XG4gICAgcmV0dXJuIHJlcztcbn1cbmV4cG9ydHMoJ1NlbmRNYWlsJywgU2VuZE1haWwpO1xuXG5hc3luYyBmdW5jdGlvbiBTZW5kTWFpbFRvQWxsKGRhdGE6IHtcbiAgICBzdWJqZWN0OiBzdHJpbmc7XG4gICAgc2VuZGVyOiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGltYWdlczogc3RyaW5nW107XG59KSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbmRFbWFpbFRvQWxsKGRhdGEuc3ViamVjdCwgZGF0YS5zZW5kZXIsZGF0YS5tZXNzYWdlLCBkYXRhLmltYWdlcyk7XG4gICAgcmV0dXJuIHJlcztcbn1cbmV4cG9ydHMoJ1NlbmRNYWlsVG9BbGwnLCBTZW5kTWFpbFRvQWxsKTtcblxuY29uc3QgR2V0Sm9icyA9IGFzeW5jIChjaXRpemVuSWQ6IHN0cmluZykgPT4ge1xuICAgIGlmICghY2l0aXplbklkKSByZXR1cm4ge307XG4gICAgY29uc3QgcmVzID0gYXdhaXQgVXRpbHMuZ2V0Sm9icyhjaXRpemVuSWQpO1xuICAgIHJldHVybiByZXMuam9icyB8fCB7fTtcbn07XG5leHBvcnRzKCdnZXRKb2JzJywgR2V0Sm9icyk7XG5cbi8vIE9wdGlvbmFsOiByZXR1cm4gZnVsbCByZXN1bHQgeyBqb2JzLCBlbXBsb3llZXMgfVxuY29uc3QgR2V0Sm9ic0Z1bGwgPSBhc3luYyAoY2l0aXplbklkOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgam9iczoge30sIGVtcGxveWVlczoge30gfTtcbiAgICByZXR1cm4gYXdhaXQgVXRpbHMuZ2V0Sm9icyhjaXRpemVuSWQpO1xufTtcbmV4cG9ydHMoJ2dldEpvYnNGdWxsJywgR2V0Sm9ic0Z1bGwpOyIsICJjb25zdCBjYWNoZUV2ZW50cyA9IHt9O1xuZXhwb3J0IGNvbnN0IGNhY2hlID0gbmV3IFByb3h5KHtcbiAgICByZXNvdXJjZTogR2V0Q3VycmVudFJlc291cmNlTmFtZSgpLFxuICAgIGdhbWU6IEdldEdhbWVOYW1lKCksXG59LCB7XG4gICAgZ2V0KHRhcmdldCwga2V5KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGtleSA/IHRhcmdldFtrZXldIDogdGFyZ2V0O1xuICAgICAgICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICBjYWNoZUV2ZW50c1trZXldID0gW107XG4gICAgICAgIEFkZEV2ZW50SGFuZGxlcihgb3hfbGliOmNhY2hlOiR7a2V5fWAsICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IGNhY2hlRXZlbnRzW2tleV07XG4gICAgICAgICAgICBldmVudHMuZm9yRWFjaCgoY2IpID0+IGNiKHZhbHVlLCBvbGRWYWx1ZSkpO1xuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRhcmdldFtrZXldID0gZXhwb3J0cy5veF9saWIuY2FjaGUoa2V5KSB8fCBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldFtrZXldO1xuICAgIH0sXG59KTtcbmV4cG9ydCBjb25zdCBvbkNhY2hlID0gKGtleSwgY2IpID0+IHtcbiAgICBpZiAoIWNhY2hlRXZlbnRzW2tleV0pXG4gICAgICAgIGNhY2hlW2tleV07XG4gICAgY2FjaGVFdmVudHNba2V5XS5wdXNoKGNiKTtcbn07XG4iLCAiaW1wb3J0IHsgY2FjaGUgfSBmcm9tICcuLi9jYWNoZSc7XG5jb25zdCBwZW5kaW5nQ2FsbGJhY2tzID0ge307XG5jb25zdCBjYWxsYmFja1RpbWVvdXQgPSBHZXRDb252YXJJbnQoJ294OmNhbGxiYWNrVGltZW91dCcsIDMwMDAwMCk7XG5vbk5ldChgX19veF9jYl8ke2NhY2hlLnJlc291cmNlfWAsIChrZXksIC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCByZXNvbHZlID0gcGVuZGluZ0NhbGxiYWNrc1trZXldO1xuICAgIGRlbGV0ZSBwZW5kaW5nQ2FsbGJhY2tzW2tleV07XG4gICAgcmV0dXJuIHJlc29sdmUgJiYgcmVzb2x2ZSguLi5hcmdzKTtcbn0pO1xuZXhwb3J0IGZ1bmN0aW9uIHRyaWdnZXJDbGllbnRDYWxsYmFjayhldmVudE5hbWUsIHBsYXllcklkLCAuLi5hcmdzKSB7XG4gICAgbGV0IGtleTtcbiAgICBkbyB7XG4gICAgICAgIGtleSA9IGAke2V2ZW50TmFtZX06JHtNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoMTAwMDAwICsgMSkpfToke3BsYXllcklkfWA7XG4gICAgfSB3aGlsZSAocGVuZGluZ0NhbGxiYWNrc1trZXldKTtcbiAgICBlbWl0TmV0KGBfX294X2NiXyR7ZXZlbnROYW1lfWAsIHBsYXllcklkLCBjYWNoZS5yZXNvdXJjZSwga2V5LCAuLi5hcmdzKTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBwZW5kaW5nQ2FsbGJhY2tzW2tleV0gPSByZXNvbHZlO1xuICAgICAgICBzZXRUaW1lb3V0KHJlamVjdCwgY2FsbGJhY2tUaW1lb3V0LCBgY2FsbGJhY2sgZXZlbnQgJyR7a2V5fScgdGltZWQgb3V0YCk7XG4gICAgfSk7XG59XG5leHBvcnQgZnVuY3Rpb24gb25DbGllbnRDYWxsYmFjayhldmVudE5hbWUsIGNiKSB7XG4gICAgb25OZXQoYF9fb3hfY2JfJHtldmVudE5hbWV9YCwgYXN5bmMgKHJlc291cmNlLCBrZXksIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgY29uc3Qgc3JjID0gc291cmNlO1xuICAgICAgICBsZXQgcmVzcG9uc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNwb25zZSA9IGF3YWl0IGNiKHNyYywgLi4uYXJncyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGhhbmRsaW5nIGNhbGxiYWNrIGV2ZW50ICR7ZXZlbnROYW1lfWApO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYF4zJHtlLnN0YWNrfV4wYCk7XG4gICAgICAgIH1cbiAgICAgICAgZW1pdE5ldChgX19veF9jYl8ke3Jlc291cmNlfWAsIHNyYywga2V5LCByZXNwb25zZSk7XG4gICAgfSk7XG59XG4iLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFBob25lQ29udGFjdHMgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czpnZXRDb250YWN0cycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgY29udGFjdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9jb250YWN0cycsIHsgb3duZXJJZDogY2l0aXplbklkIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShjb250YWN0cyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6c2F2ZUNvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjb250YWN0RGF0YTogUGhvbmVDb250YWN0cyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgaWYgKGNvbnRhY3REYXRhLl9pZCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogY29udGFjdERhdGEuX2lkIH0sIHsgLi4uY29udGFjdERhdGEgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ29udGFjdCBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3REYXRhLmZpcnN0TmFtZX0nJHtjb250YWN0RGF0YS5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdERhdGEuY29udGFjdE51bWJlcn0pIHVwZGF0ZWQgYnkgJHtjb250YWN0RGF0YS5wZXJzb25hbE51bWJlcn0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOmFkZENvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgY29udGFjdERhdGE6IFBob25lQ29udGFjdHMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGRhdGFYID0geyAuLi5jb250YWN0RGF0YSwgb3duZXJJZDogY2l0aXplbklkLCBwZXJzb25hbE51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfY29udGFjdHMnLCBkYXRhWCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9jb250YWN0cycsXG4gICAgICAgIHRpdGxlOiAnQ29udGFjdCBBZGRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3REYXRhLmZpcnN0TmFtZX0nJHtjb250YWN0RGF0YS5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdERhdGEuY29udGFjdE51bWJlcn0pIGFkZGVkIGJ5ICR7ZGF0YVgucGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YVgpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOmRlbGV0ZUNvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBfaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNvbnRhY3QgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9KTtcbiAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogX2lkIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICB0aXRsZTogJ0NvbnRhY3QgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3QuZmlyc3ROYW1lfScgJyR7Y29udGFjdC5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdC5jb250YWN0TnVtYmVyfSkgZGVsZXRlZCBieSAke2NvbnRhY3QucGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czpmYXZDb250YWN0JywgYXN5bmMgKGNsaWVudCwgX2lkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSk7XG4gICAgY29uc3QgZGF0YVggPSB7IC4uLmNvbnRhY3QsIGlzRmF2OiAhY29udGFjdC5pc0ZhdiB9XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9LCBkYXRhWCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9jb250YWN0cycsXG4gICAgICAgIHRpdGxlOiAnQ29udGFjdCBGYXZvcml0ZSBUb2dnbGVkJyxcbiAgICAgICAgbWVzc2FnZTogYENvbnRhY3QgJyR7Y29udGFjdC5maXJzdE5hbWV9JyAnJHtjb250YWN0Lmxhc3ROYW1lfScgKE51bWJlcjogJHtjb250YWN0LmNvbnRhY3ROdW1iZXJ9KSBmYXZvcml0ZSBzdGF0dXMgc2V0IHRvICR7ZGF0YVguaXNGYXZ9IGJ5ICR7Y29udGFjdC5wZXJzb25hbE51bWJlcn0uYCxcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YVgpO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRGFya0NoYXRDaGFubmVsIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcblxub25DbGllbnRDYWxsYmFjaygnU2VhcmNoRGFya0NoYXRFbWFpbCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdSZWdpc3Rlck5ld0RhcmtNYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsLCBlbWFpbCwgcGFzc3dvcmQsIGF2YXRhcjogXCJcIiB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2FjY291bnRzJyxcbiAgICAgICAgdGl0bGU6ICdBY2NvdW50IFJlZ2lzdGVyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTmV3IERhcmtDaGF0IGFjY291bnQgcmVnaXN0ZXJlZCB3aXRoIGVtYWlsICR7ZW1haWx9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdMb2dpbkRhcmtNYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgZW1haWw6IHN0cmluZztcbiAgICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogcGFyc2VkRGF0YS5lbWFpbCB9KTtcbiAgICBpZiAocmVzLnBhc3N3b3JkID09PSBwYXJzZWREYXRhLnBhc3N3b3JkKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2FjY291bnRzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQWNjb3VudCBMb2dpbicsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciBsb2dnZWQgaW50byBEYXJrQ2hhdCB3aXRoIGVtYWlsICR7cGFyc2VkRGF0YS5lbWFpbH0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnQ3JlYXRlTmV3RGFya0NoYW5uZWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IG5hbWUsIGVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlczI6IERhcmtDaGF0Q2hhbm5lbFtdID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7fSk7XG4gICAgaWYgKHJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKSAmJiAhcmVzMi5maW5kKChjaGFubmVsKSA9PiBjaGFubmVsLm5hbWUgPT09IG5hbWUpPy5tZW1iZXJzLmluY2x1ZGVzKGVtYWlsKSkge1xuICAgICAgICByZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSk/Lm1lbWJlcnMucHVzaChlbWFpbCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgbmFtZSB9LCByZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgICAgICB0aXRsZTogJ0pvaW5lZCBDaGFubmVsJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSBqb2luZWQgZXhpc3RpbmcgRGFya0NoYXQgY2hhbm5lbCAnJHtuYW1lfScuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMyLmZpbHRlcigoY2hhbm5lbCkgPT4gY2hhbm5lbC5tZW1iZXJzLmluY2x1ZGVzKGVtYWlsKSkpO1xuICAgIH0gZWxzZSBpZiAoIXJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKSkge1xuICAgICAgICBjb25zdCBuZXdEYXRhID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICBtZW1iZXJzOiBbZW1haWxdLFxuICAgICAgICAgICAgY3JlYXRvcjogZW1haWwsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIG5ld0RhdGEpO1xuICAgICAgICByZXMyLnB1c2gobmV3RGF0YSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ2hhbm5lbCBDcmVhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSBjcmVhdGVkIG5ldyBEYXJrQ2hhdCBjaGFubmVsICcke25hbWV9Jy5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlczIuZmlsdGVyKChjaGFubmVsKSA9PiBjaGFubmVsLm1lbWJlcnMuaW5jbHVkZXMoZW1haWwpKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdHZXREYXJrQ2hhdFByb2ZpbGUnLCBhc3luYyAoY2xpZW50LCBlbWFpbDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0dldERhcmtDaGF0Q2hhbm5lbHMnLCBhc3luYyAoY2xpZW50LCBlbWFpbDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IG1lbWJlcnM6IGVtYWlsIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1JlbW92ZUZyb21EYXJrQ2hhbm5lbCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgX2lkLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBfaWQgfSk7XG4gICAgaWYgKHJlcy5jcmVhdG9yID09PSBlbWFpbCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IF9pZCB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdDaGFubmVsIERlbGV0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IGRlbGV0ZWQgRGFya0NoYXQgY2hhbm5lbCAnJHtyZXMubmFtZX0nIChJRDogJHtfaWR9KS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXMubWVtYmVycyA9IHJlcy5tZW1iZXJzLmZpbHRlcigobWVtYmVyOiBzdHJpbmcpID0+IG1lbWJlciAhPT0gZW1haWwpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IF9pZCB9LCByZXMpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgICAgICB0aXRsZTogJ0xlZnQgQ2hhbm5lbCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gbGVmdCBEYXJrQ2hhdCBjaGFubmVsICcke3Jlcy5uYW1lfScgKElEOiAke19pZH0pLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdVcGRhdGVEYXJrQXZhdGFyJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBlbWFpbCwgYXZhdGFyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9KTtcbiAgICByZXMuYXZhdGFyID0gYXZhdGFyO1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsIH0sIHJlcyk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9hY2NvdW50cycsXG4gICAgICAgIHRpdGxlOiAnQXZhdGFyIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gdXBkYXRlZCB0aGVpciBEYXJrQ2hhdCBhdmF0YXIuYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1VwZGF0ZURhcmtQYXNzd29yZCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9KTtcbiAgICByZXMucGFzc3dvcmQgPSBwYXNzd29yZDtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9LCByZXMpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfYWNjb3VudHMnLFxuICAgICAgICB0aXRsZTogJ1Bhc3N3b3JkIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gdXBkYXRlZCB0aGVpciBEYXJrQ2hhdCBwYXNzd29yZC5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnU2V0RGFya0NoYXRNZXNzYWdlcycsIGFzeW5jIChjbGllbnQsIGRhdGFYOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGNoYW5uZWwsIGRhdGEgfSA9IEpTT04ucGFyc2UoZGF0YVgpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgX2lkOiBjaGFubmVsIH0sIGRhdGEpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgU2VudCcsXG4gICAgICAgIG1lc3NhZ2U6IGBNZXNzYWdlIHNlbnQgaW4gRGFya0NoYXQgY2hhbm5lbCAnJHtkYXRhLm5hbWV9JyAoSUQ6ICR7Y2hhbm5lbH0pLCBDb250ZW50OiAke2RhdGEuY29udGVudH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIGRhdGEubWVtYmVycy5mb3JFYWNoKGFzeW5jIChtZW1iZXI6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKGF3YWl0IFV0aWxzLkdldENpZEZyb21EYXJrRW1haWwobWVtYmVyKSk7XG4gICAgICAgIGlmICghcmVzKSByZXR1cm47XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVjZWl2ZURhcmtDaGF0TWVzc2FnZScsIHJlcywgSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuICAgICAgICBpZiAocmVzICE9PSBjbGllbnQpIHtcbiAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlcywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ0RhcmtDaGF0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGEgbmV3IG1lc3NhZ2UgaW4gJHtkYXRhLm5hbWV9LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBNYWlsQ2xhc3MgfSBmcm9tIFwiLi9jbGFzc1wiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6Z2V0RW1haWxNZXNzYWdlcycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBNYWlsQ2xhc3MuZ2V0TWFpbE1lc3NhZ2VzKGVtYWlsLCBwYXNzd29yZClcbiAgICByZXR1cm4gZGF0YTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VuZEVtYWlsJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBlbWFpbDogc3RyaW5nLCB0bzogc3RyaW5nLCBzdWJqZWN0OiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZywgaW1hZ2VzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5zZW5kTWFpbChlbWFpbCwgdG8sIHN1YmplY3QsIG1lc3NhZ2UsIGltYWdlcywgc291cmNlKTtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX21haWwnLFxuICAgICAgICB0aXRsZTogJ0VtYWlsIFNlbnQnLFxuICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7Y2l0aXplbklkfSBzZW50IGFuIGVtYWlsIGZyb20gJHtlbWFpbH0gdG8gJHt0b30gd2l0aCBzdWJqZWN0IFwiJHtzdWJqZWN0fVwiLCBjb250ZW50OiBcIiR7bWVzc2FnZX1cImAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gcmVzO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXRTZWxlY3RlZE1lc3NhZ2UnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5zZWxlY3RlTWVzc2FnZShkYXRhKTtcbiAgICByZXR1cm4gcmVzO1xufSlcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOmdldFByb2ZpbGVTZXR0aW5ncycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IHBhcnNlZERhdGE7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLmdldFByb2ZpbGVTZXR0aW5ncyhlbWFpbCwgcGFzc3dvcmQpO1xuICAgIHJldHVybiByZXM7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnVwZGF0ZVByb2ZpbGVTZXR0aW5ncycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQsIHVzZXJuYW1lLCBhdmF0YXIgfSA9IHBhcnNlZERhdGE7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnVwZGF0ZVByb2ZpbGVTZXR0aW5ncyhlbWFpbCwgcGFzc3dvcmQsIHVzZXJuYW1lLCBhdmF0YXIpO1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWFpbCcsXG4gICAgICAgIHRpdGxlOiAnUHJvZmlsZSBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBsYXllciAke2NpdGl6ZW5JZH0gdXBkYXRlZCBwcm9maWxlIGZvciBlbWFpbCAke2VtYWlsfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcztcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpzZW5kTWVzc2FnZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgdHlwZSwgcGhvbmVOdW1iZXIsIGdyb3VwSWQsIG1lc3NhZ2VEYXRhIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgbGV0IGZpcnN0TWVzc2FnZSA9IGZhbHNlO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IHNlbmRlcklkLFxuICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9O1xuICAgICAgICBmaXJzdE1lc3NhZ2UgPSB0cnVlO1xuICAgIH1cblxuICAgIGxldCBjb252ZXJzYXRpb247XG4gICAgaWYgKHR5cGUgPT09ICdwcml2YXRlJykge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyID09PSBwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIocGhvbmVOdW1iZXIsIHNlbmRlcklkKSB8fCBgVW5rbm93biAoJHtwaG9uZU51bWJlcn0pYDtcbiAgICAgICAgICAgIGNvbnN0IGF2YXRhciA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3RBdmF0YXJCeU51bWJlcihwaG9uZU51bWJlciwgc2VuZGVySWQpIHx8IG51bGw7IC8vIEFzc3VtZSB0aGlzIHV0aWxpdHkgZXhpc3RzXG4gICAgICAgICAgICBjb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3ByaXZhdGUnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGNvbnRhY3ROYW1lLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogYXZhdGFyLCAvLyBTZXQgYXZhdGFyIGZvciBwcml2YXRlIGNvbnRhY3RcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogcGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2goY29udmVyc2F0aW9uKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2dyb3VwJykge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgZ3JvdXBJZD86IHN0cmluZyB9KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQgZm9yIHNlbmRlcicgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBsYXN0TWVzc2FnZSA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlc1tjb252ZXJzYXRpb24ubWVzc2FnZXMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgbmV4dFBhZ2UgPSBsYXN0TWVzc2FnZSA/IGxhc3RNZXNzYWdlLnBhZ2UgKyAxIDogMTtcblxuICAgIGNvbnN0IG5ld01lc3NhZ2UgPSB7XG4gICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VEYXRhLm1lc3NhZ2UsXG4gICAgICAgIHJlYWQ6IHRydWUsXG4gICAgICAgIHBhZ2U6IG5leHRQYWdlLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgc2VuZGVySWQ6IHNlbmRlclBob25lTnVtYmVyLFxuICAgICAgICBhdHRhY2htZW50czogbWVzc2FnZURhdGEuYXR0YWNobWVudHMgfHwgW11cbiAgICB9O1xuXG4gICAgY29udmVyc2F0aW9uLm1lc3NhZ2VzLnB1c2gobmV3TWVzc2FnZSk7XG5cbiAgICBpZiAoIWZpcnN0TWVzc2FnZSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tZXNzYWdlcycsIHVzZXJNZXNzYWdlcyk7XG4gICAgfVxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWVzc2FnZXMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgU2VudCcsXG4gICAgICAgIG1lc3NhZ2U6IGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gc2VudCBhIG1lc3NhZ2UgdG8gJHt0eXBlID09PSAncHJpdmF0ZScgPyBwaG9uZU51bWJlciA6ICdncm91cCAnICsgZ3JvdXBJZH0gd2l0aCBjb250ZW50OiAke21lc3NhZ2VEYXRhLm1lc3NhZ2V9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIC8vIEhhbmRsZSByZWNpcGllbnRzXG4gICAgaWYgKHR5cGUgPT09ICdwcml2YXRlJykge1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKHRhcmdldENpdGl6ZW5JZCkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGNvbnN0IGlzQmxvY2tlZCA9IHRhcmdldE1lc3NhZ2VzPy5ibG9ja2VkTnVtYmVycz8uaW5jbHVkZXMoc2VuZGVyUGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgaWYgKCFpc0Jsb2NrZWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBzZW5kVG9SZWNpcGllbnQodGFyZ2V0Q2l0aXplbklkLCBzZW5kZXJQaG9uZU51bWJlciwgbWVzc2FnZURhdGEsICdwcml2YXRlJywgcGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZCh0YXJnZXRDaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIENWWENTLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiWW91IGhhdmUgYSBuZXcgbWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmVfbWVzc2FnZXM6Y2xpZW50OnVwZGF0ZU1lc3NhZ2VzJywgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KG5ld01lc3NhZ2UpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gaXMgYmxvY2tlZCBieSAke3Bob25lTnVtYmVyfS4gTWVzc2FnZSBzYXZlZCBvbmx5IGZvciBzZW5kZXIuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgUmVjaXBpZW50IHdpdGggcGhvbmUgbnVtYmVyICR7cGhvbmVOdW1iZXJ9IGRvZXMgbm90IGV4aXN0LiBNZXNzYWdlIHNhdmVkIG9ubHkgZm9yIHNlbmRlci5gKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2dyb3VwJykge1xuICAgICAgICBjb25zdCBncm91cENvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXBDb252ZXJzYXRpb24/Lm1lbWJlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbWVtYmVycyBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXBDb252ZXJzYXRpb24ubWVtYmVycykge1xuICAgICAgICAgICAgaWYgKG1lbWJlcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQobWVtYmVySWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQmxvY2tlZCA9IG1lbWJlck1lc3NhZ2VzPy5ibG9ja2VkTnVtYmVycz8uaW5jbHVkZXMoc2VuZGVyUGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIGlmICghaXNCbG9ja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHNlbmRUb1JlY2lwaWVudChtZW1iZXJJZCwgc2VuZGVyUGhvbmVOdW1iZXIsIG1lc3NhZ2VEYXRhLCAnZ3JvdXAnLCB1bmRlZmluZWQsIGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gaXMgYmxvY2tlZCBieSBncm91cCBtZW1iZXIgJHttZW1iZXJQaG9uZU51bWJlcn0uYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgICAgICAgICAgaWYgKENWWENTKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBhIG5ldyBtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZV9tZXNzYWdlczpjbGllbnQ6dXBkYXRlTWVzc2FnZXMnLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkoeyAuLi5uZXdNZXNzYWdlLCBncm91cElkIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xufSk7XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBzZW5kIG1lc3NhZ2VzIHRvIHJlY2lwaWVudHMgKHVuY2hhbmdlZClcbmFzeW5jIGZ1bmN0aW9uIHNlbmRUb1JlY2lwaWVudChcbiAgICB0YXJnZXRDaXRpemVuSWQ6IHN0cmluZyxcbiAgICBzZW5kZXJQaG9uZU51bWJlcjogc3RyaW5nLFxuICAgIG1lc3NhZ2VEYXRhOiBhbnksXG4gICAgdHlwZTogJ3ByaXZhdGUnIHwgJ2dyb3VwJyxcbiAgICBwaG9uZU51bWJlcj86IHN0cmluZyxcbiAgICBncm91cElkPzogc3RyaW5nXG4pIHtcbiAgICBsZXQgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICBsZXQgcmVjZWl2ZXJGaXJzdE1lc3NhZ2UgPSBmYWxzZTtcblxuICAgIGlmICghdGFyZ2V0TWVzc2FnZXMpIHtcbiAgICAgICAgdGFyZ2V0TWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH07XG4gICAgICAgIHJlY2VpdmVyRmlyc3RNZXNzYWdlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBsZXQgdGFyZ2V0Q29udmVyc2F0aW9uO1xuICAgIGlmICh0eXBlID09PSAncHJpdmF0ZScpIHtcbiAgICAgICAgdGFyZ2V0Q29udmVyc2F0aW9uID0gdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyID09PSBzZW5kZXJQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghdGFyZ2V0Q29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIsIHRhcmdldENpdGl6ZW5JZCk7XG4gICAgICAgICAgICBjb25zdCBhdmF0YXIgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0QXZhdGFyQnlOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIsIHRhcmdldENpdGl6ZW5JZCkgfHwgJyc7IC8vIEFzc3VtZSB0aGlzIHV0aWxpdHkgZXhpc3RzXG4gICAgICAgICAgICB0YXJnZXRDb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3ByaXZhdGUnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGNvbnRhY3ROYW1lIHx8IGBVbmtub3duICgke3NlbmRlclBob25lTnVtYmVyfSlgLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogYXZhdGFyLCAvLyBTZXQgYXZhdGFyIGZvciBwcml2YXRlIGNvbnRhY3RcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogc2VuZGVyUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMucHVzaCh0YXJnZXRDb252ZXJzYXRpb24pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnZ3JvdXAnKSB7XG4gICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyB0eXBlOiBzdHJpbmcsIGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKCF0YXJnZXRDb252ZXJzYXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHNlbmRlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHNlbmRlclBob25lTnVtYmVyKSB9KTtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gc2VuZGVyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgICAgIGlmICghZ3JvdXApIHJldHVybjtcbiAgICAgICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLm5hbWUsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiBncm91cC5hdmF0YXIgfHwgbnVsbCwgLy8gQ29weSBhdmF0YXIgZnJvbSBzZW5kZXIncyBncm91cFxuICAgICAgICAgICAgICAgIGdyb3VwSWQ6IGdyb3VwSWQsXG4gICAgICAgICAgICAgICAgbWVtYmVyczogZ3JvdXAubWVtYmVycyxcbiAgICAgICAgICAgICAgICBtZW1iZXJQaG9uZU51bWJlcnM6IGdyb3VwLm1lbWJlclBob25lTnVtYmVycyxcbiAgICAgICAgICAgICAgICBjcmVhdG9ySWQ6IGdyb3VwLmNyZWF0b3JJZCwgLy8gQ29weSBjcmVhdG9ySWRcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0YXJnZXRNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHRhcmdldENvbnZlcnNhdGlvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0YXJnZXRMYXN0TWVzc2FnZSA9IHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlc1t0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGFyZ2V0TmV4dFBhZ2UgPSB0YXJnZXRMYXN0TWVzc2FnZSA/IHRhcmdldExhc3RNZXNzYWdlLnBhZ2UgKyAxIDogMTtcblxuICAgIGNvbnN0IHRhcmdldE5ld01lc3NhZ2UgPSB7XG4gICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VEYXRhLm1lc3NhZ2UsXG4gICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICBwYWdlOiB0YXJnZXROZXh0UGFnZSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHNlbmRlcklkOiBzZW5kZXJQaG9uZU51bWJlcixcbiAgICAgICAgYXR0YWNobWVudHM6IG1lc3NhZ2VEYXRhLmF0dGFjaG1lbnRzIHx8IFtdXG4gICAgfTtcblxuICAgIHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcy5wdXNoKHRhcmdldE5ld01lc3NhZ2UpO1xuXG4gICAgaWYgKCFyZWNlaXZlckZpcnN0TWVzc2FnZSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdGFyZ2V0TWVzc2FnZXMuX2lkIH0sIHRhcmdldE1lc3NhZ2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCB0YXJnZXRNZXNzYWdlcyk7XG4gICAgfVxufVxuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmNyZWF0ZUdyb3VwJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBncm91cE5hbWUsIG1lbWJlclBob25lTnVtYmVycywgYXZhdGFyIH0gPSBKU09OLnBhcnNlKGRhdGEpOyAvLyBBZGRlZCBhdmF0YXIgZmllbGRcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG1lbWJlcklkcyA9IFtzZW5kZXJJZF07XG4gICAgY29uc3QgcGhvbmVOdW1iZXJzID0gW3NlbmRlclBob25lTnVtYmVyXTtcbiAgICBmb3IgKGNvbnN0IHBob25lIG9mIG1lbWJlclBob25lTnVtYmVycykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lKTtcbiAgICAgICAgaWYgKGNpdGl6ZW5JZCAmJiAhbWVtYmVySWRzLmluY2x1ZGVzKGNpdGl6ZW5JZCkpIHtcbiAgICAgICAgICAgIG1lbWJlcklkcy5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICBwaG9uZU51bWJlcnMucHVzaChwaG9uZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBncm91cElkID0gZ2VuZXJhdGVVVWlkKCk7XG4gICAgY29uc3QgZ3JvdXBDb252ZXJzYXRpb24gPSB7XG4gICAgICAgIHR5cGU6ICdncm91cCcsXG4gICAgICAgIG5hbWU6IGdyb3VwTmFtZSxcbiAgICAgICAgYXZhdGFyOiBhdmF0YXIgfHwgJycsXG4gICAgICAgIGdyb3VwSWQ6IGdyb3VwSWQsXG4gICAgICAgIG1lbWJlcnM6IG1lbWJlcklkcyxcbiAgICAgICAgbWVtYmVyUGhvbmVOdW1iZXJzOiBwaG9uZU51bWJlcnMsXG4gICAgICAgIGNyZWF0b3JJZDogc2VuZGVySWQsIC8vIFNldCB0aGUgY3JlYXRvciBhcyB0aGUgc2VuZGVyXG4gICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBjcmVhdGVkIG5ldyBHcm91cFwiLFxuICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICB1c2VyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiBzZW5kZXJJZCxcbiAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICBtZXNzYWdlczogW2dyb3VwQ29udmVyc2F0aW9uXVxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCB1c2VyTWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKGdyb3VwQ29udmVyc2F0aW9uKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIG1lbWJlcklkcykge1xuICAgICAgICBpZiAobWVtYmVySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgICAgICBsZXQgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICAgICAgY29uc3QgQ1ZYQ1MgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKG1lbWJlcklkKTtcbiAgICAgICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBiZWVuIGFkZGVkIHRvIGEgbmV3IGdyb3VwXCIsXG4gICAgICAgICAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IG1lbWJlcklkLFxuICAgICAgICAgICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbeyAuLi5ncm91cENvbnZlcnNhdGlvbiB9XVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHsgLi4uZ3JvdXBDb252ZXJzYXRpb24gfSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICB0aXRsZTogJ0dyb3VwIENyZWF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJyR7Z3JvdXBOYW1lfScgY3JlYXRlZCBieSAke3NlbmRlclBob25lTnVtYmVyfS4gR3JvdXAgSUQ6ICR7Z3JvdXBJZH0gd2l0aCBtZW1iZXJzOiAke21lbWJlclBob25lTnVtYmVycy5qb2luKCcsICcpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBncm91cElkIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6dG9nZ2xlQmxvY2snLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHBob25lTnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG5cbiAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogc2VuZGVySWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKCF1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMpIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzID0gW107XG4gICAgfVxuXG4gICAgY29uc3QgaXNCbG9ja2VkID0gdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLmluY2x1ZGVzKHBob25lTnVtYmVyKTtcbiAgICBpZiAoaXNCbG9ja2VkKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLmluZGV4T2YocGhvbmVOdW1iZXIpO1xuICAgICAgICB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMuc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgZW1pdE5ldChcInBob25lOmFkZE5vdGlmaWNhdGlvblwiLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIHVuYmxvY2tlZFwiLFxuICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYmxvY2tzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTnVtYmVyIFVuYmxvY2tlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gdW5ibG9ja2VkICR7cGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5wdXNoKHBob25lTnVtYmVyKTtcbiAgICAgICAgZW1pdE5ldChcInBob25lOmFkZE5vdGlmaWNhdGlvblwiLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIGJsb2NrZWRcIixcbiAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2Jsb2NrcycsXG4gICAgICAgICAgICB0aXRsZTogJ051bWJlciBCbG9ja2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NlbmRlclBob25lTnVtYmVyfSBibG9ja2VkICR7cGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh1c2VyTWVzc2FnZXMubWVzc2FnZXMubGVuZ3RoID09PSAwICYmIHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5sZW5ndGggPT09IDAgJiYgIXVzZXJNZXNzYWdlcy5kZWxldGVkTWVzc2FnZXM/Lmxlbmd0aCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTphZGRNZW1iZXInLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGdyb3VwSWQsIHBob25lTnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICAgICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFZhbGlkYXRlIHRoZSBuZXcgbWVtYmVyXG4gICAgICAgIGNvbnN0IG5ld01lbWJlcklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghbmV3TWVtYmVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCB0aGUgc2VuZGVyJ3MgbWVzc2FnZXMgdG8gZmluZCB0aGUgZ3JvdXBcbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBtZW1iZXJzPzogc3RyaW5nW10sIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXAgfHwgIWdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgbmV3IG1lbWJlciBpcyBhbHJlYWR5IGluIHRoZSBncm91cFxuICAgICAgICBpZiAoZ3JvdXAubWVtYmVycy5pbmNsdWRlcyhuZXdNZW1iZXJJZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIGFscmVhZHkgaW4gZ3JvdXAnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHRoZSBuZXcgbWVtYmVyIHRvIHRoZSBncm91cFxuICAgICAgICBncm91cC5tZW1iZXJzLnB1c2gobmV3TWVtYmVySWQpO1xuICAgICAgICBncm91cC5tZW1iZXJQaG9uZU51bWJlcnMucHVzaChwaG9uZU51bWJlcik7XG5cbiAgICAgICAgLy8gVXBkYXRlIGFsbCBleGlzdGluZyBtZW1iZXJzJyBncm91cCBkYXRhLCBpbmNsdWRpbmcgdGhlIHNlbmRlciBhbmQgbmV3IG1lbWJlclxuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgICAgIGxldCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG5cbiAgICAgICAgICAgIGlmICghbWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgbWVtYmVyIGlzIG5ldyAobm8gbWVzc2FnZXMgZG9jdW1lbnQpLCBjcmVhdGUgb25lXG4gICAgICAgICAgICAgICAgbWVtYmVyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogbWVtYmVySWQsXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbWVtYmVyR3JvdXAgPSBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICBpZiAobWVtYmVyR3JvdXApIHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgZXhpc3RpbmcgZ3JvdXAgZGF0YSBmb3IgdGhpcyBtZW1iZXJcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJzID0gZ3JvdXAubWVtYmVycztcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJQaG9uZU51bWJlcnMgPSBncm91cC5tZW1iZXJQaG9uZU51bWJlcnM7XG4gICAgICAgICAgICAgICAgbWVtYmVyR3JvdXAuYXZhdGFyID0gZ3JvdXAuYXZhdGFyOyAvLyBFbnN1cmUgYXZhdGFyIGlzIGNvcGllZFxuICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLmNyZWF0b3JJZCA9IGdyb3VwLmNyZWF0b3JJZDsgLy8gRW5zdXJlIGNyZWF0b3JJZCBpcyBjb3BpZWRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQWRkIHRoZSBncm91cCB0byB0aGlzIG1lbWJlcidzIG1lc3NhZ2VzIGlmIGl0IGRvZXNuXHUyMDE5dCBleGlzdFxuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2goeyAuLi5ncm91cCB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2F2ZSBvciB1cGRhdGUgdGhlIG1lbWJlcidzIG1lc3NhZ2VzXG4gICAgICAgICAgICBpZiAobWVtYmVyTWVzc2FnZXMuX2lkKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgZGF0YSBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCkpXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBncm91cCBkYXRhIGZvciBtZW1iZXIgJHttZW1iZXJJZH06YCwgZXJyb3IpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBDcmVhdGVkIG1lc3NhZ2VzIGZvciBuZXcgbWVtYmVyICR7bWVtYmVySWR9YCkpXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBtZXNzYWdlcyBmb3IgbmV3IG1lbWJlciAke21lbWJlcklkfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ01lbWJlciBBZGRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gYWRkZWQgJHtwaG9uZU51bWJlcn0gdG8gZ3JvdXAgJHtncm91cElkfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBhZGRpbmcgbWVtYmVyIHRvIGdyb3VwOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBhZGRpbmcgdGhlIG1lbWJlciB0byB0aGUgZ3JvdXAnIH0pO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnJlbW92ZU1lbWJlcicsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZ3JvdXBJZCwgcGhvbmVOdW1iZXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICBjb25zdCBtZW1iZXJJZFRvUmVtb3ZlID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgaWYgKCFtZW1iZXJJZFRvUmVtb3ZlKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICBpZiAoIWdyb3VwIHx8ICFncm91cC5tZW1iZXJzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgbWVtYmVySW5kZXggPSBncm91cC5tZW1iZXJzLmluZGV4T2YobWVtYmVySWRUb1JlbW92ZSk7XG4gICAgaWYgKG1lbWJlckluZGV4ID09PSAtMSkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lbWJlciBub3QgaW4gZ3JvdXAnIH0pO1xuICAgIH1cblxuICAgIGdyb3VwLm1lbWJlcnMuc3BsaWNlKG1lbWJlckluZGV4LCAxKTtcbiAgICBncm91cC5tZW1iZXJQaG9uZU51bWJlcnMuc3BsaWNlKG1lbWJlckluZGV4LCAxKTtcblxuICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycykge1xuICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKG1lbWJlckdyb3VwKSB7XG4gICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJzID0gZ3JvdXAubWVtYmVycztcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLm1lbWJlclBob25lTnVtYmVycyA9IGdyb3VwLm1lbWJlclBob25lTnVtYmVycztcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLmF2YXRhciA9IGdyb3VwLmF2YXRhcjsgLy8gRW5zdXJlIGF2YXRhciBpcyBjb3BpZWRcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLmNyZWF0b3JJZCA9IGdyb3VwLmNyZWF0b3JJZDsgLy8gRW5zdXJlIGNyZWF0b3JJZCBpcyBjb3BpZWRcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZFRvUmVtb3ZlIH0pO1xuICAgIGlmIChyZW1vdmVkTWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgY29uc3QgZ3JvdXBJbmRleCA9IHJlbW92ZWRNZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kSW5kZXgoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKGdyb3VwSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICByZW1vdmVkTWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuc3BsaWNlKGdyb3VwSW5kZXgsIDEpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHJlbW92ZWRNZW1iZXJNZXNzYWdlcy5faWQgfSwgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgIHRpdGxlOiAnTWVtYmVyIFJlbW92ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gcmVtb3ZlZCAke3Bob25lTnVtYmVyfSBmcm9tIGdyb3VwICR7Z3JvdXBJZH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmRlbGV0ZUdyb3VwJywgYXN5bmMgKGNsaWVudCwgZ3JvdXBJZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBjb25zdCBncm91cCA9IHVzZXJNZXNzYWdlcz8ubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgIGlmICghZ3JvdXAgfHwgIWdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQgb3IgdW5hdXRob3JpemVkJyB9KTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiB0aGUgc2VuZGVyIGlzIHRoZSBncm91cCBjcmVhdG9yIChhZG1pbilcbiAgICBpZiAoZ3JvdXAuY3JlYXRvcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ09ubHkgdGhlIGdyb3VwIGNyZWF0b3IgY2FuIGRlbGV0ZSB0aGUgZ3JvdXAnIH0pO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycykge1xuICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkdyb3VwIGhhcyBiZWVuIGRlbGV0ZWRcIixcbiAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBjb25zdCBncm91cEluZGV4ID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZEluZGV4KChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICBpZiAoZ3JvdXBJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5zcGxpY2UoZ3JvdXBJbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICB0aXRsZTogJ0dyb3VwIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJHtncm91cElkfSBkZWxldGVkIGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0R3JvdXBNZXNzYWdlcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZ3JvdXBJZCwgcGFnZSA9IDEsIGxpbWl0ID0gMjAgfSA9IEpTT04ucGFyc2UoZGF0YSk7IC8vIEFkZCBwYWdlIGFuZCBsaW1pdCBmb3IgcGFnaW5hdGlvblxuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnTm8gbWVzc2FnZXMgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBncm91cElkPzogc3RyaW5nIH0pID0+XG4gICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5ncm91cElkID09PSBncm91cElkKTtcblxuICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlczogW10sIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICAvLyBTb3J0IG1lc3NhZ2VzIGJ5IHRpbWVzdGFtcCAoZGVzY2VuZGluZykgYW5kIHBhZ2luYXRlXG4gICAgY29uc3Qgc29ydGVkTWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+XG4gICAgICAgIG5ldyBEYXRlKGIudGltZXN0YW1wKS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLnRpbWVzdGFtcCkuZ2V0VGltZSgpXG4gICAgKTtcblxuICAgIGNvbnN0IHN0YXJ0SW5kZXggPSAocGFnZSAtIDEpICogbGltaXQ7XG4gICAgY29uc3QgZW5kSW5kZXggPSBzdGFydEluZGV4ICsgbGltaXQ7XG4gICAgY29uc3QgcGFnaW5hdGVkTWVzc2FnZXMgPSBzb3J0ZWRNZXNzYWdlcy5zbGljZShzdGFydEluZGV4LCBlbmRJbmRleCk7XG5cbiAgICBjb25zdCBoYXNNb3JlID0gZW5kSW5kZXggPCBzb3J0ZWRNZXNzYWdlcy5sZW5ndGg7XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlczogcGFnaW5hdGVkTWVzc2FnZXMsXG4gICAgICAgIG1lbWJlclBob25lTnVtYmVyczogY29udmVyc2F0aW9uLm1lbWJlclBob25lTnVtYmVycyB8fCBbXSxcbiAgICAgICAgbmFtZTogY29udmVyc2F0aW9uLm5hbWUsXG4gICAgICAgIGF2YXRhcjogY29udmVyc2F0aW9uLmF2YXRhciB8fCBudWxsLFxuICAgICAgICBoYXNNb3JlOiBoYXNNb3JlLFxuICAgICAgICB0b3RhbE1lc3NhZ2VzOiBzb3J0ZWRNZXNzYWdlcy5sZW5ndGgsXG4gICAgICAgIGNyZWF0b3JJZDogY29udmVyc2F0aW9uLmNyZWF0b3JJZCAvLyBJbmNsdWRlIGNyZWF0b3JJZCBmb3IgVUkgb3IgdmVyaWZpY2F0aW9uIGlmIG5lZWRlZFxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0UHJpdmF0ZU1lc3NhZ2VzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBwaG9uZU51bWJlciwgcGFnZSA9IDEsIGxpbWl0ID0gMjAgfSA9IEpTT04ucGFyc2UoZGF0YSk7IC8vIEFkZCBwYWdlIGFuZCBsaW1pdCBmb3IgcGFnaW5hdGlvblxuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnTm8gbWVzc2FnZXMgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBwaG9uZU51bWJlcj86IHN0cmluZyB9KSA9PlxuICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIG1zZy5waG9uZU51bWJlciA9PT0gcGhvbmVOdW1iZXIpO1xuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ0NvbnZlcnNhdGlvbiBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIC8vIFNvcnQgbWVzc2FnZXMgYnkgdGltZXN0YW1wIChkZXNjZW5kaW5nKSBhbmQgcGFnaW5hdGVcbiAgICBjb25zdCBzb3J0ZWRNZXNzYWdlcyA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlcy5zb3J0KChhOiBhbnksIGI6IGFueSkgPT5cbiAgICAgICAgbmV3IERhdGUoYi50aW1lc3RhbXApLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEudGltZXN0YW1wKS5nZXRUaW1lKClcbiAgICApO1xuXG4gICAgY29uc3Qgc3RhcnRJbmRleCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcbiAgICBjb25zdCBlbmRJbmRleCA9IHN0YXJ0SW5kZXggKyBsaW1pdDtcbiAgICBjb25zdCBwYWdpbmF0ZWRNZXNzYWdlcyA9IHNvcnRlZE1lc3NhZ2VzLnNsaWNlKHN0YXJ0SW5kZXgsIGVuZEluZGV4KTtcbiAgICBjb25zdCBoYXNNb3JlID0gZW5kSW5kZXggPCBzb3J0ZWRNZXNzYWdlcy5sZW5ndGg7XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlczogcGFnaW5hdGVkTWVzc2FnZXMsXG4gICAgICAgIGF2YXRhcjogY29udmVyc2F0aW9uLmF2YXRhciB8fCBudWxsLFxuICAgICAgICBuYW1lOiBjb252ZXJzYXRpb24ubmFtZSxcbiAgICAgICAgaGFzTW9yZTogaGFzTW9yZSxcbiAgICAgICAgdG90YWxNZXNzYWdlczogc29ydGVkTWVzc2FnZXMubGVuZ3RoXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpnZXRNZXNzYWdlQ2hhbm5lbHNhbmRMYXN0TWVzc2FnZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG5cbiAgICAgICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ05vIG1lc3NhZ2VzIGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNoYW5uZWxzID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLm1hcChhc3luYyAobXNnOiB7IHR5cGU6IHN0cmluZywgbmFtZTogc3RyaW5nLCBwaG9uZU51bWJlcj86IHN0cmluZywgYXZhdGFyOiBzdHJpbmcsIGdyb3VwSWQ/OiBzdHJpbmcsIG1lbWJlcnM/OiBzdHJpbmdbXSwgbWVtYmVyUGhvbmVOdW1iZXJzPzogc3RyaW5nW10sIG1lc3NhZ2VzOiBhbnlbXSwgY3JlYXRvcklkPzogc3RyaW5nIH0pID0+IHtcbiAgICAgICAgICAgIGxldCB1cGRhdGVkTmFtZSA9IG1zZy5uYW1lO1xuICAgICAgICAgICAgbGV0IHVwZGF0ZWRNZW1iZXJQaG9uZU51bWJlcnMgPSBtc2cubWVtYmVyUGhvbmVOdW1iZXJzIHx8IFtdO1xuXG4gICAgICAgICAgICAvLyBIYW5kbGUgcHJpdmF0ZSBjb252ZXJzYXRpb25zXG4gICAgICAgICAgICBpZiAobXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtc2cucGhvbmVOdW1iZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXdDb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIobXNnLnBob25lTnVtYmVyLCBzZW5kZXJJZCkgfHwgYFVua25vd24gKCR7bXNnLnBob25lTnVtYmVyfSlgO1xuICAgICAgICAgICAgICAgIGlmIChuZXdDb250YWN0TmFtZSAhPT0gbXNnLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIHRoZSBuYW1lIGluIHRoZSBkYXRhYmFzZSBpZiBpdCBoYXMgY2hhbmdlZFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobTogYW55KSA9PiBtLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtLnBob25lTnVtYmVyID09PSBtc2cucGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb252ZXJzYXRpb24ubmFtZSA9IG5ld0NvbnRhY3ROYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGNvbnRhY3QgbmFtZSBmb3IgJHttc2cucGhvbmVOdW1iZXJ9IHRvICR7bmV3Q29udGFjdE5hbWV9YCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGNvbnRhY3QgbmFtZSBmb3IgJHttc2cucGhvbmVOdW1iZXJ9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlZE5hbWUgPSBuZXdDb250YWN0TmFtZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBIYW5kbGUgZ3JvdXAgY29udmVyc2F0aW9uc1xuICAgICAgICAgICAgZWxzZSBpZiAobXNnLnR5cGUgPT09ICdncm91cCcgJiYgbXNnLm1lbWJlclBob25lTnVtYmVycyAmJiBtc2cubWVtYmVyUGhvbmVOdW1iZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1zZy5tZW1iZXJQaG9uZU51bWJlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGhvbmUgPSBtc2cubWVtYmVyUGhvbmVOdW1iZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdDb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIocGhvbmUsIHNlbmRlcklkKSB8fCBgVW5rbm93biAoJHtwaG9uZX0pYDtcbiAgICAgICAgICAgICAgICAgICAgLy8gWW91IGNvdWxkIHVwZGF0ZSBpbmRpdmlkdWFsIG1lbWJlciBuYW1lcyBoZXJlIGlmIG5lZWRlZCwgYnV0IGZvciBncm91cCBuYW1lLCB3ZSBrZWVwIGl0IGFzLWlzIHVubGVzcyBzcGVjaWZpZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gT3B0aW9uYWxseSwgeW91IGNvdWxkIGFnZ3JlZ2F0ZSBtZW1iZXIgbmFtZXMgaW50byB0aGUgZ3JvdXAgbmFtZSBpZiBkZXNpcmVkXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHR5cGU6IG1zZy50eXBlLFxuICAgICAgICAgICAgICAgIG5hbWU6IHVwZGF0ZWROYW1lLFxuICAgICAgICAgICAgICAgIHBob25lTnVtYmVyOiBtc2cucGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgZ3JvdXBJZDogbXNnLmdyb3VwSWQsXG4gICAgICAgICAgICAgICAgbWVtYmVyczogbXNnLm1lbWJlcnMsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiBtc2cuYXZhdGFyLFxuICAgICAgICAgICAgICAgIG1lbWJlclBob25lTnVtYmVyczogdXBkYXRlZE1lbWJlclBob25lTnVtYmVycyxcbiAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogbXNnLm1lc3NhZ2VzW21zZy5tZXNzYWdlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICBjcmVhdG9ySWQ6IG1zZy5jcmVhdG9ySWQgLy8gSW5jbHVkZSBjcmVhdG9ySWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFdhaXQgZm9yIGFsbCBwcm9taXNlcyB0byByZXNvbHZlXG4gICAgICAgIGNvbnN0IHJlc29sdmVkQ2hhbm5lbHMgPSBhd2FpdCBQcm9taXNlLmFsbChjaGFubmVscyk7XG5cbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgY2hhbm5lbHM6IHJlc29sdmVkQ2hhbm5lbHMgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgbWVzc2FnZSBjaGFubmVscyBhbmQgbGFzdCBtZXNzYWdlczonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgbWVzc2FnZSBjaGFubmVscycgfSk7XG4gICAgfVxufSk7XG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmdldE1lc3NhZ2VTdGF0cycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgICAgICBhbGxNZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICBrbm93bk1lc3NhZ2VzOiAwLFxuICAgICAgICAgICAgICAgIHVua25vd25NZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICB1bnJlYWRNZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICByZWNlbnRseURlbGV0ZWQ6IDBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY3VycmVudERhdGUgPSBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IHRoaXJ0eURheXNBZ28gPSBuZXcgRGF0ZShjdXJyZW50RGF0ZS5nZXRUaW1lKCkgLSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDApOyAvLyAzMCBkYXlzIGFnb1xuXG4gICAgbGV0IGFsbE1lc3NhZ2VzID0gMDtcbiAgICBsZXQga25vd25NZXNzYWdlcyA9IDA7XG4gICAgbGV0IHVua25vd25NZXNzYWdlcyA9IDA7XG4gICAgbGV0IHVucmVhZE1lc3NhZ2VzID0gMDtcbiAgICBsZXQgcmVjZW50bHlEZWxldGVkID0gMDtcblxuICAgIGZvciAoY29uc3QgY29udmVyc2F0aW9uIG9mIHVzZXJNZXNzYWdlcy5tZXNzYWdlcykge1xuICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgY29udmVyc2F0aW9uLm1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBhbGxNZXNzYWdlcyArPSAxO1xuXG4gICAgICAgICAgICBjb25zdCBpc0tub3duID0gY29udmVyc2F0aW9uLm5hbWUgJiYgIWNvbnZlcnNhdGlvbi5uYW1lLm1hdGNoKC9eWzAtOSFAIyQlXiYqKClfK1xcLT1cXFtcXF17fTsnOlwiXFxcXHwsLjw+XFwvP10qJC8pO1xuICAgICAgICAgICAgaWYgKGlzS25vd24pIHtcbiAgICAgICAgICAgICAgICBrbm93bk1lc3NhZ2VzICs9IDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVua25vd25NZXNzYWdlcyArPSAxO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UucmVhZCkge1xuICAgICAgICAgICAgICAgIHVucmVhZE1lc3NhZ2VzICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodXNlck1lc3NhZ2VzLmRlbGV0ZWRNZXNzYWdlcykge1xuICAgICAgICByZWNlbnRseURlbGV0ZWQgPSB1c2VyTWVzc2FnZXMuZGVsZXRlZE1lc3NhZ2VzLmZpbHRlcigoZGVsZXRlZDogYW55KSA9PlxuICAgICAgICAgICAgZGVsZXRlZC50aW1lc3RhbXAgPiB0aGlydHlEYXlzQWdvXG4gICAgICAgICkubGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhbGxNZXNzYWdlcyxcbiAgICAgICAgICAgIGtub3duTWVzc2FnZXMsXG4gICAgICAgICAgICB1bmtub3duTWVzc2FnZXMsXG4gICAgICAgICAgICB1bnJlYWRNZXNzYWdlcyxcbiAgICAgICAgICAgIHJlY2VudGx5RGVsZXRlZFxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpkZWxldGVNZXNzYWdlJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBjb252ZXJzYXRpb25UeXBlLCBwaG9uZU51bWJlciwgZ3JvdXBJZCwgbWVzc2FnZUluZGV4IH0gPSBKU09OLnBhcnNlKGRhdGEgfHwgJ3t9Jyk7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVzc2FnZXMgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBsZXQgY29udmVyc2F0aW9uOiBhbnk7XG4gICAgaWYgKGNvbnZlcnNhdGlvblR5cGUgPT09ICdwcml2YXRlJyAmJiBwaG9uZU51bWJlcikge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiBhbnkpID0+XG4gICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIE51bWJlcihtc2cucGhvbmVOdW1iZXIpID09PSBOdW1iZXIocGhvbmVOdW1iZXIpXG4gICAgICAgICk7XG4gICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb25UeXBlID09PSAnZ3JvdXAnICYmIGdyb3VwSWQpIHtcbiAgICAgICAgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgU3RyaW5nKG1zZy5ncm91cElkKSA9PT0gU3RyaW5nKGdyb3VwSWQpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb252ZXJzYXRpb24ubWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuZmlsdGVyKChtc2c6IGFueSkgPT4gTnVtYmVyKG1zZy5wYWdlKSAhPT0gTnVtYmVyKG1lc3NhZ2VJbmRleCkpO1xuXG4gICAgLy8gUGVyc2lzdCBsb2NhbCBjaGFuZ2VcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuXG4gICAgLy8gQXR0ZW1wdCByZW1vdGUgZGVsZXRlIG9ubHkgZm9yIHByaXZhdGUgY29udmVyc2F0aW9ucyBhbmQgd2hlbiB0YXJnZXQgZXhpc3RzXG4gICAgaWYgKGNvbnZlcnNhdGlvblR5cGUgPT09ICdwcml2YXRlJyAmJiBwaG9uZU51bWJlcikge1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKHRhcmdldENpdGl6ZW5JZCkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U291cmNlID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZCh0YXJnZXRDaXRpemVuSWQpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldENvbnZlcnNhdGlvbiA9IHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIE51bWJlcihtc2cucGhvbmVOdW1iZXIpID09PSBOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Q29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcyA9IHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcy5maWx0ZXIoKG1zZzogYW55KSA9PiBOdW1iZXIobXNnLnBhZ2UpICE9PSBOdW1iZXIobWVzc2FnZUluZGV4KSk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB0YXJnZXRNZXNzYWdlcy5faWQgfSwgdGFyZ2V0TWVzc2FnZXMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXdhaXQgRG9lc1BsYXllckV4aXN0KHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lX21lc3NhZ2VzOmNsaWVudDp1cGRhdGVNZXNzYWdlcycsIE51bWJlcih0YXJnZXRTb3VyY2UpLCBKU09OLnN0cmluZ2lmeSh0YXJnZXRNZXNzYWdlcykpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZW1pdE5ldCgncGhvbmVfbWVzc2FnZXM6Y2xpZW50OnVwZGF0ZU1lc3NhZ2VzJywgTnVtYmVyKGNsaWVudCksIEpTT04uc3RyaW5naWZ5KHVzZXJNZXNzYWdlcykpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWVzc2FnZXMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBNZXNzYWdlIGRlbGV0ZWQgZnJvbSAke2NvbnZlcnNhdGlvblR5cGV9IGNvbnZlcnNhdGlvbiB3aXRoICR7cGhvbmVOdW1iZXIgfHwgZ3JvdXBJZH0gYnkgJHtzZW5kZXJQaG9uZU51bWJlcn1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnVwZGF0ZUdyb3VwTmFtZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgZ3JvdXBJZCwgbmV3TmFtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICAgICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVzc2FnZXMgbm90IGZvdW5kIGZvciBzZW5kZXInIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcsIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXApIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChncm91cC5jcmVhdG9ySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ09ubHkgdGhlIGdyb3VwIGNyZWF0b3IgY2FuIHVwZGF0ZSB0aGUgZ3JvdXAgbmFtZScgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgb2xkTmFtZSA9IGdyb3VwLm5hbWU7XG4gICAgICAgIGdyb3VwLm5hbWUgPSBuZXdOYW1lO1xuXG4gICAgICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycyB8fCBbXSkge1xuICAgICAgICAgICAgY29uc3QgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICAgICAgaWYgKG1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVtYmVyR3JvdXAgPSBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICAgICAgaWYgKG1lbWJlckdyb3VwKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLm5hbWUgPSBuZXdOYW1lO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogbWVtYmVyTWVzc2FnZXMuX2lkIH0sIG1lbWJlck1lc3NhZ2VzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgbmFtZSBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCkpXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgZ3JvdXAgbmFtZSBmb3IgbWVtYmVyICR7bWVtYmVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBHcm91cCBub3QgZm91bmQgaW4gbWVtYmVyICR7bWVtYmVySWR9J3MgbWVzc2FnZXNgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gbWVzc2FnZXMgZm91bmQgZm9yIG1lbWJlciAke21lbWJlcklkfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKVxuICAgICAgICAgICAgLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgbmFtZSBmb3Igc2VuZGVyICR7c2VuZGVySWR9YCkpXG4gICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgZ3JvdXAgbmFtZSBmb3Igc2VuZGVyICR7c2VuZGVySWR9OmAsIGVycm9yKSk7XG5cbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZ3JvdXBzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnR3JvdXAgTmFtZSBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBHcm91cCAke2dyb3VwSWR9IHwgJHtvbGROYW1lfSBuYW1lIHVwZGF0ZWQgdG8gJHtuZXdOYW1lfSBieSAke3NlbmRlclBob25lTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGRhdGluZyBncm91cCBuYW1lOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSB1cGRhdGluZyB0aGUgZ3JvdXAgbmFtZScgfSk7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6dXBkYXRlR3JvdXBBdmF0YXInLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGdyb3VwSWQsIG5ld0F2YXRhciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCB0aGUgc2VuZGVyJ3MgbWVzc2FnZXMgdG8gZmluZCB0aGUgZ3JvdXBcbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBjcmVhdG9ySWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWdyb3VwKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgc2VuZGVyIGlzIHRoZSBncm91cCBjcmVhdG9yIChhZG1pbilcbiAgICAgICAgaWYgKGdyb3VwLmNyZWF0b3JJZCAhPT0gc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnT25seSB0aGUgZ3JvdXAgY3JlYXRvciBjYW4gdXBkYXRlIHRoZSBncm91cCBhdmF0YXInIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBncm91cCBhdmF0YXIgZm9yIHRoZSBzZW5kZXJcbiAgICAgICAgZ3JvdXAuYXZhdGFyID0gbmV3QXZhdGFyO1xuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgZ3JvdXAgYXZhdGFyIGZvciBhbGwgbWVtYmVyc1xuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMgfHwgW10pIHtcbiAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgIGlmIChtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIGlmIChtZW1iZXJHcm91cCkge1xuICAgICAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5hdmF0YXIgPSBuZXdBdmF0YXI7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBhdmF0YXIgZm9yIG1lbWJlciAke21lbWJlcklkfWApKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIGF2YXRhciBmb3IgbWVtYmVyICR7bWVtYmVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBHcm91cCBub3QgZm91bmQgaW4gbWVtYmVyICR7bWVtYmVySWR9J3MgbWVzc2FnZXNgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gbWVzc2FnZXMgZm91bmQgZm9yIG1lbWJlciAke21lbWJlcklkfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBzZW5kZXIncyBtZXNzYWdlc1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpXG4gICAgICAgICAgICAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBhdmF0YXIgZm9yIHNlbmRlciAke3NlbmRlcklkfWApKVxuICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIGF2YXRhciBmb3Igc2VuZGVyICR7c2VuZGVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ0dyb3VwIEF2YXRhciBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBHcm91cCAke2dyb3VwSWR9IGF2YXRhciB1cGRhdGVkIGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIGdyb3VwIGF2YXRhcjonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdXBkYXRpbmcgdGhlIGdyb3VwIGF2YXRhcicgfSk7XG4gICAgfVxufSk7IiwgImltcG9ydCB7IE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGxheWVyQ2FsbEhpc3Rvcnkge1xuICBjYWxsSWQ6IG51bWJlcjtcbiAgcm9sZTogXCJjYWxsZXJcIiB8IFwiY2FsbGVlXCI7XG4gIG15UGhvbmVOdW1iZXI6IHN0cmluZztcbiAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBzdHJpbmc7XG4gIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIgfCBcIm1pc3NlZFwiIHwgXCJkZWNsaW5lZFwiIHwgXCJjb21wbGV0ZWRcIjtcbiAgY2FsbFRpbWU6IG51bWJlcjtcbiAgY2FsbFRpbWVzdGFtcDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgQ2FsbEhpc3RvcnlNYW5hZ2VyIHtcbiAgYXN5bmMgcmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShcbiAgICBjYWxsOiB7XG4gICAgICBjYWxsSWQ6IG51bWJlcjtcbiAgICAgIGhvc3Q6IHsgY2l0aXplbklkOiBzdHJpbmc7IHBob25lTnVtYmVyOiBzdHJpbmcgfTtcbiAgICAgIHBhcnRpY2lwYW50czogTWFwPG51bWJlciwgeyBjaXRpemVuSWQ6IHN0cmluZzsgcGhvbmVOdW1iZXI6IHN0cmluZzsgb25Ib2xkOiBib29sZWFuIH0+O1xuICAgICAgc3RhcnRUaW1lOiBEYXRlO1xuICAgIH0sXG4gICAgY2FsbGVyU3RhdHVzOiBcInVuYW5zd2VyZWRcIiB8IFwiZGVjbGluZWRcIiB8IFwiY29tcGxldGVkXCIsXG4gICAgY2FsbGVlU3RhdHVzOiBcIm1pc3NlZFwiIHwgXCJkZWNsaW5lZFwiIHwgXCJjb21wbGV0ZWRcIixcbiAgICBlbmRUaW1lOiBEYXRlLFxuICAgIHRhcmdldFBob25lTnVtYmVyPzogc3RyaW5nXG4gICkge1xuICAgIGNvbnN0IGNhbGxUaW1lID0gKGVuZFRpbWUuZ2V0VGltZSgpIC0gY2FsbC5zdGFydFRpbWUuZ2V0VGltZSgpKSAvIDEwMDA7XG4gICAgY29uc3QgdGltZXN0YW1wID0gZW5kVGltZS50b0lTT1N0cmluZygpO1xuXG4gICAgLy8gRmlsdGVyIG91dCB0aGUgaG9zdCBmcm9tIHBhcnRpY2lwYW50cyB0byB0cnkgdG8gZ2V0IHRoZSBjYWxsZWUuXG4gICAgY29uc3QgY2FsbGVlQXJyYXkgPSBBcnJheS5mcm9tKGNhbGwucGFydGljaXBhbnRzLnZhbHVlcygpKS5maWx0ZXIoXG4gICAgICAocGFydGljaXBhbnQpID0+IHBhcnRpY2lwYW50LnBob25lTnVtYmVyICE9PSBjYWxsLmhvc3QucGhvbmVOdW1iZXJcbiAgICApO1xuXG4gICAgbGV0IGNhbGxlZVBob25lOiBzdHJpbmc7XG4gICAgaWYgKGNhbGxlZUFycmF5Lmxlbmd0aCA8IDEpIHtcbiAgICAgIC8vIElmIHRoZSBjYWxsZWUgbmV2ZXIgam9pbmVkLCB1c2UgdGhlIHBhc3NlZCB0YXJnZXRQaG9uZU51bWJlci5cbiAgICAgIGlmICh0YXJnZXRQaG9uZU51bWJlcikge1xuICAgICAgICBjYWxsZWVQaG9uZSA9IHRhcmdldFBob25lTnVtYmVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIk5vIGNhbGxlZSBmb3VuZCBmb3IgdHdvLXBhcnR5IGNhbGwgYWZ0ZXIgZmlsdGVyaW5nIG91dCBob3N0XCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxlZVBob25lID0gY2FsbGVlQXJyYXlbMF0ucGhvbmVOdW1iZXI7XG4gICAgfVxuXG4gICAgY29uc3QgY2FsbGVyUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogY2FsbC5jYWxsSWQsXG4gICAgICByb2xlOiBcImNhbGxlclwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogY2FsbC5ob3N0LnBob25lTnVtYmVyLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBjYWxsZWVQaG9uZSxcbiAgICAgIHN0YXR1czogY2FsbGVyU3RhdHVzLFxuICAgICAgY2FsbFRpbWUsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcblxuICAgIGNvbnN0IGNhbGxlZVJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IGNhbGwuY2FsbElkLFxuICAgICAgcm9sZTogXCJjYWxsZWVcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IGNhbGxlZVBob25lLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBjYWxsLmhvc3QucGhvbmVOdW1iZXIsXG4gICAgICBzdGF0dXM6IGNhbGxlZVN0YXR1cyxcbiAgICAgIGNhbGxUaW1lLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVyUmVjb3JkKTtcbiAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlZVJlY29yZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcmVjb3JkIHR3by1wYXJ0eSBjYWxsIGhpc3Rvcnk6XCIsIGVycm9yKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRQbGF5ZXJDYWxsSGlzdG9yeShwaG9uZU51bWJlcjogc3RyaW5nLCBtYXhSZWNvcmRzOiBudW1iZXIpOiBQcm9taXNlPFBsYXllckNhbGxIaXN0b3J5W10+IHtcbiAgICBjb25zdCBxdWVyeSA9IHsgbXlQaG9uZU51bWJlcjogcGhvbmVOdW1iZXIgfTtcbiAgICBjb25zdCBvcHRpb25zID0geyBzb3J0OiB7IF9pZDogLTEgfSwgbGltaXQ6IG1heFJlY29yZHMgfTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwiY2FsbF9oaXN0b3J5XCIsIHF1ZXJ5LCAoKSA9PiB7IH0sIGZhbHNlLCBvcHRpb25zKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciByZXRyaWV2aW5nIGNhbGwgaGlzdG9yeSBmb3IgcGhvbmUgbnVtYmVyOlwiLCBwaG9uZU51bWJlciwgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgY2FsbEhpc3RvcnlNYW5hZ2VyID0gbmV3IENhbGxIaXN0b3J5TWFuYWdlcigpO1xuIiwgImltcG9ydCB7IGNhbGxIaXN0b3J5TWFuYWdlciB9IGZyb20gXCIuL2NhbGxIaXN0b3J5TWFuYWdlclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhbGxQYXJ0aWNpcGFudCB7XG4gICAgc291cmNlOiBudW1iZXI7XG4gICAgY2l0aXplbklkOiBzdHJpbmc7XG4gICAgcGhvbmVOdW1iZXI6IHN0cmluZztcbiAgICBvbkhvbGQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT25nb2luZ0NhbGwge1xuICAgIGNhbGxJZDogbnVtYmVyO1xuICAgIGhvc3Q6IENhbGxQYXJ0aWNpcGFudDtcbiAgICBwYXJ0aWNpcGFudHM6IE1hcDxudW1iZXIsIENhbGxQYXJ0aWNpcGFudD47XG4gICAgcGVuZGluZzogTWFwPG51bWJlciwgTm9kZUpTLlRpbWVvdXQ+O1xuICAgIHN0YXJ0VGltZTogRGF0ZTtcbn1cblxuY2xhc3MgQ2FsbE1hbmFnZXIge1xuICAgIHByaXZhdGUgY2FsbHMgPSBuZXcgTWFwPG51bWJlciwgT25nb2luZ0NhbGw+KCk7XG4gICAgcHJpdmF0ZSBwbGF5ZXJDYWxsTWFwID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcbiAgICBwcml2YXRlIHJpbmdUb25lTWFuZ2VyID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcblxuICAgIHB1YmxpYyBjcmVhdGVDYWxsKGhvc3Q6IENhbGxQYXJ0aWNpcGFudCk6IG51bWJlciB7XG4gICAgICAgIGNvbnN0IGNhbGxJZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApO1xuICAgICAgICBjb25zdCBuZXdDYWxsOiBPbmdvaW5nQ2FsbCA9IHtcbiAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgIGhvc3QsXG4gICAgICAgICAgICBwYXJ0aWNpcGFudHM6IG5ldyBNYXA8bnVtYmVyLCBDYWxsUGFydGljaXBhbnQ+KCksXG4gICAgICAgICAgICBwZW5kaW5nOiBuZXcgTWFwPG51bWJlciwgTm9kZUpTLlRpbWVvdXQ+KCksXG4gICAgICAgICAgICBzdGFydFRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIH07XG4gICAgICAgIG5ld0NhbGwucGFydGljaXBhbnRzLnNldChob3N0LnNvdXJjZSwgaG9zdCk7XG4gICAgICAgIHRoaXMuY2FsbHMuc2V0KGNhbGxJZCwgbmV3Q2FsbCk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5zZXQoaG9zdC5zb3VyY2UsIGNhbGxJZCk7XG4gICAgICAgIHJldHVybiBjYWxsSWQ7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRDYWxsSG9zdChjYWxsSWQ6IG51bWJlcik6IENhbGxQYXJ0aWNpcGFudCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgcmV0dXJuIGNhbGwuaG9zdDtcbiAgICB9XG4gICAgcHVibGljIGlzUGxheWVySW5DYWxsKHNvdXJjZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXllckNhbGxNYXAuaGFzKHNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRDYWxsQnlQbGF5ZXIoc291cmNlOiBudW1iZXIpOiBPbmdvaW5nQ2FsbCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGNhbGxJZCA9IHRoaXMucGxheWVyQ2FsbE1hcC5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKGNhbGxJZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcHVibGljIGdldENhbGxJZEJ5UGxheWVyKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXllckNhbGxNYXAuZ2V0KHNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBhZGRQZW5kaW5nSW52aXRhdGlvbihcbiAgICAgICAgY2FsbElkOiBudW1iZXIsXG4gICAgICAgIHRhcmdldFNvdXJjZTogbnVtYmVyLFxuICAgICAgICB0aW1lb3V0Q2FsbGJhY2s6ICgpID0+IHZvaWQsXG4gICAgICAgIHRpbWVvdXRNczogbnVtYmVyID0gMzAwMDBcbiAgICApIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuO1xuICAgICAgICBpZiAoY2FsbC5wZW5kaW5nLmhhcyh0YXJnZXRTb3VyY2UpIHx8IGNhbGwucGFydGljaXBhbnRzLmhhcyh0YXJnZXRTb3VyY2UpKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRpbWVvdXRDYWxsYmFjaygpO1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSk7XG4gICAgICAgIH0sIHRpbWVvdXRNcyk7XG4gICAgICAgIGNhbGwucGVuZGluZy5zZXQodGFyZ2V0U291cmNlLCB0aW1lb3V0KTtcbiAgICB9XG4gICAgcHVibGljIHJlbW92ZVBlbmRpbmdJbnZpdGF0aW9uKGNhbGxJZDogbnVtYmVyLCB0YXJnZXRTb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm47XG4gICAgICAgIGlmIChjYWxsLnBlbmRpbmcuaGFzKHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjYWxsLnBlbmRpbmcuZ2V0KHRhcmdldFNvdXJjZSkpO1xuICAgICAgICAgICAgY2FsbC5wZW5kaW5nLmRlbGV0ZSh0YXJnZXRTb3VyY2UpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHB1YmxpYyBhY2NlcHRJbnZpdGF0aW9uKGNhbGxJZDogbnVtYmVyLCBwYXJ0aWNpcGFudDogQ2FsbFBhcnRpY2lwYW50KTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKGNhbGwucGFydGljaXBhbnRzLmhhcyhwYXJ0aWNpcGFudC5zb3VyY2UpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNhbGwucGFydGljaXBhbnRzLnNldChwYXJ0aWNpcGFudC5zb3VyY2UsIHBhcnRpY2lwYW50KTtcbiAgICAgICAgdGhpcy5wbGF5ZXJDYWxsTWFwLnNldChwYXJ0aWNpcGFudC5zb3VyY2UsIGNhbGxJZCk7XG4gICAgICAgIGlmIChjYWxsLnBlbmRpbmcuaGFzKHBhcnRpY2lwYW50LnNvdXJjZSkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjYWxsLnBlbmRpbmcuZ2V0KHBhcnRpY2lwYW50LnNvdXJjZSkpO1xuICAgICAgICAgICAgY2FsbC5wZW5kaW5nLmRlbGV0ZShwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBwdWJsaWMgZGVjbGluZUludml0YXRpb24oY2FsbElkOiBudW1iZXIsIHRhcmdldFNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICAgIH1cbiAgICBwdWJsaWMgYXN5bmMgcmVtb3ZlUGFydGljaXBhbnQoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcblxuICAgICAgICAvLyBORVc6IEVuZCBhbmltYXRpb24gZm9yIHRoZSBsZWF2aW5nIHBhcnRpY2lwYW50XG4gICAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBzb3VyY2UpO1xuXG4gICAgICAgIGNhbGwucGFydGljaXBhbnRzLmRlbGV0ZShzb3VyY2UpO1xuICAgICAgICB0aGlzLnBsYXllckNhbGxNYXAuZGVsZXRlKHNvdXJjZSk7XG4gICAgICAgIGlmIChzb3VyY2UgPT09IGNhbGwuaG9zdC5zb3VyY2UgfHwgY2FsbC5wYXJ0aWNpcGFudHMuc2l6ZSA8PSAxKSB7XG4gICAgICAgICAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpKTtcbiAgICAgICAgICAgIHRoaXMuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHB1YmxpYyBlbmRDYWxsKGNhbGxJZDogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcblxuICAgICAgICAvLyBORVc6IEVuZCBhbmltYXRpb25zIGZvciBhbGwgcGFydGljaXBhbnRzXG4gICAgICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCB0aW1lb3V0IG9mIGNhbGwucGVuZGluZy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5kZWxldGUocGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNhbGxzLmRlbGV0ZShjYWxsSWQpO1xuICAgIH1cbiAgICBwdWJsaWMgcmVtb3ZlRnJvbUNhbGwoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgY2FsbC5wYXJ0aWNpcGFudHMuZGVsZXRlKHNvdXJjZSk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5kZWxldGUoc291cmNlKTtcbiAgICB9XG4gICAgcHVibGljIHNldEhvbGRTdGF0dXMoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyLCBob2xkOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgcGFydGljaXBhbnQgPSBjYWxsLnBhcnRpY2lwYW50cy5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKCFwYXJ0aWNpcGFudCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBwYXJ0aWNpcGFudC5vbkhvbGQgPSBob2xkO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcHVibGljIGdldFBhcnRpY2lwYW50cyhjYWxsSWQ6IG51bWJlcik6IENhbGxQYXJ0aWNpcGFudFtdIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuIFtdO1xuICAgICAgICByZXR1cm4gQXJyYXkuZnJvbShjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSk7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRBbGxDYWxscygpOiBJdGVyYWJsZUl0ZXJhdG9yPE9uZ29pbmdDYWxsPiB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhbGxzLnZhbHVlcygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBjcmVhdGVSaW5nVG9uZShzb3VyY2U6IGFueSwgcmluZ3RvbmVMaW5rOiBzdHJpbmcsIHZvbHVtZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHBlZCA9IEdldFBsYXllclBlZChzb3VyY2UpO1xuICAgICAgICBjb25zdCBwZWRJZCA9IE5ldHdvcmtHZXROZXR3b3JrSWRGcm9tRW50aXR5KHBlZCk7XG4gICAgICAgIGNvbnN0IHNvdW5kSWQgPSBhd2FpdCBleHBvcnRzWydpZ25pc19zb3VuZGhhbmRsZXInXS5TdGFydEF0dGFjaFNvdW5kKHJpbmd0b25lTGluaywgcGVkSWQsIDUsIEdldEdhbWVUaW1lcigpLCB0cnVlLCAwLjE1KTtcbiAgICAgICAgdGhpcy5yaW5nVG9uZU1hbmdlci5zZXQoc291cmNlLCBzb3VuZElkKTtcbiAgICB9XG4gICAgcHVibGljIGFzeW5jIHN0b3BSaW5nVG9uZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBzb3VuZElkID0gdGhpcy5yaW5nVG9uZU1hbmdlci5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKCFzb3VuZElkKSByZXR1cm47XG4gICAgICAgIGV4cG9ydHNbJ2lnbmlzX3NvdW5kaGFuZGxlciddLlN0b3BTb3VuZChzb3VuZElkKTtcbiAgICAgICAgdGhpcy5yaW5nVG9uZU1hbmdlci5kZWxldGUoc291cmNlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBjYWxsTWFuYWdlciA9IG5ldyBDYWxsTWFuYWdlcigpOyIsICJpbXBvcnQgeyBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbmNsYXNzIFNldHRpbmcge1xuICAgIHB1YmxpYyBfaWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyBiYWNrZ3JvdW5kID0gbmV3IE1hcDxzdHJpbmcsIHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9PigpO1xuICAgIHB1YmxpYyBsb2Nrc2NyZWVuID0gbmV3IE1hcDxzdHJpbmcsIHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9PigpO1xuICAgIHB1YmxpYyByaW5ndG9uZSA9IG5ldyBNYXA8c3RyaW5nLCB7IGN1cnJlbnQ6IHN0cmluZzsgcmluZ3RvbmVzOiB7IG5hbWU6IHN0cmluZywgdXJsOiBzdHJpbmcgfVtdIH0+KCk7XG4gICAgcHVibGljIHNob3dTdGFydHVwU2NyZWVuID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHNob3dOb3RpZmljYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIGlzTG9jayA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBsb2NrUGluID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgdXNlUGluID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHVzZUZhY2VJZCA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBmYWNlSWRJZGVudGlmaWVyID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgc21ydElkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgc21ydFBhc3N3b3JkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgaXNGbGlnaHRNb2RlID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHBob25lTnVtYmVyID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgZGFya01haWxJZEF0dGFjaGVkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgcGlnZW9uSWRBdHRhY2hlZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgLy8gTm8gYXV0b21hdGljIGNsZWFudXAgLSBvbmx5IHJlbW92ZSBvbiBwbGF5ZXIgZGlzY29ubmVjdFxuXG4gICAgcHVibGljIGFzeW5jIGxvYWQoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgaXNEQkNvbm5lY3RlZCA9IGV4cG9ydHNbJ21vbmdvREInXS5pc0RCQ29ubmVjdGVkKCk7XG4gICAgICAgICAgICB3aGlsZSAoaXNEQkNvbm5lY3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICAgICAgICAgICAgICBpc0RCQ29ubmVjdGVkID0gZXhwb3J0c1snbW9uZ29EQiddLmlzREJDb25uZWN0ZWQoKTtcbiAgICAgICAgICAgICAgICBpZiAoaXNEQkNvbm5lY3RlZCkge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoXCJbU2V0dGluZ3NdIE1vbmdvREIgY29ubmVjdGVkLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiW1NldHRpbmdzXSBXYWl0aW5nIGZvciBNb25nb0RCIGNvbm5lY3Rpb24uLi5cIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXM6IGFueSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX3NldHRpbmdzJywge30pO1xuICAgICAgICAgICAgZm9yIChjb25zdCBkYXRhIG9mIHJlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2lkLnNldChkYXRhLl9pZCwgZGF0YS5faWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuYmFja2dyb3VuZC5zZXQoZGF0YS5faWQsIGRhdGEuYmFja2dyb3VuZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5sb2Nrc2NyZWVuLnNldChkYXRhLl9pZCwgZGF0YS5sb2Nrc2NyZWVuKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJpbmd0b25lLnNldChkYXRhLl9pZCwgZGF0YS5yaW5ndG9uZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5zZXQoZGF0YS5faWQsIGRhdGEuc2hvd1N0YXJ0dXBTY3JlZW4pO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd05vdGlmaWNhdGlvbnMuc2V0KGRhdGEuX2lkLCBkYXRhLnNob3dOb3RpZmljYXRpb25zKTtcbiAgICAgICAgICAgICAgICB0aGlzLmlzTG9jay5zZXQoZGF0YS5faWQsIGRhdGEuaXNMb2NrKTtcbiAgICAgICAgICAgICAgICB0aGlzLmxvY2tQaW4uc2V0KGRhdGEuX2lkLCBkYXRhLmxvY2tQaW4pO1xuICAgICAgICAgICAgICAgIHRoaXMudXNlUGluLnNldChkYXRhLl9pZCwgZGF0YS51c2VQaW4pO1xuICAgICAgICAgICAgICAgIHRoaXMudXNlRmFjZUlkLnNldChkYXRhLl9pZCwgZGF0YS51c2VGYWNlSWQpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmFjZUlkSWRlbnRpZmllci5zZXQoZGF0YS5faWQsIGRhdGEuZmFjZUlkSWRlbnRpZmllcik7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuc2V0KGRhdGEuX2lkLCBkYXRhLmRhcmtNYWlsSWRBdHRhY2hlZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zbXJ0SWQuc2V0KGRhdGEuX2lkLCBkYXRhLnNtcnRJZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zbXJ0UGFzc3dvcmQuc2V0KGRhdGEuX2lkLCBkYXRhLnNtcnRQYXNzd29yZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5pc0ZsaWdodE1vZGUuc2V0KGRhdGEuX2lkLCBkYXRhLmlzRmxpZ2h0TW9kZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5waG9uZU51bWJlci5zZXQoZGF0YS5faWQsIGRhdGEucGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIHRoaXMucGlnZW9uSWRBdHRhY2hlZC5zZXQoZGF0YS5faWQsIGRhdGEucGlnZW9uSWRBdHRhY2hlZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gTG9hZGVkLmApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gRmFpbGVkIHRvIGxvYWQgc2V0dGluZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzYXZlKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdGhpcy5faWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IF9pZDoga2V5IH0sIHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBrZXksXG4gICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRoaXMuYmFja2dyb3VuZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgbG9ja3NjcmVlbjogdGhpcy5sb2Nrc2NyZWVuLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICByaW5ndG9uZTogdGhpcy5yaW5ndG9uZS5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0aGlzLnNob3dOb3RpZmljYXRpb25zLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBpc0xvY2s6IHRoaXMuaXNMb2NrLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBsb2NrUGluOiB0aGlzLmxvY2tQaW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHVzZVBpbjogdGhpcy51c2VQaW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHVzZUZhY2VJZDogdGhpcy51c2VGYWNlSWQuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IHRoaXMuZmFjZUlkSWRlbnRpZmllci5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc21ydElkOiB0aGlzLnNtcnRJZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc21ydFBhc3N3b3JkOiB0aGlzLnNtcnRQYXNzd29yZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgaXNGbGlnaHRNb2RlOiB0aGlzLmlzRmxpZ2h0TW9kZS5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHRoaXMucGhvbmVOdW1iZXIuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IHRoaXMucGlnZW9uSWRBdHRhY2hlZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBTYXZlZCBzdWNjZXNzZnVsbHkuYCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIEZhaWxlZCB0byBzYXZlIHNldHRpbmdzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgUmVnaXN0ZXJOZXdTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZywgbnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5faWQuc2V0KGNpdGl6ZW5JZCwgY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnNldChjaXRpemVuSWQsIHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0pO1xuICAgICAgICB0aGlzLmxvY2tzY3JlZW4uc2V0KGNpdGl6ZW5JZCwgeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSk7XG4gICAgICAgIHRoaXMucmluZ3RvbmUuc2V0KGNpdGl6ZW5JZCwgeyBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsIHJpbmd0b25lczogW3sgbmFtZTogJ2RlZmF1bHQnLCB1cmw6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyB9XSB9KTtcbiAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5zZXQoY2l0aXplbklkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5zZXQoY2l0aXplbklkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5pc0xvY2suc2V0KGNpdGl6ZW5JZCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMudXNlUGluLnNldChjaXRpemVuSWQsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5waG9uZU51bWJlci5zZXQoY2l0aXplbklkLCBudW1iZXIpO1xuICAgICAgICB0aGlzLnVzZUZhY2VJZC5zZXQoY2l0aXplbklkLCBmYWxzZSk7XG4gICAgICAgIHRoaXMuZmFjZUlkSWRlbnRpZmllci5zZXQoY2l0aXplbklkLCBjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMuc21ydElkLnNldChjaXRpemVuSWQsICcnKTtcbiAgICAgICAgdGhpcy5zbXJ0UGFzc3dvcmQuc2V0KGNpdGl6ZW5JZCwgJycpO1xuICAgICAgICB0aGlzLmlzRmxpZ2h0TW9kZS5zZXQoY2l0aXplbklkLCBmYWxzZSk7XG4gICAgICAgIHRoaXMucGlnZW9uSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIFNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9LCB7XG4gICAgICAgICAgICAgICAgX2lkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdGhpcy5iYWNrZ3JvdW5kLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGxvY2tzY3JlZW46IHRoaXMubG9ja3NjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICByaW5ndG9uZTogdGhpcy5yaW5ndG9uZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBpc0xvY2s6IHRoaXMuaXNMb2NrLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGxvY2tQaW46IHRoaXMubG9ja1Bpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICB1c2VQaW46IHRoaXMudXNlUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHVzZUZhY2VJZDogdGhpcy51c2VGYWNlSWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogdGhpcy5mYWNlSWRJZGVudGlmaWVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgc21ydElkOiB0aGlzLnNtcnRJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6IHRoaXMuc21ydFBhc3N3b3JkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogdGhpcy5pc0ZsaWdodE1vZGUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHRoaXMucGhvbmVOdW1iZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogdGhpcy5waWdlb25JZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgcGxheWVyIHNldHRpbmdzIGZvciAke2NpdGl6ZW5JZH0gc3VjY2Vzc2Z1bGx5LmApO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBGYWlsZWQgdG8gc2F2ZSBwbGF5ZXIgc2V0dGluZ3MgZm9yICR7Y2l0aXplbklkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIHBsYXllciBkYXRhIG9ubHkgd2hlbiBwbGF5ZXIgZGlzY29ubmVjdHNcbiAgICBwdWJsaWMgb25QbGF5ZXJEaXNjb25uZWN0KGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGxheWVyRGF0YShjaXRpemVuSWQpO1xuICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gQ2xlYW5lZCB1cCBkYXRhIGZvciBkaXNjb25uZWN0ZWQgcGxheWVyICR7Y2l0aXplbklkfWApO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBwbGF5ZXIgZGF0YSBmcm9tIGFsbCBtYXBzXG4gICAgcHJpdmF0ZSByZW1vdmVQbGF5ZXJEYXRhKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuX2lkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmJhY2tncm91bmQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMubG9ja3NjcmVlbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5yaW5ndG9uZS5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5pc0xvY2suZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy51c2VQaW4uZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMudXNlRmFjZUlkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmZhY2VJZElkZW50aWZpZXIuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuc21ydElkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnNtcnRQYXNzd29yZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5pc0ZsaWdodE1vZGUuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMucGhvbmVOdW1iZXIuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuZGFya01haWxJZEF0dGFjaGVkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnBpZ2VvbklkQXR0YWNoZWQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgfVxuXG4gICAgLy8gUHVibGljIG1ldGhvZCB0byBtYW51YWxseSBjbGVhbiB1cCBhIHNwZWNpZmljIHBsYXllciAoZm9yIGFkbWluIGNvbW1hbmRzKVxuICAgIHB1YmxpYyBjbGVhbnVwUGxheWVyKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGxheWVyRGF0YShjaXRpemVuSWQpO1xuICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gTWFudWFsbHkgY2xlYW5lZCB1cCBkYXRhIGZvciBwbGF5ZXIgJHtjaXRpemVuSWR9YCk7XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgU2V0dGluZ3MgPSBuZXcgU2V0dGluZygpOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBjYWxsTWFuYWdlciB9IGZyb20gXCIuL0NhbGxNYW5hZ2VyXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IE1vbmdvREIsIExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFBob25lQ29udGFjdHMgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IGNhbGxIaXN0b3J5TWFuYWdlciwgUGxheWVyQ2FsbEhpc3RvcnkgfSBmcm9tIFwiLi9jYWxsSGlzdG9yeU1hbmFnZXJcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4uL1NldHRpbmdzL2NsYXNzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmNhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBudW1iZXIsIF9pZCwgdm9sdW1lIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJGcm9tUGhvbmVOdW1iZXIobnVtYmVyKTtcbiAgY29uc3QgdGFyZ2V0RGF0YTogUGhvbmVDb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IGNvbnRhY3ROdW1iZXI6IG51bWJlciwgcGVyc29uYWxOdW1iZXI6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKSB9KTtcblxuICBjb25zdCBzb3VyY2VEYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHtcbiAgICBjb250YWN0TnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgcGVyc29uYWxOdW1iZXI6IG51bWJlclxuICB9KTtcblxuICBpZiAoIXRhcmdldFBsYXllcikge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICBjb25zdCBjYWxsZXJSZWNvcmQ6IFBsYXllckNhbGxIaXN0b3J5ID0ge1xuICAgICAgY2FsbElkOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKSxcbiAgICAgIHJvbGU6IFwiY2FsbGVyXCIsXG4gICAgICBteVBob25lTnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuXG4gICAgY29uc3QgY2FsbGVlUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCksXG4gICAgICByb2xlOiBcImNhbGxlZVwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgICBzdGF0dXM6IFwibWlzc2VkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlclJlY29yZCk7XG4gICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVlUmVjb3JkKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCB0YXJnZXRTb3VyY2UgPSB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2U7XG5cbiAgaWYgKGNhbGxNYW5hZ2VyLmlzUGxheWVySW5DYWxsKHNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IGFyZSBhbHJlYWR5IGluIGEgY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoY2FsbE1hbmFnZXIuaXNQbGF5ZXJJbkNhbGwodGFyZ2V0U291cmNlKSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEJ1c3lcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlRhcmdldCBpcyBhbHJlYWR5IGluIGEgY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBzb3VyY2VQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0UGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHNvdXJjZUNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW1wicWItY29yZVwiXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tcInFiLWNvcmVcIl0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgSXNOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHRhcmdldFBob25lLCBzb3VyY2VQaG9uZSk7XG4gIGNvbnN0IHNvdXJjZUZsaWdodE1vZGUgPSBhd2FpdCBVdGlscy5JbkZsaWdodE1vZGUoc291cmNlQ2l0aXplbklkKTtcbiAgY29uc3QgdGFyZ2V0RmxpZ2h0TW9kZSA9IGF3YWl0IFV0aWxzLkluRmxpZ2h0TW9kZSh0YXJnZXRDaXRpemVuSWQpO1xuICBpZiAoc291cmNlRmxpZ2h0TW9kZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJGbGlnaHQgTW9kZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IGNhbm5vdCBtYWtlIGNhbGxzIHdoaWxlIGluIGZsaWdodCBtb2RlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfSBlbHNlIGlmICh0YXJnZXRGbGlnaHRNb2RlKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIHVucmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoSXNOdW1iZXJCbG9ja2VkKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IFNob3VyY2VOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHNvdXJjZVBob25lLCB0YXJnZXRQaG9uZSk7XG4gIGlmIChTaG91cmNlTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJOdW1iZXIgQmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiVW5ibG9jayB0aGUgbnVtYmVyIHRvIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHRhcmdldEhhc1Bob25lID0gYXdhaXQgVXRpbHMuSGFzUGhvbmUodGFyZ2V0U291cmNlKTtcbiAgaWYgKCF0YXJnZXRIYXNQaG9uZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuXG4gICAgY29uc3QgdGltZXN0YW1wID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgIGNvbnN0IGNhbGxlclJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApLFxuICAgICAgcm9sZTogXCJjYWxsZXJcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiB0YXJnZXRQaG9uZSxcbiAgICAgIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuXG4gICAgY29uc3QgY2FsbGVlUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCksXG4gICAgICByb2xlOiBcImNhbGxlZVwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogdGFyZ2V0UGhvbmUsXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgICAgc3RhdHVzOiBcIm1pc3NlZFwiLFxuICAgICAgY2FsbFRpbWU6IDAsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZXJSZWNvcmQpO1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlZVJlY29yZCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IGhvc3RQYXJ0aWNpcGFudCA9IHtcbiAgICBzb3VyY2UsXG4gICAgY2l0aXplbklkOiBzb3VyY2VDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgY2FsbElkID0gY2FsbE1hbmFnZXIuY3JlYXRlQ2FsbChob3N0UGFydGljaXBhbnQpO1xuXG4gIGNhbGxNYW5hZ2VyLmNyZWF0ZVJpbmdUb25lKHRhcmdldFNvdXJjZSwgU3RyaW5nKFNldHRpbmdzLnJpbmd0b25lLmdldCh0YXJnZXRDaXRpemVuSWQpPy5jdXJyZW50KSwgdm9sdW1lKTtcbiAgY2FsbE1hbmFnZXIuYWRkUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UsICgpID0+IHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBUaW1lb3V0XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDYWxsIHdhcyBub3QgYW5zd2VyZWQgYnkgdGFyZ2V0XCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJNaXNzZWQgQ2FsbFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IG1pc3NlZCBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgICAgIGlmIChjYWxsKSB7XG4gICAgICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwidW5hbnN3ZXJlZFwiLCBcIm1pc3NlZFwiLCBuZXcgRGF0ZSgpLCB0YXJnZXRQaG9uZSk7XG4gICAgICB9XG4gICAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgICB9KSgpO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbCh0YXJnZXRTb3VyY2UsIDApO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgX2lkKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgc291cmNlKTtcbiAgfSwgMjAwMDApO1xuXG4gIGNvbnN0IHNvdXJjZU5hbWUgPSBzb3VyY2VEYXRhID8gYCR7c291cmNlRGF0YS5maXJzdE5hbWV9ICR7c291cmNlRGF0YS5sYXN0TmFtZX1gIDogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXROYW1lID0gdGFyZ2V0RGF0YSA/IGAke3RhcmdldERhdGEuZmlyc3ROYW1lfSAke3RhcmdldERhdGEubGFzdE5hbWV9YCA6IG51bWJlcjtcblxuICBlbWl0TmV0KFwicGhvbmU6YWRkQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGlkOiBfaWQsXG4gICAgdGl0bGU6IFwiSW5jb21pbmcgQ2FsbFwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHtzb3VyY2VOYW1lfSBpcyBjYWxsaW5nIHlvdWAsXG4gICAgYXBwOiBcInBob25lXCIsXG4gICAgaWNvbnM6IHtcbiAgICAgIFwiMFwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9yZWQuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6ZGVjbGluZUNhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgc291cmNlTmFtZSxcbiAgICAgICAgICB0YXJnZXROYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogX2lkLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBcIjFcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvZ3JlZW4uc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lOiB0YXJnZXROYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWU6IHNvdXJjZU5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9LFxuICB9KSk7XG5cbiAgY29uc29sZS5sb2coc291cmNlLCBcIkNhbGxpbmdcIiwgdGFyZ2V0U291cmNlLCB0YXJnZXROYW1lLCBfaWQpO1xuICBlbWl0TmV0KFwic3VtbWl0X3Bob25lOnNlcnZlcjphZGRDYWxsaW5naW50ZXJmYWNlXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgdGFyZ2V0TmFtZSxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgfSkpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgIHRpdGxlOiAnQ2FsbCBJbml0aWF0ZWQnLFxuICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBob25lfSBpbml0aWF0ZWQgYSBjYWxsIHRvICR7dGFyZ2V0UGhvbmV9IChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbiAgcmV0dXJuIHRydWU7XG59KTtcblxub25OZXQoXCJzdW1taXRfcGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsIGFzeW5jIChkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZSBhcyBudW1iZXI7XG4gIGNvbnN0IHsgY2FsbElkLCB0YXJnZXRTb3VyY2UsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zb2xlLmxvZyhzb3VyY2UsIFwiRGVjbGluaW5nIGNhbGxcIiwgY2FsbElkLCB0YXJnZXRTb3VyY2UsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkKTtcbiAgY2FsbE1hbmFnZXIuZGVjbGluZUludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmIChjYWxsKSB7XG4gICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJkZWNsaW5lZFwiLCBcImRlY2xpbmVkXCIsIG5ldyBEYXRlKCkpO1xuICB9XG4gIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIGlmICghdGFyZ2V0U291cmNlIHx8ICFjYWxsZXJTb3VyY2UpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBkYXRhYmFzZVRhYmxlSWQpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ0NhbGwgRGVjbGluZWQnLFxuICAgIG1lc3NhZ2U6IGAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKX0gZGVjbGluZWQgdGhlIGNhbGwgZnJvbSAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmVuZENhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKCFjYWxsIHx8IGNhbGwuY2FsbElkICE9PSBjYWxsSWQpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgY2FsbEhvc3QgPSBjYWxsTWFuYWdlci5nZXRDYWxsSG9zdChjYWxsSWQpO1xuICBpZiAoY2FsbEhvc3QgJiYgY2FsbEhvc3Quc291cmNlID09PSBzb3VyY2UgfHwgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkubGVuZ3RoIDw9IDEpIHtcbiAgICBmb3IgKGNvbnN0IHBhcnRpY2lwYW50IG9mIGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpKSB7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjY3BldGVkQ2FsbGluZ0ludGVyZmFjZVwiLCBwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHBhcnRpY2lwYW50LnNvdXJjZSwgMCk7XG4gICAgfVxuICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiY29tcGxldGVkXCIsIFwiY29tcGxldGVkXCIsIG5ldyBEYXRlKCkpO1xuICAgIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgICB0aXRsZTogJ0NhbGwgRW5kZWQnLFxuICAgICAgbWVzc2FnZTogYENhbGwgZW5kZWQgYnkgJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSl9IChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gIH0gZWxzZSBpZiAoY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkubGVuZ3RoID4gMikge1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWNjcGV0ZWRDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHNvdXJjZSwgMCk7XG4gICAgY2FsbE1hbmFnZXIucmVtb3ZlRnJvbUNhbGwoY2FsbElkLCBzb3VyY2UpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICAgIHRpdGxlOiAnUGFydGljaXBhbnQgTGVmdCBDYWxsJyxcbiAgICAgIG1lc3NhZ2U6IGAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKX0gbGVmdCB0aGUgY29uZmVyZW5jZSBjYWxsIChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY2NwZXRlZENhbGxpbmdJbnRlcmZhY2VcIiwgcGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChwYXJ0aWNpcGFudC5zb3VyY2UsIDApO1xuICAgIH1cbiAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpKTtcbiAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgICAgdGl0bGU6ICdDYWxsIEVuZGVkJyxcbiAgICAgIG1lc3NhZ2U6IGBDYWxsIGVuZGVkIGJ5ICR7YXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpfSAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICB9XG4gIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmFkZFBsYXllclRvQ2FsbFwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCB7IGNvbnRhY3ROdW1iZXIsIF9pZCwgdm9sdW1lIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCB0YXJnZXREYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkIH0pO1xuICBjb25zdCBzb3VyY2VEYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHtcbiAgICBjb250YWN0TnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgcGVyc29uYWxOdW1iZXI6IGNvbnRhY3ROdW1iZXJcbiAgfSk7XG4gIGNvbnN0IGNhbGxJZCA9IGNhbGxNYW5hZ2VyLmdldENhbGxJZEJ5UGxheWVyKHNvdXJjZSk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKCFjYWxsKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIk5vIG9uZ29pbmcgY2FsbCBmb3VuZFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3Qgc291cmNlUGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IFV0aWxzLkdldFBsYXllckZyb21QaG9uZU51bWJlcihjb250YWN0TnVtYmVyKTtcbiAgaWYgKCF0YXJnZXRQbGF5ZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGFkZCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB0YXJnZXRTb3VyY2UgPSB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2U7XG4gIGNvbnN0IElzTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChjb250YWN0TnVtYmVyLCBzb3VyY2VQaG9uZSk7XG4gIGNvbnN0IHNvdXJjZUNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW1wicWItY29yZVwiXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGNvbnRhY3ROdW1iZXIpO1xuICBjb25zdCBzb3VyY2VGbGlnaHRNb2RlID0gYXdhaXQgVXRpbHMuSW5GbGlnaHRNb2RlKHNvdXJjZUNpdGl6ZW5JZCk7XG4gIGNvbnN0IHRhcmdldEZsaWdodE1vZGUgPSBhd2FpdCBVdGlscy5JbkZsaWdodE1vZGUodGFyZ2V0Q2l0aXplbklkKTtcbiAgaWYgKHNvdXJjZUZsaWdodE1vZGUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiRmxpZ2h0IE1vZGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBjYW5ub3QgbWFrZSBjYWxscyB3aGlsZSBpbiBmbGlnaHQgbW9kZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSBpZiAodGFyZ2V0RmxpZ2h0TW9kZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyB1bnJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKElzTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBTaG91cmNlTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChzb3VyY2VQaG9uZSwgY29udGFjdE51bWJlcik7XG4gIGlmIChTaG91cmNlTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJOdW1iZXIgQmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiVW5ibG9jayB0aGUgbnVtYmVyIHRvIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHRhcmdldEhhc1Bob25lID0gYXdhaXQgVXRpbHMuSGFzUGhvbmUodGFyZ2V0U291cmNlKTtcbiAgaWYgKCF0YXJnZXRIYXNQaG9uZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoY2FsbC5wYXJ0aWNpcGFudHMuaGFzKHRhcmdldFNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQWxyZWFkeSBpbiBDYWxsXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQbGF5ZXIgaXMgYWxyZWFkeSBpbiB0aGUgY2FsbFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY2FsbE1hbmFnZXIuY3JlYXRlUmluZ1RvbmUodGFyZ2V0U291cmNlLCBTdHJpbmcoU2V0dGluZ3MucmluZ3RvbmUuZ2V0KHRhcmdldENpdGl6ZW5JZCk/LmN1cnJlbnQpLCB2b2x1bWUpO1xuICBjYWxsTWFuYWdlci5hZGRQZW5kaW5nSW52aXRhdGlvbihOdW1iZXIoY2FsbElkKSwgdGFyZ2V0U291cmNlLCAoKSA9PiB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgVGltZW91dFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGxheWVyIGRpZCBub3QgYW5zd2VyIGNvbmZlcmVuY2UgY2FsbCBpbnZpdGF0aW9uXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICB9LCAzMDAwMCk7XG5cbiAgY29uc3Qgc291cmNlTmFtZSA9IHNvdXJjZURhdGFcbiAgICA/IGAke3NvdXJjZURhdGEuZmlyc3ROYW1lfSAke3NvdXJjZURhdGEubGFzdE5hbWV9YFxuICAgIDogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXROYW1lID0gdGFyZ2V0RGF0YSA/IGAke3RhcmdldERhdGEuZmlyc3ROYW1lfSAke3RhcmdldERhdGEubGFzdE5hbWV9YCA6IGNvbnRhY3ROdW1iZXI7XG5cbiAgZW1pdE5ldChcInBob25lOmFkZEFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBpZDogX2lkLFxuICAgIHRpdGxlOiBcIkluY29taW5nIENvbmZlcmVuY2UgQ2FsbFwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHtzb3VyY2VOYW1lfSBpcyBhZGRpbmcgeW91IHRvIGEgY29uZmVyZW5jZSBjYWxsYCxcbiAgICBhcHA6IFwicGhvbmVcIixcbiAgICBpY29uczoge1xuICAgICAgXCIwXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3JlZC5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkOiBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHRhcmdldE5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIFwiMVwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9ncmVlbi5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphY2NlcHRDb25mZXJlbmNlQ2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkOiBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0sXG4gIH0pKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ1BsYXllciBBZGRlZCB0byBDYWxsJyxcbiAgICBtZXNzYWdlOiBgJHtzb3VyY2VQaG9uZX0gYWRkZWQgJHtjb250YWN0TnVtYmVyfSB0byBjb25mZXJlbmNlIGNhbGwgKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xuICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwicGhvbmU6c2VydmVyOmdldENhbGxIaXN0b3J5XCIsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgbWF4UmVjb3Jkc1g6IG51bWJlcikgPT4ge1xuICBsZXQgbWF4UmVjb3JkcyA9IDEwMDtcbiAgdHJ5IHtcbiAgICBpZiAobWF4UmVjb3Jkc1gpIHtcbiAgICAgIG1heFJlY29yZHMgPSBtYXhSZWNvcmRzWDtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yIHBhcnNpbmcgZ2V0Q2FsbEhpc3RvcnkgZGF0YVwiLCBlcnJvcik7XG4gIH1cblxuICBjb25zdCBwaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGhpc3RvcnkgPSBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIuZ2V0UGxheWVyQ2FsbEhpc3RvcnkocGhvbmVOdW1iZXIsIG1heFJlY29yZHMpO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShoaXN0b3J5KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmV0cmlldmluZyBjYWxsIGhpc3RvcnkgZm9yIHBob25lIG51bWJlcjpcIiwgcGhvbmVOdW1iZXIsIGVycm9yKTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoW10pO1xuICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6c2VydmVyOmdldERhdGFGcm9tREJ3aXRoTnVtYmVyJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgIG51bWJlcjogc3RyaW5nLFxuICAgIGNpdGl6ZW5JZDogc3RyaW5nLFxuICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGFyc2VkRGF0YS5udW1iZXIsIG93bmVySWQ6IHBhcnNlZERhdGEuY2l0aXplbklkIH0pO1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZTpzZXJ2ZXI6dG9nZ2xlQmxvY2tOdW1iZXInLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCBwYXJzZWREYXRhOiBQaG9uZUNvbnRhY3RzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgcGVyc29uYWxOdW1iZXIgPSBwYXJzZWREYXRhLnBlcnNvbmFsTnVtYmVyO1xuICBjb25zdCBjb250YWN0TnVtYmVyID0gcGFyc2VkRGF0YS5jb250YWN0TnVtYmVyO1xuICBsZXQgSXNOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHBlcnNvbmFsTnVtYmVyLCBjb250YWN0TnVtYmVyKTtcbiAgaWYgKCFJc051bWJlckJsb2NrZWQpIHtcbiAgICBhd2FpdCBVdGlscy5CbG9ja051bWJlcihwZXJzb25hbE51bWJlciwgY29udGFjdE51bWJlcik7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk51bWJlciBCbG9ja2VkXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJOdW1iZXIgaGFzIGJlZW4gYmxvY2tlZFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBVdGlscy5VbmJsb2NrTnVtYmVyKHBlcnNvbmFsTnVtYmVyLCBjb250YWN0TnVtYmVyKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTnVtYmVyIFVuYmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIGhhcyBiZWVuIHVuYmxvY2tlZFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwic3VtbWl0X3Bob25lOnNlcnZlcjpqYWlsQ2FsbFwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCB7IG51bWJlciwgdm9sdW1lIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJGcm9tUGhvbmVOdW1iZXIobnVtYmVyKTtcblxuICAvLyBGb3IgamFpbCBjYWxscywgd2UgZG9uJ3QgbmVlZCB0byBjaGVjayBpZiB0aGUgY2FsbGVyIGhhcyBhIHBob25lXG4gIC8vIFdlIGFsc28gZG9uJ3QgbmVlZCB0byBjaGVjayBmbGlnaHQgbW9kZSBzaW5jZSBpdCdzIGEgamFpbCBwaG9uZVxuXG4gIGlmICghdGFyZ2V0UGxheWVyKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgdGFyZ2V0U291cmNlID0gdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlO1xuXG4gIGlmIChjYWxsTWFuYWdlci5pc1BsYXllckluQ2FsbChzb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBhcmUgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGNhbGxNYW5hZ2VyLmlzUGxheWVySW5DYWxsKHRhcmdldFNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBCdXN5XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJUYXJnZXQgaXMgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3Qgc291cmNlUGhvbmUgPSBcIkpBSUxfUEhPTkVcIjsgLy8gU3BlY2lhbCBpZGVudGlmaWVyIGZvciBqYWlsIHBob25lIGNhbGxzXG4gIGNvbnN0IHRhcmdldFBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tcInFiLWNvcmVcIl0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbXCJxYi1jb3JlXCJdLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG5cbiAgLy8gRm9yIGphaWwgY2FsbHMsIHdlIGRvbid0IGNoZWNrIGJsb2NrZWQgbnVtYmVycyBvciBmbGlnaHQgbW9kZVxuICAvLyBUaGlzIGFsbG93cyBpbmNhcmNlcmF0ZWQgcGxheWVycyB0byBtYWtlIGNhbGxzIGV2ZW4gaWYgdGhleSdyZSBibG9ja2VkXG5cbiAgY29uc3QgdGFyZ2V0SGFzUGhvbmUgPSBhd2FpdCBVdGlscy5IYXNQaG9uZSh0YXJnZXRTb3VyY2UpO1xuICBpZiAoIXRhcmdldEhhc1Bob25lKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgaG9zdFBhcnRpY2lwYW50ID0ge1xuICAgIHNvdXJjZSxcbiAgICBjaXRpemVuSWQ6IHNvdXJjZUNpdGl6ZW5JZCxcbiAgICBwaG9uZU51bWJlcjogc291cmNlUGhvbmUsXG4gICAgb25Ib2xkOiBmYWxzZSxcbiAgfTtcblxuICBjb25zdCBjYWxsSWQgPSBjYWxsTWFuYWdlci5jcmVhdGVDYWxsKGhvc3RQYXJ0aWNpcGFudCk7XG5cbiAgY2FsbE1hbmFnZXIuY3JlYXRlUmluZ1RvbmUodGFyZ2V0U291cmNlLCBTdHJpbmcoU2V0dGluZ3MucmluZ3RvbmUuZ2V0KHRhcmdldENpdGl6ZW5JZCk/LmN1cnJlbnQpLCB2b2x1bWUpO1xuXG4gIC8vIEphaWwgY2FsbHMgaGF2ZSBhIHNob3J0ZXIgdGltZW91dCAoMTUgbWludXRlcyBpbnN0ZWFkIG9mIDIwKVxuICBjYWxsTWFuYWdlci5hZGRQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSwgKCkgPT4ge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIFRpbWVvdXRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNhbGwgd2FzIG5vdCBhbnN3ZXJlZCBieSB0YXJnZXRcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk1pc3NlZCBDYWxsXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgbWlzc2VkIGEgY2FsbCBmcm9tIEpBSUxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgKGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgICAgIGlmIChjYWxsKSB7XG4gICAgICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwidW5hbnN3ZXJlZFwiLCBcIm1pc3NlZFwiLCBuZXcgRGF0ZSgpLCB0YXJnZXRQaG9uZSk7XG4gICAgICB9XG4gICAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgICB9KSgpO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbCh0YXJnZXRTb3VyY2UsIDApO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgXCJqYWlsX2NhbGxcIik7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gIH0sIDE1MDAwKTsgLy8gMTUgbWludXRlcyBmb3IgamFpbCBjYWxsc1xuXG4gIGNvbnN0IHNvdXJjZU5hbWUgPSBcIkpBSUwgUEhPTkVcIjtcbiAgY29uc3QgdGFyZ2V0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIobnVtYmVyLCB0YXJnZXRDaXRpemVuSWQpO1xuXG4gIGVtaXROZXQoXCJwaG9uZTphZGRBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgaWQ6IFwiamFpbF9jYWxsXCIsXG4gICAgdGl0bGU6IFwiSW5jb21pbmcgQ2FsbCBmcm9tIEpBSUxcIixcbiAgICBkZXNjcmlwdGlvbjogYCR7c291cmNlTmFtZX0gaXMgY2FsbGluZyB5b3VgLFxuICAgIGFwcDogXCJwaG9uZVwiLFxuICAgIGljb25zOiB7XG4gICAgICBcIjBcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvcmVkLnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IFwiamFpbF9jYWxsXCIsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIFwiMVwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9ncmVlbi5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphY2NlcHRDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IFwiamFpbF9jYWxsXCIsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9LFxuICB9KSk7XG5cbiAgZW1pdE5ldChcInN1bW1pdF9waG9uZTpzZXJ2ZXI6YWRkQ2FsbGluZ2ludGVyZmFjZVwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHRhcmdldE5hbWUsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkOiBcImphaWxfY2FsbFwiLFxuICB9KSk7XG5cbiAgLy8gU3RhcnQgYSB0aW1lciB0byBhdXRvbWF0aWNhbGx5IGVuZCBqYWlsIGNhbGxzIGFmdGVyIDEwIG1pbnV0ZXNcbiAgLy8gVGhpcyBwcmV2ZW50cyBhYnVzZSBhbmQgc2ltdWxhdGVzIHJlYWwgamFpbCBwaG9uZSBsaW1pdGF0aW9uc1xuICBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKGNhbGwgJiYgY2FsbC5jYWxsSWQgPT09IGNhbGxJZCkge1xuICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJDYWxsIEVuZGVkXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkphaWwgcGhvbmUgY2FsbCB0aW1lIGxpbWl0IHJlYWNoZWRcIixcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICB9KSk7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIkNhbGwgRW5kZWRcIixcbiAgICAgICAgZGVzY3JpcHRpb246IFwiSmFpbCBwaG9uZSBjYWxsIHRpbWUgbGltaXQgcmVhY2hlZFwiLFxuICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgIH0pKTtcblxuICAgICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJjb21wbGV0ZWRcIiwgXCJjb21wbGV0ZWRcIiwgbmV3IERhdGUoKSwgdGFyZ2V0UGhvbmUpO1xuICAgICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHNvdXJjZSwgMCk7XG4gICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwodGFyZ2V0U291cmNlLCAwKTtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgXCJqYWlsX2NhbGxcIik7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgc291cmNlKTtcbiAgICB9XG4gIH0sIDYwMDAwMCk7IC8vIDEwIG1pbnV0ZXNcblxuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgIHRpdGxlOiAnSmFpbCBDYWxsIEluaXRpYXRlZCcsXG4gICAgbWVzc2FnZTogYEphaWwgY2FsbCBpbml0aWF0ZWQgZnJvbSAke3NvdXJjZX0gdG8gJHt0YXJnZXRTb3VyY2V9ICgke3RhcmdldFBob25lfSlgLFxuICAgIHNob3dJZGVudGlmaWVyczogdHJ1ZSxcbiAgfSk7XG5cbiAgcmV0dXJuIHRydWU7XG59KTsiLCAiaW1wb3J0IHsgY2FsbE1hbmFnZXIgfSBmcm9tIFwiLi9DYWxsTWFuYWdlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgY2FsbEhpc3RvcnlNYW5hZ2VyIH0gZnJvbSBcIi4vY2FsbEhpc3RvcnlNYW5hZ2VyXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5cbm9uTmV0KFwicGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsIGFzeW5jIChub3RpSWQ6IHN0cmluZywgYXJnczogYW55KSA9PiB7XG4gIGNvbnN0IHsgY2FsbElkLCB0YXJnZXRTb3VyY2UsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkIH0gPSBKU09OLnBhcnNlKGFyZ3MpO1xuICBjYWxsTWFuYWdlci5kZWNsaW5lSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoY2FsbGVyU291cmNlKTtcbiAgaWYgKGNhbGwpIHtcbiAgICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImRlY2xpbmVkXCIsIFwiZGVjbGluZWRcIiwgbmV3IERhdGUoKSwgdGFyZ2V0UGhvbmUpO1xuICB9XG4gIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIFxuICAvLyBORVc6IEVuZCBhbmltYXRpb25zIGZvciBib3RoIHBhcnRpZXNcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDplbmRDYWxsQW5pbWF0aW9uXCIsIHRhcmdldFNvdXJjZSk7XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBjYWxsZXJTb3VyY2UpO1xuICBcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBkYXRhYmFzZVRhYmxlSWQpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogXCJwaG9uZVwiLFxuICAgIHRpdGxlOiBcIkNhbGwgRGVjbGluZWRcIixcbiAgICBtZXNzYWdlOiBgJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNhbGxlclNvdXJjZSl9IGhhcyBkZWNsaW5lZCB0aGUgY2FsbCBmcm9tICR7VXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpfWAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZSxcbiAgfSk7XG59KTtcblxub25OZXQoXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q2FsbFwiLCBhc3luYyAobm90aUlkOiBzdHJpbmcsIGFyZ3M6IGFueSkgPT4ge1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCB0YXJnZXROYW1lLCBzb3VyY2VOYW1lLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShhcmdzKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihjYWxsZXJTb3VyY2UpO1xuICBpZiAoIWNhbGwgfHwgY2FsbC5jYWxsSWQgIT09IGNhbGxJZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDYWxsIG5vIGxvbmdlciBleGlzdHNcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW1wicWItY29yZVwiXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgcGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlOiB0YXJnZXRTb3VyY2UsXG4gICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG4gIGlmICghY2FsbE1hbmFnZXIuYWNjZXB0SW52aXRhdGlvbihjYWxsSWQsIHBhcnRpY2lwYW50KSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb3VsZCBub3Qgam9pbiBjYWxsXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybjtcbiAgfVxuICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgY2FsbElkKTtcbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKGNhbGxlclNvdXJjZSwgY2FsbElkKTtcbiAgXG4gIC8vIE5FVzogU3RhcnQgYW5pbWF0aW9uIGZvciBib3RoIHBhcnRpZXMgd2hlbiBjYWxsIGlzIGFjY2VwdGVkXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6YWNjZXB0Q2FsbFwiLCB0YXJnZXRTb3VyY2UsIGFyZ3MpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnN0YXJ0Q2FsbEFuaW1hdGlvblwiLCBjYWxsZXJTb3VyY2UpOyAvLyBORVc6IEFuaW1hdGlvbiBmb3IgY2FsbGVyXG4gIFxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnVwZGF0ZUNhbGxlckludGVyZmFjZVwiLCBjYWxsZXJTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQsXG4gIH0pKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBub3RpSWQpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiBcInBob25lXCIsXG4gICAgdGl0bGU6IFwiQ2FsbCBBY2NlcHRlZFwiLFxuICAgIG1lc3NhZ2U6IGAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gaGFzIGFjY2VwdGVkIHRoZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjphY2NlcHRDb25mZXJlbmNlQ2FsbFwiLCBhc3luYyAobm90aUlkOiBzdHJpbmcsIGFyZ3M6IGFueSkgPT4ge1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCB0YXJnZXROYW1lLCBzb3VyY2VOYW1lLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShhcmdzKTtcblxuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmICghY2FsbCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb25mZXJlbmNlIGNhbGwgbm8gbG9uZ2VyIGV4aXN0c1wiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW1wicWItY29yZVwiXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgcGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlOiB0YXJnZXRTb3VyY2UsXG4gICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG4gIGlmICghY2FsbE1hbmFnZXIuYWNjZXB0SW52aXRhdGlvbihjYWxsLmNhbGxJZCwgcGFydGljaXBhbnQpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvdWxkIG5vdCBqb2luIGNvbmZlcmVuY2UgY2FsbFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgY2FsbC5jYWxsSWQpO1xuXG4gIGZvciAoY29uc3QgcCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpKSB7XG4gICAgaWYgKHAuc291cmNlICE9PSB0YXJnZXRTb3VyY2UpIHtcbiAgICAgIGNvbnN0IGNhbGxzcyA9IGNhbGwuY2FsbElkO1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxzcyxcbiAgICAgICAgcGFydGljaXBhbnRzOiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpLFxuICAgICAgfSkpO1xuICAgICAgZW1pdE5ldCgncGhvbmU6Y2xpZW50OnVwRGF0ZUludGVyRmFjZU5hbWUnLCBwLnNvdXJjZSk7XG4gICAgfVxuICB9XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgbm90aUlkKTtcbiAgXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6dXBkYXRlQ2FsbGVySW50ZXJmYWNlXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgc291cmNlTmFtZTogc291cmNlTmFtZSxcbiAgICB0YXJnZXROYW1lOiAnQ29uZmVyZW5jZSBDYWxsJyxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQsXG4gIH0pKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDYWxsZXJJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY2FsbElkLFxuICAgIHRhcmdldFNvdXJjZSxcbiAgICBzb3VyY2VOYW1lOiBzb3VyY2VOYW1lLFxuICAgIHRhcmdldE5hbWU6IFwiQ29uZmVyZW5jZSBDYWxsXCIsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkLFxuICB9KSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6IFwicGhvbmVcIixcbiAgICB0aXRsZTogXCJDb25mZXJlbmNlIENhbGwgQWNjZXB0ZWRcIixcbiAgICBtZXNzYWdlOiBgJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNhbGxlclNvdXJjZSl9IGhhcyBhY2NlcHRlZCB0aGUgY29uZmVyZW5jZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjplbmRDYWxsXCIsIGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQsIHNvdXJjZSB9ID0gSlNPTi5wYXJzZShhcmdzKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICBpZiAoY2FsbCAmJiBjYWxsLmNhbGxJZCA9PT0gY2FsbElkKSB7XG4gICAgYXdhaXQgY2FsbE1hbmFnZXIucmVtb3ZlUGFydGljaXBhbnQoY2FsbElkLCBzb3VyY2UpO1xuICAgIGZvciAoY29uc3QgcCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxJZDogY2FsbElkLFxuICAgICAgICBwYXJ0aWNpcGFudHM6IGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpLFxuICAgICAgfSkpO1xuICAgIH1cbiAgfVxufSk7XG5cbm9uKFwib25SZXNvdXJjZVN0b3BcIiwgYXN5bmMgKHJlc291cmNlOiBzdHJpbmcpID0+IHtcbiAgaWYgKHJlc291cmNlID09PSBHZXRDdXJyZW50UmVzb3VyY2VOYW1lKCkpIHtcbiAgICBmb3IgKGNvbnN0IGNhbGwgb2YgY2FsbE1hbmFnZXIuZ2V0QWxsQ2FsbHMoKSkge1xuICAgICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSkge1xuICAgICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwocGFydGljaXBhbnQuc291cmNlLCAwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG5vbk5ldChcInBsYXllckRyb3BwZWRcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKGNhbGwpIHtcbiAgICBhd2FpdCBjYWxsTWFuYWdlci5yZW1vdmVQYXJ0aWNpcGFudChjYWxsLmNhbGxJZCwgc291cmNlKTtcbiAgICBmb3IgKGNvbnN0IHAgb2YgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxJZDogY2FsbC5jYWxsSWQsXG4gICAgICAgIHBhcnRpY2lwYW50czogY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSxcbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cbn0pO1xuIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzYXZlUGhvdG9Ub1Bob3RvcycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCBkYXRhWCA9IHtcbiAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgIGNpdGl6ZW5JZCxcbiAgICBsaW5rOiBkYXRhLFxuICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKCdUJywgJyAnKS5yZXBsYWNlKCdaJywgJycpXG4gIH07XG4gIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9waG90b3MnLCBkYXRhWCk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9waG90b3MnLFxuICAgIHRpdGxlOiAnUGhvdG8gU2F2ZWQnLFxuICAgIG1lc3NhZ2U6IGBQaG90byBzYXZlZCBieSAke2F3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgJHtjaXRpemVuSWR9LCBMaW5rOiAke2RhdGF9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YVgpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldFBob3RvcycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgcGhvdG9zID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfcGhvdG9zJywgeyBjaXRpemVuSWQgfSk7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShwaG90b3MpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2RlbGV0ZVBob3RvJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfcGhvdG9zJywgeyBfaWQ6IGRhdGEgfSk7XG4gIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9waG90b3MnLCB7IF9pZDogZGF0YSwgY2l0aXplbklkIH0pO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfcGhvdG9zJyxcbiAgICB0aXRsZTogJ1Bob3RvIERlbGV0ZWQnLFxuICAgIG1lc3NhZ2U6IGBQaG90byBkZWxldGVkIGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCAke2NpdGl6ZW5JZH0sIExpbms6ICR7cmVzLmxpbmt9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xuICByZXR1cm4gdHJ1ZTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrLCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IE1vbmdvREIsIExvZ2dlciwgRnJhbWV3b3JrIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdSZWdpc3Rlck5ld0J1c2luZXNzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgYnVzaW5lc3NQYXNzd29yZCxcbiAgICAgICAgam9iXG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZSB9KTtcbiAgICBpZiAoYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBSZWdpc3RyYXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIHJlZ2lzdGVyIGJ1c2luZXNzIHdpdGggZXhpc3RpbmcgbmFtZSAnJHtidXNpbmVzc05hbWV9JyBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYEJ1c2luZXNzIHdpdGggbmFtZSAke2J1c2luZXNzTmFtZX0gYWxyZWFkeSBleGlzdHMuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGlmIChnZW5lcmF0ZUJ1c2luZXNzRW1haWwpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21haWwnLCB7XG4gICAgICAgICAgICBfaWQ6IGJ1c2luZXNzRW1haWwsXG4gICAgICAgICAgICBhY3RpdmVNYWlkSWQ6IGJ1c2luZXNzRW1haWwsXG4gICAgICAgICAgICB1c2VybmFtZTogYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgICAgIGFjdGl2ZU1haWxQYXNzd29yZDogYnVzaW5lc3NQYXNzd29yZCxcbiAgICAgICAgICAgIGF2YXRhcjogYnVzaW5lc3NMb2dvLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2J1c2luZXNzJywge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iXG4gICAgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgUmVnaXN0ZXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBOZXcgYnVzaW5lc3MgJyR7YnVzaW5lc3NOYW1lfScgcmVnaXN0ZXJlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0QnVzaW5lc3NEYXRhJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGJ1c2luZXNzKTtcbn0pO1xub25DbGllbnRDYWxsYmFjaygnZ2V0QWxsQnVzaW5lc3NEYXRhJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3NlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2J1c2luZXNzJywge30pO1xuICAgIGxldCBvbmxpbmVCdXNzID0gW11cbiAgICBsZXQgb2ZmbGluZUJ1c3MgPSBbXVxuICAgIGZvciAoY29uc3QgYnVzaW5lc3Mgb2YgYnVzaW5lc3Nlcykge1xuICAgICAgICBjb25zdCBqb2JDb3VudCA9IEdsb2JhbFN0YXRlW2Ake2J1c2luZXNzLmpvYn06Y291bnRgXVxuICAgICAgICBpZiAoam9iQ291bnQpIHtcbiAgICAgICAgICAgIG9ubGluZUJ1c3MucHVzaChidXNpbmVzcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvZmZsaW5lQnVzcy5wdXNoKGJ1c2luZXNzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBvbmxpbmU6IG9ubGluZUJ1c3MsIG9mZmxpbmU6IG9mZmxpbmVCdXNzIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldEJ1c2luZXNzTmFtZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3NlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2J1c2luZXNzJywge30pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShidXNpbmVzc2VzLm1hcCgoYnVzaW5lc3M6IGFueSkgPT4gYnVzaW5lc3MuYnVzaW5lc3NOYW1lKSk7XG59KVxuXG5vbkNsaWVudENhbGxiYWNrKCdVcGRhdGVCdXNpbmVzcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgICAgc2VsZWN0ZWRCdXNpbmVzcyxcbiAgICAgICAgb3duZXJDaXRpemVuSWQsXG4gICAgICAgIGJ1c2luZXNzTmFtZSxcbiAgICAgICAgYnVzaW5lc3NEZXNjcmlwdGlvbixcbiAgICAgICAgYnVzaW5lc3NUeXBlLFxuICAgICAgICBidXNpbmVzc0xvZ28sXG4gICAgICAgIGJ1c2luZXNzUGhvbmVOdW1iZXIsXG4gICAgICAgIGJ1c2luZXNzQWRkcmVzcyxcbiAgICAgICAgZ2VuZXJhdGVCdXNpbmVzc0VtYWlsLFxuICAgICAgICBjb29yZHMsXG4gICAgICAgIGpvYixcbiAgICAgICAgYnVzaW5lc3NFbWFpbFxuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGJ1c2luZXNzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBzZWxlY3RlZEJ1c2luZXNzIH0pO1xuICAgIGlmICghYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBVcGRhdGUgRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIHVwZGF0ZSBub24tZXhpc3RlbnQgYnVzaW5lc3MgJyR7c2VsZWN0ZWRCdXNpbmVzc30nIGJ5IFBsYXllcjogJHtleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7YnVzaW5lc3NOYW1lfSBkb2VzIG5vdCBleGlzdC5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IHNlbGVjdGVkQnVzaW5lc3MgfSwge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iLFxuICAgICAgICBidXNpbmVzc0VtYWlsXG4gICAgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBCdXNpbmVzcyAnJHtzZWxlY3RlZEJ1c2luZXNzfScgdXBkYXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZGVsZXRlQnVzaW5lc3MnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZTogZGF0YSB9KTtcbiAgICBpZiAoIWJ1c2luZXNzKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgRGVsZXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGRlbGV0ZSBub24tZXhpc3RlbnQgYnVzaW5lc3MgJyR7ZGF0YX0nIGJ5IFBsYXllcjogJHtleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7ZGF0YX0gZG9lcyBub3QgZXhpc3QuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBkYXRhIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICB0aXRsZTogJ0J1c2luZXNzIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgQnVzaW5lc3MgJyR7ZGF0YX0nIGRlbGV0ZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6dG9nZ2xlSm9iQ2FsbHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpOztcbiAgICBjb25zdCBQbGF5ZXJEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSk7XG4gICAgaWYgKCFQbGF5ZXJEYXRhKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIsIGpvYkNhbGxzOiB0cnVlIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSwgeyBqb2JDYWxsczogIVBsYXllckRhdGEuam9iQ2FsbHMgfSk7XG4gICAgcmV0dXJuICFQbGF5ZXJEYXRhLmpvYkNhbGxzO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0Sm9iQ2FsbHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IFBsYXllckRhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciB9KTtcbiAgICBpZiAoIVBsYXllckRhdGEpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IHBsYXllciwgam9iQ2FsbHM6IHRydWUgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG4gICAgcmV0dXJuIFBsYXllckRhdGEuam9iQ2FsbHM7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpidXNpbmVzc0NhbGwnLCBhc3luYyAoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgbnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGNpdGl6ZW5pZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIobnVtYmVyKTtcbiAgICBjb25zdCBwZXJzb25hbE51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2xpZW50KTtcbiAgICBpZiAoU3RyaW5nKHBlcnNvbmFsTnVtYmVyKSA9PT0gU3RyaW5nKG51bWJlcikpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBDYW4ndCBjYWxsIHlvdXJzZWxmICR7cGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgaWYgKCFjaXRpemVuaWQpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFRoaXMgbnVtYmVyIGlzIG5vdCByZWdpc3RlcmVkLmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgY29uc3QgUGxheWVyRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogY2l0aXplbmlkIH0pO1xuICAgIGlmIChQbGF5ZXJEYXRhICYmICFQbGF5ZXJEYXRhLmpvYkNhbGxzKSB7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBUaGlzIHBlcnNvbiBoYXMgZGlzYWJsZWQgam9iIGNhbGxzLmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9IGVsc2UgaWYgKFBsYXllckRhdGEgJiYgUGxheWVyRGF0YS5qb2JDYWxscykge1xuICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpjbGllbnQ6YnVzaW5lc3NDYWxsJywgY2xpZW50LCBudW1iZXIpO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmdldEJhbmtiYWxhbmNlJywgYXN5bmMgKGNsaWVudCwgYWNjb3VudCkgPT4ge1xuICAgIGNvbnN0IGJhbGFuY2UgPSBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5nZXRBY2NvdW50TW9uZXkoYWNjb3VudCk7XG4gICAgcmV0dXJuIGJhbGFuY2U7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpkZXBvc2l0TW9uZXknLCBhc3luYyAoY2xpZW50LCBhbW91bnQ6IG51bWJlcikgPT4ge1xuICAgIFxuICAgIGNvbnN0IHNyYyA9IGNsaWVudDtcbiAgICBjb25zdCBQbGF5ZXIgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyKHNyYyk7XG4gICAgY29uc3QgZnVsbG5hbWUgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShzcmMpO1xuICAgIGNvbnN0IGNpZCA9IFBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZDtcbiAgICBjb25zdCBQbGF5ZXJKb2IgPSBQbGF5ZXIuUGxheWVyRGF0YS5qb2I7XG4gICAgY29uc3QgYWNjb3VudCA9IFBsYXllckpvYi5uYW1lO1xuICAgIGNvbnN0IGJhbmtiYWxhbmNlID0gYXdhaXQgUGxheWVyLlBsYXllckRhdGEubW9uZXkuYmFuaztcbiAgICBpZiAoYmFua2JhbGFuY2UgPCBhbW91bnQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBhd2FpdCBQbGF5ZXIuRnVuY3Rpb25zLlJlbW92ZU1vbmV5KCdiYW5rJywgYW1vdW50LCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0LlwiKTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5hZGRBY2NvdW50TW9uZXkoYWNjb3VudCwgYW1vdW50KTtcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihjaWQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3XCIsIGFtb3VudCwgYFNlbnQgZnVuZHMgdG8gJHtQbGF5ZXJKb2IubGFiZWx9YCwgYWNjb3VudCwgZnVsbG5hbWUsIFwid2l0aGRyYXdcIiwgZ2VuZXJhdGVVVWlkKCkpXG4gICAgYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oYWNjb3VudCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgRGVwb3NpdFwiLCBhbW91bnQsIFwiRGVwb3NpdFwiLCBmdWxsbmFtZSwgYWNjb3VudCwgXCJkZXBvc2l0XCIsIGdlbmVyYXRlVVVpZCgpKVxuXG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnTW9uZXkgRGVwb3NpdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBsYXllciAke2Z1bGxuYW1lfSBkZXBvc2l0ZWQgJCR7YW1vdW50fSB0byBhY2NvdW50ICR7YWNjb3VudH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6d2l0aGRyYXdNb25leScsIGFzeW5jIChjbGllbnQsIGFtb3VudDogbnVtYmVyKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gY2xpZW50O1xuICAgIGNvbnN0IFBsYXllciA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIoc3JjKTtcbiAgICBjb25zdCBmdWxsbmFtZSA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKHNyYyk7XG4gICAgY29uc3QgY2lkID0gUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkO1xuICAgIGNvbnN0IFBsYXllckpvYiA9IFBsYXllci5QbGF5ZXJEYXRhLmpvYjtcbiAgICBjb25zdCBhY2NvdW50ID0gUGxheWVySm9iLm5hbWU7XG4gICAgY29uc3QgYmFsYW5jZSA9IGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmdldEFjY291bnRNb25leShhY2NvdW50KTtcbiAgICBpZiAoYmFsYW5jZSA8IGFtb3VudCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGF3YWl0IFBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoY2xpZW50LCAnYmFuaycsIGFtb3VudCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgV2l0aGRyYXcuXCIpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLnJlbW92ZUFjY291bnRNb25leShhY2NvdW50LCBhbW91bnQpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGNpZCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgV2l0aGRyYXdcIiwgYW1vdW50LCBgUmVjaWV2ZWQgZnVuZHMgZnJvbSAke1BsYXllckpvYi5sYWJlbH1gLCBhY2NvdW50LCBmdWxsbmFtZSwgXCJkZXBvc2l0XCIsIGdlbmVyYXRlVVVpZCgpKVxuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGFjY291bnQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3XCIsIGFtb3VudCwgXCJXaXRoZHJhd1wiLCBhY2NvdW50LCBmdWxsbmFtZSwgXCJ3aXRoZHJhd1wiLCBnZW5lcmF0ZVVVaWQoKSlcblxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICB0aXRsZTogJ01vbmV5IFdpdGhkcmF3bicsXG4gICAgICAgIG1lc3NhZ2U6IGBQbGF5ZXIgJHtmdWxsbmFtZX0gd2l0aGRyZXcgJCR7YW1vdW50fSBmcm9tIGFjY291bnQgJHthY2NvdW50fS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpnZXRFbXBsb3llZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzcmMgPSBjbGllbnQ7XG4gICAgY29uc3Qgam9ibmFtZSA9IGRhdGE7XG4gICAgY29uc3QgUGxheWVyID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllcihzcmMpO1xuICAgIGNvbnN0IGlzQm9zcyA9IFBsYXllci5QbGF5ZXJEYXRhLmpvYi5pc2Jvc3M7XG4gICAgLyogICAgIFxuICAgICAgICBpZiAoIWlzQm9zcykge1xuICAgICAgICAgICAgcmV0dXJuIGV4cG9ydHNbJ3BzLWFkbWlubWVudSddLkJhblBsYXllcihzcmMsICdHZXRFbXBsb3llZXMgRXhwbG9pdGluZyAnLCAnc3VtbWl0X3Bob25lJyk7XG4gICAgICAgIH1cbiAgICAqL1xuICAgIGNvbnN0IHBsYXllcnM6IGFueSA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgY2l0aXplbmlkLCBjaGFyaW5mbywgam9iIEZST00gcGxheWVycyBXSEVSRSBqb2IgTElLRSA/JywgW2AlJHtqb2JuYW1lfSVgXSk7XG4gICAgY29uc3QgZW1wbG95ZWVzOiBhbnkgPSBbXTtcblxuICAgIGZvciAoY29uc3QgZGF0YSBvZiBwbGF5ZXJzKSB7XG4gICAgICAgIGxldCBjaGFyRGF0YSA9IHsgZmlyc3RuYW1lOiAnVW5rbm93bicsIGxhc3RuYW1lOiAnUGxheWVyJyB9O1xuICAgICAgICBsZXQgam9iRGF0YSA9IHsgbmFtZTogJ1Vua25vd24nLCBncmFkZTogMCwgaXNib3NzOiBmYWxzZSB9O1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5jaGFyaW5mbykgY2hhckRhdGEgPSBKU09OLnBhcnNlKGRhdGEuY2hhcmluZm8pO1xuICAgICAgICAgICAgaWYgKGRhdGEuam9iKSBqb2JEYXRhID0gSlNPTi5wYXJzZShkYXRhLmpvYik7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIExPR0dFUihgRmFpbGVkIHRvIHBhcnNlIEpvYiAke2pvYm5hbWV9IC8gY2hhcmluZm8gZm9yICQgJHtkYXRhLmNpdGl6ZW5pZH1gKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNPbmxpbmUgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQoZGF0YS5jaXRpemVuaWQpO1xuICAgICAgICBpZiAoaXNPbmxpbmUgJiYgaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSA9PT0gam9ibmFtZSkge1xuICAgICAgICAgICAgZW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogaXNPbmxpbmUuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICAgICAgY3VySm9iOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5uYW1lLFxuICAgICAgICAgICAgICAgIGdyYWRlOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5ncmFkZSxcbiAgICAgICAgICAgICAgICBpc2Jvc3M6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmlzYm9zcyxcbiAgICAgICAgICAgICAgICBuYW1lOiBgJHtpc09ubGluZS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtpc09ubGluZS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnb25saW5lJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbXBsb3llZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgZW1wU291cmNlOiBkYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgICAgICBjdXJKb2I6IGpvYkRhdGEubmFtZSxcbiAgICAgICAgICAgICAgICBncmFkZTogam9iRGF0YS5ncmFkZSxcbiAgICAgICAgICAgICAgICBpc2Jvc3M6IGpvYkRhdGEuaXNib3NzLFxuICAgICAgICAgICAgICAgIG5hbWU6IGAke2NoYXJEYXRhLmZpcnN0bmFtZX0gJHtjaGFyRGF0YS5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgIHN0YXR1czogJ29mZmxpbmUnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbXBsb3llZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IChiLmdyYWRlLmxldmVsIHx8IDApIC0gKGEuZ3JhZGUubGV2ZWwgfHwgMCkpO1xuXG4gICAgY29uc3QgbXVsdGlqb2JFbXBsb3llZXM6IGFueVtdID0gW107XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgbXVsdGlKb2JQbGF5ZXJzOiBhbnlbXSA9IChhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGpvYk5hbWU6IGpvYm5hbWUgfSkpIHx8IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3QgbXVsdGlKb2Igb2YgbXVsdGlKb2JQbGF5ZXJzKSB7XG4gICAgICAgICAgICBpZiAoIW11bHRpSm9iLmNpdGl6ZW5JZCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignU2tpcHBpbmcgaW52YWxpZCBtdWx0aWpvYiBlbnRyeTonLCBtdWx0aUpvYik7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlzT25saW5lID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKG11bHRpSm9iLmNpdGl6ZW5JZCk7XG4gICAgICAgICAgICBpZiAoIWlzT25saW5lKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGxheWVyRGF0YTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCBjaGFyaW5mbywgam9iIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW211bHRpSm9iLmNpdGl6ZW5JZF0pO1xuICAgICAgICAgICAgICAgIGlmICghcGxheWVyRGF0YSB8fCBwbGF5ZXJEYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYE5vIHBsYXllciBkYXRhIGZvdW5kIGZvciBvZmZsaW5lIGNpdGl6ZW5JZCAke211bHRpSm9iLmNpdGl6ZW5JZH1gKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBkYXRhIG9mIHBsYXllckRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGpvYkRhdGEsIGNoYXJEYXRhO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgam9iRGF0YSA9IGRhdGEuam9iID8gSlNPTi5wYXJzZShkYXRhLmpvYikgOiB7IG5hbWU6ICdVbmtub3duJywgZ3JhZGU6IDAsIGlzYm9zczogZmFsc2UgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJEYXRhID0gZGF0YS5jaGFyaW5mbyA/IEpTT04ucGFyc2UoZGF0YS5jaGFyaW5mbykgOiB7IGZpcnN0bmFtZTogJ1Vua25vd24nLCBsYXN0bmFtZTogJ1BsYXllcicgfTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHBhcnNlIGpvYi9jaGFyaW5mbyBmb3IgJHttdWx0aUpvYi5jaXRpemVuSWR9OmAsIGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGpvYkRhdGEubmFtZSA9PT0gam9ibmFtZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIG11bHRpam9iRW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZW1wU291cmNlOiBtdWx0aUpvYi5jaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJKb2I6IGpvYkRhdGEubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyYWRlOiBqb2JEYXRhLmdyYWRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNib3NzOiBqb2JEYXRhLmlzYm9zcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGAke2NoYXJEYXRhLmZpcnN0bmFtZX0gJHtjaGFyRGF0YS5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnb2ZmbGluZSdcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSA9PT0gam9ibmFtZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgbXVsdGlqb2JFbXBsb3llZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogaXNPbmxpbmUuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICAgICAgICAgIGN1ckpvYjogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZ3JhZGU6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmdyYWRlLFxuICAgICAgICAgICAgICAgICAgICBpc2Jvc3M6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmlzYm9zcyxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYCR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICdvbmxpbmUnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbXVsdGlqb2JFbXBsb3llZXMuc29ydCgoYSwgYikgPT4gKGIuZ3JhZGUgfHwgMCkgLSAoYS5ncmFkZSB8fCAwKSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHByb2Nlc3NpbmcgbXVsdGlqb2IgZW1wbG95ZWVzOicsIGVycik7XG4gICAgfVxuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZW1wbG95ZWVzOiBlbXBsb3llZXMubGVuZ3RoID4gMCA/IGVtcGxveWVlcyA6IFtdLFxuICAgICAgICBtdWx0aWpvYkVtcGxveWVlczogbXVsdGlqb2JFbXBsb3llZXMubGVuZ3RoID4gMCA/IG11bHRpam9iRW1wbG95ZWVzIDogW11cbiAgICB9KTtcbn0pO1xuXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6aGlyZUVtcGxveWVlJywgYXN5bmMgKGNsaWVudCwgdGFyZ2V0U291cmNlOiBzdHJpbmcsIGpvYm5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChTdHJpbmcoY2xpZW50KSA9PT0gU3RyaW5nKHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdIaXJlIEZhaWxlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQXR0ZW1wdCB0byBoaXJlIHNlbGYgTmFtZTogJHtleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfSwgaW4gSm9iOiAke2pvYm5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgY2FuJ3QgaGlyZSB5b3Vyc2VsZi5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGlmIChhd2FpdCBEb2VzUGxheWVyRXhpc3QodGFyZ2V0U291cmNlKSkge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyKGNsaWVudCk7XG4gICAgICAgIGlmICghcGxheWVyLlBsYXllckRhdGEuam9iLmlzYm9zcykge1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ0hpcmUgRmFpbGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQXR0ZW1wdCB0byBoaXJlIHdpdGhvdXQgYmVpbmcgYSBib3NzIE5hbWU6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX0sIGluIEpvYjogJHtqb2JuYW1lfSwgQ2l0aXplbklkOiAke3BsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBhcmUgbm90IGEgYm9zcy5gLFxuICAgICAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllcih0YXJnZXRTb3VyY2UpO1xuICAgICAgICB0YXJnZXRQbGF5ZXIuRnVuY3Rpb25zLlNldEpvYihqb2JuYW1lLCAwKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdFbXBsb3llZSBIaXJlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkfSBOYW1lOiAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGlyZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9LCBpbiBKb2I6ICR7am9ibmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgaGlyZWQgJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IHRvICR7am9ibmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBiZWVuIGhpcmVkIHRvICR7am9ibmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0KCdzdW1taXRfcGhvbmU6c2VydmVyOmhpcmVpbk11bHRpSm9iJywgdGFyZ2V0U291cmNlLCBqb2JuYW1lLCAwLCBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbam9ibmFtZV0ubGFiZWwsIEZyYW1ld29yay5TaGFyZWQuSm9ic1tqb2JuYW1lXS5ncmFkZXNbJzAnXS5sYWJlbCk7XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBjbGllbnQsIGpvYm5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSGlyZSBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gaGlyZSBub24tZXhpc3RlbnQgcGxheWVyIE5hbWU6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX0sIGluIEpvYjogJHtqb2JuYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBQbGF5ZXIgaXMgbm90IG9ubGluZS5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldEluZGV4T2ZBbGxKb2JzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGpvYnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdzdW1taXRfam9icycsIHt9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoam9icy5tYXAoKGpvYjogYW55KSA9PiBqb2IuX2lkKSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncmVnaXN0ZXJKb2JzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgam9icyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3N1bW1pdF9qb2JzJywgam9icyk7XG4gICAgY29uc3QgeyBfaWQsIC4uLnJlc3QgfSA9IGpvYnM7XG4gICAgZXhwb3J0c1sncWItY29yZSddLkFkZEpvYihfaWQsIHJlc3QpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfam9icycsXG4gICAgICAgIHRpdGxlOiAnSm9iIFJlZ2lzdGVyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTmV3IGpvYiAnJHtfaWR9JyBOYW1lOiAke2pvYnMuam9iTmFtZX0gcmVnaXN0ZXJlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0Sm9iRGF0YScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnc3VtbWl0X2pvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoam9iKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd1cGRhdGVKb2JzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgam9icyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGpvYnMuX2lkIH0sIGpvYnMpO1xuICAgIGNvbnN0IHsgX2lkLCAuLi5yZXN0IH0gPSBqb2JzO1xuICAgIGV4cG9ydHNbJ3FiLWNvcmUnXS5VcGRhdGVKb2IoX2lkLCByZXN0KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2pvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEpvYiAnJHtfaWR9JyBOYW1lOiAke2pvYnMuam9iTmFtZX0gdXBkYXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZGVsZXRlSm9icycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnc3VtbWl0X2pvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBpZiAoIWpvYikge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdzdW1taXRfam9icycsXG4gICAgICAgICAgICB0aXRsZTogJ0pvYiBEZWxldGlvbiBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gZGVsZXRlIG5vbi1leGlzdGVudCBqb2IgJyR7ZGF0YX0nIGJ5IFBsYXllcjogJHtleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgSm9iIGRvZXMgbm90IGV4aXN0LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgZXhwb3J0c1sncWItY29yZSddLlJlbW92ZUpvYihkYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2pvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEpvYiAnJHtkYXRhfScgTmFtZTogJHtqb2Iuam9iTmFtZX0gZGVsZXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpnZXRCdXNpbmVzc0VtcGxveWVlc051bWJlcnMnLCBhc3luYyAoY2xpZW50OiBudW1iZXIsIGpvYjogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgW3BsYXllcnNdID0gYXdhaXQgRnJhbWV3b3JrLkZ1bmN0aW9ucy5HZXRQbGF5ZXJzT25EdXR5KGpvYik7XG4gICAgbGV0IG51bWJlcnM6IG51bWJlcltdID0gW107XG4gICAgZm9yIChjb25zdCBwbGF5ZXIgb2YgcGxheWVycykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHBsYXllcik7XG4gICAgICAgIG51bWJlcnMucHVzaChOdW1iZXIobnVtYmVyKSk7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShudW1iZXJzKTtcbn0pIiwgImltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRnJhbWV3b3JrLCBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5vbk5ldCgnc3VtbWl0X3Bob25lOnNlcnZlcjpmaXJlRW1wbG95ZWUnLCBhc3luYyAoY2l0aXplbklkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzb3VyY2UgPSBnbG9iYWwuc291cmNlO1xuICAgIGNvbnN0IHRhcmdldERhdGEgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICBpZiAodGFyZ2V0RGF0YSkge1xuICAgICAgICBjb25zdCBqb2JuYW1lID0gdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmpvYi5uYW1lO1xuICAgICAgICBhd2FpdCB0YXJnZXREYXRhLkZ1bmN0aW9ucy5TZXRKb2IoJ3VuZW1wbG95ZWQnLCAwKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIGpvYk5hbWU6IGpvYm5hbWUgfSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGZpcmVkICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYmVlbiBmaXJlZCBieSAke2dsb2JhbC5zb3VyY2V9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JuYW1lKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZW1wbG95ZWVfYWN0aW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnRW1wbG95ZWUgRmlyZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhhcyBiZWVuIGZpcmVkIGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBDaXRpemVuSWQ6ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH0gfCBKb2I6ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmpvYi5uYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHBsYXllckRhdGE6IGFueSA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1Qgam9iIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/IExJTUlUIDEnLCBbY2l0aXplbklkXSk7XG4gICAgICAgIGNvbnN0IGpvYkRhdGEgPSBKU09OLnBhcnNlKHBsYXllckRhdGFbMF0uam9iKTtcblxuICAgICAgICBsZXQgam9iOiBhbnkgPSB7fTtcbiAgICAgICAgam9iLm5hbWUgPSAndW5lbXBsb3llZCdcbiAgICAgICAgam9iLmxhYmVsID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10ubGFiZWxcbiAgICAgICAgam9iLnBheW1lbnQgPSBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbJ3VuZW1wbG95ZWQnXS5ncmFkZXNbJzAnXS5wYXltZW50XG4gICAgICAgIGpvYi5vbmR1dHkgPSBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbJ3VuZW1wbG95ZWQnXS5kZWZhdWx0RHV0eVxuICAgICAgICBqb2IuaXNib3NzID0gZmFsc2VcbiAgICAgICAgam9iLmdyYWRlID0ge31cbiAgICAgICAgam9iLmdyYWRlLm5hbWUgPSBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbJ3VuZW1wbG95ZWQnXS5ncmFkZXNbJzAnXS5uYW1lXG4gICAgICAgIGpvYi5ncmFkZS5sZXZlbCA9IDBcbiAgICAgICAgYXdhaXQgVXRpbHMucXVlcnkoJ1VQREFURSBwbGF5ZXJzIFNFVCBqb2IgPSA/IFdIRVJFIGNpdGl6ZW5pZCA9ID8nLCBbSlNPTi5zdHJpbmdpZnkoam9iKSwgY2l0aXplbklkXSk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogY2l0aXplbklkLCBqb2JOYW1lOiBqb2JEYXRhLm5hbWUgfSk7XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBzb3VyY2UsIGpvYkRhdGEubmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2VtcGxveWVlX2FjdGlvbicsXG4gICAgICAgICAgICB0aXRsZTogJ09mZmxpbmUgRW1wbG95ZWUgRmlyZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYE9mZmxpbmUgZW1wbG95ZWUgJHtjaXRpemVuSWR9IGhhcyBiZWVuIGZpcmVkIGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBKb2I6ICR7am9iRGF0YS5uYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbn0pO1xuXG5vbk5ldCgnc3VtbWl0X3Bob25lOnNlcnZlcjpjaGFuZ2VSYW5rT2ZQbGF5ZXInLCBhc3luYyAoZGF0YTogYW55KSA9PiB7XG4gICAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBjb25zdCB0YXJnZXREYXRhID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKGRhdGEudGFyZ2V0Q2l0aXplbmlkKTtcbiAgICBjb25zdCBtdWx0aUpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUgfSk7XG4gICAgaWYgKHRhcmdldERhdGEpIHtcbiAgICAgICAgY29uc3Qgam9ibmFtZSA9IGRhdGEuam9iTmFtZTtcbiAgICAgICAgdGFyZ2V0RGF0YS5GdW5jdGlvbnMuU2V0Sm9iKGpvYm5hbWUsIGRhdGEua2V5KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgY2hhbmdlZCB0aGUgcmFuayBvZiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdXIgcmFuayBoYXMgYmVlbiBjaGFuZ2VkIGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX1gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGlmIChtdWx0aUpvYikge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBkYXRhLnRhcmdldENpdGl6ZW5pZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lIH0sIHsgZ3JhZGVMZXZlbDogZGF0YS5rZXksIGdyYWRlTGFiZWw6IGRhdGEuZ3JhZGVOYW1lIH0pO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgVXBkYXRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7ZGF0YS50YXJnZXRDaXRpemVuaWR9IGhhcyBiZWVuIHVwZGF0ZWQgdG8gJHtkYXRhLmpvYk5hbWV9IHwgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9IGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBjaXRpemVuSWQ6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZ2VuZXJhdGVVVWlkKCksIGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSwgZ3JhZGVMZXZlbDogZGF0YS5rZXksIGdyYWRlTGFiZWw6IGRhdGEuZ3JhZGVOYW1lIH0pO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgQWRkZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiBhZGRlZCB0byAke2RhdGEuam9iTmFtZX0gfCBOZXcgUmFuazogJHtkYXRhLmdyYWRlTmFtZX0gYnkgJHthd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IGNpdGl6ZW5JZDogJHtleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKX1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBzb3VyY2UsIGpvYm5hbWUpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9lbXBsb3llZV9hY3Rpb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdSYW5rIENoYW5nZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhhcyBiZWVuIGdpdmVuIGEgbmV3IHJhbmsgYnkgJHthd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IENpdGl6ZW5JZDogJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2l0aXplbmlkfSB8IEpvYjogJHtqb2JuYW1lfSB8ICBOZXcgUmFuazogJHtkYXRhLmdyYWRlTmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBwbGF5ZXJEYXRhOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIGpvYiBGUk9NIHBsYXllcnMgV0hFUkUgY2l0aXplbmlkID0gPyBMSU1JVCAxJywgW2RhdGEudGFyZ2V0Q2l0aXplbmlkXSk7XG4gICAgICAgIGNvbnN0IGpvYkRhdGEgPSBKU09OLnBhcnNlKHBsYXllckRhdGFbMF0uam9iKTtcbiAgICAgICAgam9iRGF0YS5ncmFkZS5sZXZlbCA9IGRhdGEua2V5O1xuICAgICAgICBqb2JEYXRhLmdyYWRlLm5hbWUgPSBkYXRhLmdyYWRlTmFtZTtcbiAgICAgICAgYXdhaXQgVXRpbHMucXVlcnkoJ1VQREFURSBwbGF5ZXJzIFNFVCBqb2IgPSA/IFdIRVJFIGNpdGl6ZW5pZCA9ID8nLCBbSlNPTi5zdHJpbmdpZnkoam9iRGF0YSksIGRhdGEudGFyZ2V0Q2l0aXplbmlkXSk7XG4gICAgICAgIGlmIChtdWx0aUpvYikge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBkYXRhLnRhcmdldENpdGl6ZW5pZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lIH0sIHsgZ3JhZGVMZXZlbDogZGF0YS5rZXksIGdyYWRlTGFiZWw6IGRhdGEuZ3JhZGVOYW1lIH0pO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgVXBkYXRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7ZGF0YS50YXJnZXRDaXRpemVuaWR9IGhhcyBiZWVuIHVwZGF0ZWQgdG8gJHtkYXRhLmpvYk5hbWV9IHwgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9IGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBjaXRpemVuSWQ6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZ2VuZXJhdGVVVWlkKCksIGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSwgZ3JhZGVMZXZlbDogZGF0YS5rZXksIGdyYWRlTGFiZWw6IGRhdGEuZ3JhZGVOYW1lIH0pO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgQWRkZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiBhZGRlZCB0byAke2RhdGEuam9iTmFtZX0gfCBOZXcgUmFuazogJHtkYXRhLmdyYWRlTmFtZX0gYnkgJHthd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IGNpdGl6ZW5JZDogJHtleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKX1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBzb3VyY2UsIGpvYkRhdGEubmFtZSk7XG4gICAgfVxufSk7XG5cbm9uTmV0KCdzdW1taXRfcGhvbmU6c2VydmVyOmZpcmVJbmFjdGl2ZUVtcGxveWVlJywgYXN5bmMgKGRhdGE6IHsgam9iTmFtZTogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZyB9KSA9PiB7XG4gICAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGRhdGEuY2l0aXplbklkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUgfSk7XG4gICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgZmlyZWQgYW4gaW5hY3RpdmUgZW1wbG95ZWVgLFxuICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICB9KSk7XG4gICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgZGF0YS5qb2JOYW1lKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2VtcGxveWVlX2FjdGlvbicsXG4gICAgICAgIHRpdGxlOiAnSW5hY3RpdmUgRW1wbG95ZWUgRmlyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgSW5hY3RpdmUgZW1wbG95ZWUgJHtkYXRhLmNpdGl6ZW5JZH0gaGFzIGJlZW4gZmlyZWQgYnkgJHthd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IEpvYjogJHtkYXRhLmpvYk5hbWV9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uKCdzdW1taXRfcGhvbmU6c2VydmVyOmhpcmVpbk11bHRpSm9iJywgYXN5bmMgKGNsaWVudDogc3RyaW5nLCBqb2JuYW1lOiBzdHJpbmcsIGdyYWRlTGV2ZWw6IG51bWJlciwgam9iTGFiZWw6IHN0cmluZywgZ3JhZGVMYWJlbDogc3RyaW5nKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ0hpcmluZyBpbiBtdWx0aSBqb2I6Jywgam9ibmFtZSwgZ3JhZGVMZXZlbCwgam9iTGFiZWwsIGdyYWRlTGFiZWwpO1xuICAgIGNvbnN0IHRhcmdldENpZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IG11bHRpSm9iQ2hlY2sgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiB0YXJnZXRDaWQsIGpvYk5hbWU6IGpvYm5hbWUgfSk7XG4gICAgaWYgKG11bHRpSm9iQ2hlY2spIHtcbiAgICAgICAgaWYgKG11bHRpSm9iQ2hlY2suZ3JhZGVMZXZlbCAhPT0gZ3JhZGVMZXZlbCkge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiB0YXJnZXRDaWQsIGpvYk5hbWU6IGpvYm5hbWUgfSwgeyBncmFkZUxldmVsLCBncmFkZUxhYmVsIH0pO1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYmVlbiBoaXJlZCBpbiBhIG5ldyByYW5rOiAke2dyYWRlTGFiZWx9YCxcbiAgICAgICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIGNsaWVudCwgam9ibmFtZSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlfam9iJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBVcGRhdGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHt0YXJnZXRDaWR9IGhhcyBiZWVuIHVwZGF0ZWQgdG8gJHtqb2JuYW1lfSB8IE5ldyBSYW5rOiAke2dyYWRlTGFiZWx9IGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX0gfCBjaXRpemVuSWQ6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBlbWl0TmV0KCdRQkNvcmU6Tm90aWZ5JywgY2xpZW50LCAnWW91IGFyZSBhbHJlYWR5IGluIHRoaXMgam9iIHdpdGggdGhpcyBncmFkZSBsZXZlbCcsICdlcnJvcicpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX211bHRpam9icycsIHsgX2lkOiBnZW5lcmF0ZVVVaWQoKSwgY2l0aXplbklkOiB0YXJnZXRDaWQsIGpvYk5hbWU6IGpvYm5hbWUsICBncmFkZUxldmVsOiBncmFkZUxldmVsLCBqb2JMYWJlbDogam9iTGFiZWwsIGdyYWRlTGFiZWw6IGdyYWRlTGFiZWwgfSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGJlZW4gaGlyZWQgaW4gYSBuZXcgam9iOiAke2pvYkxhYmVsfSBhcyAke2dyYWRlTGFiZWx9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgY2xpZW50LCBqb2JuYW1lKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlfam9iJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIEFkZGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldENpZH0gaGFzIGJlZW4gYWRkZWQgdG8gJHtqb2JuYW1lfSB8IE5ldyBSYW5rOiAke2dyYWRlTGFiZWx9IGJ5ICR7YXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX0gfCBjaXRpemVuSWQ6ICR7ZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxufSlcblxuc2V0SW1tZWRpYXRlKGFzeW5jICgpID0+IHtcbiAgICBsZXQgaXNEQkNvbm5lY3RlZCA9IGV4cG9ydHNbJ21vbmdvREInXS5pc0RCQ29ubmVjdGVkKCk7XG4gICAgd2hpbGUgKGlzREJDb25uZWN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgICAgICBpc0RCQ29ubmVjdGVkID0gZXhwb3J0c1snbW9uZ29EQiddLmlzREJDb25uZWN0ZWQoKTtcbiAgICAgICAgaWYgKGlzREJDb25uZWN0ZWQpIHtcbiAgICAgICAgICAgIExPR0dFUihcIltTZXR0aW5nc10gTW9uZ29EQiBjb25uZWN0ZWQuXCIpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgam9iQXJyYXk6IGFueSA9IHt9O1xuICAgIGNvbnN0IGpvYkRhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdzdW1taXRfam9icycsIHt9KTtcbiAgICBqb2JEYXRhLmZvckVhY2goYXN5bmMgKGpvYjogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IHsgX2lkLCAuLi5yZXN0IH0gPSBqb2I7XG4gICAgICAgIExPR0dFUihgW1NVTU1JVF9QSE9ORV0gQ3JlYXRlZCBqb2IgJHtfaWR9IFN1Y2Nlc3NmdWxseWApO1xuICAgICAgICBqb2JBcnJheVtfaWRdID0gcmVzdDtcbiAgICB9KTtcbiAgICAvKiBjb25zdCBbdXBkYXRlZCwgbWVzc2FnZV0gPSBleHBvcnRzWydxYi1jb3JlJ10uQWRkSm9icyhqb2JBcnJheSk7ICovXG59KTsgIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBQaG9uZU1haWwsIFBob25lUGxheWVyQ2FyZCB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi9jbGFzc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdHZXRDbGllbnRTZXR0aW5ncycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgX2lkOiBTZXR0aW5ncy5faWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGJhY2tncm91bmQ6IFNldHRpbmdzLmJhY2tncm91bmQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGxvY2tzY3JlZW46IFNldHRpbmdzLmxvY2tzY3JlZW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHJpbmd0b25lOiBTZXR0aW5ncy5yaW5ndG9uZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IFNldHRpbmdzLnNob3dTdGFydHVwU2NyZWVuLmdldChjaXRpemVuSWQpLFxuICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogU2V0dGluZ3Muc2hvd05vdGlmaWNhdGlvbnMuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGlzTG9jazogU2V0dGluZ3MuaXNMb2NrLmdldChjaXRpemVuSWQpLFxuICAgICAgICBsb2NrUGluOiBTZXR0aW5ncy5sb2NrUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICB1c2VQaW46IFNldHRpbmdzLnVzZVBpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgdXNlRmFjZUlkOiBTZXR0aW5ncy51c2VGYWNlSWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGZhY2VJZElkZW50aWZpZXI6IFNldHRpbmdzLmZhY2VJZElkZW50aWZpZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHNtcnRJZDogU2V0dGluZ3Muc21ydElkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBkYXJrTWFpbElkQXR0YWNoZWQ6IFNldHRpbmdzLmRhcmtNYWlsSWRBdHRhY2hlZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgc21ydFBhc3N3b3JkOiBTZXR0aW5ncy5zbXJ0UGFzc3dvcmQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGlzRmxpZ2h0TW9kZTogU2V0dGluZ3MuaXNGbGlnaHRNb2RlLmdldChjaXRpemVuSWQpLFxuICAgICAgICBwaG9uZU51bWJlcjogU2V0dGluZ3MucGhvbmVOdW1iZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IFNldHRpbmdzLnBpZ2VvbklkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnU2V0Q2xpZW50U2V0dGluZ3MnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgICAgICBiYWNrZ3JvdW5kOiB7IGN1cnJlbnQ6IHN0cmluZzsgd2FsbHBhcGVyczogc3RyaW5nW10gfTtcbiAgICAgICAgbG9ja3NjcmVlbjogeyBjdXJyZW50OiBzdHJpbmc7IHdhbGxwYXBlcnM6IHN0cmluZ1tdIH07XG4gICAgICAgIHJpbmd0b25lOiB7IGN1cnJlbnQ6IHN0cmluZzsgcmluZ3RvbmVzOiB7IG5hbWU6IHN0cmluZywgdXJsOiBzdHJpbmcgfVtdIH07XG4gICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiBib29sZWFuO1xuICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogYm9vbGVhbjtcbiAgICAgICAgaXNMb2NrOiBib29sZWFuO1xuICAgICAgICBsb2NrUGluOiBzdHJpbmc7XG4gICAgICAgIHVzZVBpbjogYm9vbGVhbjtcbiAgICAgICAgdXNlRmFjZUlkOiBib29sZWFuO1xuICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiBzdHJpbmc7XG4gICAgICAgIHNtcnRJZDogc3RyaW5nO1xuICAgICAgICBkYXJrTWFpbElkQXR0YWNoZWQ6IHN0cmluZztcbiAgICAgICAgc21ydFBhc3N3b3JkOiBzdHJpbmc7XG4gICAgICAgIGlzRmxpZ2h0TW9kZTogYm9vbGVhbjtcbiAgICAgICAgcGhvbmVOdW1iZXI6IHN0cmluZztcbiAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogc3RyaW5nO1xuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIFNldHRpbmdzLmJhY2tncm91bmQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5iYWNrZ3JvdW5kKTtcbiAgICBTZXR0aW5ncy5sb2Nrc2NyZWVuLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEubG9ja3NjcmVlbik7XG4gICAgU2V0dGluZ3MucmluZ3RvbmUuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5yaW5ndG9uZSk7XG4gICAgU2V0dGluZ3Muc2hvd1N0YXJ0dXBTY3JlZW4uc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5zaG93U3RhcnR1cFNjcmVlbik7XG4gICAgU2V0dGluZ3Muc2hvd05vdGlmaWNhdGlvbnMuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5zaG93Tm90aWZpY2F0aW9ucyk7XG4gICAgU2V0dGluZ3MuaXNMb2NrLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuaXNMb2NrKTtcbiAgICBTZXR0aW5ncy5sb2NrUGluLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEubG9ja1Bpbik7XG4gICAgU2V0dGluZ3MudXNlUGluLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEudXNlUGluKTtcbiAgICBTZXR0aW5ncy51c2VGYWNlSWQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS51c2VGYWNlSWQpO1xuICAgIFNldHRpbmdzLmZhY2VJZElkZW50aWZpZXIuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5mYWNlSWRJZGVudGlmaWVyKTtcbiAgICBTZXR0aW5ncy5zbXJ0SWQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5zbXJ0SWQpO1xuICAgIFNldHRpbmdzLnNtcnRQYXNzd29yZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnNtcnRQYXNzd29yZCk7XG4gICAgU2V0dGluZ3MuaXNGbGlnaHRNb2RlLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuaXNGbGlnaHRNb2RlKTtcbiAgICBTZXR0aW5ncy5kYXJrTWFpbElkQXR0YWNoZWQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5kYXJrTWFpbElkQXR0YWNoZWQpO1xuICAgIFNldHRpbmdzLnBob25lTnVtYmVyLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEucGhvbmVOdW1iZXIpO1xuICAgIFNldHRpbmdzLnBpZ2VvbklkQXR0YWNoZWQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5waWdlb25JZEF0dGFjaGVkKTtcbiAgICBhd2FpdCBTZXR0aW5ncy5TYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX3NldHRpbmdzJyxcbiAgICAgICAgdGl0bGU6ICdTZXR0aW5ncyBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7Y2l0aXplbklkfSB8IE5hbWU6ICR7Z2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IG5ldyBzZXR0aW5ncywgJHtKU09OLnN0cmluZ2lmeShwYXJzZWREYXRhKX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnUmVnaXN0ZXJOZXdNYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgZW1haWw6IHN0cmluZztcbiAgICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBkYXRhWDogUGhvbmVNYWlsID0ge1xuICAgICAgICBhY3RpdmVNYWlkSWQ6IHBhcnNlZERhdGEuZW1haWwsXG4gICAgICAgIHVzZXJuYW1lOiBwYXJzZWREYXRhLmVtYWlsLFxuICAgICAgICBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhcnNlZERhdGEucGFzc3dvcmQsXG4gICAgICAgIGF2YXRvcjogJycsXG4gICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICB9XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogcGFyc2VkRGF0YS5lbWFpbCwgLi4uZGF0YVggfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9lbWFpbCcsXG4gICAgICAgIHRpdGxlOiAnRW1haWwgQWNjb3VudCBSZWdpc3RlcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYE5ldyBlbWFpbCBhY2NvdW50IHJlZ2lzdGVyZWQgd2l0aCBlbWFpbCAke3BhcnNlZERhdGEuZW1haWx9LCBwYXNzd29yZCBcIiR7cGFyc2VkRGF0YS5wYXNzd29yZH1cIiwgQ2l0aXplbklkOiAke2F3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KX0sIE5hbWU6ICR7Z2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnU2VhcmNoRW1haWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tYWlsJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnTG9naW5NYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgZW1haWw6IHN0cmluZztcbiAgICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogcGFyc2VkRGF0YS5lbWFpbCB9KTtcbiAgICBpZiAocmVzLmFjdGl2ZU1haWxQYXNzd29yZCA9PT0gcGFyc2VkRGF0YS5wYXNzd29yZCkge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9lbWFpbCcsXG4gICAgICAgICAgICB0aXRsZTogJ0VtYWlsIExvZ2luJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2dsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KX0gTmFtZTogJHtnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoY2xpZW50KX0gbG9nZ2VkIGluIHRvIGVtYWlsIGFjY291bnQgJHtwYXJzZWREYXRhLmVtYWlsfSwgcGFzc3dvcmQgXCIke3BhcnNlZERhdGEucGFzc3dvcmR9XCJgLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd1bkxvY2tvckxvY2tQaG9uZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IGJvb2xlYW4pID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgU2V0dGluZ3MuaXNMb2NrLnNldChjaXRpemVuSWQsIGRhdGEpO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldFBob25lUGxheWVyQ2FyZCcsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9wbGF5ZXJfY2FyZCcsIHsgX2lkOiBjaXRpemVuSWQgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6dXBkYXRlUGVyc29uYWxDYXJkJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YTogUGhvbmVQbGF5ZXJDYXJkID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfcGxheWVyX2NhcmQnLCB7IF9pZDogcGFyc2VkRGF0YS5faWQgfSwgcGFyc2VkRGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9wZXJzb25hbF9jYXJkJyxcbiAgICAgICAgdGl0bGU6ICdQZXJzb25hbCBDYXJkIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtwYXJzZWREYXRhLl9pZH0gfCBOYW1lOiAke2dsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShjbGllbnQpfSB1cGRhdGVkIHBlcnNvbmFsIGNhcmQsICR7SlNPTi5zdHJpbmdpZnkocGFyc2VkRGF0YSl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IE1vbmdvREIsIExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCwgTE9HR0VSIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4vY2xhc3NcIjtcbmltcG9ydCB7IHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcblxuUmVnaXN0ZXJDb21tYW5kKCdzYXZlU2V0dGluZ3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGFyZ3M6IHN0cmluZ1tdKSA9PiB7XG4gICAgYXdhaXQgU2V0dGluZ3Muc2F2ZSgpO1xufSwgdHJ1ZSk7XG5cbmNvbnN0IGdlbmVyYXRlUGhvbmVOdW1iZXIgPSBhc3luYyAoKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgICBjb25zdCBudW1iZXIgPSBNYXRoLmZsb29yKDEwMDAwMDAwMDAgKyBNYXRoLnJhbmRvbSgpICogOTAwMDAwMDAwMCkudG9TdHJpbmcoKTtcbiAgICBjb25zdCBleGlzdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG51bWJlcjogbnVtYmVyIH0pO1xuICAgIGlmIChleGlzdHMpIHJldHVybiBnZW5lcmF0ZVBob25lTnVtYmVyKCk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIEdlbmVyYXRlUGxheWVyUGhvbmVOdW1iZXIoY2l0aXplbklkOiBzdHJpbmcsIHNvdXJjZTogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgbnVtYmVyID0gYXdhaXQgZ2VuZXJhdGVQaG9uZU51bWJlcigpO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9udW1iZXJzJywge1xuICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICBvd25lcjogY2l0aXplbklkLFxuICAgICAgICBudW1iZXI6IG51bWJlcixcbiAgICB9KTtcblxuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9zZXR0aW5ncycsIHtcbiAgICAgICAgX2lkOiBjaXRpemVuSWQsXG4gICAgICAgIGJhY2tncm91bmQ6IHtcbiAgICAgICAgICAgIGN1cnJlbnQ6ICcnLFxuICAgICAgICAgICAgd2FsbHBhcGVyczogW10sXG4gICAgICAgIH0sXG4gICAgICAgIGxvY2tzY3JlZW46IHtcbiAgICAgICAgICAgIGN1cnJlbnQ6ICcnLFxuICAgICAgICAgICAgd2FsbHBhcGVyczogW10sXG4gICAgICAgIH0sXG4gICAgICAgIHJpbmd0b25lOiB7XG4gICAgICAgICAgICBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICByaW5ndG9uZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0JyxcbiAgICAgICAgICAgICAgICAgICAgdXJsOiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRydWUsXG4gICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0cnVlLFxuICAgICAgICBpc0xvY2s6IHRydWUsXG4gICAgICAgIGxvY2tQaW46ICcnLFxuICAgICAgICB1c2VQaW46IHRydWUsXG4gICAgICAgIHBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICAgIHVzZUZhY2VJZDogZmFsc2UsXG4gICAgICAgIGZhY2VJZElkZW50aWZpZXI6IGNpdGl6ZW5JZCxcbiAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiAnJyxcbiAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogJycsXG4gICAgICAgIHNtcnRJZDogJycsXG4gICAgICAgIHNtcnRQYXNzd29yZDogJycsXG4gICAgICAgIGlzRmxpZ2h0TW9kZTogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfcGxheWVyX2NhcmQnLCB7XG4gICAgICAgIF9pZDogY2l0aXplbklkLFxuICAgICAgICBmaXJzdE5hbWU6ICdTZXR1cCcsXG4gICAgICAgIGxhc3ROYW1lOiAnQ2FyZCcsXG4gICAgICAgIHBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICAgIGVtYWlsOiAnJyxcbiAgICAgICAgbm90ZXM6ICcnLFxuICAgICAgICBhdmF0YXI6ICcnLFxuICAgIH0pO1xuICAgIFNldHRpbmdzLlJlZ2lzdGVyTmV3U2V0dGluZ3MoY2l0aXplbklkLCBudW1iZXIpO1xuXHRpZiAoc291cmNlKSB7XG5cdFx0ZW1pdE5ldCgncGhvbmU6Y2xpZW50OnNldHVwUGhvbmUnLCBzb3VyY2UsIGNpdGl6ZW5JZCk7XG5cdH1cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX3NldHRpbmdzJyxcbiAgICAgICAgdGl0bGU6ICdQaG9uZSBOdW1iZXIgR2VuZXJhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBob25lIG51bWJlciAke251bWJlcn0gZ2VuZXJhdGVkIGZvciAke2NpdGl6ZW5JZH1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWUsXG4gICAgfSk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn1cbmV4cG9ydHMoJ0dlbmVyYXRlUGxheWVyUGhvbmVOdW1iZXInLCBHZW5lcmF0ZVBsYXllclBob25lTnVtYmVyKTtcblxub24oJ3R4QWRtaW46ZXZlbnRzOnNjaGVkdWxlZFJlc3RhcnQnLCBhc3luYyAoZGF0YTogYW55KSA9PiB7XG4gICAgYXdhaXQgU2V0dGluZ3Muc2F2ZSgpO1xuICAgIExPR0dFUihgW1NldHRpbmdzXSBTYXZlZCBkdXJpbmcgcmVzb3VyY2Ugc3RvcC5gKTtcbn0pO1xuXG5vbigndHhBZG1pbjpldmVudHM6c2VydmVyU2h1dHRpbmdEb3duJywgYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IFNldHRpbmdzLnNhdmUoKTtcbiAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgZHVyaW5nIHJlc291cmNlIHN0b3AuYCk7XG59KTsiLCAiaW1wb3J0IHsgTG9nZ2VyLCBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBUd2VldERhdGEsIFR3ZWV0UHJvZmlsZURhdGEgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuXG5jbGFzcyBQaWdlb25TZXJ2aWNlIHtcbiAgICBwdWJsaWMgYXN5bmMgc2VhcmNoVXNlckV4aXN0KF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBkYXRhIH0pO1xuICAgICAgICByZXR1cm4gISF1c2VyO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBsb2dpbihfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCwgcGFzc3dvcmQgfSk7XG4gICAgICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdVc2VyIExvZ2luJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgd2l0aCBlbWFpbCAke2VtYWlsfSBsb2dnZWQgaW4gc3VjY2Vzc2Z1bGx5LmAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGxvZ2luOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2lnbnVwKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nVXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBpZiAoZXhpc3RpbmdVc2VyKSB7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJFbWFpbCBhbHJlYWR5IHRha2VuXCIgfTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgZW1haWwsXG4gICAgICAgICAgICBwYXNzd29yZCxcbiAgICAgICAgICAgIHZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIHVzZXJuYW1lOiBlbWFpbCxcbiAgICAgICAgICAgIGRpc3BsYXlOYW1lOiBlbWFpbCxcbiAgICAgICAgICAgIGF2YXRhcjogXCJcIixcbiAgICAgICAgICAgIGJhbm5lcjogXCJcIixcbiAgICAgICAgICAgIG5vdGlmaWNhdGlvbnNFbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBiaW86IFwiXCIsXG4gICAgICAgICAgICBmb2xsb3dlcnM6IFtdLFxuICAgICAgICAgICAgZm9sbG93aW5nOiBbXSxcbiAgICAgICAgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1VzZXIgU2lnbnVwJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBOZXcgdXNlciBhY2NvdW50IGNyZWF0ZWQgd2l0aCBlbWFpbCAke2VtYWlsfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0UHJvZmlsZShfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodXNlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gXCJVc2VyIG5vdCBmb3VuZFwiO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHRvZ2dsZU5vdGlmaWNhdGlvbnMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBpZiAocmVzKSB7XG4gICAgICAgICAgICByZXMubm90aWZpY2F0aW9uc0VuYWJsZWQgPSAhcmVzLm5vdGlmaWNhdGlvbnNFbmFibGVkO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9LCByZXMpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdOb3RpZmljYXRpb25zIFRvZ2dsZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IHRvZ2dsZWQgbm90aWZpY2F0aW9ucyB0byAke3Jlcy5ub3RpZmljYXRpb25zRW5hYmxlZCA/ICdlbmFibGVkJyA6ICdkaXNhYmxlZCd9LmAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHBvc3RUd2VldChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgZW1haWwsIGNvbnRlbnQsIGF0dGFjaG1lbnRzIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgICAgICBpZiAoIXJlcykgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICBjb25zdCB0d2VldDogVHdlZXREYXRhID0ge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdXNlcm5hbWU6IHJlcy5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgICAgICBlbWFpbDogcmVzLmVtYWlsLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogcmVzLmF2YXRhcixcbiAgICAgICAgICAgICAgICB2ZXJpZmllZDogcmVzLnZlcmlmaWVkLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgYXR0YWNobWVudHMsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgbGlrZUNvdW50OiBbXSxcbiAgICAgICAgICAgICAgICByZXBsaWVzQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgIHJldHdlZXRDb3VudDogW10sXG4gICAgICAgICAgICAgICAgaXNSZXR3ZWV0OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0SWQ6IG51bGwsXG4gICAgICAgICAgICAgICAgaGFzaHRhZ3M6IGNvbnRlbnQubWF0Y2goLyNcXHcrL2cpIHx8IFtdLFxuICAgICAgICAgICAgICAgIHBhcmVudFR3ZWV0SWQ6IG51bGwsXG5cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgdHdlZXQpO1xuICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJlZnJlc2hUd2VldFwiLCAtMSwgSlNPTi5zdHJpbmdpZnkodHdlZXQpKTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIC0xLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTmV3IFR3ZWV0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7cmVzLmRpc3BsYXlOYW1lfSBoYXMgcG9zdGVkIGEgbmV3IHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAncGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl9ub3RpZmljYXRpb25zXCIsIHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGAke3Jlcy5kaXNwbGF5TmFtZX0gaGFzIHBvc3RlZCBhIG5ldyB0d2VldC5gLFxuICAgICAgICAgICAgICAgIGVtYWlsOiByZXMuZW1haWwsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgdHlwZTogXCJwb3N0XCIsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgUG9zdGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBwb3N0ZWQgYSBuZXcgdHdlZXQgKElEOiAke3R3ZWV0Ll9pZH0pLCBjb250ZW50OiAke2NvbnRlbnR9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIHBvc3RUd2VldDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldEFsbEZlZWQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBzdGFydCA9IDEsIGVuZCA9IDIwIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwge30sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICAgICAgc2tpcDogc3RhcnQgLSAxLFxuICAgICAgICAgICAgICAgIGxpbWl0OiBlbmQsXG4gICAgICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGRhdGE6IHJlcyxcbiAgICAgICAgICAgICAgICBsZW5ndGg6IHJlcy5sZW5ndGgsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBnZXRGZWVkOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcG9zdFJlcGx5KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQsIGNvbnRlbnQsIGVtYWlsLCBhdHRhY2htZW50cyB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1tcInFiLWNvcmVcIl0uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBjb25zdCB0d2VldDogVHdlZXREYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgY29uc3QgcmVwbHkgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdXNlcm5hbWU6IHVzZXIuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICBlbWFpbDogdXNlci5lbWFpbCxcbiAgICAgICAgICAgIGF2YXRhcjogdXNlci5hdmF0YXIsXG4gICAgICAgICAgICB2ZXJpZmllZDogdXNlci52ZXJpZmllZCxcbiAgICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgICBhdHRhY2htZW50cyxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgbGlrZUNvdW50OiBbXSxcbiAgICAgICAgICAgIHJlcGxpZXNDb3VudDogW10sXG4gICAgICAgICAgICByZXR3ZWV0Q291bnQ6IFtdLFxuICAgICAgICAgICAgaXNSZXR3ZWV0OiBmYWxzZSxcbiAgICAgICAgICAgIG9yaWdpbmFsVHdlZXRJZDogdHdlZXRJZCxcbiAgICAgICAgICAgIGhhc2h0YWdzOiBjb250ZW50Lm1hdGNoKC8jXFx3Ky9nKSB8fCBbXSxcbiAgICAgICAgICAgIHBhcmVudFR3ZWV0SWQ6IG51bGxcbiAgICAgICAgfTtcbiAgICAgICAgdHdlZXQucmVwbGllc0NvdW50LnB1c2goY2l0aXplbklkKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgcmVwbHkpO1xuICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmVmcmVzaFJlcG9zdFwiLCAtMSwgSlNPTi5zdHJpbmdpZnkocmVwbHkpKTtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKGF3YWl0IFV0aWxzLkdldENpZEZyb21Ud2VldElkKHR3ZWV0LmVtYWlsKSk7XG4gICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlcy5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBSZXBseScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3VzZXIuZGlzcGxheU5hbWV9IGhhcyByZXBsaWVkIHRvIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAncGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl9ub3RpZmljYXRpb25zXCIsIHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGAke3VzZXIuZGlzcGxheU5hbWV9IGhhcyByZXBsaWVkIHRvIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgZW1haWw6IHR3ZWV0LmVtYWlsLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwicG9zdFwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUmVwbHkgUG9zdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IHJlcGxpZWQgdG8gdHdlZXQgKElEOiAke3R3ZWV0SWR9KSwgY29udGVudDogJHtjb250ZW50fWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbGlrZVR3ZWV0KF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgbGlrZSwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgaWYgKGxpa2UpIHtcbiAgICAgICAgICAgIHR3ZWV0Lmxpa2VDb3VudC5wdXNoKGVtYWlsKTtcbiAgICAgICAgICAgIGNvbnN0IGNpZCA9IGF3YWl0IFV0aWxzLkdldENpZEZyb21Ud2VldElkKHR3ZWV0LmVtYWlsKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaWQpO1xuICAgICAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlcy5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnTmV3IExpa2UnLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7ZW1haWx9IGhhcyBsaWtlZCB5b3VyIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGAke2VtYWlsfSBoYXMgbGlrZWQgeW91ciB0d2VldC5gLFxuICAgICAgICAgICAgICAgICAgICBlbWFpbDogdHdlZXQuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImxpa2VcIixcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgTGlrZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGxpa2VkIHR3ZWV0IChJRDogJHt0d2VldElkfSkuYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHR3ZWV0Lmxpa2VDb3VudCA9IHR3ZWV0Lmxpa2VDb3VudC5maWx0ZXIoKGw6IGFueSkgPT4gbCAhPT0gZW1haWwpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBMaWtlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gbGlrZWQgdHdlZXQgKElEOiAke3R3ZWV0SWR9KS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBsaWtlUmVwbGllc1R3ZWV0KF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgbGlrZSwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSByZXR1cm4gY29uc29sZS5sb2coXCJUd2VldCBub3QgZm91bmRcIik7XG4gICAgICAgIGlmIChsaWtlKSB7XG4gICAgICAgICAgICB0d2VldC5saWtlQ291bnQucHVzaChlbWFpbCk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1JlcGx5IExpa2VkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBsaWtlZCByZXBseSAoSUQ6ICR7dHdlZXRJZH0pLmAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0d2VldC5saWtlQ291bnQgPSB0d2VldC5saWtlQ291bnQuZmlsdGVyKChsOiBhbnkpID0+IGwgIT09IGVtYWlsKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUmVwbHkgVW5saWtlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gdW5saWtlZCByZXBseSAoSUQ6ICR7dHdlZXRJZH0pLmAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcmV0d2VldChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgcmV0d2VldCwgcGlnZW9uSWQsIG9nVHdlZXRJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0V2VldHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcGlnZW9uSWQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcmlnaW5hbFR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIk9yaWdpbmFsIHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50LnB1c2goY2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgb3JpZ2luYWxUd2VldCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCByZXR3ZWV0RGF0YTogVHdlZXREYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB1c2VybmFtZTogcmV0V2VldHVzZXIuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGVtYWlsOiByZXRXZWV0dXNlci5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgYXZhdGFyOiByZXRXZWV0dXNlci5hdmF0YXIsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiByZXRXZWV0dXNlci52ZXJpZmllZCxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogb3JpZ2luYWxUd2VldC5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50czogb3JpZ2luYWxUd2VldC5hdHRhY2htZW50cyxcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJlcGxpZXNDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJldHdlZXRDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIGlzUmV0d2VldDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiB0d2VldElkLFxuICAgICAgICAgICAgICAgICAgICBoYXNodGFnczogb3JpZ2luYWxUd2VldC5oYXNodGFncyxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VHdlZXRJZDogbnVsbCxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCByZXR3ZWV0RGF0YSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJlZnJlc2hUd2VldFwiLCAtMSwgSlNPTi5zdHJpbmdpZnkocmV0d2VldERhdGEpKTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgUmV0d2VldGVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtwaWdlb25JZH0gcmV0d2VldGVkIHR3ZWV0IChJRDogJHt0d2VldElkfSksIG9yaWdpbmFsIHR3ZWV0IElEOiAke29nVHdlZXRJZH0sIGNvbnRlbnQ6ICR7b3JpZ2luYWxUd2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbFR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb2dUd2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWxUd2VldCB8fCAhcmV0d2VldCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJPcmlnaW5hbCB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBvbmx5IGZpcnN0IG9jY3VycmVuY2Ugb2YgY2l0aXplbklkXG4gICAgICAgICAgICAgICAgbGV0IHJlbW92ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudCA9IG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50LmZpbHRlcigobDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsID09PSBjaXRpemVuSWQgJiYgIXJlbW92ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb2dUd2VldElkIH0sIG9yaWdpbmFsVHdlZXQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUmV0d2VldCBSZW1vdmVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgcmVtb3ZlZCByZXR3ZWV0IChJRDogJHt0d2VldElkfSkgb2Ygb3JpZ2luYWwgdHdlZXQgKElEOiAke29nVHdlZXRJZH0pLCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiByZXR3ZWV0OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcmV0d2VldFJlcGxpZXNUd2VldChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgcmV0d2VldCwgcGlnZW9uSWQsIG9nVHdlZXRJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvZ1R3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb3JpZ2luYWxUd2VldC5vcmlnaW5hbFR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0V2VldHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcGlnZW9uSWQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcmlnaW5hbFR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIk9yaWdpbmFsIHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50LnB1c2goY2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICBvZ1R3ZWV0LnJlcGxpZXNDb3VudC5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiBvcmlnaW5hbFR3ZWV0Lm9yaWdpbmFsVHdlZXRJZCB9LCBvZ1R3ZWV0KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9LCBvcmlnaW5hbFR3ZWV0KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHJldHdlZXREYXRhOiBUd2VldERhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIHVzZXJuYW1lOiByZXRXZWV0dXNlci5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZW1haWw6IHJldFdlZXR1c2VyLmVtYWlsLFxuICAgICAgICAgICAgICAgICAgICBhdmF0YXI6IHJldFdlZXR1c2VyLmF2YXRhcixcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHJldFdlZXR1c2VyLnZlcmlmaWVkLFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBvcmlnaW5hbFR3ZWV0LmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzOiBvcmlnaW5hbFR3ZWV0LmF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgbGlrZUNvdW50OiBbXSxcbiAgICAgICAgICAgICAgICAgICAgcmVwbGllc0NvdW50OiBbXSxcbiAgICAgICAgICAgICAgICAgICAgcmV0d2VldENvdW50OiBbXSxcbiAgICAgICAgICAgICAgICAgICAgaXNSZXR3ZWV0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0SWQ6IG9yaWdpbmFsVHdlZXQub3JpZ2luYWxUd2VldElkLFxuICAgICAgICAgICAgICAgICAgICBoYXNodGFnczogb3JpZ2luYWxUd2VldC5oYXNodGFncyxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VHdlZXRJZDogdHdlZXRJZCxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHJldHdlZXREYXRhKTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmVmcmVzaFJlcG9zdFwiLCAtMSwgSlNPTi5zdHJpbmdpZnkocmV0d2VldERhdGEpKTtcbiAgICAgICAgICAgICAgICBpZiAob2dUd2VldC5yZXBsaWVzQ291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdW5pcXVlQ2lkcyA9IFsuLi5uZXcgU2V0KG9nVHdlZXQucmVwbGllc0NvdW50KV07XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcmVwbHlDaWQgb2YgdW5pcXVlQ2lkcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKHJlcGx5Q2lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlcy5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBSZXBseScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3JldFdlZXR1c2VyLmRpc3BsYXlOYW1lfSBoYXMgcmVwbGllZCB0byB0d2VldC5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBge3JldFdlZXR1c2VyLmRpc3BsYXlOYW1lfSBoYXMgcmVwbGllZCB0byB0d2VldC5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtYWlsOiByZXRXZWV0dXNlci5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInBvc3RcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBSZXR3ZWV0ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke3BpZ2VvbklkfSByZXR3ZWV0ZWQgcmVwbHkgKElEOiAke3R3ZWV0SWR9KSwgb3JpZ2luYWwgdHdlZXQgSUQ6ICR7b2dUd2VldElkfSksIGNvbnRlbnQ6ICR7b3JpZ2luYWxUd2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbFR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiBvZ1R3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIW9yaWdpbmFsVHdlZXQgfHwgIXJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiT3JpZ2luYWwgdHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgb25seSBmaXJzdCBvY2N1cnJlbmNlIG9mIGNpdGl6ZW5JZFxuICAgICAgICAgICAgICAgIGxldCByZW1vdmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQgPSBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudC5maWx0ZXIoKGw6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobCA9PT0gY2l0aXplbklkICYmICFyZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IG9nVHdlZXRJZCB9LCBvcmlnaW5hbFR3ZWV0KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUmV0d2VldCBvZiBSZXBseSBSZW1vdmVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgcmVtb3ZlZCByZXR3ZWV0IChJRDogJHt0d2VldElkfSkgb2YgcmVwbHkgKElEOiAke29nVHdlZXRJZH0pLCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiByZXR3ZWV0OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGVsZXRlVHdlZXQoX2NsaWVudDogbnVtYmVyLCB0d2VldElkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBUd2VldCBub3QgZm91bmQgZm9yIGRlbGV0aW9uOiAke3R3ZWV0SWR9YCk7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBEZWxldGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBUd2VldCAoSUQ6ICR7dHdlZXRJZH0pIGRlbGV0ZWQgYnkgdXNlciAke3R3ZWV0LmVtYWlsfSwgY29udGVudDogJHt0d2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGVsZXRlUmVwbGllc1R3ZWV0KF9jbGllbnQ6IG51bWJlciwgdHdlZXRJZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBSZXBseSB0d2VldCBub3QgZm91bmQgZm9yIGRlbGV0aW9uOiAke3R3ZWV0SWR9YCk7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJSZXBseSB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1JlcGx5IERlbGV0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFJlcGx5IChJRDogJHt0d2VldElkfSkgZGVsZXRlZCwgY29udGVudDogJHt0d2VldC5jb250ZW50fSBieSB1c2VyICR7dHdlZXQuZW1haWx9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0UG9zdFJlcGxpZXMoX2NsaWVudDogbnVtYmVyLCB0d2VldElkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVwbGllcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBvcmlnaW5hbFR3ZWV0SWQ6IHR3ZWV0SWQgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVwbGllcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGluY3JlYXNlUmVwbGllc0NvdW50KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgdHdlZXQucmVwbGllc0NvdW50LnB1c2goYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCkpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBkZWNyZWFzZVJlcGxpZXNDb3VudChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgdHdlZXRJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IGNpZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICBpZiAoIXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgVHdlZXQgbm90IGZvdW5kIGZvciB0d2VldElkOiAke3R3ZWV0SWR9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IHJlbW92ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHR3ZWV0LnJlcGxpZXNDb3VudCA9IHR3ZWV0LnJlcGxpZXNDb3VudC5maWx0ZXIoKHI6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyID09PSBjaWQgJiYgIXJlbW92ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc3QgdXBkYXRlUmVzdWx0ID0gYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtcblxuICAgICAgICAgICAgaWYgKCF1cGRhdGVSZXN1bHQgfHwgdXBkYXRlUmVzdWx0Lm1vZGlmaWVkQ291bnQgPT09IDApIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYE5vIGNoYW5nZXMgbWFkZSB0byB0d2VldCAke3R3ZWV0SWR9IHJlcGxpZXNDb3VudGApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiBcIk5vIGNoYW5nZXMgbWFkZSB0byByZXBsaWVzIGNvdW50XCIgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coYFN1Y2Nlc3NmdWxseSBkZWNyZWFzZWQgcmVwbGllc0NvdW50IGZvciB0d2VldCAke3R3ZWV0SWR9YCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBkZWNyZWFzZVJlcGxpZXNDb3VudDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiwgZGV0YWlsczogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGZvbGxvd1VzZXIoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyB0YXJnZXRFbWFpbCwgY3VycmVudEVtYWlsLCBmb2xsb3cgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRVc2VyOiBUd2VldFByb2ZpbGVEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHRhcmdldEVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCF0YXJnZXRVc2VyKSByZXR1cm4geyBlcnJvcjogXCJUYXJnZXQgdXNlciBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50VXNlcjogVHdlZXRQcm9maWxlRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBjdXJyZW50RW1haWwgfSk7XG4gICAgICAgICAgICBpZiAoIWN1cnJlbnRVc2VyKSByZXR1cm4geyBlcnJvcjogXCJDdXJyZW50IHVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgaWYgKGZvbGxvdykge1xuICAgICAgICAgICAgICAgIGlmICghdGFyZ2V0VXNlci5mb2xsb3dlcnMuaW5jbHVkZXMoY3VycmVudEVtYWlsKSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRVc2VyLmZvbGxvd2Vycy5wdXNoKGN1cnJlbnRFbWFpbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghY3VycmVudFVzZXIuZm9sbG93aW5nLmluY2x1ZGVzKHRhcmdldEVtYWlsKSkge1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50VXNlci5mb2xsb3dpbmcucHVzaCh0YXJnZXRFbWFpbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdVc2VyIEZvbGxvd2VkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtjdXJyZW50RW1haWx9IGZvbGxvd2VkICR7dGFyZ2V0RW1haWx9LmAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0VXNlci5mb2xsb3dlcnMgPSB0YXJnZXRVc2VyLmZvbGxvd2Vycy5maWx0ZXIoZW1haWwgPT4gZW1haWwgIT09IGN1cnJlbnRFbWFpbCk7XG4gICAgICAgICAgICAgICAgY3VycmVudFVzZXIuZm9sbG93aW5nID0gY3VycmVudFVzZXIuZm9sbG93aW5nLmZpbHRlcihlbWFpbCA9PiBlbWFpbCAhPT0gdGFyZ2V0RW1haWwpO1xuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdVc2VyIFVuZm9sbG93ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2N1cnJlbnRFbWFpbH0gdW5mb2xsb3dlZCAke3RhcmdldEVtYWlsfS5gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHRhcmdldEVtYWlsIH0sIHRhcmdldFVzZXIpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogY3VycmVudEVtYWlsIH0sIGN1cnJlbnRVc2VyKTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGZvbGxvd1VzZXI6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHVwZGF0aW5nIGZvbGxvdyBzdGF0dXNcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldFVzZXJUd2VldHMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBlbWFpbCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRBbGxQb3N0UmVwbGllcyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgZW1haWw6IGVtYWlsIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldEFsbExpa2VkVHdlZXRzKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgbGlrZUNvdW50OiBlbWFpbCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzZWFyY2hVc2VycyhfY2xpZW50OiBudW1iZXIsIHZhbHVlOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHsgJHJlZ2V4OiB2YWx1ZSwgJG9wdGlvbnM6IFwiaVwiIH0gfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0Tm90aWZpY2F0aW9ucyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwgeyBlbWFpbCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBjaGFuZ2VQYXNzd29yZChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGlmICghdXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuICAgICAgICBjb25zdCBvbGRQYXNzd29yZCA9IHVzZXIucGFzc3dvcmQ7XG4gICAgICAgIHVzZXIucGFzc3dvcmQgPSBwYXNzd29yZDtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9LCB1c2VyKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUGFzc3dvcmQgQ2hhbmdlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBjaGFuZ2VkIHRoZWlyIHBhc3N3b3JkLCBvbGQgcGFzc3dvcmQ6ICR7b2xkUGFzc3dvcmR9LCBuZXcgcGFzc3dvcmQ6ICR7cGFzc3dvcmR9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBwdWJsaWMgYXN5bmMgdXBkYXRlUHJvZmlsZShfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHBhcnNlZERhdGE6IFR3ZWV0UHJvZmlsZURhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBvbGRVc2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHBhcnNlZERhdGEuZW1haWwgfSk7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBwYXJzZWREYXRhLmVtYWlsIH0sIHBhcnNlZERhdGEpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdQcm9maWxlIFVwZGF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtwYXJzZWREYXRhLmVtYWlsfSB1cGRhdGVkIHRoZWlyIHByb2ZpbGUsIG9sZCBkYXRhOiAke0pTT04uc3RyaW5naWZ5KG9sZFVzZXIpfSwgbmV3IGRhdGE6ICR7SlNPTi5zdHJpbmdpZnkocGFyc2VkRGF0YSl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBcInN1Y2Nlc3NcIjtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgdmVyaWZ5VXNlcihfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGlmICghdXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuICAgICAgICB1c2VyLnZlcmlmaWVkID0gdHJ1ZTtcbiAgICAgICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSwgdXNlcik7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1VzZXIgVmVyaWZpZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gaGFzIGJlZW4gdmVyaWZpZWQuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIFByaXZhdGUgTWVzc2FnaW5nIEZ1bmN0aW9uc1xuICAgIHB1YmxpYyBhc3luYyBzZW5kUHJpdmF0ZU1lc3NhZ2UoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBzZW5kZXJFbWFpbCwgcmVjaXBpZW50RW1haWwsIGNvbnRlbnQsIGF0dGFjaG1lbnRzID0gW10gfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgICAgIC8vIFZlcmlmeSBib3RoIHVzZXJzIGV4aXN0XG4gICAgICAgICAgICBjb25zdCBzZW5kZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogc2VuZGVyRW1haWwgfSk7XG4gICAgICAgICAgICBjb25zdCByZWNpcGllbnQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcmVjaXBpZW50RW1haWwgfSk7XG5cbiAgICAgICAgICAgIGlmICghc2VuZGVyIHx8ICFyZWNpcGllbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBzZW5kZXJFbWFpbCxcbiAgICAgICAgICAgICAgICByZWNpcGllbnRFbWFpbCxcbiAgICAgICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRlbGV0ZWRCeVNlbmRlcjogZmFsc2UsXG4gICAgICAgICAgICAgICAgZGVsZXRlZEJ5UmVjaXBpZW50OiBmYWxzZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCBtZXNzYWdlKTtcblxuICAgICAgICAgICAgLy8gR2V0IGFsbCBDaXRpemVuIElEcyBmb3IgYm90aCBzZW5kZXIgYW5kIHJlY2lwaWVudCAobXVsdGlwbGUgZGV2aWNlcyBzdXBwb3J0KVxuICAgICAgICAgICAgY29uc3Qgc2VuZGVyQ2lkcyA9IGF3YWl0IFV0aWxzLkdldENpZHNGcm9tUGlnZW9uRW1haWwoc2VuZGVyRW1haWwpO1xuICAgICAgICAgICAgY29uc3QgcmVjaXBpZW50Q2lkcyA9IGF3YWl0IFV0aWxzLkdldENpZHNGcm9tUGlnZW9uRW1haWwocmVjaXBpZW50RW1haWwpO1xuXG4gICAgICAgICAgICAvLyBTZW5kIG5vdGlmaWNhdGlvbnMgYW5kIHJlZnJlc2ggZXZlbnRzIHRvIGFsbCByZWNpcGllbnQgZGV2aWNlc1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWNpcGllbnRDaWQgb2YgcmVjaXBpZW50Q2lkcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlY2lwaWVudFBsYXllciA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZWNpcGllbnRDaWQpO1xuICAgICAgICAgICAgICAgIGlmIChyZWNpcGllbnRQbGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgcmVjaXBpZW50UGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IHJlY2VpdmVkIGEgbWVzc2FnZSBmcm9tICR7c2VuZGVyLmRpc3BsYXlOYW1lfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBOVUkgZXZlbnQgdG8gcmVmcmVzaCBjaGF0IGlmIHJlY2lwaWVudCBpcyBpbiBjaGF0XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOnJlZnJlc2hQcml2YXRlTWVzc2FnZScsIHJlY2lwaWVudFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlckVtYWlsOiBzZW5kZXJFbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlY2lwaWVudEVtYWlsOiByZWNpcGllbnRFbWFpbFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTZW5kIHJlZnJlc2ggZXZlbnQgdG8gYWxsIHNlbmRlciBkZXZpY2VzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHNlbmRlckNpZCBvZiBzZW5kZXJDaWRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2VuZGVyUGxheWVyID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKHNlbmRlckNpZCk7XG4gICAgICAgICAgICAgICAgaWYgKHNlbmRlclBsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTpyZWZyZXNoUHJpdmF0ZU1lc3NhZ2UnLCBzZW5kZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXJFbWFpbDogc2VuZGVyRW1haWwsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWNpcGllbnRFbWFpbDogcmVjaXBpZW50RW1haWxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcml2YXRlIE1lc3NhZ2UgU2VudCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7c2VuZGVyRW1haWx9IHNlbnQgYSBwcml2YXRlIG1lc3NhZ2UgdG8gJHtyZWNpcGllbnRFbWFpbH1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlSWQ6IG1lc3NhZ2UuX2lkIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gc2VuZFByaXZhdGVNZXNzYWdlOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBzZW5kaW5nIG1lc3NhZ2VcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldFByaXZhdGVNZXNzYWdlcyhfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHVzZXJFbWFpbCwgb3RoZXJVc2VyRW1haWwsIGxpbWl0ID0gNTAsIG9mZnNldCA9IDAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgeyBzZW5kZXJFbWFpbDogdXNlckVtYWlsLCByZWNpcGllbnRFbWFpbDogb3RoZXJVc2VyRW1haWwgfSxcbiAgICAgICAgICAgICAgICAgICAgeyBzZW5kZXJFbWFpbDogb3RoZXJVc2VyRW1haWwsIHJlY2lwaWVudEVtYWlsOiB1c2VyRW1haWwgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgJGFuZDogW1xuICAgICAgICAgICAgICAgICAgICB7IGRlbGV0ZWRCeVNlbmRlcjogeyAkbmU6IHRydWUgfSB9LFxuICAgICAgICAgICAgICAgICAgICB7IGRlbGV0ZWRCeVJlY2lwaWVudDogeyAkbmU6IHRydWUgfSB9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfSxcbiAgICAgICAgICAgICAgICBza2lwOiBvZmZzZXQsXG4gICAgICAgICAgICAgICAgbGltaXQ6IGxpbWl0XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG1lc3NhZ2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBnZXRQcml2YXRlTWVzc2FnZXM6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIG1lc3NhZ2VzXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRDb252ZXJzYXRpb25zKF9jbGllbnQ6IG51bWJlciwgdXNlckVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gR2V0IGFsbCB1bmlxdWUgY29udmVyc2F0aW9ucyBmb3IgdGhlIHVzZXJcbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbnMgPSBhd2FpdCBNb25nb0RCLmFnZ3JlZ2F0ZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRtYXRjaDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJG9yOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBzZW5kZXJFbWFpbDogdXNlckVtYWlsIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyByZWNpcGllbnRFbWFpbDogdXNlckVtYWlsIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAkYW5kOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBkZWxldGVkQnlTZW5kZXI6IHsgJG5lOiB0cnVlIH0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGRlbGV0ZWRCeVJlY2lwaWVudDogeyAkbmU6IHRydWUgfSB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRncm91cDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJGNvbmQ6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAkZXE6IFtcIiRzZW5kZXJFbWFpbFwiLCB1c2VyRW1haWxdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiJHJlY2lwaWVudEVtYWlsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiJHNlbmRlckVtYWlsXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IHsgJGZpcnN0OiBcIiQkUk9PVFwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnJlYWRDb3VudDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICRzdW06IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJGNvbmQ6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgJGFuZDogW3sgJGVxOiBbXCIkcmVjaXBpZW50RW1haWxcIiwgdXNlckVtYWlsXSB9LCB7ICRlcTogW1wiJHJlYWRcIiwgZmFsc2VdIH1dIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRsb29rdXA6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyb206IFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhbEZpZWxkOiBcIl9pZFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yZWlnbkZpZWxkOiBcImVtYWlsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhczogXCJ1c2VySW5mb1wiXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJHVud2luZDogXCIkdXNlckluZm9cIlxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkcHJvamVjdDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3RoZXJVc2VyOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1haWw6IFwiJHVzZXJJbmZvLmVtYWlsXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheU5hbWU6IFwiJHVzZXJJbmZvLmRpc3BsYXlOYW1lXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXZhdGFyOiBcIiR1c2VySW5mby5hdmF0YXJcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZDogXCIkdXNlckluZm8udmVyaWZpZWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IDFcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkc29ydDogeyBcImxhc3RNZXNzYWdlLmNyZWF0ZWRBdFwiOiAtMSB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXSk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShjb252ZXJzYXRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBnZXRDb252ZXJzYXRpb25zOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBjb252ZXJzYXRpb25zXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBtYXJrTWVzc2FnZUFzUmVhZChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IG1lc3NhZ2VJZCwgdXNlckVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgeyBfaWQ6IG1lc3NhZ2VJZCB9KTtcbiAgICAgICAgICAgIGlmICghbWVzc2FnZSkgcmV0dXJuIHsgZXJyb3I6IFwiTWVzc2FnZSBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICAvLyBPbmx5IG1hcmsgYXMgcmVhZCBpZiB0aGUgdXNlciBpcyB0aGUgcmVjaXBpZW50XG4gICAgICAgICAgICBpZiAobWVzc2FnZS5yZWNpcGllbnRFbWFpbCA9PT0gdXNlckVtYWlsKSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZS5yZWFkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHsgX2lkOiBtZXNzYWdlSWQgfSwgbWVzc2FnZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBtYXJrTWVzc2FnZUFzUmVhZDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgbWFya2luZyBtZXNzYWdlIGFzIHJlYWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGRlbGV0ZU1lc3NhZ2UoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBtZXNzYWdlSWQsIHVzZXJFbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHsgX2lkOiBtZXNzYWdlSWQgfSk7XG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UpIHJldHVybiB7IGVycm9yOiBcIk1lc3NhZ2Ugbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgLy8gTWFyayBhcyBkZWxldGVkIGJ5IHRoZSBhcHByb3ByaWF0ZSB1c2VyXG4gICAgICAgICAgICBpZiAobWVzc2FnZS5zZW5kZXJFbWFpbCA9PT0gdXNlckVtYWlsKSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZS5kZWxldGVkQnlTZW5kZXIgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChtZXNzYWdlLnJlY2lwaWVudEVtYWlsID09PSB1c2VyRW1haWwpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlLmRlbGV0ZWRCeVJlY2lwaWVudCA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIlVuYXV0aG9yaXplZFwiIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgeyBfaWQ6IG1lc3NhZ2VJZCB9LCBtZXNzYWdlKTtcblxuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNZXNzYWdlIERlbGV0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7dXNlckVtYWlsfSBkZWxldGVkIGEgcHJpdmF0ZSBtZXNzYWdlYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGRlbGV0ZU1lc3NhZ2U6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGRlbGV0aW5nIG1lc3NhZ2VcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gRW5oYW5jZWQgRm9sbG93ZXJzL0ZvbGxvd2luZyBGdW5jdGlvbnNcbiAgICBwdWJsaWMgYXN5bmMgZ2V0Rm9sbG93ZXJzKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgICAgICBpZiAoIXVzZXIpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgY29uc3QgZm9sbG93ZXJzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLFxuICAgICAgICAgICAgICAgIHsgZW1haWw6IHsgJGluOiB1c2VyLmZvbGxvd2VycyB9IH0sXG4gICAgICAgICAgICAgICAgbnVsbCwgZmFsc2UsXG4gICAgICAgICAgICAgICAgeyBzb3J0OiB7IGRpc3BsYXlOYW1lOiAxIH0gfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGZvbGxvd2Vycyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0Rm9sbG93ZXJzOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBmb2xsb3dlcnNcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldEZvbGxvd2luZyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGNvbnN0IGZvbGxvd2luZyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdXNlcnNcIixcbiAgICAgICAgICAgICAgICB7IGVtYWlsOiB7ICRpbjogdXNlci5mb2xsb3dpbmcgfSB9LFxuICAgICAgICAgICAgICAgIG51bGwsIGZhbHNlLFxuICAgICAgICAgICAgICAgIHsgc29ydDogeyBkaXNwbGF5TmFtZTogMSB9IH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShmb2xsb3dpbmcpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldEZvbGxvd2luZzpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgZm9sbG93aW5nXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuXG5leHBvcnQgY29uc3QgcGlnZW9uU2VydmljZSA9IG5ldyBQaWdlb25TZXJ2aWNlKCk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBwaWdlb25TZXJ2aWNlIH0gZnJvbSBcIi4vUGlnZW9uU2VydmljZVwiO1xuXG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnNlYXJjaFVzZXJzXCIsIHBpZ2VvblNlcnZpY2Uuc2VhcmNoVXNlckV4aXN0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246bG9naW5cIiwgcGlnZW9uU2VydmljZS5sb2dpbik7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnNpZ251cFwiLCBwaWdlb25TZXJ2aWNlLnNpZ251cCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnRvZ2dsZU5vdGlmaWNhdGlvbnNcIiwgcGlnZW9uU2VydmljZS50b2dnbGVOb3RpZmljYXRpb25zKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cG9zdFR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UucG9zdFR3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Z2V0UHJvZmlsZVwiLCBwaWdlb25TZXJ2aWNlLmdldFByb2ZpbGUpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpnZXRBbGxGZWVkXCIsIHBpZ2VvblNlcnZpY2UuZ2V0QWxsRmVlZCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmxpa2VUd2VldFwiLCBwaWdlb25TZXJ2aWNlLmxpa2VUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJldHdlZXRUd2VldFwiLCBwaWdlb25TZXJ2aWNlLnJldHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpkZWxldGVUd2VldFwiLCBwaWdlb25TZXJ2aWNlLmRlbGV0ZVR3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cG9zdFJlcGx5XCIsIHBpZ2VvblNlcnZpY2UucG9zdFJlcGx5KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Z2V0UmVwbGllc1wiLCBwaWdlb25TZXJ2aWNlLmdldFBvc3RSZXBsaWVzKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246bGlrZVJlcG9zdFR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UubGlrZVJlcGxpZXNUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJldHdlZXRSZXBvc3RUd2VldFwiLCBwaWdlb25TZXJ2aWNlLnJldHdlZXRSZXBsaWVzVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjppbmNyZWFzZVJlcGxpZXNDb3VudFwiLCBwaWdlb25TZXJ2aWNlLmluY3JlYXNlUmVwbGllc0NvdW50KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246ZGVjcmVhc2VSZXBsaWVzQ291bnRcIiwgcGlnZW9uU2VydmljZS5kZWNyZWFzZVJlcGxpZXNDb3VudCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmRlbGV0ZVJlcGxpZXNUd2VldFwiLCBwaWdlb25TZXJ2aWNlLmRlbGV0ZVJlcGxpZXNUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmZvbGxvd1VzZXJcIiwgcGlnZW9uU2VydmljZS5mb2xsb3dVc2VyKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Z2V0VXNlclR3ZWV0c1wiLCBwaWdlb25TZXJ2aWNlLmdldFVzZXJUd2VldHMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldEFsbFBvc3RSZXBsaWVzJywgcGlnZW9uU2VydmljZS5nZXRBbGxQb3N0UmVwbGllcyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0QWxsTGlrZWRUd2VldHMnLCBwaWdlb25TZXJ2aWNlLmdldEFsbExpa2VkVHdlZXRzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpzZWFyY2hVc2Vyc1gnLCBwaWdlb25TZXJ2aWNlLnNlYXJjaFVzZXJzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXROb3RpZmljYXRpb25zJywgcGlnZW9uU2VydmljZS5nZXROb3RpZmljYXRpb25zKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpjaGFuZ2VQYXNzd29yZCcsIHBpZ2VvblNlcnZpY2UuY2hhbmdlUGFzc3dvcmQpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOnVwZGF0ZVByb2ZpbGUnLCBwaWdlb25TZXJ2aWNlLnVwZGF0ZVByb2ZpbGUpO1xuXG4vLyBQcml2YXRlIE1lc3NhZ2luZyBDYWxsYmFja3Ncbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpzZW5kUHJpdmF0ZU1lc3NhZ2UnLCBwaWdlb25TZXJ2aWNlLnNlbmRQcml2YXRlTWVzc2FnZSk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0UHJpdmF0ZU1lc3NhZ2VzJywgcGlnZW9uU2VydmljZS5nZXRQcml2YXRlTWVzc2FnZXMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldENvbnZlcnNhdGlvbnMnLCAoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIHJldHVybiBwaWdlb25TZXJ2aWNlLmdldENvbnZlcnNhdGlvbnMoY2xpZW50LCBkYXRhKTtcbn0pO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOm1hcmtNZXNzYWdlQXNSZWFkJywgcGlnZW9uU2VydmljZS5tYXJrTWVzc2FnZUFzUmVhZCk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246ZGVsZXRlTWVzc2FnZScsIHBpZ2VvblNlcnZpY2UuZGVsZXRlTWVzc2FnZSk7XG5cbi8vIEVuaGFuY2VkIEZvbGxvd2Vycy9Gb2xsb3dpbmcgQ2FsbGJhY2tzXG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0Rm9sbG93ZXJzJywgcGlnZW9uU2VydmljZS5nZXRGb2xsb3dlcnMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldEZvbGxvd2luZycsIHBpZ2VvblNlcnZpY2UuZ2V0Rm9sbG93aW5nKTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRPd25lZEhvdXNlcycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgYXBhcnRtZW50cyA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgcHJvcGVydHlfaWQsIG93bmVyX2NpdGl6ZW5pZCwgc3RyZWV0LCBkZXNjcmlwdGlvbiwgaGFzX2FjY2VzcywgZG9vcl9kYXRhLCBhcGFydG1lbnQgIEZST00gcHJvcGVydGllcyBXSEVSRSBvd25lcl9jaXRpemVuaWQgPSA/IEFORCBhcGFydG1lbnQgSVMgTk9UIE5VTEwgQU5EIGFwYXJ0bWVudCA8PiBcIlwiJywgW3BsYXllcl0pO1xuICAgIGNvbnN0IGhvdXNlcyA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgcHJvcGVydHlfaWQsIG93bmVyX2NpdGl6ZW5pZCwgc3RyZWV0LCBkZXNjcmlwdGlvbiwgaGFzX2FjY2Vzcywgc2hlbGwsIGRvb3JfZGF0YSBGUk9NIHByb3BlcnRpZXMgV0hFUkUgb3duZXJfY2l0aXplbmlkID0gPyBBTkQgYXBhcnRtZW50IElTIE5VTEwnLCBbcGxheWVyXSk7XG4gICAgY29uc3QgcmVzID0ge1xuICAgICAgICBhcGFydG1lbnRzOiBhcGFydG1lbnRzLFxuICAgICAgICBob3VzZXM6IGhvdXNlc1xuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRLZXlIb2xkZXJOYW1lcycsIGFzeW5jIChjbGllbnQsIGRhdGEpID0+IHtcbiAgICBjb25zdCByZXMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGxldCBuYW1lTWFwOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG5cbiAgICBpZiAocmVzICYmIHJlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIFByb2Nlc3MgYWxsIGhvdXNlcyBpbiBwYXJhbGxlbFxuICAgICAgICBjb25zdCBhcGFydG1lbnRQcm9taXNlcyA9IHJlcy5tYXAoKGhvdXNlOiBzdHJpbmcpID0+XG4gICAgICAgICAgICBVdGlscy5xdWVyeSgnU0VMRUNUIGNpdGl6ZW5pZCwgY2hhcmluZm8gRlJPTSBwbGF5ZXJzIFdIRVJFIGNpdGl6ZW5pZCA9ID8nLCBbaG91c2VdKVxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGFsbEFwYXJ0bWVudHMgPSBhd2FpdCBQcm9taXNlLmFsbChhcGFydG1lbnRQcm9taXNlcyk7XG5cbiAgICAgICAgYWxsQXBhcnRtZW50cy5mb3JFYWNoKGFwYXJ0bWVudHMgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYXBhcnRtZW50cyk7XG4gICAgICAgICAgICBpZiAoYXBhcnRtZW50cyAmJiBhcGFydG1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBhcGFydG1lbnRzLmZvckVhY2goKGFwYXJ0bWVudDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoYXJpbmZvID0gSlNPTi5wYXJzZShhcGFydG1lbnQuY2hhcmluZm8pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdWxsTmFtZSA9IGAke2NoYXJpbmZvLmZpcnN0bmFtZX0gJHtjaGFyaW5mby5sYXN0bmFtZX1gO1xuICAgICAgICAgICAgICAgICAgICBuYW1lTWFwW2FwYXJ0bWVudC5jaXRpemVuaWRdID0gZnVsbE5hbWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShuYW1lTWFwKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdyZW1vdmVBY2Nlc3MnLCBhc3luYyAoY2xpZW50LCBkYXRhKSA9PiB7XG4gICAgY29uc3QgeyBpZCwgY2lkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGhvdXNlOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUICogRlJPTSBwcm9wZXJ0aWVzIFdIRVJFIHByb3BlcnR5X2lkID0gPycsIFtpZF0pO1xuICAgIGlmIChob3VzZSAmJiBob3VzZS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGhvdXNlRGF0YSA9IGhvdXNlWzBdO1xuICAgICAgICBjb25zdCBoYXNBY2Nlc3MgPSBKU09OLnBhcnNlKGhvdXNlRGF0YS5oYXNfYWNjZXNzKTtcbiAgICAgICAgY29uc3QgbmV3QWNjZXNzID0gaGFzQWNjZXNzLmZpbHRlcigoYWNjZXNzOiBzdHJpbmcpID0+IGFjY2VzcyAhPT0gY2lkKTtcbiAgICAgICAgY29uc29sZS5sb2cobmV3QWNjZXNzKTtcbiAgICAgICAgYXdhaXQgVXRpbHMucXVlcnkoJ1VQREFURSBwcm9wZXJ0aWVzIFNFVCBoYXNfYWNjZXNzID0gPyBXSEVSRSBwcm9wZXJ0eV9pZCA9ID8nLCBbSlNPTi5zdHJpbmdpZnkobmV3QWNjZXNzKSwgaWRdKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcHJvcGVydGllcycsXG4gICAgICAgICAgICB0aXRsZTogJ0FjY2VzcyBSZW1vdmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBY2Nlc3MgcmVtb3ZlZCBmcm9tICR7Y2lkfSB0byAke2hvdXNlRGF0YS5zdHJlZXR9LCAke2hvdXNlRGF0YS5wcm9wZXJ0eV9pZH0gYnkgJHthd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2xpZW50KSl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2ssIHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOmNyZWF0ZVBvc3QnLCBhc3luYyAoc291cmNlLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHRpdGxlLCBjb250ZW50LCBpbWFnZUF0dGFjaG1lbnQsIHBob25lTnVtYmVyLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBkYXRhWCA9IHtcbiAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGUsXG4gICAgICAgIGNvbnRlbnQsXG4gICAgICAgIGltYWdlQXR0YWNobWVudCxcbiAgICAgICAgcGhvbmVOdW1iZXIsXG4gICAgICAgIGVtYWlsLFxuICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgIH07XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JsdWVwYWdlcycsIGRhdGFYKTtcbiAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOnJlZnJlc2hQb3N0cycsIC0xLCBKU09OLnN0cmluZ2lmeShkYXRhWCkpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYmx1ZXBhZ2VzJyxcbiAgICAgICAgdGl0bGU6ICdQb3N0IENyZWF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgUG9zdCAnJHt0aXRsZX0nIChJRDogJHtkYXRhWC5faWR9KSBjcmVhdGVkIGJ5ICR7cGhvbmVOdW1iZXIgfHwgZW1haWx9LCBjb250ZW50OiAke2NvbnRlbnR9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOmdldFBvc3RzJywgYXN5bmMgKHNvdXJjZSkgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2JsdWVwYWdlcycsIHt9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOmRlbGV0ZVBvc3QnLCBhc3luYyAoc291cmNlLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwb3N0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9ibHVlcGFnZXMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfYmx1ZXBhZ2VzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpyZWZyZXNoRGVsZXRlUG9zdCcsIC0xLCBkYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2JsdWVwYWdlcycsXG4gICAgICAgIHRpdGxlOiAnUG9zdCBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBvc3QgJyR7cG9zdC50aXRsZX0nIChJRDogJHtkYXRhfSkgZGVsZXRlZCBieSAke3Bvc3QucGhvbmVOdW1iZXIgfHwgcG9zdC5lbWFpbH0sIGNvbnRlbnQ6ICR7cG9zdC5jb250ZW50fWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrLCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZyYW1ld29yayB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IEdhcmFnZURhdGEgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcblxuaW50ZXJmYWNlIFZlaGljbGVEYXRhIHtcbiAgICB2ZWhpY2xlOiBzdHJpbmc7XG4gICAgcGxhdGU6IHN0cmluZztcbiAgICBnYXJhZ2U6IHN0cmluZztcbiAgICBtb2RzOiBzdHJpbmc7XG4gICAgc3RhdGU6IG51bWJlcjtcbiAgICBkZXBvdHByaWNlOiBzdHJpbmc7XG59XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dhcmFnZTpnZXRHYXJhZ2VEYXRhJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgbGV0IHJlc0RhdGE6IEdhcmFnZURhdGFbXSA9IFtdO1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBVdGlscy5xdWVyeShgU0VMRUNUIHZlaGljbGUscGxhdGUsZ2FyYWdlLG1vZHMsc3RhdGUsZGVwb3RwcmljZSBGUk9NIHBsYXllcl92ZWhpY2xlcyBXSEVSRSBjaXRpemVuaWQgPSA/YCwgW2NpdGl6ZW5JZF0pIGFzIFZlaGljbGVEYXRhW107XG4gICAgY29uc3QgdmVoaWNsZURhdGEgPSBGcmFtZXdvcmsuU2hhcmVkLlZlaGljbGVzO1xuICAgIFxuICAgIGZvciAoY29uc3QgdmVoaWNsZSBvZiByZXMpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IHZlaGljbGVEYXRhW3ZlaGljbGUudmVoaWNsZV07XG4gICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgdmVoaWNsZSBzdGF0ZSB3aXRoIGJldHRlciBsb2dpY1xuICAgICAgICAgICAgbGV0IHN0YXRlOiBzdHJpbmc7XG4gICAgICAgICAgICBpZiAodmVoaWNsZS5zdGF0ZSA9PT0gMikge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gXCJJbXBvdW5kZWRcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodmVoaWNsZS5zdGF0ZSA9PT0gMSkge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gXCJQYXJrZWRcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoTnVtYmVyKHZlaGljbGUuZGVwb3RwcmljZSkgPiAwKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBcIkRlcG90XCI7IC8vIENoYW5nZWQgZnJvbSBcIkRlcG90ZWRcIiB0byBcIkRlcG90XCIgYXMgcmVxdWVzdGVkXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gXCJPdXRcIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICBwbGF0ZTogdmVoaWNsZS5wbGF0ZSxcbiAgICAgICAgICAgICAgICBnYXJhZ2U6IHZlaGljbGUuZ2FyYWdlLFxuICAgICAgICAgICAgICAgIHN0YXRlOiBzdGF0ZSxcbiAgICAgICAgICAgICAgICBjYXRlZ29yeTogZGF0YS5jYXRlZ29yeSxcbiAgICAgICAgICAgICAgICBicmFuZDogZGF0YS5icmFuZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBkYXRhLm5hbWUsXG4gICAgICAgICAgICAgICAgdHVyYm9JbnN0YWxsZWQ6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RUdXJibyxcbiAgICAgICAgICAgICAgICBib2R5SGVhbHRoOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykuYm9keUhlYWx0aCxcbiAgICAgICAgICAgICAgICB0YW5rSGVhbHRoOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykudGFua0hlYWx0aCxcbiAgICAgICAgICAgICAgICBmdWVsTGV2ZWw6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5mdWVsTGV2ZWwsXG4gICAgICAgICAgICAgICAgZW5naW5lSGVhbHRoOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykuZW5naW5lSGVhbHRoLFxuICAgICAgICAgICAgICAgIG1vZFN1c3BlbnNpb246IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RTdXNwZW5zaW9uLFxuICAgICAgICAgICAgICAgIG1vZFRyYW5zbWlzc2lvbjogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZFRyYW5zbWlzc2lvbixcbiAgICAgICAgICAgICAgICBtb2RFbmdpbmU6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RFbmdpbmUsXG4gICAgICAgICAgICAgICAgbW9kQnJha2VzOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kQnJha2VzLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzRGF0YSk7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTG9nZ2VyLCBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFdhbGxldEFjY291bnQgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IERhdGVUaW1lIH0gZnJvbSAnbHV4b24nO1xuXG5mdW5jdGlvbiBHZW5lcmF0ZUNhcmROdW1iZXIoKSB7XG4gICAgbGV0IGNhcmROdW1iZXIgPSAnJztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcbiAgICAgICAgY2FyZE51bWJlciArPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMCk7XG4gICAgfVxuICAgIHJldHVybiBjYXJkTnVtYmVyO1xufVxuXG5mdW5jdGlvbiBHZW5lcmF0ZUJhbmtBY2NvdW50TnVtYmVyKCkge1xuICAgIGNvbnN0IGluaXRpYWxzID0gXCJTTVJUXCI7XG4gICAgbGV0IGFjY291bnROdW1iZXIgPSAnJztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgYWNjb3VudE51bWJlciArPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMCk7XG4gICAgfVxuICAgIHJldHVybiBgJHtpbml0aWFsc31fJHthY2NvdW50TnVtYmVyfWA7XG59XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpsb2dpbicsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIoc291cmNlKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2JhbmtfdXNlcicsIHsgY2l0aXplbklkOiBjaXRpemVuSWQuUGxheWVyRGF0YS5jaXRpemVuaWQgfSk7XG4gICAgaWYgKHJlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgLi4ucmVzLFxuICAgICAgICAgICAgYmFsYW5jZTogYXdhaXQgY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuYmFua1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuYW1lID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlKTtcbiAgICAgICAgY29uc3QgY2FyZE51bWJlciA9IEdlbmVyYXRlQ2FyZE51bWJlcigpO1xuICAgICAgICBjb25zdCBjYXJkUGluID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDApO1xuICAgICAgICBjb25zdCBiYW5rQWNjb3VudCA9IEdlbmVyYXRlQmFua0FjY291bnROdW1iZXIoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICBjYXJkTnVtYmVyOiBjYXJkTnVtYmVyLFxuICAgICAgICAgICAgY2FyZFBpbjogY2FyZFBpbixcbiAgICAgICAgICAgIGJhbmtBY2NvdW50OiBiYW5rQWNjb3VudCxcbiAgICAgICAgICAgIGJhbGFuY2U6IDBcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmFua191c2VyJywgZGF0YSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgICAgYmFsYW5jZTogY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuYmFua1xuICAgICAgICB9KTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0RGV0YWlsc1hTJywgYXN5bmMgKGNsaWVudCwgbnVtYmVyKSA9PiB7XG4gICAgbGV0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIoU3RyaW5nKG51bWJlcikpO1xuICAgIGlmIChjaXRpemVuSWQpIHtcbiAgICAgICAgY29uc3QgcmVzOiBXYWxsZXRBY2NvdW50ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9iYW5rX3VzZXInLCB7IGNpdGl6ZW5JZDogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAocmVzKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzLmJhbmtBY2NvdW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3RyYW5zWEFkcWFzZGRhc2RmZXJNb25leScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgYW1vdW50LCB0byB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXM6IFdhbGxldEFjY291bnQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2JhbmtfdXNlcicsIHsgYmFua0FjY291bnQ6IHRvIH0pO1xuICAgIGlmICghcmVzKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckJ5Q2l0aXplbklkKHJlcy5jaXRpemVuSWQpO1xuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIoY2xpZW50KTtcbiAgICBpZiAoIWF3YWl0IERvZXNQbGF5ZXJFeGlzdCh0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UpKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLm1vbmV5LmJhbmsgPCBhbW91bnQpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoYXdhaXQgc291cmNlUGxheWVyLkZ1bmN0aW9ucy5SZW1vdmVNb25leSgnYmFuaycsIGFtb3VudCkpIHtcbiAgICAgICAgdGFyZ2V0UGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGFtb3VudCk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdXYWxsZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSB0cmFuc2ZlcnJlZCAkJHthbW91bnR9IHRvICR7cmVzLm5hbWV9LmAsXG4gICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogJ1dhbGxldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIHJlY2VpdmVkICQke2Ftb3VudH0gZnJvbSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogJ3NldHRpbmdzJyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgfSkpO1xuXG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9iYW5rX3RyYW5zYWN0aW9ucycsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBmcm9tOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICB0bzogcmVzLmNpdGl6ZW5JZCxcbiAgICAgICAgICAgIGFtb3VudDogYW1vdW50LFxuICAgICAgICAgICAgdHlwZTogJ2RlYml0JyxcbiAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JhbmtfdHJhbnNhY3Rpb25zJywge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHJlcy5jaXRpemVuSWQsXG4gICAgICAgICAgICB0bzogc291cmNlUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgYW1vdW50OiBhbW91bnQsXG4gICAgICAgICAgICB0eXBlOiAnY3JlZGl0JyxcbiAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYmFua190cmFuc2FjdGlvbnMnLFxuICAgICAgICAgICAgdGl0bGU6ICdNb25leSBUcmFuc2ZlcicsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhhcyB0cmFuc2ZlcnJlZCAkJHthbW91bnR9IHRvICR7cmVzLm5hbWV9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldFRyYW5zYWN0aW9ucycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCB0cmFuc2FjdGlvbnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9iYW5rX3RyYW5zYWN0aW9ucycsIHsgZnJvbTogY2l0aXplbklkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgIHNvcnQ6IHsgZGF0ZTogLTEgfVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0cmFuc2FjdGlvbnMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpjcmVhdGVJbnZvaWNlJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBkZXNjcmlwdGlvbiwgYW1vdW50LCBwYXltZW50VGltZSwgbnVtYmVyT2ZQYXltZW50cywgaXNCdXNpbmVzcywgcmVjZWl2ZXIsIH0gPSBKU09OLnBhcnNlKGRhdGEpIGFzIHtcbiAgICAgICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICAgICAgYW1vdW50OiBudW1iZXI7XG4gICAgICAgIHBheW1lbnRUaW1lOiBudW1iZXI7XG4gICAgICAgIG51bWJlck9mUGF5bWVudHM6IG51bWJlcjtcbiAgICAgICAgaXNCdXNpbmVzczogJ05vJyB8ICdZZXMnO1xuICAgICAgICByZWNlaXZlcjogc3RyaW5nO1xuICAgIH07IC8vIHBheW1lbnRUaW1lID0gMCBmb3IgZGFpbHksIDEgZm9yIHdlZWtseSwgMiBmb3IgbW9udGhseSBhbmQgMyBmb3IgcXVhcnRlcmx5IGFuZCA0IGZvciB5ZWFybHlcblxuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIoY2xpZW50KTtcbiAgICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyKHJlY2VpdmVyKTtcbiAgICBpZiAoIXRhcmdldFBsYXllcikgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChhbW91bnQgPCAwKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JhbmtfaW52b2ljZXMnLCB7XG4gICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIGZyb206IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgdG86IHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgYW1vdW50OiBhbW91bnQsXG4gICAgICAgIHN0YXR1czogJ3BlbmRpbmcnLFxuICAgICAgICBpc0J1c2luZXNzLFxuICAgICAgICBzb3VyY2VOYW1lOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgdGFyZ2V0TmFtZTogYCR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbixcbiAgICAgICAgcGF5bWVudFRpbWU6IHBheW1lbnRUaW1lLFxuICAgICAgICBudW1iZXJPZlBheW1lbnRzOiBudW1iZXJPZlBheW1lbnRzLFxuICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9KTtcbiAgICBpZiAocmVzKSB7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdXYWxsZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIHNlbnQgeW91IGFuIGludm9pY2Ugb2YgJCR7YW1vdW50fS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2JhbmtfaW52b2ljZXMnLFxuICAgICAgICAgICAgdGl0bGU6ICdJbnZvaWNlIENyZWF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgc2VudCBhbiBpbnZvaWNlIG9mICQke2Ftb3VudH0gdG8gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpnZXRJbnZvaWNlcycsIGFzeW5jIChjbGllbnQsIHR5cGUpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBpZiAodHlwZSA9PT0gJ3NlbnQnKSB7XG4gICAgICAgIGNvbnN0IGludm9pY2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYmFua19pbnZvaWNlcycsIHsgZnJvbTogY2l0aXplbklkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGRhdGU6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShpbnZvaWNlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgaW52b2ljZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9iYW5rX2ludm9pY2VzJywgeyB0bzogY2l0aXplbklkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGRhdGU6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShpbnZvaWNlcyk7XG4gICAgfVxufSk7XG5cbnR5cGUgUmVjdXJyZW5jZSA9IDAgfCAxIHwgMiB8IDMgfCA0OyAvLyBkYWlseSwgd2Vla2x5LCBtb250aGx5LCBxdWFydGVybHksIHllYXJseVxuXG5pbnRlcmZhY2UgUGhvbmVCYW5rSW52b2ljZURvYyB7XG4gICAgX2lkOiBzdHJpbmc7XG4gICAgZnJvbTogc3RyaW5nOyAvLyBjaXRpemVuaWQgb2Ygc2VuZGVyICh0aGUgcGVyc29uL2J1c2luZXNzIHJlcXVlc3RpbmcgbW9uZXkpXG4gICAgdG86IHN0cmluZzsgICAvLyBjaXRpemVuaWQgb2YgdGFyZ2V0ICh0aGUgcGVyc29uIHdobyBwYXlzIHdoZW4gYWNjZXB0aW5nKVxuICAgIGFtb3VudDogbnVtYmVyO1xuICAgIHRhcmdldE5hbWU6IHN0cmluZztcbiAgICBzb3VyY2VOYW1lOiBzdHJpbmc7XG4gICAgc3RhdHVzOiAncGVuZGluZycgfCAnYWN0aXZlJyB8ICdwYWlkJyB8ICdjb21wbGV0ZWQnIHwgJ2RlY2xpbmVkJyB8ICdvdmVyZHVlJztcbiAgICBpc0J1c2luZXNzOiAnTm8nIHwgJ1llcyc7XG4gICAgcGF5bWVudFRpbWU6IFJlY3VycmVuY2UgfCAnJzsgLy8gJycgbWVhbnMgb25lLXRpbWUsIGVsc2UgcmVjdXJyZW5jZSBjb2RlXG4gICAgbnVtYmVyT2ZQYXltZW50czogbnVtYmVyIHwgJyc7Ly8gJycgbWVhbnMgb25lLXRpbWUsIGVsc2UgdG90YWwgcGF5bWVudHNcbiAgICByZW1haW5pbmdQYXltZW50cz86IG51bWJlcjsgICAvLyBtYWludGFpbmVkIGZvciByZWN1cnJpbmdcbiAgICBuZXh0UGF5bWVudERhdGU/OiBzdHJpbmcgfCBudWxsOyAvLyBJU09cbiAgICBsYXN0QXR0ZW1wdEF0Pzogc3RyaW5nIHwgbnVsbDsgICAvLyBJU09cbiAgICBmYWlsZWRBdHRlbXB0cz86IG51bWJlcjtcbiAgICBjcmVhdGVkQXQ/OiBzdHJpbmc7IC8vIElTT1xuICAgIGRhdGU/OiBzdHJpbmc7IC8vIHlvdXIgb3JpZ2luYWwgZmllbGRcbn1cblxuY29uc3QgQ09MTEVDVElPTiA9ICdwaG9uZV9iYW5rX2ludm9pY2VzJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBRQiBoZWxwZXJzIChhZGp1c3QgaWYgeW91ciBleHBvcnRzIGRpZmZlcilcbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0UGxheWVyQnlTb3VyY2UgPSBhc3luYyAoc3JjOiBudW1iZXIpID0+IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXIoc3JjKTtcbmNvbnN0IGdldFBsYXllckJ5Q2l0aXplbklkID0gYXN5bmMgKGNpZDogc3RyaW5nKSA9PiBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQ/LihjaWQpO1xuXG4vLyBNb25leSBvcHM6IHJldHVybiBib29sZWFuIHN1Y2Nlc3NcbmNvbnN0IGRlYml0QmFuayA9IChwbGF5ZXI6IGFueSwgYW1vdW50OiBudW1iZXIpID0+IHBsYXllcj8uRnVuY3Rpb25zPy5SZW1vdmVNb25leT8uKCdiYW5rJywgYW1vdW50LCAnaW52b2ljZV9wYXltZW50JykgPz8gZmFsc2U7XG5jb25zdCBjcmVkaXRCYW5rID0gKHBsYXllcjogYW55LCBhbW91bnQ6IG51bWJlcikgPT4gcGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGFtb3VudCwgJ2ludm9pY2VfcmVjZWl2ZWQnKSA/PyBmYWxzZTtcblxuY29uc3Qgbm90aWZ5ID0gKHNyYzogbnVtYmVyLCB0aXRsZTogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nLCB0aW1lb3V0ID0gNTAwMCkgPT4ge1xuICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNyYywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLCBkZXNjcmlwdGlvbiwgYXBwOiAnc2V0dGluZ3MnLCB0aW1lb3V0XG4gICAgfSkpO1xufTtcblxuY29uc3Qgbm93SVNPID0gKCkgPT4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuXG5jb25zdCBhZGRJbnRlcnZhbCA9IChpc286IHN0cmluZywgcmVjOiBSZWN1cnJlbmNlKTogc3RyaW5nID0+IHtcbiAgICBjb25zdCBkID0gbmV3IERhdGUoaXNvKTtcbiAgICBzd2l0Y2ggKHJlYykge1xuICAgICAgICBjYXNlIDA6IGQuc2V0RGF0ZShkLmdldERhdGUoKSArIDEpOyBicmVhazsgICAgICAgLy8gZGFpbHlcbiAgICAgICAgY2FzZSAxOiBkLnNldERhdGUoZC5nZXREYXRlKCkgKyA3KTsgYnJlYWs7ICAgICAgIC8vIHdlZWtseVxuICAgICAgICBjYXNlIDI6IGQuc2V0TW9udGgoZC5nZXRNb250aCgpICsgMSk7IGJyZWFrOyAgICAgLy8gbW9udGhseVxuICAgICAgICBjYXNlIDM6IGQuc2V0TW9udGgoZC5nZXRNb250aCgpICsgMyk7IGJyZWFrOyAgICAgLy8gcXVhcnRlcmx5XG4gICAgICAgIGNhc2UgNDogZC5zZXRGdWxsWWVhcihkLmdldEZ1bGxZZWFyKCkgKyAxKTsgYnJlYWs7IC8vIHllYXJseVxuICAgIH1cbiAgICByZXR1cm4gZC50b0lTT1N0cmluZygpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBCdXNpbmVzcyBzYWZlIGRlcG9zaXQgKGN1c3RvbWl6ZSBmb3IgeW91ciBmcmFtZXdvcmspXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8qKlxuICogVHJ5IHRvIGRlcG9zaXQgaW50byBhIGJ1c2luZXNzIG1hbmFnZW1lbnQgc2FmZS5cbiAqIFN0cmF0ZWd5OlxuICogICAtIElmIHRoZSBwYXllciBpcyBwYXlpbmcgdG8gYSBidXNpbmVzcyAoaW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJyksXG4gKiAgICAgd2UgZGVwb3NpdCB0aGUgbW9uZXkgaW50byB0aGUgUkVDRUlWRVIncyBqb2Igc2FmZS5cbiAqICAgLSBZb3UgbWlnaHQgd2FudCB0byBjaGFuZ2UgdGhpcyB0byBhIHNwZWNpZmljIGJ1c2luZXNzIGlkIG9uIHRoZSBpbnZvaWNlLFxuICogICAgIG9yIGEgcHJvdmlkZWQgb3JnIGtleS4gRWRpdCBhcyBuZWVkZWQuXG4gKi9cbmNvbnN0IGRlcG9zaXRUb01hbmFnZW1lbnRTYWZlID0gYXN5bmMgKHJlY2VpdmVyQ2l0aXplbklkOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVjZWl2ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZWNlaXZlckNpdGl6ZW5JZCk7XG4gICAgICAgIGNvbnN0IGpvYk5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHJlY2VpdmVyPy5QbGF5ZXJEYXRhPy5qb2I/Lm5hbWU7XG4gICAgICAgIGNvbnN0IFBsYXllck5hbWUgPSByZWNlaXZlciA/IGAke3JlY2VpdmVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3JlY2VpdmVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCA6ICdVbmtub3duJztcbiAgICAgICAgLy8gVE9ETzogVXBkYXRlIHRoaXMgdG8geW91ciBhY3R1YWwgbWFuYWdlbWVudCByZXNvdXJjZSBBUEk6XG4gICAgICAgIC8vIENvbW1vbiBRQkNvcmUgZWNvc3lzdGVtIHVzZXMgcWItbWFuYWdlbWVudDogQWRkTW9uZXkoam9iTmFtZSwgYW1vdW50KVxuICAgICAgICBpZiAoam9iTmFtZSkge1xuICAgICAgICAgICAgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uYWRkQWNjb3VudE1vbmV5KGpvYk5hbWUsIGFtb3VudCk7XG4gICAgICAgICAgICAvKiBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihhY2NvdW50LCB0aXRsZSwgYW1vdW50LCBtZXNzYWdlLCBpc3N1ZXIsIHJlY2VpdmVyLCB0cmFuc1R5cGUsIHRyYW5zSUQpICovXG4gICAgICAgICAgICBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihqb2JOYW1lLCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0XCIsIGFtb3VudCwgXCJEZXBvc2l0IGZyb20gZW1wbG95ZWUgdG8gbWFuYWdlbWVudCBzYWZlLlwiLCBqb2JOYW1lLCBQbGF5ZXJOYW1lLCAnZGVwb3NpdCcsIGdlbmVyYXRlVVVpZCgpKVxuICAgICAgICAgICAgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oam9iTmFtZSwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgRGVwb3NpdFwiLCBhbW91bnQsIFwiRGVwb3NpdGVkIHRvIG1hbmFnZW1lbnQgc2FmZS5cIiwgUGxheWVyTmFtZSwgam9iTmFtZSwgJ3dpdGhkcmF3JywgZ2VuZXJhdGVVVWlkKCkpXG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlY2VpdmVyKSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlZGl0QmFuayhyZWNlaXZlciwgYW1vdW50KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdkZXBvc2l0VG9NYW5hZ2VtZW50U2FmZSBlcnJvcjonLCBlKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn07XG5cbi8vIEJhbmsgc3RhdGVtZW50IC8gbG9nZ2luZyAob3B0aW9uYWwgaG9vayBwb2ludClcbmNvbnN0IGxvZ0JhbmtFdmVudCA9ICh0eXBlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykgPT4gTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2JhbmtfaW52b2ljZXMnLFxuICAgIHRpdGxlOiB0eXBlLFxuICAgIG1lc3NhZ2UsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDphY2NlcHRJbnZvaWNlUGF5bWVudCcsIGFzeW5jIChjbGllbnQ6IG51bWJlciwgaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBheWVyUGxheWVyID0gYXdhaXQgZ2V0UGxheWVyQnlTb3VyY2UoY2xpZW50KTsgLy8gdGhlIG9uZSBjbGlja2luZyBcImFjY2VwdFwiIChtdXN0IGVxdWFsIGludm9pY2UudG8pXG4gICAgaWYgKCFwYXllclBsYXllcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgcGF5ZXJDaWQ6IHN0cmluZyA9IHBheWVyUGxheWVyLlBsYXllckRhdGE/LmNpdGl6ZW5pZDtcbiAgICBjb25zdCBpbnZvaWNlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9KSBhcyBQaG9uZUJhbmtJbnZvaWNlRG9jO1xuICAgIGlmICghaW52b2ljZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gU2FmZXR5IGNoZWNrc1xuICAgIGlmIChpbnZvaWNlLnRvICE9PSBwYXllckNpZCkgcmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm90IHlvdXIgaW52b2ljZVxuICAgIGlmIChpbnZvaWNlLnN0YXR1cyAhPT0gJ3BlbmRpbmcnICYmIGludm9pY2Uuc3RhdHVzICE9PSAnYWN0aXZlJyAmJiBpbnZvaWNlLnN0YXR1cyAhPT0gJ292ZXJkdWUnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGludm9pY2UuYW1vdW50IDw9IDApIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5mcm9tID09PSBpbnZvaWNlLnRvKSByZXR1cm4gZmFsc2U7ICAgICAgICAgICAgICAgICAgICAgIC8vIHNlbGYtaW52b2ljZSBzaWxsaW5lc3NcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKGludm9pY2UuZnJvbSk7XG5cbiAgICBjb25zdCBjaGFyZ2VkID0gZGViaXRCYW5rKHBheWVyUGxheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgaWYgKCFjaGFyZ2VkKSB7XG4gICAgICAgIC8vIENvdWxkblx1MjAxOXQgY2hhcmdlIC0+IG92ZXJkdWUgZm9yIHJlY3VycmluZyBvciBrZWVwIHBlbmRpbmcgZm9yIG9uZS10aW1lP1xuICAgICAgICBjb25zdCBpc1JlY3VycmluZyA9IGludm9pY2UucGF5bWVudFRpbWUgIT09ICcnICYmIGludm9pY2UubnVtYmVyT2ZQYXltZW50cyAhPT0gJyc7XG4gICAgICAgIGlmIChpc1JlY3VycmluZykge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdvdmVyZHVlJyxcbiAgICAgICAgICAgICAgICBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSxcbiAgICAgICAgICAgICAgICBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBub3RpZnkocGF5ZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgSW5zdWZmaWNpZW50IGZ1bmRzIHRvIHBheSAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBQYXlvdXRcbiAgICBsZXQgcGF5b3V0T2sgPSBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJykge1xuICAgICAgICBjb25zdCBjb21taXNzaW9uID0gMC4xO1xuICAgICAgICBjb25zdCBjb21taXNzaW9uQW1vdW50ID0gTWF0aC5yb3VuZChpbnZvaWNlLmFtb3VudCAqIGNvbW1pc3Npb24pO1xuICAgICAgICBjb25zdCBwYXlvdXRBbW91bnQgPSBNYXRoLnJvdW5kKGludm9pY2UuYW1vdW50IC0gY29tbWlzc2lvbkFtb3VudCk7XG4gICAgICAgIHBheW91dE9rID0gYXdhaXQgZGVwb3NpdFRvTWFuYWdlbWVudFNhZmUoaW52b2ljZS5mcm9tLCBwYXlvdXRBbW91bnQpO1xuICAgICAgICByZXF1ZXN0ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KCdiYW5rJywgY29tbWlzc2lvbkFtb3VudCwgJ2ludm9pY2VfcmVjZWl2ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwYXlvdXRPayA9IHJlcXVlc3RlciA/IGNyZWRpdEJhbmsocmVxdWVzdGVyLCBpbnZvaWNlLmFtb3VudCkgOiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIXBheW91dE9rKSB7XG4gICAgICAgIC8vIFJlZnVuZCBwYXllciBzaW5jZSBwYXlvdXQgZmFpbGVkXG4gICAgICAgIGNyZWRpdEJhbmsocGF5ZXJQbGF5ZXIsIGludm9pY2UuYW1vdW50KTtcbiAgICAgICAgbm90aWZ5KHBheWVyUGxheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFBheW1lbnQgZmFpbGVkIHRvIGRlbGl2ZXIuIFJlZnVuZGVkICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBpbnZvaWNlIHN0YXR1c1xuICAgIGNvbnN0IGlzUmVjdXJyaW5nID0gKGludm9pY2UucGF5bWVudFRpbWUgIT09ICcnICYmIGludm9pY2UubnVtYmVyT2ZQYXltZW50cyAhPT0gJycpO1xuICAgIGlmICghaXNSZWN1cnJpbmcpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHtcbiAgICAgICAgICAgIHN0YXR1czogJ3BhaWQnLFxuICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiBudWxsLFxuICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IDAsXG4gICAgICAgICAgICBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB0b3RhbCA9IE51bWJlcihpbnZvaWNlLm51bWJlck9mUGF5bWVudHMpO1xuICAgICAgICBjb25zdCBwcmV2UmVtYWluaW5nID0gKGludm9pY2UucmVtYWluaW5nUGF5bWVudHMgPT0gbnVsbClcbiAgICAgICAgICAgID8gdG90YWwgICAgICAgICAgICAgICAgLy8gZmlyc3QgdGltZSBhY3RpdmF0aW9uXG4gICAgICAgICAgICA6IGludm9pY2UucmVtYWluaW5nUGF5bWVudHM7XG5cbiAgICAgICAgY29uc3QgbmV3UmVtYWluaW5nID0gTWF0aC5tYXgoMCwgcHJldlJlbWFpbmluZyAtIDEpO1xuXG4gICAgICAgIGxldCBuZXdTdGF0dXM6IFBob25lQmFua0ludm9pY2VEb2NbJ3N0YXR1cyddID0gJ2FjdGl2ZSc7XG4gICAgICAgIGxldCBuZXh0RGF0ZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIGlmIChuZXdSZW1haW5pbmcgPD0gMCkge1xuICAgICAgICAgICAgbmV3U3RhdHVzID0gJ2NvbXBsZXRlZCc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBiYXNlRGF0ZSA9IGludm9pY2UubmV4dFBheW1lbnREYXRlID8/IG5vd0lTTygpO1xuICAgICAgICAgICAgbmV4dERhdGUgPSBhZGRJbnRlcnZhbChiYXNlRGF0ZSwgTnVtYmVyKGludm9pY2UucGF5bWVudFRpbWUpIGFzIFJlY3VycmVuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHtcbiAgICAgICAgICAgIHN0YXR1czogbmV3U3RhdHVzLFxuICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IG5ld1JlbWFpbmluZyxcbiAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLFxuICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiBuZXh0RGF0ZSxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogaW52b2ljZS5jcmVhdGVkQXQgPz8gbm93SVNPKClcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gTm90aWZ5IGJvdGggc2lkZXNcbiAgICBub3RpZnkocGF5ZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgUGFpZCAkJHtpbnZvaWNlLmFtb3VudH0gdG8gJHtpbnZvaWNlLnNvdXJjZU5hbWV9LmApO1xuICAgIGlmIChyZXF1ZXN0ZXI/LlBsYXllckRhdGE/LnNvdXJjZSkge1xuICAgICAgICBub3RpZnkocmVxdWVzdGVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBwYWlkIHlvdXIgaW52b2ljZSBvZiAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgfVxuXG4gICAgbG9nQmFua0V2ZW50KCdJbnZvaWNlIFBheW1lbnQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IHBhaWQgJCR7aW52b2ljZS5hbW91bnR9IHRvICR7aW52b2ljZS5zb3VyY2VOYW1lfSR7aW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJyA/ICcgKGJ1c2luZXNzKScgOiAnJ30uYCk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnd2FsbGV0OmRlY2xpbmVJbnZvaWNlUGF5bWVudCcsIGFzeW5jIChjbGllbnQ6IG51bWJlciwgaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBsYXllciA9IGF3YWl0IGdldFBsYXllckJ5U291cmNlKGNsaWVudCk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IGNpZCA9IHBsYXllci5QbGF5ZXJEYXRhPy5jaXRpemVuaWQ7XG4gICAgY29uc3QgaW52b2ljZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSkgYXMgUGhvbmVCYW5rSW52b2ljZURvYztcbiAgICBpZiAoIWludm9pY2UpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS50byAhPT0gY2lkKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGludm9pY2Uuc3RhdHVzICE9PSAncGVuZGluZycgJiYgaW52b2ljZS5zdGF0dXMgIT09ICdhY3RpdmUnICYmIGludm9pY2Uuc3RhdHVzICE9PSAnb3ZlcmR1ZScpIHJldHVybiBmYWxzZTtcblxuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9LCB7IHN0YXR1czogJ2RlY2xpbmVkJywgbmV4dFBheW1lbnREYXRlOiBudWxsIH0pO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS5mcm9tKTtcbiAgICBub3RpZnkocGxheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYERlY2xpbmVkIGludm9pY2Ugb2YgJCR7aW52b2ljZS5hbW91bnR9IGZyb20gJHtpbnZvaWNlLnNvdXJjZU5hbWV9LmApO1xuICAgIGlmIChyZXF1ZXN0ZXI/LlBsYXllckRhdGE/LnNvdXJjZSkge1xuICAgICAgICBub3RpZnkocmVxdWVzdGVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBkZWNsaW5lZCB5b3VyIGludm9pY2Ugb2YgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgIH1cblxuICAgIGxvZ0JhbmtFdmVudCgnSW52b2ljZSBEZWNsaW5lZCcsIGAke2ludm9pY2UudGFyZ2V0TmFtZX0gZGVjbGluZWQgaW52b2ljZSBmcm9tICR7aW52b2ljZS5zb3VyY2VOYW1lfSBmb3IgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cblxuZXhwb3J0IGNvbnN0IEludm9pY2VSZWN1cnJpbmdQYXltZW50cyA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbiAgICBjb25zdCBkdWVJbnZvaWNlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXG4gICAgICAgIENPTExFQ1RJT04sXG4gICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1czogeyAkaW46IFsnYWN0aXZlJywgJ292ZXJkdWUnXSB9LFxuICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiB7ICRsdGU6IG5vdyB9LFxuICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IHsgJGd0OiAwIH1cbiAgICAgICAgfSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgZmFsc2UsXG4gICAgICAgIHsgc29ydDogeyBuZXh0UGF5bWVudERhdGU6IDEgfSwgbGltaXQ6IDUwIH0gLy8gcHJvY2VzcyBpbiBiYXRjaGVzXG4gICAgKSBhcyBQaG9uZUJhbmtJbnZvaWNlRG9jW107XG5cbiAgICBmb3IgKGNvbnN0IGludm9pY2Ugb2YgZHVlSW52b2ljZXMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBheWVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS50byk7XG4gICAgICAgICAgICBpZiAoIXBheWVyKSB7XG4gICAgICAgICAgICAgICAgLy8gUGF5ZXIgb2ZmbGluZSBcdTIwMTQgY2hvb3NlIHlvdXIgcG9saWN5LiBXZSdsbCBqdXN0IG1hcmsgYXR0ZW1wdCBhbmQgcmV0cnkgbGF0ZXIuXG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgJHNldDogeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSwgc3RhdHVzOiAnb3ZlcmR1ZScgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUcnkgdG8gY2hhcmdlIHZpYSB0aGUgc2FtZSBhY2NlcHQgbG9naWMgY29yZSAoRFJZLWlzaCB3aXRoIGEgdGlueSBpbnRlcm5hbCBjYWxsKVxuICAgICAgICAgICAgLy8gV2UgaW5saW5lIG1pbmltYWwgbG9naWM6IGRlYml0IHBheWVyXG4gICAgICAgICAgICBjb25zdCBjaGFyZ2VkID0gZGViaXRCYW5rKHBheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgICAgICBpZiAoIWNoYXJnZWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwgeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSwgc3RhdHVzOiAnb3ZlcmR1ZScgfSk7XG4gICAgICAgICAgICAgICAgbm90aWZ5KHBheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFJlY3VycmluZyBpbnZvaWNlIG9mICQke2ludm9pY2UuYW1vdW50fSBmYWlsZWQgKGluc3VmZmljaWVudCBmdW5kcykuYCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBheW91dFxuICAgICAgICAgICAgbGV0IHBheW91dE9rID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoaW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJykge1xuICAgICAgICAgICAgICAgIHBheW91dE9rID0gYXdhaXQgZGVwb3NpdFRvTWFuYWdlbWVudFNhZmUoaW52b2ljZS5mcm9tLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RlciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKGludm9pY2UuZnJvbSk7XG4gICAgICAgICAgICAgICAgcGF5b3V0T2sgPSByZXF1ZXN0ZXIgPyBjcmVkaXRCYW5rKHJlcXVlc3RlciwgaW52b2ljZS5hbW91bnQpIDogZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcGF5b3V0T2spIHtcbiAgICAgICAgICAgICAgICAvLyBSZWZ1bmRcbiAgICAgICAgICAgICAgICBjcmVkaXRCYW5rKHBheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHsgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksIGZhaWxlZEF0dGVtcHRzOiAoaW52b2ljZS5mYWlsZWRBdHRlbXB0cyA/PyAwKSArIDEgfSk7XG4gICAgICAgICAgICAgICAgbm90aWZ5KHBheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFJlY3VycmluZyBpbnZvaWNlIHBheW91dCBmYWlsZWQ7IHJlZnVuZGVkICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUHJvZ3Jlc3MgcmVjdXJyZW5jZVxuICAgICAgICAgICAgY29uc3QgbmV3UmVtYWluaW5nID0gTWF0aC5tYXgoMCwgKGludm9pY2UucmVtYWluaW5nUGF5bWVudHMgPz8gTnVtYmVyKGludm9pY2UubnVtYmVyT2ZQYXltZW50cykpIC0gMSk7XG4gICAgICAgICAgICBsZXQgbmV3U3RhdHVzOiBQaG9uZUJhbmtJbnZvaWNlRG9jWydzdGF0dXMnXSA9ICdhY3RpdmUnO1xuICAgICAgICAgICAgbGV0IG5leHREYXRlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKG5ld1JlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhdHVzID0gJ2NvbXBsZXRlZCc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2UgPSBpbnZvaWNlLm5leHRQYXltZW50RGF0ZSA/PyBub3dJU08oKTtcbiAgICAgICAgICAgICAgICBuZXh0RGF0ZSA9IGFkZEludGVydmFsKGJhc2UsIE51bWJlcihpbnZvaWNlLnBheW1lbnRUaW1lKSBhcyBSZWN1cnJlbmNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHtcbiAgICAgICAgICAgICAgICByZW1haW5pbmdQYXltZW50czogbmV3UmVtYWluaW5nLFxuICAgICAgICAgICAgICAgIHN0YXR1czogbmV3U3RhdHVzLFxuICAgICAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLFxuICAgICAgICAgICAgICAgIG5leHRQYXltZW50RGF0ZTogbmV4dERhdGVcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBub3RpZnkocGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgQ2hhcmdlZCAkJHtpbnZvaWNlLmFtb3VudH0gZm9yIHJlY3VycmluZyBpbnZvaWNlICgke25ld1JlbWFpbmluZ30gbGVmdCkuYCk7XG4gICAgICAgICAgICBsb2dCYW5rRXZlbnQoJ1JlY3VycmluZyBJbnZvaWNlIFBheW1lbnQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IHBhaWQgJCR7aW52b2ljZS5hbW91bnR9IHRvICR7aW52b2ljZS5zb3VyY2VOYW1lfSR7aW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJyA/ICcgKGJ1c2luZXNzKScgOiAnJ30uYCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1JlY3VycmluZyBwYXltZW50IGVycm9yIGZvcicsIGludm9pY2UuX2lkLCBlKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpbnZvaWNlLl9pZCB9LCB7XG4gICAgICAgICAgICAgICAgJHNldDogeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn07IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2ssIHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IEZyYW1ld29yaywgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dyb3VwczpnZXRtdWx0aVBsZUpvYnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgY29uc3Qgam9ic0RhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogc291cmNlUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkIH0pO1xuICAgIGNvbnN0IGN1cnJlbnRKb2IgPSBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5qb2IubmFtZTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBjdXJyZW50Sm9iLCBqb2JzRGF0YSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdncm91cHM6ZGVsZXRlTXVsdGlKb2InLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyTmFtZShzb3VyY2UpO1xuICAgIGNvbnN0IGpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlqb2JzJyxcbiAgICAgICAgdGl0bGU6ICdKb2IgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke25hbWV9IGRlbGV0ZWQgam9iICR7am9iLmpvYk5hbWV9ICgke2pvYi5jaXRpemVuSWR9KWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdncm91cHM6Y2hhbmdlSm9iT2ZQbGF5ZXInLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgam9iTmFtZSwgZ3JhZGUgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgaWYgKCFqb2JOYW1lKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3Qgc291cmNlUGxheWVyID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghc291cmNlUGxheWVyKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5DaGVja0pvYkdyYWRlKGpvYk5hbWUsIFN0cmluZyhncmFkZSkpKSB7XG4gICAgICAgIHNvdXJjZVBsYXllci5GdW5jdGlvbnMuU2V0Sm9iKGpvYk5hbWUsIFN0cmluZyhncmFkZSkpO1xuICAgICAgICBlbWl0TmV0KCdRQkNvcmU6Tm90aWZ5Jywgc291cmNlLCBgSm9iIENoYW5nZWQgdG8gJHtqb2JOYW1lfSBTdWNjZXNzZnVsbHlgLCAnc3VjY2VzcycpO1xuICAgICAgICBlbWl0TmV0KCdncm91cHM6dG9nZ2xlRHV0eScsIE51bWJlcihzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UpKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlqb2JzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSm9iIENoYW5nZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBjaGFuZ2VkIGpvYiB0byAnJHtqb2JOYW1lfScgKEdyYWRlOiAke2dyYWRlfSkuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsIGpvYk5hbWUgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpam9icycsXG4gICAgICAgICAgICB0aXRsZTogJ0ludmFsaWQgSm9iIFJlbW92ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBhdHRlbXB0ZWQgdG8gY2hhbmdlIHRvIGludmFsaWQgam9iICcke2pvYk5hbWV9JywgcmVtb3ZlZCBmcm9tIG11bHRpLWpvYnMuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxuLy8gSW50ZXJmYWNlc1xuaW50ZXJmYWNlIFBsYXllckRhdGEge1xuICAgIFBsYXllckRhdGE6IHtcbiAgICAgICAgY2hhcmluZm86IHsgZmlyc3RuYW1lOiBzdHJpbmc7IGxhc3RuYW1lOiBzdHJpbmcgfTtcbiAgICAgICAgY2l0aXplbmlkOiBzdHJpbmc7XG4gICAgICAgIHNvdXJjZTogbnVtYmVyO1xuICAgIH07XG59XG5cbmludGVyZmFjZSBHcm91cE1lbWJlciB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIENJRDogc3RyaW5nO1xuICAgIFBsYXllcjogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgRW1wbG95bWVudEdyb3VwIHtcbiAgICBpZDogbnVtYmVyO1xuICAgIHN0YXR1czogc3RyaW5nO1xuICAgIEdOYW1lOiBzdHJpbmc7XG4gICAgR1Bhc3M6IHN0cmluZztcbiAgICBHTG9nbzogc3RyaW5nO1xuICAgIFVzZXJzOiBudW1iZXI7XG4gICAgbGVhZGVyOiBudW1iZXI7XG4gICAgbWVtYmVyczogR3JvdXBNZW1iZXJbXTtcbiAgICBzdGFnZTogYW55W107XG4gICAgU2NyaXB0Q3JlYXRlZD86IGJvb2xlYW47XG59IiwgImltcG9ydCB7IEZyYW1ld29yaywgTW9uZ29EQiB9IGZyb20gJ0BzZXJ2ZXIvc3ZfbWFpbic7XG5pbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSAnQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyJztcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gJ0BzaGFyZWQvdXRpbHMnO1xuXG5pbnRlcmZhY2UgSGVhcnRTeW5jUHJvZmlsZSB7XG4gICAgX2lkPzogc3RyaW5nO1xuICAgIGNpdGl6ZW5JZDogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBhZ2U6IG51bWJlcjtcbiAgICBnZW5kZXI6IHN0cmluZztcbiAgICBiaW86IHN0cmluZztcbiAgICBwaG90b3M6IHN0cmluZ1tdO1xuICAgIGludGVyZXN0czogc3RyaW5nW107XG4gICAgbG9va2luZ0Zvcjogc3RyaW5nO1xuICAgIGludGVyZXN0ZWRJbkdlbmRlcnM6IHN0cmluZ1tdO1xuICAgIGFnZVJhbmdlTWluOiBudW1iZXI7XG4gICAgYWdlUmFuZ2VNYXg6IG51bWJlcjtcbiAgICBtYXhEaXN0YW5jZTogbnVtYmVyO1xuICAgIHNob3dPbmxpbmU6IGJvb2xlYW47XG4gICAgbG9jYXRpb24/OiB7XG4gICAgICAgIGxhdDogbnVtYmVyO1xuICAgICAgICBsbmc6IG51bWJlcjtcbiAgICAgICAgY2l0eTogc3RyaW5nO1xuICAgIH07XG4gICAgd29yaz86IHN0cmluZztcbiAgICBzY2hvb2w/OiBzdHJpbmc7XG4gICAgaGVpZ2h0PzogbnVtYmVyO1xuICAgIHpvZGlhY1NpZ24/OiBzdHJpbmc7XG4gICAgbGlmZXN0eWxlPzoge1xuICAgICAgICBzbW9raW5nOiBzdHJpbmc7XG4gICAgICAgIGRyaW5raW5nOiBzdHJpbmc7XG4gICAgICAgIGV4ZXJjaXNlOiBzdHJpbmc7XG4gICAgICAgIHBldHM6IHN0cmluZztcbiAgICB9O1xuICAgIHByb21wdHM/OiB7XG4gICAgICAgIHF1ZXN0aW9uOiBzdHJpbmc7XG4gICAgICAgIGFuc3dlcjogc3RyaW5nO1xuICAgIH1bXTtcbiAgICB2ZXJpZmllZDogYm9vbGVhbjtcbiAgICBwcmVtaXVtOiBib29sZWFuO1xuICAgIHN1cGVyTGlrZXNSZW1haW5pbmc6IG51bWJlcjtcbiAgICBsaWtlc1JlbWFpbmluZzogbnVtYmVyO1xuICAgIGRhaWx5U3dpcGVzOiBudW1iZXI7XG4gICAgbGFzdFN3aXBlUmVzZXQ6IERhdGU7XG4gICAgY3JlYXRlZEF0OiBEYXRlO1xuICAgIGxhc3RBY3RpdmU6IERhdGU7XG4gICAgaXNBY3RpdmU6IGJvb2xlYW47XG59XG5pbnRlcmZhY2UgTWVzc2FnZSB7XG4gICAgX2lkOiBzdHJpbmc7XG4gICAgc2VuZGVySWQ6IHN0cmluZztcbiAgICByZWNlaXZlcklkOiBzdHJpbmc7XG4gICAgbWF0Y2hJZDogc3RyaW5nO1xuICAgIGNvbnRlbnQ6IHN0cmluZztcbiAgICB0aW1lc3RhbXA6IHN0cmluZztcbiAgICByZWFkOiBib29sZWFuO1xufVxuY2xhc3MgSGVhcnRTeW5jU2VydmVyIHtcbiAgICBhc3luYyBnZXRQcm9maWxlKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlIHwgbnVsbD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb25zdCBwcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIHJldHVybiBwcm9maWxlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBIZWFydFN5bmMgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGNyZWF0ZVByb2ZpbGUoc291cmNlOiBudW1iZXIsIHByb2ZpbGVEYXRhOiBQYXJ0aWFsPEhlYXJ0U3luY1Byb2ZpbGU+KTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlIHwgbnVsbD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHByb2ZpbGUgYWxyZWFkeSBleGlzdHNcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nUHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdQcm9maWxlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQcm9maWxlIGFscmVhZHkgZXhpc3RzJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5ld1Byb2ZpbGU6IEhlYXJ0U3luY1Byb2ZpbGUgPSB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgbmFtZTogcHJvZmlsZURhdGEubmFtZSB8fCAnJyxcbiAgICAgICAgICAgICAgICBhZ2U6IHByb2ZpbGVEYXRhLmFnZSB8fCAxOCxcbiAgICAgICAgICAgICAgICBnZW5kZXI6IHByb2ZpbGVEYXRhLmdlbmRlciB8fCAnJyxcbiAgICAgICAgICAgICAgICBiaW86IHByb2ZpbGVEYXRhLmJpbyB8fCAnJyxcbiAgICAgICAgICAgICAgICBwaG90b3M6IHByb2ZpbGVEYXRhLnBob3RvcyB8fCBbXSxcbiAgICAgICAgICAgICAgICBpbnRlcmVzdHM6IHByb2ZpbGVEYXRhLmludGVyZXN0cyB8fCBbXSxcbiAgICAgICAgICAgICAgICBsb29raW5nRm9yOiBwcm9maWxlRGF0YS5sb29raW5nRm9yIHx8ICcnLFxuICAgICAgICAgICAgICAgIGludGVyZXN0ZWRJbkdlbmRlcnM6IHByb2ZpbGVEYXRhLmludGVyZXN0ZWRJbkdlbmRlcnMgfHwgW10sXG4gICAgICAgICAgICAgICAgYWdlUmFuZ2VNaW46IHByb2ZpbGVEYXRhLmFnZVJhbmdlTWluIHx8IDE4LFxuICAgICAgICAgICAgICAgIGFnZVJhbmdlTWF4OiBwcm9maWxlRGF0YS5hZ2VSYW5nZU1heCB8fCAzNSxcbiAgICAgICAgICAgICAgICBtYXhEaXN0YW5jZTogcHJvZmlsZURhdGEubWF4RGlzdGFuY2UgfHwgMjUsXG4gICAgICAgICAgICAgICAgc2hvd09ubGluZTogcHJvZmlsZURhdGEuc2hvd09ubGluZSAhPT0gdW5kZWZpbmVkID8gcHJvZmlsZURhdGEuc2hvd09ubGluZSA6IHRydWUsXG4gICAgICAgICAgICAgICAgd29yazogcHJvZmlsZURhdGEud29yayB8fCAnJyxcbiAgICAgICAgICAgICAgICBzY2hvb2w6IHByb2ZpbGVEYXRhLnNjaG9vbCB8fCAnJyxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHByb2ZpbGVEYXRhLmhlaWdodCxcbiAgICAgICAgICAgICAgICB6b2RpYWNTaWduOiBwcm9maWxlRGF0YS56b2RpYWNTaWduIHx8ICcnLFxuICAgICAgICAgICAgICAgIGxpZmVzdHlsZTogcHJvZmlsZURhdGEubGlmZXN0eWxlIHx8IHtcbiAgICAgICAgICAgICAgICAgICAgc21va2luZzogJycsXG4gICAgICAgICAgICAgICAgICAgIGRyaW5raW5nOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgZXhlcmNpc2U6ICcnLFxuICAgICAgICAgICAgICAgICAgICBwZXRzOiAnJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHByZW1pdW06IGZhbHNlLFxuICAgICAgICAgICAgICAgIHN1cGVyTGlrZXNSZW1haW5pbmc6IDUsXG4gICAgICAgICAgICAgICAgbGlrZXNSZW1haW5pbmc6IDUwLFxuICAgICAgICAgICAgICAgIGRhaWx5U3dpcGVzOiAwLFxuICAgICAgICAgICAgICAgIGxhc3RTd2lwZVJlc2V0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgICAgICAgICBsYXN0QWN0aXZlOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgbmV3UHJvZmlsZSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhyZXN1bHQpO1xuICAgICAgICAgICAgcmV0dXJuIHsgLi4ubmV3UHJvZmlsZSwgX2lkOiByZXN1bHQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIEhlYXJ0U3luYyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgdXBkYXRlUHJvZmlsZShzb3VyY2U6IG51bWJlciwgcHJvZmlsZURhdGE6IFBhcnRpYWw8SGVhcnRTeW5jUHJvZmlsZT4pOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGUgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgY29uc3QgdXBkYXRlRGF0YSA9IHtcbiAgICAgICAgICAgICAgICAuLi5wcm9maWxlRGF0YSxcbiAgICAgICAgICAgICAgICBsYXN0QWN0aXZlOiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSwgdXBkYXRlRGF0YSwgdW5kZWZpbmVkLCBmYWxzZSwgeyB1cHNlcnQ6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQudmFsdWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGRhdGluZyBIZWFydFN5bmMgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGVbXT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIFtdO1xuXG4gICAgICAgICAgICBjb25zdCB1c2VyUHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAoIXVzZXJQcm9maWxlKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIC8vIEdldCB1c2VycyBhbHJlYWR5IHN3aXBlZCBvblxuICAgICAgICAgICAgY29uc3Qgc3dpcGVkVXNlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfc3dpcGVzJywge1xuICAgICAgICAgICAgICAgIGZyb21Vc2VySWQ6IGNpdGl6ZW5JZFxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG4gICAgICAgICAgICBjb25zdCBzd2lwZWRVc2VySWRzID0gc3dpcGVkVXNlcnMubWFwKChzd2lwZTogYW55KSA9PiBzd2lwZS50b1VzZXJJZCk7XG5cbiAgICAgICAgICAgIC8vIEdldCBtYXRjaGVkIHVzZXJzXG4gICAgICAgICAgICBjb25zdCBtYXRjaGVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21hdGNoZXMnLCB7XG4gICAgICAgICAgICAgICAgJG9yOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgdXNlcjFJZDogY2l0aXplbklkIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgdXNlcjJJZDogY2l0aXplbklkIH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZWRVc2VySWRzID0gbWF0Y2hlcy5tYXAoKG1hdGNoOiBhbnkpID0+XG4gICAgICAgICAgICAgICAgbWF0Y2gudXNlcjFJZCA9PT0gY2l0aXplbklkID8gbWF0Y2gudXNlcjJJZCA6IG1hdGNoLnVzZXIxSWRcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIC8vIENvbWJpbmUgZXhjbHVkZWQgdXNlcnNcbiAgICAgICAgICAgIGNvbnN0IGV4Y2x1ZGVkVXNlcklkcyA9IFsuLi5zd2lwZWRVc2VySWRzLCAuLi5tYXRjaGVkVXNlcklkcywgY2l0aXplbklkXTtcblxuICAgICAgICAgICAgLy8gQnVpbGQgbWF0Y2ggY3JpdGVyaWFcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoQ3JpdGVyaWE6IGFueSA9IHtcbiAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IHsgJG5pbjogZXhjbHVkZWRVc2VySWRzIH0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgYWdlOiB7ICRndGU6IHVzZXJQcm9maWxlLmFnZVJhbmdlTWluLCAkbHRlOiB1c2VyUHJvZmlsZS5hZ2VSYW5nZU1heCB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBBZGQgZ2VuZGVyIHByZWZlcmVuY2VzXG4gICAgICAgICAgICBpZiAodXNlclByb2ZpbGUubG9va2luZ0ZvciAhPT0gJ0V2ZXJ5b25lJykge1xuICAgICAgICAgICAgICAgIG1hdGNoQ3JpdGVyaWEuZ2VuZGVyID0gdXNlclByb2ZpbGUubG9va2luZ0ZvciA9PT0gJ01lbicgPyAnTWFuJyA6ICdXb21hbic7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh1c2VyUHJvZmlsZS5pbnRlcmVzdGVkSW5HZW5kZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBtYXRjaENyaXRlcmlhLmxvb2tpbmdGb3IgPSB7XG4gICAgICAgICAgICAgICAgICAgICRpbjogdXNlclByb2ZpbGUuaW50ZXJlc3RlZEluR2VuZGVycy5pbmNsdWRlcyh1c2VyUHJvZmlsZS5nZW5kZXIpXG4gICAgICAgICAgICAgICAgICAgICAgICA/IHVzZXJQcm9maWxlLmludGVyZXN0ZWRJbkdlbmRlcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIDogWy4uLnVzZXJQcm9maWxlLmludGVyZXN0ZWRJbkdlbmRlcnMsICdFdmVyeW9uZSddXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcG90ZW50aWFsTWF0Y2hlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19wcm9maWxlcycsIG1hdGNoQ3JpdGVyaWEsIHVuZGVmaW5lZCwgZmFsc2UsIHsgbGltaXQ6IDIwIH0pXG5cbiAgICAgICAgICAgIHJldHVybiBwb3RlbnRpYWxNYXRjaGVzO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBwb3RlbnRpYWwgbWF0Y2hlczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBzd2lwZVByb2ZpbGUoc291cmNlOiBudW1iZXIsIHN3aXBlRGF0YTogeyB0YXJnZXRVc2VySWQ6IHN0cmluZzsgaXNMaWtlOiBib29sZWFuOyBpc1N1cGVyTGlrZT86IGJvb2xlYW4gfSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGlzTWF0Y2g6IGZhbHNlIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHsgdGFyZ2V0VXNlcklkLCBpc0xpa2UsIGlzU3VwZXJMaWtlID0gZmFsc2UgfSA9IHN3aXBlRGF0YTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgZGFpbHkgbGltaXRzXG4gICAgICAgICAgICBjb25zdCB1c2VyUHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAoIXVzZXJQcm9maWxlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgaXNNYXRjaDogZmFsc2UgfTtcblxuICAgICAgICAgICAgaWYgKGlzU3VwZXJMaWtlICYmIHVzZXJQcm9maWxlLnN1cGVyTGlrZXNSZW1haW5pbmcgPD0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBpc01hdGNoOiBmYWxzZSwgZXJyb3I6ICdObyBzdXBlciBsaWtlcyByZW1haW5pbmcnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlY29yZCB0aGUgc3dpcGVcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfc3dpcGVzJywge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgZnJvbVVzZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIHRvVXNlcklkOiB0YXJnZXRVc2VySWQsXG4gICAgICAgICAgICAgICAgaXNMaWtlLFxuICAgICAgICAgICAgICAgIGlzU3VwZXJMaWtlLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxldCBpc01hdGNoID0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBtYXRjaCBpZiBpdCdzIGEgbGlrZVxuICAgICAgICAgICAgaWYgKGlzTGlrZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlY2lwcm9jYWxTd2lwZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3N3aXBlcycsIHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbVVzZXJJZDogdGFyZ2V0VXNlcklkLFxuICAgICAgICAgICAgICAgICAgICB0b1VzZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgICAgICBpc0xpa2U6IHRydWVcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmIChyZWNpcHJvY2FsU3dpcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIG1hdGNoXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VyMUlkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VyMklkOiB0YXJnZXRVc2VySWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkQXQ6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzU3VwZXJMaWtlOiBpc1N1cGVyTGlrZSB8fCByZWNpcHJvY2FsU3dpcGUuaXNTdXBlckxpa2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlzTWF0Y2ggPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9ucyB0byBib3RoIHVzZXJzIGFib3V0IHRoZSBtYXRjaFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gR2V0IHBsYXllciBkYXRhIGZvciBib3RoIHVzZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzd2lwZXJEYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0RGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQodGFyZ2V0VXNlcklkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gR2V0IG9mZmxpbmUgZGF0YSBpZiBwbGF5ZXJzIGFyZSBub3Qgb25saW5lXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzd2lwZXJQbGF5ZXJEYXRhID0gc3dpcGVyRGF0YSB8fCBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldE9mZmxpbmVQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGxheWVyRGF0YSA9IHRhcmdldERhdGEgfHwgYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRPZmZsaW5lUGxheWVyQnlDaXRpemVuSWQodGFyZ2V0VXNlcklkKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBub3RpZmljYXRpb24gdG8gdGhlIHN3aXBlciAoY3VycmVudCB1c2VyKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN3aXBlckRhdGEgJiYgc3dpcGVyRGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc3dpcGVyRGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIkhlYXJ0U3luYyBNYXRjaCEgXHVEODNEXHVEQzk1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IG1hdGNoZWQgd2l0aCAke3RhcmdldFBsYXllckRhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSFgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwiaGVhcnRzeW5jXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9uIHRvIHRoZSB0YXJnZXQgdXNlclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldERhdGEgJiYgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIkhlYXJ0U3luYyBNYXRjaCEgXHVEODNEXHVEQzk1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IG1hdGNoZWQgd2l0aCAke3N3aXBlclBsYXllckRhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c3dpcGVyUGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSFgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwiaGVhcnRzeW5jXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKG5vdGlmaWNhdGlvbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzZW5kaW5nIG1hdGNoIG5vdGlmaWNhdGlvbnM6Jywgbm90aWZpY2F0aW9uRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHN3aXBlIGNvdW50c1xuICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZURhdGE6IGFueSA9IHtcbiAgICAgICAgICAgICAgICAgICAgZGFpbHlTd2lwZXM6IHVzZXJQcm9maWxlLmRhaWx5U3dpcGVzICsgMVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNTdXBlckxpa2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlRGF0YS5zdXBlckxpa2VzUmVtYWluaW5nID0gdXNlclByb2ZpbGUuc3VwZXJMaWtlc1JlbWFpbmluZyAtIDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlRGF0YS5saWtlc1JlbWFpbmluZyA9IHVzZXJQcm9maWxlLmxpa2VzUmVtYWluaW5nIC0gMTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSwgdXBkYXRlRGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGlzTWF0Y2ggfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHN3aXBpbmcgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgaXNNYXRjaDogZmFsc2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldE1hdGNoZXMoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPGFueVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMUlkOiBjaXRpemVuSWQgfSxcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMklkOiBjaXRpemVuSWQgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWVcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgc29ydDogeyBtYXRjaGVkQXQ6IC0xIH0gfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGVucmljaGVkTWF0Y2hlcyA9IGF3YWl0IFByb21pc2UuYWxsKG1hdGNoZXMubWFwKGFzeW5jIChtYXRjaDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3RoZXJVc2VySWQgPSBtYXRjaC51c2VyMUlkID09PSBjaXRpemVuSWQgPyBtYXRjaC51c2VyMklkIDogbWF0Y2gudXNlcjFJZDtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlclVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkOiBvdGhlclVzZXJJZCB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RNZXNzYWdlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfbWVzc2FnZXMnLCB7IG1hdGNoSWQ6IG1hdGNoLl9pZCB9LCB1bmRlZmluZWQsIGZhbHNlLCB7IHNvcnQ6IHsgdGltZXN0YW1wOiAtMSB9IH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgLi4ubWF0Y2gsXG4gICAgICAgICAgICAgICAgICAgIG90aGVyVXNlcixcbiAgICAgICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IGxhc3RNZXNzYWdlPy5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZVRpbWU6IGxhc3RNZXNzYWdlPy50aW1lc3RhbXAsXG4gICAgICAgICAgICAgICAgICAgIGlzTmV3TWF0Y2g6ICFsYXN0TWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IGF3YWl0IHRoaXMuZ2V0VW5yZWFkTWVzc2FnZUNvdW50KG1hdGNoLl9pZCEudG9TdHJpbmcoKSwgY2l0aXplbklkKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHJldHVybiBlbnJpY2hlZE1hdGNoZXM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIG1hdGNoZXM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRVbnJlYWRNZXNzYWdlQ291bnQobWF0Y2hJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb3VudCA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tZXNzYWdlcycsIHtcbiAgICAgICAgICAgICAgICBtYXRjaElkLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVySWQ6IHVzZXJJZCxcbiAgICAgICAgICAgICAgICByZWFkOiBmYWxzZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG4gICAgICAgICAgICByZXR1cm4gY291bnQubGVuZ3RoO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyB1bnJlYWQgY291bnQ6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNb2NrIGltcGxlbWVudGF0aW9ucyBmb3Igb3RoZXIgbWV0aG9kcyAtIHJlcGxhY2Ugd2l0aCBhY3R1YWwgbG9naWNcbiAgICBhc3luYyBnZXRTd2lwZVN0YXRzKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgcHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgIHJldHVybiBwcm9maWxlID8ge1xuICAgICAgICAgICAgbGlrZXNSZW1haW5pbmc6IHByb2ZpbGUubGlrZXNSZW1haW5pbmcsXG4gICAgICAgICAgICBzdXBlckxpa2VzUmVtYWluaW5nOiBwcm9maWxlLnN1cGVyTGlrZXNSZW1haW5pbmcsXG4gICAgICAgICAgICBkYWlseVN3aXBlczogcHJvZmlsZS5kYWlseVN3aXBlc1xuICAgICAgICB9IDogbnVsbDtcbiAgICB9XG5cbiAgICBhc3luYyBnZXROZWFyYnlVc2Vycyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIC8vIE1vY2sgaW1wbGVtZW50YXRpb24gLSByZXBsYWNlIHdpdGggYWN0dWFsIGdlb2xvY2F0aW9uIGxvZ2ljXG4gICAgICAgIHJldHVybiB0aGlzLmdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlKTtcbiAgICB9XG5cbiAgICBhc3luYyBnZXRPbmxpbmVVc2Vycyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IGZpdmVNaW51dGVzQWdvID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIDUgKiA2MCAqIDEwMDApO1xuICAgICAgICAgICAgY29uc3Qgb25saW5lVXNlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiB7ICRuZTogY2l0aXplbklkIH0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgbGFzdEFjdGl2ZTogeyAkZ3RlOiBmaXZlTWludXRlc0FnbyB9XG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlLCB7IGxpbWl0OiAxMCB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG9ubGluZVVzZXJzO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBvbmxpbmUgdXNlcnM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0UmVjZW50bHlBY3RpdmVVc2Vycyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IG9uZURheUFnbyA9IG5ldyBEYXRlKERhdGUubm93KCkgLSAyNCAqIDYwICogNjAgKiAxMDAwKTtcbiAgICAgICAgICAgIGNvbnN0IHJlY2VudFVzZXJzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywge1xuICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogeyAkbmU6IGNpdGl6ZW5JZCB9LFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGxhc3RBY3RpdmU6IHsgJGd0ZTogb25lRGF5QWdvIH1cbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgbGltaXQ6IDE1LCBzb3J0OiB7IGxhc3RBY3RpdmU6IC0xIH0gfSk7XG5cbiAgICAgICAgICAgIHJldHVybiByZWNlbnRVc2VycztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgcmVjZW50bHkgYWN0aXZlIHVzZXJzOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldFRvcFBpY2tzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvbiAtIHJlcGxhY2Ugd2l0aCBhY3R1YWwgYWxnb3JpdGhtXG4gICAgICAgIGNvbnN0IHBvdGVudGlhbE1hdGNoZXMgPSBhd2FpdCB0aGlzLmdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlKTtcbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbE1hdGNoZXMuc2xpY2UoMCwgOCk7XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0Tm90aWZpY2F0aW9ucyhzb3VyY2U6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgbmV3TWF0Y2hlczogMCwgbmV3TWVzc2FnZXM6IDAsIHN1cGVyTGlrZXM6IDAgfTtcblxuICAgICAgICAgICAgLy8gR2V0IG5ldyBtYXRjaGVzIChtYXRjaGVzIHdpdGhvdXQgbWVzc2FnZXMpXG4gICAgICAgICAgICBjb25zdCBuZXdNYXRjaGVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21hdGNoZXMnLCB7XG4gICAgICAgICAgICAgICAgJG9yOiBbeyB1c2VyMUlkOiBjaXRpemVuSWQgfSwgeyB1c2VyMklkOiBjaXRpemVuSWQgfV0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgLy8gQWRkIGxvZ2ljIHRvIGNoZWNrIGlmIG1hdGNoIGlzIG5ld1xuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIC8vIEdldCB1bnJlYWQgbWVzc2FnZXNcbiAgICAgICAgICAgIGNvbnN0IG5ld01lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21lc3NhZ2VzJywge1xuICAgICAgICAgICAgICAgIHJlY2VpdmVySWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICByZWFkOiBmYWxzZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIC8vIEdldCByZWNlaXZlZCBzdXBlciBsaWtlc1xuICAgICAgICAgICAgY29uc3Qgc3VwZXJMaWtlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19zd2lwZXMnLCB7XG4gICAgICAgICAgICAgICAgdG9Vc2VySWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBpc1N1cGVyTGlrZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBpc0xpa2U6IHRydWVcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBuZXdNYXRjaGVzOiBuZXdNYXRjaGVzLmxlbmd0aCwgbmV3TWVzc2FnZXM6IG5ld01lc3NhZ2VzLmxlbmd0aCwgc3VwZXJMaWtlczogc3VwZXJMaWtlcy5sZW5ndGggfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgbm90aWZpY2F0aW9uczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBuZXdNYXRjaGVzOiAwLCBuZXdNZXNzYWdlczogMCwgc3VwZXJMaWtlczogMCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0TWVzc2FnZXMoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkge1xuICAgICAgICByZXR1cm4gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21lc3NhZ2VzJywgeyBtYXRjaElkOiBkYXRhLm1hdGNoSWQgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgYXN5bmMgc2VuZE1lc3NhZ2Uoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkge1xuICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfbWF0Y2hlcycsIHsgX2lkOiBTdHJpbmcoZGF0YS5tYXRjaElkKSB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgY29uc3Qgc291cmNlQ2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgIGxldCBzb3VyY2VEYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChzb3VyY2VDaXRpemVuSWQpO1xuICAgICAgICBsZXQgdGFyZ2V0RGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0UGxheWVyQnlDaXRpemVuSWQocmVzLnVzZXIxSWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHJlcy51c2VyMklkIDogcmVzLnVzZXIxSWQpO1xuXG4gICAgICAgIGlmICghc291cmNlRGF0YSkge1xuICAgICAgICAgICAgc291cmNlRGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzWydxYi1jb3JlJ10uR2V0T2ZmbGluZVBsYXllckJ5Q2l0aXplbklkKHNvdXJjZUNpdGl6ZW5JZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRhcmdldERhdGEpIHtcbiAgICAgICAgICAgIHRhcmdldERhdGEgPSBhd2FpdCBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldE9mZmxpbmVQbGF5ZXJCeUNpdGl6ZW5JZChyZXMudXNlcjFJZCA9PT0gc291cmNlQ2l0aXplbklkID8gcmVzLnVzZXIySWQgOiByZXMudXNlcjFJZCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnNlcnREYXRhOiBNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHJlYWQ6IHJlcy51c2VyMUlkID09PSBzb3VyY2VDaXRpemVuSWQgfHwgcmVzLnVzZXIySWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHRydWUgOiBmYWxzZSxcbiAgICAgICAgICAgIG1hdGNoSWQ6IHJlcy5faWQsXG4gICAgICAgICAgICBzZW5kZXJJZDogc291cmNlQ2l0aXplbklkLFxuICAgICAgICAgICAgcmVjZWl2ZXJJZDogcmVzLnVzZXIxSWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHJlcy51c2VyMklkIDogcmVzLnVzZXIxSWQsXG4gICAgICAgICAgICBjb250ZW50OiBkYXRhLmNvbnRlbnQsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgnaGVhcnRzeW5jX21lc3NhZ2VzJywgaW5zZXJ0RGF0YSk7XG5cbiAgICAgICAgaWYgKHJlcy51c2VyMUlkICE9PSBzb3VyY2VDaXRpemVuSWQgfHwgcmVzLnVzZXIySWQgIT09IHNvdXJjZUNpdGl6ZW5JZCAmJiB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlKSB7XG4gICAgICAgICAgICBlbWl0TmV0KCdoZWFydHN5bmM6Y2xpZW50OnNlbmRNZXNzYWdlJywgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoaW5zZXJ0RGF0YSkpO1xuICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIkhlYXJ0U3luY1wiLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBoYXZlIGEgbmV3IG1lc3NhZ2UgZnJvbSBcIiArIHNvdXJjZURhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWUgKyBcIiBcIiArIHNvdXJjZURhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZSxcbiAgICAgICAgICAgICAgICBhcHA6IFwiaGVhcnRzeW5jXCIsXG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbnNlcnREYXRhO1xuICAgIH1cblxuICAgIGFzeW5jIHVubWF0Y2goc291cmNlOiBudW1iZXIsIGRhdGE6IHsgbWF0Y2hJZDogc3RyaW5nIH0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfbWF0Y2hlcycsIHsgX2lkOiBkYXRhLm1hdGNoSWQgfSk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoIHx8ICFtYXRjaC5pc0FjdGl2ZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIHVzZXIgaXMgcGFydCBvZiB0aGlzIG1hdGNoXG4gICAgICAgICAgICBpZiAobWF0Y2gudXNlcjFJZCAhPT0gY2l0aXplbklkICYmIG1hdGNoLnVzZXIySWQgIT09IGNpdGl6ZW5JZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vdCBhdXRob3JpemVkIHRvIHVubWF0Y2ggdGhpcyB1c2VyJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBEZWFjdGl2YXRlIHRoZSBtYXRjaFxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywgeyBfaWQ6IGRhdGEubWF0Y2hJZCB9LCB7IGlzQWN0aXZlOiBmYWxzZSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgdW5tYXRjaGluZzonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdGYWlsZWQgdG8gdW5tYXRjaCcgfTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgaGVhcnRTeW5jU2VydmVyID0gbmV3IEhlYXJ0U3luY1NlcnZlcigpO1xuXG4vLyBSZWdpc3RlciBzZXJ2ZXIgY2FsbGJhY2tzXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0UHJvZmlsZScsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0UHJvZmlsZShzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpjcmVhdGVQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmNyZWF0ZVByb2ZpbGUoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6dXBkYXRlUHJvZmlsZScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci51cGRhdGVQcm9maWxlKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFBvdGVudGlhbE1hdGNoZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6c3dpcGVQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLnN3aXBlUHJvZmlsZShzb3VyY2UsIGRhdGEpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXRNYXRjaGVzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRNYXRjaGVzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFN3aXBlU3RhdHMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFN3aXBlU3RhdHMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0TmVhcmJ5VXNlcnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE5lYXJieVVzZXJzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE9ubGluZVVzZXJzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRPbmxpbmVVc2Vycyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXRSZWNlbnRseUFjdGl2ZVVzZXJzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRSZWNlbnRseUFjdGl2ZVVzZXJzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFRvcFBpY2tzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRUb3BQaWNrcyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXROb3RpZmljYXRpb25zJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXROb3RpZmljYXRpb25zKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE1lc3NhZ2VzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE1lc3NhZ2VzKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOnNlbmRNZXNzYWdlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLnNlbmRNZXNzYWdlKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOnVubWF0Y2gnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIudW5tYXRjaChzb3VyY2UsIGRhdGEpO1xufSk7XG5cbi8vIEFkZCBtb3JlIGNhbGxiYWNrcyBmb3IgbWVzc2FnZXMsIHN1cGVyIGxpa2VzLCBldGMuXG4vLyAuLi4gKGltcGxlbWVudCByZW1haW5pbmcgY2FsbGJhY2tzIGFzIG5lZWRlZClcblxuZXhwb3J0IHsgaGVhcnRTeW5jU2VydmVyIH07XG4iLCAiaW1wb3J0IFwiLi9zdl9leHBvcnRzXCI7XG5pbXBvcnQgXCIuL2FwcHMvaW5kZXhcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIi4vY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi9hcHBzL1NldHRpbmdzL2NsYXNzXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IEludm9pY2VSZWN1cnJpbmdQYXltZW50cyB9IGZyb20gXCIuL2FwcHMvV2FsbGV0L2NhbGxiYWNrc1wiO1xuaW1wb3J0IHsgcGlnZW9uU2VydmljZSB9IGZyb20gXCIuL2FwcHMvUGlnZW9uL1BpZ2VvblNlcnZpY2VcIjtcbmV4cG9ydCBsZXQgRnJhbWV3b3JrID0gZXhwb3J0c1sncWItY29yZSddLkdldENvcmVPYmplY3QoKTtcbmV4cG9ydCBjb25zdCBNb25nb0RCID0gZXhwb3J0c1snbW9uZ29EQiddO1xuZXhwb3J0IGNvbnN0IE15U1FMID0gZXhwb3J0cy5veG15c3FsO1xuZXhwb3J0IGNvbnN0IExvZ2dlciA9IGV4cG9ydHNbJ3FiLXNtYWxscmVzb3VyY2VzJ107XG5cbm9uKCdRQkNvcmU6U2VydmVyOlVwZGF0ZU9iamVjdCcsICgpID0+IHtcbiAgICBGcmFtZXdvcmsgPSBleHBvcnRzWydxYi1jb3JlJ10uR2V0Q29yZU9iamVjdCgpO1xufSk7XG5cbnNldEltbWVkaWF0ZSgoKSA9PiB7XG4gICAgVXRpbHMubG9hZCgpO1xuICAgIFNldHRpbmdzLmxvYWQoKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZTpzZXJ2ZXI6c2hhcmVOdW1iZXInLCBhc3luYyAoc291cmNlOiBhbnksIGNvbWluZ1NvdXJjZTogYW55KSA9PiB7XG4gICAgY29uc3Qgc291cmNlWCA9IHNvdXJjZTtcbiAgICBjb25zdCBzb3VyY2VOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZVgpO1xuICAgIGNvbnN0IGFjTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShjb21pbmdTb3VyY2UpO1xuICAgIGNvbnN0IGZ1bGxuYW1lID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllck5hbWUoc291cmNlWCk7XG4gICAgY29uc3QgYnJlYWtlZE5hbWUgPSBmdWxsbmFtZS5zcGxpdCgnICcpO1xuXG4gICAgaWYgKCFzb3VyY2VOdW1iZXIgfHwgIWFjTnVtYmVyKSByZXR1cm47XG4gICAgY29uc3QgY29udGFjdERhdGEgPSB7XG4gICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHBlcnNvbmFsTnVtYmVyOiBhY051bWJlcixcbiAgICAgICAgY29udGFjdE51bWJlcjogc291cmNlTnVtYmVyLFxuICAgICAgICBmaXJzdE5hbWU6IGJyZWFrZWROYW1lWzBdLFxuICAgICAgICBsYXN0TmFtZTogYnJlYWtlZE5hbWVbMV0sXG4gICAgICAgIGltYWdlOiBhd2FpdCBVdGlscy5HZXRDb250YWN0QXZhdGFyQnlOdW1iZXIoc291cmNlTnVtYmVyLCBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHNvdXJjZU51bWJlcikpLFxuICAgICAgICBvd25lcklkOiBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGFjTnVtYmVyKSxcbiAgICAgICAgbm90ZXM6IFwiXCIsXG4gICAgICAgIGVtYWlsOiBcIlwiLFxuICAgICAgICBpc0ZhdjogZmFsc2VcbiAgICB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgcGVyc29uYWxOdW1iZXI6IGFjTnVtYmVyLCBjb250YWN0TnVtYmVyOiBzb3VyY2VOdW1iZXIgfSk7XG4gICAgaWYgKHJlcykge1xuICAgICAgICByZXR1cm4gZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2VYLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgTnVtYmVyIEFscmVhZHkgU2hhcmVkLmAsXG4gICAgICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBOdW1iZXIoc291cmNlWCksIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJQaG9uZVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIHNoYXJlZCB5b3VyIFBob25lIE51bWJlci5gLFxuICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICB9KSk7XG4gICAgY29uc3Qgc2VuZElkID0gZ2VuZXJhdGVVVWlkKCk7XG4gICAgZW1pdE5ldCgncGhvbmU6YWRkQWN0aW9uTm90aWZpY2F0aW9uJywgTnVtYmVyKGNvbWluZ1NvdXJjZSksIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IHNlbmRJZCxcbiAgICAgICAgdGl0bGU6IFwiUGhvbmVcIixcbiAgICAgICAgZGVzY3JpcHRpb246IGAke2Z1bGxuYW1lfSB3YW50cyB0byBzaGFyZSB0aGVpciBudW1iZXIgd2l0aCB5b3UuYCxcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIGljb25zOiB7XG4gICAgICAgICAgICBcIjBcIjoge1xuICAgICAgICAgICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvY3Jvc3MtY2lyY2xlLnN2Z1wiLFxuICAgICAgICAgICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICAgICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphZGRDb250YWN0XCIsXG4gICAgICAgICAgICAgICAgYXJnczoge31cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcIjFcIjoge1xuICAgICAgICAgICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvdGljay5zdmdcIixcbiAgICAgICAgICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWRkQ29udGFjdFwiLFxuICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgY29udGFjdERhdGEsXG4gICAgICAgICAgICAgICAgICAgIGNvbWluZ1NvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgZnVsbG5hbWUsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSkpO1xuXG59KTtcblxub25OZXQoJ3Bob25lOnNlcnZlcjphZGRDb250YWN0JywgYXN5bmMgKGlkOiBzdHJpbmcsIGRhdGE6IHtcbiAgICBjb21pbmdTb3VyY2U6IGFueSxcbiAgICBmdWxsbmFtZTogc3RyaW5nLFxuICAgIGNvbnRhY3REYXRhOiBhbnksXG4gICAgaWQ6IHN0cmluZ1xufSkgPT4ge1xuICAgIGNvbnN0IHNyYyA9IGdsb2JhbC5zb3VyY2U7XG4gICAgY29uc29sZS5sb2coJ0FkZGluZyBjb250YWN0JywgaWQsIGRhdGEpO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHNyYywgaWQpO1xuICAgIGlmICghZGF0YS5jb250YWN0RGF0YSB8fCAhZGF0YS5jb21pbmdTb3VyY2UgfHwgIWRhdGEuZnVsbG5hbWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhd2FpdCBEZWxheSg1MDApO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc3JjLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgTnVtYmVyIFNhdmVkLmAsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgIH0pKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfY29udGFjdHMnLCBkYXRhLmNvbnRhY3REYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgdGl0bGU6ICdDb250YWN0IFNoYXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke2RhdGEuZnVsbG5hbWV9ICwgJHtkYXRhLmNvbnRhY3REYXRhLmNvbnRhY3ROdW1iZXJ9IGhhcyBzaGFyZWQgdGhlaXIgbnVtYmVyIHdpdGggJHtkYXRhLmNvbnRhY3REYXRhLnBlcnNvbmFsTnVtYmVyfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbignc3VtbWl0X3Bob25lOnNlcnZlcjpDcm9uVHJpZ2dlcicsIGFzeW5jICgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnQ3JvbiBUcmlnZ2VyZWQnKTtcbiAgICBJbnZvaWNlUmVjdXJyaW5nUGF5bWVudHMoKTtcbn0pO1xuXG5SZWdpc3RlckNvbW1hbmQoJ3Jlc2V0UGhvbmVQYXNzY29kZScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybjtcbiAgICBTZXR0aW5ncy5sb2NrUGluLnNldChjaXRpemVuSWQsICcwMDAwMDAnKTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBTZXR0aW5ncy5TYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBlbWl0TmV0KCdwaG9uZTpjbGllbnQ6c2V0dXBQaG9uZScsIHNvdXJjZSwgY2l0aXplbklkKTtcbn0sIGZhbHNlKTtcblxuUmVnaXN0ZXJDb21tYW5kKCd2ZXJpZnlQZWdpb24nLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGFyZ3M6IHN0cmluZ1tdKSA9PiB7XG4gICAgaWYgKCFhcmdzWzBdKSB7XG4gICAgICAgIHJldHVybiBMT0dHRVIoJ1BsZWFzZSBwcm92aWRlIGEgdmFsaWQgZW1haWwgYWRkcmVzcy4nKTtcbiAgICB9XG4gICAgY29uc3QgZW1haWwgPSBhcmdzWzBdO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHBpZ2VvblNlcnZpY2UudmVyaWZ5VXNlcihzb3VyY2UsIGVtYWlsKTtcbiAgICBpZiAocmVzID09PSBcInN1Y2Nlc3NcIikge1xuICAgICAgICByZXR1cm4gTE9HR0VSKGBVc2VyICR7ZW1haWx9IGhhcyBiZWVuIHZlcmlmaWVkIHN1Y2Nlc3NmdWxseS5gKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gTE9HR0VSKGBGYWlsZWQgdG8gdmVyaWZ5IHVzZXIgJHtlbWFpbH0uIFJlYXNvbjogJHtyZXN9YCk7XG4gICAgfVxufSwgdHJ1ZSk7XG5cbm9uKCdRQkNvcmU6U2VydmVyOk9uUGxheWVyVW5sb2FkJywgYXN5bmMgKHNyYzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgZXhwb3J0c1sncWItY29yZSddLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNyYyk7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybjtcbiAgICBhd2FpdCBTZXR0aW5ncy5TYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBTZXR0aW5ncy5vblBsYXllckRpc2Nvbm5lY3QoY2l0aXplbklkKTtcbn0pO1xuXG5vbigncGxheWVyRHJvcHBlZCcsIGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzcmMgPSBnbG9iYWwuc291cmNlO1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbJ3FiLWNvcmUnXS5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzcmMpO1xuICAgIGlmICghY2l0aXplbklkKSByZXR1cm47XG4gICAgYXdhaXQgU2V0dGluZ3MuU2F2ZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZCk7XG4gICAgU2V0dGluZ3Mub25QbGF5ZXJEaXNjb25uZWN0KGNpdGl6ZW5JZCk7XG59KSJdLAogICJtYXBwaW5ncyI6ICI7Ozs7O0FBQU8sU0FBUyxNQUFNLElBQVk7QUFDOUIsU0FBTyxJQUFJLFFBQVEsU0FBTyxXQUFXLEtBQUssRUFBRSxDQUFDO0FBQ2pEO0FBRmdCO0FBUVQsSUFBTSxlQUFlLDZCQUFNO0FBQzlCLFNBQU8sdUNBQXVDLFFBQVEsU0FBUyxTQUFVLEdBQUc7QUFDeEUsUUFBSSxJQUFJLEtBQUssT0FBTyxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssTUFBTSxJQUFJLElBQUksSUFBTTtBQUM3RCxXQUFPLEVBQUUsU0FBUyxFQUFFO0FBQUEsRUFDeEIsQ0FBQztBQUNMLEdBTDRCO0FBT3JCLElBQU0sU0FBUyx3QkFBQyxZQUFvQjtBQUN2QyxTQUFPLFFBQVEsSUFBSSx3REFBd0QsT0FBTyxTQUFTO0FBQy9GLEdBRnNCOzs7QUNadEIsSUFBTSxRQUFOLE1BQU0sTUFBSztBQUFBLEVBQ0E7QUFBQSxFQUNQLGNBQWM7QUFDVixTQUFLLGVBQWUsQ0FBQztBQUFBLEVBQ3pCO0FBQUEsRUFFQSxNQUFNLE9BQU87QUFDVCxvQkFBZ0IsbUJBQW1CLE9BQU9BLFNBQWEsU0FBYztBQUNqRSxVQUFJQSxZQUFXLEVBQUcsUUFBTyxPQUFPLDRDQUE0QztBQUM1RSxZQUFNLE1BQU0sZ0JBQWdCO0FBQUEsSUFDaEMsR0FBRyxJQUFJO0FBRVAsb0JBQWdCLG9CQUFvQixPQUFPQSxTQUFhLFNBQWM7QUFDbEUsVUFBSUEsWUFBVyxFQUFHLFFBQU8sT0FBTyw0Q0FBNEM7QUFDNUUsWUFBTSxNQUFNLGlCQUFpQjtBQUFBLElBQ2pDLEdBQUcsSUFBSTtBQUVQLG9CQUFnQix1QkFBdUIsT0FBT0EsU0FBYSxTQUFjO0FBQ3JFLFVBQUlBLFlBQVcsRUFBRyxRQUFPLE9BQU8sNENBQTRDO0FBQzVFLFlBQU0sTUFBTSxvQkFBb0I7QUFBQSxJQUNwQyxHQUFHLElBQUk7QUFFUCxvQkFBZ0Isa0JBQWtC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R0FBRyxJQUFJO0FBRVAsR0FBRyxnQ0FBZ0MsT0FBTyxRQUFnQjtBQUN0RCxRQUFNLFlBQVksTUFBTSxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsR0FBRztBQUN6RSxNQUFJLENBQUMsVUFBVztBQUNoQixRQUFNLFNBQVMsbUJBQW1CLFNBQVM7QUFDM0MsV0FBUyxtQkFBbUIsU0FBUztBQUN6QyxDQUFDO0FBRUQsR0FBRyxpQkFBaUIsWUFBWTtBQUM1QixRQUFNLE1BQU0sT0FBTztBQUNuQixRQUFNLFlBQVksTUFBTSxRQUFRLFNBQVMsRUFBRSwyQkFBMkIsR0FBRztBQUN6RSxNQUFJLENBQUMsVUFBVztBQUNoQixRQUFNLFNBQVMsbUJBQW1CLFNBQVM7QUFDM0MsV0FBUyxtQkFBbUIsU0FBUztBQUN6QyxDQUFDOyIsCiAgIm5hbWVzIjogWyJzb3VyY2UiLCAic291cmNlIiwgInNvdXJjZSIsICJyZXMiLCAic291cmNlIiwgInNvdXJjZSIsICJzb3VyY2UiLCAic291cmNlIiwgInNvdXJjZSIsICJkYXRhIiwgInNvdXJjZSIsICJzb3VyY2UiLCAicmV0d2VldCIsICJzb3VyY2UiLCAic291cmNlIiwgInNvdXJjZSIsICJpc1JlY3VycmluZyIsICJzb3VyY2UiLCAic291cmNlIiwgInNvdXJjZSJdCn0K
