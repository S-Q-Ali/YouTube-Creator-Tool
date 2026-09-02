"use client";

import { useState, useEffect } from "react";

interface Niche {
  id: string;
  name: string;
  channelCount: number;
}

export function CategoryDropdown({
  format,
  selected,
  onSelect,
}: {
  format: string;
  selected: string;
  onSelect: (nicheId: string) => void;
}) {
  const [niches, setNiches] = useState<Niche[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!format || format === "all") {
      setNiches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/trending/categories?format=${format}`)
      .then((res) => res.json())
      .then((data) => {
        setNiches(data.niches || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [format]);

  const selectedName =
    selected === "all"
      ? "All Niches"
      : niches.find((n) => n.id === selected)?.name || "Select Niche";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!format || format === "all"}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        {loading ? "Loading..." : selectedName}
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-80 w-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <button
            onClick={() => {
              onSelect("all");
              setIsOpen(false);
            }}
            className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
              selected === "all" ? "bg-red-50 text-red-600 dark:bg-red-900/20" : ""
            }`}
          >
            All Niches
          </button>

          {niches.map((niche) => (
            <button
              key={niche.id}
              onClick={() => {
                onSelect(niche.id);
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                selected === niche.id ? "bg-red-50 text-red-600 dark:bg-red-900/20" : ""
              }`}
            >
              <span className="truncate">{niche.name}</span>
              {niche.channelCount > 0 && (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                  {niche.channelCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
