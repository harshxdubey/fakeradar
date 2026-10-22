"use client";
import { useState } from "react";
import { readSettings, saveSettings, workspaceId, type AppStatus } from "@/lib/sync";
import { Button, Spinner } from "./ui";

/** Daily scan + alert email for one saved product (needs the database and CRON_SECRET). */
export function ProductSettings({ productKey, status }: { productKey: string; status: AppStatus }) {
  const initial = readSettings()[productKey] ?? { dailyScan: false, alertEmail: null };
  const [daily, setDaily] = useState(initial.dailyScan);
  const [email, setEmail] = useState(initial.alertEmail ?? "");
  const [busy, setBusy] = useState<"save" | "run" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!status.db || !status.cron) {
    return (
      <p className="text-xs text-slate-500">
        Daily scans and email alerts switch on once the database{status.db ? " and CRON_SECRET are" : " is"} set up.
      </p>
    );
  }

  async function save() {
    setBusy("save");
    setMsg(null);
    const err = await saveSettings(productKey, { dailyScan: daily, alertEmail: email.trim() || null });
    setBusy(null);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: daily ? "Saved — scans every morning at 8:00 IST" : "Saved" });
  }

  async function runNow() {
    setBusy("run");
    setMsg(null);
    try {
      const res = await fetch("/api/cron/daily", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ws: workspaceId(), key: productKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setMsg({
        ok: true,
        text: `Started — the result appears under “last scan” in about a minute${email && status.email ? " and is emailed if fakes are found" : ""}.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
          Scan daily (8:00 IST)
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={status.email ? "Alert email (optional)" : "Alert email — needs RESEND_API_KEY"}
          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-300 px-2 text-sm focus:border-accent focus:outline-none"
        />
        <Button size="sm" variant="outline" onClick={save} disabled={busy !== null}>
          {busy === "save" ? <Spinner /> : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={runNow} disabled={busy !== null} title="Run the daily scan now (uses Apify credit)">
          {busy === "run" ? <Spinner /> : "Run now"}
        </Button>
      </div>
      {msg && <p className={msg.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>{msg.text}</p>}
    </div>
  );
}
