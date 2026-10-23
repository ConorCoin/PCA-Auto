// Standard report sections (1, 2, 10, 11, acronyms, figures/tables/appendix pages) and the observation body (3-9).
// Anything site-specific that the assessor has not provided prints as a grey placeholder.
import { SECTIONS, sectionTitle } from "./sections.js";
import * as B from "./boilerplate.js";

const GREY = "808080";
const TIERS = [
  ["immediate", "Recommended Immediate Needs"],
  ["short", "Recommended Short-Term Needs"],
  ["long", "Recommended Long-Term Needs"],
];
// Titles that differ from the on-phone picker labels.
const TITLE_OVERRIDE = { "6.1": "Parts/Service & Showroom/Office Buildings" };

// Report body outline: major sections, heading-only lines, and the section ids captured on the phone.
const OUTLINE = [
  { major: "3.0", title: "Property Characteristics" },
  "3.1", { head: "3.2", title: "Site Improvements" },
  "3.2.1", "3.2.2", "3.2.3", "3.2.4", "3.2.5", "3.2.6", "3.2.7", "3.2.8", "3.2.9", "3.2.10", "3.2.11", "3.2.12",
  { major: "4.0", title: "Structural Frame and Building Envelope" },
  "4.1", "4.2", { head: "4.3", title: "Facades or Curtain Walls" }, "4.3.1", "4.3.2", { head: "4.4", title: "Roof" }, "4.4.1",
  { major: "5.0", title: "Mechanical and Electrical Systems" },
  "5.1", "5.2", "5.3", "5.4", "5.5", { head: "5.6", title: "Life Safety and Fire Protection" }, "5.6.1",
  { major: "6.0", title: "Interior Elements" }, "6.1",
  { major: "7.0", title: "Non-ASTM Scope Considerations" }, "7.1",
  { major: "8.0", title: "Suspect Water Intrusion and Microbial Growth" }, "8",
  { major: "9.0", title: "Natural Hazard Information" }, "9",
];

export function reportParts(job, items, logo) {
  const { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, TableLayoutType, BorderStyle, AlignmentType, ShadingType } = docx;
  const D = job.details || {};
  const v = k => String(D[k] ?? "").trim();

  // ---------- small builders ----------
  const todo = (text = "[to complete]") => new TextRun({ text, italics: true, color: GREY });
  const P = (text, o = {}, po = {}) => new Paragraph({ children: [new TextRun({ text, ...o })], spacing: { after: 120 }, ...po });
  const PR = (runs, po = {}) => new Paragraph({ children: runs, spacing: { after: 120 }, ...po });
  const TODO = (text, po = {}) => PR([todo(text)], po);
  const bullet = (text, level = 0) => new Paragraph({ text, bullet: { level }, spacing: { after: 80 } });
  const major = (num, title) => [
    new Paragraph({ children: [new TextRun({ text: `SECTION ${num}`, bold: true, size: 20, color: "0B5D3B" })], pageBreakBefore: true, spacing: { after: 0 } }),
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
  ];
  const sub = (text, level = 2) => new Paragraph({ text, heading: level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, keepNext: true });
  const bold = text => P(text, { bold: true }, { keepNext: true });

  // Text with {client} replaced by the client's name, or a placeholder.
  const withClient = text => text.split("{client}").flatMap((part, i, arr) => {
    const r = [new TextRun({ text: part })];
    if (i < arr.length - 1) r.push(v("clientCompany") ? new TextRun({ text: v("clientCompany") }) : todo("[client]"));
    return r;
  });

  const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const table = (widths, rows, o = {}) => new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    ...(o.borderless ? { borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE } } : {}),
    rows: rows.map((r, ri) => new TableRow({
      cantSplit: true,
      children: r.map((c, ci) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        shading: o.header && ri === 0 ? { type: ShadingType.CLEAR, fill: "E6EFE9", color: "auto" } : undefined,
        margins: { top: 40, bottom: 40, left: 90, right: 90 },
        children: [new Paragraph({ children: [c === null ? todo("[ ]") : new TextRun({ text: c, size: 20, bold: !!(o.header && ri === 0) })] })],
      })),
    })),
  });

  // ---------- notes grouped by section ----------
  const notesBy = new Map();
  for (const it of items) {
    if (it.photo || !it.transcript) continue;
    const id = it.sectionId || "photo";
    if (!notesBy.has(id)) notesBy.set(id, []);
    notesBy.get(id).push(it);
  }
  const typeOf = n => n.noteType || "description";

  // A report subsection: description, Survey Condition and Analysis, Recommendations.
  function sectionBlock(id, heading, level, intro) {
    const notes = notesBy.get(id) || [];
    const visited = notes.length > 0;
    const out = [];
    if (heading) out.push(sub(heading, level));
    if (intro) out.push(P(intro));
    const desc = notes.filter(n => typeOf(n) === "description");
    desc.length ? desc.forEach(n => out.push(P(n.transcript))) : out.push(TODO());

    out.push(bold("Survey Condition and Analysis"));
    const cond = notes.filter(n => typeOf(n) === "condition");
    cond.length ? cond.forEach(n => out.push(P(n.transcript))) : out.push(TODO());

    out.push(bold("Recommendations:"));
    const recs = notes.filter(n => typeOf(n) === "rec");
    if (!visited) {
      out.push(TODO());
    } else {
      if (!recs.length) out.push(P("No Immediate Needs, Short-Term Needs, or Long-Term Needs were observed or reported at the time of our walk-through."));
      else if (!recs.some(n => n.tier === "immediate")) out.push(P("No recommended Immediate Needs were observed or reported at the time of our walk-through."));
      for (const [tier, label] of TIERS) {
        const r = recs.filter(n => (n.tier || "short") === tier);
        if (!r.length) continue;
        out.push(P(`${label}:`, { italics: true }, { keepNext: true }));
        r.forEach(n => out.push(bullet(n.transcript + (n.year ? ` (Year ${n.year})` : ""))));
      }
    }
    return out;
  }

  const parts = {};

  // ================= Acronyms =================
  parts.acronyms = () => {
    const half = Math.ceil(B.ACRONYMS.length / 2);
    const rows = [];
    for (let i = 0; i < half; i++) {
      const a = B.ACRONYMS[i] || ["", ""], b = B.ACRONYMS[i + half] || ["", ""];
      rows.push([a[0], a[1], b[0], b[1]].map(x => x || ""));
    }
    return [
      new Paragraph({ text: "Acronyms and Abbreviations", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
      table([900, 3780, 900, 3780], rows, { borderless: true }),
    ];
  };

  // ================= Section 1 =================
  parts.section1 = () => {
    const out = [...major("1.0", "Introduction")];
    for (const s of B.SECTION_1) {
      out.push(sub(s.h));
      for (const p of s.paras) {
        if (typeof p === "string") out.push(PR(withClient(p)));
        else out.push(PR([new TextRun({ text: p.b + "  ", bold: true }), new TextRun({ text: p.t })]));
      }
    }
    return out;
  };

  // ================= Section 2 =================
  parts.section2 = () => {
    const out = [...major("2.0", "Reconnaissance, Regulatory, and Document Review")];
    out.push(sub("2.1 Site Reconnaissance"));
    ["Date:", "Weather:", "Field Assessor:", "Escort:"].forEach(l => out.push(PR([new TextRun({ text: l + "  ", bold: true }), todo("[ ]")], { spacing: { after: 40 } })));
    out.push(P("The performance of this assessment was limited by the following condition(s):", {}, { spacing: { before: 120, after: 60 } }));
    out.push(PR([todo()], { spacing: { after: 120 } }));

    out.push(sub("2.2 Property Personnel Interviewed/Contacted"));
    out.push(P("The following personnel associated with the subject property were interviewed as part of the preparation of this report. Information obtained from the interviews is incorporated into the appropriate Sections of this report."));
    out.push(table([3000, 3180, 3180], [["Individual", "Position or Title", "Contact Number/Email"], [null, null, null]], { header: true }));
    (notesBy.get("2.2") || []).forEach(n => out.push(P(n.transcript, {}, { spacing: { before: 120, after: 60 } })));

    out.push(sub("2.3 Regulatory Compliance Inquiry", 2));
    for (const a of ["Building Codes:", "Fire or Life Safety:", "Zoning:"]) {
      out.push(PR([new TextRun({ text: a + "  ", bold: true }), todo("[agency]")], { spacing: { before: 120, after: 20 } }));
      out.push(PR([new TextRun({ text: "Contact:  " }), todo("[ ]"), new TextRun({ text: "     Telephone:  " }), todo("[ ]")], { spacing: { after: 20 } }));
      out.push(PR([new TextRun({ text: "Findings:  " }), todo("[No Violations / Violations / Awaiting response]")], { spacing: { after: 80 } }));
    }
    out.push(P(B.REGULATORY_DISCLAIMER, {}, { spacing: { before: 120 } }));

    out.push(sub("2.4 Document Review"));
    out.push(P("The following documents were readily available or provided to SM&E for reference as part of this assessment."));
    out.push(TODO("[list documents reviewed]"));

    out.push(sub("2.5 Limitations"));
    out.push(P("Limitations are summarized as follows:"));
    ["Access Limitations:", "Physical Obstructions to Observations:", "Outstanding Information Requests:"].forEach(l => {
      out.push(bullet(l));
      out.push(new Paragraph({ children: [todo()], indent: { left: 720 }, spacing: { after: 80 } }));
    });
    return out;
  };

  // ================= Sections 3-9 =================
  parts.body = () => {
    const out = [];
    for (const e of OUTLINE) {
      if (typeof e === "object" && e.major) {
        out.push(...major(e.major, e.title));
        if (e.major === "3.0") {
          out.push(TODO("[property characteristics summary: use, parcels, acreage, location, boundaries]"));
          (notesBy.get("photo") || []).forEach(n => out.push(P(n.transcript)));
        }
        if (e.major === "9.0") out.push(P(B.HAZARD_INTRO));
      } else if (typeof e === "object" && e.head) {
        out.push(sub(`${e.head} ${e.title}`, 2));
      } else if (e === "8") {
        out.push(...sectionBlock("8", null, 2, B.WATER_INTRO));
      } else if (e === "9") {
        (notesBy.get("9") || []).forEach(n => out.push(P(n.transcript)));
        [["9.1 Flood Zone", "[flood zone information]"], ["9.2 Seismic Zone", "[seismic zone information]"], ["9.3 Wind Zone", "[wind zone information]"]]
          .forEach(([h, t]) => { out.push(sub(h, 2)); out.push(TODO(t)); });
      } else {
        const title = TITLE_OVERRIDE[e] || sectionTitle(e);
        const level = e.split(".").length >= 3 ? 3 : 2;
        out.push(...sectionBlock(e, `${e} ${title}`, level, e === "7.1" ? B.ADA_INTRO : null));
      }
    }
    return out;
  };

  // ================= Sections 10 and 11 =================
  parts.section10 = () => [
    ...major("10.0", "Out of Scope Considerations"),
    P(B.OUT_OF_SCOPE_INTRO),
    ...B.OUT_OF_SCOPE.map(b => bullet(b.t, b.l)),
  ];
  parts.section11 = () => [...major("11.0", "Limitations"), ...B.LIMITATIONS_11.map(t => P(t))];

  // ================= Figures, tables, appendix stubs =================
  parts.figures = () => [
    new Paragraph({ text: "Figures", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
    ...["Figure 1: Site Location Map", "Figure 2: Site Plan", "Figure 3: Flood Zone Map"].flatMap(t => [bold(t), TODO("[to be inserted]")]),
    new Paragraph({ text: "Tables", heading: HeadingLevel.HEADING_1, spacing: { before: 360 } }),
    ...["Table 1: Immediate Repairs & Long-Term Cost Opinion", "Table 2: Needs Distribution of Long-Term Needs"].flatMap(t => [bold(t), TODO("[to be inserted]")]),
  ];
  parts.appendixHead = (letter, title) => new Paragraph({ text: `Appendix ${letter}: ${title}`, heading: HeadingLevel.HEADING_1, pageBreakBefore: true });
  parts.appendixStub = (letter, title) => [parts.appendixHead(letter, title), TODO("[to be inserted]")];

  return parts;
}
