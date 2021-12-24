module.exports = {
  apps : [{
    name: 'rating-bot',
    script: './index.js',
    restart_delay: 3000,
    kill_timeout: 10000,
    env: {
      "NODE_ENV": "debug"
    }
  }]
};
