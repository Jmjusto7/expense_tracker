import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrencyPrecise } from "../utils/formatCurrency";
import { getCurrentBalance } from "../utils/balanceHelpers";

// Same coordinated palette as ExpensePieChart, for visual consistency
// across the app's charts.
const COLORS = [
  "#1f6f5c",
  "#b8622e",
  "#3d8a76",
  "#d4884f",
  "#164f42",
  "#8a4a1f",
  "#6b8a7f",
  "#a1423b",
];

export default function AssetCompositionChart({ accounts, balanceEntries }) {
  // Negative balances (e.g. a credit card) don't make sense as a positive
  // "share of assets" slice - they're excluded here rather than distorting
  // the chart, not silently dropped from the app overall.
  const data = accounts
    .map((acc) => ({ name: acc.name, value: getCurrentBalance(balanceEntries, acc.id) || 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <p className="text-ink-muted text-sm text-center py-10">
        No positive balances to chart yet.
      </p>
    );
  }

  return (
    <div className="money w-full h-72">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={100}
            label={({ name, value }) => `${name}: ${formatCurrencyPrecise(value)}`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatCurrencyPrecise(value)}
            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
