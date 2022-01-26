# What is it?
Rating Bot for Telegram messenger. Add this bot to your group and it will analyze all the messages. It will update the rating of user if someone reacted to it with the one of the following symbols: `+`, `👍`, `-`, `👎` or with a sticker with an appropriate associated emoji.

After being added to a group this bot starts to track how many messages are sent by each user. Than this statistic can be easily be received using `/stat` command. You can use `/help` command to get more information.

# What is required?
Allmost nothing. Almost. You need : Redis (docker file will be added soon), MongoDb (you can use MongoDb Atlas - it's a free cloud solution) and pm2.

# How to configure?
In the config file update the following values:
```
app.token - token for Telegram Bot
app.vote.timeout - timeout in seconds (how often user can vote for messages of the same user, to prevent abusing)
app.stat.timeout - timeout for /stat command
appenders.all.filename - path where writes log to
mongo.url - connection url to Mongo
redis.socket.host - host where redis is running
redis.socket.port - port where redis is acception new connections (6379 by default)
```

You can create your own config file, e.g. `production.json` and override all the required options there. But in this case you have to set `NODE_ENV` variable. You can do it via `ecosystem.config.js` if you are using `pm2`.

# How to use?
That's quite simple! After configuring run `index.js` via `pm2` by executing the following command in the root folder:
```
pm2 start
```
You can also run it without `pm2` but that's not recommended, as `pm2` has restart policy (it's configured in `ecosystem.config.js`).

# DISCLAIMER
I am not a JavaScript expert at all. This bot was developed for fun only so don't be very strict.

Feedback is encouraged.
