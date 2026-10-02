import { departments } from '../../mockData/employees'

// Rotating tint set shared by the People pages (department chips, cards, bars).
// Every class string is spelled out so Tailwind can see it.
export const TINTS = [
  {
    key: 'brand',
    gradient: 'from-brand-400 to-brand-600',
    chip: 'bg-brand-50 text-brand-700 ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20',
    soft: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
    bar: 'from-brand-400 to-brand-600',
    corner: 'from-brand-100/80 dark:from-brand-500/10',
    hex: '#1aa996',
  },
  {
    key: 'accent',
    gradient: 'from-accent-400 to-accent-600',
    chip: 'bg-accent-50 text-accent-700 ring-accent-200/70 dark:bg-accent-500/15 dark:text-accent-300 dark:ring-accent-500/20',
    soft: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
    bar: 'from-accent-400 to-accent-600',
    corner: 'from-accent-100/80 dark:from-accent-500/10',
    hex: '#ec4a7d',
  },
  {
    key: 'warning',
    gradient: 'from-warning-300 to-warning-500',
    chip: 'bg-warning-50 text-warning-700 ring-warning-200/70 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/20',
    soft: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
    bar: 'from-warning-300 to-warning-500',
    corner: 'from-warning-100/80 dark:from-warning-500/10',
    hex: '#f59e0b',
  },
  {
    key: 'info',
    gradient: 'from-info-400 to-info-600',
    chip: 'bg-info-50 text-info-600 ring-info-200/70 dark:bg-info-500/15 dark:text-info-300 dark:ring-info-500/20',
    soft: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
    bar: 'from-info-400 to-info-600',
    corner: 'from-info-100/80 dark:from-info-500/10',
    hex: '#8654ec',
  },
  {
    key: 'success',
    gradient: 'from-success-400 to-success-600',
    chip: 'bg-success-50 text-success-700 ring-success-200/70 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/20',
    soft: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
    bar: 'from-success-400 to-success-600',
    corner: 'from-success-100/80 dark:from-success-500/10',
    hex: '#22a559',
  },
]

function hash(text = '') {
  return String(text)
    .split('')
    .reduce((sum, c) => sum + c.charCodeAt(0), 0)
}

// Stable tint for a string (e.g. a department name).
export function tintFor(text) {
  const idx = departments.indexOf(text)
  return TINTS[(idx >= 0 ? idx : hash(text)) % TINTS.length]
}

// Tint by position (rotating), for grids of cards.
export function tintAt(index) {
  return TINTS[index % TINTS.length]
}
