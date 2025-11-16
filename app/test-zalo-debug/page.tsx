'use client'

import { useState } from 'react'

export default function ZaloDebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [accessToken, setAccessToken] = useState('')
  const [testResults, setTestResults] = useState<any>(null)

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const testUserInfoAPI = async () => {
    addLog('🔍 Testing /api/auth/zalo/user...')

    if (!accessToken) {
      addLog('❌ Please enter access token first')
      return
    }

    try {
      const response = await fetch('/api/auth/zalo/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken }),
      })

      const data = await response.json()

      if (response.ok) {
        addLog('✅ User info retrieved successfully!')
        addLog(`User: ${JSON.stringify(data, null, 2)}`)
        setTestResults({ success: true, data })
      } else {
        addLog(`❌ Failed: ${response.status}`)
        addLog(`Error: ${JSON.stringify(data, null, 2)}`)
        setTestResults({ success: false, error: data })
      }
    } catch (error) {
      addLog(`💥 Exception: ${error}`)
      setTestResults({ success: false, error: String(error) })
    }
  }

  const testZaloAPI = async () => {
    addLog('🔍 Testing Zalo Graph API directly...')

    if (!accessToken) {
      addLog('❌ Please enter access token first')
      return
    }

    try {
      const response = await fetch(
        `https://graph.zalo.me/v2.0/me?fields=id,name,birthday,gender,picture&access_token=${accessToken}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      )

      const data = await response.json()

      if (response.ok && !data.error) {
        addLog('✅ Zalo API responded successfully!')
        addLog(`User: ${JSON.stringify(data, null, 2)}`)
      } else {
        addLog(`❌ Zalo API error: ${JSON.stringify(data, null, 2)}`)
      }
    } catch (error) {
      addLog(`💥 Exception: ${error}`)
    }
  }

  const checkEnvironment = () => {
    addLog('🔍 Checking environment variables...')

    const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    addLog(`NEXT_PUBLIC_ZALO_APP_ID: ${appId ? '✅ Set' : '❌ Missing'}`)
    addLog(`NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`)
    addLog(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseKey ? '✅ Set' : '❌ Missing'}`)

    if (appId) addLog(`App ID: ${appId}`)
    if (supabaseUrl) addLog(`Supabase URL: ${supabaseUrl}`)
  }

  const checkSessionStorage = () => {
    addLog('🔍 Checking sessionStorage...')

    const state = sessionStorage.getItem('zalo_oauth_state')
    const verifier = sessionStorage.getItem('zalo_code_verifier')

    addLog(`zalo_oauth_state: ${state ? `✅ ${state}` : '❌ Not found'}`)
    addLog(`zalo_code_verifier: ${verifier ? `✅ ${verifier.substring(0, 20)}...` : '❌ Not found'}`)
  }

  const clearLogs = () => {
    setLogs([])
    setTestResults(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Zalo OAuth Debug Tool</h1>
        <p className="text-gray-600 mb-8">
          Use this page to debug Zalo OAuth issues
        </p>

        {/* Environment Check */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
          <button
            onClick={checkEnvironment}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Check Environment Variables
          </button>
        </div>

        {/* Session Storage Check */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Session Storage Check</h2>
          <button
            onClick={checkSessionStorage}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Check Session Storage
          </button>
        </div>

        {/* API Tests */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">API Tests</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Access Token (from /api/auth/zalo/token response):
            </label>
            <input
              type="text"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste access_token here"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Get this from browser Network tab → /api/auth/zalo/token response
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={testUserInfoAPI}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Test /api/auth/zalo/user
            </button>
            <button
              onClick={testZaloAPI}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Test Zalo Graph API Directly
            </button>
          </div>
        </div>

        {/* Test Results */}
        {testResults && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            <div className={`p-4 rounded ${testResults.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(testResults, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Debug Logs</h2>
            <button
              onClick={clearLogs}
              className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-96 overflow-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet. Click buttons above to start debugging.</div>
            ) : (
              logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h3 className="font-semibold mb-2">📋 How to Debug:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Open Chrome DevTools (F12) → Network tab</li>
            <li>Click "Đăng nhập với Zalo" on your login page</li>
            <li>After redirecting back, find the <code className="bg-white px-1 rounded">/api/auth/zalo/token</code> request</li>
            <li>Copy the <code className="bg-white px-1 rounded">access_token</code> from the response</li>
            <li>Paste it into the "Access Token" field above</li>
            <li>Click "Test /api/auth/zalo/user" to see if it works</li>
            <li>Check the logs and test results</li>
          </ol>
        </div>

        {/* Common Issues */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-6">
          <h3 className="font-semibold mb-2">🚨 Common Issues:</h3>
          <ul className="list-disc list-inside space-y-2 text-sm">
            <li><strong>Invalid access token</strong> - Token expired (>1 hour old) or wrong format</li>
            <li><strong>CORS error</strong> - API not accessible from browser (expected for Zalo API)</li>
            <li><strong>404 Not Found</strong> - API route not deployed or wrong path</li>
            <li><strong>Missing env vars</strong> - NEXT_PUBLIC_ZALO_APP_ID or ZALO_APP_SECRET not set</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
