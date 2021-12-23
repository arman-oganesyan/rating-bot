# What is it?
Rating Bot for Telegram messenger. Add this bot to your group and it will analyze all the messages. It will update the rating of user if someone reacted to it with the one of the following symbols: `+`, `👍`, `-`, `👎`.

# How to configure?
In the config file update the following values:
```
app.token - token for Telegram Bot
mongo.url - connection url to Mongo
appenders.all.filename - path where writes log to
```

# How to use?
That's quite simple! After configuring run `index.js` via `pm2`. You can also run it without `pm2` but that's not recommended, as `pm2` has restart policy (it's configured in `ecosystem.config.js`.

# DISCLAIMER
I am not a JavaScript expert at all. This bot was developed for fun only so don't be very strict.

Feedback is encouraged.
