import { useTheme } from '../context/ThemeContext'

// Shared chart series palette (teal, rose, amber, violet, deep teal, coral, green).
export const CHART_PALETTE = ['#1aa996', '#ec4a7d', '#f59e0b', '#8654ec', '#0f7066', '#f96c98', '#22a559']

// Each dashboard has its own identity colours (see [data-panel] in index.css).
const PANEL_PALETTES = {
  employee: ['#ad4bd4', '#f9b724', '#1aa996', '#ec4a7d', '#782d96', '#f26d17', '#22a559'],
  client: ['#f26d17', '#1aa996', '#f9b724', '#ad4bd4', '#b3470e', '#ec4a7d', '#22a559'],
}

// Theme-aware colours for recharts primitives, which cannot use Tailwind classes.
export function useChartColors() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const panel = typeof document !== 'undefined' ? document.documentElement.dataset.panel : undefined
  const palette = PANEL_PALETTES[panel] || CHART_PALETTE
  return {
    dark,
    grid: dark ? '#2b332d' : '#e2e6e1',
    tick: dark ? '#a0a9a2' : '#737e76',
    cursor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(31,38,34,0.05)',
    surface: dark ? '#1f2622' : '#ffffff',
    palette,
    brand: palette[0],
    accent: palette[1],
  }
}
