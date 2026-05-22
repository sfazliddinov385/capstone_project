const test   = require('node:test');
const assert = require('node:assert/strict');
const jwt    = require('jsonwebtoken');

// The middleware reads JWT_SECRET at call time, so set it before requiring.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'a-test-secret-thirty-two-characters-or-longer';

const { authenticate, authorizeAdmin } = require('../app_api/middleware/auth');

const mockRes = () => {
    const res = {};
    res.status = (code) => { res.statusCode = code; return res; };
    res.json   = (body) => { res.body = body; return res; };
    return res;
};

test('authenticate rejects requests with no Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    assert.match(res.body.message, /no token/i);
});

test('authenticate rejects malformed Authorization headers', () => {
    const req = { headers: { authorization: 'NotBearer xxx' } };
    const res = mockRes();
    authenticate(req, res, () => {});
    assert.equal(res.statusCode, 401);
});

test('authenticate rejects an invalid/expired token', () => {
    const req = { headers: { authorization: 'Bearer not.a.real.token' } };
    const res = mockRes();
    authenticate(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /invalid or expired/i);
});

test('authenticate attaches decoded payload to req.user and calls next', () => {
    const token = jwt.sign({ _id: '1', email: 'a@b.com', role: 'admin' }, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.email, 'a@b.com');
    assert.equal(req.user.role, 'admin');
});

test('authorizeAdmin forbids customers', () => {
    const req = { user: { role: 'customer' } };
    const res = mockRes();
    let nextCalled = false;
    authorizeAdmin(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
});

test('authorizeAdmin forbids unauthenticated callers', () => {
    const req = {};
    const res = mockRes();
    authorizeAdmin(req, res, () => {});
    assert.equal(res.statusCode, 403);
});

test('authorizeAdmin allows admins through', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    let nextCalled = false;
    authorizeAdmin(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
});
