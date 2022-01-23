const log4js = require('log4js');

/**
 * @param {log4js.Configuration} config 
 */
module.exports.configure = function(config) {
    log4js.configure(config);
}

/**
 * @param {string} context 
 * @returns {log4js.Logger}
 */
module.exports.ctxLogger = function(context) {
    return log4js.getLogger(context);
}