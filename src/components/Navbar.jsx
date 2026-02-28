import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Navbar() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  async function fetchUsername(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()
    if (data) setUsername(data.username)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUsername(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUsername(session.user.id)
      else setUsername(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const links = [
    { to: '/', label: 'Home', icon: '🏠' },
    { to: '/film-of-the-month', label: 'Films', icon: '🎬' },
    { to: '/discussion', label: 'Discussion', icon: '💬' },
    { to: '/suggestions', label: 'Suggestions', icon: '💡' },
  ]

  return (
    <div className="sidebar">

      {/* Logo - desktop only */}
      <div className="sidebar-logo">
        <h2 style={{ color: '#ffd93d', margin: 0, fontSize: '1.2rem' }}>Double Feature<br /> Film Club</h2>
      </div>

      {/* Nav Links */}
      <nav className="sidebar-nav">
        {links.map(link => {
          const isActive = location.pathname === link.to
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar-nav-link${isActive ? ' active-link' : ''}`}
              style={{
                color: isActive ? '#ffd93d' : '#ccc',
                background: isActive ? 'rgba(255,107,107,0.15)' : 'transparent',
                borderLeft: isActive ? '3px solid #ff6b6b' : '3px solid transparent',
              }}
            >
              <span>{link.icon}</span>
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

      {/* User Section - desktop only */}
      <div className="sidebar-user">
        {user ? (
          <>
            <p style={{ color: '#6bcb77', fontWeight: 'bold', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
              👤 {username}
            </p>
            <button
              onClick={handleLogout}
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.9rem' }}
            >
              Logout
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link to="/login" style={{ color: '#ccc', fontSize: '0.9rem' }}>🔑 Login</Link>
            <Link to="/register" style={{ color: '#ccc', fontSize: '0.9rem' }}>📝 Register</Link>
          </div>
        )}
      </div>
    </div>
  )
}
