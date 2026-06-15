const Trip = require('../../app_server/models/travlr');
const { buildTripListOptions, tripPayloadFromBody } = require('../utils/tripQuery');
const { rankSimilarTrips } = require('../utils/tripScoring');

// Turn a Mongoose validation error into a short message we can send back.
// We list which fields were wrong, but we do not leak stack traces or
// internal paths. Any other error gets a plain fallback message. We always
// log the full error on the server so we can still debug it.
const safeError = (err, fallback) => {
    if (err && err.name === 'ValidationError' && err.errors) {
        const fields = Object.keys(err.errors).join(', ');
        return `Invalid input: ${fields}`;
    }
    if (err && err.name === 'CastError') {
        return 'Invalid input';
    }
    return fallback;
};

// GET /api/trips. Return every trip as JSON.
const tripsList = async (req, res) => {
    try {
        const { filter, sort, limit } = buildTripListOptions(req.query);
        const trips = await Trip.find(filter).sort(sort).limit(limit).exec();
        return res.status(200).json(trips);
    } catch (err) {
        console.error('tripsList error:', err);
        return res.status(500).json({ message: 'Unable to load trips' });
    }
};

// GET /api/trips/:tripCode. Return one trip by its code.
const tripsFindByCode = async (req, res) => {
    try {
        const tripCode = String(req.params.tripCode || '').trim().toUpperCase();
        const trip = await Trip.findOne({ code: tripCode }).exec();
        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }
        return res.status(200).json(trip);
    } catch (err) {
        console.error('tripsFindByCode error:', err);
        return res.status(500).json({ message: 'Unable to load trip' });
    }
};

// POST /api/trips. Create a new trip.
const tripsAddTrip = async (req, res) => {
    try {
        const trip = await Trip.create(tripPayloadFromBody(req.body));
        return res.status(201).json(trip);
    } catch (err) {
        console.error('tripsAddTrip error:', err);
        return res.status(400).json({ message: safeError(err, 'Unable to create trip') });
    }
};

// PUT /api/trips/:tripCode. Update a trip.
const tripsUpdateTrip = async (req, res) => {
    try {
        const trip = await Trip.findOneAndUpdate(
            { code: String(req.params.tripCode || '').trim().toUpperCase() },
            tripPayloadFromBody(req.body),
            { new: true, runValidators: true }
        ).exec();

        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }
        return res.status(200).json(trip);
    } catch (err) {
        console.error('tripsUpdateTrip error:', err);
        return res.status(400).json({ message: safeError(err, 'Unable to update trip') });
    }
};

// DELETE /api/trips/:tripCode. Remove a trip.
const tripsDeleteTrip = async (req, res) => {
    try {
        const trip = await Trip.findOneAndDelete({
            code: String(req.params.tripCode || '').trim().toUpperCase()
        }).exec();
        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }
        return res.status(200).json({ message: 'Trip deleted', trip });
    } catch (err) {
        console.error('tripsDeleteTrip error:', err);
        return res.status(500).json({ message: 'Unable to delete trip' });
    }
};

// GET /api/trips/:tripCode/similar. Suggest up to four trips that feel similar.
// The scoring lives in utils/tripScoring.js. That way we can unit test it
// without a database, and tune the formula in one place.
const tripsSimilar = async (req, res) => {
    try {
        const tripCode = String(req.params.tripCode || '').trim().toUpperCase();
        const me = await Trip.findOne({ code: tripCode }).lean();
        if (!me) return res.status(404).json({ message: 'Trip not found' });

        const candidates = await Trip.find({ code: { $ne: tripCode } }).lean();
        return res.status(200).json(rankSimilarTrips(me, candidates, 4));
    } catch (err) {
        console.error('tripsSimilar error:', err);
        return res.status(500).json({ message: 'Unable to load similar trips' });
    }
};

module.exports = { tripsList, tripsFindByCode, tripsAddTrip, tripsUpdateTrip, tripsDeleteTrip, tripsSimilar };
