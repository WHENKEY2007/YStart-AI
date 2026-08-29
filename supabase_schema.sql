-- ProofLoop schema — run this ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.startups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  name text not null,
  idea text not null,
  stage text not null default 'interview',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.startup_profiles (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  profile jsonb not null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.startup_versions (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  profile jsonb not null,
  version int not null,
  changed_fields jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.interview_messages (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  agent_type text not null,
  report jsonb not null,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  claim text not null,
  category text,
  importance text default 'medium',
  criticism text,
  evidence_required boolean default true,
  reason text,
  status text not null default 'unproven',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evidence_missions (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete cascade,
  title text not null,
  claim text,
  description text,
  task_type text default 'other',
  instructions jsonb default '[]'::jsonb,
  success_criteria text,
  priority text default 'medium',
  status text not null default 'pending',
  is_followup boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.evidence_missions(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  description text,
  results text,
  metrics text,
  links text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.evidence_evaluations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.evidence_missions(id) on delete cascade,
  submission_id uuid not null references public.evidence_submissions(id) on delete cascade,
  startup_id uuid not null references public.startups(id) on delete cascade,
  status text not null,
  confidence int,
  evaluation jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.score_history (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  overall int not null,
  readiness_status text,
  categories jsonb not null,
  strongest_area text,
  biggest_weakness text,
  critical_objection text,
  next_action text,
  created_at timestamptz not null default now()
);

create index if not exists idx_interview_startup on public.interview_messages (startup_id, created_at);
create index if not exists idx_reports_startup on public.agent_reports (startup_id, agent_type, created_at desc);
create index if not exists idx_claims_startup on public.claims (startup_id);
create index if not exists idx_missions_startup on public.evidence_missions (startup_id);
create index if not exists idx_scores_startup on public.score_history (startup_id, created_at);
