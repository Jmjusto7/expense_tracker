// ...existing code...
import React from "react";
import { useExpensesContext } from "../context/ExpenseContext";

export default function ExpenseTable() {
  const { expenses = [] } = useExpensesContext();

  if (!expenses.length) {
    return <div className="p-4">No expenses yet.</div>;
  }

  return (
    <div className="p-4 overflow-auto">
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 border-b">Date</th>
            <th className="text-left p-2 border-b">Category</th>
            <th className="text-left p-2 border-b">Description</th>
            <th className="text-right p-2 border-b">Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id ?? e.lastUpdated}>
              <td className="p-2 border-b">{new Date(e.date || e.lastUpdated).toLocaleDateString()}</td>
              <td className="p-2 border-b">{e.category}</td>
              <td className="p-2 border-b">{e.description}</td>
              <td className="p-2 border-b text-right">₱{Number(e.amount || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
// ...existing code...