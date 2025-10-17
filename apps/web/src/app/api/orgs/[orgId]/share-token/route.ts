import { NextRequest, NextResponse } from "next/server";
import { ensureOrgShareToken } from "@/lib/org-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/orgs/[orgId]/share-token
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Ensure the organization has a share token (create if missing)
    const shareToken = await ensureOrgShareToken(orgId);

    return NextResponse.json({
      ok: true,
      shareToken,
    });

  } catch (err: any) {
    if (err.message === 'Organization not found') {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: err?.message ?? "Failed to get share token" },
      { status: 500 }
    );
  }
}
