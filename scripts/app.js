const logger = require('./logger');
const tg = require('node-telegram-bot-api');
const events = require('events');
const { Mongo } = require('./mongo');
const { networkInterfaces } = require('os');

module.exports = class App extends events.EventEmitter {

    constructor(config) {
        super();

        this._l = logger.ctxLogger('app');
        this._l.info('create with config', config);

        this._config = config;
        this._reactions = new Map([
            ['+', 1], ['-', -1],
            ['👍', 1], ['👎', -1]
        ]);

        this._mongo = new Mongo(config.mongo);

        this._redis = new RedisClient(config.redis);

        this._bot = new tg(this._config.app.token, this._config.tg);
        this._bot.on('message', (message) => this.onMessage(message));
    }

    async start() {
        this._l.info('start app');
        try {
            await this._mongo.connect();
            this._l.info('Mongo connected');

            await this._getMe();
            this._l.info('Me is obtained', this._me);

            await this._bot.startPolling();
            this._l.info('Polling started');
        } catch (err) {
            this._l.info('Error in start, error was', err);
            process.exit(1);
        }
    }

    async stop() {
        this._l.info('stopping...');
        await this._bot.stopPolling();
        this._l.info('bot stopped');
        await this._mongo.disconnect();
        this._l.info('mongo disconnected');
        await this._redis.disconnect();
        this._l.info('redis disconnected');
    }

    // private methods
    _getReaction(text) {
        const trimmed = text.trim();
        for (const reaction of this._reactions) {
            if (trimmed.startsWith(reaction[0]))
                return reaction[1];
        }
    }

    _getMe() {
        return new Promise((resolve, reject) => {
            this._bot.getMe().then((user) => {
                this._l.info('Done getting me');
                this._me = user;
                resolve();
            }).catch(() => {
                this._l.error('Error while getMe!');
                reject();
            });
        });
    }

    // handlers
    async onMessage(message) {
        this._l.info(`Handle message (id=${message.message_id}; chat=${message.chat.id} from=${message.from.id}): reply_to_message=${Boolean(message.reply_to_message)}; text=${Boolean(message.text)}`);
        if (message.reply_to_message && message.text) {

            const reactionValue = this._getReaction(message.text);

            if (reactionValue) {
                if (message.from.id === message.reply_to_message.from.id) {
                    this._bot.sendMessage(message.chat.id, 'Нельзя голосовать за себя');
                    return;
                }

                const rating = await this._mongo.changeRating(message.reply_to_message.from.id, reactionValue);
                this._bot.sendMessage(message.chat.id, `Рейтинг '${message.reply_to_message.from.first_name}' ${rating.rating}`);

                if (rating.achievment) {
                    this._bot.sendMessage(message.chat.id, `Поздравляем '${message.reply_to_message.from.first_name}' - он преодолел отметку в 100 очков рейтинга! А чего добился ты?!`);
                }

                return;
            }
        }

        if (message.entities) {
            const firstEntity = message.entities[0];
            if (firstEntity.offset != 0) { // the message must starts with command
                return;
            }

            if (firstEntity.type == 'bot_command') {
                const mention = message.text.substring(firstEntity.offset, firstEntity.offset + firstEntity.length);

                if (mention.endsWith('@' + this._me.username)) { // be sure that the command is for this bot
                    if (mention.startsWith('/show')) {
                        const show_me = message.reply_to_message === undefined;
                        const user_id = show_me ? message.from.id : message.reply_to_message.from.id;
                        const user_name = show_me ? message.from.first_name : message.reply_to_message.from.first_name;
                        const raiting = await this._mongo.getRaiting(user_id);
                        this._bot.sendMessage(message.chat.id, `Рейтинг '${user_name}' ${raiting}`);
                        return;
                    }
                    else if (mention.startsWith('/system')) {

                        const nets = networkInterfaces();
                        const results = Object.create(null); // Or just '{}', an empty object

                        for (const name of Object.keys(nets)) {
                            for (const net of nets[name]) {
                                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                                if (net.family === 'IPv4' && !net.internal) {
                                    if (!results[name]) {
                                        results[name] = [];
                                    }
                                    results[name].push(net);
                                }
                            }
                        }

                        this._bot.sendMessage(message.chat.id, JSON.stringify(results, null, 4));
                        return;
                    }
                }
            }
        }
    }
}