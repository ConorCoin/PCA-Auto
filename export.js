// Builds the Word draft in the browser. `docx` is the global from vendor/docx.js.
import { SECTIONS, sectionTitle, sectionOrder } from "./sections.js";

const P = (text, opts = {}) => new docx.Paragraph({ children: [new docx.TextRun({ text, ...opts })], spacing: { after: 120 } });
const GREY = "808080";

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
    bySection.get(id).forEach(n => children.push(P(n.transcript)));
    children.push(P("Survey Condition and Analysis:", { bold: true }));
    children.push(P("[to complete]", { italics: true, color: GREY }));
    children.push(P("Recommendations:", { bold: true }));
    children.push(P("[to complete]", { italics: true, color: GREY }));
  }

  // Photo log: report section order (general views first), then the order taken within a section.
  const photos = items
    .filter(i => i.photo)
    .sort((a, b) => sectionOrder(sectionOf(a)) - sectionOrder(sectionOf(b)) || a.ts - b.ts);

  if (photos.length) {
    children.push(new Paragraph({ text: "Photographic Log", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    let no = 0;
    for (const it of photos) {
      no += 1;
      const w = 380;
      const h = Math.round(w * ((it.h || 3) / (it.w || 4)));
      const data = new Uint8Array(await it.photo.arrayBuffer());
      const caption = it.caption || (sectionOf(it) === "photo" ? "View of the property" : `View of ${sectionTitle(sectionOf(it)).toLowerCase()}`);
      children.push(new Paragraph({ children: [new ImageRun({ type: "jpg", data, transformation: { width: w, height: h } })], alignment: AlignmentType.CENTER }));
      children.push(new Paragraph({ children: [new TextRun({ text: `Photograph: ${no} ${caption}`, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 240 } }));
    }
  }

  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
