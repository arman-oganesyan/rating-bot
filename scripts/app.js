const logger = require('./logger');
const tg = require('node-telegram-bot-api');
const events = require('events');
const { Mongo } = require('./mongo');

module.exports = class App extends events.EventEmitter {

    constructor(config) {
        super();

        this._l = logger.ctxLogger('app');
        this._l.info('create');

        this._config = config;
        this._reactions = new Map([
            ['+', 1], ['-', -1],
            ['👍', 1], ['👎', -1]
        ]);

        this._mongo = new Mongo(config.mongo);

        this._bot = new tg(this._config.app.token, this._config.tg);
        this._bot.on('message', (message) => this.onMessage(message));
        
    }

    async start() {
        this._l.info('start app');
        try {
            await this._mongo.connect();
            this._l.info('Mongo connected');

            await this._bot.startPolling();
            this._l.info('Polling started');
        } catch (err) {
            this._l.info('Error in start, error was', err);
        }
    }

    async stop() {
        this._l.info('stopping...');
        await this._bot.stopPolling();
        this._l.info('bot stopped');
        await this._mongo.disconnect();
        this._l.info('mongo disconnected');
    }

    // private methods
    _getReaction(text) {
        const trimmed = text.trim();
        for (const reaction of this._reactions) {
            if (trimmed.startsWith(reaction[0]))
                return reaction[1];
        }
    }

    // handlers
    async onMessage(message) {
        this._l.info(`Handle message (id=${message.message_id}; chat=${message.chat.id} from=${message.from.id}): reply_to_message=${Boolean(message.reply_to_message)}; text=${Boolean(message.text)}`);
        if (message.reply_to_message && message.text) {
            const value = this._getReaction(message.text);

            if (!value)
                return;

            if (message.from.id === message.reply_to_message.from.id) {
                this._bot.sendMessage(message.chat.id, 'Нельзя голосовать за себя');
                return;
            }

            const rating = await this._mongo.changeRating(message.reply_to_message.from.id, value);

            this._bot.sendMessage(message.chat.id, `Рейтинг '${message.reply_to_message.from.first_name}' ${rating} `);
        }
    }
}