import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';

// Mock environment variables
const originalEnv = process.env;

describe('Shift Swaps API', () => {
  beforeEach(() => {
    // Set up test environment
    process.env = {
      ...originalEnv,
      ACTION_SECRET: 'test_secret',
      DATABASE_URL: 'file:test.db',
    };
    
    // Reset database for each test
    try {
      execSync('pnpm prisma migrate reset --force', { cwd: 'apps/web' });
      execSync('pnpm prisma db seed', { cwd: 'apps/web' });
    } catch (error) {
      console.warn('Failed to reset database:', error);
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Create Swap Request', () => {
    it('should create a swap request successfully', async () => {
      // First, create test data
      const orgResponse = await fetch('http://localhost:3000/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Org', slug: 'test-org' }),
      });
      const orgData = await orgResponse.json();
      const orgId = orgData.org.id;

      // Create users
      const userAResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userA@test.com', 
          name: 'User A',
          role: 'ADMIN' 
        }),
      });
      const userAData = await userAResponse.json();
      const userAId = userAData.user.id;

      const userBResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userB@test.com', 
          name: 'User B',
          role: 'ADMIN' 
        }),
      });
      const userBData = await userBResponse.json();
      const userBId = userBData.user.id;

      // Create a shift for User A
      const shiftResponse = await fetch('http://localhost:3000/api/oncall/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userAId,
          startsAt: '2024-01-15T09:00:00Z',
          endsAt: '2024-01-15T17:00:00Z',
          region: 'US-East',
        }),
      });
      const shiftData = await shiftResponse.json();
      const shiftId = shiftData.shift.id;

      // Create swap request
      const swapResponse = await fetch('http://localhost:3000/api/oncall/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          shiftId,
          requestedUserId: userBId,
          reason: 'Need to attend a conference',
        }),
      });

      const swapData = await swapResponse.json();

      expect(swapResponse.status).toBe(200);
      expect(swapData.ok).toBe(true);
      expect(swapData.swap).toBeDefined();
      expect(swapData.swap.status).toBe('PENDING');
      expect(swapData.swap.requestedUserId).toBe(userBId);
      expect(swapData.swap.reason).toBe('Need to attend a conference');
    });

    it('should list swap requests', async () => {
      // Create test data (reuse setup from above)
      const orgResponse = await fetch('http://localhost:3000/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Org', slug: 'test-org' }),
      });
      const orgData = await orgResponse.json();
      const orgId = orgData.org.id;

      const userAResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userA@test.com', 
          name: 'User A',
          role: 'ADMIN' 
        }),
      });
      const userAData = await userAResponse.json();
      const userAId = userAData.user.id;

      const userBResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userB@test.com', 
          name: 'User B',
          role: 'ADMIN' 
        }),
      });
      const userBData = await userBResponse.json();
      const userBId = userBData.user.id;

      const shiftResponse = await fetch('http://localhost:3000/api/oncall/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userAId,
          startsAt: '2024-01-15T09:00:00Z',
          endsAt: '2024-01-15T17:00:00Z',
          region: 'US-East',
        }),
      });
      const shiftData = await shiftResponse.json();
      const shiftId = shiftData.shift.id;

      // Create swap request
      await fetch('http://localhost:3000/api/oncall/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          shiftId,
          requestedUserId: userBId,
          reason: 'Need to attend a conference',
        }),
      });

      // List swap requests
      const listResponse = await fetch(`http://localhost:3000/api/oncall/swaps?orgId=${orgId}&status=PENDING`);
      const listData = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(listData.ok).toBe(true);
      expect(listData.swaps).toHaveLength(1);
      expect(listData.swaps[0].status).toBe('PENDING');
      expect(listData.swaps[0].reason).toBe('Need to attend a conference');
    });
  });

  describe('Approve Swap Request', () => {
    it('should approve swap request and reassign shift when no overlap', async () => {
      // Create test data
      const orgResponse = await fetch('http://localhost:3000/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Org', slug: 'test-org' }),
      });
      const orgData = await orgResponse.json();
      const orgId = orgData.org.id;

      const userAResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userA@test.com', 
          name: 'User A',
          role: 'ADMIN' 
        }),
      });
      const userAData = await userAResponse.json();
      const userAId = userAData.user.id;

      const userBResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userB@test.com', 
          name: 'User B',
          role: 'ADMIN' 
        }),
      });
      const userBData = await userBResponse.json();
      const userBId = userBData.user.id;

      const shiftResponse = await fetch('http://localhost:3000/api/oncall/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userAId,
          startsAt: '2024-01-15T09:00:00Z',
          endsAt: '2024-01-15T17:00:00Z',
          region: 'US-East',
        }),
      });
      const shiftData = await shiftResponse.json();
      const shiftId = shiftData.shift.id;

      // Create swap request
      const swapResponse = await fetch('http://localhost:3000/api/oncall/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          shiftId,
          requestedUserId: userBId,
          reason: 'Need to attend a conference',
        }),
      });
      const swapData = await swapResponse.json();
      const swapId = swapData.swap.id;

      // Approve swap request
      const approveResponse = await fetch(`http://localhost:3000/api/oncall/swaps/${swapId}/approve`, {
        method: 'POST',
        headers: {
          'X-Action-Secret': 'test_secret',
        },
      });

      const approveData = await approveResponse.json();

      expect(approveResponse.status).toBe(200);
      expect(approveData.ok).toBe(true);
      expect(approveData.shift.userId).toBe(userBId); // Shift should be reassigned

      // Verify swap request status is updated
      const updatedSwapResponse = await fetch(`http://localhost:3000/api/oncall/swaps/${swapId}/approve`, {
        method: 'POST',
        headers: {
          'X-Action-Secret': 'test_secret',
        },
      });
      expect(updatedSwapResponse.status).toBe(409); // Should fail because status is no longer PENDING
    });

    it('should return 409 when target user has overlapping shift', async () => {
      // Create test data
      const orgResponse = await fetch('http://localhost:3000/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Org', slug: 'test-org' }),
      });
      const orgData = await orgResponse.json();
      const orgId = orgData.org.id;

      const userAResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userA@test.com', 
          name: 'User A',
          role: 'ADMIN' 
        }),
      });
      const userAData = await userAResponse.json();
      const userAId = userAData.user.id;

      const userBResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userB@test.com', 
          name: 'User B',
          role: 'ADMIN' 
        }),
      });
      const userBData = await userBResponse.json();
      const userBId = userBData.user.id;

      // Create overlapping shift for User B
      await fetch('http://localhost:3000/api/oncall/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userBId,
          startsAt: '2024-01-15T08:00:00Z',
          endsAt: '2024-01-15T18:00:00Z', // Overlaps with the shift we want to swap
          region: 'US-East',
        }),
      });

      // Create shift for User A
      const shiftResponse = await fetch('http://localhost:3000/api/oncall/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userAId,
          startsAt: '2024-01-15T09:00:00Z',
          endsAt: '2024-01-15T17:00:00Z',
          region: 'US-East',
        }),
      });
      const shiftData = await shiftResponse.json();
      const shiftId = shiftData.shift.id;

      // Create swap request
      const swapResponse = await fetch('http://localhost:3000/api/oncall/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          shiftId,
          requestedUserId: userBId,
          reason: 'Need to attend a conference',
        }),
      });
      const swapData = await swapResponse.json();
      const swapId = swapData.swap.id;

      // Try to approve swap request (should fail due to overlap)
      const approveResponse = await fetch(`http://localhost:3000/api/oncall/swaps/${swapId}/approve`, {
        method: 'POST',
        headers: {
          'X-Action-Secret': 'test_secret',
        },
      });

      const approveData = await approveResponse.json();

      expect(approveResponse.status).toBe(409);
      expect(approveData.ok).toBe(false);
      expect(approveData.error).toBe('overlap');
      expect(approveData.code).toBe('TARGET_CONFLICT');

      // Verify original shift assignment is unchanged
      const shiftCheckResponse = await fetch(`http://localhost:3000/api/oncall/rota/${shiftId}`);
      const shiftCheckData = await shiftCheckResponse.json();
      expect(shiftCheckData.shift.userId).toBe(userAId); // Should still be User A
    });

    it('should return 401 when approve request lacks X-Action-Secret header', async () => {
      // Create minimal test data
      const orgResponse = await fetch('http://localhost:3000/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Org', slug: 'test-org' }),
      });
      const orgData = await orgResponse.json();
      const orgId = orgData.org.id;

      const userAResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userA@test.com', 
          name: 'User A',
          role: 'ADMIN' 
        }),
      });
      const userAData = await userAResponse.json();
      const userAId = userAData.user.id;

      const userBResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userB@test.com', 
          name: 'User B',
          role: 'ADMIN' 
        }),
      });
      const userBData = await userBResponse.json();
      const userBId = userBData.user.id;

      const shiftResponse = await fetch('http://localhost:3000/api/oncall/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userAId,
          startsAt: '2024-01-15T09:00:00Z',
          endsAt: '2024-01-15T17:00:00Z',
          region: 'US-East',
        }),
      });
      const shiftData = await shiftResponse.json();
      const shiftId = shiftData.shift.id;

      const swapResponse = await fetch('http://localhost:3000/api/oncall/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          shiftId,
          requestedUserId: userBId,
          reason: 'Need to attend a conference',
        }),
      });
      const swapData = await swapResponse.json();
      const swapId = swapData.swap.id;

      // Try to approve without action secret
      const approveResponse = await fetch(`http://localhost:3000/api/oncall/swaps/${swapId}/approve`, {
        method: 'POST',
      });

      expect(approveResponse.status).toBe(401);
      const approveData = await approveResponse.json();
      expect(approveData.error).toContain('X-Action-Secret');
    });
  });

  describe('Decline Swap Request', () => {
    it('should decline swap request and update status', async () => {
      // Create test data
      const orgResponse = await fetch('http://localhost:3000/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Org', slug: 'test-org' }),
      });
      const orgData = await orgResponse.json();
      const orgId = orgData.org.id;

      const userAResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userA@test.com', 
          name: 'User A',
          role: 'ADMIN' 
        }),
      });
      const userAData = await userAResponse.json();
      const userAId = userAData.user.id;

      const userBResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userB@test.com', 
          name: 'User B',
          role: 'ADMIN' 
        }),
      });
      const userBData = await userBResponse.json();
      const userBId = userBData.user.id;

      const shiftResponse = await fetch('http://localhost:3000/api/oncall/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userAId,
          startsAt: '2024-01-15T09:00:00Z',
          endsAt: '2024-01-15T17:00:00Z',
          region: 'US-East',
        }),
      });
      const shiftData = await shiftResponse.json();
      const shiftId = shiftData.shift.id;

      // Create swap request
      const swapResponse = await fetch('http://localhost:3000/api/oncall/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          shiftId,
          requestedUserId: userBId,
          reason: 'Need to attend a conference',
        }),
      });
      const swapData = await swapResponse.json();
      const swapId = swapData.swap.id;

      // Decline swap request
      const declineResponse = await fetch(`http://localhost:3000/api/oncall/swaps/${swapId}/decline`, {
        method: 'POST',
        headers: {
          'X-Action-Secret': 'test_secret',
        },
      });

      const declineData = await declineResponse.json();

      expect(declineResponse.status).toBe(200);
      expect(declineData.ok).toBe(true);
      expect(declineData.swap.status).toBe('DECLINED');
      expect(declineData.swap.decidedAt).toBeDefined();
      expect(declineData.swap.decidedBy).toBe('system');

      // Verify shift assignment is unchanged
      const shiftCheckResponse = await fetch(`http://localhost:3000/api/oncall/rota/${shiftId}`);
      const shiftCheckData = await shiftCheckResponse.json();
      expect(shiftCheckData.shift.userId).toBe(userAId); // Should still be User A
    });

    it('should return 401 when decline request lacks X-Action-Secret header', async () => {
      // Create minimal test data
      const orgResponse = await fetch('http://localhost:3000/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Org', slug: 'test-org' }),
      });
      const orgData = await orgResponse.json();
      const orgId = orgData.org.id;

      const userAResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userA@test.com', 
          name: 'User A',
          role: 'ADMIN' 
        }),
      });
      const userAData = await userAResponse.json();
      const userAId = userAData.user.id;

      const userBResponse = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'userB@test.com', 
          name: 'User B',
          role: 'ADMIN' 
        }),
      });
      const userBData = await userBResponse.json();
      const userBId = userBData.user.id;

      const shiftResponse = await fetch('http://localhost:3000/api/oncall/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userAId,
          startsAt: '2024-01-15T09:00:00Z',
          endsAt: '2024-01-15T17:00:00Z',
          region: 'US-East',
        }),
      });
      const shiftData = await shiftResponse.json();
      const shiftId = shiftData.shift.id;

      const swapResponse = await fetch('http://localhost:3000/api/oncall/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          shiftId,
          requestedUserId: userBId,
          reason: 'Need to attend a conference',
        }),
      });
      const swapData = await swapResponse.json();
      const swapId = swapData.swap.id;

      // Try to decline without action secret
      const declineResponse = await fetch(`http://localhost:3000/api/oncall/swaps/${swapId}/decline`, {
        method: 'POST',
      });

      expect(declineResponse.status).toBe(401);
      const declineData = await declineResponse.json();
      expect(declineData.error).toContain('X-Action-Secret');
    });
  });
});
