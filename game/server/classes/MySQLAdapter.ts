import { generateUUid } from "@shared/utils";

const JSON_COLUMNS = new Set([
    'messages', 'photos', 'interests', 'interestedInGenders', 'lifestyle',
    'prompts', 'followers', 'following', 'likeCount', 'repliesCount',
    'retweetCount', 'hashtags', 'attachments', 'background', 'lockscreen',
    'ringtone', 'coords', 'charinfo', 'job', 'metadata', 'items', 'inventory',
    'grade', 'data', 'blockedNumbers', 'deletedMessages'
]);

export class MySQLAdapter {
    constructor() {}

    isDBConnected() {
        return true; // oxmysql is usually ready
    }

    // Helper to parse potential JSON fields
    private parseRow(row: any) {
        if (!row) return row;
        for (const key in row) {
            if (JSON_COLUMNS.has(key) && typeof row[key] === 'string') {
                try {
                    row[key] = JSON.parse(row[key]);
                } catch (e) {
                    // console.warn(`Failed to parse JSON for key ${key}:`, e);
                    // Keep original value if parse fails
                }
            }
        }
        return row;
    }

    private translateQuery(query: any): { sql: string, params: any[] } {
        if (!query || Object.keys(query).length === 0) {
            return { sql: "1=1", params: [] };
        }

        const conditions: string[] = [];
        const params: any[] = [];

        for (const key in query) {
            const value = query[key];

            if (key === '$or') {
                const orConditions: string[] = [];
                for (const subQuery of value) {
                    const { sql, params: subParams } = this.translateQuery(subQuery);
                    orConditions.push(`(${sql})`);
                    params.push(...subParams);
                }
                conditions.push(`(${orConditions.join(' OR ')})`);
                continue;
            }

            if (key === '$and') {
                const andConditions: string[] = [];
                for (const subQuery of value) {
                    const { sql, params: subParams } = this.translateQuery(subQuery);
                    andConditions.push(`(${sql})`);
                    params.push(...subParams);
                }
                conditions.push(`(${andConditions.join(' AND ')})`);
                continue;
            }

            if (typeof value === 'object' && value !== null) {
                // Handle Operators
                if (value.$ne !== undefined) {
                    conditions.push(`\`${key}\` <> ?`);
                    params.push(value.$ne);
                } else if (value.$gt !== undefined) {
                    conditions.push(`\`${key}\` > ?`);
                    params.push(value.$gt);
                } else if (value.$gte !== undefined) {
                    conditions.push(`\`${key}\` >= ?`);
                    params.push(value.$gte);
                } else if (value.$lt !== undefined) {
                    conditions.push(`\`${key}\` < ?`);
                    params.push(value.$lt);
                } else if (value.$lte !== undefined) {
                    conditions.push(`\`${key}\` <= ?`);
                    params.push(value.$lte);
                } else if (value.$in !== undefined) {
                    if (value.$in.length === 0) {
                         conditions.push(`1=0`); // In empty array is always false
                    } else {
                        const placeholders = value.$in.map(() => '?').join(',');
                        conditions.push(`\`${key}\` IN (${placeholders})`);
                        params.push(...value.$in);
                    }
                } else if (value.$nin !== undefined) {
                     if (value.$nin.length === 0) {
                         conditions.push(`1=1`); // Not in empty array is always true
                    } else {
                        const placeholders = value.$nin.map(() => '?').join(',');
                        conditions.push(`\`${key}\` NOT IN (${placeholders})`);
                        params.push(...value.$nin);
                    }
                } else if (value.$regex !== undefined) {
                    conditions.push(`\`${key}\` LIKE ?`);
                    params.push(`%${value.$regex}%`);
                } else {
                     // Assume direct equality for object if no known operator (or handled as JSON?)
                     // MongoDB does exact match on object. MySQL can't easily.
                     // But for now, let's treat it as string or ignore?
                     // If it is a date object?
                     conditions.push(`\`${key}\` = ?`);
                     params.push(value);
                }
            } else {
                conditions.push(`\`${key}\` = ?`);
                params.push(value);
            }
        }

        return { sql: conditions.join(' AND '), params };
    }

    private translateOptions(options: any): string {
        let sql = "";
        if (!options) return sql;

        if (options.sort) {
            const sortParts = [];
            for (const key in options.sort) {
                const dir = options.sort[key] === 1 ? 'ASC' : 'DESC';
                sortParts.push(`\`${key}\` ${dir}`);
            }
            if (sortParts.length > 0) {
                sql += ` ORDER BY ${sortParts.join(', ')}`;
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

    async findOne(collection: string, query: any, projection?: any, options?: any) {
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

    async findMany(collection: string, query: any, projection?: any, unknown?: any, options?: any) {
        const { sql: whereClause, params } = this.translateQuery(query);
        let sql = `SELECT * FROM \`${collection}\` WHERE ${whereClause}`;
        sql += this.translateOptions(options);

        try {
            const results = await global.exports.oxmysql.query_async(sql, params);
            if (Array.isArray(results)) {
                return results.map(row => this.parseRow(row));
            }
            return [];
        } catch (e) {
            console.error(`[MySQLAdapter] findMany error in ${collection}:`, e);
            return [];
        }
    }

    async insertOne(collection: string, doc: any) {
        if (!doc) return null;
        if (!doc._id) doc._id = generateUUid();

        const keys = Object.keys(doc);
        const values = Object.values(doc).map(v => {
            if (typeof v === 'object' && v !== null) {
                return JSON.stringify(v);
            }
            return v;
        });

        const placeholders = keys.map(() => '?').join(',');
        const columns = keys.map(k => `\`${k}\``).join(',');
        const sql = `INSERT INTO \`${collection}\` (${columns}) VALUES (${placeholders})`;

        try {
            await global.exports.oxmysql.insert_async(sql, values);
            return doc; // MongoDB insertOne returns result, but code expects the doc often or checks truthiness
        } catch (e) {
             console.error(`[MySQLAdapter] insertOne error in ${collection}:`, e);
             return null;
        }
    }

    async updateOne(collection: string, query: any, update: any, options?: any) {
        const { sql: whereClause, params: whereParams } = this.translateQuery(query);

        // Handle $set, $push, etc?
        // Code mostly uses replacement object or simple update.
        // If 'update' has top level keys that are not operators, it might be a replacement?
        // MongoDB updateOne(filter, update, options)
        // If update contains atomic operators ($set), it updates fields.
        // If it doesn't, it REPLACES the document (in some driver versions) but usually updateOne requires $set in modern mongo?
        // Checking the code: `await MongoDB.updateOne('phone_contacts', { _id: contactData._id }, { ...contactData });`
        // This looks like a replacement or merge.
        // `await MongoDB.updateOne('phone_contacts', { _id: _id }, dataX);`
        // `await MongoDB.updateOne('phone_business_users', { citizenid: player }, { jobCalls: !PlayerData.jobCalls });` -> This looks like a partial update (merge).
        // Since I'm using SQL, `UPDATE table SET ...` is partial update by default.

        // But what if they use `$set`?
        let updateData = update;
        if (update.$set) {
            updateData = { ...updateData, ...update.$set };
            delete updateData.$set;
        }

        // What if they use `$push`?
        // `tweet.likeCount.push(email); await MongoDB.updateOne(..., tweet);`
        // The code usually modifies the object in memory and then saves the whole object back!
        // Example in PigeonService: `tweet.likeCount.push(email); await MongoDB.updateOne("phone_pigeon_tweets", { _id: tweetId }, tweet);`
        // So they are sending the FULL OBJECT as `update`.
        // So I can just update all fields present in `update`.

        const setClauses: string[] = [];
        const setParams: any[] = [];

        for (const key in updateData) {
            if (key === '_id') continue; // Don't update PK usually
            setClauses.push(`\`${key}\` = ?`);
            let val = updateData[key];
            if (typeof val === 'object' && val !== null) {
                val = JSON.stringify(val);
            }
            setParams.push(val);
        }

        if (setClauses.length === 0) return true;

        const sql = `UPDATE \`${collection}\` SET ${setClauses.join(', ')} WHERE ${whereClause}`;
        const finalParams = [...setParams, ...whereParams];

        try {
            await global.exports.oxmysql.update_async(sql, finalParams);
            return { modifiedCount: 1 };
        } catch (e) {
            console.error(`[MySQLAdapter] updateOne error in ${collection}:`, e);
            return { modifiedCount: 0 };
        }
    }

    async deleteOne(collection: string, query: any) {
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

    async findAndReturnSpecificFields(collection: string, query: any, fields: string[]) {
        const { sql: whereClause, params } = this.translateQuery(query);
        const columns = fields.map(f => `\`${f}\``).join(', ');
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
    async aggregate(collection: string, pipeline: any[]) {
        if (collection === 'phone_pigeon_private_messages') {
            // This is likely the getConversations call
            // We need to fetch all messages for the user, group by conversation partner, find latest.

            // Extract userEmail from the first $match stage
            const matchStage = pipeline.find(s => s.$match);
            let userEmail = null;
            if (matchStage) {
                 // Try to find the email. It's usually in $or: [{senderEmail: X}, {recipientEmail: X}]
                 const or = matchStage.$match.$or;
                 if (or && or[0] && or[0].senderEmail) userEmail = or[0].senderEmail;
            }

            if (!userEmail) {
                console.error("[MySQLAdapter] Aggregate: Could not identify userEmail from pipeline");
                return [];
            }

            // SQL Strategy:
            // 1. Get all messages where sender or recipient is userEmail
            // 2. Sort by date DESC
            // 3. Process in JS to Group

            const sql = `SELECT * FROM \`phone_pigeon_private_messages\` WHERE \`senderEmail\` = ? OR \`recipientEmail\` = ? ORDER BY \`createdAt\` DESC`;
            try {
                const messages = await global.exports.oxmysql.query_async(sql, [userEmail, userEmail]);

                const conversations = new Map();

                for (const msg of messages) {
                    const otherEmail = msg.senderEmail === userEmail ? msg.recipientEmail : msg.senderEmail;
                    if (!conversations.has(otherEmail)) {
                        conversations.set(otherEmail, {
                            lastMessage: this.parseRow(msg),
                            unreadCount: 0,
                            otherEmail: otherEmail
                        });
                    }

                    const conv = conversations.get(otherEmail);
                    if (msg.recipientEmail === userEmail && msg.read === 0) {
                        conv.unreadCount++;
                    }
                }

                // Now we need to fetch user info for each conversation
                const result = [];
                for (const conv of conversations.values()) {
                    const user = await this.findOne('phone_pigeon_users', { email: conv.otherEmail });
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
}
