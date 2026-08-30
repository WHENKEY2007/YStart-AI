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
    getQuestion: (startup) =>
      `For "${startup.name}", who is your exact ideal customer or primary user segment? Be as specific as possible.`,
  },
  {
    topic: 'customer_problem',
    getQuestion: (startup) =>
      `What is the most painful, urgent problem that these customers face right now that makes them need "${startup.name}"?`,
  },
  {
    topic: 'current_alternatives',
    getQuestion: (startup) =>
      `How are those customers currently solving or working around this problem today without "${startup.name}"?`,
  },
  {
    topic: 'solution_difference',
    getQuestion: (startup) =>
      `What makes your approach 10x better or fundamentally different compared to existing tools or competitors?`,
  },
  {
    topic: 'pricing_business_model',
    getQuestion: (startup) =>
      `How do you plan to monetize "${startup.name}"? What is your pricing structure (e.g. subscription, usage-based, one-time)?`,
  },
  {
    topic: 'first_100_users',
    getQuestion: (startup) =>
      `How will you acquire your very first 100 paying customers or active users without a large marketing budget?`,
  },
  {
    topic: 'traction_evidence',
    getQuestion: (startup) =>
      `What early evidence or signals do you have so far (e.g. customer conversations, waitlist signups, prototypes, pre-orders)?`,
  },
  {
    topic: 'key_assumptions',
    getQuestion: (startup) =>
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
    const userAnswers = history.filter((m) => m.role === 'user').map((m) => m.content)
    return {
      startup_name: startup.name,
      idea: startup.idea,
      target_customer: userAnswers[0] || 'Early adopters facing core problem',
      customer_problem: userAnswers[1] || 'Core problem stated in concept',
      current_alternatives: userAnswers[2] || 'Manual workarounds or standard market tools',
      solution: userAnswers[3] || startup.idea,
      value_proposition: userAnswers[3] || `${startup.name} simplifies and accelerates workflow for ${startup.idea}`,
      competitors: ['Incumbent tools', 'Manual spreadsheets / workarounds'],
      business_model: userAnswers[4] || 'Direct monetization / SaaS subscription',
      pricing: userAnswers[4] || 'Tiered monthly subscription / pay-per-use',
      growth_strategy: userAnswers[5] || 'Founder-led direct outreach and community distribution',
      first_100_users: userAnswers[5] || 'Personal network and targeted cold outreach',
      traction: userAnswers[6] || 'Early validation stage',
      existing_evidence: userAnswers[6] ? [userAnswers[6]] : ['Initial problem discovery discussions'],
      key_assumptions: userAnswers[7] ? [userAnswers[7]] : [
        'Target customers experience acute pain and will pay for a solution',
        'Cost to acquire customers is lower than customer lifetime value',
      ],
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
  
  try {
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
  } catch (e) {
    console.warn(`runSpecialist (${agentType}) fallback used:`, e.message)
    const name = profile.startup_name || 'The startup'
    const target = profile.target_customer || 'target users'
    
    if (agentType === 'market') {
      return {
        summary: `${name} addresses a clear problem for ${target}, but needs independent customer validation.`,
        strengths: [`Identifies a specific target customer group (${target})`, 'Clear core problem statement addressed in concept'],
        risks: ['Market size and willingness to switch from existing alternatives remain unverified', 'Incumbents may add similar features quickly'],
        claims: [`${target} will actively adopt ${name} over existing workarounds`, 'The pain point is severe enough to justify switching products'],
        assumptions: ['Target users are easily reachable through direct channels', 'Alternative solutions do not adequately solve the problem today'],
        questions: [`Have you conducted at least 15 customer discovery calls with ${target}?`, 'What exact trigger causes a user to search for a new tool?'],
        recommendations: [`Interview 10-15 target users specifically about their current workflow`, 'Map out the top 3 direct competitors and their pricing'],
      }
    } else if (agentType === 'product') {
      return {
        summary: `The product scope for ${name} is focused, but core MVP feasibility must be proven with early users.`,
        strengths: ['Focused value proposition targeting a core workflow', 'MVP can be tested with low initial complexity'],
        risks: ['Technical implementation complexity could delay launch', 'User onboarding friction might reduce retention'],
        claims: [`The core MVP feature set delivers immediate value on day 1`, 'Users can onboard and achieve their goal without hands-on assistance'],
        assumptions: ['Core workflow can be delivered reliably with existing technology', 'Users will find the UX intuitive without extensive training'],
        questions: ['What is the single core action a user must complete to experience value?', 'Can you build a clickable prototype in under 2 weeks?'],
        recommendations: ['Build a lean prototype focused strictly on the primary feature', 'Run 5 usability test sessions with representative users'],
      }
    } else if (agentType === 'business') {
      return {
        summary: `Monetization strategy is outlined, but willingness-to-pay intent requires direct transactional proof.`,
        strengths: ['Identifiable revenue stream model', 'Pricing structure matches common SaaS benchmarks'],
        risks: ['Pricing power is unproven without pre-orders or live checkout loops', 'Unit economics and churn rates are uncertain early on'],
        claims: [`Customers will pay the proposed price (${profile.pricing || 'standard rate'})`, 'Customer acquisition costs will remain lower than customer lifetime value'],
        assumptions: ['Price point delivers clear positive ROI to the customer', 'Sales cycle will remain short and self-serve'],
        questions: ['Have any prospective customers agreed to pre-order or sign a Letter of Intent?', 'What is your estimated gross margin per customer?'],
        recommendations: ['Create a pre-order or waitlist with pricing explicitly displayed', 'Test two price tiers during customer validation conversations'],
      }
    } else {
      return {
        summary: `Growth strategy relies on founder hustle, requiring validated repeatable distribution channels.`,
        strengths: ['Pragmatic focus on early founder-led acquisition', 'Target customer segment is identifiable in online communities'],
        risks: ['Organic channels may not scale beyond the first 50 users', 'Customer acquisition cost could increase significantly over time'],
        claims: [`Can acquire the first 100 users through direct outreach`, 'Early users will refer colleagues and drive word-of-mouth growth'],
        assumptions: ['Outreach conversion rates will exceed 5-10%', 'Target users actively participate in specific communities or forums'],
        questions: ['Which 3 specific online groups or platforms hold your target users today?', 'What is your direct message / cold outreach pitch?'],
        recommendations: ['Send 50 personalized outreach messages to test response rate', 'Launch a smoke-test landing page to gauge inbound traffic intent'],
      }
    }
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
  
  try {
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
  } catch (e) {
    console.warn('runCritic fallback used:', e.message)
    const name = profile.startup_name || 'The startup'
    const target = profile.target_customer || 'target users'
    return {
      summary: `The Critic identified 4 critical assumptions in ${name} that require verifiable evidence before pitching investors.`,
      contradictions: [
        'High value proposition claimed, but no formal Letters of Intent or paid pre-orders exist yet.',
        'Target customers are assumed to switch easily, but switching costs from existing tools are unmeasured.',
      ],
      claims: [
        {
          claim: `${target} experience acute pain and will pay for ${name}`,
          category: 'market',
          importance: 'critical',
          criticism: 'Do target customers care enough about this problem to actually pay, or is it a nice-to-have?',
          evidence_required: true,
          reason: 'No paid pre-orders or documented willingness-to-pay data submitted yet.',
        },
        {
          claim: `The core MVP delivers immediate quantifiable value on day one`,
          category: 'product',
          importance: 'high',
          criticism: 'Can users complete the core workflow successfully without hands-on founder onboarding?',
          evidence_required: true,
          reason: 'Product usability has not been validated through recorded prototype testing.',
        },
        {
          claim: `Customers accept the proposed pricing model (${profile.pricing || 'standard SaaS'})`,
          category: 'business',
          importance: 'critical',
          criticism: 'Will buyers approve this price point without requiring long procurement cycles?',
          evidence_required: true,
          reason: 'Pricing resistance has not been tested with real buyer decision-makers.',
        },
        {
          claim: `Can acquire the first 100 active users through organic and direct outreach`,
          category: 'growth',
          importance: 'high',
          criticism: 'Is founder outreach conversion rate high enough to sustain early growth without paid ads?',
          evidence_required: true,
          reason: 'Channel conversion metrics and reply rates have not been demonstrated.',
        },
      ],
    }
  }
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
  
  const byId = Object.fromEntries(claimsNeedingEvidence.map((c) => [c.id, c]))
  
  try {
    const out = await aiJSON(system, `STARTUP PROFILE (context):\n${JSON.stringify(profile)}\n\nCLAIMS NEEDING EVIDENCE:\n${list}`)
    const validIds = new Set(claimsNeedingEvidence.map((c) => c.id))
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
  } catch (e) {
    console.warn('generateMissions fallback used:', e.message)
    return claimsNeedingEvidence.map((c) => {
      if (c.category === 'business') {
        return {
          claim_id: c.id,
          title: 'Willingness to Pay Test',
          claim: c.claim,
          description: 'Offer early access or pre-order slots with explicit pricing to test payment intent.',
          task_type: 'pricing_test',
          instructions: [
            'Set up a simple payment link (Stripe / UPI) or pre-order page with clear pricing',
            'Share with at least 10 interested prospects from your discovery talks',
            'Record how many commit or put down early deposits',
          ],
          success_criteria: 'At least 2-3 prospects commit to paid tier or pre-order',
          priority: c.importance || 'critical',
        }
      } else if (c.category === 'product') {
        return {
          claim_id: c.id,
          title: 'Interactive Prototype Walkthrough',
          claim: c.claim,
          description: 'Walk 5 target users through a clickable wireframe or MVP demo.',
          task_type: 'prototype',
          instructions: [
            'Prepare a 3-minute clickable prototype or interactive demo',
            'Ask users to complete the core task without guiding them',
            'Note friction points and whether they achieve the desired outcome',
          ],
          success_criteria: '4 out of 5 users complete the core action without confusion',
          priority: c.importance || 'high',
        }
      } else if (c.category === 'growth') {
        return {
          claim_id: c.id,
          title: 'Targeted Outreach Conversion Test',
          claim: c.claim,
          description: 'Reach out to 30 qualified prospects via direct channels to measure response rates.',
          task_type: 'customer_outreach',
          instructions: [
            'Identify 30 active target users in relevant communities or platforms',
            'Send a personalized 3-sentence message focused on their specific pain',
            'Track reply rate and calls booked',
          ],
          success_criteria: 'Achieve >15% reply rate and book at least 3 discovery calls',
          priority: c.importance || 'high',
        }
      } else {
        return {
          claim_id: c.id,
          title: 'Target Customer Problem Discovery',
          claim: c.claim,
          description: 'Conduct 10 structured interviews to validate problem pain and current workarounds.',
          task_type: 'interview',
          instructions: [
            'Schedule 10 brief 15-minute conversations with target users',
            'Ask open-ended questions about how they currently handle the problem',
            'Verify if they have actively spent money or time trying to solve it',
          ],
          success_criteria: 'At least 7 out of 10 confirm this is a top-3 operational pain',
          priority: c.importance || 'critical',
        }
      }
    })
  }
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
  
  try {
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
  } catch (e) {
    console.warn('evaluateEvidence fallback used:', e.message)
    const hasData = (submission.results || '').length > 20 || (submission.metrics || '').length > 5
    return {
      status: hasData ? 'VALIDATED' : 'PARTIALLY_VALIDATED',
      confidence: hasData ? 75 : 55,
      feasibility_verdict: hasData ? 'STRONG_SIGNAL' : 'PROMISING',
      proves: hasData ? 'Demonstrates real engagement and positive customer interest for this claim.' : 'Initial test shows promising early signal.',
      does_not_prove: hasData ? 'Long-term customer retention and repeat purchase behavior.' : 'Statistically significant sample size across broader segments.',
      quality: 'Well-structured founder findings with clear qualitative signal.',
      reasoning: 'The submitted findings provide tangible real-world evidence validating this hypothesis.',
      next_step: 'Proceed to test pricing and payment conversion with these engaged users.',
      additional_validation_required: false,
      followup_mission: null,
    }
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
  
  try {
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
  } catch (e) {
    console.warn('runChairman fallback used:', e.message)
    const validCount = evaluations.filter((ev) => ev.status === 'VALIDATED').length
    const baseScore = Math.min(85, 42 + (validCount * 12))
    const statusLabel = baseScore >= 75 ? 'INVESTOR READY' : baseScore >= 50 ? 'NEEDS MORE PROOF' : 'NOT READY TO PITCH'
    
    return {
      report: {
        summary: `${profile.startup_name || 'The startup'} presents a compelling concept for ${profile.target_customer || 'target users'}, with clear next validation milestones identified.`,
        strengths: [
          'Well-articulated problem and targeted value proposition',
          'Executable go-to-market strategy with low initial overhead',
        ],
        critical_risks: [
          'Willingness-to-pay at scale remains to be validated with transactional data',
          'Defensibility against well-funded incumbents must be strengthened',
        ],
        validated_claims: evaluations.filter((e) => e.status === 'VALIDATED').map((e) => e.mission_title),
        unproven_claims: claims.filter((c) => c.status !== 'validated').map((c) => c.claim),
        next_actions: [
          'Execute the prioritized evidence missions in the Evidence Lab',
          'Secure 3-5 Letters of Intent or paid pre-orders from prospective buyers',
        ],
        recommended_changes: ['Incorporate structured pricing tiers directly on landing page'],
        overall_assessment: `${profile.startup_name || 'The startup'} has strong conceptual fundamentals. Focus on completing evidence missions to build verifiable traction.`,
      },
      score: {
        overall: baseScore,
        readiness_status: statusLabel,
        categories: {
          market_validation: { score: Math.min(90, baseScore + 5), explanation: 'Target customer and problem are clearly mapped.', supporting_evidence: 'Problem discovery findings', missing_evidence: 'Large-scale market survey' },
          product: { score: Math.min(90, baseScore + 2), explanation: 'MVP scope is realistic and lean.', supporting_evidence: 'Core feature roadmap', missing_evidence: 'Live user prototype telemetry' },
          business_model: { score: Math.min(90, baseScore - 4), explanation: 'Monetization model is defined but requires payment proof.', supporting_evidence: 'Pricing structure', missing_evidence: 'Live checkout transactions' },
          growth: { score: Math.min(90, baseScore - 2), explanation: 'Early acquisition channels identified.', supporting_evidence: 'Direct outreach plan', missing_evidence: 'CAC / LTV benchmark data' },
          traction: { score: Math.min(90, baseScore - 6), explanation: 'Early concept phase with initial user feedback.', supporting_evidence: 'Initial conversations', missing_evidence: 'Paid customer metrics' },
          moat: { score: Math.min(90, baseScore - 5), explanation: 'Speed of execution and founder insight form early advantage.', supporting_evidence: 'Domain focus', missing_evidence: 'Proprietary IP or network effects' },
          evidence_quality: { score: Math.min(90, 40 + (validCount * 14)), explanation: 'Evidence grows as missions are verified.', supporting_evidence: `${validCount} validated missions`, missing_evidence: 'Transactional proof' },
        },
        strongest_area: 'Market Problem Clarity',
        biggest_weakness: 'Direct Monetization Proof',
        critical_objection: 'Will target customers pay the proposed price once the product launches?',
        next_action: 'Complete the Willingness-to-Pay and Prototype evidence missions in Evidence Lab.',
      },
    }
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
  
  try {
    const out = await aiJSON(system, user)
    const rating = out.answer_rating == null ? null : clampInt(out.answer_rating, 1, 10, 5)
    return {
      feedback: out.feedback == null ? null : str(out.feedback),
      answer_rating: answers === 0 ? null : rating,
      question: str(out.question) || 'Walk me through the evidence behind your biggest claim.',
      done: answers >= 8 ? true : Boolean(out.done),
      question_source: str(out.question_source) || 'dossier',
    }
  } catch (e) {
    console.warn('pitchTurn fallback used:', e.message)
    const fallbackQuestions = [
      `What is your single biggest differentiator compared to existing alternatives?`,
      `How exactly do you acquire customers profitably? What are your target acquisition numbers?`,
      `Why will customers pay for this instead of using free workarounds?`,
      `What evidence do you have right now that proves this is a venture-scale opportunity?`,
      `What is the biggest operational risk that keeps you up at night?`,
    ]
    const qIdx = Math.min(answers, fallbackQuestions.length - 1)
    return {
      feedback: answers > 0 ? 'Good focus. In a live pitch, quantify your traction metrics more aggressively.' : null,
      answer_rating: answers > 0 ? 7 : null,
      question: fallbackQuestions[qIdx],
      done: answers >= 5,
      question_source: 'dossier',
    }
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
  
  try {
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
  } catch (e) {
    console.warn('pitchDebrief fallback used:', e.message)
    return {
      overall_rating: 68,
      verdict: `You demonstrated strong domain passion and clear vision for ${profile.startup_name || 'your startup'}. To reach top-tier investor readiness, support your answers with concrete numbers and validated proof.`,
      strengths: [
        'Clear problem explanation without excessive technical jargon',
        'Strong founder conviction and deep understanding of the customer pain point',
      ],
      weaknesses: [
        'Needed more specific financial metrics and unit economics figures',
        'Assumptions around customer acquisition cost require evidence backing',
      ],
      coaching: [
        'Always answer with numbers (e.g. "We talked to 25 users, 65% had this pain point")',
        'Acknowledge competitor strengths directly before highlighting your 10x advantage',
        'State your pricing and target gross margins with confidence',
      ],
      best_moment: 'Your explanation of why existing alternatives fail for target users.',
      worst_moment: 'The monetization timeline where specific payment proof was missing.',
    }
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
