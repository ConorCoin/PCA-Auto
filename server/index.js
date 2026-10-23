import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { classify } from "./classify.js";
import { buildReport } from "./export.js";
import { SECTIONS } from "./sections.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data", "jobs");
fs.mkdirSync(DATA, { recursive: true });

const app = express();
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const jobDir = id => path.join(DATA, path.basename(id));
const jobFile = id => path.join(jobDir(id), "job.json");
const load = id => (fs.existsSync(jobFile(id)) ? JSON.parse(fs.readFileSync(jobFile(id), "utf8")) : null);
const save = job => fs.writeFileSync(jobFile(job.id), JSON.stringify(job, null, 2));

app.get("/api/sections", (_req, res) => res.json(SECTIONS.map(({ id, title }) => ({ id, title }))));

app.post("/api/jobs", (req, res) => {
  const id = crypto.randomBytes(4).toString("hex");
  fs.mkdirSync(path.join(jobDir(id), "photos"), { recursive: true });
  const job = { id, name: req.body?.name || "Untitled property", created: Date.now(), items: [] };
  save(job);
  res.json(job);
});

app.get("/api/jobs/:id", (req, res) => {
  const job = load(req.params.id);
  job ? res.json(job) : res.status(404).json({ error: "not found" });
});

app.get("/api/jobs/:id/photos/:file", (req, res) =>
  res.sendFile(path.join(jobDir(req.params.id), "photos", path.basename(req.params.file))));

app.post("/api/jobs/:id/items", upload.array("photos", 10), async (req, res) => {
  const job = load(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  const saved = (req.files || []).map(f => {
    const ext = f.mimetype === "image/png" ? "png" : "jpg";
    const name = `${crypto.randomBytes(5).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(jobDir(job.id), "photos", name), f.buffer);
    return { name, mediaType: ext === "png" ? "image/png" : "image/jpeg", data: f.buffer.toString("base64") };
  });
  const item = {
    id: crypto.randomBytes(4).toString("hex"),
    ts: Date.now(),
    transcript: req.body.transcript || "",
    photos: saved.map(s => s.name),
    sectionId: req.body.section || null, // the assessor's manual choice overrides the model
    result: null,
    error: null,
  };
  const prev = [...job.items].reverse().find(i => i.result);
  try {
    item.result = await classify({
      transcript: item.transcript,
      photos: saved,
      sectionHint: item.sectionId,
      currentSection: prev ? prev.sectionId || prev.result.section_id : null,
    });
  } catch (e) {
    item.error = String(e.message || e); // raw capture is kept so nothing is lost
  }
  job.items.push(item);
  save(job);
  res.json(item);
});

app.patch("/api/jobs/:id/items/:itemId", (req, res) => {
  const job = load(req.params.id);
  const item = job?.items.find(i => i.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: "not found" });
  if (req.body.sectionId !== undefined) item.sectionId = req.body.sectionId;
  save(job);
  res.json(item);
});

app.get("/api/jobs/:id/export", async (req, res) => {
  const job = load(req.params.id);
  if (!job) return res.status(404).json({ error: "not found" });
  const buf = await buildReport(job, jobDir(job.id));
  res.setHeader("Content-Disposition", `attachment; filename="PCA-${job.name.replace(/[^\w-]+/g, "_")}.docx"`);
  res.type("application/vnd.openxmlformats-officedocument.wordprocessingml.document").send(buf);
});

app.use(express.static(path.join(ROOT, "app")));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`PCA server on http://localhost:${port}`));
