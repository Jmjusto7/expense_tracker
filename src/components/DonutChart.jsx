import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrencyPrecise } from "../utils/formatCurrency";
import { colorForKey } from "../utils/chartFormat";

// Donut with a wrapping legend underneath - no outside labels, which clip on phones.
// data: [{ name, value }], positive values only.
export default function DonutChart({ data, heightClassName = "h-56", formatValue = formatCurrencyPrecise, legend = true }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const pct = (v) => (total ? ((v / total) * 100).toFixed(1) : "0.0");

    return (
        <div className="w-full">
            <div className={`money w-full ${heightClassName}`}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={sorted} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="90%" paddingAngle={1}>
                            {sorted.map((d) => (
                                <Cell key={d.name} fill={colorForKey(d.name)} stroke="#ffffff" />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value, name) => [`${formatValue(value)} (${pct(value)}%)`, name]}
                            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {legend && (
                <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
                    {sorted.map((d) => (
                        <li key={d.name} className="flex items-center gap-1.5 min-w-0 max-w-full">
                            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: colorForKey(d.name) }} aria-hidden="true" />
                            <span className="text-ink truncate" title={d.name}>
                                {d.name}
                            </span>
                            <span className="money text-ink-muted shrink-0">{pct(d.value)}%</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
