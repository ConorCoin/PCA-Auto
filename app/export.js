// Builds the Word draft in the browser. `docx` is the global from vendor/docx.js.
import { sectionTitle, sectionOrder } from "./sections.js";
import { frontMatter } from "./frontmatter.js";
import { reportParts } from "./report.js";

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
  const { Document, Packer, Paragraph, HeadingLevel } = docx;
  const sectionOf = it => it.sectionId || "photo";
  const logo = await loadLogo();
  const R = reportParts(job, items, logo);

  // Appendix A: photo log in report section order (general views first), then the order taken within a section.
  const photos = items
    .filter(i => i.photo)
    .sort((a, b) => sectionOrder(sectionOf(a)) - sectionOrder(sectionOf(b)) || a.ts - b.ts);
  const photoLog = [R.appendixHead("A", "Photographic Log")];
  if (!photos.length) photoLog.push(new Paragraph({ text: "No photographs were taken." }));
  let no = 0;
  for (const it of photos) {
    no += 1;
    const caption = it.caption || (sectionOf(it) === "photo" ? "View of the property" : `View of ${sectionTitle(sectionOf(it)).toLowerCase()}`);
    const bytes = new Uint8Array(await it.photo.arrayBuffer());
    photoLog.push(photoBlock(no, caption, it, bytes, job, logo));
    photoLog.push(new Paragraph({ spacing: { after: 160 } }));
  }

  const children = [
    ...frontMatter(job, items, logo),
    ...R.acronyms(),
    ...R.section1(),
    ...R.section2(),
    ...R.body(),
    ...R.section10(),
    ...R.section11(),
    ...R.figures(),
    ...photoLog,
    ...R.appendixStub("B", "Tax Assessor Information"),
    ...R.appendixStub("C", "Qualifications"),
  ];
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
