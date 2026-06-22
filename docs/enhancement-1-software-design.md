---
title: "Enhancement 1: Software Design and Engineering"
---

[← Back to portfolio home](index.html)

# Enhancement 1: Software Design and Engineering

**Category:** Software design and engineering
**Primary files changed:** `app_api/models/user.js`, `app_api/middleware/auth.js`, `app_api/routes/index.js`, `app_api/controllers/authentication.js`, `travlr-admin/src/app/authentication.service.ts`, `travlr-admin/src/app/app-routing-module.ts`
**Course outcomes addressed:** 1, 2, 4, 5

## 1. Briefly describe the artifact

The artifact is **Travlr Getaways**, a full stack travel booking application I first built in an earlier MEAN stack course in the SNHU Computer Science program. It has an Express plus Handlebars customer site, a MongoDB REST API, and an Angular 21 admin app. The original version was finished earlier in the program. The work shown here was done during CS 499 between March and May 2026.

## 2. Justify the inclusion of the artifact

I picked Travlr Getaways because it is a real three tier application, not a small exercise. It has a server rendered customer site, a JSON API, a separate admin client, and a NoSQL database. Showing that I can find a security flaw across all three tiers and fix it the same way in each one, without breaking the customer flow or the admin tools, is much closer to real engineering work than three unrelated small projects would be.

The pieces of this enhancement that show my software design skills are:

- Adding a typed `role` field on the User schema and putting it in the JWT payload. This shows clean identity modeling.
- Splitting `auth.js` into two single purpose middlewares. This shows the SOLID single responsibility principle applied to real Express code.
- Applying `authorizeAdmin` only to write routes and customer listings. This shows least privilege thinking at the route level.
- Enforcing the same rule in the Angular client. This shows that one authorization decision must be consistent everywhere it is surfaced.

### How the enhancement improved the artifact

In the original code, anyone with a valid JWT, even a brand new customer, could call `POST /api/trips`, `DELETE /api/trips/:code`, or `GET /api/customers`. The token only answered "are you logged in" and never "are you allowed to do this". That is the OWASP A01:2021 broken access control finding, and it was the worst issue I found during the code review.

The enhancement closes the gap from front to back:

1. **User model.** Added `role: { type: String, enum: ['customer','admin'], default: 'customer' }` to `userSchema` in [`app_api/models/user.js`](https://github.com/sfazliddinov385/capstone_project/blob/main/app_api/models/user.js). Put the role into the JWT payload made by `generateJwt`, along with the existing `_id`, `email`, `name`, and `exp` claims.
2. **Middleware separation.** Rewrote [`app_api/middleware/auth.js`](https://github.com/sfazliddinov385/capstone_project/blob/main/app_api/middleware/auth.js) so that `authenticate` only verifies the bearer token and saves the decoded payload to `req.user`. A new `authorizeAdmin` checks the role claim and returns `403 Forbidden` if it is missing or not `'admin'`. Both fail closed. If `JWT_SECRET` is not set, `authenticate` returns `500` instead of silently signing with `undefined`.
3. **Route composition.** In [`app_api/routes/index.js`](https://github.com/sfazliddinov385/capstone_project/blob/main/app_api/routes/index.js), applied the chain `authenticate, authorizeAdmin` to the four routes that need it: `POST /api/trips`, `PUT /api/trips/:tripCode`, `DELETE /api/trips/:tripCode`, and `GET /api/customers`. Public reads stayed public. Customer reservation routes stayed at `authenticate` only, because a logged in customer must be able to view and manage their own bookings.
4. **Client side mirroring.** Updated [`travlr-admin/src/app/authentication.service.ts`](https://github.com/sfazliddinov385/capstone_project/blob/main/travlr-admin/src/app/authentication.service.ts) to decode the JWT, expose `isLoggedIn()` and `isAdmin()`, and hide trip management and customer list controls from non admin sessions. Updated `AuthGuard` to also redirect non admin users away from admin only routes.

### Specific skills demonstrated

- Changing a Mongoose schema without breaking existing documents. The new `role` field defaults to `customer` for previously registered users.
- JWT claim design. Choosing which identity facts belong inside the token and which should be re fetched.
- Express middleware composition with `router.METHOD(path, ...middlewares, controller)`.
- Angular service design and JWT decoding in TypeScript without pulling in a JWT library, using `atob` on the middle segment.
- Cross tier consistency. The same rule is enforced server side (returns 403) and shown client side (hides the button), so the UI matches the API.

## 3. Reflect on the process of enhancing the artifact

### What I learned

The biggest lesson here was the difference between authentication and authorization. They sound like two halves of one word, but they are two different jobs, and mixing them up is one of the easier ways to ship an OWASP top 10 bug. Once I split `auth.js` into `authenticate` and `authorizeAdmin`, the file `app_api/routes/index.js` almost reads itself. I can scan it and see which endpoints need login alone, which need admin, and which are public.

A second lesson was the value of mirroring server side rules on the client. An attacker can hit `POST /api/trips` directly with `curl` no matter what the Angular client shows. But a real user who sees an "Add Trip" button that then returns 403 is confused. Hiding admin controls in the SPA is not a security control. The server check is. But it is a UX control that pairs with the security control.

### Challenges I faced

The trickiest piece was the JWT secret. In the original code, `generateJwt` read `process.env.JWT_SECRET` directly. `jwt.sign(payload, undefined)` would silently produce tokens that nobody could verify. I thought about hardcoding a dev fallback but decided that would hide misconfiguration in deployment. I went with failing closed. The User model now throws if `JWT_SECRET` is missing, and the `authenticate` middleware returns `500` instead of `401` so the operator sees the misconfiguration.

Another challenge was the Angular client. Angular's newer standalone routing and the older module routing in this codebase differ in how guards are wired. I had to look at `app-routing-module.ts` to confirm the guard was applied. I also had to make sure the JWT decoding in `authentication.service.ts` would not throw on a missing or malformed token. That is why I wrapped `JSON.parse(atob(...))` in a `try/catch`.

### Incorporating feedback

During code review, a peer asked why I did not combine `authenticate` and `authorizeAdmin` into one `requireAdmin` function. I kept them separate, and the feedback pushed me to write down why. Keeping them separate means I can later add `requireOwner` or `requireRole('staff')` without copying the token check. The single responsibility principle was worth the slightly longer chain in the route file.

### Course outcomes met

- **Outcome 1 (collaborative environments and diverse audiences).** The narrative, code review, and the named middleware make the model clear to both an engineer and a non technical reviewer.
- **Outcome 2 (professional communications).** Code is organized so `routes/index.js` reads top to bottom as a public then protected manifest. Names like `authenticate`, `authorizeAdmin`, `isAdmin`, `getPayload` show intent without needing comments.
- **Outcome 4 (innovative techniques and tools).** Used JWT claims instead of a session table, kept secrets out of code, and used standard Express middleware instead of a custom framework.
- **Outcome 5 (security mindset).** Closed a broken access control bug, checked `JWT_SECRET` at the boundary, applied least privilege at the route level, and used `crypto.timingSafeEqual` for credential comparison.

Outcome 3 (algorithmic principles) is covered mainly in [Enhancement 2](enhancement-2-algorithms.html).

---

[← Back to portfolio home](index.html) · [Continue to Enhancement 2 →](enhancement-2-algorithms.html)
