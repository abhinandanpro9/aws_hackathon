// A D1-shaped store that lives in one process, for `npm run serve` and tests.
// FLOW: node entry -> memoryDb() -> same D1Like interface app.ts uses -> in-process tables
// 1. the deployed path is real D1 (wrangler dev / deploy); this exists so the documented
//    local command runs with no Cloudflare account and no native dependency
// 2. it implements the exact statements app.ts issues, not general SQL -- an unrecognised
//    statement throws loudly rather than silently returning nothing
// 3. restarting the process clears it, which is what a single-process prototype should do
// WHY: Node 20 has no node:sqlite, and a native sqlite dep would be a build step for a
// person who only wants to run the thing.

import type { D1Like } from './db.js'

interface Row {
  [column: string]: unknown
}

type Table = Row[]

/** Normalise whitespace so a multi-line template literal matches a single-line pattern. */
function flat(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

function tableOf(sql: string): string | null {
  const match = /\b(?:FROM|INTO|UPDATE)\s+([a-z_]+)/i.exec(sql)
  return match?.[1] ?? null
}

/**
 * The statements app.ts and db.ts actually issue, executed against plain arrays.
 * Anything unrecognised throws: a store that quietly returns nothing would look like an
 * empty database and send someone hunting the wrong bug.
 */
export function memoryDb(): D1Like {
  const tables: Record<string, Table> = {
    policies: [],
    changes: [],
    conversations: [],
    policy_usage: [],
    near_misses: [],
    feedback: [],
    bookings: [],
    session_summaries: [],
    visits: [],
    activity: [],
  }

  function run(sql: string, values: readonly unknown[]): { results: Row[] } {
    const query = flat(sql)
    const name = tableOf(query)
    if (name === null || tables[name] === undefined) {
      throw new Error(`memoryDb: no table in statement: ${query.slice(0, 80)}`)
    }
    const table = tables[name] as Table

    if (query.startsWith('SELECT COUNT(*)')) {
      return { results: [{ n: table.length }] }
    }

    if (query.startsWith('SELECT COALESCE(MAX(seq)')) {
      const max = table.reduce((acc, row) => Math.max(acc, Number(row['seq'] ?? 0)), 0)
      return { results: [{ n: max }] }
    }

    if (query.startsWith('SELECT')) {
      let rows = [...table]

      const where = /WHERE ([a-z_]+) = \?/i.exec(query)
      if (where !== null) {
        const column = where[1] as string
        rows = rows.filter((row) => row[column] === values[0])
      }

      const order = /ORDER BY ([a-z_]+) (ASC|DESC)/i.exec(query)
      if (order !== null) {
        const column = order[1] as string
        const direction = order[2]?.toUpperCase() === 'DESC' ? -1 : 1
        rows.sort((a, b) => {
          const left = Number(a[column] ?? 0)
          const right = Number(b[column] ?? 0)
          return (left - right) * direction
        })
      }

      return { results: rows }
    }

    if (query.startsWith('DELETE')) {
      table.length = 0
      return { results: [] }
    }

    if (query.startsWith('INSERT')) {
      const columns = /\(([^)]+)\)\s*VALUES/i.exec(query)?.[1]
      if (columns === undefined) throw new Error(`memoryDb: no columns: ${query.slice(0, 80)}`)

      const names = columns.split(',').map((c) => c.trim())
      const row: Row = {}
      names.forEach((column, index) => {
        row[column] = values[index]
      })

      // ON CONFLICT DO UPDATE: the primary key is the first column in every such statement.
      const key = names[0] as string
      const existingIndex = table.findIndex((r) => r[key] === row[key])

      if (existingIndex >= 0 && /ON CONFLICT/i.test(query)) {
        const existing = table[existingIndex] as Row
        // times_used / times_asked accumulate rather than overwrite, matching the SQL.
        for (const counter of ['times_used', 'times_asked']) {
          if (query.includes(`${counter} = `) && query.includes(`${counter} + 1`)) {
            row[counter] = Number(existing[counter] ?? 0) + 1
          }
        }
        table[existingIndex] = { ...existing, ...row }
        return { results: [] }
      }

      table.push(row)
      return { results: [] }
    }

    if (query.startsWith('UPDATE')) {
      const assignments = /SET (.+) WHERE ([a-z_]+) = \?/i.exec(query)
      if (assignments === null) throw new Error(`memoryDb: bad UPDATE: ${query.slice(0, 80)}`)

      const columns = (assignments[1] as string)
        .split(',')
        .map((part) => part.split('=')[0]?.trim())
        .filter((part): part is string => part !== undefined)

      const keyColumn = assignments[2] as string
      const keyValue = values[values.length - 1]
      const index = table.findIndex((row) => row[keyColumn] === keyValue)
      if (index < 0) return { results: [] }

      const updated = { ...(table[index] as Row) }
      columns.forEach((column, position) => {
        updated[column] = values[position]
      })
      table[index] = updated
      return { results: [] }
    }

    throw new Error(`memoryDb: unsupported statement: ${query.slice(0, 80)}`)
  }

  function statement(sql: string, bound: readonly unknown[] = []) {
    return {
      bind: (...values: unknown[]) => statement(sql, values),
      first: async <T>(): Promise<T | null> => (run(sql, bound).results[0] as T) ?? null,
      all: async <T>(): Promise<{ results: T[] }> => ({ results: run(sql, bound).results as T[] }),
      run: async (): Promise<unknown> => run(sql, bound),
    }
  }

  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: unknown[]): Promise<unknown> => {
      for (const item of statements) {
        await (item as { run: () => Promise<unknown> }).run()
      }
      return []
    },
  }
}
