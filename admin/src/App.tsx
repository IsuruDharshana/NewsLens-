import { useEffect, useState, useCallback, useRef } from 'react'

const API = '/api'

// ── Types ────────────────────────────────────────────────────────────
interface DashboardData {
  pipeline: {
    is_running: boolean
    current_step: string
    progress: number
    last_run_at: string | null
    last_run: Record<string, unknown>
  }
  counts: {
    articles: number
    clusters: number
    unclustered_articles: number
    users: number
    users_with_preferences: number
  }
  source_health: SourceHealth[]
  recent_runs: PipelineRun[]
  per_source_stats: { source: string; count: number }[]
  engagement: {
    total_likes: number
    total_comments: number
    top_stories: { id: string; title: string; category: string; likes: number }[]
  }
  gemini: { total_calls: number }
  errors: { run_id: string; started_at: string; error: string }[]
  category_breakdown: { category: string; count: number }[]
  configured_feeds: { name: string; url: string; priority: number }[]
}

interface SourceHealth {
  name: string
  priority: number
  article_count: number
  latest_article: string | null
  status: 'healthy' | 'no_articles' | 'error'
  error?: string
}

interface PipelineRun {
  id: string
  started_at: string
  completed_at: string | null
  articles_fetched: number
  clusters_created: number
  status: string
  errors: unknown
}

// ── Helpers ──────────────────────────────────────────────────────────
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString() : '—'

const elapsed = (start: string, end: string | null) => {
  if (!end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`
}

// ── Stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color: color || 'var(--accent)' }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// ── Section wrapper ──────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  )
}

// ── Badge ────────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: '#22c55e', completed: '#22c55e',
    no_articles: '#f59e0b', running: '#3b82f6',
    error: '#ef4444', failed: '#ef4444',
  }
  return (
    <span className="badge" style={{ background: (colors[status] || '#6b7280') + '22', color: colors[status] || '#6b7280' }}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ── Main App ─────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [pipelineProgress, setPipelineProgress] = useState<{ step: string; pct: number } | null>(null)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchDashboard = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${API}/admin/dashboard`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setLastRefresh(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 30000) // auto-refresh every 30s
    return () => clearInterval(interval)
  }, [fetchDashboard])

  // Poll pipeline status every 2s while running
  const pollPipelineStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/pipeline/status`)
      if (!res.ok) return
      const status = await res.json()
      if (status.is_running) {
        setPipelineProgress({ step: status.current_step || 'Running...', pct: status.progress || 0 })
      } else {
        setPipelineProgress(null)
        setTriggering(false)
        if (progressTimer.current) {
          clearInterval(progressTimer.current)
          progressTimer.current = null
        }
        fetchDashboard()
      }
    } catch { /* ignore */ }
  }, [fetchDashboard])

  const triggerPipeline = async () => {
    if (triggering) return
    setTriggering(true)
    setTriggerMsg(null)
    setPipelineProgress({ step: 'Starting...', pct: 5 })
    try {
      const res = await fetch(`${API}/pipeline/trigger`, { method: 'POST' })
      const json = await res.json()
      if (json.status === 'already_running') {
        setTriggerMsg('Pipeline is already running')
      } else {
        // Start polling for progress
        progressTimer.current = setInterval(pollPipelineStatus, 2000)
      }
    } catch {
      setTriggerMsg('Pipeline trigger failed — check backend logs')
      setTriggering(false)
      setPipelineProgress(null)
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current)
    }
  }, [])

  if (loading) return (
    <div className="loading">
      <div className="spinner" />
      <p>Loading dashboard…</p>
    </div>
  )

  if (error) return (
    <div className="error-page">
      <h2>Cannot connect to backend</h2>
      <p>{error}</p>
      <p className="hint">Make sure the backend is running at <code>localhost:8000</code></p>
      <button onClick={fetchDashboard}>Retry</button>
    </div>
  )

  if (!data) return null

  const { pipeline, counts, source_health, recent_runs, per_source_stats, engagement, gemini, errors, category_breakdown } = data

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <span className="logo">📰</span>
          <div>
            <h1 className="header-title">NewsLens Admin</h1>
            <p className="header-sub">Last refreshed {lastRefresh.toLocaleTimeString()} · auto-refreshes every 30s</p>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-secondary" onClick={fetchDashboard}>↻ Refresh</button>
          <button
            className={`btn-primary ${triggering ? '' : ''}`}
            onClick={triggerPipeline}
            disabled={triggering || pipeline.is_running}
          >
            {triggering || pipeline.is_running ? '⏳ Running…' : '▶ Run Pipeline'}
          </button>
        </div>
      </header>

      {/* ── Progress bar ── */}
      {pipelineProgress && (
        <div className="progress-banner">
          <div className="progress-header">
            <span className="progress-step">🔄 {pipelineProgress.step}</span>
            <span className="progress-pct">{pipelineProgress.pct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pipelineProgress.pct}%` }} />
          </div>
        </div>
      )}

      {triggerMsg && (
        <div className="alert">{triggerMsg}</div>
      )}

      <main className="main">

        {/* ── 1. Pipeline Status ── */}
        <Section title="1. Pipeline Status">
          <div className="stats-row">
            <StatCard
              label="Status"
              value={pipeline.is_running ? '⏳ Running' : '✓ Idle'}
              color={pipeline.is_running ? '#3b82f6' : '#22c55e'}
            />
            <StatCard label="Last Run" value={fmt(pipeline.last_run_at)} />
            <StatCard
              label="Articles (last run)"
              value={(pipeline.last_run as { articles_fetched?: number })?.articles_fetched ?? '—'}
            />
            <StatCard
              label="Clusters (last run)"
              value={(pipeline.last_run as { clusters_created?: number })?.clusters_created ?? '—'}
            />
            <StatCard
              label="Gemini Calls"
              value={(pipeline.last_run as { gemini_calls?: number })?.gemini_calls ?? '—'}
              sub="last run"
            />
          </div>
        </Section>

        {/* ── 2 & 3. Counts + Users ── */}
        <Section title="2 & 3. Cluster / Article / User Counts">
          <div className="stats-row">
            <StatCard label="Total Articles" value={counts.articles} />
            <StatCard label="Total Clusters" value={counts.clusters} />
            <StatCard label="Unclustered" value={counts.unclustered_articles} sub="pending" color="#f59e0b" />
            <StatCard label="Registered Users" value={counts.users} />
            <StatCard label="Users w/ Prefs" value={counts.users_with_preferences} />
          </div>
        </Section>

        {/* ── 7. Engagement Stats ── */}
        <Section title="7. Engagement Stats">
          <div className="stats-row">
            <StatCard label="Total Likes" value={engagement.total_likes} color="#ef4444" />
            <StatCard label="Total Comments" value={engagement.total_comments} color="#3b82f6" />
            <StatCard label="Gemini Calls (all time)" value={gemini.total_calls} color="#8b5cf6" />
          </div>
          {engagement.top_stories.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Story</th><th>Category</th><th>Likes</th></tr>
                </thead>
                <tbody>
                  {engagement.top_stories.map(s => (
                    <tr key={s.id}>
                      <td className="td-title">{s.title}</td>
                      <td><Badge status="healthy" />{s.category}</td>
                      <td>❤️ {s.likes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── 4. Source Health ── */}
        <Section title="4. Source Health">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Priority</th>
                  <th>Articles</th>
                  <th>Latest Article</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {source_health.map(s => (
                  <tr key={s.name}>
                    <td><strong>{s.name}</strong></td>
                    <td>P{s.priority}</td>
                    <td>{s.article_count}</td>
                    <td className="td-date">{fmt(s.latest_article)}</td>
                    <td><Badge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 6. Per-Source Fetch Stats ── */}
        <Section title="6. Per-Source Article Breakdown">
          <div className="bar-list">
            {per_source_stats.map(s => {
              const max = per_source_stats[0]?.count || 1
              return (
                <div key={s.source} className="bar-row">
                  <div className="bar-label">{s.source}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(s.count / max) * 100}%` }} />
                  </div>
                  <div className="bar-value">{s.count}</div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── 10. Category Breakdown ── */}
        <Section title="10. Category Breakdown">
          <div className="bar-list">
            {category_breakdown.map(c => {
              const max = category_breakdown[0]?.count || 1
              return (
                <div key={c.category} className="bar-row">
                  <div className="bar-label">{c.category}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(c.count / max) * 100}%`, background: '#8b5cf6' }} />
                  </div>
                  <div className="bar-value">{c.count}</div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── 5. Recent Pipeline Runs ── */}
        <Section title="5. Recent Pipeline Runs">
          {recent_runs.length === 0
            ? <p className="empty">No pipeline runs found.</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Started</th>
                      <th>Duration</th>
                      <th>Articles</th>
                      <th>Clusters</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent_runs.map(r => (
                      <tr key={r.id}>
                        <td className="td-date">{fmt(r.started_at)}</td>
                        <td>{elapsed(r.started_at, r.completed_at)}</td>
                        <td>{r.articles_fetched}</td>
                        <td>{r.clusters_created}</td>
                        <td><Badge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Section>

        {/* ── 9. Error Log ── */}
        <Section title="9. Error Log">
          {errors.length === 0
            ? <p className="empty success">✓ No errors recorded</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>When</th><th>Error</th></tr>
                  </thead>
                  <tbody>
                    {errors.map((e, i) => (
                      <tr key={i}>
                        <td className="td-date">{fmt(e.started_at)}</td>
                        <td className="td-error">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Section>

        {/* ── 8. Gemini Quota note ── */}
        <Section title="8. Gemini API Usage">
          <div className="info-box">
            <div className="info-row">
              <span>Total calls (this session)</span>
              <strong>{gemini.total_calls}</strong>
            </div>
            <div className="info-row">
              <span>Free tier daily limit</span>
              <strong>20 requests / day</strong>
            </div>
            <div className="info-row">
              <span>Model</span>
              <strong>gemini-2.0-flash</strong>
            </div>
            <p className="hint">
              If translation or summarization fails with 429, the free daily quota is exhausted.
              Enable billing at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer">aistudio.google.com</a> for 1000+ RPM.
            </p>
          </div>
        </Section>

      </main>
    </div>
  )
}
