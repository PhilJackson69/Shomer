import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import crypto from "node:crypto";
import { parseStringPromise } from "xml2js";
import { geocodePlace } from "@/lib/geocode";
import { getOrgFromApiKey } from "@/lib/tenant";
import { verifyIngest } from "@/lib/ingest-auth";
import { apiFetch } from '@/lib/apiFetch';


export const dynamic = "force-dynamic";

const Body = z.object({
  feedUrl: z.string().url(),
  region: z.string().min(2),
  topic: z.string().min(2).optional(),
  kind: z.string().default("rss"),
});

function scoreText(text: string): number {
  const KEYWORDS = ["synagogue","jewish","zionist","attack","bomb","shoot","burn","harm","threat"];
  const lc = text.toLowerCase();
  let score = 0;
  for (const kw of KEYWORDS) {
    const count = lc.split(kw).length - 1;
    score += count * 12;
  }
  if (/\b(tonight|tomorrow|now|near|at)\b/i.test(text)) score += 10;
  if (/\b(synagogue|temple)\b/i.test(text)) score += 10;
  return Math.min(100, score);
}

export async function POST(req: NextRequest) {
  const tenant = await getOrgFromApiKey(req.headers.get("authorization"));
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.CRON_SECRET && req.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (process.env.INGEST_HMAC_SECRET && !verifyIngest(req as any)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { feedUrl, region, topic, kind } = parsed.data;

  const xml = await apiFetch(feedUrl).then(r=>r.text());
  const doc = await parseStringPromise(xml);
  const items: any[] = doc?.rss?.channel?.[0]?.item ?? [];

  let created = 0;
  for (const it of items.slice(0, 25)) {
    const title: string = it.title?.[0] ?? "Untitled";
    const url: string | undefined = it.link?.[0];
    const text: string = `${title} ${it.description?.[0] ?? ""}`;
    const score = scoreText(text);
    const risk = score >= 80 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW";

    const hash = crypto.createHash("sha256").update(`${url ?? ""}|${title}`).digest("hex");
    const existing = await prisma.alert.findFirst({ where: { hash, orgId: tenant.orgId } });
    if (existing) continue;

    const src = await prisma.source.upsert({
      where: { externalId: url ?? crypto.randomUUID() },
      update: { url, kind },
      create: { externalId: url ?? crypto.randomUUID(), url, kind, region, topic, orgId: tenant.orgId },
      select: { id: true },
    });

    let coords: { lat: number; lng: number } | null = null;
    if (region) coords = await geocodePlace(region);

    await prisma.alert.create({
      data: {
        title,
        summary: text.slice(0, 240),
        contentUrl: url,
        score,
        risk: risk as any,
        region,
        topic,
        sourceId: src.id,
        verified: false,
        hash,
        orgId: tenant.orgId,
        lat: coords?.lat,
        lng: coords?.lng,
      },
    });
    created++;
  }

  return NextResponse.json({ ok: true, created });
}


