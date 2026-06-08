// Delete obvious test/debug customer accounts so the Customers page
// shows only real-looking users after seeding. Keeps:
//   - any admin role
//   - the project owner's personal account (sfazliddinov385@gmail.com)
//
// Run from the project root:
//   node scripts/reset-customers.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../app_api/models/user');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/travlr');
    console.log('Connected to MongoDB');

    const keep = ['sfazliddinov385@gmail.com'];

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
