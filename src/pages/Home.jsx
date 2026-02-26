import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'

function getMonthYear(date) {
  const fmt = d => d.toLocaleDateString('default', { month: 'numeric', day: 'numeric' })
}

function StarRating({ score }) {
  // score is out of 10; convert to out of 5
  const outOf5 = score / 2
  return (
    <span style={{ fontSize: '1.1rem', letterSpacing: '0.05em' }}>
      {[1, 2, 3, 4, 5].map(i => {
        if (outOf5 >= i) {
          return <span key={i} style={{ color: '#ffd93d' }}>★</span>
        } else if (outOf5 >= i - 0.5) {
          return (
            <span key={i} style={{ position: 'relative', display: 'inline-block', color: '#444' }}>
              ★
              <span style={{ position: 'absolute', left: 0, top: 0, width: '50%', overflow: 'hidden', color: '#ffd93d' }}>★</span>
            </span>
          )
        } else {
          return <span key={i} style={{ color: '#444' }}>★</span>
        }
      })}
      <span style={{ color: '#aaa', fontSize: '0.8rem', marginLeft: '0.3rem' }}>{(outOf5).toFixed(1)}</span>
    </span>
  )
}

export default function Home() {
  const [currentWeekFilms, setCurrentWeekFilms] = useState([])
  const [recentPosts, setRecentPosts] = useState([])
  const [ratings, setRatings] = useState({})
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(null)
  const [currentWeek, setCurrentWeek] = useState(null)
  const [weekTheme, setWeekTheme] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUsername(session.user.id)
    })
    detectAndFetch()
    fetchRecentPosts()
  }, [])

  function detectAndFetch() {
    setCurrentWeek(1)
    fetchCurrentWeekFilms(1)
  }

  async function fetchUsername(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()
    if (data) setUsername(data.username)
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

  async function fetchCurrentWeekFilms(week) {
    setLoading(true)
    const monthYear = 'March 2026'
    const { data } = await supabase
      .from('films')
      .select('*')
      .eq('month_year', monthYear)
      .eq('week_number', week)
      .order('created_at', { ascending: true })
    setCurrentWeekFilms(data || [])
    if (data) data.forEach(film => fetchAverageRating(film.id))
    if (data && data[0]?.week_theme) setWeekTheme(data[0].week_theme)
    setLoading(false)
  }

  async function fetchRecentPosts() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentPosts(data || [])
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '2rem auto', padding: '1rem' }}>

      {/* Welcome */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Welcome to the Film Club</h1>
        {user
          ? <p style={{ color: '#ccc', fontSize: '1.1rem' }}>Good to see you, <strong style={{ color: '#6bcb77' }}>{username}</strong>! Check out this week's films.</p>
          : <p style={{ color: '#ccc', fontSize: '1.1rem' }}>A place to watch, discuss, and rate films together. <Link to="/register">Join us</Link> or <Link to="/login">log in</Link>.</p>
        }
      </div>

      {/* Current Week Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem'
      }}>
        <div>
          <span style={{
            background: '#ff6b6b',
            color: 'white',
            padding: '0.3rem 1rem',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: 'bold'
          }}>
            WEEK {currentWeek} — NOW WATCHING
          </span>
          {weekTheme && (
            <p style={{ color: '#ffd93d', fontStyle: 'italic', margin: '0.4rem 0 0', fontSize: '1rem' }}>
             {weekTheme}
            </p>
          )}
        </div>
        <Link to="/film-of-the-month" style={{ fontSize: '0.9rem' }}>View all months →</Link>
      </div>

      {/* Big Film Cards */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#1a1a2e',
          borderRadius: '12px',
          border: '1px solid #333',
          color: '#888',
          marginBottom: '2rem'
        }}>
          <p>Loading films...</p>
        </div>
      ) : currentWeekFilms.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#1a1a2e',
          borderRadius: '12px',
          border: '1px solid #333',
          color: '#888',
          marginBottom: '2rem'
        }}>
          <p>No films scheduled for this week yet.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1.5rem',
          marginBottom: '2.5rem'
        }}>
          {currentWeekFilms.map((film, index) => {
            const infoLeft = index % 2 === 0
            return (
              <div key={film.id} style={{
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                border: '2px solid #ff6b6b',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 0 25px rgba(255,107,107,0.2)',
                display: 'flex',
                flexDirection: 'column'
              }}>

                {/* Top: crew + poster */}
                <div style={{
                  display: 'flex',
                  flexDirection: infoLeft ? 'row' : 'row-reverse',
                  alignItems: 'stretch'
                }}>

                  {/* Crew Info */}
                  <div style={{
                    flex: 1,
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    gap: '0.6rem',
                    textAlign: infoLeft ? 'left' : 'right'
                  }}>
                    <h2 style={{ fontSize: '1.2rem', color: '#ffd93d', margin: 0 }}>
                      {film.title}
                    </h2>
                    {film.director && (
                      <div>
                        <p style={{ color: '#888', fontSize: '0.7rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Director</p>
                        <p style={{ color: '#fff', fontSize: '0.95rem', margin: 0 }}>{film.director}</p>
                      </div>
                    )}
                    {film.writer && (
                      <div>
                        <p style={{ color: '#888', fontSize: '0.7rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Writer</p>
                        <p style={{ color: '#fff', fontSize: '0.95rem', margin: 0 }}>{film.writer}</p>
                      </div>
                    )}
                    {film.cinematographer && (
                      <div>
                        <p style={{ color: '#888', fontSize: '0.7rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cinematographer</p>
                        <p style={{ color: '#fff', fontSize: '0.95rem', margin: 0 }}>{film.cinematographer}</p>
                      </div>
                    )}
                    {ratings[film.id] && (
                      <div style={{ margin: 0 }}>
                        <StarRating score={ratings[film.id]} />
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      justifyContent: infoLeft ? 'flex-start' : 'flex-end',
                      marginTop: '0.25rem'
                    }}>
                      {film.trailer_url && (
                        <a href={film.trailer_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem' }}>▶ Trailer</a>
                      )}
                      <Link to="/discussion" style={{ fontSize: '0.85rem' }}>💬 Discuss</Link>
                    </div>
                  </div>

                  {/* Poster */}
                  {film.poster_url && (
                    <div style={{
                      flexShrink: 0,
                      padding: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={film.poster_url}
                        alt={film.title}
                        style={{
                          width: '200px',
                          height: '300px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '2px solid #ffd93d',
                          boxShadow: '0 0 18px rgba(255,217,61,0.45), 0 0 6px rgba(255,217,61,0.25)'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Description below */}
                {film.description && (
                  <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #2a2a2a' }}>
                    <p style={{ color: '#ccc', fontSize: '0.85rem', margin: 0 }}>{film.description}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Recent Discussions */}
      <div style={{
        background: '#1a1a2e',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid #333'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>💬 Recent Discussions</h3>
          <Link to="/discussion" style={{ fontSize: '0.9rem' }}>View all →</Link>
        </div>

        {recentPosts.length === 0 ? (
          <p style={{ color: '#666' }}>No discussions yet — <Link to="/discussion">start one!</Link></p>
        ) : (
          recentPosts.map(post => (
            <div key={post.id} style={{ borderBottom: '1px solid #2a2a2a', padding: '0.75rem 0' }}>
              <Link to={`/discussion/${post.id}`} style={{ fontWeight: 'bold' }}>{post.title}</Link>
              <p style={{ color: '#888', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                by {post.profiles?.username} · Week {post.week_number} · {new Date(post.created_at).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>

    </div>
  )
}