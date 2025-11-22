// src/components/ExpensePieChart.jsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const ExpensePieChart = ({ data }) => {
  // Diverse color palette
  const COLORS = [
    "#6366f1", // indigo
    "#22c55e", // green
    "#f97316", // orange
    "#eab308", // yellow
    "#ef4444", // red
    "#0ea5e9", // sky
    "#a855f7", // purple
    "#f43f5e"  // pink
  ];

  const sortedData = [...data].sort((a, b) => b.amount - a.amount);

  return (
    <div className="w-full h-72 md:h-96">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={sortedData}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, value }) => `${name}: ₱${value.toFixed(2)}`}
          >
            {sortedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `₱${Number(value).toFixed(2)}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ExpensePieChart;
