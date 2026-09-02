"use client";

import { useState } from "react";

interface Format {
  id: string;
  name: string;
  ratio: string;
}

const FORMATS: Format[] = [
  { id: "longform", name: "Long Form", ratio: "16:9" },
  { id: "shortform", name: "Short Form", ratio: "9:16" },
];

export function FormatDropdown({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (formatId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedFormat = FORMATS.find(f => f.id === selected);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        {selectedFormat ? `${selectedFormat.name} (${selectedFormat.ratio})` : "Select Format"}
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
        <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {FORMATS.map((format) => (
            <button
              key={format.id}
              onClick={() => {
                onSelect(format.id);
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 ${
                selected === format.id ? "bg-red-50 text-red-600 dark:bg-red-900/20" : ""
              }`}
            >
              <span>{format.name}</span>
              <span className="text-xs text-zinc-500">{format.ratio}</span>
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
