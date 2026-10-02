import { useCallback, useEffect, useState } from 'react'

// Simulates an async data fetch so portal pages can show a skeleton, an error
// state with Retry, and then content - exactly what a real API call would
// produce. Returns { isLoading, isError, retry }.
// Append `?simulate=error` to any portal URL to see the error state once
// (Retry then succeeds).
function shouldSimulateError() {
  try {
    return new URLSearchParams(window.location.search).get('simulate') === 'error'
  } catch {
    return false
  }
}

export function usePortalLoad({ delay = 650 } = {}) {
  const [state, setState] = useState(() => ({ status: 'loading', attempt: 0, simulateError: shouldSimulateError() }))

  useEffect(() => {
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, status: prev.simulateError && prev.attempt === 0 ? 'error' : 'ready' }))
    }, delay)
    return () => clearTimeout(timer)
  }, [state.attempt, delay])

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading', attempt: prev.attempt + 1 }))
  }, [])

  return { isLoading: state.status === 'loading', isError: state.status === 'error', retry }
}
