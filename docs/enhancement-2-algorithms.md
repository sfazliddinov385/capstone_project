---
title: "Enhancement 2: Algorithms and Data Structures"
---

[← Back to portfolio home](index.html)

# Enhancement 2: Algorithms and Data Structures

**Category:** Algorithms and data structures
**Primary files changed:** `app_api/utils/tripQuery.js` (new), `app_api/controllers/trips.js`, `test/tripQuery.test.js` (new)
**Course outcomes addressed:** 2, 3, 4, 5

## 1. Briefly describe the artifact

The same Travlr Getaways application from [Enhancement 1](enhancement-1-software-design.html). This second enhancement focuses on one part of the system: the trip discovery surface that powers the public trip list on the customer site and the admin trip management table in the Angular SPA.

The original Travlr Getaways was built in CS 465 Full Stack Development earlier in the SNHU program. The work shown here was done during CS 499 between March and May 2026.

## 2. Justify the inclusion of the artifact

I picked this artifact for the algorithms and data structures category because the trip list endpoint is the most used read path in the application, and before the enhancement it was the worst designed one. The original `GET /api/trips` handler called `Trip.find({})`, returned every document, and relied on the browser to filter, sort, and slice. That is fine for a course demo with eight trips and broken for any real catalog. It also opened up an attack surface. An open list endpoint that an attacker can hit again and again is a classic vector for resource exhaustion.

The pieces of this enhancement that show my skills are:

- Pulling all filter, sort, and limit logic into a pure module ([`app_api/utils/tripQuery.js`](https://github.com/)) that can be tested by itself.
- Using a small **strategy table** (`SORTS`) keyed by short, URL friendly strings (`featured`, `price-asc`, `price-desc`, `rating`, `reviews`, `spots`, `start`) that map to Mongo sort documents. This is the strategy pattern, kept small because the problem is small.
- A `clampLimit` helper that turns any input into a bounded positive integer. It defaults to 100 and caps at 100, so the endpoint cannot be tricked into returning a giant result.
- A regex escape helper applied to user supplied search text before it is put into a case insensitive `$or` match across four indexed fields. This protects against regex injection and ReDoS.
- A unit test suite written with Node's built in `node --test` runner, covering happy paths and hostile inputs.

### How the enhancement improved the artifact

Before: the trip list endpoint pulled the entire `trips` collection across the wire on every request. Filtering happened in Angular. Sorting happened in Angular. Pagination did not happen at all. A bad `?sort=DROP TABLE` would be ignored by the browser code. A regex special `?q=Reef.*` would crash the browser filter or run unpredictably.

After: every concern is moved to the server and written in code I can verify on its own.

- `buildTripListOptions(query)` returns `{ filter, sort, limit }`.
- `Trip.find(filter).sort(sort).limit(limit).exec()` runs a single bounded indexed query.
- The MongoDB query planner can use the `(category, perPerson)` and `(rating, reviewCount)` compound indexes added in [Enhancement 3](enhancement-3-databases.html) to handle the common filter then sort path without a collection scan.

Here is the helper in compressed form (see [`app_api/utils/tripQuery.js`](https://github.com/) for the full module):

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
const clampLimit   = (v, fallback = 100, max = 100) => { /* ... */ };

const buildTripListOptions = (query = {}) => {
  const filter = {};
  // q   -> $or regex across code/name/resort/description (escaped)
  // exact-match filters: category, difficulty, departureCity
  // price bounds:        minPrice/maxPrice -> perPerson.$gte/$lte
  // inventory:           minSpots          -> spotsLeft.$gte
  // sort                                   -> SORTS[query.sort] || SORTS.featured
  // limit                                  -> clampLimit(query.limit)
  return { filter, sort, limit };
};
```

### Specific skills demonstrated

- **Pure function decomposition.** Pulling the impure controller call (`Trip.find(...)`) apart from the pure query building logic, so the latter can be unit tested without standing up Mongo.
- **Strategy mapping.** Replacing what would have been an `if/else` chain with a lookup table. Cheap to extend, hard to misuse.
- **Input normalization at the boundary.** Every public field (`q`, `category`, `difficulty`, `departureCity`, `minPrice`, `maxPrice`, `minSpots`, `sort`, `limit`) is parsed and validated once, where it enters the system.
- **Algorithmic trade off awareness.** I chose `$or` over Mongo's text search operator because the case insensitive partial match behavior is easier to reason about for the small collection size this app is sized for. The text index from Enhancement 3 supports a future move to `$text` if the catalog grows.
- **Adversarial input thinking.** Regex escaping, limit clamping, range parsing that rejects negatives and NaN, and unknown sort fallback to a safe default. These choices are backed by hostile input cases in the test file.
- **Unit testing.** Used Node's built in `node --test` so there is no new test framework dependency. Four cases, four distinct concerns: happy path, hostile path, payload normalization, and the includes parser edge cases.

## 3. Reflect on the process of enhancing the artifact

### What I learned

The most useful insight from this enhancement was that the line between "what a function does" and "what a function decides" matters more than I thought. The original `tripsList` controller mixed three jobs: deciding what to query, running the query, and returning the response. I could not unit test the deciding part because it was tangled with the database call.

Once I lifted `buildTripListOptions` into a pure function whose only inputs are a plain JavaScript object and whose only output is another plain object, every test became easy to write. Hostile input tests in particular, like `{ q: 'Reef.*' }`, `{ minPrice: '-20' }`, `{ sort: 'unknown' }`, and `{ limit: '1000' }`, could be written in two lines each. Tests that take two lines get written. Tests that need fixtures and database setup often do not.

A second lesson was about **clamping at the boundary**. The original `?limit=` parameter passed straight through to Mongo. Without a cap, a single request could ask for half a million documents. `clampLimit` is fewer than ten lines of code but it changes the security posture of the endpoint. The API can no longer be pushed into a denial of service by varying a query string.

### Challenges I faced

The first challenge was the shape of the sort strategy. I first wrote sorts as flat strings, so `'price-asc'` mapped to the string `'perPerson asc'`. That meant the controller had to parse the string into Mongo's `{ field: 1 | -1 }` form. I rewrote `SORTS` so the values are already Mongo sort documents. The lookup is one line, the controller passes the result straight through, and the test is `assert.deepEqual(options.sort, { perPerson: 1, name: 1 })` without any string parsing.

The second challenge was getting the regex escape right. I first wrote a smaller escape pattern that missed one or two characters. Running the test suite caught the gap quickly. That was a reminder that even small utility functions deserve their own tests.

### Incorporating feedback

A reviewer asked whether `clampLimit` should take a per route `max` rather than a hardcoded 100. I added the parameter (`clampLimit(value, fallback = 100, max = 100)`) so future endpoints with different limits can override it without copying the parse and validate logic. The default still protects the existing endpoint.

### Course outcomes met

The plan I made in Module One was to address outcomes 2, 3, 4, and 5 with this enhancement. I met all four. No updates to the plan are needed. Outcome 1 stays mainly with Enhancement 1 and the code review.

- **Outcome 2 (professional communications).** The helper module is small, named clearly, and has a focused test file that doubles as documentation for what the helper accepts.
- **Outcome 3 (algorithmic principles and trade offs).** The enhancement is built around clear algorithmic choices: regex vs `$text`, strategy table vs branching, bounded limit vs trusting the caller. Each is defensible and each is in the narrative above.
- **Outcome 4 (industry techniques and tools).** Used Mongoose query composition, regex escaping, and Node's first party test runner. No new dependencies.
- **Outcome 5 (security mindset).** Regex injection defense, limit clamping, and rejecting negative numbers all address concrete attacker behaviors that the original endpoint allowed.

---

[← Back to portfolio home](index.html) · [Continue to Enhancement 3 →](enhancement-3-databases.html)
