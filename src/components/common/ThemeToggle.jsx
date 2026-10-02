import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { cn } from '../../utils/cn'

export default function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      aria-pressed={theme === 'dark'}
      className={cn(
        'focus-ring group relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-500 transition-all duration-200 hover:bg-warning-50 hover:text-warning-600 active:scale-90 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-warning-300',
        className
      )}
    >
      {theme === 'dark' ? (
        <Sun size={18} className="transition-transform duration-500 group-hover:rotate-45" />
      ) : (
        <Moon size={18} className="transition-transform duration-500 group-hover:-rotate-12 group-hover:text-info-600" />
      )}
    </button>
  )
}
