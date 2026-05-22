const express = require('express');
const rateLimit = require('express-rate-limit');
const router  = express.Router();

const tripsController        = require('../controllers/trips');
const authController         = require('../controllers/authentication');
const reservationsController = require('../controllers/reservations');
const reviewsController      = require('../controllers/reviews');
const favoritesController    = require('../controllers/favorites');
const statsController        = require('../controllers/stats');
const { authenticate, authorizeAdmin } = require('../middleware/auth');

// Rate-limit credential endpoints to slow credential-stuffing and registration spam.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts, please try again later.' }
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

// Reservations — require JWT
router.get('/reservations',        authenticate, reservationsController.getReservations);
router.post('/reservations',       authenticate, reservationsController.createReservation);
router.put('/reservations/:id',    authenticate, reservationsController.updateReservation);
router.delete('/reservations/:id', authenticate, reservationsController.deleteReservation);

// Reviews — listing is public; create/delete require JWT
router.get('/trips/:tripCode/reviews',  reviewsController.listForTrip);
router.post('/trips/:tripCode/reviews', authenticate, reviewsController.create);
router.get('/reviews/mine',             authenticate, reviewsController.listMine);
router.delete('/reviews/:id',           authenticate, reviewsController.remove);

// Favorites — all require JWT
router.get('/favorites',                authenticate, favoritesController.listMine);
router.get('/favorites/codes',          authenticate, favoritesController.listCodes);
router.post('/favorites/:tripCode',     authenticate, favoritesController.add);
router.delete('/favorites/:tripCode',   authenticate, favoritesController.remove);

// Admin dashboard stats — admin only
router.get('/admin/stats', authenticate, authorizeAdmin, statsController.getDashboardStats);

module.exports = router;
