#!/usr/bin/env node
/**
 * Migration script to replace raw fetch() calls with apiFetch
 * 
 * This script systematically replaces fetch() calls with apiFetch imports
 * while preserving the existing functionality.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to exclude from migration
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/api-client.ts',
  '**/external-fetch.ts', 
  '**/apiFetch.ts',
  '**/dev-guard.ts',
  '**/auth.ts', // Server-side fetch should remain
  '**/__tests__/**',
  '**/tests/**'
];

// Files that need external fetch (webhooks, third-party APIs)
const EXTERNAL_FETCH_FILES = [
  '**/alert.worker.ts',
  '**/webhooks.ts'
];

function shouldExcludeFile(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => 
    filePath.includes(pattern.replace('**/', '').replace('/**', ''))
  );
}

function shouldUseExternalFetch(filePath) {
  return EXTERNAL_FETCH_FILES.some(pattern => 
    filePath.includes(pattern.replace('**/', '').replace('/**', ''))
  );
}

function migrateFile(filePath) {
  console.log(`Migrating: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file already imports apiFetch or externalFetch
  const hasApiFetchImport = content.includes("from '@/lib/apiFetch'") || 
                           content.includes('from "./apiFetch"') ||
                           content.includes('from "../apiFetch"');
  const hasExternalFetchImport = content.includes("from '@/lib/external-fetch'") ||
                                 content.includes('from "./external-fetch"') ||
                                 content.includes('from "../external-fetch"');
  
  // Add appropriate import if not present
  if (!hasApiFetchImport && !hasExternalFetchImport) {
    const importStatement = shouldUseExternalFetch(filePath) 
      ? "import { externalFetch as fetch } from '@/lib/external-fetch';\n"
      : "import { apiFetch } from '@/lib/apiFetch';\n";
    
    // Find the best place to add the import
    const lines = content.split('\n');
    let insertIndex = 0;
    
    // Find the last import statement
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ') || lines[i].startsWith('import{')) {
        insertIndex = i + 1;
      }
    }
    
    lines.splice(insertIndex, 0, importStatement);
    content = lines.join('\n');
    modified = true;
  }
  
  // Replace fetch() calls
  if (shouldUseExternalFetch(filePath)) {
    // For external fetch files, replace with externalFetch
    if (content.includes('fetch(') && !content.includes('externalFetch(')) {
      content = content.replace(/\bfetch\(/g, 'externalFetch(');
      modified = true;
    }
  } else {
    // For internal API files, replace with apiFetch
    if (content.includes('fetch(') && !content.includes('apiFetch(')) {
      content = content.replace(/\bfetch\(/g, 'apiFetch(');
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Migrated: ${filePath}`);
  } else {
    console.log(`⏭️  No changes needed: ${filePath}`);
  }
}

function main() {
  console.log('🚀 Starting fetch() to apiFetch migration...\n');
  
  // Find all TypeScript/JavaScript files in src
  const files = glob.sync('apps/web/src/**/*.{ts,tsx,js,jsx}', {
    ignore: EXCLUDE_PATTERNS
  });
  
  console.log(`Found ${files.length} files to process\n`);
  
  let migratedCount = 0;
  
  files.forEach(file => {
    if (!shouldExcludeFile(file)) {
      try {
        migrateFile(file);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Error migrating ${file}:`, error.message);
      }
    }
  });
  
  console.log(`\n🎉 Migration complete! Migrated ${migratedCount} files.`);
  console.log('\nNext steps:');
  console.log('1. Run: pnpm -w lint');
  console.log('2. Run: pnpm -w test');
  console.log('3. Run: bash scripts/check-no-raw-fetch.sh');
}

if (require.main === module) {
  main();
}

module.exports = { migrateFile, shouldExcludeFile, shouldUseExternalFetch };
