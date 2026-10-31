import { act, renderHook, waitFor, screen } from '@testing-library/react'
import { db } from './db'
import { ExpenseProvider, useExpenseContext } from './ExpenseContext'
import { SyncProvider, useSync } from './SyncContext'
import { buildSnapshot } from '../sync/snapshot'
import * as auth from '../sync/googleAuth'
import * as drive from '../sync/driveClient'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

const store = vi.hoisted(() => ({ file: null }))

vi.mock('../sync/googleAuth', () => ({
    isSyncConfigured: () => true,
    preloadGoogleSignIn: vi.fn(async () => { }),
    hasValidToken: vi.fn(() => true),
    getAccessToken: vi.fn(async () => 'tok'),
    clearAccessToken: vi.fn(),
    revokeAccess: vi.fn(async () => { }),
}))

vi.mock('../sync/driveClient', async (importOriginal) => {
    const actual = await importOriginal()
    const save = (id, content) => {
        store.file = { id, version: String(Number(store.file?.version ?? 0) + 1), content }
        return { id, version: store.file.version }
    }
    return {
        ...actual,
        findSyncFile: vi.fn(async () => store.file && { id: store.file.id, version: store.file.version }),
        downloadFile: vi.fn(async () => store.file.content),
        getFileVersion: vi.fn(async () => store.file.version),
        createSyncFile: vi.fn(async (_token, content) => save('file-1', content)),
        updateSyncFile: vi.fn(async (_token, id, content) => save(id, content)),
    }
})

const wrapper = ({ children }) => (
    <ExpenseProvider>
        <SyncProvider>{children}</SyncProvider>
    </ExpenseProvider>
)

async function renderSync() {
    const rendered = renderHook(() => ({ sync: useSync(), expense: useExpenseContext() }), { wrapper })
    await waitFor(() => expect(rendered.result.current.expense.isLoaded).toBe(true))
    return rendered
}

const goOnline = () => act(async () => window.dispatchEvent(new Event('online')))

function setOnline(value) {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

beforeEach(() => {
    store.file = null
    setOnline(true)
    vi.mocked(auth.hasValidToken).mockReturnValue(true)
    vi.mocked(auth.getAccessToken).mockClear()
    vi.mocked(drive.findSyncFile).mockClear()
})

describe('auto-sync', () => {
    it('syncs pending changes when the connection comes back', async () => {
        await db.travels.add({ title: 'Tokyo' })
        const { result } = await renderSync()
        await waitFor(() => expect(result.current.sync.status).toBe('pending'))

        await goOnline()

        await waitFor(() => expect(result.current.sync.status).toBe('synced'))
        expect(JSON.parse(store.file.content).tables.travels.map((t) => t.title)).toEqual(['Tokyo'])
    })

    it('never opens Google sign-in without a valid token', async () => {
        vi.mocked(auth.hasValidToken).mockReturnValue(false)
        await db.travels.add({ title: 'Tokyo' })
        const { result } = await renderSync()
        await waitFor(() => expect(result.current.sync.status).toBe('tap-to-sync'))

        await goOnline()

        expect(auth.getAccessToken).not.toHaveBeenCalled()
        expect(store.file).toBeNull()
    })

    it('does nothing while offline', async () => {
        setOnline(false)
        await db.travels.add({ title: 'Tokyo' })
        const { result } = await renderSync()

        expect(result.current.sync.status).toBe('offline')
        await act(async () => document.dispatchEvent(new Event('visibilitychange')))
        expect(drive.findSyncFile).not.toHaveBeenCalled()
    })

    it('does nothing when there is nothing to sync and it synced recently', async () => {
        const { result } = await renderSync()
        await act(async () => result.current.sync.startSync())
        await waitFor(() => expect(result.current.sync.status).toBe('synced'))
        vi.mocked(drive.findSyncFile).mockClear()

        await goOnline()

        expect(drive.findSyncFile).not.toHaveBeenCalled()
    })

    it('shows "Needs input" on conflicts instead of opening the dialog', async () => {
        const travelId = await db.travels.add({ title: 'Tokyo' })
        const { result } = await renderSync()
        await act(async () => result.current.sync.startSync())
        await waitFor(() => expect(result.current.sync.status).toBe('synced'))

        const remote = JSON.parse(store.file.content).tables
        remote.travels[0].title = 'Tokyo (other device)'
        store.file = { ...store.file, version: '99', content: JSON.stringify(buildSnapshot(remote)) }
        await act(async () => result.current.expense.updateTravel(travelId, { title: 'Tokyo (this device)' }))

        await goOnline()

        await waitFor(() => expect(result.current.sync.status).toBe('needs-input'))
        expect(screen.queryByText('Sync with Google Drive')).toBeNull()
    })

    it('runs one sync at a time', async () => {
        await db.travels.add({ title: 'Tokyo' })
        const { result } = await renderSync()
        await waitFor(() => expect(result.current.sync.status).toBe('pending'))

        await act(async () => {
            window.dispatchEvent(new Event('online'))
            window.dispatchEvent(new Event('online'))
        })

        await waitFor(() => expect(result.current.sync.status).toBe('synced'))
        expect(drive.findSyncFile).toHaveBeenCalledTimes(1)
    })
})

describe('useOnlineStatus', () => {
    it('follows online/offline events', async () => {
        const { result } = renderHook(() => useOnlineStatus())
        expect(result.current).toBe(true)

        await act(async () => window.dispatchEvent(new Event('offline')))
        expect(result.current).toBe(false)

        await act(async () => window.dispatchEvent(new Event('online')))
        expect(result.current).toBe(true)
    })
})
