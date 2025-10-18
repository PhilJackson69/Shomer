import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 RPS
    { duration: '5m', target: 25 }, // Ramp up to 25 RPS
    { duration: '3m', target: 50 }, // Ramp up to 50 RPS
    { duration: '5m', target: 50 }, // Stay at 50 RPS
    { duration: '2m', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.005'],  // Error rate under 0.5%
    errors: ['rate<0.005'],           // Custom error rate under 0.5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://staging.shomer.example.com';

// Test data
const testUsers = [
  { email: 'test1@example.com', password: 'TestPassword123!' },
  { email: 'test2@example.com', password: 'TestPassword123!' },
  { email: 'test3@example.com', password: 'TestPassword123!' },
];

// Helper function to get random user
function getRandomUser() {
  return testUsers[Math.floor(Math.random() * testUsers.length)];
}

// Helper function to make authenticated request
function makeAuthenticatedRequest(method, url, payload = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${__ENV.ACCESS_TOKEN || 'test-token'}`,
  };
  
  if (payload) {
    return http.request(method, `${BASE_URL}${url}`, JSON.stringify(payload), { headers });
  } else {
    return http.request(method, `${BASE_URL}${url}`, null, { headers });
  }
}

export default function() {
  const user = getRandomUser();
  
  // Test 1: Health Check (20% of requests)
  if (Math.random() < 0.2) {
    const response = http.get(`${BASE_URL}/api/v1/health`);
    const success = check(response, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  }
  
  // Test 2: Authentication Flow (30% of requests)
  else if (Math.random() < 0.5) {
    const loginPayload = {
      email: user.email,
      password: user.password,
    };
    
    const response = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify(loginPayload), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    const success = check(response, {
      'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'login response time < 300ms': (r) => r.timings.duration < 300,
      'login response has proper format': (r) => {
        if (r.status === 200) {
          try {
            const body = JSON.parse(r.body);
            return body.hasOwnProperty('access_token') || body.hasOwnProperty('user');
          } catch (e) {
            return false;
          }
        }
        return true;
      },
    });
    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  }
  
  // Test 3: Protected Endpoints (25% of requests)
  else if (Math.random() < 0.75) {
    const endpoints = [
      '/api/v1/auth/me',
      '/api/v1/tips',
      '/api/v1/reports',
    ];
    
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const response = makeAuthenticatedRequest('GET', endpoint);
    
    const success = check(response, {
      'protected endpoint status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'protected endpoint response time < 400ms': (r) => r.timings.duration < 400,
    });
    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  }
  
  // Test 4: Report Submission (15% of requests)
  else if (Math.random() < 0.9) {
    const reportPayload = {
      title: `Load Test Report ${Date.now()}`,
      description: 'This is a load test report submission',
      category: 'security',
    };
    
    const response = makeAuthenticatedRequest('POST', '/api/v1/reports', reportPayload);
    
    const success = check(response, {
      'report submission status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'report submission response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  }
  
  // Test 5: JWKS Endpoint (10% of requests)
  else {
    const response = http.get(`${BASE_URL}/.well-known/jwks.json`);
    
    const success = check(response, {
      'JWKS status is 200': (r) => r.status === 200,
      'JWKS response time < 200ms': (r) => r.timings.duration < 200,
      'JWKS has valid structure': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.hasOwnProperty('keys') && Array.isArray(body.keys);
        } catch (e) {
          return false;
        }
      },
    });
    errorRate.add(!success);
    responseTime.add(response.timings.duration);
  }
  
  sleep(Math.random() * 2 + 0.5); // Random sleep between 0.5-2.5 seconds
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-summary.txt': generateSummary(data),
  };
}

function generateSummary(data) {
  const summary = [];
  summary.push('=== Load Test Summary ===');
  summary.push(`Test Duration: ${data.state.testRunDurationMs / 1000}s`);
  summary.push(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  summary.push(`Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s`);
  summary.push(`Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  summary.push(`P95 Response Time: ${data.metrics.http_req_duration.values.p95.toFixed(2)}ms`);
  summary.push(`P99 Response Time: ${data.metrics.http_req_duration.values.p99.toFixed(2)}ms`);
  summary.push('');
  summary.push('=== Thresholds ===');
  summary.push(`P95 < 500ms: ${data.metrics.http_req_duration.values.p95 < 500 ? 'PASS' : 'FAIL'}`);
  summary.push(`Error Rate < 0.5%: ${data.metrics.http_req_failed.values.rate < 0.005 ? 'PASS' : 'FAIL'}`);
  summary.push('');
  summary.push('=== Recommendations ===');
  
  if (data.metrics.http_req_duration.values.p95 > 500) {
    summary.push('- P95 response time exceeds 500ms threshold');
    summary.push('- Consider optimizing slow endpoints');
  }
  
  if (data.metrics.http_req_failed.values.rate > 0.005) {
    summary.push('- Error rate exceeds 0.5% threshold');
    summary.push('- Investigate failing requests');
  }
  
  if (data.metrics.http_reqs.values.rate < 10) {
    summary.push('- Request rate lower than expected');
    summary.push('- Check for bottlenecks or rate limiting');
  }
  
  return summary.join('\n');
}
