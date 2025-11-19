import { useEffect, RefObject } from 'react'

/**
 * Hook to trap focus within an element (e.g., modal, menu)
 * Improves accessibility for keyboard navigation
 *
 * @param elementRef - Ref to the element to trap focus within
 * @param isActive - Whether the focus trap is active
 */
export function useFocusTrap(elementRef: RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !elementRef.current) return

    const element = elementRef.current

    // Get all focusable elements
    const focusableElements = element.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )

    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    // Focus first element when trap activates
    firstFocusable?.focus()

    // Handle tab key
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab: moving backwards
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        // Tab: moving forward
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable?.focus()
        }
      }
    }

    element.addEventListener('keydown', handleTabKey)

    return () => {
      element.removeEventListener('keydown', handleTabKey)
    }
  }, [elementRef, isActive])
}
