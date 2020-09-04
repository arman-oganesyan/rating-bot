const conf = require('config');
const logger = require('./scripts/logger');

logger.configure(conf.logger)
logger.ctxLogger('main').info('start')

const app = new (require('./scripts/app'))(conf);
console.log('test', app._getReaction('asd'));