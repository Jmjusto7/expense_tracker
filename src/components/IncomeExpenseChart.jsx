import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { formatMonthYear } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";

export default function IncomeExpenseChart({ data }) {
  return (
    <div className="money w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe3db" />
          <XAxis
            dataKey="date"
            tickFormatter={formatMonthYear}
            stroke="#6b7570"
            tick={{ fontSize: 12 }}
          />
          <YAxis stroke="#6b7570" tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(label) => formatMonthYear(label)}
            formatter={(value, name) => [
              formatCurrency(value),
              name === "income" ? "Income" : name === "expense" ? "Expense" : "Net",
            ]}
            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />

          <Bar dataKey="income" fill="#1f6f5c" name="Income" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" fill="#a1423b" name="Expense" radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="net" stroke="#b8622e" strokeWidth={2} dot={{ r: 3 }} name="Net" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
