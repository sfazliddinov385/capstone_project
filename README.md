# Travlr Getaways

Travlr Getaways is a full-stack travel booking application used as the CS 499 capstone artifact. It contains an Express/Handlebars customer site, a MongoDB/Mongoose REST API, and an Angular 21 administrative client.

The polished capstone narratives and professional self-assessment live in [`/docs`](./docs) and are published as a GitHub Pages site.

## Screenshots

### Homepage
![Travlr Getaways homepage hero](Screenshots/Screenshot%202026-05-22%20150842.png)

### Meals
![Snapshots from partner kitchens](Screenshots/Screenshot%202026-05-22%20150910.png)

### My Reservations
![Customer reservations dashboard](Screenshots/Screenshot%202026-05-22%20150926.png)

### Travel News & Tips
![Travel news and articles page](Screenshots/Screenshot%202026-05-22%20150955.png)

## What's in here

| Path | Purpose |
|---|---|
| [`app.js`](app.js) | Express bootstrap (security middleware, CORS, routes, shutdown). |
| [`app_server/`](app_server) | Customer-facing site (HBS views, controllers, Mongoose model). |
| [`app_api/`](app_api) | REST API (auth, trips, reservations, reviews, favorites, stats). |
| [`travlr-admin/`](travlr-admin) | Angular 21 admin SPA. |
| [`scripts/`](scripts) | One-shot operational scripts (admin user seeding, etc). |
| [`test/`](test) | Unit tests (Node's built-in test runner). |
| [`public/`](public) | Static assets served by Express. |
| [`legacy/`](legacy) | Pre-MEAN-stack prototype assets, kept for history. |

## Capstone enhancements

| # | Theme | Headline change |
|---|---|---|
| 1 | Software design & engineering | Role-based JWT claims + `authenticate` / `authorizeAdmin` middleware + admin-aware Angular UI. |
| 2 | Algorithms & data structures | Pure `tripQuery` helper — regex-escaped search, strategy-mapped sorts, clamped result limits, fully unit-tested. |
| 3 | Databases | Schema validation, text + compound indexes, and **atomic** reservation flow that cannot oversell. |

See [docs/index.html](./docs/index.md) for the full ePortfolio.

## Quickstart

```powershell
# 1. Install
npm install

# 2. Configure (REQUIRED)
Copy-Item .env.example .env
# Edit .env — at minimum, set JWT_SECRET (>= 32 chars). The server refuses
# to boot without it. Generate one with:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Seed the database
npm run seed

# 4. Create the admin user
node scripts/create-admin.js

# 5. Start the API + customer site
npm start                # http://localhost:3000

# 6. Start the Angular admin (in a second terminal)
Set-Location travlr-admin
npm install
npm start                # http://localhost:4200
```

Default admin credentials (override with `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars):

- Email: `admin@travlr.com`
- Password: `password123`

## Environment variables

All variables live in `.env` (which is git-ignored). See [`.env.example`](.env.example) for the canonical list.

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | yes | Signing secret for JWTs. Must be at least 32 characters. Server hard-stops without it. |
| `MONGODB_URI` | no | MongoDB connection string. Defaults to `mongodb://localhost:27017/travlr`. |
| `PORT` | no | API + customer site port. Defaults to `3000`. |
| `CORS_ORIGIN` | no | Comma-separated allowlist of API origins. Defaults to `http://localhost:4200`. Set to `*` to disable (not recommended in production). |
| `BCRYPT_ROUNDS` | no | bcrypt work factor. Defaults to `12`. |
| `EMAIL_USER` / `EMAIL_PASS` | no | Gmail App Password for reservation confirmation email. If unset, sending is silently skipped (no PII logged). |
| `PUBLIC_URL` | no | Public origin of the customer site, used inside outbound email links. Defaults to `http://localhost:PORT`. |
| `NODE_ENV` | no | Set to `production` to enable trust-proxy and stricter helmet defaults. |

## Security posture

- Passwords are hashed with **bcrypt** (work factor 12 by default). Legacy PBKDF2 records from earlier seeds are still accepted at login and are transparently upgraded to bcrypt on first successful login.
- JWTs are signed with `JWT_SECRET` and carry a `role` claim. `authenticate` verifies the token; `authorizeAdmin` checks the claim. Admin-only routes require both.
- `helmet` sets defensive HTTP headers. CSP is left off until the legacy inline styles in `public/*.html` are migrated. HSTS is enabled only in production.
- CORS is allowlisted via `CORS_ORIGIN` rather than wide-open. The server's own origin is always allowed.
- `/api/login` and `/api/register` are rate-limited to 10 requests per 15 minutes per IP.
- Authenticated write endpoints (reservation, review, favorite mutations) are rate-limited to 60 requests per 15 minutes per IP.
- JSON body size is capped at 100 KB.
- The trip-list endpoint clamps `?limit=` to 100 and regex-escapes `?q=` to defend against ReDoS.
- Reservation create / update / cancel mutate inventory through atomic conditional `findOneAndUpdate` to prevent overselling, with a compensation path in the `catch` block.
- Server fails closed at startup if `JWT_SECRET` is missing or shorter than 32 characters, and exits if Mongoose cannot connect.
- Process listens for `uncaughtException` and `unhandledRejection` and exits so a supervisor can restart cleanly.

## Tests

```powershell
npm test
```

Runs five suites under Node's built-in test runner (36 tests total):

- `test/tripQuery.test.js` — query-helper happy and hostile paths.
- `test/tripScoring.test.js` — similar-trips ranking algorithm.
- `test/reviewValidation.test.js` — review input validation (rejects half-stars, etc).
- `test/auth.test.js` — authenticate + authorizeAdmin middleware.
- `test/password.test.js` — bcrypt roundtrip + legacy PBKDF2 upgrade.

## Publishing the ePortfolio

The `/docs` folder is a Jekyll site. After pushing this repository to GitHub:

1. Open **Settings → Pages**.
2. Set the source to **Deploy from a branch**, branch `main`, folder `/docs`.
3. GitHub Pages will build with the `jekyll-theme-cayman` theme declared in `docs/_config.yml`.

To preview locally:

```powershell
Set-Location docs
bundle install
bundle exec jekyll serve   # http://127.0.0.1:4000
```
