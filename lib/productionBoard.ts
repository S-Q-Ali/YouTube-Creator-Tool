import { get, run, all } from "./db";

export type ProductionStatus =
  | "idea"
  | "scripted"
  | "recorded"
  | "editing"
  | "thumbnail"
  | "seo"
  | "scheduled"
  | "published"
  | "promoted";

export interface ProductionItem {
  id: string;
  title: string;
  description: string;
  status: ProductionStatus;
  priority: "low" | "medium" | "high" | "urgent";
  format: "longform" | "shortform";
  niche: string;
  channelId: string;
  dueDate: string;
  tags: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<ProductionStatus, string> = {
  idea: "Idea",
  scripted: "Scripted",
  recorded: "Recorded",
  editing: "Editing",
  thumbnail: "Thumbnail",
  seo: "SEO",
  scheduled: "Scheduled",
  published: "Published",
  promoted: "Promoted",
};

export const STATUS_COLORS: Record<ProductionStatus, string> = {
  idea: "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300",
  scripted: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400",
  recorded: "bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400",
  editing: "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-400",
  thumbnail: "bg-pink-100 border-pink-300 text-pink-700 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-400",
  seo: "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400",
  scheduled: "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-400",
  published: "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400",
  promoted: "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400",
};

const STATUSES: ProductionStatus[] = [
  "idea", "scripted", "recorded", "editing", "thumbnail", "seo", "scheduled", "published", "promoted",
];

export function getAllProductionItems(): ProductionItem[] {
  const rows = all(
    "SELECT * FROM production_board ORDER BY position ASC, created_at DESC"
  ) as {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    format: string;
    niche: string;
    channel_id: string;
    due_date: string;
    tags: string;
    position: number;
    created_at: string;
    updated_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status as ProductionStatus,
    priority: r.priority as "low" | "medium" | "high" | "urgent",
    format: r.format as "longform" | "shortform",
    niche: r.niche,
    channelId: r.channel_id,
    dueDate: r.due_date,
    tags: JSON.parse(r.tags || "[]"),
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getProductionItem(id: string): ProductionItem | undefined {
  const r = get(
    "SELECT * FROM production_board WHERE id = $id",
    { $id: id }
  ) as {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    format: string;
    niche: string;
    channel_id: string;
    due_date: string;
    tags: string;
    position: number;
    created_at: string;
    updated_at: string;
  } | undefined;
  if (!r) return undefined;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status as ProductionStatus,
    priority: r.priority as "low" | "medium" | "high" | "urgent",
    format: r.format as "longform" | "shortform",
    niche: r.niche,
    channelId: r.channel_id,
    dueDate: r.due_date,
    tags: JSON.parse(r.tags || "[]"),
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function createProductionItem(
  item: Omit<ProductionItem, "id" | "createdAt" | "updatedAt" | "position">
): ProductionItem {
  const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  run(
    `INSERT INTO production_board (id, title, description, status, priority, format, niche, channel_id, due_date, tags, position, created_at, updated_at)
     VALUES ($id, $title, $description, $status, $priority, $format, $niche, $channel_id, $due_date, $tags, 0, $created_at, $updated_at)`,
    {
      $id: id,
      $title: item.title,
      $description: item.description,
      $status: item.status,
      $priority: item.priority,
      $format: item.format,
      $niche: item.niche,
      $channel_id: item.channelId,
      $due_date: item.dueDate,
      $tags: JSON.stringify(item.tags),
      $created_at: now,
      $updated_at: now,
    }
  );

  return { ...item, id, position: 0, createdAt: now, updatedAt: now };
}

export function updateProductionItem(
  id: string,
  updates: Partial<Pick<ProductionItem, "title" | "description" | "status" | "priority" | "format" | "niche" | "channelId" | "dueDate" | "tags" | "position">>
): ProductionItem | undefined {
  const existing = getProductionItem(id);
  if (!existing) return undefined;

  const merged = { ...existing, ...updates };
  const now = new Date().toISOString();

  run(
    `UPDATE production_board SET
       title = $title, description = $description, status = $status,
       priority = $priority, format = $format, niche = $niche,
       channel_id = $channel_id, due_date = $due_date, tags = $tags,
       position = $position, updated_at = $updated_at
     WHERE id = $id`,
    {
      $id: id,
      $title: merged.title,
      $description: merged.description,
      $status: merged.status,
      $priority: merged.priority,
      $format: merged.format,
      $niche: merged.niche,
      $channel_id: merged.channelId,
      $due_date: merged.dueDate,
      $tags: JSON.stringify(merged.tags),
      $position: merged.position,
      $updated_at: now,
    }
  );

  return { ...merged, updatedAt: now };
}

export function deleteProductionItem(id: string): boolean {
  run("DELETE FROM production_board WHERE id = $id", { $id: id });
  return true;
}

export function getProductionStats() {
  const items = getAllProductionItems();
  const byStatus = {} as Record<ProductionStatus, number>;
  STATUSES.forEach((s) => (byStatus[s] = 0));
  items.forEach((item) => byStatus[item.status]++);
  return { total: items.length, byStatus };
}
