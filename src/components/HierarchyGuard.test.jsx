import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { db } from '../context/db'
import { ExpenseProvider } from '../context/ExpenseContext'
import HierarchyGuard from './HierarchyGuard'

function CurrentPath() {
  const location = useLocation()
  return <div>{location.pathname}</div>
}

function renderGuard(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ExpenseProvider>
        <Routes>
          <Route path="/expenses/years" element={<CurrentPath />} />
          <Route
            path="/expenses/:year/:month"
            element={<HierarchyGuard><CurrentPath /></HierarchyGuard>}
          />
          <Route path="/assets/:accountId" element={<HierarchyGuard><CurrentPath /></HierarchyGuard>} />
          <Route path="/liabilities/:liabilityId" element={<HierarchyGuard><CurrentPath /></HierarchyGuard>} />
          <Route path="/travels/:travelId" element={<HierarchyGuard><CurrentPath /></HierarchyGuard>} />
          <Route path="/travels" element={<CurrentPath />} />
        </Routes>
      </ExpenseProvider>
    </MemoryRouter>
  )
}

describe('HierarchyGuard', () => {
  it('keeps a valid deep link after database hydration', async () => {
    const yearId = await db.years.add({ year: 2026 })
    const monthId = await db.months.add({ yearId, name: 'March' })
    await db.days.add({ yearId, monthId, day: 1 })

    renderGuard('/expenses/2026/March')

    expect(await screen.findByText('/expenses/2026/March')).toBeTruthy()
  })

  it('redirects an unknown year to the years view after loading', async () => {
    renderGuard('/expenses/2099/March')

    await waitFor(() => expect(screen.getByText('/expenses/years')).toBeTruthy())
  })

  it('keeps UUID account and travel links', async () => {
    const accountId = await db.accounts.add({ name: 'Cash' })
    const travelId = await db.travels.add({ title: 'Tokyo' })

    renderGuard(`/assets/${accountId}`)
    expect(await screen.findByText(`/assets/${accountId}`)).toBeTruthy()

    renderGuard(`/travels/${travelId}`)
    expect(await screen.findByText(`/travels/${travelId}`)).toBeTruthy()
  })

  it('moves a liability opened under /assets to its own route', async () => {
    const id = await db.accounts.add({ name: 'Card', isLiability: true })

    renderGuard(`/assets/${id}`)

    expect(await screen.findByText(`/liabilities/${id}`)).toBeTruthy()
  })
})