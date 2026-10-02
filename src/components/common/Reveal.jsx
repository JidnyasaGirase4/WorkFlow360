import { useInView } from '../../hooks/useInView'
import { cn } from '../../utils/cn'

export default function Reveal({ as: Component = 'div', delay = 0, className, children, ...props }) {
  const [ref, inView] = useInView()
  return (
    <Component
      ref={ref}
      className={cn('transition-all duration-700 ease-out', inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0', className)}
      style={{ transitionDelay: `${delay}ms` }}
      {...props}
    >
      {children}
    </Component>
  )
}
