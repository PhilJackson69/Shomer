import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrgWriteAuthWithScope } from "@/lib/org-auth-scoped";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation schema for settings
const OrganizationSettingsSchema = z.object({
  preferredTimezone: z.string().min(1, "Preferred timezone is required"),
  displayName: z.string().max(120).optional().nullable(),
  showRegion: z.boolean().default(true),
  timeFormat: z.enum(["24h", "12h"]).default("24h"),
});

// Default settings
const DEFAULT_SETTINGS = {
  preferredTimezone: "UTC",
  displayName: null,
  showRegion: true,
  timeFormat: "24h" as const,
};

// GET /api/orgs/:orgId/settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Fetch organization settings or return defaults
    const settings = await prisma.organizationSetting.findUnique({
      where: { orgId },
    });

    const result = {
      preferredTimezone: settings?.preferredTimezone ?? DEFAULT_SETTINGS.preferredTimezone,
      displayName: settings?.displayName ?? DEFAULT_SETTINGS.displayName,
      showRegion: settings?.showRegion ?? DEFAULT_SETTINGS.showRegion,
      timeFormat: settings?.timeFormat ?? DEFAULT_SETTINGS.timeFormat,
    };

    return NextResponse.json({
      ok: true,
      settings: result,
    });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to fetch organization settings" },
      { status: 500 }
    );
  }
}

// POST /api/orgs/:orgId/settings (write-protected)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Require org write auth for write operations
    const authCheck = await requireOrgWriteAuthWithScope(request, orgId, ["settings.write"]);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = OrganizationSettingsSchema.parse(body);

    // Upsert organization settings
    const settings = await prisma.organizationSetting.upsert({
      where: { orgId },
      update: {
        preferredTimezone: validatedData.preferredTimezone,
        displayName: validatedData.displayName,
        showRegion: validatedData.showRegion,
        timeFormat: validatedData.timeFormat,
      },
      create: {
        orgId,
        preferredTimezone: validatedData.preferredTimezone,
        displayName: validatedData.displayName,
        showRegion: validatedData.showRegion,
        timeFormat: validatedData.timeFormat,
      },
    });

    return NextResponse.json({
      ok: true,
      settings: {
        preferredTimezone: settings.preferredTimezone,
        displayName: settings.displayName,
        showRegion: settings.showRegion,
        timeFormat: settings.timeFormat,
      },
    });

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to update organization settings" },
      { status: 500 }
    );
  }
}
