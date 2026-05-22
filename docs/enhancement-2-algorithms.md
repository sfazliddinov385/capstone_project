---
title: Enhancement 2 — Algorithms and Data Structures
---

[← Back to portfolio home](index.html)

# Enhancement 2 — Algorithms and Data Structures

**Category:** Algorithms and data structures
**Primary files changed:** `app_api/utils/tripQuery.js` (new), `app_api/controllers/trips.js`, `test/tripQuery.test.js` (new)
**Course outcomes addressed:** 2, 3, 4, 5

## 1. Briefly describe the artifact

The same Travlr Getaways application described in [Enhancement 1](enhancement-1-software-design.html). This second enhancement focuses on a specific subsystem: the trip-discovery surface that powers the public trip listing on the customer site and the admin trip-management table in the Angular SPA.

## 2. Justify the inclusion of the artifact

I selected this artifact for the algorithms-and-data-structures category because the trip-listing endpoint is the highest-traffic read path in the application and was, before the enhancement, the worst-designed one. The original `GET /api/trips` handler called `Trip.find({})`, returned every document in the collection, and depended on the browser to filter, sort, and slice the result. That approach is fine for a course demo with eight trips and broken for any realistic catalog. It also presented a real attack surface: an unbounded list endpoint that an adversary can hit repeatedly is a classic vector for inefficient-resource-consumption attacks.

The components of this enhancement that showcase my skills are:

- The extraction of all filter/sort/limit construction into a pure module ([`app_api/utils/tripQuery.js`](https://github.com/)) that is independently testable.
- The use of a small **strategy table** (`SORTS`) keyed by short, URL-friendly strings — `featured`, `price-asc`, `price-desc`, `rating`, `reviews`, `spots`, `start` — that map to Mongo sort documents. This is a textbook strategy pattern, kept minimal because the problem is small.
- A `clampLimit` helper that turns any input into a bounded positive integer, defaulting to 100 and capping at 100, so the endpoint can never be coerced into returning an unbounded result.
- A regex-escape helper applied to user-supplied search text before it is composed into a case-insensitive `$or` match across four indexed fields, defending against both regex injection and ReDoS.
- A unit-test suite written with Node's built-in `node --test` runner, covering happy paths and hostile inputs.

### How the enhancement improved the artifact

Before: the trip-list endpoint pulled the entire `trips` collection across the wire on every request. Filtering happened in Angular. Sorting happened in Angular. Pagination did not happen at all. A malformed `?sort=DROP TABLE` would have been ignored by the browser code; a regex-special `?q=Reef.*` would have crashed the client-side filter or run unpredictably.

After: every concern is moved server-side and expressed in code that is independently verifiable.

- `buildTripListOptions(query)` returns `{ filter, sort, limit }`.
- `Trip.find(filter).sort(sort).limit(limit).exec()` executes a single bounded, indexed query.
- The MongoDB query planner can use the `(category, perPerson)` and `(rating, reviewCount)` compound indexes added in [Enhancement 3](enhancement-3-databases.html) to satisfy the common filter-then-sort path without a collection scan.

Here is the helper in compressed form to illustrate the structure (see [`app_api/utils/tripQuery.js`](https://github.com/) for the full module):

```js
const SORTS = {
  featured:     { rating: -1, reviewCount: -1, name: 1 },
  'price-asc':  { perPerson: 1, name: 1 },
  'price-desc': { perPerson: -1, name: 1 },
  rating:       { rating: -1, reviewCount: -1 },
  reviews:      { reviewCount: -1, rating: -1 },
  spots:        { spotsLeft: 1, name: 1 },
  start:        { start: 1, name: 1 },
};

const escapeRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clampLimit   = (v, fallback = 100, max = 100) => { /* … */ };

const buildTripListOptions = (query = {}) => {
  const filter = {};
  // q   → $or regex across code/name/resort/description (escaped)
  // exact-match filters: category, difficulty, departureCity
  // price bounds:        minPrice/maxPrice → perPerson.$gte/$lte
  // inventory:           minSpots          → spotsLeft.$gte
  // sort                                   → SORTS[query.sort] || SORTS.featured
  // limit                                  → clampLimit(query.limit)
  return { filter, sort, limit };
};
```

### Specific skills demonstrated

- **Pure-function decomposition.** Pulling the impure controller call (`Trip.find(...)`) apart from the pure query-construction logic so the latter can be unit-tested without standing up Mongo.
- **Strategy mapping.** Replacing what would have been an `if/else` chain with a lookup table — cheap to extend, hard to misuse.
- **Input normalization at the boundary.** Every public field (`q`, `category`, `difficulty`, `departureCity`, `minPrice`, `maxPrice`, `minSpots`, `sort`, `limit`) is parsed and validated *once*, where it enters the system.
- **Algorithmic trade-off awareness.** I chose `$or` over Mongo's text-search operator because the case-insensitive partial-match semantics are easier to reason about for the small collection sizes this application is sized for; the text index from Enhancement 3 supports future migration to `$text` if the catalog grows.
- **Adversarial-input thinking.** Regex escaping, limit clamping, range parsing that rejects negatives and NaN, and unknown-sort fallback to a safe default. These choices are evidenced by hostile-input cases in the test file.
- **Unit testing.** Used Node's built-in `node --test` so there is zero new test-framework dependency. Four cases, four distinct concerns: happy path, hostile path, payload normalization, and the includes-parser edge cases.

## 3. Reflect on the process of enhancing the artifact

### What I learned

The most useful insight from this enhancement was that the boundary between "stuff a function does" and "stuff a function decides" matters more than I had previously believed. The original `tripsList` controller mixed three concerns: deciding what to query, performing the query, and returning the response. I could not unit-test the deciding part because it was tangled with the database call.

Once I lifted `buildTripListOptions` into a pure function whose only inputs are a plain JavaScript object and whose only output is another plain JavaScript object, every test became trivial to write. Hostile-input tests in particular — `{ q: 'Reef.*' }`, `{ minPrice: '-20' }`, `{ sort: 'unknown' }`, `{ limit: '1000' }` — could be expressed in two lines each. Tests that take two lines get written; tests that require fixtures and database setup often do not.

A second lesson was about the discipline of **clamping at the boundary**. The original `?limit=` parameter passed straight through to Mongo. Without a cap, a single request could ask for half a million documents. `clampLimit` is fewer than ten lines of code but it changes the security posture of the endpoint: the API can no longer be coerced into a denial-of-service by varying a query string.

### Challenges I faced

The first challenge was figuring out the right shape for the sort strategy. I originally wrote sorts as flat strings — `'price-asc'` mapped to the string `'perPerson asc'` — but that meant the controller had to parse the string into Mongo's `{ field: 1 | -1 }` form. I rewrote `SORTS` so the values are *already* Mongo sort documents. The lookup is one line, the controller passes the result straight through, and the test is `assert.deepEqual(options.sort, { perPerson: 1, name: 1 })` instead of involving string parsing.

The second challenge was getting the regex escaping right. I initially wrote a smaller escape pattern that missed one or two characters; running the test suite caught the gap quickly. That was a reminder that even small utility functions deserve targeted tests.

### Incorporating feedback

A reviewer asked whether `clampLimit` should accept a per-route `max` rather than the hardcoded 100. I added the parameter (`clampLimit(value, fallback = 100, max = 100)`) so future endpoints with different bounds can override it without duplicating the parse-and-validate logic. The default still protects the existing endpoint.

### Course outcomes met

- **Outcome 2 (professional communications).** The helper module is small, named clearly, and has a focused test file that doubles as documentation for what the helper accepts.
- **Outcome 3 (algorithmic principles and trade-offs).** The enhancement is structured around explicit algorithmic decisions: regex vs. `$text`, strategy table vs. branching, bounded limit vs. trusting the caller. Each is defensible and each is in the narrative above.
- **Outcome 4 (industry techniques and tools).** Used Mongoose query composition, regex escaping, and Node's first-party test runner — no novel dependencies.
- **Outcome 5 (security mindset).** Regex-injection defense, limit clamping, and rejecting negative numbers all address concrete attacker behaviors that the original endpoint allowed.

---

[← Back to portfolio home](index.html) · [Continue to Enhancement 3 →](enhancement-3-databases.html)
