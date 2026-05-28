/**
 * Stores user accounts and sessions in a SEPARATE spreadsheet from the
 * inventory data, so credentials never sit in the same workbook as the
 * business data. The auth workbook's ID is kept in Script Properties under
 * AUTH_SPREADSHEET_ID; if absent, a new spreadsheet is created on first use.
 *
 * Users sheet:    id | username | passwordHash | role | active | createdAt | updatedAt
 * Sessions sheet: token | userId | createdAt | expiresAt
 */

var UserRepository = (function () {

  var PROP_KEY      = 'AUTH_SPREADSHEET_ID';
  var WORKBOOK_NAME = 'Inventory Auth (do not share)';
  var USERS_SHEET   = 'Users';
  var SESS_SHEET    = 'Sessions';
  var USER_HEADERS  = ['id', 'username', 'passwordHash', 'role', 'active', 'createdAt', 'updatedAt'];
  var SESS_HEADERS  = ['token', 'userId', 'createdAt', 'expiresAt'];

  function props() { return PropertiesService.getScriptProperties(); }

  function getWorkbook() {
    var id = props().getProperty(PROP_KEY);
    if (id) {
      try { return SpreadsheetApp.openById(id); }
      catch (e) { /* fall through and recreate */ }
    }
    var ss = SpreadsheetApp.create(WORKBOOK_NAME);
    props().setProperty(PROP_KEY, ss.getId());
    return ss;
  }

  function getSheet(name, headers) {
    var ss    = getWorkbook();
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
    // GAS auto-creates a default "Sheet1"; remove it once our sheets exist.
    var def = ss.getSheetByName('Sheet1');
    if (def && ss.getSheets().length > 1) { try { ss.deleteSheet(def); } catch (e) {} }
    return sheet;
  }

  function usersSheet() { return getSheet(USERS_SHEET, USER_HEADERS); }
  function sessSheet()  { return getSheet(SESS_SHEET, SESS_HEADERS); }

  function userFromRow(r) {
    return {
      id:           String(r[0]),
      username:     String(r[1]),
      passwordHash: String(r[2]),
      role:         String(r[3]),
      active:       r[4] === true || String(r[4]).toLowerCase() === 'true',
      createdAt:    String(r[5]),
      updatedAt:    String(r[6]),
    };
  }

  function userToRow(u) {
    return [u.id, u.username, u.passwordHash, u.role, u.active, u.createdAt, u.updatedAt];
  }

  // ─── Users ──────────────────────────────────────────────────────────────────
  function allUsers() {
    var sheet = usersSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return [];
    return sheet.getRange(2, 1, last - 1, USER_HEADERS.length).getValues()
      .filter(function (r) { return r[0] !== '' && r[0] != null; })
      .map(userFromRow);
  }

  function findByUsername(username) {
    var u = String(username).trim().toLowerCase();
    var all = allUsers();
    for (var i = 0; i < all.length; i++) {
      if (all[i].username.toLowerCase() === u) return all[i];
    }
    return null;
  }

  function findById(id) {
    var all = allUsers();
    for (var i = 0; i < all.length; i++) if (all[i].id === String(id)) return all[i];
    return null;
  }

  function insertUser(user) {
    usersSheet().appendRow(userToRow(user));
    return user;
  }

  function _rowIndexById(id) {
    var sheet = usersSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return -1;
    var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
    return -1;
  }

  function updateUser(user) {
    var idx = _rowIndexById(user.id);
    if (idx === -1) throw AppError.notFound('User', user.id);
    usersSheet().getRange(idx, 1, 1, USER_HEADERS.length).setValues([userToRow(user)]);
    return user;
  }

  function deleteUser(id) {
    var idx = _rowIndexById(id);
    if (idx === -1) throw AppError.notFound('User', id);
    usersSheet().deleteRow(idx);
    return { id: id };
  }

  function countUsers() { return allUsers().length; }

  // ─── Sessions ───────────────────────────────────────────────────────────────
  function insertSession(session) {
    sessSheet().appendRow([session.token, session.userId, session.createdAt, session.expiresAt]);
    return session;
  }

  function findSession(token) {
    var sheet = sessSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return null;
    var rows = sheet.getRange(2, 1, last - 1, SESS_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === String(token)) {
        return {
          token:     String(rows[i][0]),
          userId:    String(rows[i][1]),
          createdAt: String(rows[i][2]),
          expiresAt: String(rows[i][3]),
          _row:      i + 2,
        };
      }
    }
    return null;
  }

  function deleteSession(token) {
    var s = findSession(token);
    if (s) sessSheet().deleteRow(s._row);
  }

  // Remove sessions for a user (e.g. on deactivation) and any past-expiry rows.
  function purgeSessions(userId) {
    var sheet = sessSheet();
    var last  = sheet.getLastRow();
    if (last < 2) return;
    var rows = sheet.getRange(2, 1, last - 1, SESS_HEADERS.length).getValues();
    var now  = new Date().getTime();
    // Delete from the bottom up so row indices stay valid.
    for (var i = rows.length - 1; i >= 0; i--) {
      var expired = new Date(rows[i][3]).getTime() < now;
      var matches = userId && String(rows[i][1]) === String(userId);
      if (expired || matches) sheet.deleteRow(i + 2);
    }
  }

  return {
    getWorkbookId: function () { return props().getProperty(PROP_KEY); },
    allUsers: allUsers,
    findByUsername: findByUsername,
    findById: findById,
    insertUser: insertUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    countUsers: countUsers,
    insertSession: insertSession,
    findSession: findSession,
    deleteSession: deleteSession,
    purgeSessions: purgeSessions,
  };

})();
