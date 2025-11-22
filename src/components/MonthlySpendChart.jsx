import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const MonthlySpendChart = ({ data }) => {
  // Format date as "MMM YY", e.g. "Jan 25"
  const formatMonthYear = (d) => {
    const date = new Date(d);
    return date.toLocaleString("default", { month: "short", year: "2-digit" });
  };

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
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatMonthYear}
            interval={0}
            angle={0}
            textAnchor="end"
          />
          <YAxis />
          <Tooltip
            labelFormatter={(label) => formatMonthYear(label)}
            formatter={(value, name) =>
              name === "average"
                ? [`₱${value.toLocaleString()}`, "Average"]
                : [`₱${value.toLocaleString()}`, "Total"]
            }
          />

          {/* Main line */}
          <Line
            type="monotone"
            dataKey="total"
            stroke="#6366F1"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Monthly Total"
          />

          {/* Average line */}
          <Line
            type="monotone"
            dataKey="average"
            stroke="#FF4D4D"
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
