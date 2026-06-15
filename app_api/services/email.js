const nodemailer = require('nodemailer');

// The base URL used in outbound emails. Set PUBLIC_URL in production so
// the "your reservations" link points at the real site. In dev we fall
// back to localhost.
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

// Escape any user text before we drop it into the HTML email.
// Without this, a name like </td><script>... could inject markup into
// the inbox of whoever opens the confirmation.
const escapeHtml = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Build the mail transport from env vars.
// For Gmail, set EMAIL_USER and EMAIL_PASS. Use a Gmail App Password,
// not your real account password. If neither is set, we skip sending and
// do not log any personal info.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendReservationConfirmation = async (toEmail, customerName, reservation) => {
    const startDate = reservation.start
        ? new Date(reservation.start).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'TBD';

    const perPerson  = parseFloat(reservation.perPerson  || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const totalPrice = parseFloat(reservation.totalPrice || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

    // Escape every user value once, before it goes into the HTML below.
    const safeCustomer = escapeHtml(customerName);
    const safeTripName = escapeHtml(reservation.tripName);
    const safeResort   = escapeHtml(reservation.resort || '-');
    const safeLength   = escapeHtml(reservation.length || '-');
    const safePeople   = escapeHtml(reservation.people);

    const mailOptions = {
        from:    `"Travlr Getaways" <${process.env.EMAIL_USER}>`,
        to:      toEmail,
        subject: `Reservation Confirmed – ${safeTripName}`,
        html: `
        <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:6px; overflow:hidden;">
            <div style="background:#333; color:#fff; padding:24px 28px;">
                <h1 style="margin:0; font-size:1.4rem;">Travlr Getaways</h1>
                <p style="margin:4px 0 0; opacity:0.8;">Reservation Confirmation</p>
            </div>
            <div style="padding:28px;">
                <p style="font-size:1rem;">Hi <strong>${safeCustomer}</strong>,</p>
                <p>Your reservation has been confirmed! Here are your booking details:</p>

                <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:0.95rem;">
                    <tr style="background:#f5f5f5;">
                        <td style="padding:10px 14px; font-weight:bold; width:40%;">Trip</td>
                        <td style="padding:10px 14px;">${safeTripName}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 14px; font-weight:bold;">Resort</td>
                        <td style="padding:10px 14px;">${safeResort}</td>
                    </tr>
                    <tr style="background:#f5f5f5;">
                        <td style="padding:10px 14px; font-weight:bold;">Start Date</td>
                        <td style="padding:10px 14px;">${startDate}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 14px; font-weight:bold;">Length</td>
                        <td style="padding:10px 14px;">${safeLength}</td>
                    </tr>
                    <tr style="background:#f5f5f5;">
                        <td style="padding:10px 14px; font-weight:bold;">Price Per Person</td>
                        <td style="padding:10px 14px;">${perPerson}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 14px; font-weight:bold;">Travelers</td>
                        <td style="padding:10px 14px;">${safePeople}</td>
                    </tr>
                    <tr style="background:#2a7; color:#fff;">
                        <td style="padding:12px 14px; font-weight:bold; font-size:1.05rem;">Total Charged</td>
                        <td style="padding:12px 14px; font-weight:bold; font-size:1.05rem;">${totalPrice}</td>
                    </tr>
                </table>

                <p style="color:#555; font-size:0.9rem;">
                    A confirmation number will be sent separately. If you have any questions, reply to this email
                    or visit <a href="${PUBLIC_URL}/reservations">your reservations page</a>.
                </p>
                <p style="margin-top:24px;">Thank you for booking with Travlr Getaways!</p>
            </div>
            <div style="background:#f5f5f5; padding:14px 28px; font-size:0.8rem; color:#999; text-align:center;">
                &copy; ${new Date().getFullYear()} Travlr Getaways &bull; This is a demo application
            </div>
        </div>
        `
    };

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        // No email credentials set. Skip sending. We do not log the recipient,
        // trip, or price. Those are personal details and would end up in the
        // production log if we did.
        console.log('Email skipped: EMAIL_USER/EMAIL_PASS not configured.');
        return;
    }

    await transporter.sendMail(mailOptions);
};

// Send a single payment receipt after checkout. Unlike the per-trip
// confirmation above, this is one email that summarises every trip in the
// cart plus the totals, fees, and the masked card the user "paid" with.
// The server never sees the full card number. Only the brand and last 4
// digits are ever sent over the wire.
const sendPaymentReceipt = async (toEmail, customerName, payload) => {
    const {
        receiptNumber,
        items = [],
        subtotal = 0,
        taxes = 0,
        serviceFee = 0,
        protection = 0,
        grandTotal = 0,
        cardBrand = 'Card',
        cardLast4 = '••••',
        paidAt = new Date(),
    } = payload || {};

    const money = (n) => Number(n || 0).toLocaleString('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    const dateStr = new Date(paidAt).toLocaleString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });

    const safeCustomer = escapeHtml(customerName);
    const safeReceipt  = escapeHtml(receiptNumber || '');
    const safeBrand    = escapeHtml(cardBrand);
    const safeLast4    = escapeHtml(cardLast4);

    const itemRows = items.map((it, i) => {
        const name   = escapeHtml(it.tripName || it.tripCode || 'Trip');
        const code   = escapeHtml(it.tripCode || '');
        const people = Number(it.people || 0);
        const line   = money((Number(it.perPerson) || 0) * people);
        const bg     = i % 2 === 0 ? '#f8fafc' : '#ffffff';
        return `
            <tr style="background:${bg};">
                <td style="padding:12px 14px; vertical-align:top;">
                    <div style="font-weight:600; color:#0f172a;">${name}</div>
                    <div style="color:#64748b; font-size:0.85rem;">${code} &middot; ${people} traveler${people === 1 ? '' : 's'}</div>
                </td>
                <td style="padding:12px 14px; text-align:right; font-weight:600; vertical-align:top;">${line}</td>
            </tr>`;
    }).join('');

    const protectionRow = protection > 0 ? `
        <tr>
            <td style="padding:6px 14px; color:#475569;">Travel protection</td>
            <td style="padding:6px 14px; text-align:right;">${money(protection)}</td>
        </tr>` : '';

    const mailOptions = {
        from:    `"Travlr Getaways" <${process.env.EMAIL_USER}>`,
        to:      toEmail,
        subject: `Payment receipt ${safeReceipt} – Travlr Getaways`,
        html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif; max-width:640px; margin:auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
            <div style="background:linear-gradient(135deg,#1a4a72 0%,#2a6699 100%); color:#ffffff; padding:28px 32px;">
                <h1 style="margin:0; font-size:1.5rem; letter-spacing:-0.01em;">Payment receipt</h1>
                <p style="margin:6px 0 0; opacity:0.9; font-size:0.95rem;">Travlr Getaways &middot; ${dateStr}</p>
            </div>

            <div style="padding:28px 32px;">
                <p style="margin:0 0 8px; font-size:1rem;">Hi <strong>${safeCustomer}</strong>,</p>
                <p style="margin:0 0 20px; color:#475569;">
                    Thank you for booking with Travlr Getaways. This receipt is your record of the payment.
                    Each trip will also receive its own confirmation email with travel details.
                </p>

                <div style="background:#f1f5f9; border-radius:8px; padding:14px 18px; margin:0 0 22px; display:flex; justify-content:space-between;">
                    <div>
                        <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em; color:#64748b;">Receipt number</div>
                        <div style="font-weight:700; color:#0f172a; font-size:1.05rem;">${safeReceipt}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em; color:#64748b;">Paid with</div>
                        <div style="font-weight:700; color:#0f172a; font-size:1.05rem;">${safeBrand} &bull;&bull;&bull;&bull; ${safeLast4}</div>
                    </div>
                </div>

                <h2 style="margin:0 0 12px; font-size:1.05rem; color:#0f172a;">Trips on this booking</h2>
                <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                    <tbody>
                        ${itemRows}
                    </tbody>
                </table>

                <h2 style="margin:24px 0 8px; font-size:1.05rem; color:#0f172a;">Summary</h2>
                <table style="width:100%; border-collapse:collapse; font-size:0.95rem;">
                    <tbody>
                        <tr>
                            <td style="padding:6px 14px; color:#475569;">Subtotal</td>
                            <td style="padding:6px 14px; text-align:right;">${money(subtotal)}</td>
                        </tr>
                        <tr>
                            <td style="padding:6px 14px; color:#475569;">Taxes &amp; fees (10%)</td>
                            <td style="padding:6px 14px; text-align:right;">${money(taxes)}</td>
                        </tr>
                        <tr>
                            <td style="padding:6px 14px; color:#475569;">Service fee (5%)</td>
                            <td style="padding:6px 14px; text-align:right;">${money(serviceFee)}</td>
                        </tr>
                        ${protectionRow}
                        <tr>
                            <td colspan="2" style="border-top:1px solid #e2e8f0; padding:0;"></td>
                        </tr>
                        <tr>
                            <td style="padding:14px; font-weight:700; color:#0f172a; font-size:1.1rem;">Total paid</td>
                            <td style="padding:14px; text-align:right; font-weight:700; color:#0f172a; font-size:1.1rem;">${money(grandTotal)}</td>
                        </tr>
                    </tbody>
                </table>

                <p style="margin-top:24px; color:#475569; font-size:0.9rem; line-height:1.5;">
                    Manage your trips any time at
                    <a href="${PUBLIC_URL}/reservations" style="color:#1a4a72; font-weight:600;">your reservations page</a>.
                    Free cancellation up to 30 days before departure.
                </p>
            </div>

            <div style="background:#f8fafc; padding:16px 32px; font-size:0.8rem; color:#94a3b8; text-align:center; border-top:1px solid #e2e8f0;">
                Travlr Getaways &copy; ${new Date().getFullYear()} &bull; This is a CS 499 capstone demonstration.
                No real charge was processed.
            </div>
        </div>
        `,
    };

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        // No mail credentials configured. Skip silently. We do not log
        // the recipient or the receipt content.
        console.log('Payment receipt email skipped: EMAIL_USER/EMAIL_PASS not configured.');
        return;
    }

    await transporter.sendMail(mailOptions);
};

module.exports = { sendReservationConfirmation, sendPaymentReceipt };
