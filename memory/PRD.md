# ProofLoop — Product Requirements Document

## Vision
AI-powered startup validation platform. Evidence-driven loop:
Startup Idea → Founder Interview → Startup Profile → Specialist Analysis → Critic Challenges Claims → Evidence Missions → Founder Submits Evidence → Evidence Evaluation → Chairman Re-evaluation → Investor Readiness Score.

## Tech Stack
- Next.js 15 App Router (catch-all API route `/app/app/api/[[...path]]/route.js`)
- Supabase (PostgreSQL) — schema in `/app/supabase_schema.sql` (applied by user in project `zbqvfubmlauotxcaemit`)
- OpenAI `gpt-5-nano` (user-mandated model, key in `/app/.env`)
- shadcn/ui + Tailwind, War Room dark command-center UI (`/app/app/page.js`)
- No authentication (V1 MVP, explicitly skipped)
- Core AI orchestration: `/app/lib/proofloop.js`

## AI Agents
1. Interview Agent — multi-turn founder interview (8-11 answers)
2. Profile Generator — 15-field structured startup profile
3. Specialists (parallel): Market, Product, Business & Finance, Growth
4. Critic Agent — extracts 6-10 challengeable claims with criticisms
5. Evidence Agent — generates measurable evidence missions per claim; evaluates founder submissions (VALIDATED / PARTIALLY_VALIDATED / UNPROVEN / REJECTED), may create follow-up missions
6. Chairman Agent — final assessment + explainable 7-category Investor Readiness Score

## Key API Endpoints (all /api prefixed)
- GET /api — health; GET/POST/DELETE /api/startups[...]; POST /api/interview, /api/interview/complete
- POST /api/analyze/specialists | critic | missions | chairman
- POST /api/missions/:id/submit; PUT /api/startups/:id/profile (change detection → affected agents)

## Status (June 2025)
- Backend: FULLY TESTED — all tasks PASSED (see /app/test_result.md)
- Missions timeout FIXED (parallel batches of 3, ~50s, HTTP 200) + frontend 502-resilience fallback
- Smart Re-Analysis SHIPPED + TESTED (auto rerun affected specialists + Chairman on profile edit, success notice, sidebar refresh)
- Investor One-Pager Export SHIPPED + TESTED (printable, zero AI calls)
- Pitch Practice SHIPPED + TESTED: 'Pitch Practice' nav tab; AI investor (dossier built from board reports/claims/score) grills founder, rates each answer 1-10 with feedback, coach debrief (overall 0-100, strengths/weaknesses/coaching/best/worst), sessions persisted in pitch_messages table, past-session list with resume. Endpoints: POST /api/pitch/start, /api/pitch, /api/pitch/debrief; GET /api/pitch/:startupId
- Score Milestones SHIPPED + TESTED: milestone timeline + next-milestone progress on Readiness tab (data-testid='milestones'); canvas-confetti celebration modal fires once per threshold (50/75) per startup (localStorage key pl-milestone-<id>-<t>)
- Mission Reminders SHIPPED + TESTED: due_date column on evidence_missions (migration 002), date picker on mission cards, red Overdue pills in Evidence Lab + Dashboard ('N overdue' in header), PUT /api/missions/:id
- Compare Versions SHIPPED + TESTED: Compare buttons in version history -> side-by-side red/green diff dialog with Score impact (before -> after + delta from score_history timestamps); GET /api/startups/:id/versions-full
- Migrations: /app/supabase_schema.sql (001) + /app/supabase_migration_002.sql — both applied by user in Supabase SQL Editor
- Demo startup "MealPrepPal" left in DB (has pitch sessions, overdue mission dated 2020-01-01, 3 profile versions)
- Known cosmetic nit (unfixed, trivial): smart re-analysis overlay stage description always lists all 4 specialist names even when only a subset runs

## Backlog
- P2: Modularize monolithic `page.js` (~1600 lines) and `proofloop.js`
- Cosmetic: dynamic agent names in smart re-analysis overlay description
