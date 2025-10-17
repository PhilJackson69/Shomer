import { getRedis as getRedisClient } from "@/lib/redis";

const CHANNEL = "shomer:lexicon:reload";

function getRedis() {
  return getRedisClient();
}

export async function publishLexiconReload() {
  const redis = getRedis();
  try {
    await redis.publish(CHANNEL, "reload");
  } finally {
    await redis.quit();
  }
}

export const LEXICON_RELOAD_CHANNEL = CHANNEL;


