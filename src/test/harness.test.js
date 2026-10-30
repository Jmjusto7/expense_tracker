import { db } from '../context/db'

describe('test database setup', () => {
  it('uses fake IndexedDB', async () => {
    await db.years.add({ year: 2026 })

    expect(await db.years.count()).toBe(1)
  })

  it('clears tables after each test', async () => {
    expect(await db.years.count()).toBe(0)
  })
})
