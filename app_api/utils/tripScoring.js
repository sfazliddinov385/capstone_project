/**
 * Score trips for the "similar trips" suggestion.
 *
 * The shape of the check:
 *   For each other trip:
 *     If the category matches, add 2 points.
 *     If the price is within the band, add 1 point.
 *   Sort by score, then by rating. Return the top N.
 *
 * No database calls here. That keeps it easy to unit test. The controller
 * loads the candidates and hands them in.
 */

const PRICE_BAND      = 0.30;   // Within 30% of the source price counts as close.
const SAME_CATEGORY   = 2;      // A category match is worth twice a price match.
const PRICE_NEAR      = 1;
const DEFAULT_RESULTS = 4;

/**
 * Score one candidate against the trip the user is viewing.
 * @param {Object} source     The trip the user is on.
 * @param {Object} candidate  Another trip to score.
 * @returns {number}  A score that is zero or higher.
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
 * Rank candidates against the source trip and return the top N.
 * Ties go to the higher rating. The source itself is removed by code,
 * so the caller can pass the whole collection.
 *
 * @param {Object}   source        The trip the user is on.
 * @param {Object[]} candidates    Trips to choose from.
 * @param {number}   [limit]       How many to return. Default is 4.
 * @returns {Object[]}  The top N trips. We do not expose the internal score.
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
