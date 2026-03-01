import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import './Navbar.css'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_url, favorite_quote, favorite_movie')
      .eq('id', userId)
      .single()
    if (data) setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Re-fetch profile when it's updated from the Profile page
  useEffect(() => {
    function handleProfileUpdate() {
      if (user) fetchProfile(user.id)
    }
    window.addEventListener('profile-updated', handleProfileUpdate)
    return () => window.removeEventListener('profile-updated', handleProfileUpdate)
  }, [user])

  // Re-fetch profile on every page navigation to stay in sync
  useEffect(() => {
    if (user) fetchProfile(user.id)
  }, [location.pathname, user])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const links = [
    { to: '/', label: 'Home', icon: '🏠' },
    { to: '/film-of-the-month', label: 'Films', icon: '🎬' },
    { to: '/discussion', label: 'Discussion', icon: '💬' },
    { to: '/suggestions', label: 'Suggestions', icon: '💡' },
    { to: user ? '/profile' : '/register', label: user ? 'My Profile' : 'Register', icon: '👤' },
  ]

  const getInitials = (name) => {
    if (!name) return '?'
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <div className="sidebar">

      {/* Logo */}
      <div className="sidebar-logo">
        <h2>
          Double Feature
          <span>Film Club</span>
        </h2>
      </div>

      {/* Nav Links */}
      <nav className="sidebar-nav">
        {links.map(link => {
          const isActive = location.pathname === link.to
          const showAvatar = link.to === '/profile' && profile?.avatar_url
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">
                {showAvatar
                  ? <img src={profile.avatar_url} alt="avatar" className="nav-avatar-icon" />
                  : link.icon}
              </span>
              <span>{link.label}</span>
            </Link>
          )
        })}

        {/* Mobile-only auth link */}
        {user ? (
          <button onClick={handleLogout} className="mobile-only">
            <span>👤</span>
            <span>Logout</span>
          </button>
        ) : (
          <Link to="/login" className="mobile-only">
            <span>🔑</span>
            <span>Login</span>
          </Link>
        )}
      </nav>

      {/* User Section */}
      <div className="sidebar-user">
        {user ? (
          <>
            <Link to="/profile" className="sidebar-user-info" style={{ textDecoration: 'none' }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="sidebar-avatar-img" />
              ) : (
                <div className="sidebar-avatar">{getInitials(profile?.username)}</div>
              )}
              <div className="sidebar-user-text">
                <span className="sidebar-username">{profile?.username}</span>
                {profile?.favorite_quote && (
                  <span className="sidebar-quote">"{profile.favorite_quote}"</span>
                )}
              </div>
            </Link>
            <button onClick={handleLogout} className="sidebar-logout">
              Log out
            </button>
          </>
        ) : (
          <div className="sidebar-auth">
            <Link to="/login" className="sidebar-auth-link">
              <span className="sidebar-link-icon">🔑</span>
              <span>Login</span>
            </Link>
            <Link to="/register" className="sidebar-auth-link">
              <span className="sidebar-link-icon">📝</span>
              <span>Register</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
