'use client'

import { ThemeProvider } from 'next-themes'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { SWRConfig } from 'swr'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          shouldRetryOnError: false,
        }}
      >
        <AuthProvider>
          <PermissionsProvider>
            {children}
          </PermissionsProvider>
        </AuthProvider>
      </SWRConfig>
    </ThemeProvider>
  )
}
