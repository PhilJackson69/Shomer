import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const severity = url.searchParams.get("severity");
    const status = url.searchParams.get("status");
    const sourceType = url.searchParams.get("sourceType");
    const minScore = url.searchParams.get("minScore");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (minScore) where.score = { gte: parseFloat(minScore) };

    // Include source type filter
    const include: any = {
      raw: {
        include: {
          source: true,
        },
      },
      alertEvents: true,
    };

    if (sourceType) {
      include.raw = {
        include: {
          source: {
            where: { type: sourceType },
          },
        },
      };
    }

    // Get signals with pagination
    const [signals, totalCount] = await Promise.all([
      prisma.threatSignal.findMany({
        where,
        include,
        orderBy: [
          { score: "desc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.threatSignal.count({ where }),
    ]);

    // Get summary statistics
    const stats = await prisma.threatSignal.groupBy({
      by: ["severity", "status"],
      _count: { severity: true },
    });

    const severityStats = await prisma.threatSignal.groupBy({
      by: ["severity"],
      _count: { severity: true },
      _avg: { score: true },
    });

    return NextResponse.json({
      success: true,
      signals,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
      stats: {
        bySeverity: severityStats,
        bySeverityAndStatus: stats,
      },
    });

  } catch (error) {
    console.error("[Signals API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, severity, score } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: id",
        },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ["NEW", "ENRICHED", "SCORED", "ALERTED", "DISMISSED", "FALSE_POSITIVE", "CONFIRMED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate severity if provided
    const validSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    if (severity && !validSeverities.includes(severity)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid severity. Must be one of: ${validSeverities.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updateData: any = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (severity !== undefined) updateData.severity = severity;
    if (score !== undefined) updateData.score = score;

    const signal = await prisma.threatSignal.update({
      where: { id },
      data: updateData,
      include: {
        raw: {
          include: {
            source: true,
          },
        },
        alertEvents: true,
      },
    });

    return NextResponse.json({
      success: true,
      signal,
    });

  } catch (error) {
    console.error("[Signals API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
