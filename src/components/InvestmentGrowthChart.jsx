// src/components/InvestmentGrowthChart.jsx
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { formatMonthYear } from "../utils/dateHelpers";
import { compactNumber, Y_AXIS_WIDTH } from "../utils/chartFormat";

// Cost basis (what you've put in, cumulative - only grows as Convert
// entries accumulate) vs current value (units x price, moves with the
// market) over time, from balanceHelpers' buildInvestmentHistory. Kept in
// the account's own cost currency (unitLabel) rather than PHP - same rule
// as the StatCards above it on AccountDetailPage: never blend currency
// movement into an asset's own performance.
export default function InvestmentGrowthChart({ data, unitLabel }) {
  const fmt = (v) =>
    v == null ? "—" : `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unitLabel}`;

  return (
    <div className="money w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="costBasisFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b7570" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#6b7570" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe3db" />
          <XAxis
            dataKey="date"
            tickFormatter={formatMonthYear}
            interval="preserveStartEnd"
            minTickGap={12}
            stroke="#6b7570"
            tick={{ fontSize: 11 }}
          />
          <YAxis stroke="#6b7570" tick={{ fontSize: 12 }} width={Y_AXIS_WIDTH} tickFormatter={compactNumber} />
          <Tooltip
            labelFormatter={(label) => formatMonthYear(label)}
            formatter={(value, _name, item) => [fmt(value), item.dataKey === "costBasis" ? "Total Invested" : "Current Value"]}
            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />

          {/* Total invested - a muted, filled step-like area, since it only
              ever grows (no "selling" in this app yet) - reads as the floor. */}
          <Area
            type="stepAfter"
            dataKey="costBasis"
            stroke="#6b7570"
            strokeWidth={2}
            fill="url(#costBasisFill)"
            legendType="square"
            name="Total Invested (shaded steps)"
          />

          {/* Current value - the line that actually moves with the market,
              in travel-amber to read as distinct from the muted floor
              beneath it. */}
          <Line
            type="monotone"
            dataKey="currentValue"
            stroke="#b8622e"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            legendType="line"
            name="Current Value (line)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
