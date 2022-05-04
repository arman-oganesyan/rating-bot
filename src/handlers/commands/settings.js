const BaseCommand = require('./base_command').BaseCommand;

module.exports.SettingsCommand = class HelpCommand extends BaseCommand {
    constructor(app) {
        super('settings', app);

        this._states['state_timezone'] = this.stateTimezone;
        this._states['state_timezone_value'] = this.stateTimezoneValue;
        this._states['state_stat_timeout'] = this.stateStatTimeout;
    }

    canHandle(message) {
        return this._isCommand(message, 'settings');
    }

    async stateInit(message) {
        try {
            this._l.info(`stateInit for chat ${message.chat.id} from user ${message.from.id}`);
            if (!this._isGroupMessage(message)) {
                this._app._bot.sendMessage(message.chat.id, `В данный момент команда доступна только в рамках группы`);
                return;
            }

            const chatMember = await this._getChatMember(message.chat.id, message.from.id);
            if (!this._verifyCreator(message.chat.id, chatMember, true)) {
                return;
            }

            const outgoing_message = await this._app._bot.sendMessage(message.chat.id, `Выберите опцию`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Часовой пояс', callback_data: 'state_timezone' }],
                        [{ text: 'Таймаут просмотра статистики', callback_data: 'state_stat_timeout' }]
                    ]
                }
            });

            if (outgoing_message) {
                await this._markReplyToCommand(message.chat.id, outgoing_message.message_id, message.from.id);
            }
        }
        catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }
    }

    async stateTimezone(query, command_state) {
        try {
            this._l.info(`stateTimezone for chat ${query.message.chat.id} from user ${query.from.id}`);
            const chatMember = await this._getChatMember(query.message.chat.id, query.from.id);
            const groupTimezone = await this._app._mongo.getGroupSetting(query.message.chat.id, 'timezoneOffset');
            const outgoing_message = await this._app._bot.sendMessage(query.message.chat.id,
                `${this._mentionFromChatMember(chatMember)} отправь в ответ смещение относительно UTC в минутах. Текущее смещение ${groupTimezone ? groupTimezone : 0}`,
                { reply_markup: { force_reply: true, selective: true }, parse_mode: 'HTML' });

            await this._app._bot.deleteMessage(query.message.chat.id, query.message.message_id);
            await this._clearReplyToCommand(command_state);
            await this._markReplyToCommand(query.message.chat.id,
                outgoing_message.message_id, query.from.id, 'state_timezone_value');
        }
        catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }
    }

    async stateTimezoneValue(message, command_state) {
        try {
            this._l.info(`stateTimezoneValue for chat ${message.chat.id} from user ${message.from.id}; text=${message.text}`);
            await this._clearReplyToCommand(command_state);

            if (!message.text) {
                await this._app._bot.sendMessage(message.chat.id, 'Ошибка обработки команды, нужно прислать число. Вызовите команду снова');
                return;
            }

            const offset = parseInt(message.text);
            if (!Number.isInteger(offset)) {
                await this._app._bot.sendMessage(message.chat.id, 'Ошибка обработки команды, нужно прислать число. Вызовите команду снова');
                return;
            }

            await this._app._mongo.setGroupSetting(message.chat.id, { 'timezoneOffset': offset });
            await this._app._bot.sendMessage(message.chat.id, 'Значение обновлено.');
        }
        catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }
    }

    async stateStatTimeout(query, command_state) {
        try {
            this._l.info(`stateStatTimeout for chat ${query.message.chat.id} from user ${query.from.id}`);
            await this._app._bot.deleteMessage(query.message.chat.id, query.message.message_id);
            await this._clearReplyToCommand(command_state);
            await this._app._bot.sendMessage(query.message.chat.id, 'Таймаут 48 часов. Значение нельзя изменить');
        }
        catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }
    }
}