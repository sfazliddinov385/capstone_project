const express = require('express');
const rateLimit = require('express-rate-limit');
const router  = express.Router();

const tripsController        = require('../controllers/trips');
const authController         = require('../controllers/authentication');
const reservationsController = require('../controllers/reservations');
const reviewsController      = require('../controllers/reviews');
const favoritesController    = require('../controllers/favorites');
const statsController        = require('../controllers/stats');
const adminController        = require('../controllers/admin');
const paymentsController     = require('../controllers/payments');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

// Slow down login and signup so attackers cannot try thousands of passwords or sign up bots.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts, please try again later.' }
});

// Slow down signed-in writes like bookings, reviews, and favorites.
// The cap is high enough that a real person clicking around will not hit it.
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please slow down.' }
});

// Quick health check. No sign in. Used by uptime checks and load balancers.
router.get('/health', (_req, res) => {
    res.status(200).json({
        status:    'ok',
        service:   'travlr-api',
        uptime:    Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// Sign up and sign in. Public. Rate limited.
router.post('/register', authLimiter, authController.register);
router.post('/login',    authLimiter, authController.login);

// Customer list. Sign in as admin required.
router.get('/customers', authenticate, authorizeAdmin, authController.getCustomers);

// Trips. Reads are public. Writes need admin.
router.get('/trips',                       tripsController.tripsList);
router.get('/trips/:tripCode',             tripsController.tripsFindByCode);
router.get('/trips/:tripCode/similar',     tripsController.tripsSimilar);
router.post('/trips',                      authenticate, authorizeAdmin, tripsController.tripsAddTrip);
router.put('/trips/:tripCode',             authenticate, authorizeAdmin, tripsController.tripsUpdateTrip);
router.delete('/trips/:tripCode',          authenticate, authorizeAdmin, tripsController.tripsDeleteTrip);

// Reservations. Sign in required. Writes are rate limited.
router.get('/reservations',        authenticate, reservationsController.getReservations);
router.post('/reservations',       authenticate, writeLimiter, reservationsController.createReservation);
router.put('/reservations/:id',    authenticate, writeLimiter, reservationsController.updateReservation);
router.delete('/reservations/:id', authenticate, writeLimiter, reservationsController.deleteReservation);

// Payments. Issues a single email receipt summarising a checkout.
// The full card number never leaves the browser. We only accept the brand
// label and last four digits over the wire.
router.post('/payments/receipt',   authenticate, writeLimiter, paymentsController.sendReceipt);

// Reviews. Reading is public. Creating and deleting need sign in and are rate limited.
router.get('/trips/:tripCode/reviews',  reviewsController.listForTrip);
router.post('/trips/:tripCode/reviews', authenticate, writeLimiter, reviewsController.create);
router.get('/reviews/mine',             authenticate, reviewsController.listMine);
router.delete('/reviews/:id',           authenticate, writeLimiter, reviewsController.remove);

// Favorites. All require sign in. Writes are rate limited.
router.get('/favorites',                authenticate, favoritesController.listMine);
router.get('/favorites/codes',          authenticate, favoritesController.listCodes);
router.post('/favorites/:tripCode',     authenticate, writeLimiter, favoritesController.add);
router.delete('/favorites/:tripCode',   authenticate, writeLimiter, favoritesController.remove);

// Admin dashboard numbers. Admin only.
router.get('/admin/stats', authenticate, authorizeAdmin, statsController.getDashboardStats);

// Admin moderation. See and cancel any reservation. See, reply to, and delete any review.
router.get('/admin/reservations',        authenticate, authorizeAdmin, adminController.listAllReservations);
router.delete('/admin/reservations/:id', authenticate, authorizeAdmin, writeLimiter, adminController.adminCancelReservation);
router.get('/admin/reviews',             authenticate, authorizeAdmin, adminController.listAllReviews);
router.post('/admin/reviews/:id/reply',  authenticate, authorizeAdmin, writeLimiter, adminController.adminReplyToReview);
router.delete('/admin/reviews/:id',      authenticate, authorizeAdmin, writeLimiter, adminController.adminDeleteReview);

module.exports = router;
