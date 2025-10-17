import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { notifySlack, meetsMinLevel } from "@/lib/notify";
import { publishEvent } from "@/lib/cache";
import { requireOrg } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Minimal keyword+heuristic scoring for MVP mock
const KEYWORDS = [
  "synagogue",
  "jewish",
  "zionist",
  "attack",
  "bomb",
  "shoot",
  "burn",
  "harm",
  "threat",
];

function scoreText(text: string): number {
  const lc = text.toLowerCase();
  let score = 0;
  for (const kw of KEYWORDS) {
    const count = lc.split(kw).length - 1;
    score += count * 12; // 12 points per hit
  }
  if (/\b(tonight|tomorrow|now|near|at)\b/i.test(text)) score += 10;
  if (/\b(synagogue|temple)\b/i.test(text)) score += 10;
  return Math.min(100, score);
}

function level(score: number): "LOW" | "MEDIUM" | "HIGH" {
  if (score >= 80) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export async function POST(req: NextRequest) {
  const tenant = await requireOrg(req as any);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Accept optional payload to simulate inputs from sources
  const body = await req.json().catch(() => ({ posts: [] as any[] }));
  const posts: Array<{
    title?: string;
    text: string;
    url?: string;
    region?: string;
    topic?: string;
    source?: { kind: string; externalId?: string; url?: string };
  }> = body?.posts ?? [
    {
      title: "Threatening phrasing post",
      text: "We should attack that synagogue near 3rd street tonight.",
      url: "https://example.com/post/1",
      region: "SF-Bay-Area",
      topic: "synagogue",
      source: { kind: "mock", externalId: "post-1", url: "https://example.com/post/1" },
    },
    {
      title: "General antisemitic rant",
      text: "I hate zionist people.",
      url: "https://example.com/post/2",
      region: "Los-Angeles",
      topic: "generic",
      source: { kind: "mock", externalId: "post-2", url: "https://example.com/post/2" },
    },
  ];

  const setting = await prisma.setting.findUnique({ where: { id: "default" } }).catch(() => null);
  const threshold = setting?.alertThreshold ?? (env.ALERT_THRESHOLD ?? 65);

  const createdIds: string[] = [];

  for (const p of posts) {
    const score = scoreText(`${p.title ?? ""} ${p.text}`);
    if (score < threshold) continue;

    // upsert Source
    let sourceId: string | undefined;
    if (p.source) {
      const src = await prisma.source.upsert({
        where: { externalId: p.source.externalId ?? "mock" },
        update: {
          url: p.source.url,
          kind: p.source.kind,
        },
        create: {
          externalId: p.source.externalId ?? crypto.randomUUID(),
          url: p.source.url,
          kind: p.source.kind,
          orgId: tenant.orgId,
          region: p.region,
          topic: p.topic,
        },
      });
      sourceId = src.id;
    }

    const hash = crypto
      .createHash("sha256")
      .update(`${p.url ?? ""}|${p.title ?? ""}|${p.text}`)
      .digest("hex");

    // dedupe by hash
    const existing = await prisma.alert.findFirst({ where: { hash, orgId: tenant.orgId } });
    if (existing) continue;

    const alert = await prisma.alert.create({
      data: {
        title: p.title ?? p.text.slice(0, 80),
        summary: p.text.slice(0, 240),
        contentUrl: p.url,
        score,
        risk: level(score) as any,
        region: p.region,
        topic: p.topic,
        sourceId,
        verified: false,
        hash,
        orgId: tenant.orgId,
      },
      select: { id: true },
    });
    const lvl = level(score);
    const minLevel = setting?.slackMinLevel ?? env.SLACK_MIN_LEVEL;
    if (process.env.SLACK_WEBHOOK_URL && meetsMinLevel(lvl as any, minLevel as any)) {
      await notifySlack(process.env.SLACK_WEBHOOK_URL, {
        level: lvl as any,
        score,
        title: p.title ?? p.text.slice(0, 80),
        region: p.region,
        topic: p.topic,
        contentUrl: p.url,
      });
    }
    createdIds.push(alert.id);
    await publishEvent("alert_created", { id: alert.id });
  }

  return NextResponse.json({ created: createdIds }, { status: 201 });
}


