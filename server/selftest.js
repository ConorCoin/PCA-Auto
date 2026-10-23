// Offline check: builds a report from canned classifier output (no API key needed).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildReport } from "./export.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pca-"));
fs.mkdirSync(path.join(dir, "photos"));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
fs.writeFileSync(path.join(dir, "photos", "a.png"), png);
const job = {
  id: "t", name: "Test Property",
  items: [{
    id: "1", ts: 1, transcript: "", photos: ["a.png"], sectionId: null,
    result: {
      section_id: "3.2.4", confidence: 0.9, needs_review: false,
      description: "Asphalt pavement (~14,200 SY) was observed in the parking lots.",
      condition: "The asphalt pavement appeared to be in good condition.",
      recommendations: [{ tier: "short", text: "Clean, seal coat & stripe parking lot and driveways.", year: 3, quantity: 14500, unit: "SY", unit_cost: 5.4 }],
      photo_captions: ["View of asphalt in good condition on the western portion of the property"],
    },
  }],
};
const buf = await buildReport(job, dir);
const out = path.join(dir, "test.docx");
fs.writeFileSync(out, buf);
console.log("ok", buf.length, "bytes ->", out);
