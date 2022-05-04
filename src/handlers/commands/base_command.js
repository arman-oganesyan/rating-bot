const BaseHandler = require('./../base_handler').BaseHandler;

module.exports.BaseCommand = class BaseCommand extends BaseHandler {
    constructor(command_name, app) {
        super(`command.${command_name}`, app);
        this._states = {};
        this._states['state_init'] = this.stateInit;
    }

    _replyKey(chat_id, message_id, user_id) {
        return `${this._name}:${chat_id}:wait:${message_id}:${user_id}`;
    }

    async _markReplyToCommand(chat_id, message_id, user_id, state) {
        const reply = {
            'chat_id': chat_id,
            'message_id': message_id,
            'user_id': user_id,
            'state': state
        };

        return await this._app._redis.impl.set(this._replyKey(chat_id, message_id, user_id),
            JSON.stringify(reply), { EX: this._app._config.app.command_reply_timeout });
    }

    async _clearReplyToCommand(command_state) {
        return await this._app._redis.impl.del(this._replyKey(command_state.chat_id,
            command_state.message_id, command_state.user_id));
    }

    async isReplyToCommand(chat_id, message_id, user_id) {
        return await this._app._redis.impl.get(this._replyKey(chat_id, message_id, user_id));
    }

    async handle(message) {
        try {
            return await this.stateInit(message);
        }
        catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }

        return false;
    }

    async stateInit(message) {
        return false;
    }

    async loadCommand(message, command_state) {
        try {
            if (command_state.state in this._states) {
                return this._states[command_state.state].call(this, message, command_state);
            }
        }
        catch (err) {
            this._l.error('Failed to loadCommand! Error was: ', err);
        }

        return false;
    }

    /**
     * 
     * @param {*} message Telegram message
     * @param {*} command Name of command
     * @returns Returns true if a message is a command (either private or group), otherwise false
     */
    _isCommand(message, command) {
        return this._isPrivateCommand(message, command) || this._isGroupCommand(message, command);
    }

    /**
     * 
     * @param {*} message Telegram message
     * @param {*} command Name of command
     * @returns Returns true if a message is a command in chat with bot, otherwise false
     */
    _isPrivateCommand(message, command) {
        if (!this._isPrivateMessage(message) || !message.text) {
            return false;
        }

        return message.text.startsWith(`/${command}`);
    }

    /**
     * 
     * @param {*} message Telegram message
     * @param {*} command Name of command
     * @returns Returns true if a message is a command in a group chat (command+bot mention), otherwise false
     */
    _isGroupCommand(message, command) {
        if (!this._isGroupMessage(message) || !message.text || !message.entities) {
            return false;
        }

        const firstEntity = message.entities[0];
        if (firstEntity.offset != 0) { // the message must starts with command
            return false;
        }

        if (firstEntity.type == 'bot_command') {
            const mention = message.text.substring(firstEntity.offset, firstEntity.offset + firstEntity.length);
            const lookup = '@' + this._app._me.username;

            if (mention.endsWith(lookup)) { // make sure user mentioned this bot
                const user_command = mention.substring(0, mention.length - lookup.length);

                return user_command === `/${command}`;
            }
        }

        return false;
    }
}