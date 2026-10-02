import { useCallback, useEffect, useState } from 'react'

// Loads data from a (mock) service with loading / ready / error status and a
// retry function. `loader` must be a stable reference (module-level function
// or useCallback). Append ?error=1 to the URL to preview the error state on
// the first attempt.
export function useMockLoad(loader) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ attempt: -1, status: 'loading', data: null })

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => {
        const simulate = new URLSearchParams(window.location.search).get('error') === '1'
        if (simulate && attempt === 0) throw new Error('Simulated failure')
        return loader()
      })
      .then((data) => {
        if (active) setResult({ attempt, status: 'ready', data })
      })
      .catch(() => {
        if (active) setResult({ attempt, status: 'error', data: null })
      })
    return () => {
      active = false
    }
  }, [attempt, loader])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  const current = result.attempt === attempt
  return {
    status: current ? result.status : 'loading',
    data: current ? result.data : null,
    retry,
  }
}
