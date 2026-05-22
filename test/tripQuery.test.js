const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTripListOptions, toIncludesArray, tripPayloadFromBody } = require('../app_api/utils/tripQuery');

test('buildTripListOptions builds search, exact filters, price bounds, sort, and limit', () => {
  const options = buildTripListOptions({
    q: 'reef',
    category: 'Diving',
    difficulty: 'Moderate',
    maxPrice: '3200',
    sort: 'price-asc',
    limit: '12'
  });

  assert.equal(options.filter.category, 'Diving');
  assert.equal(options.filter.difficulty, 'Moderate');
  assert.deepEqual(options.filter.perPerson, { $lte: 3200 });
  assert.deepEqual(options.sort, { perPerson: 1, name: 1 });
  assert.equal(options.limit, 12);
  assert.equal(options.filter.$or.length, 4);
});

test('buildTripListOptions ignores unsafe or invalid numeric input', () => {
  const options = buildTripListOptions({
    q: 'Reef.*',
    minPrice: '-20',
    maxPrice: 'not-a-number',
    minSpots: '3',
    sort: 'unknown',
    limit: '1000'
  });

  assert.equal(options.filter.perPerson, undefined);
  assert.deepEqual(options.filter.spotsLeft, { $gte: 3 });
  assert.deepEqual(options.sort, { rating: -1, reviewCount: -1, name: 1 });
  assert.equal(options.limit, 100);
  assert.match(String(options.filter.$or[0].code), /Reef\\\.\\\*/);
});

test('tripPayloadFromBody normalizes fields for persistence', () => {
  const payload = tripPayloadFromBody({
    code: ' reef210214 ',
    name: '  Gale Reef  ',
    perPerson: '2199.50',
    includes: 'Flights, Hotel, Daily dives'
  });

  assert.equal(payload.code, 'REEF210214');
  assert.equal(payload.name, 'Gale Reef');
  assert.equal(payload.perPerson, 2199.5);
  assert.deepEqual(payload.includes, ['Flights', 'Hotel', 'Daily dives']);
});

test('toIncludesArray accepts arrays and removes blank values', () => {
  assert.deepEqual(toIncludesArray([' Flights ', '', 'Meals']), ['Flights', 'Meals']);
});
