const BaseHandler = require('./../base_handler').BaseHandler;


module.exports.ReactionHandler = class Reaction extends BaseHandler {

    constructor(app) {
        super('event.reaction', app);

        this._reactions = new Map([
            ['+', 1], ['-', -1],
            ['👍', 1], ['👎', -1]
        ]);
    }

    canHandle(message) {
        return this._isGroupMessage(message) && message.reply_to_message && (message.text || message.sticker);
    }

    async handle(message) {
        try {
            const reactionValue = this._getReaction(message.text ?? message.sticker.emoji);
            if (!reactionValue) {
                return false;
            }

            if (message.from.id === message.reply_to_message.from.id) {
                this._app._bot.sendMessage(message.chat.id, 'Нельзя голосовать за себя');
                return false;
            }


            const ttl_key = `vote_limit:${message.from.id}:${message.chat.id}:${message.reply_to_message.from.id}`;

            if (this._app._config.app.vote.timeout > 0) {
                this._l.info(`Check TTL for ${ttl_key}`);
                const ttl_value = await this._app._redis.ttl(ttl_key);
                this._l.info(`TTL for ${ttl_value} is ${ttl_value}`);

                // don't vote too often
                if (ttl_value > 0) {
                    this._app._bot.sendMessage(message.chat.id, `Нельзя так часто. Жди <b>${ttl_value}</b> сек.`, { parse_mode: 'HTML' });
                    return;
                }

                const rating = await this._app._mongo.changeRating(message.reply_to_message.from.id, reactionValue);
                this._app._bot.sendMessage(message.chat.id, `Рейтинг '${message.reply_to_message.from.first_name}' ${rating.rating}`);

                if (rating.achievment) {
                    this._app._bot.sendMessage(message.chat.id, `Поздравляем '${message.reply_to_message.from.first_name}' - он преодолел отметку в 100 очков рейтинга! А чего добился ты?!`);
                }

                if (this._app._config.app.vote.timeout > 0) {
                    this._l.info(`Update TTL for ${ttl_key}`);
                    this._app._redis.impl.set(ttl_key, 0, { EX: this._app._config.app.vote.timeout });
                }
            }

        } catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }

        return false;
    }

    // private

    _getReaction(text) {
        const trimmed = text.trim();
        for (const reaction of this._reactions) {
            if (trimmed.startsWith(reaction[0]))
                return reaction[1];
        }
    }

}