import { globby } from "globby";
import fs from "node:fs/promises";

/**
 * Unit test to ensure no raw fetch() calls remain in app code
 * This provides a fast, AST-based check that runs in CI
 */
it("has no raw fetch() calls in app code", async () => {
  const files = await globby([
    "apps/web/src/**/*.{ts,tsx}", 
    "!**/lib/api-client.ts", 
    "!**/lib/external-fetch.ts",
    "!**/lib/dev-guard.ts"
  ]);
  
  const offenders: string[] = [];
  
  for (const file of files) {
    const src = await fs.readFile(file, "utf8");
    if (/\bfetch\(/.test(src)) {
      offenders.push(file);
    }
  }
  
  if (offenders.length > 0) {
    console.error("❌ Raw fetch() calls found in:");
    offenders.forEach(file => console.error(`  - ${file}`));
    console.error("\nMigrate to apiFetch or use externalFetch for external APIs.");
  }
  
  expect(offenders).toEqual([]);
});
