#!/usr/bin/env tsx

import { prisma } from "../src/lib/prisma";
import { qRaw, safeAddJob, areQueuesAvailable } from "../src/lib/threat-detection/queues";

type Fixture = {
  title?: string;
  content: string;
  url: string;
  author?: string;
  publishedAt?: Date;
};

const fixtures: Fixture[] = [
  // Explicit + target + time
  { content: "we will attack the synagogue this Friday at 8pm bring the rifles", url: "https://example.com/f/1" },
  // Vague rant (LOW/MEDIUM)
  { content: "I am so tired of everything these days, nothing makes sense.", url: "https://example.com/f/2" },
  // Weapons mention without target (MEDIUM)
  { content: "got ammo and a new rifle, testing at the range tomorrow", url: "https://example.com/f/3" },
  // Address/venue mention
  { content: "meet at 123 Temple Ave building C around 9 pm", url: "https://example.com/f/4" },
  // False-positive bait
  { content: "paintball at temple youth center fundraiser this weekend!", url: "https://example.com/f/5" },
  // Planning language
  { content: "the operation is set, we coordinate at dawn then execute the plan", url: "https://example.com/f/6" },
  // Time only
  { content: "tomorrow night at midnight things will happen", url: "https://example.com/f/7" },
  // Target place only
  { content: "the synagogue on elm street needs more security", url: "https://example.com/f/8" },
  // Violence mention
  { content: "someone threatened to bomb the building online", url: "https://example.com/f/9" },
  // Location hint
  { content: "coordinates are on the map next to the avenue", url: "https://example.com/f/10" },
  // Ambiguous with weapon word in benign context
  { content: "kitchen knife skills workshop at community center", url: "https://example.com/f/11" },
  // Another FP style
  { content: "charity drive at the temple with water guns for kids", url: "https://example.com/f/12" },
];

async function ensureFixtureSource() {
  const name = "Fixtures";
  const endpoint = "fixtures";
  const type = "OTHER";
  let source = await prisma.sourceFeed.findFirst({ where: { endpoint } });
  if (!source) {
    source = await prisma.sourceFeed.create({ data: { name, endpoint, type, enabled: true } });
    console.log(`Created source feed: ${name}`);
  }
  return source;
}

async function pushFixture(rawInput: Fixture, sourceId: string) {
  const raw = await prisma.rawIngest.create({
    data: {
      sourceId,
      externalId: `fixture:${rawInput.url}`,
      url: rawInput.url,
      title: rawInput.title ?? null,
      content: rawInput.content,
      author: rawInput.author ?? null,
      publishedAt: rawInput.publishedAt ?? null,
      raw: JSON.stringify(rawInput),
      hash: `fx_${Buffer.from(rawInput.url).toString("hex")}`,
    },
  });
  console.log(`Inserted RawIngest ${raw.id}`);

  // Queue normalize step
  const job = await safeAddJob(qRaw, "raw_ingest", { rawId: raw.id }, { removeOnComplete: true, attempts: 2 });
  if (job) {
    console.log(`Queued normalize for ${raw.id} (job ${job.id})`);
  } else {
    console.warn(`Queues disabled; normalize will not run automatically.`);
  }
}

async function main() {
  console.log("Replaying threat fixtures...");
  const source = await ensureFixtureSource();
  for (const fx of fixtures) {
    try {
      await pushFixture(fx, source.id);
    } catch (e) {
      console.error("Failed to push fixture", fx.url, e);
    }
  }

  if (!areQueuesAvailable()) {
    console.log("Note: USE_REDIS=true and REDIS_URL required for workers to process the queue.");
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});


