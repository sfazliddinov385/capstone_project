const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tripCode: { type: String, required: true, trim: true, uppercase: true }
}, { timestamps: true });

// One row per user and trip. Fast lookups. No duplicates.
favoriteSchema.index({ userId: 1, tripCode: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
