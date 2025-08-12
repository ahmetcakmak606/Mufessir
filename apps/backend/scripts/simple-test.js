#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000';

async function simpleTest() {
  try {
    console.log('🧪 Simple API Test...\n');

    // Test 1: Health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Health check:', health);
    } else {
      console.log('❌ Health check failed');
    }

    // Test 2: Filters endpoint
    console.log('\n2. Testing filters endpoint...');
    const filtersResponse = await fetch(`${BASE_URL}/filters`);
    if (filtersResponse.ok) {
      const filters = await filtersResponse.json();
      console.log('✅ Filters endpoint working');
      console.log(`   Scholars: ${filters.scholars.length}`);
      console.log(`   Centuries: ${filters.filterOptions.centuries.length}`);
    } else {
      console.log('❌ Filters endpoint failed');
    }

    // Test 3: Create a test user
    console.log('\n3. Testing user registration...');
    const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test2@example.com',
        password: 'password123',
        name: 'Test User 2'
      })
    });

    if (registerResponse.ok) {
      const result = await registerResponse.json();
      console.log('✅ User registered successfully');
      console.log('   Token received:', result.token ? 'Yes' : 'No');
      
      // Test 4: Use the token to test protected endpoints
      if (result.token) {
        console.log('\n4. Testing protected endpoints...');
        
        // Test user profile
        const profileResponse = await fetch(`${BASE_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${result.token}` }
        });
        
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          console.log('✅ Profile endpoint working');
          console.log(`   User: ${profile.name} (${profile.email})`);
          console.log(`   Quota: ${profile.dailyQuota}`);
        } else {
          console.log('❌ Profile endpoint failed');
        }
      }
    } else {
      const error = await registerResponse.text();
      console.log('❌ Registration failed:', error);
    }

    console.log('\n🎉 Simple test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
simpleTest(); 