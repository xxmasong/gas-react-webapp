/**
 * Password hashing for the auth system.
 *
 * GAS has no bcrypt/scrypt/argon2 — only Utilities.computeDigest (SHA-256).
 * To make brute-forcing materially harder we apply a PBKDF2-style stretch:
 * iterated salted SHA-256. This is NOT as strong as a true memory-hard slow
 * hash, but with a random per-user salt and a high iteration count it raises
 * the cost of offline attacks substantially.
 *
 * Stored format (single string, ':'-delimited):
 *   pbkdf2-sha256:<iterations>:<saltHex>:<hashHex>
 */

var Crypto = (function () {

  // CRITICAL GAS CONSTRAINT: each iteration is a separate Utilities.computeDigest
  // native call (~0.1–0.5ms each), so high counts make login take tens of
  // seconds and the request appears to hang. Keep this low enough that a single
  // hash stays well under ~1s. Defense leans on strong-password policy + login
  // lockout, not on a huge stretch factor (GAS has no bcrypt/argon2).
  var ITERATIONS = 600;
  var SALT_BYTES = 16;
  var ALGO_TAG   = 'pbkdf2-sha256';

  function toHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) {
      // computeDigest returns signed bytes (-128..127); mask to 0..255
      var b = (bytes[i] + 256) % 256;
      s += (b < 16 ? '0' : '') + b.toString(16);
    }
    return s;
  }

  function fromHex(hex) {
    var out = [];
    for (var i = 0; i < hex.length; i += 2) {
      out.push(parseInt(hex.substr(i, 2), 16));
    }
    return out;
  }

  function sha256(byteArray) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, byteArray);
  }

  // Derive randomness from multiple UUIDs (RFC-4122 v4 — backed by a secure
  // RNG on the platform) hashed together. This avoids relying on Math.random,
  // which is NOT cryptographically secure.
  function randomBytesHex(n) {
    var out = '';
    while (out.length < n * 2) {
      var seed = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
      out += toHex(sha256(Utilities.newBlob(seed).getBytes()));
    }
    return out.substr(0, n * 2);
  }

  function randomSaltHex() {
    return randomBytesHex(SALT_BYTES);
  }

  // Iterated SHA-256 over (salt || password), feeding the previous digest back.
  function derive(password, saltHex, iterations) {
    var saltBytes = fromHex(saltHex);
    var pwBytes   = Utilities.newBlob(String(password)).getBytes();
    var block     = saltBytes.concat(pwBytes);
    var digest    = sha256(block);
    for (var i = 1; i < iterations; i++) {
      // hash(previousDigest || pwBytes) — keeps the password mixed in each round
      digest = sha256(digest.concat(pwBytes));
    }
    return toHex(digest);
  }

  function hashPassword(password) {
    var saltHex = randomSaltHex();
    var hashHex = derive(password, saltHex, ITERATIONS);
    return ALGO_TAG + ':' + ITERATIONS + ':' + saltHex + ':' + hashHex;
  }

  // Constant-time-ish string comparison to avoid early-exit timing leaks.
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  function verifyPassword(password, stored) {
    if (!stored || typeof stored !== 'string') return false;
    var parts = stored.split(':');
    if (parts.length !== 4 || parts[0] !== ALGO_TAG) return false;
    var iterations = parseInt(parts[1], 10);
    var saltHex    = parts[2];
    var expected   = parts[3];
    if (!iterations || !saltHex || !expected) return false;
    var actual = derive(password, saltHex, iterations);
    return safeEqual(actual, expected);
  }

  // Opaque session token (256 bits of entropy, hex) from secure UUID entropy.
  function randomToken() {
    return randomBytesHex(32);
  }

  return {
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    randomToken: randomToken,
  };

})();
