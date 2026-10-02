import { useState } from 'react'

// Runs `reset` during render whenever any value in `deps` changes. React allows
// a component to set its own state while rendering, which avoids the extra
// commit + cascading render that a setState-in-useEffect would cause.
// Pass { immediate: true } to also run on the first render.
export function useResetOnChange(deps, reset, { immediate = false } = {}) {
  const [prev, setPrev] = useState(immediate ? null : deps)
  const changed = prev === null || deps.length !== prev.length || deps.some((d, i) => !Object.is(d, prev[i]))
  if (changed) {
    setPrev(deps)
    reset()
  }
}
