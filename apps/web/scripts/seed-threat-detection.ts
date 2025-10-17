#!/usr/bin/env tsx

import { prisma } from "../src/lib/prisma";
import { seedDefaultRSSFeeds } from "../src/lib/threat-detection/collectors/rss.collector";

async function seedThreatDetection() {
  console.log("Seeding threat detection system...");

  try {
    // Seed default RSS feeds
    await seedDefaultRSSFeeds();
    console.log("✅ Default RSS feeds seeded");

    // Add some default Reddit feeds
    const redditFeeds = [
      {
        type: "REDDIT",
        name: "San Francisco",
        endpoint: "SanFrancisco",
        enabled: true,
      },
      {
        type: "REDDIT", 
        name: "Los Angeles",
        endpoint: "LosAngeles",
        enabled: true,
      },
      {
        type: "REDDIT",
        name: "Jewish Community",
        endpoint: "Jewish",
        enabled: true,
      },
      {
        type: "REDDIT",
        name: "Local News",
        endpoint: "LocalNews",
        enabled: true,
      },
    ];

    for (const feedData of redditFeeds) {
      const existing = await prisma.sourceFeed.findFirst({
        where: { endpoint: feedData.endpoint },
      });

      if (!existing) {
        await prisma.sourceFeed.create({
          data: feedData,
        });
        console.log(`✅ Created Reddit feed: ${feedData.name}`);
      } else {
        console.log(`⏭️  Reddit feed already exists: ${feedData.name}`);
      }
    }

    console.log("🎉 Threat detection seeding completed successfully!");

  } catch (error) {
    console.error("❌ Error seeding threat detection:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedThreatDetection();
