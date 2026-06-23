"use client";

import { uid } from "@/lib/util/id";

/**
 * Local image library. Full-resolution photos are kept as Blobs in IndexedDB
 * (localStorage is too small for images); tiny thumbnails + metadata live in
 * localStorage so the gallery can list instantly without reading every blob.
 *
 * Everything stays on the device — no upload, matching the app's offline/private
 * posture.
 */

export interface ImageMeta {
  id: string;
  name: string;
  createdAt: number;
  thumb: string; // small data URL
  w: number;
  h: number;
}

const META_KEY = "coloraid.gallery.v1";
const DB_NAME = "coloraid";
const STORE = "images";
const THUMB_MAX = 240;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(id: string): Promise<Blob | undefined> {
  const db = await openDB();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return blob;
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export function readMeta(): ImageMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(META_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as ImageMeta[]) : [];
  } catch {
    return [];
  }
}

function writeMeta(list: ImageMeta[]) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

/** Decode a file and produce { blob, thumbDataUrl, width, height }. */
function processImage(file: Blob): Promise<{ thumb: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, THUMB_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")?.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ thumb: c.toDataURL("image/jpeg", 0.6), w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Save a new image; returns its metadata (already prepended to the library). */
export async function saveImage(file: File): Promise<ImageMeta> {
  const id = uid();
  const { thumb, w, h } = await processImage(file);
  await idbPut(id, file);
  const meta: ImageMeta = {
    id,
    name: file.name || "photo",
    createdAt: Date.now(),
    thumb,
    w,
    h,
  };
  writeMeta([meta, ...readMeta()]);
  return meta;
}

/** Get an object URL for a stored image's full-resolution blob. */
export async function getImageUrl(id: string): Promise<string | undefined> {
  const blob = await idbGet(id);
  return blob ? URL.createObjectURL(blob) : undefined;
}

export async function deleteImage(id: string): Promise<void> {
  await idbDelete(id);
  writeMeta(readMeta().filter((m) => m.id !== id));
}
