const express = require('express');
const router = express.Router();

const mainController = require('../controllers/main');

// Public site routes. Each one calls a controller action.
router.get('/',                  mainController.index);
router.get('/travel',            mainController.travel);
router.get('/trip/:tripCode',    mainController.tripDetail);
router.get('/favorites',         mainController.favorites);
router.get('/news',              mainController.news);
router.get('/news/:slug',        mainController.newsArticle);
router.get('/reservations',      mainController.reservations);
router.get('/login',             mainController.login);
router.get('/register',          mainController.register);
router.get('/rooms',             mainController.rooms);
router.get('/meals',             mainController.meals);
router.get('/about',             mainController.about);
router.get('/contact',           mainController.contact);
router.get('/checkout',          mainController.checkout);
router.get('/privacy',           mainController.privacy);
router.get('/terms',             mainController.terms);

module.exports = router;
