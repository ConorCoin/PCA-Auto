// Builds the Word draft in the browser. `docx` is the global from vendor/docx.js.
import { SECTIONS, sectionTitle, sectionOrder } from "./sections.js";

const P = (text, opts = {}) => new docx.Paragraph({ children: [new docx.TextRun({ text, ...opts })], spacing: { after: 120 } });
const GREY = "808080";
const TIERS = [
  ["immediate", "Recommended Immediate Needs"],
  ["short", "Recommended Short-Term Needs"],
  ["long", "Recommended Long-Term Needs"],
];

// ---- Photo log block: framed photo, "Photograph: N | caption", then name | logo | address ----
const COLS = 8;
const COL_W = 1170;              // 8 x 1170 = 9360 twips = 6.5 in
const PHOTO_MAX_W = 590, PHOTO_MAX_H = 430; // pixels at 96 dpi

async function loadLogo() {
  try {
    const res = await fetch("logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    return { data: new Uint8Array(await blob.arrayBuffer()), w: bmp.width, h: bmp.height };
  } catch { return null; }
}

function photoBlock(no, caption, it, bytes, job, logo) {
  const { Paragraph, TextRun, ImageRun, AlignmentType, Table, TableRow, TableCell, WidthType, TableLayoutType, VerticalAlign } = docx;
  const fit = Math.min(PHOTO_MAX_W / (it.w || 4), PHOTO_MAX_H / (it.h || 3));
  const pw = Math.round((it.w || 4) * fit), ph = Math.round((it.h || 3) * fit);
  const cell = (span, children, opts = {}) => new TableCell({
    columnSpan: span, width: { size: span * COL_W, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 }, children, ...opts,
  });
  const run = (text, o = {}) => new TextRun({ text, italics: true, size: 22, ...o });
  const para = (runs, align = AlignmentType.LEFT, keepNext = false) => new Paragraph({ children: runs, alignment: align, keepNext });
  const addr = [job.address1, job.address2].filter(Boolean);

  const logoPara = logo
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: "png", data: logo.data, transformation: { width: 120, height: Math.round(120 * logo.h / logo.w) } })],
      })
    : new Paragraph("");

  return new Table({
    width: { size: COLS * COL_W, type: WidthType.DXA },
    columnWidths: Array(COLS).fill(COL_W),
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ cantSplit: true, children: [
        cell(COLS, [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [
          new ImageRun({ type: "jpg", data: bytes, transformation: { width: pw, height: ph } }),
        ] })]),
      ] }),
      new TableRow({ cantSplit: true, children: [
        cell(2, [para([run("Photograph:  ", { bold: true }), run(String(no), { bold: true })], AlignmentType.LEFT, true)]),
        cell(6, [para([run(caption)], AlignmentType.LEFT, true)]),
      ] }),
      new TableRow({ cantSplit: true, children: [
        cell(3, [para([run(job.name || "")])]),
        cell(2, [logoPara]),
        cell(3, addr.length ? addr.map(a => para([run(a)], AlignmentType.RIGHT)) : [para([run("")])]),
      ] }),
    ],
  });
}

export async function buildReport(job, items) {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun, AlignmentType } = docx;
  const sectionOf = it => it.sectionId || "photo";

  // Notes become section text. Sections with only photos get no heading; their photos go in the log.
  const bySection = new Map();
  for (const it of items) {
    if (it.kind === "photo" || !it.transcript) continue;
    const id = sectionOf(it);
    if (!bySection.has(id)) bySection.set(id, []);
    bySection.get(id).push(it);
  }

  const children = [];
  children.push(new Paragraph({ text: "Property Condition Assessment Report", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
  children.push(new Paragraph({ text: job.name, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
  children.push(P(`DRAFT generated ${new Date().toLocaleDateString("en-US")} from field notes. Front matter, executive summary, and standard sections are not included.`, { italics: true, color: GREY }));

  for (const id of [...bySection.keys()].sort((a, b) => sectionOrder(a) - sectionOrder(b))) {
    children.push(new Paragraph({ text: id === "photo" ? sectionTitle(id) : `${id} ${sectionTitle(id)}`, heading: HeadingLevel.HEADING_2 }));
    const notes = bySection.get(id);
    const ofType = t => notes.filter(n => (n.noteType || "description") === t);
    const todo = () => children.push(P("[to complete]", { italics: true, color: GREY }));

    ofType("description").forEach(n => children.push(P(n.transcript)));

    children.push(P("Survey Condition and Analysis:", { bold: true }));
    const cond = ofType("condition");
    cond.length ? cond.forEach(n => children.push(P(n.transcript))) : todo();

    children.push(P("Recommendations:", { bold: true }));
    const recs = ofType("rec");
    if (!recs.length) {
      children.push(P("No Immediate Needs, Short-Term Needs, or Long-Term Needs were observed or reported at the time of our walk-through."));
    } else if (!recs.some(n => n.tier === "immediate")) {
      children.push(P("No recommended Immediate Needs were observed or reported at the time of our walk-through."));
    }
    for (const [tier, label] of TIERS) {
      const r = recs.filter(n => (n.tier || "short") === tier);
      if (!r.length) continue;
      children.push(P(`${label}:`, { italics: true }));
      r.forEach(n => children.push(new Paragraph({ text: n.transcript, bullet: { level: 0 } })));
    }
  }

  // Photo log: report section order (general views first), then the order taken within a section.
  const photos = items
    .filter(i => i.photo)
    .sort((a, b) => sectionOrder(sectionOf(a)) - sectionOrder(sectionOf(b)) || a.ts - b.ts);

  if (photos.length) {
    children.push(new Paragraph({ text: "Photographic Log", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    const logo = await loadLogo();
    let no = 0;
    for (const it of photos) {
      no += 1;
      const caption = it.caption || (sectionOf(it) === "photo" ? "View of the property" : `View of ${sectionTitle(sectionOf(it)).toLowerCase()}`);
      const bytes = new Uint8Array(await it.photo.arrayBuffer());
      children.push(photoBlock(no, caption, it, bytes, job, logo));
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }
  }

  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
