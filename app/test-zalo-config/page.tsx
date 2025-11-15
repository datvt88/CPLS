'use client'

import { useState } from 'react'

export default function TestZaloConfig() {
  const [result, setResult] = useState<any>(null)

  const testConfig = () => {
    const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown'
    const autoDetectedUri = `${currentOrigin}/auth/callback`
    const overrideUri = process.env.NEXT_PUBLIC_REDIRECT_URI
    const finalUri = overrideUri || autoDetectedUri

    setResult({
      appId: appId || '❌ NOT SET',
      appIdConfigured: !!appId,
      currentOrigin,
      autoDetectedRedirectUri: autoDetectedUri,
      overrideRedirectUri: overrideUri || '❌ NOT SET',
      finalRedirectUri: finalUri,
      usingOverride: !!overrideUri,
      timestamp: new Date().toISOString(),
      environment: {
        isDevelopment: currentOrigin.includes('localhost'),
        isProduction: !currentOrigin.includes('localhost'),
        protocol: currentOrigin.split(':')[0],
        hasPort: currentOrigin.includes(':3000') || currentOrigin.includes(':3001'),
      }
    })
  }

  return (
    <div className="min-h-screen bg-[--bg] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[--panel] rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-[--fg] mb-2">
            🔍 Zalo OAuth Configuration Test
          </h1>
          <p className="text-[--muted] mb-6">
            Use this page to debug "Invalid Redirect URI" errors
          </p>

          <button
            onClick={testConfig}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium mb-6 transition-colors"
          >
            🧪 Test Configuration
          </button>

          {result && (
            <div className="space-y-6">
              {/* Current Configuration */}
              <div className="p-4 bg-gray-900 rounded-lg">
                <h2 className="font-bold text-[--fg] mb-3 flex items-center gap-2">
                  📋 Current Configuration
                </h2>
                <pre className="text-sm text-gray-300 overflow-auto">
{JSON.stringify(result, null, 2)}
                </pre>
              </div>

              {/* Critical Info */}
              <div className="p-4 bg-yellow-900/30 border-l-4 border-yellow-500 rounded">
                <h3 className="font-bold text-yellow-200 mb-2">
                  ⚠️ IMPORTANT: Register this URI in Zalo Developer Console
                </h3>
                <div className="bg-gray-900 p-3 rounded mt-2">
                  <code className="text-green-400 text-lg font-mono break-all">
                    {result.finalRedirectUri}
                  </code>
                </div>

                {result.usingOverride && (
                  <p className="text-yellow-200 mt-2 text-sm">
                    ℹ️ Using override from NEXT_PUBLIC_REDIRECT_URI
                  </p>
                )}
              </div>

              {/* App ID Status */}
              <div className={`p-4 rounded border-l-4 ${
                result.appIdConfigured
                  ? 'bg-green-900/30 border-green-500'
                  : 'bg-red-900/30 border-red-500'
              }`}>
                <h3 className={`font-bold mb-2 ${
                  result.appIdConfigured ? 'text-green-200' : 'text-red-200'
                }`}>
                  {result.appIdConfigured ? '✅ App ID Configured' : '❌ App ID Not Set'}
                </h3>
                {result.appIdConfigured ? (
                  <p className="text-green-100 text-sm">
                    App ID: {result.appId}
                  </p>
                ) : (
                  <p className="text-red-100 text-sm">
                    Set NEXT_PUBLIC_ZALO_APP_ID in .env.local
                  </p>
                )}
              </div>

              {/* Environment Info */}
              <div className="p-4 bg-blue-900/30 border-l-4 border-blue-500 rounded">
                <h3 className="font-bold text-blue-200 mb-2">🌍 Environment</h3>
                <ul className="text-blue-100 text-sm space-y-1">
                  <li>
                    <strong>Type:</strong>{' '}
                    {result.environment.isDevelopment ? 'Development (localhost)' : 'Production'}
                  </li>
                  <li>
                    <strong>Protocol:</strong> {result.environment.protocol}
                  </li>
                  <li>
                    <strong>Origin:</strong> {result.currentOrigin}
                  </li>
                </ul>
              </div>

              {/* Step by Step Guide */}
              <div className="p-4 bg-purple-900/30 border-l-4 border-purple-500 rounded">
                <h3 className="font-bold text-purple-200 mb-3">
                  📝 Step-by-Step Fix Guide
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-purple-100 text-sm">
                  <li>Copy the redirect URI from the yellow box above</li>
                  <li>Go to <a href="https://developers.zalo.me/" target="_blank" rel="noopener noreferrer" className="underline text-purple-300 hover:text-purple-200">Zalo Developer Console</a></li>
                  <li>Login and select your app</li>
                  <li>Find <strong>OAuth Settings</strong> or <strong>Redirect URIs</strong> section</li>
                  <li>Add the copied URI to the list</li>
                  <li>Click <strong>Save</strong></li>
                  <li>Wait 1-2 minutes for changes to propagate</li>
                  <li>Try login again</li>
                </ol>
              </div>

              {/* Common Issues */}
              <div className="p-4 bg-red-900/30 border-l-4 border-red-500 rounded">
                <h3 className="font-bold text-red-200 mb-3">
                  🚨 Common Issues
                </h3>
                <ul className="text-red-100 text-sm space-y-2">
                  <li>
                    <strong>HTTP vs HTTPS:</strong> Must match exactly (http://localhost for dev, https:// for prod)
                  </li>
                  <li>
                    <strong>Trailing slash:</strong> /auth/callback (no slash at end)
                  </li>
                  <li>
                    <strong>Port number:</strong> localhost:3000 vs localhost:3001 are different
                  </li>
                  <li>
                    <strong>Subdomain:</strong> www.domain.com vs domain.com are different
                  </li>
                  <li>
                    <strong>Case sensitive:</strong> Use lowercase for consistency
                  </li>
                </ul>
              </div>

              {/* Quick Links */}
              <div className="p-4 bg-gray-800 rounded">
                <h3 className="font-bold text-[--fg] mb-3">🔗 Quick Links</h3>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://developers.zalo.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Zalo Developer Console
                  </a>
                  <a
                    href="/docs/FIX_INVALID_REDIRECT_URI.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  >
                    Full Documentation
                  </a>
                  <a
                    href="/"
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                  >
                    Back to Home
                  </a>
                </div>
              </div>
            </div>
          )}

          {!result && (
            <div className="mt-6 p-6 bg-gray-800 rounded-lg text-center">
              <p className="text-[--muted]">
                Click "Test Configuration" button above to see your current OAuth configuration
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-[--muted]">
          <p>
            💡 Tip: Open Developer Console (F12) when clicking "Đăng nhập với Zalo" to see debug logs
          </p>
        </div>
      </div>
    </div>
  )
}
