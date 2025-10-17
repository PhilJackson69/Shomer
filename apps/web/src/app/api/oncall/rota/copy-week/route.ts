import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireOrgWriteAuthWithScope } from "@/lib/org-auth-scoped";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validation schema for query parameters
const CopyWeekSchema = z.object({
  orgId: z.string().min(1, "Organization ID is required"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  weeks: z.preprocess(
    (val) => val === null ? 1 : val,
    z.coerce.number().int().min(1).max(12)
  ).default(1),
});

// Helper function to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

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
  
  return overlaps.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const queryData = {
      orgId: searchParams.get('orgId'),
      from: searchParams.get('from'),
      weeks: searchParams.get('weeks'),
    };

    const validatedQuery = CopyWeekSchema.parse(queryData);

    // Enforce org write auth
    const authCheck = await requireOrgWriteAuthWithScope(request, validatedQuery.orgId, ["copy.week"]);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }

    // Compute date ranges
    const sourceStart = new Date(validatedQuery.from + "T00:00:00.000Z");
    const sourceEnd = new Date(sourceStart);
    sourceEnd.setUTCDate(sourceEnd.getUTCDate() + 7);
    sourceEnd.setUTCMilliseconds(sourceEnd.getUTCMilliseconds() - 1);

    const shiftDays = 7 * validatedQuery.weeks;
    const targetStart = addDays(sourceStart, shiftDays);
    const targetEnd = addDays(sourceEnd, shiftDays);

    // Fetch all shifts in the source week
    const sourceShifts = await prisma.onCall.findMany({
      where: {
        orgId: validatedQuery.orgId,
        startsAt: { gte: sourceStart },
        endsAt: { lte: sourceEnd },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    let created = 0;
    let skipped = 0;

    // Process each source shift
    for (const shift of sourceShifts) {
      const newStartsAt = addDays(shift.startsAt, shiftDays);
      const newEndsAt = addDays(shift.endsAt, shiftDays);

      // Check for overlaps
      const hasOverlap = await checkOverlaps(validatedQuery.orgId, shift.userId, newStartsAt, newEndsAt);

      if (hasOverlap) {
        skipped++;
        continue;
      }

      // Create new shift
      const newShift = await prisma.onCall.create({
        data: {
          orgId: validatedQuery.orgId,
          userId: shift.userId,
          startsAt: newStartsAt,
          endsAt: newEndsAt,
          region: shift.region,
        },
      });

      // Create audit log
      await prisma.onCallAudit.create({
        data: {
          action: 'CREATE',
          shiftId: newShift.id,
          userId: 'system', // TODO: Get actual user ID from auth when available
          orgId: validatedQuery.orgId,
          newData: JSON.stringify({
            userId: newShift.userId,
            startsAt: newShift.startsAt,
            endsAt: newShift.endsAt,
            region: newShift.region,
          }),
        },
      });

      created++;
    }

    return NextResponse.json({
      ok: true,
      created,
      skipped,
      targetFrom: targetStart.toISOString(),
      targetTo: targetEnd.toISOString(),
    });

  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to copy week" },
      { status: 500 }
    );
  }
}
