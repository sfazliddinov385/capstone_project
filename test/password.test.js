const test   = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// We exercise the User model's password methods directly. The methods are
// schema methods, but they only depend on `this.hash` and `this.salt`, so we
// can bind them to a plain object for a pure unit test.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'a-test-secret-thirty-two-characters-or-longer';
process.env.BCRYPT_ROUNDS = '4'; // keep tests fast

const User = require('../app_api/models/user');
const proto = User.schema.methods;

const makeFakeUser = () => ({
    hash: '',
    salt: '',
    setPassword:   proto.setPassword,
    validPassword: proto.validPassword,
    save: async function () { /* no-op for unit test */ }
});

test('setPassword writes a bcrypt hash and clears the legacy salt', async () => {
    const u = makeFakeUser();
    await u.setPassword('hunter2');
    assert.match(u.hash, /^\$2[aby]\$/);
    assert.equal(u.salt, '');
});

test('validPassword accepts the correct bcrypt password and rejects a wrong one', async () => {
    const u = makeFakeUser();
    await u.setPassword('hunter2');
    assert.equal(await u.validPassword('hunter2'), true);
    assert.equal(await u.validPassword('WRONG'),   false);
});

test('validPassword verifies a legacy PBKDF2 record and silently upgrades it to bcrypt', async () => {
    // Simulate a row written by the original PBKDF2 codepath.
    const u = makeFakeUser();
    u.salt = crypto.randomBytes(16).toString('hex');
    u.hash = crypto.pbkdf2Sync('hunter2', u.salt, 1000, 64, 'sha512').toString('hex');

    // Capture the rewritten hash via the save() hook.
    let savedHash = null;
    u.save = async function () { savedHash = this.hash; };

    assert.equal(await u.validPassword('hunter2'), true);
    assert.match(savedHash, /^\$2[aby]\$/, 'legacy record should be upgraded to bcrypt on login');
});

test('validPassword returns false for an empty hash', async () => {
    const u = makeFakeUser();
    assert.equal(await u.validPassword('anything'), false);
});
