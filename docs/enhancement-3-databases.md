---
title: "Enhancement 3: Databases"
---

[← Back to portfolio home](index.html)

# Enhancement 3: Databases

**Category:** Databases
**Primary files changed:** `app_server/models/travlr.js`, `app_api/models/reservation.js`, `app_api/controllers/reservations.js`
**Course outcomes addressed:** 2, 3, 4, 5

## 1. Briefly describe the artifact

The same Travlr Getaways application as the previous two enhancements. This third enhancement focuses on the data layer: the Mongoose schemas that define the application's collections, and the reservation controller that changes those collections under concurrent load.

## 2. Justify the inclusion of the artifact

I picked this artifact for the database category because the original reservation flow had the kind of bug that is invisible until it is awful: a read then write race condition on inventory. The booking endpoint loaded the trip, checked `spotsLeft` in JavaScript, and then wrote a decrement. Two requests arriving at the last open seat would both pass the check and both write the decrement. That leaves `spotsLeft = -1` and two customers each thinking they got the last spot.

That class of bug is exactly the reason MongoDB has atomic update operators. Fixing it well, instead of patching it with a half broken lock or a transaction that the underlying replica set may not support, is a database design problem, not a feature bug. It also gave me a good place to show stronger schema validation and the kind of indexing choices I learned to make in CS 340 and DAD 220.

The pieces of the enhancement that show my skills:

- **Typed and constrained schema.** The Trip schema now declares numeric prices, enum bounded categorical fields, length capped free text, range checked ratings and inventory counts, and Mongo timestamps.
- **Indexes that match the workload.** A text index across `name/resort/description/code`, a compound `(category, perPerson)` index for the most common filter then sort path, and a `(rating, reviewCount)` index for the featured sort.
- **Atomic inventory updates.** Booking decrements seats with a conditional `findOneAndUpdate({ code, spotsLeft: { $gte: numPeople } }, { $inc: { spotsLeft: -numPeople } })`. Cancellation increments them. Edits compute a `peopleDelta` and apply the right correction.
- **Compensation on partial failure.** If the reservation document fails to create after the seat decrement succeeded, the controller adds the seats back so inventory is not leaked.
- **Denormalized snapshots on the reservation.** `tripName`, `length`, `start`, `resort`, and `perPerson` are copied onto each reservation so future trip edits do not change a customer's receipt.

### How the enhancement improved the artifact

Before:

- Prices were stored as strings (`"$2199"`), which broke numeric comparisons and price filters.
- `category` accepted any string, including typos.
- Free text fields had no length cap and accepted documents of any size.
- No indexes existed beyond the implicit `_id` and the existing `code` unique index.
- The booking flow could oversell.
- Reservations referenced trips only by `tripCode` (a string), so joins required a second query.

After (the main pieces of [`app_server/models/travlr.js`](https://github.com/sfazliddinov385/capstone_project/blob/main/app_server/models/travlr.js)):

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
  // ...
}, { timestamps: true });

tripSchema.index({ name: 'text', resort: 'text', description: 'text', code: 'text' });
tripSchema.index({ category: 1, perPerson: 1 });
tripSchema.index({ rating: -1, reviewCount: -1 });
```

And the headline of [`app_api/controllers/reservations.js`](https://github.com/sfazliddinov385/capstone_project/blob/main/app_api/controllers/reservations.js), the booking call:

```js
const trip = await Trip.findOneAndUpdate(
  { code: tripCode, spotsLeft: { $gte: numPeople } },
  { $inc: { spotsLeft: -numPeople } },
  { new: true, runValidators: true }
).exec();

if (!trip) return res.status(409).json({ message: 'Not enough spots are available for this trip' });
```

The predicate `spotsLeft: { $gte: numPeople }` is evaluated atomically by MongoDB as part of the update. If two requests for the last seat arrive at the same time, only one matches. The other is rejected with `409 Conflict`. The race goes away without a lock or a multi document transaction.

The compensation path follows in the `catch` block:

```js
catch (err) {
  if (reservedTripCode) {
    await Trip.updateOne({ code: reservedTripCode }, { $inc: { spotsLeft: reservedPeople } }).exec();
  }
  res.status(500).json({ message: err.message });
}
```

So even if the reservation document fails to save for some reason (validation, network blip, anything), the inventory we briefly held is returned.

### Specific skills demonstrated

- **Schema design.** Choosing typed, constrained fields over loose strings. Choosing where defaults belong. Choosing whether timestamps belong on a document.
- **Index design.** Picking indexes that match the workload of [Enhancement 2](enhancement-2-algorithms.html), so the trip list endpoint can serve the filter then sort path without a collection scan.
- **Concurrency control.** Using MongoDB's atomic update operators instead of inventing a fragile JavaScript lock.
- **Failure mode design.** Naming what could go wrong after the first write succeeded, and writing the inverse operation in the `catch` so partial failures heal themselves.
- **Migration safety.** The new fields (`role` on User, refined fields on Trip, `tripId` on Reservation) all have defaults or are populated by the controller, so existing seeded data does not need a separate migration script. The seed in `app_server/data/load-db.js` already produces the correct shape.

## 3. Reflect on the process of enhancing the artifact

### What I learned

The most valuable thing I took from this enhancement is the difference between "I read the value and then changed it" and "I changed the value if it still matched what I expected". The first is two operations and unsafe under concurrency. The second is one atomic operation and safe. MongoDB exposes this naturally through update filters. Once I started thinking in terms of "what is true at the moment of the write" rather than "what did I read a moment ago", a lot of the booking system anxiety went away.

I also learned to design indexes alongside the queries that need them, instead of waiting for a slow query in production. Without the `(category, perPerson)` index, the `?category=Diving&sort=price-asc` request from Enhancement 2 would have needed a collection scan plus an in memory sort. With the index, the same query is a bounded range scan.

A third lesson was about denormalization. The reservation document now stores `tripName`, `length`, `start`, `resort`, and `perPerson` directly. That looks like duplication at first, and it is, on purpose. A reservation is a record of what the customer agreed to. If the operator edits the trip later, the customer's receipt must not change. Storing the snapshot on the reservation is the right trade. Write time costs a few extra fields. Read time saves one join. Historical correctness is kept.

### Challenges I faced

The reservation update path was the trickiest. A customer can either increase or decrease their party size on an existing booking. Increasing means taking more seats, which must be the same atomic, conditional decrement as the initial booking. Decreasing means returning seats, which is unconditional. I branched on the sign of `peopleDelta` and wrote the same conditional `findOneAndUpdate` for the positive case so the oversell guard applies to edits too:

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

The second challenge was thinking about what should happen if the reservation document fails to save after a seat decrement. I added the compensation `catch` block. I also know that this is the layer where a multi document MongoDB transaction would be cleaner if the deployment is on a replica set. I noted that as future work rather than adding it now, since the compensation path is enough for the threat model and works on the default standalone MongoDB used in development.

### Incorporating feedback

A peer suggested I add a `bookedAt` field and an index on `(userId, bookedAt desc)` so that a customer's "my reservations" page can return the newest first list with no in memory sort. I added both. It shows up in the `getReservations` controller as `find(...).sort({ bookedAt: -1 })`. Backed by the compound index, that is a free sort instead of an O(n log n) operation.

### Course outcomes met

- **Outcome 2 (professional communications).** Schemas now declare what they accept. The documents the application stores are self describing.
- **Outcome 3 (algorithmic principles and trade offs).** Indexes were chosen with clear awareness of the query workload. Concurrency safety was achieved with atomic updates instead of locks. Denormalization is documented as a deliberate write vs read trade.
- **Outcome 4 (industry techniques).** Used Mongoose validation, MongoDB atomic operators, and compound indexing. Standard patterns that scale.
- **Outcome 5 (security mindset).** Closed a race condition vulnerability in the booking flow that could have allowed overselling. A concrete, exploitable bug, not a theoretical one.

---

[← Back to portfolio home](index.html)
