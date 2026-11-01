import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { MoreHorizontal, X } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useBucketsWithCategories } from "../hooks/useBucketsWithCategories";
import ExpensesViewSwitch from "../components/ExpensesViewSwitch";
import TrendBars from "../components/TrendBars";
import ConfirmButton from "../components/ConfirmButton";
import Tour from "../components/Tour";
import { TOURS } from "../utils/tourSteps";
import { ALL_MONTHS, monthIndexOf } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { applyFilters } from "../utils/overviewHelpers";
import { TRAVEL_FILTER_ID } from "../utils/travelHelpers";
import { countFilters, readFilters, rememberView, withFilters } from "../utils/expenseFilters";

const pad = (n) => String(n).padStart(2, "0");

function YearMenu({ yearObj, transactionCount, overviewTo, filterSearch }) {
    const { removeYear } = useExpenseContext();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const close = (e) => {
            if (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("pointerdown", close);
            document.removeEventListener("keydown", close);
        };
    }, [open]);

    const months = yearObj.months?.length || 0;
    const item = "w-full text-left px-3 py-2 text-sm text-ink hover:bg-surface-sunken";

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={`${yearObj.year} options`}
                aria-haspopup="menu"
                aria-expanded={open}
                className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken"
            >
                <MoreHorizontal size={16} aria-hidden="true" />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 mt-1 w-56 z-20 bg-surface border border-border rounded-lg shadow-lg py-1">
                    <button role="menuitem" className={item} onClick={() => navigate(`/expenses/overview${withFilters(`from=${yearObj.year}-01&to=${overviewTo}`, readFilters(new URLSearchParams(filterSearch)))}`)}>
                        Open {yearObj.year} in Overview
                    </button>
                    <button role="menuitem" className={item} onClick={() => navigate(`/expenses/${yearObj.year}`)}>
                        Manage months
                    </button>
                    <div role="separator" className="my-1 border-t border-border" />
                    <ConfirmButton
                        onConfirm={() => {
                            setOpen(false);
                            removeYear(yearObj.id);
                        }}
                        aria-label={`Delete ${yearObj.year}`}
                        className={`${item} text-alert`}
                        confirmClassName={`${item} text-white bg-alert hover:bg-alert`}
                        confirmLabel={`Tap again to delete ${yearObj.year}`}
                        title={`Delete ${yearObj.year}? Removes ${months} month${months === 1 ? "" : "s"} and ${transactionCount} transaction${transactionCount === 1 ? "" : "s"}.`}
                    >
                        Delete {yearObj.year}…
                    </ConfirmButton>
                </div>
            )}
        </div>
    );
}

export default function ExpenseYearsPage() {
    const { years, allTransactions, isLoaded = true } = useExpenseContext();
    const buckets = useBucketsWithCategories();
    const navigate = useNavigate();
    const location = useLocation();
    const [params] = useSearchParams();
    const filters = readFilters(params);
    const filtered = countFilters(filters) > 0;
    const today = useMemo(() => new Date(), []);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    useEffect(() => rememberView("years", `${location.pathname}${location.search}`), [location.pathname, location.search]);

    // year -> { months: [12 totals], count }
    const byYear = useMemo(() => {
        const map = new Map();
        for (const t of applyFilters(allTransactions, filters, buckets)) {
            const m = monthIndexOf(t.monthName);
            if (!t.yearNumber || m < 0) continue;
            if (!map.has(t.yearNumber)) map.set(t.yearNumber, { months: Array(12).fill(0), count: 0 });
            const row = map.get(t.yearNumber);
            row.months[m] += Number(t.amount ?? 0);
            row.count += 1;
        }
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allTransactions, buckets, params.toString()]);

    const sortedYears = Array.isArray(years) ? [...years].sort((a, b) => b.year - a.year) : [];
    const sum = (list, upTo = 11) => list.slice(0, upTo + 1).reduce((s, v) => s + v, 0);

    return (
        <div className="page-shell">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h1 className="font-display text-2xl text-ink">Expenses</h1>
                {isLoaded && sortedYears.length > 0 && <Tour id="years" steps={TOURS.years} />}
                <ExpensesViewSwitch current="years" />
            </div>

            {filtered && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted mb-3">
                    <span>
                        Filtered:{" "}
                        <span className="text-ink font-medium">
                            {[
                                ...filters.bucketKeys.map((k) => (k === TRAVEL_FILTER_ID ? "Travel" : k === "unassigned" ? "Unassigned" : buckets.find((b) => String(b.id) === k)?.name ?? k)),
                                ...filters.categories,
                                filters.query.trim() && `“${filters.query.trim()}”`,
                            ]
                                .filter(Boolean)
                                .join(", ")}
                        </span>
                    </span>
                    <Link to="/expenses/years" className="inline-flex items-center gap-1 font-medium text-ledger-dark hover:underline">
                        <X size={12} aria-hidden="true" /> Clear
                    </Link>
                </p>
            )}

            {!isLoaded ? (
                <p role="status" className="text-ink-muted">
                    Loading…
                </p>
            ) : sortedYears.length === 0 ? (
                <p className="text-ink-muted bg-surface border border-border rounded-xl p-6 text-center">Nothing logged yet.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedYears.map((yearObj) => {
                        const y = yearObj.year;
                        const row = byYear.get(y) ?? { months: Array(12).fill(0), count: 0 };
                        const isCurrent = y === currentYear;
                        // The running year compares the same months of last year, not the whole year.
                        const lastIndex = isCurrent ? currentMonth : 11;
                        const total = sum(row.months);
                        const prev = byYear.get(y - 1);
                        const prevComparable = prev ? sum(prev.months, lastIndex) : 0;
                        const change = prevComparable ? ((sum(row.months, lastIndex) - prevComparable) / Math.abs(prevComparable)) * 100 : null;
                        // Average from the first month with anything logged, so a year you started tracking mid-way isn't diluted.
                        const firstIndex = Math.max(0, row.months.findIndex((v) => v !== 0));
                        const monthsCounted = Math.max(1, (y > currentYear ? 11 : lastIndex) - firstIndex + 1);
                        const peakIndex = row.months.reduce((best, v, i) => (v > (row.months[best] ?? 0) ? i : best), 0);
                        const hasPeak = row.months[peakIndex] > 0;

                        return (
                            <section key={yearObj.id} aria-label={`${y} expenses`} className="bg-surface border border-border rounded-xl shadow-card p-4 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <h2 className="font-display text-xl font-bold text-ink">{y}</h2>
                                    <YearMenu
                                        yearObj={yearObj}
                                        transactionCount={row.count}
                                        overviewTo={isCurrent ? `${y}-${pad(currentMonth + 1)}` : `${y}-12`}
                                        filterSearch={location.search}
                                    />
                                </div>
                                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                                    <span className="money text-lg font-bold text-ink">{formatCurrency(total)}</span>
                                    {change != null && (
                                        <span className={`text-xs font-medium ${change > 0 ? "text-alert" : "text-ledger-dark"}`}>
                                            {change > 0 ? "▲" : "▼"} {Math.abs(change).toFixed(0)}% vs {isCurrent ? `Jan-${ALL_MONTHS[currentMonth].slice(0, 3)} ` : ""}
                                            {y - 1}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-ink-muted">
                                    avg <span className="money">{formatCurrency(total / monthsCounted)}</span> / month
                                    {hasPeak && ` · peak ${ALL_MONTHS[peakIndex].slice(0, 3)}`}
                                    {` · over ${monthsCounted} month${monthsCounted === 1 ? "" : "s"}${isCurrent ? " so far" : ""}`}
                                </p>
                                <TrendBars
                                    label={`${y} by month`}
                                    heightClassName="h-32"
                                    highlightKey={hasPeak ? `${y}-${pad(peakIndex + 1)}` : undefined}
                                    data={row.months.map((value, i) => ({
                                        key: `${y}-${pad(i + 1)}`,
                                        label: ALL_MONTHS[i][0],
                                        title: `${ALL_MONTHS[i]} ${y}`,
                                        value,
                                    }))}
                                    onSelect={(bar) =>
                                        navigate(`/expenses/${y}/${ALL_MONTHS[Number(bar.key.slice(5)) - 1]}${withFilters("", filters)}`, {
                                            state: { from: { label: "Years", url: `${location.pathname}${location.search}` } },
                                        })
                                    }
                                />
                            </section>
                        );
                    })}
                </div>
            )}
            <p className="text-[11px] text-ink-muted mt-3">Tap a bar to open that month · red = the year's biggest month · ⋯ to open a year in Overview or delete it.</p>
        </div>
    );
}
