/**
 * Test script to verify Gemini API key and endpoint
 * Usage: GEMINI_API_KEY=your_key node scripts/test-gemini-api.js
 */

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY is not set')
  console.log('Usage: GEMINI_API_KEY=your_key node scripts/test-gemini-api.js')
  process.exit(1)
}

console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...')

async function testGeminiAPI() {
  console.log('\n📡 Testing Gemini API...\n')

  const testPrompt = 'Say "Hello World" in Vietnamese'

  // Test 1: Using header with Gemini 2.5 Flash (recommended)
  console.log('Test 1: Using x-goog-api-key header with gemini-2.5-flash')
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: testPrompt,
                },
              ],
            },
          ],
        }),
      }
    )

    console.log('Status:', response.status, response.statusText)

    if (response.ok) {
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      console.log('✅ Success! Response:', text)
    } else {
      const errorText = await response.text()
      console.error('❌ Error:', errorText)
    }
  } catch (error) {
    console.error('❌ Exception:', error.message)
  }

  console.log('\n---\n')

  // Test 2: Using query parameter (alternative)
  console.log('Test 2: Using query parameter with gemini-2.5-flash')
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: testPrompt,
                },
              ],
            },
          ],
        }),
      }
    )

    console.log('Status:', response.status, response.statusText)

    if (response.ok) {
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      console.log('✅ Success! Response:', text)
    } else {
      const errorText = await response.text()
      console.error('❌ Error:', errorText)
    }
  } catch (error) {
    console.error('❌ Exception:', error.message)
  }

  console.log('\n---\n')

  // Test 3: List available models
  console.log('Test 3: List available Gemini models')
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models',
      {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
        },
      }
    )

    console.log('Status:', response.status, response.statusText)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Available models:')
      data.models?.slice(0, 10).forEach(model => {
        console.log(`  - ${model.name}`)
      })
    } else {
      const errorText = await response.text()
      console.error('❌ Error:', errorText)
    }
  } catch (error) {
    console.error('❌ Exception:', error.message)
  }

  console.log('\n---\n')
  console.log('NOTE: Gemini 1.5 models (gemini-1.5-flash, gemini-1.5-pro) were retired in April 2025.')
  console.log('Currently using gemini-2.5-flash for enhanced performance and accuracy.')
}

testGeminiAPI().catch(console.error)
