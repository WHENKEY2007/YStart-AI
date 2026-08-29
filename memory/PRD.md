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
- Backend: FULLY TESTED end-to-end — all tasks PASSED (see /app/test_result.md)
- Missions timeout FIXED: claims chunked into batches of 3, generated in parallel → HTTP 200 in ~50s (was 502 at 60s). Frontend AnalysisRunner also has a 502-resilience fallback (checks DB for pending missions on gateway error).
- Smart Re-Analysis SHIPPED + TESTED: saving a profile edit auto-runs only affected specialists + Chairman (AnalysisRunner stages=['specialists','chairman']), auto-navigates to Readiness, emerald success notice (data-testid='smart-notice'), sidebar score refreshes.
- Investor One-Pager Export SHIPPED + TESTED: openOnePager() in page.js — printable light-themed one-pager (new window, Print/Save-as-PDF), composed from profile + score + validated claims + chairman report, ZERO AI calls. Buttons on Readiness tab (data-testid='export-onepager') + Dashboard.
- Frontend: FULLY TESTED (full War Room flow: landing → create → interview → profile → board → evidence → readiness → one-pager → smart re-analysis → dashboard). Demo startup "MealPrepPal" left in DB.
- Known cosmetic nit (unfixed, trivial): smart re-analysis overlay stage description always lists "Market · Product · Business · Growth" even when only a subset runs.

## Backlog
- P2: Modularize monolithic `page.js` (~1100 lines) and `proofloop.js`
- Cosmetic: dynamic agent names in smart re-analysis overlay description
