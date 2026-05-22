const Trip      = require('../models/travlr');
const newsItems = require('../data/news.json');

const renderView = (res, viewName, title, extraContext = {}) => {
    res.render(viewName, {
        title,
        ...extraContext,
    });
};

const index = async (req, res) => {
    try {
        const featuredTrips = await Trip.find({}).limit(3).exec();
        renderView(res, 'index', 'Travlr Getaways', { featuredTrips });
    } catch (err) {
        renderView(res, 'index', 'Travlr Getaways');
    }
};

const travel = async (req, res) => {
    try {
        const trips = await Trip.find({}).exec();
        renderView(res, 'travel', 'Travlr Getaways - Travel', { trips });
    } catch (err) {
        res.status(500).render('error', { message: err.message });
    }
};

const tripDetail = async (req, res) => {
    try {
        const code = String(req.params.tripCode || '').trim().toUpperCase();
        const trip = await Trip.findOne({ code }).lean();
        if (!trip) return res.status(404).render('error', { message: `Trip ${code} not found.` });
        renderView(res, 'trip-detail', `${trip.name} - Travlr Getaways`, { trip });
    } catch (err) {
        res.status(500).render('error', { message: err.message });
    }
};

const favorites = (req, res) => {
    renderView(res, 'favorites', 'Travlr Getaways - My Favorites');
};

const rooms = (req, res) => {
    renderView(res, 'rooms', 'Travlr Getaways - Rooms');
};

const meals = (req, res) => {
    renderView(res, 'meals', 'Travlr Getaways - Meals');
};

const news = (req, res) => {
    const featured = newsItems.find(a => a.featured) || newsItems[0];
    const articles = newsItems.filter(a => a.slug !== featured.slug);
    renderView(res, 'news', 'Travlr Getaways - News', { featured, articles });
};

const newsArticle = (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    const article = newsItems.find(a => a.slug === slug);
    if (!article) return res.status(404).render('error', { message: `Article not found.` });
    const related = newsItems.filter(a => a.slug !== slug).slice(0, 3);
    renderView(res, 'news-article', `${article.title} - Travlr Getaways`, { article, related });
};

const reservations = (req, res) => {
    renderView(res, 'reservations', 'Travlr Getaways - Reservations');
};

const login = (req, res) => {
    renderView(res, 'login', 'Travlr Getaways - Login');
};

const register = (req, res) => {
    renderView(res, 'register', 'Travlr Getaways - Sign Up');
};

const about = (req, res) => {
    renderView(res, 'about', 'Travlr Getaways - About');
};

const contact = (req, res) => {
    renderView(res, 'contact', 'Travlr Getaways - Contact');
};

const checkout = (req, res) => {
    renderView(res, 'checkout', 'Travlr Getaways - Checkout');
};

const privacy = (req, res) => {
    renderView(res, 'privacy', 'Travlr Getaways - Privacy Policy');
};

const terms = (req, res) => {
    renderView(res, 'terms', 'Travlr Getaways - Terms of Service');
};

module.exports = { index, travel, tripDetail, favorites, rooms, meals, news, newsArticle, reservations, login, register, about, contact, checkout, privacy, terms };
