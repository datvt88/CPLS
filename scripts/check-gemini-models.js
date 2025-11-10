/**
 * Check which Gemini models are actually available
 */

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY is not set')
  process.exit(1)
}

const modelsToTest = [
  'gemini-2.5-flash-live',
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash-thinking-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
]

async function testModel(modelName) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Hi' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
          },
        }),
      }
    )

    if (response.ok) {
      return { model: modelName, status: '✅ WORKS', code: response.status }
    } else {
      const error = await response.text()
      return { model: modelName, status: '❌ FAILED', code: response.status, error: error.substring(0, 100) }
    }
  } catch (error) {
    return { model: modelName, status: '❌ ERROR', error: error.message }
  }
}

async function listAvailableModels() {
  console.log('📋 Listing available models from API...\n')
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey,
      {
        method: 'GET',
      }
    )

    if (response.ok) {
      const data = await response.json()
      const generateContentModels = data.models?.filter(m =>
        m.supportedGenerationMethods?.includes('generateContent')
      )

      console.log(`Found ${generateContentModels?.length || 0} models that support generateContent:\n`)
      generateContentModels?.forEach(model => {
        console.log(`  ✓ ${model.name.replace('models/', '')}`)
      })
      console.log('\n' + '='.repeat(60) + '\n')
    } else {
      console.log('❌ Failed to list models:', response.status)
      console.log('\n' + '='.repeat(60) + '\n')
    }
  } catch (error) {
    console.log('❌ Error listing models:', error.message)
    console.log('\n' + '='.repeat(60) + '\n')
  }
}

async function main() {
  console.log('🔍 Checking Gemini model availability...\n')

  // First, list all available models
  await listAvailableModels()

  // Then test specific models
  console.log('🧪 Testing specific models:\n')

  for (const modelName of modelsToTest) {
    const result = await testModel(modelName)
    console.log(`${result.status} ${result.model} (HTTP ${result.code || 'N/A'})`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('💡 Use the model names that show ✅ WORKS in your code')
}

main().catch(console.error)
