import { useCallback, useEffect, useState } from 'react'

// Loads data from an async function and exposes { data, loading, error, reload }.
// `key` identifies the request: whenever it changes a new load starts and
// `loading` becomes true (derived — no setState inside the effect body).
export function useAsyncData(fetcher, key = 'default') {
  const [result, setResult] = useState({ token: null, data: null, error: null })
  const [nonce, setNonce] = useState(0)
  const token = `${key}#${nonce}`

  useEffect(() => {
    let active = true
    fetcher()
      .then((data) => {
        if (active) setResult({ token, data, error: null })
      })
      .catch((error) => {
        if (active) setResult({ token, data: null, error })
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const setData = useCallback(
    (updater) =>
      setResult((r) => ({ ...r, data: typeof updater === 'function' ? updater(r.data) : updater })),
    []
  )

  const loading = result.token !== token
  return {
    data: loading ? null : result.data,
    error: loading ? null : result.error,
    loading,
    reload,
    setData,
  }
}
