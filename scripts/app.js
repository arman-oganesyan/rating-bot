const logger = require('./logger');
const tg = require('node-telegram-bot-api');
const events = require('events');
const { time } = require('console');

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

        this._bot = new tg(this._config.app.token, { polling: true });
        this._bot.on('message', (message) => this.onMessage(message));
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
    onMessage(message) {
        this._l.info('Handle message')
        if (message.reply_to_message && message.text) {
            const value = this._getReaction(message.text);

            if (!value)
                return;

            if (message.from.id === message.reply_to_message.from.id) {
                this._bot.sendMessage(message.chat.id, 'Нельзя голосовать за себя');
                return;
            }

            this._bot.sendMessage(message.chat.id, `${message.from.first_name} добавляет немного рейтинга (${value}) участнику ${message.reply_to_message.from.first_name}`);
        }
    }
}