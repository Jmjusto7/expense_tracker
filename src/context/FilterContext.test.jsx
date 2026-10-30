import { act, renderHook, waitFor } from '@testing-library/react'
import { db } from './db'
import { ExpenseProvider, useExpenseContext } from './ExpenseContext'
import { FilterProvider, useFilter, FILTER_STORAGE_KEY } from './FilterContext'
import { TRAVEL_FILTER_ID } from '../utils/travelHelpers'

const wrapper = ({ children }) => (
    <ExpenseProvider>
        <FilterProvider>{children}</FilterProvider>
    </ExpenseProvider>
)

async function seed({ travel = true } = {}) {
    const yearId = await db.years.add({ year: 2026 })
    const monthId = await db.months.add({ yearId, name: 'March' })
    const dayId = await db.days.add({ yearId, monthId, day: 5 })
    const travelId = await db.travels.add({ title: 'Tokyo' })
    const bucketId = await db.buckets.add({ name: 'Needs' })
    await db.bucketAssignments.add({ bucketId, category: 'Food' })
    await db.transactions.add({
        yearId,
        monthId,
        dayId,
        category: 'Food',
        amount: 10,
        travelId: travel ? String(travelId) : null,
    })
    return { bucketId }
}

async function renderFilters() {
    const rendered = renderHook(() => ({ filter: useFilter(), expense: useExpenseContext() }), { wrapper })
    await waitFor(() => {
        expect(rendered.result.current.expense.allTransactions).toHaveLength(1)
        expect(rendered.result.current.filter.buckets).toHaveLength(1)
    })
    return rendered
}

describe('FilterContext', () => {
    it('re-evaluates matches when the travel drill-down bucket changes', async () => {
        const { bucketId } = await seed()
        const { result } = await renderFilters()
        const [tx] = result.current.expense.allTransactions

        act(() => result.current.filter.setSelectedBucketIds([TRAVEL_FILTER_ID]))
        act(() => result.current.filter.setTravelDrillBucketId(bucketId))
        expect(result.current.filter.matches(tx)).toBe(true)

        act(() => result.current.filter.setTravelDrillBucketId('missing-bucket'))
        expect(result.current.filter.matches(tx)).toBe(false)
    })

    it('restores filters after the provider remounts', async () => {
        const { bucketId } = await seed({ travel: false })
        const first = await renderFilters()
        act(() => {
            first.result.current.filter.setFromDate(new Date(2026, 0, 1))
            first.result.current.filter.setSelectedBucketIds([bucketId])
            first.result.current.filter.setSelectedCategoryFilters(['Food'])
        })
        first.unmount()

        const second = await renderFilters()

        expect(second.result.current.filter.fromDate).toEqual(new Date(2026, 0, 1))
        expect(second.result.current.filter.selectedBucketIds).toEqual([bucketId])
        expect(second.result.current.filter.selectedCategoryFilters).toEqual(['Food'])
    })

    it('clearFilters removes the stored filters', async () => {
        await seed()
        const { result } = await renderFilters()
        act(() => result.current.filter.setFromDate(new Date(2026, 0, 1)))
        expect(sessionStorage.getItem(FILTER_STORAGE_KEY)).not.toBeNull()

        act(() => result.current.filter.clearFilters())

        expect(sessionStorage.getItem(FILTER_STORAGE_KEY)).toBeNull()
    })

    it('ignores malformed stored filters', async () => {
        sessionStorage.setItem(FILTER_STORAGE_KEY, '{not json')
        await seed()
        const { result } = await renderFilters()

        expect(result.current.filter.hasActiveFilters).toBe(false)
    })
})
