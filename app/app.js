import { SECTIONS, sectionTitle, sectionLabel, groupOf } from "./sections.js";
import * as db from "./db.js";
import { buildReport } from "./export.js";
import { attachPlaceSearch } from "./places.js";
import { GROUPS } from "./fields.js";
import { splitNote } from "./ai.js";

const $ = id => document.getElementById(id);
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: k => { try { localStorage.removeItem(k); } catch {} },
};

let job = null;
let items = [];
let current = SECTIONS[0].id;
let urls = [];
let report = null; // prepared Word file, ready to save

const sectionOf = it => it.sectionId || "photo";

// ---------- section picker ----------
function buildPicker() {
  const sel = $("section");
  const groups = {};
  SECTIONS.forEach(s => {
    const g = groupOf(s.id);
    if (!groups[g]) { groups[g] = document.createElement("optgroup"); groups[g].label = g; sel.append(groups[g]); }
    groups[g].append(new Option(sectionLabel(s.id), s.id));
  });
  const saved = store.get("pca.section");
  current = SECTIONS.some(s => s.id === saved) ? saved : SECTIONS[0].id;
  sel.value = current;
}
function setSection(id) {
  current = id; $("section").value = id; store.set("pca.section", id);
  $("hvacpanel").hidden = (id !== "5.2");
  if (id === "5.2") renderHvacTable();
  renderItems();
}
$("section").onchange = e => setSection(e.target.value);
$("prev").onclick = () => { const i = SECTIONS.findIndex(s => s.id === current); if (i > 0) setSection(SECTIONS[i - 1].id); };
$("next").onclick = () => { const i = SECTIONS.findIndex(s => s.id === current); if (i < SECTIONS.length - 1) setSection(SECTIONS[i + 1].id); };
$("onlyhere").onchange = renderItems;

// ---------- screens ----------
function showMain() {
  $("setup").hidden = true; $("main").hidden = false; $("bar").hidden = false;
  $("hvacpanel").hidden = (current !== "5.2");
  if (current === "5.2") renderHvacTable();
}

async function showSetup() {
  $("main").hidden = true; $("bar").hidden = true; $("setup").hidden = false;
  $("title").textContent = "PCA Capture"; $("counts").textContent = "";
  const jobs = await db.listJobs();
  $("joblist").replaceChildren(...jobs.map(j => {
    const row = document.createElement("div"); row.className = "row"; row.style.marginBottom = "6px";
    const b = document.createElement("button");
    b.className = "alt job"; b.style.flex = "1"; b.style.marginBottom = "0"; b.textContent = `${j.name}  (${new Date(j.created).toLocaleDateString()})`;
    b.onclick = () => openJob(j.id);
    const del = document.createElement("button");
    del.className = "alt small"; del.textContent = "Delete"; del.style.width = "auto"; del.style.margin = "0";
    del.onclick = async () => {
      if (!confirm(`Delete "${j.name}" and all its photos and notes? This cannot be undone. (Tip: use "Save a backup file" first if you might want it back.)`)) return;
      await db.deleteJob(j.id);
      if (store.get("pca.job") === j.id) store.del("pca.job");
      if (job && job.id === j.id) { job = null; items = []; }
      showSetup();
    };
    row.append(b, del);
    return row;
  }));
}

async function openJob(id) {
  job = await db.getJob(id);
  if (!job) return showSetup();
  store.set("pca.job", id);
  report = null; $("saveReport").hidden = true;
  await load();
  loadPropFields();
  showMain();
}

$("startjob").onclick = async () => {
  const j = await db.newJob($("jobname").value.trim(), $("jobaddr1").value.trim(), $("jobaddr2").value.trim());
  $("jobname").value = ""; $("jobaddr1").value = ""; $("jobaddr2").value = "";
  openJob(j.id);
};

// Place search: one pick fills the name, street, and city/state/zip used across the whole report.
attachPlaceSearch($("placesearch"), $("placelist"), pl => {
  if (pl.name) $("jobname").value = pl.name;
  $("jobaddr1").value = pl.street;
  $("jobaddr2").value = pl.cityLine;
});
attachPlaceSearch($("edsearch"), $("edlist"), pl => {
  if (pl.name) $("edname").value = pl.name;
  $("edaddr1").value = pl.street;
  $("edaddr2").value = pl.cityLine;
  $("savedetails").click();
});

$("savedetails").onclick = async () => {
  job.name = $("edname").value.trim() || job.name;
  job.address1 = $("edaddr1").value.trim();
  job.address2 = $("edaddr2").value.trim();
  await db.putJob(job);
  dirty(); renderItems();
  $("status").textContent = "Property details saved.";
};
$("switch").onclick = showSetup;

async function load() { items = await db.jobItems(job.id); renderItems(); }

// ---------- property data form ----------
// Built once from fields.js GROUPS 1 (Property data) and 2 (Buildings table).
function buildPropForm() {
  const container = $("propfields");
  [GROUPS[1], GROUPS[2]].forEach(group => {
    const h = document.createElement("div");
    h.style.cssText = "font-size:13px;font-weight:600;color:#555;margin:12px 0 4px";
    h.textContent = group.title; container.append(h);
    group.fields.forEach(f => {
      const lbl = document.createElement("div");
      lbl.style.cssText = "font-size:13px;color:#555;margin-bottom:2px";
      lbl.textContent = f.l; container.append(lbl);
      const el = f.area ? document.createElement("textarea") : document.createElement("input");
      if (!f.area) el.type = "text";
      el.placeholder = f.ph || "";
      el.dataset.propKey = f.k;
      el.style.cssText = "width:100%;box-sizing:border-box;padding:8px;margin-bottom:6px;border:1px solid #bbb;border-radius:6px;font-size:15px";
      if (f.area) el.style.minHeight = "60px";
      container.append(el);
    });
  });
}

function loadPropFields() {
  const D = (job && job.details) || {};
  document.querySelectorAll("[data-prop-key]").forEach(el => {
    el.value = D[el.dataset.propKey] || "";
  });
}

$("saveprop").onclick = async () => {
  if (!job) return;
  if (!job.details) job.details = {};
  document.querySelectorAll("[data-prop-key]").forEach(el => {
    const v = el.value.trim();
    if (v) job.details[el.dataset.propKey] = v;
    else delete job.details[el.dataset.propKey];
  });
  await db.putJob(job);
  dirty();
  $("status").textContent = "Property data saved.";
};

// ---------- AI key ----------
$("savekey").onclick = () => {
  const k = $("apikey").value.trim();
  if (!k || k.startsWith("•")) return;
  localStorage.setItem("pca.apikey", k);
  $("apikey").value = "";
  $("apikey").placeholder = "Key saved — enter a new key to replace";
  $("status").textContent = "API key saved.";
};
if (localStorage.getItem("pca.apikey")) {
  $("apikey").placeholder = "Key saved — enter a new key to replace";
}

// ---------- list ----------
function renderItems() {
  if (!job) return;
  urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
  $("title").textContent = job.name;
  $("edname").value = job.name || ""; $("edaddr1").value = job.address1 || ""; $("edaddr2").value = job.address2 || "";
  const mine = items.filter(i => sectionOf(i) === current);
  const p = mine.filter(i => i.photo).length, n = mine.filter(i => !i.photo).length;
  $("counts").textContent = `This section: ${p} photo${p === 1 ? "" : "s"}, ${n} note${n === 1 ? "" : "s"}. Total: ${items.length} items.`;

  const only = $("onlyhere").checked;
  const list = [...items].reverse().filter(it => !only || sectionOf(it) === current);
  $("items").replaceChildren(...list.map(it => {
    const d = document.createElement("div"); d.className = "item";
    const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = sectionLabel(sectionOf(it)) + (it.photo ? "" : "  |  " + noteTag(it)); d.append(tag);
    if (it.photo) {
      const img = document.createElement("img");
      const photoBlob = it.photo instanceof Blob ? it.photo : new Blob([it.photo], { type: "image/jpeg" });
      const u = URL.createObjectURL(photoBlob); urls.push(u); img.src = u; d.append(img);
      const cap = document.createElement("input"); cap.type = "text"; cap.value = it.caption || "";
      cap.placeholder = `Caption (blank = "${sectionOf(it) === "photo" ? "View of the property" : "View of " + sectionTitle(sectionOf(it)).toLowerCase()}")`;
      cap.onchange = async () => { it.caption = cap.value; await db.putItem(it); report = null; $("saveReport").hidden = true; };
      d.append(cap);
    } else {
      const t = document.createElement("div"); t.textContent = it.transcript; t.style.whiteSpace = "pre-wrap"; d.append(t);
    }
    const tools = document.createElement("div"); tools.className = "tools";
    const move = document.createElement("select");
    move.append(new Option("Move to…", ""));
    SECTIONS.forEach(s => move.append(new Option(sectionLabel(s.id), s.id)));
    move.onchange = async () => { if (move.value) { it.sectionId = move.value; await db.putItem(it); report = null; $("saveReport").hidden = true; await load(); } };
    if (!it.photo) {
      const kind = document.createElement("select");
      kind.append(new Option("Change type…", ""));
      [["description", "Description"], ["condition", "Condition"], ["rec", "Recommendation"]]
        .forEach(([t, name]) => kind.append(new Option(name, t)));
      kind.onchange = async () => {
        if (!kind.value) return;
        it.noteType = kind.value; await db.putItem(it); dirty(); await load();
      };
      tools.append(kind);
    }
    const del = document.createElement("button"); del.className = "alt small"; del.textContent = "Delete";
    del.onclick = async () => { if (confirm("Delete this item?")) { await db.deleteItem(it.id); report = null; $("saveReport").hidden = true; await load(); } };
    tools.append(move, del); d.append(tools);
    return d;
  }));
}

function dirty() { report = null; $("saveReport").hidden = true; $("prep").textContent = "Prepare Word report"; }

// ---------- photos ----------
async function shrink(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
    if (blob) return { blob, w: c.width, h: c.height };
  } catch {}
  return { blob: file, w: 4, h: 3 };
}

// One tap: the photo is filed under the current section on the phone straight away.
$("cam").onchange = async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  $("status").textContent = "Saving photo…";
  try {
    const { blob, w, h } = await shrink(f);
    // Store as Uint8Array so Safari can read it back after the IDB transaction closes.
    const photo = new Uint8Array(await blob.arrayBuffer());
    await db.putItem({ id: db.uid(), jobId: job.id, ts: Date.now(), kind: "photo", sectionId: current, caption: "", transcript: "", photo, w, h });
    $("status").textContent = "Photo saved to " + sectionTitle(current) + ".";
    dirty(); await load();
  } catch (err) { $("status").textContent = "Photo NOT saved: " + err.message + " (take it again)"; }
};

// ---------- notes ----------
let noteType = "description";
let recTier = "short";
let preAiText = "";
const noteTypeOf = it => it.noteType || "description";

function noteTag(it) {
  const t = noteTypeOf(it);
  if (t === "condition") return "Condition";
  if (t === "rec") {
    const tier = it.tier === "immediate" ? "Immediate" : it.tier === "long" ? "Long-Term" : "Short-Term";
    return `Recommendation  |  ${tier}`;
  }
  return "Description";
}

function resetNoteBox() {
  $("text").value = "";
  $("splitpreview").hidden = true;
  $("undo").hidden = true;
  noteType = "description"; recTier = "short"; preAiText = "";
}

$("note").onclick = () => { $("notebox").hidden = false; $("text").focus(); };
$("cancelnote").onclick = () => { resetNoteBox(); $("notebox").hidden = true; };
function typeLabel(type, tier) {
  const name = type === "rec" ? "Recommendation" : type === "condition" ? "Condition" : "Description";
  const t = type === "rec" ? ` — ${tier === "immediate" ? "Immediate" : tier === "long" ? "Long-Term" : "Short-Term"}` : "";
  return name + t;
}

$("undo").onclick = () => {
  $("text").value = preAiText;
  $("splitpreview").hidden = true;
  $("undo").hidden = true;
  preAiText = "";
};

$("split").onclick = async () => {
  const t = $("text").value.trim();
  if (!t) return;
  $("split").disabled = true;
  $("split").textContent = "Working…";
  $("status").textContent = "";
  preAiText = t;
  try {
    const { section: detectedId, notes } = await splitNote(t, SECTIONS.filter(s => s.id !== "photo"), {
      name: job.name,
      address: [job.address1, job.address2].filter(Boolean).join(", "),
      client: (job.details && job.details.clientCompany) || "",
    });
    const validSection = SECTIONS.find(s => s.id === detectedId);
    if (validSection && detectedId !== current) setSection(detectedId);
    const preview = $("splitpreview");
    preview.replaceChildren();
    notes.forEach(note => {
      const wrap = document.createElement("div");
      wrap.style.cssText = "border:1px solid #bbb;border-radius:8px;padding:8px;margin-bottom:6px";
      const tag = document.createElement("span");
      tag.className = "tag"; tag.style.cssText = "display:block;margin-bottom:4px";
      tag.textContent = typeLabel(note.type, note.tier);
      const ta = document.createElement("textarea");
      ta.style.cssText = "width:100%;box-sizing:border-box;min-height:60px;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:15px;margin-top:4px;resize:vertical";
      ta.value = note.text;
      ta.dataset.noteType = note.type;
      ta.dataset.noteTier = note.tier || "";
      wrap.append(tag, ta);
      preview.append(wrap);
    });
    const saveAll = document.createElement("button");
    saveAll.textContent = notes.length === 1 ? "Save note" : `Save all ${notes.length} notes`;
    saveAll.style.cssText = "width:100%;margin-top:4px;padding:14px;background:var(--g);color:#fff;border:0;border-radius:10px;font-size:17px;cursor:pointer";
    saveAll.onclick = async () => {
      let saved = 0;
      for (const ta of preview.querySelectorAll("textarea")) {
        const text = ta.value.trim();
        if (!text) continue;
        await db.putItem({ id: db.uid(), jobId: job.id, ts: Date.now(), kind: "note", sectionId: current, caption: "", transcript: text, photo: null, noteType: ta.dataset.noteType, tier: ta.dataset.noteTier || undefined });
        saved++;
      }
      resetNoteBox();
      $("status").textContent = `${saved} note${saved === 1 ? "" : "s"} saved.`;
      $("text").focus();
      dirty(); await load();
    };
    preview.append(saveAll);
    preview.hidden = false;
    $("undo").hidden = false;
  } catch (err) {
    $("status").textContent = err.message === "no-key"
      ? "No API key — add one in More → AI."
      : "AI failed: " + err.message;
  } finally {
    $("split").disabled = false;
    $("split").textContent = "AI";
  }
};

$("savenote").onclick = async () => {
  const t = $("text").value.trim();
  if (!t) return;
  try {
    const tier = noteType === "rec" ? recTier : undefined;
    await db.putItem({ id: db.uid(), jobId: job.id, ts: Date.now(), kind: "note", sectionId: current, caption: "", transcript: t, photo: null, noteType, tier });
    resetNoteBox();
    $("status").textContent = "Note saved."; // box stays open for next note; Close hides it
    $("text").focus();
    dirty(); await load();
  } catch (err) { $("status").textContent = "Note NOT saved: " + err.message + " (your text is still here)"; }
};

// ---------- Word report: tap once to build, tap again to save/share ----------
const fileName = () => `PCA-${job.name.replace(/[^\w-]+/g, "_")}.docx`;

$("prep").onclick = async () => {
  $("prep").disabled = true; $("prep").textContent = "Building…";
  try {
    const blob = await buildReport(job, items);
    report = new File([blob], fileName(), { type: blob.type });
    $("saveReport").hidden = false; $("prep").textContent = "Rebuild Word report";
    $("status").textContent = "Report ready. Tap Save report.";
  } catch (err) { $("status").textContent = "Could not build report: " + err.message; $("prep").textContent = "Prepare Word report"; }
  $("prep").disabled = false;
};

function download(file) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

$("saveReport").onclick = async () => {
  if (!report) return;
  try {
    if (navigator.canShare && navigator.canShare({ files: [report] })) await navigator.share({ files: [report], title: job.name });
    else download(report);
  } catch (err) { if (err.name !== "AbortError") download(report); }
};

// ---------- backup / restore ----------
const toDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
const photoToDataUrl = async p => {
  if (!p) return null;
  const blob = p instanceof Blob ? p : new Blob([p], { type: "image/jpeg" });
  return toDataUrl(blob);
};

$("backup").onclick = async () => {
  const out = { version: 1, job, items: [] };
  for (const it of items) out.items.push({ ...it, photo: await photoToDataUrl(it.photo) });
  const file = new File([JSON.stringify(out)], `PCA-backup-${job.name.replace(/[^\w-]+/g, "_")}.json`, { type: "application/json" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    else download(file);
  } catch (err) { if (err.name !== "AbortError") download(file); }
};

$("restore").onchange = async e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    await db.putJob(data.job);
    for (const it of data.items) {
      const photo = it.photo ? new Uint8Array(await (await fetch(it.photo)).arrayBuffer()) : null;
      await db.putItem({ ...it, photo });
    }
    openJob(data.job.id);
  } catch (err) { alert("Could not restore that file: " + err.message); }
};

// ---------- HVAC table ----------
const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty","twenty-one","twenty-two","twenty-three","twenty-four","twenty-five","twenty-six","twenty-seven","twenty-eight","twenty-nine"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function toWords(n) {
  if (n < 30) return ONES[n] || String(n);
  if (n < 100) { const t = Math.floor(n/10), o = n%10; return TENS[t] + (o ? "-" + ONES[o] : ""); }
  return String(n);
}
function numPair(n) { return `${toWords(n)} (${n})`; }
function listAnd(arr) {
  if (!arr.length) return "";
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return arr[0] + " and " + arr[1];
  return arr.slice(0,-1).join(", ") + ", and " + arr[arr.length-1];
}

function generateHvacDesc(units) {
  const cooling = units.filter(u => ["RTU","Split","Mini-Split"].includes(u.type));
  const heaters = units.filter(u => u.type.startsWith("Heater"));
  if (!cooling.length && !heaters.length) return null;
  let text = "";
  if (cooling.length) {
    const rtuList = cooling.filter(u => u.type === "RTU");
    const splitList = cooling.filter(u => u.type === "Split");
    const miniList = cooling.filter(u => u.type === "Mini-Split");
    const totalTons = cooling.reduce((s,u) => s + (parseFloat(u.size)||0), 0);
    const coolMfrs = [...new Set(cooling.map(u => u.manufacturer).filter(Boolean))];
    const refrig = cooling.find(u => u.refrigerant)?.refrigerant || "R-410A";
    const typeParts = [];
    if (rtuList.length) typeParts.push(`${numPair(rtuList.length)} rooftop package unit${rtuList.length>1?"s":""} (RTU)`);
    if (splitList.length) typeParts.push(`${numPair(splitList.length)} split system${splitList.length>1?"s":""}`);
    if (miniList.length) typeParts.push(`${numPair(miniList.length)} mini-split unit${miniList.length>1?"s":""}`);
    text = `The building${cooling.length>1?"s are":" is"} provided with heated and conditioned air by a total of ${numPair(cooling.length)} unit${cooling.length>1?"s":""}: ${listAnd(typeParts)} totaling ${totalTons} tons of conditioned air.`;
    if (coolMfrs.length) text += ` The units are manufactured by ${listAnd(coolMfrs)} with refrigerant type ${refrig}.`;
  }
  if (heaters.length) {
    const heatMfrs = [...new Set(heaters.map(u => u.manufacturer).filter(Boolean))];
    text += (text ? " " : "") + `${numPair(heaters.length)} ceiling-mounted heater${heaters.length>1?"s":""} ${heaters.length>1?"were":"was"} observed${heatMfrs.length ? `, manufactured by ${listAnd(heatMfrs)}` : ""}.`;
  }
  return text;
}

function generateHvacCond(units, baseYear) {
  const cooling = units.filter(u => ["RTU","Split","Mini-Split"].includes(u.type));
  if (!cooling.length) return null;
  const EUL = 15;
  const replGroups = {};
  cooling.forEach(u => {
    if (!u.year) return;
    const relYear = parseInt(u.year) + EUL - baseYear + 1;
    if (!replGroups[relYear]) replGroups[relYear] = { tons: 0, count: 0 };
    replGroups[relYear].tons += parseFloat(u.size) || 0;
    replGroups[relYear].count++;
  });
  const sortedYears = Object.keys(replGroups).map(Number).sort((a,b) => a-b);
  let text = "The HVAC units appear to be in good condition.";
  if (sortedYears.length) {
    const EULstr = `With an EUL of ${EUL} years,`;
    if (sortedYears.length === 1) {
      const y = sortedYears[0]; const g = replGroups[y];
      text += ` ${EULstr} replacement of ${numPair(g.count)} unit${g.count>1?"s":""} (${g.tons} tons) is anticipated in Year ${y}.`;
    } else {
      text += ` ${EULstr} replacement is anticipated as follows: ` +
        sortedYears.map(y => { const g = replGroups[y]; return `${numPair(g.count)} unit${g.count>1?"s":""} (${g.tons} tons) in Year ${y}`; }).join("; ") + ".";
    }
  }
  return text;
}

function generateHvacRec(units, baseYear) {
  const cooling = units.filter(u => ["RTU","Split","Mini-Split"].includes(u.type));
  if (!cooling.length) return null;
  const EUL = 15;
  const replGroups = {};
  cooling.forEach(u => {
    if (!u.year) return;
    const relYear = parseInt(u.year) + EUL - baseYear + 1;
    if (relYear > 0) {
      if (!replGroups[relYear]) replGroups[relYear] = { tons: 0 };
      replGroups[relYear].tons += parseFloat(u.size) || 0;
    }
  });
  const sortedYears = Object.keys(replGroups).map(Number).sort((a,b) => a-b);
  if (!sortedYears.length) return null;
  return sortedYears.map(y => `Allowance to replace HVAC units (${replGroups[y].tons} Tons) (Year ${y})`).join("\n");
}

function renderHvacTable() {
  const units = (job && job.hvacUnits) || [];
  const tbl = $("hvactable");
  if (!units.length) {
    tbl.innerHTML = '<div style="color:#555;font-size:14px;padding:4px 0">No units logged yet.</div>';
    return;
  }
  const baseYear = new Date().getFullYear();
  const EUL = 15;
  const cooling = units.filter(u => ["RTU","Split","Mini-Split"].includes(u.type));
  const totalTons = cooling.reduce((s,u) => s + (parseFloat(u.size)||0), 0);
  tbl.replaceChildren();
  const summary = document.createElement("div");
  summary.style.cssText = "font-size:13px;color:#555;margin-bottom:6px";
  summary.textContent = `${units.length} unit${units.length>1?"s":""}, ${totalTons} tons total`;
  tbl.append(summary);
  units.forEach(u => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;align-items:center;padding:5px 0;border-top:1px solid #eee;font-size:14px";
    const age = u.year ? `${baseYear - u.year}yr` : "?yr";
    const replYear = u.year ? (parseInt(u.year) + EUL - baseYear + 1) : null;
    const replStr = replYear !== null ? `  → Yr ${replYear}` : "";
    const info = document.createElement("span");
    info.style.flex = "1";
    info.textContent = `${u.type}  ${u.manufacturer||"?"}  ${u.year||"?"}  (${age}${replStr})${u.size ? "  " + u.size + "T" : ""}${u.building ? "  |  " + u.building : ""}`;
    const del = document.createElement("button");
    del.className = "alt small"; del.textContent = "✕";
    del.onclick = async () => {
      job.hvacUnits = job.hvacUnits.filter(x => x.id !== u.id);
      await db.putJob(job); renderHvacTable();
    };
    row.append(info, del); tbl.append(row);
  });
}

$("addunit").onclick = async () => {
  if (!job) return;
  if (!job.hvacUnits) job.hvacUnits = [];
  job.hvacUnits.push({
    id: db.uid(),
    building: $("hvacbldg").value.trim(),
    type: $("hvactype").value,
    manufacturer: $("hvacmfr").value.trim(),
    year: parseInt($("hvacyear").value) || null,
    size: parseFloat($("hvacsize").value) || null,
    refrigerant: $("hvacrefrig").value.trim() || "R-410A",
  });
  await db.putJob(job);
  renderHvacTable();
  $("hvacmfr").value = ""; $("hvacyear").value = ""; $("hvacsize").value = ""; $("hvacbldg").value = "";
};

$("genhvac").onclick = async () => {
  if (!job || !job.hvacUnits?.length) { $("status").textContent = "No HVAC units logged yet."; return; }
  const baseYear = new Date().getFullYear();
  const descText = generateHvacDesc(job.hvacUnits);
  const condText = generateHvacCond(job.hvacUnits, baseYear);
  const recText = generateHvacRec(job.hvacUnits, baseYear);
  let saved = 0;
  const stamp = Date.now();
  if (descText) { await db.putItem({ id: db.uid(), jobId: job.id, ts: stamp, kind: "note", sectionId: "5.2", caption: "", transcript: descText, photo: null, noteType: "description" }); saved++; }
  if (condText) { await db.putItem({ id: db.uid(), jobId: job.id, ts: stamp+1, kind: "note", sectionId: "5.2", caption: "", transcript: condText, photo: null, noteType: "condition" }); saved++; }
  if (recText) { await db.putItem({ id: db.uid(), jobId: job.id, ts: stamp+2, kind: "note", sectionId: "5.2", caption: "", transcript: recText, photo: null, noteType: "rec", tier: "long" }); saved++; }
  $("status").textContent = `Generated ${saved} HVAC note${saved===1?"":"s"}.`;
  dirty(); await load();
};

// ---------- start ----------
// Shown under More so you can tell which build the phone is running. Keep in step with CACHE in sw.js.
const VERSION = "v23: fill in missing boilerplate from template doc";
$("version").textContent = "App version: " + VERSION;

async function init() {
  buildPicker();
  buildPropForm();
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch {}
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  const last = store.get("pca.job");
  if (last && (await db.getJob(last))) return openJob(last);
  showSetup();
}
init();
