#!/usr/bin/env node

/**
 * Supabase Setup Checker
 * Kiểm tra cấu hình Supabase và đưa ra hướng dẫn khắc phục
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Đang kiểm tra cấu hình Supabase...\n');

const checks = [];
let hasErrors = false;

// Check 1: .env.local file exists
const envLocalPath = path.join(process.cwd(), '.env.local');
const envLocalExists = fs.existsSync(envLocalPath);

if (envLocalExists) {
  checks.push('✅ File .env.local tồn tại');
} else {
  checks.push('❌ File .env.local KHÔNG TỒN TẠI');
  hasErrors = true;
}

// Check 2: Read environment variables
let envContent = '';
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const envVars = {};

if (envLocalExists) {
  try {
    envContent = fs.readFileSync(envLocalPath, 'utf8');

    // Parse .env file
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        envVars[key] = value;
      }
    });

    // Check each required variable
    requiredVars.forEach(varName => {
      const value = envVars[varName];

      if (!value || value === '' || value.includes('your_') || value.includes('your-project')) {
        checks.push(`❌ ${varName} chưa được cấu hình`);
        hasErrors = true;
      } else if (value.length < 20) {
        checks.push(`⚠️  ${varName} có giá trị ngắn (có thể không đúng)`);
        hasErrors = true;
      } else {
        checks.push(`✅ ${varName} đã được cấu hình`);
      }
    });

  } catch (err) {
    checks.push(`❌ Lỗi đọc file .env.local: ${err.message}`);
    hasErrors = true;
  }
}

// Check 3: Validate Supabase URL format
if (envVars['NEXT_PUBLIC_SUPABASE_URL']) {
  const url = envVars['NEXT_PUBLIC_SUPABASE_URL'];
  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    checks.push('⚠️  NEXT_PUBLIC_SUPABASE_URL không đúng format (phải là https://xxx.supabase.co)');
    hasErrors = true;
  } else {
    checks.push('✅ Supabase URL có format hợp lệ');
  }
}

// Check 4: Validate key format (should be JWT-like)
['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(keyName => {
  if (envVars[keyName]) {
    const key = envVars[keyName];
    if (!key.startsWith('eyJ')) {
      checks.push(`⚠️  ${keyName} không đúng format (JWT token phải bắt đầu bằng 'eyJ')`);
      hasErrors = true;
    } else {
      checks.push(`✅ ${keyName} có format hợp lệ`);
    }
  }
});

// Print results
console.log('📋 Kết quả kiểm tra:\n');
checks.forEach(check => console.log(check));

console.log('\n' + '='.repeat(60) + '\n');

if (hasErrors) {
  console.log('❌ PHÁT HIỆN VẤN ĐỀ!\n');
  console.log('📚 Hướng dẫn khắc phục:\n');

  if (!envLocalExists) {
    console.log('1️⃣  Tạo file .env.local:');
    console.log('   cp .env.local.example .env.local\n');
  }

  console.log('2️⃣  Lấy Supabase credentials:');
  console.log('   - Truy cập: https://supabase.com/dashboard');
  console.log('   - Chọn project của bạn');
  console.log('   - Vào Settings → API');
  console.log('   - Copy Project URL và API keys\n');

  console.log('3️⃣  Cập nhật file .env.local với credentials thật\n');

  console.log('4️⃣  Restart dev server:');
  console.log('   npm run dev\n');

  console.log('📖 Xem hướng dẫn chi tiết tại: SETUP_INSTRUCTIONS.md\n');

  process.exit(1);
} else {
  console.log('✅ TẤT CẢ ĐỀU ỔN!\n');
  console.log('Supabase đã được cấu hình đúng.');
  console.log('Bạn có thể chạy ứng dụng: npm run dev\n');

  process.exit(0);
}
