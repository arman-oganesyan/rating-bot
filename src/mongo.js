const { EventEmitter } = require('events');
const logger = require('./logger');
const mongodb = require('mongodb');


module.exports.Mongo = class Mongo extends EventEmitter {
    constructor(config, clientName = 'main') {
        super();
        this._l = logger.ctxLogger(`mongodb.${clientName}`);
        this._l.info('create');

        this._conf = config;
    }

    connect() {
        return new Promise((resolve, reject) => {
            mongodb.connect(this._conf.url, this._conf.options, (error, client) => {
                this._l.info(`Connected to mongo, check errors`);
                if (error) {
                    this._l.error('Error while connecting to mongo, error was', error);
                    reject(error);
                }
                else {
                    this._l.info('Connected without errors');
                    this._mongo = client;
                    this._rating = this._mongo.db(this._conf.collection)
                    resolve();
                }
            });
        });
    }

    async disconnect() {
        return new Promise((resolve, reject) => {
            this._mongo.close(() => { resolve(); });
        });
    }

    async getPinnedStat(chatId) {
        try {
            this._l.info(`getPinnedStat for chatId=${chatId}`);

            const group_settings = this._rating.collection('group_settings');
            const result = await group_settings.findOne({ 'chatId': chatId });

            this._l.info(`Group settings=${JSON.stringify(result)}`);

            return result ? result.pinnedStatMessageId : undefined;
        }
        catch (error) {
            this._l.error(`Error while performing getPinnedStat, error was:\n${JSON.stringify(error)}`)
            return 0;
        }
    }

    async setPinnedStat(chatId, messageId) {
        try {
            this._l.info(`setPinnedStat for chatId=${chatId} and messageId=${messageId}`);

            const group_settings = this._rating.collection('group_settings');
            const result = await group_settings.updateOne({ 'chatId': chatId }, { '$set': { pinnedStatMessageId: messageId } }, { 'upsert': true });

            this._l.info(`Updated/Inserted group configuration. Result=${JSON.stringify(result.result)}`);
        }
        catch (error) {
            this._l.error(`Error while performing setPinnedStat, error was:\n${error}}`)
        }
    }

    async getGroupSetting(chatId, field) {
        try {
            this._l.info(`setGroupSetting for chatId=${chatId} and field=${field}`);
            
            const group_settings = this._rating.collection('group_settings');
            const result = await group_settings.findOne({ 'chatId': chatId });

            this._l.info(`Group settings=${JSON.stringify(result)}`);
            
            return result ? result[field] : undefined;
        }
        catch (err) {
            this._l.error(`Error while performing getGroupSetting, error was:\n${JSON.stringify(error)}`)
        }
    }

    async setGroupSetting(chatId, object) {
        try {
            this._l.info(`setGroupSetting for chatId=${chatId} and object=${JSON.stringify(object)}`);

            const group_settings = this._rating.collection('group_settings');
            const result = await group_settings.updateOne({ 'chatId': chatId }, { '$set': object }, { 'upsert': true });

            this._l.info(`Updated/Inserted group setting. Result=${JSON.stringify(result.result)}`);
        }
        catch (error) {
            this._l.error(`Error while performing setGroupSetting, error was:\n${error}}`)
        }
    }

    async changeRating(userId, value) {
        try {
            this._l.info(`addRating for user with id '${userId}' with value '${value}'`);

            const user_rating = this._rating.collection('user_rating');
            const record = await user_rating.findOne({ 'userId': userId });

            this._l.debug('findOne result', record);

            if (!record) {
                this._l.info(`No user was found with id '${userId}', perform insert`);
                await user_rating.insertOne({ 'userId': userId, 'rating': value });
                return { rating: value };
            } else {
                this._l.info(`User was found`);

                const new_rating = record.rating + value;
                const achieved100 = !record.achieved100 && new_rating >= 100;

                if (achieved100) {
                    this._l.info(`User achieved100, update him with rating ${new_rating}`);
                    await user_rating.updateOne({ 'userId': userId }, { '$inc': { rating: value }, '$set': { achieved100: achieved100 } });
                }
                else {
                    this._l.info(`Update user with rating ${new_rating}`)
                    await user_rating.updateOne({ 'userId': userId }, { '$inc': { rating: value } });
                }
                this._l.debug(`User updated, return result`)
                return { rating: new_rating, achievment: achieved100 };
            }
        }
        catch (error) {
            this._l.error(`Error while performing addRating`)
        }
    }

    async getRaiting(userId) {
        try {
            this._l.info(`getRaiting for user with id '${userId}'`);

            const user_rating = this._rating.collection('user_rating');
            const record = await user_rating.findOne({ 'userId': userId });

            this._l.debug('findOne result', record);

            if (!record) {
                return 0;
            }

            return record.rating;
        }
        catch (error) {
            this._l.error(`Error while performing getRaiting`)
            return 0;
        }
    }

    async incrementMessageStatistic(chatId, userId, timestamp, message_length) {
        try {
            this._l.info(`incrementMessageStatistic in chat ${chatId} for user ${userId} at ${timestamp} with length ${message_length}`);

            if (!chatId || !userId)
                return;

            const lookup_key = { 'chatId': chatId, 'userId': userId, 'date': this._messageTimestampPrepare(timestamp) };
            const statCollection = this._rating.collection('group_messages_statistic');
            const userStat = await statCollection.findOne(lookup_key);

            this._l.debug(`Retrived userStat ${JSON.stringify(userStat)}`);

            if (userStat) {
                await statCollection.updateOne({_id: userStat._id}, { '$inc': { 'messagesCnt': 1, 'messagesLength': message_length } });
            }
            else {
                lookup_key.messagesCnt = 1;
                lookup_key.messagesLength = message_length;
                await statCollection.insertOne(lookup_key);
            }
        }
        catch (error) {
            this._l.error(`Error while perfoming incrementMessageStatistic. Error was: `, error);
        }
    }

    async getChatStat(chatId) {
        try {
            this._l.info(`getChatStat for chat with id '${chatId}'`);

            const statCollection = this._rating.collection('group_messages_statistic');
            const chatStat = await statCollection.find({'chatId': chatId});

            let stat = new Map();

            await chatStat.forEach((item) => {
                let prev_val = 0;
                if (stat.has(item.userId))
                    prev_val = stat.get(item.userId);
                
                stat.set(item.userId, item.messagesCnt + prev_val);
            })

            return stat;
        }
        catch (error) {
            this._l.error(`Error while perfoming getChatStat. Error was: `, error);
        }
    }

    _messageTimestampPrepare(timestamp) {
        let date = new Date(timestamp * 1000);
        date.setUTCHours(0, 0, 0, 0);
        return date.getTime() / 1000;
    }
}