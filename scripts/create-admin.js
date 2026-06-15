// Run once to create the admin user. node scripts/create-admin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./app_api/models/user');

(async () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: create-admin must not run in production.');
    process.exit(1);
  }

  const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/travlr';
  await mongoose.connect(dbURI);

  const email = process.env.ADMIN_EMAIL || 'admin@travlr.com';
  const password = process.env.ADMIN_PASSWORD || 'password123';
  const name = process.env.ADMIN_NAME || 'Admin';

  await User.deleteOne({ email });
  const user = new User({ name, email, role: 'admin', hash: 'placeholder' });
  await user.setPassword(password);
  await user.save();

  console.log(`Admin created - email: ${email}. Password was set from ADMIN_PASSWORD or the default; check your environment.`);
  await mongoose.disconnect();
})();
