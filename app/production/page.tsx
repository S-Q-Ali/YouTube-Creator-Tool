"use client";

import { ProductionBoard } from "@/components/ProductionBoard";

export default function ProductionPage() {
  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <ProductionBoard />
      </div>
    </main>
  );
}
