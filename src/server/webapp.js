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
