import { act } from '@testing-library/react'
import { db } from './db'
import { renderExpenseContext } from '../test/renderContext'
import { buildSnapshot } from '../sync/snapshot'

const store = vi.hoisted(() => ({ file: null }))

vi.mock('../sync/googleAuth', () => ({
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

const remoteTables = () => JSON.parse(store.file.content).tables
const writeRemote = (tables) => {
    store.file = { ...store.file, version: String(Number(store.file.version) + 1), content: JSON.stringify(buildSnapshot(tables)) }
}

async function sync(result, recordResolutions = {}, planResolutions = {}) {
    const prepared = await result.current.prepareSync()
    await act(async () => result.current.commitSync(prepared, recordResolutions, planResolutions))
    return prepared
}

beforeEach(() => {
    store.file = null
})

describe('Google Drive sync', () => {
    it('uploads local data on the first sync, without shadow entries', async () => {
        const { result } = await renderExpenseContext()
        await act(async () => result.current.addTravel({ title: 'Tokyo', startDate: '2026-03-01', endDate: '2026-03-07' }))
        await act(async () =>
            result.current.saveDayTransactions({
                date: new Date(2026, 2, 5),
                upserts: [{ category: 'Food', amount: 10, accountId: await db.accounts.add({ name: 'Cash' }) }],
            })
        )

        await sync(result)

        const uploaded = remoteTables()
        expect(uploaded.travels.map((t) => t.title)).toEqual(['Tokyo'])
        expect(uploaded.transactions).toHaveLength(1)
        expect(uploaded.balanceEntries.filter((e) => e.type === 'expense')).toEqual([])
        expect(result.current.syncStatus.lastSyncedAt).toBeInstanceOf(Date)
    })

    it('pulls additions and deletions made on another device', async () => {
        const { result } = await renderExpenseContext()
        await act(async () => result.current.addTravel({ title: 'Tokyo', startDate: '2026-03-01', endDate: '2026-03-07' }))
        await sync(result)

        const remote = remoteTables()
        remote.travels = [{ id: 'other-device-trip', title: 'Cebu', startDate: '2026-05-01T00:00:00.000Z', endDate: '2026-05-03T00:00:00.000Z' }]
        writeRemote(remote)

        const prepared = await sync(result)

        expect(prepared.merge.recordConflicts).toEqual([])
        expect((await db.travels.toArray()).map((t) => t.title)).toEqual(['Cebu'])
    })

    it('asks when the same record was edited on both devices', async () => {
        const { result } = await renderExpenseContext()
        const travelId = await act(async () =>
            result.current.addTravel({ title: 'Tokyo', startDate: '2026-03-01', endDate: '2026-03-07' })
        )
        await sync(result)

        const remote = remoteTables()
        remote.travels[0].title = 'Tokyo (other device)'
        writeRemote(remote)
        await act(async () => result.current.updateTravel(travelId, { title: 'Tokyo (this device)' }))

        const prepared = await result.current.prepareSync()
        expect(prepared.merge.recordConflicts.map((c) => c.id)).toEqual([`travels:${travelId}`])

        await act(async () => result.current.commitSync(prepared, { [`travels:${travelId}`]: 'remote' }))

        expect((await db.travels.get(travelId)).title).toBe('Tokyo (other device)')
        expect(remoteTables().travels[0].title).toBe('Tokyo (other device)')
    })

    it('rebuilds shadow entries for linked transactions pulled from Drive', async () => {
        const { result } = await renderExpenseContext()
        await sync(result)
        writeRemote({
            years: [{ id: 'y', year: 2026 }],
            months: [{ id: 'm', yearId: 'y', name: 'March' }],
            days: [{ id: 'd', yearId: 'y', monthId: 'm', day: 5 }],
            accounts: [{ id: 'a', name: 'Cash' }],
            transactions: [{ id: 't', yearId: 'y', monthId: 'm', dayId: 'd', category: 'Food', amount: 12, accountId: 'a' }],
        })

        await sync(result)

        const shadows = await db.balanceEntries.where({ type: 'expense' }).toArray()
        expect(shadows).toHaveLength(1)
        expect(shadows[0]).toMatchObject({ accountId: 'a', amount: -12, sourceTransactionId: 't' })
    })

    it('refuses to overwrite this device if it changed during the sync', async () => {
        const { result } = await renderExpenseContext()
        await sync(result)
        writeRemote({ travels: [{ id: 'remote-trip', title: 'Cebu' }] })
        const prepared = await result.current.prepareSync()
        await db.travels.add({ title: 'Added meanwhile' })

        await expect(result.current.commitSync(prepared)).rejects.toThrow(/changed during sync/)
        expect((await db.travels.toArray()).map((t) => t.title)).toEqual(['Added meanwhile'])
    })

    it('does not upload over a newer Drive version', async () => {
        const { result } = await renderExpenseContext()
        await sync(result)
        await act(async () => result.current.addTravel({ title: 'Tokyo', startDate: '2026-03-01', endDate: '2026-03-07' }))
        const prepared = await result.current.prepareSync()
        writeRemote(remoteTables())
        const versionBefore = store.file.version

        await expect(result.current.commitSync(prepared)).rejects.toThrow(/updated from another device/)
        expect(store.file.version).toBe(versionBefore)
    })

    it('skips the local rewrite and the upload when nothing changed', async () => {
        const { result } = await renderExpenseContext()
        await act(async () => result.current.addTravel({ title: 'Tokyo', startDate: '2026-03-01', endDate: '2026-03-07' }))
        await sync(result)
        const versionBefore = store.file.version
        const clearSpy = vi.spyOn(db.travels, 'clear')

        await sync(result)

        expect(store.file.version).toBe(versionBefore)
        expect(clearSpy).not.toHaveBeenCalled()
        clearSpy.mockRestore()
    })

    it('reports pending changes until they are uploaded', async () => {
        const { result } = await renderExpenseContext()
        expect(await result.current.hasPendingChanges()).toBe(false)

        await act(async () => result.current.addTravel({ title: 'Tokyo', startDate: '2026-03-01', endDate: '2026-03-07' }))
        expect(await result.current.hasPendingChanges()).toBe(true)

        await sync(result)
        expect(await result.current.hasPendingChanges()).toBe(false)

        await act(async () => result.current.updateTravel((await db.travels.toArray())[0].id, { title: 'Tokyo 2' }))
        const prepared = await result.current.prepareSync()
        const drive = await import('../sync/driveClient')
        drive.updateSyncFile.mockRejectedValueOnce(new Error('network down'))
        await expect(result.current.commitSync(prepared)).rejects.toThrow('network down')
        expect(await result.current.hasPendingChanges()).toBe(true)
    })

    it('treats a different Drive file as a first sync instead of deleting local data', async () => {
        const { result } = await renderExpenseContext()
        await act(async () => result.current.addTravel({ title: 'Tokyo', startDate: '2026-03-01', endDate: '2026-03-07' }))
        await sync(result)
        store.file = { id: 'another-account-file', version: '1', content: JSON.stringify(buildSnapshot({})) }

        await sync(result)

        expect(await db.travels.count()).toBe(1)
    })
})
