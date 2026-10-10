// test-api.js
// Run this with: node test-api.js
// Tests your API endpoints to diagnose issues

const BASE_URL = process.argv[2] || 'http://localhost:3000';

console.log('🧪 Testing API Endpoints');
console.log('Base URL:', BASE_URL);
console.log('═══════════════════════════════════════\n');

async function testEndpoint(name, url, options = {}) {
  console.log(`\n📍 Testing: ${name}`);
  console.log(`URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const duration = Date.now() - startTime;
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${duration}ms`);
    
    const contentType = response.headers.get('content-type');
    console.log(`Content-Type: ${contentType}`);
    
    let data;
    if (contentType?.includes('application/json')) {
      data = await response.json();
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      data = await response.text();
      console.log('Response (text):', data);
    }
    
    if (response.ok) {
      console.log('✅ PASS');
    } else {
      console.log('❌ FAIL');
    }
    
    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.log('💥 ERROR:', error.message);
    console.log('❌ FAIL');
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('Starting tests...\n');
  
  // Test 1: Test endpoint (should work)
  await testEndpoint(
    'Test Endpoint (GET)',
    `${BASE_URL}/api/test`
  );
  
  console.log('\n─────────────────────────────────────────');
  
  // Test 2: Approve with missing paymentId (should return 400)
  await testEndpoint(
    'Approve - Missing paymentId (should fail with 400)',
    `${BASE_URL}/api/pi/approve`,
    {
      method: 'POST',
      body: JSON.stringify({})
    }
  );
  
  console.log('\n─────────────────────────────────────────');
  
  // Test 3: Approve with test paymentId (will fail at Pi API but should reach it)
  await testEndpoint(
    'Approve - Test Payment ID',
    `${BASE_URL}/api/pi/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ paymentId: 'test_payment_12345' })
    }
  );
  
  console.log('\n─────────────────────────────────────────');
  
  // Test 4: Complete with test data
  await testEndpoint(
    'Complete - Test Data',
    `${BASE_URL}/api/pi/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ 
        paymentId: 'test_payment_12345',
        txid: 'test_txid_67890'
      })
    }
  );
  
  console.log('\n═══════════════════════════════════════');
  console.log('🏁 Tests Complete\n');
  
  console.log('📋 Diagnosis:');
  console.log('1. If "Test Endpoint" passes → API is deployed correctly');
  console.log('2. If "Approve - Missing paymentId" returns 400 → Validation works');
  console.log('3. If "Approve - Test Payment ID" returns 4xx/5xx from Pi → Backend works');
  console.log('4. If any return 404 → Routing problem (check vercel.json)');
  console.log('5. If any timeout → Function size or cold start issue');
}

// Run all tests
runTests().catch(console.error);