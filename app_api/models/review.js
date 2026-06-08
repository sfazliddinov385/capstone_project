const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userName:  { type: String, required: true, trim: true },
    tripCode:  { type: String, required: true, trim: true, uppercase: true, index: true },
    tripName:  { type: String, required: true, trim: true },
    rating:    { type: Number, required: true, min: 1, max: 5 },
    comment:   { type: String, required: true, trim: true, minlength: 4, maxlength: 1200 },

    // Operator response. An admin can write one reply per review which the
    // customer site shows directly below the original review. Clearing
    // adminReply (setting it to empty string) removes the response.
    adminReply:       { type: String, trim: true, maxlength: 1000, default: '' },
    adminReplyAt:     { type: Date },
    adminReplyByName: { type: String, trim: true, maxlength: 80 }
}, { timestamps: true });

// One review per user per trip.
reviewSchema.index({ userId: 1, tripCode: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
