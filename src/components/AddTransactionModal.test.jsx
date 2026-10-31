import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AddTransactionModal from './AddTransactionModal'

const ctx = vi.hoisted(() => ({
    saveDayTransactions: vi.fn(),
    categories: ['Food'],
    travels: [
        { id: 't1', title: 'Tokyo', startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 10) },
    ],
    accounts: [{ id: 'a1', name: 'Wallet', unit: null }],
    years: [],
}))
vi.mock('../context/ExpenseContext', () => ({ useExpenseContext: () => ctx }))

describe('AddTransactionModal', () => {
    beforeEach(() => {
        ctx.saveDayTransactions.mockReset().mockResolvedValue({})
    })

    it('matches the trip by date and saves inline-validated rows', async () => {
        const onClose = vi.fn()
        render(<AddTransactionModal defaultDate="2026-10-05T00:00:00" onClose={onClose} />)

        expect(screen.getByLabelText('Travel, row 1').value).toBe('t1')
        expect(screen.getByText('Matched by date')).toBeTruthy()

        // Moving the date outside the trip clears the automatic match.
        fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-20' } })
        expect(screen.getByLabelText('Travel, row 1').value).toBe('')

        const save = () => fireEvent.click(screen.getByText('Save', { selector: 'button' }))
        save()
        expect(screen.getByText(/at least one item/).getAttribute('role')).toBe('alert')

        fireEvent.change(screen.getByLabelText('Category, row 1'), { target: { value: 'Food' } })
        fireEvent.change(screen.getByLabelText('Amount, row 1'), { target: { value: '120, 30' } })
        fireEvent.change(screen.getByLabelText('Paid from, row 1'), { target: { value: 'a1' } })
        save()

        await waitFor(() => expect(onClose).toHaveBeenCalled())
        const { date, upserts } = ctx.saveDayTransactions.mock.calls[0][0]
        expect(date).toEqual(new Date(2026, 9, 20))
        expect(upserts).toEqual([expect.objectContaining({ category: 'Food', amount: 150, accountId: 'a1', travelId: null })])
        expect(sessionStorage.getItem('tracker.lastPaidFrom')).toBe('a1')
    })

    it('keeps a hand-picked trip when the date changes', () => {
        render(<AddTransactionModal defaultTravelId="t1" defaultDate="2026-10-05T00:00:00" onClose={() => { }} />)
        fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-20' } })
        expect(screen.getByLabelText('Travel, row 1').value).toBe('t1')
    })
})
