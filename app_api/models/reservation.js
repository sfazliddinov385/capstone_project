const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tripId:    { type: mongoose.Schema.Types.ObjectId, ref: 'trips', required: true },
    tripCode:  { type: String, required: true, trim: true, uppercase: true },
    tripName:  { type: String, required: true, trim: true },
    length:    { type: String },
    start:     { type: Date },
    resort:    { type: String },
    perPerson: { type: Number, min: 0 },
    people:     { type: Number, default: 1, min: 1, max: 20 },
    totalPrice: { type: Number, default: 0, min: 0 },
    bookedAt:   { type: Date, default: Date.now }
}, { timestamps: true });

reservationSchema.index({ userId: 1, bookedAt: -1 });
reservationSchema.index({ tripCode: 1, bookedAt: -1 });

module.exports = mongoose.model('Reservation', reservationSchema);
