-- Index for state legislator reflection overrides (Phase 6)
-- Run after 009_state_legislation.sql

create index if not exists user_reflection_overrides_user_person_idx
  on public.user_reflection_overrides (user_id, person_id)
  where person_id is not null;
