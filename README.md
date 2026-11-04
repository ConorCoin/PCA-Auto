# PCA Field App — Technical Reference

A mobile PWA for capturing Property Condition Assessment field notes, built for Robbie and the SM&E team. No build step, no framework, no backend — just vanilla ES modules deployed as a static folder.

---

## Philosophy

The whole app ships as a single directory (`app/`) of static files. There is no bundler, no npm, no server. Deploying means dragging `app/` to Netlify. The service worker makes it fully offline after first load.

---

## File Map

```
app/
  index.html       — single page, all CSS inline, no external stylesheets
  app.js           — main application logic (~530 lines)
  db.js            — IndexedDB wrapper (jobs + items)
  ai.js            — Claude API integration
  sections.js      — 29 PCA section definitions
  fields.js        — property data form field specs
  boilerplate.js   — ASTM red-text defaults for all 29 sections
  report.js        — Word document layout and section assembly
  export.js        — builds the .docx Blob from report parts
  frontmatter.js   — cover letter, exec summary, and Section 1-2 boilerplate
  places.js        — Google Places Autocomplete wrapper
  sw.js            — service worker (cache-first with background refresh)
  manifest.webmanifest
  vendor/docx.js   — bundled docx.js for browser use
```

---

## Data Model

Everything lives in IndexedDB. There are two object stores.

### `jobs` store — keyPath: `id`

One record per assessment:

```js
{
  id: "uuid",
  name: "Jaguar Land Rover of Buckhead",
  address1: "3975 Peachtree Road NE",
  address2: "Atlanta, GA 30319",
  created: 1234567890000,
  details: {          // ad-hoc property bag, written by the More → Property data form
    clientCompany: "Group 1 Realty, Inc.",
    reportDate: "November 4, 2026",
    inspectionDate: "October 28, 2026",
    // ... all fields from fields.js GROUPS[0] through GROUPS[2]
  },
  hvacUnits: [        // array of logged HVAC units, written by the HVAC table
    { id, building, type, manufacturer, year, size, refrigerant }
  ]
}
```

`details` and `hvacUnits` are added lazily — `newJob` creates a record without them. `putJob` does a full object replace, so adding a new property and calling `putJob` persists it safely.

### `items` store — keyPath: `id`, index: `jobId`

One record per photo or note:

```js
{
  id: "uuid",
  jobId: "parent-job-uuid",
  ts: 1234567890000,
  kind: "photo" | "note",
  sectionId: "5.2",          // one of the 29 section IDs, or "photo" for no-section
  caption: "",
  transcript: "The HVAC units appear to be in good condition…",
  photo: Uint8Array | null,  // JPEG bytes; null for notes
  w: 1600, h: 1200,          // pixel dimensions; only on photo items
  noteType: "description" | "condition" | "rec",
  tier: "immediate" | "short" | "long" | undefined,
}
```

Photos are stored as `Uint8Array` (not `Blob`) so Safari can read them back after the IDB transaction closes. When rendering, the bytes are wrapped into a Blob and turned into an object URL.

---

## Section System

`sections.js` exports `SECTIONS` — an array of 29 objects `{ id, title }`. IDs follow the ASTM E2018-24 outline: `"3.2.1"`, `"4.4.1"`, `"5.2"`, etc. Helper functions:

```js
sectionTitle(id)   // "Heating, Air Conditioning, and Ventilation"
sectionLabel(id)   // "5.2 HVAC" (short label for the section picker)
groupOf(id)        // "Mechanical / Electrical / Fire" (picker group header)
```

`boilerplate.js` exports `SECTION_DEFAULTS` — a plain object keyed by section ID, each value `{ desc, cond, rec }`. These are the SM&E red-text defaults that pre-fill every section in the exported Word document. `NO_RECS` is the generic "No recommended Immediate Needs…" string used as a default `rec` for sections with no known issues. Sections with real rec lines (paving, foundation, exterior walls, etc.) have them spelled out as multi-line strings with `\n` separators.

---

## AI Integration (`ai.js`)

The app calls the Anthropic API directly from the browser using the `anthropic-dangerous-allow-browser: true` header. The API key is stored in `localStorage` on the user's device.

**Model:** `claude-sonnet-5-5`  
**Approx. cost per call:** ~$0.007 (1,300 input tokens + 250 user tokens + 200 output tokens)

### What gets sent

Every AI call includes three layers in the user message:

1. **Property context** — name, address, and client company pulled from `job.details`:
   ```
   Property: Jaguar Land Rover of Buckhead
   Address: 3975 Peachtree Road NE, Atlanta, GA 30319
   Client: Group 1 Realty, Inc.
   ```

2. **Boilerplate context** — first sentence of every non-null, non-generic default from `SECTION_DEFAULTS`, formatted compactly:
   ```
   Pre-filled defaults already in the report (supplement these, do not repeat…):
   3.2.1: cond: "The topography of the property is appropriate…"
   3.2.2: cond: "The storm water drainage systems appear to be in good condition."
   3.2.4: desc: "Concrete curbs were observed on the perimeter of property…" | rec: "Allowance to clean, seal coat, and stripe asphalt."
   …
   ```
   This keeps Claude from restating what's already on the page.

3. **Section list + raw field notes:**
   ```
   Available sections:
   3.2.1: Topography
   3.2.2: Storm Water Drainage
   …

   Field notes: "west lot is basically destroyed, alligator cracks everywhere"
   ```

### System prompt

The system prompt (~1,200 tokens) gives Claude:
- ASTM style rules (third person, present tense, significant counts in word+numeral form, no dollar amounts)
- Definitions of Description / Condition / Recommendation note types
- Timing tier rules (Immediate / Short-Term / Long-Term)
- Standard ASTM terms (EUL, RUL, deferred maintenance, etc.)
- 8 real before/after examples from the Buckhead report

### Output format

Claude returns a JSON object (no markdown fences):

```json
{
  "section": "3.2.4",
  "notes": [
    { "type": "condition", "tier": null, "text": "Substantial deterioration is apparent on the western parking lot…" }
  ]
}
```

`app.js` uses this to auto-switch the section picker if Claude identified a different section than the one currently open, then renders a preview of each note with an editable textarea. The user can tweak the text before saving.

---

## HVAC Table (`app.js` HVAC section)

When the user navigates to section 5.2, a structured input panel appears above the note list. Units are stored as `job.hvacUnits[]` and persisted with `db.putJob(job)` after each change.

### Generate HVAC Notes

Tapping **Generate HVAC notes** runs three pure functions — no AI call:

**`generateHvacDesc(units)`** — builds the Description note by grouping units by type, summing tonnage, and formatting using the ASTM word+numeral convention:
> "The buildings are provided with heated and conditioned air by a total of seventeen (17) units: eleven (11) rooftop package units (RTU), four (4) split systems, and two (2) mini-split units totaling 205.5 tons of conditioned air. The units are manufactured by Trane with refrigerant type R-410A."

**`generateHvacCond(units, baseYear)`** — groups cooling units by their EUL-based replacement year (`install_year + 15 - current_year + 1 = Year N`) and builds the Condition note:
> "The HVAC units appear to be in good condition. With an EUL of 15 years, replacement of four (4) units (54.5 tons) is anticipated in Year 3; two (2) units (22 tons) in Year 8."

**`generateHvacRec(units, baseYear)`** — builds one Recommendation line per replacement cohort:
> "Allowance to replace HVAC units (54.5 Tons) (Year 3)  
> Allowance to replace HVAC units (22 Tons) (Year 8)"

Each generated note is saved as a regular item (kind `"note"`, sectionId `"5.2"`) and shows in the standard note list. If you generate twice you'll get duplicate notes — delete the first set before regenerating.

---

## Word Export (`report.js`, `export.js`)

The Word document is built in-browser using `docx.js` (the `docx` npm package bundled as a single browser file).

### Color coding

| Color | Meaning | docx TextRun |
|-------|---------|--------------|
| Red `#EE0000` | SM&E boilerplate default | `new TextRun({ text, color: "EE0000" })` |
| Black | Assessor field notes | `new TextRun({ text })` |
| Grey italic | Unfilled placeholder | `new TextRun({ text: "[to complete]", italics: true, color: "808080" })` |

Red and black text appear in the **same paragraph** when both exist — `bpParagraph(bpText, noteTexts)` in `report.js` builds a single `Paragraph` whose `children` array contains a red run first, then one black run per note.

### Recommendation stacking rule

- If a section has **real boilerplate rec lines** (not just the generic "No recommended needs" placeholder) they always render in red.
- If the assessor has also written rec notes, they render below in black.
- The generic "No recommended Immediate Needs…" placeholder is **suppressed** when the assessor has their own rec notes (so it doesn't appear alongside them). It only appears alone when no assessor recs exist.

### Report outline

`report.js` has a linear `OUTLINE` array that drives the whole document:

```js
const OUTLINE = [
  { major: "3.0", title: "Property Characteristics" },
  "3.1", { head: "3.2", title: "Site Improvements" },
  "3.2.1", "3.2.2", … "3.2.12",
  { major: "4.0", title: "Structural Frame and Building Envelope" },
  …
];
```

String entries (`"3.2.1"`) go through `sectionBlock(id, heading, level, intro)` which builds the three-paragraph structure (description → Survey Condition and Analysis → Recommendations) by looking up boilerplate from `SECTION_DEFAULTS` and notes from the item map.

---

## Service Worker

`sw.js` uses a **cache-first with background refresh** strategy:

1. On install: pre-cache all app files and immediately activate (`skipWaiting`).
2. On fetch: serve from cache if present, **and also** kick off a network fetch to update the cache silently.
3. Old cache versions are deleted on activate.

The cache name (`pca-v11`) is bumped manually in `sw.js` whenever a new build ships, forcing the old cache to be replaced on next open.

The app only intercepts same-origin GET requests. API calls to `api.anthropic.com` pass through to the network.

---

## Deploy

Drag the `app/` folder to [Netlify Drop](https://app.netlify.com/drop). That's it. No build, no config file needed. The service worker installs on first load and the app works offline from then on.

The app is served from `index.html` with ES module scripts — no routing needed since it's a single-page app.

---

## Extending

**Adding a new section:** Add to `SECTIONS` in `sections.js`, add an entry to `SECTION_DEFAULTS` in `boilerplate.js`, and add the section ID to `OUTLINE` in `report.js`.

**Adding a property data field:** Add to the appropriate group in `fields.js`. It will appear in the More → Property data form automatically. Use `job.details[key]` to access it elsewhere.

**Changing the AI model or prompt:** Everything is in `ai.js`. The system prompt is `BASE_PROMPT`; the task instruction and output format are appended as `AI_PROMPT`. Boilerplate context is built at module load time from `SECTION_DEFAULTS`.
