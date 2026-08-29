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
- Backend: FULLY TESTED end-to-end by backend testing agent — all 11 tasks PASSED (see /app/test_result.md)
- Frontend: implemented, NOT yet tested by agent (user permission pending)
- Known infra note: POST /api/analyze/missions may exceed the 60s Cloudflare/ingress timeout → client sees 502 even though backend completes successfully and missions ARE saved. Potential fix: chunked/parallel mission generation or frontend polling after 502.

## Backlog
- P1: Change detection → rerun only affected agents on profile edit (detection done; rerun wiring exists via agents subset param)
- P2: Modularize monolithic `page.js` (996 lines) and `proofloop.js`
- Fix missions endpoint timeout (chunking or polling)
