const Reservation = require('../models/reservation');
const Trip        = require('../../app_server/models/travlr');
const emailSvc    = require('../services/email');

// GET /api/reservations. List the signed-in user's reservations.
const getReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find({ userId: req.user._id }).sort({ bookedAt: -1 });
        res.status(200).json(reservations);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/reservations. Book a trip for the signed-in user.
const createReservation = async (req, res) => {
    let reservedTripCode = null;
    let reservedPeople = 0;

    try {
        const { tripCode, people } = req.body;
        if (typeof tripCode !== 'string' || !tripCode.trim()) {
            return res.status(400).json({ message: 'tripCode is required' });
        }

        const numPeople = parseInt(people, 10);
        if (!numPeople || numPeople < 1 || numPeople > 20) {
            return res.status(400).json({ message: 'Number of people must be between 1 and 20' });
        }

        const existingTrip = await Trip.findOne({ code: tripCode }).select('code spotsLeft start').exec();
        if (!existingTrip) {
            return res.status(404).json({ message: 'Trip not found' });
        }

        // Refuse to book a trip whose start date is already in the past.
        if (existingTrip.start && new Date(existingTrip.start).getTime() < Date.now()) {
            return res.status(400).json({ message: 'This trip has already departed' });
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

        // Fire off the confirmation email. Do not wait, and do not fail the request if it errors.
        emailSvc.sendReservationConfirmation(
            req.user.email,
            req.user.name,
            reservation
        ).catch(err => console.error('Email send error:', err.message));

        res.status(201).json(reservation);
    } catch (err) {
        if (reservedTripCode) {
            // Put the seats we took back. If the rollback itself fails, we
            // must not let that error bubble up. If it did, we would lose the
            // original error and the request would hang. Log it loudly so a
            // person can fix the count by hand.
            try {
                await Trip.updateOne({ code: reservedTripCode }, { $inc: { spotsLeft: reservedPeople } }).exec();
            } catch (rollbackErr) {
                console.error(
                    'CRITICAL: reservation compensation rollback failed.',
                    'tripCode=' + reservedTripCode,
                    'people=' + reservedPeople,
                    'userId=' + (req.user && req.user._id),
                    'originalError=' + err.message,
                    'rollbackError=' + rollbackErr.message
                );
            }
        }
        console.error('createReservation error:', err);
        res.status(500).json({ message: 'Unable to create reservation' });
    }
};

// DELETE /api/reservations/:id. Cancel one of the user's reservations.
const deleteReservation = async (req, res) => {
    try {
        const reservation = await Reservation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found' });
        }

        const { tripCode, people } = reservation;
        await reservation.deleteOne();

        try {
            await Trip.updateOne(
                { code: tripCode },
                { $inc: { spotsLeft: people } }
            ).exec();
        } catch (restoreErr) {
            console.error(
                'CRITICAL: cancellation seat restore failed.',
                'tripCode=' + tripCode,
                'people=' + people,
                'userId=' + (req.user && req.user._id),
                'error=' + restoreErr.message
            );
        }

        res.status(200).json({ message: 'Reservation cancelled' });
    } catch (err) {
        console.error('deleteReservation error:', err);
        res.status(500).json({ message: 'Unable to cancel reservation' });
    }
};

// PUT /api/reservations/:id. Change the traveler count on an existing booking.
const updateReservation = async (req, res) => {
    let seatsReserved = 0;
    let seatsRefunded = 0;
    let trackedTripCode = null;

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

        trackedTripCode = reservation.tripCode;
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
            seatsReserved = peopleDelta;
        } else if (peopleDelta < 0) {
            await Trip.updateOne(
                { code: reservation.tripCode },
                { $inc: { spotsLeft: Math.abs(peopleDelta) } }
            ).exec();
            seatsRefunded = Math.abs(peopleDelta);
        }

        const pricePerPerson = Number(reservation.perPerson) || 0;
        reservation.people     = numPeople;
        reservation.totalPrice = pricePerPerson * numPeople;
        await reservation.save();

        res.status(200).json(reservation);
    } catch (err) {
        // Compensation rollback. If we took or refunded seats but the
        // reservation document did not save, put the trip inventory back
        // where it was so we do not leak or steal seats.
        if (trackedTripCode && (seatsReserved > 0 || seatsRefunded > 0)) {
            const delta = seatsReserved - seatsRefunded;
            try {
                await Trip.updateOne(
                    { code: trackedTripCode },
                    { $inc: { spotsLeft: delta } }
                ).exec();
            } catch (rollbackErr) {
                console.error(
                    'CRITICAL: updateReservation rollback failed.',
                    'tripCode=' + trackedTripCode,
                    'delta=' + delta,
                    'userId=' + (req.user && req.user._id),
                    'originalError=' + err.message,
                    'rollbackError=' + rollbackErr.message
                );
            }
        }
        console.error('updateReservation error:', err);
        res.status(500).json({ message: 'Unable to update reservation' });
    }
};

module.exports = { getReservations, createReservation, deleteReservation, updateReservation };
