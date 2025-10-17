// Simple test script to verify shift swap API endpoints
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const ACTION_SECRET = 'example_16chars_or_more';

async function testShiftSwaps() {
  console.log('🧪 Testing Shift Swap API endpoints...\n');

  try {
    // 1. Create test organization
    console.log('1. Creating test organization...');
    const orgResponse = await fetch(`${BASE_URL}/api/orgs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Org', slug: 'test-org' }),
    });
    const orgData = await orgResponse.json();
    const orgId = orgData.org.id;
    console.log(`✅ Organization created: ${orgId}\n`);

    // 2. Create test users
    console.log('2. Creating test users...');
    const userAResponse = await fetch(`${BASE_URL}/api/users`, {
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

    const userBResponse = await fetch(`${BASE_URL}/api/users`, {
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
    console.log(`✅ Users created: ${userAId}, ${userBId}\n`);

    // 3. Create a shift for User A
    console.log('3. Creating test shift...');
    const shiftResponse = await fetch(`${BASE_URL}/api/oncall/rota`, {
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
    console.log(`✅ Shift created: ${shiftId}\n`);

    // 4. Create swap request
    console.log('4. Creating swap request...');
    const swapResponse = await fetch(`${BASE_URL}/api/oncall/swaps`, {
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
    console.log(`✅ Swap request created: ${swapId}`);
    console.log(`   Status: ${swapData.swap.status}`);
    console.log(`   Reason: ${swapData.swap.reason}\n`);

    // 5. List swap requests
    console.log('5. Listing swap requests...');
    const listResponse = await fetch(`${BASE_URL}/api/oncall/swaps?orgId=${orgId}&status=PENDING`);
    const listData = await listResponse.json();
    console.log(`✅ Found ${listData.swaps.length} pending swap requests\n`);

    // 6. Approve swap request
    console.log('6. Approving swap request...');
    const approveResponse = await fetch(`${BASE_URL}/api/oncall/swaps/${swapId}/approve`, {
      method: 'POST',
      headers: { 'X-Action-Secret': ACTION_SECRET },
    });
    const approveData = await approveResponse.json();
    
    if (approveResponse.ok) {
      console.log(`✅ Swap request approved successfully`);
      console.log(`   Shift reassigned to: ${approveData.shift.userId}`);
    } else {
      console.log(`❌ Approval failed: ${approveData.error}`);
      if (approveData.code === 'TARGET_CONFLICT') {
        console.log(`   Reason: Target user has overlapping shift`);
      }
    }

    // 7. Test decline (create another swap request first)
    console.log('\n7. Testing decline functionality...');
    const swap2Response = await fetch(`${BASE_URL}/api/oncall/swaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        shiftId,
        requestedUserId: userBId,
        reason: 'Test decline',
      }),
    });
    const swap2Data = await swap2Response.json();
    const swap2Id = swap2Data.swap.id;

    const declineResponse = await fetch(`${BASE_URL}/api/oncall/swaps/${swap2Id}/decline`, {
      method: 'POST',
      headers: { 'X-Action-Secret': ACTION_SECRET },
    });
    const declineData = await declineResponse.json();
    
    if (declineResponse.ok) {
      console.log(`✅ Swap request declined successfully`);
      console.log(`   Status: ${declineData.swap.status}`);
    } else {
      console.log(`❌ Decline failed: ${declineData.error}`);
    }

    // 8. Test authentication (approve without secret)
    console.log('\n8. Testing authentication...');
    const authTestResponse = await fetch(`${BASE_URL}/api/oncall/swaps/${swapId}/approve`, {
      method: 'POST',
      // No X-Action-Secret header
    });
    const authTestData = await authTestResponse.json();
    
    if (authTestResponse.status === 401) {
      console.log(`✅ Authentication working: ${authTestData.error}`);
    } else {
      console.log(`❌ Authentication failed: Expected 401, got ${authTestResponse.status}`);
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the tests
testShiftSwaps();
