const logger = require('./logger');
const tg = require('node-telegram-bot-api');
const events = require('events');
const { Mongo } = require('./mongo');
const { networkInterfaces } = require('os');
const { RedisClient } = require('./redis');
const escapeHtml = require('escape-html');

const MessagesStatistic = require('./handlers/events/messages_statistic').MessagesStatistic;
const ReactionHandler = require('./handlers/events/reaction').ReactionHandler;

const HelpCommand = require('./handlers/commands/help').HelpCommand;
const ShowCommand = require('./handlers/commands/show').ShowCommand;

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

        this._handlers = [
            new MessagesStatistic(this),
            new ReactionHandler(this),
            new HelpCommand(this),
            new ShowCommand(this)
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

    isPrivateMessage(message) {
        return message && message.chat && message.chat.type === 'private';
    }

    isGroupMessage(message) {
        return message && message.chat && message.chat.type === 'group' || message.chat.type === 'supergroup';
    }

    // handlers
    async onMessage(message) {
        this._l.info(`Handle message (id=${message.message_id}; chat=${message.chat.id}; chat.type=${message.chat.type}; from=${message.from.id}); reply_to_message=${Boolean(message.reply_to_message)}; text=${Boolean(message.text)}`);
        
        for (const handler of this._handlers) {
            if (handler.canHandle(message)) {
                if (await handler.handle(message)) {
                    break;
                }
            }
        }

        if (this.isPrivateMessage(message)) {
            await this.handlePrivateMessage(message);
        } else if (this.isGroupMessage(message)) {
            await this.handleGroupMessage(message);
        } else {
            this._l.info(`Skip message, unsupported type of chat`);
        }

    }

    async handlePrivateMessage(message) {
        this._l.info(`Handle private message (id=${message.message_id})`);

        if (!message.text) {
            this._l.info(`Message won't be proceed, it doesn't have text`);
            return;
        }
        
        
        if (message.text === '/system') {
            await this.commandSystem(message);
        }
    }

    async handleGroupMessage(message) {


        if (message.entities) {
            const firstEntity = message.entities[0];
            if (firstEntity.offset != 0) { // the message must starts with command
                return;
            }

            if (firstEntity.type == 'bot_command') {
                const mention = message.text.substring(firstEntity.offset, firstEntity.offset + firstEntity.length);
                const lookup = '@' + this._me.username;

                if (mention.endsWith(lookup)) { // be sure that the command is for this bot

                    const command = mention.substring(0, mention.length - lookup.length);
                    
                    if (command === '/stat') {
                        return await this.commandStatAll(message);
                    }
                    else if (mention.startsWith('/system')) {
                        return await this.commandSystem(message);
                    }
                }
            }
        }
    }

    async commandSystem(message) {
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
    }

    async commandStatAll(message) {
        this._l.info(`commandStatAll for chat ${message.chat.id} from user ${message.from.id}`);
        const ttl_key = `command_ttl:stat:${message.chat.id}`;
        
        this._l.info(`Check ttl for command`);
        const ttl_value = await this._redis.impl.ttl(ttl_key);

        if (ttl_value > 0) {
            this._l.info(`TTL for command is ${ttl_value} seconds`);
            await this._bot.sendMessage(message.chat.id, `Следующее использование возможно через ${this.formatSeconds(ttl_value)}`, {reply_to_message_id: message.message_id});
            return;
        }

        let stat = await this._mongo.getChatStat(message.chat.id);
        stat = new Map([...stat.entries()].sort((a, b) => b[1] - a[1]));

        let response = '<b>Статистика за всё время</b>\n';

        const index_emoji = (index) => {
            if (index === 1) return '🥇';
            if (index === 2) return '🥈';
            if (index === 3) return '🥉';
            return '';
        };

        let total = 0;
        let index = 1;
        for (const [key, value] of stat) {
            this._l.info(`Get chat member chat=${message.chat.id} member=${key}`);
            const chatMember = await this._bot.getChatMember(message.chat.id, key);
            this._l.debug(`Member received ${JSON.stringify(chatMember)}`);

            let mention_user = chatMember.user.username;
            if (!mention_user) {
                let display_name = '';
                if (chatMember.user.last_name) {
                    display_name += chatMember.user.last_name + ' ';
                }
                display_name += chatMember.user.first_name;
                mention_user = `<a href="tg://user?id=${key}">${escapeHtml(display_name)}</a>`;
            } else {
                mention_user = '@' + mention_user;
            }

            
            response += `\n${index}. ${mention_user}: <i>${value}</i> ${index_emoji(index++)}`
            total += value;
        };

        response += `\n\nВсего сообщений: ${total}`;

        this._l.info(`Send message with statistic`);
        const outgoing_message = await this._bot.sendMessage(message.chat.id, response, { parse_mode: 'HTML' });

        if (outgoing_message && outgoing_message.message_id) {

            const old_message_id = await this._mongo.getPinnedStat(message.chat.id);
            this._l.info(`Old pinned stat message is ${old_message_id}`);
            if (old_message_id) {
                this._l.info(`Unpin old message`);
                // This bot API doesn't support message ID now.
                this._bot.unpinChatMessage(message.chat.id, { message_id: old_message_id })
                    .then(() => { this._l.info(`Message was unpinned`) })
                    .catch(() => { this._l.error(`Failed to unpin message`) });
            }

            this._l.debug(`Pin message stat ${outgoing_message.message_id}`);

            this._bot.pinChatMessage(message.chat.id, outgoing_message.message_id, { disable_notification: true })
                .then(() => { this._l.info(`Message was pinned`) })
                .catch(() => { this._l.error(`Failed to pin message`) });

            this._mongo.setPinnedStat(message.chat.id, outgoing_message.message_id)
                .then(() => { this._l.info(`pinnedStat was set`) })
                .catch(() => { this._l.error(`Failed to set pinnedStat`) });
        }

        if (this._config.app.stat.timeout > 0) {
            this._l.info(`Set ${this._config.app.stat.timeout} ttl for /stat command`);
            await this._redis.impl.set(ttl_key, 0, { EX: this._config.app.stat.timeout });
        }
    }

    formatSeconds(value) {
        const seconds = value % 60;
        const minutes = (Math.floor(value / 60)) % 60;
        const hours = Math.floor(value  / 3600);
    
        let format = '';
    
        if (hours > 0) {
            format += `${hours} ч. `;
        }
        if (minutes > 0) {
            format += `${minutes} мин. `;
        }
        if (seconds > 0) {
            format += `${seconds} сек.`;
        }
        return format;
    }
}