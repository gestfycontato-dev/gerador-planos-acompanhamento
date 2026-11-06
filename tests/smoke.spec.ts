import { test, expect, type Page } from '@playwright/test'

// Smoke test do caminho crítico do Gestfy. Roda contra um ambiente real (staging ou
// produção) com uma conta dedicada — ver README para como configurar as variáveis de
// ambiente. Os testes são sequenciais de propósito (test.describe.serial): cada um
// depende do estado deixado pelo anterior, igual a um usuário real percorrendo o fluxo.
// Ao final, os dados criados são apagados (afterAll) — a exclusão do paciente cascateia
// para plano, consulta e objetivos.

const EMAIL = process.env.SMOKE_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_PASSWORD ?? ''
const SUPABASE_URL = process.env.SMOKE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.SMOKE_SUPABASE_ANON_KEY ?? ''

test.skip(!EMAIL || !PASSWORD, 'SMOKE_EMAIL/SMOKE_PASSWORD não configurados — ver README (pnpm test:smoke).')

const PATIENT_NAME = `Smoke Test ${Date.now()}`

async function login(page: Page) {
  await page.goto('/')
  await page.getByLabel('E-mail').fill(EMAIL)
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByRole('button', { name: /Entrar/ }).click()
  await page.waitForSelector('text=RECEITA EM PLANOS', { timeout: 20_000 })
  const welcome = page.getByRole('button', { name: /Vamos lá/ })
  if (await welcome.isVisible().catch(() => false)) await welcome.click()
}

test.describe.serial('caminho crítico', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await login(page)
  })

  test.afterAll(async () => {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      })
      const { access_token } = await authRes.json()
      const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }
      // Apagar pelo nome, não por um id capturado no meio do teste: mais simples e robusto.
      // O paciente agora tem plano VENDIDO (teste 6) — a própria exclusão de paciente com
      // venda concluída é bloqueada de propósito (Parte 2 do Prompt 11), então primeiro
      // reverte o status da venda antes de excluir, só para permitir a limpeza automática.
      const patients: { id: string }[] = await fetch(`${SUPABASE_URL}/rest/v1/patients?select=id&name=eq.${encodeURIComponent(PATIENT_NAME)}`, { headers }).then(r => r.json())
      for (const patient of patients) {
        const plans: { id: string }[] = await fetch(`${SUPABASE_URL}/rest/v1/plans?select=id&patient_id=eq.${patient.id}`, { headers }).then(r => r.json())
        const planIds = plans.map(p => p.id)
        if (planIds.length) await fetch(`${SUPABASE_URL}/rest/v1/sales?plan_id=in.(${planIds.join(',')})`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'Plano não vendido' }) })
        await fetch(`${SUPABASE_URL}/rest/v1/patients?id=eq.${patient.id}`, { method: 'DELETE', headers })
      }
    }
    await page.close()
  })

  test('1. login e carregamento do painel', async () => {
    await expect(page.getByText('RECEITA EM PLANOS')).toBeVisible()
  })

  test('2. criar paciente', async () => {
    await page.getByRole('navigation').getByText('Pacientes', { exact: true }).click()
    await page.getByRole('button', { name: /Novo paciente/ }).click()
    await page.locator('.form-grid input').first().fill(PATIENT_NAME)
    await page.getByRole('button', { name: 'Salvar paciente' }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText(PATIENT_NAME)).toBeVisible()
  })

  test('3. criar plano com data de início, serviço e objetivos do catálogo', async () => {
    await page.getByRole('navigation').getByText('Criar plano', { exact: true }).click()
    await page.getByText('Criar plano de acompanhamento para paciente').click()
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.locator('.patient-select input').first().fill(PATIENT_NAME)
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Próximo' }).click()
    await page.locator('input[type="date"]').first().fill('2026-09-01')
    await page.getByRole('button', { name: 'Próximo' }).click()
    await page.locator('.segments.big').getByRole('button', { name: '8', exact: true }).click()
    await page.getByRole('button', { name: 'Próximo' }).click()

    await page.getByRole('button', { name: /Do catálogo/ }).click()
    await page.waitForTimeout(300)
    const items = page.locator('.goal-import-item input[type="checkbox"]')
    await items.nth(0).check()
    await items.nth(1).check()
    await page.getByRole('button', { name: 'Adicionar selecionados' }).click()
    await expect(page.locator('.goal-plan-row')).toHaveCount(2)

    await page.getByRole('button', { name: 'Ir para o calendário' }).click()
    await page.locator('.week-card').first().locator('.add-service').click()
    const serviceOption = page.locator('.service-menu button').first()
    if (await serviceOption.isVisible().catch(() => false)) await serviceOption.click()
    else notifyNoService(page)

    await page.getByRole('button', { name: 'Salvar plano' }).click()
    await page.locator('.save-modal input[list="save-patients"]').fill(PATIENT_NAME)
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.waitForTimeout(1000)
    await expect(page.getByText('Gerar documentos do plano')).toBeVisible()
  })

  test('4. gerar os três documentos e conferir conteúdo', async () => {
    const context = page.context()

    const [calendarPopup] = await Promise.all([context.waitForEvent('page'), page.locator('.document-options button', { hasText: 'Calendário semanal' }).click()])
    await calendarPopup.waitForLoadState('networkidle')
    await expect(calendarPopup.locator('body')).not.toBeEmpty()
    expect((await calendarPopup.locator('h1').first().innerText()).length).toBeGreaterThan(0)
    await calendarPopup.close()

    const [presentationPopup] = await Promise.all([context.waitForEvent('page'), page.locator('.document-options button', { hasText: 'Apresentação do plano' }).click()])
    await presentationPopup.waitForLoadState('networkidle')
    await expect(presentationPopup.locator('.pres-cover-mid h1')).toBeVisible()
    await presentationPopup.close()

    const [downloadEvent] = await Promise.all([page.waitForEvent('download'), page.locator('.document-options button', { hasText: 'Baixar contrato' }).click()])
    expect(downloadEvent.suggestedFilename()).toMatch(/\.docx$/)

    await page.locator('.documents-modal .icon-button').click()
  })

  test('5. rodar consulta SPIN curta e copiar para o prontuário', async () => {
    await page.getByRole('navigation').getByText('Pacientes', { exact: true }).click()
    await page.locator('.person-card', { hasText: PATIENT_NAME }).locator('[title="Assistente de vendas"]').click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Próxima fase →' }).click()
    await page.locator('.consultation-answer textarea').first().fill('Resposta de teste do smoke test.')
    await page.waitForTimeout(900)
    await page.getByRole('button', { name: 'Concluir consulta' }).click()
    await page.waitForTimeout(400)
    await expect(page.getByText('Consulta concluída')).toBeVisible()

    await page.getByRole('button', { name: 'Copiar para o prontuário' }).click()
    await page.waitForTimeout(400)
    const text = await page.locator('.record-summary-textarea').inputValue()
    expect(text).toContain('ANAMNESE')
    expect(text).not.toMatch(/<[a-z]+>/i)
    await page.locator('.record-summary-modal .icon-button').click()
  })

  test('6. vender o plano e conferir o snapshot', async () => {
    await page.getByRole('navigation').getByText('Vendas', { exact: true }).click()
    await page.waitForTimeout(500)
    const card = page.locator('.deal-card', { hasText: PATIENT_NAME })
    await card.locator('select').selectOption('Plano vendido')
    await page.waitForTimeout(800)
    await page.getByRole('navigation').getByText('Vendas', { exact: true }).click()
    await page.locator('.deal-card', { hasText: PATIENT_NAME }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('.deal-goals-table tbody tr')).toHaveCount(2)
    await page.locator('.deal-modal .icon-button').click()
  })
})

function notifyNoService(page: Page) {
  test.info().annotations.push({ type: 'warning', description: 'Nenhum serviço cadastrado na clínica de staging — pulei o passo de agendar serviço no plano.' })
  void page
}
