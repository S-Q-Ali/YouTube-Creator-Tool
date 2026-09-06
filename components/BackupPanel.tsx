"use client";

import { useRef, useState } from "react";

export default function BackupPanel() {
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportBackup() {
    setBusy("export");
    setMessage(null);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error((await res.json()).error ?? "Export failed");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const name = match?.[1] ?? "niche-scope-backup.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ ok: true, text: `Backup downloaded (${(blob.size / 1024).toFixed(1)} KB).` });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Export failed" });
    } finally {
      setBusy(null);
    }
  }

  async function restoreBackup(file: File) {
    setBusy("import");
    setMessage(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Restore failed");
      setMessage({
        ok: true,
        text: `Restored ${json.rows} rows across ${json.tables} tables.`,
      });
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Restore failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">Backup &amp; restore</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Export all local data (keywords, watchlist, snapshots, settings) to a JSON file, or restore
        from one. Restoring replaces the current database.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportBackup}
          disabled={busy !== null}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "export" ? "Exporting…" : "Export backup"}
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {busy === "import" ? "Restoring…" : "Restore from file"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) restoreBackup(f);
          }}
        />
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${
            message.ok ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
