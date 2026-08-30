import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano'

export const db = createClient(
  process.env.SUPABASE_URL || 'https://zbqvfubmlauotxcaemit.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpicXZmdWJtbGF1b3R4Y2FlbWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODAyMTY2MSwiZXhwIjoyMTAzNTk3NjYxfQ.KbfYh58D03JtcKkdqukr0NIecYbtruIgTUB-SePYpu8',
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)

// ---------- AI helper (JSON mode with retry + validation) ----------
export async function aiJSON(system, user) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey.trim() === '' || apiKey.includes('placeholder')) {
    throw new Error('OPENAI_API_KEY is missing. Please add your OpenAI API key in .env.local (e.g. OPENAI_API_KEY=sk-...)')
  }
  const client = new OpenAI({ apiKey: apiKey.trim() })
  const model = process.env.OPENAI_MODEL || 'gpt-5-nano'

  let lastErr = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const c = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system + '\n\nCRITICAL: Respond ONLY with a single valid JSON object. No markdown, no commentary.' },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      })
      const txt = c.choices?.[0]?.message?.content || ''
      return JSON.parse(txt)
    } catch (e) {
      lastErr = e
      console.error('aiJSON attempt', attempt + 1, 'failed:', e.message)
    }
  }
  throw lastErr
}

export const arr = (v) => (Array.isArray(v) ? v : v ? [String(v)] : [])
export const str = (v) => (typeof v === 'string' ? v : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))
export const clampInt = (v, lo, hi, dflt) => {
  const n = parseInt(v)
  if (isNaN(n)) return dflt
  return Math.max(lo, Math.min(hi, n))
}

// ---------- Progressive Interview Topics & Heuristic State Machine ----------
const INTERVIEW_TOPICS = [
  {
    topic: 'target_customer',
    getQuestion: (startup, lastAnswer) =>
      `For "${startup.name}", who is your exact ideal customer or primary user segment? Be as specific as possible.`,
  },
  {
    topic: 'customer_problem',
    getQuestion: (startup, lastAnswer) =>
      `What is the most painful, urgent problem that these customers face right now that makes them need "${startup.name}"?`,
  },
  {
    topic: 'current_alternatives',
    getQuestion: (startup, lastAnswer) =>
      `How are those customers currently solving or working around this problem today without "${startup.name}"?`,
  },
  {
    topic: 'solution_difference',
    getQuestion: (startup, lastAnswer) =>
      `What makes your approach 10x better or fundamentally different compared to existing tools or competitors?`,
  },
  {
    topic: 'pricing_business_model',
    getQuestion: (startup, lastAnswer) =>
      `How do you plan to monetize "${startup.name}"? What is your pricing structure (e.g. subscription, usage-based, one-time)?`,
  },
  {
    topic: 'first_100_users',
    getQuestion: (startup, lastAnswer) =>
      `How will you acquire your very first 100 paying customers or active users without a large marketing budget?`,
  },
  {
    topic: 'traction_evidence',
    getQuestion: (startup, lastAnswer) =>
      `What early evidence or signals do you have so far (e.g. customer conversations, waitlist signups, prototypes, pre-orders)?`,
  },
  {
    topic: 'key_assumptions',
    getQuestion: (startup, lastAnswer) =>
      `What is the single biggest assumption or risk that could make "${startup.name}" fail if it turns out to be wrong?`,
  },
]

export const VALID_TASK_TYPES = ['interview', 'survey', 'landing_page', 'prototype', 'customer_outreach', 'analytics', 'pricing_test', 'waitlist', 'other']

export async function interviewTurn(startup, history = []) {
  const userAnswers = history.filter((m) => m.role === 'user')
  const answersCount = userAnswers.length
  const lastUserAnswer = userAnswers[userAnswers.length - 1]?.content || ''
  const transcript = history.map((m) => `${m.role === 'user' ? 'FOUNDER' : 'INTERVIEWER'}: ${m.content}`).join('\n')

  const stageIdx = Math.min(answersCount, INTERVIEW_TOPICS.length - 1)
  const currentStage = INTERVIEW_TOPICS[stageIdx]
  const isLastTurn = answersCount >= 8

  // Fallback question from our structured stage machine
  const fallbackQuestion = isLastTurn
    ? `Great insights! You've provided the essential details for "${startup.name}". Click 'Generate Startup Profile' to convene the AI Board.`
    : currentStage.getQuestion(startup, lastUserAnswer)

  const system = `You are the Founder Interview Agent of YStart-AI. You are interviewing the founder of "${startup.name}" about their startup concept: "${startup.idea}".

YOUR OBJECTIVE:
- Ask ONE short, sharp, plain-English question (1-2 sentences max).
- CRITICAL: Never repeat a question that was already asked in the interview.
- Each turn must focus on a NEW dimension of their business in this sequence:
  1. Target Customer Segment
  2. Urgent Customer Problem
  3. Existing Workarounds & Competitors
  4. 10x Differentiation / Value Prop
  5. Pricing, Revenue Model & Willingness to Pay
  6. Go-To-Market / First 100 Users Acquisition
  7. Early Traction & Evidence
  8. Critical Unproven Assumptions & Risks
- Progress: The founder has answered ${answersCount} questions so far (target: 8 questions).
- On turn ${answersCount + 1}, focus on: ${currentStage.topic}.
- When done (${answersCount} >= 8), set done=true and tell the founder their profile is ready to generate.

Return JSON: {"question": string, "done": boolean, "progress": number, "topic": string}`

  const user = `STARTUP NAME: ${startup.name}\nIDEA: ${startup.idea}\nCURRENT STAGE TOPIC: ${currentStage.topic}\n\nINTERVIEW TRANSCRIPT SO FAR:\n${transcript || `(First question — ask specifically about the target customer for ${startup.name}: ${startup.idea})`}`

  try {
    const out = await aiJSON(system, user)
    const qText = str(out.question).trim()
    return {
      question: qText || fallbackQuestion,
      done: isLastTurn ? true : Boolean(out.done),
      progress: clampInt(out.progress, 0, 100, Math.min(95, Math.round(((answersCount + 1) / 8) * 100))),
      topic: str(out.topic) || currentStage.topic,
    }
  } catch (e) {
    console.warn('interviewTurn using structured fallback:', e.message)
    return {
      question: fallbackQuestion,
      done: isLastTurn,
      progress: Math.min(95, Math.round(((answersCount + 1) / 8) * 100)),
      topic: currentStage.topic,
    }
  }
}

// ---------- Profile generation ----------
export const PROFILE_FIELDS = ['startup_name','idea','target_customer','customer_problem','current_alternatives','solution','value_proposition','competitors','business_model','pricing','growth_strategy','first_100_users','traction','existing_evidence','key_assumptions']

export async function generateProfile(startup, history = []) {
  const transcript = history.map((m) => `${m.role === 'user' ? 'FOUNDER' : 'INTERVIEWER'}: ${m.content}`).join('\n')
  const system = `You convert a founder interview into a clean Startup Profile for YStart-AI.
Use simple, concise language (1-2 clear sentences per field). If missing, write "Not specified".

Return JSON with EXACTLY these keys:
{"startup_name": string, "idea": string, "target_customer": string, "customer_problem": string, "current_alternatives": string, "solution": string, "value_proposition": string, "competitors": string[], "business_model": string, "pricing": string, "growth_strategy": string, "first_100_users": string, "traction": string, "existing_evidence": string[], "key_assumptions": string[]}`
  const user = `STARTUP NAME: ${startup.name}\nIDEA: ${startup.idea}\n\nINTERVIEW TRANSCRIPT:\n${transcript}`
  
  try {
    const out = await aiJSON(system, user)
    const profile = {}
    for (const f of PROFILE_FIELDS) {
      if (['competitors', 'existing_evidence', 'key_assumptions'].includes(f)) profile[f] = arr(out[f]).map(str)
      else profile[f] = str(out[f]) || (f === 'startup_name' ? startup.name : f === 'idea' ? startup.idea : 'Not specified')
    }
    return profile
  } catch (e) {
    console.warn('generateProfile fallback used:', e.message)
    // Intelligent heuristic profile extraction from answers
    const userAnswers = history.filter((m) => m.role === 'user').map((m) => m.content)
    return {
      startup_name: startup.name,
      idea: startup.idea,
      target_customer: userAnswers[0] || 'Target customers identified in concept',
      customer_problem: userAnswers[1] || 'Core problem described in idea',
      current_alternatives: userAnswers[2] || 'Manual workarounds or standard market tools',
      solution: userAnswers[3] || startup.idea,
      value_proposition: userAnswers[3] || `${startup.name} provides a modern solution for ${startup.idea}`,
      competitors: ['Incumbents and manual alternatives'],
      business_model: userAnswers[4] || 'Direct monetization / SaaS',
      pricing: userAnswers[4] || 'Subscription or transaction-based',
      growth_strategy: userAnswers[5] || 'Direct outreach and organic community acquisition',
      first_100_users: userAnswers[5] || 'Targeted founder outreach to initial niche users',
      traction: userAnswers[6] || 'Early concept stage / Initial customer validation',
      existing_evidence: userAnswers[6] ? [userAnswers[6]] : ['Initial problem discovery conversations'],
      key_assumptions: userAnswers[7] ? [userAnswers[7]] : ['Customers are willing to pay for this solution', 'Solution delivers quantifiable time/cost savings'],
    }
  }
}

// ---------- Specialist agents ----------
const SPECIALISTS = {
  market: { title: 'Market Agent', focus: 'target users, problem pain, market need, and competitors' },
  product: { title: 'Product Agent', focus: 'MVP scope, core features, usability, and technical build' },
  business: { title: 'Business & Finance Agent', focus: 'pricing, revenue model, and paying customers' },
  growth: { title: 'Growth Agent', focus: 'getting first 100 users, marketing channels, and launch plan' },
}

export async function runSpecialist(agentType, profile) {
  const spec = SPECIALISTS[agentType]
  const system = `You are the ${spec.title} on the YStart-AI board. Focus on: ${spec.focus}.

STYLE RULES:
- Write in simple, short, everyday English. No complex buzzwords.
- Summary: exactly 1-2 short sentences.
- Each bullet point must be short and direct (1 sentence).

Return JSON:
{"summary": string (1-2 simple sentences), "strengths": string[] (2-4 short bullets), "risks": string[] (2-4 short bullets), "claims": string[] (2-4 short founder claims needing proof), "assumptions": string[] (2-3 unproven assumptions), "questions": string[] (2-3 short simple questions), "recommendations": string[] (2-3 simple next actions)}`
  const out = await aiJSON(system, `STARTUP PROFILE:\n${JSON.stringify(profile, null, 2)}`)
  return {
    summary: str(out.summary),
    strengths: arr(out.strengths).map(str),
    risks: arr(out.risks).map(str),
    claims: arr(out.claims).map(str),
    assumptions: arr(out.assumptions).map(str),
    questions: arr(out.questions).map(str),
    recommendations: arr(out.recommendations).map(str),
  }
}

// ---------- Critic agent ----------
export async function runCritic(profile, reports) {
  const condensed = Object.entries(reports).map(([k, r]) => `## ${k.toUpperCase()} AGENT\nSummary: ${r.summary}\nClaims: ${(r.claims || []).join(' | ')}\nAssumptions: ${(r.assumptions || []).join(' | ')}\nRisks: ${(r.risks || []).join(' | ')}`).join('\n\n')
  const system = `You are the Critic Agent of YStart-AI. Your job is to challenge unproven founder assumptions.

STYLE RULES:
- Use simple, plain English.
- Summary: 1-2 short sentences.
- Criticisms: short 1-sentence questions (e.g. "Do customers really care enough to pay for this?").

Return JSON:
{"summary": string (1-2 simple sentences), "contradictions": string[], "claims": [{"claim": string, "category": "market"|"product"|"business"|"growth"|"traction", "importance": "critical"|"high"|"medium"|"low", "criticism": string (1 short sentence), "evidence_required": boolean, "reason": string (1 short sentence)}] (4-8 key claims)}`
  const out = await aiJSON(system, `STARTUP PROFILE:\n${JSON.stringify(profile)}\n\nSPECIALIST REPORTS:\n${condensed}`)
  const claims = arr(out.claims).filter((c) => c && typeof c === 'object' && c.claim).map((c) => ({
    claim: str(c.claim),
    category: ['market','product','business','growth','traction'].includes(c.category) ? c.category : 'market',
    importance: ['critical','high','medium','low'].includes(c.importance) ? c.importance : 'medium',
    criticism: str(c.criticism),
    evidence_required: c.evidence_required !== false,
    reason: str(c.reason),
  }))
  return { summary: str(out.summary), contradictions: arr(out.contradictions).map(str), claims }
}

// ---------- Evidence agent (mission generation) ----------
export async function generateMissions(profile, claimsNeedingEvidence) {
  const list = claimsNeedingEvidence.map((c, i) => `${i + 1}. [id:${c.id}] [${c.importance}] ${c.claim} — critic: ${c.criticism}`).join('\n')
  const system = `You are the Feasibility Guide of YStart-AI. For each claim, suggest ONE quick, low-effort test to check if the idea is feasible.

RULES:
- Make each test fast and practical (e.g. "Talk to 5 target users", "Share a 2-question poll", "Post in a relevant community").
- description: 1 short sentence.
- success_criteria: 1 clear, simple benchmark.
- instructions: 2-3 short, friendly tips.

Return JSON:
{"missions": [{"claim_id": string, "title": string (3-5 words), "description": string, "task_type": "interview"|"survey"|"landing_page"|"prototype"|"customer_outreach"|"analytics"|"pricing_test"|"waitlist"|"other", "instructions": string[], "success_criteria": string, "priority": "critical"|"high"|"medium"|"low"}]}`
  const out = await aiJSON(system, `STARTUP PROFILE (context):\n${JSON.stringify(profile)}\n\nCLAIMS NEEDING EVIDENCE:\n${list}`)
  const validIds = new Set(claimsNeedingEvidence.map((c) => c.id))
  const byId = Object.fromEntries(claimsNeedingEvidence.map((c) => [c.id, c]))
  return arr(out.missions).filter((m) => m && validIds.has(m.claim_id)).map((m) => ({
    claim_id: m.claim_id,
    title: str(m.title) || 'Validate claim',
    claim: byId[m.claim_id].claim,
    description: str(m.description),
    task_type: VALID_TASK_TYPES.includes(m.task_type) ? m.task_type : 'other',
    instructions: arr(m.instructions).map(str),
    success_criteria: str(m.success_criteria),
    priority: ['critical','high','medium','low'].includes(m.priority) ? m.priority : byId[m.claim_id].importance || 'medium',
  }))
}

// ---------- Evidence evaluation ----------
export async function evaluateEvidence(profile, mission, claim, submission) {
  const system = `You are the Idea Feasibility Evaluator of YStart-AI. Evaluate the founder's quick test results to determine if their idea is feasible and viable.

GOAL:
- Be encouraging, practical, and helpful (never academic or bureaucratic).
- Tell the founder clearly what signal they got: Is the idea working? What should they do next?

Return JSON:
{"status": "VALIDATED"|"PARTIALLY_VALIDATED"|"UNPROVEN"|"REJECTED", "confidence": number (0-100), "feasibility_verdict": "STRONG_SIGNAL"|"PROMISING"|"NEEDS_WORK"|"PIVOT_SUGGESTED", "proves": string (1 short sentence on what worked), "does_not_prove": string (1 short sentence on what is still uncertain), "quality": string (brief friendly note), "reasoning": string (1-2 clear, helpful sentences on idea feasibility), "next_step": string (1 simple recommended next step), "additional_validation_required": boolean, "followup_mission": null OR {"title": string, "description": string, "task_type": "interview"|"survey"|"landing_page"|"prototype"|"customer_outreach"|"analytics"|"pricing_test"|"waitlist"|"other", "instructions": string[], "success_criteria": string, "priority": "critical"|"high"|"medium"|"low"}}`
  const user = `STARTUP: ${profile.startup_name} (${profile.idea})\nCLAIM: ${claim.claim}\nMISSION: ${mission.title}\nGOAL: ${mission.success_criteria}\n\nFOUNDER FINDINGS:\n${submission.description || submission.results || '-'}\nMetrics/Links: ${[submission.metrics, submission.links, submission.notes].filter(Boolean).join(' | ') || 'None'}${submission.has_image ? '\nScreenshot/Image attached: YES' : ''}`
  const out = await aiJSON(system, user)
  const status = ['VALIDATED','PARTIALLY_VALIDATED','UNPROVEN','REJECTED'].includes(out.status) ? out.status : 'UNPROVEN'
  let followup = null
  if (out.followup_mission && typeof out.followup_mission === 'object' && out.followup_mission.title) {
    followup = {
      title: str(out.followup_mission.title),
      description: str(out.followup_mission.description),
      task_type: VALID_TASK_TYPES.includes(out.followup_mission.task_type) ? out.followup_mission.task_type : 'other',
      instructions: arr(out.followup_mission.instructions).map(str),
      success_criteria: str(out.followup_mission.success_criteria),
      priority: ['critical','high','medium','low'].includes(out.followup_mission.priority) ? out.followup_mission.priority : 'high',
    }
  }
  return {
    status,
    confidence: clampInt(out.confidence, 0, 100, 50),
    feasibility_verdict: str(out.feasibility_verdict) || 'PROMISING',
    proves: str(out.proves),
    does_not_prove: str(out.does_not_prove),
    quality: str(out.quality),
    reasoning: str(out.reasoning),
    next_step: str(out.next_step),
    additional_validation_required: Boolean(out.additional_validation_required),
    followup_mission: followup,
  }
}

// ---------- Chairman agent (assessment + explainable score) ----------
export const SCORE_CATEGORIES = ['market_validation','product','business_model','growth','traction','moat','evidence_quality']

export async function runChairman(profile, reports, criticReport, claims, missions, evaluations) {
  const reportsTxt = Object.entries(reports).map(([k, r]) => `## ${k.toUpperCase()}: ${r.summary}`).join('\n')
  const claimsTxt = claims.map((c) => `- [${c.status.toUpperCase()}] ${c.claim}`).join('\n')
  const evidenceTxt = evaluations.map((e) => `- ${e.mission_title} → ${e.status} (${e.confidence}/100): ${e.reasoning}`).join('\n') || '(none)'
  const system = `You are the Chairman of YStart-AI. You give a plain-English assessment and an Investor Readiness Score.

STYLE RULES:
- Use simple, straightforward words. No complex financial/VC jargon.
- Overall assessment: 2-3 short, clear sentences.
- Explanations: 1 simple sentence each.

Scoring guide:
- 0-100 score per category.
- Without real proof, overall score should be below 55.
- Status: "NOT READY TO PITCH" (<50), "NEEDS MORE PROOF" (50-74), "INVESTOR READY" (>=75).

Return JSON:
{"strengths": string[] (2-4 simple bullets), "critical_risks": string[] (2-4 simple bullets), "validated_claims": string[], "unproven_claims": string[], "next_actions": string[] (2-3 clear next steps), "recommended_changes": string[], "overall_assessment": string (2-3 simple sentences), "score": {"overall": number, "readiness_status": string, "categories": {"market_validation": {"score": number, "explanation": string, "supporting_evidence": string, "missing_evidence": string}, "product": {...same}, "business_model": {...same}, "growth": {...same}, "traction": {...same}, "moat": {...same}, "evidence_quality": {...same}}, "strongest_area": string, "biggest_weakness": string, "critical_objection": string (1 short sentence), "next_action": string (1 short sentence)}}`
  const user = `STARTUP: ${JSON.stringify(profile)}\n\nAGENTS:\n${reportsTxt}\n\nCRITIC: ${criticReport?.summary || '-'}\n\nCLAIMS:\n${claimsTxt}\n\nEVALUATIONS:\n${evidenceTxt}`
  const out = await aiJSON(system, user)
  const score = out.score && typeof out.score === 'object' ? out.score : {}
  const categories = {}
  for (const cat of SCORE_CATEGORIES) {
    const c = score.categories && typeof score.categories === 'object' ? score.categories[cat] || {} : {}
    categories[cat] = {
      score: clampInt(c.score, 0, 100, 40),
      explanation: str(c.explanation),
      supporting_evidence: str(c.supporting_evidence),
      missing_evidence: str(c.missing_evidence),
    }
  }
  return {
    report: {
      summary: str(out.overall_assessment),
      strengths: arr(out.strengths).map(str),
      critical_risks: arr(out.critical_risks).map(str),
      validated_claims: arr(out.validated_claims).map(str),
      unproven_claims: arr(out.unproven_claims).map(str),
      next_actions: arr(out.next_actions).map(str),
      recommended_changes: arr(out.recommended_changes).map(str),
      overall_assessment: str(out.overall_assessment),
    },
    score: {
      overall: clampInt(score.overall, 0, 100, 40),
      readiness_status: str(score.readiness_status) || 'NOT READY TO PITCH',
      categories,
      strongest_area: str(score.strongest_area),
      biggest_weakness: str(score.biggest_weakness),
      critical_objection: str(score.critical_objection),
      next_action: str(score.next_action),
    },
  }
}

// ---------- Pitch Practice (AI investor) ----------
export function buildPitchContext(reportsRaw, claims, latestScore) {
  const questions = []
  for (const k of ['market', 'product', 'business', 'growth']) {
    const r = reportsRaw[k]?.report
    if (r?.questions?.length) questions.push(...r.questions.map((q) => `[${k} agent] ${q}`))
  }
  const unproven = (claims || [])
    .filter((c) => ['unproven', 'rejected'].includes(c.status))
    .sort((a, b) => ['critical', 'high', 'medium', 'low'].indexOf(a.importance) - ['critical', 'high', 'medium', 'low'].indexOf(b.importance))
    .map((c) => `[${c.importance}] ${c.claim} — critic: ${c.criticism}`)
  const chairman = reportsRaw.chairman?.report || {}
  return {
    hard_questions: questions.slice(0, 16),
    unproven_claims: unproven.slice(0, 10),
    critical_objection: latestScore?.critical_objection || '',
    biggest_weakness: latestScore?.biggest_weakness || '',
    chairman_unproven: (chairman.unproven_claims || []).slice(0, 6),
  }
}

export async function pitchTurn(profile, context, history) {
  const answers = history.filter((m) => m.role === 'user').length
  const transcript = history.map((m) => {
    if (m.role === 'user') return `FOUNDER: ${m.content}`
    const fb = m.meta?.feedback ? ` (your feedback on previous answer: ${m.meta.feedback})` : ''
    return `INVESTOR: ${m.content}${fb}`
  }).join('\n')
  const system = `You are "The Investor" — a sharp, skeptical early-stage VC partner running a PITCH PRACTICE session with the founder so they can rehearse. You hold the full due-diligence dossier from the ProofLoop AI board (hard questions, unproven claims, the critical objection). Grill the founder with the HARDEST, most specific questions.

Rules:
- Ask exactly ONE question at a time. Prefer dossier questions made specific to THIS startup. Ask a follow-up when the previous answer was weak, vague or evasive.
- If the founder just answered, first assess that answer: answer_rating 1-10 (10 = investor-ready: direct, evidence-backed, concise) with 1-2 sentences of blunt, useful feedback. Do not be generous — vague claims without numbers score 4 or below.
- The founder has answered ${answers} questions so far. After 6-8 answers set done=true and, instead of a question, tell them to end the session to get their debrief.

Return JSON: {"feedback": string|null (null if there is no prior founder answer), "answer_rating": number|null (1-10, null if no prior answer), "question": string, "done": boolean, "question_source": string (short label like "critic claim" | "market agent" | "chairman objection" | "follow-up")}`
  const user = `STARTUP PROFILE:\n${JSON.stringify(profile)}\n\nDUE-DILIGENCE DOSSIER:\n${JSON.stringify(context, null, 1)}\n\nSESSION SO FAR:\n${transcript || '(session just started — open with your hardest first question, usually the critical objection)'}`
  const out = await aiJSON(system, user)
  const rating = out.answer_rating == null ? null : clampInt(out.answer_rating, 1, 10, 5)
  return {
    feedback: out.feedback == null ? null : str(out.feedback),
    answer_rating: answers === 0 ? null : rating,
    question: str(out.question) || 'Walk me through the evidence behind your biggest claim.',
    done: answers >= 9 ? true : Boolean(out.done),
    question_source: str(out.question_source) || 'dossier',
  }
}

export async function pitchDebrief(profile, history) {
  const transcript = history.map((m) => {
    if (m.role === 'user') return `FOUNDER: ${m.content}`
    const parts = []
    if (m.meta?.answer_rating != null) parts.push(`[rated previous answer ${m.meta.answer_rating}/10: ${m.meta.feedback || ''}]`)
    parts.push(`INVESTOR: ${m.content}`)
    return parts.join(' ')
  }).join('\n')
  const system = `You are the pitch coach of ProofLoop. The founder just finished a pitch practice session with a skeptical VC. Produce an honest debrief. Do not flatter.

Return JSON: {"overall_rating": number (0-100, investor-readiness of their ANSWERS in this session), "verdict": string (2-3 blunt sentences), "strengths": string[] (2-4 things they answered well), "weaknesses": string[] (2-4 concrete gaps: evasive answers, missing numbers, unsupported claims), "coaching": string[] (3-5 specific suggestions — for the weakest answers, say what a 10/10 answer would have included), "best_moment": string (their strongest answer and why), "worst_moment": string (their weakest answer and why)}`
  const out = await aiJSON(system, `STARTUP PROFILE:\n${JSON.stringify({ name: profile.startup_name, idea: profile.idea })}\n\nPITCH PRACTICE TRANSCRIPT:\n${transcript}`)
  return {
    overall_rating: clampInt(out.overall_rating, 0, 100, 40),
    verdict: str(out.verdict),
    strengths: arr(out.strengths).map(str),
    weaknesses: arr(out.weaknesses).map(str),
    coaching: arr(out.coaching).map(str),
    best_moment: str(out.best_moment),
    worst_moment: str(out.worst_moment),
  }
}

// ---------- Change detection ----------
export function detectChanges(oldProfile, newProfile) {
  const changed = []
  for (const f of PROFILE_FIELDS) {
    const a = JSON.stringify(oldProfile?.[f] ?? '')
    const b = JSON.stringify(newProfile?.[f] ?? '')
    if (a !== b) changed.push(f)
  }
  const map = {
    target_customer: ['market'], customer_problem: ['market'], current_alternatives: ['market'], competitors: ['market'],
    solution: ['product', 'market'], value_proposition: ['product', 'market'], idea: ['market', 'product'],
    business_model: ['business'], pricing: ['business'],
    growth_strategy: ['growth'], first_100_users: ['growth'],
    traction: ['business', 'growth'], existing_evidence: [], key_assumptions: [], startup_name: [],
  }
  const agents = new Set()
  for (const f of changed) for (const a of map[f] || []) agents.add(a)
  return { changed_fields: changed, affected_agents: [...agents] }
}
