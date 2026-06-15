// Admin endpoints for moderating reservations and reviews.
// The router guards every route with authenticate + authorizeAdmin,
// so by the time these run, req.user.role is already 'admin'.

const Reservation = require('../models/reservation');
const Review      = require('../models/review');
const Trip        = require('../../app_server/models/travlr');
const User        = require('../models/user');
const { refreshTripRating } = require('./reviews');

// Strip regex special characters so a bad ?q= cannot crash the engine.
const escapeRegExp = (v) => String(v || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/reservations. Every reservation in the system.
// You can pass ?q= to match trip name, trip code, or resort.
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

        // Pull the customer name and email in one query so the table is useful
        // without making one extra call per row.
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

// DELETE /api/admin/reservations/:id. Admin override for canceling.
// Puts the seats back in one atomic step. Logs who did it so we can trace
// it later.
//
// findOneAndDelete returns the deleted document atomically, so two admin
// tabs hitting cancel on the same reservation cannot both succeed and
// double-restore the seats. The second call returns null and we 404.
const adminCancelReservation = async (req, res) => {
    try {
        const reservation = await Reservation.findOneAndDelete({ _id: req.params.id });
        if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

        try {
            await Trip.updateOne(
                { code: reservation.tripCode },
                { $inc: { spotsLeft: reservation.people } }
            ).exec();
        } catch (restoreErr) {
            console.error(
                'CRITICAL: admin cancel seat restore failed.',
                'admin=' + (req.user && req.user._id),
                'tripCode=' + reservation.tripCode,
                'people=' + reservation.people,
                'error=' + restoreErr.message
            );
        }

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

// GET /api/admin/reviews. Every review in the system.
// You can pass ?q= to match trip name, trip code, customer name, or comment text.
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

// POST /api/admin/reviews/:id/reply. Set or clear the team response shown
// on the trip detail page. Body: { reply: string }. An empty reply removes
// the response so the customer no longer sees it.
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

// DELETE /api/admin/reviews/:id. Admin override for deleting a review.
// Recomputes the trip's average rating so the public card stays correct.
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
