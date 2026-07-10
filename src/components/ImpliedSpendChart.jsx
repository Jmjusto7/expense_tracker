import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { formatCurrency } from "../utils/formatCurrency";

export default function ImpliedSpendChart({ data }) {
  return (
    <div className="money w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe3db" />
          <XAxis
            dataKey="label"
            stroke="#6b7570"
            tick={{ fontSize: 10 }}
            angle={-30}
            textAnchor="end"
            interval={0}
            height={60}
          />
          <YAxis stroke="#6b7570" tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => [
              formatCurrency(Math.abs(value)),
              value >= 0 ? "Implied Spend" : "Unaccounted Inflow",
            ]}
            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
          />
          <Bar dataKey="impliedSpend" radius={[3, 3, 0, 0]}>
            {data.map((row, i) => (
              <Cell key={i} fill={row.impliedSpend >= 0 ? "#a1423b" : "#1f6f5c"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
