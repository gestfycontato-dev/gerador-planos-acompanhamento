import { lazy, Suspense, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Menu } from 'lucide-react'
import { clinic as initialClinic, initialPlans, patients as initialPatients, services as initialServices } from './data'
import type { ClinicProfile, Discount, Patient, PaymentMethod, Plan, SaleSnapshotGoal, SaleStatus, Service } from './types'
import { auth, consumeAuthHashError, supabaseConfigured } from './supabase'
import type { AuthSession } from './supabase'
import { archivePatient, completeRenewal, createCategory, createPaymentMethod, deleteCategory, deletePatient, deletePaymentMethod, deletePlan, deleteService, isPlatformAdmin, linkConsultationToPlan, loadWorkspace, saveClinic as persistClinic, saveDiscounts as persistDiscounts, saveLogo, touchLastSeen, updateSale, upsertPatient, upsertPlan, upsertService } from './repository'
import type { Page } from './lib/constants'
import { errorMessage } from './lib/format'
import { Sidebar } from './components/layout/Sidebar'
import { ServicesIntroModal, WelcomeModal } from './components/layout/OnboardingModals'
import { Toast } from './components/ui/Toast'
import { AuthPage, LoadError, LoadingScreen, ResetPasswordPage, SetupError } from './pages/AuthPages'
import { Dashboard } from './pages/DashboardPage'
import { CreatePlanPage } from './pages/CreatePlanPage'
import { Builder } from './pages/PlanBuilderPage'
import { PlansPage } from './pages/PlansPage'
import { PatientsPage } from './pages/PatientsPage'
import { ServicesPage } from './pages/ServicesPage'
import { DiscountsPage } from './pages/DiscountsPage'
import { PaymentMethodsPage } from './pages/PaymentMethodsPage'
import { GoalTemplatesPage } from './pages/GoalTemplatesPage'
import { PlanTemplatesPage } from './pages/PlanTemplatesPage'
import { SalesScriptSettingsPage } from './pages/SalesScriptSettingsPage'
// Rotas pouco visitadas por sessão (a maioria dos usuários nunca abre /admin, e a consulta
// é uma tela grande e opcional) — carregadas sob demanda pra não pesar o bundle inicial.
const ConsultationPage = lazy(() => import('./pages/ConsultationPage').then(m => ({ default: m.ConsultationPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })))
import { SalesPage } from './pages/SalesPage'
import { RenewalControl } from './pages/RenewalsPage'
import { SettingsPage } from './pages/SettingsPage'

function App() {
  const [session, setSession] = useState<AuthSession | null | undefined>(undefined)
  const [recoverySession, setRecoverySession] = useState<AuthSession | null>(null)
  const [authNotice, setAuthNotice] = useState('')
  const [workspaceLoading, setWorkspaceLoading] = useState(true)
  const [workspaceError, setWorkspaceError] = useState('')
  const [page, setPage] = useState<Page>('dashboard')
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [patients, setPatients] = useState<Patient[]>(initialPatients)
  const [services, setServices] = useState<Service[]>(initialServices)
  const [categories, setCategories] = useState<string[]>(() => [...new Set(initialServices.map(s => s.category))])
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({})
  const [discounts, setDiscounts] = useState<Discount[]>([8, 12, 16, 24, 48].map(duration => ({ duration, percent: 0 })))
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [clinic, setClinic] = useState<ClinicProfile>({ ...initialClinic, legalName: '', cnpj: '', phone: '', email: '', address: '', zipCode: '', city: '', state: '', doctorName: '', doctorEmail: '', crm: '', logo: '' })
  const [completedRenewals, setCompletedRenewals] = useState<string[]>([])
  const [draft, setDraft] = useState<Plan>(() => ({ id: crypto.randomUUID(), name: 'Novo plano de acompanhamento', duration: 12, startDate: format(new Date(), 'yyyy-MM-dd'), createdAt: format(new Date(), 'yyyy-MM-dd'), status: 'Plano criado', updatedAt: 'Agora', weeks: Array.from({ length: 12 }, (_, i) => ({ number: i + 1, items: [] })) }))
  const [saved, setSaved] = useState(true)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [servicesIntroOpen, setServicesIntroOpen] = useState(false)
  const [draftKind, setDraftKind] = useState<'template' | 'patient'>('patient')
  const [assistantMode, setAssistantMode] = useState<'with' | 'without' | undefined>(undefined)
  const [reopening, setReopening] = useState(false)
  const [consultationEntry, setConsultationEntry] = useState<{ patientId?: string; consultationId?: string }>({})
  const [consultationKey, setConsultationKey] = useState(0)
  const [sourceConsultationId, setSourceConsultationId] = useState<string | undefined>(undefined)
  const [carryGoals, setCarryGoals] = useState<SaleSnapshotGoal[] | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) { setSession(null); setWorkspaceLoading(false); return }
    const hashError = consumeAuthHashError()
    if (hashError) setAuthNotice(hashError)
    auth.beginRecoverySession().then(recovery => {
      if (recovery) { setRecoverySession(recovery); setSession(null); setWorkspaceLoading(false); return }
      return auth.ensureSession().then(setSession).catch(() => setSession(null))
    }).catch(() => { setSession(null); setWorkspaceLoading(false) })
  }, [])

  useEffect(() => {
    if (!session) return
    const throttleKey = `gestfy:last-seen-touch:${session.user.id}`
    const throttleMs = 15 * 60 * 1000
    const last = Number(localStorage.getItem(throttleKey) ?? 0)
    if (Date.now() - last < throttleMs) return
    localStorage.setItem(throttleKey, String(Date.now()))
    touchLastSeen().catch(() => {})
  }, [session])

  useEffect(() => {
    if (!session) { setIsAdmin(false); return }
    let cancelled = false
    isPlatformAdmin().then(value => {
      if (cancelled) return
      setIsAdmin(value)
      if (!value && window.location.pathname === '/admin') { window.history.replaceState(null, '', '/'); setPage(current => current === 'admin' ? 'dashboard' : current) }
    }).catch(() => !cancelled && setIsAdmin(false))
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    const applyLocation = () => {
      const match = window.location.pathname.match(/^\/consulta\/([\w-]+)$/)
      if (match) { setConsultationEntry({ consultationId: match[1] }); setConsultationKey(k => k + 1); setPage('consultation'); return }
      if (window.location.pathname === '/admin') { setPage('admin'); return }
      setPage(current => (current === 'consultation' || current === 'admin') ? 'dashboard' : current)
    }
    applyLocation()
    window.addEventListener('popstate', applyLocation)
    return () => window.removeEventListener('popstate', applyLocation)
  }, [])

  useEffect(() => {
    if (!session) { setWorkspaceLoading(false); return }
    let cancelled = false
    setWorkspaceLoading(true); setWorkspaceError('')
    loadWorkspace(session.user).then(data => {
      if (cancelled) return
      setClinic(data.clinic); setPatients(data.patients); setServices(data.services); setCategories(data.categories); setCategoryIds(data.categoryIds); setDiscounts(data.discounts); setPaymentMethods(data.paymentMethods); setPlans(data.plans); setCompletedRenewals(data.completedRenewals)
      setWelcomeOpen(!data.clinic.name || !data.clinic.doctorName)
    }).catch(error => !cancelled && setWorkspaceError(errorMessage(error))).finally(() => !cancelled && setWorkspaceLoading(false))
    return () => { cancelled = true }
  }, [session])

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400) }
  const startSetup = () => { setWelcomeOpen(false); setPage('settings') }
  const updateDraft = (next: Plan) => { setDraft(next); setSaved(false) }
  const saveDraft = async (next: Plan) => {
    if (!session) throw new Error('Sua sessão expirou. Entre novamente.')
    await upsertPlan(clinic.id, session.user.id, next)
    if (sourceConsultationId && next.patientId) {
      try { await linkConsultationToPlan(sourceConsultationId, next.id) } catch (error) { notify(errorMessage(error)) }
      setSourceConsultationId(undefined)
    }
    setDraft(next)
    setPlans(current => current.some(p => p.id === next.id) ? current.map(p => p.id === next.id ? next : p) : [next, ...current])
    setSaved(true); notify('Plano salvo com sucesso')
  }
  const newPlan = (kind: 'template' | 'patient' = 'patient') => {
    const duration = 12
    setDraftKind(kind)
    setAssistantMode(undefined)
    setReopening(false)
    setDraft({ id: crypto.randomUUID(), name: kind === 'template' ? 'Novo template' : 'Novo plano de acompanhamento', duration, startDate: format(new Date(), 'yyyy-MM-dd'), createdAt: format(new Date(), 'yyyy-MM-dd'), status: 'Plano criado', updatedAt: 'Agora', weeks: Array.from({ length: duration }, (_, i) => ({ number: i + 1, items: [] })) })
    setPage('builder'); setSaved(false)
  }
  const startPatientPlan = (options: { patientId?: string; sourceConsultationId?: string; carryGoals?: SaleSnapshotGoal[]; assistantMode?: 'with' | 'without' }) => {
    setDraftKind('patient')
    setSourceConsultationId(options.sourceConsultationId)
    setCarryGoals(options.carryGoals)
    setAssistantMode(options.assistantMode)
    setReopening(false)
    const duration = 12
    setDraft({ id: crypto.randomUUID(), name: 'Novo plano de acompanhamento', duration, startDate: format(new Date(), 'yyyy-MM-dd'), createdAt: format(new Date(), 'yyyy-MM-dd'), status: 'Plano criado', updatedAt: 'Agora', patientId: options.patientId, weeks: Array.from({ length: duration }, (_, i) => ({ number: i + 1, items: [] })) })
    setPage('builder'); setSaved(false)
  }
  const startCreationFlow = (mode: 'with' | 'without') => startPatientPlan({ assistantMode: mode })
  const openConsultation = (patientId?: string) => { setConsultationEntry({ patientId }); setConsultationKey(k => k + 1); setPage('consultation') }
  const openConsultationById = (id: string) => { setConsultationEntry({ consultationId: id }); setConsultationKey(k => k + 1); window.history.pushState(null, '', `/consulta/${id}`); setPage('consultation') }
  const enterConsultationUrl = (id: string) => window.history.pushState(null, '', `/consulta/${id}`)
  const exitConsultation = () => { window.history.pushState(null, '', '/'); setPage('dashboard') }
  const buildPlanFromConsultation = (patientId: string, consultationId: string) => { exitConsultation(); startPatientPlan({ patientId, sourceConsultationId: consultationId }) }
  const startRenewalPlan = (patientId: string, goals: SaleSnapshotGoal[]) => startPatientPlan({ patientId, carryGoals: goals })
  const openAdmin = () => { window.history.pushState(null, '', '/admin'); setPage('admin') }
  const finishPlanCreation = () => { setAssistantMode(undefined); setReopening(false); setPage('dashboard') }
  const openExistingPlan = (p: Plan) => { setDraftKind(p.patientId ? 'patient' : 'template'); setAssistantMode(undefined); setReopening(!!p.patientId); setDraft(structuredClone(p)); setPage('builder'); setSaved(true) }

  const savePatientRecord = async (patient: Patient) => { try { const saved = await upsertPatient(clinic.id, patient); setPatients(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current]); notify('Cadastro de paciente salvo'); return true } catch (error) { notify(errorMessage(error)); return false } }
  const removePatientRecord = async (id: string) => { try { await deletePatient(id); setPatients(current => current.filter(item => item.id !== id)); notify('Paciente excluído') } catch (error) { notify(errorMessage(error)) } }
  const archivePatientRecord = async (id: string) => { try { await archivePatient(id); setPatients(current => current.filter(item => item.id !== id)); notify('Paciente arquivado') } catch (error) { notify(errorMessage(error)) } }
  const addCategoryRecord = async (name: string) => { try { const category = await createCategory(clinic.id, name); setCategories(current => [...current, category.name].sort()); setCategoryIds(current => ({ ...current, [category.name]: category.id })); notify('Categoria cadastrada e selecionada'); return category.name } catch (error) { notify(errorMessage(error)); return null } }
  const removeCategoryRecord = async (name: string) => { try { await deleteCategory(categoryIds[name]); setCategories(current => current.filter(item => item !== name)); setCategoryIds(current => { const next = { ...current }; delete next[name]; return next }); notify('Categoria excluída') } catch (error) { notify(errorMessage(error)) } }
  const saveServiceRecord = async (service: Service) => { try { let categoryId = categoryIds[service.category]; if (!categoryId) { const category = await createCategory(clinic.id, service.category); categoryId = category.id; setCategories(current => [...new Set([...current, category.name])].sort()); setCategoryIds(current => ({ ...current, [category.name]: category.id })) } const saved = await upsertService(clinic.id, service, categoryId); setServices(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current]); notify('Serviço salvo no catálogo'); return true } catch (error) { notify(errorMessage(error)); return false } }
  const removeServiceRecord = async (id: string) => { try { await deleteService(id); setServices(current => current.filter(item => item.id !== id)); notify('Serviço excluído') } catch (error) { notify(errorMessage(error)) } }
  const removePlanTemplate = async (id: string) => { try { await deletePlan(id); setPlans(current => current.filter(item => item.id !== id)); notify('Template excluído') } catch (error) { notify(errorMessage(error)) } }
  const saveDiscountRecords = async (next: Discount[]) => { try { await persistDiscounts(clinic.id, next); setDiscounts(next); notify('Regras de desconto salvas'); return true } catch (error) { notify(errorMessage(error)); return false } }
  const addPaymentMethodRecord = async (label: string) => { try { const method = await createPaymentMethod(clinic.id, label); setPaymentMethods(current => [...current, method]); notify('Forma de pagamento cadastrada') } catch (error) { notify(errorMessage(error)) } }
  const removePaymentMethodRecord = async (id: string) => { try { await deletePaymentMethod(id); setPaymentMethods(current => current.filter(item => item.id !== id)); notify('Forma de pagamento excluída') } catch (error) { notify(errorMessage(error)) } }
  const saveClinicRecord = async (next: ClinicProfile) => { if (!session) return false; try { await persistClinic(next, session.user.id); setClinic(next); notify('Dados da clínica e do médico salvos'); return true } catch (error) { notify(errorMessage(error)); return false } }
  const uploadClinicLogo = async (file: File) => { try { return await saveLogo(clinic.id, file) } catch (error) { notify(errorMessage(error)); return null } }
  const changeSaleStatus = async (plan: Plan, status: SaleStatus) => { try { const snapshot = await updateSale(clinic.id, plan, status, services, discounts); setPlans(current => current.map(item => item.id === plan.id ? { ...item, status, soldSnapshot: snapshot ?? item.soldSnapshot, soldAt: snapshot?.capturedAt ?? item.soldAt } : item)); notify(status === 'Plano vendido' ? 'Venda concluída e snapshot preservado' : 'Status atualizado') } catch (error) { notify(errorMessage(error)) } }
  const finishRenewal = async (planId: string) => { if (!session) return; try { await completeRenewal(clinic.id, planId, session.user.id); setCompletedRenewals(current => [...new Set([...current, planId])]); notify('Contato de renovação concluído') } catch (error) { notify(errorMessage(error)) } }
  const signOut = async () => { await auth.signOut(); setSession(null); setPlans([]); setPatients([]); setServices([]); setIsAdmin(false); setPage('dashboard') }

  if (!supabaseConfigured) return <SetupError/>
  if (recoverySession) return <ResetPasswordPage onDone={() => setRecoverySession(null)}/>
  if (session === undefined || workspaceLoading) return <LoadingScreen/>
  if (!session) return <AuthPage onAuthenticated={setSession} initialMode={authNotice ? 'reset' : undefined} initialMessage={authNotice}/>
  if (workspaceError) return <LoadError message={workspaceError} retry={() => setSession({ ...session })} onSignOut={signOut}/>

  return <div className="app-shell">
    <Sidebar clinic={clinic} plans={plans} page={page} setPage={setPage} mobileNav={mobileNav} closeMobileNav={() => setMobileNav(false)} signOut={signOut} isAdmin={isAdmin} openAdmin={openAdmin}/>
    {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)}/>}
    <main className="main">
      <button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu/></button>
      {page === 'builder' && <Builder key={draft.id} kind={draftKind} plan={draft} update={updateDraft} save={saveDraft} saved={saved} back={() => setPage('create')} notify={notify} patients={patients} services={services} clinic={clinic} discounts={discounts} paymentMethods={paymentMethods} planTemplates={plans.filter(p => !p.patientId)} initialCarryGoals={carryGoals} userId={session.user.id} assistantMode={assistantMode} reopening={reopening} finish={finishPlanCreation} openConsultation={openConsultation} openConsultationById={openConsultationById}/>}
      {page === 'create' && <CreatePlanPage startWithAssistant={() => startCreationFlow('with')} startWithoutAssistant={() => startCreationFlow('without')}/>}
      {page === 'plans' && <PlansPage plans={plans} patients={patients} open={openExistingPlan} create={() => setPage('create')} removeTemplate={removePlanTemplate}/>}
      {page === 'patients' && <PatientsPage patients={patients} savePatient={savePatientRecord} removePatient={removePatientRecord} archivePatient={archivePatientRecord} notify={notify} openConsultation={openConsultation}/>}
      {page === 'consultation' && session && <Suspense fallback={<LoadingScreen/>}><ConsultationPage key={consultationKey} clinicId={clinic.id} userId={session.user.id} patients={patients} plans={plans} services={services} discounts={discounts} initialPatientId={consultationEntry.patientId} initialConsultationId={consultationEntry.consultationId} notify={notify} onExit={exitConsultation} onEnterConsultation={enterConsultationUrl} onBuildPlan={buildPlanFromConsultation}/></Suspense>}
      {page === 'services' && <ServicesPage services={services} categories={categories} saveService={saveServiceRecord} removeService={removeServiceRecord} addCategoryRecord={addCategoryRecord} removeCategoryRecord={removeCategoryRecord} notify={notify}/>}
      {page === 'discounts' && <DiscountsPage discounts={discounts} saveDiscounts={saveDiscountRecords}/>}
      {page === 'payment-methods' && <PaymentMethodsPage paymentMethods={paymentMethods} addPaymentMethod={addPaymentMethodRecord} removePaymentMethod={removePaymentMethodRecord}/>}
      {page === 'goals' && <GoalTemplatesPage clinicId={clinic.id} notify={notify}/>}
      {page === 'plan-templates' && <PlanTemplatesPage templates={plans.filter(p => !p.patientId)} openTemplate={openExistingPlan} createTemplate={() => newPlan('template')} removeTemplate={removePlanTemplate}/>}
      {page === 'sales-script' && <SalesScriptSettingsPage clinicId={clinic.id} notify={notify}/>}
      {page === 'sales' && <SalesPage plans={plans} patients={patients} services={services} discounts={discounts} movePlan={changeSaleStatus}/>}
      {page === 'renewals' && <RenewalControl plans={plans} patients={patients} completed={completedRenewals} finish={finishRenewal} startRenewal={startRenewalPlan}/>}
      {page === 'settings' && <SettingsPage clinic={clinic} saveClinic={saveClinicRecord} uploadLogo={uploadClinicLogo} notify={notify} onSaved={() => { setPage('services'); setServicesIntroOpen(true) }}/>}
      {page === 'dashboard' && <Dashboard plans={plans} patients={patients} services={services} discounts={discounts} completed={completedRenewals} navigate={setPage}/>}
      {page === 'admin' && isAdmin && <Suspense fallback={<LoadingScreen/>}><AdminPage notify={notify}/></Suspense>}
    </main>
    <Toast message={toast}/>
    {welcomeOpen && <WelcomeModal onStart={startSetup}/>}
    {servicesIntroOpen && <ServicesIntroModal onClose={() => setServicesIntroOpen(false)}/>}
  </div>
}

export default App
