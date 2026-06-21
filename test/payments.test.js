const test   = require('node:test');
const assert = require('node:assert/strict');

// We stub the Reservation model and the email service before the controller
// uses them. require() caches the module, so the controller holds the same
// object we patch here. Reassigning the methods on that object is enough.
const Reservation = require('../app_api/models/reservation');
const emailSvc    = require('../app_api/services/email');
const { sendReceipt } = require('../app_api/controllers/payments');

// --- Test doubles -----------------------------------------------------------

// Make Reservation.find(...).sort(...).lean() resolve to a fixed set of rows.
function stubReservations(rows) {
    Reservation.find = () => ({
        sort: () => ({
            lean: async () => rows,
        }),
    });
}

// Capture the receipt payload the controller hands to the email service.
let lastEmail = null;
emailSvc.sendPaymentReceipt = async (to, name, payload) => {
    lastEmail = { to, name, payload };
};

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json   = (body) => { res.body = body; return res; };
    return res;
};

const baseReq = (body) => ({
    user: { _id: 'user-1', email: 'jane@example.com', name: 'Jane Smith' },
    body,
});

test.beforeEach(() => { lastEmail = null; });

// --- Validation -------------------------------------------------------------

test('sendReceipt rejects an empty items array', async () => {
    const res = mockRes();
    await sendReceipt(baseReq({ items: [] }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /at least one trip/i);
});

test('sendReceipt rejects a missing items field', async () => {
    const res = mockRes();
    await sendReceipt(baseReq({}), res);
    assert.equal(res.statusCode, 400);
});

test('sendReceipt rejects more than 20 items', async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ tripCode: 'T' + i }));
    const res = mockRes();
    await sendReceipt(baseReq({ items }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /too many/i);
});

test('sendReceipt rejects an item with no tripCode', async () => {
    const res = mockRes();
    await sendReceipt(baseReq({ items: [{ tripCode: '' }] }), res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /tripcode/i);
});

// --- Authorization ----------------------------------------------------------

test('sendReceipt refuses a trip the user never booked (403)', async () => {
    stubReservations([]); // DB has no matching reservation for this user
    const res = mockRes();
    await sendReceipt(baseReq({ items: [{ tripCode: 'FAKE' }] }), res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body.missing, ['FAKE']);
    assert.equal(lastEmail, null, 'no email should be sent for an unauthorized receipt');
});

test('sendReceipt reports every missing code, not just the first', async () => {
    // Only REEF is real; SWIS and BALI are not.
    stubReservations([
        { tripCode: 'REEF', tripName: 'Reef', people: 1, perPerson: 100, bookedAt: new Date() },
    ]);
    const res = mockRes();
    await sendReceipt(baseReq({ items: [{ tripCode: 'REEF' }, { tripCode: 'SWIS' }, { tripCode: 'BALI' }] }), res);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body.missing.sort(), ['BALI', 'SWIS']);
});

// --- Happy path + server-side math -----------------------------------------

test('sendReceipt computes totals from the reservation rows, not the body', async () => {
    stubReservations([
        { tripCode: 'REEF', tripName: 'Dawson Reef', people: 2, perPerson: 1000, bookedAt: new Date() },
    ]);
    // The body sends a wildly wrong grandTotal — it must be ignored.
    const res = mockRes();
    await sendReceipt(baseReq({
        items: [{ tripCode: 'REEF' }],
        grandTotal: 1,             // attacker-supplied junk
        subtotal: 1,
        cardBrand: 'Visa',
        cardLast4: '4242',
    }), res);

    assert.equal(res.statusCode, 200);
    // subtotal 2000, tax 200 (10%), service 100 (5%), no protection => 2300
    assert.equal(res.body.subtotal, 2000);
    assert.equal(res.body.taxes, 200);
    assert.equal(res.body.serviceFee, 100);
    assert.equal(res.body.protection, 0);
    assert.equal(res.body.grandTotal, 2300);
});

test('sendReceipt adds travel protection per traveler when requested', async () => {
    stubReservations([
        { tripCode: 'REEF', tripName: 'Reef', people: 3, perPerson: 1000, bookedAt: new Date() },
    ]);
    const res = mockRes();
    await sendReceipt(baseReq({ items: [{ tripCode: 'REEF' }], wantsProtection: true }), res);
    assert.equal(res.statusCode, 200);
    // protection = 49 * 3 travelers = 147
    assert.equal(res.body.protection, 147);
    // grand = 3000 + 300 + 150 + 147
    assert.equal(res.body.grandTotal, 3597);
});

test('sendReceipt returns a well-formed receipt number and emails the user', async () => {
    stubReservations([
        { tripCode: 'REEF', tripName: 'Reef', people: 1, perPerson: 500, bookedAt: new Date() },
    ]);
    const res = mockRes();
    await sendReceipt(baseReq({ items: [{ tripCode: 'REEF' }], cardBrand: 'Visa', cardLast4: '1111 2222 3333 4242' }), res);

    assert.equal(res.statusCode, 200);
    assert.match(res.body.receiptNumber, /^TG-\d{6}-[0-9A-F]{4}$/);
    assert.equal(res.body.emailedTo, 'jane@example.com');

    // The email side effect fired with the masked card (last 4 only).
    assert.ok(lastEmail, 'an email should have been sent');
    assert.equal(lastEmail.to, 'jane@example.com');
    assert.equal(lastEmail.payload.cardLast4, '4242');
    assert.equal(lastEmail.payload.cardBrand, 'Visa');
});

test('sendReceipt normalises an unknown card brand to "Card"', async () => {
    stubReservations([
        { tripCode: 'REEF', tripName: 'Reef', people: 1, perPerson: 100, bookedAt: new Date() },
    ]);
    const res = mockRes();
    await sendReceipt(baseReq({ items: [{ tripCode: 'REEF' }], cardBrand: 'Monopoly', cardLast4: '0000' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(lastEmail.payload.cardBrand, 'Card');
});

test('sendReceipt returns 500 if the database lookup throws', async () => {
    Reservation.find = () => { throw new Error('db down'); };
    const res = mockRes();
    await sendReceipt(baseReq({ items: [{ tripCode: 'REEF' }] }), res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /unable to issue receipt/i);
});
