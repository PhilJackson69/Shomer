import { NextRequest, NextResponse } from "next/server";
import { requireOrgWriteAuthWithScope } from "@/lib/org-auth-scoped";
import { rotateOrgShareToken } from "@/lib/org-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/orgs/[orgId]/rotate-share-token
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;

    // Require org write auth for write operations
    const authCheck = await requireOrgWriteAuthWithScope(request, orgId, ["share.rotate"]);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Rotate the share token
    const newShareToken = await rotateOrgShareToken(orgId);

    return NextResponse.json({
      ok: true,
      shareToken: newShareToken,
    });

  } catch (err: any) {
    if (err.message === 'Organization not found') {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: err?.message ?? "Failed to rotate share token" },
      { status: 500 }
    );
  }
}
