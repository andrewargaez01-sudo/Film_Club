import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'
import './FilmsOfMonth.css'

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

export default function FilmsOfMonth() {
  const [films, setFilms] = useState([])
  const [ratings, setRatings] = useState({})
  const [userRatings, setUserRatings] = useState({})
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState({})
  const [currentWeek, setCurrentWeek] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    detectCurrentWeek()
  }, [])

  useEffect(() => {
    fetchFilms()
  }, [selectedDate])

  function detectCurrentWeek() {
    const day = new Date().getDate()
    if (day <= 7) setCurrentWeek(1)
    else if (day <= 14) setCurrentWeek(2)
    else if (day <= 21) setCurrentWeek(3)
    else setCurrentWeek(4)
  }

  function goToPreviousMonth() {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  function goToNextMonth() {
    setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  function isCurrentMonth() {
    const now = new Date()
    return selectedDate.getMonth() === now.getMonth() &&
      selectedDate.getFullYear() === now.getFullYear()
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
  }

  async function fetchAverageRating(filmId) {
    const { data } = await supabase
      .from('ratings')
      .select('score')
      .eq('film_id', filmId)
    if (data && data.length > 0) {
      const avg = data.reduce((sum, r) => sum + r.score, 0) / data.length
      setRatings(prev => ({ ...prev, [filmId]: avg.toFixed(1) }))
    }
  }

  async function handleRating(e, film) {
    e.preventDefault()
    if (!user) return setMessages(prev => ({ ...prev, [film.id]: 'You must be logged in to rate.' }))
    const score = userRatings[film.id]
    if (!score) return
    const { error } = await supabase
      .from('ratings')
      .upsert({ user_id: user.id, film_id: film.id, score: parseInt(score) })
    if (error) {
      setMessages(prev => ({ ...prev, [film.id]: error.message }))
    } else {
      setMessages(prev => ({ ...prev, [film.id]: 'Rating submitted!' }))
      fetchAverageRating(film.id)
    }
  }

  return (
    <div className="page">

      {/* Month Navigator */}
      <div className="month-nav">
        <button onClick={goToPreviousMonth} className="month-nav-btn">←</button>
        <div style={{ textAlign: 'center' }}>
          <h2>🎬 {getMonthYear(selectedDate)}</h2>
          {isCurrentMonth() && (
            <span className="month-label">CURRENT MONTH</span>
          )}
        </div>
        <button onClick={goToNextMonth} className="month-nav-btn">→</button>
      </div>

      {/* Films */}
      {films.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '1.1rem' }}>No films scheduled for this month yet.</p>
        </div>
      ) : (
        [1, 2, 3, 4].map(week => {
          const weekFilms = films.filter(f => f.week_number === week)
          if (weekFilms.length === 0) return null
          const isCurrentWeek = isCurrentMonth() && week === currentWeek

          return (
            <div key={week} className="fom-week">

              {/* Week Header */}
              <div className="fom-week-header">
                <div className="fom-week-meta">
                  <span className={`week-badge ${isCurrentWeek ? 'current' : ''}`}>
                    WEEK {week} · {getWeekDates(week, selectedDate)} {isCurrentWeek ? '— NOW WATCHING' : ''}
                  </span>
                  {weekFilms[0]?.week_theme && (
                    <span className="fom-week-theme">{weekFilms[0].week_theme}</span>
                  )}
                </div>
                <div className={`fom-week-line ${isCurrentWeek ? 'current' : ''}`} />
              </div>

              {/* Discussion Link */}
              <div className="fom-discuss-link">
                <Link to="/discussion">💬 Go to Discussion →</Link>
              </div>

              {/* Film Card */}
              <div className={`fom-card ${isCurrentWeek ? 'current' : ''}`}>
                {weekFilms.map((film, index) => {
                  const posterLeft = index % 2 === 0
                  return (
                    <div key={film.id}>
                      {index > 0 && <hr className="fom-film-divider" />}
                      <h2 className="fom-film-title" style={{ textAlign: posterLeft ? 'left' : 'right' }}>
                        {film.title}
                      </h2>
                      <div className={`fom-film-layout ${!posterLeft ? 'reverse' : ''}`}>
                        {film.poster_url && (
                          <img src={film.poster_url} alt={film.title} className="fom-poster" />
                        )}
                        <div className="fom-film-details" style={{ textAlign: posterLeft ? 'left' : 'right' }}>
                          <p className="fom-description">{film.description}</p>
                          {ratings[film.id] && (
                            <p className="fom-rating">⭐ {ratings[film.id]} / 10</p>
                          )}
                          <div className="fom-links" style={{ justifyContent: posterLeft ? 'flex-start' : 'flex-end' }}>
                            {film.trailer_url && (
                              <a href={film.trailer_url} target="_blank" rel="noreferrer">▶ Trailer</a>
                            )}
                            {film.where_to_watch && (
                              <a href={film.where_to_watch} target="_blank" rel="noreferrer" style={{ color: '#6bcb77' }}>🎬 Watch</a>
                            )}
                          </div>
                          {user ? (
                            <form
                              onSubmit={e => handleRating(e, film)}
                              className="fom-rate-form"
                              style={{ justifyContent: posterLeft ? 'flex-start' : 'flex-end' }}
                            >
                              <select
                                value={userRatings[film.id] || ''}
                                onChange={e => setUserRatings(prev => ({ ...prev, [film.id]: e.target.value }))}
                                required
                              >
                                <option value="">Rate</option>
                                {[...Array(10)].map((_, i) => (
                                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                              </select>
                              <button type="submit">Submit</button>
                            </form>
                          ) : (
                            <Link to="/login">Log in to rate</Link>
                          )}
                          {messages[film.id] && (
                            <p className="fom-rate-msg">{messages[film.id]}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
