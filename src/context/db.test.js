import Dexie from 'dexie'
import { db, defineSchema } from './db'

describe('schema v9', () => {
    it('migrates numeric ids to UUIDs and keeps references intact', async () => {
        const name = 'UpgradeTest'
        const legacy = defineSchema(new Dexie(name), { upToVersion: 8 })
        await legacy.open()
        const yearId = await legacy.years.add({ year: 2026 })
        const monthId = await legacy.months.add({ yearId, name: 'March' })
        const dayId = await legacy.days.add({ yearId, monthId, day: 5 })
        const accountId = await legacy.accounts.add({ name: 'Cash' })
        const txId = await legacy.transactions.add({ yearId, monthId, dayId, category: 'Food', amount: 10, accountId })
        await legacy.balanceEntries.add({ accountId, type: 'expense', amount: -10, sourceTransactionId: txId })
        legacy.close()

        const upgraded = defineSchema(new Dexie(name))
        await upgraded.open()
        const [year] = await upgraded.years.toArray()
        const [month] = await upgraded.months.toArray()
        const [day] = await upgraded.days.toArray()
        const [account] = await upgraded.accounts.toArray()
        const [tx] = await upgraded.transactions.toArray()
        const [entry] = await upgraded.balanceEntries.toArray()

        expect(typeof year.id).toBe('string')
        expect(month.yearId).toBe(year.id)
        expect(day).toMatchObject({ yearId: year.id, monthId: month.id })
        expect(tx).toMatchObject({ yearId: year.id, monthId: month.id, dayId: day.id, accountId: account.id })
        expect(entry).toMatchObject({ accountId: account.id, sourceTransactionId: tx.id })
        upgraded.close()
        await Dexie.delete(name)
    })

    it('gives new rows UUID ids', async () => {
        const id = await db.years.add({ year: 2030 })
        expect(id).toMatch(/^[0-9a-f-]{36}$/)
        expect((await db.years.get(id)).id).toBe(id)
    })
})
