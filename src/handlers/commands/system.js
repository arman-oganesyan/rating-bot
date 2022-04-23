const BaseCommand = require('./base_command').BaseCommand;
const { networkInterfaces } = require('os');

module.exports.SystemCommand = class SystemCommand extends BaseCommand {
    constructor(app) {
        super('system', app);
    }

    canHandle(message) {
        return this._isPrivateCommand(message, 'system');
    }

    async handle(message) {
        try {
            const nets = networkInterfaces();
            const results = Object.create(null); // Or just '{}', an empty object

            for (const name of Object.keys(nets)) {
                for (const net of nets[name]) {
                    // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                    if (net.family === 'IPv4' && !net.internal) {
                        if (!results[name]) {
                            results[name] = [];
                        }
                        results[name].push(net);
                    }
                }
            }

            this._app._bot.sendMessage(message.chat.id, JSON.stringify(results, null, 4));
        }
        catch (err) {
            this._l.error('Failed to handle! Error was: ', err);
        }

        return true;
    }
}