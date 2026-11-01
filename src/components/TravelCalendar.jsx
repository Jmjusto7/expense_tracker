import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ALL_MONTHS } from "../utils/dateHelpers";
import { buildTravelCalendar, travelCalendarYears } from "../utils/travelHelpers";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Shade steps for the overview; the day count is always printed too.
const heatClass = (days) =>
    days === 0
        ? "text-ink-muted/50"
        : days < 4
            ? "bg-travel-soft text-travel-dark"
            : days < 10
                ? "bg-travel text-white"
                : "bg-travel-dark text-white";

function MiniMonth({ year, month, data, today }) {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const travelDays = data?.days.size ?? 0;
    const isToday = (day) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(<span key={`pad-${i}`} />);
    for (let day = 1; day <= daysInMonth; day++) {
        const trips = data?.days.get(day) ?? [];
        const style =
            trips.length > 1
                ? "relative bg-travel-dark text-white font-semibold after:absolute after:bottom-0.5 after:h-1 after:w-1 after:rounded-full after:bg-white"
                : trips.length
                    ? "bg-travel text-white font-semibold"
                    : "text-ink-muted";
        cells.push(
            <span
                key={day}
                title={trips.length ? `${shortDate(new Date(year, month, day))}: ${trips.map((t) => t.title).join(", ")}` : undefined}
                className={`h-5 sm:h-6 flex items-center justify-center rounded text-[10px] sm:text-[11px] money ${style} ${isToday(day) ? "ring-2 ring-ink ring-offset-1" : ""}`}
            >
                {day}
            </span>
        );
    }

    return (
        <section
            id={`travel-month-${year}-${month}`}
            aria-label={`${ALL_MONTHS[month]} ${year}: ${travelDays ? plural(travelDays, "travel day") : "no trips"}`}
            className={`scroll-mt-20 min-w-0 bg-surface border rounded-lg p-2 sm:p-3 ${travelDays ? "border-travel/40" : "border-border"}`}
        >
            <div className="flex items-baseline justify-between gap-1 mb-1.5">
                <h3 className={`text-sm font-semibold ${travelDays ? "text-ink" : "text-ink-muted"}`}>{ALL_MONTHS[month].slice(0, 3)}<span className="hidden sm:inline">{ALL_MONTHS[month].slice(3)}</span></h3>
                <span className={`text-[11px] ${travelDays ? "text-travel-dark font-medium" : "text-ink-muted"}`}>
                    {travelDays ? plural(travelDays, "day") : "No trips"}
                </span>
            </div>
            <div className="grid grid-cols-7 gap-0.5" aria-hidden="true">
                {WEEKDAYS.map((w, i) => (
                    <span key={i} className="text-[10px] text-center text-ink-muted/70">
                        {w}
                    </span>
                ))}
                {cells}
            </div>
            {data && (
                <ul className="mt-2 space-y-0.5">
                    {[...data.travels].map((t) => (
                        <li key={t.id} className="text-[11px] sm:text-xs min-w-0">
                            <Link to={`/travels/${t.id}`} className="block truncate text-travel-dark font-medium hover:underline" title={t.title}>
                                {t.title}
                            </Link>
                            <span className="block text-ink-muted">
                                {shortDate(t.startDate)} – {shortDate(t.endDate)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

export default function TravelCalendar({ travels }) {
    const today = useMemo(() => new Date(), []);
    const calendar = useMemo(() => buildTravelCalendar(travels), [travels]);
    const years = useMemo(() => travelCalendarYears(calendar, today), [calendar, today]);
    const [year, setYear] = useState(() => today.getFullYear());

    const daysIn = (y, m) => calendar.get(`${y}-${m}`)?.days.size ?? 0;
    const yearDays = ALL_MONTHS.reduce((sum, _, m) => sum + daysIn(year, m), 0);
    const monthsTravelled = ALL_MONTHS.filter((_, m) => daysIn(year, m) > 0).length;
    const yearTrips = new Set(ALL_MONTHS.flatMap((_, m) => [...(calendar.get(`${year}-${m}`)?.travels ?? [])])).size;
    const yearIndex = years.indexOf(year);

    const jumpTo = (y, m) => {
        setYear(y);
        requestAnimationFrame(() => document.getElementById(`travel-month-${y}-${m}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    return (
        <div>
            <section aria-labelledby="travel-overview-title" className="bg-surface border border-border rounded-lg shadow-card p-3 sm:p-4 mb-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <h2 id="travel-overview-title" className="text-sm font-semibold text-ink">
                        Months travelled
                    </h2>
                    <span className="text-xs text-ink-muted">Travel days per month · tap a month to open it</span>
                </div>
                <div>
                    <table className="w-full table-fixed border-separate border-spacing-0.5 text-center">
                        <thead>
                            <tr>
                                <th scope="col" className="w-9 sm:w-12">
                                    <span className="sr-only">Year</span>
                                </th>
                                {ALL_MONTHS.map((m) => (
                                    <th key={m} scope="col" className="text-[10px] font-medium text-ink-muted" title={m}>
                                        {m.slice(0, 1)}
                                        <span className="hidden sm:inline">{m.slice(1, 3)}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {years.map((y) => (
                                <tr key={y}>
                                    <th scope="row" className="pr-1 text-left">
                                        <button
                                            type="button"
                                            onClick={() => setYear(y)}
                                            aria-pressed={y === year}
                                            className={`text-[11px] font-semibold rounded ${y === year ? "text-travel-dark underline underline-offset-4" : "text-ink-muted hover:text-ink"}`}
                                        >
                                            {y}
                                        </button>
                                    </th>
                                    {ALL_MONTHS.map((m, i) => {
                                        const days = daysIn(y, i);
                                        return (
                                            <td key={m} className="p-0">
                                                <button
                                                    type="button"
                                                    onClick={() => jumpTo(y, i)}
                                                    aria-label={`${m} ${y}: ${days ? plural(days, "travel day") : "no trips"}`}
                                                    className={`money w-full h-7 rounded text-[11px] font-semibold ${heatClass(days)} hover:ring-2 hover:ring-travel focus-visible:ring-2 focus-visible:ring-ink`}
                                                >
                                                    {days || "·"}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setYear(years[yearIndex + 1])}
                        disabled={yearIndex >= years.length - 1}
                        aria-label="Previous year"
                        className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken disabled:opacity-30"
                    >
                        <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                    <h2 className="font-display text-xl text-ink min-w-[4ch] text-center">{year}</h2>
                    <button
                        type="button"
                        onClick={() => setYear(years[yearIndex - 1])}
                        disabled={yearIndex <= 0}
                        aria-label="Next year"
                        className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-sunken disabled:opacity-30"
                    >
                        <ChevronRight size={18} aria-hidden="true" />
                    </button>
                </div>
                <p className="text-sm text-ink-muted">
                    {monthsTravelled} of 12 months · {plural(yearDays, "travel day")} · {plural(yearTrips, "trip")}
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {ALL_MONTHS.map((_, m) => (
                    <MiniMonth key={m} year={year} month={m} data={calendar.get(`${year}-${m}`)} today={today} />
                ))}
            </div>
            <p className="text-xs text-ink-muted mt-3">
                Filled days are travel days; a dot marks a day with two trips. Trips are listed under each month.
            </p>
        </div>
    );
}
