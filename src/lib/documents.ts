import { addDays, addWeeks, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { money } from '../data'
import type { ClinicProfile, GoalValueType, Patient, Plan, Service } from '../types'
import contractTemplate from '../contract-template.json'
import { valueInWords } from '../valueInWords'

export const brandHexes = (clinic: ClinicProfile) => ({
  title: (clinic.brandPrimary || '#293D67').replace('#', '').toUpperCase(),
  heading: (clinic.brandPrimary || '#385485').replace('#', '').toUpperCase(),
  secondary: (clinic.brandSecondary || '#667085').replace('#', '').toUpperCase(),
})

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function printPlanDocument(type: 'calendar' | 'schedule' | 'summary' | 'contract', plan: Plan, patient: Patient | undefined, services: Service[], clinic: ClinicProfile, discount: number, paymentMethod: string) {
  const win = window.open('', '_blank', 'width=900,height=700'); if (!win) return
  const patientName = esc(patient?.name ?? '________________________________')
  const start = plan.startDate ? parseISO(plan.startDate) : new Date()
  const items = plan.weeks.flatMap(w => w.items.map(i => ({ week: w.number, date: addWeeks(start, w.number - 1), quantity: i.quantity ?? 1, service: services.find(s => s.id === i.serviceId) }))).filter(x => x.service)
  const totals = [...new Set(items.map(i => i.service!.id))].map(id => { const s = services.find(x => x.id === id)!; return { ...s, qty: items.filter(i => i.service!.id === id).reduce((n, i) => n + i.quantity, 0) } })
  const subtotal = items.reduce((n, i) => n + (i.service?.price ?? 0) * i.quantity, 0); const total = subtotal * (1 - discount / 100)
  const applications = items.flatMap(i => Array.from({ length: i.quantity }, () => i))
  const calendar = `<h1>Calendário de acompanhamento</h1><div class="calendar-intro"><b>${patientName}</b><span>${esc(plan.name)} · ${plan.duration} semanas</span><small>Início previsto: ${format(start, 'dd/MM/yyyy')}</small></div><div class="calendar-grid">${plan.weeks.map(w => { const date = addWeeks(start, w.number - 1); return `<section class="calendar-week ${w.items.length ? '' : 'calendar-empty'}"><div class="calendar-week-head"><span>SEMANA</span><b>${String(w.number).padStart(2, '0')}</b><small>${format(date, 'dd/MM')} a ${format(addDays(date, 6), 'dd/MM')}</small></div><div class="calendar-services">${w.items.length ? w.items.map(i => { const service = services.find(s => s.id === i.serviceId); return `<div><i></i><span><b>${esc(service?.name ?? 'Serviço')}</b><small>${(i.quantity ?? 1) > 1 ? `${i.quantity} aplicações` : '1 aplicação'}</small></span></div>` }).join('') : '<em>Sem aplicações previstas</em>'}</div></section>` }).join('')}</div><div class="calendar-note"><b>Orientações:</b> As datas são previstas e podem ser ajustadas pela clínica conforme a avaliação médica e a disponibilidade de agenda.</div>`
  const schedule = `<h1>Controle de plano terapêutico</h1><div class="meta"><b>Paciente:</b> ${patientName}<br><b>Médico prescritor:</b> ${esc(clinic.doctorName)} - ${esc(clinic.crm)}</div><table><thead><tr><th>Data proposta</th><th>Substância / serviço</th><th>Data realização</th><th>Ass. paciente</th><th>Ass. enfermeira</th><th>Observações</th></tr></thead><tbody>${applications.map(i => `<tr><td>${format(i.date, 'dd/MM/yyyy')}</td><td>${esc(i.service!.name)}</td><td></td><td></td><td></td><td></td></tr>`).join('')}</tbody></table>`
  const summary = `<h1>Resumo do plano para prontuário</h1><div class="meta"><b>Paciente:</b> ${patientName}<br><b>Plano:</b> ${esc(plan.name)}<br><b>Período:</b> ${format(start, 'dd/MM/yyyy')} a ${format(addWeeks(start, plan.duration), 'dd/MM/yyyy')}</div><h2>Quantidades previstas</h2><ul class="summary">${totals.map(s => `<li><b>${s.qty}x</b> ${esc(s.name)}</li>`).join('')}</ul><h2>Distribuição</h2><p>${plan.weeks.filter(w => w.items.length).map(w => `Semana ${w.number}: ${w.items.map(i => esc(services.find(s => s.id === i.serviceId)?.name ?? 'Serviço')).join(', ')}`).join(' | ')}</p><div class="note"><b>Observações clínicas:</b><br><br><br><br></div>`
  const editable = (value: string, label: string) => `<span class="editable" contenteditable="true">${esc(value || `{${label}}`)}</span>`
  const summaryText = totals.map(s => `${s.qty} unidade(s) de ${s.name}`).join('; ')
  const today = new Date()
  const automatic: Record<string, string> = {
    '[NOME DO PACIENTE]': patient?.name ?? 'Paciente não associado',
    '[RAZÃO SOCIAL DA CLÍNICA]': clinic.legalName,
    '[CNPJ DA CLÍNICA]': clinic.cnpj,
    '[ENDEREÇO DA CLÍNICA COM CEP]': `${clinic.address}, CEP ${clinic.zipCode}, ${clinic.city}/${clinic.state}`,
    '[TELEFONE DA CLÍNICA]': clinic.phone,
    '[VALOR TOTAL DO PLANO]': money(total),
    '[(VALOR TOTAL POR ESCRITO)]': valueInWords(total),
    '[COLOCAR O RESUMO DAS QUANTIDADES E SERVIÇOS DO PLANO]': summaryText,
    '[Cidade/UF da clínica]': `${clinic.city}/${clinic.state}`,
    '[Cidade da Clínica]': clinic.city,
    '[DIA]': format(today, 'dd'), '[MÊS]': format(today, 'MMMM', { locale: ptBR }), '[ANO]': format(today, 'yyyy')
  }
  const manual: Record<string, string> = { '{CPF}': '', '{ENDEREÇO}': '', '{TELEFONE}': '', '{E-MAIL}': '', '{FORMA DE PAGAMENTO}': paymentMethod }
  const renderContractText = (text: string) => {
    const pattern = /(\[\(VALOR TOTAL POR ESCRITO\)\]|\[[^\]]+\]|\{[^}]+\})/g
    let cursor = 0, html = '', match: RegExpExecArray | null
    while ((match = pattern.exec(text))) { html += esc(text.slice(cursor, match.index)); const token = match[0]; html += token in automatic ? `<span class="automatic">${esc(automatic[token])}</span>` : editable(manual[token] ?? '', token.slice(1, -1)); cursor = match.index + token.length }
    return html + esc(text.slice(cursor))
  }
  const contract = contractTemplate.map((paragraph, index) => {
    const text = paragraph.text
    if (!text) return '<p class="blank"><br></p>'
    const heading = index === 0 || /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\s*[–-]/.test(text)
    return heading ? `<h${index === 0 ? '1' : '2'}>${renderContractText(text)}</h${index === 0 ? '1' : '2'}>` : `<p>${renderContractText(text)}</p>`
  }).join('')
  const body = type === 'calendar' ? calendar : type === 'schedule' ? schedule : type === 'summary' ? summary : contract
  const { title: titleHex, heading: headingHex } = brandHexes(clinic)
  win.document.write(`<!doctype html><html><head><title>${type === 'calendar' ? 'Calendário semanal' : type === 'schedule' ? 'Plano terapêutico' : type === 'summary' ? 'Resumo para prontuário' : 'Contrato do plano'}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#202b42;font-size:10px;line-height:1.45;margin:0}.print-btn{position:fixed;right:18px;top:18px;background:#293d67;color:white;border:0;border-radius:8px;padding:10px 15px;cursor:pointer;z-index:5}header{border-bottom:3px solid #${headingHex};padding-bottom:10px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center}header img{max-width:190px;max-height:64px;object-fit:contain}header b{font-size:15px}header span{color:#778297}h1{text-transform:uppercase;text-align:center;font-size:17px;margin:0 0 15px;color:#${titleHex}}h2{font-size:11px;text-transform:uppercase;margin:14px 0 5px;color:#${headingHex};break-after:avoid}p{margin:0 0 8px;text-align:justify}.blank{margin:0 0 4px}.meta{padding:8px 10px;margin-bottom:14px;text-align:center}table{width:100%;border-collapse:collapse;font-size:8px}th{background:#e8ebf0;color:#202b42;text-align:center;padding:6px;border:1px solid #777}td{border:1px solid #888;padding:6px;height:26px}.signatures{display:flex;gap:50px;margin-top:55px}.signatures span{flex:1;border-top:1px solid #485468;text-align:center;padding-top:6px}.summary{font-size:12px;line-height:2}.note{border:1px solid #d9dee8;padding:12px;margin-top:24px;min-height:100px}.automatic{font-weight:600}.editable{background:#fff2a8;border-bottom:1px dashed #9b7c1b;padding:1px 3px;outline:none}.calendar-intro{text-align:center;margin:-4px 0 18px}.calendar-intro b,.calendar-intro span,.calendar-intro small{display:block}.calendar-intro b{font-size:15px}.calendar-intro span{margin:3px 0;color:#526586}.calendar-intro small{color:#7b879a}.calendar-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.calendar-week{display:grid;grid-template-columns:74px 1fr;border:1px solid #cfd6e1;border-radius:8px;overflow:hidden;break-inside:avoid;background:white}.calendar-week-head{padding:9px;background:#e9eef6;text-align:center;display:flex;flex-direction:column;justify-content:center}.calendar-week-head span{font-size:6px;letter-spacing:1px;font-weight:bold;color:#71809a}.calendar-week-head b{font-size:18px;color:#${titleHex}}.calendar-week-head small{font-size:7px;color:#77859b}.calendar-services{padding:8px;display:flex;flex-direction:column;gap:5px;justify-content:center}.calendar-services>div{display:flex;align-items:center;gap:7px}.calendar-services i{width:6px;height:6px;border-radius:50%;background:#e45e7b;flex:none}.calendar-services span,.calendar-services b,.calendar-services small{display:block}.calendar-services b{font-size:8px}.calendar-services small{font-size:7px;color:#7c899b}.calendar-services em{font-size:7px;color:#9aa3b1}.calendar-empty{opacity:.68}.calendar-note{margin-top:14px;padding:10px;background:#f3f5f8;border-radius:7px;font-size:8px;color:#64728a}.footer{position:fixed;bottom:0;left:0;right:0;color:#8992a3;font-size:8px;text-align:center}@media print{.print-btn{display:none}.editable{background:#fff2a8!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><button class="print-btn" onclick="window.print()">Imprimir / Salvar PDF</button><header><div>${clinic.logo ? `<img src="${clinic.logo}" alt="Logo"/>` : `<b>${esc(clinic.name)}</b>`}</div><span>${esc(clinic.doctorName)} · ${esc(clinic.crm)}</span></header>${body}<div class="footer">${esc(clinic.name)} · ${esc(clinic.phone)} · ${esc(clinic.email)}</div></body></html>`); win.document.close()
}

export function planTextData(plan: Plan, services: Service[]) {
  const start = plan.startDate ? parseISO(plan.startDate) : new Date()
  const items = plan.weeks.flatMap(w => w.items.map(i => ({ week: w.number, quantity: i.quantity ?? 1, service: services.find(s => s.id === i.serviceId) }))).filter(i => i.service)
  const totals = [...new Set(items.map(i => i.service!.id))].map(id => { const service = services.find(s => s.id === id)!; return { ...service, qty: items.filter(i => i.service!.id === id).reduce((sum, i) => sum + i.quantity, 0) } })
  return { start, items, totals }
}

export type PresentationGoal = {
  name: string
  unit?: string
  valueType: GoalValueType
  current?: number
  target?: number
  currentText?: string
  targetText?: string
  decimals?: number
}

const formatGoalNumber = (value: number, decimals?: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: decimals ?? (Number.isInteger(value) ? 0 : 2), maximumFractionDigits: decimals ?? 2 })

function goalChartSvg(current: number, target: number, unit: string | undefined, decimals: number | undefined, primaryHex: string) {
  const lo = Math.min(current, target), hi = Math.max(current, target)
  const margin = Math.max(Math.abs(hi), 1) * 0.15
  const axisMin = Math.max(0, lo - margin)
  const axisMax = hi + margin
  const span = axisMax - axisMin || 1
  const W = 300, H = 190, baseY = 156, top = 22, barW = 78, gap = 56
  const xCurrent = 62, xTarget = xCurrent + barW + gap
  const heightFor = (v: number) => ((v - axisMin) / span) * (baseY - top)
  const yFor = (v: number) => baseY - heightFor(v)
  const fmt = (v: number) => `${formatGoalNumber(v, decimals)}${unit ? ` ${unit}` : ''}`
  const bar = (x: number, value: number, fill: string, label: string) => {
    const height = Math.max(heightFor(value), 2)
    const y = baseY - height
    return `<rect x="${x}" y="${y}" width="${barW}" height="${height}" rx="4" fill="${fill}"/><text x="${x + barW / 2}" y="${y - 9}" class="chart-value" text-anchor="middle">${esc(fmt(value))}</text><text x="${x + barW / 2}" y="${baseY + 20}" class="chart-label" text-anchor="middle">${label}</text>`
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${esc(fmt(current))} atual, meta de ${esc(fmt(target))}"><line x1="28" y1="${baseY}" x2="${W - 16}" y2="${baseY}" class="chart-axis"/>${bar(xCurrent, current, '#9aa4b8', 'Atual')}${bar(xTarget, target, `#${primaryHex}`, 'Meta')}</svg>`
}

export function printPresentationDocument(plan: Plan, patient: Patient | undefined, services: Service[], clinic: ClinicProfile, discount: number, goals: PresentationGoal[]) {
  const win = window.open('', '_blank', 'width=1000,height=780'); if (!win) return
  const patientName = esc(patient?.name ?? 'Paciente')
  const { start, totals } = planTextData(plan, services)
  const end = addWeeks(start, plan.duration)
  const subtotal = plan.weeks.flatMap(w => w.items).reduce((sum, item) => sum + (services.find(s => s.id === item.serviceId)?.price ?? 0) * (item.quantity ?? 1), 0)
  const total = subtotal * (1 - discount / 100)
  const { title: titleHex, heading: headingHex, secondary: secondaryHex } = brandHexes(clinic)

  const weekGrid = `<div class="pres-week-grid">${plan.weeks.map(w => {
    const date = addWeeks(start, w.number - 1)
    return `<article class="pres-week ${w.items.length ? '' : 'empty'}"><span>Semana ${String(w.number).padStart(2, '0')}</span><b>${format(date, 'dd/MM')} a ${format(addDays(date, 6), 'dd/MM')}</b>${w.items.length ? `<ul>${w.items.map(i => `<li>${esc(services.find(s => s.id === i.serviceId)?.name ?? 'Serviço')}${(i.quantity ?? 1) > 1 ? ` (${i.quantity}x)` : ''}</li>`).join('')}</ul>` : '<small>Sem aplicações previstas</small>'}</article>`
  }).join('')}</div>`

  const numericGoals = goals.filter((g): g is PresentationGoal & { current: number; target: number } => g.valueType === 'number' && g.current !== undefined && g.target !== undefined)

  const goalCards = goals.length ? `<section class="pres-section"><h2>Onde você está hoje → onde queremos chegar</h2><div class="pres-goal-cards">${goals.map(goal => {
    const currentDisplay = goal.valueType === 'number' ? `${formatGoalNumber(goal.current ?? 0, goal.decimals)}${goal.unit ? ` ${goal.unit}` : ''}` : (goal.currentText || '—')
    const targetDisplay = goal.valueType === 'number' ? `${formatGoalNumber(goal.target ?? 0, goal.decimals)}${goal.unit ? ` ${goal.unit}` : ''}` : (goal.targetText || '—')
    return `<article class="pres-goal-card"><h3>${esc(goal.name)}</h3><div class="pres-goal-values"><span>${esc(currentDisplay)}</span><b>→</b><span class="target">${esc(targetDisplay)}</span></div></article>`
  }).join('')}</div></section>` : ''

  const chartSection = numericGoals.length ? `<section class="pres-section"><h2>Gráficos</h2><div class="pres-chart-grid">${numericGoals.map(goal => `<article class="pres-chart-card"><h3>${esc(goal.name)}</h3>${goalChartSvg(goal.current, goal.target, goal.unit, goal.decimals, titleHex)}</article>`).join('')}</div></section>` : ''

  const html = `<!doctype html><html><head><title>Apresentação do plano</title><style>
@page{size:A4;margin:16mm}
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;color:#1c2536;font-size:15px;line-height:1.55;margin:0}
.print-btn{position:fixed;right:18px;top:18px;background:#${titleHex};color:white;border:0;border-radius:8px;padding:12px 18px;cursor:pointer;z-index:5;font-size:13px}
.pres-cover{min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;padding:60px 54px;page-break-after:always;break-after:page}
.pres-cover-top{display:flex;justify-content:space-between;align-items:center}
.pres-cover-top img{max-height:60px;max-width:190px;object-fit:contain}
.pres-cover-top b{font-size:20px;color:#${titleHex}}
.pres-cover-top span{display:block;color:#7c879a;font-size:12px;margin-top:4px}
.pres-cover-mid{text-align:center;margin:auto 0}
.pres-cover-mid>span{display:block;font-size:14px;letter-spacing:3px;font-weight:700;color:#${secondaryHex};text-transform:uppercase;margin-bottom:16px}
.pres-cover-mid h1{font:800 50px/1.2 Arial;margin:0 0 22px;color:#${titleHex};text-wrap:balance}
.pres-cover-meta{display:flex;justify-content:center;gap:46px;margin-top:8px}
.pres-cover-meta div{text-align:center}
.pres-cover-meta span{display:block;font-size:11px;letter-spacing:1.4px;color:#8b95a8;text-transform:uppercase;margin-bottom:7px}
.pres-cover-meta strong{font-size:23px;color:#1c2536}
.pres-section{padding:34px 50px}
.pres-section h2{font-size:13px;letter-spacing:1.6px;text-transform:uppercase;color:#${headingHex};margin:0 0 24px;display:flex;align-items:center;gap:11px}
.pres-section h2::before{content:'';width:28px;height:3px;background:#${titleHex};display:inline-block}
.pres-week-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pres-week{border:1px solid #dfe4ee;border-radius:12px;padding:16px 18px;break-inside:avoid}
.pres-week span{font-size:10px;letter-spacing:1.2px;color:#8b95a8;text-transform:uppercase}
.pres-week b{display:block;font-size:19px;color:#${titleHex};margin:4px 0 2px}
.pres-week small{color:#7c879a;font-size:11px}
.pres-week ul{margin:10px 0 0;padding-left:17px;font-size:13px;line-height:1.75}
.pres-week.empty{opacity:.55}
.pres-goal-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.pres-goal-card{border:1px solid #dfe4ee;border-radius:12px;padding:20px;text-align:center;break-inside:avoid}
.pres-goal-card h3{font-size:13px;margin:0 0 13px;color:#3a4560}
.pres-goal-values{display:flex;align-items:center;justify-content:center;gap:11px;font-size:18px;font-weight:700}
.pres-goal-values b{color:#8b95a8;font-weight:400}
.pres-goal-values .target{color:#${titleHex}}
.pres-chart-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:18px}
.pres-chart-card{border:1px solid #dfe4ee;border-radius:12px;padding:16px 16px 6px;break-inside:avoid}
.pres-chart-card h3{font-size:13px;margin:0 0 4px;text-align:center;color:#3a4560}
.chart-svg{width:100%;height:auto;display:block}
.chart-axis{stroke:#c6cedb;stroke-width:1}
.chart-value{font:700 13px Arial;fill:#1c2536}
.chart-label{font:600 11px Arial;fill:#7c879a}
.pres-included-row{display:flex;justify-content:space-between;border-bottom:1px solid #edf0f5;padding:11px 0;font-size:14px}
.pres-included-row b{color:#${titleHex}}
.pres-invest{display:flex;justify-content:space-between;align-items:center;border:2px solid #${titleHex};border-radius:14px;padding:26px 30px;break-inside:avoid}
.pres-invest span{display:block;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#8b95a8;margin-bottom:6px}
.pres-invest strong{font-size:33px;color:#${titleHex}}
.pres-invest small{display:block;color:#7c879a;font-size:12px;margin-top:5px}
@media print{.print-btn{display:none}.pres-section{break-inside:auto}}
</style></head><body>
<button class="print-btn" onclick="window.print()">Imprimir / Salvar PDF</button>
<section class="pres-cover">
  <div class="pres-cover-top"><div>${clinic.logo ? `<img src="${clinic.logo}" alt="Logo"/>` : `<b>${esc(clinic.name || 'Clínica')}</b>`}</div><span>${esc(clinic.doctorName)}${clinic.crm ? ` · ${esc(clinic.crm)}` : ''}</span></div>
  <div class="pres-cover-mid">
    <span>Apresentação do plano de acompanhamento</span>
    <h1>${patientName}</h1>
    <div class="pres-cover-meta">
      <div><span>Início</span><strong>${format(start, 'dd/MM/yyyy')}</strong></div>
      <div><span>Término previsto</span><strong>${format(end, 'dd/MM/yyyy')}</strong></div>
      <div><span>Duração</span><strong>${plan.duration} semanas</strong></div>
    </div>
  </div>
  <div></div>
</section>
<section class="pres-section"><h2>O que será feito</h2>${weekGrid}</section>
${goalCards}
${chartSection}
<section class="pres-section"><h2>O que está incluído</h2><div class="pres-included">${totals.length ? totals.map(s => `<div class="pres-included-row"><span>${esc(s.name)}</span><b>${s.qty}x</b></div>`).join('') : '<div class="pres-included-row"><span>Nenhuma aplicação cadastrada</span></div>'}</div></section>
<section class="pres-section"><h2>Investimento</h2><div class="pres-invest"><div><span>Valor do plano</span><strong>${money(total)}</strong>${discount > 0 ? `<small>Desconto de ${discount}% aplicado para ${plan.duration} semanas</small>` : ''}</div></div></section>
</body></html>`
  win.document.write(html); win.document.close()
}

const xmlEscape = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[char]!))
const textBytes = (value: string) => new TextEncoder().encode(value)
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (data: Uint8Array) => { let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0 }
const u16 = (value: number) => new Uint8Array([value & 255, (value >>> 8) & 255])
const u32 = (value: number) => new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255])
const joinBytes = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length } return out }
function makeZip(files: { name: string; data: string | Uint8Array }[]) {
  const local: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0
  for (const file of files) { const name = textBytes(file.name), data = typeof file.data === 'string' ? textBytes(file.data) : file.data, crc = crc32(data); const header = joinBytes([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name]); local.push(header, data); central.push(joinBytes([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name])); offset += header.length + data.length }
  const centralData = joinBytes(central); return joinBytes([...local, centralData, u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(centralData.length), u32(offset), u16(0)])
}
function contractTokens(plan: Plan, patient: Patient | undefined, services: Service[], clinic: ClinicProfile, discount: number, paymentMethod: string) {
  const { items, totals } = planTextData(plan, services); const subtotal = items.reduce((sum, i) => sum + (i.service?.price ?? 0) * i.quantity, 0), total = subtotal * (1 - discount / 100), today = new Date()
  const automatic: Record<string, string> = { '[NOME DO PACIENTE]': patient?.name ?? 'Paciente não associado', '[RAZÃO SOCIAL DA CLÍNICA]': clinic.legalName, '[CNPJ DA CLÍNICA]': clinic.cnpj, '[ENDEREÇO DA CLÍNICA COM CEP]': `${clinic.address}, CEP ${clinic.zipCode}, ${clinic.city}/${clinic.state}`, '[TELEFONE DA CLÍNICA]': clinic.phone, '[VALOR TOTAL DO PLANO]': money(total), '[(VALOR TOTAL POR ESCRITO)]': valueInWords(total), '[COLOCAR O RESUMO DAS QUANTIDADES E SERVIÇOS DO PLANO]': totals.map(s => `${s.qty} unidade(s) de ${s.name}`).join('; '), '[Cidade/UF da clínica]': `${clinic.city}/${clinic.state}`, '[Cidade da Clínica]': clinic.city, '[DIA]': format(today, 'dd'), '[MÊS]': format(today, 'MMMM', { locale: ptBR }), '[ANO]': format(today, 'yyyy') }
  const manual: Record<string, string> = { '{CPF}': '{CPF}', '{ENDEREÇO}': '{ENDEREÇO}', '{TELEFONE}': '{TELEFONE}', '{E-MAIL}': '{E-MAIL}', '{FORMA DE PAGAMENTO}': paymentMethod || '{FORMA DE PAGAMENTO}' }
  return { automatic, manual }
}
function wordRuns(text: string, automatic: Record<string, string>, manual: Record<string, string>) {
  const pattern = /(\[\(VALOR TOTAL POR ESCRITO\)\]|\[[^\]]+\]|\{[^}]+\})/g; let cursor = 0, xml = '', match: RegExpExecArray | null
  const run = (value: string, props = '') => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r>`
  while ((match = pattern.exec(text))) { xml += run(text.slice(cursor, match.index)); const token = match[0]; xml += token in automatic ? run(automatic[token], '<w:b/>') : run(manual[token] ?? token, '<w:highlight w:val="yellow"/>'); cursor = match.index + token.length }
  return xml + run(text.slice(cursor))
}
function logoDrawing(cx: number, cy: number) { return `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo da clínica"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>` }
function scheduleTableXml(plan: Plan, services: Service[], start: Date) {
  const weeksWithItems = plan.weeks.filter(w => w.items.length)
  if (!weeksWithItems.length) return ''
  const cell = (text: string, bold?: boolean) => `<w:tc><w:p>${bold ? `<w:pPr/><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>` : `<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`}</w:p></w:tc>`
  const header = `<w:tr>${cell('Semana', true)}${cell('Período', true)}${cell('Serviços', true)}</w:tr>`
  const body = weeksWithItems.map(w => {
    const from = addWeeks(start, w.number - 1)
    const names = w.items.map(i => services.find(s => s.id === i.serviceId)?.name ?? 'Serviço').join(', ')
    return `<w:tr>${cell(String(w.number).padStart(2, '0'))}${cell(`${format(from, 'dd/MM')} a ${format(addDays(from, 6), 'dd/MM')}`)}${cell(names)}</w:tr>`
  }).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="AAAAAA"/><w:left w:val="single" w:sz="4" w:color="AAAAAA"/><w:bottom w:val="single" w:sz="4" w:color="AAAAAA"/><w:right w:val="single" w:sz="4" w:color="AAAAAA"/><w:insideH w:val="single" w:sz="4" w:color="AAAAAA"/><w:insideV w:val="single" w:sz="4" w:color="AAAAAA"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="1200"/><w:gridCol w:w="2200"/><w:gridCol w:w="5500"/></w:tblGrid>${header}${body}</w:tbl>`
}
function goalsTableXml(goals: PresentationGoal[]) {
  if (!goals.length) return ''
  const cell = (text: string, bold?: boolean) => `<w:tc><w:p>${bold ? `<w:pPr/><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>` : `<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`}</w:p></w:tc>`
  const header = `<w:tr>${cell('Indicador', true)}${cell('Situação atual', true)}${cell('Meta', true)}${cell('Unidade', true)}</w:tr>`
  const body = goals.map(goal => {
    const current = goal.valueType === 'number' ? formatGoalNumber(goal.current ?? 0, goal.decimals) : (goal.currentText || '—')
    const target = goal.valueType === 'number' ? formatGoalNumber(goal.target ?? 0, goal.decimals) : (goal.targetText || '—')
    return `<w:tr>${cell(goal.name)}${cell(current)}${cell(target)}${cell(goal.unit ?? '—')}</w:tr>`
  }).join('')
  return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Objetivos do acompanhamento</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="AAAAAA"/><w:left w:val="single" w:sz="4" w:color="AAAAAA"/><w:bottom w:val="single" w:sz="4" w:color="AAAAAA"/><w:right w:val="single" w:sz="4" w:color="AAAAAA"/><w:insideH w:val="single" w:sz="4" w:color="AAAAAA"/><w:insideV w:val="single" w:sz="4" w:color="AAAAAA"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="2200"/><w:gridCol w:w="2200"/><w:gridCol w:w="1500"/></w:tblGrid>${header}${body}</w:tbl><w:p/>`
}
async function fetchClinicLogo(logoUrl?: string) {
  if (!logoUrl) return null
  try {
    const response = await fetch(logoUrl)
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') ?? ''
    const ext = contentType.includes('png') ? 'png' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpeg' : null
    if (!ext) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: contentType }))
    return { bytes, ext, type: contentType, width: bitmap.width, height: bitmap.height }
  } catch {
    return null
  }
}
export async function downloadContractDocx(plan: Plan, patient: Patient | undefined, services: Service[], clinic: ClinicProfile, discount: number, paymentMethod: string, goals: PresentationGoal[] = []) {
  const { automatic, manual } = contractTokens(plan, patient, services, clinic, discount, paymentMethod)
  const paragraphs = contractTemplate.map((paragraph, index) => { const text = paragraph.text; if (!text) return '<w:p/>'; const heading = index === 0 || /^(I|II|III|IV|V|VI|VII|VIII|IX|X)\s*[–-]/.test(text); return `<w:p><w:pPr>${heading ? `<w:pStyle w:val="${index === 0 ? 'Title' : 'Heading1'}"/>` : '<w:jc w:val="both"/><w:spacing w:after="120"/>'}</w:pPr>${wordRuns(text, automatic, manual)}</w:p>` }).join('')
  const scheduleStart = plan.startDate ? parseISO(plan.startDate) : new Date()
  const scheduleTable = scheduleTableXml(plan, services, scheduleStart)
  const scheduleSection = scheduleTable ? `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Cronograma do plano</w:t></w:r></w:p>${scheduleTable}<w:p/>` : ''
  const goalsSection = goalsTableXml(goals)
  const logo = await fetchClinicLogo(clinic.logo)
  const image = logo?.bytes, imageExt = logo?.ext ?? '', imageType = logo?.type ?? ''
  const maxCx = 2.5 * 914400, maxCy = 1 * 914400
  const scale = logo ? Math.min(maxCx / logo.width, maxCy / logo.height) : 1
  const { title: titleHex, heading: headingHex, secondary: secondaryHex } = brandHexes(clinic)
  const brand = logo ? logoDrawing(Math.round(logo.width * scale), Math.round(logo.height * scale)) : `<w:p><w:r><w:rPr><w:b/><w:color w:val="${headingHex}"/><w:sz w:val="28"/></w:rPr><w:t>${xmlEscape(clinic.name || 'Clínica')}</w:t></w:r></w:p>`
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${brand}<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:color w:val="${secondaryHex}"/></w:rPr><w:t>${xmlEscape(`${clinic.doctorName}${clinic.crm ? ` · ${clinic.crm}` : ''}`)}</w:t></w:r></w:p>${paragraphs}${scheduleSection}${goalsSection}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="240"/></w:pPr><w:rPr><w:b/><w:color w:val="${titleHex}"/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/></w:pPr><w:rPr><w:b/><w:color w:val="${headingHex}"/><w:sz w:val="22"/></w:rPr></w:style></w:styles>`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${image ? `<Default Extension="${imageExt}" ContentType="${imageType}"/>` : ''}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${image ? `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.${imageExt}"/>` : ''}<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  const files: { name: string; data: string | Uint8Array }[] = [{ name: '[Content_Types].xml', data: contentTypes }, { name: '_rels/.rels', data: rootRels }, { name: 'word/document.xml', data: documentXml }, { name: 'word/styles.xml', data: styles }, { name: 'word/_rels/document.xml.rels', data: docRels }]; if (image) files.push({ name: `word/media/logo.${imageExt}`, data: image })
  const blob = new Blob([makeZip(files) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `Contrato - ${patient?.name || plan.name}.docx`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
