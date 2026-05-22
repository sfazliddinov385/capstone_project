const Trip = require('../../app_server/models/travlr');
const { buildTripListOptions, tripPayloadFromBody } = require('../utils/tripQuery');
const { rankSimilarTrips } = require('../utils/tripScoring');

// GET /api/trips  — return all trips as JSON
const tripsList = async (req, res) => {
    try {
        const { filter, sort, limit } = buildTripListOptions(req.query);
        const trips = await Trip.find(filter).sort(sort).limit(limit).exec();
        return res.status(200).json(trips);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// GET /api/trips/:tripCode  — return one trip by code
const tripsFindByCode = async (req, res) => {
    try {
        const tripCode = String(req.params.tripCode || '').trim().toUpperCase();
        const trip = await Trip.findOne({ code: tripCode }).exec();
        if (!trip) {
            return res.status(404).json({ message: 'Trip not found' });
        }
        return res.status(200).json(trip);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// POST /api/trips  — create a new trip
const tripsAddTrip = async (req, res) => {
    try {
        const trip = await Trip.create(tripPayloadFromBody(req.body));
        return res.status(201).json(trip);
    } catch (err) {
        return res.status(400).json({ message: err.message });
    }
};

// PUT /api/trips/:tripCode  — update an existing trip
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
        return res.status(400).json({ message: err.message });
    }
};

// DELETE /api/trips/:tripCode  — delete a trip
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
        return res.status(500).json({ message: err.message });
    }
};

// GET /api/trips/:tripCode/similar — recommend up to 4 thematically similar
// trips. The scoring logic lives in utils/tripScoring.js so it can be unit-
// tested without a database, and so the algorithm can be tuned in one place.
const tripsSimilar = async (req, res) => {
    try {
        const tripCode = String(req.params.tripCode || '').trim().toUpperCase();
        const me = await Trip.findOne({ code: tripCode }).lean();
        if (!me) return res.status(404).json({ message: 'Trip not found' });

        const candidates = await Trip.find({ code: { $ne: tripCode } }).lean();
        return res.status(200).json(rankSimilarTrips(me, candidates, 4));
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { tripsList, tripsFindByCode, tripsAddTrip, tripsUpdateTrip, tripsDeleteTrip, tripsSimilar };
