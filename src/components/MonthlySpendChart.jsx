import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatMonthYear } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";

const MonthlySpendChart = ({ data }) => {
  // Sort data chronologically
  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute overall average
  const average =
    sortedData.reduce((sum, item) => sum + item.total, 0) / sortedData.length;

  // Add "average" field to each row
  const chartData = sortedData.map((item) => ({
    ...item,
    average
  }));

  return (
    <div className="money w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbe3db" />
          <XAxis
            dataKey="date"
            tickFormatter={formatMonthYear}
            interval={0}
            angle={0}
            textAnchor="end"
            stroke="#6b7570"
            tick={{ fontSize: 12 }}
          />
          <YAxis stroke="#6b7570" tick={{ fontSize: 12 }} />
          <Tooltip
            labelFormatter={(label) => formatMonthYear(label)}
            formatter={(value, name) =>
              name === "average"
                ? [formatCurrency(value), "Average"]
                : [formatCurrency(value), "Total"]
            }
            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
          />

          {/* Main line */}
          <Line
            type="monotone"
            dataKey="total"
            stroke="#1f6f5c"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Monthly Total"
          />

          {/* Average line */}
          <Line
            type="monotone"
            dataKey="average"
            stroke="#b8622e"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Average"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MonthlySpendChart;
