const mongoose = require('mongoose');
const crypto   = require('crypto');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, trim: true, lowercase: true },
  name:  { type: String, required: true, trim: true },
  role:  { type: String, enum: ['customer', 'admin'], default: 'customer' },
  hash:  { type: String, required: true },

  // Only kept for old accounts that still use the older password format.
  // bcrypt stores the salt inside the hash, so new users do not need this.
  salt:  { type: String, default: '' }
}, { timestamps: true });

// Does this hash look like bcrypt?
const BCRYPT_PREFIX = /^\$2[aby]\$/;

// How many bcrypt rounds to use. Default is 12 if .env does not say.
const rounds = () => Math.max(4, parseInt(process.env.BCRYPT_ROUNDS, 10) || 12);

// Hash a new password and save it.
// We clear the salt because bcrypt already keeps the salt inside the hash.
userSchema.methods.setPassword = async function (password) {
  this.hash = await bcrypt.hash(password, rounds());
  this.salt = '';
};

// Check if the typed password matches the saved one.
userSchema.methods.validPassword = async function (password) {
  if (!this.hash) return false;

  // If the saved hash is bcrypt, use bcrypt to compare.
  if (BCRYPT_PREFIX.test(this.hash)) {
    return bcrypt.compare(password, this.hash);
  }

  // Old accounts used PBKDF2. Handle them here.
  if (!this.salt) return false;
  const candidate = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512');
  const stored    = Buffer.from(this.hash, 'hex');

  // Different length means it cannot match.
  if (stored.length !== candidate.length) return false;

  // Constant time compare to avoid timing attacks.
  if (!crypto.timingSafeEqual(stored, candidate)) return false;

  try {
    // The old password worked. Upgrade the saved hash to bcrypt.
    await this.setPassword(password);
    await this.save();
  } catch {
    // If the upgrade save fails, still let the user in. The password was right.
  }

  return true;
};

// Build a login token that lasts seven days.
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