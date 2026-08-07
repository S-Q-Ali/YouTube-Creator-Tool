"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RerankButton({ term }: { term: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function rerank() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/keywords/${encodeURIComponent(term)}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Re-rank failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-rank failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={rerank}
        disabled={loading}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {loading ? "Re-ranking…" : "Re-rank & refresh"}
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
