import { get, run, all } from "./db";
import { STATUSES } from "./productionTypes";
import type { ProductionItem, ProductionStatus } from "./productionTypes";

export type { ProductionStatus, ProductionItem } from "./productionTypes";
export { STATUS_LABELS, STATUS_COLORS } from "./productionTypes";

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
