import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { formatMonthYear } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";

const PERIOD_OPTIONS = [3, 6, 12];

// `data` is the full ascending monthly {date, income, expense} series
// (unscoped) - this component only slices it to the chosen window and
// renders, it doesn't compute the rollup itself.
export default function IncomeExpenseTrendChart({ data }) {
  const [months, setMonths] = useState(12);
  const sliced = data.slice(-months);

  return (
    <div className="h-full bg-surface border border-border rounded-xl p-6 flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="font-display text-lg text-ink">Income vs Expenses</h3>
        <select
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="text-xs border border-border rounded-md px-2 py-1 bg-surface text-ink-muted focus:ring-2 focus:ring-ledger focus:outline-none"
        >
          {PERIOD_OPTIONS.map((m) => (
            <option key={m} value={m}>
              Past {m} Months
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 min-h-0 money">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sliced} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe3db" vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatMonthYear} stroke="#6b7570" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7570" tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(label) => formatMonthYear(label)}
              formatter={(value, name) => [formatCurrency(value), name === "income" ? "Income" : "Expenses"]}
              contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => (value === "income" ? "Income" : "Expenses")} />
            <Line type="monotone" dataKey="income" stroke="#1f6f5c" strokeWidth={2.5} dot={false} name="income" />
            <Line type="monotone" dataKey="expense" stroke="#a1423b" strokeWidth={2.5} dot={false} name="expense" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
