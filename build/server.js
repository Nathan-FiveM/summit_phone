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
  return console.log(`\x1B[1m\x1B[47m\x1B[34m[ASGER_Phone] \x1B[4m\x1B[31m${message}\x1B[0m`);
}, "LOGGER");
var FRAMEWORK_RESOURCE = "qb-core";
var INVENTORY_RESOURCE = "ox_inventory";

// game/server/classes/Utils.ts
var _Util = class _Util {
  contactsData;
  constructor() {
    this.contactsData = [];
  }
  /**
   * Gets the citizen ID for a player by their source.
   * First tries the framework export, then falls back to Framework.Functions.GetPlayer()
   * @param source - The player's source/server ID
   * @returns The citizen ID or null if not found
   */
  async GetPlayerCitizenIdBySource(source2) {
    var _a2, _b, _c, _d, _e;
    try {
      const exportFunc = (_a2 = exports[FRAMEWORK_RESOURCE]) == null ? void 0 : _a2.GetPlayerCitizenIdBySource;
      if (typeof exportFunc === "function") {
        const result = await exportFunc(source2);
        if (result)
          return result;
      }
    } catch (e) {
    }
    try {
      const player = (_d = (_c = (_b = Framework) == null ? void 0 : _b.Functions) == null ? void 0 : _c.GetPlayer) == null ? void 0 : _d.call(_c, source2);
      if ((_e = player == null ? void 0 : player.PlayerData) == null ? void 0 : _e.citizenid) {
        return player.PlayerData.citizenid;
      }
    } catch (e) {
      LOGGER(`Failed to get citizen ID for source ${source2}: ${e}`);
    }
    return null;
  }
  async load() {
    RegisterCommand("transferNumbers", async (source2, args) => {
      if (source2 === 0)
        return LOGGER("This command can only be executed in-game.");
      await Utils.TransferNumbers();
    }, true);
    RegisterCommand("transferContacts", async (source2, args) => {
      if (source2 === 0)
        return LOGGER("This command can only be executed in-game.");
      await Utils.TransferContacts();
    }, true);
    RegisterCommand("migrateMultiJobData", async (source2, args) => {
      if (source2 === 0)
        return LOGGER("This command can only be executed in-game.");
      await Utils.MigrateMultiJobData();
    }, true);
    RegisterCommand("migrateSociety", async (source2, args) => {
      if (source2 === 0)
        return LOGGER("This command can only be executed in-game.");
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
          if (!number)
            continue;
          const existing = await MongoDB.findOne("phone_numbers", { owner });
          if (existing)
            continue;
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
        if (index > result.length)
          break;
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
          if (!jobName)
            continue;
          let employees = row.employees;
          if (!employees)
            continue;
          if (typeof employees === "string") {
            try {
              employees = JSON.parse(employees);
            } catch (err) {
              LOGGER(`Failed to parse employees JSON for job ${jobName} (id: ${jobId}): ${err}`);
              continue;
            }
          }
          if (!employees || typeof employees !== "object" || Array.isArray(employees))
            continue;
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
    if (!number)
      return false;
    return number.number;
  }
  async GetEmailIdByCitizenId(citizenId) {
    const number = await MongoDB.findOne("phone_settings", { _id: citizenId });
    if (!number)
      return false;
    return number.smrtId;
  }
  async GetEmailIdBySource(source2) {
    const citizenId = await this.GetPlayerCitizenIdBySource(source2);
    if (!citizenId)
      return false;
    const email = await this.GetEmailIdByCitizenId(citizenId);
    return email;
  }
  async GetCitizenIdByPhoneNumber(phoneNumber) {
    const number = await MongoDB.findOne("phone_numbers", { number: phoneNumber });
    if (!number)
      return false;
    return number.owner;
  }
  async GetPlayerFromPhoneNumber(phoneNumber) {
    const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
    return await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(citizenId);
  }
  async GetPhoneNumberBySource(source2) {
    const citizenId = await this.GetPlayerCitizenIdBySource(source2);
    return await this.GetPhoneNumberByCitizenId(citizenId);
  }
  async BlockNumber(phoneNumber, targetPhoneNumber) {
    const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
    const targetCitizenId = await this.GetCitizenIdByPhoneNumber(targetPhoneNumber);
    if (!citizenId || !targetCitizenId)
      return;
    await MongoDB.insertOne("phone_blocked_numbers", {
      _id: generateUUid(),
      citizenId,
      targetCitizenId
    });
  }
  async UnblockNumber(phoneNumber, targetPhoneNumber) {
    const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
    const targetCitizenId = await this.GetCitizenIdByPhoneNumber(targetPhoneNumber);
    if (!citizenId || !targetCitizenId)
      return;
    await MongoDB.deleteOne("phone_blocked_numbers", { citizenId, targetCitizenId });
  }
  async IsNumberBlocked(phoneNumber, targetPhoneNumber) {
    const citizenId = await this.GetCitizenIdByPhoneNumber(phoneNumber);
    const targetCitizenId = await this.GetCitizenIdByPhoneNumber(targetPhoneNumber);
    if (!citizenId || !targetCitizenId)
      return false;
    const blocked = await MongoDB.findOne("phone_blocked_numbers", { citizenId, targetCitizenId });
    return blocked ? true : false;
  }
  async GetContactNameByNumber(phoneNumber, citizenId) {
    const contact = await MongoDB.findOne("phone_contacts", { contactNumber: phoneNumber, ownerId: citizenId });
    if (!contact)
      return phoneNumber;
    return `${contact.firstName} ${contact.lastName}`;
  }
  async GetContactAvatarByNumber(phoneNumber, citizenId) {
    const contact = await MongoDB.findOne("phone_contacts", { contactNumber: phoneNumber, ownerId: citizenId });
    if (!contact)
      return "";
    return contact.image;
  }
  async GetSourceFromCitizenId(citizenId) {
    const source2 = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(citizenId);
    if (!source2)
      return false;
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
          if (has)
            return true;
        }
      } catch (e) {
        console.error("HasPhone check failed:", e);
      }
      return false;
    }
  }
  async InFlightMode(citizenId) {
    const settings = await MongoDB.findOne("phone_settings", { _id: citizenId });
    if (!settings)
      return false;
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
    if (!number)
      return false;
    return number.phoneNumber;
  }
  async GetCitizenIdByEmail(email) {
    const number = await MongoDB.findOne("phone_settings", { smrtId: email });
    if (!number)
      return false;
    return number._id;
  }
  async GetPlayerByEmail(email) {
    const citizenId = await this.GetCitizenIdByEmail(email);
    return await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(citizenId);
  }
  async GetAvatarFromEmail(email) {
    const avator = await MongoDB.findOne("phone_mail", { activeMaidId: email });
    if (!avator)
      return false;
    return avator.avatar;
  }
  async GetUserNameFromEmail(email) {
    const user = await MongoDB.findOne("phone_mail", { activeMaidId: email });
    if (!user)
      return false;
    return user.username;
  }
  async GetCidFromTweetId(email) {
    const res = await MongoDB.findOne("phone_settings", { pigeonIdAttached: email });
    if (!res)
      return false;
    return res._id;
  }
  async GetCidsFromPigeonEmail(email) {
    const res = await MongoDB.findMany("phone_settings", { pigeonIdAttached: email });
    if (!res || res.length === 0)
      return [];
    return res.map((setting) => setting._id);
  }
  async GetCidFromDarkEmail(email) {
    const res = await MongoDB.findOne("phone_settings", { darkMailIdAttached: email });
    if (!res)
      return false;
    return res._id;
  }
  async IsPlayerInJail(source2) {
    try {
      const player = await exports[FRAMEWORK_RESOURCE].GetPlayer(source2);
      if (!player)
        return false;
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
    if (!myEntries || myEntries.length === 0)
      return { jobs, employees };
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
    if (!email && !password)
      return false;
    const mailData = await MongoDB.findOne("phone_mail", { activeMaidId: email, activeMailPassword: password });
    if (!mailData || mailData.messages.length === 0) {
      mailData.messages = [];
    } else {
      mailData.messages = mailData.messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    if (!mailData)
      return false;
    return JSON.stringify(mailData.messages);
  }
  async sendMail(email, to, subject, message, images, source2) {
    const player = email;
    const target = to;
    const playerMail = await MongoDB.findOne("phone_mail", { _id: player });
    const targetMail = await MongoDB.findOne("phone_mail", { _id: target });
    if (!playerMail || !targetMail)
      return false;
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
    if (!mailData)
      return false;
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
    if (!mailData)
      return false;
    const message = mailData.messages.find((m) => m._id === messageId);
    if (!message)
      return false;
    message.read = true;
    await MongoDB.updateOne("phone_mail", { _id: mailId }, mailData);
    return true;
  }
  async getProfileSettings(email, password) {
    const mailData = await MongoDB.findAndReturnSpecificFields("phone_mail", { activeMaidId: email, activeMailPassword: password }, ["activeMaidId", "activeMailPassword", "avatar", "username"]);
    if (!mailData)
      return false;
    return JSON.stringify(mailData);
  }
  async updateProfileSettings(email, password, username, avatar) {
    const mailData = await MongoDB.findOne("phone_mail", { activeMaidId: email, activeMailPassword: password });
    if (!mailData)
      return false;
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
  if (!citizenId)
    return false;
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
  if (!citizenId)
    return false;
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
  if (!citizenId)
    return {};
  const res = await Utils.getJobs(citizenId);
  return res.jobs || {};
}, "GetJobs");
exports("getJobs", GetJobs);
var GetJobsFull = /* @__PURE__ */ __name(async (citizenId) => {
  if (!citizenId)
    return { jobs: {}, employees: {} };
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
    if (!res2)
      return;
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
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
  const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
      if (!group)
        return;
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
  const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
  const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
    const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
  const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
  const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
  const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
  const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
    const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
  const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
  const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
    const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
    const senderId = await Utils.GetPlayerCitizenIdBySource(client);
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
    if (!call)
      return;
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
    if (!call)
      return;
    if (call.pending.has(targetSource) || call.participants.has(targetSource))
      return;
    const timeout = setTimeout(() => {
      timeoutCallback();
      this.removePendingInvitation(callId, targetSource);
    }, timeoutMs);
    call.pending.set(targetSource, timeout);
  }
  removePendingInvitation(callId, targetSource) {
    const call = this.calls.get(callId);
    if (!call)
      return;
    if (call.pending.has(targetSource)) {
      clearTimeout(call.pending.get(targetSource));
      call.pending.delete(targetSource);
    }
  }
  acceptInvitation(callId, participant) {
    const call = this.calls.get(callId);
    if (!call)
      return false;
    if (call.participants.has(participant.source))
      return false;
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
    if (!call)
      return;
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
    if (!call)
      return;
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
    if (!call)
      return;
    call.participants.delete(source2);
    this.playerCallMap.delete(source2);
  }
  setHoldStatus(callId, source2, hold) {
    const call = this.calls.get(callId);
    if (!call)
      return false;
    const participant = call.participants.get(source2);
    if (!participant)
      return false;
    participant.onHold = hold;
    return true;
  }
  getParticipants(callId) {
    const call = this.calls.get(callId);
    if (!call)
      return [];
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
    if (!soundId)
      return;
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
    if (!(doc == null ? void 0 : doc._id))
      return;
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
    if (!citizenId)
      return;
    if (this._id.has(citizenId))
      return;
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
  const sourceCitizenId = await Utils.GetPlayerCitizenIdBySource(source2);
  const targetCitizenId = await Utils.GetPlayerCitizenIdBySource(targetSource);
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
  if (!call || call.callId !== callId)
    return false;
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
  const sourceCitizenId = await Utils.GetPlayerCitizenIdBySource(source2);
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
  const sourceCitizenId = await Utils.GetPlayerCitizenIdBySource(source2);
  const targetCitizenId = await Utils.GetPlayerCitizenIdBySource(targetSource);
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
  const targetCitizenId = await Utils.GetPlayerCitizenIdBySource(targetSource);
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
  const targetCitizenId = await Utils.GetPlayerCitizenIdBySource(targetSource);
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
  const photos = await MongoDB.findMany("phone_photos", { citizenId });
  return JSON.stringify(photos);
});
onClientCallback("deletePhoto", async (source2, data) => {
  const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
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
  const player = await Utils.GetPlayerCitizenIdBySource(client);
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
  const player = await Utils.GetPlayerCitizenIdBySource(client);
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
      if (data2.charinfo)
        charData = JSON.parse(data2.charinfo);
      if (data2.job)
        jobData = JSON.parse(data2.job);
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
          if (jobData.name === jobname)
            continue;
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
        if (isOnline.PlayerData.job.name === jobname)
          continue;
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
        message: `${data.targetCitizenid} has been updated to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | citizenId: ${await Utils.GetPlayerCitizenIdBySource(source2)}`,
        showIdentifiers: false
      });
    } else {
      await MongoDB.insertOne("phone_multijobs", { _id: generateUUid(), citizenId: data.targetCitizenid, jobName: data.jobName, gradeLevel: data.key, gradeLabel: data.gradeName });
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Added",
        message: `${data.targetCitizenid} has been added to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | citizenId: ${await Utils.GetPlayerCitizenIdBySource(source2)}`,
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
        message: `${data.targetCitizenid} has been updated to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | citizenId: ${await Utils.GetPlayerCitizenIdBySource(source2)}`,
        showIdentifiers: false
      });
    } else {
      await MongoDB.insertOne("phone_multijobs", { _id: generateUUid(), citizenId: data.targetCitizenid, jobName: data.jobName, gradeLevel: data.key, gradeLabel: data.gradeName });
      Logger.AddLog({
        type: "phone_multi_job",
        title: "Multi-Job Added",
        message: `${data.targetCitizenid} has been added to ${data.jobName} | New Rank: ${data.gradeName} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(source2)} | citizenId: ${await Utils.GetPlayerCitizenIdBySource(source2)}`,
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
  const targetCid = await Utils.GetPlayerCitizenIdBySource(client);
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
        message: `${targetCid} has been updated to ${jobname} | New Rank: ${gradeLabel} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(client)} | citizenId: ${await Utils.GetPlayerCitizenIdBySource(client)}`,
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
      message: `${targetCid} has been added to ${jobname} | New Rank: ${gradeLabel} by ${await exports[FRAMEWORK_RESOURCE].GetPlayerName(client)} | citizenId: ${await Utils.GetPlayerCitizenIdBySource(client)}`,
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
    message: `New email account registered with email ${parsedData.email}, password "${parsedData.password}", CitizenId: ${await Utils.GetPlayerCitizenIdBySource(client)}, Name: ${global.exports[FRAMEWORK_RESOURCE].GetPlayerName(client)}`,
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
      message: `${await Utils.GetPlayerCitizenIdBySource(client)} Name: ${global.exports[FRAMEWORK_RESOURCE].GetPlayerName(client)} logged in to email account ${parsedData.email}, password "${parsedData.password}"`,
      showIdentifiers: false
    });
    return true;
  } else {
    return false;
  }
});
onClientCallback("unLockorLockPhone", async (client, data) => {
  const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
  Settings.isLock.set(citizenId, data);
  return true;
});
onClientCallback("getPhonePlayerCard", async (client) => {
  const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
  if (exists)
    return generatePhoneNumber();
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
      if (!res)
        return { error: "User not found" };
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
    const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
    const user = await MongoDB.findOne("phone_pigeon_users", { email });
    const tweet = await MongoDB.findOne("phone_pigeon_tweets", { _id: tweetId });
    if (!tweet)
      return { error: "Tweet not found" };
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
    if (!tweet)
      return { error: "Tweet not found" };
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
    if (!tweet)
      return console.log("Tweet not found");
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
        const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
        const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
        const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
        const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
    if (!tweet)
      return { error: "Tweet not found" };
    tweet.repliesCount.push(await Utils.GetPlayerCitizenIdBySource(client));
    await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);
  }
  async decreaseRepliesCount(client, data) {
    try {
      const { tweetId } = JSON.parse(data);
      const cid = await Utils.GetPlayerCitizenIdBySource(client);
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
      if (!targetUser)
        return { error: "Target user not found" };
      const currentUser = await MongoDB.findOne("phone_pigeon_users", { email: currentEmail });
      if (!currentUser)
        return { error: "Current user not found" };
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
    if (!user)
      return { error: "User not found" };
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
    if (!user)
      return { error: "User not found" };
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
      if (!message)
        return { error: "Message not found" };
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
      if (!message)
        return { error: "Message not found" };
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
      if (!user)
        return { error: "User not found" };
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
      if (!user)
        return { error: "User not found" };
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
  const player = await Utils.GetPlayerCitizenIdBySource(client);
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
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
  if (!res)
    return false;
  const targetPlayer = await exports[FRAMEWORK_RESOURCE].GetPlayerByCitizenId(res.citizenId);
  const sourcePlayer = await exports[FRAMEWORK_RESOURCE].GetPlayer(client);
  if (!await DoesPlayerExist(targetPlayer.PlayerData.source))
    return false;
  if (sourcePlayer.PlayerData.money.bank < amount)
    return false;
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
  const transactions = await MongoDB.findMany("phone_bank_transactions", { from: citizenId }, null, false, {
    sort: { date: -1 }
  });
  return JSON.stringify(transactions);
});
onClientCallback("wallet:createInvoice", async (client, data) => {
  const { description, amount, paymentTime, numberOfPayments, isBusiness, receiver } = JSON.parse(data);
  const sourcePlayer = await exports[FRAMEWORK_RESOURCE].GetPlayer(client);
  const targetPlayer = await exports[FRAMEWORK_RESOURCE].GetPlayer(receiver);
  if (!targetPlayer)
    return false;
  if (amount < 0)
    return false;
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(client);
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
    case 1:
      d.setDate(d.getDate() + 7);
      break;
    case 2:
      d.setMonth(d.getMonth() + 1);
      break;
    case 3:
      d.setMonth(d.getMonth() + 3);
      break;
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
  if (!payerPlayer)
    return false;
  const payerCid = (_a2 = payerPlayer.PlayerData) == null ? void 0 : _a2.citizenid;
  const invoice = await MongoDB.findOne(COLLECTION, { _id: id });
  if (!invoice)
    return false;
  if (invoice.to !== payerCid)
    return false;
  if (invoice.status !== "pending" && invoice.status !== "active" && invoice.status !== "overdue")
    return false;
  if (invoice.amount <= 0)
    return false;
  if (invoice.from === invoice.to)
    return false;
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
  if (!player)
    return false;
  const cid = (_a2 = player.PlayerData) == null ? void 0 : _a2.citizenid;
  const invoice = await MongoDB.findOne(COLLECTION, { _id: id });
  if (!invoice)
    return false;
  if (invoice.to !== cid)
    return false;
  if (invoice.status !== "pending" && invoice.status !== "active" && invoice.status !== "overdue")
    return false;
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
  if (!jobName)
    return false;
  const sourcePlayer = await exports[FRAMEWORK_RESOURCE].GetPlayer(source2);
  if (!sourcePlayer)
    return false;
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
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return null;
      const profile = await MongoDB.findOne("heartsync_profiles", { citizenId });
      return profile;
    } catch (error) {
      console.error("Error getting HeartSync profile:", error);
      return null;
    }
  }
  async createProfile(source2, profileData) {
    try {
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return null;
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
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return null;
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
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return [];
      const userProfile = await MongoDB.findOne("heartsync_profiles", { citizenId });
      if (!userProfile)
        return [];
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
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return { success: false, isMatch: false };
      const { targetUserId, isLike, isSuperLike = false } = swipeData;
      const userProfile = await MongoDB.findOne("heartsync_profiles", { citizenId });
      if (!userProfile)
        return { success: false, isMatch: false };
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
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return [];
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
    const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
    if (!citizenId)
      return null;
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
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return [];
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
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return [];
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
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return { newMatches: 0, newMessages: 0, superLikes: 0 };
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
    const sourceCitizenId = await Utils.GetPlayerCitizenIdBySource(source2);
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
      const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
      if (!citizenId)
        return { success: false };
      const match = await MongoDB.findOne("heartsync_matches", { _id: data.matchId });
      if (!match || !match.isActive)
        return { success: false };
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
  if (!player)
    return false;
  const crypto = player.PlayerData.metadata.crypto || {};
  return JSON.stringify(crypto);
});
onClientCallback("crypto:buy", async (source2, data) => {
  const { type, amount, price } = JSON.parse(data);
  const player = Framework.Functions.GetPlayer(source2);
  if (!player || !["shung", "gne", "xcoin", "lme"].includes(type))
    return false;
  const totalCost = amount * price;
  if (player.PlayerData.money.bank < totalCost)
    return false;
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
  if (!player || !["shung", "gne", "xcoin", "lme"].includes(type))
    return false;
  if (!exports[FRAMEWORK_RESOURCE].hasEnough(source2, type, amount))
    return false;
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
  if (!sourcePlayer || !["shung", "gne", "xcoin", "lme"].includes(type))
    return false;
  if (!exports[FRAMEWORK_RESOURCE].hasEnough(source2, type, amount))
    return false;
  const targetCitizenId = await Utils.GetCitizenIdByPhoneNumber(target);
  if (!targetCitizenId)
    return false;
  const targetPlayer = Framework.Functions.GetPlayerByCitizenId(targetCitizenId);
  if (!targetPlayer)
    return false;
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
  if (Framework)
    return Framework;
  const configured = exports[FRAMEWORK_RESOURCE];
  if (typeof (configured == null ? void 0 : configured.GetCoreObject) === "function") {
    try {
      return configured.GetCoreObject();
    } catch {
    }
  }
  if (configured)
    return configured;
  const qb = (_b = (_a2 = exports["qb-core"]) == null ? void 0 : _a2.GetCoreObject) == null ? void 0 : _b.call(_a2);
  if (qb)
    return qb;
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
  if (!player)
    return;
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
  if (!player)
    return;
  player.Functions.SetMetaData("PhoneDailySpin", nowInSeconds());
});
onNet("dailySpin:rewardServer", (id) => {
  const src = Number(global.source);
  const player = getPlayer(src);
  if (!player)
    return;
  const rewardId = Number(id);
  if (Number.isNaN(rewardId))
    return;
  const reward = DailySpinConfig.RouletteData[rewardId];
  if (!reward)
    return;
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
  if (!player)
    return;
  player.Functions.AddItem(item, qty);
});
onNet("dailySpin:giveCash", (amount, src) => {
  const targetSrc = src ?? Number(global.source);
  const player = getPlayer(targetSrc);
  if (!player)
    return;
  player.Functions.AddMoney("cash", amount, "daily-spin-cash");
});
onNet("dailySpin:giveBank", (amount, src) => {
  const targetSrc = src ?? Number(global.source);
  const player = getPlayer(targetSrc);
  if (!player)
    return;
  player.Functions.AddMoney("bank", amount, "daily-spin-bank");
});
onNet("dailySpin:giveWeapon", (weapon, src) => {
  const targetSrc = src ?? Number(global.source);
  const player = getPlayer(targetSrc);
  if (!player)
    return;
  player.Functions.AddItem(weapon, DailySpinConfig.WeaponAmount);
});
var generatePlate = /* @__PURE__ */ __name(async () => {
  var _a2;
  const fw = resolveFramework();
  if (!(fw == null ? void 0 : fw.Shared))
    return "SPIN123";
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
  if (!player)
    return;
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
    if (!row)
      return row;
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
    if (!options)
      return sql;
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
    if (!doc)
      return null;
    if (!doc._id)
      doc._id = generateUUid();
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
      if (key === "_id")
        continue;
      setClauses.push(`\`${key}\` = ?`);
      let val = updateData[key];
      if (typeof val === "object" && val !== null) {
        val = JSON.stringify(val);
      }
      setParams.push(val);
    }
    if (setClauses.length === 0)
      return true;
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
        if (or && or[0] && or[0].senderEmail)
          userEmail = or[0].senderEmail;
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
  if (configured)
    return configured;
  const qb = (_b = (_a2 = exports["qb-core"]) == null ? void 0 : _a2.GetCoreObject) == null ? void 0 : _b.call(_a2);
  if (qb)
    return qb;
  if (exports["qb-core"])
    return exports["qb-core"];
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
  if (!sourceNumber || !acNumber)
    return;
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
  const citizenId = await Utils.GetPlayerCitizenIdBySource(source2);
  if (!citizenId)
    return;
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
  if (!src)
    return;
  const citizenId = await Utils.GetPlayerCitizenIdBySource(src);
  if (!citizenId)
    return;
  await Settings.SavePlayerSettings(citizenId);
  Settings.onPlayerDisconnect(citizenId);
});
on("playerDropped", async () => {
  const src = global.source;
  if (!src)
    return;
  const citizenId = await Utils.GetPlayerCitizenIdBySource(src);
  if (!citizenId)
    return;
  await Settings.SavePlayerSettings(citizenId);
  Settings.onPlayerDisconnect(citizenId);
});
onNet("ignis_phone:sendNewMail", async (targetSource, mailData) => {
  const src = Number(targetSource ?? global.source);
  const player = Framework.Functions.GetPlayer(src);
  if (!player)
    return;
  const citizenId = player.PlayerData.citizenid;
  const emailAddress = await Utils.GetEmailIdByCitizenId(citizenId);
  if (!emailAddress)
    return;
  await global.exports["summit_phone"].SendMail({
    email: (mailData == null ? void 0 : mailData.email) || "government@summit.rp",
    to: emailAddress,
    subject: (mailData == null ? void 0 : mailData.subject) || "Email is not setup correctly!",
    message: (mailData == null ? void 0 : mailData.message) || "Email is not setup correctly!",
    images: (mailData == null ? void 0 : mailData.images) || [],
    source: src
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2FtZS9zaGFyZWQvdXRpbHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvY2xhc3Nlcy9VdGlscy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL01haWwvY2xhc3MudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvc3ZfZXhwb3J0cy50cyIsICIuLi9ub2RlX21vZHVsZXMvQG92ZXJleHRlbmRlZC9veF9saWIvc2hhcmVkL3Jlc291cmNlL2NhY2hlL2luZGV4LmpzIiwgIi4uL25vZGVfbW9kdWxlcy9Ab3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXIvcmVzb3VyY2UvY2FsbGJhY2svaW5kZXguanMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9Db250YWN0cy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0RhcmtDaGF0L2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvTWFpbC9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL01lc3NhZ2VzL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvY2FsbEhpc3RvcnlNYW5hZ2VyLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvQ2FsbE1hbmFnZXIudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXR0aW5ncy9jbGFzcy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1Bob25lL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvZXZlbnRzLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvdG9zL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvU2VydmljZXMvY2FsbGJhY2sudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXJ2aWNlcy9ldmVudHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXR0aW5ncy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1NldHRpbmdzL2V2ZW50cy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1BpZ2Vvbi9QaWdlb25TZXJ2aWNlLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGlnZW9uL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvSG9zdWluZy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0JsdWVQYWdlL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvR2FyYWdlL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvV2FsbGV0L2NhbGxiYWNrcy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0dyb3Vwcy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0hlYXJ0U3luYy9jYWxsYmFja3MudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9DcnlwdG8vY2FsbGJhY2tzLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvRGFpbHlTcGlucy9ldmVudHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvY2xhc3Nlcy9NeVNRTEFkYXB0ZXIudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvc3ZfbWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGZ1bmN0aW9uIERlbGF5KG1zOiBudW1iZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzID0+IHNldFRpbWVvdXQocmVzLCBtcykpO1xufTtcblxuZXhwb3J0IGNvbnN0IGRpc3RhbmNlQmV0d2VlbiA9IChwb3MxOiBudW1iZXJbXSwgcG9zMjogbnVtYmVyW10pID0+IHtcbiAgICByZXR1cm4gTWF0aC5oeXBvdChwb3MxWzBdIC0gcG9zMlswXSwgcG9zMVsxXSAtIHBvczJbMV0sIHBvczFbMl0gLSBwb3MyWzJdKVxufTtcblxuZXhwb3J0IGNvbnN0IGdlbmVyYXRlVVVpZCA9ICgpID0+IHtcbiAgICByZXR1cm4gXCJ4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHhcIi5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgIHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gXCJ4XCIgPyByIDogciAmIDB4MyB8IDB4ODtcbiAgICAgICAgcmV0dXJuIHYudG9TdHJpbmcoMTYpO1xuICAgIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IExPR0dFUiA9IChtZXNzYWdlOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gY29uc29sZS5sb2coYFxceDFiWzFtXFx4MWJbNDdtXFx4MWJbMzRtW0FTR0VSX1Bob25lXSBcXHgxYls0bVxceDFiWzMxbSR7bWVzc2FnZX1cXHgxYlswbWApXG59XG5cbmV4cG9ydCB0eXBlIEZyYW1ld29ya1R5cGUgPSAncWItY29yZScgfCAncWJ4X2NvcmUnO1xuZXhwb3J0IGNvbnN0IEZSQU1FV09SS19SRVNPVVJDRTogRnJhbWV3b3JrVHlwZSA9ICdxYi1jb3JlJzsgLy8gQ2hhbmdlIHRoaXMgdG8geW91ciBmcmFtZXdvcmsgY29yZSBxYi1jb3JlL3FieF9jb3JlXG5leHBvcnQgdHlwZSBJbnZlbnRvcnlUeXBlID0gJ2xqLWludmVudG9yeScgfCAnb3hfaW52ZW50b3J5JyB8ICdxYi1pbnZlbnRvcnknO1xuZXhwb3J0IGNvbnN0IElOVkVOVE9SWV9SRVNPVVJDRTogSW52ZW50b3J5VHlwZSA9ICdveF9pbnZlbnRvcnknOyAvLyBDaGFuZ2UgdGhpcyB0byB5b3VyIGludmVudG9yeSBzeXN0ZW0gb3hfaW52ZW50b3J5L3FiLWludmVudG9yeS9sai1pbnZlbnRvcnkgZXRjLi4uXG4iLCAiaW1wb3J0IHsgRnJhbWV3b3JrLCBNb25nb0RCLCBNeVNRTCB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCwgTE9HR0VSIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSwgSU5WRU5UT1JZX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxuY2xhc3MgVXRpbCB7XG4gICAgcHVibGljIGNvbnRhY3RzRGF0YTogYW55O1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmNvbnRhY3RzRGF0YSA9IFtdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgdGhlIGNpdGl6ZW4gSUQgZm9yIGEgcGxheWVyIGJ5IHRoZWlyIHNvdXJjZS5cbiAgICAgKiBGaXJzdCB0cmllcyB0aGUgZnJhbWV3b3JrIGV4cG9ydCwgdGhlbiBmYWxscyBiYWNrIHRvIEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKClcbiAgICAgKiBAcGFyYW0gc291cmNlIC0gVGhlIHBsYXllcidzIHNvdXJjZS9zZXJ2ZXIgSURcbiAgICAgKiBAcmV0dXJucyBUaGUgY2l0aXplbiBJRCBvciBudWxsIGlmIG5vdCBmb3VuZFxuICAgICAqL1xuICAgIGFzeW5jIEdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEZpcnN0IHRyeSB0aGUgZXhwb3J0IChpZiB1c2VyIGhhcyBhZGRlZCBpdCB0byB0aGVpciBxYi1jb3JlKVxuICAgICAgICAgICAgY29uc3QgZXhwb3J0RnVuYyA9IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXT8uR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2U7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4cG9ydEZ1bmMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBleHBvcnRGdW5jKHNvdXJjZSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCkgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gRXhwb3J0IGRvZXNuJ3QgZXhpc3Qgb3IgZmFpbGVkLCBmYWxsIHRocm91Z2ggdG8gZmFsbGJhY2tcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZhbGxiYWNrOiB1c2UgRnJhbWV3b3JrLkZ1bmN0aW9ucy5HZXRQbGF5ZXIoKVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGxheWVyID0gRnJhbWV3b3JrPy5GdW5jdGlvbnM/LkdldFBsYXllcj8uKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAocGxheWVyPy5QbGF5ZXJEYXRhPy5jaXRpemVuaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBMT0dHRVIoYEZhaWxlZCB0byBnZXQgY2l0aXplbiBJRCBmb3Igc291cmNlICR7c291cmNlfTogJHtlfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgYXN5bmMgbG9hZCgpIHtcbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCd0cmFuc2Zlck51bWJlcnMnLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5UcmFuc2Zlck51bWJlcnMoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCd0cmFuc2ZlckNvbnRhY3RzJywgYXN5bmMgKHNvdXJjZTogYW55LCBhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UgPT09IDApIHJldHVybiBMT0dHRVIoJ1RoaXMgY29tbWFuZCBjYW4gb25seSBiZSBleGVjdXRlZCBpbi1nYW1lLicpO1xuICAgICAgICAgICAgYXdhaXQgVXRpbHMuVHJhbnNmZXJDb250YWN0cygpO1xuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICBSZWdpc3RlckNvbW1hbmQoJ21pZ3JhdGVNdWx0aUpvYkRhdGEnLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5NaWdyYXRlTXVsdGlKb2JEYXRhKCk7XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIFJlZ2lzdGVyQ29tbWFuZCgnbWlncmF0ZVNvY2lldHknLCBhc3luYyAoc291cmNlOiBhbnksIGFyZ3M6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gMCkgcmV0dXJuIExPR0dFUignVGhpcyBjb21tYW5kIGNhbiBvbmx5IGJlIGV4ZWN1dGVkIGluLWdhbWUuJyk7XG4gICAgICAgICAgICBhd2FpdCBVdGlscy5NaWdyYXRlU29jaWV0eURhdGEoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG4gICAgfTtcblxuICAgIGFzeW5jIFRyYW5zZmVyTnVtYmVycygpIHtcbiAgICAgICAgbGV0IG5ld051bWJlcnM6IGFueVtdID0gW107XG4gICAgICAgIGxldCBuZXdTZXR0aW5nczogYW55W10gPSBbXTtcbiAgICAgICAgbGV0IG5ld0NhcmRzOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgIE15U1FMLnF1ZXJ5KCdTRUxFQ1QgY2l0aXplbmlkLCBjaGFyaW5mbyBGUk9NIHBsYXllcnMnLCBbXSwgYXN5bmMgKHJlc3VsdDogYW55W10pID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCByb3cgb2YgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG93bmVyID0gcm93LmNpdGl6ZW5pZDtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGNoYXJpbmZvID0gcm93LmNoYXJpbmZvO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHBhcnNlIGlmIHN0b3JlZCBhcyBKU09OIHN0cmluZ1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNoYXJpbmZvID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFyaW5mbyA9IEpTT04ucGFyc2UoY2hhcmluZm8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJpbmZvID0ge307XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBwcmVmZXIgY2hhcmluZm8ucGhvbmUsIGZhbGwgYmFjayB0byBwaG9uZV9udW1iZXJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbnVtYmVyID0gKGNoYXJpbmZvICYmIChjaGFyaW5mby5waG9uZSA/PyBjaGFyaW5mby5waG9uZV9udW1iZXIpKSB8fCBudWxsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIW51bWJlcikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCBpZiBwaG9uZSBudW1iZXIgYWxyZWFkeSBleGlzdHMgZm9yIHRoaXMgb3duZXJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG93bmVyIH0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmcpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIG5ld051bWJlcnMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBudW1iZXJcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJlcGFyZSBwaG9uZV9zZXR0aW5ncyBpZiBub3QgcHJlc2VudFxuICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ1NldHRpbmdzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBvd25lciB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFleGlzdGluZ1NldHRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdTZXR0aW5ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9ja3NjcmVlbjogeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByaW5ndG9uZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJpbmd0b25lczogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1cmw6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzTG9jazogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NrUGluOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VQaW46IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1c2VGYWNlSWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc21ydElkOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIHByZXBhcmUgcGhvbmVfcGxheWVyX2NhcmQgaWYgbm90IHByZXNlbnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdDYXJkID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9wbGF5ZXJfY2FyZCcsIHsgX2lkOiBvd25lciB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFleGlzdGluZ0NhcmQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5ld0NhcmRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogb3duZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlyc3ROYW1lOiAnU2V0dXAnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3ROYW1lOiAnQ2FyZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWFpbDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm90ZXM6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF2YXRhcjogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChuZXdOdW1iZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9udW1iZXJzJywgbmV3TnVtYmVycyk7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUihgSW5zZXJ0ZWQgJHtuZXdOdW1iZXJzLmxlbmd0aH0gcGhvbmVfbnVtYmVycy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9udW1iZXJzIHRvIGluc2VydC4nKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3U2V0dGluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE1hbnkoJ3Bob25lX3NldHRpbmdzJywgbmV3U2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3U2V0dGluZ3MubGVuZ3RofSBwaG9uZV9zZXR0aW5ncy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9zZXR0aW5ncyB0byBpbnNlcnQuJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG5ld0NhcmRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9wbGF5ZXJfY2FyZCcsIG5ld0NhcmRzKTtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBJbnNlcnRlZCAke25ld0NhcmRzLmxlbmd0aH0gcGhvbmVfcGxheWVyX2NhcmQgZW50cmllcy5gKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG5ldyBwaG9uZV9wbGF5ZXJfY2FyZCBlbnRyaWVzIHRvIGluc2VydC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoYFRyYW5zZmVyTnVtYmVycyBlcnJvcjogJHtlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBUcmFuc2ZlckNvbnRhY3RzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCB0aGlzLnF1ZXJ5KCdTRUxFQ1QgKiBGUk9NIHBob25lX3Bob25lX2NvbnRhY3RzJywgW10pO1xuXG4gICAgICAgICAgICBpZiAoIXJlc3VsdCB8fCByZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgTE9HR0VSKCdObyBjb250YWN0cyBmb3VuZCB0byB0cmFuc2Zlci4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtpbmRleCwgY29udGFjdF0gb2YgcmVzdWx0LmVudHJpZXMoKSkge1xuICAgICAgICAgICAgICAgIGlmIChpbmRleCA+IHJlc3VsdC5sZW5ndGgpIGJyZWFrO1xuICAgICAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGBQcm9jZXNzaW5nIGNvbnRhY3QgJHtpbmRleCArIDF9IG9mICR7cmVzdWx0Lmxlbmd0aH1gKTsgKi9cbiAgICAgICAgICAgICAgICBjb25zdCBvd25lcklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGNvbnRhY3QucGhvbmVfbnVtYmVyKTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRhY3RzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgcGVyc29uYWxOdW1iZXI6IGNvbnRhY3QucGhvbmVfbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBjb250YWN0TnVtYmVyOiBjb250YWN0LmNvbnRhY3RfcGhvbmVfbnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBmaXJzdE5hbWU6IGNvbnRhY3QuZmlyc3RuYW1lLFxuICAgICAgICAgICAgICAgICAgICBsYXN0TmFtZTogY29udGFjdC5sYXN0bmFtZSxcbiAgICAgICAgICAgICAgICAgICAgaW1hZ2U6IGNvbnRhY3QucHJvZmlsZV9pbWFnZSxcbiAgICAgICAgICAgICAgICAgICAgb3duZXJJZDogb3duZXJJZCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0TWFueSgncGhvbmVfY29udGFjdHMnLCB0aGlzLmNvbnRhY3RzRGF0YSk7XG4gICAgICAgICAgICBMT0dHRVIoJ1Bob25lIGNvbnRhY3RzIGhhdmUgYmVlbiB0cmFuc2ZlcnJlZCB0byBNb25nb0RCLicpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBMT0dHRVIoYEVycm9yIHdoaWxlIHRyYW5zZmVycmluZyBjb250YWN0czogJHtKU09OLnN0cmluZ2lmeShlLCBudWxsLCAyKX1gKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYyBNaWdyYXRlTXVsdGlKb2JEYXRhKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCB0aGlzLnF1ZXJ5KCdTRUxFQ1QgaWQsIGpvYm5hbWUsIGVtcGxveWVlcyBGUk9NIHBsYXllcl9qb2JzJywgW10pO1xuICAgICAgICAgICAgaWYgKCFyZXN1bHQgfHwgcmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIExPR0dFUignTm8gbXVsdGlqb2JzIGZvdW5kIHRvIHRyYW5zZmVyLicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbmV3RGF0YTogYW55W10gPSBbXTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCByb3cgb2YgcmVzdWx0KSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgam9iSWQgPSByb3cuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGpvYk5hbWUgPSByb3cuam9ibmFtZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFqb2JOYW1lKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBsZXQgZW1wbG95ZWVzID0gcm93LmVtcGxveWVlcztcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlbXBsb3llZXMpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZW1wbG95ZWVzID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbXBsb3llZXMgPSBKU09OLnBhcnNlKGVtcGxveWVlcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEZhaWxlZCB0byBwYXJzZSBlbXBsb3llZXMgSlNPTiBmb3Igam9iICR7am9iTmFtZX0gKGlkOiAke2pvYklkfSk6ICR7ZXJyfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlbXBsb3llZXMgfHwgdHlwZW9mIGVtcGxveWVlcyAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShlbXBsb3llZXMpKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIGVtcF0gb2YgT2JqZWN0LmVudHJpZXMoZW1wbG95ZWVzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2lkID0gKGVtcCAmJiAoZW1wLmNpZCB8fCBlbXAuQ0lEIHx8IGVtcC5jaXRpemVuSWQpKSB8fCBrZXk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBncmFkZUxldmVsID0gKGVtcCAmJiAoZW1wLmdyYWRlID8/IGVtcC5ncmFkZUxldmVsID8/IGVtcC5yYW5rKSkgPz8gMDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgam9iTGFiZWwgPSBGcmFtZXdvcms/LlNoYXJlZD8uSm9icz8uW2pvYk5hbWVdPy5sYWJlbCA/PyBqb2JOYW1lO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ3JhZGVMYWJlbCA9IEZyYW1ld29yaz8uU2hhcmVkPy5Kb2JzPy5bam9iTmFtZV0/LmdyYWRlcz8uW2dyYWRlTGV2ZWxdPy5uYW1lID8/ICcnO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdEYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2l0aXplbklkOiBjaWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgam9iTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmFkZUxldmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpvYkxhYmVsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyYWRlTGFiZWxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoaW5uZXJFcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBFcnJvciBwcm9jZXNzaW5nIHBsYXllcl9qb2JzIHJvdyBpZCAke3Jvdy5pZH06ICR7aW5uZXJFcnJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobmV3RGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCBuZXdEYXRhKTtcbiAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3RGF0YS5sZW5ndGh9IG11bHRpam9iIGVudHJpZXMgdG8gcGhvbmVfbXVsdGlqb2JzLmApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG11bHRpam9iIGVudHJpZXMgZm91bmQgdG8gaW5zZXJ0IGFmdGVyIHBhcnNpbmcuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgTE9HR0VSKGBNaWdyYXRlTXVsdGlKb2JEYXRhIGVycm9yOiAke2Vycn1gKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBhc3luYyBNaWdyYXRlU29jaWV0eURhdGEoKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgdGhpcy5xdWVyeSgnU0VMRUNUICogRlJPTSBhdl9zb2NpZXR5JywgW10pO1xuXG4gICAgICAgIHJlc3VsdC5mb3JFYWNoKGFzeW5jIChqb2I6IGFueSkgPT4ge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3N1bW1pdF9iYW5rJywgeyBfaWQ6IGpvYi5qb2IgfSwge1xuICAgICAgICAgICAgICAgIGJhbmtCYWxhbmNlOiBOdW1iZXIoam9iLm1vbmV5KVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSlcbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBhc3luYyBHZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbnVtYmVycycsIHsgb3duZXI6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5udW1iZXI7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5zbXJ0SWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEVtYWlsSWRCeVNvdXJjZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGVtYWlsID0gYXdhaXQgdGhpcy5HZXRFbWFpbElkQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICAgICAgcmV0dXJuIGVtYWlsO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9udW1iZXJzJywgeyBudW1iZXI6IHBob25lTnVtYmVyIH0pO1xuICAgICAgICBpZiAoIW51bWJlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gbnVtYmVyLm93bmVyO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRQbGF5ZXJGcm9tUGhvbmVOdW1iZXIocGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXIpO1xuICAgICAgICByZXR1cm4gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgfTtcblxuICAgIGFzeW5jIEJsb2NrTnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcsIHRhcmdldFBob25lTnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHRhcmdldFBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKCFjaXRpemVuSWQgfHwgIXRhcmdldENpdGl6ZW5JZCkgcmV0dXJuO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmxvY2tlZF9udW1iZXJzJywge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogY2l0aXplbklkLFxuICAgICAgICAgICAgdGFyZ2V0Q2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBVbmJsb2NrTnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcsIHRhcmdldFBob25lTnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHRhcmdldFBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKCFjaXRpemVuSWQgfHwgIXRhcmdldENpdGl6ZW5JZCkgcmV0dXJuO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfYmxvY2tlZF9udW1iZXJzJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCwgdGFyZ2V0Q2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQgfSk7XG4gICAgfTtcblxuICAgIGFzeW5jIElzTnVtYmVyQmxvY2tlZChwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgYmxvY2tlZCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmxvY2tlZF9udW1iZXJzJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCwgdGFyZ2V0Q2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQgfSk7XG4gICAgICAgIHJldHVybiBibG9ja2VkID8gdHJ1ZSA6IGZhbHNlO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDb250YWN0TmFtZUJ5TnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcsIGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNvbnRhY3QgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBjb250YWN0TnVtYmVyOiBwaG9uZU51bWJlciwgb3duZXJJZDogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAoIWNvbnRhY3QpIHJldHVybiBwaG9uZU51bWJlcjtcbiAgICAgICAgcmV0dXJuIGAke2NvbnRhY3QuZmlyc3ROYW1lfSAke2NvbnRhY3QubGFzdE5hbWV9YDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q29udGFjdEF2YXRhckJ5TnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcsIGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNvbnRhY3QgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBjb250YWN0TnVtYmVyOiBwaG9uZU51bWJlciwgb3duZXJJZDogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAoIWNvbnRhY3QpIHJldHVybiAnJztcbiAgICAgICAgcmV0dXJuIGNvbnRhY3QuaW1hZ2U7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFNvdXJjZUZyb21DaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3Qgc291cmNlID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgICAgIGlmICghc291cmNlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBzb3VyY2UuUGxheWVyRGF0YS5zb3VyY2U7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIEhhc1Bob25lKHBsYXllclNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIGNvbnN0IHBob25lTGlzdDogc3RyaW5nW10gPSBbXG4gICAgICAgICAgICAnYmx1ZV9waG9uZScsXG4gICAgICAgICAgICAnZ3JlZW5fcGhvbmUnLFxuICAgICAgICAgICAgJ3JlZF9waG9uZScsXG4gICAgICAgICAgICAnZ29sZF9waG9uZScsXG4gICAgICAgICAgICAncHVycGxlX3Bob25lJyxcbiAgICAgICAgXTtcblxuICAgICAgICBpZiAoSU5WRU5UT1JZX1JFU09VUkNFID09PSAnb3hfaW52ZW50b3J5Jykge1xuICAgICAgICAgICAgY29uc3QgaGFzSXRlbTogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IGV4cG9ydHNbJ294X2ludmVudG9yeSddLlNlYXJjaChcbiAgICAgICAgICAgICAgICBwbGF5ZXJTb3VyY2UsXG4gICAgICAgICAgICAgICAgJ2NvdW50JyxcbiAgICAgICAgICAgICAgICBwaG9uZUxpc3RcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcGhvbmUgb2YgcGhvbmVMaXN0KSB7XG4gICAgICAgICAgICAgICAgaWYgKGhhc0l0ZW1bcGhvbmVdID4gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwaG9uZUl0ZW0gb2YgcGhvbmVMaXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmUgLSBleHRlcm5hbCBpbnZlbnRvcnkgcmVzb3VyY2VcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGFzID0gYXdhaXQgZXhwb3J0c1tJTlZFTlRPUllfUkVTT1VSQ0VdLkhhc0l0ZW0ocGxheWVyU291cmNlLCBwaG9uZUl0ZW0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaGFzKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignSGFzUGhvbmUgY2hlY2sgZmFpbGVkOicsIGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBJbkZsaWdodE1vZGUoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFzZXR0aW5ncykgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gc2V0dGluZ3MuaXNGbGlnaHRNb2RlIHx8IGZhbHNlO1xuICAgIH07XG5cbiAgICBhc3luYyBxdWVyeShxdWVyeTogc3RyaW5nLCB2YWx1ZXM6IGFueSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgTXlTUUwucXVlcnkocXVlcnksIHZhbHVlcywgKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBpc1NlbmRlcktub3duKHNlbmRlcklkOiBzdHJpbmcsIHJlY2VpdmVySWQ6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICAvLyBRdWVyeSB0byBjaGVjayBpZiB0aGUgc2VuZGVyIGlzIGluIHRoZSByZWNlaXZlcidzIGNvbnRhY3RzXG4gICAgICAgIGNvbnN0IGNvbnRhY3RRdWVyeSA9IHtcbiAgICAgICAgICAgIG93bmVySWQ6IHJlY2VpdmVySWQsXG4gICAgICAgICAgICBjb250YWN0TnVtYmVyOiBzZW5kZXJJZFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFRyeSB0byBmaW5kIGEgY29udGFjdCBlbnRyeVxuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIGNvbnRhY3RRdWVyeSk7XG5cbiAgICAgICAgLy8gSWYgYSBjb250YWN0IGlzIGZvdW5kLCB0aGUgc2VuZGVyIGlzIGtub3duXG4gICAgICAgIHJldHVybiBjb250YWN0ICE9PSBudWxsO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRQaG9uZU51bWJlckJ5RW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBzbXJ0SWQ6IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIW51bWJlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gbnVtYmVyLnBob25lTnVtYmVyO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDaXRpemVuSWRCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgc21ydElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFBsYXllckJ5RW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5RW1haWwoZW1haWwpO1xuICAgICAgICByZXR1cm4gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldEF2YXRhckZyb21FbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGF2YXRvciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFhdmF0b3IpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGF2YXRvci5hdmF0YXI7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldFVzZXJOYW1lRnJvbUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiB1c2VyLnVzZXJuYW1lO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDaWRGcm9tVHdlZXRJZChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IHBpZ2VvbklkQXR0YWNoZWQ6IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIXJlcykgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gcmVzLl9pZDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2lkc0Zyb21QaWdlb25FbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX3NldHRpbmdzJywgeyBwaWdlb25JZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMgfHwgcmVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuICAgICAgICByZXR1cm4gcmVzLm1hcCgoc2V0dGluZzogYW55KSA9PiBzZXR0aW5nLl9pZCk7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENpZEZyb21EYXJrRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBkYXJrTWFpbElkQXR0YWNoZWQ6IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIXJlcykgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gcmVzLl9pZDtcbiAgICB9O1xuXG4gICAgYXN5bmMgSXNQbGF5ZXJJbkphaWwoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghcGxheWVyKSByZXR1cm4gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IG1ldGFkYXRhID0gcGxheWVyLlBsYXllckRhdGEubWV0YWRhdGE7XG4gICAgICAgICAgICByZXR1cm4gbWV0YWRhdGEgJiYgbWV0YWRhdGEuaW5qYWlsICYmIG1ldGFkYXRhLmluamFpbCA+IDA7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIGFzeW5jIGdldEpvYnMoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3Qgam9iczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICAgICAgICBjb25zdCBlbXBsb3llZXM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIGFueT4+ID0ge307XG5cbiAgICAgICAgLy8gZmluZCBhbGwgbXVsdGlqb2IgZW50cmllcyBmb3IgdGhpcyBjaXRpemVuXG4gICAgICAgIGNvbnN0IG15RW50cmllczogYW55W10gPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFteUVudHJpZXMgfHwgbXlFbnRyaWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHsgam9icywgZW1wbG95ZWVzIH07XG5cbiAgICAgICAgLy8gY29sbGVjdCB1bmlxdWUgam9iIG5hbWVzIHNvIHdlIGNhbiBmZXRjaCBhbGwgZW1wbG95ZWVzIGZvciB0aG9zZSBqb2JzIGluIG9uZSBxdWVyeVxuICAgICAgICBjb25zdCBqb2JOYW1lcyA9IEFycmF5LmZyb20obmV3IFNldChteUVudHJpZXMubWFwKGUgPT4gZS5qb2JOYW1lKSkpO1xuXG4gICAgICAgIC8vIGJ1aWxkIGpvYnMgbWFwIChvbmUgZW50cnkgcGVyIGpvYiB0aGlzIGNpZCBoYXMpXG4gICAgICAgIGZvciAoY29uc3QgZSBvZiBteUVudHJpZXMpIHtcbiAgICAgICAgICAgIGpvYnNbZS5qb2JOYW1lXSA9IHtcbiAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IGUuY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIGpvYk5hbWU6IGUuam9iTmFtZSxcbiAgICAgICAgICAgICAgICBncmFkZUxldmVsOiBlLmdyYWRlTGV2ZWwgPz8gMCxcbiAgICAgICAgICAgICAgICBqb2JMYWJlbDogZS5qb2JMYWJlbCA/PyBGcmFtZXdvcms/LlNoYXJlZD8uSm9icz8uW2Uuam9iTmFtZV0/LmxhYmVsID8/IGUuam9iTmFtZSxcbiAgICAgICAgICAgICAgICBncmFkZUxhYmVsOiBlLmdyYWRlTGFiZWwgPz8gRnJhbWV3b3JrPy5TaGFyZWQ/LkpvYnM/LltlLmpvYk5hbWVdPy5ncmFkZXM/LltlLmdyYWRlTGV2ZWxdPy5uYW1lID8/ICcnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmV0Y2ggYWxsIGVtcGxveWVlcyBmb3IgdGhlIGNvbGxlY3RlZCBqb2JzIGFuZCBidWlsZCBlbXBsb3llZXMgbWFwOiB7IGpvYk5hbWU6IHsgY2lkOiB7Li4ufSwgLi4uIH0sIC4uLiB9XG4gICAgICAgIGNvbnN0IGFsbEVtcGxveWVlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX211bHRpam9icycsIHsgam9iTmFtZTogeyAkaW46IGpvYk5hbWVzIH0gfSk7XG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgYWxsRW1wbG95ZWVzKSB7XG4gICAgICAgICAgICBlbXBsb3llZXNbZW50cnkuam9iTmFtZV0gPSBlbXBsb3llZXNbZW50cnkuam9iTmFtZV0gfHwge307XG4gICAgICAgICAgICBlbXBsb3llZXNbZW50cnkuam9iTmFtZV1bZW50cnkuY2l0aXplbklkXSA9IHtcbiAgICAgICAgICAgICAgICBjaWQ6IGVudHJ5LmNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBncmFkZTogZW50cnkuZ3JhZGVMZXZlbCA/PyAwLFxuICAgICAgICAgICAgICAgIGdyYWRlTGFiZWw6IGVudHJ5LmdyYWRlTGFiZWwgPz8gJycsXG4gICAgICAgICAgICAgICAgam9iTGFiZWw6IGVudHJ5LmpvYkxhYmVsID8/ICcnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgam9icywgZW1wbG95ZWVzIH07XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgVXRpbHMgPSBuZXcgVXRpbCgpOyIsICJpbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgUGhvbmVNYWlsLCBQaG9uZU1haWxNZXNzYWdlIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5cbmNsYXNzIE1haWwge1xuICAgIGFzeW5jIGdldE1haWxNZXNzYWdlcyhlbWFpbDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKSB7XG4gICAgICAgIGlmICghZW1haWwgJiYgIXBhc3N3b3JkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhIHx8IG1haWxEYXRhLm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbWFpbERhdGEubWVzc2FnZXMgPSBbXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG1haWxEYXRhLm1lc3NhZ2VzID0gbWFpbERhdGEubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IG5ldyBEYXRlKGIuZGF0ZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5kYXRlKS5nZXRUaW1lKCkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG1haWxEYXRhLm1lc3NhZ2VzKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgc2VuZE1haWwoZW1haWw6IHN0cmluZywgdG86IHN0cmluZywgc3ViamVjdDogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIGltYWdlczogc3RyaW5nW10sIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHBsYXllciA9IGVtYWlsO1xuICAgICAgICBjb25zdCB0YXJnZXQgPSB0bztcblxuICAgICAgICBjb25zdCBwbGF5ZXJNYWlsOiBQaG9uZU1haWwgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogcGxheWVyIH0pO1xuICAgICAgICBjb25zdCB0YXJnZXRNYWlsOiBQaG9uZU1haWwgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogdGFyZ2V0IH0pO1xuICAgICAgICBpZiAoIXBsYXllck1haWwgfHwgIXRhcmdldE1haWwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgbmV3TWFpbE1lc3NhZ2U6IFBob25lTWFpbE1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgZnJvbTogcGxheWVyLFxuICAgICAgICAgICAgdG86IHRhcmdldCxcbiAgICAgICAgICAgIGF2YXRhcjogYXdhaXQgVXRpbHMuR2V0QXZhdGFyRnJvbUVtYWlsKHRhcmdldCksXG4gICAgICAgICAgICB1c2VybmFtZTogYXdhaXQgVXRpbHMuR2V0VXNlck5hbWVGcm9tRW1haWwodGFyZ2V0KSxcbiAgICAgICAgICAgIHN1YmplY3Q6IHN1YmplY3QsXG4gICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLCBcbiAgICAgICAgICAgIGltYWdlczogaW1hZ2VzLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgcmVhZDogdHJ1ZSxcbiAgICAgICAgICAgIHRhZ3M6IFsnaW5ib3gnLCAnc2VudCddXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0TWFpbG1lc3NhZ2U6IFBob25lTWFpbE1lc3NhZ2UgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgZnJvbTogcGxheWVyLFxuICAgICAgICAgICAgdG86IHRhcmdldCxcbiAgICAgICAgICAgIGF2YXRhcjogYXdhaXQgVXRpbHMuR2V0QXZhdGFyRnJvbUVtYWlsKHBsYXllciksXG4gICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgIHVzZXJuYW1lOiBhd2FpdCBVdGlscy5HZXRVc2VyTmFtZUZyb21FbWFpbChwbGF5ZXIpLFxuICAgICAgICAgICAgaW1hZ2VzOiBpbWFnZXMsXG4gICAgICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICByZWFkOiBmYWxzZSxcbiAgICAgICAgICAgIHRhZ3M6IFsnaW5ib3gnXVxuICAgICAgICB9XG4gICAgICAgIHBsYXllck1haWwubWVzc2FnZXMucHVzaChuZXdNYWlsTWVzc2FnZSk7XG4gICAgICAgIHRhcmdldE1haWwubWVzc2FnZXMucHVzaCh0YXJnZXRNYWlsbWVzc2FnZSk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHBsYXllciB9LCBwbGF5ZXJNYWlsKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogdGFyZ2V0IH0sIHRhcmdldE1haWwpO1xuXG4gICAgICAgIGNvbnN0IHRhcmdldENpZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckJ5RW1haWwodGFyZ2V0KTtcbiAgICAgICAgcGxheWVyTWFpbC5tZXNzYWdlcy5zb3J0KChhOiBhbnksIGI6IGFueSkgPT4gbmV3IERhdGUoYi5kYXRlKS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLmRhdGUpLmdldFRpbWUoKSk7XG4gICAgICAgIHRhcmdldE1haWwubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IG5ldyBEYXRlKGIuZGF0ZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5kYXRlKS5nZXRUaW1lKCkpO1xuXG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaG1haWxNZXNzYWdlcycsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkocGxheWVyTWFpbC5tZXNzYWdlcykpO1xuICAgICAgICBpZiAodGFyZ2V0Q2lkKSB7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXRDaWQuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNYWlsJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGEgbmV3IG1haWwgZnJvbSAke3BsYXllcn0uYCxcbiAgICAgICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNobWFpbE1lc3NhZ2VzJywgdGFyZ2V0Q2lkLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh0YXJnZXRNYWlsLm1lc3NhZ2VzKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIGFzeW5jIHNlbmRFbWFpbFRvQWxsKHN1YmplY3Q6IHN0cmluZywgc2VuZGVyOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZywgaW1hZ2VzOiBzdHJpbmdbXSkge1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogeyAkbmU6IG51bGwgfSB9KTtcbiAgICAgICAgaWYgKCFtYWlsRGF0YSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBtYWlsRGF0YS5mb3JFYWNoKGFzeW5jIChtYWlsOiBQaG9uZU1haWwpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG5ld01haWxNZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgZnJvbTogc2VuZGVyLFxuICAgICAgICAgICAgICAgIHRvOiBtYWlsLmFjdGl2ZU1haWRJZCxcbiAgICAgICAgICAgICAgICBhdmF0YXI6ICcnLFxuICAgICAgICAgICAgICAgIHN1YmplY3Q6IHN1YmplY3QsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgICAgICBpbWFnZXM6IGltYWdlcyB8fCBbXSxcbiAgICAgICAgICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgdGFnczogWydpbmJveCddLFxuICAgICAgICAgICAgICAgIHVzZXJuYW1lOiBzZW5kZXJcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBtYWlsLm1lc3NhZ2VzLnB1c2gobmV3TWFpbE1lc3NhZ2UpO1xuICAgICAgICAgICAgLy9AdHMtaWdub3JlXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBtYWlsLl9pZCB9LCBtYWlsKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIC0xLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogJ01haWwnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBhIG5ldyBtYWlsLCAke21lc3NhZ2V9LmAsXG4gICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgIH0pKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIGFzeW5jIHNlbGVjdGVNZXNzYWdlKGRhdGE6IHN0cmluZykge1xuICAgICAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgeyBtZXNzYWdlSWQsIG1haWxJZCB9ID0gcGFyc2VkRGF0YTtcbiAgICAgICAgY29uc3QgbWFpbERhdGE6IFBob25lTWFpbCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBtYWlsSWQgfSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IG1haWxEYXRhLm1lc3NhZ2VzLmZpbmQoKG0pID0+IG0uX2lkID09PSBtZXNzYWdlSWQpO1xuICAgICAgICBpZiAoIW1lc3NhZ2UpIHJldHVybiBmYWxzZTtcbiAgICAgICAgbWVzc2FnZS5yZWFkID0gdHJ1ZTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbElkIH0sIG1haWxEYXRhKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIGFzeW5jIGdldFByb2ZpbGVTZXR0aW5ncyhlbWFpbDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kQW5kUmV0dXJuU3BlY2lmaWNGaWVsZHMoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwsIGFjdGl2ZU1haWxQYXNzd29yZDogcGFzc3dvcmQgfSwgWydhY3RpdmVNYWlkSWQnLCAnYWN0aXZlTWFpbFBhc3N3b3JkJywgJ2F2YXRhcicsICd1c2VybmFtZSddKTtcbiAgICAgICAgaWYgKCFtYWlsRGF0YSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobWFpbERhdGEpO1xuICAgIH07XG5cbiAgICBhc3luYyB1cGRhdGVQcm9maWxlU2V0dGluZ3MoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZywgdXNlcm5hbWU6IHN0cmluZywgYXZhdGFyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbWFpbERhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwsIGFjdGl2ZU1haWxQYXNzd29yZDogcGFzc3dvcmQgfSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgbWFpbERhdGEudXNlcm5hbWUgPSB1c2VybmFtZTtcbiAgICAgICAgbWFpbERhdGEuYXZhdGFyID0gYXZhdGFyO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCwgYWN0aXZlTWFpbFBhc3N3b3JkOiBwYXNzd29yZCB9LCBtYWlsRGF0YSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG59XG5cbmV4cG9ydCBjb25zdCBNYWlsQ2xhc3MgPSBuZXcgTWFpbCgpOyIsICJpbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiLi9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBNYWlsQ2xhc3MgfSBmcm9tIFwiLi9hcHBzL01haWwvY2xhc3NcIjtcblxuYXN5bmMgZnVuY3Rpb24gR2V0Q3VycmVudFBob25lTnVtYmVyKHNvdXJjZTogbnVtYmVyIHwgc3RyaW5nKSB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlIGFzIG51bWJlcik7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn1cbmV4cG9ydHMoJ0dldEN1cnJlbnRQaG9uZU51bWJlcicsIEdldEN1cnJlbnRQaG9uZU51bWJlcik7XG5cbmFzeW5jIGZ1bmN0aW9uIEdldEN1cnJlbnRQaG9uZU51bWJlckJ5Q2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgY29uc3QgbnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIHJldHVybiBudW1iZXI7XG59XG5leHBvcnRzKCdHZXRDdXJyZW50UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZCcsIEdldEN1cnJlbnRQaG9uZU51bWJlckJ5Q2l0aXplbklkKTtcblxuYXN5bmMgZnVuY3Rpb24gR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgY29uc3QgZW1haWwgPSBhd2FpdCBVdGlscy5HZXRFbWFpbElkQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICByZXR1cm4gZW1haWw7XG59XG5leHBvcnRzKCdHZXRFbWFpbElkQnlDaXRpemVuSWQnLCBHZXRFbWFpbElkQnlDaXRpemVuSWQpO1xuXG5hc3luYyBmdW5jdGlvbiBHZXRFbWFpbElkQnlTb3VyY2Uoc291cmNlOiBudW1iZXIgfCBzdHJpbmcpIHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UgYXMgbnVtYmVyKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGVtYWlsID0gYXdhaXQgVXRpbHMuR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIGVtYWlsO1xufVxuZXhwb3J0cygnR2V0RW1haWxJZEJ5U291cmNlJywgR2V0RW1haWxJZEJ5U291cmNlKTtcblxuYXN5bmMgZnVuY3Rpb24gU2VuZE5vdGlmaWNhdGlvbihzb3VyY2U6IG51bWJlciB8IHN0cmluZywgdGl0bGU6IHN0cmluZywgZGVzY3JpcHRpb246IHN0cmluZywgYXBwOiBzdHJpbmcsIHRpbWVvdXQ/OiBudW1iZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgYXBwLFxuICAgICAgICB0aW1lb3V0OiB0aW1lb3V0IHx8IDUwMDAsXG4gICAgfSkpO1xufVxuZXhwb3J0cygnU2VuZE5vdGlmaWNhdGlvbicsIFNlbmROb3RpZmljYXRpb24pO1xuXG5hc3luYyBmdW5jdGlvbiBTZW5kTWFpbChkYXRhOiB7XG4gICAgZW1haWw6IHN0cmluZztcbiAgICB0bzogc3RyaW5nO1xuICAgIHN1YmplY3Q6IHN0cmluZztcbiAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgaW1hZ2VzOiBzdHJpbmdbXTtcbiAgICBzb3VyY2U6IG51bWJlcjtcbn0pIHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNYWlsQ2xhc3Muc2VuZE1haWwoZGF0YS5lbWFpbCwgZGF0YS50bywgZGF0YS5zdWJqZWN0LCBkYXRhLm1lc3NhZ2UsIGRhdGEuaW1hZ2VzLCBkYXRhLnNvdXJjZSk7XG4gICAgcmV0dXJuIHJlcztcbn1cbmV4cG9ydHMoJ1NlbmRNYWlsJywgU2VuZE1haWwpO1xuXG5hc3luYyBmdW5jdGlvbiBTZW5kTWFpbFRvQWxsKGRhdGE6IHtcbiAgICBzdWJqZWN0OiBzdHJpbmc7XG4gICAgc2VuZGVyOiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGltYWdlczogc3RyaW5nW107XG59KSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbmRFbWFpbFRvQWxsKGRhdGEuc3ViamVjdCwgZGF0YS5zZW5kZXIsZGF0YS5tZXNzYWdlLCBkYXRhLmltYWdlcyk7XG4gICAgcmV0dXJuIHJlcztcbn1cbmV4cG9ydHMoJ1NlbmRNYWlsVG9BbGwnLCBTZW5kTWFpbFRvQWxsKTtcblxuY29uc3QgR2V0Sm9icyA9IGFzeW5jIChjaXRpemVuSWQ6IHN0cmluZykgPT4ge1xuICAgIGlmICghY2l0aXplbklkKSByZXR1cm4ge307XG4gICAgY29uc3QgcmVzID0gYXdhaXQgVXRpbHMuZ2V0Sm9icyhjaXRpemVuSWQpO1xuICAgIHJldHVybiByZXMuam9icyB8fCB7fTtcbn07XG5leHBvcnRzKCdnZXRKb2JzJywgR2V0Sm9icyk7XG5cbi8vIE9wdGlvbmFsOiByZXR1cm4gZnVsbCByZXN1bHQgeyBqb2JzLCBlbXBsb3llZXMgfVxuY29uc3QgR2V0Sm9ic0Z1bGwgPSBhc3luYyAoY2l0aXplbklkOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgam9iczoge30sIGVtcGxveWVlczoge30gfTtcbiAgICByZXR1cm4gYXdhaXQgVXRpbHMuZ2V0Sm9icyhjaXRpemVuSWQpO1xufTtcbmV4cG9ydHMoJ2dldEpvYnNGdWxsJywgR2V0Sm9ic0Z1bGwpOyIsICJjb25zdCBjYWNoZUV2ZW50cyA9IHt9O1xuZXhwb3J0IGNvbnN0IGNhY2hlID0gbmV3IFByb3h5KHtcbiAgICByZXNvdXJjZTogR2V0Q3VycmVudFJlc291cmNlTmFtZSgpLFxuICAgIGdhbWU6IEdldEdhbWVOYW1lKCksXG59LCB7XG4gICAgZ2V0KHRhcmdldCwga2V5KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGtleSA/IHRhcmdldFtrZXldIDogdGFyZ2V0O1xuICAgICAgICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICBjYWNoZUV2ZW50c1trZXldID0gW107XG4gICAgICAgIEFkZEV2ZW50SGFuZGxlcihgb3hfbGliOmNhY2hlOiR7a2V5fWAsICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb2xkVmFsdWUgPSB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IGNhY2hlRXZlbnRzW2tleV07XG4gICAgICAgICAgICBldmVudHMuZm9yRWFjaCgoY2IpID0+IGNiKHZhbHVlLCBvbGRWYWx1ZSkpO1xuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRhcmdldFtrZXldID0gZXhwb3J0cy5veF9saWIuY2FjaGUoa2V5KSB8fCBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRhcmdldFtrZXldO1xuICAgIH0sXG59KTtcbmV4cG9ydCBjb25zdCBvbkNhY2hlID0gKGtleSwgY2IpID0+IHtcbiAgICBpZiAoIWNhY2hlRXZlbnRzW2tleV0pXG4gICAgICAgIGNhY2hlW2tleV07XG4gICAgY2FjaGVFdmVudHNba2V5XS5wdXNoKGNiKTtcbn07XG4iLCAiaW1wb3J0IHsgY2FjaGUgfSBmcm9tICcuLi9jYWNoZSc7XG5jb25zdCBwZW5kaW5nQ2FsbGJhY2tzID0ge307XG5jb25zdCBjYWxsYmFja1RpbWVvdXQgPSBHZXRDb252YXJJbnQoJ294OmNhbGxiYWNrVGltZW91dCcsIDMwMDAwMCk7XG5vbk5ldChgX19veF9jYl8ke2NhY2hlLnJlc291cmNlfWAsIChrZXksIC4uLmFyZ3MpID0+IHtcbiAgICBjb25zdCByZXNvbHZlID0gcGVuZGluZ0NhbGxiYWNrc1trZXldO1xuICAgIGRlbGV0ZSBwZW5kaW5nQ2FsbGJhY2tzW2tleV07XG4gICAgcmV0dXJuIHJlc29sdmUgJiYgcmVzb2x2ZSguLi5hcmdzKTtcbn0pO1xuZXhwb3J0IGZ1bmN0aW9uIHRyaWdnZXJDbGllbnRDYWxsYmFjayhldmVudE5hbWUsIHBsYXllcklkLCAuLi5hcmdzKSB7XG4gICAgbGV0IGtleTtcbiAgICBkbyB7XG4gICAgICAgIGtleSA9IGAke2V2ZW50TmFtZX06JHtNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoMTAwMDAwICsgMSkpfToke3BsYXllcklkfWA7XG4gICAgfSB3aGlsZSAocGVuZGluZ0NhbGxiYWNrc1trZXldKTtcbiAgICBlbWl0TmV0KGBfX294X2NiXyR7ZXZlbnROYW1lfWAsIHBsYXllcklkLCBjYWNoZS5yZXNvdXJjZSwga2V5LCAuLi5hcmdzKTtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBwZW5kaW5nQ2FsbGJhY2tzW2tleV0gPSByZXNvbHZlO1xuICAgICAgICBzZXRUaW1lb3V0KHJlamVjdCwgY2FsbGJhY2tUaW1lb3V0LCBgY2FsbGJhY2sgZXZlbnQgJyR7a2V5fScgdGltZWQgb3V0YCk7XG4gICAgfSk7XG59XG5leHBvcnQgZnVuY3Rpb24gb25DbGllbnRDYWxsYmFjayhldmVudE5hbWUsIGNiKSB7XG4gICAgb25OZXQoYF9fb3hfY2JfJHtldmVudE5hbWV9YCwgYXN5bmMgKHJlc291cmNlLCBrZXksIC4uLmFyZ3MpID0+IHtcbiAgICAgICAgY29uc3Qgc3JjID0gc291cmNlO1xuICAgICAgICBsZXQgcmVzcG9uc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXNwb25zZSA9IGF3YWl0IGNiKHNyYywgLi4uYXJncyk7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYGFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGhhbmRsaW5nIGNhbGxiYWNrIGV2ZW50ICR7ZXZlbnROYW1lfWApO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYF4zJHtlLnN0YWNrfV4wYCk7XG4gICAgICAgIH1cbiAgICAgICAgZW1pdE5ldChgX19veF9jYl8ke3Jlc291cmNlfWAsIHNyYywga2V5LCByZXNwb25zZSk7XG4gICAgfSk7XG59XG4iLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFBob25lQ29udGFjdHMgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6Z2V0Q29udGFjdHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBjb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2NvbnRhY3RzJywgeyBvd25lcklkOiBjaXRpemVuSWQgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNvbnRhY3RzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czpzYXZlQ29udGFjdCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNvbnRhY3REYXRhOiBQaG9uZUNvbnRhY3RzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBpZiAoY29udGFjdERhdGEuX2lkKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBjb250YWN0RGF0YS5faWQgfSwgeyAuLi5jb250YWN0RGF0YSB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdDb250YWN0IFVwZGF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYENvbnRhY3QgJyR7Y29udGFjdERhdGEuZmlyc3ROYW1lfScke2NvbnRhY3REYXRhLmxhc3ROYW1lfScgKE51bWJlcjogJHtjb250YWN0RGF0YS5jb250YWN0TnVtYmVyfSkgdXBkYXRlZCBieSAke2NvbnRhY3REYXRhLnBlcnNvbmFsTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6YWRkQ29udGFjdCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgY29udGFjdERhdGE6IFBob25lQ29udGFjdHMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGRhdGFYID0geyAuLi5jb250YWN0RGF0YSwgb3duZXJJZDogY2l0aXplbklkLCBwZXJzb25hbE51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfY29udGFjdHMnLCBkYXRhWCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9jb250YWN0cycsXG4gICAgICAgIHRpdGxlOiAnQ29udGFjdCBBZGRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3REYXRhLmZpcnN0TmFtZX0nJHtjb250YWN0RGF0YS5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdERhdGEuY29udGFjdE51bWJlcn0pIGFkZGVkIGJ5ICR7ZGF0YVgucGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YVgpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOmRlbGV0ZUNvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBfaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNvbnRhY3QgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9KTtcbiAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogX2lkIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICB0aXRsZTogJ0NvbnRhY3QgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3QuZmlyc3ROYW1lfScgJyR7Y29udGFjdC5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdC5jb250YWN0TnVtYmVyfSkgZGVsZXRlZCBieSAke2NvbnRhY3QucGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czpmYXZDb250YWN0JywgYXN5bmMgKGNsaWVudCwgX2lkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSk7XG4gICAgY29uc3QgZGF0YVggPSB7IC4uLmNvbnRhY3QsIGlzRmF2OiAhY29udGFjdC5pc0ZhdiB9XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9LCBkYXRhWCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9jb250YWN0cycsXG4gICAgICAgIHRpdGxlOiAnQ29udGFjdCBGYXZvcml0ZSBUb2dnbGVkJyxcbiAgICAgICAgbWVzc2FnZTogYENvbnRhY3QgJyR7Y29udGFjdC5maXJzdE5hbWV9JyAnJHtjb250YWN0Lmxhc3ROYW1lfScgKE51bWJlcjogJHtjb250YWN0LmNvbnRhY3ROdW1iZXJ9KSBmYXZvcml0ZSBzdGF0dXMgc2V0IHRvICR7ZGF0YVguaXNGYXZ9IGJ5ICR7Y29udGFjdC5wZXJzb25hbE51bWJlcn0uYCxcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YVgpO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRGFya0NoYXRDaGFubmVsIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcblxub25DbGllbnRDYWxsYmFjaygnU2VhcmNoRGFya0NoYXRFbWFpbCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdSZWdpc3Rlck5ld0RhcmtNYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsLCBlbWFpbCwgcGFzc3dvcmQsIGF2YXRhcjogXCJcIiB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2FjY291bnRzJyxcbiAgICAgICAgdGl0bGU6ICdBY2NvdW50IFJlZ2lzdGVyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTmV3IERhcmtDaGF0IGFjY291bnQgcmVnaXN0ZXJlZCB3aXRoIGVtYWlsICR7ZW1haWx9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdMb2dpbkRhcmtNYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgZW1haWw6IHN0cmluZztcbiAgICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogcGFyc2VkRGF0YS5lbWFpbCB9KTtcbiAgICBpZiAocmVzLnBhc3N3b3JkID09PSBwYXJzZWREYXRhLnBhc3N3b3JkKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2FjY291bnRzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQWNjb3VudCBMb2dpbicsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciBsb2dnZWQgaW50byBEYXJrQ2hhdCB3aXRoIGVtYWlsICR7cGFyc2VkRGF0YS5lbWFpbH0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnQ3JlYXRlTmV3RGFya0NoYW5uZWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IG5hbWUsIGVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlczI6IERhcmtDaGF0Q2hhbm5lbFtdID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7fSk7XG4gICAgaWYgKHJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKSAmJiAhcmVzMi5maW5kKChjaGFubmVsKSA9PiBjaGFubmVsLm5hbWUgPT09IG5hbWUpPy5tZW1iZXJzLmluY2x1ZGVzKGVtYWlsKSkge1xuICAgICAgICByZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSk/Lm1lbWJlcnMucHVzaChlbWFpbCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgbmFtZSB9LCByZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgICAgICB0aXRsZTogJ0pvaW5lZCBDaGFubmVsJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSBqb2luZWQgZXhpc3RpbmcgRGFya0NoYXQgY2hhbm5lbCAnJHtuYW1lfScuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMyLmZpbHRlcigoY2hhbm5lbCkgPT4gY2hhbm5lbC5tZW1iZXJzLmluY2x1ZGVzKGVtYWlsKSkpO1xuICAgIH0gZWxzZSBpZiAoIXJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKSkge1xuICAgICAgICBjb25zdCBuZXdEYXRhID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICBtZW1iZXJzOiBbZW1haWxdLFxuICAgICAgICAgICAgY3JlYXRvcjogZW1haWwsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIG5ld0RhdGEpO1xuICAgICAgICByZXMyLnB1c2gobmV3RGF0YSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ2hhbm5lbCBDcmVhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSBjcmVhdGVkIG5ldyBEYXJrQ2hhdCBjaGFubmVsICcke25hbWV9Jy5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlczIuZmlsdGVyKChjaGFubmVsKSA9PiBjaGFubmVsLm1lbWJlcnMuaW5jbHVkZXMoZW1haWwpKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdHZXREYXJrQ2hhdFByb2ZpbGUnLCBhc3luYyAoY2xpZW50LCBlbWFpbDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0dldERhcmtDaGF0Q2hhbm5lbHMnLCBhc3luYyAoY2xpZW50LCBlbWFpbDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IG1lbWJlcnM6IGVtYWlsIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1JlbW92ZUZyb21EYXJrQ2hhbm5lbCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgX2lkLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBfaWQgfSk7XG4gICAgaWYgKHJlcy5jcmVhdG9yID09PSBlbWFpbCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IF9pZCB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdDaGFubmVsIERlbGV0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IGRlbGV0ZWQgRGFya0NoYXQgY2hhbm5lbCAnJHtyZXMubmFtZX0nIChJRDogJHtfaWR9KS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXMubWVtYmVycyA9IHJlcy5tZW1iZXJzLmZpbHRlcigobWVtYmVyOiBzdHJpbmcpID0+IG1lbWJlciAhPT0gZW1haWwpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IF9pZCB9LCByZXMpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgICAgICB0aXRsZTogJ0xlZnQgQ2hhbm5lbCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gbGVmdCBEYXJrQ2hhdCBjaGFubmVsICcke3Jlcy5uYW1lfScgKElEOiAke19pZH0pLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdVcGRhdGVEYXJrQXZhdGFyJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBlbWFpbCwgYXZhdGFyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9KTtcbiAgICByZXMuYXZhdGFyID0gYXZhdGFyO1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGVtYWlsIH0sIHJlcyk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9hY2NvdW50cycsXG4gICAgICAgIHRpdGxlOiAnQXZhdGFyIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gdXBkYXRlZCB0aGVpciBEYXJrQ2hhdCBhdmF0YXIuYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1VwZGF0ZURhcmtQYXNzd29yZCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9KTtcbiAgICByZXMucGFzc3dvcmQgPSBwYXNzd29yZDtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9LCByZXMpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfYWNjb3VudHMnLFxuICAgICAgICB0aXRsZTogJ1Bhc3N3b3JkIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gdXBkYXRlZCB0aGVpciBEYXJrQ2hhdCBwYXNzd29yZC5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnU2V0RGFya0NoYXRNZXNzYWdlcycsIGFzeW5jIChjbGllbnQsIGRhdGFYOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGNoYW5uZWwsIGRhdGEgfSA9IEpTT04ucGFyc2UoZGF0YVgpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgX2lkOiBjaGFubmVsIH0sIGRhdGEpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgU2VudCcsXG4gICAgICAgIG1lc3NhZ2U6IGBNZXNzYWdlIHNlbnQgaW4gRGFya0NoYXQgY2hhbm5lbCAnJHtkYXRhLm5hbWV9JyAoSUQ6ICR7Y2hhbm5lbH0pLCBDb250ZW50OiAke2RhdGEuY29udGVudH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIGRhdGEubWVtYmVycy5mb3JFYWNoKGFzeW5jIChtZW1iZXI6IHN0cmluZykgPT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKGF3YWl0IFV0aWxzLkdldENpZEZyb21EYXJrRW1haWwobWVtYmVyKSk7XG4gICAgICAgIGlmICghcmVzKSByZXR1cm47XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVjZWl2ZURhcmtDaGF0TWVzc2FnZScsIHJlcywgSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuICAgICAgICBpZiAocmVzICE9PSBjbGllbnQpIHtcbiAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlcywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ0RhcmtDaGF0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGEgbmV3IG1lc3NhZ2UgaW4gJHtkYXRhLm5hbWV9LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBNYWlsQ2xhc3MgfSBmcm9tIFwiLi9jbGFzc1wiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpnZXRFbWFpbE1lc3NhZ2VzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBlbWFpbDogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IE1haWxDbGFzcy5nZXRNYWlsTWVzc2FnZXMoZW1haWwsIHBhc3N3b3JkKVxuICAgIHJldHVybiBkYXRhO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZW5kRW1haWwnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGVtYWlsOiBzdHJpbmcsIHRvOiBzdHJpbmcsIHN1YmplY3Q6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nLCBpbWFnZXM6IHN0cmluZ1tdKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbmRNYWlsKGVtYWlsLCB0bywgc3ViamVjdCwgbWVzc2FnZSwgaW1hZ2VzLCBzb3VyY2UpO1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9tYWlsJyxcbiAgICAgICAgdGl0bGU6ICdFbWFpbCBTZW50JyxcbiAgICAgICAgbWVzc2FnZTogYFBsYXllciAke2NpdGl6ZW5JZH0gc2VudCBhbiBlbWFpbCBmcm9tICR7ZW1haWx9IHRvICR7dG99IHdpdGggc3ViamVjdCBcIiR7c3ViamVjdH1cIiwgY29udGVudDogXCIke21lc3NhZ2V9XCJgLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcztcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2V0U2VsZWN0ZWRNZXNzYWdlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNYWlsQ2xhc3Muc2VsZWN0ZU1lc3NhZ2UoZGF0YSk7XG4gICAgcmV0dXJuIHJlcztcbn0pXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpnZXRQcm9maWxlU2V0dGluZ3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBwYXJzZWREYXRhO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5nZXRQcm9maWxlU2V0dGluZ3MoZW1haWwsIHBhc3N3b3JkKTtcbiAgICByZXR1cm4gcmVzO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTp1cGRhdGVQcm9maWxlU2V0dGluZ3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkLCB1c2VybmFtZSwgYXZhdGFyIH0gPSBwYXJzZWREYXRhO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy51cGRhdGVQcm9maWxlU2V0dGluZ3MoZW1haWwsIHBhc3N3b3JkLCB1c2VybmFtZSwgYXZhdGFyKTtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWFpbCcsXG4gICAgICAgIHRpdGxlOiAnUHJvZmlsZSBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBsYXllciAke2NpdGl6ZW5JZH0gdXBkYXRlZCBwcm9maWxlIGZvciBlbWFpbCAke2VtYWlsfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcztcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6c2VuZE1lc3NhZ2UnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHR5cGUsIHBob25lTnVtYmVyLCBncm91cElkLCBtZXNzYWdlRGF0YSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICBsZXQgZmlyc3RNZXNzYWdlID0gZmFsc2U7XG5cbiAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogc2VuZGVySWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH07XG4gICAgICAgIGZpcnN0TWVzc2FnZSA9IHRydWU7XG4gICAgfVxuXG4gICAgbGV0IGNvbnZlcnNhdGlvbjtcbiAgICBpZiAodHlwZSA9PT0gJ3ByaXZhdGUnKSB7XG4gICAgICAgIGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBwaG9uZU51bWJlcj86IHN0cmluZyB9KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtc2cucGhvbmVOdW1iZXIgPT09IHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRhY3ROYW1lID0gYXdhaXQgVXRpbHMuR2V0Q29udGFjdE5hbWVCeU51bWJlcihwaG9uZU51bWJlciwgc2VuZGVySWQpIHx8IGBVbmtub3duICgke3Bob25lTnVtYmVyfSlgO1xuICAgICAgICAgICAgY29uc3QgYXZhdGFyID0gYXdhaXQgVXRpbHMuR2V0Q29udGFjdEF2YXRhckJ5TnVtYmVyKHBob25lTnVtYmVyLCBzZW5kZXJJZCkgfHwgbnVsbDsgLy8gQXNzdW1lIHRoaXMgdXRpbGl0eSBleGlzdHNcbiAgICAgICAgICAgIGNvbnZlcnNhdGlvbiA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncHJpdmF0ZScsXG4gICAgICAgICAgICAgICAgbmFtZTogY29udGFjdE5hbWUsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiBhdmF0YXIsIC8vIFNldCBhdmF0YXIgZm9yIHByaXZhdGUgY29udGFjdFxuICAgICAgICAgICAgICAgIHBob25lTnVtYmVyOiBwaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB1c2VyTWVzc2FnZXMubWVzc2FnZXMucHVzaChjb252ZXJzYXRpb24pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnZ3JvdXAnKSB7XG4gICAgICAgIGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBncm91cElkPzogc3RyaW5nIH0pID0+XG4gICAgICAgICAgICBtc2cudHlwZSA9PT0gJ2dyb3VwJyAmJiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGxhc3RNZXNzYWdlID0gY29udmVyc2F0aW9uLm1lc3NhZ2VzW2NvbnZlcnNhdGlvbi5tZXNzYWdlcy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCBuZXh0UGFnZSA9IGxhc3RNZXNzYWdlID8gbGFzdE1lc3NhZ2UucGFnZSArIDEgOiAxO1xuXG4gICAgY29uc3QgbmV3TWVzc2FnZSA9IHtcbiAgICAgICAgbWVzc2FnZTogbWVzc2FnZURhdGEubWVzc2FnZSxcbiAgICAgICAgcmVhZDogdHJ1ZSxcbiAgICAgICAgcGFnZTogbmV4dFBhZ2UsXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICBzZW5kZXJJZDogc2VuZGVyUGhvbmVOdW1iZXIsXG4gICAgICAgIGF0dGFjaG1lbnRzOiBtZXNzYWdlRGF0YS5hdHRhY2htZW50cyB8fCBbXVxuICAgIH07XG5cbiAgICBjb252ZXJzYXRpb24ubWVzc2FnZXMucHVzaChuZXdNZXNzYWdlKTtcblxuICAgIGlmICghZmlyc3RNZXNzYWdlKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0sIHVzZXJNZXNzYWdlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgdXNlck1lc3NhZ2VzKTtcbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9tZXNzYWdlcycsXG4gICAgICAgIHRpdGxlOiAnTWVzc2FnZSBTZW50JyxcbiAgICAgICAgbWVzc2FnZTogYFNlbmRlciAke3NlbmRlclBob25lTnVtYmVyfSBzZW50IGEgbWVzc2FnZSB0byAke3R5cGUgPT09ICdwcml2YXRlJyA/IHBob25lTnVtYmVyIDogJ2dyb3VwICcgKyBncm91cElkfSB3aXRoIGNvbnRlbnQ6ICR7bWVzc2FnZURhdGEubWVzc2FnZX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgLy8gSGFuZGxlIHJlY2lwaWVudHNcbiAgICBpZiAodHlwZSA9PT0gJ3ByaXZhdGUnKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXIpO1xuICAgICAgICBpZiAodGFyZ2V0Q2l0aXplbklkKSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgICAgICAgICAgY29uc3QgaXNCbG9ja2VkID0gdGFyZ2V0TWVzc2FnZXM/LmJsb2NrZWROdW1iZXJzPy5pbmNsdWRlcyhzZW5kZXJQaG9uZU51bWJlcik7XG4gICAgICAgICAgICBpZiAoIWlzQmxvY2tlZCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IHNlbmRUb1JlY2lwaWVudCh0YXJnZXRDaXRpemVuSWQsIHNlbmRlclBob25lTnVtYmVyLCBtZXNzYWdlRGF0YSwgJ3ByaXZhdGUnLCBwaG9uZU51bWJlcik7XG4gICAgICAgICAgICAgICAgY29uc3QgQ1ZYQ1MgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKHRhcmdldENpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgaWYgKENWWENTKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBhIG5ldyBtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZV9tZXNzYWdlczpjbGllbnQ6dXBkYXRlTWVzc2FnZXMnLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkobmV3TWVzc2FnZSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLyogY29uc29sZS5sb2coYFNlbmRlciAke3NlbmRlclBob25lTnVtYmVyfSBpcyBibG9ja2VkIGJ5ICR7cGhvbmVOdW1iZXJ9LiBNZXNzYWdlIHNhdmVkIG9ubHkgZm9yIHNlbmRlci5gKTsgKi9cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGBSZWNpcGllbnQgd2l0aCBwaG9uZSBudW1iZXIgJHtwaG9uZU51bWJlcn0gZG9lcyBub3QgZXhpc3QuIE1lc3NhZ2Ugc2F2ZWQgb25seSBmb3Igc2VuZGVyLmApOyAqL1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnZ3JvdXAnKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwQ29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKCFncm91cENvbnZlcnNhdGlvbj8ubWVtYmVycykge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBtZW1iZXJzIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBtZW1iZXJJZCBvZiBncm91cENvbnZlcnNhdGlvbi5tZW1iZXJzKSB7XG4gICAgICAgICAgICBpZiAobWVtYmVySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgaXNCbG9ja2VkID0gbWVtYmVyTWVzc2FnZXM/LmJsb2NrZWROdW1iZXJzPy5pbmNsdWRlcyhzZW5kZXJQaG9uZU51bWJlcik7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0Jsb2NrZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2VuZFRvUmVjaXBpZW50KG1lbWJlcklkLCBzZW5kZXJQaG9uZU51bWJlciwgbWVzc2FnZURhdGEsICdncm91cCcsIHVuZGVmaW5lZCwgZ3JvdXBJZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgLyogY29uc29sZS5sb2coYFNlbmRlciAke3NlbmRlclBob25lTnVtYmVyfSBpcyBibG9ja2VkIGJ5IGdyb3VwIG1lbWJlciAke21lbWJlclBob25lTnVtYmVyfS5gKTsgKi9cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgQ1ZYQ1MgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKG1lbWJlcklkKTtcbiAgICAgICAgICAgICAgICBpZiAoQ1ZYQ1MpIHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiTWVzc2FnZXNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBoYXZlIGEgbmV3IG1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lX21lc3NhZ2VzOmNsaWVudDp1cGRhdGVNZXNzYWdlcycsIENWWENTLCBKU09OLnN0cmluZ2lmeSh7IC4uLm5ld01lc3NhZ2UsIGdyb3VwSWQgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG59KTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uIHRvIHNlbmQgbWVzc2FnZXMgdG8gcmVjaXBpZW50cyAodW5jaGFuZ2VkKVxuYXN5bmMgZnVuY3Rpb24gc2VuZFRvUmVjaXBpZW50KFxuICAgIHRhcmdldENpdGl6ZW5JZDogc3RyaW5nLFxuICAgIHNlbmRlclBob25lTnVtYmVyOiBzdHJpbmcsXG4gICAgbWVzc2FnZURhdGE6IGFueSxcbiAgICB0eXBlOiAncHJpdmF0ZScgfCAnZ3JvdXAnLFxuICAgIHBob25lTnVtYmVyPzogc3RyaW5nLFxuICAgIGdyb3VwSWQ/OiBzdHJpbmdcbikge1xuICAgIGxldCB0YXJnZXRNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgIGxldCByZWNlaXZlckZpcnN0TWVzc2FnZSA9IGZhbHNlO1xuXG4gICAgaWYgKCF0YXJnZXRNZXNzYWdlcykge1xuICAgICAgICB0YXJnZXRNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCxcbiAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgfTtcbiAgICAgICAgcmVjZWl2ZXJGaXJzdE1lc3NhZ2UgPSB0cnVlO1xuICAgIH1cblxuICAgIGxldCB0YXJnZXRDb252ZXJzYXRpb247XG4gICAgaWYgKHR5cGUgPT09ICdwcml2YXRlJykge1xuICAgICAgICB0YXJnZXRDb252ZXJzYXRpb24gPSB0YXJnZXRNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBwaG9uZU51bWJlcj86IHN0cmluZyB9KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtc2cucGhvbmVOdW1iZXIgPT09IHNlbmRlclBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKCF0YXJnZXRDb252ZXJzYXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRhY3ROYW1lID0gYXdhaXQgVXRpbHMuR2V0Q29udGFjdE5hbWVCeU51bWJlcihzZW5kZXJQaG9uZU51bWJlciwgdGFyZ2V0Q2l0aXplbklkKTtcbiAgICAgICAgICAgIGNvbnN0IGF2YXRhciA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3RBdmF0YXJCeU51bWJlcihzZW5kZXJQaG9uZU51bWJlciwgdGFyZ2V0Q2l0aXplbklkKSB8fCAnJzsgLy8gQXNzdW1lIHRoaXMgdXRpbGl0eSBleGlzdHNcbiAgICAgICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncHJpdmF0ZScsXG4gICAgICAgICAgICAgICAgbmFtZTogY29udGFjdE5hbWUgfHwgYFVua25vd24gKCR7c2VuZGVyUGhvbmVOdW1iZXJ9KWAsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiBhdmF0YXIsIC8vIFNldCBhdmF0YXIgZm9yIHByaXZhdGUgY29udGFjdFxuICAgICAgICAgICAgICAgIHBob25lTnVtYmVyOiBzZW5kZXJQaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0YXJnZXRNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHRhcmdldENvbnZlcnNhdGlvbik7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdncm91cCcpIHtcbiAgICAgICAgdGFyZ2V0Q29udmVyc2F0aW9uID0gdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgZ3JvdXBJZD86IHN0cmluZyB9KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIXRhcmdldENvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgY29uc3Qgc2VuZGVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIpIH0pO1xuICAgICAgICAgICAgY29uc3QgZ3JvdXAgPSBzZW5kZXJNZXNzYWdlcz8ubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgaWYgKCFncm91cCkgcmV0dXJuO1xuICAgICAgICAgICAgdGFyZ2V0Q29udmVyc2F0aW9uID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdncm91cCcsXG4gICAgICAgICAgICAgICAgbmFtZTogZ3JvdXAubmFtZSxcbiAgICAgICAgICAgICAgICBhdmF0YXI6IGdyb3VwLmF2YXRhciB8fCBudWxsLCAvLyBDb3B5IGF2YXRhciBmcm9tIHNlbmRlcidzIGdyb3VwXG4gICAgICAgICAgICAgICAgZ3JvdXBJZDogZ3JvdXBJZCxcbiAgICAgICAgICAgICAgICBtZW1iZXJzOiBncm91cC5tZW1iZXJzLFxuICAgICAgICAgICAgICAgIG1lbWJlclBob25lTnVtYmVyczogZ3JvdXAubWVtYmVyUGhvbmVOdW1iZXJzLFxuICAgICAgICAgICAgICAgIGNyZWF0b3JJZDogZ3JvdXAuY3JlYXRvcklkLCAvLyBDb3B5IGNyZWF0b3JJZFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2godGFyZ2V0Q29udmVyc2F0aW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHRhcmdldExhc3RNZXNzYWdlID0gdGFyZ2V0Q29udmVyc2F0aW9uLm1lc3NhZ2VzW3RhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcy5sZW5ndGggLSAxXTtcbiAgICBjb25zdCB0YXJnZXROZXh0UGFnZSA9IHRhcmdldExhc3RNZXNzYWdlID8gdGFyZ2V0TGFzdE1lc3NhZ2UucGFnZSArIDEgOiAxO1xuXG4gICAgY29uc3QgdGFyZ2V0TmV3TWVzc2FnZSA9IHtcbiAgICAgICAgbWVzc2FnZTogbWVzc2FnZURhdGEubWVzc2FnZSxcbiAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgIHBhZ2U6IHRhcmdldE5leHRQYWdlLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgc2VuZGVySWQ6IHNlbmRlclBob25lTnVtYmVyLFxuICAgICAgICBhdHRhY2htZW50czogbWVzc2FnZURhdGEuYXR0YWNobWVudHMgfHwgW11cbiAgICB9O1xuXG4gICAgdGFyZ2V0Q29udmVyc2F0aW9uLm1lc3NhZ2VzLnB1c2godGFyZ2V0TmV3TWVzc2FnZSk7XG5cbiAgICBpZiAoIXJlY2VpdmVyRmlyc3RNZXNzYWdlKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB0YXJnZXRNZXNzYWdlcy5faWQgfSwgdGFyZ2V0TWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tZXNzYWdlcycsIHRhcmdldE1lc3NhZ2VzKTtcbiAgICB9XG59XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Y3JlYXRlR3JvdXAnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGdyb3VwTmFtZSwgbWVtYmVyUGhvbmVOdW1iZXJzLCBhdmF0YXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7IC8vIEFkZGVkIGF2YXRhciBmaWVsZFxuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG1lbWJlcklkcyA9IFtzZW5kZXJJZF07XG4gICAgY29uc3QgcGhvbmVOdW1iZXJzID0gW3NlbmRlclBob25lTnVtYmVyXTtcbiAgICBmb3IgKGNvbnN0IHBob25lIG9mIG1lbWJlclBob25lTnVtYmVycykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lKTtcbiAgICAgICAgaWYgKGNpdGl6ZW5JZCAmJiAhbWVtYmVySWRzLmluY2x1ZGVzKGNpdGl6ZW5JZCkpIHtcbiAgICAgICAgICAgIG1lbWJlcklkcy5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICBwaG9uZU51bWJlcnMucHVzaChwaG9uZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBncm91cElkID0gZ2VuZXJhdGVVVWlkKCk7XG4gICAgY29uc3QgZ3JvdXBDb252ZXJzYXRpb24gPSB7XG4gICAgICAgIHR5cGU6ICdncm91cCcsXG4gICAgICAgIG5hbWU6IGdyb3VwTmFtZSxcbiAgICAgICAgYXZhdGFyOiBhdmF0YXIgfHwgJycsXG4gICAgICAgIGdyb3VwSWQ6IGdyb3VwSWQsXG4gICAgICAgIG1lbWJlcnM6IG1lbWJlcklkcyxcbiAgICAgICAgbWVtYmVyUGhvbmVOdW1iZXJzOiBwaG9uZU51bWJlcnMsXG4gICAgICAgIGNyZWF0b3JJZDogc2VuZGVySWQsIC8vIFNldCB0aGUgY3JlYXRvciBhcyB0aGUgc2VuZGVyXG4gICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgIH07XG5cbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBjcmVhdGVkIG5ldyBHcm91cFwiLFxuICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICB1c2VyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiBzZW5kZXJJZCxcbiAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICBtZXNzYWdlczogW2dyb3VwQ29udmVyc2F0aW9uXVxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCB1c2VyTWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKGdyb3VwQ29udmVyc2F0aW9uKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIG1lbWJlcklkcykge1xuICAgICAgICBpZiAobWVtYmVySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgICAgICBsZXQgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICAgICAgY29uc3QgQ1ZYQ1MgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKG1lbWJlcklkKTtcbiAgICAgICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBiZWVuIGFkZGVkIHRvIGEgbmV3IGdyb3VwXCIsXG4gICAgICAgICAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICBjaXRpemVuSWQ6IG1lbWJlcklkLFxuICAgICAgICAgICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbeyAuLi5ncm91cENvbnZlcnNhdGlvbiB9XVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHsgLi4uZ3JvdXBDb252ZXJzYXRpb24gfSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICB0aXRsZTogJ0dyb3VwIENyZWF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJyR7Z3JvdXBOYW1lfScgY3JlYXRlZCBieSAke3NlbmRlclBob25lTnVtYmVyfS4gR3JvdXAgSUQ6ICR7Z3JvdXBJZH0gd2l0aCBtZW1iZXJzOiAke21lbWJlclBob25lTnVtYmVycy5qb2luKCcsICcpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBncm91cElkIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6dG9nZ2xlQmxvY2snLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHBob25lTnVtYmVyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IHNlbmRlcklkLFxuICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmICghdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzKSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycyA9IFtdO1xuICAgIH1cblxuICAgIGNvbnN0IGlzQmxvY2tlZCA9IHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5pbmNsdWRlcyhwaG9uZU51bWJlcik7XG4gICAgaWYgKGlzQmxvY2tlZCkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5pbmRleE9mKHBob25lTnVtYmVyKTtcbiAgICAgICAgdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGROb3RpRmljYXRpb25cIiwgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIk51bWJlciB1bmJsb2NrZWRcIixcbiAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2Jsb2NrcycsXG4gICAgICAgICAgICB0aXRsZTogJ051bWJlciBVbmJsb2NrZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c2VuZGVyUGhvbmVOdW1iZXJ9IHVuYmxvY2tlZCAke3Bob25lTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMucHVzaChwaG9uZU51bWJlcik7XG4gICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGROb3RpRmljYXRpb25cIiwgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIk51bWJlciBibG9ja2VkXCIsXG4gICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9ibG9ja3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdOdW1iZXIgQmxvY2tlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gYmxvY2tlZCAke3Bob25lTnVtYmVyfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAodXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCAmJiB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMubGVuZ3RoID09PSAwICYmICF1c2VyTWVzc2FnZXMuZGVsZXRlZE1lc3NhZ2VzPy5sZW5ndGgpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6YWRkTWVtYmVyJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBncm91cElkLCBwaG9uZU51bWJlciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuICAgICAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVmFsaWRhdGUgdGhlIG5ldyBtZW1iZXJcbiAgICAgICAgY29uc3QgbmV3TWVtYmVySWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKCFuZXdNZW1iZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdNZW1iZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZldGNoIHRoZSBzZW5kZXIncyBtZXNzYWdlcyB0byBmaW5kIHRoZSBncm91cFxuICAgICAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICAgICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVzc2FnZXMgbm90IGZvdW5kIGZvciBzZW5kZXInIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcsIG1lbWJlcnM/OiBzdHJpbmdbXSwgY3JlYXRvcklkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKCFncm91cCB8fCAhZ3JvdXAubWVtYmVycykge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQgb3IgdW5hdXRob3JpemVkJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIGlmIHRoZSBuZXcgbWVtYmVyIGlzIGFscmVhZHkgaW4gdGhlIGdyb3VwXG4gICAgICAgIGlmIChncm91cC5tZW1iZXJzLmluY2x1ZGVzKG5ld01lbWJlcklkKSkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdNZW1iZXIgYWxyZWFkeSBpbiBncm91cCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgdGhlIG5ldyBtZW1iZXIgdG8gdGhlIGdyb3VwXG4gICAgICAgIGdyb3VwLm1lbWJlcnMucHVzaChuZXdNZW1iZXJJZCk7XG4gICAgICAgIGdyb3VwLm1lbWJlclBob25lTnVtYmVycy5wdXNoKHBob25lTnVtYmVyKTtcblxuICAgICAgICAvLyBVcGRhdGUgYWxsIGV4aXN0aW5nIG1lbWJlcnMnIGdyb3VwIGRhdGEsIGluY2x1ZGluZyB0aGUgc2VuZGVyIGFuZCBuZXcgbWVtYmVyXG4gICAgICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycykge1xuICAgICAgICAgICAgbGV0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcblxuICAgICAgICAgICAgaWYgKCFtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIC8vIElmIHRoZSBtZW1iZXIgaXMgbmV3IChubyBtZXNzYWdlcyBkb2N1bWVudCksIGNyZWF0ZSBvbmVcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgY2l0aXplbklkOiBtZW1iZXJJZCxcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtZW1iZXJHcm91cCA9IG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgICAgIGlmIChtZW1iZXJHcm91cCkge1xuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBleGlzdGluZyBncm91cCBkYXRhIGZvciB0aGlzIG1lbWJlclxuICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLm1lbWJlcnMgPSBncm91cC5tZW1iZXJzO1xuICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLm1lbWJlclBob25lTnVtYmVycyA9IGdyb3VwLm1lbWJlclBob25lTnVtYmVycztcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5hdmF0YXIgPSBncm91cC5hdmF0YXI7IC8vIEVuc3VyZSBhdmF0YXIgaXMgY29waWVkXG4gICAgICAgICAgICAgICAgbWVtYmVyR3JvdXAuY3JlYXRvcklkID0gZ3JvdXAuY3JlYXRvcklkOyAvLyBFbnN1cmUgY3JlYXRvcklkIGlzIGNvcGllZFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBBZGQgdGhlIGdyb3VwIHRvIHRoaXMgbWVtYmVyJ3MgbWVzc2FnZXMgaWYgaXQgZG9lc25cdTIwMTl0IGV4aXN0XG4gICAgICAgICAgICAgICAgbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMucHVzaCh7IC4uLmdyb3VwIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTYXZlIG9yIHVwZGF0ZSB0aGUgbWVtYmVyJ3MgbWVzc2FnZXNcbiAgICAgICAgICAgIGlmIChtZW1iZXJNZXNzYWdlcy5faWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogbWVtYmVyTWVzc2FnZXMuX2lkIH0sIG1lbWJlck1lc3NhZ2VzKVxuICAgICAgICAgICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBkYXRhIGZvciBtZW1iZXIgJHttZW1iZXJJZH1gKSkgKi9cbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIGRhdGEgZm9yIG1lbWJlciAke21lbWJlcklkfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCBtZW1iZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgLyogLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYENyZWF0ZWQgbWVzc2FnZXMgZm9yIG5ldyBtZW1iZXIgJHttZW1iZXJJZH1gKSkgKi9cbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIG1lc3NhZ2VzIGZvciBuZXcgbWVtYmVyICR7bWVtYmVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZ3JvdXBzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTWVtYmVyIEFkZGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NlbmRlclBob25lTnVtYmVyfSBhZGRlZCAke3Bob25lTnVtYmVyfSB0byBncm91cCAke2dyb3VwSWR9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGFkZGluZyBtZW1iZXIgdG8gZ3JvdXA6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0FuIGVycm9yIG9jY3VycmVkIHdoaWxlIGFkZGluZyB0aGUgbWVtYmVyIHRvIHRoZSBncm91cCcgfSk7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6cmVtb3ZlTWVtYmVyJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBncm91cElkLCBwaG9uZU51bWJlciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICBjb25zdCBtZW1iZXJJZFRvUmVtb3ZlID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgaWYgKCFtZW1iZXJJZFRvUmVtb3ZlKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICBpZiAoIWdyb3VwIHx8ICFncm91cC5tZW1iZXJzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgbWVtYmVySW5kZXggPSBncm91cC5tZW1iZXJzLmluZGV4T2YobWVtYmVySWRUb1JlbW92ZSk7XG4gICAgaWYgKG1lbWJlckluZGV4ID09PSAtMSkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lbWJlciBub3QgaW4gZ3JvdXAnIH0pO1xuICAgIH1cblxuICAgIGdyb3VwLm1lbWJlcnMuc3BsaWNlKG1lbWJlckluZGV4LCAxKTtcbiAgICBncm91cC5tZW1iZXJQaG9uZU51bWJlcnMuc3BsaWNlKG1lbWJlckluZGV4LCAxKTtcblxuICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycykge1xuICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKG1lbWJlckdyb3VwKSB7XG4gICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJzID0gZ3JvdXAubWVtYmVycztcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLm1lbWJlclBob25lTnVtYmVycyA9IGdyb3VwLm1lbWJlclBob25lTnVtYmVycztcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLmF2YXRhciA9IGdyb3VwLmF2YXRhcjsgLy8gRW5zdXJlIGF2YXRhciBpcyBjb3BpZWRcbiAgICAgICAgICAgIG1lbWJlckdyb3VwLmNyZWF0b3JJZCA9IGdyb3VwLmNyZWF0b3JJZDsgLy8gRW5zdXJlIGNyZWF0b3JJZCBpcyBjb3BpZWRcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZFRvUmVtb3ZlIH0pO1xuICAgIGlmIChyZW1vdmVkTWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgY29uc3QgZ3JvdXBJbmRleCA9IHJlbW92ZWRNZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kSW5kZXgoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKGdyb3VwSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICByZW1vdmVkTWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuc3BsaWNlKGdyb3VwSW5kZXgsIDEpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHJlbW92ZWRNZW1iZXJNZXNzYWdlcy5faWQgfSwgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgIHRpdGxlOiAnTWVtYmVyIFJlbW92ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gcmVtb3ZlZCAke3Bob25lTnVtYmVyfSBmcm9tIGdyb3VwICR7Z3JvdXBJZH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmRlbGV0ZUdyb3VwJywgYXN5bmMgKGNsaWVudCwgZ3JvdXBJZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICBpZiAoIWdyb3VwIHx8ICFncm91cC5tZW1iZXJzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgdGhlIHNlbmRlciBpcyB0aGUgZ3JvdXAgY3JlYXRvciAoYWRtaW4pXG4gICAgaWYgKGdyb3VwLmNyZWF0b3JJZCAhPT0gc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdPbmx5IHRoZSBncm91cCBjcmVhdG9yIGNhbiBkZWxldGUgdGhlIGdyb3VwJyB9KTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgY29uc3QgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICBjb25zdCBDVlhDUyA9IGF3YWl0IFV0aWxzLkdldFNvdXJjZUZyb21DaXRpemVuSWQobWVtYmVySWQpO1xuICAgICAgICBpZiAoQ1ZYQ1MpIHtcbiAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiTWVzc2FnZXNcIixcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJHcm91cCBoYXMgYmVlbiBkZWxldGVkXCIsXG4gICAgICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgY29uc3QgZ3JvdXBJbmRleCA9IG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmRJbmRleCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgaWYgKGdyb3VwSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuc3BsaWNlKGdyb3VwSW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZ3JvdXBzJyxcbiAgICAgICAgdGl0bGU6ICdHcm91cCBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEdyb3VwICR7Z3JvdXBJZH0gZGVsZXRlZCBieSAke3NlbmRlclBob25lTnVtYmVyfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmdldEdyb3VwTWVzc2FnZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGdyb3VwSWQsIHBhZ2UgPSAxLCBsaW1pdCA9IDIwIH0gPSBKU09OLnBhcnNlKGRhdGEpOyAvLyBBZGQgcGFnZSBhbmQgbGltaXQgZm9yIHBhZ2luYXRpb25cbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG5cbiAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlczogW10sIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlczogW10sIG1lc3NhZ2U6ICdObyBtZXNzYWdlcyBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyB0eXBlOiBzdHJpbmcsIGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ0NvbnZlcnNhdGlvbiBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIC8vIFNvcnQgbWVzc2FnZXMgYnkgdGltZXN0YW1wIChkZXNjZW5kaW5nKSBhbmQgcGFnaW5hdGVcbiAgICBjb25zdCBzb3J0ZWRNZXNzYWdlcyA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlcy5zb3J0KChhOiBhbnksIGI6IGFueSkgPT5cbiAgICAgICAgbmV3IERhdGUoYi50aW1lc3RhbXApLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEudGltZXN0YW1wKS5nZXRUaW1lKClcbiAgICApO1xuXG4gICAgY29uc3Qgc3RhcnRJbmRleCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcbiAgICBjb25zdCBlbmRJbmRleCA9IHN0YXJ0SW5kZXggKyBsaW1pdDtcbiAgICBjb25zdCBwYWdpbmF0ZWRNZXNzYWdlcyA9IHNvcnRlZE1lc3NhZ2VzLnNsaWNlKHN0YXJ0SW5kZXgsIGVuZEluZGV4KTtcblxuICAgIGNvbnN0IGhhc01vcmUgPSBlbmRJbmRleCA8IHNvcnRlZE1lc3NhZ2VzLmxlbmd0aDtcblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIG1lc3NhZ2VzOiBwYWdpbmF0ZWRNZXNzYWdlcyxcbiAgICAgICAgbWVtYmVyUGhvbmVOdW1iZXJzOiBjb252ZXJzYXRpb24ubWVtYmVyUGhvbmVOdW1iZXJzIHx8IFtdLFxuICAgICAgICBuYW1lOiBjb252ZXJzYXRpb24ubmFtZSxcbiAgICAgICAgYXZhdGFyOiBjb252ZXJzYXRpb24uYXZhdGFyIHx8IG51bGwsXG4gICAgICAgIGhhc01vcmU6IGhhc01vcmUsXG4gICAgICAgIHRvdGFsTWVzc2FnZXM6IHNvcnRlZE1lc3NhZ2VzLmxlbmd0aCxcbiAgICAgICAgY3JlYXRvcklkOiBjb252ZXJzYXRpb24uY3JlYXRvcklkIC8vIEluY2x1ZGUgY3JlYXRvcklkIGZvciBVSSBvciB2ZXJpZmljYXRpb24gaWYgbmVlZGVkXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpnZXRQcml2YXRlTWVzc2FnZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHBob25lTnVtYmVyLCBwYWdlID0gMSwgbGltaXQgPSAyMCB9ID0gSlNPTi5wYXJzZShkYXRhKTsgLy8gQWRkIHBhZ2UgYW5kIGxpbWl0IGZvciBwYWdpbmF0aW9uXG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnTm8gbWVzc2FnZXMgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBwaG9uZU51bWJlcj86IHN0cmluZyB9KSA9PlxuICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIG1zZy5waG9uZU51bWJlciA9PT0gcGhvbmVOdW1iZXIpO1xuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ0NvbnZlcnNhdGlvbiBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIC8vIFNvcnQgbWVzc2FnZXMgYnkgdGltZXN0YW1wIChkZXNjZW5kaW5nKSBhbmQgcGFnaW5hdGVcbiAgICBjb25zdCBzb3J0ZWRNZXNzYWdlcyA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlcy5zb3J0KChhOiBhbnksIGI6IGFueSkgPT5cbiAgICAgICAgbmV3IERhdGUoYi50aW1lc3RhbXApLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEudGltZXN0YW1wKS5nZXRUaW1lKClcbiAgICApO1xuXG4gICAgY29uc3Qgc3RhcnRJbmRleCA9IChwYWdlIC0gMSkgKiBsaW1pdDtcbiAgICBjb25zdCBlbmRJbmRleCA9IHN0YXJ0SW5kZXggKyBsaW1pdDtcbiAgICBjb25zdCBwYWdpbmF0ZWRNZXNzYWdlcyA9IHNvcnRlZE1lc3NhZ2VzLnNsaWNlKHN0YXJ0SW5kZXgsIGVuZEluZGV4KTtcbiAgICBjb25zdCBoYXNNb3JlID0gZW5kSW5kZXggPCBzb3J0ZWRNZXNzYWdlcy5sZW5ndGg7XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlczogcGFnaW5hdGVkTWVzc2FnZXMsXG4gICAgICAgIGF2YXRhcjogY29udmVyc2F0aW9uLmF2YXRhciB8fCBudWxsLFxuICAgICAgICBuYW1lOiBjb252ZXJzYXRpb24ubmFtZSxcbiAgICAgICAgaGFzTW9yZTogaGFzTW9yZSxcbiAgICAgICAgdG90YWxNZXNzYWdlczogc29ydGVkTWVzc2FnZXMubGVuZ3RoXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpnZXRNZXNzYWdlQ2hhbm5lbHNhbmRMYXN0TWVzc2FnZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgICAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdObyBtZXNzYWdlcyBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjaGFubmVscyA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5tYXAoYXN5bmMgKG1zZzogeyB0eXBlOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcsIGF2YXRhcjogc3RyaW5nLCBncm91cElkPzogc3RyaW5nLCBtZW1iZXJzPzogc3RyaW5nW10sIG1lbWJlclBob25lTnVtYmVycz86IHN0cmluZ1tdLCBtZXNzYWdlczogYW55W10sIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiB7XG4gICAgICAgICAgICBsZXQgdXBkYXRlZE5hbWUgPSBtc2cubmFtZTtcbiAgICAgICAgICAgIGxldCB1cGRhdGVkTWVtYmVyUGhvbmVOdW1iZXJzID0gbXNnLm1lbWJlclBob25lTnVtYmVycyB8fCBbXTtcblxuICAgICAgICAgICAgLy8gSGFuZGxlIHByaXZhdGUgY29udmVyc2F0aW9uc1xuICAgICAgICAgICAgaWYgKG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q29udGFjdE5hbWUgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0TmFtZUJ5TnVtYmVyKG1zZy5waG9uZU51bWJlciwgc2VuZGVySWQpIHx8IGBVbmtub3duICgke21zZy5waG9uZU51bWJlcn0pYDtcbiAgICAgICAgICAgICAgICBpZiAobmV3Q29udGFjdE5hbWUgIT09IG1zZy5uYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgbmFtZSBpbiB0aGUgZGF0YWJhc2UgaWYgaXQgaGFzIGNoYW5nZWRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG06IGFueSkgPT4gbS50eXBlID09PSAncHJpdmF0ZScgJiYgbS5waG9uZU51bWJlciA9PT0gbXNnLnBob25lTnVtYmVyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udmVyc2F0aW9uLm5hbWUgPSBuZXdDb250YWN0TmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0sIHVzZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBjb250YWN0IG5hbWUgZm9yICR7bXNnLnBob25lTnVtYmVyfSB0byAke25ld0NvbnRhY3ROYW1lfWApKSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBjb250YWN0IG5hbWUgZm9yICR7bXNnLnBob25lTnVtYmVyfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZWROYW1lID0gbmV3Q29udGFjdE5hbWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gSGFuZGxlIGdyb3VwIGNvbnZlcnNhdGlvbnNcbiAgICAgICAgICAgIGVsc2UgaWYgKG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5tZW1iZXJQaG9uZU51bWJlcnMgJiYgbXNnLm1lbWJlclBob25lTnVtYmVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtc2cubWVtYmVyUGhvbmVOdW1iZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBob25lID0gbXNnLm1lbWJlclBob25lTnVtYmVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3Q29udGFjdE5hbWUgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0TmFtZUJ5TnVtYmVyKHBob25lLCBzZW5kZXJJZCkgfHwgYFVua25vd24gKCR7cGhvbmV9KWA7XG4gICAgICAgICAgICAgICAgICAgIC8vIFlvdSBjb3VsZCB1cGRhdGUgaW5kaXZpZHVhbCBtZW1iZXIgbmFtZXMgaGVyZSBpZiBuZWVkZWQsIGJ1dCBmb3IgZ3JvdXAgbmFtZSwgd2Uga2VlcCBpdCBhcy1pcyB1bmxlc3Mgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIHlvdSBjb3VsZCBhZ2dyZWdhdGUgbWVtYmVyIG5hbWVzIGludG8gdGhlIGdyb3VwIG5hbWUgaWYgZGVzaXJlZFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB0eXBlOiBtc2cudHlwZSxcbiAgICAgICAgICAgICAgICBuYW1lOiB1cGRhdGVkTmFtZSxcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogbXNnLnBob25lTnVtYmVyLFxuICAgICAgICAgICAgICAgIGdyb3VwSWQ6IG1zZy5ncm91cElkLFxuICAgICAgICAgICAgICAgIG1lbWJlcnM6IG1zZy5tZW1iZXJzLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogbXNnLmF2YXRhcixcbiAgICAgICAgICAgICAgICBtZW1iZXJQaG9uZU51bWJlcnM6IHVwZGF0ZWRNZW1iZXJQaG9uZU51bWJlcnMsXG4gICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IG1zZy5tZXNzYWdlc1ttc2cubWVzc2FnZXMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgY3JlYXRvcklkOiBtc2cuY3JlYXRvcklkIC8vIEluY2x1ZGUgY3JlYXRvcklkXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXYWl0IGZvciBhbGwgcHJvbWlzZXMgdG8gcmVzb2x2ZVxuICAgICAgICBjb25zdCByZXNvbHZlZENoYW5uZWxzID0gYXdhaXQgUHJvbWlzZS5hbGwoY2hhbm5lbHMpO1xuXG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUsIGNoYW5uZWxzOiByZXNvbHZlZENoYW5uZWxzIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGZldGNoaW5nIG1lc3NhZ2UgY2hhbm5lbHMgYW5kIGxhc3QgbWVzc2FnZXM6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0FuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIG1lc3NhZ2UgY2hhbm5lbHMnIH0pO1xuICAgIH1cbn0pO1xub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpnZXRNZXNzYWdlU3RhdHMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG5cbiAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBzdGF0czoge1xuICAgICAgICAgICAgICAgIGFsbE1lc3NhZ2VzOiAwLFxuICAgICAgICAgICAgICAgIGtub3duTWVzc2FnZXM6IDAsXG4gICAgICAgICAgICAgICAgdW5rbm93bk1lc3NhZ2VzOiAwLFxuICAgICAgICAgICAgICAgIHVucmVhZE1lc3NhZ2VzOiAwLFxuICAgICAgICAgICAgICAgIHJlY2VudGx5RGVsZXRlZDogMFxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBjdXJyZW50RGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgdGhpcnR5RGF5c0FnbyA9IG5ldyBEYXRlKGN1cnJlbnREYXRlLmdldFRpbWUoKSAtIDMwICogMjQgKiA2MCAqIDYwICogMTAwMCk7IC8vIDMwIGRheXMgYWdvXG5cbiAgICBsZXQgYWxsTWVzc2FnZXMgPSAwO1xuICAgIGxldCBrbm93bk1lc3NhZ2VzID0gMDtcbiAgICBsZXQgdW5rbm93bk1lc3NhZ2VzID0gMDtcbiAgICBsZXQgdW5yZWFkTWVzc2FnZXMgPSAwO1xuICAgIGxldCByZWNlbnRseURlbGV0ZWQgPSAwO1xuXG4gICAgZm9yIChjb25zdCBjb252ZXJzYXRpb24gb2YgdXNlck1lc3NhZ2VzLm1lc3NhZ2VzKSB7XG4gICAgICAgIGZvciAoY29uc3QgbWVzc2FnZSBvZiBjb252ZXJzYXRpb24ubWVzc2FnZXMpIHtcbiAgICAgICAgICAgIGFsbE1lc3NhZ2VzICs9IDE7XG5cbiAgICAgICAgICAgIGNvbnN0IGlzS25vd24gPSBjb252ZXJzYXRpb24ubmFtZSAmJiAhY29udmVyc2F0aW9uLm5hbWUubWF0Y2goL15bMC05IUAjJCVeJiooKV8rXFwtPVxcW1xcXXt9Oyc6XCJcXFxcfCwuPD5cXC8/XSokLyk7XG4gICAgICAgICAgICBpZiAoaXNLbm93bikge1xuICAgICAgICAgICAgICAgIGtub3duTWVzc2FnZXMgKz0gMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdW5rbm93bk1lc3NhZ2VzICs9IDE7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghbWVzc2FnZS5yZWFkKSB7XG4gICAgICAgICAgICAgICAgdW5yZWFkTWVzc2FnZXMgKz0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICh1c2VyTWVzc2FnZXMuZGVsZXRlZE1lc3NhZ2VzKSB7XG4gICAgICAgIHJlY2VudGx5RGVsZXRlZCA9IHVzZXJNZXNzYWdlcy5kZWxldGVkTWVzc2FnZXMuZmlsdGVyKChkZWxldGVkOiBhbnkpID0+XG4gICAgICAgICAgICBkZWxldGVkLnRpbWVzdGFtcCA+IHRoaXJ0eURheXNBZ29cbiAgICAgICAgKS5sZW5ndGg7XG4gICAgfVxuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgIGFsbE1lc3NhZ2VzLFxuICAgICAgICAgICAga25vd25NZXNzYWdlcyxcbiAgICAgICAgICAgIHVua25vd25NZXNzYWdlcyxcbiAgICAgICAgICAgIHVucmVhZE1lc3NhZ2VzLFxuICAgICAgICAgICAgcmVjZW50bHlEZWxldGVkXG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmRlbGV0ZU1lc3NhZ2UnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGNvbnZlcnNhdGlvblR5cGUsIHBob25lTnVtYmVyLCBncm91cElkLCBtZXNzYWdlSW5kZXggfSA9IEpTT04ucGFyc2UoZGF0YSB8fCAne30nKTtcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVzc2FnZXMgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBsZXQgY29udmVyc2F0aW9uOiBhbnk7XG4gICAgaWYgKGNvbnZlcnNhdGlvblR5cGUgPT09ICdwcml2YXRlJyAmJiBwaG9uZU51bWJlcikge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiBhbnkpID0+XG4gICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIE51bWJlcihtc2cucGhvbmVOdW1iZXIpID09PSBOdW1iZXIocGhvbmVOdW1iZXIpXG4gICAgICAgICk7XG4gICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb25UeXBlID09PSAnZ3JvdXAnICYmIGdyb3VwSWQpIHtcbiAgICAgICAgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgU3RyaW5nKG1zZy5ncm91cElkKSA9PT0gU3RyaW5nKGdyb3VwSWQpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKCFjb252ZXJzYXRpb24pIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb252ZXJzYXRpb24ubWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuZmlsdGVyKChtc2c6IGFueSkgPT4gTnVtYmVyKG1zZy5wYWdlKSAhPT0gTnVtYmVyKG1lc3NhZ2VJbmRleCkpO1xuXG4gICAgLy8gUGVyc2lzdCBsb2NhbCBjaGFuZ2VcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuXG4gICAgLy8gQXR0ZW1wdCByZW1vdGUgZGVsZXRlIG9ubHkgZm9yIHByaXZhdGUgY29udmVyc2F0aW9ucyBhbmQgd2hlbiB0YXJnZXQgZXhpc3RzXG4gICAgaWYgKGNvbnZlcnNhdGlvblR5cGUgPT09ICdwcml2YXRlJyAmJiBwaG9uZU51bWJlcikge1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKHRhcmdldENpdGl6ZW5JZCkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U291cmNlID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZCh0YXJnZXRDaXRpemVuSWQpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmICh0YXJnZXRNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldENvbnZlcnNhdGlvbiA9IHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgICAgICAgICBtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIE51bWJlcihtc2cucGhvbmVOdW1iZXIpID09PSBOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0Q29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcyA9IHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcy5maWx0ZXIoKG1zZzogYW55KSA9PiBOdW1iZXIobXNnLnBhZ2UpICE9PSBOdW1iZXIobWVzc2FnZUluZGV4KSk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB0YXJnZXRNZXNzYWdlcy5faWQgfSwgdGFyZ2V0TWVzc2FnZXMpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXdhaXQgRG9lc1BsYXllckV4aXN0KHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lX21lc3NhZ2VzOmNsaWVudDp1cGRhdGVNZXNzYWdlcycsIE51bWJlcih0YXJnZXRTb3VyY2UpLCBKU09OLnN0cmluZ2lmeSh0YXJnZXRNZXNzYWdlcykpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZW1pdE5ldCgncGhvbmVfbWVzc2FnZXM6Y2xpZW50OnVwZGF0ZU1lc3NhZ2VzJywgTnVtYmVyKGNsaWVudCksIEpTT04uc3RyaW5naWZ5KHVzZXJNZXNzYWdlcykpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWVzc2FnZXMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBNZXNzYWdlIGRlbGV0ZWQgZnJvbSAke2NvbnZlcnNhdGlvblR5cGV9IGNvbnZlcnNhdGlvbiB3aXRoICR7cGhvbmVOdW1iZXIgfHwgZ3JvdXBJZH0gYnkgJHtzZW5kZXJQaG9uZU51bWJlcn1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnVwZGF0ZUdyb3VwTmFtZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgZ3JvdXBJZCwgbmV3TmFtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuICAgICAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBjcmVhdG9ySWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWdyb3VwKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZ3JvdXAuY3JlYXRvcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdPbmx5IHRoZSBncm91cCBjcmVhdG9yIGNhbiB1cGRhdGUgdGhlIGdyb3VwIG5hbWUnIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG9sZE5hbWUgPSBncm91cC5uYW1lO1xuICAgICAgICBncm91cC5uYW1lID0gbmV3TmFtZTtcblxuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMgfHwgW10pIHtcbiAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgIGlmIChtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIGlmIChtZW1iZXJHcm91cCkge1xuICAgICAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5uYW1lID0gbmV3TmFtZTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGdyb3VwIG5hbWUgZm9yIG1lbWJlciAke21lbWJlcklkfWApKSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIG5hbWUgZm9yIG1lbWJlciAke21lbWJlcklkfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgR3JvdXAgbm90IGZvdW5kIGluIG1lbWJlciAke21lbWJlcklkfSdzIG1lc3NhZ2VzYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYE5vIG1lc3NhZ2VzIGZvdW5kIGZvciBtZW1iZXIgJHttZW1iZXJJZH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0sIHVzZXJNZXNzYWdlcylcbiAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGdyb3VwIG5hbWUgZm9yIHNlbmRlciAke3NlbmRlcklkfWApKSAqL1xuICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIG5hbWUgZm9yIHNlbmRlciAke3NlbmRlcklkfTpgLCBlcnJvcikpO1xuXG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ0dyb3VwIE5hbWUgVXBkYXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgR3JvdXAgJHtncm91cElkfSB8ICR7b2xkTmFtZX0gbmFtZSB1cGRhdGVkIHRvICR7bmV3TmFtZX0gYnkgJHtzZW5kZXJQaG9uZU51bWJlcn0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgdXBkYXRpbmcgZ3JvdXAgbmFtZTonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdXBkYXRpbmcgdGhlIGdyb3VwIG5hbWUnIH0pO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnVwZGF0ZUdyb3VwQXZhdGFyJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgeyBncm91cElkLCBuZXdBdmF0YXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICAgICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZldGNoIHRoZSBzZW5kZXIncyBtZXNzYWdlcyB0byBmaW5kIHRoZSBncm91cFxuICAgICAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICAgICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVzc2FnZXMgbm90IGZvdW5kIGZvciBzZW5kZXInIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JvdXAgPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcsIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXApIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIGlmIHRoZSBzZW5kZXIgaXMgdGhlIGdyb3VwIGNyZWF0b3IgKGFkbWluKVxuICAgICAgICBpZiAoZ3JvdXAuY3JlYXRvcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdPbmx5IHRoZSBncm91cCBjcmVhdG9yIGNhbiB1cGRhdGUgdGhlIGdyb3VwIGF2YXRhcicgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgdGhlIGdyb3VwIGF2YXRhciBmb3IgdGhlIHNlbmRlclxuICAgICAgICBncm91cC5hdmF0YXIgPSBuZXdBdmF0YXI7XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBncm91cCBhdmF0YXIgZm9yIGFsbCBtZW1iZXJzXG4gICAgICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXAubWVtYmVycyB8fCBbXSkge1xuICAgICAgICAgICAgY29uc3QgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICAgICAgaWYgKG1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVtYmVyR3JvdXAgPSBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICAgICAgaWYgKG1lbWJlckdyb3VwKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLmF2YXRhciA9IG5ld0F2YXRhcjtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGdyb3VwIGF2YXRhciBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCkpICovXG4gICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgZ3JvdXAgYXZhdGFyIGZvciBtZW1iZXIgJHttZW1iZXJJZH06YCwgZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYEdyb3VwIG5vdCBmb3VuZCBpbiBtZW1iZXIgJHttZW1iZXJJZH0ncyBtZXNzYWdlc2ApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBObyBtZXNzYWdlcyBmb3VuZCBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVcGRhdGUgdGhlIHNlbmRlcidzIG1lc3NhZ2VzXG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0sIHVzZXJNZXNzYWdlcylcbiAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBVcGRhdGVkIGdyb3VwIGF2YXRhciBmb3Igc2VuZGVyICR7c2VuZGVySWR9YCkpICovXG4gICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgZ3JvdXAgYXZhdGFyIGZvciBzZW5kZXIgJHtzZW5kZXJJZH06YCwgZXJyb3IpKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZ3JvdXBzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnR3JvdXAgQXZhdGFyIFVwZGF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEdyb3VwICR7Z3JvdXBJZH0gYXZhdGFyIHVwZGF0ZWQgYnkgJHtzZW5kZXJQaG9uZU51bWJlcn0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgdXBkYXRpbmcgZ3JvdXAgYXZhdGFyOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSB1cGRhdGluZyB0aGUgZ3JvdXAgYXZhdGFyJyB9KTtcbiAgICB9XG59KTsiLCAiaW1wb3J0IHsgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcblxuZXhwb3J0IGludGVyZmFjZSBQbGF5ZXJDYWxsSGlzdG9yeSB7XG4gIGNhbGxJZDogbnVtYmVyO1xuICByb2xlOiBcImNhbGxlclwiIHwgXCJjYWxsZWVcIjtcbiAgbXlQaG9uZU51bWJlcjogc3RyaW5nO1xuICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IHN0cmluZztcbiAgc3RhdHVzOiBcInVuYW5zd2VyZWRcIiB8IFwibWlzc2VkXCIgfCBcImRlY2xpbmVkXCIgfCBcImNvbXBsZXRlZFwiO1xuICBjYWxsVGltZTogbnVtYmVyO1xuICBjYWxsVGltZXN0YW1wOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBDYWxsSGlzdG9yeU1hbmFnZXIge1xuICBhc3luYyByZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KFxuICAgIGNhbGw6IHtcbiAgICAgIGNhbGxJZDogbnVtYmVyO1xuICAgICAgaG9zdDogeyBjaXRpemVuSWQ6IHN0cmluZzsgcGhvbmVOdW1iZXI6IHN0cmluZyB9O1xuICAgICAgcGFydGljaXBhbnRzOiBNYXA8bnVtYmVyLCB7IGNpdGl6ZW5JZDogc3RyaW5nOyBwaG9uZU51bWJlcjogc3RyaW5nOyBvbkhvbGQ6IGJvb2xlYW4gfT47XG4gICAgICBzdGFydFRpbWU6IERhdGU7XG4gICAgfSxcbiAgICBjYWxsZXJTdGF0dXM6IFwidW5hbnN3ZXJlZFwiIHwgXCJkZWNsaW5lZFwiIHwgXCJjb21wbGV0ZWRcIixcbiAgICBjYWxsZWVTdGF0dXM6IFwibWlzc2VkXCIgfCBcImRlY2xpbmVkXCIgfCBcImNvbXBsZXRlZFwiLFxuICAgIGVuZFRpbWU6IERhdGUsXG4gICAgdGFyZ2V0UGhvbmVOdW1iZXI/OiBzdHJpbmdcbiAgKSB7XG4gICAgY29uc3QgY2FsbFRpbWUgPSAoZW5kVGltZS5nZXRUaW1lKCkgLSBjYWxsLnN0YXJ0VGltZS5nZXRUaW1lKCkpIC8gMTAwMDtcbiAgICBjb25zdCB0aW1lc3RhbXAgPSBlbmRUaW1lLnRvSVNPU3RyaW5nKCk7XG5cbiAgICAvLyBGaWx0ZXIgb3V0IHRoZSBob3N0IGZyb20gcGFydGljaXBhbnRzIHRvIHRyeSB0byBnZXQgdGhlIGNhbGxlZS5cbiAgICBjb25zdCBjYWxsZWVBcnJheSA9IEFycmF5LmZyb20oY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpLmZpbHRlcihcbiAgICAgIChwYXJ0aWNpcGFudCkgPT4gcGFydGljaXBhbnQucGhvbmVOdW1iZXIgIT09IGNhbGwuaG9zdC5waG9uZU51bWJlclxuICAgICk7XG5cbiAgICBsZXQgY2FsbGVlUGhvbmU6IHN0cmluZztcbiAgICBpZiAoY2FsbGVlQXJyYXkubGVuZ3RoIDwgMSkge1xuICAgICAgLy8gSWYgdGhlIGNhbGxlZSBuZXZlciBqb2luZWQsIHVzZSB0aGUgcGFzc2VkIHRhcmdldFBob25lTnVtYmVyLlxuICAgICAgaWYgKHRhcmdldFBob25lTnVtYmVyKSB7XG4gICAgICAgIGNhbGxlZVBob25lID0gdGFyZ2V0UGhvbmVOdW1iZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiTm8gY2FsbGVlIGZvdW5kIGZvciB0d28tcGFydHkgY2FsbCBhZnRlciBmaWx0ZXJpbmcgb3V0IGhvc3RcIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGVlUGhvbmUgPSBjYWxsZWVBcnJheVswXS5waG9uZU51bWJlcjtcbiAgICB9XG5cbiAgICBjb25zdCBjYWxsZXJSZWNvcmQ6IFBsYXllckNhbGxIaXN0b3J5ID0ge1xuICAgICAgY2FsbElkOiBjYWxsLmNhbGxJZCxcbiAgICAgIHJvbGU6IFwiY2FsbGVyXCIsXG4gICAgICBteVBob25lTnVtYmVyOiBjYWxsLmhvc3QucGhvbmVOdW1iZXIsXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IGNhbGxlZVBob25lLFxuICAgICAgc3RhdHVzOiBjYWxsZXJTdGF0dXMsXG4gICAgICBjYWxsVGltZSxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuXG4gICAgY29uc3QgY2FsbGVlUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogY2FsbC5jYWxsSWQsXG4gICAgICByb2xlOiBcImNhbGxlZVwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogY2FsbGVlUGhvbmUsXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IGNhbGwuaG9zdC5waG9uZU51bWJlcixcbiAgICAgIHN0YXR1czogY2FsbGVlU3RhdHVzLFxuICAgICAgY2FsbFRpbWUsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZXJSZWNvcmQpO1xuICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVlUmVjb3JkKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byByZWNvcmQgdHdvLXBhcnR5IGNhbGwgaGlzdG9yeTpcIiwgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldFBsYXllckNhbGxIaXN0b3J5KHBob25lTnVtYmVyOiBzdHJpbmcsIG1heFJlY29yZHM6IG51bWJlcik6IFByb21pc2U8UGxheWVyQ2FsbEhpc3RvcnlbXT4ge1xuICAgIGNvbnN0IHF1ZXJ5ID0geyBteVBob25lTnVtYmVyOiBwaG9uZU51bWJlciB9O1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7IHNvcnQ6IHsgX2lkOiAtMSB9LCBsaW1pdDogbWF4UmVjb3JkcyB9O1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJjYWxsX2hpc3RvcnlcIiwgcXVlcnksICgpID0+IHsgfSwgZmFsc2UsIG9wdGlvbnMpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIHJldHJpZXZpbmcgY2FsbCBoaXN0b3J5IGZvciBwaG9uZSBudW1iZXI6XCIsIHBob25lTnVtYmVyLCBlcnJvcik7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBjYWxsSGlzdG9yeU1hbmFnZXIgPSBuZXcgQ2FsbEhpc3RvcnlNYW5hZ2VyKCk7XG4iLCAiaW1wb3J0IHsgY2FsbEhpc3RvcnlNYW5hZ2VyIH0gZnJvbSBcIi4vY2FsbEhpc3RvcnlNYW5hZ2VyXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FsbFBhcnRpY2lwYW50IHtcbiAgICBzb3VyY2U6IG51bWJlcjtcbiAgICBjaXRpemVuSWQ6IHN0cmluZztcbiAgICBwaG9uZU51bWJlcjogc3RyaW5nO1xuICAgIG9uSG9sZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBPbmdvaW5nQ2FsbCB7XG4gICAgY2FsbElkOiBudW1iZXI7XG4gICAgaG9zdDogQ2FsbFBhcnRpY2lwYW50O1xuICAgIHBhcnRpY2lwYW50czogTWFwPG51bWJlciwgQ2FsbFBhcnRpY2lwYW50PjtcbiAgICBwZW5kaW5nOiBNYXA8bnVtYmVyLCBOb2RlSlMuVGltZW91dD47XG4gICAgc3RhcnRUaW1lOiBEYXRlO1xufVxuXG5jbGFzcyBDYWxsTWFuYWdlciB7XG4gICAgcHJpdmF0ZSBjYWxscyA9IG5ldyBNYXA8bnVtYmVyLCBPbmdvaW5nQ2FsbD4oKTtcbiAgICBwcml2YXRlIHBsYXllckNhbGxNYXAgPSBuZXcgTWFwPG51bWJlciwgbnVtYmVyPigpO1xuICAgIHByaXZhdGUgcmluZ1RvbmVNYW5nZXIgPSBuZXcgTWFwPG51bWJlciwgbnVtYmVyPigpO1xuXG4gICAgcHVibGljIGNyZWF0ZUNhbGwoaG9zdDogQ2FsbFBhcnRpY2lwYW50KTogbnVtYmVyIHtcbiAgICAgICAgY29uc3QgY2FsbElkID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCk7XG4gICAgICAgIGNvbnN0IG5ld0NhbGw6IE9uZ29pbmdDYWxsID0ge1xuICAgICAgICAgICAgY2FsbElkLFxuICAgICAgICAgICAgaG9zdCxcbiAgICAgICAgICAgIHBhcnRpY2lwYW50czogbmV3IE1hcDxudW1iZXIsIENhbGxQYXJ0aWNpcGFudD4oKSxcbiAgICAgICAgICAgIHBlbmRpbmc6IG5ldyBNYXA8bnVtYmVyLCBOb2RlSlMuVGltZW91dD4oKSxcbiAgICAgICAgICAgIHN0YXJ0VGltZTogbmV3IERhdGUoKSxcbiAgICAgICAgfTtcbiAgICAgICAgbmV3Q2FsbC5wYXJ0aWNpcGFudHMuc2V0KGhvc3Quc291cmNlLCBob3N0KTtcbiAgICAgICAgdGhpcy5jYWxscy5zZXQoY2FsbElkLCBuZXdDYWxsKTtcbiAgICAgICAgdGhpcy5wbGF5ZXJDYWxsTWFwLnNldChob3N0LnNvdXJjZSwgY2FsbElkKTtcbiAgICAgICAgcmV0dXJuIGNhbGxJZDtcbiAgICB9XG4gICAgcHVibGljIGdldENhbGxIb3N0KGNhbGxJZDogbnVtYmVyKTogQ2FsbFBhcnRpY2lwYW50IHwgdW5kZWZpbmVkIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuO1xuICAgICAgICByZXR1cm4gY2FsbC5ob3N0O1xuICAgIH1cbiAgICBwdWJsaWMgaXNQbGF5ZXJJbkNhbGwoc291cmNlOiBudW1iZXIpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGxheWVyQ2FsbE1hcC5oYXMoc291cmNlKTtcbiAgICB9XG4gICAgcHVibGljIGdldENhbGxCeVBsYXllcihzb3VyY2U6IG51bWJlcik6IE9uZ29pbmdDYWxsIHwgdW5kZWZpbmVkIHtcbiAgICAgICAgY29uc3QgY2FsbElkID0gdGhpcy5wbGF5ZXJDYWxsTWFwLmdldChzb3VyY2UpO1xuICAgICAgICBpZiAoY2FsbElkKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBwdWJsaWMgZ2V0Q2FsbElkQnlQbGF5ZXIoc291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGxheWVyQ2FsbE1hcC5nZXQoc291cmNlKTtcbiAgICB9XG4gICAgcHVibGljIGFkZFBlbmRpbmdJbnZpdGF0aW9uKFxuICAgICAgICBjYWxsSWQ6IG51bWJlcixcbiAgICAgICAgdGFyZ2V0U291cmNlOiBudW1iZXIsXG4gICAgICAgIHRpbWVvdXRDYWxsYmFjazogKCkgPT4gdm9pZCxcbiAgICAgICAgdGltZW91dE1zOiBudW1iZXIgPSAzMDAwMFxuICAgICkge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm47XG4gICAgICAgIGlmIChjYWxsLnBlbmRpbmcuaGFzKHRhcmdldFNvdXJjZSkgfHwgY2FsbC5wYXJ0aWNpcGFudHMuaGFzKHRhcmdldFNvdXJjZSkpIHJldHVybjtcbiAgICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdGltZW91dENhbGxiYWNrKCk7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZVBlbmRpbmdJbnZpdGF0aW9uKGNhbGxJZCwgdGFyZ2V0U291cmNlKTtcbiAgICAgICAgfSwgdGltZW91dE1zKTtcbiAgICAgICAgY2FsbC5wZW5kaW5nLnNldCh0YXJnZXRTb3VyY2UsIHRpbWVvdXQpO1xuICAgIH1cbiAgICBwdWJsaWMgcmVtb3ZlUGVuZGluZ0ludml0YXRpb24oY2FsbElkOiBudW1iZXIsIHRhcmdldFNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgaWYgKGNhbGwucGVuZGluZy5oYXModGFyZ2V0U291cmNlKSkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGNhbGwucGVuZGluZy5nZXQodGFyZ2V0U291cmNlKSk7XG4gICAgICAgICAgICBjYWxsLnBlbmRpbmcuZGVsZXRlKHRhcmdldFNvdXJjZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcHVibGljIGFjY2VwdEludml0YXRpb24oY2FsbElkOiBudW1iZXIsIHBhcnRpY2lwYW50OiBDYWxsUGFydGljaXBhbnQpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoY2FsbC5wYXJ0aWNpcGFudHMuaGFzKHBhcnRpY2lwYW50LnNvdXJjZSkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY2FsbC5wYXJ0aWNpcGFudHMuc2V0KHBhcnRpY2lwYW50LnNvdXJjZSwgcGFydGljaXBhbnQpO1xuICAgICAgICB0aGlzLnBsYXllckNhbGxNYXAuc2V0KHBhcnRpY2lwYW50LnNvdXJjZSwgY2FsbElkKTtcbiAgICAgICAgaWYgKGNhbGwucGVuZGluZy5oYXMocGFydGljaXBhbnQuc291cmNlKSkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGNhbGwucGVuZGluZy5nZXQocGFydGljaXBhbnQuc291cmNlKSk7XG4gICAgICAgICAgICBjYWxsLnBlbmRpbmcuZGVsZXRlKHBhcnRpY2lwYW50LnNvdXJjZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHB1YmxpYyBkZWNsaW5lSW52aXRhdGlvbihjYWxsSWQ6IG51bWJlciwgdGFyZ2V0U291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBhc3luYyByZW1vdmVQYXJ0aWNpcGFudChjYWxsSWQ6IG51bWJlciwgc291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuO1xuXG4gICAgICAgIC8vIE5FVzogRW5kIGFuaW1hdGlvbiBmb3IgdGhlIGxlYXZpbmcgcGFydGljaXBhbnRcbiAgICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDplbmRDYWxsQW5pbWF0aW9uXCIsIHNvdXJjZSk7XG5cbiAgICAgICAgY2FsbC5wYXJ0aWNpcGFudHMuZGVsZXRlKHNvdXJjZSk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5kZWxldGUoc291cmNlKTtcbiAgICAgICAgaWYgKHNvdXJjZSA9PT0gY2FsbC5ob3N0LnNvdXJjZSB8fCBjYWxsLnBhcnRpY2lwYW50cy5zaXplIDw9IDEpIHtcbiAgICAgICAgICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiY29tcGxldGVkXCIsIFwiY29tcGxldGVkXCIsIG5ldyBEYXRlKCkpO1xuICAgICAgICAgICAgdGhpcy5lbmRDYWxsKGNhbGxJZCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcHVibGljIGVuZENhbGwoY2FsbElkOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuO1xuXG4gICAgICAgIC8vIE5FVzogRW5kIGFuaW1hdGlvbnMgZm9yIGFsbCBwYXJ0aWNpcGFudHNcbiAgICAgICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDplbmRDYWxsQW5pbWF0aW9uXCIsIHBhcnRpY2lwYW50LnNvdXJjZSk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IHRpbWVvdXQgb2YgY2FsbC5wZW5kaW5nLnZhbHVlcygpKSB7XG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgdGhpcy5wbGF5ZXJDYWxsTWFwLmRlbGV0ZShwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuY2FsbHMuZGVsZXRlKGNhbGxJZCk7XG4gICAgfVxuICAgIHB1YmxpYyByZW1vdmVGcm9tQ2FsbChjYWxsSWQ6IG51bWJlciwgc291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuO1xuICAgICAgICBjYWxsLnBhcnRpY2lwYW50cy5kZWxldGUoc291cmNlKTtcbiAgICAgICAgdGhpcy5wbGF5ZXJDYWxsTWFwLmRlbGV0ZShzb3VyY2UpO1xuICAgIH1cbiAgICBwdWJsaWMgc2V0SG9sZFN0YXR1cyhjYWxsSWQ6IG51bWJlciwgc291cmNlOiBudW1iZXIsIGhvbGQ6IGJvb2xlYW4pOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBwYXJ0aWNpcGFudCA9IGNhbGwucGFydGljaXBhbnRzLmdldChzb3VyY2UpO1xuICAgICAgICBpZiAoIXBhcnRpY2lwYW50KSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHBhcnRpY2lwYW50Lm9uSG9sZCA9IGhvbGQ7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBwdWJsaWMgZ2V0UGFydGljaXBhbnRzKGNhbGxJZDogbnVtYmVyKTogQ2FsbFBhcnRpY2lwYW50W10ge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm4gW107XG4gICAgICAgIHJldHVybiBBcnJheS5mcm9tKGNhbGwucGFydGljaXBhbnRzLnZhbHVlcygpKTtcbiAgICB9XG4gICAgcHVibGljIGdldEFsbENhbGxzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8T25nb2luZ0NhbGw+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FsbHMudmFsdWVzKCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGNyZWF0ZVJpbmdUb25lKHNvdXJjZTogYW55LCByaW5ndG9uZUxpbms6IHN0cmluZywgdm9sdW1lOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgcGVkID0gR2V0UGxheWVyUGVkKHNvdXJjZSk7XG4gICAgICAgIGNvbnN0IHBlZElkID0gTmV0d29ya0dldE5ldHdvcmtJZEZyb21FbnRpdHkocGVkKTtcbiAgICAgICAgY29uc3Qgc291bmRJZCA9IGF3YWl0IGV4cG9ydHNbJ3NvdW5kaGFuZGxlciddLlN0YXJ0QXR0YWNoU291bmQocmluZ3RvbmVMaW5rLCBwZWRJZCwgNSwgR2V0R2FtZVRpbWVyKCksIHRydWUsIDAuMTUpO1xuICAgICAgICB0aGlzLnJpbmdUb25lTWFuZ2VyLnNldChzb3VyY2UsIHNvdW5kSWQpO1xuICAgIH1cbiAgICBwdWJsaWMgYXN5bmMgc3RvcFJpbmdUb25lKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHNvdW5kSWQgPSB0aGlzLnJpbmdUb25lTWFuZ2VyLmdldChzb3VyY2UpO1xuICAgICAgICBpZiAoIXNvdW5kSWQpIHJldHVybjtcbiAgICAgICAgZXhwb3J0c1snc291bmRoYW5kbGVyJ10uU3RvcFNvdW5kKHNvdW5kSWQpO1xuICAgICAgICB0aGlzLnJpbmdUb25lTWFuZ2VyLmRlbGV0ZShzb3VyY2UpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IGNhbGxNYW5hZ2VyID0gbmV3IENhbGxNYW5hZ2VyKCk7IiwgImltcG9ydCB7IE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgTE9HR0VSIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcblxuY2xhc3MgU2V0dGluZyB7XG4gICAgcHVibGljIF9pZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgcHVibGljIGJhY2tncm91bmQgPSBuZXcgTWFwPHN0cmluZywgeyBjdXJyZW50OiBzdHJpbmc7IHdhbGxwYXBlcnM6IHN0cmluZ1tdIH0+KCk7XG4gICAgcHVibGljIGxvY2tzY3JlZW4gPSBuZXcgTWFwPHN0cmluZywgeyBjdXJyZW50OiBzdHJpbmc7IHdhbGxwYXBlcnM6IHN0cmluZ1tdIH0+KCk7XG4gICAgcHVibGljIHJpbmd0b25lID0gbmV3IE1hcDxzdHJpbmcsIHsgY3VycmVudDogc3RyaW5nOyByaW5ndG9uZXM6IHsgbmFtZTogc3RyaW5nLCB1cmw6IHN0cmluZyB9W10gfT4oKTtcbiAgICBwdWJsaWMgc2hvd1N0YXJ0dXBTY3JlZW4gPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcbiAgICBwdWJsaWMgc2hvd05vdGlmaWNhdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcbiAgICBwdWJsaWMgaXNMb2NrID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIGxvY2tQaW4gPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyB1c2VQaW4gPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcbiAgICBwdWJsaWMgdXNlRmFjZUlkID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIGZhY2VJZElkZW50aWZpZXIgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyBzbXJ0SWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyBzbXJ0UGFzc3dvcmQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyBpc0ZsaWdodE1vZGUgPSBuZXcgTWFwPHN0cmluZywgYm9vbGVhbj4oKTtcbiAgICBwdWJsaWMgcGhvbmVOdW1iZXIgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyBkYXJrTWFpbElkQXR0YWNoZWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyBwaWdlb25JZEF0dGFjaGVkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICAvLyBObyBhdXRvbWF0aWMgY2xlYW51cCAtIG9ubHkgcmVtb3ZlIG9uIHBsYXllciBkaXNjb25uZWN0XG5cbiAgICBwcml2YXRlIHNlZWRGcm9tRG9jKGRvYzogYW55KSB7XG4gICAgICAgIGlmICghZG9jPy5faWQpIHJldHVybjtcbiAgICAgICAgY29uc3QgaWQgPSBkb2MuX2lkO1xuICAgICAgICB0aGlzLl9pZC5zZXQoaWQsIGlkKTtcbiAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnNldChpZCwgZG9jLmJhY2tncm91bmQgPz8geyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSk7XG4gICAgICAgIHRoaXMubG9ja3NjcmVlbi5zZXQoaWQsIGRvYy5sb2Nrc2NyZWVuID8/IHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0pO1xuICAgICAgICB0aGlzLnJpbmd0b25lLnNldChpZCwgZG9jLnJpbmd0b25lID8/IHsgY3VycmVudDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLCByaW5ndG9uZXM6IFt7IG5hbWU6ICdkZWZhdWx0JywgdXJsOiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycgfV0gfSk7XG4gICAgICAgIHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uc2V0KGlkLCBkb2Muc2hvd1N0YXJ0dXBTY3JlZW4gPz8gdHJ1ZSk7XG4gICAgICAgIHRoaXMuc2hvd05vdGlmaWNhdGlvbnMuc2V0KGlkLCBkb2Muc2hvd05vdGlmaWNhdGlvbnMgPz8gdHJ1ZSk7XG4gICAgICAgIHRoaXMuaXNMb2NrLnNldChpZCwgZG9jLmlzTG9jayA/PyB0cnVlKTtcbiAgICAgICAgdGhpcy5sb2NrUGluLnNldChpZCwgZG9jLmxvY2tQaW4gPz8gJycpO1xuICAgICAgICB0aGlzLnVzZVBpbi5zZXQoaWQsIGRvYy51c2VQaW4gPz8gZmFsc2UpO1xuICAgICAgICB0aGlzLnVzZUZhY2VJZC5zZXQoaWQsIGRvYy51c2VGYWNlSWQgPz8gZmFsc2UpO1xuICAgICAgICB0aGlzLmZhY2VJZElkZW50aWZpZXIuc2V0KGlkLCBkb2MuZmFjZUlkSWRlbnRpZmllciA/PyBpZCk7XG4gICAgICAgIHRoaXMuZGFya01haWxJZEF0dGFjaGVkLnNldChpZCwgZG9jLmRhcmtNYWlsSWRBdHRhY2hlZCA/PyAnJyk7XG4gICAgICAgIHRoaXMuc21ydElkLnNldChpZCwgZG9jLnNtcnRJZCA/PyAnJyk7XG4gICAgICAgIHRoaXMuc21ydFBhc3N3b3JkLnNldChpZCwgZG9jLnNtcnRQYXNzd29yZCA/PyAnJyk7XG4gICAgICAgIHRoaXMuaXNGbGlnaHRNb2RlLnNldChpZCwgZG9jLmlzRmxpZ2h0TW9kZSA/PyBmYWxzZSk7XG4gICAgICAgIHRoaXMucGhvbmVOdW1iZXIuc2V0KGlkLCBkb2MucGhvbmVOdW1iZXIgPz8gJycpO1xuICAgICAgICB0aGlzLnBpZ2VvbklkQXR0YWNoZWQuc2V0KGlkLCBkb2MucGlnZW9uSWRBdHRhY2hlZCA/PyAnJyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGVuc3VyZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLl9pZC5oYXMoY2l0aXplbklkKSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGRvYyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZT8uKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmIChkb2MpIHtcbiAgICAgICAgICAgIHRoaXMuc2VlZEZyb21Eb2MoZG9jKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuUmVnaXN0ZXJOZXdTZXR0aW5ncyhjaXRpemVuSWQsIFwiXCIpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZT8uKCdwaG9uZV9zZXR0aW5ncycsIHtcbiAgICAgICAgICAgIF9pZDogY2l0aXplbklkLFxuICAgICAgICAgICAgYmFja2dyb3VuZDogdGhpcy5iYWNrZ3JvdW5kLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgbG9ja3NjcmVlbjogdGhpcy5sb2Nrc2NyZWVuLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgcmluZ3RvbmU6IHRoaXMucmluZ3RvbmUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0aGlzLnNob3dOb3RpZmljYXRpb25zLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgaXNMb2NrOiB0aGlzLmlzTG9jay5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGxvY2tQaW46IHRoaXMubG9ja1Bpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHVzZVBpbjogdGhpcy51c2VQaW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICB1c2VGYWNlSWQ6IHRoaXMudXNlRmFjZUlkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogdGhpcy5mYWNlSWRJZGVudGlmaWVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHNtcnRJZDogdGhpcy5zbXJ0SWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6IHRoaXMuc21ydFBhc3N3b3JkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgaXNGbGlnaHRNb2RlOiB0aGlzLmlzRmxpZ2h0TW9kZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHBob25lTnVtYmVyOiB0aGlzLnBob25lTnVtYmVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogdGhpcy5waWdlb25JZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbG9hZCgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIE15U1FMIEFkYXB0ZXIgbG9naWNcbiAgICAgICAgICAgIGNvbnN0IHJlczogYW55ID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfc2V0dGluZ3MnLCB7fSk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGRhdGEgb2YgcmVzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZWVkRnJvbURvYyhkYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBMb2FkZWQuYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBGYWlsZWQgdG8gbG9hZCBzZXR0aW5nczogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNhdmUoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiB0aGlzLl9pZCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBrZXkgfSwge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGtleSxcbiAgICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdGhpcy5iYWNrZ3JvdW5kLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBsb2Nrc2NyZWVuOiB0aGlzLmxvY2tzY3JlZW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHJpbmd0b25lOiB0aGlzLnJpbmd0b25lLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc2hvd05vdGlmaWNhdGlvbnM6IHRoaXMuc2hvd05vdGlmaWNhdGlvbnMuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIGlzTG9jazogdGhpcy5pc0xvY2suZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIGxvY2tQaW46IHRoaXMubG9ja1Bpbi5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgdXNlUGluOiB0aGlzLnVzZVBpbi5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgdXNlRmFjZUlkOiB0aGlzLnVzZUZhY2VJZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogdGhpcy5mYWNlSWRJZGVudGlmaWVyLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBkYXJrTWFpbElkQXR0YWNoZWQ6IHRoaXMuZGFya01haWxJZEF0dGFjaGVkLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBzbXJ0SWQ6IHRoaXMuc21ydElkLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6IHRoaXMuc21ydFBhc3N3b3JkLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBpc0ZsaWdodE1vZGU6IHRoaXMuaXNGbGlnaHRNb2RlLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogdGhpcy5waG9uZU51bWJlci5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogdGhpcy5waWdlb25JZEF0dGFjaGVkLmdldChrZXkpLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIFNhdmVkIHN1Y2Nlc3NmdWxseS5gKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gRmFpbGVkIHRvIHNhdmUgc2V0dGluZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBSZWdpc3Rlck5ld1NldHRpbmdzKGNpdGl6ZW5JZDogc3RyaW5nLCBudW1iZXI6IHN0cmluZykge1xuICAgICAgICB0aGlzLl9pZC5zZXQoY2l0aXplbklkLCBjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmJhY2tncm91bmQuc2V0KGNpdGl6ZW5JZCwgeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSk7XG4gICAgICAgIHRoaXMubG9ja3NjcmVlbi5zZXQoY2l0aXplbklkLCB7IGN1cnJlbnQ6ICcnLCB3YWxscGFwZXJzOiBbXSB9KTtcbiAgICAgICAgdGhpcy5yaW5ndG9uZS5zZXQoY2l0aXplbklkLCB7IGN1cnJlbnQ6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJywgcmluZ3RvbmVzOiBbeyBuYW1lOiAnZGVmYXVsdCcsIHVybDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnIH1dIH0pO1xuICAgICAgICB0aGlzLnNob3dTdGFydHVwU2NyZWVuLnNldChjaXRpemVuSWQsIHRydWUpO1xuICAgICAgICB0aGlzLnNob3dOb3RpZmljYXRpb25zLnNldChjaXRpemVuSWQsIHRydWUpO1xuICAgICAgICB0aGlzLmlzTG9jay5zZXQoY2l0aXplbklkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5sb2NrUGluLnNldChjaXRpemVuSWQsICcnKTtcbiAgICAgICAgdGhpcy51c2VQaW4uc2V0KGNpdGl6ZW5JZCwgZmFsc2UpO1xuICAgICAgICB0aGlzLnBob25lTnVtYmVyLnNldChjaXRpemVuSWQsIG51bWJlcik7XG4gICAgICAgIHRoaXMudXNlRmFjZUlkLnNldChjaXRpemVuSWQsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5mYWNlSWRJZGVudGlmaWVyLnNldChjaXRpemVuSWQsIGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuZGFya01haWxJZEF0dGFjaGVkLnNldChjaXRpemVuSWQsICcnKTtcbiAgICAgICAgdGhpcy5zbXJ0SWQuc2V0KGNpdGl6ZW5JZCwgJycpO1xuICAgICAgICB0aGlzLnNtcnRQYXNzd29yZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMuaXNGbGlnaHRNb2RlLnNldChjaXRpemVuSWQsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5waWdlb25JZEF0dGFjaGVkLnNldChjaXRpemVuSWQsICcnKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgU2F2ZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmVuc3VyZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IF9pZDogY2l0aXplbklkIH0sIHtcbiAgICAgICAgICAgICAgICBfaWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiB0aGlzLmJhY2tncm91bmQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgbG9ja3NjcmVlbjogdGhpcy5sb2Nrc2NyZWVuLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHJpbmd0b25lOiB0aGlzLnJpbmd0b25lLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0aGlzLnNob3dTdGFydHVwU2NyZWVuLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0aGlzLnNob3dOb3RpZmljYXRpb25zLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGlzTG9jazogdGhpcy5pc0xvY2suZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgbG9ja1BpbjogdGhpcy5sb2NrUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHVzZVBpbjogdGhpcy51c2VQaW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgdXNlRmFjZUlkOiB0aGlzLnVzZUZhY2VJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiB0aGlzLmZhY2VJZElkZW50aWZpZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzbXJ0SWQ6IHRoaXMuc21ydElkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHNtcnRQYXNzd29yZDogdGhpcy5zbXJ0UGFzc3dvcmQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgaXNGbGlnaHRNb2RlOiB0aGlzLmlzRmxpZ2h0TW9kZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogdGhpcy5waG9uZU51bWJlci5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBwaWdlb25JZEF0dGFjaGVkOiB0aGlzLnBpZ2VvbklkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBTYXZlZCBwbGF5ZXIgc2V0dGluZ3MgZm9yICR7Y2l0aXplbklkfSBzdWNjZXNzZnVsbHkuYCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIEZhaWxlZCB0byBzYXZlIHBsYXllciBzZXR0aW5ncyBmb3IgJHtjaXRpemVuSWR9OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgcGxheWVyIGRhdGEgb25seSB3aGVuIHBsYXllciBkaXNjb25uZWN0c1xuICAgIHB1YmxpYyBvblBsYXllckRpc2Nvbm5lY3QoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVQbGF5ZXJEYXRhKGNpdGl6ZW5JZCk7XG4gICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBDbGVhbmVkIHVwIGRhdGEgZm9yIGRpc2Nvbm5lY3RlZCBwbGF5ZXIgJHtjaXRpemVuSWR9YCk7XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIHBsYXllciBkYXRhIGZyb20gYWxsIG1hcHNcbiAgICBwcml2YXRlIHJlbW92ZVBsYXllckRhdGEoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5faWQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuYmFja2dyb3VuZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5sb2Nrc2NyZWVuLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnJpbmd0b25lLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnNob3dTdGFydHVwU2NyZWVuLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnNob3dOb3RpZmljYXRpb25zLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmlzTG9jay5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5sb2NrUGluLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnVzZVBpbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy51c2VGYWNlSWQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuZmFjZUlkSWRlbnRpZmllci5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zbXJ0SWQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuc21ydFBhc3N3b3JkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmlzRmxpZ2h0TW9kZS5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5waG9uZU51bWJlci5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMucGlnZW9uSWRBdHRhY2hlZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICB9XG5cbiAgICAvLyBQdWJsaWMgbWV0aG9kIHRvIG1hbnVhbGx5IGNsZWFuIHVwIGEgc3BlY2lmaWMgcGxheWVyIChmb3IgYWRtaW4gY29tbWFuZHMpXG4gICAgcHVibGljIGNsZWFudXBQbGF5ZXIoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVQbGF5ZXJEYXRhKGNpdGl6ZW5JZCk7XG4gICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBNYW51YWxseSBjbGVhbmVkIHVwIGRhdGEgZm9yIHBsYXllciAke2NpdGl6ZW5JZH1gKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBTZXR0aW5ncyA9IG5ldyBTZXR0aW5nKCk7XG4iLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgY2FsbE1hbmFnZXIgfSBmcm9tIFwiLi9DYWxsTWFuYWdlclwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBQaG9uZUNvbnRhY3RzIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBjYWxsSGlzdG9yeU1hbmFnZXIsIFBsYXllckNhbGxIaXN0b3J5IH0gZnJvbSBcIi4vY2FsbEhpc3RvcnlNYW5hZ2VyXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuLi9TZXR0aW5ncy9jbGFzc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiXG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJzdW1taXRfcGhvbmU6c2VydmVyOmNhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBudW1iZXIsIF9pZCwgdm9sdW1lIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJGcm9tUGhvbmVOdW1iZXIobnVtYmVyKTtcbiAgY29uc3QgdGFyZ2V0RGF0YTogUGhvbmVDb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IGNvbnRhY3ROdW1iZXI6IG51bWJlciwgcGVyc29uYWxOdW1iZXI6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKSB9KTtcblxuICBjb25zdCBzb3VyY2VEYXRhOiBQaG9uZUNvbnRhY3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHtcbiAgICBjb250YWN0TnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgcGVyc29uYWxOdW1iZXI6IG51bWJlclxuICB9KTtcblxuICBpZiAoIXRhcmdldFBsYXllcikge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICBjb25zdCBjYWxsZXJSZWNvcmQ6IFBsYXllckNhbGxIaXN0b3J5ID0ge1xuICAgICAgY2FsbElkOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKSxcbiAgICAgIHJvbGU6IFwiY2FsbGVyXCIsXG4gICAgICBteVBob25lTnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuXG4gICAgY29uc3QgY2FsbGVlUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCksXG4gICAgICByb2xlOiBcImNhbGxlZVwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSksXG4gICAgICBzdGF0dXM6IFwibWlzc2VkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlclJlY29yZCk7XG4gICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVlUmVjb3JkKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCB0YXJnZXRTb3VyY2UgPSB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2U7XG5cbiAgaWYgKGNhbGxNYW5hZ2VyLmlzUGxheWVySW5DYWxsKHNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IGFyZSBhbHJlYWR5IGluIGEgY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBpZiAoY2FsbE1hbmFnZXIuaXNQbGF5ZXJJbkNhbGwodGFyZ2V0U291cmNlKSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEJ1c3lcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlRhcmdldCBpcyBhbHJlYWR5IGluIGEgY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBzb3VyY2VQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0UGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHNvdXJjZUNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IElzTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZCh0YXJnZXRQaG9uZSwgc291cmNlUGhvbmUpO1xuICBjb25zdCBzb3VyY2VGbGlnaHRNb2RlID0gYXdhaXQgVXRpbHMuSW5GbGlnaHRNb2RlKHNvdXJjZUNpdGl6ZW5JZCk7XG4gIGNvbnN0IHRhcmdldEZsaWdodE1vZGUgPSBhd2FpdCBVdGlscy5JbkZsaWdodE1vZGUodGFyZ2V0Q2l0aXplbklkKTtcbiAgaWYgKHNvdXJjZUZsaWdodE1vZGUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiRmxpZ2h0IE1vZGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBjYW5ub3QgbWFrZSBjYWxscyB3aGlsZSBpbiBmbGlnaHQgbW9kZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSBpZiAodGFyZ2V0RmxpZ2h0TW9kZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyB1bnJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKElzTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBTaG91cmNlTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChzb3VyY2VQaG9uZSwgdGFyZ2V0UGhvbmUpO1xuICBpZiAoU2hvdXJjZU51bWJlckJsb2NrZWQpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTnVtYmVyIEJsb2NrZWRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlVuYmxvY2sgdGhlIG51bWJlciB0byBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB0YXJnZXRIYXNQaG9uZSA9IGF3YWl0IFV0aWxzLkhhc1Bob25lKHRhcmdldFNvdXJjZSk7XG4gIGlmICghdGFyZ2V0SGFzUGhvbmUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcblxuICAgIGNvbnN0IHRpbWVzdGFtcCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgICBjb25zdCBjYWxsZXJSZWNvcmQ6IFBsYXllckNhbGxIaXN0b3J5ID0ge1xuICAgICAgY2FsbElkOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKSxcbiAgICAgIHJvbGU6IFwiY2FsbGVyXCIsXG4gICAgICBteVBob25lTnVtYmVyOiBzb3VyY2VQaG9uZSxcbiAgICAgIG90aGVyUGFydHlQaG9uZU51bWJlcjogdGFyZ2V0UGhvbmUsXG4gICAgICBzdGF0dXM6IFwidW5hbnN3ZXJlZFwiLFxuICAgICAgY2FsbFRpbWU6IDAsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcblxuICAgIGNvbnN0IGNhbGxlZVJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApLFxuICAgICAgcm9sZTogXCJjYWxsZWVcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBzb3VyY2VQaG9uZSxcbiAgICAgIHN0YXR1czogXCJtaXNzZWRcIixcbiAgICAgIGNhbGxUaW1lOiAwLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG4gICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVyUmVjb3JkKTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZWVSZWNvcmQpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBob3N0UGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlLFxuICAgIGNpdGl6ZW5JZDogc291cmNlQ2l0aXplbklkLFxuICAgIHBob25lTnVtYmVyOiBzb3VyY2VQaG9uZSxcbiAgICBvbkhvbGQ6IGZhbHNlLFxuICB9O1xuXG4gIGNvbnN0IGNhbGxJZCA9IGNhbGxNYW5hZ2VyLmNyZWF0ZUNhbGwoaG9zdFBhcnRpY2lwYW50KTtcblxuICBjYWxsTWFuYWdlci5jcmVhdGVSaW5nVG9uZSh0YXJnZXRTb3VyY2UsIFN0cmluZyhTZXR0aW5ncy5yaW5ndG9uZS5nZXQodGFyZ2V0Q2l0aXplbklkKT8uY3VycmVudCksIHZvbHVtZSk7XG4gIGNhbGxNYW5hZ2VyLmFkZFBlbmRpbmdJbnZpdGF0aW9uKGNhbGxJZCwgdGFyZ2V0U291cmNlLCAoKSA9PiB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgVGltZW91dFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ2FsbCB3YXMgbm90IGFuc3dlcmVkIGJ5IHRhcmdldFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTWlzc2VkIENhbGxcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBtaXNzZWQgYSBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gICAgICBpZiAoY2FsbCkge1xuICAgICAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcInVuYW5zd2VyZWRcIiwgXCJtaXNzZWRcIiwgbmV3IERhdGUoKSwgdGFyZ2V0UGhvbmUpO1xuICAgICAgfVxuICAgICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gICAgfSkoKTtcbiAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwoc291cmNlLCAwKTtcbiAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwodGFyZ2V0U291cmNlLCAwKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIF9pZCk7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gIH0sIDIwMDAwKTtcblxuICBjb25zdCBzb3VyY2VOYW1lID0gc291cmNlRGF0YSA/IGAke3NvdXJjZURhdGEuZmlyc3ROYW1lfSAke3NvdXJjZURhdGEubGFzdE5hbWV9YCA6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0TmFtZSA9IHRhcmdldERhdGEgPyBgJHt0YXJnZXREYXRhLmZpcnN0TmFtZX0gJHt0YXJnZXREYXRhLmxhc3ROYW1lfWAgOiBudW1iZXI7XG5cbiAgZW1pdE5ldChcInBob25lOmFkZEFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBpZDogX2lkLFxuICAgIHRpdGxlOiBcIkluY29taW5nIENhbGxcIixcbiAgICBkZXNjcmlwdGlvbjogYCR7c291cmNlTmFtZX0gaXMgY2FsbGluZyB5b3VgLFxuICAgIGFwcDogXCJwaG9uZVwiLFxuICAgIGljb25zOiB7XG4gICAgICBcIjBcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2Nyb3NzLWNpcmNsZS5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIFwiMVwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvYWNjZXB0LnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmFjY2VwdENhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgc291cmNlTmFtZTogdGFyZ2V0TmFtZSxcbiAgICAgICAgICB0YXJnZXROYW1lOiBzb3VyY2VOYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogX2lkLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSkpO1xuXG4gIC8qIGNvbnNvbGUubG9nKHNvdXJjZSwgXCJDYWxsaW5nXCIsIHRhcmdldFNvdXJjZSwgdGFyZ2V0TmFtZSwgX2lkKTsgKi9cbiAgZW1pdE5ldChcInN1bW1pdF9waG9uZTpzZXJ2ZXI6YWRkQ2FsbGluZ2ludGVyZmFjZVwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHRhcmdldE5hbWUsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gIH0pKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ0NhbGwgSW5pdGlhdGVkJyxcbiAgICBtZXNzYWdlOiBgJHtzb3VyY2VQaG9uZX0gaW5pdGlhdGVkIGEgY2FsbCB0byAke3RhcmdldFBob25lfSAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgfSk7XG4gIHJldHVybiB0cnVlO1xufSk7XG5cbm9uTmV0KFwic3VtbWl0X3Bob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLCBhc3luYyAoZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHNvdXJjZSA9IGdsb2JhbC5zb3VyY2UgYXMgbnVtYmVyO1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgLyogY29uc29sZS5sb2coc291cmNlLCBcIkRlY2xpbmluZyBjYWxsXCIsIGNhbGxJZCwgdGFyZ2V0U291cmNlLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCk7ICovXG4gIGNhbGxNYW5hZ2VyLmRlY2xpbmVJbnZpdGF0aW9uKGNhbGxJZCwgdGFyZ2V0U291cmNlKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihjYWxsZXJTb3VyY2UpO1xuICBpZiAoY2FsbCkge1xuICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiZGVjbGluZWRcIiwgXCJkZWNsaW5lZFwiLCBuZXcgRGF0ZSgpKTtcbiAgfVxuICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICBpZiAoIXRhcmdldFNvdXJjZSB8fCAhY2FsbGVyU291cmNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIGNhbGxlclNvdXJjZSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgdGl0bGU6ICdDYWxsIERlY2xpbmVkJyxcbiAgICBtZXNzYWdlOiBgJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9IGRlY2xpbmVkIHRoZSBjYWxsIGZyb20gJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNhbGxlclNvdXJjZSl9IChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwic3VtbWl0X3Bob25lOnNlcnZlcjplbmRDYWxsXCIsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHsgY2FsbElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gIGlmICghY2FsbCB8fCBjYWxsLmNhbGxJZCAhPT0gY2FsbElkKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGNhbGxIb3N0ID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEhvc3QoY2FsbElkKTtcbiAgaWYgKGNhbGxIb3N0ICYmIGNhbGxIb3N0LnNvdXJjZSA9PT0gc291cmNlIHx8IGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpLmxlbmd0aCA8PSAxKSB7XG4gICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY2NwZXRlZENhbGxpbmdJbnRlcmZhY2VcIiwgcGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChwYXJ0aWNpcGFudC5zb3VyY2UsIDApO1xuICAgIH1cbiAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpKTtcbiAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgICAgdGl0bGU6ICdDYWxsIEVuZGVkJyxcbiAgICAgIG1lc3NhZ2U6IGBDYWxsIGVuZGVkIGJ5ICR7YXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpfSAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICB9IGVsc2UgaWYgKGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpLmxlbmd0aCA+IDIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjY3BldGVkQ2FsbGluZ0ludGVyZmFjZVwiLCBzb3VyY2UpO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQ2FsbGluZ0ludGVyZmFjZVwiLCBzb3VyY2UpO1xuICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgIGNhbGxNYW5hZ2VyLnJlbW92ZUZyb21DYWxsKGNhbGxJZCwgc291cmNlKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgICB0aXRsZTogJ1BhcnRpY2lwYW50IExlZnQgQ2FsbCcsXG4gICAgICBtZXNzYWdlOiBgJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSl9IGxlZnQgdGhlIGNvbmZlcmVuY2UgY2FsbCAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkpIHtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWNjcGV0ZWRDYWxsaW5nSW50ZXJmYWNlXCIsIHBhcnRpY2lwYW50LnNvdXJjZSk7XG4gICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwocGFydGljaXBhbnQuc291cmNlLCAwKTtcbiAgICB9XG4gICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJjb21wbGV0ZWRcIiwgXCJjb21wbGV0ZWRcIiwgbmV3IERhdGUoKSk7XG4gICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICAgIHRpdGxlOiAnQ2FsbCBFbmRlZCcsXG4gICAgICBtZXNzYWdlOiBgQ2FsbCBlbmRlZCBieSAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKX0gKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwic3VtbWl0X3Bob25lOnNlcnZlcjphZGRQbGF5ZXJUb0NhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBjb250YWN0TnVtYmVyLCBfaWQsIHZvbHVtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgdGFyZ2V0RGF0YTogUGhvbmVDb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZCB9KTtcbiAgY29uc3Qgc291cmNlRGF0YTogUGhvbmVDb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7XG4gICAgY29udGFjdE51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpLFxuICAgIHBlcnNvbmFsTnVtYmVyOiBjb250YWN0TnVtYmVyXG4gIH0pO1xuICBjb25zdCBjYWxsSWQgPSBjYWxsTWFuYWdlci5nZXRDYWxsSWRCeVBsYXllcihzb3VyY2UpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gIGlmICghY2FsbCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJObyBvbmdvaW5nIGNhbGwgZm91bmRcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHNvdXJjZVBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJGcm9tUGhvbmVOdW1iZXIoY29udGFjdE51bWJlcik7XG4gIGlmICghdGFyZ2V0UGxheWVyKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBhZGQgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgdGFyZ2V0U291cmNlID0gdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlO1xuICBjb25zdCBJc051bWJlckJsb2NrZWQgPSBhd2FpdCBVdGlscy5Jc051bWJlckJsb2NrZWQoY29udGFjdE51bWJlciwgc291cmNlUGhvbmUpO1xuICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGNvbnRhY3ROdW1iZXIpO1xuICBjb25zdCBzb3VyY2VGbGlnaHRNb2RlID0gYXdhaXQgVXRpbHMuSW5GbGlnaHRNb2RlKHNvdXJjZUNpdGl6ZW5JZCk7XG4gIGNvbnN0IHRhcmdldEZsaWdodE1vZGUgPSBhd2FpdCBVdGlscy5JbkZsaWdodE1vZGUodGFyZ2V0Q2l0aXplbklkKTtcbiAgaWYgKHNvdXJjZUZsaWdodE1vZGUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiRmxpZ2h0IE1vZGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBjYW5ub3QgbWFrZSBjYWxscyB3aGlsZSBpbiBmbGlnaHQgbW9kZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSBpZiAodGFyZ2V0RmxpZ2h0TW9kZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyB1bnJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKElzTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBTaG91cmNlTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChzb3VyY2VQaG9uZSwgY29udGFjdE51bWJlcik7XG4gIGlmIChTaG91cmNlTnVtYmVyQmxvY2tlZCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJOdW1iZXIgQmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiVW5ibG9jayB0aGUgbnVtYmVyIHRvIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHRhcmdldEhhc1Bob25lID0gYXdhaXQgVXRpbHMuSGFzUGhvbmUodGFyZ2V0U291cmNlKTtcbiAgaWYgKCF0YXJnZXRIYXNQaG9uZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoY2FsbC5wYXJ0aWNpcGFudHMuaGFzKHRhcmdldFNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQWxyZWFkeSBpbiBDYWxsXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQbGF5ZXIgaXMgYWxyZWFkeSBpbiB0aGUgY2FsbFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY2FsbE1hbmFnZXIuY3JlYXRlUmluZ1RvbmUodGFyZ2V0U291cmNlLCBTdHJpbmcoU2V0dGluZ3MucmluZ3RvbmUuZ2V0KHRhcmdldENpdGl6ZW5JZCk/LmN1cnJlbnQpLCB2b2x1bWUpO1xuICBjYWxsTWFuYWdlci5hZGRQZW5kaW5nSW52aXRhdGlvbihOdW1iZXIoY2FsbElkKSwgdGFyZ2V0U291cmNlLCAoKSA9PiB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgVGltZW91dFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGxheWVyIGRpZCBub3QgYW5zd2VyIGNvbmZlcmVuY2UgY2FsbCBpbnZpdGF0aW9uXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICB9LCAzMDAwMCk7XG5cbiAgY29uc3Qgc291cmNlTmFtZSA9IHNvdXJjZURhdGFcbiAgICA/IGAke3NvdXJjZURhdGEuZmlyc3ROYW1lfSAke3NvdXJjZURhdGEubGFzdE5hbWV9YFxuICAgIDogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXROYW1lID0gdGFyZ2V0RGF0YSA/IGAke3RhcmdldERhdGEuZmlyc3ROYW1lfSAke3RhcmdldERhdGEubGFzdE5hbWV9YCA6IGNvbnRhY3ROdW1iZXI7XG5cbiAgZW1pdE5ldChcInBob25lOmFkZEFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBpZDogX2lkLFxuICAgIHRpdGxlOiBcIkluY29taW5nIENvbmZlcmVuY2UgQ2FsbFwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHtzb3VyY2VOYW1lfSBpcyBhZGRpbmcgeW91IHRvIGEgY29uZmVyZW5jZSBjYWxsYCxcbiAgICBhcHA6IFwicGhvbmVcIixcbiAgICBpY29uczoge1xuICAgICAgXCIwXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9jcm9zcy1jaXJjbGUuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6ZGVjbGluZUNhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZDogY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICB0YXJnZXROYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogX2lkLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBcIjFcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2FjY2VwdC5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphY2NlcHRDb25mZXJlbmNlQ2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkOiBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0sXG4gIH0pKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ1BsYXllciBBZGRlZCB0byBDYWxsJyxcbiAgICBtZXNzYWdlOiBgJHtzb3VyY2VQaG9uZX0gYWRkZWQgJHtjb250YWN0TnVtYmVyfSB0byBjb25mZXJlbmNlIGNhbGwgKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xuICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwicGhvbmU6c2VydmVyOmdldENhbGxIaXN0b3J5XCIsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgbWF4UmVjb3Jkc1g6IG51bWJlcikgPT4ge1xuICBsZXQgbWF4UmVjb3JkcyA9IDEwMDtcbiAgdHJ5IHtcbiAgICBpZiAobWF4UmVjb3Jkc1gpIHtcbiAgICAgIG1heFJlY29yZHMgPSBtYXhSZWNvcmRzWDtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yIHBhcnNpbmcgZ2V0Q2FsbEhpc3RvcnkgZGF0YVwiLCBlcnJvcik7XG4gIH1cblxuICBjb25zdCBwaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcblxuICB0cnkge1xuICAgIGNvbnN0IGhpc3RvcnkgPSBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIuZ2V0UGxheWVyQ2FsbEhpc3RvcnkocGhvbmVOdW1iZXIsIG1heFJlY29yZHMpO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShoaXN0b3J5KTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgcmV0cmlldmluZyBjYWxsIGhpc3RvcnkgZm9yIHBob25lIG51bWJlcjpcIiwgcGhvbmVOdW1iZXIsIGVycm9yKTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoW10pO1xuICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6c2VydmVyOmdldERhdGFGcm9tREJ3aXRoTnVtYmVyJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgIG51bWJlcjogc3RyaW5nLFxuICAgIGNpdGl6ZW5JZDogc3RyaW5nLFxuICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGFyc2VkRGF0YS5udW1iZXIsIG93bmVySWQ6IHBhcnNlZERhdGEuY2l0aXplbklkIH0pO1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZTpzZXJ2ZXI6dG9nZ2xlQmxvY2tOdW1iZXInLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCBwYXJzZWREYXRhOiBQaG9uZUNvbnRhY3RzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgcGVyc29uYWxOdW1iZXIgPSBwYXJzZWREYXRhLnBlcnNvbmFsTnVtYmVyO1xuICBjb25zdCBjb250YWN0TnVtYmVyID0gcGFyc2VkRGF0YS5jb250YWN0TnVtYmVyO1xuICBsZXQgSXNOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKHBlcnNvbmFsTnVtYmVyLCBjb250YWN0TnVtYmVyKTtcbiAgaWYgKCFJc051bWJlckJsb2NrZWQpIHtcbiAgICBhd2FpdCBVdGlscy5CbG9ja051bWJlcihwZXJzb25hbE51bWJlciwgY29udGFjdE51bWJlcik7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk51bWJlciBCbG9ja2VkXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJOdW1iZXIgaGFzIGJlZW4gYmxvY2tlZFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBVdGlscy5VbmJsb2NrTnVtYmVyKHBlcnNvbmFsTnVtYmVyLCBjb250YWN0TnVtYmVyKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTnVtYmVyIFVuYmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIGhhcyBiZWVuIHVuYmxvY2tlZFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKFwic3VtbWl0X3Bob25lOnNlcnZlcjpqYWlsQ2FsbFwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCB7IG51bWJlciwgdm9sdW1lIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJGcm9tUGhvbmVOdW1iZXIobnVtYmVyKTtcblxuICAvLyBGb3IgamFpbCBjYWxscywgd2UgZG9uJ3QgbmVlZCB0byBjaGVjayBpZiB0aGUgY2FsbGVyIGhhcyBhIHBob25lXG4gIC8vIFdlIGFsc28gZG9uJ3QgbmVlZCB0byBjaGVjayBmbGlnaHQgbW9kZSBzaW5jZSBpdCdzIGEgamFpbCBwaG9uZVxuXG4gIGlmICghdGFyZ2V0UGxheWVyKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgdGFyZ2V0U291cmNlID0gdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlO1xuXG4gIGlmIChjYWxsTWFuYWdlci5pc1BsYXllckluQ2FsbChzb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBhcmUgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGNhbGxNYW5hZ2VyLmlzUGxheWVySW5DYWxsKHRhcmdldFNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBCdXN5XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJUYXJnZXQgaXMgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3Qgc291cmNlUGhvbmUgPSBcIkpBSUxfUEhPTkVcIjsgLy8gU3BlY2lhbCBpZGVudGlmaWVyIGZvciBqYWlsIHBob25lIGNhbGxzXG4gIGNvbnN0IHRhcmdldFBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuXG4gIC8vIEZvciBqYWlsIGNhbGxzLCB3ZSBkb24ndCBjaGVjayBibG9ja2VkIG51bWJlcnMgb3IgZmxpZ2h0IG1vZGVcbiAgLy8gVGhpcyBhbGxvd3MgaW5jYXJjZXJhdGVkIHBsYXllcnMgdG8gbWFrZSBjYWxscyBldmVuIGlmIHRoZXkncmUgYmxvY2tlZFxuXG4gIGNvbnN0IHRhcmdldEhhc1Bob25lID0gYXdhaXQgVXRpbHMuSGFzUGhvbmUodGFyZ2V0U291cmNlKTtcbiAgaWYgKCF0YXJnZXRIYXNQaG9uZSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IGhvc3RQYXJ0aWNpcGFudCA9IHtcbiAgICBzb3VyY2UsXG4gICAgY2l0aXplbklkOiBzb3VyY2VDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHNvdXJjZVBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG5cbiAgY29uc3QgY2FsbElkID0gY2FsbE1hbmFnZXIuY3JlYXRlQ2FsbChob3N0UGFydGljaXBhbnQpO1xuXG4gIGNhbGxNYW5hZ2VyLmNyZWF0ZVJpbmdUb25lKHRhcmdldFNvdXJjZSwgU3RyaW5nKFNldHRpbmdzLnJpbmd0b25lLmdldCh0YXJnZXRDaXRpemVuSWQpPy5jdXJyZW50KSwgdm9sdW1lKTtcblxuICAvLyBKYWlsIGNhbGxzIGhhdmUgYSBzaG9ydGVyIHRpbWVvdXQgKDE1IG1pbnV0ZXMgaW5zdGVhZCBvZiAyMClcbiAgY2FsbE1hbmFnZXIuYWRkUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UsICgpID0+IHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBUaW1lb3V0XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDYWxsIHdhcyBub3QgYW5zd2VyZWQgYnkgdGFyZ2V0XCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJNaXNzZWQgQ2FsbFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiWW91IG1pc3NlZCBhIGNhbGwgZnJvbSBKQUlMXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gICAgICBpZiAoY2FsbCkge1xuICAgICAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcInVuYW5zd2VyZWRcIiwgXCJtaXNzZWRcIiwgbmV3IERhdGUoKSwgdGFyZ2V0UGhvbmUpO1xuICAgICAgfVxuICAgICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gICAgfSkoKTtcbiAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwoc291cmNlLCAwKTtcbiAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwodGFyZ2V0U291cmNlLCAwKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIFwiamFpbF9jYWxsXCIpO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQ2FsbGluZ0ludGVyZmFjZVwiLCBzb3VyY2UpO1xuICB9LCAxNTAwMCk7IC8vIDE1IG1pbnV0ZXMgZm9yIGphaWwgY2FsbHNcblxuICBjb25zdCBzb3VyY2VOYW1lID0gXCJKQUlMIFBIT05FXCI7XG4gIGNvbnN0IHRhcmdldE5hbWUgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0TmFtZUJ5TnVtYmVyKG51bWJlciwgdGFyZ2V0Q2l0aXplbklkKTtcblxuICBlbWl0TmV0KFwicGhvbmU6YWRkQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGlkOiBcImphaWxfY2FsbFwiLFxuICAgIHRpdGxlOiBcIkluY29taW5nIENhbGwgZnJvbSBKQUlMXCIsXG4gICAgZGVzY3JpcHRpb246IGAke3NvdXJjZU5hbWV9IGlzIGNhbGxpbmcgeW91YCxcbiAgICBhcHA6IFwicGhvbmVcIixcbiAgICBpY29uczoge1xuICAgICAgXCIwXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9jcm9zcy1jaXJjbGUuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6ZGVjbGluZUNhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgc291cmNlTmFtZSxcbiAgICAgICAgICB0YXJnZXROYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogXCJqYWlsX2NhbGxcIixcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgICAgXCIxXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9hY2NlcHQuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q2FsbFwiLFxuICAgICAgICBhcmdzOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lOiB0YXJnZXROYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWU6IHNvdXJjZU5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBcImphaWxfY2FsbFwiLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSkpO1xuXG4gIGVtaXROZXQoXCJzdW1taXRfcGhvbmU6c2VydmVyOmFkZENhbGxpbmdpbnRlcmZhY2VcIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY2FsbElkLFxuICAgIHRhcmdldFNvdXJjZSxcbiAgICB0YXJnZXROYW1lLFxuICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgIGRhdGFiYXNlVGFibGVJZDogXCJqYWlsX2NhbGxcIixcbiAgfSkpO1xuXG4gIC8vIFN0YXJ0IGEgdGltZXIgdG8gYXV0b21hdGljYWxseSBlbmQgamFpbCBjYWxscyBhZnRlciAxMCBtaW51dGVzXG4gIC8vIFRoaXMgcHJldmVudHMgYWJ1c2UgYW5kIHNpbXVsYXRlcyByZWFsIGphaWwgcGhvbmUgbGltaXRhdGlvbnNcbiAgc2V0VGltZW91dChhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICAgIGlmIChjYWxsICYmIGNhbGwuY2FsbElkID09PSBjYWxsSWQpIHtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiQ2FsbCBFbmRlZFwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJKYWlsIHBob25lIGNhbGwgdGltZSBsaW1pdCByZWFjaGVkXCIsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgfSkpO1xuICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJDYWxsIEVuZGVkXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIkphaWwgcGhvbmUgY2FsbCB0aW1lIGxpbWl0IHJlYWNoZWRcIixcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDMwMDAsXG4gICAgICB9KSk7XG5cbiAgICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiY29tcGxldGVkXCIsIFwiY29tcGxldGVkXCIsIG5ldyBEYXRlKCksIHRhcmdldFBob25lKTtcbiAgICAgIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChzb3VyY2UsIDApO1xuICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgMCk7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIFwiamFpbF9jYWxsXCIpO1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIHNvdXJjZSk7XG4gICAgfVxuICB9LCA2MDAwMDApOyAvLyAxMCBtaW51dGVzXG5cbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICB0aXRsZTogJ0phaWwgQ2FsbCBJbml0aWF0ZWQnLFxuICAgIG1lc3NhZ2U6IGBKYWlsIGNhbGwgaW5pdGlhdGVkIGZyb20gJHtzb3VyY2V9IHRvICR7dGFyZ2V0U291cmNlfSAoJHt0YXJnZXRQaG9uZX0pYCxcbiAgICBzaG93SWRlbnRpZmllcnM6IHRydWUsXG4gIH0pO1xuXG4gIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IGNhbGxNYW5hZ2VyIH0gZnJvbSBcIi4vQ2FsbE1hbmFnZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IGNhbGxIaXN0b3J5TWFuYWdlciB9IGZyb20gXCIuL2NhbGxIaXN0b3J5TWFuYWdlclwiO1xuaW1wb3J0IHsgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjpkZWNsaW5lQ2FsbFwiLCBhc3luYyAobm90aUlkOiBzdHJpbmcsIGFyZ3M6IGFueSkgPT4ge1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShhcmdzKTtcbiAgY2FsbE1hbmFnZXIuZGVjbGluZUludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmIChjYWxsKSB7XG4gICAgY29uc3QgdGFyZ2V0UGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJkZWNsaW5lZFwiLCBcImRlY2xpbmVkXCIsIG5ldyBEYXRlKCksIHRhcmdldFBob25lKTtcbiAgfVxuICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICBcbiAgLy8gTkVXOiBFbmQgYW5pbWF0aW9ucyBmb3IgYm90aCBwYXJ0aWVzXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCB0YXJnZXRTb3VyY2UpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OmVuZENhbGxBbmltYXRpb25cIiwgY2FsbGVyU291cmNlKTtcbiAgXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVDYWxsaW5nSW50ZXJmYWNlXCIsIGNhbGxlclNvdXJjZSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6IFwicGhvbmVcIixcbiAgICB0aXRsZTogXCJDYWxsIERlY2xpbmVkXCIsXG4gICAgbWVzc2FnZTogYCR7VXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShjYWxsZXJTb3VyY2UpfSBoYXMgZGVjbGluZWQgdGhlIGNhbGwgZnJvbSAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKX1gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2UsXG4gIH0pO1xufSk7XG5cbm9uTmV0KFwicGhvbmU6c2VydmVyOmFjY2VwdENhbGxcIiwgYXN5bmMgKG5vdGlJZDogc3RyaW5nLCBhcmdzOiBhbnkpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQsIHRhcmdldFNvdXJjZSwgdGFyZ2V0TmFtZSwgc291cmNlTmFtZSwgY2FsbGVyU291cmNlLCBkYXRhYmFzZVRhYmxlSWQgfSA9IEpTT04ucGFyc2UoYXJncyk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoY2FsbGVyU291cmNlKTtcbiAgaWYgKCFjYWxsIHx8IGNhbGwuY2FsbElkICE9PSBjYWxsSWQpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ2FsbCBubyBsb25nZXIgZXhpc3RzXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgcGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlOiB0YXJnZXRTb3VyY2UsXG4gICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG4gIGlmICghY2FsbE1hbmFnZXIuYWNjZXB0SW52aXRhdGlvbihjYWxsSWQsIHBhcnRpY2lwYW50KSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb3VsZCBub3Qgam9pbiBjYWxsXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybjtcbiAgfVxuICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgY2FsbElkKTtcbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKGNhbGxlclNvdXJjZSwgY2FsbElkKTtcbiAgXG4gIC8vIE5FVzogU3RhcnQgYW5pbWF0aW9uIGZvciBib3RoIHBhcnRpZXMgd2hlbiBjYWxsIGlzIGFjY2VwdGVkXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6YWNjZXB0Q2FsbFwiLCB0YXJnZXRTb3VyY2UsIGFyZ3MpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnN0YXJ0Q2FsbEFuaW1hdGlvblwiLCBjYWxsZXJTb3VyY2UpOyAvLyBORVc6IEFuaW1hdGlvbiBmb3IgY2FsbGVyXG4gIFxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnVwZGF0ZUNhbGxlckludGVyZmFjZVwiLCBjYWxsZXJTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQsXG4gIH0pKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBub3RpSWQpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiBcInBob25lXCIsXG4gICAgdGl0bGU6IFwiQ2FsbCBBY2NlcHRlZFwiLFxuICAgIG1lc3NhZ2U6IGAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gaGFzIGFjY2VwdGVkIHRoZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjphY2NlcHRDb25mZXJlbmNlQ2FsbFwiLCBhc3luYyAobm90aUlkOiBzdHJpbmcsIGFyZ3M6IGFueSkgPT4ge1xuICBjb25zdCB7IGNhbGxJZCwgdGFyZ2V0U291cmNlLCB0YXJnZXROYW1lLCBzb3VyY2VOYW1lLCBjYWxsZXJTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCB9ID0gSlNPTi5wYXJzZShhcmdzKTtcblxuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmICghY2FsbCkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJDb25mZXJlbmNlIGNhbGwgbm8gbG9uZ2VyIGV4aXN0c1wiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldFBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBwYXJ0aWNpcGFudCA9IHtcbiAgICBzb3VyY2U6IHRhcmdldFNvdXJjZSxcbiAgICBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCxcbiAgICBwaG9uZU51bWJlcjogdGFyZ2V0UGhvbmUsXG4gICAgb25Ib2xkOiBmYWxzZSxcbiAgfTtcbiAgaWYgKCFjYWxsTWFuYWdlci5hY2NlcHRJbnZpdGF0aW9uKGNhbGwuY2FsbElkLCBwYXJ0aWNpcGFudCkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ291bGQgbm90IGpvaW4gY29uZmVyZW5jZSBjYWxsXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybjtcbiAgfVxuICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwodGFyZ2V0U291cmNlLCBjYWxsLmNhbGxJZCk7XG5cbiAgZm9yIChjb25zdCBwIG9mIGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsLmNhbGxJZCkpIHtcbiAgICBpZiAocC5zb3VyY2UgIT09IHRhcmdldFNvdXJjZSkge1xuICAgICAgY29uc3QgY2FsbHNzID0gY2FsbC5jYWxsSWQ7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnVwZGF0ZUNvbmZlcmVuY2VcIiwgcC5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgY2FsbHNzLFxuICAgICAgICBwYXJ0aWNpcGFudHM6IGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsLmNhbGxJZCksXG4gICAgICB9KSk7XG4gICAgICBlbWl0TmV0KCdwaG9uZTpjbGllbnQ6dXBEYXRlSW50ZXJGYWNlTmFtZScsIHAuc291cmNlKTtcbiAgICB9XG4gIH1cbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBub3RpSWQpO1xuICBcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDYWxsZXJJbnRlcmZhY2VcIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY2FsbElkLFxuICAgIHRhcmdldFNvdXJjZSxcbiAgICBzb3VyY2VOYW1lOiBzb3VyY2VOYW1lLFxuICAgIHRhcmdldE5hbWU6ICdDb25mZXJlbmNlIENhbGwnLFxuICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgIGRhdGFiYXNlVGFibGVJZCxcbiAgfSkpO1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnVwZGF0ZUNhbGxlckludGVyZmFjZVwiLCBjYWxsZXJTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBjYWxsSWQsXG4gICAgdGFyZ2V0U291cmNlLFxuICAgIHNvdXJjZU5hbWU6IHNvdXJjZU5hbWUsXG4gICAgdGFyZ2V0TmFtZTogXCJDb25mZXJlbmNlIENhbGxcIixcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQsXG4gIH0pKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogXCJwaG9uZVwiLFxuICAgIHRpdGxlOiBcIkNvbmZlcmVuY2UgQ2FsbCBBY2NlcHRlZFwiLFxuICAgIG1lc3NhZ2U6IGAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gaGFzIGFjY2VwdGVkIHRoZSBjb25mZXJlbmNlIGNhbGwgZnJvbSAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKX1gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2UsXG4gIH0pO1xufSk7XG5cbm9uTmV0KFwicGhvbmU6c2VydmVyOmVuZENhbGxcIiwgYXN5bmMgKGFyZ3M6IGFueSkgPT4ge1xuICBjb25zdCB7IGNhbGxJZCwgc291cmNlIH0gPSBKU09OLnBhcnNlKGFyZ3MpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKHNvdXJjZSk7XG4gIGlmIChjYWxsICYmIGNhbGwuY2FsbElkID09PSBjYWxsSWQpIHtcbiAgICBhd2FpdCBjYWxsTWFuYWdlci5yZW1vdmVQYXJ0aWNpcGFudChjYWxsSWQsIHNvdXJjZSk7XG4gICAgZm9yIChjb25zdCBwIG9mIGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpKSB7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnVwZGF0ZUNvbmZlcmVuY2VcIiwgcC5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgY2FsbElkOiBjYWxsSWQsXG4gICAgICAgIHBhcnRpY2lwYW50czogY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCksXG4gICAgICB9KSk7XG4gICAgfVxuICB9XG59KTtcblxub24oXCJvblJlc291cmNlU3RvcFwiLCBhc3luYyAocmVzb3VyY2U6IHN0cmluZykgPT4ge1xuICBpZiAocmVzb3VyY2UgPT09IEdldEN1cnJlbnRSZXNvdXJjZU5hbWUoKSkge1xuICAgIGZvciAoY29uc3QgY2FsbCBvZiBjYWxsTWFuYWdlci5nZXRBbGxDYWxscygpKSB7XG4gICAgICBmb3IgKGNvbnN0IHBhcnRpY2lwYW50IG9mIGNhbGwucGFydGljaXBhbnRzLnZhbHVlcygpKSB7XG4gICAgICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChwYXJ0aWNpcGFudC5zb3VyY2UsIDApO1xuICAgICAgfVxuICAgIH1cbiAgfVxufSk7XG5cbm9uTmV0KFwicGxheWVyRHJvcHBlZFwiLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICBpZiAoY2FsbCkge1xuICAgIGF3YWl0IGNhbGxNYW5hZ2VyLnJlbW92ZVBhcnRpY2lwYW50KGNhbGwuY2FsbElkLCBzb3VyY2UpO1xuICAgIGZvciAoY29uc3QgcCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpKSB7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnVwZGF0ZUNvbmZlcmVuY2VcIiwgcC5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgY2FsbElkOiBjYWxsLmNhbGxJZCxcbiAgICAgICAgcGFydGljaXBhbnRzOiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpLFxuICAgICAgfSkpO1xuICAgIH1cbiAgfVxufSk7XG4iLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjtcblxub25DbGllbnRDYWxsYmFjaygnc2F2ZVBob3RvVG9QaG90b3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCBkYXRhWCA9IHtcbiAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgIGNpdGl6ZW5JZCxcbiAgICBsaW5rOiBkYXRhLFxuICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5yZXBsYWNlKCdUJywgJyAnKS5yZXBsYWNlKCdaJywgJycpXG4gIH07XG4gIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9waG90b3MnLCBkYXRhWCk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9waG90b3MnLFxuICAgIHRpdGxlOiAnUGhvdG8gU2F2ZWQnLFxuICAgIG1lc3NhZ2U6IGBQaG90byBzYXZlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgJHtjaXRpemVuSWR9LCBMaW5rOiAke2RhdGF9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YVgpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldFBob3RvcycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCBwaG90b3MgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9waG90b3MnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHBob3Rvcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZGVsZXRlUGhvdG8nLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3Bob3RvcycsIHsgX2lkOiBkYXRhIH0pO1xuICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfcGhvdG9zJywgeyBfaWQ6IGRhdGEsIGNpdGl6ZW5JZCB9KTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX3Bob3RvcycsXG4gICAgdGl0bGU6ICdQaG90byBEZWxldGVkJyxcbiAgICBtZXNzYWdlOiBgUGhvdG8gZGVsZXRlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgJHtjaXRpemVuSWR9LCBMaW5rOiAke3Jlcy5saW5rfWAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbiAgcmV0dXJuIHRydWU7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjaywgdHJpZ2dlckNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIsIEZyYW1ld29yayB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCwgTE9HR0VSIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1JlZ2lzdGVyTmV3QnVzaW5lc3MnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7XG4gICAgICAgIG93bmVyQ2l0aXplbklkLFxuICAgICAgICBidXNpbmVzc05hbWUsXG4gICAgICAgIGJ1c2luZXNzRGVzY3JpcHRpb24sXG4gICAgICAgIGJ1c2luZXNzVHlwZSxcbiAgICAgICAgYnVzaW5lc3NMb2dvLFxuICAgICAgICBidXNpbmVzc1Bob25lTnVtYmVyLFxuICAgICAgICBidXNpbmVzc0FkZHJlc3MsXG4gICAgICAgIGdlbmVyYXRlQnVzaW5lc3NFbWFpbCxcbiAgICAgICAgY29vcmRzLFxuICAgICAgICBidXNpbmVzc0VtYWlsLFxuICAgICAgICBidXNpbmVzc1Bhc3N3b3JkLFxuICAgICAgICBqb2JcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgIGNvbnN0IGJ1c2luZXNzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lIH0pO1xuICAgIGlmIChidXNpbmVzcykge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICB0aXRsZTogJ0J1c2luZXNzIFJlZ2lzdHJhdGlvbiBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gcmVnaXN0ZXIgYnVzaW5lc3Mgd2l0aCBleGlzdGluZyBuYW1lICcke2J1c2luZXNzTmFtZX0nIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7YnVzaW5lc3NOYW1lfSBhbHJlYWR5IGV4aXN0cy5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgaWYgKGdlbmVyYXRlQnVzaW5lc3NFbWFpbCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWFpbCcsIHtcbiAgICAgICAgICAgIF9pZDogYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgICAgIGFjdGl2ZU1haWRJZDogYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgICAgIHVzZXJuYW1lOiBidXNpbmVzc0VtYWlsLFxuICAgICAgICAgICAgYWN0aXZlTWFpbFBhc3N3b3JkOiBidXNpbmVzc1Bhc3N3b3JkLFxuICAgICAgICAgICAgYXZhdGFyOiBidXNpbmVzc0xvZ28sXG4gICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgfSlcbiAgICB9XG5cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7XG4gICAgICAgIG93bmVyQ2l0aXplbklkLFxuICAgICAgICBidXNpbmVzc05hbWUsXG4gICAgICAgIGJ1c2luZXNzRGVzY3JpcHRpb24sXG4gICAgICAgIGJ1c2luZXNzVHlwZSxcbiAgICAgICAgYnVzaW5lc3NMb2dvLFxuICAgICAgICBidXNpbmVzc1Bob25lTnVtYmVyLFxuICAgICAgICBidXNpbmVzc0FkZHJlc3MsXG4gICAgICAgIGdlbmVyYXRlQnVzaW5lc3NFbWFpbCxcbiAgICAgICAgYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgY29vcmRzLFxuICAgICAgICBqb2JcbiAgICB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBSZWdpc3RlcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYE5ldyBidXNpbmVzcyAnJHtidXNpbmVzc05hbWV9JyByZWdpc3RlcmVkIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRCdXNpbmVzc0RhdGEnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZTogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoYnVzaW5lc3MpO1xufSk7XG5vbkNsaWVudENhbGxiYWNrKCdnZXRBbGxCdXNpbmVzc0RhdGEnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBidXNpbmVzc2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYnVzaW5lc3MnLCB7fSk7XG4gICAgbGV0IG9ubGluZUJ1c3MgPSBbXVxuICAgIGxldCBvZmZsaW5lQnVzcyA9IFtdXG4gICAgZm9yIChjb25zdCBidXNpbmVzcyBvZiBidXNpbmVzc2VzKSB7XG4gICAgICAgIGNvbnN0IGpvYkNvdW50ID0gR2xvYmFsU3RhdGVbYCR7YnVzaW5lc3Muam9ifTpjb3VudGBdXG4gICAgICAgIGlmIChqb2JDb3VudCkge1xuICAgICAgICAgICAgb25saW5lQnVzcy5wdXNoKGJ1c2luZXNzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9mZmxpbmVCdXNzLnB1c2goYnVzaW5lc3MpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IG9ubGluZTogb25saW5lQnVzcywgb2ZmbGluZTogb2ZmbGluZUJ1c3MgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0QnVzaW5lc3NOYW1lcycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBidXNpbmVzc2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYnVzaW5lc3MnLCB7fSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGJ1c2luZXNzZXMubWFwKChidXNpbmVzczogYW55KSA9PiBidXNpbmVzcy5idXNpbmVzc05hbWUpKTtcbn0pXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1VwZGF0ZUJ1c2luZXNzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgICBzZWxlY3RlZEJ1c2luZXNzLFxuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iLFxuICAgICAgICBidXNpbmVzc0VtYWlsXG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgYnVzaW5lc3MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IHNlbGVjdGVkQnVzaW5lc3MgfSk7XG4gICAgaWYgKCFidXNpbmVzcykge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICB0aXRsZTogJ0J1c2luZXNzIFVwZGF0ZSBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gdXBkYXRlIG5vbi1leGlzdGVudCBidXNpbmVzcyAnJHtzZWxlY3RlZEJ1c2luZXNzfScgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBCdXNpbmVzcyB3aXRoIG5hbWUgJHtidXNpbmVzc05hbWV9IGRvZXMgbm90IGV4aXN0LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG5cbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZTogc2VsZWN0ZWRCdXNpbmVzcyB9LCB7XG4gICAgICAgIG93bmVyQ2l0aXplbklkLFxuICAgICAgICBidXNpbmVzc05hbWUsXG4gICAgICAgIGJ1c2luZXNzRGVzY3JpcHRpb24sXG4gICAgICAgIGJ1c2luZXNzVHlwZSxcbiAgICAgICAgYnVzaW5lc3NMb2dvLFxuICAgICAgICBidXNpbmVzc1Bob25lTnVtYmVyLFxuICAgICAgICBidXNpbmVzc0FkZHJlc3MsXG4gICAgICAgIGdlbmVyYXRlQnVzaW5lc3NFbWFpbCxcbiAgICAgICAgY29vcmRzLFxuICAgICAgICBqb2IsXG4gICAgICAgIGJ1c2luZXNzRW1haWxcbiAgICB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEJ1c2luZXNzICcke3NlbGVjdGVkQnVzaW5lc3N9JyB1cGRhdGVkIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdkZWxldGVCdXNpbmVzcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGJ1c2luZXNzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBkYXRhIH0pO1xuICAgIGlmICghYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBEZWxldGlvbiBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gZGVsZXRlIG5vbi1leGlzdGVudCBidXNpbmVzcyAnJHtkYXRhfScgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBCdXNpbmVzcyB3aXRoIG5hbWUgJHtkYXRhfSBkb2VzIG5vdCBleGlzdC5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IGRhdGEgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBCdXNpbmVzcyAnJHtkYXRhfScgZGVsZXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjp0b2dnbGVKb2JDYWxscycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpOztcbiAgICBjb25zdCBQbGF5ZXJEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSk7XG4gICAgaWYgKCFQbGF5ZXJEYXRhKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIsIGpvYkNhbGxzOiB0cnVlIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSwgeyBqb2JDYWxsczogIVBsYXllckRhdGEuam9iQ2FsbHMgfSk7XG4gICAgcmV0dXJuICFQbGF5ZXJEYXRhLmpvYkNhbGxzO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0Sm9iQ2FsbHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBQbGF5ZXJEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSk7XG4gICAgaWYgKCFQbGF5ZXJEYXRhKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIsIGpvYkNhbGxzOiB0cnVlIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuICAgIHJldHVybiBQbGF5ZXJEYXRhLmpvYkNhbGxzO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6YnVzaW5lc3NDYWxsJywgYXN5bmMgKGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IG51bWJlciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBjaXRpemVuaWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKG51bWJlcik7XG4gICAgY29uc3QgcGVyc29uYWxOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNsaWVudCk7XG4gICAgaWYgKFN0cmluZyhwZXJzb25hbE51bWJlcikgPT09IFN0cmluZyhudW1iZXIpKSB7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgQ2FuJ3QgY2FsbCB5b3Vyc2VsZiAke3BlcnNvbmFsTnVtYmVyfS5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGlmICghY2l0aXplbmlkKSB7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBUaGlzIG51bWJlciBpcyBub3QgcmVnaXN0ZXJlZC5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGNvbnN0IFBsYXllckRhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzX3VzZXJzJywgeyBjaXRpemVuaWQ6IGNpdGl6ZW5pZCB9KTtcbiAgICBpZiAoUGxheWVyRGF0YSAmJiAhUGxheWVyRGF0YS5qb2JDYWxscykge1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgVGhpcyBwZXJzb24gaGFzIGRpc2FibGVkIGpvYiBjYWxscy5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfSBlbHNlIGlmIChQbGF5ZXJEYXRhICYmIFBsYXllckRhdGEuam9iQ2FsbHMpIHtcbiAgICAgICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6Y2xpZW50OmJ1c2luZXNzQ2FsbCcsIGNsaWVudCwgbnVtYmVyKTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpnZXRCYW5rYmFsYW5jZScsIGFzeW5jIChjbGllbnQsIGFjY291bnQpID0+IHtcbiAgICBjb25zdCBiYWxhbmNlID0gYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uZ2V0QWNjb3VudE1vbmV5KGFjY291bnQpO1xuICAgIHJldHVybiBiYWxhbmNlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6ZGVwb3NpdE1vbmV5JywgYXN5bmMgKGNsaWVudCwgYW1vdW50OiBudW1iZXIpID0+IHtcbiAgICBcbiAgICBjb25zdCBzcmMgPSBjbGllbnQ7XG4gICAgY29uc3QgUGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzcmMpO1xuICAgIGNvbnN0IGZ1bGxuYW1lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc3JjKTtcbiAgICBjb25zdCBjaWQgPSBQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQ7XG4gICAgY29uc3QgUGxheWVySm9iID0gUGxheWVyLlBsYXllckRhdGEuam9iO1xuICAgIGNvbnN0IGFjY291bnQgPSBQbGF5ZXJKb2IubmFtZTtcbiAgICBjb25zdCBiYW5rYmFsYW5jZSA9IGF3YWl0IFBsYXllci5QbGF5ZXJEYXRhLm1vbmV5LmJhbms7XG4gICAgaWYgKGJhbmtiYWxhbmNlIDwgYW1vdW50KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYXdhaXQgUGxheWVyLkZ1bmN0aW9ucy5SZW1vdmVNb25leSgnYmFuaycsIGFtb3VudCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgRGVwb3NpdC5cIik7XG4gICAgYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uYWRkQWNjb3VudE1vbmV5KGFjY291bnQsIGFtb3VudCk7XG4gICAgYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oY2lkLCBcIlBob25lIEJ1c2luZXNzIEFwcCBXaXRoZHJhd1wiLCBhbW91bnQsIGBTZW50IGZ1bmRzIHRvICR7UGxheWVySm9iLmxhYmVsfWAsIGFjY291bnQsIGZ1bGxuYW1lLCBcIndpdGhkcmF3XCIsIGdlbmVyYXRlVVVpZCgpKVxuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGFjY291bnQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIERlcG9zaXRcIiwgYW1vdW50LCBcIkRlcG9zaXRcIiwgZnVsbG5hbWUsIGFjY291bnQsIFwiZGVwb3NpdFwiLCBnZW5lcmF0ZVVVaWQoKSlcblxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICB0aXRsZTogJ01vbmV5IERlcG9zaXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQbGF5ZXIgJHtmdWxsbmFtZX0gZGVwb3NpdGVkICQke2Ftb3VudH0gdG8gYWNjb3VudCAke2FjY291bnR9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOndpdGhkcmF3TW9uZXknLCBhc3luYyAoY2xpZW50LCBhbW91bnQ6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHNyYyA9IGNsaWVudDtcbiAgICBjb25zdCBQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHNyYyk7XG4gICAgY29uc3QgZnVsbG5hbWUgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzcmMpO1xuICAgIGNvbnN0IGNpZCA9IFBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZDtcbiAgICBjb25zdCBQbGF5ZXJKb2IgPSBQbGF5ZXIuUGxheWVyRGF0YS5qb2I7XG4gICAgY29uc3QgYWNjb3VudCA9IFBsYXllckpvYi5uYW1lO1xuICAgIGNvbnN0IGJhbGFuY2UgPSBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5nZXRBY2NvdW50TW9uZXkoYWNjb3VudCk7XG4gICAgaWYgKGJhbGFuY2UgPCBhbW91bnQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBhd2FpdCBQbGF5ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KCdiYW5rJywgYW1vdW50LCBcIlBob25lIEJ1c2luZXNzIEFwcCBXaXRoZHJhdy5cIik7XG4gICAgYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10ucmVtb3ZlQWNjb3VudE1vbmV5KGFjY291bnQsIGFtb3VudCk7XG4gICAgYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oY2lkLCBcIlBob25lIEJ1c2luZXNzIEFwcCBXaXRoZHJhd1wiLCBhbW91bnQsIGBSZWNpZXZlZCBmdW5kcyBmcm9tICR7UGxheWVySm9iLmxhYmVsfWAsIGFjY291bnQsIGZ1bGxuYW1lLCBcImRlcG9zaXRcIiwgZ2VuZXJhdGVVVWlkKCkpXG4gICAgYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oYWNjb3VudCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgV2l0aGRyYXdcIiwgYW1vdW50LCBcIldpdGhkcmF3XCIsIGFjY291bnQsIGZ1bGxuYW1lLCBcIndpdGhkcmF3XCIsIGdlbmVyYXRlVVVpZCgpKVxuXG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnTW9uZXkgV2l0aGRyYXduJyxcbiAgICAgICAgbWVzc2FnZTogYFBsYXllciAke2Z1bGxuYW1lfSB3aXRoZHJldyAkJHthbW91bnR9IGZyb20gYWNjb3VudCAke2FjY291bnR9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmdldEVtcGxveWVlcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNyYyA9IGNsaWVudDtcbiAgICBjb25zdCBqb2JuYW1lID0gZGF0YTtcbiAgICBjb25zdCBQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHNyYyk7XG4gICAgY29uc3QgaXNCb3NzID0gUGxheWVyLlBsYXllckRhdGEuam9iLmlzYm9zcztcbiAgICAvKiAgICAgXG4gICAgICAgIGlmICghaXNCb3NzKSB7XG4gICAgICAgICAgICByZXR1cm4gZXhwb3J0c1sncHMtYWRtaW5tZW51J10uQmFuUGxheWVyKHNyYywgJ0dldEVtcGxveWVlcyBFeHBsb2l0aW5nICcsICdzdW1taXRfcGhvbmUnKTtcbiAgICAgICAgfVxuICAgICovXG4gICAgY29uc3QgcGxheWVyczogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCBjaXRpemVuaWQsIGNoYXJpbmZvLCBqb2IgRlJPTSBwbGF5ZXJzIFdIRVJFIGpvYiBMSUtFID8nLCBbYCUke2pvYm5hbWV9JWBdKTtcbiAgICBjb25zdCBlbXBsb3llZXM6IGFueSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCBkYXRhIG9mIHBsYXllcnMpIHtcbiAgICAgICAgbGV0IGNoYXJEYXRhID0geyBmaXJzdG5hbWU6ICdVbmtub3duJywgbGFzdG5hbWU6ICdQbGF5ZXInIH07XG4gICAgICAgIGxldCBqb2JEYXRhID0geyBuYW1lOiAnVW5rbm93bicsIGdyYWRlOiAwLCBpc2Jvc3M6IGZhbHNlIH07XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChkYXRhLmNoYXJpbmZvKSBjaGFyRGF0YSA9IEpTT04ucGFyc2UoZGF0YS5jaGFyaW5mbyk7XG4gICAgICAgICAgICBpZiAoZGF0YS5qb2IpIGpvYkRhdGEgPSBKU09OLnBhcnNlKGRhdGEuam9iKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgTE9HR0VSKGBGYWlsZWQgdG8gcGFyc2UgSm9iICR7am9ibmFtZX0gLyBjaGFyaW5mbyBmb3IgJCAke2RhdGEuY2l0aXplbmlkfWApO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc09ubGluZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChkYXRhLmNpdGl6ZW5pZCk7XG4gICAgICAgIGlmIChpc09ubGluZSAmJiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5uYW1lID09PSBqb2JuYW1lKSB7XG4gICAgICAgICAgICBlbXBsb3llZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgZW1wU291cmNlOiBpc09ubGluZS5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgICAgICBjdXJKb2I6IGlzT25saW5lLlBsYXllckRhdGEuam9iLm5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGU6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmdyYWRlLFxuICAgICAgICAgICAgICAgIGlzYm9zczogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IuaXNib3NzLFxuICAgICAgICAgICAgICAgIG5hbWU6IGAke2lzT25saW5lLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke2lzT25saW5lLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdvbmxpbmUnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVtcGxveWVlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICBlbXBTb3VyY2U6IGRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgICAgIGN1ckpvYjogam9iRGF0YS5uYW1lLFxuICAgICAgICAgICAgICAgIGdyYWRlOiBqb2JEYXRhLmdyYWRlLFxuICAgICAgICAgICAgICAgIGlzYm9zczogam9iRGF0YS5pc2Jvc3MsXG4gICAgICAgICAgICAgICAgbmFtZTogYCR7Y2hhckRhdGEuZmlyc3RuYW1lfSAke2NoYXJEYXRhLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnb2ZmbGluZSdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGVtcGxveWVlcy5zb3J0KChhOiBhbnksIGI6IGFueSkgPT4gKGIuZ3JhZGUubGV2ZWwgfHwgMCkgLSAoYS5ncmFkZS5sZXZlbCB8fCAwKSk7XG5cbiAgICBjb25zdCBtdWx0aWpvYkVtcGxveWVlczogYW55W10gPSBbXTtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBtdWx0aUpvYlBsYXllcnM6IGFueVtdID0gKGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX211bHRpam9icycsIHsgam9iTmFtZTogam9ibmFtZSB9KSkgfHwgW107XG5cbiAgICAgICAgZm9yIChjb25zdCBtdWx0aUpvYiBvZiBtdWx0aUpvYlBsYXllcnMpIHtcbiAgICAgICAgICAgIGlmICghbXVsdGlKb2IuY2l0aXplbklkKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdTa2lwcGluZyBpbnZhbGlkIG11bHRpam9iIGVudHJ5OicsIG11bHRpSm9iKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgaXNPbmxpbmUgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQobXVsdGlKb2IuY2l0aXplbklkKTtcbiAgICAgICAgICAgIGlmICghaXNPbmxpbmUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwbGF5ZXJEYXRhOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIGNoYXJpbmZvLCBqb2IgRlJPTSBwbGF5ZXJzIFdIRVJFIGNpdGl6ZW5pZCA9ID8nLCBbbXVsdGlKb2IuY2l0aXplbklkXSk7XG4gICAgICAgICAgICAgICAgaWYgKCFwbGF5ZXJEYXRhIHx8IHBsYXllckRhdGEubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gcGxheWVyIGRhdGEgZm91bmQgZm9yIG9mZmxpbmUgY2l0aXplbklkICR7bXVsdGlKb2IuY2l0aXplbklkfWApO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGRhdGEgb2YgcGxheWVyRGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgam9iRGF0YSwgY2hhckRhdGE7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBqb2JEYXRhID0gZGF0YS5qb2IgPyBKU09OLnBhcnNlKGRhdGEuam9iKSA6IHsgbmFtZTogJ1Vua25vd24nLCBncmFkZTogMCwgaXNib3NzOiBmYWxzZSB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhckRhdGEgPSBkYXRhLmNoYXJpbmZvID8gSlNPTi5wYXJzZShkYXRhLmNoYXJpbmZvKSA6IHsgZmlyc3RuYW1lOiAnVW5rbm93bicsIGxhc3RuYW1lOiAnUGxheWVyJyB9O1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gcGFyc2Ugam9iL2NoYXJpbmZvIGZvciAke211bHRpSm9iLmNpdGl6ZW5JZH06YCwgZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoam9iRGF0YS5uYW1lID09PSBqb2JuYW1lKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgbXVsdGlqb2JFbXBsb3llZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbXBTb3VyY2U6IG11bHRpSm9iLmNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1ckpvYjogam9iRGF0YS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZ3JhZGU6IGpvYkRhdGEuZ3JhZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpc2Jvc3M6IGpvYkRhdGEuaXNib3NzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogYCR7Y2hhckRhdGEuZmlyc3RuYW1lfSAke2NoYXJEYXRhLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICdvZmZsaW5lJ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5uYW1lID09PSBqb2JuYW1lKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBtdWx0aWpvYkVtcGxveWVlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgZW1wU291cmNlOiBpc09ubGluZS5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgICAgICAgICAgY3VySm9iOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBncmFkZTogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IuZ3JhZGUsXG4gICAgICAgICAgICAgICAgICAgIGlzYm9zczogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IuaXNib3NzLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBgJHtpc09ubGluZS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtpc09ubGluZS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ29ubGluZSdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBtdWx0aWpvYkVtcGxveWVlcy5zb3J0KChhLCBiKSA9PiAoYi5ncmFkZSB8fCAwKSAtIChhLmdyYWRlIHx8IDApKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgcHJvY2Vzc2luZyBtdWx0aWpvYiBlbXBsb3llZXM6JywgZXJyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBlbXBsb3llZXM6IGVtcGxveWVlcy5sZW5ndGggPiAwID8gZW1wbG95ZWVzIDogW10sXG4gICAgICAgIG11bHRpam9iRW1wbG95ZWVzOiBtdWx0aWpvYkVtcGxveWVlcy5sZW5ndGggPiAwID8gbXVsdGlqb2JFbXBsb3llZXMgOiBbXVxuICAgIH0pO1xufSk7XG5cblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpoaXJlRW1wbG95ZWUnLCBhc3luYyAoY2xpZW50LCB0YXJnZXRTb3VyY2U6IHN0cmluZywgam9ibmFtZTogc3RyaW5nKSA9PiB7XG4gICAgaWYgKFN0cmluZyhjbGllbnQpID09PSBTdHJpbmcodGFyZ2V0U291cmNlKSkge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICB0aXRsZTogJ0hpcmUgRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGhpcmUgc2VsZiBOYW1lOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9LCBpbiBKb2I6ICR7am9ibmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBjYW4ndCBoaXJlIHlvdXJzZWxmLmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgaWYgKGF3YWl0IERvZXNQbGF5ZXJFeGlzdCh0YXJnZXRTb3VyY2UpKSB7XG4gICAgICAgIGNvbnN0IHBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoY2xpZW50KTtcbiAgICAgICAgaWYgKCFwbGF5ZXIuUGxheWVyRGF0YS5qb2IuaXNib3NzKSB7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnSGlyZSBGYWlsZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGhpcmUgd2l0aG91dCBiZWluZyBhIGJvc3MgTmFtZTogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSwgaW4gSm9iOiAke2pvYm5hbWV9LCBDaXRpemVuSWQ6ICR7cGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGFyZSBub3QgYSBib3NzLmAsXG4gICAgICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHRhcmdldFNvdXJjZSk7XG4gICAgICAgIHRhcmdldFBsYXllci5GdW5jdGlvbnMuU2V0Sm9iKGpvYm5hbWUsIDApO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgICAgICB0aXRsZTogJ0VtcGxveWVlIEhpcmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBQbGF5ZXIgJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWR9IE5hbWU6ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoaXJlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0sIGluIEpvYjogJHtqb2JuYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBoaXJlZCAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gdG8gJHtqb2JuYW1lfS5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGJlZW4gaGlyZWQgdG8gJHtqb2JuYW1lfS5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXQoJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6aGlyZWluTXVsdGlKb2InLCB0YXJnZXRTb3VyY2UsIGpvYm5hbWUsIDAsIEZyYW1ld29yay5TaGFyZWQuSm9ic1tqb2JuYW1lXS5sYWJlbCwgRnJhbWV3b3JrLlNoYXJlZC5Kb2JzW2pvYm5hbWVdLmdyYWRlc1snMCddLmxhYmVsKTtcbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIGNsaWVudCwgam9ibmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdIaXJlIEZhaWxlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQXR0ZW1wdCB0byBoaXJlIG5vbi1leGlzdGVudCBwbGF5ZXIgTmFtZTogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSwgaW4gSm9iOiAke2pvYm5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFBsYXllciBpcyBub3Qgb25saW5lLmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0SW5kZXhPZkFsbEpvYnMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3Qgam9icyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3N1bW1pdF9qb2JzJywge30pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShqb2JzLm1hcCgoam9iOiBhbnkpID0+IGpvYi5faWQpKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdyZWdpc3RlckpvYnMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBqb2JzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgnc3VtbWl0X2pvYnMnLCBqb2JzKTtcbiAgICBjb25zdCB7IF9pZCwgLi4ucmVzdCB9ID0gam9icztcbiAgICBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uQWRkSm9iKF9pZCwgcmVzdCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9qb2JzJyxcbiAgICAgICAgdGl0bGU6ICdKb2IgUmVnaXN0ZXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBOZXcgam9iICcke19pZH0nIE5hbWU6ICR7am9icy5qb2JOYW1lfSByZWdpc3RlcmVkIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRKb2JEYXRhJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgam9iID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdzdW1taXRfam9icycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShqb2IpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3VwZGF0ZUpvYnMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBqb2JzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnc3VtbWl0X2pvYnMnLCB7IF9pZDogam9icy5faWQgfSwgam9icyk7XG4gICAgY29uc3QgeyBfaWQsIC4uLnJlc3QgfSA9IGpvYnM7XG4gICAgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLlVwZGF0ZUpvYihfaWQsIHJlc3QpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfam9icycsXG4gICAgICAgIHRpdGxlOiAnSm9iIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgSm9iICcke19pZH0nIE5hbWU6ICR7am9icy5qb2JOYW1lfSB1cGRhdGVkIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdkZWxldGVKb2JzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgam9iID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdzdW1taXRfam9icycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIGlmICgham9iKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3N1bW1pdF9qb2JzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSm9iIERlbGV0aW9uIEZhaWxlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQXR0ZW1wdCB0byBkZWxldGUgbm9uLWV4aXN0ZW50IGpvYiAnJHtkYXRhfScgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBKb2IgZG9lcyBub3QgZXhpc3QuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgnc3VtbWl0X2pvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uUmVtb3ZlSm9iKGRhdGEpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfam9icycsXG4gICAgICAgIHRpdGxlOiAnSm9iIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgSm9iICcke2RhdGF9JyBOYW1lOiAke2pvYi5qb2JOYW1lfSBkZWxldGVkIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmdldEJ1c2luZXNzRW1wbG95ZWVzTnVtYmVycycsIGFzeW5jIChjbGllbnQ6IG51bWJlciwgam9iOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBbcGxheWVyc10gPSBhd2FpdCBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcnNPbkR1dHkoam9iKTtcbiAgICBsZXQgbnVtYmVyczogbnVtYmVyW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IHBsYXllciBvZiBwbGF5ZXJzKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UocGxheWVyKTtcbiAgICAgICAgbnVtYmVycy5wdXNoKE51bWJlcihudW1iZXIpKTtcbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG51bWJlcnMpO1xufSkiLCAiaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBGcmFtZXdvcmssIE1vbmdvREIsIExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbk5ldCgnc3VtbWl0X3Bob25lOnNlcnZlcjpmaXJlRW1wbG95ZWUnLCBhc3luYyAoY2l0aXplbklkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzb3VyY2UgPSBnbG9iYWwuc291cmNlO1xuICAgIGNvbnN0IHRhcmdldERhdGEgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICBpZiAodGFyZ2V0RGF0YSkge1xuICAgICAgICBjb25zdCBqb2JuYW1lID0gdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmpvYi5uYW1lO1xuICAgICAgICBhd2FpdCB0YXJnZXREYXRhLkZ1bmN0aW9ucy5TZXRKb2IoJ3VuZW1wbG95ZWQnLCAwKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIGpvYk5hbWU6IGpvYm5hbWUgfSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGZpcmVkICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYmVlbiBmaXJlZCBieSAke2dsb2JhbC5zb3VyY2V9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JuYW1lKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZW1wbG95ZWVfYWN0aW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnRW1wbG95ZWUgRmlyZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhhcyBiZWVuIGZpcmVkIGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBDaXRpemVuSWQ6ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH0gfCBKb2I6ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmpvYi5uYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHBsYXllckRhdGE6IGFueSA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1Qgam9iIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/IExJTUlUIDEnLCBbY2l0aXplbklkXSk7XG4gICAgICAgIGNvbnN0IGpvYkRhdGEgPSBKU09OLnBhcnNlKHBsYXllckRhdGFbMF0uam9iKTtcblxuICAgICAgICBsZXQgam9iOiBhbnkgPSB7fTtcbiAgICAgICAgam9iLm5hbWUgPSAndW5lbXBsb3llZCdcbiAgICAgICAgam9iLmxhYmVsID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10ubGFiZWxcbiAgICAgICAgam9iLnBheW1lbnQgPSBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbJ3VuZW1wbG95ZWQnXS5ncmFkZXNbJzAnXS5wYXltZW50XG4gICAgICAgIGpvYi5vbmR1dHkgPSBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbJ3VuZW1wbG95ZWQnXS5kZWZhdWx0RHV0eVxuICAgICAgICBqb2IuaXNib3NzID0gZmFsc2VcbiAgICAgICAgam9iLmdyYWRlID0ge31cbiAgICAgICAgam9iLmdyYWRlLm5hbWUgPSBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbJ3VuZW1wbG95ZWQnXS5ncmFkZXNbJzAnXS5uYW1lXG4gICAgICAgIGpvYi5ncmFkZS5sZXZlbCA9IDBcbiAgICAgICAgYXdhaXQgVXRpbHMucXVlcnkoJ1VQREFURSBwbGF5ZXJzIFNFVCBqb2IgPSA/IFdIRVJFIGNpdGl6ZW5pZCA9ID8nLCBbSlNPTi5zdHJpbmdpZnkoam9iKSwgY2l0aXplbklkXSk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogY2l0aXplbklkLCBqb2JOYW1lOiBqb2JEYXRhLm5hbWUgfSk7XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBzb3VyY2UsIGpvYkRhdGEubmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2VtcGxveWVlX2FjdGlvbicsXG4gICAgICAgICAgICB0aXRsZTogJ09mZmxpbmUgRW1wbG95ZWUgRmlyZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYE9mZmxpbmUgZW1wbG95ZWUgJHtjaXRpemVuSWR9IGhhcyBiZWVuIGZpcmVkIGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBKb2I6ICR7am9iRGF0YS5uYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbn0pO1xuXG5vbk5ldCgnc3VtbWl0X3Bob25lOnNlcnZlcjpjaGFuZ2VSYW5rT2ZQbGF5ZXInLCBhc3luYyAoZGF0YTogYW55KSA9PiB7XG4gICAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBjb25zdCB0YXJnZXREYXRhID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGRhdGEudGFyZ2V0Q2l0aXplbmlkKTtcbiAgICBjb25zdCBtdWx0aUpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUgfSk7XG4gICAgaWYgKHRhcmdldERhdGEpIHtcbiAgICAgICAgY29uc3Qgam9ibmFtZSA9IGRhdGEuam9iTmFtZTtcbiAgICAgICAgdGFyZ2V0RGF0YS5GdW5jdGlvbnMuU2V0Sm9iKGpvYm5hbWUsIGRhdGEua2V5KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgY2hhbmdlZCB0aGUgcmFuayBvZiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdXIgcmFuayBoYXMgYmVlbiBjaGFuZ2VkIGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX1gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGlmIChtdWx0aUpvYikge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBkYXRhLnRhcmdldENpdGl6ZW5pZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lIH0sIHsgZ3JhZGVMZXZlbDogZGF0YS5rZXksIGdyYWRlTGFiZWw6IGRhdGEuZ3JhZGVOYW1lIH0pO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgVXBkYXRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7ZGF0YS50YXJnZXRDaXRpemVuaWR9IGhhcyBiZWVuIHVwZGF0ZWQgdG8gJHtkYXRhLmpvYk5hbWV9IHwgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9IGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBjaXRpemVuSWQ6ICR7YXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKX1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX211bHRpam9icycsIHsgX2lkOiBnZW5lcmF0ZVVVaWQoKSwgY2l0aXplbklkOiBkYXRhLnRhcmdldENpdGl6ZW5pZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lLCBncmFkZUxldmVsOiBkYXRhLmtleSwgZ3JhZGVMYWJlbDogZGF0YS5ncmFkZU5hbWUgfSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlfam9iJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBBZGRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7ZGF0YS50YXJnZXRDaXRpemVuaWR9IGhhcyBiZWVuIGFkZGVkIHRvICR7ZGF0YS5qb2JOYW1lfSB8IE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgY2l0aXplbklkOiAke2F3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JuYW1lKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZW1wbG95ZWVfYWN0aW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUmFuayBDaGFuZ2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgYmVlbiBnaXZlbiBhIG5ldyByYW5rIGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBDaXRpemVuSWQ6ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH0gfCBKb2I6ICR7am9ibmFtZX0gfCAgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcGxheWVyRGF0YTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCBqb2IgRlJPTSBwbGF5ZXJzIFdIRVJFIGNpdGl6ZW5pZCA9ID8gTElNSVQgMScsIFtkYXRhLnRhcmdldENpdGl6ZW5pZF0pO1xuICAgICAgICBjb25zdCBqb2JEYXRhID0gSlNPTi5wYXJzZShwbGF5ZXJEYXRhWzBdLmpvYik7XG4gICAgICAgIGpvYkRhdGEuZ3JhZGUubGV2ZWwgPSBkYXRhLmtleTtcbiAgICAgICAgam9iRGF0YS5ncmFkZS5uYW1lID0gZGF0YS5ncmFkZU5hbWU7XG4gICAgICAgIGF3YWl0IFV0aWxzLnF1ZXJ5KCdVUERBVEUgcGxheWVycyBTRVQgam9iID0gPyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW0pTT04uc3RyaW5naWZ5KGpvYkRhdGEpLCBkYXRhLnRhcmdldENpdGl6ZW5pZF0pO1xuICAgICAgICBpZiAobXVsdGlKb2IpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSB9LCB7IGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIFVwZGF0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiB1cGRhdGVkIHRvICR7ZGF0YS5qb2JOYW1lfSB8IE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgY2l0aXplbklkOiAke2F3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZ2VuZXJhdGVVVWlkKCksIGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSwgZ3JhZGVMZXZlbDogZGF0YS5rZXksIGdyYWRlTGFiZWw6IGRhdGEuZ3JhZGVOYW1lIH0pO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgQWRkZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiBhZGRlZCB0byAke2RhdGEuam9iTmFtZX0gfCBOZXcgUmFuazogJHtkYXRhLmdyYWRlTmFtZX0gYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IGNpdGl6ZW5JZDogJHthd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgam9iRGF0YS5uYW1lKTtcbiAgICB9XG59KTtcblxub25OZXQoJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6ZmlyZUluYWN0aXZlRW1wbG95ZWUnLCBhc3luYyAoZGF0YTogeyBqb2JOYW1lOiBzdHJpbmcsIGNpdGl6ZW5JZDogc3RyaW5nIH0pID0+IHtcbiAgICBjb25zdCBzb3VyY2UgPSBnbG9iYWwuc291cmNlO1xuICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogZGF0YS5jaXRpemVuSWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSB9KTtcbiAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBmaXJlZCBhbiBpbmFjdGl2ZSBlbXBsb3llZWAsXG4gICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgIH0pKTtcbiAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBkYXRhLmpvYk5hbWUpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZW1wbG95ZWVfYWN0aW9uJyxcbiAgICAgICAgdGl0bGU6ICdJbmFjdGl2ZSBFbXBsb3llZSBGaXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBJbmFjdGl2ZSBlbXBsb3llZSAke2RhdGEuY2l0aXplbklkfSBoYXMgYmVlbiBmaXJlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgSm9iOiAke2RhdGEuam9iTmFtZX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub24oJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6aGlyZWluTXVsdGlKb2InLCBhc3luYyAoY2xpZW50OiBudW1iZXIsIGpvYm5hbWU6IHN0cmluZywgZ3JhZGVMZXZlbDogbnVtYmVyLCBqb2JMYWJlbDogc3RyaW5nLCBncmFkZUxhYmVsOiBzdHJpbmcpID0+IHtcbiAgICAvKiBjb25zb2xlLmxvZygnSGlyaW5nIGluIG11bHRpIGpvYjonLCBqb2JuYW1lLCBncmFkZUxldmVsLCBqb2JMYWJlbCwgZ3JhZGVMYWJlbCk7ICovXG4gICAgY29uc3QgdGFyZ2V0Q2lkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBtdWx0aUpvYkNoZWNrID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogdGFyZ2V0Q2lkLCBqb2JOYW1lOiBqb2JuYW1lIH0pO1xuICAgIGlmIChtdWx0aUpvYkNoZWNrKSB7XG4gICAgICAgIGlmIChtdWx0aUpvYkNoZWNrLmdyYWRlTGV2ZWwgIT09IGdyYWRlTGV2ZWwpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogdGFyZ2V0Q2lkLCBqb2JOYW1lOiBqb2JuYW1lIH0sIHsgZ3JhZGVMZXZlbCwgZ3JhZGVMYWJlbCB9KTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGJlZW4gaGlyZWQgaW4gYSBuZXcgcmFuazogJHtncmFkZUxhYmVsfWAsXG4gICAgICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBjbGllbnQsIGpvYm5hbWUpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgVXBkYXRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYCR7dGFyZ2V0Q2lkfSBoYXMgYmVlbiB1cGRhdGVkIHRvICR7am9ibmFtZX0gfCBOZXcgUmFuazogJHtncmFkZUxhYmVsfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IHwgY2l0aXplbklkOiAke2F3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBlbWl0TmV0KCdRQkNvcmU6Tm90aWZ5JywgY2xpZW50LCAnWW91IGFyZSBhbHJlYWR5IGluIHRoaXMgam9iIHdpdGggdGhpcyBncmFkZSBsZXZlbCcsICdlcnJvcicpO1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX211bHRpam9icycsIHsgX2lkOiBnZW5lcmF0ZVVVaWQoKSwgY2l0aXplbklkOiB0YXJnZXRDaWQsIGpvYk5hbWU6IGpvYm5hbWUsICBncmFkZUxldmVsOiBncmFkZUxldmVsLCBqb2JMYWJlbDogam9iTGFiZWwsIGdyYWRlTGFiZWw6IGdyYWRlTGFiZWwgfSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGJlZW4gaGlyZWQgaW4gYSBuZXcgam9iOiAke2pvYkxhYmVsfSBhcyAke2dyYWRlTGFiZWx9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgY2xpZW50LCBqb2JuYW1lKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlfam9iJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIEFkZGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldENpZH0gaGFzIGJlZW4gYWRkZWQgdG8gJHtqb2JuYW1lfSB8IE5ldyBSYW5rOiAke2dyYWRlTGFiZWx9IGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0gfCBjaXRpemVuSWQ6ICR7YXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG59KVxuXG5zZXRJbW1lZGlhdGUoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGpvYkFycmF5OiBhbnkgPSB7fTtcbiAgICBjb25zdCBqb2JEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnc3VtbWl0X2pvYnMnLCB7fSk7XG4gICAgam9iRGF0YS5mb3JFYWNoKGFzeW5jIChqb2I6IGFueSkgPT4ge1xuICAgICAgICBjb25zdCB7IF9pZCwgLi4ucmVzdCB9ID0gam9iO1xuICAgICAgICBMT0dHRVIoYFtTVU1NSVRfUEhPTkVdIENyZWF0ZWQgam9iICR7X2lkfSBTdWNjZXNzZnVsbHlgKTtcbiAgICAgICAgam9iQXJyYXlbX2lkXSA9IHJlc3Q7XG4gICAgfSk7XG4gICAgLyogY29uc3QgW3VwZGF0ZWQsIG1lc3NhZ2VdID0gZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkFkZEpvYnMoam9iQXJyYXkpOyAqL1xufSk7ICIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgUGhvbmVNYWlsLCBQaG9uZVBsYXllckNhcmQgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IFNldHRpbmdzIH0gZnJvbSBcIi4vY2xhc3NcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcblxub25DbGllbnRDYWxsYmFjaygnR2V0Q2xpZW50U2V0dGluZ3MnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBhd2FpdCBTZXR0aW5ncy5lbnN1cmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIF9pZDogU2V0dGluZ3MuX2lkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBiYWNrZ3JvdW5kOiBTZXR0aW5ncy5iYWNrZ3JvdW5kLmdldChjaXRpemVuSWQpLFxuICAgICAgICBsb2Nrc2NyZWVuOiBTZXR0aW5ncy5sb2Nrc2NyZWVuLmdldChjaXRpemVuSWQpLFxuICAgICAgICByaW5ndG9uZTogU2V0dGluZ3MucmluZ3RvbmUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiBTZXR0aW5ncy5zaG93U3RhcnR1cFNjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgc2hvd05vdGlmaWNhdGlvbnM6IFNldHRpbmdzLnNob3dOb3RpZmljYXRpb25zLmdldChjaXRpemVuSWQpLFxuICAgICAgICBpc0xvY2s6IFNldHRpbmdzLmlzTG9jay5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgbG9ja1BpbjogU2V0dGluZ3MubG9ja1Bpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgdXNlUGluOiBTZXR0aW5ncy51c2VQaW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHVzZUZhY2VJZDogU2V0dGluZ3MudXNlRmFjZUlkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiBTZXR0aW5ncy5mYWNlSWRJZGVudGlmaWVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICBzbXJ0SWQ6IFNldHRpbmdzLnNtcnRJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiBTZXR0aW5ncy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHNtcnRQYXNzd29yZDogU2V0dGluZ3Muc21ydFBhc3N3b3JkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBpc0ZsaWdodE1vZGU6IFNldHRpbmdzLmlzRmxpZ2h0TW9kZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgcGhvbmVOdW1iZXI6IFNldHRpbmdzLnBob25lTnVtYmVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICBwaWdlb25JZEF0dGFjaGVkOiBTZXR0aW5ncy5waWdlb25JZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1NldENsaWVudFNldHRpbmdzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBhd2FpdCBTZXR0aW5ncy5lbnN1cmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgYmFja2dyb3VuZDogeyBjdXJyZW50OiBzdHJpbmc7IHdhbGxwYXBlcnM6IHN0cmluZ1tdIH07XG4gICAgICAgIGxvY2tzY3JlZW46IHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9O1xuICAgICAgICByaW5ndG9uZTogeyBjdXJyZW50OiBzdHJpbmc7IHJpbmd0b25lczogeyBuYW1lOiBzdHJpbmcsIHVybDogc3RyaW5nIH1bXSB9O1xuICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogYm9vbGVhbjtcbiAgICAgICAgc2hvd05vdGlmaWNhdGlvbnM6IGJvb2xlYW47XG4gICAgICAgIGlzTG9jazogYm9vbGVhbjtcbiAgICAgICAgbG9ja1Bpbjogc3RyaW5nO1xuICAgICAgICB1c2VQaW46IGJvb2xlYW47XG4gICAgICAgIHVzZUZhY2VJZDogYm9vbGVhbjtcbiAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogc3RyaW5nO1xuICAgICAgICBzbXJ0SWQ6IHN0cmluZztcbiAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiBzdHJpbmc7XG4gICAgICAgIHNtcnRQYXNzd29yZDogc3RyaW5nO1xuICAgICAgICBpc0ZsaWdodE1vZGU6IGJvb2xlYW47XG4gICAgICAgIHBob25lTnVtYmVyOiBzdHJpbmc7XG4gICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBTZXR0aW5ncy5iYWNrZ3JvdW5kLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuYmFja2dyb3VuZCk7XG4gICAgU2V0dGluZ3MubG9ja3NjcmVlbi5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmxvY2tzY3JlZW4pO1xuICAgIFNldHRpbmdzLnJpbmd0b25lLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEucmluZ3RvbmUpO1xuICAgIFNldHRpbmdzLnNob3dTdGFydHVwU2NyZWVuLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuc2hvd1N0YXJ0dXBTY3JlZW4pO1xuICAgIFNldHRpbmdzLnNob3dOb3RpZmljYXRpb25zLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuc2hvd05vdGlmaWNhdGlvbnMpO1xuICAgIFNldHRpbmdzLmlzTG9jay5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmlzTG9jayk7XG4gICAgU2V0dGluZ3MubG9ja1Bpbi5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmxvY2tQaW4pO1xuICAgIFNldHRpbmdzLnVzZVBpbi5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnVzZVBpbik7XG4gICAgU2V0dGluZ3MudXNlRmFjZUlkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEudXNlRmFjZUlkKTtcbiAgICBTZXR0aW5ncy5mYWNlSWRJZGVudGlmaWVyLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuZmFjZUlkSWRlbnRpZmllcik7XG4gICAgU2V0dGluZ3Muc21ydElkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuc21ydElkKTtcbiAgICBTZXR0aW5ncy5zbXJ0UGFzc3dvcmQuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5zbXJ0UGFzc3dvcmQpO1xuICAgIFNldHRpbmdzLmlzRmxpZ2h0TW9kZS5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmlzRmxpZ2h0TW9kZSk7XG4gICAgU2V0dGluZ3MuZGFya01haWxJZEF0dGFjaGVkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuZGFya01haWxJZEF0dGFjaGVkKTtcbiAgICBTZXR0aW5ncy5waG9uZU51bWJlci5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnBob25lTnVtYmVyKTtcbiAgICBTZXR0aW5ncy5waWdlb25JZEF0dGFjaGVkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEucGlnZW9uSWRBdHRhY2hlZCk7XG4gICAgYXdhaXQgU2V0dGluZ3MuU2F2ZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZCk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9zZXR0aW5ncycsXG4gICAgICAgIHRpdGxlOiAnU2V0dGluZ3MgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke2NpdGl6ZW5JZH0gfCBOYW1lOiAke2dsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSBuZXcgc2V0dGluZ3MsICR7SlNPTi5zdHJpbmdpZnkocGFyc2VkRGF0YSl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1JlZ2lzdGVyTmV3TWFpbEFjY291bnQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhOiB7XG4gICAgICAgIGVtYWlsOiBzdHJpbmc7XG4gICAgICAgIHBhc3N3b3JkOiBzdHJpbmc7XG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgZGF0YVg6IFBob25lTWFpbCA9IHtcbiAgICAgICAgYWN0aXZlTWFpZElkOiBwYXJzZWREYXRhLmVtYWlsLFxuICAgICAgICB1c2VybmFtZTogcGFyc2VkRGF0YS5lbWFpbCxcbiAgICAgICAgYWN0aXZlTWFpbFBhc3N3b3JkOiBwYXJzZWREYXRhLnBhc3N3b3JkLFxuICAgICAgICBhdmF0b3I6ICcnLFxuICAgICAgICBtZXNzYWdlczogW10sXG4gICAgfVxuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHBhcnNlZERhdGEuZW1haWwsIC4uLmRhdGFYIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZW1haWwnLFxuICAgICAgICB0aXRsZTogJ0VtYWlsIEFjY291bnQgUmVnaXN0ZXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBOZXcgZW1haWwgYWNjb3VudCByZWdpc3RlcmVkIHdpdGggZW1haWwgJHtwYXJzZWREYXRhLmVtYWlsfSwgcGFzc3dvcmQgXCIke3BhcnNlZERhdGEucGFzc3dvcmR9XCIsIENpdGl6ZW5JZDogJHthd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpfSwgTmFtZTogJHtnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWVcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdTZWFyY2hFbWFpbCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX21haWwnLCB7IF9pZDogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdMb2dpbk1haWxBY2NvdW50JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgICAgICBlbWFpbDogc3RyaW5nO1xuICAgICAgICBwYXNzd29yZDogc3RyaW5nO1xuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBwYXJzZWREYXRhLmVtYWlsIH0pO1xuICAgIGlmIChyZXMuYWN0aXZlTWFpbFBhc3N3b3JkID09PSBwYXJzZWREYXRhLnBhc3N3b3JkKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2VtYWlsJyxcbiAgICAgICAgICAgIHRpdGxlOiAnRW1haWwgTG9naW4nLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7YXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KX0gTmFtZTogJHtnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0gbG9nZ2VkIGluIHRvIGVtYWlsIGFjY291bnQgJHtwYXJzZWREYXRhLmVtYWlsfSwgcGFzc3dvcmQgXCIke3BhcnNlZERhdGEucGFzc3dvcmR9XCJgLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd1bkxvY2tvckxvY2tQaG9uZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IGJvb2xlYW4pID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIFNldHRpbmdzLmlzTG9jay5zZXQoY2l0aXplbklkLCBkYXRhKTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRQaG9uZVBsYXllckNhcmQnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3BsYXllcl9jYXJkJywgeyBfaWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZTp1cGRhdGVQZXJzb25hbENhcmQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhOiBQaG9uZVBsYXllckNhcmQgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9wbGF5ZXJfY2FyZCcsIHsgX2lkOiBwYXJzZWREYXRhLl9pZCB9LCBwYXJzZWREYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX3BlcnNvbmFsX2NhcmQnLFxuICAgICAgICB0aXRsZTogJ1BlcnNvbmFsIENhcmQgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke3BhcnNlZERhdGEuX2lkfSB8IE5hbWU6ICR7Z2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IHVwZGF0ZWQgcGVyc29uYWwgY2FyZCwgJHtKU09OLnN0cmluZ2lmeShwYXJzZWREYXRhKX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcbiIsICJpbXBvcnQgeyBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL2NsYXNzXCI7XG5pbXBvcnQgeyB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5cblJlZ2lzdGVyQ29tbWFuZCgnc2F2ZVNldHRpbmdzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBhcmdzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGF3YWl0IFNldHRpbmdzLnNhdmUoKTtcbn0sIHRydWUpO1xuXG5jb25zdCBnZW5lcmF0ZVBob25lTnVtYmVyID0gYXN5bmMgKCk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gICAgY29uc3QgbnVtYmVyID0gYDU1OSR7TWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTBfMDAwXzAwMCkudG9TdHJpbmcoKS5wYWRTdGFydCg3LCBcIjBcIil9YDtcbiAgICBjb25zdCBleGlzdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG51bWJlcjogbnVtYmVyIH0pO1xuICAgIGlmIChleGlzdHMpIHJldHVybiBnZW5lcmF0ZVBob25lTnVtYmVyKCk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn07XG5cbmFzeW5jIGZ1bmN0aW9uIEdlbmVyYXRlUGxheWVyUGhvbmVOdW1iZXIoY2l0aXplbklkOiBzdHJpbmcsIHNvdXJjZTogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG4gICAgY29uc3QgbnVtYmVyID0gYXdhaXQgZ2VuZXJhdGVQaG9uZU51bWJlcigpO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9udW1iZXJzJywge1xuICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICBvd25lcjogY2l0aXplbklkLFxuICAgICAgICBudW1iZXI6IG51bWJlcixcbiAgICB9KTtcblxuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9zZXR0aW5ncycsIHtcbiAgICAgICAgX2lkOiBjaXRpemVuSWQsXG4gICAgICAgIGJhY2tncm91bmQ6IHtcbiAgICAgICAgICAgIGN1cnJlbnQ6ICcnLFxuICAgICAgICAgICAgd2FsbHBhcGVyczogW10sXG4gICAgICAgIH0sXG4gICAgICAgIGxvY2tzY3JlZW46IHtcbiAgICAgICAgICAgIGN1cnJlbnQ6ICcnLFxuICAgICAgICAgICAgd2FsbHBhcGVyczogW10sXG4gICAgICAgIH0sXG4gICAgICAgIHJpbmd0b25lOiB7XG4gICAgICAgICAgICBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICByaW5ndG9uZXM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkZWZhdWx0JyxcbiAgICAgICAgICAgICAgICAgICAgdXJsOiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRydWUsXG4gICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0cnVlLFxuICAgICAgICBpc0xvY2s6IHRydWUsXG4gICAgICAgIGxvY2tQaW46ICcnLFxuICAgICAgICB1c2VQaW46IHRydWUsXG4gICAgICAgIHBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICAgIHVzZUZhY2VJZDogZmFsc2UsXG4gICAgICAgIGZhY2VJZElkZW50aWZpZXI6IGNpdGl6ZW5JZCxcbiAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiAnJyxcbiAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogJycsXG4gICAgICAgIHNtcnRJZDogJycsXG4gICAgICAgIHNtcnRQYXNzd29yZDogJycsXG4gICAgICAgIGlzRmxpZ2h0TW9kZTogZmFsc2UsXG4gICAgfSk7XG5cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfcGxheWVyX2NhcmQnLCB7XG4gICAgICAgIF9pZDogY2l0aXplbklkLFxuICAgICAgICBmaXJzdE5hbWU6ICdTZXR1cCcsXG4gICAgICAgIGxhc3ROYW1lOiAnQ2FyZCcsXG4gICAgICAgIHBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICAgIGVtYWlsOiAnJyxcbiAgICAgICAgbm90ZXM6ICcnLFxuICAgICAgICBhdmF0YXI6ICcnLFxuICAgIH0pO1xuICAgIFNldHRpbmdzLlJlZ2lzdGVyTmV3U2V0dGluZ3MoY2l0aXplbklkLCBudW1iZXIpO1xuXHRpZiAoc291cmNlKSB7XG5cdFx0ZW1pdE5ldCgncGhvbmU6Y2xpZW50OnNldHVwUGhvbmUnLCBzb3VyY2UsIGNpdGl6ZW5JZCk7XG5cdH1cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX3NldHRpbmdzJyxcbiAgICAgICAgdGl0bGU6ICdQaG9uZSBOdW1iZXIgR2VuZXJhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBob25lIG51bWJlciAke251bWJlcn0gZ2VuZXJhdGVkIGZvciAke2NpdGl6ZW5JZH1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWUsXG4gICAgfSk7XG4gICAgcmV0dXJuIG51bWJlcjtcbn1cbmV4cG9ydHMoJ0dlbmVyYXRlUGxheWVyUGhvbmVOdW1iZXInLCBHZW5lcmF0ZVBsYXllclBob25lTnVtYmVyKTtcblxub24oJ3R4QWRtaW46ZXZlbnRzOnNjaGVkdWxlZFJlc3RhcnQnLCBhc3luYyAoZGF0YTogYW55KSA9PiB7XG4gICAgYXdhaXQgU2V0dGluZ3Muc2F2ZSgpO1xuICAgIExPR0dFUihgW1NldHRpbmdzXSBTYXZlZCBkdXJpbmcgcmVzb3VyY2Ugc3RvcC5gKTtcbn0pO1xuXG5vbigndHhBZG1pbjpldmVudHM6c2VydmVyU2h1dHRpbmdEb3duJywgYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IFNldHRpbmdzLnNhdmUoKTtcbiAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgZHVyaW5nIHJlc291cmNlIHN0b3AuYCk7XG59KTsiLCAiaW1wb3J0IHsgTG9nZ2VyLCBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBUd2VldERhdGEsIFR3ZWV0UHJvZmlsZURhdGEgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxuY2xhc3MgUGlnZW9uU2VydmljZSB7XG4gICAgcHVibGljIGFzeW5jIHNlYXJjaFVzZXJFeGlzdChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogZGF0YSB9KTtcbiAgICAgICAgcmV0dXJuICEhdXNlcjtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbG9naW4oX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwsIHBhc3N3b3JkIH0pO1xuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVXNlciBMb2dpbicsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyIHdpdGggZW1haWwgJHtlbWFpbH0gbG9nZ2VkIGluIHN1Y2Nlc3NmdWxseS5gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBsb2dpbjpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNpZ251cChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBleGlzdGluZ1VzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKGV4aXN0aW5nVXNlcikge1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiRW1haWwgYWxyZWFkeSB0YWtlblwiIH07XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGVtYWlsLFxuICAgICAgICAgICAgcGFzc3dvcmQsXG4gICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICB1c2VybmFtZTogZW1haWwsXG4gICAgICAgICAgICBkaXNwbGF5TmFtZTogZW1haWwsXG4gICAgICAgICAgICBhdmF0YXI6IFwiXCIsXG4gICAgICAgICAgICBiYW5uZXI6IFwiXCIsXG4gICAgICAgICAgICBub3RpZmljYXRpb25zRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgYmlvOiBcIlwiLFxuICAgICAgICAgICAgZm9sbG93ZXJzOiBbXSxcbiAgICAgICAgICAgIGZvbGxvd2luZzogW10sXG4gICAgICAgIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdVc2VyIFNpZ251cCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgTmV3IHVzZXIgYWNjb3VudCBjcmVhdGVkIHdpdGggZW1haWwgJHtlbWFpbH0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldFByb2ZpbGUoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHVzZXIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFwiVXNlciBub3QgZm91bmRcIjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyB0b2dnbGVOb3RpZmljYXRpb25zKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgcmVzLm5vdGlmaWNhdGlvbnNFbmFibGVkID0gIXJlcy5ub3RpZmljYXRpb25zRW5hYmxlZDtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSwgcmVzKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTm90aWZpY2F0aW9ucyBUb2dnbGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSB0b2dnbGVkIG5vdGlmaWNhdGlvbnMgdG8gJHtyZXMubm90aWZpY2F0aW9uc0VuYWJsZWQgPyAnZW5hYmxlZCcgOiAnZGlzYWJsZWQnfS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBwb3N0VHdlZXQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IGVtYWlsLCBjb250ZW50LCBhdHRhY2htZW50cyB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCFyZXMpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgY29uc3QgdHdlZXQ6IFR3ZWV0RGF0YSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHVzZXJuYW1lOiByZXMuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICAgICAgZW1haWw6IHJlcy5lbWFpbCxcbiAgICAgICAgICAgICAgICBhdmF0YXI6IHJlcy5hdmF0YXIsXG4gICAgICAgICAgICAgICAgdmVyaWZpZWQ6IHJlcy52ZXJpZmllZCxcbiAgICAgICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICAgICAgcmVwbGllc0NvdW50OiBbXSxcbiAgICAgICAgICAgICAgICByZXR3ZWV0Q291bnQ6IFtdLFxuICAgICAgICAgICAgICAgIGlzUmV0d2VldDogZmFsc2UsXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiBudWxsLFxuICAgICAgICAgICAgICAgIGhhc2h0YWdzOiBjb250ZW50Lm1hdGNoKC8jXFx3Ky9nKSB8fCBbXSxcbiAgICAgICAgICAgICAgICBwYXJlbnRUd2VldElkOiBudWxsLFxuXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHR3ZWV0KTtcbiAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZWZyZXNoVHdlZXRcIiwgLTEsIEpTT04uc3RyaW5naWZ5KHR3ZWV0KSk7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCAtMSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBUd2VldCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3Jlcy5kaXNwbGF5TmFtZX0gaGFzIHBvc3RlZCBhIG5ldyB0d2VldC5gLFxuICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBgJHtyZXMuZGlzcGxheU5hbWV9IGhhcyBwb3N0ZWQgYSBuZXcgdHdlZXQuYCxcbiAgICAgICAgICAgICAgICBlbWFpbDogcmVzLmVtYWlsLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHR5cGU6IFwicG9zdFwiLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IFBvc3RlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gcG9zdGVkIGEgbmV3IHR3ZWV0IChJRDogJHt0d2VldC5faWR9KSwgY29udGVudDogJHtjb250ZW50fWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBwb3N0VHdlZXQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRBbGxGZWVkKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgc3RhcnQgPSAxLCBlbmQgPSAyMCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHt9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgICAgIHNraXA6IHN0YXJ0IC0gMSxcbiAgICAgICAgICAgICAgICBsaW1pdDogZW5kLFxuICAgICAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBkYXRhOiByZXMsXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiByZXMubGVuZ3RoLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0RmVlZDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHBvc3RSZXBseShjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCBjb250ZW50LCBlbWFpbCwgYXR0YWNobWVudHMgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgY29uc3QgdHdlZXQ6IFR3ZWV0RGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHJldHVybiB7IGVycm9yOiBcIlR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgIGNvbnN0IHJlcGx5ID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHVzZXJuYW1lOiB1c2VyLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgZW1haWw6IHVzZXIuZW1haWwsXG4gICAgICAgICAgICBhdmF0YXI6IHVzZXIuYXZhdGFyLFxuICAgICAgICAgICAgdmVyaWZpZWQ6IHVzZXIudmVyaWZpZWQsXG4gICAgICAgICAgICBjb250ZW50LFxuICAgICAgICAgICAgYXR0YWNobWVudHMsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICByZXBsaWVzQ291bnQ6IFtdLFxuICAgICAgICAgICAgcmV0d2VldENvdW50OiBbXSxcbiAgICAgICAgICAgIGlzUmV0d2VldDogZmFsc2UsXG4gICAgICAgICAgICBvcmlnaW5hbFR3ZWV0SWQ6IHR3ZWV0SWQsXG4gICAgICAgICAgICBoYXNodGFnczogY29udGVudC5tYXRjaCgvI1xcdysvZykgfHwgW10sXG4gICAgICAgICAgICBwYXJlbnRUd2VldElkOiBudWxsXG4gICAgICAgIH07XG4gICAgICAgIHR3ZWV0LnJlcGxpZXNDb3VudC5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHJlcGx5KTtcbiAgICAgICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJlZnJlc2hSZXBvc3RcIiwgLTEsIEpTT04uc3RyaW5naWZ5KHJlcGx5KSk7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChhd2FpdCBVdGlscy5HZXRDaWRGcm9tVHdlZXRJZCh0d2VldC5lbWFpbCkpO1xuICAgICAgICBpZiAocmVzKSB7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZXMuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgUmVwbHknLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHt1c2VyLmRpc3BsYXlOYW1lfSBoYXMgcmVwbGllZCB0byB0d2VldC5gLFxuICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBjb250ZW50OiBgJHt1c2VyLmRpc3BsYXlOYW1lfSBoYXMgcmVwbGllZCB0byB0d2VldC5gLFxuICAgICAgICAgICAgICAgIGVtYWlsOiB0d2VldC5lbWFpbCxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcInBvc3RcIixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1JlcGx5IFBvc3RlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSByZXBsaWVkIHRvIHR3ZWV0IChJRDogJHt0d2VldElkfSksIGNvbnRlbnQ6ICR7Y29udGVudH1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGxpa2VUd2VldChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQsIGxpa2UsIGVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHJldHVybiB7IGVycm9yOiBcIlR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgIGlmIChsaWtlKSB7XG4gICAgICAgICAgICB0d2VldC5saWtlQ291bnQucHVzaChlbWFpbCk7XG4gICAgICAgICAgICBjb25zdCBjaWQgPSBhd2FpdCBVdGlscy5HZXRDaWRGcm9tVHdlZXRJZCh0d2VldC5lbWFpbCk7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoY2lkKTtcbiAgICAgICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZXMuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ05ldyBMaWtlJyxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke2VtYWlsfSBoYXMgbGlrZWQgeW91ciB0d2VldC5gLFxuICAgICAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBgJHtlbWFpbH0gaGFzIGxpa2VkIHlvdXIgdHdlZXQuYCxcbiAgICAgICAgICAgICAgICAgICAgZW1haWw6IHR3ZWV0LmVtYWlsLFxuICAgICAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJsaWtlXCIsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IExpa2VkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBsaWtlZCB0d2VldCAoSUQ6ICR7dHdlZXRJZH0pLmAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0d2VldC5saWtlQ291bnQgPSB0d2VldC5saWtlQ291bnQuZmlsdGVyKChsOiBhbnkpID0+IGwgIT09IGVtYWlsKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgTGlrZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGxpa2VkIHR3ZWV0IChJRDogJHt0d2VldElkfSkuYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbGlrZVJlcGxpZXNUd2VldChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQsIGxpa2UsIGVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkgcmV0dXJuIGNvbnNvbGUubG9nKFwiVHdlZXQgbm90IGZvdW5kXCIpO1xuICAgICAgICBpZiAobGlrZSkge1xuICAgICAgICAgICAgdHdlZXQubGlrZUNvdW50LnB1c2goZW1haWwpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBMaWtlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gbGlrZWQgcmVwbHkgKElEOiAke3R3ZWV0SWR9KS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHdlZXQubGlrZUNvdW50ID0gdHdlZXQubGlrZUNvdW50LmZpbHRlcigobDogYW55KSA9PiBsICE9PSBlbWFpbCk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1JlcGx5IFVubGlrZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IHVubGlrZWQgcmVwbHkgKElEOiAke3R3ZWV0SWR9KS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHJldHdlZXQoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZykge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQsIHJldHdlZXQsIHBpZ2VvbklkLCBvZ1R3ZWV0SWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAocmV0d2VldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0V2VldHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcGlnZW9uSWQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcmlnaW5hbFR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIk9yaWdpbmFsIHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50LnB1c2goY2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgb3JpZ2luYWxUd2VldCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCByZXR3ZWV0RGF0YTogVHdlZXREYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB1c2VybmFtZTogcmV0V2VldHVzZXIuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGVtYWlsOiByZXRXZWV0dXNlci5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgYXZhdGFyOiByZXRXZWV0dXNlci5hdmF0YXIsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiByZXRXZWV0dXNlci52ZXJpZmllZCxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogb3JpZ2luYWxUd2VldC5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50czogb3JpZ2luYWxUd2VldC5hdHRhY2htZW50cyxcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJlcGxpZXNDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJldHdlZXRDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIGlzUmV0d2VldDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiB0d2VldElkLFxuICAgICAgICAgICAgICAgICAgICBoYXNodGFnczogb3JpZ2luYWxUd2VldC5oYXNodGFncyxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VHdlZXRJZDogbnVsbCxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCByZXR3ZWV0RGF0YSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJlZnJlc2hUd2VldFwiLCAtMSwgSlNPTi5zdHJpbmdpZnkocmV0d2VldERhdGEpKTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgUmV0d2VldGVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtwaWdlb25JZH0gcmV0d2VldGVkIHR3ZWV0IChJRDogJHt0d2VldElkfSksIG9yaWdpbmFsIHR3ZWV0IElEOiAke29nVHdlZXRJZH0sIGNvbnRlbnQ6ICR7b3JpZ2luYWxUd2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIXJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiBvZ1R3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcmlnaW5hbFR3ZWV0IHx8ICFyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIk9yaWdpbmFsIHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUmVtb3ZlIG9ubHkgZmlyc3Qgb2NjdXJyZW5jZSBvZiBjaXRpemVuSWRcbiAgICAgICAgICAgICAgICBsZXQgcmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50ID0gb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQuZmlsdGVyKChsOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGwgPT09IGNpdGl6ZW5JZCAmJiAhcmVtb3ZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiBvZ1R3ZWV0SWQgfSwgb3JpZ2luYWxUd2VldCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdSZXR3ZWV0IFJlbW92ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciByZW1vdmVkIHJldHdlZXQgKElEOiAke3R3ZWV0SWR9KSBvZiBvcmlnaW5hbCB0d2VldCAoSUQ6ICR7b2dUd2VldElkfSksIGNvbnRlbnQ6ICR7b3JpZ2luYWxUd2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIHJldHdlZXQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZXR3ZWV0UmVwbGllc1R3ZWV0KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCByZXR3ZWV0LCBwaWdlb25JZCwgb2dUd2VldElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb2dUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IG9yaWdpbmFsVHdlZXQub3JpZ2luYWxUd2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldFdlZXR1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHBpZ2VvbklkIH0pO1xuICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWxUd2VldCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJPcmlnaW5hbCB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudC5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgb2dUd2VldC5yZXBsaWVzQ291bnQucHVzaChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb3JpZ2luYWxUd2VldC5vcmlnaW5hbFR3ZWV0SWQgfSwgb2dUd2VldCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgb3JpZ2luYWxUd2VldCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCByZXR3ZWV0RGF0YTogVHdlZXREYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICB1c2VybmFtZTogcmV0V2VldHVzZXIuZGlzcGxheU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGVtYWlsOiByZXRXZWV0dXNlci5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgYXZhdGFyOiByZXRXZWV0dXNlci5hdmF0YXIsXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiByZXRXZWV0dXNlci52ZXJpZmllZCxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogb3JpZ2luYWxUd2VldC5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBhdHRhY2htZW50czogb3JpZ2luYWxUd2VldC5hdHRhY2htZW50cyxcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIGxpa2VDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJlcGxpZXNDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIHJldHdlZXRDb3VudDogW10sXG4gICAgICAgICAgICAgICAgICAgIGlzUmV0d2VldDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiBvcmlnaW5hbFR3ZWV0Lm9yaWdpbmFsVHdlZXRJZCxcbiAgICAgICAgICAgICAgICAgICAgaGFzaHRhZ3M6IG9yaWdpbmFsVHdlZXQuaGFzaHRhZ3MsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFR3ZWV0SWQ6IHR3ZWV0SWQsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCByZXR3ZWV0RGF0YSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKFwicGlnZW9uOnJlZnJlc2hSZXBvc3RcIiwgLTEsIEpTT04uc3RyaW5naWZ5KHJldHdlZXREYXRhKSk7XG4gICAgICAgICAgICAgICAgaWYgKG9nVHdlZXQucmVwbGllc0NvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVuaXF1ZUNpZHMgPSBbLi4ubmV3IFNldChvZ1R3ZWV0LnJlcGxpZXNDb3VudCldO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJlcGx5Q2lkIG9mIHVuaXF1ZUNpZHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZXBseUNpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZXMuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgUmVwbHknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtyZXRXZWV0dXNlci5kaXNwbGF5TmFtZX0gaGFzIHJlcGxpZWQgdG8gdHdlZXQuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDogYHtyZXRXZWV0dXNlci5kaXNwbGF5TmFtZX0gaGFzIHJlcGxpZWQgdG8gdHdlZXQuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWFpbDogcmV0V2VldHVzZXIuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJwb3N0XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUmVwbHkgUmV0d2VldGVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtwaWdlb25JZH0gcmV0d2VldGVkIHJlcGx5IChJRDogJHt0d2VldElkfSksIG9yaWdpbmFsIHR3ZWV0IElEOiAke29nVHdlZXRJZH0pLCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbFR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiBvZ1R3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmV0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIW9yaWdpbmFsVHdlZXQgfHwgIXJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiT3JpZ2luYWwgdHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgb25seSBmaXJzdCBvY2N1cnJlbmNlIG9mIGNpdGl6ZW5JZFxuICAgICAgICAgICAgICAgIGxldCByZW1vdmVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQgPSBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudC5maWx0ZXIoKGw6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAobCA9PT0gY2l0aXplbklkICYmICFyZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudCk7ICovXG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IG9nVHdlZXRJZCB9LCBvcmlnaW5hbFR3ZWV0KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUmV0d2VldCBvZiBSZXBseSBSZW1vdmVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgcmVtb3ZlZCByZXR3ZWV0IChJRDogJHt0d2VldElkfSkgb2YgcmVwbHkgKElEOiAke29nVHdlZXRJZH0pLCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiByZXR3ZWV0OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGVsZXRlVHdlZXQoX2NsaWVudDogbnVtYmVyLCB0d2VldElkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBUd2VldCBub3QgZm91bmQgZm9yIGRlbGV0aW9uOiAke3R3ZWV0SWR9YCk7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBEZWxldGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBUd2VldCAoSUQ6ICR7dHdlZXRJZH0pIGRlbGV0ZWQgYnkgdXNlciAke3R3ZWV0LmVtYWlsfSwgY29udGVudDogJHt0d2VldC5jb250ZW50fWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGVsZXRlUmVwbGllc1R3ZWV0KF9jbGllbnQ6IG51bWJlciwgdHdlZXRJZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBSZXBseSB0d2VldCBub3QgZm91bmQgZm9yIGRlbGV0aW9uOiAke3R3ZWV0SWR9YCk7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJSZXBseSB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1JlcGx5IERlbGV0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFJlcGx5IChJRDogJHt0d2VldElkfSkgZGVsZXRlZCwgY29udGVudDogJHt0d2VldC5jb250ZW50fSBieSB1c2VyICR7dHdlZXQuZW1haWx9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0UG9zdFJlcGxpZXMoX2NsaWVudDogbnVtYmVyLCB0d2VldElkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVwbGllcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBvcmlnaW5hbFR3ZWV0SWQ6IHR3ZWV0SWQgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVwbGllcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGluY3JlYXNlUmVwbGllc0NvdW50KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IHR3ZWV0SWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgdHdlZXQucmVwbGllc0NvdW50LnB1c2goYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KSk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGRlY3JlYXNlUmVwbGllc0NvdW50KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyB0d2VldElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgY29uc3QgY2lkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcblxuICAgICAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgaWYgKCF0d2VldCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFR3ZWV0IG5vdCBmb3VuZCBmb3IgdHdlZXRJZDogJHt0d2VldElkfWApO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIlR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCByZW1vdmVkID0gZmFsc2U7XG4gICAgICAgICAgICB0d2VldC5yZXBsaWVzQ291bnQgPSB0d2VldC5yZXBsaWVzQ291bnQuZmlsdGVyKChyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAociA9PT0gY2lkICYmICFyZW1vdmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZVJlc3VsdCA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG5cbiAgICAgICAgICAgIGlmICghdXBkYXRlUmVzdWx0IHx8IHVwZGF0ZVJlc3VsdC5tb2RpZmllZENvdW50ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBObyBjaGFuZ2VzIG1hZGUgdG8gdHdlZXQgJHt0d2VldElkfSByZXBsaWVzQ291bnRgKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogXCJObyBjaGFuZ2VzIG1hZGUgdG8gcmVwbGllcyBjb3VudFwiIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGBTdWNjZXNzZnVsbHkgZGVjcmVhc2VkIHJlcGxpZXNDb3VudCBmb3IgdHdlZXQgJHt0d2VldElkfWApOyAqL1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZGVjcmVhc2VSZXBsaWVzQ291bnQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIsIGRldGFpbHM6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBmb2xsb3dVc2VyKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgdGFyZ2V0RW1haWwsIGN1cnJlbnRFbWFpbCwgZm9sbG93IH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0VXNlcjogVHdlZXRQcm9maWxlRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiB0YXJnZXRFbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghdGFyZ2V0VXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVGFyZ2V0IHVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgY29uc3QgY3VycmVudFVzZXI6IFR3ZWV0UHJvZmlsZURhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogY3VycmVudEVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCFjdXJyZW50VXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiQ3VycmVudCB1c2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGlmIChmb2xsb3cpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldFVzZXIuZm9sbG93ZXJzLmluY2x1ZGVzKGN1cnJlbnRFbWFpbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0VXNlci5mb2xsb3dlcnMucHVzaChjdXJyZW50RW1haWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIWN1cnJlbnRVc2VyLmZvbGxvd2luZy5pbmNsdWRlcyh0YXJnZXRFbWFpbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFVzZXIuZm9sbG93aW5nLnB1c2godGFyZ2V0RW1haWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVXNlciBGb2xsb3dlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7Y3VycmVudEVtYWlsfSBmb2xsb3dlZCAke3RhcmdldEVtYWlsfS5gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRhcmdldFVzZXIuZm9sbG93ZXJzID0gdGFyZ2V0VXNlci5mb2xsb3dlcnMuZmlsdGVyKGVtYWlsID0+IGVtYWlsICE9PSBjdXJyZW50RW1haWwpO1xuICAgICAgICAgICAgICAgIGN1cnJlbnRVc2VyLmZvbGxvd2luZyA9IGN1cnJlbnRVc2VyLmZvbGxvd2luZy5maWx0ZXIoZW1haWwgPT4gZW1haWwgIT09IHRhcmdldEVtYWlsKTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnVXNlciBVbmZvbGxvd2VkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtjdXJyZW50RW1haWx9IHVuZm9sbG93ZWQgJHt0YXJnZXRFbWFpbH0uYCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiB0YXJnZXRFbWFpbCB9LCB0YXJnZXRVc2VyKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IGN1cnJlbnRFbWFpbCB9LCBjdXJyZW50VXNlcik7XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBmb2xsb3dVc2VyOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSB1cGRhdGluZyBmb2xsb3cgc3RhdHVzXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRVc2VyVHdlZXRzKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgZW1haWwgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QWxsUG9zdFJlcGxpZXMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IGVtYWlsOiBlbWFpbCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRBbGxMaWtlZFR3ZWV0cyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IGxpa2VDb3VudDogZW1haWwgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2VhcmNoVXNlcnMoX2NsaWVudDogbnVtYmVyLCB2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiB7ICRyZWdleDogdmFsdWUsICRvcHRpb25zOiBcImlcIiB9IH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldE5vdGlmaWNhdGlvbnMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl9ub3RpZmljYXRpb25zXCIsIHsgZW1haWwgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgY2hhbmdlUGFzc3dvcmQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIXVzZXIpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgY29uc3Qgb2xkUGFzc3dvcmQgPSB1c2VyLnBhc3N3b3JkO1xuICAgICAgICB1c2VyLnBhc3N3b3JkID0gcGFzc3dvcmQ7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSwgdXNlcik7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1Bhc3N3b3JkIENoYW5nZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gY2hhbmdlZCB0aGVpciBwYXNzd29yZCwgb2xkIHBhc3N3b3JkOiAke29sZFBhc3N3b3JkfSwgbmV3IHBhc3N3b3JkOiAke3Bhc3N3b3JkfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xuXG4gICAgcHVibGljIGFzeW5jIHVwZGF0ZVByb2ZpbGUoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCBwYXJzZWREYXRhOiBUd2VldFByb2ZpbGVEYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3Qgb2xkVXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBwYXJzZWREYXRhLmVtYWlsIH0pO1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcGFyc2VkRGF0YS5lbWFpbCB9LCBwYXJzZWREYXRhKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnUHJvZmlsZSBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7cGFyc2VkRGF0YS5lbWFpbH0gdXBkYXRlZCB0aGVpciBwcm9maWxlLCBvbGQgZGF0YTogJHtKU09OLnN0cmluZ2lmeShvbGRVc2VyKX0sIG5ldyBkYXRhOiAke0pTT04uc3RyaW5naWZ5KHBhcnNlZERhdGEpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gXCJzdWNjZXNzXCI7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHZlcmlmeVVzZXIoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICBpZiAoIXVzZXIpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgdXNlci52ZXJpZmllZCA9IHRydWU7XG4gICAgICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0sIHVzZXIpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdVc2VyIFZlcmlmaWVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGhhcyBiZWVuIHZlcmlmaWVkLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBQcml2YXRlIE1lc3NhZ2luZyBGdW5jdGlvbnNcbiAgICBwdWJsaWMgYXN5bmMgc2VuZFByaXZhdGVNZXNzYWdlKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgc2VuZGVyRW1haWwsIHJlY2lwaWVudEVtYWlsLCBjb250ZW50LCBhdHRhY2htZW50cyA9IFtdIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgICAgICAvLyBWZXJpZnkgYm90aCB1c2VycyBleGlzdFxuICAgICAgICAgICAgY29uc3Qgc2VuZGVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHNlbmRlckVtYWlsIH0pO1xuICAgICAgICAgICAgY29uc3QgcmVjaXBpZW50ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHJlY2lwaWVudEVtYWlsIH0pO1xuXG4gICAgICAgICAgICBpZiAoIXNlbmRlciB8fCAhcmVjaXBpZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0ge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgc2VuZGVyRW1haWwsXG4gICAgICAgICAgICAgICAgcmVjaXBpZW50RW1haWwsXG4gICAgICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgICAgICBhdHRhY2htZW50cyxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICByZWFkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkZWxldGVkQnlTZW5kZXI6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGRlbGV0ZWRCeVJlY2lwaWVudDogZmFsc2VcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgbWVzc2FnZSk7XG5cbiAgICAgICAgICAgIC8vIEdldCBhbGwgQ2l0aXplbiBJRHMgZm9yIGJvdGggc2VuZGVyIGFuZCByZWNpcGllbnQgKG11bHRpcGxlIGRldmljZXMgc3VwcG9ydClcbiAgICAgICAgICAgIGNvbnN0IHNlbmRlckNpZHMgPSBhd2FpdCBVdGlscy5HZXRDaWRzRnJvbVBpZ2VvbkVtYWlsKHNlbmRlckVtYWlsKTtcbiAgICAgICAgICAgIGNvbnN0IHJlY2lwaWVudENpZHMgPSBhd2FpdCBVdGlscy5HZXRDaWRzRnJvbVBpZ2VvbkVtYWlsKHJlY2lwaWVudEVtYWlsKTtcblxuICAgICAgICAgICAgLy8gU2VuZCBub3RpZmljYXRpb25zIGFuZCByZWZyZXNoIGV2ZW50cyB0byBhbGwgcmVjaXBpZW50IGRldmljZXNcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVjaXBpZW50Q2lkIG9mIHJlY2lwaWVudENpZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWNpcGllbnRQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQocmVjaXBpZW50Q2lkKTtcbiAgICAgICAgICAgICAgICBpZiAocmVjaXBpZW50UGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHJlY2lwaWVudFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgTWVzc2FnZScsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSByZWNlaXZlZCBhIG1lc3NhZ2UgZnJvbSAke3NlbmRlci5kaXNwbGF5TmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiAncGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgTlVJIGV2ZW50IHRvIHJlZnJlc2ggY2hhdCBpZiByZWNpcGllbnQgaXMgaW4gY2hhdFxuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTpyZWZyZXNoUHJpdmF0ZU1lc3NhZ2UnLCByZWNpcGllbnRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZW5kZXJFbWFpbDogc2VuZGVyRW1haWwsXG4gICAgICAgICAgICAgICAgICAgICAgICByZWNpcGllbnRFbWFpbDogcmVjaXBpZW50RW1haWxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2VuZCByZWZyZXNoIGV2ZW50IHRvIGFsbCBzZW5kZXIgZGV2aWNlc1xuICAgICAgICAgICAgZm9yIChjb25zdCBzZW5kZXJDaWQgb2Ygc2VuZGVyQ2lkcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNlbmRlclBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChzZW5kZXJDaWQpO1xuICAgICAgICAgICAgICAgIGlmIChzZW5kZXJQbGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6cmVmcmVzaFByaXZhdGVNZXNzYWdlJywgc2VuZGVyUGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyRW1haWw6IHNlbmRlckVtYWlsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVjaXBpZW50RW1haWw6IHJlY2lwaWVudEVtYWlsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUHJpdmF0ZSBNZXNzYWdlIFNlbnQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NlbmRlckVtYWlsfSBzZW50IGEgcHJpdmF0ZSBtZXNzYWdlIHRvICR7cmVjaXBpZW50RW1haWx9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZUlkOiBtZXNzYWdlLl9pZCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIHNlbmRQcml2YXRlTWVzc2FnZTpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgc2VuZGluZyBtZXNzYWdlXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRQcml2YXRlTWVzc2FnZXMoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyB1c2VyRW1haWwsIG90aGVyVXNlckVtYWlsLCBsaW1pdCA9IDUwLCBvZmZzZXQgPSAwIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7XG4gICAgICAgICAgICAgICAgJG9yOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgc2VuZGVyRW1haWw6IHVzZXJFbWFpbCwgcmVjaXBpZW50RW1haWw6IG90aGVyVXNlckVtYWlsIH0sXG4gICAgICAgICAgICAgICAgICAgIHsgc2VuZGVyRW1haWw6IG90aGVyVXNlckVtYWlsLCByZWNpcGllbnRFbWFpbDogdXNlckVtYWlsIH1cbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICRhbmQ6IFtcbiAgICAgICAgICAgICAgICAgICAgeyBkZWxldGVkQnlTZW5kZXI6IHsgJG5lOiB0cnVlIH0gfSxcbiAgICAgICAgICAgICAgICAgICAgeyBkZWxldGVkQnlSZWNpcGllbnQ6IHsgJG5lOiB0cnVlIH0gfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH0sXG4gICAgICAgICAgICAgICAgc2tpcDogb2Zmc2V0LFxuICAgICAgICAgICAgICAgIGxpbWl0OiBsaW1pdFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShtZXNzYWdlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0UHJpdmF0ZU1lc3NhZ2VzOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBtZXNzYWdlc1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0Q29udmVyc2F0aW9ucyhfY2xpZW50OiBudW1iZXIsIHVzZXJFbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIEdldCBhbGwgdW5pcXVlIGNvbnZlcnNhdGlvbnMgZm9yIHRoZSB1c2VyXG4gICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25zID0gYXdhaXQgTW9uZ29EQi5hZ2dyZWdhdGUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkbWF0Y2g6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICRvcjogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgc2VuZGVyRW1haWw6IHVzZXJFbWFpbCB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgcmVjaXBpZW50RW1haWw6IHVzZXJFbWFpbCB9XG4gICAgICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgJGFuZDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgZGVsZXRlZEJ5U2VuZGVyOiB7ICRuZTogdHJ1ZSB9IH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyBkZWxldGVkQnlSZWNpcGllbnQ6IHsgJG5lOiB0cnVlIH0gfVxuICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkZ3JvdXA6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICRjb25kOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgJGVxOiBbXCIkc2VuZGVyRW1haWxcIiwgdXNlckVtYWlsXSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiRyZWNpcGllbnRFbWFpbFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIiRzZW5kZXJFbWFpbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlOiB7ICRmaXJzdDogXCIkJFJPT1RcIiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkc3VtOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICRjb25kOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ICRhbmQ6IFt7ICRlcTogW1wiJHJlY2lwaWVudEVtYWlsXCIsIHVzZXJFbWFpbF0gfSwgeyAkZXE6IFtcIiRyZWFkXCIsIGZhbHNlXSB9XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkbG9va3VwOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcm9tOiBcInBob25lX3BpZ2Vvbl91c2Vyc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxGaWVsZDogXCJfaWRcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGZvcmVpZ25GaWVsZDogXCJlbWFpbFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXM6IFwidXNlckluZm9cIlxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICR1bndpbmQ6IFwiJHVzZXJJbmZvXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJHByb2plY3Q6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG90aGVyVXNlcjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtYWlsOiBcIiR1c2VySW5mby5lbWFpbFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRpc3BsYXlOYW1lOiBcIiR1c2VySW5mby5kaXNwbGF5TmFtZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF2YXRhcjogXCIkdXNlckluZm8uYXZhdGFyXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQ6IFwiJHVzZXJJbmZvLnZlcmlmaWVkXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVucmVhZENvdW50OiAxXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJHNvcnQ6IHsgXCJsYXN0TWVzc2FnZS5jcmVhdGVkQXRcIjogLTEgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoY29udmVyc2F0aW9ucyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0Q29udmVyc2F0aW9uczpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgY29udmVyc2F0aW9uc1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgbWFya01lc3NhZ2VBc1JlYWQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBtZXNzYWdlSWQsIHVzZXJFbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHsgX2lkOiBtZXNzYWdlSWQgfSk7XG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UpIHJldHVybiB7IGVycm9yOiBcIk1lc3NhZ2Ugbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgLy8gT25seSBtYXJrIGFzIHJlYWQgaWYgdGhlIHVzZXIgaXMgdGhlIHJlY2lwaWVudFxuICAgICAgICAgICAgaWYgKG1lc3NhZ2UucmVjaXBpZW50RW1haWwgPT09IHVzZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UucmVhZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7IF9pZDogbWVzc2FnZUlkIH0sIG1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gbWFya01lc3NhZ2VBc1JlYWQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIG1hcmtpbmcgbWVzc2FnZSBhcyByZWFkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBkZWxldGVNZXNzYWdlKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgbWVzc2FnZUlkLCB1c2VyRW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7IF9pZDogbWVzc2FnZUlkIH0pO1xuICAgICAgICAgICAgaWYgKCFtZXNzYWdlKSByZXR1cm4geyBlcnJvcjogXCJNZXNzYWdlIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIC8vIE1hcmsgYXMgZGVsZXRlZCBieSB0aGUgYXBwcm9wcmlhdGUgdXNlclxuICAgICAgICAgICAgaWYgKG1lc3NhZ2Uuc2VuZGVyRW1haWwgPT09IHVzZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UuZGVsZXRlZEJ5U2VuZGVyID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobWVzc2FnZS5yZWNpcGllbnRFbWFpbCA9PT0gdXNlckVtYWlsKSB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZS5kZWxldGVkQnlSZWNpcGllbnQgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJVbmF1dGhvcml6ZWRcIiB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIHsgX2lkOiBtZXNzYWdlSWQgfSwgbWVzc2FnZSk7XG5cbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWVzc2FnZSBEZWxldGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke3VzZXJFbWFpbH0gZGVsZXRlZCBhIHByaXZhdGUgbWVzc2FnZWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBkZWxldGVNZXNzYWdlOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBkZWxldGluZyBtZXNzYWdlXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIEVuaGFuY2VkIEZvbGxvd2Vycy9Gb2xsb3dpbmcgRnVuY3Rpb25zXG4gICAgcHVibGljIGFzeW5jIGdldEZvbGxvd2VycyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0pO1xuICAgICAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGNvbnN0IGZvbGxvd2VycyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdXNlcnNcIixcbiAgICAgICAgICAgICAgICB7IGVtYWlsOiB7ICRpbjogdXNlci5mb2xsb3dlcnMgfSB9LFxuICAgICAgICAgICAgICAgIG51bGwsIGZhbHNlLFxuICAgICAgICAgICAgICAgIHsgc29ydDogeyBkaXNwbGF5TmFtZTogMSB9IH1cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShmb2xsb3dlcnMpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldEZvbGxvd2VyczpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgZm9sbG93ZXJzXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRGb2xsb3dpbmcoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghdXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICBjb25zdCBmb2xsb3dpbmcgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsXG4gICAgICAgICAgICAgICAgeyBlbWFpbDogeyAkaW46IHVzZXIuZm9sbG93aW5nIH0gfSxcbiAgICAgICAgICAgICAgICBudWxsLCBmYWxzZSxcbiAgICAgICAgICAgICAgICB7IHNvcnQ6IHsgZGlzcGxheU5hbWU6IDEgfSB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZm9sbG93aW5nKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBnZXRGb2xsb3dpbmc6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIGZvbGxvd2luZ1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbn1cblxuZXhwb3J0IGNvbnN0IHBpZ2VvblNlcnZpY2UgPSBuZXcgUGlnZW9uU2VydmljZSgpOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgcGlnZW9uU2VydmljZSB9IGZyb20gXCIuL1BpZ2VvblNlcnZpY2VcIjtcblxub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpzZWFyY2hVc2Vyc1wiLCBwaWdlb25TZXJ2aWNlLnNlYXJjaFVzZXJFeGlzdCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmxvZ2luXCIsIHBpZ2VvblNlcnZpY2UubG9naW4pO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpzaWdudXBcIiwgcGlnZW9uU2VydmljZS5zaWdudXApO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjp0b2dnbGVOb3RpZmljYXRpb25zXCIsIHBpZ2VvblNlcnZpY2UudG9nZ2xlTm90aWZpY2F0aW9ucyk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnBvc3RUd2VldFwiLCBwaWdlb25TZXJ2aWNlLnBvc3RUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmdldFByb2ZpbGVcIiwgcGlnZW9uU2VydmljZS5nZXRQcm9maWxlKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Z2V0QWxsRmVlZFwiLCBwaWdlb25TZXJ2aWNlLmdldEFsbEZlZWQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpsaWtlVHdlZXRcIiwgcGlnZW9uU2VydmljZS5saWtlVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZXR3ZWV0VHdlZXRcIiwgcGlnZW9uU2VydmljZS5yZXR3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246ZGVsZXRlVHdlZXRcIiwgcGlnZW9uU2VydmljZS5kZWxldGVUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOnBvc3RSZXBseVwiLCBwaWdlb25TZXJ2aWNlLnBvc3RSZXBseSk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmdldFJlcGxpZXNcIiwgcGlnZW9uU2VydmljZS5nZXRQb3N0UmVwbGllcyk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmxpa2VSZXBvc3RUd2VldFwiLCBwaWdlb25TZXJ2aWNlLmxpa2VSZXBsaWVzVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZXR3ZWV0UmVwb3N0VHdlZXRcIiwgcGlnZW9uU2VydmljZS5yZXR3ZWV0UmVwbGllc1R3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246aW5jcmVhc2VSZXBsaWVzQ291bnRcIiwgcGlnZW9uU2VydmljZS5pbmNyZWFzZVJlcGxpZXNDb3VudCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmRlY3JlYXNlUmVwbGllc0NvdW50XCIsIHBpZ2VvblNlcnZpY2UuZGVjcmVhc2VSZXBsaWVzQ291bnQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpkZWxldGVSZXBsaWVzVHdlZXRcIiwgcGlnZW9uU2VydmljZS5kZWxldGVSZXBsaWVzVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjpmb2xsb3dVc2VyXCIsIHBpZ2VvblNlcnZpY2UuZm9sbG93VXNlcik7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmdldFVzZXJUd2VldHNcIiwgcGlnZW9uU2VydmljZS5nZXRVc2VyVHdlZXRzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRBbGxQb3N0UmVwbGllcycsIHBpZ2VvblNlcnZpY2UuZ2V0QWxsUG9zdFJlcGxpZXMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldEFsbExpa2VkVHdlZXRzJywgcGlnZW9uU2VydmljZS5nZXRBbGxMaWtlZFR3ZWV0cyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246c2VhcmNoVXNlcnNYJywgcGlnZW9uU2VydmljZS5zZWFyY2hVc2Vycyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0Tm90aWZpY2F0aW9ucycsIHBpZ2VvblNlcnZpY2UuZ2V0Tm90aWZpY2F0aW9ucyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Y2hhbmdlUGFzc3dvcmQnLCBwaWdlb25TZXJ2aWNlLmNoYW5nZVBhc3N3b3JkKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2Vvbjp1cGRhdGVQcm9maWxlJywgcGlnZW9uU2VydmljZS51cGRhdGVQcm9maWxlKTtcblxuLy8gUHJpdmF0ZSBNZXNzYWdpbmcgQ2FsbGJhY2tzXG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246c2VuZFByaXZhdGVNZXNzYWdlJywgcGlnZW9uU2VydmljZS5zZW5kUHJpdmF0ZU1lc3NhZ2UpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldFByaXZhdGVNZXNzYWdlcycsIHBpZ2VvblNlcnZpY2UuZ2V0UHJpdmF0ZU1lc3NhZ2VzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRDb252ZXJzYXRpb25zJywgKGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gcGlnZW9uU2VydmljZS5nZXRDb252ZXJzYXRpb25zKGNsaWVudCwgZGF0YSk7XG59KTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjptYXJrTWVzc2FnZUFzUmVhZCcsIHBpZ2VvblNlcnZpY2UubWFya01lc3NhZ2VBc1JlYWQpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmRlbGV0ZU1lc3NhZ2UnLCBwaWdlb25TZXJ2aWNlLmRlbGV0ZU1lc3NhZ2UpO1xuXG4vLyBFbmhhbmNlZCBGb2xsb3dlcnMvRm9sbG93aW5nIENhbGxiYWNrc1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldEZvbGxvd2VycycsIHBpZ2VvblNlcnZpY2UuZ2V0Rm9sbG93ZXJzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRGb2xsb3dpbmcnLCBwaWdlb25TZXJ2aWNlLmdldEZvbGxvd2luZyk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldE93bmVkSG91c2VzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IHBsYXllciA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgYXBhcnRtZW50cyA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgcHJvcGVydHlfaWQsIG93bmVyX2NpdGl6ZW5pZCwgc3RyZWV0LCBkZXNjcmlwdGlvbiwgaGFzX2FjY2VzcywgZG9vcl9kYXRhLCBhcGFydG1lbnQgIEZST00gcHJvcGVydGllcyBXSEVSRSBvd25lcl9jaXRpemVuaWQgPSA/IEFORCBhcGFydG1lbnQgSVMgTk9UIE5VTEwgQU5EIGFwYXJ0bWVudCA8PiBcIlwiJywgW3BsYXllcl0pO1xuICAgIGNvbnN0IGhvdXNlcyA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgcHJvcGVydHlfaWQsIG93bmVyX2NpdGl6ZW5pZCwgc3RyZWV0LCBkZXNjcmlwdGlvbiwgaGFzX2FjY2Vzcywgc2hlbGwsIGRvb3JfZGF0YSBGUk9NIHByb3BlcnRpZXMgV0hFUkUgb3duZXJfY2l0aXplbmlkID0gPyBBTkQgYXBhcnRtZW50IElTIE5VTEwnLCBbcGxheWVyXSk7XG4gICAgY29uc3QgcmVzID0ge1xuICAgICAgICBhcGFydG1lbnRzOiBhcGFydG1lbnRzLFxuICAgICAgICBob3VzZXM6IGhvdXNlc1xuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRLZXlIb2xkZXJOYW1lcycsIGFzeW5jIChjbGllbnQsIGRhdGEpID0+IHtcbiAgICBjb25zdCByZXMgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGxldCBuYW1lTWFwOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG5cbiAgICBpZiAocmVzICYmIHJlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIFByb2Nlc3MgYWxsIGhvdXNlcyBpbiBwYXJhbGxlbFxuICAgICAgICBjb25zdCBhcGFydG1lbnRQcm9taXNlcyA9IHJlcy5tYXAoKGhvdXNlOiBzdHJpbmcpID0+XG4gICAgICAgICAgICBVdGlscy5xdWVyeSgnU0VMRUNUIGNpdGl6ZW5pZCwgY2hhcmluZm8gRlJPTSBwbGF5ZXJzIFdIRVJFIGNpdGl6ZW5pZCA9ID8nLCBbaG91c2VdKVxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IGFsbEFwYXJ0bWVudHMgPSBhd2FpdCBQcm9taXNlLmFsbChhcGFydG1lbnRQcm9taXNlcyk7XG5cbiAgICAgICAgYWxsQXBhcnRtZW50cy5mb3JFYWNoKGFwYXJ0bWVudHMgPT4ge1xuICAgICAgICAgICAgLyogY29uc29sZS5sb2coYXBhcnRtZW50cyk7ICovXG4gICAgICAgICAgICBpZiAoYXBhcnRtZW50cyAmJiBhcGFydG1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBhcGFydG1lbnRzLmZvckVhY2goKGFwYXJ0bWVudDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoYXJpbmZvID0gSlNPTi5wYXJzZShhcGFydG1lbnQuY2hhcmluZm8pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmdWxsTmFtZSA9IGAke2NoYXJpbmZvLmZpcnN0bmFtZX0gJHtjaGFyaW5mby5sYXN0bmFtZX1gO1xuICAgICAgICAgICAgICAgICAgICBuYW1lTWFwW2FwYXJ0bWVudC5jaXRpemVuaWRdID0gZnVsbE5hbWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShuYW1lTWFwKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdyZW1vdmVBY2Nlc3MnLCBhc3luYyAoY2xpZW50LCBkYXRhKSA9PiB7XG4gICAgY29uc3QgeyBpZCwgY2lkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGhvdXNlOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUICogRlJPTSBwcm9wZXJ0aWVzIFdIRVJFIHByb3BlcnR5X2lkID0gPycsIFtpZF0pO1xuICAgIGlmIChob3VzZSAmJiBob3VzZS5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnN0IGhvdXNlRGF0YSA9IGhvdXNlWzBdO1xuICAgICAgICBjb25zdCBoYXNBY2Nlc3MgPSBKU09OLnBhcnNlKGhvdXNlRGF0YS5oYXNfYWNjZXNzKTtcbiAgICAgICAgY29uc3QgbmV3QWNjZXNzID0gaGFzQWNjZXNzLmZpbHRlcigoYWNjZXNzOiBzdHJpbmcpID0+IGFjY2VzcyAhPT0gY2lkKTtcbiAgICAgICAgLyogY29uc29sZS5sb2cobmV3QWNjZXNzKTsgKi9cbiAgICAgICAgYXdhaXQgVXRpbHMucXVlcnkoJ1VQREFURSBwcm9wZXJ0aWVzIFNFVCBoYXNfYWNjZXNzID0gPyBXSEVSRSBwcm9wZXJ0eV9pZCA9ID8nLCBbSlNPTi5zdHJpbmdpZnkobmV3QWNjZXNzKSwgaWRdKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcHJvcGVydGllcycsXG4gICAgICAgICAgICB0aXRsZTogJ0FjY2VzcyBSZW1vdmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBY2Nlc3MgcmVtb3ZlZCBmcm9tICR7Y2lkfSB0byAke2hvdXNlRGF0YS5zdHJlZXR9LCAke2hvdXNlRGF0YS5wcm9wZXJ0eV9pZH0gYnkgJHthd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2xpZW50KSl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2ssIHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOmNyZWF0ZVBvc3QnLCBhc3luYyAoc291cmNlLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHRpdGxlLCBjb250ZW50LCBpbWFnZUF0dGFjaG1lbnQsIHBob25lTnVtYmVyLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBkYXRhWCA9IHtcbiAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGUsXG4gICAgICAgIGNvbnRlbnQsXG4gICAgICAgIGltYWdlQXR0YWNobWVudCxcbiAgICAgICAgcGhvbmVOdW1iZXIsXG4gICAgICAgIGVtYWlsLFxuICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgIH07XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JsdWVwYWdlcycsIGRhdGFYKTtcbiAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOnJlZnJlc2hQb3N0cycsIC0xLCBKU09OLnN0cmluZ2lmeShkYXRhWCkpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYmx1ZXBhZ2VzJyxcbiAgICAgICAgdGl0bGU6ICdQb3N0IENyZWF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgUG9zdCAnJHt0aXRsZX0nIChJRDogJHtkYXRhWC5faWR9KSBjcmVhdGVkIGJ5ICR7cGhvbmVOdW1iZXIgfHwgZW1haWx9LCBjb250ZW50OiAke2NvbnRlbnR9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOmdldFBvc3RzJywgYXN5bmMgKHNvdXJjZSkgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2JsdWVwYWdlcycsIHt9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2JsdWVwYWdlOmRlbGV0ZVBvc3QnLCBhc3luYyAoc291cmNlLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwb3N0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9ibHVlcGFnZXMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfYmx1ZXBhZ2VzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpyZWZyZXNoRGVsZXRlUG9zdCcsIC0xLCBkYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2JsdWVwYWdlcycsXG4gICAgICAgIHRpdGxlOiAnUG9zdCBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBvc3QgJyR7cG9zdC50aXRsZX0nIChJRDogJHtkYXRhfSkgZGVsZXRlZCBieSAke3Bvc3QucGhvbmVOdW1iZXIgfHwgcG9zdC5lbWFpbH0sIGNvbnRlbnQ6ICR7cG9zdC5jb250ZW50fWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrLCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZyYW1ld29yayB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IEdhcmFnZURhdGEgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmludGVyZmFjZSBWZWhpY2xlRGF0YSB7XG4gICAgdmVoaWNsZTogc3RyaW5nO1xuICAgIHBsYXRlOiBzdHJpbmc7XG4gICAgZ2FyYWdlOiBzdHJpbmc7XG4gICAgbW9kczogc3RyaW5nO1xuICAgIHN0YXRlOiBudW1iZXI7XG4gICAgZGVwb3RwcmljZTogc3RyaW5nO1xufVxuXG5vbkNsaWVudENhbGxiYWNrKCdnYXJhZ2U6Z2V0R2FyYWdlRGF0YScsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGxldCByZXNEYXRhOiBHYXJhZ2VEYXRhW10gPSBbXTtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IFV0aWxzLnF1ZXJ5KGBTRUxFQ1QgdmVoaWNsZSxwbGF0ZSxnYXJhZ2UsbW9kcyxzdGF0ZSxkZXBvdHByaWNlIEZST00gcGxheWVyX3ZlaGljbGVzIFdIRVJFIGNpdGl6ZW5pZCA9ID9gLCBbY2l0aXplbklkXSkgYXMgVmVoaWNsZURhdGFbXTtcbiAgICBjb25zdCB2ZWhpY2xlRGF0YSA9IEZyYW1ld29yay5TaGFyZWQuVmVoaWNsZXM7XG4gICAgXG4gICAgZm9yIChjb25zdCB2ZWhpY2xlIG9mIHJlcykge1xuICAgICAgICBjb25zdCBkYXRhID0gdmVoaWNsZURhdGFbdmVoaWNsZS52ZWhpY2xlXTtcbiAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgIC8vIERldGVybWluZSB2ZWhpY2xlIHN0YXRlIHdpdGggYmV0dGVyIGxvZ2ljXG4gICAgICAgICAgICBsZXQgc3RhdGU6IHN0cmluZztcbiAgICAgICAgICAgIGlmICh2ZWhpY2xlLnN0YXRlID09PSAyKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBcIkltcG91bmRlZFwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2ZWhpY2xlLnN0YXRlID09PSAxKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBcIlBhcmtlZFwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChOdW1iZXIodmVoaWNsZS5kZXBvdHByaWNlKSA+IDApIHtcbiAgICAgICAgICAgICAgICBzdGF0ZSA9IFwiRGVwb3RcIjsgLy8gQ2hhbmdlZCBmcm9tIFwiRGVwb3RlZFwiIHRvIFwiRGVwb3RcIiBhcyByZXF1ZXN0ZWRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBcIk91dFwiO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXNEYXRhLnB1c2goe1xuICAgICAgICAgICAgICAgIHBsYXRlOiB2ZWhpY2xlLnBsYXRlLFxuICAgICAgICAgICAgICAgIGdhcmFnZTogdmVoaWNsZS5nYXJhZ2UsXG4gICAgICAgICAgICAgICAgc3RhdGU6IHN0YXRlLFxuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiBkYXRhLmNhdGVnb3J5LFxuICAgICAgICAgICAgICAgIGJyYW5kOiBkYXRhLmJyYW5kLFxuICAgICAgICAgICAgICAgIG5hbWU6IGRhdGEubmFtZSxcbiAgICAgICAgICAgICAgICB0dXJib0luc3RhbGxlZDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZFR1cmJvLFxuICAgICAgICAgICAgICAgIGJvZHlIZWFsdGg6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5ib2R5SGVhbHRoLFxuICAgICAgICAgICAgICAgIHRhbmtIZWFsdGg6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS50YW5rSGVhbHRoLFxuICAgICAgICAgICAgICAgIGZ1ZWxMZXZlbDogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLmZ1ZWxMZXZlbCxcbiAgICAgICAgICAgICAgICBlbmdpbmVIZWFsdGg6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5lbmdpbmVIZWFsdGgsXG4gICAgICAgICAgICAgICAgbW9kU3VzcGVuc2lvbjogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZFN1c3BlbnNpb24sXG4gICAgICAgICAgICAgICAgbW9kVHJhbnNtaXNzaW9uOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kVHJhbnNtaXNzaW9uLFxuICAgICAgICAgICAgICAgIG1vZEVuZ2luZTogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZEVuZ2luZSxcbiAgICAgICAgICAgICAgICBtb2RCcmFrZXM6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RCcmFrZXMsXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXNEYXRhKTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgV2FsbGV0QWNjb3VudCB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgRGF0ZVRpbWUgfSBmcm9tICdsdXhvbic7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5mdW5jdGlvbiBHZW5lcmF0ZUNhcmROdW1iZXIoKSB7XG4gICAgbGV0IGNhcmROdW1iZXIgPSAnJztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcbiAgICAgICAgY2FyZE51bWJlciArPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMCk7XG4gICAgfVxuICAgIHJldHVybiBjYXJkTnVtYmVyO1xufVxuXG5mdW5jdGlvbiBHZW5lcmF0ZUJhbmtBY2NvdW50TnVtYmVyKCkge1xuICAgIGNvbnN0IGluaXRpYWxzID0gXCJTTVJUXCI7XG4gICAgbGV0IGFjY291bnROdW1iZXIgPSAnJztcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAgICAgYWNjb3VudE51bWJlciArPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMCk7XG4gICAgfVxuICAgIHJldHVybiBgJHtpbml0aWFsc31fJHthY2NvdW50TnVtYmVyfWA7XG59XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpsb2dpbicsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc291cmNlKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2JhbmtfdXNlcicsIHsgY2l0aXplbklkOiBjaXRpemVuSWQuUGxheWVyRGF0YS5jaXRpemVuaWQgfSk7XG4gICAgaWYgKHJlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgLi4ucmVzLFxuICAgICAgICAgICAgYmFsYW5jZTogYXdhaXQgY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuYmFuayxcbiAgICAgICAgICAgIGNhc2lubzogYXdhaXQgY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuY2FzaW5vXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpO1xuICAgICAgICBjb25zdCBjYXJkTnVtYmVyID0gR2VuZXJhdGVDYXJkTnVtYmVyKCk7XG4gICAgICAgIGNvbnN0IGNhcmRQaW4gPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMCk7XG4gICAgICAgIGNvbnN0IGJhbmtBY2NvdW50ID0gR2VuZXJhdGVCYW5rQWNjb3VudE51bWJlcigpO1xuICAgICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogY2l0aXplbklkLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgICAgIGNhcmROdW1iZXI6IGNhcmROdW1iZXIsXG4gICAgICAgICAgICBjYXJkUGluOiBjYXJkUGluLFxuICAgICAgICAgICAgYmFua0FjY291bnQ6IGJhbmtBY2NvdW50LFxuICAgICAgICAgICAgYmFsYW5jZTogMFxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9iYW5rX3VzZXInLCBkYXRhKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIC4uLmRhdGEsXG4gICAgICAgICAgICBiYWxhbmNlOiBjaXRpemVuSWQuUGxheWVyRGF0YS5tb25leS5iYW5rLFxuICAgICAgICAgICAgY2FzaW5vOiBjaXRpemVuSWQuUGxheWVyRGF0YS5tb25leS5jYXNpbm9cbiAgICAgICAgfSk7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldERldGFpbHNYUycsIGFzeW5jIChjbGllbnQsIG51bWJlcikgPT4ge1xuICAgIGxldCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKFN0cmluZyhudW1iZXIpKTtcbiAgICBpZiAoY2l0aXplbklkKSB7XG4gICAgICAgIGNvbnN0IHJlczogV2FsbGV0QWNjb3VudCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmFua191c2VyJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgcmV0dXJuIHJlcy5iYW5rQWNjb3VudDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd0cmFuc1hBZHFhc2RkYXNkZmVyTW9uZXknLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGFtb3VudCwgdG8gfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzOiBXYWxsZXRBY2NvdW50ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9iYW5rX3VzZXInLCB7IGJhbmtBY2NvdW50OiB0byB9KTtcbiAgICBpZiAoIXJlcykgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IHRhcmdldFBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZXMuY2l0aXplbklkKTtcbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKGNsaWVudCk7XG4gICAgaWYgKCFhd2FpdCBEb2VzUGxheWVyRXhpc3QodGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlKSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5tb25leS5iYW5rIDwgYW1vdW50KSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGF3YWl0IHNvdXJjZVBsYXllci5GdW5jdGlvbnMuUmVtb3ZlTW9uZXkoJ2JhbmsnLCBhbW91bnQpKSB7XG4gICAgICAgIHRhcmdldFBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoJ2JhbmsnLCBhbW91bnQpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiAnV2FsbGV0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgdHJhbnNmZXJyZWQgJCR7YW1vdW50fSB0byAke3Jlcy5uYW1lfS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdXYWxsZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSByZWNlaXZlZCAkJHthbW91bnR9IGZyb20gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9LmAsXG4gICAgICAgICAgICBhcHA6ICdzZXR0aW5ncycsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgIH0pKTtcblxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmFua190cmFuc2FjdGlvbnMnLCB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgZnJvbTogc291cmNlUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgdG86IHJlcy5jaXRpemVuSWQsXG4gICAgICAgICAgICBhbW91bnQ6IGFtb3VudCxcbiAgICAgICAgICAgIHR5cGU6ICdkZWJpdCcsXG4gICAgICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9iYW5rX3RyYW5zYWN0aW9ucycsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBmcm9tOiByZXMuY2l0aXplbklkLFxuICAgICAgICAgICAgdG86IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgIGFtb3VudDogYW1vdW50LFxuICAgICAgICAgICAgdHlwZTogJ2NyZWRpdCcsXG4gICAgICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2JhbmtfdHJhbnNhY3Rpb25zJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTW9uZXkgVHJhbnNmZXInLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgdHJhbnNmZXJyZWQgJCR7YW1vdW50fSB0byAke3Jlcy5uYW1lfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRUcmFuc2FjdGlvbnMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCB0cmFuc2FjdGlvbnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9iYW5rX3RyYW5zYWN0aW9ucycsIHsgZnJvbTogY2l0aXplbklkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgIHNvcnQ6IHsgZGF0ZTogLTEgfVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh0cmFuc2FjdGlvbnMpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpjcmVhdGVJbnZvaWNlJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBkZXNjcmlwdGlvbiwgYW1vdW50LCBwYXltZW50VGltZSwgbnVtYmVyT2ZQYXltZW50cywgaXNCdXNpbmVzcywgcmVjZWl2ZXIsIH0gPSBKU09OLnBhcnNlKGRhdGEpIGFzIHtcbiAgICAgICAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgICAgICAgYW1vdW50OiBudW1iZXI7XG4gICAgICAgIHBheW1lbnRUaW1lOiBudW1iZXI7XG4gICAgICAgIG51bWJlck9mUGF5bWVudHM6IG51bWJlcjtcbiAgICAgICAgaXNCdXNpbmVzczogJ05vJyB8ICdZZXMnO1xuICAgICAgICByZWNlaXZlcjogc3RyaW5nO1xuICAgIH07IC8vIHBheW1lbnRUaW1lID0gMCBmb3IgZGFpbHksIDEgZm9yIHdlZWtseSwgMiBmb3IgbW9udGhseSBhbmQgMyBmb3IgcXVhcnRlcmx5IGFuZCA0IGZvciB5ZWFybHlcblxuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoY2xpZW50KTtcbiAgICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHJlY2VpdmVyKTtcbiAgICBpZiAoIXRhcmdldFBsYXllcikgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChhbW91bnQgPCAwKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JhbmtfaW52b2ljZXMnLCB7XG4gICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIGZyb206IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgdG86IHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgYW1vdW50OiBhbW91bnQsXG4gICAgICAgIHN0YXR1czogJ3BlbmRpbmcnLFxuICAgICAgICBpc0J1c2luZXNzLFxuICAgICAgICBzb3VyY2VOYW1lOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCxcbiAgICAgICAgdGFyZ2V0TmFtZTogYCR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbixcbiAgICAgICAgcGF5bWVudFRpbWU6IHBheW1lbnRUaW1lLFxuICAgICAgICBudW1iZXJPZlBheW1lbnRzOiBudW1iZXJPZlBheW1lbnRzLFxuICAgICAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9KTtcbiAgICBpZiAocmVzKSB7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdXYWxsZXQnLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIHNlbnQgeW91IGFuIGludm9pY2Ugb2YgJCR7YW1vdW50fS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2JhbmtfaW52b2ljZXMnLFxuICAgICAgICAgICAgdGl0bGU6ICdJbnZvaWNlIENyZWF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgc2VudCBhbiBpbnZvaWNlIG9mICQke2Ftb3VudH0gdG8gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDpnZXRJbnZvaWNlcycsIGFzeW5jIChjbGllbnQsIHR5cGUpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGlmICh0eXBlID09PSAnc2VudCcpIHtcbiAgICAgICAgY29uc3QgaW52b2ljZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9iYW5rX2ludm9pY2VzJywgeyBmcm9tOiBjaXRpemVuSWQgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgZGF0ZTogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGludm9pY2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBpbnZvaWNlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2JhbmtfaW52b2ljZXMnLCB7IHRvOiBjaXRpemVuSWQgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgZGF0ZTogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGludm9pY2VzKTtcbiAgICB9XG59KTtcblxudHlwZSBSZWN1cnJlbmNlID0gMCB8IDEgfCAyIHwgMyB8IDQ7IC8vIGRhaWx5LCB3ZWVrbHksIG1vbnRobHksIHF1YXJ0ZXJseSwgeWVhcmx5XG5cbmludGVyZmFjZSBQaG9uZUJhbmtJbnZvaWNlRG9jIHtcbiAgICBfaWQ6IHN0cmluZztcbiAgICBmcm9tOiBzdHJpbmc7IC8vIGNpdGl6ZW5pZCBvZiBzZW5kZXIgKHRoZSBwZXJzb24vYnVzaW5lc3MgcmVxdWVzdGluZyBtb25leSlcbiAgICB0bzogc3RyaW5nOyAgIC8vIGNpdGl6ZW5pZCBvZiB0YXJnZXQgKHRoZSBwZXJzb24gd2hvIHBheXMgd2hlbiBhY2NlcHRpbmcpXG4gICAgYW1vdW50OiBudW1iZXI7XG4gICAgdGFyZ2V0TmFtZTogc3RyaW5nO1xuICAgIHNvdXJjZU5hbWU6IHN0cmluZztcbiAgICBzdGF0dXM6ICdwZW5kaW5nJyB8ICdhY3RpdmUnIHwgJ3BhaWQnIHwgJ2NvbXBsZXRlZCcgfCAnZGVjbGluZWQnIHwgJ292ZXJkdWUnO1xuICAgIGlzQnVzaW5lc3M6ICdObycgfCAnWWVzJztcbiAgICBwYXltZW50VGltZTogUmVjdXJyZW5jZSB8ICcnOyAvLyAnJyBtZWFucyBvbmUtdGltZSwgZWxzZSByZWN1cnJlbmNlIGNvZGVcbiAgICBudW1iZXJPZlBheW1lbnRzOiBudW1iZXIgfCAnJzsvLyAnJyBtZWFucyBvbmUtdGltZSwgZWxzZSB0b3RhbCBwYXltZW50c1xuICAgIHJlbWFpbmluZ1BheW1lbnRzPzogbnVtYmVyOyAgIC8vIG1haW50YWluZWQgZm9yIHJlY3VycmluZ1xuICAgIG5leHRQYXltZW50RGF0ZT86IHN0cmluZyB8IG51bGw7IC8vIElTT1xuICAgIGxhc3RBdHRlbXB0QXQ/OiBzdHJpbmcgfCBudWxsOyAgIC8vIElTT1xuICAgIGZhaWxlZEF0dGVtcHRzPzogbnVtYmVyO1xuICAgIGNyZWF0ZWRBdD86IHN0cmluZzsgLy8gSVNPXG4gICAgZGF0ZT86IHN0cmluZzsgLy8geW91ciBvcmlnaW5hbCBmaWVsZFxufVxuXG5jb25zdCBDT0xMRUNUSU9OID0gJ3Bob25lX2JhbmtfaW52b2ljZXMnO1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIFFCIGhlbHBlcnMgKGFkanVzdCBpZiB5b3VyIGV4cG9ydHMgZGlmZmVyKVxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5jb25zdCBnZXRQbGF5ZXJCeVNvdXJjZSA9IGFzeW5jIChzcmM6IG51bWJlcikgPT4gZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzcmMpO1xuY29uc3QgZ2V0UGxheWVyQnlDaXRpemVuSWQgPSBhc3luYyAoY2lkOiBzdHJpbmcpID0+IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZD8uKGNpZCk7XG5cbi8vIE1vbmV5IG9wczogcmV0dXJuIGJvb2xlYW4gc3VjY2Vzc1xuY29uc3QgZGViaXRCYW5rID0gKHBsYXllcjogYW55LCBhbW91bnQ6IG51bWJlcikgPT4gcGxheWVyPy5GdW5jdGlvbnM/LlJlbW92ZU1vbmV5Py4oJ2JhbmsnLCBhbW91bnQsICdpbnZvaWNlX3BheW1lbnQnKSA/PyBmYWxzZTtcbmNvbnN0IGNyZWRpdEJhbmsgPSAocGxheWVyOiBhbnksIGFtb3VudDogbnVtYmVyKSA9PiBwbGF5ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KCdiYW5rJywgYW1vdW50LCAnaW52b2ljZV9yZWNlaXZlZCcpID8/IGZhbHNlO1xuXG5jb25zdCBub3RpZnkgPSAoc3JjOiBudW1iZXIsIHRpdGxlOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIHRpbWVvdXQgPSA1MDAwKSA9PiB7XG4gICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgc3JjLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGUsIGRlc2NyaXB0aW9uLCBhcHA6ICdzZXR0aW5ncycsIHRpbWVvdXRcbiAgICB9KSk7XG59O1xuXG5jb25zdCBub3dJU08gPSAoKSA9PiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbmNvbnN0IGFkZEludGVydmFsID0gKGlzbzogc3RyaW5nLCByZWM6IFJlY3VycmVuY2UpOiBzdHJpbmcgPT4ge1xuICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShpc28pO1xuICAgIHN3aXRjaCAocmVjKSB7XG4gICAgICAgIGNhc2UgMDogZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSk7IGJyZWFrOyAgICAgICAvLyBkYWlseVxuICAgICAgICBjYXNlIDE6IGQuc2V0RGF0ZShkLmdldERhdGUoKSArIDcpOyBicmVhazsgICAgICAgLy8gd2Vla2x5XG4gICAgICAgIGNhc2UgMjogZC5zZXRNb250aChkLmdldE1vbnRoKCkgKyAxKTsgYnJlYWs7ICAgICAvLyBtb250aGx5XG4gICAgICAgIGNhc2UgMzogZC5zZXRNb250aChkLmdldE1vbnRoKCkgKyAzKTsgYnJlYWs7ICAgICAvLyBxdWFydGVybHlcbiAgICAgICAgY2FzZSA0OiBkLnNldEZ1bGxZZWFyKGQuZ2V0RnVsbFllYXIoKSArIDEpOyBicmVhazsgLy8geWVhcmx5XG4gICAgfVxuICAgIHJldHVybiBkLnRvSVNPU3RyaW5nKCk7XG59O1xuXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8vIEJ1c2luZXNzIHNhZmUgZGVwb3NpdCAoY3VzdG9taXplIGZvciB5b3VyIGZyYW1ld29yaylcbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuLyoqXG4gKiBUcnkgdG8gZGVwb3NpdCBpbnRvIGEgYnVzaW5lc3MgbWFuYWdlbWVudCBzYWZlLlxuICogU3RyYXRlZ3k6XG4gKiAgIC0gSWYgdGhlIHBheWVyIGlzIHBheWluZyB0byBhIGJ1c2luZXNzIChpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnKSxcbiAqICAgICB3ZSBkZXBvc2l0IHRoZSBtb25leSBpbnRvIHRoZSBSRUNFSVZFUidzIGpvYiBzYWZlLlxuICogICAtIFlvdSBtaWdodCB3YW50IHRvIGNoYW5nZSB0aGlzIHRvIGEgc3BlY2lmaWMgYnVzaW5lc3MgaWQgb24gdGhlIGludm9pY2UsXG4gKiAgICAgb3IgYSBwcm92aWRlZCBvcmcga2V5LiBFZGl0IGFzIG5lZWRlZC5cbiAqL1xuY29uc3QgZGVwb3NpdFRvTWFuYWdlbWVudFNhZmUgPSBhc3luYyAocmVjZWl2ZXJDaXRpemVuSWQ6IHN0cmluZywgYW1vdW50OiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+ID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZWNlaXZlciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKHJlY2VpdmVyQ2l0aXplbklkKTtcbiAgICAgICAgY29uc3Qgam9iTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkID0gcmVjZWl2ZXI/LlBsYXllckRhdGE/LmpvYj8ubmFtZTtcbiAgICAgICAgY29uc3QgUGxheWVyTmFtZSA9IHJlY2VpdmVyID8gYCR7cmVjZWl2ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7cmVjZWl2ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gIDogJ1Vua25vd24nO1xuICAgICAgICAvLyBUT0RPOiBVcGRhdGUgdGhpcyB0byB5b3VyIGFjdHVhbCBtYW5hZ2VtZW50IHJlc291cmNlIEFQSTpcbiAgICAgICAgLy8gQ29tbW9uIFFCQ29yZSBlY29zeXN0ZW0gdXNlcyBxYi1tYW5hZ2VtZW50OiBBZGRNb25leShqb2JOYW1lLCBhbW91bnQpXG4gICAgICAgIGlmIChqb2JOYW1lKSB7XG4gICAgICAgICAgICBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5hZGRBY2NvdW50TW9uZXkoam9iTmFtZSwgYW1vdW50KTtcbiAgICAgICAgICAgIC8qIGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGFjY291bnQsIHRpdGxlLCBhbW91bnQsIG1lc3NhZ2UsIGlzc3VlciwgcmVjZWl2ZXIsIHRyYW5zVHlwZSwgdHJhbnNJRCkgKi9cbiAgICAgICAgICAgIGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGpvYk5hbWUsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIERlcG9zaXRcIiwgYW1vdW50LCBcIkRlcG9zaXQgZnJvbSBlbXBsb3llZSB0byBtYW5hZ2VtZW50IHNhZmUuXCIsIGpvYk5hbWUsIFBsYXllck5hbWUsICdkZXBvc2l0JywgZ2VuZXJhdGVVVWlkKCkpXG4gICAgICAgICAgICBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihqb2JOYW1lLCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0XCIsIGFtb3VudCwgXCJEZXBvc2l0ZWQgdG8gbWFuYWdlbWVudCBzYWZlLlwiLCBQbGF5ZXJOYW1lLCBqb2JOYW1lLCAnd2l0aGRyYXcnLCBnZW5lcmF0ZVVVaWQoKSlcblxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVjZWl2ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBjcmVkaXRCYW5rKHJlY2VpdmVyLCBhbW91bnQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ2RlcG9zaXRUb01hbmFnZW1lbnRTYWZlIGVycm9yOicsIGUpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufTtcblxuLy8gQmFuayBzdGF0ZW1lbnQgLyBsb2dnaW5nIChvcHRpb25hbCBob29rIHBvaW50KVxuY29uc3QgbG9nQmFua0V2ZW50ID0gKHR5cGU6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSA9PiBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfYmFua19pbnZvaWNlcycsXG4gICAgdGl0bGU6IHR5cGUsXG4gICAgbWVzc2FnZSxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG59KTtcblxub25DbGllbnRDYWxsYmFjaygnd2FsbGV0OmFjY2VwdEludm9pY2VQYXltZW50JywgYXN5bmMgKGNsaWVudDogbnVtYmVyLCBpZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGF5ZXJQbGF5ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeVNvdXJjZShjbGllbnQpOyAvLyB0aGUgb25lIGNsaWNraW5nIFwiYWNjZXB0XCIgKG11c3QgZXF1YWwgaW52b2ljZS50bylcbiAgICBpZiAoIXBheWVyUGxheWVyKSByZXR1cm4gZmFsc2U7XG5cbiAgICBjb25zdCBwYXllckNpZDogc3RyaW5nID0gcGF5ZXJQbGF5ZXIuUGxheWVyRGF0YT8uY2l0aXplbmlkO1xuICAgIGNvbnN0IGludm9pY2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0pIGFzIFBob25lQmFua0ludm9pY2VEb2M7XG4gICAgaWYgKCFpbnZvaWNlKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBTYWZldHkgY2hlY2tzXG4gICAgaWYgKGludm9pY2UudG8gIT09IHBheWVyQ2lkKSByZXR1cm4gZmFsc2U7ICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBub3QgeW91ciBpbnZvaWNlXG4gICAgaWYgKGludm9pY2Uuc3RhdHVzICE9PSAncGVuZGluZycgJiYgaW52b2ljZS5zdGF0dXMgIT09ICdhY3RpdmUnICYmIGludm9pY2Uuc3RhdHVzICE9PSAnb3ZlcmR1ZScpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5hbW91bnQgPD0gMCkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChpbnZvaWNlLmZyb20gPT09IGludm9pY2UudG8pIHJldHVybiBmYWxzZTsgICAgICAgICAgICAgICAgICAgICAgLy8gc2VsZi1pbnZvaWNlIHNpbGxpbmVzc1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS5mcm9tKTtcblxuICAgIGNvbnN0IGNoYXJnZWQgPSBkZWJpdEJhbmsocGF5ZXJQbGF5ZXIsIGludm9pY2UuYW1vdW50KTtcbiAgICBpZiAoIWNoYXJnZWQpIHtcbiAgICAgICAgLy8gQ291bGRuXHUyMDE5dCBjaGFyZ2UgLT4gb3ZlcmR1ZSBmb3IgcmVjdXJyaW5nIG9yIGtlZXAgcGVuZGluZyBmb3Igb25lLXRpbWU/XG4gICAgICAgIGNvbnN0IGlzUmVjdXJyaW5nID0gaW52b2ljZS5wYXltZW50VGltZSAhPT0gJycgJiYgaW52b2ljZS5udW1iZXJPZlBheW1lbnRzICE9PSAnJztcbiAgICAgICAgaWYgKGlzUmVjdXJyaW5nKSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSwge1xuICAgICAgICAgICAgICAgIHN0YXR1czogJ292ZXJkdWUnLFxuICAgICAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLFxuICAgICAgICAgICAgICAgIGZhaWxlZEF0dGVtcHRzOiAoaW52b2ljZS5mYWlsZWRBdHRlbXB0cyA/PyAwKSArIDFcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIG5vdGlmeShwYXllclBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBJbnN1ZmZpY2llbnQgZnVuZHMgdG8gcGF5ICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFBheW91dFxuICAgIGxldCBwYXlvdXRPayA9IGZhbHNlO1xuICAgIGlmIChpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnKSB7XG4gICAgICAgIGNvbnN0IGNvbW1pc3Npb24gPSAwLjE7XG4gICAgICAgIGNvbnN0IGNvbW1pc3Npb25BbW91bnQgPSBNYXRoLnJvdW5kKGludm9pY2UuYW1vdW50ICogY29tbWlzc2lvbik7XG4gICAgICAgIGNvbnN0IHBheW91dEFtb3VudCA9IE1hdGgucm91bmQoaW52b2ljZS5hbW91bnQgLSBjb21taXNzaW9uQW1vdW50KTtcbiAgICAgICAgcGF5b3V0T2sgPSBhd2FpdCBkZXBvc2l0VG9NYW5hZ2VtZW50U2FmZShpbnZvaWNlLmZyb20sIHBheW91dEFtb3VudCk7XG4gICAgICAgIHJlcXVlc3Rlci5GdW5jdGlvbnMuQWRkTW9uZXkoJ2JhbmsnLCBjb21taXNzaW9uQW1vdW50LCAnaW52b2ljZV9yZWNlaXZlZCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBheW91dE9rID0gcmVxdWVzdGVyID8gY3JlZGl0QmFuayhyZXF1ZXN0ZXIsIGludm9pY2UuYW1vdW50KSA6IGZhbHNlO1xuICAgIH1cblxuICAgIGlmICghcGF5b3V0T2spIHtcbiAgICAgICAgLy8gUmVmdW5kIHBheWVyIHNpbmNlIHBheW91dCBmYWlsZWRcbiAgICAgICAgY3JlZGl0QmFuayhwYXllclBsYXllciwgaW52b2ljZS5hbW91bnQpO1xuICAgICAgICBub3RpZnkocGF5ZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgUGF5bWVudCBmYWlsZWQgdG8gZGVsaXZlci4gUmVmdW5kZWQgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gVXBkYXRlIGludm9pY2Ugc3RhdHVzXG4gICAgY29uc3QgaXNSZWN1cnJpbmcgPSAoaW52b2ljZS5wYXltZW50VGltZSAhPT0gJycgJiYgaW52b2ljZS5udW1iZXJPZlBheW1lbnRzICE9PSAnJyk7XG4gICAgaWYgKCFpc1JlY3VycmluZykge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSwge1xuICAgICAgICAgICAgc3RhdHVzOiAncGFpZCcsXG4gICAgICAgICAgICBuZXh0UGF5bWVudERhdGU6IG51bGwsXG4gICAgICAgICAgICByZW1haW5pbmdQYXltZW50czogMCxcbiAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHRvdGFsID0gTnVtYmVyKGludm9pY2UubnVtYmVyT2ZQYXltZW50cyk7XG4gICAgICAgIGNvbnN0IHByZXZSZW1haW5pbmcgPSAoaW52b2ljZS5yZW1haW5pbmdQYXltZW50cyA9PSBudWxsKVxuICAgICAgICAgICAgPyB0b3RhbCAgICAgICAgICAgICAgICAvLyBmaXJzdCB0aW1lIGFjdGl2YXRpb25cbiAgICAgICAgICAgIDogaW52b2ljZS5yZW1haW5pbmdQYXltZW50cztcblxuICAgICAgICBjb25zdCBuZXdSZW1haW5pbmcgPSBNYXRoLm1heCgwLCBwcmV2UmVtYWluaW5nIC0gMSk7XG5cbiAgICAgICAgbGV0IG5ld1N0YXR1czogUGhvbmVCYW5rSW52b2ljZURvY1snc3RhdHVzJ10gPSAnYWN0aXZlJztcbiAgICAgICAgbGV0IG5leHREYXRlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICAgICAgaWYgKG5ld1JlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgICAgICBuZXdTdGF0dXMgPSAnY29tcGxldGVkJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGJhc2VEYXRlID0gaW52b2ljZS5uZXh0UGF5bWVudERhdGUgPz8gbm93SVNPKCk7XG4gICAgICAgICAgICBuZXh0RGF0ZSA9IGFkZEludGVydmFsKGJhc2VEYXRlLCBOdW1iZXIoaW52b2ljZS5wYXltZW50VGltZSkgYXMgUmVjdXJyZW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSwge1xuICAgICAgICAgICAgc3RhdHVzOiBuZXdTdGF0dXMsXG4gICAgICAgICAgICByZW1haW5pbmdQYXltZW50czogbmV3UmVtYWluaW5nLFxuICAgICAgICAgICAgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksXG4gICAgICAgICAgICBuZXh0UGF5bWVudERhdGU6IG5leHREYXRlLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBpbnZvaWNlLmNyZWF0ZWRBdCA/PyBub3dJU08oKVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBOb3RpZnkgYm90aCBzaWRlc1xuICAgIG5vdGlmeShwYXllclBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBQYWlkICQke2ludm9pY2UuYW1vdW50fSB0byAke2ludm9pY2Uuc291cmNlTmFtZX0uYCk7XG4gICAgaWYgKHJlcXVlc3Rlcj8uUGxheWVyRGF0YT8uc291cmNlKSB7XG4gICAgICAgIG5vdGlmeShyZXF1ZXN0ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IHBhaWQgeW91ciBpbnZvaWNlIG9mICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICB9XG5cbiAgICBsb2dCYW5rRXZlbnQoJ0ludm9pY2UgUGF5bWVudCcsIGAke2ludm9pY2UudGFyZ2V0TmFtZX0gcGFpZCAkJHtpbnZvaWNlLmFtb3VudH0gdG8gJHtpbnZvaWNlLnNvdXJjZU5hbWV9JHtpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnID8gJyAoYnVzaW5lc3MpJyA6ICcnfS5gKTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd3YWxsZXQ6ZGVjbGluZUludm9pY2VQYXltZW50JywgYXN5bmMgKGNsaWVudDogbnVtYmVyLCBpZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgZ2V0UGxheWVyQnlTb3VyY2UoY2xpZW50KTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgY2lkID0gcGxheWVyLlBsYXllckRhdGE/LmNpdGl6ZW5pZDtcbiAgICBjb25zdCBpbnZvaWNlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9KSBhcyBQaG9uZUJhbmtJbnZvaWNlRG9jO1xuICAgIGlmICghaW52b2ljZSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChpbnZvaWNlLnRvICE9PSBjaWQpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5zdGF0dXMgIT09ICdwZW5kaW5nJyAmJiBpbnZvaWNlLnN0YXR1cyAhPT0gJ2FjdGl2ZScgJiYgaW52b2ljZS5zdGF0dXMgIT09ICdvdmVyZHVlJykgcmV0dXJuIGZhbHNlO1xuXG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHsgc3RhdHVzOiAnZGVjbGluZWQnLCBuZXh0UGF5bWVudERhdGU6IG51bGwgfSk7XG5cbiAgICBjb25zdCByZXF1ZXN0ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZChpbnZvaWNlLmZyb20pO1xuICAgIG5vdGlmeShwbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgRGVjbGluZWQgaW52b2ljZSBvZiAkJHtpbnZvaWNlLmFtb3VudH0gZnJvbSAke2ludm9pY2Uuc291cmNlTmFtZX0uYCk7XG4gICAgaWYgKHJlcXVlc3Rlcj8uUGxheWVyRGF0YT8uc291cmNlKSB7XG4gICAgICAgIG5vdGlmeShyZXF1ZXN0ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IGRlY2xpbmVkIHlvdXIgaW52b2ljZSBvZiAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgfVxuXG4gICAgbG9nQmFua0V2ZW50KCdJbnZvaWNlIERlY2xpbmVkJywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBkZWNsaW5lZCBpbnZvaWNlIGZyb20gJHtpbnZvaWNlLnNvdXJjZU5hbWV9IGZvciAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxuXG5leHBvcnQgY29uc3QgSW52b2ljZVJlY3VycmluZ1BheW1lbnRzID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcblxuICAgIGNvbnN0IGR1ZUludm9pY2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcbiAgICAgICAgQ09MTEVDVElPTixcbiAgICAgICAge1xuICAgICAgICAgICAgc3RhdHVzOiB7ICRpbjogWydhY3RpdmUnLCAnb3ZlcmR1ZSddIH0sXG4gICAgICAgICAgICBuZXh0UGF5bWVudERhdGU6IHsgJGx0ZTogbm93IH0sXG4gICAgICAgICAgICByZW1haW5pbmdQYXltZW50czogeyAkZ3Q6IDAgfVxuICAgICAgICB9LFxuICAgICAgICBudWxsLFxuICAgICAgICBmYWxzZSxcbiAgICAgICAgeyBzb3J0OiB7IG5leHRQYXltZW50RGF0ZTogMSB9LCBsaW1pdDogNTAgfSAvLyBwcm9jZXNzIGluIGJhdGNoZXNcbiAgICApIGFzIFBob25lQmFua0ludm9pY2VEb2NbXTtcblxuICAgIGZvciAoY29uc3QgaW52b2ljZSBvZiBkdWVJbnZvaWNlcykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGF5ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZChpbnZvaWNlLnRvKTtcbiAgICAgICAgICAgIGlmICghcGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAvLyBQYXllciBvZmZsaW5lIFx1MjAxNCBjaG9vc2UgeW91ciBwb2xpY3kuIFdlJ2xsIGp1c3QgbWFyayBhdHRlbXB0IGFuZCByZXRyeSBsYXRlci5cbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwge1xuICAgICAgICAgICAgICAgICAgICAkc2V0OiB7IGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLCBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxLCBzdGF0dXM6ICdvdmVyZHVlJyB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFRyeSB0byBjaGFyZ2UgdmlhIHRoZSBzYW1lIGFjY2VwdCBsb2dpYyBjb3JlIChEUlktaXNoIHdpdGggYSB0aW55IGludGVybmFsIGNhbGwpXG4gICAgICAgICAgICAvLyBXZSBpbmxpbmUgbWluaW1hbCBsb2dpYzogZGViaXQgcGF5ZXJcbiAgICAgICAgICAgIGNvbnN0IGNoYXJnZWQgPSBkZWJpdEJhbmsocGF5ZXIsIGludm9pY2UuYW1vdW50KTtcbiAgICAgICAgICAgIGlmICghY2hhcmdlZCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpbnZvaWNlLl9pZCB9LCB7IGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLCBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxLCBzdGF0dXM6ICdvdmVyZHVlJyB9KTtcbiAgICAgICAgICAgICAgICBub3RpZnkocGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgUmVjdXJyaW5nIGludm9pY2Ugb2YgJCR7aW52b2ljZS5hbW91bnR9IGZhaWxlZCAoaW5zdWZmaWNpZW50IGZ1bmRzKS5gKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUGF5b3V0XG4gICAgICAgICAgICBsZXQgcGF5b3V0T2sgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnKSB7XG4gICAgICAgICAgICAgICAgcGF5b3V0T2sgPSBhd2FpdCBkZXBvc2l0VG9NYW5hZ2VtZW50U2FmZShpbnZvaWNlLmZyb20sIGludm9pY2UuYW1vdW50KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVxdWVzdGVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS5mcm9tKTtcbiAgICAgICAgICAgICAgICBwYXlvdXRPayA9IHJlcXVlc3RlciA/IGNyZWRpdEJhbmsocmVxdWVzdGVyLCBpbnZvaWNlLmFtb3VudCkgOiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFwYXlvdXRPaykge1xuICAgICAgICAgICAgICAgIC8vIFJlZnVuZFxuICAgICAgICAgICAgICAgIGNyZWRpdEJhbmsocGF5ZXIsIGludm9pY2UuYW1vdW50KTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwgeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSB9KTtcbiAgICAgICAgICAgICAgICBub3RpZnkocGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgUmVjdXJyaW5nIGludm9pY2UgcGF5b3V0IGZhaWxlZDsgcmVmdW5kZWQgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBQcm9ncmVzcyByZWN1cnJlbmNlXG4gICAgICAgICAgICBjb25zdCBuZXdSZW1haW5pbmcgPSBNYXRoLm1heCgwLCAoaW52b2ljZS5yZW1haW5pbmdQYXltZW50cyA/PyBOdW1iZXIoaW52b2ljZS5udW1iZXJPZlBheW1lbnRzKSkgLSAxKTtcbiAgICAgICAgICAgIGxldCBuZXdTdGF0dXM6IFBob25lQmFua0ludm9pY2VEb2NbJ3N0YXR1cyddID0gJ2FjdGl2ZSc7XG4gICAgICAgICAgICBsZXQgbmV4dERhdGU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG4gICAgICAgICAgICBpZiAobmV3UmVtYWluaW5nIDw9IDApIHtcbiAgICAgICAgICAgICAgICBuZXdTdGF0dXMgPSAnY29tcGxldGVkJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYmFzZSA9IGludm9pY2UubmV4dFBheW1lbnREYXRlID8/IG5vd0lTTygpO1xuICAgICAgICAgICAgICAgIG5leHREYXRlID0gYWRkSW50ZXJ2YWwoYmFzZSwgTnVtYmVyKGludm9pY2UucGF5bWVudFRpbWUpIGFzIFJlY3VycmVuY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwge1xuICAgICAgICAgICAgICAgIHJlbWFpbmluZ1BheW1lbnRzOiBuZXdSZW1haW5pbmcsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiBuZXdTdGF0dXMsXG4gICAgICAgICAgICAgICAgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksXG4gICAgICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiBuZXh0RGF0ZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIG5vdGlmeShwYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgJ1dhbGxldCcsIGBDaGFyZ2VkICQke2ludm9pY2UuYW1vdW50fSBmb3IgcmVjdXJyaW5nIGludm9pY2UgKCR7bmV3UmVtYWluaW5nfSBsZWZ0KS5gKTtcbiAgICAgICAgICAgIGxvZ0JhbmtFdmVudCgnUmVjdXJyaW5nIEludm9pY2UgUGF5bWVudCcsIGAke2ludm9pY2UudGFyZ2V0TmFtZX0gcGFpZCAkJHtpbnZvaWNlLmFtb3VudH0gdG8gJHtpbnZvaWNlLnNvdXJjZU5hbWV9JHtpbnZvaWNlLmlzQnVzaW5lc3MgPT09ICdZZXMnID8gJyAoYnVzaW5lc3MpJyA6ICcnfS5gKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignUmVjdXJyaW5nIHBheW1lbnQgZXJyb3IgZm9yJywgaW52b2ljZS5faWQsIGUpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHtcbiAgICAgICAgICAgICAgICAkc2V0OiB7IGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLCBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxufTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjaywgdHJpZ2dlckNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgRnJhbWV3b3JrLCBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dyb3VwczpnZXRtdWx0aVBsZUpvYnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgY29uc3Qgam9ic0RhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogc291cmNlUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkIH0pO1xuICAgIGNvbnN0IGN1cnJlbnRKb2IgPSBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5qb2IubmFtZTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBjdXJyZW50Sm9iLCBqb2JzRGF0YSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdncm91cHM6ZGVsZXRlTXVsdGlKb2InLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpO1xuICAgIGNvbnN0IGpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlqb2JzJyxcbiAgICAgICAgdGl0bGU6ICdKb2IgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke25hbWV9IGRlbGV0ZWQgam9iICR7am9iLmpvYk5hbWV9ICgke2pvYi5jaXRpemVuSWR9KWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdncm91cHM6Y2hhbmdlSm9iT2ZQbGF5ZXInLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgam9iTmFtZSwgZ3JhZGUgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgaWYgKCFqb2JOYW1lKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3Qgc291cmNlUGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghc291cmNlUGxheWVyKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5DaGVja0pvYkdyYWRlKGpvYk5hbWUsIFN0cmluZyhncmFkZSkpKSB7XG4gICAgICAgIHNvdXJjZVBsYXllci5GdW5jdGlvbnMuU2V0Sm9iKGpvYk5hbWUsIFN0cmluZyhncmFkZSkpO1xuICAgICAgICBlbWl0TmV0KCdRQkNvcmU6Tm90aWZ5Jywgc291cmNlLCBgSm9iIENoYW5nZWQgdG8gJHtqb2JOYW1lfSBTdWNjZXNzZnVsbHlgLCAnc3VjY2VzcycpO1xuICAgICAgICBlbWl0TmV0KCdncm91cHM6dG9nZ2xlRHV0eScsIE51bWJlcihzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UpKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlqb2JzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSm9iIENoYW5nZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBjaGFuZ2VkIGpvYiB0byAnJHtqb2JOYW1lfScgKEdyYWRlOiAke2dyYWRlfSkuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsIGpvYk5hbWUgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpam9icycsXG4gICAgICAgICAgICB0aXRsZTogJ0ludmFsaWQgSm9iIFJlbW92ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBhdHRlbXB0ZWQgdG8gY2hhbmdlIHRvIGludmFsaWQgam9iICcke2pvYk5hbWV9JywgcmVtb3ZlZCBmcm9tIG11bHRpLWpvYnMuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxuLy8gSW50ZXJmYWNlc1xuaW50ZXJmYWNlIFBsYXllckRhdGEge1xuICAgIFBsYXllckRhdGE6IHtcbiAgICAgICAgY2hhcmluZm86IHsgZmlyc3RuYW1lOiBzdHJpbmc7IGxhc3RuYW1lOiBzdHJpbmcgfTtcbiAgICAgICAgY2l0aXplbmlkOiBzdHJpbmc7XG4gICAgICAgIHNvdXJjZTogbnVtYmVyO1xuICAgIH07XG59XG5cbmludGVyZmFjZSBHcm91cE1lbWJlciB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIENJRDogc3RyaW5nO1xuICAgIFBsYXllcjogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgRW1wbG95bWVudEdyb3VwIHtcbiAgICBpZDogbnVtYmVyO1xuICAgIHN0YXR1czogc3RyaW5nO1xuICAgIEdOYW1lOiBzdHJpbmc7XG4gICAgR1Bhc3M6IHN0cmluZztcbiAgICBHTG9nbzogc3RyaW5nO1xuICAgIFVzZXJzOiBudW1iZXI7XG4gICAgbGVhZGVyOiBudW1iZXI7XG4gICAgbWVtYmVyczogR3JvdXBNZW1iZXJbXTtcbiAgICBzdGFnZTogYW55W107XG4gICAgU2NyaXB0Q3JlYXRlZD86IGJvb2xlYW47XG59IiwgImltcG9ydCB7IEZyYW1ld29yaywgTW9uZ29EQiB9IGZyb20gJ0BzZXJ2ZXIvc3ZfbWFpbic7XG5pbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSAnQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyJztcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gJ0BzaGFyZWQvdXRpbHMnO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7XG5cbmludGVyZmFjZSBIZWFydFN5bmNQcm9maWxlIHtcbiAgICBfaWQ/OiBzdHJpbmc7XG4gICAgY2l0aXplbklkOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGFnZTogbnVtYmVyO1xuICAgIGdlbmRlcjogc3RyaW5nO1xuICAgIGJpbzogc3RyaW5nO1xuICAgIHBob3Rvczogc3RyaW5nW107XG4gICAgaW50ZXJlc3RzOiBzdHJpbmdbXTtcbiAgICBsb29raW5nRm9yOiBzdHJpbmc7XG4gICAgaW50ZXJlc3RlZEluR2VuZGVyczogc3RyaW5nW107XG4gICAgYWdlUmFuZ2VNaW46IG51bWJlcjtcbiAgICBhZ2VSYW5nZU1heDogbnVtYmVyO1xuICAgIG1heERpc3RhbmNlOiBudW1iZXI7XG4gICAgc2hvd09ubGluZTogYm9vbGVhbjtcbiAgICBsb2NhdGlvbj86IHtcbiAgICAgICAgbGF0OiBudW1iZXI7XG4gICAgICAgIGxuZzogbnVtYmVyO1xuICAgICAgICBjaXR5OiBzdHJpbmc7XG4gICAgfTtcbiAgICB3b3JrPzogc3RyaW5nO1xuICAgIHNjaG9vbD86IHN0cmluZztcbiAgICBoZWlnaHQ/OiBudW1iZXI7XG4gICAgem9kaWFjU2lnbj86IHN0cmluZztcbiAgICBsaWZlc3R5bGU/OiB7XG4gICAgICAgIHNtb2tpbmc6IHN0cmluZztcbiAgICAgICAgZHJpbmtpbmc6IHN0cmluZztcbiAgICAgICAgZXhlcmNpc2U6IHN0cmluZztcbiAgICAgICAgcGV0czogc3RyaW5nO1xuICAgIH07XG4gICAgcHJvbXB0cz86IHtcbiAgICAgICAgcXVlc3Rpb246IHN0cmluZztcbiAgICAgICAgYW5zd2VyOiBzdHJpbmc7XG4gICAgfVtdO1xuICAgIHZlcmlmaWVkOiBib29sZWFuO1xuICAgIHByZW1pdW06IGJvb2xlYW47XG4gICAgc3VwZXJMaWtlc1JlbWFpbmluZzogbnVtYmVyO1xuICAgIGxpa2VzUmVtYWluaW5nOiBudW1iZXI7XG4gICAgZGFpbHlTd2lwZXM6IG51bWJlcjtcbiAgICBsYXN0U3dpcGVSZXNldDogRGF0ZTtcbiAgICBjcmVhdGVkQXQ6IERhdGU7XG4gICAgbGFzdEFjdGl2ZTogRGF0ZTtcbiAgICBpc0FjdGl2ZTogYm9vbGVhbjtcbn1cbmludGVyZmFjZSBNZXNzYWdlIHtcbiAgICBfaWQ6IHN0cmluZztcbiAgICBzZW5kZXJJZDogc3RyaW5nO1xuICAgIHJlY2VpdmVySWQ6IHN0cmluZztcbiAgICBtYXRjaElkOiBzdHJpbmc7XG4gICAgY29udGVudDogc3RyaW5nO1xuICAgIHRpbWVzdGFtcDogc3RyaW5nO1xuICAgIHJlYWQ6IGJvb2xlYW47XG59XG5jbGFzcyBIZWFydFN5bmNTZXJ2ZXIge1xuICAgIGFzeW5jIGdldFByb2ZpbGUoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGUgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29uc3QgcHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgICAgICByZXR1cm4gcHJvZmlsZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgSGVhcnRTeW5jIHByb2ZpbGU6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBjcmVhdGVQcm9maWxlKHNvdXJjZTogbnVtYmVyLCBwcm9maWxlRGF0YTogUGFydGlhbDxIZWFydFN5bmNQcm9maWxlPik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZSB8IG51bGw+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHByb2ZpbGUgYWxyZWFkeSBleGlzdHNcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nUHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdQcm9maWxlKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdQcm9maWxlIGFscmVhZHkgZXhpc3RzJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5ld1Byb2ZpbGU6IEhlYXJ0U3luY1Byb2ZpbGUgPSB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgbmFtZTogcHJvZmlsZURhdGEubmFtZSB8fCAnJyxcbiAgICAgICAgICAgICAgICBhZ2U6IHByb2ZpbGVEYXRhLmFnZSB8fCAxOCxcbiAgICAgICAgICAgICAgICBnZW5kZXI6IHByb2ZpbGVEYXRhLmdlbmRlciB8fCAnJyxcbiAgICAgICAgICAgICAgICBiaW86IHByb2ZpbGVEYXRhLmJpbyB8fCAnJyxcbiAgICAgICAgICAgICAgICBwaG90b3M6IHByb2ZpbGVEYXRhLnBob3RvcyB8fCBbXSxcbiAgICAgICAgICAgICAgICBpbnRlcmVzdHM6IHByb2ZpbGVEYXRhLmludGVyZXN0cyB8fCBbXSxcbiAgICAgICAgICAgICAgICBsb29raW5nRm9yOiBwcm9maWxlRGF0YS5sb29raW5nRm9yIHx8ICcnLFxuICAgICAgICAgICAgICAgIGludGVyZXN0ZWRJbkdlbmRlcnM6IHByb2ZpbGVEYXRhLmludGVyZXN0ZWRJbkdlbmRlcnMgfHwgW10sXG4gICAgICAgICAgICAgICAgYWdlUmFuZ2VNaW46IHByb2ZpbGVEYXRhLmFnZVJhbmdlTWluIHx8IDE4LFxuICAgICAgICAgICAgICAgIGFnZVJhbmdlTWF4OiBwcm9maWxlRGF0YS5hZ2VSYW5nZU1heCB8fCAzNSxcbiAgICAgICAgICAgICAgICBtYXhEaXN0YW5jZTogcHJvZmlsZURhdGEubWF4RGlzdGFuY2UgfHwgMjUsXG4gICAgICAgICAgICAgICAgc2hvd09ubGluZTogcHJvZmlsZURhdGEuc2hvd09ubGluZSAhPT0gdW5kZWZpbmVkID8gcHJvZmlsZURhdGEuc2hvd09ubGluZSA6IHRydWUsXG4gICAgICAgICAgICAgICAgd29yazogcHJvZmlsZURhdGEud29yayB8fCAnJyxcbiAgICAgICAgICAgICAgICBzY2hvb2w6IHByb2ZpbGVEYXRhLnNjaG9vbCB8fCAnJyxcbiAgICAgICAgICAgICAgICBoZWlnaHQ6IHByb2ZpbGVEYXRhLmhlaWdodCxcbiAgICAgICAgICAgICAgICB6b2RpYWNTaWduOiBwcm9maWxlRGF0YS56b2RpYWNTaWduIHx8ICcnLFxuICAgICAgICAgICAgICAgIGxpZmVzdHlsZTogcHJvZmlsZURhdGEubGlmZXN0eWxlIHx8IHtcbiAgICAgICAgICAgICAgICAgICAgc21va2luZzogJycsXG4gICAgICAgICAgICAgICAgICAgIGRyaW5raW5nOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgZXhlcmNpc2U6ICcnLFxuICAgICAgICAgICAgICAgICAgICBwZXRzOiAnJ1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHByZW1pdW06IGZhbHNlLFxuICAgICAgICAgICAgICAgIHN1cGVyTGlrZXNSZW1haW5pbmc6IDUsXG4gICAgICAgICAgICAgICAgbGlrZXNSZW1haW5pbmc6IDUwLFxuICAgICAgICAgICAgICAgIGRhaWx5U3dpcGVzOiAwLFxuICAgICAgICAgICAgICAgIGxhc3RTd2lwZVJlc2V0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgICAgICAgICBsYXN0QWN0aXZlOiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgbmV3UHJvZmlsZSk7XG4gICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhyZXN1bHQpOyAqL1xuICAgICAgICAgICAgcmV0dXJuIHsgLi4ubmV3UHJvZmlsZSwgX2lkOiByZXN1bHQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGNyZWF0aW5nIEhlYXJ0U3luYyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgdXBkYXRlUHJvZmlsZShzb3VyY2U6IG51bWJlciwgcHJvZmlsZURhdGE6IFBhcnRpYWw8SGVhcnRTeW5jUHJvZmlsZT4pOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGUgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBudWxsO1xuXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVEYXRhID0ge1xuICAgICAgICAgICAgICAgIC4uLnByb2ZpbGVEYXRhLFxuICAgICAgICAgICAgICAgIGxhc3RBY3RpdmU6IG5ldyBEYXRlKClcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9LCB1cGRhdGVEYXRhLCB1bmRlZmluZWQsIGZhbHNlLCB7IHVwc2VydDogdHJ1ZSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC52YWx1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIEhlYXJ0U3luYyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgY29uc3QgdXNlclByb2ZpbGUgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkIH0pO1xuICAgICAgICAgICAgaWYgKCF1c2VyUHJvZmlsZSkgcmV0dXJuIFtdO1xuXG4gICAgICAgICAgICAvLyBHZXQgdXNlcnMgYWxyZWFkeSBzd2lwZWQgb25cbiAgICAgICAgICAgIGNvbnN0IHN3aXBlZFVzZXJzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3N3aXBlcycsIHtcbiAgICAgICAgICAgICAgICBmcm9tVXNlcklkOiBjaXRpemVuSWRcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgICAgICAgICAgY29uc3Qgc3dpcGVkVXNlcklkcyA9IHN3aXBlZFVzZXJzLm1hcCgoc3dpcGU6IGFueSkgPT4gc3dpcGUudG9Vc2VySWQpO1xuXG4gICAgICAgICAgICAvLyBHZXQgbWF0Y2hlZCB1c2Vyc1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tYXRjaGVzJywge1xuICAgICAgICAgICAgICAgICRvcjogW1xuICAgICAgICAgICAgICAgICAgICB7IHVzZXIxSWQ6IGNpdGl6ZW5JZCB9LFxuICAgICAgICAgICAgICAgICAgICB7IHVzZXIySWQ6IGNpdGl6ZW5JZCB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG4gICAgICAgICAgICBjb25zdCBtYXRjaGVkVXNlcklkcyA9IG1hdGNoZXMubWFwKChtYXRjaDogYW55KSA9PlxuICAgICAgICAgICAgICAgIG1hdGNoLnVzZXIxSWQgPT09IGNpdGl6ZW5JZCA/IG1hdGNoLnVzZXIySWQgOiBtYXRjaC51c2VyMUlkXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBDb21iaW5lIGV4Y2x1ZGVkIHVzZXJzXG4gICAgICAgICAgICBjb25zdCBleGNsdWRlZFVzZXJJZHMgPSBbLi4uc3dpcGVkVXNlcklkcywgLi4ubWF0Y2hlZFVzZXJJZHMsIGNpdGl6ZW5JZF07XG5cbiAgICAgICAgICAgIC8vIEJ1aWxkIG1hdGNoIGNyaXRlcmlhXG4gICAgICAgICAgICBjb25zdCBtYXRjaENyaXRlcmlhOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiB7ICRuaW46IGV4Y2x1ZGVkVXNlcklkcyB9LFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGFnZTogeyAkZ3RlOiB1c2VyUHJvZmlsZS5hZ2VSYW5nZU1pbiwgJGx0ZTogdXNlclByb2ZpbGUuYWdlUmFuZ2VNYXggfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gQWRkIGdlbmRlciBwcmVmZXJlbmNlc1xuICAgICAgICAgICAgaWYgKHVzZXJQcm9maWxlLmxvb2tpbmdGb3IgIT09ICdFdmVyeW9uZScpIHtcbiAgICAgICAgICAgICAgICBtYXRjaENyaXRlcmlhLmdlbmRlciA9IHVzZXJQcm9maWxlLmxvb2tpbmdGb3IgPT09ICdNZW4nID8gJ01hbicgOiAnV29tYW4nO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodXNlclByb2ZpbGUuaW50ZXJlc3RlZEluR2VuZGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hDcml0ZXJpYS5sb29raW5nRm9yID0ge1xuICAgICAgICAgICAgICAgICAgICAkaW46IHVzZXJQcm9maWxlLmludGVyZXN0ZWRJbkdlbmRlcnMuaW5jbHVkZXModXNlclByb2ZpbGUuZ2VuZGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgPyB1c2VyUHJvZmlsZS5pbnRlcmVzdGVkSW5HZW5kZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICA6IFsuLi51c2VyUHJvZmlsZS5pbnRlcmVzdGVkSW5HZW5kZXJzLCAnRXZlcnlvbmUnXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHBvdGVudGlhbE1hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfcHJvZmlsZXMnLCBtYXRjaENyaXRlcmlhLCB1bmRlZmluZWQsIGZhbHNlLCB7IGxpbWl0OiAyMCB9KVxuXG4gICAgICAgICAgICByZXR1cm4gcG90ZW50aWFsTWF0Y2hlcztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgcG90ZW50aWFsIG1hdGNoZXM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgc3dpcGVQcm9maWxlKHNvdXJjZTogbnVtYmVyLCBzd2lwZURhdGE6IHsgdGFyZ2V0VXNlcklkOiBzdHJpbmc7IGlzTGlrZTogYm9vbGVhbjsgaXNTdXBlckxpa2U/OiBib29sZWFuIH0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGlzTWF0Y2g6IGZhbHNlIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHsgdGFyZ2V0VXNlcklkLCBpc0xpa2UsIGlzU3VwZXJMaWtlID0gZmFsc2UgfSA9IHN3aXBlRGF0YTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgZGFpbHkgbGltaXRzXG4gICAgICAgICAgICBjb25zdCB1c2VyUHJvZmlsZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAoIXVzZXJQcm9maWxlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgaXNNYXRjaDogZmFsc2UgfTtcblxuICAgICAgICAgICAgaWYgKGlzU3VwZXJMaWtlICYmIHVzZXJQcm9maWxlLnN1cGVyTGlrZXNSZW1haW5pbmcgPD0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBpc01hdGNoOiBmYWxzZSwgZXJyb3I6ICdObyBzdXBlciBsaWtlcyByZW1haW5pbmcnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlY29yZCB0aGUgc3dpcGVcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfc3dpcGVzJywge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgZnJvbVVzZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIHRvVXNlcklkOiB0YXJnZXRVc2VySWQsXG4gICAgICAgICAgICAgICAgaXNMaWtlLFxuICAgICAgICAgICAgICAgIGlzU3VwZXJMaWtlLFxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGxldCBpc01hdGNoID0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBtYXRjaCBpZiBpdCdzIGEgbGlrZVxuICAgICAgICAgICAgaWYgKGlzTGlrZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlY2lwcm9jYWxTd2lwZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3N3aXBlcycsIHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbVVzZXJJZDogdGFyZ2V0VXNlcklkLFxuICAgICAgICAgICAgICAgICAgICB0b1VzZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgICAgICBpc0xpa2U6IHRydWVcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmIChyZWNpcHJvY2FsU3dpcGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIG1hdGNoXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VyMUlkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1c2VyMklkOiB0YXJnZXRVc2VySWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkQXQ6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzU3VwZXJMaWtlOiBpc1N1cGVyTGlrZSB8fCByZWNpcHJvY2FsU3dpcGUuaXNTdXBlckxpa2VcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlzTWF0Y2ggPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9ucyB0byBib3RoIHVzZXJzIGFib3V0IHRoZSBtYXRjaFxuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gR2V0IHBsYXllciBkYXRhIGZvciBib3RoIHVzZXJzXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzd2lwZXJEYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0RGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQodGFyZ2V0VXNlcklkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gR2V0IG9mZmxpbmUgZGF0YSBpZiBwbGF5ZXJzIGFyZSBub3Qgb25saW5lXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzd2lwZXJQbGF5ZXJEYXRhID0gc3dpcGVyRGF0YSB8fCBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldE9mZmxpbmVQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGxheWVyRGF0YSA9IHRhcmdldERhdGEgfHwgYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRPZmZsaW5lUGxheWVyQnlDaXRpemVuSWQodGFyZ2V0VXNlcklkKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCBub3RpZmljYXRpb24gdG8gdGhlIHN3aXBlciAoY3VycmVudCB1c2VyKVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN3aXBlckRhdGEgJiYgc3dpcGVyRGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc3dpcGVyRGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIkhlYXJ0U3luYyBNYXRjaCEgXHVEODNEXHVEQzk1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IG1hdGNoZWQgd2l0aCAke3RhcmdldFBsYXllckRhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSFgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwiaGVhcnRzeW5jXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9uIHRvIHRoZSB0YXJnZXQgdXNlclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldERhdGEgJiYgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIkhlYXJ0U3luYyBNYXRjaCEgXHVEODNEXHVEQzk1XCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IG1hdGNoZWQgd2l0aCAke3N3aXBlclBsYXllckRhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c3dpcGVyUGxheWVyRGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSFgLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwiaGVhcnRzeW5jXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKG5vdGlmaWNhdGlvbkVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzZW5kaW5nIG1hdGNoIG5vdGlmaWNhdGlvbnM6Jywgbm90aWZpY2F0aW9uRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHN3aXBlIGNvdW50c1xuICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZURhdGE6IGFueSA9IHtcbiAgICAgICAgICAgICAgICAgICAgZGFpbHlTd2lwZXM6IHVzZXJQcm9maWxlLmRhaWx5U3dpcGVzICsgMVxuICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICBpZiAoaXNTdXBlckxpa2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlRGF0YS5zdXBlckxpa2VzUmVtYWluaW5nID0gdXNlclByb2ZpbGUuc3VwZXJMaWtlc1JlbWFpbmluZyAtIDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlRGF0YS5saWtlc1JlbWFpbmluZyA9IHVzZXJQcm9maWxlLmxpa2VzUmVtYWluaW5nIC0gMTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSwgdXBkYXRlRGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGlzTWF0Y2ggfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHN3aXBpbmcgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgaXNNYXRjaDogZmFsc2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldE1hdGNoZXMoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPGFueVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tYXRjaGVzJywge1xuICAgICAgICAgICAgICAgICRvcjogW1xuICAgICAgICAgICAgICAgICAgICB7IHVzZXIxSWQ6IGNpdGl6ZW5JZCB9LFxuICAgICAgICAgICAgICAgICAgICB7IHVzZXIySWQ6IGNpdGl6ZW5JZCB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBzb3J0OiB7IG1hdGNoZWRBdDogLTEgfSB9KTtcblxuICAgICAgICAgICAgY29uc3QgZW5yaWNoZWRNYXRjaGVzID0gYXdhaXQgUHJvbWlzZS5hbGwobWF0Y2hlcy5tYXAoYXN5bmMgKG1hdGNoOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlclVzZXJJZCA9IG1hdGNoLnVzZXIxSWQgPT09IGNpdGl6ZW5JZCA/IG1hdGNoLnVzZXIySWQgOiBtYXRjaC51c2VyMUlkO1xuICAgICAgICAgICAgICAgIGNvbnN0IG90aGVyVXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQ6IG90aGVyVXNlcklkIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGFzdE1lc3NhZ2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19tZXNzYWdlcycsIHsgbWF0Y2hJZDogbWF0Y2guX2lkIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgc29ydDogeyB0aW1lc3RhbXA6IC0xIH0gfSk7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAuLi5tYXRjaCxcbiAgICAgICAgICAgICAgICAgICAgb3RoZXJVc2VyLFxuICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogbGFzdE1lc3NhZ2U/LmNvbnRlbnQsXG4gICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlVGltZTogbGFzdE1lc3NhZ2U/LnRpbWVzdGFtcCxcbiAgICAgICAgICAgICAgICAgICAgaXNOZXdNYXRjaDogIWxhc3RNZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICB1bnJlYWRDb3VudDogYXdhaXQgdGhpcy5nZXRVbnJlYWRNZXNzYWdlQ291bnQobWF0Y2guX2lkIS50b1N0cmluZygpLCBjaXRpemVuSWQpXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgcmV0dXJuIGVucmljaGVkTWF0Y2hlcztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgbWF0Y2hlczonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFVucmVhZE1lc3NhZ2VDb3VudChtYXRjaElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX21lc3NhZ2VzJywge1xuICAgICAgICAgICAgICAgIG1hdGNoSWQsXG4gICAgICAgICAgICAgICAgcmVjZWl2ZXJJZDogdXNlcklkLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIHJldHVybiBjb3VudC5sZW5ndGg7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIHVucmVhZCBjb3VudDonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1vY2sgaW1wbGVtZW50YXRpb25zIGZvciBvdGhlciBtZXRob2RzIC0gcmVwbGFjZSB3aXRoIGFjdHVhbCBsb2dpY1xuICAgIGFzeW5jIGdldFN3aXBlU3RhdHMoc291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBudWxsO1xuXG4gICAgICAgIGNvbnN0IHByb2ZpbGUgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkIH0pO1xuICAgICAgICByZXR1cm4gcHJvZmlsZSA/IHtcbiAgICAgICAgICAgIGxpa2VzUmVtYWluaW5nOiBwcm9maWxlLmxpa2VzUmVtYWluaW5nLFxuICAgICAgICAgICAgc3VwZXJMaWtlc1JlbWFpbmluZzogcHJvZmlsZS5zdXBlckxpa2VzUmVtYWluaW5nLFxuICAgICAgICAgICAgZGFpbHlTd2lwZXM6IHByb2ZpbGUuZGFpbHlTd2lwZXNcbiAgICAgICAgfSA6IG51bGw7XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0TmVhcmJ5VXNlcnMoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGVbXT4ge1xuICAgICAgICAvLyBNb2NrIGltcGxlbWVudGF0aW9uIC0gcmVwbGFjZSB3aXRoIGFjdHVhbCBnZW9sb2NhdGlvbiBsb2dpY1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRQb3RlbnRpYWxNYXRjaGVzKHNvdXJjZSk7XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0T25saW5lVXNlcnMoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGVbXT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IGZpdmVNaW51dGVzQWdvID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIDUgKiA2MCAqIDEwMDApO1xuICAgICAgICAgICAgY29uc3Qgb25saW5lVXNlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiB7ICRuZTogY2l0aXplbklkIH0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgbGFzdEFjdGl2ZTogeyAkZ3RlOiBmaXZlTWludXRlc0FnbyB9XG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlLCB7IGxpbWl0OiAxMCB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIG9ubGluZVVzZXJzO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBvbmxpbmUgdXNlcnM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0UmVjZW50bHlBY3RpdmVVc2Vycyhzb3VyY2U6IG51bWJlcik6IFByb21pc2U8SGVhcnRTeW5jUHJvZmlsZVtdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgY29uc3Qgb25lRGF5QWdvID0gbmV3IERhdGUoRGF0ZS5ub3coKSAtIDI0ICogNjAgKiA2MCAqIDEwMDApO1xuICAgICAgICAgICAgY29uc3QgcmVjZW50VXNlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiB7ICRuZTogY2l0aXplbklkIH0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgbGFzdEFjdGl2ZTogeyAkZ3RlOiBvbmVEYXlBZ28gfVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBsaW1pdDogMTUsIHNvcnQ6IHsgbGFzdEFjdGl2ZTogLTEgfSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHJlY2VudFVzZXJzO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyByZWNlbnRseSBhY3RpdmUgdXNlcnM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0VG9wUGlja3Moc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGVbXT4ge1xuICAgICAgICAvLyBNb2NrIGltcGxlbWVudGF0aW9uIC0gcmVwbGFjZSB3aXRoIGFjdHVhbCBhbGdvcml0aG1cbiAgICAgICAgY29uc3QgcG90ZW50aWFsTWF0Y2hlcyA9IGF3YWl0IHRoaXMuZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2UpO1xuICAgICAgICByZXR1cm4gcG90ZW50aWFsTWF0Y2hlcy5zbGljZSgwLCA4KTtcbiAgICB9XG5cbiAgICBhc3luYyBnZXROb3RpZmljYXRpb25zKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiB7IG5ld01hdGNoZXM6IDAsIG5ld01lc3NhZ2VzOiAwLCBzdXBlckxpa2VzOiAwIH07XG5cbiAgICAgICAgICAgIC8vIEdldCBuZXcgbWF0Y2hlcyAobWF0Y2hlcyB3aXRob3V0IG1lc3NhZ2VzKVxuICAgICAgICAgICAgY29uc3QgbmV3TWF0Y2hlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tYXRjaGVzJywge1xuICAgICAgICAgICAgICAgICRvcjogW3sgdXNlcjFJZDogY2l0aXplbklkIH0sIHsgdXNlcjJJZDogY2l0aXplbklkIH1dLFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgIC8vIEFkZCBsb2dpYyB0byBjaGVjayBpZiBtYXRjaCBpcyBuZXdcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuXG4gICAgICAgICAgICAvLyBHZXQgdW5yZWFkIG1lc3NhZ2VzXG4gICAgICAgICAgICBjb25zdCBuZXdNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tZXNzYWdlcycsIHtcbiAgICAgICAgICAgICAgICByZWNlaXZlcklkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgcmVhZDogZmFsc2VcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuXG4gICAgICAgICAgICAvLyBHZXQgcmVjZWl2ZWQgc3VwZXIgbGlrZXNcbiAgICAgICAgICAgIGNvbnN0IHN1cGVyTGlrZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfc3dpcGVzJywge1xuICAgICAgICAgICAgICAgIHRvVXNlcklkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgaXNTdXBlckxpa2U6IHRydWUsXG4gICAgICAgICAgICAgICAgaXNMaWtlOiB0cnVlXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgbmV3TWF0Y2hlczogbmV3TWF0Y2hlcy5sZW5ndGgsIG5ld01lc3NhZ2VzOiBuZXdNZXNzYWdlcy5sZW5ndGgsIHN1cGVyTGlrZXM6IHN1cGVyTGlrZXMubGVuZ3RoIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIG5vdGlmaWNhdGlvbnM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgbmV3TWF0Y2hlczogMCwgbmV3TWVzc2FnZXM6IDAsIHN1cGVyTGlrZXM6IDAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldE1lc3NhZ2VzKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tZXNzYWdlcycsIHsgbWF0Y2hJZDogZGF0YS5tYXRjaElkIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgIH1cblxuICAgIGFzeW5jIHNlbmRNZXNzYWdlKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpIHtcbiAgICAgICAgLyogY29uc29sZS5sb2coZGF0YSk7ICovXG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnaGVhcnRzeW5jX21hdGNoZXMnLCB7IF9pZDogU3RyaW5nKGRhdGEubWF0Y2hJZCkgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG4gICAgICAgIGNvbnN0IHNvdXJjZUNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgIGxldCBzb3VyY2VEYXRhID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChzb3VyY2VDaXRpemVuSWQpO1xuICAgICAgICBsZXQgdGFyZ2V0RGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQocmVzLnVzZXIxSWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHJlcy51c2VyMklkIDogcmVzLnVzZXIxSWQpO1xuXG4gICAgICAgIGlmICghc291cmNlRGF0YSkge1xuICAgICAgICAgICAgc291cmNlRGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0T2ZmbGluZVBsYXllckJ5Q2l0aXplbklkKHNvdXJjZUNpdGl6ZW5JZCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRhcmdldERhdGEpIHtcbiAgICAgICAgICAgIHRhcmdldERhdGEgPSBhd2FpdCBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldE9mZmxpbmVQbGF5ZXJCeUNpdGl6ZW5JZChyZXMudXNlcjFJZCA9PT0gc291cmNlQ2l0aXplbklkID8gcmVzLnVzZXIySWQgOiByZXMudXNlcjFJZCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnNlcnREYXRhOiBNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHJlYWQ6IHJlcy51c2VyMUlkID09PSBzb3VyY2VDaXRpemVuSWQgfHwgcmVzLnVzZXIySWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHRydWUgOiBmYWxzZSxcbiAgICAgICAgICAgIG1hdGNoSWQ6IHJlcy5faWQsXG4gICAgICAgICAgICBzZW5kZXJJZDogc291cmNlQ2l0aXplbklkLFxuICAgICAgICAgICAgcmVjZWl2ZXJJZDogcmVzLnVzZXIxSWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHJlcy51c2VyMklkIDogcmVzLnVzZXIxSWQsXG4gICAgICAgICAgICBjb250ZW50OiBkYXRhLmNvbnRlbnQsXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgnaGVhcnRzeW5jX21lc3NhZ2VzJywgaW5zZXJ0RGF0YSk7XG5cbiAgICAgICAgaWYgKHJlcy51c2VyMUlkICE9PSBzb3VyY2VDaXRpemVuSWQgfHwgcmVzLnVzZXIySWQgIT09IHNvdXJjZUNpdGl6ZW5JZCAmJiB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlKSB7XG4gICAgICAgICAgICBlbWl0TmV0KCdoZWFydHN5bmM6Y2xpZW50OnNlbmRNZXNzYWdlJywgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoaW5zZXJ0RGF0YSkpO1xuICAgICAgICAgICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXREYXRhLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIkhlYXJ0U3luY1wiLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBoYXZlIGEgbmV3IG1lc3NhZ2UgZnJvbSBcIiArIHNvdXJjZURhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWUgKyBcIiBcIiArIHNvdXJjZURhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZSxcbiAgICAgICAgICAgICAgICBhcHA6IFwiaGVhcnRzeW5jXCIsXG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBpbnNlcnREYXRhO1xuICAgIH1cblxuICAgIGFzeW5jIHVubWF0Y2goc291cmNlOiBudW1iZXIsIGRhdGE6IHsgbWF0Y2hJZDogc3RyaW5nIH0pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywgeyBfaWQ6IGRhdGEubWF0Y2hJZCB9KTtcbiAgICAgICAgICAgIGlmICghbWF0Y2ggfHwgIW1hdGNoLmlzQWN0aXZlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSB9O1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgdXNlciBpcyBwYXJ0IG9mIHRoaXMgbWF0Y2hcbiAgICAgICAgICAgIGlmIChtYXRjaC51c2VyMUlkICE9PSBjaXRpemVuSWQgJiYgbWF0Y2gudXNlcjJJZCAhPT0gY2l0aXplbklkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm90IGF1dGhvcml6ZWQgdG8gdW5tYXRjaCB0aGlzIHVzZXInIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIERlYWN0aXZhdGUgdGhlIG1hdGNoXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnaGVhcnRzeW5jX21hdGNoZXMnLCB7IF9pZDogZGF0YS5tYXRjaElkIH0sIHsgaXNBY3RpdmU6IGZhbHNlIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1bm1hdGNoaW5nOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0ZhaWxlZCB0byB1bm1hdGNoJyB9O1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jb25zdCBoZWFydFN5bmNTZXJ2ZXIgPSBuZXcgSGVhcnRTeW5jU2VydmVyKCk7XG5cbi8vIFJlZ2lzdGVyIHNlcnZlciBjYWxsYmFja3Ncbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXRQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRQcm9maWxlKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmNyZWF0ZVByb2ZpbGUnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuY3JlYXRlUHJvZmlsZShzb3VyY2UsIGRhdGEpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzp1cGRhdGVQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLnVwZGF0ZVByb2ZpbGUoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0UG90ZW50aWFsTWF0Y2hlcycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpzd2lwZVByb2ZpbGUnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuc3dpcGVQcm9maWxlKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE1hdGNoZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE1hdGNoZXMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0U3dpcGVTdGF0cycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0U3dpcGVTdGF0cyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXROZWFyYnlVc2VycycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0TmVhcmJ5VXNlcnMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0T25saW5lVXNlcnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE9ubGluZVVzZXJzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFJlY2VudGx5QWN0aXZlVXNlcnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFJlY2VudGx5QWN0aXZlVXNlcnMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0VG9wUGlja3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFRvcFBpY2tzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE5vdGlmaWNhdGlvbnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE5vdGlmaWNhdGlvbnMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0TWVzc2FnZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0TWVzc2FnZXMoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6c2VuZE1lc3NhZ2UnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuc2VuZE1lc3NhZ2Uoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6dW5tYXRjaCcsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci51bm1hdGNoKHNvdXJjZSwgZGF0YSk7XG59KTtcblxuLy8gQWRkIG1vcmUgY2FsbGJhY2tzIGZvciBtZXNzYWdlcywgc3VwZXIgbGlrZXMsIGV0Yy5cbi8vIC4uLiAoaW1wbGVtZW50IHJlbWFpbmluZyBjYWxsYmFja3MgYXMgbmVlZGVkKVxuXG5leHBvcnQgeyBoZWFydFN5bmNTZXJ2ZXIgfTtcbiIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBGcmFtZXdvcmssIExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBEYXRlVGltZSB9IGZyb20gJ2x1eG9uJztcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NyeXB0bzpnZXRCYWxhbmNlcycsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBjcnlwdG8gPSBwbGF5ZXIuUGxheWVyRGF0YS5tZXRhZGF0YS5jcnlwdG8gfHwge307XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNyeXB0byk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY3J5cHRvOmJ1eScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0eXBlLCBhbW91bnQsIHByaWNlIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFwbGF5ZXIgfHwgIVtcInNodW5nXCIsIFwiZ25lXCIsIFwieGNvaW5cIiwgXCJsbWVcIl0uaW5jbHVkZXModHlwZSkpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBjb25zdCB0b3RhbENvc3QgPSBhbW91bnQgKiBwcmljZTsgIC8vIEFzc3VtZSBwcmljZSBpcyBwZXIgdW5pdFxuICAgIGlmIChwbGF5ZXIuUGxheWVyRGF0YS5tb25leS5iYW5rIDwgdG90YWxDb3N0KSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgaWYgKHBsYXllci5GdW5jdGlvbnMuUmVtb3ZlTW9uZXkoJ2JhbmsnLCB0b3RhbENvc3QpKSB7XG4gICAgICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5BZGRDcnlwdG8oc291cmNlLCB0eXBlLCBhbW91bnQpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdjcnlwdG9fYnV5JyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ3J5cHRvIEJ1eScsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtwbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7cGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGJvdWdodCAke2Ftb3VudH0gJHt0eXBlfSBmb3IgJCR7dG90YWxDb3N0fS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjcnlwdG86c2VsbCcsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0eXBlLCBhbW91bnQsIHByaWNlIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFwbGF5ZXIgfHwgIVtcInNodW5nXCIsIFwiZ25lXCIsIFwieGNvaW5cIiwgXCJsbWVcIl0uaW5jbHVkZXModHlwZSkpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBpZiAoIWV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5oYXNFbm91Z2goc291cmNlLCB0eXBlLCBhbW91bnQpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLlJlbW92ZUNyeXB0byhzb3VyY2UsIHR5cGUsIGFtb3VudCk7XG4gICAgcGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGFtb3VudCAqIHByaWNlKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ2NyeXB0b19zZWxsJyxcbiAgICAgICAgdGl0bGU6ICdDcnlwdG8gU2VsbCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke3BsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtwbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gc29sZCAke2Ftb3VudH0gJHt0eXBlfSBmb3IgJCR7YW1vdW50ICogcHJpY2V9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY3J5cHRvOnRyYW5zZmVyJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IHR5cGUsIGFtb3VudCwgdGFyZ2V0IH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgaWYgKCFzb3VyY2VQbGF5ZXIgfHwgIVtcInNodW5nXCIsIFwiZ25lXCIsIFwieGNvaW5cIiwgXCJsbWVcIl0uaW5jbHVkZXModHlwZSkpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBpZiAoIWV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5oYXNFbm91Z2goc291cmNlLCB0eXBlLCBhbW91bnQpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgLy8gQXNzdW1lIHRhcmdldCBpcyBwaG9uZSBudW1iZXIgdG8gZ2V0IGNpdGl6ZW5JZFxuICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIodGFyZ2V0KTtcbiAgICBpZiAoIXRhcmdldENpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGNvbnN0IHRhcmdldFBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyQnlDaXRpemVuSWQodGFyZ2V0Q2l0aXplbklkKTtcbiAgICBpZiAoIXRhcmdldFBsYXllcikgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5SZW1vdmVDcnlwdG8oc291cmNlLCB0eXBlLCBhbW91bnQpO1xuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5BZGRDcnlwdG8odGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlLCB0eXBlLCBhbW91bnQpO1xuICAgIFxuICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiAnQ3J5cHRvJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgdHJhbnNmZXJyZWQgJHthbW91bnR9ICR7dHlwZX0gdG8gJHt0YXJnZXR9LmAsXG4gICAgICAgIGFwcDogJ2NyeXB0bycsXG4gICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICB9KSk7XG4gICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6ICdDcnlwdG8nLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSByZWNlaXZlZCAke2Ftb3VudH0gJHt0eXBlfSBmcm9tICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfS5gLFxuICAgICAgICBhcHA6ICdjcnlwdG8nLFxuICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgfSkpO1xuICAgIFxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAnY3J5cHRvX3RyYW5zZmVyJyxcbiAgICAgICAgdGl0bGU6ICdDcnlwdG8gVHJhbnNmZXInLFxuICAgICAgICBtZXNzYWdlOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IHRyYW5zZmVycmVkICR7YW1vdW50fSAke3R5cGV9IHRvICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTsiLCAiaW1wb3J0IHsgRnJhbWV3b3JrLCBNeVNRTCB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSwgSU5WRU5UT1JZX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxuY29uc3QgaW52UGF0aCA9IGBudWk6Ly8ke0lOVkVOVE9SWV9SRVNPVVJDRX0vaHRtbC9pbWFnZXMvYDtcblxudHlwZSBSZXdhcmRUeXBlID0gXCJ2ZWhpY2xlXCIgfCBcIml0ZW1cIiB8IFwiY2FzaFwiIHwgXCJiYW5rXCIgfCBcIndlYXBvblwiO1xudHlwZSBSYXJpdHkgPSBcImxlZ2VuZGFyeVwiIHwgXCJlcGljXCIgfCBcInJhcmVcIiB8IFwiY29tbW9uXCI7XG5cbmludGVyZmFjZSBSb3VsZXR0ZVJld2FyZCB7XG4gICAgaWQ6IG51bWJlcjtcbiAgICB0eXBlOiBSZXdhcmRUeXBlO1xuICAgIG1vZGVsOiBzdHJpbmcgfCBudW1iZXI7XG4gICAgcmFyaXR5OiBSYXJpdHk7XG4gICAgaW1nOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIHNlbGw6IG51bWJlcjtcbiAgICBxdWFudGl0eT86IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIERhaWx5U3BpbkNvbmZpZ1NoYXBlIHtcbiAgICBUaW1lVG9DbGFpbTogbnVtYmVyO1xuICAgIEFuaW1hdGlvbkR1cmF0aW9uOiBudW1iZXI7XG4gICAgUm91bGV0dGVEYXRhOiBSZWNvcmQ8bnVtYmVyLCBSb3VsZXR0ZVJld2FyZD47XG4gICAgUmFyaXR5UHJvYmFiaWxpdHk6IFJlY29yZDxSYXJpdHksIG51bWJlcj47XG4gICAgU2VsbFR5cGU6IFwiYmFua1wiIHwgXCJjYXNoXCI7XG4gICAgV2VhcG9uQW1vdW50OiBudW1iZXI7XG4gICAgQ2FyUGFya2luZ1NwYXduOiBzdHJpbmc7XG59XG5cbmNvbnN0IERhaWx5U3BpbkNvbmZpZzogRGFpbHlTcGluQ29uZmlnU2hhcGUgPSB7XG4gICAgVGltZVRvQ2xhaW06ICgyNCAqIDM2MDApLFxuXG4gICAgQW5pbWF0aW9uRHVyYXRpb246IDEyLFxuXG4gICAgUm91bGV0dGVEYXRhOiB7XG4gICAgICAgIDA6IHtcbiAgICAgICAgICAgIGlkOiAwLFxuICAgICAgICAgICAgdHlwZTogXCJ2ZWhpY2xlXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJwZW51bWJyYVwiLFxuICAgICAgICAgICAgcmFyaXR5OiBcImxlZ2VuZGFyeVwiLFxuICAgICAgICAgICAgaW1nOiBcImh0dHBzOi8vZG9jcy5maXZlbS5uZXQvdmVoaWNsZXMvcGVudW1icmEud2VicFwiLFxuICAgICAgICAgICAgbmFtZTogXCJQZW51bWJyYVwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMToge1xuICAgICAgICAgICAgaWQ6IDEsXG4gICAgICAgICAgICB0eXBlOiBcIndlYXBvblwiLFxuICAgICAgICAgICAgbW9kZWw6IFwid2VhcG9uX2RyYWNvXCIsXG4gICAgICAgICAgICByYXJpdHk6IFwiZXBpY1wiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXFiX2RyYWNvLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkRyYWNvXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwMFxuICAgICAgICB9LFxuICAgICAgICAyOiB7XG4gICAgICAgICAgICBpZDogMixcbiAgICAgICAgICAgIHJhcml0eTogXCJyYXJlXCIsXG4gICAgICAgICAgICB0eXBlOiBcIndlYXBvblwiLFxuICAgICAgICAgICAgbW9kZWw6IFwid2VhcG9uX2Jyb3duaW5nXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9cWJfYnJvd25pbmcucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiQnJvd25pbmdcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDBcbiAgICAgICAgfSxcbiAgICAgICAgMzoge1xuICAgICAgICAgICAgaWQ6IDMsXG4gICAgICAgICAgICByYXJpdHk6IFwicmFyZVwiLFxuICAgICAgICAgICAgdHlwZTogXCJpdGVtXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJhZHZhbmNlZHJlcGFpcmtpdFwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWFkdmFuY2Vka2l0LnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkFkdiBSZXBhaXIgS2l0IHg1XCIsXG4gICAgICAgICAgICBzZWxsOiA1MDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDVcbiAgICAgICAgfSxcbiAgICAgICAgNDoge1xuICAgICAgICAgICAgaWQ6IDQsXG4gICAgICAgICAgICByYXJpdHk6IFwicmFyZVwiLFxuICAgICAgICAgICAgdHlwZTogXCJjYXNoXCIsXG4gICAgICAgICAgICBtb2RlbDogMTAwMDAsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9Y2FzaC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCIkMTAwMDAgQ2FzaFwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMFxuICAgICAgICB9LFxuICAgICAgICA1OiB7XG4gICAgICAgICAgICBpZDogNSxcbiAgICAgICAgICAgIHJhcml0eTogXCJyYXJlXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImFkdmFuY2VkbG9ja3BpY2tcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1hZHZhbmNlZGxvY2twaWNrLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkFkdmFuY2VkIExvY2twaWNrIHg1XCIsXG4gICAgICAgICAgICBzZWxsOiAyNTAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDVcbiAgICAgICAgfSxcbiAgICAgICAgNjoge1xuICAgICAgICAgICAgaWQ6IDYsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImZha1wiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWZpcnN0YWlkLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkZBSyB4MTBcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDAsXG4gICAgICAgICAgICBxdWFudGl0eTogMTBcbiAgICAgICAgfSxcbiAgICAgICAgNzoge1xuICAgICAgICAgICAgaWQ6IDcsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcImNhc2hcIixcbiAgICAgICAgICAgIG1vZGVsOiA1MDAwLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWNhc2gucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiJDUwMDAgQ2FzaFwiLFxuICAgICAgICAgICAgc2VsbDogMTAwMFxuICAgICAgICB9LFxuICAgICAgICA4OiB7XG4gICAgICAgICAgICBpZDogOCxcbiAgICAgICAgICAgIHJhcml0eTogXCJjb21tb25cIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwibG9ja3BpY2tcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1sb2NrcGljay5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJMb2NrcGljayB4MTBcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDAsXG4gICAgICAgICAgICBxdWFudGl0eTogMTBcbiAgICAgICAgfSxcbiAgICAgICAgOToge1xuICAgICAgICAgICAgaWQ6IDksXG4gICAgICAgICAgICByYXJpdHk6IFwiZXBpY1wiLFxuICAgICAgICAgICAgdHlwZTogXCJjYXNoXCIsXG4gICAgICAgICAgICBtb2RlbDogMjUwMDAsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9Y2FzaC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCIkMjUwMDAgQ2FzaFwiLFxuICAgICAgICAgICAgc2VsbDogMTAwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTA6IHtcbiAgICAgICAgICAgIGlkOiAxMCxcbiAgICAgICAgICAgIHJhcml0eTogXCJsZWdlbmRhcnlcIixcbiAgICAgICAgICAgIHR5cGU6IFwid2VhcG9uXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJ3ZWFwb25fYWs0N1wiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXdlYXBvbl9hc3NhdWx0cmlmbGUucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiQUs0N1wiLFxuICAgICAgICAgICAgc2VsbDogMjUwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTE6IHtcbiAgICAgICAgICAgIGlkOiAxMSxcbiAgICAgICAgICAgIHJhcml0eTogXCJlcGljXCIsXG4gICAgICAgICAgICB0eXBlOiBcInZlaGljbGVcIixcbiAgICAgICAgICAgIG1vZGVsOiBcImZhZ2dpb1wiLFxuICAgICAgICAgICAgaW1nOiBcImh0dHBzOi8vZG9jcy5maXZlbS5uZXQvdmVoaWNsZXMvZmFnZ2lvLndlYnBcIixcbiAgICAgICAgICAgIG5hbWU6IFwiRmFnZ2lvXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwMFxuICAgICAgICB9LFxuICAgICAgICAxMjoge1xuICAgICAgICAgICAgaWQ6IDEyLFxuICAgICAgICAgICAgcmFyaXR5OiBcInJhcmVcIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwiaGVhdnlhcm1vclwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWFybW9yLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkhlYXZ5IEFybW9yIHgyXCIsXG4gICAgICAgICAgICBzZWxsOiAyNTAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDJcbiAgICAgICAgfSxcbiAgICAgICAgMTM6IHtcbiAgICAgICAgICAgIGlkOiAxMyxcbiAgICAgICAgICAgIHJhcml0eTogXCJjb21tb25cIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwiam9pbnRcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1qb2ludC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJKb2ludCB4MTVcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDAsXG4gICAgICAgICAgICBxdWFudGl0eTogMTVcbiAgICAgICAgfSxcbiAgICAgICAgMTQ6IHtcbiAgICAgICAgICAgIGlkOiAxNCxcbiAgICAgICAgICAgIHJhcml0eTogXCJjb21tb25cIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwiYmxvY2tvY2hlZXNlXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9cmF0X2NoZWVzZS5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJDaGVlc2UgeDIwXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDIwXG4gICAgICAgIH0sXG4gICAgICAgIDE1OiB7XG4gICAgICAgICAgICBpZDogMTUsXG4gICAgICAgICAgICB0eXBlOiBcImNhc2hcIixcbiAgICAgICAgICAgIG1vZGVsOiA3NTAwMCxcbiAgICAgICAgICAgIHJhcml0eTogXCJsZWdlbmRhcnlcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1jYXNoLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIiQ3NTAwMCBDYXNoXCIsXG4gICAgICAgICAgICBzZWxsOiAyNTAwMFxuICAgICAgICB9LFxuICAgICAgICAxNjoge1xuICAgICAgICAgICAgaWQ6IDE2LFxuICAgICAgICAgICAgcmFyaXR5OiBcImNvbW1vblwiLFxuICAgICAgICAgICAgdHlwZTogXCJpdGVtXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJyZWN5Y2xhYmxlX21hdGVyaWFsXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9cmVjeWNsYWJsZS1tYXRlcmlhbC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJSZWN5Y2xhYmxlcyB4MTAwXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDEwMFxuICAgICAgICB9LFxuICAgICAgICAxNzoge1xuICAgICAgICAgICAgaWQ6IDE3LFxuICAgICAgICAgICAgcmFyaXR5OiBcInJhcmVcIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwicmVjeWNsYWJsZV9tYXRlcmlhbFwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXJlY3ljbGFibGUtbWF0ZXJpYWwucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiUmVjeWNsYWJsZXMgeDI1MFwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiAyNTBcbiAgICAgICAgfSxcbiAgICB9LFxuXG4gICAgUmFyaXR5UHJvYmFiaWxpdHk6IHtcbiAgICAgICAgbGVnZW5kYXJ5OiAwLjAwMSxcbiAgICAgICAgZXBpYzogMC4wMixcbiAgICAgICAgcmFyZTogMC4yMCxcbiAgICAgICAgY29tbW9uOiAwLjc3OVxuICAgIH0sXG5cbiAgICBTZWxsVHlwZTogXCJiYW5rXCIsIC8vIGJhbmsgb3IgY2FzaFxuXG4gICAgV2VhcG9uQW1vdW50OiAyNTAsIC8vIGFtb3VudCBvZiBhbW1vIHRvIGdpdmUgd2hlbiBhIHdlYXBvbiBpcyB3b25cblxuICAgIENhclBhcmtpbmdTcGF3bjogXCJhbHRhXCIsIC8vIFFCOiBnYXJhZ2UsIEVTWDogcGFya2luZ1xufTtcblxuY29uc3Qgbm93SW5TZWNvbmRzID0gKCkgPT4gTWF0aC5mbG9vcihEYXRlLm5vdygpIC8gMTAwMCk7XG5cbmNvbnN0IGZvcm1hdFJlbWFpbmluZyA9IChyZW1haW5pbmc6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGhvdXJzID0gTWF0aC5mbG9vcihyZW1haW5pbmcgLyAzNjAwKTtcbiAgICBjb25zdCBtaW5zID0gTWF0aC5mbG9vcigocmVtYWluaW5nICUgMzYwMCkgLyA2MCk7XG4gICAgY29uc3Qgc2VjcyA9IHJlbWFpbmluZyAlIDYwO1xuXG4gICAgcmV0dXJuIGAke1N0cmluZyhob3VycykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhtaW5zKS5wYWRTdGFydCgyLCBcIjBcIil9OiR7U3RyaW5nKHNlY3MpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xufTtcblxuY29uc3QgZ2V0Q29vbGRvd25TdGF0ZSA9IChwbGF5ZXI6IGFueSkgPT4ge1xuICAgIGNvbnN0IGxhc3QgPSBwbGF5ZXI/LlBsYXllckRhdGE/Lm1ldGFkYXRhPy5QaG9uZURhaWx5U3BpbiA/PyAwO1xuICAgIGNvbnN0IGRpZmYgPSBub3dJblNlY29uZHMoKSAtIGxhc3Q7XG5cbiAgICBpZiAoZGlmZiA+PSBEYWlseVNwaW5Db25maWcuVGltZVRvQ2xhaW0pIHtcbiAgICAgICAgcmV0dXJuIHsgY2FuQ2xhaW06IHRydWUsIGxhc3RDbGFpbWVkRGlzcGxheTogXCIwMDowMDowMFwiIH07XG4gICAgfVxuXG4gICAgY29uc3QgcmVtYWluaW5nID0gRGFpbHlTcGluQ29uZmlnLlRpbWVUb0NsYWltIC0gZGlmZjtcbiAgICByZXR1cm4geyBjYW5DbGFpbTogZmFsc2UsIGxhc3RDbGFpbWVkRGlzcGxheTogZm9ybWF0UmVtYWluaW5nKHJlbWFpbmluZykgfTtcbn07XG5cbmNvbnN0IHJlc29sdmVGcmFtZXdvcmsgPSAoKSA9PiB7XG4gICAgaWYgKEZyYW1ld29yaykgcmV0dXJuIEZyYW1ld29yaztcblxuICAgIGNvbnN0IGNvbmZpZ3VyZWQgPSBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV07XG4gICAgaWYgKHR5cGVvZiBjb25maWd1cmVkPy5HZXRDb3JlT2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBjb25maWd1cmVkLkdldENvcmVPYmplY3QoKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBmYWxsIHRocm91Z2ggdG8gcmV0dXJuIGNvbmZpZ3VyZWQgZGlyZWN0bHlcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29uZmlndXJlZCkgcmV0dXJuIGNvbmZpZ3VyZWQ7XG5cbiAgICBjb25zdCBxYiA9IGV4cG9ydHNbJ3FiLWNvcmUnXT8uR2V0Q29yZU9iamVjdD8uKCk7XG4gICAgaWYgKHFiKSByZXR1cm4gcWI7XG5cbiAgICBjb25zdCBxYnggPSBleHBvcnRzWydxYngtY29yZSddID8/IGV4cG9ydHNbJ3FieF9jb3JlJ107XG4gICAgaWYgKHR5cGVvZiBxYng/LkdldENvcmVPYmplY3QgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIHFieC5HZXRDb3JlT2JqZWN0KCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHJldHVybiBxYnggZGlyZWN0bHlcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcWJ4O1xufTtcblxuY29uc3QgZ2V0UGxheWVyID0gKHNyYzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgZncgPSByZXNvbHZlRnJhbWV3b3JrKCk7XG4gICAgcmV0dXJuIGZ3Py5GdW5jdGlvbnM/LkdldFBsYXllcj8uKHNyYykgPz8gZnc/LkdldFBsYXllcj8uKHNyYyk7XG59O1xuXG5vbk5ldChcImRhaWx5U3BpbjpnZXRTdGF0ZVNlcnZlclwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcihzcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBjb25zdCB7IGNhbkNsYWltLCBsYXN0Q2xhaW1lZERpc3BsYXkgfSA9IGdldENvb2xkb3duU3RhdGUocGxheWVyKTtcblxuICAgIGVtaXROZXQoXCJkYWlseVNwaW46cmV0dXJuU3RhdGVcIiwgc3JjLCB7XG4gICAgICAgIHVzZXJEYXRhOiB7XG4gICAgICAgICAgICBjYW5DbGFpbSxcbiAgICAgICAgICAgIGxhc3RDbGFpbWVkRGlzcGxheSxcbiAgICAgICAgfSxcbiAgICAgICAgcm91bGV0dGVEYXRhOiBEYWlseVNwaW5Db25maWcuUm91bGV0dGVEYXRhLFxuICAgICAgICBwcm9iYWJpbGl0eTogRGFpbHlTcGluQ29uZmlnLlJhcml0eVByb2JhYmlsaXR5LFxuICAgICAgICBhbmltYXRpb25EdXJhdGlvbjogRGFpbHlTcGluQ29uZmlnLkFuaW1hdGlvbkR1cmF0aW9uLFxuICAgIH0pO1xufSk7XG5cbm9uTmV0KFwiZGFpbHlTcGluOmNsYWltU2VydmVyXCIsICgpID0+IHtcbiAgICBjb25zdCBzcmMgPSBOdW1iZXIoZ2xvYmFsLnNvdXJjZSk7XG4gICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyKHNyYyk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybjtcblxuICAgIHBsYXllci5GdW5jdGlvbnMuU2V0TWV0YURhdGEoXCJQaG9uZURhaWx5U3BpblwiLCBub3dJblNlY29uZHMoKSk7XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46cmV3YXJkU2VydmVyXCIsIChpZDogbnVtYmVyKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcihzcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBjb25zdCByZXdhcmRJZCA9IE51bWJlcihpZCk7XG4gICAgaWYgKE51bWJlci5pc05hTihyZXdhcmRJZCkpIHJldHVybjtcblxuICAgIGNvbnN0IHJld2FyZCA9IERhaWx5U3BpbkNvbmZpZy5Sb3VsZXR0ZURhdGFbcmV3YXJkSWRdO1xuICAgIGlmICghcmV3YXJkKSByZXR1cm47XG5cbiAgICBzd2l0Y2ggKHJld2FyZC50eXBlKSB7XG4gICAgICAgIGNhc2UgXCJ2ZWhpY2xlXCI6XG4gICAgICAgICAgICBlbWl0KFwiZGFpbHlTcGluOmdpdmVWZWhpY2xlXCIsIHJld2FyZC5tb2RlbCwgc3JjKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiaXRlbVwiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlSXRlbVwiLCByZXdhcmQubW9kZWwsIHJld2FyZC5xdWFudGl0eSA/PyAxLCBzcmMpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJjYXNoXCI6XG4gICAgICAgICAgICBlbWl0KFwiZGFpbHlTcGluOmdpdmVDYXNoXCIsIHJld2FyZC5tb2RlbCwgc3JjKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiYmFua1wiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlQmFua1wiLCByZXdhcmQubW9kZWwsIHNyYyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIndlYXBvblwiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlV2VhcG9uXCIsIHJld2FyZC5tb2RlbCwgc3JjKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpzZWxsU2VydmVyXCIsIChpZDogbnVtYmVyKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIC8vIFNlbGxpbmcgZGlzYWJsZWQ7IHRyZWF0IHNlbGwgYXMgY29sbGVjdC9yZXdhcmRcbiAgICBlbWl0KFwiZGFpbHlTcGluOnJld2FyZFNlcnZlclwiLCBpZCwgc3JjKTtcbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpnaXZlSXRlbVwiLCAoaXRlbTogc3RyaW5nLCBxdHkgPSAxLCBzcmM/OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCB0YXJnZXRTcmMgPSBzcmMgPz8gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXRTcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLkFkZEl0ZW0oaXRlbSwgcXR5KTtcbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpnaXZlQ2FzaFwiLCAoYW1vdW50OiBudW1iZXIsIHNyYz86IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHRhcmdldFNyYyA9IHNyYyA/PyBOdW1iZXIoZ2xvYmFsLnNvdXJjZSk7XG4gICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyKHRhcmdldFNyYyk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybjtcblxuICAgIHBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoXCJjYXNoXCIsIGFtb3VudCwgXCJkYWlseS1zcGluLWNhc2hcIik7XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46Z2l2ZUJhbmtcIiwgKGFtb3VudDogbnVtYmVyLCBzcmM/OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCB0YXJnZXRTcmMgPSBzcmMgPz8gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXRTcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KFwiYmFua1wiLCBhbW91bnQsIFwiZGFpbHktc3Bpbi1iYW5rXCIpO1xufSk7XG5cbm9uTmV0KFwiZGFpbHlTcGluOmdpdmVXZWFwb25cIiwgKHdlYXBvbjogc3RyaW5nLCBzcmM/OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCB0YXJnZXRTcmMgPSBzcmMgPz8gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXRTcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLkFkZEl0ZW0od2VhcG9uLCBEYWlseVNwaW5Db25maWcuV2VhcG9uQW1vdW50KTtcbn0pO1xuXG5jb25zdCBnZW5lcmF0ZVBsYXRlID0gYXN5bmMgKCk6IFByb21pc2U8c3RyaW5nPiA9PiB7XG4gICAgY29uc3QgZncgPSByZXNvbHZlRnJhbWV3b3JrKCk7XG4gICAgaWYgKCFmdz8uU2hhcmVkKSByZXR1cm4gXCJTUElOMTIzXCI7XG5cbiAgICBjb25zdCBwbGF0ZSA9IGAke2Z3LlNoYXJlZC5SYW5kb21JbnQoMSl9JHtmdy5TaGFyZWQuUmFuZG9tU3RyKDIpfSR7ZncuU2hhcmVkLlJhbmRvbUludCgzKX0ke2Z3LlNoYXJlZC5SYW5kb21TdHIoMil9YDtcblxuICAgIGNvbnN0IGV4aXN0cyA9IE15U1FMPy5zY2FsYXIgPyBhd2FpdCBNeVNRTC5zY2FsYXIoXCJTRUxFQ1QgcGxhdGUgRlJPTSBwbGF5ZXJfdmVoaWNsZXMgV0hFUkUgcGxhdGUgPSA/XCIsIFtwbGF0ZV0pIDogbnVsbDtcbiAgICBpZiAoZXhpc3RzKSB7XG4gICAgICAgIHJldHVybiBnZW5lcmF0ZVBsYXRlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBsYXRlLnRvVXBwZXJDYXNlKCk7XG59O1xuXG5vbk5ldChcImRhaWx5U3BpbjpnaXZlVmVoaWNsZVwiLCBhc3luYyAobW9kZWw6IHN0cmluZywgc3JjPzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0U3JjID0gc3JjID8/IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIodGFyZ2V0U3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgY29uc3QgcGxhdGUgPSBhd2FpdCBnZW5lcmF0ZVBsYXRlKCk7XG5cbiAgICBhd2FpdCBNeVNRTD8uaW5zZXJ0Py4oXG4gICAgICAgIFwiSU5TRVJUIElOVE8gcGxheWVyX3ZlaGljbGVzIChsaWNlbnNlLCBjaXRpemVuaWQsIHZlaGljbGUsIGhhc2gsIG1vZHMsIHBsYXRlLCBnYXJhZ2UsIHN0YXRlKSBWQUxVRVMgKD8sID8sID8sID8sID8sID8sID8sID8pXCIsXG4gICAgICAgIFtcbiAgICAgICAgICAgIHBsYXllci5QbGF5ZXJEYXRhLmxpY2Vuc2UsXG4gICAgICAgICAgICBwbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICBtb2RlbCxcbiAgICAgICAgICAgIEdldEhhc2hLZXkobW9kZWwpLFxuICAgICAgICAgICAgXCJ7fVwiLFxuICAgICAgICAgICAgcGxhdGUsXG4gICAgICAgICAgICBEYWlseVNwaW5Db25maWcuQ2FyUGFya2luZ1NwYXduLFxuICAgICAgICAgICAgMCwgLy8gc3RvcmVkXG4gICAgICAgIF1cbiAgICApO1xufSk7XG5cbmNvbnN0IGNvbW1hbmRDdHggPSByZXNvbHZlRnJhbWV3b3JrKCk/LkNvbW1hbmRzO1xuaWYgKGNvbW1hbmRDdHg/LkFkZCkge1xuICAgIGNvbW1hbmRDdHguQWRkKFxuICAgICAgICBcInJlc2V0ZGFpbHlzcGluXCIsXG4gICAgICAgIFwiUmVzZXQgYSBwbGF5ZXIncyBkYWlseSBzcGluIGNvb2xkb3duXCIsXG4gICAgICAgIFt7IG5hbWU6IFwiaWRcIiwgaGVscDogXCJQbGF5ZXIgSURcIiB9XSxcbiAgICAgICAgdHJ1ZSxcbiAgICAgICAgKHNvdXJjZTogbnVtYmVyLCBhcmdzOiBzdHJpbmdbXSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gTnVtYmVyKGFyZ3NbMF0pO1xuICAgICAgICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgICAgICAgICBlbWl0TmV0KFwiUUJDb3JlOk5vdGlmeVwiLCBzb3VyY2UsIFwiSW52YWxpZCBJRFwiLCBcImVycm9yXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyKHRhcmdldCk7XG4gICAgICAgICAgICBpZiAoIXBsYXllcikge1xuICAgICAgICAgICAgICAgIGVtaXROZXQoXCJRQkNvcmU6Tm90aWZ5XCIsIHNvdXJjZSwgXCJQbGF5ZXIgbm90IG9ubGluZVwiLCBcImVycm9yXCIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcGxheWVyLkZ1bmN0aW9ucy5TZXRNZXRhRGF0YShcIlBob25lRGFpbHlTcGluXCIsIDApO1xuXG4gICAgICAgICAgICBlbWl0TmV0KFwiUUJDb3JlOk5vdGlmeVwiLCBzb3VyY2UsIGBEYWlseSBzcGluIHJlc2V0IGZvciBJRCAke3RhcmdldH1gLCBcInN1Y2Nlc3NcIik7XG4gICAgICAgICAgICBlbWl0TmV0KFwiUUJDb3JlOk5vdGlmeVwiLCB0YXJnZXQsIFwiWW91ciBEYWlseSBTcGluIGhhcyBiZWVuIHJlc2V0IVwiLCBcInN1Y2Nlc3NcIik7XG4gICAgICAgIH0sXG4gICAgICAgIFwiYWRtaW5cIlxuICAgICk7XG59IGVsc2Uge1xuICAgIGNvbnNvbGUud2FybihcIltzdW1taXRfcGhvbmVdIEZyYW1ld29yay5Db21tYW5kcy5BZGQgbm90IGF2YWlsYWJsZTsgcmVzZXRkYWlseXNwaW4gY29tbWFuZCBub3QgcmVnaXN0ZXJlZC5cIik7XG59XG4iLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcblxuY29uc3QgSlNPTl9DT0xVTU5TID0gbmV3IFNldChbXG4gICAgJ21lc3NhZ2VzJywgJ3Bob3RvcycsICdpbnRlcmVzdHMnLCAnaW50ZXJlc3RlZEluR2VuZGVycycsICdsaWZlc3R5bGUnLFxuICAgICdwcm9tcHRzJywgJ2ZvbGxvd2VycycsICdmb2xsb3dpbmcnLCAnbGlrZUNvdW50JywgJ3JlcGxpZXNDb3VudCcsXG4gICAgJ3JldHdlZXRDb3VudCcsICdoYXNodGFncycsICdhdHRhY2htZW50cycsICdiYWNrZ3JvdW5kJywgJ2xvY2tzY3JlZW4nLFxuICAgICdyaW5ndG9uZScsICdjb29yZHMnLCAnY2hhcmluZm8nLCAnam9iJywgJ21ldGFkYXRhJywgJ2l0ZW1zJywgJ2ludmVudG9yeScsXG4gICAgJ2dyYWRlJywgJ2RhdGEnLCAnYmxvY2tlZE51bWJlcnMnLCAnZGVsZXRlZE1lc3NhZ2VzJ1xuXSk7XG5cbmV4cG9ydCBjbGFzcyBNeVNRTEFkYXB0ZXIge1xuICAgIGNvbnN0cnVjdG9yKCkge31cblxuICAgIGlzREJDb25uZWN0ZWQoKSB7XG4gICAgICAgIHJldHVybiB0cnVlOyAvLyBveG15c3FsIGlzIHVzdWFsbHkgcmVhZHlcbiAgICB9XG5cbiAgICAvLyBIZWxwZXIgdG8gcGFyc2UgcG90ZW50aWFsIEpTT04gZmllbGRzXG4gICAgcHJpdmF0ZSBwYXJzZVJvdyhyb3c6IGFueSkge1xuICAgICAgICBpZiAoIXJvdykgcmV0dXJuIHJvdztcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gcm93KSB7XG4gICAgICAgICAgICBpZiAoSlNPTl9DT0xVTU5TLmhhcyhrZXkpICYmIHR5cGVvZiByb3dba2V5XSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByb3dba2V5XSA9IEpTT04ucGFyc2Uocm93W2tleV0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS53YXJuKGBGYWlsZWQgdG8gcGFyc2UgSlNPTiBmb3Iga2V5ICR7a2V5fTpgLCBlKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gS2VlcCBvcmlnaW5hbCB2YWx1ZSBpZiBwYXJzZSBmYWlsc1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcm93O1xuICAgIH1cblxuICAgIHByaXZhdGUgdHJhbnNsYXRlUXVlcnkocXVlcnk6IGFueSk6IHsgc3FsOiBzdHJpbmcsIHBhcmFtczogYW55W10gfSB7XG4gICAgICAgIGlmICghcXVlcnkgfHwgT2JqZWN0LmtleXMocXVlcnkpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3FsOiBcIjE9MVwiLCBwYXJhbXM6IFtdIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb25kaXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBwYXJhbXM6IGFueVtdID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gcXVlcnkpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gcXVlcnlba2V5XTtcblxuICAgICAgICAgICAgaWYgKGtleSA9PT0gJyRvcicpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBvckNvbmRpdGlvbnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBzdWJRdWVyeSBvZiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHNxbCwgcGFyYW1zOiBzdWJQYXJhbXMgfSA9IHRoaXMudHJhbnNsYXRlUXVlcnkoc3ViUXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICBvckNvbmRpdGlvbnMucHVzaChgKCR7c3FsfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2goLi4uc3ViUGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGAoJHtvckNvbmRpdGlvbnMuam9pbignIE9SICcpfSlgKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGtleSA9PT0gJyRhbmQnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYW5kQ29uZGl0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHN1YlF1ZXJ5IG9mIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgc3FsLCBwYXJhbXM6IHN1YlBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShzdWJRdWVyeSk7XG4gICAgICAgICAgICAgICAgICAgIGFuZENvbmRpdGlvbnMucHVzaChgKCR7c3FsfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2goLi4uc3ViUGFyYW1zKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGAoJHthbmRDb25kaXRpb25zLmpvaW4oJyBBTkQgJyl9KWApO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBPcGVyYXRvcnNcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUuJG5lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPD4gP2ApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCh2YWx1ZS4kbmUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuJGd0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPiA/YCk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKHZhbHVlLiRndCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kZ3RlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPj0gP2ApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCh2YWx1ZS4kZ3RlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLiRsdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgIDwgP2ApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCh2YWx1ZS4kbHQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuJGx0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgIDw9ID9gKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUuJGx0ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kaW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUuJGluLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgMT0wYCk7IC8vIEluIGVtcHR5IGFycmF5IGlzIGFsd2F5cyBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gdmFsdWUuJGluLm1hcCgoKSA9PiAnPycpLmpvaW4oJywnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgIElOICgke3BsYWNlaG9sZGVyc30pYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCguLi52YWx1ZS4kaW4pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kbmluICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZS4kbmluLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgMT0xYCk7IC8vIE5vdCBpbiBlbXB0eSBhcnJheSBpcyBhbHdheXMgdHJ1ZVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0gdmFsdWUuJG5pbi5tYXAoKCkgPT4gJz8nKS5qb2luKCcsJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCBOT1QgSU4gKCR7cGxhY2Vob2xkZXJzfSlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKC4uLnZhbHVlLiRuaW4pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kcmVnZXggIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCBMSUtFID9gKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2goYCUke3ZhbHVlLiRyZWdleH0lYCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgIC8vIEFzc3VtZSBkaXJlY3QgZXF1YWxpdHkgZm9yIG9iamVjdCBpZiBubyBrbm93biBvcGVyYXRvciAob3IgaGFuZGxlZCBhcyBKU09OPylcbiAgICAgICAgICAgICAgICAgICAgIC8vIE1vbmdvREIgZG9lcyBleGFjdCBtYXRjaCBvbiBvYmplY3QuIE15U1FMIGNhbid0IGVhc2lseS5cbiAgICAgICAgICAgICAgICAgICAgIC8vIEJ1dCBmb3Igbm93LCBsZXQncyB0cmVhdCBpdCBhcyBzdHJpbmcgb3IgaWdub3JlP1xuICAgICAgICAgICAgICAgICAgICAgLy8gSWYgaXQgaXMgYSBkYXRlIG9iamVjdD9cbiAgICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgID0gP2ApO1xuICAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgPSA/YCk7XG4gICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgc3FsOiBjb25kaXRpb25zLmpvaW4oJyBBTkQgJyksIHBhcmFtcyB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgdHJhbnNsYXRlT3B0aW9ucyhvcHRpb25zOiBhbnkpOiBzdHJpbmcge1xuICAgICAgICBsZXQgc3FsID0gXCJcIjtcbiAgICAgICAgaWYgKCFvcHRpb25zKSByZXR1cm4gc3FsO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnNvcnQpIHtcbiAgICAgICAgICAgIGNvbnN0IHNvcnRQYXJ0cyA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gb3B0aW9ucy5zb3J0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlyID0gb3B0aW9ucy5zb3J0W2tleV0gPT09IDEgPyAnQVNDJyA6ICdERVNDJztcbiAgICAgICAgICAgICAgICBzb3J0UGFydHMucHVzaChgXFxgJHtrZXl9XFxgICR7ZGlyfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNvcnRQYXJ0cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgc3FsICs9IGAgT1JERVIgQlkgJHtzb3J0UGFydHMuam9pbignLCAnKX1gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubGltaXQpIHtcbiAgICAgICAgICAgIHNxbCArPSBgIExJTUlUICR7TnVtYmVyKG9wdGlvbnMubGltaXQpfWA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5za2lwKSB7XG4gICAgICAgICAgICBzcWwgKz0gYCBPRkZTRVQgJHtOdW1iZXIob3B0aW9ucy5za2lwKX1gO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHNxbDtcbiAgICB9XG5cbiAgICBhc3luYyBmaW5kT25lKGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSwgcHJvamVjdGlvbj86IGFueSwgb3B0aW9ucz86IGFueSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIGNvbnN0IHNxbCA9IGBTRUxFQ1QgKiBGUk9NIFxcYCR7Y29sbGVjdGlvbn1cXGAgV0hFUkUgJHt3aGVyZUNsYXVzZX0gTElNSVQgMWA7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwuc2luZ2xlX2FzeW5jKHNxbCwgcGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlUm93KHJlc3VsdCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNeVNRTEFkYXB0ZXJdIGZpbmRPbmUgZXJyb3IgaW4gJHtjb2xsZWN0aW9ufTpgLCBlKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZmluZE1hbnkoY29sbGVjdGlvbjogc3RyaW5nLCBxdWVyeTogYW55LCBwcm9qZWN0aW9uPzogYW55LCB1bmtub3duPzogYW55LCBvcHRpb25zPzogYW55KSB7XG4gICAgICAgIGNvbnN0IHsgc3FsOiB3aGVyZUNsYXVzZSwgcGFyYW1zIH0gPSB0aGlzLnRyYW5zbGF0ZVF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgbGV0IHNxbCA9IGBTRUxFQ1QgKiBGUk9NIFxcYCR7Y29sbGVjdGlvbn1cXGAgV0hFUkUgJHt3aGVyZUNsYXVzZX1gO1xuICAgICAgICBzcWwgKz0gdGhpcy50cmFuc2xhdGVPcHRpb25zKG9wdGlvbnMpO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHMub3hteXNxbC5xdWVyeV9hc3luYyhzcWwsIHBhcmFtcyk7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXN1bHRzKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHRzLm1hcChyb3cgPT4gdGhpcy5wYXJzZVJvdyhyb3cpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gZmluZE1hbnkgZXJyb3IgaW4gJHtjb2xsZWN0aW9ufTpgLCBlKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGluc2VydE9uZShjb2xsZWN0aW9uOiBzdHJpbmcsIGRvYzogYW55KSB7XG4gICAgICAgIGlmICghZG9jKSByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKCFkb2MuX2lkKSBkb2MuX2lkID0gZ2VuZXJhdGVVVWlkKCk7XG5cbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGRvYyk7XG4gICAgICAgIGNvbnN0IHZhbHVlcyA9IE9iamVjdC52YWx1ZXMoZG9jKS5tYXAodiA9PiB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09ICdvYmplY3QnICYmIHYgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcGxhY2Vob2xkZXJzID0ga2V5cy5tYXAoKCkgPT4gJz8nKS5qb2luKCcsJyk7XG4gICAgICAgIGNvbnN0IGNvbHVtbnMgPSBrZXlzLm1hcChrID0+IGBcXGAke2t9XFxgYCkuam9pbignLCcpO1xuICAgICAgICBjb25zdCBzcWwgPSBgSU5TRVJUIElOVE8gXFxgJHtjb2xsZWN0aW9ufVxcYCAoJHtjb2x1bW5zfSkgVkFMVUVTICgke3BsYWNlaG9sZGVyc30pYDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZ2xvYmFsLmV4cG9ydHMub3hteXNxbC5pbnNlcnRfYXN5bmMoc3FsLCB2YWx1ZXMpO1xuICAgICAgICAgICAgcmV0dXJuIGRvYzsgLy8gTW9uZ29EQiBpbnNlcnRPbmUgcmV0dXJucyByZXN1bHQsIGJ1dCBjb2RlIGV4cGVjdHMgdGhlIGRvYyBvZnRlbiBvciBjaGVja3MgdHJ1dGhpbmVzc1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gaW5zZXJ0T25lIGVycm9yIGluICR7Y29sbGVjdGlvbn06YCwgZSk7XG4gICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyB1cGRhdGVPbmUoY29sbGVjdGlvbjogc3RyaW5nLCBxdWVyeTogYW55LCB1cGRhdGU6IGFueSwgb3B0aW9ucz86IGFueSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtczogd2hlcmVQYXJhbXMgfSA9IHRoaXMudHJhbnNsYXRlUXVlcnkocXVlcnkpO1xuXG4gICAgICAgIC8vIEhhbmRsZSAkc2V0LCAkcHVzaCwgZXRjP1xuICAgICAgICAvLyBDb2RlIG1vc3RseSB1c2VzIHJlcGxhY2VtZW50IG9iamVjdCBvciBzaW1wbGUgdXBkYXRlLlxuICAgICAgICAvLyBJZiAndXBkYXRlJyBoYXMgdG9wIGxldmVsIGtleXMgdGhhdCBhcmUgbm90IG9wZXJhdG9ycywgaXQgbWlnaHQgYmUgYSByZXBsYWNlbWVudD9cbiAgICAgICAgLy8gTW9uZ29EQiB1cGRhdGVPbmUoZmlsdGVyLCB1cGRhdGUsIG9wdGlvbnMpXG4gICAgICAgIC8vIElmIHVwZGF0ZSBjb250YWlucyBhdG9taWMgb3BlcmF0b3JzICgkc2V0KSwgaXQgdXBkYXRlcyBmaWVsZHMuXG4gICAgICAgIC8vIElmIGl0IGRvZXNuJ3QsIGl0IFJFUExBQ0VTIHRoZSBkb2N1bWVudCAoaW4gc29tZSBkcml2ZXIgdmVyc2lvbnMpIGJ1dCB1c3VhbGx5IHVwZGF0ZU9uZSByZXF1aXJlcyAkc2V0IGluIG1vZGVybiBtb25nbz9cbiAgICAgICAgLy8gQ2hlY2tpbmcgdGhlIGNvZGU6IGBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogY29udGFjdERhdGEuX2lkIH0sIHsgLi4uY29udGFjdERhdGEgfSk7YFxuICAgICAgICAvLyBUaGlzIGxvb2tzIGxpa2UgYSByZXBsYWNlbWVudCBvciBtZXJnZS5cbiAgICAgICAgLy8gYGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSwgZGF0YVgpO2BcbiAgICAgICAgLy8gYGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBwbGF5ZXIgfSwgeyBqb2JDYWxsczogIVBsYXllckRhdGEuam9iQ2FsbHMgfSk7YCAtPiBUaGlzIGxvb2tzIGxpa2UgYSBwYXJ0aWFsIHVwZGF0ZSAobWVyZ2UpLlxuICAgICAgICAvLyBTaW5jZSBJJ20gdXNpbmcgU1FMLCBgVVBEQVRFIHRhYmxlIFNFVCAuLi5gIGlzIHBhcnRpYWwgdXBkYXRlIGJ5IGRlZmF1bHQuXG5cbiAgICAgICAgLy8gQnV0IHdoYXQgaWYgdGhleSB1c2UgYCRzZXRgP1xuICAgICAgICBsZXQgdXBkYXRlRGF0YSA9IHVwZGF0ZTtcbiAgICAgICAgaWYgKHVwZGF0ZS4kc2V0KSB7XG4gICAgICAgICAgICB1cGRhdGVEYXRhID0geyAuLi51cGRhdGVEYXRhLCAuLi51cGRhdGUuJHNldCB9O1xuICAgICAgICAgICAgZGVsZXRlIHVwZGF0ZURhdGEuJHNldDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFdoYXQgaWYgdGhleSB1c2UgYCRwdXNoYD9cbiAgICAgICAgLy8gYHR3ZWV0Lmxpa2VDb3VudC5wdXNoKGVtYWlsKTsgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoLi4uLCB0d2VldCk7YFxuICAgICAgICAvLyBUaGUgY29kZSB1c3VhbGx5IG1vZGlmaWVzIHRoZSBvYmplY3QgaW4gbWVtb3J5IGFuZCB0aGVuIHNhdmVzIHRoZSB3aG9sZSBvYmplY3QgYmFjayFcbiAgICAgICAgLy8gRXhhbXBsZSBpbiBQaWdlb25TZXJ2aWNlOiBgdHdlZXQubGlrZUNvdW50LnB1c2goZW1haWwpOyBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO2BcbiAgICAgICAgLy8gU28gdGhleSBhcmUgc2VuZGluZyB0aGUgRlVMTCBPQkpFQ1QgYXMgYHVwZGF0ZWAuXG4gICAgICAgIC8vIFNvIEkgY2FuIGp1c3QgdXBkYXRlIGFsbCBmaWVsZHMgcHJlc2VudCBpbiBgdXBkYXRlYC5cblxuICAgICAgICBjb25zdCBzZXRDbGF1c2VzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBzZXRQYXJhbXM6IGFueVtdID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdXBkYXRlRGF0YSkge1xuICAgICAgICAgICAgaWYgKGtleSA9PT0gJ19pZCcpIGNvbnRpbnVlOyAvLyBEb24ndCB1cGRhdGUgUEsgdXN1YWxseVxuICAgICAgICAgICAgc2V0Q2xhdXNlcy5wdXNoKGBcXGAke2tleX1cXGAgPSA/YCk7XG4gICAgICAgICAgICBsZXQgdmFsID0gdXBkYXRlRGF0YVtrZXldO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdvYmplY3QnICYmIHZhbCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHZhbCA9IEpTT04uc3RyaW5naWZ5KHZhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXRQYXJhbXMucHVzaCh2YWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNldENsYXVzZXMubGVuZ3RoID09PSAwKSByZXR1cm4gdHJ1ZTtcblxuICAgICAgICBjb25zdCBzcWwgPSBgVVBEQVRFIFxcYCR7Y29sbGVjdGlvbn1cXGAgU0VUICR7c2V0Q2xhdXNlcy5qb2luKCcsICcpfSBXSEVSRSAke3doZXJlQ2xhdXNlfWA7XG4gICAgICAgIGNvbnN0IGZpbmFsUGFyYW1zID0gWy4uLnNldFBhcmFtcywgLi4ud2hlcmVQYXJhbXNdO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBnbG9iYWwuZXhwb3J0cy5veG15c3FsLnVwZGF0ZV9hc3luYyhzcWwsIGZpbmFsUGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiB7IG1vZGlmaWVkQ291bnQ6IDEgfTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gdXBkYXRlT25lIGVycm9yIGluICR7Y29sbGVjdGlvbn06YCwgZSk7XG4gICAgICAgICAgICByZXR1cm4geyBtb2RpZmllZENvdW50OiAwIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBkZWxldGVPbmUoY29sbGVjdGlvbjogc3RyaW5nLCBxdWVyeTogYW55KSB7XG4gICAgICAgIGNvbnN0IHsgc3FsOiB3aGVyZUNsYXVzZSwgcGFyYW1zIH0gPSB0aGlzLnRyYW5zbGF0ZVF1ZXJ5KHF1ZXJ5KTtcbiAgICAgICAgY29uc3Qgc3FsID0gYERFTEVURSBGUk9NIFxcYCR7Y29sbGVjdGlvbn1cXGAgV0hFUkUgJHt3aGVyZUNsYXVzZX0gTElNSVQgMWA7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwudXBkYXRlX2FzeW5jKHNxbCwgcGFyYW1zKTtcbiAgICAgICAgICAgIHJldHVybiB7IGRlbGV0ZWRDb3VudDogMSB9O1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBkZWxldGVPbmUgZXJyb3IgaW4gJHtjb2xsZWN0aW9ufTpgLCBlKTtcbiAgICAgICAgICAgIHJldHVybiB7IGRlbGV0ZWRDb3VudDogMCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZmluZEFuZFJldHVyblNwZWNpZmljRmllbGRzKGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSwgZmllbGRzOiBzdHJpbmdbXSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIGNvbnN0IGNvbHVtbnMgPSBmaWVsZHMubWFwKGYgPT4gYFxcYCR7Zn1cXGBgKS5qb2luKCcsICcpO1xuICAgICAgICBjb25zdCBzcWwgPSBgU0VMRUNUICR7Y29sdW1uc30gRlJPTSBcXGAke2NvbGxlY3Rpb259XFxgIFdIRVJFICR7d2hlcmVDbGF1c2V9IExJTUlUIDFgO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0cy5veG15c3FsLnNpbmdsZV9hc3luYyhzcWwsIHBhcmFtcyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZVJvdyhyZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gZmluZEFuZFJldHVyblNwZWNpZmljRmllbGRzIGVycm9yIGluICR7Y29sbGVjdGlvbn06YCwgZSk7XG4gICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDdXN0b20gaGFuZGxpbmcgZm9yIGFnZ3JlZ2F0aW9uIChzcGVjaWZpY2FsbHkgZm9yIFBpZ2VvbiBjb252ZXJzYXRpb25zKVxuICAgIGFzeW5jIGFnZ3JlZ2F0ZShjb2xsZWN0aW9uOiBzdHJpbmcsIHBpcGVsaW5lOiBhbnlbXSkge1xuICAgICAgICBpZiAoY29sbGVjdGlvbiA9PT0gJ3Bob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzJykge1xuICAgICAgICAgICAgLy8gVGhpcyBpcyBsaWtlbHkgdGhlIGdldENvbnZlcnNhdGlvbnMgY2FsbFxuICAgICAgICAgICAgLy8gV2UgbmVlZCB0byBmZXRjaCBhbGwgbWVzc2FnZXMgZm9yIHRoZSB1c2VyLCBncm91cCBieSBjb252ZXJzYXRpb24gcGFydG5lciwgZmluZCBsYXRlc3QuXG5cbiAgICAgICAgICAgIC8vIEV4dHJhY3QgdXNlckVtYWlsIGZyb20gdGhlIGZpcnN0ICRtYXRjaCBzdGFnZVxuICAgICAgICAgICAgY29uc3QgbWF0Y2hTdGFnZSA9IHBpcGVsaW5lLmZpbmQocyA9PiBzLiRtYXRjaCk7XG4gICAgICAgICAgICBsZXQgdXNlckVtYWlsID0gbnVsbDtcbiAgICAgICAgICAgIGlmIChtYXRjaFN0YWdlKSB7XG4gICAgICAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIHRoZSBlbWFpbC4gSXQncyB1c3VhbGx5IGluICRvcjogW3tzZW5kZXJFbWFpbDogWH0sIHtyZWNpcGllbnRFbWFpbDogWH1dXG4gICAgICAgICAgICAgICAgIGNvbnN0IG9yID0gbWF0Y2hTdGFnZS4kbWF0Y2guJG9yO1xuICAgICAgICAgICAgICAgICBpZiAob3IgJiYgb3JbMF0gJiYgb3JbMF0uc2VuZGVyRW1haWwpIHVzZXJFbWFpbCA9IG9yWzBdLnNlbmRlckVtYWlsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXVzZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJbTXlTUUxBZGFwdGVyXSBBZ2dyZWdhdGU6IENvdWxkIG5vdCBpZGVudGlmeSB1c2VyRW1haWwgZnJvbSBwaXBlbGluZVwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNRTCBTdHJhdGVneTpcbiAgICAgICAgICAgIC8vIDEuIEdldCBhbGwgbWVzc2FnZXMgd2hlcmUgc2VuZGVyIG9yIHJlY2lwaWVudCBpcyB1c2VyRW1haWxcbiAgICAgICAgICAgIC8vIDIuIFNvcnQgYnkgZGF0ZSBERVNDXG4gICAgICAgICAgICAvLyAzLiBQcm9jZXNzIGluIEpTIHRvIEdyb3VwXG5cbiAgICAgICAgICAgIGNvbnN0IHNxbCA9IGBTRUxFQ1QgKiBGUk9NIFxcYHBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXFxgIFdIRVJFIFxcYHNlbmRlckVtYWlsXFxgID0gPyBPUiBcXGByZWNpcGllbnRFbWFpbFxcYCA9ID8gT1JERVIgQlkgXFxgY3JlYXRlZEF0XFxgIERFU0NgO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlcyA9IGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwucXVlcnlfYXN5bmMoc3FsLCBbdXNlckVtYWlsLCB1c2VyRW1haWxdKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbnMgPSBuZXcgTWFwKCk7XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IG1zZyBvZiBtZXNzYWdlcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvdGhlckVtYWlsID0gbXNnLnNlbmRlckVtYWlsID09PSB1c2VyRW1haWwgPyBtc2cucmVjaXBpZW50RW1haWwgOiBtc2cuc2VuZGVyRW1haWw7XG4gICAgICAgICAgICAgICAgICAgIGlmICghY29udmVyc2F0aW9ucy5oYXMob3RoZXJFbWFpbCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnZlcnNhdGlvbnMuc2V0KG90aGVyRW1haWwsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogdGhpcy5wYXJzZVJvdyhtc2cpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVucmVhZENvdW50OiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG90aGVyRW1haWw6IG90aGVyRW1haWxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udiA9IGNvbnZlcnNhdGlvbnMuZ2V0KG90aGVyRW1haWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobXNnLnJlY2lwaWVudEVtYWlsID09PSB1c2VyRW1haWwgJiYgbXNnLnJlYWQgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnYudW5yZWFkQ291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE5vdyB3ZSBuZWVkIHRvIGZldGNoIHVzZXIgaW5mbyBmb3IgZWFjaCBjb252ZXJzYXRpb25cbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNvbnYgb2YgY29udmVyc2F0aW9ucy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgdGhpcy5maW5kT25lKCdwaG9uZV9waWdlb25fdXNlcnMnLCB7IGVtYWlsOiBjb252Lm90aGVyRW1haWwgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG90aGVyVXNlcjogdXNlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlOiBjb252Lmxhc3RNZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IGNvbnYudW5yZWFkQ291bnRcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBBZ2dyZWdhdGUgZXJyb3I6YCwgZSk7XG4gICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUud2FybihgW015U1FMQWRhcHRlcl0gVW5oYW5kbGVkIGFnZ3JlZ2F0aW9uIGZvciBjb2xsZWN0aW9uICR7Y29sbGVjdGlvbn1gKTtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbn1cbiIsICJpbXBvcnQgXCIuL3N2X2V4cG9ydHNcIjtcbmltcG9ydCBcIi4vYXBwcy9pbmRleFwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiLi9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL2FwcHMvU2V0dGluZ3MvY2xhc3NcIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgSW52b2ljZVJlY3VycmluZ1BheW1lbnRzIH0gZnJvbSBcIi4vYXBwcy9XYWxsZXQvY2FsbGJhY2tzXCI7XG5pbXBvcnQgeyBwaWdlb25TZXJ2aWNlIH0gZnJvbSBcIi4vYXBwcy9QaWdlb24vUGlnZW9uU2VydmljZVwiO1xuaW1wb3J0IHsgTXlTUUxBZGFwdGVyIH0gZnJvbSBcIi4vY2xhc3Nlcy9NeVNRTEFkYXB0ZXJcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5jb25zdCByZXNvbHZlRnJhbWV3b3JrID0gKCkgPT4ge1xuICAgIGNvbnN0IGNvbmZpZ3VyZWQgPSBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV07XG4gICAgaWYgKHR5cGVvZiBjb25maWd1cmVkPy5HZXRDb3JlT2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBjb25maWd1cmVkLkdldENvcmVPYmplY3QoKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBmYWxsIHRocm91Z2ggdG8gcmV0dXJuIGNvbmZpZ3VyZWQgZGlyZWN0bHlcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoY29uZmlndXJlZCkgcmV0dXJuIGNvbmZpZ3VyZWQ7XG5cbiAgICBjb25zdCBxYiA9IGV4cG9ydHNbJ3FiLWNvcmUnXT8uR2V0Q29yZU9iamVjdD8uKCk7XG4gICAgaWYgKHFiKSByZXR1cm4gcWI7XG4gICAgaWYgKGV4cG9ydHNbJ3FiLWNvcmUnXSkgcmV0dXJuIGV4cG9ydHNbJ3FiLWNvcmUnXTtcblxuICAgIGNvbnN0IHFieCA9IGV4cG9ydHNbJ3FieC1jb3JlJ10gPz8gZXhwb3J0c1sncWJ4X2NvcmUnXTtcbiAgICBpZiAodHlwZW9mIHFieD8uR2V0Q29yZU9iamVjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gcWJ4LkdldENvcmVPYmplY3QoKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBmYWxsIHRocm91Z2ggdG8gcmV0dXJuIHFieCBkaXJlY3RseVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBxYng7XG59O1xuXG5leHBvcnQgbGV0IEZyYW1ld29yayA9IHJlc29sdmVGcmFtZXdvcmsoKTtcblxuZXhwb3J0IGNvbnN0IE1vbmdvREIgPSBuZXcgTXlTUUxBZGFwdGVyKCk7XG5cbmV4cG9ydCBjb25zdCBNeVNRTCA9IGV4cG9ydHMub3hteXNxbDtcbmV4cG9ydCBjb25zdCBMb2dnZXIgPSBleHBvcnRzWydxYi1zbWFsbHJlc291cmNlcyddO1xuXG50eXBlIEV4dGVybmFsTWFpbERhdGEgPSB7XG4gICAgZW1haWw/OiBzdHJpbmc7XG4gICAgc3ViamVjdD86IHN0cmluZztcbiAgICBtZXNzYWdlPzogc3RyaW5nO1xuICAgIGltYWdlcz86IHN0cmluZ1tdO1xufTtcblxub24oJ1FCQ29yZTpTZXJ2ZXI6VXBkYXRlT2JqZWN0JywgKCkgPT4ge1xuICAgIEZyYW1ld29yayA9IHJlc29sdmVGcmFtZXdvcmsoKTtcbn0pO1xuXG5zZXRJbW1lZGlhdGUoKCkgPT4ge1xuICAgIFV0aWxzLmxvYWQoKTtcbiAgICBTZXR0aW5ncy5sb2FkKCk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6c2VydmVyOnNoYXJlTnVtYmVyJywgYXN5bmMgKHNvdXJjZTogYW55LCBjb21pbmdTb3VyY2U6IGFueSkgPT4ge1xuICAgIGNvbnN0IHNvdXJjZVggPSBzb3VyY2U7XG4gICAgY29uc3Qgc291cmNlTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2VYKTtcbiAgICBjb25zdCBhY051bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY29taW5nU291cmNlKTtcbiAgICBjb25zdCBmdWxsbmFtZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZVgpO1xuICAgIGNvbnN0IGJyZWFrZWROYW1lID0gZnVsbG5hbWUuc3BsaXQoJyAnKTtcblxuICAgIGlmICghc291cmNlTnVtYmVyIHx8ICFhY051bWJlcikgcmV0dXJuO1xuICAgIGNvbnN0IGNvbnRhY3REYXRhID0ge1xuICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICBwZXJzb25hbE51bWJlcjogYWNOdW1iZXIsXG4gICAgICAgIGNvbnRhY3ROdW1iZXI6IHNvdXJjZU51bWJlcixcbiAgICAgICAgZmlyc3ROYW1lOiBicmVha2VkTmFtZVswXSxcbiAgICAgICAgbGFzdE5hbWU6IGJyZWFrZWROYW1lWzFdLFxuICAgICAgICBpbWFnZTogYXdhaXQgVXRpbHMuR2V0Q29udGFjdEF2YXRhckJ5TnVtYmVyKHNvdXJjZU51bWJlciwgYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihzb3VyY2VOdW1iZXIpKSxcbiAgICAgICAgb3duZXJJZDogYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihhY051bWJlciksXG4gICAgICAgIG5vdGVzOiBcIlwiLFxuICAgICAgICBlbWFpbDogXCJcIixcbiAgICAgICAgaXNGYXY6IGZhbHNlXG4gICAgfVxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IHBlcnNvbmFsTnVtYmVyOiBhY051bWJlciwgY29udGFjdE51bWJlcjogc291cmNlTnVtYmVyIH0pO1xuICAgIGlmIChyZXMpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlWCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYE51bWJlciBBbHJlYWR5IFNoYXJlZC5gLFxuICAgICAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgTnVtYmVyKHNvdXJjZVgpLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiUGhvbmVcIixcbiAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBzaGFyZWQgeW91ciBQaG9uZSBOdW1iZXIuYCxcbiAgICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgfSkpO1xuICAgIGNvbnN0IHNlbmRJZCA9IGdlbmVyYXRlVVVpZCgpO1xuICAgIGVtaXROZXQoJ3Bob25lOmFkZEFjdGlvbk5vdGlmaWNhdGlvbicsIE51bWJlcihjb21pbmdTb3VyY2UpLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBzZW5kSWQsXG4gICAgICAgIHRpdGxlOiBcIlBob25lXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgJHtmdWxsbmFtZX0gd2FudHMgdG8gc2hhcmUgdGhlaXIgbnVtYmVyIHdpdGggeW91LmAsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICBpY29uczoge1xuICAgICAgICAgICAgXCIwXCI6IHtcbiAgICAgICAgICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2Nyb3NzLWNpcmNsZS5zdmdcIixcbiAgICAgICAgICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWRkQ29udGFjdFwiLFxuICAgICAgICAgICAgICAgIGFyZ3M6IHt9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgXCIxXCI6IHtcbiAgICAgICAgICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2FjY2VwdC5zdmdcIixcbiAgICAgICAgICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWRkQ29udGFjdFwiLFxuICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgY29udGFjdERhdGEsXG4gICAgICAgICAgICAgICAgICAgIGNvbWluZ1NvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgZnVsbG5hbWUsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSkpO1xuXG59KTtcblxub25OZXQoJ3Bob25lOnNlcnZlcjphZGRDb250YWN0JywgYXN5bmMgKGlkOiBzdHJpbmcsIGRhdGE6IHtcbiAgICBjb21pbmdTb3VyY2U6IGFueSxcbiAgICBmdWxsbmFtZTogc3RyaW5nLFxuICAgIGNvbnRhY3REYXRhOiBhbnksXG4gICAgaWQ6IHN0cmluZ1xufSkgPT4ge1xuICAgIGNvbnN0IHNyYyA9IGdsb2JhbC5zb3VyY2U7XG4gICAgLyogY29uc29sZS5sb2coJ0FkZGluZyBjb250YWN0JywgaWQsIGRhdGEpOyAqL1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHNyYywgaWQpO1xuICAgIGlmICghZGF0YS5jb250YWN0RGF0YSB8fCAhZGF0YS5jb21pbmdTb3VyY2UgfHwgIWRhdGEuZnVsbG5hbWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBhd2FpdCBEZWxheSg1MDApO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc3JjLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgTnVtYmVyIFNhdmVkLmAsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgIH0pKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfY29udGFjdHMnLCBkYXRhLmNvbnRhY3REYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgdGl0bGU6ICdDb250YWN0IFNoYXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGAke2RhdGEuZnVsbG5hbWV9ICwgJHtkYXRhLmNvbnRhY3REYXRhLmNvbnRhY3ROdW1iZXJ9IGhhcyBzaGFyZWQgdGhlaXIgbnVtYmVyIHdpdGggJHtkYXRhLmNvbnRhY3REYXRhLnBlcnNvbmFsTnVtYmVyfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbignc3VtbWl0X3Bob25lOnNlcnZlcjpDcm9uVHJpZ2dlcicsIGFzeW5jICgpID0+IHtcbiAgICAvKiBjb25zb2xlLmxvZygnQ3JvbiBUcmlnZ2VyZWQnKTsgKi9cbiAgICBJbnZvaWNlUmVjdXJyaW5nUGF5bWVudHMoKTtcbn0pO1xuXG5SZWdpc3RlckNvbW1hbmQoJ3Jlc2V0UGhvbmVQYXNzY29kZScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgIGlmICghY2l0aXplbklkKSByZXR1cm47XG4gICAgU2V0dGluZ3MubG9ja1Bpbi5zZXQoY2l0aXplbklkLCAnMDAwMDAwJyk7XG4gICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgU2V0dGluZ3MuU2F2ZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZCk7XG4gICAgZW1pdE5ldCgncGhvbmU6Y2xpZW50OnNldHVwUGhvbmUnLCBzb3VyY2UsIGNpdGl6ZW5JZCk7XG59LCBmYWxzZSk7XG5cblJlZ2lzdGVyQ29tbWFuZCgndmVyaWZ5UGVnaW9uJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBhcmdzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGlmICghYXJnc1swXSkge1xuICAgICAgICByZXR1cm4gTE9HR0VSKCdQbGVhc2UgcHJvdmlkZSBhIHZhbGlkIGVtYWlsIGFkZHJlc3MuJyk7XG4gICAgfVxuICAgIGNvbnN0IGVtYWlsID0gYXJnc1swXTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBwaWdlb25TZXJ2aWNlLnZlcmlmeVVzZXIoc291cmNlLCBlbWFpbCk7XG4gICAgaWYgKHJlcyA9PT0gXCJzdWNjZXNzXCIpIHtcbiAgICAgICAgcmV0dXJuIExPR0dFUihgVXNlciAke2VtYWlsfSBoYXMgYmVlbiB2ZXJpZmllZCBzdWNjZXNzZnVsbHkuYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIExPR0dFUihgRmFpbGVkIHRvIHZlcmlmeSB1c2VyICR7ZW1haWx9LiBSZWFzb246ICR7cmVzfWApO1xuICAgIH1cbn0sIHRydWUpO1xuXG5vbignUUJDb3JlOlNlcnZlcjpPblBsYXllclVubG9hZCcsIGFzeW5jIChzcmM6IG51bWJlcikgPT4ge1xuICAgIGlmKCFzcmMpIHJldHVybjtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzcmMpO1xuICAgIGlmICghY2l0aXplbklkKSByZXR1cm47XG4gICAgYXdhaXQgU2V0dGluZ3MuU2F2ZVBsYXllclNldHRpbmdzKGNpdGl6ZW5JZCk7XG4gICAgU2V0dGluZ3Mub25QbGF5ZXJEaXNjb25uZWN0KGNpdGl6ZW5JZCk7XG59KTtcblxub24oJ3BsYXllckRyb3BwZWQnLCBhc3luYyAoKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBpZighc3JjKSByZXR1cm47XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc3JjKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuO1xuICAgIGF3YWl0IFNldHRpbmdzLlNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIFNldHRpbmdzLm9uUGxheWVyRGlzY29ubmVjdChjaXRpemVuSWQpO1xufSlcblxub25OZXQoJ2lnbmlzX3Bob25lOnNlbmROZXdNYWlsJywgYXN5bmMgKHRhcmdldFNvdXJjZTogbnVtYmVyLCBtYWlsRGF0YTogRXh0ZXJuYWxNYWlsRGF0YSkgPT4ge1xuICAgIGNvbnN0IHNyYyA9IE51bWJlcih0YXJnZXRTb3VyY2UgPz8gZ2xvYmFsLnNvdXJjZSk7XG4gICAgY29uc3QgcGxheWVyID0gRnJhbWV3b3JrLkZ1bmN0aW9ucy5HZXRQbGF5ZXIoc3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgY29uc3QgY2l0aXplbklkID0gcGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkO1xuICAgIGNvbnN0IGVtYWlsQWRkcmVzcyA9IGF3YWl0IFV0aWxzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIGlmICghZW1haWxBZGRyZXNzKSByZXR1cm47XG5cbiAgICBhd2FpdCBnbG9iYWwuZXhwb3J0c1snc3VtbWl0X3Bob25lJ10uU2VuZE1haWwoe1xuICAgICAgICBlbWFpbDogbWFpbERhdGE/LmVtYWlsIHx8ICdnb3Zlcm5tZW50QHN1bW1pdC5ycCcsXG4gICAgICAgIHRvOiBlbWFpbEFkZHJlc3MsXG4gICAgICAgIHN1YmplY3Q6IG1haWxEYXRhPy5zdWJqZWN0IHx8ICdFbWFpbCBpcyBub3Qgc2V0dXAgY29ycmVjdGx5IScsXG4gICAgICAgIG1lc3NhZ2U6IG1haWxEYXRhPy5tZXNzYWdlIHx8ICdFbWFpbCBpcyBub3Qgc2V0dXAgY29ycmVjdGx5IScsXG4gICAgICAgIGltYWdlczogbWFpbERhdGE/LmltYWdlcyB8fCBbXSxcbiAgICAgICAgc291cmNlOiBzcmNcbiAgICB9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7QUFBTyxTQUFTLE1BQU0sSUFBWTtBQUM5QixTQUFPLElBQUksUUFBUSxTQUFPLFdBQVcsS0FBSyxFQUFFLENBQUM7QUFDakQ7QUFGZ0I7QUFRVCxJQUFNLGVBQWUsNkJBQU07QUFDOUIsU0FBTyx1Q0FBdUMsUUFBUSxTQUFTLFNBQVUsR0FBRztBQUN4RSxRQUFJLElBQUksS0FBSyxPQUFPLElBQUksS0FBSyxHQUFHLElBQUksS0FBSyxNQUFNLElBQUksSUFBSSxJQUFNO0FBQzdELFdBQU8sRUFBRSxTQUFTLEVBQUU7QUFBQSxFQUN4QixDQUFDO0FBQ0wsR0FMNEI7QUFPckIsSUFBTSxTQUFTLHdCQUFDLFlBQW9CO0FBQ3ZDLFNBQU8sUUFBUSxJQUFJLHVEQUF1RCxPQUFPLFNBQVM7QUFDOUYsR0FGc0I7QUFLZixJQUFNLHFCQUFvQztB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Z0MsT0FBTyxRQUFnQjtBQUN0RCxNQUFHLENBQUM7QUFBSztBQUNULFFBQU0sWUFBWSxNQUFNLE1BQU0sMkJBQTJCLEdBQUc7QUFDNUQsTUFBSSxDQUFDO0FBQVc7QUFDaEIsUUFBTSxTQUFTLG1CQUFtQixTQUFTO0FBQzNDLFdBQVMsbUJBQW1CLFNBQVM7QUFDekMsQ0FBQztBQUVELEdBQUcsaUJBQWlCLFlBQVk7QUFDNUIsUUFBTSxNQUFNLE9BQU87QUFDbkIsTUFBRyxDQUFDO0FBQUs7QUFDVCxRQUFNLFlBQVksTUFBTSxNQUFNLDJCQUEyQixHQUFHO0FBQzVELE1BQUksQ0FBQztBQUFXO0FBQ2hCLFFBQU0sU0FBUyxtQkFBbUIsU0FBUztBQUMzQyxXQUFTLG1CQUFtQixTQUFTO0FBQ3pDLENBQUM7QUFFRCxNQUFNLDJCQUEyQixPQUFPLGNBQXNCLGFBQStCO0FBQ3pGLFFBQU0sTUFBTSxPQUFPLGdCQUFnQixPQUFPLE1BQU07QUFDaEQsUUFBTSxTQUFTLFVBQVUsVUFBVSxVQUFVLEdBQUc7QUFDaEQsTUFBSSxDQUFDO0FBQVE7QUFFYixRQUFNLFlBQVksT0FBTyxXQUFXO0FBQ3BDLFFBQU0sZUFBZSxNQUFNLE1BQU0sc0JBQXNCLFNBQVM7QUFDaEUsTUFBSSxDQUFDO0FBQWM7QUFFbkIsUUFBTSxPQUFPLFFBQVEsY0FBYyxFQUFFLFNBQVM7QUFBQSxJQUMxQyxRQUFPLHFDQUFVLFVBQVM7QUFBQSxJQUMxQixJQUFJO0FBQUEsSUFDSixVQUFTLHFDQUFVLFlBQVc7QUFBQSxJQUM5QixVQUFTLHFDQUFVLFlBQVc7QUFBQSxJQUM5QixTQUFRLHFDQUFVLFdBQVUsQ0FBQztBQUFBLElBQzdCLFFBQVE7QUFBQSxFQUNaLENBQUM7QUFDTCxDQUFDOyIsCiAgIm5hbWVzIjogWyJzb3VyY2UiLCAiX2EiLCAic291cmNlIiwgInNvdXJjZSIsICJfYSIsICJyZXMiLCAic291cmNlIiwgIl9hIiwgInNvdXJjZSIsICJfYSIsICJzb3VyY2UiLCAiX2EiLCAic291cmNlIiwgInNvdXJjZSIsICJkYXRhIiwgInNvdXJjZSIsICJzb3VyY2UiLCAicmV0d2VldCIsICJzb3VyY2UiLCAic291cmNlIiwgInNvdXJjZSIsICJfYSIsICJpc1JlY3VycmluZyIsICJzb3VyY2UiLCAic291cmNlIiwgInNvdXJjZSIsICJfYSIsICJzb3VyY2UiLCAicmVzb2x2ZUZyYW1ld29yayIsICJfYSIsICJzb3VyY2UiXQp9Cg==
