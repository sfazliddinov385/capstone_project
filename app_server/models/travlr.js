const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    length: { type: String, required: true, trim: true },
    start: { type: Date, required: true },
    resort: { type: String, required: true, trim: true, maxlength: 120 },
    perPerson: { type: Number, required: true, min: 0 },
    image: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
   
    category: {
        type: String,
        enum: ['Beach', 'Diving', 'Adventure', 'Luxury', 'Cultural', 'Cruise'],
        default: 'Beach',
        index: true
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Moderate', 'Challenging'],
        default: 'Easy'
    },
    rating: { type: Number, default: 4.5, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    departureCity: { type: String, default: 'New York (JFK)', trim: true },
    spotsLeft: { type: Number, default: 20, min: 0 },
    includes: { type: [String], default: [] }
}, { timestamps: true });

tripSchema.index({ name: 'text', resort: 'text', description: 'text', code: 'text' });
tripSchema.index({ category: 1, perPerson: 1 });
tripSchema.index({ rating: -1, reviewCount: -1 });

const Trip = mongoose.model('trips', tripSchema);

module.exports = Trip;
