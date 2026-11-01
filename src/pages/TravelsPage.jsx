import { Link, useSearchParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { Plus, Plane, CalendarDays, List } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useBucketsWithCategories } from "../hooks/useBucketsWithCategories";
import { useStoredState } from "../hooks/useStoredState";
import AddTravelModal from "../components/AddTravelModal";
import EditTravelModal from "../components/EditTravelModal";
import AddTransactionModal from "../components/AddTransactionModal";
import CardActions from "../components/CardActions";
import LabelledStackBar from "../components/LabelledStackBar";
import TravelCalendar from "../components/TravelCalendar";
import Tour from "../components/Tour";
import { TOURS } from "../utils/tourSteps";
import { ALL_MONTHS, toDateInputValue } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { filterTransactionsByTravel, sumAmounts, tripDays, tripStatus } from "../utils/travelHelpers";
import { classifyTransactions, groupByCategory, groupByEffectiveBucket } from "../utils/transactionClassification";

const SORTS = [
    { value: "date", label: "Newest" },
    { value: "total", label: "Most spent" },
    { value: "perDay", label: "₱ per day" },
];

const fmt = (d, opts) => new Date(d).toLocaleDateString(undefined, opts);
function formatRange(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    if (s.getFullYear() !== e.getFullYear()) return `${fmt(s, { month: "short", day: "numeric", year: "numeric" })} – ${fmt(e, { month: "short", day: "numeric", year: "numeric" })}`;
    if (s.getMonth() !== e.getMonth()) return `${fmt(s, { month: "short", day: "numeric" })} – ${fmt(e, { month: "short", day: "numeric" })}, ${e.getFullYear()}`;
    if (s.getDate() === e.getDate()) return fmt(s, { month: "short", day: "numeric", year: "numeric" });
    return `${fmt(s, { month: "short", day: "numeric" })} – ${e.getDate()}, ${e.getFullYear()}`;
}
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function TravelsPage() {
    const { travels, allTransactions, removeTravel, isLoaded = true } = useExpenseContext();
    const buckets = useBucketsWithCategories();
    const [params, setParams] = useSearchParams();
    const calendarView = params.get("view") === "calendar";

    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState("all");
    const [sortBy, setSortBy] = useStoredState("tracker.travels.sort", "date");
    const [breakdown, setBreakdown] = useStoredState("tracker.travels.breakdown", "bucket");
    const [showAddModal, setShowAddModal] = useState(false);
    const [editTravelId, setEditTravelId] = useState(null);
    const [addExpenseFor, setAddExpenseFor] = useState(null);

    const today = useMemo(() => new Date(), []);

    const stats = useMemo(() => {
        const isToday = (t) =>
            t.yearNumber === today.getFullYear() && t.monthName === ALL_MONTHS[today.getMonth()] && t.dayNumber === today.getDate();
        return new Map(
            travels.map((travel) => {
                const tx = filterTransactionsByTravel(allTransactions, travel.id);
                const total = sumAmounts(tx);
                const days = tripDays(travel);
                const classified = classifyTransactions(tx, buckets, { ignoreTravelOverride: true });
                const toSegments = (groups, nameOf) => [...groups.values()].map((g) => ({ name: nameOf(g), value: g.total }));
                const segments = {
                    bucket: toSegments(groupByEffectiveBucket(classified), (g) => g.bucketLabel),
                    category: toSegments(groupByCategory(classified), (g) => g.category || "Uncategorized"),
                };
                return [
                    travel.id,
                    { total, days, perDay: days ? total / days : 0, segments, todaySpend: sumAmounts(tx.filter(isToday)), ...tripStatus(travel, today) },
                ];
            })
        );
    }, [travels, allTransactions, buckets, today]);

    const startYear = (t) => (t.startDate ? new Date(t.startDate).getFullYear() : null);
    const years = useMemo(() => [...new Set(travels.map(startYear).filter(Boolean))].sort((a, b) => b - a), [travels]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return travels.filter((t) => {
            if (q && !`${t.title} ${t.comments ?? ""}`.toLowerCase().includes(q)) return false;
            if (filter === "upcoming") return stats.get(t.id).status !== "past";
            if (filter !== "all") return startYear(t) === Number(filter);
            return true;
        });
    }, [travels, query, filter, stats]);

    const current = visible.filter((t) => stats.get(t.id).status === "current");
    const upcoming = visible
        .filter((t) => stats.get(t.id).status === "upcoming")
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const past = visible.filter((t) => stats.get(t.id).status === "past");
    const sortedPast = [...past].sort((a, b) =>
        sortBy === "total"
            ? stats.get(b.id).total - stats.get(a.id).total
            : sortBy === "perDay"
                ? stats.get(b.id).perDay - stats.get(a.id).perDay
                : new Date(b.startDate || 0) - new Date(a.startDate || 0)
    );
    const pastByYear = years
        .map((year) => ({ year, list: sortedPast.filter((t) => startYear(t) === year) }))
        .filter((g) => g.list.length > 0);
    const undated = sortedPast.filter((t) => !startYear(t));

    const toggleView = () => setParams(calendarView ? {} : { view: "calendar" });

    const tripCard = (travel) => {
        const s = stats.get(travel.id);
        return (
            <li key={travel.id} className="relative pl-6 pb-3 last:pb-0">
                <span className="absolute left-[3px] top-4 h-3 w-3 rounded-full border-[3px] border-travel bg-surface" aria-hidden="true" />
                <div className="group relative bg-surface border border-border rounded-xl shadow-card p-3 sm:p-4 hover:border-travel focus-within:border-travel transition-colors">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="font-semibold text-ink truncate" title={travel.title}>
                                <Link
                                    to={`/travels/${travel.id}`}
                                    className="focus-visible:outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-travel"
                                >
                                    {travel.title}
                                </Link>
                            </h3>
                            <p className="text-xs text-ink-muted">
                                {travel.startDate ? formatRange(travel.startDate, travel.endDate) : "No dates"} · {plural(s.days, "day")}
                                {s.status === "upcoming" && <span className="ml-1 font-medium text-travel-dark">· in {plural(s.daysUntil, "day")}</span>}
                            </p>
                        </div>
                        <div className="flex items-start gap-1 shrink-0">
                            <div className="text-right">
                                <div className="money font-semibold text-travel-dark">{formatCurrency(s.total)}</div>
                                {s.total > 0 && s.days > 0 && <div className="money text-[11px] text-ink-muted">{formatCurrency(s.perDay)}/day</div>}
                            </div>
                            <CardActions
                                compact
                                size={13}
                                label={travel.title}
                                onEdit={() => setEditTravelId(travel.id)}
                                onDelete={() => removeTravel(travel.id)}
                                deleteTitle="Delete travel? Its expenses are kept, just untagged."
                            />
                        </div>
                    </div>
                    {s.total > 0 && (
                        <div className="mt-2">
                            <LabelledStackBar
                                label={`Spend by ${breakdown}`}
                                height="h-2"
                                maxLegend={breakdown === "category" ? 4 : 3}
                                segments={s.segments[breakdown] ?? s.segments.bucket}
                            />
                        </div>
                    )}
                    {travel.comments && (
                        <p className="text-xs text-ink-muted mt-2 line-clamp-2" title={travel.comments}>
                            {travel.comments}
                        </p>
                    )}
                </div>
            </li>
        );
    };

    const timeline = (list) => (
        <ol className="relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">{list.map(tripCard)}</ol>
    );

    const nowCard = (travel) => {
        const s = stats.get(travel.id);
        return (
            <section key={travel.id} aria-label={`Current trip: ${travel.title}`} className="bg-travel-soft border border-travel/30 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-travel-dark bg-surface/70 rounded-full px-2 py-0.5">
                        Now · day {s.dayNumber} of {s.days}
                    </span>
                    <span className="text-xs text-ink-muted">{formatRange(travel.startDate, travel.endDate)}</span>
                </div>
                <Link to={`/travels/${travel.id}`} className="block font-display text-xl text-ink mt-2 hover:underline break-words">
                    {travel.title}
                </Link>
                <div
                    className="h-1.5 rounded-full bg-surface/70 overflow-hidden mt-2"
                    role="progressbar"
                    aria-label="Trip progress"
                    aria-valuemin={1}
                    aria-valuemax={s.days}
                    aria-valuenow={s.dayNumber}
                >
                    <div className="h-full bg-travel" style={{ width: `${(s.dayNumber / s.days) * 100}%` }} />
                </div>
                <dl className="grid grid-cols-3 gap-2 my-3">
                    {[
                        ["Today", s.todaySpend],
                        ["So far", s.total],
                        ["Per day", s.total / s.dayNumber],
                    ].map(([label, value]) => (
                        <div key={label} className="bg-surface rounded-lg px-2 py-1.5 min-w-0">
                            <dt className="text-[11px] text-ink-muted">{label}</dt>
                            <dd className="money text-sm font-semibold text-ink truncate">{formatCurrency(value)}</dd>
                        </div>
                    ))}
                </dl>
                <button
                    type="button"
                    onClick={() => setAddExpenseFor(travel)}
                    className="w-full flex items-center justify-center gap-2 bg-travel hover:bg-travel-dark text-white font-medium rounded-lg py-2"
                >
                    <Plus size={16} aria-hidden="true" />
                    Add expense for today
                </button>
            </section>
        );
    };

    const hasResults = current.length + upcoming.length + sortedPast.length > 0;

    return (
        <div className="page-shell">
            <div className="flex justify-between items-center mb-4 gap-2">
                <h1 className="font-display text-2xl text-ink">{calendarView ? "Travel calendar" : "Travels"}</h1>
                {isLoaded && travels.length > 0 && !calendarView && <Tour id="travels" steps={TOURS.travels} />}
                <div className="flex items-center gap-2">
                    {travels.length > 0 && (
                        <button
                            type="button"
                            onClick={toggleView}
                            aria-label={calendarView ? "Show trip list" : "Show travel calendar"}
                            title={calendarView ? "Trip list" : "Travel calendar"}
                            className="p-2 rounded-lg border border-border bg-surface text-travel-dark hover:border-travel"
                        >
                            {calendarView ? <List size={18} aria-hidden="true" /> : <CalendarDays size={18} aria-hidden="true" />}
                        </button>
                    )}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-travel hover:bg-travel-dark text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <Plus size={16} aria-hidden="true" />
                        Trip
                    </button>
                </div>
            </div>

            {isLoaded && travels.length === 0 && <p className="text-ink-muted">No travels created yet.</p>}

            {travels.length > 0 && calendarView && <TravelCalendar travels={travels} />}

            {travels.length > 0 && !calendarView && (
                <>
                    <div className="mb-5 space-y-2">
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search trips"
                            aria-label="Search trips"
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-travel focus:outline-none"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <div role="group" aria-label="Filter trips" className="flex gap-1.5 overflow-x-auto basis-full sm:basis-auto sm:flex-1 min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {[["all", "All"], ["upcoming", "Upcoming"], ...years.map((y) => [String(y), String(y)])].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={filter === value}
                                        onClick={() => setFilter(value)}
                                        className={`shrink-0 text-xs px-3 py-1 rounded-full border transition-colors ${filter === value ? "bg-travel text-white border-travel" : "bg-surface border-border text-ink-muted hover:border-travel"
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <span className="inline-flex shrink-0 rounded-full border border-border bg-surface-sunken p-0.5 ml-auto sm:ml-0" role="group" aria-label="Breakdown by">
                                {[
                                    ["bucket", "Bucket"],
                                    ["category", "Category"],
                                ].map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={breakdown === value}
                                        onClick={() => setBreakdown(value)}
                                        className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${breakdown === value ? "bg-surface text-ink font-semibold shadow-sm" : "text-ink-muted hover:text-ink"
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </span>
                            <label className="flex items-center gap-1 text-xs text-ink-muted shrink-0">
                                <span className="sr-only sm:not-sr-only">Sort</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    aria-label="Sort past trips"
                                    className="border border-border rounded-md px-1.5 py-1 bg-surface text-ink text-xs"
                                >
                                    {SORTS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    {!hasResults && <p className="text-ink-muted text-sm">No trips match.</p>}

                    {current.map(nowCard)}

                    {upcoming.length > 0 && (
                        <section aria-labelledby="trips-upcoming" className="mb-6">
                            <h2 id="trips-upcoming" className="font-display text-lg text-ink mb-2">
                                Upcoming
                            </h2>
                            {timeline(upcoming)}
                        </section>
                    )}

                    {sortBy === "date" ? (
                        <>
                            {pastByYear.map(({ year, list }) => (
                                <section key={year} aria-labelledby={`trips-${year}`} className="mb-6">
                                    <div className="flex items-baseline justify-between gap-2 mb-2">
                                        <h2 id={`trips-${year}`} className="font-display text-lg text-ink">
                                            {year}
                                        </h2>
                                        <span className="text-xs text-ink-muted">
                                            {plural(list.length, "trip")} ·{" "}
                                            <span className="money">{formatCurrency(list.reduce((sum, t) => sum + stats.get(t.id).total, 0))}</span>
                                        </span>
                                    </div>
                                    {timeline(list)}
                                </section>
                            ))}
                            {undated.length > 0 && (
                                <section className="mb-6">
                                    <h2 className="font-display text-lg text-ink mb-2">Undated</h2>
                                    {timeline(undated)}
                                </section>
                            )}
                        </>
                    ) : (
                        sortedPast.length > 0 && (
                            <section aria-label={`Past trips by ${SORTS.find((s) => s.value === sortBy)?.label}`} className="mb-6">
                                <h2 className="font-display text-lg text-ink mb-2">Past trips</h2>
                                {timeline(sortedPast)}
                            </section>
                        )
                    )}
                </>
            )}

            {showAddModal && <AddTravelModal onClose={() => setShowAddModal(false)} />}
            {editTravelId && <EditTravelModal travelId={editTravelId} onClose={() => setEditTravelId(null)} />}
            {addExpenseFor && (
                <AddTransactionModal
                    defaultTravelId={addExpenseFor.id}
                    defaultDate={`${toDateInputValue(today)}T00:00:00`}
                    onClose={() => setAddExpenseFor(null)}
                />
            )}
        </div>
    );
}
