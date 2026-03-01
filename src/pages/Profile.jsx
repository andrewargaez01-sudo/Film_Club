import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { searchMovies } from '../tmdb'
import './Profile.css'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [quote, setQuote] = useState('')
  const [saveError, setSaveError] = useState(null)

  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate('/login')
        return
      }
      fetchProfile(session.user.id)
    })
  }, [])

  async function fetchProfile(userId) {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url, favorite_quote, favorite_movie')
      .eq('id', userId)
      .single()
    setProfile(data)
    if (data) {
      setQuote(data.favorite_quote || '')
      if (data.avatar_url && data.favorite_movie) {
        setSelectedMovie({ title: data.favorite_movie, posterUrl: data.avatar_url })
      }
    }
    setLoading(false)

    // Auto-open edit mode if profile has no avatar (fresh signup)
    if (data && !data.avatar_url) {
      setEditing(true)
    }
  }

  // Debounced TMDB search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      const results = await searchMovies(searchQuery)
      setSearchResults(results)
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  function handleSelectMovie(movie) {
    setSelectedMovie(movie)
    setSearchQuery('')
    setSearchResults([])
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)

    // Validate the token server-side to ensure auth.uid() works in RLS
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      setSaveError('Authentication error. Please log in again.')
      setSaving(false)
      return
    }

    const updates = {
      favorite_quote: quote.trim() || null,
    }
    if (selectedMovie?.posterUrl) {
      updates.avatar_url = selectedMovie.posterUrl
      updates.favorite_movie = selectedMovie.title
    }
    const { data: saved, error } = await supabase
      .from('profiles')
      .upsert({ id: authUser.id, ...updates }, { onConflict: 'id' })
      .select()
    if (error) {
      console.error('Profile save error:', error)
      setSaveError(error.message)
    } else if (!saved || saved.length === 0) {
      setSaveError('Save failed — no rows were updated. Check Supabase row-level security settings.')
    } else {
      setProfile(prev => ({ ...prev, ...updates }))
      setEditing(false)
      window.dispatchEvent(new Event('profile-updated'))
    }
    setSaving(false)
  }

  function handleCancel() {
    // Reset edit state to saved values
    setQuote(profile?.favorite_quote || '')
    if (profile?.avatar_url && profile?.favorite_movie) {
      setSelectedMovie({ title: profile.favorite_movie, posterUrl: profile.avatar_url })
    } else {
      setSelectedMovie(null)
    }
    setSearchQuery('')
    setSearchResults([])
    setEditing(false)
  }

  function getInitials(name) {
    if (!name) return '?'
    return name.slice(0, 2).toUpperCase()
  }

  if (loading) {
    return <div className="page"><p style={{ color: 'rgba(255,255,255,0.3)' }}>Loading...</p></div>
  }

  return (
    <div className="page prof-page">
      <div className="prof-card">

        {!editing ? (
          /* ── View Mode ── */
          <div className="prof-view">
            <div className="prof-avatar-wrap">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="prof-avatar" />
              ) : (
                <div className="prof-avatar-fallback">
                  {getInitials(profile?.username)}
                </div>
              )}
            </div>

            <h2 className="prof-username">{profile?.username}</h2>

            {profile?.favorite_movie && (
              <p className="prof-movie">{profile.favorite_movie}</p>
            )}

            {profile?.favorite_quote && (
              <p className="prof-quote">"{profile.favorite_quote}"</p>
            )}

            {!profile?.avatar_url && !profile?.favorite_quote && (
              <p className="prof-empty-hint">
                You haven't set up your profile yet. Pick a favorite movie and add a quote!
              </p>
            )}

            <button className="prof-edit-btn" onClick={() => setEditing(true)}>
              Edit Profile
            </button>
          </div>
        ) : (
          /* ── Edit Mode ── */
          <div className="prof-edit">
            <h2>Set Up Your Profile</h2>
            <p className="prof-edit-subtitle">
              Pick a movie to represent you and add your favorite quote.
            </p>

            {/* Current Selection */}
            {selectedMovie && (
              <div className="prof-selected">
                <img src={selectedMovie.posterUrl} alt={selectedMovie.title} className="prof-selected-poster" />
                <div className="prof-selected-info">
                  <p className="prof-selected-title">{selectedMovie.title}</p>
                  <button
                    type="button"
                    className="prof-selected-change"
                    onClick={() => setSelectedMovie(null)}
                  >Change</button>
                </div>
              </div>
            )}

            {/* Movie Search */}
            {!selectedMovie && (
              <div className="prof-search">
                <label className="prof-label">Search for a movie</label>
                <input
                  type="text"
                  placeholder="Type a movie name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searching && (
                  <p className="prof-search-status">Searching...</p>
                )}
                {searchResults.length > 0 && (
                  <div className="prof-search-grid">
                    {searchResults.map(movie => (
                      <button
                        key={movie.id}
                        className="prof-search-result"
                        onClick={() => handleSelectMovie(movie)}
                      >
                        {movie.posterUrl ? (
                          <img src={movie.posterUrl} alt={movie.title} />
                        ) : (
                          <div className="prof-search-no-poster">No Poster</div>
                        )}
                        <span className="prof-search-result-title">
                          {movie.title}
                          {movie.year && <small> ({movie.year})</small>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                  <p className="prof-search-status">No results found.</p>
                )}
              </div>
            )}

            {/* Quote Input */}
            <div className="prof-quote-section">
              <label className="prof-label">Favorite movie quote</label>
              <textarea
                placeholder="Share a memorable line from a film..."
                value={quote}
                onChange={e => setQuote(e.target.value)}
                rows={2}
                maxLength={200}
              />
              <small className="prof-char-count">{quote.length}/200</small>
            </div>

            {saveError && <p className="error-msg">{saveError}</p>}

            {/* Actions */}
            <div className="prof-actions">
              <button className="prof-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button className="prof-cancel-btn" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
