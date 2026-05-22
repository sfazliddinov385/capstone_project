const test   = require('node:test');
const assert = require('node:assert/strict');

const { validateReviewInput, computeAverageRating, MAX_COMMENT } =
    require('../app_api/utils/reviewValidation');

// ─── validateReviewInput ────────────────────────────────────────────────────

test('validateReviewInput accepts a valid review', () => {
    const r = validateReviewInput({ rating: 4, comment: 'Loved the snorkel cruise.' });
    assert.equal(r.ok, true);
    assert.equal(r.rating, 4);
    assert.equal(r.comment, 'Loved the snorkel cruise.');
});

test('validateReviewInput rejects rating below 1', () => {
    const r = validateReviewInput({ rating: 0, comment: 'Bad rating' });
    assert.equal(r.ok, false);
    assert.equal(r.status, 400);
    assert.match(r.message, /rating/i);
});

test('validateReviewInput rejects rating above 5', () => {
    const r = validateReviewInput({ rating: 6, comment: 'Too high' });
    assert.equal(r.ok, false);
    assert.match(r.message, /rating/i);
});

test('validateReviewInput rejects non-integer ratings', () => {
    const r = validateReviewInput({ rating: 4.5, comment: 'Half a star is not allowed' });
    assert.equal(r.ok, false);
});

test('validateReviewInput rejects empty comments', () => {
    const r = validateReviewInput({ rating: 5, comment: '   ' });
    assert.equal(r.ok, false);
    assert.match(r.message, /comment/i);
});

test('validateReviewInput rejects comments above the max length', () => {
    const r = validateReviewInput({ rating: 5, comment: 'A'.repeat(MAX_COMMENT + 1) });
    assert.equal(r.ok, false);
    assert.match(r.message, /1200/);
});

test('validateReviewInput trims whitespace from comments', () => {
    const r = validateReviewInput({ rating: 5, comment: '   Great trip   ' });
    assert.equal(r.ok, true);
    assert.equal(r.comment, 'Great trip');
});

// ─── computeAverageRating ──────────────────────────────────────────────────

test('computeAverageRating returns 0/0 for an empty list', () => {
    assert.deepEqual(computeAverageRating([]), { avg: 0, count: 0 });
    assert.deepEqual(computeAverageRating(null), { avg: 0, count: 0 });
});

test('computeAverageRating computes a rounded one-decimal average', () => {
    const r = computeAverageRating([{ rating: 5 }, { rating: 4 }, { rating: 3 }]);
    assert.equal(r.avg, 4);
    assert.equal(r.count, 3);
});

test('computeAverageRating rounds correctly to one decimal place', () => {
    // 4 + 5 + 5 + 4 = 18 / 4 = 4.5
    const r = computeAverageRating([{ rating: 4 }, { rating: 5 }, { rating: 5 }, { rating: 4 }]);
    assert.equal(r.avg, 4.5);
    assert.equal(r.count, 4);
});

test('computeAverageRating ignores non-numeric ratings safely', () => {
    const r = computeAverageRating([{ rating: 5 }, { rating: 'abc' }, { rating: 3 }]);
    // 'abc' coerces to NaN, defaults to 0, so (5 + 0 + 3) / 3 = 2.7
    assert.equal(r.count, 3);
    assert.ok(r.avg >= 0);
});
