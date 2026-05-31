const nodemailer = require('nodemailer');

// Public URL used in outbound emails. Set PUBLIC_URL in production to the real
// origin so the "your reservations" link works for customers; falls back to
// localhost for development.
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

// Create transporter using environment variables
// For Gmail: set EMAIL_USER and EMAIL_PASS (use an App Password, not your real password)
// For testing without real credentials, emails are skipped (no PII logged).
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

    const mailOptions = {
        from:    `"Travlr Getaways" <${process.env.EMAIL_USER}>`,
        to:      toEmail,
        subject: `Reservation Confirmed – ${reservation.tripName}`,
        html: `
        <div style="font-family:Arial,sans-serif; max-width:600px; margin:auto; border:1px solid #ddd; border-radius:6px; overflow:hidden;">
            <div style="background:#333; color:#fff; padding:24px 28px;">
                <h1 style="margin:0; font-size:1.4rem;">Travlr Getaways</h1>
                <p style="margin:4px 0 0; opacity:0.8;">Reservation Confirmation</p>
            </div>
            <div style="padding:28px;">
                <p style="font-size:1rem;">Hi <strong>${customerName}</strong>,</p>
                <p>Your reservation has been confirmed! Here are your booking details:</p>

                <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:0.95rem;">
                    <tr style="background:#f5f5f5;">
                        <td style="padding:10px 14px; font-weight:bold; width:40%;">Trip</td>
                        <td style="padding:10px 14px;">${reservation.tripName}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 14px; font-weight:bold;">Resort</td>
                        <td style="padding:10px 14px;">${reservation.resort || '-'}</td>
                    </tr>
                    <tr style="background:#f5f5f5;">
                        <td style="padding:10px 14px; font-weight:bold;">Start Date</td>
                        <td style="padding:10px 14px;">${startDate}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 14px; font-weight:bold;">Length</td>
                        <td style="padding:10px 14px;">${reservation.length || '-'}</td>
                    </tr>
                    <tr style="background:#f5f5f5;">
                        <td style="padding:10px 14px; font-weight:bold;">Price Per Person</td>
                        <td style="padding:10px 14px;">${perPerson}</td>
                    </tr>
                    <tr>
                        <td style="padding:10px 14px; font-weight:bold;">Travelers</td>
                        <td style="padding:10px 14px;">${reservation.people}</td>
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
        // No credentials configured. Skip sending. We intentionally do not log
        // recipient, trip, or price details because those are PII and would end
        // up in production log aggregation.
        console.log('Email skipped: EMAIL_USER/EMAIL_PASS not configured.');
        return;
    }

    await transporter.sendMail(mailOptions);
};

module.exports = { sendReservationConfirmation };
