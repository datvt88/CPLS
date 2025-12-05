'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { canAccessFeature, getFeatureForRoute, type Feature } from '@/lib/permissions'

interface WithFeatureAccessOptions {
  feature?: Feature
  redirectTo?: string
  showLoading?: boolean
}

/**
 * HOC to protect pages based on feature access
 *
 * Usage:
 * export default withFeatureAccess(SignalsPage, { feature: 'signals' })
 *
 * Or auto-detect from route:
 * export default withFeatureAccess(SignalsPage)
 */
export function withFeatureAccess<P extends object>(
  Component: React.ComponentType<P>,
  options: WithFeatureAccessOptions = {}
) {
  return function ProtectedComponent(props: P) {
    const router = useRouter()
    const pathname = usePathname()
    const [hasAccess, setHasAccess] = useState<boolean | null>(null)
    const [isChecking, setIsChecking] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
      checkAccess()
    }, [pathname])

    const checkAccess = async () => {
      setIsChecking(true)
      setError(null)

      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Permission check timeout')), 10000)
        )

        const checkPromise = (async () => {
          // Determine feature to check
          let feature = options.feature
          if (!feature) {
            feature = getFeatureForRoute(pathname)
          }

          // If no feature detected, allow access by default
          if (!feature) {
            return true
          }

          // Check access
          return await canAccessFeature(feature)
        })()

        const access = await Promise.race([checkPromise, timeoutPromise])

        setHasAccess(access)
        setIsChecking(false)

        // Redirect if no access
        if (!access) {
          const redirectUrl = options.redirectTo || '/pricing'
          setTimeout(() => {
            router.push(redirectUrl)
          }, 1500)
        }
      } catch (err: any) {
        console.error('Error checking feature access:', err)
        setIsChecking(false)
        if (err.message === 'Permission check timeout') {
          setError('Kiểm tra quyền truy cập quá lâu. Vui lòng thử lại.')
        } else {
          setError('Không thể kiểm tra quyền truy cập.')
        }
      }
    }

    // Error state
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[--bg] p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null)
                setIsChecking(true)
                checkAccess()
              }}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
            >
              Thử lại
            </button>
          </div>
        </div>
      )
    }

    // Loading state
    if (isChecking) {
      if (options.showLoading === false) {
        return null
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[--bg]">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-[--accent] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-[--muted]">Đang kiểm tra quyền truy cập...</p>
          </div>
        </div>
      )
    }

    // No access
    if (hasAccess === false) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[--bg] p-4">
          <div className="text-center max-w-md">
            <div className="mb-6 p-4 bg-[--danger]/10 rounded-full inline-block">
              <svg
                className="w-12 h-12 text-[--danger]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-[--fg] mb-2">
              Không có quyền truy cập
            </h2>

            <p className="text-[--muted] mb-6">
              Bạn cần nâng cấp lên Premium để sử dụng tính năng này.
              Đang chuyển hướng...
            </p>

            <button
              onClick={() => router.push('/pricing')}
              className="px-6 py-3 bg-[--accent] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Nâng cấp ngay
            </button>
          </div>
        </div>
      )
    }

    // Has access - render component
    return <Component {...props} />
  }
}
