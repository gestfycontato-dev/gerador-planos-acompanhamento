# Regressão funcional — Prompt 11 (Parte 3)

Rodado em 26–27/08/2026 contra a clínica B recém-criada (base limpa, ver `.env.test` e
`scripts/seed-clinic-b.mjs`), mais o painel admin com as duas clínicas reais (A e B) lado
a lado. Itens marcados **[sessão anterior]** foram validados em prompts anteriores desta
mesma conversa, com evidência (screenshots, PDFs extraídos, logs) já revisada por mim —
não refeitos do zero aqui porque a funcionalidade e o código não mudaram desde então.

## Resultado resumido

| Item | Resultado |
|---|---|
| Upload de logo, extração de cores, override manual | ✅ [sessão anterior — Prompts de configuração/marca] |
| Categoria, serviços, regras de desconto | ✅ testado agora (seed + criação manual na clínica B) |
| Template de plano e template de objetivos | ✅ testado agora |
| Plano nas 4 combinações (template/zero × template/zero) | ✅ template+template testado agora nesta sessão; zero+zero coberto pelo smoke test; as outras duas combinações usam os dois mesmos toggles independentes, já cobertos individualmente — não repeti a matriz completa |
| Máscaras do catálogo (Dor, Peso, Altura, IMC, Berg, SCORAD) | ⚠️ ver "Falha encontrada" abaixo |
| Data de início real no calendário/contrato/apresentação | ✅ [sessão anterior — Prompt 7, com datas reais 01/09/2026 conferidas nos três documentos] |
| Plano sem data não quebra os três documentos | ✅ confirmado por revisão de código: os três geradores usam `plan.startDate ? parseISO(...) : new Date()` — nunca lançam. O banco não permite `start_date` nulo hoje (`not null`), então "plano legado sem data" só existe como estado transitório do rascunho local, já coberto pelo fallback |
| Assistente SPIN completo, fechar e retomar no meio | ✅ [sessão anterior — Prompt 5, incluindo teste de fechar o navegador e retomar na fase certa] |
| Copiar para o prontuário (acentuação, sem tags, ordem) | ✅ [sessão anterior — Prompts 6 e 8] + confirmado de novo no smoke test desta sessão |
| Apresentação: gráficos, escala 105→85, 1 e 10 objetivos, sem objetivos | ✅ [sessão anterior — Prompt 7, com correção real de escala documentada] |
| Impressão da apresentação sem cortar, `break-inside: avoid`, cores da marca | ✅ [sessão anterior — Prompt 7, PDF de 10 objetivos extraído e conferido página a página] |
| Vender, editar depois, snapshot mantém valores originais | ✅ [sessão anterior — Prompt 8] + confirmado de novo no smoke test desta sessão |
| Fila de renovação no momento certo | ✅ confirmado por revisão de código (`contactDate = vencimento − 15 dias`, `needsAction = hoje ≥ contactDate`); clínica B com vencimento em 27/10/2026 corretamente não aparece como pendente hoje (26/08/2026) |
| Painel admin: contagens batendo com a realidade | ✅ testado agora — clínica B mostrou 1 membro/1 paciente/1 plano/1 venda (exatamente o que foi semeado); clínica A mostrou os números reais de produção |
| Filtro por status, ordenação por último acesso | ✅ [sessão anterior — Prompt 10] |
| `last_seen_at` atualizando no login | ✅ testado de novo no Prompt 11 (Parte 1) com antes/depois real |
| Edição de status de cobrança gravando `updated_by` | ✅ [sessão anterior — Prompt 10, histórico mostrando e-mail de quem alterou] |

## Falha encontrada (não bloqueante, decisão de produto pendente)

**Altura não recusa valores fora de faixa** (ex.: `178` em vez de `1,78`). O catálogo
(`goal_catalog`, seed do Anexo A) tem `min_value`/`max_value` nulos para Altura — só Peso,
IMC (sem faixa, só 2 casas), Dor, Berg e SCORAD têm faixa definida. Sem faixa cadastrada,
o app não tem como rejeitar `178`: a validação de faixa só existe no momento de salvar
(`confirmSave` em `PlanBuilderPage.tsx`), comparando com `catalogMin`/`catalogMax` — e não
há o que comparar quando esses valores são nulos.

Não corrigi sozinho porque definir o intervalo fisiologicamente aceitável de altura (em
metros) é uma decisão de produto, não uma correção técnica óbvia — não vou inventar
`min`/`max` num campo clínico sem confirmação. Se a decisão for, por exemplo, `0,30` a
`2,50` m, basta uma migração de `update` na linha `Altura` de `goal_catalog`; o mecanismo
de validação já existe e funciona (confirmado com Dor: tentar salvar `Dor = 11` bloqueia
com a mensagem `"Dor" deve ficar entre 1 e 10` e não deixa a venda ser salva).

## Evidência das checagens feitas nesta sessão

- Máscaras: `Peso` truncou `105,44` → `105,4` (1 casa); `IMC` truncou `32,555` → `32,55`
  (2 casas); `Dor = 11` bloqueou o salvamento com toast e manteve o modal aberto.
- Combinação template+template: template de cronograma "Template alvo RLS" preencheu 1
  semana com serviço; template de objetivos "Emagrecimento padrão" preencheu 1 objetivo
  (Peso) — ambos os pré-preenchimentos corretos.
- Exclusão/arquivamento de paciente (Parte 2): paciente com venda concluída → exclusão
  bloqueada com `"Não é possível excluir um paciente com plano vendido. Arquive o
  paciente em vez de excluir."`; paciente sem venda → exclusão bem-sucedida, e o plano e
  a consulta vinculados desapareceram junto (cascata sem órfão).
- Painel admin com as duas clínicas reais lado a lado, contagens conferidas uma a uma.
