import { useState } from 'react'
import { FileText, Stethoscope, Users } from 'lucide-react'
import { extractBrandColors } from '../extractBrandColors'
import { digits, maskCep, maskCnpj, maskCrm, maskPhone, normalizeEmail, validEmail } from '../lib/masks'
import type { ClinicProfile } from '../types'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'

export function SettingsPage({ clinic, saveClinic, uploadLogo: uploadLogoFile, notify, onSaved }: { clinic: ClinicProfile; saveClinic: (clinic: ClinicProfile) => Promise<boolean>; uploadLogo: (file: File) => Promise<string | null>; notify: (s: string) => void; onSaved: () => void }) {
  const [form, setForm] = useState({ ...clinic })
  const [profile, setProfile] = useState({ name: '', email: '', role: 'Administrador' })
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState('')
  const save = async () => { if (!validEmail(form.email) || !validEmail(form.doctorEmail)) { notify('Confira os e-mails informados'); return } if (await saveClinic(form)) onSaved() }
  const uploadLogo = async (file: File | undefined) => { if (!file) return; const [url, extracted] = await Promise.all([uploadLogoFile(file), extractBrandColors(file)]); if (url) setForm(current => ({ ...current, logo: url, brandPrimary: extracted?.primary ?? current.brandPrimary, brandSecondary: extracted?.secondary ?? current.brandSecondary })) }
  const lookupCep = async (value: string) => { const cep = digits(value); if (cep.length !== 8) return; setCepLoading(true); setCepError(''); try { const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`); const data = await response.json(); if (data.erro) throw new Error(); setForm(current => ({ ...current, zipCode: maskCep(cep), address: [data.logradouro, data.bairro].filter(Boolean).join(', '), city: data.localidade ?? '', state: data.uf ?? '' })) } catch { setCepError('CEP não encontrado. Preencha o endereço manualmente.') } finally { setCepLoading(false) } }
  return <div className="page settings-page">
    <PageHeader kicker="CONFIGURAÇÕES" title="Preferências da conta" subtitle="Mantenha os dados da clínica, identidade visual e prescritor atualizados."/>
    <section className="settings-card card">
      <div className="settings-title"><div className="settings-icon"><Stethoscope size={20}/></div><div><h3>Dados da clínica</h3><p>Informações usadas nos planos, contratos e comunicações.</p></div></div>
      <div className="form-grid">
        <Field label="Nome de exibição"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></Field>
        <Field label="Razão social completa"><input value={form.legalName} onChange={e => setForm({ ...form, legalName: e.target.value })}/></Field>
        <Field label="CNPJ"><input inputMode="numeric" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e => setForm({ ...form, cnpj: maskCnpj(e.target.value) })}/></Field>
        <Field label="Telefone com DDD"><input inputMode="tel" placeholder="(00) 00000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: maskPhone(e.target.value) })}/></Field>
        <Field label="E-mail da clínica" full error={!validEmail(form.email) ? 'Digite um e-mail válido.' : undefined}><input className={!validEmail(form.email) ? 'invalid' : ''} type="email" placeholder="contato@clinica.com.br" value={form.email} onChange={e => setForm({ ...form, email: normalizeEmail(e.target.value) })}/></Field>
        <label className="full">Logo da clínica<div className="logo-upload"><div>{form.logo ? <img src={form.logo} alt="Logo da clínica"/> : <span>Sem logo</span>}</div><label className="button ghost">Selecionar imagem<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => uploadLogo(e.target.files?.[0])}/></label>{form.logo && <Button variant="ghost" onClick={() => setForm({ ...form, logo: '' })}>Remover</Button>}</div></label>
        <label className="full"><div className="brand-colors-head">Cores da identidade visual<span className="field-help">Sugeridas automaticamente ao subir a logo. Pode ajustar se quiser.</span></div><div className="brand-colors"><label className="brand-color-field"><input type="color" value={form.brandPrimary || '#293D67'} onChange={e => setForm({ ...form, brandPrimary: e.target.value })}/><span>Cor principal</span></label><label className="brand-color-field"><input type="color" value={form.brandSecondary || '#35558F'} onChange={e => setForm({ ...form, brandSecondary: e.target.value })}/><span>Cor secundária</span></label></div></label>
        <Field label="CEP" help={cepLoading ? 'Buscando endereço...' : undefined} error={cepError || undefined}><input inputMode="numeric" placeholder="00000-000" value={form.zipCode} onChange={e => { const zipCode = maskCep(e.target.value); setForm({ ...form, zipCode }); if (digits(zipCode).length === 8) lookupCep(zipCode) }}/></Field>
        <Field label="Estado/UF"><input value={form.state} maxLength={2} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') })}/></Field>
        <Field label="Endereço" full><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}/></Field>
        <Field label="Cidade" full><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}/></Field>
      </div>
    </section>
    <section className="settings-card card">
      <div className="settings-title"><div className="settings-icon"><FileText size={20}/></div><div><h3>Médico prescritor e responsável pela conta</h3><p>O médico é o usuário principal do aplicativo e também aparece nos documentos.</p></div></div>
      <div className="form-grid">
        <Field label="Nome completo"><input value={form.doctorName} onChange={e => setForm({ ...form, doctorName: e.target.value })}/></Field>
        <Field label="CRM"><input placeholder="CRM-UF 000000" value={form.crm} onChange={e => setForm({ ...form, crm: maskCrm(e.target.value) })}/></Field>
        <Field label="E-mail do médico" full><input className={!validEmail(form.doctorEmail) ? 'invalid' : ''} type="email" placeholder="medico@clinica.com.br" value={form.doctorEmail} onChange={e => setForm({ ...form, doctorEmail: normalizeEmail(e.target.value) })}/></Field>
      </div>
    </section>
    <section className="settings-card card">
      <div className="settings-title"><div className="settings-icon"><Users size={20}/></div><div><h3>Usuário administrador</h3><p>Dados da pessoa responsável pela conta.</p></div></div>
      <div className="form-grid">
        <Field label="Nome"><input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}/></Field>
        <Field label="E-mail"><input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}/></Field>
        <Field label="Perfil"><select value={profile.role} onChange={e => setProfile({ ...profile, role: e.target.value })}><option>Administrador</option><option>Gestor</option><option>Operador</option></select></Field>
        <Field label="Nova senha"><input type="password" placeholder="Deixe em branco para não alterar"/></Field>
      </div>
    </section>
    <div className="settings-save"><Button variant="primary" onClick={save}>Salvar configurações</Button></div>
  </div>
}
