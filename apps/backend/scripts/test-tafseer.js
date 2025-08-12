#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000';

async function testTafseer() {
  try {
    console.log('🧪 Testing Tafseer API...\n');

    // Step 1: Register a test user
    console.log('1. Registering test user...');
    const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      })
    });

    if (!registerResponse.ok) {
      const error = await registerResponse.text();
      console.log('User might already exist, trying login...');
    }

    // Step 2: Login to get token
    console.log('2. Logging in...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.statusText}`);
    }

    const { token } = await loginResponse.json();
    console.log('✅ Login successful\n');

    // Step 3: Get user profile to check quota
    console.log('3. Checking user profile...');
    const profileResponse = await fetch(`${BASE_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log(`✅ User profile: ${profile.name} (${profile.email})`);
      console.log(`   Daily quota: ${profile.dailyQuota}`);
      console.log(`   Quota reset: ${profile.quotaResetAt}\n`);
    }

    // Step 4: Get available filters
    console.log('4. Getting available filters...');
    const filtersResponse = await fetch(`${BASE_URL}/filters`);
    if (filtersResponse.ok) {
      const filters = await filtersResponse.json();
      console.log(`✅ Found ${filters.scholars.length} scholars`);
      console.log(`   Centuries: ${filters.filterOptions.centuries.join(', ')}`);
      console.log(`   Madhabs: ${filters.filterOptions.madhabs.join(', ')}\n`);
    }

    // Step 5: Test tafseer request (non-streaming)
    console.log('5. Testing tafseer request (non-streaming)...');
    const tafseerResponse = await fetch(`${BASE_URL}/tafseer`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        verseId: 'verse-1-1', // Al-Fatiha verse 1
        filters: {
          tone: 7,
          intellectLevel: 8,
          language: 'English'
        },
        stream: false
      })
    });

    if (tafseerResponse.ok) {
      const result = await tafseerResponse.json();
      console.log('✅ Tafseer request successful!');
      console.log(`   Verse: ${result.verse.surahName}:${result.verse.verseNumber}`);
      console.log(`   Arabic: ${result.verse.arabicText}`);
      console.log(`   AI Response length: ${result.aiResponse.length} characters`);
      console.log(`   Search ID: ${result.searchId}`);
      if (result.usage) {
        console.log(`   Tokens used: ${result.usage.totalTokens}`);
      }
    } else {
      const error = await tafseerResponse.text();
      console.log(`❌ Tafseer request failed: ${error}`);
    }

    // Step 6: Test tafseer request (streaming)
    console.log('\n6. Testing tafseer request (streaming)...');
    const streamResponse = await fetch(`${BASE_URL}/tafseer`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        verseId: 'verse-2-255', // Ayat al-Kursi
        filters: {
          tone: 5,
          intellectLevel: 9,
          language: 'English'
        },
        stream: true
      })
    });

    if (streamResponse.ok) {
      console.log('✅ Streaming tafseer request initiated!');
      let fullContent = '';
      
      try {
        // Handle the streaming response in Node.js
        let responseText = '';
        
        for await (const chunk of streamResponse.body) {
          responseText += chunk.toString();
        }
        
        // Process the SSE events
        const lines = responseText.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'start') {
                console.log(`   Stream started with search ID: ${data.searchId}`);
              } else if (data.type === 'chunk') {
                fullContent += data.content;
                process.stdout.write('.');
              } else if (data.type === 'complete') {
                console.log(`\n   Stream completed! Final length: ${fullContent.length} characters`);
                if (data.usage) {
                  console.log(`   Tokens used: ${data.usage.totalTokens}`);
                }
              } else if (data.type === 'error') {
                console.log(`\n   Stream error: ${data.error}`);
              }
            } catch (parseError) {
              // Skip malformed JSON lines
            }
          }
        }
      } catch (streamError) {
        console.log(`\n❌ Stream processing error: ${streamError.message}`);
      }
    } else {
      const error = await streamResponse.text();
      console.log(`❌ Streaming tafseer request failed: ${error}`);
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testTafseer(); 