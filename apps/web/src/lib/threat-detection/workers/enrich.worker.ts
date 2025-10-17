import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { qScore, safeAddJob, areQueuesAvailable } from "../queues";
import franc from "franc";
import nlp from "compromise";
import fs from "fs";
import path from "path";
import { getRedis } from "@/lib/redis";
import { LEXICON_RELOAD_CHANNEL } from "@/lib/threat-detection/lexicon.reload";
import { loadLexicon } from "@/lib/threat-detection/lexicon.store";
import { beat } from "@/lib/threat-detection/heartbeat";

// Initialize Redis connection
const connection = process.env.REDIS_URL ? getRedis() : null;

// Load lexicon config if present
type Lexicon = {
  weapons?: string[];
  targets?: string[];
  time_hints?: string[];
  location_hints?: string[];
  planning?: string[];
  exclusions?: string[];
};

function loadLexicon(): Lexicon {
  try {
    const configPath = path.join(process.cwd(), "apps", "web", "config", "lexicon.yml");
    if (fs.existsSync(configPath)) {
      const yaml = require("js-yaml");
      return (yaml.load(fs.readFileSync(configPath, "utf8")) as Lexicon) || {};
    }
  } catch (e) {
    console.warn("[Enrich Worker] Failed to load lexicon.yml:", e);
  }
  return {};
}

let CACHED_LEXICON: any = loadLexicon();
// Subscribe for hot-reload
(async () => {
  try {
    if (process.env.REDIS_URL) {
      const sub = new IORedis(process.env.REDIS_URL);
      await sub.subscribe(LEXICON_RELOAD_CHANNEL);
      sub.on("message", async (channel) => {
        if (channel === LEXICON_RELOAD_CHANNEL) {
          CACHED_LEXICON = await loadLexicon();
          console.log("[lexicon] reloaded");
        }
      });
    }
  } catch (e) {
    console.warn("[Enrich Worker] Lexicon reload subscription failed:", e);
  }
})();

const THREAT_KEYWORDS = [
  // Violence
  "kill", "murder", "attack", "bomb", "explosive", "shoot", "gun", "rifle", "knife", "stab",
  "firebomb", "molotov", "arson", "burn", "destroy", "vandalize", "smash",
  // Weapons
  "weapon", "ammunition", "bullet", "ammo", "grenade", "pipe bomb", "improvised explosive",
  // Targets
  ...(CACHED_LEXICON.targets || ["synagogue", "shul", "temple", "jewish center", "chabad", "hebrew", "israeli", "jewish", "mosque", "church", "school", "hospital", "government building"]),
  // Time indicators
  ...(CACHED_LEXICON.time_hints || ["tonight", "tomorrow", "friday", "saturday", "sunday", "shabbat", "sabbath", "8 pm", "9 pm", "10 pm", "midnight", "dawn", "morning"]),
  // Location indicators
  ...(CACHED_LEXICON.location_hints || ["address", "street", "avenue", "building", "location", "coordinates", "map"]),
  // Planning
  ...(CACHED_LEXICON.planning || ["plan", "plot", "scheme", "operation", "mission", "target", "hit", "gather", "meet", "coordinate", "execute", "carry out"]),
  // Weapons (additional from lexicon)
  ...(CACHED_LEXICON.weapons || []),
];

export const enrichWorker = new Worker(
  "enrich",
  async (job) => {
    try {
      const { rawId } = job.data as { rawId: string };
      
      console.log(`[Enrich Worker] Processing rawId: ${rawId}`);

      // Find the raw ingest and threat signal
      const raw = await prisma.rawIngest.findUnique({ where: { id: rawId } });
      if (!raw) {
        console.error(`[Enrich Worker] Raw ingest not found: ${rawId}`);
        return;
      }

      const signal = await prisma.threatSignal.findUnique({ where: { rawId } });
      if (!signal) {
        console.error(`[Enrich Worker] Threat signal not found for rawId: ${rawId}`);
        return;
      }

      // Combine title and content for analysis
      const text = [raw.title ?? "", raw.content].join("\n").trim();
      
      if (!text) {
        console.log(`[Enrich Worker] No text content found for rawId: ${rawId}`);
        return;
      }

      // Language detection
      let detectedLang = "und";
      try {
        detectedLang = franc(text) || "und";
        // Map common language codes
        if (detectedLang === "eng") detectedLang = "en";
        if (detectedLang === "spa") detectedLang = "es";
        if (detectedLang === "fra") detectedLang = "fr";
        if (detectedLang === "deu") detectedLang = "de";
      } catch (error) {
        console.warn(`[Enrich Worker] Language detection failed:`, error);
      }

      // Named Entity Recognition using compromise
      let entities: any = { persons: [], orgs: [], locations: [], dates: [] };
      try {
        const doc = nlp(text);
        entities = {
          persons: doc.people().out("array"),
          orgs: doc.organizations().out("array"),
          locations: doc.places().out("array"),
          dates: doc.dates().out("array"),
        };
        
        // Clean up empty arrays
        Object.keys(entities).forEach(key => {
          if (!entities[key] || entities[key].length === 0) {
            entities[key] = [];
          }
        });
      } catch (error) {
        console.warn(`[Enrich Worker] NER failed:`, error);
      }

      // Keyword matching for threat indicators
      const indicators: string[] = [];
      const lowerText = text.toLowerCase();
      const exclusionHits = (CACHED_LEXICON.exclusions || []).some((ex: string) => lowerText.includes(ex.toLowerCase()));
      
      for (const keyword of THREAT_KEYWORDS) {
        if (lowerText.includes(keyword.toLowerCase())) {
          // Categorize the indicator
          if (["kill", "murder", "attack", "bomb", "explosive", "shoot", "gun", "rifle", "knife", "stab", "firebomb", "molotov", "arson", "burn", "destroy", "vandalize", "smash"].includes(keyword)) {
            indicators.push("violence");
          } else if (["weapon", "ammunition", "bullet", "ammo", "grenade", "pipe bomb", "improvised explosive"].includes(keyword)) {
            indicators.push("weapon");
          } else if ([...(CACHED_LEXICON.targets || []), "synagogue", "shul", "temple", "jewish center", "chabad", "hebrew", "israeli", "jewish", "mosque", "church", "school", "hospital", "government building"].includes(keyword)) {
            indicators.push("target_place");
          } else if ([...(CACHED_LEXICON.time_hints || []), "tonight", "tomorrow", "friday", "saturday", "sunday", "shabbat", "sabbath", "8 pm", "9 pm", "10 pm", "midnight", "dawn", "morning"].includes(keyword)) {
            indicators.push("time_hint");
          } else if ([...(CACHED_LEXICON.location_hints || []), "address", "street", "avenue", "building", "location", "coordinates", "map"].includes(keyword)) {
            indicators.push("location_hint");
          } else if ([...(CACHED_LEXICON.planning || []), "plan", "plot", "scheme", "operation", "mission", "target", "hit", "gather", "meet", "coordinate", "execute", "carry out"].includes(keyword)) {
            indicators.push("planning");
          } else {
            indicators.push(keyword);
          }
        }
      }

      // Apply exclusions by removing certain categories when exclusion phrases present
      let uniqueIndicators = [...new Set(indicators)];
      if (exclusionHits) {
        uniqueIndicators = uniqueIndicators.filter(k => !["weapon", "violence", "target_place", "time_hint"].includes(k));
      }

      // Remove duplicates
      // Update the threat signal with enrichment data
      await prisma.threatSignal.update({
        where: { id: signal.id },
        data: {
          lang: detectedLang,
          entities: JSON.stringify(entities),
          indicators: uniqueIndicators.join(","),
          status: "ENRICHED",
          updatedAt: new Date(),
        },
      });

      console.log(`[Enrich Worker] Enriched signal ${signal.id}: lang=${detectedLang}, indicators=[${uniqueIndicators.join(", ")}]`);

      // Queue for scoring
      const scoreJob = await safeAddJob(
        qScore,
        "score",
        { rawId },
        { removeOnComplete: true, attempts: 3 }
      );

      if (scoreJob) {
        console.log(`[Enrich Worker] Queued for scoring (job: ${scoreJob.id})`);
      } else {
        console.warn(`[Enrich Worker] Failed to queue for scoring - queues may be disabled`);
      }

      // Heartbeat
      await beat("enrich");

    } catch (error) {
      console.error(`[Enrich Worker] Error processing job:`, error);
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
enrichWorker.on('completed', (job) => {
  console.log(`[Enrich Worker] Job ${job.id} completed successfully`);
});

enrichWorker.on('failed', (job, err) => {
  console.error(`[Enrich Worker] Job ${job?.id} failed:`, err.message);
});

enrichWorker.on('error', (err) => {
  console.error(`[Enrich Worker] Worker error:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Enrich Worker] Received SIGTERM, closing worker...');
  await enrichWorker.close();
});

process.on('SIGINT', async () => {
  console.log('[Enrich Worker] Received SIGINT, closing worker...');
  await enrichWorker.close();
});

console.log(`[Enrich Worker] Started ${areQueuesAvailable() ? 'with Redis' : 'without Redis (disabled)'}`);
