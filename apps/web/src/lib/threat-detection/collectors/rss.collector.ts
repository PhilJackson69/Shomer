import { prisma } from "@/lib/prisma";
import { qRaw, safeAddJob } from "../queues";
import { createHash } from "crypto";
import Parser from "rss-parser";

interface RSSItem {
  guid?: string;
  title?: string;
  content?: string;
  contentSnippet?: string;
  link?: string;
  pubDate?: string;
  author?: string;
  categories?: string[];
}

export async function runRSSCollector(feedId: string): Promise<void> {
  try {
    if (process.env.TD_COLLECTORS_ENABLED === "false") {
      console.log(`[RSS Collector] TD_COLLECTORS_ENABLED=false, skipping`);
      return;
    }
    const feed = await prisma.sourceFeed.findUnique({ where: { id: feedId } });
    if (!feed || !feed.enabled || feed.type !== "RSS") {
      console.log(`[RSS Collector] Feed ${feedId} not found, disabled, or not an RSS feed`);
      return;
    }

    console.log(`[RSS Collector] Starting collection for feed: ${feed.name} (${feed.endpoint})`);

    const parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Shomer/1.0 (Threat Detection Bot)'
      }
    });

    // Parse the RSS feed
    const rssData = await parser.parseURL(feed.endpoint);
    
    if (!rssData.items || rssData.items.length === 0) {
      console.log(`[RSS Collector] No items found in feed ${feed.name}`);
      return;
    }

    let processedCount = 0;
    let skippedCount = 0;

    for (const item of rssData.items) {
      try {
        // Use guid if available, otherwise create from title + link
        const externalId = item.guid || createHash("md5").update(`${item.title || ''}${item.link || ''}`).digest("hex");
        const url = item.link || "";
        const content = [item.title || "", item.content || item.contentSnippet || ""].filter(Boolean).join("\n\n");
        
        // Create hash for deduplication
        const hash = createHash("sha256")
          .update(content.slice(0, 2000) + url)
          .digest("hex");

        // Check for duplicates at raw level
        const existingRaw = await prisma.rawIngest.findUnique({ where: { hash } });
        if (existingRaw) {
          skippedCount++;
          continue;
        }

        // Parse publication date
        let publishedAt: Date | null = null;
        if (item.pubDate) {
          publishedAt = new Date(item.pubDate);
          if (isNaN(publishedAt.getTime())) {
            publishedAt = null;
          }
        }

        // Create raw ingest record
        const raw = await prisma.rawIngest.create({
          data: {
            sourceId: feed.id,
            externalId,
            url,
            title: item.title || null,
            content,
            author: item.author || null,
            publishedAt,
            raw: JSON.stringify({
              ...item,
              feedTitle: rssData.title,
              feedDescription: rssData.description,
              feedLink: rssData.link,
            }),
            hash,
          },
        });

        // Queue for normalization
        const job = await safeAddJob(
          qRaw,
          "normalize",
          { rawId: raw.id },
          { removeOnComplete: true, attempts: 3 }
        );

        if (job) {
          processedCount++;
          console.log(`[RSS Collector] Queued item ${externalId} for normalization (job: ${job.id})`);
        }

      } catch (error) {
        console.error(`[RSS Collector] Error processing item ${item.guid || item.title}:`, error);
      }
    }

    // Update feed cursor (store the last item's pubDate or current time)
    const lastItem = rssData.items[rssData.items.length - 1];
    const lastCursor = lastItem?.pubDate || new Date().toISOString();
    await prisma.sourceFeed.update({
      where: { id: feed.id },
      data: { lastCursor, updatedAt: new Date() },
    });

    console.log(`[RSS Collector] Completed: ${processedCount} processed, ${skippedCount} skipped`);

  } catch (error) {
    console.error(`[RSS Collector] Error in runRSSCollector for feed ${feedId}:`, error);
  }
}

// Function to collect from all enabled RSS feeds
export async function collectFromAllRSSFeeds(): Promise<void> {
  try {
    const rssFeeds = await prisma.sourceFeed.findMany({
      where: { type: "RSS", enabled: true },
    });

    console.log(`[RSS Collector] Found ${rssFeeds.length} enabled RSS feeds`);

    for (const feed of rssFeeds) {
      await runRSSCollector(feed.id);
      // Add small delay between feeds to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (error) {
    console.error(`[RSS Collector] Error in collectFromAllRSSFeeds:`, error);
  }
}

// Common RSS feeds for threat detection
export const DEFAULT_RSS_FEEDS = [
  {
    name: "Local News - San Francisco",
    endpoint: "https://www.sfchronicle.com/rss/news/",
    type: "RSS" as const,
  },
  {
    name: "Security Advisories - CISA",
    endpoint: "https://www.cisa.gov/news.xml",
    type: "RSS" as const,
  },
  {
    name: "Local News - Los Angeles",
    endpoint: "https://www.latimes.com/rss2.0.xml",
    type: "RSS" as const,
  },
  {
    name: "Security News - Bleeping Computer",
    endpoint: "https://www.bleepingcomputer.com/feed/",
    type: "RSS" as const,
  },
];

// Function to seed default RSS feeds
export async function seedDefaultRSSFeeds(): Promise<void> {
  try {
    for (const feedData of DEFAULT_RSS_FEEDS) {
      const existing = await prisma.sourceFeed.findFirst({
        where: { endpoint: feedData.endpoint },
      });

      if (!existing) {
        await prisma.sourceFeed.create({
          data: feedData,
        });
        console.log(`[RSS Collector] Created default feed: ${feedData.name}`);
      }
    }
  } catch (error) {
    console.error(`[RSS Collector] Error seeding default feeds:`, error);
  }
}
