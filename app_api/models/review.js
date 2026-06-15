const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName:  { type: String, required: true, trim: true },
    tripCode:  { type: String, required: true, trim: true, uppercase: true, index: true },
    tripName:  { type: String, required: true, trim: true },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    comment:   { type: String, required: true, trim: true, minlength: 4, maxlength: 1200 },

    // Team reply. An admin can write one reply per review. The customer
    // site shows it right below the original review. Setting adminReply
    // to an empty string removes the reply.
    adminReply:       { type: String, trim: true, maxlength: 1000, default: '' },
    adminReplyAt:     { type: Date },
    adminReplyByName: { type: String, trim: true, maxlength: 80 }
}, { timestamps: true });

// One review per user per trip.
// This unique index makes it true at the database level.
reviewSchema.index({ userId: 1, tripCode: 1 }, { unique: true });

// Text index so admin search on the reviews table does not need a full
// collection scan and a regex per row.
reviewSchema.index({ tripName: 'text', comment: 'text', userName: 'text' });

module.exports = mongoose.model('Review', reviewSchema);
