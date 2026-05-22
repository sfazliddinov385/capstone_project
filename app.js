require('dotenv').config();
const express = require('express');
const path = require('path');
const hbs = require('hbs');
const cors = require('cors');
const helmet = require('helmet');

// --- Startup configuration validation ---------------------------------------
// Fail closed if the JWT secret is missing or too weak. Hard-stops a misconfigured
// deploy before it can issue tokens signed with `undefined`.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
        '\nFATAL: JWT_SECRET must be set and at least 32 characters long.\n' +
        'Generate one with:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n' +
        'Then add it to .env (see .env.example).\n'
    );
    process.exit(1);
}

// Database connection
const db = require('./app_server/models/db');
db.connect();

const indexRouter = require('./app_server/routes/index');
const apiRouter = require('./app_api/routes/index');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// View engine setup — HBS templates live in app_server/views
app.set('views', path.join(__dirname, 'app_server', 'views'));
app.set('view engine', 'hbs');

// Register HBS partials from app_server/views/partials
hbs.registerPartials(path.join(__dirname, 'app_server', 'views', 'partials'));

// Handlebars helpers
hbs.registerHelper('lte', function(a, b) { return a <= b; });

// --- Security middleware ----------------------------------------------------
// Helmet sets sensible HTTP response headers. CSP is left off because the
// legacy HBS + static-HTML pages contain inline styles that a strict policy
// would break — turn it on once those are migrated. HSTS is disabled outside
// production because once a browser caches HSTS for `localhost` it will
// permanently rewrite http://localhost requests to https://, which breaks
// every fetch against the dev server until the cache is cleared.
app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: isProduction
        ? { maxAge: 15552000, includeSubDomains: true }
        : false
}));

if (isProduction) {
    app.set('trust proxy', 1);
}

// CORS allowlist — comma-separated origins via CORS_ORIGIN (default: dev Angular).
// The server's own origin is always allowed so browser fetches from server-rendered
// HBS pages (which include an Origin header on POST) are not rejected as cross-origin.
const configuredOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

const sameOrigins = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
const corsOrigins = Array.from(new Set([...sameOrigins, ...configuredOrigins]));

const corsOptions = corsOrigins.includes('*')
    ? { origin: true }
    : {
        origin(origin, cb) {
            // Allow no-origin (curl, server-to-server) and any allowlisted origin.
            if (!origin || corsOrigins.includes(origin)) return cb(null, true);
            return cb(new Error(`Origin ${origin} not allowed by CORS`));
        }
    };

app.use(cors(corsOptions));

// Parse JSON bodies, with a sane size cap to limit abuse.
app.use(express.json({ limit: '100kb' }));

// Mount API routes
app.use('/api', apiRouter);

// Register the travlr routes with the application
app.use('/', indexRouter);

// Serve static assets without allowing public/index.html to override the HBS home route
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}`);
});

module.exports = app;
