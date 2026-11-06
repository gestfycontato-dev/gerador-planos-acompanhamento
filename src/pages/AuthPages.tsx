import { useState } from 'react'
import { Map, Settings } from 'lucide-react'
import { auth } from '../supabase'
import type { AuthSession } from '../supabase'
import { errorMessage } from '../lib/format'
import { isStrongPassword } from '../lib/password'
import { Button } from '../components/ui/Button'
import { PasswordField } from '../components/ui/PasswordField'

export function LoadingScreen() { return <div className="auth-shell"><div className="auth-card"><div className="auth-symbol"><Map size={26}/></div><h1>Gerador de Planos</h1><p>Carregando os dados da clínica...</p></div></div> }

export function SetupError() { return <div className="auth-shell"><div className="auth-card"><div className="auth-symbol"><Settings size={26}/></div><h1>Configuração necessária</h1><p>Preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local.</p></div></div> }

export function LoadError({ message, retry, onSignOut }: { message: string; retry: () => void; onSignOut: () => void }) { return <div className="auth-shell"><div className="auth-card"><h1>Não foi possível carregar</h1><p className="auth-error">{message}</p><Button variant="primary" onClick={retry}>Tentar novamente</Button><Button variant="ghost" onClick={onSignOut}>Sair da conta</Button></div></div> }

export function AuthPage({ onAuthenticated, initialMode, initialMessage }: { onAuthenticated: (session: AuthSession) => void; initialMode?: 'login' | 'signup' | 'reset'; initialMessage?: string }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode ?? 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(initialMessage ?? '')
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setMessage(''); try { if (mode === 'login') { onAuthenticated(await auth.signIn(email, password)) } else if (mode === 'signup') { const result = await auth.signUp(email, password, name); if (result.access_token) onAuthenticated(result as AuthSession); else setMessage('Cadastro realizado. Confira seu e-mail para confirmar a conta e depois entre no sistema.') } else { await auth.requestPasswordReset(email); setMessage('Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.') } } catch (error) { setMessage(errorMessage(error)) } finally { setBusy(false) } }
  const titles = { login: 'Entrar no Gerador de Planos', signup: 'Criar acesso do médico', reset: 'Recuperar acesso' }
  const subtitles = { login: 'Acesse os dados da sua clínica com segurança.', signup: 'O médico será o responsável pela conta da clínica.', reset: 'Informe seu e-mail para receber um link de redefinição de senha.' }
  const submitDisabled = busy || (mode === 'signup' && !isStrongPassword(password))
  return <div className="auth-shell"><form className="auth-card" onSubmit={submit}><div className="auth-symbol"><Map size={26}/></div><span className="eyebrow">POWERED BY GESTFY</span><h1>{titles[mode]}</h1><p>{subtitles[mode]}</p>{mode === 'signup' && <label>Nome completo<input required value={name} onChange={event => setName(event.target.value)}/></label>}<label>E-mail<input required type="email" value={email} onChange={event => setEmail(event.target.value)}/></label>{mode !== 'reset' && <PasswordField label="Senha" value={password} onChange={setPassword} showRules={mode === 'signup'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}/>}{mode === 'login' && <button className="auth-switch" type="button" onClick={() => { setMode('reset'); setMessage('') }}>Esqueci minha senha</button>}{message && <div className="auth-message">{message}</div>}<Button variant="primary" className="auth-submit" disabled={submitDisabled}>{busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link de recuperação'}</Button><button className="auth-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>{mode === 'reset' ? 'Voltar para o login' : mode === 'login' ? 'Primeiro acesso? Criar conta' : 'Já possui conta? Entrar'}</button></form></div>
}

export function ResetPasswordPage({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (password !== confirmPassword) { setMessage('As senhas não coincidem.'); return } setBusy(true); setMessage(''); try { await auth.updatePassword(password); await auth.signOut(); setDone(true) } catch (error) { setMessage(errorMessage(error)) } finally { setBusy(false) } }
  if (done) return <div className="auth-shell"><div className="auth-card"><div className="auth-symbol"><Map size={26}/></div><h1>Senha atualizada</h1><p>Sua senha foi redefinida. Entre novamente com a nova senha.</p><Button variant="primary" className="auth-submit" onClick={onDone}>Ir para o login</Button></div></div>
  return <div className="auth-shell"><form className="auth-card" onSubmit={submit}><div className="auth-symbol"><Map size={26}/></div><span className="eyebrow">POWERED BY GESTFY</span><h1>Definir nova senha</h1><p>Escolha uma nova senha para acessar sua conta.</p><PasswordField label="Nova senha" value={password} onChange={setPassword} showRules autoComplete="new-password"/><PasswordField label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password"/>{message && <div className="auth-message">{message}</div>}<Button variant="primary" className="auth-submit" disabled={busy || !isStrongPassword(password)}>{busy ? 'Aguarde...' : 'Salvar nova senha'}</Button></form></div>
}
