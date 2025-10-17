import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrgWriteAuthWithScope } from "@/lib/org-auth-scoped";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation schema
const SeedWeekSchema = z.object({
  orgId: z.string().min(1, "Organization ID is required"),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
});

// Helper function to check for overlapping shifts
async function checkOverlaps(orgId: string, userId: string, startsAt: Date, endsAt: Date) {
  const overlaps = await prisma.onCall.findMany({
    where: {
      orgId,
      userId,
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

// Helper function to get next Monday from a given date
function getNextMonday(date: Date): Date {
  const dayOfWeek = date.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(date);
  nextMonday.setDate(date.getDate() + daysUntilMonday);
  return nextMonday;
}

// POST /api/oncall/rota/seed-week?orgId=<id>&start=YYYY-MM-DD
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const start = searchParams.get('start');

    // Validate parameters
    const validatedData = SeedWeekSchema.parse({ orgId, start });

    // Require org write auth for write operations
    const authCheck = await requireOrgWriteAuthWithScope(request, validatedData.orgId, ["seed.week"]);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }

    // Convert start date to UTC midnight
    const startDate = new Date(validatedData.start + 'T00:00:00.000Z');
    
    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: validatedData.orgId },
    });

    if (!organization) {
      return NextResponse.json(
        { ok: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get users from the organization (2-4 users)
    let users = await prisma.user.findMany({
      where: {
        memberships: {
          some: {
            orgId: validatedData.orgId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // If fewer than 2 users exist, create a demo user
    if (users.length < 2) {
      const demoUser = await prisma.user.create({
        data: {
          email: `demo_oncall_user@local`,
          name: `Demo OnCall User ${Date.now()}`,
          role: 'VIEWER',
        },
      });

      // Add the demo user to the organization
      await prisma.membership.create({
        data: {
          userId: demoUser.id,
          orgId: validatedData.orgId,
          role: 'VIEWER',
        },
      });

      // Re-fetch users including the new demo user
      users = await prisma.user.findMany({
        where: {
          memberships: {
            some: {
              orgId: validatedData.orgId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    }

    let createdCount = 0;

    // Create 7 days of shifts
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // Set shift times: 09:00:00Z to 17:00:00Z (8 hours)
      const shiftStart = new Date(currentDate);
      shiftStart.setUTCHours(9, 0, 0, 0);
      
      const shiftEnd = new Date(currentDate);
      shiftEnd.setUTCHours(17, 0, 0, 0);

      // Pick user by rotating index
      const userIndex = i % users.length;
      const selectedUser = users[userIndex];

      // Check for overlaps
      const overlaps = await checkOverlaps(validatedData.orgId, selectedUser.id, shiftStart, shiftEnd);
      
      if (overlaps.length === 0) {
        // Create the shift
        const shift = await prisma.onCall.create({
          data: {
            orgId: validatedData.orgId,
            userId: selectedUser.id,
            startsAt: shiftStart,
            endsAt: shiftEnd,
            region: null,
          },
        });

        // Create audit log
        await prisma.onCallAudit.create({
          data: {
            action: 'CREATE',
            shiftId: shift.id,
            userId: 'system', // System action for seeding
            orgId: validatedData.orgId,
            newData: JSON.stringify({
              userId: shift.userId,
              startsAt: shift.startsAt,
              endsAt: shift.endsAt,
              region: shift.region,
            }),
          },
        });

        createdCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      created: createdCount,
    });

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to seed demo week" },
      { status: 500 }
    );
  }
}
