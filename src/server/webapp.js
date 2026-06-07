/**
 * Web app entry point.
 *
 * doGet() is invoked when a user opens the deployed web app URL
 * (https://script.google.com/macros/s/.../exec). It returns the bundled
 * React app, which Vite has inlined into a single index.html file pushed
 * to the GAS project as "index.html".
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('GAS React Web App')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Allows other Apps Script files (e.g. templated HTML) to inline content.
 * Not strictly required for the single-file build, but handy for includes.
 * @param {string} filename
 * @returns {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ONE-TIME bootstrap — run manually from the Apps Script editor to create the
 * first admin account. Change the username/password below first, run once,
 * then clear the password from the source. No-ops if any user already exists.
 *
 * After this, log in as the admin and create supervisor/staff accounts from
 * the in-app user management screen.
 */
function bootstrapFirstAdmin() {
  // Password must be ≥10 chars and include ≥3 of: lower, upper, number, symbol.
  var result = Kernel.Auth.seedFirstAdmin('admin', 'ChangeMe-2026!');
  console.log(JSON.stringify(result));
  console.log('Auth workbook ID: ' + Kernel.Auth.getWorkbookId());
  return result;
}

/**
 * DANGER — wipes ALL accounts and sessions from the auth workbook so the
 * bootstrap can re-create the admin from scratch. Use only to recover from a
 * bad seed (e.g. an admin hashed with the old, far-too-slow iteration count).
 * After running this, run bootstrapFirstAdmin() again.
 */
function resetAuthData() {
  var id = Kernel.Auth.getWorkbookId();
  if (!id) { console.log('No auth workbook exists yet.'); return; }
  var ss = SpreadsheetApp.openById(id);
  // GAS forbids removing the last sheet, so park a temp sheet first.
  var temp = ss.insertSheet('_temp_reset');
  ['Users', 'Sessions'].forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) ss.deleteSheet(sheet);
  });
  ss.deleteSheet(temp);
  console.log('Auth data cleared. Now run bootstrapFirstAdmin().');
}

/**
 * DANGER — wipes all auth data then re-creates the three seed accounts:
 *   admin       / Admin-2026!
 *   supervisor  / Super-2026!
 *   staff       / Staff-2026!
 * Run once from the Apps Script editor when you need a clean slate.
 */
function reseedUsers() {
  resetAuthData();
  var seeds = [
    { username: 'admin',      password: 'Admin-2026!', role: Config.ROLES.ADMIN      },
    { username: 'supervisor', password: 'Super-2026!', role: Config.ROLES.SUPERVISOR },
    { username: 'staff',      password: 'Staff-2026!', role: Config.ROLES.STAFF      },
  ];
  var results = Kernel.Auth.seedUsers(seeds);
  console.log('Reseeded users: ' + JSON.stringify(results));
  return results;
}
