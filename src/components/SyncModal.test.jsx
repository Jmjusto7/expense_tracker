import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SyncModal from './SyncModal'

const ctx = vi.hoisted(() => ({ planSync: vi.fn(), commitSync: vi.fn() }))
vi.mock('../context/ExpenseContext', () => ({ useExpenseContext: () => ctx }))

const emptyPlan = { conflicts: [], result: {}, summary: {} }

const prepared = {
    merge: {
        recordConflicts: [
            {
                id: 'travels:t1',
                table: 'travels',
                kind: 'edit',
                local: { id: 't1', title: 'Tokyo A' },
                remote: { id: 't1', title: 'Tokyo B' },
            },
        ],
    },
}

describe('SyncModal', () => {
    beforeEach(() => {
        ctx.planSync.mockReset().mockReturnValue(emptyPlan)
        ctx.commitSync.mockReset().mockResolvedValue({ summary: {} })
    })

    it('requires a choice, then commits with it', async () => {
        const onDone = vi.fn()
        render(<SyncModal prepared={prepared} onCancel={() => { }} onDone={onDone} />)

        expect(screen.getByText('This device: Tokyo A')).toBeTruthy()
        expect(screen.getByText('Other device: Tokyo B')).toBeTruthy()
        const syncButton = screen.getByRole('button', { name: 'Sync' })
        expect(syncButton.disabled).toBe(true)

        fireEvent.click(screen.getByLabelText("Keep the other device's version"))
        fireEvent.click(syncButton)

        await waitFor(() => expect(onDone).toHaveBeenCalledWith({}))
        expect(ctx.commitSync).toHaveBeenCalledWith(prepared, { 'travels:t1': 'remote' }, {})
    })

    it('shows a commit error and stays open', async () => {
        ctx.commitSync.mockRejectedValue(new Error('Google Drive was updated from another device during this sync. Please sync again.'))
        const onDone = vi.fn()
        render(<SyncModal prepared={prepared} onCancel={() => { }} onDone={onDone} />)

        fireEvent.click(screen.getByLabelText("Keep this device's version"))
        fireEvent.click(screen.getByRole('button', { name: 'Sync' }))

        expect(await screen.findByText(/updated from another device/)).toBeTruthy()
        expect(onDone).not.toHaveBeenCalled()
    })
})
