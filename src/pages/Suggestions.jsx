import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'
import './Suggestions.css'

export default function Suggestions() {
  const [user, setUser] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [votes, setVotes] = useState({})
  const [userVotes, setUserVotes] = useState({})
  const [activeType, setActiveType] = useState('film')
  const [form, setForm] = useState({ title: '', description: '' })
  const [message, setMessage] = useState(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserVotes(session.user.id)
    })
    fetchSuggestions()
  }, [])

  async function fetchSuggestions() {
    const { data } = await supabase
      .from('suggestions')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false })
    setSuggestions(data || [])
    if (data) fetchVoteCounts(data)
  }

  async function fetchVoteCounts(suggestions) {
    const { data } = await supabase
      .from('suggestion_votes')
      .select('suggestion_id')
    if (data) {
      const counts = {}
      data.forEach(v => {
        counts[v.suggestion_id] = (counts[v.suggestion_id] || 0) + 1
      })
      setVotes(counts)
    }
  }

  async function fetchUserVotes(userId) {
    const { data } = await supabase
      .from('suggestion_votes')
      .select('suggestion_id')
      .eq('user_id', userId)
    if (data) {
      const voted = {}
      data.forEach(v => { voted[v.suggestion_id] = true })
      setUserVotes(voted)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return
    const { error } = await supabase
      .from('suggestions')
      .insert({ user_id: user.id, type: activeType, title: form.title, description: form.description })
    if (!error) {
      setForm({ title: '', description: '' })
      setShowForm(false)
      setMessage('Suggestion submitted!')
      setTimeout(() => setMessage(null), 3000)
      fetchSuggestions()
    }
  }

  async function handleVote(suggestion) {
    if (!user) return
    if (userVotes[suggestion.id]) {
      await supabase.from('suggestion_votes').delete()
        .eq('user_id', user.id)
        .eq('suggestion_id', suggestion.id)
      setUserVotes(prev => { const n = { ...prev }; delete n[suggestion.id]; return n })
      setVotes(prev => ({ ...prev, [suggestion.id]: Math.max(0, (prev[suggestion.id] || 1) - 1) }))
    } else {
      await supabase.from('suggestion_votes').insert({ user_id: user.id, suggestion_id: suggestion.id })
      setUserVotes(prev => ({ ...prev, [suggestion.id]: true }))
      setVotes(prev => ({ ...prev, [suggestion.id]: (prev[suggestion.id] || 0) + 1 }))
    }
  }

  const filtered = suggestions
    .filter(s => s.type === activeType)
    .sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0))

  return (
    <div className="page">

      <div className="sug-header">
        <h2>Suggestions & Requests</h2>
        <p>Suggest a film or theme and vote on others' ideas.</p>
      </div>

      {/* Type Tabs */}
      <div className="sug-tabs">
        {['film', 'theme'].map(t => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`sug-tab ${activeType === t ? 'active' : ''}`}
          >
            <span className="sug-tab-icon">{t === 'film' ? '🎬' : '🎭'}</span>
            <span>{t === 'film' ? 'Film Suggestions' : 'Theme Requests'}</span>
          </button>
        ))}
      </div>

      <div className="sug-content">

        {/* Success Toast */}
        {message && <div className="sug-toast">{message}</div>}

        {/* Submit Section */}
        {user ? (
          <div className="sug-form-section">
            {!showForm ? (
              <button className="sug-start-btn" onClick={() => setShowForm(true)}>
                + {activeType === 'film' ? 'Suggest a Film' : 'Request a Theme'}
              </button>
            ) : (
              <>
                <div className="sug-form-header">
                  <h3>{activeType === 'film' ? 'Suggest a Film' : 'Request a Theme'}</h3>
                  <button
                    type="button"
                    className="sug-form-close"
                    onClick={() => setShowForm(false)}
                  >&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="sug-form">
                  <input
                    type="text"
                    placeholder={activeType === 'film' ? 'Film title' : 'Theme name'}
                    value={form.title}
                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                  <textarea
                    placeholder={activeType === 'film' ? 'Why should we watch it?' : 'Describe the theme...'}
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                  <div className="sug-form-actions">
                    <button type="submit">Submit</button>
                  </div>
                </form>
              </>
            )}
          </div>
        ) : (
          <div className="sug-login-cta">
            <p>Want to suggest something?</p>
            <Link to="/login" className="sug-login-btn">Log in to Submit</Link>
          </div>
        )}

        <hr className="divider" />

        {/* Suggestions List */}
        <div className="sug-list">
          <h3 className="sug-list-title">
            {activeType === 'film' ? 'Film Suggestions' : 'Theme Requests'}
            <span className="sug-list-count">{filtered.length}</span>
          </h3>

          {filtered.length === 0 ? (
            <div className="sug-empty">
              <p>No {activeType} suggestions yet.</p>
              {user && (
                <button className="sug-be-first-btn" onClick={() => setShowForm(true)}>
                  Be the first to suggest
                </button>
              )}
            </div>
          ) : (
            filtered.map(s => (
              <div key={s.id} className="sug-item">
                <button
                  onClick={() => handleVote(s)}
                  className={`sug-vote ${userVotes[s.id] ? 'voted' : ''}`}
                  disabled={!user}
                >
                  <span className="sug-vote-arrow">▲</span>
                  <span className="sug-vote-count">{votes[s.id] || 0}</span>
                </button>

                <div className="sug-item-content">
                  <h4>{s.title}</h4>
                  {s.description && <p>{s.description}</p>}
                  <div className="sug-item-meta">
                    <span className="sug-item-avatar">
                      {s.profiles?.username?.slice(0, 1).toUpperCase() || '?'}
                    </span>
                    <small className="meta">
                      {s.profiles?.username} · {new Date(s.created_at).toLocaleDateString()}
                    </small>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
