/**
 * Login and permission checks for routes.
 *
 * I made two small helpers (authenticate and authorizeAdmin) instead of
 * one big "requireAdmin" helper. This way each route can show clearly what
 * it needs:
 *
 *     router.get('/me',         authenticate,             handler);
 *     router.post('/trips',     authenticate, authorizeAdmin, handler);
 *
 * The admin check always runs after the token check, so authorizeAdmin
 * can safely use req.user.
 */
const jwt = require('jsonwebtoken');

/**
 * Check the user's token and save the user info on req.user.
 * If anything looks wrong, we block the request. We never let a bad or
 * fake token through by mistake.
 *
 * ─── How it works ───────────────────────────────────────────────────────
 *   if the server has no secret key -> 500 (setup problem)
 *   if there is no "Bearer <token>" header -> 401
 *   try to read the token with the secret key
 *       if it works: save the user info and move on
 *       if it fails: 401 (bad or old token)
 * ────────────────────────────────────────────────────────────────────────
 */
const authenticate = (req, res, next) => {
  // Stop here if someone forgot to set the secret key on the server.
  // Without this check, the app might accept fake tokens signed with
  // the word "undefined".
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'Server authentication configuration is missing' });
  }
  

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: no token provided' });
  }
  const token = authHeader.split(' ')[1];

  try {
    // jwt.verify will throw an error if the token is fake, old, or broken.
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    // We don't say if the token was fake or just old, to keep things safe.
    return res.status(401).json({ message: 'Unauthorized: invalid or expired token' });
  }
};

/**
 * Only let users in if their token says they are an admin.
 * This must run AFTER `authenticate` so req.user is ready.
 */
const authorizeAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: admin access required' });
  }
  next();
};

module.exports = { authenticate, authorizeAdmin };
