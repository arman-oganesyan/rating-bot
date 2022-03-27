
const BaseHandler = require('./../base_handler').BaseHandler;

module.exports.MessagesStatistic = class MessagesStatistic extends BaseHandler {

    constructor(app) {
        super('event.messages_statistic', app);
    }

    canHandle(message) {
        return message && this._isGroupMessage(message);
    }

    async handle(message) {
        try {
            // Don't handle my own messages
            if (message.from.id == this._app._me.id) {
                this._l.debug(`Don't increment statistic for my own messages`);
                return;
            }

            const message_length = (!message.forward_date && message.text) ? message.text.length : 0;

            this._l.debug(`Increment statistic with length ${message_length}`);
            await this._app._mongo.incrementMessageStatistic(message.chat.id, message.from.id, message.date, message_length)
        }
        catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }

        // Other handlers can also process this message if they can
        return false;
    }

}