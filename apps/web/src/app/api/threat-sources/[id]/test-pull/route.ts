import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runRedditCollector } from "@/lib/threat-detection/collectors/reddit.collector";
import { runRSSCollector } from "@/lib/threat-detection/collectors/rss.collector";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const feed = await prisma.sourceFeed.findUnique({ where: { id: params.id } });
  if (!feed) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!feed.enabled) return NextResponse.json({ ok: false, error: "Feed disabled" }, { status: 400 });

  if (feed.type === "REDDIT") await runRedditCollector(feed.id);
  else if (feed.type === "RSS") await runRSSCollector(feed.id);

  return NextResponse.json({ ok: true });
}


