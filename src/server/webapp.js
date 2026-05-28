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
  var result = AuthService.seedFirstAdmin('admin', 'change-me-now-8+');
  console.log(JSON.stringify(result));
  console.log('Auth workbook ID: ' + UserRepository.getWorkbookId());
  return result;
}
