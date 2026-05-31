// Run once to create the admin user: node create-admin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./app_api/models/user');

(async () => {
  const dbURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/travlr';
  await mongoose.connect(dbURI);

  const email = process.env.ADMIN_EMAIL || 'admin@travlr.com';
  const password = process.env.ADMIN_PASSWORD || 'password123';
  const name = process.env.ADMIN_NAME || 'Admin';

  await User.deleteOne({ email });
  const user = new User({ name, email, role: 'admin', hash: 'placeholder' });
  await user.setPassword(password);
  await user.save();

  console.log(`Admin created - email: ${email}  password: ${password}`);
  await mongoose.disconnect();
})();
