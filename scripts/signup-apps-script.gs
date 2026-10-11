/**
 * The alpha sign-up endpoint: a Google Apps Script web app bound to a Sheet.
 *
 * Setup, once: make a Sheet, then Extensions > Apps Script, paste this file,
 * and Deploy > New deployment > Web app, executing as you, with access for
 * Anyone. The /exec URL it gives you is SIGNUP_ENDPOINT in src/lib/install.ts.
 *
 * Each sign-up becomes one row: when, the address, and the page it came from.
 * An address already on the sheet is answered as a success and not added
 * again, so a second click never reads as a failure or a duplicate row.
 */

function doPost(e) {
  var params = (e && e.parameter) || {};

  // The honeypot. People never see this field, so anything in it is a bot.
  // Answer ok so the bot moves on, and write nothing.
  if (params.company) return respond({ ok: true });

  var email = String(params.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return respond({ ok: false, error: 'invalid' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) sheet.appendRow(['when', 'email', 'source']);
    var existing = sheet.getRange(1, 2, sheet.getLastRow(), 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).toLowerCase() === email) return respond({ ok: true });
    }
    sheet.appendRow([new Date(), email, String(params.source || '').slice(0, 200)]);
  } finally {
    lock.releaseLock();
  }
  return respond({ ok: true });
}

function respond(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
