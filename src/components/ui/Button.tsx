import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost' | 'danger' | 'soft'

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(
  ({ variant, className, ...props }, ref) => (
    <button ref={ref} className={`button ${variant ?? ''} ${className ?? ''}`.trim()} {...props}/>
  )
)
Button.displayName = 'Button'
