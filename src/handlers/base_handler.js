const events = require('events');

const logger = require('./../logger');

module.exports.BaseHandler = class BaseHandler extends events.EventEmitter {
    constructor(name, app) {
        super();

        this._l = logger.ctxLogger(`handler.${name}`);
        this._l.info(`create`);

        this._name = name;
        this._app = app;
    }
    /**
     * 
     * @param {*} message Telegram message
     * @returns True if this handler can handle message, otherwise false
     */
    canHandle(message) {
        return false;
    }

    /**
     * 
     * @param {*} message Telegram message 
     * @returns True if handling was finished and there is no need to keep on proceeding,
     *          otherwise false that means continue with other handlers as well.
     * 
     *          Call this method only if `canHandle` function for the message returns True.
     */
    async handle(message) {
        return false;
    }

    /**
     * 
     * @param {*} message Telegram message
     * @returns Return true if message in chat with bot, otherwise false
     */
    _isPrivateMessage(message) {
        return message && message.chat && message.chat.type === 'private';
    }

    /**
     * 
     * @param {*} message Telegram message
     * @returns Return true if message in a group chat, otherwise false
     */
    _isGroupMessage(message) {
        return message && message.chat && message.chat.type === 'group' || message.chat.type === 'supergroup';
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