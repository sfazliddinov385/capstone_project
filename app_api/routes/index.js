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
const { authenticate, authorizeAdmin } = require('../middleware/auth');

// Rate-limit credential endpoints to slow credential-stuffing and registration spam.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts, please try again later.' }
});

// Rate-limit authenticated write endpoints (bookings, reviews, favorites) to
// blunt scripted enumeration or spam. The cap is generous enough that a real
// user clicking around the UI will never hit it.
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please slow down.' }
});

// Health check — no auth, fast — for uptime monitoring and load balancers.
router.get('/health', (_req, res) => {
    res.status(200).json({
        status:    'ok',
        service:   'travlr-api',
        uptime:    Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// Auth (public, rate-limited)
router.post('/register', authLimiter, authController.register);
router.post('/login',    authLimiter, authController.login);

// Customer list — requires JWT + admin role
router.get('/customers', authenticate, authorizeAdmin, authController.getCustomers);

// Trip routes — GET is public, writes require admin
router.get('/trips',                       tripsController.tripsList);
router.get('/trips/:tripCode',             tripsController.tripsFindByCode);
router.get('/trips/:tripCode/similar',     tripsController.tripsSimilar);
router.post('/trips',                      authenticate, authorizeAdmin, tripsController.tripsAddTrip);
router.put('/trips/:tripCode',             authenticate, authorizeAdmin, tripsController.tripsUpdateTrip);
router.delete('/trips/:tripCode',          authenticate, authorizeAdmin, tripsController.tripsDeleteTrip);

// Reservations — require JWT; writes are rate-limited
router.get('/reservations',        authenticate, reservationsController.getReservations);
router.post('/reservations',       authenticate, writeLimiter, reservationsController.createReservation);
router.put('/reservations/:id',    authenticate, writeLimiter, reservationsController.updateReservation);
router.delete('/reservations/:id', authenticate, writeLimiter, reservationsController.deleteReservation);

// Reviews — listing is public; create/delete require JWT and are rate-limited
router.get('/trips/:tripCode/reviews',  reviewsController.listForTrip);
router.post('/trips/:tripCode/reviews', authenticate, writeLimiter, reviewsController.create);
router.get('/reviews/mine',             authenticate, reviewsController.listMine);
router.delete('/reviews/:id',           authenticate, writeLimiter, reviewsController.remove);

// Favorites — all require JWT; writes are rate-limited
router.get('/favorites',                authenticate, favoritesController.listMine);
router.get('/favorites/codes',          authenticate, favoritesController.listCodes);
router.post('/favorites/:tripCode',     authenticate, writeLimiter, favoritesController.add);
router.delete('/favorites/:tripCode',   authenticate, writeLimiter, favoritesController.remove);

// Admin dashboard stats — admin only
router.get('/admin/stats', authenticate, authorizeAdmin, statsController.getDashboardStats);

// Admin moderation: see and cancel every reservation, see and delete every review.
router.get('/admin/reservations',        authenticate, authorizeAdmin, adminController.listAllReservations);
router.delete('/admin/reservations/:id', authenticate, authorizeAdmin, writeLimiter, adminController.adminCancelReservation);
router.get('/admin/reviews',             authenticate, authorizeAdmin, adminController.listAllReviews);
router.post('/admin/reviews/:id/reply',  authenticate, authorizeAdmin, writeLimiter, adminController.adminReplyToReview);
router.delete('/admin/reviews/:id',      authenticate, authorizeAdmin, writeLimiter, adminController.adminDeleteReview);

module.exports = router;
