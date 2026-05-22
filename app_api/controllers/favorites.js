const Favorite = require('../models/favorite');
const Trip      = require('../../app_server/models/travlr');

// GET /api/favorites — return full trip records for the logged-in user's saved list
const listMine = async (req, res) => {
    try {
        const favs = await Favorite.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
        const codes = favs.map(f => f.tripCode);
        if (!codes.length) return res.status(200).json([]);

        const trips = await Trip.find({ code: { $in: codes } }).lean();
        // Preserve favorite ordering (most-recently-saved first).
        const byCode = new Map(trips.map(t => [t.code, t]));
        const ordered = codes.map(c => byCode.get(c)).filter(Boolean);
        res.status(200).json(ordered);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/favorites/codes — just the codes (lightweight, used to paint heart icons on cards)
const listCodes = async (req, res) => {
    try {
        const favs = await Favorite.find({ userId: req.user._id }).select('tripCode').lean();
        res.status(200).json(favs.map(f => f.tripCode));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/favorites/:tripCode — add (idempotent via upsert)
const add = async (req, res) => {
    try {
        const tripCode = (req.params.tripCode || '').toUpperCase();
        const trip = await Trip.exists({ code: tripCode });
        if (!trip) return res.status(404).json({ message: 'Trip not found' });

        await Favorite.updateOne(
            { userId: req.user._id, tripCode },
            { $setOnInsert: { userId: req.user._id, tripCode } },
            { upsert: true }
        );
        res.status(201).json({ tripCode, saved: true });
    } catch (err) {
        if (err && err.code === 11000) return res.status(200).json({ tripCode: req.params.tripCode, saved: true });
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/favorites/:tripCode — remove
const remove = async (req, res) => {
    try {
        const tripCode = (req.params.tripCode || '').toUpperCase();
        await Favorite.deleteOne({ userId: req.user._id, tripCode });
        res.status(200).json({ tripCode, saved: false });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { listMine, listCodes, add, remove };
