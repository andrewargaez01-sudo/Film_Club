import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'
import './Discussion.css'

function getMonthYear(date) {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' })
}

// Returns the first Monday whose week has ≥4 days in the month
function getMonthStartMonday(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const dow = firstOfMonth.getDay()
  const daysToMonday = dow === 0 ? 6 : dow - 1
  const monday = new Date(year, month, 1 - daysToMonday)
  // If this Monday is in the previous month, count how many days of the week are in this month
  const daysInMonth = monday.getMonth() !== month ? 7 - daysToMonday : 7
  if (daysInMonth < 4) monday.setDate(monday.getDate() + 7)
  return monday
}

// Count weeks where ≥4 of 7 days fall in this month (max 5)
function getWeeksInMonth(date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const monday = getMonthStartMonday(date)
  let count = 0
  const cur = new Date(monday)
  while (count < 5) {
    if (cur > lastOfMonth) break
    const weekEnd = new Date(cur)
    weekEnd.setDate(cur.getDate() + 6)
    const overlapStart = cur < firstOfMonth ? firstOfMonth : cur
    const overlapEnd = weekEnd > lastOfMonth ? lastOfMonth : weekEnd
    const days = Math.round((overlapEnd - overlapStart) / 86400000) + 1
    if (days >= 4) count++
    cur.setDate(cur.getDate() + 7)
  }
  return count
}

function getWeekDates(week, date) {
  const monday = getMonthStartMonday(date)
  const start = new Date(monday)
  start.setDate(monday.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = d => d.toLocaleDateString('default', { month: 'numeric', day: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}`
}

function detectCurrentWeek(date = new Date()) {
  const monday = getMonthStartMonday(date)
  const daysDiff = Math.floor((date - monday) / (1000 * 60 * 60 * 24))
  const week = Math.floor(daysDiff / 7) + 1
  return Math.min(week, getWeeksInMonth(date))
}

const defaultFilmPrompts = [
  'What were your first impressions?',
  'Which scene stood out the most?',
  'How did the performances land for you?',
]

export default function Discussion() {
  const [films, setFilms] = useState([])
  const [ratings, setRatings] = useState({})
  const [user, setUser] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentWeek] = useState(detectCurrentWeek)
  const [activeWeek, setActiveWeek] = useState(detectCurrentWeek)
  const [posts, setPosts] = useState({})
  const [postInputs, setPostInputs] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [postError, setPostError] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editingPrompts, setEditingPrompts] = useState(null) // { filmId, prompts[] }
  const [savingPrompts, setSavingPrompts] = useState(false)
  const [editingCompare, setEditingCompare] = useState(null) // prompts[]
  const [savingCompare, setSavingCompare] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
          .then(({ data }) => setIsAdmin(!!data?.is_admin))
      }
    })
  }, [])

  useEffect(() => {
    fetchFilms()
  }, [selectedDate])

  useEffect(() => {
    fetchPosts(activeWeek)
  }, [activeWeek, selectedDate])

  function isCurrentMonth() {
    const now = new Date()
    return selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear()
  }

  function goToPreviousMonth() {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
    setActiveWeek(1)
  }

  function goToNextMonth() {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
    setActiveWeek(1)
  }

  async function fetchFilms() {
    const monthYear = getMonthYear(selectedDate)
    const { data } = await supabase
      .from('films')
      .select('*')
      .eq('month_year', monthYear)
      .order('week_number', { ascending: true })
    setFilms(data || [])
    setRatings({})
    if (data) data.forEach(film => fetchAverageRating(film.id))
    // Auto-select current week if current month
    if (isCurrentMonth()) setActiveWeek(detectCurrentWeek())
  }

  async function fetchAverageRating(filmId) {
    const { data } = await supabase
      .from('ratings')
      .select('score')
      .eq('film_id', filmId)
    if (data && data.length > 0) {
      const avg = data.reduce((sum, r) => sum + r.score, 0) / data.length
      setRatings(prev => ({ ...prev, [filmId]: avg }))
    }
  }

  async function fetchPosts(week) {
    const monthYear = getMonthYear(selectedDate)
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(username)')
      .eq('week_number', week)
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false })
setPosts(prev => ({ ...prev, [week]: data || [] }))
  }

  async function handlePost(e) {
    e.preventDefault()
    if (!user) return
    const monthYear = getMonthYear(selectedDate)
    const input = postInputs[activeWeek] || {}

    setPostError(null)
    const { error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        title: input.title,
        body: input.body,
        week_number: activeWeek,
        month_year: monthYear
      })
    if (error) {
      setPostError(error.message)
    } else {
      setPostInputs(prev => ({ ...prev, [activeWeek]: { title: '', body: '' } }))
      setShowForm(false)
      fetchPosts(activeWeek)
    }
  }

  // Get films for active week
  const weekFilms = films.filter(f => f.week_number === activeWeek)
  const weekTheme = weekFilms[0]?.week_theme

  // Build discussion prompts
  function getFilmPrompts(film) {
    if (film?.discussion_points) {
      return film.discussion_points.split('|').map(p => p.trim())
    }
    return defaultFilmPrompts
  }

  function getComparePrompts() {
    if (weekFilms.length < 2) return []
    const a = weekFilms[0].title
    const b = weekFilms[1].title
    return [
      `Which film had a stronger opening — ${a} or ${b}?`,
      `How do the directors' visual styles differ between the two?`,
      `If you could only recommend one to a friend, which would it be?`,
      `Which performance stood out more across both films?`,
      `How does each film handle its central theme differently?`,
    ]
  }

  function getComparePromptsForDisplay() {
    if (weekFilms[0]?.compare_points) {
      return weekFilms[0].compare_points.split('|').map(p => p.trim())
    }
    return getComparePrompts()
  }

  async function saveComparePrompts() {
    if (!editingCompare || !weekFilms[0]) return
    setSavingCompare(true)
    const filtered = editingCompare.filter(p => p.trim())
    const value = filtered.length ? filtered.join('|') : null
    const { error } = await supabase
      .from('films')
      .update({ compare_points: value })
      .eq('id', weekFilms[0].id)
    if (!error) {
      setFilms(prev => prev.map(f => f.id === weekFilms[0].id ? { ...f, compare_points: value } : f))
      setEditingCompare(null)
    }
    setSavingCompare(false)
  }

  async function savePrompts() {
    if (!editingPrompts) return
    setSavingPrompts(true)
    const { filmId, prompts } = editingPrompts
    const filtered = prompts.filter(p => p.trim())
    const value = filtered.length ? filtered.join('|') : null
    const { error } = await supabase
      .from('films')
      .update({ discussion_points: value })
      .eq('id', filmId)
    if (!error) {
      setFilms(prev => prev.map(f => f.id === filmId ? { ...f, discussion_points: value } : f))
      setEditingPrompts(null)
    }
    setSavingPrompts(false)
  }

  function renderPromptsCol(film) {
    const isEditing = editingPrompts?.filmId === film.id
    return (
      <div className="disc-prompts-col" key={film.id}>
        <div className="disc-prompts-col-header">
          <h4>Discuss: {film.title}</h4>
          {isAdmin && !isEditing && (
            <button
              className="disc-prompts-edit-btn"
              title="Edit prompts"
              onClick={() => setEditingPrompts({ filmId: film.id, prompts: getFilmPrompts(film) })}
            >✏️</button>
          )}
        </div>
        {isEditing ? (
          <div className="disc-prompt-editor">
            {editingPrompts.prompts.map((p, i) => (
              <div key={i} className="disc-prompt-edit-row">
                <input
                  className="disc-prompt-edit-input"
                  value={p}
                  onChange={e => {
                    const next = [...editingPrompts.prompts]
                    next[i] = e.target.value
                    setEditingPrompts(prev => ({ ...prev, prompts: next }))
                  }}
                />
                <button
                  className="disc-prompt-remove-btn"
                  onClick={() => setEditingPrompts(prev => ({
                    ...prev,
                    prompts: prev.prompts.filter((_, idx) => idx !== i)
                  }))}
                >×</button>
              </div>
            ))}
            <button
              className="disc-prompt-add-btn"
              onClick={() => setEditingPrompts(prev => ({ ...prev, prompts: [...prev.prompts, ''] }))}
            >+ Add prompt</button>
            <div className="disc-prompt-save-actions">
              <button
                className="disc-prompt-save-btn"
                onClick={savePrompts}
                disabled={savingPrompts}
              >{savingPrompts ? 'Saving...' : 'Save'}</button>
              <button
                className="disc-prompt-cancel-btn"
                onClick={() => setEditingPrompts(null)}
              >Cancel</button>
            </div>
          </div>
        ) : (
          <ul>
            {getFilmPrompts(film).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        )}
      </div>
    )
  }

  const weekPosts = posts[activeWeek] || []

  // Check which weeks have films
  const weeksWithFilms = new Set(films.map(f => f.week_number))

  return (
    <div className="page page-wide">

      {/* Month Navigator */}
      <div className="month-nav">
        <button onClick={goToPreviousMonth} className="month-nav-btn">←</button>
        <div style={{ textAlign: 'center' }}>
          <h2>💬 {getMonthYear(selectedDate)}</h2>
          {isCurrentMonth() && <span className="month-label">CURRENT MONTH</span>}
        </div>
        <button onClick={goToNextMonth} className="month-nav-btn">→</button>
      </div>

      {/* Week Tabs */}
      <div className="disc-tabs">
        {Array.from({ length: getWeeksInMonth(selectedDate) }, (_, i) => i + 1).map(week => {
          const isCurrent = isCurrentMonth() && week === currentWeek
          const isActive = week === activeWeek
          const tabFilms = films.filter(f => f.week_number === week)
          const hasFilms = tabFilms.length > 0
          const theme = tabFilms[0]?.week_theme
          return (
            <button
              key={week}
              onClick={() => setActiveWeek(week)}
              className={`disc-tab ${isActive ? (isCurrent ? 'now' : 'active') : ''}`}
              style={{ opacity: hasFilms ? 1 : 0.4 }}
            >
              <span className="disc-tab-top">
                <span className="disc-tab-label">Week {week}</span>
                {isCurrent && <span className="disc-tab-now">NOW WATCHING</span>}
              </span>
              {theme && <span className="disc-tab-theme">{theme.split(' - ')[0]}</span>}
              {hasFilms && (
                <span className="disc-tab-posters">
                  {tabFilms.map(f => f.poster_url ? (
                    <img key={f.id} src={f.poster_url} alt={f.title} className="disc-tab-poster" />
                  ) : (
                    <span key={f.id} className="disc-tab-poster-placeholder">🎬</span>
                  ))}
                </span>
              )}
              <span className="disc-tab-dates">{getWeekDates(week, selectedDate)}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="disc-content">

        {weekFilms.length === 0 ? (
          <div className="empty-state">
            <p>No films scheduled for Week {activeWeek} yet.</p>
          </div>
        ) : (
          <>
            {/* Week Theme */}
            {weekTheme && <div className="disc-theme">{weekTheme}</div>}

            {/* Film Showcase */}
            <div className={`disc-showcase ${weekFilms.length === 1 ? 'single' : ''}`}>
              {/* Film A */}
              <FilmCard film={weekFilms[0]} rating={ratings[weekFilms[0]?.id]} />

              {/* Film B */}
              {weekFilms.length >= 2 && (
                <FilmCard film={weekFilms[1]} rating={ratings[weekFilms[1]?.id]} />
              )}
            </div>

            {/* Discussion Prompts */}
            <div className="disc-prompts">
              {weekFilms.length >= 2 ? (
                <>
                  <div className="disc-prompts-grid">
                    {renderPromptsCol(weekFilms[0])}
                    {renderPromptsCol(weekFilms[1])}
                  </div>
                  <div className="disc-compare-section">
                    <div className="disc-prompts-col-header disc-compare-header">
                      <h4>Compare Them</h4>
                      {isAdmin && !editingCompare && (
                        <button
                          className="disc-prompts-edit-btn"
                          title="Edit compare prompts"
                          onClick={() => setEditingCompare(getComparePromptsForDisplay())}
                        >✏️</button>
                      )}
                    </div>
                    {editingCompare ? (
                      <div className="disc-prompt-editor">
                        {editingCompare.map((p, i) => (
                          <div key={i} className="disc-prompt-edit-row">
                            <input
                              className="disc-prompt-edit-input"
                              value={p}
                              onChange={e => {
                                const next = [...editingCompare]
                                next[i] = e.target.value
                                setEditingCompare(next)
                              }}
                            />
                            <button
                              className="disc-prompt-remove-btn"
                              onClick={() => setEditingCompare(prev => prev.filter((_, idx) => idx !== i))}
                            >×</button>
                          </div>
                        ))}
                        <button
                          className="disc-prompt-add-btn"
                          onClick={() => setEditingCompare(prev => [...prev, ''])}
                        >+ Add prompt</button>
                        <div className="disc-prompt-save-actions">
                          <button
                            className="disc-prompt-save-btn"
                            onClick={saveComparePrompts}
                            disabled={savingCompare}
                          >{savingCompare ? 'Saving...' : 'Save'}</button>
                          <button
                            className="disc-prompt-cancel-btn"
                            onClick={() => setEditingCompare(null)}
                          >Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <ul>
                        {getComparePromptsForDisplay().map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                renderPromptsCol(weekFilms[0])
              )}
            </div>

            {/* Start Discussion CTA / Form */}
            <div className="disc-form-section">
              {user ? (
                <>
                  {!showForm ? (
                    <button
                      className="disc-start-btn"
                      onClick={() => setShowForm(true)}
                    >
                      + Start a New Discussion
                    </button>
                  ) : (
                    <>
                      <div className="disc-form-header">
                        <h3>Start a Discussion</h3>
                        <button
                          type="button"
                          className="disc-form-close"
                          onClick={() => setShowForm(false)}
                        >×</button>
                      </div>

                      <form onSubmit={handlePost} className="disc-form">
                        <input
                          type="text"
                          placeholder="Give your post a title..."
                          value={postInputs[activeWeek]?.title || ''}
                          onChange={e => setPostInputs(prev => ({ ...prev, [activeWeek]: { ...prev[activeWeek], title: e.target.value } }))}
                          required
                        />
                        <textarea
                          placeholder="Share your thoughts, reactions, hot takes..."
                          value={postInputs[activeWeek]?.body || ''}
                          onChange={e => setPostInputs(prev => ({ ...prev, [activeWeek]: { ...prev[activeWeek], body: e.target.value } }))}
                          required
                          rows={4}
                        />
                        {postError && <p className="disc-form-error">{postError}</p>}
                        <div className="disc-form-actions">
                          <button type="submit">Post Discussion</button>
                        </div>
                      </form>
                    </>
                  )}
                </>
              ) : (
                <div className="disc-login-cta">
                  <p>Want to share your thoughts?</p>
                  <Link to="/login" className="disc-login-btn">Log in to Discuss</Link>
                </div>
              )}
            </div>
          </>
        )}

        {/* Posts List */}
        <div className="disc-posts-section">
          <h3>💬 Discussions ({weekPosts.length})</h3>

          {weekPosts.length === 0 ? (
            <div className="disc-no-posts">
              <p>No one has started a discussion yet for this week.</p>
              {user && (
                <button className="disc-be-first-btn" onClick={() => setShowForm(true)}>
                  Be the first to post
                </button>
              )}
            </div>
          ) : (
            weekPosts.map(post => (
              <div key={post.id} className="disc-post">
                <div className="disc-post-title">
                  <Link to={`/discussion/${post.id}`}>{post.title}</Link>
                </div>
                <p className="disc-post-body">{post.body}</p>
                <small className="meta">
                  by {post.profiles?.username} · {new Date(post.created_at).toLocaleDateString()}
                </small>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Film card component for the VS showcase
function FilmCard({ film, rating }) {
  if (!film) return null
  const ratingOut5 = rating ? (rating / 2).toFixed(1) : null

  return (
    <div className="disc-film-card">
      {film.poster_url ? (
        <img src={film.poster_url} alt={film.title} className="disc-film-poster" />
      ) : (
        <div className="disc-film-no-poster">🎬</div>
      )}
      <h3 className="disc-film-title">{film.title}</h3>
      {film.director && (
        <div className="disc-film-crew">
          <p className="disc-film-crew-label">Director</p>
          <p className="disc-film-crew-name">{film.director}</p>
        </div>
      )}
      {film.writer && (
        <div className="disc-film-crew">
          <p className="disc-film-crew-label">Writer</p>
          <p className="disc-film-crew-name">{film.writer}</p>
        </div>
      )}
      {film.cinematographer && (
        <div className="disc-film-crew">
          <p className="disc-film-crew-label">Cinematographer</p>
          <p className="disc-film-crew-name">{film.cinematographer}</p>
        </div>
      )}
      {film.starring && (
        <div className="disc-film-crew">
          <p className="disc-film-crew-label">Starring</p>
          <p className="disc-film-crew-name">{film.starring}</p>
        </div>
      )}
      {ratingOut5 && (
        <p className="disc-film-rating">⭐ {ratingOut5} / 5</p>
      )}
      <div className="disc-film-links">
        {film.trailer_url && (
          <a href={film.trailer_url} target="_blank" rel="noreferrer">▶ Trailer</a>
        )}
      </div>
      {film.description && (
        <p className="disc-film-desc">{film.description}</p>
      )}
    </div>
  )
}
