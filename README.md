# PCA

Automates the Property Condition Assessment (PCA) report (ASTM E2018 style). The assessor walks the site taking
photos and typing or dictating notes on their phone, and exports a Word draft.

It is a static web app (PWA). Everything runs and is stored on the phone. There is no server, no account, and
no app store.

## Use on a phone
1. Host the `app/` folder on any static host (e.g. drag it onto https://app.netlify.com/drop).
2. Open the link on the phone, open it once with signal, then Add to Home Screen.
3. Pick a section once. **Photo** files a photo under it with one tap. **Note** saves typed text; to dictate, use the
   microphone key on the phone keyboard.
4. **Prepare Word report**, then **Save report** (opens the share sheet / Files).

Photo log order follows the report's section order (general views first), then the order taken. A blank caption
becomes "View of <section name>".

## Run locally
```
npm install
npm start        -> http://localhost:3000   (static server for testing)
npm run vendor   -> refresh app/vendor/docx.js from node_modules
```

## Layout
- `app/index.html`, `app/app.js` - screen and logic
- `app/db.js` - phone storage (IndexedDB)
- `app/export.js` - Word export (uses `vendor/docx.js`)
- `app/sections.js` - report sections from the SM&E sample report
- `app/sw.js`, `app/manifest.webmanifest` - offline + install
- `samples/` - sample finished report

## Limits
- The phone holds the only copy. Use More -> "Save a backup file" regularly; browsers can clear site storage.
- The earlier server version with AI note rewriting (Claude) is in git history (commit 83f3a67).

## Not built yet
Front matter form (property data, interviewees), executive summary text, boilerplate sections, 10-year cost
tables, recommendations capture.
