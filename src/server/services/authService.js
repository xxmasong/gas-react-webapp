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
  var SESSION_TTL_MS = 12 * 60 * 60 * 1000;   // 12 hours
  var MIN_PASSWORD   = 8;

  // Privilege ordering for "at least this role" checks.
  var RANK = {};
  RANK[ROLES.STAFF] = 1;
  RANK[ROLES.SUPERVISOR] = 2;
  RANK[ROLES.ADMIN] = 3;

  function isValidRole(role) { return RANK[role] != null; }

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

  function _createUser(username, password, role) {
    var clean = normalizeUsername(username);
    if (clean.length < 3) throw AppError.validation('Username must be at least 3 characters');
    if (String(password).length < MIN_PASSWORD)
      throw AppError.validation('Password must be at least ' + MIN_PASSWORD + ' characters');
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
  function login(username, password) {
    var user = UserRepository.findByUsername(normalizeUsername(username));
    // Verify even when the user is missing, to keep timing roughly uniform.
    var ok = user
      ? Crypto.verifyPassword(password, user.passwordHash)
      : Crypto.verifyPassword(password, 'pbkdf2-sha256:1:00:00');
    if (!user || !ok) throw AppError.unauthorized('Invalid username or password');
    if (!user.active) throw AppError.unauthorized('Account is deactivated');

    UserRepository.purgeSessions(null); // opportunistic cleanup of expired rows
    var now     = new Date();
    var session = {
      token:     Crypto.randomToken(),
      userId:    user.id,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    };
    UserRepository.insertSession(session);
    return { token: session.token, user: publicUser(user), expiresAt: session.expiresAt };
  }

  function logout(token) {
    if (token) UserRepository.deleteSession(token);
    return { ok: true };
  }

  // ─── Session validation ──────────────────────────────────────────────────────
  // Returns the full (private) user for a valid, unexpired session, else null.
  function userFromToken(token) {
    if (!token) return null;
    var session = UserRepository.findSession(token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < new Date().getTime()) {
      UserRepository.deleteSession(token);
      return null;
    }
    var user = UserRepository.findById(session.userId);
    if (!user || !user.active) return null;
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
    if (String(newPassword).length < MIN_PASSWORD)
      throw AppError.validation('Password must be at least ' + MIN_PASSWORD + ' characters');
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
