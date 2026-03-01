import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate, Link } from 'react-router-dom'
import './Register.css'

const QUOTES = [
  { text: "Every great film begins with a single frame.", film: "Anonymous" },
  { text: "In a world full of trends, I want to remain a classic.", film: "Iman" },
  { text: "Cinema is a mirror that can change the world.", film: "Robert Bresson" },
  { text: "A film is a petrified fountain of thought.", film: "Jean Cocteau" },
  { text: "Movies touch our hearts and awaken our vision.", film: "Martin Scorsese" },
  { text: "All you need for a movie is a gun and a girl.", film: "Jean-Luc Godard" },
  { text: "Film is one of the three universal languages.", film: "Frank Capra" },
  { text: "The cinema is truth twenty-four frames a second.", film: "Jean-Luc Godard" },
]

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const [mounted, setMounted] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  async function handleRegister(e) {
    e.preventDefault()
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, username })

    if (profileError) {
      setError(profileError.message)
    } else {
      setMessage('Account created! Setting up your profile...')
      setTimeout(() => navigate('/profile'), 1500)
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

        <div className="auth-card register-card">
          <div className="auth-card-glow" />
          <h2>Join the Film Club</h2>
          <p className="auth-subtitle">Create your account and start discussing</p>

          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="auth-label">Username</label>
              <input
                type="text"
                placeholder="Pick a username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
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
                placeholder="Create a password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="error-msg">{error}</p>}
            {message && <p className="success-msg">{message}</p>}
            <button type="submit" className="submit-btn">Create Account</button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
