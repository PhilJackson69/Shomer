import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { areQueuesAvailable } from "@/lib/threat-detection/queues";
import { Queue } from "bullmq";
import { checkHeartbeats } from "@/lib/threat-detection/heartbeat";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const redisUrl = process.env.REDIS_URL;
  let redisOk = false;
  let queueInfo: any = { queuesEnabled: areQueuesAvailable() };
  try {
    if (redisUrl) {
      const client = getRedis();
      const pong = await client.ping();
      redisOk = pong === "PONG";
      await client.quit();
    }
  } catch {
    redisOk = false;
  }

  // Get simple counts and recency
  const [rawCount, signalCount, lastCollector] = await Promise.all([
    prisma.rawIngest.count(),
    prisma.threatSignal.count(),
    prisma.sourceFeed.findMany({
      where: { enabled: true },
      select: { id: true, name: true, lastCursor: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 1,
    }),
  ]);

  const lastRun = lastCollector[0]?.updatedAt ?? null;

  // Queue sizes (best-effort if Redis available)
  let queues: any = null;
  try {
    if (redisOk && redisUrl) {
      const conn = getRedis();
      const qRaw = new Queue("raw_ingest", { connection: conn });
      const qEnrich = new Queue("enrich", { connection: conn });
      const qScore = new Queue("score", { connection: conn });
      const qAlert = new Queue("alert", { connection: conn });
      const [rawWaiting, enrichWaiting, scoreWaiting, alertWaiting] = await Promise.all([
        qRaw.getWaitingCount(),
        qEnrich.getWaitingCount(),
        qScore.getWaitingCount(),
        qAlert.getWaitingCount(),
      ]);
      queues = { raw: rawWaiting, enrich: enrichWaiting, score: scoreWaiting, alert: alertWaiting };
      await Promise.all([qRaw.close(), qEnrich.close(), qScore.close(), qAlert.close()]);
      await conn.quit();
    }
  } catch {
    queues = null;
  }

  const heartbeats = await checkHeartbeats(["normalize","enrich","score","alert","collector:reddit","collector:rss"]);
  const anyBad = Object.values(heartbeats).some((s) => s !== "ok");
  const flags = {
    alerts: process.env.TD_ALERTS_ENABLED !== "false",
    collectors: process.env.TD_COLLECTORS_ENABLED !== "false",
  };
  const ok = (redisOk ? true : false) && !anyBad;

  return NextResponse.json({
    ok,
    redis: redisOk ? "ok" : "fail",
    queues,
    counts: { rawIngest: rawCount, signals: signalCount },
    lastCollectorRun: lastRun,
    heartbeats,
    flags,
  });
}


