import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AppRoutes from './routes'

it('shows Not Found for unknown URLs', () => {
    render(
        <MemoryRouter initialEntries={['/does-not-exist']}>
            <AppRoutes />
        </MemoryRouter>
    )

    expect(screen.getByText('Page not found')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to Home' }).getAttribute('href')).toBe('/')
})
