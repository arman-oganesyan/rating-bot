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

}