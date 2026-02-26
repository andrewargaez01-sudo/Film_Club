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
    ? new Date(year, month + 1, 0).getDate() // last day of month
    : week * 7
  const start = new Date(year, month, startDay)
  const end = new Date(year, month, endDay)
  const fmt = d => d.toLocaleDateString('default', { month: 'numeric', day: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}`
}

const autoPoints = [
  'What were your first impressions?',
  'Which scene stood out the most to you?',
  'How did this film make you feel?',
  'Would you recommend this to others?',
  'How does it compare to other films you have seen recently?'
]

export default function Discussion() {
  const [films, setFilms] = useState([])
  const [user, setUser] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [currentWeek, setCurrentWeek] = useState(null)
  const [expandedWeeks, setExpandedWeeks] = useState({})
  const [posts, setPosts] = useState({})
  const [postInputs, setPostInputs] = useState({})

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

    // Auto expand current week
    const day = new Date().getDate()
    let week = 1
    if (day <= 7) week = 1
    else if (day <= 14) week = 2
    else if (day <= 21) week = 3
    else week = 4
    setExpandedWeeks({ [week]: true })
    fetchPosts(week, monthYear)
  }

  async function fetchPosts(week, monthYear) {
    const my = monthYear || getMonthYear(selectedDate)
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(username)')
      .eq('week_number', week)
      .eq('month_year', my)
      .order('created_at', { ascending: false })
    setPosts(prev => ({ ...prev, [week]: data || [] }))
  }

  function toggleWeek(week) {
    setExpandedWeeks(prev => {
      const isOpen = prev[week]
      if (!isOpen) fetchPosts(week)
      return { ...prev, [week]: !isOpen }
    })
  }

  async function handlePost(e, week) {
    e.preventDefault()
    if (!user) return
    const monthYear = getMonthYear(selectedDate)
    const input = postInputs[week] || {}
    const { error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        title: input.title,
        body: input.body,
        week_number: week,
        month_year: monthYear
      })
    if (!error) {
      setPostInputs(prev => ({ ...prev, [week]: { title: '', body: '' } }))
      fetchPosts(week)
    }
  }

  function getDiscussionPoints(weekFilms) {
    const allPoints = []
    weekFilms.forEach(film => {
      if (film.discussion_points) {
        film.discussion_points.split('|').forEach(p => allPoints.push(p.trim()))
      }
    })
    // Fill remaining slots with auto points
    const needed = Math.max(0, 5 - allPoints.length)
    return [...allPoints, ...autoPoints.slice(0, needed)]
  }

  return (
    <div style={{ maxWidth: '750px', margin: '2rem auto', padding: '1rem' }}>

      {/* Month Navigator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '1rem 1.5rem',
        marginBottom: '2rem'
      }}>
        <button onClick={goToPreviousMonth} style={{ background: '#333', fontSize: '1.2rem', padding: '0.3rem 0.9rem' }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>💬 {getMonthYear(selectedDate)}</h2>
          {isCurrentMonth() && (
            <span style={{ color: '#ff6b6b', fontSize: '0.8rem', fontWeight: 'bold' }}>CURRENT MONTH</span>
          )}
        </div>
        <button onClick={goToNextMonth} style={{ background: '#333', fontSize: '1.2rem', padding: '0.3rem 0.9rem' }}>→</button>
      </div>

      {films.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#1a1a2e',
          borderRadius: '12px',
          border: '1px solid #333',
          color: '#888'
        }}>
          <p style={{ fontSize: '1.2rem' }}>No discussions for this month yet.</p>
        </div>
      ) : (
        [1, 2, 3, 4].map(week => {
          const weekFilms = films.filter(f => f.week_number === week)
          if (weekFilms.length === 0) return null
          const isCurrentWeek = isCurrentMonth() && week === currentWeek
          const isExpanded = expandedWeeks[week]
          const discussionPoints = getDiscussionPoints(weekFilms)

          return (
            <div key={week} style={{ marginBottom: '1.5rem' }}>

              {/* Week Header - clickable to expand */}
              <div
                onClick={() => toggleWeek(week)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isCurrentWeek ? 'linear-gradient(90deg, #1a1a2e, #16213e)' : '#1a1a2e',
                  border: isCurrentWeek ? '2px solid #ff6b6b' : '1px solid #333',
                  borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
                  padding: '1rem 1.5rem',
                  cursor: 'pointer',
                  boxShadow: isCurrentWeek ? '0 0 15px rgba(255,107,107,0.2)' : 'none'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      background: isCurrentWeek ? '#ff6b6b' : '#333',
                      color: 'white',
                      padding: '0.2rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      WEEK {week} · {getWeekDates(week, selectedDate)} {isCurrentWeek ? '— NOW WATCHING' : ''}
                    </span>
                  </div>
                  {weekFilms[0]?.week_theme && (
                    <p style={{ color: '#ffd93d', fontStyle: 'italic', margin: '0.3rem 0 0', fontSize: '0.95rem' }}>
                      {weekFilms[0].week_theme}
                    </p>
                  )}
                  <p style={{ color: '#888', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                    {weekFilms.map(f => f.title).join(' & ')}
                  </p>
                </div>
                <span style={{ color: '#ff6b6b', fontSize: '1.2rem' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{
                  background: '#141414',
                  border: isCurrentWeek ? '2px solid #ff6b6b' : '1px solid #333',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  padding: '1.5rem'
                }}>

                  {/* Discussion Points */}
                  <h3 style={{ marginBottom: '0.75rem', color: '#ff6b6b' }}>🗣 Discussion Points</h3>
                  <ul style={{ paddingLeft: '1.25rem', marginBottom: '1.5rem' }}>
                    {discussionPoints.map((point, i) => (
                      <li key={i} style={{ color: '#ccc', marginBottom: '0.4rem', fontSize: '0.95rem' }}>
                        {point}
                      </li>
                    ))}
                  </ul>

                  <hr style={{ borderColor: '#2a2a2a', marginBottom: '1.5rem' }} />

                  {/* Post Form */}
                  {user ? (
                    <form onSubmit={e => handlePost(e, week)} style={{ marginBottom: '1.5rem' }}>
                      <input
                        type="text"
                        placeholder="Post title"
                        value={postInputs[week]?.title || ''}
                        onChange={e => setPostInputs(prev => ({ ...prev, [week]: { ...prev[week], title: e.target.value } }))}
                        required
                        style={{ marginBottom: '0.5rem' }}
                      />
                      <textarea
                        placeholder="Share your thoughts..."
                        value={postInputs[week]?.body || ''}
                        onChange={e => setPostInputs(prev => ({ ...prev, [week]: { ...prev[week], body: e.target.value } }))}
                        required
                        rows={3}
                        style={{ marginBottom: '0.5rem' }}
                      />
                      <button type="submit" style={{ padding: '0.5rem 1.25rem' }}>Post</button>
                    </form>
                  ) : (
                    <p style={{ marginBottom: '1rem', color: '#888' }}>
                      <Link to="/login">Log in</Link> to join the discussion.
                    </p>
                  )}

                  {/* Posts */}
                  {(posts[week] || []).length === 0 ? (
                    <p style={{ color: '#666' }}>No posts yet — be the first!</p>
                  ) : (
                    (posts[week] || []).map(post => (
                      <div key={post.id} style={{ borderBottom: '1px solid #2a2a2a', padding: '0.75rem 0' }}>
                        <Link to={`/discussion/${post.id}`} style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                          {post.title}
                        </Link>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', margin: '0.25rem 0' }}>{post.body}</p>
                        <small>by {post.profiles?.username} · {new Date(post.created_at).toLocaleDateString()}</small>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}