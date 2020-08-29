const TelegramBot = require('node-telegram-bot-api');


String.prototype.hexEncode = function () {
    var hex, i;

    var result = "";
    for (i = 0; i < this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += ("000" + hex).slice(-4);
    }

    return result
}

const reactions = new Map([
    ['+', 1], ['-', -1],
    ['👍', 1], ['👎', -1]
]);

function getReaction(text) {
    const trimmed = text.trim();
    for (const reaction of reactions) {
        if (trimmed.startsWith(reaction[0]))
            return reaction[1];
    }
}

const bot = new TelegramBot('1312267022:AAHiwH7Ss4Ek5zIFFb66ygzyRnJwDcpeG-s', { polling: true });
bot.on('message', (message, metadata) => {

    if (message.reply_to_message && message.text) {
        const value = getReaction(message.text);

        if (!value)
            return;

        if (message.from.id === message.reply_to_message.from.id) {
            bot.sendMessage(message.chat.id, 'Нельзя самому себе добавлять рейтинг');
            return;
        }

        bot.sendMessage(message.chat.id, `${message.from.first_name} добавляет немного рейтинга (${value}) 👎йцуйцуучастнику ${message.reply_to_message.from.first_name}`);
    }
});

// process.on('SIGINT', () => {
//     console.log('Start stopping...');
//     bot.stopPolling().then(() => {
//         console.log('stopped');
//     })
// });