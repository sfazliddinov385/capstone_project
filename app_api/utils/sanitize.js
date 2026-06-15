// Shared sanitisation helpers.
//
// escapeRegExp wraps every regex meta-character in a backslash so a user
// supplied search string cannot turn into a working regex. Use it any
// time you feed user input into a Mongo $regex or new RegExp(). Without
// it, a query like ".*" matches everything and "(a+a+)+b" is a ReDoS.

const escapeRegExp = (value) =>
    String(value == null ? '' : value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { escapeRegExp };
