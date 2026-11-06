import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => <select ref={ref} {...props}/>)
Select.displayName = 'Select'
