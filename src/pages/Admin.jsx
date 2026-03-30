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

// Generate ordered month options from September 2025 to 12 months from now
function buildMonthOptions() {
  const options = []
  const start = { year: 2025, month: 8 } // September 2025 (0-indexed)
  const now = new Date()
  const endYear = now.getFullYear()
  const endMonth = now.getMonth() + 12 // 12 months ahead

  let y = start.year
  let m = start.month
  while (y < endYear || (y === endYear && m <= endMonth % 12) || y <= endYear + 1) {
    options.push(`${MONTHS[m]} ${y}`)
    m++
    if (m > 11) { m = 0; y++ }
    if (y > endYear + 1) break
  }
  return options
}

const MONTH_OPTIONS = buildMonthOptions()

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

  // Backfill cast
  const [backfilling, setBackfilling] = useState(false)
  const [backfillStatus, setBackfillStatus] = useState(null)

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

  // ── Backfill starring for all films missing it ──
  async function handleBackfillCast() {
    setBackfilling(true)
    setBackfillStatus('Fetching all films without cast info...')

    const { data: allFilms, error: fetchError } = await supabase
      .from('films')
      .select('id, title')
      .is('starring', null)

    if (fetchError) {
      setBackfillStatus(`Error fetching films: ${fetchError.message}. Make sure you've run: ALTER TABLE films ADD COLUMN starring text;`)
      setBackfilling(false)
      return
    }

    if (!allFilms || allFilms.length === 0) {
      setBackfillStatus('All films already have cast info.')
      setBackfilling(false)
      return
    }

    let updated = 0
    let failed = 0
    const failedTitles = []

    for (const film of allFilms) {
      setBackfillStatus(`Looking up "${film.title}"... (${updated + failed + 1}/${allFilms.length})`)
      const results = await searchMovies(film.title)
      if (!results || results.length === 0) {
        failed++
        failedTitles.push(film.title)
        continue
      }
      const details = await getMovieDetails(results[0].id)
      if (!details?.starring) {
        failed++
        failedTitles.push(film.title)
        continue
      }
      const { error: updateError } = await supabase
        .from('films')
        .update({ starring: details.starring })
        .eq('id', film.id)
      if (updateError) {
        failed++
        failedTitles.push(`${film.title} (${updateError.message})`)
      } else {
        updated++
      }
    }

    const failMsg = failedTitles.length > 0 ? ` | Skipped: ${failedTitles.join(', ')}` : ''
    setBackfillStatus(`Done! Updated ${updated} film${updated !== 1 ? 's' : ''}${failMsg}`)
    setBackfilling(false)
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

    const year = d.year || movie.year
    const baseTitle = d.title || movie.title
    console.log('year debug:', { dYear: d.year, movieYear: movie.year, year, baseTitle })
    setForm({
      title: year ? `${baseTitle} (${year})` : baseTitle,
      description: d.overview || '',
      poster_url: d.posterUrl || movie.posterUrl || '',
      posters: d.posters || [],
      trailer_url: d.trailer ? `https://www.youtube.com/watch?v=${d.trailer}` : '',
      director: d.director || '',
      writer: d.writer || '',
      cinematographer: d.cinematographer || '',
      starring: d.starring || '',
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

  // ── Load a film into the form for editing ──
  async function handleEdit(film) {
    setSubmitError(null)
    setSubmitSuccess(false)
    // Fetch full film data
    const { data } = await supabase
      .from('films')
      .select('*')
      .eq('id', film.id)
      .single()
    if (!data) return
    setForm({
      _editId: data.id,
      title: data.title || '',
      description: data.description || '',
      poster_url: data.poster_url || '',
      posters: [],
      trailer_url: data.trailer_url || '',
      director: data.director || '',
      writer: data.writer || '',
      cinematographer: data.cinematographer || '',
      starring: data.starring || '',
      where_to_watch: data.where_to_watch || '',
      month_year: data.month_year || '',
      week_number: data.week_number || 1,
      week_theme: data.week_theme || '',
      is_current: data.is_current || false,
    })
    // Scroll left panel into view
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Submit film (insert or update) ──
  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      poster_url: form.poster_url.trim() || null,
      trailer_url: form.trailer_url.trim() || null,
      director: form.director.trim() || null,
      writer: form.writer.trim() || null,
      cinematographer: form.cinematographer.trim() || null,
      starring: form.starring.trim() || null,
      where_to_watch: form.where_to_watch.trim() || null,
      month_year: form.month_year.trim(),
      month: form.month_year.split(' ')[0],
      week_number: Number(form.week_number),
      week_theme: form.week_theme.trim() || null,
      is_current: form.is_current,
    }

    let error
    if (form._editId) {
      ;({ error } = await supabase.from('films').update(payload).eq('id', form._editId))
    } else {
      ;({ error } = await supabase.from('films').insert(payload))
    }

    if (error) {
      setSubmitError(error.message)
    } else {
      setSubmitSuccess(true)
      setForm(null)
      if (payload.month_year === filterMonth) fetchFilms()
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
                {form._editId && (
                  <p className="admin-edit-banner">✏️ Editing: <strong>{form.title}</strong></p>
                )}

                {/* Poster picker */}
                {form.posters && form.posters.length > 1 ? (
                  <div className="admin-poster-picker">
                    <p className="admin-label">Select a poster</p>
                    <div className="admin-poster-grid">
                      {form.posters.map((p, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`admin-poster-option ${form.poster_url === p.full ? 'selected' : ''}`}
                          onClick={() => updateForm('poster_url', p.full)}
                        >
                          <img src={p.thumb} alt={`Poster ${i + 1}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : form.poster_url ? (
                  <div className="admin-poster-preview">
                    <img src={form.poster_url} alt={form.title} />
                    <div className="admin-poster-info">
                      <strong>{form.title}</strong>
                      {form.director && <span>dir. {form.director}</span>}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="admin-change-btn"
                  onClick={() => { setForm(null); setQuery('') }}
                >
                  {form._editId ? '← Cancel edit' : '← Search a different movie'}
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

                  <div className="admin-field admin-field-full">
                    <label className="admin-label">Starring</label>
                    <input className="admin-input" placeholder="e.g. Cary Grant, Ingrid Bergman" value={form.starring} onChange={e => updateForm('starring', e.target.value)} />
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
                    {submitting
                      ? (form._editId ? 'Saving...' : 'Adding...')
                      : (form._editId ? '✓ Save Changes' : '+ Add to Film Club')}
                  </button>
                </div>
              </form>
            )}

            {submitSuccess && (
              <div className="admin-success">
                {form?._editId ? 'Changes saved!' : 'Film added!'} <button className="admin-add-another" onClick={() => setSubmitSuccess(false)}>Add another →</button>
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
                {MONTH_OPTIONS.map(mo => (
                  <option key={mo} value={mo}>{mo}</option>
                ))}
              </select>
            </div>

            <button
              className="admin-backfill-btn"
              onClick={handleBackfillCast}
              disabled={backfilling}
            >
              {backfilling ? '⏳ Fetching cast...' : '🎭 Fetch Missing Cast from TMDB'}
            </button>
            {backfillStatus && <p className="admin-backfill-status">{backfillStatus}</p>}

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
                        className="admin-edit-btn"
                        onClick={() => handleEdit(film)}
                        title="Edit film"
                      >
                        ✏️
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
