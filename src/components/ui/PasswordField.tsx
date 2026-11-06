import { useState } from 'react'
import { Check, Circle, Eye, EyeOff } from 'lucide-react'
import { passwordRules } from '../../lib/password'

export function PasswordField({ label, value, onChange, showRules, autoComplete }: { label: string; value: string; onChange: (value: string) => void; showRules?: boolean; autoComplete?: string }) {
  const [visible, setVisible] = useState(false)
  return <label className="password-field">
    {label}
    <div className="password-input-wrap">
      <input required type={visible ? 'text' : 'password'} minLength={showRules ? 8 : undefined} maxLength={showRules ? 70 : undefined} autoComplete={autoComplete} value={value} onChange={event => onChange(event.target.value)}/>
      <button type="button" className="password-toggle" tabIndex={-1} title={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(current => !current)}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
    </div>
    {showRules && <ul className="password-rules">{passwordRules(value).map(rule => <li key={rule.label} className={rule.met ? 'met' : ''}>{rule.met ? <Check size={13}/> : <Circle size={13}/>}<span>{rule.label}</span></li>)}</ul>}
  </label>
}
