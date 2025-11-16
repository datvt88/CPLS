/**
 * Verification Script: Check Zalo Users
 *
 * Script này kiểm tra tất cả Zalo users trong hệ thống
 * và verify rằng họ có thể login được.
 *
 * Sử dụng:
 * 1. Set environment variables
 * 2. Run: npx ts-node scripts/verify-zalo-users.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const supabase = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

function extractZaloId(email: string): string | null {
  const match = email.match(/^zalo_(\d+)@cpls\.app$/)
  return match ? match[1] : null
}

function generateNewPassword(zaloId: string): string {
  return `zalo_oauth_${zaloId}_cpls_secure_2024`
}

async function verifyZaloUsers() {
  console.log('🔍 Verifying Zalo Users...\n')

  try {
    // Get all Zalo users
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      throw error
    }

    const zaloUsers = users.users.filter(user =>
      user.email?.match(/^zalo_\d+@cpls\.app$/)
    )

    console.log(`Found ${zaloUsers.length} Zalo users\n`)

    // Check each user
    let canLoginCount = 0
    let cannotLoginCount = 0

    for (const user of zaloUsers) {
      const email = user.email!
      const zaloId = extractZaloId(email)

      if (!zaloId) {
        console.log(`⚠️  Invalid email: ${email}`)
        continue
      }

      const password = generateNewPassword(zaloId)

      // Try to sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (signInError) {
        console.log(`❌ Cannot login: ${email}`)
        console.log(`   Error: ${signInError.message}`)
        cannotLoginCount++
      } else {
        console.log(`✅ Can login: ${email}`)
        canLoginCount++

        // Sign out immediately
        await supabase.auth.signOut()
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    console.log('\n' + '='.repeat(60))
    console.log('📊 VERIFICATION SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total users: ${zaloUsers.length}`)
    console.log(`✅ Can login: ${canLoginCount}`)
    console.log(`❌ Cannot login: ${cannotLoginCount}`)

  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  }
}

verifyZaloUsers()
  .then(() => {
    console.log('\n✨ Verification completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
