"use client";

import { useState } from "react";

export default function TrackButton({
  kind,
  refId,
  label,
  initial,
}: {
  kind: "video" | "channel" | "keyword";
  refId: string;
  label: string;
  initial: boolean;
}) {
  const [tracked, setTracked] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, refId, label, action: tracked ? "remove" : "add" }),
      });
      const json = await res.json();
      setTracked(Boolean(json.tracked));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        tracked
          ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          : "bg-red-600 text-white hover:bg-red-700"
      }`}
    >
      {busy ? "…" : tracked ? "✓ Tracking" : "+ Track"}
    </button>
  );
}
