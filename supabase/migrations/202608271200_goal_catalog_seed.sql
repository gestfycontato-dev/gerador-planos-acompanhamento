begin;

alter table public.goal_catalog add constraint goal_catalog_name_key unique (name);

-- Seed do catálogo global de indicadores (Anexo A)
insert into goal_catalog
  (name, unit, value_type, decimals, min_value, max_value, default_direction, sort_order, active)
values
  ('Peso',                                'kg',    'decimal', 1, null, null,  'decrease',  1, true),
  ('Altura',                              'm',     'decimal', 2, null, null,  'target',    2, true),
  ('Circunferência abdominal',            'cm',    'decimal', 1, null, null,  'decrease',  3, true),
  ('IMC',                                 null,    'decimal', 2, null, null,  'decrease',  4, true),
  ('Nível de gordura visceral',           null,    'integer', 0, null, null,  'decrease',  5, true),
  ('Escala de Montgomery & Åsberg',       'pontos','integer', 0, null, null,  'decrease',  6, true),
  ('Força',                               'kgf',   'decimal', 1, null, null,  'increase',  7, true),
  ('Dor',                                 null,    'integer', 0, 1,    10,    'decrease',  8, true),
  ('Quedas',                              null,    'integer', 0, 0,    null,  'decrease',  9, true),
  ('Escala de Berg',                      'pontos','integer', 0, 1,    56,    'increase', 10, true),
  ('Planimetria digital',                 'cm²',   'decimal', 1, 0,    null,  'decrease', 11, true),
  ('IGA',                                 null,    'integer', 0, 0,    4,     'decrease', 12, true),
  ('SCORAD',                              null,    'integer', 0, 0,    103,   'decrease', 13, true),
  ('Evacuações diárias espontâneas',      null,    'integer', 0, 0,    null,  'increase', 14, true),
  ('Número de articulações doloridas',    null,    'integer', 0, 0,    null,  'decrease', 15, true),
  ('Uricemia',                            'mg/dl', 'decimal', 1, 0,    null,  'decrease', 16, true),
  ('Testosterona total',                  'ng/dl', 'decimal', 1, 0,    null,  'increase', 17, true),
  ('Testosterona livre',                  'ng/dl', 'decimal', 2, 0,    null,  'increase', 18, true),
  ('Endometriose — dias de dor no mês',   'dias',  'integer', 0, 0,    31,    'decrease', 19, true),
  ('Dias de sangramento no ciclo',        'dias',  'integer', 0, 0,    31,    'decrease', 20, true),
  ('Crises de asma no mês',               null,    'integer', 0, 0,    null,  'decrease', 21, true),
  ('Idas ao banheiro durante a noite',    null,    'integer', 0, 0,    null,  'decrease', 22, true),
  ('Dias com sintomas de rinite no mês',  'dias',  'integer', 0, 0,    31,    'decrease', 23, true)
on conflict (name) do nothing;

commit;
