import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { formatMonthYear } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { compactCurrency, Y_AXIS_WIDTH } from "../utils/chartFormat";

const MonthlySpendChart = ({ data }) => {
  // Sort data chronologically
  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute overall average
  const average =
    sortedData.reduce((sum, item) => sum + item.total, 0) / sortedData.length;

  return (
    <div className="money w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sortedData} margin={{ top: 18, right: 30, left: 0, bottom: 0 }}>
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
            formatter={(value) => [formatCurrency(value), "Monthly total"]}
            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
          />

          <Line
            type="monotone"
            dataKey="total"
            stroke="#1f6f5c"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Monthly Total"
          />

          {/* Labelled in place instead of a colour-matched legend entry. */}
          <ReferenceLine
            y={average}
            stroke="#b8622e"
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{ value: `Avg ${compactCurrency(average)}`, position: "insideTopRight", fontSize: 11, fill: "#944d22" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MonthlySpendChart;
