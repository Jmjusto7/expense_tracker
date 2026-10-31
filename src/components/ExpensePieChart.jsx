import DonutChart from "./DonutChart";

// data: [{ category, amount }] - positive slices only (callers filter refunds out).
export default function ExpensePieChart({ data, legend = true }) {
  return (
    <DonutChart
      data={data.map((d) => ({ name: d.category, value: d.amount }))}
      heightClassName="h-60 md:h-72"
      legend={legend}
    />
  );
}
