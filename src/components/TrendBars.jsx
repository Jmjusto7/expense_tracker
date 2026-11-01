import { formatCurrency } from "../utils/formatCurrency";
import { compactCurrency } from "../utils/chartFormat";

// Column chart built from plain elements so every bar can print its amount and be a button.
// data: [{ key, label, title, value }]; bars stay proportional, labels sit above each bar.
export default function TrendBars({ data, color = "#4f6f8a", label, onSelect, selectedKey, highlightKey, highlightColor = "var(--color-alert)", heightClassName = "h-36" }) {
    const max = Math.max(0, ...data.map((d) => d.value));
    const wide = data.length > 12;

    return (
        <div className="overflow-x-auto">
            <ul
                aria-label={label}
                className={`flex items-stretch gap-1 pt-5 ${heightClassName}`}
                style={wide ? { minWidth: `${data.length * 2.5}rem` } : undefined}
            >
                {data.map((d) => {
                    const pct = max > 0 ? (Math.max(d.value, 0) / max) * 100 : 0;
                    const isSelected = selectedKey === d.key;
                    const body = (
                        <>
                            <span className="relative flex-1 w-full">
                                <span
                                    className="absolute inset-x-[12%] bottom-0 rounded-t"
                                    style={{
                                        height: `${pct}%`,
                                        backgroundColor: isSelected ? "var(--color-ink)" : d.key === highlightKey ? highlightColor : color,
                                        minHeight: d.value > 0 ? 2 : 0,
                                    }}
                                />
                                <span
                                    className="money absolute inset-x-0 text-center text-[9px] sm:text-[10px] leading-none text-ink whitespace-nowrap"
                                    style={{ bottom: `calc(${pct}% + 3px)` }}
                                >
                                    {d.value ? compactCurrency(d.value).replace("₱", "") : "–"}
                                </span>
                            </span>
                            <span className={`mt-1 text-[10px] leading-none whitespace-nowrap ${isSelected ? "text-ink font-semibold" : "text-ink-muted"}`}>
                                {d.label}
                            </span>
                        </>
                    );
                    const a11y = `${d.title}: ${formatCurrency(d.value)}`;
                    return (
                        <li key={d.key} className="flex-1 min-w-0 flex">
                            {onSelect ? (
                                <button
                                    type="button"
                                    onClick={() => onSelect(d)}
                                    aria-label={a11y}
                                    title={a11y}
                                    className="flex-1 flex flex-col items-center rounded-md hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger"
                                >
                                    {body}
                                </button>
                            ) : (
                                <span className="flex-1 flex flex-col items-center" aria-label={a11y} role="img">
                                    {body}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
