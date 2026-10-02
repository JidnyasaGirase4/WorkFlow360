// Shared tone maps for the Employee panel and Client portal (tokens only).
export const TONES = {
  brand: {
    chip: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
    text: 'text-brand-600 dark:text-brand-300',
    glow: 'bg-brand-200/60 dark:bg-brand-500/15',
    bar: 'from-brand-400 to-brand-600',
    dot: 'bg-brand-500',
    soft: 'bg-brand-50/70 dark:bg-brand-500/10',
    border: 'border-l-brand-500',
    color: 'var(--color-brand-500)',
  },
  accent: {
    chip: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
    text: 'text-accent-600 dark:text-accent-300',
    glow: 'bg-accent-200/60 dark:bg-accent-500/15',
    bar: 'from-accent-300 to-accent-500',
    dot: 'bg-accent-500',
    soft: 'bg-accent-50/70 dark:bg-accent-500/10',
    border: 'border-l-accent-500',
    color: 'var(--color-accent-500)',
  },
  info: {
    chip: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
    text: 'text-info-600 dark:text-info-300',
    glow: 'bg-info-200/60 dark:bg-info-500/15',
    bar: 'from-info-300 to-info-500',
    dot: 'bg-info-500',
    soft: 'bg-info-50/70 dark:bg-info-500/10',
    border: 'border-l-info-500',
    color: 'var(--color-info-500)',
  },
  success: {
    chip: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
    text: 'text-success-600 dark:text-success-300',
    glow: 'bg-success-200/60 dark:bg-success-500/15',
    bar: 'from-success-300 to-success-500',
    dot: 'bg-success-500',
    soft: 'bg-success-50/70 dark:bg-success-500/10',
    border: 'border-l-success-500',
    color: 'var(--color-success-500)',
  },
  warning: {
    chip: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
    text: 'text-warning-600 dark:text-warning-300',
    glow: 'bg-warning-200/60 dark:bg-warning-500/15',
    bar: 'from-warning-300 to-warning-500',
    dot: 'bg-warning-500',
    soft: 'bg-warning-50/70 dark:bg-warning-500/10',
    border: 'border-l-warning-500',
    color: 'var(--color-warning-500)',
  },
  danger: {
    chip: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-300',
    text: 'text-danger-600 dark:text-danger-300',
    glow: 'bg-danger-200/60 dark:bg-danger-500/15',
    bar: 'from-danger-300 to-danger-500',
    dot: 'bg-danger-500',
    soft: 'bg-danger-50/70 dark:bg-danger-500/10',
    border: 'border-l-danger-500',
    color: 'var(--color-danger-500)',
  },
  neutral: {
    chip: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    text: 'text-ink-600 dark:text-ink-300',
    glow: 'bg-ink-200/60 dark:bg-ink-700/30',
    bar: 'from-ink-300 to-ink-400',
    dot: 'bg-ink-400',
    soft: 'bg-ink-50 dark:bg-ink-800/40',
    border: 'border-l-ink-300',
    color: 'var(--color-ink-400)',
  },
}

export const toneOf = (tone) => TONES[tone] || TONES.brand

// Priority -> tone key (used for accents on task/ticket rows).
export const PRIORITY_TONE_KEY = { urgent: 'danger', high: 'warning', medium: 'brand', low: 'neutral' }

// Rotating tones so a row of cards is colourful but coherent.
export const ROTATION = ['brand', 'accent', 'warning', 'info', 'success']

// Inline style for staggered entrance animation (pair with `animate-slide-up`).
export const stagger = (index, step = 60) => ({ animationDelay: `${Math.min(index, 12) * step}ms` })

// File type -> tone for document tiles.
export const FILE_TONE = { pdf: 'danger', doc: 'brand', sheet: 'success', image: 'accent', design: 'info', archive: 'warning' }
