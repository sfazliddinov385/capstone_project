const User = require('../models/user');

// POST /api/register
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
    return res.status(400).json({ message: err.message });
  }
};

// POST /api/login
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
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/customers — list every registered user (admin only). Includes
// the role so the admin SPA can hide admin accounts from the customer table
// without filtering it out server-side (other internal tools may want them).
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
