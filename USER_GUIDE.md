# PCA Field App — User Guide

The PCA Field App lets you capture field observations on your phone while walking a property, then export a pre-formatted Word document that follows the SM&E / ASTM E2018-24 report structure.

---

## 1. First-Time Setup

### Add the app to your home screen
1. Open the app URL in **Safari** (iPhone) or **Chrome** (Android).
2. Tap the Share button → **Add to Home Screen**.
3. The app installs as a PWA — it works without signal once loaded.

### Add your API key
The AI button requires an Anthropic API key.

1. Open the app → tap **More** (bottom-right) → **AI**.
2. Paste your API key and tap Save.
3. The key is stored only on your device.

---

## 2. Starting a New Job

1. Tap **New Job** on the home screen.
2. Fill in the property details:
   - Property address
   - Client / addressee name
   - Report date
3. Tap **Open** to enter the job.

---

## 3. Capturing Field Notes

This is the core workflow. You can dictate or type for any section of the report.

### Step 1 — Pick a section (optional)
Tap the section name at the top of the screen to open the section picker. Sections follow the report structure:
- **Site** (3.1–3.2.12): topography, paving, retaining walls, signage, etc.
- **Structure & Roof** (4.1–4.4.1): foundation, frame, exterior walls, roofing
- **Mechanical / Electrical / Fire** (5.1–5.6.1): plumbing, HVAC, electrical, lighting, sprinklers
- **Interior and Other** (6.1, 7.1, 8, 9): interior elements, ADA, water intrusion, hazards

> **Tip:** You can skip this step entirely — just dictate and tap **AI**. The AI will figure out which section the note belongs to and switch automatically.

### Step 2 — Dictate or type your observation
Tap in the text box, then tap the **microphone key** on your keyboard to dictate. Speak naturally — don't worry about formal language.

**Examples of what to say:**
- *"TPO roof looks good on the main building, no signs of leaks, used car building roof has about 5 years of life left"*
- *"42 total HVAC units, 17 rooftop package units Trane, 16 split systems, 9 mini-splits, total 205.5 tons, R-410A refrigerant"*
- *"West parking lot is basically destroyed, alligator cracks and isolated failures throughout, rest of the lots have some longitudinal and transverse cracking"*

### Step 3 — Tap **AI**
The AI will:
1. Identify the best-matching report section (and switch to it if needed).
2. Rewrite your words into professional ASTM report language.
3. Classify the note as **Description**, **Condition**, or **Recommendation** — and return only one note if you only said one thing, or multiple notes if you covered more than one aspect.

A preview appears below the text box showing the proposed note(s).

### Step 4 — Save or undo
- Tap **Save note** (or **Save all X notes**) to add them to the report.
- Not happy with the result? Tap **Undo** to restore your original dictation and try again.

---

## 4. Note Types Explained

| Type | What it covers | Example |
|------|---------------|---------|
| **Description** | Physical description — materials, counts, dimensions, age | "Asphalt pavement (approx. 16,900 SY) and concrete pavement (approx. 1,300 SY) are present…" |
| **Condition** | Assessment of current state — good / fair / poor, EUL context | "The HVAC units appear to be in good condition. With an EUL of 15 years, replacement of seven (7) rooftop units is anticipated during the evaluation period (Years 1 and 10)." |
| **Recommendation** | Action item with year and quantity | "Allowance to replace the TPO roof on the used car sales building (3,000 SF) (Year 5)" |

---

## 5. Stacking Notes

If you dictate about the same section more than once, notes **stack**. Each AI call is independent and saves a new note. In the Word export, all Description notes for a section are combined into one paragraph, all Condition notes into another, and so on.

You can tap any saved note to **edit** or **delete** it before exporting.

---

## 6. Exporting to Word

When the walkthrough is complete:

1. Tap **Export** (download icon) in the job screen.
2. A `.docx` file downloads to your device.

### Reading the exported document

The Word document uses a **color-coding system** inherited from the SM&E report template:

| Color | Meaning |
|-------|---------|
| **Red text** | SM&E boilerplate default — pre-filled language from the template. Leave it, edit it, or replace it as needed. |
| **Black text** | Notes you captured in the field. |
| *Grey italic* | Placeholder — `[to complete]` — something that still needs to be filled in manually. |

**How red and black work together:** If a section has both a red default and your field notes, they appear in the same paragraph — red first, then your text. For Recommendations, your notes take full priority: if you recorded any recommendations for a section, the red default is suppressed entirely.

---

## 7. Working Offline

The app caches all files on first load. After that it works with no internet connection — photos, notes, and jobs are stored on your device. The **AI button** requires a connection (it calls the Anthropic API), but everything else works offline.

---

## 8. Tips

- **Don't overthink the section.** Just dictate what you see and let AI classify it. If it picks the wrong section, tap the section name and switch manually, then save.
- **Speak in measurements.** The AI preserves every quantity you say — say "sixteen thousand nine hundred square yards" or "16,900 square yards" and it will write "approximately 16,900 SY."
- **One thought at a time is fine.** You can say just the description, then later come back and say the condition. Notes stack — the export assembles them correctly.
- **Undo is your safety net.** If the AI output isn't right, tap Undo and your exact words come back.
