// Cover letter, title page and Executive Summary. Blank fields print as grey placeholders so they can be filled in later.
import { sectionOrder } from "./sections.js";
import { DEFAULTS } from "./fields.js";

const GREY = "808080";
const money = n => "$" + Math.round(n).toLocaleString("en-US");

export function frontMatter(job, items, logo) {
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, HeadingLevel, TableLayoutType, ShadingType } = docx;
  const D = job.details || {};
  const v = k => String(D[k] ?? DEFAULTS[k] ?? "").trim();

  // A run of text, or a grey placeholder when the value is blank.
  const run = (text, ph, o = {}) => (text ? new TextRun({ text, ...o }) : new TextRun({ text: ph, italics: true, color: GREY, ...o }));
  const para = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs], spacing: { after: 120 }, ...o });
  const plain = (text, o = {}, po = {}) => para(new TextRun({ text, ...o }), po);
  const field = (k, ph, o = {}, po = {}) => para(run(v(k), ph, o), po);
  const center = { alignment: AlignmentType.CENTER };

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const reportDate = v("reportDate") || today;
  const propName = job.name || "";
  const addr1 = job.address1 || "", addr2 = job.address2 || "";

  const logoPara = (w = 130, po = {}) => logo
    ? new Paragraph({ ...po, children: [new ImageRun({ type: "png", data: logo.data, transformation: { width: w, height: Math.round(w * logo.h / logo.w) } })] })
    : new Paragraph("");

  // ---------- table helper: cell = string, or null for a blank placeholder ----------
  const cellPara = (c, bold) => new Paragraph({ children: [c === null || c === "" ? new TextRun({ text: "[ ]", italics: true, color: GREY, size: 20 }) : new TextRun({ text: c, bold, size: 20 })] });
  const table = (widths, rows, headerRows = 1) => new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: rows.map((r, ri) => new TableRow({
      cantSplit: true,
      tableHeader: ri < headerRows,
      children: r.map((c, ci) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        shading: ri < headerRows ? { type: ShadingType.CLEAR, fill: "E6EFE9", color: "auto" } : undefined,
        margins: { top: 50, bottom: 50, left: 90, right: 90 },
        children: [cellPara(c, ri < headerRows)],
      })),
    })),
  });

  const out = [];

  // ================= Cover letter =================
  out.push(logoPara(150));
  out.push(plain(reportDate, {}, { spacing: { before: 240, after: 240 } }));
  [["clientContact", "[client contact]"], ["clientTitle", "[contact title]"], ["clientCompany", "[client company]"], ["clientAddr1", "[client address]"], ["clientAddr2", "[city, state, zip]"]]
    .forEach(([k, ph]) => out.push(field(k, ph, {}, { spacing: { after: 0 } })));
  out.push(plain("", {}, { spacing: { after: 120 } }));
  out.push(plain("RE:  Property Condition Assessment (PCA) Report", { bold: true }, { spacing: { after: 0 } }));
  out.push(para(run(propName, "[property name]", { bold: true }), { spacing: { after: 0 } }));
  out.push(para(run(addr1, "[street address]", { bold: true }), { spacing: { after: 0 } }));
  out.push(para(run(addr2, "[city, state]", { bold: true }), { spacing: { after: 0 } }));
  out.push(para([new TextRun({ text: "Inspection Date: ", bold: true }), run(v("inspectionDate"), "[inspection date]", { bold: true })], { spacing: { after: 240 } }));
  out.push(para([new TextRun({ text: "Dear " }), run(v("clientContact"), "[client contact]"), new TextRun({ text: "," })]));
  out.push(plain("Southern Monitoring & Environmental, LLC (SM&E) has completed the authorized Property Condition Assessment (PCA) Survey for the above referenced property. The assessment was performed in conformance with the scope and limitations set forth by ASTM E2018-24 “Standard Guide to Property Condition Assessments: Baseline Property Condition Assessment Process”."));
  out.push(para([new TextRun({ text: "If you have any questions regarding this report or if we may be of further service to you, please contact the undersigned at " }), run(v("inspectorPhone"), "[phone]"), new TextRun({ text: "." })]));
  out.push(plain("Sincerely,", {}, { spacing: { before: 240, after: 600 } }));
  out.push(field("inspectorName", "[inspector name]", {}, { spacing: { after: 0 } }));
  out.push(field("inspectorTitle", "[inspector title]", {}, { spacing: { after: 120 } }));
  out.push(plain("Enclosure: PCA Report"));
  out.push(plain("Atlanta, Georgia  │  Jacksonville, Florida", { size: 18, color: GREY }, { alignment: AlignmentType.CENTER, spacing: { before: 600 } }));

  // ================= Title page =================
  out.push(logoPara(180, { alignment: AlignmentType.CENTER, pageBreakBefore: true, spacing: { after: 480 } }));
  out.push(plain("Property Condition Assessment Report", { bold: true, size: 44 }, { ...center, spacing: { after: 240 } }));
  out.push(para(run(propName, "[property name]", { bold: true, size: 36 }), { ...center, spacing: { after: 120 } }));
  out.push(para(run(addr1, "[street address]", { size: 26 }), { ...center, spacing: { after: 0 } }));
  out.push(para(run(addr2, "[city, state, zip]", { size: 26 }), { ...center, spacing: { after: 480 } }));
  out.push(plain("Prepared For:", { bold: true }, { ...center, spacing: { after: 60 } }));
  [["clientCompany", "[client company]"], ["clientAddr1", "[client address]"], ["clientAddr2", "[city, state, zip]"]]
    .forEach(([k, ph]) => out.push(field(k, ph, {}, { ...center, spacing: { after: 0 } })));
  out.push(plain("Prepared By:", { bold: true }, { ...center, spacing: { before: 360, after: 60 } }));
  ["Southern Monitoring & Environmental, LLC", "7265 Wingfield Way", "Cumming, GA 30041"].forEach(t => out.push(plain(t, {}, { ...center, spacing: { after: 0 } })));
  out.push(plain(reportDate.toUpperCase(), { bold: true }, { ...center, spacing: { before: 480 } }));

  // ================= Executive Summary =================
  out.push(new Paragraph({ text: "Executive Summary", heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
  out.push(plain("Southern Monitoring & Environmental, LLC (SM&E) has performed a property condition assessment (PCA) of the parcels and improvements defined in the following table (the “subject property”). The assessment was performed in accordance with ASTM E2018-24 “Standard Guide for Property Condition Assessments: Baseline Property Condition Assessment Process”. The purpose of this Property Condition Assessment was to observe and document readily-visible materials and building system defects that might significantly affect the value of the subject property, and determine if conditions exist which may have a significant impact on the continued operation of the facility during the evaluation period."));

  out.push(plain("Property Data", { bold: true }, { spacing: { before: 200, after: 80 } }));
  const val = k => v(k) || null;
  out.push(table([3000, 6360], [
    ["Name", propName || null],
    ["Address", addr1 || null],
    ["City, State and Zip Code", addr2 || null],
    ["Property use", val("use")],
    ["Land acreage (acres)", val("acreage")],
    ["Number of buildings", val("numBuildings")],
    ["Number of floors", val("floors")],
    ["Year Built", val("yearBuilt")],
    ["Gross building area (SF)", val("grossArea")],
    ["Foundation/Substructure", val("foundation")],
    ["Superstructure", val("superstructure")],
    ["Facade", val("facade")],
    ["Roof Type", val("roofType")],
    ["Parking area", val("parkingArea")],
    ["Parking space count", val("parkingCount")],
    ["ADA-designated parking count", val("adaParking")],
    ["HVAC system", val("hvac")],
    ["Water supply piping", val("waterPiping")],
    ["Electrical branch wiring", val("wiring")],
    ["Number of elevators", val("elevators")],
    ["Fire suppression", val("fireSuppression")],
    ["Fire Alarm", val("fireAlarm")],
  ], 0));

  out.push(plain("The buildings on the subject property are further described as follows:", {}, { spacing: { before: 200, after: 80 } }));
  const bRows = [1, 2, 3].map(n => [v(`b${n}Name`), v(`b${n}Area`), v(`b${n}Year`)]).filter(r => r.some(Boolean));
  if (!bRows.length) bRows.push([null, null, null]);
  out.push(table([2700, 2900, 1900, 1860], [
    ["Structure", "Address", "Building Area (SF)", "Construction Date"],
    ...bRows.map((r, i) => [r[0] || null, i === 0 ? [addr1, addr2].filter(Boolean).join(", ") : "", r[1] || null, r[2] || null]),
  ]));

  const summary = (title, k) => {
    out.push(plain(title, { bold: true }, { spacing: { before: 200, after: 60 }, keepNext: true }));
    out.push(field(k, "[to complete]"));
  };
  summary("Overall General Condition", "overall");
  summary("Level of Preventative Maintenance", "maintenance");
  summary("Summary of Significant Deferred Maintenance Items (>$3,000)", "deferred");
  summary("Summary of Significant Pending or In-Progress Capital Improvements (>$25,000)", "pending");
  summary("Summary of Significant Recently Completed Capital Improvements (>$25,000)", "completed");

  out.push(plain("Immediate and Short-Term Repair Items", { bold: true }, { spacing: { before: 200, after: 60 }, keepNext: true }));
  out.push(plain("This report presents opinions of costs for items or conditions that require immediate action as a result of the following: Material existing or potentially unsafe conditions, material code violations, or any other physical deficiencies that if left uncorrected would be expected to result in or contribute to the failure of critical elements or systems within one year or may result in a significant increase in remedial costs. These items should be addressed at the first practical opportunity."));
  out.push(plain("In addition, this report presents opinions of costs for items or conditions that may not require immediate action, but should be conducted on a priority basis above and beyond routine maintenance. Generally, the recommended time frame for addressing these items is two years. Deferred maintenance items and/or physical deficiencies that are considered significant are also identified in Table 1 - Immediate Repair and Long Term Cost Opinion."));
  out.push(plain("Reserve Items", { bold: true }, { spacing: { before: 200, after: 60 }, keepNext: true }));
  out.push(plain("In accordance with the terms under which this assessment was performed, this report includes opinions of costs for capital replacement reserve items that are anticipated to occur during a specified evaluation period. These items are identified in Table 2 – Needs Distribution of Long-Term Needs. Systems or components that are present at the subject property, but not listed in Table 2, are expected to realize a useful life that exceeds the evaluation period."));

  // ---------- Schedule of Material Physical Deficiencies, from the Recommendation notes ----------
  const recs = items
    .filter(i => !i.photo && (i.noteType === "rec") && i.transcript && !/^No recommended/i.test(i.transcript))
    .sort((a, b) => sectionOrder(a.sectionId || "photo") - sectionOrder(b.sectionId || "photo") || a.ts - b.ts);
  out.push(plain("Schedule of Material Physical Deficiencies Summary", { bold: true }, { spacing: { before: 240, after: 80 }, keepNext: true }));
  const rows = [["Sect. #", "Remedy", "Immediate Needs", "Short-Term Needs", "Long-Term Needs"]];
  for (const r of recs) {
    const tier = r.tier || "short";
    const cost = r.cost != null && r.cost !== "" ? money(r.cost) : "";
    const remedy = r.transcript + (r.year ? ` (Year ${r.year})` : "");
    rows.push([r.sectionId === "photo" ? "" : (r.sectionId || ""), remedy, tier === "immediate" ? cost : "", tier === "short" ? cost : "", tier === "long" ? cost : ""]);
  }
  if (rows.length === 1) rows.push(["", "None recorded", "", "", ""]);
  out.push(table([900, 4160, 1400, 1450, 1450], rows));
  out.push(plain("The costs listed are based on SMEs’ historical cost for like items and is not intended to be an estimate for the work to be performed. Other contributing factors including inflationary, regional or contractor costs will affect the actual cost of the repair items throughout the term. SM&E recommends that the end user of this report obtain estimates from licensed contractors for specific work items to determine the actual cost for repairs.", { size: 18 }, { spacing: { before: 120 } }));

  // ---------- Opinion of Costs summary (computed from the recommendation costs) ----------
  const term = Number(v("term")) || 10;
  const rate = (Number(v("inflation")) || 0) / 100;
  const sf = Number(String(v("sfNumber")).replace(/[^\d.]/g, "")) || 0;
  const sum = list => list.reduce((a, r) => a + (Number(r.cost) || 0), 0);
  const immediate = sum(recs.filter(r => r.tier === "immediate"));
  const shortOnly = sum(recs.filter(r => (r.tier || "short") === "short"));
  const later = recs.filter(r => r.tier !== "immediate");
  const uninflated = sum(later);
  const inflated = later.reduce((a, r) => a + (Number(r.cost) || 0) * Math.pow(1 + rate, Number(r.year) || 0), 0);
  const anyCost = recs.some(r => Number(r.cost) > 0);
  const m = x => (anyCost ? money(x) : null); // no costs entered yet: leave blank, not $0
  const perSf = x => (anyCost && sf ? "$" + (x / sf / term).toFixed(2) : null);
  out.push(plain("Opinion of Costs", { bold: true }, { spacing: { before: 240, after: 80 }, keepNext: true }));
  out.push(table([6200, 3160], [
    ["Opinion of Costs Summary", ""],
    ["Total Evaluation Term (yrs):", String(term)],
    ["Inflation Factor:", (rate * 100).toFixed(2) + "%"],
    ["Opinion of Costs: Immediate", m(immediate)],
    ["Opinion of Costs: Short-Term", m(shortOnly)],
    ["Opinion of Costs: Short/Long-Term-Uninflated", m(uninflated)],
    ["Opinion of Costs: Short/Long-Term-Inflated", m(inflated)],
    ["Opinion of Costs: Short/Long-Term-Uninflated ($/SF/Yr)", perSf(uninflated)],
    ["Opinion of Costs: Short/Long-Term-Inflated ($/SF/Yr)", perSf(inflated)],
  ]));

  out.push(plain("Recommendations of Additional Investigations", { bold: true }, { spacing: { before: 240, after: 60 }, keepNext: true }));
  out.push(field("investigations", "[to complete]"));
  out.push(plain("Cost Exclusions", { bold: true }, { spacing: { before: 200, after: 60 }, keepNext: true }));
  out.push(plain("This report excludes costs for systems or components that are reported to be a tenant responsibility to maintain and replace, that are generally associated with the normal operation of the subject property, that are part and parcel of a building renovation program, for enhancements to reposition the subject property within the marketplace, for work that is cosmetic or decorative, for work that is being conducted for warranty transfer purposes, and routine maintenance activities. This report also excludes costs that are below the reporting threshold established by the engagement agreement."));

  return out;
}
