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
    const alert = {
      id: parsed.data.id,
      title: "Potential Threat Detected",
      description: "AI analysis detected potential threatening language in social media post. Content suggests possible violence towards local community center. Multiple risk factors identified including weapon mentions and urgency indicators.",
      severity: "high" as const,
      status: "new" as const,
      source: "Reddit - r/localnews",
      sourceUrl: "https://reddit.com/r/localnews/comments/example",
      createdAt: new Date().toISOString(),
      tags: ["Threat Language", "Weapon Mention", "Community Target"],
      confidence: 0.87,
      riskFactors: [
        "Threat language detected (3 instances)",
        "Weapon mentions (2 instances)",
        "Urgency indicators (1 instance)",
        "Target location mentioned (1 instance)"
      ],
      similarIncidents: [
        {
          id: "inc_001",
          title: "Similar threat reported last week",
          similarity: 0.92,
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    };

    const history = [
      {
        id: "hist_001",
        action: "Alert created",
        user: "AI System",
        timestamp: new Date().toISOString(),
        details: "Automatically generated from social media monitoring"
      }
    ];

    return NextResponse.json({ alert, history });
  } catch (error) {
    console.error("Error fetching alert:", error);
    return NextResponse.json({ error: "Failed to fetch alert" }, { status: 500 });
  }
}
