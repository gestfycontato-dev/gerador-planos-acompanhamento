begin;

create type public.sales_script_phase as enum ('rapport', 'situacao', 'problema', 'implicacao', 'necessidade', 'apresentacao', 'encaminhamento');
create type public.sales_script_item_type as enum ('check', 'answer', 'script', 'attention');
create type public.consultation_status as enum ('em_andamento', 'concluida', 'abandonada');

create table public.sales_scripts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  version integer not null default 1,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sales_script_items (
  id uuid primary key default gen_random_uuid(),
  sales_script_id uuid not null references public.sales_scripts(id) on delete cascade,
  phase public.sales_script_phase not null,
  phase_label text not null,
  section_label text,
  time_hint text,
  item_type public.sales_script_item_type not null,
  label text not null check (length(trim(label)) > 0),
  sort_order integer not null default 0
);

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete restrict,
  plan_id uuid references public.plans(id) on delete set null,
  sales_script_id uuid,
  status public.consultation_status not null default 'em_andamento',
  current_phase public.sales_script_phase not null default 'rapport',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  free_notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consultation_entries (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  item_id uuid,
  item_type public.sales_script_item_type not null,
  phase public.sales_script_phase not null,
  item_label text not null,
  answer_text text,
  checked boolean,
  updated_at timestamptz not null default now(),
  unique (consultation_id, item_id)
);

create index sales_scripts_clinic_idx on public.sales_scripts (clinic_id);
create unique index sales_scripts_global_default_idx on public.sales_scripts (is_default) where clinic_id is null and is_default;
create index sales_script_items_script_idx on public.sales_script_items (sales_script_id, sort_order);
create index consultations_clinic_patient_idx on public.consultations (clinic_id, patient_id);
create index consultations_plan_idx on public.consultations (plan_id);

create trigger sales_scripts_set_updated_at before update on public.sales_scripts
for each row execute function public.set_updated_at();
create trigger consultations_set_updated_at before update on public.consultations
for each row execute function public.set_updated_at();
create trigger consultation_entries_set_updated_at before update on public.consultation_entries
for each row execute function public.set_updated_at();

alter table public.sales_scripts enable row level security;
alter table public.sales_script_items enable row level security;
alter table public.consultations enable row level security;
alter table public.consultation_entries enable row level security;

create policy sales_scripts_select_global_or_member on public.sales_scripts
for select to authenticated using (clinic_id is null or public.is_clinic_member(clinic_id));

create policy sales_script_items_select_global_or_member on public.sales_script_items
for select to authenticated using (
  exists (
    select 1 from public.sales_scripts script
    where script.id = sales_script_id
      and (script.clinic_id is null or public.is_clinic_member(script.clinic_id))
  )
);

create policy consultations_member_all on public.consultations
for all to authenticated using (public.is_clinic_member(clinic_id)) with check (public.is_clinic_member(clinic_id));

create policy consultation_entries_select_member on public.consultation_entries
for select to authenticated using (
  exists (select 1 from public.consultations c where c.id = consultation_id and public.is_clinic_member(c.clinic_id))
);
create policy consultation_entries_insert_member on public.consultation_entries
for insert to authenticated with check (
  exists (select 1 from public.consultations c where c.id = consultation_id and public.is_clinic_member(c.clinic_id))
);
create policy consultation_entries_update_member on public.consultation_entries
for update to authenticated using (
  exists (select 1 from public.consultations c where c.id = consultation_id and public.is_clinic_member(c.clinic_id))
) with check (
  exists (select 1 from public.consultations c where c.id = consultation_id and public.is_clinic_member(c.clinic_id))
);
create policy consultation_entries_delete_member on public.consultation_entries
for delete to authenticated using (
  exists (select 1 from public.consultations c where c.id = consultation_id and public.is_clinic_member(c.clinic_id))
);

-- Seed do roteiro global (Anexo B) — clinic_id nulo, visível para qualquer clínica.
-- Personalização por clínica fica para depois: basta duplicar estas linhas com clinic_id preenchido.
with script as (
  insert into public.sales_scripts (clinic_id, name, version, is_default)
  values (null, 'Assistente de venda consultiva (SPIN)', 1, true)
  returning id
)
insert into public.sales_script_items (sales_script_id, phase, phase_label, section_label, time_hint, item_type, label, sort_order)
select script.id, v.phase::public.sales_script_phase, v.phase_label, v.section_label, v.time_hint, v.item_type::public.sales_script_item_type, v.label, v.sort_order
from script, (values
  ('rapport', 'FASE 1 — Recepção e rapport', 'Abertura e acolhimento', '0–5 min', 'check', 'Levantar para receber o paciente na recepção ou à porta da sala — nunca esperar sentado', 0),
  ('rapport', 'FASE 1 — Recepção e rapport', 'Abertura e acolhimento', '0–5 min', 'check', 'Cumprimentar pelo nome, fazer contato visual e sorrir antes de qualquer palavra técnica', 1),
  ('rapport', 'FASE 1 — Recepção e rapport', 'Abertura e acolhimento', '0–5 min', 'check', 'Perguntar como foi para chegar, se teve dificuldade — criando conexão antes da consulta', 2),
  ('rapport', 'FASE 1 — Recepção e rapport', 'Abertura e acolhimento', '0–5 min', 'script', '[Nome], que bom te ver aqui. Estou ansioso para te conhecer melhor e entender o que você está buscando. Pode sentar à vontade — hoje o tempo aqui é todo seu.', 3),
  ('rapport', 'FASE 1 — Recepção e rapport', 'Abertura e acolhimento', '0–5 min', 'script', 'Se o paciente parecer tenso ou inseguro: "Pode ficar à vontade, não tem resposta certa nem errada. Quero entender sua história do jeito que você quiser contar."', 4),
  ('rapport', 'FASE 1 — Recepção e rapport', 'Abertura e acolhimento', '0–5 min', 'attention', 'Rapport não começa com perguntas sobre saúde. Começa com presença e interesse genuíno pela pessoa. Os primeiros 2 minutos definem o tom de toda a consulta.', 5),

  ('situacao', 'FASE 2 — Investigação (SPIN)', '2.1 Situação — entender o contexto de vida', '5–20 min', 'answer', 'Há quanto tempo convive com o problema e o que já tentou antes para resolver', 6),
  ('situacao', 'FASE 2 — Investigação (SPIN)', '2.1 Situação — entender o contexto de vida', '5–20 min', 'answer', 'Rotina: trabalho, sono, alimentação e nível de atividade física', 7),
  ('situacao', 'FASE 2 — Investigação (SPIN)', '2.1 Situação — entender o contexto de vida', '5–20 min', 'answer', 'Histórico familiar e comorbidades (diabetes, hipertensão, tireoide)', 8),
  ('situacao', 'FASE 2 — Investigação (SPIN)', '2.1 Situação — entender o contexto de vida', '5–20 min', 'answer', 'O que motivou buscar ajuda agora — e não antes', 9),
  ('situacao', 'FASE 2 — Investigação (SPIN)', '2.1 Situação — entender o contexto de vida', '5–20 min', 'attention', 'Deixe o paciente falar. Resistir ao impulso de dar respostas antes de terminar a investigação é a habilidade mais importante dessa fase. Quanto mais o paciente fala, mais confiança ele deposita.', 10),

  ('problema', 'FASE 2 — Investigação (SPIN)', '2.2 Problema — expor a dor real', '20–35 min', 'answer', 'O que o problema atual está impedindo de fazer hoje (roupas, energia, relações, autoestima, saúde)', 11),
  ('problema', 'FASE 2 — Investigação (SPIN)', '2.2 Problema — expor a dor real', '20–35 min', 'check', 'Escutar sem interromper — deixar a pessoa completar o raciocínio e sentir que foi ouvida', 12),
  ('problema', 'FASE 2 — Investigação (SPIN)', '2.2 Problema — expor a dor real', '20–35 min', 'check', 'Validar a frustração com tentativas anteriores antes de oferecer qualquer solução', 13),
  ('problema', 'FASE 2 — Investigação (SPIN)', '2.2 Problema — expor a dor real', '20–35 min', 'attention', 'A pessoa quase sempre carrega culpa ou vergonha. Nomear isso sem julgamento — e atribuir a causa ao funcionamento do corpo, não ao comportamento — cria vínculo de confiança imediato e elimina a resistência emocional à compra.', 14),

  ('implicacao', 'FASE 2 — Investigação (SPIN)', '2.3 Implicação — ampliar a consciência do problema', '35–45 min', 'check', 'Mostrar os dados dos exames do paciente na tela — torná-lo coautor do diagnóstico', 15),
  ('implicacao', 'FASE 2 — Investigação (SPIN)', '2.3 Implicação — ampliar a consciência do problema', '35–45 min', 'check', 'Analisar os exames e conectar os achados com o que o paciente relatou', 16),
  ('implicacao', 'FASE 2 — Investigação (SPIN)', '2.3 Implicação — ampliar a consciência do problema', '35–45 min', 'check', 'Usar os dados para mostrar — não assustar — o que acontece se não houver intervenção', 17),
  ('implicacao', 'FASE 2 — Investigação (SPIN)', '2.3 Implicação — ampliar a consciência do problema', '35–45 min', 'check', 'Perguntar como o paciente vê a situação daqui a 1 ano se nada mudar', 18),
  ('implicacao', 'FASE 2 — Investigação (SPIN)', '2.3 Implicação — ampliar a consciência do problema', '35–45 min', 'attention', 'Perguntas sobre o futuro negativo criam urgência. Perguntas sobre o futuro positivo criam desejo. Use as duas em sequência — o contraste é poderoso.', 19),

  ('necessidade', 'FASE 2 — Investigação (SPIN)', '2.4 Necessidade de solução — criar o desejo', '45–55 min', 'check', 'Dar o diagnóstico de forma clara, conectando os achados à história do paciente', 20),
  ('necessidade', 'FASE 2 — Investigação (SPIN)', '2.4 Necessidade de solução — criar o desejo', '45–55 min', 'answer', 'Como seria diferente a vida com o problema resolvido — fazer o paciente imaginar', 21),
  ('necessidade', 'FASE 2 — Investigação (SPIN)', '2.4 Necessidade de solução — criar o desejo', '45–55 min', 'check', 'Apresentar o protocolo como a resposta exata para o que foi relatado', 22),
  ('necessidade', 'FASE 2 — Investigação (SPIN)', '2.4 Necessidade de solução — criar o desejo', '45–55 min', 'attention', 'Nunca apresente o tratamento antes de o paciente ter expressado o desejo em voz alta. Quando ele diz o que quer e você conecta o plano a isso, a proposta deixa de ser uma venda e vira uma solução personalizada.', 23),

  ('apresentacao', 'FASE 2 — Investigação (SPIN)', '2.5 Apresentação e fechamento do plano', '55–75 min', 'check', 'Apresentar o plano de forma estruturada: o que vai ser feito, por quanto tempo e por que cada elemento está ali — abre o documento de apresentação do plano', 24),
  ('apresentacao', 'FASE 2 — Investigação (SPIN)', '2.5 Apresentação e fechamento do plano', '55–75 min', 'check', 'Apresentar o valor como investimento — conectando ao que o paciente disse que quer conquistar', 25),
  ('apresentacao', 'FASE 2 — Investigação (SPIN)', '2.5 Apresentação e fechamento do plano', '55–75 min', 'check', 'Antecipar a principal objeção antes que o paciente fale (tempo, valor ou ceticismo)', 26),
  ('apresentacao', 'FASE 2 — Investigação (SPIN)', '2.5 Apresentação e fechamento do plano', '55–75 min', 'check', 'Fechar com pergunta de confirmação — nunca com silêncio ou "o que você acha?"', 27),
  ('apresentacao', 'FASE 2 — Investigação (SPIN)', '2.5 Apresentação e fechamento do plano', '55–75 min', 'attention', 'Nunca termine a consulta com "qualquer dúvida me chame". Termine sempre com um próximo passo concreto e agendado. Decisões sem prazo não acontecem.', 28),

  ('encaminhamento', 'FASE 2 — Investigação (SPIN)', '2.6 Encaminhamento para a recepção/comercial', '75–90 min', 'check', 'Levar o paciente pessoalmente até a recepção ou chamar a recepcionista para a sala', 29),
  ('encaminhamento', 'FASE 2 — Investigação (SPIN)', '2.6 Encaminhamento para a recepção/comercial', '75–90 min', 'check', 'Fazer a "ponte verbal": resumir o que foi decidido e reforçar a confiança na frente do paciente', 30),
  ('encaminhamento', 'FASE 2 — Investigação (SPIN)', '2.6 Encaminhamento para a recepção/comercial', '75–90 min', 'check', 'Já agendar o próximo encontro antes de o paciente sair', 31)
) as v(phase, phase_label, section_label, time_hint, item_type, label, sort_order);

commit;
