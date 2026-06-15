/**
 * Validation helpers for customer reviews.
 *
 * The shape of the check:
 *   Parse the rating as a number. Trim the comment.
 *   If the rating is not a whole number between 1 and 5, fail.
 *   If the comment is too short, fail.
 *   If the comment is too long, fail.
 *   Otherwise pass.
 *
 * I keep these rules in one small function. That way the HTTP controller
 * stays simple, the rules are easy to unit test, and the admin SPA and
 * public pages cannot drift from what the API expects.
 */

const MIN_RATING  = 1;
const MAX_RATING  = 5;
const MIN_COMMENT = 4;
const MAX_COMMENT = 1200;

/**
 * Check the review input. Return a small object with the result.
 * @param {Object} raw  The request body. Has rating and comment.
 * @returns {{ ok: true, rating: number, comment: string }
 *          | { ok: false, status: number, message: string }}
 */
function validateReviewInput(raw = {}) {
    // Use Number, not parseInt. parseInt turns 4.5 into 4 without saying so.
    // That would let half-star ratings through as if they were whole numbers.
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
 * Get the average rating from a list of reviews, rounded to one decimal.
 * Returns 0 if there are no reviews. The caller can use the same code path
 * either way.
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
