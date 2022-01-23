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
     * @param {*} message - Telegram message
     * @returns True if this handler can handle message, otherwise false
     */
    canHandle(message) {
        return false;
    }

    /**
     * 
     * @param {*} message - Telegram message 
     * @returns True if handling was finished and there is no need to keep on proceeding,
     *          otherwise false that means continue with other handlers as well.
     * 
     *          Call this method only if `canHandle` function for the message returns True.
     */
    async handle(message) {
        return false;
    }

    // private

    __isPrivateMessage(message) {
        return message && message.chat && message.chat.type === 'private';
    }

    __isGroupMessage(message) {
        return message && message.chat && message.chat.type === 'group' || message.chat.type === 'supergroup';
    }

    __isCommand(message, command) {
        if (message.text === `/${command}`) {
            return true;
        }

        if (message.entities) {
            const firstEntity = message.entities[0];
            if (firstEntity.offset != 0) { // the message must starts with command
                return;
            }
            
            if (firstEntity.type == 'bot_command') {
                const mention = message.text.substring(firstEntity.offset, firstEntity.offset + firstEntity.length);
                const lookup = '@' + this._app._me.username;

                if (mention.endsWith(lookup)) { // make sure user mentioned this bot
                    const user_command = mention.substring(0, mention.length - lookup.length);
                    
                    return user_command === `/${command}`;
                }
            }
        }

        return false;
    }
}