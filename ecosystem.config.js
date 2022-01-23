module.exports = {
  apps : [{
    name: 'rating-bot',
    script: './src/index.js',
    restart_delay: 3000,
    kill_timeout: 10000,
    instance_var: 'INSTANCE_ID',
    env: {
      "NODE_ENV": "debug"
    }
  }]
};
