import 'fake-indexeddb/auto'
import { afterEach, vi } from 'vitest'
import { db } from '../context/db'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, () => { }],
    offlineReady: [false, () => { }],
    updateServiceWorker: () => { },
  }),
}))

afterEach(async () => {
  sessionStorage.clear()
  await Promise.all(db.tables.map((table) => table.clear()))
})