const Reservation = require('../models/reservation');
const Trip        = require('../../app_server/models/travlr');
const emailSvc    = require('../services/email');

// GET /api/reservations — return all reservations for the logged-in user
const getReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find({ userId: req.user._id }).sort({ bookedAt: -1 });
        res.status(200).json(reservations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/reservations — book a trip for the logged-in user
const createReservation = async (req, res) => {
    let reservedTripCode = null;
    let reservedPeople = 0;

    try {
        const { tripCode, people } = req.body;
        if (!tripCode) {
            return res.status(400).json({ message: 'tripCode is required' });
        }

        const numPeople = parseInt(people, 10) || 1;
        if (numPeople < 1 || numPeople > 20) {
            return res.status(400).json({ message: 'Number of people must be between 1 and 20' });
        }

        const existingTrip = await Trip.findOne({ code: tripCode }).select('code spotsLeft').exec();
        if (!existingTrip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        const trip = await Trip.findOneAndUpdate(
            { code: tripCode, spotsLeft: { $gte: numPeople } },
            { $inc: { spotsLeft: -numPeople } },
            { new: true, runValidators: true }
        ).exec();

        if (!trip) {
            return res.status(409).json({ message: 'Not enough spots are available for this trip' });
        }

        reservedTripCode = trip.code;
        reservedPeople = numPeople;

        const pricePerPerson = Number(trip.perPerson) || 0;
        const totalPrice = pricePerPerson * numPeople;

        const reservation = await Reservation.create({
            userId:     req.user._id,
            tripId:     trip._id,
            tripCode:   trip.code,
            tripName:   trip.name,
            length:     trip.length,
            start:      trip.start,
            resort:     trip.resort,
            perPerson:  trip.perPerson,
            people:     numPeople,
            totalPrice: totalPrice
        });

        // Send confirmation email (non-blocking — don't fail the request if email fails)
        emailSvc.sendReservationConfirmation(
            req.user.email,
            req.user.name,
            reservation
        ).catch(err => console.error('Email send error:', err.message));

        res.status(201).json(reservation);
    } catch (err) {
        if (reservedTripCode) {
            await Trip.updateOne({ code: reservedTripCode }, { $inc: { spotsLeft: reservedPeople } }).exec();
        }
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/reservations/:id — cancel a reservation for the logged-in user
const deleteReservation = async (req, res) => {
    try {
        const reservation = await Reservation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found' });
        }
        await reservation.deleteOne();
        await Trip.updateOne(
            { code: reservation.tripCode },
            { $inc: { spotsLeft: reservation.people } }
        ).exec();
        res.status(200).json({ message: 'Reservation cancelled' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/reservations/:id — update people count on an existing reservation
const updateReservation = async (req, res) => {
    try {
        const { people } = req.body;
        const numPeople  = parseInt(people, 10);
        if (!numPeople || numPeople < 1 || numPeople > 20) {
            return res.status(400).json({ message: 'Number of people must be between 1 and 20' });
        }

        const reservation = await Reservation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found' });
        }

        const peopleDelta = numPeople - reservation.people;
        if (peopleDelta > 0) {
            const trip = await Trip.findOneAndUpdate(
                { code: reservation.tripCode, spotsLeft: { $gte: peopleDelta } },
                { $inc: { spotsLeft: -peopleDelta } },
                { new: true, runValidators: true }
            ).exec();

            if (!trip) {
                return res.status(409).json({ message: 'Not enough spots are available for this trip' });
            }
        } else if (peopleDelta < 0) {
            await Trip.updateOne(
                { code: reservation.tripCode },
                { $inc: { spotsLeft: Math.abs(peopleDelta) } }
            ).exec();
        }

        const pricePerPerson = Number(reservation.perPerson) || 0;
        reservation.people     = numPeople;
        reservation.totalPrice = pricePerPerson * numPeople;
        await reservation.save();

        res.status(200).json(reservation);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getReservations, createReservation, deleteReservation, updateReservation };
