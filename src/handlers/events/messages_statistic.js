
const BaseHandler = require('./../base_handler').BaseHandler;

module.exports.MessagesStatistic = class MessagesStatistic extends BaseHandler {

    constructor(app) {
        super('event.messages_statistic', app);
    }

    canHandle(message) {
        return message && this.__isGroupMessage(message);
    }

    async handle(message) {
        try {
            // Don't handle my own messages
            if (message.from.id == this._app._me.id) {
                this._l.debug(`Don't increment statistic for my own messages`);
                return;
            }

            this._l.debug(`Increment statistic`);
            await this._app._mongo.incrementMessageStatistic(message.chat.id, message.from.id, message.date)
        }
        catch (err) {
        }

        // Other handlers can also process this message if they can
        return false;
    }

}