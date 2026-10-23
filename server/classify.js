import Anthropic from "@anthropic-ai/sdk";
import { SECTIONS, SECTION_IDS } from "./sections.js";

const MODEL = process.env.PCA_MODEL || "claude-sonnet-5-5";

const TOOL = {
  name: "file_observation",
  description: "File a field observation into the correct section of the PCA report.",
  input_schema: {
    type: "object",
    properties: {
      section_id: { type: "string", enum: SECTION_IDS, description: "Best-fit report section." },
      confidence: { type: "number", description: "0-1 confidence in the section choice." },
      needs_review: { type: "boolean", description: "True if the section is ambiguous or key facts are missing." },
      review_reason: { type: "string" },
      description: { type: "string", description: "What exists (equipment, materials, quantities), report voice, past tense, third person. Empty if the note has none." },
      condition: { type: "string", description: "Survey Condition and Analysis sentence(s), report voice, e.g. 'The asphalt appeared to be in good condition.' Empty if not stated." },
      recommendations: {
        type: "array",
        description: "Only needs the assessor stated or clearly implied. Never invent costs.",
        items: {
          type: "object",
          properties: {
            tier: { type: "string", enum: ["immediate", "short", "long"] },
            text: { type: "string", description: "e.g. 'Clean, seal coat & stripe parking lot and driveways.'" },
            year: { type: ["integer", "null"], description: "Year in the evaluation term, if stated." },
            quantity: { type: ["number", "null"] },
            unit: { type: ["string", "null"], description: "SF, SY, LF, EA, LS..." },
            unit_cost: { type: ["number", "null"], description: "Only if the assessor said it." },
          },
          required: ["tier", "text"],
        },
      },
      photo_captions: {
        type: "array",
        items: { type: "string" },
        description: "One caption per attached photo, in order, in the style 'View of ... on the eastern portion of the dealership'.",
      },
    },
    required: ["section_id", "confidence", "needs_review", "description", "condition", "recommendations", "photo_captions"],
  },
};

const SYSTEM = `You are assisting a property condition assessor writing an ASTM E2018 PCA report.
The assessor speaks notes and takes photos while walking a site. File each item into exactly one report section.
Rules: use only facts from the transcript and what is visibly clear in the photos; never invent quantities, ages, or costs.
If the note is ambiguous, pick the best section and set needs_review. Write in the report's voice (third person, past tense, "appeared to be in good condition").
Sections:
${SECTIONS.map(s => `- ${s.id} ${s.title} (${s.hint})`).join("\n")}`;

export async function classify({ transcript, photos = [], sectionHint, currentSection }) {
  const client = new Anthropic();
  const content = [];
  for (const p of photos) {
    content.push({ type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } });
  }
  content.push({
    type: "text",
    text: [
      `Transcript: ${transcript || "(none, photo only)"}`,
      `Photos attached: ${photos.length}`,
      sectionHint ? `Assessor selected section: ${sectionHint}` : "",
      currentSection ? `Section of the previous item (assessor is probably still there): ${currentSection}` : "",
    ].filter(Boolean).join("\n"),
  });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "file_observation" },
    messages: [{ role: "user", content }],
  });
  const block = res.content.find(b => b.type === "tool_use");
  if (!block) throw new Error("Model returned no structured result");
  return block.input;
}
