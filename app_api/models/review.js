const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName:  { type: String, required: true, trim: true },
    tripCode:  { type: String, required: true, trim: true, uppercase: true, index: true },
    tripName:  { type: String, required: true, trim: true },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    comment:   { type: String, required: true, trim: true, minlength: 4, maxlength: 1200 }
}, { timestamps: true });

// One review per user per trip.
reviewSchema.index({ userId: 1, tripCode: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
