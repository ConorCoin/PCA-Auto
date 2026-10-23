// All data lives on the phone, in IndexedDB. Nothing is sent anywhere.
const NAME = "pca";

let dbp;
function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore("jobs", { keyPath: "id" });
        d.createObjectStore("items", { keyPath: "id" }).createIndex("jobId", "jobId");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const out = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

export const listJobs = async () => (await run("jobs", "readonly", s => s.getAll())).sort((a, b) => b.created - a.created);
export const getJob = id => run("jobs", "readonly", s => s.get(id));
export const putJob = job => run("jobs", "readwrite", s => s.put(job));
export const jobItems = async jobId =>
  (await run("items", "readonly", s => s.index("jobId").getAll(jobId))).sort((a, b) => a.ts - b.ts);
export const putItem = item => run("items", "readwrite", s => s.put(item));
export const deleteItem = id => run("items", "readwrite", s => s.delete(id));

export async function deleteJob(id) {
  for (const it of await jobItems(id)) await deleteItem(it.id);
  await run("jobs", "readwrite", s => s.delete(id));
}

export async function newJob(name, address1 = "", address2 = "") {
  const job = { id: uid(), name: name || "Untitled property", address1, address2, created: Date.now() };
  await putJob(job);
  return job;
}
