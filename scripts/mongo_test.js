const mongodb = require('mongodb');

module.exports.example = function () {
    return new Promise((resolve, reject) => {
        mongodb.connect('mongodb+srv://arman:test12345@first-cluster.2xgep.mongodb.net/test?retryWrites=true&w=majority', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }, (error, client) => {
            if (error) {
                console.log('Connection to MongoDB failed!', error);
                client.close();
                return reject(error);
            } else {
                console.log('Connected to MongoDB');
                const db = client.db('test');
                db.collection('data').insertMany([
                    { a: Math.round(Math.random() * 1000) }
                ], (error, result) => {
                    if (error) {
                        console.log('Error with inserting!', error);
                        client.close();
                        return reject(error);
                    } else {
                        console.log('Inserted');
                        db.collection('data').find({}).toArray((error, result) => {
                            if (error) {
                                console.log('Error while reading', error);
                                client.close();
                                return reject(error);
                            } else {
                                console.log('Results obtained');
                                result.forEach((value) => { console.log('Value of is :', value.a) });
                                client.close();
                                return resolve();
                            }
                        });
                    }
                });
            }
        });
    });
}