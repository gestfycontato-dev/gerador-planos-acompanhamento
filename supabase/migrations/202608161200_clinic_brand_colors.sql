alter table public.clinics
  add column if not exists brand_primary_color text,
  add column if not exists brand_secondary_color text;
