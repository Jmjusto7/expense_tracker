import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useBucketsWithCategories } from "../hooks/useBucketsWithCategories";
import ExpensesViewSwitch from "../components/ExpensesViewSwitch";
import ExpenseFilterPanel from "../components/ExpenseFilterPanel";
import TrendBars from "../components/TrendBars";
import Tour from "../components/Tour";
import { TOURS } from "../utils/tourSteps";
import { ALL_MONTHS } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { colorsForKeys } from "../utils/chartFormat";
import { sumAmounts } from "../utils/travelHelpers";
import { countFilters, readFilters, rememberView, withFilters } from "../utils/expenseFilters";
import {
    PRESETS,
    applyFilters,
    formatMonthKey,
    formatRange,
    groupTotals,
    inRange,
    keyOfDate,
    monthlyAverage,
    monthsBetween,
    parseMonthKey,
    presetRange,
    rowKeyOf,
    seriesFor,
    shiftMonthKey,
    txMonthKey,
} from "../utils/overviewHelpers";

const TWO_COLUMNS_FROM = 9;

const segClass = (active) =>
    `px-3 py-1 rounded-full text-xs transition-colors ${active ? "bg-surface text-ink font-semibold shadow-sm" : "text-ink-muted hover:text-ink"}`;

const chipClass = (active) =>
    `shrink-0 inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border transition-colors ${active ? "bg-ledger text-white border-ledger" : "bg-surface border-border text-ink-muted hover:border-ledger"
    }`;

function Change({ now, before }) {
    if (before == null || before === 0) return <span className="text-ink-muted">new</span>;
    const pct = ((now - before) / Math.abs(before)) * 100;
    if (Math.abs(pct) < 0.5) return <span className="text-ink-muted">– 0%</span>;
    return (
        <span className={pct > 0 ? "text-alert" : "text-ledger-dark"}>
            {pct > 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
        </span>
    );
}

function Stat({ label, value, sub }) {
    return (
        <div className="bg-surface border border-border rounded-lg shadow-card px-3 py-2 min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-ink-muted leading-tight">{label}</div>
            <div className="money text-base font-semibold text-ink truncate">{value}</div>
            {sub && <div className="text-[10px] text-ink-muted truncate">{sub}</div>}
        </div>
    );
}

export default function ExpenseOverviewPage() {
    const { allTransactions, isLoaded } = useExpenseContext();
    const buckets = useBucketsWithCategories();
    const navigate = useNavigate();
    const location = useLocation();
    const [params, setParams] = useSearchParams();

    const today = useMemo(() => new Date(), []);
    const currentKey = keyOfDate(today);

    const fallback = presetRange("this-year", today);
    let from = parseMonthKey(params.get("from")) ? params.get("from") : fallback.from;
    let to = parseMonthKey(params.get("to")) ? params.get("to") : fallback.to;
    if (from > to) [from, to] = [to, from];
    // Buckets when you have any, otherwise categories; ?group= overrides.
    const groupParam = params.get("group");
    const group = groupParam === "bucket" || groupParam === "category" ? groupParam : buckets.length ? "bucket" : "category";
    const selected = params.get("sel");
    const filters = readFilters(params);
    const { bucketKeys, categories } = filters;
    const hasFilters = countFilters(filters) > 0;
    const spansYears = from.slice(0, 4) !== to.slice(0, 4);
    const by = spansYears && params.get("by") === "year" ? "year" : "month";
    const prevFrom = shiftMonthKey(from, -12);
    const prevTo = shiftMonthKey(to, -12);

    // Period changes add history entries (Back returns to the previous period); toggles replace.
    const update = (patch, { push = false } = {}) => {
        const next = new URLSearchParams(params);
        for (const [k, v] of Object.entries(patch)) {
            next.delete(k);
            if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
            else if (v != null) next.set(k, v);
        }
        setParams(next, { replace: !push });
    };
    const setRange = (range) => update({ from: range.from, to: range.to }, { push: true });
    const setFilters = (patch) => {
        const next = { ...filters, ...patch };
        update({ b: next.bucketKeys, c: next.categories, q: next.query.trim() ? next.query : null, sel: null });
    };

    useEffect(() => rememberView("overview", `${location.pathname}${location.search}`), [location.pathname, location.search]);

    const earliestKey = useMemo(
        () =>
            allTransactions.reduce((min, t) => {
                const k = txMonthKey(t);
                return k && (!min || k < min) ? k : min;
            }, null),
        [allTransactions]
    );

    // Everything below respects the bucket/category/search filter; only the period differs.
    const filteredAll = useMemo(
        () => applyFilters(allTransactions, filters, buckets),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allTransactions, buckets, bucketKeys.join("|"), categories.join("|"), filters.query]
    );
    const periodAll = useMemo(() => allTransactions.filter((t) => inRange(t, from, to)), [allTransactions, from, to]);
    const rangeTx = useMemo(() => filteredAll.filter((t) => inRange(t, from, to)), [filteredAll, from, to]);
    const prevTx = useMemo(() => filteredAll.filter((t) => inRange(t, prevFrom, prevTo)), [filteredAll, prevFrom, prevTo]);
    const rows = useMemo(() => groupTotals(rangeTx, group, buckets), [rangeTx, group, buckets]);
    const prevByKey = useMemo(() => new Map(groupTotals(prevTx, group, buckets).map((r) => [r.key, r.total])), [prevTx, group, buckets]);
    const selectedRow = rows.find((r) => r.key === selected) ?? null;
    const selectedTx = useMemo(
        () => (selectedRow ? rangeTx.filter((t) => rowKeyOf(t, group, buckets) === selectedRow.key) : []),
        [selectedRow, rangeTx, group, buckets]
    );

    // Filter choices come from the period, before the filter itself is applied.
    const bucketChoices = useMemo(() => groupTotals(periodAll, "bucket", buckets), [periodAll, buckets]);
    const categoryChoices = useMemo(
        () => groupTotals(applyFilters(periodAll, { bucketKeys }, buckets), "category", buckets),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [periodAll, buckets, bucketKeys.join("|")]
    );

    const total = sumAmounts(rangeTx);
    const prevTotal = sumAmounts(prevTx);
    const hasPrev = prevTx.length > 0;
    // Future months in the range don't count towards the average.
    const elapsed = Math.max(1, monthsBetween(from, to < currentKey ? to : currentKey).length);

    const allTimeTotal = sumAmounts(filteredAll);
    const overall = earliestKey ? monthlyAverage(filteredAll, earliestKey, currentKey) : { average: 0, months: 0 };
    const p12From = earliestKey && earliestKey > shiftMonthKey(currentKey, -11) ? earliestKey : shiftMonthKey(currentKey, -11);
    const p12 = monthlyAverage(filteredAll, p12From, currentKey);

    const positiveTotal = rows.reduce((s, r) => s + Math.max(r.total, 0), 0);
    const colorFor = colorsForKeys(rows.filter((r) => r.total > 0).map((r) => r.label));
    const activePreset = PRESETS.find((p) => {
        const r = presetRange(p.id, today, earliestKey);
        return r.from === from && r.to === to;
    })?.id;
    const twoColumns = rows.length >= TWO_COLUMNS_FROM;
    const backState = { from: { label: `Overview · ${formatRange(from, to)}`, url: `${location.pathname}${location.search}` } };
    const monthUrl = (key, extra = {}) => {
        const { year, month } = parseMonthKey(key);
        return `/expenses/${year}/${ALL_MONTHS[month]}${withFilters("", { ...filters, ...extra })}`;
    };

    const toBars = (series) =>
        series.map((s) => {
            if (by === "year") return { key: s.key, value: s.value, label: s.key, title: s.key };
            const { month } = parseMonthKey(s.key);
            const short = ALL_MONTHS[month].slice(0, 3);
            return { key: s.key, value: s.value, label: spansYears && month === 0 ? `${short} '${s.key.slice(2, 4)}` : short, title: formatMonthKey(s.key) };
        });

    const openPeriod = (bar) => {
        if (by === "year") {
            const y = Number(bar.key);
            setRange({ from: `${y}-01`, to: y === today.getFullYear() ? currentKey : `${y}-12` });
            return;
        }
        navigate(monthUrl(bar.key), { state: backState });
    };

    // Opens the latest month with this row's spending, filtered to the row.
    const canOpenInMonth = Boolean(selectedRow);
    const openInMonthView = () => {
        const latest = selectedTx.reduce((max, t) => {
            const k = txMonthKey(t);
            return k > max ? k : max;
        }, from);
        const extra = group === "bucket" ? { bucketKeys: [selectedRow.key], categories: [] } : { categories: [selectedRow.label] };
        navigate(monthUrl(latest, extra), { state: backState });
    };

    const byToggle = spansYears && (
        <span className="inline-flex rounded-full border border-border bg-surface-sunken p-0.5" role="group" aria-label="Bar period">
            <button type="button" aria-pressed={by === "month"} onClick={() => update({ by: null })} className={segClass(by === "month")}>
                Months
            </button>
            <button type="button" aria-pressed={by === "year"} onClick={() => update({ by: "year" })} className={segClass(by === "year")}>
                Years
            </button>
        </span>
    );

    const trendCard = selectedRow && (
        <section aria-label={`${selectedRow.label} trend`} className="bg-surface border border-border rounded-xl shadow-card p-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    {selectedRow.label} · {by === "year" ? "year by year" : "month by month"}
                </h3>
                {byToggle}
            </div>
            <TrendBars
                label={`${selectedRow.label} by ${by}`}
                data={toBars(seriesFor(selectedTx, from, to, by))}
                color={colorFor(selectedRow.label)}
                heightClassName="h-32"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <span>
                    {selectedRow.count} transaction{selectedRow.count === 1 ? "" : "s"} ·{" "}
                    <span className="money">{formatCurrency(selectedRow.total / elapsed)}</span> / month
                </span>
                {canOpenInMonth && (
                    <button type="button" onClick={openInMonthView} className="inline-flex items-center gap-1 font-medium text-ledger-dark hover:underline">
                        See them in the month view <ArrowRight size={13} aria-hidden="true" />
                    </button>
                )}
            </div>
        </section>
    );

    return (
        <div className="page-shell">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h1 className="font-display text-2xl text-ink">Expenses</h1>
                {isLoaded && <Tour id="overview" steps={TOURS.overview} />}
                <ExpensesViewSwitch current="overview" />
            </div>

            {/* Period presets stay visible; dates, buckets and categories fold away on phones. */}
            <div className="flex gap-1.5 overflow-x-auto mb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Period">
                {PRESETS.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        aria-pressed={activePreset === p.id}
                        onClick={() => setRange(presetRange(p.id, today, earliestKey))}
                        className={chipClass(activePreset === p.id)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="mb-4">
                <ExpenseFilterPanel
                    id="overview-filters"
                    filters={filters}
                    onChange={setFilters}
                    bucketChoices={bucketChoices}
                    categoryChoices={categoryChoices}
                    extraCount={activePreset ? 0 : 1}
                >
                    <div className="flex items-center gap-2 text-xs text-ink-muted">
                        <label className="flex items-center gap-1">
                            From
                            <input
                                type="month"
                                value={from}
                                max={to}
                                onChange={(e) => parseMonthKey(e.target.value) && setRange({ from: e.target.value, to })}
                                className="border border-border rounded-md px-2 py-0.5 bg-surface text-ink"
                            />
                        </label>
                        <label className="flex items-center gap-1">
                            to
                            <input
                                type="month"
                                value={to}
                                min={from}
                                onChange={(e) => parseMonthKey(e.target.value) && setRange({ from, to: e.target.value })}
                                className="border border-border rounded-md px-2 py-0.5 bg-surface text-ink"
                            />
                        </label>
                    </div>
                </ExpenseFilterPanel>
            </div>

            {!isLoaded ? (
                <p role="status" className="text-ink-muted">
                    Loading…
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start mb-4">
                        <div className="space-y-2 min-w-0">
                            <section aria-label="Period total" className="hero-slate rounded-xl shadow-card px-4 py-3 sm:px-5">
                                <div className="text-[11px] uppercase tracking-wide text-white/75">
                                    Spent {formatRange(from, to)}
                                    {hasFilters && " · filtered"}
                                </div>
                                <div className="money font-display text-3xl font-bold">{formatCurrency(total)}</div>
                                <p className="text-xs text-white/85 mt-0.5">
                                    avg <span className="money">{formatCurrency(total / elapsed)}</span> / month
                                    {hasPrev && prevTotal !== 0 && (
                                        <>
                                            {" · "}
                                            {total >= prevTotal ? "▲" : "▼"} {Math.abs(((total - prevTotal) / Math.abs(prevTotal)) * 100).toFixed(0)}% vs{" "}
                                            {formatRange(prevFrom, prevTo)}
                                        </>
                                    )}
                                    {" · "}
                                    {rangeTx.length} transaction{rangeTx.length === 1 ? "" : "s"}
                                </p>
                            </section>
                            <div className="grid grid-cols-3 gap-2" aria-label="All-time figures">
                                <Stat
                                    label="Total since start"
                                    value={formatCurrency(allTimeTotal)}
                                    sub={earliestKey ? `since ${formatMonthKey(earliestKey, "short")}` : "no data yet"}
                                />
                                <Stat
                                    label="Avg / month · 12 mo"
                                    value={formatCurrency(p12.average)}
                                    sub={p12.months < 12 ? `over ${p12.months} month${p12.months === 1 ? "" : "s"} of data` : "last 12 months"}
                                />
                                <Stat
                                    label="Avg / month · all"
                                    value={formatCurrency(overall.average)}
                                    sub={`over ${overall.months} month${overall.months === 1 ? "" : "s"}`}
                                />
                            </div>
                        </div>

                        {from !== to && rangeTx.length > 0 && (
                            <section aria-label="Spending over time" className="bg-surface border border-border rounded-xl shadow-card p-4 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{by === "year" ? "Year by year" : "Month by month"}</h2>
                                    {byToggle || <span className="text-[11px] text-ink-muted">Tap a month to open it</span>}
                                </div>
                                <TrendBars label={`Spending by ${by}`} data={toBars(seriesFor(rangeTx, from, to, by))} onSelect={openPeriod} />
                            </section>
                        )}
                    </div>

                    {rangeTx.length === 0 ? (
                        <p className="text-ink-muted bg-surface border border-border rounded-xl p-6 text-center">
                            Nothing {hasFilters ? "matches the filter" : "logged"} for {formatRange(from, to)}.
                        </p>
                    ) : (
                        <section aria-labelledby="ranked-title">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <h2 id="ranked-title" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                                    By {group}
                                    {hasPrev && <span className="normal-case font-normal"> · ▲/▼ vs {formatRange(prevFrom, prevTo)}</span>}
                                </h2>
                                <span className="inline-flex rounded-full border border-border bg-surface-sunken p-0.5" role="group" aria-label="Group by">
                                    <button type="button" aria-pressed={group === "category"} onClick={() => update({ group: "category", sel: null })} className={segClass(group === "category")}>
                                        Category
                                    </button>
                                    <button type="button" aria-pressed={group === "bucket"} onClick={() => update({ group: "bucket", sel: null })} className={segClass(group === "bucket")}>
                                        Bucket
                                    </button>
                                </span>
                            </div>
                            {/* Dense flow lets the full-width trend sit right under the selected row's pair. */}
                            <ul
                                className={`grid grid-cols-1 gap-px bg-border border border-border rounded-xl shadow-card overflow-hidden ${twoColumns ? "md:grid-cols-2 grid-flow-row-dense" : ""
                                    }`}
                            >
                                {rows.flatMap((r) => {
                                    const share = positiveTotal ? (Math.max(r.total, 0) / positiveTotal) * 100 : 0;
                                    const color = colorFor(r.label);
                                    const isSelected = selected === r.key;
                                    const item = (
                                        <li key={r.key} className="bg-surface">
                                            <button
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => update({ sel: isSelected ? null : r.key })}
                                                className={`w-full h-full grid grid-cols-[0.625rem_minmax(0,1fr)_auto] gap-x-2 gap-y-1 items-center px-3 py-2 text-left transition-colors ${isSelected ? "bg-surface-sunken" : "hover:bg-surface-sunken"
                                                    }`}
                                            >
                                                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                                                <span className="text-sm font-semibold text-ink truncate">
                                                    {r.icon && <span aria-hidden="true">{r.icon} </span>}
                                                    {r.label}
                                                </span>
                                                <span className="money text-sm font-semibold text-ink">{formatCurrency(r.total)}</span>
                                                <span className="col-start-2 col-span-2 h-1.5 rounded-full bg-surface-sunken overflow-hidden" aria-hidden="true">
                                                    <span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} />
                                                </span>
                                                <span className="col-start-2 col-span-2 flex justify-between gap-2 text-[11px] text-ink-muted">
                                                    <span className="truncate">
                                                        {share.toFixed(0)}% · <span className="money">{formatCurrency(r.total / elapsed)}</span>/mo
                                                    </span>
                                                    {hasPrev && <Change now={r.total} before={prevByKey.get(r.key)} />}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                    return isSelected
                                        ? [
                                            item,
                                            <li key={`${r.key}-trend`} className="bg-surface-sunken p-3 md:col-span-2">
                                                {trendCard}
                                            </li>,
                                        ]
                                        : [item];
                                })}
                                {twoColumns && rows.length % 2 === 1 && <li className="hidden md:block bg-surface" aria-hidden="true" />}
                            </ul>
                            <p className="text-[11px] text-ink-muted mt-2">
                                {group === "category" ? "Categories include trip spending (Food on a trip counts as Food)." : "Trip spending is grouped under Travel."} Tap a row
                                for its trend.
                            </p>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
