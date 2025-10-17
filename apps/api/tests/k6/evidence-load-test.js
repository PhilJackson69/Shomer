/**
 * k6 Load Test for Evidence Upload & Export
 * 
 * Tests the critical evidence flow:
 * 1. Upload evidence file
 * 2. Verify evidence integrity
 * 3. Export chain-of-custody PDF
 * 
 * Usage:
 *   # Smoke test (1 VU, 1 iteration)
 *   k6 run -e JWT=$TOKEN -e API=http://localhost:8000 evidence-load-test.js
 * 
 *   # Load test (10 VUs, 1 minute)
 *   k6 run -e JWT=$TOKEN -e API=http://localhost:8000 --vus 10 --duration 1m evidence-load-test.js
 * 
 *   # Stress test (50 VUs, ramping)
 *   k6 run -e JWT=$TOKEN -e API=http://localhost:8000 --stage 30s:10 --stage 1m:50 --stage 30s:0 evidence-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const uploadErrorRate = new Rate('upload_errors');
const verifyErrorRate = new Rate('verify_errors');
const exportErrorRate = new Rate('export_errors');
const uploadDuration = new Trend('upload_duration');
const exportDuration = new Trend('export_duration');

// Configuration
const TOKEN = __ENV.JWT;
const API_URL = __ENV.API || 'http://localhost:8000';

if (!TOKEN) {
  throw new Error('JWT token required: k6 run -e JWT=$TOKEN ...');
}

// Test options
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 users
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'],  // 95% of requests under 2s
    'upload_errors': ['rate<0.05'],        // Upload error rate < 5%
    'verify_errors': ['rate<0.01'],        // Verify error rate < 1%
    'export_errors': ['rate<0.05'],        // Export error rate < 5%
    'upload_duration': ['p(95)<3000'],     // 95% of uploads under 3s
    'export_duration': ['p(95)<5000'],     // 95% of exports under 5s
  },
};

// Helper to generate random test file content
function generateTestFile() {
  const timestamp = Date.now();
  const content = `Test evidence file generated at ${timestamp}\n`.repeat(100);
  return {
    filename: `test_evidence_${timestamp}.txt`,
    content: content,
  };
}

export default function () {
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
  };

  // ============================================================================
  // 1. UPLOAD EVIDENCE
  // ============================================================================
  const testFile = generateTestFile();
  const uploadPayload = {
    file: http.file(testFile.content, testFile.filename, 'text/plain'),
    evidence_type: 'document',
    description: `k6 load test - ${__VU}-${__ITER}`,
    submitted_at: new Date().toISOString(),
  };

  const uploadStart = Date.now();
  const uploadResponse = http.post(
    `${API_URL}/api/v1/evidence/upload`,
    uploadPayload,
    { headers }
  );
  uploadDuration.add(Date.now() - uploadStart);

  const uploadSuccess = check(uploadResponse, {
    'upload status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'upload returns evidence ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      } catch {
        return false;
      }
    },
  });

  uploadErrorRate.add(!uploadSuccess);

  if (!uploadSuccess) {
    console.error(`Upload failed: ${uploadResponse.status} - ${uploadResponse.body}`);
    sleep(1);
    return;
  }

  const evidenceId = JSON.parse(uploadResponse.body).id;
  console.log(`✓ Uploaded evidence ${evidenceId}`);

  sleep(1); // Brief pause between operations

  // ============================================================================
  // 2. VERIFY EVIDENCE INTEGRITY
  // ============================================================================
  const verifyResponse = http.post(
    `${API_URL}/api/v1/evidence/${evidenceId}/verify`,
    null,
    { headers }
  );

  const verifySuccess = check(verifyResponse, {
    'verify status is 200': (r) => r.status === 200,
    'verify hash matches': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.hash_match === true;
      } catch {
        return false;
      }
    },
  });

  verifyErrorRate.add(!verifySuccess);

  if (!verifySuccess) {
    console.error(`Verify failed: ${verifyResponse.status} - ${verifyResponse.body}`);
  } else {
    console.log(`✓ Verified evidence ${evidenceId}`);
  }

  sleep(1);

  // ============================================================================
  // 3. EXPORT CHAIN-OF-CUSTODY PDF
  // ============================================================================
  const exportStart = Date.now();
  const exportResponse = http.get(
    `${API_URL}/api/v1/evidence/${evidenceId}/export-chain-of-custody`,
    { headers }
  );
  exportDuration.add(Date.now() - exportStart);

  const exportSuccess = check(exportResponse, {
    'export status is 200': (r) => r.status === 200,
    'export returns PDF': (r) => {
      const contentType = r.headers['Content-Type'] || '';
      return contentType.includes('pdf') || contentType.includes('application/pdf');
    },
    'export PDF not empty': (r) => r.body && r.body.length > 0,
  });

  exportErrorRate.add(!exportSuccess);

  if (!exportSuccess) {
    console.error(`Export failed: ${exportResponse.status}`);
  } else {
    console.log(`✓ Exported PDF for evidence ${evidenceId} (${exportResponse.body.length} bytes)`);
  }

  sleep(2); // Cooldown between iterations
}

// Teardown function (optional)
export function teardown(data) {
  console.log('Load test completed');
}

