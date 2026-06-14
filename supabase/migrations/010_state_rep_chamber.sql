-- State legislator chamber on saved representatives (Phase 5 lookup)
-- Run after 009_state_legislation.sql

alter table public.saved_representatives
  add column if not exists state_legislative_chamber text
  check (state_legislative_chamber is null or state_legislative_chamber in ('lower', 'upper'));
