const Review      = require('../models/review');
const Reservation = require('../models/reservation');
const Trip        = require('../../app_server/models/travlr');
const { validateReviewInput } = require('../utils/reviewValidation');

// Recompute aggregate rating + count on the Trip document so the public
// listing/cards reflect real reviews. Called after any write on a trip's reviews.
async function refreshTripRating(tripCode) {
    const [agg] = await Review.aggregate([
        { $match: { tripCode } },
        { $group: { _id: '$tripCode', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    if (!agg) {
        // No reviews left — reset to neutral. Keep schema-valid values.
        await Trip.updateOne({ code: tripCode }, { rating: 0, reviewCount: 0 }).exec();
        return;
    }

    await Trip.updateOne(
        { code: tripCode },
        { rating: Math.round(agg.avg * 10) / 10, reviewCount: agg.count }
    ).exec();
}

// GET /api/trips/:tripCode/reviews — public
const listForTrip = async (req, res) => {
    try {
        const tripCode = (req.params.tripCode || '').toUpperCase();
        const reviews = await Review.find({ tripCode }).sort({ createdAt: -1 }).lean();
        res.status(200).json(reviews);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/reviews/mine — every review the logged-in user has written
const listMine = async (req, res) => {
    try {
        const reviews = await Review.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
        res.status(200).json(reviews);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/trips/:tripCode/reviews — auth required; user must have booked the trip
const create = async (req, res) => {
    try {
        const tripCode = (req.params.tripCode || '').toUpperCase();

        // Validation rules live in a pure helper so the SPA, HBS site, and
        // any future client share one canonical contract that we can test.
        const v = validateReviewInput(req.body);
        if (!v.ok) return res.status(v.status).json({ message: v.message });
        const { rating, comment } = v;

        const trip = await Trip.findOne({ code: tripCode }).select('code name').lean();
        if (!trip) return res.status(404).json({ message: 'Trip not found' });

        // Eligibility: must have an active reservation for this trip.
        const booked = await Reservation.exists({ userId: req.user._id, tripCode });
        if (!booked) {
            return res.status(403).json({ message: 'You can only review trips you have booked' });
        }

        const review = await Review.findOneAndUpdate(
            { userId: req.user._id, tripCode },
            {
                $set: { rating, comment, tripName: trip.name, userName: req.user.name || 'Traveler' },
                $setOnInsert: { userId: req.user._id, tripCode }
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
        ).lean();

        await refreshTripRating(tripCode);
        res.status(201).json(review);
    } catch (err) {
        if (err && err.code === 11000) {
            return res.status(409).json({ message: 'You have already reviewed this trip' });
        }
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/reviews/:id — auth required; user can only delete their own
const remove = async (req, res) => {
    try {
        const review = await Review.findOne({ _id: req.params.id, userId: req.user._id });
        if (!review) return res.status(404).json({ message: 'Review not found' });

        const tripCode = review.tripCode;
        await review.deleteOne();
        await refreshTripRating(tripCode);
        res.status(200).json({ message: 'Review deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { listForTrip, listMine, create, remove, refreshTripRating };
