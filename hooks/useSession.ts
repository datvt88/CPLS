'use client'

import useSWR from 'swr'
import { authService } from '@/services/auth.service'
import { Session, User } from '@supabase/supabase-js'

interface UseSessionReturn {
  session: Session | null
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  refresh: () => Promise<void>
}

// 1. Định nghĩa Fetcher
const fetchSession = async () => {
  const { session, error } = await authService.getSession()
  if (error) throw error
  return session
}

/**
 * Custom hook to get current session and user
 * Uses SWR for automatic caching, revalidation, and consistency
 */
export function useSession(): UseSessionReturn {
  // 2. Sử dụng SWR để quản lý state
  // Key 'session-swr' giúp đồng bộ dữ liệu khắp ứng dụng
  const { data: session, error, isLoading, mutate } = useSWR('session-swr', fetchSession, {
    // Tận dụng cache của authService, không cần fetch quá nhiều
    // Nhưng vẫn đảm bảo cập nhật khi focus lại tab
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
    
    // Fallback data an toàn
    fallbackData: null 
  })

  // 3. Listener lắng nghe sự kiện Auth từ Supabase (để update SWR cache ngay lập tức)
  // Trick: Dùng useSWRSubscription hoặc đơn giản là useEffect để subscribe
  // Ở đây dùng cách đơn giản nhất kết hợp với SWR
  /* Lưu ý: authService đã có listener bên trong để update sessionCache.
     Khi SWR gọi lại fetchSession, nó sẽ lấy từ cache đó cực nhanh.
     Tuy nhiên, để UI phản hồi tức thì khi bấm Logout/Login, ta vẫn nên mutate.
  */

  const user = session?.user ?? null
  const isAuthenticated = !!user

  return {
    session: session ?? null,
    user,
    loading: isLoading,
    isAuthenticated,
    refresh: async () => { await mutate() } // Hàm để ép refresh thủ công
  }
}

/**
 * Hook to check if user is authenticated
 */
export function useAuth() {
  const { isAuthenticated, loading } = useSession()
  return { isAuthenticated, loading }
}
