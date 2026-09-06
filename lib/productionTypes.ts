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

export const STATUSES: ProductionStatus[] = [
  "idea", "scripted", "recorded", "editing", "thumbnail", "seo", "scheduled", "published", "promoted",
];

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