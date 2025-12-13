'use client'

import ProtectedRoute from './ProtectedRoute'

interface AdminRouteProps {
  children: React.ReactNode
}

/**
 * AdminRoute Component
 *
 * Route wrapper for admin/moderator pages.
 * Uses ProtectedRoute with requireAdmin=true.
 * 
 * @deprecated Use <ProtectedRoute requireAdmin> instead
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  return (
    <ProtectedRoute requireAdmin>
      {children}
    </ProtectedRoute>
  )
}
