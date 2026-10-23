# PCA

Automates the Property Condition Assessment (PCA) report (ASTM E2018 style). The assessor walks the site taking
photos and dictating notes on their phone. Each note and photo is filed by Claude into the right report section,
and the result exports as a Word draft.

## Run locally
```
npm install
set ANTHROPIC_API_KEY=your-key      (PowerShell: $env:ANTHROPIC_API_KEY="your-key")
npm start                           -> http://localhost:3000
npm test                            -> offline check of the Word export (no key needed)
```
Open the URL on the phone (it must be HTTPS for camera/mic off-laptop, e.g. via a Cloudflare tunnel), then
"Add to Home Screen". No app store needed.

## Layout
- `app/` – phone PWA: dictate/type a note, add photos, optional section pick, list of filed items, Word download
- `server/sections.js` – the ~30 report sections (from the SM&E sample report)
- `server/classify.js` – sends note + photos to Claude, returns section, description, condition, recommendations, photo captions
- `server/export.js` – builds the .docx (sections, recommendations, deficiency table, numbered photo log)
- `data/` – jobs and photos (git-ignored; client data)

## Not built yet
Offline queue, front matter form (property data, interviewees), executive summary text, boilerplate sections,
10-year cost tables with inflation, unit-cost price list, audio transcription on the server.
