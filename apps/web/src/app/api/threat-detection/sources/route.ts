import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDefaultRSSFeeds } from "@/lib/threat-detection/collectors/rss.collector";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const enabled = url.searchParams.get("enabled");

    const where: any = {};
    if (type) where.type = type;
    if (enabled !== null) where.enabled = enabled === "true";

    const sources = await prisma.sourceFeed.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { rawIngests: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      sources,
      count: sources.length,
    });

  } catch (error) {
    console.error("[Sources API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name, endpoint, enabled = true } = body;

    // Validate required fields
    if (!type || !name || !endpoint) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: type, name, endpoint",
        },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["REDDIT", "TELEGRAM", "RSS", "OTHER"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check for duplicate endpoint
    const existing = await prisma.sourceFeed.findFirst({
      where: { endpoint },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "A source feed with this endpoint already exists",
        },
        { status: 409 }
      );
    }

    // Create the source feed
    const source = await prisma.sourceFeed.create({
      data: {
        type,
        name,
        endpoint,
        enabled,
      },
    });

    return NextResponse.json({
      success: true,
      source,
    });

  } catch (error) {
    console.error("[Sources API] Error:", error);
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
    const { id, enabled, name } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required field: id",
        },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (enabled !== undefined) updateData.enabled = enabled;
    if (name !== undefined) updateData.name = name;
    updateData.updatedAt = new Date();

    const source = await prisma.sourceFeed.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      source,
    });

  } catch (error) {
    console.error("[Sources API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: id",
        },
        { status: 400 }
      );
    }

    // Check if source has any raw ingests
    const rawIngestCount = await prisma.rawIngest.count({
      where: { sourceId: id },
    });

    if (rawIngestCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete source feed with ${rawIngestCount} existing records. Disable it instead.`,
        },
        { status: 409 }
      );
    }

    await prisma.sourceFeed.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Source feed deleted successfully",
    });

  } catch (error) {
    console.error("[Sources API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
