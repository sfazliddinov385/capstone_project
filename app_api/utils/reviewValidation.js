/**
 * Pure validation helpers for customer-submitted reviews.
 *
 * ─── Pseudocode ─────────────────────────────────────────────────────────────
 *   validateReviewInput(raw):
 *       rating  = parseInteger(raw.rating)
 *       comment = trim(raw.comment ?? '')
 *
 *       if rating is not integer OR rating < MIN_RATING OR rating > MAX_RATING:
 *           return { ok: false, status: 400, message: 'Rating must be 1..5' }
 *       if length(comment) < MIN_LEN:
 *           return { ok: false, status: 400, message: 'Comment too short' }
 *       if length(comment) > MAX_LEN:
 *           return { ok: false, status: 400, message: 'Comment too long' }
 *
 *       return { ok: true, rating, comment }
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Centralising these rules in one pure function keeps the HTTP controller
 * thin, makes the rules unit-testable, and prevents the SPA and HBS views
 * from drifting from the API's expectations.
 */

const MIN_RATING  = 1;
const MAX_RATING  = 5;
const MIN_COMMENT = 4;
const MAX_COMMENT = 1200;

/**
 * Validate review input and return a structured result.
 * @param {Object} raw  Untrusted request body (rating, comment).
 * @returns {{ ok: true, rating: number, comment: string }
 *          | { ok: false, status: number, message: string }}
 */
function validateReviewInput(raw = {}) {
    // Use Number(), not parseInt() — parseInt silently truncates `4.5` to `4`,
    // which would let half-star ratings slip through as integers.
    const ratingNum = Number(raw.rating);
    const rating    = ratingNum;
    const comment   = String(raw.comment == null ? '' : raw.comment).trim();

    if (!Number.isInteger(ratingNum) || rating < MIN_RATING || rating > MAX_RATING) {
        return { ok: false, status: 400, message: `Rating must be an integer from ${MIN_RATING} to ${MAX_RATING}` };
    }
    if (comment.length < MIN_COMMENT) {
        return { ok: false, status: 400, message: `Comment must be at least ${MIN_COMMENT} characters` };
    }
    if (comment.length > MAX_COMMENT) {
        return { ok: false, status: 400, message: `Comment must be ${MAX_COMMENT} characters or fewer` };
    }

    return { ok: true, rating, comment };
}

/**
 * Compute the rounded average rating from a list of review documents.
 * Returns 0 when no reviews exist so callers can use a single code path.
 *
 * @param {{rating: number}[]} reviews
 * @returns {{ avg: number, count: number }}
 */
function computeAverageRating(reviews) {
    if (!Array.isArray(reviews) || reviews.length === 0) return { avg: 0, count: 0 };
    const total = reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
    return {
        avg:   Math.round((total / reviews.length) * 10) / 10,
        count: reviews.length
    };
}

module.exports = {
    validateReviewInput,
    computeAverageRating,
    MIN_RATING,
    MAX_RATING,
    MIN_COMMENT,
    MAX_COMMENT
};
