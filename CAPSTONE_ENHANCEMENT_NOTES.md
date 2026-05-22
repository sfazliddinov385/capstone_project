# CS 499 Capstone Enhancement Notes

## Artifact Overview

The selected artifact is Travlr Getaways, a full-stack travel booking application originally built as a MEAN-style project with an Express/Handlebars customer site, a MongoDB/Mongoose API, and an Angular administrative client. The original artifact demonstrated basic page rendering, trip data management, user authentication, and reservation workflows.

The enhanced artifact demonstrates growth across software design and engineering, algorithms and data structures, and databases by improving authorization boundaries, moving trip discovery logic into testable query helpers, strengthening database schemas, and preserving trip inventory during reservation changes.

## Enhancement 1: Software Design and Engineering

The software design enhancement focuses on security, maintainability, and separation of responsibilities. The API now distinguishes customer users from admin users with a role stored in the user model and embedded in the signed JWT. Administrative routes for customer listings and trip write operations require both authentication and admin authorization. The Angular admin interface also reflects this authorization boundary by hiding customer-management and trip-management controls from non-admin accounts.

Key evidence:

- `app_api/models/user.js` adds role-based identity data and includes the role in JWT payloads.
- `app_api/middleware/auth.js` separates authentication from admin authorization.
- `app_api/routes/index.js` applies admin-only authorization to customer and trip management routes.
- `travlr-admin/src/app/authentication.service.ts` and related components expose admin-aware UI behavior.

Course outcome alignment:

- Collaborative environments: clearer role boundaries support different audiences and responsibilities.
- Professional communication: the code separates business rules into named, readable middleware.
- Computing practices: authorization is implemented with reusable middleware instead of duplicated route logic.
- Security mindset: protected data and write operations require least-privilege access.

## Enhancement 2: Algorithms and Data Structures

The algorithms and data structures enhancement adds reusable trip query construction for search, exact-match filters, price bounds, inventory filters, controlled result limits, and deterministic sort strategies. This moves filtering and sorting from client-only behavior into a server-side helper that can be tested independently.

Key evidence:

- `app_api/utils/tripQuery.js` builds MongoDB query objects from request parameters.
- `app_api/controllers/trips.js` uses the query helper for the trip list endpoint.
- `test/tripQuery.test.js` verifies search escaping, filter construction, sort mapping, limit clamping, and payload normalization.

Course outcome alignment:

- Algorithmic principles: search, filter, sort, and bound logic are expressed through predictable data structures.
- Trade-off management: server-side filtering reduces unnecessary client processing while preserving simple API calls.
- Professional-quality delivery: the helper is unit tested with Node's built-in test runner.

## Enhancement 3: Databases

The database enhancement strengthens the data model and improves reservation integrity. Trip data now uses typed numeric prices, enum validation, min/max constraints, timestamps, and indexes for common query patterns. Reservation records now reference the trip document and include indexes for user and trip lookups. Booking, canceling, and updating reservations adjusts `spotsLeft` through atomic MongoDB update operations to reduce overselling risk.

Key evidence:

- `app_server/models/travlr.js` adds schema validation and indexes.
- `app_api/models/reservation.js` adds a trip reference, numeric pricing, validation, timestamps, and indexes.
- `app_api/controllers/reservations.js` decrements and restores trip inventory as reservations are created, canceled, or modified.

Course outcome alignment:

- Database practices: schemas enforce stronger data quality and query indexes support expected access patterns.
- Security mindset: inventory updates reduce race-condition exposure in booking workflows.
- Computing solutions: reservation behavior now reflects real business constraints rather than storing isolated records.

## Code Review Video Talking Points

1. Existing functionality: Walk through the customer trip pages, Angular admin trip management, API routes, MongoDB models, authentication, and reservations.
2. Code analysis: Identify the original risks: any authenticated user could access admin operations, filtering was mostly client-side, schemas accepted loose data, and reservations did not consistently protect inventory.
3. Planned and completed enhancements: Explain role-based access control, testable trip query helpers, schema validation, indexes, and atomic spot adjustments.
4. Skills demonstrated: Express middleware design, JWT claims, Angular conditional UI, MongoDB query construction, Mongoose validation/indexing, and unit testing.
5. Outcomes: Connect the work to security, algorithmic design, database design, professional communication, and maintainable software engineering.

## Suggested Portfolio Structure

- Professional Self-Assessment
- Code Review Video Link
- Original Artifact
- Enhanced Artifact
- Enhancement 1 Narrative: Software Design and Engineering
- Enhancement 2 Narrative: Algorithms and Data Structures
- Enhancement 3 Narrative: Databases
- Screenshots and Run Instructions
