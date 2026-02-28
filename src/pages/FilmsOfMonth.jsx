import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'

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
    <div style={{ maxWidth: '750px', margin: '2rem auto', padding: '1rem' }}>

      {/* Month Navigator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#1a1a2e',
        border: '1px solid #ff6b6b',
        boxShadow: '0 0 12px rgba(255,107,107,0.15)',
        borderRadius: '12px',
        padding: '1rem 1.5rem',
        marginBottom: '2rem'
      }}>
        <button onClick={goToPreviousMonth} style={{ background: '#333', fontSize: '1.2rem', padding: '0.3rem 0.9rem' }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>🎬 {getMonthYear(selectedDate)}</h2>
          {isCurrentMonth() && (
            <span style={{ color: '#ff6b6b', fontSize: '0.8rem', fontWeight: 'bold' }}>CURRENT MONTH</span>
          )}
        </div>
        <button onClick={goToNextMonth} style={{ background: '#333', fontSize: '1.2rem', padding: '0.3rem 0.9rem' }}>→</button>
      </div>

      {/* Films */}
      {films.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#1a1a2e',
          borderRadius: '12px',
          border: '1px solid #333',
          color: '#888'
        }}>
          <p style={{ fontSize: '1.2rem' }}>No films scheduled for this month yet.</p>
        </div>
      ) : (
        [1, 2, 3, 4].map(week => {
          const weekFilms = films.filter(f => f.week_number === week)
          if (weekFilms.length === 0) return null
          const isCurrentWeek = isCurrentMonth() && week === currentWeek

          return (
            <div key={week} style={{ marginBottom: '2rem' }}>

              {/* Week Header */}
              <div className="week-header" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{
                    background: isCurrentWeek ? '#ff6b6b' : '#333',
                    color: 'white',
                    padding: '0.3rem 1rem',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    alignSelf: 'flex-start'
                  }}>
                    WEEK {week} · {getWeekDates(week, selectedDate)} {isCurrentWeek ? '— NOW WATCHING' : ''}
                  </span>
                  {weekFilms[0]?.week_theme && (
                    <span className="week-theme" style={{ color: '#ffd93d', fontSize: '0.9rem', fontStyle: 'italic', paddingLeft: '0.5rem' }}>
                      {weekFilms[0].week_theme}
                    </span>
                  )}
                </div>
                <div className="week-header-divider" style={{ flex: 1, height: '1px', background: isCurrentWeek ? '#ff6b6b' : 'linear-gradient(90deg, #4a4a6a, transparent)' }} />
              </div>

              {/* Discussion Link */}
<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
  <Link to="/discussion" style={{ fontSize: '0.9rem' }}>
    💬 Go to Discussion →
  </Link>
</div>

              {/* One long card per week */}
              <div style={{
                background: isCurrentWeek ? 'linear-gradient(135deg, #1a1a2e, #16213e)' : '#141414',
                border: isCurrentWeek ? '2px solid #ff6b6b' : '1px solid #4a4a6a',
                borderRadius: '12px',
                padding: '1.25rem',
                boxShadow: isCurrentWeek ? '0 0 20px rgba(255,107,107,0.2)' : '0 0 10px rgba(74,74,106,0.2)'
              }}>
                {weekFilms.map((film, index) => {
                  const posterLeft = index % 2 === 0
                  return (
                    <div key={film.id}>
                      {index > 0 && <hr style={{ borderColor: '#ffd93d33', margin: '1.25rem 0' }} />}
                      <h2 style={{
                        fontSize: '1.3rem',
                        color: '#ffd93d',
                        borderBottom: '1px solid #ffd93d55',
                        paddingBottom: '0.4rem',
                        marginBottom: '1rem',
                        textAlign: posterLeft ? 'left' : 'right'
                      }}>
                        {film.title}
                      </h2>
                      <div style={{
                        display: 'flex',
                        flexDirection: posterLeft ? 'row' : 'row-reverse',
                        gap: '1.5rem',
                        alignItems: 'flex-start'
                      }}>
                        {film.poster_url && (
                          <img src={film.poster_url} alt={film.title} style={{
                            width: '130px',
                            height: '190px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            flexShrink: 0
                          }} />
                        )}
                        <div style={{ flex: 1, textAlign: posterLeft ? 'left' : 'right' }}>
                          <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{film.description}</p>
                          {ratings[film.id] && (
                            <p style={{ color: '#ffd93d', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                              ⭐ {ratings[film.id]} / 10
                            </p>
                          )}
                          <div style={{
                            display: 'flex',
                            gap: '0.75rem',
                            marginBottom: '0.75rem',
                            justifyContent: posterLeft ? 'flex-start' : 'flex-end',
                            flexWrap: 'wrap'
                          }}>
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
                              style={{
                                display: 'flex',
                                gap: '0.5rem',
                                alignItems: 'center',
                                justifyContent: posterLeft ? 'flex-start' : 'flex-end'
                              }}
                            >
                              <select
                                value={userRatings[film.id] || ''}
                                onChange={e => setUserRatings(prev => ({ ...prev, [film.id]: e.target.value }))}
                                style={{ width: 'auto', padding: '0.3rem' }}
                                required
                              >
                                <option value="">Rate</option>
                                {[...Array(10)].map((_, i) => (
                                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                              </select>
                              <button type="submit" style={{ padding: '0.3rem 0.75rem', fontSize: '0.9rem' }}>Submit</button>
                            </form>
                          ) : (
                            <Link to="/login">Log in to rate</Link>
                          )}
                          {messages[film.id] && (
                            <p style={{ color: '#6bcb77', fontSize: '0.85rem', marginTop: '0.25rem' }}>{messages[film.id]}</p>
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