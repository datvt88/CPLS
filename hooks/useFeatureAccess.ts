// hooks/useFeatureAccess.ts
'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'
import { getFeatureForRoute, type Feature } from '@/lib/permissions'

interface UseFeatureAccessOptions {
  feature?: Feature
  redirectUrl?: string
  requireAccess?: boolean
}

export function useFeatureAccess(options: UseFeatureAccessOptions = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { canAccess, isLoading, isPremium } = usePermissions()

  const targetFeature = options.feature || getFeatureForRoute(pathname)
  const hasAccess = targetFeature ? canAccess(targetFeature) : true

  useEffect(() => {
    if (!isLoading && options.requireAccess && !hasAccess) {
      const target = options.redirectUrl || '/upgrade'
      router.push(target)
    }
  }, [isLoading, hasAccess, options.requireAccess, options.redirectUrl, router])

  return {
    hasAccess,
    isLoading,
    isPremium,
    feature: targetFeature
  }
}
