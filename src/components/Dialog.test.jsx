import { fireEvent, render, screen } from '@testing-library/react'
import Dialog, { Field, inputClass } from './Dialog'

function renderDialog(props = {}) {
    const onClose = vi.fn()
    const onSubmit = vi.fn()
    render(
        <Dialog title="Test dialog" onClose={onClose} onSubmit={onSubmit} {...props}>
            <Field label="Name" htmlFor="name">
                <input id="name" className={inputClass} />
            </Field>
        </Dialog>
    )
    return { onClose, onSubmit }
}

describe('Dialog', () => {
    it('is a labelled modal that focuses the first field', () => {
        renderDialog()
        const dialog = screen.getByRole('dialog', { name: 'Test dialog' })
        expect(dialog.getAttribute('aria-modal')).toBe('true')
        expect(document.activeElement).toBe(screen.getByLabelText('Name'))
    })

    it('closes on Escape and submits on Ctrl+Enter', () => {
        const { onClose, onSubmit } = renderDialog()
        fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true })
        expect(onSubmit).toHaveBeenCalledTimes(1)
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('ignores keyboard shortcuts while busy and shows errors as alerts', () => {
        const { onClose, onSubmit } = renderDialog({ busy: true, error: 'Nope' })
        fireEvent.keyDown(document, { key: 'Enter', metaKey: true })
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onSubmit).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
        expect(screen.getByRole('alert').textContent).toBe('Nope')
        expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true)
    })

    it('only the top dialog reacts when stacked', () => {
        const outerClose = vi.fn()
        const innerClose = vi.fn()
        render(
            <Dialog title="Outer" onClose={outerClose}>
                <Dialog title="Inner" onClose={innerClose}>
                    <p>inner</p>
                </Dialog>
            </Dialog>
        )
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(innerClose).toHaveBeenCalledTimes(1)
        expect(outerClose).not.toHaveBeenCalled()
    })
})
