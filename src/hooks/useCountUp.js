import { useEffect, useRef, useState } from 'react'

export function useCountUp(target, { duration = 900 } = {}) {
  const [value, setValue] = useState(0)
  const frame = useRef(null)

  useEffect(() => {
    const numericTarget = Number(target) || 0
    const start = performance.now()
    const from = 0

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(from + (numericTarget - from) * eased)
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick)
      } else {
        setValue(numericTarget)
      }
    }

    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [target, duration])

  return value
}
