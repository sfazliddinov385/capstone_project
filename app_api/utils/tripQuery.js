// Helpers that build filters, sort order, and limits for the trip list.

const SORTS = {
  // Default. Best rated trips first.
  featured: { rating: -1, reviewCount: -1, name: 1 },

  // Cheapest first.
  'price-asc': { perPerson: 1, name: 1 },

  // Most expensive first.
  'price-desc': { perPerson: -1, name: 1 },

  // Highest rated first.
  rating: { rating: -1, reviewCount: -1 },

  // Most reviewed first.
  reviews: { reviewCount: -1, rating: -1 },

  // Fewest seats left first.
  spots: { spotsLeft: 1, name: 1 },

  // Earliest start date first.
  start: { start: 1, name: 1 }
};

// These fields use an exact match when filtering.
const exactMatchFields = ['category', 'difficulty', 'departureCity'];

// Escape regex specials in user search text so it cannot break the engine.
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Turn a value into a number. Reject anything that is not a real positive number.
const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

// Cap how many trips we return so nobody can ask for thousands at once.
const clampLimit = (value, fallback = 100, max = 100) => {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
};

// Build the filter, sort, and limit for the trip list query.
const buildTripListOptions = (query = {}) => {
  const filter = {};

  // If the user passed q, search in code, name, resort, and description.
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q) {
    const safe = new RegExp(escapeRegExp(q), 'i');
    filter.$or = [
      { code: safe },
      { name: safe },
      { resort: safe },
      { description: safe }
    ];
  }

  // Add exact-match filters like category, difficulty, and departure city.
  exactMatchFields.forEach((field) => {
    const value = typeof query[field] === 'string' ? query[field].trim() : '';
    if (value && value.toLowerCase() !== 'all') {
      filter[field] = value;
    }
  });

  // Add min and max price if either is set.
  const minPrice = parsePositiveNumber(query.minPrice);
  const maxPrice = parsePositiveNumber(query.maxPrice);
  if (minPrice !== null || maxPrice !== null) {
    filter.perPerson = {};
    if (minPrice !== null) filter.perPerson.$gte = minPrice;
    if (maxPrice !== null) filter.perPerson.$lte = maxPrice;
  }

  // Add a "at least N seats left" filter if set.
  const minSpots = parsePositiveNumber(query.minSpots);
  if (minSpots !== null) {
    filter.spotsLeft = { $gte: minSpots };
  }

  // Pick the sort key. Default to featured.
  const sort = SORTS[query.sort] || SORTS.featured;

  // Cap how many results we send back.
  const limit = clampLimit(query.limit);

  return { filter, sort, limit };
};

// Turn includes into an array. Accept either an array or a comma list string.
const toIncludesArray = (includes) => {
  if (Array.isArray(includes)) {
    return includes.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof includes === 'string') {
    return includes.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

// Build a clean trip object from the request body before we save it.
// Rating and reviewCount are deliberately NOT taken from the body. They
// are computed by refreshTripRating from the real reviews. Accepting them
// here would let an admin (or a forged admin request) set any number they
// want, which would corrupt the recommendation and sort logic.
const tripPayloadFromBody = (body = {}) => ({
  code: String(body.code || '').trim().toUpperCase(),
  name: String(body.name || '').trim(),
  length: String(body.length || '').trim(),
  start: body.start,
  resort: String(body.resort || '').trim(),
  perPerson: Number(body.perPerson),
  image: String(body.image || '').trim(),
  description: String(body.description || '').trim(),
  category: String(body.category || 'Beach').trim(),
  difficulty: String(body.difficulty || 'Easy').trim(),
  departureCity: String(body.departureCity || 'New York (JFK)').trim(),
  spotsLeft: Number(body.spotsLeft ?? 20),
  includes: toIncludesArray(body.includes)
});

// Make the helpers available to other files.
module.exports = {
  buildTripListOptions,
  tripPayloadFromBody,
  toIncludesArray
};