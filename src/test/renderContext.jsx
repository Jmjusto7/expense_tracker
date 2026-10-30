import { renderHook, waitFor } from '@testing-library/react'
import { ExpenseProvider, useExpenseContext } from '../context/ExpenseContext'

export async function renderExpenseContext() {
  const rendered = renderHook(() => useExpenseContext(), { wrapper: ExpenseProvider })
  await waitFor(() => expect(rendered.result.current.isLoaded).toBe(true))
  return rendered
}