import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

const chipClass = (active) =>
    `shrink-0 inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border transition-colors ${active ? "bg-ledger text-white border-ledger" : "bg-surface border-border text-ink-muted hover:border-ledger"
    }`;

const toggleIn = (list, value) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

// Search + bucket/category chips shared by the Expenses views. On phones the chips fold behind a
// "Filters" button; active ones stay visible as removable chips.
export default function ExpenseFilterPanel({ id, filters, onChange, bucketChoices, categoryChoices, extraCount = 0, children }) {
    const [open, setOpen] = useState(false);
    const { bucketKeys, categories, query } = filters;
    const chipCount = bucketKeys.length + categories.length;
    const count = chipCount + extraCount;
    const labelOf = (key) => bucketChoices.find((g) => g.key === key);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <input
                    type="search"
                    value={query}
                    onChange={(e) => onChange({ query: e.target.value })}
                    placeholder="Search category or comment"
                    aria-label="Search category or comment"
                    className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
                />
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-controls={id}
                    className={`sm:hidden shrink-0 inline-flex items-center gap-1 text-xs px-3 py-2 rounded-lg border ${count ? "border-ledger text-ledger-dark bg-ledger-soft" : "border-border text-ink-muted bg-surface"
                        }`}
                >
                    <SlidersHorizontal size={13} aria-hidden="true" />
                    Filters{count ? ` · ${count}` : ""}
                </button>
            </div>

            {!open && chipCount > 0 && (
                <div className="sm:hidden flex flex-wrap items-center gap-1.5" aria-label="Active filters">
                    {[...bucketKeys.map((k) => ({ kind: "b", key: k, label: labelOf(k)?.label ?? k, icon: labelOf(k)?.icon })), ...categories.map((c) => ({ kind: "c", key: c, label: c }))].map((f) => (
                        <button
                            key={`${f.kind}-${f.key}`}
                            type="button"
                            onClick={() => onChange(f.kind === "b" ? { bucketKeys: bucketKeys.filter((x) => x !== f.key), categories: [] } : { categories: categories.filter((x) => x !== f.key) })}
                            aria-label={`Remove filter ${f.label}`}
                            className="inline-flex items-center gap-1 text-xs pl-2.5 pr-1.5 py-0.5 rounded-full bg-ledger-soft text-ledger-dark border border-ledger/25"
                        >
                            {f.icon && <span aria-hidden="true">{f.icon}</span>}
                            {f.label}
                            <X size={12} aria-hidden="true" />
                        </button>
                    ))}
                </div>
            )}

            <div id={id} className={`${open ? "block" : "hidden"} sm:block space-y-2`}>
                {children}
                <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible" role="group" aria-label="Filter by bucket">
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-ink-muted mr-1">Buckets</span>
                    <button type="button" aria-pressed={bucketKeys.length === 0} onClick={() => onChange({ bucketKeys: [], categories: [] })} className={chipClass(bucketKeys.length === 0)}>
                        All
                    </button>
                    {bucketChoices.map((g) => (
                        <button
                            key={g.key}
                            type="button"
                            aria-pressed={bucketKeys.includes(g.key)}
                            onClick={() => onChange({ bucketKeys: toggleIn(bucketKeys, g.key), categories: [] })}
                            className={chipClass(bucketKeys.includes(g.key))}
                        >
                            {g.icon && <span aria-hidden="true">{g.icon}</span>}
                            {g.label}
                        </button>
                    ))}
                </div>
                {categoryChoices.length > 0 && (
                    <details open={categories.length > 0 || undefined}>
                        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink select-none">
                            Categories{categories.length > 0 ? ` (${categories.length} selected)` : ""}
                        </summary>
                        <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Filter by category">
                            {categoryChoices.map((g) => (
                                <button
                                    key={g.key}
                                    type="button"
                                    aria-pressed={categories.includes(g.key)}
                                    onClick={() => onChange({ categories: toggleIn(categories, g.key) })}
                                    className={chipClass(categories.includes(g.key))}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>
                    </details>
                )}
                {(chipCount > 0 || query.trim()) && (
                    <button
                        type="button"
                        onClick={() => onChange({ bucketKeys: [], categories: [], query: "" })}
                        className="inline-flex items-center gap-1 text-xs font-medium text-ledger-dark hover:underline"
                    >
                        <X size={12} aria-hidden="true" /> Clear filters
                    </button>
                )}
            </div>
        </div>
    );
}
