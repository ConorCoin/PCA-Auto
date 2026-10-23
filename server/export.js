import fs from "node:fs";
import path from "node:path";
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
} from "docx";
import { SECTIONS } from "./sections.js";

const TIERS = [
  ["immediate", "Recommended Immediate Needs"],
  ["short", "Recommended Short-Term Needs"],
  ["long", "Recommended Long-Term Needs"],
];
const P = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 120 } });
const money = n => (n == null ? "" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const sectionOrder = id => SECTIONS.findIndex(s => s.id === id);

function cell(text) {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ""), size: 18 })] })] });
}

export async function buildReport(job, jobDir) {
  const sectionOf = it => it.sectionId || it.result?.section_id || "photo";

  // Notes become report text. A note the AI could not process is kept as raw text and flagged, never dropped.
  const notes = job.items
    .filter(i => i.kind !== "photo" && (i.result || i.transcript))
    .map(i => i.result ? i : {
      ...i,
      result: { description: i.transcript, condition: "", recommendations: [], needs_review: true, review_reason: "Unprocessed note, wording not yet in report style." },
    });
  const bySection = new Map();
  for (const it of notes) {
    const id = sectionOf(it);
    if (!bySection.has(id)) bySection.set(id, []);
    bySection.get(id).push(it);
  }

  // Photo log follows report section order (general views first), then the order taken within a section.
  const photoLog = [];
  for (const it of job.items) {
    it.photos.forEach((file, i) => {
      const sid = sectionOf(it);
      const title = (SECTIONS.find(s => s.id === sid)?.title ?? "the property").toLowerCase();
      photoLog.push({
        sid, ts: it.ts + i, file,
        caption: it.caption || it.result?.photo_captions?.[i] || `View of ${title}`,
      });
    });
  }
  photoLog.sort((a, b) => sectionOrder(a.sid) - sectionOrder(b.sid) || a.ts - b.ts);
  photoLog.forEach((p, i) => { p.no = i + 1; });

  const children = [];
  children.push(new Paragraph({ text: "Property Condition Assessment Report", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
  children.push(new Paragraph({ text: job.name, alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }));
  children.push(P(`DRAFT generated ${new Date().toLocaleDateString("en-US")}. Front matter, executive summary text, and boilerplate sections are not yet generated.`, { italics: true }));

  const costRows = [];
  const ordered = [...bySection.keys()].sort((a, b) => sectionOrder(a) - sectionOrder(b));
  for (const id of ordered) {
    const sec = SECTIONS.find(s => s.id === id);
    const group = bySection.get(id);
    children.push(new Paragraph({ text: `${id} ${sec?.title ?? id}`, heading: HeadingLevel.HEADING_2 }));
    group.map(g => g.result.description).filter(Boolean).forEach(d => children.push(P(d)));
    const cond = group.map(g => g.result.condition).filter(Boolean);
    if (cond.length) {
      children.push(P("Survey Condition and Analysis:", { bold: true }));
      cond.forEach(c => children.push(P(c)));
    }
    const recs = group.flatMap(g => g.result.recommendations || []);
    children.push(P("Recommendations:", { bold: true }));
    for (const [tier, label] of TIERS) {
      const r = recs.filter(x => x.tier === tier);
      if (!r.length) continue;
      children.push(P(`${label}:`, { italics: true }));
      for (const x of r) {
        children.push(new Paragraph({ text: x.year ? `${x.text} (Year ${x.year})` : x.text, bullet: { level: 0 } }));
        const total = x.quantity != null && x.unit_cost != null ? x.quantity * x.unit_cost : null;
        costRows.push({ id, tier, text: x.text, year: x.year, qty: x.quantity, unit: x.unit, unitCost: x.unit_cost, total });
      }
    }
    if (!recs.length) children.push(P("No recommended Immediate Needs, Short-Term Needs, or Long-Term Needs were observed or reported at the time of our walk-through."));
    const reviewNotes = group.filter(g => g.result.needs_review);
    if (reviewNotes.length) children.push(P(`[REVIEW] ${reviewNotes.map(g => g.result.review_reason).filter(Boolean).join(" ")}`, { color: "C00000" }));
  }

  if (costRows.length) {
    children.push(new Paragraph({ text: "Schedule of Material Physical Deficiencies", heading: HeadingLevel.HEADING_2 }));
    const head = ["Sect.", "Remedy", "Tier", "Year", "Qty", "Unit", "Unit Cost", "Total"];
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: head.map(cell) }),
        ...costRows.map(r => new TableRow({ children: [r.id, r.text, r.tier, r.year ?? "", r.qty ?? "", r.unit ?? "", money(r.unitCost), money(r.total)].map(cell) })),
      ],
    }));
  }

  if (photoLog.length) {
    children.push(new Paragraph({ text: "Photographic Log", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    for (const p of photoLog) {
      const file = path.join(jobDir, "photos", p.file);
      if (!fs.existsSync(file)) continue;
      children.push(new Paragraph({
        children: [new ImageRun({ type: path.extname(file).slice(1) === "png" ? "png" : "jpg", data: fs.readFileSync(file), transformation: { width: 360, height: 270 } })],
        alignment: AlignmentType.CENTER,
      }));
      children.push(new Paragraph({ children: [new TextRun({ text: `Photograph: ${p.no} ${p.caption}`, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 240 } }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
