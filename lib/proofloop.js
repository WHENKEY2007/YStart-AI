import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
export const MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano'

export const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)

// ---------- AI helper (JSON mode with retry + validation) ----------
export async function aiJSON(system, user) {
  let lastErr = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const c = await openai.chat.completions.create({
        model: MODEL,
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
const INTERVIEW_TOPICS = 'target customer, customer problem, current alternatives, proposed solution, unique value proposition, competitors, revenue model, pricing, user acquisition strategy, first 100 users, current traction, existing evidence, founder assumptions'

export async function interviewTurn(startup, history) {
  const answers = history.filter((m) => m.role === 'user').length
  const transcript = history.map((m) => `${m.role === 'user' ? 'FOUNDER' : 'INTERVIEWER'}: ${m.content}`).join('\n')
  const system = `You are the Founder Interview Agent of ProofLoop, an evidence-driven startup validation platform. You interview a founder to build a complete Startup Profile. You are sharp, direct and slightly skeptical — like a seasoned VC associate. You never blindly agree.

Topics you must cover across the interview: ${INTERVIEW_TOPICS}.

Rules:
- Ask exactly ONE meaningful question at a time, informed by previous answers. Dig deeper when answers are vague, and reference what the founder said.
- Do NOT repeat topics already sufficiently answered.
- The founder has answered ${answers} questions so far. Target 8-11 total answers. If ${answers} >= 10 OR all key topics are reasonably covered, set done=true and instead of a question return a short closing statement telling the founder their Startup Profile will now be generated.
- progress = integer 0-100 estimating interview completion.

Return JSON: {"question": string, "done": boolean, "progress": number, "topic": string (topic of this question)}`
  const user = `STARTUP NAME: ${startup.name}\nIDEA: ${startup.idea}\n\nINTERVIEW SO FAR:\n${transcript || '(no messages yet — ask your opening question, usually about the target customer)'}`
  const out = await aiJSON(system, user)
  return {
    question: str(out.question) || 'Tell me about your target customer.',
    done: answers >= 12 ? true : Boolean(out.done),
    progress: clampInt(out.progress, 0, 100, Math.min(95, Math.round((answers / 10) * 100))),
    topic: str(out.topic),
  }
}

// ---------- Profile generation ----------
export const PROFILE_FIELDS = ['startup_name','idea','target_customer','customer_problem','current_alternatives','solution','value_proposition','competitors','business_model','pricing','growth_strategy','first_100_users','traction','existing_evidence','key_assumptions']

export async function generateProfile(startup, history) {
  const transcript = history.map((m) => `${m.role === 'user' ? 'FOUNDER' : 'INTERVIEWER'}: ${m.content}`).join('\n')
  const system = `You convert a founder interview into a structured Startup Profile for ProofLoop. Be faithful to what the founder actually said. Where information is missing, write "Not specified" (do not invent facts). key_assumptions must list assumptions the founder stated or clearly implied as unverified beliefs.

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
  market: { title: 'Market Agent', focus: 'customer clarity, problem severity, market opportunity and size, competition, demand signals, differentiation and positioning' },
  product: { title: 'Product Agent', focus: 'MVP scope, technical feasibility, product complexity, user experience, product differentiation, defensibility / moat' },
  business: { title: 'Business & Finance Agent', focus: 'revenue model, who the paying customer is, pricing logic, cost structure, unit economics, financial scalability' },
  growth: { title: 'Growth Agent', focus: 'path to first 100 users, distribution channels, go-to-market strategy, customer acquisition cost intuition, partnerships, growth scalability' },
}

export async function runSpecialist(agentType, profile) {
  const spec = SPECIALISTS[agentType]
  const system = `You are the ${spec.title} on the ProofLoop AI validation board. Analyze the startup profile strictly from your domain: ${spec.focus}.

You are rigorous and skeptical. Clearly separate FACTS (stated, verifiable), CLAIMS (founder statements needing proof) and ASSUMPTIONS (unverified beliefs). Do not flatter. Be specific to THIS startup, never generic.

Return JSON:
{"summary": string (2-3 sentence domain verdict), "strengths": string[] (3-5), "risks": string[] (3-5, concrete), "claims": string[] (3-5 founder claims in this domain that require evidence), "assumptions": string[] (2-4 unverified assumptions), "questions": string[] (2-4 hard questions an investor would ask), "recommendations": string[] (2-4 specific actions)}`
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
  const system = `You are the Critic Agent of ProofLoop. You do NOT summarize. Your job is to attack unsupported claims and assumptions in the startup profile and the specialist reports.

You must:
- Find unsupported claims presented as facts
- Find contradictions between agents or within the profile
- Identify logical weaknesses
- Demand evidence for the claims that matter most

For each claim produce a criticism phrased as a hard challenge (e.g. "What evidence proves that this problem is painful enough for customers to actively seek a new solution?").

Return JSON:
{"summary": string (your overall critical verdict, 2-3 sentences), "contradictions": string[] (contradictions found, may be empty), "claims": [{"claim": string, "category": "market"|"product"|"business"|"growth"|"traction", "importance": "critical"|"high"|"medium"|"low", "criticism": string, "evidence_required": boolean, "reason": string (why evidence matters here)}] (6-10 claims, ordered by importance)}`
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
  const system = `You are the Evidence Agent of ProofLoop. For each claim, design ONE practical, measurable Evidence Mission the founder can execute in the real world to validate or invalidate the claim.

BAD task: "Research the market."
GOOD task: "Interview 20 target users and record their current solution, pain level (1-10), and willingness to switch."

Every mission must include concrete numbers in the task and a measurable success criteria (e.g. "at least 15 of 20 interviewed students independently describe this as a top-3 problem").

Return JSON:
{"missions": [{"claim_id": string (copy the id exactly), "title": string (short, action oriented), "description": string (what to do, with numbers), "task_type": "interview"|"survey"|"landing_page"|"prototype"|"customer_outreach"|"analytics"|"other", "instructions": string[] (3-6 concrete steps or suggested questions), "success_criteria": string (measurable threshold), "priority": "critical"|"high"|"medium"|"low" (match claim importance)}]}`
  const out = await aiJSON(system, `STARTUP PROFILE (context):\n${JSON.stringify(profile)}\n\nCLAIMS NEEDING EVIDENCE:\n${list}`)
  const validIds = new Set(claimsNeedingEvidence.map((c) => c.id))
  const byId = Object.fromEntries(claimsNeedingEvidence.map((c) => [c.id, c]))
  return arr(out.missions).filter((m) => m && validIds.has(m.claim_id)).map((m) => ({
    claim_id: m.claim_id,
    title: str(m.title) || 'Validate claim',
    claim: byId[m.claim_id].claim,
    description: str(m.description),
    task_type: ['interview','survey','landing_page','prototype','customer_outreach','analytics','other'].includes(m.task_type) ? m.task_type : 'other',
    instructions: arr(m.instructions).map(str),
    success_criteria: str(m.success_criteria),
    priority: ['critical','high','medium','low'].includes(m.priority) ? m.priority : byId[m.claim_id].importance || 'medium',
  }))
}

// ---------- Evidence evaluation ----------
export async function evaluateEvidence(profile, mission, claim, submission) {
  const system = `You are the Evidence Agent of ProofLoop evaluating founder-submitted evidence. Founder-submitted evidence is self-reported and NOT independently verified — factor that into confidence.

Assess honestly. Do not be generous. Judge sample size, methodology, relevance to the claim, and whether the stated success criteria was met.

Return JSON:
{"status": "VALIDATED"|"PARTIALLY_VALIDATED"|"UNPROVEN"|"REJECTED", "confidence": number (0-100), "proves": string (what this evidence proves), "does_not_prove": string (what it does NOT prove), "quality": string (evidence quality assessment incl. self-reported caveat), "reasoning": string (why this status), "additional_validation_required": boolean, "followup_mission": null OR {"title": string, "description": string (concrete, with numbers), "task_type": "interview"|"survey"|"landing_page"|"prototype"|"customer_outreach"|"analytics"|"other", "instructions": string[], "success_criteria": string, "priority": "critical"|"high"|"medium"|"low"} (required if additional_validation_required is true)}`
  const user = `STARTUP (context): ${JSON.stringify({ name: profile.startup_name, idea: profile.idea, target_customer: profile.target_customer })}\n\nCLAIM UNDER TEST: ${claim.claim}\nCRITIC CHALLENGE: ${claim.criticism}\n\nMISSION: ${mission.title}\nTASK: ${mission.description}\nSUCCESS CRITERIA: ${mission.success_criteria}\n\nFOUNDER SUBMISSION (self-reported):\nWhat they did: ${submission.description || '-'}\nResults: ${submission.results || '-'}\nNumbers/metrics: ${submission.metrics || '-'}\nLinks: ${submission.links || '-'}\nNotes: ${submission.notes || '-'}`
  const out = await aiJSON(system, user)
  const status = ['VALIDATED','PARTIALLY_VALIDATED','UNPROVEN','REJECTED'].includes(out.status) ? out.status : 'UNPROVEN'
  let followup = null
  if (out.followup_mission && typeof out.followup_mission === 'object' && out.followup_mission.title) {
    followup = {
      title: str(out.followup_mission.title),
      description: str(out.followup_mission.description),
      task_type: ['interview','survey','landing_page','prototype','customer_outreach','analytics','other'].includes(out.followup_mission.task_type) ? out.followup_mission.task_type : 'other',
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
  const reportsTxt = Object.entries(reports).map(([k, r]) => `## ${k.toUpperCase()}: ${r.summary}\nRisks: ${(r.risks || []).join(' | ')}\nStrengths: ${(r.strengths || []).join(' | ')}`).join('\n')
  const claimsTxt = claims.map((c) => `- [${c.status.toUpperCase()}] [${c.importance}] ${c.claim}`).join('\n')
  const evidenceTxt = evaluations.map((e) => `- Claim tested: ${e.mission_title} → ${e.status} (confidence ${e.confidence}/100): ${e.reasoning}`).join('\n') || '(no evidence submitted yet)'
  const missionsTxt = missions.map((m) => `- [${m.status}] ${m.title}`).join('\n') || '(none)'
  const system = `You are the Chairman of the ProofLoop AI validation board. You produce an evidence-based final assessment and an explainable Investor Readiness Score. You must NOT give blind positive feedback. Claims without validated evidence count AGAINST readiness. Founder-submitted evidence is self-reported.

Scoring rules:
- Each category 0-100, justified by what is actually validated vs merely claimed.
- Startups with no validated evidence should generally score below 55 overall.
- overall = your holistic weighted judgment (not a plain average — market_validation, traction and evidence_quality matter most).
- readiness_status: "NOT READY TO PITCH" (<50), "PROMISING — NEEDS VALIDATION" (50-74), "READY FOR EARLY-STAGE INVESTOR CONVERSATIONS" (>=75).

Return JSON:
{"strengths": string[] (3-5), "critical_risks": string[] (3-5), "validated_claims": string[] (claims with real validated evidence, may be empty), "unproven_claims": string[] (most important unproven claims), "next_actions": string[] (3-5 highest-priority actions, most impactful first), "recommended_changes": string[] (2-4 concrete profile/strategy changes), "overall_assessment": string (4-6 sentence honest verdict), "score": {"overall": number, "readiness_status": string, "categories": {"market_validation": {"score": number, "explanation": string, "supporting_evidence": string, "missing_evidence": string}, "product": {...same}, "business_model": {...same}, "growth": {...same}, "traction": {...same}, "moat": {...same}, "evidence_quality": {...same}}, "strongest_area": string, "biggest_weakness": string, "critical_objection": string (the #1 objection an investor would raise), "next_action": string (single most important next step)}}`
  const user = `STARTUP PROFILE:\n${JSON.stringify(profile)}\n\nSPECIALIST REPORTS:\n${reportsTxt}\n\nCRITIC VERDICT: ${criticReport?.summary || '-'}\nContradictions: ${(criticReport?.contradictions || []).join(' | ') || 'none noted'}\n\nCLAIMS AND VALIDATION STATUS:\n${claimsTxt}\n\nEVIDENCE MISSIONS:\n${missionsTxt}\n\nEVIDENCE EVALUATIONS:\n${evidenceTxt}`
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
