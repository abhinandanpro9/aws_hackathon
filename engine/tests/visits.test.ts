import { describe, expect, it } from 'vitest'
import { memoryDb } from '../src/server/memory-db.js'
import { getVisits, recordVisit } from '../src/server/db.js'
import { app } from '../src/server/app.js'

// Who opened the demo, written down: ip, where from, what they loaded.
// FLOW: any /api request -> recordVisit -> a wrangler query
// 1. awaited inline: waitUntil dropped the promise on this runtime
// 2. this is a demo-visibility log for a prototype with no real users -- it records
//    reviewers, not families, and it ships nothing a request did not already carry

describe('visits persist', () => {
  it('round-trips a visit', async () => {
    const db = memoryDb()
    await recordVisit(db, {
      ip: '203.0.113.7',
      country: 'US',
      city: 'Denver',
      path: '/api/center',
      userAgent: 'Mozilla/5.0',
    })

    const visits = await getVisits(db)
    expect(visits.length).toBe(1)
    expect(visits[0]?.ip).toBe('203.0.113.7')
    expect(visits[0]?.path).toBe('/api/center')
  })

  it('tolerates a request with no ip or geo', async () => {
    const db = memoryDb()
    await recordVisit(db, { ip: null, country: null, city: null, path: '/api/stats', userAgent: null })
    const visits = await getVisits(db)
    expect(visits[0]?.ip).toBeNull()
  })
})

// A parent asking a question is a POST, so a GET-only gate recorded page loads and missed
// every conversation -- the one visit that answers "did the reviewer actually try it".
// FLOW: POST /api/ask -> middleware (any method) -> recordVisit -> visits row carries the ip
describe('visits cover every method', () => {
  it('records the ip of a POST, not just a GET', async () => {
    const db = memoryDb()

    await app.request(
      '/api/ask',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.9' },
        body: JSON.stringify({ question: 'what are your hours?' }),
      },
      { DB: db },
    )

    const visits = await getVisits(db)
    const ask = visits.find((v) => v.path === '/api/ask')
    expect(ask?.ip).toBe('198.51.100.9')
  })
})
