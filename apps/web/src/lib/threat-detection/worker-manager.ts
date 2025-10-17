import { areQueuesAvailable } from "./queues";

// Import all workers
import "./workers/normalize.worker";
import "./workers/enrich.worker";
import "./workers/score.worker";
import "./workers/alert.worker";

export function startAllWorkers() {
  if (!areQueuesAvailable()) {
    console.log("[Worker Manager] Redis not available - workers will not start");
    return;
  }

  console.log("[Worker Manager] Starting all threat detection workers...");
  console.log("[Worker Manager] Workers started successfully");
  console.log("[Worker Manager] Available workers:");
  console.log("  - Normalize Worker (raw_ingest queue)");
  console.log("  - Enrich Worker (enrich queue)");
  console.log("  - Score Worker (score queue)");
  console.log("  - Alert Worker (alert queue)");
}

export function stopAllWorkers() {
  console.log("[Worker Manager] Stopping all workers...");
  // Workers will handle their own shutdown via SIGTERM/SIGINT handlers
  process.exit(0);
}

// Auto-start workers when this module is imported
if (require.main === module) {
  startAllWorkers();
  
  // Keep the process alive
  process.on('SIGTERM', stopAllWorkers);
  process.on('SIGINT', stopAllWorkers);
}
