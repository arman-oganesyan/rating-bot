process.env["NTBA_FIX_319"] = 1;
const conf = require('config');
const logger = require('./logger');

logger.configure(conf.logger)
logger.ctxLogger('main').info('start')

const app = new (require('./app'))(conf);
app.start();

process.on('SIGINT', () => {
    app.stop();
});