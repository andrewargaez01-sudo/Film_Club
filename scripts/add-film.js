#!/usr/bin/env node
/**
 * add-film.js
 * Search TMDB for a film and insert it into the Supabase films table.
 *
 * Usage:
 *   TMDB_API_KEY=your_key node scripts/add-film.js
 *
 * Optional env overrides:
 *   SUPABASE_URL=...   (defaults to the project URL)
 *   SUPABASE_KEY=...   (defaults to the anon key — swap for service role key if RLS blocks inserts)
 */

import readline from 'readline/promises'

const TMDB_KEY     = process.env.TMDB_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lkdhtdqxlcfsjiqqedph.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_HG__MG-zzB5vCNrCVMXCLw_inLZUN4Q'
const TMDB_BASE    = 'https://api.themoviedb.org/3'
const TMDB_IMG     = 'https://image.tmdb.org/t/p/w500'

if (!TMDB_KEY) {
  console.error('\nMissing TMDB_API_KEY.')
  console.error('Get a free key at https://developer.themoviedb.org/docs/getting-started')
  console.error('Then run: TMDB_API_KEY=your_key node scripts/add-film.js\n')
  process.exit(1)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

async function tmdb(path) {
  const res = await fetch(`${TMDB_BASE}${path}&api_key=${TMDB_KEY}`)
  if (!res.ok) throw new Error(`TMDB error ${res.status}: ${await res.text()}`)
  return res.json()
}

async function searchFilm(query) {
  const data = await tmdb(`/search/movie?query=${encodeURIComponent(query)}`)
  return data.results || []
}

async function getDetails(id) {
  return tmdb(`/movie/${id}?append_to_response=credits,videos`)
}

function extractCrew(credits) {
  const crew = credits?.crew || []
  const director      = crew.find(c => c.job === 'Director')?.name || null
  const writer        = crew.find(c => ['Screenplay', 'Writer', 'Story'].includes(c.job))?.name || null
  const cinematographer = crew.find(c => c.job === 'Director of Photography')?.name || null
  return { director, writer, cinematographer }
}

function extractTrailer(videos) {
  const trailer = (videos?.results || []).find(
    v => v.type === 'Trailer' && v.site === 'YouTube'
  )
  return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null
}

async function insertFilm(film) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/films`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(film)
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase insert failed (${res.status}): ${err}`)
  }
  return res.json()
}

async function main() {
  console.log('\n🎬  Add a Film to the Club\n')

  // 1. Search
  const query = await rl.question('Film name: ')
  const results = await searchFilm(query)

  if (results.length === 0) {
    console.log('No results found.')
    rl.close()
    return
  }

  // 2. Pick from results
  console.log('\nResults:')
  results.slice(0, 5).forEach((r, i) => {
    const year = r.release_date?.slice(0, 4) || '?'
    console.log(`  [${i + 1}] ${r.title} (${year})`)
  })

  const pick = parseInt(await rl.question('\nChoose a number: '), 10)
  if (!pick || pick < 1 || pick > Math.min(results.length, 5)) {
    console.log('Invalid selection.')
    rl.close()
    return
  }

  const chosen = results[pick - 1]
  console.log(`\nFetching details for "${chosen.title}"...`)

  // 3. Fetch full details
  const details = await getDetails(chosen.id)
  const { director, writer, cinematographer } = extractCrew(details.credits)
  const trailer_url = extractTrailer(details.videos)
  const poster_url  = details.poster_path ? `${TMDB_IMG}${details.poster_path}` : null

  console.log('\n--- Auto-filled from TMDB ---')
  console.log(`  Title:            ${details.title}`)
  console.log(`  Description:      ${details.overview?.slice(0, 80)}...`)
  console.log(`  Director:         ${director || '(not found)'}`)
  console.log(`  Writer:           ${writer || '(not found)'}`)
  console.log(`  Cinematographer:  ${cinematographer || '(not found)'}`)
  console.log(`  Poster:           ${poster_url || '(none)'}`)
  console.log(`  Trailer:          ${trailer_url || '(none)'}`)

  // 4. Club-specific fields
  console.log('\n--- Club Details ---')
  const month_year  = await rl.question('Month & year (e.g. March 2026): ')
  const week_number = parseInt(await rl.question('Week number (1–4): '), 10)
  const week_theme  = await rl.question('Week theme (optional, press enter to skip): ')
  const discussion_points = await rl.question('Discussion points (pipe-separated, optional): ')

  // 5. Allow overrides
  console.log('\n--- Overrides (press enter to keep auto-filled value) ---')
  const directorOverride = await rl.question(`Director [${director}]: `)
  const writerOverride   = await rl.question(`Writer [${writer}]: `)
  const cinemaOverride   = await rl.question(`Cinematographer [${cinematographer}]: `)

  const film = {
    title:           details.title,
    description:     details.overview || null,
    director:        directorOverride || director,
    writer:          writerOverride   || writer,
    cinematographer: cinemaOverride   || cinematographer,
    poster_url,
    trailer_url,
    month_year,
    week_number,
    week_theme:          week_theme          || null,
    discussion_points:   discussion_points   || null,
  }

  // 6. Confirm
  console.log('\n--- Ready to insert ---')
  console.log(JSON.stringify(film, null, 2))
  const confirm = await rl.question('\nInsert into Supabase? (y/n): ')

  if (confirm.toLowerCase() !== 'y') {
    console.log('Aborted.')
    rl.close()
    return
  }

  // 7. Insert
  const inserted = await insertFilm(film)
  console.log(`\n✅  "${film.title}" added to Week ${film.week_number} of ${film.month_year}!\n`)
  rl.close()
}

main().catch(err => {
  console.error('\n❌ ', err.message)
  rl.close()
  process.exit(1)
})
