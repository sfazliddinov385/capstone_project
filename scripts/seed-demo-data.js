// Fill the database with demo data so the admin dashboard has real numbers
// to show. Adds about 50 customers, about 100 reservations across the last
// six months, and about 25 reviews.
//
// Run from the project root:
//   node scripts/seed-demo-data.js
//
// All seeded customers use the password "password123".
// You can run this again. It will skip any email that already exists.

require('dotenv').config();
const mongoose    = require('mongoose');
const User        = require('../app_api/models/user');
const Reservation = require('../app_api/models/reservation');
const Review      = require('../app_api/models/review');
const Trip        = require('../app_server/models/travlr');

const FIRST_NAMES = [
  'Alex','Sam','Jordan','Taylor','Casey','Morgan','Riley','Drew','Avery','Quinn',
  'Sarah','Michael','Jennifer','David','Lisa','James','Emily','Robert','Ashley','John',
  'Emma','Noah','Olivia','Liam','Sophia','Mason','Isabella','Ethan','Mia','Lucas',
  'Charlotte','Aiden','Amelia','Jackson','Harper','Logan','Evelyn','Owen','Abigail','Caleb',
  'Madison','Wyatt','Aria','Elijah','Scarlett','Carter','Grace','Henry','Chloe','Sebastian'
];

const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee',
  'Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker',
  'Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores','Green',
  'Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts','Phillips'
];

const REVIEW_TEXT = [
  'Amazing experience! The guides were excellent and the views were unforgettable.',
  'Great trip overall. Hotel was clean and the food was excellent. Would recommend.',
  'Perfect destination for couples. Loved every minute of our stay.',
  'The organization was top-notch. Everything went smoothly from start to finish.',
  'Beautiful location, but the activities could have been a bit more varied.',
  'Lovely scenery and friendly locals. A bit expensive for the value.',
  'Absolutely loved it! Cannot wait to come back next year.',
  'Good trip, but the schedule was a little too packed for our taste.',
  'Beyond expectations. The cultural tours were the highlight of the week.',
  'Worth every penny. The all-inclusive package was a great deal.',
  'Family of four had a wonderful time. The kids are still talking about it.',
  'Honeymoon dream come true. The resort was magical.',
  'Solid value. We would book again if a similar deal came up.',
  'Loved the local food experiences. Felt like a real adventure.',
  'A bit crowded during peak hours but otherwise excellent.'
];

const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function main() {
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: seed-demo-data must not run in production.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/travlr');
    console.log('Connected to MongoDB');

    const trips = await Trip.find({}).lean();
    if (!trips.length) {
        console.error('No trips found. Run "npm run seed" first.');
        await mongoose.disconnect();
        process.exit(1);
    }
    console.log('Loaded', trips.length, 'trips from catalog');

    // Create the customer users.
    const created = [];
    const TARGET_USERS = 50;
    for (let i = 0; i < TARGET_USERS; i++) {
        const first = pick(FIRST_NAMES);
        const last  = pick(LAST_NAMES);
        const email = `${first.toLowerCase()}.${last.toLowerCase()}${i + 1}@example.com`;
        try {
            const u = new User({
                name: `${first} ${last}`,
                email,
                role: 'customer',
                hash: 'placeholder'
            });
            await u.setPassword('password123');
            await u.save();
            created.push(u);
        } catch (e) {
            // Email already exists. Skip it.
        }
    }
    console.log('Created', created.length, 'new customer users (all password: password123)');

    if (created.length === 0) {
        console.log('No new users to seed bookings for. Done.');
        await mongoose.disconnect();
        return;
    }

    // Refill seats so the demo does not run out.
    await Trip.updateMany({}, { spotsLeft: 60 });
    console.log('Reset spotsLeft to 60 on all trips');

    // Create reservations. Spread them across the last six months.
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const NOW = Date.now();
    const RESERVATIONS = 110;

    const docs = [];
    for (let i = 0; i < RESERVATIONS; i++) {
        const user   = pick(created);
        const trip   = pick(trips);
        const people = pickN(1, 4);
        const daysAgo = pickN(1, 180);
        const bookedAt = new Date(NOW - daysAgo * MS_PER_DAY);
        const perPerson = Number(trip.perPerson) || 0;
        docs.push({
            userId: user._id,
            tripId: trip._id,
            tripCode: trip.code,
            tripName: trip.name,
            length: trip.length,
            start: trip.start,
            resort: trip.resort,
            perPerson,
            people,
            totalPrice: perPerson * people,
            bookedAt
        });
    }
    const inserted = await Reservation.insertMany(docs);
    console.log('Created', inserted.length, 'reservations spread across the last 180 days');

    // Reduce spotsLeft on each trip to match the new bookings.
    const deltaByCode = {};
    for (const r of inserted) {
        deltaByCode[r.tripCode] = (deltaByCode[r.tripCode] || 0) + r.people;
    }
    for (const [code, delta] of Object.entries(deltaByCode)) {
        await Trip.updateOne({ code }, { $inc: { spotsLeft: -delta } });
    }

    // Create reviews. One per user and trip pair.
    const TARGET_REVIEWS = 25;
    const used = new Set();
    let reviewsMade = 0;
    let attempts = 0;
    while (reviewsMade < TARGET_REVIEWS && attempts < TARGET_REVIEWS * 5) {
        attempts++;
        const r = pick(inserted);
        const key = String(r.userId) + ':' + r.tripCode;
        if (used.has(key)) continue;
        used.add(key);
        const user = created.find(u => u._id.equals(r.userId));
        if (!user) continue;
        try {
            await Review.create({
                userId:   user._id,
                userName: user.name,
                tripCode: r.tripCode,
                tripName: r.tripName,
                rating:   pickN(3, 5),
                comment:  pick(REVIEW_TEXT)
            });
            reviewsMade++;
        } catch (e) {
            // The unique index will block any duplicate we missed.
        }
    }
    console.log('Created', reviewsMade, 'reviews');

    // Recompute the average rating and review count on each trip so the
    // public site stays in sync with the seeded reviews.
    for (const trip of trips) {
        const [agg] = await Review.aggregate([
            { $match: { tripCode: trip.code } },
            { $group: { _id: '$tripCode', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);
        if (agg) {
            await Trip.updateOne(
                { code: trip.code },
                { rating: Math.round(agg.avg * 10) / 10, reviewCount: agg.count }
            );
        }
    }
    console.log('Refreshed trip rating + reviewCount aggregates');

    await mongoose.disconnect();
    console.log('\nDone. Open the admin dashboard at http://localhost:4200 to see the new numbers.');
}

main().catch(e => {
    console.error('Seed failed:', e);
    process.exit(1);
});
