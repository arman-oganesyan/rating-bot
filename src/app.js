const logger = require('./logger');
const tg = require('node-telegram-bot-api');
const events = require('events');
const { Mongo } = require('./mongo');
const { RedisClient } = require('./redis');

const MessagesStatistic = require('./handlers/events/messages_statistic').MessagesStatistic;
const ReactionHandler = require('./handlers/events/reaction').ReactionHandler;

const HelpCommand = require('./handlers/commands/help').HelpCommand;
const ShowCommand = require('./handlers/commands/show').ShowCommand;
const StatCommand = require('./handlers/commands/stat').StatCommand;
const SystemCommand = require('./handlers/commands/system').SystemCommand;

module.exports = class App extends events.EventEmitter {

    constructor(config) {
        super();

        this._l = logger.ctxLogger('app');
        this._l.info('create with config', config);

        this._config = config;

        this._mongo = new Mongo(config.mongo);

        this._redis = new RedisClient(config.redis);

        this._bot = new tg(this._config.app.token, this._config.tg);
        this._bot.on('message', (message) => this.onMessage(message));

        this._events = [
            new MessagesStatistic(this),
            new ReactionHandler(this)
        ];

        this._commands = [
            new HelpCommand(this),
            new ShowCommand(this),
            new StatCommand(this),
            new SystemCommand(this)
        ];
    }

    async start() {
        this._l.info('start app');
        try {
            await this._redis.connect();
            this._l.info('Redis connected');

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
        this._l.info(`Handle message (id=${message.message_id}; chat=${message.chat.id}; chat.type=${message.chat.type}; from=${message.from.id}); reply_to_message=${Boolean(message.reply_to_message)}; text=${Boolean(message.text)}`);

        // All the events should be handled
        var handled_event = false;
        for (const event of this._events) {
            if (event.canHandle(message)) {
                handled_event = true;
                await event.handle(message);
            }
        }

        // Handle appropriate command
        var handled_command = false;
        for (const handler of this._commands) {
            if (handler.canHandle(message)) {
                await handler.handle(message);
                handled_command = true;
                break;
            }
        }

        // If command wasn't handled and this is a reply
        // It's possibly a reply to a command
        if (!handled_command && message.reply_to_message) {
            for (const handler of this._commands) {
                const command_state = await handler.isReplyToCommand(
                    message.chat.id,
                    message.reply_to_message.message_id,
                    message.from.id
                );

                if (command_state) {
                    handler.loadCommand(message, JSON.parse(command_state));
                    handled_command = true;
                    break;
                }
            }
        }
    }
}