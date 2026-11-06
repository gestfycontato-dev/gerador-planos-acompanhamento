# Gerador de Planos de Acompanhamento

Primeira versão funcional de um produto para criar, vender e acompanhar planos clínicos semana a semana.

## Rodar localmente

Pré-requisitos: Node.js 20 ou mais recente e pnpm (gerenciador de pacotes do projeto).

Crie um `.env.local` na raiz com as credenciais do Supabase (veja `.env.example`):

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
```

Sem essas variáveis a aplicação abre na tela "Configuração necessária".

```bash
pnpm install
pnpm run dev
```

Abra o endereço exibido no terminal (normalmente `http://localhost:5173`). Para validar a versão de produção:

```bash
pnpm run build
pnpm run preview
```

## Testes

`pnpm test:smoke` roda o caminho crítico de ponta a ponta com Playwright (login, criar
paciente, montar plano com objetivos do catálogo, gerar os três documentos, rodar uma
consulta SPIN curta e vender o plano). **Rodar antes de todo deploy.** Precisa de um
usuário dedicado de staging/produção — nunca a conta real de um cliente — configurado
por variáveis de ambiente:

```env
SMOKE_BASE_URL=https://gerador-planos-acompanhamento.vercel.app
SMOKE_EMAIL=conta-dedicada@exemplo.com
SMOKE_PASSWORD=
SMOKE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
SMOKE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
```

Os dois últimos (`SMOKE_SUPABASE_*`) são usados só para apagar, ao final, o paciente de
teste criado durante a corrida — sem eles o teste roda igual, mas não limpa sozinho. Sem
`SMOKE_EMAIL`/`SMOKE_PASSWORD` configurados, o teste é pulado (não falha o build).

Segurança multi-tenant tem script próprio, não faz parte do smoke test: ver
`scripts/rls-matrix.mjs` e `docs/seguranca-rls.md`.

## Publicar

O projeto é um frontend Vite estático, publicado no Vercel (projeto `gerador-planos-acompanhamento`, já existente — não criar um novo). Configuração em `vercel.json`:

- comando de build: `pnpm run build`
- pasta de saída: `dist`
- versão do Node.js: 24.x (definida no projeto Vercel)

As mesmas duas variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) precisam estar cadastradas em Project Settings → Environment Variables (Production/Preview/Development).

## O que já funciona

- cadastro e login por clínica (Supabase Auth);
- construtor semanal com durações prontas ou customizadas;
- múltiplos serviços por semana;
- repetição semanal, quinzenal e por intervalo;
- cópia de uma semana para a seguinte;
- cálculo de preço e renovação;
- biblioteca de planos/templates, pacientes e serviços;
- CRM em cinco estágios, com snapshot imutável ao marcar como vendido;
- upload de logo da clínica (Supabase Storage);
- layout responsivo.

## Persistência

Os dados são reais, salvos no Supabase (Postgres) — não há mock em produção. Cada tabela tem `clinic_id` e Row Level Security ativa, restringindo cada consulta à clínica do usuário autenticado (`is_clinic_member`). O schema/migration fica em `supabase/migrations/`; é a fonte de verdade e não deve ser recriado do zero. O snapshot da venda é gravado em uma coluna JSONB (`sales.sold_snapshot`) no momento em que o plano é marcado como vendido, e não é sobrescrito por edições posteriores no plano.

Variáveis de ambiente necessárias (aplicação e deploy):

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```
