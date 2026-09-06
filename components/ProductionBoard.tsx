"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type ProductionItem,
  type ProductionStatus,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/productionTypes";

const STATUSES: ProductionStatus[] = [
  "idea", "scripted", "recorded", "editing", "thumbnail", "seo", "scheduled", "published", "promoted",
];

const PRIORITY_BADGES: Record<string, string> = {
  low: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
  medium: "bg-yellow-200 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  high: "bg-orange-200 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  urgent: "bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

function formatDueDate(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

function getDueDateColor(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "text-red-500 dark:text-red-400";
  if (days <= 2) return "text-orange-500 dark:text-orange-400";
  if (days <= 7) return "text-yellow-500 dark:text-yellow-400";
  return "text-green-500 dark:text-green-400";
}

export function ProductionBoard() {
  const [items, setItems] = useState<ProductionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    status: "idea" as ProductionStatus,
    priority: "medium" as string,
    format: "longform" as string,
    niche: "",
    dueDate: "",
  });

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/production");
      const data = await res.json();
      setItems(data.items);
    } catch (err) {
      console.error("Failed to load production items:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddItem = async () => {
    if (!newItem.title.trim()) return;
    try {
      const res = await fetch("/api/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newItem, tags: [] }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => [data.item, ...prev]);
        setShowAddModal(false);
        setNewItem({ title: "", description: "", status: "idea", priority: "medium", format: "longform", niche: "", dueDate: "" });
      }
    } catch (err) {
      console.error("Failed to add item:", err);
    }
  };

  const handleMoveItem = async (itemId: string, newStatus: ProductionStatus) => {
    try {
      const res = await fetch(`/api/production/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item)));
      }
    } catch (err) {
      console.error("Failed to move item:", err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await fetch(`/api/production/${itemId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  };

  const handleDragStart = (itemId: string) => {
    setDraggedItem(itemId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ProductionStatus) => {
    e.preventDefault();
    if (draggedItem) {
      handleMoveItem(draggedItem, targetStatus);
      setDraggedItem(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-zinc-500">Loading production board...</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Production Board</h1>
          <p className="text-sm text-zinc-500">{items.length} videos in pipeline</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          + Add Video
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((status) => {
          const statusItems = items.filter((item) => item.status === status);
          return (
            <div
              key={status}
              className={`min-w-[240px] flex-shrink-0 rounded-xl border-2 border-dashed p-3 ${STATUS_COLORS[status]}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
                <span className="rounded-full bg-white/50 px-2 py-0.5 text-xs font-medium dark:bg-black/20">
                  {statusItems.length}
                </span>
              </div>

              <div className="space-y-2">
                {statusItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(item.id)}
                    className="cursor-grab rounded-lg border border-white/50 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:bg-zinc-800"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-medium text-zinc-900 dark:text-white">{item.title}</h4>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="ml-1 text-zinc-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                    {item.description && (
                      <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{item.description}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGES[item.priority]}`}>
                        {item.priority}
                      </span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        {item.format === "longform" ? "Long" : "Short"}
                      </span>
                      {item.dueDate && (
                        <span className={`text-[10px] font-medium ${getDueDateColor(item.dueDate)}`}>
                          {formatDueDate(item.dueDate)}
                        </span>
                      )}
                    </div>
                    {item.niche && (
                      <p className="mt-1 text-[10px] text-zinc-400">{item.niche}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">Add New Video</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="Video title..."
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-red-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              />
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Description..."
                rows={2}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-red-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newItem.status}
                  onChange={(e) => setNewItem({ ...newItem, status: e.target.value as ProductionStatus })}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <select
                  value={newItem.priority}
                  onChange={(e) => setNewItem({ ...newItem, priority: e.target.value })}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newItem.format}
                  onChange={(e) => setNewItem({ ...newItem, format: e.target.value })}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="longform">Long Form</option>
                  <option value="shortform">Short Form</option>
                </select>
                <input
                  type="date"
                  value={newItem.dueDate}
                  onChange={(e) => setNewItem({ ...newItem, dueDate: e.target.value })}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={!newItem.title.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
