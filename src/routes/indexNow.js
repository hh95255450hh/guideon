/**
 * Serves the IndexNow ownership key as plain text at /<key>.txt.
 *
 * The key is a secret only in the sense that it proves control of the host; it
 * is designed to be publicly fetchable. We compare with a constant-time check
 * anyway so this route can't be used as an oracle to discover the key.
 */
const router = require('express').Router();
const crypto = require('crypto');
const { KEY, isEnabled } = require('../services/indexNow');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

router.get('/:key.txt', (req, res, next) => {
  if (!isEnabled() || !safeEqual(req.params.key, KEY)) return next();
  res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(KEY);
});

module.exports = router;
