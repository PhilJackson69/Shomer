#!/usr/bin/env node

/**
 * Script to generate TypeScript client from FastAPI OpenAPI schema
 * Run this script after starting the API server:
 * node scripts/generate-client.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const OPENAPI_URL = process.env.OPENAPI_URL || 'http://localhost:8000/api/v1/openapi.json';
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'generated');

console.log('Generating TypeScript client from OpenAPI schema...');
console.log(`OpenAPI URL: ${OPENAPI_URL}`);
console.log(`Output directory: ${OUTPUT_DIR}`);

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate TypeScript types
const command = `npx openapi-typescript ${OPENAPI_URL} --output ${path.join(OUTPUT_DIR, 'schema.ts')}`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('Error generating client:', error);
    console.error(stderr);
    console.log('\nNote: Make sure the API server is running at', OPENAPI_URL);
    process.exit(1);
  }

  console.log(stdout);
  console.log('✓ TypeScript client generated successfully!');
});

