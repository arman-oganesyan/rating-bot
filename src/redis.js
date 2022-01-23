const redis = require('redis');
const logger = require('./logger');

module.exports.RedisClient = class {

    constructor(config) {
        this._config = config;
        this._config.socket.reconnectStrategy = retries => Math.min(retries * 250, 3000);
        this._connected = false;
        this._l = logger.ctxLogger('redis.main');
        this._l.debug('create');
    }

    async connect() {
        if (!this._connected) {
            this._l.info('call createClient for redis');
            this._client = redis.createClient(this._config);
            console.log('conf', this._config);
            this._client.on('connect', () => this._onConnected());
            this._client.on('end', () => this._onEnd());
            this._client.on('error', (err) => this._onError(err));

            await this._client.connect();
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

    async ttl(key) {
        this._l.debug(`execute ttl for ${key}`);
        return await this.impl.ttl(key);
    }

    _onConnected() {
        this._l.info('connected');
        this._connected = true;
    }

    _onEnd() {
        this._l.info('end');
        this._connected = false;
    }

    _onError(err) {
        this._l.error(err);
    }

}