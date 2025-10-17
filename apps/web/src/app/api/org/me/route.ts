import { NextResponse } from "next/server";
import { getOrgFromSession } from "@/lib/tenant";

export async function GET() {
  const org = await getOrgFromSession();
  return NextResponse.json({ org: org?.org ?? null });
}


