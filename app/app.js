import { SECTIONS, sectionTitle, sectionLabel, groupOf } from "./sections.js";
import * as db from "./db.js";
import { buildReport } from "./export.js";
import { attachPlaceSearch } from "./places.js";

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
function setSection(id) { current = id; $("section").value = id; store.set("pca.section", id); renderItems(); }
$("section").onchange = e => setSection(e.target.value);
$("prev").onclick = () => { const i = SECTIONS.findIndex(s => s.id === current); if (i > 0) setSection(SECTIONS[i - 1].id); };
$("next").onclick = () => { const i = SECTIONS.findIndex(s => s.id === current); if (i < SECTIONS.length - 1) setSection(SECTIONS[i + 1].id); };
$("onlyhere").onchange = renderItems;

// ---------- screens ----------
function showMain() { $("setup").hidden = true; $("main").hidden = false; $("bar").hidden = false; }

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
      const img = document.createElement("img"); const u = URL.createObjectURL(it.photo); urls.push(u); img.src = u; d.append(img);
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
    await db.putItem({ id: db.uid(), jobId: job.id, ts: Date.now(), kind: "photo", sectionId: current, caption: "", transcript: "", photo: blob, w, h });
    $("status").textContent = "Photo saved to " + sectionTitle(current) + ".";
    dirty(); await load();
  } catch (err) { $("status").textContent = "Photo NOT saved: " + err.message + " (take it again)"; }
};

// ---------- notes ----------
// A note is a Description, a Survey Condition statement, or a Recommendation.
let noteType = "description";
const noteTypeOf = it => it.noteType || "description";
const NO_REC = "No recommended Immediate Needs, Short-Term Needs, or Long-Term Needs were observed or reported at the time of our walk-through.";

function noteTag(it) {
  const t = noteTypeOf(it);
  if (t === "condition") return "Condition";
  if (t === "rec") return "Recommendation";
  return "Description";
}

function syncChips() {
  document.querySelectorAll("[data-type]").forEach(b => b.classList.toggle("on", b.dataset.type === noteType));
  $("norec").hidden = noteType !== "rec";
}
document.querySelectorAll("[data-type]").forEach(b => { b.onclick = () => { noteType = b.dataset.type; syncChips(); }; });
$("norecbtn").onclick = () => { $("text").value = NO_REC; $("text").focus(); };

$("note").onclick = () => { syncChips(); $("notebox").hidden = false; $("text").focus(); };
$("cancelnote").onclick = () => { $("text").value = ""; $("notebox").hidden = true; };
$("savenote").onclick = async () => {
  const t = $("text").value.trim();
  if (!t) return;
  try {
    await db.putItem({ id: db.uid(), jobId: job.id, ts: Date.now(), kind: "note", sectionId: current, caption: "", transcript: t, photo: null, noteType });
    $("text").value = ""; $("status").textContent = "Note saved."; // box stays open for the next note; Close hides it
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

$("backup").onclick = async () => {
  const out = { version: 1, job, items: [] };
  for (const it of items) out.items.push({ ...it, photo: it.photo ? await toDataUrl(it.photo) : null });
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
      const photo = it.photo ? await (await fetch(it.photo)).blob() : null;
      await db.putItem({ ...it, photo });
    }
    openJob(data.job.id);
  } catch (err) { alert("Could not restore that file: " + err.message); }
};

// ---------- start ----------
// Shown under More so you can tell which build the phone is running. Keep in step with CACHE in sw.js.
const VERSION = "v8: place search";
$("version").textContent = "App version: " + VERSION;

async function init() {
  buildPicker();
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch {}
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  const last = store.get("pca.job");
  if (last && (await db.getJob(last))) return openJob(last);
  showSetup();
}
init();
