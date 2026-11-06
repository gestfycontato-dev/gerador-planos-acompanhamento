import { CalendarCheck, ChevronDown, CircleDollarSign, CreditCard, FilePlus2, Grid2X2, LayoutDashboard, LayoutTemplate, Library, Map, Settings, ShieldCheck, SlidersHorizontal, Stethoscope, Target, Users, X } from 'lucide-react'
import type { Page } from '../../lib/constants'
import { clinicInitials, doctorInitials } from '../../lib/format'
import type { ClinicProfile, Plan } from '../../types'

const NavItem = ({ icon: Icon, label, active, onClick, badge }: { icon: typeof Grid2X2; label: string; active?: boolean; onClick: () => void; badge?: number }) => (
  <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={19}/><span>{label}</span>{badge ? <b>{badge}</b> : null}</button>
)

export function Sidebar({ clinic, plans, page, setPage, mobileNav, closeMobileNav, signOut, isAdmin, openAdmin }: { clinic: ClinicProfile; plans: Plan[]; page: Page; setPage: (page: Page) => void; mobileNav: boolean; closeMobileNav: () => void; signOut: () => void; isAdmin: boolean; openAdmin: () => void }) {
  return <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
    <div className="brand"><div className="brand-mark"><Map size={20}/></div><div><strong>Gerador de Planos</strong><span>de Acompanhamento</span></div><button className="mobile-close" onClick={closeMobileNav}><X/></button></div>
    <div className="powered"><span>powered by</span><img src="https://static.wixstatic.com/media/79f7cb_72ec16e662de47cb82ac4f9a9daa3c8d~mv2.png/v1/fill/w_323,h_87,al_c,q_85/LOGO%20GESTFY%20COLORIDO%20PRETO%20002_3x.png" alt="Gestfy"/></div>
    <button className="clinic-switch" onClick={() => setPage('settings')}><div className="avatar">{clinic.logo ? <img src={clinic.logo} alt={`Logo de ${clinic.name || 'clínica'}`}/> : clinicInitials(clinic.name)}</div><div><strong>{clinic.name || 'Cadastre sua clínica'}</strong><span>{clinic.plan}</span></div><ChevronDown size={16}/></button>
    <nav>
      <small>VISÃO GERAL</small>
      <NavItem icon={LayoutDashboard} label="Dashboard" active={page === 'dashboard'} onClick={() => setPage('dashboard')}/>
      <small>OPERAÇÃO</small>
      <NavItem icon={Library} label="Planos criados" active={page === 'plans'} onClick={() => setPage('plans')}/>
      <NavItem icon={CircleDollarSign} label="Vendas" badge={plans.filter(p => p.patientId).length || undefined} active={page === 'sales'} onClick={() => setPage('sales')}/>
      <NavItem icon={CalendarCheck} label="Renovações" active={page === 'renewals'} onClick={() => setPage('renewals')}/>
      <NavItem icon={FilePlus2} label="Criar plano" active={page === 'create' || page === 'builder'} onClick={() => setPage('create')}/>
      <small>CADASTROS</small>
      <NavItem icon={Users} label="Pacientes" active={page === 'patients'} onClick={() => setPage('patients')}/>
      <NavItem icon={Stethoscope} label="Serviços" active={page === 'services'} onClick={() => setPage('services')}/>
      <NavItem icon={CircleDollarSign} label="Descontos" active={page === 'discounts'} onClick={() => setPage('discounts')}/>
      <NavItem icon={CreditCard} label="Formas de pagamento" active={page === 'payment-methods'} onClick={() => setPage('payment-methods')}/>
      <NavItem icon={Target} label="Objetivos" active={page === 'goals'} onClick={() => setPage('goals')}/>
      <NavItem icon={LayoutTemplate} label="Templates de plano" active={page === 'plan-templates'} onClick={() => setPage('plan-templates')}/>
      <NavItem icon={SlidersHorizontal} label="Configurar assistente de vendas" active={page === 'sales-script'} onClick={() => setPage('sales-script')}/>
      {isAdmin && <><small>PLATAFORMA</small><NavItem icon={ShieldCheck} label="Painel admin" active={page === 'admin'} onClick={openAdmin}/></>}
    </nav>
    <div className="sidebar-foot"><NavItem icon={Settings} label="Configurações" active={page === 'settings'} onClick={() => setPage('settings')}/><div className="user-card"><div className="avatar coral">{doctorInitials(clinic.doctorName)}</div><div><strong>{clinic.doctorName || 'Cadastre o médico'}</strong><span>Médico prescritor</span></div><button className="sign-out" title="Sair da conta" onClick={() => void signOut()}>Sair</button></div></div>
  </aside>
}
