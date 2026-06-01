# Operations — deploy run book

How to deploy, migrate, and maintain the live system.
For architecture context see [ARCHITECTURE.md](ARCHITECTURE.md).
Live IDs and URLs are in [DEPLOY_URL.md](DEPLOY_URL.md).

---

## 1. Prerequisites (one-time per machine)

```bash
npm install
npm run login          # authenticate clasp with your Google account
npm run setup          # creates the Apps Script project; writes .clasp.json (git-ignored)
```

On first data access, GAS will prompt for Sheets authorization in the browser.

---

## 2. Deploy

### Development / iterative deploy

```bash
npm run deploy         # build + push to @HEAD deployment
```

The primary deployment (`@HEAD`) updates immediately. The `/exec` URL in
[DEPLOY_URL.md](DEPLOY_URL.md) reflects the new build within seconds of push.

### Release snapshot

```bash
npm run deploy:version # build + push + cut a new numbered deployment
```

Creates a frozen snapshot. Use for stable releases the client can bookmark.

### Always run first

```bash
npm run typecheck      # must pass — catches contract drift
```

Never deploy if typecheck fails.

---

## 3. Database (Sheets) management

### Main data spreadsheet

The database spreadsheet ID is in [DEPLOY_URL.md](DEPLOY_URL.md).
The spreadsheet auto-creates new tabs on first access for each entity (tab names defined in `config.js`).

### Auth workbook (separate spreadsheet)

The auth workbook stores `Users` and `Sessions` in a **separate** spreadsheet
from the main data sheet. Its spreadsheet ID is stored in Script Properties:

```
Property key: AUTH_SPREADSHEET_ID
```

To set it:
1. Open the Apps Script editor (`npm run open`)
2. Project Settings → Script Properties
3. Add `AUTH_SPREADSHEET_ID` = the auth spreadsheet's ID

If the property is missing, `AuthService` will auto-create a new auth workbook in the
script owner's Drive and write the property automatically on first login attempt.

---

## 4. Migration

### Seed inventory from Product Info sheet

```bash
# Dry run (reads only, logs output, no writes)
# Run from Apps Script editor → Run function → dryRunInventorySeed

# Live seed (writes categories + items)
# Run from Apps Script editor → Run function → seedInventoryFromSheet
```

The seed migration reads the `Product Info` sheet and populates `SkuCategories`
and `InventoryItems`. Run `dryRunInventorySeed` first and verify the log output
before running the live seed.

### First admin user

After deploying for the first time, create the admin user from the Apps Script editor:

```js
// Run once in the editor console:
registerUser('admin_token_placeholder', 'admin', 'your-password-here', 'admin');
```

Or use the bootstrap function if one exists in `authService.js`.

---

## 5. Rollback

If a bad deploy breaks the live app:

1. Open the Apps Script editor (`npm run open`)
2. Deploy ▸ Manage deployments
3. Repoint the primary deployment to the previous version snapshot

For data corruption: Sheets has version history. Open the spreadsheet → File → Version history → See version history. Restore the affected tab to a previous version.

---

## 6. Monitoring and logs

```bash
npm run logs           # tail Stackdriver (Google Cloud Logging)
```

All `console.log` calls in `api.js` and services appear here with timestamps.
Filter by execution ID to trace a single request.

For GAS quota errors (execution time, API calls): check Apps Script Dashboard in the editor.

---

## 7. Script Properties reference

| Key | Value | Purpose |
|---|---|---|
| `AUTH_SPREADSHEET_ID` | Spreadsheet ID string | Auth workbook location |

Add new properties here as needed. Access in code via `PropertiesService.getScriptProperties().getProperty('KEY')`.

---

## 8. Useful URLs

See [DEPLOY_URL.md](DEPLOY_URL.md) for:
- Script editor URL
- Main data spreadsheet URL
- Primary `/exec` URL (live app)
- Snapshot deployment URLs
