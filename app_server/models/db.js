const mongoose = require('mongoose');
require('dotenv').config();

const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/travlr';

const connect = () => {
    mongoose
        .connect(dbURI)
        .catch(err => {
            console.error('FATAL: Mongoose connection error:', err.message);
            // Exit so a process manager (pm2, systemd, k8s) starts a fresh one.
            // We do not want a broken server returning 500s on every request.
            process.exit(1);
        });
};

mongoose.connection.on('connected', () => {
    console.log(`Mongoose connected to ${dbURI}`);
});

mongoose.connection.on('error', err => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected');
});

process.on('SIGINT', () => {
    mongoose.connection.close(() => {
        console.log('Mongoose connection closed through app termination');
        process.exit(0);
    });
});

module.exports = { connect };
