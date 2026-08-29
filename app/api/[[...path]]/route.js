import { NextResponse } from 'next/server'
import {
  db, aiJSON, interviewTurn, generateProfile, runSpecialist, runCritic,
  generateMissions, evaluateEvidence, runChairman, detectChanges, PROFILE_FIELDS, arr, str,
  buildPitchContext, pitchTurn, pitchDebrief,
} from '@/lib/proofloop'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const json = (data, status = 200) => NextResponse.json(data, { status })
const err = (message, status = 500) => NextResponse.json({ error: message }, { status })

async function q(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

// ---------- data access helpers ----------
async function getStartup(id) {
  return q(db.from('startups').select('*').eq('id', id).single())
}
async function getProfileRow(startupId) {
  const rows = await q(db.from('startup_profiles').select('*').eq('startup_id', startupId).order('updated_at', { ascending: false }).limit(1))
  return rows?.[0] || null
}
async function getInterview(startupId) {
  return q(db.from('interview_messages').select('*').eq('startup_id', startupId).order('created_at', { ascending: true }))
}
async function getLatestReports(startupId) {
  const rows = await q(db.from('agent_reports').select('*').eq('startup_id', startupId).order('created_at', { ascending: false }))
  const latest = {}
  for (const r of rows) if (!latest[r.agent_type]) latest[r.agent_type] = r
  return latest
}
async function getClaims(startupId) {
  return q(db.from('claims').select('*').eq('startup_id', startupId).order('created_at', { ascending: true }))
}
async function getMissions(startupId) {
  return q(db.from('evidence_missions').select('*').eq('startup_id', startupId).order('created_at', { ascending: true }))
}
async function getEvaluationsWithMissions(startupId) {
  const evals = await q(db.from('evidence_evaluations').select('*').eq('startup_id', startupId).order('created_at', { ascending: true }))
  const missions = await getMissions(startupId)
  const mmap = Object.fromEntries(missions.map((m) => [m.id, m]))
  return evals.map((e) => ({ ...e, mission_title: mmap[e.mission_id]?.title || '', reasoning: e.evaluation?.reasoning || '' }))
}

async function runChairmanAndScore(startupId) {
  const profileRow = await getProfileRow(startupId)
  if (!profileRow) throw new Error('No profile yet')
  const reportsRaw = await getLatestReports(startupId)
  const specialist = {}
  for (const k of ['market', 'product', 'business', 'growth']) if (reportsRaw[k]) specialist[k] = reportsRaw[k].report
  const critic = reportsRaw.critic?.report || null
  const claims = await getClaims(startupId)
  const missions = await getMissions(startupId)
  const evaluations = await getEvaluationsWithMissions(startupId)
  const { report, score } = await runChairman(profileRow.profile, specialist, critic, claims, missions, evaluations)
  await q(db.from('agent_reports').insert({ startup_id: startupId, agent_type: 'chairman', report }).select())
  const scoreRow = await q(db.from('score_history').insert({
    startup_id: startupId, overall: score.overall, readiness_status: score.readiness_status,
    categories: score.categories, strongest_area: score.strongest_area, biggest_weakness: score.biggest_weakness,
    critical_objection: score.critical_objection, next_action: score.next_action,
  }).select().single())
  await q(db.from('startups').update({ stage: 'analyzed', updated_at: new Date().toISOString() }).eq('id', startupId).select())
  return { report, score: scoreRow }
}

// ---------- GET ----------
export async function GET(request, ctx) {
  try {
    const { path = [] } = await ctx.params
    if (path.length === 0) return json({ ok: true, service: 'ProofLoop API' })

    if (path[0] === 'startups' && path.length === 1) {
      const startups = await q(db.from('startups').select('*').order('created_at', { ascending: false }))
      const scores = await q(db.from('score_history').select('startup_id, overall, readiness_status, created_at').order('created_at', { ascending: false }))
      const latestScore = {}
      for (const s of scores) if (!latestScore[s.startup_id]) latestScore[s.startup_id] = s
      return json({ startups: startups.map((s) => ({ ...s, latest_score: latestScore[s.id] || null })) })
    }

    if (path[0] === 'startups' && path.length === 2) {
      const id = path[1]
      const startup = await getStartup(id)
      const profileRow = await getProfileRow(id)
      const interview = await getInterview(id)
      const reports = await getLatestReports(id)
      const claims = await getClaims(id)
      const missions = await getMissions(id)
      const submissions = await q(db.from('evidence_submissions').select('*').eq('startup_id', id).order('created_at', { ascending: true }))
      const evaluations = await q(db.from('evidence_evaluations').select('*').eq('startup_id', id).order('created_at', { ascending: true }))
      const scoreHistory = await q(db.from('score_history').select('*').eq('startup_id', id).order('created_at', { ascending: true }))
      const versions = await q(db.from('startup_versions').select('id, version, changed_fields, created_at').eq('startup_id', id).order('created_at', { ascending: false }))
      const missionsFull = missions.map((m) => ({
        ...m,
        submissions: submissions.filter((s) => s.mission_id === m.id),
        evaluations: evaluations.filter((e) => e.mission_id === m.id),
      }))
      return json({
        startup,
        profile: profileRow?.profile || null,
        profile_version: profileRow?.version || 0,
        profile_updated_at: profileRow?.updated_at || null,
        interview,
        reports: Object.fromEntries(Object.entries(reports).map(([k, v]) => [k, { ...v.report, created_at: v.created_at }])),
        claims,
        missions: missionsFull,
        score_history: scoreHistory,
        latest_score: scoreHistory[scoreHistory.length - 1] || null,
        versions,
      })
    }

    if (path[0] === 'startups' && path.length === 3 && path[2] === 'versions-full') {
      const versions = await q(db.from('startup_versions').select('id, version, profile, changed_fields, created_at').eq('startup_id', path[1]).order('version', { ascending: true }))
      return json({ versions })
    }

    if (path[0] === 'pitch' && path.length === 2) {
      const msgs = await q(db.from('pitch_messages').select('*').eq('startup_id', path[1]).order('created_at', { ascending: true }))
      const byId = {}
      for (const m of msgs) {
        if (!byId[m.session_id]) byId[m.session_id] = { session_id: m.session_id, messages: [], debrief: null, started_at: m.created_at }
        byId[m.session_id].messages.push(m)
        if (m.meta?.debrief) byId[m.session_id].debrief = m.meta.debrief
      }
      const sessions = Object.values(byId).sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
      return json({ sessions })
    }

    return err('Not found', 404)
  } catch (e) {
    console.error('GET error:', e.message)
    return err(e.message)
  }
}

// ---------- POST ----------
export async function POST(request, ctx) {
  try {
    const { path = [] } = await ctx.params
    const body = await request.json().catch(() => ({}))

    // Create startup + opening interview question
    if (path[0] === 'startups' && path.length === 1) {
      const name = str(body.name).trim()
      const idea = str(body.idea).trim()
      if (!name || !idea) return err('name and idea are required', 400)
      const startup = await q(db.from('startups').insert({ name, idea, stage: 'interview' }).select().single())
      const turn = await interviewTurn(startup, [])
      await q(db.from('interview_messages').insert({ startup_id: startup.id, role: 'assistant', content: turn.question }).select())
      return json({ startup, first_question: turn.question, progress: turn.progress })
    }

    // Interview turn
    if (path[0] === 'interview' && path.length === 1) {
      const { startup_id, message } = body
      if (!startup_id || !str(message).trim()) return err('startup_id and message are required', 400)
      const startup = await getStartup(startup_id)
      await q(db.from('interview_messages').insert({ startup_id, role: 'user', content: str(message).trim() }).select())
      const history = await getInterview(startup_id)
      const turn = await interviewTurn(startup, history)
      await q(db.from('interview_messages').insert({ startup_id, role: 'assistant', content: turn.question }).select())
      return json(turn)
    }

    // Complete interview -> generate structured profile
    if (path[0] === 'interview' && path[1] === 'complete') {
      const { startup_id } = body
      if (!startup_id) return err('startup_id is required', 400)
      const startup = await getStartup(startup_id)
      const history = await getInterview(startup_id)
      const profile = await generateProfile(startup, history)
      const existing = await getProfileRow(startup_id)
      let row
      if (existing) {
        row = await q(db.from('startup_profiles').update({ profile, version: existing.version + 1, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single())
      } else {
        row = await q(db.from('startup_profiles').insert({ startup_id, profile, version: 1 }).select().single())
      }
      await q(db.from('startup_versions').insert({ startup_id, profile, version: row.version, changed_fields: ['initial'] }).select())
      await q(db.from('startups').update({ stage: 'profile_ready', updated_at: new Date().toISOString() }).eq('id', startup_id).select())
      return json({ profile, version: row.version })
    }

    // Stage 1: specialists (parallel), optional agents subset
    if (path[0] === 'analyze' && path[1] === 'specialists') {
      const { startup_id, agents } = body
      if (!startup_id) return err('startup_id is required', 400)
      const profileRow = await getProfileRow(startup_id)
      if (!profileRow) return err('Generate the startup profile first', 400)
      const which = Array.isArray(agents) && agents.length ? agents.filter((a) => ['market','product','business','growth'].includes(a)) : ['market','product','business','growth']
      const results = await Promise.all(which.map((a) => runSpecialist(a, profileRow.profile)))
      const reports = {}
      for (let i = 0; i < which.length; i++) {
        reports[which[i]] = results[i]
        await q(db.from('agent_reports').insert({ startup_id, agent_type: which[i], report: results[i] }).select())
      }
      return json({ reports, agents_run: which })
    }

    // Stage 2: critic -> claims
    if (path[0] === 'analyze' && path[1] === 'critic') {
      const { startup_id } = body
      if (!startup_id) return err('startup_id is required', 400)
      const profileRow = await getProfileRow(startup_id)
      if (!profileRow) return err('Generate the startup profile first', 400)
      const reportsRaw = await getLatestReports(startup_id)
      const specialist = {}
      for (const k of ['market','product','business','growth']) if (reportsRaw[k]) specialist[k] = reportsRaw[k].report
      if (!Object.keys(specialist).length) return err('Run specialist agents first', 400)
      const critic = await runCritic(profileRow.profile, specialist)
      await q(db.from('agent_reports').insert({ startup_id, agent_type: 'critic', report: critic }).select())
      // Keep claims that have submissions/validation; replace untouched unproven claims
      const existingClaims = await getClaims(startup_id)
      const missions = await getMissions(startup_id)
      const touchedClaimIds = new Set(missions.filter((m) => m.status !== 'pending').map((m) => m.claim_id))
      const deletable = existingClaims.filter((c) => c.status === 'unproven' && !touchedClaimIds.has(c.id)).map((c) => c.id)
      if (deletable.length) await q(db.from('claims').delete().in('id', deletable).select())
      const inserted = []
      for (const c of critic.claims) {
        const row = await q(db.from('claims').insert({ startup_id, ...c, status: 'unproven' }).select().single())
        inserted.push(row)
      }
      return json({ critic, claims: inserted })
    }

    // Stage 3: evidence missions
    if (path[0] === 'analyze' && path[1] === 'missions') {
      const { startup_id } = body
      if (!startup_id) return err('startup_id is required', 400)
      const profileRow = await getProfileRow(startup_id)
      const claims = await getClaims(startup_id)
      const missions = await getMissions(startup_id)
      const covered = new Set(missions.map((m) => m.claim_id))
      const need = claims.filter((c) => c.evidence_required && c.status === 'unproven' && !covered.has(c.id))
      if (!need.length) return json({ missions: [], message: 'All claims already have missions' })
      // Chunk claims into small batches generated in PARALLEL to stay well under the 60s ingress timeout
      const CHUNK = 3
      const chunks = []
      for (let i = 0; i < need.length; i += CHUNK) chunks.push(need.slice(i, i + CHUNK))
      const results = await Promise.all(chunks.map((c) => generateMissions(profileRow?.profile || {}, c)))
      const generated = results.flat()
      const inserted = []
      for (const m of generated) {
        const row = await q(db.from('evidence_missions').insert({ startup_id, ...m, status: 'pending' }).select().single())
        inserted.push(row)
      }
      return json({ missions: inserted })
    }

    // Stage 4: chairman + investor readiness score
    if (path[0] === 'analyze' && path[1] === 'chairman') {
      const { startup_id } = body
      if (!startup_id) return err('startup_id is required', 400)
      const result = await runChairmanAndScore(startup_id)
      return json(result)
    }

    // Pitch Practice: start session -> first investor question
    if (path[0] === 'pitch' && path[1] === 'start') {
      const { startup_id } = body
      if (!startup_id) return err('startup_id is required', 400)
      const profileRow = await getProfileRow(startup_id)
      if (!profileRow) return err('Generate the startup profile first', 400)
      const reportsRaw = await getLatestReports(startup_id)
      if (!Object.keys(reportsRaw).length) return err('Convene the AI Board first — the investor uses its dossier', 400)
      const claims = await getClaims(startup_id)
      const scores = await q(db.from('score_history').select('*').eq('startup_id', startup_id).order('created_at', { ascending: false }).limit(1))
      const context = buildPitchContext(reportsRaw, claims, scores?.[0] || null)
      const session_id = crypto.randomUUID()
      const turn = await pitchTurn(profileRow.profile, context, [])
      await q(db.from('pitch_messages').insert({
        startup_id, session_id, role: 'assistant', content: turn.question,
        meta: { question_source: turn.question_source },
      }).select())
      return json({ session_id, ...turn })
    }

    // Pitch Practice: founder answer -> feedback + next question
    if (path[0] === 'pitch' && path.length === 1) {
      const { startup_id, session_id, message } = body
      if (!startup_id || !session_id || !str(message).trim()) return err('startup_id, session_id and message are required', 400)
      const profileRow = await getProfileRow(startup_id)
      const reportsRaw = await getLatestReports(startup_id)
      const claims = await getClaims(startup_id)
      const scores = await q(db.from('score_history').select('*').eq('startup_id', startup_id).order('created_at', { ascending: false }).limit(1))
      const context = buildPitchContext(reportsRaw, claims, scores?.[0] || null)
      await q(db.from('pitch_messages').insert({ startup_id, session_id, role: 'user', content: str(message).trim() }).select())
      const history = await q(db.from('pitch_messages').select('*').eq('session_id', session_id).order('created_at', { ascending: true }))
      const turn = await pitchTurn(profileRow?.profile || {}, context, history)
      await q(db.from('pitch_messages').insert({
        startup_id, session_id, role: 'assistant', content: turn.question,
        meta: { feedback: turn.feedback, answer_rating: turn.answer_rating, question_source: turn.question_source, done: turn.done },
      }).select())
      return json(turn)
    }

    // Pitch Practice: end session -> coach debrief
    if (path[0] === 'pitch' && path[1] === 'debrief') {
      const { startup_id, session_id } = body
      if (!startup_id || !session_id) return err('startup_id and session_id are required', 400)
      const profileRow = await getProfileRow(startup_id)
      const history = await q(db.from('pitch_messages').select('*').eq('session_id', session_id).order('created_at', { ascending: true }))
      if (!history.filter((m) => m.role === 'user').length) return err('Answer at least one question before ending the session', 400)
      const debrief = await pitchDebrief(profileRow?.profile || {}, history)
      await q(db.from('pitch_messages').insert({
        startup_id, session_id, role: 'assistant', content: `Session debrief: ${debrief.verdict}`,
        meta: { debrief },
      }).select())
      return json({ debrief })
    }

    // Evidence submission -> auto evaluation -> claim update -> optional follow-up mission
    if (path[0] === 'missions' && path.length === 3 && path[2] === 'submit') {
      const missionId = path[1]
      const mission = await q(db.from('evidence_missions').select('*').eq('id', missionId).single())
      const claim = mission.claim_id ? await q(db.from('claims').select('*').eq('id', mission.claim_id).single()) : { claim: mission.claim, criticism: '' }
      const profileRow = await getProfileRow(mission.startup_id)
      const submission = await q(db.from('evidence_submissions').insert({
        mission_id: missionId, startup_id: mission.startup_id,
        description: str(body.description), results: str(body.results), metrics: str(body.metrics),
        links: str(body.links), notes: str(body.notes),
      }).select().single())
      await q(db.from('evidence_missions').update({ status: 'submitted', updated_at: new Date().toISOString() }).eq('id', missionId).select())
      const evaluation = await evaluateEvidence(profileRow?.profile || {}, mission, claim, submission)
      const evalRow = await q(db.from('evidence_evaluations').insert({
        mission_id: missionId, submission_id: submission.id, startup_id: mission.startup_id,
        status: evaluation.status, confidence: evaluation.confidence, evaluation,
      }).select().single())
      const statusMap = { VALIDATED: 'validated', PARTIALLY_VALIDATED: 'partially_validated', UNPROVEN: 'unproven', REJECTED: 'rejected' }
      const newStatus = statusMap[evaluation.status] || 'unproven'
      await q(db.from('evidence_missions').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', missionId).select())
      if (mission.claim_id) await q(db.from('claims').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', mission.claim_id).select())
      let followup = null
      if (evaluation.additional_validation_required && evaluation.followup_mission) {
        followup = await q(db.from('evidence_missions').insert({
          startup_id: mission.startup_id, claim_id: mission.claim_id, claim: mission.claim,
          ...evaluation.followup_mission, status: 'pending', is_followup: true,
        }).select().single())
      }
      return json({ submission, evaluation: evalRow, followup })
    }

    return err('Not found', 404)
  } catch (e) {
    console.error('POST error:', e.message)
    return err(e.message)
  }
}

// ---------- PUT (profile edit + change detection) ----------
export async function PUT(request, ctx) {
  try {
    const { path = [] } = await ctx.params
    const body = await request.json().catch(() => ({}))

    if (path[0] === 'startups' && path.length === 3 && path[2] === 'profile') {
      const startupId = path[1]
      const existing = await getProfileRow(startupId)
      if (!existing) return err('No profile exists yet', 400)
      const newProfile = {}
      for (const f of PROFILE_FIELDS) {
        if (['competitors','existing_evidence','key_assumptions'].includes(f)) newProfile[f] = arr(body.profile?.[f]).map(str)
        else newProfile[f] = str(body.profile?.[f])
      }
      const { changed_fields, affected_agents } = detectChanges(existing.profile, newProfile)
      if (!changed_fields.length) return json({ changed_fields: [], affected_agents: [], version: existing.version, message: 'No changes detected' })
      const row = await q(db.from('startup_profiles').update({ profile: newProfile, version: existing.version + 1, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single())
      await q(db.from('startup_versions').insert({ startup_id: startupId, profile: newProfile, version: row.version, changed_fields }).select())
      await q(db.from('startups').update({ updated_at: new Date().toISOString() }).eq('id', startupId).select())
      return json({ changed_fields, affected_agents, version: row.version })
    }

    // Mission reminder: set / clear target date
    if (path[0] === 'missions' && path.length === 2) {
      const due = body.due_date
      if (due !== null && due !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(str(due))) return err('due_date must be YYYY-MM-DD or null', 400)
      const row = await q(db.from('evidence_missions').update({ due_date: due || null, updated_at: new Date().toISOString() }).eq('id', path[1]).select().single())
      return json({ mission: row })
    }

    return err('Not found', 404)
  } catch (e) {
    console.error('PUT error:', e.message)
    return err(e.message)
  }
}

// ---------- DELETE ----------
export async function DELETE(request, ctx) {
  try {
    const { path = [] } = await ctx.params
    if (path[0] === 'startups' && path.length === 2) {
      await q(db.from('startups').delete().eq('id', path[1]).select())
      return json({ deleted: true })
    }
    return err('Not found', 404)
  } catch (e) {
    console.error('DELETE error:', e.message)
    return err(e.message)
  }
}
