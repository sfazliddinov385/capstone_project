const crypto   = require('crypto');
const emailSvc = require('../services/email');

// Allowed card brand labels. Anything else is normalised to "Card".
const CARD_BRANDS = new Set(['Visa', 'Mastercard', 'Amex', 'Discover', 'Card']);

// Build a short, readable receipt number: TG-yymmdd-XXXX.
// XXXX is four characters of base32-style randomness so two receipts in
// the same second cannot collide. crypto.randomInt is preferred over
// Math.random because this id appears in the customer's email.
const buildReceiptNumber = () => {
    const d   = new Date();
    const yy  = String(d.getFullYear() % 100).padStart(2, '0');
    const mm  = String(d.getMonth() + 1).padStart(2, '0');
    const dd  = String(d.getDate()).padStart(2, '0');
    const rnd = crypto.randomInt(0, 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return `TG-${yy}${mm}${dd}-${rnd}`;
};

// POST /api/payments/receipt. Email the signed-in user a single receipt
// that summarises a checkout session. The body comes from the client and
// the server validates every field before it is rendered into the email.
//
// The card number and CVV are never sent to this endpoint. Only the brand
// label and the last four digits are accepted so the receipt can show
// "Visa •••• 4242" without ever touching the real number.
const sendReceipt = async (req, res) => {
    try {
        const {
            items, subtotal, taxes, serviceFee, protection, grandTotal,
            cardBrand, cardLast4,
        } = req.body || {};

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'At least one trip is required to issue a receipt' });
        }
        if (items.length > 20) {
            return res.status(400).json({ message: 'Too many items on one receipt' });
        }

        // Coerce every numeric field. Anything not finite or negative is
        // rejected. We never trust client-side math without checking.
        const nums = { subtotal, taxes, serviceFee, protection, grandTotal };
        for (const [key, val] of Object.entries(nums)) {
            const n = Number(val);
            if (!Number.isFinite(n) || n < 0) {
                return res.status(400).json({ message: `Invalid amount for ${key}` });
            }
            nums[key] = n;
        }

        // Validate each cart line.
        const cleanItems = items.map((it) => ({
            tripCode:  String(it.tripCode || '').slice(0, 20),
            tripName:  String(it.tripName || '').slice(0, 200),
            people:    Math.max(1, Math.min(20, parseInt(it.people, 10) || 1)),
            perPerson: Math.max(0, Number(it.perPerson) || 0),
        }));

        // Normalise the card brand to the allowed list.
        const brand  = CARD_BRANDS.has(cardBrand) ? cardBrand : 'Card';
        const last4  = String(cardLast4 || '').replace(/\D/g, '').slice(-4) || '••••';

        const receiptNumber = buildReceiptNumber();

        // Fire the email. Do not wait. The receipt number still goes back
        // to the client even if the SMTP step is slow or unavailable.
        emailSvc.sendPaymentReceipt(req.user.email, req.user.name, {
            receiptNumber,
            items: cleanItems,
            subtotal:   nums.subtotal,
            taxes:      nums.taxes,
            serviceFee: nums.serviceFee,
            protection: nums.protection,
            grandTotal: nums.grandTotal,
            cardBrand:  brand,
            cardLast4:  last4,
            paidAt:     new Date(),
        }).catch((err) => console.error('Payment receipt email failed:', err.message));

        return res.status(200).json({
            receiptNumber,
            emailedTo: req.user.email,
        });
    } catch (err) {
        console.error('sendReceipt error:', err);
        return res.status(500).json({ message: 'Unable to issue receipt' });
    }
};

module.exports = { sendReceipt };
