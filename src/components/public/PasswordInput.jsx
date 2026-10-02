import { forwardRef, useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import Input from '../common/Input'

// Password field with a show / hide toggle. Accepts every <Input> prop.
const PasswordInput = forwardRef(function PasswordInput({ leftIcon = <Lock size={16} />, ...props }, ref) {
  const [visible, setVisible] = useState(false)
  return (
    <Input
      ref={ref}
      {...props}
      type={visible ? 'text' : 'password'}
      leftIcon={leftIcon}
      rightElement={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="focus-ring flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  )
})

export default PasswordInput
