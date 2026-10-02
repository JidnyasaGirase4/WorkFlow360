import { useInView } from '../../hooks/useInView'
import { useCountUp } from '../../hooks/useCountUp'
import { formatNumber } from '../../utils/format'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function Counter({ target, decimals, suffix, prefix }) {
  const value = useCountUp(target, { duration: 1400 })
  const shown = decimals > 0 ? value.toFixed(decimals) : formatNumber(Math.round(value))
  return (
    <>
      {prefix}
      {shown}
      {suffix}
    </>
  )
}

// Counts up from 0 the first time it scrolls into view (static when reduced motion is on).
export default function CountUp({ target, decimals = 0, suffix = '', prefix = '', className }) {
  const [ref, inView] = useInView({ threshold: 0.4 })
  const reduced = prefersReducedMotion()
  const finalText = `${prefix}${decimals > 0 ? Number(target).toFixed(decimals) : formatNumber(target)}${suffix}`
  return (
    <span ref={ref} className={className} aria-label={finalText}>
      {reduced ? finalText : inView ? <Counter target={target} decimals={decimals} suffix={suffix} prefix={prefix} /> : `${prefix}0${suffix}`}
    </span>
  )
}
