// Delete the obvious test and debug customer accounts. After this runs,
// the Customers page only shows real-looking users.
// We keep:
//   any account with the admin role
//   the project owner's personal account (sfazliddinov385@gmail.com)
//
// Run from the project root:
//   node scripts/reset-customers.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../app_api/models/user');

async function main() {
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL: reset-customers must not run in production.');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/travlr');
    console.log('Connected to MongoDB');

    // Override with PRESERVE_EMAILS=a@x.com,b@y.com for environments where the
    // project owner's email is not the right account to keep.
    const keep = (process.env.PRESERVE_EMAILS || 'sfazliddinov385@gmail.com')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    const result = await User.deleteMany({
        role: { $ne: 'admin' },
        email: { $nin: keep },
        $or: [
            { email: /^after-/i },
            { email: /^debug-/i },
            { email: /^diag-/i },
            { email: /^dup-test-/i },
            { email: /^repeat-/i },
            { email: /@x\.com$/i },
            { name: /^After Restart$/i },
            { name: /^Debug User$/i },
            { name: /^Diag User$/i },
            { name: /^First$/i },
            { name: /^Repeat$/i }
        ]
    });

    console.log('Removed', result.deletedCount, 'test customer accounts');
    await mongoose.disconnect();
}

main().catch(e => {
    console.error('Reset failed:', e);
    process.exit(1);
});
