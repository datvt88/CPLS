'use client'

import { ThemeProvider } from 'next-themes'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
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
        <PermissionsProvider>
          {children}
        </PermissionsProvider>
      </SWRConfig>
    </ThemeProvider>
  )
}
