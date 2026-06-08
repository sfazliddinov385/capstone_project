// Admin-scoped controllers for moderating reservations and reviews. Each
// route is guarded by authenticate + authorizeAdmin at the router so we
// can assume req.user.role === 'admin' when these run.

const Reservation = require('../models/reservation');
const Review      = require('../models/review');
const Trip        = require('../../app_server/models/travlr');
const User        = require('../models/user');
const { refreshTripRating } = require('./reviews');

// Escape regex specials so a hostile ?q= can't blow up the engine.
const escapeRegExp = (v) => String(v || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/reservations  — every reservation across the platform,
// optionally filtered by ?q= matching trip name, trip code, or resort.
const listAllReservations = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const filter = {};
        if (q) {
            const rx = new RegExp(escapeRegExp(q), 'i');
            filter.$or = [
                { tripName: rx },
                { tripCode: rx },
                { resort:   rx }
            ];
        }

        const reservations = await Reservation
            .find(filter)
            .sort({ bookedAt: -1 })
            .limit(500)
            .lean();

        // Join customer name/email so the table is useful without N+1 calls.
        const userIds = [...new Set(reservations.map(r => String(r.userId)))];
        const users = await User.find({ _id: { $in: userIds } })
            .select('name email')
            .lean();
        const userById = new Map(users.map(u => [String(u._id), u]));

        const enriched = reservations.map(r => ({
            ...r,
            customerName:  userById.get(String(r.userId))?.name  || 'Unknown',
            customerEmail: userById.get(String(r.userId))?.email || ''
        }));

        res.status(200).json(enriched);
    } catch (err) {
        console.error('listAllReservations error:', err);
        res.status(500).json({ message: 'Unable to load reservations' });
    }
};

// DELETE /api/admin/reservations/:id  — admin override of the user-scoped
// cancel. Returns seats to inventory atomically. Logs an audit line so the
// action can be traced back to the operator.
const adminCancelReservation = async (req, res) => {
    try {
        const reservation = await Reservation.findOne({ _id: req.params.id });
        if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

        await reservation.deleteOne();
        await Trip.updateOne(
            { code: reservation.tripCode },
            { $inc: { spotsLeft: reservation.people } }
        ).exec();

        console.log('admin.cancelReservation',
            'admin=' + req.user._id,
            'reservation=' + reservation._id,
            'tripCode=' + reservation.tripCode,
            'people=' + reservation.people);

        res.status(200).json({ message: 'Reservation cancelled' });
    } catch (err) {
        console.error('adminCancelReservation error:', err);
        res.status(500).json({ message: 'Unable to cancel reservation' });
    }
};

// GET /api/admin/reviews  — every review, optionally filtered by ?q=
// matching trip name, trip code, customer name, or comment text.
const listAllReviews = async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const filter = {};
        if (q) {
            const rx = new RegExp(escapeRegExp(q), 'i');
            filter.$or = [
                { tripName: rx },
                { tripCode: rx },
                { userName: rx },
                { comment:  rx }
            ];
        }

        const reviews = await Review
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();

        res.status(200).json(reviews);
    } catch (err) {
        console.error('listAllReviews error:', err);
        res.status(500).json({ message: 'Unable to load reviews' });
    }
};

// POST /api/admin/reviews/:id/reply  — set or clear the operator response
// shown on the customer trip detail page. Body: { reply: string }. An empty
// reply clears the response so it disappears from the customer view.
const adminReplyToReview = async (req, res) => {
    try {
        const raw = typeof req.body?.reply === 'string' ? req.body.reply.trim() : '';

        if (raw.length > 1000) {
            return res.status(400).json({ message: 'Reply must be 1000 characters or fewer' });
        }

        const update = raw === ''
            ? { $set: { adminReply: '' }, $unset: { adminReplyAt: 1, adminReplyByName: 1 } }
            : { $set: {
                    adminReply:       raw,
                    adminReplyAt:     new Date(),
                    adminReplyByName: (req.user?.name || 'Travlr Team').slice(0, 80)
                } };

        const review = await Review.findByIdAndUpdate(
            req.params.id,
            update,
            { new: true, runValidators: true }
        );

        if (!review) return res.status(404).json({ message: 'Review not found' });

        console.log('admin.replyToReview',
            'admin=' + req.user._id,
            'review=' + review._id,
            'cleared=' + (raw === ''));

        res.status(200).json(review);
    } catch (err) {
        console.error('adminReplyToReview error:', err);
        res.status(500).json({ message: 'Unable to save reply' });
    }
};

// DELETE /api/admin/reviews/:id  — admin override of the user-scoped
// delete. Refreshes the trip's aggregate rating so the public card
// reflects reality.
const adminDeleteReview = async (req, res) => {
    try {
        const review = await Review.findOne({ _id: req.params.id });
        if (!review) return res.status(404).json({ message: 'Review not found' });

        const tripCode = review.tripCode;
        await review.deleteOne();
        await refreshTripRating(tripCode);

        console.log('admin.deleteReview',
            'admin=' + req.user._id,
            'review=' + review._id,
            'tripCode=' + tripCode);

        res.status(200).json({ message: 'Review deleted' });
    } catch (err) {
        console.error('adminDeleteReview error:', err);
        res.status(500).json({ message: 'Unable to delete review' });
    }
};

module.exports = {
    listAllReservations,
    adminCancelReservation,
    listAllReviews,
    adminReplyToReview,
    adminDeleteReview
};
