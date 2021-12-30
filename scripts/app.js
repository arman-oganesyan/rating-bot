const logger = require('./logger');
const tg = require('node-telegram-bot-api');
const events = require('events');
const { Mongo } = require('./mongo');
const { networkInterfaces } = require('os');
const { RedisClient } = require('./redis');
const escapeHtml = require('escape-html');

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
        this._l.info(`Handle message (id=${message.message_id}; chat=${message.chat.id}; chat.type=${message.chat.type}; from=${message.from.id}); reply_to_message=${Boolean(message.reply_to_message)}; text=${Boolean(message.text)}`);
        
        if (message.chat.type === 'private') {
            await this.handlePrivateMessage(message);
        } else if (message.chat.type === 'group' || message.chat.type === 'supergroup') {
            // Increment statistic only for groups
            this._l.info(`Increment statistic`);
            await this._mongo.incrementMessageStatistic(message.chat.id, message.from.id, message.date)
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

        if (message.text === '/help') {
            await this.commandHelp(message);
        }
        else if (message.text === '/show') {
            await this.commandShow(message);
        } else if (message.text === '/system') {
            await this.commandSystem(message);
        }
    }

    async handleGroupMessage(message) {

        if (message.reply_to_message && message.text) {

            const reactionValue = this._getReaction(message.text);

            if (reactionValue) {
                if (message.from.id === message.reply_to_message.from.id) {
                    this._bot.sendMessage(message.chat.id, 'Нельзя голосовать за себя');
                    return;
                }

                const ttl_key = `vote_limit:${message.from.id}:${message.chat.id}:${message.reply_to_message.from.id}`;

                if (this._config.app.vote_timeout > 0) {
                    this._l.info(`Check TTL for ${ttl_key}`);
                    const ttl_value = await this._redis.ttl(ttl_key);
                    this._l.info(`TTL for ${ttl_value} is ${ttl_value}`);

                    // don't vote too often
                    if (ttl_value > 0) {
                        this._bot.sendMessage(message.chat.id, `Нельзя так часто. Жди <b>${ttl_value}</b> сек.`, { parse_mode: 'HTML' });
                        return;
                    }
                }

                const rating = await this._mongo.changeRating(message.reply_to_message.from.id, reactionValue);
                this._bot.sendMessage(message.chat.id, `Рейтинг '${message.reply_to_message.from.first_name}' ${rating.rating}`);

                if (rating.achievment) {
                    this._bot.sendMessage(message.chat.id, `Поздравляем '${message.reply_to_message.from.first_name}' - он преодолел отметку в 100 очков рейтинга! А чего добился ты?!`);
                }

                if (this._config.app.vote_timeout > 0) {
                    this._l.info(`Update TTL for ${ttl_key}`);
                    this._redis.impl.set(ttl_key, 0, { EX: this._config.app.vote_timeout });
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
                const lookup = '@' + this._me.username;

                if (mention.endsWith(lookup)) { // be sure that the command is for this bot

                    const command = mention.substring(0, mention.length - lookup.length);

                    if (command === '/help') {
                        return await this.commandHelp(message);
                    }
                    else if (command === '/show') {
                        return await this.commandShow(message);
                    }
                    else if (command === '/stat') {
                        return await this.commandStatAll(message);
                    }
                    else if (mention.startsWith('/system')) {
                        return await this.commandSystem(message);
                    }
                }
            }
        }
    }

    async commandHelp(message) {
        this._l.info(`Handle command help in chat ${message.chat.id}`);

        const help =`<b>Для чего нужен этот бот?</b>

Бот предназначен для групп. Он позволяет вам ставить лайки и дизлайки на чужие сообщения, а также ведет статистику по сообщениям в группе, а именно: кто и сколько сообщений написал. Эту статистику можно будет просмотреть за день, месяц или вообще за всё время.

<b>Как пользоваться?</b>

Просто отвечайте на чужие сообщения. Если ваше сообщение начинается с '+' или '👍' - к рейтингу пользователя будет добавлено одно очко, а если с '-' или '👎' - то рейтинг пользователя будет уменьшен на одно очко.

Вы можете проголосовать за одного и того же пользователя не чаще, чем раз в 60 секунд.

<b>Доступные команды</b>

/help - вывод этой справки
/show - показывает ваш рейтинг. Чтобы узнать рейтинг другого пользователя отправьте команду в ответ на его сообщение
        `;

        this._bot.sendMessage(message.chat.id, help, { parse_mode: "HTML" });

    }

    async commandShow(message) {
        this._l.info(`Handle command show in chat ${message.chat.id}`);

        const show_me = message.reply_to_message === undefined;
        const user_id = show_me ? message.from.id : message.reply_to_message.from.id;
        const user_name = show_me ? message.from.first_name : message.reply_to_message.from.first_name;
        const raiting = await this._mongo.getRaiting(user_id);
        this._bot.sendMessage(message.chat.id, `Рейтинг '${user_name}' ${raiting}`);
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
        this._bot.sendMessage(message.chat.id, response, { parse_mode: 'HTML' });
    }
}