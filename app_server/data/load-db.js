/**
 * load-db.js
 * Seed script: drops and repopulates the trips collection from trips.json.
 * Usage: node app_server/data/load-db.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

const Trip = require('../models/travlr');
const trips = require('./trips.json');

const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/travlr';

mongoose
    .connect(dbURI)
    .then(async () => {
        console.log(`Connected to ${dbURI}`);

        await Trip.deleteMany({});
        console.log('Existing trips removed');

        await Trip.insertMany(trips);
        console.log(`${trips.length} trips inserted`);

        await mongoose.connection.close();
        console.log('Connection closed');
    })
    .catch(err => {
        console.error('Seed error:', err);
        process.exit(1);
    });
