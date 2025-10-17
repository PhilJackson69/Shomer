import { NextResponse } from "next/server";
import { z } from "zod";
import { requireModerator } from "@/lib/rbac";

const Params = z.object({ id: z.string().min(1) });

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireModerator();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

  const parsed = Params.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  try {
    // Mock data - replace with actual database queries
    const tags = [
      { id: "tag_004", name: "Weapon Mention", color: "#dc2626" },
      { id: "tag_005", name: "Hate Speech", color: "#dc2626" },
      { id: "tag_006", name: "Urgency Indicator", color: "#f59e0b" }
    ];

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Error fetching alert tags:", error);
    return NextResponse.json({ error: "Failed to fetch alert tags" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireModerator();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

  const parsed = Params.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 });
    }

    // Mock tag assignment - replace with actual database operation
    const tagAssignment = {
      alertId: parsed.data.id,
      tagId,
      assignedBy: auth.user?.id || "system",
      assignedAt: new Date().toISOString()
    };

    return NextResponse.json({ tagAssignment }, { status: 201 });
  } catch (error) {
    console.error("Error assigning tag:", error);
    return NextResponse.json({ error: "Failed to assign tag" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireModerator();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

  const parsed = Params.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert ID" }, { status: 400 });
  }

  try {
    const url = new URL(req.url);
    const tagId = url.searchParams.get("tagId");

    if (!tagId) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 });
    }

    // Mock tag removal - replace with actual database operation
    return NextResponse.json({ message: "Tag removed successfully" });
  } catch (error) {
    console.error("Error removing tag:", error);
    return NextResponse.json({ error: "Failed to remove tag" }, { status: 500 });
  }
}
