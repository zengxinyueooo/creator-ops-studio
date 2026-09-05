import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface PillSelectOption {
  value: string
  label: string
}

export function PillSelect({ value, options, onChange, placeholder = '请选择', ariaLabel, menuAlign = 'left' }: {
  value: string
  options: PillSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  menuAlign?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOnPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnPointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnPointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const current = options.find((option) => option.value === value)

  return (
    <div className={open ? 'pill-select open' : 'pill-select'} ref={rootRef}>
      <button type="button" className="pill-select-trigger" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => setOpen((state) => !state)}>
        <span className={current ? 'pill-select-value' : 'pill-select-value placeholder'}>{current?.label ?? placeholder}</span>
        <ChevronDown size={15} className="pill-select-chevron" />
      </button>
      {open && (
        <div className={menuAlign === 'right' ? 'pill-select-menu align-right' : 'pill-select-menu'} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button key={option.value} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'active' : ''} onClick={() => { onChange(option.value); setOpen(false) }}>
              <span>{option.label}</span>
              {option.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
