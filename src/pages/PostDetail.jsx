import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function PostDetail() {
  const { id } = useParams()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [body, setBody] = useState('')
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

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

  if (!post) return <p style={{ padding: '2rem' }}>Loading...</p>

  return (
    <div style={{
      background: '#1a1a2e',
      borderRadius: '12px',
      padding: '1.5rem',
      border: '1px solid #333'
    }}>
      <h2>{post.title}</h2>
      <p>{post.body}</p>
      <small style={{ color: '#888' }}>
        by {post.profiles?.username} · {new Date(post.created_at).toLocaleDateString()}
      </small>

      <hr style={{ margin: '2rem 0' }} />
      <h3>Comments</h3>

      {comments.length === 0 && <p>No comments yet.</p>}
      {comments.map(comment => (
        <div key={comment.id} style={{ borderBottom: '1px solid #eee', padding: '0.75rem 0' }}>
          <p style={{ margin: 0 }}>{comment.body}</p>
          <small style={{ color: '#888' }}>
            by {comment.profiles?.username} · {new Date(comment.created_at).toLocaleDateString()}
          </small>
        </div>
      ))}

      <div style={{ marginTop: '2rem' }}>
        {user ? (
          <form onSubmit={handleComment}>
            <textarea
              placeholder="Leave a comment..."
              value={body}
              onChange={e => setBody(e.target.value)}
              required
              rows={3}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
            />
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <button type="submit" style={{ padding: '0.5rem 1rem' }}>Comment</button>
          </form>
        ) : (
          <p>Please <a href="/login">log in</a> to comment.</p>
        )}
      </div>
    </div>
  )
}