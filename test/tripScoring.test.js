const test   = require('node:test');
const assert = require('node:assert/strict');

const { scoreTrip, rankSimilarTrips } = require('../app_api/utils/tripScoring');

// ─── scoreTrip ──────────────────────────────────────────────────────────────

test('scoreTrip awards 2 for matching category', () => {
    const s = { category: 'Beach', perPerson: 1000 };
    const c = { category: 'Beach', perPerson: 9999 };
    assert.equal(scoreTrip(s, c), 2);
});

test('scoreTrip awards 1 for price within ±30%', () => {
    const s = { category: 'Beach',     perPerson: 1000 };
    const c = { category: 'Adventure', perPerson: 1200 }; // +20%
    assert.equal(scoreTrip(s, c), 1);
});

test('scoreTrip awards 3 (category + price) when both match', () => {
    const s = { category: 'Beach', perPerson: 1000 };
    const c = { category: 'Beach', perPerson: 950 };
    assert.equal(scoreTrip(s, c), 3);
});

test('scoreTrip awards 0 when categories differ and price is far apart', () => {
    const s = { category: 'Beach',     perPerson: 1000 };
    const c = { category: 'Adventure', perPerson: 5000 };
    assert.equal(scoreTrip(s, c), 0);
});

test('scoreTrip handles missing or zero price safely', () => {
    const s = { category: 'Beach', perPerson: 0 };
    const c = { category: 'Beach', perPerson: 1000 };
    assert.equal(scoreTrip(s, c), 2); // category still matches; price band skipped
});

// ─── rankSimilarTrips ──────────────────────────────────────────────────────

test('rankSimilarTrips filters out the source trip by code', () => {
    const source = { code: 'AAA', category: 'Beach', perPerson: 1000 };
    const result = rankSimilarTrips(source, [
        { code: 'AAA', category: 'Beach', perPerson: 1000 },  // same as source
        { code: 'BBB', category: 'Beach', perPerson: 1000 }
    ], 4);
    assert.equal(result.length, 1);
    assert.equal(result[0].code, 'BBB');
});

test('rankSimilarTrips orders by score desc, ties broken by rating', () => {
    const source = { code: 'AAA', category: 'Beach', perPerson: 1000 };
    const result = rankSimilarTrips(source, [
        { code: 'X', category: 'Beach',     perPerson: 1000, rating: 4.0 },  // score 3
        { code: 'Y', category: 'Beach',     perPerson: 9999, rating: 4.9 },  // score 2
        { code: 'Z', category: 'Adventure', perPerson: 1000, rating: 4.7 },  // score 1
        { code: 'W', category: 'Beach',     perPerson: 1000, rating: 4.8 }   // score 3 (higher rating than X)
    ], 4);
    assert.deepEqual(result.map(r => r.code), ['W', 'X', 'Y', 'Z']);
});

test('rankSimilarTrips respects the limit', () => {
    const source = { code: 'A', category: 'Beach', perPerson: 1000 };
    const candidates = Array.from({ length: 10 }, (_, i) => ({
        code:      'C' + i,
        category:  'Beach',
        perPerson: 1000,
        rating:    4 + i / 10
    }));
    const result = rankSimilarTrips(source, candidates, 3);
    assert.equal(result.length, 3);
});

test('rankSimilarTrips returns [] for missing or invalid input', () => {
    assert.deepEqual(rankSimilarTrips(null, []), []);
    assert.deepEqual(rankSimilarTrips({ code: 'A' }, null), []);
});

test('rankSimilarTrips does not leak the internal _score field', () => {
    const source = { code: 'A', category: 'Beach', perPerson: 1000 };
    const out = rankSimilarTrips(source, [{ code: 'B', category: 'Beach', perPerson: 1000 }]);
    assert.equal(Object.prototype.hasOwnProperty.call(out[0], '_score'), false);
});
