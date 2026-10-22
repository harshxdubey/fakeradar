"use client";
// Local-first sync: the browser stays the fast copy; when the server has a database, every change is
// copied up in the background and pulled down on other devices that open the workspace link.
import type { SavedProduct } from "./profile";
import type { StoredScan, TrackedTakedown } from "./types";

export const KEYS = {
  products: "fakeradar:products",
  takedowns: "fakeradar:takedowns",
  ws: "fakeradar:ws",
  settings: "fakeradar:settings",
};

export interface AppStatus {
  db: boolean;
  email: boolean;
  cron: boolean;
  live: boolean;
  ai: "claude" | "gemini" | null;
}

export interface ProductSettings {
  dailyScan: boolean;
  alertEmail: string | null;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

/** This browser's private workspace id (created on first use). Anyone with it sees this workspace. */
export function workspaceId(): string {
  let ws = read<string | null>(KEYS.ws, null);
  if (!ws || !/^[a-z0-9]{16,40}$/.test(ws)) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    ws = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
    write(KEYS.ws, ws);
  }
  return ws;
}

/** Switch this browser to another workspace (from a "?ws=" device link). */
export function adoptWorkspace(ws: string): boolean {
  if (!/^[a-z0-9]{16,40}$/.test(ws)) return false;
  write(KEYS.ws, ws);
  return true;
}

export const deviceLink = () => `${location.origin}/?ws=${workspaceId()}`;

let statusPromise: Promise<AppStatus> | null = null;
export function appStatus(): Promise<AppStatus> {
  statusPromise ??= fetch("/api/status")
    .then((r) => r.json() as Promise<AppStatus>)
    .catch(() => ({ db: false, email: false, cron: false, live: false, ai: null }));
  return statusPromise;
}

async function post(body: object) {
  const status = await appStatus();
  if (!status.db) return;
  try {
    await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ws: workspaceId(), ...body }),
      keepalive: true,
    });
  } catch {
    /* offline: the next change or pull will catch up */
  }
}

export const pushProduct = (p: SavedProduct) => void post({ products: [p] });
export const pushDeleteProduct = (key: string) => void post({ deleteProducts: [key] });
export const pushScan = (stored: StoredScan) => void post({ scan: stored });
export const pushTakedowns = (list: TrackedTakedown[]) => void post({ takedowns: list });
export const pushDeleteTakedown = (asin: string) => void post({ deleteTakedowns: [asin] });

export async function saveSettings(key: string, settings: ProductSettings): Promise<string | null> {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ws: workspaceId(), settings: { key, ...settings } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return json.error || `Couldn't save (${res.status})`;
  write(KEYS.settings, { ...readSettings(), [key]: settings });
  return null;
}

export function readSettings(): Record<string, ProductSettings> {
  return read<Record<string, ProductSettings>>(KEYS.settings, {});
}

/**
 * Pull the workspace from the server and merge it in: anything this browser doesn't have is added
 * (other devices, daily scans); what it already has is kept, since it is this device's latest edit.
 */
export async function pullWorkspace(): Promise<boolean> {
  const status = await appStatus();
  if (!status.db) return false;
  try {
    const res = await fetch(`/api/sync?ws=${workspaceId()}`, { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      products?: (SavedProduct & ProductSettings)[];
      takedowns?: TrackedTakedown[];
    };
    const localProducts = read<SavedProduct[]>(KEYS.products, []);
    const settings = readSettings();
    for (const { dailyScan, alertEmail, ...p } of data.products ?? []) {
      settings[p.key] = { dailyScan, alertEmail };
      const i = localProducts.findIndex((x) => x.key === p.key);
      if (i === -1) localProducts.push(p);
      else if (p.lastScanId && p.lastScanId !== localProducts.at(i)!.lastScanId) {
        // A daily scan ran on the server: take its newer lastScanId.
        localProducts.splice(i, 1, { ...localProducts.at(i)!, lastScanId: p.lastScanId });
      }
    }
    write(KEYS.products, localProducts.slice(0, 8));
    write(KEYS.settings, settings);

    const localTakedowns = read<TrackedTakedown[]>(KEYS.takedowns, []);
    for (const t of data.takedowns ?? []) if (!localTakedowns.some((x) => x.asin === t.asin)) localTakedowns.push(t);
    write(KEYS.takedowns, localTakedowns);
    return true;
  } catch {
    return false;
  }
}

/** A scan not in this browser (another device, or a daily scan): fetch it by its link. */
export async function fetchScan(id: string): Promise<StoredScan | null> {
  try {
    const res = await fetch(`/api/scans/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { stored?: StoredScan }).stored ?? null;
  } catch {
    return null;
  }
}
