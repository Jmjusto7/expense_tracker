import { colorForKey } from "../utils/chartFormat";

// Horizontal share bar where every segment is also named with its % underneath.
// segments: [{ name, value }] - non-positive values are left out.
export default function LabelledStackBar({ segments, height = "h-3", label, maxLegend = 6 }) {
    const positive = segments.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
    const total = positive.reduce((sum, s) => sum + s.value, 0);
    if (!total) return null;

    const pct = (v) => Math.round((v / total) * 100);
    const shown = positive.slice(0, maxLegend);
    const rest = positive.slice(maxLegend);
    const legend = rest.length
        ? [...shown, { name: `${rest.length} more`, value: rest.reduce((s, x) => s + x.value, 0), other: true }]
        : shown;
    const summary = legend.map((s) => `${s.name} ${pct(s.value)}%`).join(", ");

    return (
        <div role="img" aria-label={`${label ? `${label}: ` : ""}${summary}`}>
            <div className={`flex ${height} rounded-full overflow-hidden bg-surface-sunken`} aria-hidden="true">
                {positive.map((s) => (
                    <span
                        key={s.name}
                        className="h-full border-r border-surface last:border-r-0"
                        style={{ width: `${(s.value / total) * 100}%`, backgroundColor: colorForKey(s.name) }}
                    />
                ))}
            </div>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ink-muted" aria-hidden="true">
                {legend.map((s) => (
                    <li key={s.name} className="flex items-center gap-1 min-w-0">
                        <span
                            className="h-2 w-2 rounded-sm shrink-0"
                            style={{ backgroundColor: s.other ? "var(--color-border)" : colorForKey(s.name) }}
                        />
                        <span className="truncate max-w-[10rem]">{s.name}</span>
                        <span className="text-ink">{pct(s.value)}%</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
