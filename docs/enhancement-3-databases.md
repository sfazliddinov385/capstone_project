---
title: Enhancement 3 — Databases
---

[← Back to portfolio home](index.html)

# Enhancement 3 — Databases

**Category:** Databases
**Primary files changed:** `app_server/models/travlr.js`, `app_api/models/reservation.js`, `app_api/controllers/reservations.js`
**Course outcomes addressed:** 2, 3, 4, 5

## 1. Briefly describe the artifact

The same Travlr Getaways application as the previous two enhancements. This third enhancement is concentrated on the data layer: the Mongoose schemas that define the application's collections, and the reservation controller that mutates those collections under concurrent load.

## 2. Justify the inclusion of the artifact

I selected this artifact for the database category because the original reservation flow contained the kind of bug that is invisible until it is catastrophic: a read-then-write race condition on inventory. The booking endpoint loaded the trip, checked `spotsLeft` in JavaScript, and then wrote a decrement. Two requests arriving at the last available seat would both pass the check and both write the decrement, leaving `spotsLeft = -1` and two customers each believing they had reserved the final spot.

That class of bug is exactly the reason MongoDB exposes atomic update operators. Fixing it well — instead of patching it with a half-broken lock or a transaction that the underlying replica set may not support — is a database-design problem, not a feature bug. It also gave me a natural place to demonstrate stronger schema validation and the kind of indexing decisions that I learned to make in CS 340 and DAD 220.

The specific components of the enhancement that showcase my skills:

- **Typed and constrained schema.** The Trip schema now declares numeric prices, enum-bounded categorical fields, length-capped free text, range-checked ratings and inventory counts, and Mongo timestamps.
- **Indexes that match the workload.** A text index across `name/resort/description/code`, a compound `(category, perPerson)` index for the most common filter-then-sort query path, and a `(rating, reviewCount)` index for the featured sort.
- **Atomic inventory updates.** Booking decrements seats with a conditional `findOneAndUpdate({ code, spotsLeft: { $gte: numPeople } }, { $inc: { spotsLeft: -numPeople } })`. Cancellation increments them. Edits compute a `peopleDelta` and apply the right correction.
- **Compensation on partial failure.** If reservation document creation fails after the seat decrement succeeded, the controller re-increments the seats so inventory is not leaked.
- **Denormalized snapshots on the reservation.** `tripName`, `length`, `start`, `resort`, and `perPerson` are copied onto each reservation so future trip edits do not retroactively alter a customer's receipt.

### How the enhancement improved the artifact

Before:

- Prices were stored as strings (`"$2199"`), defeating numeric comparisons and price filters.
- `category` accepted any string, including typos.
- Free-text fields were unbounded, accepting documents of any size.
- No indexes existed other than the implicit `_id` and the existing `code` unique index.
- The booking flow could oversell.
- Reservations referenced trips only by `tripCode` (a string), so trip joins required a second query.

After (the headline pieces of [`app_server/models/travlr.js`](https://github.com/)):

```js
const tripSchema = new mongoose.Schema({
  code:        { type: String,  required: true, unique: true, trim: true, uppercase: true },
  name:        { type: String,  required: true, trim: true, maxlength: 120 },
  perPerson:   { type: Number,  required: true, min: 0 },
  category:    { type: String, enum: ['Beach','Diving','Adventure','Luxury','Cultural','Cruise'], default: 'Beach', index: true },
  difficulty:  { type: String, enum: ['Easy','Moderate','Challenging'], default: 'Easy' },
  rating:      { type: Number,  default: 4.5, min: 0, max: 5 },
  reviewCount: { type: Number,  default: 0,   min: 0 },
  spotsLeft:   { type: Number,  default: 20,  min: 0 },
  // …
}, { timestamps: true });

tripSchema.index({ name: 'text', resort: 'text', description: 'text', code: 'text' });
tripSchema.index({ category: 1, perPerson: 1 });
tripSchema.index({ rating: -1, reviewCount: -1 });
```

And the headline of [`app_api/controllers/reservations.js`](https://github.com/) — the booking call:

```js
const trip = await Trip.findOneAndUpdate(
  { code: tripCode, spotsLeft: { $gte: numPeople } },
  { $inc: { spotsLeft: -numPeople } },
  { new: true, runValidators: true }
).exec();

if (!trip) return res.status(409).json({ message: 'Not enough spots are available for this trip' });
```

The predicate `spotsLeft: { $gte: numPeople }` is evaluated atomically by MongoDB as part of the update. If two requests for the last seat arrive simultaneously, exactly one of them matches; the other is rejected with `409 Conflict`. The race condition disappears without introducing a lock or a multi-document transaction.

The compensation path follows immediately after, in the `catch` block:

```js
catch (err) {
  if (reservedTripCode) {
    await Trip.updateOne({ code: reservedTripCode }, { $inc: { spotsLeft: reservedPeople } }).exec();
  }
  res.status(500).json({ message: err.message });
}
```

So even if the reservation document fails to persist for some reason (validation, network blip, anything), the inventory we briefly held is returned.

### Specific skills demonstrated

- **Schema design.** Choosing typed, constrained fields over permissive strings; choosing where defaults belong; choosing whether timestamps belong on a document.
- **Index design.** Picking indexes that match the workload of [Enhancement 2](enhancement-2-algorithms.html) so the trip-list endpoint can satisfy the filter-then-sort path without a collection scan.
- **Concurrency control.** Using MongoDB's atomic update operators instead of inventing a fragile JavaScript lock.
- **Failure-mode design.** Naming what could go wrong after the first write succeeded, and writing the inverse operation in the `catch` so partial failures heal themselves.
- **Migration safety.** The new fields (`role` on User, refined fields on Trip, `tripId` on Reservation) all have defaults or are populated by the controller, so existing seeded data does not need a separate migration script — the seed in `app_server/data/load-db.js` already produces the correct shape.

## 3. Reflect on the process of enhancing the artifact

### What I learned

The single most valuable thing I took from this enhancement is the difference between "I read the value and then changed it" and "I changed the value if it still matched my expectation". The first is two operations and unsafe under concurrency. The second is one atomic operation and safe. MongoDB exposes this naturally through update filters, and once I started thinking in terms of "what predicate is true at the moment of the write" rather than "what value did I read a moment ago", a lot of the booking-system anxiety disappeared.

I also internalized the importance of designing indexes alongside the queries that need them, rather than waiting for a slow query in production. Without the `(category, perPerson)` index, the `?category=Diving&sort=price-asc` request from Enhancement 2 would have required a collection scan plus an in-memory sort. With the index, the same query is a bounded range scan.

A third lesson was about denormalization. The reservation document now stores `tripName`, `length`, `start`, `resort`, and `perPerson` directly. That looks like duplication at first, and it is — deliberately. A reservation is a historical record of what the customer agreed to. If the operator edits the trip later, the customer's receipt must not change. Storing the snapshot on the reservation is the correct trade-off: write-time cost is a few extra fields, read-time cost is one fewer join, and historical correctness is preserved.

### Challenges I faced

The reservation update path was the trickiest. A customer can both increase and decrease their party size on an existing booking. Increasing requires taking more seats — which must be the same atomic, conditional decrement as the initial booking. Decreasing requires returning seats — which is unconditional. I ended up branching on the sign of `peopleDelta`, and writing the same conditional `findOneAndUpdate` for the positive case so the over-sell guard applies to edits, not just initial bookings:

```js
const peopleDelta = numPeople - reservation.people;
if (peopleDelta > 0) {
  const trip = await Trip.findOneAndUpdate(
    { code: reservation.tripCode, spotsLeft: { $gte: peopleDelta } },
    { $inc: { spotsLeft: -peopleDelta } },
    { new: true, runValidators: true }
  ).exec();
  if (!trip) return res.status(409).json({ message: 'Not enough spots are available for this trip' });
} else if (peopleDelta < 0) {
  await Trip.updateOne(
    { code: reservation.tripCode },
    { $inc: { spotsLeft: Math.abs(peopleDelta) } }
  ).exec();
}
```

The second challenge was reasoning about what should happen if the reservation document later fails to save after a seat decrement. I added the compensation `catch` block, but I also recognized that this is the layer at which a multi-document MongoDB transaction would be cleaner if the deployment is on a replica set. I documented that as future work rather than introducing it now, since the compensation path is sufficient for the threat model and works on the default standalone MongoDB used in development.

### Incorporating feedback

A peer suggested I add a `bookedAt` field and an index on `(userId, bookedAt desc)` so that a customer's "my reservations" page can return the newest-first list with no in-memory sort. I added both, and it shows up in the `getReservations` controller as `find(...).sort({ bookedAt: -1 })` — backed by the compound index, that is a free sort rather than an O(n log n) operation.

### Course outcomes met

- **Outcome 2 (professional communications).** Schemas now declare what they accept; the documents that the application stores are self-describing.
- **Outcome 3 (algorithmic principles and trade-offs).** Indexes were chosen with explicit awareness of the query workload; concurrency safety was achieved with atomic updates rather than locks; denormalization is documented as a deliberate write-vs-read trade.
- **Outcome 4 (industry techniques).** Used Mongoose validation, MongoDB atomic operators, and compound indexing — standard patterns that scale.
- **Outcome 5 (security mindset).** Closed a race-condition vulnerability in the booking flow that could have allowed overselling — a concrete, exploitable bug rather than a theoretical one.

---

[← Back to portfolio home](index.html)
