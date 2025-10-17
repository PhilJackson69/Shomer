import { prisma } from "@/lib/prisma";
import { qRaw, safeAddJob } from "../queues";
import { createHash } from "crypto";

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: { name: string } | null;
  created_utc: number;
  permalink: string;
  url: string;
  subreddit: string;
}

interface RedditApiConfig {
  userAgent: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

// Mock Reddit API client for now - in production, use snoowrap
class RedditClient {
  private config: RedditApiConfig;

  constructor(config: RedditApiConfig) {
    this.config = config;
  }

  async getSubredditPosts(subreddit: string, limit: number = 50): Promise<RedditPost[]> {
    // TODO: Replace with actual Reddit API calls using snoowrap
    // For now, return mock data for development
    console.log(`[Reddit Collector] Fetching ${limit} posts from r/${subreddit}`);
    
    // Mock data for development - remove in production
    return [
      {
        id: `mock_${Date.now()}_1`,
        title: "Mock threat post for testing",
        selftext: "This is a test post that contains threatening language about attacking a synagogue this Friday.",
        author: { name: "testuser" },
        created_utc: Math.floor(Date.now() / 1000),
        permalink: `/r/${subreddit}/comments/mock_${Date.now()}_1/`,
        url: `https://reddit.com/r/${subreddit}/comments/mock_${Date.now()}_1/`,
        subreddit: subreddit,
      }
    ];
  }
}

export async function runRedditCollector(feedId: string): Promise<void> {
  try {
    if (process.env.TD_COLLECTORS_ENABLED === "false") {
      console.log(`[Reddit Collector] TD_COLLECTORS_ENABLED=false, skipping`);
      return;
    }
    const feed = await prisma.sourceFeed.findUnique({ where: { id: feedId } });
    if (!feed || !feed.enabled || feed.type !== "REDDIT") {
      console.log(`[Reddit Collector] Feed ${feedId} not found, disabled, or not a Reddit feed`);
      return;
    }

    console.log(`[Reddit Collector] Starting collection for feed: ${feed.name} (${feed.endpoint})`);

    // Initialize Reddit client
    const redditClient = new RedditClient({
      userAgent: process.env.REDDIT_USER_AGENT || "Shomer/1.0",
      clientId: process.env.REDDIT_CLIENT_ID || "",
      clientSecret: process.env.REDDIT_CLIENT_SECRET || "",
      username: process.env.REDDIT_USERNAME || "",
      password: process.env.REDDIT_PASSWORD || "",
    });

    // Fetch posts from the subreddit
    const subreddit = feed.endpoint; // e.g., "SanFrancisco"
    const posts = await redditClient.getSubredditPosts(subreddit, 50);

    let processedCount = 0;
    let skippedCount = 0;

    for (const post of posts) {
      try {
        const url = `https://reddit.com${post.permalink}`;
        const content = [post.title, post.selftext].filter(Boolean).join("\n\n");
        const hash = createHash("sha256")
          .update(content.slice(0, 2000) + url)
          .digest("hex");

        // Check for duplicates at raw level
        const existingRaw = await prisma.rawIngest.findUnique({ where: { hash } });
        if (existingRaw) {
          skippedCount++;
          continue;
        }

        // Create raw ingest record
        const raw = await prisma.rawIngest.create({
          data: {
            sourceId: feed.id,
            externalId: post.id,
            url,
            title: post.title,
            content,
            author: post.author?.name ?? null,
            publishedAt: new Date(post.created_utc * 1000),
            raw: JSON.stringify(post),
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
          console.log(`[Reddit Collector] Queued post ${post.id} for normalization (job: ${job.id})`);
        }

      } catch (error) {
        console.error(`[Reddit Collector] Error processing post ${post.id}:`, error);
      }
    }

    // Update feed cursor (for pagination)
    const lastPostId = posts.length > 0 ? posts[posts.length - 1].id : feed.lastCursor;
    await prisma.sourceFeed.update({
      where: { id: feed.id },
      data: { lastCursor: lastPostId, updatedAt: new Date() },
    });

    console.log(`[Reddit Collector] Completed: ${processedCount} processed, ${skippedCount} skipped`);

  } catch (error) {
    console.error(`[Reddit Collector] Error in runRedditCollector:`, error);
  }
}

// Function to collect from all enabled Reddit feeds
export async function collectFromAllRedditFeeds(): Promise<void> {
  try {
    const redditFeeds = await prisma.sourceFeed.findMany({
      where: { type: "REDDIT", enabled: true },
    });

    console.log(`[Reddit Collector] Found ${redditFeeds.length} enabled Reddit feeds`);

    for (const feed of redditFeeds) {
      await runRedditCollector(feed.id);
      // Add small delay between feeds to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error(`[Reddit Collector] Error in collectFromAllRedditFeeds:`, error);
  }
}
