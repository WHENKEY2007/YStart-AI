'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import {
  Shield, Target, Wrench, DollarSign, TrendingUp, Swords, Scale, FlaskConical,
  LayoutDashboard, MessageSquare, FileText, Users, Gauge, ChevronRight, Loader2,
  CheckCircle2, AlertTriangle, XCircle, CircleDot, Plus, Send, Pencil, RefreshCw, ArrowRight, History, Download,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const HERO_IMG = 'https://images.unsplash.com/photo-1562184525-ead42cf98b1e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzh8MHwxfHNlYXJjaHw0fHxtaXNzaW9uJTIwY29udHJvbHxlbnwwfHx8YmxhY2t8MTc4ODAzMDQzMXww&ixlib=rb-4.1.0&q=85'

// ---------------- api helper ----------------
async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// ---------------- shared UI ----------------
const glass = 'rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm'

const PRIORITY_STYLE = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  low: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}
const STATUS_META = {
  pending: { label: 'Open Mission', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30', Icon: CircleDot },
  submitted: { label: 'Under Review', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', Icon: Loader2 },
  unproven: { label: 'Needs Stronger Proof', cls: 'bg-red-500/15 text-red-400 border-red-500/30', Icon: AlertTriangle },
  partially_validated: { label: 'Partially Validated', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', Icon: AlertTriangle },
  validated: { label: 'Validated', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', Icon: XCircle },
}

const Pill = ({ children, cls }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${cls}`}>{children}</span>
)
const StatusPill = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.unproven
  return <Pill cls={m.cls}><m.Icon className="h-3 w-3" />{m.label}</Pill>
}
const SectionList = ({ title, items, color = 'text-zinc-300', dot = 'bg-zinc-500' }) =>
  !items?.length ? null : (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className={`flex gap-2 text-sm leading-relaxed ${color}`}>
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />{it}
          </li>
        ))}
      </ul>
    </div>
  )

function scoreColor(n) {
  if (n >= 75) return 'text-emerald-400'
  if (n >= 50) return 'text-amber-400'
  return 'text-red-400'
}
function scoreBar(n) {
  if (n >= 75) return 'bg-emerald-500'
  if (n >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

// ---------------- Landing ----------------
function Landing({ onEnter }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950">
      <div className="absolute inset-0">
        <img src={HERO_IMG} alt="" className="h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/85 to-zinc-950" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400">
          <Shield className="h-3.5 w-3.5" /> AI Startup Validation Platform
        </div>
        <h1 className="font-[family-name:var(--font-grotesk)] text-6xl font-bold tracking-tight text-white md:text-8xl">
          YStart<span className="text-emerald-400">-AI</span>
        </h1>
        <p className="mt-6 text-2xl font-semibold text-zinc-200 md:text-3xl">
          Don&apos;t pitch assumptions. <span className="text-emerald-400">Prove them.</span>
        </p>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-zinc-400">
          AI board that tests your startup idea, gives you clear evidence missions, and scores your investor readiness.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500">
          {['IDEA', 'AI INTERVIEW', 'AI BOARD', 'REAL PROOF', 'EVALUATION', 'INVESTOR SCORE'].map((s, i, a) => (
            <span key={s} className="flex items-center gap-3">
              <span className="rounded border border-white/10 bg-white/5 px-2.5 py-1 font-mono tracking-wider">{s}</span>
              {i < a.length - 1 && <ChevronRight className="h-3 w-3 text-emerald-500" />}
            </span>
          ))}
        </div>
        <Button onClick={onEnter} size="lg" className="mt-12 h-14 bg-emerald-500 px-10 text-base font-semibold text-zinc-950 hover:bg-emerald-400">
          Start Validating <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}

// ---------------- Create Startup ----------------
function CreateStartup({ onCreated, busy, setBusy, setError }) {
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const [industry, setIndustry] = useState('')
  const [stage, setStage] = useState('Idea / Concept')

  const submit = async () => {
    if (!name.trim() || !idea.trim()) return
    setBusy(true); setError('')
    try {
      const fullIdea = industry.trim() ? `[Industry: ${industry.trim()}] ${idea.trim()}` : idea.trim()
      const data = await api('/startups', { method: 'POST', body: { name: name.trim(), idea: fullIdea, stage } })
      onCreated(data.startup)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="mx-auto max-w-2xl pt-10">
      <div className={`${glass} p-8`}>
        <h2 className="font-[family-name:var(--font-grotesk)] text-2xl font-bold text-white">Create Startup</h2>
        <p className="mt-1 text-sm text-zinc-400">Enter your idea. The board will interrogate it.</p>
        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-zinc-500">Startup Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SkillForge" className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-zinc-500">Startup Idea / Description</label>
            <Textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} placeholder="e.g. An AI-powered platform that helps engineering students gain real-world experience through industry projects." className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-zinc-500">Industry (Optional)</label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. EdTech / AI" className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-zinc-500">Startup Stage (Optional)</label>
              <Input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="e.g. Idea / Prototype" className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600" />
            </div>
          </div>
          <Button onClick={submit} disabled={busy || !name.trim() || !idea.trim()} className="w-full bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating &amp; preparing interview...</> : 'Start Founder Interview'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Interview ----------------
function InterviewView({ data, refresh, setTab, setError }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(data.interview || [])
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(false)
  const endRef = useRef(null)

  useEffect(() => { setMessages(data.interview || []) }, [data.interview])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  const answers = messages.filter((m) => m.role === 'user').length

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput(''); setBusy(true); setError('')
    setMessages((m) => [...m, { id: 'tmp-u', role: 'user', content: text }])
    try {
      const turn = await api('/interview', { method: 'POST', body: { startup_id: data.startup.id, message: text } })
      setMessages((m) => [...m, { id: 'tmp-a', role: 'assistant', content: turn.question }])
      setProgress(turn.progress || 0)
      if (turn.done) setDone(true)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const complete = async () => {
    setGenerating(true); setError('')
    try {
      await api('/interview/complete', { method: 'POST', body: { startup_id: data.startup.id } })
      await refresh()
      setTab('profile')
    } catch (e) { setError(e.message) } finally { setGenerating(false) }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-120px)] max-w-3xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-grotesk)] text-xl font-bold text-white">Founder Interview</h2>
          <p className="text-xs text-zinc-500">The interviewer digs into your idea one question at a time.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32"><Progress value={done ? 100 : progress || Math.min(95, answers * 10)} className="h-1.5 bg-white/10" /></div>
          <span className="text-xs text-zinc-500">{answers} answers</span>
        </div>
      </div>
      <div className={`${glass} flex-1 space-y-4 overflow-y-auto p-5`}>
        {messages.map((m, i) => (
          <div key={m.id || i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-500/20' : 'bg-white/5 text-zinc-200 border border-white/10'}`}>
              {m.role === 'assistant' && <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Interview Agent</div>}
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start"><div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-500"><Loader2 className="inline h-4 w-4 animate-spin" /> thinking...</div></div>
        )}
        <div ref={endRef} />
      </div>
      <div className="mt-4 space-y-3">
        {(done || answers >= 4) && (
          <Button onClick={complete} disabled={generating} className="w-full bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400">
            {generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Startup Profile...</> : done ? 'Generate Startup Profile' : `Finish early & generate profile (${answers} answers)`}
          </Button>
        )}
        {!done && (
          <div className="flex gap-2">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Your answer..." disabled={busy || generating}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              className="border-white/10 bg-white/5 text-white placeholder:text-zinc-600" />
            <Button onClick={send} disabled={busy || generating || !input.trim()} className="h-auto bg-emerald-500 px-5 text-zinc-950 hover:bg-emerald-400"><Send className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Analysis Runner overlay ----------------
const STAGES = [
  { key: 'specialists', label: 'Specialist agents analyzing', desc: 'Market · Product · Business · Growth (parallel)' },
  { key: 'critic', label: 'Critic challenging claims', desc: 'Hunting unsupported claims & contradictions' },
  { key: 'missions', label: 'Evidence Agent designing missions', desc: 'Turning weak claims into measurable tasks' },
  { key: 'chairman', label: 'Chairman delivering verdict', desc: 'Evidence-based assessment & readiness score' },
]

function AnalysisRunner({ startupId, agents, stages, onDone, onError }) {
  const activeStages = stages?.length ? STAGES.filter((s) => stages.includes(s.key)) : STAGES
  const [stageIdx, setStageIdx] = useState(0)
  const [failed, setFailed] = useState(null)
  const running = useRef(false)

  const run = useCallback(async (fromIdx = 0) => {
    if (running.current) return
    running.current = true
    setFailed(null)
    try {
      for (let i = fromIdx; i < activeStages.length; i++) {
        setStageIdx(i)
        const stage = activeStages[i].key
        const body = { startup_id: startupId }
        if (stage === 'specialists' && agents?.length) body.agents = agents
        if (stage === 'specialists' && agents?.length === 0) continue
        try {
          await api(`/analyze/${stage}`, { method: 'POST', body })
        } catch (e) {
          // Gateway-timeout resilience: the backend may have finished even if the proxy dropped the response.
          if (stage === 'missions') {
            await new Promise((r) => setTimeout(r, 5000))
            const d = await api(`/startups/${startupId}`)
            if ((d.missions || []).some((m) => m.status === 'pending')) continue
          }
          throw e
        }
      }
      onDone()
    } catch (e) {
      setFailed({ idx: stageIdx, message: e.message })
      onError?.(e.message)
    } finally { running.current = false }
  }, [startupId, agents, activeStages, onDone, onError, stageIdx])

  useEffect(() => { run(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
      <div className={`${glass} w-full max-w-md p-8`}>
        <h3 className="font-[family-name:var(--font-grotesk)] text-lg font-bold text-white">{activeStages.length < STAGES.length ? 'Smart re-analysis in progress' : 'The Board is in session'}</h3>
        <p className="mt-1 text-xs text-zinc-500">{activeStages.length < STAGES.length ? 'Only affected agents are re-running to refresh your score.' : 'This can take a minute or two. Do not close the page.'}</p>
        <div className="mt-6 space-y-4">
          {activeStages.map((s, i) => (
            <div key={s.key} className="flex items-start gap-3">
              <div className="mt-0.5">
                {failed && failed.idx === i ? <XCircle className="h-5 w-5 text-red-400" />
                  : i < stageIdx ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  : i === stageIdx ? <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                  : <CircleDot className="h-5 w-5 text-zinc-700" />}
              </div>
              <div>
                <div className={`text-sm font-medium ${i <= stageIdx ? 'text-zinc-200' : 'text-zinc-600'}`}>{s.label}</div>
                <div className="text-xs text-zinc-600">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        {failed && (
          <div className="mt-6 space-y-3">
            <p className="text-xs text-red-400">{failed.message}</p>
            <Button onClick={() => run(failed.idx)} className="w-full bg-emerald-500 text-zinc-950 hover:bg-emerald-400"><RefreshCw className="mr-2 h-4 w-4" /> Retry from failed stage</Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Profile ----------------
const FIELD_LABELS = {
  startup_name: 'Startup Name', idea: 'Idea', target_customer: 'Target Customer', customer_problem: 'Customer Problem',
  current_alternatives: 'Current Alternatives', solution: 'Solution', value_proposition: 'Value Proposition',
  competitors: 'Competitors', business_model: 'Business Model', pricing: 'Pricing', growth_strategy: 'Growth Strategy',
  first_100_users: 'First 100 Users', traction: 'Traction', existing_evidence: 'Existing Evidence', key_assumptions: 'Key Assumptions',
}
const ARRAY_FIELDS = ['competitors', 'existing_evidence', 'key_assumptions']

function ProfileView({ data, refresh, setError, startAnalysis }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const profile = data.profile
  const hasReports = Object.keys(data.reports || {}).length > 0

  if (!profile) return <div className="pt-10 text-center text-sm text-zinc-500">Complete the Founder Interview to generate your Startup Profile.</div>

  const startEdit = () => {
    const f = {}
    for (const k of Object.keys(FIELD_LABELS)) f[k] = ARRAY_FIELDS.includes(k) ? (profile[k] || []).join('\n') : profile[k] || ''
    setForm(f); setEditing(true); setSaveResult(null)
  }
  const save = async () => {
    setSaving(true); setError('')
    try {
      const payload = {}
      for (const k of Object.keys(FIELD_LABELS)) payload[k] = ARRAY_FIELDS.includes(k) ? form[k].split('\n').map((s) => s.trim()).filter(Boolean) : form[k]
      const res = await api(`/startups/${data.startup.id}/profile`, { method: 'PUT', body: { profile: payload } })
      setEditing(false)
      await refresh()
      // Smart Re-Analysis: automatically rerun ONLY affected specialists + Chairman re-score
      if (res.changed_fields?.length && hasReports) {
        setSaveResult({ ...res, auto: true })
        startAnalysis(res.affected_agents || [], res.affected_agents?.length ? ['specialists', 'chairman'] : ['chairman'])
      } else {
        setSaveResult(res)
      }
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-grotesk)] text-xl font-bold text-white">Startup Profile</h2>
          <p className="text-xs text-zinc-500">
            Version {data.profile_version} · Last updated {data.profile_updated_at ? new Date(data.profile_updated_at).toLocaleString() : '—'}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing && <Button onClick={startEdit} variant="outline" className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5"><Pencil className="mr-2 h-4 w-4" /> Edit</Button>}
          {!hasReports && !editing && (
            <Button onClick={() => startAnalysis(null)} className="bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400">
              <Users className="mr-2 h-4 w-4" /> Convene the AI Board
            </Button>
          )}
        </div>
      </div>

      {saveResult && saveResult.changed_fields?.length > 0 && (
        <div className={`${glass} ${saveResult.auto ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'} p-4`}>
          <div className="flex items-start gap-3">
            {saveResult.auto ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />}
            <div className="flex-1">
              <p className={`text-sm font-medium ${saveResult.auto ? 'text-emerald-300' : 'text-amber-300'}`}>Changes detected: {saveResult.changed_fields.map((f) => FIELD_LABELS[f] || f).join(', ')}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {saveResult.auto
                  ? `Smart re-analysis ran automatically: ${saveResult.affected_agents?.length ? saveResult.affected_agents.join(', ') + ' agent(s) re-analyzed' : 'no specialist affected'} + Chairman re-scored.`
                  : saveResult.affected_agents?.length
                  ? `Affected agents to re-run: ${saveResult.affected_agents.join(', ')} + Critic + Chairman`
                  : 'No specialist re-run needed, but the Critic and Chairman should re-assess.'}
              </p>
              {hasReports && (
                <Button onClick={() => { setSaveResult(null); startAnalysis(null) }} size="sm" variant="outline" className="mt-3 border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Run full board instead (Critic + new missions)
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {Object.keys(FIELD_LABELS).map((k) => (
          <div key={k} className={`${glass} p-4 ${['idea', 'key_assumptions'].includes(k) ? 'md:col-span-2' : ''}`}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{FIELD_LABELS[k]}</div>
            {editing ? (
              <Textarea value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} rows={ARRAY_FIELDS.includes(k) ? 3 : 2}
                placeholder={ARRAY_FIELDS.includes(k) ? 'One item per line' : ''}
                className="border-white/10 bg-white/5 text-sm text-white" />
            ) : ARRAY_FIELDS.includes(k) ? (
              (profile[k] || []).length ? (
                <ul className="space-y-1">{(profile[k] || []).map((it, i) => <li key={i} className="flex gap-2 text-sm text-zinc-300"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{it}</li>)}</ul>
              ) : <span className="text-sm text-zinc-600">Not specified</span>
            ) : (
              <p className="text-sm leading-relaxed text-zinc-300">{profile[k] || <span className="text-zinc-600">Not specified</span>}</p>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save changes'}
          </Button>
          <Button onClick={() => setEditing(false)} variant="outline" className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5">Cancel</Button>
        </div>
      )}

      {data.versions?.length > 1 && (
        <div className={`${glass} p-4`}>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500"><History className="h-3.5 w-3.5" /> Version history</div>
          <ul className="space-y-1.5">
            {data.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-xs text-zinc-400">
                <span>v{v.version} — {(v.changed_fields || []).map((f) => FIELD_LABELS[f] || f).join(', ')}</span>
                <span className="text-zinc-600">{new Date(v.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---------------- AI Board ----------------
const AGENT_META = {
  market: { name: 'Market Agent', icon: Target, color: 'text-sky-400', ring: 'border-sky-500/20' },
  product: { name: 'Product Agent', icon: Wrench, color: 'text-violet-400', ring: 'border-violet-500/20' },
  business: { name: 'Business & Finance', icon: DollarSign, color: 'text-emerald-400', ring: 'border-emerald-500/20' },
  growth: { name: 'Growth Agent', icon: TrendingUp, color: 'text-orange-400', ring: 'border-orange-500/20' },
  critic: { name: 'Critic Agent', icon: Swords, color: 'text-red-400', ring: 'border-red-500/20' },
  chairman: { name: 'Chairman', icon: Scale, color: 'text-amber-400', ring: 'border-amber-500/20' },
}

function BoardView({ data, startAnalysis }) {
  const [open, setOpen] = useState(null)
  const reports = data.reports || {}
  const order = ['market', 'product', 'business', 'growth', 'critic', 'chairman']
  const any = order.some((k) => reports[k])

  if (!any) {
    return (
      <div className="pt-10 text-center">
        <p className="text-sm text-zinc-500">The board has not analyzed this startup yet.</p>
        {data.profile && <Button onClick={() => startAnalysis(null)} className="mt-4 bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400"><Users className="mr-2 h-4 w-4" /> Convene the AI Board</Button>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-grotesk)] text-xl font-bold text-white">AI Board</h2>
          <p className="text-xs text-zinc-500">Six perspectives. Zero flattery.</p>
        </div>
        <Button onClick={() => startAnalysis(null)} variant="outline" size="sm" className="border-white/15 bg-transparent text-zinc-300 hover:bg-white/5"><RefreshCw className="mr-2 h-3.5 w-3.5" /> Re-run full board</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {order.map((k) => {
          const meta = AGENT_META[k]
          const r = reports[k]
          return (
            <button key={k} onClick={() => r && setOpen(k)} disabled={!r}
              className={`${glass} ${meta.ring} p-5 text-left transition hover:bg-white/[0.06] disabled:opacity-40`}>
              <div className="flex items-center gap-3">
                <div className={`rounded-lg border border-white/10 bg-white/5 p-2 ${meta.color}`}><meta.icon className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold text-white">{meta.name}</div>
                  <div className="text-[11px] text-zinc-500">{r ? new Date(r.created_at).toLocaleString() : 'Not run yet'}</div>
                </div>
              </div>
              {r && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-400">{r.summary}</p>}
              {r && (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                  {r.strengths?.length ? <span className="text-emerald-500">{r.strengths.length} strengths</span> : null}
                  {r.risks?.length ? <span className="text-red-400">{r.risks.length} risks</span> : null}
                  {r.claims?.length ? <span className="text-amber-400">{r.claims.length} claims</span> : null}
                  {r.critical_risks?.length ? <span className="text-red-400">{r.critical_risks.length} critical risks</span> : null}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100">
          {open && reports[open] && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-[family-name:var(--font-grotesk)] text-white">
                  {(() => { const I = AGENT_META[open].icon; return <I className={`h-5 w-5 ${AGENT_META[open].color}`} /> })()}
                  {AGENT_META[open].name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <p className="text-sm leading-relaxed text-zinc-300">{reports[open].summary || reports[open].overall_assessment}</p>
                <SectionList title="Strengths" items={reports[open].strengths} dot="bg-emerald-500" />
                <SectionList title="Risks" items={reports[open].risks} dot="bg-red-500" />
                <SectionList title="Critical Risks" items={reports[open].critical_risks} dot="bg-red-500" />
                <SectionList title="Claims requiring evidence" items={reports[open].claims?.map((c) => (typeof c === 'string' ? c : c.claim))} dot="bg-amber-500" />
                <SectionList title="Assumptions" items={reports[open].assumptions} dot="bg-amber-500" />
                <SectionList title="Contradictions" items={reports[open].contradictions} dot="bg-red-500" />
                <SectionList title="Hard questions" items={reports[open].questions} dot="bg-sky-500" />
                <SectionList title="Recommendations" items={reports[open].recommendations} dot="bg-emerald-500" />
                <SectionList title="Validated claims" items={reports[open].validated_claims} dot="bg-emerald-500" />
                <SectionList title="Unproven claims" items={reports[open].unproven_claims} dot="bg-red-500" />
                <SectionList title="Highest priority next actions" items={reports[open].next_actions} dot="bg-emerald-500" />
                <SectionList title="Recommended changes" items={reports[open].recommended_changes} dot="bg-sky-500" />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- Evidence Lab ----------------
function EvidenceLab({ data, refresh, setError }) {
  const [submitFor, setSubmitFor] = useState(null)
  const [form, setForm] = useState({ description: '', results: '', metrics: '', links: '', notes: '', image: '', imageName: '' })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [recalcing, setRecalcing] = useState(false)
  const [filter, setFilter] = useState('open') // 'open' | 'evaluated' | 'all'
  const missions = data.missions || []

  const submit = async () => {
    setBusy(true); setError('')
    try {
      const res = await api(`/missions/${submitFor.id}/submit`, { method: 'POST', body: form })
      setResult(res)
      setSubmitFor(null)
      setForm({ description: '', results: '', metrics: '', links: '', notes: '', image: '', imageName: '' })
      await refresh()
      // auto re-run chairman -> new readiness score (the loop closes)
      setRecalcing(true)
      try { await api('/analyze/chairman', { method: 'POST', body: { startup_id: data.startup.id } }); await refresh() } catch {}
      setRecalcing(false)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (!missions.length) {
    return <div className="pt-10 text-center text-sm text-zinc-500">No evidence missions yet. Convene the AI Board first — the Critic will generate claims and the Evidence Agent will create missions.</div>
  }

  const openMissions = missions.filter((m) => m.status === 'pending' || m.status === 'submitted')
  const evaluatedMissions = missions.filter((m) => m.status !== 'pending' && m.status !== 'submitted')

  const MissionCard = ({ m, isEvaluated = false }) => {
    const ev = m.evaluations?.[m.evaluations.length - 1]
    const sub = m.submissions?.[m.submissions.length - 1]

    return (
      <div className={`${glass} flex flex-col p-5`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{m.title}</h3>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Pill cls={PRIORITY_STYLE[m.priority] || PRIORITY_STYLE.medium}>{m.priority}</Pill>
            <StatusPill status={m.status} />
          </div>
        </div>
        {m.is_followup && <span className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-sky-400">Follow-up mission</span>}
        <div className="mt-3 space-y-3 text-sm flex-1">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Claim under test</div>
            <p className="mt-0.5 italic text-zinc-400">&ldquo;{m.claim}&rdquo;</p>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Task · {m.task_type?.replace(/_/g, ' ')}</div>
            <p className="mt-0.5 leading-relaxed text-zinc-300">{m.description}</p>
          </div>
          {m.instructions?.length > 0 && (
            <ul className="space-y-1">
              {m.instructions.map((it, i) => <li key={i} className="flex gap-2 text-xs text-zinc-400"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />{it}</li>)}
            </ul>
          )}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Success criteria</div>
            <p className="mt-0.5 text-xs text-emerald-200/80">{m.success_criteria}</p>
          </div>
          {ev && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Evaluation Result</span>
                <span className={`text-xs font-bold ${scoreColor(ev.confidence)}`}>{ev.confidence}/100 confidence</span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-300">{ev.evaluation?.reasoning}</p>
              {ev.evaluation?.does_not_prove && (
                <div className="rounded bg-red-500/10 border border-red-500/20 p-2 text-xs text-red-300">
                  <span className="font-semibold text-red-400">Why proof was insufficient:</span> {ev.evaluation.does_not_prove}
                </div>
              )}
              {sub?.links && sub.links.includes('[Image Attachment:') && (
                <div className="text-[11px] text-emerald-400/90 font-medium">
                  ✓ Photo / Screenshot proof attached
                </div>
              )}
            </div>
          )}
        </div>
        {!isEvaluated && m.status === 'pending' && (
          <Button onClick={() => { setSubmitFor(m); setResult(null) }} size="sm" className="mt-4 bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400">
            <FlaskConical className="mr-2 h-3.5 w-3.5" /> Submit Evidence
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-grotesk)] text-xl font-bold text-white">Evidence Lab</h2>
          <p className="text-xs text-zinc-500">Complete missions in the real world, submit evidence, and the Evidence Agent will judge it.</p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
          <button
            onClick={() => setFilter('open')}
            className={`rounded px-3 py-1 font-medium transition ${filter === 'open' ? 'bg-emerald-500 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Open Missions ({openMissions.length})
          </button>
          <button
            onClick={() => setFilter('evaluated')}
            className={`rounded px-3 py-1 font-medium transition ${filter === 'evaluated' ? 'bg-emerald-500 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Completed &amp; Evaluated ({evaluatedMissions.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`rounded px-3 py-1 font-medium transition ${filter === 'all' ? 'bg-emerald-500 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            All ({missions.length})
          </button>
        </div>
      </div>

      {recalcing && (
        <div className={`${glass} flex items-center gap-3 border-emerald-500/20 p-4 text-sm text-emerald-300`}>
          <Loader2 className="h-4 w-4 animate-spin" /> Evidence accepted — the Chairman is re-assessing and updating your Investor Readiness Score...
        </div>
      )}

      {(filter === 'open' || filter === 'all') && openMissions.length > 0 && (
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-sky-400">Open missions needing evidence ({openMissions.length})</div>
          <div className="grid gap-4 md:grid-cols-2">{openMissions.map((m) => <MissionCard key={m.id} m={m} isEvaluated={false} />)}</div>
        </div>
      )}

      {(filter === 'open' && openMissions.length === 0) && (
        <div className={`${glass} p-8 text-center text-sm text-zinc-400`}>
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 mb-2" />
          All current missions have been submitted and evaluated! Check the &ldquo;Completed &amp; Evaluated&rdquo; tab or your Investor Readiness tab.
        </div>
      )}

      {(filter === 'evaluated' || filter === 'all') && evaluatedMissions.length > 0 && (
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">Completed &amp; evaluated proof ({evaluatedMissions.length})</div>
          <div className="grid gap-4 md:grid-cols-2">{evaluatedMissions.map((m) => <MissionCard key={m.id} m={m} isEvaluated={true} />)}</div>
        </div>
      )}

      {(filter === 'evaluated' && evaluatedMissions.length === 0) && (
        <div className={`${glass} p-8 text-center text-sm text-zinc-400`}>
          No missions submitted yet. Submit evidence on an open mission to see evaluation results here.
        </div>
      )}

      <Dialog open={!!submitFor} onOpenChange={(v) => !v && setSubmitFor(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100">
          <DialogHeader><DialogTitle className="text-white">Submit Evidence — {submitFor?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[
              ['description', 'What did you do?', 'e.g. Interviewed 20 engineering students at 3 universities over 2 weeks'],
              ['results', 'Results / findings', 'e.g. 18 of 20 students reported difficulty gaining real-world experience'],
              ['metrics', 'Numbers / metrics', 'e.g. 20 interviews, 18 confirmed problem, avg pain score 8.2/10'],
              ['links', 'Links (optional)', 'e.g. survey results, recordings, landing page'],
              ['notes', 'Notes (optional)', 'Anything else the evaluator should know'],
            ].map(([k, label, ph]) => (
              <div key={k}>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{label}</label>
                <Textarea value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} rows={k === 'description' || k === 'results' ? 3 : 2}
                  placeholder={ph} className="border-white/10 bg-white/5 text-sm text-white placeholder:text-zinc-600" />
              </div>
            ))}
            
            {/* Optional Image Upload (.jpg / .png) */}
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Proof Screenshot / Photo (.jpg, .png) — Optional</label>
              <Input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (evt) => {
                    setForm((f) => ({ ...f, image: evt.target.result, imageName: file.name }))
                  }
                  reader.readAsDataURL(file)
                }}
                className="border-white/10 bg-white/5 text-xs text-zinc-300 file:mr-2 file:rounded file:border-0 file:bg-emerald-500/20 file:px-2 file:py-1 file:text-xs file:font-medium file:text-emerald-300"
              />
              {form.image && (
                <div className="mt-2 flex items-center justify-between rounded border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <img src={form.image} alt="Preview" className="h-10 w-10 shrink-0 rounded object-cover" />
                    <span className="truncate text-xs text-zinc-300">{form.imageName || 'Attached proof image'}</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, image: '', imageName: '' }))} className="h-7 text-xs text-red-400 hover:text-red-300">
                    Remove
                  </Button>
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-600">Your submission is self-reported and will be evaluated as founder-provided evidence.</p>
            <Button onClick={submit} disabled={busy || !form.description.trim()} className="w-full bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Evidence Agent evaluating...</> : 'Submit for evaluation'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!result} onOpenChange={(v) => !v && setResult(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-white/10 bg-zinc-950 text-zinc-100">
          {result && (
            <>
              <DialogHeader><DialogTitle className="text-white">Evidence Evaluation</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <StatusPill status={(result.evaluation?.status || 'UNPROVEN').toLowerCase()} />
                  <span className={`text-lg font-bold ${scoreColor(result.evaluation?.confidence || 0)}`}>{result.evaluation?.confidence}/100</span>
                </div>
                {[
                  ['What this proves', result.evaluation?.evaluation?.proves],
                  ['What it does NOT prove', result.evaluation?.evaluation?.does_not_prove],
                  ['Evidence quality', result.evaluation?.evaluation?.quality],
                  ['Reasoning', result.evaluation?.evaluation?.reasoning],
                ].map(([t, v]) => v ? (
                  <div key={t}>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">{t}</div>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-300">{v}</p>
                  </div>
                ) : null)}
                {result.followup && (
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-sky-400">Follow-up mission created</div>
                    <p className="mt-1 text-sm text-sky-200">{result.followup.title}</p>
                  </div>
                )}
                <Button onClick={() => setResult(null)} className="w-full bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400">Back to Evidence Lab</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- Investor Readiness ----------------
const CAT_LABELS = {
  market_validation: 'Market Validation', product: 'Product', business_model: 'Business Model',
  growth: 'Growth Strategy', traction: 'Traction', moat: 'Defensibility / Moat', evidence_quality: 'Evidence Quality',
}

// ---------------- Investor One-Pager export (no AI calls — composed from existing data) ----------------
function openOnePager(data) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const p = data.profile || {}
  const score = data.latest_score
  const chairman = data.reports?.chairman || {}
  const validated = (data.claims || []).filter((c) => ['validated', 'partially_validated'].includes(c.status))
  const latestEvalByMission = {}
  for (const m of data.missions || []) {
    const ev = m.evaluations?.[m.evaluations.length - 1]
    if (ev && ['VALIDATED', 'PARTIALLY_VALIDATED'].includes(ev.status)) latestEvalByMission[m.id] = { title: m.title, status: ev.status, confidence: ev.confidence }
  }
  const evidenceRows = Object.values(latestEvalByMission)
  const col = (n) => (n >= 75 ? '#059669' : n >= 50 ? '#d97706' : '#dc2626')
  const catRows = Object.entries(CAT_LABELS).map(([k, label]) => {
    const c = score?.categories?.[k]
    if (!c) return ''
    return `<tr><td style="padding:5px 10px 5px 0;color:#52525b;font-size:12px;white-space:nowrap">${esc(label)}</td><td style="width:100%"><div style="background:#e4e4e7;border-radius:99px;height:8px"><div style="width:${c.score}%;background:${col(c.score)};height:8px;border-radius:99px"></div></div></td><td style="padding-left:10px;font-weight:700;font-size:12px;color:${col(c.score)}">${c.score}</td></tr>`
  }).join('')
  const li = (items, color = '#18181b') => (items || []).slice(0, 5).map((x) => `<li style="margin-bottom:4px;color:${color};font-size:12.5px;line-height:1.5">${esc(x)}</li>`).join('')
  const cell = (label, value) => `<div style="border:1px solid #e4e4e7;border-radius:10px;padding:10px 12px"><div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#a1a1aa;margin-bottom:4px">${esc(label)}</div><div style="font-size:12.5px;color:#27272a;line-height:1.5">${esc(value || 'Not specified')}</div></div>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(p.startup_name || data.startup?.name)} — Investor One-Pager</title>
<style>@media print{.noprint{display:none!important}@page{margin:12mm}}body{margin:0;background:#fafafa}</style></head>
<body style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div class="noprint" style="position:fixed;top:14px;right:14px;z-index:10"><button onclick="window.print()" style="background:#10b981;color:#0a0a0a;border:none;border-radius:8px;padding:10px 18px;font-weight:700;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15)">Print / Save as PDF</button></div>
<div style="max-width:820px;margin:0 auto;background:#fff;padding:36px 40px;min-height:100vh;box-sizing:border-box">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #10b981;padding-bottom:16px">
    <div>
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:#10b981;text-transform:uppercase">YStart-AI · Evidence-Validated Startup</div>
      <h1 style="margin:6px 0 4px;font-size:30px;color:#09090b">${esc(p.startup_name || data.startup?.name)}</h1>
      <p style="margin:0;font-size:13.5px;color:#3f3f46;max-width:520px;line-height:1.5">${esc(p.value_proposition && p.value_proposition !== 'Not specified' ? p.value_proposition : p.idea || data.startup?.idea)}</p>
    </div>
    ${score ? `<div style="text-align:center;border:2px solid ${col(score.overall)};border-radius:14px;padding:12px 20px;min-width:120px">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#71717a">Investor Readiness</div>
      <div style="font-size:42px;font-weight:800;color:${col(score.overall)};line-height:1.1">${score.overall}<span style="font-size:16px;color:#a1a1aa">/100</span></div>
      <div style="font-size:9.5px;font-weight:700;color:${col(score.overall)};margin-top:2px">${esc(score.readiness_status)}</div>
    </div>` : ''}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px">
    ${cell('Target Customer', p.target_customer)}
    ${cell('Problem', p.customer_problem)}
    ${cell('Solution', p.solution)}
    ${cell('Business Model & Pricing', [p.business_model, p.pricing].filter((x) => x && x !== 'Not specified').join(' — '))}
    ${cell('Traction', p.traction)}
    ${cell('Competitors', (p.competitors || []).join(', '))}
  </div>

  ${score ? `<div style="margin-top:20px"><div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#71717a;margin-bottom:8px">Score Breakdown</div><table style="width:100%;border-collapse:collapse">${catRows}</table></div>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px">
    <div>
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#059669;margin-bottom:8px">Validated Claims (${validated.length})</div>
      ${validated.length ? `<ul style="margin:0;padding-left:18px">${li(validated.map((c) => c.claim))}</ul>` : '<p style="font-size:12px;color:#a1a1aa;margin:0">No independently validated claims yet.</p>'}
      ${evidenceRows.length ? `<div style="margin-top:10px;font-size:11px;color:#52525b">${evidenceRows.slice(0, 4).map((e) => `• ${esc(e.title)} — <b style="color:${col(e.confidence)}">${e.status === 'VALIDATED' ? 'Validated' : 'Partially validated'} (${e.confidence}/100)</b>`).join('<br>')}</div>` : ''}
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#0284c7;margin-bottom:8px">Key Strengths</div>
      ${chairman.strengths?.length ? `<ul style="margin:0;padding-left:18px">${li(chairman.strengths)}</ul>` : '<p style="font-size:12px;color:#a1a1aa;margin:0">Run the AI Board to surface strengths.</p>'}
    </div>
  </div>

  ${chairman.overall_assessment ? `<div style="margin-top:20px;border-left:3px solid #10b981;background:#f0fdf4;border-radius:0 10px 10px 0;padding:12px 14px"><div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#059669;margin-bottom:5px">Board Assessment</div><p style="margin:0;font-size:12.5px;color:#27272a;line-height:1.6">${esc(chairman.overall_assessment)}</p></div>` : ''}

  ${chairman.critical_risks?.length ? `<div style="margin-top:16px"><div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#dc2626;margin-bottom:8px">Known Risks (transparent by design)</div><ul style="margin:0;padding-left:18px">${li(chairman.critical_risks, '#3f3f46')}</ul></div>` : ''}

  <div style="margin-top:26px;border-top:1px solid #e4e4e7;padding-top:10px;font-size:9.5px;color:#a1a1aa;line-height:1.5">
    Generated by YStart-AI on ${new Date().toLocaleDateString()}. The Investor Readiness Score is an evidence-based readiness assessment, not a guarantee of investment.
  </div>
</div></body></html>`

  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(html)
  w.document.close()
  return true
}

function ReadinessView({ data }) {
  const [openCat, setOpenCat] = useState(null)
  const score = data.latest_score
  if (!score) return <div className="pt-10 text-center text-sm text-zinc-500">No readiness score yet. Convene the AI Board to get your first evidence-based assessment.</div>

  const history = (data.score_history || []).map((s, i) => ({ n: i + 1, score: s.overall, date: new Date(s.created_at).toLocaleDateString() }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-grotesk)] text-xl font-bold text-white">Investor Readiness</h2>
          <p className="text-xs text-zinc-500">Evidence-based score with full explanations per category.</p>
        </div>
        <Button data-testid="export-onepager" onClick={() => openOnePager(data)} variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
          <Download className="mr-2 h-4 w-4" /> Export Investor One-Pager
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${glass} flex flex-col items-center justify-center p-8 text-center`}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Investor Readiness Score</div>
          <div className={`mt-2 font-[family-name:var(--font-grotesk)] text-7xl font-bold ${scoreColor(score.overall)}`}>{score.overall}</div>
          <div className="text-sm text-zinc-500">/ 100</div>
          <Pill cls={`mt-4 ${score.overall >= 75 ? STATUS_META.validated.cls : score.overall >= 50 ? STATUS_META.partially_validated.cls : STATUS_META.unproven.cls}`}>{score.readiness_status}</Pill>
          <p className="mt-4 text-[10px] leading-relaxed text-zinc-600">Evidence-based readiness assessment — not a guarantee of investment.</p>
        </div>
        <div className={`${glass} p-5 lg:col-span-2`}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Score history</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#52525b" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#52525b" fontSize={11} />
                <RTooltip contentStyle={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e4e4e7', fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Strongest area', score.strongest_area, 'text-emerald-400'],
          ['Biggest weakness', score.biggest_weakness, 'text-red-400'],
          ['Critical investor objection', score.critical_objection, 'text-amber-400'],
          ['Recommended next action', score.next_action, 'text-sky-400'],
        ].map(([t, v, c]) => (
          <div key={t} className={`${glass} p-4`}>
            <div className={`text-[11px] font-semibold uppercase tracking-widest ${c}`}>{t}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">{v || '—'}</p>
          </div>
        ))}
      </div>

      <div className={`${glass} p-5`}>
        <div className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Category breakdown — click for evidence details</div>
        <div className="space-y-3">
          {Object.entries(CAT_LABELS).map(([k, label]) => {
            const c = score.categories?.[k]
            if (!c) return null
            const isOpen = openCat === k
            return (
              <div key={k}>
                <button onClick={() => setOpenCat(isOpen ? null : k)} className="w-full">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{label}</span>
                    <span className={`font-bold ${scoreColor(c.score)}`}>{c.score}/100</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${scoreBar(c.score)}`} style={{ width: `${c.score}%` }} />
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs">
                    <p className="text-zinc-300">{c.explanation}</p>
                    {c.supporting_evidence && <p className="text-emerald-400/80"><span className="font-semibold">Supporting evidence:</span> {c.supporting_evidence}</p>}
                    {c.missing_evidence && <p className="text-red-400/80"><span className="font-semibold">Missing evidence:</span> {c.missing_evidence}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------- Dashboard ----------------
function DashboardView({ data, setTab, startAnalysis }) {
  const score = data.latest_score
  const chairman = data.reports?.chairman
  const pending = (data.missions || []).filter((m) => m.status === 'pending')
  const validated = (data.claims || []).filter((c) => ['validated', 'partially_validated'].includes(c.status))
  const stage = data.startup?.stage
  const history = (data.score_history || []).map((s, i) => ({ n: i + 1, score: s.overall }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-grotesk)] text-2xl font-bold text-white">{data.startup?.name}</h2>
          <p className="mt-0.5 max-w-2xl text-sm text-zinc-500">{data.startup?.idea}</p>
        </div>
        {stage === 'interview' && <Button onClick={() => setTab('interview')} className="bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400">Continue Interview <ArrowRight className="ml-2 h-4 w-4" /></Button>}
        {stage === 'profile_ready' && !score && <Button onClick={() => startAnalysis(null)} className="bg-emerald-500 font-semibold text-zinc-950 hover:bg-emerald-400"><Users className="mr-2 h-4 w-4" /> Convene the AI Board</Button>}
        {score && (
          <Button onClick={() => openOnePager(data)} variant="outline" size="sm" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
            <Download className="mr-2 h-3.5 w-3.5" /> One-Pager
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className={`${glass} flex flex-col items-center justify-center p-6 text-center`}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Investor Readiness</div>
          {score ? (
            <>
              <div className={`mt-1 font-[family-name:var(--font-grotesk)] text-5xl font-bold ${scoreColor(score.overall)}`}>{score.overall}</div>
              <Pill cls={`mt-3 ${score.overall >= 75 ? STATUS_META.validated.cls : score.overall >= 50 ? STATUS_META.partially_validated.cls : STATUS_META.unproven.cls}`}>{score.readiness_status}</Pill>
            </>
          ) : <div className="mt-2 text-sm text-zinc-600">Not assessed yet</div>}
        </div>
        <div className={`${glass} p-5 lg:col-span-2`}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Score trajectory</div>
          {history.length > 1 ? (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 5, right: 5, bottom: 0, left: -30 }}>
                  <XAxis dataKey="n" hide /><YAxis domain={[0, 100]} stroke="#52525b" fontSize={10} />
                  <RTooltip contentStyle={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e4e4e7', fontSize: 12 }} />
                  <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="mt-6 text-center text-sm text-zinc-600">Submit evidence and re-assess to build score history.</p>}
        </div>
        <div className={`${glass} p-5`}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Recommended next action</div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{score?.next_action || (stage === 'interview' ? 'Complete the Founder Interview.' : stage === 'profile_ready' ? 'Convene the AI Board to challenge your claims.' : '—')}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${glass} p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-red-400">Critical risks</span>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          {chairman?.critical_risks?.length ? (
            <ul className="space-y-2">{chairman.critical_risks.slice(0, 4).map((r, i) => <li key={i} className="flex gap-2 text-sm text-zinc-300"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />{r}</li>)}</ul>
          ) : <p className="text-sm text-zinc-600">Run the board to surface risks.</p>}
        </div>
        <div className={`${glass} p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setTab('evidence')} className="text-[11px] font-semibold uppercase tracking-widest text-amber-400 hover:underline">Pending evidence missions ({pending.length})</button>
            <FlaskConical className="h-4 w-4 text-amber-400" />
          </div>
          {pending.length ? (
            <ul className="space-y-2">{pending.slice(0, 4).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm text-zinc-300">
                <span className="truncate">{m.title}</span><Pill cls={PRIORITY_STYLE[m.priority] || PRIORITY_STYLE.medium}>{m.priority}</Pill>
              </li>
            ))}</ul>
          ) : <p className="text-sm text-zinc-600">No open missions.</p>}
        </div>
        <div className={`${glass} p-5`}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">Recently validated claims</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          {validated.length ? (
            <ul className="space-y-2">{validated.slice(-4).reverse().map((c) => (
              <li key={c.id} className="flex gap-2 text-sm text-zinc-300"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /><span>{c.claim} <StatusPill status={c.status} /></span></li>
            ))}</ul>
          ) : <p className="text-sm text-zinc-600">Nothing validated yet. Prove it in the Evidence Lab.</p>}
        </div>
      </div>
    </div>
  )
}

// ---------------- App shell ----------------
const NAV = [
  { key: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { key: 'interview', label: 'Founder Interview', Icon: MessageSquare },
  { key: 'profile', label: 'Startup Profile', Icon: FileText },
  { key: 'board', label: 'AI Board', Icon: Users },
  { key: 'evidence', label: 'Evidence Lab', Icon: FlaskConical },
  { key: 'readiness', label: 'Investor Readiness', Icon: Gauge },
]

function App() {
  const [view, setView] = useState('landing')
  const [startups, setStartups] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState(null) // null | { agents, stages }
  const [notice, setNotice] = useState('')
  const [loadingData, setLoadingData] = useState(false)

  const loadStartups = useCallback(async () => {
    try {
      const d = await api('/startups')
      setStartups(d.startups || [])
      return d.startups || []
    } catch (e) { setError(e.message); return [] }
  }, [])

  const refresh = useCallback(async () => {
    if (!activeId) return
    try { setData(await api(`/startups/${activeId}`)) } catch (e) { setError(e.message) }
    loadStartups()
  }, [activeId, loadStartups])

  useEffect(() => { if (view === 'app') loadStartups() }, [view, loadStartups])
  useEffect(() => {
    if (!activeId) { setData(null); return }
    setLoadingData(true)
    api(`/startups/${activeId}`).then(setData).catch((e) => setError(e.message)).finally(() => setLoadingData(false))
  }, [activeId])

  const onCreated = (startup) => {
    setStartups((s) => [startup, ...s])
    setActiveId(startup.id)
    setCreating(false)
    setTab('interview')
  }

  const startAnalysis = (agents, stages) => setAnalysis({ agents, stages })

  if (view === 'landing') return <Landing onEnter={() => setView('app')} />

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/10 bg-zinc-950/95 p-4">
        <button onClick={() => setView('landing')} className="flex items-center gap-2 px-2 py-1">
          <Shield className="h-5 w-5 text-emerald-400" />
          <span className="font-[family-name:var(--font-grotesk)] text-lg font-bold text-white">YStart<span className="text-emerald-400">-AI</span></span>
        </button>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Startups</span>
            <button onClick={() => { setCreating(true); setActiveId(null) }} className="text-zinc-500 hover:text-emerald-400"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {startups.map((s) => (
              <button key={s.id} onClick={() => { setActiveId(s.id); setCreating(false); setTab('dashboard') }}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${activeId === s.id ? 'bg-emerald-500/10 text-emerald-300' : 'text-zinc-400 hover:bg-white/5'}`}>
                <span className="truncate">{s.name}</span>
                {s.latest_score && <span className={`text-xs font-bold ${scoreColor(s.latest_score.overall)}`}>{s.latest_score.overall}</span>}
              </button>
            ))}
            {!startups.length && <p className="px-2 text-xs text-zinc-600">No startups yet</p>}
          </div>
        </div>
        {activeId && data && (
          <nav className="mt-6 space-y-1">
            {NAV.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${tab === key ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>
                <Icon className="h-4 w-4" /> {label}
                {key === 'evidence' && (data.missions || []).filter((m) => m.status === 'pending').length > 0 && (
                  <span className="ml-auto rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold text-red-400">{(data.missions || []).filter((m) => m.status === 'pending').length}</span>
                )}
              </button>
            ))}
          </nav>
        )}
        <div className="mt-auto px-2 text-[10px] leading-relaxed text-zinc-700">
          Evidence-based readiness assessment. Not a guarantee of investment.
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1 p-6 lg:p-8">
        {notice && (
          <div data-testid="smart-notice" className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}</span>
            <button onClick={() => setNotice('')} className="text-emerald-400 hover:text-emerald-200"><XCircle className="h-4 w-4" /></button>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-200"><XCircle className="h-4 w-4" /></button>
          </div>
        )}
        {creating || (!activeId && !startups.length) ? (
          <CreateStartup onCreated={onCreated} busy={busy} setBusy={setBusy} setError={setError} />
        ) : !activeId ? (
          <div className="pt-20 text-center text-sm text-zinc-500">Select a startup from the sidebar or create a new one.</div>
        ) : loadingData || !data ? (
          <div className="flex items-center justify-center pt-32 text-zinc-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading war room...</div>
        ) : (
          <>
            {tab === 'dashboard' && <DashboardView data={data} setTab={setTab} startAnalysis={startAnalysis} />}
            {tab === 'interview' && <InterviewView data={data} refresh={refresh} setTab={setTab} setError={setError} />}
            {tab === 'profile' && <ProfileView data={data} refresh={refresh} setError={setError} startAnalysis={startAnalysis} />}
            {tab === 'board' && <BoardView data={data} startAnalysis={startAnalysis} />}
            {tab === 'evidence' && <EvidenceLab data={data} refresh={refresh} setError={setError} />}
            {tab === 'readiness' && <ReadinessView data={data} />}
          </>
        )}
      </main>

      {analysis && (
        <AnalysisRunner
          startupId={activeId}
          agents={analysis.agents}
          stages={analysis.stages}
          onDone={async () => {
            const smart = !!analysis.stages
            const which = analysis.agents?.length ? analysis.agents.join(', ') : null
            setAnalysis(null)
            await refresh()
            if (smart) setNotice(`Smart re-analysis complete — ${which ? `${which} agent(s)` : 'no specialist affected'} + Chairman re-scored after your profile edit.`)
            setTab(smart ? 'readiness' : 'board')
          }}
          onError={() => {}}
        />
      )}
    </div>
  )
}

export default App
