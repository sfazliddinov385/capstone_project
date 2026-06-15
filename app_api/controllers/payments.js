const crypto      = require('crypto');
const Reservation = require('../models/reservation');
const emailSvc    = require('../services/email');

// Allowed card brand labels. Anything else is normalised to "Card".
const CARD_BRANDS = new Set(['Visa', 'Mastercard', 'Amex', 'Discover', 'Card']);

// Fee math has to match the rates shown on the checkout page.
const TAX_RATE        = 0.10;
const SERVICE_RATE    = 0.05;
const PROTECTION_PP   = 49;
const PENNY_TOLERANCE = 0.02;

// Build a short, readable receipt number: TG-yymmdd-XXXX.
// crypto.randomInt is preferred over Math.random because this id appears
// in the customer's email and we do not want predictable ids.
const buildReceiptNumber = () => {
    const d   = new Date();
    const yy  = String(d.getFullYear() % 100).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const dd  = String(d.getDate()).padStart(2, '0');
    const rnd = crypto.randomInt(0, 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return `TG-${yy}${mm}${dd}-${rnd}`;
};

// POST /api/payments/receipt. Email the signed-in user a single receipt
// summarising the trips they just booked.
//
// The endpoint does NOT trust the client for prices. It pulls the user's
// most recent reservations from the database, rebuilds totals from those
// rows, and emails the result. The body only tells us which reservations
// to include (by tripCode) plus how the user wants the card shown.
//
// The card number and CVV never reach this endpoint. Only the brand
// label and the last four digits are accepted so the receipt can show
// "Visa •••• 4242" without ever touching the real number.
const sendReceipt = async (req, res) => {
    try {
        const { items, cardBrand, cardLast4, wantsProtection } = req.body || {};

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'At least one trip is required to issue a receipt' });
        }
        if (items.length > 20) {
            return res.status(400).json({ message: 'Too many items on one receipt' });
        }

        // Normalise the requested trip codes.
        const requestedCodes = [];
        for (const it of items) {
            const code = String(it && it.tripCode || '').trim().slice(0, 20);
            if (!code) {
                return res.status(400).json({ message: 'Each item needs a tripCode' });
            }
            requestedCodes.push(code);
        }

        // Pull the most recent reservation per trip code, scoped to the
        // signed-in user. This is the source of truth, not the body.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const reservations = await Reservation.find({
            userId:   req.user._id,
            tripCode: { $in: requestedCodes },
            bookedAt: { $gte: since },
        }).sort({ bookedAt: -1 }).lean();

        // For each requested code, take the most recent matching reservation.
        // If a code is missing, the user is trying to receipt a trip they did
        // not actually book. Reject the whole request.
        const reservationByCode = new Map();
        for (const r of reservations) {
            if (!reservationByCode.has(r.tripCode)) {
                reservationByCode.set(r.tripCode, r);
            }
        }
        const missing = requestedCodes.filter((c) => !reservationByCode.has(c));
        if (missing.length) {
            return res.status(403).json({
                message: 'Receipt can only be issued for trips you have just booked.',
                missing,
            });
        }

        // Build the items list from the database, not the client body.
        const verifiedItems = requestedCodes.map((code) => {
            const r = reservationByCode.get(code);
            return {
                tripCode:  r.tripCode,
                tripName:  r.tripName,
                people:    Number(r.people)    || 0,
                perPerson: Number(r.perPerson) || 0,
            };
        });

        // Recompute the subtotal, taxes, and fees from the verified rows.
        const subtotal    = verifiedItems.reduce((s, it) => s + it.perPerson * it.people, 0);
        const totalPeople = verifiedItems.reduce((s, it) => s + it.people, 0);
        const taxes       = subtotal * TAX_RATE;
        const serviceFee  = subtotal * SERVICE_RATE;
        const protection  = wantsProtection ? PROTECTION_PP * totalPeople : 0;
        const grandTotal  = subtotal + taxes + serviceFee + protection;

        // Normalise the card brand to the allowed list.
        const brand = CARD_BRANDS.has(cardBrand) ? cardBrand : 'Card';
        const last4 = String(cardLast4 || '').replace(/\D/g, '').slice(-4) || '••••';

        const receiptNumber = buildReceiptNumber();

        // Fire the email. Do not wait. The receipt number still goes back
        // to the client even if the SMTP step is slow or unavailable.
        emailSvc.sendPaymentReceipt(req.user.email, req.user.name, {
            receiptNumber,
            items: verifiedItems,
            subtotal,
            taxes,
            serviceFee,
            protection,
            grandTotal,
            cardBrand: brand,
            cardLast4: last4,
            paidAt:    new Date(),
        }).catch((err) => console.error('Payment receipt email failed:', err.message));

        return res.status(200).json({
            receiptNumber,
            emailedTo:  req.user.email,
            subtotal:   round2(subtotal),
            taxes:      round2(taxes),
            serviceFee: round2(serviceFee),
            protection: round2(protection),
            grandTotal: round2(grandTotal),
        });
    } catch (err) {
        console.error('sendReceipt error:', err);
        return res.status(500).json({ message: 'Unable to issue receipt' });
    }
};

// Round to two decimals without exposing floating-point noise to the
// client. Keeps the JSON pretty without changing the math.
const round2 = (n) => Math.round(n * 100) / 100;

module.exports = { sendReceipt };
