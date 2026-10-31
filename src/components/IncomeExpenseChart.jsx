import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { formatMonthYear } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { compactCurrency, Y_AXIS_WIDTH } from "../utils/chartFormat";
import { hatchDefs } from "../utils/chartPatterns";

const SERIES_LABELS = { income: "Income", expense: "Expense", net: "Net" };

export default function IncomeExpenseChart({ data }) {
  return (
    <div className="money w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          {hatchDefs("expenseHatch", "#a1423b")}
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe3db" />
          <XAxis
            dataKey="date"
            tickFormatter={formatMonthYear}
            interval="preserveStartEnd"
            minTickGap={12}
            stroke="#6b7570"
            tick={{ fontSize: 12 }}
          />
          <YAxis stroke="#6b7570" tick={{ fontSize: 12 }} width={Y_AXIS_WIDTH} tickFormatter={compactCurrency} />
          <Tooltip
            labelFormatter={(label) => formatMonthYear(label)}
            formatter={(value, _name, item) => [formatCurrency(value), SERIES_LABELS[item.dataKey]]}
            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />

          <Bar dataKey="income" fill="#1f6f5c" name="Income" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" fill="url(#expenseHatch)" stroke="#a1423b" name="Expense (hatched)" radius={[3, 3, 0, 0]} />
          <Line type="monotone" dataKey="net" stroke="#b8622e" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} name="Net (dashed)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
