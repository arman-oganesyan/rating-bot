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
                    this._rating = this._mongo.db('rating')
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

    async changeRating(userId, value) {
        try {
            this._l.info(`addRating for user with id '${userId}' with value '${value}'`);

            const user_rating = this._rating.collection('user_rating');
            const record = await user_rating.findOne({ 'userId': userId });
            
            this._l.debug('findOne result', record);

            if (!record) {
                this._l.info(`No user was found with id '${userId}', perform insert`);
                const insertResult = await user_rating.insertOne({ 'userId': userId, 'rating': 1 });
                return value;
            } else {
                this._l.info(`User was found, update him`);
                const updateResult = await user_rating.updateOne({ 'userId': userId }, { '$inc': { rating: value } });
                return record.rating + value;
            }
        }
        catch(error) {
            this._l.error(`Error while performing addRating`)
        }
    }
}