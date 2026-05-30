'use client'

import { useState, useRef, useEffect } from 'react'
import { Lead, PipelineEvent } from '@/types'

const STATUS_OPTIONS = [
  '🔴 Not Contacted',
  '🟡 Called — No Answer',
  '🟠 Called — Interested',
  '🟢 Closed',
  '⚫ Dead',
]

type LogLine = { type: PipelineEvent['type']; message: string }

export default function Home() {
  const [city, setCity] = useState('')
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  // Load persisted leads on mount
  useEffect(() => {
    fetch('/api/leads')
      .then(r => r.json())
      .then((data: Lead[]) => setLeads(data))
      .catch(() => {})
  }, [])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log])

  const runPipeline = async () => {
    if (!city.trim() || running) return
    setRunning(true)
    setLog([])
    setLeads([])

    try {
      const response = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: city.trim() }),
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
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Web Agency</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Find businesses → Build sites → Get paid
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
            Enter a city or neighborhood. The pipeline will find qualified leads, build a website
            for each one, and populate the dashboard below.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runPipeline()}
              placeholder="e.g. Santa Monica, CA"
              disabled={running}
              className="flex-1 bg-gray-800 rounded-lg px-4 py-3 placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 text-sm"
            />
            <button
              onClick={runPipeline}
              disabled={running || !city.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium text-sm transition-colors"
            >
              {running ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" />
                  Running…
                </span>
              ) : (
                'Run Pipeline'
              )}
            </button>
          </div>
        </section>

        {/* Pipeline log */}
        {log.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  running ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                }`}
              />
              <span className="text-sm font-medium text-gray-300">Pipeline Log</span>
            </div>
            <div
              ref={logRef}
              className="p-4 h-52 overflow-y-auto font-mono text-xs space-y-1"
            >
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
              <p className="text-sm text-gray-400 mt-0.5">{leads.length} qualified leads — track status after each call</p>
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
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => (
                    <tr
                      key={lead.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
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
                      <td className="px-4 py-4 text-sm">
                        <span className="text-yellow-400">★</span>{' '}
                        <span>{lead.rating}</span>
                        <span className="text-gray-500 text-xs ml-1">({lead.reviews})</span>
                      </td>
                      <td className="px-4 py-4">
                        <a
                          href={lead.siteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 underline text-sm"
                        >
                          View Site →
                        </a>
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-xs">{lead.bestCallTime}</td>
                      <td className="px-4 py-4">
                        <select
                          value={lead.status}
                          onChange={e => updateStatus(lead.id, e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
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
              builds a premium site for each one, then populates this dashboard with contact
              info and a cold-call script.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto text-left">
              {[
                { n: '1', label: 'Prospect Discovery', desc: 'Google Maps → filter no-website businesses' },
                { n: '2', label: 'Site Generation', desc: 'Claude builds a $5K-quality site per lead' },
                { n: '3', label: 'Lead Dashboard', desc: 'Phone, rating, site link, call time + status tracker' },
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

        {/* Cold call script reference */}
        {leads.length > 0 && (
          <section className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-base font-semibold mb-4">Cold Call Script</h2>
            <div className="space-y-4 text-sm text-gray-300">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Opening (10 seconds)</div>
                <blockquote className="border-l-2 border-blue-500 pl-3 text-gray-200 italic">
                  &ldquo;Hi, is this the owner of [Business Name]? My name is [YOUR NAME]. This might sound
                  random — I actually built a website for [Business Name]. It&apos;s already done. Can I text
                  you the link real quick? Takes 10 seconds to look at. If you like it, we talk. If not,
                  no worries.&rdquo;
                </blockquote>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['I don\'t need a website', 'Totally fair. Just so you know, someone searching for [type] near [area] wouldn\'t find you right now. That site would fix that. Either way, it\'s there if you ever want it.'],
                  ['How much?', '[$X]/month — covers hosting, updates, and basic SEO. No contracts, cancel anytime.'],
                  ['I\'ll think about it', 'For sure. I\'ll text you the link so you have it. If you want it live just let me know, I can have it up same day.'],
                  ['I already have someone', 'No worries at all. If you ever want a second opinion on your online presence, the offer stands. Have a good one.'],
                ].map(([objection, response]) => (
                  <div key={objection} className="bg-gray-800 rounded-lg p-3">
                    <div className="text-yellow-400 text-xs font-medium mb-1">&ldquo;{objection}&rdquo;</div>
                    <div className="text-gray-300 text-xs">{response}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
