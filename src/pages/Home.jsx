import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'
import './Home.css'

function StarRating({ score }) {
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
    <div className="home">

      {/* Welcome */}
      <div className="home-welcome">
        <h1>Welcome to the Film Club</h1>
        {user
          ? <p>Good to see you, <strong>{username}</strong>! Check out this week's films.</p>
          : <p>A place to watch, discuss, and rate films together. <Link to="/register">Join us</Link> or <Link to="/login">log in</Link>.</p>
        }
      </div>

      {/* About Section */}
      <div className="home-about">
        <h2 className="home-about-title">Welcome to the Double Feature Film Club</h2>
        <p className="home-about-intro">The idea is simple: a curated list of movies to explore together (or solo).</p>
        <ul className="home-about-list">
          <li><span className="home-about-label">who:</span> you! You silly Goose! and us here at Garden District.</li>
          <li><span className="home-about-label">what:</span> we are watching some fun movies.</li>
          <li><span className="home-about-label">when:</span> each week — but feel free to chat with us about any of the movies for the month.</li>
          <li><span className="home-about-label">where:</span> you watch at home then discuss here on the site or whenever you decide to swing on in to the bar.</li>
          <li><span className="home-about-label">how:</span> just like a book club. You watch at home and come discuss with us. Some of these movies are not on streaming so you may have to rent it or find whatever means to watch it.</li>
          <li><span className="home-about-label">why:</span> because movies are cool and maybe we can chat about it or it can give you a chance to talk to your neighbors in the Garden about it.</li>
        </ul>
        <p className="home-about-rule">Number one rule on the site: <strong>Be kind!</strong></p>
      </div>

      {/* Current Week Header */}
      <div className="home-week-header">
        <div>
          <span className="home-week-badge">
            WEEK {currentWeek} — NOW WATCHING
          </span>
          {weekTheme && (
            <p className="home-week-theme">{weekTheme}</p>
          )}
        </div>
        <Link to="/film-of-the-month" className="home-view-all">View all months →</Link>
      </div>

      {/* Film Cards */}
      {loading ? (
        <div className="home-empty-state loading">
          <p>Loading films...</p>
        </div>
      ) : currentWeekFilms.length === 0 ? (
        <div className="home-empty-state">
          <p>No films scheduled for this week yet.</p>
        </div>
      ) : (
        <div className="home-film-grid">
          {currentWeekFilms.map((film, index) => {
            const infoLeft = index % 2 === 0
            return (
              <div key={film.id} className="home-film-card">

                <div className={`home-film-card-top ${!infoLeft ? 'reverse' : ''}`}>

                  {/* Crew Info */}
                  <div className={`home-film-info ${!infoLeft ? 'text-right' : ''}`}>
                    <h2 className="home-film-title">{film.title}</h2>
                    {film.director && (
                      <div>
                        <p className="home-film-crew-label">Director</p>
                        <p className="home-film-crew-name">{film.director}</p>
                      </div>
                    )}
                    {film.writer && (
                      <div>
                        <p className="home-film-crew-label">Writer</p>
                        <p className="home-film-crew-name">{film.writer}</p>
                      </div>
                    )}
                    {film.cinematographer && (
                      <div>
                        <p className="home-film-crew-label">Cinematographer</p>
                        <p className="home-film-crew-name">{film.cinematographer}</p>
                      </div>
                    )}
                    {ratings[film.id] && (
                      <div>
                        <StarRating score={ratings[film.id]} />
                      </div>
                    )}
                    <div className={`home-film-links ${!infoLeft ? 'right' : ''}`}>
                      {film.trailer_url && (
                        <a href={film.trailer_url} target="_blank" rel="noreferrer">▶ Trailer</a>
                      )}
                      <Link to="/discussion">💬 Discuss</Link>
                    </div>
                  </div>

                  {/* Poster */}
                  {film.poster_url && (
                    <div className="home-film-poster-wrap">
                      <img
                        src={film.poster_url}
                        alt={film.title}
                        className="home-film-poster"
                      />
                    </div>
                  )}
                </div>

                {/* Description */}
                {film.description && (
                  <div className="home-film-desc">
                    <p>{film.description}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Recent Discussions */}
      <div className="home-discussions">
        <div className="home-discussions-header">
          <h3>💬 Recent Discussions</h3>
          <Link to="/discussion" className="home-view-all">View all →</Link>
        </div>

        {recentPosts.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.3)' }}>No discussions yet — <Link to="/discussion">start one!</Link></p>
        ) : (
          recentPosts.map(post => (
            <div key={post.id} className="home-discussion-item">
              <Link to={`/discussion/${post.id}`}>{post.title}</Link>
              <p className="home-discussion-meta">
                by {post.profiles?.username} · Week {post.week_number} · {new Date(post.created_at).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>

    </div>
  )
}
