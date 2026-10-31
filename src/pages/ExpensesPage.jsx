import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, List, Pencil, PieChart, Plane, Plus } from "lucide-react";
import { useExpenseContext } from "../context/ExpenseContext";
import { useFilter } from "../context/FilterContext";
import { useBucketsWithCategories } from "../hooks/useBucketsWithCategories";
import AddTransactionModal from "../components/AddTransactionModal";
import EditTransactionModal from "../components/EditTransactionModal";
import EditSingleTransactionModal from "../components/EditSingleTransactionModal";
import LabelledStackBar from "../components/LabelledStackBar";
import FilterBar from "../components/FilterBar";
import { ALL_MONTHS, toDateInputValue } from "../utils/dateHelpers";
import { formatCurrency } from "../utils/formatCurrency";
import { compactCurrency } from "../utils/chartFormat";
import { formatBreakdownDisplay } from "../utils/amountHelpers";
import { findTravelById, sumAmounts } from "../utils/travelHelpers";
import { classifyTransactions, groupByEffectiveBucket } from "../utils/transactionClassification";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

// "/expenses" opens the current month.
export function CurrentMonthRedirect() {
  const now = new Date();
  return <Navigate to={`/expenses/${now.getFullYear()}/${ALL_MONTHS[now.getMonth()]}`} replace />;
}

export default function ExpensesPage() {
  const { year, month } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { allTransactions, travels, accounts } = useExpenseContext();
  const { matches } = useFilter();
  const buckets = useBucketsWithCategories();

  const yearNum = parseInt(year, 10);
  const monthIndex = ALL_MONTHS.indexOf(month);
  const calendarView = params.get("view") === "calendar";

  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");
  const [selectedDay, setSelectedDay] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editDay, setEditDay] = useState(null);
  const [addForDate, setAddForDate] = useState(null);

  const monthTx = useMemo(
    () => allTransactions.filter((t) => t.yearNumber === yearNum && t.monthName === month).filter(matches),
    [allTransactions, yearNum, month, matches]
  );
  const prevTotal = useMemo(() => {
    const prev = new Date(yearNum, monthIndex - 1, 1);
    return sumAmounts(
      allTransactions.filter((t) => t.yearNumber === prev.getFullYear() && t.monthName === ALL_MONTHS[prev.getMonth()]).filter(matches)
    );
  }, [allTransactions, yearNum, monthIndex, matches]);

  const classified = useMemo(() => classifyTransactions(monthTx, buckets), [monthTx, buckets]);
  const bucketGroups = useMemo(() => [...groupByEffectiveBucket(classified).values()].sort((a, b) => b.total - a.total), [classified]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return classified.filter((t) => {
      if (chip === "travel" && !t.travelId) return false;
      if (chip !== "all" && chip !== "travel" && String(t.effectiveBucketId) !== chip) return false;
      if (q && !`${t.category} ${t.comments ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [classified, chip, query]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const t of visible) {
      if (!map.has(t.dayNumber)) map.set(t.dayNumber, []);
      map.get(t.dayNumber).push(t);
    }
    return map;
  }, [visible]);
  const days = [...byDay.keys()].sort((a, b) => b - a);

  if (Number.isNaN(yearNum) || monthIndex === -1) return <Navigate to="/expenses" replace />;

  const total = sumAmounts(monthTx);
  const shownTotal = sumAmounts(visible);
  const change = prevTotal ? ((total - prevTotal) / Math.abs(prevTotal)) * 100 : null;
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === yearNum && today.getMonth() === monthIndex;
  const daysInMonth = new Date(yearNum, monthIndex + 1, 0).getDate();
  const accountName = (id) => accounts.find((a) => a.id === id)?.name;
  const dayIdOf = (day) => monthTx.find((t) => t.dayNumber === day)?.dayId;

  const goMonth = (delta) => {
    const d = new Date(yearNum, monthIndex + delta, 1);
    setSelectedDay(null);
    navigate({ pathname: `/expenses/${d.getFullYear()}/${ALL_MONTHS[d.getMonth()]}`, search: params.toString() ? `?${params}` : "" });
  };
  const toggleView = () => setParams(calendarView ? {} : { view: "calendar" });

  const dayLabel = (day) => {
    const d = new Date(yearNum, monthIndex, day);
    const isToday = isCurrentMonth && day === today.getDate();
    return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${day}${isToday ? " · today" : ""}`;
  };

  const renderRow = (t) => {
    const travel = findTravelById(travels, t.travelId);
    const paidFrom = accountName(t.accountId);
    const parts = t.amountBreakdown?.length > 1 ? formatBreakdownDisplay(t) : null;
    const meta = [t.comments, parts, paidFrom].filter(Boolean).join(" · ");
    return (
      <li key={t.id}>
        <button
          type="button"
          onClick={() => setEditing(t)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-sunken focus-visible:bg-surface-sunken focus:outline-none"
        >
          <span
            className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 text-[11px] font-bold ${
              travel ? "bg-travel-soft text-travel-dark" : "bg-ledger-soft text-ledger-dark"
            }`}
            aria-hidden="true"
          >
            {initials(t.category)}
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-medium text-ink truncate">{t.category}</span>
              {travel && (
                <span className="inline-flex items-center gap-0.5 shrink-0 max-w-[45%] rounded-full bg-travel-soft text-travel-dark text-[10px] font-semibold px-1.5 py-px">
                  <Plane size={10} aria-hidden="true" />
                  <span className="truncate">{travel.title}</span>
                </span>
              )}
            </span>
            {meta && <span className="block text-[11px] text-ink-muted truncate">{meta}</span>}
          </span>
          <span className="money text-sm font-semibold text-ink shrink-0">{formatCurrency(t.amount)}</span>
        </button>
      </li>
    );
  };

  const dayBlock = (day, { sticky = true } = {}) => (
    <section key={day} aria-label={dayLabel(day)}>
      <div
        className={`${sticky ? "sticky top-14 z-10" : ""} flex items-center justify-between gap-2 bg-paper px-1 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted`}
      >
        <span>{dayLabel(day)}</span>
        <span className="flex items-center gap-1">
          <span className="money normal-case tracking-normal text-ink">{formatCurrency(sumAmounts(byDay.get(day) ?? []))}</span>
          <button
            type="button"
            onClick={() => setEditDay(day)}
            aria-label={`Edit all of ${dayLabel(day)}`}
            title="Edit day"
            className="p-1 rounded-md text-ink-muted hover:text-ledger-dark hover:bg-surface-sunken"
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
        </span>
      </div>
      <ul className="bg-surface border border-border rounded-xl divide-y divide-border overflow-hidden">{(byDay.get(day) ?? []).map(renderRow)}</ul>
    </section>
  );

  // Calendar: amounts printed in every cell; shade is a second cue, not the only one.
  const maxDay = Math.max(0, ...days.map((d) => sumAmounts(byDay.get(d))));
  const shade = (v) =>
    v <= 0 ? "bg-surface" : v <= maxDay / 3 ? "bg-ledger-soft" : v <= (2 * maxDay) / 3 ? "bg-ledger/30" : "bg-ledger text-white";
  const activeDay =
    selectedDay ?? (isCurrentMonth ? today.getDate() : days.length ? Math.max(...days) : 1);

  const calendar = (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
      <div>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={`${month} ${yearNum} by day`}>
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="text-[10px] text-center text-ink-muted" aria-hidden="true">
              {w}
            </span>
          ))}
          {Array.from({ length: new Date(yearNum, monthIndex, 1).getDay() }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const list = byDay.get(day) ?? [];
            const value = sumAmounts(list);
            const hasTrip = list.some((t) => t.travelId);
            const isToday = isCurrentMonth && day === today.getDate();
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                aria-pressed={activeDay === day}
                aria-label={`${month} ${day}: ${value ? formatCurrency(value) : "no spending"}${hasTrip ? ", trip day" : ""}`}
                className={`h-12 sm:h-16 rounded-lg border px-1 py-0.5 flex flex-col justify-between text-left ${shade(value)} ${
                  activeDay === day ? "border-ink ring-1 ring-ink" : "border-border"
                } ${hasTrip ? "shadow-[inset_0_-3px_0_var(--color-travel)]" : ""}`}
              >
                <span className={`text-[10px] ${isToday ? "font-bold underline" : ""}`}>{day}</span>
                <span className="money text-[10px] sm:text-xs font-semibold text-center w-full truncate">
                  {value ? (
                    <>
                      <span className="sm:hidden">{compactCurrency(value).replace("₱", "")}</span>
                      <span className="hidden sm:inline">{formatCurrency(value)}</span>
                    </>
                  ) : (
                    "–"
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-muted mt-2">Darker = more spent (amount printed in each day) · orange underline = trip day</p>
      </div>
      <div className="lg:sticky lg:top-20">
        {byDay.has(activeDay) ? (
          dayBlock(activeDay, { sticky: false })
        ) : (
          <p className="text-sm text-ink-muted bg-surface border border-border rounded-xl p-4">{dayLabel(activeDay)} - nothing logged.</p>
        )}
        <button
          type="button"
          onClick={() => setAddForDate(`${toDateInputValue(new Date(yearNum, monthIndex, activeDay))}T00:00:00`)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 bg-ledger hover:bg-ledger-dark text-white rounded-lg py-2 text-sm font-medium"
        >
          <Plus size={15} aria-hidden="true" /> Add to {dayLabel(activeDay).replace(" · today", "")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h1 className="font-display text-2xl text-ink">Expenses</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleView}
            aria-label={calendarView ? "Show as list" : "Show as calendar"}
            title={calendarView ? "List" : "Calendar"}
            className="p-2 rounded-lg border border-border bg-surface text-ledger-dark hover:border-ledger"
          >
            {calendarView ? <List size={18} aria-hidden="true" /> : <CalendarDays size={18} aria-hidden="true" />}
          </button>
          <Link
            to="/expenses/overview"
            aria-label="Overview and analytics"
            title="Overview & analytics"
            className="p-2 rounded-lg border border-border bg-surface text-ledger-dark hover:border-ledger"
          >
            <PieChart size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mb-2">
        <button type="button" onClick={() => goMonth(-1)} aria-label="Previous month" className="p-1.5 rounded-full border border-border bg-surface hover:border-ledger">
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <Link to={`/expenses/${yearNum}`} className="font-display text-lg text-ink hover:underline">
          {month} {yearNum}
        </Link>
        <button type="button" onClick={() => goMonth(1)} aria-label="Next month" className="p-1.5 rounded-full border border-border bg-surface hover:border-ledger">
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <section aria-label="Month summary" className="mb-4">
        <div className="money font-display text-3xl font-bold text-ink">{formatCurrency(total)}</div>
        <p className="text-xs text-ink-muted">
          {change != null ? `${change > 0 ? "▲ +" : change < 0 ? "▼ -" : ""}${Math.abs(change).toFixed(0)}% vs last month · ` : ""}
          {byDay.size || new Set(monthTx.map((t) => t.dayNumber)).size} days with spending
          {shownTotal !== total && (
            <>
              {" "}
              · showing <span className="money">{formatCurrency(shownTotal)}</span>
            </>
          )}
        </p>
        {bucketGroups.some((g) => g.total > 0) && (
          <div className="mt-3">
            <LabelledStackBar label="Spending by bucket" segments={bucketGroups.map((g) => ({ name: g.bucketLabel, value: g.total }))} />
          </div>
        )}
      </section>

      <FilterBar />

      <div className="space-y-2 mb-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search category or comment"
          aria-label="Search category or comment"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface text-ink focus:ring-2 focus:ring-ledger focus:outline-none"
        />
        <div role="group" aria-label="Filter" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            ["all", "All"],
            ["travel", "Travel"],
            ...bucketGroups.filter((g) => g.bucketId != null && g.bucketLabel !== "Travel").map((g) => [String(g.bucketId), g.bucketLabel]),
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={chip === value}
              onClick={() => setChip(value)}
              className={`shrink-0 inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border transition-colors ${
                chip === value ? "bg-ledger text-white border-ledger" : "bg-surface border-border text-ink-muted hover:border-ledger"
              }`}
            >
              {value === "travel" && <Plane size={11} aria-hidden="true" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {monthTx.length === 0 ? (
        <div className="text-center bg-surface border border-border rounded-xl p-6 mt-4">
          <p className="text-ink-muted mb-3">
            Nothing logged for {month} {yearNum}.
          </p>
          <button
            type="button"
            onClick={() => setAddForDate(`${toDateInputValue(isCurrentMonth ? today : new Date(yearNum, monthIndex, 1))}T00:00:00`)}
            className="inline-flex items-center gap-1.5 bg-ledger hover:bg-ledger-dark text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Plus size={15} aria-hidden="true" /> Add an expense
          </button>
        </div>
      ) : calendarView ? (
        calendar
      ) : days.length === 0 ? (
        <p className="text-sm text-ink-muted mt-4">No expenses match.</p>
      ) : (
        <div>{days.map((day) => dayBlock(day))}</div>
      )}

      {editing && <EditSingleTransactionModal transaction={editing} onClose={() => setEditing(null)} />}
      {editDay != null && (
        <EditTransactionModal
          year={yearNum}
          month={month}
          day={editDay}
          dayId={dayIdOf(editDay)}
          transactions={allTransactions.filter((t) => t.yearNumber === yearNum && t.monthName === month && t.dayNumber === editDay)}
          onClose={() => setEditDay(null)}
        />
      )}
      {addForDate && <AddTransactionModal defaultDate={addForDate} onClose={() => setAddForDate(null)} />}
    </div>
  );
}
