import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { qEnrich, safeAddJob, areQueuesAvailable } from "../queues";
import { beat } from "@/lib/threat-detection/heartbeat";

// Initialize Redis connection
const connection = process.env.REDIS_URL ? new (require("ioredis"))(process.env.REDIS_URL) : null;

export const normalizeWorker = new Worker(
  "raw_ingest",
  async (job) => {
    try {
      const { rawId } = job.data as { rawId: string };
      
      console.log(`[Normalize Worker] Processing rawId: ${rawId}`);

      // Find the raw ingest record
      const raw = await prisma.rawIngest.findUnique({ where: { id: rawId } });
      if (!raw) {
        console.error(`[Normalize Worker] Raw ingest not found: ${rawId}`);
        return;
      }

      // Check if threat signal already exists
      const existingSignal = await prisma.threatSignal.findUnique({ 
        where: { rawId } 
      });

      if (existingSignal) {
        console.log(`[Normalize Worker] Threat signal already exists for rawId: ${rawId}`);
        // Still queue for enrichment to update if needed
      } else {
        // Create initial threat signal record
        await prisma.threatSignal.create({
          data: {
            rawId,
            status: "NEW",
            severity: "LOW",
            score: 0,
            indicators: "",
          },
        });
        console.log(`[Normalize Worker] Created threat signal for rawId: ${rawId}`);
      }

      // Queue for enrichment
      const enrichJob = await safeAddJob(
        qEnrich,
        "enrich",
        { rawId },
        { removeOnComplete: true, attempts: 3 }
      );

      if (enrichJob) {
        console.log(`[Normalize Worker] Queued for enrichment (job: ${enrichJob.id})`);
      } else {
        console.warn(`[Normalize Worker] Failed to queue for enrichment - queues may be disabled`);
      }

      // Heartbeat
      await beat("normalize");

    } catch (error) {
      console.error(`[Normalize Worker] Error processing job:`, error);
      throw error; // Re-throw to trigger retry mechanism
    }
  },
  { 
    connection: connection || undefined,
    concurrency: 5, // Process up to 5 jobs concurrently
    removeOnComplete: 10,
    removeOnFail: 5,
  }
);

// Handle worker events
normalizeWorker.on('completed', (job) => {
  console.log(`[Normalize Worker] Job ${job.id} completed successfully`);
});

normalizeWorker.on('failed', (job, err) => {
  console.error(`[Normalize Worker] Job ${job?.id} failed:`, err.message);
});

normalizeWorker.on('error', (err) => {
  console.error(`[Normalize Worker] Worker error:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Normalize Worker] Received SIGTERM, closing worker...');
  await normalizeWorker.close();
});

process.on('SIGINT', async () => {
  console.log('[Normalize Worker] Received SIGINT, closing worker...');
  await normalizeWorker.close();
});

console.log(`[Normalize Worker] Started ${areQueuesAvailable() ? 'with Redis' : 'without Redis (disabled)'}`);
