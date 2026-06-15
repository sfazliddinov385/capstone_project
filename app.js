require('dotenv').config();
const express = require('express');
const path = require('path');
const hbs = require('hbs');
const cors = require('cors');
const helmet = require('helmet');

// Stop the app if JWT_SECRET is missing or too short.
// We do not want to sign tokens with a weak or empty key.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
        '\nFATAL: JWT_SECRET must be set and at least 32 characters long.\n' +
        'Generate one with:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n' +
        'Then add it to .env (see .env.example).\n'
    );
    process.exit(1);
}

// If we hit an error nobody caught, log it and exit.
// The process manager (pm2, systemd, k8s) will start a fresh one.
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});

// Connect to MongoDB.
const db = require('./app_server/models/db');
db.connect();

const indexRouter = require('./app_server/routes/index');
const apiRouter = require('./app_api/routes/index');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Use Handlebars for the public pages. Templates live in app_server/views.
app.set('views', path.join(__dirname, 'app_server', 'views'));
app.set('view engine', 'hbs');

// Load shared header/footer partials.
hbs.registerPartials(path.join(__dirname, 'app_server', 'views', 'partials'));

// Small helper so templates can write {{#if (lte a b)}}.
hbs.registerHelper('lte', function(a, b) { return a <= b; });

// Helmet adds safe HTTP headers.
// CSP is off because some pages still use inline styles. Turn it on once those are gone.
// HSTS is off in dev. If a browser caches HSTS for localhost, every dev request gets
// forced to https and the dev server stops working until the cache is cleared.
app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: isProduction
        ? { maxAge: 15552000, includeSubDomains: true }
        : false
}));

if (isProduction) {
    app.set('trust proxy', 1);
}

// CORS allowlist. Read from CORS_ORIGIN as a comma list. Default is the dev Angular app.
// We always allow our own origin so the public HBS pages can fetch the API.
// We reject "*" on purpose. A wildcard would defeat the allowlist.
const configuredOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

if (configuredOrigins.includes('*')) {
    console.error('\nFATAL: CORS_ORIGIN must not contain "*". List the actual origins instead.\n');
    process.exit(1);
}

const sameOrigins = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
const corsOrigins = Array.from(new Set([...sameOrigins, ...configuredOrigins]));

const corsOptions = {
    origin(origin, cb) {
        // Allow requests with no Origin (curl, server to server) and any allowed one.
        if (!origin || corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`Origin ${origin} not allowed by CORS`));
    }
};

app.use(cors(corsOptions));

// Parse JSON bodies. Cap the size so a huge body cannot tie us up.
app.use(express.json({ limit: '100kb' }));

// Mount the API.
app.use('/api', apiRouter);

// Mount the public pages.
app.use('/', indexRouter);

// Serve static files. Skip the index lookup so public/index.html cannot hijack /.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/images', express.static(path.join(__dirname, 'images')));

// 404 fallback. If the request fell through everything else, it is not a real route.
// API paths get JSON. Pages get our friendly 404 view.
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'Not found' });
    }
    return res.status(404).render('404', { title: 'Page not found' });
});

const server = app.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}`);
});

// On SIGTERM, let any open requests finish before we exit.
// Mongoose closes itself on SIGINT inside app_server/models/db.js.
const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down HTTP server`);
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
    // If we are still running after 10 seconds, give up and exit.
    setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
