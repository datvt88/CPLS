/**
 * List All Zalo Users
 *
 * Script đơn giản để xem tất cả Zalo users trong hệ thống
 *
 * Usage: npx ts-node scripts/list-zalo-users.ts
 */

import { createClient } from '@supabase/supabase-js'

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

async function listZaloUsers() {
  console.log('📋 Listing all Zalo OAuth users...\n')

  try {
    // Get all users
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      throw error
    }

    // Filter Zalo users
    const zaloUsers = users.users.filter(user =>
      user.email?.match(/^zalo_\d+@cpls\.app$/)
    )

    console.log(`Total users in system: ${users.users.length}`)
    console.log(`Zalo OAuth users: ${zaloUsers.length}\n`)

    if (zaloUsers.length === 0) {
      console.log('ℹ️  No Zalo users found')
      return
    }

    console.log('=' .repeat(80))
    console.log('Zalo Users List')
    console.log('='.repeat(80))

    // Get profiles for these users
    const userIds = zaloUsers.map(u => u.id)
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, zalo_id, phone_number, membership, created_at')
      .in('id', userIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    zaloUsers.forEach((user, index) => {
      const profile = profileMap.get(user.id)

      console.log(`\n${index + 1}. ${user.email}`)
      console.log(`   User ID: ${user.id}`)
      console.log(`   Created: ${new Date(user.created_at).toLocaleString()}`)
      console.log(`   Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}`)

      if (profile) {
        console.log(`   Full Name: ${profile.full_name || 'N/A'}`)
        console.log(`   Zalo ID: ${profile.zalo_id || 'N/A'}`)
        console.log(`   Phone: ${profile.phone_number || 'N/A'}`)
        console.log(`   Membership: ${profile.membership || 'free'}`)
      } else {
        console.log(`   ⚠️  Profile: NOT FOUND`)
      }
    })

    console.log('\n' + '='.repeat(80))

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

listZaloUsers()
  .then(() => {
    console.log('\n✅ Done!')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
