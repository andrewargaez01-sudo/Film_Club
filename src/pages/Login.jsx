import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate, Link } from 'react-router-dom'
import './Login.css'

const QUOTES = [
  { text: "Here's looking at you, kid.", film: "Casablanca" },
  { text: "May the Force be with you.", film: "Star Wars" },
  { text: "I'm gonna make him an offer he can't refuse.", film: "The Godfather" },
  { text: "After all, tomorrow is another day!", film: "Gone with the Wind" },
  { text: "You talking to me?", film: "Taxi Driver" },
  { text: "I see dead people.", film: "The Sixth Sense" },
  { text: "Life is like a box of chocolates.", film: "Forrest Gump" },
  { text: "Frankly, my dear, I don't give a damn.", film: "Gone with the Wind" },
  { text: "You can't handle the truth!", film: "A Few Good Men" },
  { text: "I'll be back.", film: "The Terminator" },
  { text: "To infinity and beyond!", film: "Toy Story" },
  { text: "Why so serious?", film: "The Dark Knight" },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const [mounted, setMounted] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMessage, setResetMessage] = useState(null)
  const [resetError, setResetError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      return
    }

    // If no profile row exists yet (e.g. email-confirmed user), create it now
    const userId = data.user.id
    const username = data.user.user_metadata?.username || data.user.email?.split('@')[0] || 'user'
    await supabase
      .from('profiles')
      .upsert({ id: userId, username }, { onConflict: 'id', ignoreDuplicates: true })

    navigate('/')
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setResetError(null)
    setResetMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + '/login',
    })
    if (error) {
      setResetError(error.message)
    } else {
      setResetMessage('Password reset email sent! Check your inbox.')
    }
  }

  return (
    <div className={`auth-page ${mounted ? 'mounted' : ''}`}>
      <div className="auth-film-strip left" />
      <div className="auth-film-strip right" />

      <div className="auth-container">
        <div className="auth-quote">
          <p className="auth-quote-text">"{quote.text}"</p>
          <p className="auth-quote-film">— {quote.film}</p>
        </div>

        <div className="auth-card login-card">
          <div className="auth-card-glow" />

          {!resetMode ? (
            <>
              <h2>Welcome Back</h2>
              <p className="auth-subtitle">Sign in to the Film Club</p>

              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="auth-label">Email</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="auth-label">Password</label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="error-msg">{error}</p>}
                <button type="submit" className="submit-btn">Log In</button>
              </form>

              <button
                className="auth-forgot"
                onClick={() => { setResetMode(true); setError(null) }}
              >
                Forgot your password?
              </button>

              <p className="auth-switch">
                Don't have an account? <Link to="/register">Join the Club</Link>
              </p>
            </>
          ) : (
            <>
              <h2>Reset Password</h2>
              <p className="auth-subtitle">Enter your email and we'll send you a reset link.</p>

              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label className="auth-label">Email</label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {resetError && <p className="error-msg">{resetError}</p>}
                {resetMessage && <p className="success-msg">{resetMessage}</p>}
                <button type="submit" className="submit-btn">Send Reset Link</button>
              </form>

              <button
                className="auth-forgot"
                onClick={() => { setResetMode(false); setResetError(null); setResetMessage(null) }}
              >
                Back to login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
