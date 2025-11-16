/**
 * Migration Script: Reset Zalo OAuth User Passwords
 *
 * Script này reset password cho tất cả Zalo users về format mới,
 * đảm bảo tất cả users (cũ và mới) đều login được.
 *
 * Sử dụng:
 * 1. Set environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 * 2. Run: npx ts-node scripts/migrate-zalo-passwords.ts
 */

import { createClient } from '@supabase/supabase-js'

// Supabase Admin Client (bypass RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface ZaloUser {
  id: string
  email: string
  created_at: string
}

/**
 * Extract Zalo ID from email
 * Email format: zalo_<ZALO_ID>@cpls.app
 */
function extractZaloId(email: string): string | null {
  const match = email.match(/^zalo_(\d+)@cpls\.app$/)
  return match ? match[1] : null
}

/**
 * Generate new password format
 */
function generateNewPassword(zaloId: string): string {
  return `zalo_oauth_${zaloId}_cpls_secure_2024`
}

/**
 * Main migration function
 */
async function migrateZaloPasswords() {
  console.log('🔧 Starting Zalo Password Migration...\n')

  try {
    // Step 1: Get all users with Zalo email pattern
    console.log('📋 Step 1: Fetching all Zalo users...')
    const { data: users, error: fetchError } = await supabaseAdmin.auth.admin.listUsers()

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`)
    }

    // Filter Zalo users
    const zaloUsers = users.users.filter(user =>
      user.email?.match(/^zalo_\d+@cpls\.app$/)
    )

    console.log(`✅ Found ${zaloUsers.length} Zalo users\n`)

    if (zaloUsers.length === 0) {
      console.log('ℹ️  No Zalo users to migrate')
      return
    }

    // Step 2: Update password for each user
    console.log('🔄 Step 2: Updating passwords...\n')

    let successCount = 0
    let failCount = 0
    const errors: { email: string; error: string }[] = []

    for (const user of zaloUsers) {
      const email = user.email!
      const zaloId = extractZaloId(email)

      if (!zaloId) {
        console.log(`⚠️  Skipping invalid email: ${email}`)
        failCount++
        errors.push({ email, error: 'Invalid email format' })
        continue
      }

      const newPassword = generateNewPassword(zaloId)

      try {
        // Update user password using Admin API
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { password: newPassword }
        )

        if (updateError) {
          throw updateError
        }

        console.log(`✅ Updated: ${email} (user_id: ${user.id.substring(0, 8)}...)`)
        successCount++
      } catch (error) {
        console.error(`❌ Failed: ${email}`)
        console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`)
        failCount++
        errors.push({
          email,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    // Step 3: Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 MIGRATION SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Zalo users: ${zaloUsers.length}`)
    console.log(`✅ Successfully updated: ${successCount}`)
    console.log(`❌ Failed: ${failCount}`)

    if (errors.length > 0) {
      console.log('\n❌ ERRORS:')
      errors.forEach(({ email, error }) => {
        console.log(`  - ${email}: ${error}`)
      })
    }

    console.log('\n✨ Migration completed!')

  } catch (error) {
    console.error('\n❌ Migration failed!')
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

// Run migration
migrateZaloPasswords()
  .then(() => {
    console.log('\n👋 Exiting...')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
