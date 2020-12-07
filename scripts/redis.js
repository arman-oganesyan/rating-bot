const redis = require('redis');
const logger = require('./logger');

module.exports.RedisClient = class {

    constructor(config) {
        this._config = config;
        this._connected = false;
        this._l = logger.ctxLogger('redis.main');
        this._l.debug('create');
    }

    connect() {
        if (!this._connected) {
            this._l.info('call createClient for redis');
            this._client = redis.createClient(this._config);
            console.log('creaeaer', this._client);
            console.log('conf', this._config)
            this._client.on('connect', () => this._onConnected);
            this._client.on('end', () => this._onEnd);
            this._client.on('error', (err) => this._onError(err));
        }
    }

    disconnect() {
        return new Promise((resolve, reject) => {
            if (this._connected && this._client) {
                this._client.quit(() => resolve());
            }
            else resolve();
        });
    }

    get impl() {
        if (this._connected)
            return this._client;
        return undefined;
    }

    ttl(key) {
        return new Promise((resolve, reject) => {
            try {
                console.log('get', key)
                this.impl.ttl(key, (number) => {
                    resolve(number);
                });
            }
            catch(err) {
                reject(err);
            }
        });
    }

    _onConnected() {
        this._l.log('connected');
        console.log('READY!!!');
        this._connected = true;
    }

    _onEnd() {
        this._l.log('end');
        this._connected = false;
    }

    _onError(err) {
        this._l.error(err);
    }

}