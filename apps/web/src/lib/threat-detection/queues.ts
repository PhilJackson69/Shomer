import { Queue } from "bullmq";
import { getRedis } from "@/lib/redis";

// Use the same Redis connection pattern as the existing system
const useRedis = process.env.USE_REDIS === 'true' && process.env.REDIS_URL;

let connection: ReturnType<typeof getRedis> | null = null;

function getConnection() {
  if (!useRedis) return null;
  if (connection) return connection;
  
  try {
    connection = getRedis();
    return connection;
  } catch {
    return null;
  }
}

// Queue instances
export const qRaw = new Queue("raw_ingest", { 
  connection: getConnection() || undefined,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
});

export const qEnrich = new Queue("enrich", { 
  connection: getConnection() || undefined,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
});

export const qScore = new Queue("score", { 
  connection: getConnection() || undefined,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
});

export const qAlert = new Queue("alert", { 
  connection: getConnection() || undefined,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
});

// Helper function to check if queues are available
export function areQueuesAvailable(): boolean {
  return useRedis && !!getConnection();
}

// Helper function to safely add jobs
export async function safeAddJob(queue: Queue, jobName: string, data: any, options?: any) {
  if (!areQueuesAvailable()) {
    console.warn(`Queue ${queue.name} not available - Redis disabled or not configured`);
    return null;
  }
  
  try {
    return await queue.add(jobName, data, options);
  } catch (error) {
    console.error(`Failed to add job ${jobName} to queue ${queue.name}:`, error);
    return null;
  }
}
