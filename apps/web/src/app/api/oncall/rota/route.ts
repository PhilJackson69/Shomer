import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";
import { requireOrgWriteAuthWithScope } from "@/lib/org-auth-scoped";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation schemas
const CreateShiftSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  startsAt: z.string().datetime("Invalid start date"),
  endsAt: z.string().datetime("Invalid end date"),
  region: z.string().optional(),
});

const UpdateShiftSchema = CreateShiftSchema.partial();

// Helper function to check for overlapping shifts
async function checkOverlaps(orgId: string, userId: string, startsAt: Date, endsAt: Date, excludeId?: string) {
  const overlaps = await prisma.onCall.findMany({
    where: {
      orgId,
      userId,
      id: excludeId ? { not: excludeId } : undefined,
      OR: [
        // New shift starts during existing shift
        {
          startsAt: { lte: startsAt },
          endsAt: { gt: startsAt },
        },
        // New shift ends during existing shift
        {
          startsAt: { lt: endsAt },
          endsAt: { gte: endsAt },
        },
        // New shift completely contains existing shift
        {
          startsAt: { gte: startsAt },
          endsAt: { lte: endsAt },
        },
      ],
    },
  });
  
  return overlaps;
}

// GET /api/oncall/rota?from=&to=
export async function GET(request: NextRequest) {
  try {
    const tenant = await requireOrg(request);
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Default to next 30 days if no dates provided
    const fromDate = from ? new Date(from) : new Date();
    const toDate = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const shifts = await prisma.onCall.findMany({
      where: {
        orgId: tenant.orgId,
        startsAt: { gte: fromDate },
        endsAt: { lte: toDate },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    });

    return NextResponse.json({
      ok: true,
      shifts: shifts.map(shift => ({
        id: shift.id,
        userId: shift.userId,
        userName: shift.user.name,
        userEmail: shift.user.email,
        organizationId: shift.orgId,
        organizationName: shift.organization.name,
        region: shift.region,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      })),
    });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to fetch rota" },
      { status: 500 }
    );
  }
}

// POST /api/oncall/rota
export async function POST(request: NextRequest) {
  try {
    const tenant = await requireOrg(request);
    if (!tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Require org write auth for write operations
    const authCheck = await requireOrgWriteAuthWithScope(request, tenant.orgId, ["rota.write"]);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }

    const body = await request.json();
    const validatedData = CreateShiftSchema.parse(body);

    const startsAt = new Date(validatedData.startsAt);
    const endsAt = new Date(validatedData.endsAt);

    // Validate dates
    if (startsAt >= endsAt) {
      return NextResponse.json(
        { error: "Start date must be before end date" },
        { status: 400 }
      );
    }

    // Check for overlapping shifts
    const overlaps = await checkOverlaps(tenant.orgId, validatedData.userId, startsAt, endsAt);
    if (overlaps.length > 0) {
      return NextResponse.json(
        { error: "Shift overlaps with existing on-call assignment" },
        { status: 400 }
      );
    }

    // Verify user exists and belongs to organization
    const user = await prisma.user.findFirst({
      where: {
        id: validatedData.userId,
        memberships: {
          some: {
            orgId: tenant.orgId,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found or not a member of this organization" },
        { status: 400 }
      );
    }

    // Create the shift
    const shift = await prisma.onCall.create({
      data: {
        orgId: tenant.orgId,
        userId: validatedData.userId,
        startsAt,
        endsAt,
        region: validatedData.region,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.onCallAudit.create({
      data: {
        action: 'CREATE',
        shiftId: shift.id,
        userId: tenant.userId || 'system', // TODO: Get actual user ID from auth
        orgId: tenant.orgId,
        newData: JSON.stringify({
          userId: shift.userId,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          region: shift.region,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      shift: {
        id: shift.id,
        userId: shift.userId,
        userName: shift.user.name,
        userEmail: shift.user.email,
        organizationId: shift.orgId,
        organizationName: shift.organization.name,
        region: shift.region,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
      },
    }, { status: 201 });

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to create shift" },
      { status: 500 }
    );
  }
}
