import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { searchMovies, getMovieDetails } from '../tmdb'
import './Admin.css'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const CURRENT_YEAR = new Date().getFullYear()

export default function Admin() {
  const navigate = useNavigate()

  // Auth / access
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  // Current films list
  const [films, setFilms] = useState([])
  const [filmsLoading, setFilmsLoading] = useState(false)
  const [filterMonth, setFilterMonth] = useState(`March ${CURRENT_YEAR}`)

  // TMDB search
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Film form
  const [form, setForm] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // ── Auth check ──
  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      if (!profile?.is_admin) { navigate('/'); return }
      setAllowed(true)
      setChecking(false)
    }
    check()
  }, [])

  useEffect(() => {
    if (allowed) fetchFilms()
  }, [allowed, filterMonth])

  // ── Fetch existing films ──
  async function fetchFilms() {
    setFilmsLoading(true)
    const { data } = await supabase
      .from('films')
      .select('id, title, week_number, week_theme, poster_url, is_current')
      .eq('month_year', filterMonth)
      .order('week_number', { ascending: true })
      .order('created_at', { ascending: true })
    setFilms(data || [])
    setFilmsLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this film?')) return
    await supabase.from('films').delete().eq('id', id)
    fetchFilms()
  }

  async function handleToggleCurrent(film) {
    await supabase.from('films').update({ is_current: !film.is_current }).eq('id', film.id)
    fetchFilms()
  }

  // ── TMDB search (debounced) ──
  useEffect(() => {
    if (!query || query.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const t = setTimeout(async () => {
      const results = await searchMovies(query)
      setSearchResults(results)
      setSearching(false)
    }, 400)
    return () => clearTimeout(t)
  }, [query])

  async function handleSelectMovie(movie) {
    setQuery('')
    setSearchResults([])
    setLoadingDetails(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    const details = await getMovieDetails(movie.id)
    const d = details || {}

    // Parse month/year for default
    const now = new Date()
    const defaultMonth = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

    setForm({
      title: d.title || movie.title,
      description: d.overview || '',
      poster_url: d.posterUrl || movie.posterUrl || '',
      trailer_url: d.trailer ? `https://www.youtube.com/watch?v=${d.trailer}` : '',
      director: d.director || '',
      writer: d.writer || '',
      cinematographer: d.cinematographer || '',
      where_to_watch: '',
      month_year: defaultMonth,
      week_number: 1,
      week_theme: '',
      is_current: false,
    })
    setLoadingDetails(false)
  }

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // ── Submit film ──
  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    const insert = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      poster_url: form.poster_url.trim() || null,
      trailer_url: form.trailer_url.trim() || null,
      director: form.director.trim() || null,
      writer: form.writer.trim() || null,
      cinematographer: form.cinematographer.trim() || null,
      where_to_watch: form.where_to_watch.trim() || null,
      month_year: form.month_year.trim(),
      month: form.month_year.split(' ')[0],
      week_number: Number(form.week_number),
      week_theme: form.week_theme.trim() || null,
      is_current: form.is_current,
    }

    const { error } = await supabase.from('films').insert(insert)
    if (error) {
      setSubmitError(error.message)
    } else {
      setSubmitSuccess(true)
      setForm(null)
      if (insert.month_year === filterMonth) fetchFilms()
    }
    setSubmitting(false)
  }

  if (checking) return null

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Panel</h1>
        <p className="admin-subtitle">Add and manage films for the club</p>
      </div>

      <div className="admin-layout">

        {/* ── LEFT: Add Film ── */}
        <div className="admin-add-col">
          <div className="admin-section">
            <h2 className="admin-section-title">Add a Film</h2>

            {/* TMDB search */}
            {!form && !loadingDetails && (
              <div className="admin-search">
                <label className="admin-label">Search TMDB</label>
                <input
                  className="admin-input"
                  type="text"
                  placeholder="Search for a movie..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                />
                {searching && <p className="admin-search-status">Searching...</p>}
                {searchResults.length > 0 && (
                  <div className="admin-search-results">
                    {searchResults.map(m => (
                      <button
                        key={m.id}
                        className="admin-search-item"
                        onClick={() => handleSelectMovie(m)}
                      >
                        {m.posterUrl
                          ? <img src={m.posterUrl} alt={m.title} />
                          : <div className="admin-search-no-poster">No Poster</div>
                        }
                        <span>
                          {m.title}
                          {m.year && <small> ({m.year})</small>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {query.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="admin-search-status">No results found.</p>
                )}
              </div>
            )}

            {loadingDetails && <p className="admin-search-status">Loading details from TMDB...</p>}

            {/* Film form */}
            {form && (
              <form className="admin-form" onSubmit={handleSubmit}>

                {/* Poster preview */}
                {form.poster_url && (
                  <div className="admin-poster-preview">
                    <img src={form.poster_url} alt={form.title} />
                    <div className="admin-poster-info">
                      <strong>{form.title}</strong>
                      {form.director && <span>dir. {form.director}</span>}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="admin-change-btn"
                  onClick={() => { setForm(null); setQuery('') }}
                >
                  ← Search a different movie
                </button>

                <div className="admin-form-grid">
                  <div className="admin-field admin-field-full">
                    <label className="admin-label">Title *</label>
                    <input className="admin-input" value={form.title} onChange={e => updateForm('title', e.target.value)} required />
                  </div>

                  <div className="admin-field">
                    <label className="admin-label">Month (e.g. March 2026) *</label>
                    <input className="admin-input" value={form.month_year} onChange={e => updateForm('month_year', e.target.value)} required />
                  </div>

                  <div className="admin-field">
                    <label className="admin-label">Week Number *</label>
                    <select className="admin-input" value={form.week_number} onChange={e => updateForm('week_number', e.target.value)}>
                      <option value={1}>Week 1</option>
                      <option value={2}>Week 2</option>
                      <option value={3}>Week 3</option>
                      <option value={4}>Week 4</option>
                    </select>
                  </div>

                  <div className="admin-field admin-field-full">
                    <label className="admin-label">Week Theme</label>
                    <input className="admin-input" placeholder="e.g. Hitchcock: The Master and his Disciple" value={form.week_theme} onChange={e => updateForm('week_theme', e.target.value)} />
                  </div>

                  <div className="admin-field">
                    <label className="admin-label">Director</label>
                    <input className="admin-input" value={form.director} onChange={e => updateForm('director', e.target.value)} />
                  </div>

                  <div className="admin-field">
                    <label className="admin-label">Writer</label>
                    <input className="admin-input" value={form.writer} onChange={e => updateForm('writer', e.target.value)} />
                  </div>

                  <div className="admin-field">
                    <label className="admin-label">Cinematographer</label>
                    <input className="admin-input" value={form.cinematographer} onChange={e => updateForm('cinematographer', e.target.value)} />
                  </div>

                  <div className="admin-field">
                    <label className="admin-label">Trailer URL</label>
                    <input className="admin-input" placeholder="https://youtube.com/watch?v=..." value={form.trailer_url} onChange={e => updateForm('trailer_url', e.target.value)} />
                  </div>

                  <div className="admin-field admin-field-full">
                    <label className="admin-label">Where to Watch (streaming links)</label>
                    <input className="admin-input" placeholder="https://netflix.com/..." value={form.where_to_watch} onChange={e => updateForm('where_to_watch', e.target.value)} />
                  </div>

                  <div className="admin-field admin-field-full">
                    <label className="admin-label">Poster URL</label>
                    <input className="admin-input" value={form.poster_url} onChange={e => updateForm('poster_url', e.target.value)} />
                  </div>

                  <div className="admin-field admin-field-full">
                    <label className="admin-label">Description</label>
                    <textarea className="admin-input admin-textarea" rows={4} value={form.description} onChange={e => updateForm('description', e.target.value)} />
                  </div>

                  <div className="admin-field admin-field-full">
                    <label className="admin-toggle">
                      <input type="checkbox" checked={form.is_current} onChange={e => updateForm('is_current', e.target.checked)} />
                      <span>Mark as current week's film</span>
                    </label>
                  </div>
                </div>

                {submitError && <p className="admin-error">{submitError}</p>}

                <div className="admin-form-actions">
                  <button type="submit" className="admin-submit-btn" disabled={submitting}>
                    {submitting ? 'Adding...' : '+ Add to Film Club'}
                  </button>
                </div>
              </form>
            )}

            {submitSuccess && (
              <div className="admin-success">
                Film added! <button className="admin-add-another" onClick={() => setSubmitSuccess(false)}>Add another →</button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Current Films ── */}
        <div className="admin-list-col">
          <div className="admin-section">
            <div className="admin-list-header">
              <h2 className="admin-section-title">Films on the Club</h2>
              <select
                className="admin-month-select"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
              >
                {MONTHS.flatMap(m => [
                  `${m} ${CURRENT_YEAR}`,
                  `${m} ${CURRENT_YEAR + 1}`,
                ]).map(mo => (
                  <option key={mo} value={mo}>{mo}</option>
                ))}
              </select>
            </div>

            {filmsLoading ? (
              <p className="admin-search-status">Loading...</p>
            ) : films.length === 0 ? (
              <p className="admin-search-status">No films for {filterMonth} yet.</p>
            ) : (
              <div className="admin-film-list">
                {films.map(film => (
                  <div key={film.id} className={`admin-film-item ${film.is_current ? 'is-current' : ''}`}>
                    {film.poster_url && (
                      <img src={film.poster_url} alt={film.title} className="admin-film-poster" />
                    )}
                    <div className="admin-film-details">
                      <p className="admin-film-title">{film.title}</p>
                      <p className="admin-film-meta">Week {film.week_number}</p>
                      {film.week_theme && <p className="admin-film-theme">{film.week_theme}</p>}
                      {film.is_current && <span className="admin-current-badge">● Current</span>}
                    </div>
                    <div className="admin-film-actions">
                      <button
                        className="admin-toggle-current"
                        onClick={() => handleToggleCurrent(film)}
                        title={film.is_current ? 'Remove from current' : 'Mark as current'}
                      >
                        {film.is_current ? '★' : '☆'}
                      </button>
                      <button
                        className="admin-delete-btn"
                        onClick={() => handleDelete(film.id)}
                        title="Delete film"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
