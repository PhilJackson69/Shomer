import { NextRequest, NextResponse } from "next/server";
import { collectFromAllRedditFeeds } from "@/lib/threat-detection/collectors/reddit.collector";
import { collectFromAllRSSFeeds } from "@/lib/threat-detection/collectors/rss.collector";

export async function POST(request: NextRequest) {
  try {
    // Parse request body to determine which collectors to run
    const body = await request.json().catch(() => ({}));
    const { sources = ["reddit", "rss"] } = body;

    const results: any = {};

    // Run Reddit collector
    if (sources.includes("reddit")) {
      try {
        await collectFromAllRedditFeeds();
        results.reddit = { status: "success", message: "Reddit collection completed" };
      } catch (error) {
        results.reddit = { 
          status: "error", 
          message: error instanceof Error ? error.message : "Unknown error" 
        };
      }
    }

    // Run RSS collector
    if (sources.includes("rss")) {
      try {
        await collectFromAllRSSFeeds();
        results.rss = { status: "success", message: "RSS collection completed" };
      } catch (error) {
        results.rss = { 
          status: "error", 
          message: error instanceof Error ? error.message : "Unknown error" 
        };
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("[Collect API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Threat Detection Collection API",
    endpoints: {
      POST: "Trigger collection from specified sources",
      body: {
        sources: ["reddit", "rss"], // optional, defaults to both
      }
    },
    timestamp: new Date().toISOString(),
  });
}
