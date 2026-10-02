import { useEffect, useState } from 'react'
import { Check, Monitor, Moon, Sun, Palette } from 'lucide-react'
import Card, { CardBody, CardHeader, CardTitle } from '../common/Card'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../context/ToastContext'
import { cn } from '../../utils/cn'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', description: 'Bright and clean', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: Moon },
  { value: 'system', label: 'System', description: 'Match your device', icon: Monitor },
]

const OPT_TINT = {
  light: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
  dark: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  system: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
}

const MODE_KEY = 'wf360-theme-mode'

function readStoredMode(fallback) {
  try {
    if (window.localStorage.getItem(MODE_KEY) === 'system') return 'system'
  } catch {
    // storage unavailable - fall back to the active theme
  }
  return fallback
}

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Light / dark / system picker shared by the admin settings and the account settings pages.
export default function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [mode, setMode] = useState(() => readStoredMode(theme))

  // While in 'system' mode, keep following the device preference as it changes.
  useEffect(() => {
    if (mode !== 'system' || !window.matchMedia) return undefined
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => setTheme(mql.matches ? 'dark' : 'light')
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [mode, setTheme])

  function choose(value) {
    setMode(value)
    try {
      window.localStorage.setItem(MODE_KEY, value)
    } catch {
      // ignore storage failures
    }
    setTheme(value === 'system' ? systemTheme() : value)
    toast.success(`Appearance set to ${THEME_OPTIONS.find((o) => o.value === value).label}`)
  }

  return (
    <Card className="animate-slide-up rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300">
            <Palette size={16} />
          </span>
          Theme
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((opt) => {
            const active = mode === opt.value
            const Icon = opt.icon
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(opt.value)}
                className={cn(
                  'focus-ring relative flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 sm:flex-col sm:items-start',
                  active ? 'border-brand-500 bg-brand-50 shadow-glow dark:border-brand-400 dark:bg-brand-500/10' : 'border-ink-200 hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-card-hover dark:border-ink-700 dark:hover:bg-ink-800/60'
                )}
              >
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', active ? 'gradient-brand bg-brand-600 text-white' : OPT_TINT[opt.value])}>
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-ink-800 dark:text-ink-100">{opt.label}</span>
                  <span className="block text-xs text-ink-500">{opt.description}</span>
                </span>
                {active && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                    <Check size={12} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-4 text-xs text-ink-500">{mode === 'system' ? `Following your device setting (currently ${theme}).` : 'Your choice is remembered on this device.'}</p>
      </CardBody>
    </Card>
  )
}
