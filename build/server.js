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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2FtZS9zaGFyZWQvdXRpbHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvY2xhc3Nlcy9VdGlscy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL01haWwvY2xhc3MudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvc3ZfZXhwb3J0cy50cyIsICIuLi9ub2RlX21vZHVsZXMvQG92ZXJleHRlbmRlZC9veF9saWIvc2hhcmVkL3Jlc291cmNlL2NhY2hlL2luZGV4LmpzIiwgIi4uL25vZGVfbW9kdWxlcy9Ab3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXIvcmVzb3VyY2UvY2FsbGJhY2svaW5kZXguanMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9Db250YWN0cy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0RhcmtDaGF0L2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvTWFpbC9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL01lc3NhZ2VzL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvY2FsbEhpc3RvcnlNYW5hZ2VyLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvQ2FsbE1hbmFnZXIudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXR0aW5ncy9jbGFzcy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1Bob25lL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvbmUvZXZlbnRzLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGhvdG9zL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvU2VydmljZXMvY2FsbGJhY2sudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXJ2aWNlcy9ldmVudHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9TZXR0aW5ncy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1NldHRpbmdzL2V2ZW50cy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL1BpZ2Vvbi9QaWdlb25TZXJ2aWNlLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvUGlnZW9uL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvSG9zdWluZy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0JsdWVQYWdlL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvR2FyYWdlL2NhbGxiYWNrLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvV2FsbGV0L2NhbGxiYWNrcy50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0dyb3Vwcy9jYWxsYmFjay50cyIsICIuLi9nYW1lL3NlcnZlci9hcHBzL0hlYXJ0U3luYy9jYWxsYmFja3MudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvYXBwcy9DcnlwdG8vY2FsbGJhY2tzLnRzIiwgIi4uL2dhbWUvc2VydmVyL2FwcHMvRGFpbHlTcGlucy9ldmVudHMudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvY2xhc3Nlcy9NeVNRTEFkYXB0ZXIudHMiLCAiLi4vZ2FtZS9zZXJ2ZXIvc3ZfbWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGZ1bmN0aW9uIERlbGF5KG1zOiBudW1iZXIpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzID0+IHNldFRpbWVvdXQocmVzLCBtcykpO1xufTtcblxuZXhwb3J0IGNvbnN0IGRpc3RhbmNlQmV0d2VlbiA9IChwb3MxOiBudW1iZXJbXSwgcG9zMjogbnVtYmVyW10pID0+IHtcbiAgICByZXR1cm4gTWF0aC5oeXBvdChwb3MxWzBdIC0gcG9zMlswXSwgcG9zMVsxXSAtIHBvczJbMV0sIHBvczFbMl0gLSBwb3MyWzJdKVxufTtcblxuZXhwb3J0IGNvbnN0IGdlbmVyYXRlVVVpZCA9ICgpID0+IHtcbiAgICByZXR1cm4gXCJ4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHhcIi5yZXBsYWNlKC9beHldL2csIGZ1bmN0aW9uIChjKSB7XG4gICAgICAgIHZhciByID0gTWF0aC5yYW5kb20oKSAqIDE2IHwgMCwgdiA9IGMgPT0gXCJ4XCIgPyByIDogciAmIDB4MyB8IDB4ODtcbiAgICAgICAgcmV0dXJuIHYudG9TdHJpbmcoMTYpO1xuICAgIH0pO1xufTtcblxuZXhwb3J0IGNvbnN0IExPR0dFUiA9IChtZXNzYWdlOiBzdHJpbmcpID0+IHtcbiAgICByZXR1cm4gY29uc29sZS5sb2coYFxceDFiWzFtXFx4MWJbNDdtXFx4MWJbMzRtW1N1bW1pdF9QaG9uZV0gXFx4MWJbNG1cXHgxYlszMW0ke21lc3NhZ2V9XFx4MWJbMG1gKVxufVxuXG5leHBvcnQgdHlwZSBGcmFtZXdvcmtUeXBlID0gJ3FiLWNvcmUnIHwgJ3FieF9jb3JlJztcbmV4cG9ydCBjb25zdCBGUkFNRVdPUktfUkVTT1VSQ0U6IEZyYW1ld29ya1R5cGUgPSAncWItY29yZSc7IC8vIENoYW5nZSB0aGlzIHRvIHlvdXIgZnJhbWV3b3JrIGNvcmUgcWItY29yZS9xYnhfY29yZVxuZXhwb3J0IHR5cGUgSW52ZW50b3J5VHlwZSA9ICdsai1pbnZlbnRvcnknIHwgJ294X2ludmVudG9yeScgfCAncWItaW52ZW50b3J5JztcbmV4cG9ydCBjb25zdCBJTlZFTlRPUllfUkVTT1VSQ0U6IEludmVudG9yeVR5cGUgPSAnb3hfaW52ZW50b3J5JzsgLy8gQ2hhbmdlIHRoaXMgdG8geW91ciBpbnZlbnRvcnkgc3lzdGVtIG94X2ludmVudG9yeS9xYi1pbnZlbnRvcnkvbGotaW52ZW50b3J5IGV0Yy4uLlxuIiwgImltcG9ydCB7IEZyYW1ld29yaywgTW9uZ29EQiwgTXlTUUwgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UsIElOVkVOVE9SWV9SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmNsYXNzIFV0aWwge1xuICAgIHB1YmxpYyBjb250YWN0c0RhdGE6IGFueTtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5jb250YWN0c0RhdGEgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBjaXRpemVuIElEIGZvciBhIHBsYXllciBieSB0aGVpciBzb3VyY2UuXG4gICAgICogRmlyc3QgdHJpZXMgdGhlIGZyYW1ld29yayBleHBvcnQsIHRoZW4gZmFsbHMgYmFjayB0byBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcigpXG4gICAgICogQHBhcmFtIHNvdXJjZSAtIFRoZSBwbGF5ZXIncyBzb3VyY2Uvc2VydmVyIElEXG4gICAgICogQHJldHVybnMgVGhlIGNpdGl6ZW4gSUQgb3IgbnVsbCBpZiBub3QgZm91bmRcbiAgICAgKi9cbiAgICBhc3luYyBHZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2U6IG51bWJlcik6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBGaXJzdCB0cnkgdGhlIGV4cG9ydCAoaWYgdXNlciBoYXMgYWRkZWQgaXQgdG8gdGhlaXIgcWItY29yZSlcbiAgICAgICAgICAgIGNvbnN0IGV4cG9ydEZ1bmMgPSBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0/LkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBvcnRGdW5jID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZXhwb3J0RnVuYyhzb3VyY2UpO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIEV4cG9ydCBkb2Vzbid0IGV4aXN0IG9yIGZhaWxlZCwgZmFsbCB0aHJvdWdoIHRvIGZhbGxiYWNrXG4gICAgICAgIH1cblxuICAgICAgICAvLyBGYWxsYmFjazogdXNlIEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKClcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBsYXllciA9IEZyYW1ld29yaz8uRnVuY3Rpb25zPy5HZXRQbGF5ZXI/Lihzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKHBsYXllcj8uUGxheWVyRGF0YT8uY2l0aXplbmlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgTE9HR0VSKGBGYWlsZWQgdG8gZ2V0IGNpdGl6ZW4gSUQgZm9yIHNvdXJjZSAke3NvdXJjZX06ICR7ZX1gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGFzeW5jIGxvYWQoKSB7XG4gICAgICAgIFJlZ2lzdGVyQ29tbWFuZCgndHJhbnNmZXJOdW1iZXJzJywgYXN5bmMgKHNvdXJjZTogYW55LCBhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UgPT09IDApIHJldHVybiBMT0dHRVIoJ1RoaXMgY29tbWFuZCBjYW4gb25seSBiZSBleGVjdXRlZCBpbi1nYW1lLicpO1xuICAgICAgICAgICAgYXdhaXQgVXRpbHMuVHJhbnNmZXJOdW1iZXJzKCk7XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIFJlZ2lzdGVyQ29tbWFuZCgndHJhbnNmZXJDb250YWN0cycsIGFzeW5jIChzb3VyY2U6IGFueSwgYXJnczogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoc291cmNlID09PSAwKSByZXR1cm4gTE9HR0VSKCdUaGlzIGNvbW1hbmQgY2FuIG9ubHkgYmUgZXhlY3V0ZWQgaW4tZ2FtZS4nKTtcbiAgICAgICAgICAgIGF3YWl0IFV0aWxzLlRyYW5zZmVyQ29udGFjdHMoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgUmVnaXN0ZXJDb21tYW5kKCdtaWdyYXRlTXVsdGlKb2JEYXRhJywgYXN5bmMgKHNvdXJjZTogYW55LCBhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UgPT09IDApIHJldHVybiBMT0dHRVIoJ1RoaXMgY29tbWFuZCBjYW4gb25seSBiZSBleGVjdXRlZCBpbi1nYW1lLicpO1xuICAgICAgICAgICAgYXdhaXQgVXRpbHMuTWlncmF0ZU11bHRpSm9iRGF0YSgpO1xuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICBSZWdpc3RlckNvbW1hbmQoJ21pZ3JhdGVTb2NpZXR5JywgYXN5bmMgKHNvdXJjZTogYW55LCBhcmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UgPT09IDApIHJldHVybiBMT0dHRVIoJ1RoaXMgY29tbWFuZCBjYW4gb25seSBiZSBleGVjdXRlZCBpbi1nYW1lLicpO1xuICAgICAgICAgICAgYXdhaXQgVXRpbHMuTWlncmF0ZVNvY2lldHlEYXRhKCk7XG4gICAgICAgIH0sIHRydWUpO1xuICAgIH07XG5cbiAgICBhc3luYyBUcmFuc2Zlck51bWJlcnMoKSB7XG4gICAgICAgIGxldCBuZXdOdW1iZXJzOiBhbnlbXSA9IFtdO1xuICAgICAgICBsZXQgbmV3U2V0dGluZ3M6IGFueVtdID0gW107XG4gICAgICAgIGxldCBuZXdDYXJkczogYW55W10gPSBbXTtcblxuICAgICAgICBNeVNRTC5xdWVyeSgnU0VMRUNUIGNpdGl6ZW5pZCwgY2hhcmluZm8gRlJPTSBwbGF5ZXJzJywgW10sIGFzeW5jIChyZXN1bHQ6IGFueVtdKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgcm93IG9mIHJlc3VsdCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvd25lciA9IHJvdy5jaXRpemVuaWQ7XG4gICAgICAgICAgICAgICAgICAgIGxldCBjaGFyaW5mbyA9IHJvdy5jaGFyaW5mbztcblxuICAgICAgICAgICAgICAgICAgICAvLyBwYXJzZSBpZiBzdG9yZWQgYXMgSlNPTiBzdHJpbmdcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjaGFyaW5mbyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhcmluZm8gPSBKU09OLnBhcnNlKGNoYXJpbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFyaW5mbyA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcHJlZmVyIGNoYXJpbmZvLnBob25lLCBmYWxsIGJhY2sgdG8gcGhvbmVfbnVtYmVyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG51bWJlciA9IChjaGFyaW5mbyAmJiAoY2hhcmluZm8ucGhvbmUgPz8gY2hhcmluZm8ucGhvbmVfbnVtYmVyKSkgfHwgbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFudW1iZXIpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHNraXAgaWYgcGhvbmUgbnVtYmVyIGFscmVhZHkgZXhpc3RzIGZvciB0aGlzIG93bmVyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9udW1iZXJzJywgeyBvd25lciB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV4aXN0aW5nKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBuZXdOdW1iZXJzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgbnVtYmVyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHByZXBhcmUgcGhvbmVfc2V0dGluZ3MgaWYgbm90IHByZXNlbnRcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdTZXR0aW5ncyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IF9pZDogb3duZXIgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXhpc3RpbmdTZXR0aW5ncykge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV3U2V0dGluZ3MucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBvd25lcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOiB7IGN1cnJlbnQ6ICcnLCB3YWxscGFwZXJzOiBbXSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2tzY3JlZW46IHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmluZ3RvbmU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByaW5ndG9uZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGVmYXVsdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0xvY2s6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9ja1BpbjogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlUGluOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlRmFjZUlkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiBvd25lcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXJrTWFpbElkQXR0YWNoZWQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNtcnRJZDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc21ydFBhc3N3b3JkOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc0ZsaWdodE1vZGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBwcmVwYXJlIHBob25lX3BsYXllcl9jYXJkIGlmIG5vdCBwcmVzZW50XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nQ2FyZCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfcGxheWVyX2NhcmQnLCB7IF9pZDogb3duZXIgfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXhpc3RpbmdDYXJkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdDYXJkcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IG93bmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0TmFtZTogJ1NldHVwJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0TmFtZTogJ0NhcmQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1haWw6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vdGVzOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdmF0YXI6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3TnVtYmVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0TWFueSgncGhvbmVfbnVtYmVycycsIG5ld051bWJlcnMpO1xuICAgICAgICAgICAgICAgICAgICBMT0dHRVIoYEluc2VydGVkICR7bmV3TnVtYmVycy5sZW5ndGh9IHBob25lX251bWJlcnMuYCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKCdObyBuZXcgcGhvbmVfbnVtYmVycyB0byBpbnNlcnQuJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKG5ld1NldHRpbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRNYW55KCdwaG9uZV9zZXR0aW5ncycsIG5ld1NldHRpbmdzKTtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBJbnNlcnRlZCAke25ld1NldHRpbmdzLmxlbmd0aH0gcGhvbmVfc2V0dGluZ3MuYCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKCdObyBuZXcgcGhvbmVfc2V0dGluZ3MgdG8gaW5zZXJ0LicpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChuZXdDYXJkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0TWFueSgncGhvbmVfcGxheWVyX2NhcmQnLCBuZXdDYXJkcyk7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUihgSW5zZXJ0ZWQgJHtuZXdDYXJkcy5sZW5ndGh9IHBob25lX3BsYXllcl9jYXJkIGVudHJpZXMuYCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgTE9HR0VSKCdObyBuZXcgcGhvbmVfcGxheWVyX2NhcmQgZW50cmllcyB0byBpbnNlcnQuJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgTE9HR0VSKGBUcmFuc2Zlck51bWJlcnMgZXJyb3I6ICR7ZXJyfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMgVHJhbnNmZXJDb250YWN0cygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgdGhpcy5xdWVyeSgnU0VMRUNUICogRlJPTSBwaG9uZV9waG9uZV9jb250YWN0cycsIFtdKTtcblxuICAgICAgICAgICAgaWYgKCFyZXN1bHQgfHwgcmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIExPR0dFUignTm8gY29udGFjdHMgZm91bmQgdG8gdHJhbnNmZXIuJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCBbaW5kZXgsIGNvbnRhY3RdIG9mIHJlc3VsdC5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXggPiByZXN1bHQubGVuZ3RoKSBicmVhaztcbiAgICAgICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhgUHJvY2Vzc2luZyBjb250YWN0ICR7aW5kZXggKyAxfSBvZiAke3Jlc3VsdC5sZW5ndGh9YCk7ICovXG4gICAgICAgICAgICAgICAgY29uc3Qgb3duZXJJZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihjb250YWN0LnBob25lX251bWJlcik7XG4gICAgICAgICAgICAgICAgdGhpcy5jb250YWN0c0RhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIHBlcnNvbmFsTnVtYmVyOiBjb250YWN0LnBob25lX251bWJlcixcbiAgICAgICAgICAgICAgICAgICAgY29udGFjdE51bWJlcjogY29udGFjdC5jb250YWN0X3Bob25lX251bWJlcixcbiAgICAgICAgICAgICAgICAgICAgZmlyc3ROYW1lOiBjb250YWN0LmZpcnN0bmFtZSxcbiAgICAgICAgICAgICAgICAgICAgbGFzdE5hbWU6IGNvbnRhY3QubGFzdG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGltYWdlOiBjb250YWN0LnByb2ZpbGVfaW1hZ2UsXG4gICAgICAgICAgICAgICAgICAgIG93bmVySWQ6IG93bmVySWQsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE1hbnkoJ3Bob25lX2NvbnRhY3RzJywgdGhpcy5jb250YWN0c0RhdGEpO1xuICAgICAgICAgICAgTE9HR0VSKCdQaG9uZSBjb250YWN0cyBoYXZlIGJlZW4gdHJhbnNmZXJyZWQgdG8gTW9uZ29EQi4nKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgTE9HR0VSKGBFcnJvciB3aGlsZSB0cmFuc2ZlcnJpbmcgY29udGFjdHM6ICR7SlNPTi5zdHJpbmdpZnkoZSwgbnVsbCwgMil9YCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgYXN5bmMgTWlncmF0ZU11bHRpSm9iRGF0YSgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgdGhpcy5xdWVyeSgnU0VMRUNUIGlkLCBqb2JuYW1lLCBlbXBsb3llZXMgRlJPTSBwbGF5ZXJfam9icycsIFtdKTtcbiAgICAgICAgICAgIGlmICghcmVzdWx0IHx8IHJlc3VsdC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICBMT0dHRVIoJ05vIG11bHRpam9icyBmb3VuZCB0byB0cmFuc2Zlci4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5ld0RhdGE6IGFueVtdID0gW107XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qgcm93IG9mIHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGpvYklkID0gcm93LmlkO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBqb2JOYW1lID0gcm93LmpvYm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGlmICgham9iTmFtZSkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGVtcGxveWVlcyA9IHJvdy5lbXBsb3llZXM7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZW1wbG95ZWVzKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGVtcGxveWVlcyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1wbG95ZWVzID0gSlNPTi5wYXJzZShlbXBsb3llZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTE9HR0VSKGBGYWlsZWQgdG8gcGFyc2UgZW1wbG95ZWVzIEpTT04gZm9yIGpvYiAke2pvYk5hbWV9IChpZDogJHtqb2JJZH0pOiAke2Vycn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghZW1wbG95ZWVzIHx8IHR5cGVvZiBlbXBsb3llZXMgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkoZW1wbG95ZWVzKSkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCBlbXBdIG9mIE9iamVjdC5lbnRyaWVzKGVtcGxveWVlcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNpZCA9IChlbXAgJiYgKGVtcC5jaWQgfHwgZW1wLkNJRCB8fCBlbXAuY2l0aXplbklkKSkgfHwga2V5O1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ3JhZGVMZXZlbCA9IChlbXAgJiYgKGVtcC5ncmFkZSA/PyBlbXAuZ3JhZGVMZXZlbCA/PyBlbXAucmFuaykpID8/IDA7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGpvYkxhYmVsID0gRnJhbWV3b3JrPy5TaGFyZWQ/LkpvYnM/Lltqb2JOYW1lXT8ubGFiZWwgPz8gam9iTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGdyYWRlTGFiZWwgPSBGcmFtZXdvcms/LlNoYXJlZD8uSm9icz8uW2pvYk5hbWVdPy5ncmFkZXM/LltncmFkZUxldmVsXT8ubmFtZSA/PyAnJztcblxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3RGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogY2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpvYk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JhZGVMZXZlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBqb2JMYWJlbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBncmFkZUxhYmVsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGlubmVyRXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIExPR0dFUihgRXJyb3IgcHJvY2Vzc2luZyBwbGF5ZXJfam9icyByb3cgaWQgJHtyb3cuaWR9OiAke2lubmVyRXJyfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5ld0RhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0TWFueSgncGhvbmVfbXVsdGlqb2JzJywgbmV3RGF0YSk7XG4gICAgICAgICAgICAgICAgTE9HR0VSKGBJbnNlcnRlZCAke25ld0RhdGEubGVuZ3RofSBtdWx0aWpvYiBlbnRyaWVzIHRvIHBob25lX211bHRpam9icy5gKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgTE9HR0VSKCdObyBtdWx0aWpvYiBlbnRyaWVzIGZvdW5kIHRvIGluc2VydCBhZnRlciBwYXJzaW5nLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIExPR0dFUihgTWlncmF0ZU11bHRpSm9iRGF0YSBlcnJvcjogJHtlcnJ9YCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgYXN5bmMgTWlncmF0ZVNvY2lldHlEYXRhKCkge1xuICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IHRoaXMucXVlcnkoJ1NFTEVDVCAqIEZST00gYXZfc29jaWV0eScsIFtdKTtcblxuICAgICAgICByZXN1bHQuZm9yRWFjaChhc3luYyAoam9iOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdzdW1taXRfYmFuaycsIHsgX2lkOiBqb2Iuam9iIH0sIHtcbiAgICAgICAgICAgICAgICBiYW5rQmFsYW5jZTogTnVtYmVyKGpvYi5tb25leSlcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UpXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgYXN5bmMgR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX251bWJlcnMnLCB7IG93bmVyOiBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghbnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBudW1iZXIubnVtYmVyO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRFbWFpbElkQnlDaXRpemVuSWQoY2l0aXplbklkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghbnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBudW1iZXIuc21ydElkO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRFbWFpbElkQnlTb3VyY2Uoc291cmNlOiBudW1iZXIpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBlbWFpbCA9IGF3YWl0IHRoaXMuR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgICAgIHJldHVybiBlbWFpbDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbnVtYmVycycsIHsgbnVtYmVyOiBwaG9uZU51bWJlciB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5vd25lcjtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0UGxheWVyRnJvbVBob25lTnVtYmVyKHBob25lTnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBCbG9ja051bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkLFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMgVW5ibG9ja051bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCB0YXJnZXRQaG9uZU51bWJlcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGNvbnN0IHRhcmdldENpdGl6ZW5JZCA9IGF3YWl0IHRoaXMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcih0YXJnZXRQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY2l0aXplbklkIHx8ICF0YXJnZXRDaXRpemVuSWQpIHJldHVybjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgIH07XG5cbiAgICBhc3luYyBJc051bWJlckJsb2NrZWQocGhvbmVOdW1iZXI6IHN0cmluZywgdGFyZ2V0UGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXIpO1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCB0aGlzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIodGFyZ2V0UGhvbmVOdW1iZXIpO1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCB8fCAhdGFyZ2V0Q2l0aXplbklkKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGJsb2NrZWQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2Jsb2NrZWRfbnVtYmVycycsIHsgY2l0aXplbklkOiBjaXRpemVuSWQsIHRhcmdldENpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkIH0pO1xuICAgICAgICByZXR1cm4gYmxvY2tlZCA/IHRydWUgOiBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q29udGFjdE5hbWVCeU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGhvbmVOdW1iZXIsIG93bmVySWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFjb250YWN0KSByZXR1cm4gcGhvbmVOdW1iZXI7XG4gICAgICAgIHJldHVybiBgJHtjb250YWN0LmZpcnN0TmFtZX0gJHtjb250YWN0Lmxhc3ROYW1lfWA7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENvbnRhY3RBdmF0YXJCeU51bWJlcihwaG9uZU51bWJlcjogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgY29udGFjdE51bWJlcjogcGhvbmVOdW1iZXIsIG93bmVySWQ6IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgaWYgKCFjb250YWN0KSByZXR1cm4gJyc7XG4gICAgICAgIHJldHVybiBjb250YWN0LmltYWdlO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRTb3VyY2VGcm9tQ2l0aXplbklkKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgICAgICBpZiAoIXNvdXJjZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gc291cmNlLlBsYXllckRhdGEuc291cmNlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBIYXNQaG9uZShwbGF5ZXJTb3VyY2U6IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgICAgICBjb25zdCBwaG9uZUxpc3Q6IHN0cmluZ1tdID0gW1xuICAgICAgICAgICAgJ2JsdWVfcGhvbmUnLFxuICAgICAgICAgICAgJ2dyZWVuX3Bob25lJyxcbiAgICAgICAgICAgICdyZWRfcGhvbmUnLFxuICAgICAgICAgICAgJ2dvbGRfcGhvbmUnLFxuICAgICAgICAgICAgJ3B1cnBsZV9waG9uZScsXG4gICAgICAgIF07XG5cbiAgICAgICAgaWYgKElOVkVOVE9SWV9SRVNPVVJDRSA9PT0gJ294X2ludmVudG9yeScpIHtcbiAgICAgICAgICAgIGNvbnN0IGhhc0l0ZW06IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSBleHBvcnRzWydveF9pbnZlbnRvcnknXS5TZWFyY2goXG4gICAgICAgICAgICAgICAgcGxheWVyU291cmNlLFxuICAgICAgICAgICAgICAgICdjb3VudCcsXG4gICAgICAgICAgICAgICAgcGhvbmVMaXN0XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHBob25lIG9mIHBob25lTGlzdCkge1xuICAgICAgICAgICAgICAgIGlmIChoYXNJdGVtW3Bob25lXSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcGhvbmVJdGVtIG9mIHBob25lTGlzdCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlIC0gZXh0ZXJuYWwgaW52ZW50b3J5IHJlc291cmNlXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhcyA9IGF3YWl0IGV4cG9ydHNbSU5WRU5UT1JZX1JFU09VUkNFXS5IYXNJdGVtKHBsYXllclNvdXJjZSwgcGhvbmVJdGVtKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhhcykgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0hhc1Bob25lIGNoZWNrIGZhaWxlZDonLCBlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgSW5GbGlnaHRNb2RlKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHNldHRpbmdzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgX2lkOiBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghc2V0dGluZ3MpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHNldHRpbmdzLmlzRmxpZ2h0TW9kZSB8fCBmYWxzZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgcXVlcnkocXVlcnk6IHN0cmluZywgdmFsdWVzOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIE15U1FMLnF1ZXJ5KHF1ZXJ5LCB2YWx1ZXMsIChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgYXN5bmMgaXNTZW5kZXJLbm93bihzZW5kZXJJZDogc3RyaW5nLCByZWNlaXZlcklkOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgLy8gUXVlcnkgdG8gY2hlY2sgaWYgdGhlIHNlbmRlciBpcyBpbiB0aGUgcmVjZWl2ZXIncyBjb250YWN0c1xuICAgICAgICBjb25zdCBjb250YWN0UXVlcnkgPSB7XG4gICAgICAgICAgICBvd25lcklkOiByZWNlaXZlcklkLFxuICAgICAgICAgICAgY29udGFjdE51bWJlcjogc2VuZGVySWRcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBUcnkgdG8gZmluZCBhIGNvbnRhY3QgZW50cnlcbiAgICAgICAgY29uc3QgY29udGFjdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCBjb250YWN0UXVlcnkpO1xuXG4gICAgICAgIC8vIElmIGEgY29udGFjdCBpcyBmb3VuZCwgdGhlIHNlbmRlciBpcyBrbm93blxuICAgICAgICByZXR1cm4gY29udGFjdCAhPT0gbnVsbDtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0UGhvbmVOdW1iZXJCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbnVtYmVyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgc21ydElkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFudW1iZXIpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG51bWJlci5waG9uZU51bWJlcjtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2l0aXplbklkQnlFbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IHNtcnRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghbnVtYmVyKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBudW1iZXIuX2lkO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRQbGF5ZXJCeUVtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgdGhpcy5HZXRDaXRpemVuSWRCeUVtYWlsKGVtYWlsKTtcbiAgICAgICAgcmV0dXJuIGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRBdmF0YXJGcm9tRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCBhdmF0b3IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghYXZhdG9yKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBhdmF0b3IuYXZhdGFyO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRVc2VyTmFtZUZyb21FbWFpbChlbWFpbDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghdXNlcikgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gdXNlci51c2VybmFtZTtcbiAgICB9O1xuXG4gICAgYXN5bmMgR2V0Q2lkRnJvbVR3ZWV0SWQoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBwaWdlb25JZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlcy5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIEdldENpZHNGcm9tUGlnZW9uRW1haWwoZW1haWw6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9zZXR0aW5ncycsIHsgcGlnZW9uSWRBdHRhY2hlZDogZW1haWwgfSk7XG4gICAgICAgIGlmICghcmVzIHx8IHJlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcbiAgICAgICAgcmV0dXJuIHJlcy5tYXAoKHNldHRpbmc6IGFueSkgPT4gc2V0dGluZy5faWQpO1xuICAgIH07XG5cbiAgICBhc3luYyBHZXRDaWRGcm9tRGFya0VtYWlsKGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9zZXR0aW5ncycsIHsgZGFya01haWxJZEF0dGFjaGVkOiBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlcy5faWQ7XG4gICAgfTtcblxuICAgIGFzeW5jIElzUGxheWVySW5KYWlsKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIXBsYXllcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXRhZGF0YSA9IHBsYXllci5QbGF5ZXJEYXRhLm1ldGFkYXRhO1xuICAgICAgICAgICAgcmV0dXJuIG1ldGFkYXRhICYmIG1ldGFkYXRhLmluamFpbCAmJiBtZXRhZGF0YS5pbmphaWwgPiAwO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBcbiAgICBhc3luYyBnZXRKb2JzKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGpvYnM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgY29uc3QgZW1wbG95ZWVzOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBhbnk+PiA9IHt9O1xuXG4gICAgICAgIC8vIGZpbmQgYWxsIG11bHRpam9iIGVudHJpZXMgZm9yIHRoaXMgY2l0aXplblxuICAgICAgICBjb25zdCBteUVudHJpZXM6IGFueVtdID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmICghbXlFbnRyaWVzIHx8IG15RW50cmllcy5sZW5ndGggPT09IDApIHJldHVybiB7IGpvYnMsIGVtcGxveWVlcyB9O1xuXG4gICAgICAgIC8vIGNvbGxlY3QgdW5pcXVlIGpvYiBuYW1lcyBzbyB3ZSBjYW4gZmV0Y2ggYWxsIGVtcGxveWVlcyBmb3IgdGhvc2Ugam9icyBpbiBvbmUgcXVlcnlcbiAgICAgICAgY29uc3Qgam9iTmFtZXMgPSBBcnJheS5mcm9tKG5ldyBTZXQobXlFbnRyaWVzLm1hcChlID0+IGUuam9iTmFtZSkpKTtcblxuICAgICAgICAvLyBidWlsZCBqb2JzIG1hcCAob25lIGVudHJ5IHBlciBqb2IgdGhpcyBjaWQgaGFzKVxuICAgICAgICBmb3IgKGNvbnN0IGUgb2YgbXlFbnRyaWVzKSB7XG4gICAgICAgICAgICBqb2JzW2Uuam9iTmFtZV0gPSB7XG4gICAgICAgICAgICAgICAgY2l0aXplbklkOiBlLmNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICBqb2JOYW1lOiBlLmpvYk5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGVMZXZlbDogZS5ncmFkZUxldmVsID8/IDAsXG4gICAgICAgICAgICAgICAgam9iTGFiZWw6IGUuam9iTGFiZWwgPz8gRnJhbWV3b3JrPy5TaGFyZWQ/LkpvYnM/LltlLmpvYk5hbWVdPy5sYWJlbCA/PyBlLmpvYk5hbWUsXG4gICAgICAgICAgICAgICAgZ3JhZGVMYWJlbDogZS5ncmFkZUxhYmVsID8/IEZyYW1ld29yaz8uU2hhcmVkPy5Kb2JzPy5bZS5qb2JOYW1lXT8uZ3JhZGVzPy5bZS5ncmFkZUxldmVsXT8ubmFtZSA/PyAnJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZldGNoIGFsbCBlbXBsb3llZXMgZm9yIHRoZSBjb2xsZWN0ZWQgam9icyBhbmQgYnVpbGQgZW1wbG95ZWVzIG1hcDogeyBqb2JOYW1lOiB7IGNpZDogey4uLn0sIC4uLiB9LCAuLi4gfVxuICAgICAgICBjb25zdCBhbGxFbXBsb3llZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGpvYk5hbWU6IHsgJGluOiBqb2JOYW1lcyB9IH0pO1xuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGFsbEVtcGxveWVlcykge1xuICAgICAgICAgICAgZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdID0gZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdIHx8IHt9O1xuICAgICAgICAgICAgZW1wbG95ZWVzW2VudHJ5LmpvYk5hbWVdW2VudHJ5LmNpdGl6ZW5JZF0gPSB7XG4gICAgICAgICAgICAgICAgY2lkOiBlbnRyeS5jaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgZ3JhZGU6IGVudHJ5LmdyYWRlTGV2ZWwgPz8gMCxcbiAgICAgICAgICAgICAgICBncmFkZUxhYmVsOiBlbnRyeS5ncmFkZUxhYmVsID8/ICcnLFxuICAgICAgICAgICAgICAgIGpvYkxhYmVsOiBlbnRyeS5qb2JMYWJlbCA/PyAnJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGpvYnMsIGVtcGxveWVlcyB9O1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IFV0aWxzID0gbmV3IFV0aWwoKTsiLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFBob25lTWFpbCwgUGhvbmVNYWlsTWVzc2FnZSB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuXG5jbGFzcyBNYWlsIHtcbiAgICBhc3luYyBnZXRNYWlsTWVzc2FnZXMoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykge1xuICAgICAgICBpZiAoIWVtYWlsICYmICFwYXNzd29yZCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWFpbCcsIHsgYWN0aXZlTWFpZElkOiBlbWFpbCwgYWN0aXZlTWFpbFBhc3N3b3JkOiBwYXNzd29yZCB9KTtcbiAgICAgICAgaWYgKCFtYWlsRGF0YSB8fCBtYWlsRGF0YS5tZXNzYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIG1haWxEYXRhLm1lc3NhZ2VzID0gW107XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYWlsRGF0YS5tZXNzYWdlcyA9IG1haWxEYXRhLm1lc3NhZ2VzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBuZXcgRGF0ZShiLmRhdGUpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEuZGF0ZSkuZ2V0VGltZSgpKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShtYWlsRGF0YS5tZXNzYWdlcyk7XG4gICAgfTtcblxuICAgIGFzeW5jIHNlbmRNYWlsKGVtYWlsOiBzdHJpbmcsIHRvOiBzdHJpbmcsIHN1YmplY3Q6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nLCBpbWFnZXM6IHN0cmluZ1tdLCBzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSBlbWFpbDtcbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdG87XG5cbiAgICAgICAgY29uc3QgcGxheWVyTWFpbDogUGhvbmVNYWlsID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHBsYXllciB9KTtcbiAgICAgICAgY29uc3QgdGFyZ2V0TWFpbDogUGhvbmVNYWlsID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHRhcmdldCB9KTtcbiAgICAgICAgaWYgKCFwbGF5ZXJNYWlsIHx8ICF0YXJnZXRNYWlsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG5ld01haWxNZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHBsYXllcixcbiAgICAgICAgICAgIHRvOiB0YXJnZXQsXG4gICAgICAgICAgICBhdmF0YXI6IGF3YWl0IFV0aWxzLkdldEF2YXRhckZyb21FbWFpbCh0YXJnZXQpLFxuICAgICAgICAgICAgdXNlcm5hbWU6IGF3YWl0IFV0aWxzLkdldFVzZXJOYW1lRnJvbUVtYWlsKHRhcmdldCksXG4gICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSwgXG4gICAgICAgICAgICBpbWFnZXM6IGltYWdlcyxcbiAgICAgICAgICAgIGRhdGU6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHJlYWQ6IHRydWUsXG4gICAgICAgICAgICB0YWdzOiBbJ2luYm94JywgJ3NlbnQnXVxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHRhcmdldE1haWxtZXNzYWdlOiBQaG9uZU1haWxNZXNzYWdlID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHBsYXllcixcbiAgICAgICAgICAgIHRvOiB0YXJnZXQsXG4gICAgICAgICAgICBhdmF0YXI6IGF3YWl0IFV0aWxzLkdldEF2YXRhckZyb21FbWFpbChwbGF5ZXIpLFxuICAgICAgICAgICAgc3ViamVjdDogc3ViamVjdCxcbiAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICB1c2VybmFtZTogYXdhaXQgVXRpbHMuR2V0VXNlck5hbWVGcm9tRW1haWwocGxheWVyKSxcbiAgICAgICAgICAgIGltYWdlczogaW1hZ2VzLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgICAgICB0YWdzOiBbJ2luYm94J11cbiAgICAgICAgfVxuICAgICAgICBwbGF5ZXJNYWlsLm1lc3NhZ2VzLnB1c2gobmV3TWFpbE1lc3NhZ2UpO1xuICAgICAgICB0YXJnZXRNYWlsLm1lc3NhZ2VzLnB1c2godGFyZ2V0TWFpbG1lc3NhZ2UpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBwbGF5ZXIgfSwgcGxheWVyTWFpbCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IHRhcmdldCB9LCB0YXJnZXRNYWlsKTtcblxuICAgICAgICBjb25zdCB0YXJnZXRDaWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJCeUVtYWlsKHRhcmdldCk7XG4gICAgICAgIHBsYXllck1haWwubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IG5ldyBEYXRlKGIuZGF0ZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5kYXRlKS5nZXRUaW1lKCkpO1xuICAgICAgICB0YXJnZXRNYWlsLm1lc3NhZ2VzLnNvcnQoKGE6IGFueSwgYjogYW55KSA9PiBuZXcgRGF0ZShiLmRhdGUpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEuZGF0ZSkuZ2V0VGltZSgpKTtcblxuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2htYWlsTWVzc2FnZXMnLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHBsYXllck1haWwubWVzc2FnZXMpKTtcbiAgICAgICAgaWYgKHRhcmdldENpZCkge1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0Q2lkLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTWFpbCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBhIG5ldyBtYWlsIGZyb20gJHtwbGF5ZXJ9LmAsXG4gICAgICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaG1haWxNZXNzYWdlcycsIHRhcmdldENpZC5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkodGFyZ2V0TWFpbC5tZXNzYWdlcykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBzZW5kRW1haWxUb0FsbChzdWJqZWN0OiBzdHJpbmcsIHNlbmRlcjogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcsIGltYWdlczogc3RyaW5nW10pIHtcbiAgICAgICAgY29uc3QgbWFpbERhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IHsgJG5lOiBudWxsIH0gfSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgbWFpbERhdGEuZm9yRWFjaChhc3luYyAobWFpbDogUGhvbmVNYWlsKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXdNYWlsTWVzc2FnZTogUGhvbmVNYWlsTWVzc2FnZSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGZyb206IHNlbmRlcixcbiAgICAgICAgICAgICAgICB0bzogbWFpbC5hY3RpdmVNYWlkSWQsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiAnJyxcbiAgICAgICAgICAgICAgICBzdWJqZWN0OiBzdWJqZWN0LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgaW1hZ2VzOiBpbWFnZXMgfHwgW10sXG4gICAgICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHRhZ3M6IFsnaW5ib3gnXSxcbiAgICAgICAgICAgICAgICB1c2VybmFtZTogc2VuZGVyXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgbWFpbC5tZXNzYWdlcy5wdXNoKG5ld01haWxNZXNzYWdlKTtcbiAgICAgICAgICAgIC8vQHRzLWlnbm9yZVxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbC5faWQgfSwgbWFpbCk7XG4gICAgICAgIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCAtMSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6ICdNYWlsJyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgYSBuZXcgbWFpbCwgJHttZXNzYWdlfS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBzZWxlY3RlTWVzc2FnZShkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcGFyc2VkRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHsgbWVzc2FnZUlkLCBtYWlsSWQgfSA9IHBhcnNlZERhdGE7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhOiBQaG9uZU1haWwgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogbWFpbElkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBtYWlsRGF0YS5tZXNzYWdlcy5maW5kKChtKSA9PiBtLl9pZCA9PT0gbWVzc2FnZUlkKTtcbiAgICAgICAgaWYgKCFtZXNzYWdlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIG1lc3NhZ2UucmVhZCA9IHRydWU7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tYWlsJywgeyBfaWQ6IG1haWxJZCB9LCBtYWlsRGF0YSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICBhc3luYyBnZXRQcm9maWxlU2V0dGluZ3MoZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCBtYWlsRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZEFuZFJldHVyblNwZWNpZmljRmllbGRzKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0sIFsnYWN0aXZlTWFpZElkJywgJ2FjdGl2ZU1haWxQYXNzd29yZCcsICdhdmF0YXInLCAndXNlcm5hbWUnXSk7XG4gICAgICAgIGlmICghbWFpbERhdGEpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KG1haWxEYXRhKTtcbiAgICB9O1xuXG4gICAgYXN5bmMgdXBkYXRlUHJvZmlsZVNldHRpbmdzKGVtYWlsOiBzdHJpbmcsIHBhc3N3b3JkOiBzdHJpbmcsIHVzZXJuYW1lOiBzdHJpbmcsIGF2YXRhcjogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IG1haWxEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tYWlsJywgeyBhY3RpdmVNYWlkSWQ6IGVtYWlsLCBhY3RpdmVNYWlsUGFzc3dvcmQ6IHBhc3N3b3JkIH0pO1xuICAgICAgICBpZiAoIW1haWxEYXRhKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIG1haWxEYXRhLnVzZXJuYW1lID0gdXNlcm5hbWU7XG4gICAgICAgIG1haWxEYXRhLmF2YXRhciA9IGF2YXRhcjtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21haWwnLCB7IGFjdGl2ZU1haWRJZDogZW1haWwsIGFjdGl2ZU1haWxQYXNzd29yZDogcGFzc3dvcmQgfSwgbWFpbERhdGEpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9O1xufVxuXG5leHBvcnQgY29uc3QgTWFpbENsYXNzID0gbmV3IE1haWwoKTsiLCAiaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIi4vY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTWFpbENsYXNzIH0gZnJvbSBcIi4vYXBwcy9NYWlsL2NsYXNzXCI7XG5cbmFzeW5jIGZ1bmN0aW9uIEdldEN1cnJlbnRQaG9uZU51bWJlcihzb3VyY2U6IG51bWJlciB8IHN0cmluZykge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSBhcyBudW1iZXIpO1xuICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgbnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIHJldHVybiBudW1iZXI7XG59XG5leHBvcnRzKCdHZXRDdXJyZW50UGhvbmVOdW1iZXInLCBHZXRDdXJyZW50UGhvbmVOdW1iZXIpO1xuXG5hc3luYyBmdW5jdGlvbiBHZXRDdXJyZW50UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChjaXRpemVuSWQ6IHN0cmluZykge1xuICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICByZXR1cm4gbnVtYmVyO1xufVxuZXhwb3J0cygnR2V0Q3VycmVudFBob25lTnVtYmVyQnlDaXRpemVuSWQnLCBHZXRDdXJyZW50UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZCk7XG5cbmFzeW5jIGZ1bmN0aW9uIEdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQ6IHN0cmluZykge1xuICAgIGNvbnN0IGVtYWlsID0gYXdhaXQgVXRpbHMuR2V0RW1haWxJZEJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgcmV0dXJuIGVtYWlsO1xufVxuZXhwb3J0cygnR2V0RW1haWxJZEJ5Q2l0aXplbklkJywgR2V0RW1haWxJZEJ5Q2l0aXplbklkKTtcblxuYXN5bmMgZnVuY3Rpb24gR2V0RW1haWxJZEJ5U291cmNlKHNvdXJjZTogbnVtYmVyIHwgc3RyaW5nKSB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlIGFzIG51bWJlcik7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBlbWFpbCA9IGF3YWl0IFV0aWxzLkdldEVtYWlsSWRCeUNpdGl6ZW5JZChjaXRpemVuSWQpO1xuICAgIHJldHVybiBlbWFpbDtcbn1cbmV4cG9ydHMoJ0dldEVtYWlsSWRCeVNvdXJjZScsIEdldEVtYWlsSWRCeVNvdXJjZSk7XG5cbmFzeW5jIGZ1bmN0aW9uIFNlbmROb3RpZmljYXRpb24oc291cmNlOiBudW1iZXIgfCBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIGFwcDogc3RyaW5nLCB0aW1lb3V0PzogbnVtYmVyKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZSxcbiAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgIGFwcCxcbiAgICAgICAgdGltZW91dDogdGltZW91dCB8fCA1MDAwLFxuICAgIH0pKTtcbn1cbmV4cG9ydHMoJ1NlbmROb3RpZmljYXRpb24nLCBTZW5kTm90aWZpY2F0aW9uKTtcblxuYXN5bmMgZnVuY3Rpb24gU2VuZE1haWwoZGF0YToge1xuICAgIGVtYWlsOiBzdHJpbmc7XG4gICAgdG86IHN0cmluZztcbiAgICBzdWJqZWN0OiBzdHJpbmc7XG4gICAgbWVzc2FnZTogc3RyaW5nO1xuICAgIGltYWdlczogc3RyaW5nW107XG4gICAgc291cmNlOiBudW1iZXI7XG59KSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbmRNYWlsKGRhdGEuZW1haWwsIGRhdGEudG8sIGRhdGEuc3ViamVjdCwgZGF0YS5tZXNzYWdlLCBkYXRhLmltYWdlcywgZGF0YS5zb3VyY2UpO1xuICAgIHJldHVybiByZXM7XG59XG5leHBvcnRzKCdTZW5kTWFpbCcsIFNlbmRNYWlsKTtcblxuYXN5bmMgZnVuY3Rpb24gU2VuZE1haWxUb0FsbChkYXRhOiB7XG4gICAgc3ViamVjdDogc3RyaW5nO1xuICAgIHNlbmRlcjogc3RyaW5nO1xuICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICBpbWFnZXM6IHN0cmluZ1tdO1xufSkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5zZW5kRW1haWxUb0FsbChkYXRhLnN1YmplY3QsIGRhdGEuc2VuZGVyLGRhdGEubWVzc2FnZSwgZGF0YS5pbWFnZXMpO1xuICAgIHJldHVybiByZXM7XG59XG5leHBvcnRzKCdTZW5kTWFpbFRvQWxsJywgU2VuZE1haWxUb0FsbCk7XG5cbmNvbnN0IEdldEpvYnMgPSBhc3luYyAoY2l0aXplbklkOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIHt9O1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IFV0aWxzLmdldEpvYnMoY2l0aXplbklkKTtcbiAgICByZXR1cm4gcmVzLmpvYnMgfHwge307XG59O1xuZXhwb3J0cygnZ2V0Sm9icycsIEdldEpvYnMpO1xuXG4vLyBPcHRpb25hbDogcmV0dXJuIGZ1bGwgcmVzdWx0IHsgam9icywgZW1wbG95ZWVzIH1cbmNvbnN0IEdldEpvYnNGdWxsID0gYXN5bmMgKGNpdGl6ZW5JZDogc3RyaW5nKSA9PiB7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiB7IGpvYnM6IHt9LCBlbXBsb3llZXM6IHt9IH07XG4gICAgcmV0dXJuIGF3YWl0IFV0aWxzLmdldEpvYnMoY2l0aXplbklkKTtcbn07XG5leHBvcnRzKCdnZXRKb2JzRnVsbCcsIEdldEpvYnNGdWxsKTsiLCAiY29uc3QgY2FjaGVFdmVudHMgPSB7fTtcbmV4cG9ydCBjb25zdCBjYWNoZSA9IG5ldyBQcm94eSh7XG4gICAgcmVzb3VyY2U6IEdldEN1cnJlbnRSZXNvdXJjZU5hbWUoKSxcbiAgICBnYW1lOiBHZXRHYW1lTmFtZSgpLFxufSwge1xuICAgIGdldCh0YXJnZXQsIGtleSkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBrZXkgPyB0YXJnZXRba2V5XSA6IHRhcmdldDtcbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgY2FjaGVFdmVudHNba2V5XSA9IFtdO1xuICAgICAgICBBZGRFdmVudEhhbmRsZXIoYG94X2xpYjpjYWNoZToke2tleX1gLCAodmFsdWUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICBjb25zdCBldmVudHMgPSBjYWNoZUV2ZW50c1trZXldO1xuICAgICAgICAgICAgZXZlbnRzLmZvckVhY2goKGNiKSA9PiBjYih2YWx1ZSwgb2xkVmFsdWUpKTtcbiAgICAgICAgICAgIHRhcmdldFtrZXldID0gdmFsdWU7XG4gICAgICAgIH0pO1xuICAgICAgICB0YXJnZXRba2V5XSA9IGV4cG9ydHMub3hfbGliLmNhY2hlKGtleSkgfHwgZmFsc2U7XG4gICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICB9LFxufSk7XG5leHBvcnQgY29uc3Qgb25DYWNoZSA9IChrZXksIGNiKSA9PiB7XG4gICAgaWYgKCFjYWNoZUV2ZW50c1trZXldKVxuICAgICAgICBjYWNoZVtrZXldO1xuICAgIGNhY2hlRXZlbnRzW2tleV0ucHVzaChjYik7XG59O1xuIiwgImltcG9ydCB7IGNhY2hlIH0gZnJvbSAnLi4vY2FjaGUnO1xuY29uc3QgcGVuZGluZ0NhbGxiYWNrcyA9IHt9O1xuY29uc3QgY2FsbGJhY2tUaW1lb3V0ID0gR2V0Q29udmFySW50KCdveDpjYWxsYmFja1RpbWVvdXQnLCAzMDAwMDApO1xub25OZXQoYF9fb3hfY2JfJHtjYWNoZS5yZXNvdXJjZX1gLCAoa2V5LCAuLi5hcmdzKSA9PiB7XG4gICAgY29uc3QgcmVzb2x2ZSA9IHBlbmRpbmdDYWxsYmFja3Nba2V5XTtcbiAgICBkZWxldGUgcGVuZGluZ0NhbGxiYWNrc1trZXldO1xuICAgIHJldHVybiByZXNvbHZlICYmIHJlc29sdmUoLi4uYXJncyk7XG59KTtcbmV4cG9ydCBmdW5jdGlvbiB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soZXZlbnROYW1lLCBwbGF5ZXJJZCwgLi4uYXJncykge1xuICAgIGxldCBrZXk7XG4gICAgZG8ge1xuICAgICAgICBrZXkgPSBgJHtldmVudE5hbWV9OiR7TWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKDEwMDAwMCArIDEpKX06JHtwbGF5ZXJJZH1gO1xuICAgIH0gd2hpbGUgKHBlbmRpbmdDYWxsYmFja3Nba2V5XSk7XG4gICAgZW1pdE5ldChgX19veF9jYl8ke2V2ZW50TmFtZX1gLCBwbGF5ZXJJZCwgY2FjaGUucmVzb3VyY2UsIGtleSwgLi4uYXJncyk7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgcGVuZGluZ0NhbGxiYWNrc1trZXldID0gcmVzb2x2ZTtcbiAgICAgICAgc2V0VGltZW91dChyZWplY3QsIGNhbGxiYWNrVGltZW91dCwgYGNhbGxiYWNrIGV2ZW50ICcke2tleX0nIHRpbWVkIG91dGApO1xuICAgIH0pO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG9uQ2xpZW50Q2FsbGJhY2soZXZlbnROYW1lLCBjYikge1xuICAgIG9uTmV0KGBfX294X2NiXyR7ZXZlbnROYW1lfWAsIGFzeW5jIChyZXNvdXJjZSwga2V5LCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IHNyYyA9IHNvdXJjZTtcbiAgICAgICAgbGV0IHJlc3BvbnNlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcG9uc2UgPSBhd2FpdCBjYihzcmMsIC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBhbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBoYW5kbGluZyBjYWxsYmFjayBldmVudCAke2V2ZW50TmFtZX1gKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBeMyR7ZS5zdGFja31eMGApO1xuICAgICAgICB9XG4gICAgICAgIGVtaXROZXQoYF9fb3hfY2JfJHtyZXNvdXJjZX1gLCBzcmMsIGtleSwgcmVzcG9uc2UpO1xuICAgIH0pO1xufVxuIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBQaG9uZUNvbnRhY3RzIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOmdldENvbnRhY3RzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgY29udGFjdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9jb250YWN0cycsIHsgb3duZXJJZDogY2l0aXplbklkIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShjb250YWN0cyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6c2F2ZUNvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjb250YWN0RGF0YTogUGhvbmVDb250YWN0cyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgaWYgKGNvbnRhY3REYXRhLl9pZCkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogY29udGFjdERhdGEuX2lkIH0sIHsgLi4uY29udGFjdERhdGEgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ29udGFjdCBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3REYXRhLmZpcnN0TmFtZX0nJHtjb250YWN0RGF0YS5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdERhdGEuY29udGFjdE51bWJlcn0pIHVwZGF0ZWQgYnkgJHtjb250YWN0RGF0YS5wZXJzb25hbE51bWJlcn0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NvbnRhY3RzOmFkZENvbnRhY3QnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IGNvbnRhY3REYXRhOiBQaG9uZUNvbnRhY3RzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBkYXRhWCA9IHsgLi4uY29udGFjdERhdGEsIG93bmVySWQ6IGNpdGl6ZW5JZCwgcGVyc29uYWxOdW1iZXI6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoY2l0aXplbklkKSB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2NvbnRhY3RzJywgZGF0YVgpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICB0aXRsZTogJ0NvbnRhY3QgQWRkZWQnLFxuICAgICAgICBtZXNzYWdlOiBgQ29udGFjdCAnJHtjb250YWN0RGF0YS5maXJzdE5hbWV9JyR7Y29udGFjdERhdGEubGFzdE5hbWV9JyAoTnVtYmVyOiAke2NvbnRhY3REYXRhLmNvbnRhY3ROdW1iZXJ9KSBhZGRlZCBieSAke2RhdGFYLnBlcnNvbmFsTnVtYmVyfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGFYKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdjb250YWN0czpkZWxldGVDb250YWN0JywgYXN5bmMgKGNsaWVudCwgX2lkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBjb250YWN0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSk7XG4gICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IF9pZCB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2NvbnRhY3RzJyxcbiAgICAgICAgdGl0bGU6ICdDb250YWN0IERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgQ29udGFjdCAnJHtjb250YWN0LmZpcnN0TmFtZX0nICcke2NvbnRhY3QubGFzdE5hbWV9JyAoTnVtYmVyOiAke2NvbnRhY3QuY29udGFjdE51bWJlcn0pIGRlbGV0ZWQgYnkgJHtjb250YWN0LnBlcnNvbmFsTnVtYmVyfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY29udGFjdHM6ZmF2Q29udGFjdCcsIGFzeW5jIChjbGllbnQsIF9pZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgY29udGFjdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogX2lkIH0pO1xuICAgIGNvbnN0IGRhdGFYID0geyAuLi5jb250YWN0LCBpc0ZhdjogIWNvbnRhY3QuaXNGYXYgfVxuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9jb250YWN0cycsIHsgX2lkOiBfaWQgfSwgZGF0YVgpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfY29udGFjdHMnLFxuICAgICAgICB0aXRsZTogJ0NvbnRhY3QgRmF2b3JpdGUgVG9nZ2xlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBDb250YWN0ICcke2NvbnRhY3QuZmlyc3ROYW1lfScgJyR7Y29udGFjdC5sYXN0TmFtZX0nIChOdW1iZXI6ICR7Y29udGFjdC5jb250YWN0TnVtYmVyfSkgZmF2b3JpdGUgc3RhdHVzIHNldCB0byAke2RhdGFYLmlzRmF2fSBieSAke2NvbnRhY3QucGVyc29uYWxOdW1iZXJ9LmAsXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGFYKTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgTG9nZ2VyLCBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IERhcmtDaGF0Q2hhbm5lbCB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1NlYXJjaERhcmtDaGF0RW1haWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnUmVnaXN0ZXJOZXdEYXJrTWFpbEFjY291bnQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCwgZW1haWwsIHBhc3N3b3JkLCBhdmF0YXI6IFwiXCIgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9hY2NvdW50cycsXG4gICAgICAgIHRpdGxlOiAnQWNjb3VudCBSZWdpc3RlcmVkJyxcbiAgICAgICAgbWVzc2FnZTogYE5ldyBEYXJrQ2hhdCBhY2NvdW50IHJlZ2lzdGVyZWQgd2l0aCBlbWFpbCAke2VtYWlsfS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnTG9naW5EYXJrTWFpbEFjY291bnQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhOiB7XG4gICAgICAgIGVtYWlsOiBzdHJpbmc7XG4gICAgICAgIHBhc3N3b3JkOiBzdHJpbmc7XG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9kYXJrY2hhdF9tYWlsJywgeyBfaWQ6IHBhcnNlZERhdGEuZW1haWwgfSk7XG4gICAgaWYgKHJlcy5wYXNzd29yZCA9PT0gcGFyc2VkRGF0YS5wYXNzd29yZCkge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9hY2NvdW50cycsXG4gICAgICAgICAgICB0aXRsZTogJ0FjY291bnQgTG9naW4nLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgbG9nZ2VkIGludG8gRGFya0NoYXQgd2l0aCBlbWFpbCAke3BhcnNlZERhdGEuZW1haWx9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0NyZWF0ZU5ld0RhcmtDaGFubmVsJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBuYW1lLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMyOiBEYXJrQ2hhdENoYW5uZWxbXSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywge30pO1xuICAgIGlmIChyZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSkgJiYgIXJlczIuZmluZCgoY2hhbm5lbCkgPT4gY2hhbm5lbC5uYW1lID09PSBuYW1lKT8ubWVtYmVycy5pbmNsdWRlcyhlbWFpbCkpIHtcbiAgICAgICAgcmVzMi5maW5kKChjaGFubmVsKSA9PiBjaGFubmVsLm5hbWUgPT09IG5hbWUpPy5tZW1iZXJzLnB1c2goZW1haWwpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IG5hbWUgfSwgcmVzMi5maW5kKChjaGFubmVsKSA9PiBjaGFubmVsLm5hbWUgPT09IG5hbWUpKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdKb2luZWQgQ2hhbm5lbCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gam9pbmVkIGV4aXN0aW5nIERhcmtDaGF0IGNoYW5uZWwgJyR7bmFtZX0nLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzMi5maWx0ZXIoKGNoYW5uZWwpID0+IGNoYW5uZWwubWVtYmVycy5pbmNsdWRlcyhlbWFpbCkpKTtcbiAgICB9IGVsc2UgaWYgKCFyZXMyLmZpbmQoKGNoYW5uZWwpID0+IGNoYW5uZWwubmFtZSA9PT0gbmFtZSkpIHtcbiAgICAgICAgY29uc3QgbmV3RGF0YSA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgbWVtYmVyczogW2VtYWlsXSxcbiAgICAgICAgICAgIGNyZWF0b3I6IGVtYWlsLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCBuZXdEYXRhKTtcbiAgICAgICAgcmVzMi5wdXNoKG5ld0RhdGEpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsXG4gICAgICAgICAgICB0aXRsZTogJ0NoYW5uZWwgQ3JlYXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtlbWFpbH0gY3JlYXRlZCBuZXcgRGFya0NoYXQgY2hhbm5lbCAnJHtuYW1lfScuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMyLmZpbHRlcigoY2hhbm5lbCkgPT4gY2hhbm5lbC5tZW1iZXJzLmluY2x1ZGVzKGVtYWlsKSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnR2V0RGFya0NoYXRQcm9maWxlJywgYXN5bmMgKGNsaWVudCwgZW1haWw6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdHZXREYXJrQ2hhdENoYW5uZWxzJywgYXN5bmMgKGNsaWVudCwgZW1haWw6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBtZW1iZXJzOiBlbWFpbCB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdSZW1vdmVGcm9tRGFya0NoYW5uZWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IF9pZCwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9kYXJrY2hhdF9jaGFubmVscycsIHsgX2lkIH0pO1xuICAgIGlmIChyZXMuY3JlYXRvciA9PT0gZW1haWwpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBfaWQgfSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQ2hhbm5lbCBEZWxldGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2VtYWlsfSBkZWxldGVkIERhcmtDaGF0IGNoYW5uZWwgJyR7cmVzLm5hbWV9JyAoSUQ6ICR7X2lkfSkuYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVzLm1lbWJlcnMgPSByZXMubWVtYmVycy5maWx0ZXIoKG1lbWJlcjogc3RyaW5nKSA9PiBtZW1iZXIgIT09IGVtYWlsKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJywgeyBfaWQgfSwgcmVzKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdMZWZ0IENoYW5uZWwnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IGxlZnQgRGFya0NoYXQgY2hhbm5lbCAnJHtyZXMubmFtZX0nIChJRDogJHtfaWR9KS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnVXBkYXRlRGFya0F2YXRhcicsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZW1haWwsIGF2YXRhciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZW1haWwgfSk7XG4gICAgcmVzLmF2YXRhciA9IGF2YXRhcjtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfbWFpbCcsIHsgX2lkOiBlbWFpbCB9LCByZXMpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZGFya2NoYXRfYWNjb3VudHMnLFxuICAgICAgICB0aXRsZTogJ0F2YXRhciBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IHVwZGF0ZWQgdGhlaXIgRGFya0NoYXQgYXZhdGFyLmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdVcGRhdGVEYXJrUGFzc3dvcmQnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZW1haWwgfSk7XG4gICAgcmVzLnBhc3N3b3JkID0gcGFzc3dvcmQ7XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2RhcmtjaGF0X21haWwnLCB7IF9pZDogZW1haWwgfSwgcmVzKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2FjY291bnRzJyxcbiAgICAgICAgdGl0bGU6ICdQYXNzd29yZCBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7ZW1haWx9IHVwZGF0ZWQgdGhlaXIgRGFya0NoYXQgcGFzc3dvcmQuYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ1NldERhcmtDaGF0TWVzc2FnZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhWDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBjaGFubmVsLCBkYXRhIH0gPSBKU09OLnBhcnNlKGRhdGFYKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfZGFya2NoYXRfY2hhbm5lbHMnLCB7IF9pZDogY2hhbm5lbCB9LCBkYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2RhcmtjaGF0X2NoYW5uZWxzJyxcbiAgICAgICAgdGl0bGU6ICdNZXNzYWdlIFNlbnQnLFxuICAgICAgICBtZXNzYWdlOiBgTWVzc2FnZSBzZW50IGluIERhcmtDaGF0IGNoYW5uZWwgJyR7ZGF0YS5uYW1lfScgKElEOiAke2NoYW5uZWx9KSwgQ29udGVudDogJHtkYXRhLmNvbnRlbnR9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICBkYXRhLm1lbWJlcnMuZm9yRWFjaChhc3luYyAobWVtYmVyOiBzdHJpbmcpID0+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChhd2FpdCBVdGlscy5HZXRDaWRGcm9tRGFya0VtYWlsKG1lbWJlcikpO1xuICAgICAgICBpZiAoIXJlcykgcmV0dXJuO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlY2VpdmVEYXJrQ2hhdE1lc3NhZ2UnLCByZXMsIEpTT04uc3RyaW5naWZ5KGRhdGEpKTtcbiAgICAgICAgaWYgKHJlcyAhPT0gY2xpZW50KSB7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZXMsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdEYXJrQ2hhdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBhIG5ldyBtZXNzYWdlIGluICR7ZGF0YS5uYW1lfS5gLFxuICAgICAgICAgICAgICAgIGFwcDogJ3NldHRpbmdzJyxcbiAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgTWFpbENsYXNzIH0gZnJvbSBcIi4vY2xhc3NcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6Z2V0RW1haWxNZXNzYWdlcycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZW1haWw6IHN0cmluZywgcGFzc3dvcmQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBNYWlsQ2xhc3MuZ2V0TWFpbE1lc3NhZ2VzKGVtYWlsLCBwYXNzd29yZClcbiAgICByZXR1cm4gZGF0YTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VuZEVtYWlsJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBlbWFpbDogc3RyaW5nLCB0bzogc3RyaW5nLCBzdWJqZWN0OiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZywgaW1hZ2VzOiBzdHJpbmdbXSkgPT4ge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1haWxDbGFzcy5zZW5kTWFpbChlbWFpbCwgdG8sIHN1YmplY3QsIG1lc3NhZ2UsIGltYWdlcywgc291cmNlKTtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWFpbCcsXG4gICAgICAgIHRpdGxlOiAnRW1haWwgU2VudCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQbGF5ZXIgJHtjaXRpemVuSWR9IHNlbnQgYW4gZW1haWwgZnJvbSAke2VtYWlsfSB0byAke3RvfSB3aXRoIHN1YmplY3QgXCIke3N1YmplY3R9XCIsIGNvbnRlbnQ6IFwiJHttZXNzYWdlfVwiYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiByZXM7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNldFNlbGVjdGVkTWVzc2FnZScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTWFpbENsYXNzLnNlbGVjdGVNZXNzYWdlKGRhdGEpO1xuICAgIHJldHVybiByZXM7XG59KVxuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6Z2V0UHJvZmlsZVNldHRpbmdzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gcGFyc2VkRGF0YTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNYWlsQ2xhc3MuZ2V0UHJvZmlsZVNldHRpbmdzKGVtYWlsLCBwYXNzd29yZCk7XG4gICAgcmV0dXJuIHJlcztcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6dXBkYXRlUHJvZmlsZVNldHRpbmdzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCwgdXNlcm5hbWUsIGF2YXRhciB9ID0gcGFyc2VkRGF0YTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNYWlsQ2xhc3MudXBkYXRlUHJvZmlsZVNldHRpbmdzKGVtYWlsLCBwYXNzd29yZCwgdXNlcm5hbWUsIGF2YXRhcik7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX21haWwnLFxuICAgICAgICB0aXRsZTogJ1Byb2ZpbGUgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQbGF5ZXIgJHtjaXRpemVuSWR9IHVwZGF0ZWQgcHJvZmlsZSBmb3IgZW1haWwgJHtlbWFpbH0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiByZXM7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnNlbmRNZXNzYWdlJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0eXBlLCBwaG9uZU51bWJlciwgZ3JvdXBJZCwgbWVzc2FnZURhdGEgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgbGV0IGZpcnN0TWVzc2FnZSA9IGZhbHNlO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHVzZXJNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IHNlbmRlcklkLFxuICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXVxuICAgICAgICB9O1xuICAgICAgICBmaXJzdE1lc3NhZ2UgPSB0cnVlO1xuICAgIH1cblxuICAgIGxldCBjb252ZXJzYXRpb247XG4gICAgaWYgKHR5cGUgPT09ICdwcml2YXRlJykge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyID09PSBwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIocGhvbmVOdW1iZXIsIHNlbmRlcklkKSB8fCBgVW5rbm93biAoJHtwaG9uZU51bWJlcn0pYDtcbiAgICAgICAgICAgIGNvbnN0IGF2YXRhciA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3RBdmF0YXJCeU51bWJlcihwaG9uZU51bWJlciwgc2VuZGVySWQpIHx8IG51bGw7IC8vIEFzc3VtZSB0aGlzIHV0aWxpdHkgZXhpc3RzXG4gICAgICAgICAgICBjb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3ByaXZhdGUnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGNvbnRhY3ROYW1lLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogYXZhdGFyLCAvLyBTZXQgYXZhdGFyIGZvciBwcml2YXRlIGNvbnRhY3RcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogcGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2goY29udmVyc2F0aW9uKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2dyb3VwJykge1xuICAgICAgICBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgZ3JvdXBJZD86IHN0cmluZyB9KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdncm91cCcgJiYgbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWNvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQgZm9yIHNlbmRlcicgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBsYXN0TWVzc2FnZSA9IGNvbnZlcnNhdGlvbi5tZXNzYWdlc1tjb252ZXJzYXRpb24ubWVzc2FnZXMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgbmV4dFBhZ2UgPSBsYXN0TWVzc2FnZSA/IGxhc3RNZXNzYWdlLnBhZ2UgKyAxIDogMTtcblxuICAgIGNvbnN0IG5ld01lc3NhZ2UgPSB7XG4gICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VEYXRhLm1lc3NhZ2UsXG4gICAgICAgIHJlYWQ6IHRydWUsXG4gICAgICAgIHBhZ2U6IG5leHRQYWdlLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgc2VuZGVySWQ6IHNlbmRlclBob25lTnVtYmVyLFxuICAgICAgICBhdHRhY2htZW50czogbWVzc2FnZURhdGEuYXR0YWNobWVudHMgfHwgW11cbiAgICB9O1xuXG4gICAgY29udmVyc2F0aW9uLm1lc3NhZ2VzLnB1c2gobmV3TWVzc2FnZSk7XG5cbiAgICBpZiAoIWZpcnN0TWVzc2FnZSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tZXNzYWdlcycsIHVzZXJNZXNzYWdlcyk7XG4gICAgfVxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfbWVzc2FnZXMnLFxuICAgICAgICB0aXRsZTogJ01lc3NhZ2UgU2VudCcsXG4gICAgICAgIG1lc3NhZ2U6IGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gc2VudCBhIG1lc3NhZ2UgdG8gJHt0eXBlID09PSAncHJpdmF0ZScgPyBwaG9uZU51bWJlciA6ICdncm91cCAnICsgZ3JvdXBJZH0gd2l0aCBjb250ZW50OiAke21lc3NhZ2VEYXRhLm1lc3NhZ2V9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIC8vIEhhbmRsZSByZWNpcGllbnRzXG4gICAgaWYgKHR5cGUgPT09ICdwcml2YXRlJykge1xuICAgICAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHBob25lTnVtYmVyKTtcbiAgICAgICAgaWYgKHRhcmdldENpdGl6ZW5JZCkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGNvbnN0IGlzQmxvY2tlZCA9IHRhcmdldE1lc3NhZ2VzPy5ibG9ja2VkTnVtYmVycz8uaW5jbHVkZXMoc2VuZGVyUGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgaWYgKCFpc0Jsb2NrZWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBzZW5kVG9SZWNpcGllbnQodGFyZ2V0Q2l0aXplbklkLCBzZW5kZXJQaG9uZU51bWJlciwgbWVzc2FnZURhdGEsICdwcml2YXRlJywgcGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZCh0YXJnZXRDaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgIGlmIChDVlhDUykge1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIENWWENTLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiWW91IGhhdmUgYSBuZXcgbWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmVfbWVzc2FnZXM6Y2xpZW50OnVwZGF0ZU1lc3NhZ2VzJywgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KG5ld01lc3NhZ2UpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gaXMgYmxvY2tlZCBieSAke3Bob25lTnVtYmVyfS4gTWVzc2FnZSBzYXZlZCBvbmx5IGZvciBzZW5kZXIuYCk7ICovXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhgUmVjaXBpZW50IHdpdGggcGhvbmUgbnVtYmVyICR7cGhvbmVOdW1iZXJ9IGRvZXMgbm90IGV4aXN0LiBNZXNzYWdlIHNhdmVkIG9ubHkgZm9yIHNlbmRlci5gKTsgKi9cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2dyb3VwJykge1xuICAgICAgICBjb25zdCBncm91cENvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXBDb252ZXJzYXRpb24/Lm1lbWJlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbWVtYmVycyBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgbWVtYmVySWQgb2YgZ3JvdXBDb252ZXJzYXRpb24ubWVtYmVycykge1xuICAgICAgICAgICAgaWYgKG1lbWJlcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQobWVtYmVySWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzQmxvY2tlZCA9IG1lbWJlck1lc3NhZ2VzPy5ibG9ja2VkTnVtYmVycz8uaW5jbHVkZXMoc2VuZGVyUGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgIGlmICghaXNCbG9ja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHNlbmRUb1JlY2lwaWVudChtZW1iZXJJZCwgc2VuZGVyUGhvbmVOdW1iZXIsIG1lc3NhZ2VEYXRhLCAnZ3JvdXAnLCB1bmRlZmluZWQsIGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGBTZW5kZXIgJHtzZW5kZXJQaG9uZU51bWJlcn0gaXMgYmxvY2tlZCBieSBncm91cCBtZW1iZXIgJHttZW1iZXJQaG9uZU51bWJlcn0uYCk7ICovXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgICAgICAgICAgaWYgKENWWENTKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgQ1ZYQ1MsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBhIG5ldyBtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZV9tZXNzYWdlczpjbGllbnQ6dXBkYXRlTWVzc2FnZXMnLCBDVlhDUywgSlNPTi5zdHJpbmdpZnkoeyAuLi5uZXdNZXNzYWdlLCBncm91cElkIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xufSk7XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBzZW5kIG1lc3NhZ2VzIHRvIHJlY2lwaWVudHMgKHVuY2hhbmdlZClcbmFzeW5jIGZ1bmN0aW9uIHNlbmRUb1JlY2lwaWVudChcbiAgICB0YXJnZXRDaXRpemVuSWQ6IHN0cmluZyxcbiAgICBzZW5kZXJQaG9uZU51bWJlcjogc3RyaW5nLFxuICAgIG1lc3NhZ2VEYXRhOiBhbnksXG4gICAgdHlwZTogJ3ByaXZhdGUnIHwgJ2dyb3VwJyxcbiAgICBwaG9uZU51bWJlcj86IHN0cmluZyxcbiAgICBncm91cElkPzogc3RyaW5nXG4pIHtcbiAgICBsZXQgdGFyZ2V0TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpdGl6ZW5JZCB9KTtcbiAgICBsZXQgcmVjZWl2ZXJGaXJzdE1lc3NhZ2UgPSBmYWxzZTtcblxuICAgIGlmICghdGFyZ2V0TWVzc2FnZXMpIHtcbiAgICAgICAgdGFyZ2V0TWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH07XG4gICAgICAgIHJlY2VpdmVyRmlyc3RNZXNzYWdlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBsZXQgdGFyZ2V0Q29udmVyc2F0aW9uO1xuICAgIGlmICh0eXBlID09PSAncHJpdmF0ZScpIHtcbiAgICAgICAgdGFyZ2V0Q29udmVyc2F0aW9uID0gdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAncHJpdmF0ZScgJiYgbXNnLnBob25lTnVtYmVyID09PSBzZW5kZXJQaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghdGFyZ2V0Q29udmVyc2F0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWN0TmFtZSA9IGF3YWl0IFV0aWxzLkdldENvbnRhY3ROYW1lQnlOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIsIHRhcmdldENpdGl6ZW5JZCk7XG4gICAgICAgICAgICBjb25zdCBhdmF0YXIgPSBhd2FpdCBVdGlscy5HZXRDb250YWN0QXZhdGFyQnlOdW1iZXIoc2VuZGVyUGhvbmVOdW1iZXIsIHRhcmdldENpdGl6ZW5JZCkgfHwgJyc7IC8vIEFzc3VtZSB0aGlzIHV0aWxpdHkgZXhpc3RzXG4gICAgICAgICAgICB0YXJnZXRDb252ZXJzYXRpb24gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3ByaXZhdGUnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGNvbnRhY3ROYW1lIHx8IGBVbmtub3duICgke3NlbmRlclBob25lTnVtYmVyfSlgLFxuICAgICAgICAgICAgICAgIGF2YXRhcjogYXZhdGFyLCAvLyBTZXQgYXZhdGFyIGZvciBwcml2YXRlIGNvbnRhY3RcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogc2VuZGVyUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGFyZ2V0TWVzc2FnZXMubWVzc2FnZXMucHVzaCh0YXJnZXRDb252ZXJzYXRpb24pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSAnZ3JvdXAnKSB7XG4gICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHRhcmdldE1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyB0eXBlOiBzdHJpbmcsIGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKCF0YXJnZXRDb252ZXJzYXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHNlbmRlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHNlbmRlclBob25lTnVtYmVyKSB9KTtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwID0gc2VuZGVyTWVzc2FnZXM/Lm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgICAgIGlmICghZ3JvdXApIHJldHVybjtcbiAgICAgICAgICAgIHRhcmdldENvbnZlcnNhdGlvbiA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgICAgICAgICAgIG5hbWU6IGdyb3VwLm5hbWUsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiBncm91cC5hdmF0YXIgfHwgbnVsbCwgLy8gQ29weSBhdmF0YXIgZnJvbSBzZW5kZXIncyBncm91cFxuICAgICAgICAgICAgICAgIGdyb3VwSWQ6IGdyb3VwSWQsXG4gICAgICAgICAgICAgICAgbWVtYmVyczogZ3JvdXAubWVtYmVycyxcbiAgICAgICAgICAgICAgICBtZW1iZXJQaG9uZU51bWJlcnM6IGdyb3VwLm1lbWJlclBob25lTnVtYmVycyxcbiAgICAgICAgICAgICAgICBjcmVhdG9ySWQ6IGdyb3VwLmNyZWF0b3JJZCwgLy8gQ29weSBjcmVhdG9ySWRcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB0YXJnZXRNZXNzYWdlcy5tZXNzYWdlcy5wdXNoKHRhcmdldENvbnZlcnNhdGlvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB0YXJnZXRMYXN0TWVzc2FnZSA9IHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlc1t0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgdGFyZ2V0TmV4dFBhZ2UgPSB0YXJnZXRMYXN0TWVzc2FnZSA/IHRhcmdldExhc3RNZXNzYWdlLnBhZ2UgKyAxIDogMTtcblxuICAgIGNvbnN0IHRhcmdldE5ld01lc3NhZ2UgPSB7XG4gICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VEYXRhLm1lc3NhZ2UsXG4gICAgICAgIHJlYWQ6IGZhbHNlLFxuICAgICAgICBwYWdlOiB0YXJnZXROZXh0UGFnZSxcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHNlbmRlcklkOiBzZW5kZXJQaG9uZU51bWJlcixcbiAgICAgICAgYXR0YWNobWVudHM6IG1lc3NhZ2VEYXRhLmF0dGFjaG1lbnRzIHx8IFtdXG4gICAgfTtcblxuICAgIHRhcmdldENvbnZlcnNhdGlvbi5tZXNzYWdlcy5wdXNoKHRhcmdldE5ld01lc3NhZ2UpO1xuXG4gICAgaWYgKCFyZWNlaXZlckZpcnN0TWVzc2FnZSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdGFyZ2V0TWVzc2FnZXMuX2lkIH0sIHRhcmdldE1lc3NhZ2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWVzc2FnZXMnLCB0YXJnZXRNZXNzYWdlcyk7XG4gICAgfVxufVxuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmNyZWF0ZUdyb3VwJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBncm91cE5hbWUsIG1lbWJlclBob25lTnVtYmVycywgYXZhdGFyIH0gPSBKU09OLnBhcnNlKGRhdGEpOyAvLyBBZGRlZCBhdmF0YXIgZmllbGRcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBtZW1iZXJJZHMgPSBbc2VuZGVySWRdO1xuICAgIGNvbnN0IHBob25lTnVtYmVycyA9IFtzZW5kZXJQaG9uZU51bWJlcl07XG4gICAgZm9yIChjb25zdCBwaG9uZSBvZiBtZW1iZXJQaG9uZU51bWJlcnMpIHtcbiAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZSk7XG4gICAgICAgIGlmIChjaXRpemVuSWQgJiYgIW1lbWJlcklkcy5pbmNsdWRlcyhjaXRpemVuSWQpKSB7XG4gICAgICAgICAgICBtZW1iZXJJZHMucHVzaChjaXRpemVuSWQpO1xuICAgICAgICAgICAgcGhvbmVOdW1iZXJzLnB1c2gocGhvbmUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZ3JvdXBJZCA9IGdlbmVyYXRlVVVpZCgpO1xuICAgIGNvbnN0IGdyb3VwQ29udmVyc2F0aW9uID0ge1xuICAgICAgICB0eXBlOiAnZ3JvdXAnLFxuICAgICAgICBuYW1lOiBncm91cE5hbWUsXG4gICAgICAgIGF2YXRhcjogYXZhdGFyIHx8ICcnLFxuICAgICAgICBncm91cElkOiBncm91cElkLFxuICAgICAgICBtZW1iZXJzOiBtZW1iZXJJZHMsXG4gICAgICAgIG1lbWJlclBob25lTnVtYmVyczogcGhvbmVOdW1iZXJzLFxuICAgICAgICBjcmVhdG9ySWQ6IHNlbmRlcklkLCAvLyBTZXQgdGhlIGNyZWF0b3IgYXMgdGhlIHNlbmRlclxuICAgICAgICBtZXNzYWdlczogW11cbiAgICB9O1xuXG4gICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogXCJNZXNzYWdlc1wiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgY3JlYXRlZCBuZXcgR3JvdXBcIixcbiAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGNpdGl6ZW5JZDogc2VuZGVySWQsXG4gICAgICAgICAgICBibG9ja2VkTnVtYmVyczogW10sXG4gICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtncm91cENvbnZlcnNhdGlvbl1cbiAgICAgICAgfTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgdXNlck1lc3NhZ2VzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB1c2VyTWVzc2FnZXMubWVzc2FnZXMucHVzaChncm91cENvbnZlcnNhdGlvbik7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0sIHVzZXJNZXNzYWdlcyk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBtZW1iZXJJZCBvZiBtZW1iZXJJZHMpIHtcbiAgICAgICAgaWYgKG1lbWJlcklkICE9PSBzZW5kZXJJZCkge1xuICAgICAgICAgICAgbGV0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgIGNvbnN0IENWWENTID0gYXdhaXQgVXRpbHMuR2V0U291cmNlRnJvbUNpdGl6ZW5JZChtZW1iZXJJZCk7XG4gICAgICAgICAgICBpZiAoQ1ZYQ1MpIHtcbiAgICAgICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIENWWENTLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiTWVzc2FnZXNcIixcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiWW91IGhhdmUgYmVlbiBhZGRlZCB0byBhIG5ldyBncm91cFwiLFxuICAgICAgICAgICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiAyMDAwLFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICBtZW1iZXJNZXNzYWdlcyA9IHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgY2l0aXplbklkOiBtZW1iZXJJZCxcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tlZE51bWJlcnM6IFtdLFxuICAgICAgICAgICAgICAgICAgICBkZWxldGVkTWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlczogW3sgLi4uZ3JvdXBDb252ZXJzYXRpb24gfV1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tZXNzYWdlcycsIG1lbWJlck1lc3NhZ2VzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMucHVzaCh7IC4uLmdyb3VwQ29udmVyc2F0aW9uIH0pO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfZ3JvdXBzJyxcbiAgICAgICAgdGl0bGU6ICdHcm91cCBDcmVhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEdyb3VwICcke2dyb3VwTmFtZX0nIGNyZWF0ZWQgYnkgJHtzZW5kZXJQaG9uZU51bWJlcn0uIEdyb3VwIElEOiAke2dyb3VwSWR9IHdpdGggbWVtYmVyczogJHttZW1iZXJQaG9uZU51bWJlcnMuam9pbignLCAnKX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSwgZ3JvdXBJZCB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnRvZ2dsZUJsb2NrJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBwaG9uZU51bWJlciB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBsZXQgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICB1c2VyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgY2l0aXplbklkOiBzZW5kZXJJZCxcbiAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgIGRlbGV0ZWRNZXNzYWdlczogW10sXG4gICAgICAgICAgICBtZXNzYWdlczogW11cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoIXVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycykge1xuICAgICAgICB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMgPSBbXTtcbiAgICB9XG5cbiAgICBjb25zdCBpc0Jsb2NrZWQgPSB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMuaW5jbHVkZXMocGhvbmVOdW1iZXIpO1xuICAgIGlmIChpc0Jsb2NrZWQpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB1c2VyTWVzc2FnZXMuYmxvY2tlZE51bWJlcnMuaW5kZXhPZihwaG9uZU51bWJlcik7XG4gICAgICAgIHVzZXJNZXNzYWdlcy5ibG9ja2VkTnVtYmVycy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkTm90aUZpY2F0aW9uXCIsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJOdW1iZXIgdW5ibG9ja2VkXCIsXG4gICAgICAgICAgICBhcHA6IFwibWVzc2FnZVwiLFxuICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9ibG9ja3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdOdW1iZXIgVW5ibG9ja2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NlbmRlclBob25lTnVtYmVyfSB1bmJsb2NrZWQgJHtwaG9uZU51bWJlcn0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLnB1c2gocGhvbmVOdW1iZXIpO1xuICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkTm90aUZpY2F0aW9uXCIsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJOdW1iZXIgYmxvY2tlZFwiLFxuICAgICAgICAgICAgYXBwOiBcIm1lc3NhZ2VcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYmxvY2tzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnTnVtYmVyIEJsb2NrZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7c2VuZGVyUGhvbmVOdW1iZXJ9IGJsb2NrZWQgJHtwaG9uZU51bWJlcn0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5sZW5ndGggPT09IDAgJiYgdXNlck1lc3NhZ2VzLmJsb2NrZWROdW1iZXJzLmxlbmd0aCA9PT0gMCAmJiAhdXNlck1lc3NhZ2VzLmRlbGV0ZWRNZXNzYWdlcz8ubGVuZ3RoKSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiB1c2VyTWVzc2FnZXMuX2lkIH0sIHVzZXJNZXNzYWdlcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOmFkZE1lbWJlcicsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgZ3JvdXBJZCwgcGhvbmVOdW1iZXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICAgICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFZhbGlkYXRlIHRoZSBuZXcgbWVtYmVyXG4gICAgICAgIGNvbnN0IG5ld01lbWJlcklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICghbmV3TWVtYmVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCB0aGUgc2VuZGVyJ3MgbWVzc2FnZXMgdG8gZmluZCB0aGUgZ3JvdXBcbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBtZW1iZXJzPzogc3RyaW5nW10sIGNyZWF0b3JJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmICghZ3JvdXAgfHwgIWdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnR3JvdXAgbm90IGZvdW5kIG9yIHVuYXV0aG9yaXplZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgbmV3IG1lbWJlciBpcyBhbHJlYWR5IGluIHRoZSBncm91cFxuICAgICAgICBpZiAoZ3JvdXAubWVtYmVycy5pbmNsdWRlcyhuZXdNZW1iZXJJZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTWVtYmVyIGFscmVhZHkgaW4gZ3JvdXAnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQWRkIHRoZSBuZXcgbWVtYmVyIHRvIHRoZSBncm91cFxuICAgICAgICBncm91cC5tZW1iZXJzLnB1c2gobmV3TWVtYmVySWQpO1xuICAgICAgICBncm91cC5tZW1iZXJQaG9uZU51bWJlcnMucHVzaChwaG9uZU51bWJlcik7XG5cbiAgICAgICAgLy8gVXBkYXRlIGFsbCBleGlzdGluZyBtZW1iZXJzJyBncm91cCBkYXRhLCBpbmNsdWRpbmcgdGhlIHNlbmRlciBhbmQgbmV3IG1lbWJlclxuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgICAgIGxldCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG5cbiAgICAgICAgICAgIGlmICghbWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICAvLyBJZiB0aGUgbWVtYmVyIGlzIG5ldyAobm8gbWVzc2FnZXMgZG9jdW1lbnQpLCBjcmVhdGUgb25lXG4gICAgICAgICAgICAgICAgbWVtYmVyTWVzc2FnZXMgPSB7XG4gICAgICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogbWVtYmVySWQsXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrZWROdW1iZXJzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlZE1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbWVtYmVyR3JvdXAgPSBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgICAgICBpZiAobWVtYmVyR3JvdXApIHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgZXhpc3RpbmcgZ3JvdXAgZGF0YSBmb3IgdGhpcyBtZW1iZXJcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJzID0gZ3JvdXAubWVtYmVycztcbiAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJQaG9uZU51bWJlcnMgPSBncm91cC5tZW1iZXJQaG9uZU51bWJlcnM7XG4gICAgICAgICAgICAgICAgbWVtYmVyR3JvdXAuYXZhdGFyID0gZ3JvdXAuYXZhdGFyOyAvLyBFbnN1cmUgYXZhdGFyIGlzIGNvcGllZFxuICAgICAgICAgICAgICAgIG1lbWJlckdyb3VwLmNyZWF0b3JJZCA9IGdyb3VwLmNyZWF0b3JJZDsgLy8gRW5zdXJlIGNyZWF0b3JJZCBpcyBjb3BpZWRcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gQWRkIHRoZSBncm91cCB0byB0aGlzIG1lbWJlcidzIG1lc3NhZ2VzIGlmIGl0IGRvZXNuXHUyMDE5dCBleGlzdFxuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLnB1c2goeyAuLi5ncm91cCB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU2F2ZSBvciB1cGRhdGUgdGhlIG1lbWJlcidzIG1lc3NhZ2VzXG4gICAgICAgICAgICBpZiAobWVtYmVyTWVzc2FnZXMuX2lkKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IG1lbWJlck1lc3NhZ2VzLl9pZCB9LCBtZW1iZXJNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgLyogLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgZ3JvdXAgZGF0YSBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCkpICovXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBncm91cCBkYXRhIGZvciBtZW1iZXIgJHttZW1iZXJJZH06YCwgZXJyb3IpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21lc3NhZ2VzJywgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgIC8qIC50aGVuKCgpID0+IGNvbnNvbGUubG9nKGBDcmVhdGVkIG1lc3NhZ2VzIGZvciBuZXcgbWVtYmVyICR7bWVtYmVySWR9YCkpICovXG4gICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIGNyZWF0ZSBtZXNzYWdlcyBmb3IgbmV3IG1lbWJlciAke21lbWJlcklkfTpgLCBlcnJvcikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ01lbWJlciBBZGRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJQaG9uZU51bWJlcn0gYWRkZWQgJHtwaG9uZU51bWJlcn0gdG8gZ3JvdXAgJHtncm91cElkfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBhZGRpbmcgbWVtYmVyIHRvIGdyb3VwOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBhZGRpbmcgdGhlIG1lbWJlciB0byB0aGUgZ3JvdXAnIH0pO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdwaG9uZV9tZXNzYWdlOnJlbW92ZU1lbWJlcicsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZ3JvdXBJZCwgcGhvbmVOdW1iZXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgY29uc3QgbWVtYmVySWRUb1JlbW92ZSA9IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIocGhvbmVOdW1iZXIpO1xuICAgIGlmICghbWVtYmVySWRUb1JlbW92ZSkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lbWJlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzPy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgaWYgKCFncm91cCB8fCAhZ3JvdXAubWVtYmVycykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCBvciB1bmF1dGhvcml6ZWQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG1lbWJlckluZGV4ID0gZ3JvdXAubWVtYmVycy5pbmRleE9mKG1lbWJlcklkVG9SZW1vdmUpO1xuICAgIGlmIChtZW1iZXJJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdNZW1iZXIgbm90IGluIGdyb3VwJyB9KTtcbiAgICB9XG5cbiAgICBncm91cC5tZW1iZXJzLnNwbGljZShtZW1iZXJJbmRleCwgMSk7XG4gICAgZ3JvdXAubWVtYmVyUGhvbmVOdW1iZXJzLnNwbGljZShtZW1iZXJJbmRleCwgMSk7XG5cbiAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMpIHtcbiAgICAgICAgY29uc3QgbWVtYmVyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IG1lbWJlcklkIH0pO1xuICAgICAgICBjb25zdCBtZW1iZXJHcm91cCA9IG1lbWJlck1lc3NhZ2VzPy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmIChtZW1iZXJHcm91cCkge1xuICAgICAgICAgICAgbWVtYmVyR3JvdXAubWVtYmVycyA9IGdyb3VwLm1lbWJlcnM7XG4gICAgICAgICAgICBtZW1iZXJHcm91cC5tZW1iZXJQaG9uZU51bWJlcnMgPSBncm91cC5tZW1iZXJQaG9uZU51bWJlcnM7XG4gICAgICAgICAgICBtZW1iZXJHcm91cC5hdmF0YXIgPSBncm91cC5hdmF0YXI7IC8vIEVuc3VyZSBhdmF0YXIgaXMgY29waWVkXG4gICAgICAgICAgICBtZW1iZXJHcm91cC5jcmVhdG9ySWQgPSBncm91cC5jcmVhdG9ySWQ7IC8vIEVuc3VyZSBjcmVhdG9ySWQgaXMgY29waWVkXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogbWVtYmVyTWVzc2FnZXMuX2lkIH0sIG1lbWJlck1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHJlbW92ZWRNZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWRUb1JlbW92ZSB9KTtcbiAgICBpZiAocmVtb3ZlZE1lbWJlck1lc3NhZ2VzKSB7XG4gICAgICAgIGNvbnN0IGdyb3VwSW5kZXggPSByZW1vdmVkTWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZEluZGV4KChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgICAgIGlmIChncm91cEluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgcmVtb3ZlZE1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLnNwbGljZShncm91cEluZGV4LCAxKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiByZW1vdmVkTWVtYmVyTWVzc2FnZXMuX2lkIH0sIHJlbW92ZWRNZW1iZXJNZXNzYWdlcyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICB0aXRsZTogJ01lbWJlciBSZW1vdmVkJyxcbiAgICAgICAgbWVzc2FnZTogYCR7c2VuZGVyUGhvbmVOdW1iZXJ9IHJlbW92ZWQgJHtwaG9uZU51bWJlcn0gZnJvbSBncm91cCAke2dyb3VwSWR9LmAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpkZWxldGVHcm91cCcsIGFzeW5jIChjbGllbnQsIGdyb3VwSWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBjb25zdCBzZW5kZXJQaG9uZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlDaXRpemVuSWQoc2VuZGVySWQpO1xuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzPy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZyB9KSA9PiBtc2cuZ3JvdXBJZCA9PT0gZ3JvdXBJZCk7XG4gICAgaWYgKCFncm91cCB8fCAhZ3JvdXAubWVtYmVycykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCBvciB1bmF1dGhvcml6ZWQnIH0pO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGlmIHRoZSBzZW5kZXIgaXMgdGhlIGdyb3VwIGNyZWF0b3IgKGFkbWluKVxuICAgIGlmIChncm91cC5jcmVhdG9ySWQgIT09IHNlbmRlcklkKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnT25seSB0aGUgZ3JvdXAgY3JlYXRvciBjYW4gZGVsZXRlIHRoZSBncm91cCcgfSk7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBtZW1iZXJJZCBvZiBncm91cC5tZW1iZXJzKSB7XG4gICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgY29uc3QgQ1ZYQ1MgPSBhd2FpdCBVdGlscy5HZXRTb3VyY2VGcm9tQ2l0aXplbklkKG1lbWJlcklkKTtcbiAgICAgICAgaWYgKENWWENTKSB7XG4gICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIENWWENTLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiBcIk1lc3NhZ2VzXCIsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiR3JvdXAgaGFzIGJlZW4gZGVsZXRlZFwiLFxuICAgICAgICAgICAgICAgIGFwcDogXCJtZXNzYWdlXCIsXG4gICAgICAgICAgICAgICAgdGltZW91dDogMjAwMCxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwSW5kZXggPSBtZW1iZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kSW5kZXgoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgICAgIGlmIChncm91cEluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLnNwbGljZShncm91cEluZGV4LCAxKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogbWVtYmVyTWVzc2FnZXMuX2lkIH0sIG1lbWJlck1lc3NhZ2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgIHRpdGxlOiAnR3JvdXAgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBHcm91cCAke2dyb3VwSWR9IGRlbGV0ZWQgYnkgJHtzZW5kZXJQaG9uZU51bWJlcn0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpnZXRHcm91cE1lc3NhZ2VzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBncm91cElkLCBwYWdlID0gMSwgbGltaXQgPSAyMCB9ID0gSlNPTi5wYXJzZShkYXRhKTsgLy8gQWRkIHBhZ2UgYW5kIGxpbWl0IGZvciBwYWdpbmF0aW9uXG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZXM6IFtdLCBtZXNzYWdlOiAnTm8gbWVzc2FnZXMgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgdHlwZTogc3RyaW5nLCBncm91cElkPzogc3RyaW5nIH0pID0+XG4gICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIG1zZy5ncm91cElkID09PSBncm91cElkKTtcblxuICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlczogW10sIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICAvLyBTb3J0IG1lc3NhZ2VzIGJ5IHRpbWVzdGFtcCAoZGVzY2VuZGluZykgYW5kIHBhZ2luYXRlXG4gICAgY29uc3Qgc29ydGVkTWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+XG4gICAgICAgIG5ldyBEYXRlKGIudGltZXN0YW1wKS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLnRpbWVzdGFtcCkuZ2V0VGltZSgpXG4gICAgKTtcblxuICAgIGNvbnN0IHN0YXJ0SW5kZXggPSAocGFnZSAtIDEpICogbGltaXQ7XG4gICAgY29uc3QgZW5kSW5kZXggPSBzdGFydEluZGV4ICsgbGltaXQ7XG4gICAgY29uc3QgcGFnaW5hdGVkTWVzc2FnZXMgPSBzb3J0ZWRNZXNzYWdlcy5zbGljZShzdGFydEluZGV4LCBlbmRJbmRleCk7XG5cbiAgICBjb25zdCBoYXNNb3JlID0gZW5kSW5kZXggPCBzb3J0ZWRNZXNzYWdlcy5sZW5ndGg7XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICBtZXNzYWdlczogcGFnaW5hdGVkTWVzc2FnZXMsXG4gICAgICAgIG1lbWJlclBob25lTnVtYmVyczogY29udmVyc2F0aW9uLm1lbWJlclBob25lTnVtYmVycyB8fCBbXSxcbiAgICAgICAgbmFtZTogY29udmVyc2F0aW9uLm5hbWUsXG4gICAgICAgIGF2YXRhcjogY29udmVyc2F0aW9uLmF2YXRhciB8fCBudWxsLFxuICAgICAgICBoYXNNb3JlOiBoYXNNb3JlLFxuICAgICAgICB0b3RhbE1lc3NhZ2VzOiBzb3J0ZWRNZXNzYWdlcy5sZW5ndGgsXG4gICAgICAgIGNyZWF0b3JJZDogY29udmVyc2F0aW9uLmNyZWF0b3JJZCAvLyBJbmNsdWRlIGNyZWF0b3JJZCBmb3IgVUkgb3IgdmVyaWZpY2F0aW9uIGlmIG5lZWRlZFxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0UHJpdmF0ZU1lc3NhZ2VzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBwaG9uZU51bWJlciwgcGFnZSA9IDEsIGxpbWl0ID0gMjAgfSA9IEpTT04ucGFyc2UoZGF0YSk7IC8vIEFkZCBwYWdlIGFuZCBsaW1pdCBmb3IgcGFnaW5hdGlvblxuICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcblxuICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgbWVzc2FnZTogJ05vIG1lc3NhZ2VzIGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBjb252ZXJzYXRpb24gPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IHR5cGU6IHN0cmluZywgcGhvbmVOdW1iZXI/OiBzdHJpbmcgfSkgPT5cbiAgICAgICAgbXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBtc2cucGhvbmVOdW1iZXIgPT09IHBob25lTnVtYmVyKTtcblxuICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlczogW10sIG1lc3NhZ2U6ICdDb252ZXJzYXRpb24gbm90IGZvdW5kJyB9KTtcbiAgICB9XG5cbiAgICAvLyBTb3J0IG1lc3NhZ2VzIGJ5IHRpbWVzdGFtcCAoZGVzY2VuZGluZykgYW5kIHBhZ2luYXRlXG4gICAgY29uc3Qgc29ydGVkTWVzc2FnZXMgPSBjb252ZXJzYXRpb24ubWVzc2FnZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+XG4gICAgICAgIG5ldyBEYXRlKGIudGltZXN0YW1wKS5nZXRUaW1lKCkgLSBuZXcgRGF0ZShhLnRpbWVzdGFtcCkuZ2V0VGltZSgpXG4gICAgKTtcblxuICAgIGNvbnN0IHN0YXJ0SW5kZXggPSAocGFnZSAtIDEpICogbGltaXQ7XG4gICAgY29uc3QgZW5kSW5kZXggPSBzdGFydEluZGV4ICsgbGltaXQ7XG4gICAgY29uc3QgcGFnaW5hdGVkTWVzc2FnZXMgPSBzb3J0ZWRNZXNzYWdlcy5zbGljZShzdGFydEluZGV4LCBlbmRJbmRleCk7XG4gICAgY29uc3QgaGFzTW9yZSA9IGVuZEluZGV4IDwgc29ydGVkTWVzc2FnZXMubGVuZ3RoO1xuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbWVzc2FnZXM6IHBhZ2luYXRlZE1lc3NhZ2VzLFxuICAgICAgICBhdmF0YXI6IGNvbnZlcnNhdGlvbi5hdmF0YXIgfHwgbnVsbCxcbiAgICAgICAgbmFtZTogY29udmVyc2F0aW9uLm5hbWUsXG4gICAgICAgIGhhc01vcmU6IGhhc01vcmUsXG4gICAgICAgIHRvdGFsTWVzc2FnZXM6IHNvcnRlZE1lc3NhZ2VzLmxlbmd0aFxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0TWVzc2FnZUNoYW5uZWxzYW5kTGFzdE1lc3NhZ2VzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcblxuICAgICAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICAgICAgaWYgKCF1c2VyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnTm8gbWVzc2FnZXMgZm91bmQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2hhbm5lbHMgPSB1c2VyTWVzc2FnZXMubWVzc2FnZXMubWFwKGFzeW5jIChtc2c6IHsgdHlwZTogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIHBob25lTnVtYmVyPzogc3RyaW5nLCBhdmF0YXI6IHN0cmluZywgZ3JvdXBJZD86IHN0cmluZywgbWVtYmVycz86IHN0cmluZ1tdLCBtZW1iZXJQaG9uZU51bWJlcnM/OiBzdHJpbmdbXSwgbWVzc2FnZXM6IGFueVtdLCBjcmVhdG9ySWQ/OiBzdHJpbmcgfSkgPT4ge1xuICAgICAgICAgICAgbGV0IHVwZGF0ZWROYW1lID0gbXNnLm5hbWU7XG4gICAgICAgICAgICBsZXQgdXBkYXRlZE1lbWJlclBob25lTnVtYmVycyA9IG1zZy5tZW1iZXJQaG9uZU51bWJlcnMgfHwgW107XG5cbiAgICAgICAgICAgIC8vIEhhbmRsZSBwcml2YXRlIGNvbnZlcnNhdGlvbnNcbiAgICAgICAgICAgIGlmIChtc2cudHlwZSA9PT0gJ3ByaXZhdGUnICYmIG1zZy5waG9uZU51bWJlcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld0NvbnRhY3ROYW1lID0gYXdhaXQgVXRpbHMuR2V0Q29udGFjdE5hbWVCeU51bWJlcihtc2cucGhvbmVOdW1iZXIsIHNlbmRlcklkKSB8fCBgVW5rbm93biAoJHttc2cucGhvbmVOdW1iZXJ9KWA7XG4gICAgICAgICAgICAgICAgaWYgKG5ld0NvbnRhY3ROYW1lICE9PSBtc2cubmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgdGhlIG5hbWUgaW4gdGhlIGRhdGFiYXNlIGlmIGl0IGhhcyBjaGFuZ2VkXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtOiBhbnkpID0+IG0udHlwZSA9PT0gJ3ByaXZhdGUnICYmIG0ucGhvbmVOdW1iZXIgPT09IG1zZy5waG9uZU51bWJlcik7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb252ZXJzYXRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnZlcnNhdGlvbi5uYW1lID0gbmV3Q29udGFjdE5hbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogLnRoZW4oKCkgPT4gY29uc29sZS5sb2coYFVwZGF0ZWQgY29udGFjdCBuYW1lIGZvciAke21zZy5waG9uZU51bWJlcn0gdG8gJHtuZXdDb250YWN0TmFtZX1gKSkgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpID0+IGNvbnNvbGUuZXJyb3IoYEZhaWxlZCB0byB1cGRhdGUgY29udGFjdCBuYW1lIGZvciAke21zZy5waG9uZU51bWJlcn06YCwgZXJyb3IpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB1cGRhdGVkTmFtZSA9IG5ld0NvbnRhY3ROYW1lO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEhhbmRsZSBncm91cCBjb252ZXJzYXRpb25zXG4gICAgICAgICAgICBlbHNlIGlmIChtc2cudHlwZSA9PT0gJ2dyb3VwJyAmJiBtc2cubWVtYmVyUGhvbmVOdW1iZXJzICYmIG1zZy5tZW1iZXJQaG9uZU51bWJlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbXNnLm1lbWJlclBob25lTnVtYmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwaG9uZSA9IG1zZy5tZW1iZXJQaG9uZU51bWJlcnNbaV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld0NvbnRhY3ROYW1lID0gYXdhaXQgVXRpbHMuR2V0Q29udGFjdE5hbWVCeU51bWJlcihwaG9uZSwgc2VuZGVySWQpIHx8IGBVbmtub3duICgke3Bob25lfSlgO1xuICAgICAgICAgICAgICAgICAgICAvLyBZb3UgY291bGQgdXBkYXRlIGluZGl2aWR1YWwgbWVtYmVyIG5hbWVzIGhlcmUgaWYgbmVlZGVkLCBidXQgZm9yIGdyb3VwIG5hbWUsIHdlIGtlZXAgaXQgYXMtaXMgdW5sZXNzIHNwZWNpZmllZFxuICAgICAgICAgICAgICAgICAgICAvLyBPcHRpb25hbGx5LCB5b3UgY291bGQgYWdncmVnYXRlIG1lbWJlciBuYW1lcyBpbnRvIHRoZSBncm91cCBuYW1lIGlmIGRlc2lyZWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdHlwZTogbXNnLnR5cGUsXG4gICAgICAgICAgICAgICAgbmFtZTogdXBkYXRlZE5hbWUsXG4gICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IG1zZy5waG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICBncm91cElkOiBtc2cuZ3JvdXBJZCxcbiAgICAgICAgICAgICAgICBtZW1iZXJzOiBtc2cubWVtYmVycyxcbiAgICAgICAgICAgICAgICBhdmF0YXI6IG1zZy5hdmF0YXIsXG4gICAgICAgICAgICAgICAgbWVtYmVyUGhvbmVOdW1iZXJzOiB1cGRhdGVkTWVtYmVyUGhvbmVOdW1iZXJzLFxuICAgICAgICAgICAgICAgIGxhc3RNZXNzYWdlOiBtc2cubWVzc2FnZXNbbXNnLm1lc3NhZ2VzLmxlbmd0aCAtIDFdLFxuICAgICAgICAgICAgICAgIGNyZWF0b3JJZDogbXNnLmNyZWF0b3JJZCAvLyBJbmNsdWRlIGNyZWF0b3JJZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gV2FpdCBmb3IgYWxsIHByb21pc2VzIHRvIHJlc29sdmVcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRDaGFubmVscyA9IGF3YWl0IFByb21pc2UuYWxsKGNoYW5uZWxzKTtcblxuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlLCBjaGFubmVsczogcmVzb2x2ZWRDaGFubmVscyB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBmZXRjaGluZyBtZXNzYWdlIGNoYW5uZWxzIGFuZCBsYXN0IG1lc3NhZ2VzOicsIGVycm9yKTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBtZXNzYWdlIGNoYW5uZWxzJyB9KTtcbiAgICB9XG59KTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lX21lc3NhZ2U6Z2V0TWVzc2FnZVN0YXRzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuXG4gICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ1NlbmRlciBub3QgZm91bmQnIH0pO1xuICAgIH1cblxuICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgc3RhdHM6IHtcbiAgICAgICAgICAgICAgICBhbGxNZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICBrbm93bk1lc3NhZ2VzOiAwLFxuICAgICAgICAgICAgICAgIHVua25vd25NZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICB1bnJlYWRNZXNzYWdlczogMCxcbiAgICAgICAgICAgICAgICByZWNlbnRseURlbGV0ZWQ6IDBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY3VycmVudERhdGUgPSBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IHRoaXJ0eURheXNBZ28gPSBuZXcgRGF0ZShjdXJyZW50RGF0ZS5nZXRUaW1lKCkgLSAzMCAqIDI0ICogNjAgKiA2MCAqIDEwMDApOyAvLyAzMCBkYXlzIGFnb1xuXG4gICAgbGV0IGFsbE1lc3NhZ2VzID0gMDtcbiAgICBsZXQga25vd25NZXNzYWdlcyA9IDA7XG4gICAgbGV0IHVua25vd25NZXNzYWdlcyA9IDA7XG4gICAgbGV0IHVucmVhZE1lc3NhZ2VzID0gMDtcbiAgICBsZXQgcmVjZW50bHlEZWxldGVkID0gMDtcblxuICAgIGZvciAoY29uc3QgY29udmVyc2F0aW9uIG9mIHVzZXJNZXNzYWdlcy5tZXNzYWdlcykge1xuICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgY29udmVyc2F0aW9uLm1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBhbGxNZXNzYWdlcyArPSAxO1xuXG4gICAgICAgICAgICBjb25zdCBpc0tub3duID0gY29udmVyc2F0aW9uLm5hbWUgJiYgIWNvbnZlcnNhdGlvbi5uYW1lLm1hdGNoKC9eWzAtOSFAIyQlXiYqKClfK1xcLT1cXFtcXF17fTsnOlwiXFxcXHwsLjw+XFwvP10qJC8pO1xuICAgICAgICAgICAgaWYgKGlzS25vd24pIHtcbiAgICAgICAgICAgICAgICBrbm93bk1lc3NhZ2VzICs9IDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHVua25vd25NZXNzYWdlcyArPSAxO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIW1lc3NhZ2UucmVhZCkge1xuICAgICAgICAgICAgICAgIHVucmVhZE1lc3NhZ2VzICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodXNlck1lc3NhZ2VzLmRlbGV0ZWRNZXNzYWdlcykge1xuICAgICAgICByZWNlbnRseURlbGV0ZWQgPSB1c2VyTWVzc2FnZXMuZGVsZXRlZE1lc3NhZ2VzLmZpbHRlcigoZGVsZXRlZDogYW55KSA9PlxuICAgICAgICAgICAgZGVsZXRlZC50aW1lc3RhbXAgPiB0aGlydHlEYXlzQWdvXG4gICAgICAgICkubGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIHN0YXRzOiB7XG4gICAgICAgICAgICBhbGxNZXNzYWdlcyxcbiAgICAgICAgICAgIGtub3duTWVzc2FnZXMsXG4gICAgICAgICAgICB1bmtub3duTWVzc2FnZXMsXG4gICAgICAgICAgICB1bnJlYWRNZXNzYWdlcyxcbiAgICAgICAgICAgIHJlY2VudGx5RGVsZXRlZFxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTpkZWxldGVNZXNzYWdlJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBjb252ZXJzYXRpb25UeXBlLCBwaG9uZU51bWJlciwgZ3JvdXBJZCwgbWVzc2FnZUluZGV4IH0gPSBKU09OLnBhcnNlKGRhdGEgfHwgJ3t9Jyk7XG4gICAgY29uc3Qgc2VuZGVySWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG5cbiAgICBpZiAoIXNlbmRlcklkKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgdXNlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBzZW5kZXJJZCB9KTtcbiAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgbGV0IGNvbnZlcnNhdGlvbjogYW55O1xuICAgIGlmIChjb252ZXJzYXRpb25UeXBlID09PSAncHJpdmF0ZScgJiYgcGhvbmVOdW1iZXIpIHtcbiAgICAgICAgY29udmVyc2F0aW9uID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogYW55KSA9PlxuICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBOdW1iZXIobXNnLnBob25lTnVtYmVyKSA9PT0gTnVtYmVyKHBob25lTnVtYmVyKVxuICAgICAgICApO1xuICAgIH0gZWxzZSBpZiAoY29udmVyc2F0aW9uVHlwZSA9PT0gJ2dyb3VwJyAmJiBncm91cElkKSB7XG4gICAgICAgIGNvbnZlcnNhdGlvbiA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IGFueSkgPT5cbiAgICAgICAgICAgIG1zZy50eXBlID09PSAnZ3JvdXAnICYmIFN0cmluZyhtc2cuZ3JvdXBJZCkgPT09IFN0cmluZyhncm91cElkKVxuICAgICAgICApO1xuICAgIH1cblxuICAgIGlmICghY29udmVyc2F0aW9uKSB7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQ29udmVyc2F0aW9uIG5vdCBmb3VuZCcgfSk7XG4gICAgfVxuXG4gICAgY29udmVyc2F0aW9uLm1lc3NhZ2VzID0gY29udmVyc2F0aW9uLm1lc3NhZ2VzLmZpbHRlcigobXNnOiBhbnkpID0+IE51bWJlcihtc2cucGFnZSkgIT09IE51bWJlcihtZXNzYWdlSW5kZXgpKTtcblxuICAgIC8vIFBlcnNpc3QgbG9jYWwgY2hhbmdlXG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBfaWQ6IHVzZXJNZXNzYWdlcy5faWQgfSwgdXNlck1lc3NhZ2VzKTtcblxuICAgIC8vIEF0dGVtcHQgcmVtb3RlIGRlbGV0ZSBvbmx5IGZvciBwcml2YXRlIGNvbnZlcnNhdGlvbnMgYW5kIHdoZW4gdGFyZ2V0IGV4aXN0c1xuICAgIGlmIChjb252ZXJzYXRpb25UeXBlID09PSAncHJpdmF0ZScgJiYgcGhvbmVOdW1iZXIpIHtcbiAgICAgICAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihwaG9uZU51bWJlcik7XG4gICAgICAgIGlmICh0YXJnZXRDaXRpemVuSWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFNvdXJjZSA9IGF3YWl0IFV0aWxzLkdldFNvdXJjZUZyb21DaXRpemVuSWQodGFyZ2V0Q2l0aXplbklkKTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldE1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQgfSk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0TWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRDb252ZXJzYXRpb24gPSB0YXJnZXRNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IGFueSkgPT5cbiAgICAgICAgICAgICAgICAgICAgbXNnLnR5cGUgPT09ICdwcml2YXRlJyAmJiBOdW1iZXIobXNnLnBob25lTnVtYmVyKSA9PT0gTnVtYmVyKHNlbmRlclBob25lTnVtYmVyKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldENvbnZlcnNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXMgPSB0YXJnZXRDb252ZXJzYXRpb24ubWVzc2FnZXMuZmlsdGVyKChtc2c6IGFueSkgPT4gTnVtYmVyKG1zZy5wYWdlKSAhPT0gTnVtYmVyKG1lc3NhZ2VJbmRleCkpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdGFyZ2V0TWVzc2FnZXMuX2lkIH0sIHRhcmdldE1lc3NhZ2VzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF3YWl0IERvZXNQbGF5ZXJFeGlzdCh0YXJnZXRTb3VyY2UpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZV9tZXNzYWdlczpjbGllbnQ6dXBkYXRlTWVzc2FnZXMnLCBOdW1iZXIodGFyZ2V0U291cmNlKSwgSlNPTi5zdHJpbmdpZnkodGFyZ2V0TWVzc2FnZXMpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGVtaXROZXQoJ3Bob25lX21lc3NhZ2VzOmNsaWVudDp1cGRhdGVNZXNzYWdlcycsIE51bWJlcihjbGllbnQpLCBKU09OLnN0cmluZ2lmeSh1c2VyTWVzc2FnZXMpKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX21lc3NhZ2VzJyxcbiAgICAgICAgdGl0bGU6ICdNZXNzYWdlIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTWVzc2FnZSBkZWxldGVkIGZyb20gJHtjb252ZXJzYXRpb25UeXBlfSBjb252ZXJzYXRpb24gd2l0aCAke3Bob25lTnVtYmVyIHx8IGdyb3VwSWR9IGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IHRydWUgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTp1cGRhdGVHcm91cE5hbWUnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7IGdyb3VwSWQsIG5ld05hbWUgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHNlbmRlcklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgY29uc3Qgc2VuZGVyUGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5Q2l0aXplbklkKHNlbmRlcklkKTtcbiAgICAgICAgaWYgKCFzZW5kZXJJZCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdTZW5kZXIgbm90IGZvdW5kJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCB1c2VyTWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21lc3NhZ2VzJywgeyBjaXRpemVuSWQ6IHNlbmRlcklkIH0pO1xuICAgICAgICBpZiAoIXVzZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdNZXNzYWdlcyBub3QgZm91bmQgZm9yIHNlbmRlcicgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBncm91cCA9IHVzZXJNZXNzYWdlcy5tZXNzYWdlcy5maW5kKChtc2c6IHsgZ3JvdXBJZD86IHN0cmluZywgY3JlYXRvcklkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgaWYgKCFncm91cCkge1xuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6ICdHcm91cCBub3QgZm91bmQnIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGdyb3VwLmNyZWF0b3JJZCAhPT0gc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnT25seSB0aGUgZ3JvdXAgY3JlYXRvciBjYW4gdXBkYXRlIHRoZSBncm91cCBuYW1lJyB9KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvbGROYW1lID0gZ3JvdXAubmFtZTtcbiAgICAgICAgZ3JvdXAubmFtZSA9IG5ld05hbWU7XG5cbiAgICAgICAgZm9yIChjb25zdCBtZW1iZXJJZCBvZiBncm91cC5tZW1iZXJzIHx8IFtdKSB7XG4gICAgICAgICAgICBjb25zdCBtZW1iZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogbWVtYmVySWQgfSk7XG4gICAgICAgICAgICBpZiAobWVtYmVyTWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZW1iZXJHcm91cCA9IG1lbWJlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nIH0pID0+IG1zZy5ncm91cElkID09PSBncm91cElkKTtcbiAgICAgICAgICAgICAgICBpZiAobWVtYmVyR3JvdXApIHtcbiAgICAgICAgICAgICAgICAgICAgbWVtYmVyR3JvdXAubmFtZSA9IG5ld05hbWU7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBuYW1lIGZvciBtZW1iZXIgJHttZW1iZXJJZH1gKSkgKi9cbiAgICAgICAgICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBncm91cCBuYW1lIGZvciBtZW1iZXIgJHttZW1iZXJJZH06YCwgZXJyb3IpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYEdyb3VwIG5vdCBmb3VuZCBpbiBtZW1iZXIgJHttZW1iZXJJZH0ncyBtZXNzYWdlc2ApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBObyBtZXNzYWdlcyBmb3VuZCBmb3IgbWVtYmVyICR7bWVtYmVySWR9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpXG4gICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBuYW1lIGZvciBzZW5kZXIgJHtzZW5kZXJJZH1gKSkgKi9cbiAgICAgICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSkgPT4gY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHVwZGF0ZSBncm91cCBuYW1lIGZvciBzZW5kZXIgJHtzZW5kZXJJZH06YCwgZXJyb3IpKTtcblxuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9ncm91cHMnLFxuICAgICAgICAgICAgdGl0bGU6ICdHcm91cCBOYW1lIFVwZGF0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEdyb3VwICR7Z3JvdXBJZH0gfCAke29sZE5hbWV9IG5hbWUgdXBkYXRlZCB0byAke25ld05hbWV9IGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIGdyb3VwIG5hbWU6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0FuIGVycm9yIG9jY3VycmVkIHdoaWxlIHVwZGF0aW5nIHRoZSBncm91cCBuYW1lJyB9KTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmVfbWVzc2FnZTp1cGRhdGVHcm91cEF2YXRhcicsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHsgZ3JvdXBJZCwgbmV3QXZhdGFyIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBzZW5kZXJJZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgIGNvbnN0IHNlbmRlclBob25lTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeUNpdGl6ZW5JZChzZW5kZXJJZCk7XG4gICAgICAgIGlmICghc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnU2VuZGVyIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGZXRjaCB0aGUgc2VuZGVyJ3MgbWVzc2FnZXMgdG8gZmluZCB0aGUgZ3JvdXBcbiAgICAgICAgbGV0IHVzZXJNZXNzYWdlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IGNpdGl6ZW5JZDogc2VuZGVySWQgfSk7XG4gICAgICAgIGlmICghdXNlck1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ01lc3NhZ2VzIG5vdCBmb3VuZCBmb3Igc2VuZGVyJyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdyb3VwID0gdXNlck1lc3NhZ2VzLm1lc3NhZ2VzLmZpbmQoKG1zZzogeyBncm91cElkPzogc3RyaW5nLCBjcmVhdG9ySWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICBpZiAoIWdyb3VwKSB7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiBmYWxzZSwgbWVzc2FnZTogJ0dyb3VwIG5vdCBmb3VuZCcgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgc2VuZGVyIGlzIHRoZSBncm91cCBjcmVhdG9yIChhZG1pbilcbiAgICAgICAgaWYgKGdyb3VwLmNyZWF0b3JJZCAhPT0gc2VuZGVySWQpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnT25seSB0aGUgZ3JvdXAgY3JlYXRvciBjYW4gdXBkYXRlIHRoZSBncm91cCBhdmF0YXInIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBncm91cCBhdmF0YXIgZm9yIHRoZSBzZW5kZXJcbiAgICAgICAgZ3JvdXAuYXZhdGFyID0gbmV3QXZhdGFyO1xuXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgZ3JvdXAgYXZhdGFyIGZvciBhbGwgbWVtYmVyc1xuICAgICAgICBmb3IgKGNvbnN0IG1lbWJlcklkIG9mIGdyb3VwLm1lbWJlcnMgfHwgW10pIHtcbiAgICAgICAgICAgIGNvbnN0IG1lbWJlck1lc3NhZ2VzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgY2l0aXplbklkOiBtZW1iZXJJZCB9KTtcbiAgICAgICAgICAgIGlmIChtZW1iZXJNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lbWJlckdyb3VwID0gbWVtYmVyTWVzc2FnZXMubWVzc2FnZXMuZmluZCgobXNnOiB7IGdyb3VwSWQ/OiBzdHJpbmcgfSkgPT4gbXNnLmdyb3VwSWQgPT09IGdyb3VwSWQpO1xuICAgICAgICAgICAgICAgIGlmIChtZW1iZXJHcm91cCkge1xuICAgICAgICAgICAgICAgICAgICBtZW1iZXJHcm91cC5hdmF0YXIgPSBuZXdBdmF0YXI7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tZXNzYWdlcycsIHsgX2lkOiBtZW1iZXJNZXNzYWdlcy5faWQgfSwgbWVtYmVyTWVzc2FnZXMpXG4gICAgICAgICAgICAgICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBhdmF0YXIgZm9yIG1lbWJlciAke21lbWJlcklkfWApKSAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIGF2YXRhciBmb3IgbWVtYmVyICR7bWVtYmVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBHcm91cCBub3QgZm91bmQgaW4gbWVtYmVyICR7bWVtYmVySWR9J3MgbWVzc2FnZXNgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gbWVzc2FnZXMgZm91bmQgZm9yIG1lbWJlciAke21lbWJlcklkfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXBkYXRlIHRoZSBzZW5kZXIncyBtZXNzYWdlc1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbWVzc2FnZXMnLCB7IF9pZDogdXNlck1lc3NhZ2VzLl9pZCB9LCB1c2VyTWVzc2FnZXMpXG4gICAgICAgICAgICAvKiAudGhlbigoKSA9PiBjb25zb2xlLmxvZyhgVXBkYXRlZCBncm91cCBhdmF0YXIgZm9yIHNlbmRlciAke3NlbmRlcklkfWApKSAqL1xuICAgICAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KSA9PiBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gdXBkYXRlIGdyb3VwIGF2YXRhciBmb3Igc2VuZGVyICR7c2VuZGVySWR9OmAsIGVycm9yKSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2dyb3VwcycsXG4gICAgICAgICAgICB0aXRsZTogJ0dyb3VwIEF2YXRhciBVcGRhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBHcm91cCAke2dyb3VwSWR9IGF2YXRhciB1cGRhdGVkIGJ5ICR7c2VuZGVyUGhvbmVOdW1iZXJ9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBzdWNjZXNzOiB0cnVlIH0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIGdyb3VwIGF2YXRhcjonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7IHN1Y2Nlc3M6IGZhbHNlLCBtZXNzYWdlOiAnQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdXBkYXRpbmcgdGhlIGdyb3VwIGF2YXRhcicgfSk7XG4gICAgfVxufSk7IiwgImltcG9ydCB7IE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGxheWVyQ2FsbEhpc3Rvcnkge1xuICBjYWxsSWQ6IG51bWJlcjtcbiAgcm9sZTogXCJjYWxsZXJcIiB8IFwiY2FsbGVlXCI7XG4gIG15UGhvbmVOdW1iZXI6IHN0cmluZztcbiAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBzdHJpbmc7XG4gIHN0YXR1czogXCJ1bmFuc3dlcmVkXCIgfCBcIm1pc3NlZFwiIHwgXCJkZWNsaW5lZFwiIHwgXCJjb21wbGV0ZWRcIjtcbiAgY2FsbFRpbWU6IG51bWJlcjtcbiAgY2FsbFRpbWVzdGFtcDogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgQ2FsbEhpc3RvcnlNYW5hZ2VyIHtcbiAgYXN5bmMgcmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShcbiAgICBjYWxsOiB7XG4gICAgICBjYWxsSWQ6IG51bWJlcjtcbiAgICAgIGhvc3Q6IHsgY2l0aXplbklkOiBzdHJpbmc7IHBob25lTnVtYmVyOiBzdHJpbmcgfTtcbiAgICAgIHBhcnRpY2lwYW50czogTWFwPG51bWJlciwgeyBjaXRpemVuSWQ6IHN0cmluZzsgcGhvbmVOdW1iZXI6IHN0cmluZzsgb25Ib2xkOiBib29sZWFuIH0+O1xuICAgICAgc3RhcnRUaW1lOiBEYXRlO1xuICAgIH0sXG4gICAgY2FsbGVyU3RhdHVzOiBcInVuYW5zd2VyZWRcIiB8IFwiZGVjbGluZWRcIiB8IFwiY29tcGxldGVkXCIsXG4gICAgY2FsbGVlU3RhdHVzOiBcIm1pc3NlZFwiIHwgXCJkZWNsaW5lZFwiIHwgXCJjb21wbGV0ZWRcIixcbiAgICBlbmRUaW1lOiBEYXRlLFxuICAgIHRhcmdldFBob25lTnVtYmVyPzogc3RyaW5nXG4gICkge1xuICAgIGNvbnN0IGNhbGxUaW1lID0gKGVuZFRpbWUuZ2V0VGltZSgpIC0gY2FsbC5zdGFydFRpbWUuZ2V0VGltZSgpKSAvIDEwMDA7XG4gICAgY29uc3QgdGltZXN0YW1wID0gZW5kVGltZS50b0lTT1N0cmluZygpO1xuXG4gICAgLy8gRmlsdGVyIG91dCB0aGUgaG9zdCBmcm9tIHBhcnRpY2lwYW50cyB0byB0cnkgdG8gZ2V0IHRoZSBjYWxsZWUuXG4gICAgY29uc3QgY2FsbGVlQXJyYXkgPSBBcnJheS5mcm9tKGNhbGwucGFydGljaXBhbnRzLnZhbHVlcygpKS5maWx0ZXIoXG4gICAgICAocGFydGljaXBhbnQpID0+IHBhcnRpY2lwYW50LnBob25lTnVtYmVyICE9PSBjYWxsLmhvc3QucGhvbmVOdW1iZXJcbiAgICApO1xuXG4gICAgbGV0IGNhbGxlZVBob25lOiBzdHJpbmc7XG4gICAgaWYgKGNhbGxlZUFycmF5Lmxlbmd0aCA8IDEpIHtcbiAgICAgIC8vIElmIHRoZSBjYWxsZWUgbmV2ZXIgam9pbmVkLCB1c2UgdGhlIHBhc3NlZCB0YXJnZXRQaG9uZU51bWJlci5cbiAgICAgIGlmICh0YXJnZXRQaG9uZU51bWJlcikge1xuICAgICAgICBjYWxsZWVQaG9uZSA9IHRhcmdldFBob25lTnVtYmVyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIk5vIGNhbGxlZSBmb3VuZCBmb3IgdHdvLXBhcnR5IGNhbGwgYWZ0ZXIgZmlsdGVyaW5nIG91dCBob3N0XCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNhbGxlZVBob25lID0gY2FsbGVlQXJyYXlbMF0ucGhvbmVOdW1iZXI7XG4gICAgfVxuXG4gICAgY29uc3QgY2FsbGVyUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogY2FsbC5jYWxsSWQsXG4gICAgICByb2xlOiBcImNhbGxlclwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogY2FsbC5ob3N0LnBob25lTnVtYmVyLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBjYWxsZWVQaG9uZSxcbiAgICAgIHN0YXR1czogY2FsbGVyU3RhdHVzLFxuICAgICAgY2FsbFRpbWUsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcblxuICAgIGNvbnN0IGNhbGxlZVJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IGNhbGwuY2FsbElkLFxuICAgICAgcm9sZTogXCJjYWxsZWVcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IGNhbGxlZVBob25lLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBjYWxsLmhvc3QucGhvbmVOdW1iZXIsXG4gICAgICBzdGF0dXM6IGNhbGxlZVN0YXR1cyxcbiAgICAgIGNhbGxUaW1lLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVyUmVjb3JkKTtcbiAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlZVJlY29yZCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcmVjb3JkIHR3by1wYXJ0eSBjYWxsIGhpc3Rvcnk6XCIsIGVycm9yKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBnZXRQbGF5ZXJDYWxsSGlzdG9yeShwaG9uZU51bWJlcjogc3RyaW5nLCBtYXhSZWNvcmRzOiBudW1iZXIpOiBQcm9taXNlPFBsYXllckNhbGxIaXN0b3J5W10+IHtcbiAgICBjb25zdCBxdWVyeSA9IHsgbXlQaG9uZU51bWJlcjogcGhvbmVOdW1iZXIgfTtcbiAgICBjb25zdCBvcHRpb25zID0geyBzb3J0OiB7IF9pZDogLTEgfSwgbGltaXQ6IG1heFJlY29yZHMgfTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwiY2FsbF9oaXN0b3J5XCIsIHF1ZXJ5LCAoKSA9PiB7IH0sIGZhbHNlLCBvcHRpb25zKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciByZXRyaWV2aW5nIGNhbGwgaGlzdG9yeSBmb3IgcGhvbmUgbnVtYmVyOlwiLCBwaG9uZU51bWJlciwgZXJyb3IpO1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY29uc3QgY2FsbEhpc3RvcnlNYW5hZ2VyID0gbmV3IENhbGxIaXN0b3J5TWFuYWdlcigpO1xuIiwgImltcG9ydCB7IGNhbGxIaXN0b3J5TWFuYWdlciB9IGZyb20gXCIuL2NhbGxIaXN0b3J5TWFuYWdlclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhbGxQYXJ0aWNpcGFudCB7XG4gICAgc291cmNlOiBudW1iZXI7XG4gICAgY2l0aXplbklkOiBzdHJpbmc7XG4gICAgcGhvbmVOdW1iZXI6IHN0cmluZztcbiAgICBvbkhvbGQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgT25nb2luZ0NhbGwge1xuICAgIGNhbGxJZDogbnVtYmVyO1xuICAgIGhvc3Q6IENhbGxQYXJ0aWNpcGFudDtcbiAgICBwYXJ0aWNpcGFudHM6IE1hcDxudW1iZXIsIENhbGxQYXJ0aWNpcGFudD47XG4gICAgcGVuZGluZzogTWFwPG51bWJlciwgTm9kZUpTLlRpbWVvdXQ+O1xuICAgIHN0YXJ0VGltZTogRGF0ZTtcbn1cblxuY2xhc3MgQ2FsbE1hbmFnZXIge1xuICAgIHByaXZhdGUgY2FsbHMgPSBuZXcgTWFwPG51bWJlciwgT25nb2luZ0NhbGw+KCk7XG4gICAgcHJpdmF0ZSBwbGF5ZXJDYWxsTWFwID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcbiAgICBwcml2YXRlIHJpbmdUb25lTWFuZ2VyID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcblxuICAgIHB1YmxpYyBjcmVhdGVDYWxsKGhvc3Q6IENhbGxQYXJ0aWNpcGFudCk6IG51bWJlciB7XG4gICAgICAgIGNvbnN0IGNhbGxJZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApO1xuICAgICAgICBjb25zdCBuZXdDYWxsOiBPbmdvaW5nQ2FsbCA9IHtcbiAgICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICAgIGhvc3QsXG4gICAgICAgICAgICBwYXJ0aWNpcGFudHM6IG5ldyBNYXA8bnVtYmVyLCBDYWxsUGFydGljaXBhbnQ+KCksXG4gICAgICAgICAgICBwZW5kaW5nOiBuZXcgTWFwPG51bWJlciwgTm9kZUpTLlRpbWVvdXQ+KCksXG4gICAgICAgICAgICBzdGFydFRpbWU6IG5ldyBEYXRlKCksXG4gICAgICAgIH07XG4gICAgICAgIG5ld0NhbGwucGFydGljaXBhbnRzLnNldChob3N0LnNvdXJjZSwgaG9zdCk7XG4gICAgICAgIHRoaXMuY2FsbHMuc2V0KGNhbGxJZCwgbmV3Q2FsbCk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5zZXQoaG9zdC5zb3VyY2UsIGNhbGxJZCk7XG4gICAgICAgIHJldHVybiBjYWxsSWQ7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRDYWxsSG9zdChjYWxsSWQ6IG51bWJlcik6IENhbGxQYXJ0aWNpcGFudCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgcmV0dXJuIGNhbGwuaG9zdDtcbiAgICB9XG4gICAgcHVibGljIGlzUGxheWVySW5DYWxsKHNvdXJjZTogbnVtYmVyKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXllckNhbGxNYXAuaGFzKHNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRDYWxsQnlQbGF5ZXIoc291cmNlOiBudW1iZXIpOiBPbmdvaW5nQ2FsbCB8IHVuZGVmaW5lZCB7XG4gICAgICAgIGNvbnN0IGNhbGxJZCA9IHRoaXMucGxheWVyQ2FsbE1hcC5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKGNhbGxJZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcHVibGljIGdldENhbGxJZEJ5UGxheWVyKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBsYXllckNhbGxNYXAuZ2V0KHNvdXJjZSk7XG4gICAgfVxuICAgIHB1YmxpYyBhZGRQZW5kaW5nSW52aXRhdGlvbihcbiAgICAgICAgY2FsbElkOiBudW1iZXIsXG4gICAgICAgIHRhcmdldFNvdXJjZTogbnVtYmVyLFxuICAgICAgICB0aW1lb3V0Q2FsbGJhY2s6ICgpID0+IHZvaWQsXG4gICAgICAgIHRpbWVvdXRNczogbnVtYmVyID0gMzAwMDBcbiAgICApIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuO1xuICAgICAgICBpZiAoY2FsbC5wZW5kaW5nLmhhcyh0YXJnZXRTb3VyY2UpIHx8IGNhbGwucGFydGljaXBhbnRzLmhhcyh0YXJnZXRTb3VyY2UpKSByZXR1cm47XG4gICAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIHRpbWVvdXRDYWxsYmFjaygpO1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSk7XG4gICAgICAgIH0sIHRpbWVvdXRNcyk7XG4gICAgICAgIGNhbGwucGVuZGluZy5zZXQodGFyZ2V0U291cmNlLCB0aW1lb3V0KTtcbiAgICB9XG4gICAgcHVibGljIHJlbW92ZVBlbmRpbmdJbnZpdGF0aW9uKGNhbGxJZDogbnVtYmVyLCB0YXJnZXRTb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBjYWxsID0gdGhpcy5jYWxscy5nZXQoY2FsbElkKTtcbiAgICAgICAgaWYgKCFjYWxsKSByZXR1cm47XG4gICAgICAgIGlmIChjYWxsLnBlbmRpbmcuaGFzKHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjYWxsLnBlbmRpbmcuZ2V0KHRhcmdldFNvdXJjZSkpO1xuICAgICAgICAgICAgY2FsbC5wZW5kaW5nLmRlbGV0ZSh0YXJnZXRTb3VyY2UpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHB1YmxpYyBhY2NlcHRJbnZpdGF0aW9uKGNhbGxJZDogbnVtYmVyLCBwYXJ0aWNpcGFudDogQ2FsbFBhcnRpY2lwYW50KTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKGNhbGwucGFydGljaXBhbnRzLmhhcyhwYXJ0aWNpcGFudC5zb3VyY2UpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNhbGwucGFydGljaXBhbnRzLnNldChwYXJ0aWNpcGFudC5zb3VyY2UsIHBhcnRpY2lwYW50KTtcbiAgICAgICAgdGhpcy5wbGF5ZXJDYWxsTWFwLnNldChwYXJ0aWNpcGFudC5zb3VyY2UsIGNhbGxJZCk7XG4gICAgICAgIGlmIChjYWxsLnBlbmRpbmcuaGFzKHBhcnRpY2lwYW50LnNvdXJjZSkpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChjYWxsLnBlbmRpbmcuZ2V0KHBhcnRpY2lwYW50LnNvdXJjZSkpO1xuICAgICAgICAgICAgY2FsbC5wZW5kaW5nLmRlbGV0ZShwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBwdWJsaWMgZGVjbGluZUludml0YXRpb24oY2FsbElkOiBudW1iZXIsIHRhcmdldFNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGVuZGluZ0ludml0YXRpb24oY2FsbElkLCB0YXJnZXRTb3VyY2UpO1xuICAgIH1cbiAgICBwdWJsaWMgYXN5bmMgcmVtb3ZlUGFydGljaXBhbnQoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcblxuICAgICAgICAvLyBORVc6IEVuZCBhbmltYXRpb24gZm9yIHRoZSBsZWF2aW5nIHBhcnRpY2lwYW50XG4gICAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBzb3VyY2UpO1xuXG4gICAgICAgIGNhbGwucGFydGljaXBhbnRzLmRlbGV0ZShzb3VyY2UpO1xuICAgICAgICB0aGlzLnBsYXllckNhbGxNYXAuZGVsZXRlKHNvdXJjZSk7XG4gICAgICAgIGlmIChzb3VyY2UgPT09IGNhbGwuaG9zdC5zb3VyY2UgfHwgY2FsbC5wYXJ0aWNpcGFudHMuc2l6ZSA8PSAxKSB7XG4gICAgICAgICAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpKTtcbiAgICAgICAgICAgIHRoaXMuZW5kQ2FsbChjYWxsSWQpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHB1YmxpYyBlbmRDYWxsKGNhbGxJZDogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcblxuICAgICAgICAvLyBORVc6IEVuZCBhbmltYXRpb25zIGZvciBhbGwgcGFydGljaXBhbnRzXG4gICAgICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6ZW5kQ2FsbEFuaW1hdGlvblwiLCBwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCB0aW1lb3V0IG9mIGNhbGwucGVuZGluZy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbC5wYXJ0aWNpcGFudHMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5kZWxldGUocGFydGljaXBhbnQuc291cmNlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmNhbGxzLmRlbGV0ZShjYWxsSWQpO1xuICAgIH1cbiAgICBwdWJsaWMgcmVtb3ZlRnJvbUNhbGwoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybjtcbiAgICAgICAgY2FsbC5wYXJ0aWNpcGFudHMuZGVsZXRlKHNvdXJjZSk7XG4gICAgICAgIHRoaXMucGxheWVyQ2FsbE1hcC5kZWxldGUoc291cmNlKTtcbiAgICB9XG4gICAgcHVibGljIHNldEhvbGRTdGF0dXMoY2FsbElkOiBudW1iZXIsIHNvdXJjZTogbnVtYmVyLCBob2xkOiBib29sZWFuKTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGNhbGwgPSB0aGlzLmNhbGxzLmdldChjYWxsSWQpO1xuICAgICAgICBpZiAoIWNhbGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgcGFydGljaXBhbnQgPSBjYWxsLnBhcnRpY2lwYW50cy5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKCFwYXJ0aWNpcGFudCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBwYXJ0aWNpcGFudC5vbkhvbGQgPSBob2xkO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcHVibGljIGdldFBhcnRpY2lwYW50cyhjYWxsSWQ6IG51bWJlcik6IENhbGxQYXJ0aWNpcGFudFtdIHtcbiAgICAgICAgY29uc3QgY2FsbCA9IHRoaXMuY2FsbHMuZ2V0KGNhbGxJZCk7XG4gICAgICAgIGlmICghY2FsbCkgcmV0dXJuIFtdO1xuICAgICAgICByZXR1cm4gQXJyYXkuZnJvbShjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSk7XG4gICAgfVxuICAgIHB1YmxpYyBnZXRBbGxDYWxscygpOiBJdGVyYWJsZUl0ZXJhdG9yPE9uZ29pbmdDYWxsPiB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhbGxzLnZhbHVlcygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBjcmVhdGVSaW5nVG9uZShzb3VyY2U6IGFueSwgcmluZ3RvbmVMaW5rOiBzdHJpbmcsIHZvbHVtZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IHBlZCA9IEdldFBsYXllclBlZChzb3VyY2UpO1xuICAgICAgICBjb25zdCBwZWRJZCA9IE5ldHdvcmtHZXROZXR3b3JrSWRGcm9tRW50aXR5KHBlZCk7XG4gICAgICAgIGNvbnN0IHNvdW5kSWQgPSBhd2FpdCBleHBvcnRzWydzb3VuZGhhbmRsZXInXS5TdGFydEF0dGFjaFNvdW5kKHJpbmd0b25lTGluaywgcGVkSWQsIDUsIEdldEdhbWVUaW1lcigpLCB0cnVlLCAwLjE1KTtcbiAgICAgICAgdGhpcy5yaW5nVG9uZU1hbmdlci5zZXQoc291cmNlLCBzb3VuZElkKTtcbiAgICB9XG4gICAgcHVibGljIGFzeW5jIHN0b3BSaW5nVG9uZShzb3VyY2U6IG51bWJlcikge1xuICAgICAgICBjb25zdCBzb3VuZElkID0gdGhpcy5yaW5nVG9uZU1hbmdlci5nZXQoc291cmNlKTtcbiAgICAgICAgaWYgKCFzb3VuZElkKSByZXR1cm47XG4gICAgICAgIGV4cG9ydHNbJ3NvdW5kaGFuZGxlciddLlN0b3BTb3VuZChzb3VuZElkKTtcbiAgICAgICAgdGhpcy5yaW5nVG9uZU1hbmdlci5kZWxldGUoc291cmNlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBjb25zdCBjYWxsTWFuYWdlciA9IG5ldyBDYWxsTWFuYWdlcigpOyIsICJpbXBvcnQgeyBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbmNsYXNzIFNldHRpbmcge1xuICAgIHB1YmxpYyBfaWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHB1YmxpYyBiYWNrZ3JvdW5kID0gbmV3IE1hcDxzdHJpbmcsIHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9PigpO1xuICAgIHB1YmxpYyBsb2Nrc2NyZWVuID0gbmV3IE1hcDxzdHJpbmcsIHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9PigpO1xuICAgIHB1YmxpYyByaW5ndG9uZSA9IG5ldyBNYXA8c3RyaW5nLCB7IGN1cnJlbnQ6IHN0cmluZzsgcmluZ3RvbmVzOiB7IG5hbWU6IHN0cmluZywgdXJsOiBzdHJpbmcgfVtdIH0+KCk7XG4gICAgcHVibGljIHNob3dTdGFydHVwU2NyZWVuID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHNob3dOb3RpZmljYXRpb25zID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIGlzTG9jayA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBsb2NrUGluID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgdXNlUGluID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHVzZUZhY2VJZCA9IG5ldyBNYXA8c3RyaW5nLCBib29sZWFuPigpO1xuICAgIHB1YmxpYyBmYWNlSWRJZGVudGlmaWVyID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgc21ydElkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgc21ydFBhc3N3b3JkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgaXNGbGlnaHRNb2RlID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG4gICAgcHVibGljIHBob25lTnVtYmVyID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgZGFya01haWxJZEF0dGFjaGVkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICBwdWJsaWMgcGlnZW9uSWRBdHRhY2hlZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gICAgLy8gTm8gYXV0b21hdGljIGNsZWFudXAgLSBvbmx5IHJlbW92ZSBvbiBwbGF5ZXIgZGlzY29ubmVjdFxuXG4gICAgcHJpdmF0ZSBzZWVkRnJvbURvYyhkb2M6IGFueSkge1xuICAgICAgICBpZiAoIWRvYz8uX2lkKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGlkID0gZG9jLl9pZDtcbiAgICAgICAgdGhpcy5faWQuc2V0KGlkLCBpZCk7XG4gICAgICAgIHRoaXMuYmFja2dyb3VuZC5zZXQoaWQsIGRvYy5iYWNrZ3JvdW5kID8/IHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0pO1xuICAgICAgICB0aGlzLmxvY2tzY3JlZW4uc2V0KGlkLCBkb2MubG9ja3NjcmVlbiA/PyB7IGN1cnJlbnQ6ICcnLCB3YWxscGFwZXJzOiBbXSB9KTtcbiAgICAgICAgdGhpcy5yaW5ndG9uZS5zZXQoaWQsIGRvYy5yaW5ndG9uZSA/PyB7IGN1cnJlbnQ6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJywgcmluZ3RvbmVzOiBbeyBuYW1lOiAnZGVmYXVsdCcsIHVybDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnIH1dIH0pO1xuICAgICAgICB0aGlzLnNob3dTdGFydHVwU2NyZWVuLnNldChpZCwgZG9jLnNob3dTdGFydHVwU2NyZWVuID8/IHRydWUpO1xuICAgICAgICB0aGlzLnNob3dOb3RpZmljYXRpb25zLnNldChpZCwgZG9jLnNob3dOb3RpZmljYXRpb25zID8/IHRydWUpO1xuICAgICAgICB0aGlzLmlzTG9jay5zZXQoaWQsIGRvYy5pc0xvY2sgPz8gdHJ1ZSk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5zZXQoaWQsIGRvYy5sb2NrUGluID8/ICcnKTtcbiAgICAgICAgdGhpcy51c2VQaW4uc2V0KGlkLCBkb2MudXNlUGluID8/IGZhbHNlKTtcbiAgICAgICAgdGhpcy51c2VGYWNlSWQuc2V0KGlkLCBkb2MudXNlRmFjZUlkID8/IGZhbHNlKTtcbiAgICAgICAgdGhpcy5mYWNlSWRJZGVudGlmaWVyLnNldChpZCwgZG9jLmZhY2VJZElkZW50aWZpZXIgPz8gaWQpO1xuICAgICAgICB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5zZXQoaWQsIGRvYy5kYXJrTWFpbElkQXR0YWNoZWQgPz8gJycpO1xuICAgICAgICB0aGlzLnNtcnRJZC5zZXQoaWQsIGRvYy5zbXJ0SWQgPz8gJycpO1xuICAgICAgICB0aGlzLnNtcnRQYXNzd29yZC5zZXQoaWQsIGRvYy5zbXJ0UGFzc3dvcmQgPz8gJycpO1xuICAgICAgICB0aGlzLmlzRmxpZ2h0TW9kZS5zZXQoaWQsIGRvYy5pc0ZsaWdodE1vZGUgPz8gZmFsc2UpO1xuICAgICAgICB0aGlzLnBob25lTnVtYmVyLnNldChpZCwgZG9jLnBob25lTnVtYmVyID8/ICcnKTtcbiAgICAgICAgdGhpcy5waWdlb25JZEF0dGFjaGVkLnNldChpZCwgZG9jLnBpZ2VvbklkQXR0YWNoZWQgPz8gJycpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBlbnN1cmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuO1xuICAgICAgICBpZiAodGhpcy5faWQuaGFzKGNpdGl6ZW5JZCkpIHJldHVybjtcblxuICAgICAgICBjb25zdCBkb2MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmU/LigncGhvbmVfc2V0dGluZ3MnLCB7IF9pZDogY2l0aXplbklkIH0pO1xuICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgICB0aGlzLnNlZWRGcm9tRG9jKGRvYyk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLlJlZ2lzdGVyTmV3U2V0dGluZ3MoY2l0aXplbklkLCBcIlwiKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmU/LigncGhvbmVfc2V0dGluZ3MnLCB7XG4gICAgICAgICAgICBfaWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHRoaXMuYmFja2dyb3VuZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGxvY2tzY3JlZW46IHRoaXMubG9ja3NjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHJpbmd0b25lOiB0aGlzLnJpbmd0b25lLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGlzTG9jazogdGhpcy5pc0xvY2suZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBsb2NrUGluOiB0aGlzLmxvY2tQaW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICB1c2VQaW46IHRoaXMudXNlUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgdXNlRmFjZUlkOiB0aGlzLnVzZUZhY2VJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IHRoaXMuZmFjZUlkSWRlbnRpZmllci5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBzbXJ0SWQ6IHRoaXMuc21ydElkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgc21ydFBhc3N3b3JkOiB0aGlzLnNtcnRQYXNzd29yZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogdGhpcy5pc0ZsaWdodE1vZGUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICBwaG9uZU51bWJlcjogdGhpcy5waG9uZU51bWJlci5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IHRoaXMucGlnZW9uSWRBdHRhY2hlZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGxvYWQoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBNeVNRTCBBZGFwdGVyIGxvZ2ljXG4gICAgICAgICAgICBjb25zdCByZXM6IGFueSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX3NldHRpbmdzJywge30pO1xuICAgICAgICAgICAgZm9yIChjb25zdCBkYXRhIG9mIHJlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2VlZEZyb21Eb2MoZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gTG9hZGVkLmApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gRmFpbGVkIHRvIGxvYWQgc2V0dGluZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzYXZlKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdGhpcy5faWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfc2V0dGluZ3MnLCB7IF9pZDoga2V5IH0sIHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBrZXksXG4gICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6IHRoaXMuYmFja2dyb3VuZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgbG9ja3NjcmVlbjogdGhpcy5sb2Nrc2NyZWVuLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICByaW5ndG9uZTogdGhpcy5yaW5ndG9uZS5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IHRoaXMuc2hvd1N0YXJ0dXBTY3JlZW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHNob3dOb3RpZmljYXRpb25zOiB0aGlzLnNob3dOb3RpZmljYXRpb25zLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBpc0xvY2s6IHRoaXMuaXNMb2NrLmdldChrZXkpLFxuICAgICAgICAgICAgICAgICAgICBsb2NrUGluOiB0aGlzLmxvY2tQaW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHVzZVBpbjogdGhpcy51c2VQaW4uZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHVzZUZhY2VJZDogdGhpcy51c2VGYWNlSWQuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIGZhY2VJZElkZW50aWZpZXI6IHRoaXMuZmFjZUlkSWRlbnRpZmllci5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgZGFya01haWxJZEF0dGFjaGVkOiB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc21ydElkOiB0aGlzLnNtcnRJZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgc21ydFBhc3N3b3JkOiB0aGlzLnNtcnRQYXNzd29yZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgaXNGbGlnaHRNb2RlOiB0aGlzLmlzRmxpZ2h0TW9kZS5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHRoaXMucGhvbmVOdW1iZXIuZ2V0KGtleSksXG4gICAgICAgICAgICAgICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6IHRoaXMucGlnZW9uSWRBdHRhY2hlZC5nZXQoa2V5KSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBTYXZlZCBzdWNjZXNzZnVsbHkuYCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgTE9HR0VSKGBbU2V0dGluZ3NdIEZhaWxlZCB0byBzYXZlIHNldHRpbmdzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgUmVnaXN0ZXJOZXdTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZywgbnVtYmVyOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5faWQuc2V0KGNpdGl6ZW5JZCwgY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5iYWNrZ3JvdW5kLnNldChjaXRpemVuSWQsIHsgY3VycmVudDogJycsIHdhbGxwYXBlcnM6IFtdIH0pO1xuICAgICAgICB0aGlzLmxvY2tzY3JlZW4uc2V0KGNpdGl6ZW5JZCwgeyBjdXJyZW50OiAnJywgd2FsbHBhcGVyczogW10gfSk7XG4gICAgICAgIHRoaXMucmluZ3RvbmUuc2V0KGNpdGl6ZW5JZCwgeyBjdXJyZW50OiAnaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvc291bmRzL2lQaG9uZVhUcmFwLm1wMycsIHJpbmd0b25lczogW3sgbmFtZTogJ2RlZmF1bHQnLCB1cmw6ICdodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9zb3VuZHMvaVBob25lWFRyYXAubXAzJyB9XSB9KTtcbiAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5zZXQoY2l0aXplbklkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5zZXQoY2l0aXplbklkLCB0cnVlKTtcbiAgICAgICAgdGhpcy5pc0xvY2suc2V0KGNpdGl6ZW5JZCwgdHJ1ZSk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMudXNlUGluLnNldChjaXRpemVuSWQsIGZhbHNlKTtcbiAgICAgICAgdGhpcy5waG9uZU51bWJlci5zZXQoY2l0aXplbklkLCBudW1iZXIpO1xuICAgICAgICB0aGlzLnVzZUZhY2VJZC5zZXQoY2l0aXplbklkLCBmYWxzZSk7XG4gICAgICAgIHRoaXMuZmFjZUlkSWRlbnRpZmllci5zZXQoY2l0aXplbklkLCBjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmRhcmtNYWlsSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgICAgIHRoaXMuc21ydElkLnNldChjaXRpemVuSWQsICcnKTtcbiAgICAgICAgdGhpcy5zbXJ0UGFzc3dvcmQuc2V0KGNpdGl6ZW5JZCwgJycpO1xuICAgICAgICB0aGlzLmlzRmxpZ2h0TW9kZS5zZXQoY2l0aXplbklkLCBmYWxzZSk7XG4gICAgICAgIHRoaXMucGlnZW9uSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCAnJyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIFNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5lbnN1cmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX3NldHRpbmdzJywgeyBfaWQ6IGNpdGl6ZW5JZCB9LCB7XG4gICAgICAgICAgICAgICAgX2lkOiBjaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgYmFja2dyb3VuZDogdGhpcy5iYWNrZ3JvdW5kLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGxvY2tzY3JlZW46IHRoaXMubG9ja3NjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICByaW5ndG9uZTogdGhpcy5yaW5ndG9uZS5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBpc0xvY2s6IHRoaXMuaXNMb2NrLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGxvY2tQaW46IHRoaXMubG9ja1Bpbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICB1c2VQaW46IHRoaXMudXNlUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIHVzZUZhY2VJZDogdGhpcy51c2VGYWNlSWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogdGhpcy5mYWNlSWRJZGVudGlmaWVyLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogdGhpcy5kYXJrTWFpbElkQXR0YWNoZWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgc21ydElkOiB0aGlzLnNtcnRJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgICAgICAgICBzbXJ0UGFzc3dvcmQ6IHRoaXMuc21ydFBhc3N3b3JkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgICAgIGlzRmxpZ2h0TW9kZTogdGhpcy5pc0ZsaWdodE1vZGUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHRoaXMucGhvbmVOdW1iZXIuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgICAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogdGhpcy5waWdlb25JZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgcGxheWVyIHNldHRpbmdzIGZvciAke2NpdGl6ZW5JZH0gc3VjY2Vzc2Z1bGx5LmApO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIExPR0dFUihgW1NldHRpbmdzXSBGYWlsZWQgdG8gc2F2ZSBwbGF5ZXIgc2V0dGluZ3MgZm9yICR7Y2l0aXplbklkfTogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIHBsYXllciBkYXRhIG9ubHkgd2hlbiBwbGF5ZXIgZGlzY29ubmVjdHNcbiAgICBwdWJsaWMgb25QbGF5ZXJEaXNjb25uZWN0KGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGxheWVyRGF0YShjaXRpemVuSWQpO1xuICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gQ2xlYW5lZCB1cCBkYXRhIGZvciBkaXNjb25uZWN0ZWQgcGxheWVyICR7Y2l0aXplbklkfWApO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBwbGF5ZXIgZGF0YSBmcm9tIGFsbCBtYXBzXG4gICAgcHJpdmF0ZSByZW1vdmVQbGF5ZXJEYXRhKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuX2lkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmJhY2tncm91bmQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMubG9ja3NjcmVlbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5yaW5ndG9uZS5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zaG93U3RhcnR1cFNjcmVlbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5zaG93Tm90aWZpY2F0aW9ucy5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5pc0xvY2suZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMubG9ja1Bpbi5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy51c2VQaW4uZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMudXNlRmFjZUlkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLmZhY2VJZElkZW50aWZpZXIuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuc21ydElkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnNtcnRQYXNzd29yZC5kZWxldGUoY2l0aXplbklkKTtcbiAgICAgICAgdGhpcy5pc0ZsaWdodE1vZGUuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMucGhvbmVOdW1iZXIuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgICAgIHRoaXMuZGFya01haWxJZEF0dGFjaGVkLmRlbGV0ZShjaXRpemVuSWQpO1xuICAgICAgICB0aGlzLnBpZ2VvbklkQXR0YWNoZWQuZGVsZXRlKGNpdGl6ZW5JZCk7XG4gICAgfVxuXG4gICAgLy8gUHVibGljIG1ldGhvZCB0byBtYW51YWxseSBjbGVhbiB1cCBhIHNwZWNpZmljIHBsYXllciAoZm9yIGFkbWluIGNvbW1hbmRzKVxuICAgIHB1YmxpYyBjbGVhbnVwUGxheWVyKGNpdGl6ZW5JZDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlUGxheWVyRGF0YShjaXRpemVuSWQpO1xuICAgICAgICBMT0dHRVIoYFtTZXR0aW5nc10gTWFudWFsbHkgY2xlYW5lZCB1cCBkYXRhIGZvciBwbGF5ZXIgJHtjaXRpemVuSWR9YCk7XG4gICAgfVxufVxuXG5leHBvcnQgY29uc3QgU2V0dGluZ3MgPSBuZXcgU2V0dGluZygpO1xuIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IGNhbGxNYW5hZ2VyIH0gZnJvbSBcIi4vQ2FsbE1hbmFnZXJcIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgUGhvbmVDb250YWN0cyB9IGZyb20gXCIuLi8uLi8uLi8uLi90eXBlcy90eXBlc1wiO1xuaW1wb3J0IHsgY2FsbEhpc3RvcnlNYW5hZ2VyLCBQbGF5ZXJDYWxsSGlzdG9yeSB9IGZyb20gXCIuL2NhbGxIaXN0b3J5TWFuYWdlclwiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi4vU2V0dGluZ3MvY2xhc3NcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIlxuXG5vbkNsaWVudENhbGxiYWNrKFwic3VtbWl0X3Bob25lOnNlcnZlcjpjYWxsXCIsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHsgbnVtYmVyLCBfaWQsIHZvbHVtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyRnJvbVBob25lTnVtYmVyKG51bWJlcik7XG4gIGNvbnN0IHRhcmdldERhdGE6IFBob25lQ29udGFjdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBjb250YWN0TnVtYmVyOiBudW1iZXIsIHBlcnNvbmFsTnVtYmVyOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSkgfSk7XG5cbiAgY29uc3Qgc291cmNlRGF0YTogUGhvbmVDb250YWN0cyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7XG4gICAgY29udGFjdE51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpLFxuICAgIHBlcnNvbmFsTnVtYmVyOiBudW1iZXJcbiAgfSk7XG5cbiAgaWYgKCF0YXJnZXRQbGF5ZXIpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgY29uc3QgY2FsbGVyUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCksXG4gICAgICByb2xlOiBcImNhbGxlclwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpLFxuICAgICAgb3RoZXJQYXJ0eVBob25lTnVtYmVyOiBudW1iZXIsXG4gICAgICBzdGF0dXM6IFwidW5hbnN3ZXJlZFwiLFxuICAgICAgY2FsbFRpbWU6IDAsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcblxuICAgIGNvbnN0IGNhbGxlZVJlY29yZDogUGxheWVyQ2FsbEhpc3RvcnkgPSB7XG4gICAgICBjYWxsSWQ6IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApLFxuICAgICAgcm9sZTogXCJjYWxsZWVcIixcbiAgICAgIG15UGhvbmVOdW1iZXI6IG51bWJlcixcbiAgICAgIG90aGVyUGFydHlQaG9uZU51bWJlcjogYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpLFxuICAgICAgc3RhdHVzOiBcIm1pc3NlZFwiLFxuICAgICAgY2FsbFRpbWU6IDAsXG4gICAgICBjYWxsVGltZXN0YW1wOiB0aW1lc3RhbXAsXG4gICAgfTtcbiAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcImNhbGxfaGlzdG9yeVwiLCBjYWxsZXJSZWNvcmQpO1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlZVJlY29yZCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3QgdGFyZ2V0U291cmNlID0gdGFyZ2V0UGxheWVyLlBsYXllckRhdGEuc291cmNlO1xuXG4gIGlmIChjYWxsTWFuYWdlci5pc1BsYXllckluQ2FsbChzb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBhcmUgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKGNhbGxNYW5hZ2VyLmlzUGxheWVySW5DYWxsKHRhcmdldFNvdXJjZSkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBCdXN5XCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJUYXJnZXQgaXMgYWxyZWFkeSBpbiBhIGNhbGxcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgY29uc3Qgc291cmNlUGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldFBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCBJc051bWJlckJsb2NrZWQgPSBhd2FpdCBVdGlscy5Jc051bWJlckJsb2NrZWQodGFyZ2V0UGhvbmUsIHNvdXJjZVBob25lKTtcbiAgY29uc3Qgc291cmNlRmxpZ2h0TW9kZSA9IGF3YWl0IFV0aWxzLkluRmxpZ2h0TW9kZShzb3VyY2VDaXRpemVuSWQpO1xuICBjb25zdCB0YXJnZXRGbGlnaHRNb2RlID0gYXdhaXQgVXRpbHMuSW5GbGlnaHRNb2RlKHRhcmdldENpdGl6ZW5JZCk7XG4gIGlmIChzb3VyY2VGbGlnaHRNb2RlKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkZsaWdodCBNb2RlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgY2Fubm90IG1ha2UgY2FsbHMgd2hpbGUgaW4gZmxpZ2h0IG1vZGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9IGVsc2UgaWYgKHRhcmdldEZsaWdodE1vZGUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgdW5yZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChJc051bWJlckJsb2NrZWQpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgU2hvdXJjZU51bWJlckJsb2NrZWQgPSBhd2FpdCBVdGlscy5Jc051bWJlckJsb2NrZWQoc291cmNlUGhvbmUsIHRhcmdldFBob25lKTtcbiAgaWYgKFNob3VyY2VOdW1iZXJCbG9ja2VkKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk51bWJlciBCbG9ja2VkXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJVbmJsb2NrIHRoZSBudW1iZXIgdG8gY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgdGFyZ2V0SGFzUGhvbmUgPSBhd2FpdCBVdGlscy5IYXNQaG9uZSh0YXJnZXRTb3VyY2UpO1xuICBpZiAoIXRhcmdldEhhc1Bob25lKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBlcnNvbiB5b3UgYXJlIHRyeWluZyB0byBjYWxsIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG5cbiAgICBjb25zdCB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG4gICAgY29uc3QgY2FsbGVyUmVjb3JkOiBQbGF5ZXJDYWxsSGlzdG9yeSA9IHtcbiAgICAgIGNhbGxJZDogTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCksXG4gICAgICByb2xlOiBcImNhbGxlclwiLFxuICAgICAgbXlQaG9uZU51bWJlcjogc291cmNlUGhvbmUsXG4gICAgICBvdGhlclBhcnR5UGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgICAgc3RhdHVzOiBcInVuYW5zd2VyZWRcIixcbiAgICAgIGNhbGxUaW1lOiAwLFxuICAgICAgY2FsbFRpbWVzdGFtcDogdGltZXN0YW1wLFxuICAgIH07XG5cbiAgICBjb25zdCBjYWxsZWVSZWNvcmQ6IFBsYXllckNhbGxIaXN0b3J5ID0ge1xuICAgICAgY2FsbElkOiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKSxcbiAgICAgIHJvbGU6IFwiY2FsbGVlXCIsXG4gICAgICBteVBob25lTnVtYmVyOiB0YXJnZXRQaG9uZSxcbiAgICAgIG90aGVyUGFydHlQaG9uZU51bWJlcjogc291cmNlUGhvbmUsXG4gICAgICBzdGF0dXM6IFwibWlzc2VkXCIsXG4gICAgICBjYWxsVGltZTogMCxcbiAgICAgIGNhbGxUaW1lc3RhbXA6IHRpbWVzdGFtcCxcbiAgICB9O1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwiY2FsbF9oaXN0b3J5XCIsIGNhbGxlclJlY29yZCk7XG4gICAgYXdhaXQgRGVsYXkoMTAwMCk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJjYWxsX2hpc3RvcnlcIiwgY2FsbGVlUmVjb3JkKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgaG9zdFBhcnRpY2lwYW50ID0ge1xuICAgIHNvdXJjZSxcbiAgICBjaXRpemVuSWQ6IHNvdXJjZUNpdGl6ZW5JZCxcbiAgICBwaG9uZU51bWJlcjogc291cmNlUGhvbmUsXG4gICAgb25Ib2xkOiBmYWxzZSxcbiAgfTtcblxuICBjb25zdCBjYWxsSWQgPSBjYWxsTWFuYWdlci5jcmVhdGVDYWxsKGhvc3RQYXJ0aWNpcGFudCk7XG5cbiAgY2FsbE1hbmFnZXIuY3JlYXRlUmluZ1RvbmUodGFyZ2V0U291cmNlLCBTdHJpbmcoU2V0dGluZ3MucmluZ3RvbmUuZ2V0KHRhcmdldENpdGl6ZW5JZCk/LmN1cnJlbnQpLCB2b2x1bWUpO1xuICBjYWxsTWFuYWdlci5hZGRQZW5kaW5nSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSwgKCkgPT4ge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIFRpbWVvdXRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNhbGwgd2FzIG5vdCBhbnN3ZXJlZCBieSB0YXJnZXRcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk1pc3NlZCBDYWxsXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgbWlzc2VkIGEgY2FsbFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICAgICAgaWYgKGNhbGwpIHtcbiAgICAgICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJ1bmFuc3dlcmVkXCIsIFwibWlzc2VkXCIsIG5ldyBEYXRlKCksIHRhcmdldFBob25lKTtcbiAgICAgIH1cbiAgICAgIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgICAgIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICAgIH0pKCk7XG4gICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHNvdXJjZSwgMCk7XG4gICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgMCk7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBfaWQpO1xuICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQ2FsbGluZ0ludGVyZmFjZVwiLCBzb3VyY2UpO1xuICB9LCAyMDAwMCk7XG5cbiAgY29uc3Qgc291cmNlTmFtZSA9IHNvdXJjZURhdGEgPyBgJHtzb3VyY2VEYXRhLmZpcnN0TmFtZX0gJHtzb3VyY2VEYXRhLmxhc3ROYW1lfWAgOiBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSk7XG4gIGNvbnN0IHRhcmdldE5hbWUgPSB0YXJnZXREYXRhID8gYCR7dGFyZ2V0RGF0YS5maXJzdE5hbWV9ICR7dGFyZ2V0RGF0YS5sYXN0TmFtZX1gIDogbnVtYmVyO1xuXG4gIGVtaXROZXQoXCJwaG9uZTphZGRBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgaWQ6IF9pZCxcbiAgICB0aXRsZTogXCJJbmNvbWluZyBDYWxsXCIsXG4gICAgZGVzY3JpcHRpb246IGAke3NvdXJjZU5hbWV9IGlzIGNhbGxpbmcgeW91YCxcbiAgICBhcHA6IFwicGhvbmVcIixcbiAgICBpY29uczoge1xuICAgICAgXCIwXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9jcm9zcy1jaXJjbGUuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6ZGVjbGluZUNhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgc291cmNlTmFtZSxcbiAgICAgICAgICB0YXJnZXROYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogX2lkLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgICBcIjFcIjoge1xuICAgICAgICBpY29uOiBcImh0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL2FjY2VwdC5zdmdcIixcbiAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgIGV2ZW50OiBcInBob25lOnNlcnZlcjphY2NlcHRDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWU6IHRhcmdldE5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZTogc291cmNlTmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0sXG4gIH0pKTtcblxuICAvKiBjb25zb2xlLmxvZyhzb3VyY2UsIFwiQ2FsbGluZ1wiLCB0YXJnZXRTb3VyY2UsIHRhcmdldE5hbWUsIF9pZCk7ICovXG4gIGVtaXROZXQoXCJzdW1taXRfcGhvbmU6c2VydmVyOmFkZENhbGxpbmdpbnRlcmZhY2VcIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY2FsbElkLFxuICAgIHRhcmdldFNvdXJjZSxcbiAgICB0YXJnZXROYW1lLFxuICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgIGRhdGFiYXNlVGFibGVJZDogX2lkLFxuICB9KSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgdGl0bGU6ICdDYWxsIEluaXRpYXRlZCcsXG4gICAgbWVzc2FnZTogYCR7c291cmNlUGhvbmV9IGluaXRpYXRlZCBhIGNhbGwgdG8gJHt0YXJnZXRQaG9uZX0gKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gIH0pO1xuICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbk5ldChcInN1bW1pdF9waG9uZTpzZXJ2ZXI6ZGVjbGluZUNhbGxcIiwgYXN5bmMgKGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCBzb3VyY2UgPSBnbG9iYWwuc291cmNlIGFzIG51bWJlcjtcbiAgY29uc3QgeyBjYWxsSWQsIHRhcmdldFNvdXJjZSwgY2FsbGVyU291cmNlLCBkYXRhYmFzZVRhYmxlSWQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIC8qIGNvbnNvbGUubG9nKHNvdXJjZSwgXCJEZWNsaW5pbmcgY2FsbFwiLCBjYWxsSWQsIHRhcmdldFNvdXJjZSwgY2FsbGVyU291cmNlLCBkYXRhYmFzZVRhYmxlSWQpOyAqL1xuICBjYWxsTWFuYWdlci5kZWNsaW5lSW52aXRhdGlvbihjYWxsSWQsIHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoY2FsbGVyU291cmNlKTtcbiAgaWYgKGNhbGwpIHtcbiAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImRlY2xpbmVkXCIsIFwiZGVjbGluZWRcIiwgbmV3IERhdGUoKSk7XG4gIH1cbiAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgaWYgKCF0YXJnZXRTb3VyY2UgfHwgIWNhbGxlclNvdXJjZSkge1xuICAgIHJldHVybjtcbiAgfVxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCk7XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQ2FsbGluZ0ludGVyZmFjZVwiLCBjYWxsZXJTb3VyY2UpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgIHRpdGxlOiAnQ2FsbCBEZWNsaW5lZCcsXG4gICAgbWVzc2FnZTogYCR7YXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpfSBkZWNsaW5lZCB0aGUgY2FsbCBmcm9tICR7YXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShjYWxsZXJTb3VyY2UpfSAoQ2FsbCBJRDogJHtjYWxsSWR9KS5gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjayhcInN1bW1pdF9waG9uZTpzZXJ2ZXI6ZW5kQ2FsbFwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICBjb25zdCB7IGNhbGxJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICBpZiAoIWNhbGwgfHwgY2FsbC5jYWxsSWQgIT09IGNhbGxJZCkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCBjYWxsSG9zdCA9IGNhbGxNYW5hZ2VyLmdldENhbGxIb3N0KGNhbGxJZCk7XG4gIGlmIChjYWxsSG9zdCAmJiBjYWxsSG9zdC5zb3VyY2UgPT09IHNvdXJjZSB8fCBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKS5sZW5ndGggPD0gMSkge1xuICAgIGZvciAoY29uc3QgcGFydGljaXBhbnQgb2YgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGxJZCkpIHtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWNjcGV0ZWRDYWxsaW5nSW50ZXJmYWNlXCIsIHBhcnRpY2lwYW50LnNvdXJjZSk7XG4gICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwocGFydGljaXBhbnQuc291cmNlLCAwKTtcbiAgICB9XG4gICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJjb21wbGV0ZWRcIiwgXCJjb21wbGV0ZWRcIiwgbmV3IERhdGUoKSk7XG4gICAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgdHlwZTogJ3Bob25lX2NhbGxzJyxcbiAgICAgIHRpdGxlOiAnQ2FsbCBFbmRlZCcsXG4gICAgICBtZXNzYWdlOiBgQ2FsbCBlbmRlZCBieSAke2F3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKX0gKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgfSBlbHNlIGlmIChjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKS5sZW5ndGggPiAyKSB7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY2NwZXRlZENhbGxpbmdJbnRlcmZhY2VcIiwgc291cmNlKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgc291cmNlKTtcbiAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwoc291cmNlLCAwKTtcbiAgICBjYWxsTWFuYWdlci5yZW1vdmVGcm9tQ2FsbChjYWxsSWQsIHNvdXJjZSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICB0eXBlOiAncGhvbmVfY2FsbHMnLFxuICAgICAgdGl0bGU6ICdQYXJ0aWNpcGFudCBMZWZ0IENhbGwnLFxuICAgICAgbWVzc2FnZTogYCR7YXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShzb3VyY2UpfSBsZWZ0IHRoZSBjb25mZXJlbmNlIGNhbGwgKENhbGwgSUQ6ICR7Y2FsbElkfSkuYCxcbiAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICBmb3IgKGNvbnN0IHBhcnRpY2lwYW50IG9mIGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpKSB7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjY3BldGVkQ2FsbGluZ0ludGVyZmFjZVwiLCBwYXJ0aWNpcGFudC5zb3VyY2UpO1xuICAgICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHBhcnRpY2lwYW50LnNvdXJjZSwgMCk7XG4gICAgfVxuICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiY29tcGxldGVkXCIsIFwiY29tcGxldGVkXCIsIG5ldyBEYXRlKCkpO1xuICAgIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgICB0aXRsZTogJ0NhbGwgRW5kZWQnLFxuICAgICAgbWVzc2FnZTogYENhbGwgZW5kZWQgYnkgJHthd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSl9IChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjayhcInN1bW1pdF9waG9uZTpzZXJ2ZXI6YWRkUGxheWVyVG9DYWxsXCIsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHsgY29udGFjdE51bWJlciwgX2lkLCB2b2x1bWUgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IHRhcmdldERhdGE6IFBob25lQ29udGFjdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQgfSk7XG4gIGNvbnN0IHNvdXJjZURhdGE6IFBob25lQ29udGFjdHMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywge1xuICAgIGNvbnRhY3ROdW1iZXI6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKSxcbiAgICBwZXJzb25hbE51bWJlcjogY29udGFjdE51bWJlclxuICB9KTtcbiAgY29uc3QgY2FsbElkID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbElkQnlQbGF5ZXIoc291cmNlKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICBpZiAoIWNhbGwpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiTm8gb25nb2luZyBjYWxsIGZvdW5kXCIsXG4gICAgICBhcHA6IFwicGhvbmVcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCBzb3VyY2VQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyRnJvbVBob25lTnVtYmVyKGNvbnRhY3ROdW1iZXIpO1xuICBpZiAoIXRhcmdldFBsYXllcikge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gYWRkIGlzIG5vdCByZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHRhcmdldFNvdXJjZSA9IHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZTtcbiAgY29uc3QgSXNOdW1iZXJCbG9ja2VkID0gYXdhaXQgVXRpbHMuSXNOdW1iZXJCbG9ja2VkKGNvbnRhY3ROdW1iZXIsIHNvdXJjZVBob25lKTtcbiAgY29uc3Qgc291cmNlQ2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihjb250YWN0TnVtYmVyKTtcbiAgY29uc3Qgc291cmNlRmxpZ2h0TW9kZSA9IGF3YWl0IFV0aWxzLkluRmxpZ2h0TW9kZShzb3VyY2VDaXRpemVuSWQpO1xuICBjb25zdCB0YXJnZXRGbGlnaHRNb2RlID0gYXdhaXQgVXRpbHMuSW5GbGlnaHRNb2RlKHRhcmdldENpdGl6ZW5JZCk7XG4gIGlmIChzb3VyY2VGbGlnaHRNb2RlKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkZsaWdodCBNb2RlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgY2Fubm90IG1ha2UgY2FsbHMgd2hpbGUgaW4gZmxpZ2h0IG1vZGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9IGVsc2UgaWYgKHRhcmdldEZsaWdodE1vZGUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgdW5yZWFjaGFibGVcIixcbiAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmIChJc051bWJlckJsb2NrZWQpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgY29uc3QgU2hvdXJjZU51bWJlckJsb2NrZWQgPSBhd2FpdCBVdGlscy5Jc051bWJlckJsb2NrZWQoc291cmNlUGhvbmUsIGNvbnRhY3ROdW1iZXIpO1xuICBpZiAoU2hvdXJjZU51bWJlckJsb2NrZWQpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTnVtYmVyIEJsb2NrZWRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlVuYmxvY2sgdGhlIG51bWJlciB0byBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBjb25zdCB0YXJnZXRIYXNQaG9uZSA9IGF3YWl0IFV0aWxzLkhhc1Bob25lKHRhcmdldFNvdXJjZSk7XG4gIGlmICghdGFyZ2V0SGFzUGhvbmUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKGNhbGwucGFydGljaXBhbnRzLmhhcyh0YXJnZXRTb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkFscmVhZHkgaW4gQ2FsbFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGxheWVyIGlzIGFscmVhZHkgaW4gdGhlIGNhbGxcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNhbGxNYW5hZ2VyLmNyZWF0ZVJpbmdUb25lKHRhcmdldFNvdXJjZSwgU3RyaW5nKFNldHRpbmdzLnJpbmd0b25lLmdldCh0YXJnZXRDaXRpemVuSWQpPy5jdXJyZW50KSwgdm9sdW1lKTtcbiAgY2FsbE1hbmFnZXIuYWRkUGVuZGluZ0ludml0YXRpb24oTnVtYmVyKGNhbGxJZCksIHRhcmdldFNvdXJjZSwgKCkgPT4ge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIFRpbWVvdXRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIlBsYXllciBkaWQgbm90IGFuc3dlciBjb25mZXJlbmNlIGNhbGwgaW52aXRhdGlvblwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgfSwgMzAwMDApO1xuXG4gIGNvbnN0IHNvdXJjZU5hbWUgPSBzb3VyY2VEYXRhXG4gICAgPyBgJHtzb3VyY2VEYXRhLmZpcnN0TmFtZX0gJHtzb3VyY2VEYXRhLmxhc3ROYW1lfWBcbiAgICA6IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0TmFtZSA9IHRhcmdldERhdGEgPyBgJHt0YXJnZXREYXRhLmZpcnN0TmFtZX0gJHt0YXJnZXREYXRhLmxhc3ROYW1lfWAgOiBjb250YWN0TnVtYmVyO1xuXG4gIGVtaXROZXQoXCJwaG9uZTphZGRBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgaWQ6IF9pZCxcbiAgICB0aXRsZTogXCJJbmNvbWluZyBDb25mZXJlbmNlIENhbGxcIixcbiAgICBkZXNjcmlwdGlvbjogYCR7c291cmNlTmFtZX0gaXMgYWRkaW5nIHlvdSB0byBhIGNvbmZlcmVuY2UgY2FsbGAsXG4gICAgYXBwOiBcInBob25lXCIsXG4gICAgaWNvbnM6IHtcbiAgICAgIFwiMFwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvY3Jvc3MtY2lyY2xlLnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQ6IGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgdGFyZ2V0TmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IF9pZCxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgICAgXCIxXCI6IHtcbiAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9hY2NlcHQuc3ZnXCIsXG4gICAgICAgIGlzU2VydmVyOiB0cnVlLFxuICAgICAgICBldmVudDogXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q29uZmVyZW5jZUNhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZDogY2FsbElkLFxuICAgICAgICAgIHRhcmdldFNvdXJjZSxcbiAgICAgICAgICBzb3VyY2VOYW1lOiB0YXJnZXROYW1lLFxuICAgICAgICAgIHRhcmdldE5hbWU6IHNvdXJjZU5hbWUsXG4gICAgICAgICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgICAgICAgZGF0YWJhc2VUYWJsZUlkOiBfaWQsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9LFxuICB9KSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgdGl0bGU6ICdQbGF5ZXIgQWRkZWQgdG8gQ2FsbCcsXG4gICAgbWVzc2FnZTogYCR7c291cmNlUGhvbmV9IGFkZGVkICR7Y29udGFjdE51bWJlcn0gdG8gY29uZmVyZW5jZSBjYWxsIChDYWxsIElEOiAke2NhbGxJZH0pLmAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbiAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjayhcInBob25lOnNlcnZlcjpnZXRDYWxsSGlzdG9yeVwiLCBhc3luYyAoc291cmNlOiBudW1iZXIsIG1heFJlY29yZHNYOiBudW1iZXIpID0+IHtcbiAgbGV0IG1heFJlY29yZHMgPSAxMDA7XG4gIHRyeSB7XG4gICAgaWYgKG1heFJlY29yZHNYKSB7XG4gICAgICBtYXhSZWNvcmRzID0gbWF4UmVjb3Jkc1g7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBwYXJzaW5nIGdldENhbGxIaXN0b3J5IGRhdGFcIiwgZXJyb3IpO1xuICB9XG5cbiAgY29uc3QgcGhvbmVOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHNvdXJjZSk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBoaXN0b3J5ID0gYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLmdldFBsYXllckNhbGxIaXN0b3J5KHBob25lTnVtYmVyLCBtYXhSZWNvcmRzKTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoaGlzdG9yeSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIkVycm9yIHJldHJpZXZpbmcgY2FsbCBoaXN0b3J5IGZvciBwaG9uZSBudW1iZXI6XCIsIHBob25lTnVtYmVyLCBlcnJvcik7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KFtdKTtcbiAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lOnNlcnZlcjpnZXREYXRhRnJvbURCd2l0aE51bWJlcicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICBudW1iZXI6IHN0cmluZyxcbiAgICBjaXRpemVuSWQ6IHN0cmluZyxcbiAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfY29udGFjdHMnLCB7IGNvbnRhY3ROdW1iZXI6IHBhcnNlZERhdGEubnVtYmVyLCBvd25lcklkOiBwYXJzZWREYXRhLmNpdGl6ZW5JZCB9KTtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6c2VydmVyOnRvZ2dsZUJsb2NrTnVtYmVyJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgcGFyc2VkRGF0YTogUGhvbmVDb250YWN0cyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gIGNvbnN0IHBlcnNvbmFsTnVtYmVyID0gcGFyc2VkRGF0YS5wZXJzb25hbE51bWJlcjtcbiAgY29uc3QgY29udGFjdE51bWJlciA9IHBhcnNlZERhdGEuY29udGFjdE51bWJlcjtcbiAgbGV0IElzTnVtYmVyQmxvY2tlZCA9IGF3YWl0IFV0aWxzLklzTnVtYmVyQmxvY2tlZChwZXJzb25hbE51bWJlciwgY29udGFjdE51bWJlcik7XG4gIGlmICghSXNOdW1iZXJCbG9ja2VkKSB7XG4gICAgYXdhaXQgVXRpbHMuQmxvY2tOdW1iZXIocGVyc29uYWxOdW1iZXIsIGNvbnRhY3ROdW1iZXIpO1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJOdW1iZXIgQmxvY2tlZFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiTnVtYmVyIGhhcyBiZWVuIGJsb2NrZWRcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgVXRpbHMuVW5ibG9ja051bWJlcihwZXJzb25hbE51bWJlciwgY29udGFjdE51bWJlcik7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIk51bWJlciBVbmJsb2NrZWRcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIk51bWJlciBoYXMgYmVlbiB1bmJsb2NrZWRcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjayhcInN1bW1pdF9waG9uZTpzZXJ2ZXI6amFpbENhbGxcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyBudW1iZXIsIHZvbHVtZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyRnJvbVBob25lTnVtYmVyKG51bWJlcik7XG5cbiAgLy8gRm9yIGphaWwgY2FsbHMsIHdlIGRvbid0IG5lZWQgdG8gY2hlY2sgaWYgdGhlIGNhbGxlciBoYXMgYSBwaG9uZVxuICAvLyBXZSBhbHNvIGRvbid0IG5lZWQgdG8gY2hlY2sgZmxpZ2h0IG1vZGUgc2luY2UgaXQncyBhIGphaWwgcGhvbmVcblxuICBpZiAoIXRhcmdldFBsYXllcikge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJTZXJ2aWNlIFVuYXZhaWxhYmxlXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJQZXJzb24geW91IGFyZSB0cnlpbmcgdG8gY2FsbCBpcyBub3QgcmVhY2hhYmxlXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHRhcmdldFNvdXJjZSA9IHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZTtcblxuICBpZiAoY2FsbE1hbmFnZXIuaXNQbGF5ZXJJbkNhbGwoc291cmNlKSkge1xuICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICB0aXRsZTogXCJDYWxsIEVycm9yXCIsXG4gICAgICBkZXNjcmlwdGlvbjogXCJZb3UgYXJlIGFscmVhZHkgaW4gYSBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmIChjYWxsTWFuYWdlci5pc1BsYXllckluQ2FsbCh0YXJnZXRTb3VyY2UpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgQnVzeVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiVGFyZ2V0IGlzIGFscmVhZHkgaW4gYSBjYWxsXCIsXG4gICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgfSkpO1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGNvbnN0IHNvdXJjZVBob25lID0gXCJKQUlMX1BIT05FXCI7IC8vIFNwZWNpYWwgaWRlbnRpZmllciBmb3IgamFpbCBwaG9uZSBjYWxsc1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3Qgc291cmNlQ2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcblxuICAvLyBGb3IgamFpbCBjYWxscywgd2UgZG9uJ3QgY2hlY2sgYmxvY2tlZCBudW1iZXJzIG9yIGZsaWdodCBtb2RlXG4gIC8vIFRoaXMgYWxsb3dzIGluY2FyY2VyYXRlZCBwbGF5ZXJzIHRvIG1ha2UgY2FsbHMgZXZlbiBpZiB0aGV5J3JlIGJsb2NrZWRcblxuICBjb25zdCB0YXJnZXRIYXNQaG9uZSA9IGF3YWl0IFV0aWxzLkhhc1Bob25lKHRhcmdldFNvdXJjZSk7XG4gIGlmICghdGFyZ2V0SGFzUGhvbmUpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiU2VydmljZSBVbmF2YWlsYWJsZVwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiUGVyc29uIHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgaXMgbm90IHJlYWNoYWJsZVwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBjb25zdCBob3N0UGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlLFxuICAgIGNpdGl6ZW5JZDogc291cmNlQ2l0aXplbklkLFxuICAgIHBob25lTnVtYmVyOiBzb3VyY2VQaG9uZSxcbiAgICBvbkhvbGQ6IGZhbHNlLFxuICB9O1xuXG4gIGNvbnN0IGNhbGxJZCA9IGNhbGxNYW5hZ2VyLmNyZWF0ZUNhbGwoaG9zdFBhcnRpY2lwYW50KTtcblxuICBjYWxsTWFuYWdlci5jcmVhdGVSaW5nVG9uZSh0YXJnZXRTb3VyY2UsIFN0cmluZyhTZXR0aW5ncy5yaW5ndG9uZS5nZXQodGFyZ2V0Q2l0aXplbklkKT8uY3VycmVudCksIHZvbHVtZSk7XG5cbiAgLy8gSmFpbCBjYWxscyBoYXZlIGEgc2hvcnRlciB0aW1lb3V0ICgxNSBtaW51dGVzIGluc3RlYWQgb2YgMjApXG4gIGNhbGxNYW5hZ2VyLmFkZFBlbmRpbmdJbnZpdGF0aW9uKGNhbGxJZCwgdGFyZ2V0U291cmNlLCAoKSA9PiB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgVGltZW91dFwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ2FsbCB3YXMgbm90IGFuc3dlcmVkIGJ5IHRhcmdldFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiTWlzc2VkIENhbGxcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIllvdSBtaXNzZWQgYSBjYWxsIGZyb20gSkFJTFwiLFxuICAgICAgYXBwOiBcInNldHRpbmdzXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICAgICAgaWYgKGNhbGwpIHtcbiAgICAgICAgYXdhaXQgY2FsbEhpc3RvcnlNYW5hZ2VyLnJlY29yZFR3b1BhcnR5Q2FsbEhpc3RvcnkoY2FsbCwgXCJ1bmFuc3dlcmVkXCIsIFwibWlzc2VkXCIsIG5ldyBEYXRlKCksIHRhcmdldFBob25lKTtcbiAgICAgIH1cbiAgICAgIGNhbGxNYW5hZ2VyLmVuZENhbGwoY2FsbElkKTtcbiAgICAgIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICAgIH0pKCk7XG4gICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHNvdXJjZSwgMCk7XG4gICAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgMCk7XG4gICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBcImphaWxfY2FsbFwiKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUNhbGxpbmdJbnRlcmZhY2VcIiwgc291cmNlKTtcbiAgfSwgMTUwMDApOyAvLyAxNSBtaW51dGVzIGZvciBqYWlsIGNhbGxzXG5cbiAgY29uc3Qgc291cmNlTmFtZSA9IFwiSkFJTCBQSE9ORVwiO1xuICBjb25zdCB0YXJnZXROYW1lID0gYXdhaXQgVXRpbHMuR2V0Q29udGFjdE5hbWVCeU51bWJlcihudW1iZXIsIHRhcmdldENpdGl6ZW5JZCk7XG5cbiAgZW1pdE5ldChcInBob25lOmFkZEFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICBpZDogXCJqYWlsX2NhbGxcIixcbiAgICB0aXRsZTogXCJJbmNvbWluZyBDYWxsIGZyb20gSkFJTFwiLFxuICAgIGRlc2NyaXB0aW9uOiBgJHtzb3VyY2VOYW1lfSBpcyBjYWxsaW5nIHlvdWAsXG4gICAgYXBwOiBcInBob25lXCIsXG4gICAgaWNvbnM6IHtcbiAgICAgIFwiMFwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvY3Jvc3MtY2lyY2xlLnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmRlY2xpbmVDYWxsXCIsXG4gICAgICAgIGFyZ3M6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBjYWxsSWQsXG4gICAgICAgICAgdGFyZ2V0U291cmNlLFxuICAgICAgICAgIHNvdXJjZU5hbWUsXG4gICAgICAgICAgdGFyZ2V0TmFtZSxcbiAgICAgICAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICAgICAgICBkYXRhYmFzZVRhYmxlSWQ6IFwiamFpbF9jYWxsXCIsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICAgIFwiMVwiOiB7XG4gICAgICAgIGljb246IFwiaHR0cHM6Ly9pZ25pcy1ycC5jb20vdXBsb2Fkcy9zZXJ2ZXIvcGhvbmUvYWNjZXB0LnN2Z1wiLFxuICAgICAgICBpc1NlcnZlcjogdHJ1ZSxcbiAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmFjY2VwdENhbGxcIixcbiAgICAgICAgYXJnczogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGNhbGxJZCxcbiAgICAgICAgICB0YXJnZXRTb3VyY2UsXG4gICAgICAgICAgc291cmNlTmFtZTogdGFyZ2V0TmFtZSxcbiAgICAgICAgICB0YXJnZXROYW1lOiBzb3VyY2VOYW1lLFxuICAgICAgICAgIGNhbGxlclNvdXJjZTogc291cmNlLFxuICAgICAgICAgIGRhdGFiYXNlVGFibGVJZDogXCJqYWlsX2NhbGxcIixcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0sXG4gIH0pKTtcblxuICBlbWl0TmV0KFwic3VtbWl0X3Bob25lOnNlcnZlcjphZGRDYWxsaW5naW50ZXJmYWNlXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgdGFyZ2V0TmFtZSxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQ6IFwiamFpbF9jYWxsXCIsXG4gIH0pKTtcblxuICAvLyBTdGFydCBhIHRpbWVyIHRvIGF1dG9tYXRpY2FsbHkgZW5kIGphaWwgY2FsbHMgYWZ0ZXIgMTAgbWludXRlc1xuICAvLyBUaGlzIHByZXZlbnRzIGFidXNlIGFuZCBzaW11bGF0ZXMgcmVhbCBqYWlsIHBob25lIGxpbWl0YXRpb25zXG4gIHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgICBpZiAoY2FsbCAmJiBjYWxsLmNhbGxJZCA9PT0gY2FsbElkKSB7XG4gICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIkNhbGwgRW5kZWRcIixcbiAgICAgICAgZGVzY3JpcHRpb246IFwiSmFpbCBwaG9uZSBjYWxsIHRpbWUgbGltaXQgcmVhY2hlZFwiLFxuICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgdGltZW91dDogMzAwMCxcbiAgICAgIH0pKTtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiQ2FsbCBFbmRlZFwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJKYWlsIHBob25lIGNhbGwgdGltZSBsaW1pdCByZWFjaGVkXCIsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICB0aW1lb3V0OiAzMDAwLFxuICAgICAgfSkpO1xuXG4gICAgICBhd2FpdCBjYWxsSGlzdG9yeU1hbmFnZXIucmVjb3JkVHdvUGFydHlDYWxsSGlzdG9yeShjYWxsLCBcImNvbXBsZXRlZFwiLCBcImNvbXBsZXRlZFwiLCBuZXcgRGF0ZSgpLCB0YXJnZXRQaG9uZSk7XG4gICAgICBjYWxsTWFuYWdlci5lbmRDYWxsKGNhbGxJZCk7XG4gICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwoc291cmNlLCAwKTtcbiAgICAgIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbCh0YXJnZXRTb3VyY2UsIDApO1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDpyZW1vdmVBY3Rpb25Ob3RpZmljYXRpb25cIiwgdGFyZ2V0U291cmNlLCBcImphaWxfY2FsbFwiKTtcbiAgICAgIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQ2FsbGluZ0ludGVyZmFjZVwiLCBzb3VyY2UpO1xuICAgIH1cbiAgfSwgNjAwMDAwKTsgLy8gMTAgbWludXRlc1xuXG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9jYWxscycsXG4gICAgdGl0bGU6ICdKYWlsIENhbGwgSW5pdGlhdGVkJyxcbiAgICBtZXNzYWdlOiBgSmFpbCBjYWxsIGluaXRpYXRlZCBmcm9tICR7c291cmNlfSB0byAke3RhcmdldFNvdXJjZX0gKCR7dGFyZ2V0UGhvbmV9KWAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlLFxuICB9KTtcblxuICByZXR1cm4gdHJ1ZTtcbn0pOyIsICJpbXBvcnQgeyBjYWxsTWFuYWdlciB9IGZyb20gXCIuL0NhbGxNYW5hZ2VyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBjYWxsSGlzdG9yeU1hbmFnZXIgfSBmcm9tIFwiLi9jYWxsSGlzdG9yeU1hbmFnZXJcIjtcbmltcG9ydCB7IExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcblxub25OZXQoXCJwaG9uZTpzZXJ2ZXI6ZGVjbGluZUNhbGxcIiwgYXN5bmMgKG5vdGlJZDogc3RyaW5nLCBhcmdzOiBhbnkpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQsIHRhcmdldFNvdXJjZSwgY2FsbGVyU291cmNlLCBkYXRhYmFzZVRhYmxlSWQgfSA9IEpTT04ucGFyc2UoYXJncyk7XG4gIGNhbGxNYW5hZ2VyLmRlY2xpbmVJbnZpdGF0aW9uKGNhbGxJZCwgdGFyZ2V0U291cmNlKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihjYWxsZXJTb3VyY2UpO1xuICBpZiAoY2FsbCkge1xuICAgIGNvbnN0IHRhcmdldFBob25lID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICAgIGF3YWl0IGNhbGxIaXN0b3J5TWFuYWdlci5yZWNvcmRUd29QYXJ0eUNhbGxIaXN0b3J5KGNhbGwsIFwiZGVjbGluZWRcIiwgXCJkZWNsaW5lZFwiLCBuZXcgRGF0ZSgpLCB0YXJnZXRQaG9uZSk7XG4gIH1cbiAgY2FsbE1hbmFnZXIuZW5kQ2FsbChjYWxsSWQpO1xuICBjYWxsTWFuYWdlci5zdG9wUmluZ1RvbmUodGFyZ2V0U291cmNlKTtcbiAgXG4gIC8vIE5FVzogRW5kIGFuaW1hdGlvbnMgZm9yIGJvdGggcGFydGllc1xuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OmVuZENhbGxBbmltYXRpb25cIiwgdGFyZ2V0U291cmNlKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDplbmRDYWxsQW5pbWF0aW9uXCIsIGNhbGxlclNvdXJjZSk7XG4gIFxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIGRhdGFiYXNlVGFibGVJZCk7XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQ2FsbGluZ0ludGVyZmFjZVwiLCBjYWxsZXJTb3VyY2UpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiBcInBob25lXCIsXG4gICAgdGl0bGU6IFwiQ2FsbCBEZWNsaW5lZFwiLFxuICAgIG1lc3NhZ2U6IGAke1V0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UoY2FsbGVyU291cmNlKX0gaGFzIGRlY2xpbmVkIHRoZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjphY2NlcHRDYWxsXCIsIGFzeW5jIChub3RpSWQ6IHN0cmluZywgYXJnczogYW55KSA9PiB7XG4gIGNvbnN0IHsgY2FsbElkLCB0YXJnZXRTb3VyY2UsIHRhcmdldE5hbWUsIHNvdXJjZU5hbWUsIGNhbGxlclNvdXJjZSwgZGF0YWJhc2VUYWJsZUlkIH0gPSBKU09OLnBhcnNlKGFyZ3MpO1xuICBjb25zdCBjYWxsID0gY2FsbE1hbmFnZXIuZ2V0Q2FsbEJ5UGxheWVyKGNhbGxlclNvdXJjZSk7XG4gIGlmICghY2FsbCB8fCBjYWxsLmNhbGxJZCAhPT0gY2FsbElkKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNhbGwgbm8gbG9uZ2VyIGV4aXN0c1wiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY29uc3QgdGFyZ2V0Q2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgdGFyZ2V0UGhvbmUgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSk7XG4gIGNvbnN0IHBhcnRpY2lwYW50ID0ge1xuICAgIHNvdXJjZTogdGFyZ2V0U291cmNlLFxuICAgIGNpdGl6ZW5JZDogdGFyZ2V0Q2l0aXplbklkLFxuICAgIHBob25lTnVtYmVyOiB0YXJnZXRQaG9uZSxcbiAgICBvbkhvbGQ6IGZhbHNlLFxuICB9O1xuICBpZiAoIWNhbGxNYW5hZ2VyLmFjY2VwdEludml0YXRpb24oY2FsbElkLCBwYXJ0aWNpcGFudCkpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ291bGQgbm90IGpvaW4gY2FsbFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgY2FsbE1hbmFnZXIuc3RvcFJpbmdUb25lKHRhcmdldFNvdXJjZSk7XG4gIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbCh0YXJnZXRTb3VyY2UsIGNhbGxJZCk7XG4gIGV4cG9ydHNbXCJwbWEtdm9pY2VcIl0uc2V0UGxheWVyQ2FsbChjYWxsZXJTb3VyY2UsIGNhbGxJZCk7XG4gIFxuICAvLyBORVc6IFN0YXJ0IGFuaW1hdGlvbiBmb3IgYm90aCBwYXJ0aWVzIHdoZW4gY2FsbCBpcyBhY2NlcHRlZFxuICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OmFjY2VwdENhbGxcIiwgdGFyZ2V0U291cmNlLCBhcmdzKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDpzdGFydENhbGxBbmltYXRpb25cIiwgY2FsbGVyU291cmNlKTsgLy8gTkVXOiBBbmltYXRpb24gZm9yIGNhbGxlclxuICBcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDYWxsZXJJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY2FsbElkLFxuICAgIHRhcmdldFNvdXJjZSxcbiAgICBzb3VyY2VOYW1lOiB0YXJnZXROYW1lLFxuICAgIHRhcmdldE5hbWU6IHNvdXJjZU5hbWUsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkLFxuICB9KSk7XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgbm90aUlkKTtcbiAgTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogXCJwaG9uZVwiLFxuICAgIHRpdGxlOiBcIkNhbGwgQWNjZXB0ZWRcIixcbiAgICBtZXNzYWdlOiBgJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNhbGxlclNvdXJjZSl9IGhhcyBhY2NlcHRlZCB0aGUgY2FsbCBmcm9tICR7VXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZSh0YXJnZXRTb3VyY2UpfWAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZSxcbiAgfSk7XG59KTtcblxub25OZXQoXCJwaG9uZTpzZXJ2ZXI6YWNjZXB0Q29uZmVyZW5jZUNhbGxcIiwgYXN5bmMgKG5vdGlJZDogc3RyaW5nLCBhcmdzOiBhbnkpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQsIHRhcmdldFNvdXJjZSwgdGFyZ2V0TmFtZSwgc291cmNlTmFtZSwgY2FsbGVyU291cmNlLCBkYXRhYmFzZVRhYmxlSWQgfSA9IEpTT04ucGFyc2UoYXJncyk7XG5cbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihjYWxsZXJTb3VyY2UpO1xuICBpZiAoIWNhbGwpIHtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgdGl0bGU6IFwiQ2FsbCBFcnJvclwiLFxuICAgICAgZGVzY3JpcHRpb246IFwiQ29uZmVyZW5jZSBjYWxsIG5vIGxvbmdlciBleGlzdHNcIixcbiAgICAgIGFwcDogXCJwaG9uZVwiLFxuICAgICAgdGltZW91dDogMjAwMCxcbiAgICB9KSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGNhbGxNYW5hZ2VyLnN0b3BSaW5nVG9uZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZSh0YXJnZXRTb3VyY2UpO1xuICBjb25zdCB0YXJnZXRQaG9uZSA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2UodGFyZ2V0U291cmNlKTtcbiAgY29uc3QgcGFydGljaXBhbnQgPSB7XG4gICAgc291cmNlOiB0YXJnZXRTb3VyY2UsXG4gICAgY2l0aXplbklkOiB0YXJnZXRDaXRpemVuSWQsXG4gICAgcGhvbmVOdW1iZXI6IHRhcmdldFBob25lLFxuICAgIG9uSG9sZDogZmFsc2UsXG4gIH07XG4gIGlmICghY2FsbE1hbmFnZXIuYWNjZXB0SW52aXRhdGlvbihjYWxsLmNhbGxJZCwgcGFydGljaXBhbnQpKSB7XG4gICAgZW1pdE5ldChcInBob25lOmFkZG5vdGlGaWNhdGlvblwiLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgIHRpdGxlOiBcIkNhbGwgRXJyb3JcIixcbiAgICAgIGRlc2NyaXB0aW9uOiBcIkNvdWxkIG5vdCBqb2luIGNvbmZlcmVuY2UgY2FsbFwiLFxuICAgICAgYXBwOiBcInBob25lXCIsXG4gICAgICB0aW1lb3V0OiAyMDAwLFxuICAgIH0pKTtcbiAgICByZXR1cm47XG4gIH1cbiAgZXhwb3J0c1tcInBtYS12b2ljZVwiXS5zZXRQbGF5ZXJDYWxsKHRhcmdldFNvdXJjZSwgY2FsbC5jYWxsSWQpO1xuXG4gIGZvciAoY29uc3QgcCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpKSB7XG4gICAgaWYgKHAuc291cmNlICE9PSB0YXJnZXRTb3VyY2UpIHtcbiAgICAgIGNvbnN0IGNhbGxzcyA9IGNhbGwuY2FsbElkO1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxzcyxcbiAgICAgICAgcGFydGljaXBhbnRzOiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbC5jYWxsSWQpLFxuICAgICAgfSkpO1xuICAgICAgZW1pdE5ldCgncGhvbmU6Y2xpZW50OnVwRGF0ZUludGVyRmFjZU5hbWUnLCBwLnNvdXJjZSk7XG4gICAgfVxuICB9XG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6cmVtb3ZlQWN0aW9uTm90aWZpY2F0aW9uXCIsIHRhcmdldFNvdXJjZSwgbm90aUlkKTtcbiAgXG4gIGVtaXROZXQoXCJwaG9uZTpjbGllbnQ6dXBkYXRlQ2FsbGVySW50ZXJmYWNlXCIsIHRhcmdldFNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgIGNhbGxJZCxcbiAgICB0YXJnZXRTb3VyY2UsXG4gICAgc291cmNlTmFtZTogc291cmNlTmFtZSxcbiAgICB0YXJnZXROYW1lOiAnQ29uZmVyZW5jZSBDYWxsJyxcbiAgICBjYWxsZXJTb3VyY2U6IHNvdXJjZSxcbiAgICBkYXRhYmFzZVRhYmxlSWQsXG4gIH0pKTtcbiAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDYWxsZXJJbnRlcmZhY2VcIiwgY2FsbGVyU291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgY2FsbElkLFxuICAgIHRhcmdldFNvdXJjZSxcbiAgICBzb3VyY2VOYW1lOiBzb3VyY2VOYW1lLFxuICAgIHRhcmdldE5hbWU6IFwiQ29uZmVyZW5jZSBDYWxsXCIsXG4gICAgY2FsbGVyU291cmNlOiBzb3VyY2UsXG4gICAgZGF0YWJhc2VUYWJsZUlkLFxuICB9KSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6IFwicGhvbmVcIixcbiAgICB0aXRsZTogXCJDb25mZXJlbmNlIENhbGwgQWNjZXB0ZWRcIixcbiAgICBtZXNzYWdlOiBgJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNhbGxlclNvdXJjZSl9IGhhcyBhY2NlcHRlZCB0aGUgY29uZmVyZW5jZSBjYWxsIGZyb20gJHtVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHRhcmdldFNvdXJjZSl9YCxcbiAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlLFxuICB9KTtcbn0pO1xuXG5vbk5ldChcInBob25lOnNlcnZlcjplbmRDYWxsXCIsIGFzeW5jIChhcmdzOiBhbnkpID0+IHtcbiAgY29uc3QgeyBjYWxsSWQsIHNvdXJjZSB9ID0gSlNPTi5wYXJzZShhcmdzKTtcbiAgY29uc3QgY2FsbCA9IGNhbGxNYW5hZ2VyLmdldENhbGxCeVBsYXllcihzb3VyY2UpO1xuICBpZiAoY2FsbCAmJiBjYWxsLmNhbGxJZCA9PT0gY2FsbElkKSB7XG4gICAgYXdhaXQgY2FsbE1hbmFnZXIucmVtb3ZlUGFydGljaXBhbnQoY2FsbElkLCBzb3VyY2UpO1xuICAgIGZvciAoY29uc3QgcCBvZiBjYWxsTWFuYWdlci5nZXRQYXJ0aWNpcGFudHMoY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxJZDogY2FsbElkLFxuICAgICAgICBwYXJ0aWNpcGFudHM6IGNhbGxNYW5hZ2VyLmdldFBhcnRpY2lwYW50cyhjYWxsSWQpLFxuICAgICAgfSkpO1xuICAgIH1cbiAgfVxufSk7XG5cbm9uKFwib25SZXNvdXJjZVN0b3BcIiwgYXN5bmMgKHJlc291cmNlOiBzdHJpbmcpID0+IHtcbiAgaWYgKHJlc291cmNlID09PSBHZXRDdXJyZW50UmVzb3VyY2VOYW1lKCkpIHtcbiAgICBmb3IgKGNvbnN0IGNhbGwgb2YgY2FsbE1hbmFnZXIuZ2V0QWxsQ2FsbHMoKSkge1xuICAgICAgZm9yIChjb25zdCBwYXJ0aWNpcGFudCBvZiBjYWxsLnBhcnRpY2lwYW50cy52YWx1ZXMoKSkge1xuICAgICAgICBleHBvcnRzW1wicG1hLXZvaWNlXCJdLnNldFBsYXllckNhbGwocGFydGljaXBhbnQuc291cmNlLCAwKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG5vbk5ldChcInBsYXllckRyb3BwZWRcIiwgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gIGNvbnN0IGNhbGwgPSBjYWxsTWFuYWdlci5nZXRDYWxsQnlQbGF5ZXIoc291cmNlKTtcbiAgaWYgKGNhbGwpIHtcbiAgICBhd2FpdCBjYWxsTWFuYWdlci5yZW1vdmVQYXJ0aWNpcGFudChjYWxsLmNhbGxJZCwgc291cmNlKTtcbiAgICBmb3IgKGNvbnN0IHAgb2YgY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSkge1xuICAgICAgZW1pdE5ldChcInBob25lOmNsaWVudDp1cGRhdGVDb25mZXJlbmNlXCIsIHAuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGNhbGxJZDogY2FsbC5jYWxsSWQsXG4gICAgICAgIHBhcnRpY2lwYW50czogY2FsbE1hbmFnZXIuZ2V0UGFydGljaXBhbnRzKGNhbGwuY2FsbElkKSxcbiAgICAgIH0pKTtcbiAgICB9XG4gIH1cbn0pO1xuIiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3NhdmVQaG90b1RvUGhvdG9zJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgZGF0YVggPSB7XG4gICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICBjaXRpemVuSWQsXG4gICAgbGluazogZGF0YSxcbiAgICBkYXRlOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkucmVwbGFjZSgnVCcsICcgJykucmVwbGFjZSgnWicsICcnKVxuICB9O1xuICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfcGhvdG9zJywgZGF0YVgpO1xuICBMb2dnZXIuQWRkTG9nKHtcbiAgICB0eXBlOiAncGhvbmVfcGhvdG9zJyxcbiAgICB0aXRsZTogJ1Bob3RvIFNhdmVkJyxcbiAgICBtZXNzYWdlOiBgUGhvdG8gc2F2ZWQgYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8ICR7Y2l0aXplbklkfSwgTGluazogJHtkYXRhfWAsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICB9KTtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGFYKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRQaG90b3MnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgcGhvdG9zID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfcGhvdG9zJywgeyBjaXRpemVuSWQgfSk7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShwaG90b3MpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2RlbGV0ZVBob3RvJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9waG90b3MnLCB7IF9pZDogZGF0YSB9KTtcbiAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX3Bob3RvcycsIHsgX2lkOiBkYXRhLCBjaXRpemVuSWQgfSk7XG4gIExvZ2dlci5BZGRMb2coe1xuICAgIHR5cGU6ICdwaG9uZV9waG90b3MnLFxuICAgIHRpdGxlOiAnUGhvdG8gRGVsZXRlZCcsXG4gICAgbWVzc2FnZTogYFBob3RvIGRlbGV0ZWQgYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8ICR7Y2l0aXplbklkfSwgTGluazogJHtyZXMubGlua31gLFxuICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgfSk7XG4gIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2ssIHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyLCBGcmFtZXdvcmsgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQsIExPR0dFUiB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdSZWdpc3Rlck5ld0J1c2luZXNzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgYnVzaW5lc3NQYXNzd29yZCxcbiAgICAgICAgam9iXG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZSB9KTtcbiAgICBpZiAoYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBSZWdpc3RyYXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIHJlZ2lzdGVyIGJ1c2luZXNzIHdpdGggZXhpc3RpbmcgbmFtZSAnJHtidXNpbmVzc05hbWV9JyBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYEJ1c2luZXNzIHdpdGggbmFtZSAke2J1c2luZXNzTmFtZX0gYWxyZWFkeSBleGlzdHMuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGlmIChnZW5lcmF0ZUJ1c2luZXNzRW1haWwpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX21haWwnLCB7XG4gICAgICAgICAgICBfaWQ6IGJ1c2luZXNzRW1haWwsXG4gICAgICAgICAgICBhY3RpdmVNYWlkSWQ6IGJ1c2luZXNzRW1haWwsXG4gICAgICAgICAgICB1c2VybmFtZTogYnVzaW5lc3NFbWFpbCxcbiAgICAgICAgICAgIGFjdGl2ZU1haWxQYXNzd29yZDogYnVzaW5lc3NQYXNzd29yZCxcbiAgICAgICAgICAgIGF2YXRhcjogYnVzaW5lc3NMb2dvLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdXG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2J1c2luZXNzJywge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iXG4gICAgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgUmVnaXN0ZXJlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBOZXcgYnVzaW5lc3MgJyR7YnVzaW5lc3NOYW1lfScgcmVnaXN0ZXJlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0QnVzaW5lc3NEYXRhJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3MgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGJ1c2luZXNzKTtcbn0pO1xub25DbGllbnRDYWxsYmFjaygnZ2V0QWxsQnVzaW5lc3NEYXRhJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3NlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2J1c2luZXNzJywge30pO1xuICAgIGxldCBvbmxpbmVCdXNzID0gW11cbiAgICBsZXQgb2ZmbGluZUJ1c3MgPSBbXVxuICAgIGZvciAoY29uc3QgYnVzaW5lc3Mgb2YgYnVzaW5lc3Nlcykge1xuICAgICAgICBjb25zdCBqb2JDb3VudCA9IEdsb2JhbFN0YXRlW2Ake2J1c2luZXNzLmpvYn06Y291bnRgXVxuICAgICAgICBpZiAoam9iQ291bnQpIHtcbiAgICAgICAgICAgIG9ubGluZUJ1c3MucHVzaChidXNpbmVzcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvZmZsaW5lQnVzcy5wdXNoKGJ1c2luZXNzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoeyBvbmxpbmU6IG9ubGluZUJ1c3MsIG9mZmxpbmU6IG9mZmxpbmVCdXNzIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldEJ1c2luZXNzTmFtZXMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgYnVzaW5lc3NlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3Bob25lX2J1c2luZXNzJywge30pO1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShidXNpbmVzc2VzLm1hcCgoYnVzaW5lc3M6IGFueSkgPT4gYnVzaW5lc3MuYnVzaW5lc3NOYW1lKSk7XG59KVxuXG5vbkNsaWVudENhbGxiYWNrKCdVcGRhdGVCdXNpbmVzcycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHtcbiAgICAgICAgc2VsZWN0ZWRCdXNpbmVzcyxcbiAgICAgICAgb3duZXJDaXRpemVuSWQsXG4gICAgICAgIGJ1c2luZXNzTmFtZSxcbiAgICAgICAgYnVzaW5lc3NEZXNjcmlwdGlvbixcbiAgICAgICAgYnVzaW5lc3NUeXBlLFxuICAgICAgICBidXNpbmVzc0xvZ28sXG4gICAgICAgIGJ1c2luZXNzUGhvbmVOdW1iZXIsXG4gICAgICAgIGJ1c2luZXNzQWRkcmVzcyxcbiAgICAgICAgZ2VuZXJhdGVCdXNpbmVzc0VtYWlsLFxuICAgICAgICBjb29yZHMsXG4gICAgICAgIGpvYixcbiAgICAgICAgYnVzaW5lc3NFbWFpbFxuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGJ1c2luZXNzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBzZWxlY3RlZEJ1c2luZXNzIH0pO1xuICAgIGlmICghYnVzaW5lc3MpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdCdXNpbmVzcyBVcGRhdGUgRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIHVwZGF0ZSBub24tZXhpc3RlbnQgYnVzaW5lc3MgJyR7c2VsZWN0ZWRCdXNpbmVzc30nIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7YnVzaW5lc3NOYW1lfSBkb2VzIG5vdCBleGlzdC5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2J1c2luZXNzJywgeyBidXNpbmVzc05hbWU6IHNlbGVjdGVkQnVzaW5lc3MgfSwge1xuICAgICAgICBvd25lckNpdGl6ZW5JZCxcbiAgICAgICAgYnVzaW5lc3NOYW1lLFxuICAgICAgICBidXNpbmVzc0Rlc2NyaXB0aW9uLFxuICAgICAgICBidXNpbmVzc1R5cGUsXG4gICAgICAgIGJ1c2luZXNzTG9nbyxcbiAgICAgICAgYnVzaW5lc3NQaG9uZU51bWJlcixcbiAgICAgICAgYnVzaW5lc3NBZGRyZXNzLFxuICAgICAgICBnZW5lcmF0ZUJ1c2luZXNzRW1haWwsXG4gICAgICAgIGNvb3JkcyxcbiAgICAgICAgam9iLFxuICAgICAgICBidXNpbmVzc0VtYWlsXG4gICAgfSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9idXNpbmVzcycsXG4gICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgVXBkYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBCdXNpbmVzcyAnJHtzZWxlY3RlZEJ1c2luZXNzfScgdXBkYXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZGVsZXRlQnVzaW5lc3MnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBidXNpbmVzcyA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3MnLCB7IGJ1c2luZXNzTmFtZTogZGF0YSB9KTtcbiAgICBpZiAoIWJ1c2luZXNzKSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnQnVzaW5lc3MgRGVsZXRpb24gRmFpbGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBBdHRlbXB0IHRvIGRlbGV0ZSBub24tZXhpc3RlbnQgYnVzaW5lc3MgJyR7ZGF0YX0nIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgQnVzaW5lc3Mgd2l0aCBuYW1lICR7ZGF0YX0gZG9lcyBub3QgZXhpc3QuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9idXNpbmVzcycsIHsgYnVzaW5lc3NOYW1lOiBkYXRhIH0pO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICB0aXRsZTogJ0J1c2luZXNzIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgQnVzaW5lc3MgJyR7ZGF0YX0nIGRlbGV0ZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6dG9nZ2xlSm9iQ2FsbHMnLCBhc3luYyAoY2xpZW50KSA9PiB7XG4gICAgY29uc3QgcGxheWVyID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTs7XG4gICAgY29uc3QgUGxheWVyRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogcGxheWVyIH0pO1xuICAgIGlmICghUGxheWVyRGF0YSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogcGxheWVyLCBqb2JDYWxsczogdHJ1ZSB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogcGxheWVyIH0sIHsgam9iQ2FsbHM6ICFQbGF5ZXJEYXRhLmpvYkNhbGxzIH0pO1xuICAgIHJldHVybiAhUGxheWVyRGF0YS5qb2JDYWxscztcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmdldEpvYkNhbGxzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IHBsYXllciA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgUGxheWVyRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogcGxheWVyIH0pO1xuICAgIGlmICghUGxheWVyRGF0YSkge1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogcGxheWVyLCBqb2JDYWxsczogdHJ1ZSB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbiAgICByZXR1cm4gUGxheWVyRGF0YS5qb2JDYWxscztcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmJ1c2luZXNzQ2FsbCcsIGFzeW5jIChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBudW1iZXIgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgY2l0aXplbmlkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihudW1iZXIpO1xuICAgIGNvbnN0IHBlcnNvbmFsTnVtYmVyID0gYXdhaXQgVXRpbHMuR2V0UGhvbmVOdW1iZXJCeVNvdXJjZShjbGllbnQpO1xuICAgIGlmIChTdHJpbmcocGVyc29uYWxOdW1iZXIpID09PSBTdHJpbmcobnVtYmVyKSkge1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IENhbid0IGNhbGwgeW91cnNlbGYgJHtwZXJzb25hbE51bWJlcn0uYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBpZiAoIWNpdGl6ZW5pZCkge1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgVGhpcyBudW1iZXIgaXMgbm90IHJlZ2lzdGVyZWQuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBjb25zdCBQbGF5ZXJEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9idXNpbmVzc191c2VycycsIHsgY2l0aXplbmlkOiBjaXRpemVuaWQgfSk7XG4gICAgaWYgKFBsYXllckRhdGEgJiYgIVBsYXllckRhdGEuam9iQ2FsbHMpIHtcbiAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFRoaXMgcGVyc29uIGhhcyBkaXNhYmxlZCBqb2IgY2FsbHMuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH0gZWxzZSBpZiAoUGxheWVyRGF0YSAmJiBQbGF5ZXJEYXRhLmpvYkNhbGxzKSB7XG4gICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOmNsaWVudDpidXNpbmVzc0NhbGwnLCBjbGllbnQsIG51bWJlcik7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Z2V0QmFua2JhbGFuY2UnLCBhc3luYyAoY2xpZW50LCBhY2NvdW50KSA9PiB7XG4gICAgY29uc3QgYmFsYW5jZSA9IGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmdldEFjY291bnRNb25leShhY2NvdW50KTtcbiAgICByZXR1cm4gYmFsYW5jZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdzdW1taXRfcGhvbmU6c2VydmVyOmRlcG9zaXRNb25leScsIGFzeW5jIChjbGllbnQsIGFtb3VudDogbnVtYmVyKSA9PiB7XG4gICAgXG4gICAgY29uc3Qgc3JjID0gY2xpZW50O1xuICAgIGNvbnN0IFBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc3JjKTtcbiAgICBjb25zdCBmdWxsbmFtZSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNyYyk7XG4gICAgY29uc3QgY2lkID0gUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkO1xuICAgIGNvbnN0IFBsYXllckpvYiA9IFBsYXllci5QbGF5ZXJEYXRhLmpvYjtcbiAgICBjb25zdCBhY2NvdW50ID0gUGxheWVySm9iLm5hbWU7XG4gICAgY29uc3QgYmFua2JhbGFuY2UgPSBhd2FpdCBQbGF5ZXIuUGxheWVyRGF0YS5tb25leS5iYW5rO1xuICAgIGlmIChiYW5rYmFsYW5jZSA8IGFtb3VudCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGF3YWl0IFBsYXllci5GdW5jdGlvbnMuUmVtb3ZlTW9uZXkoJ2JhbmsnLCBhbW91bnQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIERlcG9zaXQuXCIpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmFkZEFjY291bnRNb25leShhY2NvdW50LCBhbW91bnQpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGNpZCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgV2l0aGRyYXdcIiwgYW1vdW50LCBgU2VudCBmdW5kcyB0byAke1BsYXllckpvYi5sYWJlbH1gLCBhY2NvdW50LCBmdWxsbmFtZSwgXCJ3aXRoZHJhd1wiLCBnZW5lcmF0ZVVVaWQoKSlcbiAgICBhd2FpdCBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihhY2NvdW50LCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0XCIsIGFtb3VudCwgXCJEZXBvc2l0XCIsIGZ1bGxuYW1lLCBhY2NvdW50LCBcImRlcG9zaXRcIiwgZ2VuZXJhdGVVVWlkKCkpXG5cbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgdGl0bGU6ICdNb25leSBEZXBvc2l0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7ZnVsbG5hbWV9IGRlcG9zaXRlZCAkJHthbW91bnR9IHRvIGFjY291bnQgJHthY2NvdW50fS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjp3aXRoZHJhd01vbmV5JywgYXN5bmMgKGNsaWVudCwgYW1vdW50OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBzcmMgPSBjbGllbnQ7XG4gICAgY29uc3QgUGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzcmMpO1xuICAgIGNvbnN0IGZ1bGxuYW1lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc3JjKTtcbiAgICBjb25zdCBjaWQgPSBQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQ7XG4gICAgY29uc3QgUGxheWVySm9iID0gUGxheWVyLlBsYXllckRhdGEuam9iO1xuICAgIGNvbnN0IGFjY291bnQgPSBQbGF5ZXJKb2IubmFtZTtcbiAgICBjb25zdCBiYWxhbmNlID0gYXdhaXQgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uZ2V0QWNjb3VudE1vbmV5KGFjY291bnQpO1xuICAgIGlmIChiYWxhbmNlIDwgYW1vdW50KSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYXdhaXQgUGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGFtb3VudCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgV2l0aGRyYXcuXCIpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLnJlbW92ZUFjY291bnRNb25leShhY2NvdW50LCBhbW91bnQpO1xuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGNpZCwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgV2l0aGRyYXdcIiwgYW1vdW50LCBgUmVjaWV2ZWQgZnVuZHMgZnJvbSAke1BsYXllckpvYi5sYWJlbH1gLCBhY2NvdW50LCBmdWxsbmFtZSwgXCJkZXBvc2l0XCIsIGdlbmVyYXRlVVVpZCgpKVxuICAgIGF3YWl0IGV4cG9ydHNbJ1JlbmV3ZWQtQmFua2luZyddLmhhbmRsZVRyYW5zYWN0aW9uKGFjY291bnQsIFwiUGhvbmUgQnVzaW5lc3MgQXBwIFdpdGhkcmF3XCIsIGFtb3VudCwgXCJXaXRoZHJhd1wiLCBhY2NvdW50LCBmdWxsbmFtZSwgXCJ3aXRoZHJhd1wiLCBnZW5lcmF0ZVVVaWQoKSlcblxuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICB0aXRsZTogJ01vbmV5IFdpdGhkcmF3bicsXG4gICAgICAgIG1lc3NhZ2U6IGBQbGF5ZXIgJHtmdWxsbmFtZX0gd2l0aGRyZXcgJCR7YW1vdW50fSBmcm9tIGFjY291bnQgJHthY2NvdW50fS5gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpnZXRFbXBsb3llZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBzcmMgPSBjbGllbnQ7XG4gICAgY29uc3Qgam9ibmFtZSA9IGRhdGE7XG4gICAgY29uc3QgUGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzcmMpO1xuICAgIGNvbnN0IGlzQm9zcyA9IFBsYXllci5QbGF5ZXJEYXRhLmpvYi5pc2Jvc3M7XG4gICAgLyogICAgIFxuICAgICAgICBpZiAoIWlzQm9zcykge1xuICAgICAgICAgICAgcmV0dXJuIGV4cG9ydHNbJ3BzLWFkbWlubWVudSddLkJhblBsYXllcihzcmMsICdHZXRFbXBsb3llZXMgRXhwbG9pdGluZyAnLCAnc3VtbWl0X3Bob25lJyk7XG4gICAgICAgIH1cbiAgICAqL1xuICAgIGNvbnN0IHBsYXllcnM6IGFueSA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1QgY2l0aXplbmlkLCBjaGFyaW5mbywgam9iIEZST00gcGxheWVycyBXSEVSRSBqb2IgTElLRSA/JywgW2AlJHtqb2JuYW1lfSVgXSk7XG4gICAgY29uc3QgZW1wbG95ZWVzOiBhbnkgPSBbXTtcblxuICAgIGZvciAoY29uc3QgZGF0YSBvZiBwbGF5ZXJzKSB7XG4gICAgICAgIGxldCBjaGFyRGF0YSA9IHsgZmlyc3RuYW1lOiAnVW5rbm93bicsIGxhc3RuYW1lOiAnUGxheWVyJyB9O1xuICAgICAgICBsZXQgam9iRGF0YSA9IHsgbmFtZTogJ1Vua25vd24nLCBncmFkZTogMCwgaXNib3NzOiBmYWxzZSB9O1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5jaGFyaW5mbykgY2hhckRhdGEgPSBKU09OLnBhcnNlKGRhdGEuY2hhcmluZm8pO1xuICAgICAgICAgICAgaWYgKGRhdGEuam9iKSBqb2JEYXRhID0gSlNPTi5wYXJzZShkYXRhLmpvYik7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIExPR0dFUihgRmFpbGVkIHRvIHBhcnNlIEpvYiAke2pvYm5hbWV9IC8gY2hhcmluZm8gZm9yICQgJHtkYXRhLmNpdGl6ZW5pZH1gKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNPbmxpbmUgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoZGF0YS5jaXRpemVuaWQpO1xuICAgICAgICBpZiAoaXNPbmxpbmUgJiYgaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSA9PT0gam9ibmFtZSkge1xuICAgICAgICAgICAgZW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogaXNPbmxpbmUuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICAgICAgY3VySm9iOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5uYW1lLFxuICAgICAgICAgICAgICAgIGdyYWRlOiBpc09ubGluZS5QbGF5ZXJEYXRhLmpvYi5ncmFkZSxcbiAgICAgICAgICAgICAgICBpc2Jvc3M6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmlzYm9zcyxcbiAgICAgICAgICAgICAgICBuYW1lOiBgJHtpc09ubGluZS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtpc09ubGluZS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiAnb25saW5lJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbXBsb3llZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgZW1wU291cmNlOiBkYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgICAgICBjdXJKb2I6IGpvYkRhdGEubmFtZSxcbiAgICAgICAgICAgICAgICBncmFkZTogam9iRGF0YS5ncmFkZSxcbiAgICAgICAgICAgICAgICBpc2Jvc3M6IGpvYkRhdGEuaXNib3NzLFxuICAgICAgICAgICAgICAgIG5hbWU6IGAke2NoYXJEYXRhLmZpcnN0bmFtZX0gJHtjaGFyRGF0YS5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgIHN0YXR1czogJ29mZmxpbmUnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbXBsb3llZXMuc29ydCgoYTogYW55LCBiOiBhbnkpID0+IChiLmdyYWRlLmxldmVsIHx8IDApIC0gKGEuZ3JhZGUubGV2ZWwgfHwgMCkpO1xuXG4gICAgY29uc3QgbXVsdGlqb2JFbXBsb3llZXM6IGFueVtdID0gW107XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgbXVsdGlKb2JQbGF5ZXJzOiBhbnlbXSA9IChhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tdWx0aWpvYnMnLCB7IGpvYk5hbWU6IGpvYm5hbWUgfSkpIHx8IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3QgbXVsdGlKb2Igb2YgbXVsdGlKb2JQbGF5ZXJzKSB7XG4gICAgICAgICAgICBpZiAoIW11bHRpSm9iLmNpdGl6ZW5JZCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignU2tpcHBpbmcgaW52YWxpZCBtdWx0aWpvYiBlbnRyeTonLCBtdWx0aUpvYik7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGlzT25saW5lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKG11bHRpSm9iLmNpdGl6ZW5JZCk7XG4gICAgICAgICAgICBpZiAoIWlzT25saW5lKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGxheWVyRGF0YTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCBjaGFyaW5mbywgam9iIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW211bHRpSm9iLmNpdGl6ZW5JZF0pO1xuICAgICAgICAgICAgICAgIGlmICghcGxheWVyRGF0YSB8fCBwbGF5ZXJEYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYE5vIHBsYXllciBkYXRhIGZvdW5kIGZvciBvZmZsaW5lIGNpdGl6ZW5JZCAke211bHRpSm9iLmNpdGl6ZW5JZH1gKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBkYXRhIG9mIHBsYXllckRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGpvYkRhdGEsIGNoYXJEYXRhO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgam9iRGF0YSA9IGRhdGEuam9iID8gSlNPTi5wYXJzZShkYXRhLmpvYikgOiB7IG5hbWU6ICdVbmtub3duJywgZ3JhZGU6IDAsIGlzYm9zczogZmFsc2UgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYXJEYXRhID0gZGF0YS5jaGFyaW5mbyA/IEpTT04ucGFyc2UoZGF0YS5jaGFyaW5mbykgOiB7IGZpcnN0bmFtZTogJ1Vua25vd24nLCBsYXN0bmFtZTogJ1BsYXllcicgfTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHBhcnNlIGpvYi9jaGFyaW5mbyBmb3IgJHttdWx0aUpvYi5jaXRpemVuSWR9OmAsIGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKGpvYkRhdGEubmFtZSA9PT0gam9ibmFtZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIG11bHRpam9iRW1wbG95ZWVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZW1wU291cmNlOiBtdWx0aUpvYi5jaXRpemVuSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBjdXJKb2I6IGpvYkRhdGEubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGdyYWRlOiBqb2JEYXRhLmdyYWRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNib3NzOiBqb2JEYXRhLmlzYm9zcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGAke2NoYXJEYXRhLmZpcnN0bmFtZX0gJHtjaGFyRGF0YS5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnb2ZmbGluZSdcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSA9PT0gam9ibmFtZSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgbXVsdGlqb2JFbXBsb3llZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGVtcFNvdXJjZTogaXNPbmxpbmUuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICAgICAgICAgIGN1ckpvYjogaXNPbmxpbmUuUGxheWVyRGF0YS5qb2IubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgZ3JhZGU6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmdyYWRlLFxuICAgICAgICAgICAgICAgICAgICBpc2Jvc3M6IGlzT25saW5lLlBsYXllckRhdGEuam9iLmlzYm9zcyxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYCR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7aXNPbmxpbmUuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICdvbmxpbmUnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbXVsdGlqb2JFbXBsb3llZXMuc29ydCgoYSwgYikgPT4gKGIuZ3JhZGUgfHwgMCkgLSAoYS5ncmFkZSB8fCAwKSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHByb2Nlc3NpbmcgbXVsdGlqb2IgZW1wbG95ZWVzOicsIGVycik7XG4gICAgfVxuXG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZW1wbG95ZWVzOiBlbXBsb3llZXMubGVuZ3RoID4gMCA/IGVtcGxveWVlcyA6IFtdLFxuICAgICAgICBtdWx0aWpvYkVtcGxveWVlczogbXVsdGlqb2JFbXBsb3llZXMubGVuZ3RoID4gMCA/IG11bHRpam9iRW1wbG95ZWVzIDogW11cbiAgICB9KTtcbn0pO1xuXG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6aGlyZUVtcGxveWVlJywgYXN5bmMgKGNsaWVudCwgdGFyZ2V0U291cmNlOiBzdHJpbmcsIGpvYm5hbWU6IHN0cmluZykgPT4ge1xuICAgIGlmIChTdHJpbmcoY2xpZW50KSA9PT0gU3RyaW5nKHRhcmdldFNvdXJjZSkpIHtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdIaXJlIEZhaWxlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQXR0ZW1wdCB0byBoaXJlIHNlbGYgTmFtZTogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSwgaW4gSm9iOiAke2pvYm5hbWV9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgY2FuJ3QgaGlyZSB5b3Vyc2VsZi5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGlmIChhd2FpdCBEb2VzUGxheWVyRXhpc3QodGFyZ2V0U291cmNlKSkge1xuICAgICAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKGNsaWVudCk7XG4gICAgICAgIGlmICghcGxheWVyLlBsYXllckRhdGEuam9iLmlzYm9zcykge1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ0hpcmUgRmFpbGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQXR0ZW1wdCB0byBoaXJlIHdpdGhvdXQgYmVpbmcgYSBib3NzIE5hbWU6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0sIGluIEpvYjogJHtqb2JuYW1lfSwgQ2l0aXplbklkOiAke3BsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZH1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIGNsaWVudCwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBhcmUgbm90IGEgYm9zcy5gLFxuICAgICAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcih0YXJnZXRTb3VyY2UpO1xuICAgICAgICB0YXJnZXRQbGF5ZXIuRnVuY3Rpb25zLlNldEpvYihqb2JuYW1lLCAwKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfYnVzaW5lc3MnLFxuICAgICAgICAgICAgdGl0bGU6ICdFbXBsb3llZSBIaXJlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgUGxheWVyICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkfSBOYW1lOiAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGlyZWQgYnkgUGxheWVyOiAke2V4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9LCBpbiBKb2I6ICR7am9ibmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgaGlyZWQgJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IHRvICR7am9ibmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXRTb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBiZWVuIGhpcmVkIHRvICR7am9ibmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0KCdzdW1taXRfcGhvbmU6c2VydmVyOmhpcmVpbk11bHRpSm9iJywgdGFyZ2V0U291cmNlLCBqb2JuYW1lLCAwLCBGcmFtZXdvcmsuU2hhcmVkLkpvYnNbam9ibmFtZV0ubGFiZWwsIEZyYW1ld29yay5TaGFyZWQuSm9ic1tqb2JuYW1lXS5ncmFkZXNbJzAnXS5sYWJlbCk7XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBjbGllbnQsIGpvYm5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2J1c2luZXNzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSGlyZSBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gaGlyZSBub24tZXhpc3RlbnQgcGxheWVyIE5hbWU6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0sIGluIEpvYjogJHtqb2JuYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBQbGF5ZXIgaXMgbm90IG9ubGluZS5gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgfVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2dldEluZGV4T2ZBbGxKb2JzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGpvYnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdzdW1taXRfam9icycsIHt9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoam9icy5tYXAoKGpvYjogYW55KSA9PiBqb2IuX2lkKSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncmVnaXN0ZXJKb2JzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgam9icyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3N1bW1pdF9qb2JzJywgam9icyk7XG4gICAgY29uc3QgeyBfaWQsIC4uLnJlc3QgfSA9IGpvYnM7XG4gICAgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkFkZEpvYihfaWQsIHJlc3QpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfam9icycsXG4gICAgICAgIHRpdGxlOiAnSm9iIFJlZ2lzdGVyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTmV3IGpvYiAnJHtfaWR9JyBOYW1lOiAke2pvYnMuam9iTmFtZX0gcmVnaXN0ZXJlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0Sm9iRGF0YScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnc3VtbWl0X2pvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoam9iKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd1cGRhdGVKb2JzJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgam9icyA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGpvYnMuX2lkIH0sIGpvYnMpO1xuICAgIGNvbnN0IHsgX2lkLCAuLi5yZXN0IH0gPSBqb2JzO1xuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5VcGRhdGVKb2IoX2lkLCByZXN0KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2pvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBVcGRhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEpvYiAnJHtfaWR9JyBOYW1lOiAke2pvYnMuam9iTmFtZX0gdXBkYXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZGVsZXRlSm9icycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGpvYiA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgnc3VtbWl0X2pvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBpZiAoIWpvYikge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdzdW1taXRfam9icycsXG4gICAgICAgICAgICB0aXRsZTogJ0pvYiBEZWxldGlvbiBGYWlsZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYEF0dGVtcHQgdG8gZGVsZXRlIG5vbi1leGlzdGVudCBqb2IgJyR7ZGF0YX0nIGJ5IFBsYXllcjogJHtleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogXCJTeXN0ZW1cIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgSm9iIGRvZXMgbm90IGV4aXN0LmAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICB9XG4gICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3N1bW1pdF9qb2JzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLlJlbW92ZUpvYihkYXRhKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2pvYnMnLFxuICAgICAgICB0aXRsZTogJ0pvYiBEZWxldGVkJyxcbiAgICAgICAgbWVzc2FnZTogYEpvYiAnJHtkYXRhfScgTmFtZTogJHtqb2Iuam9iTmFtZX0gZGVsZXRlZCBieSBQbGF5ZXI6ICR7ZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnc3VtbWl0X3Bob25lOnNlcnZlcjpnZXRCdXNpbmVzc0VtcGxveWVlc051bWJlcnMnLCBhc3luYyAoY2xpZW50OiBudW1iZXIsIGpvYjogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgW3BsYXllcnNdID0gYXdhaXQgRnJhbWV3b3JrLkZ1bmN0aW9ucy5HZXRQbGF5ZXJzT25EdXR5KGpvYik7XG4gICAgbGV0IG51bWJlcnM6IG51bWJlcltdID0gW107XG4gICAgZm9yIChjb25zdCBwbGF5ZXIgb2YgcGxheWVycykge1xuICAgICAgICBjb25zdCBudW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKHBsYXllcik7XG4gICAgICAgIG51bWJlcnMucHVzaChOdW1iZXIobnVtYmVyKSk7XG4gICAgfVxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShudW1iZXJzKTtcbn0pIiwgImltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRnJhbWV3b3JrLCBNb25nb0RCLCBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxub25OZXQoJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6ZmlyZUVtcGxveWVlJywgYXN5bmMgKGNpdGl6ZW5JZDogc3RyaW5nKSA9PiB7XG4gICAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBjb25zdCB0YXJnZXREYXRhID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpdGl6ZW5JZCk7XG4gICAgaWYgKHRhcmdldERhdGEpIHtcbiAgICAgICAgY29uc3Qgam9ibmFtZSA9IHRhcmdldERhdGEuUGxheWVyRGF0YS5qb2IubmFtZTtcbiAgICAgICAgYXdhaXQgdGFyZ2V0RGF0YS5GdW5jdGlvbnMuU2V0Sm9iKCd1bmVtcGxveWVkJywgMCk7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogY2l0aXplbklkLCBqb2JOYW1lOiBqb2JuYW1lIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBmaXJlZCAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGJlZW4gZmlyZWQgYnkgJHtnbG9iYWwuc291cmNlfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgam9ibmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2VtcGxveWVlX2FjdGlvbicsXG4gICAgICAgICAgICB0aXRsZTogJ0VtcGxveWVlIEZpcmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7dGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBoYXMgYmVlbiBmaXJlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgQ2l0aXplbklkOiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaXRpemVuaWR9IHwgSm9iOiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5qb2IubmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBwbGF5ZXJEYXRhOiBhbnkgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIGpvYiBGUk9NIHBsYXllcnMgV0hFUkUgY2l0aXplbmlkID0gPyBMSU1JVCAxJywgW2NpdGl6ZW5JZF0pO1xuICAgICAgICBjb25zdCBqb2JEYXRhID0gSlNPTi5wYXJzZShwbGF5ZXJEYXRhWzBdLmpvYik7XG5cbiAgICAgICAgbGV0IGpvYjogYW55ID0ge307XG4gICAgICAgIGpvYi5uYW1lID0gJ3VuZW1wbG95ZWQnXG4gICAgICAgIGpvYi5sYWJlbCA9IEZyYW1ld29yay5TaGFyZWQuSm9ic1sndW5lbXBsb3llZCddLmxhYmVsXG4gICAgICAgIGpvYi5wYXltZW50ID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10uZ3JhZGVzWycwJ10ucGF5bWVudFxuICAgICAgICBqb2Iub25kdXR5ID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10uZGVmYXVsdER1dHlcbiAgICAgICAgam9iLmlzYm9zcyA9IGZhbHNlXG4gICAgICAgIGpvYi5ncmFkZSA9IHt9XG4gICAgICAgIGpvYi5ncmFkZS5uYW1lID0gRnJhbWV3b3JrLlNoYXJlZC5Kb2JzWyd1bmVtcGxveWVkJ10uZ3JhZGVzWycwJ10ubmFtZVxuICAgICAgICBqb2IuZ3JhZGUubGV2ZWwgPSAwXG4gICAgICAgIGF3YWl0IFV0aWxzLnF1ZXJ5KCdVUERBVEUgcGxheWVycyBTRVQgam9iID0gPyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW0pTT04uc3RyaW5naWZ5KGpvYiksIGNpdGl6ZW5JZF0pO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGNpdGl6ZW5JZCwgam9iTmFtZTogam9iRGF0YS5uYW1lIH0pO1xuICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgc291cmNlLCBqb2JEYXRhLm5hbWUpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9lbXBsb3llZV9hY3Rpb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdPZmZsaW5lIEVtcGxveWVlIEZpcmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBPZmZsaW5lIGVtcGxveWVlICR7Y2l0aXplbklkfSBoYXMgYmVlbiBmaXJlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgSm9iOiAke2pvYkRhdGEubmFtZX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9XG59KTtcblxub25OZXQoJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Y2hhbmdlUmFua09mUGxheWVyJywgYXN5bmMgKGRhdGE6IGFueSkgPT4ge1xuICAgIGNvbnN0IHNvdXJjZSA9IGdsb2JhbC5zb3VyY2U7XG4gICAgY29uc3QgdGFyZ2V0RGF0YSA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJCeUNpdGl6ZW5JZChkYXRhLnRhcmdldENpdGl6ZW5pZCk7XG4gICAgY29uc3QgbXVsdGlKb2IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX211bHRpam9icycsIHsgY2l0aXplbklkOiBkYXRhLnRhcmdldENpdGl6ZW5pZCwgam9iTmFtZTogZGF0YS5qb2JOYW1lIH0pO1xuICAgIGlmICh0YXJnZXREYXRhKSB7XG4gICAgICAgIGNvbnN0IGpvYm5hbWUgPSBkYXRhLmpvYk5hbWU7XG4gICAgICAgIHRhcmdldERhdGEuRnVuY3Rpb25zLlNldEpvYihqb2JuYW1lLCBkYXRhLmtleSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIGNoYW5nZWQgdGhlIHJhbmsgb2YgJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICAgICAgYXBwOiBcInNlcnZpY2VzXCIsXG4gICAgICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgICAgICB9KSk7XG4gICAgICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3VyIHJhbmsgaGFzIGJlZW4gY2hhbmdlZCBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9YCxcbiAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgICAgICBpZiAobXVsdGlKb2IpIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSB9LCB7IGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIFVwZGF0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiB1cGRhdGVkIHRvICR7ZGF0YS5qb2JOYW1lfSB8IE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgY2l0aXplbklkOiAke2F3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSl9YCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZ2VuZXJhdGVVVWlkKCksIGNpdGl6ZW5JZDogZGF0YS50YXJnZXRDaXRpemVuaWQsIGpvYk5hbWU6IGRhdGEuam9iTmFtZSwgZ3JhZGVMZXZlbDogZGF0YS5rZXksIGdyYWRlTGFiZWw6IGRhdGEuZ3JhZGVOYW1lIH0pO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdNdWx0aS1Kb2IgQWRkZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke2RhdGEudGFyZ2V0Q2l0aXplbmlkfSBoYXMgYmVlbiBhZGRlZCB0byAke2RhdGEuam9iTmFtZX0gfCBOZXcgUmFuazogJHtkYXRhLmdyYWRlTmFtZX0gYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IGNpdGl6ZW5JZDogJHthd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgam9ibmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX2VtcGxveWVlX2FjdGlvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1JhbmsgQ2hhbmdlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHt0YXJnZXREYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIGJlZW4gZ2l2ZW4gYSBuZXcgcmFuayBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKHNvdXJjZSl9IHwgQ2l0aXplbklkOiAke3RhcmdldERhdGEuUGxheWVyRGF0YS5jaXRpemVuaWR9IHwgSm9iOiAke2pvYm5hbWV9IHwgIE5ldyBSYW5rOiAke2RhdGEuZ3JhZGVOYW1lfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHBsYXllckRhdGE6IGFueSA9IGF3YWl0IFV0aWxzLnF1ZXJ5KCdTRUxFQ1Qgam9iIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/IExJTUlUIDEnLCBbZGF0YS50YXJnZXRDaXRpemVuaWRdKTtcbiAgICAgICAgY29uc3Qgam9iRGF0YSA9IEpTT04ucGFyc2UocGxheWVyRGF0YVswXS5qb2IpO1xuICAgICAgICBqb2JEYXRhLmdyYWRlLmxldmVsID0gZGF0YS5rZXk7XG4gICAgICAgIGpvYkRhdGEuZ3JhZGUubmFtZSA9IGRhdGEuZ3JhZGVOYW1lO1xuICAgICAgICBhd2FpdCBVdGlscy5xdWVyeSgnVVBEQVRFIHBsYXllcnMgU0VUIGpvYiA9ID8gV0hFUkUgY2l0aXplbmlkID0gPycsIFtKU09OLnN0cmluZ2lmeShqb2JEYXRhKSwgZGF0YS50YXJnZXRDaXRpemVuaWRdKTtcbiAgICAgICAgaWYgKG11bHRpSm9iKSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUgfSwgeyBncmFkZUxldmVsOiBkYXRhLmtleSwgZ3JhZGVMYWJlbDogZGF0YS5ncmFkZU5hbWUgfSk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfbXVsdGlfam9iJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBVcGRhdGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtkYXRhLnRhcmdldENpdGl6ZW5pZH0gaGFzIGJlZW4gdXBkYXRlZCB0byAke2RhdGEuam9iTmFtZX0gfCBOZXcgUmFuazogJHtkYXRhLmdyYWRlTmFtZX0gYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IGNpdGl6ZW5JZDogJHthd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBfaWQ6IGdlbmVyYXRlVVVpZCgpLCBjaXRpemVuSWQ6IGRhdGEudGFyZ2V0Q2l0aXplbmlkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUsIGdyYWRlTGV2ZWw6IGRhdGEua2V5LCBncmFkZUxhYmVsOiBkYXRhLmdyYWRlTmFtZSB9KTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIEFkZGVkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtkYXRhLnRhcmdldENpdGl6ZW5pZH0gaGFzIGJlZW4gYWRkZWQgdG8gJHtkYXRhLmpvYk5hbWV9IHwgTmV3IFJhbms6ICR7ZGF0YS5ncmFkZU5hbWV9IGJ5ICR7YXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKX0gfCBjaXRpemVuSWQ6ICR7YXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKX1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGVtaXROZXQoJ3N1bW1pdF9waG9uZTpjbGllbnQ6cmVmcmVzaEVtcERhdGEnLCBzb3VyY2UsIGpvYkRhdGEubmFtZSk7XG4gICAgfVxufSk7XG5cbm9uTmV0KCdzdW1taXRfcGhvbmU6c2VydmVyOmZpcmVJbmFjdGl2ZUVtcGxveWVlJywgYXN5bmMgKGRhdGE6IHsgam9iTmFtZTogc3RyaW5nLCBjaXRpemVuSWQ6IHN0cmluZyB9KSA9PiB7XG4gICAgY29uc3Qgc291cmNlID0gZ2xvYmFsLnNvdXJjZTtcbiAgICBhd2FpdCBNb25nb0RCLmRlbGV0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IGRhdGEuY2l0aXplbklkLCBqb2JOYW1lOiBkYXRhLmpvYk5hbWUgfSk7XG4gICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgZmlyZWQgYW4gaW5hY3RpdmUgZW1wbG95ZWVgLFxuICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICB9KSk7XG4gICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIHNvdXJjZSwgZGF0YS5qb2JOYW1lKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2VtcGxveWVlX2FjdGlvbicsXG4gICAgICAgIHRpdGxlOiAnSW5hY3RpdmUgRW1wbG95ZWUgRmlyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgSW5hY3RpdmUgZW1wbG95ZWUgJHtkYXRhLmNpdGl6ZW5JZH0gaGFzIGJlZW4gZmlyZWQgYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2UpfSB8IEpvYjogJHtkYXRhLmpvYk5hbWV9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xufSk7XG5cbm9uKCdzdW1taXRfcGhvbmU6c2VydmVyOmhpcmVpbk11bHRpSm9iJywgYXN5bmMgKGNsaWVudDogbnVtYmVyLCBqb2JuYW1lOiBzdHJpbmcsIGdyYWRlTGV2ZWw6IG51bWJlciwgam9iTGFiZWw6IHN0cmluZywgZ3JhZGVMYWJlbDogc3RyaW5nKSA9PiB7XG4gICAgLyogY29uc29sZS5sb2coJ0hpcmluZyBpbiBtdWx0aSBqb2I6Jywgam9ibmFtZSwgZ3JhZGVMZXZlbCwgam9iTGFiZWwsIGdyYWRlTGFiZWwpOyAqL1xuICAgIGNvbnN0IHRhcmdldENpZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgbXVsdGlKb2JDaGVjayA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpZCwgam9iTmFtZTogam9ibmFtZSB9KTtcbiAgICBpZiAobXVsdGlKb2JDaGVjaykge1xuICAgICAgICBpZiAobXVsdGlKb2JDaGVjay5ncmFkZUxldmVsICE9PSBncmFkZUxldmVsKSB7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IHRhcmdldENpZCwgam9iTmFtZTogam9ibmFtZSB9LCB7IGdyYWRlTGV2ZWwsIGdyYWRlTGFiZWwgfSk7XG4gICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiU3lzdGVtXCIsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBiZWVuIGhpcmVkIGluIGEgbmV3IHJhbms6ICR7Z3JhZGVMYWJlbH1gLFxuICAgICAgICAgICAgICAgIGFwcDogXCJzZXJ2aWNlc1wiLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBlbWl0TmV0KCdzdW1taXRfcGhvbmU6Y2xpZW50OnJlZnJlc2hFbXBEYXRhJywgY2xpZW50LCBqb2JuYW1lKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aV9qb2InLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTXVsdGktSm9iIFVwZGF0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGAke3RhcmdldENpZH0gaGFzIGJlZW4gdXBkYXRlZCB0byAke2pvYm5hbWV9IHwgTmV3IFJhbms6ICR7Z3JhZGVMYWJlbH0gYnkgJHthd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSB8IGNpdGl6ZW5JZDogJHthd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZW1pdE5ldCgnUUJDb3JlOk5vdGlmeScsIGNsaWVudCwgJ1lvdSBhcmUgYWxyZWFkeSBpbiB0aGlzIGpvYiB3aXRoIHRoaXMgZ3JhZGUgbGV2ZWwnLCAnZXJyb3InKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZ2VuZXJhdGVVVWlkKCksIGNpdGl6ZW5JZDogdGFyZ2V0Q2lkLCBqb2JOYW1lOiBqb2JuYW1lLCAgZ3JhZGVMZXZlbDogZ3JhZGVMZXZlbCwgam9iTGFiZWw6IGpvYkxhYmVsLCBncmFkZUxhYmVsOiBncmFkZUxhYmVsIH0pO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBjbGllbnQsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgaGF2ZSBiZWVuIGhpcmVkIGluIGEgbmV3IGpvYjogJHtqb2JMYWJlbH0gYXMgJHtncmFkZUxhYmVsfWAsXG4gICAgICAgICAgICBhcHA6IFwic2VydmljZXNcIixcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDAsXG4gICAgICAgIH0pKTtcbiAgICAgICAgZW1pdE5ldCgnc3VtbWl0X3Bob25lOmNsaWVudDpyZWZyZXNoRW1wRGF0YScsIGNsaWVudCwgam9ibmFtZSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpX2pvYicsXG4gICAgICAgICAgICB0aXRsZTogJ011bHRpLUpvYiBBZGRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgJHt0YXJnZXRDaWR9IGhhcyBiZWVuIGFkZGVkIHRvICR7am9ibmFtZX0gfCBOZXcgUmFuazogJHtncmFkZUxhYmVsfSBieSAke2F3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IHwgY2l0aXplbklkOiAke2F3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCl9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgfVxufSlcblxuc2V0SW1tZWRpYXRlKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBqb2JBcnJheTogYW55ID0ge307XG4gICAgY29uc3Qgam9iRGF0YSA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ3N1bW1pdF9qb2JzJywge30pO1xuICAgIGpvYkRhdGEuZm9yRWFjaChhc3luYyAoam9iOiBhbnkpID0+IHtcbiAgICAgICAgY29uc3QgeyBfaWQsIC4uLnJlc3QgfSA9IGpvYjtcbiAgICAgICAgTE9HR0VSKGBbU1VNTUlUX1BIT05FXSBDcmVhdGVkIGpvYiAke19pZH0gU3VjY2Vzc2Z1bGx5YCk7XG4gICAgICAgIGpvYkFycmF5W19pZF0gPSByZXN0O1xuICAgIH0pO1xuICAgIC8qIGNvbnN0IFt1cGRhdGVkLCBtZXNzYWdlXSA9IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5BZGRKb2JzKGpvYkFycmF5KTsgKi9cbn0pOyAiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IE1vbmdvREIsIExvZ2dlciB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IFBob25lTWFpbCwgUGhvbmVQbGF5ZXJDYXJkIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBTZXR0aW5ncyB9IGZyb20gXCIuL2NsYXNzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ0dldENsaWVudFNldHRpbmdzJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgYXdhaXQgU2V0dGluZ3MuZW5zdXJlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBfaWQ6IFNldHRpbmdzLl9pZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgYmFja2dyb3VuZDogU2V0dGluZ3MuYmFja2dyb3VuZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgbG9ja3NjcmVlbjogU2V0dGluZ3MubG9ja3NjcmVlbi5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgcmluZ3RvbmU6IFNldHRpbmdzLnJpbmd0b25lLmdldChjaXRpemVuSWQpLFxuICAgICAgICBzaG93U3RhcnR1cFNjcmVlbjogU2V0dGluZ3Muc2hvd1N0YXJ0dXBTY3JlZW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHNob3dOb3RpZmljYXRpb25zOiBTZXR0aW5ncy5zaG93Tm90aWZpY2F0aW9ucy5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgaXNMb2NrOiBTZXR0aW5ncy5pc0xvY2suZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGxvY2tQaW46IFNldHRpbmdzLmxvY2tQaW4uZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHVzZVBpbjogU2V0dGluZ3MudXNlUGluLmdldChjaXRpemVuSWQpLFxuICAgICAgICB1c2VGYWNlSWQ6IFNldHRpbmdzLnVzZUZhY2VJZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgZmFjZUlkSWRlbnRpZmllcjogU2V0dGluZ3MuZmFjZUlkSWRlbnRpZmllci5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgc21ydElkOiBTZXR0aW5ncy5zbXJ0SWQuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogU2V0dGluZ3MuZGFya01haWxJZEF0dGFjaGVkLmdldChjaXRpemVuSWQpLFxuICAgICAgICBzbXJ0UGFzc3dvcmQ6IFNldHRpbmdzLnNtcnRQYXNzd29yZC5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgaXNGbGlnaHRNb2RlOiBTZXR0aW5ncy5pc0ZsaWdodE1vZGUuZ2V0KGNpdGl6ZW5JZCksXG4gICAgICAgIHBob25lTnVtYmVyOiBTZXR0aW5ncy5waG9uZU51bWJlci5nZXQoY2l0aXplbklkKSxcbiAgICAgICAgcGlnZW9uSWRBdHRhY2hlZDogU2V0dGluZ3MucGlnZW9uSWRBdHRhY2hlZC5nZXQoY2l0aXplbklkKSxcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdTZXRDbGllbnRTZXR0aW5ncycsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgYXdhaXQgU2V0dGluZ3MuZW5zdXJlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBjb25zdCBwYXJzZWREYXRhOiB7XG4gICAgICAgIGJhY2tncm91bmQ6IHsgY3VycmVudDogc3RyaW5nOyB3YWxscGFwZXJzOiBzdHJpbmdbXSB9O1xuICAgICAgICBsb2Nrc2NyZWVuOiB7IGN1cnJlbnQ6IHN0cmluZzsgd2FsbHBhcGVyczogc3RyaW5nW10gfTtcbiAgICAgICAgcmluZ3RvbmU6IHsgY3VycmVudDogc3RyaW5nOyByaW5ndG9uZXM6IHsgbmFtZTogc3RyaW5nLCB1cmw6IHN0cmluZyB9W10gfTtcbiAgICAgICAgc2hvd1N0YXJ0dXBTY3JlZW46IGJvb2xlYW47XG4gICAgICAgIHNob3dOb3RpZmljYXRpb25zOiBib29sZWFuO1xuICAgICAgICBpc0xvY2s6IGJvb2xlYW47XG4gICAgICAgIGxvY2tQaW46IHN0cmluZztcbiAgICAgICAgdXNlUGluOiBib29sZWFuO1xuICAgICAgICB1c2VGYWNlSWQ6IGJvb2xlYW47XG4gICAgICAgIGZhY2VJZElkZW50aWZpZXI6IHN0cmluZztcbiAgICAgICAgc21ydElkOiBzdHJpbmc7XG4gICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogc3RyaW5nO1xuICAgICAgICBzbXJ0UGFzc3dvcmQ6IHN0cmluZztcbiAgICAgICAgaXNGbGlnaHRNb2RlOiBib29sZWFuO1xuICAgICAgICBwaG9uZU51bWJlcjogc3RyaW5nO1xuICAgICAgICBwaWdlb25JZEF0dGFjaGVkOiBzdHJpbmc7XG4gICAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgU2V0dGluZ3MuYmFja2dyb3VuZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmJhY2tncm91bmQpO1xuICAgIFNldHRpbmdzLmxvY2tzY3JlZW4uc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5sb2Nrc2NyZWVuKTtcbiAgICBTZXR0aW5ncy5yaW5ndG9uZS5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnJpbmd0b25lKTtcbiAgICBTZXR0aW5ncy5zaG93U3RhcnR1cFNjcmVlbi5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnNob3dTdGFydHVwU2NyZWVuKTtcbiAgICBTZXR0aW5ncy5zaG93Tm90aWZpY2F0aW9ucy5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnNob3dOb3RpZmljYXRpb25zKTtcbiAgICBTZXR0aW5ncy5pc0xvY2suc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5pc0xvY2spO1xuICAgIFNldHRpbmdzLmxvY2tQaW4uc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5sb2NrUGluKTtcbiAgICBTZXR0aW5ncy51c2VQaW4uc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS51c2VQaW4pO1xuICAgIFNldHRpbmdzLnVzZUZhY2VJZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnVzZUZhY2VJZCk7XG4gICAgU2V0dGluZ3MuZmFjZUlkSWRlbnRpZmllci5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmZhY2VJZElkZW50aWZpZXIpO1xuICAgIFNldHRpbmdzLnNtcnRJZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnNtcnRJZCk7XG4gICAgU2V0dGluZ3Muc21ydFBhc3N3b3JkLnNldChjaXRpemVuSWQsIHBhcnNlZERhdGEuc21ydFBhc3N3b3JkKTtcbiAgICBTZXR0aW5ncy5pc0ZsaWdodE1vZGUuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5pc0ZsaWdodE1vZGUpO1xuICAgIFNldHRpbmdzLmRhcmtNYWlsSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLmRhcmtNYWlsSWRBdHRhY2hlZCk7XG4gICAgU2V0dGluZ3MucGhvbmVOdW1iZXIuc2V0KGNpdGl6ZW5JZCwgcGFyc2VkRGF0YS5waG9uZU51bWJlcik7XG4gICAgU2V0dGluZ3MucGlnZW9uSWRBdHRhY2hlZC5zZXQoY2l0aXplbklkLCBwYXJzZWREYXRhLnBpZ2VvbklkQXR0YWNoZWQpO1xuICAgIGF3YWl0IFNldHRpbmdzLlNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICB0eXBlOiAncGhvbmVfc2V0dGluZ3MnLFxuICAgICAgICB0aXRsZTogJ1NldHRpbmdzIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtjaXRpemVuSWR9IHwgTmFtZTogJHtnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoY2xpZW50KX0gbmV3IHNldHRpbmdzLCAke0pTT04uc3RyaW5naWZ5KHBhcnNlZERhdGEpfWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdSZWdpc3Rlck5ld01haWxBY2NvdW50JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YToge1xuICAgICAgICBlbWFpbDogc3RyaW5nO1xuICAgICAgICBwYXNzd29yZDogc3RyaW5nO1xuICAgIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IGRhdGFYOiBQaG9uZU1haWwgPSB7XG4gICAgICAgIGFjdGl2ZU1haWRJZDogcGFyc2VkRGF0YS5lbWFpbCxcbiAgICAgICAgdXNlcm5hbWU6IHBhcnNlZERhdGEuZW1haWwsXG4gICAgICAgIGFjdGl2ZU1haWxQYXNzd29yZDogcGFyc2VkRGF0YS5wYXNzd29yZCxcbiAgICAgICAgYXZhdG9yOiAnJyxcbiAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgIH1cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbWFpbCcsIHsgX2lkOiBwYXJzZWREYXRhLmVtYWlsLCAuLi5kYXRhWCB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2VtYWlsJyxcbiAgICAgICAgdGl0bGU6ICdFbWFpbCBBY2NvdW50IFJlZ2lzdGVyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgTmV3IGVtYWlsIGFjY291bnQgcmVnaXN0ZXJlZCB3aXRoIGVtYWlsICR7cGFyc2VkRGF0YS5lbWFpbH0sIHBhc3N3b3JkIFwiJHtwYXJzZWREYXRhLnBhc3N3b3JkfVwiLCBDaXRpemVuSWQ6ICR7YXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KX0sIE5hbWU6ICR7Z2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnU2VhcmNoRW1haWwnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9tYWlsJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnTG9naW5NYWlsQWNjb3VudCcsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBhcnNlZERhdGE6IHtcbiAgICAgICAgZW1haWw6IHN0cmluZztcbiAgICAgICAgcGFzc3dvcmQ6IHN0cmluZztcbiAgICB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX21haWwnLCB7IF9pZDogcGFyc2VkRGF0YS5lbWFpbCB9KTtcbiAgICBpZiAocmVzLmFjdGl2ZU1haWxQYXNzd29yZCA9PT0gcGFyc2VkRGF0YS5wYXNzd29yZCkge1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9lbWFpbCcsXG4gICAgICAgICAgICB0aXRsZTogJ0VtYWlsIExvZ2luJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke2F3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCl9IE5hbWU6ICR7Z2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXJOYW1lKGNsaWVudCl9IGxvZ2dlZCBpbiB0byBlbWFpbCBhY2NvdW50ICR7cGFyc2VkRGF0YS5lbWFpbH0sIHBhc3N3b3JkIFwiJHtwYXJzZWREYXRhLnBhc3N3b3JkfVwiYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygndW5Mb2Nrb3JMb2NrUGhvbmUnLCBhc3luYyAoY2xpZW50LCBkYXRhOiBib29sZWFuKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBTZXR0aW5ncy5pc0xvY2suc2V0KGNpdGl6ZW5JZCwgZGF0YSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0UGhvbmVQbGF5ZXJDYXJkJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9wbGF5ZXJfY2FyZCcsIHsgX2lkOiBjaXRpemVuSWQgfSk7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncGhvbmU6dXBkYXRlUGVyc29uYWxDYXJkJywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcGFyc2VkRGF0YTogUGhvbmVQbGF5ZXJDYXJkID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfcGxheWVyX2NhcmQnLCB7IF9pZDogcGFyc2VkRGF0YS5faWQgfSwgcGFyc2VkRGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9wZXJzb25hbF9jYXJkJyxcbiAgICAgICAgdGl0bGU6ICdQZXJzb25hbCBDYXJkIFVwZGF0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtwYXJzZWREYXRhLl9pZH0gfCBOYW1lOiAke2dsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShjbGllbnQpfSB1cGRhdGVkIHBlcnNvbmFsIGNhcmQsICR7SlNPTi5zdHJpbmdpZnkocGFyc2VkRGF0YSl9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG4iLCAiaW1wb3J0IHsgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi9jbGFzc1wiO1xuaW1wb3J0IHsgdHJpZ2dlckNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuXG5SZWdpc3RlckNvbW1hbmQoJ3NhdmVTZXR0aW5ncycsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICBhd2FpdCBTZXR0aW5ncy5zYXZlKCk7XG59LCB0cnVlKTtcblxuY29uc3QgZ2VuZXJhdGVQaG9uZU51bWJlciA9IGFzeW5jICgpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICAgIGNvbnN0IG51bWJlciA9IGA1NTkke01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwXzAwMF8wMDApLnRvU3RyaW5nKCkucGFkU3RhcnQoNywgXCIwXCIpfWA7XG4gICAgY29uc3QgZXhpc3RzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9udW1iZXJzJywgeyBudW1iZXI6IG51bWJlciB9KTtcbiAgICBpZiAoZXhpc3RzKSByZXR1cm4gZ2VuZXJhdGVQaG9uZU51bWJlcigpO1xuICAgIHJldHVybiBudW1iZXI7XG59O1xuXG5hc3luYyBmdW5jdGlvbiBHZW5lcmF0ZVBsYXllclBob25lTnVtYmVyKGNpdGl6ZW5JZDogc3RyaW5nLCBzb3VyY2U6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuICAgIGNvbnN0IG51bWJlciA9IGF3YWl0IGdlbmVyYXRlUGhvbmVOdW1iZXIoKTtcbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfbnVtYmVycycsIHtcbiAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgb3duZXI6IGNpdGl6ZW5JZCxcbiAgICAgICAgbnVtYmVyOiBudW1iZXIsXG4gICAgfSk7XG5cbiAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfc2V0dGluZ3MnLCB7XG4gICAgICAgIF9pZDogY2l0aXplbklkLFxuICAgICAgICBiYWNrZ3JvdW5kOiB7XG4gICAgICAgICAgICBjdXJyZW50OiAnJyxcbiAgICAgICAgICAgIHdhbGxwYXBlcnM6IFtdLFxuICAgICAgICB9LFxuICAgICAgICBsb2Nrc2NyZWVuOiB7XG4gICAgICAgICAgICBjdXJyZW50OiAnJyxcbiAgICAgICAgICAgIHdhbGxwYXBlcnM6IFtdLFxuICAgICAgICB9LFxuICAgICAgICByaW5ndG9uZToge1xuICAgICAgICAgICAgY3VycmVudDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLFxuICAgICAgICAgICAgcmluZ3RvbmVzOiBbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGVmYXVsdCcsXG4gICAgICAgICAgICAgICAgICAgIHVybDogJ2h0dHBzOi8vaWduaXMtcnAuY29tL3VwbG9hZHMvc2VydmVyL3Bob25lL3NvdW5kcy9pUGhvbmVYVHJhcC5tcDMnLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHNob3dTdGFydHVwU2NyZWVuOiB0cnVlLFxuICAgICAgICBzaG93Tm90aWZpY2F0aW9uczogdHJ1ZSxcbiAgICAgICAgaXNMb2NrOiB0cnVlLFxuICAgICAgICBsb2NrUGluOiAnJyxcbiAgICAgICAgdXNlUGluOiB0cnVlLFxuICAgICAgICBwaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgICB1c2VGYWNlSWQ6IGZhbHNlLFxuICAgICAgICBmYWNlSWRJZGVudGlmaWVyOiBjaXRpemVuSWQsXG4gICAgICAgIGRhcmtNYWlsSWRBdHRhY2hlZDogJycsXG4gICAgICAgIHBpZ2VvbklkQXR0YWNoZWQ6ICcnLFxuICAgICAgICBzbXJ0SWQ6ICcnLFxuICAgICAgICBzbXJ0UGFzc3dvcmQ6ICcnLFxuICAgICAgICBpc0ZsaWdodE1vZGU6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX3BsYXllcl9jYXJkJywge1xuICAgICAgICBfaWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgZmlyc3ROYW1lOiAnU2V0dXAnLFxuICAgICAgICBsYXN0TmFtZTogJ0NhcmQnLFxuICAgICAgICBwaG9uZU51bWJlcjogbnVtYmVyLFxuICAgICAgICBlbWFpbDogJycsXG4gICAgICAgIG5vdGVzOiAnJyxcbiAgICAgICAgYXZhdGFyOiAnJyxcbiAgICB9KTtcbiAgICBTZXR0aW5ncy5SZWdpc3Rlck5ld1NldHRpbmdzKGNpdGl6ZW5JZCwgbnVtYmVyKTtcblx0aWYgKHNvdXJjZSkge1xuXHRcdGVtaXROZXQoJ3Bob25lOmNsaWVudDpzZXR1cFBob25lJywgc291cmNlLCBjaXRpemVuSWQpO1xuXHR9XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9zZXR0aW5ncycsXG4gICAgICAgIHRpdGxlOiAnUGhvbmUgTnVtYmVyIEdlbmVyYXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQaG9uZSBudW1iZXIgJHtudW1iZXJ9IGdlbmVyYXRlZCBmb3IgJHtjaXRpemVuSWR9YCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlLFxuICAgIH0pO1xuICAgIHJldHVybiBudW1iZXI7XG59XG5leHBvcnRzKCdHZW5lcmF0ZVBsYXllclBob25lTnVtYmVyJywgR2VuZXJhdGVQbGF5ZXJQaG9uZU51bWJlcik7XG5cbm9uKCd0eEFkbWluOmV2ZW50czpzY2hlZHVsZWRSZXN0YXJ0JywgYXN5bmMgKGRhdGE6IGFueSkgPT4ge1xuICAgIGF3YWl0IFNldHRpbmdzLnNhdmUoKTtcbiAgICBMT0dHRVIoYFtTZXR0aW5nc10gU2F2ZWQgZHVyaW5nIHJlc291cmNlIHN0b3AuYCk7XG59KTtcblxub24oJ3R4QWRtaW46ZXZlbnRzOnNlcnZlclNodXR0aW5nRG93bicsIGFzeW5jICgpID0+IHtcbiAgICBhd2FpdCBTZXR0aW5ncy5zYXZlKCk7XG4gICAgTE9HR0VSKGBbU2V0dGluZ3NdIFNhdmVkIGR1cmluZyByZXNvdXJjZSBzdG9wLmApO1xufSk7IiwgImltcG9ydCB7IExvZ2dlciwgTW9uZ29EQiB9IGZyb20gXCJAc2VydmVyL3N2X21haW5cIjtcbmltcG9ydCB7IERlbGF5LCBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgVHdlZXREYXRhLCBUd2VldFByb2ZpbGVEYXRhIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBVdGlscyB9IGZyb20gXCJAc2VydmVyL2NsYXNzZXMvVXRpbHNcIjtcbmltcG9ydCB7IEZSQU1FV09SS19SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmNsYXNzIFBpZ2VvblNlcnZpY2Uge1xuICAgIHB1YmxpYyBhc3luYyBzZWFyY2hVc2VyRXhpc3QoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IGRhdGEgfSk7XG4gICAgICAgIHJldHVybiAhIXVzZXI7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGxvZ2luKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZW1haWwsIHBhc3N3b3JkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsLCBwYXNzd29yZCB9KTtcbiAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1VzZXIgTG9naW4nLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciB3aXRoIGVtYWlsICR7ZW1haWx9IGxvZ2dlZCBpbiBzdWNjZXNzZnVsbHkuYCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gbG9naW46XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzaWdudXAoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdVc2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGlmIChleGlzdGluZ1VzZXIpIHtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkVtYWlsIGFscmVhZHkgdGFrZW5cIiB9O1xuICAgICAgICB9XG4gICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBlbWFpbCxcbiAgICAgICAgICAgIHBhc3N3b3JkLFxuICAgICAgICAgICAgdmVyaWZpZWQ6IGZhbHNlLFxuICAgICAgICAgICAgdXNlcm5hbWU6IGVtYWlsLFxuICAgICAgICAgICAgZGlzcGxheU5hbWU6IGVtYWlsLFxuICAgICAgICAgICAgYXZhdGFyOiBcIlwiLFxuICAgICAgICAgICAgYmFubmVyOiBcIlwiLFxuICAgICAgICAgICAgbm90aWZpY2F0aW9uc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIGJpbzogXCJcIixcbiAgICAgICAgICAgIGZvbGxvd2VyczogW10sXG4gICAgICAgICAgICBmb2xsb3dpbmc6IFtdLFxuICAgICAgICB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnVXNlciBTaWdudXAnLFxuICAgICAgICAgICAgbWVzc2FnZTogYE5ldyB1c2VyIGFjY291bnQgY3JlYXRlZCB3aXRoIGVtYWlsICR7ZW1haWx9LmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRQcm9maWxlKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh1c2VyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBcIlVzZXIgbm90IGZvdW5kXCI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgdG9nZ2xlTm90aWZpY2F0aW9ucyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgIHJlcy5ub3RpZmljYXRpb25zRW5hYmxlZCA9ICFyZXMubm90aWZpY2F0aW9uc0VuYWJsZWQ7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0sIHJlcyk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ05vdGlmaWNhdGlvbnMgVG9nZ2xlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gdG9nZ2xlZCBub3RpZmljYXRpb25zIHRvICR7cmVzLm5vdGlmaWNhdGlvbnNFbmFibGVkID8gJ2VuYWJsZWQnIDogJ2Rpc2FibGVkJ30uYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcG9zdFR3ZWV0KF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyBlbWFpbCwgY29udGVudCwgYXR0YWNobWVudHMgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghcmVzKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHR3ZWV0OiBUd2VldERhdGEgPSB7XG4gICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB1c2VybmFtZTogcmVzLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgICAgIGVtYWlsOiByZXMuZW1haWwsXG4gICAgICAgICAgICAgICAgYXZhdGFyOiByZXMuYXZhdGFyLFxuICAgICAgICAgICAgICAgIHZlcmlmaWVkOiByZXMudmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgICAgICBhdHRhY2htZW50cyxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBsaWtlQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgIHJlcGxpZXNDb3VudDogW10sXG4gICAgICAgICAgICAgICAgcmV0d2VldENvdW50OiBbXSxcbiAgICAgICAgICAgICAgICBpc1JldHdlZXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXRJZDogbnVsbCxcbiAgICAgICAgICAgICAgICBoYXNodGFnczogY29udGVudC5tYXRjaCgvI1xcdysvZykgfHwgW10sXG4gICAgICAgICAgICAgICAgcGFyZW50VHdlZXRJZDogbnVsbCxcblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB0d2VldCk7XG4gICAgICAgICAgICBhd2FpdCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmVmcmVzaFR3ZWV0XCIsIC0xLCBKU09OLnN0cmluZ2lmeSh0d2VldCkpO1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgLTEsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgVHdlZXQnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtyZXMuZGlzcGxheU5hbWV9IGhhcyBwb3N0ZWQgYSBuZXcgdHdlZXQuYCxcbiAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgY29udGVudDogYCR7cmVzLmRpc3BsYXlOYW1lfSBoYXMgcG9zdGVkIGEgbmV3IHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgZW1haWw6IHJlcy5lbWFpbCxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICB0eXBlOiBcInBvc3RcIixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBQb3N0ZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IHBvc3RlZCBhIG5ldyB0d2VldCAoSUQ6ICR7dHdlZXQuX2lkfSksIGNvbnRlbnQ6ICR7Y29udGVudH1gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gcG9zdFR3ZWV0OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QWxsRmVlZChfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHN0YXJ0ID0gMSwgZW5kID0gMjAgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7fSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgICAgICBza2lwOiBzdGFydCAtIDEsXG4gICAgICAgICAgICAgICAgbGltaXQ6IGVuZCxcbiAgICAgICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgZGF0YTogcmVzLFxuICAgICAgICAgICAgICAgIGxlbmd0aDogcmVzLmxlbmd0aCxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldEZlZWQ6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkXCIgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBwb3N0UmVwbHkoY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgY29udGVudCwgZW1haWwsIGF0dGFjaG1lbnRzIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgIGNvbnN0IHR3ZWV0OiBUd2VldERhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICBjb25zdCByZXBseSA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB1c2VybmFtZTogdXNlci5kaXNwbGF5TmFtZSxcbiAgICAgICAgICAgIGVtYWlsOiB1c2VyLmVtYWlsLFxuICAgICAgICAgICAgYXZhdGFyOiB1c2VyLmF2YXRhcixcbiAgICAgICAgICAgIHZlcmlmaWVkOiB1c2VyLnZlcmlmaWVkLFxuICAgICAgICAgICAgY29udGVudCxcbiAgICAgICAgICAgIGF0dGFjaG1lbnRzLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICBsaWtlQ291bnQ6IFtdLFxuICAgICAgICAgICAgcmVwbGllc0NvdW50OiBbXSxcbiAgICAgICAgICAgIHJldHdlZXRDb3VudDogW10sXG4gICAgICAgICAgICBpc1JldHdlZXQ6IGZhbHNlLFxuICAgICAgICAgICAgb3JpZ2luYWxUd2VldElkOiB0d2VldElkLFxuICAgICAgICAgICAgaGFzaHRhZ3M6IGNvbnRlbnQubWF0Y2goLyNcXHcrL2cpIHx8IFtdLFxuICAgICAgICAgICAgcGFyZW50VHdlZXRJZDogbnVsbFxuICAgICAgICB9O1xuICAgICAgICB0d2VldC5yZXBsaWVzQ291bnQucHVzaChjaXRpemVuSWQpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCByZXBseSk7XG4gICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZWZyZXNoUmVwb3N0XCIsIC0xLCBKU09OLnN0cmluZ2lmeShyZXBseSkpO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoYXdhaXQgVXRpbHMuR2V0Q2lkRnJvbVR3ZWV0SWQodHdlZXQuZW1haWwpKTtcbiAgICAgICAgaWYgKHJlcykge1xuICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgcmVzLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnTmV3IFJlcGx5JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7dXNlci5kaXNwbGF5TmFtZX0gaGFzIHJlcGxpZWQgdG8gdHdlZXQuYCxcbiAgICAgICAgICAgICAgICBhcHA6ICdwaWdlb24nLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKFwicGhvbmVfcGlnZW9uX25vdGlmaWNhdGlvbnNcIiwge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgY29udGVudDogYCR7dXNlci5kaXNwbGF5TmFtZX0gaGFzIHJlcGxpZWQgdG8gdHdlZXQuYCxcbiAgICAgICAgICAgICAgICBlbWFpbDogdHdlZXQuZW1haWwsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgdHlwZTogXCJwb3N0XCIsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBQb3N0ZWQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gcmVwbGllZCB0byB0d2VldCAoSUQ6ICR7dHdlZXRJZH0pLCBjb250ZW50OiAke2NvbnRlbnR9YCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBsaWtlVHdlZXQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCBsaWtlLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBpZiAoIXR3ZWV0KSByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICBpZiAobGlrZSkge1xuICAgICAgICAgICAgdHdlZXQubGlrZUNvdW50LnB1c2goZW1haWwpO1xuICAgICAgICAgICAgY29uc3QgY2lkID0gYXdhaXQgVXRpbHMuR2V0Q2lkRnJvbVR3ZWV0SWQodHdlZXQuZW1haWwpO1xuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKGNpZCk7XG4gICAgICAgICAgICBpZiAocmVzKSB7XG4gICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgcmVzLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdOZXcgTGlrZScsXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtlbWFpbH0gaGFzIGxpa2VkIHlvdXIgdHdlZXQuYCxcbiAgICAgICAgICAgICAgICAgICAgYXBwOiAncGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl9ub3RpZmljYXRpb25zXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgY29udGVudDogYCR7ZW1haWx9IGhhcyBsaWtlZCB5b3VyIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgICAgIGVtYWlsOiB0d2VldC5lbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFwibGlrZVwiLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdUd2VldCBMaWtlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHtlbWFpbH0gbGlrZWQgdHdlZXQgKElEOiAke3R3ZWV0SWR9KS5gLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdHdlZXQubGlrZUNvdW50ID0gdHdlZXQubGlrZUNvdW50LmZpbHRlcigobDogYW55KSA9PiBsICE9PSBlbWFpbCk7XG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IExpa2VkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBsaWtlZCB0d2VldCAoSUQ6ICR7dHdlZXRJZH0pLmAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGxpa2VSZXBsaWVzVHdlZXQoX2NsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCBsaWtlLCBlbWFpbCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgY29uc3QgdHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHJldHVybiBjb25zb2xlLmxvZyhcIlR3ZWV0IG5vdCBmb3VuZFwiKTtcbiAgICAgICAgaWYgKGxpa2UpIHtcbiAgICAgICAgICAgIHR3ZWV0Lmxpa2VDb3VudC5wdXNoKGVtYWlsKTtcbiAgICAgICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgIHRpdGxlOiAnUmVwbHkgTGlrZWQnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGxpa2VkIHJlcGx5IChJRDogJHt0d2VldElkfSkuYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHR3ZWV0Lmxpa2VDb3VudCA9IHR3ZWV0Lmxpa2VDb3VudC5maWx0ZXIoKGw6IGFueSkgPT4gbCAhPT0gZW1haWwpO1xuICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBVbmxpa2VkJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSB1bmxpa2VkIHJlcGx5IChJRDogJHt0d2VldElkfSkuYCxcbiAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9LCB0d2VldCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZXR3ZWV0KGNsaWVudDogbnVtYmVyLCBkYXRhOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkLCByZXR3ZWV0LCBwaWdlb25JZCwgb2dUd2VldElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHJldHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldFdlZXR1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHBpZ2VvbklkIH0pO1xuICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWxUd2VldCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJPcmlnaW5hbCB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudC5wdXNoKGNpdGl6ZW5JZCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIG9yaWdpbmFsVHdlZXQpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcmV0d2VldERhdGE6IFR3ZWV0RGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgdXNlcm5hbWU6IHJldFdlZXR1c2VyLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgICAgICAgICBlbWFpbDogcmV0V2VldHVzZXIuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgIGF2YXRhcjogcmV0V2VldHVzZXIuYXZhdGFyLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZDogcmV0V2VldHVzZXIudmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG9yaWdpbmFsVHdlZXQuY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHM6IG9yaWdpbmFsVHdlZXQuYXR0YWNobWVudHMsXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICBsaWtlQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICByZXBsaWVzQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICByZXR3ZWV0Q291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICBpc1JldHdlZXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXRJZDogdHdlZXRJZCxcbiAgICAgICAgICAgICAgICAgICAgaGFzaHRhZ3M6IG9yaWdpbmFsVHdlZXQuaGFzaHRhZ3MsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFR3ZWV0SWQ6IG51bGwsXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgcmV0d2VldERhdGEpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZWZyZXNoVHdlZXRcIiwgLTEsIEpTT04uc3RyaW5naWZ5KHJldHdlZXREYXRhKSk7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1R3ZWV0IFJldHdlZXRlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7cGlnZW9uSWR9IHJldHdlZXRlZCB0d2VldCAoSUQ6ICR7dHdlZXRJZH0pLCBvcmlnaW5hbCB0d2VldCBJRDogJHtvZ1R3ZWV0SWR9LCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCFyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbFR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb2dUd2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGlmICghb3JpZ2luYWxUd2VldCB8fCAhcmV0d2VldCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJPcmlnaW5hbCB0d2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBvbmx5IGZpcnN0IG9jY3VycmVuY2Ugb2YgY2l0aXplbklkXG4gICAgICAgICAgICAgICAgbGV0IHJlbW92ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFR3ZWV0LnJldHdlZXRDb3VudCA9IG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50LmZpbHRlcigobDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChsID09PSBjaXRpemVuSWQgJiYgIXJlbW92ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogb2dUd2VldElkIH0sIG9yaWdpbmFsVHdlZXQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnUmV0d2VldCBSZW1vdmVkJyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgcmVtb3ZlZCByZXR3ZWV0IChJRDogJHt0d2VldElkfSkgb2Ygb3JpZ2luYWwgdHdlZXQgKElEOiAke29nVHdlZXRJZH0pLCBjb250ZW50OiAke29yaWdpbmFsVHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiByZXR3ZWV0OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgcmV0d2VldFJlcGxpZXNUd2VldChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHsgdHdlZXRJZCwgcmV0d2VldCwgcGlnZW9uSWQsIG9nVHdlZXRJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbFR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IG9nVHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiBvcmlnaW5hbFR3ZWV0Lm9yaWdpbmFsVHdlZXRJZCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXRXZWV0dXNlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBwaWdlb25JZCB9KTtcbiAgICAgICAgICAgICAgICBpZiAoIW9yaWdpbmFsVHdlZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiT3JpZ2luYWwgdHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQucHVzaChjaXRpemVuSWQpO1xuICAgICAgICAgICAgICAgIG9nVHdlZXQucmVwbGllc0NvdW50LnB1c2goY2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IG9yaWdpbmFsVHdlZXQub3JpZ2luYWxUd2VldElkIH0sIG9nVHdlZXQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0sIG9yaWdpbmFsVHdlZXQpO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcmV0d2VldERhdGE6IFR3ZWV0RGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgdXNlcm5hbWU6IHJldFdlZXR1c2VyLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgICAgICAgICBlbWFpbDogcmV0V2VldHVzZXIuZW1haWwsXG4gICAgICAgICAgICAgICAgICAgIGF2YXRhcjogcmV0V2VldHVzZXIuYXZhdGFyLFxuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZDogcmV0V2VldHVzZXIudmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IG9yaWdpbmFsVHdlZXQuY29udGVudCxcbiAgICAgICAgICAgICAgICAgICAgYXR0YWNobWVudHM6IG9yaWdpbmFsVHdlZXQuYXR0YWNobWVudHMsXG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICBsaWtlQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICByZXBsaWVzQ291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICByZXR3ZWV0Q291bnQ6IFtdLFxuICAgICAgICAgICAgICAgICAgICBpc1JldHdlZXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXRJZDogb3JpZ2luYWxUd2VldC5vcmlnaW5hbFR3ZWV0SWQsXG4gICAgICAgICAgICAgICAgICAgIGhhc2h0YWdzOiBvcmlnaW5hbFR3ZWV0Lmhhc2h0YWdzLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRUd2VldElkOiB0d2VldElkLFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgcmV0d2VldERhdGEpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjayhcInBpZ2VvbjpyZWZyZXNoUmVwb3N0XCIsIC0xLCBKU09OLnN0cmluZ2lmeShyZXR3ZWV0RGF0YSkpO1xuICAgICAgICAgICAgICAgIGlmIChvZ1R3ZWV0LnJlcGxpZXNDb3VudCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1bmlxdWVDaWRzID0gWy4uLm5ldyBTZXQob2dUd2VldC5yZXBsaWVzQ291bnQpXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCByZXBseUNpZCBvZiB1bmlxdWVDaWRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQocmVwbHlDaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgcmVzLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnTmV3IFJlcGx5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYCR7cmV0V2VldHVzZXIuZGlzcGxheU5hbWV9IGhhcyByZXBsaWVkIHRvIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiAncGlnZW9uJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl9ub3RpZmljYXRpb25zXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGB7cmV0V2VldHVzZXIuZGlzcGxheU5hbWV9IGhhcyByZXBsaWVkIHRvIHR3ZWV0LmAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1haWw6IHJldFdlZXR1c2VyLmVtYWlsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IFwicG9zdFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1JlcGx5IFJldHdlZXRlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7cGlnZW9uSWR9IHJldHdlZXRlZCByZXBseSAoSUQ6ICR7dHdlZXRJZH0pLCBvcmlnaW5hbCB0d2VldCBJRDogJHtvZ1R3ZWV0SWR9KSwgY29udGVudDogJHtvcmlnaW5hbFR3ZWV0LmNvbnRlbnR9YCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmICghcmV0d2VldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUd2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogb2dUd2VldElkIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJldHdlZXQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgaWYgKCFvcmlnaW5hbFR3ZWV0IHx8ICFyZXR3ZWV0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIk9yaWdpbmFsIHR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gUmVtb3ZlIG9ubHkgZmlyc3Qgb2NjdXJyZW5jZSBvZiBjaXRpemVuSWRcbiAgICAgICAgICAgICAgICBsZXQgcmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIG9yaWdpbmFsVHdlZXQucmV0d2VldENvdW50ID0gb3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQuZmlsdGVyKChsOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGwgPT09IGNpdGl6ZW5JZCAmJiAhcmVtb3ZlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgLyogY29uc29sZS5sb2cob3JpZ2luYWxUd2VldC5yZXR3ZWV0Q291bnQpOyAqL1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiBvZ1R3ZWV0SWQgfSwgb3JpZ2luYWxUd2VldCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1JldHdlZXQgb2YgUmVwbHkgUmVtb3ZlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyIHJlbW92ZWQgcmV0d2VldCAoSUQ6ICR7dHdlZXRJZH0pIG9mIHJlcGx5IChJRDogJHtvZ1R3ZWV0SWR9KSwgY29udGVudDogJHtvcmlnaW5hbFR3ZWV0LmNvbnRlbnR9YCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gcmV0d2VldDpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWRcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGRlbGV0ZVR3ZWV0KF9jbGllbnQ6IG51bWJlciwgdHdlZXRJZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgVHdlZXQgbm90IGZvdW5kIGZvciBkZWxldGlvbjogJHt0d2VldElkfWApO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiVHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnVHdlZXQgRGVsZXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVHdlZXQgKElEOiAke3R3ZWV0SWR9KSBkZWxldGVkIGJ5IHVzZXIgJHt0d2VldC5lbWFpbH0sIGNvbnRlbnQ6ICR7dHdlZXQuY29udGVudH1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGRlbGV0ZVJlcGxpZXNUd2VldChfY2xpZW50OiBudW1iZXIsIHR3ZWV0SWQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNfcmVwbGllc1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgaWYgKCF0d2VldCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgUmVwbHkgdHdlZXQgbm90IGZvdW5kIGZvciBkZWxldGlvbjogJHt0d2VldElkfWApO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiUmVwbHkgdHdlZXQgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgX2lkOiB0d2VldElkIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdSZXBseSBEZWxldGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBSZXBseSAoSUQ6ICR7dHdlZXRJZH0pIGRlbGV0ZWQsIGNvbnRlbnQ6ICR7dHdlZXQuY29udGVudH0gYnkgdXNlciAke3R3ZWV0LmVtYWlsfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldFBvc3RSZXBsaWVzKF9jbGllbnQ6IG51bWJlciwgdHdlZXRJZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHJlcGxpZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c19yZXBsaWVzXCIsIHsgb3JpZ2luYWxUd2VldElkOiB0d2VldElkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcGxpZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBpbmNyZWFzZVJlcGxpZXNDb3VudChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyB0d2VldElkIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgICBjb25zdCB0d2VldCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSk7XG4gICAgICAgIGlmICghdHdlZXQpIHJldHVybiB7IGVycm9yOiBcIlR3ZWV0IG5vdCBmb3VuZFwiIH07XG4gICAgICAgIHR3ZWV0LnJlcGxpZXNDb3VudC5wdXNoKGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCkpO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBkZWNyZWFzZVJlcGxpZXNDb3VudChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgdHdlZXRJZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IGNpZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG5cbiAgICAgICAgICAgIGNvbnN0IHR3ZWV0ID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IF9pZDogdHdlZXRJZCB9KTtcbiAgICAgICAgICAgIGlmICghdHdlZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBUd2VldCBub3QgZm91bmQgZm9yIHR3ZWV0SWQ6ICR7dHdlZXRJZH1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJUd2VldCBub3QgZm91bmRcIiB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgcmVtb3ZlZCA9IGZhbHNlO1xuICAgICAgICAgICAgdHdlZXQucmVwbGllc0NvdW50ID0gdHdlZXQucmVwbGllc0NvdW50LmZpbHRlcigocjogc3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHIgPT09IGNpZCAmJiAhcmVtb3ZlZCkge1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVSZXN1bHQgPSBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBfaWQ6IHR3ZWV0SWQgfSwgdHdlZXQpO1xuXG4gICAgICAgICAgICBpZiAoIXVwZGF0ZVJlc3VsdCB8fCB1cGRhdGVSZXN1bHQubW9kaWZpZWRDb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgTm8gY2hhbmdlcyBtYWRlIHRvIHR3ZWV0ICR7dHdlZXRJZH0gcmVwbGllc0NvdW50YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIG1lc3NhZ2U6IFwiTm8gY2hhbmdlcyBtYWRlIHRvIHJlcGxpZXMgY291bnRcIiB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvKiBjb25zb2xlLmxvZyhgU3VjY2Vzc2Z1bGx5IGRlY3JlYXNlZCByZXBsaWVzQ291bnQgZm9yIHR3ZWV0ICR7dHdlZXRJZH1gKTsgKi9cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGRlY3JlYXNlUmVwbGllc0NvdW50OlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZFwiLCBkZXRhaWxzOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZm9sbG93VXNlcihfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHRhcmdldEVtYWlsLCBjdXJyZW50RW1haWwsIGZvbGxvdyB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFVzZXI6IFR3ZWV0UHJvZmlsZURhdGEgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogdGFyZ2V0RW1haWwgfSk7XG4gICAgICAgICAgICBpZiAoIXRhcmdldFVzZXIpIHJldHVybiB7IGVycm9yOiBcIlRhcmdldCB1c2VyIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRVc2VyOiBUd2VldFByb2ZpbGVEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IGN1cnJlbnRFbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghY3VycmVudFVzZXIpIHJldHVybiB7IGVycm9yOiBcIkN1cnJlbnQgdXNlciBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICBpZiAoZm9sbG93KSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0YXJnZXRVc2VyLmZvbGxvd2Vycy5pbmNsdWRlcyhjdXJyZW50RW1haWwpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFVzZXIuZm9sbG93ZXJzLnB1c2goY3VycmVudEVtYWlsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFjdXJyZW50VXNlci5mb2xsb3dpbmcuaW5jbHVkZXModGFyZ2V0RW1haWwpKSB7XG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRVc2VyLmZvbGxvd2luZy5wdXNoKHRhcmdldEVtYWlsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1VzZXIgRm9sbG93ZWQnLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2N1cnJlbnRFbWFpbH0gZm9sbG93ZWQgJHt0YXJnZXRFbWFpbH0uYCxcbiAgICAgICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRVc2VyLmZvbGxvd2VycyA9IHRhcmdldFVzZXIuZm9sbG93ZXJzLmZpbHRlcihlbWFpbCA9PiBlbWFpbCAhPT0gY3VycmVudEVtYWlsKTtcbiAgICAgICAgICAgICAgICBjdXJyZW50VXNlci5mb2xsb3dpbmcgPSBjdXJyZW50VXNlci5mb2xsb3dpbmcuZmlsdGVyKGVtYWlsID0+IGVtYWlsICE9PSB0YXJnZXRFbWFpbCk7XG4gICAgICAgICAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1VzZXIgVW5mb2xsb3dlZCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7Y3VycmVudEVtYWlsfSB1bmZvbGxvd2VkICR7dGFyZ2V0RW1haWx9LmAsXG4gICAgICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogdGFyZ2V0RW1haWwgfSwgdGFyZ2V0VXNlcik7XG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBjdXJyZW50RW1haWwgfSwgY3VycmVudFVzZXIpO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZm9sbG93VXNlcjpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgdXBkYXRpbmcgZm9sbG93IHN0YXR1c1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0VXNlclR3ZWV0cyhfY2xpZW50OiBudW1iZXIsIGVtYWlsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3R3ZWV0c1wiLCB7IGVtYWlsIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldEFsbFBvc3RSZXBsaWVzKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdHdlZXRzX3JlcGxpZXNcIiwgeyBlbWFpbDogZW1haWwgfSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QWxsTGlrZWRUd2VldHMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl90d2VldHNcIiwgeyBsaWtlQ291bnQ6IGVtYWlsIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHNlYXJjaFVzZXJzKF9jbGllbnQ6IG51bWJlciwgdmFsdWU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogeyAkcmVnZXg6IHZhbHVlLCAkb3B0aW9uczogXCJpXCIgfSB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShyZXMpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXROb3RpZmljYXRpb25zKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXCJwaG9uZV9waWdlb25fbm90aWZpY2F0aW9uc1wiLCB7IGVtYWlsIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGNyZWF0ZWRBdDogLTEgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGNoYW5nZVBhc3N3b3JkKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG4gICAgICAgIGNvbnN0IG9sZFBhc3N3b3JkID0gdXNlci5wYXNzd29yZDtcbiAgICAgICAgdXNlci5wYXNzd29yZCA9IHBhc3N3b3JkO1xuICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsIH0sIHVzZXIpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9waWdlb24nLFxuICAgICAgICAgICAgdGl0bGU6ICdQYXNzd29yZCBDaGFuZ2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBVc2VyICR7ZW1haWx9IGNoYW5nZWQgdGhlaXIgcGFzc3dvcmQsIG9sZCBwYXNzd29yZDogJHtvbGRQYXNzd29yZH0sIG5ldyBwYXNzd29yZDogJHtwYXNzd29yZH1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcblxuICAgIHB1YmxpYyBhc3luYyB1cGRhdGVQcm9maWxlKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcGFyc2VkRGF0YTogVHdlZXRQcm9maWxlRGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgIGNvbnN0IG9sZFVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbDogcGFyc2VkRGF0YS5lbWFpbCB9KTtcbiAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWw6IHBhcnNlZERhdGEuZW1haWwgfSwgcGFyc2VkRGF0YSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3BpZ2VvbicsXG4gICAgICAgICAgICB0aXRsZTogJ1Byb2ZpbGUgVXBkYXRlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke3BhcnNlZERhdGEuZW1haWx9IHVwZGF0ZWQgdGhlaXIgcHJvZmlsZSwgb2xkIGRhdGE6ICR7SlNPTi5zdHJpbmdpZnkob2xkVXNlcil9LCBuZXcgZGF0YTogJHtKU09OLnN0cmluZ2lmeShwYXJzZWREYXRhKX1gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIFwic3VjY2Vzc1wiO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyB2ZXJpZnlVc2VyKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgaWYgKCF1c2VyKSByZXR1cm4geyBlcnJvcjogXCJVc2VyIG5vdCBmb3VuZFwiIH07XG4gICAgICAgIHVzZXIudmVyaWZpZWQgPSB0cnVlO1xuICAgICAgICBhd2FpdCBEZWxheSgxMDAwKTtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9LCB1c2VyKTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgIHRpdGxlOiAnVXNlciBWZXJpZmllZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgVXNlciAke2VtYWlsfSBoYXMgYmVlbiB2ZXJpZmllZC5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gUHJpdmF0ZSBNZXNzYWdpbmcgRnVuY3Rpb25zXG4gICAgcHVibGljIGFzeW5jIHNlbmRQcml2YXRlTWVzc2FnZShfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHNlbmRlckVtYWlsLCByZWNpcGllbnRFbWFpbCwgY29udGVudCwgYXR0YWNobWVudHMgPSBbXSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgICAgICAgICAgLy8gVmVyaWZ5IGJvdGggdXNlcnMgZXhpc3RcbiAgICAgICAgICAgIGNvbnN0IHNlbmRlciA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiBzZW5kZXJFbWFpbCB9KTtcbiAgICAgICAgICAgIGNvbnN0IHJlY2lwaWVudCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLCB7IGVtYWlsOiByZWNpcGllbnRFbWFpbCB9KTtcblxuICAgICAgICAgICAgaWYgKCFzZW5kZXIgfHwgIXJlY2lwaWVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIHNlbmRlckVtYWlsLFxuICAgICAgICAgICAgICAgIHJlY2lwaWVudEVtYWlsLFxuICAgICAgICAgICAgICAgIGNvbnRlbnQsXG4gICAgICAgICAgICAgICAgYXR0YWNobWVudHMsXG4gICAgICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgcmVhZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgZGVsZXRlZEJ5U2VuZGVyOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkZWxldGVkQnlSZWNpcGllbnQ6IGZhbHNlXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZShcInBob25lX3BpZ2Vvbl9wcml2YXRlX21lc3NhZ2VzXCIsIG1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAvLyBHZXQgYWxsIENpdGl6ZW4gSURzIGZvciBib3RoIHNlbmRlciBhbmQgcmVjaXBpZW50IChtdWx0aXBsZSBkZXZpY2VzIHN1cHBvcnQpXG4gICAgICAgICAgICBjb25zdCBzZW5kZXJDaWRzID0gYXdhaXQgVXRpbHMuR2V0Q2lkc0Zyb21QaWdlb25FbWFpbChzZW5kZXJFbWFpbCk7XG4gICAgICAgICAgICBjb25zdCByZWNpcGllbnRDaWRzID0gYXdhaXQgVXRpbHMuR2V0Q2lkc0Zyb21QaWdlb25FbWFpbChyZWNpcGllbnRFbWFpbCk7XG5cbiAgICAgICAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9ucyBhbmQgcmVmcmVzaCBldmVudHMgdG8gYWxsIHJlY2lwaWVudCBkZXZpY2VzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlY2lwaWVudENpZCBvZiByZWNpcGllbnRDaWRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVjaXBpZW50UGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKHJlY2lwaWVudENpZCk7XG4gICAgICAgICAgICAgICAgaWYgKHJlY2lwaWVudFBsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCByZWNpcGllbnRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiAnTmV3IE1lc3NhZ2UnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgcmVjZWl2ZWQgYSBtZXNzYWdlIGZyb20gJHtzZW5kZXIuZGlzcGxheU5hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcDogJ3BpZ2VvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBTZW5kIE5VSSBldmVudCB0byByZWZyZXNoIGNoYXQgaWYgcmVjaXBpZW50IGlzIGluIGNoYXRcbiAgICAgICAgICAgICAgICAgICAgZW1pdE5ldCgncGhvbmU6cmVmcmVzaFByaXZhdGVNZXNzYWdlJywgcmVjaXBpZW50UGxheWVyLlBsYXllckRhdGEuc291cmNlLCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VuZGVyRW1haWw6IHNlbmRlckVtYWlsLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVjaXBpZW50RW1haWw6IHJlY2lwaWVudEVtYWlsXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFNlbmQgcmVmcmVzaCBldmVudCB0byBhbGwgc2VuZGVyIGRldmljZXNcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc2VuZGVyQ2lkIG9mIHNlbmRlckNpZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzZW5kZXJQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoc2VuZGVyQ2lkKTtcbiAgICAgICAgICAgICAgICBpZiAoc2VuZGVyUGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtaXROZXQoJ3Bob25lOnJlZnJlc2hQcml2YXRlTWVzc2FnZScsIHNlbmRlclBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbmRlckVtYWlsOiBzZW5kZXJFbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlY2lwaWVudEVtYWlsOiByZWNpcGllbnRFbWFpbFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1ByaXZhdGUgTWVzc2FnZSBTZW50JyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgJHtzZW5kZXJFbWFpbH0gc2VudCBhIHByaXZhdGUgbWVzc2FnZSB0byAke3JlY2lwaWVudEVtYWlsfWAsXG4gICAgICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2VJZDogbWVzc2FnZS5faWQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBzZW5kUHJpdmF0ZU1lc3NhZ2U6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHNlbmRpbmcgbWVzc2FnZVwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0UHJpdmF0ZU1lc3NhZ2VzKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgdXNlckVtYWlsLCBvdGhlclVzZXJFbWFpbCwgbGltaXQgPSA1MCwgb2Zmc2V0ID0gMCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcblxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwge1xuICAgICAgICAgICAgICAgICRvcjogW1xuICAgICAgICAgICAgICAgICAgICB7IHNlbmRlckVtYWlsOiB1c2VyRW1haWwsIHJlY2lwaWVudEVtYWlsOiBvdGhlclVzZXJFbWFpbCB9LFxuICAgICAgICAgICAgICAgICAgICB7IHNlbmRlckVtYWlsOiBvdGhlclVzZXJFbWFpbCwgcmVjaXBpZW50RW1haWw6IHVzZXJFbWFpbCB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAkYW5kOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgZGVsZXRlZEJ5U2VuZGVyOiB7ICRuZTogdHJ1ZSB9IH0sXG4gICAgICAgICAgICAgICAgICAgIHsgZGVsZXRlZEJ5UmVjaXBpZW50OiB7ICRuZTogdHJ1ZSB9IH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICAgICAgICAgIHNvcnQ6IHsgY3JlYXRlZEF0OiAtMSB9LFxuICAgICAgICAgICAgICAgIHNraXA6IG9mZnNldCxcbiAgICAgICAgICAgICAgICBsaW1pdDogbGltaXRcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobWVzc2FnZXMpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldFByaXZhdGVNZXNzYWdlczpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZmV0Y2hpbmcgbWVzc2FnZXNcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIGdldENvbnZlcnNhdGlvbnMoX2NsaWVudDogbnVtYmVyLCB1c2VyRW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBHZXQgYWxsIHVuaXF1ZSBjb252ZXJzYXRpb25zIGZvciB0aGUgdXNlclxuICAgICAgICAgICAgY29uc3QgY29udmVyc2F0aW9ucyA9IGF3YWl0IE1vbmdvREIuYWdncmVnYXRlKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJG1hdGNoOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHNlbmRlckVtYWlsOiB1c2VyRW1haWwgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHJlY2lwaWVudEVtYWlsOiB1c2VyRW1haWwgfVxuICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICRhbmQ6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IGRlbGV0ZWRCeVNlbmRlcjogeyAkbmU6IHRydWUgfSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgZGVsZXRlZEJ5UmVjaXBpZW50OiB7ICRuZTogdHJ1ZSB9IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJGdyb3VwOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAkY29uZDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ICRlcTogW1wiJHNlbmRlckVtYWlsXCIsIHVzZXJFbWFpbF0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIkcmVjaXBpZW50RW1haWxcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCIkc2VuZGVyRW1haWxcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogeyAkZmlyc3Q6IFwiJCRST09UXCIgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVucmVhZENvdW50OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHN1bToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkY29uZDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAkYW5kOiBbeyAkZXE6IFtcIiRyZWNpcGllbnRFbWFpbFwiLCB1c2VyRW1haWxdIH0sIHsgJGVxOiBbXCIkcmVhZFwiLCBmYWxzZV0gfV0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgJGxvb2t1cDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJvbTogXCJwaG9uZV9waWdlb25fdXNlcnNcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsRmllbGQ6IFwiX2lkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JlaWduRmllbGQ6IFwiZW1haWxcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzOiBcInVzZXJJbmZvXCJcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAkdW53aW5kOiBcIiR1c2VySW5mb1wiXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRwcm9qZWN0OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdGhlclVzZXI6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWFpbDogXCIkdXNlckluZm8uZW1haWxcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNwbGF5TmFtZTogXCIkdXNlckluZm8uZGlzcGxheU5hbWVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdmF0YXI6IFwiJHVzZXJJbmZvLmF2YXRhclwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkOiBcIiR1c2VySW5mby52ZXJpZmllZFwiXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IDEsXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnJlYWRDb3VudDogMVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICRzb3J0OiB7IFwibGFzdE1lc3NhZ2UuY3JlYXRlZEF0XCI6IC0xIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdKTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNvbnZlcnNhdGlvbnMpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIGdldENvbnZlcnNhdGlvbnM6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIGNvbnZlcnNhdGlvbnNcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIG1hcmtNZXNzYWdlQXNSZWFkKF9jbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgbWVzc2FnZUlkLCB1c2VyRW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7IF9pZDogbWVzc2FnZUlkIH0pO1xuICAgICAgICAgICAgaWYgKCFtZXNzYWdlKSByZXR1cm4geyBlcnJvcjogXCJNZXNzYWdlIG5vdCBmb3VuZFwiIH07XG5cbiAgICAgICAgICAgIC8vIE9ubHkgbWFyayBhcyByZWFkIGlmIHRoZSB1c2VyIGlzIHRoZSByZWNpcGllbnRcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnJlY2lwaWVudEVtYWlsID09PSB1c2VyRW1haWwpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlLnJlYWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgeyBfaWQ6IG1lc3NhZ2VJZCB9LCBtZXNzYWdlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGluIG1hcmtNZXNzYWdlQXNSZWFkOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBtYXJraW5nIG1lc3NhZ2UgYXMgcmVhZFwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZGVsZXRlTWVzc2FnZShfY2xpZW50OiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IG1lc3NhZ2VJZCwgdXNlckVtYWlsIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3ByaXZhdGVfbWVzc2FnZXNcIiwgeyBfaWQ6IG1lc3NhZ2VJZCB9KTtcbiAgICAgICAgICAgIGlmICghbWVzc2FnZSkgcmV0dXJuIHsgZXJyb3I6IFwiTWVzc2FnZSBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICAvLyBNYXJrIGFzIGRlbGV0ZWQgYnkgdGhlIGFwcHJvcHJpYXRlIHVzZXJcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnNlbmRlckVtYWlsID09PSB1c2VyRW1haWwpIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlLmRlbGV0ZWRCeVNlbmRlciA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG1lc3NhZ2UucmVjaXBpZW50RW1haWwgPT09IHVzZXJFbWFpbCkge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UuZGVsZXRlZEJ5UmVjaXBpZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiVW5hdXRob3JpemVkXCIgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1wiLCB7IF9pZDogbWVzc2FnZUlkIH0sIG1lc3NhZ2UpO1xuXG4gICAgICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgICAgICB0eXBlOiAncGhvbmVfcGlnZW9uJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ01lc3NhZ2UgRGVsZXRlZCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFVzZXIgJHt1c2VyRW1haWx9IGRlbGV0ZWQgYSBwcml2YXRlIG1lc3NhZ2VgLFxuICAgICAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZGVsZXRlTWVzc2FnZTpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgZXJyb3I6IFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgZGVsZXRpbmcgbWVzc2FnZVwiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBFbmhhbmNlZCBGb2xsb3dlcnMvRm9sbG93aW5nIEZ1bmN0aW9uc1xuICAgIHB1YmxpYyBhc3luYyBnZXRGb2xsb3dlcnMoX2NsaWVudDogbnVtYmVyLCBlbWFpbDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoXCJwaG9uZV9waWdlb25fdXNlcnNcIiwgeyBlbWFpbCB9KTtcbiAgICAgICAgICAgIGlmICghdXNlcikgcmV0dXJuIHsgZXJyb3I6IFwiVXNlciBub3QgZm91bmRcIiB9O1xuXG4gICAgICAgICAgICBjb25zdCBmb2xsb3dlcnMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsXG4gICAgICAgICAgICAgICAgeyBlbWFpbDogeyAkaW46IHVzZXIuZm9sbG93ZXJzIH0gfSxcbiAgICAgICAgICAgICAgICBudWxsLCBmYWxzZSxcbiAgICAgICAgICAgICAgICB7IHNvcnQ6IHsgZGlzcGxheU5hbWU6IDEgfSB9XG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZm9sbG93ZXJzKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBpbiBnZXRGb2xsb3dlcnM6XCIsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGZldGNoaW5nIGZvbGxvd2Vyc1wiIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0Rm9sbG93aW5nKF9jbGllbnQ6IG51bWJlciwgZW1haWw6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1c2VyID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKFwicGhvbmVfcGlnZW9uX3VzZXJzXCIsIHsgZW1haWwgfSk7XG4gICAgICAgICAgICBpZiAoIXVzZXIpIHJldHVybiB7IGVycm9yOiBcIlVzZXIgbm90IGZvdW5kXCIgfTtcblxuICAgICAgICAgICAgY29uc3QgZm9sbG93aW5nID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueShcInBob25lX3BpZ2Vvbl91c2Vyc1wiLFxuICAgICAgICAgICAgICAgIHsgZW1haWw6IHsgJGluOiB1c2VyLmZvbGxvd2luZyB9IH0sXG4gICAgICAgICAgICAgICAgbnVsbCwgZmFsc2UsXG4gICAgICAgICAgICAgICAgeyBzb3J0OiB7IGRpc3BsYXlOYW1lOiAxIH0gfVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGZvbGxvd2luZyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgaW4gZ2V0Rm9sbG93aW5nOlwiLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBlcnJvcjogXCJBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBmb2xsb3dpbmdcIiB9O1xuICAgICAgICB9XG4gICAgfVxuXG59XG5cbmV4cG9ydCBjb25zdCBwaWdlb25TZXJ2aWNlID0gbmV3IFBpZ2VvblNlcnZpY2UoKTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IHBpZ2VvblNlcnZpY2UgfSBmcm9tIFwiLi9QaWdlb25TZXJ2aWNlXCI7XG5cbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246c2VhcmNoVXNlcnNcIiwgcGlnZW9uU2VydmljZS5zZWFyY2hVc2VyRXhpc3QpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjpsb2dpblwiLCBwaWdlb25TZXJ2aWNlLmxvZ2luKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246c2lnbnVwXCIsIHBpZ2VvblNlcnZpY2Uuc2lnbnVwKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246dG9nZ2xlTm90aWZpY2F0aW9uc1wiLCBwaWdlb25TZXJ2aWNlLnRvZ2dsZU5vdGlmaWNhdGlvbnMpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjpwb3N0VHdlZXRcIiwgcGlnZW9uU2VydmljZS5wb3N0VHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpnZXRQcm9maWxlXCIsIHBpZ2VvblNlcnZpY2UuZ2V0UHJvZmlsZSk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmdldEFsbEZlZWRcIiwgcGlnZW9uU2VydmljZS5nZXRBbGxGZWVkKTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246bGlrZVR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UubGlrZVR3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmV0d2VldFR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UucmV0d2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmRlbGV0ZVR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UuZGVsZXRlVHdlZXQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2Vvbjpwb3N0UmVwbHlcIiwgcGlnZW9uU2VydmljZS5wb3N0UmVwbHkpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpnZXRSZXBsaWVzXCIsIHBpZ2VvblNlcnZpY2UuZ2V0UG9zdFJlcGxpZXMpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpsaWtlUmVwb3N0VHdlZXRcIiwgcGlnZW9uU2VydmljZS5saWtlUmVwbGllc1R3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246cmV0d2VldFJlcG9zdFR3ZWV0XCIsIHBpZ2VvblNlcnZpY2UucmV0d2VldFJlcGxpZXNUd2VldCk7XG5vbkNsaWVudENhbGxiYWNrKFwicGlnZW9uOmluY3JlYXNlUmVwbGllc0NvdW50XCIsIHBpZ2VvblNlcnZpY2UuaW5jcmVhc2VSZXBsaWVzQ291bnQpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpkZWNyZWFzZVJlcGxpZXNDb3VudFwiLCBwaWdlb25TZXJ2aWNlLmRlY3JlYXNlUmVwbGllc0NvdW50KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246ZGVsZXRlUmVwbGllc1R3ZWV0XCIsIHBpZ2VvblNlcnZpY2UuZGVsZXRlUmVwbGllc1R3ZWV0KTtcbm9uQ2xpZW50Q2FsbGJhY2soXCJwaWdlb246Zm9sbG93VXNlclwiLCBwaWdlb25TZXJ2aWNlLmZvbGxvd1VzZXIpO1xub25DbGllbnRDYWxsYmFjayhcInBpZ2VvbjpnZXRVc2VyVHdlZXRzXCIsIHBpZ2VvblNlcnZpY2UuZ2V0VXNlclR3ZWV0cyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0QWxsUG9zdFJlcGxpZXMnLCBwaWdlb25TZXJ2aWNlLmdldEFsbFBvc3RSZXBsaWVzKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRBbGxMaWtlZFR3ZWV0cycsIHBpZ2VvblNlcnZpY2UuZ2V0QWxsTGlrZWRUd2VldHMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOnNlYXJjaFVzZXJzWCcsIHBpZ2VvblNlcnZpY2Uuc2VhcmNoVXNlcnMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmdldE5vdGlmaWNhdGlvbnMnLCBwaWdlb25TZXJ2aWNlLmdldE5vdGlmaWNhdGlvbnMpO1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOmNoYW5nZVBhc3N3b3JkJywgcGlnZW9uU2VydmljZS5jaGFuZ2VQYXNzd29yZCk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246dXBkYXRlUHJvZmlsZScsIHBpZ2VvblNlcnZpY2UudXBkYXRlUHJvZmlsZSk7XG5cbi8vIFByaXZhdGUgTWVzc2FnaW5nIENhbGxiYWNrc1xub25DbGllbnRDYWxsYmFjaygncGlnZW9uOnNlbmRQcml2YXRlTWVzc2FnZScsIHBpZ2VvblNlcnZpY2Uuc2VuZFByaXZhdGVNZXNzYWdlKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRQcml2YXRlTWVzc2FnZXMnLCBwaWdlb25TZXJ2aWNlLmdldFByaXZhdGVNZXNzYWdlcyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0Q29udmVyc2F0aW9ucycsIChjbGllbnQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgcmV0dXJuIHBpZ2VvblNlcnZpY2UuZ2V0Q29udmVyc2F0aW9ucyhjbGllbnQsIGRhdGEpO1xufSk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246bWFya01lc3NhZ2VBc1JlYWQnLCBwaWdlb25TZXJ2aWNlLm1hcmtNZXNzYWdlQXNSZWFkKTtcbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpkZWxldGVNZXNzYWdlJywgcGlnZW9uU2VydmljZS5kZWxldGVNZXNzYWdlKTtcblxuLy8gRW5oYW5jZWQgRm9sbG93ZXJzL0ZvbGxvd2luZyBDYWxsYmFja3Ncbm9uQ2xpZW50Q2FsbGJhY2soJ3BpZ2VvbjpnZXRGb2xsb3dlcnMnLCBwaWdlb25TZXJ2aWNlLmdldEZvbGxvd2Vycyk7XG5vbkNsaWVudENhbGxiYWNrKCdwaWdlb246Z2V0Rm9sbG93aW5nJywgcGlnZW9uU2VydmljZS5nZXRGb2xsb3dpbmcpOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBMb2dnZXIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdnZXRPd25lZEhvdXNlcycsIGFzeW5jIChjbGllbnQpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShjbGllbnQpO1xuICAgIGNvbnN0IGFwYXJ0bWVudHMgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIHByb3BlcnR5X2lkLCBvd25lcl9jaXRpemVuaWQsIHN0cmVldCwgZGVzY3JpcHRpb24sIGhhc19hY2Nlc3MsIGRvb3JfZGF0YSwgYXBhcnRtZW50ICBGUk9NIHByb3BlcnRpZXMgV0hFUkUgb3duZXJfY2l0aXplbmlkID0gPyBBTkQgYXBhcnRtZW50IElTIE5PVCBOVUxMIEFORCBhcGFydG1lbnQgPD4gXCJcIicsIFtwbGF5ZXJdKTtcbiAgICBjb25zdCBob3VzZXMgPSBhd2FpdCBVdGlscy5xdWVyeSgnU0VMRUNUIHByb3BlcnR5X2lkLCBvd25lcl9jaXRpemVuaWQsIHN0cmVldCwgZGVzY3JpcHRpb24sIGhhc19hY2Nlc3MsIHNoZWxsLCBkb29yX2RhdGEgRlJPTSBwcm9wZXJ0aWVzIFdIRVJFIG93bmVyX2NpdGl6ZW5pZCA9ID8gQU5EIGFwYXJ0bWVudCBJUyBOVUxMJywgW3BsYXllcl0pO1xuICAgIGNvbnN0IHJlcyA9IHtcbiAgICAgICAgYXBhcnRtZW50czogYXBhcnRtZW50cyxcbiAgICAgICAgaG91c2VzOiBob3VzZXNcbiAgICB9XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHJlcyk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0S2V5SG9sZGVyTmFtZXMnLCBhc3luYyAoY2xpZW50LCBkYXRhKSA9PiB7XG4gICAgY29uc3QgcmVzID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBsZXQgbmFtZU1hcDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuXG4gICAgaWYgKHJlcyAmJiByZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBQcm9jZXNzIGFsbCBob3VzZXMgaW4gcGFyYWxsZWxcbiAgICAgICAgY29uc3QgYXBhcnRtZW50UHJvbWlzZXMgPSByZXMubWFwKChob3VzZTogc3RyaW5nKSA9PlxuICAgICAgICAgICAgVXRpbHMucXVlcnkoJ1NFTEVDVCBjaXRpemVuaWQsIGNoYXJpbmZvIEZST00gcGxheWVycyBXSEVSRSBjaXRpemVuaWQgPSA/JywgW2hvdXNlXSlcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBhbGxBcGFydG1lbnRzID0gYXdhaXQgUHJvbWlzZS5hbGwoYXBhcnRtZW50UHJvbWlzZXMpO1xuXG4gICAgICAgIGFsbEFwYXJ0bWVudHMuZm9yRWFjaChhcGFydG1lbnRzID0+IHtcbiAgICAgICAgICAgIC8qIGNvbnNvbGUubG9nKGFwYXJ0bWVudHMpOyAqL1xuICAgICAgICAgICAgaWYgKGFwYXJ0bWVudHMgJiYgYXBhcnRtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgYXBhcnRtZW50cy5mb3JFYWNoKChhcGFydG1lbnQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGFyaW5mbyA9IEpTT04ucGFyc2UoYXBhcnRtZW50LmNoYXJpbmZvKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnVsbE5hbWUgPSBgJHtjaGFyaW5mby5maXJzdG5hbWV9ICR7Y2hhcmluZm8ubGFzdG5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgbmFtZU1hcFthcGFydG1lbnQuY2l0aXplbmlkXSA9IGZ1bGxOYW1lO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobmFtZU1hcCk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygncmVtb3ZlQWNjZXNzJywgYXN5bmMgKGNsaWVudCwgZGF0YSkgPT4ge1xuICAgIGNvbnN0IHsgaWQsIGNpZCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBob3VzZTogYW55ID0gYXdhaXQgVXRpbHMucXVlcnkoJ1NFTEVDVCAqIEZST00gcHJvcGVydGllcyBXSEVSRSBwcm9wZXJ0eV9pZCA9ID8nLCBbaWRdKTtcbiAgICBpZiAoaG91c2UgJiYgaG91c2UubGVuZ3RoID4gMCkge1xuICAgICAgICBjb25zdCBob3VzZURhdGEgPSBob3VzZVswXTtcbiAgICAgICAgY29uc3QgaGFzQWNjZXNzID0gSlNPTi5wYXJzZShob3VzZURhdGEuaGFzX2FjY2Vzcyk7XG4gICAgICAgIGNvbnN0IG5ld0FjY2VzcyA9IGhhc0FjY2Vzcy5maWx0ZXIoKGFjY2Vzczogc3RyaW5nKSA9PiBhY2Nlc3MgIT09IGNpZCk7XG4gICAgICAgIC8qIGNvbnNvbGUubG9nKG5ld0FjY2Vzcyk7ICovXG4gICAgICAgIGF3YWl0IFV0aWxzLnF1ZXJ5KCdVUERBVEUgcHJvcGVydGllcyBTRVQgaGFzX2FjY2VzcyA9ID8gV0hFUkUgcHJvcGVydHlfaWQgPSA/JywgW0pTT04uc3RyaW5naWZ5KG5ld0FjY2VzcyksIGlkXSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX3Byb3BlcnRpZXMnLFxuICAgICAgICAgICAgdGl0bGU6ICdBY2Nlc3MgUmVtb3ZlZCcsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQWNjZXNzIHJlbW92ZWQgZnJvbSAke2NpZH0gdG8gJHtob3VzZURhdGEuc3RyZWV0fSwgJHtob3VzZURhdGEucHJvcGVydHlfaWR9IGJ5ICR7YXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNsaWVudCkpfWAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn0pOyIsICJpbXBvcnQgeyBvbkNsaWVudENhbGxiYWNrLCB0cmlnZ2VyQ2xpZW50Q2FsbGJhY2sgfSBmcm9tIFwiQG92ZXJleHRlbmRlZC9veF9saWIvc2VydmVyXCI7XG5pbXBvcnQgeyBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuXG5vbkNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpjcmVhdGVQb3N0JywgYXN5bmMgKHNvdXJjZSwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0aXRsZSwgY29udGVudCwgaW1hZ2VBdHRhY2htZW50LCBwaG9uZU51bWJlciwgZW1haWwgfSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgY29uc3QgZGF0YVggPSB7XG4gICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLFxuICAgICAgICBjb250ZW50LFxuICAgICAgICBpbWFnZUF0dGFjaG1lbnQsXG4gICAgICAgIHBob25lTnVtYmVyLFxuICAgICAgICBlbWFpbCxcbiAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9O1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9ibHVlcGFnZXMnLCBkYXRhWCk7XG4gICAgYXdhaXQgdHJpZ2dlckNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpyZWZyZXNoUG9zdHMnLCAtMSwgSlNPTi5zdHJpbmdpZnkoZGF0YVgpKTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX2JsdWVwYWdlcycsXG4gICAgICAgIHRpdGxlOiAnUG9zdCBDcmVhdGVkJyxcbiAgICAgICAgbWVzc2FnZTogYFBvc3QgJyR7dGl0bGV9JyAoSUQ6ICR7ZGF0YVguX2lkfSkgY3JlYXRlZCBieSAke3Bob25lTnVtYmVyIHx8IGVtYWlsfSwgY29udGVudDogJHtjb250ZW50fWAsXG4gICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICB9KTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpnZXRQb3N0cycsIGFzeW5jIChzb3VyY2UpID0+IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9ibHVlcGFnZXMnLCB7fSwgbnVsbCwgZmFsc2UsIHtcbiAgICAgICAgc29ydDogeyBjcmVhdGVkQXQ6IC0xIH1cbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdibHVlcGFnZTpkZWxldGVQb3N0JywgYXN5bmMgKHNvdXJjZSwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgcG9zdCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmx1ZXBhZ2VzJywgeyBfaWQ6IGRhdGEgfSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5kZWxldGVPbmUoJ3Bob25lX2JsdWVwYWdlcycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIGF3YWl0IHRyaWdnZXJDbGllbnRDYWxsYmFjaygnYmx1ZXBhZ2U6cmVmcmVzaERlbGV0ZVBvc3QnLCAtMSwgZGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9ibHVlcGFnZXMnLFxuICAgICAgICB0aXRsZTogJ1Bvc3QgRGVsZXRlZCcsXG4gICAgICAgIG1lc3NhZ2U6IGBQb3N0ICcke3Bvc3QudGl0bGV9JyAoSUQ6ICR7ZGF0YX0pIGRlbGV0ZWQgYnkgJHtwb3N0LnBob25lTnVtYmVyIHx8IHBvc3QuZW1haWx9LCBjb250ZW50OiAke3Bvc3QuY29udGVudH1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjaywgdHJpZ2dlckNsaWVudENhbGxiYWNrIH0gZnJvbSBcIkBvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlclwiO1xuaW1wb3J0IHsgVXRpbHMgfSBmcm9tIFwiQHNlcnZlci9jbGFzc2VzL1V0aWxzXCI7XG5pbXBvcnQgeyBGcmFtZXdvcmsgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBHYXJhZ2VEYXRhIH0gZnJvbSBcIi4uLy4uLy4uLy4uL3R5cGVzL3R5cGVzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5pbnRlcmZhY2UgVmVoaWNsZURhdGEge1xuICAgIHZlaGljbGU6IHN0cmluZztcbiAgICBwbGF0ZTogc3RyaW5nO1xuICAgIGdhcmFnZTogc3RyaW5nO1xuICAgIG1vZHM6IHN0cmluZztcbiAgICBzdGF0ZTogbnVtYmVyO1xuICAgIGRlcG90cHJpY2U6IHN0cmluZztcbn1cblxub25DbGllbnRDYWxsYmFjaygnZ2FyYWdlOmdldEdhcmFnZURhdGEnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICBsZXQgcmVzRGF0YTogR2FyYWdlRGF0YVtdID0gW107XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBVdGlscy5xdWVyeShgU0VMRUNUIHZlaGljbGUscGxhdGUsZ2FyYWdlLG1vZHMsc3RhdGUsZGVwb3RwcmljZSBGUk9NIHBsYXllcl92ZWhpY2xlcyBXSEVSRSBjaXRpemVuaWQgPSA/YCwgW2NpdGl6ZW5JZF0pIGFzIFZlaGljbGVEYXRhW107XG4gICAgY29uc3QgdmVoaWNsZURhdGEgPSBGcmFtZXdvcmsuU2hhcmVkLlZlaGljbGVzO1xuICAgIFxuICAgIGZvciAoY29uc3QgdmVoaWNsZSBvZiByZXMpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IHZlaGljbGVEYXRhW3ZlaGljbGUudmVoaWNsZV07XG4gICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAvLyBEZXRlcm1pbmUgdmVoaWNsZSBzdGF0ZSB3aXRoIGJldHRlciBsb2dpY1xuICAgICAgICAgICAgbGV0IHN0YXRlOiBzdHJpbmc7XG4gICAgICAgICAgICBpZiAodmVoaWNsZS5zdGF0ZSA9PT0gMikge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gXCJJbXBvdW5kZWRcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodmVoaWNsZS5zdGF0ZSA9PT0gMSkge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gXCJQYXJrZWRcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoTnVtYmVyKHZlaGljbGUuZGVwb3RwcmljZSkgPiAwKSB7XG4gICAgICAgICAgICAgICAgc3RhdGUgPSBcIkRlcG90XCI7IC8vIENoYW5nZWQgZnJvbSBcIkRlcG90ZWRcIiB0byBcIkRlcG90XCIgYXMgcmVxdWVzdGVkXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN0YXRlID0gXCJPdXRcIjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVzRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICBwbGF0ZTogdmVoaWNsZS5wbGF0ZSxcbiAgICAgICAgICAgICAgICBnYXJhZ2U6IHZlaGljbGUuZ2FyYWdlLFxuICAgICAgICAgICAgICAgIHN0YXRlOiBzdGF0ZSxcbiAgICAgICAgICAgICAgICBjYXRlZ29yeTogZGF0YS5jYXRlZ29yeSxcbiAgICAgICAgICAgICAgICBicmFuZDogZGF0YS5icmFuZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBkYXRhLm5hbWUsXG4gICAgICAgICAgICAgICAgdHVyYm9JbnN0YWxsZWQ6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RUdXJibyxcbiAgICAgICAgICAgICAgICBib2R5SGVhbHRoOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykuYm9keUhlYWx0aCxcbiAgICAgICAgICAgICAgICB0YW5rSGVhbHRoOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykudGFua0hlYWx0aCxcbiAgICAgICAgICAgICAgICBmdWVsTGV2ZWw6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5mdWVsTGV2ZWwsXG4gICAgICAgICAgICAgICAgZW5naW5lSGVhbHRoOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykuZW5naW5lSGVhbHRoLFxuICAgICAgICAgICAgICAgIG1vZFN1c3BlbnNpb246IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RTdXNwZW5zaW9uLFxuICAgICAgICAgICAgICAgIG1vZFRyYW5zbWlzc2lvbjogSlNPTi5wYXJzZSh2ZWhpY2xlLm1vZHMpLm1vZFRyYW5zbWlzc2lvbixcbiAgICAgICAgICAgICAgICBtb2RFbmdpbmU6IEpTT04ucGFyc2UodmVoaWNsZS5tb2RzKS5tb2RFbmdpbmUsXG4gICAgICAgICAgICAgICAgbW9kQnJha2VzOiBKU09OLnBhcnNlKHZlaGljbGUubW9kcykubW9kQnJha2VzLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocmVzRGF0YSk7XG59KTsiLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgTG9nZ2VyLCBNb25nb0RCIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgZ2VuZXJhdGVVVWlkIH0gZnJvbSBcIkBzaGFyZWQvdXRpbHNcIjtcbmltcG9ydCB7IFdhbGxldEFjY291bnQgfSBmcm9tIFwiLi4vLi4vLi4vLi4vdHlwZXMvdHlwZXNcIjtcbmltcG9ydCB7IERhdGVUaW1lIH0gZnJvbSAnbHV4b24nO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiOyAvLyBhZGp1c3QgcGF0aCBhcyBuZWVkZWRcblxuZnVuY3Rpb24gR2VuZXJhdGVDYXJkTnVtYmVyKCkge1xuICAgIGxldCBjYXJkTnVtYmVyID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAxNjsgaSsrKSB7XG4gICAgICAgIGNhcmROdW1iZXIgKz0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTApO1xuICAgIH1cbiAgICByZXR1cm4gY2FyZE51bWJlcjtcbn1cblxuZnVuY3Rpb24gR2VuZXJhdGVCYW5rQWNjb3VudE51bWJlcigpIHtcbiAgICBjb25zdCBpbml0aWFscyA9IFwiU01SVFwiO1xuICAgIGxldCBhY2NvdW50TnVtYmVyID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAxMDsgaSsrKSB7XG4gICAgICAgIGFjY291bnROdW1iZXIgKz0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTApO1xuICAgIH1cbiAgICByZXR1cm4gYCR7aW5pdGlhbHN9XyR7YWNjb3VudE51bWJlcn1gO1xufVxuXG5vbkNsaWVudENhbGxiYWNrKCd3YWxsZXQ6bG9naW4nLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKHNvdXJjZSk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdwaG9uZV9iYW5rX3VzZXInLCB7IGNpdGl6ZW5JZDogY2l0aXplbklkLlBsYXllckRhdGEuY2l0aXplbmlkIH0pO1xuICAgIGlmIChyZXMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIC4uLnJlcyxcbiAgICAgICAgICAgIGJhbGFuY2U6IGF3YWl0IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLm1vbmV5LmJhbmssXG4gICAgICAgICAgICBjYXNpbm86IGF3YWl0IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLm1vbmV5LmNhc2lub1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBuYW1lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKTtcbiAgICAgICAgY29uc3QgY2FyZE51bWJlciA9IEdlbmVyYXRlQ2FyZE51bWJlcigpO1xuICAgICAgICBjb25zdCBjYXJkUGluID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDApO1xuICAgICAgICBjb25zdCBiYW5rQWNjb3VudCA9IEdlbmVyYXRlQmFua0FjY291bnROdW1iZXIoKTtcbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICBjaXRpemVuSWQ6IGNpdGl6ZW5JZC5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICBjYXJkTnVtYmVyOiBjYXJkTnVtYmVyLFxuICAgICAgICAgICAgY2FyZFBpbjogY2FyZFBpbixcbiAgICAgICAgICAgIGJhbmtBY2NvdW50OiBiYW5rQWNjb3VudCxcbiAgICAgICAgICAgIGJhbGFuY2U6IDBcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmFua191c2VyJywgZGF0YSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAuLi5kYXRhLFxuICAgICAgICAgICAgYmFsYW5jZTogY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuYmFuayxcbiAgICAgICAgICAgIGNhc2lubzogY2l0aXplbklkLlBsYXllckRhdGEubW9uZXkuY2FzaW5vXG4gICAgICAgIH0pO1xuICAgIH1cbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdnZXREZXRhaWxzWFMnLCBhc3luYyAoY2xpZW50LCBudW1iZXIpID0+IHtcbiAgICBsZXQgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0Q2l0aXplbklkQnlQaG9uZU51bWJlcihTdHJpbmcobnVtYmVyKSk7XG4gICAgaWYgKGNpdGl6ZW5JZCkge1xuICAgICAgICBjb25zdCByZXM6IFdhbGxldEFjY291bnQgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2JhbmtfdXNlcicsIHsgY2l0aXplbklkOiBjaXRpemVuSWQgfSk7XG4gICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgIHJldHVybiByZXMuYmFua0FjY291bnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygndHJhbnNYQWRxYXNkZGFzZGZlck1vbmV5JywgYXN5bmMgKGNsaWVudCwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyBhbW91bnQsIHRvIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGNvbnN0IHJlczogV2FsbGV0QWNjb3VudCA9IGF3YWl0IE1vbmdvREIuZmluZE9uZSgncGhvbmVfYmFua191c2VyJywgeyBiYW5rQWNjb3VudDogdG8gfSk7XG4gICAgaWYgKCFyZXMpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQocmVzLmNpdGl6ZW5JZCk7XG4gICAgY29uc3Qgc291cmNlUGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihjbGllbnQpO1xuICAgIGlmICghYXdhaXQgRG9lc1BsYXllckV4aXN0KHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoc291cmNlUGxheWVyLlBsYXllckRhdGEubW9uZXkuYmFuayA8IGFtb3VudCkgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChhd2FpdCBzb3VyY2VQbGF5ZXIuRnVuY3Rpb25zLlJlbW92ZU1vbmV5KCdiYW5rJywgYW1vdW50KSkge1xuICAgICAgICB0YXJnZXRQbGF5ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KCdiYW5rJywgYW1vdW50KTtcbiAgICAgICAgZW1pdE5ldCgncGhvbmU6YWRkbm90aUZpY2F0aW9uJywgY2xpZW50LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICB0aXRsZTogJ1dhbGxldCcsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBoYXZlIHRyYW5zZmVycmVkICQke2Ftb3VudH0gdG8gJHtyZXMubmFtZX0uYCxcbiAgICAgICAgICAgIGFwcDogJ3NldHRpbmdzJyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgfSkpO1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiAnV2FsbGV0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgcmVjZWl2ZWQgJCR7YW1vdW50fSBmcm9tICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfS5gLFxuICAgICAgICAgICAgYXBwOiAnc2V0dGluZ3MnLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMFxuICAgICAgICB9KSk7XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2JhbmtfdHJhbnNhY3Rpb25zJywge1xuICAgICAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIGZyb206IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCxcbiAgICAgICAgICAgIHRvOiByZXMuY2l0aXplbklkLFxuICAgICAgICAgICAgYW1vdW50OiBhbW91bnQsXG4gICAgICAgICAgICB0eXBlOiAnZGViaXQnLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgncGhvbmVfYmFua190cmFuc2FjdGlvbnMnLCB7XG4gICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgZnJvbTogcmVzLmNpdGl6ZW5JZCxcbiAgICAgICAgICAgIHRvOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgICAgICBhbW91bnQ6IGFtb3VudCxcbiAgICAgICAgICAgIHR5cGU6ICdjcmVkaXQnLFxuICAgICAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9iYW5rX3RyYW5zYWN0aW9ucycsXG4gICAgICAgICAgICB0aXRsZTogJ01vbmV5IFRyYW5zZmVyJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIHRyYW5zZmVycmVkICQke2Ftb3VudH0gdG8gJHtyZXMubmFtZX0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ2V0VHJhbnNhY3Rpb25zJywgYXN5bmMgKGNsaWVudCkgPT4ge1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKGNsaWVudCk7XG4gICAgY29uc3QgdHJhbnNhY3Rpb25zID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYmFua190cmFuc2FjdGlvbnMnLCB7IGZyb206IGNpdGl6ZW5JZCB9LCBudWxsLCBmYWxzZSwge1xuICAgICAgICBzb3J0OiB7IGRhdGU6IC0xIH1cbiAgICB9KTtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodHJhbnNhY3Rpb25zKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd3YWxsZXQ6Y3JlYXRlSW52b2ljZScsIGFzeW5jIChjbGllbnQsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgZGVzY3JpcHRpb24sIGFtb3VudCwgcGF5bWVudFRpbWUsIG51bWJlck9mUGF5bWVudHMsIGlzQnVzaW5lc3MsIHJlY2VpdmVyLCB9ID0gSlNPTi5wYXJzZShkYXRhKSBhcyB7XG4gICAgICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gICAgICAgIGFtb3VudDogbnVtYmVyO1xuICAgICAgICBwYXltZW50VGltZTogbnVtYmVyO1xuICAgICAgICBudW1iZXJPZlBheW1lbnRzOiBudW1iZXI7XG4gICAgICAgIGlzQnVzaW5lc3M6ICdObycgfCAnWWVzJztcbiAgICAgICAgcmVjZWl2ZXI6IHN0cmluZztcbiAgICB9OyAvLyBwYXltZW50VGltZSA9IDAgZm9yIGRhaWx5LCAxIGZvciB3ZWVrbHksIDIgZm9yIG1vbnRobHkgYW5kIDMgZm9yIHF1YXJ0ZXJseSBhbmQgNCBmb3IgeWVhcmx5XG5cbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyKGNsaWVudCk7XG4gICAgY29uc3QgdGFyZ2V0UGxheWVyID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihyZWNlaXZlcik7XG4gICAgaWYgKCF0YXJnZXRQbGF5ZXIpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoYW1vdW50IDwgMCkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuaW5zZXJ0T25lKCdwaG9uZV9iYW5rX2ludm9pY2VzJywge1xuICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICBmcm9tOiBzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgIHRvOiB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaXRpemVuaWQsXG4gICAgICAgIGFtb3VudDogYW1vdW50LFxuICAgICAgICBzdGF0dXM6ICdwZW5kaW5nJyxcbiAgICAgICAgaXNCdXNpbmVzcyxcbiAgICAgICAgc291cmNlTmFtZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfWAsXG4gICAgICAgIHRhcmdldE5hbWU6IGAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24sXG4gICAgICAgIHBheW1lbnRUaW1lOiBwYXltZW50VGltZSxcbiAgICAgICAgbnVtYmVyT2ZQYXltZW50czogbnVtYmVyT2ZQYXltZW50cyxcbiAgICAgICAgZGF0ZTogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgfSk7XG4gICAgaWYgKHJlcykge1xuICAgICAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCB0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiAnV2FsbGV0JyxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBgJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IGhhcyBzZW50IHlvdSBhbiBpbnZvaWNlIG9mICQke2Ftb3VudH0uYCxcbiAgICAgICAgICAgIGFwcDogJ3NldHRpbmdzJyxcbiAgICAgICAgICAgIHRpbWVvdXQ6IDUwMDBcbiAgICAgICAgfSkpO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9iYW5rX2ludm9pY2VzJyxcbiAgICAgICAgICAgIHRpdGxlOiAnSW52b2ljZSBDcmVhdGVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gaGFzIHNlbnQgYW4gaW52b2ljZSBvZiAkJHthbW91bnR9IHRvICR7dGFyZ2V0UGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCd3YWxsZXQ6Z2V0SW52b2ljZXMnLCBhc3luYyAoY2xpZW50LCB0eXBlKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2UoY2xpZW50KTtcbiAgICBpZiAodHlwZSA9PT0gJ3NlbnQnKSB7XG4gICAgICAgIGNvbnN0IGludm9pY2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfYmFua19pbnZvaWNlcycsIHsgZnJvbTogY2l0aXplbklkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGRhdGU6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShpbnZvaWNlcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgaW52b2ljZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdwaG9uZV9iYW5rX2ludm9pY2VzJywgeyB0bzogY2l0aXplbklkIH0sIG51bGwsIGZhbHNlLCB7XG4gICAgICAgICAgICBzb3J0OiB7IGRhdGU6IC0xIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShpbnZvaWNlcyk7XG4gICAgfVxufSk7XG5cbnR5cGUgUmVjdXJyZW5jZSA9IDAgfCAxIHwgMiB8IDMgfCA0OyAvLyBkYWlseSwgd2Vla2x5LCBtb250aGx5LCBxdWFydGVybHksIHllYXJseVxuXG5pbnRlcmZhY2UgUGhvbmVCYW5rSW52b2ljZURvYyB7XG4gICAgX2lkOiBzdHJpbmc7XG4gICAgZnJvbTogc3RyaW5nOyAvLyBjaXRpemVuaWQgb2Ygc2VuZGVyICh0aGUgcGVyc29uL2J1c2luZXNzIHJlcXVlc3RpbmcgbW9uZXkpXG4gICAgdG86IHN0cmluZzsgICAvLyBjaXRpemVuaWQgb2YgdGFyZ2V0ICh0aGUgcGVyc29uIHdobyBwYXlzIHdoZW4gYWNjZXB0aW5nKVxuICAgIGFtb3VudDogbnVtYmVyO1xuICAgIHRhcmdldE5hbWU6IHN0cmluZztcbiAgICBzb3VyY2VOYW1lOiBzdHJpbmc7XG4gICAgc3RhdHVzOiAncGVuZGluZycgfCAnYWN0aXZlJyB8ICdwYWlkJyB8ICdjb21wbGV0ZWQnIHwgJ2RlY2xpbmVkJyB8ICdvdmVyZHVlJztcbiAgICBpc0J1c2luZXNzOiAnTm8nIHwgJ1llcyc7XG4gICAgcGF5bWVudFRpbWU6IFJlY3VycmVuY2UgfCAnJzsgLy8gJycgbWVhbnMgb25lLXRpbWUsIGVsc2UgcmVjdXJyZW5jZSBjb2RlXG4gICAgbnVtYmVyT2ZQYXltZW50czogbnVtYmVyIHwgJyc7Ly8gJycgbWVhbnMgb25lLXRpbWUsIGVsc2UgdG90YWwgcGF5bWVudHNcbiAgICByZW1haW5pbmdQYXltZW50cz86IG51bWJlcjsgICAvLyBtYWludGFpbmVkIGZvciByZWN1cnJpbmdcbiAgICBuZXh0UGF5bWVudERhdGU/OiBzdHJpbmcgfCBudWxsOyAvLyBJU09cbiAgICBsYXN0QXR0ZW1wdEF0Pzogc3RyaW5nIHwgbnVsbDsgICAvLyBJU09cbiAgICBmYWlsZWRBdHRlbXB0cz86IG51bWJlcjtcbiAgICBjcmVhdGVkQXQ/OiBzdHJpbmc7IC8vIElTT1xuICAgIGRhdGU/OiBzdHJpbmc7IC8vIHlvdXIgb3JpZ2luYWwgZmllbGRcbn1cblxuY29uc3QgQ09MTEVDVElPTiA9ICdwaG9uZV9iYW5rX2ludm9pY2VzJztcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBRQiBoZWxwZXJzIChhZGp1c3QgaWYgeW91ciBleHBvcnRzIGRpZmZlcilcbi8vIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuY29uc3QgZ2V0UGxheWVyQnlTb3VyY2UgPSBhc3luYyAoc3JjOiBudW1iZXIpID0+IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc3JjKTtcbmNvbnN0IGdldFBsYXllckJ5Q2l0aXplbklkID0gYXN5bmMgKGNpZDogc3RyaW5nKSA9PiBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQ/LihjaWQpO1xuXG4vLyBNb25leSBvcHM6IHJldHVybiBib29sZWFuIHN1Y2Nlc3NcbmNvbnN0IGRlYml0QmFuayA9IChwbGF5ZXI6IGFueSwgYW1vdW50OiBudW1iZXIpID0+IHBsYXllcj8uRnVuY3Rpb25zPy5SZW1vdmVNb25leT8uKCdiYW5rJywgYW1vdW50LCAnaW52b2ljZV9wYXltZW50JykgPz8gZmFsc2U7XG5jb25zdCBjcmVkaXRCYW5rID0gKHBsYXllcjogYW55LCBhbW91bnQ6IG51bWJlcikgPT4gcGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leSgnYmFuaycsIGFtb3VudCwgJ2ludm9pY2VfcmVjZWl2ZWQnKSA/PyBmYWxzZTtcblxuY29uc3Qgbm90aWZ5ID0gKHNyYzogbnVtYmVyLCB0aXRsZTogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nLCB0aW1lb3V0ID0gNTAwMCkgPT4ge1xuICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHNyYywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlLCBkZXNjcmlwdGlvbiwgYXBwOiAnc2V0dGluZ3MnLCB0aW1lb3V0XG4gICAgfSkpO1xufTtcblxuY29uc3Qgbm93SVNPID0gKCkgPT4gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuXG5jb25zdCBhZGRJbnRlcnZhbCA9IChpc286IHN0cmluZywgcmVjOiBSZWN1cnJlbmNlKTogc3RyaW5nID0+IHtcbiAgICBjb25zdCBkID0gbmV3IERhdGUoaXNvKTtcbiAgICBzd2l0Y2ggKHJlYykge1xuICAgICAgICBjYXNlIDA6IGQuc2V0RGF0ZShkLmdldERhdGUoKSArIDEpOyBicmVhazsgICAgICAgLy8gZGFpbHlcbiAgICAgICAgY2FzZSAxOiBkLnNldERhdGUoZC5nZXREYXRlKCkgKyA3KTsgYnJlYWs7ICAgICAgIC8vIHdlZWtseVxuICAgICAgICBjYXNlIDI6IGQuc2V0TW9udGgoZC5nZXRNb250aCgpICsgMSk7IGJyZWFrOyAgICAgLy8gbW9udGhseVxuICAgICAgICBjYXNlIDM6IGQuc2V0TW9udGgoZC5nZXRNb250aCgpICsgMyk7IGJyZWFrOyAgICAgLy8gcXVhcnRlcmx5XG4gICAgICAgIGNhc2UgNDogZC5zZXRGdWxsWWVhcihkLmdldEZ1bGxZZWFyKCkgKyAxKTsgYnJlYWs7IC8vIHllYXJseVxuICAgIH1cbiAgICByZXR1cm4gZC50b0lTT1N0cmluZygpO1xufTtcblxuLy8gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG4vLyBCdXNpbmVzcyBzYWZlIGRlcG9zaXQgKGN1c3RvbWl6ZSBmb3IgeW91ciBmcmFtZXdvcmspXG4vLyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcbi8qKlxuICogVHJ5IHRvIGRlcG9zaXQgaW50byBhIGJ1c2luZXNzIG1hbmFnZW1lbnQgc2FmZS5cbiAqIFN0cmF0ZWd5OlxuICogICAtIElmIHRoZSBwYXllciBpcyBwYXlpbmcgdG8gYSBidXNpbmVzcyAoaW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJyksXG4gKiAgICAgd2UgZGVwb3NpdCB0aGUgbW9uZXkgaW50byB0aGUgUkVDRUlWRVIncyBqb2Igc2FmZS5cbiAqICAgLSBZb3UgbWlnaHQgd2FudCB0byBjaGFuZ2UgdGhpcyB0byBhIHNwZWNpZmljIGJ1c2luZXNzIGlkIG9uIHRoZSBpbnZvaWNlLFxuICogICAgIG9yIGEgcHJvdmlkZWQgb3JnIGtleS4gRWRpdCBhcyBuZWVkZWQuXG4gKi9cbmNvbnN0IGRlcG9zaXRUb01hbmFnZW1lbnRTYWZlID0gYXN5bmMgKHJlY2VpdmVyQ2l0aXplbklkOiBzdHJpbmcsIGFtb3VudDogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcmVjZWl2ZXIgPSBhd2FpdCBnZXRQbGF5ZXJCeUNpdGl6ZW5JZChyZWNlaXZlckNpdGl6ZW5JZCk7XG4gICAgICAgIGNvbnN0IGpvYk5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHJlY2VpdmVyPy5QbGF5ZXJEYXRhPy5qb2I/Lm5hbWU7XG4gICAgICAgIGNvbnN0IFBsYXllck5hbWUgPSByZWNlaXZlciA/IGAke3JlY2VpdmVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3JlY2VpdmVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9YCA6ICdVbmtub3duJztcbiAgICAgICAgLy8gVE9ETzogVXBkYXRlIHRoaXMgdG8geW91ciBhY3R1YWwgbWFuYWdlbWVudCByZXNvdXJjZSBBUEk6XG4gICAgICAgIC8vIENvbW1vbiBRQkNvcmUgZWNvc3lzdGVtIHVzZXMgcWItbWFuYWdlbWVudDogQWRkTW9uZXkoam9iTmFtZSwgYW1vdW50KVxuICAgICAgICBpZiAoam9iTmFtZSkge1xuICAgICAgICAgICAgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uYWRkQWNjb3VudE1vbmV5KGpvYk5hbWUsIGFtb3VudCk7XG4gICAgICAgICAgICAvKiBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihhY2NvdW50LCB0aXRsZSwgYW1vdW50LCBtZXNzYWdlLCBpc3N1ZXIsIHJlY2VpdmVyLCB0cmFuc1R5cGUsIHRyYW5zSUQpICovXG4gICAgICAgICAgICBleHBvcnRzWydSZW5ld2VkLUJhbmtpbmcnXS5oYW5kbGVUcmFuc2FjdGlvbihqb2JOYW1lLCBcIlBob25lIEJ1c2luZXNzIEFwcCBEZXBvc2l0XCIsIGFtb3VudCwgXCJEZXBvc2l0IGZyb20gZW1wbG95ZWUgdG8gbWFuYWdlbWVudCBzYWZlLlwiLCBqb2JOYW1lLCBQbGF5ZXJOYW1lLCAnZGVwb3NpdCcsIGdlbmVyYXRlVVVpZCgpKVxuICAgICAgICAgICAgZXhwb3J0c1snUmVuZXdlZC1CYW5raW5nJ10uaGFuZGxlVHJhbnNhY3Rpb24oam9iTmFtZSwgXCJQaG9uZSBCdXNpbmVzcyBBcHAgRGVwb3NpdFwiLCBhbW91bnQsIFwiRGVwb3NpdGVkIHRvIG1hbmFnZW1lbnQgc2FmZS5cIiwgUGxheWVyTmFtZSwgam9iTmFtZSwgJ3dpdGhkcmF3JywgZ2VuZXJhdGVVVWlkKCkpXG5cbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlY2VpdmVyKSB7XG4gICAgICAgICAgICByZXR1cm4gY3JlZGl0QmFuayhyZWNlaXZlciwgYW1vdW50KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdkZXBvc2l0VG9NYW5hZ2VtZW50U2FmZSBlcnJvcjonLCBlKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn07XG5cbi8vIEJhbmsgc3RhdGVtZW50IC8gbG9nZ2luZyAob3B0aW9uYWwgaG9vayBwb2ludClcbmNvbnN0IGxvZ0JhbmtFdmVudCA9ICh0eXBlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykgPT4gTG9nZ2VyLkFkZExvZyh7XG4gICAgdHlwZTogJ3Bob25lX2JhbmtfaW52b2ljZXMnLFxuICAgIHRpdGxlOiB0eXBlLFxuICAgIG1lc3NhZ2UsXG4gICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3dhbGxldDphY2NlcHRJbnZvaWNlUGF5bWVudCcsIGFzeW5jIChjbGllbnQ6IG51bWJlciwgaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBheWVyUGxheWVyID0gYXdhaXQgZ2V0UGxheWVyQnlTb3VyY2UoY2xpZW50KTsgLy8gdGhlIG9uZSBjbGlja2luZyBcImFjY2VwdFwiIChtdXN0IGVxdWFsIGludm9pY2UudG8pXG4gICAgaWYgKCFwYXllclBsYXllcikgcmV0dXJuIGZhbHNlO1xuXG4gICAgY29uc3QgcGF5ZXJDaWQ6IHN0cmluZyA9IHBheWVyUGxheWVyLlBsYXllckRhdGE/LmNpdGl6ZW5pZDtcbiAgICBjb25zdCBpbnZvaWNlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9KSBhcyBQaG9uZUJhbmtJbnZvaWNlRG9jO1xuICAgIGlmICghaW52b2ljZSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gU2FmZXR5IGNoZWNrc1xuICAgIGlmIChpbnZvaWNlLnRvICE9PSBwYXllckNpZCkgcmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbm90IHlvdXIgaW52b2ljZVxuICAgIGlmIChpbnZvaWNlLnN0YXR1cyAhPT0gJ3BlbmRpbmcnICYmIGludm9pY2Uuc3RhdHVzICE9PSAnYWN0aXZlJyAmJiBpbnZvaWNlLnN0YXR1cyAhPT0gJ292ZXJkdWUnKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGludm9pY2UuYW1vdW50IDw9IDApIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5mcm9tID09PSBpbnZvaWNlLnRvKSByZXR1cm4gZmFsc2U7ICAgICAgICAgICAgICAgICAgICAgIC8vIHNlbGYtaW52b2ljZSBzaWxsaW5lc3NcblxuICAgIGNvbnN0IHJlcXVlc3RlciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKGludm9pY2UuZnJvbSk7XG5cbiAgICBjb25zdCBjaGFyZ2VkID0gZGViaXRCYW5rKHBheWVyUGxheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgaWYgKCFjaGFyZ2VkKSB7XG4gICAgICAgIC8vIENvdWxkblx1MjAxOXQgY2hhcmdlIC0+IG92ZXJkdWUgZm9yIHJlY3VycmluZyBvciBrZWVwIHBlbmRpbmcgZm9yIG9uZS10aW1lP1xuICAgICAgICBjb25zdCBpc1JlY3VycmluZyA9IGludm9pY2UucGF5bWVudFRpbWUgIT09ICcnICYmIGludm9pY2UubnVtYmVyT2ZQYXltZW50cyAhPT0gJyc7XG4gICAgICAgIGlmIChpc1JlY3VycmluZykge1xuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6ICdvdmVyZHVlJyxcbiAgICAgICAgICAgICAgICBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSxcbiAgICAgICAgICAgICAgICBmYWlsZWRBdHRlbXB0czogKGludm9pY2UuZmFpbGVkQXR0ZW1wdHMgPz8gMCkgKyAxXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBub3RpZnkocGF5ZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgSW5zdWZmaWNpZW50IGZ1bmRzIHRvIHBheSAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBQYXlvdXRcbiAgICBsZXQgcGF5b3V0T2sgPSBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJykge1xuICAgICAgICBjb25zdCBjb21taXNzaW9uID0gMC4xO1xuICAgICAgICBjb25zdCBjb21taXNzaW9uQW1vdW50ID0gTWF0aC5yb3VuZChpbnZvaWNlLmFtb3VudCAqIGNvbW1pc3Npb24pO1xuICAgICAgICBjb25zdCBwYXlvdXRBbW91bnQgPSBNYXRoLnJvdW5kKGludm9pY2UuYW1vdW50IC0gY29tbWlzc2lvbkFtb3VudCk7XG4gICAgICAgIHBheW91dE9rID0gYXdhaXQgZGVwb3NpdFRvTWFuYWdlbWVudFNhZmUoaW52b2ljZS5mcm9tLCBwYXlvdXRBbW91bnQpO1xuICAgICAgICByZXF1ZXN0ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KCdiYW5rJywgY29tbWlzc2lvbkFtb3VudCwgJ2ludm9pY2VfcmVjZWl2ZWQnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwYXlvdXRPayA9IHJlcXVlc3RlciA/IGNyZWRpdEJhbmsocmVxdWVzdGVyLCBpbnZvaWNlLmFtb3VudCkgOiBmYWxzZTtcbiAgICB9XG5cbiAgICBpZiAoIXBheW91dE9rKSB7XG4gICAgICAgIC8vIFJlZnVuZCBwYXllciBzaW5jZSBwYXlvdXQgZmFpbGVkXG4gICAgICAgIGNyZWRpdEJhbmsocGF5ZXJQbGF5ZXIsIGludm9pY2UuYW1vdW50KTtcbiAgICAgICAgbm90aWZ5KHBheWVyUGxheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFBheW1lbnQgZmFpbGVkIHRvIGRlbGl2ZXIuIFJlZnVuZGVkICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIFVwZGF0ZSBpbnZvaWNlIHN0YXR1c1xuICAgIGNvbnN0IGlzUmVjdXJyaW5nID0gKGludm9pY2UucGF5bWVudFRpbWUgIT09ICcnICYmIGludm9pY2UubnVtYmVyT2ZQYXltZW50cyAhPT0gJycpO1xuICAgIGlmICghaXNSZWN1cnJpbmcpIHtcbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHtcbiAgICAgICAgICAgIHN0YXR1czogJ3BhaWQnLFxuICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiBudWxsLFxuICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IDAsXG4gICAgICAgICAgICBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKVxuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCB0b3RhbCA9IE51bWJlcihpbnZvaWNlLm51bWJlck9mUGF5bWVudHMpO1xuICAgICAgICBjb25zdCBwcmV2UmVtYWluaW5nID0gKGludm9pY2UucmVtYWluaW5nUGF5bWVudHMgPT0gbnVsbClcbiAgICAgICAgICAgID8gdG90YWwgICAgICAgICAgICAgICAgLy8gZmlyc3QgdGltZSBhY3RpdmF0aW9uXG4gICAgICAgICAgICA6IGludm9pY2UucmVtYWluaW5nUGF5bWVudHM7XG5cbiAgICAgICAgY29uc3QgbmV3UmVtYWluaW5nID0gTWF0aC5tYXgoMCwgcHJldlJlbWFpbmluZyAtIDEpO1xuXG4gICAgICAgIGxldCBuZXdTdGF0dXM6IFBob25lQmFua0ludm9pY2VEb2NbJ3N0YXR1cyddID0gJ2FjdGl2ZSc7XG4gICAgICAgIGxldCBuZXh0RGF0ZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIGlmIChuZXdSZW1haW5pbmcgPD0gMCkge1xuICAgICAgICAgICAgbmV3U3RhdHVzID0gJ2NvbXBsZXRlZCc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBiYXNlRGF0ZSA9IGludm9pY2UubmV4dFBheW1lbnREYXRlID8/IG5vd0lTTygpO1xuICAgICAgICAgICAgbmV4dERhdGUgPSBhZGRJbnRlcnZhbChiYXNlRGF0ZSwgTnVtYmVyKGludm9pY2UucGF5bWVudFRpbWUpIGFzIFJlY3VycmVuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGlkIH0sIHtcbiAgICAgICAgICAgIHN0YXR1czogbmV3U3RhdHVzLFxuICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IG5ld1JlbWFpbmluZyxcbiAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLFxuICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiBuZXh0RGF0ZSxcbiAgICAgICAgICAgIGNyZWF0ZWRBdDogaW52b2ljZS5jcmVhdGVkQXQgPz8gbm93SVNPKClcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gTm90aWZ5IGJvdGggc2lkZXNcbiAgICBub3RpZnkocGF5ZXJQbGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgUGFpZCAkJHtpbnZvaWNlLmFtb3VudH0gdG8gJHtpbnZvaWNlLnNvdXJjZU5hbWV9LmApO1xuICAgIGlmIChyZXF1ZXN0ZXI/LlBsYXllckRhdGE/LnNvdXJjZSkge1xuICAgICAgICBub3RpZnkocmVxdWVzdGVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBwYWlkIHlvdXIgaW52b2ljZSBvZiAkJHtpbnZvaWNlLmFtb3VudH0uYCk7XG4gICAgfVxuXG4gICAgbG9nQmFua0V2ZW50KCdJbnZvaWNlIFBheW1lbnQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IHBhaWQgJCR7aW52b2ljZS5hbW91bnR9IHRvICR7aW52b2ljZS5zb3VyY2VOYW1lfSR7aW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJyA/ICcgKGJ1c2luZXNzKScgOiAnJ30uYCk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnd2FsbGV0OmRlY2xpbmVJbnZvaWNlUGF5bWVudCcsIGFzeW5jIChjbGllbnQ6IG51bWJlciwgaWQ6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHBsYXllciA9IGF3YWl0IGdldFBsYXllckJ5U291cmNlKGNsaWVudCk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybiBmYWxzZTtcblxuICAgIGNvbnN0IGNpZCA9IHBsYXllci5QbGF5ZXJEYXRhPy5jaXRpemVuaWQ7XG4gICAgY29uc3QgaW52b2ljZSA9IGF3YWl0IE1vbmdvREIuZmluZE9uZShDT0xMRUNUSU9OLCB7IF9pZDogaWQgfSkgYXMgUGhvbmVCYW5rSW52b2ljZURvYztcbiAgICBpZiAoIWludm9pY2UpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoaW52b2ljZS50byAhPT0gY2lkKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKGludm9pY2Uuc3RhdHVzICE9PSAncGVuZGluZycgJiYgaW52b2ljZS5zdGF0dXMgIT09ICdhY3RpdmUnICYmIGludm9pY2Uuc3RhdHVzICE9PSAnb3ZlcmR1ZScpIHJldHVybiBmYWxzZTtcblxuICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpZCB9LCB7IHN0YXR1czogJ2RlY2xpbmVkJywgbmV4dFBheW1lbnREYXRlOiBudWxsIH0pO1xuXG4gICAgY29uc3QgcmVxdWVzdGVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS5mcm9tKTtcbiAgICBub3RpZnkocGxheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYERlY2xpbmVkIGludm9pY2Ugb2YgJCR7aW52b2ljZS5hbW91bnR9IGZyb20gJHtpbnZvaWNlLnNvdXJjZU5hbWV9LmApO1xuICAgIGlmIChyZXF1ZXN0ZXI/LlBsYXllckRhdGE/LnNvdXJjZSkge1xuICAgICAgICBub3RpZnkocmVxdWVzdGVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYCR7aW52b2ljZS50YXJnZXROYW1lfSBkZWNsaW5lZCB5b3VyIGludm9pY2Ugb2YgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgIH1cblxuICAgIGxvZ0JhbmtFdmVudCgnSW52b2ljZSBEZWNsaW5lZCcsIGAke2ludm9pY2UudGFyZ2V0TmFtZX0gZGVjbGluZWQgaW52b2ljZSBmcm9tICR7aW52b2ljZS5zb3VyY2VOYW1lfSBmb3IgJCR7aW52b2ljZS5hbW91bnR9LmApO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cblxuZXhwb3J0IGNvbnN0IEludm9pY2VSZWN1cnJpbmdQYXltZW50cyA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XG5cbiAgICBjb25zdCBkdWVJbnZvaWNlcyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoXG4gICAgICAgIENPTExFQ1RJT04sXG4gICAgICAgIHtcbiAgICAgICAgICAgIHN0YXR1czogeyAkaW46IFsnYWN0aXZlJywgJ292ZXJkdWUnXSB9LFxuICAgICAgICAgICAgbmV4dFBheW1lbnREYXRlOiB7ICRsdGU6IG5vdyB9LFxuICAgICAgICAgICAgcmVtYWluaW5nUGF5bWVudHM6IHsgJGd0OiAwIH1cbiAgICAgICAgfSxcbiAgICAgICAgbnVsbCxcbiAgICAgICAgZmFsc2UsXG4gICAgICAgIHsgc29ydDogeyBuZXh0UGF5bWVudERhdGU6IDEgfSwgbGltaXQ6IDUwIH0gLy8gcHJvY2VzcyBpbiBiYXRjaGVzXG4gICAgKSBhcyBQaG9uZUJhbmtJbnZvaWNlRG9jW107XG5cbiAgICBmb3IgKGNvbnN0IGludm9pY2Ugb2YgZHVlSW52b2ljZXMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBheWVyID0gYXdhaXQgZ2V0UGxheWVyQnlDaXRpemVuSWQoaW52b2ljZS50byk7XG4gICAgICAgICAgICBpZiAoIXBheWVyKSB7XG4gICAgICAgICAgICAgICAgLy8gUGF5ZXIgb2ZmbGluZSBcdTIwMTQgY2hvb3NlIHlvdXIgcG9saWN5LiBXZSdsbCBqdXN0IG1hcmsgYXR0ZW1wdCBhbmQgcmV0cnkgbGF0ZXIuXG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgJHNldDogeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSwgc3RhdHVzOiAnb3ZlcmR1ZScgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBUcnkgdG8gY2hhcmdlIHZpYSB0aGUgc2FtZSBhY2NlcHQgbG9naWMgY29yZSAoRFJZLWlzaCB3aXRoIGEgdGlueSBpbnRlcm5hbCBjYWxsKVxuICAgICAgICAgICAgLy8gV2UgaW5saW5lIG1pbmltYWwgbG9naWM6IGRlYml0IHBheWVyXG4gICAgICAgICAgICBjb25zdCBjaGFyZ2VkID0gZGViaXRCYW5rKHBheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgICAgICBpZiAoIWNoYXJnZWQpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZShDT0xMRUNUSU9OLCB7IF9pZDogaW52b2ljZS5faWQgfSwgeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSwgc3RhdHVzOiAnb3ZlcmR1ZScgfSk7XG4gICAgICAgICAgICAgICAgbm90aWZ5KHBheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFJlY3VycmluZyBpbnZvaWNlIG9mICQke2ludm9pY2UuYW1vdW50fSBmYWlsZWQgKGluc3VmZmljaWVudCBmdW5kcykuYCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFBheW91dFxuICAgICAgICAgICAgbGV0IHBheW91dE9rID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoaW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJykge1xuICAgICAgICAgICAgICAgIHBheW91dE9rID0gYXdhaXQgZGVwb3NpdFRvTWFuYWdlbWVudFNhZmUoaW52b2ljZS5mcm9tLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RlciA9IGF3YWl0IGdldFBsYXllckJ5Q2l0aXplbklkKGludm9pY2UuZnJvbSk7XG4gICAgICAgICAgICAgICAgcGF5b3V0T2sgPSByZXF1ZXN0ZXIgPyBjcmVkaXRCYW5rKHJlcXVlc3RlciwgaW52b2ljZS5hbW91bnQpIDogZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcGF5b3V0T2spIHtcbiAgICAgICAgICAgICAgICAvLyBSZWZ1bmRcbiAgICAgICAgICAgICAgICBjcmVkaXRCYW5rKHBheWVyLCBpbnZvaWNlLmFtb3VudCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHsgbGFzdEF0dGVtcHRBdDogbm93SVNPKCksIGZhaWxlZEF0dGVtcHRzOiAoaW52b2ljZS5mYWlsZWRBdHRlbXB0cyA/PyAwKSArIDEgfSk7XG4gICAgICAgICAgICAgICAgbm90aWZ5KHBheWVyLlBsYXllckRhdGEuc291cmNlLCAnV2FsbGV0JywgYFJlY3VycmluZyBpbnZvaWNlIHBheW91dCBmYWlsZWQ7IHJlZnVuZGVkICQke2ludm9pY2UuYW1vdW50fS5gKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUHJvZ3Jlc3MgcmVjdXJyZW5jZVxuICAgICAgICAgICAgY29uc3QgbmV3UmVtYWluaW5nID0gTWF0aC5tYXgoMCwgKGludm9pY2UucmVtYWluaW5nUGF5bWVudHMgPz8gTnVtYmVyKGludm9pY2UubnVtYmVyT2ZQYXltZW50cykpIC0gMSk7XG4gICAgICAgICAgICBsZXQgbmV3U3RhdHVzOiBQaG9uZUJhbmtJbnZvaWNlRG9jWydzdGF0dXMnXSA9ICdhY3RpdmUnO1xuICAgICAgICAgICAgbGV0IG5leHREYXRlOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKG5ld1JlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgICAgICAgICAgbmV3U3RhdHVzID0gJ2NvbXBsZXRlZCc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2UgPSBpbnZvaWNlLm5leHRQYXltZW50RGF0ZSA/PyBub3dJU08oKTtcbiAgICAgICAgICAgICAgICBuZXh0RGF0ZSA9IGFkZEludGVydmFsKGJhc2UsIE51bWJlcihpbnZvaWNlLnBheW1lbnRUaW1lKSBhcyBSZWN1cnJlbmNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoQ09MTEVDVElPTiwgeyBfaWQ6IGludm9pY2UuX2lkIH0sIHtcbiAgICAgICAgICAgICAgICByZW1haW5pbmdQYXltZW50czogbmV3UmVtYWluaW5nLFxuICAgICAgICAgICAgICAgIHN0YXR1czogbmV3U3RhdHVzLFxuICAgICAgICAgICAgICAgIGxhc3RBdHRlbXB0QXQ6IG5vd0lTTygpLFxuICAgICAgICAgICAgICAgIG5leHRQYXltZW50RGF0ZTogbmV4dERhdGVcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBub3RpZnkocGF5ZXIuUGxheWVyRGF0YS5zb3VyY2UsICdXYWxsZXQnLCBgQ2hhcmdlZCAkJHtpbnZvaWNlLmFtb3VudH0gZm9yIHJlY3VycmluZyBpbnZvaWNlICgke25ld1JlbWFpbmluZ30gbGVmdCkuYCk7XG4gICAgICAgICAgICBsb2dCYW5rRXZlbnQoJ1JlY3VycmluZyBJbnZvaWNlIFBheW1lbnQnLCBgJHtpbnZvaWNlLnRhcmdldE5hbWV9IHBhaWQgJCR7aW52b2ljZS5hbW91bnR9IHRvICR7aW52b2ljZS5zb3VyY2VOYW1lfSR7aW52b2ljZS5pc0J1c2luZXNzID09PSAnWWVzJyA/ICcgKGJ1c2luZXNzKScgOiAnJ30uYCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1JlY3VycmluZyBwYXltZW50IGVycm9yIGZvcicsIGludm9pY2UuX2lkLCBlKTtcbiAgICAgICAgICAgIGF3YWl0IE1vbmdvREIudXBkYXRlT25lKENPTExFQ1RJT04sIHsgX2lkOiBpbnZvaWNlLl9pZCB9LCB7XG4gICAgICAgICAgICAgICAgJHNldDogeyBsYXN0QXR0ZW1wdEF0OiBub3dJU08oKSwgZmFpbGVkQXR0ZW1wdHM6IChpbnZvaWNlLmZhaWxlZEF0dGVtcHRzID8/IDApICsgMSB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn07IiwgImltcG9ydCB7IG9uQ2xpZW50Q2FsbGJhY2ssIHRyaWdnZXJDbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IEZyYW1ld29yaywgTW9uZ29EQiwgTG9nZ2VyIH0gZnJvbSBcIkBzZXJ2ZXIvc3ZfbWFpblwiO1xuaW1wb3J0IHsgRGVsYXksIGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdncm91cHM6Z2V0bXVsdGlQbGVKb2JzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgY29uc3Qgc291cmNlUGxheWVyID0gZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGNvbnN0IGpvYnNEYXRhID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgncGhvbmVfbXVsdGlqb2JzJywgeyBjaXRpemVuSWQ6IHNvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZCB9KTtcbiAgICBjb25zdCBjdXJyZW50Sm9iID0gc291cmNlUGxheWVyLlBsYXllckRhdGEuam9iLm5hbWU7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHsgY3VycmVudEpvYiwgam9ic0RhdGEgfSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ3JvdXBzOmRlbGV0ZU11bHRpSm9iJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCBuYW1lID0gYXdhaXQgZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllck5hbWUoc291cmNlKTtcbiAgICBjb25zdCBqb2IgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX211bHRpam9icycsIHsgX2lkOiBkYXRhIH0pO1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IF9pZDogZGF0YSB9KTtcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ3Bob25lX211bHRpam9icycsXG4gICAgICAgIHRpdGxlOiAnSm9iIERlbGV0ZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtuYW1lfSBkZWxldGVkIGpvYiAke2pvYi5qb2JOYW1lfSAoJHtqb2IuY2l0aXplbklkfSlgLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG4gICAgcmV0dXJuIHRydWU7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnZ3JvdXBzOmNoYW5nZUpvYk9mUGxheWVyJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB7IGpvYk5hbWUsIGdyYWRlIH0gPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIGlmICgham9iTmFtZSkgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IHNvdXJjZVBsYXllciA9IGF3YWl0IGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRQbGF5ZXIoc291cmNlKTtcbiAgICBpZiAoIXNvdXJjZVBsYXllcikgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uQ2hlY2tKb2JHcmFkZShqb2JOYW1lLCBTdHJpbmcoZ3JhZGUpKSkge1xuICAgICAgICBzb3VyY2VQbGF5ZXIuRnVuY3Rpb25zLlNldEpvYihqb2JOYW1lLCBTdHJpbmcoZ3JhZGUpKTtcbiAgICAgICAgZW1pdE5ldCgnUUJDb3JlOk5vdGlmeScsIHNvdXJjZSwgYEpvYiBDaGFuZ2VkIHRvICR7am9iTmFtZX0gU3VjY2Vzc2Z1bGx5YCwgJ3N1Y2Nlc3MnKTtcbiAgICAgICAgZW1pdE5ldCgnZ3JvdXBzOnRvZ2dsZUR1dHknLCBOdW1iZXIoc291cmNlUGxheWVyLlBsYXllckRhdGEuc291cmNlKSk7XG4gICAgICAgIExvZ2dlci5BZGRMb2coe1xuICAgICAgICAgICAgdHlwZTogJ3Bob25lX211bHRpam9icycsXG4gICAgICAgICAgICB0aXRsZTogJ0pvYiBDaGFuZ2VkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gY2hhbmdlZCBqb2IgdG8gJyR7am9iTmFtZX0nIChHcmFkZTogJHtncmFkZX0pLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IE1vbmdvREIuZGVsZXRlT25lKCdwaG9uZV9tdWx0aWpvYnMnLCB7IGNpdGl6ZW5JZDogc291cmNlUGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLCBqb2JOYW1lIH0pO1xuICAgICAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgICAgIHR5cGU6ICdwaG9uZV9tdWx0aWpvYnMnLFxuICAgICAgICAgICAgdGl0bGU6ICdJbnZhbGlkIEpvYiBSZW1vdmVkJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0gYXR0ZW1wdGVkIHRvIGNoYW5nZSB0byBpbnZhbGlkIGpvYiAnJHtqb2JOYW1lfScsIHJlbW92ZWQgZnJvbSBtdWx0aS1qb2JzLmAsXG4gICAgICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufSk7XG5cbi8vIEludGVyZmFjZXNcbmludGVyZmFjZSBQbGF5ZXJEYXRhIHtcbiAgICBQbGF5ZXJEYXRhOiB7XG4gICAgICAgIGNoYXJpbmZvOiB7IGZpcnN0bmFtZTogc3RyaW5nOyBsYXN0bmFtZTogc3RyaW5nIH07XG4gICAgICAgIGNpdGl6ZW5pZDogc3RyaW5nO1xuICAgICAgICBzb3VyY2U6IG51bWJlcjtcbiAgICB9O1xufVxuXG5pbnRlcmZhY2UgR3JvdXBNZW1iZXIge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBDSUQ6IHN0cmluZztcbiAgICBQbGF5ZXI6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIEVtcGxveW1lbnRHcm91cCB7XG4gICAgaWQ6IG51bWJlcjtcbiAgICBzdGF0dXM6IHN0cmluZztcbiAgICBHTmFtZTogc3RyaW5nO1xuICAgIEdQYXNzOiBzdHJpbmc7XG4gICAgR0xvZ286IHN0cmluZztcbiAgICBVc2VyczogbnVtYmVyO1xuICAgIGxlYWRlcjogbnVtYmVyO1xuICAgIG1lbWJlcnM6IEdyb3VwTWVtYmVyW107XG4gICAgc3RhZ2U6IGFueVtdO1xuICAgIFNjcmlwdENyZWF0ZWQ/OiBib29sZWFuO1xufSIsICJpbXBvcnQgeyBGcmFtZXdvcmssIE1vbmdvREIgfSBmcm9tICdAc2VydmVyL3N2X21haW4nO1xuaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gJ0BvdmVyZXh0ZW5kZWQvb3hfbGliL3NlcnZlcic7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tICdAc2hhcmVkL3V0aWxzJztcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRlJBTUVXT1JLX1JFU09VUkNFIH0gZnJvbSBcIi4uLy4uLy4uL3NoYXJlZC91dGlsc1wiO1xuXG5pbnRlcmZhY2UgSGVhcnRTeW5jUHJvZmlsZSB7XG4gICAgX2lkPzogc3RyaW5nO1xuICAgIGNpdGl6ZW5JZDogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBhZ2U6IG51bWJlcjtcbiAgICBnZW5kZXI6IHN0cmluZztcbiAgICBiaW86IHN0cmluZztcbiAgICBwaG90b3M6IHN0cmluZ1tdO1xuICAgIGludGVyZXN0czogc3RyaW5nW107XG4gICAgbG9va2luZ0Zvcjogc3RyaW5nO1xuICAgIGludGVyZXN0ZWRJbkdlbmRlcnM6IHN0cmluZ1tdO1xuICAgIGFnZVJhbmdlTWluOiBudW1iZXI7XG4gICAgYWdlUmFuZ2VNYXg6IG51bWJlcjtcbiAgICBtYXhEaXN0YW5jZTogbnVtYmVyO1xuICAgIHNob3dPbmxpbmU6IGJvb2xlYW47XG4gICAgbG9jYXRpb24/OiB7XG4gICAgICAgIGxhdDogbnVtYmVyO1xuICAgICAgICBsbmc6IG51bWJlcjtcbiAgICAgICAgY2l0eTogc3RyaW5nO1xuICAgIH07XG4gICAgd29yaz86IHN0cmluZztcbiAgICBzY2hvb2w/OiBzdHJpbmc7XG4gICAgaGVpZ2h0PzogbnVtYmVyO1xuICAgIHpvZGlhY1NpZ24/OiBzdHJpbmc7XG4gICAgbGlmZXN0eWxlPzoge1xuICAgICAgICBzbW9raW5nOiBzdHJpbmc7XG4gICAgICAgIGRyaW5raW5nOiBzdHJpbmc7XG4gICAgICAgIGV4ZXJjaXNlOiBzdHJpbmc7XG4gICAgICAgIHBldHM6IHN0cmluZztcbiAgICB9O1xuICAgIHByb21wdHM/OiB7XG4gICAgICAgIHF1ZXN0aW9uOiBzdHJpbmc7XG4gICAgICAgIGFuc3dlcjogc3RyaW5nO1xuICAgIH1bXTtcbiAgICB2ZXJpZmllZDogYm9vbGVhbjtcbiAgICBwcmVtaXVtOiBib29sZWFuO1xuICAgIHN1cGVyTGlrZXNSZW1haW5pbmc6IG51bWJlcjtcbiAgICBsaWtlc1JlbWFpbmluZzogbnVtYmVyO1xuICAgIGRhaWx5U3dpcGVzOiBudW1iZXI7XG4gICAgbGFzdFN3aXBlUmVzZXQ6IERhdGU7XG4gICAgY3JlYXRlZEF0OiBEYXRlO1xuICAgIGxhc3RBY3RpdmU6IERhdGU7XG4gICAgaXNBY3RpdmU6IGJvb2xlYW47XG59XG5pbnRlcmZhY2UgTWVzc2FnZSB7XG4gICAgX2lkOiBzdHJpbmc7XG4gICAgc2VuZGVySWQ6IHN0cmluZztcbiAgICByZWNlaXZlcklkOiBzdHJpbmc7XG4gICAgbWF0Y2hJZDogc3RyaW5nO1xuICAgIGNvbnRlbnQ6IHN0cmluZztcbiAgICB0aW1lc3RhbXA6IHN0cmluZztcbiAgICByZWFkOiBib29sZWFuO1xufVxuY2xhc3MgSGVhcnRTeW5jU2VydmVyIHtcbiAgICBhc3luYyBnZXRQcm9maWxlKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlIHwgbnVsbD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHByb2ZpbGUgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHByb2ZpbGU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIEhlYXJ0U3luYyBwcm9maWxlOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgY3JlYXRlUHJvZmlsZShzb3VyY2U6IG51bWJlciwgcHJvZmlsZURhdGE6IFBhcnRpYWw8SGVhcnRTeW5jUHJvZmlsZT4pOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGUgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiBudWxsO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBpZiBwcm9maWxlIGFscmVhZHkgZXhpc3RzXG4gICAgICAgICAgICBjb25zdCBleGlzdGluZ1Byb2ZpbGUgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkIH0pO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nUHJvZmlsZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignUHJvZmlsZSBhbHJlYWR5IGV4aXN0cycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBuZXdQcm9maWxlOiBIZWFydFN5bmNQcm9maWxlID0ge1xuICAgICAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICAgICAgY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIG5hbWU6IHByb2ZpbGVEYXRhLm5hbWUgfHwgJycsXG4gICAgICAgICAgICAgICAgYWdlOiBwcm9maWxlRGF0YS5hZ2UgfHwgMTgsXG4gICAgICAgICAgICAgICAgZ2VuZGVyOiBwcm9maWxlRGF0YS5nZW5kZXIgfHwgJycsXG4gICAgICAgICAgICAgICAgYmlvOiBwcm9maWxlRGF0YS5iaW8gfHwgJycsXG4gICAgICAgICAgICAgICAgcGhvdG9zOiBwcm9maWxlRGF0YS5waG90b3MgfHwgW10sXG4gICAgICAgICAgICAgICAgaW50ZXJlc3RzOiBwcm9maWxlRGF0YS5pbnRlcmVzdHMgfHwgW10sXG4gICAgICAgICAgICAgICAgbG9va2luZ0ZvcjogcHJvZmlsZURhdGEubG9va2luZ0ZvciB8fCAnJyxcbiAgICAgICAgICAgICAgICBpbnRlcmVzdGVkSW5HZW5kZXJzOiBwcm9maWxlRGF0YS5pbnRlcmVzdGVkSW5HZW5kZXJzIHx8IFtdLFxuICAgICAgICAgICAgICAgIGFnZVJhbmdlTWluOiBwcm9maWxlRGF0YS5hZ2VSYW5nZU1pbiB8fCAxOCxcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZU1heDogcHJvZmlsZURhdGEuYWdlUmFuZ2VNYXggfHwgMzUsXG4gICAgICAgICAgICAgICAgbWF4RGlzdGFuY2U6IHByb2ZpbGVEYXRhLm1heERpc3RhbmNlIHx8IDI1LFxuICAgICAgICAgICAgICAgIHNob3dPbmxpbmU6IHByb2ZpbGVEYXRhLnNob3dPbmxpbmUgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVEYXRhLnNob3dPbmxpbmUgOiB0cnVlLFxuICAgICAgICAgICAgICAgIHdvcms6IHByb2ZpbGVEYXRhLndvcmsgfHwgJycsXG4gICAgICAgICAgICAgICAgc2Nob29sOiBwcm9maWxlRGF0YS5zY2hvb2wgfHwgJycsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiBwcm9maWxlRGF0YS5oZWlnaHQsXG4gICAgICAgICAgICAgICAgem9kaWFjU2lnbjogcHJvZmlsZURhdGEuem9kaWFjU2lnbiB8fCAnJyxcbiAgICAgICAgICAgICAgICBsaWZlc3R5bGU6IHByb2ZpbGVEYXRhLmxpZmVzdHlsZSB8fCB7XG4gICAgICAgICAgICAgICAgICAgIHNtb2tpbmc6ICcnLFxuICAgICAgICAgICAgICAgICAgICBkcmlua2luZzogJycsXG4gICAgICAgICAgICAgICAgICAgIGV4ZXJjaXNlOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgcGV0czogJydcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBwcmVtaXVtOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzdXBlckxpa2VzUmVtYWluaW5nOiA1LFxuICAgICAgICAgICAgICAgIGxpa2VzUmVtYWluaW5nOiA1MCxcbiAgICAgICAgICAgICAgICBkYWlseVN3aXBlczogMCxcbiAgICAgICAgICAgICAgICBsYXN0U3dpcGVSZXNldDogbmV3IERhdGUoKSxcbiAgICAgICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCksXG4gICAgICAgICAgICAgICAgbGFzdEFjdGl2ZTogbmV3IERhdGUoKSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIG5ld1Byb2ZpbGUpO1xuICAgICAgICAgICAgLyogY29uc29sZS5sb2cocmVzdWx0KTsgKi9cbiAgICAgICAgICAgIHJldHVybiB7IC4uLm5ld1Byb2ZpbGUsIF9pZDogcmVzdWx0IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjcmVhdGluZyBIZWFydFN5bmMgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHVwZGF0ZVByb2ZpbGUoc291cmNlOiBudW1iZXIsIHByb2ZpbGVEYXRhOiBQYXJ0aWFsPEhlYXJ0U3luY1Byb2ZpbGU+KTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlIHwgbnVsbD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcblxuICAgICAgICAgICAgY29uc3QgdXBkYXRlRGF0YSA9IHtcbiAgICAgICAgICAgICAgICAuLi5wcm9maWxlRGF0YSxcbiAgICAgICAgICAgICAgICBsYXN0QWN0aXZlOiBuZXcgRGF0ZSgpXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgeyBjaXRpemVuSWQgfSwgdXBkYXRlRGF0YSwgdW5kZWZpbmVkLCBmYWxzZSwgeyB1cHNlcnQ6IHRydWUgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQudmFsdWU7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGRhdGluZyBIZWFydFN5bmMgcHJvZmlsZTonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGVbXT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IHVzZXJQcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgICAgIGlmICghdXNlclByb2ZpbGUpIHJldHVybiBbXTtcblxuICAgICAgICAgICAgLy8gR2V0IHVzZXJzIGFscmVhZHkgc3dpcGVkIG9uXG4gICAgICAgICAgICBjb25zdCBzd2lwZWRVc2VycyA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19zd2lwZXMnLCB7XG4gICAgICAgICAgICAgICAgZnJvbVVzZXJJZDogY2l0aXplbklkXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICAgICAgICAgIGNvbnN0IHN3aXBlZFVzZXJJZHMgPSBzd2lwZWRVc2Vycy5tYXAoKHN3aXBlOiBhbnkpID0+IHN3aXBlLnRvVXNlcklkKTtcblxuICAgICAgICAgICAgLy8gR2V0IG1hdGNoZWQgdXNlcnNcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMUlkOiBjaXRpemVuSWQgfSxcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMklkOiBjaXRpemVuSWQgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWVcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZFVzZXJJZHMgPSBtYXRjaGVzLm1hcCgobWF0Y2g6IGFueSkgPT5cbiAgICAgICAgICAgICAgICBtYXRjaC51c2VyMUlkID09PSBjaXRpemVuSWQgPyBtYXRjaC51c2VyMklkIDogbWF0Y2gudXNlcjFJZFxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gQ29tYmluZSBleGNsdWRlZCB1c2Vyc1xuICAgICAgICAgICAgY29uc3QgZXhjbHVkZWRVc2VySWRzID0gWy4uLnN3aXBlZFVzZXJJZHMsIC4uLm1hdGNoZWRVc2VySWRzLCBjaXRpemVuSWRdO1xuXG4gICAgICAgICAgICAvLyBCdWlsZCBtYXRjaCBjcml0ZXJpYVxuICAgICAgICAgICAgY29uc3QgbWF0Y2hDcml0ZXJpYTogYW55ID0ge1xuICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogeyAkbmluOiBleGNsdWRlZFVzZXJJZHMgfSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhZ2U6IHsgJGd0ZTogdXNlclByb2ZpbGUuYWdlUmFuZ2VNaW4sICRsdGU6IHVzZXJQcm9maWxlLmFnZVJhbmdlTWF4IH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIEFkZCBnZW5kZXIgcHJlZmVyZW5jZXNcbiAgICAgICAgICAgIGlmICh1c2VyUHJvZmlsZS5sb29raW5nRm9yICE9PSAnRXZlcnlvbmUnKSB7XG4gICAgICAgICAgICAgICAgbWF0Y2hDcml0ZXJpYS5nZW5kZXIgPSB1c2VyUHJvZmlsZS5sb29raW5nRm9yID09PSAnTWVuJyA/ICdNYW4nIDogJ1dvbWFuJztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHVzZXJQcm9maWxlLmludGVyZXN0ZWRJbkdlbmRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIG1hdGNoQ3JpdGVyaWEubG9va2luZ0ZvciA9IHtcbiAgICAgICAgICAgICAgICAgICAgJGluOiB1c2VyUHJvZmlsZS5pbnRlcmVzdGVkSW5HZW5kZXJzLmluY2x1ZGVzKHVzZXJQcm9maWxlLmdlbmRlcilcbiAgICAgICAgICAgICAgICAgICAgICAgID8gdXNlclByb2ZpbGUuaW50ZXJlc3RlZEluR2VuZGVyc1xuICAgICAgICAgICAgICAgICAgICAgICAgOiBbLi4udXNlclByb2ZpbGUuaW50ZXJlc3RlZEluR2VuZGVycywgJ0V2ZXJ5b25lJ11cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwb3RlbnRpYWxNYXRjaGVzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywgbWF0Y2hDcml0ZXJpYSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBsaW1pdDogMjAgfSlcblxuICAgICAgICAgICAgcmV0dXJuIHBvdGVudGlhbE1hdGNoZXM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIHBvdGVudGlhbCBtYXRjaGVzOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIHN3aXBlUHJvZmlsZShzb3VyY2U6IG51bWJlciwgc3dpcGVEYXRhOiB7IHRhcmdldFVzZXJJZDogc3RyaW5nOyBpc0xpa2U6IGJvb2xlYW47IGlzU3VwZXJMaWtlPzogYm9vbGVhbiB9KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBpc01hdGNoOiBmYWxzZSB9O1xuXG4gICAgICAgICAgICBjb25zdCB7IHRhcmdldFVzZXJJZCwgaXNMaWtlLCBpc1N1cGVyTGlrZSA9IGZhbHNlIH0gPSBzd2lwZURhdGE7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIGRhaWx5IGxpbWl0c1xuICAgICAgICAgICAgY29uc3QgdXNlclByb2ZpbGUgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkIH0pO1xuICAgICAgICAgICAgaWYgKCF1c2VyUHJvZmlsZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGlzTWF0Y2g6IGZhbHNlIH07XG5cbiAgICAgICAgICAgIGlmIChpc1N1cGVyTGlrZSAmJiB1c2VyUHJvZmlsZS5zdXBlckxpa2VzUmVtYWluaW5nIDw9IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgaXNNYXRjaDogZmFsc2UsIGVycm9yOiAnTm8gc3VwZXIgbGlrZXMgcmVtYWluaW5nJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZWNvcmQgdGhlIHN3aXBlXG4gICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgnaGVhcnRzeW5jX3N3aXBlcycsIHtcbiAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgIGZyb21Vc2VySWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICB0b1VzZXJJZDogdGFyZ2V0VXNlcklkLFxuICAgICAgICAgICAgICAgIGlzTGlrZSxcbiAgICAgICAgICAgICAgICBpc1N1cGVyTGlrZSxcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKClcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBsZXQgaXNNYXRjaCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAvLyBDaGVjayBmb3IgbWF0Y2ggaWYgaXQncyBhIGxpa2VcbiAgICAgICAgICAgIGlmIChpc0xpa2UpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWNpcHJvY2FsU3dpcGUgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19zd2lwZXMnLCB7XG4gICAgICAgICAgICAgICAgICAgIGZyb21Vc2VySWQ6IHRhcmdldFVzZXJJZCxcbiAgICAgICAgICAgICAgICAgICAgdG9Vc2VySWQ6IGNpdGl6ZW5JZCxcbiAgICAgICAgICAgICAgICAgICAgaXNMaWtlOiB0cnVlXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBpZiAocmVjaXByb2NhbFN3aXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBtYXRjaFxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBNb25nb0RCLmluc2VydE9uZSgnaGVhcnRzeW5jX21hdGNoZXMnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXNlcjFJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXNlcjJJZDogdGFyZ2V0VXNlcklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBpc1N1cGVyTGlrZTogaXNTdXBlckxpa2UgfHwgcmVjaXByb2NhbFN3aXBlLmlzU3VwZXJMaWtlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBpc01hdGNoID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBTZW5kIG5vdGlmaWNhdGlvbnMgdG8gYm90aCB1c2VycyBhYm91dCB0aGUgbWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEdldCBwbGF5ZXIgZGF0YSBmb3IgYm90aCB1c2Vyc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpcGVyRGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldERhdGEgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKHRhcmdldFVzZXJJZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEdldCBvZmZsaW5lIGRhdGEgaWYgcGxheWVycyBhcmUgbm90IG9ubGluZVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpcGVyUGxheWVyRGF0YSA9IHN3aXBlckRhdGEgfHwgYXdhaXQgZ2xvYmFsLmV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5HZXRPZmZsaW5lUGxheWVyQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldFBsYXllckRhdGEgPSB0YXJnZXREYXRhIHx8IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0T2ZmbGluZVBsYXllckJ5Q2l0aXplbklkKHRhcmdldFVzZXJJZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNlbmQgbm90aWZpY2F0aW9uIHRvIHRoZSBzd2lwZXIgKGN1cnJlbnQgdXNlcilcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzd2lwZXJEYXRhICYmIHN3aXBlckRhdGEuUGxheWVyRGF0YS5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHN3aXBlckRhdGEuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJIZWFydFN5bmMgTWF0Y2ghIFx1RDgzRFx1REM5NVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBtYXRjaGVkIHdpdGggJHt0YXJnZXRQbGF5ZXJEYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3RhcmdldFBsYXllckRhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0hYCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiBcImhlYXJ0c3luY1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTZW5kIG5vdGlmaWNhdGlvbiB0byB0aGUgdGFyZ2V0IHVzZXJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXREYXRhICYmIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogXCJIZWFydFN5bmMgTWF0Y2ghIFx1RDgzRFx1REM5NVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogYFlvdSBtYXRjaGVkIHdpdGggJHtzd2lwZXJQbGF5ZXJEYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3N3aXBlclBsYXllckRhdGEuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0hYCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwOiBcImhlYXJ0c3luY1wiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChub3RpZmljYXRpb25FcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc2VuZGluZyBtYXRjaCBub3RpZmljYXRpb25zOicsIG5vdGlmaWNhdGlvbkVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBzd2lwZSBjb3VudHNcbiAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVEYXRhOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgICAgIGRhaWx5U3dpcGVzOiB1c2VyUHJvZmlsZS5kYWlseVN3aXBlcyArIDFcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgaWYgKGlzU3VwZXJMaWtlKSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZURhdGEuc3VwZXJMaWtlc1JlbWFpbmluZyA9IHVzZXJQcm9maWxlLnN1cGVyTGlrZXNSZW1haW5pbmcgLSAxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZURhdGEubGlrZXNSZW1haW5pbmcgPSB1c2VyUHJvZmlsZS5saWtlc1JlbWFpbmluZyAtIDE7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkIH0sIHVwZGF0ZURhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBpc01hdGNoIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzd2lwaW5nIHByb2ZpbGU6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGlzTWF0Y2g6IGZhbHNlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBnZXRNYXRjaGVzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxhbnlbXT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMUlkOiBjaXRpemVuSWQgfSxcbiAgICAgICAgICAgICAgICAgICAgeyB1c2VyMklkOiBjaXRpemVuSWQgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgaXNBY3RpdmU6IHRydWVcbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgc29ydDogeyBtYXRjaGVkQXQ6IC0xIH0gfSk7XG5cbiAgICAgICAgICAgIGNvbnN0IGVucmljaGVkTWF0Y2hlcyA9IGF3YWl0IFByb21pc2UuYWxsKG1hdGNoZXMubWFwKGFzeW5jIChtYXRjaDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3RoZXJVc2VySWQgPSBtYXRjaC51c2VyMUlkID09PSBjaXRpemVuSWQgPyBtYXRjaC51c2VyMklkIDogbWF0Y2gudXNlcjFJZDtcbiAgICAgICAgICAgICAgICBjb25zdCBvdGhlclVzZXIgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19wcm9maWxlcycsIHsgY2l0aXplbklkOiBvdGhlclVzZXJJZCB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RNZXNzYWdlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfbWVzc2FnZXMnLCB7IG1hdGNoSWQ6IG1hdGNoLl9pZCB9LCB1bmRlZmluZWQsIGZhbHNlLCB7IHNvcnQ6IHsgdGltZXN0YW1wOiAtMSB9IH0pO1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgLi4ubWF0Y2gsXG4gICAgICAgICAgICAgICAgICAgIG90aGVyVXNlcixcbiAgICAgICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IGxhc3RNZXNzYWdlPy5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZVRpbWU6IGxhc3RNZXNzYWdlPy50aW1lc3RhbXAsXG4gICAgICAgICAgICAgICAgICAgIGlzTmV3TWF0Y2g6ICFsYXN0TWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgdW5yZWFkQ291bnQ6IGF3YWl0IHRoaXMuZ2V0VW5yZWFkTWVzc2FnZUNvdW50KG1hdGNoLl9pZCEudG9TdHJpbmcoKSwgY2l0aXplbklkKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHJldHVybiBlbnJpY2hlZE1hdGNoZXM7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBnZXR0aW5nIG1hdGNoZXM6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRVbnJlYWRNZXNzYWdlQ291bnQobWF0Y2hJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8bnVtYmVyPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb3VudCA9IGF3YWl0IE1vbmdvREIuZmluZE1hbnkoJ2hlYXJ0c3luY19tZXNzYWdlcycsIHtcbiAgICAgICAgICAgICAgICBtYXRjaElkLFxuICAgICAgICAgICAgICAgIHJlY2VpdmVySWQ6IHVzZXJJZCxcbiAgICAgICAgICAgICAgICByZWFkOiBmYWxzZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG4gICAgICAgICAgICByZXR1cm4gY291bnQubGVuZ3RoO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyB1bnJlYWQgY291bnQ6JywgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNb2NrIGltcGxlbWVudGF0aW9ucyBmb3Igb3RoZXIgbWV0aG9kcyAtIHJlcGxhY2Ugd2l0aCBhY3R1YWwgbG9naWNcbiAgICBhc3luYyBnZXRTd2lwZVN0YXRzKHNvdXJjZTogbnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCBwcm9maWxlID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfcHJvZmlsZXMnLCB7IGNpdGl6ZW5JZCB9KTtcbiAgICAgICAgcmV0dXJuIHByb2ZpbGUgPyB7XG4gICAgICAgICAgICBsaWtlc1JlbWFpbmluZzogcHJvZmlsZS5saWtlc1JlbWFpbmluZyxcbiAgICAgICAgICAgIHN1cGVyTGlrZXNSZW1haW5pbmc6IHByb2ZpbGUuc3VwZXJMaWtlc1JlbWFpbmluZyxcbiAgICAgICAgICAgIGRhaWx5U3dpcGVzOiBwcm9maWxlLmRhaWx5U3dpcGVzXG4gICAgICAgIH0gOiBudWxsO1xuICAgIH1cblxuICAgIGFzeW5jIGdldE5lYXJieVVzZXJzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvbiAtIHJlcGxhY2Ugd2l0aCBhY3R1YWwgZ2VvbG9jYXRpb24gbG9naWNcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UG90ZW50aWFsTWF0Y2hlcyhzb3VyY2UpO1xuICAgIH1cblxuICAgIGFzeW5jIGdldE9ubGluZVVzZXJzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNvdXJjZSk7XG4gICAgICAgICAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuIFtdO1xuXG4gICAgICAgICAgICBjb25zdCBmaXZlTWludXRlc0FnbyA9IG5ldyBEYXRlKERhdGUubm93KCkgLSA1ICogNjAgKiAxMDAwKTtcbiAgICAgICAgICAgIGNvbnN0IG9ubGluZVVzZXJzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywge1xuICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogeyAkbmU6IGNpdGl6ZW5JZCB9LFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGxhc3RBY3RpdmU6IHsgJGd0ZTogZml2ZU1pbnV0ZXNBZ28gfVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSwgeyBsaW1pdDogMTAgfSk7XG5cbiAgICAgICAgICAgIHJldHVybiBvbmxpbmVVc2VycztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgb25saW5lIHVzZXJzOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldFJlY2VudGx5QWN0aXZlVXNlcnMoc291cmNlOiBudW1iZXIpOiBQcm9taXNlPEhlYXJ0U3luY1Byb2ZpbGVbXT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4gW107XG5cbiAgICAgICAgICAgIGNvbnN0IG9uZURheUFnbyA9IG5ldyBEYXRlKERhdGUubm93KCkgLSAyNCAqIDYwICogNjAgKiAxMDAwKTtcbiAgICAgICAgICAgIGNvbnN0IHJlY2VudFVzZXJzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3Byb2ZpbGVzJywge1xuICAgICAgICAgICAgICAgIGNpdGl6ZW5JZDogeyAkbmU6IGNpdGl6ZW5JZCB9LFxuICAgICAgICAgICAgICAgIGlzQWN0aXZlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGxhc3RBY3RpdmU6IHsgJGd0ZTogb25lRGF5QWdvIH1cbiAgICAgICAgICAgIH0sIHVuZGVmaW5lZCwgZmFsc2UsIHsgbGltaXQ6IDE1LCBzb3J0OiB7IGxhc3RBY3RpdmU6IC0xIH0gfSk7XG5cbiAgICAgICAgICAgIHJldHVybiByZWNlbnRVc2VycztcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGdldHRpbmcgcmVjZW50bHkgYWN0aXZlIHVzZXJzOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGdldFRvcFBpY2tzKHNvdXJjZTogbnVtYmVyKTogUHJvbWlzZTxIZWFydFN5bmNQcm9maWxlW10+IHtcbiAgICAgICAgLy8gTW9jayBpbXBsZW1lbnRhdGlvbiAtIHJlcGxhY2Ugd2l0aCBhY3R1YWwgYWxnb3JpdGhtXG4gICAgICAgIGNvbnN0IHBvdGVudGlhbE1hdGNoZXMgPSBhd2FpdCB0aGlzLmdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlKTtcbiAgICAgICAgcmV0dXJuIHBvdGVudGlhbE1hdGNoZXMuc2xpY2UoMCwgOCk7XG4gICAgfVxuXG4gICAgYXN5bmMgZ2V0Tm90aWZpY2F0aW9ucyhzb3VyY2U6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICAgICAgICAgIGlmICghY2l0aXplbklkKSByZXR1cm4geyBuZXdNYXRjaGVzOiAwLCBuZXdNZXNzYWdlczogMCwgc3VwZXJMaWtlczogMCB9O1xuXG4gICAgICAgICAgICAvLyBHZXQgbmV3IG1hdGNoZXMgKG1hdGNoZXMgd2l0aG91dCBtZXNzYWdlcylcbiAgICAgICAgICAgIGNvbnN0IG5ld01hdGNoZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWF0Y2hlcycsIHtcbiAgICAgICAgICAgICAgICAkb3I6IFt7IHVzZXIxSWQ6IGNpdGl6ZW5JZCB9LCB7IHVzZXIySWQ6IGNpdGl6ZW5JZCB9XSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAvLyBBZGQgbG9naWMgdG8gY2hlY2sgaWYgbWF0Y2ggaXMgbmV3XG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcblxuICAgICAgICAgICAgLy8gR2V0IHVucmVhZCBtZXNzYWdlc1xuICAgICAgICAgICAgY29uc3QgbmV3TWVzc2FnZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWVzc2FnZXMnLCB7XG4gICAgICAgICAgICAgICAgcmVjZWl2ZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIHJlYWQ6IGZhbHNlXG4gICAgICAgICAgICB9LCB1bmRlZmluZWQsIGZhbHNlKTtcblxuICAgICAgICAgICAgLy8gR2V0IHJlY2VpdmVkIHN1cGVyIGxpa2VzXG4gICAgICAgICAgICBjb25zdCBzdXBlckxpa2VzID0gYXdhaXQgTW9uZ29EQi5maW5kTWFueSgnaGVhcnRzeW5jX3N3aXBlcycsIHtcbiAgICAgICAgICAgICAgICB0b1VzZXJJZDogY2l0aXplbklkLFxuICAgICAgICAgICAgICAgIGlzU3VwZXJMaWtlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGlzTGlrZTogdHJ1ZVxuICAgICAgICAgICAgfSwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cbiAgICAgICAgICAgIHJldHVybiB7IG5ld01hdGNoZXM6IG5ld01hdGNoZXMubGVuZ3RoLCBuZXdNZXNzYWdlczogbmV3TWVzc2FnZXMubGVuZ3RoLCBzdXBlckxpa2VzOiBzdXBlckxpa2VzLmxlbmd0aCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBub3RpZmljYXRpb25zOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IG5ld01hdGNoZXM6IDAsIG5ld01lc3NhZ2VzOiAwLCBzdXBlckxpa2VzOiAwIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBnZXRNZXNzYWdlcyhzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSB7XG4gICAgICAgIHJldHVybiBhd2FpdCBNb25nb0RCLmZpbmRNYW55KCdoZWFydHN5bmNfbWVzc2FnZXMnLCB7IG1hdGNoSWQ6IGRhdGEubWF0Y2hJZCB9LCB1bmRlZmluZWQsIGZhbHNlKTtcbiAgICB9XG5cbiAgICBhc3luYyBzZW5kTWVzc2FnZShzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSB7XG4gICAgICAgIC8qIGNvbnNvbGUubG9nKGRhdGEpOyAqL1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywgeyBfaWQ6IFN0cmluZyhkYXRhLm1hdGNoSWQpIH0sIHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgICAgICBjb25zdCBzb3VyY2VDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICBsZXQgc291cmNlRGF0YSA9IGF3YWl0IGdsb2JhbC5leHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyQnlDaXRpemVuSWQoc291cmNlQ2l0aXplbklkKTtcbiAgICAgICAgbGV0IHRhcmdldERhdGEgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldFBsYXllckJ5Q2l0aXplbklkKHJlcy51c2VyMUlkID09PSBzb3VyY2VDaXRpemVuSWQgPyByZXMudXNlcjJJZCA6IHJlcy51c2VyMUlkKTtcblxuICAgICAgICBpZiAoIXNvdXJjZURhdGEpIHtcbiAgICAgICAgICAgIHNvdXJjZURhdGEgPSBhd2FpdCBnbG9iYWwuZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdLkdldE9mZmxpbmVQbGF5ZXJCeUNpdGl6ZW5JZChzb3VyY2VDaXRpemVuSWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0YXJnZXREYXRhKSB7XG4gICAgICAgICAgICB0YXJnZXREYXRhID0gYXdhaXQgRnJhbWV3b3JrLkZ1bmN0aW9ucy5HZXRPZmZsaW5lUGxheWVyQnlDaXRpemVuSWQocmVzLnVzZXIxSWQgPT09IHNvdXJjZUNpdGl6ZW5JZCA/IHJlcy51c2VyMklkIDogcmVzLnVzZXIxSWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5zZXJ0RGF0YTogTWVzc2FnZSA9IHtcbiAgICAgICAgICAgIF9pZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgICAgICByZWFkOiByZXMudXNlcjFJZCA9PT0gc291cmNlQ2l0aXplbklkIHx8IHJlcy51c2VyMklkID09PSBzb3VyY2VDaXRpemVuSWQgPyB0cnVlIDogZmFsc2UsXG4gICAgICAgICAgICBtYXRjaElkOiByZXMuX2lkLFxuICAgICAgICAgICAgc2VuZGVySWQ6IHNvdXJjZUNpdGl6ZW5JZCxcbiAgICAgICAgICAgIHJlY2VpdmVySWQ6IHJlcy51c2VyMUlkID09PSBzb3VyY2VDaXRpemVuSWQgPyByZXMudXNlcjJJZCA6IHJlcy51c2VyMUlkLFxuICAgICAgICAgICAgY29udGVudDogZGF0YS5jb250ZW50LFxuICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ2hlYXJ0c3luY19tZXNzYWdlcycsIGluc2VydERhdGEpO1xuXG4gICAgICAgIGlmIChyZXMudXNlcjFJZCAhPT0gc291cmNlQ2l0aXplbklkIHx8IHJlcy51c2VyMklkICE9PSBzb3VyY2VDaXRpemVuSWQgJiYgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSkge1xuICAgICAgICAgICAgZW1pdE5ldCgnaGVhcnRzeW5jOmNsaWVudDpzZW5kTWVzc2FnZScsIHRhcmdldERhdGEuUGxheWVyRGF0YS5zb3VyY2UsIEpTT04uc3RyaW5naWZ5KGluc2VydERhdGEpKTtcbiAgICAgICAgICAgIGVtaXROZXQoXCJwaG9uZTphZGRub3RpRmljYXRpb25cIiwgdGFyZ2V0RGF0YS5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJIZWFydFN5bmNcIixcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJZb3UgaGF2ZSBhIG5ldyBtZXNzYWdlIGZyb20gXCIgKyBzb3VyY2VEYXRhLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lICsgXCIgXCIgKyBzb3VyY2VEYXRhLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWUsXG4gICAgICAgICAgICAgICAgYXBwOiBcImhlYXJ0c3luY1wiLFxuICAgICAgICAgICAgICAgIHRpbWVvdXQ6IDIwMDAsXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5zZXJ0RGF0YTtcbiAgICB9XG5cbiAgICBhc3luYyB1bm1hdGNoKHNvdXJjZTogbnVtYmVyLCBkYXRhOiB7IG1hdGNoSWQ6IHN0cmluZyB9KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRQbGF5ZXJDaXRpemVuSWRCeVNvdXJjZShzb3VyY2UpO1xuICAgICAgICAgICAgaWYgKCFjaXRpemVuSWQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGNoID0gYXdhaXQgTW9uZ29EQi5maW5kT25lKCdoZWFydHN5bmNfbWF0Y2hlcycsIHsgX2lkOiBkYXRhLm1hdGNoSWQgfSk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoIHx8ICFtYXRjaC5pc0FjdGl2ZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UgfTtcblxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIHVzZXIgaXMgcGFydCBvZiB0aGlzIG1hdGNoXG4gICAgICAgICAgICBpZiAobWF0Y2gudXNlcjFJZCAhPT0gY2l0aXplbklkICYmIG1hdGNoLnVzZXIySWQgIT09IGNpdGl6ZW5JZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vdCBhdXRob3JpemVkIHRvIHVubWF0Y2ggdGhpcyB1c2VyJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBEZWFjdGl2YXRlIHRoZSBtYXRjaFxuICAgICAgICAgICAgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ2hlYXJ0c3luY19tYXRjaGVzJywgeyBfaWQ6IGRhdGEubWF0Y2hJZCB9LCB7IGlzQWN0aXZlOiBmYWxzZSB9KTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgdW5tYXRjaGluZzonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdGYWlsZWQgdG8gdW5tYXRjaCcgfTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY29uc3QgaGVhcnRTeW5jU2VydmVyID0gbmV3IEhlYXJ0U3luY1NlcnZlcigpO1xuXG4vLyBSZWdpc3RlciBzZXJ2ZXIgY2FsbGJhY2tzXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0UHJvZmlsZScsIGFzeW5jIChzb3VyY2U6IG51bWJlcikgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIuZ2V0UHJvZmlsZShzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpjcmVhdGVQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmNyZWF0ZVByb2ZpbGUoc291cmNlLCBkYXRhKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6dXBkYXRlUHJvZmlsZScsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogYW55KSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci51cGRhdGVQcm9maWxlKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFBvdGVudGlhbE1hdGNoZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFBvdGVudGlhbE1hdGNoZXMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6c3dpcGVQcm9maWxlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLnN3aXBlUHJvZmlsZShzb3VyY2UsIGRhdGEpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXRNYXRjaGVzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRNYXRjaGVzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFN3aXBlU3RhdHMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldFN3aXBlU3RhdHMoc291cmNlKTtcbn0pO1xuXG5vbkNsaWVudENhbGxiYWNrKCdoZWFydHN5bmM6Z2V0TmVhcmJ5VXNlcnMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE5lYXJieVVzZXJzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE9ubGluZVVzZXJzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRPbmxpbmVVc2Vycyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXRSZWNlbnRseUFjdGl2ZVVzZXJzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRSZWNlbnRseUFjdGl2ZVVzZXJzKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldFRvcFBpY2tzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXRUb3BQaWNrcyhzb3VyY2UpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2hlYXJ0c3luYzpnZXROb3RpZmljYXRpb25zJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyKSA9PiB7XG4gICAgcmV0dXJuIGF3YWl0IGhlYXJ0U3luY1NlcnZlci5nZXROb3RpZmljYXRpb25zKHNvdXJjZSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOmdldE1lc3NhZ2VzJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLmdldE1lc3NhZ2VzKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOnNlbmRNZXNzYWdlJywgYXN5bmMgKHNvdXJjZTogbnVtYmVyLCBkYXRhOiBhbnkpID0+IHtcbiAgICByZXR1cm4gYXdhaXQgaGVhcnRTeW5jU2VydmVyLnNlbmRNZXNzYWdlKHNvdXJjZSwgZGF0YSk7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnaGVhcnRzeW5jOnVubWF0Y2gnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IGFueSkgPT4ge1xuICAgIHJldHVybiBhd2FpdCBoZWFydFN5bmNTZXJ2ZXIudW5tYXRjaChzb3VyY2UsIGRhdGEpO1xufSk7XG5cbi8vIEFkZCBtb3JlIGNhbGxiYWNrcyBmb3IgbWVzc2FnZXMsIHN1cGVyIGxpa2VzLCBldGMuXG4vLyAuLi4gKGltcGxlbWVudCByZW1haW5pbmcgY2FsbGJhY2tzIGFzIG5lZWRlZClcblxuZXhwb3J0IHsgaGVhcnRTeW5jU2VydmVyIH07XG4iLCAiaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIkBzZXJ2ZXIvY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgRnJhbWV3b3JrLCBMb2dnZXIsIE1vbmdvREIgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBnZW5lcmF0ZVVVaWQgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgRGF0ZVRpbWUgfSBmcm9tICdsdXhvbic7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vLi4vLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuXG5vbkNsaWVudENhbGxiYWNrKCdjcnlwdG86Z2V0QmFsYW5jZXMnLCBhc3luYyAoc291cmNlOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBwbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgY3J5cHRvID0gcGxheWVyLlBsYXllckRhdGEubWV0YWRhdGEuY3J5cHRvIHx8IHt9O1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShjcnlwdG8pO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NyeXB0bzpidXknLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgdHlwZSwgYW1vdW50LCBwcmljZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghcGxheWVyIHx8ICFbXCJzaHVuZ1wiLCBcImduZVwiLCBcInhjb2luXCIsIFwibG1lXCJdLmluY2x1ZGVzKHR5cGUpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgY29uc3QgdG90YWxDb3N0ID0gYW1vdW50ICogcHJpY2U7ICAvLyBBc3N1bWUgcHJpY2UgaXMgcGVyIHVuaXRcbiAgICBpZiAocGxheWVyLlBsYXllckRhdGEubW9uZXkuYmFuayA8IHRvdGFsQ29zdCkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGlmIChwbGF5ZXIuRnVuY3Rpb25zLlJlbW92ZU1vbmV5KCdiYW5rJywgdG90YWxDb3N0KSkge1xuICAgICAgICBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uQWRkQ3J5cHRvKHNvdXJjZSwgdHlwZSwgYW1vdW50KTtcbiAgICAgICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgICAgICB0eXBlOiAnY3J5cHRvX2J1eScsXG4gICAgICAgICAgICB0aXRsZTogJ0NyeXB0byBCdXknLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7cGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3BsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSBib3VnaHQgJHthbW91bnR9ICR7dHlwZX0gZm9yICQke3RvdGFsQ29zdH0uYCxcbiAgICAgICAgICAgIHNob3dJZGVudGlmaWVyczogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59KTtcblxub25DbGllbnRDYWxsYmFjaygnY3J5cHRvOnNlbGwnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGRhdGE6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IHsgdHlwZSwgYW1vdW50LCBwcmljZSB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghcGxheWVyIHx8ICFbXCJzaHVuZ1wiLCBcImduZVwiLCBcInhjb2luXCIsIFwibG1lXCJdLmluY2x1ZGVzKHR5cGUpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgaWYgKCFleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uaGFzRW5vdWdoKHNvdXJjZSwgdHlwZSwgYW1vdW50KSkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIGV4cG9ydHNbRlJBTUVXT1JLX1JFU09VUkNFXS5SZW1vdmVDcnlwdG8oc291cmNlLCB0eXBlLCBhbW91bnQpO1xuICAgIHBsYXllci5GdW5jdGlvbnMuQWRkTW9uZXkoJ2JhbmsnLCBhbW91bnQgKiBwcmljZSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdjcnlwdG9fc2VsbCcsXG4gICAgICAgIHRpdGxlOiAnQ3J5cHRvIFNlbGwnLFxuICAgICAgICBtZXNzYWdlOiBgJHtwbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5maXJzdG5hbWV9ICR7cGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8ubGFzdG5hbWV9IHNvbGQgJHthbW91bnR9ICR7dHlwZX0gZm9yICQke2Ftb3VudCAqIHByaWNlfS5gLFxuICAgICAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ2NyeXB0bzp0cmFuc2ZlcicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB7XG4gICAgY29uc3QgeyB0eXBlLCBhbW91bnQsIHRhcmdldCB9ID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICBjb25zdCBzb3VyY2VQbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllcihzb3VyY2UpO1xuICAgIGlmICghc291cmNlUGxheWVyIHx8ICFbXCJzaHVuZ1wiLCBcImduZVwiLCBcInhjb2luXCIsIFwibG1lXCJdLmluY2x1ZGVzKHR5cGUpKSByZXR1cm4gZmFsc2U7XG4gICAgXG4gICAgaWYgKCFleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uaGFzRW5vdWdoKHNvdXJjZSwgdHlwZSwgYW1vdW50KSkgcmV0dXJuIGZhbHNlO1xuICAgIFxuICAgIC8vIEFzc3VtZSB0YXJnZXQgaXMgcGhvbmUgbnVtYmVyIHRvIGdldCBjaXRpemVuSWRcbiAgICBjb25zdCB0YXJnZXRDaXRpemVuSWQgPSBhd2FpdCBVdGlscy5HZXRDaXRpemVuSWRCeVBob25lTnVtYmVyKHRhcmdldCk7XG4gICAgaWYgKCF0YXJnZXRDaXRpemVuSWQpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBjb25zdCB0YXJnZXRQbGF5ZXIgPSBGcmFtZXdvcmsuRnVuY3Rpb25zLkdldFBsYXllckJ5Q2l0aXplbklkKHRhcmdldENpdGl6ZW5JZCk7XG4gICAgaWYgKCF0YXJnZXRQbGF5ZXIpIHJldHVybiBmYWxzZTtcbiAgICBcbiAgICBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uUmVtb3ZlQ3J5cHRvKHNvdXJjZSwgdHlwZSwgYW1vdW50KTtcbiAgICBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uQWRkQ3J5cHRvKHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgdHlwZSwgYW1vdW50KTtcbiAgICBcbiAgICBlbWl0TmV0KCdwaG9uZTphZGRub3RpRmljYXRpb24nLCBzb3VyY2UsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgaWQ6IGdlbmVyYXRlVVVpZCgpLFxuICAgICAgICB0aXRsZTogJ0NyeXB0bycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IHRyYW5zZmVycmVkICR7YW1vdW50fSAke3R5cGV9IHRvICR7dGFyZ2V0fS5gLFxuICAgICAgICBhcHA6ICdjcnlwdG8nLFxuICAgICAgICB0aW1lb3V0OiA1MDAwXG4gICAgfSkpO1xuICAgIGVtaXROZXQoJ3Bob25lOmFkZG5vdGlGaWNhdGlvbicsIHRhcmdldFBsYXllci5QbGF5ZXJEYXRhLnNvdXJjZSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiAnQ3J5cHRvJyxcbiAgICAgICAgZGVzY3JpcHRpb246IGBZb3UgcmVjZWl2ZWQgJHthbW91bnR9ICR7dHlwZX0gZnJvbSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHtzb3VyY2VQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0uYCxcbiAgICAgICAgYXBwOiAnY3J5cHRvJyxcbiAgICAgICAgdGltZW91dDogNTAwMFxuICAgIH0pKTtcbiAgICBcbiAgICBMb2dnZXIuQWRkTG9nKHtcbiAgICAgICAgdHlwZTogJ2NyeXB0b190cmFuc2ZlcicsXG4gICAgICAgIHRpdGxlOiAnQ3J5cHRvIFRyYW5zZmVyJyxcbiAgICAgICAgbWVzc2FnZTogYCR7c291cmNlUGxheWVyLlBsYXllckRhdGEuY2hhcmluZm8uZmlyc3RuYW1lfSAke3NvdXJjZVBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmxhc3RuYW1lfSB0cmFuc2ZlcnJlZCAke2Ftb3VudH0gJHt0eXBlfSB0byAke3RhcmdldFBsYXllci5QbGF5ZXJEYXRhLmNoYXJpbmZvLmZpcnN0bmFtZX0gJHt0YXJnZXRQbGF5ZXIuUGxheWVyRGF0YS5jaGFyaW5mby5sYXN0bmFtZX0uYCxcbiAgICAgICAgc2hvd0lkZW50aWZpZXJzOiBmYWxzZVxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xufSk7IiwgImltcG9ydCB7IEZyYW1ld29yaywgTXlTUUwgfSBmcm9tIFwiQHNlcnZlci9zdl9tYWluXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UsIElOVkVOVE9SWV9SRVNPVVJDRSB9IGZyb20gXCIuLi8uLi8uLi9zaGFyZWQvdXRpbHNcIjsgLy8gYWRqdXN0IHBhdGggYXMgbmVlZGVkXG5cbmNvbnN0IGludlBhdGggPSBgbnVpOi8vJHtJTlZFTlRPUllfUkVTT1VSQ0V9L2h0bWwvaW1hZ2VzL2A7XG5cbnR5cGUgUmV3YXJkVHlwZSA9IFwidmVoaWNsZVwiIHwgXCJpdGVtXCIgfCBcImNhc2hcIiB8IFwiYmFua1wiIHwgXCJ3ZWFwb25cIjtcbnR5cGUgUmFyaXR5ID0gXCJsZWdlbmRhcnlcIiB8IFwiZXBpY1wiIHwgXCJyYXJlXCIgfCBcImNvbW1vblwiO1xuXG5pbnRlcmZhY2UgUm91bGV0dGVSZXdhcmQge1xuICAgIGlkOiBudW1iZXI7XG4gICAgdHlwZTogUmV3YXJkVHlwZTtcbiAgICBtb2RlbDogc3RyaW5nIHwgbnVtYmVyO1xuICAgIHJhcml0eTogUmFyaXR5O1xuICAgIGltZzogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBzZWxsOiBudW1iZXI7XG4gICAgcXVhbnRpdHk/OiBudW1iZXI7XG59XG5cbmludGVyZmFjZSBEYWlseVNwaW5Db25maWdTaGFwZSB7XG4gICAgVGltZVRvQ2xhaW06IG51bWJlcjtcbiAgICBBbmltYXRpb25EdXJhdGlvbjogbnVtYmVyO1xuICAgIFJvdWxldHRlRGF0YTogUmVjb3JkPG51bWJlciwgUm91bGV0dGVSZXdhcmQ+O1xuICAgIFJhcml0eVByb2JhYmlsaXR5OiBSZWNvcmQ8UmFyaXR5LCBudW1iZXI+O1xuICAgIFNlbGxUeXBlOiBcImJhbmtcIiB8IFwiY2FzaFwiO1xuICAgIFdlYXBvbkFtb3VudDogbnVtYmVyO1xuICAgIENhclBhcmtpbmdTcGF3bjogc3RyaW5nO1xufVxuXG5jb25zdCBEYWlseVNwaW5Db25maWc6IERhaWx5U3BpbkNvbmZpZ1NoYXBlID0ge1xuICAgIFRpbWVUb0NsYWltOiAoMjQgKiAzNjAwKSxcblxuICAgIEFuaW1hdGlvbkR1cmF0aW9uOiAxMixcblxuICAgIFJvdWxldHRlRGF0YToge1xuICAgICAgICAwOiB7XG4gICAgICAgICAgICBpZDogMCxcbiAgICAgICAgICAgIHR5cGU6IFwidmVoaWNsZVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwicGVudW1icmFcIixcbiAgICAgICAgICAgIHJhcml0eTogXCJsZWdlbmRhcnlcIixcbiAgICAgICAgICAgIGltZzogXCJodHRwczovL2RvY3MuZml2ZW0ubmV0L3ZlaGljbGVzL3BlbnVtYnJhLndlYnBcIixcbiAgICAgICAgICAgIG5hbWU6IFwiUGVudW1icmFcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDAwXG4gICAgICAgIH0sXG4gICAgICAgIDE6IHtcbiAgICAgICAgICAgIGlkOiAxLFxuICAgICAgICAgICAgdHlwZTogXCJ3ZWFwb25cIixcbiAgICAgICAgICAgIG1vZGVsOiBcIndlYXBvbl9kcmFjb1wiLFxuICAgICAgICAgICAgcmFyaXR5OiBcImVwaWNcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1xYl9kcmFjby5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJEcmFjb1wiLFxuICAgICAgICAgICAgc2VsbDogMTAwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMjoge1xuICAgICAgICAgICAgaWQ6IDIsXG4gICAgICAgICAgICByYXJpdHk6IFwicmFyZVwiLFxuICAgICAgICAgICAgdHlwZTogXCJ3ZWFwb25cIixcbiAgICAgICAgICAgIG1vZGVsOiBcIndlYXBvbl9icm93bmluZ1wiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXFiX2Jyb3duaW5nLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkJyb3duaW5nXCIsXG4gICAgICAgICAgICBzZWxsOiAyNTAwXG4gICAgICAgIH0sXG4gICAgICAgIDM6IHtcbiAgICAgICAgICAgIGlkOiAzLFxuICAgICAgICAgICAgcmFyaXR5OiBcInJhcmVcIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwiYWR2YW5jZWRyZXBhaXJraXRcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1hZHZhbmNlZGtpdC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJBZHYgUmVwYWlyIEtpdCB4NVwiLFxuICAgICAgICAgICAgc2VsbDogNTAwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiA1XG4gICAgICAgIH0sXG4gICAgICAgIDQ6IHtcbiAgICAgICAgICAgIGlkOiA0LFxuICAgICAgICAgICAgcmFyaXR5OiBcInJhcmVcIixcbiAgICAgICAgICAgIHR5cGU6IFwiY2FzaFwiLFxuICAgICAgICAgICAgbW9kZWw6IDEwMDAwLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWNhc2gucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiJDEwMDAwIENhc2hcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDBcbiAgICAgICAgfSxcbiAgICAgICAgNToge1xuICAgICAgICAgICAgaWQ6IDUsXG4gICAgICAgICAgICByYXJpdHk6IFwicmFyZVwiLFxuICAgICAgICAgICAgdHlwZTogXCJpdGVtXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJhZHZhbmNlZGxvY2twaWNrXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9YWR2YW5jZWRsb2NrcGljay5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJBZHZhbmNlZCBMb2NrcGljayB4NVwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiA1XG4gICAgICAgIH0sXG4gICAgICAgIDY6IHtcbiAgICAgICAgICAgIGlkOiA2LFxuICAgICAgICAgICAgcmFyaXR5OiBcImNvbW1vblwiLFxuICAgICAgICAgICAgdHlwZTogXCJpdGVtXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJmYWtcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1maXJzdGFpZC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJGQUsgeDEwXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDEwXG4gICAgICAgIH0sXG4gICAgICAgIDc6IHtcbiAgICAgICAgICAgIGlkOiA3LFxuICAgICAgICAgICAgcmFyaXR5OiBcImNvbW1vblwiLFxuICAgICAgICAgICAgdHlwZTogXCJjYXNoXCIsXG4gICAgICAgICAgICBtb2RlbDogNTAwMCxcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1jYXNoLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIiQ1MDAwIENhc2hcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDBcbiAgICAgICAgfSxcbiAgICAgICAgODoge1xuICAgICAgICAgICAgaWQ6IDgsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImxvY2twaWNrXCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9bG9ja3BpY2sucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiTG9ja3BpY2sgeDEwXCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDEwXG4gICAgICAgIH0sXG4gICAgICAgIDk6IHtcbiAgICAgICAgICAgIGlkOiA5LFxuICAgICAgICAgICAgcmFyaXR5OiBcImVwaWNcIixcbiAgICAgICAgICAgIHR5cGU6IFwiY2FzaFwiLFxuICAgICAgICAgICAgbW9kZWw6IDI1MDAwLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofWNhc2gucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiJDI1MDAwIENhc2hcIixcbiAgICAgICAgICAgIHNlbGw6IDEwMDAwXG4gICAgICAgIH0sXG4gICAgICAgIDEwOiB7XG4gICAgICAgICAgICBpZDogMTAsXG4gICAgICAgICAgICByYXJpdHk6IFwibGVnZW5kYXJ5XCIsXG4gICAgICAgICAgICB0eXBlOiBcIndlYXBvblwiLFxuICAgICAgICAgICAgbW9kZWw6IFwid2VhcG9uX2FrNDdcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH13ZWFwb25fYXNzYXVsdHJpZmxlLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIkFLNDdcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDAwXG4gICAgICAgIH0sXG4gICAgICAgIDExOiB7XG4gICAgICAgICAgICBpZDogMTEsXG4gICAgICAgICAgICByYXJpdHk6IFwiZXBpY1wiLFxuICAgICAgICAgICAgdHlwZTogXCJ2ZWhpY2xlXCIsXG4gICAgICAgICAgICBtb2RlbDogXCJmYWdnaW9cIixcbiAgICAgICAgICAgIGltZzogXCJodHRwczovL2RvY3MuZml2ZW0ubmV0L3ZlaGljbGVzL2ZhZ2dpby53ZWJwXCIsXG4gICAgICAgICAgICBuYW1lOiBcIkZhZ2dpb1wiLFxuICAgICAgICAgICAgc2VsbDogMTAwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTI6IHtcbiAgICAgICAgICAgIGlkOiAxMixcbiAgICAgICAgICAgIHJhcml0eTogXCJyYXJlXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImhlYXZ5YXJtb3JcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1hcm1vci5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCJIZWF2eSBBcm1vciB4MlwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiAyXG4gICAgICAgIH0sXG4gICAgICAgIDEzOiB7XG4gICAgICAgICAgICBpZDogMTMsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImpvaW50XCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9am9pbnQucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiSm9pbnQgeDE1XCIsXG4gICAgICAgICAgICBzZWxsOiAxMDAwLFxuICAgICAgICAgICAgcXVhbnRpdHk6IDE1XG4gICAgICAgIH0sXG4gICAgICAgIDE0OiB7XG4gICAgICAgICAgICBpZDogMTQsXG4gICAgICAgICAgICByYXJpdHk6IFwiY29tbW9uXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcImJsb2Nrb2NoZWVzZVwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXJhdF9jaGVlc2UucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiQ2hlZXNlIHgyMFwiLFxuICAgICAgICAgICAgc2VsbDogMTAwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiAyMFxuICAgICAgICB9LFxuICAgICAgICAxNToge1xuICAgICAgICAgICAgaWQ6IDE1LFxuICAgICAgICAgICAgdHlwZTogXCJjYXNoXCIsXG4gICAgICAgICAgICBtb2RlbDogNzUwMDAsXG4gICAgICAgICAgICByYXJpdHk6IFwibGVnZW5kYXJ5XCIsXG4gICAgICAgICAgICBpbWc6IGAke2ludlBhdGh9Y2FzaC5wbmdgLFxuICAgICAgICAgICAgbmFtZTogXCIkNzUwMDAgQ2FzaFwiLFxuICAgICAgICAgICAgc2VsbDogMjUwMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTY6IHtcbiAgICAgICAgICAgIGlkOiAxNixcbiAgICAgICAgICAgIHJhcml0eTogXCJjb21tb25cIixcbiAgICAgICAgICAgIHR5cGU6IFwiaXRlbVwiLFxuICAgICAgICAgICAgbW9kZWw6IFwicmVjeWNsYWJsZV9tYXRlcmlhbFwiLFxuICAgICAgICAgICAgaW1nOiBgJHtpbnZQYXRofXJlY3ljbGFibGUtbWF0ZXJpYWwucG5nYCxcbiAgICAgICAgICAgIG5hbWU6IFwiUmVjeWNsYWJsZXMgeDEwMFwiLFxuICAgICAgICAgICAgc2VsbDogMTAwMCxcbiAgICAgICAgICAgIHF1YW50aXR5OiAxMDBcbiAgICAgICAgfSxcbiAgICAgICAgMTc6IHtcbiAgICAgICAgICAgIGlkOiAxNyxcbiAgICAgICAgICAgIHJhcml0eTogXCJyYXJlXCIsXG4gICAgICAgICAgICB0eXBlOiBcIml0ZW1cIixcbiAgICAgICAgICAgIG1vZGVsOiBcInJlY3ljbGFibGVfbWF0ZXJpYWxcIixcbiAgICAgICAgICAgIGltZzogYCR7aW52UGF0aH1yZWN5Y2xhYmxlLW1hdGVyaWFsLnBuZ2AsXG4gICAgICAgICAgICBuYW1lOiBcIlJlY3ljbGFibGVzIHgyNTBcIixcbiAgICAgICAgICAgIHNlbGw6IDI1MDAsXG4gICAgICAgICAgICBxdWFudGl0eTogMjUwXG4gICAgICAgIH0sXG4gICAgfSxcblxuICAgIFJhcml0eVByb2JhYmlsaXR5OiB7XG4gICAgICAgIGxlZ2VuZGFyeTogMC4wMDEsXG4gICAgICAgIGVwaWM6IDAuMDIsXG4gICAgICAgIHJhcmU6IDAuMjAsXG4gICAgICAgIGNvbW1vbjogMC43NzlcbiAgICB9LFxuXG4gICAgU2VsbFR5cGU6IFwiYmFua1wiLCAvLyBiYW5rIG9yIGNhc2hcblxuICAgIFdlYXBvbkFtb3VudDogMjUwLCAvLyBhbW91bnQgb2YgYW1tbyB0byBnaXZlIHdoZW4gYSB3ZWFwb24gaXMgd29uXG5cbiAgICBDYXJQYXJraW5nU3Bhd246IFwiYWx0YVwiLCAvLyBRQjogZ2FyYWdlLCBFU1g6IHBhcmtpbmdcbn07XG5cbmNvbnN0IG5vd0luU2Vjb25kcyA9ICgpID0+IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApO1xuXG5jb25zdCBmb3JtYXRSZW1haW5pbmcgPSAocmVtYWluaW5nOiBudW1iZXIpID0+IHtcbiAgICBjb25zdCBob3VycyA9IE1hdGguZmxvb3IocmVtYWluaW5nIC8gMzYwMCk7XG4gICAgY29uc3QgbWlucyA9IE1hdGguZmxvb3IoKHJlbWFpbmluZyAlIDM2MDApIC8gNjApO1xuICAgIGNvbnN0IHNlY3MgPSByZW1haW5pbmcgJSA2MDtcblxuICAgIHJldHVybiBgJHtTdHJpbmcoaG91cnMpLnBhZFN0YXJ0KDIsIFwiMFwiKX06JHtTdHJpbmcobWlucykucGFkU3RhcnQoMiwgXCIwXCIpfToke1N0cmluZyhzZWNzKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbn07XG5cbmNvbnN0IGdldENvb2xkb3duU3RhdGUgPSAocGxheWVyOiBhbnkpID0+IHtcbiAgICBjb25zdCBsYXN0ID0gcGxheWVyPy5QbGF5ZXJEYXRhPy5tZXRhZGF0YT8uUGhvbmVEYWlseVNwaW4gPz8gMDtcbiAgICBjb25zdCBkaWZmID0gbm93SW5TZWNvbmRzKCkgLSBsYXN0O1xuXG4gICAgaWYgKGRpZmYgPj0gRGFpbHlTcGluQ29uZmlnLlRpbWVUb0NsYWltKSB7XG4gICAgICAgIHJldHVybiB7IGNhbkNsYWltOiB0cnVlLCBsYXN0Q2xhaW1lZERpc3BsYXk6IFwiMDA6MDA6MDBcIiB9O1xuICAgIH1cblxuICAgIGNvbnN0IHJlbWFpbmluZyA9IERhaWx5U3BpbkNvbmZpZy5UaW1lVG9DbGFpbSAtIGRpZmY7XG4gICAgcmV0dXJuIHsgY2FuQ2xhaW06IGZhbHNlLCBsYXN0Q2xhaW1lZERpc3BsYXk6IGZvcm1hdFJlbWFpbmluZyhyZW1haW5pbmcpIH07XG59O1xuXG5jb25zdCByZXNvbHZlRnJhbWV3b3JrID0gKCkgPT4ge1xuICAgIGlmIChGcmFtZXdvcmspIHJldHVybiBGcmFtZXdvcms7XG5cbiAgICBjb25zdCBjb25maWd1cmVkID0gZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdO1xuICAgIGlmICh0eXBlb2YgY29uZmlndXJlZD8uR2V0Q29yZU9iamVjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gY29uZmlndXJlZC5HZXRDb3JlT2JqZWN0KCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHJldHVybiBjb25maWd1cmVkIGRpcmVjdGx5XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbmZpZ3VyZWQpIHJldHVybiBjb25maWd1cmVkO1xuXG4gICAgY29uc3QgcWIgPSBleHBvcnRzWydxYi1jb3JlJ10/LkdldENvcmVPYmplY3Q/LigpO1xuICAgIGlmIChxYikgcmV0dXJuIHFiO1xuXG4gICAgY29uc3QgcWJ4ID0gZXhwb3J0c1sncWJ4LWNvcmUnXSA/PyBleHBvcnRzWydxYnhfY29yZSddO1xuICAgIGlmICh0eXBlb2YgcWJ4Py5HZXRDb3JlT2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBxYnguR2V0Q29yZU9iamVjdCgpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaCB0byByZXR1cm4gcWJ4IGRpcmVjdGx5XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHFieDtcbn07XG5cbmNvbnN0IGdldFBsYXllciA9IChzcmM6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IGZ3ID0gcmVzb2x2ZUZyYW1ld29yaygpO1xuICAgIHJldHVybiBmdz8uRnVuY3Rpb25zPy5HZXRQbGF5ZXI/LihzcmMpID8/IGZ3Py5HZXRQbGF5ZXI/LihzcmMpO1xufTtcblxub25OZXQoXCJkYWlseVNwaW46Z2V0U3RhdGVTZXJ2ZXJcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHNyYyA9IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIoc3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgY29uc3QgeyBjYW5DbGFpbSwgbGFzdENsYWltZWREaXNwbGF5IH0gPSBnZXRDb29sZG93blN0YXRlKHBsYXllcik7XG5cbiAgICBlbWl0TmV0KFwiZGFpbHlTcGluOnJldHVyblN0YXRlXCIsIHNyYywge1xuICAgICAgICB1c2VyRGF0YToge1xuICAgICAgICAgICAgY2FuQ2xhaW0sXG4gICAgICAgICAgICBsYXN0Q2xhaW1lZERpc3BsYXksXG4gICAgICAgIH0sXG4gICAgICAgIHJvdWxldHRlRGF0YTogRGFpbHlTcGluQ29uZmlnLlJvdWxldHRlRGF0YSxcbiAgICAgICAgcHJvYmFiaWxpdHk6IERhaWx5U3BpbkNvbmZpZy5SYXJpdHlQcm9iYWJpbGl0eSxcbiAgICAgICAgYW5pbWF0aW9uRHVyYXRpb246IERhaWx5U3BpbkNvbmZpZy5BbmltYXRpb25EdXJhdGlvbixcbiAgICB9KTtcbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpjbGFpbVNlcnZlclwiLCAoKSA9PiB7XG4gICAgY29uc3Qgc3JjID0gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcihzcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLlNldE1ldGFEYXRhKFwiUGhvbmVEYWlseVNwaW5cIiwgbm93SW5TZWNvbmRzKCkpO1xufSk7XG5cbm9uTmV0KFwiZGFpbHlTcGluOnJld2FyZFNlcnZlclwiLCAoaWQ6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHNyYyA9IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIoc3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgY29uc3QgcmV3YXJkSWQgPSBOdW1iZXIoaWQpO1xuICAgIGlmIChOdW1iZXIuaXNOYU4ocmV3YXJkSWQpKSByZXR1cm47XG5cbiAgICBjb25zdCByZXdhcmQgPSBEYWlseVNwaW5Db25maWcuUm91bGV0dGVEYXRhW3Jld2FyZElkXTtcbiAgICBpZiAoIXJld2FyZCkgcmV0dXJuO1xuXG4gICAgc3dpdGNoIChyZXdhcmQudHlwZSkge1xuICAgICAgICBjYXNlIFwidmVoaWNsZVwiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlVmVoaWNsZVwiLCByZXdhcmQubW9kZWwsIHNyYyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcIml0ZW1cIjpcbiAgICAgICAgICAgIGVtaXQoXCJkYWlseVNwaW46Z2l2ZUl0ZW1cIiwgcmV3YXJkLm1vZGVsLCByZXdhcmQucXVhbnRpdHkgPz8gMSwgc3JjKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiY2FzaFwiOlxuICAgICAgICAgICAgZW1pdChcImRhaWx5U3BpbjpnaXZlQ2FzaFwiLCByZXdhcmQubW9kZWwsIHNyYyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcImJhbmtcIjpcbiAgICAgICAgICAgIGVtaXQoXCJkYWlseVNwaW46Z2l2ZUJhbmtcIiwgcmV3YXJkLm1vZGVsLCBzcmMpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJ3ZWFwb25cIjpcbiAgICAgICAgICAgIGVtaXQoXCJkYWlseVNwaW46Z2l2ZVdlYXBvblwiLCByZXdhcmQubW9kZWwsIHNyYyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46c2VsbFNlcnZlclwiLCAoaWQ6IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHNyYyA9IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICAvLyBTZWxsaW5nIGRpc2FibGVkOyB0cmVhdCBzZWxsIGFzIGNvbGxlY3QvcmV3YXJkXG4gICAgZW1pdChcImRhaWx5U3BpbjpyZXdhcmRTZXJ2ZXJcIiwgaWQsIHNyYyk7XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46Z2l2ZUl0ZW1cIiwgKGl0ZW06IHN0cmluZywgcXR5ID0gMSwgc3JjPzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0U3JjID0gc3JjID8/IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIodGFyZ2V0U3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgcGxheWVyLkZ1bmN0aW9ucy5BZGRJdGVtKGl0ZW0sIHF0eSk7XG59KTtcblxub25OZXQoXCJkYWlseVNwaW46Z2l2ZUNhc2hcIiwgKGFtb3VudDogbnVtYmVyLCBzcmM/OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCB0YXJnZXRTcmMgPSBzcmMgPz8gTnVtYmVyKGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXRTcmMpO1xuICAgIGlmICghcGxheWVyKSByZXR1cm47XG5cbiAgICBwbGF5ZXIuRnVuY3Rpb25zLkFkZE1vbmV5KFwiY2FzaFwiLCBhbW91bnQsIFwiZGFpbHktc3Bpbi1jYXNoXCIpO1xufSk7XG5cbm9uTmV0KFwiZGFpbHlTcGluOmdpdmVCYW5rXCIsIChhbW91bnQ6IG51bWJlciwgc3JjPzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0U3JjID0gc3JjID8/IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIodGFyZ2V0U3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgcGxheWVyLkZ1bmN0aW9ucy5BZGRNb25leShcImJhbmtcIiwgYW1vdW50LCBcImRhaWx5LXNwaW4tYmFua1wiKTtcbn0pO1xuXG5vbk5ldChcImRhaWx5U3BpbjpnaXZlV2VhcG9uXCIsICh3ZWFwb246IHN0cmluZywgc3JjPzogbnVtYmVyKSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0U3JjID0gc3JjID8/IE51bWJlcihnbG9iYWwuc291cmNlKTtcbiAgICBjb25zdCBwbGF5ZXIgPSBnZXRQbGF5ZXIodGFyZ2V0U3JjKTtcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xuXG4gICAgcGxheWVyLkZ1bmN0aW9ucy5BZGRJdGVtKHdlYXBvbiwgRGFpbHlTcGluQ29uZmlnLldlYXBvbkFtb3VudCk7XG59KTtcblxuY29uc3QgZ2VuZXJhdGVQbGF0ZSA9IGFzeW5jICgpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICAgIGNvbnN0IGZ3ID0gcmVzb2x2ZUZyYW1ld29yaygpO1xuICAgIGlmICghZnc/LlNoYXJlZCkgcmV0dXJuIFwiU1BJTjEyM1wiO1xuXG4gICAgY29uc3QgcGxhdGUgPSBgJHtmdy5TaGFyZWQuUmFuZG9tSW50KDEpfSR7ZncuU2hhcmVkLlJhbmRvbVN0cigyKX0ke2Z3LlNoYXJlZC5SYW5kb21JbnQoMyl9JHtmdy5TaGFyZWQuUmFuZG9tU3RyKDIpfWA7XG5cbiAgICBjb25zdCBleGlzdHMgPSBNeVNRTD8uc2NhbGFyID8gYXdhaXQgTXlTUUwuc2NhbGFyKFwiU0VMRUNUIHBsYXRlIEZST00gcGxheWVyX3ZlaGljbGVzIFdIRVJFIHBsYXRlID0gP1wiLCBbcGxhdGVdKSA6IG51bGw7XG4gICAgaWYgKGV4aXN0cykge1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGVQbGF0ZSgpO1xuICAgIH1cblxuICAgIHJldHVybiBwbGF0ZS50b1VwcGVyQ2FzZSgpO1xufTtcblxub25OZXQoXCJkYWlseVNwaW46Z2l2ZVZlaGljbGVcIiwgYXN5bmMgKG1vZGVsOiBzdHJpbmcsIHNyYz86IG51bWJlcikgPT4ge1xuICAgIGNvbnN0IHRhcmdldFNyYyA9IHNyYyA/PyBOdW1iZXIoZ2xvYmFsLnNvdXJjZSk7XG4gICAgY29uc3QgcGxheWVyID0gZ2V0UGxheWVyKHRhcmdldFNyYyk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybjtcblxuICAgIGNvbnN0IHBsYXRlID0gYXdhaXQgZ2VuZXJhdGVQbGF0ZSgpO1xuXG4gICAgYXdhaXQgTXlTUUw/Lmluc2VydD8uKFxuICAgICAgICBcIklOU0VSVCBJTlRPIHBsYXllcl92ZWhpY2xlcyAobGljZW5zZSwgY2l0aXplbmlkLCB2ZWhpY2xlLCBoYXNoLCBtb2RzLCBwbGF0ZSwgZ2FyYWdlLCBzdGF0ZSkgVkFMVUVTICg/LCA/LCA/LCA/LCA/LCA/LCA/LCA/KVwiLFxuICAgICAgICBbXG4gICAgICAgICAgICBwbGF5ZXIuUGxheWVyRGF0YS5saWNlbnNlLFxuICAgICAgICAgICAgcGxheWVyLlBsYXllckRhdGEuY2l0aXplbmlkLFxuICAgICAgICAgICAgbW9kZWwsXG4gICAgICAgICAgICBHZXRIYXNoS2V5KG1vZGVsKSxcbiAgICAgICAgICAgIFwie31cIixcbiAgICAgICAgICAgIHBsYXRlLFxuICAgICAgICAgICAgRGFpbHlTcGluQ29uZmlnLkNhclBhcmtpbmdTcGF3bixcbiAgICAgICAgICAgIDAsIC8vIHN0b3JlZFxuICAgICAgICBdXG4gICAgKTtcbn0pO1xuXG5jb25zdCBjb21tYW5kQ3R4ID0gcmVzb2x2ZUZyYW1ld29yaygpPy5Db21tYW5kcztcbmlmIChjb21tYW5kQ3R4Py5BZGQpIHtcbiAgICBjb21tYW5kQ3R4LkFkZChcbiAgICAgICAgXCJyZXNldGRhaWx5c3BpblwiLFxuICAgICAgICBcIlJlc2V0IGEgcGxheWVyJ3MgZGFpbHkgc3BpbiBjb29sZG93blwiLFxuICAgICAgICBbeyBuYW1lOiBcImlkXCIsIGhlbHA6IFwiUGxheWVyIElEXCIgfV0sXG4gICAgICAgIHRydWUsXG4gICAgICAgIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IE51bWJlcihhcmdzWzBdKTtcbiAgICAgICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgZW1pdE5ldChcIlFCQ29yZTpOb3RpZnlcIiwgc291cmNlLCBcIkludmFsaWQgSURcIiwgXCJlcnJvclwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHBsYXllciA9IGdldFBsYXllcih0YXJnZXQpO1xuICAgICAgICAgICAgaWYgKCFwbGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBlbWl0TmV0KFwiUUJDb3JlOk5vdGlmeVwiLCBzb3VyY2UsIFwiUGxheWVyIG5vdCBvbmxpbmVcIiwgXCJlcnJvclwiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHBsYXllci5GdW5jdGlvbnMuU2V0TWV0YURhdGEoXCJQaG9uZURhaWx5U3BpblwiLCAwKTtcblxuICAgICAgICAgICAgZW1pdE5ldChcIlFCQ29yZTpOb3RpZnlcIiwgc291cmNlLCBgRGFpbHkgc3BpbiByZXNldCBmb3IgSUQgJHt0YXJnZXR9YCwgXCJzdWNjZXNzXCIpO1xuICAgICAgICAgICAgZW1pdE5ldChcIlFCQ29yZTpOb3RpZnlcIiwgdGFyZ2V0LCBcIllvdXIgRGFpbHkgU3BpbiBoYXMgYmVlbiByZXNldCFcIiwgXCJzdWNjZXNzXCIpO1xuICAgICAgICB9LFxuICAgICAgICBcImFkbWluXCJcbiAgICApO1xufSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oXCJbc3VtbWl0X3Bob25lXSBGcmFtZXdvcmsuQ29tbWFuZHMuQWRkIG5vdCBhdmFpbGFibGU7IHJlc2V0ZGFpbHlzcGluIGNvbW1hbmQgbm90IHJlZ2lzdGVyZWQuXCIpO1xufVxuIiwgImltcG9ydCB7IGdlbmVyYXRlVVVpZCB9IGZyb20gXCJAc2hhcmVkL3V0aWxzXCI7XG5cbmNvbnN0IEpTT05fQ09MVU1OUyA9IG5ldyBTZXQoW1xuICAgICdtZXNzYWdlcycsICdwaG90b3MnLCAnaW50ZXJlc3RzJywgJ2ludGVyZXN0ZWRJbkdlbmRlcnMnLCAnbGlmZXN0eWxlJyxcbiAgICAncHJvbXB0cycsICdmb2xsb3dlcnMnLCAnZm9sbG93aW5nJywgJ2xpa2VDb3VudCcsICdyZXBsaWVzQ291bnQnLFxuICAgICdyZXR3ZWV0Q291bnQnLCAnaGFzaHRhZ3MnLCAnYXR0YWNobWVudHMnLCAnYmFja2dyb3VuZCcsICdsb2Nrc2NyZWVuJyxcbiAgICAncmluZ3RvbmUnLCAnY29vcmRzJywgJ2NoYXJpbmZvJywgJ2pvYicsICdtZXRhZGF0YScsICdpdGVtcycsICdpbnZlbnRvcnknLFxuICAgICdncmFkZScsICdkYXRhJywgJ2Jsb2NrZWROdW1iZXJzJywgJ2RlbGV0ZWRNZXNzYWdlcydcbl0pO1xuXG5leHBvcnQgY2xhc3MgTXlTUUxBZGFwdGVyIHtcbiAgICBjb25zdHJ1Y3RvcigpIHt9XG5cbiAgICBpc0RCQ29ubmVjdGVkKCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTsgLy8gb3hteXNxbCBpcyB1c3VhbGx5IHJlYWR5XG4gICAgfVxuXG4gICAgLy8gSGVscGVyIHRvIHBhcnNlIHBvdGVudGlhbCBKU09OIGZpZWxkc1xuICAgIHByaXZhdGUgcGFyc2VSb3cocm93OiBhbnkpIHtcbiAgICAgICAgaWYgKCFyb3cpIHJldHVybiByb3c7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHJvdykge1xuICAgICAgICAgICAgaWYgKEpTT05fQ09MVU1OUy5oYXMoa2V5KSAmJiB0eXBlb2Ygcm93W2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcm93W2tleV0gPSBKU09OLnBhcnNlKHJvd1trZXldKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUud2FybihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yIGtleSAke2tleX06YCwgZSk7XG4gICAgICAgICAgICAgICAgICAgIC8vIEtlZXAgb3JpZ2luYWwgdmFsdWUgaWYgcGFyc2UgZmFpbHNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJvdztcbiAgICB9XG5cbiAgICBwcml2YXRlIHRyYW5zbGF0ZVF1ZXJ5KHF1ZXJ5OiBhbnkpOiB7IHNxbDogc3RyaW5nLCBwYXJhbXM6IGFueVtdIH0ge1xuICAgICAgICBpZiAoIXF1ZXJ5IHx8IE9iamVjdC5rZXlzKHF1ZXJ5KS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiB7IHNxbDogXCIxPTFcIiwgcGFyYW1zOiBbXSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY29uZGl0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgcGFyYW1zOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHF1ZXJ5KSB7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHF1ZXJ5W2tleV07XG5cbiAgICAgICAgICAgIGlmIChrZXkgPT09ICckb3InKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3JDb25kaXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc3ViUXVlcnkgb2YgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgeyBzcWwsIHBhcmFtczogc3ViUGFyYW1zIH0gPSB0aGlzLnRyYW5zbGF0ZVF1ZXJ5KHN1YlF1ZXJ5KTtcbiAgICAgICAgICAgICAgICAgICAgb3JDb25kaXRpb25zLnB1c2goYCgke3NxbH0pYCk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKC4uLnN1YlBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgKCR7b3JDb25kaXRpb25zLmpvaW4oJyBPUiAnKX0pYCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChrZXkgPT09ICckYW5kJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFuZENvbmRpdGlvbnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBzdWJRdWVyeSBvZiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHNxbCwgcGFyYW1zOiBzdWJQYXJhbXMgfSA9IHRoaXMudHJhbnNsYXRlUXVlcnkoc3ViUXVlcnkpO1xuICAgICAgICAgICAgICAgICAgICBhbmRDb25kaXRpb25zLnB1c2goYCgke3NxbH0pYCk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKC4uLnN1YlBhcmFtcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgKCR7YW5kQ29uZGl0aW9ucy5qb2luKCcgQU5EICcpfSlgKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAvLyBIYW5kbGUgT3BlcmF0b3JzXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlLiRuZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgIDw+ID9gKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUuJG5lKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLiRndCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgID4gP2ApO1xuICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCh2YWx1ZS4kZ3QpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuJGd0ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgID49ID9gKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUuJGd0ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZS4kbHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCA8ID9gKTtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godmFsdWUuJGx0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlLiRsdGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCA8PSA/YCk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKHZhbHVlLiRsdGUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuJGluICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlLiRpbi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYDE9MGApOyAvLyBJbiBlbXB0eSBhcnJheSBpcyBhbHdheXMgZmFsc2VcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IHZhbHVlLiRpbi5tYXAoKCkgPT4gJz8nKS5qb2luKCcsJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCBJTiAoJHtwbGFjZWhvbGRlcnN9KWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zLnB1c2goLi4udmFsdWUuJGluKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuJG5pbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICBpZiAodmFsdWUuJG5pbi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYDE9MWApOyAvLyBOb3QgaW4gZW1wdHkgYXJyYXkgaXMgYWx3YXlzIHRydWVcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IHZhbHVlLiRuaW4ubWFwKCgpID0+ICc/Jykuam9pbignLCcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgTk9UIElOICgke3BsYWNlaG9sZGVyc30pYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMucHVzaCguLi52YWx1ZS4kbmluKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUuJHJlZ2V4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uZGl0aW9ucy5wdXNoKGBcXGAke2tleX1cXGAgTElLRSA/YCk7XG4gICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKGAlJHt2YWx1ZS4kcmVnZXh9JWApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAvLyBBc3N1bWUgZGlyZWN0IGVxdWFsaXR5IGZvciBvYmplY3QgaWYgbm8ga25vd24gb3BlcmF0b3IgKG9yIGhhbmRsZWQgYXMgSlNPTj8pXG4gICAgICAgICAgICAgICAgICAgICAvLyBNb25nb0RCIGRvZXMgZXhhY3QgbWF0Y2ggb24gb2JqZWN0LiBNeVNRTCBjYW4ndCBlYXNpbHkuXG4gICAgICAgICAgICAgICAgICAgICAvLyBCdXQgZm9yIG5vdywgbGV0J3MgdHJlYXQgaXQgYXMgc3RyaW5nIG9yIGlnbm9yZT9cbiAgICAgICAgICAgICAgICAgICAgIC8vIElmIGl0IGlzIGEgZGF0ZSBvYmplY3Q/XG4gICAgICAgICAgICAgICAgICAgICBjb25kaXRpb25zLnB1c2goYFxcYCR7a2V5fVxcYCA9ID9gKTtcbiAgICAgICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbmRpdGlvbnMucHVzaChgXFxgJHtrZXl9XFxgID0gP2ApO1xuICAgICAgICAgICAgICAgIHBhcmFtcy5wdXNoKHZhbHVlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHNxbDogY29uZGl0aW9ucy5qb2luKCcgQU5EICcpLCBwYXJhbXMgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHRyYW5zbGF0ZU9wdGlvbnMob3B0aW9uczogYW55KTogc3RyaW5nIHtcbiAgICAgICAgbGV0IHNxbCA9IFwiXCI7XG4gICAgICAgIGlmICghb3B0aW9ucykgcmV0dXJuIHNxbDtcblxuICAgICAgICBpZiAob3B0aW9ucy5zb3J0KSB7XG4gICAgICAgICAgICBjb25zdCBzb3J0UGFydHMgPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIG9wdGlvbnMuc29ydCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRpciA9IG9wdGlvbnMuc29ydFtrZXldID09PSAxID8gJ0FTQycgOiAnREVTQyc7XG4gICAgICAgICAgICAgICAgc29ydFBhcnRzLnB1c2goYFxcYCR7a2V5fVxcYCAke2Rpcn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzb3J0UGFydHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIHNxbCArPSBgIE9SREVSIEJZICR7c29ydFBhcnRzLmpvaW4oJywgJyl9YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmxpbWl0KSB7XG4gICAgICAgICAgICBzcWwgKz0gYCBMSU1JVCAke051bWJlcihvcHRpb25zLmxpbWl0KX1gO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuc2tpcCkge1xuICAgICAgICAgICAgc3FsICs9IGAgT0ZGU0VUICR7TnVtYmVyKG9wdGlvbnMuc2tpcCl9YDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzcWw7XG4gICAgfVxuXG4gICAgYXN5bmMgZmluZE9uZShjb2xsZWN0aW9uOiBzdHJpbmcsIHF1ZXJ5OiBhbnksIHByb2plY3Rpb24/OiBhbnksIG9wdGlvbnM/OiBhbnkpIHtcbiAgICAgICAgY29uc3QgeyBzcWw6IHdoZXJlQ2xhdXNlLCBwYXJhbXMgfSA9IHRoaXMudHJhbnNsYXRlUXVlcnkocXVlcnkpO1xuICAgICAgICBjb25zdCBzcWwgPSBgU0VMRUNUICogRlJPTSBcXGAke2NvbGxlY3Rpb259XFxgIFdIRVJFICR7d2hlcmVDbGF1c2V9IExJTUlUIDFgO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBnbG9iYWwuZXhwb3J0cy5veG15c3FsLnNpbmdsZV9hc3luYyhzcWwsIHBhcmFtcyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZVJvdyhyZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTXlTUUxBZGFwdGVyXSBmaW5kT25lIGVycm9yIGluICR7Y29sbGVjdGlvbn06YCwgZSk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGZpbmRNYW55KGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSwgcHJvamVjdGlvbj86IGFueSwgdW5rbm93bj86IGFueSwgb3B0aW9ucz86IGFueSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIGxldCBzcWwgPSBgU0VMRUNUICogRlJPTSBcXGAke2NvbGxlY3Rpb259XFxgIFdIRVJFICR7d2hlcmVDbGF1c2V9YDtcbiAgICAgICAgc3FsICs9IHRoaXMudHJhbnNsYXRlT3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwucXVlcnlfYXN5bmMoc3FsLCBwYXJhbXMpO1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0cykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cy5tYXAocm93ID0+IHRoaXMucGFyc2VSb3cocm93KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNeVNRTEFkYXB0ZXJdIGZpbmRNYW55IGVycm9yIGluICR7Y29sbGVjdGlvbn06YCwgZSk7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBpbnNlcnRPbmUoY29sbGVjdGlvbjogc3RyaW5nLCBkb2M6IGFueSkge1xuICAgICAgICBpZiAoIWRvYykgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICghZG9jLl9pZCkgZG9jLl9pZCA9IGdlbmVyYXRlVVVpZCgpO1xuXG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhkb2MpO1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBPYmplY3QudmFsdWVzKGRvYykubWFwKHYgPT4ge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2ID09PSAnb2JqZWN0JyAmJiB2ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KHYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHY7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHBsYWNlaG9sZGVycyA9IGtleXMubWFwKCgpID0+ICc/Jykuam9pbignLCcpO1xuICAgICAgICBjb25zdCBjb2x1bW5zID0ga2V5cy5tYXAoayA9PiBgXFxgJHtrfVxcYGApLmpvaW4oJywnKTtcbiAgICAgICAgY29uc3Qgc3FsID0gYElOU0VSVCBJTlRPIFxcYCR7Y29sbGVjdGlvbn1cXGAgKCR7Y29sdW1uc30pIFZBTFVFUyAoJHtwbGFjZWhvbGRlcnN9KWA7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGdsb2JhbC5leHBvcnRzLm94bXlzcWwuaW5zZXJ0X2FzeW5jKHNxbCwgdmFsdWVzKTtcbiAgICAgICAgICAgIHJldHVybiBkb2M7IC8vIE1vbmdvREIgaW5zZXJ0T25lIHJldHVybnMgcmVzdWx0LCBidXQgY29kZSBleHBlY3RzIHRoZSBkb2Mgb2Z0ZW4gb3IgY2hlY2tzIHRydXRoaW5lc3NcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNeVNRTEFkYXB0ZXJdIGluc2VydE9uZSBlcnJvciBpbiAke2NvbGxlY3Rpb259OmAsIGUpO1xuICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgdXBkYXRlT25lKGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSwgdXBkYXRlOiBhbnksIG9wdGlvbnM/OiBhbnkpIHtcbiAgICAgICAgY29uc3QgeyBzcWw6IHdoZXJlQ2xhdXNlLCBwYXJhbXM6IHdoZXJlUGFyYW1zIH0gPSB0aGlzLnRyYW5zbGF0ZVF1ZXJ5KHF1ZXJ5KTtcblxuICAgICAgICAvLyBIYW5kbGUgJHNldCwgJHB1c2gsIGV0Yz9cbiAgICAgICAgLy8gQ29kZSBtb3N0bHkgdXNlcyByZXBsYWNlbWVudCBvYmplY3Qgb3Igc2ltcGxlIHVwZGF0ZS5cbiAgICAgICAgLy8gSWYgJ3VwZGF0ZScgaGFzIHRvcCBsZXZlbCBrZXlzIHRoYXQgYXJlIG5vdCBvcGVyYXRvcnMsIGl0IG1pZ2h0IGJlIGEgcmVwbGFjZW1lbnQ/XG4gICAgICAgIC8vIE1vbmdvREIgdXBkYXRlT25lKGZpbHRlciwgdXBkYXRlLCBvcHRpb25zKVxuICAgICAgICAvLyBJZiB1cGRhdGUgY29udGFpbnMgYXRvbWljIG9wZXJhdG9ycyAoJHNldCksIGl0IHVwZGF0ZXMgZmllbGRzLlxuICAgICAgICAvLyBJZiBpdCBkb2Vzbid0LCBpdCBSRVBMQUNFUyB0aGUgZG9jdW1lbnQgKGluIHNvbWUgZHJpdmVyIHZlcnNpb25zKSBidXQgdXN1YWxseSB1cGRhdGVPbmUgcmVxdWlyZXMgJHNldCBpbiBtb2Rlcm4gbW9uZ28/XG4gICAgICAgIC8vIENoZWNraW5nIHRoZSBjb2RlOiBgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBfaWQ6IGNvbnRhY3REYXRhLl9pZCB9LCB7IC4uLmNvbnRhY3REYXRhIH0pO2BcbiAgICAgICAgLy8gVGhpcyBsb29rcyBsaWtlIGEgcmVwbGFjZW1lbnQgb3IgbWVyZ2UuXG4gICAgICAgIC8vIGBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfY29udGFjdHMnLCB7IF9pZDogX2lkIH0sIGRhdGFYKTtgXG4gICAgICAgIC8vIGBhd2FpdCBNb25nb0RCLnVwZGF0ZU9uZSgncGhvbmVfYnVzaW5lc3NfdXNlcnMnLCB7IGNpdGl6ZW5pZDogcGxheWVyIH0sIHsgam9iQ2FsbHM6ICFQbGF5ZXJEYXRhLmpvYkNhbGxzIH0pO2AgLT4gVGhpcyBsb29rcyBsaWtlIGEgcGFydGlhbCB1cGRhdGUgKG1lcmdlKS5cbiAgICAgICAgLy8gU2luY2UgSSdtIHVzaW5nIFNRTCwgYFVQREFURSB0YWJsZSBTRVQgLi4uYCBpcyBwYXJ0aWFsIHVwZGF0ZSBieSBkZWZhdWx0LlxuXG4gICAgICAgIC8vIEJ1dCB3aGF0IGlmIHRoZXkgdXNlIGAkc2V0YD9cbiAgICAgICAgbGV0IHVwZGF0ZURhdGEgPSB1cGRhdGU7XG4gICAgICAgIGlmICh1cGRhdGUuJHNldCkge1xuICAgICAgICAgICAgdXBkYXRlRGF0YSA9IHsgLi4udXBkYXRlRGF0YSwgLi4udXBkYXRlLiRzZXQgfTtcbiAgICAgICAgICAgIGRlbGV0ZSB1cGRhdGVEYXRhLiRzZXQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaGF0IGlmIHRoZXkgdXNlIGAkcHVzaGA/XG4gICAgICAgIC8vIGB0d2VldC5saWtlQ291bnQucHVzaChlbWFpbCk7IGF3YWl0IE1vbmdvREIudXBkYXRlT25lKC4uLiwgdHdlZXQpO2BcbiAgICAgICAgLy8gVGhlIGNvZGUgdXN1YWxseSBtb2RpZmllcyB0aGUgb2JqZWN0IGluIG1lbW9yeSBhbmQgdGhlbiBzYXZlcyB0aGUgd2hvbGUgb2JqZWN0IGJhY2shXG4gICAgICAgIC8vIEV4YW1wbGUgaW4gUGlnZW9uU2VydmljZTogYHR3ZWV0Lmxpa2VDb3VudC5wdXNoKGVtYWlsKTsgYXdhaXQgTW9uZ29EQi51cGRhdGVPbmUoXCJwaG9uZV9waWdlb25fdHdlZXRzXCIsIHsgX2lkOiB0d2VldElkIH0sIHR3ZWV0KTtgXG4gICAgICAgIC8vIFNvIHRoZXkgYXJlIHNlbmRpbmcgdGhlIEZVTEwgT0JKRUNUIGFzIGB1cGRhdGVgLlxuICAgICAgICAvLyBTbyBJIGNhbiBqdXN0IHVwZGF0ZSBhbGwgZmllbGRzIHByZXNlbnQgaW4gYHVwZGF0ZWAuXG5cbiAgICAgICAgY29uc3Qgc2V0Q2xhdXNlczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3Qgc2V0UGFyYW1zOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHVwZGF0ZURhdGEpIHtcbiAgICAgICAgICAgIGlmIChrZXkgPT09ICdfaWQnKSBjb250aW51ZTsgLy8gRG9uJ3QgdXBkYXRlIFBLIHVzdWFsbHlcbiAgICAgICAgICAgIHNldENsYXVzZXMucHVzaChgXFxgJHtrZXl9XFxgID0gP2ApO1xuICAgICAgICAgICAgbGV0IHZhbCA9IHVwZGF0ZURhdGFba2V5XTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnb2JqZWN0JyAmJiB2YWwgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB2YWwgPSBKU09OLnN0cmluZ2lmeSh2YWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2V0UGFyYW1zLnB1c2godmFsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzZXRDbGF1c2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgY29uc3Qgc3FsID0gYFVQREFURSBcXGAke2NvbGxlY3Rpb259XFxgIFNFVCAke3NldENsYXVzZXMuam9pbignLCAnKX0gV0hFUkUgJHt3aGVyZUNsYXVzZX1gO1xuICAgICAgICBjb25zdCBmaW5hbFBhcmFtcyA9IFsuLi5zZXRQYXJhbXMsIC4uLndoZXJlUGFyYW1zXTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgZ2xvYmFsLmV4cG9ydHMub3hteXNxbC51cGRhdGVfYXN5bmMoc3FsLCBmaW5hbFBhcmFtcyk7XG4gICAgICAgICAgICByZXR1cm4geyBtb2RpZmllZENvdW50OiAxIH07XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNeVNRTEFkYXB0ZXJdIHVwZGF0ZU9uZSBlcnJvciBpbiAke2NvbGxlY3Rpb259OmAsIGUpO1xuICAgICAgICAgICAgcmV0dXJuIHsgbW9kaWZpZWRDb3VudDogMCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYXN5bmMgZGVsZXRlT25lKGNvbGxlY3Rpb246IHN0cmluZywgcXVlcnk6IGFueSkge1xuICAgICAgICBjb25zdCB7IHNxbDogd2hlcmVDbGF1c2UsIHBhcmFtcyB9ID0gdGhpcy50cmFuc2xhdGVRdWVyeShxdWVyeSk7XG4gICAgICAgIGNvbnN0IHNxbCA9IGBERUxFVEUgRlJPTSBcXGAke2NvbGxlY3Rpb259XFxgIFdIRVJFICR7d2hlcmVDbGF1c2V9IExJTUlUIDFgO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBnbG9iYWwuZXhwb3J0cy5veG15c3FsLnVwZGF0ZV9hc3luYyhzcWwsIHBhcmFtcyk7XG4gICAgICAgICAgICByZXR1cm4geyBkZWxldGVkQ291bnQ6IDEgfTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gZGVsZXRlT25lIGVycm9yIGluICR7Y29sbGVjdGlvbn06YCwgZSk7XG4gICAgICAgICAgICByZXR1cm4geyBkZWxldGVkQ291bnQ6IDAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFzeW5jIGZpbmRBbmRSZXR1cm5TcGVjaWZpY0ZpZWxkcyhjb2xsZWN0aW9uOiBzdHJpbmcsIHF1ZXJ5OiBhbnksIGZpZWxkczogc3RyaW5nW10pIHtcbiAgICAgICAgY29uc3QgeyBzcWw6IHdoZXJlQ2xhdXNlLCBwYXJhbXMgfSA9IHRoaXMudHJhbnNsYXRlUXVlcnkocXVlcnkpO1xuICAgICAgICBjb25zdCBjb2x1bW5zID0gZmllbGRzLm1hcChmID0+IGBcXGAke2Z9XFxgYCkuam9pbignLCAnKTtcbiAgICAgICAgY29uc3Qgc3FsID0gYFNFTEVDVCAke2NvbHVtbnN9IEZST00gXFxgJHtjb2xsZWN0aW9ufVxcYCBXSEVSRSAke3doZXJlQ2xhdXNlfSBMSU1JVCAxYDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZ2xvYmFsLmV4cG9ydHMub3hteXNxbC5zaW5nbGVfYXN5bmMoc3FsLCBwYXJhbXMpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2VSb3cocmVzdWx0KTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNeVNRTEFkYXB0ZXJdIGZpbmRBbmRSZXR1cm5TcGVjaWZpY0ZpZWxkcyBlcnJvciBpbiAke2NvbGxlY3Rpb259OmAsIGUpO1xuICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ3VzdG9tIGhhbmRsaW5nIGZvciBhZ2dyZWdhdGlvbiAoc3BlY2lmaWNhbGx5IGZvciBQaWdlb24gY29udmVyc2F0aW9ucylcbiAgICBhc3luYyBhZ2dyZWdhdGUoY29sbGVjdGlvbjogc3RyaW5nLCBwaXBlbGluZTogYW55W10pIHtcbiAgICAgICAgaWYgKGNvbGxlY3Rpb24gPT09ICdwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlcycpIHtcbiAgICAgICAgICAgIC8vIFRoaXMgaXMgbGlrZWx5IHRoZSBnZXRDb252ZXJzYXRpb25zIGNhbGxcbiAgICAgICAgICAgIC8vIFdlIG5lZWQgdG8gZmV0Y2ggYWxsIG1lc3NhZ2VzIGZvciB0aGUgdXNlciwgZ3JvdXAgYnkgY29udmVyc2F0aW9uIHBhcnRuZXIsIGZpbmQgbGF0ZXN0LlxuXG4gICAgICAgICAgICAvLyBFeHRyYWN0IHVzZXJFbWFpbCBmcm9tIHRoZSBmaXJzdCAkbWF0Y2ggc3RhZ2VcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoU3RhZ2UgPSBwaXBlbGluZS5maW5kKHMgPT4gcy4kbWF0Y2gpO1xuICAgICAgICAgICAgbGV0IHVzZXJFbWFpbCA9IG51bGw7XG4gICAgICAgICAgICBpZiAobWF0Y2hTdGFnZSkge1xuICAgICAgICAgICAgICAgICAvLyBUcnkgdG8gZmluZCB0aGUgZW1haWwuIEl0J3MgdXN1YWxseSBpbiAkb3I6IFt7c2VuZGVyRW1haWw6IFh9LCB7cmVjaXBpZW50RW1haWw6IFh9XVxuICAgICAgICAgICAgICAgICBjb25zdCBvciA9IG1hdGNoU3RhZ2UuJG1hdGNoLiRvcjtcbiAgICAgICAgICAgICAgICAgaWYgKG9yICYmIG9yWzBdICYmIG9yWzBdLnNlbmRlckVtYWlsKSB1c2VyRW1haWwgPSBvclswXS5zZW5kZXJFbWFpbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCF1c2VyRW1haWwpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiW015U1FMQWRhcHRlcl0gQWdncmVnYXRlOiBDb3VsZCBub3QgaWRlbnRpZnkgdXNlckVtYWlsIGZyb20gcGlwZWxpbmVcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTUUwgU3RyYXRlZ3k6XG4gICAgICAgICAgICAvLyAxLiBHZXQgYWxsIG1lc3NhZ2VzIHdoZXJlIHNlbmRlciBvciByZWNpcGllbnQgaXMgdXNlckVtYWlsXG4gICAgICAgICAgICAvLyAyLiBTb3J0IGJ5IGRhdGUgREVTQ1xuICAgICAgICAgICAgLy8gMy4gUHJvY2VzcyBpbiBKUyB0byBHcm91cFxuXG4gICAgICAgICAgICBjb25zdCBzcWwgPSBgU0VMRUNUICogRlJPTSBcXGBwaG9uZV9waWdlb25fcHJpdmF0ZV9tZXNzYWdlc1xcYCBXSEVSRSBcXGBzZW5kZXJFbWFpbFxcYCA9ID8gT1IgXFxgcmVjaXBpZW50RW1haWxcXGAgPSA/IE9SREVSIEJZIFxcYGNyZWF0ZWRBdFxcYCBERVNDYDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZXMgPSBhd2FpdCBnbG9iYWwuZXhwb3J0cy5veG15c3FsLnF1ZXJ5X2FzeW5jKHNxbCwgW3VzZXJFbWFpbCwgdXNlckVtYWlsXSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjb252ZXJzYXRpb25zID0gbmV3IE1hcCgpO1xuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3RoZXJFbWFpbCA9IG1zZy5zZW5kZXJFbWFpbCA9PT0gdXNlckVtYWlsID8gbXNnLnJlY2lwaWVudEVtYWlsIDogbXNnLnNlbmRlckVtYWlsO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbnZlcnNhdGlvbnMuaGFzKG90aGVyRW1haWwpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb252ZXJzYXRpb25zLnNldChvdGhlckVtYWlsLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdE1lc3NhZ2U6IHRoaXMucGFyc2VSb3cobXNnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bnJlYWRDb3VudDogMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdGhlckVtYWlsOiBvdGhlckVtYWlsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnYgPSBjb252ZXJzYXRpb25zLmdldChvdGhlckVtYWlsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1zZy5yZWNpcGllbnRFbWFpbCA9PT0gdXNlckVtYWlsICYmIG1zZy5yZWFkID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb252LnVucmVhZENvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBOb3cgd2UgbmVlZCB0byBmZXRjaCB1c2VyIGluZm8gZm9yIGVhY2ggY29udmVyc2F0aW9uXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBjb252IG9mIGNvbnZlcnNhdGlvbnMudmFsdWVzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdXNlciA9IGF3YWl0IHRoaXMuZmluZE9uZSgncGhvbmVfcGlnZW9uX3VzZXJzJywgeyBlbWFpbDogY29udi5vdGhlckVtYWlsIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdGhlclVzZXI6IHVzZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICBsYXN0TWVzc2FnZTogY29udi5sYXN0TWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVucmVhZENvdW50OiBjb252LnVucmVhZENvdW50XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG5cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW015U1FMQWRhcHRlcl0gQWdncmVnYXRlIGVycm9yOmAsIGUpO1xuICAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zb2xlLndhcm4oYFtNeVNRTEFkYXB0ZXJdIFVuaGFuZGxlZCBhZ2dyZWdhdGlvbiBmb3IgY29sbGVjdGlvbiAke2NvbGxlY3Rpb259YCk7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG59XG4iLCAiaW1wb3J0IFwiLi9zdl9leHBvcnRzXCI7XG5pbXBvcnQgXCIuL2FwcHMvaW5kZXhcIjtcbmltcG9ydCB7IFV0aWxzIH0gZnJvbSBcIi4vY2xhc3Nlcy9VdGlsc1wiO1xuaW1wb3J0IHsgU2V0dGluZ3MgfSBmcm9tIFwiLi9hcHBzL1NldHRpbmdzL2NsYXNzXCI7XG5pbXBvcnQgeyBEZWxheSwgZ2VuZXJhdGVVVWlkLCBMT0dHRVIgfSBmcm9tIFwiQHNoYXJlZC91dGlsc1wiO1xuaW1wb3J0IHsgb25DbGllbnRDYWxsYmFjayB9IGZyb20gXCJAb3ZlcmV4dGVuZGVkL294X2xpYi9zZXJ2ZXJcIjtcbmltcG9ydCB7IEludm9pY2VSZWN1cnJpbmdQYXltZW50cyB9IGZyb20gXCIuL2FwcHMvV2FsbGV0L2NhbGxiYWNrc1wiO1xuaW1wb3J0IHsgcGlnZW9uU2VydmljZSB9IGZyb20gXCIuL2FwcHMvUGlnZW9uL1BpZ2VvblNlcnZpY2VcIjtcbmltcG9ydCB7IE15U1FMQWRhcHRlciB9IGZyb20gXCIuL2NsYXNzZXMvTXlTUUxBZGFwdGVyXCI7XG5pbXBvcnQgeyBGUkFNRVdPUktfUkVTT1VSQ0UgfSBmcm9tIFwiLi4vc2hhcmVkL3V0aWxzXCI7IC8vIGFkanVzdCBwYXRoIGFzIG5lZWRlZFxuY29uc3QgcmVzb2x2ZUZyYW1ld29yayA9ICgpID0+IHtcbiAgICBjb25zdCBjb25maWd1cmVkID0gZXhwb3J0c1tGUkFNRVdPUktfUkVTT1VSQ0VdO1xuICAgIGlmICh0eXBlb2YgY29uZmlndXJlZD8uR2V0Q29yZU9iamVjdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gY29uZmlndXJlZC5HZXRDb3JlT2JqZWN0KCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHJldHVybiBjb25maWd1cmVkIGRpcmVjdGx5XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNvbmZpZ3VyZWQpIHJldHVybiBjb25maWd1cmVkO1xuXG4gICAgY29uc3QgcWIgPSBleHBvcnRzWydxYi1jb3JlJ10/LkdldENvcmVPYmplY3Q/LigpO1xuICAgIGlmIChxYikgcmV0dXJuIHFiO1xuICAgIGlmIChleHBvcnRzWydxYi1jb3JlJ10pIHJldHVybiBleHBvcnRzWydxYi1jb3JlJ107XG5cbiAgICBjb25zdCBxYnggPSBleHBvcnRzWydxYngtY29yZSddID8/IGV4cG9ydHNbJ3FieF9jb3JlJ107XG4gICAgaWYgKHR5cGVvZiBxYng/LkdldENvcmVPYmplY3QgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIHFieC5HZXRDb3JlT2JqZWN0KCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHJldHVybiBxYnggZGlyZWN0bHlcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcWJ4O1xufTtcblxuZXhwb3J0IGxldCBGcmFtZXdvcmsgPSByZXNvbHZlRnJhbWV3b3JrKCk7XG5cbmV4cG9ydCBjb25zdCBNb25nb0RCID0gbmV3IE15U1FMQWRhcHRlcigpO1xuXG5leHBvcnQgY29uc3QgTXlTUUwgPSBleHBvcnRzLm94bXlzcWw7XG5leHBvcnQgY29uc3QgTG9nZ2VyID0gZXhwb3J0c1sncWItc21hbGxyZXNvdXJjZXMnXTtcblxudHlwZSBFeHRlcm5hbE1haWxEYXRhID0ge1xuICAgIGVtYWlsPzogc3RyaW5nO1xuICAgIHN1YmplY3Q/OiBzdHJpbmc7XG4gICAgbWVzc2FnZT86IHN0cmluZztcbiAgICBpbWFnZXM/OiBzdHJpbmdbXTtcbn07XG5cbm9uKCdRQkNvcmU6U2VydmVyOlVwZGF0ZU9iamVjdCcsICgpID0+IHtcbiAgICBGcmFtZXdvcmsgPSByZXNvbHZlRnJhbWV3b3JrKCk7XG59KTtcblxuc2V0SW1tZWRpYXRlKCgpID0+IHtcbiAgICBVdGlscy5sb2FkKCk7XG4gICAgU2V0dGluZ3MubG9hZCgpO1xufSk7XG5cbm9uQ2xpZW50Q2FsbGJhY2soJ3Bob25lOnNlcnZlcjpzaGFyZU51bWJlcicsIGFzeW5jIChzb3VyY2U6IGFueSwgY29taW5nU291cmNlOiBhbnkpID0+IHtcbiAgICBjb25zdCBzb3VyY2VYID0gc291cmNlO1xuICAgIGNvbnN0IHNvdXJjZU51bWJlciA9IGF3YWl0IFV0aWxzLkdldFBob25lTnVtYmVyQnlTb3VyY2Uoc291cmNlWCk7XG4gICAgY29uc3QgYWNOdW1iZXIgPSBhd2FpdCBVdGlscy5HZXRQaG9uZU51bWJlckJ5U291cmNlKGNvbWluZ1NvdXJjZSk7XG4gICAgY29uc3QgZnVsbG5hbWUgPSBhd2FpdCBleHBvcnRzW0ZSQU1FV09SS19SRVNPVVJDRV0uR2V0UGxheWVyTmFtZShzb3VyY2VYKTtcbiAgICBjb25zdCBicmVha2VkTmFtZSA9IGZ1bGxuYW1lLnNwbGl0KCcgJyk7XG5cbiAgICBpZiAoIXNvdXJjZU51bWJlciB8fCAhYWNOdW1iZXIpIHJldHVybjtcbiAgICBjb25zdCBjb250YWN0RGF0YSA9IHtcbiAgICAgICAgX2lkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgcGVyc29uYWxOdW1iZXI6IGFjTnVtYmVyLFxuICAgICAgICBjb250YWN0TnVtYmVyOiBzb3VyY2VOdW1iZXIsXG4gICAgICAgIGZpcnN0TmFtZTogYnJlYWtlZE5hbWVbMF0sXG4gICAgICAgIGxhc3ROYW1lOiBicmVha2VkTmFtZVsxXSxcbiAgICAgICAgaW1hZ2U6IGF3YWl0IFV0aWxzLkdldENvbnRhY3RBdmF0YXJCeU51bWJlcihzb3VyY2VOdW1iZXIsIGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIoc291cmNlTnVtYmVyKSksXG4gICAgICAgIG93bmVySWQ6IGF3YWl0IFV0aWxzLkdldENpdGl6ZW5JZEJ5UGhvbmVOdW1iZXIoYWNOdW1iZXIpLFxuICAgICAgICBub3RlczogXCJcIixcbiAgICAgICAgZW1haWw6IFwiXCIsXG4gICAgICAgIGlzRmF2OiBmYWxzZVxuICAgIH1cbiAgICBjb25zdCByZXMgPSBhd2FpdCBNb25nb0RCLmZpbmRPbmUoJ3Bob25lX2NvbnRhY3RzJywgeyBwZXJzb25hbE51bWJlcjogYWNOdW1iZXIsIGNvbnRhY3ROdW1iZXI6IHNvdXJjZU51bWJlciB9KTtcbiAgICBpZiAocmVzKSB7XG4gICAgICAgIHJldHVybiBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNvdXJjZVgsIEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIGlkOiBnZW5lcmF0ZVVVaWQoKSxcbiAgICAgICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IGBOdW1iZXIgQWxyZWFkeSBTaGFyZWQuYCxcbiAgICAgICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICAgICAgfSkpO1xuICAgIH1cbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIE51bWJlcihzb3VyY2VYKSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIlBob25lXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBgWW91IGhhdmUgc2hhcmVkIHlvdXIgUGhvbmUgTnVtYmVyLmAsXG4gICAgICAgIGFwcDogXCJzZXR0aW5nc1wiLFxuICAgICAgICB0aW1lb3V0OiA1MDAwLFxuICAgIH0pKTtcbiAgICBjb25zdCBzZW5kSWQgPSBnZW5lcmF0ZVVVaWQoKTtcbiAgICBlbWl0TmV0KCdwaG9uZTphZGRBY3Rpb25Ob3RpZmljYXRpb24nLCBOdW1iZXIoY29taW5nU291cmNlKSwgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogc2VuZElkLFxuICAgICAgICB0aXRsZTogXCJQaG9uZVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogYCR7ZnVsbG5hbWV9IHdhbnRzIHRvIHNoYXJlIHRoZWlyIG51bWJlciB3aXRoIHlvdS5gLFxuICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgaWNvbnM6IHtcbiAgICAgICAgICAgIFwiMFwiOiB7XG4gICAgICAgICAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9jcm9zcy1jaXJjbGUuc3ZnXCIsXG4gICAgICAgICAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgICAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmFkZENvbnRhY3RcIixcbiAgICAgICAgICAgICAgICBhcmdzOiB7fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFwiMVwiOiB7XG4gICAgICAgICAgICAgICAgaWNvbjogXCJodHRwczovL2lnbmlzLXJwLmNvbS91cGxvYWRzL3NlcnZlci9waG9uZS9hY2NlcHQuc3ZnXCIsXG4gICAgICAgICAgICAgICAgaXNTZXJ2ZXI6IHRydWUsXG4gICAgICAgICAgICAgICAgZXZlbnQ6IFwicGhvbmU6c2VydmVyOmFkZENvbnRhY3RcIixcbiAgICAgICAgICAgICAgICBhcmdzOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRhY3REYXRhLFxuICAgICAgICAgICAgICAgICAgICBjb21pbmdTb3VyY2UsXG4gICAgICAgICAgICAgICAgICAgIGZ1bGxuYW1lLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pKTtcblxufSk7XG5cbm9uTmV0KCdwaG9uZTpzZXJ2ZXI6YWRkQ29udGFjdCcsIGFzeW5jIChpZDogc3RyaW5nLCBkYXRhOiB7XG4gICAgY29taW5nU291cmNlOiBhbnksXG4gICAgZnVsbG5hbWU6IHN0cmluZyxcbiAgICBjb250YWN0RGF0YTogYW55LFxuICAgIGlkOiBzdHJpbmdcbn0pID0+IHtcbiAgICBjb25zdCBzcmMgPSBnbG9iYWwuc291cmNlO1xuICAgIC8qIGNvbnNvbGUubG9nKCdBZGRpbmcgY29udGFjdCcsIGlkLCBkYXRhKTsgKi9cbiAgICBlbWl0TmV0KFwicGhvbmU6Y2xpZW50OnJlbW92ZUFjdGlvbk5vdGlmaWNhdGlvblwiLCBzcmMsIGlkKTtcbiAgICBpZiAoIWRhdGEuY29udGFjdERhdGEgfHwgIWRhdGEuY29taW5nU291cmNlIHx8ICFkYXRhLmZ1bGxuYW1lKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYXdhaXQgRGVsYXkoNTAwKTtcbiAgICBlbWl0TmV0KFwicGhvbmU6YWRkbm90aUZpY2F0aW9uXCIsIHNyYywgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBpZDogZ2VuZXJhdGVVVWlkKCksXG4gICAgICAgIHRpdGxlOiBcIlN5c3RlbVwiLFxuICAgICAgICBkZXNjcmlwdGlvbjogYE51bWJlciBTYXZlZC5gLFxuICAgICAgICBhcHA6IFwic2V0dGluZ3NcIixcbiAgICAgICAgdGltZW91dDogNTAwMCxcbiAgICB9KSk7XG4gICAgYXdhaXQgTW9uZ29EQi5pbnNlcnRPbmUoJ3Bob25lX2NvbnRhY3RzJywgZGF0YS5jb250YWN0RGF0YSk7XG4gICAgTG9nZ2VyLkFkZExvZyh7XG4gICAgICAgIHR5cGU6ICdwaG9uZV9jb250YWN0cycsXG4gICAgICAgIHRpdGxlOiAnQ29udGFjdCBTaGFyZWQnLFxuICAgICAgICBtZXNzYWdlOiBgJHtkYXRhLmZ1bGxuYW1lfSAsICR7ZGF0YS5jb250YWN0RGF0YS5jb250YWN0TnVtYmVyfSBoYXMgc2hhcmVkIHRoZWlyIG51bWJlciB3aXRoICR7ZGF0YS5jb250YWN0RGF0YS5wZXJzb25hbE51bWJlcn1gLFxuICAgICAgICBzaG93SWRlbnRpZmllcnM6IGZhbHNlXG4gICAgfSk7XG59KTtcblxub24oJ3N1bW1pdF9waG9uZTpzZXJ2ZXI6Q3JvblRyaWdnZXInLCBhc3luYyAoKSA9PiB7XG4gICAgLyogY29uc29sZS5sb2coJ0Nyb24gVHJpZ2dlcmVkJyk7ICovXG4gICAgSW52b2ljZVJlY3VycmluZ1BheW1lbnRzKCk7XG59KTtcblxuUmVnaXN0ZXJDb21tYW5kKCdyZXNldFBob25lUGFzc2NvZGUnLCBhc3luYyAoc291cmNlOiBudW1iZXIsIGFyZ3M6IHN0cmluZ1tdKSA9PiB7XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc291cmNlKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuO1xuICAgIFNldHRpbmdzLmxvY2tQaW4uc2V0KGNpdGl6ZW5JZCwgJzAwMDAwMCcpO1xuICAgIGF3YWl0IERlbGF5KDEwMDApO1xuICAgIFNldHRpbmdzLlNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIGVtaXROZXQoJ3Bob25lOmNsaWVudDpzZXR1cFBob25lJywgc291cmNlLCBjaXRpemVuSWQpO1xufSwgZmFsc2UpO1xuXG5SZWdpc3RlckNvbW1hbmQoJ3ZlcmlmeVBlZ2lvbicsIGFzeW5jIChzb3VyY2U6IG51bWJlciwgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICBpZiAoIWFyZ3NbMF0pIHtcbiAgICAgICAgcmV0dXJuIExPR0dFUignUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBlbWFpbCBhZGRyZXNzLicpO1xuICAgIH1cbiAgICBjb25zdCBlbWFpbCA9IGFyZ3NbMF07XG4gICAgY29uc3QgcmVzID0gYXdhaXQgcGlnZW9uU2VydmljZS52ZXJpZnlVc2VyKHNvdXJjZSwgZW1haWwpO1xuICAgIGlmIChyZXMgPT09IFwic3VjY2Vzc1wiKSB7XG4gICAgICAgIHJldHVybiBMT0dHRVIoYFVzZXIgJHtlbWFpbH0gaGFzIGJlZW4gdmVyaWZpZWQgc3VjY2Vzc2Z1bGx5LmApO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBMT0dHRVIoYEZhaWxlZCB0byB2ZXJpZnkgdXNlciAke2VtYWlsfS4gUmVhc29uOiAke3Jlc31gKTtcbiAgICB9XG59LCB0cnVlKTtcblxub24oJ1FCQ29yZTpTZXJ2ZXI6T25QbGF5ZXJVbmxvYWQnLCBhc3luYyAoc3JjOiBudW1iZXIpID0+IHtcbiAgICBpZighc3JjKSByZXR1cm47XG4gICAgY29uc3QgY2l0aXplbklkID0gYXdhaXQgVXRpbHMuR2V0UGxheWVyQ2l0aXplbklkQnlTb3VyY2Uoc3JjKTtcbiAgICBpZiAoIWNpdGl6ZW5JZCkgcmV0dXJuO1xuICAgIGF3YWl0IFNldHRpbmdzLlNhdmVQbGF5ZXJTZXR0aW5ncyhjaXRpemVuSWQpO1xuICAgIFNldHRpbmdzLm9uUGxheWVyRGlzY29ubmVjdChjaXRpemVuSWQpO1xufSk7XG5cbm9uKCdwbGF5ZXJEcm9wcGVkJywgYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHNyYyA9IGdsb2JhbC5zb3VyY2U7XG4gICAgaWYoIXNyYykgcmV0dXJuO1xuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IGF3YWl0IFV0aWxzLkdldFBsYXllckNpdGl6ZW5JZEJ5U291cmNlKHNyYyk7XG4gICAgaWYgKCFjaXRpemVuSWQpIHJldHVybjtcbiAgICBhd2FpdCBTZXR0aW5ncy5TYXZlUGxheWVyU2V0dGluZ3MoY2l0aXplbklkKTtcbiAgICBTZXR0aW5ncy5vblBsYXllckRpc2Nvbm5lY3QoY2l0aXplbklkKTtcbn0pXG5cbm9uTmV0KCdpZ25pc19waG9uZTpzZW5kTmV3TWFpbCcsIGFzeW5jICh0YXJnZXRTb3VyY2U6IG51bWJlciwgbWFpbERhdGE6IEV4dGVybmFsTWFpbERhdGEpID0+IHtcbiAgICBjb25zdCBzcmMgPSBOdW1iZXIodGFyZ2V0U291cmNlID8/IGdsb2JhbC5zb3VyY2UpO1xuICAgIGNvbnN0IHBsYXllciA9IEZyYW1ld29yay5GdW5jdGlvbnMuR2V0UGxheWVyKHNyYyk7XG4gICAgaWYgKCFwbGF5ZXIpIHJldHVybjtcblxuICAgIGNvbnN0IGNpdGl6ZW5JZCA9IHBsYXllci5QbGF5ZXJEYXRhLmNpdGl6ZW5pZDtcbiAgICBjb25zdCBlbWFpbEFkZHJlc3MgPSBhd2FpdCBVdGlscy5HZXRFbWFpbElkQnlDaXRpemVuSWQoY2l0aXplbklkKTtcbiAgICBpZiAoIWVtYWlsQWRkcmVzcykgcmV0dXJuO1xuXG4gICAgYXdhaXQgZ2xvYmFsLmV4cG9ydHNbJ3N1bW1pdF9waG9uZSddLlNlbmRNYWlsKHtcbiAgICAgICAgZW1haWw6IG1haWxEYXRhPy5lbWFpbCB8fCAnZ292ZXJubWVudEBzdW1taXQucnAnLFxuICAgICAgICB0bzogZW1haWxBZGRyZXNzLFxuICAgICAgICBzdWJqZWN0OiBtYWlsRGF0YT8uc3ViamVjdCB8fCAnRW1haWwgaXMgbm90IHNldHVwIGNvcnJlY3RseSEnLFxuICAgICAgICBtZXNzYWdlOiBtYWlsRGF0YT8ubWVzc2FnZSB8fCAnRW1haWwgaXMgbm90IHNldHVwIGNvcnJlY3RseSEnLFxuICAgICAgICBpbWFnZXM6IG1haWxEYXRhPy5pbWFnZXMgfHwgW10sXG4gICAgICAgIHNvdXJjZTogc3JjXG4gICAgfSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7O0FBQU8sU0FBUyxNQUFNLElBQVk7QUFDOUIsU0FBTyxJQUFJLFFBQVEsU0FBTyxXQUFXLEtBQUssRUFBRSxDQUFDO0FBQ2pEO0FBRmdCO0FBUVQsSUFBTSxlQUFlLDZCQUFNO0FBQzlCLFNBQU8sdUNBQXVDLFFBQVEsU0FBUyxTQUFVLEdBQUc7QUFDeEUsUUFBSSxJQUFJLEtBQUssT0FBTyxJQUFJLEtBQUssR0FBRyxJQUFJLEtBQUssTUFBTSxJQUFJLElBQUksSUFBTTtBQUM3RCxXQUFPLEVBQUUsU0FBUyxFQUFFO0FBQUEsRUFDeEIsQ0FBQztBQUNMLEdBTDRCO0FBT3JCLElBQU0sU0FBUyx3QkFBQyxZQUFvQjtBQUN2QyxTQUFPLFFBQVEsSUFBSSx3REFBd0QsT0FBTyxTQUFTO0FBQy9GLEdBRnNCO0FBS2YsSUFBTSxxQkFBb0M7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QWdDLE9BQU8sUUFBZ0I7QUFDdEQsTUFBRyxDQUFDO0FBQUs7QUFDVCxRQUFNLFlBQVksTUFBTSxNQUFNLDJCQUEyQixHQUFHO0FBQzVELE1BQUksQ0FBQztBQUFXO0FBQ2hCLFFBQU0sU0FBUyxtQkFBbUIsU0FBUztBQUMzQyxXQUFTLG1CQUFtQixTQUFTO0FBQ3pDLENBQUM7QUFFRCxHQUFHLGlCQUFpQixZQUFZO0FBQzVCLFFBQU0sTUFBTSxPQUFPO0FBQ25CLE1BQUcsQ0FBQztBQUFLO0FBQ1QsUUFBTSxZQUFZLE1BQU0sTUFBTSwyQkFBMkIsR0FBRztBQUM1RCxNQUFJLENBQUM7QUFBVztBQUNoQixRQUFNLFNBQVMsbUJBQW1CLFNBQVM7QUFDM0MsV0FBUyxtQkFBbUIsU0FBUztBQUN6QyxDQUFDO0FBRUQsTUFBTSwyQkFBMkIsT0FBTyxjQUFzQixhQUErQjtBQUN6RixRQUFNLE1BQU0sT0FBTyxnQkFBZ0IsT0FBTyxNQUFNO0FBQ2hELFFBQU0sU0FBUyxVQUFVLFVBQVUsVUFBVSxHQUFHO0FBQ2hELE1BQUksQ0FBQztBQUFRO0FBRWIsUUFBTSxZQUFZLE9BQU8sV0FBVztBQUNwQyxRQUFNLGVBQWUsTUFBTSxNQUFNLHNCQUFzQixTQUFTO0FBQ2hFLE1BQUksQ0FBQztBQUFjO0FBRW5CLFFBQU0sT0FBTyxRQUFRLGNBQWMsRUFBRSxTQUFTO0FBQUEsSUFDMUMsUUFBTyxxQ0FBVSxVQUFTO0FBQUEsSUFDMUIsSUFBSTtBQUFBLElBQ0osVUFBUyxxQ0FBVSxZQUFXO0FBQUEsSUFDOUIsVUFBUyxxQ0FBVSxZQUFXO0FBQUEsSUFDOUIsU0FBUSxxQ0FBVSxXQUFVLENBQUM7QUFBQSxJQUM3QixRQUFRO0FBQUEsRUFDWixDQUFDO0FBQ0wsQ0FBQzsiLAogICJuYW1lcyI6IFsic291cmNlIiwgIl9hIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiX2EiLCAicmVzIiwgInNvdXJjZSIsICJfYSIsICJzb3VyY2UiLCAiX2EiLCAic291cmNlIiwgIl9hIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiZGF0YSIsICJzb3VyY2UiLCAic291cmNlIiwgInJldHdlZXQiLCAic291cmNlIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiX2EiLCAiaXNSZWN1cnJpbmciLCAic291cmNlIiwgInNvdXJjZSIsICJzb3VyY2UiLCAiX2EiLCAic291cmNlIiwgInJlc29sdmVGcmFtZXdvcmsiLCAiX2EiLCAic291cmNlIl0KfQo=
