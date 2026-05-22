// This file helps build filters, sorting, and data for trips.

const SORTS = {
  // Default sorting: best rated trips first.
  featured: { rating: -1, reviewCount: -1, name: 1 },

  // Sort by lowest price first.
  'price-asc': { perPerson: 1, name: 1 },

  // Sort by highest price first.
  'price-desc': { perPerson: -1, name: 1 },

  // Sort by rating.
  rating: { rating: -1, reviewCount: -1 },

  // Sort by most reviews.
  reviews: { reviewCount: -1, rating: -1 },

  // Sort by spots left.
  spots: { spotsLeft: 1, name: 1 },

  // Sort by start date.
  start: { start: 1, name: 1 }
};

// These fields need an exact match when filtering.
const exactMatchFields = ['category', 'difficulty', 'departureCity'];

// This makes user search text safe before using it in a regular expression.
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// This turns a value into a number only if it is valid and not negative.
const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

// This limits how many trips can be returned.
// It prevents users from requesting too many results at once.
const clampLimit = (value, fallback = 100, max = 100) => {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
};

// This builds the filter, sort, and limit options for the trip list.
const buildTripListOptions = (query = {}) => {
  const filter = {};

  // If the user searches with q, search in code, name, resort, and description.
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

  // Add filters like category, difficulty, and departure city.
  exactMatchFields.forEach((field) => {
    const value = typeof query[field] === 'string' ? query[field].trim() : '';
    if (value && value.toLowerCase() !== 'all') {
      filter[field] = value;
    }
  });

  // Add minimum and maximum price filters if they are provided.
  const minPrice = parsePositiveNumber(query.minPrice);
  const maxPrice = parsePositiveNumber(query.maxPrice);
  if (minPrice !== null || maxPrice !== null) {
    filter.perPerson = {};
    if (minPrice !== null) filter.perPerson.$gte = minPrice;
    if (maxPrice !== null) filter.perPerson.$lte = maxPrice;
  }

  // Add a minimum spots-left filter if it is provided.
  const minSpots = parsePositiveNumber(query.minSpots);
  if (minSpots !== null) {
    filter.spotsLeft = { $gte: minSpots };
  }

  // Use the selected sort option, or use featured as the default.
  const sort = SORTS[query.sort] || SORTS.featured;

  // Limit how many trips are returned.
  const limit = clampLimit(query.limit);

  return { filter, sort, limit };
};

// This turns includes into an array.
// It supports both arrays and comma-separated strings.
const toIncludesArray = (includes) => {
  if (Array.isArray(includes)) {
    return includes.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof includes === 'string') {
    return includes.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

// This prepares trip data from the request body before saving it.
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
  rating: Number(body.rating ?? 4.5),
  reviewCount: Number(body.reviewCount ?? 0),
  departureCity: String(body.departureCity || 'New York (JFK)').trim(),
  spotsLeft: Number(body.spotsLeft ?? 20),
  includes: toIncludesArray(body.includes)
});

// Export the helper functions so other files can use them.
module.exports = {
  buildTripListOptions,
  tripPayloadFromBody,
  toIncludesArray
};