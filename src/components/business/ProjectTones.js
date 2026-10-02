// Shared colour helpers for the CRM, Projects and Tasks screens.
// Every class string is written out in full so Tailwind can detect it.

export const CHART_COLORS = ['#1aa996', '#ec4a7d', '#f59e0b', '#8654ec', '#0f7066', '#f96c98', '#22a559']

export const TONE_ORDER = ['brand', 'accent', 'info', 'warning', 'success']

// chip: tinted icon chip. text: coloured text. bar: solid fill. top: coloured top border.
export const TONES = {
  brand: {
    chip: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
    text: 'text-brand-600 dark:text-brand-300',
    bar: 'bg-brand-500',
    top: 'border-t-brand-500!',
    glow: 'from-brand-100/80 dark:from-brand-500/10',
    stroke: '#1aa996',
  },
  accent: {
    chip: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
    text: 'text-accent-600 dark:text-accent-300',
    bar: 'bg-accent-500',
    top: 'border-t-accent-500!',
    glow: 'from-accent-100/80 dark:from-accent-500/10',
    stroke: '#ec4a7d',
  },
  info: {
    chip: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
    text: 'text-info-600 dark:text-info-300',
    bar: 'bg-info-500',
    top: 'border-t-info-500!',
    glow: 'from-info-100/80 dark:from-info-500/10',
    stroke: '#8654ec',
  },
  warning: {
    chip: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
    text: 'text-warning-600 dark:text-warning-300',
    bar: 'bg-warning-500',
    top: 'border-t-warning-500!',
    glow: 'from-warning-100/80 dark:from-warning-500/10',
    stroke: '#f59e0b',
  },
  success: {
    chip: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
    text: 'text-success-600 dark:text-success-300',
    bar: 'bg-success-500',
    top: 'border-t-success-500!',
    glow: 'from-success-100/80 dark:from-success-500/10',
    stroke: '#22a559',
  },
  danger: {
    chip: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-300',
    text: 'text-danger-600 dark:text-danger-300',
    bar: 'bg-danger-500',
    top: 'border-t-danger-500!',
    glow: 'from-danger-100/80 dark:from-danger-500/10',
    stroke: '#e04a3c',
  },
  neutral: {
    chip: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    text: 'text-ink-600 dark:text-ink-300',
    bar: 'bg-ink-400',
    top: 'border-t-ink-300!',
    glow: 'from-ink-100/80 dark:from-ink-500/10',
    stroke: '#a0a9a2',
  },
}

export function toneAt(index) {
  return TONE_ORDER[index % TONE_ORDER.length]
}

// Kanban stage tone, keyed by the `dot` class used in utils/workspace.
export const DOT_TONE = {
  'bg-info-500': 'info',
  'bg-brand-500': 'brand',
  'bg-accent-500': 'accent',
  'bg-warning-500': 'warning',
  'bg-warning-600': 'warning',
  'bg-success-500': 'success',
  'bg-danger-500': 'danger',
  'bg-ink-400': 'neutral',
}

export function toneForDot(dot) {
  return DOT_TONE[dot] || 'neutral'
}

// Project status -> tone, used by cards, progress rings and headers.
export const PROJECT_STATUS_TONE = {
  planning: 'info',
  active: 'brand',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'danger',
}

export function progressTone(progress, status) {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'on_hold') return 'warning'
  if (progress >= 75) return 'success'
  if (progress >= 35) return 'brand'
  return 'accent'
}

// Priority accent for task/lead cards.
export const PRIORITY_ACCENT = {
  urgent: 'border-l-danger-500!',
  high: 'border-l-warning-500!',
  medium: 'border-l-brand-500!',
  low: 'border-l-ink-300! dark:border-l-ink-600!',
}

// Stagger helper for animate-slide-up grids.
export function stagger(index, step = 60, max = 8) {
  return { animationDelay: `${Math.min(index, max) * step}ms` }
}
