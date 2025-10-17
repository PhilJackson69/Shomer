import { NextResponse } from "next/server";
import { requireModerator } from "@/lib/rbac";

export async function GET() {
  const auth = await requireModerator();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

  try {
    // Mock tag data - replace with actual database queries
    const tags = [
      { id: "tag_001", name: "Verified Threat", color: "#dc2626", description: "Confirmed threat requiring immediate action" },
      { id: "tag_002", name: "False Alarm", color: "#6b7280", description: "Determined to be non-threatening" },
      { id: "tag_003", name: "Under Investigation", color: "#f59e0b", description: "Currently being investigated" },
      { id: "tag_004", name: "Weapon Mention", color: "#dc2626", description: "Contains weapon-related language" },
      { id: "tag_005", name: "Hate Speech", color: "#dc2626", description: "Contains discriminatory language" },
      { id: "tag_006", name: "Urgency Indicator", color: "#f59e0b", description: "Contains time-sensitive language" },
      { id: "tag_007", name: "Community Target", color: "#dc2626", description: "Targets community locations" },
      { id: "tag_008", name: "Escalated", color: "#dc2626", description: "Escalated to law enforcement" },
      { id: "tag_009", name: "Resolved", color: "#10b981", description: "Incident has been resolved" },
      { id: "tag_010", name: "Duplicate", color: "#6b7280", description: "Duplicate of existing incident" }
    ];

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireModerator();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 403 });

  try {
    const body = await req.json();
    const { name, color, description } = body;

    if (!name || !color) {
      return NextResponse.json({ error: "Name and color are required" }, { status: 400 });
    }

    // Mock tag creation - replace with actual database operation
    const newTag = {
      id: `tag_${Date.now()}`,
      name,
      color,
      description: description || "",
      createdAt: new Date().toISOString(),
      createdBy: auth.user?.id || "system"
    };

    return NextResponse.json({ tag: newTag }, { status: 201 });
  } catch (error) {
    console.error("Error creating tag:", error);
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}
