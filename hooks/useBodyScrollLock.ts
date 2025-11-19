import { useEffect } from 'react'

/**
 * Hook to lock/unlock body scroll and prevent layout shift
 * Useful for modal dialogs, mobile menus, etc.
 *
 * @param isLocked - Whether to lock the body scroll
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (isLocked) {
      // Store original overflow value
      const originalOverflow = document.body.style.overflow
      const originalPaddingRight = document.body.style.paddingRight

      // Calculate scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

      // Lock scroll
      document.body.style.overflow = 'hidden'

      // Add padding to prevent layout shift when scrollbar disappears
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }

      return () => {
        // Restore original values
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
      }
    }
  }, [isLocked])
}
