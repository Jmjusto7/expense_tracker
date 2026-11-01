import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrencyPrecise } from "../utils/formatCurrency";
import { colorsForKeys, compactCurrency } from "../utils/chartFormat";

const MIN_LABELLED_SHARE = 0.06;
const RADIAN = Math.PI / 180;

// Percent printed inside each big-enough slice, so the chart reads without matching colours.
function SliceLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
    if (percent < MIN_LABELLED_SHARE) return null;
    const r = innerRadius + (outerRadius - innerRadius) / 2;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
        <text
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={600}
            fill="#ffffff"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={2}
            paintOrder="stroke"
        >
            {Math.round(percent * 100)}%
        </text>
    );
}

// Donut with % on the slices, the total in the middle and a wrapping legend underneath.
// data: [{ name, value }], positive values only.
export default function DonutChart({
    data,
    heightClassName = "h-56",
    formatValue = formatCurrencyPrecise,
    formatTotal = compactCurrency,
    legend = true,
}) {
    const total = data.reduce((s, d) => s + d.value, 0);
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const colorFor = colorsForKeys(sorted.map((d) => d.name));
    const pct = (v) => (total ? ((v / total) * 100).toFixed(1) : "0.0");
    const summary = sorted.map((d) => `${d.name} ${pct(d.value)}%`).join(", ");

    return (
        <div className="w-full">
            <div className={`money relative w-full ${heightClassName}`} role="img" aria-label={`Total ${formatValue(total)}: ${summary}`}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={sorted}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="90%"
                            paddingAngle={1}
                            label={SliceLabel}
                            labelLine={false}
                            isAnimationActive={false}
                        >
                            {sorted.map((d) => (
                                <Cell key={d.name} fill={colorFor(d.name)} stroke="#ffffff" />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value, name) => [`${formatValue(value)} (${pct(value)}%)`, name]}
                            contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 13 }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
                    <span className="text-[10px] uppercase tracking-wide text-ink-muted">Total</span>
                    <span className="text-sm font-semibold text-ink">{formatTotal(total)}</span>
                </div>
            </div>
            {legend && (
                <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs" aria-hidden="true">
                    {sorted.map((d) => (
                        <li key={d.name} className="flex items-center gap-1.5 min-w-0 max-w-full">
                            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: colorFor(d.name) }} />
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
