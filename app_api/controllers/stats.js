const mongoose    = require('mongoose');
const Reservation = require('../models/reservation');
const Review      = require('../models/review');
const Trip        = require('../../app_server/models/travlr');
const User        = require('../models/user');

// GET /api/admin/stats. All the numbers the admin dashboard needs.
// We return one payload so the page can build every KPI and chart
// in a single request. The math runs on the server. The browser never
// sees the raw collections.
const getDashboardStats = async (_req, res) => {
    try {
        const [
            totalTrips,
            totalCustomers,
            totalReviews,
            reservationAgg,
            bookingsByMonth,
            topTrips,
            revenueByCategory,
            recentReservations
        ] = await Promise.all([
            Trip.countDocuments({}),
            User.countDocuments({ role: 'customer' }),
            Review.countDocuments({}),

            Reservation.aggregate([
                { $group: {
                    _id: null,
                    totalRevenue:  { $sum: '$totalPrice' },
                    totalBookings: { $sum: 1 },
                    totalSeats:    { $sum: '$people' }
                }}
            ]),

            // Bookings and revenue grouped by year and month. Last six months.
            Reservation.aggregate([
                { $match: { bookedAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200) } } },
                { $group: {
                    _id: {
                        year:  { $year:  '$bookedAt' },
                        month: { $month: '$bookedAt' }
                    },
                    bookings: { $sum: 1 },
                    revenue:  { $sum: '$totalPrice' }
                }},
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),

            // Top 5 trips by booking count and revenue.
            Reservation.aggregate([
                { $group: {
                    _id: '$tripCode',
                    tripName: { $first: '$tripName' },
                    bookings: { $sum: 1 },
                    revenue:  { $sum: '$totalPrice' }
                }},
                { $sort: { bookings: -1 } },
                { $limit: 5 }
            ]),

            // Revenue by trip category. Joins each reservation to its trip.
            Reservation.aggregate([
                { $lookup: {
                    from: 'trips',
                    localField:   'tripCode',
                    foreignField: 'code',
                    as: 'trip'
                }},
                { $unwind: { path: '$trip', preserveNullAndEmptyArrays: true } },
                { $group: {
                    _id: { $ifNull: ['$trip.category', 'Uncategorized'] },
                    revenue:  { $sum: '$totalPrice' },
                    bookings: { $sum: 1 }
                }},
                { $sort: { revenue: -1 } }
            ]),

            Reservation.find({})
                .sort({ bookedAt: -1 })
                .limit(8)
                .select('tripName tripCode people totalPrice bookedAt')
                .lean()
        ]);

        const totals = reservationAgg[0] || { totalRevenue: 0, totalBookings: 0, totalSeats: 0 };
        const avgBookingValue = totals.totalBookings
            ? Math.round((totals.totalRevenue / totals.totalBookings) * 100) / 100
            : 0;

        res.status(200).json({
            kpi: {
                totalRevenue:    totals.totalRevenue,
                totalBookings:   totals.totalBookings,
                totalCustomers,
                totalTrips,
                totalReviews,
                totalSeats:      totals.totalSeats,
                avgBookingValue
            },
            bookingsByMonth: bookingsByMonth.map(r => ({
                year:     r._id.year,
                month:    r._id.month,
                bookings: r.bookings,
                revenue:  Math.round(r.revenue * 100) / 100
            })),
            topTrips: topTrips.map(t => ({
                tripCode: t._id,
                tripName: t.tripName,
                bookings: t.bookings,
                revenue:  Math.round(t.revenue * 100) / 100
            })),
            revenueByCategory: revenueByCategory.map(c => ({
                category: c._id,
                revenue:  Math.round(c.revenue * 100) / 100,
                bookings: c.bookings
            })),
            recentReservations
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getDashboardStats };
