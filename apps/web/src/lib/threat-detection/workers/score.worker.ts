import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { qAlert, safeAddJob, areQueuesAvailable } from "../queues";
import { scoreFromFeatures } from "@/lib/threat-detection/score.shared";
import { beat } from "@/lib/threat-detection/heartbeat";

// Initialize Redis connection
const connection = process.env.REDIS_URL ? new (require("ioredis"))(process.env.REDIS_URL) : null;

// Scoring weights for different threat indicators
const SCORING_WEIGHTS = {
  explicitThreat: 2.5,    // Direct threats of violence
  weapon: 2.0,            // Mentions of weapons
  targetPlace: 1.8,       // Specific targeting of places
  timeHint: 1.5,          // Time-specific threats
  locationHint: 1.2,      // Location-specific information
  planning: 1.3,          // Planning language
  violence: 2.2,          // Violence-related keywords
  baseScore: 0.1,         // Base score for any content
};

// Severity thresholds
const SEVERITY_THRESHOLDS = {
  LOW: 0,
  MEDIUM: 2.0,
  HIGH: 4.0,
  CRITICAL: 7.0,
};

export const scoreWorker = new Worker(
  "score",
  async (job) => {
    try {
      const { rawId } = job.data as { rawId: string };
      
      console.log(`[Score Worker] Processing rawId: ${rawId}`);

      // Find the threat signal with raw data
      const signal = await prisma.threatSignal.findFirst({
        where: { rawId },
        include: { raw: true },
      });

      if (!signal) {
        console.error(`[Score Worker] Threat signal not found for rawId: ${rawId}`);
        return;
      }

      // Get enrichment data
      const indicators = signal.indicators ? signal.indicators.split(",") : [];
      const entities = signal.entities ? JSON.parse(signal.entities) : { persons: [], orgs: [], locations: [], dates: [] };
      
      const text = [signal.raw.title ?? "", signal.raw.content].join("\n").toLowerCase();

      // Initialize scoring components
      let score = SCORING_WEIGHTS.baseScore;
      const rationale: string[] = [];

      // Check for explicit threat language
      const explicitThreatPatterns = [
        /(kill|murder|destroy|eliminate)\s+(you|them|us|jews|muslims|christians)/i,
        /(going to|gonna|will)\s+(kill|murder|attack|bomb|shoot)/i,
        /(threat|threaten|warning).*(kill|attack|harm)/i,
      ];
      const hasExplicitThreat = explicitThreatPatterns.some((p) => p.test(text));

      // Map indicators string list to Set matching shared scoring
      const indicatorSet = new Set<string>();
      for (const i of indicators) {
        if (i === "weapon") indicatorSet.add("weapon");
        if (i === "target_place") indicatorSet.add("target");
        if (i === "time_hint") indicatorSet.add("time_hint");
        if (i === "planning") indicatorSet.add("planning");
        if (i === "location_hint") indicatorSet.add("location_hint");
        if (i === "violence") indicatorSet.add("weapon"); // fold violence into weapon weight
      }

      const shared = scoreFromFeatures({ text, indicators: indicatorSet, explicitThreatHit: hasExplicitThreat });
      score = shared.score;
      const severity = shared.severity;
      rationale.push(shared.rationale);

      // Bonus scoring for multiple indicators
      const indicatorCount = indicators.length;
      if (indicatorCount >= 3) {
        const bonus = indicatorCount * 0.3;
        score += bonus;
        rationale.push(`multiple_indicators_bonus:${bonus}`);
      }

      // Bonus for specific targeting
      if (indicators.includes("target_place") && indicators.includes("time_hint")) {
        const bonus = 1.0;
        score += bonus;
        rationale.push(`specific_targeting_bonus:${bonus}`);
      }

      // Penalty for low-quality content
      if (text.length < 50) {
        score *= 0.5;
        rationale.push("low_content_penalty:0.5x");
      }

      // Update the threat signal
      const updatedSignal = await prisma.threatSignal.update({
        where: { id: signal.id },
        data: {
          score: Math.round(score * 100) / 100, // Round to 2 decimal places
          severity,
          rationale: rationale.join("; "),
          status: "SCORED",
          updatedAt: new Date(),
        },
      });

      console.log(`[Score Worker] Scored signal ${signal.id}: score=${updatedSignal.score}, severity=${severity}`);

      // Check if this signal should trigger an alert
      const alertThreshold = parseFloat(process.env.SHOMER_ALERT_SCORE || "3.5");
      const shouldAlert = updatedSignal.score >= alertThreshold || 
                         updatedSignal.severity === "HIGH" || 
                         updatedSignal.severity === "CRITICAL";

      if (shouldAlert) {
        // Queue for alerting
        const alertJob = await safeAddJob(
          qAlert,
          "alert",
          { signalId: updatedSignal.id },
          { removeOnComplete: true, attempts: 3 }
        );

        if (alertJob) {
          console.log(`[Score Worker] Queued for alerting (job: ${alertJob.id})`);
        } else {
          console.warn(`[Score Worker] Failed to queue for alerting - queues may be disabled`);
        }
      } else {
        console.log(`[Score Worker] Signal ${signal.id} below alert threshold (${alertThreshold})`);
      }

      // Heartbeat
      await beat("score");

    } catch (error) {
      console.error(`[Score Worker] Error processing job:`, error);
      throw error; // Re-throw to trigger retry mechanism
    }
  },
  { 
    connection: connection || undefined,
    concurrency: 3, // Process up to 3 jobs concurrently
    removeOnComplete: 10,
    removeOnFail: 5,
  }
);

// Handle worker events
scoreWorker.on('completed', (job) => {
  console.log(`[Score Worker] Job ${job.id} completed successfully`);
});

scoreWorker.on('failed', (job, err) => {
  console.error(`[Score Worker] Job ${job?.id} failed:`, err.message);
});

scoreWorker.on('error', (err) => {
  console.error(`[Score Worker] Worker error:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Score Worker] Received SIGTERM, closing worker...');
  await scoreWorker.close();
});

process.on('SIGINT', async () => {
  console.log('[Score Worker] Received SIGINT, closing worker...');
  await scoreWorker.close();
});

console.log(`[Score Worker] Started ${areQueuesAvailable() ? 'with Redis' : 'without Redis (disabled)'}`);
