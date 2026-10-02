import { useCallback, useEffect, useState } from 'react'

// Loads data from a (mock) service with loading / error / retry handling.
// `fetcher` must be referentially stable (module-level function or useCallback).
// State is only ever set from promise callbacks, never synchronously in the effect.
export function useMockQuery(fetcher) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fetcher().then(
      (data) => {
        if (active) setState({ status: 'success', data, error: null })
      },
      (error) => {
        if (active) setState({ status: 'error', data: null, error })
      }
    )
    return () => {
      active = false
    }
  }, [fetcher, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading', data: null, error: null })
    setAttempt((a) => a + 1)
  }, [])

  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }))
  }, [])

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    isLoading: state.status === 'loading',
    isError: state.status === 'error',
    retry,
    setData,
  }
}
