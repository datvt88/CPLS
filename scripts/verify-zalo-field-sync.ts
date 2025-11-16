/**
 * Verification Script: Zalo Field Synchronization
 *
 * Script này verify rằng tất cả fields từ Zalo đã được đồng bộ đúng vào Supabase
 *
 * Usage: npx ts-node scripts/verify-zalo-field-sync.ts
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

interface FieldStats {
  totalZaloUsers: number
  hasZaloId: number
  hasFullName: number
  hasBirthday: number
  hasGender: number
  hasAvatar: number
  hasPlaceholderPhone: number
  hasRealPhone: number
}

async function verifyFieldSync() {
  console.log('🔍 Verifying Zalo Field Synchronization...\n')

  try {
    // Get all Zalo profiles
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .like('email', 'zalo_%@cpls.app')

    if (error) {
      throw error
    }

    if (!profiles || profiles.length === 0) {
      console.log('ℹ️  No Zalo users found in database')
      return
    }

    console.log(`Found ${profiles.length} Zalo users\n`)

    // Calculate statistics
    const stats: FieldStats = {
      totalZaloUsers: profiles.length,
      hasZaloId: profiles.filter(p => p.zalo_id).length,
      hasFullName: profiles.filter(p => p.full_name).length,
      hasBirthday: profiles.filter(p => p.birthday).length,
      hasGender: profiles.filter(p => p.gender).length,
      hasAvatar: profiles.filter(p => p.avatar_url).length,
      hasPlaceholderPhone: profiles.filter(p => p.phone_number === '0000000000').length,
      hasRealPhone: profiles.filter(p => p.phone_number && p.phone_number !== '0000000000').length,
    }

    // Display statistics
    console.log('='.repeat(70))
    console.log('📊 FIELD SYNCHRONIZATION STATISTICS')
    console.log('='.repeat(70))
    console.log()

    displayFieldStat('Total Zalo Users', stats.totalZaloUsers, stats.totalZaloUsers)
    console.log()

    console.log('Zalo API Fields:')
    displayFieldStat('  zalo_id (from id)', stats.hasZaloId, stats.totalZaloUsers)
    displayFieldStat('  full_name (from name)', stats.hasFullName, stats.totalZaloUsers)
    displayFieldStat('  birthday (optional)', stats.hasBirthday, stats.totalZaloUsers)
    displayFieldStat('  gender (optional)', stats.hasGender, stats.totalZaloUsers)
    displayFieldStat('  avatar_url (from picture)', stats.hasAvatar, stats.totalZaloUsers)
    console.log()

    console.log('Generated Fields:')
    displayFieldStat('  Placeholder phone (0000000000)', stats.hasPlaceholderPhone, stats.totalZaloUsers)
    displayFieldStat('  Real phone (user updated)', stats.hasRealPhone, stats.totalZaloUsers)
    console.log()

    // Check for issues
    const issues: string[] = []

    if (stats.hasZaloId < stats.totalZaloUsers) {
      issues.push(`⚠️  ${stats.totalZaloUsers - stats.hasZaloId} users missing zalo_id`)
    }

    if (stats.hasFullName < stats.totalZaloUsers) {
      issues.push(`⚠️  ${stats.totalZaloUsers - stats.hasFullName} users missing full_name`)
    }

    if (stats.hasAvatar < stats.totalZaloUsers * 0.9) {
      issues.push(`⚠️  Only ${stats.hasAvatar}/${stats.totalZaloUsers} users have avatar`)
    }

    // Display issues
    if (issues.length > 0) {
      console.log('🚨 ISSUES DETECTED:')
      issues.forEach(issue => console.log(issue))
      console.log()
    }

    // Display sample records
    console.log('='.repeat(70))
    console.log('📋 SAMPLE RECORDS (First 5)')
    console.log('='.repeat(70))
    console.log()

    profiles.slice(0, 5).forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.email}`)
      console.log(`   Zalo ID: ${profile.zalo_id || '❌ MISSING'}`)
      console.log(`   Name: ${profile.full_name || '❌ MISSING'}`)
      console.log(`   Birthday: ${profile.birthday || '(not set)'}`)
      console.log(`   Gender: ${profile.gender || '(not set)'}`)
      console.log(`   Avatar: ${profile.avatar_url ? '✅' : '❌'}`)
      console.log(`   Phone: ${profile.phone_number}${profile.phone_number === '0000000000' ? ' (placeholder)' : ' (real)'}`)
      console.log(`   Created: ${new Date(profile.created_at).toLocaleString()}`)
      console.log()
    })

    // Check for data quality
    console.log('='.repeat(70))
    console.log('🔍 DATA QUALITY CHECKS')
    console.log('='.repeat(70))
    console.log()

    // Check birthday format
    const invalidBirthdays = profiles.filter(p =>
      p.birthday && !p.birthday.match(/^\d{2}\/\d{2}\/\d{4}$/)
    )
    if (invalidBirthdays.length > 0) {
      console.log(`❌ ${invalidBirthdays.length} users have invalid birthday format (should be DD/MM/YYYY)`)
    } else {
      console.log(`✅ All birthdays are in correct format (DD/MM/YYYY)`)
    }

    // Check gender values
    const invalidGenders = profiles.filter(p =>
      p.gender && !['male', 'female'].includes(p.gender)
    )
    if (invalidGenders.length > 0) {
      console.log(`❌ ${invalidGenders.length} users have invalid gender value`)
    } else {
      console.log(`✅ All genders are valid (male/female)`)
    }

    // Check zalo_id format
    const invalidZaloIds = profiles.filter(p =>
      p.zalo_id && !p.zalo_id.match(/^\d+$/)
    )
    if (invalidZaloIds.length > 0) {
      console.log(`❌ ${invalidZaloIds.length} users have invalid zalo_id format`)
    } else {
      console.log(`✅ All zalo_ids are numeric`)
    }

    // Check email format
    const invalidEmails = profiles.filter(p =>
      !p.email.match(/^zalo_\d+@cpls\.app$/)
    )
    if (invalidEmails.length > 0) {
      console.log(`❌ ${invalidEmails.length} users have invalid email format`)
    } else {
      console.log(`✅ All emails follow pattern: zalo_[ID]@cpls.app`)
    }

    console.log()

    // Final summary
    console.log('='.repeat(70))
    console.log('📝 SUMMARY')
    console.log('='.repeat(70))
    console.log()

    const syncPercentage = ((stats.hasZaloId / stats.totalZaloUsers) * 100).toFixed(1)
    const dataQuality = issues.length === 0 && invalidBirthdays.length === 0 &&
                        invalidGenders.length === 0 && invalidZaloIds.length === 0

    console.log(`Total Zalo Users: ${stats.totalZaloUsers}`)
    console.log(`Field Sync Rate: ${syncPercentage}% (${stats.hasZaloId}/${stats.totalZaloUsers})`)
    console.log(`Data Quality: ${dataQuality ? '✅ EXCELLENT' : '⚠️  NEEDS ATTENTION'}`)
    console.log()

    if (dataQuality && parseFloat(syncPercentage) === 100) {
      console.log('🎉 All fields are properly synchronized!')
    } else if (parseFloat(syncPercentage) >= 90) {
      console.log('✅ Field synchronization is mostly complete')
      console.log('   Some users may be missing optional fields (birthday/gender)')
    } else {
      console.log('⚠️  Field synchronization needs attention')
      console.log('   Check the issues listed above')
    }

  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  }
}

function displayFieldStat(label: string, count: number, total: number) {
  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0'
  const icon = count === total ? '✅' : count >= total * 0.9 ? '⚠️' : '❌'
  console.log(`${icon} ${label.padEnd(40)} ${count}/${total} (${percentage}%)`)
}

verifyFieldSync()
  .then(() => {
    console.log('\n✨ Verification completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })
