'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Lead, Communication, PipelineEvent } from '@/types'

const STATUS_OPTIONS = [
  '🔴 Not Contacted',
  '🟡 Called — No Answer',
  '🟠 Called — Interested',
  '🟢 Closed',
  '⚫ Dead',
]

type LogLine = { type: PipelineEvent['type']; message: string }
type Suggestion = { label: string; placeId: string }

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

  const isSms = (id: Communication['id']) => id !== 'cold-call'

  const save = (comm: Communication) => {
    const content = drafts[comm.id] ?? comm.content
    onUpdate(lead.id, comm.id, { content })
  }

  const toggleApprove = (comm: Communication) => {
    const content = drafts[comm.id] ?? comm.content
    onUpdate(lead.id, comm.id, { content, approved: !comm.approved })
  }

  const toggleSent = (comm: Communication) => {
    onUpdate(lead.id, comm.id, { sent: !comm.sent })
  }

  if (!lead.communications?.length) {
    return (
      <div className="px-6 py-4 text-sm text-gray-500 italic">
        No communications generated for this lead.
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
          const charCount = draft.length
          const overLimit = isSms(comm.id) && charCount > 160

          return (
            <div
              key={comm.id}
              className={`rounded-lg border p-4 flex flex-col gap-3 ${
                comm.approved
                  ? 'border-green-700 bg-green-950/30'
                  : 'border-gray-700 bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">{comm.label}</span>
                <div className="flex items-center gap-2">
                  {comm.sent && (
                    <span className="text-xs text-blue-400 font-medium">Sent</span>
                  )}
                  {comm.approved && (
                    <span className="text-xs text-green-400 font-medium">&#10003; Approved</span>
                  )}
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
                  {charCount}/160 chars{overLimit ? ' — over SMS limit' : ''}
                </div>
              )}

              <div className="flex gap-2 mt-auto">
                <button
                  onClick={() => toggleApprove(comm)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    comm.approved
                      ? 'bg-green-700 hover:bg-green-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {comm.approved ? '&#10003; Approved' : 'Approve'}
                </button>
                {comm.approved && (
                  <button
                    onClick={() => toggleSent(comm)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      comm.sent
                        ? 'bg-blue-700 hover:bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    }`}
                  >
                    {comm.sent ? 'Sent &#10003;' : 'Mark Sent'}
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

export default function Home() {
  const [city, setCity] = useState('')
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // Search mode + radius
  const [searchMode, setSearchMode] = useState<'area' | 'radius'>('area')
  const [radiusKm, setRadiusKm] = useState(5)
  const [selectedPlaceId, setSelectedPlaceId] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [locationError, setLocationError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputWrapRef = useRef<HTMLDivElement>(null)

  // Restore leads from localStorage on mount (survives page reloads)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ai-agency-leads')
      if (stored) setLeads(JSON.parse(stored))
    } catch {}
  }, [])

  // Persist leads to localStorage whenever they change
  useEffect(() => {
    if (leads.length > 0) {
      localStorage.setItem('ai-agency-leads', JSON.stringify(leads))
    }
  }, [leads])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputWrapRef.current && !inputWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
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

  const runPipeline = async () => {
    if (!city.trim() || running) return
    if (city.trim().length < 3) {
      setLocationError('Please enter a city, suburb or neighbourhood')
      return
    }

    setRunning(true)
    setLog([])
    setLeads([])
    setExpandedLead(null)
    setLocationError('')
    setShowSuggestions(false)
    localStorage.removeItem('ai-agency-leads')

    try {
      const response = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: city.trim(),
          searchMode,
          radiusKm,
          placeId: selectedPlaceId || undefined,
        }),
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
            setLog(prev => [...prev, { type: event.type, message: event.message }])
            if (event.type === 'lead_complete') {
              setLeads(prev => [...prev, event.lead])
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      setLog(prev => [...prev, { type: 'error', message: String(err) }])
    } finally {
      setRunning(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status } : l)))
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
  }

  const updateComm = async (
    leadId: string,
    commId: string,
    patch: Partial<Communication>,
  ) => {
    setLeads(prev =>
      prev.map(l =>
        l.id !== leadId
          ? l
          : {
              ...l,
              communications: l.communications.map(c =>
                c.id === commId ? { ...c, ...patch } : c,
              ),
            },
      ),
    )
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, commId, ...patch }),
    })
  }

  const logColor = (type: LogLine['type']) => {
    switch (type) {
      case 'error': return 'text-red-400'
      case 'skip': return 'text-gray-500'
      case 'lead': return 'text-yellow-400'
      case 'lead_complete': return 'text-green-400'
      case 'done': return 'text-blue-400 font-semibold'
      default: return 'text-gray-300'
    }
  }

  const logPrefix = (type: LogLine['type']) => {
    switch (type) {
      case 'skip': return '↷'
      case 'lead': return '◆'
      case 'lead_complete': return '✓'
      case 'error': return '✗'
      case 'done': return '★'
      default: return '›'
    }
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
              {leads.length} lead{leads.length !== 1 ? 's' : ''} in dashboard
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Pipeline runner */}
        <section className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="text-base font-semibold mb-1">Run Pipeline</h2>
          <p className="text-sm text-gray-400 mb-4">
            Enter a city, suburb or neighbourhood. The pipeline finds qualified leads, builds a
            website for each one, writes personalized call scripts, and populates the dashboard.
          </p>

          {/* Search mode toggle */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 mr-1">Search by</span>
            <button
              onClick={() => setSearchMode('area')}
              disabled={running}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                searchMode === 'area'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Area name
            </button>
            <button
              onClick={() => setSearchMode('radius')}
              disabled={running}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
                searchMode === 'radius'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Radius
            </button>
          </div>

          {/* Radius slider — shown only in radius mode */}
          {searchMode === 'radius' && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-gray-500 w-14 shrink-0">Radius</span>
              <input
                type="range"
                min={1}
                max={50}
                value={radiusKm}
                onChange={e => setRadiusKm(Number(e.target.value))}
                disabled={running}
                className="flex-1 accent-blue-500 disabled:opacity-50"
              />
              <span className="text-xs text-gray-300 w-16 text-right shrink-0">
                {radiusKm} km
              </span>
            </div>
          )}

          {/* Location input with autocomplete + run button */}
          <div className="flex gap-3">
            <div ref={inputWrapRef} className="flex-1 relative">
              <input
                type="text"
                value={city}
                onChange={e => handleCityChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { setShowSuggestions(false); runPipeline() }
                  if (e.key === 'Escape') setShowSuggestions(false)
                }}
                placeholder={
                  searchMode === 'radius'
                    ? 'e.g. Santa Monica — pick from dropdown to pin radius'
                    : 'e.g. Santa Monica, CA'
                }
                disabled={running}
                className={`w-full bg-gray-800 rounded-lg px-4 py-3 placeholder-gray-500 border focus:outline-none disabled:opacity-50 text-sm transition-colors ${
                  locationError
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-gray-700 focus:border-blue-500'
                }`}
              />

              {/* Autocomplete suggestions dropdown */}
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

            <button
              onClick={runPipeline}
              disabled={running || !city.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
            >
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" />
                  Running&hellip;
                </span>
              ) : (
                'Run Pipeline'
              )}
            </button>
          </div>

          {locationError && (
            <p className="mt-2 text-xs text-red-400">{locationError}</p>
          )}
          {searchMode === 'radius' && !selectedPlaceId && city.length > 1 && !locationError && (
            <p className="mt-2 text-xs text-yellow-600">
              Select a suggestion from the list to lock the radius to an exact point.
            </p>
          )}
          {searchMode === 'radius' && selectedPlaceId && (
            <p className="mt-2 text-xs text-green-600">
              Location pinned &mdash; will search within {radiusKm} km of {city}.
            </p>
          )}
        </section>

        {/* Pipeline log */}
        {log.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${running ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-sm font-medium text-gray-300">Pipeline Log</span>
            </div>
            <div ref={logRef} className="p-4 h-52 overflow-y-auto font-mono text-xs space-y-1">
              {log.map((entry, i) => (
                <div key={i} className={logColor(entry.type)}>
                  {logPrefix(entry.type)} {entry.message}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Lead dashboard */}
        {leads.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-base font-semibold">Lead Dashboard</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Review and approve all scripts before contacting any business.
                Click <strong className="text-gray-300">Scripts</strong> on any row to edit.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-xs text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Business</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium">Site</th>
                    <th className="px-4 py-3 font-medium">Best Call Time</th>
                    <th className="px-4 py-3 font-medium">Scripts</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const isExpanded = expandedLead === lead.id
                    const comms = lead.communications ?? []
                    const approved = approvedCount(comms)
                    const allApproved = comms.length > 0 && approved === comms.length

                    return (
                      <>
                        <tr
                          key={lead.id}
                          className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors"
                        >
                          <td className="px-4 py-4 text-gray-500 text-xs">{i + 1}</td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-sm">{lead.business}</div>
                            <div className="text-gray-500 text-xs mt-0.5">{lead.address}</div>
                            <div className="text-gray-600 text-xs mt-0.5 italic">{lead.hook}</div>
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-xs">{lead.type}</td>
                          <td className="px-4 py-4">
                            <a
                              href={`tel:${lead.phone.replace(/\D/g, '')}`}
                              className="text-blue-400 hover:text-blue-300 text-sm"
                            >
                              {lead.phone}
                            </a>
                          </td>
                          <td className="px-4 py-4 text-sm whitespace-nowrap">
                            <span className="text-yellow-400">&#9733;</span>{' '}
                            <span>{lead.rating}</span>
                            <span className="text-gray-500 text-xs ml-1">({lead.reviews})</span>
                          </td>
                          <td className="px-4 py-4">
                            <a
                              href={lead.siteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 underline text-sm whitespace-nowrap"
                            >
                              View Site &rarr;
                            </a>
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-xs whitespace-nowrap">
                            {lead.bestCallTime}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                                allApproved
                                  ? 'bg-green-800/50 text-green-300 border border-green-700'
                                  : isExpanded
                                  ? 'bg-blue-700 text-white'
                                  : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                              }`}
                            >
                              {allApproved ? '✓ All Approved' : `Scripts ${approved}/${comms.length}`}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <select
                              value={lead.status}
                              onChange={e => updateStatus(lead.id, e.target.value)}
                              className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                            >
                              {STATUS_OPTIONS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                        </tr>

                        {/* Expandable communications panel */}
                        {isExpanded && (
                          <tr key={`${lead.id}-comms`} className="border-b border-gray-700 bg-gray-900/60">
                            <td colSpan={9} className="p-0">
                              <CommPanel lead={lead} onUpdate={updateComm} />
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

        {/* Empty state */}
        {leads.length === 0 && !running && log.length === 0 && (
          <div className="text-center py-24 text-gray-600">
            <p className="text-lg font-medium">Enter a city above to start the pipeline</p>
            <p className="text-sm mt-2 max-w-md mx-auto">
              The pipeline searches Google Maps, filters for businesses without websites,
              builds a premium site for each one, writes personalized scripts, then populates
              this dashboard. You review and approve everything before any outreach.
            </p>
            <div className="mt-8 grid grid-cols-4 gap-4 max-w-2xl mx-auto text-left">
              {[
                { n: '1', label: 'Prospect Discovery', desc: 'Google Maps → filter no-website businesses' },
                { n: '2', label: 'Site Generation', desc: 'Claude builds a $5K-quality site per lead' },
                { n: '3', label: 'Script Writing', desc: 'Personalized call script + 4 follow-up texts' },
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
