// Push every trip's start date into the future so the booking demo works.
// Trips fan out from 30 days out to roughly a year out, spaced one week
// apart, so the catalog has variety. Safe to re-run.
//
// Run from the project root:
//   node scripts/refresh-trip-dates.js

require('dotenv').config();
const mongoose = require('mongoose');
const Trip = require('../app_server/models/travlr');

async function main() {
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: refresh-trip-dates must not run in production.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/travlr');
    console.log('Connected to MongoDB');

    const trips = await Trip.find({}).sort({ code: 1 });
    if (!trips.length) {
        console.log('No trips found. Did you run `npm run seed` first?');
        await mongoose.disconnect();
        return;
    }

    const now = Date.now();
    const ONE_DAY  = 24 * 60 * 60 * 1000;
    const ONE_WEEK = 7 * ONE_DAY;

    let updated = 0;
    for (let i = 0; i < trips.length; i++) {
        const trip = trips[i];
        // Start 30 days out plus one week per trip in catalog order.
        // Wraps after a year so old trips do not crawl past it.
        const offset = 30 * ONE_DAY + ((i * ONE_WEEK) % (350 * ONE_DAY));
        const newStart = new Date(now + offset);
        if (!trip.start || new Date(trip.start).getTime() <= now) {
            trip.start = newStart;
            await trip.save();
            updated++;
        }
    }

    console.log(`Updated ${updated} of ${trips.length} trips to future start dates`);
    await mongoose.disconnect();
}

main().catch((e) => {
    console.error('refresh-trip-dates failed:', e);
    process.exit(1);
});
