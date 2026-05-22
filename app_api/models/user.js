const mongoose = require('mongoose');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, trim: true, lowercase: true },
  name:  { type: String, required: true, trim: true },
  role:  { type: String, enum: ['customer', 'admin'], default: 'customer' },
  hash:  { type: String, required: true },

  // This is only kept for old users who still have older password records.
  // New users using bcrypt do not need a separate salt because bcrypt stores it in the hash.
  salt:  { type: String, default: '' }
}, { timestamps: true });

// This checks if the saved password hash is a bcrypt hash.
const BCRYPT_PREFIX = /^\$2[aby]\$/;

// This decides how many bcrypt rounds to use.
// If there is no value in the environment file, it uses 12.
const rounds = () => Math.max(4, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12);

// This creates a secure hashed password and saves it.
// The salt field is cleared because bcrypt already stores the salt inside the hash.
userSchema.methods.setPassword = async function (password) {
  this.hash = await bcrypt.hash(password, rounds());
  this.salt = '';
};

// This checks if the password the user typed is correct.
userSchema.methods.validPassword = async function (password) {
  if (!this.hash) return false;

  // If the password was saved with bcrypt, compare it using bcrypt.
  if (BCRYPT_PREFIX.test(this.hash)) {
    return bcrypt.compare(password, this.hash);
  }

  // This part is for old accounts that used the older PBKDF2 password system.
  if (!this.salt) return false;
  const candidate = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512');
  const stored    = Buffer.from(this.hash, 'hex');

  // If the saved password and typed password do not match in length, reject it.
  if (stored.length !== candidate.length) return false;

  // Safely compare the old saved password with the typed password.
  if (!crypto.timingSafeEqual(stored, candidate)) return false;

  try {
    // If the old password worked, update it to the newer bcrypt system.
    await this.setPassword(password);
    await this.save();
  } catch {
    // If the update fails, still allow login because the password was correct.
  }

  return true;
};

// This creates a login token that lasts for 7 days.
userSchema.methods.generateJwt = function () {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required to generate authentication tokens');
  }

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);

  return jwt.sign(
    {
      _id:   this._id,
      email: this.email,
      name:  this.name,
      role:  this.role,
      exp:   parseInt(expiry.getTime() / 1000, 10)
    },
    process.env.JWT_SECRET
  );
};

module.exports = mongoose.model('User', userSchema);