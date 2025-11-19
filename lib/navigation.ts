/**
 * Shared navigation configuration
 * Single source of truth for all navigation items across the app
 */

export interface NavigationItem {
  href: string
  label: string
  icon: string
  badge?: string
  description?: string
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    href: '/dashboard',
    label: 'Tổng quan',
    icon: '📊',
    description: 'Dashboard và thống kê tổng quan'
  },
  {
    href: '/market',
    label: 'Thị trường',
    icon: '🌐',
    description: 'Tổng quan thị trường chứng khoán'
  },
  {
    href: '/stocks',
    label: 'Cổ phiếu',
    icon: '💹',
    description: 'Phân tích cổ phiếu chuyên sâu'
  },
  {
    href: '/signals',
    label: 'Tín hiệu',
    icon: '⚡',
    description: 'Tín hiệu mua bán'
  },
  {
    href: '/profile',
    label: 'Cá nhân',
    icon: '👤',
    description: 'Thông tin cá nhân'
  },
]
