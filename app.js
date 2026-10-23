import { SECTIONS, sectionTitle, sectionLabel, groupOf } from "./sections.js";
import * as db from "./db.js";
import { buildReport } from "./export.js";

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
    const b = document.createElement("button");
    b.className = "alt job"; b.textContent = `${j.name}  (${new Date(j.created).toLocaleDateString()})`;
    b.onclick = () => openJob(j.id);
    return b;
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
  const j = await db.newJob($("jobname").value.trim());
  $("jobname").value = "";
  openJob(j.id);
};
$("switch").onclick = showSetup;

async function load() { items = await db.jobItems(job.id); renderItems(); }

// ---------- list ----------
function renderItems() {
  if (!job) return;
  urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
  $("title").textContent = job.name;
  const mine = items.filter(i => sectionOf(i) === current);
  const p = mine.filter(i => i.photo).length, n = mine.filter(i => !i.photo).length;
  $("counts").textContent = `This section: ${p} photo${p === 1 ? "" : "s"}, ${n} note${n === 1 ? "" : "s"}. Total: ${items.length} items.`;

  const only = $("onlyhere").checked;
  const list = [...items].reverse().filter(it => !only || sectionOf(it) === current);
  $("items").replaceChildren(...list.map(it => {
    const d = document.createElement("div"); d.className = "item";
    const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = sectionLabel(sectionOf(it)); d.append(tag);
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
$("note").onclick = () => { $("notebox").hidden = false; $("text").focus(); };
$("cancelnote").onclick = () => { $("text").value = ""; $("notebox").hidden = true; };
$("savenote").onclick = async () => {
  const t = $("text").value.trim();
  if (!t) return;
  try {
    await db.putItem({ id: db.uid(), jobId: job.id, ts: Date.now(), kind: "note", sectionId: current, caption: "", transcript: t, photo: null });
    $("text").value = ""; $("notebox").hidden = true; $("status").textContent = "Note saved.";
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
async function init() {
  buildPicker();
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch {}
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  const last = store.get("pca.job");
  if (last && (await db.getJob(last))) return openJob(last);
  showSetup();
}
init();
