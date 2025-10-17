import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrg } from "@/lib/tenant";
import { requireOrgWriteAuthWithScope } from "@/lib/org-auth-scoped";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation schema for updates
const UpdateShiftSchema = z.object({
  userId: z.string().min(1, "User ID is required").optional(),
  startsAt: z.string().datetime("Invalid start date").optional(),
  endsAt: z.string().datetime("Invalid end date").optional(),
  region: z.string().optional(),
});

// Helper function to check for overlapping shifts
async function checkOverlaps(orgId: string, userId: string, startsAt: Date, endsAt: Date, excludeId: string) {
  const overlaps = await prisma.onCall.findMany({
    where: {
      orgId,
      userId,
      id: { not: excludeId },
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

// PUT /api/oncall/rota/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const shiftId = params.id;
    const body = await request.json();
    const validatedData = UpdateShiftSchema.parse(body);

    // Get existing shift
    const existingShift = await prisma.onCall.findFirst({
      where: {
        id: shiftId,
        orgId: tenant.orgId,
      },
    });

    if (!existingShift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (validatedData.userId) updateData.userId = validatedData.userId;
    if (validatedData.startsAt) updateData.startsAt = new Date(validatedData.startsAt);
    if (validatedData.endsAt) updateData.endsAt = new Date(validatedData.endsAt);
    if (validatedData.region !== undefined) updateData.region = validatedData.region;

    // Validate dates if provided
    const startsAt = updateData.startsAt || existingShift.startsAt;
    const endsAt = updateData.endsAt || existingShift.endsAt;
    const userId = updateData.userId || existingShift.userId;

    if (startsAt >= endsAt) {
      return NextResponse.json(
        { error: "Start date must be before end date" },
        { status: 400 }
      );
    }

    // Check for overlapping shifts if dates or user changed
    if (updateData.startsAt || updateData.endsAt || updateData.userId) {
      const overlaps = await checkOverlaps(tenant.orgId, userId, startsAt, endsAt, shiftId);
      if (overlaps.length > 0) {
        return NextResponse.json(
          { error: "Shift overlaps with existing on-call assignment" },
          { status: 400 }
        );
      }
    }

    // Verify user exists and belongs to organization if user is being changed
    if (updateData.userId) {
      const user = await prisma.user.findFirst({
        where: {
          id: updateData.userId,
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
    }

    // Store old data for audit
    const oldData = {
      userId: existingShift.userId,
      startsAt: existingShift.startsAt,
      endsAt: existingShift.endsAt,
      region: existingShift.region,
    };

    // Update the shift
    const updatedShift = await prisma.onCall.update({
      where: { id: shiftId },
      data: updateData,
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
        action: 'UPDATE',
        shiftId: updatedShift.id,
        userId: tenant.userId || 'system', // TODO: Get actual user ID from auth
        orgId: tenant.orgId,
        oldData: JSON.stringify(oldData),
        newData: JSON.stringify({
          userId: updatedShift.userId,
          startsAt: updatedShift.startsAt,
          endsAt: updatedShift.endsAt,
          region: updatedShift.region,
        }),
      },
    });

    return NextResponse.json({
      ok: true,
      shift: {
        id: updatedShift.id,
        userId: updatedShift.userId,
        userName: updatedShift.user.name,
        userEmail: updatedShift.user.email,
        organizationId: updatedShift.orgId,
        organizationName: updatedShift.organization.name,
        region: updatedShift.region,
        startsAt: updatedShift.startsAt,
        endsAt: updatedShift.endsAt,
      },
    });

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to update shift" },
      { status: 500 }
    );
  }
}

// DELETE /api/oncall/rota/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const shiftId = params.id;

    // Get existing shift
    const existingShift = await prisma.onCall.findFirst({
      where: {
        id: shiftId,
        orgId: tenant.orgId,
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

    if (!existingShift) {
      return NextResponse.json(
        { error: "Shift not found" },
        { status: 404 }
      );
    }

    // Store data for audit before deletion
    const oldData = {
      userId: existingShift.userId,
      startsAt: existingShift.startsAt,
      endsAt: existingShift.endsAt,
      region: existingShift.region,
    };

    // Delete the shift
    await prisma.onCall.delete({
      where: { id: shiftId },
    });

    // Create audit log
    await prisma.onCallAudit.create({
      data: {
        action: 'DELETE',
        shiftId: shiftId,
        userId: tenant.userId || 'system', // TODO: Get actual user ID from auth
        orgId: tenant.orgId,
        oldData: JSON.stringify(oldData),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Shift deleted successfully",
    });

  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to delete shift" },
      { status: 500 }
    );
  }
}
