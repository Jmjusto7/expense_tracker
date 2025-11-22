import { PieChart, Pie, Cell, Tooltip } from "recharts";

export default function ChartSummary({ data }) {
  const chartData = Object.entries(data).map(([category, amount]) => ({
    name: category,
    value: amount,
  }));

  return (
    <PieChart width={300} height={300}>
      <Pie dataKey="value" data={chartData} fill="#8884d8" label />
      <Tooltip />
    </PieChart>
  );
}
