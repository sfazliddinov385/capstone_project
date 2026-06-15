/**
 * Sign-in and permission checks for routes.
 *
 * There are two small helpers: authenticate and authorizeAdmin.
 * I kept them separate instead of one big "requireAdmin" helper.
 * That way each route shows clearly what it needs:
 *
 *     router.get('/me',     authenticate, handler);
 *     router.post('/trips', authenticate, authorizeAdmin, handler);
 *
 * authorizeAdmin always runs after authenticate, so it can trust req.user.
 */
const jwt = require('jsonwebtoken');

/**
 * Read the token and put the user info on req.user.
 * If anything looks off, block the request. We never let a bad token through.
 *
 * How it works:
 *   No secret key on the server    -> 500. Setup problem.
 *   No "Bearer <token>" header     -> 401.
 *   Try to verify the token.
 *     Works -> save the user info and move on.
 *     Fails -> 401. The token is bad or expired.
 */
const authenticate = (req, res, next) => {
  // Stop now if the secret key is missing.
  // Without this check, the app could accept tokens signed with the
  // literal string "undefined".
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'Server authentication configuration is missing' });
  }
  

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: no token provided' });
  }
  const token = authHeader.split(' ')[1];

  try {
    // verify throws if the token is bad, old, or tampered with.
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    // We do not say which problem it was. That keeps attackers guessing.
    return res.status(401).json({ message: 'Unauthorized: invalid or expired token' });
  }
};

/**
 * Only allow the request if the token says the user is an admin.
 * Must run after authenticate so req.user is set.
 */
const authorizeAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: admin access required' });
  }
  next();
};

module.exports = { authenticate, authorizeAdmin };
