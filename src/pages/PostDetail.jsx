import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import './PostDetail.css'

function parsePostTag(title) {
  const match = title?.match(/^\[(.*?)\]\s*/)
  if (!match) return { tag: null, cleanTitle: title }
  return { tag: match[1], cleanTitle: title.slice(match[0].length) }
}

export default function PostDetail() {
  const { id } = useParams()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [contextFilms, setContextFilms] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    fetchPost()
    fetchComments()
  }, [])

  async function fetchPost() {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(username)')
      .eq('id', id)
      .single()
    setPost(data)
    if (data) fetchContextFilms(data)
  }

  async function fetchContextFilms(post) {
    const { tag } = parsePostTag(post.title)
    if (!tag) return
    // Fetch the films for this week to show context
    const { data } = await supabase
      .from('films')
      .select('title, poster_url, director')
      .eq('month_year', post.month_year)
      .eq('week_number', post.week_number)
      .order('created_at', { ascending: true })
    if (data) setContextFilms(data)
  }

  async function fetchComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username)')
      .eq('post_id', id)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function handleComment(e) {
    e.preventDefault()
    if (!user) return setError('You must be logged in to comment.')
    const { error } = await supabase
      .from('comments')
      .insert({ user_id: user.id, post_id: id, body })
    if (error) {
      setError(error.message)
    } else {
      setBody('')
      fetchComments()
    }
  }

  if (!post) return <p style={{ padding: '2rem', color: 'rgba(255,255,255,0.3)' }}>Loading...</p>

  const { tag, cleanTitle } = parsePostTag(post.title)

  return (
    <div className="post-detail">
      <div className="post-detail-card">

        {/* Film Context Banner */}
        {tag && contextFilms.length > 0 && (
          <div className="post-context-banner">
            {tag === 'VS' ? (
              // Show both films for comparison posts
              <div className="post-context-vs">
                {contextFilms.map((film, i) => (
                  <div key={i} className="post-context-film">
                    {film.poster_url && (
                      <img src={film.poster_url} alt={film.title} className="post-context-poster" />
                    )}
                    <div>
                      <p className="post-context-title">{film.title}</p>
                      {film.director && <p className="post-context-director">{film.director}</p>}
                    </div>
                  </div>
                ))}
                <span className="post-context-vs-badge">VS</span>
              </div>
            ) : (
              // Show the specific film being discussed
              contextFilms.filter(f => f.title === tag).map((film, i) => (
                <div key={i} className="post-context-film">
                  {film.poster_url && (
                    <img src={film.poster_url} alt={film.title} className="post-context-poster" />
                  )}
                  <div>
                    <p className="post-context-title">{film.title}</p>
                    {film.director && <p className="post-context-director">Dir. {film.director}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Post Tag */}
        {tag && (
          <span className={`post-tag ${tag === 'VS' ? 'vs' : 'film'}`}>
            {tag === 'VS' ? 'Comparing Both' : tag}
          </span>
        )}

        <h2>{cleanTitle}</h2>
        <p>{post.body}</p>
        <small className="post-detail-meta">
          by {post.profiles?.username} · {new Date(post.created_at).toLocaleDateString()}
        </small>

        <hr className="divider" style={{ margin: '2rem 0' }} />

        <div className="post-comments">
          <h3>Comments ({comments.length})</h3>

          {comments.length === 0 && <p style={{ color: 'rgba(255,255,255,0.25)' }}>No comments yet.</p>}
          {comments.map(comment => (
            <div key={comment.id} className="post-comment">
              <p>{comment.body}</p>
              <small>
                by {comment.profiles?.username} · {new Date(comment.created_at).toLocaleDateString()}
              </small>
            </div>
          ))}

          <div className="post-comment-form">
            {user ? (
              <form onSubmit={handleComment}>
                <textarea
                  placeholder="Leave a comment..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  required
                  rows={3}
                />
                {error && <p className="error-msg">{error}</p>}
                <button type="submit">Comment</button>
              </form>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.35)' }}>
                <Link to="/login">Log in</Link> to comment.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
