'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Lead, Communication, ActivityEntry, PipelineEvent } from '@/types'

const STATUS_OPTIONS = [
  '🔴 Not Contacted',
  '🟡 Called — No Answer',
  '🟠 Called — Interested',
  '🟢 Closed',
  '⚫ Dead',
]

type LogLine = { type: PipelineEvent['type']; message: string }
type Suggestion = { label: string; placeId: string }
type AppStage = 'idle' | 'discovering' | 'discovered' | 'building' | 'complete'

function approvedCount(comms: Communication[]): number {
  return comms.filter(c => c.approved).length
}

function CommPanel({
  lead,
  onUpdate,
}: {
  lead: Lead
  onUpdate: (leadId: string, commId: string, patch: Partial<Communication>) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries((lead.communications ?? []).map(c => [c.id, c.content]))
  )
  const isSms = (id: Communication['id']) => id !== 'cold-call' && id !== 'email-intro'
  const isEmail = (id: Communication['id']) => id === 'email-intro'
  const save = (comm: Communication) =>
    onUpdate(lead.id, comm.id, { content: drafts[comm.id] ?? comm.content })
  const toggleApprove = (comm: Communication) =>
    onUpdate(lead.id, comm.id, { content: drafts[comm.id] ?? comm.content, approved: !comm.approved })
  const toggleSent = (comm: Communication) =>
    onUpdate(lead.id, comm.id, {
      sent: !comm.sent,
      sentAt: !comm.sent ? new Date().toISOString() : undefined,
    })

  if (!lead.communications?.length) {
    return (
      <div className="px-6 py-4 text-sm text-gray-500 italic">
        No scripts yet — build this lead to generate them.
      </div>
    )
  }

  return (
    <div className="px-6 py-5 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-200">
          Outreach Scripts &mdash; {lead.business}
        </h3>
        <span className="text-xs text-gray-500">
          {approvedCount(lead.communications)}/{lead.communications.length} approved
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {lead.communications.map(comm => {
          const draft = drafts[comm.id] ?? comm.content
          const overLimit = isSms(comm.id) && draft.length > 160
          return (
            <div
              key={comm.id}
              className={`rounded-lg border p-4 flex flex-col gap-3 ${
                comm.approved ? 'border-green-700 bg-green-950/30' : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">{comm.label}</span>
                <div className="flex items-center gap-2">
                  {comm.sent && (
                  <span className="text-xs text-blue-400 font-medium">
                    Sent{comm.sentAt ? ` · ${new Date(comm.sentAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}
                  </span>
                )}
                  {comm.approved && <span className="text-xs text-green-400 font-medium">&#10003; Approved</span>}
                </div>
              </div>
              <textarea
                value={draft}
                onChange={e => setDrafts(prev => ({ ...prev, [comm.id]: e.target.value }))}
                onBlur={() => save(comm)}
                rows={comm.id === 'cold-call' ? 6 : 4}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-xs text-gray-200 resize-none focus:outline-none focus:border-blue-500"
              />
              {isSms(comm.id) && (
                <div className={`text-xs ${overLimit ? 'text-red-400' : 'text-gray-500'}`}>
                  {draft.length}/160 chars{overLimit ? ' — over SMS limit' : ''}
                </div>
              )}
              {isEmail(comm.id) && (
                <div className="text-xs text-gray-500">{draft.split(/\s+/).filter(Boolean).length} words</div>
              )}
              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => toggleApprove(comm)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    comm.approved ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {comm.approved ? '✓ Approved' : 'Approve'}
                </button>
                {comm.approved && (
                  <button
                    onClick={() => toggleSent(comm)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      comm.sent ? 'bg-blue-700 hover:bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    {comm.sent ? 'Sent ✓' : 'Mark Sent'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {approvedCount(lead.communications) < lead.communications.length && (
        <p className="text-xs text-yellow-600">
          Review and approve each script before contacting this business.
        </p>
      )}
    </div>
  )
}

const ACTIVITY_ICONS: Record<ActivityEntry['type'], string> = {
  call: '📞', text: '💬', email: '📧', meeting: '🤝', note: '📝',
}

function NotePanel({
  lead,
  onUpdateNotes,
  onAddActivity,
  onSetFollowUp,
}: {
  lead: Lead
  onUpdateNotes: (id: string, notes: string) => void
  onAddActivity: (id: string, entry: ActivityEntry) => void
  onSetFollowUp: (id: string, date: string | null) => void
}) {
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [activityText, setActivityText] = useState('')
  const [activityType, setActivityType] = useState<ActivityEntry['type']>('call')

  const logActivity = () => {
    if (!activityText.trim()) return
    const entry: ActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ts: new Date().toISOString(),
      type: activityType,
      text: activityText.trim(),
    }
    onAddActivity(lead.id, entry)
    setActivityText('')
  }

  const log = lead.activityLog ?? []

  return (
    <div className="px-6 py-5 border-t border-gray-800 space-y-5">
      {/* Follow-up date */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-400 w-28 shrink-0">Next follow-up</span>
        <input
          type="date"
          value={lead.followUpDate ?? ''}
          onChange={e => onSetFollowUp(lead.id, e.target.value || null)}
          className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
        />
        {lead.followUpDate && (
          <button onClick={() => onSetFollowUp(lead.id, null)} className="text-xs text-gray-500 hover:text-gray-300">Clear</button>
        )}
      </div>

      {/* Notes */}
      <div>
        <div className="text-xs font-semibold text-gray-400 mb-1.5">Notes</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => onUpdateNotes(lead.id, notes)}
          rows={3}
          placeholder="Anything worth remembering about this lead…"
          className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-xs text-gray-200 resize-none focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Activity log */}
      <div>
        <div className="text-xs font-semibold text-gray-400 mb-2">Activity log</div>
        {log.length > 0 && (
          <div className="mb-3 space-y-1.5 max-h-40 overflow-y-auto">
            {[...log].reverse().map(entry => (
              <div key={entry.id} className="flex items-start gap-2 text-xs">
                <span className="shrink-0 mt-0.5">{ACTIVITY_ICONS[entry.type]}</span>
                <span className="text-gray-300 flex-1">{entry.text}</span>
                <span className="text-gray-600 shrink-0 whitespace-nowrap">
                  {new Date(entry.ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <select
            value={activityType}
            onChange={e => setActivityType(e.target.value as ActivityEntry['type'])}
            className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-300 focus:outline-none"
          >
            <option value="call">📞 Call</option>
            <option value="text">💬 Text</option>
            <option value="email">📧 Email</option>
            <option value="meeting">🤝 Meeting</option>
            <option value="note">📝 Note</option>
          </select>
          <input
            value={activityText}
            onChange={e => setActivityText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && logActivity()}
            placeholder="What happened?"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={logActivity}
            disabled={!activityText.trim()}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded-md text-xs font-medium text-gray-200 transition-colors"
          >
            Log
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [city, setCity] = useState('')
  const [cities, setCities] = useState<string[]>([])  // multi-city tags (area mode)
  const [searchMode, setSearchMode] = useState<'area' | 'radius'>('area')
  const [radiusKm, setRadiusKm] = useState(5)
  const [selectedPlaceId, setSelectedPlaceId] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [locationError, setLocationError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const [showThumbnail, setShowThumbnail] = useState<Set<string>>(new Set())

  const [appStage, setAppStage] = useState<AppStage>('idle')
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [expandedLead, setExpandedLead] = useState<string | null>(null)

  const [discoverLog, setDiscoverLog] = useState<LogLine[]>([])
  const [buildLog, setBuildLog] = useState<LogLine[]>([])
  const [discoverLogCopied, setDiscoverLogCopied] = useState(false)
  const [buildLogCopied, setBuildLogCopied] = useState(false)
  const discoverLogRef = useRef<HTMLDivElement>(null)
  const buildLogRef = useRef<HTMLDivElement>(null)

  // Regenerate state: leadId → instructions text / building flag
  const [regenOpen, setRegenOpen] = useState<string | null>(null)
  const [regenText, setRegenText] = useState('')
  const [regenBuilding, setRegenBuilding] = useState<string | null>(null)

  // Normalise legacy leads that stored a raw Blob CDN URL as siteUrl.
  // Blob CDN serves HTML with Content-Disposition: attachment, causing downloads.
  const normalizeLead = (lead: Lead): Lead => {
    if (lead.siteUrl?.includes('blob.vercel-storage.com')) {
      return { ...lead, siteUrl: `/api/sites/${lead.id}` }
    }
    return lead
  }

  useEffect(() => {
    // 1. Restore from localStorage first (fast, synchronous)
    let localLeads: Lead[] = []
    try {
      const stored = localStorage.getItem('ai-agency-leads')
      if (stored) {
        const parsed = (JSON.parse(stored) as Lead[]).map(normalizeLead)
        if (parsed.length > 0) {
          localLeads = parsed
          setLeads(parsed)
          const anyBuilt = parsed.some(l => l.stage === 'built')
          const anyDiscovered = parsed.some(l => l.stage === 'discovered')
          if (anyBuilt) setAppStage('complete')
          else if (anyDiscovered) {
            setAppStage('discovered')
            setSelectedLeadIds(new Set(parsed.map(l => l.id)))
          }
        }
      }
    } catch {}

    // 2. Load from Firestore (authoritative) — covers closed tabs and cross-device access.
    //    Falls back to Blob-persisted results when Firestore is not configured.
    const loadRemote = async () => {
      try {
        const res = await fetch('/api/leads')
        if (!res.ok) throw new Error('leads API failed')
        const remote: Lead[] = (await res.json() as Lead[]).map(normalizeLead)
        if (remote.length > 0) {
          setLeads(prev => {
            const map = new Map(prev.map(l => [l.id, l]))
            for (const rl of remote) {
              const existing = map.get(rl.id)
              if (!existing || rl.stage === 'built') map.set(rl.id, rl)
            }
            return Array.from(map.values())
          })
          setAppStage(prev => (prev === 'idle' ? 'complete' : prev))
          return
        }
      } catch {}
      // Fallback to Blob when Firestore not configured
      try {
        const res = await fetch('/api/leads/saved')
        if (!res.ok) return
        const { leads: saved }: { leads: Lead[] } = await res.json()
        if (!saved?.length) return
        setLeads(prev => {
          const map = new Map(prev.map(l => [l.id, l]))
          for (const sl of saved.map(normalizeLead)) {
            const existing = map.get(sl.id)
            if (!existing || sl.stage === 'built') map.set(sl.id, sl)
          }
          return Array.from(map.values())
        })
        setAppStage(prev => (prev === 'idle' ? 'complete' : prev))
      } catch {}
    }
    loadRemote()
  }, [])

  useEffect(() => {
    if (leads.length > 0) localStorage.setItem('ai-agency-leads', JSON.stringify(leads))
  }, [leads])

  useEffect(() => {
    if (discoverLogRef.current) discoverLogRef.current.scrollTop = discoverLogRef.current.scrollHeight
  }, [discoverLog])

  useEffect(() => {
    if (buildLogRef.current) buildLogRef.current.scrollTop = buildLogRef.current.scrollHeight
  }, [buildLog])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target as Node))
        setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    try {
      const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(value)}`)
      const data = await res.json()
      const s: Suggestion[] = data.suggestions ?? []
      setSuggestions(s)
      setShowSuggestions(s.length > 0)
    } catch {}
  }, [])

  const handleCityChange = (value: string) => {
    setCity(value)
    setSelectedPlaceId('')
    setLocationError('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300)
  }

  const selectSuggestion = (s: Suggestion) => {
    setCity(s.label)
    setSelectedPlaceId(s.placeId)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const logColor = (type: LogLine['type']) => {
    switch (type) {
      case 'error': return 'text-red-400'
      case 'skip': return 'text-gray-500'
      case 'lead': case 'lead_discovered': return 'text-yellow-400'
      case 'lead_complete': return 'text-green-400'
      case 'done': return 'text-blue-400 font-semibold'
      default: return 'text-gray-300'
    }
  }

  const logPrefix = (type: LogLine['type']) => {
    switch (type) {
      case 'skip': return '↷'
      case 'lead': case 'lead_discovered': return '◆'
      case 'lead_complete': return '✓'
      case 'error': return '✗'
      case 'done': return '★'
      default: return '›'
    }
  }

  const copyLog = async (log: LogLine[], setCopied: (v: boolean) => void) => {
    const text = log.map(e => `${logPrefix(e.type)} ${e.message}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const readStream = async (
    url: string,
    body: object,
    onEvent: (event: PipelineEvent) => void,
    onDone: () => void,
    addLog: (line: LogLine) => void,
  ) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.body) throw new Error('No response body')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6)) as PipelineEvent
          addLog({ type: event.type, message: event.message })
          onEvent(event)
        } catch {}
      }
    }
    onDone()
  }

  const addCityTag = () => {
    const trimmed = city.trim()
    if (trimmed.length >= 2 && !cities.includes(trimmed)) {
      setCities(prev => [...prev, trimmed])
    }
    setCity('')
    setSelectedPlaceId('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const runDiscover = async () => {
    // In area mode: use tags list if populated, else fall back to current input
    const allCities = searchMode === 'area' && cities.length > 0
      ? cities
      : city.trim() ? [city.trim()] : []

    if (allCities.length === 0) { setLocationError('Please enter a city, suburb or neighbourhood'); return }
    if (allCities.some(c => c.length < 2)) { setLocationError('City names must be at least 2 characters'); return }

    setAppStage('discovering')
    setDiscoverLog([])
    setBuildLog([])
    setLeads([])
    setSelectedLeadIds(new Set())
    setExpandedLead(null)
    setLocationError('')
    setShowSuggestions(false)
    localStorage.removeItem('ai-agency-leads')
    fetch('/api/leads/saved', { method: 'DELETE' }).catch(() => {})
    try {
      await readStream(
        '/api/pipeline/discover',
        { cities: allCities, searchMode, radiusKm, placeId: selectedPlaceId || undefined },
        (event) => {
          if (event.type === 'lead_discovered') {
            setLeads(prev => [...prev, event.lead])
            setSelectedLeadIds(prev => new Set(Array.from(prev).concat(event.lead.id)))
          }
        },
        () => setAppStage('discovered'),
        (line) => setDiscoverLog(prev => [...prev, line]),
      )
    } catch (err) {
      setDiscoverLog(prev => [...prev, { type: 'error', message: String(err) }])
      setAppStage('idle')
    }
  }

  const runBuild = async () => {
    const ids = Array.from(selectedLeadIds)
    if (ids.length === 0) return
    // Pass full lead data so the build route doesn't rely on /tmp surviving
    // across separate Vercel serverless invocations.
    const selectedLeads = leads.filter(l => ids.includes(l.id))
    setAppStage('building')
    setBuildLog([])
    setExpandedLead(null)
    try {
      await readStream(
        '/api/pipeline/build',
        { leadIds: ids, leads: selectedLeads },
        (event) => {
          if (event.type === 'lead_complete') {
            setLeads(prev => prev.map(l => l.id === event.lead.id ? event.lead : l))
          }
        },
        () => setAppStage('complete'),
        (line) => setBuildLog(prev => [...prev, line]),
      )
    } catch (err) {
      setBuildLog(prev => [...prev, { type: 'error', message: String(err) }])
      setAppStage('discovered')
    }
  }

  const patchLead = (body: object) =>
    fetch('/api/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const updateStatus = (id: string, status: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    patchLead({ id, status })
  }

  const updateNotes = (id: string, notes: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l))
    patchLead({ id, notes })
  }

  const setFollowUp = (id: string, followUpDate: string | null) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, followUpDate: followUpDate ?? undefined } : l))
    patchLead({ id, followUpDate })
  }

  const addActivity = (id: string, entry: ActivityEntry) => {
    setLeads(prev => prev.map(l => l.id === id
      ? { ...l, activityLog: [...(l.activityLog ?? []), entry] }
      : l,
    ))
    patchLead({ id, activityEntry: entry })
  }

  const shareUrl = (lead: Lead) => {
    const base = `${typeof window !== 'undefined' ? window.location.origin : ''}${lead.siteUrl ?? ''}`
    return lead.shareToken ? `${base}?token=${lead.shareToken}` : base
  }

  const copyAllShareLinks = async () => {
    const built = leads.filter(l => l.stage === 'built' && l.siteUrl)
    const text = built.map(l => `${l.business}: ${shareUrl(l)}`).join('\n')
    await navigator.clipboard.writeText(text).catch(() => {})
  }

  const exportCSV = () => {
    const headers = ['Business', 'Type', 'Phone', 'Address', 'Rating', 'Reviews', 'Status', 'Site URL', 'Best Call Time', 'Follow-Up Date', 'Notes']
    const rows = leads.filter(l => l.stage === 'built').map(l => [
      l.business, l.type, l.phone, l.address, l.rating, l.reviews,
      l.status, l.siteUrl ? shareUrl(l) : '',
      l.bestCallTime, l.followUpDate ?? '', l.notes ?? '',
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const updateComm = (leadId: string, commId: string, patch: Partial<Communication>) => {
    setLeads(prev =>
      prev.map(l =>
        l.id !== leadId ? l : {
          ...l,
          communications: l.communications.map(c => c.id === commId ? { ...c, ...patch } : c),
        },
      ),
    )
    patchLead({ id: leadId, commId, ...patch })
  }

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const isRunning = appStage === 'discovering' || appStage === 'building'
  const builtLeads = leads.filter(l => l.stage === 'built')
  const unbuiltLeads = leads.filter(l => l.stage === 'discovered')

  const runBuildRemaining = async () => {
    const ids = unbuiltLeads.map(l => l.id)
    if (ids.length === 0) return
    setAppStage('building')
    setBuildLog([])
    setExpandedLead(null)
    try {
      await readStream(
        '/api/pipeline/build',
        { leadIds: ids, leads: unbuiltLeads },
        (event) => {
          if (event.type === 'lead_complete') {
            setLeads(prev => prev.map(l => l.id === event.lead.id ? event.lead : l))
          }
        },
        () => setAppStage('complete'),
        (line) => setBuildLog(prev => [...prev, line]),
      )
    } catch (err) {
      setBuildLog(prev => [...prev, { type: 'error', message: String(err) }])
      setAppStage('complete')
    }
  }

  const runRegen = async (lead: Lead) => {
    setRegenBuilding(lead.id)
    setRegenOpen(null)
    setBuildLog([])
    try {
      await readStream(
        '/api/pipeline/build',
        { leadIds: [lead.id], leads: [lead], extraInstructions: regenText.trim() },
        (event) => {
          if (event.type === 'lead_complete') {
            setLeads(prev => prev.map(l => l.id === event.lead.id ? event.lead : l))
          }
        },
        () => setRegenBuilding(null),
        (line) => setBuildLog(prev => [...prev, line]),
      )
    } catch (err) {
      setBuildLog(prev => [...prev, { type: 'error', message: String(err) }])
      setRegenBuilding(null)
    }
    setRegenText('')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Web Agency</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Find businesses &rarr; Build sites &rarr; Get paid
            </p>
          </div>
          {leads.length > 0 && (
            <div className="text-sm text-gray-500">
              {leads.length} lead{leads.length !== 1 ? 's' : ''} found
              {builtLeads.length > 0 && ` · ${builtLeads.length} built`}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Phase 1 – Search */}
        <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold">Phase 1 &mdash; Discover</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Finds businesses with no real website. Fast &mdash; no AI, just Google Maps.
              </p>
            </div>
            {appStage !== 'idle' && (
              <button
                onClick={() => {
                  setAppStage('idle')
                  setLeads([])
                  setCities([])
                  setDiscoverLog([])
                  setBuildLog([])
                  localStorage.removeItem('ai-agency-leads')
                }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0"
              >
                Start over
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 mr-1">Search by</span>
            {(['area', 'radius'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setSearchMode(mode)}
                disabled={isRunning}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                  searchMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {mode === 'area' ? 'Area name' : 'Radius'}
              </button>
            ))}
          </div>

          {searchMode === 'radius' && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-gray-500 w-14 shrink-0">Radius</span>
              <input
                type="range" min={1} max={50} value={radiusKm}
                onChange={e => setRadiusKm(Number(e.target.value))}
                disabled={isRunning}
                className="flex-1 accent-blue-500 disabled:opacity-50"
              />
              <span className="text-xs text-gray-300 w-16 text-right shrink-0">{radiusKm} km</span>
            </div>
          )}

          {/* City tags (area mode multi-city) */}
          {searchMode === 'area' && cities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {cities.map(c => (
                <span key={c} className="flex items-center gap-1 bg-blue-900/40 border border-blue-700/60 rounded-full px-2.5 py-1 text-xs text-blue-200">
                  {c}
                  <button
                    onClick={() => setCities(prev => prev.filter(x => x !== c))}
                    className="text-blue-400 hover:text-white transition-colors ml-0.5 leading-none"
                    aria-label={`Remove ${c}`}
                  >×</button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 flex gap-2">
              <div ref={inputWrapRef} className="flex-1 relative">
                <input
                  type="text"
                  value={city}
                  onChange={e => handleCityChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      setShowSuggestions(false)
                      if (searchMode === 'area' && cities.length > 0 && city.trim().length >= 2) {
                        addCityTag()
                      } else {
                        runDiscover()
                      }
                    }
                    if (e.key === 'Escape') setShowSuggestions(false)
                  }}
                  placeholder={
                    searchMode === 'radius'
                      ? 'e.g. Santa Monica — pick from dropdown to pin radius'
                      : cities.length > 0
                      ? 'Add another city…'
                      : 'e.g. Santa Monica, CA'
                  }
                  disabled={isRunning}
                  className={`w-full bg-gray-800 rounded-lg px-4 py-3 placeholder-gray-500 border focus:outline-none disabled:opacity-50 text-sm transition-colors ${
                    locationError ? 'border-red-500' : 'border-gray-700 focus:border-blue-500'
                  }`}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-20 overflow-hidden">
                    {suggestions.map(s => (
                      <button
                        key={s.placeId}
                        onMouseDown={() => selectSuggestion(s)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* "+ Add city" button — area mode only */}
              {searchMode === 'area' && (
                <button
                  onClick={addCityTag}
                  disabled={isRunning || city.trim().length < 2}
                  title="Add another city to search"
                  className="px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded-lg text-sm font-bold transition-colors"
                >
                  +
                </button>
              )}
            </div>
            <button
              onClick={runDiscover}
              disabled={isRunning || (cities.length === 0 && !city.trim())}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
            >
              {appStage === 'discovering' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" />
                  Scanning&hellip;
                </span>
              ) : 'Discover Leads'}
            </button>
          </div>

          {locationError && <p className="mt-2 text-xs text-red-400">{locationError}</p>}
          {searchMode === 'radius' && !selectedPlaceId && city.length > 1 && !locationError && (
            <p className="mt-2 text-xs text-yellow-600">Select a suggestion to lock the radius to an exact point.</p>
          )}
          {searchMode === 'radius' && selectedPlaceId && (
            <p className="mt-2 text-xs text-green-600">
              Location pinned &mdash; will search within {radiusKm} km of {city}.
            </p>
          )}
        </section>

        {/* Discovery log */}
        {discoverLog.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${appStage === 'discovering' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm font-medium text-gray-300">Discovery Log</span>
              <button
                onClick={() => copyLog(discoverLog, setDiscoverLogCopied)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              >
                {discoverLogCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div ref={discoverLogRef} className="p-4 h-40 overflow-y-auto font-mono text-xs space-y-1">
              {discoverLog.map((entry, i) => (
                <div key={i} className={logColor(entry.type)}>
                  {logPrefix(entry.type)} {entry.message}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Phase 2 – Review/select/build/dashboard */}
        {(appStage === 'discovered' || appStage === 'building' || appStage === 'complete') && leads.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">
                  {appStage === 'complete' ? 'Phase 3 — Lead Dashboard' : 'Phase 2 — Review & Select'}
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {appStage === 'complete' && unbuiltLeads.length === 0
                    ? 'Review and approve all scripts before contacting any business.'
                    : appStage === 'complete' && unbuiltLeads.length > 0
                    ? `${builtLeads.length} built · ${unbuiltLeads.length} not yet built`
                    : `${leads.length} lead${leads.length !== 1 ? 's' : ''} found. Tick the ones to build, then click Build Sites.`}
                </p>
              </div>
              {appStage === 'discovered' && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex gap-1 text-xs">
                    <button
                      onClick={() => setSelectedLeadIds(new Set(leads.map(l => l.id)))}
                      className="text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-gray-800"
                    >All</button>
                    <button
                      onClick={() => setSelectedLeadIds(new Set())}
                      className="text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded hover:bg-gray-800"
                    >None</button>
                  </div>
                  <button
                    onClick={runBuild}
                    disabled={selectedLeadIds.size === 0}
                    className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
                  >
                    Build {selectedLeadIds.size > 0 ? `${selectedLeadIds.size} ` : ''}Site{selectedLeadIds.size !== 1 ? 's' : ''}
                  </button>
                </div>
              )}
              {appStage === 'building' && (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="flex items-center gap-2 text-sm text-gray-400">
                    <span className="w-3 h-3 rounded-full border-2 border-green-400 border-t-transparent animate-spin" />
                    Building&hellip;
                  </span>
                  <span className="text-xs text-green-700">Safe to close tab — results will be here when you return</span>
                </div>
              )}
              {appStage === 'complete' && unbuiltLeads.length > 0 && (
                <button
                  onClick={runBuildRemaining}
                  className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 rounded-lg font-medium text-sm transition-colors whitespace-nowrap shrink-0"
                >
                  Build remaining {unbuiltLeads.length}
                </button>
              )}
              {builtLeads.length > 0 && (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={copyAllShareLinks}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium text-gray-300 transition-colors whitespace-nowrap"
                  >
                    ⎘ Copy all links
                  </button>
                  <button
                    onClick={exportCSV}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-medium text-gray-300 transition-colors whitespace-nowrap"
                  >
                    ↓ Export CSV
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs text-gray-400 uppercase tracking-wide">
                    {appStage === 'discovered' && <th className="px-4 py-3 font-medium w-10"></th>}
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Business</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium">Best Call Time</th>
                    {appStage !== 'discovered' && (
                      <>
                        <th className="px-4 py-3 font-medium">Site</th>
                        <th className="px-4 py-3 font-medium">Scripts</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const isExpanded = expandedLead === lead.id
                    const comms = lead.communications ?? []
                    const approved = approvedCount(comms)
                    const allApproved = comms.length > 0 && approved === comms.length
                    const sentCount = comms.filter(c => c.sent).length
                    const isSelected = selectedLeadIds.has(lead.id)
                    const isBuilt = lead.stage === 'built'

                    return (
                      <>
                        <tr
                          key={lead.id}
                          className={`border-b border-gray-800/50 transition-colors ${
                            appStage === 'building' && isSelected && !isBuilt
                              ? 'bg-yellow-950/20'
                              : 'hover:bg-gray-800/20'
                          }`}
                        >
                          {appStage === 'discovered' && (
                            <td className="px-4 py-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectLead(lead.id)}
                                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="px-4 py-4 text-gray-500 text-xs">{i + 1}</td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-sm">{lead.business}</div>
                            <div className="text-gray-500 text-xs mt-0.5">{lead.address}</div>
                            <div className="text-gray-600 text-xs mt-0.5 italic">{lead.hook}</div>
                            {lead.followUpDate && (() => {
                              const d = new Date(lead.followUpDate)
                              const today = new Date(); today.setHours(0,0,0,0)
                              const isPast = d < today
                              const isToday = d.toDateString() === today.toDateString()
                              return (
                                <div className={`text-xs mt-1 font-medium ${isPast ? 'text-red-400' : isToday ? 'text-yellow-400' : 'text-blue-400'}`}>
                                  {isPast ? '⚠ Follow-up overdue' : isToday ? '📅 Follow up today' : `📅 ${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`}
                                </div>
                              )
                            })()}
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-xs">{lead.type}</td>
                          <td className="px-4 py-4">
                            <a href={`tel:${lead.phone.replace(/\D/g, '')}`} className="text-blue-400 hover:text-blue-300 text-sm">
                              {lead.phone}
                            </a>
                          </td>
                          <td className="px-4 py-4 text-sm whitespace-nowrap">
                            <span className="text-yellow-400">&#9733;</span>{' '}
                            <span>{lead.rating}</span>
                            <span className="text-gray-500 text-xs ml-1">({lead.reviews})</span>
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-xs whitespace-nowrap">{lead.bestCallTime}</td>
                          {appStage !== 'discovered' && (
                            <>
                              <td className="px-4 py-4">
                                {regenBuilding === lead.id ? (
                                  <span className="flex items-center gap-1.5 text-xs text-yellow-400">
                                    <span className="w-2.5 h-2.5 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
                                    Regenerating&hellip;
                                  </span>
                                ) : isBuilt && lead.siteUrl ? (
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                      <a href={shareUrl(lead)} target="_blank" rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 underline text-sm whitespace-nowrap">
                                        View Site &rarr;
                                      </a>
                                      {lead.siteScore !== undefined && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold ${
                                          lead.siteScore >= 85 ? 'text-green-300 bg-green-950 border border-green-800' :
                                          lead.siteScore >= 65 ? 'text-yellow-300 bg-yellow-950 border border-yellow-800' :
                                          'text-red-300 bg-red-950 border border-red-800'
                                        }`} title={`Site quality score: ${lead.siteScore}/100`}>
                                          {lead.siteScore}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(shareUrl(lead)).catch(() => {})}
                                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
                                    >
                                      ⎘ Copy share link
                                    </button>
                                    <button
                                      onClick={() => setShowThumbnail(prev => {
                                        const next = new Set(prev)
                                        if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id)
                                        return next
                                      })}
                                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
                                    >
                                      {showThumbnail.has(lead.id) ? 'Hide preview' : '⬜ Preview'}
                                    </button>
                                    {showThumbnail.has(lead.id) && (
                                      <div className="mt-1 rounded-md overflow-hidden border border-gray-700" style={{ width: 200, height: 130, position: 'relative' }}>
                                        <iframe
                                          src={shareUrl(lead)}
                                          title={`Preview of ${lead.business}`}
                                          style={{ width: 1024, height: 667, transform: 'scale(0.195)', transformOrigin: 'top left', pointerEvents: 'none', border: 'none' }}
                                        />
                                      </div>
                                    )}
                                    <button
                                      onClick={() => { setRegenOpen(regenOpen === lead.id ? null : lead.id); setRegenText('') }}
                                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
                                    >
                                      {regenOpen === lead.id ? 'Cancel' : '↺ Regenerate'}
                                    </button>
                                    {regenOpen === lead.id && (
                                      <div className="flex flex-col gap-1.5 mt-1 min-w-[220px]">
                                        <textarea
                                          value={regenText}
                                          onChange={e => setRegenText(e.target.value)}
                                          placeholder="Instructions (optional): e.g. darker theme, add a specials section, more formal tone…"
                                          rows={3}
                                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 resize-none focus:outline-none focus:border-yellow-500"
                                        />
                                        <button
                                          onClick={() => runRegen(lead)}
                                          className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 rounded text-xs font-medium text-white transition-colors"
                                        >
                                          Rebuild Site
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : isSelected ? (
                                  <span className="text-xs text-gray-500 italic">Building&hellip;</span>
                                ) : (
                                  <span className="text-xs text-gray-600">&mdash;</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {isBuilt ? (
                                  <div className="flex flex-col items-start gap-1">
                                    <button
                                      onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                                        allApproved
                                          ? 'bg-green-800/50 text-green-300 border border-green-700'
                                          : isExpanded ? 'bg-blue-700 text-white'
                                          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                      }`}
                                    >
                                      {allApproved ? '✓ All Approved' : `Scripts ${approved}/${comms.length}`}
                                    </button>
                                    {sentCount > 0 && (
                                      <span className="text-xs text-blue-500">{sentCount}/{comms.length} sent</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-600">&mdash;</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {isBuilt ? (
                                  <select
                                    value={lead.status}
                                    onChange={e => updateStatus(lead.id, e.target.value)}
                                    className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                                  >
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                ) : (
                                  <span className="text-xs text-gray-600">&mdash;</span>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                        {isExpanded && isBuilt && (
                          <tr key={`${lead.id}-expanded`} className="border-b border-gray-700 bg-gray-900/60">
                            <td colSpan={10} className="p-0">
                              <CommPanel lead={lead} onUpdate={updateComm} />
                              <NotePanel
                                lead={lead}
                                onUpdateNotes={updateNotes}
                                onAddActivity={addActivity}
                                onSetFollowUp={setFollowUp}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Build log */}
        {buildLog.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${appStage === 'building' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm font-medium text-gray-300">Build Log</span>
              <button
                onClick={() => copyLog(buildLog, setBuildLogCopied)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800"
              >
                {buildLogCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div ref={buildLogRef} className="p-4 h-40 overflow-y-auto font-mono text-xs space-y-1">
              {buildLog.map((entry, i) => (
                <div key={i} className={logColor(entry.type)}>
                  {logPrefix(entry.type)} {entry.message}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {appStage === 'idle' && (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg font-medium">Enter a city above to start</p>
            <p className="text-sm mt-2 max-w-md mx-auto">
              Discovery is fast &mdash; no AI, just Google Maps filtering. You choose which leads
              to build sites for before Claude is called.
            </p>
            <div className="mt-8 grid grid-cols-4 gap-4 max-w-2xl mx-auto text-left">
              {[
                { n: '1', label: 'Discover', desc: 'Google Maps → filter no-website businesses' },
                { n: '2', label: 'You Select', desc: 'Tick the leads worth pursuing' },
                { n: '3', label: 'Build', desc: 'Claude builds a site + scripts per lead' },
                { n: '4', label: 'You Approve', desc: 'Review, edit, authorize — then contact' },
              ].map(step => (
                <div key={step.n} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className="text-blue-500 text-xs font-bold mb-1">Phase {step.n}</div>
                  <div className="text-gray-200 text-sm font-medium">{step.label}</div>
                  <div className="text-gray-500 text-xs mt-1">{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
