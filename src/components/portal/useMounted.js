import { useEffect, useState } from 'react'

// Flips to true one frame after mount so width/stroke transitions animate in.
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return mounted
}
