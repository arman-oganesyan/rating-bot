const BaseHandler = require('./../base_handler').BaseHandler;

const escapeHtml = require('escape-html');

module.exports.StatCommand = class StatCommand extends BaseHandler {
    constructor(app) {
        super('command.stat', app);
    }

    canHandle(message) {
        return this._isGroupCommand(message, 'stat');
    }

    async handle(message) {
        try {
            this._l.info(`commandStatAll for chat ${message.chat.id} from user ${message.from.id}`);
            const ttl_key = `command_ttl:stat:${message.chat.id}`;

            this._l.info(`Check ttl for command`);
            const ttl_value = await this._app._redis.impl.ttl(ttl_key);

            if (ttl_value > 0) {
                this._l.info(`TTL for command is ${ttl_value} seconds`);
                await this._app._bot.sendMessage(message.chat.id, `Следующее использование возможно через ${this._formatSeconds(ttl_value)}`, { reply_to_message_id: message.message_id });
                return true;
            }

            let stat = await this._app._mongo.getChatStat(message.chat.id);
            stat = new Map([...stat.entries()].sort((a, b) => b[1] - a[1]));

            let response = '<b>Статистика за всё время</b>\n';
            let total = 0;
            let index = 1;

            for (const [key, value] of stat) {
                this._l.info(`Get chat member chat=${message.chat.id} member=${key}`);
                const chatMember = await this._app._bot.getChatMember(message.chat.id, key);
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


                response += `\n${index}. ${mention_user}: <i>${value}</i> ${this._indexEmoji(index++)}`
                total += value;
            }

            response += `\n\nВсего сообщений: ${total}`;

            this._l.info(`Send message with statistic`);
            const outgoing_message = await this._app._bot.sendMessage(message.chat.id, response, { parse_mode: 'HTML' });

            if (outgoing_message && outgoing_message.message_id) {

                const old_message_id = await this._app._mongo.getPinnedStat(message.chat.id);
                this._l.info(`Old pinned stat message is ${old_message_id}`);
                if (old_message_id) {
                    this._l.info(`Unpin old message`);
                    // This bot API doesn't support message ID now.
                    this._app._bot.unpinChatMessage(message.chat.id, { message_id: old_message_id })
                        .then(() => { this._l.info(`Message was unpinned`) })
                        .catch(() => { this._l.error(`Failed to unpin message`) });
                }

                this._l.debug(`Pin message stat ${outgoing_message.message_id}`);

                this._app._bot.pinChatMessage(message.chat.id, outgoing_message.message_id, { disable_notification: true })
                    .then(() => { this._l.info(`Message was pinned`) })
                    .catch(() => { this._l.error(`Failed to pin message`) });

                this._app._mongo.setPinnedStat(message.chat.id, outgoing_message.message_id)
                    .then(() => { this._l.info(`pinnedStat was set`) })
                    .catch(() => { this._l.error(`Failed to set pinnedStat`) });
            }


            if (this._app._config.app.stat.timeout > 0) {
                this._l.info(`Set ${this._app._config.app.stat.timeout} ttl for /stat command`);
                await this._app._redis.impl.set(ttl_key, 0, { EX: this._app._config.app.stat.timeout });
            }
        }
        catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }

        return true;
    }

    // private
    _indexEmoji(index) {
        if (index === 1) return '🥇';
        if (index === 2) return '🥈';
        if (index === 3) return '🥉';
        return '';
    }

    _formatSeconds(value) {
        const seconds = value % 60;
        const minutes = (Math.floor(value / 60)) % 60;
        const hours = Math.floor(value / 3600);

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