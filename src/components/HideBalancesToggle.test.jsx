import { fireEvent, render, screen } from '@testing-library/react'
import HideBalancesToggle from './HideBalancesToggle'
import { setHideBalances } from '../hooks/useHideBalances'

describe('HideBalancesToggle', () => {
    afterEach(() => setHideBalances(false))

    it('hides and shows balances, remembering the choice', () => {
        render(<><HideBalancesToggle /><HideBalancesToggle /></>)
        const [first, second] = screen.getAllByLabelText('Hide balances')
        expect(first.getAttribute('aria-pressed')).toBe('false')

        fireEvent.click(first)

        expect(document.documentElement.hasAttribute('data-hide-balances')).toBe(true)
        expect(localStorage.getItem('tracker.hideBalances')).toBe('1')
        // Every toggle on screen follows the same setting.
        expect(second.getAttribute('aria-pressed')).toBe('true')
        expect(screen.getAllByLabelText('Show balances')).toHaveLength(2)

        fireEvent.click(second)
        expect(document.documentElement.hasAttribute('data-hide-balances')).toBe(false)
    })
})
