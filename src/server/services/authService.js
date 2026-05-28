/**
 * Authentication & authorization.
 *
 * Roles (least → most privileged):
 *   inventory_staff — may only update stock counts
 *   supervisor      — staff + manage inventory/categories/prices, edit/remove SKUs
 *   admin           — everything, including user management
 *
 * Sessions are opaque random tokens stored server-side (separate auth
 * workbook) with an expiry. The client holds the token in localStorage and
 * sends it on every call; the server re-validates it and checks the role.
 */

var AuthService = (function () {

  var ROLES = { STAFF: 'inventory_staff', SUPERVISOR: 'supervisor', ADMIN: 'admin' };

  // Session lifetime: a session is valid until BOTH limits hold —
  //  - idle:     no use for IDLE_TTL_MS invalidates it (sliding window)
  //  - absolute: it can never live longer than ABSOLUTE_TTL_MS from creation
  var IDLE_TTL_MS     = 2 * 60 * 60 * 1000;    // 2 hours of inactivity
  var ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;   // 12 hours hard cap
  var MIN_PASSWORD    = 10;

  // Brute-force throttle: after MAX_FAILS within the window, lock for LOCKOUT_MS.
  var MAX_FAILS   = 5;
  var WINDOW_MS   = 15 * 60 * 1000;   // failures counted within 15 min
  var LOCKOUT_MS  = 15 * 60 * 1000;   // lock duration after threshold

  // Privilege ordering for "at least this role" checks.
  var RANK = {};
  RANK[ROLES.STAFF] = 1;
  RANK[ROLES.SUPERVISOR] = 2;
  RANK[ROLES.ADMIN] = 3;

  function isValidRole(role) { return RANK[role] != null; }

  // ─── Login throttling (per-username, stored in Script Properties) ─────────────
  function attemptKey(username) {
    return 'login_fail:' + String(username).toLowerCase();
  }
  function readAttempts(username) {
    var raw = PropertiesService.getScriptProperties().getProperty(attemptKey(username));
    if (!raw) return { count: 0, first: 0, lockedUntil: 0 };
    try { return JSON.parse(raw); } catch (e) { return { count: 0, first: 0, lockedUntil: 0 }; }
  }
  function writeAttempts(username, data) {
    PropertiesService.getScriptProperties().setProperty(attemptKey(username), JSON.stringify(data));
  }
  function clearAttempts(username) {
    PropertiesService.getScriptProperties().deleteProperty(attemptKey(username));
  }
  function isLockedOut(username) {
    var a = readAttempts(username);
    return a.lockedUntil && a.lockedUntil > new Date().getTime();
  }
  function recordFailure(username) {
    var now = new Date().getTime();
    var a = readAttempts(username);
    // Reset the counter if the window has elapsed.
    if (!a.first || now - a.first > WINDOW_MS) { a = { count: 0, first: now, lockedUntil: 0 }; }
    a.count += 1;
    if (a.count >= MAX_FAILS) { a.lockedUntil = now + LOCKOUT_MS; }
    writeAttempts(username, a);
  }

  function publicUser(u) {
    // Never leak the password hash to the client.
    return { id: u.id, username: u.username, role: u.role, active: u.active };
  }

  function normalizeUsername(name) {
    return String(name == null ? '' : name).trim();
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────────
  // Seed the very first admin. Safe to call repeatedly: it no-ops once any user
  // exists. Set the password by editing this call or via seedFirstAdmin().
  function seedFirstAdmin(username, password) {
    if (UserRepository.countUsers() > 0) {
      return { created: false, reason: 'users already exist' };
    }
    var user = _createUser(username, password, ROLES.ADMIN);
    return { created: true, user: publicUser(user) };
  }

  // Require length + a mix of character classes so accounts aren't protected
  // by trivially guessable passwords.
  function assertStrongPassword(password) {
    var p = String(password == null ? '' : password);
    if (p.length < MIN_PASSWORD)
      throw AppError.validation('Password must be at least ' + MIN_PASSWORD + ' characters');
    var classes = 0;
    if (/[a-z]/.test(p)) classes++;
    if (/[A-Z]/.test(p)) classes++;
    if (/[0-9]/.test(p)) classes++;
    if (/[^A-Za-z0-9]/.test(p)) classes++;
    if (classes < 3)
      throw AppError.validation('Password must include at least 3 of: lowercase, uppercase, number, symbol');
  }

  // Usernames: letters, numbers, dot, underscore, hyphen only (3–32 chars).
  function assertValidUsername(clean) {
    if (clean.length < 3 || clean.length > 32)
      throw AppError.validation('Username must be 3–32 characters');
    if (!/^[A-Za-z0-9._-]+$/.test(clean))
      throw AppError.validation('Username may only contain letters, numbers, dot, underscore, hyphen');
  }

  function _createUser(username, password, role) {
    var clean = normalizeUsername(username);
    assertValidUsername(clean);
    assertStrongPassword(password);
    if (!isValidRole(role)) throw AppError.validation('Invalid role: ' + role);
    if (UserRepository.findByUsername(clean))
      throw AppError.conflict('Username already taken: ' + clean);

    var now  = DateTime.nowIso();
    var user = {
      id:           Uuid.generate(),
      username:     clean,
      passwordHash: Crypto.hashPassword(password),
      role:         role,
      active:       true,
      createdAt:    now,
      updatedAt:    now,
    };
    return UserRepository.insertUser(user);
  }

  // ─── Login / logout ────────────────────────────────────────────────────────
  // A single generic message for all auth failures avoids leaking whether a
  // username exists, is locked, or is deactivated.
  var GENERIC_AUTH_FAIL = 'Invalid username or password';

  function login(username, password) {
    var clean = normalizeUsername(username);

    // Reject early if locked out — but still use the generic message.
    if (isLockedOut(clean)) {
      throw AppError.unauthorized('Too many attempts. Try again in a few minutes.');
    }

    var user = UserRepository.findByUsername(clean);
    // Verify even when the user is missing, to keep timing roughly uniform.
    var ok = user
      ? Crypto.verifyPassword(password, user.passwordHash)
      : Crypto.verifyPassword(password, 'pbkdf2-sha256:1:00:00');

    if (!user || !ok || !user.active) {
      recordFailure(clean);
      throw AppError.unauthorized(GENERIC_AUTH_FAIL);
    }

    clearAttempts(clean);                // successful login resets the counter
    UserRepository.purgeSessions(null);  // opportunistic cleanup of expired rows
    var now     = new Date();
    var session = {
      token:      Crypto.randomToken(),
      userId:     user.id,
      createdAt:  now.toISOString(),
      // expiresAt is the ABSOLUTE cap; idle timeout is enforced via lastUsedAt.
      expiresAt:  new Date(now.getTime() + ABSOLUTE_TTL_MS).toISOString(),
      lastUsedAt: now.toISOString(),
    };
    UserRepository.insertSession(session);
    return { token: session.token, user: publicUser(user), expiresAt: session.expiresAt };
  }

  function logout(token) {
    if (token) UserRepository.deleteSession(token);
    return { ok: true };
  }

  // ─── Session validation ──────────────────────────────────────────────────────
  // Valid only if BOTH (a) within the absolute lifetime and (b) used within the
  // idle window. On success the sliding lastUsedAt is refreshed.
  function userFromToken(token) {
    if (!token) return null;
    var session = UserRepository.findSession(token);
    if (!session) return null;

    var now      = new Date().getTime();
    var absExp   = new Date(session.expiresAt).getTime();
    var idleExp  = new Date(session.lastUsedAt).getTime() + IDLE_TTL_MS;
    if (now > absExp || now > idleExp) {
      UserRepository.deleteSession(token);
      return null;
    }

    var user = UserRepository.findById(session.userId);
    if (!user || !user.active) {
      UserRepository.deleteSession(token);
      return null;
    }

    // Slide the idle window forward (best-effort; ignore write contention).
    try { UserRepository.touchSession(token, new Date(now).toISOString()); } catch (e) {}
    return user;
  }

  // Throws UNAUTHORIZED if no valid session; returns the user otherwise.
  function requireUser(token) {
    var user = userFromToken(token);
    if (!user) throw AppError.unauthorized('Not signed in or session expired');
    return user;
  }

  // Throws UNAUTHORIZED if the session's role rank is below `minRole`.
  function requireRole(token, minRole) {
    var user = requireUser(token);
    if (RANK[user.role] < RANK[minRole]) {
      throw AppError.unauthorized('Insufficient permissions for this action');
    }
    return user;
  }

  // ─── Current session info for the client ─────────────────────────────────────
  function me(token) {
    var user = userFromToken(token);
    return user ? publicUser(user) : null;
  }

  // ─── Admin: user management ──────────────────────────────────────────────────
  function listUsers(token) {
    requireRole(token, ROLES.ADMIN);
    return UserRepository.allUsers().map(publicUser);
  }

  function registerUser(token, username, password, role) {
    requireRole(token, ROLES.ADMIN);
    var user = _createUser(username, password, role);
    return publicUser(user);
  }

  function setUserActive(token, userId, active) {
    var actor = requireRole(token, ROLES.ADMIN);
    var user  = UserRepository.findById(userId);
    if (!user) throw AppError.notFound('User', userId);
    if (user.id === actor.id) throw AppError.validation('You cannot deactivate your own account');
    user.active    = !!active;
    user.updatedAt = DateTime.nowIso();
    UserRepository.updateUser(user);
    if (!active) UserRepository.purgeSessions(user.id);
    return publicUser(user);
  }

  function setUserRole(token, userId, role) {
    var actor = requireRole(token, ROLES.ADMIN);
    if (!isValidRole(role)) throw AppError.validation('Invalid role: ' + role);
    var user = UserRepository.findById(userId);
    if (!user) throw AppError.notFound('User', userId);
    if (user.id === actor.id) throw AppError.validation('You cannot change your own role');
    user.role      = role;
    user.updatedAt = DateTime.nowIso();
    UserRepository.updateUser(user);
    return publicUser(user);
  }

  function deleteUser(token, userId) {
    var actor = requireRole(token, ROLES.ADMIN);
    if (userId === actor.id) throw AppError.validation('You cannot delete your own account');
    UserRepository.purgeSessions(userId);
    return UserRepository.deleteUser(userId);
  }

  function changeOwnPassword(token, currentPassword, newPassword) {
    var user = requireUser(token);
    if (!Crypto.verifyPassword(currentPassword, user.passwordHash))
      throw AppError.unauthorized('Current password is incorrect');
    assertStrongPassword(newPassword);
    user.passwordHash = Crypto.hashPassword(newPassword);
    user.updatedAt    = DateTime.nowIso();
    UserRepository.updateUser(user);
    UserRepository.purgeSessions(user.id);   // force re-login on other devices
    return { ok: true };
  }

  return {
    ROLES: ROLES,
    seedFirstAdmin: seedFirstAdmin,
    login: login,
    logout: logout,
    me: me,
    requireUser: requireUser,
    requireRole: requireRole,
    listUsers: listUsers,
    registerUser: registerUser,
    setUserActive: setUserActive,
    setUserRole: setUserRole,
    deleteUser: deleteUser,
    changeOwnPassword: changeOwnPassword,
  };

})();
