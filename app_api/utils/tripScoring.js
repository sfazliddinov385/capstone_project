/**
 * Pure scoring helpers for the "similar trips" recommendation.
 *
 * ─── Pseudocode ─────────────────────────────────────────────────────────────
 *   for each candidate trip C ≠ source S:
 *       score = 0
 *       if S.category exists AND C.category == S.category:   score += 2
 *       if C.price is within ±PRICE_BAND of S.price:         score += 1
 *   sort candidates by score DESC, then by rating DESC
 *   return first N
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The function is intentionally pure (no I/O, no Mongoose) so the
 * recommendation logic can be unit-tested without a database. The controller
 * is responsible for fetching candidates and then handing them here.
 */

const PRICE_BAND      = 0.30;   // ±30% of the reference price counts as "close"
const SAME_CATEGORY   = 2;      // category match is worth twice a price match
const PRICE_NEAR      = 1;
const DEFAULT_RESULTS = 4;

/**
 * Score one candidate against the reference trip.
 * @param {Object} source     The trip the user is viewing.
 * @param {Object} candidate  Another trip to score.
 * @returns {number}  Non-negative integer score.
 */
function scoreTrip(source, candidate) {
    if (!source || !candidate) return 0;
    let score = 0;
    if (source.category && candidate.category && source.category === candidate.category) {
        score += SAME_CATEGORY;
    }
    const sPrice = Number(source.perPerson) || 0;
    const cPrice = Number(candidate.perPerson) || 0;
    if (sPrice > 0 && cPrice >= sPrice * (1 - PRICE_BAND) && cPrice <= sPrice * (1 + PRICE_BAND)) {
        score += PRICE_NEAR;
    }
    return score;
}

/**
 * Rank a list of candidate trips against a source trip and return the top N.
 * Ties are broken by `rating` (higher first). The source itself is filtered out
 * by `code` so callers can pass the full collection.
 *
 * @param {Object}   source        The reference trip.
 * @param {Object[]} candidates    Pool of trips to choose from.
 * @param {number}   [limit]       How many similar trips to return (default 4).
 * @returns {Object[]}  Top-N candidates (no internal scoring field exposed).
 */
function rankSimilarTrips(source, candidates, limit = DEFAULT_RESULTS) {
    if (!source || !Array.isArray(candidates)) return [];

    const ranked = candidates
        .filter(c => c && c.code !== source.code)
        .map(c => ({ trip: c, score: scoreTrip(source, c) }));

    ranked.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (Number(b.trip.rating) || 0) - (Number(a.trip.rating) || 0);
    });

    return ranked.slice(0, Math.max(0, limit)).map(r => r.trip);
}

module.exports = { scoreTrip, rankSimilarTrips, PRICE_BAND, SAME_CATEGORY, PRICE_NEAR };
