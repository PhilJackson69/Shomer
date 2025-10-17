#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files to migrate (priority order)
const priorityFiles = [
  'apps/web/src/lib/auth.ts',
  'apps/web/src/app/tip/page.tsx',
  'apps/web/src/lib/client/csrf.ts',
  'apps/web/src/lib/client/errors.ts',
  'apps/web/src/components/api-keys-manager.tsx',
  'apps/web/src/components/AlertTagManager.tsx',
  'apps/web/src/app/dashboard/settings/keys.tsx',
  'apps/web/src/app/dashboard/settings/webhooks.tsx',
  'apps/web/src/app/dashboard/settings/webhook-deliveries.tsx',
  'apps/web/src/app/dashboard/incidents/widgets/IncidentActions.tsx',
  'apps/web/src/app/dashboard/threat-signals/SignalActions.tsx',
  'apps/web/src/app/api/notifications/deliver/route.ts',
  'apps/web/src/app/api/collect/rss/route.ts'
];

function migrateFile(filePath) {
  console.log(`\n🔄 Migrating ${filePath}...`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if apiFetch import already exists
    const hasApiFetchImport = content.includes('import { apiFetch } from "@/lib/api-client"');
    
    // Replace fetch with apiFetch for non-GET requests
    // Pattern: fetch(url, { method: 'POST/PUT/PATCH/DELETE', ... })
    const writeMethodPattern = /fetch\(([^,]+),\s*{\s*method:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/g;
    
    let newContent = content.replace(writeMethodPattern, (match, url, method) => {
      modified = true;
      console.log(`  ✓ Replacing fetch with apiFetch for ${method} request`);
      return `apiFetch(${url}, { method: '${method}'`;
    });
    
    // Add import if we made changes and import doesn't exist
    if (modified && !hasApiFetchImport) {
      // Find the best place to insert the import
      const importMatch = newContent.match(/^import\s+.*?from\s+['"`].*?['"`];?\s*$/m);
      if (importMatch) {
        const insertAfter = importMatch.index + importMatch[0].length;
        newContent = newContent.slice(0, insertAfter) + 
                    '\nimport { apiFetch } from "@/lib/api-client";' + 
                    newContent.slice(insertAfter);
      } else {
        // Insert at the top
        newContent = 'import { apiFetch } from "@/lib/api-client";\n' + newContent;
      }
      console.log(`  ✓ Added apiFetch import`);
    }
    
    // Add credentials: 'include' for write requests that don't have it
    const writeRequestPattern = /apiFetch\([^,]+,\s*{\s*(method:\s*['"`](POST|PUT|PATCH|DELETE)['"`][^}]*?)(?:\s*})\s*\)/g;
    newContent = newContent.replace(writeRequestPattern, (match, options) => {
      if (!options.includes('credentials')) {
        modified = true;
        console.log(`  ✓ Added credentials: 'include'`);
        return match.replace(options, options + ', credentials: "include"');
      }
      return match;
    });
    
    if (modified) {
      fs.writeFileSync(filePath, newContent);
      console.log(`  ✅ Successfully migrated ${filePath}`);
      return true;
    } else {
      console.log(`  ⏭️  No changes needed for ${filePath}`);
      return false;
    }
    
  } catch (error) {
    console.error(`  ❌ Error migrating ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Starting fetch to apiFetch migration...\n');
  
  let migratedCount = 0;
  
  for (const file of priorityFiles) {
    if (fs.existsSync(file)) {
      if (migrateFile(file)) {
        migratedCount++;
      }
    } else {
      console.log(`⚠️  File not found: ${file}`);
    }
  }
  
  console.log(`\n🎉 Migration complete! Migrated ${migratedCount} files.`);
  
  // Run ESLint to check remaining issues
  console.log('\n🔍 Running ESLint to check remaining fetch usage...');
  try {
    execSync('npx eslint src --ext .ts,.tsx --format=compact | grep "fetch" | wc -l', 
             { cwd: 'apps/web', stdio: 'inherit' });
  } catch (error) {
    console.log('ESLint check completed with warnings.');
  }
}

if (require.main === module) {
  main();
}

module.exports = { migrateFile };
