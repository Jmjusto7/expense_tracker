// src/components/ExpensePieChart.jsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrencyPrecise } from "../utils/formatCurrency";

const ExpensePieChart = ({ data }) => {
  // Coordinated palette in the ledger/travel family, rather than a
  // generic chart-library rainbow - keeps many-category charts legible
  // while still feeling like one consistent brand.
  const COLORS = [
    "#1f6f5c", // ledger
    "#b8622e", // travel
    "#3d8a76", // ledger, lighter
    "#d4884f", // travel, lighter
    "#164f42", // ledger, darker
    "#8a4a1f", // travel, darker
    "#6b8a7f", // slate-green
    "#a1423b", // alert (used sparingly, last in rotation)
  ];

  const sortedData = [...data].sort((a, b) => b.amount - a.amount);

  return (
    <div className="money w-full h-72 md:h-96">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={sortedData}
            dataKey="amount"
            nameKey="category"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, value }) => `${name}: ${formatCurrencyPrecise(value)}`}
          >
            {sortedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
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
};

export default ExpensePieChart;
