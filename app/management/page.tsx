'use client'

import { useState, useEffect } from 'react'
import AdminRoute from '@/components/AdminRoute'
import { profileService, type Profile, type MembershipTier, type UserRole } from '@/services/profile.service'
import { supabase } from '@/lib/supabaseClient'

function ManagementPageContent() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    premiumUsers: 0,
    freeUsers: 0,
    adminCount: 0,
    modCount: 0
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const [membershipFilter, setMembershipFilter] = useState<MembershipTier | ''>('')

  // Edit Modal
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState({
    full_name: '',
    nickname: '',
    phone_number: '',
    email: '',
    role: 'user' as UserRole,
    membership: 'free' as MembershipTier,
    membership_expires_at: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    email: '',
    phone_number: '',
    password: '',
    full_name: '',
    nickname: '',
    role: 'user' as UserRole,
    membership: 'free' as MembershipTier,
    membership_expires_at: ''
  })
  const [creating, setCreating] = useState(false)
  const [createMessage, setCreateMessage] = useState('')
  const [passwordCopied, setPasswordCopied] = useState(false)

  useEffect(() => {
    loadStats()
    loadUsers()
  }, [currentPage, roleFilter, membershipFilter, searchQuery])

  const loadStats = async () => {
    const stats = await profileService.getUserStats()
    setStats(stats)
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const { users: data, error, total: totalCount, totalPages: pages } = await profileService.getAllUsers({
        page: currentPage,
        limit: 20,
        role: roleFilter || undefined,
        membership: membershipFilter || undefined,
        search: searchQuery || undefined
      })

      if (error) {
        console.error('Error loading users:', error)
      } else if (data) {
        setUsers(data)
        setTotal(totalCount)
        setTotalPages(pages)
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCreateForm({ ...createForm, password })
    setPasswordCopied(false)
  }

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(createForm.password)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy password:', error)
    }
  }

  const handleOpenCreateModal = () => {
    setShowCreateModal(true)
    setCreateForm({
      email: '',
      phone_number: '',
      password: '',
      full_name: '',
      nickname: '',
      role: 'user',
      membership: 'free',
      membership_expires_at: ''
    })
    setCreateMessage('')
    setPasswordCopied(false)
  }

  const handleCreateUser = async () => {
    setCreating(true)
    setCreateMessage('')

    try {
      // Validate
      if (!createForm.email || !createForm.phone_number || !createForm.password) {
        setCreateMessage('Vui lòng điền đầy đủ Email, Số điện thoại và Mật khẩu')
        setCreating(false)
        return
      }

      // Get current session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setCreateMessage('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại')
        setCreating(false)
        return
      }

      // Call API to create user
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email: createForm.email,
          phone_number: createForm.phone_number,
          password: createForm.password,
          full_name: createForm.full_name || undefined,
          nickname: createForm.nickname || undefined,
          role: createForm.role,
          membership: createForm.membership,
          membership_expires_at: createForm.membership_expires_at || undefined
        })
      })

      const result = await response.json()

      if (!response.ok) {
        setCreateMessage(result.error || 'Có lỗi xảy ra')
        setCreating(false)
        return
      }

      setCreateMessage('✅ Tạo người dùng thành công!')
      setTimeout(() => {
        setShowCreateModal(false)
        loadUsers()
        loadStats()
      }, 1500)
    } catch (error: any) {
      console.error('Error creating user:', error)
      setCreateMessage(error.message || 'Có lỗi xảy ra')
    } finally {
      setCreating(false)
    }
  }

  const handleEditUser = (user: Profile) => {
    setEditingUser(user)
    setEditForm({
      full_name: user.full_name || '',
      nickname: user.nickname || '',
      phone_number: user.phone_number || '',
      email: user.email,
      role: user.role,
      membership: user.membership,
      membership_expires_at: user.membership_expires_at || ''
    })
    setMessage('')
  }

  const handleSaveUser = async () => {
    if (!editingUser) return

    setSaving(true)
    setMessage('')

    try {
      // Update basic info
      const { error: updateError } = await profileService.updateUserByAdmin(editingUser.id, {
        full_name: editForm.full_name || undefined,
        nickname: editForm.nickname || undefined,
        phone_number: editForm.phone_number || undefined,
        email: editForm.email
      })

      if (updateError) throw updateError

      // Update role
      if (editForm.role !== editingUser.role) {
        const { error: roleError } = await profileService.updateUserRole(editingUser.id, editForm.role)
        if (roleError) throw roleError
      }

      // Update membership
      if (editForm.membership !== editingUser.membership || editForm.membership_expires_at !== editingUser.membership_expires_at) {
        const { error: membershipError } = await profileService.updateUserMembershipByAdmin(
          editingUser.id,
          editForm.membership,
          editForm.membership_expires_at || undefined
        )
        if (membershipError) throw membershipError
      }

      setMessage('Cập nhật thành công!')
      setTimeout(() => {
        setEditingUser(null)
        loadUsers()
        loadStats()
      }, 1000)
    } catch (error: any) {
      console.error('Error updating user:', error)
      setMessage(error.message || 'Có lỗi xảy ra')
    } finally {
      setSaving(false)
    }
  }

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/20 text-red-400 border border-red-500/50'
      case 'mod':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
      default:
        return 'bg-gray-700 text-gray-300'
    }
  }

  const getMembershipBadge = (membership: MembershipTier) => {
    return membership === 'premium'
      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
      : 'bg-green-500/30 text-green-400 border border-green-500/50'
  }

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[--bg] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-[--fg]">Quản lý User</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenCreateModal}
                className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-green-600/50 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tạo người dùng mới
              </button>
              <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full text-sm font-semibold border border-red-500/50">
                🛡️ Admin Panel
              </span>
            </div>
          </div>
          <p className="text-[--muted]">Quản lý tài khoản, quyền hạn và gói đăng ký của người dùng</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-[--panel] p-6 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[--muted] text-sm">Tổng Users</p>
                <p className="text-2xl font-bold text-[--fg]">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-[--panel] p-6 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <p className="text-[--muted] text-sm">Premium</p>
                <p className="text-2xl font-bold text-purple-400">{stats.premiumUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-[--panel] p-6 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-[--muted] text-sm">Free</p>
                <p className="text-2xl font-bold text-green-400">{stats.freeUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-[--panel] p-6 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-[--muted] text-sm">Admins</p>
                <p className="text-2xl font-bold text-red-400">{stats.adminCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-[--panel] p-6 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-[--muted] text-sm">Moderators</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.modCount}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[--panel] p-6 rounded-xl border border-gray-800 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">Tìm kiếm</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Tìm theo email, tên, nickname..."
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
              />
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">Lọc theo quyền</label>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value as UserRole | '')
                  setCurrentPage(1)
                }}
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
              >
                <option value="">Tất cả quyền</option>
                <option value="user">User</option>
                <option value="mod">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Membership Filter */}
            <div>
              <label className="block text-[--fg] text-sm font-medium mb-2">Lọc theo gói</label>
              <select
                value={membershipFilter}
                onChange={(e) => {
                  setMembershipFilter(e.target.value as MembershipTier | '')
                  setCurrentPage(1)
                }}
                className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
              >
                <option value="">Tất cả gói</option>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[--panel] rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[--bg] border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--muted] uppercase tracking-wider">
                    Người dùng
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--muted] uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--muted] uppercase tracking-wider">
                    Quyền
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--muted] uppercase tracking-wider">
                    Gói
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[--muted] uppercase tracking-wider">
                    Ngày tham gia
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-[--muted] uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[--bg] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name || user.email}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-semibold">
                            {(user.full_name || user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-[--fg] font-medium">{user.full_name || user.nickname || 'Chưa có tên'}</p>
                          {user.nickname && user.full_name && (
                            <p className="text-[--muted] text-sm">@{user.nickname}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-[--fg]">{user.email}</p>
                      {user.provider && (
                        <p className="text-[--muted] text-xs mt-1">via {user.provider}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadge(user.role)}`}>
                        {user.role === 'admin' ? '🛡️ Admin' : user.role === 'mod' ? '⚠️ Mod' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getMembershipBadge(user.membership)}`}>
                        {user.membership === 'premium' ? '⭐ Premium' : 'Free'}
                      </span>
                      {user.membership === 'premium' && user.membership_expires_at && (
                        <p className="text-[--muted] text-xs mt-1">
                          đến {new Date(user.membership_expires_at).toLocaleDateString('vi-VN')}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[--muted] text-sm">
                      {new Date(user.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-purple-400 hover:text-purple-300 font-medium text-sm inline-flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Chỉnh sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-[--bg] border-t border-gray-800 flex items-center justify-between">
              <p className="text-[--muted] text-sm">
                Hiển thị {users.length} / {total} người dùng
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-[--panel] border border-gray-800 rounded-lg text-[--fg] hover:bg-[--bg] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Trước
                </button>
                <span className="px-4 py-2 text-[--fg]">
                  Trang {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-[--panel] border border-gray-800 rounded-lg text-[--fg] hover:bg-[--bg] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[--panel] rounded-xl border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-[--fg]">➕ Tạo người dùng mới</h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-[--muted] hover:text-[--fg] transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-[--fg]"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">
                    Số điện thoại <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    value={createForm.phone_number}
                    onChange={(e) => setCreateForm({ ...createForm, phone_number: e.target.value })}
                    placeholder="0901234567"
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-[--fg]"
                  />
                  <p className="text-[--muted] text-xs mt-1">Người dùng sẽ đăng nhập bằng số điện thoại này</p>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">
                    Mật khẩu <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      placeholder="Nhập mật khẩu hoặc tạo tự động"
                      className="flex-1 p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-[--fg] font-mono"
                    />
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                    >
                      🎲 Tạo tự động
                    </button>
                    <button
                      type="button"
                      onClick={copyPassword}
                      disabled={!createForm.password}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {passwordCopied ? '✅ Đã copy' : '📋 Copy'}
                    </button>
                  </div>
                  <p className="text-[--muted] text-xs mt-1">Tối thiểu 6 ký tự. Click "Copy" để gửi cho người dùng.</p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Họ và tên</label>
                  <input
                    type="text"
                    value={createForm.full_name}
                    onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-[--fg]"
                  />
                </div>

                {/* Nickname */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Nickname</label>
                  <input
                    type="text"
                    value={createForm.nickname}
                    onChange={(e) => setCreateForm({ ...createForm, nickname: e.target.value })}
                    placeholder="nguyenvana"
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-[--fg]"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Quyền</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-[--fg]"
                  >
                    <option value="user">User (Người dùng thường)</option>
                    <option value="mod">Moderator (Quản lý nội dung)</option>
                    <option value="admin">Admin (Toàn quyền)</option>
                  </select>
                </div>

                {/* Membership */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Gói đăng ký</label>
                  <select
                    value={createForm.membership}
                    onChange={(e) => setCreateForm({ ...createForm, membership: e.target.value as MembershipTier })}
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-[--fg]"
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                {/* Expiry Date (Premium only) */}
                {createForm.membership === 'premium' && (
                  <div>
                    <label className="block text-[--fg] text-sm font-medium mb-2">
                      Ngày hết hạn Premium (để trống = vĩnh viễn)
                    </label>
                    <input
                      type="date"
                      value={createForm.membership_expires_at ? new Date(createForm.membership_expires_at).toISOString().split('T')[0] : ''}
                      onChange={(e) => setCreateForm({ ...createForm, membership_expires_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                      className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 text-[--fg]"
                    />
                  </div>
                )}

                {/* Message */}
                {createMessage && (
                  <div
                    className={`p-4 rounded-lg text-center font-medium ${
                      createMessage.includes('✅')
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : 'bg-red-500/20 text-red-400 border border-red-500/50'
                    }`}
                  >
                    {createMessage}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-800 flex gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-[--bg] border border-gray-800 text-[--fg] rounded-lg hover:bg-[--panel] transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={creating}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-green-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Đang tạo...' : '✅ Tạo người dùng'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[--panel] rounded-xl border border-gray-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-[--fg]">Chỉnh sửa người dùng</h2>
                  <button
                    onClick={() => setEditingUser(null)}
                    className="text-[--muted] hover:text-[--fg] transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {/* User Info */}
                <div className="flex items-center gap-4 p-4 bg-[--bg] rounded-lg">
                  {editingUser.avatar_url ? (
                    <img
                      src={editingUser.avatar_url}
                      alt={editingUser.full_name || editingUser.email}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-2xl font-semibold">
                      {(editingUser.full_name || editingUser.email)[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-[--fg] font-semibold">{editingUser.full_name || editingUser.email}</p>
                    <p className="text-[--muted] text-sm">ID: {editingUser.id.slice(0, 8)}...</p>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Họ và tên</label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
                  />
                </div>

                {/* Nickname */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Nickname</label>
                  <input
                    type="text"
                    value={editForm.nickname}
                    onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Số điện thoại</label>
                  <input
                    type="tel"
                    value={editForm.phone_number}
                    onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Quyền</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
                  >
                    <option value="user">User</option>
                    <option value="mod">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {/* Membership */}
                <div>
                  <label className="block text-[--fg] text-sm font-medium mb-2">Gói đăng ký</label>
                  <select
                    value={editForm.membership}
                    onChange={(e) => setEditForm({ ...editForm, membership: e.target.value as MembershipTier })}
                    className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>

                {/* Expiry Date (Premium only) */}
                {editForm.membership === 'premium' && (
                  <div>
                    <label className="block text-[--fg] text-sm font-medium mb-2">
                      Ngày hết hạn Premium (để trống = vĩnh viễn)
                    </label>
                    <input
                      type="date"
                      value={editForm.membership_expires_at ? new Date(editForm.membership_expires_at).toISOString().split('T')[0] : ''}
                      onChange={(e) => setEditForm({ ...editForm, membership_expires_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                      className="w-full p-3 bg-[--bg] border border-[--border] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-[--fg]"
                    />
                  </div>
                )}

                {/* Message */}
                {message && (
                  <div
                    className={`p-4 rounded-lg text-center font-medium ${
                      message.includes('thành công')
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                        : 'bg-red-500/20 text-red-400 border border-red-500/50'
                    }`}
                  >
                    {message}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-800 flex gap-3">
                <button
                  onClick={() => setEditingUser(null)}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-[--bg] border border-gray-800 text-[--fg] rounded-lg hover:bg-[--panel] transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={saving}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-purple-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ManagementPage() {
  return (
    <AdminRoute>
      <ManagementPageContent />
    </AdminRoute>
  )
}
