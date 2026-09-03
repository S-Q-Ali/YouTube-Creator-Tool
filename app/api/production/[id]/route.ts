import { NextRequest, NextResponse } from "next/server";
import {
  getProductionItem,
  updateProductionItem,
  deleteProductionItem,
  type ProductionStatus,
} from "@/lib/productionBoard";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = getProductionItem(id);
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status as ProductionStatus;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.format !== undefined) updates.format = body.format;
    if (body.niche !== undefined) updates.niche = body.niche;
    if (body.channelId !== undefined) updates.channelId = body.channelId;
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.position !== undefined) updates.position = body.position;

    const updated = updateProductionItem(id, updates);
    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Failed to update production item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = getProductionItem(id);
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    deleteProductionItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete production item:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
