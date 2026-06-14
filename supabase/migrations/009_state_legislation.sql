-- State legislation & roll-call votes (Open States bulk CSV ingest)
-- Run after 008_user_reflection_overrides.sql

-- ---------------------------------------------------------------------------
-- State legislators (ocd-person IDs)
-- ---------------------------------------------------------------------------

create table public.state_legislators (
  person_id text primary key,
  state char(2) not null,
  name text not null,
  given_name text,
  family_name text,
  party text,
  chamber text not null check (chamber in ('lower', 'upper')),
  district text,
  image_url text,
  email text,
  ingested_at timestamptz not null default timezone('utc', now())
);

create index state_legislators_state_chamber_idx
  on public.state_legislators (state, chamber);

-- ---------------------------------------------------------------------------
-- State bills
-- ---------------------------------------------------------------------------

create table public.state_bills (
  bill_id text primary key,
  state char(2) not null,
  session text not null,
  identifier text not null,
  title text,
  summary text,
  subjects text[] not null default '{}',
  issue_slugs text[] not null default '{}',
  chamber text check (chamber in ('lower', 'upper')),
  ingested_at timestamptz not null default timezone('utc', now())
);

create index state_bills_state_session_idx on public.state_bills (state, session);
create index state_bills_issue_slugs_gin on public.state_bills using gin (issue_slugs);

-- ---------------------------------------------------------------------------
-- State roll-call votes
-- ---------------------------------------------------------------------------

create table public.state_roll_call_votes (
  vote_id text primary key,
  state char(2) not null,
  session text not null,
  chamber text not null check (chamber in ('lower', 'upper')),
  voted_at timestamptz not null,
  motion_text text,
  motion_classification text[] not null default '{}',
  result text,
  related_bill_id text references public.state_bills (bill_id) on delete set null,
  organization_id text,
  scoring_relevant boolean not null default true,
  ingested_at timestamptz not null default timezone('utc', now())
);

create index state_roll_call_votes_voted_at_idx
  on public.state_roll_call_votes (voted_at desc);
create index state_roll_call_votes_bill_idx
  on public.state_roll_call_votes (related_bill_id);
create index state_roll_call_votes_state_session_idx
  on public.state_roll_call_votes (state, session);
create index state_roll_call_votes_scoring_idx
  on public.state_roll_call_votes (scoring_relevant)
  where scoring_relevant = true;

-- ---------------------------------------------------------------------------
-- Per-legislator positions
-- ---------------------------------------------------------------------------

create table public.state_roll_call_positions (
  vote_id text not null references public.state_roll_call_votes (vote_id) on delete cascade,
  person_id text not null references public.state_legislators (person_id) on delete cascade,
  position text not null check (
    position in ('Yea', 'Nay', 'Not Voting', 'Present')
  ),
  party text,
  primary key (vote_id, person_id)
);

create index state_roll_call_positions_person_idx
  on public.state_roll_call_positions (person_id);
create index state_roll_call_positions_vote_idx
  on public.state_roll_call_positions (vote_id);

-- ---------------------------------------------------------------------------
-- Profile / saved rep extensions for state lookup (runtime phases)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists state_house_district text,
  add column if not exists state_senate_district text;

alter table public.saved_representatives
  add column if not exists person_id text;

create index if not exists saved_representatives_person_idx
  on public.saved_representatives (person_id)
  where person_id is not null;

alter table public.user_reflection_overrides
  add column if not exists person_id text;

-- ---------------------------------------------------------------------------
-- Ingest audit extensions
-- ---------------------------------------------------------------------------

alter table public.ingest_runs
  add column if not exists state_abbr char(2),
  add column if not exists session_identifier text;

alter table public.ingest_runs drop constraint if exists ingest_runs_mode_check;

alter table public.ingest_runs add constraint ingest_runs_mode_check
  check (mode in ('full', 'fast', 'votes_only', 'bills_only', 'openstates_session'));

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.state_legislators enable row level security;
alter table public.state_bills enable row level security;
alter table public.state_roll_call_votes enable row level security;
alter table public.state_roll_call_positions enable row level security;

create policy "state_legislators_select_authenticated"
  on public.state_legislators for select to authenticated using (true);

create policy "state_bills_select_authenticated"
  on public.state_bills for select to authenticated using (true);

create policy "state_roll_call_votes_select_authenticated"
  on public.state_roll_call_votes for select to authenticated using (true);

create policy "state_roll_call_positions_select_authenticated"
  on public.state_roll_call_positions for select to authenticated using (true);

create policy "state_legislators_select_anon"
  on public.state_legislators for select to anon using (true);

create policy "state_bills_select_anon"
  on public.state_bills for select to anon using (true);

create policy "state_roll_call_votes_select_anon"
  on public.state_roll_call_votes for select to anon using (true);

create policy "state_roll_call_positions_select_anon"
  on public.state_roll_call_positions for select to anon using (true);

create policy "state_legislators_service_role_all"
  on public.state_legislators for all to service_role
  using (true) with check (true);

create policy "state_bills_service_role_all"
  on public.state_bills for all to service_role
  using (true) with check (true);

create policy "state_roll_call_votes_service_role_all"
  on public.state_roll_call_votes for all to service_role
  using (true) with check (true);

create policy "state_roll_call_positions_service_role_all"
  on public.state_roll_call_positions for all to service_role
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Helper view for API layer
-- ---------------------------------------------------------------------------

create or replace view public.state_member_votes_enriched as
select
  p.person_id,
  p.position,
  p.party,
  v.vote_id,
  v.voted_at,
  v.chamber,
  v.state,
  v.session,
  v.motion_text,
  v.motion_classification,
  v.result,
  v.related_bill_id,
  b.identifier as bill_identifier,
  b.title as bill_title,
  b.summary as bill_summary,
  b.issue_slugs as bill_issue_slugs,
  v.scoring_relevant
from public.state_roll_call_positions p
join public.state_roll_call_votes v on v.vote_id = p.vote_id
left join public.state_bills b on b.bill_id = v.related_bill_id;
