# 🔐 Hướng Dẫn Phân Quyền Free/Premium

Tài liệu hướng dẫn sử dụng hệ thống phân quyền truy cập theo gói membership.

---

## 📊 Phân Quyền Tính Năng

### Free Tier (Miễn Phí)

User với gói Free được truy cập:

| Tính Năng | Route | Mô Tả |
|-----------|-------|-------|
| **Tổng quan** | `/dashboard` | Dashboard tổng quan thị trường |
| **Cổ phiếu** | `/stocks` | Thông tin cổ phiếu cơ bản |
| **Thị trường** | `/market` | Dữ liệu thị trường |
| **Cá nhân** | `/profile` | Quản lý profile cá nhân |

### Premium Tier (Trả Phí)

User với gói Premium được truy cập **TẤT CẢ** tính năng, bao gồm:

| Tính Năng | Route | Mô Tả |
|-----------|-------|-------|
| ✅ **Tất cả Free features** | - | Dashboard, Stocks, Market, Profile |
| **Tín hiệu** | `/signals` | Tín hiệu giao dịch AI |
| **Phân tích AI** | `/ai-analysis` | Phân tích chuyên sâu |
| **Danh mục** | `/portfolio` | Quản lý danh mục đầu tư |
| **Cảnh báo** | `/alerts` | Cảnh báo giá realtime |

---

## 🚀 Setup

### 1. Chạy SQL Script

Chạy script trong **Supabase SQL Editor**:

```bash
File: scripts/supabase-auth-profile-setup.sql
```

Script này tạo:
- ✅ Function `can_access_feature(feature)`
- ✅ Function `get_my_accessible_features()`
- ✅ Function `require_premium()`

### 2. Import Helpers

```typescript
import {
  FEATURES,
  canAccessFeature,
  isPremiumUser,
  getAccessibleFeatures,
} from '@/lib/permissions'
```

---

## 📚 Sử Dụng

### 1. Check Quyền Truy Cập (Client-side)

```typescript
import { canAccessFeature, FEATURES } from '@/lib/permissions'

async function checkSignalsAccess() {
  const hasAccess = await canAccessFeature(FEATURES.SIGNALS)

  if (hasAccess) {
    console.log('User có quyền xem Signals')
  } else {
    console.log('User cần nâng cấp Premium')
  }
}
```

### 2. Check Premium Status

```typescript
import { isPremiumUser } from '@/lib/permissions'

async function checkPremium() {
  const isPremium = await isPremiumUser()

  if (isPremium) {
    // Show premium features
  } else {
    // Show upgrade prompt
  }
}
```

### 3. Lấy Danh Sách Features

```typescript
import { getAccessibleFeatures } from '@/lib/permissions'

async function loadFeatures() {
  const features = await getAccessibleFeatures()
  console.log('Accessible features:', features)
  // Free user: ['dashboard', 'stocks', 'market', 'profile']
  // Premium user: ['dashboard', 'stocks', 'market', 'profile', 'signals', 'ai-analysis', 'portfolio', 'alerts']
}
```

---

## 🛡️ Protect Components

### Cách 1: Dùng `ProtectedFeature` Component

```typescript
import { ProtectedFeature } from '@/components/ProtectedFeature'
import { FEATURES } from '@/lib/permissions'

export default function SignalsPage() {
  return (
    <ProtectedFeature feature={FEATURES.SIGNALS}>
      {/* Nội dung chỉ Premium user thấy */}
      <SignalsContent />
    </ProtectedFeature>
  )
}
```

**Với custom fallback**:

```typescript
<ProtectedFeature
  feature={FEATURES.SIGNALS}
  fallback={<CustomUpgradeMessage />}
  showUpgradePrompt={false}
>
  <SignalsContent />
</ProtectedFeature>
```

### Cách 2: Dùng HOC `withFeatureAccess`

```typescript
import { withFeatureAccess } from '@/components/withFeatureAccess'
import { FEATURES } from '@/lib/permissions'

function SignalsPage() {
  return (
    <div>
      <h1>Tín hiệu giao dịch</h1>
      {/* Page content */}
    </div>
  )
}

// Protect toàn bộ page
export default withFeatureAccess(SignalsPage, {
  feature: FEATURES.SIGNALS,
  redirectTo: '/pricing'
})
```

**Auto-detect feature từ route**:

```typescript
// Tự động detect feature dựa trên pathname
export default withFeatureAccess(SignalsPage)
```

---

## 🔒 Protect API Routes

### Server-side Check (API Route)

```typescript
// app/api/signals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET(request: NextRequest) {
  // Get user session
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check premium access
  const { data: isPremium } = await supabase.rpc('is_premium_user')

  if (!isPremium) {
    return NextResponse.json(
      { error: 'Premium membership required' },
      { status: 403 }
    )
  }

  // Return premium data
  return NextResponse.json({ signals: [...] })
}
```

### Với `require_premium()` Function

```typescript
export async function POST(request: NextRequest) {
  try {
    // This will throw exception if not premium
    await supabase.rpc('require_premium')

    // Process premium feature
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Premium membership required' },
      { status: 403 }
    )
  }
}
```

---

## 🎨 UI Examples

### Navigation Menu với Phân Quyền

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAccessibleFeatures, FEATURE_NAMES } from '@/lib/permissions'

export function Navigation() {
  const [accessibleFeatures, setAccessibleFeatures] = useState<string[]>([])

  useEffect(() => {
    loadFeatures()
  }, [])

  const loadFeatures = async () => {
    const features = await getAccessibleFeatures()
    setAccessibleFeatures(features)
  }

  const menuItems = [
    { feature: 'dashboard', route: '/dashboard' },
    { feature: 'stocks', route: '/stocks' },
    { feature: 'market', route: '/market' },
    { feature: 'signals', route: '/signals' },
    { feature: 'portfolio', route: '/portfolio' },
  ]

  return (
    <nav>
      {menuItems.map(item => {
        const hasAccess = accessibleFeatures.includes(item.feature)
        const isPremium = !['dashboard', 'stocks', 'market', 'profile'].includes(item.feature)

        return (
          <Link
            key={item.route}
            href={hasAccess ? item.route : '/pricing'}
            className={hasAccess ? '' : 'opacity-50 cursor-not-allowed'}
          >
            {FEATURE_NAMES[item.feature as any]}
            {isPremium && !hasAccess && (
              <span className="ml-2 text-xs bg-[--accent] text-white px-2 py-0.5 rounded">
                Premium
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
```

### Feature Card với Lock Icon

```typescript
import { isPremiumFeature, FEATURE_NAMES } from '@/lib/permissions'

export function FeatureCard({ feature, hasAccess }: any) {
  const isPremium = isPremiumFeature(feature)

  return (
    <div className={`p-6 rounded-lg border ${hasAccess ? 'border-[--border]' : 'border-[--muted] opacity-60'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">{FEATURE_NAMES[feature]}</h3>
        {isPremium && !hasAccess && (
          <svg className="w-5 h-5 text-[--muted]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        )}
      </div>

      {hasAccess ? (
        <p className="text-sm text-[--muted]">Bạn có quyền truy cập</p>
      ) : (
        <button className="text-sm text-[--accent] hover:underline">
          Nâng cấp Premium
        </button>
      )}
    </div>
  )
}
```

---

## 🧪 Testing

### Test Functions trong SQL Editor

```sql
-- Test 1: Check if user can access signals (should return false for free users)
SELECT can_access_feature('signals');

-- Test 2: Get accessible features
SELECT * FROM get_my_accessible_features();

-- Test 3: Check premium status
SELECT is_premium_user();

-- Test 4: Upgrade user to premium
UPDATE profiles
SET membership = 'premium',
    membership_expires_at = NOW() + INTERVAL '1 year'
WHERE id = auth.uid();

-- Test 5: Recheck access after upgrade
SELECT can_access_feature('signals');  -- Should return true now
```

### Test TypeScript Functions

```typescript
import { canAccessFeature, isPremiumUser, FEATURES } from '@/lib/permissions'

async function runTests() {
  console.log('Testing permissions...')

  // Test 1: Check premium status
  const isPremium = await isPremiumUser()
  console.log('Is premium:', isPremium)

  // Test 2: Check signals access
  const canAccessSignals = await canAccessFeature(FEATURES.SIGNALS)
  console.log('Can access signals:', canAccessSignals)

  // Test 3: Check free feature access
  const canAccessDashboard = await canAccessFeature(FEATURES.DASHBOARD)
  console.log('Can access dashboard:', canAccessDashboard)

  // Test 4: Get all accessible features
  const features = await getAccessibleFeatures()
  console.log('Accessible features:', features)
}
```

---

## 📝 Migration Existing Users

Nếu bạn đã có users trong database:

```sql
-- Set tất cả existing users thành Free (nếu chưa có)
UPDATE profiles
SET membership = 'free'
WHERE membership IS NULL;

-- Grant Premium cho specific users
UPDATE profiles
SET membership = 'premium',
    membership_expires_at = NOW() + INTERVAL '1 year'
WHERE email IN ('premium-user@example.com');

-- Check results
SELECT email, membership, membership_expires_at
FROM profiles
ORDER BY created_at DESC;
```

---

## 🔧 Customization

### Thêm Feature Mới

1. **Update SQL function** `can_access_feature()`:

```sql
-- Thêm 'new-feature' vào list Free hoặc Premium
IF p_feature IN ('dashboard', 'stocks', 'market', 'profile', 'new-feature') THEN
  RETURN TRUE;
END IF;
```

2. **Update TypeScript constants**:

```typescript
// lib/permissions.ts
export const FEATURES = {
  // ...existing
  NEW_FEATURE: 'new-feature',
}

export const FREE_FEATURES = [
  // ...existing
  FEATURES.NEW_FEATURE,
]

export const FEATURE_NAMES = {
  // ...existing
  [FEATURES.NEW_FEATURE]: 'Tính năng mới',
}
```

### Custom Upgrade Flow

```typescript
// components/CustomUpgrade.tsx
export function CustomUpgradePrompt({ feature }: any) {
  return (
    <div>
      <h3>Nâng cấp để sử dụng {FEATURE_NAMES[feature]}</h3>
      <button onClick={() => window.location.href = '/pricing'}>
        Xem gói Premium
      </button>
    </div>
  )
}

// Usage
<ProtectedFeature
  feature={FEATURES.SIGNALS}
  fallback={<CustomUpgradePrompt feature={FEATURES.SIGNALS} />}
  showUpgradePrompt={false}
>
  <Content />
</ProtectedFeature>
```

---

## 📂 Files Liên Quan

```
✅ scripts/supabase-auth-profile-setup.sql  (SQL functions)
✅ lib/permissions.ts                        (TypeScript helpers)
✅ components/ProtectedFeature.tsx           (Component wrapper)
✅ components/withFeatureAccess.tsx          (HOC wrapper)
✅ docs/PERMISSIONS_GUIDE.md                 (Tài liệu này)
```

---

## ✅ Checklist

- [ ] Chạy SQL script trong Supabase
- [ ] Verify functions tồn tại (`can_access_feature`, etc.)
- [ ] Test với Free user
- [ ] Test với Premium user
- [ ] Protect premium pages với `ProtectedFeature` hoặc `withFeatureAccess`
- [ ] Update navigation menu
- [ ] Test upgrade flow
- [ ] Add loading states
- [ ] Handle errors gracefully

---

**Tạo bởi**: CPLS Development Team
**Ngày**: 2025-11-14
**Branch**: `claude/check-zalo-auth-nick-01CyzQ5SFjWRTLYf94pj2JW7`
