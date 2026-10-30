import { act } from '@testing-library/react'
import { db } from './db'
import { renderExpenseContext } from '../test/renderContext'

describe('removeAccount', () => {
    it('detaches surviving transfer legs without changing their amount', async () => {
        const sourceId = await db.accounts.add({ name: 'Source' })
        const counterpartId = await db.accounts.add({ name: 'Counterpart' })
        const transferGroupId = 'transfer-1'
        const entryId = await db.balanceEntries.add({
            accountId: counterpartId,
            date: new Date('2026-01-01'),
            type: 'transfer',
            amount: 40,
            transferGroupId,
            counterpartAccountId: sourceId,
            comments: 'Moved funds',
        })
        await db.balanceEntries.add({
            accountId: sourceId,
            date: new Date('2026-01-01'),
            type: 'transfer',
            amount: -40,
            transferGroupId,
            counterpartAccountId: counterpartId,
        })
        const { result } = await renderExpenseContext()

        await act(async () => result.current.removeAccount(sourceId))

        const survivingEntry = await db.balanceEntries.get(entryId)
        expect(survivingEntry.amount).toBe(40)
        expect(survivingEntry.counterpartAccountId).toBeNull()
        expect(survivingEntry.transferGroupId).toBeNull()
        expect(survivingEntry.comments).toContain("(counterpart account 'Source' deleted)")
    })

    it('blocks deletion when another account is priced in it', async () => {
        const accountId = await db.accounts.add({ name: 'Currency account' })
        await db.accounts.add({ name: 'Investment', costCurrencyAccountId: accountId })
        const { result } = await renderExpenseContext()

        await expect(result.current.removeAccount(accountId)).rejects.toThrow(
            "Can't delete: Investment are priced in this account. Reassign or delete them first."
        )
        expect(await db.accounts.get(accountId)).toBeTruthy()
    })

    it('rolls back earlier deletes if the account delete fails', async () => {
        const accountId = await db.accounts.add({ name: 'Account' })
        const entryId = await db.balanceEntries.add({
            accountId,
            date: new Date('2026-01-01'),
            type: 'income',
            amount: 10,
        })
        const { result } = await renderExpenseContext()
        const deleteSpy = vi.spyOn(db.accounts, 'delete').mockRejectedValue(new Error('forced failure'))

        await expect(result.current.removeAccount(accountId)).rejects.toThrow('forced failure')
        deleteSpy.mockRestore()

        expect(await db.accounts.get(accountId)).toBeTruthy()
        expect(await db.balanceEntries.get(entryId)).toBeTruthy()
    })

    it('removes the auto-logged fee transaction of a deleted transfer leg', async () => {
        const fromId = await db.accounts.add({ name: 'From', unit: null })
        const toId = await db.accounts.add({ name: 'To', unit: null })
        const { result } = await renderExpenseContext()
        await act(async () =>
            result.current.addTransfer(fromId, toId, { date: '2026-03-05', amount: 100, fee: 5, comments: '' })
        )
        expect(await db.transactions.count()).toBe(1)

        await act(async () => result.current.removeAccount(fromId))

        expect(await db.transactions.count()).toBe(0)
        const [incoming] = await db.balanceEntries.where({ accountId: toId }).toArray()
        expect(incoming.amount).toBe(95)
        expect(incoming.counterpartAccountId).toBeNull()
    })
})

async function seedDay() {
    const yearId = await db.years.add({ year: 2026 })
    const monthId = await db.months.add({ yearId, name: 'March' })
    const dayId = await db.days.add({ yearId, monthId, day: 5 })
    return { yearId, monthId, dayId }
}

async function snapshot() {
    return Object.fromEntries(await Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()])))
}

describe('saveDayTransactions', () => {
    it('creates the day from a date and merges same-category rows', async () => {
        const { result } = await renderExpenseContext()

        await act(async () =>
            result.current.saveDayTransactions({
                date: new Date(2026, 2, 5),
                upserts: [
                    { category: 'Food', amount: 10, amountBreakdown: [10], comments: 'a' },
                    { category: 'Food', amount: 5, amountBreakdown: [5], comments: 'b' },
                ],
            })
        )

        const [tx] = await db.transactions.toArray()
        expect(await db.transactions.count()).toBe(1)
        expect(tx.amount).toBe(15)
        expect(tx.amountBreakdown).toEqual([10, 5])
        expect(tx.comments).toBe('a; b')
        expect((await db.years.toArray())[0].year).toBe(2026)
    })

    it('lets existing rows swap categories', async () => {
        const ids = await seedDay()
        const foodId = await db.transactions.add({ ...ids, category: 'Food', amount: 1, amountBreakdown: [1] })
        const taxiId = await db.transactions.add({ ...ids, category: 'Taxi', amount: 2, amountBreakdown: [2] })
        const { result } = await renderExpenseContext()

        await act(async () =>
            result.current.saveDayTransactions({
                ...ids,
                upserts: [
                    { id: foodId, category: 'Taxi', amount: 1, amountBreakdown: [1] },
                    { id: taxiId, category: 'Food', amount: 2, amountBreakdown: [2] },
                ],
            })
        )

        expect((await db.transactions.get(foodId)).category).toBe('Taxi')
        expect((await db.transactions.get(taxiId)).category).toBe('Food')
    })

    it('removes the day when every row is deleted', async () => {
        const ids = await seedDay()
        const txId = await db.transactions.add({ ...ids, category: 'Food', amount: 1 })
        const { result } = await renderExpenseContext()

        await act(async () => result.current.saveDayTransactions({ ...ids, deletes: [txId] }))

        expect(await db.days.get(ids.dayId)).toBeUndefined()
    })

    it('writes nothing when a step fails', async () => {
        const ids = await seedDay()
        const accountId = await db.accounts.add({ name: 'Cash' })
        const txId = await db.transactions.add({ ...ids, category: 'Food', amount: 1, accountId })
        await db.balanceEntries.add({
            accountId,
            date: new Date(2026, 2, 5),
            type: 'expense',
            amount: -1,
            sourceTransactionId: txId,
        })
        const before = await snapshot()
        const { result } = await renderExpenseContext()
        const addSpy = vi.spyOn(db.transactions, 'add').mockRejectedValue(new Error('forced failure'))

        await expect(
            result.current.saveDayTransactions({
                ...ids,
                deletes: [txId],
                upserts: [{ category: 'Taxi', amount: 3 }],
            })
        ).rejects.toThrow('forced failure')
        addSpy.mockRestore()

        expect(await snapshot()).toEqual(before)
    })

    it('rejects rows in one session with different account tags', async () => {
        const cashId = await db.accounts.add({ name: 'Cash' })
        const bankId = await db.accounts.add({ name: 'Bank' })
        const { result } = await renderExpenseContext()

        await expect(
            result.current.saveDayTransactions({
                date: new Date(2026, 2, 5),
                upserts: [
                    { category: 'Food', amount: 1, accountId: cashId },
                    { category: 'Food', amount: 2, accountId: bankId },
                ],
            })
        ).rejects.toThrow(/Food on .* is already tagged to account 'Cash'/)

        expect(await db.transactions.count()).toBe(0)
        expect(await db.days.count()).toBe(0)
    })
})

describe('addTransaction tag conflicts', () => {
    it('throws and writes nothing when travel tags differ', async () => {
        const ids = await seedDay()
        const tripA = await db.travels.add({ title: 'Tokyo' })
        const tripB = await db.travels.add({ title: 'Cebu' })
        await db.transactions.add({ ...ids, category: 'Food', amount: 1, travelId: String(tripA) })
        const before = await snapshot()
        const { result } = await renderExpenseContext()

        await expect(
            result.current.addTransaction(ids.yearId, ids.monthId, ids.dayId, {
                category: 'Food',
                amount: 2,
                travelId: tripB,
            })
        ).rejects.toThrow(
            /Food on .* is already tagged to trip 'Tokyo'\. Use a different category or edit the existing entry\./
        )
        expect(await snapshot()).toEqual(before)
    })

    it('adopts the incoming tag when the existing row has none', async () => {
        const ids = await seedDay()
        const tripId = await db.travels.add({ title: 'Tokyo' })
        const txId = await db.transactions.add({ ...ids, category: 'Food', amount: 1, travelId: null })
        const { result } = await renderExpenseContext()

        await act(async () =>
            result.current.addTransaction(ids.yearId, ids.monthId, ids.dayId, {
                category: 'Food',
                amount: 2,
                travelId: tripId,
            })
        )

        const merged = await db.transactions.get(txId)
        expect(merged.amount).toBe(3)
        expect(merged.travelId).toBe(String(tripId))
    })
})

describe('addTransfer', () => {
    it('rejects a fee that is not less than the amount', async () => {
        const fromId = await db.accounts.add({ name: 'From', unit: null })
        const toId = await db.accounts.add({ name: 'To', unit: null })
        const { result } = await renderExpenseContext()

        await expect(
            result.current.addTransfer(fromId, toId, { date: '2026-03-05', amount: 10, fee: 10 })
        ).rejects.toThrow('The fee must be less than the transfer amount.')
        expect(await db.balanceEntries.count()).toBe(0)
    })

    it('writes nothing when logging the fee fails', async () => {
        const fromId = await db.accounts.add({ name: 'From', unit: null })
        const toId = await db.accounts.add({ name: 'To', unit: null })
        const { result } = await renderExpenseContext()
        const addSpy = vi.spyOn(db.transactions, 'add').mockRejectedValue(new Error('forced failure'))

        await expect(
            result.current.addTransfer(fromId, toId, { date: '2026-03-05', amount: 10, fee: 1 })
        ).rejects.toThrow('forced failure')
        addSpy.mockRestore()

        expect(await db.balanceEntries.count()).toBe(0)
        expect(await db.years.count()).toBe(0)
    })
})

const fileOf = (data) => new File([JSON.stringify(data)], 'export.json', { type: 'application/json' })

describe('import', () => {
    async function seedLinkedFood() {
        const ids = await seedDay()
        const accountId = await db.accounts.add({ name: 'Cash', unit: null, createdAt: new Date('2026-01-01') })
        const txId = await db.transactions.add({
            ...ids,
            category: 'Food',
            amount: 10,
            amountBreakdown: [10],
            comments: 'lunch',
            accountId,
            createdAt: new Date('2026-01-01'),
        })
        await db.balanceEntries.add({
            accountId,
            date: new Date(2026, 2, 5),
            type: 'expense',
            amount: -10,
            sourceTransactionId: txId,
            createdAt: new Date('2026-01-01'),
        })
        return { ...ids, accountId, txId }
    }

    it('re-importing its own export changes nothing', async () => {
        await seedLinkedFood()
        const before = await snapshot()
        const { result } = await renderExpenseContext()

        const { plan } = await result.current.parseImportFile(fileOf(before))
        await act(async () => result.current.commitImport(plan, {}))

        expect(await snapshot()).toEqual(before)
    })

    it('applies a merge resolution and regenerates the shadow entry', async () => {
        const { yearId, monthId, dayId, accountId, txId } = await seedLinkedFood()
        const { result } = await renderExpenseContext()
        const incoming = {
            transactions: [
                { id: 500, yearId, monthId, dayId, category: 'Food', amount: 25, amountBreakdown: [25], comments: 'dinner', createdAt: '2026-02-01' },
            ],
        }

        const { plan } = await result.current.parseImportFile(fileOf(incoming))
        expect(plan.conflicts).toHaveLength(1)
        await act(async () => result.current.commitImport(plan, { [plan.conflicts[0].id]: 'merge' }))

        const merged = await db.transactions.get(txId)
        expect(merged).toMatchObject({ amount: 35, amountBreakdown: [10, 25], comments: 'lunch; dinner', accountId })
        expect(await db.transactions.get(500)).toBeUndefined()
        const shadows = await db.balanceEntries.where({ type: 'expense' }).toArray()
        expect(shadows.map((e) => e.amount)).toEqual([-35])
    })

    it('writes nothing when the commit fails part-way', async () => {
        await seedLinkedFood()
        const before = await snapshot()
        const { result } = await renderExpenseContext()
        const { plan } = await result.current.parseImportFile(
            fileOf({ accounts: [{ id: 77, name: 'Bank', unit: null, createdAt: '2026-02-01' }] })
        )
        const putSpy = vi.spyOn(db.balanceEntries, 'bulkPut').mockRejectedValue(new Error('forced failure'))

        await expect(result.current.commitImport(plan, {})).rejects.toThrow('forced failure')
        putSpy.mockRestore()

        expect(await snapshot()).toEqual(before)
    })

    it('rejects files over 25 MB before reading them', async () => {
        const { result } = await renderExpenseContext()
        const file = { size: 25 * 1024 * 1024 + 1, text: vi.fn() }

        await expect(result.current.parseImportFile(file)).rejects.toThrow('too large')
        expect(file.text).not.toHaveBeenCalled()
    })
})
