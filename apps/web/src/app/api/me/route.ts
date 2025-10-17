import { getSessionUser } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSessionUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    orgId: user.orgId,
    role: user.role,
    displayName: user.displayName
  });
}