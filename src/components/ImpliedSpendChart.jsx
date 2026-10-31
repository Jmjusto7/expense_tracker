import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend } from "recharts";
import { formatCurrency } from "../utils/formatCurrency";
import { compactCurrency, Y_AXIS_WIDTH } from "../utils/chartFormat";

const MIN_BAR_SLOT_PX = 56;
const shortLabel = (label) => (label.length > 14 ? `${label.slice(0, 13)}…` : label);
const LEGEND = [
  { value: "Implied spend", type: "square", color: "#a1423b" },
  { value: "Unaccounted inflow", type: "square", color: "#1f6f5c" },
];

// Scrolls sideways instead of squeezing labels once there are many periods.
export default function ImpliedSpendChart({ data }) {
  return (
    <div className="overflow-x-auto">
      <div className="money h-64" style={{ minWidth: Math.max(data.length * MIN_BAR_SLOT_PX, 320), width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe3db" />
            <XAxis
              dataKey="label"
              stroke="#6b7570"
              tick={{ fontSize: 10 }}
              tickFormatter={shortLabel}
              angle={-30}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis stroke="#6b7570" tick={{ fontSize: 12 }} width={Y_AXIS_WIDTH} tickFormatter={compactCurrency} />
            <Tooltip
              formatter={(value) => [
                formatCurrency(Math.abs(value)),
                value >= 0 ? "Implied Spend" : "Unaccounted Inflow",
              ]}
              contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
            />
            <Legend payload={LEGEND} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="impliedSpend" radius={[3, 3, 0, 0]}>
              {data.map((row, i) => (
                <Cell key={i} fill={row.impliedSpend >= 0 ? "#a1423b" : "#1f6f5c"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
