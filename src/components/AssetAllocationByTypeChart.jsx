import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrencyPrecise } from "../utils/formatCurrency";
import { getCurrentBalance } from "../utils/balanceHelpers";

// Same coordinated palette as the other pie charts in the app.
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

export default function AssetAllocationByTypeChart({ accounts, accountTypes, balanceEntries }) {
  const typeNameById = Object.fromEntries(accountTypes.map((t) => [t.id, t.name]));

  const groups = {};
  accounts.forEach((acc) => {
    const balance = getCurrentBalance(balanceEntries, acc.id) || 0;
    if (balance <= 0) return; // same "no negative slices" treatment as AssetCompositionChart

    const label = acc.typeId != null ? typeNameById[acc.typeId] || "Unclassified" : "Unclassified";
    groups[label] = (groups[label] || 0) + balance;
  });

  const total = Object.values(groups).reduce((s, v) => s + v, 0);

  const data = Object.entries(groups)
    .map(([name, value]) => ({ name, value, percent: total ? ((value / total) * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <p className="text-ink-muted text-sm text-center py-10">
        No positive balances to allocate yet.
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
            label={({ name, percent }) => `${name}: ${percent}%`}
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
