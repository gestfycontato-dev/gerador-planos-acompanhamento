import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input ref={ref} {...props}/>)
Input.displayName = 'Input'
