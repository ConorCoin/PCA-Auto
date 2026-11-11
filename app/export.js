// Builds the Word draft in the browser. `docx` is the global from vendor/docx.js.
import { sectionTitle, sectionOrder } from "./sections.js";
import { frontMatter } from "./frontmatter.js";
import { reportParts } from "./report.js";

// ---- Photo log block: framed photo, "Photograph: N | caption", then name | logo | address ----
const COLS = 8;
const COL_W = 1170;              // 8 x 1170 = 9360 twips = 6.5 in
const PHOTO_W = 590, PHOTO_H = 443; // fixed landscape frame (4:3), pixels at 96 dpi

// Rotate portrait photos to landscape and fit all photos to exactly PHOTO_W × PHOTO_H
// with a white letterbox. Returns new JPEG bytes.
async function normalizePhoto(bytes) {
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const img = await createImageBitmap(blob);
  const isPortrait = img.height > img.width;
  // Natural dimensions after rotation
  const natW = isPortrait ? img.height : img.width;
  const natH = isPortrait ? img.width : img.height;
  const scale = Math.min(PHOTO_W / natW, PHOTO_H / natH);
  const renderW = Math.round(natW * scale);
  const renderH = Math.round(natH * scale);
  const offX = Math.round((PHOTO_W - renderW) / 2);
  const offY = Math.round((PHOTO_H - renderH) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_W; canvas.height = PHOTO_H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  if (isPortrait) {
    // 90° clockwise: translate to top-right of destination, rotate, draw
    ctx.save();
    ctx.translate(offX + renderW, offY);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, renderH, renderW);
    ctx.restore();
  } else {
    ctx.drawImage(img, 0, 0, img.width, img.height, offX, offY, renderW, renderH);
  }
  return new Promise(resolve => {
    canvas.toBlob(async b => resolve(new Uint8Array(await b.arrayBuffer())), "image/jpeg", 0.92);
  });
}

async function loadLogo() {
  try {
    const res = await fetch("logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    return { data: new Uint8Array(await blob.arrayBuffer()), w: bmp.width, h: bmp.height };
  } catch { return null; }
}

function photoBlock(no, caption, bytes, job, logo) {
  const { Paragraph, TextRun, ImageRun, AlignmentType, Table, TableRow, TableCell, WidthType, TableLayoutType, VerticalAlign } = docx;
  const pw = PHOTO_W, ph = PHOTO_H; // photos are pre-normalized to fixed landscape dimensions
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
    const raw = it.photo instanceof Uint8Array ? it.photo : new Uint8Array(await it.photo.arrayBuffer());
    const bytes = await normalizePhoto(raw);
    photoLog.push(photoBlock(no, caption, bytes, job, logo));
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
