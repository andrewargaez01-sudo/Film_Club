import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Link } from 'react-router-dom'

export default function Suggestions() {
  const [user, setUser] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [votes, setVotes] = useState({})
  const [userVotes, setUserVotes] = useState({})
  const [activeType, setActiveType] = useState('film')
  const [form, setForm] = useState({ title: '', description: '' })
  const [message, setMessage] = useState(null)

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
    <div style={{ maxWidth: '750px', margin: '2rem auto', padding: '1rem' }}>

      <h2 style={{ marginBottom: '0.25rem' }}>💡 Suggestions & Requests</h2>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Suggest a film or theme and vote on others' ideas.</p>

      {/* Type Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0' }}>
        {['film', 'theme'].map(t => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            style={{
              padding: '0.4rem 1.2rem',
              background: activeType === t ? '#ff6b6b' : '#222',
              color: 'white',
              border: '1px solid #333',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: activeType === t ? 'bold' : 'normal',
              fontSize: '0.9rem'
            }}
          >
            {t === 'film' ? '🎬 Film Suggestions' : '🎭 Theme Requests'}
          </button>
        ))}
      </div>

      <div style={{
        background: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: '0 8px 12px 12px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>

        {/* Submit Form */}
        {user ? (
          <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '0.75rem', color: '#ff6b6b' }}>
              {activeType === 'film' ? '+ Suggest a Film' : '+ Request a Theme'}
            </h3>
            <input
              type="text"
              placeholder={activeType === 'film' ? 'Film title' : 'Theme name'}
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              required
              style={{ marginBottom: '0.5rem' }}
            />
            <textarea
              placeholder={activeType === 'film' ? 'Why should we watch it?' : 'Describe the theme...'}
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              style={{ marginBottom: '0.5rem' }}
            />
            {message && <p style={{ color: '#6bcb77', marginBottom: '0.5rem' }}>{message}</p>}
            <button type="submit" style={{ padding: '0.5rem 1.25rem' }}>Submit</button>
          </form>
        ) : (
          <p style={{ marginBottom: '1.5rem', color: '#888' }}>
            <Link to="/login">Log in</Link> to submit suggestions.
          </p>
        )}

        <hr style={{ borderColor: '#2a2a2a', marginBottom: '1.5rem' }} />

        {/* Suggestions List */}
        {filtered.length === 0 ? (
          <p style={{ color: '#666' }}>No {activeType} suggestions yet — be the first!</p>
        ) : (
          filtered.map(s => (
            <div key={s.id} style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
              borderBottom: '1px solid #2a2a2a',
              padding: '1rem 0'
            }}>

              {/* Vote Button */}
              <button
                onClick={() => handleVote(s)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.4rem 0.75rem',
                  background: userVotes[s.id] ? '#ff6b6b' : '#222',
                  border: `1px solid ${userVotes[s.id] ? '#ff6b6b' : '#444'}`,
                  borderRadius: '8px',
                  cursor: user ? 'pointer' : 'default',
                  minWidth: '50px',
                  flexShrink: 0
                }}
              >
                <span style={{ fontSize: '1rem' }}>▲</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{votes[s.id] || 0}</span>
              </button>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.25rem', color: '#ffd93d' }}>{s.title}</h4>
                {s.description && (
                  <p style={{ color: '#ccc', fontSize: '0.9rem', margin: '0 0 0.25rem' }}>{s.description}</p>
                )}
                <small>by {s.profiles?.username} · {new Date(s.created_at).toLocaleDateString()}</small>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}