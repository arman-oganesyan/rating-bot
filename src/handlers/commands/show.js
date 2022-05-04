const BaseCommand = require('./base_command').BaseCommand;

module.exports.ShowCommand = class ShowCommand extends BaseCommand {
    constructor(app) {
        super('show', app);
    }

    canHandle(message) {
        return this._isCommand(message, 'show');
    }

    async stateInit(message) {
        try {
            this._l.info(`Handle command show in chat ${message.chat.id}`);

            const show_me = message.reply_to_message === undefined;
            const user_id = show_me ? message.from.id : message.reply_to_message.from.id;
            const user_name = show_me ? message.from.first_name : message.reply_to_message.from.first_name;
            const raiting = await this._app._mongo.getRaiting(user_id);
            this._app._bot.sendMessage(message.chat.id, `Рейтинг '${user_name}' ${raiting}`);
        }
        catch(err) {
            this._l.error('Failed to handle! Error was: ', err);
        }

        return true;
    }
}