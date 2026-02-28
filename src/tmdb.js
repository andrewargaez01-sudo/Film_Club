/**
 * TMDB API utility for the Film Club app.
 * Requires VITE_TMDB_API_KEY in .env
 *
 * Get a free key at: https://developer.themoviedb.org/docs/getting-started
 */

const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMG = 'https://image.tmdb.org/t/p'

/**
 * Build a full TMDB poster URL from a poster_path.
 * @param {string} path - e.g. "/xYz123.jpg"
 * @param {'w92'|'w154'|'w185'|'w342'|'w500'|'w780'|'original'} size
 */
export function posterUrl(path, size = 'w342') {
  if (!path) return null
  return `${TMDB_IMG}/${size}${path}`
}

/**
 * Search TMDB for movies matching a query.
 * Returns the top 8 results with id, title, year, and poster URL.
 */
export async function searchMovies(query) {
  if (!TMDB_KEY) {
    console.warn('TMDB API key not configured. Add VITE_TMDB_API_KEY to your .env file.')
    return []
  }
  if (!query || query.length < 2) return []

  const res = await fetch(
    `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`
  )
  if (!res.ok) return []

  const data = await res.json()
  return (data.results || []).slice(0, 8).map(m => ({
    id: m.id,
    title: m.title,
    year: m.release_date?.slice(0, 4) || '',
    posterPath: m.poster_path,
    posterUrl: posterUrl(m.poster_path),
  }))
}

/**
 * Fetch full movie details (credits, videos) from TMDB.
 */
export async function getMovieDetails(id) {
  if (!TMDB_KEY) return null

  const res = await fetch(
    `${TMDB_BASE}/movie/${id}?api_key=${TMDB_KEY}&append_to_response=credits,videos`
  )
  if (!res.ok) return null

  const data = await res.json()
  const crew = data.credits?.crew || []

  return {
    id: data.id,
    title: data.title,
    overview: data.overview,
    posterUrl: posterUrl(data.poster_path, 'w500'),
    director: crew.find(c => c.job === 'Director')?.name || null,
    writer: crew.find(c => ['Screenplay', 'Writer', 'Story'].includes(c.job))?.name || null,
    cinematographer: crew.find(c => c.job === 'Director of Photography')?.name || null,
    trailer: (data.videos?.results || []).find(
      v => v.type === 'Trailer' && v.site === 'YouTube'
    )?.key || null,
  }
}
