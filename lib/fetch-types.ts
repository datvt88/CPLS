// Type definitions for Next.js fetch with revalidate option
// This extends the standard fetch to include Next.js-specific options

export interface NextFetchRequestInit extends RequestInit {
  next?: {
    revalidate?: number | false
    tags?: string[]
  }
}
