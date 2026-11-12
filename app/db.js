// Cloud-backed data store: Firestore for jobs/items, Firebase Storage for photos.
import { firestore, storage, authReady } from "./firebase.js";
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy,
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-storage.js";

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));

const jobDoc   = id      => doc(firestore, "jobs", id);
const itemsCol = jobId   => collection(firestore, "jobs", jobId, "items");
const itemDoc  = (j, i)  => doc(firestore, "jobs", j, "items", i);
const codeDoc  = code    => doc(firestore, "codes", code);

// Track job IDs the user has opened, in localStorage (no server-side user account needed).
function localIds()     { try { return JSON.parse(localStorage.getItem("pca.jobids") || "[]"); } catch { return []; } }
function saveIds(ids)   { try { localStorage.setItem("pca.jobids", JSON.stringify(ids)); } catch {} }
function addId(id)      { const ids = localIds(); if (!ids.includes(id)) saveIds([id, ...ids]); }
function removeId(id)   { saveIds(localIds().filter(x => x !== id)); }

export async function listJobs() {
  await authReady;
  const ids = localIds();
  if (!ids.length) return [];
  const snaps = await Promise.all(ids.map(id => getDoc(jobDoc(id))));
  return snaps.filter(s => s.exists()).map(s => s.data()).sort((a, b) => b.created - a.created);
}

export async function getJob(id) {
  await authReady;
  const s = await getDoc(jobDoc(id));
  return s.exists() ? s.data() : null;
}

export async function putJob(job) {
  await authReady;
  await setDoc(jobDoc(job.id), job);
  addId(job.id);
}

export async function jobItems(jobId) {
  await authReady;
  const snap = await getDocs(query(itemsCol(jobId), orderBy("ts")));
  return snap.docs.map(d => d.data());
}

export async function putItem(item) {
  await authReady;
  // Strip Uint8Array photo bytes — photos live in Storage, referenced by photoUrl.
  const { photo, ...clean } = item;
  await setDoc(itemDoc(clean.jobId, clean.id), clean);
}

export async function deleteItem(item) {
  await authReady;
  if (item.photoUrl) {
    try { await deleteObject(ref(storage, `photos/${item.jobId}/${item.id}.jpg`)); } catch {}
  }
  await deleteDoc(itemDoc(item.jobId, item.id));
}

export async function deleteJob(id) {
  const its = await jobItems(id);
  await Promise.all(its.map(it => deleteItem(it)));
  await deleteDoc(jobDoc(id));
  removeId(id);
}

export async function newJob(name, address1 = "", address2 = "") {
  await authReady;
  const shareCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const job = { id: uid(), name: name || "Untitled property", address1, address2, created: Date.now(), shareCode };
  await putJob(job);
  await setDoc(codeDoc(shareCode), { jobId: job.id });
  return job;
}

// Join an existing job by its 6-letter share code. Returns the jobId or null if not found.
export async function joinByCode(code) {
  await authReady;
  const snap = await getDoc(codeDoc(code.trim().toUpperCase()));
  if (!snap.exists()) return null;
  const jobId = snap.data().jobId;
  addId(jobId);
  return jobId;
}

// Upload a photo Blob to Firebase Storage and return its public download URL.
export async function uploadPhoto(jobId, itemId, blob) {
  await authReady;
  const r = ref(storage, `photos/${jobId}/${itemId}.jpg`);
  await uploadBytes(r, blob, { contentType: "image/jpeg" });
  return getDownloadURL(r);
}

// Subscribe to real-time item updates for a job. Returns the unsubscribe function.
export function onItemsChange(jobId, callback) {
  return onSnapshot(query(itemsCol(jobId), orderBy("ts")), snap => {
    callback(snap.docs.map(d => d.data()));
  });
}
