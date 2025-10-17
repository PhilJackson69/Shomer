#!/usr/bin/env tsx

import "../src/lib/threat-detection/worker-manager";

console.log("Starting Threat Detection Workers...");
console.log("Press Ctrl+C to stop all workers");

// Keep the process alive
setInterval(() => {
  // Heartbeat to keep process alive
}, 1000);
