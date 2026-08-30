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

// ---------- Interview Agent ----------
const INTERVIEW_TOPICS = 'target customer, problem, alternatives, solution, value proposition, pricing, first users, traction, assumptions'

export const VALID_TASK_TYPES = ['interview', 'survey', 'landing_page', 'prototype', 'customer_outreach', 'analytics', 'pricing_test', 'waitlist', 'other']

export async function interviewTurn(startup, history) {
  const answers = history.filter((m) => m.role === 'user').length
  const transcript = history.map((m) => `${m.role === 'user' ? 'FOUNDER' : 'INTERVIEWER'}: ${m.content}`).join('\n')
  const system = `You are the Founder Interview Agent of YStart-AI. You interview a founder to understand their startup.

STYLE RULES:
- Keep your question VERY SHORT (1-2 sentences maximum, plain and simple words).
- Never use complex VC jargon or multi-part questions. Ask ONE simple thing at a time.
- The founder has answered ${answers} questions so far. Target 8-10 total answers.
- When done (${answers} >= 9), set done=true and write a 1-sentence closing note that their profile is ready.

Return JSON: {"question": string, "done": boolean, "progress": number, "topic": string}`
  const user = `STARTUP NAME: ${startup.name}\nIDEA: ${startup.idea}\n\nINTERVIEW SO FAR:\n${transcript || '(no messages yet — ask a short opening question about who their target user is)'}`
  const out = await aiJSON(system, user)
  return {
    question: str(out.question) || 'Who is your main target customer?',
    done: answers >= 10 ? true : Boolean(out.done),
    progress: clampInt(out.progress, 0, 100, Math.min(95, Math.round((answers / 10) * 100))),
    topic: str(out.topic),
  }
}

// ---------- Profile generation ----------
export const PROFILE_FIELDS = ['startup_name','idea','target_customer','customer_problem','current_alternatives','solution','value_proposition','competitors','business_model','pricing','growth_strategy','first_100_users','traction','existing_evidence','key_assumptions']

export async function generateProfile(startup, history) {
  const transcript = history.map((m) => `${m.role === 'user' ? 'FOUNDER' : 'INTERVIEWER'}: ${m.content}`).join('\n')
  const system = `You convert a founder interview into a clean Startup Profile for YStart-AI.
Use simple, concise language (1-2 clear sentences per field). If missing, write "Not specified".

Return JSON with EXACTLY these keys:
{"startup_name": string, "idea": string, "target_customer": string, "customer_problem": string, "current_alternatives": string, "solution": string, "value_proposition": string, "competitors": string[], "business_model": string, "pricing": string, "growth_strategy": string, "first_100_users": string, "traction": string, "existing_evidence": string[], "key_assumptions": string[]}`
  const user = `STARTUP NAME: ${startup.name}\nIDEA: ${startup.idea}\n\nINTERVIEW TRANSCRIPT:\n${transcript}`
  const out = await aiJSON(system, user)
  const profile = {}
  for (const f of PROFILE_FIELDS) {
    if (['competitors', 'existing_evidence', 'key_assumptions'].includes(f)) profile[f] = arr(out[f]).map(str)
    else profile[f] = str(out[f]) || (f === 'startup_name' ? startup.name : f === 'idea' ? startup.idea : 'Not specified')
  }
  return profile
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
  const system = `You are the Evidence Agent of YStart-AI. For each claim, give the founder ONE simple, clear real-world test.

STYLE RULES:
- Use simple words and short sentences.
- Task: 1-2 clear sentences with concrete numbers (e.g. "Talk to 15 students and ask if they would pay ₹99/mo").
- Success criteria: 1 short sentence.

Return JSON:
{"missions": [{"claim_id": string, "title": string (3-6 words), "description": string (1-2 simple sentences), "task_type": "interview"|"survey"|"landing_page"|"prototype"|"customer_outreach"|"analytics"|"pricing_test"|"waitlist"|"other", "instructions": string[] (3-4 short simple steps), "success_criteria": string (1 clear sentence), "priority": "critical"|"high"|"medium"|"low"}]}`
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
  const system = `You are the Evidence Agent of YStart-AI evaluating proof submitted by the founder.

STYLE RULES:
- Use simple, everyday English.
- Reasoning: 1-2 short simple sentences explaining if proof is enough.
- Proves & Does NOT Prove: 1 simple sentence each.

Return JSON:
{"status": "VALIDATED"|"PARTIALLY_VALIDATED"|"UNPROVEN"|"REJECTED", "confidence": number (0-100), "proves": string (1 simple sentence), "does_not_prove": string (1 simple sentence), "quality": string (short note on proof quality), "reasoning": string (1-2 simple sentences), "additional_validation_required": boolean, "followup_mission": null OR {"title": string, "description": string, "task_type": "interview"|"survey"|"landing_page"|"prototype"|"customer_outreach"|"analytics"|"pricing_test"|"waitlist"|"other", "instructions": string[], "success_criteria": string, "priority": "critical"|"high"|"medium"|"low"}}`
  const user = `STARTUP: ${profile.startup_name} (${profile.idea})\nCLAIM: ${claim.claim}\nCRITIC: ${claim.criticism}\nMISSION: ${mission.title}\nGOAL: ${mission.success_criteria}\n\nSUBMITTED EVIDENCE:\nDid: ${submission.description || '-'}\nResults: ${submission.results || '-'}\nNumbers: ${submission.metrics || '-'}\nLinks: ${submission.links || '-'}${submission.has_image ? '\nScreenshot/Image attached: YES' : ''}`
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
    proves: str(out.proves),
    does_not_prove: str(out.does_not_prove),
    quality: str(out.quality),
    reasoning: str(out.reasoning),
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
