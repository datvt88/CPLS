'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { authService } from '@/services/auth.service'
import { profileService } from '@/services/profile.service'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PublicIcon from '@mui/icons-material/Public'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import BoltIcon from '@mui/icons-material/Bolt'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import PersonIcon from '@mui/icons-material/Person'
import SecurityIcon from '@mui/icons-material/Security'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'

export default function Sidebar(){
  const [isAdmin, setIsAdmin] = useState(false)
  const unreadCount = useUnreadMessages()

  useEffect(() => {
    checkAdminRole()
  }, [])

  const checkAdminRole = async () => {
    try {
      const { user } = await authService.getUser()
      if (user) {
        const { profile } = await profileService.getProfile(user.id)
        if (profile && (profile.role === 'admin' || profile.role === 'mod')) {
          setIsAdmin(true)
        }
      }
    } catch (error) {
      console.error('Error checking admin role:', error)
    }
  }

  const items = [
    {href:'/dashboard',label:'Tổng quan',Icon:DashboardIcon},
    {href:'/market',label:'Thị trường',Icon:PublicIcon},
    {href:'/stocks',label:'Cổ phiếu',Icon:TrendingUpIcon},
    {href:'/signals',label:'Tín hiệu',Icon:BoltIcon},
    {href:'/chat',label:'Kiếm tiền đi chợ',Icon:ChatBubbleIcon},
    {href:'/profile',label:'Cá nhân',Icon:PersonIcon}
  ]

  return (
    <aside className="w-52 lg:w-56 hidden md:block bg-[--panel] border-r border-gray-800 min-h-screen p-3 lg:p-4 flex-shrink-0">
      <div className="mb-4 lg:mb-5 flex items-center gap-2">
        <Image
          src="/logo.png"
          alt="CPLS Logo"
          width={40}
          height={40}
          className="w-8 h-8 lg:w-9 lg:h-9"
          priority
        />
        <div className="text-white font-semibold text-sm lg:text-base">CPLS</div>
      </div>
      <nav className="space-y-1">
        {items.map(i => (
          <Link
            key={i.href}
            href={i.href}
            className="flex items-center py-2 lg:py-2.5 px-2 lg:px-3 rounded hover:bg-gray-800 text-gray-200 transition-colors relative text-sm"
          >
            <i.Icon sx={{ fontSize: { xs: 20, lg: 22 } }} />
            <span className="ml-2">{i.label}</span>
            {i.href === '/chat' && unreadCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        ))}

        {/* Admin Menu - Only visible to admin/mod */}
        {isAdmin && (
          <>
            <div className="my-3 border-t border-gray-700"></div>
            <Link
              href="/admin"
              className="flex items-center py-2 lg:py-2.5 px-2 lg:px-3 rounded bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-400 transition-colors text-sm"
            >
              <AdminPanelSettingsIcon sx={{ fontSize: { xs: 20, lg: 22 } }} />
              <span className="ml-2 font-semibold">Admin Dashboard</span>
            </Link>
            <Link
              href="/management"
              className="flex items-center py-2 lg:py-2.5 px-2 lg:px-3 rounded bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 transition-colors text-sm"
            >
              <SecurityIcon sx={{ fontSize: { xs: 20, lg: 22 } }} />
              <span className="ml-2 font-semibold">Quản lý</span>
            </Link>
          </>
        )}
      </nav>
    </aside>
  )
}
