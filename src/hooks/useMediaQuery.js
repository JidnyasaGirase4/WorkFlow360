import { useCallback, useSyncExternalStore } from 'react'

// Subscribes to a CSS media query without setState-in-effect.
// Returns false during SSR / when matchMedia is unavailable.
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query]
  )
  const getSnapshot = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false)
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

// Tailwind `sm` breakpoint is 640px, so "mobile" is anything narrower.
export function useIsMobile() {
  return useMediaQuery('(max-width: 639px)')
}

export function usePrefersReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
