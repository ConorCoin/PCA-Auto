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

## How the assessor uses it
1. Pick the section once (or use the arrows to step through them in report order). It stays selected.
2. **Photo**: tap, shoot. The photo is filed under the current section straight away. No AI. Optional caption underneath.
3. **Note**: tap, dictate or type, save. Stored exactly as written under the current section. (AI rewriting into report wording exists but is off; set `PCA_AI=1` and `ANTHROPIC_API_KEY` to turn it on.)
4. **Download Word report**: sections in report order, then a Photographic Log sorted by section order (general views first) with numbered captions. A blank caption becomes "View of <section name>".

## Layout
- `app/` - phone PWA
- `server/sections.js` - report sections (from the SM&E sample report)
- `server/classify.js` - Claude call for notes only
- `server/export.js` - builds the .docx
- `data/` - jobs and photos

## Not built yet
Offline queue, front matter form (property data, interviewees), executive summary text, boilerplate sections,
10-year cost tables with inflation, unit-cost price list, audio transcription on the server.
