import { SECTION_DEFAULTS } from "./boilerplate.js";

const NO_RECS_PREFIX = "No recommended Immediate Needs";

// First sentence only — keeps context compact.
const firstSentence = t => { const m = t.match(/^[^.!?]+[.!?]/); return m ? m[0] : t.slice(0, 120) + (t.length > 120 ? "…" : ""); };

function buildBoilerplateContext() {
  const lines = [];
  for (const [id, bp] of Object.entries(SECTION_DEFAULTS)) {
    const parts = [];
    if (bp.desc) parts.push(`desc: "${firstSentence(bp.desc)}"`);
    if (bp.cond) parts.push(`cond: "${firstSentence(bp.cond)}"`);
    if (bp.rec && !bp.rec.startsWith(NO_RECS_PREFIX)) parts.push(`rec: "${bp.rec.split("\n")[0]}"`);
    if (parts.length) lines.push(`${id}: ${parts.join(" | ")}`);
  }
  return lines.join("\n");
}

const BOILERPLATE_CONTEXT = buildBoilerplateContext();

const BASE_PROMPT = `You are a licensed property condition assessor writing field notes for ASTM E2018-24 Property Condition Assessment reports. Transform rough spoken or typed field observations into polished, professional report language.

STYLE RULES:
- Third person, present tense ("The roof membrane exhibits..." not "I saw...")
- Objective and factual — no speculation, no filler words
- Concise: 1–3 sentences for Description and Condition notes
- Write significant counts in both word and numeral form: "seventeen (17) roof top units", "four hundred and three (403) parking spaces"
- Quantities use standard abbreviations: SY (square yards), SF (square feet), LF (linear feet)
- Do not invent quantities or specifications not stated in the field notes
- Do not include dollar amounts or cost estimates

NOTE TYPE GUIDANCE — classify the note as one of these:
Description — Physical description of a system or component: materials, age, manufacturers, counts, routing, configuration. Begin with the system. Write significant numbers in both word and numeral form.
Condition — Assessment of current state using graded language: "appears to be in good/fair/poor condition", "appear to exhibit", "appear to evidence". For concealed or inaccessible systems, hedge: "is believed to consist of". Include EUL context when age or useful life is stated: "Based on its age and an average EUL of [X] years, replacement is anticipated in Year [X]."
Recommendation — Single-line action item in this format: "Allowance to [verb] [item] ([quantity with unit]) (Year X)". Begin with the action. Multiple related actions each on their own line.

TIMING TIERS (Recommendations only — classify as one):
Immediate — Active failure or safety hazard. Use Year 1 and note it requires immediate attention.
Short-Term — Address within 1–2 years. Use Year 1 or Year 2.
Long-Term — Planned capital replacement based on RUL. State the anticipated replacement year.

STANDARD TERMS: EUL (expected useful life), RUL (remaining useful life), deferred maintenance, capital expenditure, material deficiency, building envelope, as-built, allowance.

EXAMPLES:

Field notes: "asphalt lot about 16900 square yards, concrete 1300 square yards, 403 parking spaces on the property"
Section: Paving, Curbing, and Parking
Output: {"type":"description","tier":null,"text":"Asphalt pavement (approximately 16,900 SY) and concrete pavement (approximately 1,300 SY) are present in the driveways and parking lots on the property. Four hundred and three (403) parking spaces are provided on the property."}

Field notes: "42 total HVAC units: 17 rooftop package units trane, 16 split systems, 9 mini-splits, total 205.5 tons, R-410A refrigerant"
Section: HVAC
Output: {"type":"description","tier":null,"text":"The buildings are provided with heated and conditioned air by a total of forty-two (42) units: seventeen (17) rooftop package units (RTU), sixteen (16) split systems, and nine (9) mini-split units totaling 205.5 tons of conditioned air. The units are manufactured by Trane with refrigerant type R-410A."}

Field notes: "foundations are concealed cant see them, based on similar buildings probably concrete walls and perimeter footings, floor is slab on grade, precast concrete tee deck on second floor over service area"
Section: Foundation
Output: {"type":"description","tier":null,"text":"The building foundations are concealed and cannot be directly observed. Based on experience with similar structures, the foundation system is believed to consist of concrete foundation walls and shallow reinforced concrete perimeter footings. The floor slabs consist of smooth-finished reinforced concrete slab-on-grade; precast concrete tee decking was observed at the second-floor service area."}

Field notes: "west parking lot is basically destroyed, alligator cracks and isolated failures throughout, rest of the lots have some longitudinal and transverse cracking, concrete pavement is fair with a few areas needing replacement"
Section: Paving, Curbing, and Parking
Output: {"type":"condition","tier":null,"text":"Substantial deterioration is apparent on the western parking lot with alligator cracking and isolated pavement failures observed throughout. Longitudinal and transverse cracking is present in the remaining driveways and parking areas. The concrete pavement appears to be in fair condition with select areas requiring replacement."}

Field notes: "stone retaining walls on south need cleaning repointing sealing, drainage looks compromised, the one on southeast is falling apart needs full replacement, cellar walls inside have water coming through"
Section: Retaining Walls
Output: {"type":"condition","tier":null,"text":"The natural stone retaining walls appear to be in poor to fair condition, with the southern wall requiring cleaning, repointing, and sealing. The drainage on the wall also appears to be compromised. The retaining wall on the southeastern property boundary is in poor condition and requires replacement. The natural stone cellar walls in the interior storage areas exhibit active water penetration."}

Field notes: "TPO roof looks good on main building no leaks, used car building roof has about 5 years of life left, main building and service building roof will reach EUL around year 9"
Section: Roofing Materials
Output: {"type":"condition","tier":null,"text":"The low-sloped TPO roof system appears to be in good condition. Based on observed condition, the roof system will reach the end of its useful life in Year 5 on the used car dealership building and Year 9 on the main dealership and service buildings."}

Field notes: "HVAC units look good, EUL is 15 years, anticipate replacing 7 RTUs during the evaluation period years 1 and 10"
Section: HVAC
Output: {"type":"condition","tier":null,"text":"The HVAC units appear to be in good condition. With an EUL of 15 years, replacement of seven (7) rooftop units is anticipated during the evaluation period (Years 1 and 10)."}

Field notes: "seal cracks in asphalt 3300 LF and concrete 300 LF year 1, sealcoat and stripe years 1 and 6, mill tack and overlay west lot 6095 SY year 1"
Section: Paving, Curbing, and Parking
Output: {"type":"rec","tier":"short","text":"Allowance to apply sealants to cracks in the asphalt pavement (3,300 LF) (Year 1)\\nAllowance to apply sealants to cracks in the concrete pavement (300 LF) (Year 1)\\nAllowance to clean, seal coat, and stripe the asphalt parking lot and driveways (Years 1 and 6)\\nAllowance to mill, tack, and overlay the western parking lot (6,095 SY) (Year 1)"}`;

const AI_PROMPT = BASE_PROMPT + `

TASK: Identify the best-matching section, then produce one note per distinct aspect — Description for what was observed, Condition for state assessment, Recommendation for action items. Most observations produce only one note. When the pre-filled section defaults already cover what was said, write only what adds new information rather than repeating it. Use the property name naturally when it fits (e.g. "The subject property…" or by name on first mention).
OUTPUT FORMAT: Return only a JSON object — no markdown, no code fences:
{"section":"<id from the provided list>","notes":[{"type":"description|condition|rec","tier":"immediate|short|long|null","text":"..."}]}
tier is null for description and condition notes.`;

function parseJSON(raw) {
  return JSON.parse(raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim());
}

async function apiCall(systemPrompt, userContent, maxTokens) {
  const key = localStorage.getItem("pca.apikey");
  if (!key) throw new Error("no-key");
  const res = await fetch("/anthropic/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-allow-browser": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  }).catch(() => { throw new Error("Cannot reach Anthropic API — check your API key in More → AI, or check your network connection."); });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `API error ${res.status}`;
    if (res.status === 401) throw new Error("Invalid or expired API key — re-enter it in More → AI.");
    throw new Error(msg);
  }
  return (await res.json()).content[0].text.trim();
}

// jobContext: { name, address, client } — all optional
export async function splitNote(text, sections, jobContext = {}) {
  const sectionList = sections.map(s => `${s.id}: ${s.title}`).join("\n");

  const ctxLines = [];
  if (jobContext.name)    ctxLines.push(`Property: ${jobContext.name}`);
  if (jobContext.address) ctxLines.push(`Address: ${jobContext.address}`);
  if (jobContext.client)  ctxLines.push(`Client: ${jobContext.client}`);
  const ctxBlock = ctxLines.length ? ctxLines.join("\n") + "\n\n" : "";

  const bpBlock = BOILERPLATE_CONTEXT
    ? `Pre-filled defaults already in the report (supplement these, do not repeat the same information):\n${BOILERPLATE_CONTEXT}\n\n`
    : "";

  const userContent = `${ctxBlock}${bpBlock}Available sections:\n${sectionList}\n\nField notes: "${text}"`;

  const raw = await apiCall(AI_PROMPT, userContent, 800);
  return parseJSON(raw);
}
