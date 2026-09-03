import { NextRequest, NextResponse } from "next/server";
import {
  getAllProductionItems,
  createProductionItem,
  getProductionStats,
  type ProductionStatus,
} from "@/lib/productionBoard";

export async function GET() {
  try {
    const items = getAllProductionItems();
    const stats = getProductionStats();
    return NextResponse.json({ items, stats });
  } catch (error) {
    console.error("Failed to fetch production items:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, status, priority, format, niche, channelId, dueDate, tags } = body;

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const item = createProductionItem({
      title,
      description: description || "",
      status: (status as ProductionStatus) || "idea",
      priority: priority || "medium",
      format: format || "longform",
      niche: niche || "",
      channelId: channelId || "",
      dueDate: dueDate || "",
      tags: tags || [],
    });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Failed to create production item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create" },
      { status: 500 }
    );
  }
}
