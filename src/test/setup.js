import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { db } from '../context/db'

afterEach(async () => {
  sessionStorage.clear()
  await Promise.all(db.tables.map((table) => table.clear()))
})