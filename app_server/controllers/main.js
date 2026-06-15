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
        renderView(res, 'index', 'Travlr Getaways', {
            featuredTrips,
            noFeaturedTrips: !featuredTrips || featuredTrips.length === 0,
        });
    } catch (err) {
        console.error('index render error:', err);
        renderView(res, 'index', 'Travlr Getaways', {
            featuredTrips: [],
            noFeaturedTrips: true,
        });
    }
};

const travel = async (req, res) => {
    try {
        const trips = await Trip.find({}).exec();
        renderView(res, 'travel', 'Travlr Getaways - Travel', { trips });
    } catch (err) {
        console.error('travel render error:', err);
        res.status(500).render('error', {
            title: 'Something went wrong',
            code: '500',
            heading: 'We could not load the trip catalog',
            message: 'Try again in a moment.'
        });
    }
};

const tripDetail = async (req, res) => {
    try {
        const code = String(req.params.tripCode || '').trim().toUpperCase();
        const trip = await Trip.findOne({ code }).lean();
        if (!trip) {
            return res.status(404).render('error', {
                title: 'Trip not found',
                code: '404',
                heading: 'We could not find that trip',
                message: `Trip ${code} does not exist or has been removed.`
            });
        }
        renderView(res, 'trip-detail', `${trip.name} - Travlr Getaways`, { trip });
    } catch (err) {
        console.error('tripDetail render error:', err);
        res.status(500).render('error', {
            title: 'Something went wrong',
            code: '500',
            heading: 'We could not load that trip',
            message: 'Try again in a moment.'
        });
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
    // Defensive: if news.json is empty or missing entries, do not crash.
    if (!Array.isArray(newsItems) || newsItems.length === 0) {
        return renderView(res, 'news', 'Travlr Getaways - News', {
            featured: null,
            articles: [],
            categories: [],
            totalCount: 0,
        });
    }

    const featured = newsItems.find(a => a && a.featured) || newsItems[0];
    const articles = newsItems.filter(a => a && a.slug && a.slug !== featured.slug);

    // Count articles per category so the sidebar shows real numbers.
    const counts = newsItems.reduce((acc, a) => {
        acc[a.category] = (acc[a.category] || 0) + 1;
        return acc;
    }, {});
    const categories = Object.keys(counts)
        .sort((a, b) => counts[b] - counts[a])
        .map(name => ({ name, count: counts[name] }));

    renderView(res, 'news', 'Travlr Getaways - News', {
        featured,
        articles,
        categories,
        totalCount: newsItems.length,
    });
};

const newsArticle = (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    const article = newsItems.find(a => a.slug === slug);
    if (!article) {
        return res.status(404).render('error', {
            title: 'Article not found',
            code: '404',
            heading: 'We could not find that article',
            message: 'The story may have moved. Check the news index for the latest.'
        });
    }
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
