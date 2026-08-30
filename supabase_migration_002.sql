-- ProofLoop migration 002 — Pitch Practice + Mission Reminders
-- Run ONCE in Supabase Dashboard -> SQL Editor -> New query -> Run (idempotent, safe to re-run)

create table if not exists public.pitch_messages (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  session_id uuid not null,
  role text not null, -- 'user' (founder) | 'assistant' (investor)
  content text not null,
  meta jsonb, -- { answer_rating, feedback, question_source } for investor turns; debrief payload on session end
  created_at timestamptz not null default now()
);
create index if not exists pitch_messages_startup_idx on public.pitch_messages (startup_id, session_id, created_at);

alter table public.evidence_missions add column if not exists due_date date;
