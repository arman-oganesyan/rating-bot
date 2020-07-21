const mongo = require('./scripts/mongo');

mongo.example().then(
    () => { console.log('finished') },
    (err) => { console.log('rejected', err) }
);