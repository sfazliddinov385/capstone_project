const User = require('../models/user');

// POST /api/register. Create a new account and return a token.
const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }
  try {
    const user = new User({ name, email, hash: 'placeholder' });
    await user.setPassword(password);
    await user.save();
    return res.status(200).json({ token: user.generateJwt() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    // Translate validation errors into a single user-friendly message.
    // Anything else gets a generic response so we do not leak internals.
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: 'Please check the form and try again' });
    }
    console.error('register error:', err);
    return res.status(500).json({ message: 'Unable to create account' });
  }
};

// POST /api/login. Check the password and return a token.
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  try {
    const user = await User.findOne({ email }).exec();
    if (!user || !(await user.validPassword(password))) {
      return res.status(401).json({ message: 'Incorrect email or password' });
    }
    return res.status(200).json({ token: user.generateJwt() });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ message: 'Unable to sign in' });
  }
};

// GET /api/customers. Return every user. Admin only.
// We include the role so the admin SPA can hide admin accounts from the
// customer list. We do not filter server side because other tools may want them.
const getCustomers = async (req, res) => {
  try {
    const users = await User.find({}, 'name email role _id').sort({ name: 1 });
    return res.status(200).json(users);
  } catch (err) {
    console.error('getCustomers error:', err);
    return res.status(500).json({ message: 'Unable to load customers' });
  }
};

module.exports = { register, login, getCustomers };
