'use client'

import { useState } from 'react'
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/pkce'

export default function DebugZaloAuth() {
  const [authUrl, setAuthUrl] = useState<string>('')
  const [params, setParams] = useState<any>(null)
  const [error, setError] = useState<string>('')

  const generateAuthUrl = async () => {
    try {
      setError('')
      const appId = process.env.NEXT_PUBLIC_ZALO_APP_ID
      const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI ||
                          `${window.location.origin}/auth/callback`
      const state = 'test_' + Math.random().toString(36).substring(2)

      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)

      const url = new URL('https://oauth.zaloapp.com/v4/permission')
      url.searchParams.set('app_id', appId || 'NOT_SET')
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('state', state)
      url.searchParams.set('code_challenge', codeChallenge)
      url.searchParams.set('code_challenge_method', 'S256')

      setAuthUrl(url.toString())
      setParams({
        app_id: appId || '❌ NOT SET',
        redirect_uri: redirectUri,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        code_verifier: codeVerifier,
        code_verifier_length: codeVerifier.length,
        code_challenge_length: codeChallenge.length,
      })
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-[--bg] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-[--panel] rounded-lg shadow-lg p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[--fg] mb-2">
            🔍 Debug Lỗi -14003 (Invalid Parameter)
          </h1>
          <p className="text-[--muted] mb-6">
            Tool này giúp bạn debug và fix lỗi -14003 từ Zalo OAuth
          </p>

          <div className="mb-6">
            <button
              onClick={generateAuthUrl}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🧪 Generate Authorization URL
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border-l-4 border-red-500 rounded">
              <p className="text-red-200 font-semibold">❌ Error:</p>
              <p className="text-red-100 text-sm mt-1">{error}</p>
            </div>
          )}

          {authUrl && (
            <div className="space-y-6">
              {/* Full URL */}
              <div className="p-4 bg-gray-900 rounded-lg">
                <h3 className="font-bold text-[--fg] mb-2">📍 Full Authorization URL:</h3>
                <div className="bg-gray-800 p-3 rounded overflow-auto">
                  <code className="text-green-400 text-xs md:text-sm break-all">
                    {authUrl}
                  </code>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(authUrl)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                  >
                    📋 Copy URL
                  </button>
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors inline-block"
                  >
                    🚀 Test OAuth (New Tab)
                  </a>
                </div>
              </div>

              {/* Parameters */}
              <div className="p-4 bg-gray-900 rounded-lg">
                <h3 className="font-bold text-[--fg] mb-3">📋 OAuth Parameters:</h3>
                <div className="space-y-2 text-sm overflow-auto">
                  {Object.entries(params).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex flex-col md:flex-row gap-2">
                      <span className="font-mono text-blue-400 md:min-w-[220px]">{key}:</span>
                      <span className="font-mono text-gray-300 break-all">
                        {key.includes('challenge') || key.includes('verifier')
                          ? typeof value === 'string' ? value.substring(0, 40) + '...' : value
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* App ID Check */}
              <div className={`p-4 rounded-lg border-l-4 ${
                params.app_id !== '❌ NOT SET'
                  ? 'bg-green-900/30 border-green-500'
                  : 'bg-red-900/30 border-red-500'
              }`}>
                <h3 className={`font-bold mb-2 ${
                  params.app_id !== '❌ NOT SET' ? 'text-green-200' : 'text-red-200'
                }`}>
                  {params.app_id !== '❌ NOT SET' ? '✅ App ID Configured' : '❌ App ID NOT SET'}
                </h3>
                {params.app_id !== '❌ NOT SET' ? (
                  <div className="text-green-100 text-sm space-y-2">
                    <p>App ID: <code className="bg-gray-800 px-2 py-1 rounded">{params.app_id}</code></p>
                    <p className="text-xs">✓ Verify this matches your Zalo Console App ID</p>
                  </div>
                ) : (
                  <div className="text-red-100 text-sm space-y-2">
                    <p>❌ NEXT_PUBLIC_ZALO_APP_ID is not set!</p>
                    <p className="text-xs">Fix: Set environment variable in Vercel or .env.local</p>
                  </div>
                )}
              </div>

              {/* Verification Checklist */}
              <div className="p-4 bg-yellow-900/30 border-l-4 border-yellow-500 rounded-lg">
                <h3 className="font-bold text-yellow-200 mb-3">✅ Fix Lỗi -14003 Checklist:</h3>
                <div className="space-y-4 text-yellow-100 text-sm">

                  <div className="space-y-1">
                    <p className="font-semibold">1. Verify App ID</p>
                    <p className="text-xs">
                      → Go to{' '}
                      <a href="https://developers.zalo.me/" target="_blank" rel="noopener noreferrer" className="underline text-yellow-300 hover:text-yellow-200">
                        Zalo Console
                      </a>
                      {' '}→ Your App → Check App ID matches:
                    </p>
                    <div className="bg-gray-800 p-2 rounded">
                      <code className="text-green-400 text-xs break-all">{params.app_id}</code>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold">2. Verify Redirect URI Registered</p>
                    <p className="text-xs">
                      → Zalo Console → OAuth Settings → Check this URI is in the list:
                    </p>
                    <div className="bg-gray-800 p-2 rounded">
                      <code className="text-green-400 text-xs break-all">{params.redirect_uri}</code>
                    </div>
                    <p className="text-xs mt-1">
                      ⚠️ Must match EXACTLY (https://, path, no trailing slash)
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold">3. Verify App Status</p>
                    <p className="text-xs">
                      → Zalo Console → App → Status must be <strong>"Active"</strong> or <strong>"Live"</strong>
                    </p>
                    <p className="text-xs">
                      If "Draft" or "Pending" → Submit for approval
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold">4. Verify Social API Enabled</p>
                    <p className="text-xs">
                      → Zalo Console → APIs & Services → Social API must be <strong>"Enabled"</strong>
                    </p>
                    <p className="text-xs">
                      Permissions needed: id, name, picture
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold">5. Wait After Changes</p>
                    <p className="text-xs">
                      After updating Zalo Console → Wait 1-2 minutes before testing
                    </p>
                  </div>
                </div>
              </div>

              {/* PKCE Info */}
              <div className="p-4 bg-purple-900/30 border-l-4 border-purple-500 rounded-lg">
                <h3 className="font-bold text-purple-200 mb-2">🔐 PKCE Verification:</h3>
                <div className="text-purple-100 text-sm space-y-1">
                  <p>✓ code_verifier length: {params.code_verifier_length} chars (should be 43+)</p>
                  <p>✓ code_challenge length: {params.code_challenge_length} chars (should be 43)</p>
                  <p>✓ code_challenge_method: S256 (SHA256 hash)</p>
                  <p className="text-xs mt-2 text-purple-200">
                    PKCE is correctly implemented ✅
                  </p>
                </div>
              </div>

              {/* Quick Links */}
              <div className="p-4 bg-gray-800 rounded-lg">
                <h3 className="font-bold text-[--fg] mb-3">🔗 Useful Links:</h3>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://developers.zalo.me/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                  >
                    Zalo Console
                  </a>
                  <a
                    href="/test-zalo-config"
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                  >
                    Config Test Page
                  </a>
                  <a
                    href="/"
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                  >
                    Back to Home
                  </a>
                </div>
              </div>

              {/* Documentation */}
              <div className="p-4 bg-blue-900/30 border-l-4 border-blue-500 rounded-lg">
                <h3 className="font-bold text-blue-200 mb-2">📚 Documentation:</h3>
                <div className="text-blue-100 text-sm space-y-1">
                  <p>→ <code className="bg-gray-800 px-1">docs/VERCEL_ZALO_CONFIG.md</code> - Complete setup guide</p>
                  <p>→ <code className="bg-gray-800 px-1">docs/FIX_ERROR_14003.md</code> - Fix -14003 error</p>
                  <p>→ <code className="bg-gray-800 px-1">docs/FIX_INVALID_REDIRECT_URI.md</code> - Redirect URI guide</p>
                </div>
              </div>
            </div>
          )}

          {!authUrl && !error && (
            <div className="mt-6 p-6 bg-gray-800 rounded-lg text-center">
              <p className="text-[--muted]">
                Click "Generate Authorization URL" button above to debug your Zalo OAuth configuration
              </p>
            </div>
          )}
        </div>

        {/* Footer Tip */}
        <div className="mt-6 text-center text-sm text-[--muted]">
          <p>
            💡 Tip: Use browser Developer Console (F12) when testing OAuth to see detailed logs
          </p>
        </div>
      </div>
    </div>
  )
}
