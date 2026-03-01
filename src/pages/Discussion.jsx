import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'
import './Discussion.css'

function getMonthYear(date) {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function getWeekDates(week, date) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const startDay = (week - 1) * 7 + 1
  const endDay = week === 4
    ? new Date(year, month + 1, 0).getDate()
    : week * 7
  const start = new Date(year, month, startDay)
  const end = new Date(year, month, endDay)
  const fmt = d => d.toLocaleDateString('default', { month: 'numeric', day: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}`
}

function detectCurrentWeek() {
  const day = new Date().getDate()
  if (day <= 7) return 1
  if (day <= 14) return 2
  if (day <= 21) return 3
  return 4
}

// Parse tag prefix from post title: [Film Title] or [VS]
function parsePostTag(title) {
  const match = title?.match(/^\[(.*?)\]\s*/)
  if (!match) return { tag: null, cleanTitle: title }
  return { tag: match[1], cleanTitle: title.slice(match[0].length) }
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
  const [postTag, setPostTag] = useState('general')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
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
    const weekFilms = films.filter(f => f.week_number === activeWeek)

    // Build title with tag prefix
    let title = input.title
    if (postTag === 'film0' && weekFilms[0]) {
      title = `[${weekFilms[0].title}] ${input.title}`
    } else if (postTag === 'film1' && weekFilms[1]) {
      title = `[${weekFilms[1].title}] ${input.title}`
    } else if (postTag === 'vs') {
      title = `[VS] ${input.title}`
    }

    const { error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        title,
        body: input.body,
        week_number: activeWeek,
        month_year: monthYear
      })
    if (!error) {
      setPostInputs(prev => ({ ...prev, [activeWeek]: { title: '', body: '' } }))
      setPostTag('general')
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

  // Filter posts
  const weekPosts = posts[activeWeek] || []
  const filteredPosts = weekPosts.filter(post => {
    if (filter === 'all') return true
    const { tag } = parsePostTag(post.title)
    if (filter === 'vs') return tag === 'VS'
    if (filter === 'general') return !tag
    if (filter === 'film0') return tag === weekFilms[0]?.title
    if (filter === 'film1') return tag === weekFilms[1]?.title
    return true
  })

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
        {[1, 2, 3, 4].map(week => {
          const isCurrent = isCurrentMonth() && week === currentWeek
          const isActive = week === activeWeek
          const tabFilms = films.filter(f => f.week_number === week)
          const hasFilms = tabFilms.length > 0
          const theme = tabFilms[0]?.week_theme
          return (
            <button
              key={week}
              onClick={() => { setActiveWeek(week); setFilter('all') }}
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

              {/* VS Divider */}
              {weekFilms.length >= 2 && (
                <>
                  <div className="disc-vs">
                    <div className="disc-vs-line" />
                    <div className="disc-vs-badge">VS</div>
                    <div className="disc-vs-line" />
                  </div>
                  {/* Film B */}
                  <FilmCard film={weekFilms[1]} rating={ratings[weekFilms[1]?.id]} />
                </>
              )}
            </div>

            {/* Discussion Prompts */}
            <div className="disc-prompts">
              {weekFilms.length >= 2 ? (
                <>
                  <div className="disc-prompts-grid">
                    <div className="disc-prompts-col">
                      <h4>Discuss: {weekFilms[0].title}</h4>
                      <ul>
                        {getFilmPrompts(weekFilms[0]).map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                    <div className="disc-prompts-col">
                      <h4>Discuss: {weekFilms[1].title}</h4>
                      <ul>
                        {getFilmPrompts(weekFilms[1]).map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  </div>
                  <div className="disc-compare-section">
                    <h4>Compare Them</h4>
                    <ul>
                      {getComparePrompts().map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="disc-prompts-col">
                  <h4>Discuss: {weekFilms[0].title}</h4>
                  <ul>
                    {getFilmPrompts(weekFilms[0]).map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
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

                      <p className="disc-form-hint">What are you discussing?</p>
                      {weekFilms.length >= 2 && (
                        <div className="disc-tag-selector">
                          <button
                            type="button"
                            className={`disc-tag-btn ${postTag === 'film0' ? 'active' : ''}`}
                            onClick={() => setPostTag('film0')}
                          >
                            {weekFilms[0].title}
                          </button>
                          <button
                            type="button"
                            className={`disc-tag-btn ${postTag === 'film1' ? 'active' : ''}`}
                            onClick={() => setPostTag('film1')}
                          >
                            {weekFilms[1].title}
                          </button>
                          <button
                            type="button"
                            className={`disc-tag-btn ${postTag === 'vs' ? 'active-vs' : ''}`}
                            onClick={() => setPostTag('vs')}
                          >
                            Comparing Both
                          </button>
                          <button
                            type="button"
                            className={`disc-tag-btn ${postTag === 'general' ? 'active' : ''}`}
                            onClick={() => setPostTag('general')}
                          >
                            General
                          </button>
                        </div>
                      )}
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

          {/* Filters */}
          {weekFilms.length >= 2 && weekPosts.length > 0 && (
            <div className="disc-filters">
              <button
                className={`disc-filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >All</button>
              <button
                className={`disc-filter-btn ${filter === 'film0' ? 'active' : ''}`}
                onClick={() => setFilter('film0')}
              >{weekFilms[0].title}</button>
              <button
                className={`disc-filter-btn ${filter === 'film1' ? 'active' : ''}`}
                onClick={() => setFilter('film1')}
              >{weekFilms[1].title}</button>
              <button
                className={`disc-filter-btn ${filter === 'vs' ? 'active' : ''}`}
                onClick={() => setFilter('vs')}
              >Comparisons</button>
              <button
                className={`disc-filter-btn ${filter === 'general' ? 'active' : ''}`}
                onClick={() => setFilter('general')}
              >General</button>
            </div>
          )}

          {filteredPosts.length === 0 ? (
            <div className="disc-no-posts">
              {weekPosts.length === 0 ? (
                <>
                  <p>No one has started a discussion yet for this week.</p>
                  {user && (
                    <button className="disc-be-first-btn" onClick={() => setShowForm(true)}>
                      Be the first to post
                    </button>
                  )}
                </>
              ) : (
                <p>No posts match this filter.</p>
              )}
            </div>
          ) : (
            filteredPosts.map(post => {
              const { tag, cleanTitle } = parsePostTag(post.title)
              return (
                <div key={post.id} className="disc-post">
                  <div className="disc-post-title">
                    {tag && (
                      <span className={`disc-post-tag ${tag === 'VS' ? 'vs' : 'film'}`}>
                        {tag === 'VS' ? 'VS' : tag}
                      </span>
                    )}
                    <Link to={`/discussion/${post.id}`}>{cleanTitle}</Link>
                  </div>
                  <p className="disc-post-body">{post.body}</p>
                  <small className="meta">
                    by {post.profiles?.username} · {new Date(post.created_at).toLocaleDateString()}
                  </small>
                </div>
              )
            })
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
