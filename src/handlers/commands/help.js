const BaseHandler = require('./../base_handler').BaseHandler;

module.exports.HelpCommand = class HelpCommand extends BaseHandler {
    constructor(app) {
        super('command.help', app);
    }

    canHandle(message) {
        return this._isCommand(message, 'help');
    }

    async handle(message) {

        try {
            this._l.info(`Handle command help in chat ${message.chat.id}`);

            const help = `<b>Для чего нужен этот бот?</b>

Бот предназначен для групп. Он позволяет вам ставить лайки и дизлайки на чужие сообщения, а также ведет статистику по сообщениям в группе, а именно: кто и сколько сообщений написал. Эту статистику можно будет просмотреть за день, месяц или вообще за всё время.

<b>Как пользоваться?</b>

Просто отвечайте на чужие сообщения. Если ваше сообщение начинается с '+' или '👍' - к рейтингу пользователя будет добавлено одно очко, а если с '-' или '👎' - то рейтинг пользователя будет уменьшен на одно очко.

Вы можете проголосовать за одного и того же пользователя не чаще, чем раз в 60 секунд.

<b>Доступные команды</b>

/help - вывод этой справки
/show - показывает ваш рейтинг. Чтобы узнать рейтинг другого пользователя отправьте команду в ответ на его сообщение
        `;

            this._app._bot.sendMessage(message.chat.id, help, { parse_mode: "HTML" });
        }
        catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }

        return true;
    }
}